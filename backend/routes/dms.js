/* ================================================================================================
   PHAN HE DMS — DI TUYEN THI TRUONG                                              (v7.23, migration_v686)

   5 nhom endpoint, trung 5 tab cua frontend/js/module.dms.js (ma chuc nang phai KHOP):
     shop     : danh muc SHOP BAN LE (thuoc NPP lay tu danh muc Khach hang)
     tuyen    : tuyen ban hang + shop trong tuyen + LICH DI TUYEN theo ngay
     ghetham  : CHECK-IN tai shop (GPS + anh) hoac ghi nhan goi dien / Zalo
     lotrinh  : lo trinh nhan vien theo ngay / thang (cho ban do + timeline)
     doanhso  : doanh so nhan vien theo thang / quy / nam (nguon: PHIEU BAN HANG chua huy)

   NGUYEN TAC:
   - Toa do luu DECIMAL(10,7). Khoang cach tinh bang HAVERSINE ngay o backend roi LUU LAI
     (`GheTham.KhoangCachM`) — de sau nay doi chieu duoc chinh con so luc check-in, khong tinh lai
     theo toa do shop da bi sua ve sau.
   - Ban kinh cho phep + co bat buoc anh doc tu `CauHinhHeThong` (DMS_BAN_KINH_CHECKIN_M,
     DMS_BAT_BUOC_ANH) — doi chinh sach thi doi cau hinh, khong phai sua code.
   - Ngoai ban kinh KHONG chan: van luu, dat `NgoaiVung = 1`. Chan cung se khien nhan vien khong ghi
     nhan duoc gi khi GPS lech (trong nha, trong cho) — mat du lieu con te hon la mot dong canh bao.
   ================================================================================================ */
const express = require('express');
const { sql, getPool } = require('../db');
const { requireAuth, requirePermission, requireChucNang } = require('../middleware/auth');

const router = express.Router();
const M = 'DMS';
const CN = c => [requireAuth, requirePermission(M, 'view'), requireChucNang(M, c)];
const CN_GHI = (c, act) => [requireAuth, requirePermission(M, act || 'edit'), requireChucNang(M, c)];

const so = v => Number(v) || 0;

/* ---------- Cau hinh ---------- */
async function layCauHinh(pool) {
  const rs = (await pool.request().query(`
    SELECT ConfigKey, ConfigValue FROM CauHinhHeThong
    WHERE ConfigKey IN ('DMS_BAN_KINH_CHECKIN_M', 'DMS_BAT_BUOC_ANH', 'DMS_TILE_URL')`)).recordset;
  const m = {};
  rs.forEach(r => { m[r.ConfigKey] = r.ConfigValue; });
  return {
    banKinhM: so(m.DMS_BAN_KINH_CHECKIN_M) || 200,
    batBuocAnh: String(m.DMS_BAT_BUOC_ANH == null ? '1' : m.DMS_BAT_BUOC_ANH) === '1',
    /* v7.24: tile ban do noi bo/proxy. Trong = frontend tu do lan luot OSM -> OSM DE -> Carto.
       Khai vao khi mang cong ty chan het may chu tile ngoai (trieu chung: co marker, khong co anh nen). */
    tileUrl: m.DMS_TILE_URL || null
  };
}

/* ---------- HAVERSINE: khoang cach 2 toa do, tra ve METRE ----------
   Dung cong thuc cau (khong phai Pythagoras tren do/phut) vi 1 do kinh tuyen o Viet Nam chi con
   ~104km trong khi 1 do vi tuyen la ~111km — tinh phang se lech vai tram met, dung ban kinh 200m
   la sai ket luan ngay. */
function khoangCachM(lat1, lon1, lat2, lon2) {
  const R = 6371000;                       // ban kinh Trai Dat (m)
  const rad = d => (Number(d) * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/* ---------- Sinh ma tang dan trong nam (SH260001 / TU260001) ----------
   Dung CHINH bang do (khong dung bang dem rieng) va chay TRONG transaction cua nguoi goi neu co,
   giong sinhSoPhieu cua cac phan he khac: hai nguoi luu cung luc thi nguoi sau lo UNIQUE va quay lui. */
async function sinhMa(rq, bang, cot, tienTo) {
  const nam = String(new Date().getFullYear()).slice(-2);
  const r = await rq.input('tt', sql.NVarChar, tienTo + nam + '%')
    .query(`SELECT MAX(${cot}) AS Max FROM ${bang} WHERE ${cot} LIKE @tt`);
  const cuoi = r.recordset[0].Max;
  const seq = cuoi ? (parseInt(String(cuoi).slice(tienTo.length + 2), 10) || 0) + 1 : 1;
  return tienTo + nam + String(seq).padStart(4, '0');
}

/* ================================================================================================
   1. SHOP BAN LE
   ================================================================================================ */
router.get('/shop', ...CN('shop'), async (req, res) => {
  const pool = await getPool();
  const rows = (await pool.request().query(`
    SELECT s.*, kh.TenKhachHang AS TenNPP, nv.HoTen AS TenNVPhuTrach,
           g.LanCuoi, g.SoLanGhe
    FROM ShopBanLe s
    LEFT JOIN KhachHang kh ON kh.KhachHangID = s.NhaPhanPhoiID
    LEFT JOIN NhanVien  nv ON nv.NhanVienID  = s.NhanVienPhuTrachID
    /* Lan ghe CUOI + tong so lan: tinh tu GheTham, KHONG luu san tren ShopBanLe — luu san la sinh
       hai nguon su that, sua/xoa mot lan ghe la lech ngay. */
    OUTER APPLY (SELECT MAX(gt.ThoiGianVao) AS LanCuoi, COUNT(*) AS SoLanGhe
                 FROM GheTham gt WHERE gt.ShopID = s.ShopID) g
    ORDER BY s.TenShop`)).recordset;
  res.json({ success: true, data: rows });
});

/* Danh muc phu tro cho form: NPP (khach hang) + nhan vien dang lam */
router.get('/danhmuc', ...CN('shop'), async (req, res) => {
  const pool = await getPool();
  const npp = (await pool.request().query(
    'SELECT KhachHangID, TenKhachHang, DiaChi, SDT FROM KhachHang ORDER BY TenKhachHang')).recordset;
  const nhanVien = (await pool.request().query(`
    SELECT NhanVienID, MaNhanVien, HoTen FROM NhanVien
    WHERE TrangThai <> N'Đã nghỉ' ORDER BY HoTen`)).recordset;
  const tuyen = (await pool.request().query(
    'SELECT TuyenID, MaTuyen, TenTuyen, NhanVienID FROM TuyenBanHang ORDER BY TenTuyen')).recordset;
  res.json({ success: true, data: { npp, nhanVien, tuyen, cauHinh: await layCauHinh(pool) } });
});

router.post('/shop', ...CN_GHI('shop', 'create'), async (req, res) => {
  try {
    const pool = await getPool();
    const b = req.body || {};
    if (!String(b.tenShop || '').trim()) return res.status(400).json({ success: false, message: 'Chưa nhập tên shop.' });
    const maShop = String(b.maShop || '').trim() || await sinhMa(pool.request(), 'ShopBanLe', 'MaShop', 'SH');
    const r = await pool.request()
      .input('ma', sql.NVarChar, maShop)
      .input('ten', sql.NVarChar, String(b.tenShop).trim())
      .input('npp', sql.Int, b.nhaPhanPhoiId || null)
      .input('nlh', sql.NVarChar, b.nguoiLienHe || null)
      .input('sdt', sql.NVarChar, b.sdt || null)
      .input('dc', sql.NVarChar, b.diaChi || null)
      .input('tinh', sql.NVarChar, b.tinhThanh || null)
      .input('quan', sql.NVarChar, b.quanHuyen || null)
      .input('lat', sql.Decimal(10, 7), b.latitude != null && b.latitude !== '' ? b.latitude : null)
      .input('lon', sql.Decimal(10, 7), b.longitude != null && b.longitude !== '' ? b.longitude : null)
      .input('anh', sql.NVarChar, b.anhMatTien || null)
      .input('nvpt', sql.Int, b.nhanVienPhuTrachId || null)
      .input('tt', sql.NVarChar, b.trangThai || 'Tiềm năng')
      .input('gc', sql.NVarChar, b.ghiChu || null)
      .input('u', sql.Int, req.session.user.userId)
      .query(`INSERT INTO ShopBanLe (MaShop, TenShop, NhaPhanPhoiID, NguoiLienHe, SDT, DiaChi, TinhThanh,
                QuanHuyen, Latitude, Longitude, AnhMatTien, NhanVienPhuTrachID, TrangThai, GhiChu, NguoiTaoID)
              OUTPUT INSERTED.ShopID
              VALUES (@ma, @ten, @npp, @nlh, @sdt, @dc, @tinh, @quan, @lat, @lon, @anh, @nvpt, @tt, @gc, @u)`);
    res.json({ success: true, data: { shopId: r.recordset[0].ShopID, maShop } });
  } catch (err) {
    console.error('[dms POST /shop] ', err);
    res.status(400).json({ success: false, message: 'Lỗi khi lưu shop: ' + err.message });
  }
});

router.put('/shop/:id', ...CN_GHI('shop'), async (req, res) => {
  try {
    const pool = await getPool();
    const b = req.body || {};
    /* ISNULL(@x, cot): chi ghi de truong nao GUI LEN. Man hinh dien thoai (tab Ghe tham) chi gui toa
       do + anh, khong gui ten/dia chi — gan thang se XOA TRANG cac truong do. */
    await pool.request().input('id', sql.Int, req.params.id)
      .input('ten', sql.NVarChar, b.tenShop != null ? String(b.tenShop).trim() : null)
      .input('npp', sql.Int, b.nhaPhanPhoiId != null && b.nhaPhanPhoiId !== '' ? b.nhaPhanPhoiId : null)
      .input('nlh', sql.NVarChar, b.nguoiLienHe != null ? b.nguoiLienHe : null)
      .input('sdt', sql.NVarChar, b.sdt != null ? b.sdt : null)
      .input('dc', sql.NVarChar, b.diaChi != null ? b.diaChi : null)
      .input('tinh', sql.NVarChar, b.tinhThanh != null ? b.tinhThanh : null)
      .input('quan', sql.NVarChar, b.quanHuyen != null ? b.quanHuyen : null)
      .input('lat', sql.Decimal(10, 7), b.latitude != null && b.latitude !== '' ? b.latitude : null)
      .input('lon', sql.Decimal(10, 7), b.longitude != null && b.longitude !== '' ? b.longitude : null)
      .input('anh', sql.NVarChar, b.anhMatTien != null ? b.anhMatTien : null)
      .input('nvpt', sql.Int, b.nhanVienPhuTrachId != null && b.nhanVienPhuTrachId !== '' ? b.nhanVienPhuTrachId : null)
      .input('tt', sql.NVarChar, b.trangThai != null ? b.trangThai : null)
      .input('gc', sql.NVarChar, b.ghiChu != null ? b.ghiChu : null)
      .query(`UPDATE ShopBanLe SET
                TenShop            = ISNULL(@ten, TenShop),
                NhaPhanPhoiID      = ISNULL(@npp, NhaPhanPhoiID),
                NguoiLienHe        = ISNULL(@nlh, NguoiLienHe),
                SDT                = ISNULL(@sdt, SDT),
                DiaChi             = ISNULL(@dc, DiaChi),
                TinhThanh          = ISNULL(@tinh, TinhThanh),
                QuanHuyen          = ISNULL(@quan, QuanHuyen),
                Latitude           = ISNULL(@lat, Latitude),
                Longitude          = ISNULL(@lon, Longitude),
                AnhMatTien         = ISNULL(@anh, AnhMatTien),
                NhanVienPhuTrachID = ISNULL(@nvpt, NhanVienPhuTrachID),
                TrangThai          = ISNULL(@tt, TrangThai),
                GhiChu             = ISNULL(@gc, GhiChu),
                UpdatedAt          = SYSDATETIME()
              WHERE ShopID = @id`);
    res.json({ success: true });
  } catch (err) {
    console.error('[dms PUT /shop] ', err);
    res.status(400).json({ success: false, message: 'Lỗi khi sửa shop: ' + err.message });
  }
});

router.delete('/shop/:id', ...CN_GHI('shop', 'delete'), async (req, res) => {
  try {
    const pool = await getPool();
    /* Chan theo DU LIEU THAT, bao ro vuong o dau (bai hoc tu viec xoa lenh SX bao chung chung). */
    const vuong = [];
    const dem = async (bang, cot) => (await pool.request().input('id', sql.Int, req.params.id)
      .query(`SELECT COUNT(*) AS C FROM ${bang} WHERE ${cot} = @id`)).recordset[0].C;
    if (await dem('GheTham', 'ShopID')) vuong.push('lịch sử ghé thăm');
    if (await dem('TuyenChiTiet', 'ShopID')) vuong.push('tuyến bán hàng');
    if ((await pool.request().query(`SELECT COL_LENGTH('PhieuBanHang','ShopID') AS c`)).recordset[0].c != null
        && await dem('PhieuBanHang', 'ShopID')) vuong.push('phiếu bán hàng');
    if (vuong.length) {
      return res.status(400).json({ success: false,
        message: `Không xóa được shop này vì đã có ${vuong.join(', ')}. Muốn ẩn đi thì đổi Trạng thái sang "Ngừng".` });
    }
    await pool.request().input('id', sql.Int, req.params.id).query('DELETE FROM ShopBanLe WHERE ShopID=@id');
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, message: 'Lỗi khi xóa shop: ' + err.message });
  }
});

/* ================================================================================================
   2. TUYEN + LICH DI TUYEN
   ================================================================================================ */
router.get('/tuyen', ...CN('tuyen'), async (req, res) => {
  const pool = await getPool();
  const tuyen = (await pool.request().query(`
    SELECT t.*, nv.HoTen AS TenNhanVien,
           (SELECT COUNT(*) FROM TuyenChiTiet c WHERE c.TuyenID = t.TuyenID) AS SoShop
    FROM TuyenBanHang t LEFT JOIN NhanVien nv ON nv.NhanVienID = t.NhanVienID
    ORDER BY t.TenTuyen`)).recordset;
  const chiTiet = (await pool.request().query(`
    SELECT c.ID, c.TuyenID, c.ShopID, c.ThuTu, s.MaShop, s.TenShop, s.DiaChi, s.Latitude, s.Longitude
    FROM TuyenChiTiet c JOIN ShopBanLe s ON s.ShopID = c.ShopID
    ORDER BY c.TuyenID, c.ThuTu`)).recordset;
  res.json({ success: true, data: { tuyen, chiTiet } });
});

router.post('/tuyen', ...CN_GHI('tuyen', 'create'), async (req, res) => {
  const pool = await getPool();
  const b = req.body || {};
  if (!String(b.tenTuyen || '').trim()) return res.status(400).json({ success: false, message: 'Chưa nhập tên tuyến.' });
  const tran = new sql.Transaction(pool);
  await tran.begin();
  try {
    const ma = String(b.maTuyen || '').trim() || await sinhMa(new sql.Request(tran), 'TuyenBanHang', 'MaTuyen', 'TU');
    const id = (await new sql.Request(tran)
      .input('ma', sql.NVarChar, ma)
      .input('ten', sql.NVarChar, String(b.tenTuyen).trim())
      .input('nv', sql.Int, b.nhanVienId || null)
      .input('thu', sql.NVarChar, Array.isArray(b.thuTrongTuan) ? b.thuTrongTuan.join(',') : (b.thuTrongTuan || null))
      .input('mt', sql.NVarChar, b.moTa || null)
      .query(`INSERT INTO TuyenBanHang (MaTuyen, TenTuyen, NhanVienID, ThuTrongTuan, MoTa)
              OUTPUT INSERTED.TuyenID VALUES (@ma, @ten, @nv, @thu, @mt)`)).recordset[0].TuyenID;
    let i = 0;
    for (const shopId of (b.shopIds || [])) {
      await new sql.Request(tran).input('t', sql.Int, id).input('s', sql.Int, shopId).input('tt', sql.Int, ++i)
        .query('INSERT INTO TuyenChiTiet (TuyenID, ShopID, ThuTu) VALUES (@t, @s, @tt)');
    }
    await tran.commit();
    res.json({ success: true, data: { tuyenId: id, maTuyen: ma } });
  } catch (err) {
    try { await tran.rollback(); } catch (e) { /* da ket thuc */ }
    res.status(400).json({ success: false, message: 'Lỗi khi lưu tuyến: ' + err.message });
  }
});

router.put('/tuyen/:id', ...CN_GHI('tuyen'), async (req, res) => {
  const pool = await getPool();
  const b = req.body || {};
  const tran = new sql.Transaction(pool);
  await tran.begin();
  try {
    await new sql.Request(tran).input('id', sql.Int, req.params.id)
      .input('ten', sql.NVarChar, b.tenTuyen != null ? String(b.tenTuyen).trim() : null)
      .input('nv', sql.Int, b.nhanVienId != null && b.nhanVienId !== '' ? b.nhanVienId : null)
      .input('thu', sql.NVarChar, Array.isArray(b.thuTrongTuan) ? b.thuTrongTuan.join(',') : (b.thuTrongTuan != null ? b.thuTrongTuan : null))
      .input('mt', sql.NVarChar, b.moTa != null ? b.moTa : null)
      .input('tt', sql.NVarChar, b.trangThai != null ? b.trangThai : null)
      .query(`UPDATE TuyenBanHang SET TenTuyen = ISNULL(@ten, TenTuyen), NhanVienID = ISNULL(@nv, NhanVienID),
                ThuTrongTuan = ISNULL(@thu, ThuTrongTuan), MoTa = ISNULL(@mt, MoTa),
                TrangThai = ISNULL(@tt, TrangThai) WHERE TuyenID = @id`);
    if (Array.isArray(b.shopIds)) {   // gui mang = thay TOAN BO danh sach shop cua tuyen
      await new sql.Request(tran).input('id', sql.Int, req.params.id)
        .query('DELETE FROM TuyenChiTiet WHERE TuyenID = @id');
      let i = 0;
      for (const shopId of b.shopIds) {
        await new sql.Request(tran).input('t', sql.Int, req.params.id).input('s', sql.Int, shopId).input('tt', sql.Int, ++i)
          .query('INSERT INTO TuyenChiTiet (TuyenID, ShopID, ThuTu) VALUES (@t, @s, @tt)');
      }
    }
    await tran.commit();
    res.json({ success: true });
  } catch (err) {
    try { await tran.rollback(); } catch (e) { /* da ket thuc */ }
    res.status(400).json({ success: false, message: 'Lỗi khi sửa tuyến: ' + err.message });
  }
});

router.delete('/tuyen/:id', ...CN_GHI('tuyen', 'delete'), async (req, res) => {
  try {
    const pool = await getPool();
    const coLich = (await pool.request().input('id', sql.Int, req.params.id)
      .query('SELECT COUNT(*) AS C FROM LichDiTuyen WHERE TuyenID = @id')).recordset[0].C;
    if (coLich) return res.status(400).json({ success: false, message: `Tuyến này đã có ${coLich} ngày lịch đi — xóa lịch trước, hoặc đổi Trạng thái sang "Ngừng".` });
    await pool.request().input('id', sql.Int, req.params.id).query('DELETE FROM TuyenBanHang WHERE TuyenID=@id');
    res.json({ success: true });   // TuyenChiTiet tu mat theo (ON DELETE CASCADE)
  } catch (err) {
    res.status(400).json({ success: false, message: 'Lỗi khi xóa tuyến: ' + err.message });
  }
});

/* --- LICH DI TUYEN theo thang --- */
router.get('/lich', ...CN('tuyen'), async (req, res) => {
  const pool = await getPool();
  const nam = Number(req.query.nam) || new Date().getFullYear();
  const thang = Number(req.query.thang) || (new Date().getMonth() + 1);
  const rows = (await pool.request().input('n', sql.Int, nam).input('t', sql.Int, thang).query(`
    SELECT l.*, nv.HoTen AS TenNhanVien, tu.MaTuyen, tu.TenTuyen,
           (SELECT COUNT(*) FROM TuyenChiTiet c WHERE c.TuyenID = l.TuyenID) AS SoShopKeHoach,
           (SELECT COUNT(*) FROM GheTham g WHERE g.LichID = l.LichID)        AS SoShopDaGhe
    FROM LichDiTuyen l
    LEFT JOIN NhanVien nv ON nv.NhanVienID = l.NhanVienID
    LEFT JOIN TuyenBanHang tu ON tu.TuyenID = l.TuyenID
    WHERE YEAR(l.Ngay) = @n AND MONTH(l.Ngay) = @t
    ORDER BY l.Ngay, nv.HoTen`)).recordset;
  res.json({ success: true, data: rows, ky: { nam, thang } });
});

router.post('/lich', ...CN_GHI('tuyen', 'create'), async (req, res) => {
  try {
    const pool = await getPool();
    const b = req.body || {};
    if (!b.nhanVienId || !b.ngay) return res.status(400).json({ success: false, message: 'Thiếu nhân viên hoặc ngày.' });
    await pool.request()
      .input('nv', sql.Int, b.nhanVienId).input('ngay', sql.Date, b.ngay)
      .input('tuyen', sql.Int, b.tuyenId || null).input('gc', sql.NVarChar, b.ghiChu || null)
      .input('u', sql.Int, req.session.user.userId)
      .query(`INSERT INTO LichDiTuyen (NhanVienID, Ngay, TuyenID, GhiChu, NguoiTaoID)
              VALUES (@nv, @ngay, @tuyen, @gc, @u)`);
    res.json({ success: true });
  } catch (err) {
    const trung = /UQ_LichDiTuyen|duplicate/i.test(err.message);
    res.status(400).json({ success: false,
      message: trung ? 'Nhân viên này đã có lịch đúng tuyến đó trong ngày đã chọn.' : 'Lỗi khi lưu lịch: ' + err.message });
  }
});

router.delete('/lich/:id', ...CN_GHI('tuyen', 'delete'), async (req, res) => {
  try {
    const pool = await getPool();
    const coGhe = (await pool.request().input('id', sql.Int, req.params.id)
      .query('SELECT COUNT(*) AS C FROM GheTham WHERE LichID = @id')).recordset[0].C;
    if (coGhe) return res.status(400).json({ success: false, message: `Ngày này đã có ${coGhe} lần ghé thăm gắn vào — không xóa lịch được (sẽ mất dấu vết).` });
    await pool.request().input('id', sql.Int, req.params.id).query('DELETE FROM LichDiTuyen WHERE LichID=@id');
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, message: 'Lỗi khi xóa lịch: ' + err.message });
  }
});

/* ================================================================================================
   3. GHE THAM / CHECK-IN
   ================================================================================================ */
/* Nhan vien cua CHINH user dang dang nhap (Users.NhanVienID) — man hinh dien thoai khong bat chon tay. */
async function nhanVienCuaUser(pool, user) {
  if (user && user.nhanVienId) return user.nhanVienId;
  const r = (await pool.request().input('u', sql.Int, user.userId)
    .query('SELECT NhanVienID FROM Users WHERE UserID = @u')).recordset[0];
  return r ? r.NhanVienID : null;
}

/* Man hinh check-in: shop cua tuyen hom nay (uu tien) + toan bo shop de con ghe shop moi */
router.get('/homnay', ...CN('ghetham'), async (req, res) => {
  const pool = await getPool();
  const nvId = await nhanVienCuaUser(pool, req.session.user);
  const ngay = req.query.ngay || new Date().toISOString().slice(0, 10);
  const lich = nvId ? (await pool.request().input('nv', sql.Int, nvId).input('ngay', sql.Date, ngay).query(`
    SELECT l.LichID, l.TuyenID, tu.MaTuyen, tu.TenTuyen
    FROM LichDiTuyen l LEFT JOIN TuyenBanHang tu ON tu.TuyenID = l.TuyenID
    WHERE l.NhanVienID = @nv AND l.Ngay = @ngay`)).recordset : [];
  const tuyenIds = lich.map(l => l.TuyenID).filter(Boolean);
  const shopKeHoach = tuyenIds.length ? (await pool.request().query(`
    SELECT c.TuyenID, c.ThuTu, s.*
    FROM TuyenChiTiet c JOIN ShopBanLe s ON s.ShopID = c.ShopID
    WHERE c.TuyenID IN (${tuyenIds.join(',')}) ORDER BY c.ThuTu`)).recordset : [];
  const daGhe = nvId ? (await pool.request().input('nv', sql.Int, nvId).input('ngay', sql.Date, ngay).query(`
    SELECT g.GheThamID, g.ShopID, g.LoaiTiepXuc, g.ThoiGianVao, g.KetQua, g.NgoaiVung, g.KhoangCachM
    FROM GheTham g
    WHERE g.NhanVienID = @nv AND CAST(g.ThoiGianVao AS DATE) = @ngay
    ORDER BY g.ThoiGianVao`)).recordset : [];
  res.json({ success: true, data: { nhanVienId: nvId, ngay, lich, shopKeHoach, daGhe, cauHinh: await layCauHinh(pool) } });
});

router.post('/ghetham', ...CN_GHI('ghetham', 'create'), async (req, res) => {
  try {
    const pool = await getPool();
    const b = req.body || {};
    const cf = await layCauHinh(pool);
    const nvId = b.nhanVienId || await nhanVienCuaUser(pool, req.session.user);
    if (!nvId) {
      return res.status(400).json({ success: false, message: 'Tài khoản của bạn chưa được gắn NHÂN VIÊN — vào Quản lý User → Sửa tài khoản → chọn Nhân viên, rồi đăng nhập lại.' });
    }
    if (!b.shopId) return res.status(400).json({ success: false, message: 'Chưa chọn shop.' });
    const loai = ['GheTham', 'GoiDien', 'Zalo'].indexOf(String(b.loaiTiepXuc)) !== -1 ? String(b.loaiTiepXuc) : 'GheTham';
    if (loai === 'GheTham' && cf.batBuocAnh && !b.anh) {
      return res.status(400).json({ success: false, message: 'Ghé thăm tại shop phải có ẢNH (cấu hình DMS_BAT_BUOC_ANH = 1).' });
    }
    const shop = (await pool.request().input('id', sql.Int, b.shopId)
      .query('SELECT ShopID, TenShop, Latitude, Longitude FROM ShopBanLe WHERE ShopID = @id')).recordset[0];
    if (!shop) return res.status(404).json({ success: false, message: 'Không tìm thấy shop.' });

    /* Khoang cach + co ngoai vung: CHI tinh cho lan GHE THAM co du 2 dau toa do. Goi dien/Zalo hoac
       shop chua co toa do thi de NULL — khong duoc doan la 0m (0 nghia la "dung ngay tai shop"). */
    let kc = null, ngoaiVung = 0;
    const coToaDo = b.latitude != null && b.longitude != null && b.latitude !== '' && b.longitude !== ''
      && shop.Latitude != null && shop.Longitude != null;
    if (loai === 'GheTham' && coToaDo) {
      kc = khoangCachM(b.latitude, b.longitude, shop.Latitude, shop.Longitude);
      ngoaiVung = kc > cf.banKinhM ? 1 : 0;
    }
    const r = await pool.request()
      .input('shop', sql.Int, b.shopId).input('nv', sql.Int, nvId)
      .input('lich', sql.Int, b.lichId || null)
      .input('loai', sql.NVarChar, loai)
      .input('lat', sql.Decimal(10, 7), b.latitude !== '' && b.latitude != null ? b.latitude : null)
      .input('lon', sql.Decimal(10, 7), b.longitude !== '' && b.longitude != null ? b.longitude : null)
      .input('kc', sql.Int, kc).input('nvung', sql.Bit, ngoaiVung)
      .input('kq', sql.NVarChar, b.ketQua || null)
      .input('anh', sql.NVarChar, b.anh || null)
      .input('gc', sql.NVarChar, b.ghiChu || null)
      .input('don', sql.Int, b.donId || null).input('pbh', sql.Int, b.phieuBHID || null)
      .input('u', sql.Int, req.session.user.userId)
      .query(`INSERT INTO GheTham (ShopID, NhanVienID, LichID, LoaiTiepXuc, Latitude, Longitude,
                KhoangCachM, NgoaiVung, KetQua, Anh, GhiChu, DonID, PhieuBHID, NguoiTaoID)
              OUTPUT INSERTED.GheThamID
              VALUES (@shop, @nv, @lich, @loai, @lat, @lon, @kc, @nvung, @kq, @anh, @gc, @don, @pbh, @u)`);

    /* Shop chua co toa do ma lan nay check-in tai cho -> LAY LUON lam toa do shop. Nho vay khong phai
       khai toa do bang tay o van phong: ai den truoc thi shop co dinh vi. */
    if (loai === 'GheTham' && shop.Latitude == null && b.latitude) {
      await pool.request().input('id', sql.Int, b.shopId)
        .input('lat', sql.Decimal(10, 7), b.latitude).input('lon', sql.Decimal(10, 7), b.longitude)
        .query('UPDATE ShopBanLe SET Latitude=@lat, Longitude=@lon, UpdatedAt=SYSDATETIME() WHERE ShopID=@id');
    }
    /* Shop moi tim thay, lan dau co nguoi ghe -> chuyen tu 'Tiềm năng' sang 'Đang bán' neu co don. */
    if (b.ketQua === 'Có đơn') {
      await pool.request().input('id', sql.Int, b.shopId)
        .query(`UPDATE ShopBanLe SET TrangThai = N'Đang bán', UpdatedAt = SYSDATETIME()
                WHERE ShopID = @id AND TrangThai = N'Tiềm năng'`);
    }
    res.json({ success: true, data: { gheThamID: r.recordset[0].GheThamID, khoangCachM: kc, ngoaiVung: !!ngoaiVung, banKinhM: cf.banKinhM } });
  } catch (err) {
    console.error('[dms POST /ghetham] ', err);
    res.status(400).json({ success: false, message: 'Lỗi khi lưu ghé thăm: ' + err.message });
  }
});

router.put('/ghetham/:id', ...CN_GHI('ghetham'), async (req, res) => {
  try {
    const pool = await getPool();
    const b = req.body || {};
    await pool.request().input('id', sql.Int, req.params.id)
      .input('kq', sql.NVarChar, b.ketQua != null ? b.ketQua : null)
      .input('gc', sql.NVarChar, b.ghiChu != null ? b.ghiChu : null)
      .input('anh', sql.NVarChar, b.anh != null ? b.anh : null)
      .input('ra', sql.DateTime2, b.thoiGianRa || null)
      .query(`UPDATE GheTham SET KetQua = ISNULL(@kq, KetQua), GhiChu = ISNULL(@gc, GhiChu),
                Anh = ISNULL(@anh, Anh), ThoiGianRa = ISNULL(@ra, ThoiGianRa) WHERE GheThamID = @id`);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, message: 'Lỗi khi sửa ghé thăm: ' + err.message });
  }
});

router.delete('/ghetham/:id', ...CN_GHI('ghetham', 'delete'), async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request().input('id', sql.Int, req.params.id).query('DELETE FROM GheTham WHERE GheThamID=@id');
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, message: 'Lỗi khi xóa ghé thăm: ' + err.message });
  }
});


/* ================================================================================================
   3b. LEN DON NGAY TAI SHOP  (v7.24, migration_v687)
   Nhan vien di tuyen ghe shop, khach dat hang -> lap don LUON tren dien thoai.
   - Don ghi vao `DonKhachDatHang` (mot dong / mot ma hang + mau), `TenKhach` = TEN SHOP vi cong no
     va phieu in dang gom theo TEN (xem ghi chu trong routes/danhmuc.js) — doi sang khoa so la pha
     ca phan he cong no dang chay.
   - Gan `ShopID` + `NhanVienID` de sau nay phieu ban hang KE THUA -> doanh so nhan vien tu co.
   - `DaTruTon = 0`: don CHI GIU HANG, ton chi giam khi xuat PHIEU BAN HANG (nguyen tac v6.23).
   - Kiem TON KHA DUNG truoc khi nhan: khong de nhan vien ngoai thi truong hua ban hang khong con.
   ================================================================================================ */
/* ⚠️ v7.25 — DA XOA `GET /hangban` va `POST /donhang` cua ban v7.24.
   Chung la BAN THU HAI cua viec "len don": tu doc ton, tu kiem kha dung, tu chan trung mau — song
   song voi `POST /api/khohang/orders` da lam dung viec do tu v6.23. Hai ban kiem ton la som muon
   lech nhau (dung loai loi da gap voi ghiXuatKho / cong no NCC).
   NAY: nhan vien di tuyen dung CHINH route cua The kho, chi truyen them `shopId`, `nhanVienId`,
   `gheThamID` — xem khoi v7.25 trong backend/routes/khohang.js (POST /orders) va
   frontend: window.ModuleKhoHang.moFormDatHang({ shop, nhanVienId, gheThamID }). */

/* Don CUA NHAN VIEN (man hinh "don toi da lay") */
router.get('/donhang', ...CN('ghetham'), async (req, res) => {
  const pool = await getPool();
  const nvId = req.query.nhanVienId ? Number(req.query.nhanVienId) : await nhanVienCuaUser(pool, req.session.user);
  const tuNgay = req.query.tuNgay || new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10);
  const denNgay = req.query.denNgay || new Date().toISOString().slice(0, 10);
  if (!nvId) return res.json({ success: true, data: [] });
  const rows = (await pool.request().input('nv', sql.Int, nvId)
    .input('tu', sql.Date, tuNgay).input('den', sql.Date, denNgay).query(`
    SELECT o.DonID, o.ThoiGian, o.TenKhach, o.SoLuongDat, o.DonVi, o.TrangThai, o.PhieuBHID,
           h.MaHang, h.TenHang, ms.TenMau, s.MaShop, s.TenShop, p.SoPhieu, p.TongThanhToan
    FROM DonKhachDatHang o
    JOIN TheKhoHangHoa h ON h.MaHangID = o.MaHangID
    LEFT JOIN MauSac ms ON ms.MauSacID = o.MauSacID
    LEFT JOIN ShopBanLe s ON s.ShopID = o.ShopID
    LEFT JOIN PhieuBanHang p ON p.PhieuBHID = o.PhieuBHID
    WHERE o.NhanVienID = @nv AND CAST(o.ThoiGian AS DATE) BETWEEN @tu AND @den
    ORDER BY o.ThoiGian DESC`)).recordset;
  res.json({ success: true, data: rows, ky: { tuNgay, denNgay, nhanVienId: nvId } });
});

/* Lich su cham soc CUA MOT SHOP — de "luu thong tin shop de cham soc ve sau" */
router.get('/shop/:id/lichsu', ...CN('shop'), async (req, res) => {
  const pool = await getPool();
  const rows = (await pool.request().input('id', sql.Int, req.params.id).query(`
    SELECT g.*, nv.HoTen AS TenNhanVien, p.SoPhieu, p.TongThanhToan
    FROM GheTham g
    LEFT JOIN NhanVien nv ON nv.NhanVienID = g.NhanVienID
    LEFT JOIN PhieuBanHang p ON p.PhieuBHID = g.PhieuBHID
    WHERE g.ShopID = @id ORDER BY g.ThoiGianVao DESC`)).recordset;
  res.json({ success: true, data: rows });
});

/* ================================================================================================
   4. LO TRINH theo ngay / thang
   ================================================================================================ */
router.get('/lotrinh', ...CN('lotrinh'), async (req, res) => {
  const pool = await getPool();
  const tuNgay = req.query.tuNgay || new Date().toISOString().slice(0, 10);
  const denNgay = req.query.denNgay || tuNgay;
  const nvId = req.query.nhanVienId ? Number(req.query.nhanVienId) : null;
  const rq = pool.request().input('tu', sql.Date, tuNgay).input('den', sql.Date, denNgay);
  if (nvId) rq.input('nv', sql.Int, nvId);
  const diem = (await rq.query(`
    SELECT g.GheThamID, g.NhanVienID, nv.HoTen AS TenNhanVien, g.ShopID, s.MaShop, s.TenShop, s.DiaChi,
           g.LoaiTiepXuc, g.ThoiGianVao, g.ThoiGianRa, g.Latitude, g.Longitude, g.KhoangCachM,
           g.NgoaiVung, g.KetQua, g.Anh, g.GhiChu, g.LichID,
           s.Latitude AS ShopLat, s.Longitude AS ShopLon,
           p.SoPhieu, p.TongThanhToan
    FROM GheTham g
    JOIN ShopBanLe s ON s.ShopID = g.ShopID
    LEFT JOIN NhanVien nv ON nv.NhanVienID = g.NhanVienID
    LEFT JOIN PhieuBanHang p ON p.PhieuBHID = g.PhieuBHID
    WHERE CAST(g.ThoiGianVao AS DATE) BETWEEN @tu AND @den ${nvId ? 'AND g.NhanVienID = @nv' : ''}
    ORDER BY g.NhanVienID, g.ThoiGianVao`)).recordset;

  /* Tong hop theo (nhan vien, ngay): so diem ghe, so ngoai vung, KM DI CHUYEN (cong khoang cach giua
     cac diem lien tiep — chi la duong CHIM BAY nen luon NHO HON so km xe chay thuc te; ghi ro o giao
     dien de khong ai dung con so nay tinh cong tac phi). */
  const theoNgay = new Map();
  let truoc = null;
  diem.forEach(d => {
    const ngay = new Date(d.ThoiGianVao).toISOString().slice(0, 10);
    const k = d.NhanVienID + '|' + ngay;
    if (!theoNgay.has(k)) {
      theoNgay.set(k, { NhanVienID: d.NhanVienID, TenNhanVien: d.TenNhanVien, Ngay: ngay,
        SoDiem: 0, SoNgoaiVung: 0, SoCoDon: 0, MetDiChuyen: 0, GioDau: null, GioCuoi: null });
      truoc = null;   // sang nhan vien/ngay khac thi khong cong quang duong bat cau
    }
    const g = theoNgay.get(k);
    g.SoDiem++;
    if (d.NgoaiVung) g.SoNgoaiVung++;
    if (d.KetQua === 'Có đơn') g.SoCoDon++;
    if (!g.GioDau) g.GioDau = d.ThoiGianVao;
    g.GioCuoi = d.ThoiGianVao;
    if (truoc && truoc.Latitude != null && d.Latitude != null) {
      g.MetDiChuyen += khoangCachM(truoc.Latitude, truoc.Longitude, d.Latitude, d.Longitude);
    }
    truoc = d;
  });
  res.json({ success: true, data: { diem, theoNgay: [...theoNgay.values()] }, ky: { tuNgay, denNgay } });
});

/* ================================================================================================
   5. DOANH SO NHAN VIEN  (nguon: PHIEU BAN HANG chua huy — xem vw_DoanhSoNVKD)
   ================================================================================================ */
router.get('/doanhso', ...CN('doanhso'), async (req, res) => {
  const pool = await getPool();
  const nam = Number(req.query.nam) || new Date().getFullYear();
  const moc = ['thang', 'quy', 'nam'].indexOf(String(req.query.moc)) !== -1 ? String(req.query.moc) : 'thang';
  const nvId = req.query.nhanVienId ? Number(req.query.nhanVienId) : null;

  const cotMoc = moc === 'thang' ? 'Thang' : (moc === 'quy' ? 'Quy' : 'Nam');
  const rq = pool.request().input('n', sql.Int, nam);
  if (nvId) rq.input('nv', sql.Int, nvId);
  const rows = (await rq.query(`
    SELECT ${cotMoc} AS Moc, NhanVienID, TenNhanVien, MaNhanVien,
           COUNT(*) AS SoPhieu, SUM(TongSLCai) AS TongSLCai,
           SUM(TongTienHang) AS TongTienHang, SUM(TongThanhToan) AS DoanhSo
    FROM vw_DoanhSoNVKD
    WHERE Nam = @n ${nvId ? 'AND NhanVienID = @nv' : ''}
    GROUP BY ${cotMoc}, NhanVienID, TenNhanVien, MaNhanVien
    ORDER BY ${cotMoc}, DoanhSo DESC`)).recordset;

  /* Chi tiet theo SHOP / NPP de biet doanh so den tu dau (bam vao nhan vien la xem duoc). */
  const rq2 = pool.request().input('n', sql.Int, nam);
  if (nvId) rq2.input('nv', sql.Int, nvId);
  const theoShop = (await rq2.query(`
    SELECT NhanVienID, TenNhanVien, ShopID, MaShop, TenShop, TenKhachHang,
           COUNT(*) AS SoPhieu, SUM(TongThanhToan) AS DoanhSo
    FROM vw_DoanhSoNVKD
    WHERE Nam = @n ${nvId ? 'AND NhanVienID = @nv' : ''}
    GROUP BY NhanVienID, TenNhanVien, ShopID, MaShop, TenShop, TenKhachHang
    ORDER BY DoanhSo DESC`)).recordset;

  /* Hoat dong di tuyen cung ky — de doi chieu "di nhieu" voi "ban duoc nhieu". */
  const rq3 = pool.request().input('n', sql.Int, nam);
  if (nvId) rq3.input('nv', sql.Int, nvId);
  const hoatDong = (await rq3.query(`
    SELECT ${moc === 'thang' ? 'MONTH(g.ThoiGianVao)' : (moc === 'quy' ? 'DATEPART(QUARTER, g.ThoiGianVao)' : 'YEAR(g.ThoiGianVao)')} AS Moc,
           g.NhanVienID, COUNT(*) AS SoLanGhe,
           COUNT(DISTINCT g.ShopID) AS SoShop,
           SUM(CASE WHEN g.NgoaiVung = 1 THEN 1 ELSE 0 END) AS SoNgoaiVung
    FROM GheTham g
    WHERE YEAR(g.ThoiGianVao) = @n ${nvId ? 'AND g.NhanVienID = @nv' : ''}
    GROUP BY ${moc === 'thang' ? 'MONTH(g.ThoiGianVao)' : (moc === 'quy' ? 'DATEPART(QUARTER, g.ThoiGianVao)' : 'YEAR(g.ThoiGianVao)')}, g.NhanVienID`)).recordset;

  res.json({ success: true, data: { rows, theoShop, hoatDong }, ky: { nam, moc } });
});

module.exports = router;
