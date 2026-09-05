/* ==================================================================================================
   SOI ẢNH SẢN PHẨM CỦA BẢN IN TÀI LIỆU (Thông số kỹ thuật / Thống kê chi tiết)      v7.66.1
   --------------------------------------------------------------------------------------------------
   Dùng khi bản in KHÔNG có ảnh sản phẩm. Có 4 mắt xích, hỏng ở đâu triệu chứng cũng y hệt nhau —
   công cụ này chỉ ra ĐÚNG mắt xích hỏng thay vì đoán:

     (1) LỆNH SX   : `DonHangSanXuat.AnhSanPham` có đường dẫn không?
     (2) THẺ KHO   : nếu (1) trống, mã sản phẩm có khớp dòng thẻ kho nào có ảnh không?
     (3) Ổ ĐĨA     : đường dẫn đó có trỏ tới file CÓ THẬT trong backend/uploads không?
     (4) BẢN ĐÃ LƯU: bản Thống kê chi tiết có ảnh riêng đè lên không?

   CHỈ ĐỌC, không sửa gì.
   Chạy:  node utils/soi_anh_tai_lieu.js --madh=DH2609001
          node utils/soi_anh_tai_lieu.js                (20 lệnh SX gần nhất)
   ================================================================================================== */
const fs = require('fs');
const path = require('path');
const { sql, getPool } = require('../db');

const args = process.argv.slice(2);
function layChuoi(t) {
  const gan = args.find(x => x.indexOf(t + '=') === 0);
  if (gan) {
    const v = gan.slice(t.length + 1).trim();
    if (v) return v;
    const sau = args[args.indexOf(gan) + 1];
    return (sau && sau.indexOf('--') !== 0) ? sau.trim() : '';
  }
  const i = args.indexOf(t);
  if (i >= 0) { const sau = args[i + 1]; return (sau && sau.indexOf('--') !== 0) ? sau.trim() : ''; }
  return '';
}
const MADH = layChuoi('--madh').trim();
const uploadDir = path.join(__dirname, '..', 'uploads');

function soiFile(duongDan) {
  const s = String(duongDan || '').trim();
  if (!s) return 'TRỐNG';
  if (s.indexOf('/uploads/') !== 0) return `KHÔNG PHẢI ĐƯỜNG DẪN /uploads/ — đang lưu "${s.slice(0, 60)}"`;
  const f = path.join(uploadDir, s.slice('/uploads/'.length));
  try { return 'OK · ' + Math.round(fs.statSync(f).size / 1024) + ' KB'; }
  catch (e) { return 'MẤT FILE trên ổ đĩa'; }
}

(async () => {
  const pool = await getPool();
  const rq = pool.request();
  if (MADH) rq.input('m', sql.NVarChar, MADH);
  const dons = (await rq.query(`
    SELECT ${MADH ? '' : 'TOP 20'} d.DonHangID, d.MaDH, d.MaSanPham, d.TenSanPham, d.AnhSanPham
    FROM DonHangSanXuat d
    ${MADH ? 'WHERE d.MaDH = @m' : ''}
    ORDER BY d.DonHangID DESC`)).recordset;

  if (!dons.length) {
    console.log('\nKhong tim thay lenh SX nao' + (MADH ? ' voi ma ' + MADH : '') + '.');
    process.exit(1);
  }
  console.log('');
  console.log(MADH ? ('>>> Soi lenh SX: ' + MADH) : '>>> KHONG loc — 20 lenh SX gan nhat.');

  let thieuHet = 0;
  for (const d of dons) {
    const maSP = String(d.MaSanPham || '').trim();
    /* (2) Lui ve the kho — DUNG cau y het routes/tailieukythuat.js: anhDaiDienCuaDon(). */
    let tk = null;
    if (maSP) {
      tk = (await pool.request().input('ms', sql.NVarChar, maSP).query(`
        SELECT TOP 1 MaHang, AnhDaiDien FROM TheKhoHangHoa
         WHERE LTRIM(RTRIM(MaHang)) = @ms
           AND NULLIF(LTRIM(RTRIM(ISNULL(AnhDaiDien, ''))), '') IS NOT NULL`)).recordset[0] || null;
    }
    /* Co dong the kho trung ma nhung KHONG co anh khong? — de phan biet "khong co ma" vs "ma co ma thieu anh". */
    let tkBatKy = null;
    if (maSP) {
      tkBatKy = (await pool.request().input('ms', sql.NVarChar, maSP)
        .query(`SELECT TOP 1 MaHang FROM TheKhoHangHoa WHERE LTRIM(RTRIM(MaHang)) = @ms`)).recordset[0] || null;
    }
    /* (4) Ban Thong ke chi tiet co anh rieng? */
    let banRieng = [];
    try {
      banRieng = (await pool.request().input('id', sql.Int, d.DonHangID).query(`
        SELECT ISNULL(TenPhieu, N'') AS TenPhieu, AnhDaiDien
        FROM TaiLieuThongKeChiTiet WHERE DonHangID = @id AND ISNULL(LaMau,0) = 0`)).recordset;
    } catch (e) { /* chua chay migration_v695 */ }

    const anhDung = d.AnhSanPham || (tk && tk.AnhDaiDien) || '';
    if (!anhDung) thieuHet++;

    console.log('');
    console.log(`=== ${d.MaDH} — ${d.TenSanPham || ''}${maSP ? '  (mã SP: ' + maSP + ')' : '  (CHƯA khai mã SP)'}`);
    console.log(`    1. Ảnh trên LỆNH SX  : ${soiFile(d.AnhSanPham)}${d.AnhSanPham ? '  ' + d.AnhSanPham : ''}`);
    if (!d.AnhSanPham) {
      if (!maSP) console.log('    2. Thẻ kho           : bỏ qua (lệnh SX chưa khai Mã sản phẩm)');
      else if (tk) console.log(`    2. Thẻ kho (${tk.MaHang}) : ${soiFile(tk.AnhDaiDien)}  ${tk.AnhDaiDien}`);
      else if (tkBatKy) console.log(`    2. Thẻ kho (${tkBatKy.MaHang}) : có dòng thẻ kho nhưng CHƯA CÓ ẢNH ĐẠI DIỆN`);
      else console.log(`    2. Thẻ kho           : KHÔNG có mã "${maSP}" trong thẻ kho`);
    }
    console.log(`    => Bản in sẽ dùng   : ${anhDung ? anhDung : '(KHÔNG CÓ ẢNH)'}`);
    if (banRieng.length) {
      banRieng.forEach(b => console.log(`    4. Bản Thống kê "${b.TenPhieu || '(không tên)'}" : `
        + (b.AnhDaiDien ? ('có ảnh RIÊNG đè lên — ' + soiFile(b.AnhDaiDien)) : 'không đè, dùng ảnh ở trên')));
    }
  }

  console.log('');
  console.log('================================================================');
  console.log(`Đã soi ${dons.length} lệnh SX · ${thieuHet} lệnh KHÔNG có ảnh nào để in.`);
  console.log('');
  console.log('ĐỌC KẾT QUẢ:');
  console.log('  · Mục 1 TRỐNG và mục 2 không ra ảnh  -> chưa có ảnh nào cả. Vào Ra lệnh SX của đơn đó,');
  console.log('    tải ảnh vào ô "Ảnh sản phẩm" (hoặc tải ảnh đại diện cho mã hàng ở Thẻ kho).');
  console.log('  · Có đường dẫn mà báo MẤT FILE       -> copy code quên copy thư mục backend/uploads.');
  console.log('  · "Bản in sẽ dùng" CÓ đường dẫn mà in ra vẫn trắng -> lỗi ở phía hiển thị: kiểm lại đã');
  console.log('    copy backend/routes/tailieukythuat.js và pm2 restart chưa, rồi Ctrl+F5.');
  process.exit(0);
})().catch(err => { console.error('LOI: ' + err.message); process.exit(1); });
