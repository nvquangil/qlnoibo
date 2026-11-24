/* ================================================================================================
   HÀNG KÝ GỬI  (v9.75 — Nguyen 17/11/2026)
   "Xuất hàng ký gửi cho khách theo nguyên giá; hợp đồng chiết khấu 12% trên số khách bán được; khách
    thanh toán tự trừ 12%. ~30 khách, mỗi khách nhiều mặt hàng. Khách báo bán theo KỲ (bảng kê cuối tháng);
    % CK theo KHÁCH."

   NGHIỆP VỤ (VAS — hàng gửi bán TK 157 VẪN LÀ TỒN KHO của mình):
     1. XUẤT KÝ GỬI  (PhieuKyGui)     : không doanh thu, không công nợ, KHÔNG trừ XuatCai. Chỉ làm bớt KHẢ DỤNG
                                        (utils/kyGuiDangGiu cắm vào banhang.layHangDangGiu).
     2. BÁO BÁN KỲ   (POST /baoban)   : sinh PHIẾU BÁN HÀNG THẬT qua banhang.taoPhieuBanHang — trừ tồn, công nợ,
                                        doanh thu, lãi y như mọi phiếu; CK NPP = % ký gửi của khách ⇒ nợ = giá × (1 − 12%)
                                        = đúng số khách trả. Mỗi dòng mang KyGuiCTID ⇒ "đã báo bán".
     3. TRẢ VỀ       (PhieuKyGuiTra)  : khách trả hàng CHƯA bán — chỉ giảm "còn ở khách". Không chứng từ kho
                                        (hàng chưa bao giờ rời sổ tồn). Hàng ĐÃ bán mà trả thì đi Phiếu nhập lại như thường.
     Còn ở khách = SoLuongCai − Σ báo bán (phiếu chưa hủy) − Σ trả (phiếu chưa hủy)  — MỘT công thức ở utils/kyGuiDangGiu.
   ⇒ Công nợ / sổ kế toán / báo cáo KD / dashboard KHÔNG đọc bảng mới ⇒ đúng theo cấu trúc, không phải nhớ lọc.
   Giới hạn cố ý: báo cáo tồn kho hiện TỒN gồm cả hàng đang ở khách (đúng kế toán); "tại kho" = tồn − khả dụng bị giữ.
   ================================================================================================ */
const express = require('express');
const { sql, getPool } = require('../db');
const { requireAuth, requirePermission, requireChucNang } = require('../middleware/auth');
const { sinhSoPhieu, slSangDonViChinh } = require('../utils/banHangCommon');
const { coBangKyGui, dongKyGuiOKhach } = require('../utils/kyGuiDangGiu');
const banhang = require('./banhang');

const router = express.Router();
['get', 'post', 'put', 'delete'].forEach(method => {
  const goc = router[method].bind(router);
  router[method] = (path, ...handlers) => goc(path, ...handlers.map(h => (
    h.length >= 4 ? h : (req, res, next) => Promise.resolve(h(req, res, next)).catch(next)
  )));
});

const CN = 'kygui';   // ChucNang KHOHANG/kygui — key trùng tab ở module.khohang.js getTabs()
const so = (v) => { const n = Number(v); return isFinite(n) ? n : 0; };
const tien = (v) => Math.round(so(v));
const ten = (v) => String(v == null ? '' : v).trim();
const loi400 = (res, m) => res.status(400).json({ success: false, message: m });

async function canBang(pool, res) {
  if (await coBangKyGui(pool)) return true;
  res.status(400).json({ success: false, message: 'Chưa chạy database/migration_v901.sql — chưa có bảng hàng ký gửi. Chạy migration rồi pm2 restart.' });
  return false;
}
async function coCotCKKhach(pool) {
  return (await pool.request().query("SELECT COL_LENGTH('KhachHang','PhanTramCKKyGui') AS c")).recordset[0].c != null;
}

/* ---------- danh mục cho form ---------- */
router.get('/danhmuc', requireAuth, requirePermission('KHOHANG', 'view'), requireChucNang('KHOHANG', CN), async (req, res) => {
  const pool = await getPool();
  const coCK = await coCotCKKhach(pool);
  const [khach, hang] = await Promise.all([
    pool.request().query(`SELECT KhachHangID, TenKhachHang, SDT, DiaChi, ${coCK ? 'PhanTramCKKyGui' : 'CAST(NULL AS DECIMAL(5,2)) AS PhanTramCKKyGui'} FROM KhachHang ORDER BY TenKhachHang`).then(r => r.recordset),
    pool.request().query(`SELECT MaHangID, MaHang, TenHang, GiaBan, LoaiRi, DonViCoBan, DonViQuyDoi, AnhDaiDien FROM TheKhoHangHoa ORDER BY MaHang`).then(r => r.recordset)
  ]);
  res.json({ success: true, data: { khach, hang, coCotCKKhach: coCK } });
});
/* Màu + tồn + khả dụng của MỘT mã — chọn mã xong mới gọi (danh mục màu toàn kho quá lớn để nạp sẵn). */
router.get('/mau', requireAuth, requirePermission('KHOHANG', 'view'), requireChucNang('KHOHANG', CN), async (req, res) => {
  const pool = await getPool();
  const maHangId = parseInt(req.query.maHangId, 10);
  if (!maHangId) return loi400(res, 'Thiếu maHangId.');
  const rows = (await pool.request().input('id', sql.Int, maHangId).query(`
    SELECT t.MauSacID, ms.TenMau, ms.MaMau, t.TonCai FROM vw_TonTheoMau t JOIN MauSac ms ON ms.MauSacID = t.MauSacID
    WHERE t.MaHangID = @id ORDER BY ms.TenMau`)).recordset;
  const giu = await banhang.layHangDangGiu(pool);
  rows.forEach(r => { r.DangGiu = giu.theoMau.get(maHangId + '|' + r.MauSacID) || 0; r.KhaDung = so(r.TonCai) - r.DangGiu; });
  res.json({ success: true, data: rows });
});

/* ---------- SỔ KÝ GỬI Ở KHÁCH ---------- */
router.get('/okhach', requireAuth, requirePermission('KHOHANG', 'view'), requireChucNang('KHOHANG', CN), async (req, res) => {
  const pool = await getPool();
  if (!(await canBang(pool, res))) return;
  const rows = await dongKyGuiOKhach(pool, sql, { tenKhach: ten(req.query.tenKhach) || null, tatCa: req.query.tatCa === '1' });
  /* tổng hợp theo khách: gửi / đã bán / đã trả / còn / giá trị còn (nguyên giá) */
  const theoKhach = new Map();
  rows.forEach(r => {
    const k = ten(r.TenKhach);
    if (!theoKhach.has(k)) theoKhach.set(k, { TenKhach: k, KhachHangID: r.KhachHangID, PhanTramCK: r.PhanTramCK, SoPhieu: new Set(), GuiCai: 0, DaBaoBanCai: 0, DaTraCai: 0, ConCai: 0, GiaTriCon: 0 });
    const o = theoKhach.get(k);
    o.SoPhieu.add(r.PhieuKGID); o.GuiCai += so(r.SoLuongCai); o.DaBaoBanCai += so(r.DaBaoBanCai); o.DaTraCai += so(r.DaTraCai);
    o.ConCai += so(r.ConCai); o.GiaTriCon += tien(so(r.ConCai) * so(r.GiaBanLe));
  });
  const tongHop = [...theoKhach.values()].map(o => Object.assign(o, { SoPhieu: o.SoPhieu.size }));
  res.json({ success: true, data: { rows, tongHop } });
});

/* ---------- PHIẾU XUẤT KÝ GỬI ---------- */
router.get('/phieu', requireAuth, requirePermission('KHOHANG', 'view'), requireChucNang('KHOHANG', CN), async (req, res) => {
  const pool = await getPool();
  if (!(await canBang(pool, res))) return;
  const rows = (await pool.request().query(`
    SELECT p.PhieuKGID, p.SoPhieu, CONVERT(varchar(10), p.Ngay, 23) AS Ngay, p.TenKhach, p.KhachHangID, p.PhanTramCK, p.GhiChu, p.TrangThai,
           u.HoTen AS NguoiTao, CONVERT(varchar(19), p.CreatedAt, 120) AS CreatedAt,
           ISNULL((SELECT SUM(c.SoLuongCai) FROM PhieuKyGuiChiTiet c WHERE c.PhieuKGID = p.PhieuKGID), 0) AS TongCai,
           ISNULL((SELECT SUM(c.SoLuongCai * c.GiaBanLe) FROM PhieuKyGuiChiTiet c WHERE c.PhieuKGID = p.PhieuKGID), 0) AS GiaTri
    FROM PhieuKyGui p LEFT JOIN Users u ON u.UserID = p.NguoiTaoID
    ORDER BY p.Ngay DESC, p.PhieuKGID DESC`)).recordset;
  res.json({ success: true, data: rows });
});
router.get('/phieu/:id', requireAuth, requirePermission('KHOHANG', 'view'), requireChucNang('KHOHANG', CN), async (req, res) => {
  const pool = await getPool();
  if (!(await canBang(pool, res))) return;
  const header = (await pool.request().input('id', sql.Int, req.params.id).query(`
    SELECT p.*, CONVERT(varchar(10), p.Ngay, 23) AS NgayChuoi, u.HoTen AS NguoiTao
    FROM PhieuKyGui p LEFT JOIN Users u ON u.UserID = p.NguoiTaoID WHERE p.PhieuKGID = @id`)).recordset[0];
  if (!header) return res.status(404).json({ success: false, message: 'Không có phiếu ký gửi này.' });
  header.Ngay = header.NgayChuoi; delete header.NgayChuoi;
  const chiTiet = await dongKyGuiOKhach(pool, sql, { phieuKGID: header.PhieuKGID, tatCa: true });
  header.LyDoKhongSua = header.TrangThai === 'Đã hủy' ? 'Phiếu đã hủy.'
    : (chiTiet.some(c => so(c.DaBaoBanCai) > 0 || so(c.DaTraCai) > 0)
      ? 'Phiếu đã có dòng báo bán / trả về — sửa sẽ làm lệch số còn ở khách. Hủy các phiếu báo bán / trả liên quan trước, hoặc lập phiếu mới.'
      : null);
  res.json({ success: true, data: { header, chiTiet } });
});

/* Chuẩn hóa dòng form: { maHangId, mauSacId, soCai, giaBanLe, ghiChu } — bắt buộc màu, SL cái nguyên dương. */
async function chuanHoaDong(pool, b) {
  const dong = (Array.isArray(b.dong) ? b.dong : []).filter(d => d && d.maHangId && so(d.soCai) > 0);
  if (!dong.length) return { loi: 'Phiếu chưa có dòng hàng nào (mã hàng + màu + số cái).' };
  if (dong.some(d => !d.mauSacId)) return { loi: 'Có dòng chưa chọn MÀU — kho quản theo màu.' };
  const ids = [...new Set(dong.map(d => parseInt(d.maHangId, 10)).filter(x => x > 0))];
  const hang = new Map((await pool.request().query(`SELECT MaHangID, MaHang, GiaBan FROM TheKhoHangHoa WHERE MaHangID IN (${ids.join(',')})`)).recordset.map(h => [h.MaHangID, h]));
  const ra = [];
  for (const d of dong) {
    const h = hang.get(Number(d.maHangId));
    if (!h) return { loi: 'Mã hàng không tồn tại (ID ' + d.maHangId + ').' };
    if (!Number.isInteger(Number(d.soCai)) || Number(d.soCai) <= 0) return { loi: `Dòng ${h.MaHang}: số cái phải là số nguyên dương.` };
    ra.push({ maHangId: Number(d.maHangId), mauSacId: Number(d.mauSacId), soCai: Number(d.soCai),
      giaBanLe: tien(d.giaBanLe != null && d.giaBanLe !== '' ? d.giaBanLe : h.GiaBan), ghiChu: ten(d.ghiChu).slice(0, 255) || null, maHang: h.MaHang });
  }
  return { dong: ra };
}
async function ghiDongKyGui(tran, phieuKGID, dong) {
  for (const d of dong) {
    await new sql.Request(tran).input('p', sql.Int, phieuKGID).input('mh', sql.Int, d.maHangId).input('ms', sql.Int, d.mauSacId)
      .input('sl', sql.Int, d.soCai).input('gia', sql.Decimal(14, 2), d.giaBanLe).input('gc', sql.NVarChar(255), d.ghiChu)
      .query('INSERT INTO PhieuKyGuiChiTiet (PhieuKGID, MaHangID, MauSacID, SoLuongCai, GiaBanLe, GhiChu) VALUES (@p, @mh, @ms, @sl, @gia, @gc)');
  }
}
/* Khả dụng: ký gửi KHÔNG trừ tồn nhưng không được gửi quá số đang có ở kho (tồn − đang giữ, cộng lại phần của chính
   phiếu đang sửa). So theo ĐƠN VỊ CHÍNH của mã (Ri hay Cái) — tồn và "đang giữ" đều ở đơn vị đó (bẫy Ri: v8.31/48/52). */
async function kiemKhaDung(pool, dong, boPhieuKGID) {
  const giu = await banhang.layHangDangGiu(pool);
  const ids = [...new Set(dong.map(d => d.maHangId))];
  const hang = new Map((await pool.request().query(`SELECT MaHangID, LoaiRi, DonViCoBan, DonViQuyDoi FROM TheKhoHangHoa WHERE MaHangID IN (${ids.join(',')})`)).recordset.map(h => [h.MaHangID, h]));
  const chinh = (maHangId, soCai) => { const h = hang.get(Number(maHangId)) || {}; return slSangDonViChinh(soCai, 'Cái', h.DonViCoBan, h.LoaiRi, h); };
  const cuaPhieu = new Map();
  if (boPhieuKGID) (await dongKyGuiOKhach(pool, sql, { phieuKGID: boPhieuKGID, tatCa: true })).forEach(r => {
    const k = r.MaHangID + '|' + r.MauSacID; cuaPhieu.set(k, (cuaPhieu.get(k) || 0) + chinh(r.MaHangID, so(r.ConCai)));
  });
  const ton = new Map((await pool.request().query(`SELECT MaHangID, MauSacID, TonCai FROM vw_TonTheoMau WHERE MaHangID IN (${ids.join(',')})`)).recordset.map(r => [r.MaHangID + '|' + r.MauSacID, so(r.TonCai)]));
  const can = new Map();
  dong.forEach(d => { const k = d.maHangId + '|' + d.mauSacId; can.set(k, (can.get(k) || 0) + chinh(d.maHangId, d.soCai)); });
  const thieu = [];
  for (const [k, sl] of can.entries()) {
    const khaDung = (ton.get(k) || 0) - (giu.theoMau.get(k) || 0) + (cuaPhieu.get(k) || 0);
    if (sl > khaDung) {
      const d = dong.find(x => x.maHangId + '|' + x.mauSacId === k), h = hang.get(Number(d.maHangId)) || {};
      thieu.push(`${d.maHang}: cần ${sl} ${h.DonViCoBan || 'Cái'}, khả dụng ${khaDung} ${h.DonViCoBan || 'Cái'}`);
    }
  }
  return thieu.length ? 'Không đủ hàng khả dụng (tồn − đang giữ bởi đơn khách / ký gửi khác):\n- ' + thieu.join('\n- ') : null;
}
router.post('/phieu', requireAuth, requirePermission('KHOHANG', 'create'), requireChucNang('KHOHANG', CN), async (req, res) => {
  const pool = await getPool();
  if (!(await canBang(pool, res))) return;
  const b = req.body || {};
  if (!ten(b.tenKhach)) return loi400(res, 'Chưa chọn khách hàng.');
  const kq = await chuanHoaDong(pool, b);
  if (kq.loi) return loi400(res, kq.loi);
  const thieu = await kiemKhaDung(pool, kq.dong, null);
  if (thieu) return loi400(res, thieu);
  const tran = new sql.Transaction(pool); await tran.begin();
  try {
    const soPhieu = await sinhSoPhieu(new sql.Request(tran), 'PhieuKyGui', 'SoPhieu', 'KG', null, 4);
    const id = (await new sql.Request(tran).input('so', sql.NVarChar(30), soPhieu).input('ngay', sql.Date, b.ngay || new Date())
      .input('kh', sql.Int, b.khachHangId || null).input('ten', sql.NVarChar(150), ten(b.tenKhach)).input('ck', sql.Decimal(5, 2), so(b.phanTramCK))
      .input('gc', sql.NVarChar(500), ten(b.ghiChu) || null).input('u', sql.Int, req.session.user.userId)
      .query(`INSERT INTO PhieuKyGui (SoPhieu, Ngay, KhachHangID, TenKhach, PhanTramCK, GhiChu, NguoiTaoID)
              OUTPUT INSERTED.PhieuKGID VALUES (@so, @ngay, @kh, @ten, @ck, @gc, @u)`)).recordset[0].PhieuKGID;
    await ghiDongKyGui(tran, id, kq.dong);
    await tran.commit();
    res.json({ success: true, data: { phieuKGID: id, soPhieu } });
  } catch (e) { try { await tran.rollback(); } catch (_) { /* đã kết thúc */ } throw e; }
});
router.put('/phieu/:id', requireAuth, requirePermission('KHOHANG', 'edit'), requireChucNang('KHOHANG', CN), async (req, res) => {
  const pool = await getPool();
  if (!(await canBang(pool, res))) return;
  const id = parseInt(req.params.id, 10);
  const cu = (await pool.request().input('id', sql.Int, id).query('SELECT TrangThai FROM PhieuKyGui WHERE PhieuKGID = @id')).recordset[0];
  if (!cu) return res.status(404).json({ success: false, message: 'Không có phiếu.' });
  if (cu.TrangThai === 'Đã hủy') return loi400(res, 'Phiếu đã hủy — không sửa được.');
  const dongCu = await dongKyGuiOKhach(pool, sql, { phieuKGID: id, tatCa: true });
  if (dongCu.some(c => so(c.DaBaoBanCai) > 0 || so(c.DaTraCai) > 0)) return loi400(res, 'Phiếu đã có báo bán / trả về — không sửa được (hủy các phiếu đó trước, hoặc lập phiếu mới).');
  const b = req.body || {};
  if (!ten(b.tenKhach)) return loi400(res, 'Chưa chọn khách hàng.');
  const kq = await chuanHoaDong(pool, b);
  if (kq.loi) return loi400(res, kq.loi);
  const thieu = await kiemKhaDung(pool, kq.dong, id);
  if (thieu) return loi400(res, thieu);
  const tran = new sql.Transaction(pool); await tran.begin();
  try {
    await new sql.Request(tran).input('id', sql.Int, id).input('ngay', sql.Date, b.ngay || new Date())
      .input('kh', sql.Int, b.khachHangId || null).input('ten', sql.NVarChar(150), ten(b.tenKhach)).input('ck', sql.Decimal(5, 2), so(b.phanTramCK))
      .input('gc', sql.NVarChar(500), ten(b.ghiChu) || null).input('u', sql.Int, req.session.user.userId)
      .query('UPDATE PhieuKyGui SET Ngay=@ngay, KhachHangID=@kh, TenKhach=@ten, PhanTramCK=@ck, GhiChu=@gc, NguoiSuaID=@u, UpdatedAt=SYSDATETIME() WHERE PhieuKGID=@id');
    await new sql.Request(tran).input('id', sql.Int, id).query('DELETE FROM PhieuKyGuiChiTiet WHERE PhieuKGID = @id');
    await ghiDongKyGui(tran, id, kq.dong);
    await tran.commit();
    res.json({ success: true });
  } catch (e) { try { await tran.rollback(); } catch (_) { /* đã kết thúc */ } throw e; }
});
router.put('/phieu/:id/huy', requireAuth, requirePermission('KHOHANG', 'delete'), requireChucNang('KHOHANG', CN), async (req, res) => {
  const pool = await getPool();
  if (!(await canBang(pool, res))) return;
  const id = parseInt(req.params.id, 10);
  const dongCu = await dongKyGuiOKhach(pool, sql, { phieuKGID: id, tatCa: true });
  if (!dongCu.length) return res.status(404).json({ success: false, message: 'Không có phiếu.' });
  if (dongCu.some(c => so(c.DaBaoBanCai) > 0 || so(c.DaTraCai) > 0)) return loi400(res, 'Phiếu đã có báo bán / trả về — hủy các phiếu đó trước.');
  await pool.request().input('id', sql.Int, id).input('u', sql.Int, req.session.user.userId)
    .query("UPDATE PhieuKyGui SET TrangThai = N'Đã hủy', NguoiSuaID=@u, UpdatedAt=SYSDATETIME() WHERE PhieuKGID = @id");
  res.json({ success: true });
});

/* ---------- BÁO BÁN KỲ ⇒ phiếu bán hàng thật ----------
   body: { tenKhach, khachHangId, ngayBan, phanTramCKNPP, phanTramVAT?, ghiChu, dong: [{ kyGuiCTID, soCai }] }
   Mỗi dòng bán = đúng mã/màu/nguyên giá của dòng ký gửi; SL ≤ còn ở khách. CK NPP áp cả phiếu (= % ký gửi khách). */
router.post('/baoban', requireAuth, requirePermission('KHOHANG', 'create'), requireChucNang('KHOHANG', CN), async (req, res) => {
  const pool = await getPool();
  if (!(await canBang(pool, res))) return;
  const b = req.body || {};
  const tenKhach = ten(b.tenKhach);
  if (!tenKhach) return loi400(res, 'Chưa chọn khách hàng.');
  const vao = (Array.isArray(b.dong) ? b.dong : []).filter(d => d && d.kyGuiCTID && so(d.soCai) > 0);
  if (!vao.length) return loi400(res, 'Chưa nhập số bán cho dòng nào.');
  const con = new Map((await dongKyGuiOKhach(pool, sql, { tenKhach, tatCa: true })).map(r => [Number(r.KyGuiCTID), r]));
  const dongBan = [];
  for (const d of vao) {
    const r = con.get(Number(d.kyGuiCTID));
    if (!r) return loi400(res, `Dòng ký gửi #${d.kyGuiCTID} không thuộc khách "${tenKhach}" hoặc không tồn tại.`);
    if (!Number.isInteger(Number(d.soCai))) return loi400(res, `${r.MaHang}: số bán phải là số nguyên.`);
    if (Number(d.soCai) > so(r.ConCai)) return loi400(res, `${r.MaHang} (${r.TenMau || ''}): báo bán ${d.soCai} nhưng còn ở khách chỉ ${r.ConCai}.`);
    dongBan.push({ maHangId: r.MaHangID, mauSacId: r.MauSacID, soLuong: Number(d.soCai), donVi: 'Cái', giaBanLe: so(r.GiaBanLe),
      phanTramCKShop: 0,   // nguyên giá; CK ký gửi áp ở mức phiếu (CK NPP)
      kyGuiCTID: Number(d.kyGuiCTID), ghiChu: `Ký gửi ${r.SoPhieu}` });
  }
  const ckMacDinh = con.size ? so([...con.values()][0].PhanTramCK) : 0;
  const body = {
    tenKhach, khachHangId: b.khachHangId || null, ngayBan: b.ngayBan || new Date(),
    phanTramCKNPP: b.phanTramCKNPP != null && b.phanTramCKNPP !== '' ? so(b.phanTramCKNPP) : ckMacDinh,
    phanTramVAT: b.phanTramVAT, ghiChu: (ten(b.ghiChu) ? ten(b.ghiChu) + ' — ' : '') + 'Báo bán hàng ký gửi', dong: dongBan
  };
  try {
    const kq = await banhang.taoPhieuBanHang(pool, req.session.user, body);
    if (kq.loi) return loi400(res, kq.loi);
    res.json({ success: true, data: kq });
  } catch (e) { return loi400(res, e.message); }
});

/* ---------- TRẢ VỀ (hàng chưa bán) ---------- */
router.get('/tra', requireAuth, requirePermission('KHOHANG', 'view'), requireChucNang('KHOHANG', CN), async (req, res) => {
  const pool = await getPool();
  if (!(await canBang(pool, res))) return;
  const rows = (await pool.request().query(`
    SELECT t.PhieuKGTID, t.SoPhieu, CONVERT(varchar(10), t.Ngay, 23) AS Ngay, t.TenKhach, t.GhiChu, t.TrangThai, u.HoTen AS NguoiTao,
           ISNULL((SELECT SUM(c.SoLuongCai) FROM PhieuKyGuiTraChiTiet c WHERE c.PhieuKGTID = t.PhieuKGTID), 0) AS TongCai
    FROM PhieuKyGuiTra t LEFT JOIN Users u ON u.UserID = t.NguoiTaoID ORDER BY t.Ngay DESC, t.PhieuKGTID DESC`)).recordset;
  res.json({ success: true, data: rows });
});
router.get('/tra/:id', requireAuth, requirePermission('KHOHANG', 'view'), requireChucNang('KHOHANG', CN), async (req, res) => {
  const pool = await getPool();
  if (!(await canBang(pool, res))) return;
  const header = (await pool.request().input('id', sql.Int, req.params.id).query(`
    SELECT t.*, CONVERT(varchar(10), t.Ngay, 23) AS NgayChuoi, u.HoTen AS NguoiTao FROM PhieuKyGuiTra t LEFT JOIN Users u ON u.UserID = t.NguoiTaoID WHERE t.PhieuKGTID = @id`)).recordset[0];
  if (!header) return res.status(404).json({ success: false, message: 'Không có phiếu trả.' });
  header.Ngay = header.NgayChuoi; delete header.NgayChuoi;
  const chiTiet = (await pool.request().input('id', sql.Int, req.params.id).query(`
    SELECT c.ID, c.KyGuiCTID, c.SoLuongCai, p.SoPhieu AS SoPhieuKG, h.MaHang, h.TenHang, ms.TenMau, kc.GiaBanLe
    FROM PhieuKyGuiTraChiTiet c JOIN PhieuKyGuiChiTiet kc ON kc.ID = c.KyGuiCTID JOIN PhieuKyGui p ON p.PhieuKGID = kc.PhieuKGID
    JOIN TheKhoHangHoa h ON h.MaHangID = kc.MaHangID LEFT JOIN MauSac ms ON ms.MauSacID = kc.MauSacID
    WHERE c.PhieuKGTID = @id ORDER BY c.ID`)).recordset;
  res.json({ success: true, data: { header, chiTiet } });
});
router.post('/tra', requireAuth, requirePermission('KHOHANG', 'create'), requireChucNang('KHOHANG', CN), async (req, res) => {
  const pool = await getPool();
  if (!(await canBang(pool, res))) return;
  const b = req.body || {};
  const tenKhach = ten(b.tenKhach);
  if (!tenKhach) return loi400(res, 'Chưa chọn khách hàng.');
  const vao = (Array.isArray(b.dong) ? b.dong : []).filter(d => d && d.kyGuiCTID && so(d.soCai) > 0);
  if (!vao.length) return loi400(res, 'Chưa nhập số trả cho dòng nào.');
  const con = new Map((await dongKyGuiOKhach(pool, sql, { tenKhach, tatCa: true })).map(r => [Number(r.KyGuiCTID), r]));
  for (const d of vao) {
    const r = con.get(Number(d.kyGuiCTID));
    if (!r) return loi400(res, `Dòng ký gửi #${d.kyGuiCTID} không thuộc khách "${tenKhach}".`);
    if (!Number.isInteger(Number(d.soCai))) return loi400(res, `${r.MaHang}: số trả phải là số nguyên.`);
    if (Number(d.soCai) > so(r.ConCai)) return loi400(res, `${r.MaHang} (${r.TenMau || ''}): trả ${d.soCai} nhưng còn ở khách chỉ ${r.ConCai}.`);
  }
  const tran = new sql.Transaction(pool); await tran.begin();
  try {
    const soPhieu = await sinhSoPhieu(new sql.Request(tran), 'PhieuKyGuiTra', 'SoPhieu', 'KT', null, 4);
    const id = (await new sql.Request(tran).input('so', sql.NVarChar(30), soPhieu).input('ngay', sql.Date, b.ngay || new Date())
      .input('kh', sql.Int, b.khachHangId || null).input('ten', sql.NVarChar(150), tenKhach).input('gc', sql.NVarChar(500), ten(b.ghiChu) || null)
      .input('u', sql.Int, req.session.user.userId)
      .query('INSERT INTO PhieuKyGuiTra (SoPhieu, Ngay, KhachHangID, TenKhach, GhiChu, NguoiTaoID) OUTPUT INSERTED.PhieuKGTID VALUES (@so, @ngay, @kh, @ten, @gc, @u)')).recordset[0].PhieuKGTID;
    for (const d of vao) {
      await new sql.Request(tran).input('p', sql.Int, id).input('ct', sql.Int, Number(d.kyGuiCTID)).input('sl', sql.Int, Number(d.soCai))
        .query('INSERT INTO PhieuKyGuiTraChiTiet (PhieuKGTID, KyGuiCTID, SoLuongCai) VALUES (@p, @ct, @sl)');
    }
    await tran.commit();
    res.json({ success: true, data: { phieuKGTID: id, soPhieu } });
  } catch (e) { try { await tran.rollback(); } catch (_) { /* đã kết thúc */ } throw e; }
});
router.put('/tra/:id/huy', requireAuth, requirePermission('KHOHANG', 'delete'), requireChucNang('KHOHANG', CN), async (req, res) => {
  const pool = await getPool();
  if (!(await canBang(pool, res))) return;
  const r = await pool.request().input('id', sql.Int, req.params.id).query("UPDATE PhieuKyGuiTra SET TrangThai = N'Đã hủy' WHERE PhieuKGTID = @id AND TrangThai <> N'Đã hủy'");
  if (!r.rowsAffected[0]) return res.status(404).json({ success: false, message: 'Không có phiếu trả (hoặc đã hủy).' });
  res.json({ success: true });
});

module.exports = router;
