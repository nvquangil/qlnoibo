// Phan he QUAN LY SAN XUAT - chuc nang "Tai lieu ky thuat" (v5.14)
// Gom 3 loai tai lieu co bang rieng (Tai lieu ky thuat chung, Thong so do, Mo ta san pham) + 1 loai
// ("Chi dinh NPL") KHONG co bang rieng o day - dung lai NGUYEN VEN DonHangChiTietPhuKien va 3 route
// GET/POST/DELETE /api/qlsx/orders/:maDH/phukien da co san trong qlsx.js (xem migration_v514.sql phan
// dau va HUONG_DAN_CAI_DAT.md Buoc 2.19 de biet ly do khong tach rieng bang/route cho muc nay).
const express = require('express');
const multer = require('multer');
const { sql, getPool } = require('../db');
const { requireAuth, requirePermission, requireChucNang } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');
/* v7.64: đọc file Excel thông số kỹ thuật -> lưới { cols, rows }. Quy tắc dò bảng nằm ở util. */
const { docThongSoDoExcel } = require('../utils/docThongSoDoExcel');
/* v7.65: đọc file Excel thống kê chi tiết (kèm hình rập vẽ bằng Freeform của Excel). */
const { docThongKeChiTietExcel } = require('../utils/docThongKeChiTietExcel');
/* v7.67: mã rập gộp CẢ 2 nguồn (bảng Sơ đồ + Ghi tiến độ). Xem đầu file util để biết vì sao. */
const { maRapCuaDon, maRapTheoDon } = require('../utils/maRapCuaDon');

/* Ảnh rập trích từ Excel ghi vào ĐÚNG thư mục mà routes/upload.js dùng, để mọi ảnh nằm một chỗ và
   đường dẫn /uploads/... phục vụ được ngay. */
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

/* Nhận file vào BỘ NHỚ (không ghi ra đĩa): file này chỉ dùng để đọc một lần rồi bỏ. */
const uploadExcel = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });
function nhanFileExcel(req, res, next) {
  uploadExcel.single('file')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: 'File quá lớn (giới hạn 15 MB).' });
    }
    return res.status(400).json({ success: false, message: 'Lỗi khi nhận file: ' + err.message });
  });
}

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
  if (['thongsodo', 'thongkechitiet', 'motasp', 'quycach', 'dongiamay', 'dongiagiacong', 'dongialadonggoi'].includes(loai)) return 'tailieumay';
  if (['hinhanhinthue', 'dongiainthe'].includes(loai)) return 'tailieuinthe';
  return 'tailieukythuat';
}
router.use((req, res, next) => {
  let loai = req.query.loai;
  if (!loai) {
    const seg = (req.path.split('/')[1] || '').toLowerCase();
    /* ⚠️ 'thongkechitiet' PHAI xet TRUOC 'thongsodo'? Khong — hai chuoi khong long nhau. Nhung phai
       CO mat o day, keo route thong ke chi tiet roi vao nhanh mac dinh 'tailieuchung' va bi gate
       bang quyen cua nhom KHAC. */
    if (seg.startsWith('thongkechitiet')) loai = 'thongkechitiet';
    else if (seg.startsWith('thongsodo')) loai = 'thongsodo';
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

/* v7.67 — CHỈ CÒN LÀ VỎ BỌC. Bản cũ ở đây chỉ đọc `DonHangChiTietSoDo`, nên mã rập mà bộ phận Kỹ
   thuật gõ lúc **Ghi tiến độ** (`TienDoSanXuat.MaRap`) KHÔNG BAO GIỜ hiện ra ở Tài liệu may/đóng gói
   — đúng lỗi Nguyen báo. qlsx.js đã gộp 2 nguồn từ v6.06; nay dùng chung một bản công thức. */
async function maRapOf(pool, donHangId) {
  return maRapCuaDon(pool, sql, donHangId);
}

async function getOrderBasic(pool, maDH) {
  /* v7.65.3: + AnhSanPham — ANH CUA CHINH LENH SX, do nguoi dung tai len luc Ra lenh SX.
     Day moi la "anh dai dien hang" that su cua don; ban truoc toi di do TheKhoHangHoa theo ma hang
     nen hau het don khong ra anh nao (ma tren lenh SX chua chac co the kho, va co the kho chua chac
     da co anh). */
  const result = await pool.request().input('MaDH', sql.NVarChar, maDH).query(`
    SELECT DonHangID, MaDH, MaSanPham, TenSanPham, AnhSanPham FROM DonHangSanXuat WHERE MaDH = @MaDH`);
  const o = result.recordset[0] || null;
  if (o) o.MaRap = await maRapOf(pool, o.DonHangID);   // v5.53
  return o;
}

/* ================================================================================================
   v7.65.3 — ANH DAI DIEN HANG CHO BAN IN TAI LIEU. MOT ban dung chung cho Thong so ky thuat va
   Thong ke chi tiet, keo hai ban in ra hai anh khac nhau.
   Thu tu uu tien:
     1. `DonHangSanXuat.AnhSanPham` — anh tai len ngay luc Ra lenh SX. Gan nhu don nao cung co.
     2. `TheKhoHangHoa.AnhDaiDien` theo MA SAN PHAM cua lenh — cho don cu chua tai anh o buoc Ra lenh.
   ⚠️ So ma phai CAT KHOANG TRANG hai dau: ma go tay o lenh SX va ma o the kho hay lech mot dau cach,
   so bang dau `=` thuong la khong ra dong nao (SQL Server mac dinh khong phan biet hoa thuong nen
   khong can lo phan do).
   Boc try/catch: khong tim duoc anh thi ban in khong co anh — KHONG duoc lam gay ca route.
   ================================================================================================ */
async function anhDaiDienCuaDon(pool, order) {
  if (!order) return '';
  if (order.AnhSanPham) return order.AnhSanPham;
  const ma = String(order.MaSanPham || '').trim();
  if (!ma) return '';
  try {
    const a = (await pool.request().input('ms', sql.NVarChar, ma)
      .query(`SELECT TOP 1 AnhDaiDien FROM TheKhoHangHoa
               WHERE LTRIM(RTRIM(MaHang)) = @ms AND NULLIF(LTRIM(RTRIM(ISNULL(AnhDaiDien, ''))), '') IS NOT NULL`)).recordset[0];
    return (a && a.AnhDaiDien) || '';
  } catch (e) { return ''; }
}

/* ================================================================================================
   v7.67 — MỘT LỐI DUY NHẤT LẤY THÔNG TIN ĐẦU PHIẾU CHO MỌI BẢN IN CỦA MÀN "Tài liệu may/đóng gói".
   Yêu cầu của Nguyen: "rà soát lại HẾT các bảng in ... đều đưa ảnh sản phẩm từ lệnh sản xuất lên bản
   in để biết sản phẩm gì". Trước đây mỗi route tự dựng object `order` bằng một câu SELECT riêng, có
   route lấy AnhSanPham có route không → in ra chỗ có ảnh chỗ không. Nay TẤT CẢ đi qua đây.
   Trả `null` khi không tìm thấy đơn để route tự trả 404 như cũ.
   ================================================================================================ */
async function orderChoBanIn(pool, maDH) {
  const order = await getOrderBasic(pool, maDH);
  if (!order) return null;
  return { order, anhMacDinh: await anhDaiDienCuaDon(pool, order) };
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
  } else if (loai === 'thongkechitiet') {
    /* v7.65.1: THIEU nhanh nay thi 'thongkechitiet' roi xuong nhanh mac dinh (chi dinh NPL) -> cot
       "Da co" bao theo bang phu kien, nen luu xong van hien "chua co". */
    joinSql = '';
    daCoExpr = `CASE WHEN EXISTS (SELECT 1 FROM TaiLieuThongKeChiTiet tl WHERE tl.DonHangID = d.DonHangID AND ISNULL(tl.LaMau,0)=0) THEN 1 ELSE 0 END AS DaCo,
      (SELECT MAX(tl2.UpdatedAt) FROM TaiLieuThongKeChiTiet tl2 WHERE tl2.DonHangID = d.DonHangID AND ISNULL(tl2.LaMau,0)=0) AS CapNhatLuc`;
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
    SELECT d.DonHangID, d.MaDH, d.MaSanPham, d.TenSanPham, d.AnhSanPham, kh.TenKhachHang, d.NgayGiaoDuKien, d.TrangThai, c.TenCongDoan, ${daCoExpr}
    FROM DonHangSanXuat d
    LEFT JOIN KhachHang kh ON kh.KhachHangID = d.KhachHangID
    LEFT JOIN CongDoanSanXuat c ON c.StageID = d.CongDoanHienTaiID
    ${joinSql}
    ${locInTheu}
    ORDER BY d.CreatedAt DESC`);
  const rows = result.recordset;
  /* v5.53: gộp Mã Rập theo đơn (hiển thị ở danh sách + modal NPL + header các form).
     v7.67: bản cũ ở đây CHỈ đọc DonHangChiTietSoDo nên đơn nào Kỹ thuật khai mã rập lúc Ghi tiến độ
     thì cột Mã rập trắng. Nay dùng chung utils/maRapCuaDon.js (gộp cả TienDoSanXuat). */
  const mrMap = await maRapTheoDon(pool);
  rows.forEach(o => { o.MaRap = mrMap[o.DonHangID] || ''; });
  return rows;
}

router.get('/orders', requireAuth, requirePermission('QLSX', 'view'), async (req, res) => {
  const loai = ['tailieuchung', 'thongsodo', 'thongkechitiet', 'motasp', 'chidinhnpl', 'dongiamay', 'dongiagiacong', 'quycach', 'hinhanhinthue', 'dongiainthe', 'dongialadonggoi'].includes(req.query.loai) ? req.query.loai : 'tailieuchung';
  const pool = await getPool();
  res.json({ success: true, data: await getOrdersWithDocStatus(pool, loai) });
});

// v5.34 (B2): Đơn giá công đoạn may (model mới: Tên/Giây giờ/Hệ số công đoạn/Hệ số công nhân(4)/Thành tiền).
// Nhiều dòng/đơn, lưu = ghi đè toàn bộ. Thành tiền là cột tính (xem migration_v534b) - dùng cho lương khoán may.
// v5.56: danh sách BẢN (nhiều bản có tên/đơn) — dùng chung khuôn với các loại khác.
router.get('/dongiamay/:maDH/phieu', requireAuth, requirePermission('QLSX', 'view'), async (req, res) => {
  const pool = await getPool();
  const ob = await orderChoBanIn(pool, req.params.maDH);   // v7.67
  if (!ob) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
  const phieu = (await pool.request().input('id', sql.Int, ob.order.DonHangID).query(
    `SELECT ISNULL(TenPhieu, N'') AS TenPhieu, COUNT(*) AS SoDong FROM DonHangDonGiaCongDoanMay WHERE DonHangID=@id GROUP BY ISNULL(TenPhieu, N'') ORDER BY ISNULL(TenPhieu, N'')`)).recordset;
  res.json({ success: true, order: ob.order, anhMacDinh: ob.anhMacDinh, data: phieu });
});
router.get('/dongiamay/:maDH', requireAuth, requirePermission('QLSX', 'view'), async (req, res) => {
  const pool = await getPool();
  const ob = await orderChoBanIn(pool, req.params.maDH);   // v7.67
  if (!ob) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
  const hasTen = req.query.ten !== undefined;   // không truyền ?ten= = LẤY TẤT CẢ (giữ tương thích báo cáo/lương cũ)
  const ten = req.query.ten != null ? String(req.query.ten) : '';
  const rq = pool.request().input('id', sql.Int, ob.order.DonHangID);
  if (hasTen) rq.input('ten', sql.NVarChar, ten);
  const rows = (await rq.query(`SELECT ID, TenCongDoan, GiayGio, HeSoCongDoan, HeSoCongNhan, ThanhTien FROM DonHangDonGiaCongDoanMay
    WHERE DonHangID=@id${hasTen ? ` AND ISNULL(TenPhieu, N'')=@ten` : ''} ORDER BY ThuTu, ID`)).recordset;
  res.json({ success: true, order: ob.order, anhMacDinh: ob.anhMacDinh, data: rows });
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
  const ob = await orderChoBanIn(pool, req.params.maDH);   // v7.67: kèm luôn ảnh sản phẩm + mã rập 2 nguồn
  const o = ob && ob.order;
  if (!o) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
  const phieu = (await pool.request().input('id', sql.Int, o.DonHangID).query(
    `SELECT ISNULL(TenPhieu, N'') AS TenPhieu, COUNT(*) AS SoDong FROM DonHangHangMucGiaCong WHERE DonHangID=@id GROUP BY ISNULL(TenPhieu, N'') ORDER BY ISNULL(TenPhieu, N'')`)).recordset;
  res.json({ success: true, order: ob.order, anhMacDinh: ob.anhMacDinh, data: phieu });
});
router.get('/dongiagiacong/:maDH', requireAuth, requirePermission('QLSX', 'view'), async (req, res) => {
  const pool = await getPool();
  const ob = await orderChoBanIn(pool, req.params.maDH);   // v7.67: kèm luôn ảnh sản phẩm + mã rập 2 nguồn
  const o = ob && ob.order;
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
  res.json({ success: true, order: ob.order, anhMacDinh: ob.anhMacDinh, catalog, chosen });
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
  res.json({ success: true, order, anhMacDinh: await anhDaiDienCuaDon(pool, order), data: phieu });   // v7.67
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
  res.json({ success: true, data: row ? await getTaiLieuChungDetail(pool, row.ID) : null, order, anhMacDinh: await anhDaiDienCuaDon(pool, order) });   // v7.67
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
/* ================================================================================================
   v7.65 — THỐNG KÊ CHI TIẾT (bảng kê các chi tiết/piece của sản phẩm)
   Cùng khuôn "nhiều bản có tên" với Thông số kỹ thuật để dùng lại openDocBanList/printOneOrderDoc
   ở frontend. Cột CỐ ĐỊNH (Tên chi tiết / Vật liệu / SL / Cặp / Chiều đối xứng / Hình / Tổng SL),
   chỉ SỐ DÒNG là linh động — khác Thông số kỹ thuật vốn thêm/bớt cả cột size.
   ================================================================================================ */
const TKCT_TRUONG = ['pieceName', 'material', 'quantity', 'pair', 'opposite', 'anhChiTiet', 'tongSoLuong', 'ghiChu'];

/* Đọc file Excel -> các dòng chi tiết + hình rập. Hình trong cột "Piece Image" là HÌNH VẼ Freeform
   của Excel chứ không phải ảnh dán; util đổi sang SVG, ở đây GHI RA FILE trong backend/uploads rồi
   chỉ trả về đường dẫn — không nhét cả ảnh vào CSDL, và ảnh xem được ngay như mọi ảnh khác.
   ⚠️ Route CHỮ phải đứng TRƯỚC route /:maDH, kẻo "doc-excel" bị hiểu là mã đơn hàng. */
router.post('/thongkechitiet/doc-excel', requireAuth, requirePermission('QLSX', 'edit'),
  nhanFileExcel, async (req, res) => {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, message: 'Không nhận được file.' });
    }
    if (/\.xls$/i.test(String(req.file.originalname || ''))) {
      return res.status(400).json({
        success: false,
        message: 'File .xls (Excel 97-2003) không đọc được. Mở bằng Excel rồi "Save As" sang .xlsx và tải lại.'
      });
    }
    try {
      const kq = await docThongKeChiTietExcel(req.file.buffer);
      const moc = Date.now();
      let soAnh = 0;
      kq.rows.forEach((r, i) => {
        if (!r.anhSvg) { r.anhChiTiet = ''; delete r.anhSvg; return; }
        const ten = `rap_${moc}_${i + 1}.svg`;
        try {
          fs.writeFileSync(path.join(uploadDir, ten), Buffer.from(r.anhSvg.split(',')[1] || '', 'base64'));
          r.anhChiTiet = '/uploads/' + ten;
          soAnh++;
        } catch (e) {
          /* Ghi được dòng nhưng không ghi được ảnh -> vẫn trả dòng, chỉ thiếu ảnh. Mất cả dòng vì
             một lỗi ghi file là thiệt hơn nhiều. */
          r.anhChiTiet = '';
          console.error('[thongkechitiet] khong ghi duoc anh rap:', e.message);
        }
        delete r.anhSvg;
      });
      let msg = `Đã đọc ${kq.rows.length} chi tiết từ sheet "${kq.tenSheet}"`
        + (soAnh ? `, tải lên ${soAnh} hình rập.` : ' (không thấy hình rập nào trong file).');
      if (kq.lenhLa && kq.lenhLa.length) {
        msg += ` ⚠️ File có nét cong (${kq.lenhLa.join(', ')}) — hình vẽ ra có thể thiếu nét, kiểm lại.`;
      }
      return res.json({ success: true, data: { rows: kq.rows }, message: msg });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  });

async function getThongKeChiTietDetail(pool, id) {
  const header = (await pool.request().input('id', sql.Int, id).query(`
    SELECT tl.*, u.HoTen AS NguoiLap FROM TaiLieuThongKeChiTiet tl
    LEFT JOIN Users u ON u.UserID = tl.NguoiLapID WHERE tl.ID = @id`)).recordset[0];
  if (!header) return null;
  const rows = (await pool.request().input('id', sql.Int, id).query(
    'SELECT * FROM TaiLieuThongKeChiTietDong WHERE TaiLieuID=@id ORDER BY ThuTu, ID')).recordset;
  return {
    id: header.ID, tenPhieu: header.TenPhieu || '', maHang: header.MaHang, dienGiai: header.DienGiai,
    ngayCapNhat: header.NgayCapNhat, anhDaiDien: header.AnhDaiDien || '', ghiChu: header.GhiChu || '',
    nguoiLap: header.NguoiLap,
    rows: rows.map(r => ({
      pieceName: r.PieceName || '', material: r.Material || '', quantity: r.Quantity || '',
      pair: r.Pair || '', opposite: r.Opposite || '', anhChiTiet: r.AnhChiTiet || '',
      tongSoLuong: r.TongSoLuong || '', ghiChu: r.GhiChu || ''
    }))
  };
}

router.get('/thongkechitiet/:maDH/phieu', requireAuth, requirePermission('QLSX', 'view'), async (req, res) => {
  const pool = await getPool();
  const order = await getOrderBasic(pool, req.params.maDH);
  if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
  const phieu = (await pool.request().input('id', sql.Int, order.DonHangID).query(
    `SELECT ISNULL(TenPhieu, N'') AS TenPhieu FROM TaiLieuThongKeChiTiet
      WHERE DonHangID=@id AND ISNULL(LaMau,0)=0 ORDER BY ISNULL(TenPhieu, N'')`)).recordset;
  res.json({ success: true, order, anhMacDinh: await anhDaiDienCuaDon(pool, order), data: phieu });   // v7.67
});

router.get('/thongkechitiet/:maDH', requireAuth, requirePermission('QLSX', 'view'), async (req, res) => {
  const pool = await getPool();
  const order = await getOrderBasic(pool, req.params.maDH);
  if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
  const ten = req.query.ten != null ? String(req.query.ten) : '';
  const row = (await pool.request().input('id', sql.Int, order.DonHangID).input('ten', sql.NVarChar, ten)
    .query(req.query.ten !== undefined
      ? `SELECT TOP 1 ID FROM TaiLieuThongKeChiTiet WHERE DonHangID=@id AND ISNULL(LaMau,0)=0 AND ISNULL(TenPhieu, N'')=@ten ORDER BY ID`
      : `SELECT TOP 1 ID FROM TaiLieuThongKeChiTiet WHERE DonHangID=@id AND ISNULL(LaMau,0)=0 ORDER BY ISNULL(TenPhieu, N''), ID`)).recordset[0];
  /* Ảnh đại diện MẶC ĐỊNH của mã hàng — để bản in có ảnh mà không phải tải lại.
     Bản ghi có `AnhDaiDien` riêng thì frontend ưu tiên cái đó (người dùng đã cố ý thay). */
  const anhMacDinh = await anhDaiDienCuaDon(pool, order);
  res.json({
    success: true, order, anhMacDinh,
    data: row ? await getThongKeChiTietDetail(pool, row.ID) : null
  });
});

router.post('/thongkechitiet/:maDH', requireAuth, requirePermission('QLSX', 'edit'), async (req, res) => {
  const pool = await getPool();
  const order = await getOrderBasic(pool, req.params.maDH);
  if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
  const b = req.body || {};
  const ten = b.ten != null ? String(b.ten).trim() : '';
  const rows = Array.isArray(b.rows) ? b.rows : [];

  const cu = (await pool.request().input('id', sql.Int, order.DonHangID).input('ten', sql.NVarChar, ten)
    .query(`SELECT TOP 1 ID FROM TaiLieuThongKeChiTiet
             WHERE DonHangID=@id AND ISNULL(LaMau,0)=0 AND ISNULL(TenPhieu, N'')=@ten ORDER BY ID`)).recordset[0];

  const rqH = pool.request()
    .input('id', sql.Int, order.DonHangID).input('ten', sql.NVarChar, ten)
    .input('MaHang', sql.NVarChar, b.maHang || null)
    .input('DienGiai', sql.NVarChar, b.dienGiai || null)
    .input('NgayCapNhat', sql.Date, b.ngayCapNhat || null)
    .input('AnhDaiDien', sql.NVarChar, b.anhDaiDien || null)
    .input('GhiChu', sql.NVarChar(sql.MAX), b.ghiChu || null)
    .input('u', sql.Int, req.session.user.userId);
  let id;
  if (cu) {
    id = cu.ID;
    await rqH.input('tlid', sql.Int, id).query(`
      UPDATE TaiLieuThongKeChiTiet SET MaHang=@MaHang, DienGiai=@DienGiai, NgayCapNhat=@NgayCapNhat,
        AnhDaiDien=@AnhDaiDien, GhiChu=@GhiChu, NguoiLapID=@u, UpdatedAt=SYSDATETIME()
      WHERE ID=@tlid`);
    await pool.request().input('tlid', sql.Int, id)
      .query('DELETE FROM TaiLieuThongKeChiTietDong WHERE TaiLieuID=@tlid');
  } else {
    id = (await rqH.query(`
      INSERT INTO TaiLieuThongKeChiTiet (DonHangID, TenPhieu, MaHang, DienGiai, NgayCapNhat, AnhDaiDien, GhiChu, NguoiLapID)
      OUTPUT INSERTED.ID VALUES (@id, @ten, @MaHang, @DienGiai, @NgayCapNhat, @AnhDaiDien, @GhiChu, @u)`)).recordset[0].ID;
  }

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] || {};
    /* Dòng trắng hoàn toàn thì bỏ — người dùng hay để lại một dòng trống ở cuối. */
    if (!TKCT_TRUONG.some(k => String(r[k] || '').trim())) continue;
    await pool.request()
      .input('tlid', sql.Int, id).input('tt', sql.Int, i)
      .input('PieceName', sql.NVarChar, r.pieceName || null)
      .input('Material', sql.NVarChar, r.material || null)
      .input('Quantity', sql.NVarChar, r.quantity || null)
      .input('Pair', sql.NVarChar, r.pair || null)
      .input('Opposite', sql.NVarChar, r.opposite || null)
      .input('AnhChiTiet', sql.NVarChar, r.anhChiTiet || null)
      .input('TongSoLuong', sql.NVarChar, r.tongSoLuong || null)
      .input('GhiChu', sql.NVarChar, r.ghiChu || null)
      .query(`INSERT INTO TaiLieuThongKeChiTietDong
                (TaiLieuID, ThuTu, PieceName, Material, Quantity, Pair, Opposite, AnhChiTiet, TongSoLuong, GhiChu)
              VALUES (@tlid, @tt, @PieceName, @Material, @Quantity, @Pair, @Opposite, @AnhChiTiet, @TongSoLuong, @GhiChu)`);
  }
  res.json({ success: true, message: 'Đã lưu thống kê chi tiết.' });
});

router.delete('/thongkechitiet/:maDH', requireAuth, requirePermission('QLSX', 'delete'), async (req, res) => {
  const pool = await getPool();
  const order = await getOrderBasic(pool, req.params.maDH);
  if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
  const ten = req.query.ten != null ? String(req.query.ten) : '';
  /* Xóa CON trước rồi mới xóa header — ON DELETE CASCADE có sẵn nhưng làm rõ thứ tự cho khỏi phụ
     thuộc vào việc khóa ngoại được khai đúng ở mọi bản cài. */
  await pool.request().input('id', sql.Int, order.DonHangID).input('ten', sql.NVarChar, ten)
    .query(`DELETE FROM TaiLieuThongKeChiTietDong WHERE TaiLieuID IN
             (SELECT ID FROM TaiLieuThongKeChiTiet WHERE DonHangID=@id AND ISNULL(TenPhieu, N'')=@ten)`);
  await pool.request().input('id', sql.Int, order.DonHangID).input('ten', sql.NVarChar, ten)
    .query(`DELETE FROM TaiLieuThongKeChiTiet WHERE DonHangID=@id AND ISNULL(TenPhieu, N'')=@ten`);
  res.json({ success: true, message: 'Đã xóa bản.' });
});

router.get('/thongsodo/:maDH/phieu', requireAuth, requirePermission('QLSX', 'view'), async (req, res) => {
  const pool = await getPool();
  const order = await getOrderBasic(pool, req.params.maDH);
  if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
  const phieu = (await pool.request().input('id', sql.Int, order.DonHangID).query(
    `SELECT ISNULL(TenPhieu, N'') AS TenPhieu FROM TaiLieuThongSoDo WHERE DonHangID=@id ORDER BY ISNULL(TenPhieu, N'')`)).recordset;
  res.json({ success: true, order, anhMacDinh: await anhDaiDienCuaDon(pool, order), data: phieu });   // v7.67
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
  /* v7.65.2: ANH DAI DIEN HANG cho ban in Thong so ky thuat — lay theo ma hang cua lenh SX, dung
     CUNG cach voi Thong ke chi tiet de hai ban in khong the ra hai anh khac nhau.
     Boc try/catch: ma chua co the kho thi ban in khong co anh, KHONG duoc lam gay ca route. */
  const anhMacDinh = await anhDaiDienCuaDon(pool, order);
  res.json({ success: true, data: row ? await getThongSoDoDetail(pool, row.ID) : null, order, anhMacDinh });
});

/* ================================================================================================
   v7.64 — TẢI FILE EXCEL THÔNG SỐ KỸ THUẬT LÊN, ĐỔ THẲNG VÀO LƯỚI.
   CHỈ ĐỌC FILE, KHÔNG ghi gì vào CSDL: trả về { cols, rows } để form điền vào lưới; người dùng xem
   lại rồi mới bấm Lưu như thường. Nhờ vậy tải nhầm file cũng không hỏng dữ liệu đang có.
   Quy tắc đọc + lý do không gán cứng vị trí ô: xem đầu utils/docThongSoDoExcel.js.
   ================================================================================================ */
router.post('/thongsodo/doc-excel', requireAuth, requirePermission('QLSX', 'edit'),
  nhanFileExcel, async (req, res) => {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, message: 'Không nhận được file.' });
    }
    const ten = String(req.file.originalname || '');
    /* ExcelJS KHÔNG đọc được .xls (định dạng cũ của Excel 97-2003). Báo rõ cách xử lý, thay vì để
       thư viện ném một câu khó hiểu rồi người dùng tưởng file hỏng. */
    if (/\.xls$/i.test(ten)) {
      return res.status(400).json({
        success: false,
        message: 'File .xls (Excel 97-2003) không đọc được. Mở bằng Excel rồi "Save As" sang .xlsx và tải lại.'
      });
    }
    try {
      const kq = await docThongSoDoExcel(req.file.buffer);
      return res.json({
        success: true,
        data: { cols: kq.cols, rows: kq.rows },
        message: `Đã đọc ${kq.rows.length} dòng thông số × ${kq.cols.length} size từ sheet "${kq.tenSheet}".`
      });
    } catch (err) {
      /* Lỗi "không dò ra bảng" là lỗi của FILE, không phải lỗi hệ thống -> 400 kèm hướng dẫn. */
      return res.status(400).json({ success: false, message: err.message });
    }
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
  res.json({ success: true, order, anhMacDinh: await anhDaiDienCuaDon(pool, order), data: phieu });   // v7.67
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
  res.json({ success: true, data: row ? await getMoTaSanPhamDetail(pool, row.ID) : null, order, anhMacDinh: await anhDaiDienCuaDon(pool, order) });   // v7.67
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
  const ob = await orderChoBanIn(pool, req.params.maDH);   // v7.67: kèm luôn ảnh sản phẩm + mã rập 2 nguồn
  const o = ob && ob.order;
  if (!o) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
  const phieu = (await pool.request().input('id', sql.Int, o.DonHangID).query(
    `SELECT ISNULL(TenPhieu, N'') AS TenPhieu, COUNT(*) AS SoDong FROM DonHangDonGiaInThe WHERE DonHangID=@id GROUP BY ISNULL(TenPhieu, N'') ORDER BY ISNULL(TenPhieu, N'')`)).recordset;
  res.json({ success: true, order: ob.order, anhMacDinh: ob.anhMacDinh, data: phieu });
});
router.get('/dongiainthe/:maDH', requireAuth, requirePermission('QLSX', 'view'), async (req, res) => {
  const pool = await getPool();
  const ob = await orderChoBanIn(pool, req.params.maDH);   // v7.67: kèm luôn ảnh sản phẩm + mã rập 2 nguồn
  const o = ob && ob.order;
  if (!o) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
  const hasTen = req.query.ten !== undefined;
  const ten = req.query.ten != null ? String(req.query.ten) : '';
  const rq = pool.request().input('id', sql.Int, o.DonHangID);
  if (hasTen) rq.input('ten', sql.NVarChar, ten);
  // v5.87: + AnhMinhHoa (ảnh từng dòng). Dò cột để màn hình vẫn mở được khi CHƯA chạy migration_v660.
  const coAnh = await coCot(pool, 'DonHangDonGiaInThe', 'AnhMinhHoa');
  const rows = (await rq.query(`SELECT ID, Ten, DonGia${coAnh ? ', AnhMinhHoa' : ", CAST(NULL AS NVARCHAR(500)) AS AnhMinhHoa"} FROM DonHangDonGiaInThe WHERE DonHangID=@id${hasTen ? ` AND ISNULL(TenPhieu, N'')=@ten` : ''} ORDER BY ThuTu, ID`)).recordset;
  res.json({ success: true, order: ob.order, anhMacDinh: ob.anhMacDinh, data: rows });
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
  const ob = await orderChoBanIn(pool, req.params.maDH);   // v7.67: kèm luôn ảnh sản phẩm + mã rập 2 nguồn
  const o = ob && ob.order;
  if (!o) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
  const phieu = (await pool.request().input('id', sql.Int, o.DonHangID).query(
    `SELECT ISNULL(TenPhieu, N'') AS TenPhieu, COUNT(*) AS SoDong FROM DonHangDonGiaLaDongGoi WHERE DonHangID=@id GROUP BY ISNULL(TenPhieu, N'') ORDER BY ISNULL(TenPhieu, N'')`)).recordset;
  res.json({ success: true, order: ob.order, anhMacDinh: ob.anhMacDinh, data: phieu });
});
router.get('/dongialadonggoi/:maDH', requireAuth, requirePermission('QLSX', 'view'), async (req, res) => {
  const pool = await getPool();
  const ob = await orderChoBanIn(pool, req.params.maDH);   // v7.67: kèm luôn ảnh sản phẩm + mã rập 2 nguồn
  const o = ob && ob.order;
  if (!o) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
  const hasTen = req.query.ten !== undefined;
  const ten = req.query.ten != null ? String(req.query.ten) : '';
  const rq = pool.request().input('id', sql.Int, o.DonHangID);
  if (hasTen) rq.input('ten', sql.NVarChar, ten);
  // Không truyền ?ten= = lấy TẤT CẢ (tương thích tính lương cũ: mỗi Loai lấy dòng đầu tìm được).
  const rows = (await rq.query(`SELECT Loai, DonGia FROM DonHangDonGiaLaDongGoi WHERE DonHangID=@id${hasTen ? ` AND ISNULL(TenPhieu, N'')=@ten` : ''}`)).recordset;
  const m = {}; rows.forEach(r => { if (m[r.Loai] == null) m[r.Loai] = r.DonGia; });
  res.json({ success: true, order: ob.order, anhMacDinh: ob.anhMacDinh, data: { la: m.LA != null ? m.LA : '', dg: m.DG != null ? m.DG : '' } });
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
