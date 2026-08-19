/* ==================================================================================================
   XÓA TỒN KHO PHỤ KIỆN  (v6.09)  —  CÔNG CỤ NGUY HIỂM, ĐỌC KỸ TRƯỚC KHI CHẠY
   --------------------------------------------------------------------------------------------------
   Tồn kho phụ kiện KHÔNG phải 1 cột lưu sẵn — nó là số TÍNH RA (view vw_TonKhoPhuKien):
        Tồn = Tổng NHẬP (PhieuPhuKien 'Nhập')  −  Tổng XUẤT (PhieuPhuKien 'Xuất')
                                               −  Tổng XUẤT VẬT TƯ (PhieuXuatVatTuPhuKien)
   Nên muốn "xóa tồn" thì BẮT BUỘC phải xóa các dòng phiếu sinh ra số đó. Không có cách nào khác.

   CÁC CHẾ ĐỘ (mặc định KHÔNG sửa gì):
     node utils/xoa_ton_phu_kien.js
         -> CHỈ BÁO CÁO: liệt kê từng mã, tồn hiện tại, số dòng phiếu sẽ bị xóa. Không đụng dữ liệu.

     node utils/xoa_ton_phu_kien.js --ghi --xoa-phieu --con-ton          << HAY DÙNG NHẤT
         -> Chỉ đụng vào MÃ ĐANG CÒN TỒN (tồn khác 0): xóa hết dòng phiếu nhập/xuất + dòng xuất vật tư
            của các mã đó => tồn về 0. GIỮ NGUYÊN mã phụ kiện trong danh mục, GIỮ NGUYÊN lịch sử của
            các mã vốn đã bằng 0 (không đụng tới).

     node utils/xoa_ton_phu_kien.js --ghi --xoa-phieu
         -> Như trên nhưng làm với TẤT CẢ mã (kể cả mã tồn đã bằng 0) — xóa sạch lịch sử nhập/xuất.

     node utils/xoa_ton_phu_kien.js --ghi --xoa-ma
         -> Làm như trên, RỒI xóa luôn các MÃ phụ kiện trong danh mục.
            Mã nào còn được Chỉ định NPL của đơn hàng tham chiếu thì BỎ QUA (không xóa) và liệt kê ra —
            xóa sẽ làm hỏng chỉ định cũ, nên công cụ không tự ý xóa.

   Tùy chọn thêm:
     --con-ton            chỉ làm với mã ĐANG CÒN TỒN (tồn khác 0, gồm cả tồn ÂM)
     --ma=PK001,PK002     chỉ làm với các mã này (mặc định: TẤT CẢ mã)
     --khong-hoi          bỏ bước gõ xác nhận (dùng khi đã chắc chắn)
     --khong-backup       không ghi file sao lưu (KHÔNG khuyến khích)

   AN TOÀN:
     - Trước khi xóa, toàn bộ dòng sắp xóa được ghi ra backend/backup/phukien_<thời điểm>.json
       (đủ dữ liệu để dựng lại bằng tay nếu cần).
     - Phải gõ đúng chữ XOA để xác nhận (trừ khi --khong-hoi).
     - VẪN NÊN sao lưu (backup) database bằng SSMS trước khi chạy — đây là thao tác KHÔNG hoàn tác được.
   ================================================================================================== */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { sql, getPool } = require('../db');

const args = process.argv.slice(2);
const co = (t) => args.indexOf(t) !== -1;
const layChuoi = (t) => { const a = args.find(x => x.indexOf(t + '=') === 0); return a ? a.split('=').slice(1).join('=') : ''; };

const GHI = co('--ghi');
const XOA_MA = co('--xoa-ma');
const XOA_PHIEU = co('--xoa-phieu') || XOA_MA;   // xóa mã thì đương nhiên phải xóa phiếu trước
const CHI_CON_TON = co('--con-ton');             // chỉ đụng mã đang còn tồn (khác 0)
const KHONG_HOI = co('--khong-hoi');
const KHONG_BACKUP = co('--khong-backup');
const DS_MA = layChuoi('--ma').split(',').map(s => s.trim()).filter(Boolean);

const backupDir = path.join(__dirname, '..', 'backup');

function hoiXacNhan(cauHoi) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(cauHoi, (tl) => { rl.close(); resolve(String(tl || '').trim()); });
  });
}

// v6.09.1: mỗi máy chạy tới migration khác nhau -> phải DÒ xem bảng có tồn tại rồi mới đụng vào.
// (Máy thật báo lỗi "Invalid object name 'PhieuXuatVatTuPhuKien'" vì chưa chạy migration_v528.sql.)
async function coBang(pool, ten) {
  const r = (await pool.request().query(`SELECT OBJECT_ID('dbo.${ten}', 'U') AS id`)).recordset[0];
  return r && r.id != null;
}

async function main() {
  const pool = await getPool();
  const coVatTu = await coBang(pool, 'PhieuXuatVatTuPhuKien');    // nguồn xuất thứ 3 (từ v5.28)
  const coChiDinh = await coBang(pool, 'DonHangChiTietPhuKien');  // Chỉ định NPL của đơn hàng
  if (!coVatTu) console.log('(Ghi chu: CSDL nay CHUA co bang PhieuXuatVatTuPhuKien - bo qua nguon xuat vat tu.)');
  if (!coChiDinh) console.log('(Ghi chu: CSDL nay CHUA co bang DonHangChiTietPhuKien - bo qua phan Chi dinh NPL.)');

  // Lọc theo mã nếu có (dùng bảng tạm dạng danh sách chuỗi để tránh nối chuỗi vào SQL).
  const dieuKienMa = DS_MA.length ? ` AND dm.MaPhuKien IN (${DS_MA.map((_, i) => '@ma' + i).join(',')})` : '';
  const ganMa = (rq) => { DS_MA.forEach((m, i) => rq.input('ma' + i, sql.NVarChar, m)); return rq; };

  const ton = (await ganMa(pool.request()).query(`
    SELECT v.PhuKienID, v.MaPhuKien, v.TenPhuKien, v.TenLoai, v.DonViCoBan, v.TongNhap, v.TongXuat, v.TonKho
    FROM vw_TonKhoPhuKien v JOIN DanhMucPhuKien dm ON dm.PhuKienID = v.PhuKienID
    WHERE 1=1${dieuKienMa}
    ORDER BY v.MaPhuKien`)).recordset;

  const coTon = ton.filter(r => Number(r.TonKho) !== 0);
  /* CHỐT DANH SÁCH MÃ MỤC TIÊU NGAY TỪ ĐẦU (không lọc "còn tồn" ngay trong câu DELETE).
     Lý do: tồn là số TÍNH RA từ nhiều bảng — xóa xong bảng thứ nhất thì tồn của mã đó đã đổi, câu DELETE
     thứ hai lọc lại theo "tồn khác 0" sẽ KHÔNG khớp nữa và bỏ sót dòng. Chốt ID trước thì cả 3 bước xóa
     đều làm trên ĐÚNG một tập mã. ID là số nguyên đọc từ CSDL nên ghép thẳng vào câu lệnh là an toàn. */
  const dsMuc = CHI_CON_TON ? coTon : ton;
  const dsID = dsMuc.map(r => Number(r.PhuKienID)).filter(Number.isFinite);
  const inID = dsID.length ? `(${dsID.join(',')})` : '(NULL)';
  const dieuKienID = ` AND dm.PhuKienID IN ${inID}`;

  const dem = (await pool.request().query(`
    SELECT
      (SELECT COUNT(*) FROM PhieuPhuKienChiTiet ct JOIN DanhMucPhuKien dm ON dm.PhuKienID = ct.PhuKienID WHERE 1=1${dieuKienID}) AS DongPhieu,
      ${coVatTu ? `(SELECT COUNT(*) FROM PhieuXuatVatTuPhuKien vt JOIN DanhMucPhuKien dm ON dm.PhuKienID = vt.PhuKienID WHERE 1=1${dieuKienID})` : '0'} AS DongVatTu,
      ${coChiDinh ? `(SELECT COUNT(*) FROM DonHangChiTietPhuKien cd JOIN DanhMucPhuKien dm ON dm.PhuKienID = cd.PhuKienID WHERE 1=1${dieuKienID})` : '0'} AS DongChiDinh`)).recordset[0];

  console.log('='.repeat(80));
  console.log('TON KHO PHU KIEN' + (DS_MA.length ? ` (loc theo ${DS_MA.length} ma)` : ' (TAT CA ma)'));
  console.log('='.repeat(80));
  console.log(`So ma trong danh muc        : ${ton.length}`);
  console.log(`So ma dang CO TON (khac 0)  : ${coTon.length}`);
  console.log(`>> SE XU LY ${dsID.length} ma  ${CHI_CON_TON ? '(--con-ton: CHI ma con ton, ma da bang 0 KHONG bi dung toi)' : '(TAT CA ma - them --con-ton neu chi muon ma con ton)'}`);
  console.log(`Dong phieu nhap/xuat PK     : ${dem.DongPhieu}   <- se bi xoa neu --xoa-phieu`);
  console.log(`Dong xuat vat tu (PK)       : ${dem.DongVatTu}${coVatTu ? '   <- se bi xoa neu --xoa-phieu' : '   (chua co bang nay - bo qua)'}`);
  console.log(`Dong Chi dinh NPL cua don   : ${dem.DongChiDinh}${coChiDinh ? '  <- KHONG xoa (chan khong cho xoa ma)' : '  (chua co bang nay - bo qua)'}`);
  console.log('');
  coTon.slice(0, 40).forEach(r => {
    console.log(`  ${String(r.MaPhuKien).padEnd(18)} ${String(r.TenPhuKien || '').slice(0, 28).padEnd(30)} ton ${String(r.TonKho).padStart(10)} ${r.DonViCoBan || ''}`);
  });
  if (coTon.length > 40) console.log(`  ... va ${coTon.length - 40} ma nua`);
  console.log('');

  if (!GHI || !XOA_PHIEU) {
    console.log('>>> DANG O CHE DO CHI XEM. Khong sua gi ca.');
    console.log('    CHI ma con ton, ton ve 0, GIU ma  :  node utils/xoa_ton_phu_kien.js --ghi --xoa-phieu --con-ton');
    console.log('    Xoa het phieu MOI ma, GIU ma      :  node utils/xoa_ton_phu_kien.js --ghi --xoa-phieu');
    console.log('    Xoa het phieu VA xoa luon cac ma  :  node utils/xoa_ton_phu_kien.js --ghi --xoa-ma');
    process.exit(0);
  }
  if (!dsID.length) { console.log('Khong co ma nao khop dieu kien - khong co gi de lam.'); process.exit(0); }

  console.log('!!! CANH BAO: thao tac nay KHONG HOAN TAC duoc. Hay chac chan da backup database.');
  console.log(XOA_MA
    ? `    Se XOA PHIEU + XOA MA phu kien cho ${dsID.length} ma.`
    : `    Se XOA PHIEU (ton ve 0) cho ${dsID.length} ma, GIU NGUYEN ma phu kien trong danh muc.`);
  if (!KHONG_HOI) {
    const tl = await hoiXacNhan('    Go dung chu  XOA  roi Enter de tiep tuc (bat ky chu nao khac = huy): ');
    if (tl !== 'XOA') { console.log('Da HUY, khong sua gi.'); process.exit(0); }
  }

  // ---- Sao lưu dữ liệu sắp xóa ----
  if (!KHONG_BACKUP) {
    const duLieu = {
      thoiDiem: new Date().toISOString(),
      locTheoMa: DS_MA, chiMaConTon: CHI_CON_TON, soMaXuLy: dsID.length,
      tonTruocKhiXoa: dsMuc.map(r => ({ MaPhuKien: r.MaPhuKien, TenPhuKien: r.TenPhuKien, TonKho: r.TonKho, DonViCoBan: r.DonViCoBan })),
      danhMuc: (await pool.request().query(`SELECT dm.* FROM DanhMucPhuKien dm WHERE 1=1${dieuKienID}`)).recordset,
      phieu: (await pool.request().query('SELECT * FROM PhieuPhuKien')).recordset,
      phieuChiTiet: (await pool.request().query(`SELECT ct.* FROM PhieuPhuKienChiTiet ct JOIN DanhMucPhuKien dm ON dm.PhuKienID = ct.PhuKienID WHERE 1=1${dieuKienID}`)).recordset,
      xuatVatTu: coVatTu
        ? (await pool.request().query(`SELECT vt.* FROM PhieuXuatVatTuPhuKien vt JOIN DanhMucPhuKien dm ON dm.PhuKienID = vt.PhuKienID WHERE 1=1${dieuKienID}`)).recordset
        : []
    };
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const f = path.join(backupDir, `phukien_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(f, JSON.stringify(duLieu, null, 1), 'utf8');
    console.log('Da ghi file sao luu: ' + f);
  }

  // ---- 1) Xóa dòng chi tiết phiếu phụ kiện (con) ----
  const r1 = await pool.request().query(`
    DELETE ct FROM PhieuPhuKienChiTiet ct
    JOIN DanhMucPhuKien dm ON dm.PhuKienID = ct.PhuKienID WHERE 1=1${dieuKienID}`);
  console.log(`Da xoa ${r1.rowsAffected[0]} dong chi tiet phieu phu kien.`);

  // ---- 2) Xóa dòng xuất vật tư phụ kiện (giữ nguyên phiếu vật tư + phần vải của phiếu đó) ----
  if (coVatTu) {
    const r2 = await pool.request().query(`
      DELETE vt FROM PhieuXuatVatTuPhuKien vt
      JOIN DanhMucPhuKien dm ON dm.PhuKienID = vt.PhuKienID WHERE 1=1${dieuKienID}`);
    console.log(`Da xoa ${r2.rowsAffected[0]} dong xuat vat tu (phan phu kien).`);
  } else {
    console.log('Bo qua xuat vat tu (CSDL chua co bang PhieuXuatVatTuPhuKien).');
  }

  // ---- 3) Xóa các phiếu phụ kiện KHÔNG còn dòng chi tiết nào (phiếu rỗng thì giữ lại vô nghĩa) ----
  const r3 = await pool.request().query(`
    DELETE p FROM PhieuPhuKien p
    WHERE NOT EXISTS (SELECT 1 FROM PhieuPhuKienChiTiet ct WHERE ct.PhieuID = p.PhieuID)`);
  console.log(`Da xoa ${r3.rowsAffected[0]} phieu phu kien rong.`);

  // ---- 4) (tùy chọn) Xóa luôn MÃ phụ kiện — bỏ qua mã còn được Chỉ định NPL tham chiếu ----
  if (XOA_MA) {
    const conThamChieu = coChiDinh ? (await pool.request().query(`
      SELECT dm.MaPhuKien, COUNT(*) AS SoChiDinh
      FROM DonHangChiTietPhuKien cd JOIN DanhMucPhuKien dm ON dm.PhuKienID = cd.PhuKienID
      WHERE 1=1${dieuKienID}
      GROUP BY dm.MaPhuKien ORDER BY dm.MaPhuKien`)).recordset : [];
    const r4 = await pool.request().query(`
      DELETE dm FROM DanhMucPhuKien dm
      WHERE NOT EXISTS (SELECT 1 FROM PhieuPhuKienChiTiet ct WHERE ct.PhuKienID = dm.PhuKienID)
        ${coChiDinh ? 'AND NOT EXISTS (SELECT 1 FROM DonHangChiTietPhuKien cd WHERE cd.PhuKienID = dm.PhuKienID)' : ''}
        ${coVatTu ? 'AND NOT EXISTS (SELECT 1 FROM PhieuXuatVatTuPhuKien vt WHERE vt.PhuKienID = dm.PhuKienID)' : ''}
        ${dieuKienID}`);
    console.log(`Da xoa ${r4.rowsAffected[0]} ma phu kien khoi danh muc.`);
    if (conThamChieu.length) {
      console.log(`GIU LAI ${conThamChieu.length} ma vi CON duoc Chi dinh NPL cua don hang dung (xoa se hong chi dinh cu):`);
      conThamChieu.slice(0, 30).forEach(x => console.log(`   - ${x.MaPhuKien} (${x.SoChiDinh} dong chi dinh)`));
      if (conThamChieu.length > 30) console.log(`   ... va ${conThamChieu.length - 30} ma nua`);
    }
  }

  // ---- Kiểm tra lại ----
  const sau = (await pool.request().query(`
    SELECT COUNT(*) AS SoMaConTon FROM vw_TonKhoPhuKien v
    JOIN DanhMucPhuKien dm ON dm.PhuKienID = v.PhuKienID
    WHERE v.TonKho <> 0${dieuKienID}`)).recordset[0];
  const conLai = (await pool.request().query('SELECT COUNT(*) AS c FROM vw_TonKhoPhuKien WHERE TonKho <> 0')).recordset[0].c;
  console.log('');
  console.log('='.repeat(80));
  console.log(`XONG. Trong ${dsID.length} ma vua xu ly, so ma con ton khac 0: ${sau.SoMaConTon} (mong doi: 0).`);
  console.log(`Toan he thong con ${conLai} ma phu kien co ton khac 0.`);
  console.log('Kiem tra tren phan mem: Phu kien > The kho / Ton kho (bam F5).');
  process.exit(0);
}

main().catch(err => { console.error('\nLOI:', err.message); console.error(err); process.exit(1); });
