/* ================================================================================================
   SAO LƯU CSDL TỰ ĐỘNG                                                                      v9.37
   ------------------------------------------------------------------------------------------------
   Nguyen 2026-11-10: *"thêm chức năng backup data lên lịch hẹn tự động. SQL hay lỗi nên ko tự
   backup data"*.

   🔴 VÌ SAO KHÔNG DÙNG SQL SERVER AGENT:
   Bản **Express** của SQL Server BỊ CẮT HẲN SQL Server Agent — không có bộ lập lịch, nên mọi job
   backup tạo ra đều KHÔNG BAO GIỜ CHẠY. Đó gần như chắc chắn là "SQL hay lỗi nên không tự backup".
   Nên lịch nằm ở ỨNG DỤNG (node-cron, đã có sẵn trong package.json), không nằm ở SQL. Phần mềm chạy
   dưới pm2 24/7 nên lịch luôn sống; pm2 chết thì cả ERP chết, không ai không nhận ra.

   🔴 BA LUẬT SỐNG CÒN CỦA FILE NÀY — đọc trước khi sửa:

   1. **KHÔNG BAO GIỜ XÓA BẢN SAO LƯU CUỐI CÙNG.** Dọn file cũ theo số ngày là con dao hai lưỡi:
      backup hỏng 40 ngày mà vẫn dọn đều thì đến ngày thứ 41 KHÔNG CÒN BẢN NÀO. Luật ở đây là giữ
      lại ít nhất `SO_BAN_LUON_GIU` bản mới nhất, BẤT KỂ bao nhiêu ngày tuổi.

   2. **KIỂM CHỖ TRỐNG TRƯỚC KHI SAO LƯU.** Ổ đầy giữa chừng để lại một file .bak cụt (vô dụng,
      nhưng vẫn chiếm chỗ) và có thể kéo sập chính CSDL đang chạy. Thà không sao lưu và GÀO LÊN
      còn hơn làm đầy ổ của máy chủ cả xưởng.

   3. **FILE .bak LÀ TOÀN BỘ DỮ LIỆU CÔNG TY.** Tuyệt đối KHÔNG đặt dưới `uploads/` hay bất cứ thư
      mục nào Express phục vụ tĩnh — cổng 80 công khai ra internet qua Cloudflare Tunnel. Hàm
      `kiemThuMucAnToan()` chặn việc đó.

   ⚠️ BACKUP CHẠY BẰNG TÀI KHOẢN CỦA DỊCH VỤ SQL SERVER, KHÔNG PHẢI CỦA NODE. Node chỉ gửi câu lệnh;
   chính SQL Server mới ghi file. Nên thư mục đích phải cấp quyền Ghi cho tài khoản dịch vụ
   (thường `NT Service\MSSQL$<TÊN_INSTANCE>`). Lỗi "Operating system error 5 (Access is denied)" là
   dấu hiệu của đúng chuyện này — hàm `giaiThichLoi()` dịch nó ra tiếng người.
   ================================================================================================ */
const fs = require('fs');
const path = require('path');
const { sql, getPool, config } = require('../db');

/* ------------------------------------------------------------------------------------------------
   🔴 KẾT NỐI RIÊNG CHO VIỆC SAO LƯU — requestTimeout dài.

   `mssql` mặc định **15 giây** mỗi câu lệnh (db.js không khai requestTimeout). BACKUP DATABASE +
   RESTORE VERIFYONLY gần như chắc chắn vượt 15s. Dùng pool chung thì: câu lệnh bị cắt ở giây thứ
   15, Node báo "thất bại", trong khi SQL Server VẪN ĐANG GHI TIẾP ở phía nó — kết quả là màn hình
   báo đỏ, email báo hỏng, mà file .bak lại ra bình thường. Sai nghiêm trọng vì nó dạy người dùng
   bỏ qua cảnh báo.

   KHÔNG tăng timeout của pool chung: 15s đang là tấm chắn cho mọi truy vấn nghiệp vụ khác.
   Pool riêng này mở khi cần, đóng ngay sau khi xong — không giữ kết nối rỗi.
   ------------------------------------------------------------------------------------------------ */
const TIMEOUT_SAO_LUU_MS = Math.max(5, Number(process.env.BACKUP_TIMEOUT_PHUT) || 60) * 60 * 1000;

async function moKetNoiSaoLuu() {
  const cfg = Object.assign({}, config, {
    requestTimeout: TIMEOUT_SAO_LUU_MS,
    pool: { max: 1, min: 0, idleTimeoutMillis: 10000 }
  });
  return new sql.ConnectionPool(cfg).connect();
}

const TEN_CSDL = process.env.DB_NAME || 'QLNoiBo';
/* Hệ số an toàn chỗ trống: .bak thường nhỏ hơn dung lượng cấp phát (chỉ chứa trang CÓ dữ liệu),
   nhưng lấy dư cho chắc — thiếu chỗ giữa chừng tệ hơn nhiều so với bỏ một lần sao lưu. */
const HE_SO_CHO_TRONG = 1.3;
/* v9.41 từng có sàn cứng 2 GB cho sao lưu log. v9.44 thay bằng `nguongTrongGB` khai trên màn hình
   (mặc định 5 GB) dùng chung cho cả hai loại sao lưu — xem `donDeDuCho()`. */

/* ================================================================================================
   CẤU HÌNH NẰM TRONG CSDL, KHÔNG NẰM Ở .env                                           (v9.37)
   ------------------------------------------------------------------------------------------------
   Nguyen 2026-11-10: *"trong backup có chọn thư mục backup"*.

   Khai ở `.env` nghĩa là mỗi lần đổi thư mục phải sửa file trên máy chủ rồi `pm2 restart` — không
   phải thứ người dùng tự làm được. Nay lưu ở bảng **`CauHinh`** (khóa `SAO_LUU`, giá trị JSON) —
   bảng key-value ĐÃ CÓ SẴN từ trước, dùng chung với 'MAY_IN_TEM' và 'CHAM_CONG'. **Không migration.**

   `.env` vẫn được đọc làm GIÁ TRỊ MẶC ĐỊNH lần đầu (tương thích ngược cho ai đã khai), nhưng một
   khi đã lưu trong phần mềm thì bản trong CSDL THẮNG — nếu không thì sửa trên màn hình xong restart
   lại quay về giá trị cũ, đúng kiểu lỗi làm người dùng mất niềm tin vào cả màn hình.

   Nạp vào RAM một lần lúc khởi động để các hàm đọc đồng bộ được; `luuCauHinh()` cập nhật lại ngay.
   ================================================================================================ */
const KHOA_CH = 'SAO_LUU';
const MAC_DINH = {
  bat: true,
  thuMuc: String(process.env.BACKUP_THU_MUC || '').trim(),
  gioChay: String(process.env.BACKUP_GIO_CHAY || '15 1 * * *').trim(),
  soNgayGiu: Math.max(1, Number(process.env.BACKUP_SO_NGAY_GIU) || 30),
  soBanLuonGiu: Math.max(1, Number(process.env.BACKUP_SO_BAN_LUON_GIU) || 3),
  emailBao: String(process.env.BACKUP_EMAIL_BAO || '').trim(),
  /* v9.41 — SAO LƯU TRANSACTION LOG. Mặc định TẮT: bật nhầm trên CSDL đang ở SIMPLE là mỗi giờ một
     lần báo lỗi. Mỗi giờ một lần = mất nhiều nhất 1 giờ dữ liệu khi sự cố. */
  batLog: false,
  gioChayLog: '0 * * * *',
  /* v9.44 — ngưỡng giữ trống trên ổ đích (GB). Thiếu thì xóa bản cũ nhất để lấy chỗ. Nguyen: 5 GB. */
  nguongTrongGB: 5
};
let __ch = Object.assign({}, MAC_DINH);

function cauHinh() { return __ch; }

/* Chuẩn hóa + chặn giá trị vô lý NGAY TẠI ĐÂY, không tin dữ liệu từ form lẫn từ CSDL (bản ghi cũ
   có thể do bản phần mềm trước ghi với cấu trúc khác). */
function chuanCauHinh(v) {
  const o = v && typeof v === 'object' ? v : {};
  return {
    bat: o.bat !== false,
    thuMuc: String(o.thuMuc == null ? MAC_DINH.thuMuc : o.thuMuc).trim(),
    gioChay: String(o.gioChay || MAC_DINH.gioChay).trim(),
    soNgayGiu: Math.min(3650, Math.max(1, Number(o.soNgayGiu) || MAC_DINH.soNgayGiu)),
    /* 🔴 Trần 1, không cho 0: 0 nghĩa là "được phép xóa sạch" — đúng thứ LUẬT 1 sinh ra để chặn. */
    soBanLuonGiu: Math.min(100, Math.max(1, Number(o.soBanLuonGiu) || MAC_DINH.soBanLuonGiu)),
    emailBao: String(o.emailBao || '').trim(),
    /* v9.40 — BẢN SAO NGOÀI MÁY. Để trống = tắt. Xem khối ghi chú `chepSangThuMucPhu()`. */
    thuMucPhu: String(o.thuMucPhu || '').trim(),
    soNgayGiuPhu: Math.min(3650, Math.max(1, Number(o.soNgayGiuPhu) || Number(o.soNgayGiu) || MAC_DINH.soNgayGiu)),
    /* v9.41 — sao lưu transaction log. KHÔNG có "số ngày giữ" riêng: hạn của file log bị buộc vào
       bản FULL cũ nhất còn giữ, xem `donLogCu()`. Cho người dùng gõ một con số ở đây là mời họ phá
       chuỗi log mà không biết. */
    batLog: o.batLog === true,
    gioChayLog: String(o.gioChayLog || MAC_DINH.gioChayLog).trim(),
    /* v9.44 — gõ 0 / để trống ⇒ về MẶC ĐỊNH 5 (không phải sàn 1): 0 nghĩa là "cho phép ghi tới khi ổ
       đầy hẳn", đúng thứ LUẬT 2 chặn, nên coi như chưa khai. Sàn 1 GB cho số lẻ nhỏ (0.5 → 1). Trần
       1000 GB — gõ nhầm 5000 thì từ v9.44 không còn từ chối, chỉ xóa 3 bản/đêm, nhưng vẫn chặn cho sạch. */
    nguongTrongGB: Math.min(1000, Math.max(1, Number(o.nguongTrongGB) || MAC_DINH.nguongTrongGB))
  };
}

async function napCauHinh() {
  try {
    const pool = await getPool();
    const r = (await pool.request().input('k', sql.NVarChar(80), KHOA_CH)
      .query('SELECT GiaTri FROM CauHinh WHERE Khoa = @k')).recordset[0];
    if (r && r.GiaTri) {
      try { __ch = chuanCauHinh(JSON.parse(r.GiaTri)); }
      catch (e) { console.error('[saoluu] CauHinh.' + KHOA_CH + ' hỏng JSON, dùng mặc định: ' + e.message); }
    }
  } catch (e) {
    /* Chưa có bảng CauHinh / CSDL chưa sẵn sàng: dùng .env, KHÔNG để vỡ lúc khởi động. */
    console.warn('[saoluu] chưa đọc được cấu hình từ CSDL (dùng .env): ' + e.message);
  }
  return __ch;
}

async function luuCauHinh(moi) {
  const ch = chuanCauHinh(Object.assign({}, __ch, moi));
  const loi = kiemThuMucAnToan(ch.thuMuc);
  if (loi) throw new Error(loi);
  /* Thư mục thứ hai: kiểm CÙNG luật an toàn (không nằm trong uploads/, phải tuyệt đối), nhưng
     KHÔNG đòi SQL Server nhìn thấy ổ — cả mục đích của nó là nằm trên ổ SQL không thấy (Google
     Drive), và Node mới là bên chép. Chặn trùng thư mục chính: chép đè lên chính nó = vô nghĩa. */
  if (ch.thuMucPhu) {
    const l2 = kiemThuMucAnToan(ch.thuMucPhu);
    if (l2) throw new Error('Thư mục bản sao thứ hai: ' + l2);
    if (path.resolve(ch.thuMucPhu) === path.resolve(ch.thuMuc)) {
      throw new Error('Thư mục bản sao thứ hai phải KHÁC thư mục sao lưu chính — '
        + 'để cùng chỗ thì không có bản sao nào cả.');
    }
  }
  const pool = await getPool();
  await pool.request()
    .input('k', sql.NVarChar(80), KHOA_CH)
    .input('v', sql.NVarChar(sql.MAX), JSON.stringify(ch))
    .query(`MERGE CauHinh AS t USING (SELECT @k AS Khoa) AS s ON t.Khoa = s.Khoa
            WHEN MATCHED THEN UPDATE SET GiaTri = @v, UpdatedAt = SYSDATETIME()
            WHEN NOT MATCHED THEN INSERT (Khoa, GiaTri, UpdatedAt) VALUES (@k, @v, SYSDATETIME());`);
  __ch = ch;
  return ch;
}

/* Trạng thái lần chạy gần nhất — để màn hình và email biết chuyện gì đã xảy ra.
   Giữ trong RAM thôi: pm2 restart là mất, nhưng `docDanhSachBan()` đọc thẳng thư mục nên màn hình
   vẫn biết bản sao lưu gần nhất là bao giờ. Không cần thêm bảng CSDL cho một thứ suy ra được. */
let __lanCuoi = null;      // { luc, thanhCong, thongDiep, tenFile, dungLuong, soGiay }
let __dangChay = false;    // chặn chạy chồng (cron + bấm tay cùng lúc)

/* ------------------------------------------------------------------------------------------------
   THƯ MỤC ĐÍCH — kiểm an toàn trước khi dùng.
   ------------------------------------------------------------------------------------------------ */
function kiemThuMucAnToan(tm) {
  /* Câu chữ phải chỉ về Ô NHẬP ĐANG Ở TRƯỚC MẶT, không chỉ người dùng đi sửa file .env trên máy chủ
     — từ v9.37 cấu hình nằm trong phần mềm, bảo họ đi sửa .env là chỉ sai đường. */
  if (!tm) {
    return 'Chưa chọn thư mục lưu — điền vào ô "Thư mục lưu", hoặc bấm một ổ đĩa trong danh sách ở trên.';
  }
  if (!path.isAbsolute(tm)) {
    return 'Phải là đường dẫn ĐẦY ĐỦ trên máy chủ, ví dụ D:\\BackupQLNoiBo — không phải đường dẫn tương đối.';
  }
  /* 🔴 .bak = toàn bộ dữ liệu công ty. uploads/ được phục vụ tĩnh ra cổng 80 công khai. */
  const uploads = path.resolve(__dirname, '..', 'uploads');
  const goc = path.resolve(__dirname, '..', '..');
  const d = path.resolve(tm);
  if (d === uploads || d.startsWith(uploads + path.sep)) {
    return '🔴 BACKUP_THU_MUC nằm trong thư mục uploads/ — thư mục đó phục vụ công khai ra internet. '
      + 'File sao lưu chứa TOÀN BỘ dữ liệu công ty. Đổi sang ổ khác ngay.';
  }
  if (d === goc || d.startsWith(goc + path.sep)) {
    return '🔴 BACKUP_THU_MUC nằm trong chính thư mục cài phần mềm — ổ hỏng là mất cả hai. '
      + 'Đặt sang Ổ ĐĨA KHÁC.';
  }
  return '';
}

/* ------------------------------------------------------------------------------------------------
   DÒ PHIÊN BẢN SQL — quyết định có nén được không.
   Nén backup KHÔNG có ở bản Express; ép dùng là câu lệnh gãy. Dò rồi mới quyết, không đoán.
   ------------------------------------------------------------------------------------------------ */
async function thongTinMayChu(pool) {
  const r = (await pool.request().query(`
    SELECT CAST(SERVERPROPERTY('Edition') AS NVARCHAR(200)) AS Edition,
           CAST(SERVERPROPERTY('ProductVersion') AS NVARCHAR(50)) AS Version,
           (SELECT recovery_model_desc FROM sys.databases WHERE name = DB_NAME()) AS RecoveryModel,
           (SELECT CAST(ISNULL(SUM(size) * 8.0 / 1024, 0) AS DECIMAL(18,1))
              FROM sys.master_files WHERE database_id = DB_ID() AND type = 0) AS DataMB,
           (SELECT CAST(ISNULL(SUM(size) * 8.0 / 1024, 0) AS DECIMAL(18,1))
              FROM sys.master_files WHERE database_id = DB_ID() AND type = 1) AS LogMB`)).recordset[0] || {};
  const ed = String(r.Edition || '');
  /* v9.40: ổ nào đang chứa file CSDL — để cảnh báo khi thư mục sao lưu rơi vào cùng ổ.
     Đọc được thì tốt, không thì mảng rỗng (nơi dùng phải coi rỗng = "không biết", không phải "không có"). */
  let oCuaCSDL = [];
  try {
    const f = (await pool.request()
      .query('SELECT physical_name FROM sys.master_files WHERE database_id = DB_ID()')).recordset;
    const t = new Set();
    f.forEach(x => {
      const m = String(x.physical_name || '').match(/^([A-Za-z]):/);
      if (m) t.add(m[1].toUpperCase());
    });
    oCuaCSDL = [...t];
  } catch (e) { /* bỏ qua */ }

  /* 🔴 v9.41: KÍCH THƯỚC FILE LOG ≠ PHẦN LOG ĐANG DÙNG. Đây là chỗ hiểu nhầm trung tâm của cả tính
     năng này. `BACKUP LOG` **cắt** log (đánh dấu phần cũ dùng lại được) nhưng **KHÔNG làm file nhỏ
     lại** — file .ldf vẫn nguyên 136 MB, chỉ là thôi phình. Nhìn mỗi kích thước file thì sau khi
     sao lưu log vẫn thấy 136 MB và tưởng chưa ăn thua gì.
     `sys.dm_db_log_space_usage` cho biết bao nhiêu phần trăm ĐANG thực sự được dùng — đó mới là con
     số nói log có được cắt hay không. Lỗi thì bỏ qua: chỉ là phần phụ. */
  let logDungPhanTram = null, logDungMB = null;
  try {
    const l = (await pool.request().query(
      `SELECT CAST(used_log_space_in_bytes / 1048576.0 AS DECIMAL(18,1)) AS DungMB,
              CAST(used_log_space_in_percent AS DECIMAL(18,1)) AS DungPT
       FROM sys.dm_db_log_space_usage`)).recordset[0];
    if (l) { logDungMB = Number(l.DungMB); logDungPhanTram = Number(l.DungPT); }
  } catch (e) { /* bỏ qua */ }

  /* Đã từng có bản FULL nào chưa — `BACKUP LOG` HỎNG nếu chưa (Msg 4214). Hỏi msdb thay vì để SQL
     ném ra câu lỗi mà người dùng không hiểu. */
  let coFullTruocDo = null, lanFullCuoi = null;
  try {
    const b = (await pool.request().query(
      `SELECT MAX(backup_finish_date) AS Lan FROM msdb.dbo.backupset
       WHERE database_name = DB_NAME() AND type = 'D'`)).recordset[0];
    lanFullCuoi = b && b.Lan ? b.Lan : null;
    coFullTruocDo = !!lanFullCuoi;
  } catch (e) { /* không đọc được msdb (thiếu quyền) ⇒ null = "không biết", đừng chặn */ }

  return {
    edition: ed,
    version: String(r.Version || ''),
    laExpress: /express/i.test(ed),
    nenDuoc: !/express|web/i.test(ed),   // Express và Web không có BACKUP COMPRESSION
    recoveryModel: String(r.RecoveryModel || ''),
    dataMB: Number(r.DataMB) || 0,
    logMB: Number(r.LogMB) || 0,
    logDungMB, logDungPhanTram,
    coFullTruocDo, lanFullCuoi,
    oCuaCSDL
  };
}

/* ------------------------------------------------------------------------------------------------
   DANH SÁCH BẢN SAO LƯU ĐANG CÓ — đọc thẳng thư mục, không cần bảng CSDL.
   ------------------------------------------------------------------------------------------------ */
/* 🔴 MỘT khuôn tên DUY NHẤT cho cả việc liệt kê, dọn bản cũ và cho tải về. Bản đầu dùng bộ lọc lỏng
   `f.indexOf(TEN_CSDL) === 0 && /\.bak$/i` — tức MỌI file bắt đầu bằng "QLNoiBo" và kết thúc ".bak"
   đều bị coi là của hệ thống và đủ điều kiện bị XÓA sau 30 ngày. Kỹ thuật viên đặt tay một file
   `QLNoiBo_truoc_khi_nang_cap.bak` vào đúng thư mục đó (việc rất tự nhiên) là mất, im lặng.
   Khuôn chặt dưới đây chỉ khớp đúng tên do chính phần mềm sinh ra: <CSDL>_YYYYMMDD_HHMM.bak */
function khuonTenBan() {
  return new RegExp('^' + TEN_CSDL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '_\\d{8}_\\d{4}\\.bak$', 'i');
}

/* ------------------------------------------------------------------------------------------------
   🔴 v9.41 — FILE TRƯỢT `RESTORE VERIFYONLY` PHẢI BỊ GẠT KHỎI DANH SÁCH
   ------------------------------------------------------------------------------------------------
   Bản đầu chỉ báo "KIỂM TRA LẠI THẤY HỎNG" rồi **để nguyên file trên ổ**. Mà `docDanhSachBan()` /
   `docDanhSachLog()` đọc thẳng thư mục, nên file hỏng đó lập tức thành "bản mới nhất":
     · ô to "Bản sao lưu DÙNG ĐƯỢC gần nhất" chỉ vào một file ĐÃ BIẾT CHẮC là hỏng;
     · phép "hỏng bây giờ thì mất bao nhiêu" đếm từ nó;
     · `soBanLuonGiu` có thể đang giữ ba bản hỏng;
     · `donLogCu()` lấy mtime của bản FULL hỏng làm mốc xóa log.
   Đổi đuôi thành `.HONG` là đủ: hai khuôn tên tự loại nó khỏi mọi danh sách, mà file vẫn còn để
   chẩn đoán. KHÔNG xóa — xóa là mất chứng cứ của một lỗi đĩa đang diễn ra.
   SQL Server tạo file nên Node có thể không đổi tên được (chủ sở hữu khác) ⇒ nuốt lỗi, nói ra. */
function gatFileHong(duongDan) {
  try {
    if (!fs.existsSync(duongDan)) return '';
    fs.renameSync(duongDan, duongDan + '.HONG');
    return ' Đã đổi tên file thành "' + path.basename(duongDan) + '.HONG" để nó không bị đếm nhầm là bản dùng được.';
  } catch (e) {
    return ' ⚠️ KHÔNG đổi tên được file hỏng (' + e.message + ') — hãy XÓA TAY file '
      + path.basename(duongDan) + ', nếu không nó sẽ bị đếm là bản sao lưu dùng được.';
  }
}

/* v9.41: khuôn riêng cho bản sao lưu TRANSACTION LOG — `<CSDL>_LOG_YYYYMMDD_HHMM.trn`.
   🔴 Đuôi `.trn` và có chữ `_LOG_` nên KHÔNG bao giờ lọt vào `khuonTenBan()`. Hai họ file phải tách
   bạch tuyệt đối: luật dọn của chúng khác nhau về bản chất (xem `donLogCu`). */
function khuonTenLog() {
  return new RegExp('^' + TEN_CSDL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '_LOG_\\d{8}_\\d{6}\\.trn$', 'i');
}

function docDanhSachLog(thuMuc) {
  const TM = thuMuc || __ch.thuMuc;
  if (!TM || !fs.existsSync(TM)) return [];
  const khuon = khuonTenLog();
  return fs.readdirSync(TM)
    .filter(f => khuon.test(f))
    .map(f => {
      const p = path.join(TM, f);
      let st = null;
      try { st = fs.statSync(p); } catch (e) { return null; }
      return { ten: f, duongDan: p, luc: st.mtime, dungLuong: st.size };
    })
    .filter(Boolean)
    .sort((a, b) => b.luc - a.luc);
}

function docDanhSachBan(thuMuc) {
  const THU_MUC = thuMuc || __ch.thuMuc;
  if (!THU_MUC || !fs.existsSync(THU_MUC)) return [];
  const khuon = khuonTenBan();
  return fs.readdirSync(THU_MUC)
    .filter(f => khuon.test(f))
    .map(f => {
      const p = path.join(THU_MUC, f);
      let st = null;
      try { st = fs.statSync(p); } catch (e) { return null; }
      return { ten: f, duongDan: p, luc: st.mtime, dungLuong: st.size };
    })
    .filter(Boolean)
    .sort((a, b) => b.luc - a.luc);   // mới nhất trước
}

/* ------------------------------------------------------------------------------------------------
   CHỖ TRỐNG CỦA Ổ ĐÍCH. Node 18+ có fs.statfsSync; máy cũ hơn thì trả null (bỏ qua phép kiểm, có
   ghi chú trong log — thà chạy còn hơn chặn oan vì không đo được).
   ------------------------------------------------------------------------------------------------ */
/* v9.44 — móc cho BỘ TỰ KIỂM thay phép đo bằng số giả (qua `__datChoTrongGia`). Null = đo thật. Không
   có móc này thì không kiểm được `donDeDuCho` bằng hành vi — và đó là hàm XÓA FILE SAO LƯU. */
let __choTrongGia = null;
function choTrongMB(tm) {
  if (__choTrongGia) { try { return __choTrongGia(tm); } catch (e) { return null; } }
  try {
    if (typeof fs.statfsSync !== 'function') return null;
    const s = fs.statfsSync(tm);
    return (Number(s.bavail) * Number(s.bsize)) / (1024 * 1024);
  } catch (e) { return null; }
}

/* ------------------------------------------------------------------------------------------------
   🔴 GOM ĐỦ LỖI SQL — KHÔNG LẤY MỖI `e.message`
   ------------------------------------------------------------------------------------------------
   Một lệnh BACKUP hỏng thì SQL Server trả về HAI lỗi, theo đúng thứ tự này:
     Msg 3201 — "Cannot open backup device ... Operating system error 5(Access is denied.)"  ← LÝ DO
     Msg 3013 — "BACKUP DATABASE is terminating abnormally."                                 ← tổng kết
   Driver `mssql` ném ra lỗi CUỐI CÙNG ở `e.message`, tức câu tổng kết vô nghĩa, và nhét các lỗi
   trước nó vào `e.precedingErrors`. Bản đầu của tôi chỉ đọc `e.message` nên người dùng nhận đúng
   một câu "BACKUP DATABASE is terminating abnormally." — không nói được phải làm gì, và
   `giaiThichLoi()` cũng không khớp mẫu nào nên trả về nguyên câu đó.
   (Nguyen gặp đúng lỗi này 10/11/2026 khi bấm "Kiểm tra thư mục".)
   ------------------------------------------------------------------------------------------------ */
function moTaLoiSQL(e) {
  if (!e) return '';
  const ds = [];
  const them = (x) => {
    const m = x && (typeof x === 'string' ? x : x.message);
    if (m && ds.indexOf(m) === -1) ds.push(m);
  };
  (Array.isArray(e.precedingErrors) ? e.precedingErrors : []).forEach(them);
  if (e.originalError) { them(e.originalError); them(e.originalError.info); }
  them(e);
  /* Bỏ câu tổng kết KHI còn câu khác — còn mỗi nó thì vẫn phải trả ra, im lặng tệ hơn. */
  const that = ds.filter(m => !/terminating abnormally/i.test(m));
  return (that.length ? that : ds).join(' | ');
}

/* Hỏi THẲNG SQL Server xem dịch vụ của nó chạy bằng tài khoản Windows nào. Đây là câu người dùng
   cần nhất khi gặp lỗi quyền — đoán "NT Service\MSSQLSERVER" sai là họ cấp quyền cho nhầm tài khoản
   rồi tưởng mình đã làm đúng. Lỗi thì bỏ qua: đây chỉ là phần phụ của thông điệp. */
async function taiKhoanDichVuSQL(pool) {
  try {
    const r = await pool.request().query(
      `SELECT servicename, service_account FROM sys.dm_server_services
       WHERE servicename LIKE '%SQL Server%' AND servicename NOT LIKE '%Agent%'`);
    const d = r.recordset && r.recordset[0];
    return d && d.service_account ? String(d.service_account) : null;
  } catch (e) { return null; }
}

/* Dịch lỗi SQL ra việc phải làm — xem khối ghi chú đầu file về tài khoản dịch vụ.
   `taiKhoan` là tên tài khoản dịch vụ ĐỌC ĐƯỢC THẬT (có thì dùng, không thì nói kiểu chung). */
function giaiThichLoi(loi, tm, taiKhoan) {
  const s = String(loi || '');
  const ai = taiKhoan ? '"' + taiKhoan + '"' : 'tài khoản dịch vụ SQL Server (thường "NT Service\\MSSQLSERVER" '
    + 'hoặc "NT Service\\MSSQL$<tên instance>") — xem đúng tên ở Services.msc → SQL Server (…) → Log On';
  if (/operating system error 5|access is denied/i.test(s)) {
    return 'SQL Server KHÔNG CÓ QUYỀN GHI vào ' + tm + '. Backup chạy bằng ' + ai + ', '
      + 'KHÔNG phải tài khoản anh đang đăng nhập. Chuột phải thư mục → Properties → Security → Edit '
      + '→ Add → gõ tên tài khoản trên → cấp Modify. Gốc: ' + s;
  }
  if (/operating system error 1326|logon failure|operating system error 53|network path/i.test(s)) {
    return 'Thư mục ' + tm + ' nằm trên Ổ MẠNG / ổ ánh xạ. Dịch vụ SQL Server không nhìn thấy ổ ánh xạ '
      + 'của người đang đăng nhập, và ' + ai + ' thường không có quyền ra mạng. '
      + 'Chọn một thư mục trên ổ cứng gắn trực tiếp vào máy chủ. Gốc: ' + s;
  }
  if (/operating system error 32|being used by another process/i.test(s)) {
    return 'File sao lưu đang bị chương trình khác giữ (phần mềm diệt virus, Windows Backup, '
      + 'hoặc đang copy dở). Thử lại sau, hoặc loại trừ thư mục ' + tm + ' khỏi phần mềm diệt virus. Gốc: ' + s;
  }
  if (/operating system error 2(\D|$)|cannot find the file/i.test(s)) {
    return 'SQL Server không tìm thấy đường dẫn ' + tm + '. Lưu ý đường dẫn phải là đường dẫn TRÊN MÁY CHỦ '
      + '(nơi SQL Server chạy), không phải trên máy anh đang ngồi. Gốc: ' + s;
  }
  if (/operating system error 3(\D|$)|cannot find the path/i.test(s)) {
    return 'Không có thư mục ' + tm + ' trên máy chủ (hoặc ổ chưa cắm / đổi ký tự ổ). '
      + 'Đường dẫn phải là đường dẫn TRÊN MÁY CHỦ, không phải trên máy anh đang ngồi. Gốc: ' + s;
  }
  if (/operating system error 112|not enough space|disk full/i.test(s)) {
    return 'Ổ đĩa ĐẦY, không ghi nổi file sao lưu. Dọn bớt rồi chạy lại. Gốc: ' + s;
  }
  /* v9.41 — hai lỗi RIÊNG của sao lưu log. Guard trong `chayLogMotLan` bắt được chúng KHI đọc được
     `recoveryModel` và `msdb`; nhưng tài khoản chỉ có `db_backupoperator` thì không đọc được
     `msdb.dbo.backupset` ⇒ guard bỏ qua ⇒ SQL ném câu tiếng Anh, mỗi giờ một lần. */
  if (/no current database backup|\b4214\b/i.test(s)) {
    return 'Chưa từng có bản sao lưu ĐẦY ĐỦ nào cho CSDL này, nên không sao lưu log được — chuỗi log '
      + 'phải bắt đầu từ một bản đầy đủ. Bấm "Sao lưu ngay" một lần rồi thử lại. Gốc: ' + s;
  }
  if (/SIMPLE recovery model|\b4208\b/i.test(s)) {
    return 'CSDL đang ở chế độ SIMPLE recovery — ở chế độ này SQL Server tự cắt log, không có gì để '
      + 'sao lưu và cũng không khôi phục về thời điểm được. Hãy TẮT mục "Sao lưu log". Gốc: ' + s;
  }
  if (/permission was denied|principal|BACKUP DATABASE permission/i.test(s)) {
    return 'Tài khoản phần mềm dùng để nối vào SQL Server (DB_USER trong backend\\.env) KHÔNG có '
      + 'quyền BACKUP. Cấp cho nó vai trò db_backupoperator trên CSDL, hoặc sysadmin. Gốc: ' + s;
  }
  /* 🔴 Không nhận ra thì ĐỪNG trả câu SQL trần — người dùng không làm gì được với nó. Nói luôn cách
     tự lấy lý do thật trong SSMS, vì đó là bước tiếp theo duy nhất có nghĩa. */
  if (/terminating abnormally/i.test(s) || !s) {
    return 'SQL Server từ chối ghi file sao lưu nhưng không nói rõ lý do qua phần mềm. '
      + 'Mở SQL Server Management Studio trên MÁY CHỦ, chạy câu sau rồi gửi tôi nguyên văn dòng lỗi '
      + '"Msg 3201": BACKUP DATABASE [master] TO DISK = N\'' + tm + '\\thu.bak\' WITH INIT, FORMAT; '
      + '— nguyên nhân hay gặp nhất là ' + ai + ' chưa được cấp quyền Modify trên thư mục đó. Gốc: ' + s;
  }
  return s;
}

/* ------------------------------------------------------------------------------------------------
   DỌN BẢN CŨ — xem LUẬT 1 ở đầu file.
   ------------------------------------------------------------------------------------------------ */
function donBanCu(thuMuc, soNgayGiu) {
  const SO_NGAY_GIU = soNgayGiu || __ch.soNgayGiu;
  const SO_BAN_LUON_GIU = __ch.soBanLuonGiu;
  const ds = docDanhSachBan(thuMuc);
  const hanMs = Date.now() - SO_NGAY_GIU * 24 * 60 * 60 * 1000;
  const daXoa = [];
  /* Bỏ qua `SO_BAN_LUON_GIU` bản mới nhất rồi mới xét tuổi — kể cả khi chúng đã quá hạn.
     Đây là tấm lưới cuối: sao lưu hỏng dài ngày thì vẫn còn vài bản cũ để khôi phục. */
  ds.slice(SO_BAN_LUON_GIU).forEach(b => {
    if (b.luc.getTime() >= hanMs) return;
    try { fs.unlinkSync(b.duongDan); daXoa.push(b.ten); }
    catch (e) { console.error('[saoluu] không xóa được bản cũ ' + b.ten + ': ' + e.message); }
  });
  return daXoa;
}

/* ================================================================================================
   v9.41 — DỌN BẢN SAO LƯU LOG: LUẬT KHÁC HẲN BẢN FULL, ĐỪNG DÙNG LẠI `donBanCu`
   ------------------------------------------------------------------------------------------------
   🔴 Các bản log tạo thành một CHUỖI LIÊN TỤC. Muốn khôi phục về một thời điểm, SQL Server phải
   dựng lại: một bản FULL, rồi MỌI bản log nối tiếp từ đó tới thời điểm cần. Thủng một mắt giữa
   chuỗi là từ mắt đó trở đi KHÔNG khôi phục được nữa — kể cả các bản log mới hơn vẫn còn nguyên
   trên ổ. Đây là kiểu mất mát không thấy được cho tới đúng lúc cần dùng.

   Vì vậy KHÔNG được dọn log theo tuổi như bản FULL ("quá 30 ngày thì xóa"): làm thế là cắt ngang
   chuỗi của chính bản FULL mình vẫn đang giữ.

   LUẬT ĐÚNG, và là lý do màn hình KHÔNG cho gõ "số ngày giữ log":
       chỉ xóa bản log CŨ HƠN bản FULL CŨ NHẤT còn giữ lại.
   Như vậy từ bất kỳ bản FULL nào còn trên ổ, chuỗi log nối tiếp nó luôn còn đủ.
   Hệ quả: hạn của log TỰ ĐỘNG đi theo hạn của bản FULL. Không có con số thứ hai để gõ sai.
   ================================================================================================ */
/* 🔴 MỐC THỜI GIAN LẤY TỪ TÊN FILE, KHÔNG LẤY TỪ `mtime`.
   `mtime` KHÔNG bất biến: `fs.copyFileSync` sang thư mục phụ đặt mtime = lúc chép; Google Drive
   tải lại thư mục thì đặt lại nữa; một lệnh `copy`/`robocopy` tay, hay phần mềm diệt virus "chữa"
   file, cũng làm mới mtime của MỌI file .bak.
   Khi mtime của tất cả .bak nhảy lên "bây giờ", mốc so sánh thành ≈ Date.now() ⇒ MỌI file .trn
   đều "cũ hơn" ⇒ bị xóa sạch trong MỘT lượt, im lặng. Mất toàn bộ khả năng khôi phục về thời điểm,
   và không ai thấy cho tới đúng lúc cần dùng.
   Tên file đã mã hóa sẵn thời điểm (`_YYYYMMDD_HHMM` và `_LOG_YYYYMMDD_HHMMSS`) — nó bất biến.
   Lấy `min(theo tên, mtime)` để mọi sai lệch đều nghiêng về GIỮ, không nghiêng về xóa. */
function mocTuTen(ten, mtime) {
  const m = String(ten).match(/_(?:LOG_)?(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})?\./);
  const t = mtime instanceof Date ? mtime.getTime() : Number(mtime) || 0;
  if (!m) return t;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]),
                     Number(m[4]), Number(m[5]), Number(m[6] || 0));
  const tt = d.getTime();
  if (!isFinite(tt)) return t;
  return t > 0 ? Math.min(tt, t) : tt;
}

/* Số bản log mới nhất LUÔN giữ, bất kể mốc nào nói gì. Đây là bản sao của LUẬT 1 ("không bao giờ
   xóa tới mức không còn gì") cho họ file .trn — bản đầu v9.41 thiếu hẳn lưới này, trong khi
   `donBanCu` thì có. Đủ cho một ngày ở chu kỳ 30 phút. */
const SO_LOG_LUON_GIU = 48;

function donLogCu(thuMuc) {
  const TM = thuMuc || __ch.thuMuc;
  const full = docDanhSachBan(TM);
  /* Chưa có bản FULL nào ⇒ KHÔNG xóa gì. Mọi bản log đang có đều có thể là phần của chuỗi thuộc
     một bản FULL sắp tới hoặc đã bị chuyển đi nơi khác. Nghi ngờ thì GIỮ. */
  if (!full.length) return [];
  /* Bản FULL CŨ NHẤT còn giữ. Lấy mốc NHỎ NHẤT trong cả danh sách chứ không chỉ phần tử cuối: danh
     sách được sắp theo mtime, mà mtime vừa bị tuyên là không đáng tin — sắp theo nó có thể sai thứ tự. */
  const mocCu = Math.min(...full.map(b => mocTuTen(b.ten, b.luc)));
  const daXoa = [];
  docDanhSachLog(TM)
    /* Sắp lại theo mốc LẤY TỪ TÊN. `docDanhSachLog` sắp theo mtime, mà mtime vừa bị tuyên là không
       đáng tin — "N bản mới nhất" tính trên thứ tự sai thì lưới an toàn giữ nhầm bản. */
    .sort((a, b) => mocTuTen(b.ten, b.luc) - mocTuTen(a.ten, a.luc))
    .slice(SO_LOG_LUON_GIU)          // bỏ qua N bản mới nhất rồi mới xét
    .forEach(b => {
      if (mocTuTen(b.ten, b.luc) >= mocCu) return;
      try { fs.unlinkSync(b.duongDan); daXoa.push(b.ten); }
      catch (e) { console.error('[saoluu] không xóa được bản log cũ ' + b.ten + ': ' + e.message); }
    });
  return daXoa;
}

/* ------------------------------------------------------------------------------------------------
   CHẠY MỘT LẦN SAO LƯU TRANSACTION LOG.
   Giống `chayMotLan`: KHÔNG BAO GIỜ NÉM LỖI RA NGOÀI — nó chạy trong cron mỗi giờ.
   ------------------------------------------------------------------------------------------------ */
let __dangChayLog = false;
let __lanCuoiLog = null;

async function chayLogMotLan(nguon) {
  if (__dangChayLog) return { thanhCong: false, thongDiep: 'Đang có một lần sao lưu log chạy dở — bỏ qua lần này.' };
  if (__dangChay) return { thanhCong: false, thongDiep: 'Đang chạy sao lưu đầy đủ — hoãn lần sao lưu log này.' };
  __dangChayLog = true;
  const batDau = Date.now();
  const ghi = (ok, td, ten) => {
    __lanCuoiLog = { luc: new Date(), thanhCong: ok, thongDiep: td, tenFile: ten || null,
                     soGiay: Math.round((Date.now() - batDau) / 1000) };
    if (!ok) console.error('[saoluu-log] 🔴 THẤT BẠI: ' + td);
    return { thanhCong: ok, thongDiep: td, tenFile: ten || null };
  };

  let poolSL = null;
  try {
    const THU_MUC = __ch.thuMuc;
    const loiTM = kiemThuMucAnToan(THU_MUC);
    if (loiTM) return ghi(false, loiTM);
    try { fs.mkdirSync(THU_MUC, { recursive: true }); }
    catch (e) { return ghi(false, 'Không tạo được thư mục ' + THU_MUC + ': ' + e.message); }

    try { poolSL = await moKetNoiSaoLuu(); }
    catch (e) { return ghi(false, 'Không kết nối được SQL Server: ' + e.message); }
    const pool = poolSL;
    const tt = await thongTinMayChu(pool);

    /* 🔴 HAI ĐIỀU KIỆN BẮT BUỘC, kiểm TRƯỚC khi chạy — để trả về câu người dùng làm được việc,
       thay vì để SQL ném Msg 4208 / 4214 mà không ai hiểu. */
    if (!/FULL|BULK/i.test(tt.recoveryModel)) {
      return ghi(false, 'CSDL đang ở chế độ ' + (tt.recoveryModel || '?') + '. Chỉ chế độ FULL (hoặc '
        + 'BULK_LOGGED) mới sao lưu được transaction log — ở SIMPLE thì SQL Server tự cắt log, không '
        + 'có gì để sao lưu và cũng không khôi phục về thời điểm được. Hãy TẮT mục "Sao lưu log" đi.');
    }
    if (tt.coFullTruocDo === false) {
      return ghi(false, 'Chưa từng có bản sao lưu ĐẦY ĐỦ nào cho CSDL này, nên không sao lưu log được '
        + '(chuỗi log phải bắt đầu từ một bản đầy đủ). Bấm "Sao lưu ngay" một lần rồi thử lại.');
    }

    /* 🔴 KIỂM CHỖ TRỐNG — LUẬT 2 của file này, áp cho cả log. Thiếu phép này là lỗ nặng nhất của
       bản đầu v9.41: thư mục sao lưu nằm trên ổ D:, mà FILE CSDL CŨNG nằm trên D:. Giữ 30 ngày log
       nghĩa là tới 720 file .trn. Khi D: đầy thì vòng lặp chết đóng lại:
         BACKUP LOG hỏng → log không được cắt → .ldf phình → đầy nốt ổ chứa CSDL
         → SQL Server ngừng nhận ghi → CẢ XƯỞNG DỪNG.
       Mốc lấy theo phần log ĐANG DÙNG (đó mới là thứ sắp ghi ra), kèm sàn tuyệt đối. */
    /* v9.44: thiếu thì DỌN bản đầy đủ cũ nhất (kéo theo log cũ hơn nó) rồi đo lại — xem
       `donDeDuCho()`. Với log, từ chối còn nguy hiểm hơn từ chối sao lưu đầy đủ (log không cắt ⇒
       .ldf phình ⇒ đầy ổ CSDL), nên càng phải cố dọn trước khi bó tay. */
    /* Chế độ 'log': CHỈ dọn .trn vô dụng và .HONG, KHÔNG BAO GIỜ xóa .bak — xem khối ghi chú donDeDuCho. */
    const canMoiMB = choCanChoBanMoiMB(THU_MUC, 'log', tt);
    const don = donDeDuCho(THU_MUC, __ch.nguongTrongGB * 1024, canMoiMB, 'log');
    if (!don.du) {
      return ghi(false, `Ổ đích chỉ còn ${Math.round(don.trongSau || 0)} MB, không đủ chỗ cho bản log (cần ${Math.round(canMoiMB)} MB). `
        + 'Sao lưu log KHÔNG được phép xóa bản đầy đủ để lấy chỗ — việc đó chỉ lịch sao lưu đầy đủ mới làm. '
        + '🔴 Log sẽ KHÔNG được cắt chừng nào chưa có chỗ — file .ldf sẽ tiếp tục phình, và nếu nó làm '
        + 'đầy ổ chứa CSDL thì SQL Server ngừng nhận ghi. Dọn file KHÁC trên ổ này NGAY.');
    }
    const ghiChuDonLog = don.daXoa.length
      ? `, đã dọn ${don.daXoaTrn} bản log vô dụng${don.daXoaHong ? ' + ' + don.daXoaHong + ' file hỏng' : ''}` : '';

    const nhan = new Date();
    const hai = (n) => String(n).padStart(2, '0');
    /* Giờ VN của máy chủ, KHÔNG toISOString. Có cả GIÂY vì mỗi giờ một lần vẫn có thể bấm tay
       trùng phút — trùng tên file là `WITH INIT` ghi đè mất một mắt xích của chuỗi. */
    const tenFile = `${TEN_CSDL}_LOG_${nhan.getFullYear()}${hai(nhan.getMonth() + 1)}${hai(nhan.getDate())}`
      + `_${hai(nhan.getHours())}${hai(nhan.getMinutes())}${hai(nhan.getSeconds())}.trn`;
    const duongDan = path.join(THU_MUC, tenFile);

    /* 🔴 TRÙNG TÊN = GHI ĐÈ = ĐỨT CHUỖI. `WITH INIT` ghi đè file cùng tên không hỏi. Với bản .bak
       thì ghi đè chỉ mất một điểm khôi phục; với .trn thì mất MỘT MẮT XÍCH, và chuỗi đứt từ đó trở
       đi. Tên có cả giây nên khó trùng, nhưng không phải không thể: bản log trên CSDL yên tĩnh chạy
       dưới một giây, nên cron đầu giờ cộng một cú bấm tay rơi đúng cùng giây là trùng — và đồng hồ
       máy chủ bị chỉnh lùi thì trùng chắc chắn. Hai dòng chặn hẳn. */
    if (fs.existsSync(duongDan)) {
      return ghi(false, 'Đã có file trùng tên ' + tenFile + ' trong thư mục sao lưu. KHÔNG ghi đè — '
        + 'ghi đè một bản log là làm đứt chuỗi khôi phục từ thời điểm đó trở đi. '
        + 'Thử lại sau vài giây, hoặc kiểm tra đồng hồ của máy chủ.');
    }

    /* 🔴 TUYỆT ĐỐI KHÔNG dùng COPY_ONLY ở đây: bản log COPY_ONLY KHÔNG cắt log và KHÔNG nằm trong
       chuỗi — tức là vừa không giải quyết được chuyện log phình, vừa vô dụng khi khôi phục.
       Cũng KHÔNG dùng `WITH TRUNCATE_ONLY` (đã bỏ từ SQL 2008, và nó PHÁ chuỗi log). */
    const nen = tt.nenDuoc ? ', COMPRESSION' : '';
    try {
      await pool.request().input('d', sql.NVarChar(400), duongDan)
        .query(`BACKUP LOG [${TEN_CSDL}] TO DISK = @d WITH INIT, CHECKSUM, FORMAT, NAME = N'QLNoiBo log'${nen}`);
    } catch (e) {
      const tk = await taiKhoanDichVuSQL(pool);
      return ghi(false, giaiThichLoi(moTaLoiSQL(e), THU_MUC, tk));
    }

    try {
      await pool.request().input('d', sql.NVarChar(400), duongDan)
        .query('RESTORE VERIFYONLY FROM DISK = @d WITH CHECKSUM');
    } catch (e) {
      const g = gatFileHong(duongDan);
      return ghi(false, 'Đã ghi file log nhưng KIỂM TRA LẠI THẤY HỎNG — coi như thất bại. '
        + giaiThichLoi(moTaLoiSQL(e), THU_MUC, null) + g, null);
    }

    let cl = 0;
    try { cl = fs.statSync(duongDan).size; } catch (e) { /* vừa ghi xong */ }
    const loiPhu = chepSangThuMucPhu(duongDan, tenFile);
    if (loiPhu) console.error('[saoluu-log] bản sao thứ hai: ' + loiPhu);
    const daXoa = donLogCu();
    try { if (__ch.thuMucPhu) donLogCu(__ch.thuMucPhu); } catch (e) { /* bỏ qua */ }

    const sau = await thongTinMayChu(pool);
    const tin = `Sao lưu log xong: ${tenFile} (${(cl / 1024 / 1024).toFixed(1)} MB)`
      + ghiChuDonLog
      + (sau.logDungPhanTram != null ? `, log đang dùng ${sau.logDungPhanTram}%` : '')
      + (daXoa.length ? `, đã dọn ${daXoa.length} bản log cũ hơn bản đầy đủ cũ nhất` : '');
    console.log('[saoluu-log] (' + nguon + ') ' + tin);
    return ghi(true, tin, tenFile);
  } catch (e) {
    return ghi(false, 'Lỗi ngoài dự kiến: ' + (e && e.message));
  } finally {
    if (poolSL) { try { await poolSL.close(); } catch (e) { console.warn('[saoluu-log] đóng kết nối: ' + e.message); } }
    __dangChayLog = false;
  }
}

/* ================================================================================================
   v9.40 — BẢN SAO NGOÀI MÁY (chép sang thư mục thứ hai)
   ------------------------------------------------------------------------------------------------
   Nguyen 10/11/2026: muốn bản sao lưu nằm trên Google Drive (`G:\BackupQLNoiBo`).

   🔴 SQL Server KHÔNG ghi thẳng lên đó được, và đây không phải chuyện cấu hình. Ổ Google Drive /
   OneDrive / Dropbox / ổ ánh xạ mạng được gắn vào PHIÊN ĐĂNG NHẬP của một người dùng cụ thể. Dịch
   vụ SQL Server chạy ở phiên khác, dưới tài khoản khác — với nó ký tự ổ đó KHÔNG TỒN TẠI. Cấp
   quyền thư mục bao nhiêu cũng không sửa được. (Ép dịch vụ SQL chạy bằng tài khoản người dùng thì
   hỏng kiểu khác: khởi động lại máy mà chưa ai đăng nhập là SQL không lên.)

   Nên luồng là: SQL ghi xuống ổ TRONG MÁY → phần mềm (tiến trình Node, chạy trong phiên CÓ thấy ổ
   G:) CHÉP bản đó sang. Chính vì Node thấy ổ G: nên lúc nãy nó tạo được `G:\BackupQLNoiBo` và làm
   người dùng tưởng đã xong.

   🔴 "Chép xong" ≠ "Google đã nhận". Google Drive nhận file vào hàng đợi rồi tải lên dần. Vì vậy
   KHÔNG BAO GIỜ được coi bản trên G: là chỗ dựa duy nhất để xóa bản trong máy — và đó là lý do
   bản trong máy vẫn giữ đủ 30 ngày độc lập.

   🔴 Chép hỏng KHÔNG làm lần sao lưu thành thất bại: file trong máy đã ghi và đã xác minh, nói nó
   thất bại là nói dối theo chiều nguy hiểm (người dùng đi tìm lỗi sai chỗ). Nhưng cũng KHÔNG được
   im lặng — nó đi vào `lanCuoi.loiPhu`, vào danh sách cảnh báo của màn hình, và vào email.
   ================================================================================================ */
function chepSangThuMucPhu(duongDanGoc, tenFile) {
  const dich = __ch.thuMucPhu;
  if (!dich) return null;                       // không bật — không phải lỗi
  try {
    const loi = kiemThuMucAnToan(dich);
    if (loi) return 'Thư mục bản sao thứ hai không dùng được: ' + loi;
    fs.mkdirSync(dich, { recursive: true });
    /* Chép ra tên TẠM rồi mới đổi tên: Google Drive theo dõi thư mục theo thời gian thực, thấy file
       đang chép dở là đẩy luôn bản cụt lên mây. Đổi tên là thao tác nguyên tử trong cùng ổ. */
    const tam = path.join(dich, '~dangchep_' + tenFile);
    const cuoi = path.join(dich, tenFile);
    try { if (fs.existsSync(tam)) fs.unlinkSync(tam); } catch (e) { /* bỏ qua */ }
    fs.copyFileSync(duongDanGoc, tam);
    const cvGoc = fs.statSync(duongDanGoc).size;
    const cvTam = fs.statSync(tam).size;
    if (cvGoc !== cvTam) {
      try { fs.unlinkSync(tam); } catch (e) { /* bỏ qua */ }
      return 'Chép sang ' + dich + ' bị thiếu dữ liệu (' + cvTam + '/' + cvGoc + ' byte) — đã bỏ bản lỗi.';
    }
    try { if (fs.existsSync(cuoi)) fs.unlinkSync(cuoi); } catch (e) { /* bỏ qua */ }
    fs.renameSync(tam, cuoi);
    donBanCu(dich, __ch.soNgayGiuPhu);
    return null;
  } catch (e) {
    /* ENOENT ở đây gần như luôn là "ứng dụng Google Drive không chạy / đã đăng xuất" — ổ biến mất
       khỏi phiên. Nói đúng chuyện đó thay vì ném câu lỗi hệ thống trần ra màn hình. */
    const s = String(e && e.message || e);
    if (/ENOENT|ENODEV|no such file or directory/i.test(s)) {
      return 'Không ghi được vào ' + dich + ' — ổ này có thể đã biến mất (ứng dụng Google Drive / '
        + 'OneDrive trên máy chủ đã thoát hoặc bị đăng xuất, hoặc ổ ngoài đã rút). '
        + 'Bản sao lưu TRONG MÁY vẫn tốt. Gốc: ' + s;
    }
    if (/ENOSPC/i.test(s)) return 'Hết dung lượng ở ' + dich + ' (kiểm dung lượng Google Drive). Gốc: ' + s;
    return 'Không chép được sang ' + dich + ': ' + s;
  }
}

/* ================================================================================================
   v9.44 — DỌN BẢN CŨ NHẤT ĐỂ ĐỦ CHỖ CHO BẢN MỚI (Nguyen 2026-11-11)
   ------------------------------------------------------------------------------------------------
   Nguyen: *"check dung lượng ổ cứng khi còn 5Gb thì xóa file cũ nhất để lưu file mới. Có chỗ cài
   đặt dung lượng ổ cứng"*.

   Trước v9.44 (LUẬT 2 bản đầu): thiếu chỗ ⇒ TỪ CHỐI sao lưu, bảo người dùng tự dọn. Đúng về mặt
   "không làm đầy ổ", nhưng sai về mặt vận hành: ổ đầy dần là chuyện chắc chắn xảy ra (30 bản × 90 MB
   + 720 bản log), và "bảo người dùng tự dọn" nghĩa là một đêm nào đó không có bản sao lưu — đúng
   kiểu hỏng âm thầm mà cả phân hệ này sinh ra để chặn.

   Nay: thiếu chỗ ⇒ xóa bản ĐẦY ĐỦ CŨ NHẤT (kéo theo các bản log cũ hơn nó, qua `donLogCu` — chuỗi
   log vẫn nguyên), đo lại, lặp tới khi đủ hoặc tới khi KHÔNG CÒN GÌ ĐƯỢC PHÉP XÓA.

   🔴 "KHÔNG CÒN GÌ ĐƯỢC PHÉP XÓA" = đã chạm `soBanLuonGiu` (LUẬT 1, mặc định 3). Giữ nguyên, không
   nới: ổ hết chỗ mà xóa nốt bản cuối thì vừa không có chỗ VỪA không còn bản nào để khôi phục — hai
   cái hỏng cùng lúc. Lúc đó TỪ CHỐI và nói rõ đã xóa bao nhiêu, còn thiếu bao nhiêu.

   Ngưỡng `nguongTrongGB` khai trên màn hình (mặc định 5 GB). Cần chỗ = ngưỡng + kích thước ước tính
   của bản sắp ghi (lấy bản gần nhất cùng loại; chưa có thì lấy từ kích thước CSDL × hệ số dư).

   Chỉ áp cho THƯ MỤC CHÍNH. Thư mục thứ hai (Google Drive) có hạn giữ riêng và `choTrongMB` trên ổ
   ảo không đáng tin — chép sang đó hỏng vì hết chỗ thì đã có `loiPhu` báo riêng.
   ================================================================================================ */
/* 🔴 HAI MỐC KHÁC NHAU, ĐỪNG GỘP. Bản đầu v9.44 lấy ngưỡng 5 GB làm CẢ mốc kích hoạt LẪN mốc đích
   và không chặn số lần xóa. Rà chéo chỉ ra: với 30 bản × 90 MB = 2,7 GB sao lưu thì một đêm ổ tụt
   xuống 2,8 GB là xóa sạch 27 bản RỒI VẪN TỪ CHỐI — hủy 100% lịch sử mà không đổi lại được gì.

   Hợp đồng đúng:
     · BẮT BUỘC   trống ≥ chỗ cho BẢN MỚI (`canMoiMB`, = ước tính × 2). Không đạt ⇒ từ chối ghi.
     · MONG MUỐN  trống ≥ NGƯỠNG người dùng khai (`nguongMB`, mặc định 5 GB). Dưới ngưỡng ⇒ xóa bản
                  cũ nhất để tiến về ngưỡng — nhưng TỐI ĐA `TOI_DA_XOA_MOT_LAN` bản mỗi lần chạy, và
                  không đạt ngưỡng thì vẫn GHI (có cảnh báo), không từ chối.
   Trạng thái ổn định: mỗi đêm một bản mới vào, một bản cũ nhất ra, ổ lơ lửng quanh ngưỡng. Đúng câu
   "khi còn 5 GB thì xóa file cũ nhất để lưu file mới". Ổ tụt sâu vì lý do KHÁC (file .ldf phình —
   trên máy này gần như chắc chắn) thì lịch sử mòn 3 bản/đêm, nhìn thấy được, có email — chứ không
   bốc hơi trong một đêm. */
const TOI_DA_XOA_MOT_LAN = 3;

/* `cheDo`: 'full' được xóa cả .bak (kéo theo log vô dụng); 'log' CHỈ được dọn .trn vô dụng + .HONG,
   TUYỆT ĐỐI không đụng .bak — lịch log chạy mỗi giờ, để nó xóa bản đầy đủ là trong vài giờ cửa sổ
   khôi phục co về `soBanLuonGiu`. Từ chối một bản log mất 1 giờ dữ liệu; xóa một bản FULL mất cả
   một mốc khôi phục của một ngày. */
function donDeDuCho(thuMuc, nguongMB, canMoiMB, cheDo) {
  const ket = { daXoa: [], daXoaBak: 0, daXoaTrn: 0, daXoaHong: 0,
                trongTruoc: null, trongSau: null, du: true, duoiNguong: false, lyDo: '' };
  const trong0 = choTrongMB(thuMuc);
  ket.trongTruoc = trong0;
  /* Không đo được (Node < 18.15) ⇒ không biết ⇒ KHÔNG xóa gì — xóa dựa trên con số không có là
     xóa mù. Trả `du: true` để hành vi y như trước khi có phép kiểm. */
  if (trong0 == null) { ket.lyDo = 'không đo được chỗ trống'; return ket; }
  /* Mốc kích hoạt = max(ngưỡng, chỗ cho bản mới): ngưỡng khai thấp hơn cả bản sắp ghi (1 GB mà CSDL
     2 GB) thì vẫn phải dọn — không thì trên ngưỡng, không xóa gì, rồi từ chối ghi: vô nghĩa. */
  const mocKichHoat = Math.max(nguongMB, canMoiMB);
  if (trong0 >= mocKichHoat) { ket.trongSau = trong0; return ket; }

  const ghi = (ten, loai) => { ket.daXoa.push(ten); if (loai === 'bak') ket.daXoaBak++; else if (loai === 'trn') ket.daXoaTrn++; else ket.daXoaHong++; };
  const ketThuc = () => {
    ket.du = ket.trongSau != null && ket.trongSau >= canMoiMB;
    ket.duoiNguong = ket.trongSau != null && ket.trongSau < nguongMB;
    if (ket.daXoa.length) {
      console.warn('[saoluu] dọn lấy chỗ: xóa ' + ket.daXoaBak + ' .bak + ' + ket.daXoaTrn + ' .trn + '
        + ket.daXoaHong + ' .HONG, trống ' + Math.round(trong0) + ' → ' + Math.round(ket.trongSau || 0)
        + ' MB (ngưỡng ' + Math.round(nguongMB) + ', cần tối thiểu ' + Math.round(canMoiMB) + ')');
    }
    return ket;
  };
  let trong = trong0;

  /* BƯỚC 0 — thứ CHẮC CHẮN vô dụng, xóa trước, không tính vào hạn mức:
     (a) file .HONG — bản trượt RESTORE VERIFYONLY, đã biết hỏng, giữ chỉ để chẩn đoán;
     (b) bản log cũ hơn bản FULL cũ nhất còn giữ — hợp luật `donLogCu`, chỉ là chưa ai gọi lúc chật. */
  try {
    fs.readdirSync(thuMuc).filter(f => /\.HONG$/i.test(f)).forEach(f => {
      try { fs.unlinkSync(path.join(thuMuc, f)); ghi(f, 'hong'); } catch (e) { /* bỏ qua */ }
    });
  } catch (e) { /* bỏ qua */ }
  try { donLogCu(thuMuc).forEach(t => ghi(t, 'trn')); } catch (e) { /* bỏ qua */ }
  trong = choTrongMB(thuMuc);
  if (trong == null) { ket.lyDo = 'mất khả năng đo chỗ trống giữa chừng'; ket.trongSau = null; ket.du = true; return ket; }
  ket.trongSau = trong;
  if (trong >= mocKichHoat) return ketThuc();

  if (cheDo === 'log') {
    /* Dưới ngưỡng nhưng KHÔNG được xóa .bak. Còn đủ cho bản log (nhỏ) thì cứ ghi — `du` tính ở ketThuc. */
    ket.lyDo = trong < canMoiMB ? 'sao lưu log không được phép xóa bản đầy đủ để lấy chỗ' : '';
    return ketThuc();
  }

  /* BƯỚC 1 — xóa từng bản cũ nhất ngoài lưới `soBanLuonGiu`, tối đa TOI_DA_XOA_MOT_LAN, đo lại sau
     mỗi lần, dừng khi lên tới ngưỡng. Chỗ trống KHÔNG tăng sau khi xóa = file đang bị shadow copy /
     tiến trình khác (Google Drive, diệt virus) giữ ⇒ dừng, không xóa mù tiếp. */
  const SO_BAN_LUON_GIU = __ch.soBanLuonGiu;
  const ds = docDanhSachBan(thuMuc).sort((a, b) => mocTuTen(b.ten, b.luc) - mocTuTen(a.ten, a.luc));
  const duocXoa = ds.slice(SO_BAN_LUON_GIU).slice(-TOI_DA_XOA_MOT_LAN).reverse();   // cũ nhất trước
  if (!duocXoa.length) {
    ket.lyDo = 'chỉ còn ' + ds.length + ' bản, bằng mức "luôn giữ ít nhất" — không được xóa thêm';
    return ketThuc();
  }
  for (const b of duocXoa) {
    const truoc = trong;
    try { fs.unlinkSync(b.duongDan); ghi(b.ten, 'bak'); }
    catch (e) { console.error('[saoluu] không xóa được ' + b.ten + ' khi dọn lấy chỗ: ' + e.message); break; }
    try { donLogCu(thuMuc).forEach(t => ghi(t, 'trn')); } catch (e) { /* bỏ qua */ }
    trong = choTrongMB(thuMuc);
    if (trong == null) { ket.lyDo = 'mất khả năng đo chỗ trống giữa chừng'; break; }
    ket.trongSau = trong;
    if (trong <= truoc + 1) {
      ket.lyDo = 'xóa rồi mà chỗ trống không tăng — ổ đang bị shadow copy hoặc tiến trình khác giữ file; dừng';
      break;
    }
    if (trong >= mocKichHoat) break;
  }
  if (!ket.lyDo && ket.trongSau != null && ket.trongSau < nguongMB) {
    ket.lyDo = 'đã xóa ' + ket.daXoaBak + ' bản đầy đủ (hạn mức mỗi lần) mà vẫn dưới ngưỡng — '
      + 'thứ đang chiếm ổ nhiều khả năng KHÔNG phải bản sao lưu (kiểm file .ldf của CSDL)';
  }
  return ketThuc();
}

/* Kích thước ước tính của bản sắp ghi. FULL: bản gần nhất × 1.2 (đã tính cả nén), chưa có thì
   dataMB × hệ số. LOG: lấy MAX(bản .trn gần nhất × 1.2, phần log ĐANG DÙNG) — `logDungMB` là phép
   đo trực tiếp thứ sắp ghi ra; sau một đợt nhập liệu lớn, bản .trn kế tiếp có thể gấp trăm lần bản
   trước, lấy mỗi lịch sử là ước quá thấp. */
function uocKichThuocMB(thuMuc, loai, tt) {
  const ds = loai === 'log' ? docDanhSachLog(thuMuc) : docDanhSachBan(thuMuc);
  const theoLichSu = (ds.length && ds[0].dungLuong > 0) ? ds[0].dungLuong / 1048576 * 1.2 : 0;
  if (loai === 'log') return Math.max(theoLichSu, Number(tt.logDungMB) || 0, 1);
  return theoLichSu > 0 ? theoLichSu : (tt.dataMB || 0) * HE_SO_CHO_TRONG;
}

/* Mốc ĐÍCH khi dọn: đủ cho bản mới × 2 — KHÔNG phải ngưỡng. Xem khối ghi chú trên `TOI_DA_XOA_MOT_LAN`. */
function choCanChoBanMoiMB(thuMuc, loai, tt) {
  return uocKichThuocMB(thuMuc, loai, tt) * 2;
}

/* ------------------------------------------------------------------------------------------------
   CHẠY MỘT LẦN SAO LƯU.
   `nguon` = 'lich' (cron) hoặc 'tay' (người dùng bấm) — chỉ để ghi log cho dễ truy.
   KHÔNG BAO GIỜ NÉM LỖI RA NGOÀI: mọi lối ra đều trả { thanhCong, thongDiep }. Promise văng khỏi
   cron là Node đời mới giết tiến trình — sập cả phần mềm của xưởng chỉ vì một lần sao lưu hỏng.
   ------------------------------------------------------------------------------------------------ */
async function chayMotLan(nguon) {
  if (__dangChay) {
    return { thanhCong: false, thongDiep: 'Đang có một lần sao lưu chạy dở — bỏ qua lần này.' };
  }
  const batDau = Date.now();
  __dangChay = true;
  let poolSL = null;
  const THU_MUC = __ch.thuMuc;
  const SO_NGAY_GIU = __ch.soNgayGiu;
  try {
    const loiTM = kiemThuMucAnToan(THU_MUC);
    if (loiTM) return ghiKetQua(false, loiTM, null, batDau);

    try { fs.mkdirSync(THU_MUC, { recursive: true }); }
    catch (e) { return ghiKetQua(false, 'Không tạo được thư mục ' + THU_MUC + ': ' + e.message, null, batDau); }

    /* Kết nối RIÊNG, timeout dài — xem khối ghi chú moKetNoiSaoLuu(). Đóng ở finally. */
    try { poolSL = await moKetNoiSaoLuu(); }
    catch (e) { return ghiKetQua(false, 'Không kết nối được SQL Server: ' + e.message, null, batDau); }
    const pool = poolSL;
    const tt = await thongTinMayChu(pool);

    /* LUẬT 2 — kiểm chỗ trống TRƯỚC. v9.44: thiếu thì DỌN bản cũ nhất rồi đo lại, chứ không từ
       chối ngay — xem khối ghi chú `donDeDuCho()`. Chỉ từ chối khi dọn hết mức cho phép vẫn thiếu. */
    const canMoiMB = choCanChoBanMoiMB(THU_MUC, 'full', tt);
    const don = donDeDuCho(THU_MUC, __ch.nguongTrongGB * 1024, canMoiMB, 'full');
    if (!don.du) {
      /* 🔴 KHÔNG xúi "giảm luôn giữ ít nhất" — đó là đẩy người đang hoảng vì ổ đầy đi gỡ tấm lưới
         cuối cùng. Chỉ đường đúng: thứ ăn ổ trên máy này gần như chắc chắn là file .ldf. */
      return ghiKetQua(false,
        `Ổ đích chỉ còn ${Math.round(don.trongSau || 0)} MB, không đủ chỗ cho bản mới (cần ${Math.round(canMoiMB)} MB). `
        + (don.lyDo ? don.lyDo + '. ' : '')
        + 'KHÔNG sao lưu để tránh làm đầy ổ của máy chủ. Dọn file KHÁC trên ổ này — kiểm file .ldf của CSDL '
        + '(mục "Dữ liệu / Log" trên màn này) trước tiên — rồi chạy lại.', null, batDau);
    }
    const ghiChuDon = don.daXoa.length
      ? `, đã xóa ${don.daXoaBak} bản đầy đủ cũ nhất${don.daXoaTrn ? ' + ' + don.daXoaTrn + ' bản log vô dụng' : ''}`
        + `${don.daXoaHong ? ' + ' + don.daXoaHong + ' file hỏng' : ''} để lấy chỗ (trống ${Math.round(don.trongTruoc)} → ${Math.round(don.trongSau)} MB)`
      : '';
    const canhBaoDon = don.duoiNguong
      ? ` ⚠️ Vẫn dưới ngưỡng giữ trống ${__ch.nguongTrongGB} GB${don.lyDo ? ' — ' + don.lyDo : ''}.`
      : '';

    const nhan = new Date();
    const hai = (n) => String(n).padStart(2, '0');
    /* Tên file mang GIỜ VN của chính máy chủ — KHÔNG dùng toISOString (lệch 7 tiếng, file của
       đêm 10/11 sẽ mang tên 09/11). Xem feedback_qlnoibo_ngay_theo_gio_vn_khong_toisostring. */
    const tenFile = `${TEN_CSDL}_${nhan.getFullYear()}${hai(nhan.getMonth() + 1)}${hai(nhan.getDate())}`
      + `_${hai(nhan.getHours())}${hai(nhan.getMinutes())}.bak`;
    const duongDan = path.join(THU_MUC, tenFile);

    /* CHECKSUM: bắt hỏng trang ngay lúc ghi. INIT: ghi đè nếu trùng tên (không nối chồng vào file cũ
       — nối chồng là file phình vô hạn mà nhìn bên ngoài tưởng vẫn bình thường). */
    const nen = tt.nenDuoc ? ', COMPRESSION' : '';
    try {
      await pool.request()
        .input('d', sql.NVarChar(400), duongDan)
        .query(`BACKUP DATABASE [${TEN_CSDL}] TO DISK = @d
                WITH INIT, CHECKSUM, FORMAT, NAME = N'QLNoiBo tu dong'${nen}`);
    } catch (e) {
      const tk = await taiKhoanDichVuSQL(pool);
      return ghiKetQua(false, giaiThichLoi(moTaLoiSQL(e), THU_MUC, tk), null, batDau);
    }

    /* 🔴 XÁC MINH. Một file .bak chưa bao giờ đọc lại được thì KHÔNG phải bản sao lưu. VERIFYONLY
       rẻ và bắt được file cụt / hỏng trang. (Nó không thay thế việc thỉnh thoảng khôi phục thử —
       xem mục "nợ" trong PRD.) */
    try {
      await pool.request().input('d', sql.NVarChar(400), duongDan)
        .query('RESTORE VERIFYONLY FROM DISK = @d WITH CHECKSUM');
    } catch (e) {
      /* 🔴 Gạt file hỏng ra khỏi danh sách — xem khối ghi chú `gatFileHong()`. Trả `tenFile` là
         null: file đó không còn mang tên cũ nữa, và nó KHÔNG phải một bản sao lưu. */
      const g = gatFileHong(duongDan);
      return ghiKetQua(false, 'Đã ghi file nhưng KIỂM TRA LẠI THẤY HỎNG — coi như sao lưu thất bại. '
        + giaiThichLoi(moTaLoiSQL(e), THU_MUC, null) + g, null, batDau);
    }

    const daXoa = donBanCu();
    let cl = 0;
    try { cl = fs.statSync(duongDan).size; } catch (e) { /* vừa ghi xong, hiếm khi lỗi */ }

    /* v9.40: chép sang thư mục thứ hai SAU KHI đã xác minh — không bao giờ nhân bản một file hỏng.
       Hỏng ở bước này KHÔNG hạ `thanhCong` xuống false (xem khối ghi chú của chepSangThuMucPhu). */
    const loiPhu = chepSangThuMucPhu(duongDan, tenFile);
    if (loiPhu) console.error('[saoluu] 🔴 BẢN SAO THỨ HAI HỎNG: ' + loiPhu);

    const tin = `Sao lưu xong: ${tenFile} (${(cl / 1024 / 1024).toFixed(1)} MB)`
      + ghiChuDon
      + (daXoa.length ? `, đã dọn ${daXoa.length} bản quá ${SO_NGAY_GIU} ngày` : '')
      + (__ch.thuMucPhu && !loiPhu ? `, đã chép sang ${__ch.thuMucPhu}` : '')
      + (tt.laExpress ? ' [SQL Express — không nén được, file to hơn bình thường]' : '')
      + canhBaoDon;
    console.log('[saoluu] (' + nguon + ') ' + tin);
    /* v9.44: trả số bản ĐẦY ĐỦ đã bị xóa để lấy chỗ — kênh email riêng ở canhBaoSaoLuu đọc nó. Xóa
       bản sao lưu là thao tác không đảo ngược; thành công mà im lặng là sai. */
    const kqOut = ghiKetQua(true, tin, tenFile, batDau, cl, loiPhu);
    kqOut.daXoaLayCho = don.daXoaBak;
    kqOut.duoiNguong = !!don.duoiNguong;
    return kqOut;
  } catch (e) {
    return ghiKetQua(false, 'Lỗi ngoài dự kiến: ' + (e && e.message), null, batDau);
  } finally {
    /* Đóng kết nối riêng — không giữ rỗi. Lỗi lúc đóng chỉ ghi log: sao lưu đã xong rồi, không được
       biến một lỗi dọn dẹp thành "sao lưu thất bại". */
    if (poolSL) { try { await poolSL.close(); } catch (e) { console.warn('[saoluu] đóng kết nối: ' + e.message); } }
    __dangChay = false;
  }
}

function ghiKetQua(thanhCong, thongDiep, tenFile, batDau, dungLuong, loiPhu) {
  __lanCuoi = {
    luc: new Date(), thanhCong, thongDiep, tenFile: tenFile || null,
    dungLuong: dungLuong || 0, soGiay: Math.round((Date.now() - batDau) / 1000),
    loiPhu: loiPhu || null   // v9.40: bản sao thứ hai hỏng — KHÔNG hạ thanhCong, nhưng không im lặng
  };
  if (!thanhCong) console.error('[saoluu] 🔴 THẤT BẠI: ' + thongDiep);
  return { thanhCong, thongDiep, tenFile: tenFile || null, loiPhu: loiPhu || null };
}

/* ------------------------------------------------------------------------------------------------
   TRẠNG THÁI cho màn hình. KHÔNG trả đường dẫn đầy đủ ra ngoài (lộ bố cục ổ đĩa máy chủ), chỉ trả
   tên file và thư mục — người quản trị cần biết thư mục để đi cấp quyền.
   ------------------------------------------------------------------------------------------------ */
async function trangThai() {
  const THU_MUC = __ch.thuMuc;
  const ds = docDanhSachBan();
  const moiNhat = ds[0] || null;
  const gioQua = moiNhat ? (Date.now() - moiNhat.luc.getTime()) / 3600000 : null;
  let may = null;
  try { may = await thongTinMayChu(await getPool()); } catch (e) { /* CSDL đang lỗi thì bỏ qua */ }

  const canhBao = [];
  const loiTM = kiemThuMucAnToan(THU_MUC);
  if (loiTM) canhBao.push(loiTM);
  if (!moiNhat) canhBao.push('🔴 CHƯA CÓ BẢN SAO LƯU NÀO.');
  else if (gioQua > 36) {
    canhBao.push(`🔴 Bản sao lưu gần nhất đã ${Math.floor(gioQua / 24)} ngày trước — lịch có thể đã chết.`);
  }
  /* FULL recovery mà không ai sao lưu log thì file log phình vô hạn tới khi đầy ổ — rất hay là
     nguyên nhân thật của "SQL hay lỗi". Nói ra, nhưng KHÔNG tự đổi: đổi recovery model là quyết
     định của chủ dữ liệu, và nó cắt mất khả năng khôi phục về đúng một thời điểm. */
  /* v9.41: lời cảnh báo này nay phụ thuộc vào việc ĐÃ BẬT sao lưu log hay chưa. Giữ nguyên câu cũ
     khi chưa bật là nói sai — và nói sai theo chiều làm người ta đi sửa thứ đã sửa rồi. */
  if (may && /FULL/i.test(may.recoveryModel) && !__ch.batLog && may.logMB > may.dataMB) {
    canhBao.push(`⚠️ CSDL ở chế độ FULL recovery, file log (${Math.round(may.logMB)} MB) đã lớn hơn file `
      + `dữ liệu (${Math.round(may.dataMB)} MB), mà CHƯA bật sao lưu log. Sao lưu đầy đủ hằng ngày `
      + 'KHÔNG cắt log — chỉ "Sao lưu log" mới cắt. Log sẽ phình tới khi đầy ổ. '
      + 'Bật mục "Sao lưu transaction log" ở dưới, hoặc chuyển CSDL sang chế độ SIMPLE.');
  }
  if (__ch.batLog) {
    if (may && !/FULL|BULK/i.test(may.recoveryModel)) {
      canhBao.push('🔴 Đã bật "Sao lưu log" nhưng CSDL đang ở chế độ ' + (may.recoveryModel || '?')
        + ' — mỗi giờ sẽ báo lỗi một lần. Ở chế độ này SQL Server tự cắt log, không cần và không sao '
        + 'lưu log được. Hãy TẮT mục đó đi.');
    }
    if (may && may.coFullTruocDo === false) {
      canhBao.push('🔴 Đã bật "Sao lưu log" nhưng CHƯA từng có bản sao lưu đầy đủ nào — chuỗi log phải '
        + 'bắt đầu từ một bản đầy đủ. Bấm "Sao lưu ngay" một lần.');
    }
    const lg = docDanhSachLog(THU_MUC);
    const gioLog = lg[0] ? (Date.now() - lg[0].luc.getTime()) / 3600000 : null;
    if (!lg.length) canhBao.push('⚠️ Đã bật sao lưu log nhưng CHƯA có bản log nào.');
    else if (gioLog > 6) {
      canhBao.push(`🔴 Bản sao lưu log gần nhất đã ${Math.round(gioLog)} giờ trước — lịch log có thể đã chết.`);
    }
  }
  /* 🔴 File log ĐÃ được cắt nhưng VẪN TO: nói rõ, không thì người dùng thấy 136 MB y như cũ rồi
     tưởng sao lưu log không ăn thua. `BACKUP LOG` giải phóng chỗ BÊN TRONG file, không thu nhỏ file. */
  if (may && __ch.batLog && may.logDungPhanTram != null && may.logDungPhanTram < 30 && may.logMB > may.dataMB) {
    canhBao.push(`ℹ️ File log vẫn ${Math.round(may.logMB)} MB nhưng chỉ còn dùng ${may.logDungPhanTram}% — `
      + 'log ĐÃ được cắt và sẽ thôi phình. Sao lưu log không làm file nhỏ lại; muốn lấy lại chỗ trên ổ '
      + 'phải chạy DBCC SHRINKFILE một lần (thao tác riêng, làm phân mảnh chỉ mục — hỏi trước khi làm).');
  }

  /* 🔴 LỊCH CÓ THẬT SỰ ĐANG CHẠY KHÔNG. Ô tick "Chạy tự động" trên màn hình chỉ phản ánh Ý MUỐN đã
     lưu, không phản ánh THỰC TẾ: `datLaiLich()` từ chối đặt lịch khi thư mục trống hoặc biểu thức
     giờ sai, và chỉ ghi console.warn — không ai đọc. Người dùng nhìn thấy ô tick xanh và tin rằng
     đêm nay có bản sao lưu. Hỏi thẳng bộ lịch rồi nói ra. */
  try {
    const L = require('./lichSaoLuu');
    const tt = L.trangThaiLich();
    if (tt && !tt.chay) {
      canhBao.push('🔴 LỊCH TỰ ĐỘNG KHÔNG CHẠY' + (tt.lyDo ? ' — ' + tt.lyDo : '')
        + '. Sẽ KHÔNG có bản sao lưu nào tự sinh ra cho tới khi sửa.');
    }
    /* 🔴 Lịch LOG cũng phải được hỏi. Thiếu dòng này là lặp lại nguyên si lỗi v9.40 đã sửa cho lịch
       chính: ô tick "Sao lưu transaction log" hiện xanh, nút "Sao lưu log ngay" hiện ra, người dùng
       tin mỗi giờ có một bản — trong khi `datLaiLich()` đã im lặng từ chối đặt lịch đó. */
    if (__ch.batLog) {
      const tl = L.trangThaiLichLog && L.trangThaiLichLog();
      if (tl && !tl.chay) {
        canhBao.push('🔴 LỊCH SAO LƯU LOG KHÔNG CHẠY' + (tl.lyDo ? ' — ' + tl.lyDo : '')
          + '. Log sẽ không được cắt và file .ldf sẽ tiếp tục phình.');
      }
    }
  } catch (e) { /* nạp vòng / chưa khởi động: bỏ qua, không được làm vỡ màn hình */ }

  /* C6: tắt "Sao lưu log" KHÔNG xóa các file .trn đang có, mà `dsLog` ở dưới lại giấu chúng khỏi
     màn hình khi `batLog` tắt ⇒ hàng trăm file nằm lại ăn ổ mà không chỗ nào hiện ra. Nói ra. */
  if (!__ch.batLog) {
    const con = docDanhSachLog(THU_MUC);
    if (con.length) {
      const mb = Math.round(con.reduce((s, b) => s + b.dungLuong, 0) / 1048576);
      canhBao.push('⚠️ Sao lưu log đang TẮT nhưng còn ' + con.length + ' file .trn cũ (' + mb + ' MB) '
        + 'trong thư mục sao lưu. Phần mềm không dọn chúng nữa — xóa tay được, chúng chỉ dùng cho '
        + 'việc khôi phục về thời điểm mà anh đã tắt.');
    }
  }

  /* Bản sao thứ hai hỏng ở lần chạy gần nhất — không hạ `thanhCong`, nhưng phải nhìn thấy. */
  if (__lanCuoi && __lanCuoi.loiPhu) canhBao.push('🔴 BẢN SAO NGOÀI MÁY HỎNG: ' + __lanCuoi.loiPhu);

  /* Cùng ổ với file CSDL = hỏng ổ là mất cả hai. Nguyen đã chốt "ổ đĩa KHÁC"; nếu cấu hình trôi về
     cùng ổ thì nói ra, đừng để nó im lặng phản lại chính quyết định đã chốt. */
  const kyOBK = (String(THU_MUC || '').match(/^([A-Za-z]):/) || [])[1];
  if (kyOBK && may && Array.isArray(may.oCuaCSDL) && may.oCuaCSDL.indexOf(kyOBK.toUpperCase()) !== -1) {
    canhBao.push('⚠️ Thư mục sao lưu nằm trên ổ ' + kyOBK.toUpperCase() + ': — CÙNG ổ đang chứa file CSDL. '
      + 'Hỏng ổ đó là mất cả dữ liệu lẫn bản sao lưu.'
      + (__ch.thuMucPhu ? ' (Bản sao ngoài máy ở ' + __ch.thuMucPhu + ' là tuyến phòng thủ chính.)'
                        : ' Nên khai thêm "Bản sao thứ hai" sang ổ khác.'));
  }

  /* v9.44: ổ đích đã dưới ngưỡng giữ trống ⇒ lần sao lưu tới SẼ xóa bản cũ nhất. Nói trước, đừng để
     người dùng sáng ra thấy mất bản mà không hiểu vì sao. Và nếu đã chỉ còn đúng "luôn giữ ít nhất"
     bản thì lần tới sẽ TỪ CHỐI — đây là cảnh báo đỏ thật sự. */
  {
    const trongMB = THU_MUC ? choTrongMB(THU_MUC) : null;
    const nguongMB = __ch.nguongTrongGB * 1024;
    if (trongMB != null && trongMB < nguongMB) {
      const soBan = ds.length;
      if (soBan <= __ch.soBanLuonGiu) {
        canhBao.push(`🔴 Ổ đích chỉ còn ${(trongMB / 1024).toFixed(1)} GB (ngưỡng ${__ch.nguongTrongGB} GB) và chỉ còn `
          + `${soBan} bản — bằng mức "luôn giữ ít nhất". Lần sao lưu tới sẽ TỪ CHỐI vì không được phép `
          + 'xóa thêm. Dọn file KHÁC trên ổ này ngay.');
      } else {
        canhBao.push(`⚠️ Ổ đích chỉ còn ${(trongMB / 1024).toFixed(1)} GB, dưới ngưỡng ${__ch.nguongTrongGB} GB — `
          + `lần sao lưu tới sẽ xóa bản cũ nhất để lấy chỗ (đang có ${soBan} bản, giữ ít nhất ${__ch.soBanLuonGiu}).`);
      }
    }
  }

  /* Email: nói rõ cảnh báo có GỬI ĐI ĐƯỢC không. Người dùng gõ email vào ô rồi tin là xong. */
  if (!process.env.SMTP_HOST) {
    canhBao.push('⚠️ Chưa cấu hình SMTP trên máy chủ (SMTP_HOST trong backend\\.env) — cảnh báo CHỈ hiện '
      + 'trên màn hình này, KHÔNG có email nào được gửi.');
  } else if (!__ch.emailBao) {
    canhBao.push('⚠️ Chưa điền địa chỉ nhận cảnh báo — sẽ không ai được báo khi sao lưu hỏng.');
  }

  const dsLog = __ch.batLog ? docDanhSachLog(THU_MUC) : [];
  return {
    cauHinh: __ch,
    thuMuc: THU_MUC || null,
    thuMucPhu: __ch.thuMucPhu || null,
    soBanPhu: __ch.thuMucPhu ? docDanhSachBan(__ch.thuMucPhu).length : null,
    /* v9.41 — sao lưu log. `moiNhatLog` là mốc trả lời "mất nhiều nhất bao nhiêu dữ liệu nếu hỏng
       ngay bây giờ" — con số đáng hỏi nhất của cả màn hình. */
    lanCuoiLog: __lanCuoiLog,
    soBanLog: dsLog.length,
    tongDungLuongLog: dsLog.reduce((s, b) => s + b.dungLuong, 0),
    moiNhatLog: dsLog[0] ? { ten: dsLog[0].ten, luc: dsLog[0].luc, dungLuong: dsLog[0].dungLuong } : null,
    danhSachLog: dsLog.slice(0, 12).map(b => ({ ten: b.ten, luc: b.luc, dungLuong: b.dungLuong })),
    soNgayGiu: __ch.soNgayGiu,
    soBanLuonGiu: __ch.soBanLuonGiu,
    choTrongMB: THU_MUC ? choTrongMB(THU_MUC) : null,
    mayChu: may,
    lanCuoi: __lanCuoi,
    moiNhat: moiNhat ? { ten: moiNhat.ten, luc: moiNhat.luc, dungLuong: moiNhat.dungLuong } : null,
    soBan: ds.length,
    tongDungLuong: ds.reduce((s, b) => s + b.dungLuong, 0),
    danhSach: ds.slice(0, 40).map(b => ({ ten: b.ten, luc: b.luc, dungLuong: b.dungLuong })),
    canhBao
  };
}

/* ================================================================================================
   LIỆT KÊ Ổ ĐĨA + Ổ ĐANG CHỨA CSDL
   Trình duyệt KHÔNG duyệt được ổ đĩa của máy chủ (và không nên). Nên thay vì "hộp thoại chọn thư
   mục", màn hình đưa ra DANH SÁCH Ổ của chính máy chủ kèm chỗ trống, đánh dấu ổ nào đang chứa CSDL
   — để người chọn thấy ngay vì sao không nên chọn ổ đó.
   ================================================================================================ */
/* ------------------------------------------------------------------------------------------------
   🔴 Ổ NÀO SQL SERVER NHÌN THẤY — HỎI CHÍNH NÓ, ĐỪNG SUY TỪ PHÍA NODE
   ------------------------------------------------------------------------------------------------
   Nguyen 10/11/2026 chọn `G:\BackupQLNoiBo` (ổ Google Drive) và nhận "BACKUP DATABASE is terminating
   abnormally". Node `fs.existsSync('G:\\')` trả TRUE vì Node chạy trong phiên của người đăng nhập.
   Nhưng ổ Google Drive / OneDrive / Dropbox / ổ ánh xạ mạng là ổ ảo CHỈ TỒN TẠI TRONG PHIÊN ĐĂNG
   NHẬP ĐÓ. Dịch vụ SQL Server chạy ở phiên khác, dưới tài khoản khác — với nó ký tự ổ G: không hề
   tồn tại. Cấp quyền bao nhiêu cũng vô ích; đây KHÔNG phải lỗi phân quyền.

   `xp_fixeddrives` liệt kê đúng các ổ CỐ ĐỊNH mà bản thân SQL Server thấy — nên nó là câu trả lời
   đúng, không phải phỏng đoán theo tên thư mục. Không chạy được (thiếu quyền) thì trả `null` và
   mọi nơi dùng phải hiểu `null` = "không biết", KHÔNG được hiểu là "không thấy".
   ------------------------------------------------------------------------------------------------ */
async function oSQLThayDuoc(pool) {
  try {
    const r = await pool.request().query('EXEC master.dbo.xp_fixeddrives');
    const ds = (r.recordset || []).map(x => String(x.drive || '').trim().toUpperCase()).filter(Boolean);
    return ds.length ? new Set(ds) : null;
  } catch (e) { return null; }
}

async function danhSachODia() {
  const ra = [];
  let oCuaCSDL = new Set();
  let oSQL = null;
  try {
    const pool = await getPool();
    const f = (await pool.request()
      .query('SELECT physical_name FROM sys.master_files WHERE database_id = DB_ID()')).recordset;
    f.forEach(x => {
      const m = String(x.physical_name || '').match(/^([A-Za-z]):/);
      if (m) oCuaCSDL.add(m[1].toUpperCase());
    });
    oSQL = await oSQLThayDuoc(pool);
  } catch (e) { /* đọc được thì tốt, không thì vẫn liệt kê ổ */ }

  for (let i = 67; i <= 90; i++) {   // C..Z — bỏ A/B (ổ mềm)
    const ky = String.fromCharCode(i);
    const goc = ky + ':\\';
    try {
      if (!fs.existsSync(goc)) continue;
      ra.push({
        o: ky,
        choTrongMB: choTrongMB(goc),
        coCSDL: oCuaCSDL.has(ky),
        /* true = SQL thấy · false = SQL KHÔNG thấy (chọn là hỏng) · null = chưa hỏi được */
        sqlThayDuoc: oSQL ? oSQL.has(ky) : null,
        goiY: path.join(goc, 'BackupQLNoiBo')
      });
    } catch (e) { /* ổ chưa sẵn sàng (CD rỗng, ổ mạng mất kết nối) */ }
  }
  return { danhSach: ra, oCuaCSDL: [...oCuaCSDL], hoiDuocSQL: !!oSQL };
}

/* ------------------------------------------------------------------------------------------------
   KIỂM THƯ MỤC THỨ HAI — ở đây NODE mới là bên ghi, nên phép thử đúng là Node ghi thử.
   🔴 KHÔNG được đòi SQL Server nhìn thấy ổ này: cả mục đích của thư mục thứ hai là nằm trên ổ mà
   SQL KHÔNG thấy (Google Drive). Dùng nhầm phép thử của thư mục chính ở đây là chặn oan.
   ------------------------------------------------------------------------------------------------ */
function kiemThuMucPhu(thuMuc) {
  const tm = String(thuMuc || '').trim();
  if (!tm) return { ok: true, thongDiep: 'Chưa khai bản sao thứ hai (không bắt buộc).' };
  const loi = kiemThuMucAnToan(tm);
  if (loi) return { ok: false, thongDiep: loi };
  const thu = path.join(tm, '_kiemtra_chepduoc.tmp');
  try {
    fs.mkdirSync(tm, { recursive: true });
    fs.writeFileSync(thu, 'kiem tra quyen ghi ' + new Date().toISOString());
    const co = fs.statSync(thu).size > 0;
    fs.unlinkSync(thu);
    if (!co) return { ok: false, thongDiep: 'Ghi được file nhưng file rỗng — ổ này không đáng tin.' };
    const trong = choTrongMB(tm);
    return { ok: true, choTrongMB: trong,
      thongDiep: 'Phần mềm GHI ĐƯỢC vào ' + tm + '.'
        + (trong != null ? ' Còn trống ' + Math.round(trong) + ' MB.' : '')
        + ' (Lưu ý: với Google Drive / OneDrive, ghi xong là vào hàng đợi đồng bộ — chưa phải đã tải lên xong.)' };
  } catch (e) {
    try { fs.unlinkSync(thu); } catch (e2) { /* bỏ qua */ }
    const s = String(e && e.message || e);
    if (/ENOENT|ENODEV/i.test(s)) {
      return { ok: false, thongDiep: 'Không thấy ' + tm + '. Nếu đây là ổ Google Drive/OneDrive thì ứng dụng '
        + 'đó phải ĐANG CHẠY và ĐÃ ĐĂNG NHẬP trên MÁY CHỦ (không phải trên máy anh đang ngồi). Gốc: ' + s };
    }
    if (/EACCES|EPERM/i.test(s)) {
      return { ok: false, thongDiep: 'Phần mềm không có quyền ghi vào ' + tm + '. Phần mềm chạy bằng tài khoản '
        + 'Windows đã khởi động nó (pm2) — cấp quyền Modify cho tài khoản đó. Gốc: ' + s };
    }
    return { ok: false, thongDiep: 'Không ghi được vào ' + tm + ': ' + s };
  }
}

/* ================================================================================================
   KIỂM TRA THƯ MỤC — PHÉP THỬ THẬT, KHÔNG PHẢI ĐOÁN
   ------------------------------------------------------------------------------------------------
   🔴 Node ghi được KHÔNG có nghĩa SQL Server ghi được. Backup chạy bằng tài khoản DỊCH VỤ SQL —
   `fs.accessSync` chỉ chứng minh quyền của Node, và đó đúng là cái bẫy làm người ta tưởng đã xong
   rồi tới đêm mới phát hiện backup hỏng.

   Nên phép thử là BẮT CHÍNH SQL SERVER GHI MỘT FILE vào đó: sao lưu CSDL `master` (chỉ vài MB) ra
   file tạm rồi xóa. Nếu SQL ghi được master thì nó ghi được bản sao lưu thật.
   ================================================================================================ */
async function kiemThuMuc(thuMuc) {
  const tm = String(thuMuc || '').trim();
  const loi = kiemThuMucAnToan(tm);
  if (loi) return { ok: false, thongDiep: loi };

  try { fs.mkdirSync(tm, { recursive: true }); }
  catch (e) {
    return { ok: false, thongDiep: 'Phần mềm không tạo được thư mục ' + tm + ': ' + e.message
      + ' (kiểm lại ký tự ổ đĩa có đúng không, ổ ngoài đã cắm chưa).' };
  }

  const trong = choTrongMB(tm);
  const fileThu = path.join(tm, '_kiemtra_quyenghi.bak');
  let pool = null;
  try {
    pool = await moKetNoiSaoLuu();
    /* 🔴 HỎI TRƯỚC KHI THỬ: ổ Google Drive / OneDrive / ổ ánh xạ mạng thì SQL Server không thấy ký
       tự ổ, và lỗi nó trả về là "BACKUP DATABASE is terminating abnormally" — vô nghĩa với người
       dùng. Biết trước thì nói được ĐÚNG việc phải làm. `null` = chưa hỏi được ⇒ cứ thử như cũ. */
    const kyO = (tm.match(/^([A-Za-z]):/) || [])[1];
    const oSQL = await oSQLThayDuoc(pool);
    if (kyO && oSQL && !oSQL.has(kyO.toUpperCase())) {
      return { ok: false, thongDiep:
        'Dịch vụ SQL Server KHÔNG NHÌN THẤY ổ ' + kyO.toUpperCase() + ':. Đây thường là ổ Google Drive, '
        + 'OneDrive, Dropbox hoặc ổ ánh xạ mạng — những ổ chỉ tồn tại trong phiên đăng nhập của anh, '
        + 'còn SQL Server chạy ở phiên khác nên với nó ổ này không tồn tại. '
        + 'ĐÂY KHÔNG PHẢI LỖI PHÂN QUYỀN: cấp quyền bao nhiêu cũng không sửa được. '
        + 'Hãy chọn một thư mục trên ổ cứng gắn TRỰC TIẾP vào máy chủ (SQL Server thấy các ổ: '
        + [...oSQL].sort().join(': · ') + ':). '
        + 'Muốn bản sao lưu nằm trên Google Drive thì cho SQL ghi xuống ổ trong máy rồi chép sang sau '
        + '— nói tôi biết nếu anh muốn làm bước chép tự động đó.' };
    }
    await pool.request().input('d', sql.NVarChar(400), fileThu)
      .query(`BACKUP DATABASE [master] TO DISK = @d WITH INIT, FORMAT, NAME = N'kiem tra quyen ghi'`);
  } catch (e) {
    /* Hỏi tên tài khoản dịch vụ NGAY LÚC HỎNG — đây là lúc người dùng cần nó nhất. Kết nối vẫn còn
       mở ở đây (finally chạy sau catch), nên dùng lại được. */
    const tk = pool ? await taiKhoanDichVuSQL(pool) : null;
    return { ok: false, thongDiep: giaiThichLoi(moTaLoiSQL(e), tm, tk) };
  } finally {
    if (pool) { try { await pool.close(); } catch (e) { /* bỏ qua */ } }
  }

  /* Dọn file thử. Node có thể KHÔNG xóa được (file do SQL tạo, chủ sở hữu khác) — không coi đó là
     lỗi, chỉ nói ra để người dùng khỏi hoang mang khi thấy file lạ trong thư mục. */
  let conSot = false;
  try { fs.unlinkSync(fileThu); } catch (e) { conSot = true; }

  return {
    ok: true,
    choTrongMB: trong,
    thongDiep: 'SQL Server GHI ĐƯỢC vào ' + tm + '.'
      + (trong != null ? ' Còn trống ' + Math.round(trong) + ' MB.' : '')
      + (conSot ? ' (Còn file _kiemtra_quyenghi.bak — xóa tay được, vô hại.)' : '')
  };
}

/* Hôm nay đã có bản nào chưa — dùng cho việc chạy bù lúc khởi động (pm2 restart đúng giờ hẹn là
   mất lượt; không chạy bù thì cả ngày đó không có bản nào mà chẳng ai biết). */
function daCoBanHomNay() {
  const ds = docDanhSachBan();
  if (!ds.length) return false;
  const h = new Date();
  const b = ds[0].luc;
  return b.getFullYear() === h.getFullYear() && b.getMonth() === h.getMonth() && b.getDate() === h.getDate();
}

module.exports = {
  chayMotLan, trangThai, docDanhSachBan, daCoBanHomNay, kiemThuMucAnToan, thongTinMayChu,
  cauHinh, napCauHinh, luuCauHinh, danhSachODia, kiemThuMuc, kiemThuMucPhu,
  khuonTenBan, moTaLoiSQL,
  /* v9.41 */
  chayLogMotLan, donLogCu, docDanhSachLog, khuonTenLog,
  /* v9.44 — xuất để bộ tự kiểm gọi THẲNG thay vì cắt lát thân hàm bằng đếm ngoặc (giòn). `__datChoTrongGia`
     cho phép bộ kiểm thay phép đo chỗ trống bằng số giả — CHỈ dùng trong kiểm thử. */
  donDeDuCho, uocKichThuocMB, mocTuTen, TOI_DA_XOA_MOT_LAN,
  __datChoTrongGia: (f) => { __choTrongGia = typeof f === 'function' ? f : null; },
  TEN_CSDL
};
