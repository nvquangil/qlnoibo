/* ==================================================================================================
   v9.61 — CỔNG KÝ CÔNG KHAI cho KHÁCH (không đăng nhập) — gắn ở /api/public/ky, mở ở cổng công khai (server.js).
   --------------------------------------------------------------------------------------------------
   Mọi thứ đi qua TOKEN trong link (32 byte ngẫu nhiên, CSDL chỉ giữ hash). Không có token hợp lệ = không có gì.
   Trả về CHỈ dữ liệu của hợp đồng đó (bên mua, bảng hàng, trạng thái) — không có ID nội bộ nào khác.
   Chống lạm dụng: giới hạn theo IP (bộ nhớ tiến trình) + OTP khóa theo bên ký (CSDL). Nghiệp vụ ở utils/hopDongCore.js.
   ================================================================================================== */
'use strict';
const express = require('express');
const multer = require('multer');
const { sql, getPool } = require('../db');
const { layIP } = require('../utils/chongDoMatKhau');
const core = require('../utils/hopDongCore');
const kySo = require('../utils/kySoPdf');
const kiemCK = require('../utils/kiemChuKySo');
const gui = require('../utils/guiOtp');
const nhatKy = require('../utils/nhatKyHopDong');
const kyTuXa = require('../utils/kyTuXa');   // v9.62

const router = express.Router();
const upPdf = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

/* Không để lỗi route công khai làm sập tiến trình (cùng cách routes/public.js). */
['get', 'post'].forEach(method => {
  const goc = router[method].bind(router);
  router[method] = function (path, ...handlers) {
    return goc(path, ...handlers.map(h => (typeof h !== 'function' || h.length > 3) ? h : function (req, res, next) {
      try { const out = h(req, res, next); if (out && typeof out.catch === 'function') out.catch(next); return out; } catch (e) { next(e); }
    }));
  };
});

// ---------------------------------------------------------------- giới hạn theo IP (bộ nhớ)
const bangDem = new Map();
function gioiHan(key, toiDa, ms) {
  const now = Date.now();
  let v = bangDem.get(key);
  if (!v || v.moc + ms < now) v = { moc: now, dem: 0 };
  v.dem += 1; bangDem.set(key, v);
  if (bangDem.size > 20000) { for (const [k, x] of bangDem) if (x.moc + ms < now) bangDem.delete(k); }
  return v.dem <= toiDa;
}
const ctxCua = (req) => ({ ip: layIP(req), ua: req.headers['user-agent'] });
const tuChoi = (res, ma, msg, them) => res.status(ma).json(Object.assign({ success: false, message: msg }, them || {}));

/* Nạp hợp đồng theo token + kiểm hiệu lực. Trả null sau khi đã trả lời lỗi. */
async function napTheoToken(req, res, choPhepDaKy) {
  if (!gioiHan('xem:' + layIP(req), 120, 60 * 1000)) { tuChoi(res, 429, 'Thao tác quá nhanh — thử lại sau một phút.'); return null; }
  const pool = await getPool();
  const d = await core.docTheoToken(pool, req.params.token);
  if (!d) { tuChoi(res, 404, 'Link không tồn tại hoặc đã bị thay bằng link mới. Hỏi lại bên gửi để nhận link mới.'); return null; }
  const { hd, link } = d;
  if (link.VoHieu) { tuChoi(res, 410, 'Link này không còn hiệu lực (đã có link mới, hoặc hợp đồng đã sửa / hủy).', { trangThai: hd.TrangThai }); return null; }
  if (hd.TrangThai === 'Huy') { tuChoi(res, 410, 'Hợp đồng đã bị hủy.', { trangThai: 'Huy' }); return null; }
  if (link.HetHanRoi && hd.TrangThai === 'ChoKy') {
    await core.danhDauHetHan(pool);
    tuChoi(res, 410, 'Link đã hết hạn ký. Liên hệ bên gửi để gửi lại link.', { trangThai: 'HetHan' }); return null;
  }
  if (!choPhepDaKy && hd.TrangThai !== 'ChoKy') {
    tuChoi(res, 409, hd.TrangThai === 'DaKy' ? 'Hợp đồng đã ký xong.' : 'Hợp đồng không còn ở trạng thái chờ ký (' + (core.TEN_TRANG_THAI[hd.TrangThai] || hd.TrangThai) + ').', { trangThai: hd.TrangThai }); return null;
  }
  return Object.assign(d, { pool });
}

// ---------------------------------------------------------------- tra cứu công khai (mã trên trang chứng nhận / QR)
router.get('/tra/:ma', async (req, res) => {
  if (!gioiHan('tra:' + layIP(req), 60, 60 * 1000)) return tuChoi(res, 429, 'Thao tác quá nhanh.');
  const ma = String(req.params.ma || '').trim().toUpperCase();
  if (!/^HD[A-Z0-9]{5}-[A-Z0-9]{5}$/.test(ma)) return tuChoi(res, 400, 'Mã tra cứu không đúng định dạng (HDXXXXX-XXXXX).');
  const pool = await getPool();
  const d0 = (await pool.request().input('m', sql.NVarChar(24), ma).query('SELECT HopDongMBID FROM HopDongMB WHERE MaTraCuu=@m')).recordset[0];
  if (!d0) return tuChoi(res, 404, 'Không có hợp đồng với mã này.');
  const d = await core.docHopDong(pool, d0.HopDongMBID);
  const { hd } = d;
  res.json({ success: true, data: {
    maTraCuu: hd.MaTraCuu, soHopDong: hd.SoHopDong, tenHopDong: hd.TenHopDong, trangThai: hd.TrangThai, tenTrangThai: core.TEN_TRANG_THAI[hd.TrangThai] || hd.TrangThai,
    phienBan: hd.PhienBan, hashGoc: hd.HashGoc, hashCuoi: hd.HashCuoi, xuatBanLuc: hd.XuatBanLuc, khachKyLuc: hd.KhachKyLuc, kyXongLuc: hd.KyXongLuc,
    benKy: d.ben.map(b => ({ ben: b.Ben === 'MOYN' ? 'Bên bán' : 'Bên mua', hoTen: b.HoTen, cachKy: b.CachKy, trangThai: b.TrangThai, kyLuc: b.KyLuc, chungThu: b.ChungThuCN || null }))
  } });
});

// ---------------------------------------------------------------- xem hợp đồng qua link
router.get('/:token', async (req, res) => {
  const d = await napTheoToken(req, res, true);
  if (!d) return;
  const { pool, hd, link, benKhach } = d;
  await pool.request().input('id', sql.Int, link.LinkID).query('UPDATE HopDongMBLink SET MoLanDau = ISNULL(MoLanDau, SYSDATETIME()), MoLanCuoi = SYSDATETIME(), SoLanMo = SoLanMo + 1 WHERE LinkID=@id');
  await nhatKy.ghi(pool, Object.assign({ hopDongId: hd.HopDongMBID, hanhDong: 'XEM', chiTiet: { trangThai: hd.TrangThai }, benKyId: benKhach && benKhach.BenKyID }, ctxCua(req)));
  const cfg = await core.docCauHinhKy(pool);
  const san = gui.kenhSanSang();
  res.json({ success: true, data: {
    soHopDong: hd.SoHopDong, tenHopDong: hd.TenHopDong, trangThai: hd.TrangThai, tenTrangThai: core.TEN_TRANG_THAI[hd.TrangThai] || hd.TrangThai,
    tongTien: hd.TongTien, hanKy: hd.HanKy, maTraCuu: hd.MaTraCuu, xuatBanLuc: hd.XuatBanLuc, khachKyLuc: hd.KhachKyLuc, kyXongLuc: hd.KyXongLuc, loiKySo: hd.TrangThai === 'LoiKySo' ? 'bên bán đang xử lý ký số' : null,
    benBan: { ten: cfg.tenCongTy, nguoiKy: cfg.nguoiKy, chucVu: cfg.chucVu, mst: cfg.mst, diaChi: cfg.diaChi, sdt: cfg.sdt, email: cfg.email },
    benMua: hd.BenMua || {},
    nguoiKy: benKhach ? { hoTen: benKhach.HoTen, chucVu: benKhach.ChucVu, emailChe: gui.cheDich('email', benKhach.Email), sdtChe: gui.cheDich('sms', benKhach.SDT), coEmail: !!benKhach.Email, coSDT: !!benKhach.SDT, trangThai: benKhach.TrangThai, cachKy: benKhach.CachKy, kyLuc: benKhach.KyLuc } : null,
    hang: d.hang.map(h => ({ MaSanPham: h.MaSanPham, TenSanPham: h.TenSanPham, MauSac: h.MauSac, DonVi: h.DonVi, SoLuong: h.SoLuong, DonGia: h.DonGia, ThanhTien: h.ThanhTien })),
    kenh: { email: san.email && !!(benKhach && benKhach.Email), sms: san.sms && !!(benKhach && benKhach.SDT), zalo: san.zalo && !!(benKhach && benKhach.SDT) },
    kenhMacDinh: cfg.kenhMacDinh || 'email', otpHanPhut: core.OTP_HAN_PHUT,
    kyTuXa: (() => { const t = kyTuXa.cauHinh(); return { san: t.san, tenHienThi: t.tenHienThi, nhanUserId: t.nhanUserId, nha: t.nha }; })(),   // v9.62
    loaiVanBan: hd.LoaiVanBan || 'HopDong', hopDongCha: hd.HopDongCha_So ? { so: hd.HopDongCha_So, ten: hd.HopDongCha_Ten, ngay: hd.HopDongCha_Ngay } : null,
    coPdfGoc: core.coFile(hd.FileGoc), coPdfCuoi: core.coFile(hd.FileCuoi), coPdfKhachKy: core.coFile(hd.FileKhachKy), daKy: hd.TrangThai === 'DaKy', choKy: hd.TrangThai === 'ChoKy'
  } });
});

router.get('/:token/pdf', async (req, res) => {
  const d = await napTheoToken(req, res, true);
  if (!d) return;
  const { pool, hd, benKhach } = d;
  /* loai: cuoi (mặc định khi đã ký xong) | goc | khach (bản chính khách đã ký số — file riêng, giữ nguyên chữ ký của khách) */
  const yeuCau = String(req.query.loai || '');
  let loai = 'goc';
  if (yeuCau === 'khach' && core.coFile(hd.FileKhachKy)) loai = 'khach';
  else if (yeuCau !== 'goc' && hd.TrangThai === 'DaKy' && core.coFile(hd.FileCuoi)) loai = 'cuoi';
  const ten = loai === 'cuoi' ? hd.FileCuoi : (loai === 'khach' ? hd.FileKhachKy : hd.FileGoc);
  if (!core.coFile(ten)) return tuChoi(res, 404, 'Chưa có file PDF.');
  await nhatKy.ghi(pool, Object.assign({ hopDongId: hd.HopDongMBID, hanhDong: 'TAI_PDF', chiTiet: { loai, phia: 'khach' }, benKyId: benKhach && benKhach.BenKyID }, ctxCua(req)));
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${req.query.tai ? 'attachment' : 'inline'}; filename="${hd.SoHopDong}${loai === 'cuoi' ? '_da_ky' : ''}.pdf"`);
  res.end(await core.docFile(ten));
});

// ---------------------------------------------------------------- OTP
router.post('/:token/otp', async (req, res) => {
  if (!gioiHan('otp:' + layIP(req), 12, 60 * 60 * 1000)) return tuChoi(res, 429, 'Gửi OTP quá nhiều lần từ địa chỉ này — thử lại sau 1 giờ.');
  const d = await napTheoToken(req, res, false);
  if (!d) return;
  const kenh = ['email', 'sms', 'zalo'].includes((req.body || {}).kenh) ? req.body.kenh : 'email';
  try {
    const kq = await core.taoOtp(d.pool, d, kenh, ctxCua(req));
    res.json({ success: true, data: kq, message: `Đã gửi mã OTP qua ${kenh === 'email' ? 'email' : kenh.toUpperCase()} tới ${kq.dich}. Mã có hiệu lực ${kq.hanPhut} phút.` });
  } catch (e) { tuChoi(res, 400, e.message); }
});

/* Ký bằng OTP: { otp, dongY: true, anhChuKy?: dataURL png ≤ 200KB } */
router.post('/:token/ky', async (req, res) => {
  if (!gioiHan('ky:' + layIP(req), 40, 60 * 60 * 1000)) return tuChoi(res, 429, 'Thử quá nhiều lần — thử lại sau.');
  const d = await napTheoToken(req, res, false);
  if (!d) return;
  const b = req.body || {};
  if (b.dongY !== true && b.dongY !== 'true') return tuChoi(res, 400, 'Bạn cần tick "Tôi đã đọc và đồng ý ký kết" trước khi ký.');
  let anh = null;
  if (b.anhChuKy) {
    const s = String(b.anhChuKy);
    if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(s) || s.length > 200 * 1024) return tuChoi(res, 400, 'Ảnh chữ ký không hợp lệ (PNG, ≤ 200 KB).');
    anh = s;
  }
  let otp;
  try { otp = (await core.kiemOtp(d.pool, d, b.otp, ctxCua(req))).otp; }
  catch (e) { return tuChoi(res, 400, e.message); }
  await core.ghiKhachKy(d.pool, d, { cachKy: 'OTP', kenhOTP: otp.Kenh, dichOTP: otp.Dich, anhChuKy: anh,
    chiTiet: { dongY: true, cau: 'Tôi đồng ý ký kết / Xác nhận đơn hàng', kenh: otp.Kenh, dich: otp.Dich, coChuKyVe: !!anh } }, ctxCua(req));
  // Hoàn tất (trang chứng nhận + ký số MOYN + dấu thời gian) — có thể mất vài giây; lỗi không làm mất việc ký của khách.
  let kq = { trangThai: 'DangKySo' };
  try { kq = await core.hoanTatSauKhachKy(d.pool, d.hd.HopDongMBID, ctxCua(req)); } catch (e) { console.error('[publicKy] hoàn tất sau ký lỗi: ' + e.message); kq = { trangThai: 'LoiKySo', loi: e.message }; }
  res.json({ success: true, data: { trangThai: kq.trangThai, daKySoMoyn: kq.trangThai === 'DaKy', tsa: !!(kq.tsa && kq.tsa.ok) },
    message: kq.trangThai === 'DaKy' ? 'Ký thành công. Hợp đồng đã được bên bán ký số — tải bản PDF bên dưới.' : 'Đã ghi nhận chữ ký của bạn. Bên bán đang ký số; bản PDF đầy đủ sẽ gửi tới email của bạn.' });
});

router.post('/:token/tu-choi', async (req, res) => {
  const d = await napTheoToken(req, res, false);
  if (!d) return;
  const lyDo = String((req.body || {}).lyDo || '').trim().slice(0, 500);
  if (!lyDo) return tuChoi(res, 400, 'Vui lòng nhập lý do từ chối để bên bán biết cần sửa gì.');
  await core.tuChoi(d.pool, d, lyDo, ctxCua(req));
  res.json({ success: true, message: 'Đã ghi nhận từ chối. Bên bán sẽ liên hệ lại.' });
});

// ---------------------------------------------------------------- khách ký số
/* (a) tải lên bản đã ký bằng phần mềm CA của khách (ký lên đúng file đã tải về). */
router.post('/:token/ky-so/tai-len', upPdf.single('file'), async (req, res) => {
  if (!gioiHan('kyso:' + layIP(req), 20, 60 * 60 * 1000)) return tuChoi(res, 429, 'Thử quá nhiều lần — thử lại sau.');
  const d = await napTheoToken(req, res, false);
  if (!d) return;
  if (!req.file) return tuChoi(res, 400, 'Chọn file PDF đã ký.');
  if ((req.body || {}).dongY !== 'true' && (req.body || {}).dongY !== true) return tuChoi(res, 400, 'Bạn cần tick "Tôi đã đọc và đồng ý ký kết".');
  const goc = await core.docFile(d.hd.FileGoc);
  const kq = await kiemCK.kiemBanTaiLen(req.file.buffer, goc, { mst: d.hd.BenMua && d.hd.BenMua.MST, ten: d.hd.BenMua && (d.hd.BenMua.Ten || d.hd.BenMua.NguoiDaiDien) });
  if (!kq.ok) {
    await nhatKy.ghi(d.pool, Object.assign({ hopDongId: d.hd.HopDongMBID, hanhDong: 'KY_SO_KHACH_LOI', chiTiet: { maLoi: kq.maLoi, loi: kq.loi }, benKyId: d.benKhach.BenKyID }, ctxCua(req)));
    return tuChoi(res, 400, kq.loi, { maLoi: kq.maLoi });
  }
  const ten = `khach_${d.hd.HopDongMBID}_v${d.hd.PhienBan}.pdf`;
  await core.ghiFile(ten, req.file.buffer);
  await core.ghiKhachKy(d.pool, d, { cachKy: 'KySo', fileKhachKy: ten, chungThu: kq.cuoi.chungThu, chiTiet: { cach: 'tai_len', chungThu: kq.cuoi.chungThu && kq.cuoi.chungThu.CN, mst: kq.cuoi.chungThu && kq.cuoi.chungThu.MST, canhBao: kq.canhBao } }, ctxCua(req));
  let hk = { trangThai: 'DangKySo' };
  try { hk = await core.hoanTatSauKhachKy(d.pool, d.hd.HopDongMBID, ctxCua(req)); } catch (e) { hk = { trangThai: 'LoiKySo', loi: e.message }; }
  res.json({ success: true, data: { trangThai: hk.trangThai, daKySoMoyn: hk.trangThai === 'DaKy', canhBao: kq.canhBao, chungThu: kq.cuoi.chungThu && kq.cuoi.chungThu.CN },
    message: 'Đã nhận chữ ký số của bạn.' + (kq.canhBao && kq.canhBao.length ? ' Lưu ý: ' + kq.canhBao.join(' ') : '') });
});
/* (b) ký ngay trên web bằng công cụ MOYN Ký số (USB token trên máy khách) — 2 bước. */
router.post('/:token/ky-so/bat-dau', async (req, res) => {
  if (!gioiHan('kyso:' + layIP(req), 20, 60 * 60 * 1000)) return tuChoi(res, 429, 'Thử quá nhiều lần — thử lại sau.');
  const d = await napTheoToken(req, res, false);
  if (!d) return;
  const certDer = Buffer.from(String((req.body || {}).certDer || ''), 'base64');
  if (certDer.length < 100) return tuChoi(res, 400, 'Thiếu chứng thư số.');
  try {
    const kq = await kySo.batDauKyNgoai(await core.docFile(d.hd.FileGoc), certDer, { lyDo: 'Ký hợp đồng ' + d.hd.SoHopDong, viTri: 'Việt Nam' });
    const tt = kq.thongTin || {};
    const canhBao = [];
    const bm = d.hd.BenMua || {};
    if (bm.MST && tt.MST && String(tt.MST).replace(/\D/g, '') !== String(bm.MST).replace(/\D/g, '')) canhBao.push(`MST trên chứng thư (${tt.MST}) khác MST bên mua (${bm.MST}).`);
    res.json({ success: true, data: { phienKy: kq.phienKy, dataKy: kq.dataKy, thuatToan: kq.thuatToan, chungThu: { CN: tt.CN, MST: tt.MST, denNgay: tt.denNgay }, canhBao } });
  } catch (e) { tuChoi(res, 400, e.message); }
});
router.post('/:token/ky-so/hoan-tat', async (req, res) => {
  const d = await napTheoToken(req, res, false);
  if (!d) return;
  const b = req.body || {};
  if (b.dongY !== true && b.dongY !== 'true') return tuChoi(res, 400, 'Bạn cần tick "Tôi đã đọc và đồng ý ký kết".');
  let kq;
  try { kq = await kySo.hoanTatKyNgoai(b.phienKy, b.chuKy); }
  catch (e) { return tuChoi(res, 400, e.message); }
  const ten = `khach_${d.hd.HopDongMBID}_v${d.hd.PhienBan}.pdf`;
  await core.ghiFile(ten, kq.pdf);
  await core.ghiKhachKy(d.pool, d, { cachKy: 'KySo', fileKhachKy: ten, chungThu: kq.thongTin, chiTiet: { cach: 'cong_cu', chungThu: kq.thongTin && kq.thongTin.CN, mst: kq.thongTin && kq.thongTin.MST, tsa: !!(kq.tsa && kq.tsa.ok) } }, ctxCua(req));
  let hk = { trangThai: 'DangKySo' };
  try { hk = await core.hoanTatSauKhachKy(d.pool, d.hd.HopDongMBID, ctxCua(req)); } catch (e) { hk = { trangThai: 'LoiKySo', loi: e.message }; }
  res.json({ success: true, data: { trangThai: hk.trangThai, daKySoMoyn: hk.trangThai === 'DaKy', chungThu: kq.thongTin && kq.thongTin.CN }, message: 'Đã ký số thành công.' });
});

/* (c) v9.62 — ký TỪ XA qua CA: khách nhập mã SmartCA (SĐT/CCCD) → xác nhận trên app CA (poll) hoặc nhập OTP (CSC). Không cài gì. */
const phienTuXaKhach = new Map();   // phienKy -> { linkId, taoLuc }
router.post('/:token/ky-tu-xa/bat-dau', async (req, res) => {
  if (!gioiHan('kytuxa:' + layIP(req), 10, 60 * 60 * 1000)) return tuChoi(res, 429, 'Thử quá nhiều lần — thử lại sau.');
  const d = await napTheoToken(req, res, false);
  if (!d) return;
  const b = req.body || {};
  if (b.dongY !== true && b.dongY !== 'true') return tuChoi(res, 400, 'Bạn cần tick "Tôi đã đọc và đồng ý ký kết".');
  try {
    const kq = await kyTuXa.batDau({ pdfBuffer: await core.docFile(d.hd.FileGoc), userId: b.userId, serial: b.serial, moTa: 'Ký hợp đồng ' + d.hd.SoHopDong, tt: { lyDo: 'Ký hợp đồng ' + d.hd.SoHopDong, viTri: 'Việt Nam' } });
    for (const [k, v] of phienTuXaKhach) if (Date.now() - v.taoLuc > 15 * 60 * 1000) phienTuXaKhach.delete(k);
    phienTuXaKhach.set(kq.phienKy, { linkId: d.link.LinkID, userId: String(b.userId || ''), nha: kq.nha, taoLuc: Date.now() });
    await nhatKy.ghi(d.pool, Object.assign({ hopDongId: d.hd.HopDongMBID, hanhDong: 'KY_TU_XA_BAT_DAU', chiTiet: { nha: kq.nha, chungThu: kq.thongTin && kq.thongTin.CN, mst: kq.thongTin && kq.thongTin.MST }, benKyId: d.benKhach.BenKyID }, ctxCua(req)));
    const tt = kq.thongTin || {}, bm = d.hd.BenMua || {};
    const canhBao = [];
    if (bm.MST && tt.MST && String(tt.MST).replace(/\D/g, '') !== String(bm.MST).replace(/\D/g, '')) canhBao.push(`MST trên chứng thư (${tt.MST}) khác MST bên mua (${bm.MST}).`);
    res.json({ success: true, data: { phienKy: kq.phienKy, kieu: kq.kieu, huongDan: kq.huongDan, chungThu: { CN: tt.CN, MST: tt.MST, denNgay: tt.denNgay }, nha: kq.nha, canhBao } });
  } catch (e) {
    await nhatKy.ghi(d.pool, Object.assign({ hopDongId: d.hd.HopDongMBID, hanhDong: 'KY_TU_XA_LOI', chiTiet: { loi: e.message }, benKyId: d.benKhach.BenKyID }, ctxCua(req)));
    tuChoi(res, 400, e.message);
  }
});
async function hoanTatTuXaKhach(req, res, d, ph, kq) {
  const ten = `khach_${d.hd.HopDongMBID}_v${d.hd.PhienBan}.pdf`;
  await core.ghiFile(ten, kq.kq.pdf);
  await core.ghiKhachKy(d.pool, d, { cachKy: 'KySo', fileKhachKy: ten, chungThu: kq.kq.thongTin, kyTuXa: { nha: ph.nha, userId: ph.userId },
    chiTiet: { cach: 'tu_xa', nha: ph.nha, chungThu: kq.kq.thongTin && kq.kq.thongTin.CN, mst: kq.kq.thongTin && kq.kq.thongTin.MST, tsa: !!(kq.kq.tsa && kq.kq.tsa.ok) } }, ctxCua(req));
  let hk = { trangThai: 'DangKySo' };
  try { hk = await core.hoanTatSauKhachKy(d.pool, d.hd.HopDongMBID, ctxCua(req)); } catch (e) { hk = { trangThai: 'LoiKySo', loi: e.message }; }
  res.json({ success: true, data: { xong: true, trangThai: hk.trangThai, daKySoMoyn: hk.trangThai === 'DaKy', chungThu: kq.kq.thongTin && kq.kq.thongTin.CN }, message: 'Đã ký số từ xa thành công.' });
}
function phienKhach(req, res, d) {
  const ph = phienTuXaKhach.get(String(req.params.phienKy || ''));
  if (!ph || ph.linkId !== d.link.LinkID) { tuChoi(res, 400, 'Phiên ký từ xa không tồn tại hoặc đã hết hạn — bấm ký lại.'); return null; }
  return ph;
}
router.get('/:token/ky-tu-xa/:phienKy', async (req, res) => {
  const d = await napTheoToken(req, res, false);
  if (!d) return;
  const ph = phienKhach(req, res, d); if (!ph) return;
  try {
    const kq = await kyTuXa.kiem(req.params.phienKy);
    if (!kq.xong) return res.json({ success: true, data: { xong: false, dangCho: true, thongDiep: kq.thongDiep } });
    phienTuXaKhach.delete(req.params.phienKy);
    await hoanTatTuXaKhach(req, res, d, ph, kq);
  } catch (e) { phienTuXaKhach.delete(req.params.phienKy); await loiTuXa(req, d, e); tuChoi(res, 400, e.message); }
});
/* Lỗi ở bước poll / xác nhận: ghi nhật ký (không ném — nhật ký lỗi không được che lỗi gốc). */
async function loiTuXa(req, d, e) {
  try { await nhatKy.ghi(d.pool, Object.assign({ hopDongId: d.hd.HopDongMBID, hanhDong: 'KY_TU_XA_LOI', chiTiet: { loi: e.message }, benKyId: d.benKhach.BenKyID }, ctxCua(req))); } catch (e2) { /* bỏ */ }
}
router.post('/:token/ky-tu-xa/:phienKy/xac-nhan', async (req, res) => {
  const d = await napTheoToken(req, res, false);
  if (!d) return;
  const ph = phienKhach(req, res, d); if (!ph) return;
  try {
    const kq = await kyTuXa.xacNhan(req.params.phienKy, (req.body || {}).otp, (req.body || {}).pin);
    phienTuXaKhach.delete(req.params.phienKy);
    await hoanTatTuXaKhach(req, res, d, ph, kq);
  } catch (e) { await loiTuXa(req, d, e); tuChoi(res, 400, e.message); }   // OTP sai: phiên còn, khách nhập lại
});

router.use((err, req, res, next) => {   // eslint-disable-line no-unused-vars
  console.error('[publicKy]', err);
  res.status(500).json({ success: false, message: 'Lỗi máy chủ: ' + (err && err.message ? err.message : 'không rõ') });
});

module.exports = router;
