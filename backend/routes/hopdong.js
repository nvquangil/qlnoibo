/* ==================================================================================================
   v9.61 — HỢP ĐỒNG MUA BÁN (phân hệ HOPDONG, nội bộ) — Nguyen 14/11/2026.
   --------------------------------------------------------------------------------------------------
   Quyền: requirePermission('HOPDONG', …) + requireChucNang('HOPDONG', 'danhsach' | 'mau' | 'cauhinh').
   Ký số phía MOYN bằng tay (ký lại / công cụ / tải lên) = NĂNG LỰC 'kyso' (ChucNang.MacDinhCho = 0 — phải tick):
   kiểm bằng coQuyenChucNang() trong handler (không có dòng cấu hình = KHÔNG có quyền).
   Nghiệp vụ nằm ở utils/hopDongCore.js (dùng chung với routes/publicKy.js). Route này chỉ gác + gọi + trả.
   ================================================================================================== */
'use strict';
const express = require('express');
const multer = require('multer');
const { sql, getPool } = require('../db');
const { requireAuth, requirePermission, requireChucNang, coQuyenChucNang } = require('../middleware/auth');
const { layIP } = require('../utils/chongDoMatKhau');
const core = require('../utils/hopDongCore');
const pdfU = require('../utils/hopDongPdf');
const kySo = require('../utils/kySoPdf');
const kiemCK = require('../utils/kiemChuKySo');
const gui = require('../utils/guiOtp');
const nhatKy = require('../utils/nhatKyHopDong');
const kyTuXa = require('../utils/kyTuXa');        // v9.62: ký từ xa qua CA (SmartCA / CSC)
const chuoiTinCay = require('../utils/chuoiTinCay'); // v9.62: chuỗi tin cậy + CRL
const nhacHanKy = require('../utils/nhacHanKy');   // v9.62: nhắc hạn ký
const { locMauAnToan } = require('./hrm');

const router = express.Router();
const upPdf = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
const upMau = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const G = (action, cn) => [requireAuth, requirePermission('HOPDONG', action), requireChucNang('HOPDONG', cn)];
const ctxCua = (req) => ({ ip: layIP(req), ua: req.headers['user-agent'], userId: req.session.user.userId });
const loi = (res, e, ma) => { console.error('[hopdong]', e); res.status(ma || 400).json({ success: false, message: e && e.message ? e.message : String(e) }); };
const nn = (v, n) => (v == null ? null : String(v).trim().slice(0, n || 255)) || null;
const soHopLe = (v) => { const x = Number(v); return isNaN(x) ? 0 : x; };
const MA_MAU_RE = /^[A-Za-z0-9_]{2,50}$/;

async function coBang(pool) {
  const r = (await pool.request().query("SELECT OBJECT_ID('HopDongMB') AS a, OBJECT_ID('MauHopDongMB') AS b")).recordset[0] || {};
  return r.a != null && r.b != null;
}

/* ================================================================ MẪU HỢP ĐỒNG ================================================================ */
router.get('/mau', ...G('view', 'mau'), async (req, res) => {
  try {
    const pool = await getPool();
    if (!await coBang(pool)) return res.json({ success: true, data: [], chuaCaiDat: true });
    const rows = (await pool.request().query(`SELECT m.MaMau, m.TenMau, m.NoiDung, m.PhienBan, CONVERT(varchar(19), m.CapNhatLuc, 120) AS CapNhatLuc, u.HoTen AS NguoiSua
      FROM MauHopDongMB m LEFT JOIN Users u ON u.UserID = m.NguoiSuaID ORDER BY m.TenMau`)).recordset;
    rows.forEach(r => { r.Bien = pdfU.timBien(r.NoiDung); });
    res.json({ success: true, data: rows, bienChuan: pdfU.BIEN_CHUAN });
  } catch (e) { loi(res, e, 500); }
});
router.get('/mau/:ma/lichsu', ...G('view', 'mau'), async (req, res) => {
  try {
    const pool = await getPool();
    const rows = (await pool.request().input('m', sql.NVarChar, String(req.params.ma)).query(`
      SELECT TOP (30) ls.LichSuID, ls.PhienBan, ls.NoiDung, CONVERT(varchar(19), ls.CapNhatLuc, 120) AS CapNhatLuc, u.HoTen AS NguoiSua
      FROM MauHopDongMB_LichSu ls LEFT JOIN Users u ON u.UserID = ls.NguoiSuaID WHERE ls.MaMau=@m ORDER BY ls.LichSuID DESC`)).recordset;
    res.json({ success: true, data: rows });
  } catch (e) { loi(res, e, 500); }
});
/* Lưu mẫu (tạo mới / ghi đè): bản cũ đẩy vào lịch sử (giữ 10). Nội dung qua locMauAnToan (danh sách trắng, routes/hrm.js). */
router.put('/mau/:ma', ...G('edit', 'mau'), async (req, res) => {
  try {
    const pool = await getPool();
    const ma = String(req.params.ma || '').trim();
    if (!MA_MAU_RE.test(ma)) return res.status(400).json({ success: false, message: 'Mã mẫu chỉ gồm chữ, số, gạch dưới (2–50 ký tự).' });
    const noiDung = locMauAnToan(String((req.body || {}).noiDung || ''));
    if (noiDung.length > 400000) return res.status(400).json({ success: false, message: 'Mẫu quá dài (giới hạn 400.000 ký tự).' });
    if (!noiDung.replace(/<[^>]*>/g, '').trim()) return res.status(400).json({ success: false, message: 'Nội dung mẫu đang trống.' });
    const tenMau = nn((req.body || {}).tenMau, 150) || ma;
    const cu = await core.docMau(pool, ma);
    if (cu) {
      await pool.request().input('m', sql.NVarChar, ma).input('nd', sql.NVarChar(sql.MAX), cu.NoiDung).input('pb', sql.Int, cu.PhienBan).input('ng', sql.Int, req.session.user.userId)
        .query('INSERT INTO MauHopDongMB_LichSu (MaMau, NoiDung, PhienBan, NguoiSuaID) VALUES (@m, @nd, @pb, @ng)');
      await pool.request().input('m', sql.NVarChar, ma).query(`DELETE FROM MauHopDongMB_LichSu WHERE MaMau=@m AND LichSuID NOT IN (SELECT TOP (10) LichSuID FROM MauHopDongMB_LichSu WHERE MaMau=@m ORDER BY LichSuID DESC)`);
    }
    const pb = (cu ? cu.PhienBan : 0) + 1;
    await pool.request().input('m', sql.NVarChar, ma).input('ten', sql.NVarChar(150), tenMau).input('nd', sql.NVarChar(sql.MAX), noiDung).input('pb', sql.Int, pb).input('ng', sql.Int, req.session.user.userId)
      .query(`MERGE MauHopDongMB AS t USING (SELECT @m AS MaMau) AS s ON t.MaMau = s.MaMau
              WHEN MATCHED THEN UPDATE SET TenMau=@ten, NoiDung=@nd, PhienBan=@pb, NguoiSuaID=@ng, CapNhatLuc=SYSDATETIME()
              WHEN NOT MATCHED THEN INSERT (MaMau, TenMau, NoiDung, PhienBan, NguoiSuaID) VALUES (@m, @ten, @nd, @pb, @ng);`);
    res.json({ success: true, data: { MaMau: ma, PhienBan: pb, Bien: pdfU.timBien(noiDung) } });
  } catch (e) { loi(res, e); }
});
router.delete('/mau/:ma', ...G('delete', 'mau'), async (req, res) => {
  try {
    const pool = await getPool();
    const ma = String(req.params.ma || '').trim();
    const dung = (await pool.request().input('m', sql.NVarChar, ma).query("SELECT COUNT(*) AS n FROM HopDongMB WHERE MaMau=@m AND TrangThai NOT IN (N'Huy')")).recordset[0];
    if (dung && dung.n) return res.status(409).json({ success: false, message: `Mẫu đang được ${dung.n} hợp đồng dùng — không xóa. Sửa nội dung thì bấm Sửa.` });
    const cu = await core.docMau(pool, ma);
    if (cu) await pool.request().input('m', sql.NVarChar, ma).input('nd', sql.NVarChar(sql.MAX), cu.NoiDung).input('pb', sql.Int, cu.PhienBan).input('ng', sql.Int, req.session.user.userId)
      .query('INSERT INTO MauHopDongMB_LichSu (MaMau, NoiDung, PhienBan, NguoiSuaID) VALUES (@m, @nd, @pb, @ng)');
    await pool.request().input('m', sql.NVarChar, ma).query('DELETE FROM MauHopDongMB WHERE MaMau=@m');
    res.json({ success: true });
  } catch (e) { loi(res, e); }
});
/* Tải file mẫu lên (.docx → HTML bằng mammoth; .html/.htm đọc thẳng) — trả HTML để người dùng xem/sửa rồi bấm Lưu. */
router.post('/mau/tai-len', ...G('edit', 'mau'), upMau.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Không nhận được file.' });
    const ten = String(req.file.originalname || '').toLowerCase();
    let html = '', canhBao = [];
    if (ten.endsWith('.docx')) {
      let mammoth;
      try { mammoth = require('mammoth'); } catch (e) { return res.status(400).json({ success: false, message: 'Máy chủ chưa cài thư viện đọc Word: cd backend && npm install mammoth' }); }
      const r = await mammoth.convertToHtml({ buffer: req.file.buffer });
      html = r.value || '';
      canhBao = (r.messages || []).map(m => m.message).slice(0, 10);
    } else if (ten.endsWith('.html') || ten.endsWith('.htm')) {
      html = req.file.buffer.toString('utf8');
    } else return res.status(400).json({ success: false, message: 'Chỉ nhận .docx hoặc .html. File .doc cũ: mở bằng Word, Lưu dạng .docx.' });
    const sach = locMauAnToan(html);
    res.json({ success: true, data: { html: sach, bien: pdfU.timBien(sach), canhBao } });
  } catch (e) { loi(res, e); }
});

/* ================================================================ CẤU HÌNH KÝ ================================================================ */
router.get('/cauhinh', ...G('view', 'cauhinh'), async (req, res) => {
  try {
    const pool = await getPool();
    const cfg = await core.docCauHinhKy(pool);
    const ky = kySo.cauHinh();
    const tx = kyTuXa.cauHinh();
    let goc = { ds: [], loi: [] };
    try { goc = chuoiTinCay.docChungThuGoc(); } catch (e) { goc = { ds: [], loi: [e.message] }; }
    res.json({ success: true, data: cfg, heThong: {
      kyTuDong: ky.loai, tsaUrl: ky.tsaUrl, tsaCongCong: ky.tsaCongCong, kenh: gui.kenhSanSang(), publicBaseUrl: process.env.PUBLIC_BASE_URL || '',
      pfx: ky.loai === 'pfx' ? { duongDan: ky.pfxPath } : null, pkcs11: ky.loai === 'pkcs11' ? { dll: ky.dll, slot: ky.slot, serial: ky.certSerial } : null,
      kyTuXa: { san: tx.san, nha: tx.nha, tenHienThi: tx.tenHienThi, baseUrl: tx.baseUrl, nhanUserId: tx.nhanUserId },   // v9.62
      chungThuGoc: { thuMuc: chuoiTinCay.THU_MUC_GOC, ds: goc.ds.map(x => ({ file: x.file, CN: x.tt.CN, nguoiCap: x.tt.nguoiCap, denNgay: x.tt.denNgay })), loi: goc.loi },
      v894: await core.coV894(pool)
    } });
  } catch (e) { loi(res, e, 500); }
});
router.put('/cauhinh', ...G('edit', 'cauhinh'), async (req, res) => {
  try {
    const pool = await getPool();
    const b = req.body || {};
    if (b.hanLinkNgay != null && (Number(b.hanLinkNgay) < 1 || Number(b.hanLinkNgay) > 90)) return res.status(400).json({ success: false, message: 'Hạn link 1–90 ngày.' });
    if (b.emailKeToan && !gui.emailHopLe(b.emailKeToan)) return res.status(400).json({ success: false, message: 'Email kế toán không hợp lệ.' });
    const luu = await core.luuCauHinhKy(pool, b);
    nhacHanKy.schedule().catch(() => {});   // v9.62: đổi giờ nhắc có hiệu lực ngay
    res.json({ success: true, data: luu });
  } catch (e) { loi(res, e); }
});
/* v9.62: chạy nhắc hạn ngay (không đợi giờ) — để thử. */
router.post('/cauhinh/nhac-ngay', ...G('edit', 'cauhinh'), async (req, res) => {
  try { const pool = await getPool(); const kq = await nhacHanKy.chay(pool); res.json({ success: true, data: kq, message: `Đã chạy: ${kq.hetHan} hết hạn, ${kq.nhac} nhắc${kq.loi.length ? ' — lỗi: ' + kq.loi.join('; ') : ''}` }); }
  catch (e) { loi(res, e); }
});
/* Kiểm bộ ký tự động: đọc chứng thư (PFX / token) — KHÔNG ký gì. PKCS#11 KHÔNG đăng nhập (không đụng PIN). */
router.post('/cauhinh/kiem-bo-ky', ...G('view', 'cauhinh'), async (req, res) => {
  try {
    const cfg = kySo.cauHinh();
    if (cfg.loai === 'tat') return res.json({ success: true, data: { loai: 'tat', ghiChu: 'Ký tự động đang TẮT (HOPDONG_KY_TU_DONG trống). Sau khi khách ký, người có quyền "kyso" ký bằng công cụ MOYN Ký số hoặc tải bản đã ký lên.' } });
    const boKy = kySo.boKyTuDong();
    const tt = boKy.thongTin;
    try { boKy.dong && boKy.dong(); } catch (e) { /* bỏ */ }
    res.json({ success: true, data: { loai: cfg.loai, chungThu: tt, canhBao: tt && tt.denNgay && new Date(tt.denNgay) < new Date() ? 'Chứng thư ĐÃ HẾT HẠN' : null } });
  } catch (e) { res.json({ success: true, data: { loai: kySo.cauHinh().loai, loi: e.message } }); }
});
/* Ký thử một PDF bất kỳ bằng bộ ký tự động — trả file đã ký (kiểm bằng Adobe Reader). Năng lực kyso. */
router.post('/cauhinh/ky-thu', ...G('edit', 'cauhinh'), upPdf.single('file'), async (req, res) => {
  try {
    if (!coQuyenChucNang(req.session.user, 'HOPDONG', 'kyso')) return res.status(403).json({ success: false, message: 'Cần năng lực HOPDONG/kyso (Quản trị → Phân quyền → tick "Ký số phía MOYN").' });
    if (!req.file || req.file.buffer.slice(0, 5).toString('latin1') !== '%PDF-') return res.status(400).json({ success: false, message: 'Chọn một file PDF.' });
    const kq = await kySo.kyTuDong(req.file.buffer, { lyDo: 'Ký thử', viTri: 'Việt Nam' });
    if (!kq) return res.status(400).json({ success: false, message: 'Ký tự động đang TẮT.' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="ky_thu.pdf"');
    res.setHeader('X-TSA', kq.tsa && kq.tsa.ok ? 'ok' : 'khong');
    res.end(kq.pdf);
  } catch (e) { loi(res, e); }
});

/* ================================================================ KHÁCH HÀNG (điền bên mua) ================================================================ */
router.get('/khach', ...G('view', 'danhsach'), async (req, res) => {
  try {
    const pool = await getPool();
    const rows = (await pool.request().query(`SELECT KhachHangID, TenKhachHang, TenHoaDon, MaSoThue, DiaChi, DiaChiHoaDon, SDT, Email, EmailHoaDon,
      LoaiDoiTac, NguoiDaiDien, ChucVuNDD, SoCCCD, SoDKKD, CONVERT(varchar(10), NgayCapDKKD, 23) AS NgayCapDKKD, NoiCapDKKD, SDTNguoiKy, EmailNguoiKy
      FROM KhachHang ORDER BY TenKhachHang`)).recordset;
    res.json({ success: true, data: rows });
  } catch (e) { loi(res, e, 500); }
});
/* Lưu thông tin bên mua vào Danh mục khách (chỉ các cột hợp đồng + hóa đơn) — không đụng tên/địa chỉ gốc. */
router.put('/khach/:id', ...G('edit', 'danhsach'), async (req, res) => {
  try {
    const pool = await getPool();
    const b = req.body || {};
    await pool.request().input('id', sql.Int, Number(req.params.id))
      .input('loai', sql.NVarChar(10), ['CongTy', 'HoKD', 'CaNhan'].includes(b.LoaiDoiTac) ? b.LoaiDoiTac : null)
      .input('ndd', sql.NVarChar(150), nn(b.NguoiDaiDien, 150)).input('cv', sql.NVarChar(100), nn(b.ChucVu, 100)).input('cccd', sql.NVarChar(20), nn(b.CCCD, 20))
      .input('dkkd', sql.NVarChar(50), nn(b.SoDKKD, 50)).input('ngay', sql.Date, b.NgayCapDKKD || null).input('noi', sql.NVarChar(150), nn(b.NoiCapDKKD, 150))
      .input('sdt', sql.NVarChar(30), nn(b.SDT, 30)).input('email', sql.NVarChar(150), nn(b.Email, 150))
      .input('ten', sql.NVarChar(255), nn(b.Ten, 255)).input('dc', sql.NVarChar(255), nn(b.DiaChi, 255)).input('mst', sql.NVarChar(30), nn(b.MST, 30))
      .query(`UPDATE KhachHang SET LoaiDoiTac=@loai, NguoiDaiDien=@ndd, ChucVuNDD=@cv, SoCCCD=@cccd, SoDKKD=@dkkd, NgayCapDKKD=@ngay, NoiCapDKKD=@noi,
              SDTNguoiKy=@sdt, EmailNguoiKy=@email, TenHoaDon=ISNULL(@ten, TenHoaDon), DiaChiHoaDon=ISNULL(@dc, DiaChiHoaDon), MaSoThue=ISNULL(@mst, MaSoThue) WHERE KhachHangID=@id`);
    res.json({ success: true });
  } catch (e) { loi(res, e); }
});

/* ================================================================ HỢP ĐỒNG ================================================================ */
router.get('/', ...G('view', 'danhsach'), async (req, res) => {
  try {
    const pool = await getPool();
    if (!await coBang(pool)) return res.json({ success: true, data: [], dem: {}, chuaCaiDat: true });
    await core.danhDauHetHan(pool);
    const q = req.query || {};
    const dk = [], r = pool.request();
    if (q.trangThai) { const ds = String(q.trangThai).split(',').map(s => s.trim()).filter(s => core.TRANG_THAI.includes(s)); if (ds.length) dk.push(`h.TrangThai IN (${ds.map(s => `N'${s}'`).join(',')})`); }
    if (q.thanhToan && ['ChuaTT', 'MotPhan', 'DaTT'].includes(q.thanhToan)) { r.input('tt', sql.NVarChar(10), q.thanhToan); dk.push('h.TrangThaiThanhToan=@tt'); }
    if (q.khachHangId) { r.input('kh', sql.Int, Number(q.khachHangId)); dk.push('h.KhachHangID=@kh'); }
    if (q.tu) { r.input('tu', sql.Date, q.tu); dk.push('CAST(h.CreatedAt AS DATE) >= @tu'); }
    if (q.den) { r.input('den', sql.Date, q.den); dk.push('CAST(h.CreatedAt AS DATE) <= @den'); }
    if (q.q) { r.input('q', sql.NVarChar(200), '%' + String(q.q).trim() + '%'); dk.push('(h.SoHopDong LIKE @q OR h.TenHopDong LIKE @q OR h.BenMuaJson LIKE @q OR kh.TenKhachHang LIKE @q)'); }
    const v894 = await core.coV894(pool);
    if (v894 && q.loaiVanBan && ['HopDong', 'PhuLuc', 'ThanhLy'].includes(q.loaiVanBan)) { r.input('lvb', sql.NVarChar(10), q.loaiVanBan); dk.push('h.LoaiVanBan=@lvb'); }
    const rows = (await r.query(`SELECT TOP (500) h.HopDongMBID, h.SoHopDong, h.TenHopDong, h.KhachHangID, kh.TenKhachHang, h.Nguon, h.MaMau, h.TongTien, h.TrangThai, h.TrangThaiThanhToan, h.PhienBan,
        ${v894 ? 'h.LoaiVanBan, h.HopDongChaID, h.SoHoaDon,' : "N'HopDong' AS LoaiVanBan,"}
        h.MaTraCuu, CONVERT(varchar(19), h.HanKy, 120) AS HanKy, CONVERT(varchar(19), h.XuatBanLuc, 120) AS XuatBanLuc, CONVERT(varchar(19), h.KhachKyLuc, 120) AS KhachKyLuc,
        CONVERT(varchar(19), h.KyXongLuc, 120) AS KyXongLuc, CONVERT(varchar(19), h.CreatedAt, 120) AS CreatedAt, h.LoiKySo, u.HoTen AS NguoiTao,
        JSON_VALUE(h.BenMuaJson, '$.Ten') AS BenMuaTen, JSON_VALUE(h.BenMuaJson, '$.NguoiDaiDien') AS BenMuaNDD,
        (SELECT MAX(CONVERT(varchar(19), l.MoLanCuoi, 120)) FROM HopDongMBLink l WHERE l.HopDongMBID = h.HopDongMBID) AS KhachMoLanCuoi
      FROM HopDongMB h LEFT JOIN Users u ON u.UserID = h.NguoiTaoID LEFT JOIN KhachHang kh ON kh.KhachHangID = h.KhachHangID
      ${dk.length ? 'WHERE ' + dk.join(' AND ') : ''} ORDER BY h.HopDongMBID DESC`)).recordset;
    const dem = {};
    (await pool.request().query('SELECT TrangThai, COUNT(*) AS n FROM HopDongMB GROUP BY TrangThai')).recordset.forEach(x => { dem[x.TrangThai] = x.n; });
    dem.ChuaTT = ((await pool.request().query("SELECT COUNT(*) AS n FROM HopDongMB WHERE TrangThaiThanhToan=N'ChuaTT' AND TrangThai=N'DaKy'")).recordset[0] || {}).n || 0;
    res.json({ success: true, data: rows, dem, tenTrangThai: core.TEN_TRANG_THAI });
  } catch (e) { loi(res, e, 500); }
});

router.get('/:id', ...G('view', 'danhsach'), async (req, res) => {
  try {
    const pool = await getPool();
    const d = await core.docHopDong(pool, req.params.id);
    if (!d) return res.status(404).json({ success: false, message: 'Không thấy hợp đồng.' });
    delete d.hd.NoiDungHtml;
    const soLink = (await pool.request().input('hd', sql.Int, d.hd.HopDongMBID).query('SELECT LinkID, PhienBan, VoHieu, SoLanMo, CONVERT(varchar(19), HetHan, 120) AS HetHan, CONVERT(varchar(19), MoLanDau, 120) AS MoLanDau, CONVERT(varchar(19), MoLanCuoi, 120) AS MoLanCuoi FROM HopDongMBLink WHERE HopDongMBID=@hd ORDER BY LinkID DESC')).recordset;
    // v9.62: phụ lục / thanh lý thuộc văn bản này
    let con = [];
    if (await core.coV894(pool)) con = (await pool.request().input('hd', sql.Int, d.hd.HopDongMBID).query('SELECT HopDongMBID, SoHopDong, TenHopDong, LoaiVanBan, TrangThai, CONVERT(varchar(19), CreatedAt, 120) AS CreatedAt FROM HopDongMB WHERE HopDongChaID=@hd ORDER BY HopDongMBID')).recordset;
    const tx = kyTuXa.cauHinh();
    res.json({ success: true, data: Object.assign(d, { links: soLink, con, coFile: { goc: core.coFile(d.hd.FileGoc), khach: core.coFile(d.hd.FileKhachKy), choMoyn: core.coFile(d.hd.FileChoMoyn), cuoi: core.coFile(d.hd.FileCuoi), nguon: core.coFile(d.hd.FileNguon) },
      quyenKySo: !!coQuyenChucNang(req.session.user, 'HOPDONG', 'kyso'), kyTuDong: kySo.cauHinh().loai, kyTuXa: { san: tx.san, tenHienThi: tx.tenHienThi, nhanUserId: tx.nhanUserId, nha: tx.nha }, tenTrangThai: core.TEN_TRANG_THAI, tenLoaiVanBan: core.TEN_LOAI_VAN_BAN }) });
  } catch (e) { loi(res, e, 500); }
});

/* Thân tạo/sửa: { tenHopDong, khachHangId, benMua{}, nguon, maMau, giaTriBien{}, hang[], nguoiKyKhach{hoTen,chucVu,email,sdt}, nguoiKyMoyn{hoTen,chucVu,email}, ghiChu, tongTien } */
function docThan(b) {
  const bm = b.benMua && typeof b.benMua === 'object' ? b.benMua : {};
  const benMua = {};
  ['LoaiDoiTac', 'Ten', 'DiaChi', 'MST', 'SoDKKD', 'NgayCapDKKD', 'NoiCapDKKD', 'NguoiDaiDien', 'ChucVu', 'CCCD', 'SDT', 'Email'].forEach(k => { benMua[k] = nn(bm[k], 255) || ''; });
  const hang = (Array.isArray(b.hang) ? b.hang : []).slice(0, 300).map((h, i) => {
    const sl = soHopLe(h.SoLuong), dg = soHopLe(h.DonGia);
    return { MaHangID: h.MaHangID ? Number(h.MaHangID) : null, MaSanPham: nn(h.MaSanPham, 50), TenSanPham: nn(h.TenSanPham, 255), MauSac: nn(h.MauSac, 100), DonVi: nn(h.DonVi, 20),
      SoLuong: sl, DonGia: dg, ThanhTien: h.ThanhTien != null && h.ThanhTien !== '' ? soHopLe(h.ThanhTien) : Math.round(sl * dg * 100) / 100, GhiChu: nn(h.GhiChu, 255), ThuTu: i + 1 };
  }).filter(h => h.TenSanPham || h.MaSanPham);
  const gia = {};
  if (b.giaTriBien && typeof b.giaTriBien === 'object') Object.keys(b.giaTriBien).slice(0, 200).forEach(k => { if (/^[A-Za-z0-9_]{1,60}$/.test(k)) gia[k] = String(b.giaTriBien[k] == null ? '' : b.giaTriBien[k]).slice(0, 4000); });
  const nk = b.nguoiKyKhach && typeof b.nguoiKyKhach === 'object' ? b.nguoiKyKhach : {};
  const nm = b.nguoiKyMoyn && typeof b.nguoiKyMoyn === 'object' ? b.nguoiKyMoyn : {};
  const tongTien = hang.length ? hang.reduce((t, h) => t + h.ThanhTien, 0) : soHopLe(b.tongTien);
  return {
    tenHopDong: nn(b.tenHopDong, 255), khachHangId: b.khachHangId ? Number(b.khachHangId) : null, benMua, nguon: b.nguon === 'PDF' ? 'PDF' : 'Mau',
    maMau: nn(b.maMau, 50), gia, hang, tongTien: Math.round(tongTien * 100) / 100, ghiChu: nn(b.ghiChu, 500),
    loaiVanBan: ['HopDong', 'PhuLuc', 'ThanhLy'].includes(b.loaiVanBan) ? b.loaiVanBan : 'HopDong',   // v9.62
    hopDongChaId: b.hopDongChaId ? Number(b.hopDongChaId) : null,
    nguoiKyKhach: { hoTen: nn(nk.hoTen, 150) || benMua.NguoiDaiDien || '', chucVu: nn(nk.chucVu, 100) || benMua.ChucVu || '', email: nn(nk.email, 150) || benMua.Email || '', sdt: nn(nk.sdt, 30) || benMua.SDT || '' },
    nguoiKyMoyn: { hoTen: nn(nm.hoTen, 150), chucVu: nn(nm.chucVu, 100), email: nn(nm.email, 150) }
  };
}
/* v9.62: phụ lục / thanh lý phải trỏ tới một HỢP ĐỒNG gốc đã ký. Trả câu lỗi hoặc null. */
async function kiemVanBanCha(pool, t, v894) {
  if (t.loaiVanBan === 'HopDong') return null;
  if (!v894) return 'CSDL chưa chạy migration_v894 — chưa tạo được phụ lục / thanh lý.';
  if (!t.hopDongChaId) return 'Chọn hợp đồng gốc cho ' + (core.TEN_LOAI_VAN_BAN[t.loaiVanBan] || t.loaiVanBan).toLowerCase() + '.';
  const cha = (await pool.request().input('id', sql.Int, t.hopDongChaId).query("SELECT HopDongMBID, LoaiVanBan, TrangThai FROM HopDongMB WHERE HopDongMBID=@id")).recordset[0];
  if (!cha) return 'Hợp đồng gốc không tồn tại.';
  if (cha.LoaiVanBan && cha.LoaiVanBan !== 'HopDong') return 'Hợp đồng gốc phải là HỢP ĐỒNG (không phải phụ lục / thanh lý).';
  if (cha.TrangThai !== 'DaKy') return 'Hợp đồng gốc chưa ký xong — chỉ lập phụ lục / thanh lý cho hợp đồng đã ký.';
  return null;
}
async function ghiHang(pool, id, hang) {
  await pool.request().input('id', sql.Int, id).query('DELETE FROM HopDongMBHang WHERE HopDongMBID=@id');
  for (const h of hang) {
    await pool.request().input('id', sql.Int, id).input('mh', sql.Int, h.MaHangID).input('ma', sql.NVarChar(50), h.MaSanPham).input('ten', sql.NVarChar(255), h.TenSanPham)
      .input('mau', sql.NVarChar(100), h.MauSac).input('dv', sql.NVarChar(20), h.DonVi).input('sl', sql.Decimal(14, 2), h.SoLuong).input('dg', sql.Decimal(14, 2), h.DonGia)
      .input('tt', sql.Decimal(18, 2), h.ThanhTien).input('gc', sql.NVarChar(255), h.GhiChu).input('thutu', sql.Int, h.ThuTu)
      .query('INSERT INTO HopDongMBHang (HopDongMBID, MaHangID, MaSanPham, TenSanPham, MauSac, DonVi, SoLuong, DonGia, ThanhTien, GhiChu, ThuTu) VALUES (@id, @mh, @ma, @ten, @mau, @dv, @sl, @dg, @tt, @gc, @thutu)');
  }
}
async function ghiBenKy(pool, id, t, cfg) {
  const ben = (await pool.request().input('id', sql.Int, id).query('SELECT BenKyID, Ben FROM HopDongMBBenKy WHERE HopDongMBID=@id')).recordset;
  const up = async (loai, hoTen, chucVu, email, sdt, thuTu) => {
    const co = ben.find(b => b.Ben === loai);
    const r = pool.request().input('id', sql.Int, id).input('ben', sql.NVarChar(10), loai).input('ht', sql.NVarChar(150), hoTen || null).input('cv', sql.NVarChar(100), chucVu || null)
      .input('em', sql.NVarChar(150), email || null).input('sdt', sql.NVarChar(30), sdt || null).input('tt', sql.Int, thuTu);
    if (co) await r.input('bid', sql.Int, co.BenKyID).query('UPDATE HopDongMBBenKy SET HoTen=@ht, ChucVu=@cv, Email=@em, SDT=@sdt WHERE BenKyID=@bid');
    else await r.query('INSERT INTO HopDongMBBenKy (HopDongMBID, Ben, HoTen, ChucVu, Email, SDT, ThuTu) VALUES (@id, @ben, @ht, @cv, @em, @sdt, @tt)');
  };
  await up('Khach', t.nguoiKyKhach.hoTen, t.nguoiKyKhach.chucVu, t.nguoiKyKhach.email, t.nguoiKyKhach.sdt, 1);
  await up('MOYN', t.nguoiKyMoyn.hoTen || cfg.nguoiKy, t.nguoiKyMoyn.chucVu || cfg.chucVu, t.nguoiKyMoyn.email || cfg.email, null, 2);
}

router.post('/', ...G('create', 'danhsach'), async (req, res) => {
  try {
    const pool = await getPool();
    const t = docThan(req.body || {});
    if (!t.tenHopDong) return res.status(400).json({ success: false, message: 'Thiếu tên hợp đồng.' });
    if (t.nguon === 'Mau' && !t.maMau) return res.status(400).json({ success: false, message: 'Chọn mẫu hợp đồng (hoặc chọn nguồn "PDF soạn sẵn").' });
    if (t.nguon === 'Mau' && !await core.docMau(pool, t.maMau)) return res.status(400).json({ success: false, message: 'Mẫu "' + t.maMau + '" không tồn tại.' });
    if (!t.benMua.Ten) return res.status(400).json({ success: false, message: 'Thiếu tên bên mua.' });
    const cfg = await core.docCauHinhKy(pool);
    const v894 = await core.coV894(pool);
    const loiCha = await kiemVanBanCha(pool, t, v894);
    if (loiCha) return res.status(400).json({ success: false, message: loiCha });
    const so = nn((req.body || {}).soHopDong, 30) || await core.soHopDongMoi(pool, t.loaiVanBan);
    const ins = (await pool.request().input('so', sql.NVarChar(30), so).input('ten', sql.NVarChar(255), t.tenHopDong).input('kh', sql.Int, t.khachHangId)
      .input('bm', sql.NVarChar(sql.MAX), JSON.stringify(t.benMua)).input('nguon', sql.NVarChar(10), t.nguon).input('mau', sql.NVarChar(50), t.nguon === 'Mau' ? t.maMau : null)
      .input('gia', sql.NVarChar(sql.MAX), JSON.stringify(t.gia)).input('tong', sql.Decimal(18, 2), t.tongTien).input('gc', sql.NVarChar(500), t.ghiChu).input('ng', sql.Int, req.session.user.userId)
      .input('lvb', sql.NVarChar(10), t.loaiVanBan).input('cha', sql.Int, t.loaiVanBan === 'HopDong' ? null : t.hopDongChaId)
      .query(`INSERT INTO HopDongMB (SoHopDong, TenHopDong, KhachHangID, BenMuaJson, Nguon, MaMau, GiaTriBien, TongTien, GhiChu, NguoiTaoID${v894 ? ', LoaiVanBan, HopDongChaID' : ''})
              OUTPUT INSERTED.HopDongMBID VALUES (@so, @ten, @kh, @bm, @nguon, @mau, @gia, @tong, @gc, @ng${v894 ? ', @lvb, @cha' : ''})`)).recordset[0];
    const id = ins.HopDongMBID;
    await ghiHang(pool, id, t.hang);
    await ghiBenKy(pool, id, t, cfg);
    await nhatKy.ghi(pool, Object.assign({ hopDongId: id, hanhDong: 'TAO', chiTiet: { so, nguon: t.nguon, maMau: t.maMau, loaiVanBan: t.loaiVanBan, cha: t.hopDongChaId } }, ctxCua(req)));
    res.json({ success: true, data: { HopDongMBID: id, SoHopDong: so } });
  } catch (e) { loi(res, /UNIQUE|duplicate/i.test(e.message) ? new Error('Số hợp đồng đã tồn tại.') : e); }
});

router.put('/:id', ...G('edit', 'danhsach'), async (req, res) => {
  try {
    const pool = await getPool();
    const d = await core.docHopDong(pool, req.params.id);
    if (!d) return res.status(404).json({ success: false, message: 'Không thấy hợp đồng.' });
    if (!['Nhap', 'ChoKy', 'TuChoi', 'HetHan'].includes(d.hd.TrangThai)) return res.status(409).json({ success: false, message: 'Hợp đồng đang "' + core.TEN_TRANG_THAI[d.hd.TrangThai] + '" — không sửa được. Muốn thay đổi: Hủy rồi tạo hợp đồng mới.' });
    const t = docThan(req.body || {});
    if (!t.tenHopDong) return res.status(400).json({ success: false, message: 'Thiếu tên hợp đồng.' });
    if (t.nguon === 'Mau' && !await core.docMau(pool, t.maMau)) return res.status(400).json({ success: false, message: 'Mẫu không tồn tại.' });
    const cfg = await core.docCauHinhKy(pool);
    const v894 = await core.coV894(pool);
    if (t.hopDongChaId === d.hd.HopDongMBID) return res.status(400).json({ success: false, message: 'Văn bản không thể là phụ lục của chính nó.' });
    const loiCha = await kiemVanBanCha(pool, t, v894);
    if (loiCha) return res.status(400).json({ success: false, message: loiCha });
    await pool.request().input('id', sql.Int, d.hd.HopDongMBID).input('ten', sql.NVarChar(255), t.tenHopDong).input('kh', sql.Int, t.khachHangId)
      .input('bm', sql.NVarChar(sql.MAX), JSON.stringify(t.benMua)).input('nguon', sql.NVarChar(10), t.nguon).input('mau', sql.NVarChar(50), t.nguon === 'Mau' ? t.maMau : null)
      .input('gia', sql.NVarChar(sql.MAX), JSON.stringify(t.gia)).input('tong', sql.Decimal(18, 2), t.tongTien).input('gc', sql.NVarChar(500), t.ghiChu)
      .input('lvb', sql.NVarChar(10), t.loaiVanBan).input('cha', sql.Int, t.loaiVanBan === 'HopDong' ? null : t.hopDongChaId)
      .query(`UPDATE HopDongMB SET TenHopDong=@ten, KhachHangID=@kh, BenMuaJson=@bm, Nguon=@nguon, MaMau=@mau, GiaTriBien=@gia, TongTien=@tong, GhiChu=@gc,
              ${v894 ? 'LoaiVanBan=@lvb, HopDongChaID=@cha,' : ''} TrangThai=N'Nhap', UpdatedAt=SYSDATETIME() WHERE HopDongMBID=@id`);
    // sửa là về Nháp: link cũ vô hiệu (nội dung có thể đã khác bản khách đang mở)
    await pool.request().input('hd', sql.Int, d.hd.HopDongMBID).query('UPDATE HopDongMBLink SET VoHieu=1 WHERE HopDongMBID=@hd AND VoHieu=0');
    await ghiHang(pool, d.hd.HopDongMBID, t.hang);
    await ghiBenKy(pool, d.hd.HopDongMBID, t, cfg);
    await nhatKy.ghi(pool, Object.assign({ hopDongId: d.hd.HopDongMBID, hanhDong: 'SUA', chiTiet: { tuTrangThai: d.hd.TrangThai } }, ctxCua(req)));
    res.json({ success: true });
  } catch (e) { loi(res, e); }
});

router.delete('/:id', ...G('delete', 'danhsach'), async (req, res) => {
  try {
    const pool = await getPool();
    const d = await core.docHopDong(pool, req.params.id);
    if (!d) return res.status(404).json({ success: false, message: 'Không thấy hợp đồng.' });
    if (d.hd.TrangThai !== 'Nhap') return res.status(409).json({ success: false, message: 'Chỉ xóa được hợp đồng Nháp. Hợp đồng đã xuất bản thì Hủy (giữ nhật ký).' });
    await pool.request().input('id', sql.Int, d.hd.HopDongMBID).query('DELETE FROM HopDongMB WHERE HopDongMBID=@id');
    res.json({ success: true });
  } catch (e) { loi(res, e); }
});

/* Tải PDF soạn sẵn (Nguon='PDF'). */
router.post('/:id/pdf-soan-san', ...G('edit', 'danhsach'), upPdf.single('file'), async (req, res) => {
  try {
    const pool = await getPool();
    const d = await core.docHopDong(pool, req.params.id);
    if (!d) return res.status(404).json({ success: false, message: 'Không thấy hợp đồng.' });
    if (!['Nhap', 'ChoKy', 'TuChoi', 'HetHan'].includes(d.hd.TrangThai)) return res.status(409).json({ success: false, message: 'Hợp đồng đã có người ký — không thay file.' });
    if (!req.file || req.file.buffer.slice(0, 5).toString('latin1') !== '%PDF-') return res.status(400).json({ success: false, message: 'Chọn một file PDF.' });
    const ten = `nguon_${d.hd.HopDongMBID}_${Date.now()}.pdf`;
    await core.ghiFile(ten, req.file.buffer);
    await pool.request().input('id', sql.Int, d.hd.HopDongMBID).input('f', sql.NVarChar(260), ten).query(`UPDATE HopDongMB SET FileNguon=@f, Nguon=N'PDF', TrangThai=N'Nhap', UpdatedAt=SYSDATETIME() WHERE HopDongMBID=@id`);
    await nhatKy.ghi(pool, Object.assign({ hopDongId: d.hd.HopDongMBID, hanhDong: 'TAI_LEN_PDF', chiTiet: { ten: req.file.originalname, kich: req.file.size } }, ctxCua(req)));
    res.json({ success: true, data: { FileNguon: ten } });
  } catch (e) { loi(res, e); }
});

/* Xem trước HTML (chưa xuất bản) — để kế toán soát biến còn trống. */
router.get('/:id/xem-truoc', ...G('view', 'danhsach'), async (req, res) => {
  try {
    const pool = await getPool();
    const d = await core.docHopDong(pool, req.params.id);
    if (!d) return res.status(404).json({ success: false, message: 'Không thấy hợp đồng.' });
    if (d.hd.Nguon === 'PDF') return res.json({ success: true, data: { html: null, pdf: core.coFile(d.hd.FileNguon), bienThieu: [] } });
    const cfg = await core.docCauHinhKy(pool);
    const kq = await core.dungHtml(pool, d, cfg);
    res.json({ success: true, data: { html: kq.html, bienThieu: kq.bienThieu, gia: kq.gia } });
  } catch (e) { loi(res, e); }
});

/* Xuất bản để ký: dựng PDF cố định + link; tùy chọn gửi ngay (kenh). */
router.post('/:id/xuat-ban', ...G('edit', 'danhsach'), async (req, res) => {
  try {
    const pool = await getPool();
    const ctx = ctxCua(req);
    const kq = await core.xuatBan(pool, req.params.id, ctx);
    let guiKq = null;
    const kenh = (req.body || {}).kenh;
    if (kenh) guiKq = await core.guiLinkChoKhach(pool, kq.d, kenh, ctx);
    res.json({ success: true, data: { link: guiKq ? guiKq.link : kq.link, bienThieu: kq.bienThieu, hash: kq.hash, gui: guiKq ? { kenh, ok: guiKq.kq.ok, loi: guiKq.kq.loi, dich: guiKq.dich } : null } });
  } catch (e) { loi(res, e); }
});
/* Gửi (lại) link ký — tạo token mới, link cũ vô hiệu. */
router.post('/:id/gui-link', ...G('edit', 'danhsach'), async (req, res) => {
  try {
    const pool = await getPool();
    const d = await core.docHopDong(pool, req.params.id);
    if (!d) return res.status(404).json({ success: false, message: 'Không thấy hợp đồng.' });
    if (!['ChoKy'].includes(d.hd.TrangThai)) return res.status(409).json({ success: false, message: 'Chỉ gửi link khi hợp đồng đang "Chờ khách ký" (xuất bản trước).' });
    const kenh = ['email', 'sms', 'zalo'].includes((req.body || {}).kenh) ? req.body.kenh : 'email';
    const kq = await core.guiLinkChoKhach(pool, d, kenh, ctxCua(req));
    res.json({ success: kq.kq.ok, message: kq.kq.ok ? 'Đã gửi link tới ' + kq.dich : ('Không gửi được: ' + kq.kq.loi + ' — link vẫn dùng được, copy gửi tay.'), data: { link: kq.link } });
  } catch (e) { loi(res, e); }
});
/* Gửi lại OTP cho khách (kế toán bấm hộ khi khách báo không nhận được). */
router.post('/:id/gui-otp', ...G('edit', 'danhsach'), async (req, res) => {
  try {
    const pool = await getPool();
    const d = await core.docHopDong(pool, req.params.id);
    if (!d) return res.status(404).json({ success: false, message: 'Không thấy hợp đồng.' });
    if (d.hd.TrangThai !== 'ChoKy') return res.status(409).json({ success: false, message: 'Chỉ gửi OTP khi hợp đồng đang "Chờ khách ký".' });
    const kenh = ['email', 'sms', 'zalo'].includes((req.body || {}).kenh) ? req.body.kenh : 'email';
    const kq = await core.taoOtp(pool, d, kenh, ctxCua(req));
    res.json({ success: true, message: `Đã gửi OTP qua ${kenh} tới ${kq.dich} (hiệu lực ${kq.hanPhut} phút).` });
  } catch (e) { loi(res, e); }
});
router.post('/:id/huy', ...G('edit', 'danhsach'), async (req, res) => {
  try {
    const pool = await getPool();
    const d = await core.docHopDong(pool, req.params.id);
    if (!d) return res.status(404).json({ success: false, message: 'Không thấy hợp đồng.' });
    if (['DaKy', 'Huy'].includes(d.hd.TrangThai)) return res.status(409).json({ success: false, message: 'Hợp đồng đã ký / đã hủy — không hủy được. Hợp đồng đã ký muốn chấm dứt thì lập biên bản thanh lý (ngoài phần mềm).' });
    const lyDo = nn((req.body || {}).lyDo, 500);
    if (!lyDo) return res.status(400).json({ success: false, message: 'Nhập lý do hủy.' });
    await pool.request().input('id', sql.Int, d.hd.HopDongMBID).query(`UPDATE HopDongMB SET TrangThai=N'Huy', UpdatedAt=SYSDATETIME() WHERE HopDongMBID=@id`);
    await pool.request().input('hd', sql.Int, d.hd.HopDongMBID).query('UPDATE HopDongMBLink SET VoHieu=1 WHERE HopDongMBID=@hd');
    await nhatKy.ghi(pool, Object.assign({ hopDongId: d.hd.HopDongMBID, hanhDong: 'HUY', chiTiet: { lyDo, tuTrangThai: d.hd.TrangThai } }, ctxCua(req)));
    res.json({ success: true });
  } catch (e) { loi(res, e); }
});
router.post('/:id/thu-hoi', ...G('edit', 'danhsach'), async (req, res) => {
  try {
    const pool = await getPool();
    const d = await core.docHopDong(pool, req.params.id);
    if (!d) return res.status(404).json({ success: false, message: 'Không thấy hợp đồng.' });
    if (!['ChoKy', 'TuChoi', 'HetHan'].includes(d.hd.TrangThai)) return res.status(409).json({ success: false, message: 'Chỉ thu hồi khi đang chờ ký / bị từ chối / hết hạn.' });
    await pool.request().input('id', sql.Int, d.hd.HopDongMBID).query(`UPDATE HopDongMB SET TrangThai=N'Nhap', UpdatedAt=SYSDATETIME() WHERE HopDongMBID=@id`);
    await pool.request().input('hd', sql.Int, d.hd.HopDongMBID).query('UPDATE HopDongMBLink SET VoHieu=1 WHERE HopDongMBID=@hd');
    await nhatKy.ghi(pool, Object.assign({ hopDongId: d.hd.HopDongMBID, hanhDong: 'THU_HOI', chiTiet: { tuTrangThai: d.hd.TrangThai } }, ctxCua(req)));
    res.json({ success: true });
  } catch (e) { loi(res, e); }
});
router.put('/:id/thanh-toan', ...G('edit', 'danhsach'), async (req, res) => {
  try {
    const pool = await getPool();
    const tt = (req.body || {}).trangThai;
    if (!['ChuaTT', 'MotPhan', 'DaTT'].includes(tt)) return res.status(400).json({ success: false, message: 'Trạng thái thanh toán: ChuaTT | MotPhan | DaTT.' });
    const r = await pool.request().input('id', sql.Int, Number(req.params.id)).input('tt', sql.NVarChar(10), tt).query('UPDATE HopDongMB SET TrangThaiThanhToan=@tt, UpdatedAt=SYSDATETIME() WHERE HopDongMBID=@id');
    if (!r.rowsAffected[0]) return res.status(404).json({ success: false, message: 'Không thấy hợp đồng.' });
    await nhatKy.ghi(pool, Object.assign({ hopDongId: Number(req.params.id), hanhDong: 'THANH_TOAN', chiTiet: { trangThai: tt } }, ctxCua(req)));
    res.json({ success: true });
  } catch (e) { loi(res, e); }
});

/* v9.62: số / ngày hóa đơn điện tử đã xuất cho hợp đồng (ghi tay để đối chiếu). */
router.put('/:id/hoa-don', ...G('edit', 'danhsach'), async (req, res) => {
  try {
    const pool = await getPool();
    if (!await core.coV894(pool)) return res.status(400).json({ success: false, message: 'CSDL chưa chạy migration_v894.' });
    const b = req.body || {};
    const r = await pool.request().input('id', sql.Int, Number(req.params.id)).input('so', sql.NVarChar(50), nn(b.soHoaDon, 50)).input('ng', sql.Date, b.ngayHoaDon || null)
      .query('UPDATE HopDongMB SET SoHoaDon=@so, NgayHoaDon=@ng, UpdatedAt=SYSDATETIME() WHERE HopDongMBID=@id');
    if (!r.rowsAffected[0]) return res.status(404).json({ success: false, message: 'Không thấy hợp đồng.' });
    await nhatKy.ghi(pool, Object.assign({ hopDongId: Number(req.params.id), hanhDong: 'HOA_DON', chiTiet: { soHoaDon: nn(b.soHoaDon, 50), ngayHoaDon: b.ngayHoaDon || null } }, ctxCua(req)));
    res.json({ success: true });
  } catch (e) { loi(res, e); }
});

router.get('/:id/nhatky', ...G('view', 'danhsach'), async (req, res) => {
  try {
    const pool = await getPool();
    const kq = await nhatKy.doc(pool, req.params.id);
    kq.rows.forEach(r => { r.Ten = pdfU.tenHanhDong(r.HanhDong); });
    res.json({ success: true, data: kq.rows, chuoiOk: kq.chuoiOk, dongHong: kq.dongHong });
  } catch (e) { loi(res, e, 500); }
});

/* Tải PDF: loai = goc | khach | chomoyn | cuoi | nguon. */
router.get('/:id/pdf', ...G('view', 'danhsach'), async (req, res) => {
  try {
    const pool = await getPool();
    const d = await core.docHopDong(pool, req.params.id);
    if (!d) return res.status(404).json({ success: false, message: 'Không thấy hợp đồng.' });
    const loai = String(req.query.loai || (d.hd.FileCuoi ? 'cuoi' : 'goc'));
    const ten = { goc: d.hd.FileGoc, khach: d.hd.FileKhachKy, chomoyn: d.hd.FileChoMoyn, cuoi: d.hd.FileCuoi, nguon: d.hd.FileNguon }[loai];
    if (!core.coFile(ten)) return res.status(404).json({ success: false, message: 'Chưa có file "' + loai + '".' });
    const buf = await core.docFile(ten);
    await nhatKy.ghi(pool, Object.assign({ hopDongId: d.hd.HopDongMBID, hanhDong: 'TAI_PDF', chiTiet: { loai } }, ctxCua(req)));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${req.query.xem ? 'inline' : 'attachment'}; filename="${d.hd.SoHopDong}_${loai}.pdf"`);
    res.end(buf);
  } catch (e) { loi(res, e, 500); }
});

/* ---------------- Ký số phía MOYN bằng tay — NĂNG LỰC kyso ---------------- */
function canKySo(req, res) {
  if (coQuyenChucNang(req.session.user, 'HOPDONG', 'kyso')) return true;
  res.status(403).json({ success: false, message: 'Cần năng lực "HOPDONG/kyso" (Quản trị → Phân quyền → tick Ký số phía MOYN).' });
  return false;
}
/* Ký số lại bằng bộ ký tự động (sau khi sửa .env / TSA) — khách đã ký. */
router.post('/:id/ky-lai', ...G('edit', 'danhsach'), async (req, res) => {
  try {
    if (!canKySo(req, res)) return;
    const pool = await getPool();
    const d = await core.docHopDong(pool, req.params.id);
    if (!d) return res.status(404).json({ success: false, message: 'Không thấy hợp đồng.' });
    if (!['DangKySo', 'ChoMoynKy', 'LoiKySo', 'DaKy'].includes(d.hd.TrangThai) || !d.benKhach || d.benKhach.TrangThai !== 'DaKy') return res.status(409).json({ success: false, message: 'Khách chưa ký — chưa có gì để ký số.' });
    await nhatKy.ghi(pool, Object.assign({ hopDongId: d.hd.HopDongMBID, hanhDong: 'KY_LAI', chiTiet: { tuTrangThai: d.hd.TrangThai } }, ctxCua(req)));
    const kq = await core.hoanTatSauKhachKy(pool, d.hd.HopDongMBID, ctxCua(req));
    res.json({ success: kq.trangThai === 'DaKy', data: kq, message: kq.trangThai === 'DaKy' ? 'Đã ký số.' : (kq.loi || core.TEN_TRANG_THAI[kq.trangThai]) });
  } catch (e) { loi(res, e); }
});
/* Tải lên bản MOYN đã ký bằng phần mềm token (ký lên file "chomoyn"). */
router.post('/:id/tai-len-da-ky', ...G('edit', 'danhsach'), upPdf.single('file'), async (req, res) => {
  try {
    if (!canKySo(req, res)) return;
    const pool = await getPool();
    const d = await core.docHopDong(pool, req.params.id);
    if (!d) return res.status(404).json({ success: false, message: 'Không thấy hợp đồng.' });
    if (!['ChoMoynKy', 'LoiKySo', 'DangKySo'].includes(d.hd.TrangThai) || !core.coFile(d.hd.FileChoMoyn)) return res.status(409).json({ success: false, message: 'Hợp đồng không ở trạng thái chờ MOYN ký số.' });
    if (!req.file) return res.status(400).json({ success: false, message: 'Chọn file PDF đã ký.' });
    const cfg = await core.docCauHinhKy(pool);
    const kq = await kiemCK.kiemBanTaiLen(req.file.buffer, await core.docFile(d.hd.FileChoMoyn), { mst: cfg.mst, ten: cfg.tenCongTy });
    if (!kq.ok) return res.status(400).json({ success: false, message: kq.loi, maLoi: kq.maLoi });
    await core.hoanTatMoynKy(pool, d.hd.HopDongMBID, { pdf: req.file.buffer, thongTin: kq.cuoi.chungThu, tsa: { ok: kq.cuoi.coDauThoiGian, loi: kq.cuoi.coDauThoiGian ? '' : 'file tải lên không có dấu thời gian' }, signingTime: kq.cuoi.kyLuc }, 'TaiLen', ctxCua(req));
    res.json({ success: true, canhBao: kq.canhBao });
  } catch (e) { loi(res, e); }
});
/* Ký bằng công cụ MOYN Ký số (USB token trên máy người ký) — 2 bước. */
router.post('/:id/ky-cong-cu/bat-dau', ...G('edit', 'danhsach'), async (req, res) => {
  try {
    if (!canKySo(req, res)) return;
    const pool = await getPool();
    const d = await core.docHopDong(pool, req.params.id);
    if (!d) return res.status(404).json({ success: false, message: 'Không thấy hợp đồng.' });
    if (!['ChoMoynKy', 'LoiKySo', 'DangKySo'].includes(d.hd.TrangThai) || !core.coFile(d.hd.FileChoMoyn)) return res.status(409).json({ success: false, message: 'Hợp đồng không ở trạng thái chờ MOYN ký số.' });
    const certDer = Buffer.from(String((req.body || {}).certDer || ''), 'base64');
    if (certDer.length < 100) return res.status(400).json({ success: false, message: 'Thiếu chứng thư (certDer).' });
    const cfg = await core.docCauHinhKy(pool);
    const kq = await kySo.batDauKyNgoai(await core.docFile(d.hd.FileChoMoyn), certDer, { lyDo: 'Ký hợp đồng ' + d.hd.SoHopDong, lienHe: cfg.email || '', viTri: cfg.diaDiemKy || 'Việt Nam' });
    req.session.phienKyMoyn = { phienKy: kq.phienKy, hopDongId: d.hd.HopDongMBID };
    res.json({ success: true, data: kq });
  } catch (e) { loi(res, e); }
});
router.post('/:id/ky-cong-cu/hoan-tat', ...G('edit', 'danhsach'), async (req, res) => {
  try {
    if (!canKySo(req, res)) return;
    const pool = await getPool();
    const d = await core.docHopDong(pool, req.params.id);
    if (!d) return res.status(404).json({ success: false, message: 'Không thấy hợp đồng.' });
    const ph = req.session.phienKyMoyn;
    const phienKy = String((req.body || {}).phienKy || '');
    if (!ph || ph.phienKy !== phienKy || ph.hopDongId !== d.hd.HopDongMBID) return res.status(400).json({ success: false, message: 'Phiên ký không khớp — bấm ký lại từ đầu.' });
    const kq = await kySo.hoanTatKyNgoai(phienKy, (req.body || {}).chuKy);
    delete req.session.phienKyMoyn;
    await core.hoanTatMoynKy(pool, d.hd.HopDongMBID, kq, 'CongCu', ctxCua(req));
    res.json({ success: true, data: { tsa: kq.tsa && kq.tsa.ok, chungThu: kq.thongTin && kq.thongTin.CN } });
  } catch (e) { loi(res, e); }
});

/* ---------------- v9.62: MOYN ký TỪ XA qua CA (SmartCA xác nhận trên app / CSC nhập OTP) — năng lực kyso ---------------- */
async function hopDongChoMoyn(req, res) {
  const pool = await getPool();
  const d = await core.docHopDong(pool, req.params.id);
  if (!d) { res.status(404).json({ success: false, message: 'Không thấy hợp đồng.' }); return null; }
  if (!['ChoMoynKy', 'LoiKySo', 'DangKySo'].includes(d.hd.TrangThai) || !core.coFile(d.hd.FileChoMoyn)) { res.status(409).json({ success: false, message: 'Hợp đồng không ở trạng thái chờ MOYN ký số.' }); return null; }
  return Object.assign(d, { pool });
}
router.post('/:id/ky-tu-xa/bat-dau', ...G('edit', 'danhsach'), async (req, res) => {
  try {
    if (!canKySo(req, res)) return;
    const d = await hopDongChoMoyn(req, res); if (!d) return;
    const cfg = await core.docCauHinhKy(d.pool);
    const kq = await kyTuXa.batDau({ pdfBuffer: await core.docFile(d.hd.FileChoMoyn), userId: (req.body || {}).userId, serial: (req.body || {}).serial, moTa: 'Ký hợp đồng ' + d.hd.SoHopDong,
      tt: { lyDo: 'Ký hợp đồng ' + d.hd.SoHopDong, lienHe: cfg.email || '', viTri: cfg.diaDiemKy || 'Việt Nam' } });
    req.session.phienTuXaMoyn = { phienKy: kq.phienKy, hopDongId: d.hd.HopDongMBID };
    await nhatKy.ghi(d.pool, Object.assign({ hopDongId: d.hd.HopDongMBID, hanhDong: 'KY_TU_XA_BAT_DAU', chiTiet: { phia: 'MOYN', nha: kq.nha, chungThu: kq.thongTin && kq.thongTin.CN } }, ctxCua(req)));
    res.json({ success: true, data: kq });
  } catch (e) { loi(res, e); }
});
async function hoanTatTuXaMoyn(req, res, d, kq) {
  delete req.session.phienTuXaMoyn;
  await core.hoanTatMoynKy(d.pool, d.hd.HopDongMBID, kq.kq, 'TuXa', ctxCua(req));
  res.json({ success: true, data: { xong: true, chungThu: kq.kq.thongTin && kq.kq.thongTin.CN, tsa: !!(kq.kq.tsa && kq.kq.tsa.ok) }, message: 'Đã ký số từ xa.' });
}
router.get('/:id/ky-tu-xa/:phienKy', ...G('view', 'danhsach'), async (req, res) => {
  try {
    if (!canKySo(req, res)) return;
    const d = await hopDongChoMoyn(req, res); if (!d) return;
    const ph = req.session.phienTuXaMoyn;
    if (!ph || ph.phienKy !== req.params.phienKy || ph.hopDongId !== d.hd.HopDongMBID) return res.status(400).json({ success: false, message: 'Phiên ký không khớp.' });
    const kq = await kyTuXa.kiem(req.params.phienKy);
    if (!kq.xong) return res.json({ success: true, data: { xong: false, dangCho: true, thongDiep: kq.thongDiep } });
    await hoanTatTuXaMoyn(req, res, d, kq);
  } catch (e) { delete req.session.phienTuXaMoyn; loi(res, e); }
});
router.post('/:id/ky-tu-xa/:phienKy/xac-nhan', ...G('edit', 'danhsach'), async (req, res) => {
  try {
    if (!canKySo(req, res)) return;
    const d = await hopDongChoMoyn(req, res); if (!d) return;
    const ph = req.session.phienTuXaMoyn;
    if (!ph || ph.phienKy !== req.params.phienKy || ph.hopDongId !== d.hd.HopDongMBID) return res.status(400).json({ success: false, message: 'Phiên ký không khớp.' });
    const kq = await kyTuXa.xacNhan(req.params.phienKy, (req.body || {}).otp, (req.body || {}).pin);
    await hoanTatTuXaMoyn(req, res, d, kq);
  } catch (e) { loi(res, e); }
});

module.exports = router;
