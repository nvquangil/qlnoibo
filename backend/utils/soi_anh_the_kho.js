/* ==================================================================================================
   SOI ẢNH THẺ KHO — ảnh có vào được database không, file có trên ổ đĩa không   (v7.60)
   --------------------------------------------------------------------------------------------------
   Dùng khi: "tải ảnh lên ở phiếu nhập kho mà sang Thẻ kho không thấy ảnh".
   Có ba mắt xích, hỏng ở đâu thì triệu chứng y hệt nhau — công cụ này chỉ ra ĐÚNG mắt xích hỏng:

     (1) TẢI LÊN   : file có nằm trong backend/uploads không?
     (2) GHI CSDL  : TheKhoHangHoa.AnhDaiDien / TheKhoChiTietMau.LinkAnh có đường dẫn không?
     (3) HIỂN THỊ  : đường dẫn có trỏ tới file CÓ THẬT không?

   Đọc kiểu này thì phân biệt được ngay:
     · CSDL trống + uploads CÓ file mới  -> ảnh tải lên được nhưng KHÔNG ghi vào thẻ kho (lỗi backend).
     · CSDL trống + uploads KHÔNG có gì  -> form không tải lên (lỗi giao diện / không có ô để tải).
     · CSDL có + file MẤT                -> ảnh bị xóa khỏi ổ đĩa (hoặc copy code mà quên copy uploads).

   Kèm luôn phần ĐẾM HAI LẦN: với mã tạo từ phiếu nhập, `TheKhoChiTietMau.NhapCai` PHẢI = 0 (tồn đến
   từ chính bảng phiếu, xem vw_TonTheoMau). Khác 0 nghĩa là ở đâu đó đã chép số của phiếu vào thẻ kho
   -> tồn đếm hai lần. Công cụ chỉ BÁO, không sửa.

   CHỈ ĐỌC, không sửa gì.
   Chạy:  node utils/soi_anh_the_kho.js                 (20 mã sửa gần nhất)
          node utils/soi_anh_the_kho.js --ma=AAA,BBB
          node utils/soi_anh_the_kho.js --phieu=NK260012
          node utils/soi_anh_the_kho.js --thieu-anh     (chỉ mã đang THIẾU ảnh)
   ================================================================================================== */
const fs = require('fs');
const path = require('path');
const { sql, getPool } = require('../db');

const args = process.argv.slice(2);
const co = (t) => args.indexOf(t) !== -1;
/* Nhan CA HAI kieu: `--ma=AAA` va `--ma AAA` (go co dau cach).
   ⚠️ Vi sao phai nhan ca hai: go `--ma= BD26C124` thi shell tach thanh 2 doi so, `--ma=` RONG ->
   ban cu bo qua bo loc AM THAM va in 20 ma gan nhat. Nguoi dung tuong dang xem ma minh hoi. */
function layChuoi(t) {
  const gan = args.find(x => x.indexOf(t + '=') === 0);
  if (gan) {
    const v = gan.slice(t.length + 1).trim();
    if (v) return v;
    // Dang `--ma= AAA`: gia tri roi sang doi so ke tiep.
    const sau = args[args.indexOf(gan) + 1];
    return (sau && sau.indexOf('--') !== 0) ? sau.trim() : '';
  }
  const i = args.indexOf(t);
  if (i >= 0) { const sau = args[i + 1]; return (sau && sau.indexOf('--') !== 0) ? sau.trim() : ''; }
  return '';
}
const DS_MA = layChuoi('--ma').split(',').map(s => s.trim()).filter(Boolean);
const PHIEU = layChuoi('--phieu').trim();
const CHI_THIEU = co('--thieu-anh');
/* Go co y loc ma khong ra bo loc nao -> phai BAO, dung im lang in ra thu khac. */
const DINH_LOC = args.some(x => x.indexOf('--ma') === 0 || x.indexOf('--phieu') === 0);

const uploadDir = path.join(__dirname, '..', 'uploads');
const so = (v) => Number(v || 0);

/* Đường dẫn lưu trong CSDL là '/uploads/<tên>'. Đổi ra đường dẫn file thật để kiểm tra tồn tại.
   Ảnh dạng data: hoặc http:// thì không phải file trên ổ đĩa -> báo riêng, không coi là mất. */
function soiFile(duongDan) {
  const s = String(duongDan || '').trim();
  if (!s) return { trangThai: 'TRỐNG' };
  /* In NGUYÊN VĂN giá trị lạ (trong ngoặc kép, có độ dài) — không cắt cụt thành "/…" như bản đầu:
     thấy đúng chuỗi đang lưu mới biết là rác hay là ảnh dạng data:/http:. */
  if (s.indexOf('/uploads/') !== 0) {
    return { trangThai: `KHÔNG PHẢI ĐƯỜNG DẪN ẢNH — đang lưu "${s.slice(0, 60)}" (${s.length} ký tự)` };
  }
  const ten = s.slice('/uploads/'.length);
  const f = path.join(uploadDir, ten);
  try {
    const st = fs.statSync(f);
    return { trangThai: 'OK', kb: Math.round(st.size / 1024) };
  } catch (e) { return { trangThai: 'MẤT FILE' }; }
}

(async () => {
  const pool = await getPool();

  /* ---------- Chọn mã cần soi ---------- */
  const rq = pool.request();
  let dieuKien = '1 = 1';
  if (DS_MA.length) {
    const t = DS_MA.map((v, i) => { rq.input('m' + i, sql.NVarChar, v); return `UPPER(@m${i})`; });
    dieuKien = `UPPER(LTRIM(RTRIM(h.MaHang))) IN (${t.join(', ')})`;
  } else if (PHIEU) {
    rq.input('sp', sql.NVarChar, PHIEU);
    dieuKien = `h.MaHangID IN (SELECT ct.MaHangID FROM PhieuNhapKhoHangChiTiet ct
                                JOIN PhieuNhapKhoHang p ON p.PhieuNKID = ct.PhieuNKID
                                WHERE UPPER(LTRIM(RTRIM(p.SoPhieu))) = UPPER(@sp))`;
  }
  const gioiHan = (DS_MA.length || PHIEU) ? '' : 'TOP 20';
  const coUpdated = (await pool.request()
    .query("SELECT COL_LENGTH('TheKhoHangHoa','UpdatedAt') AS c")).recordset[0].c != null;

  const ma = (await rq.query(`
    SELECT ${gioiHan} h.MaHangID, h.MaHang, h.TenHang, h.AnhDaiDien, h.CreatedAt,
           ${coUpdated ? 'ISNULL(h.UpdatedAt, h.CreatedAt)' : 'h.CreatedAt'} AS LanLuu,
           ISNULL((SELECT COUNT(*) FROM PhieuNhapKhoHangChiTiet ct
                     JOIN PhieuNhapKhoHang p ON p.PhieuNKID = ct.PhieuNKID
                    WHERE ct.MaHangID = h.MaHangID AND p.TrangThai <> N'Đã hủy'), 0) AS SoDongPhieu
    FROM TheKhoHangHoa h
    WHERE ${dieuKien}
    ORDER BY ${coUpdated ? 'ISNULL(h.UpdatedAt, h.CreatedAt)' : 'h.CreatedAt'} DESC`)).recordset;

  if (!ma.length) { console.log('\nKhong tim thay ma hang nao khop dieu kien.'); process.exit(1); }

  /* Noi RO dang xem cai gi — kẻo lọc bị bỏ qua mà người dùng tưởng đang xem đúng mã mình hỏi. */
  console.log('');
  if (DS_MA.length) console.log('>>> DANG LOC theo ma: ' + DS_MA.join(', '));
  else if (PHIEU) console.log('>>> DANG LOC theo phieu nhap: ' + PHIEU);
  else {
    console.log('>>> KHONG CO BO LOC — dang hien 20 ma SUA GAN NHAT.');
    if (DINH_LOC) {
      console.log('    !! Ban co go --ma / --phieu nhung khong doc ra gia tri (thua dau cach?).');
      console.log('       Go dung: node utils/soi_anh_the_kho.js --ma=BD26C124');
    }
  }
  if (CHI_THIEU) console.log('>>> Chi hien ma DANG THIEU anh.');

  /* ---------- Ảnh + số liệu theo màu ---------- */
  const ids = ma.map(x => x.MaHangID);
  const mau = (await pool.request().query(`
    SELECT t.MaHangID, t.MauSacID, ms.TenMau, t.ChiTietID, t.LinkAnh,
           t.NhapCai, t.NhapTuPhieu, t.XuatCai, t.TonCai
    FROM vw_TonTheoMau t
    JOIN MauSac ms ON ms.MauSacID = t.MauSacID
    WHERE t.MaHangID IN (${ids.join(',')})
    ORDER BY t.MaHangID, ms.TenMau`)).recordset;

  /* ---------- File mới nhất trong uploads: để biết việc TẢI LÊN có chạy không ---------- */
  let fileMoi = [];
  try {
    fileMoi = fs.readdirSync(uploadDir)
      .map(f => ({ f, t: fs.statSync(path.join(uploadDir, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t).slice(0, 8);
  } catch (e) { /* thu muc uploads chua co */ }

  let thieuDD = 0, thieuMau = 0, matFile = 0, demHai = 0;
  console.log('');
  for (const h of ma) {
    const dd = soiFile(h.AnhDaiDien);
    const dsMau = mau.filter(m => m.MaHangID === h.MaHangID);
    const mauThieu = dsMau.filter(m => !String(m.LinkAnh || '').trim());
    if (dd.trangThai === 'TRỐNG') thieuDD++;
    if (dd.trangThai === 'MẤT FILE') matFile++;
    thieuMau += mauThieu.length;
    if (CHI_THIEU && dd.trangThai === 'OK' && !mauThieu.length) continue;

    console.log(`=== ${h.MaHang} — ${h.TenHang || ''}`
      + (h.SoDongPhieu ? `  (có ${h.SoDongPhieu} dòng phiếu nhập kho)` : '  (không có phiếu nhập kho)'));
    console.log(`    Ảnh đại diện : ${dd.trangThai}`
      + (dd.trangThai === 'OK' ? ` · ${dd.kb} KB · ${h.AnhDaiDien}` : (h.AnhDaiDien ? ` · ${h.AnhDaiDien}` : '')));
    if (!dsMau.length) console.log('    (chưa có dòng màu nào)');
    dsMau.forEach(m => {
      const a = soiFile(m.LinkAnh);
      if (a.trangThai === 'MẤT FILE') matFile++;
      /* NhapCai PHẢI = 0 với mã vào kho bằng phiếu — khác 0 là số của phiếu đã bị chép vào thẻ kho. */
      const canhBaoDem = h.SoDongPhieu > 0 && so(m.NhapCai) > 0;
      if (canhBaoDem) demHai++;
      console.log(`    - ${String(m.TenMau || '').padEnd(18)} ảnh: ${a.trangThai}`
        + (a.trangThai === 'OK' ? ` (${a.kb} KB)` : '')
        + (m.ChiTietID == null ? '  [CHƯA CÓ DÒNG THẺ KHO — chỉ tồn tại trên phiếu nhập]' : '')
        + `  | NhapCai=${so(m.NhapCai)} NhapTuPhieu=${so(m.NhapTuPhieu)} Xuat=${so(m.XuatCai)} Ton=${so(m.TonCai)}`
        + (canhBaoDem ? '  <-- ĐẾM HAI LẦN? NhapCai phải = 0 với hàng vào bằng phiếu' : ''));
    });
    console.log('');
  }

  console.log('================================================================');
  console.log(`Đã soi ${ma.length} mã · thiếu ảnh đại diện: ${thieuDD} · dòng màu thiếu ảnh: ${thieuMau}`
    + ` · đường dẫn trỏ tới file KHÔNG CÓ: ${matFile} · nghi đếm hai lần: ${demHai}`);
  console.log('');
  console.log('8 file mới nhất trong backend/uploads (để biết việc TẢI LÊN có chạy không):');
  if (!fileMoi.length) console.log('   (không đọc được thư mục uploads)');
  fileMoi.forEach(x => console.log(`   ${new Date(x.t).toLocaleString('vi-VN')}  ${x.f}`));
  console.log('');
  console.log('ĐỌC KẾT QUẢ:');
  console.log('  · CSDL trống mà uploads VỪA có file mang tên mã đó -> ảnh tải lên OK, KHÔNG ghi vào thẻ kho.');
  console.log('  · CSDL trống mà uploads KHÔNG có gì mới            -> form không tải lên (thiếu ô, hoặc lỗi tải).');
  console.log('  · CSDL có đường dẫn mà báo MẤT FILE                -> copy code quên copy backend/uploads.');
  process.exit(0);
})().catch(err => { console.error('LOI: ' + err.message); process.exit(1); });
