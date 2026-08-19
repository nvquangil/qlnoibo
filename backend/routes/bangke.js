// ================================================================
// BANG KE BAN THANH PHAM (v5.34, Giai doan A)
// Bang luoi: cot Size (them tu do) x hang Mau vai CHINH (lay tu Cat). So lop dien san TU CAT
// (tong TienDoCatChiTietCay.SoLuongLop cua cac cay CHINH cung mau; cay Chinh xac dinh qua
// PhieuXuatVaiChiTiet.KieuVai=N'Chính'). Luu luoi JSON (ColsJson/RowsJson). Co Tao/Ap mau + Xem/In.
// v6.00: prefill lay TAT CA so cat cua lenh (khong chi lan cat gan nhat) va chi tinh vai CHINH cua
// CHINH DON DO - xem getBTPPrefill() ben duoi.
// ================================================================
const express = require('express');
const { sql, getPool } = require('../db');
const { requireAuth, requirePermission, requireChucNang } = require('../middleware/auth');

const router = express.Router();
const CN = (action) => [requireAuth, requirePermission('QLSX', action), requireChucNang('QLSX', 'bangkebtp')];

async function getOrderByMaDH(pool, maDH) {
  const r = await pool.request().input('m', sql.NVarChar, maDH).query('SELECT * FROM DonHangSanXuat WHERE MaDH=@m');
  return r.recordset[0] || null;
}

/* Số lớp điền sẵn từ Cắt: tổng SoLuongLop của các cây VẢI CHÍNH, gom theo màu.

   v6.00 — SỬA 2 ĐIỂM theo yêu cầu "lấy tất cả các sổ cắt của lệnh đó và chỉ lấy số lượng của vải chính":
   1. LẤY TẤT CẢ SỔ CẮT của lệnh (mọi lần cắt, mọi sơ đồ) thay vì chỉ lần cắt gần nhất. Trước đây chỉ
      lấy batch mới nhất (NhomTienDoID của bản ghi cuối) nên đơn cắt nhiều đợt / nhiều sơ đồ chỉ điền
      được số lớp của đợt cuối — thiếu hẳn các đợt trước.
   2. "VẢI CHÍNH" phải là chính CỦA ĐƠN NÀY: buộc dòng phiếu xuất KieuVai=N'Chính' thuộc phiếu xuất
      của ĐÚNG đơn hàng đó. Trước đây chỉ cần cây từng được xuất với kiểu 'Chính' ở BẤT KỲ phiếu nào —
      một cây dùng làm vải chính cho đơn A rồi cắt phối cho đơn B vẫn bị tính là chính. */
async function getBTPPrefill(pool, donHangId) {
  const cat = await pool.request().query("SELECT StageID FROM CongDoanSanXuat WHERE MaCongDoan = 'CAT'");
  if (!cat.recordset.length) return [];
  const stageId = cat.recordset[0].StageID;
  const r = await pool.request().input('donId', sql.Int, donHangId).input('stageId', sql.Int, stageId).query(`
    SELECT ms.MauSacID, ms.TenMau, SUM(cc.SoLuongLop) AS SoLop, COUNT(DISTINCT td.TienDoID) AS SoSoCat
    FROM TienDoCatChiTietCay cc
    JOIN TienDoSanXuat td ON td.TienDoID = cc.TienDoID
    JOIN VaiCay vc ON vc.CayID = cc.CayID
    JOIN DanhMucVai dv ON dv.VaiID = vc.VaiID
    LEFT JOIN MauSac ms ON ms.MauSacID = dv.MauSacID
    WHERE td.DonHangID = @donId AND td.StageID = @stageId
      AND EXISTS (SELECT 1 FROM PhieuXuatVaiChiTiet px
                  JOIN PhieuXuatVai p ON p.PhieuXuatID = px.PhieuXuatID
                  WHERE px.CayID = cc.CayID AND px.KieuVai = N'Chính' AND p.DonHangID = @donId)
      /* v6.60.1: LOẠI RA màu nào ĐƯỢC KHAI RÕ LÀ PHỐI trong Cấu trúc vải của chính đơn này.
         Điều kiện EXISTS ở trên chỉ xét phiếu XUẤT: lệnh dùng CÙNG MỘT LOẠI VẢI cho cả chính lẫn
         phối thì kho hay xuất chung, một cây có kèm dòng KieuVai='Chính' là cả số lớp cắt của cây
         đó (gồm phần cắt cho phối) bị tính vào bảng BTP.

         v6.60 bản đầu viết ngược: BẮT BUỘC màu phải nằm trong danh sách màu Chính. Từ v6.43 màu ở
         Ra lệnh SX gõ tự do được (lưu TenMauTuDo, MauSacID = NULL) nên nhiều lệnh không có MauSacID
         để khớp -> lọc sạch, bảng kê trống trơn, nút "lấy màu từ sổ cắt" như không hoạt động.
         Đảo thành NOT EXISTS: chỉ gạt màu KHAI RÕ là Phối; lệnh không khai gì thì giữ nguyên hành
         vi cũ, không bao giờ ra bảng rỗng. */
      /* v6.60.1: lớp CHẶN PHỤ — gạt màu nào được khai RÕ là Phối trong Cấu trúc vải (khớp theo
         MauSacID). Lệnh khai màu gõ tự do (MauSacID NULL, v6.43) thì điều kiện này không có tác
         dụng, và như vậy là ĐÚNG Ý: không bao giờ làm bảng kê rỗng.

         Nguồn CHÍNH vẫn là KieuVai của phiếu xuất kho ở trên. Đã cân nhắc thêm một nhánh nối theo
         TÊN MÀU cho trường hợp cả 2 nguồn cùng thiếu, nhưng BỎ: so khớp chữ là kiểu nối mờ, tên
         trùng nhau là loại nhầm màu chính mà không ai biết. Cách chắc chắn là chọn đúng Chính/Phối
         lúc lập phiếu xuất kho — dữ liệu đúng từ gốc thì điều kiện trên là đủ. */
      AND NOT EXISTS (SELECT 1 FROM DonHangChiTietVai cv
                      WHERE cv.DonHangID = @donId AND cv.Kieu = N'Phối'
                        AND cv.MauSacID IS NOT NULL AND cv.MauSacID = dv.MauSacID)
    GROUP BY ms.MauSacID, ms.TenMau
    ORDER BY ms.TenMau`);
  return r.recordset.map(x => ({
    mauSacId: x.MauSacID, tenMau: x.TenMau || '', soLop: Number(x.SoLop) || 0, soSoCat: Number(x.SoSoCat) || 0
  }));
}

function parseData(row) {
  if (!row) return null;
  let cols = [], rows = [];
  try { cols = row.ColsJson ? JSON.parse(row.ColsJson) : []; } catch (e) { cols = []; }
  try { rows = row.RowsJson ? JSON.parse(row.RowsJson) : []; } catch (e) { rows = []; }
  return { MaHang: row.MaHang, NgayCapNhat: row.NgayCapNhat, GhiChu: row.GhiChu, cols, rows };
}

/* ---------------- Danh sach don hang ---------------- */
/* ================================================================================================
   v5.56 CẢNH BÁO KIẾN TRÚC (nguyên nhân gốc lỗi "bấm nút không có gì xảy ra"):
   Express 4 KHÔNG bắt lỗi của handler `async`. Nếu 1 câu SQL trong route ném lỗi mà không có try/catch
   thì Express KHÔNG TRẢ VỀ GÌ CẢ → request treo vô hạn → `await apiGet(...)` ở frontend KHÔNG BAO GIỜ
   settle → không có lỗi, không có thông báo, nút trông như chết. Vì vậy MỌI route ở file này BẮT BUỘC
   bọc try/catch và luôn trả JSON lỗi. Không được bỏ.
   ================================================================================================ */
router.get('/orders', requireAuth, requirePermission('QLSX', 'view'), async (req, res) => {   // v5.55: XEM không cần quyền chức năng 'bangkebtp' (đồng bộ với tab tài liệu) — tránh 403 làm trắng tab
  try {
    const pool = await getPool();
    const rows = (await pool.request().query(`
      SELECT d.DonHangID, d.MaDH, d.TenSanPham, d.MaSanPham,
        CASE WHEN EXISTS (SELECT 1 FROM BangKeBanThanhPham b WHERE b.DonHangID = d.DonHangID) THEN 1 ELSE 0 END AS DaCo
      FROM DonHangSanXuat d ORDER BY d.DonHangID DESC`)).recordset;
    res.json({ success: true, data: rows });
  } catch (err) { console.error('[bangke] GET /orders', err); res.status(500).json({ success: false, message: 'Lỗi tải danh sách đơn (Bảng kê BTP): ' + err.message }); }
});

/* ---------------- 1 bang ke theo don + prefill tu Cat ---------------- */
// v5.55: danh sách BẢN Bảng kê BTP của 1 đơn (nhiều bản có tên).
router.get('/:maDH/phieu', requireAuth, requirePermission('QLSX', 'view'), async (req, res) => {
  try {
    const pool = await getPool();
    const order = await getOrderByMaDH(pool, req.params.maDH);
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    const phieu = (await pool.request().input('id', sql.Int, order.DonHangID).query(`
      SELECT ISNULL(TenPhieu, N'') AS TenPhieu FROM BangKeBanThanhPham WHERE DonHangID=@id ORDER BY ISNULL(TenPhieu, N'')`)).recordset;
    res.json({ success: true, order: { MaDH: order.MaDH, TenSanPham: order.TenSanPham }, data: phieu });
  } catch (err) { console.error('[bangke] GET /:maDH/phieu', err); res.status(500).json({ success: false, message: 'Lỗi tải danh sách bản bảng kê: ' + err.message }); }
});
router.get('/:maDH', requireAuth, requirePermission('QLSX', 'view'), async (req, res) => {   // v5.55: xem BTP không gate theo chức năng
  try {
    const pool = await getPool();
    const order = await getOrderByMaDH(pool, req.params.maDH);
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    const ten = req.query.ten != null ? String(req.query.ten) : '';   // v5.55: 1 bản BTP
    const bk = (await pool.request().input('id', sql.Int, order.DonHangID).input('ten', sql.NVarChar, ten).query("SELECT * FROM BangKeBanThanhPham WHERE DonHangID=@id AND ISNULL(TenPhieu, N'')=@ten")).recordset[0];

    // v5.56: 3 phần dưới đây chỉ là TIỆN ÍCH (điền sẵn màu từ Cắt, gợi ý cột size, mã rập) — nếu lỗi thì
    // vẫn PHẢI mở được form. Bọc riêng từng phần để 1 truy vấn phụ hỏng không làm chết cả màn hình.
    let prefill = [];
    try { prefill = await getBTPPrefill(pool, order.DonHangID); }
    catch (e) { console.error('[bangke] prefill từ Cắt lỗi (bỏ qua):', e.message); }

    // v5.44.5: cột size của Bảng kê BTP = các DÒNG "Size" của Thông số đo (vd 2,3,4), KHÔNG phải cột "Vị trí đo".
    // Trong Thông số đo: Cột (TaiLieuThongSoDoCot) = Vị trí đo; Dòng (TaiLieuThongSoDoDong) = Size
    // (xem module.tailieukythuat.js openThongSoDoEditor: cột placeholder "Vị trí đo...", dòng placeholder "Size...").
    // v5.58: BIỂU MẪU THÔNG SỐ ĐO MỚI đảo chiều — CỘT (TaiLieuThongSoDoCot) = SIZE (80/90/100...),
    // DÒNG = thông số (Dài áo, Rộng ngang ngực...). Nên lấy size từ CỘT trước; nếu đơn còn dữ liệu
    // theo mẫu CŨ (dòng = size, chưa có cột nào) thì fallback về DÒNG để không mất tiện ích cũ.
    let sizeCols = [];
    try {
      sizeCols = (await pool.request().input('id', sql.Int, order.DonHangID).query(`
        SELECT c.TenCot AS Ten FROM TaiLieuThongSoDoCot c
        JOIN TaiLieuThongSoDo t ON t.ID = c.TaiLieuID
        WHERE t.DonHangID=@id AND ISNULL(t.LaMau, 0) = 0
        ORDER BY c.ThuTu`)).recordset.map(r => r.Ten).filter(s => s != null && String(s).trim() !== '');
      if (!sizeCols.length) {
        sizeCols = (await pool.request().input('id', sql.Int, order.DonHangID).query(`
          SELECT d.TenDong AS Ten FROM TaiLieuThongSoDoDong d
          JOIN TaiLieuThongSoDo t ON t.ID = d.TaiLieuID
          WHERE t.DonHangID=@id AND ISNULL(t.LaMau, 0) = 0
          ORDER BY d.ThuTu`)).recordset.map(r => r.Ten).filter(s => s != null && String(s).trim() !== '');
      }
    } catch (e) { console.error('[bangke] lấy cột size từ Thông số đo lỗi (bỏ qua):', e.message); }

    let maRap = '';
    try {
      maRap = [...new Set((await pool.request().input('id', sql.Int, order.DonHangID)
        .query(`SELECT MaRap FROM DonHangChiTietSoDo WHERE DonHangID=@id AND MaRap IS NOT NULL AND LTRIM(RTRIM(MaRap))<>''`)).recordset.map(x => x.MaRap))].join(', ');   // v5.53
    } catch (e) { console.error('[bangke] lấy Mã rập lỗi (bỏ qua):', e.message); }

    res.json({ success: true, order: { MaDH: order.MaDH, TenSanPham: order.TenSanPham, MaSanPham: order.MaSanPham, AnhSanPham: order.AnhSanPham, MaRap: maRap }, data: parseData(bk), prefill, sizeCols });
  } catch (err) { console.error('[bangke] GET /:maDH', err); res.status(500).json({ success: false, message: 'Lỗi tải bảng kê: ' + err.message }); }
});

/* ---------------- Luu (upsert) ---------------- */
router.post('/:maDH', ...CN('edit'), async (req, res) => {
  try {
    const pool = await getPool();
    const order = await getOrderByMaDH(pool, req.params.maDH);
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    const { maHang, ngayCapNhat, ghiChu, cols, rows } = req.body;
    const ten = req.body.ten != null ? String(req.body.ten).trim() : '';        // v5.55: tên bản (mới)
    const oldTen = req.body.oldTen != null ? String(req.body.oldTen) : ten;      // bản đang sửa (đổi tên)
    const colsJson = JSON.stringify(Array.isArray(cols) ? cols : []);
    const rowsJson = JSON.stringify(Array.isArray(rows) ? rows : []);
    const exist = (await pool.request().input('id', sql.Int, order.DonHangID).input('ot', sql.NVarChar, oldTen)
      .query("SELECT ID FROM BangKeBanThanhPham WHERE DonHangID=@id AND ISNULL(TenPhieu, N'')=@ot")).recordset[0];
    const reqDb = pool.request()
      .input('DonHangID', sql.Int, order.DonHangID)
      .input('TenPhieu', sql.NVarChar, ten || null)
      .input('MaHang', sql.NVarChar, maHang || order.MaDH)
      .input('NgayCapNhat', sql.Date, ngayCapNhat || null)
      .input('GhiChu', sql.NVarChar, ghiChu || null)
      .input('ColsJson', sql.NVarChar, colsJson)
      .input('RowsJson', sql.NVarChar, rowsJson)
      .input('NguoiLapID', sql.Int, req.session.user.userId);
    if (exist) {
      await reqDb.input('id', sql.Int, exist.ID).query(`UPDATE BangKeBanThanhPham SET MaHang=@MaHang, TenPhieu=@TenPhieu, NgayCapNhat=@NgayCapNhat, GhiChu=@GhiChu,
        ColsJson=@ColsJson, RowsJson=@RowsJson, UpdatedAt=SYSDATETIME() WHERE ID=@id`);
    } else {
      await reqDb.query(`INSERT INTO BangKeBanThanhPham (DonHangID, TenPhieu, MaHang, NgayCapNhat, GhiChu, ColsJson, RowsJson, NguoiLapID)
        VALUES (@DonHangID, @TenPhieu, @MaHang, @NgayCapNhat, @GhiChu, @ColsJson, @RowsJson, @NguoiLapID)`);
    }
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: 'Lỗi khi lưu bảng kê: ' + err.message }); }
});

router.delete('/:maDH', ...CN('delete'), async (req, res) => {
  try {
    const pool = await getPool();
    const order = await getOrderByMaDH(pool, req.params.maDH);
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    const ten = req.query.ten != null ? String(req.query.ten) : '';   // v5.55: xóa 1 bản
    await pool.request().input('id', sql.Int, order.DonHangID).input('ten', sql.NVarChar, ten)
      .query("DELETE FROM BangKeBanThanhPham WHERE DonHangID=@id AND ISNULL(TenPhieu, N'')=@ten");
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: err.message }); }
});

/* ---------------- Tai lieu mau (chi luu danh sach cot size) ---------------- */
// v5.56 FIX: 2 route XEM mẫu BỎ gate chức năng 'bangkebtp' (giống /orders + /:maDH ở v5.55). Trước đây
// openEditor() ở frontend gọi /mau/list ngay khi mở form -> nhóm có bangkebtp CanView=0 bị 403 -> hàm
// mở form NÉM LỖI GIỮA ĐƯỜNG nên bấm "Thêm bảng kê"/"Mở/Sửa" KHÔNG có gì xảy ra (im lặng, không báo lỗi).
router.get('/mau/list', requireAuth, requirePermission('QLSX', 'view'), async (req, res) => {
  try {
    const pool = await getPool();
    const rows = (await pool.request().query("SELECT ID, TenMau FROM BangKeBanThanhPham WHERE LaMau=1 ORDER BY TenMau")).recordset;
    res.json({ success: true, data: rows });
  } catch (err) { console.error('[bangke] GET /mau/list', err); res.status(500).json({ success: false, message: 'Lỗi tải danh sách mẫu: ' + err.message }); }
});
router.get('/mau/:id', requireAuth, requirePermission('QLSX', 'view'), async (req, res) => {
  try {
    const pool = await getPool();
    const row = (await pool.request().input('id', sql.Int, req.params.id).query('SELECT * FROM BangKeBanThanhPham WHERE ID=@id AND LaMau=1')).recordset[0];
    if (!row) return res.status(404).json({ success: false, message: 'Không tìm thấy mẫu.' });
    res.json({ success: true, data: parseData(row) });
  } catch (err) { console.error('[bangke] GET /mau/:id', err); res.status(500).json({ success: false, message: 'Lỗi tải mẫu: ' + err.message }); }
});
router.post('/mau/create', ...CN('edit'), async (req, res) => {
  try {
    const { tenMau, cols } = req.body;
    if (!tenMau) return res.status(400).json({ success: false, message: 'Thiếu tên mẫu.' });
    const pool = await getPool();
    await pool.request().input('TenMau', sql.NVarChar, tenMau).input('ColsJson', sql.NVarChar, JSON.stringify(Array.isArray(cols) ? cols : []))
      .input('NguoiLapID', sql.Int, req.session.user.userId)
      .query("INSERT INTO BangKeBanThanhPham (LaMau, TenMau, ColsJson, RowsJson, NguoiLapID) VALUES (1, @TenMau, @ColsJson, '[]', @NguoiLapID)");
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: err.message }); }
});
router.delete('/mau/:id', ...CN('delete'), async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request().input('id', sql.Int, req.params.id).query('DELETE FROM BangKeBanThanhPham WHERE ID=@id AND LaMau=1');
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: err.message }); }
});
// v5.45: ĐỔI TÊN mẫu BTP (rename) — chỉ cập nhật TenMau.
router.put('/mau/:id', ...CN('edit'), async (req, res) => {
  try {
    const { tenMau } = req.body;
    if (!tenMau || !String(tenMau).trim()) return res.status(400).json({ success: false, message: 'Thiếu tên mẫu.' });
    const pool = await getPool();
    const upd = await pool.request().input('id', sql.Int, req.params.id).input('TenMau', sql.NVarChar, String(tenMau).trim())
      .query('UPDATE BangKeBanThanhPham SET TenMau=@TenMau WHERE ID=@id AND LaMau=1');
    if (!upd.rowsAffected[0]) return res.status(404).json({ success: false, message: 'Không tìm thấy mẫu.' });
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: err.message }); }
});

module.exports = router;
