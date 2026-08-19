// Phan he QUAN LY SAN XUAT - chuc nang "Tai lieu ky thuat" (v5.14)
// Gom 3 loai tai lieu co bang rieng (Tai lieu ky thuat chung, Thong so do, Mo ta san pham) + 1 loai
// ("Chi dinh NPL") KHONG co bang rieng o day - dung lai NGUYEN VEN DonHangChiTietPhuKien va 3 route
// GET/POST/DELETE /api/qlsx/orders/:maDH/phukien da co san trong qlsx.js (xem migration_v514.sql phan
// dau va HUONG_DAN_CAI_DAT.md Buoc 2.19 de biet ly do khong tach rieng bang/route cho muc nay).
const express = require('express');
const { sql, getPool } = require('../db');
const { requireAuth, requirePermission, requireChucNang } = require('../middleware/auth');

const router = express.Router();

/* ================================================================================================
   v5.56 — LƯỚI AN TOÀN CHO HANDLER ASYNC (bắt buộc, đừng gỡ).
   Express 4 KHÔNG bắt lỗi của handler `async`: nếu 1 câu SQL ném lỗi mà route không có try/catch thì
   Express KHÔNG trả về gì cả → request TREO VÔ HẠN → `await apiGet(...)` bên frontend không bao giờ
   kết thúc → KHÔNG có lỗi, KHÔNG có thông báo, người dùng chỉ thấy "bấm nút không có gì xảy ra"
   (đây đúng là nguyên nhân gốc của lỗi Bảng kê BTP, mất nhiều vòng mới tìm ra).
   Đoạn dưới bọc MỌI handler đăng ký qua router.get/post/put/delete: lỗi async được chuyển sang
   error handler chung ở server.js → luôn trả JSON 500 → frontend hiện thông báo lỗi rõ ràng.
   ================================================================================================ */
['get', 'post', 'put', 'delete'].forEach(method => {
  const original = router[method].bind(router);
  router[method] = function (path, ...handlers) {
    return original(path, ...handlers.map(h => {
      if (typeof h !== 'function' || h.length > 3) return h;   // bỏ qua error-handler (4 tham số)
      return function (req, res, next) {
        try {
          const out = h(req, res, next);
          if (out && typeof out.catch === 'function') out.catch(next);
          return out;
        } catch (e) { next(e); }
      };
    }));
  };
});

// v5.38b: gate CHỨC NĂNG theo NHÓM tài liệu (loai) — 'tailieukythuat' (Tài liệu kỹ thuật chung) / 'tailieumay'
// (Tài liệu may/Đóng gói) / 'tailieuinthe' (Tài liệu in thêu). Các route dùng chung theo ?loai nên gate TẬP TRUNG
// bằng 1 middleware (thay cho requireChucNang cứng 'tailieukythuat' từng route) để bỏ/cấp quyền từng tab không
// chặn nhầm nhau. Suy loai từ ?loai (route dùng chung) hoặc path (route 1 tab). requireChucNang tự lấy action theo method.
function cnTaiLieuOf(loai) {
  if (['thongsodo', 'motasp', 'quycach', 'dongiamay', 'dongiagiacong', 'dongialadonggoi'].includes(loai)) return 'tailieumay';
  if (['hinhanhinthue', 'dongiainthe'].includes(loai)) return 'tailieuinthe';
  return 'tailieukythuat';
}
router.use((req, res, next) => {
  let loai = req.query.loai;
  if (!loai) {
    const seg = (req.path.split('/')[1] || '').toLowerCase();
    if (seg.startsWith('thongsodo')) loai = 'thongsodo';
    else if (seg.startsWith('motasp')) loai = 'motasp';
    else if (seg.startsWith('dongiagiacong')) loai = 'dongiagiacong';
    else if (seg.startsWith('dongialadonggoi')) loai = 'dongialadonggoi';
    else if (seg.startsWith('dongiamay')) loai = 'dongiamay';
    else if (seg.startsWith('dongiainthe')) loai = 'dongiainthe';
    else loai = 'tailieuchung';
  }
  return requireChucNang('QLSX', cnTaiLieuOf(loai))(req, res, next);
});

// Tra ve thong tin RUT GON cua 1 don hang (chi can DonHangID/MaDH/MaSanPham/TenSanPham cho cac man
// hinh Tai lieu ky thuat - khac getOrderByMaDH() day du hon trong qlsx.js, khong can lay lai o day).
// v5.53: gộp Mã Rập (từ các sơ đồ DonHangChiTietSoDo) của 1 đơn — hiển thị ở header form tài liệu/BTP.
/* v5.87: dò 1 cột có tồn tại chưa (cột do migration mới thêm). Nhờ vậy màn hình vẫn mở bình thường
   khi khách chưa kịp chạy migration — chỉ thiếu đúng phần dữ liệu của cột đó. Có nhớ kết quả để
   không phải hỏi database mỗi lần gọi route. */
const __cacheCot = new Map();
async function coCot(pool, bang, cot) {
  const key = bang + '.' + cot;
  if (__cacheCot.has(key)) return __cacheCot.get(key);
  const r = (await pool.request().query(`SELECT COL_LENGTH('${bang}','${cot}') AS c`)).recordset[0] || {};
  const co = r.c != null;
  __cacheCot.set(key, co);
  return co;
}

async function maRapOf(pool, donHangId) {
  if (!donHangId) return '';
  const r = await pool.request().input('id', sql.Int, donHangId)
    .query(`SELECT MaRap FROM DonHangChiTietSoDo WHERE DonHangID=@id AND MaRap IS NOT NULL AND LTRIM(RTRIM(MaRap))<>''`);
  return [...new Set(r.recordset.map(x => x.MaRap))].join(', ');
}

async function getOrderBasic(pool, maDH) {
  const result = await pool.request().input('MaDH', sql.NVarChar, maDH).query(`
    SELECT DonHangID, MaDH, MaSanPham, TenSanPham FROM DonHangSanXuat WHERE MaDH = @MaDH`);
  const o = result.recordset[0] || null;
  if (o) o.MaRap = await maRapOf(pool, o.DonHangID);   // v5.53
  return o;
}

// ============ DANH SACH DON HANG KEM TRANG THAI "DA CO TAI LIEU" (dung chung ca 4 man hinh con) ============
// v5.14: KHONG loc theo cong doan/congDoanIds nhu GET /qlsx/orders - tai lieu ky thuat la ho so gan
// theo DON HANG, khong gan theo "ai dang phu trach cong doan nao" (vd nhan vien Cat khong nen bi an
// mat kha nang xem/gan Mo ta san pham cho 1 don chi vi don do dang o cong doan khac). Chi gate theo
// quyen module + chuc nang 'tailieukythuat' nhu binh thuong (xem router.get('/orders') ben duoi).
async function getOrdersWithDocStatus(pool, loai) {
  let joinSql, daCoExpr;
  // v5.56 QUAN TRỌNG: 3 loại header giờ có NHIỀU BẢN/đơn → KHÔNG được LEFT JOIN nữa (mỗi bản sẽ nhân
  // thành 1 dòng đơn hàng trùng lặp trong danh sách). Đổi sang EXISTS + MAX(UpdatedAt) như các loại nhiều dòng.
  if (loai === 'tailieuchung') {
    joinSql = '';
    daCoExpr = `CASE WHEN EXISTS (SELECT 1 FROM TaiLieuKyThuatChung tl WHERE tl.DonHangID = d.DonHangID AND tl.LaMau = 0) THEN 1 ELSE 0 END AS DaCo,
      (SELECT MAX(tl2.UpdatedAt) FROM TaiLieuKyThuatChung tl2 WHERE tl2.DonHangID = d.DonHangID AND tl2.LaMau = 0) AS CapNhatLuc`;
  } else if (loai === 'thongsodo') {
    joinSql = '';
    daCoExpr = `CASE WHEN EXISTS (SELECT 1 FROM TaiLieuThongSoDo tl WHERE tl.DonHangID = d.DonHangID) THEN 1 ELSE 0 END AS DaCo,
      (SELECT MAX(tl2.UpdatedAt) FROM TaiLieuThongSoDo tl2 WHERE tl2.DonHangID = d.DonHangID) AS CapNhatLuc`;
  } else if (loai === 'motasp' || loai === 'quycach' || loai === 'hinhanhinthue') {
    // v5.34c: 3 loai tai lieu anh-luoi dung chung bang TaiLieuMoTaSanPham, phan biet bang cot Loai.
    joinSql = '';
    daCoExpr = `CASE WHEN EXISTS (SELECT 1 FROM TaiLieuMoTaSanPham tl WHERE tl.DonHangID = d.DonHangID AND tl.Loai = '${loai}') THEN 1 ELSE 0 END AS DaCo,
      (SELECT MAX(tl2.UpdatedAt) FROM TaiLieuMoTaSanPham tl2 WHERE tl2.DonHangID = d.DonHangID AND tl2.Loai = '${loai}') AS CapNhatLuc`;
  } else if (loai === 'dongiainthe') {
    // v5.34c: don gia in theu (nhieu dong/don) - EXISTS.
    joinSql = '';
    daCoExpr = `CASE WHEN EXISTS (SELECT 1 FROM DonHangDonGiaInThe g WHERE g.DonHangID = d.DonHangID) THEN 1 ELSE 0 END AS DaCo, CAST(NULL AS DATETIME2) AS CapNhatLuc`;
  } else if (loai === 'dongialadonggoi') {
    // v5.38: don gia la/dong goi (LA/DG) - EXISTS.
    joinSql = '';
    daCoExpr = `CASE WHEN EXISTS (SELECT 1 FROM DonHangDonGiaLaDongGoi g WHERE g.DonHangID = d.DonHangID) THEN 1 ELSE 0 END AS DaCo, CAST(NULL AS DATETIME2) AS CapNhatLuc`;
  } else if (loai === 'dongiamay') {
    // v5.34 (B2): don gia cong doan may (nhieu dong/don) - EXISTS, khong co CapNhatLuc header.
    joinSql = '';
    daCoExpr = `CASE WHEN EXISTS (SELECT 1 FROM DonHangDonGiaCongDoanMay g WHERE g.DonHangID = d.DonHangID) THEN 1 ELSE 0 END AS DaCo, CAST(NULL AS DATETIME2) AS CapNhatLuc`;
  } else if (loai === 'dongiagiacong') {
    // v5.34 (B2): đơn giá giao gia công (HangMucGiaCong + DonHangHangMucGiaCong) - chuyển từ Kỹ thuật sang.
    joinSql = '';
    daCoExpr = `CASE WHEN EXISTS (SELECT 1 FROM DonHangHangMucGiaCong g WHERE g.DonHangID = d.DonHangID) THEN 1 ELSE 0 END AS DaCo, CAST(NULL AS DATETIME2) AS CapNhatLuc`;
  } else {
    // 'chidinhnpl' - DonHangChiTietPhuKien la nhieu dong/don hang (khong co 1 dong "header" rieng nhu
    // 3 bang tren) nen dung EXISTS + MAX(GhiChu tao/sua) khong co san -> chi bao DaCo, khong co CapNhatLuc.
    joinSql = '';
    /* v5.84: thêm TRẠNG THÁI XUẤT KHO PHỤ KIỆN cho tab "Chỉ định NPL" (đối xứng cột trạng thái xuất
       kho của Chỉ định vải SX). KHÔNG cộng tổng số lượng vì mỗi phụ kiện một đơn vị khác nhau
       (cái/mét/kg) — cộng lại là vô nghĩa. Thay vào đó ĐẾM THEO PHỤ KIỆN:
         SoPKChiDinh   = số phụ kiện đã chỉ định cho đơn
         SoPKDaXuatDu  = số phụ kiện đã xuất ĐỦ (tổng đã xuất >= tổng chỉ định của chính phụ kiện đó)
         SoPhieuXuatPK = số phiếu xuất đã lập cho đơn
       Frontend suy ra 3 trạng thái: Chưa xuất / Xuất một phần / Đã xuất kho. */
    daCoExpr = `CASE WHEN EXISTS (SELECT 1 FROM DonHangChiTietPhuKien pk WHERE pk.DonHangID = d.DonHangID) THEN 1 ELSE 0 END AS DaCo, CAST(NULL AS DATETIME2) AS CapNhatLuc,
      (SELECT COUNT(*) FROM (SELECT pk.PhuKienID FROM DonHangChiTietPhuKien pk WHERE pk.DonHangID = d.DonHangID GROUP BY pk.PhuKienID) x) AS SoPKChiDinh,
      (SELECT COUNT(*) FROM (SELECT pk.PhuKienID, SUM(pk.SoLuong) AS SL FROM DonHangChiTietPhuKien pk WHERE pk.DonHangID = d.DonHangID GROUP BY pk.PhuKienID) y
        WHERE ISNULL((SELECT SUM(ct.SoLuong) FROM PhieuPhuKienChiTiet ct JOIN PhieuPhuKien p ON p.PhieuID = ct.PhieuID
                      WHERE p.DonHangID = d.DonHangID AND p.LoaiPhieu = N'Xuất' AND ct.PhuKienID = y.PhuKienID), 0) >= y.SL) AS SoPKDaXuatDu,
      (SELECT COUNT(*) FROM PhieuPhuKien p2 WHERE p2.DonHangID = d.DonHangID AND p2.LoaiPhieu = N'Xuất') AS SoPhieuXuatPK`;
  }
  /* v5.87: 2 loại tài liệu CHỈ DÀNH CHO ĐƠN CÓ IN THÊU (Hình ảnh mô tả in/thêu + Đơn giá in thêu)
     -> lọc luôn ở đây theo ô "Có in thêu" tick lúc Ra lệnh SX (DonHangSanXuat.CoInTheu, v5.33).
     Đơn không tick sẽ KHÔNG hiện trong 2 danh sách đó nữa (trước đây hiện hết, phải tự nhớ đơn nào có).
     Dò cột CoInTheu để DB cũ chưa có cột vẫn chạy (khi đó hiện hết như trước). */
  const locInTheu = (loai === 'hinhanhinthue' || loai === 'dongiainthe') && await coCot(pool, 'DonHangSanXuat', 'CoInTheu')
    ? 'WHERE ISNULL(d.CoInTheu, 0) = 1' : '';
  const result = await pool.request().query(`
    SELECT d.DonHangID, d.MaDH, d.MaSanPham, d.TenSanPham, kh.TenKhachHang, d.NgayGiaoDuKien, d.TrangThai, c.TenCongDoan, ${daCoExpr}
    FROM DonHangSanXuat d
    LEFT JOIN KhachHang kh ON kh.KhachHangID = d.KhachHangID
    LEFT JOIN CongDoanSanXuat c ON c.StageID = d.CongDoanHienTaiID
    ${joinSql}
    ${locInTheu}
    ORDER BY d.CreatedAt DESC`);
  const rows = result.recordset;
  // v5.53: gộp Mã Rập theo đơn (hiển thị ở danh sách + modal NPL + header các form).
  const mr = (await pool.request().query(`SELECT DonHangID, MaRap FROM DonHangChiTietSoDo WHERE MaRap IS NOT NULL AND LTRIM(RTRIM(MaRap))<>''`)).recordset;
  const mrMap = {};
  for (const s of mr) { (mrMap[s.DonHangID] = mrMap[s.DonHangID] || []).push(s.MaRap); }
  rows.forEach(o => { o.MaRap = [...new Set(mrMap[o.DonHangID] || [])].join(', '); });
  return rows;
}

router.get('/orders', requireAuth, requirePermission('QLSX', 'view'), async (req, res) => {
  const loai = ['tailieuchung', 'thongsodo', 'motasp', 'chidinhnpl', 'dongiamay', 'dongiagiacong', 'quycach', 'hinhanhinthue', 'dongiainthe', 'dongialadonggoi'].includes(req.query.loai) ? req.query.loai : 'tailieuchung';
  const pool = await getPool();
  res.json({ success: true, data: await getOrdersWithDocStatus(pool, loai) });
});

// v5.34 (B2): Đơn giá công đoạn may (model mới: Tên/Giây giờ/Hệ số công đoạn/Hệ số công nhân(4)/Thành tiền).
// Nhiều dòng/đơn, lưu = ghi đè toàn bộ. Thành tiền là cột tính (xem migration_v534b) - dùng cho lương khoán may.
// v5.56: danh sách BẢN (nhiều bản có tên/đơn) — dùng chung khuôn với các loại khác.
router.get('/dongiamay/:maDH/phieu', requireAuth, requirePermission('QLSX', 'view'), async (req, res) => {
  const pool = await getPool();
  const o = (await pool.request().input('m', sql.NVarChar, req.params.maDH).query('SELECT DonHangID, MaDH, TenSanPham FROM DonHangSanXuat WHERE MaDH=@m')).recordset[0];
  if (!o) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
  const phieu = (await pool.request().input('id', sql.Int, o.DonHangID).query(
    `SELECT ISNULL(TenPhieu, N'') AS TenPhieu, COUNT(*) AS SoDong FROM DonHangDonGiaCongDoanMay WHERE DonHangID=@id GROUP BY ISNULL(TenPhieu, N'') ORDER BY ISNULL(TenPhieu, N'')`)).recordset;
  res.json({ success: true, order: { MaDH: o.MaDH, TenSanPham: o.TenSanPham, MaRap: await maRapOf(pool, o.DonHangID) }, data: phieu });
});
router.get('/dongiamay/:maDH', requireAuth, requirePermission('QLSX', 'view'), async (req, res) => {
  const pool = await getPool();
  const o = (await pool.request().input('m', sql.NVarChar, req.params.maDH).query('SELECT DonHangID, MaDH, TenSanPham, MaSanPham FROM DonHangSanXuat WHERE MaDH=@m')).recordset[0];
  if (!o) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
  const hasTen = req.query.ten !== undefined;   // không truyền ?ten= = LẤY TẤT CẢ (giữ tương thích báo cáo/lương cũ)
  const ten = req.query.ten != null ? String(req.query.ten) : '';
  const rq = pool.request().input('id', sql.Int, o.DonHangID);
  if (hasTen) rq.input('ten', sql.NVarChar, ten);
  const rows = (await rq.query(`SELECT ID, TenCongDoan, GiayGio, HeSoCongDoan, HeSoCongNhan, ThanhTien FROM DonHangDonGiaCongDoanMay
    WHERE DonHangID=@id${hasTen ? ` AND ISNULL(TenPhieu, N'')=@ten` : ''} ORDER BY ThuTu, ID`)).recordset;
  res.json({ success: true, order: { MaDH: o.MaDH, TenSanPham: o.TenSanPham, MaSanPham: o.MaSanPham, MaRap: await maRapOf(pool, o.DonHangID) }, data: rows });
});
router.post('/dongiamay/:maDH', requireAuth, requirePermission('QLSX', 'edit'), async (req, res) => {
  try {
    const pool = await getPool();
    const o = (await pool.request().input('m', sql.NVarChar, req.params.maDH).query('SELECT DonHangID FROM DonHangSanXuat WHERE MaDH=@m')).recordset[0];
    if (!o) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    const rows = Array.isArray(req.body.rows) ? req.body.rows.filter(r => (r.tenCongDoan || '').trim()) : [];
    const ten = req.body.ten != null ? String(req.body.ten).trim() : '';
    const oldTen = req.body.oldTen != null ? String(req.body.oldTen) : ten;   // hỗ trợ đổi tên bản
    // Ghi đè theo BẢN: quét sạch bản cũ (theo oldTen) rồi chèn lại với tên mới.
    await pool.request().input('id', sql.Int, o.DonHangID).input('ot', sql.NVarChar, oldTen)
      .query(`DELETE FROM DonHangDonGiaCongDoanMay WHERE DonHangID=@id AND ISNULL(TenPhieu, N'')=@ot`);
    let tt = 0;
    for (const r of rows) {
      await pool.request().input('DonHangID', sql.Int, o.DonHangID)
        .input('TenCongDoan', sql.NVarChar, r.tenCongDoan)
        .input('GiayGio', sql.Decimal(14, 4), r.giayGio === '' || r.giayGio == null ? null : Number(r.giayGio))
        .input('HeSoCongDoan', sql.Decimal(14, 4), r.heSoCongDoan === '' || r.heSoCongDoan == null ? null : Number(r.heSoCongDoan))
        .input('HeSoCongNhan', sql.Decimal(14, 4), r.heSoCongNhan === '' || r.heSoCongNhan == null ? 4 : Number(r.heSoCongNhan))
        .input('ThuTu', sql.Int, tt++).input('TenPhieu', sql.NVarChar, ten || null)
        .query('INSERT INTO DonHangDonGiaCongDoanMay (DonHangID, TenCongDoan, GiayGio, HeSoCongDoan, HeSoCongNhan, ThuTu, TenPhieu) VALUES (@DonHangID,@TenCongDoan,@GiayGio,@HeSoCongDoan,@HeSoCongNhan,@ThuTu,@TenPhieu)');
    }
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: 'Lỗi khi lưu đơn giá công đoạn may: ' + err.message }); }
});
router.delete('/dongiamay/:maDH', requireAuth, requirePermission('QLSX', 'delete'), async (req, res) => {
  const pool = await getPool();
  const o = (await pool.request().input('m', sql.NVarChar, req.params.maDH).query('SELECT DonHangID FROM DonHangSanXuat WHERE MaDH=@m')).recordset[0];
  if (!o) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
  const ten = req.query.ten != null ? String(req.query.ten) : '';
  await pool.request().input('id', sql.Int, o.DonHangID).input('ten', sql.NVarChar, ten)
    .query(`DELETE FROM DonHangDonGiaCongDoanMay WHERE DonHangID=@id AND ISNULL(TenPhieu, N'')=@ten`);
  res.json({ success: true });
});

// v5.34 (B2, mục 5): Đơn giá giao gia công (chuyển từ Kỹ thuật). Dùng lại HangMucGiaCong (catalog) +
// DonHangHangMucGiaCong (đơn giá theo đơn). Gate 'tailieukythuat' (tab Tài liệu may), khác route cũ ở qlsx.js.
// v5.56: danh sách BẢN.
router.get('/dongiagiacong/:maDH/phieu', requireAuth, requirePermission('QLSX', 'view'), async (req, res) => {
  const pool = await getPool();
  const o = (await pool.request().input('m', sql.NVarChar, req.params.maDH).query('SELECT DonHangID, MaDH, TenSanPham FROM DonHangSanXuat WHERE MaDH=@m')).recordset[0];
  if (!o) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
  const phieu = (await pool.request().input('id', sql.Int, o.DonHangID).query(
    `SELECT ISNULL(TenPhieu, N'') AS TenPhieu, COUNT(*) AS SoDong FROM DonHangHangMucGiaCong WHERE DonHangID=@id GROUP BY ISNULL(TenPhieu, N'') ORDER BY ISNULL(TenPhieu, N'')`)).recordset;
  res.json({ success: true, order: { MaDH: o.MaDH, TenSanPham: o.TenSanPham, MaRap: await maRapOf(pool, o.DonHangID) }, data: phieu });
});
router.get('/dongiagiacong/:maDH', requireAuth, requirePermission('QLSX', 'view'), async (req, res) => {
  const pool = await getPool();
  const o = (await pool.request().input('m', sql.NVarChar, req.params.maDH).query('SELECT DonHangID, MaDH, TenSanPham FROM DonHangSanXuat WHERE MaDH=@m')).recordset[0];
  if (!o) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
  const catalog = (await pool.request().query('SELECT HangMucGiaCongID, TenHangMuc, DonGiaMacDinh FROM HangMucGiaCong ORDER BY TenHangMuc')).recordset;
  const hasTen = req.query.ten !== undefined;
  const ten = req.query.ten != null ? String(req.query.ten) : '';
  const rq = pool.request().input('id', sql.Int, o.DonHangID);
  if (hasTen) rq.input('ten', sql.NVarChar, ten);
  const chosen = (await rq.query(`
    SELECT dhg.HangMucGiaCongID, hm.TenHangMuc, ISNULL(dhg.DonGia, hm.DonGiaMacDinh) AS DonGia
    FROM DonHangHangMucGiaCong dhg JOIN HangMucGiaCong hm ON hm.HangMucGiaCongID = dhg.HangMucGiaCongID
    WHERE dhg.DonHangID = @id${hasTen ? ` AND ISNULL(dhg.TenPhieu, N'')=@ten` : ''} ORDER BY hm.TenHangMuc`)).recordset;
  res.json({ success: true, order: { MaDH: o.MaDH, TenSanPham: o.TenSanPham, MaRap: await maRapOf(pool, o.DonHangID) }, catalog, chosen });
});
router.post('/dongiagiacong/:maDH', requireAuth, requirePermission('QLSX', 'edit'), async (req, res) => {
  try {
    const pool = await getPool();
    const o = (await pool.request().input('m', sql.NVarChar, req.params.maDH).query('SELECT DonHangID FROM DonHangSanXuat WHERE MaDH=@m')).recordset[0];
    if (!o) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    const seen = new Set();
    const items = (Array.isArray(req.body.items) ? req.body.items : []).filter(it => it.hangMucGiaCongId && !seen.has(String(it.hangMucGiaCongId)) && seen.add(String(it.hangMucGiaCongId)));
    const ten = req.body.ten != null ? String(req.body.ten).trim() : '';
    const oldTen = req.body.oldTen != null ? String(req.body.oldTen) : ten;
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      await new sql.Request(tx).input('id', sql.Int, o.DonHangID).input('ot', sql.NVarChar, oldTen)
        .query(`DELETE FROM DonHangHangMucGiaCong WHERE DonHangID=@id AND ISNULL(TenPhieu, N'')=@ot`);
      for (const it of items) {
        await new sql.Request(tx).input('DonHangID', sql.Int, o.DonHangID).input('HangMucGiaCongID', sql.Int, it.hangMucGiaCongId)
          .input('DonGia', sql.Decimal(14, 2), Number(it.donGia) || 0).input('HeSo', sql.Decimal(10, 4), 1).input('TenPhieu', sql.NVarChar, ten || null)
          .query('INSERT INTO DonHangHangMucGiaCong (DonHangID, HangMucGiaCongID, DonGia, HeSo, TenPhieu) VALUES (@DonHangID,@HangMucGiaCongID,@DonGia,@HeSo,@TenPhieu)');
      }
      await tx.commit();
    } catch (e) { await tx.rollback(); throw e; }
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: 'Lỗi khi lưu đơn giá giao gia công: ' + err.message }); }
});
router.delete('/dongiagiacong/:maDH', requireAuth, requirePermission('QLSX', 'delete'), async (req, res) => {
  const pool = await getPool();
  const o = (await pool.request().input('m', sql.NVarChar, req.params.maDH).query('SELECT DonHangID FROM DonHangSanXuat WHERE MaDH=@m')).recordset[0];
  if (!o) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
  const ten = req.query.ten != null ? String(req.query.ten) : '';
  await pool.request().input('id', sql.Int, o.DonHangID).input('ten', sql.NVarChar, ten)
    .query(`DELETE FROM DonHangHangMucGiaCong WHERE DonHangID=@id AND ISNULL(TenPhieu, N'')=@ten`);
  res.json({ success: true });
});
router.post('/dongiagiacong-hangmuc', requireAuth, requirePermission('QLSX', 'create'), async (req, res) => {
  try {
    const { tenHangMuc } = req.body;
    if (!tenHangMuc) return res.status(400).json({ success: false, message: 'Thiếu tên hạng mục.' });
    const pool = await getPool();
    const r = await pool.request().input('Ten', sql.NVarChar, tenHangMuc)
      .query('INSERT INTO HangMucGiaCong (TenHangMuc, HeSoMacDinh) OUTPUT INSERTED.HangMucGiaCongID, INSERTED.TenHangMuc, INSERTED.DonGiaMacDinh VALUES (@Ten, 1)');
    res.json({ success: true, data: r.recordset[0] });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: 'Lỗi (tên hạng mục có thể đã tồn tại): ' + err.message }); }
});

/* ================================================================================================
   1. TAI LIEU KY THUAT CHUNG - cac "muc" danh so (ThuTu), moi muc 1 TieuDe + nhieu "dong" noi dung.
   Luu (POST) la GHI DE TOAN BO muc/dong (xoa het muc cu - CASCADE xoa dong theo - roi chen lai tu dau
   theo dung thu tu mang gui len) - khac han pattern "chi them dong, xoa tung dong rieng" cua Giao vai/
   Phu kien/So do trong Ghi nhan tien do (xem module.qlsx.js): o day nguoi dung soan/sua CA tai lieu
   cung luc nhu 1 van ban hoan chinh (giong sua 1 file Word), khong phai lien tuc bo sung tung dong
   nhat thoi diem khac nhau, nen "Luu = ghi de toan bo" la mo hinh phu hop hon, don gian hon cho ca
   frontend (khong can dong bo ID tung dong) lan nguoi dung (WYSIWYG - thay gi luu nay).
   ================================================================================================ */
async function getTaiLieuChungDetail(pool, id) {
  const header = (await pool.request().input('id', sql.Int, id).query(`
    SELECT tl.*, u.HoTen AS NguoiLap FROM TaiLieuKyThuatChung tl
    LEFT JOIN Users u ON u.UserID = tl.NguoiLapID WHERE tl.ID = @id`)).recordset[0];
  if (!header) return null;
  const mucRows = (await pool.request().input('id', sql.Int, id).query(`
    SELECT * FROM TaiLieuKyThuatChungMuc WHERE TaiLieuID = @id ORDER BY ThuTu`)).recordset;
  const mucIds = mucRows.map(m => m.ID);
  let dongRows = [];
  if (mucIds.length) {
    dongRows = (await pool.request().query(`
      SELECT * FROM TaiLieuKyThuatChungDong WHERE MucID IN (${mucIds.join(',')}) ORDER BY ThuTu`)).recordset;
  }
  const muc = mucRows.map(m => ({
    tieuDe: m.TieuDe,
    dong: dongRows.filter(d => d.MucID === m.ID).map(d => ({ noiDung: d.NoiDung }))
  }));
  return {
    id: header.ID, laMau: !!header.LaMau, tenMau: header.TenMau, maHang: header.MaHang,
    dienGiai: header.DienGiai, ngayCapNhat: header.NgayCapNhat, nguoiLap: header.NguoiLap,
    tenPhieu: header.TenPhieu || '', muc
  };
}

// Ghi de toan bo muc/dong cua 1 TaiLieuKyThuatChung.ID da co san (dung chung cho ca tai lieu gan don
// hang lan tai lieu mau - ID va tinh hop le (LaMau/DonHangID) da duoc kiem tra truoc do o noi goi).
async function replaceMucDong(pool, taiLieuId, mucArr) {
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    await new sql.Request(transaction).input('id', sql.Int, taiLieuId)
      .query('DELETE FROM TaiLieuKyThuatChungMuc WHERE TaiLieuID = @id');
    let thuTuMuc = 0;
    for (const m of (mucArr || [])) {
      const insMuc = await new sql.Request(transaction)
        .input('TaiLieuID', sql.Int, taiLieuId)
        .input('ThuTu', sql.Int, thuTuMuc++)
        .input('TieuDe', sql.NVarChar, m.tieuDe || null)
        .query('INSERT INTO TaiLieuKyThuatChungMuc (TaiLieuID, ThuTu, TieuDe) OUTPUT INSERTED.ID VALUES (@TaiLieuID, @ThuTu, @TieuDe)');
      const mucId = insMuc.recordset[0].ID;
      let thuTuDong = 0;
      for (const d of (m.dong || [])) {
        if (!d || !d.noiDung) continue;
        await new sql.Request(transaction)
          .input('MucID', sql.Int, mucId).input('NoiDung', sql.NVarChar(sql.MAX), d.noiDung)
          .input('ThuTu', sql.Int, thuTuDong++)
          .query('INSERT INTO TaiLieuKyThuatChungDong (MucID, NoiDung, ThuTu) VALUES (@MucID, @NoiDung, @ThuTu)');
      }
    }
    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

// v5.56: danh sách BẢN (nhiều bản có tên/đơn). GROUP theo ISNULL(TenPhieu,'').
router.get('/tailieuchung/:maDH/phieu', requireAuth, requirePermission('QLSX', 'view'), async (req, res) => {
  const pool = await getPool();
  const order = await getOrderBasic(pool, req.params.maDH);
  if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
  const phieu = (await pool.request().input('id', sql.Int, order.DonHangID).query(
    `SELECT ISNULL(TenPhieu, N'') AS TenPhieu FROM TaiLieuKyThuatChung WHERE DonHangID=@id AND LaMau=0 ORDER BY ISNULL(TenPhieu, N'')`)).recordset;
  res.json({ success: true, order, data: phieu });
});

router.get('/tailieuchung/:maDH', requireAuth, requirePermission('QLSX', 'view'), async (req, res) => {
  const pool = await getPool();
  const order = await getOrderBasic(pool, req.params.maDH);
  if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
  const hasTen = req.query.ten !== undefined;   // có ?ten= (kể cả rỗng) = lấy đúng bản; không có = bản đầu (in gộp/tương thích cũ)
  const ten = req.query.ten != null ? String(req.query.ten) : '';
  const row = (await pool.request().input('id', sql.Int, order.DonHangID).input('ten', sql.NVarChar, ten).query(
    hasTen
      ? `SELECT TOP 1 ID FROM TaiLieuKyThuatChung WHERE DonHangID=@id AND LaMau=0 AND ISNULL(TenPhieu, N'')=@ten ORDER BY ID`
      : `SELECT TOP 1 ID FROM TaiLieuKyThuatChung WHERE DonHangID=@id AND LaMau=0 ORDER BY ISNULL(TenPhieu, N''), ID`)).recordset[0];
  res.json({ success: true, data: row ? await getTaiLieuChungDetail(pool, row.ID) : null, order });
});

router.post('/tailieuchung/:maDH', requireAuth, requirePermission('QLSX', 'edit'), async (req, res) => {
  try {
    const pool = await getPool();
    const order = await getOrderBasic(pool, req.params.maDH);
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    const { maHang, dienGiai, ngayCapNhat, muc } = req.body;
    const ten = req.body.ten != null ? String(req.body.ten).trim() : '';
    const oldTen = req.body.oldTen != null ? String(req.body.oldTen) : ten;   // hỗ trợ đổi tên bản
    let row = (await pool.request().input('id', sql.Int, order.DonHangID).input('ot', sql.NVarChar, oldTen).query(
      `SELECT ID FROM TaiLieuKyThuatChung WHERE DonHangID=@id AND LaMau=0 AND ISNULL(TenPhieu, N'')=@ot`)).recordset[0];
    let taiLieuId;
    if (row) {
      taiLieuId = row.ID;
      await pool.request()
        .input('id', sql.Int, taiLieuId).input('MaHang', sql.NVarChar, maHang || null)
        .input('DienGiai', sql.NVarChar, dienGiai || null).input('NgayCapNhat', sql.Date, ngayCapNhat || null)
        .input('NguoiLapID', sql.Int, req.session.user.userId).input('TenPhieu', sql.NVarChar, ten || null)
        .query(`UPDATE TaiLieuKyThuatChung SET MaHang=@MaHang, DienGiai=@DienGiai, NgayCapNhat=@NgayCapNhat,
                NguoiLapID=@NguoiLapID, TenPhieu=@TenPhieu, UpdatedAt=SYSDATETIME() WHERE ID=@id`);
    } else {
      const ins = await pool.request()
        .input('DonHangID', sql.Int, order.DonHangID).input('MaHang', sql.NVarChar, maHang || null)
        .input('DienGiai', sql.NVarChar, dienGiai || null).input('NgayCapNhat', sql.Date, ngayCapNhat || null)
        .input('NguoiLapID', sql.Int, req.session.user.userId).input('TenPhieu', sql.NVarChar, ten || null)
        .query(`INSERT INTO TaiLieuKyThuatChung (DonHangID, LaMau, MaHang, DienGiai, NgayCapNhat, NguoiLapID, TenPhieu)
                OUTPUT INSERTED.ID VALUES (@DonHangID, 0, @MaHang, @DienGiai, @NgayCapNhat, @NguoiLapID, @TenPhieu)`);
      taiLieuId = ins.recordset[0].ID;
    }
    await replaceMucDong(pool, taiLieuId, muc);
    res.json({ success: true, data: await getTaiLieuChungDetail(pool, taiLieuId) });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Lỗi khi lưu tài liệu kỹ thuật chung: ' + err.message });
  }
});

router.delete('/tailieuchung/:maDH', requireAuth, requirePermission('QLSX', 'delete'), async (req, res) => {
  const pool = await getPool();
  const order = await getOrderBasic(pool, req.params.maDH);
  if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
  const ten = req.query.ten != null ? String(req.query.ten) : '';
  await pool.request().input('id', sql.Int, order.DonHangID).input('ten', sql.NVarChar, ten)
    .query(`DELETE FROM TaiLieuKyThuatChung WHERE DonHangID=@id AND LaMau=0 AND ISNULL(TenPhieu, N'')=@ten`);
  res.json({ success: true });
});

// ---- Tai lieu MAU (LaMau=1, khong gan don hang - dung de "lay tu tai lieu mau" khi tao moi) ----
router.get('/tailieuchung-mau', requireAuth, requirePermission('QLSX', 'view'), async (req, res) => {
  const pool = await getPool();
  const result = await pool.request().query('SELECT ID, TenMau FROM TaiLieuKyThuatChung WHERE LaMau = 1 ORDER BY TenMau');
  res.json({ success: true, data: result.recordset });
});

router.get('/tailieuchung-mau/:id', requireAuth, requirePermission('QLSX', 'view'), async (req, res) => {
  const pool = await getPool();
  const data = await getTaiLieuChungDetail(pool, req.params.id);
  if (!data || !data.laMau) return res.status(404).json({ success: false, message: 'Không tìm thấy tài liệu mẫu.' });
  res.json({ success: true, data });
});

router.post('/tailieuchung-mau', requireAuth, requirePermission('QLSX', 'edit'), async (req, res) => {
  try {
    const pool = await getPool();
    const { tenMau, muc } = req.body;
    if (!tenMau) return res.status(400).json({ success: false, message: 'Thiếu tên mẫu.' });
    const ins = await pool.request().input('TenMau', sql.NVarChar, tenMau).input('NguoiLapID', sql.Int, req.session.user.userId)
      .query(`INSERT INTO TaiLieuKyThuatChung (DonHangID, LaMau, TenMau, NguoiLapID) OUTPUT INSERTED.ID VALUES (NULL, 1, @TenMau, @NguoiLapID)`);
    const taiLieuId = ins.recordset[0].ID;
    await replaceMucDong(pool, taiLieuId, muc);
    res.json({ success: true, data: await getTaiLieuChungDetail(pool, taiLieuId) });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Lỗi khi lưu tài liệu mẫu: ' + err.message });
  }
});

router.put('/tailieuchung-mau/:id', requireAuth, requirePermission('QLSX', 'edit'), async (req, res) => {
  try {
    const pool = await getPool();
    const { tenMau, muc } = req.body;
    const row = (await pool.request().input('id', sql.Int, req.params.id).query('SELECT ID FROM TaiLieuKyThuatChung WHERE ID=@id AND LaMau=1')).recordset[0];
    if (!row) return res.status(404).json({ success: false, message: 'Không tìm thấy tài liệu mẫu.' });
    await pool.request().input('id', sql.Int, req.params.id).input('TenMau', sql.NVarChar, tenMau || null)
      .query('UPDATE TaiLieuKyThuatChung SET TenMau=@TenMau, UpdatedAt=SYSDATETIME() WHERE ID=@id');
    await replaceMucDong(pool, Number(req.params.id), muc);
    res.json({ success: true, data: await getTaiLieuChungDetail(pool, req.params.id) });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Lỗi khi lưu tài liệu mẫu: ' + err.message });
  }
});

router.delete('/tailieuchung-mau/:id', requireAuth, requirePermission('QLSX', 'delete'), async (req, res) => {
  await (await getPool()).request().input('id', sql.Int, req.params.id).query('DELETE FROM TaiLieuKyThuatChung WHERE ID=@id AND LaMau=1');
  res.json({ success: true });
});

/* ================================================================================================
   2. THONG SO DO - bang Size x Vi tri do. Luu (POST) GHI DE TOAN BO cot/dong/gia tri, dung mang
   "values" gui theo DUNG THU TU cot hien tai (khong dua theo ID cot cu - cot cu bi xoa het moi lan
   luu, giong ly do da giai thich o Tai lieu ky thuat chung ben tren).
   ================================================================================================ */
async function getThongSoDoDetail(pool, id) {
  const header = (await pool.request().input('id', sql.Int, id).query(`
    SELECT tl.*, u.HoTen AS NguoiLap FROM TaiLieuThongSoDo tl
    LEFT JOIN Users u ON u.UserID = tl.NguoiLapID WHERE tl.ID = @id`)).recordset[0];
  if (!header) return null;
  const cols = (await pool.request().input('id', sql.Int, id).query(
    'SELECT * FROM TaiLieuThongSoDoCot WHERE TaiLieuID=@id ORDER BY ThuTu')).recordset;
  const rows = (await pool.request().input('id', sql.Int, id).query(
    'SELECT * FROM TaiLieuThongSoDoDong WHERE TaiLieuID=@id ORDER BY ThuTu')).recordset;
  const rowIds = rows.map(r => r.ID);
  let vals = [];
  if (rowIds.length) {
    vals = (await pool.request().query(`SELECT * FROM TaiLieuThongSoDoGiaTri WHERE DongID IN (${rowIds.join(',')})`)).recordset;
  }
  // v5.58 (biểu mẫu mới theo thongsodo.xls): DÒNG = THÔNG SỐ (+Vị trí đo +dung sai), CỘT = SIZE.
  // yeuCauKyThuat = khối "Ghi chú / YÊU CẦU KỸ THUẬT"; anhGhiChu = mảng URL ảnh (lưu JSON).
  let anhGhiChu = [];
  try { anhGhiChu = header.AnhGhiChu ? JSON.parse(header.AnhGhiChu) : []; } catch (e) { anhGhiChu = []; }
  if (!Array.isArray(anhGhiChu)) anhGhiChu = [];
  return {
    id: header.ID, maHang: header.MaHang, dienGiai: header.DienGiai, ngayCapNhat: header.NgayCapNhat,
    nguoiLap: header.NguoiLap, tenPhieu: header.TenPhieu || '',
    yeuCauKyThuat: header.YeuCauKyThuat || '', anhGhiChu,
    cols: cols.map(c => ({ tenCot: c.TenCot })),
    rows: rows.map(r => ({
      tenDong: r.TenDong, viTriDo: r.ViTriDo || '', dungSai: r.DungSai || '',
      values: cols.map(c => { const v = vals.find(x => x.DongID === r.ID && x.CotID === c.ID); return v ? v.GiaTri : ''; })
    }))
  };
}

async function replaceThongSoDoGrid(pool, taiLieuId, colsArr, rowsArr) {
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    // v5.44.3 FIX: xóa GiaTri (bảng con — FK tới CotID + DongID) TRƯỚC khi xóa Cột/Dòng. Nếu xóa Cột
    // trước sẽ vi phạm FK "DELETE ... conflicted with REFERENCE constraint ...GiaTri...CotID" khi lưu lại.
    await new sql.Request(transaction).input('id', sql.Int, taiLieuId)
      .query('DELETE FROM TaiLieuThongSoDoGiaTri WHERE DongID IN (SELECT ID FROM TaiLieuThongSoDoDong WHERE TaiLieuID=@id)');
    await new sql.Request(transaction).input('id', sql.Int, taiLieuId).query('DELETE FROM TaiLieuThongSoDoCot WHERE TaiLieuID=@id');
    await new sql.Request(transaction).input('id', sql.Int, taiLieuId).query('DELETE FROM TaiLieuThongSoDoDong WHERE TaiLieuID=@id');
    const colIds = [];
    let thuTu = 0;
    for (const c of (colsArr || [])) {
      const ins = await new sql.Request(transaction).input('TaiLieuID', sql.Int, taiLieuId)
        .input('TenCot', sql.NVarChar, c.tenCot || '').input('ThuTu', sql.Int, thuTu++)
        .query('INSERT INTO TaiLieuThongSoDoCot (TaiLieuID, TenCot, ThuTu) OUTPUT INSERTED.ID VALUES (@TaiLieuID, @TenCot, @ThuTu)');
      colIds.push(ins.recordset[0].ID);
    }
    thuTu = 0;
    for (const r of (rowsArr || [])) {
      // v5.58: +ViTriDo (cách đo) +DungSai (+/-) theo biểu mẫu mới.
      const insRow = await new sql.Request(transaction).input('TaiLieuID', sql.Int, taiLieuId)
        .input('TenDong', sql.NVarChar, r.tenDong || '').input('ThuTu', sql.Int, thuTu++)
        .input('ViTriDo', sql.NVarChar, r.viTriDo || null).input('DungSai', sql.NVarChar, r.dungSai || null)
        .query('INSERT INTO TaiLieuThongSoDoDong (TaiLieuID, TenDong, ThuTu, ViTriDo, DungSai) OUTPUT INSERTED.ID VALUES (@TaiLieuID, @TenDong, @ThuTu, @ViTriDo, @DungSai)');
      const dongId = insRow.recordset[0].ID;
      const values = r.values || [];
      for (let i = 0; i < colIds.length; i++) {
        const gt = values[i];
        if (gt === undefined || gt === null || gt === '') continue;
        await new sql.Request(transaction).input('DongID', sql.Int, dongId).input('CotID', sql.Int, colIds[i])
          .input('GiaTri', sql.NVarChar, String(gt))
          .query('INSERT INTO TaiLieuThongSoDoGiaTri (DongID, CotID, GiaTri) VALUES (@DongID, @CotID, @GiaTri)');
      }
    }
    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

// v5.56: danh sách BẢN. Mẫu (LaMau=1) có DonHangID NULL nên WHERE DonHangID=@id đã loại sẵn.
router.get('/thongsodo/:maDH/phieu', requireAuth, requirePermission('QLSX', 'view'), async (req, res) => {
  const pool = await getPool();
  const order = await getOrderBasic(pool, req.params.maDH);
  if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
  const phieu = (await pool.request().input('id', sql.Int, order.DonHangID).query(
    `SELECT ISNULL(TenPhieu, N'') AS TenPhieu FROM TaiLieuThongSoDo WHERE DonHangID=@id ORDER BY ISNULL(TenPhieu, N'')`)).recordset;
  res.json({ success: true, order, data: phieu });
});

router.get('/thongsodo/:maDH', requireAuth, requirePermission('QLSX', 'view'), async (req, res) => {
  const pool = await getPool();
  const order = await getOrderBasic(pool, req.params.maDH);
  if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
  const hasTen = req.query.ten !== undefined;
  const ten = req.query.ten != null ? String(req.query.ten) : '';
  const row = (await pool.request().input('id', sql.Int, order.DonHangID).input('ten', sql.NVarChar, ten).query(
    hasTen
      ? `SELECT TOP 1 ID FROM TaiLieuThongSoDo WHERE DonHangID=@id AND ISNULL(TenPhieu, N'')=@ten ORDER BY ID`
      : `SELECT TOP 1 ID FROM TaiLieuThongSoDo WHERE DonHangID=@id ORDER BY ISNULL(TenPhieu, N''), ID`)).recordset[0];
  res.json({ success: true, data: row ? await getThongSoDoDetail(pool, row.ID) : null, order });
});

router.post('/thongsodo/:maDH', requireAuth, requirePermission('QLSX', 'edit'), async (req, res) => {
  try {
    const pool = await getPool();
    const order = await getOrderBasic(pool, req.params.maDH);
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    const { maHang, dienGiai, ngayCapNhat, cols, rows } = req.body;
    const ten = req.body.ten != null ? String(req.body.ten).trim() : '';
    const oldTen = req.body.oldTen != null ? String(req.body.oldTen) : ten;
    // v5.58: khối "Ghi chú / YÊU CẦU KỸ THUẬT" + ảnh minh hoạ (lưu JSON) theo biểu mẫu mới.
    const yeuCauKyThuat = req.body.yeuCauKyThuat != null ? String(req.body.yeuCauKyThuat) : null;
    const anhGhiChuJson = JSON.stringify(Array.isArray(req.body.anhGhiChu) ? req.body.anhGhiChu : []);
    let row = (await pool.request().input('id', sql.Int, order.DonHangID).input('ot', sql.NVarChar, oldTen)
      .query(`SELECT ID FROM TaiLieuThongSoDo WHERE DonHangID=@id AND ISNULL(TenPhieu, N'')=@ot`)).recordset[0];
    let taiLieuId;
    if (row) {
      taiLieuId = row.ID;
      await pool.request().input('id', sql.Int, taiLieuId).input('MaHang', sql.NVarChar, maHang || null)
        .input('DienGiai', sql.NVarChar, dienGiai || null).input('NgayCapNhat', sql.Date, ngayCapNhat || null)
        .input('NguoiLapID', sql.Int, req.session.user.userId).input('TenPhieu', sql.NVarChar, ten || null)
        .input('YeuCauKyThuat', sql.NVarChar(sql.MAX), yeuCauKyThuat).input('AnhGhiChu', sql.NVarChar(sql.MAX), anhGhiChuJson)
        .query(`UPDATE TaiLieuThongSoDo SET MaHang=@MaHang, DienGiai=@DienGiai, NgayCapNhat=@NgayCapNhat,
                NguoiLapID=@NguoiLapID, TenPhieu=@TenPhieu, YeuCauKyThuat=@YeuCauKyThuat, AnhGhiChu=@AnhGhiChu,
                UpdatedAt=SYSDATETIME() WHERE ID=@id`);
    } else {
      const ins = await pool.request().input('DonHangID', sql.Int, order.DonHangID).input('MaHang', sql.NVarChar, maHang || null)
        .input('DienGiai', sql.NVarChar, dienGiai || null).input('NgayCapNhat', sql.Date, ngayCapNhat || null)
        .input('NguoiLapID', sql.Int, req.session.user.userId).input('TenPhieu', sql.NVarChar, ten || null)
        .input('YeuCauKyThuat', sql.NVarChar(sql.MAX), yeuCauKyThuat).input('AnhGhiChu', sql.NVarChar(sql.MAX), anhGhiChuJson)
        .query(`INSERT INTO TaiLieuThongSoDo (DonHangID, MaHang, DienGiai, NgayCapNhat, NguoiLapID, TenPhieu, YeuCauKyThuat, AnhGhiChu)
                OUTPUT INSERTED.ID VALUES (@DonHangID, @MaHang, @DienGiai, @NgayCapNhat, @NguoiLapID, @TenPhieu, @YeuCauKyThuat, @AnhGhiChu)`);
      taiLieuId = ins.recordset[0].ID;
    }
    await replaceThongSoDoGrid(pool, taiLieuId, cols, rows);
    res.json({ success: true, data: await getThongSoDoDetail(pool, taiLieuId) });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Lỗi khi lưu thông số đo: ' + err.message });
  }
});

router.delete('/thongsodo/:maDH', requireAuth, requirePermission('QLSX', 'delete'), async (req, res) => {
  const pool = await getPool();
  const order = await getOrderBasic(pool, req.params.maDH);
  if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
  const ten = req.query.ten != null ? String(req.query.ten) : '';
  // v5.44.3: xóa CON trước (GiaTri → Cột/Dòng → header) tránh vi phạm FK giống lỗi lúc lưu. v5.56: theo BẢN (TenPhieu).
  await pool.request().input('id', sql.Int, order.DonHangID).input('ten', sql.NVarChar, ten)
    .query(`DELETE FROM TaiLieuThongSoDoGiaTri WHERE DongID IN (SELECT d.ID FROM TaiLieuThongSoDoDong d JOIN TaiLieuThongSoDo t ON t.ID = d.TaiLieuID WHERE t.DonHangID=@id AND ISNULL(t.TenPhieu, N'')=@ten)`);
  await pool.request().input('id', sql.Int, order.DonHangID).input('ten', sql.NVarChar, ten)
    .query(`DELETE FROM TaiLieuThongSoDoCot WHERE TaiLieuID IN (SELECT ID FROM TaiLieuThongSoDo WHERE DonHangID=@id AND ISNULL(TenPhieu, N'')=@ten)`);
  await pool.request().input('id', sql.Int, order.DonHangID).input('ten', sql.NVarChar, ten)
    .query(`DELETE FROM TaiLieuThongSoDoDong WHERE TaiLieuID IN (SELECT ID FROM TaiLieuThongSoDo WHERE DonHangID=@id AND ISNULL(TenPhieu, N'')=@ten)`);
  await pool.request().input('id', sql.Int, order.DonHangID).input('ten', sql.NVarChar, ten)
    .query(`DELETE FROM TaiLieuThongSoDo WHERE DonHangID=@id AND ISNULL(TenPhieu, N'')=@ten`);
  res.json({ success: true });
});

// v5.34e: MAU "Thông số kỹ thuật" (LaMau=1, DonHangID NULL). Mirror pattern tailieuchung-mau. Ap mau = frontend
// tai detail roi copy cols/rows vao state (khong co route "apply" rieng).
router.get('/thongsodo-mau', requireAuth, requirePermission('QLSX', 'view'), async (req, res) => {
  const pool = await getPool();
  const rows = (await pool.request().query('SELECT ID, TenMau FROM TaiLieuThongSoDo WHERE LaMau=1 ORDER BY TenMau')).recordset;
  res.json({ success: true, data: rows });
});
router.get('/thongsodo-mau/:id', requireAuth, requirePermission('QLSX', 'view'), async (req, res) => {
  const pool = await getPool();
  const h = (await pool.request().input('id', sql.Int, req.params.id).query('SELECT LaMau FROM TaiLieuThongSoDo WHERE ID=@id')).recordset[0];
  if (!h || !h.LaMau) return res.status(404).json({ success: false, message: 'Không tìm thấy mẫu.' });
  res.json({ success: true, data: await getThongSoDoDetail(pool, req.params.id) });
});
router.post('/thongsodo-mau', requireAuth, requirePermission('QLSX', 'edit'), async (req, res) => {
  try {
    const { tenMau, cols, rows } = req.body;
    if (!tenMau) return res.status(400).json({ success: false, message: 'Thiếu tên mẫu.' });
    const pool = await getPool();
    const ins = await pool.request().input('TenMau', sql.NVarChar, tenMau).input('NguoiLapID', sql.Int, req.session.user.userId)
      .query('INSERT INTO TaiLieuThongSoDo (DonHangID, LaMau, TenMau, NguoiLapID) OUTPUT INSERTED.ID VALUES (NULL, 1, @TenMau, @NguoiLapID)');
    await replaceThongSoDoGrid(pool, ins.recordset[0].ID, cols, rows);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: 'Lỗi khi lưu mẫu thông số: ' + err.message }); }
});
router.delete('/thongsodo-mau/:id', requireAuth, requirePermission('QLSX', 'delete'), async (req, res) => {
  await (await getPool()).request().input('id', sql.Int, req.params.id).query('DELETE FROM TaiLieuThongSoDo WHERE ID=@id AND LaMau=1');
  res.json({ success: true });
});
// v5.44.6: ĐỔI TÊN mẫu (rename) — chỉ cập nhật TenMau, không đụng cột/dòng.
router.put('/thongsodo-mau/:id', requireAuth, requirePermission('QLSX', 'edit'), async (req, res) => {
  try {
    const { tenMau } = req.body;
    if (!tenMau || !String(tenMau).trim()) return res.status(400).json({ success: false, message: 'Thiếu tên mẫu.' });
    const pool = await getPool();
    const upd = await pool.request().input('id', sql.Int, req.params.id).input('TenMau', sql.NVarChar, String(tenMau).trim())
      .query('UPDATE TaiLieuThongSoDo SET TenMau=@TenMau WHERE ID=@id AND LaMau=1');
    if (!upd.rowsAffected[0]) return res.status(404).json({ success: false, message: 'Không tìm thấy mẫu.' });
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: 'Lỗi khi đổi tên mẫu: ' + err.message }); }
});

/* ================================================================================================
   4. MO TA SAN PHAM - luoi cac o "Khoang trong" (Dong,Cot) de dan/tai anh + 1 truong Chu y tu do.
   Luu (POST) GHI DE TOAN BO luoi o (giong 2 muc tren) - anh THAT SU (bytes) da duoc tai len truoc do
   qua /api/upload (dung chung uploadFile() da co san, xem module.tailieukythuat.js), route nay chi
   luu lai DUONG DAN (AnhUrl) da tra ve, khong xu ly file truc tiep.
   ================================================================================================ */
async function getMoTaSanPhamDetail(pool, id) {
  const header = (await pool.request().input('id', sql.Int, id).query(`
    SELECT tl.*, u.HoTen AS NguoiLap FROM TaiLieuMoTaSanPham tl
    LEFT JOIN Users u ON u.UserID = tl.NguoiLapID WHERE tl.ID = @id`)).recordset[0];
  if (!header) return null;
  const oGrid = (await pool.request().input('id', sql.Int, id).query(
    'SELECT * FROM TaiLieuMoTaSanPhamO WHERE TaiLieuID=@id ORDER BY Dong, Cot')).recordset;
  return {
    id: header.ID, maHang: header.MaHang, dienGiai: header.DienGiai, ngayCapNhat: header.NgayCapNhat,
    nguoiLap: header.NguoiLap, chuY: header.ChuY, tenPhieu: header.TenPhieu || '',
    oGrid: oGrid.map(o => ({ dong: o.Dong, cot: o.Cot, anhUrl: o.AnhUrl, chuThich: o.ChuThich }))
  };
}

async function replaceOGrid(pool, taiLieuId, oGridArr) {
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    await new sql.Request(transaction).input('id', sql.Int, taiLieuId).query('DELETE FROM TaiLieuMoTaSanPhamO WHERE TaiLieuID=@id');
    for (const o of (oGridArr || [])) {
      if (!o.anhUrl && !o.chuThich) continue;
      await new sql.Request(transaction).input('TaiLieuID', sql.Int, taiLieuId)
        .input('Dong', sql.Int, o.dong || 0).input('Cot', sql.Int, o.cot || 0)
        .input('AnhUrl', sql.NVarChar, o.anhUrl || null).input('ChuThich', sql.NVarChar, o.chuThich || null)
        .query('INSERT INTO TaiLieuMoTaSanPhamO (TaiLieuID, Dong, Cot, AnhUrl, ChuThich) VALUES (@TaiLieuID, @Dong, @Cot, @AnhUrl, @ChuThich)');
    }
    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

// v5.34c: 3 loai anh-luoi dung chung (motasp | quycach | hinhanhinthue) - phan biet ?loai=.
function motaLoai(req) { return ['motasp', 'quycach', 'hinhanhinthue'].includes(req.query.loai) ? req.query.loai : 'motasp'; }
// v5.56: danh sách BẢN theo (đơn, Loai). Mẫu (LaMau=1) DonHangID NULL nên WHERE DonHangID=@id đã loại.
router.get('/motasp/:maDH/phieu', requireAuth, requirePermission('QLSX', 'view'), async (req, res) => {
  const pool = await getPool();
  const order = await getOrderBasic(pool, req.params.maDH);
  if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
  const phieu = (await pool.request().input('id', sql.Int, order.DonHangID).input('loai', sql.NVarChar, motaLoai(req)).query(
    `SELECT ISNULL(TenPhieu, N'') AS TenPhieu FROM TaiLieuMoTaSanPham WHERE DonHangID=@id AND Loai=@loai ORDER BY ISNULL(TenPhieu, N'')`)).recordset;
  res.json({ success: true, order, data: phieu });
});

router.get('/motasp/:maDH', requireAuth, requirePermission('QLSX', 'view'), async (req, res) => {
  const pool = await getPool();
  const order = await getOrderBasic(pool, req.params.maDH);
  if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
  const hasTen = req.query.ten !== undefined;
  const ten = req.query.ten != null ? String(req.query.ten) : '';
  const row = (await pool.request().input('id', sql.Int, order.DonHangID).input('loai', sql.NVarChar, motaLoai(req)).input('ten', sql.NVarChar, ten).query(
    hasTen
      ? `SELECT TOP 1 ID FROM TaiLieuMoTaSanPham WHERE DonHangID=@id AND Loai=@loai AND ISNULL(TenPhieu, N'')=@ten ORDER BY ID`
      : `SELECT TOP 1 ID FROM TaiLieuMoTaSanPham WHERE DonHangID=@id AND Loai=@loai ORDER BY ISNULL(TenPhieu, N''), ID`)).recordset[0];
  res.json({ success: true, data: row ? await getMoTaSanPhamDetail(pool, row.ID) : null, order });
});

router.post('/motasp/:maDH', requireAuth, requirePermission('QLSX', 'edit'), async (req, res) => {
  try {
    const pool = await getPool();
    const order = await getOrderBasic(pool, req.params.maDH);
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    const { maHang, dienGiai, ngayCapNhat, chuY, oGrid } = req.body;
    const loai = motaLoai(req);
    const ten = req.body.ten != null ? String(req.body.ten).trim() : '';
    const oldTen = req.body.oldTen != null ? String(req.body.oldTen) : ten;
    let row = (await pool.request().input('id', sql.Int, order.DonHangID).input('loai', sql.NVarChar, loai).input('ot', sql.NVarChar, oldTen)
      .query(`SELECT ID FROM TaiLieuMoTaSanPham WHERE DonHangID=@id AND Loai=@loai AND ISNULL(TenPhieu, N'')=@ot`)).recordset[0];
    let taiLieuId;
    if (row) {
      taiLieuId = row.ID;
      await pool.request().input('id', sql.Int, taiLieuId).input('MaHang', sql.NVarChar, maHang || null)
        .input('DienGiai', sql.NVarChar, dienGiai || null).input('NgayCapNhat', sql.Date, ngayCapNhat || null)
        .input('ChuY', sql.NVarChar(sql.MAX), chuY || null).input('NguoiLapID', sql.Int, req.session.user.userId).input('TenPhieu', sql.NVarChar, ten || null)
        .query(`UPDATE TaiLieuMoTaSanPham SET MaHang=@MaHang, DienGiai=@DienGiai, NgayCapNhat=@NgayCapNhat,
                ChuY=@ChuY, NguoiLapID=@NguoiLapID, TenPhieu=@TenPhieu, UpdatedAt=SYSDATETIME() WHERE ID=@id`);
    } else {
      const ins = await pool.request().input('DonHangID', sql.Int, order.DonHangID).input('MaHang', sql.NVarChar, maHang || null)
        .input('DienGiai', sql.NVarChar, dienGiai || null).input('NgayCapNhat', sql.Date, ngayCapNhat || null)
        .input('ChuY', sql.NVarChar(sql.MAX), chuY || null).input('NguoiLapID', sql.Int, req.session.user.userId).input('Loai', sql.NVarChar, loai).input('TenPhieu', sql.NVarChar, ten || null)
        .query(`INSERT INTO TaiLieuMoTaSanPham (DonHangID, MaHang, DienGiai, NgayCapNhat, ChuY, NguoiLapID, Loai, TenPhieu)
                OUTPUT INSERTED.ID VALUES (@DonHangID, @MaHang, @DienGiai, @NgayCapNhat, @ChuY, @NguoiLapID, @Loai, @TenPhieu)`);
      taiLieuId = ins.recordset[0].ID;
    }
    await replaceOGrid(pool, taiLieuId, oGrid);
    res.json({ success: true, data: await getMoTaSanPhamDetail(pool, taiLieuId) });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Lỗi khi lưu mô tả sản phẩm: ' + err.message });
  }
});

router.delete('/motasp/:maDH', requireAuth, requirePermission('QLSX', 'delete'), async (req, res) => {
  const pool = await getPool();
  const order = await getOrderBasic(pool, req.params.maDH);
  if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
  const ten = req.query.ten != null ? String(req.query.ten) : '';
  await pool.request().input('id', sql.Int, order.DonHangID).input('loai', sql.NVarChar, motaLoai(req)).input('ten', sql.NVarChar, ten)
    .query(`DELETE FROM TaiLieuMoTaSanPham WHERE DonHangID=@id AND Loai=@loai AND ISNULL(TenPhieu, N'')=@ten`);
  res.json({ success: true });
});

// v5.34e: MAU "Mô tả đường may" / "Quy cách đóng gói" / "Hình ảnh in thêu" (LaMau=1, DonHangID NULL, phan biet
// theo Loai qua ?loai=). Ap mau = frontend tai detail roi copy oGrid vao state.
router.get('/motasp-mau', requireAuth, requirePermission('QLSX', 'view'), async (req, res) => {
  const pool = await getPool();
  const rows = (await pool.request().input('loai', sql.NVarChar, motaLoai(req)).query('SELECT ID, TenMau FROM TaiLieuMoTaSanPham WHERE LaMau=1 AND Loai=@loai ORDER BY TenMau')).recordset;
  res.json({ success: true, data: rows });
});
router.get('/motasp-mau/:id', requireAuth, requirePermission('QLSX', 'view'), async (req, res) => {
  const pool = await getPool();
  const h = (await pool.request().input('id', sql.Int, req.params.id).query('SELECT LaMau FROM TaiLieuMoTaSanPham WHERE ID=@id')).recordset[0];
  if (!h || !h.LaMau) return res.status(404).json({ success: false, message: 'Không tìm thấy mẫu.' });
  res.json({ success: true, data: await getMoTaSanPhamDetail(pool, req.params.id) });
});
router.post('/motasp-mau', requireAuth, requirePermission('QLSX', 'edit'), async (req, res) => {
  try {
    const { tenMau, oGrid } = req.body;
    if (!tenMau) return res.status(400).json({ success: false, message: 'Thiếu tên mẫu.' });
    const loai = motaLoai(req);
    const pool = await getPool();
    const ins = await pool.request().input('TenMau', sql.NVarChar, tenMau).input('Loai', sql.NVarChar, loai).input('NguoiLapID', sql.Int, req.session.user.userId)
      .query('INSERT INTO TaiLieuMoTaSanPham (DonHangID, LaMau, TenMau, Loai, NguoiLapID) OUTPUT INSERTED.ID VALUES (NULL, 1, @TenMau, @Loai, @NguoiLapID)');
    await replaceOGrid(pool, ins.recordset[0].ID, oGrid);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: 'Lỗi khi lưu mẫu: ' + err.message }); }
});
router.delete('/motasp-mau/:id', requireAuth, requirePermission('QLSX', 'delete'), async (req, res) => {
  await (await getPool()).request().input('id', sql.Int, req.params.id).query('DELETE FROM TaiLieuMoTaSanPham WHERE ID=@id AND LaMau=1');
  res.json({ success: true });
});
// v5.44.6: ĐỔI TÊN mẫu (rename) — chỉ cập nhật TenMau (dùng chung cho motasp/quycach/hinhanhinthue qua ID).
router.put('/motasp-mau/:id', requireAuth, requirePermission('QLSX', 'edit'), async (req, res) => {
  try {
    const { tenMau } = req.body;
    if (!tenMau || !String(tenMau).trim()) return res.status(400).json({ success: false, message: 'Thiếu tên mẫu.' });
    const pool = await getPool();
    const upd = await pool.request().input('id', sql.Int, req.params.id).input('TenMau', sql.NVarChar, String(tenMau).trim())
      .query('UPDATE TaiLieuMoTaSanPham SET TenMau=@TenMau WHERE ID=@id AND LaMau=1');
    if (!upd.rowsAffected[0]) return res.status(404).json({ success: false, message: 'Không tìm thấy mẫu.' });
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: 'Lỗi khi đổi tên mẫu: ' + err.message }); }
});

// v5.34c: Đơn giá in thêu (Tài liệu in thêu). Nhiều dòng/đơn: Tên (tự do) / Đơn giá. Lưu = ghi đè toàn bộ.
// v5.56: danh sách BẢN.
router.get('/dongiainthe/:maDH/phieu', requireAuth, requirePermission('QLSX', 'view'), async (req, res) => {
  const pool = await getPool();
  const o = (await pool.request().input('m', sql.NVarChar, req.params.maDH).query('SELECT DonHangID, MaDH, TenSanPham FROM DonHangSanXuat WHERE MaDH=@m')).recordset[0];
  if (!o) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
  const phieu = (await pool.request().input('id', sql.Int, o.DonHangID).query(
    `SELECT ISNULL(TenPhieu, N'') AS TenPhieu, COUNT(*) AS SoDong FROM DonHangDonGiaInThe WHERE DonHangID=@id GROUP BY ISNULL(TenPhieu, N'') ORDER BY ISNULL(TenPhieu, N'')`)).recordset;
  res.json({ success: true, order: { MaDH: o.MaDH, TenSanPham: o.TenSanPham, MaRap: await maRapOf(pool, o.DonHangID) }, data: phieu });
});
router.get('/dongiainthe/:maDH', requireAuth, requirePermission('QLSX', 'view'), async (req, res) => {
  const pool = await getPool();
  const o = (await pool.request().input('m', sql.NVarChar, req.params.maDH).query('SELECT DonHangID, MaDH, TenSanPham FROM DonHangSanXuat WHERE MaDH=@m')).recordset[0];
  if (!o) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
  const hasTen = req.query.ten !== undefined;
  const ten = req.query.ten != null ? String(req.query.ten) : '';
  const rq = pool.request().input('id', sql.Int, o.DonHangID);
  if (hasTen) rq.input('ten', sql.NVarChar, ten);
  // v5.87: + AnhMinhHoa (ảnh từng dòng). Dò cột để màn hình vẫn mở được khi CHƯA chạy migration_v660.
  const coAnh = await coCot(pool, 'DonHangDonGiaInThe', 'AnhMinhHoa');
  const rows = (await rq.query(`SELECT ID, Ten, DonGia${coAnh ? ', AnhMinhHoa' : ", CAST(NULL AS NVARCHAR(500)) AS AnhMinhHoa"} FROM DonHangDonGiaInThe WHERE DonHangID=@id${hasTen ? ` AND ISNULL(TenPhieu, N'')=@ten` : ''} ORDER BY ThuTu, ID`)).recordset;
  res.json({ success: true, order: { MaDH: o.MaDH, TenSanPham: o.TenSanPham, MaRap: await maRapOf(pool, o.DonHangID) }, data: rows });
});
router.post('/dongiainthe/:maDH', requireAuth, requirePermission('QLSX', 'edit'), async (req, res) => {
  try {
    const pool = await getPool();
    const o = (await pool.request().input('m', sql.NVarChar, req.params.maDH).query('SELECT DonHangID FROM DonHangSanXuat WHERE MaDH=@m')).recordset[0];
    if (!o) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    const rows = Array.isArray(req.body.rows) ? req.body.rows.filter(r => (r.ten || '').trim()) : [];
    const tenPhieu = req.body.tenPhieu != null ? String(req.body.tenPhieu).trim() : '';   // LƯU Ý: r.ten là tên DÒNG (hạng mục in thêu), tenPhieu là tên BẢN
    const oldTen = req.body.oldTen != null ? String(req.body.oldTen) : tenPhieu;
    await pool.request().input('id', sql.Int, o.DonHangID).input('ot', sql.NVarChar, oldTen)
      .query(`DELETE FROM DonHangDonGiaInThe WHERE DonHangID=@id AND ISNULL(TenPhieu, N'')=@ot`);
    const coAnh = await coCot(pool, 'DonHangDonGiaInThe', 'AnhMinhHoa');   // v5.87
    let tt = 0;
    for (const r of rows) {
      const rq2 = pool.request().input('DonHangID', sql.Int, o.DonHangID).input('Ten', sql.NVarChar, r.ten)
        .input('DonGia', sql.Decimal(14, 2), r.donGia === '' || r.donGia == null ? null : Number(r.donGia)).input('ThuTu', sql.Int, tt++)
        .input('TenPhieu', sql.NVarChar, tenPhieu || null);
      if (coAnh) rq2.input('AnhMinhHoa', sql.NVarChar, r.anhMinhHoa || null);
      await rq2.query(`INSERT INTO DonHangDonGiaInThe (DonHangID, Ten, DonGia, ThuTu, TenPhieu${coAnh ? ', AnhMinhHoa' : ''})
                       VALUES (@DonHangID,@Ten,@DonGia,@ThuTu,@TenPhieu${coAnh ? ', @AnhMinhHoa' : ''})`);
    }
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: 'Lỗi khi lưu đơn giá in thêu: ' + err.message }); }
});
router.delete('/dongiainthe/:maDH', requireAuth, requirePermission('QLSX', 'delete'), async (req, res) => {
  const pool = await getPool();
  const o = (await pool.request().input('m', sql.NVarChar, req.params.maDH).query('SELECT DonHangID FROM DonHangSanXuat WHERE MaDH=@m')).recordset[0];
  if (!o) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
  const ten = req.query.ten != null ? String(req.query.ten) : '';
  await pool.request().input('id', sql.Int, o.DonHangID).input('ten', sql.NVarChar, ten)
    .query(`DELETE FROM DonHangDonGiaInThe WHERE DonHangID=@id AND ISNULL(TenPhieu, N'')=@ten`);
  res.json({ success: true });
});

// v5.38: Đơn giá là / đóng gói (2 giá trị theo đơn: LA, DG) — dùng tính lương là/đóng gói.
// v5.56: danh sách BẢN (mỗi bản gồm 2 dòng LA + DG).
router.get('/dongialadonggoi/:maDH/phieu', requireAuth, requirePermission('QLSX', 'view'), async (req, res) => {
  const pool = await getPool();
  const o = (await pool.request().input('m', sql.NVarChar, req.params.maDH).query('SELECT DonHangID, MaDH, TenSanPham FROM DonHangSanXuat WHERE MaDH=@m')).recordset[0];
  if (!o) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
  const phieu = (await pool.request().input('id', sql.Int, o.DonHangID).query(
    `SELECT ISNULL(TenPhieu, N'') AS TenPhieu, COUNT(*) AS SoDong FROM DonHangDonGiaLaDongGoi WHERE DonHangID=@id GROUP BY ISNULL(TenPhieu, N'') ORDER BY ISNULL(TenPhieu, N'')`)).recordset;
  res.json({ success: true, order: { MaDH: o.MaDH, TenSanPham: o.TenSanPham, MaRap: await maRapOf(pool, o.DonHangID) }, data: phieu });
});
router.get('/dongialadonggoi/:maDH', requireAuth, requirePermission('QLSX', 'view'), async (req, res) => {
  const pool = await getPool();
  const o = (await pool.request().input('m', sql.NVarChar, req.params.maDH).query('SELECT DonHangID, MaDH, TenSanPham FROM DonHangSanXuat WHERE MaDH=@m')).recordset[0];
  if (!o) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
  const hasTen = req.query.ten !== undefined;
  const ten = req.query.ten != null ? String(req.query.ten) : '';
  const rq = pool.request().input('id', sql.Int, o.DonHangID);
  if (hasTen) rq.input('ten', sql.NVarChar, ten);
  // Không truyền ?ten= = lấy TẤT CẢ (tương thích tính lương cũ: mỗi Loai lấy dòng đầu tìm được).
  const rows = (await rq.query(`SELECT Loai, DonGia FROM DonHangDonGiaLaDongGoi WHERE DonHangID=@id${hasTen ? ` AND ISNULL(TenPhieu, N'')=@ten` : ''}`)).recordset;
  const m = {}; rows.forEach(r => { if (m[r.Loai] == null) m[r.Loai] = r.DonGia; });
  res.json({ success: true, order: { MaDH: o.MaDH, TenSanPham: o.TenSanPham, MaRap: await maRapOf(pool, o.DonHangID) }, data: { la: m.LA != null ? m.LA : '', dg: m.DG != null ? m.DG : '' } });
});
router.post('/dongialadonggoi/:maDH', requireAuth, requirePermission('QLSX', 'edit'), async (req, res) => {
  try {
    const pool = await getPool();
    const o = (await pool.request().input('m', sql.NVarChar, req.params.maDH).query('SELECT DonHangID FROM DonHangSanXuat WHERE MaDH=@m')).recordset[0];
    if (!o) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    const ten = req.body.ten != null ? String(req.body.ten).trim() : '';
    const oldTen = req.body.oldTen != null ? String(req.body.oldTen) : ten;
    // v5.56: bỏ MERGE theo (DonHangID,Loai) -> quét sạch BẢN cũ rồi chèn lại 2 dòng (hỗ trợ nhiều bản + đổi tên).
    await pool.request().input('id', sql.Int, o.DonHangID).input('ot', sql.NVarChar, oldTen)
      .query(`DELETE FROM DonHangDonGiaLaDongGoi WHERE DonHangID=@id AND ISNULL(TenPhieu, N'')=@ot`);
    for (const [loai, val] of [['LA', req.body.la], ['DG', req.body.dg]]) {
      await pool.request().input('id', sql.Int, o.DonHangID).input('loai', sql.NVarChar, loai)
        .input('g', sql.Decimal(14, 2), val === '' || val == null ? null : Number(val))
        .input('TenPhieu', sql.NVarChar, ten || null)
        .query('INSERT INTO DonHangDonGiaLaDongGoi (DonHangID, Loai, DonGia, TenPhieu) VALUES (@id,@loai,@g,@TenPhieu)');
    }
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: 'Lỗi khi lưu đơn giá là/đóng gói: ' + err.message }); }
});
router.delete('/dongialadonggoi/:maDH', requireAuth, requirePermission('QLSX', 'delete'), async (req, res) => {
  const pool = await getPool();
  const o = (await pool.request().input('m', sql.NVarChar, req.params.maDH).query('SELECT DonHangID FROM DonHangSanXuat WHERE MaDH=@m')).recordset[0];
  if (!o) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
  const ten = req.query.ten != null ? String(req.query.ten) : '';
  await pool.request().input('id', sql.Int, o.DonHangID).input('ten', sql.NVarChar, ten)
    .query(`DELETE FROM DonHangDonGiaLaDongGoi WHERE DonHangID=@id AND ISNULL(TenPhieu, N'')=@ten`);
  res.json({ success: true });
});

module.exports = router;
