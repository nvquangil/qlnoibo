// ================================================================
// PHAN HE QUAN LY NHAN SU (HRM) - v6.0 Phase 1
// ----------------------------------------------------------------
// Quan ly toan bo vong doi nhan su tren bang NhanVien DA CO (mo rong them cot ho so,
// xem migration_v600.sql) + 4 bang van ban: HopDongLaoDong, PhuLucHopDong,
// QuyetDinhNhanSu, ThanhLyHopDong.
// LUU Y: KHONG tao bang nhan vien moi - NhanVien da duoc QLSX dung (PhanCongMay...),
// nen HRM chia se CHUNG 1 bang NhanVien voi Danh muc > Nhan vien (module DANHMUC).
// Cot TrangThai cu (Dang lam / Da nghi) van do QLSX dung -> HRM tu dong dong bo:
// TrangThaiLaoDong = 'Da nghi viec' => TrangThai = 'Da nghi', nguoc lai 'Dang lam'.
// ================================================================
const express = require('express');
const path = require('path');
const fs = require('fs');
const { sql, getPool } = require('../db');
const { requireAuth, requirePermission, requireChucNang } = require('../middleware/auth');
const multer = require('multer');
const XLSX = require('xlsx');
const memUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });   // v5.38: import hồ sơ nhân sự
/* v9.53: hợp đồng / trạng thái lao động đổi ⇒ đánh dấu bảng lương công nhật cần tính lại (xem đầu file util).
   Mọi hàm danhDau* KHÔNG ném — hỏng cờ không được làm hỏng việc lưu hợp đồng. */
const bangLuongTuDong = require('../utils/bangLuongTuDong');
const { tachKieuThuong, ghepKieuThuong } = require('../utils/kieuThuong');   // v9.73: nhiều kiểu thưởng

const router = express.Router();

/* ==================================================================================================
   v8.80 — KHO FILE HỒ SƠ NHÂN SỰ (ảnh chân dung, CCCD, hợp đồng, quyết định, giấy tờ người phụ thuộc)
   --------------------------------------------------------------------------------------------------
   🔴 VÌ SAO KHÔNG DÙNG backend/uploads/ NHƯ MỌI ẢNH KHÁC TRONG HỆ THỐNG
   server.js phục vụ /uploads bằng express.static KHÔNG qua requireAuth, VÀ /uploads/ nằm trong
   whitelist duocPhepCongKhai() của CỔNG 80 công khai (catalogue cho khách). Nghĩa là mọi file trong
   đó tải được từ internet, chỉ cần biết hoặc đoán ra tên file — mà tên file sinh theo
   <prefix>_<timestamp>.<ext> nên đoán được nếu prefix là mã nhân viên.
   Ảnh vải / ảnh hàng hóa lộ thì không sao. Bản scan CCCD, hợp đồng lao động, quyết định lương,
   giấy khai sinh người phụ thuộc thì khác hẳn — đó là dữ liệu cá nhân.

   Nên: thư mục RIÊNG uploads_hr, KHÔNG có express.static nào trỏ tới, chỉ đọc được qua
   GET /api/hrm/file/:id — route đó kiểm requirePermission('HRM','view') như mọi route HRM khác.
   CSDL chỉ lưu TÊN FILE (HoSoDinhKemNhanVien.TenLuu), không lưu đường dẫn /uploads/... nào.

   ⚠️ SAO LƯU: thư mục này nằm NGOÀI git (.gitignore) và KHÔNG đi theo khi copy code C -> D.
   Phải sao lưu CÙNG LÚC với database. Mất nó là mất hợp đồng/CCCD — CSDL không phục hồi được
   vì CSDL chỉ giữ tên file.
   ================================================================================================== */
const THU_MUC_HR = path.join(__dirname, '..', 'uploads_hr');
if (!fs.existsSync(THU_MUC_HR)) fs.mkdirSync(THU_MUC_HR, { recursive: true });

const GIOI_HAN_FILE_HR = 20 * 1024 * 1024;   // PDF hợp đồng scan thường 1-10 MB
const uploadHR = multer({ storage: multer.memoryStorage(), limits: { fileSize: GIOI_HAN_FILE_HR } });

/* Chỉ cho các đuôi thật sự cần. KHÔNG mở rộng bừa: thư mục này người dùng tải gì lên cũng được ghi,
   cho phép .html/.svg là mở đường cho mã chạy trong trình duyệt người xem. */
const DUOI_CHO_PHEP = ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.heic', '.doc', '.docx', '.xls', '.xlsx'];
const KIEU_NOI_DUNG = {
  '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.heic': 'image/heic',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
};

/* Tên file trên đĩa: KHÔNG lấy theo tên người dùng đặt (tránh lộ thông tin qua tên file, tránh trùng,
   tránh ký tự lạ). Tên gốc được giữ riêng ở cột TenFile để hiển thị. */
function tenLuuHR(ext) {
  const rnd = Math.random().toString(36).slice(2, 10);
  return `hr_${Date.now()}_${rnd}${ext}`;
}

/* Chống path traversal: chỉ nhận đúng tên file phẳng, và sau khi ghép phải vẫn nằm trong THU_MUC_HR.
   Khuôn lấy từ routes/hoadon.js (serve file hóa đơn). */
function duongDanHRAnToan(tenLuu) {
  const ten = path.basename(String(tenLuu || ''));
  if (!ten || ten !== String(tenLuu || '')) return null;
  const ext = path.extname(ten).toLowerCase();
  if (!DUOI_CHO_PHEP.includes(ext)) return null;
  const duong = path.join(THU_MUC_HR, ten);
  if (!duong.startsWith(THU_MUC_HR)) return null;
  return duong;
}

// Đồng bộ NhanVien.SoNguoiPhuThuoc = số dòng trong NguoiPhuThuoc.
// ⚠️ Cột đó là NGUỒN TÍNH GIẢM TRỪ THUẾ TNCN của payroll.js — payroll KHÔNG đọc bảng NguoiPhuThuoc,
// nên nếu quên gọi hàm này sau mỗi lần thêm/sửa/xóa thì lương tính theo con số CŨ, lệch âm thầm.
async function dongBoSoNPT(pool, nhanVienId) {
  await pool.request().input('id', sql.Int, nhanVienId).query(`
    UPDATE NhanVien
    SET SoNguoiPhuThuoc = (SELECT COUNT(*) FROM NguoiPhuThuoc WHERE NhanVienID = @id)
    WHERE NhanVienID = @id`);
}

// Helper: '' / undefined -> null (de luu NULL thay vi chuoi rong / de input mssql tu suy kieu).
const nn = (v) => (v === '' || v === undefined ? null : v);
// Helper: dong bo cot TrangThai cu (QLSX dung) theo trang thai lao dong HR.
const trangThaiFromLaoDong = (tt) => (tt === 'Đã nghỉ việc' ? 'Đã nghỉ' : 'Đang làm');

// Sinh Ma nhan vien tu dong dang NVxxx (lay max hau to so hien co + 1). Tinh trong JS cho chac chan
// (khong phu thuoc dinh dang cu / ISNUMERIC cua SQL). Chi ap dung khi nguoi dung khong tu nhap ma.
async function nextMaNhanVien(pool) {
  const rows = (await pool.request().query(
    `SELECT MaNhanVien FROM NhanVien WHERE MaNhanVien LIKE 'NV%'`)).recordset;
  let mx = 0;
  for (const r of rows) {
    const m = /^NV(\d+)$/.exec((r.MaNhanVien || '').trim());
    if (m) mx = Math.max(mx, parseInt(m[1], 10));
  }
  return 'NV' + String(mx + 1).padStart(3, '0');
}

// Gan toan bo cot ho so nhan su vao 1 request mssql (dung chung cho INSERT + UPDATE).
function bindNhanVien(reqDb, b) {
  reqDb.input('HoTen', sql.NVarChar, nn(b.hoTen))
    .input('BoPhanID', sql.Int, nn(b.boPhanId))
    .input('SDT', sql.NVarChar, nn(b.sdt))
    .input('NgayVao', sql.Date, nn(b.ngayVao))
    .input('NgaySinh', sql.Date, nn(b.ngaySinh))
    .input('GioiTinh', sql.NVarChar, nn(b.gioiTinh))
    .input('SoCCCD', sql.NVarChar, nn(b.soCCCD))
    .input('NgayCapCCCD', sql.Date, nn(b.ngayCapCCCD))
    .input('NoiCapCCCD', sql.NVarChar, nn(b.noiCapCCCD))
    .input('Email', sql.NVarChar, nn(b.email))
    .input('DiaChi', sql.NVarChar, nn(b.diaChi))
    .input('ChucVu', sql.NVarChar, nn(b.chucVu))
    .input('ChuyenMon', sql.NVarChar, nn(b.chuyenMon))
    .input('TrangThaiLaoDong', sql.NVarChar, nn(b.trangThaiLaoDong) || 'Thử việc')
    .input('SoNguoiPhuThuoc', sql.Int, nn(b.soNguoiPhuThuoc))
    .input('SoTaiKhoanNH', sql.NVarChar, nn(b.soTaiKhoanNH))
    .input('TenNganHang', sql.NVarChar, nn(b.tenNganHang))
    .input('ChiNhanhNH', sql.NVarChar, nn(b.chiNhanhNH))
    .input('MaSoThueCaNhan', sql.NVarChar, nn(b.maSoThueCaNhan))
    .input('NgayCapMST', sql.Date, nn(b.ngayCapMST))
    .input('SoSoBHXH', sql.NVarChar, nn(b.soSoBHXH))
    .input('GhiChu', sql.NVarChar, nn(b.ghiChu))
    .input('TrangThai', sql.NVarChar, trangThaiFromLaoDong(nn(b.trangThaiLaoDong) || 'Thử việc'));
}
/* v8.80 — AnhDaiDien tách riêng, KHÔNG gộp vào bindNhanVien().
   Lý do: cột này chỉ có sau migration_v876. Gộp vào bindNhanVien thì CSDL chưa chạy migration sẽ
   hỏng CẢ hai đường thêm/sửa nhân viên ("Invalid column name"), tức là mất luôn chức năng đang chạy
   tốt chỉ vì một cột mới. Tách ra + dò cột ⇒ chưa chạy migration thì chỉ là không lưu được ảnh. */
let __coCotAnh = null;
async function coCotAnhDaiDien(pool) {
  if (__coCotAnh === null) {
    const r = (await pool.request().query("SELECT COL_LENGTH('NhanVien','AnhDaiDien') AS c")).recordset[0] || {};
    __coCotAnh = r.c != null;
  }
  return __coCotAnh;
}

/* ================================================================
   REFS - danh muc dung cho cac dropdown (bo phan + danh sach NV rut gon)
   ================================================================ */
router.get('/refs', requireAuth, requirePermission('HRM', 'view'), async (req, res) => {
  try {
    const pool = await getPool();
    const boPhan = (await pool.request().query(
      `SELECT BoPhanID, TenBoPhan FROM BoPhan ORDER BY TenBoPhan`)).recordset;
    /* 🔴 v8.83 — TRẢ ĐỦ THÔNG TIN NHÂN VIÊN, KHÔNG CHỈ 3 CỘT.
       Trước đây chỉ SELECT NhanVienID, MaNhanVien, HoTen. Nhưng frontend dùng refs.nhanVien làm
       nguồn dữ liệu cho BẢN IN hợp đồng / quyết định (printHopDong tra refs.nhanVien.find(...) rồi
       đọc nv.NgaySinh, nv.SoCCCD, nv.DiaChi, nv.TenBoPhan...). Thiếu cột ⇒ các trường đó là
       `undefined` ⇒ HỢP ĐỒNG IN RA MẤT SẠCH THÔNG TIN BÊN B, chỉ còn dấu chấm — mà vẫn in ra bình
       thường, không báo lỗi gì. Nguyen phát hiện qua bản in quyết định: dòng "Bộ phận/chức vụ"
       toàn dấu chấm.
       Dò cột trước với 2 cột mới (AnhDaiDien v8.80, QuocTich v8.82) để CSDL chưa chạy migration
       vẫn tải được danh mục. */
    const coQT = await coCotQuocTich(pool);
    const nhanVien = (await pool.request().query(`
      SELECT nv.NhanVienID, nv.MaNhanVien, nv.HoTen, nv.NgaySinh, nv.GioiTinh, nv.SDT, nv.Email,
             nv.SoCCCD, nv.NgayCapCCCD, nv.NoiCapCCCD, nv.DiaChi, nv.ChucVu, nv.ChuyenMon,
             nv.NgayVao, nv.TrangThaiLaoDong, nv.MaSoThueCaNhan, nv.SoSoBHXH,
             nv.SoTaiKhoanNH, nv.TenNganHang, nv.BoPhanID, bp.TenBoPhan
             ${coQT ? ', nv.QuocTich' : ''}
      FROM NhanVien nv LEFT JOIN BoPhan bp ON bp.BoPhanID = nv.BoPhanID
      ORDER BY nv.HoTen`)).recordset;
    res.json({ success: true, data: { boPhan, nhanVien } });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: err.message }); }
});

/* ================================================================
   1. HO SO NHAN SU (NhanVien)
   ================================================================ */
router.get('/nhanvien', requireAuth, requirePermission('HRM', 'view'), requireChucNang('HRM', 'hoso'), async (req, res) => {
  try {
    const pool = await getPool();
    const rows = (await pool.request().query(`
      SELECT nv.NhanVienID, nv.MaNhanVien, nv.HoTen, nv.GioiTinh, nv.NgaySinh, nv.SDT, nv.Email,
             nv.ChucVu, nv.TrangThaiLaoDong, nv.NgayVao, bp.TenBoPhan, nv.BoPhanID,
             (SELECT COUNT(*) FROM HopDongLaoDong hd WHERE hd.NhanVienID = nv.NhanVienID) AS SoHopDong
      FROM NhanVien nv
      LEFT JOIN BoPhan bp ON bp.BoPhanID = nv.BoPhanID
      ORDER BY nv.NhanVienID DESC`)).recordset;
    res.json({ success: true, data: rows });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: err.message }); }
});

/* v5.38: file mẫu Excel Hồ sơ nhân sự (điền sẵn rồi tải lên để THÊM HÀNG LOẠT).
   v5.59 FIX QUAN TRỌNG: route này TRƯỚC ĐÂY đặt SAU '/nhanvien/:id' nên Express khớp nhầm
   ('/nhanvien/template' -> :id = 'template' -> parseInt = NaN -> lỗi 500) => nút "⬇️ File mẫu"
   KHÔNG BAO GIỜ tải được. Đã chuyển lên TRƯỚC '/nhanvien/:id'. ĐỪNG di chuyển xuống dưới nữa. */
router.get('/nhanvien/template', requireAuth, requirePermission('HRM', 'view'), requireChucNang('HRM', 'hoso'), (req, res) => {
  try {
    // Thứ tự cột = thứ tự đọc khi import (import khớp theo TÊN CỘT nên có thể đổi chỗ/bỏ bớt cột).
    const headers = ['Mã NV', 'Họ tên', 'Bộ phận', 'Chức vụ', 'Chuyên môn', 'Giới tính', 'Ngày sinh', 'SĐT', 'Email',
      'CCCD', 'Ngày cấp CCCD', 'Nơi cấp CCCD', 'Địa chỉ', 'Trạng thái LĐ', 'Ngày vào', 'Số người phụ thuộc',
      'Số TK ngân hàng', 'Tên ngân hàng', 'Chi nhánh NH', 'MST cá nhân', 'Ngày cấp MST', 'Số sổ BHXH', 'Mã chấm công', 'Ghi chú'];
    const sample1 = ['', 'Nguyễn Văn A', 'May', 'Công nhân', 'May công nghiệp', 'Nam', '1995-05-20', '0900000000', 'a@example.com',
      '012345678901', '2021-03-15', 'Cục CS QLHC về TTXH', 'Hà Nội', 'Chính thức', '2024-01-02', 0,
      '12345678', 'BIDV', 'Chi nhánh Hà Nội', '8012345678', '2022-01-10', 'SB123', '5', ''];
    const sample2 = ['NV002', 'Trần Thị B', 'Cắt', 'Tổ trưởng', '', 'Nữ', '1998-11-02', '0911222333', '',
      '', '', '', 'Nam Định', 'Thử việc', '2025-06-01', 2, '', '', '', '', '', '', '6', 'Ví dụ dòng 2'];
    const ws = XLSX.utils.aoa_to_sheet([headers, sample1, sample2]);
    ws['!cols'] = headers.map(h => ({ wch: Math.max(12, Math.min(24, h.length + 6)) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'NhanVien');

    // Sheet hướng dẫn để người nhập không phải hỏi lại.
    const hd = [
      ['HƯỚNG DẪN NHẬP DANH SÁCH NHÂN VIÊN'],
      [''],
      ['1. Nhập dữ liệu vào sheet "NhanVien". XÓA 2 dòng ví dụ trước khi tải lên.'],
      ['2. Bắt buộc: chỉ cần cột "Họ tên". Các cột khác để trống được.'],
      ['3. "Mã NV" để TRỐNG = hệ thống tự sinh NV001, NV002...  Nếu điền Mã NV đã có = CẬP NHẬT người đó (không tạo trùng).'],
      ['4. "Bộ phận": gõ tên bộ phận (May, Cắt, Là, Đóng gói...). Bộ phận chưa có sẽ được TẠO MỚI tự động.'],
      ['5. "Trạng thái LĐ": Thử việc / Chính thức / Đã nghỉ việc. Bỏ trống = Thử việc.'],
      ['6. Ngày tháng: nhập dạng NĂM-THÁNG-NGÀY (2024-01-02) hoặc để Excel định dạng Ngày đều được.'],
      ['7. "Mã chấm công": là số/ID của người đó TRÊN MÁY CHẤM CÔNG (Hikvision/ZKTeco). Điền sẵn ở đây thì'],
      ['   dữ liệu kéo về từ máy sẽ tự khớp đúng người, không phải gán tay từng người.'],
      ['8. Có thể đổi thứ tự cột hoặc bỏ bớt cột — hệ thống đọc theo TÊN CỘT ở dòng đầu.']
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(hd), 'Huong dan');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename="Mau_HoSoNhanSu.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (err) {
    console.error('[hrm template] ', err);
    res.status(500).json({ success: false, message: 'Lỗi tạo file mẫu: ' + err.message });
  }
});

// Chi tiet 1 nhan vien: ho so day du + toan bo van ban (HD/PL/QD/thanh ly) cua nguoi do.
router.get('/nhanvien/:id', requireAuth, requirePermission('HRM', 'view'), requireChucNang('HRM', 'hoso'), async (req, res) => {
  try {
    const pool = await getPool();
    const id = parseInt(req.params.id, 10);
    const nv = (await pool.request().input('id', sql.Int, id).query(`
      SELECT nv.*, bp.TenBoPhan FROM NhanVien nv
      LEFT JOIN BoPhan bp ON bp.BoPhanID = nv.BoPhanID WHERE nv.NhanVienID = @id`)).recordset[0];
    if (!nv) return res.status(404).json({ success: false, message: 'Không tìm thấy nhân viên.' });
    const hopDong = (await pool.request().input('id', sql.Int, id).query(
      `SELECT * FROM HopDongLaoDong WHERE NhanVienID = @id ORDER BY TuNgay DESC, HopDongID DESC`)).recordset;
    const hopDongIds = hopDong.map(h => h.HopDongID);
    /* v9.48: kèm danh mục sản phẩm của từng hợp đồng (HopDongSanPham, v9.45) — màn Hồ sơ in hợp đồng
       từ chính mảng này; thiếu thì điều khoản "thưởng theo sản phẩm" in ra dấu chấm dù đã khai. */
    const spMapHS = await docSanPhamHopDong(pool, hopDongIds);
    const bacMapHS = await docBacChuyenCan(pool, hopDongIds);   // v9.55: in điều khoản chuyên cần bậc thang từ màn Hồ sơ
    hopDong.forEach(h => { h.sanPham = spMapHS.get(h.HopDongID) || []; h.bacChuyenCan = bacMapHS.get(h.HopDongID) || []; });
    let phuLuc = [];
    if (hopDongIds.length) {
      phuLuc = (await pool.request().query(
        `SELECT * FROM PhuLucHopDong WHERE HopDongID IN (${hopDongIds.join(',')}) ORDER BY NgayKy DESC, PhuLucID DESC`)).recordset;
    }
    const quyetDinh = (await pool.request().input('id', sql.Int, id).query(
      `SELECT * FROM QuyetDinhNhanSu WHERE NhanVienID = @id ORDER BY NgayHieuLuc DESC, QuyetDinhID DESC`)).recordset;
    const thanhLy = (await pool.request().input('id', sql.Int, id).query(
      `SELECT * FROM ThanhLyHopDong WHERE NhanVienID = @id ORDER BY NgayNghiViec DESC, ThanhLyID DESC`)).recordset;
    res.json({ success: true, data: { ...nv, hopDong, phuLuc, quyetDinh, thanhLy } });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: err.message }); }
});

router.post('/nhanvien', requireAuth, requirePermission('HRM', 'create'), requireChucNang('HRM', 'hoso'), async (req, res) => {
  try {
    const pool = await getPool();
    const b = req.body;
    if (!nn(b.hoTen)) return res.status(400).json({ success: false, message: 'Thiếu Họ và tên.' });
    // Ma NV: dung ma nguoi dung nhap neu co, khong thi sinh tu dong NVxxx.
    const maNV = nn(b.maNhanVien) || await nextMaNhanVien(pool);
    const reqDb = pool.request().input('MaNhanVien', sql.NVarChar, maNV);
    bindNhanVien(reqDb, b);
    reqDb.input('MaChamCong', sql.NVarChar, nn(b.maChamCong));   // v5.59: gán mã máy chấm công ngay khi tạo
    const coAnh = await coCotAnhDaiDien(pool);                   // v8.80
    if (coAnh) reqDb.input('AnhDaiDien', sql.NVarChar, nn(b.anhDaiDien));
    const coQT = await coCotQuocTich(pool);                      // v8.82
    if (coQT) reqDb.input('QuocTich', sql.NVarChar, nn(b.quocTich));
    const result = await reqDb.query(`
      INSERT INTO NhanVien (MaNhanVien, HoTen, BoPhanID, SDT, NgayVao, TrangThai, GhiChu,
        NgaySinh, GioiTinh, SoCCCD, NgayCapCCCD, NoiCapCCCD, Email, DiaChi, ChucVu, ChuyenMon,
        TrangThaiLaoDong, SoNguoiPhuThuoc, SoTaiKhoanNH, TenNganHang, ChiNhanhNH, MaSoThueCaNhan, NgayCapMST, SoSoBHXH, MaChamCong${coAnh ? ', AnhDaiDien' : ''}${coQT ? ', QuocTich' : ''})
      OUTPUT INSERTED.NhanVienID
      VALUES (@MaNhanVien, @HoTen, @BoPhanID, @SDT, @NgayVao, @TrangThai, @GhiChu,
        @NgaySinh, @GioiTinh, @SoCCCD, @NgayCapCCCD, @NoiCapCCCD, @Email, @DiaChi, @ChucVu, @ChuyenMon,
        @TrangThaiLaoDong, @SoNguoiPhuThuoc, @SoTaiKhoanNH, @TenNganHang, @ChiNhanhNH, @MaSoThueCaNhan, @NgayCapMST, @SoSoBHXH, @MaChamCong${coAnh ? ', @AnhDaiDien' : ''}${coQT ? ', @QuocTich' : ''})`);
    res.json({ success: true, data: { NhanVienID: result.recordset[0].NhanVienID, MaNhanVien: maNV } });
  } catch (err) {
    console.error(err);
    if (err.number === 2627 || err.number === 2601) return res.status(400).json({ success: false, message: 'Mã nhân viên đã tồn tại.' });
    res.status(400).json({ success: false, message: err.message });
  }
});

router.put('/nhanvien/:id', requireAuth, requirePermission('HRM', 'edit'), requireChucNang('HRM', 'hoso'), async (req, res) => {
  try {
    const pool = await getPool();
    const id = parseInt(req.params.id, 10);
    const b = req.body;
    /* v9.53: trạng thái lao động đổi (đi làm ⇄ đã nghỉ việc) thì người đó vào/ra bảng lương ⇒ đọc giá trị
       cũ trước khi ghi đè để so. Đọc hỏng ⇒ null ⇒ không đánh dấu (không chặn việc sửa hồ sơ). */
    let ttCu;   // undefined = không đọc được / không có người; '' = cột NULL (bảng lương coi là đang làm)
    try {
      const rCu = (await pool.request().input('id', sql.Int, id).query('SELECT TrangThaiLaoDong FROM NhanVien WHERE NhanVienID=@id')).recordset[0];
      ttCu = rCu ? (rCu.TrangThaiLaoDong == null ? '' : String(rCu.TrangThaiLaoDong)) : undefined;
    } catch (e) { ttCu = undefined; }
    const reqDb = pool.request().input('id', sql.Int, id);
    bindNhanVien(reqDb, b);
    // Ma NV: cho phep sua neu gui len (giu nguyen neu de trong).
    reqDb.input('MaNhanVien', sql.NVarChar, nn(b.maNhanVien));
    // v5.59: Mã chấm công — gửi lên thì cập nhật; KHÔNG gửi (undefined) thì giữ nguyên giá trị cũ.
    const coGuiMaCham = Object.prototype.hasOwnProperty.call(b, 'maChamCong');
    reqDb.input('MaChamCong', sql.NVarChar, coGuiMaCham ? nn(b.maChamCong) : null);
    reqDb.input('GhiDeMaCham', sql.Bit, coGuiMaCham ? 1 : 0);
    /* v8.80: ảnh cũng theo luật "client KHÔNG gửi thì GIỮ NGUYÊN" của v6.59 — màn Danh mục > Nhân viên
       dùng chung bảng này và KHÔNG gửi anhDaiDien, ghi đè vô điều kiện là sửa nhân viên bên đó một
       lần là mất ảnh. */
    const coAnh = await coCotAnhDaiDien(pool);
    const coGuiAnh = Object.prototype.hasOwnProperty.call(b, 'anhDaiDien');
    if (coAnh) {
      reqDb.input('AnhDaiDien', sql.NVarChar, coGuiAnh ? nn(b.anhDaiDien) : null);
      reqDb.input('GhiDeAnh', sql.Bit, coGuiAnh ? 1 : 0);
    }
    // v8.82: QuocTich cũng theo luật "client không gửi thì giữ nguyên" (màn Danh mục > Nhân viên không gửi).
    const coQT = await coCotQuocTich(pool);
    const coGuiQT = Object.prototype.hasOwnProperty.call(b, 'quocTich');
    if (coQT) {
      reqDb.input('QuocTich', sql.NVarChar, coGuiQT ? nn(b.quocTich) : null);
      reqDb.input('GhiDeQT', sql.Bit, coGuiQT ? 1 : 0);
    }
    await reqDb.query(`
      UPDATE NhanVien SET
        MaNhanVien = ISNULL(@MaNhanVien, MaNhanVien),
        HoTen=@HoTen, BoPhanID=@BoPhanID, SDT=@SDT, NgayVao=@NgayVao, TrangThai=@TrangThai, GhiChu=@GhiChu,
        NgaySinh=@NgaySinh, GioiTinh=@GioiTinh, SoCCCD=@SoCCCD, NgayCapCCCD=@NgayCapCCCD, NoiCapCCCD=@NoiCapCCCD,
        Email=@Email, DiaChi=@DiaChi, ChucVu=@ChucVu, ChuyenMon=@ChuyenMon, TrangThaiLaoDong=@TrangThaiLaoDong,
        SoNguoiPhuThuoc=@SoNguoiPhuThuoc, SoTaiKhoanNH=@SoTaiKhoanNH, TenNganHang=@TenNganHang, ChiNhanhNH=@ChiNhanhNH,
        MaSoThueCaNhan=@MaSoThueCaNhan, NgayCapMST=@NgayCapMST, SoSoBHXH=@SoSoBHXH,
        MaChamCong = CASE WHEN @GhiDeMaCham = 1 THEN @MaChamCong ELSE MaChamCong END
        ${coAnh ? ', AnhDaiDien = CASE WHEN @GhiDeAnh = 1 THEN @AnhDaiDien ELSE AnhDaiDien END' : ''}
        ${coQT ? ', QuocTich = CASE WHEN @GhiDeQT = 1 THEN @QuocTich ELSE QuocTich END' : ''}
      WHERE NhanVienID=@id`);
    /* v9.53: so theo luật lọc của bảng lương (ISNULL(...) <> 'Đã nghỉ việc'): chỉ chuyển qua lại ranh giới
       "đã nghỉ việc" mới đổi danh sách người có lương; Thử việc ⇄ Chính thức không đánh dấu. */
    const nghi = (v) => String(v || '').trim() === 'Đã nghỉ việc';
    if (ttCu !== undefined && nghi(ttCu) !== nghi(nn(b.trangThaiLaoDong) || 'Thử việc'))
      await bangLuongTuDong.danhDauGanDay(pool, `Đổi trạng thái lao động: ${String(b.hoTen || ('NV #' + id)).trim()}`);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    if (err.number === 2627 || err.number === 2601) return res.status(400).json({ success: false, message: 'Mã nhân viên đã tồn tại.' });
    res.status(400).json({ success: false, message: err.message });
  }
});

/* ================================================================================================
   v8.80 — FILE HỒ SƠ NHÂN SỰ
   ------------------------------------------------------------------------------------------------
   ⚠️ 3 route dưới đây đặt TRƯỚC router.post('/nhanvien/import') và sau /nhanvien/:id là có chủ ý về
   thứ tự Express: đường dẫn literal phải khai trước đường dẫn có tham số cùng cấp. Ở đây các đường
   đều có tiền tố riêng (/file/, /nhanvien/:id/dinhkem) nên không đụng nhau — nhưng đừng đổi
   /nhanvien/:id/dinhkem thành /nhanvien/dinhkem/:id, nó sẽ bị /nhanvien/:id nuốt.
   ================================================================================================ */

// --- Tải LÊN 1 file hồ sơ (ảnh chân dung hoặc giấy tờ). Ghi vào uploads_hr, KHÔNG vào uploads. ---
router.post('/upload', requireAuth, requirePermission('HRM', 'edit'), (req, res) => {
  uploadHR.single('file')(req, res, (err) => {
    if (err) {
      const qua = err.code === 'LIMIT_FILE_SIZE';
      return res.status(400).json({ success: false,
        message: qua ? `File quá lớn (giới hạn ${Math.round(GIOI_HAN_FILE_HR / 1024 / 1024)} MB).`
                     : 'Lỗi khi nhận file: ' + err.message });
    }
    if (!req.file || !req.file.buffer) return res.status(400).json({ success: false, message: 'Không nhận được file.' });
    const tenGoc = String(req.file.originalname || 'file');
    const ext = path.extname(tenGoc).toLowerCase();
    if (!DUOI_CHO_PHEP.includes(ext)) {
      return res.status(400).json({ success: false,
        message: `Chỉ nhận ${DUOI_CHO_PHEP.join(', ')} — không nhận "${ext || '(không có đuôi)'}".` });
    }
    const tenLuu = tenLuuHR(ext);
    try {
      fs.writeFileSync(path.join(THU_MUC_HR, tenLuu), req.file.buffer);
    } catch (e) {
      return res.status(500).json({ success: false, message: 'Không ghi được file: ' + e.message });
    }
    /* KHÔNG trả về đường dẫn tải được. Chỉ trả tên lưu + tên gốc; muốn xem file phải qua
       GET /api/hrm/file/... (có kiểm quyền). */
    res.json({ success: true, data: { tenLuu, tenFile: tenGoc, kichThuoc: req.file.size } });
  });
});

/* --- XEM / TẢI 1 file hồ sơ. Đây là CỬA DUY NHẤT vào uploads_hr. ---
   Khuôn lấy từ routes/hoadon.js: whitelist đuôi, path.basename chống traversal, kiểm file nằm trong
   thư mục gốc, ?xem=1 thì mở ngay trong trình duyệt (PDF/ảnh), mặc định tải về với TÊN GỐC. */
router.get('/file/:tenLuu', requireAuth, requirePermission('HRM', 'view'), async (req, res) => {
  try {
    const duong = duongDanHRAnToan(req.params.tenLuu);
    if (!duong || !fs.existsSync(duong)) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy file.' });
    }
    // Lấy tên gốc để khi tải về người dùng thấy đúng tên đã đặt, không phải hr_1234_ab.pdf.
    const pool = await getPool();
    const r = (await pool.request().input('t', sql.NVarChar, path.basename(duong))
      .query('SELECT TOP 1 TenFile FROM HoSoDinhKemNhanVien WHERE TenLuu = @t')).recordset[0];
    const tenGoc = (r && r.TenFile) || path.basename(duong);
    const ext = path.extname(duong).toLowerCase();
    if (String(req.query.xem || '') === '1') {
      res.setHeader('Content-Type', KIEU_NOI_DUNG[ext] || 'application/octet-stream');
      res.setHeader('Content-Disposition', 'inline');
      // Ảnh chân dung hiện trên màn hồ sơ: cho nhớ đệm ngắn, nhưng PRIVATE để proxy không giữ.
      res.setHeader('Cache-Control', 'private, max-age=3600');
      return fs.createReadStream(duong).pipe(res);
    }
    return res.download(duong, tenGoc);
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: err.message }); }
});

// --- Danh sách file đính kèm của 1 nhân viên ---
router.get('/nhanvien/:id/dinhkem', requireAuth, requirePermission('HRM', 'view'), requireChucNang('HRM', 'hoso'), async (req, res) => {
  try {
    const pool = await getPool();
    const rows = (await pool.request().input('id', sql.Int, parseInt(req.params.id, 10)).query(`
      SELECT dk.*, u.HoTen AS NguoiTai
      FROM HoSoDinhKemNhanVien dk LEFT JOIN Users u ON u.UserID = dk.NguoiTaiID
      WHERE dk.NhanVienID = @id ORDER BY dk.DinhKemID DESC`)).recordset;
    res.json({ success: true, data: rows });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: err.message }); }
});

// --- Gắn 1 file đã tải lên vào nhân viên ---
router.post('/nhanvien/:id/dinhkem', requireAuth, requirePermission('HRM', 'edit'), requireChucNang('HRM', 'hoso'), async (req, res) => {
  try {
    const pool = await getPool();
    const b = req.body || {};
    if (!nn(b.tenLuu) || !nn(b.tenFile)) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin file (tải file lên trước).' });
    }
    // File phải thật sự tồn tại trong kho — chặn việc gắn một tên bịa để dò thư mục.
    const duong = duongDanHRAnToan(b.tenLuu);
    if (!duong || !fs.existsSync(duong)) {
      return res.status(400).json({ success: false, message: 'File không còn trong kho, hãy tải lại.' });
    }
    const kq = await pool.request()
      .input('NhanVienID', sql.Int, parseInt(req.params.id, 10))
      .input('LoaiGiayTo', sql.NVarChar, nn(b.loaiGiayTo))
      .input('TenFile', sql.NVarChar, String(b.tenFile).slice(0, 255))
      .input('TenLuu', sql.NVarChar, path.basename(String(b.tenLuu)))
      .input('KichThuoc', sql.BigInt, nn(b.kichThuoc))
      .input('NgayVanBan', sql.Date, nn(b.ngayVanBan))
      .input('GhiChu', sql.NVarChar, nn(b.ghiChu))
      .input('NguoiTaiID', sql.Int, req.session.user.userId)
      .query(`INSERT INTO HoSoDinhKemNhanVien
                (NhanVienID, LoaiGiayTo, TenFile, TenLuu, KichThuoc, NgayVanBan, GhiChu, NguoiTaiID)
              OUTPUT INSERTED.DinhKemID
              VALUES (@NhanVienID, @LoaiGiayTo, @TenFile, @TenLuu, @KichThuoc, @NgayVanBan, @GhiChu, @NguoiTaiID)`);
    res.json({ success: true, data: { DinhKemID: kq.recordset[0].DinhKemID } });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: err.message }); }
});

/* --- Xóa 1 file đính kèm ---
   Xóa dòng CSDL rồi mới xóa file trên đĩa. Nếu xóa file lỗi (file đang mở, mất quyền) thì vẫn coi là
   xong — để lại file mồ côi còn hơn để lại dòng CSDL trỏ vào file đã mất. */
router.delete('/dinhkem/:id', requireAuth, requirePermission('HRM', 'delete'), requireChucNang('HRM', 'hoso'), async (req, res) => {
  try {
    const pool = await getPool();
    const id = parseInt(req.params.id, 10);
    const r = (await pool.request().input('id', sql.Int, id)
      .query('SELECT TenLuu FROM HoSoDinhKemNhanVien WHERE DinhKemID = @id')).recordset[0];
    if (!r) return res.status(404).json({ success: false, message: 'Không tìm thấy file đính kèm.' });
    await pool.request().input('id', sql.Int, id).query('DELETE FROM HoSoDinhKemNhanVien WHERE DinhKemID = @id');
    const duong = duongDanHRAnToan(r.TenLuu);
    if (duong && fs.existsSync(duong)) {
      try { fs.unlinkSync(duong); } catch (e) { console.error('[hrm] khong xoa duoc file:', e.message); }
    }
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: err.message }); }
});

/* ================================================================================================
   v8.80 — NGƯỜI PHỤ THUỘC
   ------------------------------------------------------------------------------------------------
   🔴 Mỗi đường GHI đều phải gọi dongBoSoNPT() ở cuối. NhanVien.SoNguoiPhuThuoc là thứ payroll.js
   dùng để tính giảm trừ gia cảnh (payroll.js: giamTruNPT = GiamTruNPT * SoNguoiPhuThuoc) — payroll
   KHÔNG đọc bảng này. Quên đồng bộ một đường là lương tính theo con số cũ, không ai thấy.
   Cố ý KHÔNG đổi payroll sang đếm trực tiếp: người phụ thuộc khai hôm nay sẽ hồi tố vào bảng lương
   các kỳ ĐÃ CHỐT.
   ================================================================================================ */
router.get('/nhanvien/:id/nguoiphuthuoc', requireAuth, requirePermission('HRM', 'view'), async (req, res) => {
  try {
    const pool = await getPool();
    const rows = (await pool.request().input('id', sql.Int, parseInt(req.params.id, 10))
      .query('SELECT * FROM NguoiPhuThuoc WHERE NhanVienID = @id ORDER BY NPTID')).recordset;
    res.json({ success: true, data: rows });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: err.message }); }
});

function bindNPT(reqDb, b) {
  reqDb.input('HoTen', sql.NVarChar, nn(b.hoTen))
    .input('NgaySinh', sql.Date, nn(b.ngaySinh))
    .input('QuanHe', sql.NVarChar, nn(b.quanHe))
    .input('SoGiayTo', sql.NVarChar, nn(b.soGiayTo))
    .input('MaSoThue', sql.NVarChar, nn(b.maSoThue))
    .input('TuThang', sql.Date, nn(b.tuThang))
    .input('DenThang', sql.Date, nn(b.denThang))
    .input('DuHoSo', sql.Bit, b.duHoSo ? 1 : 0)
    .input('GhiChu', sql.NVarChar, nn(b.ghiChu));
}

router.post('/nhanvien/:id/nguoiphuthuoc', requireAuth, requirePermission('HRM', 'create'), async (req, res) => {
  try {
    const pool = await getPool();
    const nvId = parseInt(req.params.id, 10);
    const b = req.body || {};
    if (!nn(b.hoTen)) return res.status(400).json({ success: false, message: 'Thiếu Họ và tên người phụ thuộc.' });
    const reqDb = pool.request().input('NhanVienID', sql.Int, nvId);
    bindNPT(reqDb, b);
    const kq = await reqDb.query(`
      INSERT INTO NguoiPhuThuoc (NhanVienID, HoTen, NgaySinh, QuanHe, SoGiayTo, MaSoThue, TuThang, DenThang, DuHoSo, GhiChu)
      OUTPUT INSERTED.NPTID
      VALUES (@NhanVienID, @HoTen, @NgaySinh, @QuanHe, @SoGiayTo, @MaSoThue, @TuThang, @DenThang, @DuHoSo, @GhiChu)`);
    await dongBoSoNPT(pool, nvId);
    res.json({ success: true, data: { NPTID: kq.recordset[0].NPTID } });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: err.message }); }
});

router.put('/nguoiphuthuoc/:id', requireAuth, requirePermission('HRM', 'edit'), async (req, res) => {
  try {
    const pool = await getPool();
    const id = parseInt(req.params.id, 10);
    const reqDb = pool.request().input('id', sql.Int, id);
    bindNPT(reqDb, req.body || {});
    await reqDb.query(`
      UPDATE NguoiPhuThuoc SET HoTen=@HoTen, NgaySinh=@NgaySinh, QuanHe=@QuanHe, SoGiayTo=@SoGiayTo,
        MaSoThue=@MaSoThue, TuThang=@TuThang, DenThang=@DenThang, DuHoSo=@DuHoSo, GhiChu=@GhiChu
      WHERE NPTID=@id`);
    // Sửa không đổi SỐ LƯỢNG, nhưng vẫn đồng bộ cho chắc (rẻ, và tự chữa nếu dữ liệu từng lệch).
    const nv = (await pool.request().input('id', sql.Int, id)
      .query('SELECT NhanVienID FROM NguoiPhuThuoc WHERE NPTID=@id')).recordset[0];
    if (nv) await dongBoSoNPT(pool, nv.NhanVienID);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: err.message }); }
});

router.delete('/nguoiphuthuoc/:id', requireAuth, requirePermission('HRM', 'delete'), async (req, res) => {
  try {
    const pool = await getPool();
    const id = parseInt(req.params.id, 10);
    // Lấy NhanVienID TRƯỚC khi xóa — xóa rồi thì không còn dòng nào để biết đồng bộ cho ai.
    const nv = (await pool.request().input('id', sql.Int, id)
      .query('SELECT NhanVienID FROM NguoiPhuThuoc WHERE NPTID=@id')).recordset[0];
    await pool.request().input('id', sql.Int, id).query('DELETE FROM NguoiPhuThuoc WHERE NPTID=@id');
    if (nv) await dongBoSoNPT(pool, nv.NhanVienID);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: err.message }); }
});

/* ================================================================================================
   v8.85 — MẪU VĂN BẢN NHÂN SỰ (cho phép tự sửa nội dung mẫu in)
   ------------------------------------------------------------------------------------------------
   🔴 ĐÂY LÀ CHỖ DUY NHẤT TRONG HỆ THỐNG người dùng nhập NỘI DUNG rồi hệ thống đem HIỂN THỊ NGUYÊN
   TRẠNG. Mọi chỗ khác chỉ nhập dữ liệu (số, ngày, tên) và code quyết định cách hiển thị.
   Vì vậy phải lọc thẻ nguy hiểm TRƯỚC KHI LƯU — không phải lúc hiển thị:
     - lọc lúc lưu thì nội dung bẩn không bao giờ nằm trong CSDL;
     - lọc lúc hiển thị thì chỉ cần một đường đọc nào đó quên lọc là lọt.
   Bản in dựng trong iframe riêng, nhưng iframe đó CÙNG GỐC với trang chính nên script trong đó vẫn
   đọc được phiên đăng nhập — không được coi iframe là hàng rào.

   ⚠️ MẪU GỐC NẰM TRONG module.hrm.js, KHÔNG seed vào CSDL. Bảng này chỉ giữ bản ĐÃ SỬA.
   Không có dòng trong bảng ⇒ frontend dùng mẫu gốc. "Khôi phục mẫu gốc" = xóa dòng.
   ================================================================================================ */
const GIU_LICH_SU = 10;   // số bản cũ giữ lại cho mỗi mẫu

/* Danh sách mã mẫu hợp lệ — khớp với MAU_GOC ở module.hrm.js.
   Chặn ở đây để không ai tạo mã lạ rồi thắc mắc sao sửa mà bản in không đổi. */
const MA_MAU_HOP_LE = ['HDLD_CHINHTHUC', 'HDLD_THUVIEC', 'QD_TANGLUONG', 'QD_CHUNG', 'PHULUC', 'THANHLY'];

/* Lọc nội dung mẫu — làm theo kiểu DANH SÁCH TRẮNG (chỉ giữ những gì mẫu văn bản cần), KHÔNG
   phải danh sách đen.

   ⚠️ v8.85 bản đầu làm danh sách đen và đã thủng hai chỗ (rà chéo 2026-10-10 tìm ra):
     1. `<img src=x/onerror=alert(1)>` — <img> không nằm trong danh sách thẻ cấm, và regex gỡ on*=
        yêu cầu ký tự ĐỨNG TRƯỚC là khoảng trắng (\s). Trình duyệt chấp nhận dấu "/" làm dải phân
        cách thuộc tính, nên onerror lọt nguyên vẹn.
     2. `<a href=javascript:alert(1)>` — regex chặn javascript: bắt buộc có dấu nháy, không nháy
        là lọt.
   Nội dung này được frontend nạp bằng innerHTML TRÊN TRANG CHÍNH (màn sửa mẫu), nên một thẻ lọt là
   mã chạy với phiên của người mở tab — kể cả admin. Danh sách đen phải đoán hết mọi cách viết;
   danh sách trắng chỉ cần biết mình cần gì.

   Giữ: thẻ trình bày + thuộc tính style/colspan/rowspan/align/width/height/class.
   Bỏ: mọi thẻ khác (giữ lại phần chữ bên trong), mọi thuộc tính khác (on*, href, src, srcset...). */
const THE_CHO_PHEP = new Set(['p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'sub', 'sup',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'span', 'table', 'thead', 'tbody', 'tfoot',
  'tr', 'td', 'th', 'ul', 'ol', 'li', 'hr', 'center', 'font', 'small', 'big', 'pre', 'blockquote']);
// color/size/face: execCommand sinh <font color=...> khi styleWithCSS tắt — không cho thì mất định dạng.
const THUOC_TINH_CHO_PHEP = new Set(['style', 'colspan', 'rowspan', 'align', 'valign',
  'width', 'height', 'class', 'border', 'cellpadding', 'cellspacing', 'color', 'size', 'face']);

// Ký tự điều khiển là một cách né bộ lọc: "java<TAB>script:" trình duyệt vẫn đọc ra "javascript:".
// Viết bằng charCodeAt thay vì dải regex để KHÔNG phải đặt ký tự điều khiển vào chính file nguồn này.
function boKyTuDieuKhien(s) {
  return String(s).split('').filter(c => c.charCodeAt(0) > 31).join('');
}

/* Giải mã thực thể CHỈ ĐỂ KIỂM TRA giá trị, không phải để lưu — "&#106;avascript:" trình duyệt vẫn
   đọc ra "javascript:", so chuỗi thô là trượt.
   KHÔNG bỏ dấu ngoặc ở đây: các phép kiểm ở locThuocTinh() tìm "expression(" và "url(". */
function giaiMaDeKiem(s) {
  const t = String(s)
    .replace(/&#x([0-9a-f]+);?/gi, (m, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);?/g, (m, d) => String.fromCharCode(parseInt(d, 10)));
  return boKyTuDieuKhien(t).replace(/\s/g, '').toLowerCase();
}

/* ĐÃ THAY BẰNG BẢN TRÊN — khối dưới đây còn sót ký tự điều khiển vô hình, chỉ để tham chiếu:
function __CU_giaiMaDeKiem(s) {
  return String(s)
    .replace(/&#x([0-9a-f]+);?/gi, (m, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);?/g, (m, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/[\s -]/g, '');
}
*/

function locThuocTinh(phan) {
  let ra = '';
  // Bắt từng cặp ten="gia" / ten='gia' / ten=gia / ten  (dấu phân cách đứng trước có thể là / hoặc \s)
  const re = /([A-Za-z_:][-A-Za-z0-9_:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>`]*)))?/g;
  let m;
  while ((m = re.exec(phan)) !== null) {
    const ten = m[1].toLowerCase();
    if (!THUOC_TINH_CHO_PHEP.has(ten)) continue;
    const gia = m[2] != null ? m[2] : (m[3] != null ? m[3] : (m[4] != null ? m[4] : ''));
    const kiem = giaiMaDeKiem(gia).toLowerCase();
    /* javascript:/expression()/behavior:/@import — chạy được mã trên trình duyệt cũ.
       url(...) — kéo ảnh từ ngoài vào, đủ để dò "ai vừa mở văn bản này".
       position:fixed|absolute — phủ kín trang CHÍNH (mẫu nạp bằng innerHTML, không trong khung riêng)
         để che hoặc giả giao diện. Mẫu văn bản hành chính không cần ba thứ này. */
    if (/javascript:|expression\(|behavior:|@import|url\(|position:(fixed|absolute)/.test(kiem)) continue;
    ra += ` ${ten}="${String(gia).replace(/"/g, '&quot;')}"`;
  }
  return ra;
}

/* ⚠️ BƯỚC TRUNG HÒA LÀ BẮT BUỘC — đừng bỏ.
   Rà chéo 2026-10-10 tìm ra XSS chạy được ở bản đầu: regex bóc thẻ đòi phải có dấu ">", nên một thẻ
   KHÔNG ĐÓNG ở cuối nội dung lọt nguyên văn:
       ...<img src=x onerror=alert(document.cookie)
   Lưu y nguyên vào CSDL. Lúc in, wrapA4() nối thêm "</div>" phía sau — trình duyệt đang đọc dở
   thuộc tính, lấy luôn dấu ">" của </div> để đóng <img> ⇒ onerror CHẠY, với phiên của người đang in.
   Mà GET /mauvanban cố ý không gate theo chức năng, nên nạn nhân là MỌI người in hợp đồng, kể cả admin.

   Cách bịt: KHÔNG vá chuỗi tại chỗ. Quét một lượt, DỰNG LẠI chuỗi ra từ đầu — thẻ nào nằm trong
   danh sách trắng thì viết lại dạng chuẩn, mọi đoạn còn lại (kể cả thẻ cụt ở cuối) đều đi qua thoat()
   thành chữ. Sau bước này trong chuỗi ra KHÔNG còn dấu "<" nào ngoài các thẻ đã chuẩn hóa.
   KHÔNG escape "&": mẫu có sẵn &nbsp;, escape là hiện ra chữ "&nbsp;" giữa văn bản. */
function locMauAnToan(html) {
  let s = boKyTuDieuKhien(String(html || ''));
  // Bỏ hẳn phần thân của script/style/iframe... — giữ chữ bên trong chúng là giữ nguyên mã nguồn.
  s = s.replace(/<\s*(script|style|iframe|object|embed|noscript|template)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, '');
  s = s.replace(/<!--[\s\S]*?-->/g, '');

  const thoat = (x) => x.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const re = /<\s*(\/?)\s*([A-Za-z][A-Za-z0-9]*)([^>]*)>/g;
  let ra = '', i = 0, m;
  while ((m = re.exec(s)) !== null) {
    ra += thoat(s.slice(i, m.index));      // đoạn chữ giữa hai thẻ: mọi < > đều thành chữ
    const t = m[2].toLowerCase();
    if (THE_CHO_PHEP.has(t)) {
      ra += m[1] ? `</${t}>`
        : `<${t}${locThuocTinh(m[3])}${(t === 'br' || t === 'hr') ? ' /' : ''}>`;
    }
    i = re.lastIndex;
  }
  // Phần đuôi — CHỖ NÀY LÀ MẤU CHỐT: một thẻ mở không có dấu ">" nằm ở cuối không khớp regex nên
  // rơi vào đây và bị biến thành chữ, thay vì lọt nguyên văn rồi mượn dấu ">" của wrapA4().
  return ra + thoat(s.slice(i));
}

/* ĐÃ THAY BẰNG BẢN TRÊN — khối dưới đây còn sót ký tự điều khiển vô hình, chỉ để tham chiếu:
function __CU_locMauAnToan(html) {
  let s = String(html || '');
  // Ký tự điều khiển: vừa dùng làm chỗ giữ bên dưới, vừa là cách chèn ký tự vào giữa "javascript:".
  s = s.replace(/[ --]/g, '');
  // Bỏ hẳn phần thân của script/style/iframe... — giữ chữ bên trong chúng là giữ mã nguồn.
  s = s.replace(/<\s*(script|style|iframe|object|embed|noscript|template)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, '');
  s = s.replace(/<!--[\s\S]*?-->/g, '');

  const giuLai = [];
  s = s.replace(/<\s*(\/?)\s*([A-Za-z][A-Za-z0-9]*)([^>]*)>/g, (ca, dong, the, phan) => {
    const t = String(the).toLowerCase();
    if (!THE_CHO_PHEP.has(t)) return '';          // thẻ lạ: bỏ thẻ, chữ bên trong vẫn còn
    const chuan = dong ? `</${t}>`
      : `<${t}${locThuocTinh(phan)}${(t === 'br' || t === 'hr') ? ' /' : ''}>`;
    giuLai.push(chuan);
    return '' + (giuLai.length - 1) + '';
  });
  // KHÔNG escape "&": mẫu có sẵn &nbsp;, escape là hiện ra chữ "&nbsp;" giữa văn bản.
  s = s.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return s.replace(/(\d+)/g, (ca, i) => giuLai[Number(i)] || '');
}
*/

async function coBangMau(pool) {
  const r = (await pool.request().query("SELECT OBJECT_ID('MauVanBanHRM') AS c")).recordset[0] || {};
  return r.c != null;
}

// Danh sách mẫu ĐÃ SỬA. Mẫu không có ở đây ⇒ frontend dùng bản gốc trong code.
router.get('/mauvanban', requireAuth, requirePermission('HRM', 'view'), async (req, res) => {
  // CỐ Ý không gate requireChucNang ở route NÀY: mọi bản in (hợp đồng, quyết định...) đều gọi nó để
  // lấy mẫu. Chặn ở đây là ai không được vào tab "Mẫu văn bản" cũng không in được hợp đồng.
  // Ba route sửa/xóa/lịch sử bên dưới mới gate theo chức năng.
  try {
    const pool = await getPool();
    if (!await coBangMau(pool)) return res.json({ success: true, data: [], chuaCaiDat: true });
    const rows = (await pool.request().query(`
      SELECT m.MaMau, m.TenMau, m.NoiDung, m.PhienBan, m.CapNhatLuc, u.HoTen AS NguoiSua
      FROM MauVanBanHRM m LEFT JOIN Users u ON u.UserID = m.NguoiSuaID`)).recordset;
    res.json({ success: true, data: rows });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: err.message }); }
});

// Lưu 1 mẫu. Bản cũ đẩy vào lịch sử trước khi ghi đè.
router.put('/mauvanban/:maMau', requireAuth, requirePermission('HRM', 'edit'), requireChucNang('HRM', 'mauvanban'), async (req, res) => {
  try {
    const pool = await getPool();
    if (!await coBangMau(pool)) {
      return res.status(400).json({ success: false, message: 'CSDL chưa chạy migration_v878 nên chưa lưu được mẫu.' });
    }
    const maMau = String(req.params.maMau || '').trim();
    if (!MA_MAU_HOP_LE.includes(maMau)) {
      return res.status(400).json({ success: false, message: `Mã mẫu "${maMau}" không hợp lệ.` });
    }
    /* Trần kích thước: cột là NVARCHAR(MAX) nên không có giới hạn tự nhiên. Một mẫu lồng vài vạn
       thẻ <table> vẫn lọt bộ lọc rồi làm treo trình duyệt của MỌI người in. Mẫu dài nhất (hợp đồng
       chính thức) khoảng 14 nghìn ký tự, nên 300 nghìn là rộng rãi. */
    const GIOI_HAN_MAU = 300000;
    if (String((req.body || {}).noiDung || '').length > GIOI_HAN_MAU) {
      return res.status(400).json({ success: false, message: `Nội dung mẫu quá dài (giới hạn ${GIOI_HAN_MAU} ký tự).` });
    }
    const noiDung = locMauAnToan((req.body || {}).noiDung);
    if (!noiDung.trim()) return res.status(400).json({ success: false, message: 'Nội dung mẫu đang trống.' });

    const cu = (await pool.request().input('m', sql.NVarChar, maMau)
      .query('SELECT NoiDung, PhienBan, NguoiSuaID FROM MauVanBanHRM WHERE MaMau = @m')).recordset[0];
    if (cu) {
      await pool.request()
        .input('m', sql.NVarChar, maMau)
        .input('nd', sql.NVarChar(sql.MAX), cu.NoiDung)
        .input('pb', sql.Int, cu.PhienBan)
        .input('ng', sql.Int, cu.NguoiSuaID)
        .query(`INSERT INTO MauVanBanHRM_LichSu (MaMau, NoiDung, PhienBan, NguoiSuaID)
                VALUES (@m, @nd, @pb, @ng)`);
      // Dọn bản cũ vượt hạn mức — không dọn thì bảng phình theo số lần sửa.
      await pool.request().input('m', sql.NVarChar, maMau).input('giu', sql.Int, GIU_LICH_SU).query(`
        DELETE FROM MauVanBanHRM_LichSu WHERE MaMau = @m AND LichSuID NOT IN (
          SELECT TOP (@giu) LichSuID FROM MauVanBanHRM_LichSu WHERE MaMau = @m ORDER BY LichSuID DESC)`);
    }
    const pbMoi = (cu ? cu.PhienBan : 0) + 1;
    await pool.request()
      .input('m', sql.NVarChar, maMau)
      .input('ten', sql.NVarChar, nn((req.body || {}).tenMau))
      .input('nd', sql.NVarChar(sql.MAX), noiDung)
      .input('pb', sql.Int, pbMoi)
      .input('ng', sql.Int, req.session.user.userId)
      .query(`
        MERGE MauVanBanHRM AS t
        USING (SELECT @m AS MaMau) AS s ON t.MaMau = s.MaMau
        WHEN MATCHED THEN UPDATE SET NoiDung=@nd, TenMau=@ten, PhienBan=@pb, NguoiSuaID=@ng, CapNhatLuc=SYSDATETIME()
        WHEN NOT MATCHED THEN INSERT (MaMau, TenMau, NoiDung, PhienBan, NguoiSuaID)
             VALUES (@m, @ten, @nd, @pb, @ng);`);
    res.json({ success: true, data: { PhienBan: pbMoi } });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: err.message }); }
});

/* Khôi phục mẫu gốc = XÓA dòng trong bảng. Frontend thấy không có dòng thì tự dùng bản trong code.
   Cố ý không ghi bản gốc vào CSDL: giữ đúng một nguồn duy nhất cho bản gốc. */
router.delete('/mauvanban/:maMau', requireAuth, requirePermission('HRM', 'edit'), requireChucNang('HRM', 'mauvanban'), async (req, res) => {
  try {
    const pool = await getPool();
    if (!await coBangMau(pool)) return res.json({ success: true });
    const maMau = String(req.params.maMau || '').trim();
    if (!MA_MAU_HOP_LE.includes(maMau)) {
      return res.status(400).json({ success: false, message: `Mã mẫu "${maMau}" không hợp lệ.` });
    }
    const cu = (await pool.request().input('m', sql.NVarChar, maMau)
      .query('SELECT NoiDung, PhienBan, NguoiSuaID FROM MauVanBanHRM WHERE MaMau = @m')).recordset[0];
    // Đẩy bản đang dùng vào lịch sử trước khi xóa — khôi phục nhầm thì vẫn lấy lại được.
    if (cu) {
      await pool.request()
        .input('m', sql.NVarChar, maMau)
        .input('nd', sql.NVarChar(sql.MAX), cu.NoiDung)
        .input('pb', sql.Int, cu.PhienBan)
        .input('ng', sql.Int, cu.NguoiSuaID)
        .query(`INSERT INTO MauVanBanHRM_LichSu (MaMau, NoiDung, PhienBan, NguoiSuaID)
                VALUES (@m, @nd, @pb, @ng)`);
    }
    await pool.request().input('m', sql.NVarChar, maMau)
      .query('DELETE FROM MauVanBanHRM WHERE MaMau = @m');
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: err.message }); }
});

// Lịch sử các bản trước của 1 mẫu.
router.get('/mauvanban/:maMau/lichsu', requireAuth, requirePermission('HRM', 'view'), requireChucNang('HRM', 'mauvanban'), async (req, res) => {
  try {
    const pool = await getPool();
    if (!await coBangMau(pool)) return res.json({ success: true, data: [] });
    const rows = (await pool.request().input('m', sql.NVarChar, String(req.params.maMau || '').trim()).query(`
      SELECT TOP (50) ls.LichSuID, ls.PhienBan, ls.NoiDung, ls.CapNhatLuc, u.HoTen AS NguoiSua
      FROM MauVanBanHRM_LichSu ls LEFT JOIN Users u ON u.UserID = ls.NguoiSuaID
      WHERE ls.MaMau = @m ORDER BY ls.LichSuID DESC`)).recordset;
    res.json({ success: true, data: rows });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: err.message }); }
});

// Tải lên file Hồ sơ nhân sự: UPSERT theo Mã NV (có thì cập nhật, chưa có thì thêm; Mã trống → tự sinh NVxxx).
// Bộ phận khớp theo tên (chưa có thì tạo mới). Ngày parse tự do. Không làm hỏng NV đang có dữ liệu SX.
router.post('/nhanvien/import', requireAuth, requirePermission('HRM', 'create'), requireChucNang('HRM', 'hoso'), memUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Không nhận được file.' });
    const wb = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null });
    const pool = await getPool();
    const bpCache = new Map();
    (await pool.request().query('SELECT BoPhanID, TenBoPhan FROM BoPhan')).recordset.forEach(b => bpCache.set(String(b.TenBoPhan).trim().toLowerCase(), b.BoPhanID));
    async function resolveBoPhan(ten) {
      const t = (ten == null ? '' : String(ten)).trim(); if (!t) return null;
      const k = t.toLowerCase(); if (bpCache.has(k)) return bpCache.get(k);
      try { const ins = await pool.request().input('t', sql.NVarChar, t).query('INSERT INTO BoPhan (TenBoPhan) OUTPUT INSERTED.BoPhanID VALUES (@t)'); const id = ins.recordset[0].BoPhanID; bpCache.set(k, id); return id; }
      catch (e) { return null; }
    }
    const toDate = v => { if (v == null || v === '') return null; if (v instanceof Date) return v; const d = new Date(v); return isNaN(d.getTime()) ? null : d; };
    const str = v => (v == null || v === '' ? null : String(v).trim());
    let inserted = 0, updated = 0, skipped = 0;
    for (const r of rows) {
      const hoTen = r['Họ tên'] || r['HoTen'] || r['Họ và tên'];
      if (!hoTen) { skipped++; continue; }
      const maNV = str(r['Mã NV'] || r['MaNhanVien'] || r['Mã nhân viên']) || '';
      // v5.59: đọc thêm Chuyên môn / Ngày cấp CCCD / Nơi cấp CCCD / Chi nhánh NH / Ngày cấp MST
      // (đã có trong DB + form nhưng trước đây import bỏ qua). Mỗi cột nhận nhiều tên gọi cho dễ dùng.
      const lay = (...ten) => { for (const t of ten) { if (r[t] != null && r[t] !== '') return r[t]; } return null; };
      const b = {
        hoTen, boPhanId: await resolveBoPhan(lay('Bộ phận', 'BoPhan', 'TenBoPhan')),
        chucVu: str(lay('Chức vụ', 'ChucVu')), chuyenMon: str(lay('Chuyên môn', 'ChuyenMon')),
        gioiTinh: str(lay('Giới tính', 'GioiTinh')), ngaySinh: toDate(lay('Ngày sinh', 'NgaySinh')),
        sdt: str(lay('SĐT', 'SDT', 'Điện thoại', 'Số điện thoại')), email: str(lay('Email')),
        soCCCD: str(lay('CCCD', 'SoCCCD', 'CMND/CCCD')), ngayCapCCCD: toDate(lay('Ngày cấp CCCD', 'NgayCapCCCD')),
        noiCapCCCD: str(lay('Nơi cấp CCCD', 'NoiCapCCCD')), diaChi: str(lay('Địa chỉ', 'DiaChi')),
        trangThaiLaoDong: str(lay('Trạng thái LĐ', 'TrangThaiLaoDong', 'Trạng thái lao động')),
        ngayVao: toDate(lay('Ngày vào', 'NgayVao', 'Ngày vào làm')),
        soNguoiPhuThuoc: lay('Số người phụ thuộc', 'SoNguoiPhuThuoc') != null ? Number(lay('Số người phụ thuộc', 'SoNguoiPhuThuoc')) || 0 : null,
        soTaiKhoanNH: str(lay('Số TK ngân hàng', 'SoTaiKhoanNH', 'Số tài khoản')),
        tenNganHang: str(lay('Tên ngân hàng', 'TenNganHang', 'Ngân hàng')),
        chiNhanhNH: str(lay('Chi nhánh NH', 'ChiNhanhNH', 'Chi nhánh')),
        maSoThueCaNhan: str(lay('MST cá nhân', 'MaSoThueCaNhan', 'MST')),
        ngayCapMST: toDate(lay('Ngày cấp MST', 'NgayCapMST')),
        soSoBHXH: str(lay('Số sổ BHXH', 'SoSoBHXH', 'BHXH')), ghiChu: str(lay('Ghi chú', 'GhiChu'))
      };
      const maChamCong = str(lay('Mã chấm công', 'MaChamCong'));
      const existing = maNV ? (await pool.request().input('m', sql.NVarChar, maNV).query('SELECT NhanVienID FROM NhanVien WHERE MaNhanVien=@m')).recordset[0] : null;
      if (existing) {
        const reqDb = pool.request().input('id', sql.Int, existing.NhanVienID); bindNhanVien(reqDb, b); reqDb.input('MaChamCong', sql.NVarChar, maChamCong);
        await reqDb.query(`UPDATE NhanVien SET HoTen=@HoTen, BoPhanID=@BoPhanID, SDT=@SDT, NgayVao=@NgayVao, TrangThai=@TrangThai, GhiChu=@GhiChu,
          NgaySinh=@NgaySinh, GioiTinh=@GioiTinh, SoCCCD=@SoCCCD, NgayCapCCCD=@NgayCapCCCD, NoiCapCCCD=@NoiCapCCCD,
          Email=@Email, DiaChi=@DiaChi, ChucVu=@ChucVu, ChuyenMon=@ChuyenMon, TrangThaiLaoDong=@TrangThaiLaoDong,
          SoNguoiPhuThuoc=@SoNguoiPhuThuoc, SoTaiKhoanNH=@SoTaiKhoanNH, TenNganHang=@TenNganHang, ChiNhanhNH=@ChiNhanhNH,
          MaSoThueCaNhan=@MaSoThueCaNhan, NgayCapMST=@NgayCapMST, SoSoBHXH=@SoSoBHXH,
          MaChamCong=ISNULL(@MaChamCong, MaChamCong) WHERE NhanVienID=@id`);
        updated++;
      } else {
        const maFinal = maNV || await nextMaNhanVien(pool);
        const reqDb = pool.request().input('MaNhanVien', sql.NVarChar, maFinal); bindNhanVien(reqDb, b); reqDb.input('MaChamCong', sql.NVarChar, maChamCong);
        await reqDb.query(`INSERT INTO NhanVien (MaNhanVien, HoTen, BoPhanID, SDT, NgayVao, TrangThai, GhiChu, NgaySinh, GioiTinh, SoCCCD, NgayCapCCCD, NoiCapCCCD, Email, DiaChi, ChucVu, ChuyenMon, TrangThaiLaoDong, SoNguoiPhuThuoc, SoTaiKhoanNH, TenNganHang, ChiNhanhNH, MaSoThueCaNhan, NgayCapMST, SoSoBHXH, MaChamCong)
          VALUES (@MaNhanVien, @HoTen, @BoPhanID, @SDT, @NgayVao, @TrangThai, @GhiChu, @NgaySinh, @GioiTinh, @SoCCCD, @NgayCapCCCD, @NoiCapCCCD, @Email, @DiaChi, @ChucVu, @ChuyenMon, @TrangThaiLaoDong, @SoNguoiPhuThuoc, @SoTaiKhoanNH, @TenNganHang, @ChiNhanhNH, @MaSoThueCaNhan, @NgayCapMST, @SoSoBHXH, @MaChamCong)`);
        inserted++;
      }
    }
    res.json({ success: true, data: { total: rows.length, inserted, updated, skipped } });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: 'Lỗi import: ' + err.message }); }
});

router.delete('/nhanvien/:id', requireAuth, requirePermission('HRM', 'delete'), requireChucNang('HRM', 'hoso'), async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request().input('id', sql.Int, parseInt(req.params.id, 10))
      .query('DELETE FROM NhanVien WHERE NhanVienID=@id');
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    // 547 = FK constraint: nhan vien dang duoc tham chieu boi du lieu san xuat (PhanCongMay...).
    if (err.number === 547) return res.status(400).json({ success: false, message: 'Không thể xóa: nhân viên này đã có dữ liệu sản xuất/lương liên quan. Hãy đổi trạng thái sang "Đã nghỉ việc" thay vì xóa.' });
    res.status(400).json({ success: false, message: err.message });
  }
});

/* ================================================================
   2. HOP DONG LAO DONG
   ================================================================ */
function bindHopDong(reqDb, b) {
  reqDb.input('NhanVienID', sql.Int, nn(b.nhanVienId))
    .input('SoHopDong', sql.NVarChar, nn(b.soHopDong))
    .input('LoaiHopDong', sql.NVarChar, nn(b.loaiHopDong) || 'Xác định thời hạn')
    .input('TuNgay', sql.Date, nn(b.tuNgay))
    .input('DenNgay', sql.Date, nn(b.denNgay))
    .input('ChucVu', sql.NVarChar, nn(b.chucVu))
    .input('NoiLamViec', sql.NVarChar, nn(b.noiLamViec))
    .input('LuongCoBan', sql.Decimal(14, 2), nn(b.luongCoBan))
    .input('HeSoLuong', sql.Decimal(10, 4), nn(b.heSoLuong))
    .input('PhuCapAnCa', sql.Decimal(14, 2), nn(b.phuCapAnCa))
    .input('PhuCapTrangPhuc', sql.Decimal(14, 2), nn(b.phuCapTrangPhuc))
    .input('PhuCapXangXe', sql.Decimal(14, 2), nn(b.phuCapXangXe))
    .input('PhuCapDienThoai', sql.Decimal(14, 2), nn(b.phuCapDienThoai))
    .input('TrangThai', sql.NVarChar, nn(b.trangThai) || 'Hiệu lực')
    .input('FileDinhKem', sql.NVarChar, nn(b.fileDinhKem))
    .input('GhiChu', sql.NVarChar, nn(b.ghiChu));
}

/* ==================================================================================================
   v8.82 — 8 TRUONG MOI CUA HOP DONG, phuc vu IN theo dung mau cua cong ty.
   Tach rieng khoi bindHopDong() + do cot truoc khi dung: CSDL chua chay migration_v877 van phai
   tao/sua hop dong binh thuong (chi la khong luu duoc 8 o moi). Gop thang vao bindHopDong la
   "Invalid column name" lam vo CA them lan sua hop dong.

   ⚠️ CAC PHU CAP NAY CHI DE IN. payroll.js khong doc chung — xem ghi chu dau migration_v877.
   ================================================================================================== */
const COT_HD_V882 = ['NgayKy', 'QuanLyTrucTiep', 'PhuCapChuyenCan', 'PhuCapChucVu', 'QuyKPI',
  'SoCongXangXe', 'SoCongAnTrua', 'TyLeThuViec'];
let __coCotHDv882 = null;
async function coCotHopDongV882(pool) {
  if (__coCotHDv882 === null) {
    const r = (await pool.request().query("SELECT COL_LENGTH('HopDongLaoDong','NgayKy') AS c")).recordset[0] || {};
    __coCotHDv882 = r.c != null;
  }
  return __coCotHDv882;
}
function bindHopDongV882(reqDb, b) {
  reqDb.input('NgayKy', sql.Date, nn(b.ngayKy))
    .input('QuanLyTrucTiep', sql.NVarChar, nn(b.quanLyTrucTiep))
    .input('PhuCapChuyenCan', sql.Decimal(14, 2), nn(b.phuCapChuyenCan))
    .input('PhuCapChucVu', sql.Decimal(14, 2), nn(b.phuCapChucVu))
    .input('QuyKPI', sql.Decimal(14, 2), nn(b.quyKPI))
    .input('SoCongXangXe', sql.Decimal(6, 2), nn(b.soCongXangXe))
    .input('SoCongAnTrua', sql.Decimal(6, 2), nn(b.soCongAnTrua))
    .input('TyLeThuViec', sql.Decimal(5, 2), nn(b.tyLeThuViec));
}
const cotHDThem = (co) => (co ? ', ' + COT_HD_V882.join(', ') : '');
const thamSoHDThem = (co) => (co ? ', ' + COT_HD_V882.map(c => '@' + c).join(', ') : '');
const ganHDThem = (co) => (co ? ', ' + COT_HD_V882.map(c => `${c}=@${c}`).join(', ') : '');

/* ==================================================================================================
   v9.35 — NOI DUNG CONG VIEC (in vao muc 1.5 cua hop dong).

   Nguyen 2026-11-09: *"ky hop dong them truong noi dung cong viec de nhap tay va gan vao muc 1.5
   cua mau hop dong, vi moi nguoi 1 noi dung cu the khac nhau"*.

   🔴 CO DO COT RIENG, KHONG gop vao COT_HD_V882. May da chay migration_v877 (co NgayKy) nhung CHUA
   chay migration_v887 van phai them/sua hop dong binh thuong. Gop chung thi co V882 = true keo theo
   NoiDungCongViec vao cau SQL => "Invalid column name" => VO CA them lan sua hop dong. Dung bai hoc
   da ghi o khoi ghi chu COT_HD_V882 ngay tren.

   🔴 KHONG cache ket qua do cot (khac __coCotHDv882 phia tren): cache song qua migration la sau khi
   chay migration van phai restart pm2 moi luu duoc o moi, ma nguoi dung thi thay o nhap hien ra binh
   thuong roi go vao — go xong mat trang. Mot truy van COL_LENGTH moi lan luu hop dong la khong dang
   ke so voi viec do.
   ================================================================================================== */
async function coCotNoiDungCongViec(pool) {
  const r = (await pool.request()
    .query("SELECT COL_LENGTH('HopDongLaoDong','NoiDungCongViec') AS c")).recordset[0] || {};
  return r.c != null;
}
function bindNoiDungCongViec(reqDb, b) {
  /* sql.MAX la BAT BUOC: sql.NVarChar tran mac dinh la NVARCHAR(4000) ở tham số, noi dung cong viec
     la doan van dai, gõ qua 4000 ky tu la bi cat cut MA KHONG BAO LOI. */
  reqDb.input('NoiDungCongViec', sql.NVarChar(sql.MAX), nn(b.noiDungCongViec));
}
const cotNDCV = (co) => (co ? ', NoiDungCongViec' : '');
const thamSoNDCV = (co) => (co ? ', @NoiDungCongViec' : '');
const ganNDCV = (co) => (co ? ', NoiDungCongViec=@NoiDungCongViec' : '');

/* ==================================================================================================
   v9.45 — THONG SO LUONG TREN HOP DONG (migration_v890). Nguyen 11/11/2026: "ky hop dong co lua chon
   theo KPI hay theo SP". Tu v9.45 payroll.js DOC thang hop dong de tinh luong — cac cot v8.82
   (PhuCapChuyenCan/PhuCapChucVu/QuyKPI/SoCongXangXe/TyLeThuViec) khong con "chi de in" nua.

   🔴 Co do cot RIENG, KHONG cache — cung ly do voi NoiDungCongViec o tren: may chua chay migration_v890
   van them/sua hop dong binh thuong; chay migration xong khong can restart la luu duoc ngay.
   `KieuLuong` la MOC do (cot dau tien cua v890): mot migration la mot don vi, co cot nay la co ca 6.
   ================================================================================================== */
const COT_HD_V890 = ['KieuLuong', 'DonGiaNgay', 'MucDongBH', 'LuongCoDinhThang', 'NgayHetThuViec', 'KieuThuong'];
async function coCotHopDongV890(pool) {
  const r = (await pool.request().query("SELECT COL_LENGTH('HopDongLaoDong','KieuLuong') AS c")).recordset[0] || {};
  return r.c != null;
}
function bindHopDongV890(reqDb, b) {
  const kieuLuong = String(b.kieuLuong || '').trim() === 'Ngay' ? 'Ngay' : (String(b.kieuLuong || '').trim() === 'Thang' ? 'Thang' : null);
  /* v9.55: + 'ChuyenCan'. v9.73: NHIỀU kiểu — client gửi mảng hoặc chuỗi "KPI,SanPham"; lưu chuỗi chuẩn (utils/kieuThuong).
     Cột còn NVARCHAR(10) (chưa migration_v899) mà chọn ≥ 2 kiểu ⇒ máy chủ ném lỗi rõ ở caller (kiemCotKieuThuongRong). */
  const kieuThuong = ghepKieuThuong(b.kieuThuong);
  reqDb.input('KieuLuong', sql.NVarChar(10), kieuLuong)
    .input('DonGiaNgay', sql.Decimal(14, 2), nn(b.donGiaNgay))
    /* 🔴 MucDongBH: trong/0 = KHONG dong BH. Tien BH 10,5% tinh tren cot nay, KHONG tren LuongCoBan. */
    .input('MucDongBH', sql.Decimal(14, 2), nn(b.mucDongBH))
    .input('LuongCoDinhThang', sql.Decimal(14, 2), nn(b.luongCoDinhThang))
    .input('NgayHetThuViec', sql.Date, nn(b.ngayHetThuViec))
    .input('KieuThuong', sql.NVarChar(50), kieuThuong);
}
/* v9.73: ≥ 2 kiểu thưởng cần cột rộng (migration_v899 nới NVARCHAR(50)). Cột cũ 10 ký tự: 'KPI,SanPham' bị cắt ⇒ lưu rác —
   nên chặn trước bằng lời rõ. */
async function kiemCotKieuThuongRong(pool, b) {
  if (tachKieuThuong(b.kieuThuong).length < 2) return;
  const r = (await pool.request().query("SELECT COL_LENGTH('HopDongLaoDong','KieuThuong') AS c")).recordset[0] || {};
  if (r.c != null && r.c < 100) throw new Error('Chưa chạy database/migration_v899.sql — cột Kiểu thưởng chưa chứa được nhiều kiểu. Chạy migration rồi pm2 restart, lưu lại.');
}
/* v9.78 (migration_v904): SoKmDiLam — số km nhà → công ty của NGƯỜI này; xăng = km × đơn giá/km (Cấu hình lương)
   × ngày công thực tế. Client không gửi ⇒ không đụng; gửi rỗng ⇒ NULL (quay về luật đ/ngày của v9.72).
   Cột chưa có (chưa chạy v904) mà client gửi số ⇒ ném lỗi rõ, không lưu im lặng rồi lương tính thiếu. */
async function luuSoKmDiLam(pool, hopDongId, gt) {
  if (gt === undefined) return;
  const co = (await pool.request().query("SELECT COL_LENGTH('HopDongLaoDong','SoKmDiLam') AS c")).recordset[0].c != null;
  const km = (gt === null || gt === '' ? null : Math.max(0, Number(gt) || 0));
  if (!co) { if (km) throw new Error('Chưa chạy database/migration_v904.sql — chưa lưu được Số km đi làm (xăng theo km).'); return; }
  await pool.request().input('id', sql.Int, hopDongId).input('km', sql.Decimal(6, 2), km)
    .query('UPDATE HopDongLaoDong SET SoKmDiLam=@km WHERE HopDongID=@id');
}
/* v9.74: ChuyenCanTinhCN (migration_v900) — chuyên cần theo ngày nghỉ có đếm CN không. Client không gửi (undefined) ⇒ không đụng;
   gửi false ⇒ 0 (văn phòng nghỉ CN). Cột chưa có: client gửi false thì ném lỗi rõ (lưu im lặng = sản xuất vẫn tính CN là nghỉ). */
async function luuChuyenCanTinhCN(pool, hopDongId, gt) {
  if (gt === undefined || gt === null) return;
  const co = (await pool.request().query("SELECT COL_LENGTH('HopDongLaoDong','ChuyenCanTinhCN') AS c")).recordset[0].c != null;
  const bit = (gt === false || gt === 0 || gt === '0' || gt === 'false') ? 0 : 1;
  if (!co) { if (bit === 0) throw new Error('Chưa chạy database/migration_v900.sql — chưa lưu được "không tính chủ nhật" cho chuyên cần.'); return; }
  await pool.request().input('id', sql.Int, hopDongId).input('v', sql.Bit, bit).query('UPDATE HopDongLaoDong SET ChuyenCanTinhCN=@v WHERE HopDongID=@id');
}
const cotHDV890 = (co) => (co ? ', ' + COT_HD_V890.join(', ') : '');
const thamSoHDV890 = (co) => (co ? ', ' + COT_HD_V890.map(c => '@' + c).join(', ') : '');
const ganHDV890 = (co) => (co ? ', ' + COT_HD_V890.map(c => `${c}=@${c}`).join(', ') : '');

/* Danh sach san pham + don gia cua hop dong (KieuThuong='SanPham'). Ghi lai TOAN BO moi lan luu
   hop dong: xoa het roi chen lai theo thu tu — don gian, va hop dong la ban ghi nho. */
async function luuSanPhamHopDong(pool, hopDongId, ds) {
  if (!Array.isArray(ds)) return;   // client cu khong gui => KHONG dong vao (giu nguyen danh sach da co)
  const co = (await pool.request().query("SELECT OBJECT_ID('HopDongSanPham') AS o")).recordset[0] || {};
  if (co.o == null) return;
  await pool.request().input('id', sql.Int, hopDongId).query('DELETE FROM HopDongSanPham WHERE HopDongID=@id');
  let thuTu = 0;
  for (const sp of ds) {
    const ten = String(sp && sp.tenSanPham || '').trim();
    if (!ten) continue;
    await pool.request().input('id', sql.Int, hopDongId).input('ten', sql.NVarChar(150), ten)
      .input('dg', sql.Decimal(14, 2), Number(sp.donGia) || 0).input('tt', sql.Int, thuTu++)
      .query('INSERT INTO HopDongSanPham (HopDongID, TenSanPham, DonGia, ThuTu) VALUES (@id, @ten, @dg, @tt)');
  }
}
async function docSanPhamHopDong(pool, hopDongIds) {
  const co = (await pool.request().query("SELECT OBJECT_ID('HopDongSanPham') AS o")).recordset[0] || {};
  if (co.o == null || !hopDongIds.length) return new Map();
  const rows = (await pool.request().query(
    `SELECT ID, HopDongID, TenSanPham, DonGia, ThuTu FROM HopDongSanPham
     WHERE HopDongID IN (${hopDongIds.map(n => Number(n) || 0).join(',')}) ORDER BY HopDongID, ThuTu, ID`)).recordset;
  const m = new Map();
  rows.forEach(r => { if (!m.has(r.HopDongID)) m.set(r.HopDongID, []); m.get(r.HopDongID).push(r); });
  return m;
}
/* === v9.55 BAC CHUYEN CAN HOP DONG — BAT DAU === */
/* v9.55 (Nguyen 14/11): Kiểu thưởng 'ChuyenCan' = bậc thang theo công: [{ soCong, tienThuong }] — đạt ≥ SoCong thì
   hưởng TienThuong, bộ tính lấy bậc cao nhất (mỗi bậc là số TỔNG — anh chốt). Cùng khuôn với HopDongSanPham:
   ghi lại TOÀN BỘ mỗi lần lưu, CHỈ khi client có gửi mảng (JS cũ không gửi ⇒ giữ nguyên), bảng chưa có ⇒ bỏ qua. */
async function luuBacChuyenCan(pool, hopDongId, ds) {
  if (!Array.isArray(ds)) return;
  const co = (await pool.request().query("SELECT OBJECT_ID('HopDongChuyenCan') AS o")).recordset[0] || {};
  if (co.o == null) return;
  await pool.request().input('id', sql.Int, hopDongId).query('DELETE FROM HopDongChuyenCan WHERE HopDongID=@id');
  /* v9.72 (Nguyen 17/11): bậc theo SỐ NGÀY NGHỈ TỐI ĐA (0 = đi đủ, 2 = nghỉ 2 ngày) — cột SoNgayNghiToiDa (migration_v898);
     SoCong ghi 0 cho dòng kiểu mới (cột NOT NULL; bộ tính luật cũ bỏ qua mốc 0). Dòng kiểu cũ (soCong) vẫn nhận. */
  const coNghi = (await pool.request().query("SELECT COL_LENGTH('HopDongChuyenCan','SoNgayNghiToiDa') AS c")).recordset[0].c != null;
  const docNghi = (b) => { const v = b && (b.soNgayNghiToiDa != null ? b.soNgayNghiToiDa : b.SoNgayNghiToiDa); return v == null || v === '' ? null : Number(v); };
  /* v9.73 (Nguyen 17/11: "bậc theo số ngày nghỉ đang không lưu, lưu xong quay lại mất"): form 9.72 gửi soNgayNghiToiDa mà máy
     chủ CHƯA có cột (chưa chạy migration_v898) ⇒ trước đây lọc im lặng ⇒ 0 bậc. Nay NÓI RÕ, không nuốt. */
  if (!coNghi && ds.some(b => docNghi(b) != null)) throw new Error('Chưa chạy database/migration_v898.sql — bậc chuyên cần theo SỐ NGÀY NGHỈ chưa lưu được. Chạy migration rồi pm2 restart, lưu lại hợp đồng.');
  /* Sắp theo mốc tăng dần, bỏ dòng rác và bậc TRÙNG mốc (giữ dòng đầu). */
  const sach = ds.map(b => ({ soCong: Number(b && (b.soCong != null ? b.soCong : b.SoCong)) || 0, nghi: docNghi(b), tien: Number(b && (b.tienThuong != null ? b.tienThuong : b.TienThuong)) || 0 }))
    .filter(b => (b.nghi != null && b.nghi >= 0 && coNghi) || b.soCong > 0)
    .sort((a, b) => (a.nghi != null && b.nghi != null) ? a.nghi - b.nghi : a.soCong - b.soCong);
  const daCo = new Set();
  let thuTu = 0;
  for (const b of sach) {
    const khoa = b.nghi != null && coNghi ? 'N' + b.nghi : 'C' + b.soCong;
    if (daCo.has(khoa)) continue;
    daCo.add(khoa);
    const rq = pool.request().input('id', sql.Int, hopDongId).input('sc', sql.Decimal(5, 1), b.nghi != null && coNghi ? 0 : b.soCong)
      .input('tien', sql.Decimal(14, 2), b.tien).input('tt', sql.Int, thuTu++);
    if (coNghi) rq.input('nghi', sql.Decimal(5, 1), b.nghi);
    await rq.query(`INSERT INTO HopDongChuyenCan (HopDongID, SoCong, TienThuong, ThuTu${coNghi ? ', SoNgayNghiToiDa' : ''}) VALUES (@id, @sc, @tien, @tt${coNghi ? ', @nghi' : ''})`);
  }
}
async function docBacChuyenCan(pool, hopDongIds) {
  const co = (await pool.request().query("SELECT OBJECT_ID('HopDongChuyenCan') AS o")).recordset[0] || {};
  if (co.o == null || !hopDongIds.length) return new Map();
  const coNghi = (await pool.request().query("SELECT COL_LENGTH('HopDongChuyenCan','SoNgayNghiToiDa') AS c")).recordset[0].c != null;   // v9.72
  const rows = (await pool.request().query(
    `SELECT ID, HopDongID, SoCong, TienThuong, ThuTu, ${coNghi ? 'SoNgayNghiToiDa' : 'CAST(NULL AS DECIMAL(5,1)) AS SoNgayNghiToiDa'} FROM HopDongChuyenCan
     WHERE HopDongID IN (${hopDongIds.map(n => Number(n) || 0).join(',')}) ORDER BY HopDongID, ThuTu, SoCong, ID`)).recordset;
  const m = new Map();
  rows.forEach(r => { if (!m.has(r.HopDongID)) m.set(r.HopDongID, []); m.get(r.HopDongID).push(r); });
  return m;
}
/* === v9.55 BAC CHUYEN CAN HOP DONG — KET THUC === */

// v8.82: QuyetDinhNhanSu.NgayKy (tách khỏi NgayHieuLuc — mẫu quyết định có cả hai ngày).
let __coNgayKyQD = null;
async function coCotNgayKyQD(pool) {
  if (__coNgayKyQD === null) {
    const r = (await pool.request().query("SELECT COL_LENGTH('QuyetDinhNhanSu','NgayKy') AS c")).recordset[0] || {};
    __coNgayKyQD = r.c != null;
  }
  return __coNgayKyQD;
}
/* ==================================================================================================
   v8.84 — TỰ SINH SỐ QUYẾT ĐỊNH theo STT CHUNG
   --------------------------------------------------------------------------------------------------
   Nguyen báo: bản in ra "Số: 04/2026/QĐTL/QĐTL" — lặp hậu tố, vì người dùng gõ tay cả phần "QĐTL"
   rồi mẫu in lại ghép thêm "/QĐTL" lần nữa.

   Nay: để trống thì backend tự sinh SỐ ĐẦY ĐỦ dạng  <STT>/<năm>/<hậu tố theo loại>, ví dụ
        05/2026/QĐTL   (tăng lương)      05/2026/QĐKT  (khen thưởng)
   và mẫu in in NGUYÊN SoQuyetDinh, không ghép thêm gì -> không thể lặp nữa.

   "STT CHUNG" (Nguyen chốt): đếm CHUNG mọi loại quyết định trong năm, không đếm riêng từng loại.
   Nên tăng lương số 04 thì khen thưởng tiếp theo là 05, không phải 01.

   ⚠️ Sinh số lúc TẠO MỚI và chỉ khi người dùng để trống. Sửa quyết định KHÔNG sinh lại: số văn bản
   đã cấp và đã phát hành ra ngoài thì không được tự đổi.
   ================================================================================================== */
const HAU_TO_QD = {
  'Tăng lương': 'QĐTL', 'Khen thưởng': 'QĐKT', 'Kỷ luật': 'QĐKL',
  'Bổ nhiệm': 'QĐBN', 'Điều chuyển': 'QĐĐC'
};
async function sinhSoQuyetDinh(pool, loaiQuyetDinh) {
  const nam = new Date().getFullYear();
  /* Đếm theo phần "/<năm>/" ở giữa — khớp mọi hậu tố, đúng nghĩa "STT chung".
     Số cũ do người dùng tự gõ (không theo dạng này) sẽ không khớp và bị bỏ qua: chấp nhận được,
     vì STT chỉ cần KHÔNG TRÙNG và tăng dần kể từ khi bật tự sinh. */
  const rs = (await pool.request().input('p', sql.NVarChar, `%/${nam}/%`)
    .query('SELECT SoQuyetDinh FROM QuyetDinhNhanSu WHERE SoQuyetDinh LIKE @p')).recordset;
  const re = new RegExp(`^(\\d+)\\/${nam}\\/`);
  let mx = 0;
  rs.forEach(r => {
    const m = re.exec(String(r.SoQuyetDinh || '').trim());
    if (m) mx = Math.max(mx, parseInt(m[1], 10) || 0);
  });
  const hauTo = HAU_TO_QD[String(loaiQuyetDinh || '').trim()] || 'QĐ';
  return `${String(mx + 1).padStart(2, '0')}/${nam}/${hauTo}`;
}

// v8.82: NhanVien.QuocTich (mẫu HĐLĐ có dòng "Quốc tịch").
let __coQuocTich = null;
async function coCotQuocTich(pool) {
  if (__coQuocTich === null) {
    const r = (await pool.request().query("SELECT COL_LENGTH('NhanVien','QuocTich') AS c")).recordset[0] || {};
    __coQuocTich = r.c != null;
  }
  return __coQuocTich;
}

// Danh sach hop dong (toan bo, hoac loc theo nhanVienId qua query string) + ten NV.
router.get('/hopdong', requireAuth, requirePermission('HRM', 'view'), requireChucNang('HRM', 'hopdong'), async (req, res) => {
  try {
    const pool = await getPool();
    const reqDb = pool.request();
    let where = '';
    if (nn(req.query.nhanVienId)) { reqDb.input('nvid', sql.Int, parseInt(req.query.nhanVienId, 10)); where = 'WHERE hd.NhanVienID = @nvid'; }
    const rows = (await reqDb.query(`
      SELECT hd.*, nv.HoTen, nv.MaNhanVien FROM HopDongLaoDong hd
      JOIN NhanVien nv ON nv.NhanVienID = hd.NhanVienID
      ${where} ORDER BY hd.TuNgay DESC, hd.HopDongID DESC`)).recordset;
    /* v9.45: gan danh sach san pham vao tung hop dong (mang rong neu khong co / chua migration). v9.55: + bac chuyen can. */
    const spMap = await docSanPhamHopDong(pool, rows.map(r => r.HopDongID));
    const bacMap = await docBacChuyenCan(pool, rows.map(r => r.HopDongID));
    rows.forEach(r => { r.sanPham = spMap.get(r.HopDongID) || []; r.bacChuyenCan = bacMap.get(r.HopDongID) || []; });
    res.json({ success: true, data: rows });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: err.message }); }
});

router.post('/hopdong', requireAuth, requirePermission('HRM', 'create'), requireChucNang('HRM', 'hopdong'), async (req, res) => {
  try {
    const pool = await getPool();
    const b = req.body;
    if (!nn(b.nhanVienId)) return res.status(400).json({ success: false, message: 'Thiếu nhân viên.' });
    const reqDb = pool.request().input('NguoiTaoID', sql.Int, req.session.user.userId);
    bindHopDong(reqDb, b);
    const coV882 = await coCotHopDongV882(pool);   // v8.82
    if (coV882) bindHopDongV882(reqDb, b);
    const coNDCV = await coCotNoiDungCongViec(pool);   // v9.35 — cờ RIÊNG, xem khối ghi chú
    if (coNDCV) bindNoiDungCongViec(reqDb, b);
    /* v9.45 — cờ RIÊNG, không cache. Chỉ ghi 6 cột lương khi CLIENT CÓ GỬI (`kieuLuong` có mặt): tab
       còn mở từ bản JS cũ không gửi ⇒ KHÔNG ghi NULL đè lên thông số đã khai (rà chéo v9.45). Máy chưa
       chạy migration mà client gửi ⇒ nói thẳng trong `canhBao` thay vì nuốt im lặng. */
    const coV890 = await coCotHopDongV890(pool);
    const guiV890 = b.kieuLuong !== undefined;
    const ghiV890 = coV890 && guiV890;
    if (ghiV890) { await kiemCotKieuThuongRong(pool, b); bindHopDongV890(reqDb, b); }   // v9.73
    const r = await reqDb.query(`
      INSERT INTO HopDongLaoDong (NhanVienID, SoHopDong, LoaiHopDong, TuNgay, DenNgay, ChucVu, NoiLamViec,
        LuongCoBan, HeSoLuong, PhuCapAnCa, PhuCapTrangPhuc, PhuCapXangXe, PhuCapDienThoai, TrangThai, FileDinhKem, GhiChu, NguoiTaoID${cotHDThem(coV882)}${cotNDCV(coNDCV)}${cotHDV890(ghiV890)})
      OUTPUT INSERTED.HopDongID
      VALUES (@NhanVienID, @SoHopDong, @LoaiHopDong, @TuNgay, @DenNgay, @ChucVu, @NoiLamViec,
        @LuongCoBan, @HeSoLuong, @PhuCapAnCa, @PhuCapTrangPhuc, @PhuCapXangXe, @PhuCapDienThoai, @TrangThai, @FileDinhKem, @GhiChu, @NguoiTaoID${thamSoHDThem(coV882)}${thamSoNDCV(coNDCV)}${thamSoHDV890(ghiV890)})`);
    const hopDongId = r.recordset[0].HopDongID;
    if (ghiV890) await luuSanPhamHopDong(pool, hopDongId, b.sanPham);
    if (ghiV890) await luuBacChuyenCan(pool, hopDongId, b.bacChuyenCan);   // v9.55
    if (ghiV890) await luuChuyenCanTinhCN(pool, hopDongId, b.chuyenCanTinhCN);   // v9.74
    if (ghiV890) await luuSoKmDiLam(pool, hopDongId, b.soKmDiLam);   // v9.78
    /* v9.53: hợp đồng là NGUỒN THÔNG SỐ LƯƠNG (v9.45) ⇒ mọi tháng từ ngày hiệu lực tới nay cần tính lại. */
    await bangLuongTuDong.danhDauTuNgay(pool, nn(b.tuNgay), 'Thêm hợp đồng ' + tenHopDongChoLyDo(b.soHopDong, hopDongId));
    res.json({ success: true, data: { HopDongID: hopDongId },
      canhBao: guiV890 && !coV890 ? 'Máy chủ CHƯA chạy migration_v890.sql — hợp đồng đã lưu nhưng THÔNG SỐ TÍNH LƯƠNG CÔNG NHẬT (kiểu lương, đơn giá, BH, thưởng, sản phẩm) KHÔNG được lưu.' : null });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: err.message }); }
});

router.put('/hopdong/:id', requireAuth, requirePermission('HRM', 'edit'), requireChucNang('HRM', 'hopdong'), async (req, res) => {
  try {
    const pool = await getPool();
    /* v9.53: đọc ngày hiệu lực CŨ trước khi ghi đè — đổi TuNgay thì cả tháng cũ lẫn tháng mới đều cần tính lại. */
    const hdCu = await docHopDongChoLyDo(pool, parseInt(req.params.id, 10));
    const reqDb = pool.request().input('id', sql.Int, parseInt(req.params.id, 10));
    bindHopDong(reqDb, req.body);
    const coV882 = await coCotHopDongV882(pool);   // v8.82
    if (coV882) bindHopDongV882(reqDb, req.body);
    const coNDCV = await coCotNoiDungCongViec(pool);   // v9.35 — cờ RIÊNG, xem khối ghi chú
    if (coNDCV) bindNoiDungCongViec(reqDb, req.body);
    /* v9.45 — như POST: chỉ ghi 6 cột lương khi client CÓ GỬI, kẻo JS cũ ghi NULL đè thông số đã khai. */
    const coV890 = await coCotHopDongV890(pool);
    const guiV890 = req.body.kieuLuong !== undefined;
    const ghiV890 = coV890 && guiV890;
    if (ghiV890) { await kiemCotKieuThuongRong(pool, req.body); bindHopDongV890(reqDb, req.body); }   // v9.73
    await reqDb.query(`
      UPDATE HopDongLaoDong SET SoHopDong=@SoHopDong, LoaiHopDong=@LoaiHopDong, TuNgay=@TuNgay, DenNgay=@DenNgay,
        ChucVu=@ChucVu, NoiLamViec=@NoiLamViec, LuongCoBan=@LuongCoBan, HeSoLuong=@HeSoLuong, PhuCapAnCa=@PhuCapAnCa,
        PhuCapTrangPhuc=@PhuCapTrangPhuc, PhuCapXangXe=@PhuCapXangXe, PhuCapDienThoai=@PhuCapDienThoai,
        TrangThai=@TrangThai, FileDinhKem=@FileDinhKem, GhiChu=@GhiChu, UpdatedAt=SYSDATETIME()${ganHDThem(coV882)}${ganNDCV(coNDCV)}${ganHDV890(ghiV890)}
      WHERE HopDongID=@id`);
    if (ghiV890) await luuSanPhamHopDong(pool, parseInt(req.params.id, 10), req.body.sanPham);
    if (ghiV890) await luuBacChuyenCan(pool, parseInt(req.params.id, 10), req.body.bacChuyenCan);   // v9.55
    if (ghiV890) await luuChuyenCanTinhCN(pool, parseInt(req.params.id, 10), req.body.chuyenCanTinhCN);   // v9.74
    if (ghiV890) await luuSoKmDiLam(pool, parseInt(req.params.id, 10), req.body.soKmDiLam);   // v9.78
    /* v9.53: từ tháng SỚM HƠN giữa ngày hiệu lực cũ và mới (chuỗi 'yyyy-mm-dd' so được bằng sort). */
    const mocSom = [hdCu && hdCu.TuNgay, nn(req.body.tuNgay)].filter(Boolean).map(String).sort()[0] || null;
    await bangLuongTuDong.danhDauTuNgay(pool, mocSom, 'Sửa hợp đồng ' + tenHopDongChoLyDo(req.body.soHopDong || (hdCu && hdCu.SoHopDong), req.params.id));
    res.json({ success: true,
      canhBao: guiV890 && !coV890 ? 'Máy chủ CHƯA chạy migration_v890.sql — hợp đồng đã lưu nhưng THÔNG SỐ TÍNH LƯƠNG CÔNG NHẬT (kiểu lương, đơn giá, BH, thưởng, sản phẩm) KHÔNG được lưu.' : null });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: err.message }); }
});

router.delete('/hopdong/:id', requireAuth, requirePermission('HRM', 'delete'), requireChucNang('HRM', 'hopdong'), async (req, res) => {
  try {
    const pool = await getPool();
    const hdCu = await docHopDongChoLyDo(pool, parseInt(req.params.id, 10));   // v9.53: đọc TRƯỚC khi xóa
    const r = await pool.request().input('id', sql.Int, parseInt(req.params.id, 10)).query('DELETE FROM HopDongLaoDong WHERE HopDongID=@id');
    if (r.rowsAffected[0]) await bangLuongTuDong.danhDauTuNgay(pool, hdCu && hdCu.TuNgay, 'Xóa hợp đồng ' + tenHopDongChoLyDo(hdCu && hdCu.SoHopDong, req.params.id));
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: err.message }); }
});
/* === v9.53 HOP DONG DANH DAU BANG LUONG — BAT DAU === */
/* Đọc số hợp đồng + ngày hiệu lực (CHUỖI yyyy-mm-dd, không qua Date của driver) để đánh dấu. Không ném:
   đọc hỏng thì đánh dấu theo tháng hiện tại, hợp đồng vẫn lưu/xóa bình thường. */
async function docHopDongChoLyDo(pool, hopDongId) {
  try {
    if (!hopDongId) return null;
    return (await pool.request().input('id', sql.Int, hopDongId)
      .query('SELECT SoHopDong, CONVERT(varchar(10), TuNgay, 23) AS TuNgay FROM HopDongLaoDong WHERE HopDongID=@id')).recordset[0] || null;
  } catch (e) { console.warn('[hrm docHopDongChoLyDo] ' + e.message); return null; }
}
function tenHopDongChoLyDo(soHopDong, hopDongId) {
  const so = String(soHopDong || '').trim();
  return so ? `số ${so}` : `#${hopDongId}`;
}
/* === v9.53 HOP DONG DANH DAU BANG LUONG — KET THUC === */

/* ================================================================
   3. PHU LUC HOP DONG
   ================================================================ */
router.get('/phuluc', requireAuth, requirePermission('HRM', 'view'), requireChucNang('HRM', 'phuluc'), async (req, res) => {
  try {
    const pool = await getPool();
    const reqDb = pool.request();
    let where = '';
    if (nn(req.query.nhanVienId)) { reqDb.input('nvid', sql.Int, parseInt(req.query.nhanVienId, 10)); where = 'WHERE hd.NhanVienID = @nvid'; }
    else if (nn(req.query.hopDongId)) { reqDb.input('hdid', sql.Int, parseInt(req.query.hopDongId, 10)); where = 'WHERE pl.HopDongID = @hdid'; }
    const rows = (await reqDb.query(`
      SELECT pl.*, hd.SoHopDong, nv.HoTen, nv.MaNhanVien, nv.NhanVienID FROM PhuLucHopDong pl
      JOIN HopDongLaoDong hd ON hd.HopDongID = pl.HopDongID
      JOIN NhanVien nv ON nv.NhanVienID = hd.NhanVienID
      ${where} ORDER BY pl.NgayKy DESC, pl.PhuLucID DESC`)).recordset;
    res.json({ success: true, data: rows });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: err.message }); }
});

router.post('/phuluc', requireAuth, requirePermission('HRM', 'create'), requireChucNang('HRM', 'phuluc'), async (req, res) => {
  try {
    const pool = await getPool();
    const b = req.body;
    if (!nn(b.hopDongId)) return res.status(400).json({ success: false, message: 'Thiếu hợp đồng gốc.' });
    const r = await pool.request()
      .input('HopDongID', sql.Int, b.hopDongId)
      .input('SoPhuLuc', sql.NVarChar, nn(b.soPhuLuc))
      .input('NgayKy', sql.Date, nn(b.ngayKy))
      .input('NgayHieuLuc', sql.Date, nn(b.ngayHieuLuc))
      .input('NoiDungThayDoi', sql.NVarChar(sql.MAX), nn(b.noiDungThayDoi))
      .input('LuongCoBanMoi', sql.Decimal(14, 2), nn(b.luongCoBanMoi))
      .input('ChucVuMoi', sql.NVarChar, nn(b.chucVuMoi))
      .input('FileDinhKem', sql.NVarChar, nn(b.fileDinhKem))
      .input('GhiChu', sql.NVarChar, nn(b.ghiChu))
      .input('NguoiTaoID', sql.Int, req.session.user.userId)
      .query(`INSERT INTO PhuLucHopDong (HopDongID, SoPhuLuc, NgayKy, NgayHieuLuc, NoiDungThayDoi, LuongCoBanMoi, ChucVuMoi, FileDinhKem, GhiChu, NguoiTaoID)
        OUTPUT INSERTED.PhuLucID
        VALUES (@HopDongID, @SoPhuLuc, @NgayKy, @NgayHieuLuc, @NoiDungThayDoi, @LuongCoBanMoi, @ChucVuMoi, @FileDinhKem, @GhiChu, @NguoiTaoID)`);
    res.json({ success: true, data: { PhuLucID: r.recordset[0].PhuLucID } });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: err.message }); }
});

router.put('/phuluc/:id', requireAuth, requirePermission('HRM', 'edit'), requireChucNang('HRM', 'phuluc'), async (req, res) => {
  try {
    const pool = await getPool();
    const b = req.body;
    await pool.request().input('id', sql.Int, parseInt(req.params.id, 10))
      .input('SoPhuLuc', sql.NVarChar, nn(b.soPhuLuc))
      .input('NgayKy', sql.Date, nn(b.ngayKy))
      .input('NgayHieuLuc', sql.Date, nn(b.ngayHieuLuc))
      .input('NoiDungThayDoi', sql.NVarChar(sql.MAX), nn(b.noiDungThayDoi))
      .input('LuongCoBanMoi', sql.Decimal(14, 2), nn(b.luongCoBanMoi))
      .input('ChucVuMoi', sql.NVarChar, nn(b.chucVuMoi))
      .input('FileDinhKem', sql.NVarChar, nn(b.fileDinhKem))
      .input('GhiChu', sql.NVarChar, nn(b.ghiChu))
      .query(`UPDATE PhuLucHopDong SET SoPhuLuc=@SoPhuLuc, NgayKy=@NgayKy, NgayHieuLuc=@NgayHieuLuc,
        NoiDungThayDoi=@NoiDungThayDoi, LuongCoBanMoi=@LuongCoBanMoi, ChucVuMoi=@ChucVuMoi, FileDinhKem=@FileDinhKem, GhiChu=@GhiChu
        WHERE PhuLucID=@id`);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: err.message }); }
});

router.delete('/phuluc/:id', requireAuth, requirePermission('HRM', 'delete'), requireChucNang('HRM', 'phuluc'), async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request().input('id', sql.Int, parseInt(req.params.id, 10)).query('DELETE FROM PhuLucHopDong WHERE PhuLucID=@id');
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: err.message }); }
});

/* ================================================================
   4. QUYET DINH NHAN SU
   ================================================================ */
router.get('/quyetdinh', requireAuth, requirePermission('HRM', 'view'), requireChucNang('HRM', 'quyetdinh'), async (req, res) => {
  try {
    const pool = await getPool();
    const reqDb = pool.request();
    let where = '';
    if (nn(req.query.nhanVienId)) { reqDb.input('nvid', sql.Int, parseInt(req.query.nhanVienId, 10)); where = 'WHERE qd.NhanVienID = @nvid'; }
    if (nn(req.query.loai)) { reqDb.input('loai', sql.NVarChar, req.query.loai); where = (where ? where + ' AND' : 'WHERE') + ' qd.LoaiQuyetDinh = @loai'; }
    const rows = (await reqDb.query(`
      SELECT qd.*, nv.HoTen, nv.MaNhanVien FROM QuyetDinhNhanSu qd
      JOIN NhanVien nv ON nv.NhanVienID = qd.NhanVienID
      ${where} ORDER BY qd.NgayHieuLuc DESC, qd.QuyetDinhID DESC`)).recordset;
    res.json({ success: true, data: rows });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: err.message }); }
});

router.post('/quyetdinh', requireAuth, requirePermission('HRM', 'create'), requireChucNang('HRM', 'quyetdinh'), async (req, res) => {
  try {
    const pool = await getPool();
    const b = req.body;
    if (!nn(b.nhanVienId)) return res.status(400).json({ success: false, message: 'Thiếu nhân viên.' });
    if (!nn(b.loaiQuyetDinh)) return res.status(400).json({ success: false, message: 'Thiếu loại quyết định.' });
    /* v8.82: NgayKy tách riêng NgayHieuLuc — mẫu quyết định có CẢ HAI ("Hà Nội, ngày…" là ngày ký,
       "Thời điểm áp dụng: kể từ ngày…" là ngày hiệu lực), hai ngày này thường khác nhau. */
    const coNgayKyQD = await coCotNgayKyQD(pool);
    // v8.84: để trống thì tự sinh STT chung; người dùng gõ số riêng thì tôn trọng số đó.
    const soQD = nn(b.soQuyetDinh) || await sinhSoQuyetDinh(pool, b.loaiQuyetDinh);
    const rqQD = pool.request()
      .input('NhanVienID', sql.Int, b.nhanVienId)
      .input('SoQuyetDinh', sql.NVarChar, soQD)
      .input('LoaiQuyetDinh', sql.NVarChar, b.loaiQuyetDinh)
      .input('NgayHieuLuc', sql.Date, nn(b.ngayHieuLuc))
      .input('NoiDung', sql.NVarChar(sql.MAX), nn(b.noiDung))
      .input('GiaTriCu', sql.NVarChar, nn(b.giaTriCu))
      .input('GiaTriMoi', sql.NVarChar, nn(b.giaTriMoi))
      .input('FileDinhKem', sql.NVarChar, nn(b.fileDinhKem))
      .input('GhiChu', sql.NVarChar, nn(b.ghiChu))
      .input('NguoiTaoID', sql.Int, req.session.user.userId);
    if (coNgayKyQD) rqQD.input('NgayKy', sql.Date, nn(b.ngayKy));
    const r = await rqQD
      .query(`INSERT INTO QuyetDinhNhanSu (NhanVienID, SoQuyetDinh, LoaiQuyetDinh, NgayHieuLuc, NoiDung, GiaTriCu, GiaTriMoi, FileDinhKem, GhiChu, NguoiTaoID${coNgayKyQD ? ', NgayKy' : ''})
        OUTPUT INSERTED.QuyetDinhID
        VALUES (@NhanVienID, @SoQuyetDinh, @LoaiQuyetDinh, @NgayHieuLuc, @NoiDung, @GiaTriCu, @GiaTriMoi, @FileDinhKem, @GhiChu, @NguoiTaoID${coNgayKyQD ? ', @NgayKy' : ''})`);
    res.json({ success: true, data: { QuyetDinhID: r.recordset[0].QuyetDinhID, SoQuyetDinh: soQD } });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: err.message }); }
});

router.put('/quyetdinh/:id', requireAuth, requirePermission('HRM', 'edit'), requireChucNang('HRM', 'quyetdinh'), async (req, res) => {
  try {
    const pool = await getPool();
    const b = req.body;
    const coNgayKyQD = await coCotNgayKyQD(pool);   // v8.82
    const rqQD = pool.request().input('id', sql.Int, parseInt(req.params.id, 10))
      .input('SoQuyetDinh', sql.NVarChar, nn(b.soQuyetDinh))
      .input('LoaiQuyetDinh', sql.NVarChar, nn(b.loaiQuyetDinh))
      .input('NgayHieuLuc', sql.Date, nn(b.ngayHieuLuc))
      .input('NoiDung', sql.NVarChar(sql.MAX), nn(b.noiDung))
      .input('GiaTriCu', sql.NVarChar, nn(b.giaTriCu))
      .input('GiaTriMoi', sql.NVarChar, nn(b.giaTriMoi))
      .input('FileDinhKem', sql.NVarChar, nn(b.fileDinhKem))
      .input('GhiChu', sql.NVarChar, nn(b.ghiChu));
    if (coNgayKyQD) rqQD.input('NgayKy', sql.Date, nn(b.ngayKy));
    await rqQD
      .query(`UPDATE QuyetDinhNhanSu SET SoQuyetDinh=@SoQuyetDinh, LoaiQuyetDinh=@LoaiQuyetDinh, NgayHieuLuc=@NgayHieuLuc,
        NoiDung=@NoiDung, GiaTriCu=@GiaTriCu, GiaTriMoi=@GiaTriMoi, FileDinhKem=@FileDinhKem, GhiChu=@GhiChu${coNgayKyQD ? ', NgayKy=@NgayKy' : ''} WHERE QuyetDinhID=@id`);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: err.message }); }
});

router.delete('/quyetdinh/:id', requireAuth, requirePermission('HRM', 'delete'), requireChucNang('HRM', 'quyetdinh'), async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request().input('id', sql.Int, parseInt(req.params.id, 10)).query('DELETE FROM QuyetDinhNhanSu WHERE QuyetDinhID=@id');
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: err.message }); }
});

/* ================================================================
   5. THANH LY HOP DONG (nghi viec)
   Khi tao thanh ly: dong bo NhanVien.TrangThaiLaoDong='Da nghi viec' + TrangThai='Da nghi'.
   ================================================================ */
router.get('/thanhly', requireAuth, requirePermission('HRM', 'view'), requireChucNang('HRM', 'thanhly'), async (req, res) => {
  try {
    const pool = await getPool();
    const reqDb = pool.request();
    let where = '';
    if (nn(req.query.nhanVienId)) { reqDb.input('nvid', sql.Int, parseInt(req.query.nhanVienId, 10)); where = 'WHERE tl.NhanVienID = @nvid'; }
    const rows = (await reqDb.query(`
      SELECT tl.*, nv.HoTen, nv.MaNhanVien, hd.SoHopDong FROM ThanhLyHopDong tl
      JOIN NhanVien nv ON nv.NhanVienID = tl.NhanVienID
      LEFT JOIN HopDongLaoDong hd ON hd.HopDongID = tl.HopDongID
      ${where} ORDER BY tl.NgayNghiViec DESC, tl.ThanhLyID DESC`)).recordset;
    res.json({ success: true, data: rows });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: err.message }); }
});

router.post('/thanhly', requireAuth, requirePermission('HRM', 'create'), requireChucNang('HRM', 'thanhly'), async (req, res) => {
  try {
    const pool = await getPool();
    const b = req.body;
    if (!nn(b.nhanVienId)) return res.status(400).json({ success: false, message: 'Thiếu nhân viên.' });
    if (!nn(b.ngayNghiViec)) return res.status(400).json({ success: false, message: 'Thiếu ngày nghỉ việc.' });
    const r = await pool.request()
      .input('NhanVienID', sql.Int, b.nhanVienId)
      .input('HopDongID', sql.Int, nn(b.hopDongId))
      .input('NgayNghiViec', sql.Date, b.ngayNghiViec)
      .input('LyDoNghi', sql.NVarChar, nn(b.lyDoNghi))
      .input('TroCap', sql.Decimal(14, 2), nn(b.troCap))
      .input('KhauTru', sql.Decimal(14, 2), nn(b.khauTru))
      .input('TrangThaiBanGiao', sql.NVarChar, nn(b.trangThaiBanGiao) || 'Chưa bàn giao')
      .input('FileDinhKem', sql.NVarChar, nn(b.fileDinhKem))
      .input('GhiChu', sql.NVarChar, nn(b.ghiChu))
      .input('NguoiTaoID', sql.Int, req.session.user.userId)
      .query(`INSERT INTO ThanhLyHopDong (NhanVienID, HopDongID, NgayNghiViec, LyDoNghi, TroCap, KhauTru, TrangThaiBanGiao, FileDinhKem, GhiChu, NguoiTaoID)
        OUTPUT INSERTED.ThanhLyID
        VALUES (@NhanVienID, @HopDongID, @NgayNghiViec, @LyDoNghi, @TroCap, @KhauTru, @TrangThaiBanGiao, @FileDinhKem, @GhiChu, @NguoiTaoID)`);
    // Dong bo trang thai nhan vien sang "Da nghi viec" (+ TrangThai cu = "Da nghi" cho QLSX).
    await pool.request().input('id', sql.Int, b.nhanVienId)
      .query(`UPDATE NhanVien SET TrangThaiLaoDong=N'Đã nghỉ việc', TrangThai=N'Đã nghỉ' WHERE NhanVienID=@id`);
    /* v9.53: người nghỉ việc ra khỏi bảng lương (lọc ISNULL(TrangThaiLaoDong,'') <> 'Đã nghỉ việc'). */
    await bangLuongTuDong.danhDauGanDay(pool, 'Thanh lý hợp đồng — nghỉ việc NV #' + b.nhanVienId);
    res.json({ success: true, data: { ThanhLyID: r.recordset[0].ThanhLyID } });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: err.message }); }
});

router.put('/thanhly/:id', requireAuth, requirePermission('HRM', 'edit'), requireChucNang('HRM', 'thanhly'), async (req, res) => {
  try {
    const pool = await getPool();
    const b = req.body;
    await pool.request().input('id', sql.Int, parseInt(req.params.id, 10))
      .input('HopDongID', sql.Int, nn(b.hopDongId))
      .input('NgayNghiViec', sql.Date, nn(b.ngayNghiViec))
      .input('LyDoNghi', sql.NVarChar, nn(b.lyDoNghi))
      .input('TroCap', sql.Decimal(14, 2), nn(b.troCap))
      .input('KhauTru', sql.Decimal(14, 2), nn(b.khauTru))
      .input('TrangThaiBanGiao', sql.NVarChar, nn(b.trangThaiBanGiao))
      .input('FileDinhKem', sql.NVarChar, nn(b.fileDinhKem))
      .input('GhiChu', sql.NVarChar, nn(b.ghiChu))
      .query(`UPDATE ThanhLyHopDong SET HopDongID=@HopDongID, NgayNghiViec=ISNULL(@NgayNghiViec,NgayNghiViec), LyDoNghi=@LyDoNghi,
        TroCap=@TroCap, KhauTru=@KhauTru, TrangThaiBanGiao=@TrangThaiBanGiao, FileDinhKem=@FileDinhKem, GhiChu=@GhiChu WHERE ThanhLyID=@id`);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: err.message }); }
});

router.delete('/thanhly/:id', requireAuth, requirePermission('HRM', 'delete'), requireChucNang('HRM', 'thanhly'), async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request().input('id', sql.Int, parseInt(req.params.id, 10)).query('DELETE FROM ThanhLyHopDong WHERE ThanhLyID=@id');
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: err.message }); }
});

module.exports = router;
/* v9.61: routes/hopdong.js (mẫu hợp đồng mua bán) dùng CHUNG bộ lọc HTML danh sách trắng ở trên —
   một bộ lọc, một chỗ vá. Gắn lên router (export mặc định vẫn là router, server.js không đổi). */
router.locMauAnToan = locMauAnToan;
