/* ================================================================================================
   QUAN LY CONG NO  (v6.23) — Phieu thu / Phieu chi / Cong no khach hang / Cong no nha cung cap
   ------------------------------------------------------------------------------------------------
   NGUYEN TAC: KHONG bat nhap lai nhung gi he thong da co.
     * Cong no KHACH HANG:  phai thu = SUM(PhieuBanHang.TongThanhToan cua khach, tru phieu 'Da huy')
                                     + SUM(CongNoDieuChinh khach)
                            da thu   = SUM(PhieuThu cua khach)
                            con no   = phai thu - da thu
       Nhom theo TEN KHACH (chuoi) vi ca he thong dung ten khach go tu do (DonKhachDatHang.TenKhach).
     * Cong no NHA CUNG CAP: phai tra = tien nhap VAI  (VaiCay.KGNhap x VaiCay.DonGiaNhap, theo
                                        PhieuNhapVai.NCC_ID)
                                      + tien nhap PHU KIEN (PhieuPhuKienChiTiet.SoLuong x DonGia,
                                        phieu LoaiPhieu = N'Nhập', theo PhieuPhuKien.NCC_ID)
                                      + SUM(CongNoDieuChinh NCC)   <- gia cong / in theu / no dau ky
                            da tra   = SUM(PhieuChi cua NCC)
       (Theo dung yeu cau: TU DONG chi tu vai + phu kien; gia cong/in theu nhap tay qua Dieu chinh.)
   Cot DonGia cua phu kien do migration_v54 them, DonGiaNhap cua cay vai co tu schema v4.0 -> deu do
   bang COL_LENGTH truoc khi dung de man hinh khong chet neu CSDL chua day du.
   ================================================================================================ */
const express = require('express');
const ExcelJS = require('exceljs');
const { sql, getPool } = require('../db');
const { requireAuth, requirePermission, requireChucNang } = require('../middleware/auth');

const router = express.Router();
['get', 'post', 'put', 'delete'].forEach(method => {
  const goc = router[method].bind(router);
  router[method] = (path, ...handlers) => goc(path, ...handlers.map(h => (
    h.length >= 4 ? h : (req, res, next) => Promise.resolve(h(req, res, next)).catch(next)
  )));
});

function so(v) { const n = Number(v); return isFinite(n) ? n : 0; }
/* Chuan hoa 1 phieu THU: neu gan vao phieu ban hang thi BAT BUOC la khoan thu cua KHACH do va lay
   DUNG TenKhach cua phieu (cong no khach nhom theo TEN, go lech dau/khoang trang la mat tien). */
async function chuanHoaPhieuThu(pool, b) {
  const out = {
    loai: b.loaiDoiTuong === 'Khac' ? 'Khac' : 'KhachHang',
    khachHangId: b.khachHangId || null,
    ten: (b.tenDoiTuong || '').trim() || null,
    phieuBHID: b.phieuBHID || null
  };
  if (out.phieuBHID) {
    const p = (await pool.request().input('id', sql.Int, out.phieuBHID)
      .query('SELECT TenKhach, KhachHangID, TrangThai FROM PhieuBanHang WHERE PhieuBHID=@id')).recordset[0];
    if (!p) return { loi: 'Phiếu bán hàng được gán không còn tồn tại.' };
    if (p.TrangThai === 'Đã hủy') return { loi: 'Phiếu bán hàng này ĐÃ HỦY — không gán phiếu thu vào được.' };
    out.loai = 'KhachHang';
    out.ten = String(p.TenKhach || '').trim();
    if (!out.khachHangId && p.KhachHangID) out.khachHangId = p.KhachHangID;
  }
  if (out.loai === 'KhachHang' && !out.ten) {
    return { loi: 'Thu của khách hàng thì phải có TÊN KHÁCH (công nợ nhóm theo tên khách).' };
  }
  if (out.loai !== 'KhachHang') out.khachHangId = null;
  return out;
}
/* Chuan hoa 1 phieu CHI: chi giu NCC_ID khi that su chi cho NHA CUNG CAP, giu NhaGiaCongID khi chi cho
   nha gia cong. Neu khong NULL hoa, form an o chon van gui id cu -> tien tra nha gia cong lai tru vao
   cong no NCC. */
function chuanLoaiPhieu(v) {
  const s = String(v || '').trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
  if (s === 'thu') return 'Thu';
  if (s === 'chi') return 'Chi';
  return 'Cả hai';
}
/* Tai khoan chon tren phieu phai DUNG loai phieu (thu / chi) - chan ca o backend, khong chi an tren form. */
async function kiemTaiKhoanTheoPhieu(pool, taiKhoanId, loaiPhieu) {
  if (!taiKhoanId) return null;
  if (!await coCotLoaiPhieu(pool)) return null;
  const r = (await pool.request().input('id', sql.Int, taiKhoanId).query(`
    SELECT tk.MaTK, tk.TenTK, ISNULL(l.LoaiPhieu, N'Cả hai') AS LoaiPhieu
    FROM DanhMucTaiKhoan tk LEFT JOIN DanhMucLoaiTaiKhoan l ON l.LoaiTKID = tk.LoaiTKID
    WHERE tk.TaiKhoanID = @id`)).recordset[0];
  if (!r) return 'Tài khoản không tồn tại.';
  /* v6.53: chi CHAN khi khai RO RANG la 'Thu' hoac 'Chi'. Moi gia tri khac ('Cả hai', 'Cả 2', rong,
     NULL du lieu cu...) deu coi la dung cho ca hai — khop voi tkTheoPhieu() ben frontend. */
  const lp = String(r.LoaiPhieu || '').trim();
  if ((lp === 'Thu' || lp === 'Chi') && lp !== loaiPhieu) {
    return `Tài khoản "${r.MaTK} - ${r.TenTK}" thuộc loại dùng cho PHIẾU ${lp.toUpperCase()}, không dùng cho phiếu ${loaiPhieu.toLowerCase()} được.`;
  }
  return null;
}
function chuanHoaPhieuChi(b) {
  const loai = ['NhaCungCap', 'NhaGiaCong', 'NhanVien', 'Khac'].includes(b.loaiDoiTuong) ? b.loaiDoiTuong : 'NhaCungCap';
  return {
    loai,
    nccId: loai === 'NhaCungCap' ? (b.nccId || null) : null,
    nhaGiaCongId: loai === 'NhaGiaCong' ? (b.nhaGiaCongId || null) : null
  };
}
/* v6.24: hinh thuc thanh toan + tai khoan ngan hang.
   - "Chuyển khoản" thi BAT BUOC chon so tai khoan (de so quy ngan hang biet tien vao/ra TK nao).
   - "Tiền mặt" thi NULL hoa TaiKhoanNHID (form an o chon van co the gui id cu). */
const HT_CHUYEN_THANG = 'Chuyển thẳng';
// v6.59: client CO gui truong nay khong? Gui roi thi ghi de (ke ca ghi ve rong); khong gui thi giu cu.
const coGui = (b, k) => Object.prototype.hasOwnProperty.call(b || {}, k) && (b || {})[k] !== undefined;
/* v6.54: do 1 lan roi nho — ban CSDL chua chay migration_v675 van chay binh thuong, chi la khong
   dung duoc "chuyen thang" (giong cach coCotLoaiPhieu/coBangTKNH da lam). */
let __coCotCT = null;
async function coCotChuyenThang(pool) {
  if (__coCotCT === null) {
    try {
      const r = (await pool.request().query(
        `SELECT COL_LENGTH('PhieuThu','PhieuChiKemID') AS t, COL_LENGTH('PhieuChi','PhieuThuKemID') AS c`)).recordset[0] || {};
      __coCotCT = r.t != null && r.c != null;
    } catch (e) { __coCotCT = false; }
  }
  return __coCotCT;
}
// Tra ve PhieuChiKemID cua 1 phieu thu (null neu khong phai cap chuyen thang / chua co cot).
async function phieuChiKem(pool, phieuThuId) {
  if (!await coCotChuyenThang(pool)) return null;
  const r = (await pool.request().input('id', sql.Int, phieuThuId)
    .query('SELECT PhieuChiKemID FROM PhieuThu WHERE PhieuThuID=@id')).recordset[0];
  return r ? r.PhieuChiKemID : null;
}
async function chuanHoaHinhThuc(pool, b) {
  const goc = String(b.hinhThuc || '').trim();
  /* v6.54: 'Chuyển thẳng' = tiền KHÔNG qua quỹ mình (khách trả thẳng cho NCC / trả hộ chi phí).
     Không cần số tài khoản ngân hàng vì mình không nhận tiền vào tài khoản nào cả. */
  if (goc === HT_CHUYEN_THANG) return { hinhThuc: HT_CHUYEN_THANG, tknh: null };
  const hinhThuc = goc === 'Chuyển khoản' ? 'Chuyển khoản' : 'Tiền mặt';
  if (hinhThuc !== 'Chuyển khoản') return { hinhThuc, tknh: null };
  if (!await coBangTKNH(pool)) return { hinhThuc, tknh: null };   // chua chay migration_v669
  const tknh = b.taiKhoanNHID ? Number(b.taiKhoanNHID) : null;
  if (!tknh) return { hinhThuc, tknh: null, loiNH: 'Chọn CHUYỂN KHOẢN thì phải chọn số tài khoản ngân hàng (Danh mục → Tài khoản ngân hàng).' };
  return { hinhThuc, tknh };
}
/* v6.25: cot LoaiPhieu cua LOAI tai khoan (Thu / Chi / Cả hai) - do 1 lan roi nho, de ban CSDL chua
   chay migration_v670 van chay binh thuong (khi do coi nhu moi loai dung cho ca 2 phieu). */
let __coCotLoaiPhieu = null;
async function coCotLoaiPhieu(pool) {
  if (__coCotLoaiPhieu === null) {
    try {
      const r = (await pool.request().query(`SELECT COL_LENGTH('DanhMucLoaiTaiKhoan','LoaiPhieu') AS c`)).recordset[0] || {};
      __coCotLoaiPhieu = r.c != null;
    } catch (e) { __coCotLoaiPhieu = false; }
  }
  return __coCotLoaiPhieu;
}
async function coCot(pool, bang, cot) {
  const r = (await pool.request().query(`SELECT COL_LENGTH('${bang}','${cot}') AS c`)).recordset[0] || {};
  return r.c != null;
}
/* So phieu PT/PC<yy><4 so> — chay suot ca nam (cung quy tac ma lenh SX v6.22 + phieu ban hang). */
async function sinhSoPhieu(pool, bang, cot, tienTo) {
  const yy = String(new Date().getFullYear()).slice(-2);
  const prefix = tienTo + yy;
  const rs = await pool.request().input('p', sql.NVarChar, prefix + '%')
    .query(`SELECT ${cot} AS S FROM ${bang} WHERE ${cot} LIKE @p`);
  const re = new RegExp('^' + tienTo + '(\\d{2})(\\d+)$');
  const nums = rs.recordset.map(r => {
    const m = re.exec(String(r.S || '').trim());
    return m && m[1] === yy ? parseInt(m[2], 10) || 0 : 0;
  });
  return prefix + String((nums.length ? Math.max(...nums) : 0) + 1).padStart(4, '0');
}

/* ================================================================================================
   1. DANH MUC LOAI TAI KHOAN  (co "tinh chi phi KD" hay khong)
   ================================================================================================ */
router.get('/loaitaikhoan', requireAuth, requirePermission('DANHMUC', 'view'), async (req, res) => {
  const pool = await getPool();
  const coLP = await coCotLoaiPhieu(pool);
  const rows = (await pool.request().query(
    `SELECT LoaiTKID, TenLoai, TinhChiPhiKD, GhiChu, ${coLP ? 'LoaiPhieu' : "CAST(N'Cả hai' AS NVARCHAR(10)) AS LoaiPhieu"}
     FROM DanhMucLoaiTaiKhoan ORDER BY TenLoai`)).recordset;
  res.json({ success: true, data: rows });
});
router.post('/loaitaikhoan', requireAuth, requirePermission('DANHMUC', 'create'), async (req, res) => {
  const pool = await getPool();
  const { TenLoai, TinhChiPhiKD, GhiChu, LoaiPhieu } = req.body || {};
  if (!String(TenLoai || '').trim()) return res.status(400).json({ success: false, message: 'Chưa nhập tên loại tài khoản.' });
  const coLP = await coCotLoaiPhieu(pool);
  await pool.request().input('t', sql.NVarChar, String(TenLoai).trim())
    .input('c', sql.Bit, so(TinhChiPhiKD) ? 1 : 0).input('g', sql.NVarChar, GhiChu || null)
    .input('lp', sql.NVarChar, chuanLoaiPhieu(LoaiPhieu))
    .query(`INSERT INTO DanhMucLoaiTaiKhoan (TenLoai, TinhChiPhiKD, GhiChu${coLP ? ', LoaiPhieu' : ''})
            VALUES (@t, @c, @g${coLP ? ', @lp' : ''})`);
  res.json({ success: true });
});
router.put('/loaitaikhoan/:id', requireAuth, requirePermission('DANHMUC', 'edit'), async (req, res) => {
  const pool = await getPool();
  const { TenLoai, TinhChiPhiKD, GhiChu, LoaiPhieu } = req.body || {};
  const coLP = await coCotLoaiPhieu(pool);
  await pool.request().input('id', sql.Int, req.params.id).input('t', sql.NVarChar, TenLoai)
    .input('c', sql.Bit, so(TinhChiPhiKD) ? 1 : 0).input('g', sql.NVarChar, GhiChu || null)
    .input('lp', sql.NVarChar, chuanLoaiPhieu(LoaiPhieu))
    .query(`UPDATE DanhMucLoaiTaiKhoan SET TenLoai=@t, TinhChiPhiKD=@c, GhiChu=@g${coLP ? ', LoaiPhieu=@lp' : ''} WHERE LoaiTKID=@id`);
  res.json({ success: true });
});
router.delete('/loaitaikhoan/:id', requireAuth, requirePermission('DANHMUC', 'delete'), async (req, res) => {
  const pool = await getPool();
  const dung = (await pool.request().input('id', sql.Int, req.params.id)
    .query('SELECT COUNT(*) AS C FROM DanhMucTaiKhoan WHERE LoaiTKID=@id')).recordset[0].C;
  if (dung > 0) return res.status(400).json({ success: false, message: `Không xóa được: còn ${dung} tài khoản thuộc loại này.` });
  await pool.request().input('id', sql.Int, req.params.id).query('DELETE FROM DanhMucLoaiTaiKhoan WHERE LoaiTKID=@id');
  res.json({ success: true });
});

/* ================================================================================================
   2. DANH MUC TAI KHOAN
   ================================================================================================ */
router.get('/taikhoan', requireAuth, requirePermission('DANHMUC', 'view'), async (req, res) => {
  const pool = await getPool();
  const coLP = await coCotLoaiPhieu(pool);
  const rows = (await pool.request().query(`
    SELECT tk.TaiKhoanID, tk.MaTK, tk.TenTK, tk.LoaiTKID, l.TenLoai, l.TinhChiPhiKD, tk.GhiChu,
           ${coLP ? "ISNULL(l.LoaiPhieu, N'Cả hai') AS LoaiPhieu" : "CAST(N'Cả hai' AS NVARCHAR(10)) AS LoaiPhieu"}
    FROM DanhMucTaiKhoan tk LEFT JOIN DanhMucLoaiTaiKhoan l ON l.LoaiTKID = tk.LoaiTKID
    ORDER BY tk.MaTK`)).recordset;
  res.json({ success: true, data: rows });
});
router.post('/taikhoan', requireAuth, requirePermission('DANHMUC', 'create'), async (req, res) => {
  const pool = await getPool();
  const { MaTK, TenTK, LoaiTKID, GhiChu } = req.body || {};
  if (!String(MaTK || '').trim() || !String(TenTK || '').trim()) {
    return res.status(400).json({ success: false, message: 'Cần Mã TK và Tên tài khoản.' });
  }
  await pool.request().input('m', sql.NVarChar, String(MaTK).trim().toUpperCase())
    .input('t', sql.NVarChar, String(TenTK).trim()).input('l', sql.Int, LoaiTKID || null)
    .input('g', sql.NVarChar, GhiChu || null)
    .query('INSERT INTO DanhMucTaiKhoan (MaTK, TenTK, LoaiTKID, GhiChu) VALUES (@m, @t, @l, @g)');
  res.json({ success: true });
});
router.put('/taikhoan/:id', requireAuth, requirePermission('DANHMUC', 'edit'), async (req, res) => {
  const pool = await getPool();
  const { MaTK, TenTK, LoaiTKID, GhiChu } = req.body || {};
  await pool.request().input('id', sql.Int, req.params.id)
    .input('m', sql.NVarChar, MaTK ? String(MaTK).trim().toUpperCase() : null)
    .input('t', sql.NVarChar, TenTK).input('l', sql.Int, LoaiTKID || null).input('g', sql.NVarChar, GhiChu || null)
    .query(`UPDATE DanhMucTaiKhoan SET MaTK=ISNULL(@m, MaTK), TenTK=@t, LoaiTKID=@l, GhiChu=@g WHERE TaiKhoanID=@id`);
  res.json({ success: true });
});
router.delete('/taikhoan/:id', requireAuth, requirePermission('DANHMUC', 'delete'), async (req, res) => {
  const pool = await getPool();
  const dungThu = (await pool.request().input('id', sql.Int, req.params.id).query('SELECT COUNT(*) AS C FROM PhieuThu WHERE TaiKhoanID=@id')).recordset[0].C;
  const dungChi = (await pool.request().input('id', sql.Int, req.params.id).query('SELECT COUNT(*) AS C FROM PhieuChi WHERE TaiKhoanID=@id')).recordset[0].C;
  if (dungThu + dungChi > 0) {
    return res.status(400).json({ success: false, message: `Không xóa được: đang dùng ở ${dungThu} phiếu thu và ${dungChi} phiếu chi.` });
  }
  await pool.request().input('id', sql.Int, req.params.id).query('DELETE FROM DanhMucTaiKhoan WHERE TaiKhoanID=@id');
  res.json({ success: true });
});

/* ================================================================================================
   2b. DANH MUC TAI KHOAN NGAN HANG (v6.24) — dung khi phieu thu/chi chon hinh thuc "Chuyển khoản"
   ================================================================================================ */
let __coBangTKNH = null;
async function coBangTKNH(pool) {
  if (__coBangTKNH === null) {
    try {
      const r = (await pool.request().query(`SELECT OBJECT_ID('dbo.DanhMucTaiKhoanNganHang') AS o`)).recordset[0] || {};
      __coBangTKNH = r.o != null;
    } catch (e) { __coBangTKNH = false; }
  }
  return __coBangTKNH;
}
router.get('/taikhoannganhang', requireAuth, requirePermission('DANHMUC', 'view'), async (req, res) => {
  const pool = await getPool();
  if (!await coBangTKNH(pool)) return res.json({ success: true, data: [], canhBao: 'Chưa chạy database/migration_v669.sql.' });
  const rows = (await pool.request().query(`
    SELECT TaiKhoanNHID, TenNganHang, SoTaiKhoan, ChuTaiKhoan, ChiNhanh, SoDuDauKy, MacDinh, GhiChu
    FROM DanhMucTaiKhoanNganHang ORDER BY MacDinh DESC, TenNganHang`)).recordset;
  res.json({ success: true, data: rows });
});
router.post('/taikhoannganhang', requireAuth, requirePermission('DANHMUC', 'create'), async (req, res) => {
  const pool = await getPool();
  const b = req.body || {};
  if (!String(b.TenNganHang || '').trim() || !String(b.SoTaiKhoan || '').trim()) {
    return res.status(400).json({ success: false, message: 'Cần Tên ngân hàng và Số tài khoản.' });
  }
  await pool.request()
    .input('t', sql.NVarChar, String(b.TenNganHang).trim()).input('s', sql.NVarChar, String(b.SoTaiKhoan).trim())
    .input('c', sql.NVarChar, b.ChuTaiKhoan || null).input('cn', sql.NVarChar, b.ChiNhanh || null)
    .input('sd', sql.Decimal(18, 2), so(b.SoDuDauKy)).input('md', sql.Bit, so(b.MacDinh) ? 1 : 0)
    .input('g', sql.NVarChar, b.GhiChu || null)
    .query(`INSERT INTO DanhMucTaiKhoanNganHang (TenNganHang, SoTaiKhoan, ChuTaiKhoan, ChiNhanh, SoDuDauKy, MacDinh, GhiChu)
            VALUES (@t, @s, @c, @cn, @sd, @md, @g)`);
  res.json({ success: true });
});
router.put('/taikhoannganhang/:id', requireAuth, requirePermission('DANHMUC', 'edit'), async (req, res) => {
  const pool = await getPool();
  const b = req.body || {};
  await pool.request().input('id', sql.Int, req.params.id)
    .input('t', sql.NVarChar, b.TenNganHang).input('s', sql.NVarChar, b.SoTaiKhoan)
    .input('c', sql.NVarChar, b.ChuTaiKhoan || null).input('cn', sql.NVarChar, b.ChiNhanh || null)
    .input('sd', sql.Decimal(18, 2), so(b.SoDuDauKy)).input('md', sql.Bit, so(b.MacDinh) ? 1 : 0)
    .input('g', sql.NVarChar, b.GhiChu || null)
    .query(`UPDATE DanhMucTaiKhoanNganHang SET TenNganHang=@t, SoTaiKhoan=@s, ChuTaiKhoan=@c,
              ChiNhanh=@cn, SoDuDauKy=@sd, MacDinh=@md, GhiChu=@g WHERE TaiKhoanNHID=@id`);
  res.json({ success: true });
});
router.delete('/taikhoannganhang/:id', requireAuth, requirePermission('DANHMUC', 'delete'), async (req, res) => {
  const pool = await getPool();
  const dungThu = (await pool.request().input('id', sql.Int, req.params.id).query('SELECT COUNT(*) AS C FROM PhieuThu WHERE TaiKhoanNHID=@id')).recordset[0].C;
  const dungChi = (await pool.request().input('id', sql.Int, req.params.id).query('SELECT COUNT(*) AS C FROM PhieuChi WHERE TaiKhoanNHID=@id')).recordset[0].C;
  if (dungThu + dungChi > 0) {
    return res.status(400).json({ success: false, message: `Không xóa được: đang dùng ở ${dungThu} phiếu thu và ${dungChi} phiếu chi.` });
  }
  await pool.request().input('id', sql.Int, req.params.id).query('DELETE FROM DanhMucTaiKhoanNganHang WHERE TaiKhoanNHID=@id');
  res.json({ success: true });
});

/* ================================================================================================
   3. PHIEU THU
   ================================================================================================ */
router.get('/phieuthu', requireAuth, requirePermission('CONGNO', 'view'), requireChucNang('CONGNO', 'phieuthu'), async (req, res) => {
  const pool = await getPool();
  const coNH = await coBangTKNH(pool);   // v6.24
  const rows = (await pool.request().query(`
    SELECT t.*, tk.MaTK, tk.TenTK, l.TenLoai AS TenLoaiTK, p.SoPhieu AS SoPhieuBH, u.HoTen AS NguoiTao
           ${coNH ? ', nh.TenNganHang, nh.SoTaiKhoan' : ''}
    FROM PhieuThu t
    ${coNH ? 'LEFT JOIN DanhMucTaiKhoanNganHang nh ON nh.TaiKhoanNHID = t.TaiKhoanNHID' : ''}
    LEFT JOIN DanhMucTaiKhoan tk ON tk.TaiKhoanID = t.TaiKhoanID
    LEFT JOIN DanhMucLoaiTaiKhoan l ON l.LoaiTKID = tk.LoaiTKID
    LEFT JOIN PhieuBanHang p ON p.PhieuBHID = t.PhieuBHID
    LEFT JOIN Users u ON u.UserID = t.NguoiTaoID
    ORDER BY t.NgayThu DESC, t.PhieuThuID DESC`)).recordset;
  res.json({ success: true, data: rows, soPhieuTiepTheo: await sinhSoPhieu(pool, 'PhieuThu', 'SoPhieu', 'PT') });
});
router.post('/phieuthu', requireAuth, requirePermission('CONGNO', 'create'), requireChucNang('CONGNO', 'phieuthu'), async (req, res) => {
  const pool = await getPool();
  const b = req.body || {};
  if (so(b.soTien) <= 0) return res.status(400).json({ success: false, message: 'Số tiền phải lớn hơn 0.' });
  const { hinhThuc, tknh, loiNH } = await chuanHoaHinhThuc(pool, b);
  if (loiNH) return res.status(400).json({ success: false, message: loiNH });
  const coNH = await coBangTKNH(pool);
  const loiTK = await kiemTaiKhoanTheoPhieu(pool, b.taiKhoanId, 'Thu');
  if (loiTK) return res.status(400).json({ success: false, message: loiTK });
  const ch = await chuanHoaPhieuThu(pool, b);
  if (ch.loi) return res.status(400).json({ success: false, message: ch.loi });
  const soPhieu = await sinhSoPhieu(pool, 'PhieuThu', 'SoPhieu', 'PT');
  const kq = await pool.request()
    .input('SoPhieu', sql.NVarChar, soPhieu)
    .input('NgayThu', sql.Date, b.ngay || new Date())
    .input('Loai', sql.NVarChar, ch.loai)
    .input('KhachHangID', sql.Int, ch.khachHangId)
    .input('Ten', sql.NVarChar, ch.ten)
    .input('TaiKhoanID', sql.Int, b.taiKhoanId || null)
    .input('PhieuBHID', sql.Int, ch.phieuBHID)
    .input('SoTien', sql.Decimal(18, 2), so(b.soTien))
    .input('HinhThuc', sql.NVarChar, hinhThuc)
    .input('DienGiai', sql.NVarChar, b.dienGiai || null)
    .input('NguoiTaoID', sql.Int, req.session.user.userId)
    .input('TaiKhoanNHID', sql.Int, tknh)
    .query(`INSERT INTO PhieuThu (SoPhieu, NgayThu, LoaiDoiTuong, KhachHangID, TenDoiTuong, TaiKhoanID,
              PhieuBHID, SoTien, HinhThuc, DienGiai, NguoiTaoID${coNH ? ', TaiKhoanNHID' : ''})
            OUTPUT INSERTED.PhieuThuID
            VALUES (@SoPhieu, @NgayThu, @Loai, @KhachHangID, @Ten, @TaiKhoanID,
              @PhieuBHID, @SoTien, @HinhThuc, @DienGiai, @NguoiTaoID${coNH ? ', @TaiKhoanNHID' : ''})`);
  const phieuThuId = (kq.recordset[0] || {}).PhieuThuID;

  /* v6.54: CHUYỂN THẲNG -> tự sinh PHIẾU CHI đi kèm, cùng ngày/số tiền/hình thức.
     Sổ quỹ cộng phiếu thu rồi trừ phiếu chi -> số dư KHÔNG đổi, mà công nợ hai đầu đều đúng và
     vẫn còn đủ chứng từ để đối chiếu. */
  let soPhieuChi = null;
  if (hinhThuc === HT_CHUYEN_THANG && await coCotChuyenThang(pool)) {
    const nccId = b.ctNccId ? Number(b.ctNccId) : null;
    const tkChi = b.ctTaiKhoanChiId ? Number(b.ctTaiKhoanChiId) : null;
    if (!nccId && !tkChi) {
      // Đã lỡ ghi phiếu thu -> gỡ luôn, không để lại phiếu thu "chuyển thẳng" mà chẳng chuyển cho ai.
      await pool.request().input('id', sql.Int, phieuThuId).query('DELETE FROM PhieuThu WHERE PhieuThuID=@id');
      return res.status(400).json({ success: false, message: 'Chọn "Chuyển thẳng" thì phải chọn Nhà cung cấp hoặc Loại chi phí nhận tiền.' });
    }
    const loiTKChi = await kiemTaiKhoanTheoPhieu(pool, tkChi, 'Chi');
    if (loiTKChi) {
      await pool.request().input('id', sql.Int, phieuThuId).query('DELETE FROM PhieuThu WHERE PhieuThuID=@id');
      return res.status(400).json({ success: false, message: loiTKChi });
    }
    let tenNhan = (b.ctTenDoiTuong || '').trim() || null;
    if (!tenNhan && nccId) {
      const n = (await pool.request().input('id', sql.Int, nccId).query('SELECT TenNCC FROM NhaCungCap WHERE NCC_ID=@id')).recordset[0];
      tenNhan = n ? n.TenNCC : null;
    }
    soPhieuChi = await sinhSoPhieu(pool, 'PhieuChi', 'SoPhieu', 'PC');
    const dienGiaiChi = `Khách "${ch.ten || ''}" chuyển thẳng theo phiếu thu ${soPhieu}`
      + (b.dienGiai ? ` — ${b.dienGiai}` : '');
    const kqChi = await pool.request()
      .input('SoPhieu', sql.NVarChar, soPhieuChi)
      .input('NgayChi', sql.Date, b.ngay || new Date())
      .input('Loai', sql.NVarChar, nccId ? 'NhaCungCap' : 'Khac')
      .input('NCC_ID', sql.Int, nccId)
      .input('Ten', sql.NVarChar, tenNhan)
      .input('TaiKhoanID', sql.Int, tkChi)
      .input('SoTien', sql.Decimal(18, 2), so(b.soTien))
      .input('HinhThuc', sql.NVarChar, HT_CHUYEN_THANG)
      .input('DienGiai', sql.NVarChar, dienGiaiChi)
      .input('NguoiTaoID', sql.Int, req.session.user.userId)
      .input('PhieuThuKemID', sql.Int, phieuThuId)
      .query(`INSERT INTO PhieuChi (SoPhieu, NgayChi, LoaiDoiTuong, NCC_ID, TenDoiTuong,
                TaiKhoanID, SoTien, HinhThuc, DienGiai, NguoiTaoID, PhieuThuKemID)
              OUTPUT INSERTED.PhieuChiID
              VALUES (@SoPhieu, @NgayChi, @Loai, @NCC_ID, @Ten,
                @TaiKhoanID, @SoTien, @HinhThuc, @DienGiai, @NguoiTaoID, @PhieuThuKemID)`);
    await pool.request()
      .input('id', sql.Int, phieuThuId)
      .input('pc', sql.Int, (kqChi.recordset[0] || {}).PhieuChiID)
      .query('UPDATE PhieuThu SET PhieuChiKemID=@pc WHERE PhieuThuID=@id');
  }
  res.json({ success: true, data: { soPhieu, soPhieuChi } });
});
router.put('/phieuthu/:id', requireAuth, requirePermission('CONGNO', 'edit'), requireChucNang('CONGNO', 'phieuthu'), async (req, res) => {
  const pool = await getPool();
  const b = req.body || {};
  /* v6.54: phiếu thu CHUYỂN THẲNG đi theo cặp với 1 phiếu chi. Cho sửa tay ở đây thì phải đồng bộ
     ngày/số tiền/đối tượng sang phiếu chi kia — sót một trường là hai phiếu lệch nhau, sổ quỹ hết
     triệt tiêu và công nợ NCC sai. Chặn lại và chỉ đường XÓA rồi LẬP LẠI: xóa đã tự gỡ cả cặp. */
  if (await phieuChiKem(pool, req.params.id)) {
    return res.status(400).json({ success: false,
      message: 'Phiếu thu CHUYỂN THẲNG đi kèm một phiếu chi. Muốn sửa thì XÓA phiếu thu này (phiếu chi đi kèm tự mất) rồi lập lại.' });
  }
  if (so(b.soTien) <= 0) return res.status(400).json({ success: false, message: 'Số tiền phải lớn hơn 0.' });
  const { hinhThuc, tknh, loiNH } = await chuanHoaHinhThuc(pool, b);
  if (loiNH) return res.status(400).json({ success: false, message: loiNH });
  const coNH = await coBangTKNH(pool);
  const loiTK = await kiemTaiKhoanTheoPhieu(pool, b.taiKhoanId, 'Thu');
  if (loiTK) return res.status(400).json({ success: false, message: loiTK });
  const ch = await chuanHoaPhieuThu(pool, b);
  if (ch.loi) return res.status(400).json({ success: false, message: ch.loi });
  await pool.request().input('id', sql.Int, req.params.id)
    .input('NgayThu', sql.Date, b.ngay || new Date())
    .input('Loai', sql.NVarChar, ch.loai)
    .input('KhachHangID', sql.Int, ch.khachHangId)
    .input('Ten', sql.NVarChar, ch.ten)
    .input('TaiKhoanID', sql.Int, b.taiKhoanId || null)
    .input('PhieuBHID', sql.Int, ch.phieuBHID)
    .input('SoTien', sql.Decimal(18, 2), so(b.soTien))
    .input('HinhThuc', sql.NVarChar, hinhThuc)
    .input('DienGiai', sql.NVarChar, b.dienGiai || null)
    .input('TaiKhoanNHID', sql.Int, tknh)
    /* v6.59: trường nào client KHÔNG gửi thì GIỮ NGUYÊN (ISNULL), gửi rồi mới ghi đè — kể cả ghi về
       rỗng. Form hiện gửi đủ nên chưa lộ, nhưng chỉ cần một chỗ gọi API thiếu một trường là cột đó
       về NULL: mất tài khoản, mất liên kết phiếu bán hàng, mất diễn giải. */
    .query(`UPDATE PhieuThu SET NgayThu=@NgayThu, LoaiDoiTuong=@Loai, KhachHangID=@KhachHangID,
              TenDoiTuong=@Ten, SoTien=@SoTien, HinhThuc=@HinhThuc,
              ${coGui(b, 'taiKhoanId') ? 'TaiKhoanID=@TaiKhoanID' : 'TaiKhoanID=ISNULL(@TaiKhoanID, TaiKhoanID)'},
              ${coGui(b, 'phieuBHID') ? 'PhieuBHID=@PhieuBHID' : 'PhieuBHID=ISNULL(@PhieuBHID, PhieuBHID)'},
              ${coGui(b, 'dienGiai') ? 'DienGiai=@DienGiai' : 'DienGiai=ISNULL(@DienGiai, DienGiai)'}
              ${coNH ? (coGui(b, 'taiKhoanNHID') ? ', TaiKhoanNHID=@TaiKhoanNHID' : ', TaiKhoanNHID=ISNULL(@TaiKhoanNHID, TaiKhoanNHID)') : ''}
            WHERE PhieuThuID=@id`);
  res.json({ success: true });
});
router.delete('/phieuthu/:id', requireAuth, requirePermission('CONGNO', 'delete'), requireChucNang('CONGNO', 'phieuthu'), async (req, res) => {
  const pool = await getPool();
  /* v6.54: xóa phiếu thu CHUYỂN THẲNG thì xóa LUÔN phiếu chi đi kèm. Để lại phiếu chi mồ côi là
     công nợ NCC bị giảm bởi một khoản không còn nguồn — kiểu lệch không ai tự tìm ra. */
  const pcId = await phieuChiKem(pool, req.params.id);
  if (pcId) await pool.request().input('pc', sql.Int, pcId).query('DELETE FROM PhieuChi WHERE PhieuChiID=@pc');
  await pool.request().input('id', sql.Int, req.params.id).query('DELETE FROM PhieuThu WHERE PhieuThuID=@id');
  res.json({ success: true, data: { daXoaPhieuChiKem: !!pcId } });
});

/* ================================================================================================
   4. PHIEU CHI
   ================================================================================================ */
router.get('/phieuchi', requireAuth, requirePermission('CONGNO', 'view'), requireChucNang('CONGNO', 'phieuchi'), async (req, res) => {
  const pool = await getPool();
  const coNH = await coBangTKNH(pool);   // v6.24
  const rows = (await pool.request().query(`
    SELECT c.*, tk.MaTK, tk.TenTK, l.TenLoai AS TenLoaiTK, l.TinhChiPhiKD,
           ncc.TenNCC, ngc.TenNha AS TenNhaGiaCong, u.HoTen AS NguoiTao
           ${coNH ? ', nh.TenNganHang, nh.SoTaiKhoan' : ''}
    FROM PhieuChi c
    ${coNH ? 'LEFT JOIN DanhMucTaiKhoanNganHang nh ON nh.TaiKhoanNHID = c.TaiKhoanNHID' : ''}
    LEFT JOIN DanhMucTaiKhoan tk ON tk.TaiKhoanID = c.TaiKhoanID
    LEFT JOIN DanhMucLoaiTaiKhoan l ON l.LoaiTKID = tk.LoaiTKID
    LEFT JOIN NhaCungCap ncc ON ncc.NCC_ID = c.NCC_ID
    LEFT JOIN NhaGiaCong ngc ON ngc.NhaGiaCongID = c.NhaGiaCongID
    LEFT JOIN Users u ON u.UserID = c.NguoiTaoID
    ORDER BY c.NgayChi DESC, c.PhieuChiID DESC`)).recordset;
  res.json({ success: true, data: rows, soPhieuTiepTheo: await sinhSoPhieu(pool, 'PhieuChi', 'SoPhieu', 'PC') });
});
router.post('/phieuchi', requireAuth, requirePermission('CONGNO', 'create'), requireChucNang('CONGNO', 'phieuchi'), async (req, res) => {
  const pool = await getPool();
  const b = req.body || {};
  if (so(b.soTien) <= 0) return res.status(400).json({ success: false, message: 'Số tiền phải lớn hơn 0.' });
  const { hinhThuc, tknh, loiNH } = await chuanHoaHinhThuc(pool, b);
  if (loiNH) return res.status(400).json({ success: false, message: loiNH });
  const coNH = await coBangTKNH(pool);
  const loiTK = await kiemTaiKhoanTheoPhieu(pool, b.taiKhoanId, 'Chi');
  if (loiTK) return res.status(400).json({ success: false, message: loiTK });
  const chC = chuanHoaPhieuChi(b);
  const soPhieu = await sinhSoPhieu(pool, 'PhieuChi', 'SoPhieu', 'PC');
  await pool.request()
    .input('SoPhieu', sql.NVarChar, soPhieu)
    .input('NgayChi', sql.Date, b.ngay || new Date())
    .input('Loai', sql.NVarChar, chC.loai)
    .input('NCC_ID', sql.Int, chC.nccId)
    .input('NhaGiaCongID', sql.Int, chC.nhaGiaCongId)
    .input('Ten', sql.NVarChar, (b.tenDoiTuong || '').trim() || null)
    .input('TaiKhoanID', sql.Int, b.taiKhoanId || null)
    .input('SoTien', sql.Decimal(18, 2), so(b.soTien))
    .input('HinhThuc', sql.NVarChar, hinhThuc)
    .input('DienGiai', sql.NVarChar, b.dienGiai || null)
    .input('NguoiTaoID', sql.Int, req.session.user.userId)
    .input('TaiKhoanNHID', sql.Int, tknh)
    .query(`INSERT INTO PhieuChi (SoPhieu, NgayChi, LoaiDoiTuong, NCC_ID, NhaGiaCongID, TenDoiTuong,
              TaiKhoanID, SoTien, HinhThuc, DienGiai, NguoiTaoID${coNH ? ', TaiKhoanNHID' : ''})
            VALUES (@SoPhieu, @NgayChi, @Loai, @NCC_ID, @NhaGiaCongID, @Ten,
              @TaiKhoanID, @SoTien, @HinhThuc, @DienGiai, @NguoiTaoID${coNH ? ', @TaiKhoanNHID' : ''})`);
  res.json({ success: true, data: { soPhieu } });
});
/* v6.54: phiếu chi SINH RA TỪ phiếu thu chuyển thẳng không được sửa/xóa từ phía này — mọi thao tác
   phải làm ở phiếu thu để cả cặp đi cùng nhau. */
async function chanPhieuChiKem(pool, phieuChiId) {
  if (!await coCotChuyenThang(pool)) return null;
  const r = (await pool.request().input('id', sql.Int, phieuChiId)
    .query('SELECT PhieuThuKemID FROM PhieuChi WHERE PhieuChiID=@id')).recordset[0];
  if (!r || !r.PhieuThuKemID) return null;
  const t = (await pool.request().input('id', sql.Int, r.PhieuThuKemID)
    .query('SELECT SoPhieu FROM PhieuThu WHERE PhieuThuID=@id')).recordset[0];
  return `Phiếu chi này do phiếu thu CHUYỂN THẲNG ${t ? t.SoPhieu : ''} sinh ra. Muốn sửa hoặc xóa thì thao tác trên phiếu thu đó — cả cặp sẽ đi cùng nhau.`;
}
router.put('/phieuchi/:id', requireAuth, requirePermission('CONGNO', 'edit'), requireChucNang('CONGNO', 'phieuchi'), async (req, res) => {
  const pool = await getPool();
  const b = req.body || {};
  const chan = await chanPhieuChiKem(pool, req.params.id);
  if (chan) return res.status(400).json({ success: false, message: chan });
  if (so(b.soTien) <= 0) return res.status(400).json({ success: false, message: 'Số tiền phải lớn hơn 0.' });
  const { hinhThuc, tknh, loiNH } = await chuanHoaHinhThuc(pool, b);
  if (loiNH) return res.status(400).json({ success: false, message: loiNH });
  const coNH = await coBangTKNH(pool);
  const loiTK = await kiemTaiKhoanTheoPhieu(pool, b.taiKhoanId, 'Chi');
  if (loiTK) return res.status(400).json({ success: false, message: loiTK });
  const chC = chuanHoaPhieuChi(b);
  await pool.request().input('id', sql.Int, req.params.id)
    .input('NgayChi', sql.Date, b.ngay || new Date())
    .input('Loai', sql.NVarChar, chC.loai)
    .input('NCC_ID', sql.Int, chC.nccId)
    .input('NhaGiaCongID', sql.Int, chC.nhaGiaCongId)
    .input('Ten', sql.NVarChar, (b.tenDoiTuong || '').trim() || null)
    .input('TaiKhoanID', sql.Int, b.taiKhoanId || null)
    .input('SoTien', sql.Decimal(18, 2), so(b.soTien))
    .input('HinhThuc', sql.NVarChar, hinhThuc)
    .input('DienGiai', sql.NVarChar, b.dienGiai || null)
    .input('TaiKhoanNHID', sql.Int, tknh)
    // v6.59: xem ghi chú ở PUT /phieuthu/:id — không gửi thì giữ nguyên, gửi rồi mới ghi đè.
    .query(`UPDATE PhieuChi SET NgayChi=@NgayChi, LoaiDoiTuong=@Loai, NCC_ID=@NCC_ID,
              NhaGiaCongID=@NhaGiaCongID, TenDoiTuong=@Ten, SoTien=@SoTien, HinhThuc=@HinhThuc,
              ${coGui(b, 'taiKhoanId') ? 'TaiKhoanID=@TaiKhoanID' : 'TaiKhoanID=ISNULL(@TaiKhoanID, TaiKhoanID)'},
              ${coGui(b, 'dienGiai') ? 'DienGiai=@DienGiai' : 'DienGiai=ISNULL(@DienGiai, DienGiai)'}
              ${coNH ? (coGui(b, 'taiKhoanNHID') ? ', TaiKhoanNHID=@TaiKhoanNHID' : ', TaiKhoanNHID=ISNULL(@TaiKhoanNHID, TaiKhoanNHID)') : ''}
            WHERE PhieuChiID=@id`);
  res.json({ success: true });
});
router.delete('/phieuchi/:id', requireAuth, requirePermission('CONGNO', 'delete'), requireChucNang('CONGNO', 'phieuchi'), async (req, res) => {
  const pool = await getPool();
  const chan = await chanPhieuChiKem(pool, req.params.id);   // v6.54
  if (chan) return res.status(400).json({ success: false, message: chan });
  await pool.request().input('id', sql.Int, req.params.id).query('DELETE FROM PhieuChi WHERE PhieuChiID=@id');
  res.json({ success: true });
});

/* ================================================================================================
   5. DIEU CHINH CONG NO (nhap tay: no dau ky, tien gia cong / in theu, giam gia...)
   ================================================================================================ */
router.get('/dieuchinh', requireAuth, requirePermission('CONGNO', 'view'), async (req, res) => {
  const pool = await getPool();
  const rows = (await pool.request().query(`
    SELECT d.*, ncc.TenNCC, kh.TenKhachHang, u.HoTen AS NguoiTao
    FROM CongNoDieuChinh d
    LEFT JOIN NhaCungCap ncc ON ncc.NCC_ID = d.NCC_ID
    LEFT JOIN KhachHang kh ON kh.KhachHangID = d.KhachHangID
    LEFT JOIN Users u ON u.UserID = d.NguoiTaoID
    ORDER BY d.Ngay DESC, d.ID DESC`)).recordset;
  res.json({ success: true, data: rows });
});
router.post('/dieuchinh', requireAuth, requirePermission('CONGNO', 'create'), async (req, res) => {
  const pool = await getPool();
  const b = req.body || {};
  if (!so(b.soTien)) return res.status(400).json({ success: false, message: 'Số tiền phải khác 0 (dương = tăng nợ, âm = giảm nợ).' });
  const loai = b.loaiDoiTuong === 'KhachHang' ? 'KhachHang' : 'NhaCungCap';
  await pool.request()
    .input('Ngay', sql.Date, b.ngay || new Date())
    .input('Loai', sql.NVarChar, loai)
    .input('KhachHangID', sql.Int, loai === 'KhachHang' ? (b.khachHangId || null) : null)
    .input('NCC_ID', sql.Int, loai === 'NhaCungCap' ? (b.nccId || null) : null)
    .input('Ten', sql.NVarChar, (b.tenDoiTuong || '').trim() || null)
    .input('SoTien', sql.Decimal(18, 2), so(b.soTien))
    .input('DienGiai', sql.NVarChar, b.dienGiai || null)
    .input('NguoiTaoID', sql.Int, req.session.user.userId)
    .query(`INSERT INTO CongNoDieuChinh (Ngay, LoaiDoiTuong, KhachHangID, NCC_ID, TenDoiTuong, SoTien, DienGiai, NguoiTaoID)
            VALUES (@Ngay, @Loai, @KhachHangID, @NCC_ID, @Ten, @SoTien, @DienGiai, @NguoiTaoID)`);
  res.json({ success: true });
});
/* v6.45: SỬA điều chỉnh. Trước chỉ có Thêm/Xóa — gõ sai một con số là phải xóa rồi nhập lại, mất
   luôn người tạo và thứ tự bản ghi. Cùng bộ kiểm tra với POST (số tiền khác 0, loại đối tượng hợp lệ,
   dọn khóa nối của loại KHÔNG được chọn về NULL để không còn dính đối tượng cũ khi đổi loại). */
router.put('/dieuchinh/:id', requireAuth, requirePermission('CONGNO', 'edit'), async (req, res) => {
  const pool = await getPool();
  const b = req.body || {};
  if (!so(b.soTien)) return res.status(400).json({ success: false, message: 'Số tiền phải khác 0 (dương = tăng nợ, âm = giảm nợ).' });
  const loai = b.loaiDoiTuong === 'KhachHang' ? 'KhachHang' : 'NhaCungCap';
  const r = await pool.request()
    .input('id', sql.Int, req.params.id)
    .input('Ngay', sql.Date, b.ngay || new Date())
    .input('Loai', sql.NVarChar, loai)
    .input('KhachHangID', sql.Int, loai === 'KhachHang' ? (b.khachHangId || null) : null)
    .input('NCC_ID', sql.Int, loai === 'NhaCungCap' ? (b.nccId || null) : null)
    .input('Ten', sql.NVarChar, (b.tenDoiTuong || '').trim() || null)
    .input('SoTien', sql.Decimal(18, 2), so(b.soTien))
    .input('DienGiai', sql.NVarChar, b.dienGiai || null)
    .query(`UPDATE CongNoDieuChinh
               SET Ngay=@Ngay, LoaiDoiTuong=@Loai, KhachHangID=@KhachHangID, NCC_ID=@NCC_ID,
                   TenDoiTuong=@Ten, SoTien=@SoTien, DienGiai=@DienGiai
             WHERE ID=@id`);
  if (!r.rowsAffected[0]) return res.status(404).json({ success: false, message: 'Không tìm thấy điều chỉnh này (có thể vừa bị xóa).' });
  res.json({ success: true });
});
router.delete('/dieuchinh/:id', requireAuth, requirePermission('CONGNO', 'delete'), async (req, res) => {
  const pool = await getPool();
  await pool.request().input('id', sql.Int, req.params.id).query('DELETE FROM CongNoDieuChinh WHERE ID=@id');
  res.json({ success: true });
});

/* ================================================================================================
   6. CONG NO KHACH HANG  (nhom theo TEN KHACH)
   ================================================================================================ */
async function congNoKhachHang(pool) {
  const ban = (await pool.request().query(`
    SELECT LTRIM(RTRIM(TenKhach)) AS Ten, SUM(TongThanhToan) AS PhaiThu, COUNT(*) AS SoPhieu,
           MAX(NgayBan) AS LanCuoi
    FROM PhieuBanHang WHERE TrangThai <> N'Đã hủy'
    GROUP BY LTRIM(RTRIM(TenKhach))`)).recordset;
  const thu = (await pool.request().query(`
    SELECT LTRIM(RTRIM(ISNULL(TenDoiTuong, ''))) AS Ten, SUM(SoTien) AS DaThu, COUNT(*) AS SoPhieuThu
    FROM PhieuThu WHERE LoaiDoiTuong = N'KhachHang'
    GROUP BY LTRIM(RTRIM(ISNULL(TenDoiTuong, '')))`)).recordset;
  const dc = (await pool.request().query(`
    SELECT LTRIM(RTRIM(ISNULL(TenDoiTuong, ''))) AS Ten, SUM(SoTien) AS DieuChinh
    FROM CongNoDieuChinh WHERE LoaiDoiTuong = N'KhachHang'
    GROUP BY LTRIM(RTRIM(ISNULL(TenDoiTuong, '')))`)).recordset;
  /* v6.66: PHIEU NHAP LAI (hang khach tra) -> GIAM cong no. Bang moi nen do ton tai truoc, khong thi
     he thong chua chay migration_v676 se trang ca man cong no. */
  let traLai = [];
  try {
    traLai = (await pool.request().query(`
      SELECT LTRIM(RTRIM(TenKhach)) AS Ten, SUM(TongThanhToan) AS TraLai, COUNT(*) AS SoPhieuTraLai
      FROM PhieuNhapLai WHERE TrangThai <> N'Đã hủy'
      GROUP BY LTRIM(RTRIM(TenKhach))`)).recordset;
  } catch (err) {
    console.warn('[congno congNoKhachHang] chua co bang PhieuNhapLai (migration_v676) - bo qua phan tra lai:', err.message);
  }
  const map = new Map();
  const lay = t => {
    const k = t || '(không tên)';
    if (!map.has(k)) map.set(k, { TenKhach: k, PhaiThu: 0, DaThu: 0, DieuChinh: 0, TraLai: 0, SoPhieu: 0, SoPhieuThu: 0, SoPhieuTraLai: 0, LanCuoi: null });
    return map.get(k);
  };
  ban.forEach(r => { const x = lay(r.Ten); x.PhaiThu += so(r.PhaiThu); x.SoPhieu += r.SoPhieu; x.LanCuoi = r.LanCuoi; });
  thu.forEach(r => { const x = lay(r.Ten); x.DaThu += so(r.DaThu); x.SoPhieuThu += r.SoPhieuThu; });
  dc.forEach(r => { const x = lay(r.Ten); x.DieuChinh += so(r.DieuChinh); });
  traLai.forEach(r => { const x = lay(r.Ten); x.TraLai += so(r.TraLai); x.SoPhieuTraLai += r.SoPhieuTraLai; });
  return [...map.values()].map(x => ({ ...x, ConNo: Math.round((x.PhaiThu + x.DieuChinh - x.DaThu - x.TraLai) * 100) / 100 }))
    .sort((a, b) => b.ConNo - a.ConNo || String(a.TenKhach).localeCompare(String(b.TenKhach), 'vi'));
}
router.get('/congnokh', requireAuth, requirePermission('CONGNO', 'view'), requireChucNang('CONGNO', 'congnokh'), async (req, res) => {
  const pool = await getPool();
  res.json({ success: true, data: await congNoKhachHang(pool) });
});
/* So chi tiet cong no 1 khach: phieu ban hang + phieu thu + dieu chinh.
   v6.47: tach thanh HAM RIENG de route xem va route xuat Excel dung CHUNG mot ban - hai ban tinh
   rieng se troi khoi nhau (bai hoc "Dat hang nhanh" v6.44).
   v6.47: tra ve NGAY MOI NHAT LEN TRUOC. Luu y: LUY KE VAN PHAI TINH TU CU DEN MOI roi moi lat
   nguoc - tinh trong khi da dao chieu se ra so vo nghia. */
async function soChiTietKH(pool, ten) {
  const rq = () => pool.request().input('k', sql.NVarChar, ten);
  const ban = (await rq().query(`
    SELECT NgayBan AS Ngay, SoPhieu, TongThanhToan AS PhatSinh, 0 AS ThanhToan, N'Phiếu bán hàng' AS Loai, GhiChu AS DienGiai, PhieuBHID,
           N'PBH' AS CtLoai, PhieuBHID AS CtID
    FROM PhieuBanHang WHERE LTRIM(RTRIM(TenKhach)) = @k AND TrangThai <> N'Đã hủy'`)).recordset;
  const thu = (await rq().query(`
    SELECT NgayThu AS Ngay, SoPhieu, 0 AS PhatSinh, SoTien AS ThanhToan, N'Phiếu thu' AS Loai, DienGiai, PhieuBHID,
           N'PT' AS CtLoai, PhieuThuID AS CtID
    FROM PhieuThu WHERE LoaiDoiTuong = N'KhachHang' AND LTRIM(RTRIM(ISNULL(TenDoiTuong,''))) = @k`)).recordset;
  const dc = (await rq().query(`
    SELECT Ngay, N'' AS SoPhieu, SoTien AS PhatSinh, 0 AS ThanhToan, N'Điều chỉnh' AS Loai, DienGiai, NULL AS PhieuBHID,
           NULL AS CtLoai, NULL AS CtID
    FROM CongNoDieuChinh WHERE LoaiDoiTuong = N'KhachHang' AND LTRIM(RTRIM(ISNULL(TenDoiTuong,''))) = @k`)).recordset;
  /* v6.66: PHIEU NHAP LAI ghi PHAT SINH AM (giam no), KHONG ghi vao cot Thanh toan - cot do la
     TIEN khach da tra, tron vao se lam sai bao cao thu tien. */
  let traLai = [];
  try {
    traLai = (await rq().query(`
      SELECT NgayNhap AS Ngay, SoPhieu, -TongThanhToan AS PhatSinh, 0 AS ThanhToan,
             N'Phiếu nhập lại' AS Loai, ISNULL(LyDo, GhiChu) AS DienGiai, PhieuBHID,
             N'PNL' AS CtLoai, PhieuNLID AS CtID
      FROM PhieuNhapLai WHERE LTRIM(RTRIM(TenKhach)) = @k AND TrangThai <> N'Đã hủy'`)).recordset;
  } catch (err) {
    console.warn('[congno soChiTietKH] chua co bang PhieuNhapLai (migration_v676):', err.message);
  }
  const rows = [...ban, ...thu, ...dc, ...traLai].sort((a, b) => new Date(a.Ngay) - new Date(b.Ngay));
  let luy = 0;
  rows.forEach(r => { luy += so(r.PhatSinh) - so(r.ThanhToan); r.LuyKe = Math.round(luy * 100) / 100; });
  return { khach: ten, rows: rows.slice().reverse(), conNo: Math.round(luy * 100) / 100 };
}
router.get('/congnokh/chitiet', requireAuth, requirePermission('CONGNO', 'view'), requireChucNang('CONGNO', 'congnokh'), async (req, res) => {
  const pool = await getPool();
  const ten = String(req.query.khach || '').trim();
  if (!ten) return res.status(400).json({ success: false, message: 'Thiếu tên khách.' });
  res.json({ success: true, data: await soChiTietKH(pool, ten) });
});

/* ================================================================================================
   7. CONG NO NHA CUNG CAP  (tu dong tu phieu nhap VAI + PHU KIEN, tru phieu chi, cong dieu chinh)
   ================================================================================================ */
async function congNoNCC(pool) {
  const coGiaVai = await coCot(pool, 'VaiCay', 'DonGiaNhap');
  const coGiaPK = await coCot(pool, 'PhieuPhuKienChiTiet', 'DonGia');
  const vai = coGiaVai ? (await pool.request().query(`
    SELECT pn.NCC_ID, SUM(ISNULL(vc.KGNhap,0) * ISNULL(vc.DonGiaNhap,0)) AS Tien, COUNT(DISTINCT pn.PhieuNhapID) AS SoPhieu
    FROM PhieuNhapVai pn JOIN VaiCay vc ON vc.PhieuNhapID = pn.PhieuNhapID
    WHERE pn.NCC_ID IS NOT NULL GROUP BY pn.NCC_ID`)).recordset : [];
  const pk = coGiaPK ? (await pool.request().query(`
    SELECT p.NCC_ID, SUM(ISNULL(ct.SoLuong,0) * ISNULL(ct.DonGia,0)) AS Tien, COUNT(DISTINCT p.PhieuID) AS SoPhieu
    FROM PhieuPhuKien p JOIN PhieuPhuKienChiTiet ct ON ct.PhieuID = p.PhieuID
    WHERE p.LoaiPhieu = N'Nhập' AND p.NCC_ID IS NOT NULL GROUP BY p.NCC_ID`)).recordset : [];
  const chi = (await pool.request().query(`
    SELECT NCC_ID, SUM(SoTien) AS Tien, COUNT(*) AS SoPhieu FROM PhieuChi
    WHERE NCC_ID IS NOT NULL AND LoaiDoiTuong = N'NhaCungCap' GROUP BY NCC_ID`)).recordset;
  const dc = (await pool.request().query(`
    SELECT NCC_ID, SUM(SoTien) AS Tien FROM CongNoDieuChinh
    WHERE LoaiDoiTuong = N'NhaCungCap' AND NCC_ID IS NOT NULL GROUP BY NCC_ID`)).recordset;
  /* v6.66: TRA HANG VE NCC -> GIAM no phai tra.
     Vai:      don gia lay VaiCay.DonGiaNhap cua chinh cay do -> khong ai phai go, khong the lech
               voi luc nhap.
     Phu kien: PhieuPhuKienChiTiet.DonGia (form Xuat mo cot nay khi tich "Tra NCC").
     Co LaTraNCC do migration_v676 them - do cot truoc, chua chay migration thi coi nhu khong co. */
  const coTraVai = await coCot(pool, 'PhieuXuatVai', 'LaTraNCC');
  const coTraPK = await coCot(pool, 'PhieuPhuKien', 'LaTraNCC');
  const traVai = (coTraVai && coGiaVai) ? (await pool.request().query(`
    SELECT px.NCC_ID, SUM(ISNULL(ct.KGXuat,0) * ISNULL(vc.DonGiaNhap,0)) AS Tien,
           COUNT(DISTINCT px.PhieuXuatID) AS SoPhieu
    FROM PhieuXuatVai px
    JOIN PhieuXuatVaiChiTiet ct ON ct.PhieuXuatID = px.PhieuXuatID
    JOIN VaiCay vc ON vc.CayID = ct.CayID
    WHERE px.LaTraNCC = 1 AND px.NCC_ID IS NOT NULL GROUP BY px.NCC_ID`)).recordset : [];
  const traPK = (coTraPK && coGiaPK) ? (await pool.request().query(`
    SELECT p.NCC_ID, SUM(ISNULL(ct.SoLuong,0) * ISNULL(ct.DonGia,0)) AS Tien,
           COUNT(DISTINCT p.PhieuID) AS SoPhieu
    FROM PhieuPhuKien p JOIN PhieuPhuKienChiTiet ct ON ct.PhieuID = p.PhieuID
    WHERE p.LoaiPhieu = N'Xuất' AND p.LaTraNCC = 1 AND p.NCC_ID IS NOT NULL GROUP BY p.NCC_ID`)).recordset : [];
  /* v6.78: NHAP KHO HANG HOA tu NCC -> TANG no phai tra (giong nhap vai / nhap phu kien).
     Bang PhieuNhapKhoHang do migration_v681 tao - do bang truoc, chua chay migration thi bo qua
     phan nay chu KHONG lam vo ca man cong no. */
  let coBangNKH = false;
  try {
    coBangNKH = (await pool.request().query(`SELECT OBJECT_ID('PhieuNhapKhoHang') AS c`)).recordset[0].c != null;
  } catch (e) { coBangNKH = false; }
  const nhapHH = coBangNKH ? (await pool.request().query(`
    SELECT p.NCC_ID, SUM(ISNULL(p.TongTien, 0)) AS Tien, COUNT(*) AS SoPhieu
    FROM PhieuNhapKhoHang p
    WHERE p.LoaiNhap = N'NhaCungCap' AND p.NCC_ID IS NOT NULL AND p.TrangThai <> N'Đã hủy'
    GROUP BY p.NCC_ID`)).recordset : [];
  const ncc = (await pool.request().query('SELECT NCC_ID, TenNCC FROM NhaCungCap ORDER BY TenNCC')).recordset;

  const g = (arr, id) => so((arr.find(x => x.NCC_ID === id) || {}).Tien);
  const gp = (arr, id) => so((arr.find(x => x.NCC_ID === id) || {}).SoPhieu);
  const rows = ncc.map(n => {
    const tienVai = g(vai, n.NCC_ID), tienPK = g(pk, n.NCC_ID), dieuChinh = g(dc, n.NCC_ID), daTra = g(chi, n.NCC_ID);
    const traLai = g(traVai, n.NCC_ID) + g(traPK, n.NCC_ID);
    const tienHH = g(nhapHH, n.NCC_ID);                  // v6.78: nhap kho hang hoa tu NCC
    const phaiTra = tienVai + tienPK + tienHH + dieuChinh - traLai;
    return {
      NCC_ID: n.NCC_ID, TenNCC: n.TenNCC,
      TienVai: Math.round(tienVai * 100) / 100, TienPhuKien: Math.round(tienPK * 100) / 100,
      TienHangHoa: Math.round(tienHH * 100) / 100,
      DieuChinh: Math.round(dieuChinh * 100) / 100, TraLai: Math.round(traLai * 100) / 100,
      PhaiTra: Math.round(phaiTra * 100) / 100, DaTra: Math.round(daTra * 100) / 100,
      ConNo: Math.round((phaiTra - daTra) * 100) / 100,
      SoPhieuNhapVai: gp(vai, n.NCC_ID), SoPhieuNhapPK: gp(pk, n.NCC_ID), SoPhieuChi: gp(chi, n.NCC_ID),
      SoPhieuTraLai: gp(traVai, n.NCC_ID) + gp(traPK, n.NCC_ID),
      SoPhieuNhapHH: gp(nhapHH, n.NCC_ID)
    };
  });
  return { rows: rows.sort((a, b) => b.ConNo - a.ConNo), canhBao: (!coGiaVai || !coGiaPK) ? 'Thiếu cột đơn giá (VaiCay.DonGiaNhap / PhieuPhuKienChiTiet.DonGia) — phần đó tính bằng 0.' : null };
}
router.get('/congnoncc', requireAuth, requirePermission('CONGNO', 'view'), requireChucNang('CONGNO', 'congnoncc'), async (req, res) => {
  const pool = await getPool();
  const kq = await congNoNCC(pool);
  res.json({ success: true, data: kq.rows, canhBao: kq.canhBao });
});
// So chi tiet 1 NCC: tung phieu nhap vai / nhap phu kien / phieu chi / dieu chinh
// v6.47: tach ham rieng (dung chung voi xuat Excel) + tra ve NGAY MOI NHAT LEN TRUOC.
async function soChiTietNCC(pool, id) {
  const coGiaVai = await coCot(pool, 'VaiCay', 'DonGiaNhap');
  const coGiaPK = await coCot(pool, 'PhieuPhuKienChiTiet', 'DonGia');
  const rq = () => pool.request().input('id', sql.Int, id);
  const vai = coGiaVai ? (await rq().query(`
    /* v6.56.2: SỐ PHIẾU phải giống HỆT màn Phiếu nhập kho vải: 'NKV-' + PhieuNhapID đệm 5 chữ số (v6.57)
       (module.khovai.js). Trước đây ưu tiên SoHoaDon rồi mới lùi về 'PN#<id>' -> cùng một phiếu mà
       hai màn hình hiện hai chuỗi khác nhau, đối chiếu là lẫn ngay.
       Số hóa đơn NCC vẫn hữu ích nên đẩy sang cột Diễn giải, không chiếm chỗ số phiếu. */
    SELECT pn.NgayNhap AS Ngay,
           CONCAT(N'NKV-', RIGHT('00000' + CAST(pn.PhieuNhapID AS VARCHAR(10)), 5)) AS SoPhieu,
           SUM(ISNULL(vc.KGNhap,0) * ISNULL(vc.DonGiaNhap,0)) AS PhatSinh, 0 AS ThanhToan,
           N'Nhập vải' AS Loai,
           LTRIM(RTRIM(ISNULL(N'HĐ ' + pn.SoHoaDon, '') + ISNULL(N' · ' + pn.GhiChu, ''))) AS DienGiai,
           N'PNV' AS CtLoai, pn.PhieuNhapID AS CtID
    FROM PhieuNhapVai pn JOIN VaiCay vc ON vc.PhieuNhapID = pn.PhieuNhapID
    WHERE pn.NCC_ID = @id GROUP BY pn.PhieuNhapID, pn.NgayNhap, pn.SoHoaDon, pn.GhiChu`)).recordset : [];
  const pk = coGiaPK ? (await rq().query(`
    /* v6.56.2: giong man Phieu nhap kho phu kien: 'NPK-' + PhieuID dem 5 chu so. */
    SELECT p.Ngay,
           CONCAT(N'NPK-', RIGHT('00000' + CAST(p.PhieuID AS VARCHAR(10)), 5)) AS SoPhieu,
           SUM(ISNULL(ct.SoLuong,0) * ISNULL(ct.DonGia,0)) AS PhatSinh, 0 AS ThanhToan,
           N'Nhập phụ kiện' AS Loai,
           LTRIM(RTRIM(ISNULL(N'HĐ ' + p.SoHoaDon, '') + ISNULL(N' · ' + p.GhiChu, ''))) AS DienGiai,
           N'PNPK' AS CtLoai, p.PhieuID AS CtID
    FROM PhieuPhuKien p JOIN PhieuPhuKienChiTiet ct ON ct.PhieuID = p.PhieuID
    WHERE p.NCC_ID = @id AND p.LoaiPhieu = N'Nhập' GROUP BY p.PhieuID, p.Ngay, p.SoHoaDon, p.GhiChu`)).recordset : [];
  const chi = (await rq().query(`
    SELECT NgayChi AS Ngay, SoPhieu, 0 AS PhatSinh, SoTien AS ThanhToan, N'Phiếu chi' AS Loai, DienGiai,
           N'PC' AS CtLoai, PhieuChiID AS CtID
    FROM PhieuChi WHERE NCC_ID = @id AND LoaiDoiTuong = N'NhaCungCap'`)).recordset;
  const dc = (await rq().query(`
    SELECT Ngay, N'' AS SoPhieu, SoTien AS PhatSinh, 0 AS ThanhToan, N'Điều chỉnh' AS Loai, DienGiai,
           NULL AS CtLoai, NULL AS CtID
    FROM CongNoDieuChinh WHERE LoaiDoiTuong = N'NhaCungCap' AND NCC_ID = @id`)).recordset;
  /* v6.66: TRA HANG VE NCC -> PHAT SINH AM (giam no). Khong ghi vao cot Thanh toan: cot do la TIEN
     da chi, tron hang tra vao se lam sai bao cao dong tien. Cong thuc phai KHOP congNoNCC() o tren. */
  const coTraVai = await coCot(pool, 'PhieuXuatVai', 'LaTraNCC');
  const coTraPK = await coCot(pool, 'PhieuPhuKien', 'LaTraNCC');
  const traVai = (coTraVai && coGiaVai) ? (await rq().query(`
    SELECT px.NgayXuat AS Ngay,
           CONCAT(N'XKV-', RIGHT('00000' + CAST(px.PhieuXuatID AS VARCHAR(10)), 5)) AS SoPhieu,
           -SUM(ISNULL(ct.KGXuat,0) * ISNULL(vc.DonGiaNhap,0)) AS PhatSinh, 0 AS ThanhToan,
           N'Trả vải NCC' AS Loai, px.GhiChu AS DienGiai,
           N'PXV' AS CtLoai, px.PhieuXuatID AS CtID
    FROM PhieuXuatVai px
    JOIN PhieuXuatVaiChiTiet ct ON ct.PhieuXuatID = px.PhieuXuatID
    JOIN VaiCay vc ON vc.CayID = ct.CayID
    WHERE px.LaTraNCC = 1 AND px.NCC_ID = @id
    GROUP BY px.PhieuXuatID, px.NgayXuat, px.GhiChu`)).recordset : [];
  const traPK = (coTraPK && coGiaPK) ? (await rq().query(`
    SELECT p.Ngay,
           CONCAT(N'XPK-', RIGHT('00000' + CAST(p.PhieuID AS VARCHAR(10)), 5)) AS SoPhieu,
           -SUM(ISNULL(ct.SoLuong,0) * ISNULL(ct.DonGia,0)) AS PhatSinh, 0 AS ThanhToan,
           N'Trả phụ kiện NCC' AS Loai, p.GhiChu AS DienGiai,
           N'PXPK' AS CtLoai, p.PhieuID AS CtID
    FROM PhieuPhuKien p JOIN PhieuPhuKienChiTiet ct ON ct.PhieuID = p.PhieuID
    WHERE p.LoaiPhieu = N'Xuất' AND p.LaTraNCC = 1 AND p.NCC_ID = @id
    GROUP BY p.PhieuID, p.Ngay, p.GhiChu`)).recordset : [];
  /* v6.78: dong NHAP KHO HANG HOA. Cong thuc phai KHOP congNoNCC() o tren - hai ban tinh song song
     ma lech nhau thi bang tong va so chi tiet ra hai con so khac nhau. */
  let coBangNKH2 = false;
  try {
    coBangNKH2 = (await pool.request().query(`SELECT OBJECT_ID('PhieuNhapKhoHang') AS c`)).recordset[0].c != null;
  } catch (e) { coBangNKH2 = false; }
  const nhapHH = coBangNKH2 ? (await rq().query(`
    SELECT p.NgayNhap AS Ngay, p.SoPhieu, ISNULL(p.TongTien, 0) AS PhatSinh, 0 AS ThanhToan,
           N'Nhập kho hàng hóa' AS Loai,
           LTRIM(RTRIM(ISNULL(N'HĐ ' + p.SoHoaDon, '') + ISNULL(N' · ' + p.GhiChu, ''))) AS DienGiai,
           N'PNKH' AS CtLoai, p.PhieuNKID AS CtID
    FROM PhieuNhapKhoHang p
    WHERE p.LoaiNhap = N'NhaCungCap' AND p.NCC_ID = @id AND p.TrangThai <> N'Đã hủy'`)).recordset : [];
  const rows = [...vai, ...pk, ...chi, ...dc, ...traVai, ...traPK, ...nhapHH].sort((a, b) => new Date(a.Ngay) - new Date(b.Ngay));
  let luy = 0;
  rows.forEach(r => { luy += so(r.PhatSinh) - so(r.ThanhToan); r.LuyKe = Math.round(luy * 100) / 100; });
  const ten = (await rq().query('SELECT TenNCC FROM NhaCungCap WHERE NCC_ID=@id')).recordset[0] || {};
  return { nccId: id, tenNCC: ten.TenNCC || '', rows: rows.slice().reverse(), conNo: Math.round(luy * 100) / 100 };
}
router.get('/congnoncc/chitiet', requireAuth, requirePermission('CONGNO', 'view'), requireChucNang('CONGNO', 'congnoncc'), async (req, res) => {
  const pool = await getPool();
  const id = parseInt(req.query.nccId, 10);
  if (!id) return res.status(400).json({ success: false, message: 'Thiếu nhà cung cấp.' });
  res.json({ success: true, data: await soChiTietNCC(pool, id) });
});

/* ================================================================================================
   7b. SO QUY (v6.24) — TIEN MAT + TUNG TAI KHOAN NGAN HANG
   So du = So du dau ky + tong THU - tong CHI. KHONG luu bang so quy rieng: luon tinh lai tu chung tu
   nen khong bao gio lech voi phieu thu/chi.
     - Quy tien mat  : phieu co HinhThuc = N'Tiền mặt'      (dau ky: CauHinhHeThong.QUY_TIEN_MAT_DAU_KY)
     - Quy ngan hang : phieu co HinhThuc = N'Chuyển khoản'  (dau ky: tung dong DanhMucTaiKhoanNganHang)
   Phieu chuyen khoan CHUA gan tai khoan (du lieu truoc v6.24) gom vao 1 dong "(chưa gán tài khoản)".
   ================================================================================================ */
async function tinhSoQuy(pool) {
  const coNH = await coBangTKNH(pool);
  const cfg = (await pool.request().query(
    `SELECT ConfigValue FROM CauHinhHeThong WHERE ConfigKey = 'QUY_TIEN_MAT_DAU_KY'`)).recordset[0];
  const dauKyTM = so(cfg && cfg.ConfigValue);
  const cot = coNH ? 'TaiKhoanNHID' : 'CAST(NULL AS INT)';
  const thu = (await pool.request().query(`
    SELECT HinhThuc, ${cot} AS TaiKhoanNHID, SUM(SoTien) AS Tien, COUNT(*) AS SoPhieu
    FROM PhieuThu GROUP BY HinhThuc, ${coNH ? 'TaiKhoanNHID' : 'CAST(NULL AS INT)'}`)).recordset;
  const chi = (await pool.request().query(`
    SELECT HinhThuc, ${cot} AS TaiKhoanNHID, SUM(SoTien) AS Tien, COUNT(*) AS SoPhieu
    FROM PhieuChi GROUP BY HinhThuc, ${coNH ? 'TaiKhoanNHID' : 'CAST(NULL AS INT)'}`)).recordset;
  const nh = coNH ? (await pool.request().query(
    'SELECT TaiKhoanNHID, TenNganHang, SoTaiKhoan, ChuTaiKhoan, SoDuDauKy FROM DanhMucTaiKhoanNganHang ORDER BY TenNganHang')).recordset : [];

  const laTM = h => String(h || '').trim() !== 'Chuyển khoản';
  const tong = (arr, dk) => arr.filter(dk).reduce((s, x) => s + so(x.Tien), 0);
  const dem = (arr, dk) => arr.filter(dk).reduce((s, x) => s + (x.SoPhieu || 0), 0);

  const quy = [{
    loai: 'TienMat', ten: 'Quỹ tiền mặt', soTaiKhoan: '', dauKy: dauKyTM,
    thu: tong(thu, x => laTM(x.HinhThuc)), chi: tong(chi, x => laTM(x.HinhThuc)),
    soPhieuThu: dem(thu, x => laTM(x.HinhThuc)), soPhieuChi: dem(chi, x => laTM(x.HinhThuc))
  }];
  nh.forEach(t => quy.push({
    loai: 'NganHang', taiKhoanNHID: t.TaiKhoanNHID, ten: t.TenNganHang,
    soTaiKhoan: t.SoTaiKhoan, chuTaiKhoan: t.ChuTaiKhoan, dauKy: so(t.SoDuDauKy),
    thu: tong(thu, x => !laTM(x.HinhThuc) && x.TaiKhoanNHID === t.TaiKhoanNHID),
    chi: tong(chi, x => !laTM(x.HinhThuc) && x.TaiKhoanNHID === t.TaiKhoanNHID),
    soPhieuThu: dem(thu, x => !laTM(x.HinhThuc) && x.TaiKhoanNHID === t.TaiKhoanNHID),
    soPhieuChi: dem(chi, x => !laTM(x.HinhThuc) && x.TaiKhoanNHID === t.TaiKhoanNHID)
  }));
  const thuLe = tong(thu, x => !laTM(x.HinhThuc) && !x.TaiKhoanNHID);
  const chiLe = tong(chi, x => !laTM(x.HinhThuc) && !x.TaiKhoanNHID);
  if (thuLe || chiLe) {
    quy.push({
      loai: 'ChuaGan', ten: 'Chuyển khoản (chưa gán tài khoản)', soTaiKhoan: '', dauKy: 0,
      thu: thuLe, chi: chiLe,
      soPhieuThu: dem(thu, x => !laTM(x.HinhThuc) && !x.TaiKhoanNHID),
      soPhieuChi: dem(chi, x => !laTM(x.HinhThuc) && !x.TaiKhoanNHID)
    });
  }
  quy.forEach(q => { q.soDu = Math.round((q.dauKy + q.thu - q.chi) * 100) / 100; });
  return { quy, coNH };
}
router.get('/soquy', requireAuth, requirePermission('CONGNO', 'view'), requireChucNang('CONGNO', 'soquy'), async (req, res) => {
  const pool = await getPool();
  const kq = await tinhSoQuy(pool);
  res.json({
    success: true, data: kq.quy,
    canhBao: kq.coNH ? null : 'Chưa chạy database/migration_v669.sql — chưa tách được quỹ theo từng tài khoản ngân hàng.'
  });
});
// So chi tiet 1 quy: liet ke phieu thu/chi theo thoi gian + so du luy ke
router.get('/soquy/chitiet', requireAuth, requirePermission('CONGNO', 'view'), requireChucNang('CONGNO', 'soquy'), async (req, res) => {
  const pool = await getPool();
  const coNH = await coBangTKNH(pool);
  const loai = req.query.loai === 'NganHang' ? 'NganHang' : (req.query.loai === 'ChuaGan' ? 'ChuaGan' : 'TienMat');
  const tknh = req.query.taiKhoanNHID ? Number(req.query.taiKhoanNHID) : null;
  let dk, dauKy = 0, ten = 'Quỹ tiền mặt';
  if (loai === 'TienMat') {
    dk = `ISNULL(HinhThuc, N'Tiền mặt') <> N'Chuyển khoản'`;
    const cfg = (await pool.request().query(`SELECT ConfigValue FROM CauHinhHeThong WHERE ConfigKey='QUY_TIEN_MAT_DAU_KY'`)).recordset[0];
    dauKy = so(cfg && cfg.ConfigValue);
  } else if (loai === 'NganHang' && coNH && tknh) {
    dk = `HinhThuc = N'Chuyển khoản' AND TaiKhoanNHID = ${tknh}`;
    const t = (await pool.request().input('id', sql.Int, tknh)
      .query('SELECT TenNganHang, SoTaiKhoan, SoDuDauKy FROM DanhMucTaiKhoanNganHang WHERE TaiKhoanNHID=@id')).recordset[0] || {};
    dauKy = so(t.SoDuDauKy);
    ten = `${t.TenNganHang || ''} — ${t.SoTaiKhoan || ''}`;
  } else {
    dk = coNH ? `HinhThuc = N'Chuyển khoản' AND TaiKhoanNHID IS NULL` : `HinhThuc = N'Chuyển khoản'`;
    ten = 'Chuyển khoản (chưa gán tài khoản)';
  }
  const thu = (await pool.request().query(`
    SELECT NgayThu AS Ngay, SoPhieu, SoTien AS Thu, 0 AS Chi, N'Phiếu thu' AS Loai,
           ISNULL(TenDoiTuong, N'') AS DoiTuong, DienGiai
    FROM PhieuThu WHERE ${dk}`)).recordset;
  const chi = (await pool.request().query(`
    SELECT NgayChi AS Ngay, SoPhieu, 0 AS Thu, SoTien AS Chi, N'Phiếu chi' AS Loai,
           ISNULL(TenDoiTuong, N'') AS DoiTuong, DienGiai
    FROM PhieuChi WHERE ${dk}`)).recordset;
  const rows = [...thu, ...chi].sort((a, b) => new Date(a.Ngay) - new Date(b.Ngay) || String(a.SoPhieu).localeCompare(String(b.SoPhieu)));
  let luy = dauKy;
  rows.forEach(r => { luy += so(r.Thu) - so(r.Chi); r.SoDu = Math.round(luy * 100) / 100; });
  res.json({ success: true, data: { ten, dauKy, rows, soDu: Math.round(luy * 100) / 100 } });
});

/* ================================================================================================
   v6.55 — XEM CHI TIET 1 CHUNG TU TU SO CONG NO
   ------------------------------------------------------------------------------------------------
   1 route dung chung cho 4 loai chung tu xuat hien trong so cong no. Tra ve { header, dong[] };
   phieu thu/chi khong co dong nen dong = [].
   Quyen: chi can CONGNO/view — nguoi xem so cong no phai xem duoc chung tu tao ra so do, khong the
   bat ho phai co them quyen cua phan he Kho vai / Phu kien.
   ================================================================================================ */
router.get('/chungtu', requireAuth, requirePermission('CONGNO', 'view'), async (req, res) => {
  try {
    const pool = await getPool();
    const loai = String(req.query.loai || '').trim();
    const id = parseInt(req.query.id, 10);
    if (!id) return res.status(400).json({ success: false, message: 'Thiếu mã chứng từ.' });
    const rq = () => pool.request().input('id', sql.Int, id);

    if (loai === 'PT') {
      const h = (await rq().query(`
        SELECT t.*, tk.MaTK, tk.TenTK, u.HoTen AS NguoiTao
        FROM PhieuThu t LEFT JOIN DanhMucTaiKhoan tk ON tk.TaiKhoanID = t.TaiKhoanID
        LEFT JOIN Users u ON u.UserID = t.NguoiTaoID WHERE t.PhieuThuID = @id`)).recordset[0];
      if (!h) return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu thu.' });
      return res.json({ success: true, data: { tieuDe: 'Phiếu thu ' + (h.SoPhieu || ''), header: h, dong: [] } });
    }
    if (loai === 'PC') {
      const h = (await rq().query(`
        SELECT c.*, tk.MaTK, tk.TenTK, ncc.TenNCC, u.HoTen AS NguoiTao
        FROM PhieuChi c LEFT JOIN DanhMucTaiKhoan tk ON tk.TaiKhoanID = c.TaiKhoanID
        LEFT JOIN NhaCungCap ncc ON ncc.NCC_ID = c.NCC_ID
        LEFT JOIN Users u ON u.UserID = c.NguoiTaoID WHERE c.PhieuChiID = @id`)).recordset[0];
      if (!h) return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu chi.' });
      return res.json({ success: true, data: { tieuDe: 'Phiếu chi ' + (h.SoPhieu || ''), header: h, dong: [] } });
    }
    if (loai === 'PNV') {
      const h = (await rq().query(`
        SELECT pn.*, ncc.TenNCC FROM PhieuNhapVai pn
        LEFT JOIN NhaCungCap ncc ON ncc.NCC_ID = pn.NCC_ID WHERE pn.PhieuNhapID = @id`)).recordset[0];
      if (!h) return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu nhập vải.' });
      /* v6.56.1: DanhMucVai KHÔNG có cột TenVai — tên vải là ghép của Loại vải + Màu (giống mọi
         truy vấn khác trong khovai.js). Mã hiện là MaCay (mã cây), phần tên ghép từ 2 bảng kia. */
      const dong = (await rq().query(`
        SELECT vc.MaCay,
               LTRIM(RTRIM(ISNULL(lv.TenLoaiVai, ISNULL(dv.MaVai, '')) + ISNULL(N' - ' + ms.TenMau, ''))) AS Ten,
               vc.KGNhap AS SoLuong, N'Kg' AS DonVi, vc.DonGiaNhap AS DonGia,
               (ISNULL(vc.KGNhap,0) * ISNULL(vc.DonGiaNhap,0)) AS ThanhTien
        FROM VaiCay vc
        LEFT JOIN DanhMucVai dv ON dv.VaiID = vc.VaiID
        LEFT JOIN LoaiVai lv ON lv.LoaiVaiID = dv.LoaiVaiID
        LEFT JOIN MauSac ms ON ms.MauSacID = dv.MauSacID
        WHERE vc.PhieuNhapID = @id ORDER BY vc.CayID`)).recordset;
      // v6.56.2: tiêu đề dùng ĐÚNG số phiếu như màn Phiếu nhập kho vải, không dùng số hóa đơn NCC.
      const soPN = 'NKV-' + String(id).padStart(5, '0');   // v6.57
      return res.json({ success: true, data: { tieuDe: 'Phiếu nhập vải ' + soPN + (h.SoHoaDon ? ` (HĐ ${h.SoHoaDon})` : ''), header: h, dong } });
    }
    if (loai === 'PNPK') {
      const h = (await rq().query(`
        SELECT p.*, ncc.TenNCC FROM PhieuPhuKien p
        LEFT JOIN NhaCungCap ncc ON ncc.NCC_ID = p.NCC_ID WHERE p.PhieuID = @id`)).recordset[0];
      if (!h) return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu phụ kiện.' });
      const dong = (await rq().query(`
        SELECT pk.MaPhuKien AS MaCay, pk.TenPhuKien AS Ten, ct.SoLuong, pk.DonViCoBan AS DonVi,
               ct.DonGia, (ISNULL(ct.SoLuong,0) * ISNULL(ct.DonGia,0)) AS ThanhTien
        FROM PhieuPhuKienChiTiet ct LEFT JOIN DanhMucPhuKien pk ON pk.PhuKienID = ct.PhuKienID
        WHERE ct.PhieuID = @id ORDER BY ct.ID`)).recordset;
      const soPK = 'NPK-' + String(id).padStart(5, '0');   // v6.56.2
      return res.json({ success: true, data: { tieuDe: 'Phiếu nhập phụ kiện ' + soPK + (h.SoHoaDon ? ` (HĐ ${h.SoHoaDon})` : ''), header: h, dong } });
    }
    return res.status(400).json({ success: false, message: 'Loại chứng từ không hỗ trợ xem chi tiết.' });
  } catch (err) {
    console.error('[congno GET /chungtu] ', err);
    res.status(400).json({ success: false, message: 'Lỗi khi đọc chứng từ: ' + err.message });
  }
});

/* ================================================================================================
   8. XUAT EXCEL cong no (KH hoac NCC) — 1 route dung chung
   ================================================================================================ */
/* v6.53: KE BANG + DINH DANG SO cho file Excel cong no.
   - Moi o tu dong tieu de cot tro xuong: vien mong 4 canh.
   - O co gia tri SO: numFmt '#,##0' -> Excel tu hien 1.234.567 theo dau phan cach cua may.
     KHONG tu noi chuoi "1.234.567" vao o, vi lam vay o thanh CHU: khong cong duoc, khong loc duoc,
     va cong thuc SUM o dong TONG se ra 0.
   - Cot dau (ten khach/NCC hoac Ngay) can trai, con lai theo mac dinh cua kieu du lieu. */
function ketBang(ws, soCot, tuDong) {
  const vien = { style: 'thin', color: { argb: 'FFBBBBBB' } };
  for (let d = tuDong; d <= ws.rowCount; d++) {
    const row = ws.getRow(d);
    for (let c = 1; c <= soCot; c++) {
      const o = row.getCell(c);
      o.border = { top: vien, left: vien, bottom: vien, right: vien };
      if (typeof o.value === 'number') o.numFmt = '#,##0';
      // O cong thuc (dong TONG) cung phai dinh dang, no khong phai kieu number luc ghi file.
      else if (o.value && typeof o.value === 'object' && o.value.formula) o.numFmt = '#,##0';
      o.alignment = { vertical: 'middle', wrapText: false };
    }
  }
  ws.getRow(tuDong).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
}

// v6.47: gui workbook ve trinh duyet (dung chung cho moi nhanh xuat cua route /export)
async function guiFile(res, wb, tenFile) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${tenFile}"`);
  await wb.xlsx.write(res);
  res.end();
}
/* v6.47: bo dau tieng Viet + ky tu la cho TEN FILE. Ten file co dau/khoang trang di qua header
   Content-Disposition hay bi trinh duyet cat hoac bien thanh ky tu la. */
function khongDau(s) {
  /* Dung new RegExp voi ma ̀-ͯ (vung dau thanh to hop) - viet toan ASCII, khong phu thuoc
     vao viec file duoc luu bang bang ma nao. Sau khi go dau xong thi moi ky tu khong phai chu/so
     deu doi thanh '_', nen chu Viet nao sot lai cung khong lam hong ten file. */
  const boDau = new RegExp('[\\u0300-\\u036f]', 'g');
  return String(s || '').normalize('NFD').replace(boDau, '')
    .replace(new RegExp('đ', 'g'), 'd').replace(new RegExp('Đ', 'g'), 'D')
    .replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase() || 'cong_no';
}

router.get('/export', requireAuth, requirePermission('CONGNO', 'view'), async (req, res) => {
  try {
    const pool = await getPool();
    const loai = req.query.loai === 'ncc' ? 'ncc' : 'kh';
    const wb = new ExcelJS.Workbook();

    /* v6.47: XUẤT SỔ CHI TIẾT.
         ?loai=kh&khach=<tên>   -> chỉ sổ chi tiết của 1 khách
         ?loai=ncc&nccId=<id>   -> chỉ sổ chi tiết của 1 nhà cung cấp
         ?loai=kh   (không kèm) -> sheet Tổng hợp + sheet Sổ chi tiết CỦA TẤT CẢ (có cột Đối tượng)
       Sổ chi tiết dùng CHUNG hàm với màn hình xem, nên số liệu không thể lệch nhau. */
    const hai = n => String(n).padStart(2, '0');
    const ngayVN = d => { const x = new Date(d); return isNaN(x) ? '' : `${hai(x.getDate())}/${hai(x.getMonth() + 1)}/${x.getFullYear()}`; };
    const cotSo = (coDoiTuong, nhanDoiTuong) => [
      ...(coDoiTuong ? [{ header: nhanDoiTuong, key: 'DoiTuong', width: 28 }] : []),
      { header: 'Ngày', key: 'Ngay', width: 11 },
      { header: 'Loại', key: 'Loai', width: 16 },
      { header: 'Số phiếu', key: 'SoPhieu', width: 16 },
      { header: 'Phát sinh (tăng nợ)', key: 'PhatSinh', width: 18 },
      { header: 'Thanh toán (giảm nợ)', key: 'ThanhToan', width: 19 },
      { header: 'Lũy kế còn nợ', key: 'LuyKe', width: 16 },
      { header: 'Diễn giải', key: 'DienGiai', width: 34 }
    ];
    const doSo = (ws, rows, doiTuong) => rows.forEach(r => ws.addRow({
      ...(doiTuong != null ? { DoiTuong: doiTuong } : {}),
      Ngay: ngayVN(r.Ngay), Loai: r.Loai, SoPhieu: r.SoPhieu || '',
      PhatSinh: so(r.PhatSinh), ThanhToan: so(r.ThanhToan), LuyKe: so(r.LuyKe), DienGiai: r.DienGiai || ''
    }));
    /* Dòng đầu ghi rõ đang xếp mới->cũ: cột "Lũy kế còn nợ" đọc từ DƯỚI LÊN mới đúng thứ tự phát
       sinh — không ghi ra thì người xem tưởng cột lũy kế bị sai. */
    const ghiChuThuTu = (ws, soCot) => {
      const r = ws.addRow([]);
      r.getCell(1).value = 'Xếp theo ngày MỚI NHẤT lên trên. Cột "Lũy kế còn nợ" là số dư sau từng chứng từ, đọc từ dưới lên.';
      r.getCell(1).font = { italic: true, size: 9, color: { argb: 'FF5F6368' } };
      ws.mergeCells(r.number, 1, r.number, soCot);
    };

    /* v6.52: ĐẦU TRANG cho file Excel — tên công ty, tiêu đề, tên đối tượng, ngày xuất.
       Đặt TRƯỚC khi gán ws.columns thì header của columns sẽ đè lên dòng 1; nên phải thêm các dòng
       này rồi mới tự tay ghi dòng tiêu đề cột (xem dungSheet). */
    const CONG_TY = 'CÔNG TY TNHH THỜI TRANG MOYN';
    const DIA_CHI = 'Thôn Đại tự, xã Hoài Đức, TP Hà Nội';
    const dauTrang = (ws, soCot, tieuDe, doiTuong) => {
      const gop = (giaTri, font) => {
        const r = ws.addRow([]);
        r.getCell(1).value = giaTri;
        if (font) r.getCell(1).font = font;
        r.getCell(1).alignment = { horizontal: 'center' };
        ws.mergeCells(r.number, 1, r.number, soCot);
        return r;
      };
      gop(CONG_TY, { bold: true, size: 13 });
      gop(DIA_CHI, { size: 10, color: { argb: 'FF444444' } });
      gop(tieuDe, { bold: true, size: 15 });
      if (doiTuong) gop(doiTuong, { bold: true, size: 12 });
      gop(`Ngày xuất: ${ngayVN(new Date())}`, { italic: true, size: 9, color: { argb: 'FF5F6368' } });
      ws.addRow([]);
    };
    // Ghi dòng tiêu đề cột bằng tay (không dùng ws.columns[].header vì header luôn nằm ở DÒNG 1).
    const dongTieuDeCot = (ws, cot) => {
      const r = ws.addRow(cot.map(c => c.header));
      r.font = { bold: true };
      cot.forEach((c, i) => { ws.getColumn(i + 1).width = c.width; ws.getColumn(i + 1).key = c.key; });
      return r;
    };

    const khachMot = String(req.query.khach || '').trim();
    const nccMot = parseInt(req.query.nccId, 10) || 0;

    if (loai === 'kh' && khachMot) {
      const d = await soChiTietKH(pool, khachMot);
      const ws = wb.addWorksheet('Sổ chi tiết');
      const cot = cotSo(false);
      dauTrang(ws, cot.length, 'SỔ CHI TIẾT CÔNG NỢ KHÁCH HÀNG', 'Khách hàng: ' + khachMot);
      const dongTD = dongTieuDeCot(ws, cot).number;
      ghiChuThuTu(ws, cot.length);
      doSo(ws, d.rows, null);
      const r = ws.addRow({ Loai: 'CÒN NỢ', LuyKe: d.conNo });
      r.font = { bold: true };
      ketBang(ws, cot.length, dongTD);   // v6.53: kẻ bảng + định dạng số
      return await guiFile(res, wb, `cong_no_${khongDau(khachMot)}.xlsx`);
    }
    if (loai === 'ncc' && nccMot) {
      const d = await soChiTietNCC(pool, nccMot);
      const ws = wb.addWorksheet('Sổ chi tiết');
      const cot = cotSo(false);
      dauTrang(ws, cot.length, 'SỔ CHI TIẾT CÔNG NỢ NHÀ CUNG CẤP', 'Nhà cung cấp: ' + (d.tenNCC || ''));
      const dongTD = dongTieuDeCot(ws, cot).number;
      ghiChuThuTu(ws, cot.length);
      doSo(ws, d.rows, null);
      const r = ws.addRow({ Loai: 'CÒN NỢ', LuyKe: d.conNo });
      r.font = { bold: true };
      ketBang(ws, cot.length, dongTD);   // v6.53: kẻ bảng + định dạng số
      return await guiFile(res, wb, `cong_no_${khongDau(d.tenNCC || ('ncc' + nccMot))}.xlsx`);
    }

    if (loai === 'kh') {
      const rows = await congNoKhachHang(pool);
      const ws = wb.addWorksheet('Công nợ khách hàng');
      const cot = [
        { header: 'Khách hàng', key: 'TenKhach', width: 28 },
        { header: 'Phải thu (phiếu bán hàng)', key: 'PhaiThu', width: 22 },
        { header: 'Điều chỉnh', key: 'DieuChinh', width: 14 },
        { header: 'Đã thu', key: 'DaThu', width: 16 },
        { header: 'Còn nợ', key: 'ConNo', width: 16 },
        { header: 'Số phiếu BH', key: 'SoPhieu', width: 12 },
        { header: 'Số phiếu thu', key: 'SoPhieuThu', width: 12 }
      ];
      dauTrang(ws, cot.length, 'BẢNG TỔNG HỢP CÔNG NỢ KHÁCH HÀNG', '');
      const dongTD = dongTieuDeCot(ws, cot).number;
      // v6.52: có khối đầu trang -> dòng dữ liệu KHÔNG còn bắt đầu từ dòng 2, phải lấy mốc động.
      const dongDau = ws.rowCount + 1;
      rows.forEach(r => ws.addRow(r));
      if (rows.length) {
        const c = k => ws.getColumn(k).letter, n = ws.rowCount;
        const t = ws.addRow({ TenKhach: 'TỔNG', PhaiThu: { formula: `SUM(${c('PhaiThu')}${dongDau}:${c('PhaiThu')}${n})` },
          DieuChinh: { formula: `SUM(${c('DieuChinh')}${dongDau}:${c('DieuChinh')}${n})` },
          DaThu: { formula: `SUM(${c('DaThu')}${dongDau}:${c('DaThu')}${n})` },
          ConNo: { formula: `SUM(${c('ConNo')}${dongDau}:${c('ConNo')}${n})` } });
        t.font = { bold: true };
      }
      ketBang(ws, cot.length, dongTD);   // v6.53
    } else {
      const kq = await congNoNCC(pool);
      const ws = wb.addWorksheet('Công nợ nhà cung cấp');
      const cot = [
        { header: 'Nhà cung cấp', key: 'TenNCC', width: 28 },
        { header: 'Tiền nhập vải', key: 'TienVai', width: 18 },
        { header: 'Tiền nhập phụ kiện', key: 'TienPhuKien', width: 18 },
        { header: 'Điều chỉnh', key: 'DieuChinh', width: 14 },
        { header: 'Phải trả', key: 'PhaiTra', width: 16 },
        { header: 'Đã trả', key: 'DaTra', width: 16 },
        { header: 'Còn nợ', key: 'ConNo', width: 16 }
      ];
      dauTrang(ws, cot.length, 'BẢNG TỔNG HỢP CÔNG NỢ NHÀ CUNG CẤP', '');
      dongTieuDeCot(ws, cot);
      const dongDau = ws.rowCount + 1;   // v6.52: mốc động, xem ghi chú ở nhánh khách hàng
      kq.rows.forEach(r => ws.addRow(r));
      if (kq.rows.length) {
        const c = k => ws.getColumn(k).letter, n = ws.rowCount;
        const t = ws.addRow({ TenNCC: 'TỔNG',
          TienVai: { formula: `SUM(${c('TienVai')}${dongDau}:${c('TienVai')}${n})` },
          TienPhuKien: { formula: `SUM(${c('TienPhuKien')}${dongDau}:${c('TienPhuKien')}${n})` },
          DieuChinh: { formula: `SUM(${c('DieuChinh')}${dongDau}:${c('DieuChinh')}${n})` },
          PhaiTra: { formula: `SUM(${c('PhaiTra')}${dongDau}:${c('PhaiTra')}${n})` },
          DaTra: { formula: `SUM(${c('DaTra')}${dongDau}:${c('DaTra')}${n})` },
          ConNo: { formula: `SUM(${c('ConNo')}${dongDau}:${c('ConNo')}${n})` } });
        t.font = { bold: true };
      }
      ketBang(ws, cot.length, dongTD);   // v6.53
    }
    /* v6.47: sheet thứ 2 — SỔ CHI TIẾT CỦA TẤT CẢ đối tượng, gộp vào cùng file với bảng tổng hợp.
       Có cột "Khách hàng"/"Nhà cung cấp" ở đầu để lọc/pivot lại được. */
    const ws2 = wb.addWorksheet('Sổ chi tiết (tất cả)');
    const cot2 = cotSo(true, loai === 'kh' ? 'Khách hàng' : 'Nhà cung cấp');
    dauTrang(ws2, cot2.length,
      loai === 'kh' ? 'SỔ CHI TIẾT CÔNG NỢ KHÁCH HÀNG' : 'SỔ CHI TIẾT CÔNG NỢ NHÀ CUNG CẤP',
      'Toàn bộ đối tượng');
    const dongTD2 = dongTieuDeCot(ws2, cot2).number;
    ghiChuThuTu(ws2, cot2.length);
    if (loai === 'kh') {
      for (const k of await congNoKhachHang(pool)) {
        const d = await soChiTietKH(pool, k.TenKhach);
        doSo(ws2, d.rows, k.TenKhach);
      }
    } else {
      for (const n of (await congNoNCC(pool)).rows) {
        const d = await soChiTietNCC(pool, n.NCC_ID);
        doSo(ws2, d.rows, n.TenNCC);
      }
    }
    ketBang(ws2, cot2.length, dongTD2);   // v6.53
    await guiFile(res, wb, `cong_no_${loai}.xlsx`);
  } catch (err) {
    console.error('[congno GET /export] ', err);
    res.status(400).json({ success: false, message: 'Lỗi khi xuất Excel: ' + err.message });
  }
});

module.exports = router;
