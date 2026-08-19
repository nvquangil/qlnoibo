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
const { sql, getPool } = require('../db');
const { requireAuth, requirePermission, requireChucNang } = require('../middleware/auth');
const multer = require('multer');
const XLSX = require('xlsx');
const memUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });   // v5.38: import hồ sơ nhân sự

const router = express.Router();

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

/* ================================================================
   REFS - danh muc dung cho cac dropdown (bo phan + danh sach NV rut gon)
   ================================================================ */
router.get('/refs', requireAuth, requirePermission('HRM', 'view'), async (req, res) => {
  try {
    const pool = await getPool();
    const boPhan = (await pool.request().query(
      `SELECT BoPhanID, TenBoPhan FROM BoPhan ORDER BY TenBoPhan`)).recordset;
    const nhanVien = (await pool.request().query(
      `SELECT NhanVienID, MaNhanVien, HoTen FROM NhanVien ORDER BY HoTen`)).recordset;
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
    const result = await reqDb.query(`
      INSERT INTO NhanVien (MaNhanVien, HoTen, BoPhanID, SDT, NgayVao, TrangThai, GhiChu,
        NgaySinh, GioiTinh, SoCCCD, NgayCapCCCD, NoiCapCCCD, Email, DiaChi, ChucVu, ChuyenMon,
        TrangThaiLaoDong, SoNguoiPhuThuoc, SoTaiKhoanNH, TenNganHang, ChiNhanhNH, MaSoThueCaNhan, NgayCapMST, SoSoBHXH, MaChamCong)
      OUTPUT INSERTED.NhanVienID
      VALUES (@MaNhanVien, @HoTen, @BoPhanID, @SDT, @NgayVao, @TrangThai, @GhiChu,
        @NgaySinh, @GioiTinh, @SoCCCD, @NgayCapCCCD, @NoiCapCCCD, @Email, @DiaChi, @ChucVu, @ChuyenMon,
        @TrangThaiLaoDong, @SoNguoiPhuThuoc, @SoTaiKhoanNH, @TenNganHang, @ChiNhanhNH, @MaSoThueCaNhan, @NgayCapMST, @SoSoBHXH, @MaChamCong)`);
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
    const reqDb = pool.request().input('id', sql.Int, id);
    bindNhanVien(reqDb, b);
    // Ma NV: cho phep sua neu gui len (giu nguyen neu de trong).
    reqDb.input('MaNhanVien', sql.NVarChar, nn(b.maNhanVien));
    // v5.59: Mã chấm công — gửi lên thì cập nhật; KHÔNG gửi (undefined) thì giữ nguyên giá trị cũ.
    const coGuiMaCham = Object.prototype.hasOwnProperty.call(b, 'maChamCong');
    reqDb.input('MaChamCong', sql.NVarChar, coGuiMaCham ? nn(b.maChamCong) : null);
    reqDb.input('GhiDeMaCham', sql.Bit, coGuiMaCham ? 1 : 0);
    await reqDb.query(`
      UPDATE NhanVien SET
        MaNhanVien = ISNULL(@MaNhanVien, MaNhanVien),
        HoTen=@HoTen, BoPhanID=@BoPhanID, SDT=@SDT, NgayVao=@NgayVao, TrangThai=@TrangThai, GhiChu=@GhiChu,
        NgaySinh=@NgaySinh, GioiTinh=@GioiTinh, SoCCCD=@SoCCCD, NgayCapCCCD=@NgayCapCCCD, NoiCapCCCD=@NoiCapCCCD,
        Email=@Email, DiaChi=@DiaChi, ChucVu=@ChucVu, ChuyenMon=@ChuyenMon, TrangThaiLaoDong=@TrangThaiLaoDong,
        SoNguoiPhuThuoc=@SoNguoiPhuThuoc, SoTaiKhoanNH=@SoTaiKhoanNH, TenNganHang=@TenNganHang, ChiNhanhNH=@ChiNhanhNH,
        MaSoThueCaNhan=@MaSoThueCaNhan, NgayCapMST=@NgayCapMST, SoSoBHXH=@SoSoBHXH,
        MaChamCong = CASE WHEN @GhiDeMaCham = 1 THEN @MaChamCong ELSE MaChamCong END
      WHERE NhanVienID=@id`);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    if (err.number === 2627 || err.number === 2601) return res.status(400).json({ success: false, message: 'Mã nhân viên đã tồn tại.' });
    res.status(400).json({ success: false, message: err.message });
  }
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
    const r = await reqDb.query(`
      INSERT INTO HopDongLaoDong (NhanVienID, SoHopDong, LoaiHopDong, TuNgay, DenNgay, ChucVu, NoiLamViec,
        LuongCoBan, HeSoLuong, PhuCapAnCa, PhuCapTrangPhuc, PhuCapXangXe, PhuCapDienThoai, TrangThai, FileDinhKem, GhiChu, NguoiTaoID)
      OUTPUT INSERTED.HopDongID
      VALUES (@NhanVienID, @SoHopDong, @LoaiHopDong, @TuNgay, @DenNgay, @ChucVu, @NoiLamViec,
        @LuongCoBan, @HeSoLuong, @PhuCapAnCa, @PhuCapTrangPhuc, @PhuCapXangXe, @PhuCapDienThoai, @TrangThai, @FileDinhKem, @GhiChu, @NguoiTaoID)`);
    res.json({ success: true, data: { HopDongID: r.recordset[0].HopDongID } });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: err.message }); }
});

router.put('/hopdong/:id', requireAuth, requirePermission('HRM', 'edit'), requireChucNang('HRM', 'hopdong'), async (req, res) => {
  try {
    const pool = await getPool();
    const reqDb = pool.request().input('id', sql.Int, parseInt(req.params.id, 10));
    bindHopDong(reqDb, req.body);
    await reqDb.query(`
      UPDATE HopDongLaoDong SET SoHopDong=@SoHopDong, LoaiHopDong=@LoaiHopDong, TuNgay=@TuNgay, DenNgay=@DenNgay,
        ChucVu=@ChucVu, NoiLamViec=@NoiLamViec, LuongCoBan=@LuongCoBan, HeSoLuong=@HeSoLuong, PhuCapAnCa=@PhuCapAnCa,
        PhuCapTrangPhuc=@PhuCapTrangPhuc, PhuCapXangXe=@PhuCapXangXe, PhuCapDienThoai=@PhuCapDienThoai,
        TrangThai=@TrangThai, FileDinhKem=@FileDinhKem, GhiChu=@GhiChu, UpdatedAt=SYSDATETIME()
      WHERE HopDongID=@id`);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: err.message }); }
});

router.delete('/hopdong/:id', requireAuth, requirePermission('HRM', 'delete'), requireChucNang('HRM', 'hopdong'), async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request().input('id', sql.Int, parseInt(req.params.id, 10)).query('DELETE FROM HopDongLaoDong WHERE HopDongID=@id');
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: err.message }); }
});

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
    const r = await pool.request()
      .input('NhanVienID', sql.Int, b.nhanVienId)
      .input('SoQuyetDinh', sql.NVarChar, nn(b.soQuyetDinh))
      .input('LoaiQuyetDinh', sql.NVarChar, b.loaiQuyetDinh)
      .input('NgayHieuLuc', sql.Date, nn(b.ngayHieuLuc))
      .input('NoiDung', sql.NVarChar(sql.MAX), nn(b.noiDung))
      .input('GiaTriCu', sql.NVarChar, nn(b.giaTriCu))
      .input('GiaTriMoi', sql.NVarChar, nn(b.giaTriMoi))
      .input('FileDinhKem', sql.NVarChar, nn(b.fileDinhKem))
      .input('GhiChu', sql.NVarChar, nn(b.ghiChu))
      .input('NguoiTaoID', sql.Int, req.session.user.userId)
      .query(`INSERT INTO QuyetDinhNhanSu (NhanVienID, SoQuyetDinh, LoaiQuyetDinh, NgayHieuLuc, NoiDung, GiaTriCu, GiaTriMoi, FileDinhKem, GhiChu, NguoiTaoID)
        OUTPUT INSERTED.QuyetDinhID
        VALUES (@NhanVienID, @SoQuyetDinh, @LoaiQuyetDinh, @NgayHieuLuc, @NoiDung, @GiaTriCu, @GiaTriMoi, @FileDinhKem, @GhiChu, @NguoiTaoID)`);
    res.json({ success: true, data: { QuyetDinhID: r.recordset[0].QuyetDinhID } });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: err.message }); }
});

router.put('/quyetdinh/:id', requireAuth, requirePermission('HRM', 'edit'), requireChucNang('HRM', 'quyetdinh'), async (req, res) => {
  try {
    const pool = await getPool();
    const b = req.body;
    await pool.request().input('id', sql.Int, parseInt(req.params.id, 10))
      .input('SoQuyetDinh', sql.NVarChar, nn(b.soQuyetDinh))
      .input('LoaiQuyetDinh', sql.NVarChar, nn(b.loaiQuyetDinh))
      .input('NgayHieuLuc', sql.Date, nn(b.ngayHieuLuc))
      .input('NoiDung', sql.NVarChar(sql.MAX), nn(b.noiDung))
      .input('GiaTriCu', sql.NVarChar, nn(b.giaTriCu))
      .input('GiaTriMoi', sql.NVarChar, nn(b.giaTriMoi))
      .input('FileDinhKem', sql.NVarChar, nn(b.fileDinhKem))
      .input('GhiChu', sql.NVarChar, nn(b.ghiChu))
      .query(`UPDATE QuyetDinhNhanSu SET SoQuyetDinh=@SoQuyetDinh, LoaiQuyetDinh=@LoaiQuyetDinh, NgayHieuLuc=@NgayHieuLuc,
        NoiDung=@NoiDung, GiaTriCu=@GiaTriCu, GiaTriMoi=@GiaTriMoi, FileDinhKem=@FileDinhKem, GhiChu=@GhiChu WHERE QuyetDinhID=@id`);
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
