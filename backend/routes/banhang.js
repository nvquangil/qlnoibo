/* ================================================================================================
   PHIEU BAN HANG  (v6.23)
   = "PHIEU XUAT KHO KIEM BIEN BAN BAN GIAO" theo mau Word cua cong ty.

   VAI TRO TRONG LUONG TON KHO (doi tu v6.23 - xem migration_v668.sql):
     - Don khach dat ('Cho xac nhan' / 'Cho xu ly') = GIU HANG, KHONG tru ton.
     - PHIEU BAN HANG la chung tu DUY NHAT tru ton (TheKhoChiTietMau.XuatCai += SoLuongCai),
       dong thoi day don lien ket sang 'Da xuat hang'.
     - Huy/xoa phieu -> HOAN TON + don ve 'Cho xu ly'.
   => Chi co 1 duong tru ton duy nhat. Dung them duong thu 2 o bat ky cho nao khac.

   CONG THUC (dung DUNG thu tu cua mau Word, khong doi cho):
     Dong:   GiaBan   = GiaBanLe - GiaBanLe * %CKShop/100
             ThanhTien= GiaBan   * SoLuongCai            (gia la gia 1 CAI - xem v6.21.1)
     Phieu:  TongTienHang  = SUM(ThanhTien)
             TienCKNPP     = TongTienHang * %CKNPP/100
             TienTruocVAT  = TongTienHang - TienCKNPP
             TienVAT       = TienTruocVAT * %VAT/100
             TongThanhToan = TienTruocVAT + TienVAT      <- so vao cong no khach hang
   ================================================================================================ */
const express = require('express');
const ExcelJS = require('exceljs');   // v6.46: xuất Excel danh sách phiếu bán hàng
const { sql, getPool } = require('../db');
const { requireAuth, requirePermission, requireChucNang } = require('../middleware/auth');
/* v7.41: MOT ban cong thuc "cong no truoc chung tu" — dung chung voi routes/nhaplai.js. */
const { congNoTruocChungTu } = require('../utils/congNoTruocChungTu');
/* v7.43: xuat hoa don GTGT nap vao VietInvoice (boc thue 8% khoi gia da gom thue). */
const { taoWorkbookHoaDon } = require('../utils/hoaDonVietInvoice');
/* v7.46: mot ban do cot TheKhoHangHoa.TenHoaDon (migration_v690). */
const { coCotTenHoaDon } = require('../utils/maHangCapNhat');
/* v7.59: MOT ban cong thuc "da tra / con o khach" — dung chung voi routes/nhaplai.js va 4 man hinh
   hang mau. Xem ghi chu dai trong chinh file do. */
const { hangMauDangOKhach, gomTheoKhachMa, coCotHangMau } = require('../utils/dongDaBanChoKhach');

const router = express.Router();

// Luoi an toan cho handler async (giong khohang.js/qlsx.js - Express 4 khong tu bat loi trong async)
['get', 'post', 'put', 'delete'].forEach(method => {
  const goc = router[method].bind(router);
  router[method] = (path, ...handlers) => goc(path, ...handlers.map(h => (
    h.length >= 4 ? h : (req, res, next) => Promise.resolve(h(req, res, next)).catch(next)
  )));
});

const CN = 'banhang';   // ChucNang KHOHANG/banhang

/* ---------- helper chung ---------- */
function so(v) { const n = Number(v); return isFinite(n) ? n : 0; }
function lam2(v) { return Math.round(so(v) * 100) / 100; }
/* v6.25.1: TIEN luon lam tron ve DONG - tien VND khong co xu, de lai .17 chi lam phieu roi mat
   (yeu cau "bo so sau dau phay"). Ap cho gia ban, thanh tien va moi dong tong. */
function tien(v) { return Math.round(so(v)); }
/* ⚠️ HAI ĐƠN VỊ KHÁC NHAU - ĐỪNG DÙNG LẪN (bug cũ v5.46.1 từng trừ tồn gấp LoaiRi lần):
   1. slSangCai()        -> dùng cho TIỀN và BẢN IN. Giá luôn là giá 1 CÁI.
   2. slSangDonViChinh() -> dùng cho TỒN KHO. TheKhoChiTietMau.NhapCai/XuatCai lưu theo
      ĐƠN VỊ CHÍNH của mã hàng (DonViCoBan, có thể là Ri), KHÔNG phải Cái.
   slSangDonViChinh là bản sao của orderQtyToBase() trong routes/khohang.js - sửa phải sửa cả 2. */
/* ================================================================================================
   v6.31: BO CHUOI 'Ri' KHOI PHEP TINH.
   Cau hoi dung KHONG phai "don vi nay ten la Ri a?" ma la "don vi nay co phai DON VI QUY DOI cua
   CHINH ma hang do khong?". Nho vay khai don vi gop ten gi (Tá, Thùng, Lố...) cung chay dung, va
   du lieu cu (DonViQuyDoi = 'Ri') cho ket qua Y HET nhu truoc.
   `mh` = { DonViCoBan, DonViQuyDoi }. Nhanh tuong thich nguoc: chua khai DonViQuyDoi thi hieu 'Ri'.
   ⚠️ Ban sao cua ham nay nam o: backend/routes/khohang.js, backend/routes/public.js,
      frontend/js/common.js (laDonViGop / donViChinhLaGop) — SUA PHAI SUA DONG BO CA 4 CHO. */
function chuanDV(v) { return String(v == null ? '' : v).trim().toLowerCase(); }
function laDonViGop(donVi, mh) {
  const dv = chuanDV(donVi), qd = chuanDV(mh && mh.DonViQuyDoi);
  return qd ? dv === qd : dv === 'ri';
}
function donViChinhLaGop(mh) {
  const cb = chuanDV(mh && mh.DonViCoBan), qd = chuanDV(mh && mh.DonViQuyDoi);
  return qd ? cb === qd : cb === 'ri';
}
function slSangCai(soLuong, donVi, loaiRi, mh) {
  const n = so(soLuong), he = so(loaiRi) || 1;
  return Math.round(laDonViGop(donVi, mh) ? n * he : n);
}
function slSangDonViChinh(soLuong, donVi, donViCoBan, loaiRi, mhIn) {
  const he = so(loaiRi) || 1;
  const mh = mhIn || { DonViCoBan: donViCoBan, DonViQuyDoi: null };
  const cai = slSangCai(soLuong, donVi, loaiRi, mh);
  const base = donViChinhLaGop({ DonViCoBan: donViCoBan, DonViQuyDoi: mh.DonViQuyDoi }) ? cai / he : cai;
  return Math.round(base);
}
/* So phieu <tienTo><yy><4 so>, SO THU TU CHAY SUOT CA NAM (cung quy tac voi ma lenh SX v6.22).
   v6.24.3/v6.24.5: phieu ban hang = PX + yy + 3 so  (vd PX26001, "26" nhay theo nam).
   Ham quet CA tien to CU (PBH) lan MOI de so thu tu chay TIEP, khong quay lai 001.
   GIU 2 SO NAM trong ma: sang nam so thu tu ve 0001, neu bo yy thi PX0001 nam nay va nam sau se TRUNG.
   `nguon` nhan pool HOAC new sql.Request(tran) - de sinh so ngay trong transaction. */
async function sinhSoPhieu(nguon, bang, cot, tienTo, tienToCu, soChuSo) {
  const yy = String(new Date().getFullYear()).slice(-2);
  const dsTienTo = [tienTo].concat(tienToCu ? [tienToCu] : []);
  const rq = typeof nguon.request === 'function' ? nguon.request() : nguon;
  dsTienTo.forEach((t, i) => rq.input('p' + i, sql.NVarChar, t + yy + '%'));
  const rs = await rq.query(`SELECT ${cot} AS S FROM ${bang} WHERE ` + dsTienTo.map((t, i) => `${cot} LIKE @p${i}`).join(' OR '));
  const nums = rs.recordset.map(r => {
    const chuoi = String(r.S || '').trim();
    for (const t of dsTienTo) {
      const m = new RegExp('^' + t + '(\\d{2})(\\d+)$').exec(chuoi);
      if (m && m[1] === yy) return parseInt(m[2], 10) || 0;
    }
    return 0;
  });
  return tienTo + yy + String((nums.length ? Math.max(...nums) : 0) + 1).padStart(soChuSo || 4, '0');
}
async function layTyLeCK(pool) {
  try {
    const rs = (await pool.request().query(
      `SELECT ConfigKey, ConfigValue FROM CauHinhHeThong WHERE ConfigKey IN ('CK_SHOP','CK_NPP','VAT_MAC_DINH')`)).recordset;
    const m = {};
    rs.forEach(r => { m[r.ConfigKey] = r.ConfigValue; });
    const lay = (k, mac) => { const n = Number(m[k]); return isFinite(n) && m[k] !== '' && m[k] != null ? n : mac; };
    return { shop: lay('CK_SHOP', 33), npp: lay('CK_NPP', 17), vat: lay('VAT_MAC_DINH', 0) };
  } catch (err) {
    return { shop: 33, npp: 17, vat: 0 };
  }
}

/* ---------- TRU / HOAN TON: ham DUY NHAT duoc phep dong vao ton thanh pham ----------
   `sl` theo ĐƠN VỊ CHÍNH của mã hàng (xem ghi chú 2 đơn vị ở trên).
   sl > 0 = TRU ton;  sl < 0 = HOAN ton.
   TRU: dùng UPDATE CÓ ĐIỀU KIỆN vw_TonTheoMau.TonCai >= sl rồi kiểm rowsAffected — nhờ vậy 2 người
   lưu phiếu CÙNG LÚC không thể bán vượt tồn (kiểm tồn trước đó chỉ để báo lỗi sớm, không đủ an toàn).
   HOAN: chỉ UPDATE, KHÔNG tạo dòng mới — dòng màu có thể đã bị xóa khỏi thẻ kho, tạo mới sẽ sinh
   XuatCai âm = tồn ảo dương. */
async function ghiXuatKho(pool, tran, maHangId, mauSacId, sl, nhanLoi) {
  const rq = () => (tran ? new sql.Request(tran) : pool.request());
  if (sl > 0) {
    /* v6.89: ĐIỀU KIỆN SO VỚI TỒN TỔNG (vw_TonTheoMau = NhapCai + NhapTuPhieu − XuatCai), không phải
       (NhapCai − XuatCai). Hàng vào kho bằng PHIẾU NHẬP KHO thì NhapCai = 0 nên công thức cũ luôn báo
       "không đủ tồn" dù kho có hàng thật. Xem migration_v682.
       ⚠️ Đây là BẢN SAO của banHangCommon.ghiXuatKho — sửa một bên thì phải sửa cả bên kia. */
    await rq().input('mh', sql.Int, maHangId).input('ms', sql.Int, mauSacId)
      .query(`IF NOT EXISTS (SELECT 1 FROM TheKhoChiTietMau WHERE MaHangID=@mh AND MauSacID=@ms)
                INSERT INTO TheKhoChiTietMau (MaHangID, MauSacID, SoCatCai, NhapCai, XuatCai)
                VALUES (@mh, @ms, 0, 0, 0)`);
    const kq = await rq().input('mh', sql.Int, maHangId).input('ms', sql.Int, mauSacId).input('sl', sql.Int, sl)
      .query(`UPDATE ct SET ct.XuatCai = ct.XuatCai + @sl
              FROM TheKhoChiTietMau ct
              JOIN vw_TonTheoMau t ON t.MaHangID = ct.MaHangID AND t.MauSacID = ct.MauSacID
              WHERE ct.MaHangID=@mh AND ct.MauSacID=@ms AND t.TonCai >= @sl`);
    if (!kq.rowsAffected[0]) {
      throw new Error(`Không đủ tồn kho để xuất${nhanLoi ? ' (' + nhanLoi + ')' : ''} — có người vừa bán/xuất mã này. Mở lại phiếu và kiểm tra tồn.`);
    }
    return;
  }
  const kq = await rq().input('mh', sql.Int, maHangId).input('ms', sql.Int, mauSacId).input('sl', sql.Int, -sl)
    .query('UPDATE TheKhoChiTietMau SET XuatCai = XuatCai - @sl WHERE MaHangID=@mh AND MauSacID=@ms');
  if (!kq.rowsAffected[0]) {
    console.warn('[banhang ghiXuatKho] khong tim thay dong the kho de HOAN ton (MaHangID=%s, MauSacID=%s) - bo qua, khong tao dong moi.', maHangId, mauSacId);
  }
}

/* ================================================================================================
   TON KHA DUNG = ton kho - SL cac don khach dat DANG GIU (Cho xac nhan / Cho xu ly, chua co phieu BH)
   Dung cho: The kho, Catalogue cong khai, va kiem tra du hang khi xuat phieu ban hang.
   Tra ve Map key "<MaHangID>|<MauSacID>" -> so CAI dang giu, kem tong theo ma hang.
   ================================================================================================ */
/* v6.25.4: cot DonIDs (1 dong phieu gom NHIEU don khach dat) do migration_v671 them - do truoc. */
let __coCotDonIDs = null;
async function coCotDonIDs(pool) {
  if (__coCotDonIDs === null) {
    try {
      const r = (await pool.request().query(`SELECT COL_LENGTH('PhieuBanHangChiTiet','DonIDs') AS c`)).recordset[0] || {};
      __coCotDonIDs = r.c != null;
    } catch (e) { __coCotDonIDs = false; }
  }
  return __coCotDonIDs;
}
// Lay danh sach DonID cua 1 dong chi tiet (uu tien DonIDs, chua co thi dung DonID cu).
function dsDonCuaDong(ct) {
  const s = String(ct.DonIDs || '').trim();
  if (s) return s.split(',').map(x => parseInt(x, 10)).filter(x => x > 0);
  return ct.DonID ? [Number(ct.DonID)] : [];
}
let __coCotDaTruTon = null;   // do 1 lan roi nho (COL_LENGTH)
/* v7.13: tach ra thanh ham rieng vi ghiChiTietPhieu() cung can (truoc chi layHangDangGiu dung). */
async function coCotDaTruTon(pool) {
  if (__coCotDaTruTon === null) {
    try {
      const r = (await pool.request().query(`SELECT COL_LENGTH('DonKhachDatHang','DaTruTon') AS c`)).recordset[0] || {};
      __coCotDaTruTon = r.c != null;
    } catch (e) { __coCotDaTruTon = false; }
  }
  return __coCotDaTruTon;
}
async function layHangDangGiu(pool) {
  /* Cột DaTruTon do migration_v657 thêm. Hàm này được gọi ở Thẻ kho, lên đơn, xác nhận đơn VÀ
     catalogue CÔNG KHAI — query thẳng cột chưa có sẽ làm trắng cả trang khách. Dò trước. */
  const dieuKienDaTru = (await coCotDaTruTon(pool)) ? 'AND ISNULL(o.DaTruTon, 0) = 0' : '';
  let rs = [];
  try {
    rs = (await pool.request().query(`
      SELECT o.MaHangID, o.MauSacID, o.SoLuongDat, o.DonVi, h.LoaiRi, h.DonViCoBan, h.DonViQuyDoi
      FROM DonKhachDatHang o
      JOIN TheKhoHangHoa h ON h.MaHangID = o.MaHangID
      WHERE o.TrangThai IN (N'Chờ xác nhận', N'Chờ xử lý') ${dieuKienDaTru}`)).recordset;
  } catch (err) {
    console.error('[banhang layHangDangGiu] loi doc don dang giu, coi nhu khong giu gi: ', err.message);
    return { theoMau: new Map(), theoMaHang: new Map(), loi: err.message };
  }
  // ⚠️ Số trả về theo ĐƠN VỊ CHÍNH (khớp TheKhoChiTietMau/vw_TonKhoHangHoa), KHÔNG phải Cái.
  const theoMau = new Map(), theoMaHang = new Map();
  rs.forEach(r => {
    const sl = slSangDonViChinh(r.SoLuongDat, r.DonVi, r.DonViCoBan, r.LoaiRi, r);
    const k = r.MaHangID + '|' + r.MauSacID;
    theoMau.set(k, (theoMau.get(k) || 0) + sl);
    theoMaHang.set(r.MaHangID, (theoMaHang.get(r.MaHangID) || 0) + sl);
  });
  return { theoMau, theoMaHang };
}
router.get('/danggiu', requireAuth, requirePermission('KHOHANG', 'view'), async (req, res) => {
  const pool = await getPool();
  const g = await layHangDangGiu(pool);
  res.json({
    success: true,
    data: {   // SoGiu theo ĐƠN VỊ CHÍNH của mã hàng
      theoMaHang: [...g.theoMaHang.entries()].map(([MaHangID, SoGiu]) => ({ MaHangID, SoGiu })),
      theoMau: [...g.theoMau.entries()].map(([k, SoGiu]) => {
        const [MaHangID, MauSacID] = k.split('|');
        return { MaHangID: Number(MaHangID), MauSacID: Number(MauSacID), SoGiu };
      })
    }
  });
});

/* ================================================================================================
   DANH SACH / CHI TIET PHIEU BAN HANG
   ================================================================================================ */
router.get('/phieu', requireAuth, requirePermission('KHOHANG', 'view'), requireChucNang('KHOHANG', CN), async (req, res) => {
  const pool = await getPool();
  const rows = (await pool.request().query(`
    SELECT p.*, u.HoTen AS NguoiTao,
           (SELECT COUNT(*) FROM PhieuBanHangChiTiet ct WHERE ct.PhieuBHID = p.PhieuBHID) AS SoDong,
           ISNULL((SELECT SUM(t.SoTien) FROM PhieuThu t WHERE t.PhieuBHID = p.PhieuBHID), 0) AS DaThu
    FROM PhieuBanHang p
    LEFT JOIN Users u ON u.UserID = p.NguoiTaoID
    ORDER BY p.NgayBan DESC, p.PhieuBHID DESC`)).recordset;
  res.json({ success: true, data: rows, tyLe: await layTyLeCK(pool) });
});

/* ================================================================================================
   v6.46 — XUẤT EXCEL DANH SÁCH PHIẾU BÁN HÀNG
   ------------------------------------------------------------------------------------------------
   2 sheet, vì kế toán cần cả hai và ghép tay từ 2 lần xuất là chỗ hay sai:
     · "Phiếu bán hàng"  = mỗi phiếu 1 dòng, đúng các cột đang thấy trên màn hình + Còn nợ.
     · "Chi tiết"        = mỗi dòng hàng 1 dòng, kèm Số phiếu để lọc/ghép lại được.
   Lọc theo KHOẢNG NGÀY (tuNgay/denNgay) và trạng thái, gửi từ màn hình xuống.
   ĐẶT TRƯỚC '/phieu/:id' — Express khớp route theo THỨ TỰ, để sau thì '/phieu/export' rơi vào
   ':id' và đi query `WHERE PhieuBHID = 'export'` (lỗi ép kiểu, không ai hiểu vì sao).
   ================================================================================================ */
router.get('/phieu/export', requireAuth, requirePermission('KHOHANG', 'view'), requireChucNang('KHOHANG', CN), async (req, res) => {
  try {
    const pool = await getPool();
    const tu = (req.query.tuNgay || '').trim() || null;
    const den = (req.query.denNgay || '').trim() || null;
    const tt = (req.query.trangThai || '').trim();
    const dieuKien = [];
    if (tu) dieuKien.push('p.NgayBan >= @tu');
    if (den) dieuKien.push('p.NgayBan <= @den');
    if (tt) dieuKien.push('p.TrangThai = @tt');
    const whereSql = dieuKien.length ? 'WHERE ' + dieuKien.join(' AND ') : '';

    const rq = pool.request();
    if (tu) rq.input('tu', sql.Date, tu);
    if (den) rq.input('den', sql.Date, den);
    if (tt) rq.input('tt', sql.NVarChar, tt);
    const phieu = (await rq.query(`
      SELECT p.*, u.HoTen AS NguoiTao,
             (SELECT COUNT(*) FROM PhieuBanHangChiTiet ct WHERE ct.PhieuBHID = p.PhieuBHID) AS SoDong,
             ISNULL((SELECT SUM(t.SoTien) FROM PhieuThu t WHERE t.PhieuBHID = p.PhieuBHID), 0) AS DaThu
      FROM PhieuBanHang p
      LEFT JOIN Users u ON u.UserID = p.NguoiTaoID
      ${whereSql}
      ORDER BY p.NgayBan DESC, p.PhieuBHID DESC`)).recordset;

    const rq2 = pool.request();
    if (tu) rq2.input('tu', sql.Date, tu);
    if (den) rq2.input('den', sql.Date, den);
    if (tt) rq2.input('tt', sql.NVarChar, tt);
    const chiTiet = (await rq2.query(`
      SELECT p.SoPhieu, p.NgayBan, p.TenKhach, p.TrangThai,
             h.MaHang, h.TenHang, ms.TenMau,
             ct.SoLuong, ct.DonVi, ct.SoLuongCai, ct.SoLuongQuyDoi, ct.DonViQuyDoi,
             ct.GiaBanLe, ct.PhanTramCKShop, ct.GiaBan, ct.ThanhTien, ct.GhiChu
      FROM PhieuBanHangChiTiet ct
      JOIN PhieuBanHang p ON p.PhieuBHID = ct.PhieuBHID
      JOIN TheKhoHangHoa h ON h.MaHangID = ct.MaHangID
      LEFT JOIN MauSac ms ON ms.MauSacID = ct.MauSacID
      ${whereSql}
      ORDER BY p.NgayBan DESC, p.PhieuBHID DESC, ct.ID`)).recordset;

    const hai = n => String(n).padStart(2, '0');
    const ngayVN = d => { const x = new Date(d); return isNaN(x) ? '' : `${hai(x.getDate())}/${hai(x.getMonth() + 1)}/${x.getFullYear()}`; };
    const so = v => Number(v) || 0;

    const wb = new ExcelJS.Workbook();

    const ws = wb.addWorksheet('Phiếu bán hàng');
    ws.columns = [
      { header: 'Số phiếu', key: 'SoPhieu', width: 14 },
      { header: 'Ngày', key: 'Ngay', width: 11 },
      { header: 'Khách hàng', key: 'TenKhach', width: 26 },
      { header: 'Số dòng', key: 'SoDong', width: 9 },
      { header: 'Tổng SL', key: 'TongSLCai', width: 10 },
      { header: 'Tiền hàng', key: 'TongTienHang', width: 15 },
      { header: '% CK NPP', key: 'PhanTramCKNPP', width: 10 },
      { header: 'Tiền CK NPP', key: 'TienCKNPP', width: 14 },
      { header: '% GTGT', key: 'PhanTramVAT', width: 9 },
      { header: 'Thuế GTGT', key: 'TienVAT', width: 14 },
      { header: 'Tổng thanh toán', key: 'TongThanhToan', width: 17 },
      { header: 'Đã thu', key: 'DaThu', width: 14 },
      { header: 'Còn nợ', key: 'ConNo', width: 14 },
      { header: 'Trạng thái', key: 'TrangThai', width: 13 },
      { header: 'Người tạo', key: 'NguoiTao', width: 18 },
      { header: 'Ghi chú', key: 'GhiChu', width: 28 }
    ];
    ws.getRow(1).font = { bold: true };
    phieu.forEach(p => {
      // Phiếu ĐÃ HỦY: không còn phải thu, nên Còn nợ để 0 thay vì ra số âm/dương vô nghĩa.
      const huy = p.TrangThai === 'Đã hủy';
      ws.addRow({
        SoPhieu: p.SoPhieu, Ngay: ngayVN(p.NgayBan), TenKhach: p.TenKhach, SoDong: so(p.SoDong),
        TongSLCai: so(p.TongSLCai), TongTienHang: so(p.TongTienHang),
        PhanTramCKNPP: so(p.PhanTramCKNPP), TienCKNPP: so(p.TienCKNPP),
        PhanTramVAT: so(p.PhanTramVAT), TienVAT: so(p.TienVAT),
        TongThanhToan: huy ? 0 : so(p.TongThanhToan), DaThu: so(p.DaThu),
        ConNo: huy ? 0 : so(p.TongThanhToan) - so(p.DaThu),
        TrangThai: p.TrangThai, NguoiTao: p.NguoiTao || '', GhiChu: p.GhiChu || ''
      });
    });
    /* Dòng TỔNG bằng công thức SUM, lấy chữ cái cột qua getColumn().letter — viết cứng 'F2:F99' thì
       thêm/bớt một cột là lệch ngay mà Excel không báo gì. */
    if (phieu.length) {
      const cuoi = ws.rowCount;
      const cot = k => ws.getColumn(k).letter;
      const tong = k => ({ formula: `SUM(${cot(k)}2:${cot(k)}${cuoi})` });
      const r = ws.addRow({
        TenKhach: 'TỔNG', TongSLCai: tong('TongSLCai'), TongTienHang: tong('TongTienHang'),
        TienCKNPP: tong('TienCKNPP'), TienVAT: tong('TienVAT'),
        TongThanhToan: tong('TongThanhToan'), DaThu: tong('DaThu'), ConNo: tong('ConNo')
      });
      r.font = { bold: true };
    }

    const ws2 = wb.addWorksheet('Chi tiết');
    ws2.columns = [
      { header: 'Số phiếu', key: 'SoPhieu', width: 14 },
      { header: 'Ngày', key: 'Ngay', width: 11 },
      { header: 'Khách hàng', key: 'TenKhach', width: 26 },
      { header: 'Mã hàng', key: 'MaHang', width: 16 },
      { header: 'Tên hàng', key: 'TenHang', width: 30 },
      { header: 'Màu', key: 'TenMau', width: 14 },
      { header: 'SL', key: 'SoLuong', width: 9 },
      { header: 'Đơn vị', key: 'DonVi', width: 9 },
      { header: 'SL quy về ĐVT chính', key: 'SoLuongCai', width: 18 },
      { header: 'Giá bán lẻ', key: 'GiaBanLe', width: 13 },
      { header: '% CK shop', key: 'PhanTramCKShop', width: 10 },
      { header: 'Giá bán', key: 'GiaBan', width: 13 },
      { header: 'Thành tiền', key: 'ThanhTien', width: 15 },
      { header: 'Trạng thái phiếu', key: 'TrangThai', width: 15 },
      { header: 'Ghi chú', key: 'GhiChu', width: 24 }
    ];
    ws2.getRow(1).font = { bold: true };
    chiTiet.forEach(c => ws2.addRow({
      SoPhieu: c.SoPhieu, Ngay: ngayVN(c.NgayBan), TenKhach: c.TenKhach,
      MaHang: c.MaHang, TenHang: c.TenHang, TenMau: c.TenMau || '',
      SoLuong: so(c.SoLuong), DonVi: c.DonVi || '', SoLuongCai: so(c.SoLuongCai),
      GiaBanLe: so(c.GiaBanLe), PhanTramCKShop: so(c.PhanTramCKShop),
      GiaBan: so(c.GiaBan), ThanhTien: so(c.ThanhTien),
      TrangThai: c.TrangThai, GhiChu: c.GhiChu || ''
    }));
    if (chiTiet.length) {
      const cuoi = ws2.rowCount;
      const cot = k => ws2.getColumn(k).letter;
      const r = ws2.addRow({
        TenHang: 'TỔNG',
        SoLuongCai: { formula: `SUM(${cot('SoLuongCai')}2:${cot('SoLuongCai')}${cuoi})` },
        ThanhTien: { formula: `SUM(${cot('ThanhTien')}2:${cot('ThanhTien')}${cuoi})` }
      });
      r.font = { bold: true };
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="phieu_ban_hang.xlsx"');
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('[banhang GET /phieu/export] ', err);
    res.status(400).json({ success: false, message: 'Lỗi khi xuất Excel: ' + err.message });
  }
});

/* v6.47: XUẤT EXCEL MỘT PHIẾU — bố cục giống bản in: khối thông tin phiếu ở trên, bảng hàng ở dưới,
   rồi Tổng cộng → CK NPP → Tổng tiền TT → VAT → Tổng sau VAT theo ĐÚNG thứ tự mẫu Word (v6.23).
   Đặt trước '/phieu/:id' như '/phieu/export' — cùng lý do thứ tự route. */
router.get('/phieu/:id/export', requireAuth, requirePermission('KHOHANG', 'view'), requireChucNang('KHOHANG', CN), async (req, res) => {
  try {
    const pool = await getPool();
    const h = (await pool.request().input('id', sql.Int, req.params.id).query(`
      SELECT p.*, u.HoTen AS NguoiTao,
             ISNULL((SELECT SUM(t.SoTien) FROM PhieuThu t WHERE t.PhieuBHID = p.PhieuBHID), 0) AS DaThu
      FROM PhieuBanHang p LEFT JOIN Users u ON u.UserID = p.NguoiTaoID
      WHERE p.PhieuBHID = @id`)).recordset[0];
    if (!h) return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu bán hàng.' });
    const ct = (await pool.request().input('id', sql.Int, req.params.id).query(`
      SELECT ct.*, h.MaHang, h.TenHang, ms.TenMau
      FROM PhieuBanHangChiTiet ct
      JOIN TheKhoHangHoa h ON h.MaHangID = ct.MaHangID
      LEFT JOIN MauSac ms ON ms.MauSacID = ct.MauSacID
      WHERE ct.PhieuBHID = @id ORDER BY ct.ID`)).recordset;

    const hai = n => String(n).padStart(2, '0');
    const ngayVN = d => { const x = new Date(d); return isNaN(x) ? '' : `${hai(x.getDate())}/${hai(x.getMonth() + 1)}/${x.getFullYear()}`; };
    const so = v => Number(v) || 0;

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Phiếu bán hàng');
    /* ================================================================================================
       v7.47: CỘT "SL QUY ĐỔI" LẤY `ct.SoLuongQuyDoi`, KHÔNG LẤY `SoLuongCai`.
       Lỗi cũ: ô này ghi `SoLuongCai` — tức SỐ CÁI, đúng bằng cột "SL" khi khách đặt theo Cái, nên
       nhìn vào tưởng phần mềm không quy đổi. `SoLuongQuyDoi` + `DonViQuyDoi` là 2 cột CÓ SẴN trên
       PhieuBanHangChiTiet, ghi lúc lưu phiếu (xem chỗ tính `soLuongQuyDoi` ở taoDong):
           · đặt theo đơn vị GỘP (Ri) -> SoLuongQuyDoi = số CÁI,  DonViQuyDoi = ĐVT chính
           · đặt theo đơn vị GỐC (Cái) -> SoLuongQuyDoi = số RI,   DonViQuyDoi = ĐVT quy đổi
           · mã KHÔNG có quy đổi (tỷ lệ 1) -> cả hai NULL  => để TRỐNG, không bịa số
       Bản xuất DANH SÁCH phiếu (/phieu/export) đã đọc đúng 2 cột này từ trước — chỉ bản xuất MỘT
       phiếu là lệch. Nay hai bản dùng cùng một nguồn.
       THÊM cột "ĐVT quy đổi" để con số có đơn vị: 5 mà không biết 5 Ri hay 5 Cái thì vô nghĩa.
       ================================================================================================ */
    ws.columns = [
      { key: 'STT', width: 6 }, { key: 'MaHang', width: 16 }, { key: 'TenHang', width: 32 },
      { key: 'TenMau', width: 14 }, { key: 'SoLuong', width: 9 }, { key: 'DonVi', width: 9 },
      { key: 'SoLuongQuyDoi', width: 12 }, { key: 'DonViQuyDoi', width: 12 },
      { key: 'GiaBanLe', width: 13 },
      { key: 'CKShop', width: 10 }, { key: 'GiaBan', width: 13 }, { key: 'ThanhTien', width: 15 }
    ];
    const SO_COT = ws.columns.length;   // đổi số cột là mọi merge/SUM dưới đây tự theo
    const dongTieuDe = (chu) => {
      const r = ws.addRow([chu]);
      ws.mergeCells(r.number, 1, r.number, SO_COT);
      r.getCell(1).font = { bold: true, size: 14 };
      r.getCell(1).alignment = { horizontal: 'center' };
      return r;
    };
    const dongThongTin = (nhan, giaTri) => {
      const r = ws.addRow([nhan, giaTri]);
      ws.mergeCells(r.number, 2, r.number, SO_COT);
      r.getCell(1).font = { bold: true };
      return r;
    };
    dongTieuDe('PHIẾU XUẤT KHO KIÊM BIÊN BẢN BÀN GIAO');
    dongThongTin('Số phiếu:', h.SoPhieu);
    dongThongTin('Ngày:', ngayVN(h.NgayBan));
    dongThongTin('Khách hàng:', h.TenKhach || '');
    if (h.GhiChu) dongThongTin('Ghi chú:', h.GhiChu);
    if (h.TrangThai === 'Đã hủy') dongThongTin('Trạng thái:', 'PHIẾU ĐÃ HỦY');
    ws.addRow([]);

    const rTitle = ws.addRow(['STT', 'Mã hàng', 'Tên hàng', 'Màu', 'SL', 'Đơn vị',
      'SL quy đổi', 'ĐVT quy đổi', 'Giá bán lẻ', '% CK shop', 'Giá bán', 'Thành tiền']);
    rTitle.font = { bold: true };
    const dongDau = ws.rowCount + 1;
    ct.forEach((c, i) => ws.addRow([
      i + 1, c.MaHang, c.TenHang, c.TenMau || '', so(c.SoLuong), c.DonVi || '',
      /* NULL = mã không có quy đổi -> để TRỐNG. Ghi 0 là người đọc tưởng quy đổi ra 0. */
      c.SoLuongQuyDoi == null ? '' : so(c.SoLuongQuyDoi), c.DonViQuyDoi || '',
      so(c.GiaBanLe), so(c.PhanTramCKShop), so(c.GiaBan), so(c.ThanhTien)
    ]));
    const dongCuoi = ws.rowCount;

    // Khối tổng: đúng thứ tự mẫu Word. Tổng cộng lấy bằng SUM để mở file ra vẫn kiểm tra được.
    const dongTong = (nhan, giaTri, dam) => {
      const r = ws.addRow([]);
      ws.mergeCells(r.number, 1, r.number, SO_COT - 1);
      r.getCell(1).value = nhan;
      r.getCell(1).alignment = { horizontal: 'right' };
      r.getCell(SO_COT).value = giaTri;
      if (dam) { r.getCell(1).font = { bold: true }; r.getCell(SO_COT).font = { bold: true }; }
      return r;
    };
    /* v7.47: lấy CHỮ CÁI cột Thành tiền qua getColumn().letter. Viết cứng 'K' như trước là thêm một
       cột (đúng lần này) thì công thức SUM trỏ sang cột khác mà Excel không báo gì. */
    const cotTT = ws.getColumn(SO_COT).letter;
    dongTong('Tổng cộng', ct.length ? { formula: `SUM(${cotTT}${dongDau}:${cotTT}${dongCuoi})` } : 0, true);
    if (so(h.TienCKNPP)) dongTong(`Chiết khấu NPP (${so(h.PhanTramCKNPP)}%)`, -so(h.TienCKNPP));
    dongTong('Tổng tiền thanh toán', so(h.TongTienHang) - so(h.TienCKNPP));
    if (so(h.TienVAT)) dongTong(`Thuế GTGT (${so(h.PhanTramVAT)}%)`, so(h.TienVAT));
    dongTong('TỔNG THANH TOÁN', so(h.TongThanhToan), true);
    dongTong('Đã thu', so(h.DaThu));
    dongTong('Còn nợ', so(h.TongThanhToan) - so(h.DaThu), true);

    /* v6.64: TEN FILE = so phieu + ten khach. Tai ve hang chuc phieu roi tim lai theo khach thi ten
       chi co so phieu la vo dung. Bo dau tieng Viet + doi ky tu la thanh '_': ten file co dau di qua
       header Content-Disposition hay bi trinh duyet cat hoac bien thanh ky tu la. */
    const boDau = new RegExp('[\\u0300-\\u036f]', 'g');
    const sach = (s) => String(s || '').normalize('NFD').replace(boDau, '')
      .replace(new RegExp('đ', 'g'), 'd').replace(new RegExp('Đ', 'g'), 'D')
      .replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    const ten = [sach(h.SoPhieu || h.PhieuBHID), sach(h.TenKhach)].filter(Boolean).join('_') || 'phieu';
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="PhieuBanHang_${ten}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('[banhang GET /phieu/:id/export] ', err);
    res.status(400).json({ success: false, message: 'Lỗi khi xuất Excel: ' + err.message });
  }
});

/* ================================================================================================
   v7.43 — XUAT HOA DON GTGT (file nap vao VietInvoice)
   ------------------------------------------------------------------------------------------------
   Gia tren phieu la GIA DA GOM THUE; hoa don can gia TRUOC THUE nen chia 1.08 (thue 8%).
   Toan bo phep tinh + ghi file nam o utils/hoaDonVietInvoice.js — doc ghi chu dau file do TRUOC KHI
   SUA, dac biet doan noi ve "phieu da tach thue thi KHONG boc lan hai".
   `?thue=` cho phep doi % thue khi chinh sach doi (mac dinh 8).
   ================================================================================================ */
router.get('/phieu/:id/hoadon', requireAuth, requirePermission('KHOHANG', 'view'), requireChucNang('KHOHANG', CN), async (req, res) => {
  try {
    const pool = await getPool();
    const h = (await pool.request().input('id', sql.Int, req.params.id).query(`
      SELECT * FROM PhieuBanHang WHERE PhieuBHID = @id`)).recordset[0];
    if (!h) return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu bán hàng.' });
    if (h.TrangThai === 'Đã hủy') {
      return res.status(400).json({ success: false, message: 'Phiếu này ĐÃ HỦY — không xuất hóa đơn.' });
    }
    /* v7.46: TenHoaDon cua MA HANG (migration_v690) — hoa don ghi ten theo giay to, khong ghi ten
       noi bo. Do COL_LENGTH: chua chay migration thi lui ve TenHang nhu cu. */
    const cotTenHDHang = (await coCotTenHoaDon(pool)) ? 'h.TenHoaDon' : 'CAST(NULL AS NVARCHAR(255))';
    const ct = (await pool.request().input('id', sql.Int, req.params.id).query(`
      SELECT ct.*, h.MaHang, h.TenHang, ${cotTenHDHang} AS TenHoaDon,
             h.DonViCoBan, h.DonViQuyDoi, h.LoaiRi, ms.TenMau
      FROM PhieuBanHangChiTiet ct
      JOIN TheKhoHangHoa h ON h.MaHangID = ct.MaHangID
      LEFT JOIN MauSac ms ON ms.MauSacID = ct.MauSacID
      WHERE ct.PhieuBHID = @id ORDER BY ct.ID`)).recordset;
    if (!ct.length) return res.status(400).json({ success: false, message: 'Phiếu không có dòng hàng nào.' });

    /* THONG TIN XUAT HOA DON cua khach (ten phap nhan / MST / dia chi hoa don / email nhan hoa don)
       — chi lay duoc khi phieu co gan KhachHangID.
       v7.45: 4 cot moi den tu migration_v689. DO COL_LENGTH truoc khi SELECT: chua chay migration thi
       route van xuat duoc hoa don (lui ve ten/dia chi cua phieu) thay vi bao "Invalid column name". */
    let kh = null;
    if (h.KhachHangID) {
      const coHD = (await pool.request().query(`
        SELECT CASE WHEN COL_LENGTH('KhachHang', 'TenHoaDon') IS NOT NULL
                     AND COL_LENGTH('KhachHang', 'MaSoThue') IS NOT NULL
                     AND COL_LENGTH('KhachHang', 'DiaChiHoaDon') IS NOT NULL
                     AND COL_LENGTH('KhachHang', 'EmailHoaDon') IS NOT NULL
                    THEN 1 ELSE 0 END AS co`)).recordset[0].co === 1;
      const cotHD = coHD ? ', TenHoaDon, MaSoThue, DiaChiHoaDon, EmailHoaDon' : '';
      kh = (await pool.request().input('k', sql.Int, h.KhachHangID).query(
        `SELECT TenKhachHang, DiaChi, Email, GhiChu${cotHD} FROM KhachHang WHERE KhachHangID = @k`)).recordset[0] || null;
    }
    const thue = /^\d+(\.\d+)?$/.test(String(req.query.thue || '')) ? Number(req.query.thue) : undefined;
    const { wb, kq } = await taoWorkbookHoaDon(h, ct, kh, thue == null ? {} : { thue });

    const boDau = new RegExp('[\\u0300-\\u036f]', 'g');
    const sach = (s) => String(s || '').normalize('NFD').replace(boDau, '')
      .replace(new RegExp('đ', 'g'), 'd').replace(new RegExp('Đ', 'g'), 'D')
      .replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    const ten = [sach(h.SoPhieu || h.PhieuBHID), sach(h.TenKhach)].filter(Boolean).join('_') || 'phieu';
    /* Canh bao (neu co) di theo HEADER de frontend hien duoc — khong the nhet vao body vi body la file.
       Phai bo dau: header HTTP chi nhan ASCII. */
    if (kq.canhBao.length) res.setHeader('X-Canh-Bao', sach(kq.canhBao.join(' | ')).slice(0, 400));
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="HoaDon_${ten}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('[banhang GET /phieu/:id/hoadon] ', err);
    res.status(400).json({ success: false, message: 'Lỗi khi xuất hóa đơn: ' + err.message });
  }
});

/* ================================================================================================
   v7.59 — HANG MAU / CHO KHACH MUON
   ------------------------------------------------------------------------------------------------
   Phieu ban hang co co `LaHangMau` van TRU TON va van vao CONG NO y het phieu ban binh thuong —
   khong mot phep tinh tien nao doi. Cai duy nhat them vao la CAU TRA LOI cho:
       "mau nay da gui cho khach do chua, tu bao gio, con bao nhieu chua tra?"
   So lieu lay tu utils/dongDaBanChoKhach.js (CUNG ban cong thuc voi Phieu nhap lai), nen so o day
   va so "con tra duoc" o man Phieu nhap lai KHONG THE lech nhau.

   ⚠️ QUYEN — CO Y KHAC NHAU giua hai route duoi:
     · /hangmau       : so rieng, gate theo ChucNang KHOHANG/hangmau (tab rieng, co the giao rieng).
     · /hangmau/nhac  : chi gate theo quyen XEM cua module. Route nay phuc vu CANH BAO ngay tren form
       Phieu ban hang va popup The kho — hai man o TAB KHAC. Gate no theo 'hangmau' thi nguoi lap
       phieu (khong duoc giao tab so) se bi 403 va canh bao "im lang" khong hien, dung kieu loi da
       gap nhieu lan. Du lieu tra ve chi la thu ma ho da thay duoc o danh sach phieu ban hang.
   ================================================================================================ */
async function docHangMau(pool, q) {
  const ds = await hangMauDangOKhach(pool, sql, {
    tenKhach: q.tenKhach || null,
    maHangID: q.maHangID ? Number(q.maHangID) : null,
    /* Mac dinh CHI hien phan con o khach. `tatCa=1` de xem ca lich su da tra xong. */
    chiConGiu: String(q.tatCa || '') !== '1'
  });
  return String(q.gom || '') === '1' ? gomTheoKhachMa(ds) : ds;
}

router.get('/hangmau', requireAuth, requirePermission('KHOHANG', 'view'),
  requireChucNang('KHOHANG', 'hangmau'), async (req, res) => {
    const pool = await getPool();
    res.json({ success: true, data: await docHangMau(pool, req.query || {}), coCot: await coCotHangMau(pool) });
  });

router.get('/hangmau/nhac', requireAuth, requirePermission('KHOHANG', 'view'), async (req, res) => {
  const pool = await getPool();
  const q = { ...(req.query || {}), gom: '1' };   // canh bao luon la ban GOM theo ma + mau
  res.json({ success: true, data: await docHangMau(pool, q) });
});

router.get('/hangmau/export', requireAuth, requirePermission('KHOHANG', 'view'),
  requireChucNang('KHOHANG', 'hangmau'), async (req, res) => {
    const pool = await getPool();
    const ds = await docHangMau(pool, { ...(req.query || {}), gom: '' });
    const hai = n => String(n).padStart(2, '0');
    const ngayVN = d => { const x = new Date(d); return isNaN(x) ? '' : `${hai(x.getDate())}/${hai(x.getMonth() + 1)}/${x.getFullYear()}`; };

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Hàng mẫu ở khách');
    ws.columns = [
      { header: 'Ngày gửi', key: 'Ngay', width: 11 },
      { header: 'Số phiếu', key: 'SoPhieu', width: 14 },
      { header: 'Khách hàng', key: 'TenKhach', width: 28 },
      { header: 'Mã hàng', key: 'MaHang', width: 16 },
      { header: 'Tên hàng', key: 'TenHang', width: 30 },
      { header: 'Màu', key: 'TenMau', width: 14 },
      { header: 'SL gửi', key: 'SLGui', width: 10 },
      { header: 'Đã trả', key: 'DaTra', width: 10 },
      { header: 'Còn ở khách', key: 'ConLai', width: 12 },
      { header: 'Đơn vị', key: 'DonVi', width: 9 },
      { header: 'Số ngày mượn', key: 'SoNgay', width: 13 },
      { header: 'Ghi chú dòng', key: 'GhiChu', width: 26 }
    ];
    ws.getRow(1).font = { bold: true };
    ds.forEach(r => ws.addRow({
      Ngay: ngayVN(r.NgayBan), SoPhieu: r.SoPhieu, TenKhach: r.TenKhach,
      MaHang: r.MaHang, TenHang: r.TenHang, TenMau: r.TenMau || '',
      SLGui: so(r.SoLuongCai), DaTra: so(r.DaTraCai), ConLai: so(r.ConOKhachCai),
      DonVi: r.DonViCoBan || 'Cái', SoNgay: r.SoNgayMuon == null ? '' : r.SoNgayMuon,
      GhiChu: r.GhiChu || ''
    }));
    if (ds.length) {
      const cuoi = ws.rowCount;
      const cot = k => ws.getColumn(k).letter;
      const tong = k => ({ formula: `SUM(${cot(k)}2:${cot(k)}${cuoi})` });
      const r = ws.addRow({ TenHang: 'TỔNG', SLGui: tong('SLGui'), DaTra: tong('DaTra'), ConLai: tong('ConLai') });
      r.font = { bold: true };
    }
    /* Chuan bat buoc cho moi file xuat: dinh dang so + ke bang (khong de bang tran khong duong ke). */
    ['SLGui', 'DaTra', 'ConLai', 'SoNgay'].forEach(k => { ws.getColumn(k).numFmt = '#,##0'; ws.getColumn(k).alignment = { horizontal: 'right' }; });
    for (let i = 1; i <= ws.rowCount; i++) {
      ws.getRow(i).eachCell(c => { c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }; });
    }
    const ten = String(req.query.tenKhach || 'tat_ca').replace(/[^\p{L}\p{N}]+/gu, '_').slice(0, 40);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Hang_mau_o_khach_${ten}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  });

router.get('/phieu/:id', requireAuth, requirePermission('KHOHANG', 'view'), requireChucNang('KHOHANG', CN), async (req, res) => {
  const pool = await getPool();
  const header = (await pool.request().input('id', sql.Int, req.params.id).query(`
    SELECT p.*, u.HoTen AS NguoiTao,
           ISNULL((SELECT SUM(t.SoTien) FROM PhieuThu t WHERE t.PhieuBHID = p.PhieuBHID), 0) AS DaThu
    FROM PhieuBanHang p LEFT JOIN Users u ON u.UserID = p.NguoiTaoID
    WHERE p.PhieuBHID = @id`)).recordset[0];
  if (!header) return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu bán hàng.' });
  const chiTiet = (await pool.request().input('id', sql.Int, req.params.id).query(`
    SELECT ct.*, h.MaHang, h.TenHang, h.AnhDaiDien, h.DonViCoBan, h.DonViQuyDoi, h.LoaiRi, ms.TenMau
    FROM PhieuBanHangChiTiet ct
    JOIN TheKhoHangHoa h ON h.MaHangID = ct.MaHangID
    LEFT JOIN MauSac ms ON ms.MauSacID = ct.MauSacID
    WHERE ct.PhieuBHID = @id ORDER BY ct.ID`)).recordset;

  /* ==============================================================================================
     v7.58 — TACH "DON THAT CUA KHACH" KHOI "DON PHAN CHIEU DO CHINH PHIEU NAY SINH".
     Dong BAN THANG duoc v7.22 sinh mot don phan chieu roi gan DonID vao dong. Man hinh Sua phieu doc
     `DonIDs` nen coi dong do la "lay tu don khach": khoa cung ma hang, hien nhan "tu 1 don: #456" —
     trong khi khach chua he dat don nao. Nang hon: id do duoc gui NGUOC len khi luu, ma luc luu phieu
     GO don phan chieu ra truoc => INSERT vao khoa ngoai da dut (loi FK__PhieuBanH__DonID__...).
     Tra them `DonIDsThat` (rong = ban thang) de form dung DUNG loai don. PUT VAN loc lan nua — cho
     trinh duyet con giu file JS cu.
     ============================================================================================== */
  const phanChieu = new Set();
  if (await coCotNguonDat(pool)) {
    (await pool.request().input('id', sql.Int, req.params.id).query(
      `SELECT DonID FROM DonKhachDatHang WHERE PhieuBHID = @id AND NguonDat = N'${NGUON_PHIEU_BH}'`
    )).recordset.forEach(r => phanChieu.add(Number(r.DonID)));
  }
  chiTiet.forEach(c => {
    const that = dsDonCuaDong(c).filter(id => !phanChieu.has(Number(id)));
    c.DonIDsThat = that.join(',');
    c.LaBanThang = that.length ? 0 : 1;
  });

  /* v6.24.3: CONG NO TRUOC PHIEU NAY + TONG CONG NO (in ra cuoi phieu cho khach doi chieu).
     v7.41: cong thuc DA CHUYEN sang utils/congNoTruocChungTu.js de PHIEU NHAP LAI dung CHUNG mot ban
     — viet ban thu hai cho phieu nhap lai la chac chan troi khoi nhau (bai hoc v6.47). Ket qua khong
     doi so voi ban cu: cung 4 nguon, cung moc "cung ngay thi ID nho hon". */
  const kqNo = await congNoTruocChungTu(pool, sql, {
    tenKhach: header.TenKhach, ngay: header.NgayBan, loai: 'PBH', id: header.PhieuBHID
  });
  const congNoTruoc = tien(kqNo.congNoTruoc);
  header.CongNoTruoc = congNoTruoc;
  header.TongCongNo = tien(congNoTruoc + so(header.TongThanhToan));

  res.json({ success: true, data: { header, chiTiet } });
});

// So phieu xem truoc (chi de hien tren form - luc luu backend sinh lai de tranh trung)
router.get('/next-sophieu', requireAuth, requirePermission('KHOHANG', 'view'), requireChucNang('KHOHANG', CN), async (req, res) => {
  const pool = await getPool();
  res.json({ success: true, data: { soPhieu: await sinhSoPhieu(pool, 'PhieuBanHang', 'SoPhieu', 'PX', 'PBH', 3), tyLe: await layTyLeCK(pool) } });
});

/* ================================================================================================
   TAO PHIEU BAN HANG
   body: { ngayBan, khachHangId, tenKhach, sdt, diaChi, phanTramCKNPP, phanTramVAT, ghiChu,
           dong: [{ maHangId, mauSacId, soLuong, donVi, giaBanLe, phanTramCKShop, donID }] }
   - donID: neu dong nay lay tu 1 don khach dat -> don do se chuyen 'Da xuat hang' va gan PhieuBHID.
   - Kiem tra DU TON (ton kho thuc, KHONG tinh phan dang giu cua chinh cac don duoc xuat).
   ================================================================================================ */
/* ================================================================================================
   CHUAN BI 1 PHIEU BAN HANG tu du lieu form: kiem tra + tinh tung dong + tinh cac tong.
   DUNG CHUNG cho TAO MOI (POST) va SUA (PUT) - de 2 duong nay khong bao gio lech cong thuc tien/ton.
   Tra ve { loi } neu du lieu sai, nguoc lai tra ve { dong, tong }.
   `tonBu` (khi SUA) = Map "maHangId|mauSacId" -> so luong (DON VI CHINH) ma CHINH phieu dang sua dang
   giu. Phai cong vao ton khi kiem, vi khi luu he thong se HOAN phan do truoc roi moi tru lai theo so
   moi -> khong cong bu thi sua tang so luong se bi bao "khong du ton" oan.
   (Chan that su van la UPDATE co dieu kien trong ghiXuatKho - kiem o day chi de bao loi som, de hieu.)
   ================================================================================================ */
async function chuanBiPhieu(pool, b, tonBu) {
  const dongVao = Array.isArray(b.dong) ? b.dong.filter(d => d && d.maHangId && so(d.soLuong) > 0) : [];
  if (!dongVao.length) return { loi: 'Phiếu chưa có dòng hàng nào (cần mã hàng và số lượng).' };
  if (!String(b.tenKhach || '').trim()) return { loi: 'Chưa nhập tên khách hàng.' };

  // Nap thong tin ma hang (gia ban, LoaiRi, don vi) + ton hien tai.
  // Loc bo id khong phai so truoc khi noi vao IN (...) - tranh sinh "NaN" lam cau SQL loi kho hieu.
  const ids = [...new Set(dongVao.map(d => parseInt(d.maHangId, 10)).filter(x => Number.isFinite(x) && x > 0))];
  if (!ids.length) return { loi: ('Dòng hàng không có mã hàng hợp lệ.') };
  const hangRs = (await pool.request().query(`
    SELECT h.MaHangID, h.MaHang, h.TenHang, h.GiaBan, h.LoaiRi, h.DonViCoBan, h.DonViQuyDoi
    FROM TheKhoHangHoa h WHERE h.MaHangID IN (${ids.join(',')})`)).recordset;
  const thieuMau = dongVao.filter(d => !d.mauSacId);
  if (thieuMau.length) {
    // Bắt buộc có màu: thẻ kho luôn quản theo màu, dòng không màu sẽ ghi tiền/công nợ mà KHÔNG trừ tồn.
    return { loi: (`Có ${thieuMau.length} dòng chưa chọn MÀU. Phải chọn màu để trừ đúng tồn kho.`) };
  }
  const hangMap = new Map(hangRs.map(h => [h.MaHangID, h]));
  // v6.89: đọc từ vw_TonTheoMau — đã gồm cả nguồn PHIẾU NHẬP KHO (migration_v682).
  const tonRs = (await pool.request().query(`
    SELECT MaHangID, MauSacID, TonCai FROM vw_TonTheoMau
    WHERE MaHangID IN (${ids.join(',')})`)).recordset;
  const tonMap = new Map(tonRs.map(r => [r.MaHangID + '|' + r.MauSacID, so(r.TonCai)]));

  /* CK NPP mặc định = 0 khi không gửi: CK shop đã áp ở TỪNG DÒNG, CK NPP là mức GIẢM THÊM chỉ dành
     cho nhà phân phối. Nếu mặc định 17% thì bán cho shop mà quên xóa số là mất thêm 17% doanh thu. */
  const tyLe = await layTyLeCK(pool);
  const ckNPP = b.phanTramCKNPP != null && b.phanTramCKNPP !== '' ? so(b.phanTramCKNPP) : 0;
  const vat = b.phanTramVAT != null && b.phanTramVAT !== '' ? so(b.phanTramVAT) : tyLe.vat;

  // Chuan hoa tung dong + kiem tra ton
  const canTru = new Map();   // "mh|ms" -> SL theo DON VI CHINH (de doi chieu ton kho)
  const dong = [];
  for (const d of dongVao) {
    const h = hangMap.get(Number(d.maHangId));
    if (!h) return { loi: ('Mã hàng không tồn tại (ID ' + d.maHangId + ').') };
    const donVi = d.donVi || h.DonViCoBan || 'Cái';
    const soCai = slSangCai(d.soLuong, donVi, h.LoaiRi, h);                              // cho TIEN
    const slChinh = slSangDonViChinh(d.soLuong, donVi, h.DonViCoBan, h.LoaiRi, h);       // cho TON KHO
    if (soCai <= 0) return { loi: (`Dòng ${h.MaHang}: số lượng quy đổi ra Cái = 0.`) };
    /* ⚠️ MA QUAN KHO THEO RI thi ton chi luu duoc SO RI NGUYEN -> ban le vai cai KHONG bieu dien duoc:
         - 1 Cai  = 0,17 Ri -> lam tron thanh 0  => ban ma kho KHONG giam
         - 7 Cai  = 1,17 Ri -> lam tron thanh 1  => tru thieu 1 cai, SAI AM THAM
       Vi vay chan thang tai day va chi cach xu ly, thay vi de lam tron sai so lieu kho. */
    const heSo = so(h.LoaiRi) || 1;
    if (donViChinhLaGop(h) && heSo > 1 && soCai % heSo !== 0) {
      return { loi:
        `Mã ${h.MaHang} đang QUẢN KHO THEO RI (1 Ri = ${heSo} Cái) nên chỉ xuất được bội số của ${heSo} Cái — bạn đang xuất ${soCai} Cái (= ${(soCai / heSo).toFixed(2)} Ri).\n\n`
        + `Muốn bán lẻ theo cái, chuyển mã này sang QUẢN KHO THEO CÁI (số liệu tự nhân ${heSo}, màn hình vẫn hiện quy đổi ra Ri):\n`
        + `    cd D:\\QLSX\\backend\n`
        + `    node utils/sua_don_vi_the_kho.js --ma=${h.MaHang} --den=Cai --quy-doi\n`
        + `    node utils/sua_don_vi_the_kho.js --ma=${h.MaHang} --den=Cai --quy-doi --ghi` };
    }
    if (slChinh <= 0) return { loi: (`Dòng ${h.MaHang}: số lượng quy về đơn vị chính (${h.DonViCoBan || 'Cái'}) = 0.`) };
    const giaBanLe = d.giaBanLe != null && d.giaBanLe !== '' ? so(d.giaBanLe) : so(h.GiaBan);
    const ckShop = d.phanTramCKShop != null && d.phanTramCKShop !== '' ? so(d.phanTramCKShop) : tyLe.shop;
    const giaBan = tien(giaBanLe * (1 - ckShop / 100));
    const heRi = so(h.LoaiRi) || 1;
    dong.push({
      maHangId: Number(d.maHangId), mauSacId: d.mauSacId ? Number(d.mauSacId) : null,
      maHang: h.MaHang, soLuong: so(d.soLuong), donVi, soCai, slChinh, donViCoBan: h.DonViCoBan,
      // cot "DVT QUY DOI" cua mau Word: quy doi nguoc lai sang don vi con lai
      soLuongQuyDoi: heRi > 1 ? (laDonViGop(donVi, h) ? soCai : lam2(soCai / heRi)) : null,
      donViQuyDoi: heRi > 1 ? (laDonViGop(donVi, h) ? (h.DonViCoBan || 'Cái') : (h.DonViQuyDoi || 'Ri')) : null,
      giaBanLe: tien(giaBanLe), ckShop, giaBan, thanhTien: tien(giaBan * soCai),
      /* v6.25.4: 1 dong co the gom NHIEU don (cung khach + ma hang + mau, dat nhieu lan). */
      donIDs: (Array.isArray(d.donIDs) ? d.donIDs : (d.donID ? [d.donID] : []))
        .map(x => parseInt(x, 10)).filter(x => x > 0),
      ghiChu: d.ghiChu || null
    });
    const k = d.maHangId + '|' + d.mauSacId;
    canTru.set(k, (canTru.get(k) || 0) + slChinh);
  }
  // Ton du? (bao loi som cho de hieu; chan that su nam trong ghiXuatKho - UPDATE co dieu kien)
  const thieu = [];
  for (const [k, can] of canTru.entries()) {
    const [mh, ms] = k.split('|');
    const ton = (tonMap.get(mh + '|' + ms) || 0) + ((tonBu && tonBu.get(mh + '|' + ms)) || 0);
    if (can > ton) {
      const h = hangMap.get(Number(mh));
      const dv = h ? (h.DonViCoBan || 'Cái') : 'ĐVT';
      thieu.push(`${h ? h.MaHang : mh}: cần ${can} ${dv}, tồn ${ton} ${dv}`);
    }
  }
  if (thieu.length) {
    return { loi: ('Không đủ tồn kho:\n- ' + thieu.join('\n- ')) };
  }

  /* Các tổng của phiếu — ĐÚNG THỨ TỰ mẫu Word:
     Tổng tiền hàng → CK NPP (%×tổng) → Tổng tiền TT → Thuế GTGT (%×TT) → Tổng sau thuế. */
  const tongTienHang = tien(dong.reduce((s, d) => s + d.thanhTien, 0));
  const tienCKNPP = tien(tongTienHang * ckNPP / 100);
  const tienTruocVAT = tien(tongTienHang - tienCKNPP);
  const tienVAT = tien(tienTruocVAT * vat / 100);
  const tongThanhToan = tien(tienTruocVAT + tienVAT);
  return {
    dong,
    tong: {
      ckNPP, vat, tongTienHang, tienCKNPP, tienTruocVAT, tienVAT, tongThanhToan,
      tongSLCai: dong.reduce((s, d) => s + d.soCai, 0)
    }
  };
}

/* GHI cac dong chi tiet + TRU TON + gan don khach dat. Dung chung boi POST va PUT (trong transaction). */
/* v7.22 (migration_v685): cot NguonDat de phan biet DON THAT cua khach vs DON PHAN CHIEU tu phieu. */
let __coCotNguonDat = null;
async function coCotNguonDat(pool) {
  if (__coCotNguonDat === null) {
    try {
      const r = (await pool.request().query(`SELECT COL_LENGTH('DonKhachDatHang','NguonDat') AS c`)).recordset[0] || {};
      __coCotNguonDat = r.c != null;
    } catch (e) { __coCotNguonDat = false; }
  }
  return __coCotNguonDat;
}
const NGUON_PHIEU_BH = 'PhieuBH';

/* ================================================================================================
   v7.40 SUA LOI: "Invalid column name 'KhachHangID'" khi LUU PHIEU BAN HANG MOI
   ------------------------------------------------------------------------------------------------
   taoDonPhanChieu() (v7.22) chen cot `KhachHangID` vao `DonKhachDatHang`, nhung bang do KHONG CO cot
   nay — khong co trong CREATE TABLE lan bat ky ALTER nao (CAI_DAT_DAY_DU.sql:478). Hai cot khac o
   cung ham thi CO do (`NguonDat`, `DaTruTon`), rieng cot nay bi bo sot.
   Loi chi no khi nguoi lap phieu CHON KHACH TU DANH MUC (`tt.khachHangId` co gia tri) — ban thang
   khong chon danh muc thi nhanh do khong chay, nen no am tham cho den hom nay.
   ⚠️ Cong no khach gom theo TEN KHACH (chuoi), khong theo KhachHangID — nen thieu cot nay KHONG lam
   sai cong no. Vi vay do cot va BO QUA khi thieu la du; khong can them migration.
   ================================================================================================ */
let __coCotKhachHangIDDon = null;
async function coCotKhachHangIDDon(pool) {
  if (__coCotKhachHangIDDon === null) {
    try {
      const r = (await pool.request().query(`SELECT COL_LENGTH('DonKhachDatHang','KhachHangID') AS c`)).recordset[0] || {};
      __coCotKhachHangIDDon = r.c != null;
    } catch (e) { __coCotKhachHangIDDon = false; }
  }
  return __coCotKhachHangIDDon;
}

/* v7.24 (migration_v686 + v687): phieu ban hang co ShopID + NhanVienID (nhan vien kinh doanh) de
   tinh doanh so di tuyen. Do cot truoc vi ban chua chay migration van phai chay binh thuong. */
let __coCotShopNV = null;
async function coCotShopNV(pool) {
  if (__coCotShopNV === null) {
    try {
      const r = (await pool.request().query(`
        SELECT COL_LENGTH('PhieuBanHang','ShopID') AS s, COL_LENGTH('PhieuBanHang','NhanVienID') AS n,
               COL_LENGTH('DonKhachDatHang','ShopID') AS ds, COL_LENGTH('DonKhachDatHang','NhanVienID') AS dn,
               COL_LENGTH('PhieuBanHang','TenShop') AS ts`)).recordset[0] || {};
      __coCotShopNV = { phieu: r.s != null && r.n != null, don: r.ds != null && r.dn != null, tenShop: r.ts != null };
    } catch (e) { __coCotShopNV = { phieu: false, don: false }; }
  }
  return __coCotShopNV;
}

/* KE THUA Shop + Nhan vien kinh doanh TU DON sang PHIEU.
   Vi sao tu dong: nhan vien di tuyen lay don ngoai thi truong, o van phong chi bam "Chuyen sang phieu
   ban hang". Neu bat ke toan go tay lai Shop/Nhan vien thi 9/10 lan bi bo trong -> tab Doanh so mai
   mai bang 0 va khong ai hieu tai sao. Chi ghi khi phieu CHUA co (khong ghi de lua chon tay). */
/* Ghi Shop / Nhan vien kinh doanh CHON TAY tren form phieu ban hang. Gui chuoi rong = XOA lua chon
   (khac null = khong gui gi). */
async function ghiShopNVKD(pool, tran, phieuBHID, b) {
  const co = await coCotShopNV(pool);
  if (!co.phieu) return;
  const coGui = (v) => v !== undefined;
  if (!coGui(b.shopId) && !coGui(b.nhanVienId)) return;
  const rq = new sql.Request(tran).input('p', sql.Int, phieuBHID);
  const dat = [];
  if (coGui(b.shopId)) { rq.input('s', sql.Int, b.shopId === '' || b.shopId === null ? null : b.shopId); dat.push('ShopID = @s'); }
  /* v7.28: SNAPSHOT ten shop ngay luc luu phieu. Nho vay doi ten shop (hoac xoa shop) ve sau khong
     lam sai phieu cu — cung nguyen tac dang dung cho `TenKhach`. */
  if (co.tenShop && coGui(b.shopId)) {
    dat.push(`TenShop = (SELECT s2.MaShop + N' · ' + s2.TenShop FROM ShopBanLe s2 WHERE s2.ShopID = @s)`);
  }
  if (coGui(b.nhanVienId)) { rq.input('n', sql.Int, b.nhanVienId === '' || b.nhanVienId === null ? null : b.nhanVienId); dat.push('NhanVienID = @n'); }
  await rq.query(`UPDATE PhieuBanHang SET ${dat.join(', ')} WHERE PhieuBHID = @p`);
}

async function keThuaShopNVTuDon(pool, tran, phieuBHID, dong) {
  const co = await coCotShopNV(pool);
  if (!co.phieu || !co.don) return;
  const ids = [];
  (dong || []).forEach(d => (d.donIDs || []).forEach(i => ids.push(Number(i))));
  if (!ids.length) return;
  const r = (await new sql.Request(tran).query(`
    SELECT TOP 1 o.ShopID, o.NhanVienID, sh.NhaPhanPhoiID, kh.TenKhachHang AS TenNPP
    FROM DonKhachDatHang o
    LEFT JOIN ShopBanLe sh ON sh.ShopID = o.ShopID
    LEFT JOIN KhachHang kh ON kh.KhachHangID = sh.NhaPhanPhoiID
    WHERE o.DonID IN (${[...new Set(ids)].join(',')}) AND (o.ShopID IS NOT NULL OR o.NhanVienID IS NOT NULL)
    ORDER BY o.DonID`)).recordset[0];
  if (!r) return;
  /* v7.26: shop thuoc NPP nao thi KHACH HANG cua phieu la NPP do — cong no thuoc NPP, shop chi la
     diem giao. Van dung ISNULL: nguoi lap phieu chon tay roi thi TON TRONG lua chon do. */
  await new sql.Request(tran).input('p', sql.Int, phieuBHID)
    .input('s', sql.Int, r.ShopID || null).input('n', sql.Int, r.NhanVienID || null)
    .input('kh', sql.Int, r.NhaPhanPhoiID || null)
    .input('tkh', sql.NVarChar, r.TenNPP || null)
    .query(`UPDATE PhieuBanHang SET ShopID = ISNULL(ShopID, @s), NhanVienID = ISNULL(NhanVienID, @n),
              KhachHangID = ISNULL(KhachHangID, @kh),
              TenKhach = CASE WHEN KhachHangID IS NULL AND @tkh IS NOT NULL THEN @tkh ELSE TenKhach END
              ${co.tenShop ? `, TenShop = ISNULL(TenShop,
                  (SELECT s2.MaShop + N' · ' + s2.TenShop FROM ShopBanLe s2 WHERE s2.ShopID = @s))` : ''}
            WHERE PhieuBHID = @p`);
}

/* v7.22 — LUONG HAI CHIEU: dong phieu KHONG gan don nao thi TU SINH mot dong o Chi tiet dat hang.
   Vi sao: "sua phieu ban hang - them ma moi / doi mau - deu phai ghi vao chi tiet dat hang cua ma
   hang do". Truoc day chi co chieu DON -> PHIEU; ban thang hoac them ma luc sua phieu thi Chi tiet
   dat hang cua ma do trong tron, khong theo doi duoc ai da mua mau nao.
   ⚠️ Don sinh ra o day KHONG duoc tru ton lan hai: dat DaTruTon = 0 va trang thai 'Đã xuất hàng'
   (trang thai nay khong nam trong danh sach "dang giu hang" cua layHangDangGiu) — phieu la chung tu
   tru ton duy nhat, giu dung nguyen tac v6.23. */
async function taoDonPhanChieu(pool, tran, phieuBHID, d, tt) {
  const coNguon = await coCotNguonDat(pool);
  const coDaTru = await coCotDaTruTon(pool);
  const coKhachID = await coCotKhachHangIDDon(pool);   // v7.40: xem ghi chu o coCotKhachHangIDDon
  const cot = ['TenKhach', 'MaHangID', 'MauSacID', 'SoLuongDat', 'DonVi', 'TrangThai', 'PhieuBHID', 'NguoiTaoID'];
  const val = ['@tk', '@mh', '@ms', '@sl', '@dv', "N'Đã xuất hàng'", '@p', '@u'];
  if (coDaTru) { cot.push('DaTruTon'); val.push('0'); }
  if (coNguon) { cot.push('NguonDat'); val.push('@ng'); }
  /* v7.40: chi chen KhachHangID khi bang THAT SU co cot do. Truoc day chi kiem `tt.khachHangId` (co
     gia tri hay khong) ma khong kiem cot co ton tai -> chon khach tu danh muc la vo ca phieu. */
  const chenKhachID = coKhachID && tt.khachHangId;
  if (chenKhachID) { cot.push('KhachHangID'); val.push('@kh'); }
  const rq = new sql.Request(tran)
    .input('tk', sql.NVarChar, String(tt.tenKhach || '').trim())
    .input('mh', sql.Int, d.maHangId)
    .input('ms', sql.Int, d.mauSacId)
    .input('sl', sql.Int, Math.round(Number(d.soLuong) || 0))
    .input('dv', sql.NVarChar, d.donVi || 'Cái')
    .input('p', sql.Int, phieuBHID)
    .input('u', sql.Int, tt.nguoiTaoID || null);
  if (coNguon) rq.input('ng', sql.NVarChar, NGUON_PHIEU_BH);
  if (chenKhachID) rq.input('kh', sql.Int, tt.khachHangId);
  const r = await rq.query(`INSERT INTO DonKhachDatHang (${cot.join(', ')})
                            OUTPUT INSERTED.DonID
                            VALUES (${val.join(', ')})`);
  return r.recordset[0].DonID;
}

async function ghiChiTietPhieu(pool, tran, phieuBHID, dong, coDonIDs, thongTinPhieu) {
  for (const d of dong) {
    /* v7.58 — LƯỚI AN TOÀN: gắn đơn KHÔNG còn tồn tại thì SQL Server ném lỗi khóa ngoại thô
       ("FK__PhieuBanH__DonID__…") — không ai đọc ra được là chuyện gì. Kiểm trước để báo tiếng Việt.
       Đường SỬA phiếu đã lọc sạch id chết ở PUT rồi, nên tới đây mà còn thiếu là dữ liệu thật sự lạ. */
    if ((d.donIDs || []).length) {
      const ids = [...new Set(d.donIDs.map(Number))];
      const coThat = (await new sql.Request(tran).query(
        `SELECT DonID FROM DonKhachDatHang WHERE DonID IN (${ids.join(',')})`)).recordset.map(r => Number(r.DonID));
      const mat = ids.filter(id => coThat.indexOf(id) === -1);
      if (mat.length) {
        throw new Error(`Dòng ${d.maHang}: đơn khách đặt ${mat.map(x => '#' + x).join(', ')} không còn tồn tại `
          + `(đã bị xóa ở màn hình khác). Đóng form, mở lại phiếu rồi chọn đơn lại.`);
      }
    }
    const ctID = (await new sql.Request(tran)
      .input('PhieuBHID', sql.Int, phieuBHID)
      .input('MaHangID', sql.Int, d.maHangId)
      .input('MauSacID', sql.Int, d.mauSacId)
      .input('SoLuong', sql.Decimal(14, 2), d.soLuong)
      .input('DonVi', sql.NVarChar, d.donVi)
      .input('SoLuongCai', sql.Int, d.soCai)
      .input('SoLuongQuyDoi', sql.Decimal(14, 2), d.soLuongQuyDoi)
      .input('DonViQuyDoi', sql.NVarChar, d.donViQuyDoi)
      .input('GiaBanLe', sql.Decimal(14, 2), d.giaBanLe)
      .input('CKShop', sql.Decimal(5, 2), d.ckShop)
      .input('GiaBan', sql.Decimal(14, 2), d.giaBan)
      .input('ThanhTien', sql.Decimal(18, 2), d.thanhTien)
      .input('DonID', sql.Int, d.donIDs[0] || null)
      .input('DonIDs', sql.NVarChar, d.donIDs.length ? d.donIDs.join(',') : null)
      .input('GhiChu', sql.NVarChar, d.ghiChu)
      .query(`INSERT INTO PhieuBanHangChiTiet (PhieuBHID, MaHangID, MauSacID, SoLuong, DonVi, SoLuongCai,
                SoLuongQuyDoi, DonViQuyDoi, GiaBanLe, PhanTramCKShop, GiaBan, ThanhTien, DonID, GhiChu${coDonIDs ? ', DonIDs' : ''})
              OUTPUT INSERTED.ID
              VALUES (@PhieuBHID, @MaHangID, @MauSacID, @SoLuong, @DonVi, @SoLuongCai,
                @SoLuongQuyDoi, @DonViQuyDoi, @GiaBanLe, @CKShop, @GiaBan, @ThanhTien, @DonID, @GhiChu${coDonIDs ? ', @DonIDs' : ''})`)).recordset[0].ID;

    /* v7.22 — CHIEU PHIEU -> DON: dong nay khong xuat phat tu don nao (ban thang, hoac vua THEM MA
       MOI luc sua phieu) thi sinh mot dong o Chi tiet dat hang roi GAN NGUOC lai vao dong phieu.
       Nho vay Chi tiet dat hang cua ma hang do luon tra loi duoc "mau nay ban cho ai, theo phieu nao",
       ke ca hang ban thang khong qua dat hang. */
    let donPhanChieuId = null;   // đơn do CHÍNH chỗ này sinh ra -> vòng "gắn đơn" phải BỎ QUA
    if (!d.donIDs.length && d.mauSacId && thongTinPhieu) {
      const donMoi = await taoDonPhanChieu(pool, tran, phieuBHID, d, thongTinPhieu);
      donPhanChieuId = donMoi;
      d.donIDs = [donMoi];   // để PUT tính "đơn còn gắn" và để cột Phiếu bán hàng dò ra được
      await new sql.Request(tran).input('ct', sql.Int, ctID).input('don', sql.Int, donMoi)
        .query(`UPDATE PhieuBanHangChiTiet SET DonID = @don${coDonIDs ? ', DonIDs = CAST(@don AS NVARCHAR(200))' : ''}
                WHERE ID = @ct`);
      console.warn('[banhang] dong %s (%s) khong co don -> da sinh don phan chieu #%s.', ctID, d.maHang, donMoi);
    }
    /* v7.13 — GO PHAN "DON CU DA TRU TON" TRUOC KHI PHIEU TRU TON (loi TRU HAI LAN).
       Don dat TRUOC v6.23 da tru ton NGAY luc len don (`XuatCai += SL`, co v5.65). Tu v6.23 phieu ban
       hang la duong tru ton duy nhat — nhung truoc day cho nay chi doi TRANG THAI don, khong he go
       phan don da tru. Ket qua: don cu len phieu ban hang = TON BI TRU HAI LAN; va vi don sang
       'Đã xuất hàng' nen no cung thoi duoc tinh la "dang giu" ⇒ khong con duong nao hoan lai.
       Dung la trieu chung "cot Ton thap hon thuc te" ma khong tim ra chung tu nao giai thich.
       ⚠️ PHAI HOAN TRUOC KHI TRU: neu tru truoc thi chinh phan don dang tru lam ton thieu, va
       ghiXuatKho() se nem "Không đủ tồn kho" — phieu khong luu duoc du kho co hang that.
       Go phieu (goChiTietPhieu) tra don ve 'Chờ xử lý' voi DaTruTon = 0 nen don lai giu hang binh
       thuong — khong sinh lo hong nguoc lai. */
    const coDaTru = await coCotDaTruTon(pool);
    const donTruoc = new Map();   // v7.16: giữ bản ghi đơn TRƯỚC khi sửa, dùng lại ở vòng gắn đơn dưới
    for (const donId of d.donIDs) {
      if (donId === donPhanChieuId) continue;   // v7.22: đơn vừa sinh, đã đúng màu/SL, chưa từng trừ tồn
      const donCu = (await new sql.Request(tran).input('don', sql.Int, donId).query(`
        SELECT o.DonID, o.MaHangID, o.MauSacID, o.SoLuongDat, o.DonVi,
               ${coDaTru ? 'ISNULL(o.DaTruTon, 0)' : '0'} AS DaTruTon,
               h.LoaiRi, h.DonViCoBan, h.DonViQuyDoi
        FROM DonKhachDatHang o JOIN TheKhoHangHoa h ON h.MaHangID = o.MaHangID
        WHERE o.DonID = @don`)).recordset[0];
      if (donCu) donTruoc.set(String(donId), donCu);
      if (donCu && Number(donCu.DaTruTon) === 1) {
        const slDon = slSangDonViChinh(donCu.SoLuongDat, donCu.DonVi, donCu.DonViCoBan, donCu.LoaiRi, donCu);
        if (donCu.MauSacID && slDon > 0) await ghiXuatKho(pool, tran, donCu.MaHangID, donCu.MauSacID, -slDon);
        await new sql.Request(tran).input('don', sql.Int, donId)
          .query('UPDATE DonKhachDatHang SET DaTruTon = 0 WHERE DonID = @don');
        console.warn('[banhang] don #%s la don CU (DaTruTon=1): da hoan %s (don vi chinh) truoc khi phieu tru ton.', donId, slDon);
      }
    }
    // TRU TON (duong tru ton DUY NHAT cua he thong) - theo DON VI CHINH, co chan tranh ban vuot ton
    await ghiXuatKho(pool, tran, d.maHangId, d.mauSacId, d.slChinh, `${d.maHang} cần ${d.slChinh} ${d.donViCoBan || 'Cái'}`);
    /* Don khach dat lien ket -> 'Da xuat hang'. Chi nhan don CHUA co phieu va DANG CHO: neu don da
       len phieu khac roi thi rowsAffected = 0 -> throw de quay lui CA phieu (tranh tru ton 2 lan). */
    for (const donId of d.donIDs) {
      /* v7.22: đơn PHẢN CHIẾU do chính hàm này vừa sinh đã ở 'Đã xuất hàng' và gắn phiếu sẵn — chạy
         tiếp câu UPDATE dưới sẽ ra 0 dòng rồi ném lỗi "đã lên phiếu khác", nên phải bỏ qua. */
      if (donId === donPhanChieuId) continue;
      /* v7.16 — ĐỒNG BỘ MÀU CỦA ĐƠN THEO DÒNG PHIẾU.
         Khách đặt màu xanh nhưng thực giao màu đen (hết xanh) thì người dùng sửa MÀU trên phiếu bán
         hàng. Trước đây chỗ này chỉ đổi trạng thái đơn: phiếu ghi đen, tồn trừ đen, nhưng ĐƠN vẫn
         nằm ở màu xanh — Thẻ kho / Lịch sử đặt hàng hiện màu cũ, "sửa phiếu rồi mà không thấy đổi";
         vào sửa đơn để nắn lại thì bị chặn "đã có phiếu bán hàng" = bế tắc, không đường nào sửa.
         Nay phiếu là chứng từ THỰC XUẤT nên đơn phải chạy theo phiếu.
         ⚠️ CHỈ đồng bộ MÀU: mã hàng đổi = đơn khác hẳn (đã chặn ở giao diện), và SỐ LƯỢNG giữ nguyên
         của từng đơn vì một dòng phiếu có thể gộp nhiều đơn — chia lại SL sẽ làm sai đơn gốc. */
      const donGoc = donTruoc.get(String(donId));
      if (d.mauSacId && donGoc && String(donGoc.MauSacID) !== String(d.mauSacId)) {
        await new sql.Request(tran).input('don', sql.Int, donId).input('ms', sql.Int, d.mauSacId)
          .query('UPDATE DonKhachDatHang SET MauSacID = @ms WHERE DonID = @don');
        console.warn('[banhang] don #%s: dong bo mau theo phieu (%s -> %s).', donId, donGoc.MauSacID, d.mauSacId);
      }
      const kq = await new sql.Request(tran).input('don', sql.Int, donId).input('p', sql.Int, phieuBHID)
        .query(`UPDATE DonKhachDatHang SET TrangThai = N'Đã xuất hàng', PhieuBHID = @p
                WHERE DonID = @don AND PhieuBHID IS NULL AND TrangThai IN (N'Chờ xác nhận', N'Chờ xử lý')`);
      if (!kq.rowsAffected[0]) {
        throw new Error(`Đơn khách đặt #${donId} đã được lên phiếu bán hàng khác (hoặc không còn ở trạng thái chờ). Mở lại danh sách đơn và làm lại.`);
      }
    }
  }
}
/* GO 1 phieu: hoan ton theo chi tiet dang co + tra cac don ve 'Cho xu ly' + xoa chi tiet.
   Dung khi SUA phieu (go roi ghi lai) - cung logic voi Huy phieu nen khong the lech nhau.
   v7.17: TRA VE danh sach DonID vua go, de PUT biet don nao KHONG duoc gan lai (dong bi xoa khoi
   phieu) ma bao cho nguoi dung - truoc day don do quay ve 'Chờ xử lý' AM THAM, van GIU hang, nen
   "xoa mau do khoi phieu roi ma chi tiet dat hang van con". */
/* ================================================================================================
   v7.42 SUA LOI: "The DELETE statement conflicted with the REFERENCE constraint
   FK__PhieuBanH__DonID__..., table dbo.PhieuBanHangChiTiet, column 'DonID'"
   ------------------------------------------------------------------------------------------------
   `PhieuBanHangChiTiet.DonID` la KHOA NGOAI tro toi `DonKhachDatHang.DonID`. Tu v7.22, khi xoa/sua
   phieu ta XOA HAN don PHAN CHIEU (`NguonDat = 'PhieuBH'`) — nhung luc do dong PhieuBanHangChiTiet
   VAN CON va DonID cua no van tro toi don dang bi xoa => khoa ngoai chan.
   Hai cho cung mac loi nay, cung mot nguyen nhan la THU TU:
       goChiTietPhieu()      : xoa don (dong 899) TRUOC khi DELETE chi tiet (dong 912)
       DELETE /phieu/:id     : xoa don (dong 1166/1182) TRUOC khi DELETE phieu (chi tiet CASCADE)
   Cach sua: GO `DonID` ve NULL TRUOC khi xoa don. Khong mat gi — ngay sau do chi tiet cung bi xoa
   (PUT xoa tay, DELETE cascade). `DonIDs` la chuoi, khong co khoa ngoai nen khong can go.
   Gom vao MOT ham de hai cho khong the lech nhau.
   ================================================================================================ */
async function goRangBuocDonTrenChiTiet(tran, phieuBHID) {
  await new sql.Request(tran).input('id', sql.Int, phieuBHID)
    .query('UPDATE PhieuBanHangChiTiet SET DonID = NULL WHERE PhieuBHID = @id AND DonID IS NOT NULL');
}

/* ================================================================================================
   v7.58 SUA LOI: "The INSERT statement conflicted with the FOREIGN KEY constraint
   FK__PhieuBanH__DonID__..., table dbo.DonKhachDatHang, column 'DonID'"   (khi SUA phieu, them ma)
   ------------------------------------------------------------------------------------------------
   Anh em ruot cua loi v7.42 (DELETE) nhung o chieu nguoc lai:
     · Dong ban THANG (khong lay tu don khach) duoc v7.22 sinh mot DON PHAN CHIEU va gan DonID vao dong.
     · Man hinh Sua phieu nap lai dong do KEM `DonIDs` -> gui NGUOC len khi luu.
     · PUT: goChiTietPhieu() XOA HAN don phan chieu, roi ghiChiTietPhieu() lai INSERT dong voi DUNG
       DonID vua bi xoa => khoa ngoai chan ngay o cau INSERT dau tien.
   Nghia la: MOI phieu co du chi mot dong ban thang deu KHONG SUA DUOC, bat ke sua gi.
   Cach sua: goChiTietPhieu tra ve DANH SACH DON PHAN CHIEU DA XOA; PUT loai cac id do khoi
   `dong[].donIDs` truoc khi ghi lai. Dong do thanh "khong co don" -> ghiChiTietPhieu tu sinh don phan
   chieu MOI cho no (dung nguyen tac v7.22, khong mat lien ket gi).
   ⚠️ KHONG duoc "sua" bang cach bo khoa ngoai hay bo qua loi: khoa ngoai la thu duy nhat dang chan
   dong phieu tro toi don khong ton tai.
   ================================================================================================ */
async function goChiTietPhieu(pool, tran, phieuBHID, coDonIDs) {
  const dsDonGo = [];
  const dsDonXoa = [];        // v7.58: đơn PHẢN CHIẾU vừa bị xóa -> id này đã CHẾT, không được gắn lại
  const coNguon = await coCotNguonDat(pool);   // v7.22
  const ct = (await new sql.Request(tran).input('id', sql.Int, phieuBHID).query(`
    SELECT ct.MaHangID, ct.MauSacID, ct.SoLuong, ct.DonVi, ct.DonID,
           ${coDonIDs ? 'ct.DonIDs' : "CAST(NULL AS NVARCHAR(200)) AS DonIDs"}, h.LoaiRi, h.DonViCoBan, h.DonViQuyDoi
    FROM PhieuBanHangChiTiet ct JOIN TheKhoHangHoa h ON h.MaHangID = ct.MaHangID
    WHERE ct.PhieuBHID = @id`)).recordset;
  /* v7.42: da doc xong `ct` vao bo nho -> go DonID ngay, truoc khi xoa don phan chieu ben duoi.
     Vong lap vẫn dung `d.DonID`/`d.DonIDs` cua ban da doc nen khong anh huong gi. */
  await goRangBuocDonTrenChiTiet(tran, phieuBHID);
  for (const d of ct) {
    const slChinh = slSangDonViChinh(d.SoLuong, d.DonVi, d.DonViCoBan, d.LoaiRi, d);
    if (d.MauSacID) await ghiXuatKho(pool, tran, d.MaHangID, d.MauSacID, -slChinh);   // HOAN ton
    for (const donId of dsDonCuaDong(d)) {
      /* v7.22 — ĐƠN PHẢN CHIẾU (`NguonDat = 'PhieuBH'`) chỉ là bản ghi phản chiếu của DÒNG PHIẾU:
         dòng mất thì nó phải mất theo, XÓA HẲN. Nếu trả về 'Chờ xử lý' như đơn thật thì nó thành đơn
         treo GIỮ TỒN cho một yêu cầu khách chưa từng có — sai tồn khả dụng và rác danh sách đơn. */
      if (coNguon) {
        const kqXoa = await new sql.Request(tran).input('don', sql.Int, donId).query(
          `DELETE FROM DonKhachDatHang WHERE DonID = @don AND NguonDat = N'${NGUON_PHIEU_BH}'`);
        if (kqXoa.rowsAffected[0]) {
          dsDonXoa.push(Number(donId));   // v7.58
          console.warn('[banhang] go phieu: da XOA don phan chieu #%s (sinh tu chinh phieu nay).', donId);
          continue;
        }
      }
      await new sql.Request(tran).input('don', sql.Int, donId).input('id', sql.Int, phieuBHID)
        .query(`UPDATE DonKhachDatHang SET TrangThai = N'Chờ xử lý', PhieuBHID = NULL
                WHERE DonID = @don AND PhieuBHID = @id`);
      dsDonGo.push(Number(donId));   // chỉ ĐƠN THẬT mới cần báo "đang treo" cho người dùng
    }
  }
  await new sql.Request(tran).input('id', sql.Int, phieuBHID)
    .query('DELETE FROM PhieuBanHangChiTiet WHERE PhieuBHID = @id');
  return { donTreo: dsDonGo, donPhanChieuDaXoa: dsDonXoa };
}

/* v7.17: HUY don khach dat (dung khi nguoi dung xoa dong khoi phieu va chon "hủy luôn đơn").
   Chi huy don DANG CHO va KHONG con gan phieu nao - de khong bao gio huy mat mot don dang duoc phieu
   khac giu. Don cu (DaTruTon = 1) thi hoan ton truoc, dung nguyen tac cua PUT /orders/:id/status. */
async function huyDonKhach(pool, tran, donId) {
  const coDaTru = await coCotDaTruTon(pool);
  const o = (await new sql.Request(tran).input('don', sql.Int, donId).query(`
    SELECT o.DonID, o.MaHangID, o.MauSacID, o.SoLuongDat, o.DonVi, o.TrangThai, o.PhieuBHID,
           ${coDaTru ? 'ISNULL(o.DaTruTon, 0)' : '0'} AS DaTruTon,
           h.LoaiRi, h.DonViCoBan, h.DonViQuyDoi
    FROM DonKhachDatHang o JOIN TheKhoHangHoa h ON h.MaHangID = o.MaHangID
    WHERE o.DonID = @don`)).recordset[0];
  if (!o || o.PhieuBHID) return false;
  if (['Chờ xác nhận', 'Chờ xử lý'].indexOf(String(o.TrangThai)) === -1) return false;
  if (Number(o.DaTruTon) === 1) {
    const sl = slSangDonViChinh(o.SoLuongDat, o.DonVi, o.DonViCoBan, o.LoaiRi, o);
    if (o.MauSacID && sl > 0) await ghiXuatKho(pool, tran, o.MaHangID, o.MauSacID, -sl);
  }
  await new sql.Request(tran).input('don', sql.Int, donId).query(
    `UPDATE DonKhachDatHang SET TrangThai = N'Đã hủy'${coDaTru ? ', DaTruTon = 0' : ''} WHERE DonID = @don`);
  return true;
}

router.post('/phieu', requireAuth, requirePermission('KHOHANG', 'create'), requireChucNang('KHOHANG', CN), async (req, res) => {
  const pool = await getPool();
  const user = req.session.user;
  const kq = await chuanBiPhieu(pool, req.body || {});
  if (kq.loi) return res.status(400).json({ success: false, message: kq.loi });
  const { dong, tong } = kq;
  const b = req.body || {};

  const coDonIDs = await coCotDonIDs(pool);   // v6.25.4
  const coMau = await coCotHangMau(pool);     // v7.59: cot LaHangMau (migration_v693)
  const tran = new sql.Transaction(pool);
  await tran.begin();
  try {
    // Sinh số phiếu TRONG transaction (2 người lưu cùng lúc: người sau sẽ lỗi UNIQUE và rollback sạch).
    const soPhieu = await sinhSoPhieu(new sql.Request(tran), 'PhieuBanHang', 'SoPhieu', 'PX', 'PBH', 3);
    const phieuBHID = (await new sql.Request(tran)
      .input('SoPhieu', sql.NVarChar, soPhieu)
      .input('NgayBan', sql.Date, b.ngayBan || new Date())
      .input('KhachHangID', sql.Int, b.khachHangId || null)
      .input('TenKhach', sql.NVarChar, String(b.tenKhach).trim())
      .input('SDT', sql.NVarChar, b.sdt || null)
      .input('DiaChi', sql.NVarChar, b.diaChi || null)
      .input('CKNPP', sql.Decimal(5, 2), tong.ckNPP)
      .input('VAT', sql.Decimal(5, 2), tong.vat)
      .input('TongTienHang', sql.Decimal(18, 2), tong.tongTienHang)
      .input('TienCKNPP', sql.Decimal(18, 2), tong.tienCKNPP)
      .input('TienTruocVAT', sql.Decimal(18, 2), tong.tienTruocVAT)
      .input('TienVAT', sql.Decimal(18, 2), tong.tienVAT)
      .input('TongThanhToan', sql.Decimal(18, 2), tong.tongThanhToan)
      .input('TongSLCai', sql.Int, tong.tongSLCai)
      .input('GhiChu', sql.NVarChar, b.ghiChu || null)
      .input('NguoiTaoID', sql.Int, user.userId)
      .input('LaHangMau', sql.Bit, coMau ? (b.laHangMau ? 1 : 0) : null)
      .query(`INSERT INTO PhieuBanHang (SoPhieu, NgayBan, KhachHangID, TenKhach, SDT, DiaChi,
                PhanTramCKNPP, PhanTramVAT, TongTienHang, TienCKNPP, TienTruocVAT, TienVAT, TongThanhToan,
                TongSLCai, GhiChu, NguoiTaoID${coMau ? ', LaHangMau' : ''})
              OUTPUT INSERTED.PhieuBHID
              VALUES (@SoPhieu, @NgayBan, @KhachHangID, @TenKhach, @SDT, @DiaChi,
                @CKNPP, @VAT, @TongTienHang, @TienCKNPP, @TienTruocVAT, @TienVAT, @TongThanhToan,
                @TongSLCai, @GhiChu, @NguoiTaoID${coMau ? ', @LaHangMau' : ''})`)).recordset[0].PhieuBHID;
    await ghiChiTietPhieu(pool, tran, phieuBHID, dong, coDonIDs,
      { tenKhach: b.tenKhach, khachHangId: b.khachHangId || null, nguoiTaoID: user.userId });   // v7.22
    await ghiShopNVKD(pool, tran, phieuBHID, b);              // v7.24: chon tay tren form (neu co)
    await keThuaShopNVTuDon(pool, tran, phieuBHID, dong);     // v7.24: hoac ke thua tu don di tuyen
    await tran.commit();
    res.json({ success: true, data: { phieuBHID, soPhieu, tongThanhToan: tong.tongThanhToan } });
  } catch (err) {
    try { await tran.rollback(); } catch (e) { /* transaction co the da ket thuc */ }
    console.error('[banhang POST /phieu] ', err);
    res.status(400).json({ success: false, message: 'Lỗi khi lưu phiếu bán hàng (đã quay lui, dữ liệu giữ nguyên): ' + err.message });
  }
});

/* ---------- SUA phieu (v6.25.5) ----------
   Cach lam: GO phieu cu (hoan ton + tra don ve 'Cho xu ly' + xoa chi tiet) roi GHI LAI theo du lieu moi,
   TAT CA trong 1 transaction. Giu nguyen SoPhieu va PhieuBHID.
   CHAN sua khi: phieu da huy, hoac phieu da co PHIEU THU gan vao (sua tien se lech voi so tien da thu -
   phai xoa phieu thu truoc, giong nhu khi huy phieu). */
router.put('/phieu/:id', requireAuth, requirePermission('KHOHANG', 'edit'), requireChucNang('KHOHANG', CN), async (req, res) => {
  const pool = await getPool();
  const b = req.body || {};
  const p = (await pool.request().input('id', sql.Int, req.params.id)
    .query('SELECT * FROM PhieuBanHang WHERE PhieuBHID=@id')).recordset[0];
  if (!p) return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu bán hàng.' });
  if (p.TrangThai === 'Đã hủy') return res.status(400).json({ success: false, message: 'Phiếu đã hủy — không sửa được. Hãy lập phiếu mới.' });
  const daThu = (await pool.request().input('id', sql.Int, req.params.id)
    .query('SELECT ISNULL(SUM(SoTien),0) AS S FROM PhieuThu WHERE PhieuBHID=@id')).recordset[0].S;
  if (so(daThu) > 0) {
    return res.status(400).json({ success: false, message: `Phiếu này đã có phiếu thu ${Number(daThu).toLocaleString('vi-VN')} đ — xóa phiếu thu đó trước khi sửa phiếu bán hàng.` });
  }

  const coDonIDs = await coCotDonIDs(pool);
  const coMau = await coCotHangMau(pool);     // v7.59
  /* Phần tồn mà CHÍNH phiếu này đang giữ — cộng bù khi kiểm tồn, vì lát nữa hệ thống hoàn nó trước
     rồi mới trừ lại theo số mới. Không cộng bù thì sửa tăng số lượng sẽ bị báo thiếu tồn oan. */
  const ctCu = (await pool.request().input('id', sql.Int, req.params.id).query(`
    SELECT ct.MaHangID, ct.MauSacID, ct.SoLuong, ct.DonVi, h.LoaiRi, h.DonViCoBan, h.DonViQuyDoi
    FROM PhieuBanHangChiTiet ct JOIN TheKhoHangHoa h ON h.MaHangID = ct.MaHangID
    WHERE ct.PhieuBHID = @id`)).recordset;
  const tonBu = new Map();
  ctCu.forEach(d => {
    const k = d.MaHangID + '|' + d.MauSacID;
    tonBu.set(k, (tonBu.get(k) || 0) + slSangDonViChinh(d.SoLuong, d.DonVi, d.DonViCoBan, d.LoaiRi, d));
  });

  /* ⚠️ KIỂM TRA TRƯỚC KHI GỠ. Trước đây gỡ (transaction 1) rồi mới kiểm (transaction 2): chỉ cần nhập
     thiếu tồn là phiếu bị xóa sạch dòng hàng NHƯNG header vẫn giữ nguyên số tiền => công nợ ảo.
     Nay sai dữ liệu thì trả lỗi ngay, KHÔNG đụng gì tới phiếu. */
  const kq = await chuanBiPhieu(pool, b, tonBu);
  if (kq.loi) return res.status(400).json({ success: false, message: kq.loi });
  const { dong, tong } = kq;

  /* Gỡ + ghi lại + cập nhật header trong MỘT transaction duy nhất: các câu đọc/ghi tồn trong cùng
     transaction nhìn thấy phần vừa hoàn (chưa commit) nên `(NhapCai - XuatCai) >= @sl` vẫn đúng. */
  const tran = new sql.Transaction(pool);
  await tran.begin();
  try {
    const { donTreo: dsDonGo, donPhanChieuDaXoa } = await goChiTietPhieu(pool, tran, p.PhieuBHID, coDonIDs);
    /* v7.58 — xem ghi chú dài ở goChiTietPhieu. Đơn phản chiếu vừa bị xóa thì id của nó đã CHẾT:
       giữ lại trong `donIDs` là INSERT vào khóa ngoại đã đứt. Bỏ ra -> dòng thành "không có đơn"
       -> ghiChiTietPhieu sinh đơn phản chiếu MỚI cho đúng số lượng/màu vừa sửa. */
    if (donPhanChieuDaXoa.length) {
      const daChet = new Set(donPhanChieuDaXoa.map(Number));
      dong.forEach(d => { d.donIDs = (d.donIDs || []).filter(id => !daChet.has(Number(id))); });
    }
    await new sql.Request(tran).input('id', sql.Int, p.PhieuBHID)
      .input('NgayBan', sql.Date, b.ngayBan || p.NgayBan)
      .input('KhachHangID', sql.Int, b.khachHangId || null)
      .input('TenKhach', sql.NVarChar, String(b.tenKhach).trim())
      .input('SDT', sql.NVarChar, b.sdt || null)
      .input('DiaChi', sql.NVarChar, b.diaChi || null)
      .input('CKNPP', sql.Decimal(5, 2), tong.ckNPP)
      .input('VAT', sql.Decimal(5, 2), tong.vat)
      .input('TongTienHang', sql.Decimal(18, 2), tong.tongTienHang)
      .input('TienCKNPP', sql.Decimal(18, 2), tong.tienCKNPP)
      .input('TienTruocVAT', sql.Decimal(18, 2), tong.tienTruocVAT)
      .input('TienVAT', sql.Decimal(18, 2), tong.tienVAT)
      .input('TongThanhToan', sql.Decimal(18, 2), tong.tongThanhToan)
      .input('TongSLCai', sql.Int, tong.tongSLCai)
      .input('GhiChu', sql.NVarChar, b.ghiChu || null)
      .input('LaHangMau', sql.Bit, coMau ? (b.laHangMau ? 1 : 0) : null)
      .query(`UPDATE PhieuBanHang SET NgayBan=@NgayBan, KhachHangID=@KhachHangID, TenKhach=@TenKhach,
                SDT=@SDT, DiaChi=@DiaChi, PhanTramCKNPP=@CKNPP, PhanTramVAT=@VAT,
                TongTienHang=@TongTienHang, TienCKNPP=@TienCKNPP, TienTruocVAT=@TienTruocVAT,
                TienVAT=@TienVAT, TongThanhToan=@TongThanhToan, TongSLCai=@TongSLCai, GhiChu=@GhiChu
                ${coMau ? ', LaHangMau=@LaHangMau' : ''}
              WHERE PhieuBHID=@id`);
    await ghiChiTietPhieu(pool, tran, p.PhieuBHID, dong, coDonIDs,
      { tenKhach: b.tenKhach, khachHangId: b.khachHangId || null, nguoiTaoID: (req.session.user || {}).userId });   // v7.22
    await ghiShopNVKD(pool, tran, p.PhieuBHID, b);              // v7.24
    await keThuaShopNVTuDon(pool, tran, p.PhieuBHID, dong);     // v7.24

    /* v7.17 — ĐƠN KHÁCH BỊ BỎ RA KHỎI PHIẾU.
       Xóa một dòng khỏi phiếu thì đơn khách của dòng đó quay về 'Chờ xử lý' (đúng: hàng chưa giao),
       NHƯNG trước đây việc này diễn ra âm thầm: người dùng thấy "đã xóa màu đó khỏi phiếu mà chi tiết
       đặt hàng vẫn còn", và đơn đó tiếp tục GIỮ tồn nên khả dụng không nhả ra.
       Nay: (1) đơn nào người dùng chọn HỦY LUÔN thì hủy tại đây; (2) đơn còn treo thì trả về cho
       frontend để báo rõ ràng, không để người dùng tự phát hiện. */
    const donDaGan = new Set();
    dong.forEach(d => (d.donIDs || []).forEach(id => donDaGan.add(Number(id))));
    const donHuyYeuCau = (Array.isArray(b.donHuy) ? b.donHuy : []).map(x => parseInt(x, 10)).filter(x => x > 0);
    const donDaHuy = [];
    for (const id of donHuyYeuCau) {
      if (donDaGan.has(id)) continue;          // vẫn còn trong phiếu -> không hủy
      if (await huyDonKhach(pool, tran, id)) donDaHuy.push(id);
    }
    const donTreo = [...new Set(dsDonGo)].filter(id => !donDaGan.has(id) && donDaHuy.indexOf(id) === -1);

    await tran.commit();
    res.json({ success: true, data: {
      phieuBHID: p.PhieuBHID, soPhieu: p.SoPhieu, tongThanhToan: tong.tongThanhToan,
      donTreo, donDaHuy
    } });
  } catch (err) {
    try { await tran.rollback(); } catch (e) { /* transaction co the da ket thuc */ }
    console.error('[banhang PUT /phieu] ', err);
    res.status(400).json({ success: false, message: 'Lỗi khi sửa phiếu (đã QUAY LUI toàn bộ, phiếu giữ nguyên như trước): ' + err.message });
  }
});

/* ---------- HUY phieu (hoan ton, don ve 'Cho xu ly') ---------- */
router.put('/phieu/:id/huy', requireAuth, requirePermission('KHOHANG', 'edit'), requireChucNang('KHOHANG', CN), async (req, res) => {
  const pool = await getPool();
  const p = (await pool.request().input('id', sql.Int, req.params.id)
    .query('SELECT * FROM PhieuBanHang WHERE PhieuBHID=@id')).recordset[0];
  if (!p) return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu.' });
  if (p.TrangThai === 'Đã hủy') return res.status(400).json({ success: false, message: 'Phiếu này đã hủy trước đó.' });
  const daThu = (await pool.request().input('id', sql.Int, req.params.id)
    .query('SELECT ISNULL(SUM(SoTien),0) AS S FROM PhieuThu WHERE PhieuBHID=@id')).recordset[0].S;
  if (so(daThu) > 0) {
    return res.status(400).json({ success: false, message: `Phiếu này đã có phiếu thu ${Number(daThu).toLocaleString('vi-VN')} đ — xóa phiếu thu đó trước khi hủy phiếu bán hàng.` });
  }
  /* HOAN TON theo DON VI CHINH - phai quy lai tu SoLuong+DonVi cua dong (SoLuongCai la so CAI, dung
     cho tien; dung no de hoan se hoan gap LoaiRi lan voi hang don vi chinh = Ri). */
  const coDonIDs = await coCotDonIDs(pool);
  const coNguonDatHuy = await coCotNguonDat(pool);   // v7.22
  const ct = (await pool.request().input('id', sql.Int, req.params.id).query(`
    SELECT ct.MaHangID, ct.MauSacID, ct.SoLuong, ct.DonVi, ct.DonID, ${coDonIDs ? 'ct.DonIDs' : "CAST(NULL AS NVARCHAR(200)) AS DonIDs"}, h.LoaiRi, h.DonViCoBan, h.DonViQuyDoi
    FROM PhieuBanHangChiTiet ct JOIN TheKhoHangHoa h ON h.MaHangID = ct.MaHangID
    WHERE ct.PhieuBHID=@id`)).recordset;

  const tran = new sql.Transaction(pool);
  await tran.begin();
  try {
    for (const d of ct) {
      const slChinh = slSangDonViChinh(d.SoLuong, d.DonVi, d.DonViCoBan, d.LoaiRi, d);
      if (d.MauSacID) await ghiXuatKho(pool, tran, d.MaHangID, d.MauSacID, -slChinh);   // HOAN ton
      for (const donId of dsDonCuaDong(d)) {
        /* v7.22: ĐƠN PHẢN CHIẾU -> chuyển 'Đã hủy' (giữ dấu vết cùng phiếu đã hủy), TUYỆT ĐỐI không
           để về 'Chờ xử lý' vì trạng thái đó GIỮ TỒN cho một yêu cầu khách chưa từng có. */
        if (coNguonDatHuy) {
          const kq = await new sql.Request(tran).input('don', sql.Int, donId).query(
            `UPDATE DonKhachDatHang SET TrangThai = N'Đã hủy' WHERE DonID = @don AND NguonDat = N'${NGUON_PHIEU_BH}'`);
          if (kq.rowsAffected[0]) continue;
        }
        // `AND PhieuBHID = @id`: don co the da duoc len phieu KHAC sau khi phieu nay bi huy.
        await new sql.Request(tran).input('don', sql.Int, donId).input('id', sql.Int, req.params.id)
          .query(`UPDATE DonKhachDatHang SET TrangThai = N'Chờ xử lý', PhieuBHID = NULL
                  WHERE DonID = @don AND PhieuBHID = @id`);
      }
    }
    await new sql.Request(tran).input('id', sql.Int, req.params.id)
      .query(`UPDATE PhieuBanHang SET TrangThai = N'Đã hủy' WHERE PhieuBHID = @id`);
    await tran.commit();
    res.json({ success: true });
  } catch (err) {
    try { await tran.rollback(); } catch (e) { /* transaction co the da ket thuc */ }
    res.status(400).json({ success: false, message: 'Lỗi khi hủy phiếu (đã quay lui): ' + err.message });
  }
});

/* ---------- XOA phieu (hoan ton neu con hieu luc, roi xoa han) ---------- */
router.delete('/phieu/:id', requireAuth, requirePermission('KHOHANG', 'delete'), requireChucNang('KHOHANG', CN), async (req, res) => {
  const pool = await getPool();
  const p = (await pool.request().input('id', sql.Int, req.params.id)
    .query('SELECT * FROM PhieuBanHang WHERE PhieuBHID=@id')).recordset[0];
  if (!p) return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu.' });
  const daThu = (await pool.request().input('id', sql.Int, req.params.id)
    .query('SELECT COUNT(*) AS C FROM PhieuThu WHERE PhieuBHID=@id')).recordset[0].C;
  if (daThu > 0) return res.status(400).json({ success: false, message: 'Phiếu này đang có phiếu thu liên kết — xóa phiếu thu trước.' });
  const coDonIDs = await coCotDonIDs(pool);
  const coNguonDatXoa = await coCotNguonDat(pool);   // v7.22
  const ct = (await pool.request().input('id', sql.Int, req.params.id).query(`
    SELECT ct.MaHangID, ct.MauSacID, ct.SoLuong, ct.DonVi, ct.DonID, ${coDonIDs ? 'ct.DonIDs' : "CAST(NULL AS NVARCHAR(200)) AS DonIDs"}, h.LoaiRi, h.DonViCoBan, h.DonViQuyDoi
    FROM PhieuBanHangChiTiet ct JOIN TheKhoHangHoa h ON h.MaHangID = ct.MaHangID
    WHERE ct.PhieuBHID=@id`)).recordset;

  const tran = new sql.Transaction(pool);
  await tran.begin();
  try {
    /* v7.42: GO `PhieuBanHangChiTiet.DonID` VE NULL NGAY DAU — moi lenh xoa don phan chieu ben duoi
       deu bi khoa ngoai chan neu con dong chi tiet tro toi. `ct` da doc TRUOC transaction nen vong
       lap ben duoi van co du DonID/DonIDs de xu ly. Xem ghi chu o goRangBuocDonTrenChiTiet. */
    await goRangBuocDonTrenChiTiet(tran, req.params.id);
    /* Phiếu ĐÃ HỦY: tồn đã hoàn và đơn đã được đưa về 'Chờ xử lý' ngay lúc hủy — KHÔNG làm lại gì cả.
       (Làm lại sẽ hoàn tồn lần 2, và tệ hơn: reset mất liên kết của phiếu MỚI nếu đơn đó đã lên phiếu khác.) */
    if (p.TrangThai !== 'Đã hủy') {
      for (const d of ct) {
        const slChinh = slSangDonViChinh(d.SoLuong, d.DonVi, d.DonViCoBan, d.LoaiRi, d);
        if (d.MauSacID) await ghiXuatKho(pool, tran, d.MaHangID, d.MauSacID, -slChinh);
        for (const donId of dsDonCuaDong(d)) {
          /* v7.22: XOA phieu -> XOA luon don PHAN CHIEU (no chi la ban ghi phan chieu cua dong phieu). */
          if (coNguonDatXoa) {
            const kq = await new sql.Request(tran).input('don', sql.Int, donId).query(
              `DELETE FROM DonKhachDatHang WHERE DonID = @don AND NguonDat = N'${'PhieuBH'}'`);
            if (kq.rowsAffected[0]) continue;
          }
          await new sql.Request(tran).input('don', sql.Int, donId).input('id', sql.Int, req.params.id)
            .query(`UPDATE DonKhachDatHang SET TrangThai = N'Chờ xử lý', PhieuBHID = NULL
                    WHERE DonID = @don AND PhieuBHID = @id`);
        }
      }
    }
    /* v7.22 — DỌN SẠCH THAM CHIẾU TRƯỚC KHI XÓA PHIẾU (chạy cho MỌI phiếu, kể cả phiếu đã hủy):
         · đơn PHẢN CHIẾU của phiếu này -> XÓA (nó chỉ là bản ghi phản chiếu, không phải yêu cầu khách)
         · đơn THẬT còn trỏ tới phiếu   -> gỡ cờ PhieuBHID
       Không dọn thì khóa ngoại `DonKhachDatHang.PhieuBHID` chặn câu DELETE, người dùng chỉ thấy lỗi
       "REFERENCE constraint" không hiểu vì sao. */
    if (coNguonDatXoa) {
      await new sql.Request(tran).input('id', sql.Int, req.params.id).query(
        `DELETE FROM DonKhachDatHang WHERE PhieuBHID = @id AND NguonDat = N'${NGUON_PHIEU_BH}'`);
    }
    await new sql.Request(tran).input('id', sql.Int, req.params.id)
      .query('UPDATE DonKhachDatHang SET PhieuBHID = NULL WHERE PhieuBHID = @id');
    await new sql.Request(tran).input('id', sql.Int, req.params.id)
      .query('DELETE FROM PhieuBanHang WHERE PhieuBHID=@id');   // chi tiet CASCADE
    await tran.commit();
    res.json({ success: true });
  } catch (err) {
    try { await tran.rollback(); } catch (e) { /* transaction co the da ket thuc */ }
    res.status(400).json({ success: false, message: 'Lỗi khi xóa phiếu (đã quay lui): ' + err.message });
  }
});

/* ================================================================================================
   LAY DON KHACH DAT DE LEN PHIEU  (nut "Chuyen sang phieu ban hang")
   GET /donchoxuat?khach=<ten>   -> cac don dang giu cua khach do (chua co phieu ban hang)
   ================================================================================================ */
router.get('/donchoxuat', requireAuth, requirePermission('KHOHANG', 'view'), requireChucNang('KHOHANG', CN), async (req, res) => {
  const pool = await getPool();
  const rq = pool.request();
  let dieuKien = `o.TrangThai IN (N'Chờ xác nhận', N'Chờ xử lý') AND o.PhieuBHID IS NULL`;
  if (req.query.khach) { rq.input('k', sql.NVarChar, req.query.khach); dieuKien += ' AND o.TenKhach = @k'; }
  if (req.query.ids) {   // THÊM điều kiện, không thay thế (kẻo mất lọc trạng thái + PhieuBHID IS NULL)
    const ids = String(req.query.ids).split(',').map(x => parseInt(x, 10)).filter(x => x > 0);
    if (ids.length) dieuKien += ` AND o.DonID IN (${ids.join(',')})`;
  }
  /* v7.26: don lay tu DI TUYEN mang them SHOP + NHAN VIEN. Phieu ban hang phai xuat cho NHA PHAN
     PHOI quan ly shop do (cong no thuoc NPP; shop chi la diem giao), va gan doanh so cho nhan vien
     lay don — ca hai tu dien, khong bat nguoi lap phieu chon lai.
     Do cot/bang truoc: ban CSDL chua chay migration_v686/v687 van len phieu binh thuong. */
  const coDMS = (await pool.request().query(`
    SELECT COL_LENGTH('DonKhachDatHang','ShopID') AS s, COL_LENGTH('DonKhachDatHang','NhanVienID') AS n,
           OBJECT_ID('ShopBanLe') AS b`)).recordset[0];
  const coShop = coDMS.s != null && coDMS.n != null && coDMS.b != null;
  const coTenShopDon = (await pool.request().query(
    `SELECT COL_LENGTH('DonKhachDatHang','TenShop') AS c`)).recordset[0].c != null;
  const rows = (await rq.query(`
    SELECT o.DonID, o.ThoiGian, o.TenKhach, o.MaHangID, o.MauSacID, o.SoLuongDat, o.DonVi, o.TrangThai,
           h.MaHang, h.TenHang, h.GiaBan, h.LoaiRi, h.DonViCoBan, h.DonViQuyDoi, h.AnhDaiDien, ms.TenMau,
           ISNULL((SELECT SUM(t.TonCai) FROM vw_TonTheoMau t
                   WHERE t.MaHangID = o.MaHangID AND t.MauSacID = o.MauSacID), 0) AS TonCai
           ${/* v7.28: shop da bi XOA thi sh.* la NULL -> lay ten da luu tren don (snapshot TenShop). */''}
           ${coShop ? `, o.ShopID, o.NhanVienID, sh.MaShop,
             ISNULL(sh.TenShop, ${coTenShopDon ? 'o.TenShop' : 'NULL'}) AS TenShop, sh.DiaChi AS DiaChiShop,
             sh.NhaPhanPhoiID, kh.TenKhachHang AS TenNPP, kh.SDT AS SDTNPP, kh.DiaChi AS DiaChiNPP,
             nv.HoTen AS TenNhanVien` : ''}
    FROM DonKhachDatHang o
    JOIN TheKhoHangHoa h ON h.MaHangID = o.MaHangID
    LEFT JOIN MauSac ms ON ms.MauSacID = o.MauSacID
    ${coShop ? `LEFT JOIN ShopBanLe sh ON sh.ShopID = o.ShopID
    LEFT JOIN KhachHang kh ON kh.KhachHangID = sh.NhaPhanPhoiID
    LEFT JOIN NhanVien  nv ON nv.NhanVienID  = o.NhanVienID` : ''}
    WHERE ${dieuKien}
    ORDER BY o.ThoiGian DESC, o.DonID DESC`)).recordset;
  res.json({ success: true, data: rows, tyLe: await layTyLeCK(pool) });
});

module.exports = router;
module.exports.layHangDangGiu = layHangDangGiu;
module.exports.slSangCai = slSangCai;
