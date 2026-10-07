/* ================================================================================================
   CHUONG TRINH KHUYEN MAI (v8.70) — tab trong phan he The kho hang hoa.

   Chuong trinh THAY THE %CKShop cho cac ma duoc gan, trong khoang thoi gian cua no. Het han thi
   tu dong ve lai CK dung chung o CauHinhHeThong — khong phai lam gi them.

   ⚠️ Cong thuc tra %CK nam o utils/khuyenMai.js, KHONG viet lai o day. Ba man hinh deu hoi cung
   mot cau; viet ban thu hai la som muon hai noi tra hai so khac nhau.

   ⚠️ Quyen: dung chung quyen cua phan he KHOHANG (tab nam trong do), chuc nang 'khuyenmai'.
   ================================================================================================ */
const express = require('express');
const { sql, getPool } = require('../db');
const { requireAuth, requirePermission, requireChucNang } = require('../middleware/auth');
const { kiemTrungChuongTrinh, layKhuyenMaiTheoNgay } = require('../utils/khuyenMai');

const router = express.Router();
const CN = 'khuyenmai';

async function layChiTiet(pool, id) {
  return (await pool.request().input('id', sql.Int, id).query(`
    SELECT ct.ID, ct.MaHangID, ct.PhanTramCK, h.MaHang, h.TenHang, h.GiaBan
    FROM ChuongTrinhKhuyenMaiChiTiet ct
    JOIN TheKhoHangHoa h ON h.MaHangID = ct.MaHangID
    WHERE ct.ChuongTrinhID = @id ORDER BY h.MaHang`)).recordset;
}

/* Danh sach chuong trinh + so ma tham gia + trang thai hieu luc TINH THEO HOM NAY (chi de hien
   nhan mau tren danh sach; viec ap gia luon tinh theo NGAY CUA PHIEU, xem utils/khuyenMai.js). */
router.get('/', requireAuth, requirePermission('KHOHANG', 'view'), requireChucNang('KHOHANG', CN), async (req, res) => {
  try {
    const pool = await getPool();
    const rows = (await pool.request().query(`
      SELECT km.*, u.HoTen AS NguoiTao,
             (SELECT COUNT(*) FROM ChuongTrinhKhuyenMaiChiTiet x WHERE x.ChuongTrinhID = km.ID) AS SoMaHang,
             CASE WHEN km.TrangThai <> N'Hoạt động' THEN N'Tạm dừng'
                  WHEN CAST(GETDATE() AS DATE) < km.TuNgay  THEN N'Chưa tới'
                  WHEN CAST(GETDATE() AS DATE) > km.DenNgay THEN N'Đã hết'
                  ELSE N'Đang chạy' END AS HieuLuc
      FROM ChuongTrinhKhuyenMai km
      LEFT JOIN Users u ON u.UserID = km.NguoiTaoID
      ORDER BY km.TuNgay DESC, km.ID DESC`)).recordset;
    res.json({ success: true, data: rows });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: 'Lỗi khi đọc chương trình khuyến mãi: ' + err.message }); }
});

/* ⚠️ GET '/:id' KHONG dat o day — xem cuoi file. Express khop route THEO THU TU khai bao, nen
   '/:id' dung truoc se nuot ca '/chon-ma-hang' va '/ap-dung' (req.params.id = 'chon-ma-hang',
   sql.Int nem loi kieu du lieu). Bai hoc da tra gia o v5.59/v5.60: route CHU CO DINH phai dung
   TRUOC route co tham so. Them route GET moi -> dat phia TREN khoi '/:id' o cuoi file. */

/* ================================================================================================
   v8.70.1 — DANH SACH MA HANG CHO O CHON (Nguyen: "list hang hoa con ton trong kho, co loc theo
   danh muc the kho, loai hang, chon tung ma hoac chon tat ca").

   ⚠️ KHONG dung lai GET /khohang/items: endpoint do dang duoc 8 man hinh dung chung va KHONG loc
   ton (co y - xem ghi chu v7.85 trong khohang.js). O day can mot danh sach KHAC HAN: chi ma CON
   TON, kem DANH MUC THE KHO va LOAI HANG de loc. Viet rieng de khong dong vao endpoint chung.

   ⚠️ HAI KHAI NIEM DE NHAM, ten gan giong nhau:
     - "Danh muc the kho" = TheKhoDanhMuc.TenTheKho
     - "Loai hang"        = DanhMucNhomSanPham.TenNhom (them tu v5.4, qua TheKhoHangHoa.NhomSanPhamID)
     - TheKhoHangHoa.LoaiHang la "NGUON HANG" (Nha san xuat / Dat ngoai) — KHONG phai "Loai hang"
       ma nguoi dung noi. Lay nham cot nay la bo loc ra toan "Nha san xuat"/"Dat ngoai".
   ================================================================================================ */
router.get('/chon-ma-hang', requireAuth, requirePermission('KHOHANG', 'view'), requireChucNang('KHOHANG', CN), async (req, res) => {
  try {
    const pool = await getPool();
    const coNhom = (await pool.request().query(
      "SELECT COL_LENGTH('TheKhoHangHoa','NhomSanPhamID') AS c")).recordset[0].c != null;
    const rows = (await pool.request().query(`
      SELECT v.MaHangID, v.MaHang, v.TenHang, v.GiaBan, v.LoaiRi, v.DonViCoBan,
             ISNULL(v.TenTheKho, N'(chưa gán danh mục)') AS TenTheKho,
             ${coNhom ? "ISNULL(n.TenNhom, N'(chưa gán loại hàng)')" : "N'(chưa gán loại hàng)'"} AS TenNhom,
             v.TongTon
      FROM vw_TonKhoHangHoa v
      JOIN TheKhoHangHoa h ON h.MaHangID = v.MaHangID
      ${coNhom ? 'LEFT JOIN DanhMucNhomSanPham n ON n.NhomSanPhamID = h.NhomSanPhamID' : ''}
      WHERE ISNULL(v.TongTon, 0) > 0
      ORDER BY v.MaHang`)).recordset;
    res.json({ success: true, data: rows });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: 'Lỗi khi đọc danh sách mã hàng: ' + err.message }); }
});

/* Kiem TRUNG ma giua cac chuong trinh chong thoi gian. CANH BAO, khong chan — co the co ly do
   nghiep vu. Frontend goi truoc khi luu de hien cho nguoi dung xem. */
router.post('/kiem-trung', requireAuth, requirePermission('KHOHANG', 'view'), requireChucNang('KHOHANG', CN), async (req, res) => {
  try {
    const pool = await getPool();
    const d = req.body || {};
    const trung = await kiemTrungChuongTrinh(pool, sql, {
      tuNgay: d.tuNgay, denNgay: d.denNgay,
      maHangIds: (d.chiTiet || []).map(x => x.maHangId),
      boQuaID: d.id || 0
    });
    res.json({ success: true, data: trung });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: 'Lỗi khi kiểm trùng: ' + err.message }); }
});

/* Tao moi / sua. Luu CA DANH SACH ma hang mot lan.
   ⚠️ Chi tiet xoa sach roi chen lai la AN TOAN o bang nay: KHONG bang nao tro vao
   ChuongTrinhKhuyenMaiChiTiet.ID (phieu ban hang tro vao ChuongTrinhKhuyenMai.ID, tuc bang CHA).
   Khac han DonHangDonGiaCongDoanMay — bang do bi PhanCongMay tro vao (xem v8.55). */
async function luuChuongTrinh(pool, d, userId) {
  const ten = String(d.tenChuongTrinh || '').trim();
  if (!ten) throw new Error('Thiếu tên chương trình.');
  if (!d.tuNgay || !d.denNgay) throw new Error('Thiếu thời gian bắt đầu / kết thúc.');
  if (new Date(d.denNgay) < new Date(d.tuNgay)) throw new Error('Ngày kết thúc phải sau ngày bắt đầu.');
  const ptChung = d.phanTramCK === '' || d.phanTramCK == null ? null : Number(d.phanTramCK);
  if (ptChung == null || !isFinite(ptChung) || ptChung < 0 || ptChung > 100)
    throw new Error('Tổng % CK của chương trình phải nằm trong khoảng 0–100.');

  const chiTiet = (Array.isArray(d.chiTiet) ? d.chiTiet : [])
    .map(x => ({ maHangId: parseInt(x.maHangId, 10), phanTramCK: x.phanTramCK === '' || x.phanTramCK == null ? null : Number(x.phanTramCK) }))
    .filter(x => Number.isInteger(x.maHangId));
  const daCo = new Set();
  for (const x of chiTiet) {
    if (daCo.has(x.maHangId)) throw new Error('Một mã hàng bị thêm hai lần trong cùng chương trình.');
    daCo.add(x.maHangId);
    if (x.phanTramCK != null && (!isFinite(x.phanTramCK) || x.phanTramCK < 0 || x.phanTramCK > 100))
      throw new Error('% CK riêng của mã hàng phải nằm trong khoảng 0–100.');
  }

  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    let id = parseInt(d.id, 10) || 0;
    const rq = () => new sql.Request(tx);
    if (id > 0) {
      await rq().input('id', sql.Int, id).input('Ten', sql.NVarChar(200), ten)
        .input('Tu', sql.Date, d.tuNgay).input('Den', sql.Date, d.denNgay)
        .input('PT', sql.Decimal(5, 2), ptChung)
        .input('TT', sql.NVarChar(20), d.trangThai === 'Tạm dừng' ? 'Tạm dừng' : 'Hoạt động')
        .input('GC', sql.NVarChar(500), d.ghiChu || null)
        .query(`UPDATE ChuongTrinhKhuyenMai SET TenChuongTrinh=@Ten, TuNgay=@Tu, DenNgay=@Den,
                  PhanTramCK=@PT, TrangThai=@TT, GhiChu=@GC, UpdatedAt=SYSDATETIME() WHERE ID=@id`);
      await rq().input('id', sql.Int, id).query('DELETE FROM ChuongTrinhKhuyenMaiChiTiet WHERE ChuongTrinhID=@id');
    } else {
      id = (await rq().input('Ten', sql.NVarChar(200), ten)
        .input('Tu', sql.Date, d.tuNgay).input('Den', sql.Date, d.denNgay)
        .input('PT', sql.Decimal(5, 2), ptChung)
        .input('TT', sql.NVarChar(20), d.trangThai === 'Tạm dừng' ? 'Tạm dừng' : 'Hoạt động')
        .input('GC', sql.NVarChar(500), d.ghiChu || null)
        .input('NT', sql.Int, userId || null)
        .query(`INSERT INTO ChuongTrinhKhuyenMai (TenChuongTrinh, TuNgay, DenNgay, PhanTramCK, TrangThai, GhiChu, NguoiTaoID)
                OUTPUT INSERTED.ID VALUES (@Ten,@Tu,@Den,@PT,@TT,@GC,@NT)`)).recordset[0].ID;
    }
    for (const x of chiTiet) {
      await rq().input('ct', sql.Int, id).input('mh', sql.Int, x.maHangId)
        .input('pt', sql.Decimal(5, 2), x.phanTramCK)
        .query('INSERT INTO ChuongTrinhKhuyenMaiChiTiet (ChuongTrinhID, MaHangID, PhanTramCK) VALUES (@ct,@mh,@pt)');
    }
    await tx.commit();
    return id;
  } catch (e) { await tx.rollback(); throw e; }
}

router.post('/', requireAuth, requirePermission('KHOHANG', 'create'), requireChucNang('KHOHANG', CN), async (req, res) => {
  try {
    const pool = await getPool();
    const id = await luuChuongTrinh(pool, req.body || {}, req.session.user.userId || req.session.user.UserID);
    res.json({ success: true, data: { id } });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: 'Lỗi khi lưu chương trình: ' + err.message }); }
});

router.put('/:id', requireAuth, requirePermission('KHOHANG', 'edit'), requireChucNang('KHOHANG', CN), async (req, res) => {
  try {
    const pool = await getPool();
    const id = await luuChuongTrinh(pool, { ...(req.body || {}), id: req.params.id }, req.session.user.userId || req.session.user.UserID);
    res.json({ success: true, data: { id } });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: 'Lỗi khi lưu chương trình: ' + err.message }); }
});

/* Xoa: CHAN khi da co dong phieu ban hang gan vao chuong trinh nay, va bao bang TIENG NGUOI.
   Khoa ngoai de NO ACTION nen DB cung chan — nhung de DB nem ten khoa ngoai ra man hinh la
   nguoi dung khong hieu gi (bai hoc v8.55). */
router.delete('/:id', requireAuth, requirePermission('KHOHANG', 'delete'), requireChucNang('KHOHANG', CN), async (req, res) => {
  try {
    const pool = await getPool();
    const n = (await pool.request().input('id', sql.Int, req.params.id)
      .query('SELECT COUNT(*) AS n FROM PhieuBanHangChiTiet WHERE ChuongTrinhID=@id')).recordset[0].n;
    if (Number(n) > 0) {
      return res.status(400).json({ success: false,
        message: `Không xóa được: đã có ${n} dòng phiếu bán hàng bán theo chương trình này. `
          + 'Phiếu đã lập phải giữ nguyên lịch sử. Muốn dừng chương trình thì chuyển Trạng thái sang "Tạm dừng" '
          + 'hoặc sửa ngày kết thúc về quá khứ.' });
    }
    await pool.request().input('id', sql.Int, req.params.id)
      .query('DELETE FROM ChuongTrinhKhuyenMai WHERE ID=@id');   // chi tiet tu xoa theo (ON DELETE CASCADE)
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: 'Lỗi khi xóa: ' + err.message }); }
});

/* ================================================================================================
   v8.70.2 — MAP "%CK dang ap dung" cho mot NGAY, de MAN LAP PHIEU dien san truoc khi luu.

   ⚠️ Vi sao phai co route nay: form Lap phieu ban hang LUON gui len `phanTramCKShop` cho moi dong
   (mac dinh = CK dung chung 33). Backend chi lay %KM khi o do TRONG — nghia la neu frontend khong
   tu dien 35 thi chuong trinh khuyen mai SE KHONG BAO GIO duoc ap, va ChuongTrinhID luon NULL.
   Nguoi dung cung se khong nhin thay gia khuyen mai trong luc lap phieu, chi phat hien sau khi in.
   Vay nen: frontend hoi route nay theo NGAY BAN, dien san 35 vao o %CK; backend thay gia tri khop
   voi %KM thi ghi ChuongTrinhID. Nguoi dung go de so khac = co y de, khong gan chuong trinh.
   ================================================================================================ */
router.get('/ap-dung', requireAuth, requirePermission('KHOHANG', 'view'), async (req, res) => {
  try {
    const pool = await getPool();
    res.json({ success: true, data: await layKhuyenMaiTheoNgay(pool, sql, req.query.ngay, null) });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: 'Lỗi khi đọc khuyến mãi: ' + err.message }); }
});

/* ⚠️ PHAI nam DUOI tat ca route GET chu co dinh ('/chon-ma-hang', '/ap-dung'). Xem ghi chu dau file. */
router.get('/:id', requireAuth, requirePermission('KHOHANG', 'view'), requireChucNang('KHOHANG', CN), async (req, res) => {
  try {
    const pool = await getPool();
    const km = (await pool.request().input('id', sql.Int, req.params.id)
      .query('SELECT * FROM ChuongTrinhKhuyenMai WHERE ID=@id')).recordset[0];
    if (!km) return res.status(404).json({ success: false, message: 'Không tìm thấy chương trình.' });
    res.json({ success: true, data: { ...km, chiTiet: await layChiTiet(pool, km.ID) } });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: 'Lỗi: ' + err.message }); }
});

module.exports = router;
