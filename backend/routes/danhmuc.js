const express = require('express');
const { sql } = require('../db');
const { buildCrudRouter } = require('../utils/crudFactory');
const { requireAuth, requirePermission } = require('../middleware/auth');
const { getPool } = require('../db');

const router = express.Router();

// --- Bo phan ---
router.use('/bophan', buildCrudRouter({
  table: 'BoPhan', idCol: 'BoPhanID', moduleCode: 'DANHMUC',
  columns: [
    { name: 'TenBoPhan', sqlType: sql.NVarChar, required: true },
    { name: 'GhiChu', sqlType: sql.NVarChar }
  ]
}));

// --- Loai vai ---
router.use('/loaivai', buildCrudRouter({
  table: 'LoaiVai', idCol: 'LoaiVaiID', moduleCode: 'DANHMUC',
  columns: [
    { name: 'TenLoaiVai', sqlType: sql.NVarChar, required: true },
    { name: 'MaLoai', sqlType: sql.NVarChar }
  ]
}));

// --- Mau sac ---
router.use('/mausac', buildCrudRouter({
  table: 'MauSac', idCol: 'MauSacID', moduleCode: 'DANHMUC',
  columns: [
    { name: 'MaMau', sqlType: sql.NVarChar, required: true },
    { name: 'TenMau', sqlType: sql.NVarChar, required: true }
  ]
}));

// --- Danh muc vai (ma vai = loai vai + mau) ---
router.use('/vai', buildCrudRouter({
  table: 'DanhMucVai', idCol: 'VaiID', moduleCode: 'DANHMUC',
  columns: [
    { name: 'MaVai', sqlType: sql.NVarChar, required: true },
    { name: 'LoaiVaiID', sqlType: sql.Int, required: true },
    { name: 'MauSacID', sqlType: sql.Int, required: true },
    { name: 'KhoVai', sqlType: sql.Decimal(10, 2) },
    { name: 'GSM', sqlType: sql.Decimal(10, 2) },
    { name: 'ViTriKho', sqlType: sql.NVarChar },
    { name: 'TonToiThieuKG', sqlType: sql.Decimal(10, 2) },
    { name: 'MaPM', sqlType: sql.NVarChar },
    { name: 'GhiChu', sqlType: sql.NVarChar }
  ]
}));

// --- Phu lieu (the bai, mac, chun, tui bong) ---
router.use('/phulieu', buildCrudRouter({
  table: 'PhuLieu', idCol: 'PhuLieuID', moduleCode: 'DANHMUC',
  columns: [
    { name: 'LoaiPhuLieu', sqlType: sql.NVarChar, required: true },
    { name: 'MaPhuLieu', sqlType: sql.NVarChar, required: true },
    { name: 'TenPhuLieu', sqlType: sql.NVarChar, required: true },
    { name: 'DonViTinh', sqlType: sql.NVarChar },
    { name: 'GhiChu', sqlType: sql.NVarChar }
  ]
}));

// --- Nha gia cong / In theu ---
router.use('/nhagiacong', buildCrudRouter({
  table: 'NhaGiaCong', idCol: 'NhaGiaCongID', moduleCode: 'DANHMUC',
  columns: [
    { name: 'TenNha', sqlType: sql.NVarChar, required: true },
    { name: 'LoaiHinh', sqlType: sql.NVarChar, required: true },
    { name: 'DiaChi', sqlType: sql.NVarChar },
    { name: 'SDT', sqlType: sql.NVarChar },
    { name: 'GhiChu', sqlType: sql.NVarChar }
  ]
}));

// --- Nha cung cap ---
router.use('/nhacungcap', buildCrudRouter({
  table: 'NhaCungCap', idCol: 'NCC_ID', moduleCode: 'DANHMUC',
  columns: [
    { name: 'TenNCC', sqlType: sql.NVarChar, required: true },
    { name: 'DiaChi', sqlType: sql.NVarChar },
    { name: 'SDT', sqlType: sql.NVarChar },
    { name: 'MaSoThue', sqlType: sql.NVarChar },
    { name: 'GhiChu', sqlType: sql.NVarChar }
  ]
}));

/* ================================================================================================
   v6.69 — ĐỔI TÊN KHÁCH TRONG DANH MỤC THÌ ĐỔI LUÔN TRÊN CÁC PHIẾU ĐÃ LƯU.

   NGUYÊN NHÂN LỖI "danh mục và công nợ không đúng tên khách":
   Các phiếu KHÔNG đọc tên từ danh mục lúc hiển thị — chúng lưu MỘT BẢN SAO chuỗi tên tại thời điểm
   lập (PhieuBanHang.TenKhach, PhieuThu/PhieuChi/CongNoDieuChinh.TenDoiTuong, DonKhachDatHang.TenKhach,
   PhieuNhapLai.TenKhach). Công nợ khách hàng lại GOM THEO CHÍNH CHUỖI ĐÓ (congno.js: GROUP BY
   LTRIM(RTRIM(TenKhach))) chứ không theo KhachHangID.
   => Sửa tên trong Danh mục chỉ đụng đúng bảng KhachHang. Màn Danh mục hiện tên mới, màn Công nợ vẫn
      hiện tên cũ. Tệ hơn: lập phiếu mới sau đó thì cùng một khách bị TÁCH THÀNH HAI DÒNG công nợ.

   VÌ SAO KHÔNG ĐỔI SANG GOM THEO KhachHangID:
   `DonKhachDatHang` KHÔNG có cột KhachHangID (schema.sql) và dữ liệu cũ nhiều phiếu để trống ID vì
   trước đây tên gõ tự do. Chuyển khóa gom sẽ làm rơi mất phần công nợ của những phiếu đó — im lặng.
   Đổi tên đồng loạt là cách giữ nguyên khóa nghiệp vụ hiện hành mà vẫn hết lệch.

   Cùng một việc mà làm bằng tay được thì đã có CLI `utils/gop_ten_khach.js` (gộp các tên viết lệch
   nhau) — chỗ này chỉ lo trường hợp SỬA TÊN trong danh mục.
   ================================================================================================ */
const BANG_TEN_KHACH = [
  { ten: 'DonKhachDatHang', cot: 'TenKhach', dieuKien: '' },
  { ten: 'PhieuBanHang', cot: 'TenKhach', dieuKien: '' },
  { ten: 'PhieuNhapLai', cot: 'TenKhach', dieuKien: '' },
  { ten: 'PhieuThu', cot: 'TenDoiTuong', dieuKien: " AND LoaiDoiTuong = N'KhachHang'" },
  { ten: 'PhieuChi', cot: 'TenDoiTuong', dieuKien: " AND LoaiDoiTuong = N'KhachHang'" },
  { ten: 'CongNoDieuChinh', cot: 'TenDoiTuong', dieuKien: " AND LoaiDoiTuong = N'KhachHang'" }
];
router.put('/khachhang/:id', requireAuth, requirePermission('DANHMUC', 'edit'), async (req, res, next) => {
  const tenMoi = String((req.body || {}).TenKhachHang || '').trim();
  if (!tenMoi) return next();                       // thiếu tên -> để CRUD chung báo lỗi như cũ
  const pool = await getPool();
  const cu = (await pool.request().input('id', sql.Int, req.params.id)
    .query('SELECT TenKhachHang FROM KhachHang WHERE KhachHangID=@id')).recordset[0];
  if (!cu) return next();                           // không tìm thấy -> để CRUD chung trả 404
  const tenCu = String(cu.TenKhachHang || '').trim();
  if (tenCu === tenMoi) return next();              // không đổi tên -> đi đường CRUD chung

  /* Đổi tên ở BẢNG DANH MỤC + MỌI BẢNG PHIẾU trong CÙNG MỘT transaction. Hỏng giữa chừng mà không
     quay lui thì nửa bảng tên mới nửa bảng tên cũ — công nợ còn lệch hơn trước khi sửa. */
  const tran = new sql.Transaction(pool);
  await tran.begin();
  try {
    await new sql.Request(tran)
      .input('id', sql.Int, req.params.id)
      .input('ten', sql.NVarChar, tenMoi)
      .input('diaChi', sql.NVarChar, (req.body.DiaChi || null))
      .input('sdt', sql.NVarChar, (req.body.SDT || null))
      .input('email', sql.NVarChar, (req.body.Email || null))
      .input('ghiChu', sql.NVarChar, (req.body.GhiChu || null))
      .query(`UPDATE KhachHang SET TenKhachHang=@ten, DiaChi=@diaChi, SDT=@sdt, Email=@email, GhiChu=@ghiChu
              WHERE KhachHangID=@id`);
    let tongDong = 0;
    const chiTiet = [];
    for (const b of BANG_TEN_KHACH) {
      // Bảng có thể chưa tồn tại (PhieuNhapLai cần migration_v676) -> bỏ qua, không làm hỏng cả lệnh.
      const co = (await new sql.Request(tran).query(`SELECT OBJECT_ID('${b.ten}') AS c`)).recordset[0];
      if (!co || co.c == null) continue;
      const kq = await new sql.Request(tran)
        .input('cu', sql.NVarChar, tenCu)
        .input('moi', sql.NVarChar, tenMoi)
        .query(`UPDATE ${b.ten} SET ${b.cot}=@moi WHERE LTRIM(RTRIM(${b.cot}))=@cu${b.dieuKien}`);
      const n = kq.rowsAffected[0] || 0;
      if (n) chiTiet.push(`${b.ten}: ${n}`);
      tongDong += n;
    }
    await tran.commit();
    console.log('[danhmuc doi ten khach] "%s" -> "%s": %d dong (%s)', tenCu, tenMoi, tongDong, chiTiet.join(', ') || 'không có phiếu nào');
    res.json({
      success: true,
      data: { KhachHangID: Number(req.params.id), TenKhachHang: tenMoi },
      message: tongDong
        ? `Đã đổi tên và cập nhật ${tongDong} dòng trên các phiếu đã lưu (${chiTiet.join(', ')}).`
        : 'Đã đổi tên. Khách này chưa có phiếu nào nên không cần cập nhật thêm.'
    });
  } catch (err) {
    try { await tran.rollback(); } catch (e) { /* transaction có thể đã kết thúc */ }
    console.error('[danhmuc PUT /khachhang/:id] ', err);
    res.status(400).json({ success: false, message: 'Lỗi khi đổi tên khách hàng (đã quay lui, dữ liệu giữ nguyên): ' + err.message });
  }
});

// --- Khach hang ---
router.use('/khachhang', buildCrudRouter({
  table: 'KhachHang', idCol: 'KhachHangID', moduleCode: 'DANHMUC',
  columns: [
    { name: 'TenKhachHang', sqlType: sql.NVarChar, required: true },
    { name: 'DiaChi', sqlType: sql.NVarChar },
    { name: 'SDT', sqlType: sql.NVarChar },
    { name: 'Email', sqlType: sql.NVarChar },
    { name: 'GhiChu', sqlType: sql.NVarChar }
  ]
}));

// --- The kho danh muc (nhom the kho hang hoa, vd "Hang he 2026") ---
// v5.62: + CONG KHAI tung danh muc (link rieng gui khach xem) - xem migration_v656.sql va
// backend/routes/public.js (GET /api/public/catalogue-danhmuc?dm=<slug>).
router.use('/thekhodanhmuc', buildCrudRouter({
  table: 'TheKhoDanhMuc', idCol: 'TheKhoDanhMucID', moduleCode: 'DANHMUC',
  columns: [
    { name: 'TenTheKho', sqlType: sql.NVarChar, required: true },
    { name: 'CongKhai', sqlType: sql.Bit },
    { name: 'Slug', sqlType: sql.NVarChar },
    { name: 'TieuDeCongKhai', sqlType: sql.NVarChar },
    { name: 'MoTaCongKhai', sqlType: sql.NVarChar }
  ]
}));

// --- Nhom san pham (v5.4 - "Loai hang" cua The kho hang hoa, vd Quan be trai/gai - KHAC voi
// TheKhoHangHoa.LoaiHang la NguonHang NhaSanXuat/DatNgoai, xem ghi chu o migration_v54.sql) ---
router.use('/nhomsanpham', buildCrudRouter({
  table: 'DanhMucNhomSanPham', idCol: 'NhomSanPhamID', moduleCode: 'DANHMUC', orderBy: 'TenNhom',
  columns: [
    { name: 'TenNhom', sqlType: sql.NVarChar, required: true }
  ]
}));

// --- Don vi tinh (v4.0 - dung cho dropdown DVT trong don hang san xuat) ---
/* v6.31: DanhMucDonViTinh la NGUON DUY NHAT cho moi o chon don vi trong phan mem.
   + LaDonViGop: danh dau don vi GOM nhieu don vi goc (Ri, Tá, Thùng...) — dung de GOI Y/CANH BAO
     tren giao dien; phep tinh ton kho KHONG dua vao co nay ma dua vao DonViQuyDoi cua tung ma hang.
   + ThuTu: xep don vi goc len truoc don vi gop cho de chon (khong khai thi xep cuoi theo ten). */
router.use('/donvitinh', buildCrudRouter({
  table: 'DanhMucDonViTinh', idCol: 'DonViTinhID', moduleCode: 'DANHMUC',
  orderBy: 'ISNULL(ThuTu, 999), TenDonVi',
  columns: [
    { name: 'TenDonVi', sqlType: sql.NVarChar, required: true },
    { name: 'LaDonViGop', sqlType: sql.Bit },
    { name: 'ThuTu', sqlType: sql.Int },
    { name: 'GhiChu', sqlType: sql.NVarChar }
  ]
}));

// --- Don vi quy doi (v5.21 muc 1, yeu cau "Tạo thêm danh mục đơn vị quy đổi: đvt chính nhân hoặc chia
// hệ số để ra đơn vị quy đổi. Tạo nhiều danh mục đơn vị quy đổi."): moi dong la 1 CAP don vi (vd Ri ->
// Cai, x5) - dung cho Ra lenh san xuat chon 1 cap de dinh dang dong "Tong cong" o Cau truc vai theo dung
// PhepTinh ('Nhan'/'Chia') cua dong do, thay cho fmtDualUnit() cu (luon CHIA, vay tu The kho hang hoa -
// xem migration_v521.sql + module.qlsx.js recalcCvTongCong()/recalcCvTongCongEdit()/printLenhSanXuat()).
router.use('/donviquydoi', buildCrudRouter({
  table: 'DanhMucDonViQuyDoi', idCol: 'ID', moduleCode: 'DANHMUC', orderBy: 'DonViChinh',
  columns: [
    { name: 'DonViChinh', sqlType: sql.NVarChar, required: true },
    { name: 'DonViQuyDoi', sqlType: sql.NVarChar, required: true },
    { name: 'HeSo', sqlType: sql.Decimal(14, 4), required: true },
    { name: 'PhepTinh', sqlType: sql.NVarChar, required: true },
    { name: 'GhiChu', sqlType: sql.NVarChar }
  ]
}));

// --- Cong doan may (v4.0 - khac Cong doan san xuat; dung cho giao viec May + nen bang luong/cham cong) ---
router.use('/congdoanmay', buildCrudRouter({
  table: 'CongDoanMay', idCol: 'CongDoanMayID', moduleCode: 'DANHMUC', orderBy: 'TenCongDoan',
  columns: [
    { name: 'TenCongDoan', sqlType: sql.NVarChar, required: true },
    { name: 'GhiChu', sqlType: sql.NVarChar }
  ]
}));

// --- May san xuat (v5.2 - vd "1 kim", "Vat so" - gan theo Nhan vien de biet ho ngoi may nao, phuc vu tinh luong) ---
router.use('/maysanxuat', buildCrudRouter({
  table: 'MaySanXuat', idCol: 'MaySanXuatID', moduleCode: 'DANHMUC', orderBy: 'TenMay',
  columns: [
    { name: 'TenMay', sqlType: sql.NVarChar, required: true },
    { name: 'GhiChu', sqlType: sql.NVarChar }
  ]
}));

// --- Nhan vien (v4.0 - danh sach cong nhan theo bo phan, dung de giao viec Cat/May + nen bang luong/cham cong) ---
// v5.2: bo sung MaySanXuatID (may san xuat ho dang ngoi, phuc vu tinh luong theo may).
router.use('/nhanvien', buildCrudRouter({
  table: 'NhanVien', idCol: 'NhanVienID', moduleCode: 'DANHMUC', orderBy: 'HoTen',
  columns: [
    { name: 'HoTen', sqlType: sql.NVarChar, required: true },
    { name: 'MaNhanVien', sqlType: sql.NVarChar },
    { name: 'BoPhanID', sqlType: sql.Int },
    { name: 'MaySanXuatID', sqlType: sql.Int },
    { name: 'SDT', sqlType: sql.NVarChar },
    { name: 'NgayVao', sqlType: sql.Date },
    { name: 'TrangThai', sqlType: sql.NVarChar },
    { name: 'GhiChu', sqlType: sql.NVarChar }
  ]
}));

// --- Cong doan san xuat (co thu tu, dung rieng logic khong qua factory) ---
router.get('/congdoan', requireAuth, requirePermission('DANHMUC', 'view'), async (req, res) => {
  const pool = await getPool();
  const result = await pool.request().query('SELECT * FROM CongDoanSanXuat ORDER BY ThuTu');
  res.json({ success: true, data: result.recordset });
});
// v5.7: bo sung MaCongDoan (yeu cau v5.7 "Danh mục Công đoạn sản xuất – thêm mã công đoạn" - de cac noi
// trong QLSX co the tham chieu cong doan theo MA on dinh thay vi TEN de bi doi). Xem migration_v57.sql.
// v5.9: MaCongDoan gio THAT SU duoc dung cho logic (qlsx.js, khohang.js, middleware/auth.js - xem
// migration_v59.sql) - vi vay them cot LaHeThong (BIT) danh dau 8 cong doan he thong, va CHAN sua/xoa
// MaCongDoan cua cac dong nay qua PUT/DELETE ben duoi, tranh chi CHUYEN fragility tu TenCongDoan sang
// MaCongDoan (neu MaCongDoan van tu do sua duoc nhu TenCongDoan truoc day thi coi nhu chua fix duoc gi).
// TenCongDoan/ThuTu VAN sua tu do duoc ke ca voi dong he thong - doi TEN hien thi gio an toan.
router.post('/congdoan', requireAuth, requirePermission('DANHMUC', 'create'), async (req, res) => {
  const pool = await getPool();
  const { TenCongDoan, ThuTu, MaCongDoan } = req.body;
  // LaHeThong KHONG nhan tu client - chi duoc gan qua migration cho 8 cong doan he thong goc, cong
  // doan tao moi qua Danh muc luon la LaHeThong=0 (mac dinh cua cot, khong can gui trong INSERT).
  try {
    const result = await pool.request()
      .input('TenCongDoan', sql.NVarChar, TenCongDoan)
      .input('ThuTu', sql.Int, ThuTu)
      .input('MaCongDoan', sql.NVarChar, MaCongDoan || null)
      .query('INSERT INTO CongDoanSanXuat (TenCongDoan, ThuTu, MaCongDoan) OUTPUT INSERTED.* VALUES (@TenCongDoan, @ThuTu, @MaCongDoan)');
    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error(err);
    // v5.9: migration_v59.sql them unique index tren MaCongDoan - truoc day nhap trung ma se duoc
    // chap nhan (khong khoa), gio se nem loi tai day. Bat rieng de tra thong bao de hieu thay vi
    // de rot thanh unhandled rejection (Express 4 khong tu wrap async route).
    const msg = /UQ_CongDoanSanXuat_MaCongDoan/.test(err.message)
      ? 'Mã công đoạn này đã được dùng cho công đoạn khác - vui lòng chọn mã khác.'
      : ('Lỗi khi tạo công đoạn: ' + err.message);
    res.status(400).json({ success: false, message: msg });
  }
});
router.put('/congdoan/:id', requireAuth, requirePermission('DANHMUC', 'edit'), async (req, res) => {
  const pool = await getPool();
  const { TenCongDoan, ThuTu, MaCongDoan } = req.body;
  try {
    const cur = (await pool.request().input('id', sql.Int, req.params.id)
      .query('SELECT MaCongDoan, LaHeThong FROM CongDoanSanXuat WHERE StageID=@id')).recordset[0];
    if (!cur) return res.status(404).json({ success: false, message: 'Không tìm thấy công đoạn.' });
    // v5.9: cong doan HE THONG (LaHeThong=1) khoa Ma cong doan - nhieu noi trong qlsx.js/khohang.js dung
    // ma nay de nhan dien dung logic (vd 'CAT'/'MAY'/'KN'), sua se lam gian doan giong het van de TenCongDoan
    // truoc day (dinh chan o day - frontend cung khoa o giao dien, xem module.danhmuc.js, nhung backend moi
    // la lop chan THAT SU). TenCongDoan/ThuTu khong bi chan - doi ten hien thi van an toan.
    const newMa = MaCongDoan || null;
    if (cur.LaHeThong && newMa !== cur.MaCongDoan) {
      return res.status(400).json({ success: false, message: 'Đây là công đoạn hệ thống - không thể đổi Mã công đoạn (dùng để hệ thống nhận diện đúng luồng chuyển công đoạn). Vẫn đổi được Tên công đoạn/Thứ tự.' });
    }
    const result = await pool.request()
      .input('id', sql.Int, req.params.id)
      .input('TenCongDoan', sql.NVarChar, TenCongDoan)
      .input('ThuTu', sql.Int, ThuTu)
      .input('MaCongDoan', sql.NVarChar, newMa)
      .query('UPDATE CongDoanSanXuat SET TenCongDoan=@TenCongDoan, ThuTu=@ThuTu, MaCongDoan=@MaCongDoan OUTPUT INSERTED.* WHERE StageID=@id');
    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error(err);
    const msg = /UQ_CongDoanSanXuat_MaCongDoan/.test(err.message)
      ? 'Mã công đoạn này đã được dùng cho công đoạn khác - vui lòng chọn mã khác.'
      : ('Lỗi khi cập nhật công đoạn: ' + err.message);
    res.status(400).json({ success: false, message: msg });
  }
});
router.delete('/congdoan/:id', requireAuth, requirePermission('DANHMUC', 'delete'), async (req, res) => {
  const pool = await getPool();
  try {
    // v5.9: chan xoa cong doan HE THONG (LaHeThong=1) - xoa 1 trong 8 cong doan nay se pha vo luong
    // chuyen cong doan cho MOI don hang tu do tro di (khong chi don dang o dung cong doan bi xoa).
    const cur = (await pool.request().input('id', sql.Int, req.params.id)
      .query('SELECT LaHeThong FROM CongDoanSanXuat WHERE StageID=@id')).recordset[0];
    if (!cur) return res.status(404).json({ success: false, message: 'Không tìm thấy công đoạn.' });
    if (cur.LaHeThong) {
      return res.status(400).json({ success: false, message: 'Đây là công đoạn hệ thống - không thể xóa (sẽ phá vỡ luồng chuyển công đoạn của toàn bộ đơn hàng).' });
    }
    await pool.request().input('id', sql.Int, req.params.id).query('DELETE FROM CongDoanSanXuat WHERE StageID=@id');
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Lỗi khi xóa công đoạn: ' + err.message });
  }
});

// --- Cau hinh he thong (email canh bao, so ngay canh bao) ---
router.get('/cauhinh', requireAuth, requirePermission('DANHMUC', 'view'), async (req, res) => {
  const pool = await getPool();
  const result = await pool.request().query('SELECT * FROM CauHinhHeThong');
  const map = {};
  result.recordset.forEach(r => { map[r.ConfigKey] = r.ConfigValue; });
  res.json({ success: true, data: map });
});
router.put('/cauhinh', requireAuth, requirePermission('DANHMUC', 'edit'), async (req, res) => {
  const pool = await getPool();
  const entries = Object.entries(req.body || {});
  for (const [key, value] of entries) {
    await pool.request()
      .input('k', sql.NVarChar, key)
      .input('v', sql.NVarChar, String(value))
      .query(`MERGE CauHinhHeThong AS t USING (SELECT @k AS ConfigKey) AS s ON t.ConfigKey = s.ConfigKey
              WHEN MATCHED THEN UPDATE SET ConfigValue = @v
              WHEN NOT MATCHED THEN INSERT (ConfigKey, ConfigValue) VALUES (@k, @v);`);
  }
  res.json({ success: true });
});

/* ================================================================================================
   DANH MUC HANG HOA (MA HANG)  — v6.94

   ⚠️ KHONG tao bang moi. `TheKhoHangHoa` DA LA danh muc hang hoa; truoc day chi thieu MOT MAN HINH de
   sua ma / ten, nen nguoi dung go sai la khong sua duoc. Tao bang `DanhMucHangHoa` rieng se thanh hai
   nguon su that cho cung mot thu — chac chan lech nhau.

   Man hinh nay chi quan cac truong CAP MA HANG: MaHang, TenHang, 2 DVT, ty le quy doi, gia ban.
   Mau / anh / danh muc the kho / cong khai van thuoc form The kho hang hoa.

   ⚠️ DOI MA HANG AN TOAN: moi bang khac tro vao ma hang bang MaHangID (khoa so), khong luu chuoi
   MaHang. Doi MaHang khong lam dut lien ket nao. (Khac han voi ten khach — cho do la ban sao chuoi
   dong bang tren tung phieu, doi phai cascade tay; xem utils/gop_ten_khach.js.)

   ⚠️ KHONG dung buildCrudRouter: PUT cua factory ghi TAT CA cot duoc liet ke theo req.body, thieu
   truong la ghi NULL. O day con phai chuan hoa MaHang, kiem trung, va chan xoa co giai thich.
   ================================================================================================ */
const { noiDangDungMaHang } = require('../utils/maHangThamChieu');
const { capNhatMaHang } = require('../utils/maHangCapNhat');

const chuanMaHang = (x) => String(x == null ? '' : x).trim().toUpperCase();

router.get('/hanghoa', requireAuth, requirePermission('DANHMUC', 'view'), async (req, res) => {
  const pool = await getPool();
  const rows = (await pool.request().query(`
    SELECT h.MaHangID, h.MaHang, h.TenHang, h.DonViCoBan, h.DonViQuyDoi, h.LoaiRi, h.GiaBan,
           nsp.TenNhom, tk.TenTheKho,
           -- de man hinh biet ma nao dang duoc dung (khong xoa duoc) ma khong phai bam thu
           (SELECT COUNT(*) FROM PhieuNhapKhoHangChiTiet ct WHERE ct.MaHangID = h.MaHangID) AS SoDongNhapKho
    FROM TheKhoHangHoa h
    LEFT JOIN DanhMucNhomSanPham nsp ON nsp.NhomSanPhamID = h.NhomSanPhamID
    LEFT JOIN TheKhoDanhMuc tk ON tk.TheKhoDanhMucID = h.TheKhoDanhMucID
    ORDER BY h.MaHang`)).recordset;
  res.json({ success: true, data: rows });
});

router.post('/hanghoa', requireAuth, requirePermission('DANHMUC', 'create'), async (req, res) => {
  const pool = await getPool();
  const b = req.body || {};
  const ma = chuanMaHang(b.MaHang);
  const ten = String(b.TenHang || '').trim();
  if (!ma || !ten) return res.status(400).json({ success: false, message: 'Phải có Mã hàng và Tên hàng.' });
  const trung = (await pool.request().input('m', sql.NVarChar, ma)
    .query('SELECT MaHangID FROM TheKhoHangHoa WHERE MaHang = @m')).recordset[0];
  if (trung) return res.status(400).json({ success: false, message: `Mã hàng "${ma}" đã có trong danh mục.` });
  const he = Math.max(1, parseInt(b.LoaiRi, 10) || 1);
  const r = await pool.request()
    .input('MaHang', sql.NVarChar, ma)
    .input('TenHang', sql.NVarChar, ten)
    .input('DonViCoBan', sql.NVarChar, String(b.DonViCoBan || '').trim() || null)
    .input('DonViQuyDoi', sql.NVarChar, String(b.DonViQuyDoi || '').trim() || null)
    .input('LoaiRi', sql.Int, he)
    .input('GiaBan', sql.Decimal(14, 2), b.GiaBan === '' || b.GiaBan == null ? 0 : b.GiaBan)
    .query(`INSERT INTO TheKhoHangHoa (MaHang, TenHang, DonViCoBan, DonViQuyDoi, LoaiRi, GiaBan, LoaiHang)
            OUTPUT INSERTED.MaHangID, INSERTED.MaHang, INSERTED.TenHang
            VALUES (@MaHang, @TenHang, @DonViCoBan, @DonViQuyDoi, @LoaiRi, @GiaBan, N'DatNgoai')`);
  res.json({ success: true, data: r.recordset[0] });
});

router.put('/hanghoa/:id', requireAuth, requirePermission('DANHMUC', 'edit'), async (req, res) => {
  const pool = await getPool();
  const b = req.body || {};
  /* v6.98: dung CHUNG capNhatMaHang() voi phieu nhap kho (dong khai) — mot bo truong, mot duong ghi.
     Truoc day moi ben tu viet UPDATE rieng; hai ban sao la som muon lech (mot ben quen ISNULL la xoa
     trang du lieu). Field name gui len theo kieu camelCase cua util. */
  try {
    const kq = await capNhatMaHang(pool, null, parseInt(req.params.id, 10), {
      maHang: b.MaHang, tenHang: b.TenHang,
      donViCoBan: b.DonViCoBan, donViQuyDoi: b.DonViQuyDoi, loaiRi: b.LoaiRi,
      giaBan: b.GiaBan, nhomSanPhamId: b.NhomSanPhamID,
      theKhoDanhMucId: b.TheKhoDanhMucID, maBarcode: b.MaBarcode
    });
    const tin = [];
    if (kq.doiMa) {
      tin.push(`Đã đổi mã ${kq.doiMa.tu} → ${kq.doiMa.den}. Mọi phiếu cũ vẫn liên kết đúng (các bảng lưu theo ID, không lưu chuỗi mã).`);
    }
    /* v7.02: BAO RO khi doi DVT/ty le — so trong kho khong doi nhung Y NGHIA doi, moi cho hien thi
       (the kho, phieu ban hang, bao cao ton) se doc lai theo ty le moi. Doi im lang la nguoi dung
       thay "2 Ri5" bien thanh "5" ma khong hieu vi sao. */
    if (kq.doiDonVi && kq.doiDonVi.length) {
      tin.push('⚠️ Đã đổi ' + kq.doiDonVi.join(', ')
        + '. Số lượng trong kho KHÔNG đổi, nhưng mọi chỗ hiển thị sẽ đọc lại theo tỷ lệ mới — kiểm tra lại tồn kho và các phiếu bán hàng của mã này.');
    }
    res.json({ success: true, message: tin.length ? tin.join(' ') : 'Đã lưu.' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.delete('/hanghoa/:id', requireAuth, requirePermission('DANHMUC', 'delete'), async (req, res) => {
  const pool = await getPool();
  const id = parseInt(req.params.id, 10);
  const h = (await pool.request().input('id', sql.Int, id)
    .query('SELECT MaHang FROM TheKhoHangHoa WHERE MaHangID = @id')).recordset[0];
  if (!h) return res.status(404).json({ success: false, message: 'Không tìm thấy mã hàng.' });
  // Chan co GIAI THICH: cau "có thể đang được tham chiếu ở nơi khác" cua factory khong giup gi.
  const vuong = await noiDangDungMaHang(pool, id);
  if (vuong.length) {
    return res.status(400).json({
      success: false,
      message: `Không xóa được mã ${h.MaHang} — đang dùng ở: ${vuong.join(', ')}. Phải xóa/hủy các chứng từ đó trước.`
    });
  }
  // Thẻ kho (TheKhoChiTietMau) va gia von mat theo ON DELETE CASCADE.
  await pool.request().input('id', sql.Int, id).query('DELETE FROM TheKhoHangHoa WHERE MaHangID = @id');
  res.json({ success: true, message: `Đã xóa mã ${h.MaHang} khỏi danh mục.` });
});

module.exports = router;
