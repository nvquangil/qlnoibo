const express = require('express');
const ExcelJS = require('exceljs'); // v5.19 (muc 4): xuat Excel cho Ton kho / The kho phu kien
const { sql, getPool } = require('../db');
const { requireAuth, requirePermission, requireChucNang } = require('../middleware/auth');

const router = express.Router();

// ============ DANH MUC CHO FORM (loai phu kien, phu kien, don hang de gan phieu xuat, NCC de gan phieu nhap) ============
/* v5.87: dò cột mới (do migration_v660 thêm) để màn hình vẫn chạy khi khách chưa chạy migration.
   Nhớ kết quả để không phải hỏi database mỗi lần gọi route. */
const __cotPK = new Map();
async function coCotPK(pool, bang, cot) {
  const key = bang + '.' + cot;
  if (__cotPK.has(key)) return __cotPK.get(key);
  const r = (await pool.request().query(`SELECT COL_LENGTH('${bang}','${cot}') AS c`)).recordset[0] || {};
  __cotPK.set(key, r.c != null);
  return r.c != null;
}

router.get('/danhmuc', requireAuth, requirePermission('PHUKIEN', 'view'), async (req, res) => {
  const pool = await getPool();
  const [loai, phuKien, donHang, nhaCungCap] = await Promise.all([
    pool.request().query('SELECT * FROM LoaiPhuKien ORDER BY TenLoai'),
    pool.request().query(`
      SELECT dm.*, lpk.TenLoai FROM DanhMucPhuKien dm
      LEFT JOIN LoaiPhuKien lpk ON lpk.LoaiPhuKienID = dm.LoaiPhuKienID
      ORDER BY dm.MaPhuKien`),
    // v5.84: kèm MaRap (gộp từ DonHangChiTietSoDo, cùng cách làm với qlsx/tailieukythuat) để form
    // Phiếu xuất phụ kiện tự điền Mã rập khi chọn đơn hàng — không phải tra cứu thủ công.
    pool.request().query(`
      SELECT d.DonHangID, d.MaDH, d.TenSanPham,
        STUFF((SELECT DISTINCT ', ' + sd.MaRap FROM DonHangChiTietSoDo sd
               WHERE sd.DonHangID = d.DonHangID AND sd.MaRap IS NOT NULL AND LTRIM(RTRIM(sd.MaRap)) <> ''
               FOR XML PATH('')), 1, 2, '') AS MaRap
      FROM DonHangSanXuat d ORDER BY d.DonHangID DESC`),
    pool.request().query('SELECT * FROM NhaCungCap ORDER BY TenNCC')
  ]);
  res.json({ success: true, data: { loaiPhuKien: loai.recordset, phuKien: phuKien.recordset, donHang: donHang.recordset, nhaCungCap: nhaCungCap.recordset } });
});

// ============ LOAI PHU KIEN ============
router.post('/loai', requireAuth, requirePermission('PHUKIEN', 'create'), requireChucNang('PHUKIEN', 'loai'), async (req, res) => {
  try {
    const tenLoai = (req.body.tenLoai || '').trim();
    if (!tenLoai) return res.status(400).json({ success: false, message: 'Vui lòng nhập tên loại phụ kiện.' });
    const pool = await getPool();
    const exists = await pool.request().input('t', sql.NVarChar, tenLoai).query('SELECT LoaiPhuKienID FROM LoaiPhuKien WHERE LOWER(TenLoai) = LOWER(@t)');
    if (exists.recordset.length) return res.status(400).json({ success: false, message: 'Loại phụ kiện này đã tồn tại.' });
    const result = await pool.request().input('t', sql.NVarChar, tenLoai)
      .query('INSERT INTO LoaiPhuKien (TenLoai) OUTPUT INSERTED.* VALUES (@t)');
    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Lỗi khi thêm loại phụ kiện: ' + err.message });
  }
});

// Tim hoac tao Loai Phu Kien tu ten (dung khi form gui len 1 ten loai moi thay vi ID co san)
async function resolveLoaiPhuKienId(pool, loaiPhuKienId, loaiMoiText) {
  if (loaiPhuKienId) return loaiPhuKienId;
  const ten = (loaiMoiText || '').trim();
  if (!ten) return null;
  const existing = await pool.request().input('t', sql.NVarChar, ten).query('SELECT LoaiPhuKienID FROM LoaiPhuKien WHERE LOWER(TenLoai) = LOWER(@t)');
  if (existing.recordset.length) return existing.recordset[0].LoaiPhuKienID;
  const created = await pool.request().input('t', sql.NVarChar, ten).query('INSERT INTO LoaiPhuKien (TenLoai) OUTPUT INSERTED.LoaiPhuKienID VALUES (@t)');
  return created.recordset[0].LoaiPhuKienID;
}

// ============ DANH MUC PHU KIEN (mac, the bai, chun, day rut...) ============
router.get('/items', requireAuth, requirePermission('PHUKIEN', 'view'), requireChucNang('PHUKIEN', 'danhmuc'), async (req, res) => {
  const pool = await getPool();
  /* v6.32: kèm ĐVT quy đổi + tỷ lệ để màn hình hiện thêm cột "Tồn quy đổi".
     View vw_TonKhoPhuKien không có 2 cột này nên JOIN thẳng danh mục — khỏi phải sửa view. */
  const result = await pool.request().query(
    `SELECT v.*, dm2.DonViQuyDoi, dm2.TyLeQuyDoi FROM vw_TonKhoPhuKien v JOIN DanhMucPhuKien dm2 ON dm2.PhuKienID = v.PhuKienID ORDER BY v.MaPhuKien`);
  res.json({ success: true, data: result.recordset });
});

router.post('/items', requireAuth, requirePermission('PHUKIEN', 'create'), requireChucNang('PHUKIEN', 'danhmuc'), async (req, res) => {
  try {
    const { ma, ten, loaiPhuKienId, loaiMoiText, size, donViCoBan, donViQuyDoi, tyLeQuyDoi, ghiChu, anhDaiDien } = req.body;
    if (!ma || !ten || !donViCoBan) {
      return res.status(400).json({ success: false, message: 'Thiếu mã phụ kiện, tên phụ kiện hoặc đơn vị tính cơ bản.' });
    }
    const pool = await getPool();
    const exists = await pool.request().input('m', sql.NVarChar, ma).query('SELECT PhuKienID FROM DanhMucPhuKien WHERE MaPhuKien=@m');
    if (exists.recordset.length) return res.status(400).json({ success: false, message: 'Mã phụ kiện này đã tồn tại, dùng chức năng Sửa.' });

    const resolvedLoaiId = await resolveLoaiPhuKienId(pool, loaiPhuKienId || null, loaiMoiText);

    const coAnh = await coCotPK(pool, 'DanhMucPhuKien', 'AnhDaiDien');   // v5.87 (migration_v660)
    const rq = pool.request()
      .input('MaPhuKien', sql.NVarChar, ma.trim())
      .input('TenPhuKien', sql.NVarChar, ten)
      .input('LoaiPhuKienID', sql.Int, resolvedLoaiId)
      .input('Size', sql.NVarChar, size || null)
      .input('DonViCoBan', sql.NVarChar, donViCoBan)
      .input('DonViQuyDoi', sql.NVarChar, donViQuyDoi || null)
      .input('TyLeQuyDoi', sql.Decimal(12, 4), tyLeQuyDoi || null)
      .input('GhiChu', sql.NVarChar, ghiChu || null);
    if (coAnh) rq.input('AnhDaiDien', sql.NVarChar, anhDaiDien || null);
    const result = await rq
      .query(`INSERT INTO DanhMucPhuKien (MaPhuKien, TenPhuKien, LoaiPhuKienID, Size, DonViCoBan, DonViQuyDoi, TyLeQuyDoi, GhiChu${coAnh ? ', AnhDaiDien' : ''})
              OUTPUT INSERTED.PhuKienID
              VALUES (@MaPhuKien, @TenPhuKien, @LoaiPhuKienID, @Size, @DonViCoBan, @DonViQuyDoi, @TyLeQuyDoi, @GhiChu${coAnh ? ', @AnhDaiDien' : ''})`);
    res.json({ success: true, data: { phuKienId: result.recordset[0].PhuKienID, ma } });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Lỗi khi thêm danh mục phụ kiện: ' + err.message });
  }
});

router.put('/items/:id', requireAuth, requirePermission('PHUKIEN', 'edit'), requireChucNang('PHUKIEN', 'danhmuc'), async (req, res) => {
  try {
    const { ten, loaiPhuKienId, loaiMoiText, size, donViCoBan, donViQuyDoi, tyLeQuyDoi, ghiChu, anhDaiDien } = req.body;
    const pool = await getPool();
    const resolvedLoaiId = await resolveLoaiPhuKienId(pool, loaiPhuKienId || null, loaiMoiText);

    // v5.87: ảnh phụ kiện. KHÔNG gửi khóa anhDaiDien = GIỮ NGUYÊN ảnh cũ (form Sửa không chọn file mới);
    // gửi chuỗi rỗng = XÓA ảnh. Cùng quy ước với ảnh đại diện của Thẻ kho hàng hóa.
    const coAnh = await coCotPK(pool, 'DanhMucPhuKien', 'AnhDaiDien');
    const doiAnh = coAnh && Object.prototype.hasOwnProperty.call(req.body, 'anhDaiDien');
    const rq = pool.request()
      .input('id', sql.Int, req.params.id)
      .input('TenPhuKien', sql.NVarChar, ten)
      .input('LoaiPhuKienID', sql.Int, resolvedLoaiId)
      .input('Size', sql.NVarChar, size || null)
      .input('DonViCoBan', sql.NVarChar, donViCoBan)
      .input('DonViQuyDoi', sql.NVarChar, donViQuyDoi || null)
      .input('TyLeQuyDoi', sql.Decimal(12, 4), tyLeQuyDoi || null)
      .input('GhiChu', sql.NVarChar, ghiChu || null);
    if (doiAnh) rq.input('AnhDaiDien', sql.NVarChar, anhDaiDien || null);
    await rq
      .query(`UPDATE DanhMucPhuKien SET TenPhuKien=@TenPhuKien, LoaiPhuKienID=@LoaiPhuKienID, Size=@Size,
              DonViCoBan=@DonViCoBan, DonViQuyDoi=@DonViQuyDoi, TyLeQuyDoi=@TyLeQuyDoi, GhiChu=@GhiChu${doiAnh ? ', AnhDaiDien=@AnhDaiDien' : ''}
              WHERE PhuKienID=@id`);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Lỗi khi cập nhật danh mục phụ kiện: ' + err.message });
  }
});

router.delete('/items/:id', requireAuth, requirePermission('PHUKIEN', 'delete'), requireChucNang('PHUKIEN', 'danhmuc'), async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request().input('id', sql.Int, req.params.id).query('DELETE FROM DanhMucPhuKien WHERE PhuKienID=@id');
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Không thể xóa (có thể đã phát sinh phiếu nhập/xuất cho mã này).' });
  }
});

// ============ PHIEU NHAP / XUAT (ledger: 1 dau phieu + nhieu dong chi tiet) ============
// v5.0 (Phase 4): 1 route dung chung cho 2 tab (phieunhap/phieuxuat), phan biet qua body.loaiPhieu -
// khong the gan requireChucNang() tinh (co dinh 1 machucnang) nhu cac route khac, phai chon dong tai
// request-time. Body da duoc parse (express.json() dang ky global truoc router) nen doc duoc req.body.loaiPhieu.
/* v5.95 từng bắt buộc: 1 PHIẾU NHẬP NPL chỉ gồm MỘT loại phụ kiện (hàm kiemTraCungLoaiPK chặn ở backend).
   v6.10 — ĐÃ GỠ RÀNG BUỘC theo yêu cầu: "phiếu nhập phụ kiện bỏ bắt buộc chọn loại phụ kiện, 1 phiếu
   nhập được nhiều loại phụ kiện". Gỡ ở CẢ backend chứ không chỉ ở form — form gỡ mà máy chủ vẫn chặn
   thì bấm Lưu sẽ báo lỗi "Mỗi phiếu nhập chỉ được 1 loại phụ kiện" mà không hiểu vì sao.
   PHIẾU XUẤT trước giờ vẫn cho nhiều loại — nay 2 loại phiếu hành xử giống nhau. */

function requirePhieuChucNang(req, res, next) {
  const maChucNang = req.body && req.body.loaiPhieu === 'Nhập' ? 'phieunhap' : 'phieuxuat';
  return requireChucNang('PHUKIEN', maChucNang)(req, res, next);
}
router.post('/phieu', requireAuth, requirePermission('PHUKIEN', 'create'), requirePhieuChucNang, async (req, res) => {
  try {
    const user = req.session.user;
    // v6.66: laTraNCC — phiếu XUẤT có thể là TRẢ HÀNG VỀ NCC, giảm công nợ phải trả.
    // Đơn giá dòng đã có sẵn (`d.donGia`), trước giờ form Xuất không gửi; nay tích Trả NCC thì gửi.
    const { ngay, loaiPhieu, maDon, donHangId, nccId, soHoaDon, ngayHoaDon, ghiChu, details, laTraNCC } = req.body;
    if (!ngay || (loaiPhieu !== 'Nhập' && loaiPhieu !== 'Xuất')) {
      return res.status(400).json({ success: false, message: 'Thiếu ngày hoặc loại phiếu không hợp lệ.' });
    }
    if (!Array.isArray(details) || !details.length) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập ít nhất 1 phụ kiện có số lượng > 0.' });
    }
    const pool = await getPool();
    // v6.10: bỏ kiểm tra "1 phiếu nhập chỉ 1 loại phụ kiện" (v5.95) — nay nhập bao nhiêu loại cũng được.

    // v5.4: them NgayHoaDon (khop mau_phieu.docx "Ngay hoa don" - chi form Phieu Nhap co truong nay,
    // Phieu Xuat luon gui NULL nen luu chung 1 cot cho don gian, khong anh huong Xuat).
    const traNCC = !!laTraNCC && loaiPhieu === 'Xuất';
    if (traNCC && !nccId) {
      return res.status(400).json({ success: false, message: 'Phiếu xuất đánh dấu "Trả nhà cung cấp" nhưng chưa chọn nhà cung cấp.' });
    }
    /* Dò cột LaTraNCC (migration_v676) trước khi đưa vào INSERT: hệ thống chưa chạy migration vẫn
       lập phiếu xuất bình thường, chỉ không dùng được phần trả NCC. */
    let coTraNCC = false;
    try {
      const r = (await pool.request().query(`SELECT COL_LENGTH('PhieuPhuKien','LaTraNCC') AS c`)).recordset[0] || {};
      coTraNCC = r.c != null;
    } catch (e) { coTraNCC = false; }
    if (traNCC && !coTraNCC) {
      return res.status(400).json({ success: false, message: 'Chưa chạy migration_v676 nên chưa lưu được phiếu trả nhà cung cấp.' });
    }
    const rqPhieu = pool.request()
      .input('Ngay', sql.Date, ngay)
      .input('LoaiPhieu', sql.NVarChar, loaiPhieu)
      .input('MaDon', sql.NVarChar, maDon || null)
      .input('DonHangID', sql.Int, donHangId || null)
      .input('NCC_ID', sql.Int, nccId || null)
      .input('SoHoaDon', sql.NVarChar, soHoaDon || null)
      .input('NgayHoaDon', sql.Date, ngayHoaDon || null)
      .input('GhiChu', sql.NVarChar, ghiChu || null)
      .input('NguoiTaoID', sql.Int, user.userId);
    if (coTraNCC) rqPhieu.input('LaTraNCC', sql.Bit, traNCC ? 1 : 0);
    const phieuResult = await rqPhieu
      .query(`INSERT INTO PhieuPhuKien (Ngay, LoaiPhieu, MaDon, DonHangID, NCC_ID, SoHoaDon, NgayHoaDon, GhiChu, NguoiTaoID${coTraNCC ? ', LaTraNCC' : ''})
              OUTPUT INSERTED.PhieuID
              VALUES (@Ngay, @LoaiPhieu, @MaDon, @DonHangID, @NCC_ID, @SoHoaDon, @NgayHoaDon, @GhiChu, @NguoiTaoID${coTraNCC ? ', @LaTraNCC' : ''})`);
    const phieuId = phieuResult.recordset[0].PhieuID;

    // v5.4: them DonGia (khop mau_phieu.docx - chi Phieu Nhap PK co cot nay, form Xuat khong gui
    // donGia nen se luon la NULL cho dong cua Phieu Xuat).
    for (const d of details) {
      const soLuong = Number(d.soLuong) || 0;
      if (!d.phuKienId || soLuong <= 0) continue;
      await pool.request()
        .input('PhieuID', sql.Int, phieuId)
        .input('PhuKienID', sql.Int, d.phuKienId)
        .input('SoLuong', sql.Decimal(14, 2), soLuong)
        .input('DonVi', sql.NVarChar, d.donVi || null)
        .input('GhiChu', sql.NVarChar, d.ghiChu || null)
        .input('DonGia', sql.Decimal(14, 2), d.donGia || null)
        .query(`INSERT INTO PhieuPhuKienChiTiet (PhieuID, PhuKienID, SoLuong, DonVi, GhiChu, DonGia)
                VALUES (@PhieuID, @PhuKienID, @SoLuong, @DonVi, @GhiChu, @DonGia)`);
    }
    res.json({ success: true, data: { phieuId } });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Lỗi khi lưu phiếu: ' + err.message });
  }
});

// ============ DANH SACH / CHI TIET / SUA / XOA PHIEU (v5.0 muc 5a/5b) ============
// Tach rieng namespace /phieunhap va /phieuxuat (giong khovai.js) de gan requireChucNang() TINH cho
// tung loai, thay vi dung chung 1 route dong nhu POST /phieu (don gian hon, de audit quyen hon).
async function getPhieuList(pool, loaiPhieu) {
  // v5.4: them p.NgayHoaDon (can de dien san khi mo Sua phieu tu danh sach nay - openPhieuNhapEditModal).
  const result = await pool.request().input('loai', sql.NVarChar, loaiPhieu).query(`
    SELECT p.PhieuID, p.Ngay, p.MaDon, p.GhiChu, p.SoHoaDon, p.NgayHoaDon, p.DonHangID,
      d.MaDH, ncc.TenNCC, u.HoTen AS NguoiTao,
      (SELECT COUNT(*) FROM PhieuPhuKienChiTiet ct WHERE ct.PhieuID = p.PhieuID) AS SoDongPhuKien,
      (SELECT ISNULL(SUM(ct.SoLuong),0) FROM PhieuPhuKienChiTiet ct WHERE ct.PhieuID = p.PhieuID) AS TongSoLuong,
      -- v5.84: Mã rập của đơn hàng gắn kèm (cột mới ở danh sách Phiếu Xuất).
      STUFF((SELECT DISTINCT ', ' + sd.MaRap FROM DonHangChiTietSoDo sd
             WHERE sd.DonHangID = p.DonHangID AND sd.MaRap IS NOT NULL AND LTRIM(RTRIM(sd.MaRap)) <> ''
             FOR XML PATH('')), 1, 2, '') AS MaRap
    FROM PhieuPhuKien p
    LEFT JOIN DonHangSanXuat d ON d.DonHangID = p.DonHangID
    LEFT JOIN NhaCungCap ncc ON ncc.NCC_ID = p.NCC_ID
    LEFT JOIN Users u ON u.UserID = p.NguoiTaoID
    WHERE p.LoaiPhieu = @loai
    ORDER BY p.PhieuID DESC`);
  return result.recordset;
}

async function getPhieuDetail(pool, phieuId, loaiPhieu) {
  // v5.7: them d.AnhSanPham (chi thuc su dung cho Phieu Xuat - gan voi don hang; Phieu Nhap khong gan
  // don hang nen se la NULL, vo hai) - yeu cau v5.7 "thêm Ảnh sản phẩm vào các bản in".
  // v5.84: + MaRap cho phiếu XUẤT (in phiếu / xem chi tiết) — gộp từ DonHangChiTietSoDo như các phiếu khác.
  const headerResult = await pool.request().input('id', sql.Int, phieuId).input('loai', sql.NVarChar, loaiPhieu).query(`
    SELECT p.*, d.MaDH, d.AnhSanPham, ncc.TenNCC,
      STUFF((SELECT DISTINCT ', ' + sd.MaRap FROM DonHangChiTietSoDo sd
             WHERE sd.DonHangID = p.DonHangID AND sd.MaRap IS NOT NULL AND LTRIM(RTRIM(sd.MaRap)) <> ''
             FOR XML PATH('')), 1, 2, '') AS MaRap
    FROM PhieuPhuKien p
    LEFT JOIN DonHangSanXuat d ON d.DonHangID = p.DonHangID
    LEFT JOIN NhaCungCap ncc ON ncc.NCC_ID = p.NCC_ID
    WHERE p.PhieuID=@id AND p.LoaiPhieu=@loai`);
  if (!headerResult.recordset.length) return null;
  const header = headerResult.recordset[0];
  // v5.4 (Phieu Xuat): them SLTheoChiDinh - so luong phu kien da duoc gan cho don hang nay o cong doan
  // "Chi dinh NPL" (DonHangChiTietPhuKien, xem GET /donhang/:id/npl o tren) - de in phieu Xuat co cot
  // doi chieu "SL theo chi dinh" ben canh SL thuc xuat. Voi Phieu Nhap (khong gan voi khai niem chi dinh
  // NPL) hoac phieu khong gan don hang, gia tri nay se la NULL (vo hai, cot chi hien tren template Xuat).
  // v5.4: them lpk.TenLoai (cot "Loai PK" tren mau in mau_phieu.docx, ca Nhap va Xuat).
  // v5.88: + dm.AnhDaiDien -> mọi phiếu NPL (xem chi tiết + bản in) đều có cột Ảnh.
  const coAnhPK = await coCotPK(pool, 'DanhMucPhuKien', 'AnhDaiDien');
  const linesResult = await pool.request().input('id', sql.Int, phieuId).input('donHangId', sql.Int, header.DonHangID || null).query(`
    SELECT ct.*, dm.MaPhuKien, dm.TenPhuKien, lpk.TenLoai,
      dm.DonViCoBan, dm.DonViQuyDoi, dm.TyLeQuyDoi,   -- v6.30: để bản in/xem phiếu tính được cột quy đổi
      ${coAnhPK ? 'dm.AnhDaiDien' : "CAST(NULL AS NVARCHAR(500)) AS AnhDaiDien"},
      (SELECT SUM(dpk.SoLuong) FROM DonHangChiTietPhuKien dpk
       WHERE dpk.DonHangID = @donHangId AND dpk.PhuKienID = ct.PhuKienID) AS SLTheoChiDinh
    FROM PhieuPhuKienChiTiet ct
    JOIN DanhMucPhuKien dm ON dm.PhuKienID = ct.PhuKienID
    LEFT JOIN LoaiPhuKien lpk ON lpk.LoaiPhuKienID = dm.LoaiPhuKienID
    WHERE ct.PhieuID=@id`);
  return { header, lines: linesResult.recordset };
}

router.get('/phieunhap', requireAuth, requirePermission('PHUKIEN', 'view'), requireChucNang('PHUKIEN', 'phieunhap'), async (req, res) => {
  const pool = await getPool();
  res.json({ success: true, data: await getPhieuList(pool, 'Nhập') });
});
/* ================================================================================================
   v6.66.3: TRA HANG VE NHA CUNG CAP - lay tu chinh PHIEU NHAP cua NCC do.
   Phieu nhap phu kien DA CO cot DonGia, nen khong can them cot don gia vao form xuat: chon dong
   trong phieu nhap la co san gia -> so giam no khop dung so da ghi no, khong ai phai go lai.

   CHAN TRA VUOT tinh theo CAP (NCC, PhuKienID) tren TOAN BO phieu, khong theo tung dong nhap:
   cung mot ma phu kien co the nhap nhieu phieu, chan theo dong se vua chat vua sai. Cong thuc:
       da nhap tu NCC nay  -  da tra ve NCC nay  >=  so dinh tra
   ================================================================================================ */
router.get('/ncc/:nccId/phieunhap', requireAuth, requirePermission('PHUKIEN', 'view'), requireChucNang('PHUKIEN', 'phieuxuat'), async (req, res) => {
  const pool = await getPool();
  const rs = (await pool.request().input('ncc', sql.Int, req.params.nccId).query(`
    SELECT p.PhieuID, p.Ngay, p.SoHoaDon, p.GhiChu,
           COUNT(ct.ID) AS SoDong,
           ISNULL(SUM(ISNULL(ct.SoLuong,0) * ISNULL(ct.DonGia,0)), 0) AS TongTien
    FROM PhieuPhuKien p LEFT JOIN PhieuPhuKienChiTiet ct ON ct.PhieuID = p.PhieuID
    WHERE p.LoaiPhieu = N'Nhập' AND p.NCC_ID = @ncc
    GROUP BY p.PhieuID, p.Ngay, p.SoHoaDon, p.GhiChu
    ORDER BY p.Ngay DESC, p.PhieuID DESC`)).recordset;
  res.json({ success: true, data: rs });
});

router.get('/phieunhap/:id/dongtra', requireAuth, requirePermission('PHUKIEN', 'view'), requireChucNang('PHUKIEN', 'phieuxuat'), async (req, res) => {
  const pool = await getPool();
  const p = (await pool.request().input('id', sql.Int, req.params.id)
    .query(`SELECT PhieuID, NCC_ID FROM PhieuPhuKien WHERE PhieuID=@id AND LoaiPhieu=N'Nhập'`)).recordset[0];
  if (!p) return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu nhập phụ kiện.' });
  if (!p.NCC_ID) return res.status(400).json({ success: false, message: 'Phiếu nhập này không gắn nhà cung cấp nên không dùng để trả hàng được.' });
  /* Cot LaTraNCC do migration_v676 them - chua chay migration thi coi nhu chua tra gi (0). */
  let coTra = false;
  try {
    const r = (await pool.request().query(`SELECT COL_LENGTH('PhieuPhuKien','LaTraNCC') AS c`)).recordset[0] || {};
    coTra = r.c != null;
  } catch (e) { coTra = false; }
  const daTraSQL = coTra ? `
    ISNULL((SELECT SUM(x.SoLuong) FROM PhieuPhuKienChiTiet x
            JOIN PhieuPhuKien xp ON xp.PhieuID = x.PhieuID
            WHERE xp.LoaiPhieu = N'Xuất' AND xp.LaTraNCC = 1 AND xp.NCC_ID = @ncc
              AND x.PhuKienID = ct.PhuKienID), 0)` : '0';
  const rs = (await pool.request().input('id', sql.Int, req.params.id).input('ncc', sql.Int, p.NCC_ID).query(`
    SELECT ct.ID, ct.PhuKienID, ct.SoLuong, ct.DonVi, ct.DonGia, ct.GhiChu,
           pk.MaPhuKien, pk.TenPhuKien,
           ISNULL((SELECT SUM(n.SoLuong) FROM PhieuPhuKienChiTiet n
                   JOIN PhieuPhuKien np ON np.PhieuID = n.PhieuID
                   WHERE np.LoaiPhieu = N'Nhập' AND np.NCC_ID = @ncc
                     AND n.PhuKienID = ct.PhuKienID), 0) AS TongNhapNCC,
           ${daTraSQL} AS DaTraNCC
    FROM PhieuPhuKienChiTiet ct
    JOIN DanhMucPhuKien pk ON pk.PhuKienID = ct.PhuKienID
    WHERE ct.PhieuID = @id ORDER BY ct.ID`)).recordset;
  // Con tra duoc = tong nhap tu NCC nay - tong da tra ve NCC nay, nhung khong vuot qua SL cua chinh dong
  const data = rs.map(r => ({
    ...r,
    ConTra: Math.max(0, Math.min(Number(r.SoLuong) || 0,
      (Number(r.TongNhapNCC) || 0) - (Number(r.DaTraNCC) || 0)))
  }));
  res.json({ success: true, data });
});

router.get('/phieuxuat', requireAuth, requirePermission('PHUKIEN', 'view'), requireChucNang('PHUKIEN', 'phieuxuat'), async (req, res) => {
  const pool = await getPool();
  res.json({ success: true, data: await getPhieuList(pool, 'Xuất') });
});

router.get('/phieunhap/:id', requireAuth, requirePermission('PHUKIEN', 'view'), requireChucNang('PHUKIEN', 'phieunhap'), async (req, res) => {
  const pool = await getPool();
  const data = await getPhieuDetail(pool, req.params.id, 'Nhập');
  if (!data) return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu nhập.' });
  res.json({ success: true, data });
});
router.get('/phieuxuat/:id', requireAuth, requirePermission('PHUKIEN', 'view'), requireChucNang('PHUKIEN', 'phieuxuat'), async (req, res) => {
  const pool = await getPool();
  const data = await getPhieuDetail(pool, req.params.id, 'Xuất');
  if (!data) return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu xuất.' });
  res.json({ success: true, data });
});

/* v5.85 — SỬA ĐƯỢC CẢ CHI TIẾT DÒNG (trước đây chỉ sửa được đầu phiếu, muốn đổi dòng phải xóa phiếu
   và tạo lại). Cách làm giống Kho vải: XÓA HẾT dòng cũ rồi ghi lại danh sách mới — an toàn vì tồn kho
   phụ kiện được TÍNH LẠI từ các dòng phiếu (không có cột tồn lũy kế nào phải chỉnh tay).
   `details` là TÙY CHỌN: không gửi thì chỉ cập nhật đầu phiếu như cũ (tương thích ngược).
   Validate TRƯỚC khi xóa để không bao giờ để phiếu rỗng. */
async function ghiLaiChiTietPhieu(pool, phieuId, details) {
  const hopLe = (details || []).filter(d => d.phuKienId && Number(d.soLuong) > 0);
  if (!hopLe.length) { const e = new Error('Phiếu phải có ít nhất 1 dòng phụ kiện có số lượng > 0.'); e.viPham = true; throw e; }
  /* v6.59: GIỮ ĐƠN GIÁ CŨ khi form không gửi lên.
     Đây là xóa-rồi-chèn-lại, mà form Sửa phiếu XUẤT không có ô đơn giá (chỉ phiếu nhập có), nên
     `d.donGia` luôn undefined -> mọi dòng bị ghi DonGia = NULL. Phiếu xuất hiện chưa dùng cột này,
     nhưng dữ liệu nhập từ Excel hoặc phiếu cũ có giá thì mất trắng.
     Đọc giá cũ theo (PhieuID, PhuKienID) TRƯỚC khi xóa, rồi lùi về nó khi client không gửi. */
  const giaCu = new Map();
  (await pool.request().input('id', sql.Int, phieuId)
    .query('SELECT PhuKienID, DonGia FROM PhieuPhuKienChiTiet WHERE PhieuID=@id')).recordset
    .forEach(r => { if (r.DonGia != null) giaCu.set(String(r.PhuKienID), r.DonGia); });
  await pool.request().input('id', sql.Int, phieuId).query('DELETE FROM PhieuPhuKienChiTiet WHERE PhieuID=@id');
  for (const d of hopLe) {
    const coGuiGia = Object.prototype.hasOwnProperty.call(d, 'donGia') && d.donGia !== undefined && d.donGia !== null;
    const gia = coGuiGia ? (d.donGia || null) : (giaCu.has(String(d.phuKienId)) ? giaCu.get(String(d.phuKienId)) : null);
    await pool.request()
      .input('PhieuID', sql.Int, phieuId)
      .input('PhuKienID', sql.Int, d.phuKienId)
      .input('SoLuong', sql.Decimal(14, 2), Number(d.soLuong) || 0)
      .input('DonVi', sql.NVarChar, d.donVi || null)
      .input('GhiChu', sql.NVarChar, d.ghiChu || null)
      .input('DonGia', sql.Decimal(14, 2), gia)
      .query(`INSERT INTO PhieuPhuKienChiTiet (PhieuID, PhuKienID, SoLuong, DonVi, GhiChu, DonGia)
              VALUES (@PhieuID, @PhuKienID, @SoLuong, @DonVi, @GhiChu, @DonGia)`);
  }
}
router.put('/phieunhap/:id', requireAuth, requirePermission('PHUKIEN', 'edit'), requireChucNang('PHUKIEN', 'phieunhap'), async (req, res) => {
  try {
    const { ngay, nccId, soHoaDon, ngayHoaDon, ghiChu, details } = req.body;
    const pool = await getPool();
    const result = await pool.request().input('id', sql.Int, req.params.id).input('loai', sql.NVarChar, 'Nhập')
      .input('Ngay', sql.Date, ngay).input('NCC_ID', sql.Int, nccId || null)
      .input('SoHoaDon', sql.NVarChar, soHoaDon || null).input('NgayHoaDon', sql.Date, ngayHoaDon || null)
      .input('GhiChu', sql.NVarChar, ghiChu || null)
      .query(`UPDATE PhieuPhuKien SET Ngay=@Ngay, NCC_ID=@NCC_ID, SoHoaDon=@SoHoaDon, NgayHoaDon=@NgayHoaDon, GhiChu=@GhiChu
              WHERE PhieuID=@id AND LoaiPhieu=@loai`);
    if (!result.rowsAffected[0]) return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu nhập.' });
    if (Array.isArray(details)) {
      // v6.10: bỏ kiểm tra "1 phiếu nhập chỉ 1 loại phụ kiện" khi SỬA phiếu (đồng bộ với lúc tạo mới).
      await ghiLaiChiTietPhieu(pool, req.params.id, details);
    }
    res.json({ success: true });
  } catch (err) {
    if (!err.viPham) console.error(err);
    res.status(400).json({ success: false, message: err.viPham ? err.message : 'Lỗi khi cập nhật phiếu nhập: ' + err.message });
  }
});
router.put('/phieuxuat/:id', requireAuth, requirePermission('PHUKIEN', 'edit'), requireChucNang('PHUKIEN', 'phieuxuat'), async (req, res) => {
  try {
    const { ngay, maDon, ghiChu, details } = req.body;
    const pool = await getPool();
    // v5.85: cho đổi luôn ĐƠN HÀNG gắn kèm (giống PUT /xuat/:id của kho vải, v5.64). Chỉ đổi khi client
    // GỬI khóa donHangId — không gửi = giữ nguyên; gửi rỗng/null = gỡ khỏi đơn (xuất tự do).
    const doiDon = Object.prototype.hasOwnProperty.call(req.body, 'donHangId');
    const cauLenh = pool.request().input('id', sql.Int, req.params.id).input('loai', sql.NVarChar, 'Xuất')
      .input('Ngay', sql.Date, ngay).input('MaDon', sql.NVarChar, maDon || null).input('GhiChu', sql.NVarChar, ghiChu || null);
    if (doiDon) cauLenh.input('DonHangID', sql.Int, req.body.donHangId || null);
    const result = await cauLenh.query(`UPDATE PhieuPhuKien SET Ngay=@Ngay, MaDon=@MaDon, GhiChu=@GhiChu${doiDon ? ', DonHangID=@DonHangID' : ''}
              WHERE PhieuID=@id AND LoaiPhieu=@loai`);
    if (!result.rowsAffected[0]) return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu xuất.' });
    if (Array.isArray(details)) await ghiLaiChiTietPhieu(pool, req.params.id, details);
    res.json({ success: true });
  } catch (err) {
    if (!err.viPham) console.error(err);
    res.status(400).json({ success: false, message: err.viPham ? err.message : 'Lỗi khi cập nhật phiếu xuất: ' + err.message });
  }
});

/* v5.85: DANH SÁCH PHIẾU XUẤT PHỤ KIỆN CỦA 1 ĐƠN HÀNG — dùng cho popup "bấm vào trạng thái Đã xuất kho
   ở Chỉ định NPL để xem đã xuất những phiếu nào". Gate theo chức năng 'phieuxuat' như các route phiếu xuất. */
router.get('/donhang/:donHangId/phieuxuat', requireAuth, requirePermission('PHUKIEN', 'view'), requireChucNang('PHUKIEN', 'phieuxuat'), async (req, res) => {
  const pool = await getPool();
  const result = await pool.request().input('id', sql.Int, req.params.donHangId).query(`
    SELECT p.PhieuID, p.Ngay, p.MaDon, p.GhiChu, u.HoTen AS NguoiTao,
      (SELECT COUNT(*) FROM PhieuPhuKienChiTiet ct WHERE ct.PhieuID = p.PhieuID) AS SoDongPhuKien,
      (SELECT ISNULL(SUM(ct.SoLuong),0) FROM PhieuPhuKienChiTiet ct WHERE ct.PhieuID = p.PhieuID) AS TongSoLuong
    FROM PhieuPhuKien p
    LEFT JOIN Users u ON u.UserID = p.NguoiTaoID
    WHERE p.DonHangID = @id AND p.LoaiPhieu = N'Xuất'
    ORDER BY p.PhieuID DESC`);
  res.json({ success: true, data: result.recordset });
});

// Xoa: PhieuPhuKienChiTiet co ON DELETE CASCADE theo PhieuID (xem schema.sql) nen chi can xoa dong
// dau phieu la du, khong nhu Kho vai (khong co cot trang thai luy ke can tinh lai sau khi xoa).
router.delete('/phieunhap/:id', requireAuth, requirePermission('PHUKIEN', 'delete'), requireChucNang('PHUKIEN', 'phieunhap'), async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().input('id', sql.Int, req.params.id).input('loai', sql.NVarChar, 'Nhập')
      .query('DELETE FROM PhieuPhuKien WHERE PhieuID=@id AND LoaiPhieu=@loai');
    if (!result.rowsAffected[0]) return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu nhập.' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Không thể xóa phiếu nhập.' });
  }
});
router.delete('/phieuxuat/:id', requireAuth, requirePermission('PHUKIEN', 'delete'), requireChucNang('PHUKIEN', 'phieuxuat'), async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().input('id', sql.Int, req.params.id).input('loai', sql.NVarChar, 'Xuất')
      .query('DELETE FROM PhieuPhuKien WHERE PhieuID=@id AND LoaiPhieu=@loai');
    if (!result.rowsAffected[0]) return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu xuất.' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Không thể xóa phiếu xuất.' });
  }
});

// v5.0 (muc 5b): phu kien da duoc gan cho 1 don hang o cong doan "Chi dinh NPL" (xem DonHangChiTietPhuKien,
// ghi tu POST /api/qlsx/orders) - dung de gioi han danh sach phu kien duoc chon trong Phieu Xuat khi gan don hang.
router.get('/donhang/:donHangId/npl', requireAuth, requirePermission('PHUKIEN', 'view'), requireChucNang('PHUKIEN', 'phieuxuat'), async (req, res) => {
  const pool = await getPool();
  // v5.8.1 (yeu cau moi "Phieu xuat phu kien chua hien thi so luong chi dinh cua tung phu kien"): them
  // SLTheoChiDinh vao response - truoc day endpoint nay chi tra ve danh muc phu kien (dm.*) de loc dropdown,
  // KHONG bao gio tra ve ct.SoLuong (so luong da chi dinh) nen form tao Phieu Xuat khong the hien thi no.
  // Gom nhom (SUM...GROUP BY) truoc theo PhuKienID trong 1 subquery thay vi JOIN truc tiep ct.SoLuong, de
  // an toan neu lo tay "Chi dinh NPL" tao 2 dong cung 1 phu kien cho cung don hang (khong co UNIQUE constraint
  // chan viec nay) - tranh phu kien bi liet ke lap dong trong danh sach tim kiem. Dung ten cot SLTheoChiDinh
  // giong getPhieuDetail() (backend) / printPhieuXuatPK() (frontend) de nhat quan.
  // v5.84: thêm SLDaXuat (đã xuất kho cho ĐÚNG đơn hàng này, cộng dồn MỌI phiếu Xuất) để form Phiếu
  // xuất hiển thị BẢNG "Chỉ định NPL (tham khảo)" có cột Đã xuất / Còn lại — giống bảng chỉ định vải
  // SX ở phiếu xuất kho vải. Không lọc theo phiếu đang lập nên số liệu là tổng lũy kế của đơn.
  const result = await pool.request().input('id', sql.Int, req.params.donHangId).query(`
    SELECT dm.*, lpk.TenLoai, agg.SLTheoChiDinh,
      ISNULL((SELECT SUM(ct.SoLuong) FROM PhieuPhuKienChiTiet ct
              JOIN PhieuPhuKien p ON p.PhieuID = ct.PhieuID
              WHERE p.DonHangID = @id AND p.LoaiPhieu = N'Xuất' AND ct.PhuKienID = agg.PhuKienID), 0) AS SLDaXuat
    FROM (SELECT PhuKienID, SUM(SoLuong) AS SLTheoChiDinh FROM DonHangChiTietPhuKien WHERE DonHangID=@id GROUP BY PhuKienID) agg
    JOIN DanhMucPhuKien dm ON dm.PhuKienID = agg.PhuKienID
    LEFT JOIN LoaiPhuKien lpk ON lpk.LoaiPhuKienID = dm.LoaiPhuKienID
    ORDER BY dm.MaPhuKien`);
  res.json({ success: true, data: result.recordset });
});

// ============ THE KHO / TON KHO (chi tiet theo 1 ma, hoac tong hop loc theo loai) ============
router.get('/thekho', requireAuth, requirePermission('PHUKIEN', 'view'), requireChucNang('PHUKIEN', 'thekho'), async (req, res) => {
  const pool = await getPool();
  const { maPhuKien, loaiPhuKien } = req.query;

  /* v7.52: + ẢNH phụ kiện cho màn Thẻ kho / Tồn kho. Cột DanhMucPhuKien.AnhDaiDien có từ v5.87
     (migration_v660) — dò cột bằng `coCotPK` ĐÃ CÓ SẴN trong file này, chưa chạy migration thì trả
     NULL để màn hình chạy như cũ. */
  const coAnhTK = await coCotPK(pool, 'DanhMucPhuKien', 'AnhDaiDien');
  const cotAnhTK = (alias) => (coAnhTK ? `${alias}.AnhDaiDien` : "CAST(NULL AS NVARCHAR(500))");

  if (maPhuKien) {
    // v6.13: trả thêm PhieuID để bấm vào dòng lịch sử là mở đúng phiếu nhập/xuất ra xem/sửa.
    const result = await pool.request().input('m', sql.NVarChar, maPhuKien).query(`
      SELECT p.PhieuID, p.Ngay, p.LoaiPhieu, p.MaDon, d.MaDH AS MaDonHang, ct.SoLuong, ct.DonVi,
             ${cotAnhTK('dm')} AS AnhDaiDien
      FROM PhieuPhuKienChiTiet ct
      JOIN PhieuPhuKien p ON p.PhieuID = ct.PhieuID
      JOIN DanhMucPhuKien dm ON dm.PhuKienID = ct.PhuKienID
      LEFT JOIN DonHangSanXuat d ON d.DonHangID = p.DonHangID
      WHERE dm.MaPhuKien = @m
      ORDER BY p.Ngay, p.PhieuID`);

    let tonCuoi = 0;
    const rows = result.recordset.map(r => {
      const nhap = r.LoaiPhieu === 'Nhập' ? Number(r.SoLuong) : 0;
      const xuat = r.LoaiPhieu === 'Xuất' ? Number(r.SoLuong) : 0;
      tonCuoi += nhap - xuat;
      return {
        loaiBaoCao: 'chitiet', phieuId: r.PhieuID, ngay: r.Ngay, loaiPhieu: r.LoaiPhieu,   // v6.13: + phieuId
        donHang: r.MaDonHang || r.MaDon || '', nhap, xuat, ton: tonCuoi, dvt: r.DonVi,
        AnhDaiDien: r.AnhDaiDien || null   // v7.52: mọi dòng cùng 1 mã nên ảnh giống nhau — hiện 1 lần ở đầu bảng
      };
    });
    return res.json({ success: true, data: rows });
  }

  // v6.32: + ĐVT quy đổi/tỷ lệ cho cột "Tồn quy đổi" (xem ghi chú ở route /thekho).
  /* v7.52: + AnhDaiDien. KHÔNG thêm vào view `vw_TonKhoPhuKien`: view đó là phép tính tồn từ 3 nguồn
     phiếu, nhét thông tin danh mục vào là mỗi lần thêm một ô lại phải sửa view (và view đang được
     nhiều màn dùng chung). Join danh mục ở đây là đủ. */
  let query = `SELECT v.*, dm2.DonViQuyDoi, dm2.TyLeQuyDoi, ${cotAnhTK('dm2')} AS AnhDaiDien,
                      N'tonghop' AS loaiBaoCao
               FROM vw_TonKhoPhuKien v JOIN DanhMucPhuKien dm2 ON dm2.PhuKienID = v.PhuKienID`;
  const request = pool.request();
  if (loaiPhuKien) {
    query += ' WHERE v.TenLoai = @loai';
    request.input('loai', sql.NVarChar, loaiPhuKien);
  }
  query += ' ORDER BY v.MaPhuKien';
  const result = await request.query(query);
  res.json({ success: true, data: result.recordset });
});

// v5.19 (muc 4, yeu cau "Tất cả các phân hệ thẻ kho, Tồn kho có chức năng xuất file excel"): xuat Excel
// don gian cho man hinh "Thẻ kho / Tồn kho" phu kien (tong hop, khong phai lich su chi tiet theo 1 ma).
router.get('/thekho/export', requireAuth, requirePermission('PHUKIEN', 'view'), requireChucNang('PHUKIEN', 'thekho'), async (req, res) => {
  try {
    const pool = await getPool();
    const { loaiPhuKien } = req.query;
    // v6.32: + ĐVT quy đổi/tỷ lệ để cột "Tồn quy đổi" cũng có trong file Excel.
    let query = `SELECT v.*, dm2.DonViQuyDoi, dm2.TyLeQuyDoi FROM vw_TonKhoPhuKien v JOIN DanhMucPhuKien dm2 ON dm2.PhuKienID = v.PhuKienID`;
    const request = pool.request();
    if (loaiPhuKien) {
      query += ' WHERE v.TenLoai = @loai';
      request.input('loai', sql.NVarChar, loaiPhuKien);
    }
    query += ' ORDER BY MaPhuKien';
    const result = await request.query(query);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Tồn kho phụ kiện');
    ws.columns = [
      { header: 'Mã phụ kiện', key: 'MaPhuKien', width: 16 },
      { header: 'Tên phụ kiện', key: 'TenPhuKien', width: 30 },
      { header: 'Loại', key: 'TenLoai', width: 18 },
      { header: 'Size', key: 'Size', width: 10 },
      { header: 'Đơn vị', key: 'DonViCoBan', width: 10 },
      { header: 'Tổng nhập', key: 'TongNhap', width: 12 },
      { header: 'Tổng xuất', key: 'TongXuat', width: 12 },
      { header: 'Tồn kho', key: 'TonKho', width: 12 },
      { header: 'Tồn quy đổi', key: 'TonQuyDoi', width: 14 },
      { header: 'ĐVT quy đổi', key: 'DonViQuyDoi', width: 12 }
    ];
    ws.getRow(1).font = { bold: true };
    /* v6.32: quy tắc trong Danh mục phụ kiện: 1 <ĐVT quy đổi> = <tỷ lệ> × <ĐVT cơ bản>
       => tồn quy đổi = tồn (ĐVT cơ bản) / tỷ lệ. Chưa khai đủ thì để trống, không đoán bừa. */
    result.recordset.forEach(r => {
      const tyLe = Number(r.TyLeQuyDoi) || 0;
      const co = tyLe > 0 && r.DonViQuyDoi && String(r.DonViQuyDoi).trim() !== String(r.DonViCoBan || '').trim();
      ws.addRow({ ...r, TonQuyDoi: co ? Math.round((Number(r.TonKho) || 0) / tyLe * 10000) / 10000 : null,
                  DonViQuyDoi: co ? r.DonViQuyDoi : '' });
    });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="ton_kho_phu_kien.xlsx"');
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Lỗi khi xuất Excel: ' + err.message });
  }
});

module.exports = router;
