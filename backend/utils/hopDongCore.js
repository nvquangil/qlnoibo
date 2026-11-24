/* ==================================================================================================
   v9.61 — HỢP ĐỒNG MUA BÁN: nghiệp vụ dùng chung cho routes/hopdong.js (nội bộ) và routes/publicKy.js (khách).
   --------------------------------------------------------------------------------------------------
   Một nghiệp vụ một luồng: xuất bản PDF, tạo/gửi link, OTP, hoàn tất sau khi khách ký (trang chứng nhận
   + ký số MOYN tự động + dấu thời gian), lưu file — đều ở đây; hai router chỉ gác quyền và gọi.
   File PDF ở backend/uploads_hopdong/ — KHÔNG static, đọc qua route có kiểm quyền / token hợp lệ.
   Thời gian: so sánh hạn trong SQL (SYSDATETIME) — không đem Date JS đi so (mssql useUTC).
   ================================================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { sql } = require('../db');
const pdfU = require('./hopDongPdf');
const kySo = require('./kySoPdf');
const kiemCK = require('./kiemChuKySo');
const gui = require('./guiOtp');
const nhatKy = require('./nhatKyHopDong');

const THU_MUC = path.join(__dirname, '..', 'uploads_hopdong');
if (!fs.existsSync(THU_MUC)) fs.mkdirSync(THU_MUC, { recursive: true });
const duongFile = (ten) => path.join(THU_MUC, path.basename(String(ten || '')));
const docFile = (ten) => fs.promises.readFile(duongFile(ten));
async function ghiFile(ten, buf) { await fs.promises.writeFile(duongFile(ten), buf); return path.basename(ten); }
const coFile = (ten) => !!ten && fs.existsSync(duongFile(ten));

const KHOA_CAU_HINH = 'HOPDONG_KY';
const CAU_HINH_MAC_DINH = {
  tenCongTy: '', diaChi: '', mst: '', nguoiKy: '', chucVu: 'Giám đốc', sdt: '', email: '', soTaiKhoan: '', diaDiemKy: '',
  hanLinkNgay: 7, kenhMacDinh: 'email', emailKeToan: '', ghiChuThue: 'đã bao gồm VAT',
  batNhac: true, nhacTruocNgay: 2, gioNhac: '08:30'   // v9.62: nhắc hạn ký tự động (utils/nhacHanKy.js)
};
const TEN_LOAI_VAN_BAN = { HopDong: 'Hợp đồng', PhuLuc: 'Phụ lục', ThanhLy: 'Biên bản thanh lý' };
const TIEN_TO_SO = { HopDong: 'HD', PhuLuc: 'PL', ThanhLy: 'TL' };
/* v9.62: cột migration_v894 có chưa (dò một lần, đệm) — thiếu thì vẫn chạy như v9.61. */
let _coV894 = null;
async function coV894(pool) {
  if (_coV894 !== null) return _coV894;
  try { const r = (await pool.request().query("SELECT COL_LENGTH('HopDongMB','LoaiVanBan') AS a, COL_LENGTH('HopDongMBBenKy','ChuoiTinCay') AS b")).recordset[0] || {}; _coV894 = !!(r.a && r.b); }
  catch (e) { _coV894 = false; }
  return _coV894;
}
const TOKEN_BYTES = 32, OTP_HAN_PHUT = 5, OTP_SAI_TOI_DA = 5, OTP_KHOA_PHUT = 15, OTP_GUI_TOI_DA_GIO = 6;
const TRANG_THAI = ['Nhap', 'ChoKy', 'DangKySo', 'ChoMoynKy', 'DaKy', 'TuChoi', 'HetHan', 'Huy', 'LoiKySo'];
const TEN_TRANG_THAI = { Nhap: 'Nháp', ChoKy: 'Chờ khách ký', DangKySo: 'Đang ký số', ChoMoynKy: 'Chờ MOYN ký số', DaKy: 'Đã ký', TuChoi: 'Khách từ chối', HetHan: 'Hết hạn', Huy: 'Đã hủy', LoiKySo: 'Lỗi ký số' };

const sha256Hex = (s) => crypto.createHash('sha256').update(s).digest('hex');
const SQL_NGAY_GIO = (c) => `CONVERT(varchar(19), ${c}, 120)`;
function urlCongKhai(duong) {
  const goc = String(process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
  return goc + duong;
}

// ---------------------------------------------------------------- cấu hình
async function docCauHinhKy(pool) {
  let luu = {};
  try {
    const r = (await pool.request().input('k', sql.NVarChar, KHOA_CAU_HINH).query('SELECT GiaTri FROM CauHinh WHERE Khoa=@k')).recordset[0];
    luu = r && r.GiaTri ? JSON.parse(r.GiaTri) : {};
  } catch (e) { luu = {}; }
  const cfg = Object.assign({}, CAU_HINH_MAC_DINH, luu);
  cfg.hanLinkNgay = Number(cfg.hanLinkNgay) > 0 ? Number(cfg.hanLinkNgay) : 7;
  if (!cfg.tenCongTy) cfg.tenCongTy = gui.tenCongTy();
  return cfg;
}
async function luuCauHinhKy(pool, cfg) {
  const sach = {};
  Object.keys(CAU_HINH_MAC_DINH).forEach(k => { if (cfg[k] !== undefined) sach[k] = typeof cfg[k] === 'string' ? cfg[k].trim().slice(0, 500) : cfg[k]; });
  if (sach.batNhac !== undefined) sach.batNhac = sach.batNhac === true || sach.batNhac === 'true' || sach.batNhac === 'on' || sach.batNhac === 1 || sach.batNhac === '1';
  if (sach.nhacTruocNgay !== undefined) sach.nhacTruocNgay = Math.max(0, Math.min(30, Number(sach.nhacTruocNgay) || 0));
  if (sach.gioNhac !== undefined && !/^\d{1,2}:\d{2}$/.test(String(sach.gioNhac))) sach.gioNhac = '08:30';
  const json = JSON.stringify(sach);
  const up = await pool.request().input('k', sql.NVarChar, KHOA_CAU_HINH).input('v', sql.NVarChar(sql.MAX), json)
    .query('UPDATE CauHinh SET GiaTri=@v, UpdatedAt=SYSDATETIME() WHERE Khoa=@k');
  if (!up.rowsAffected[0]) {
    await pool.request().input('k', sql.NVarChar, KHOA_CAU_HINH).input('v', sql.NVarChar(sql.MAX), json)
      .query('INSERT INTO CauHinh (Khoa, GiaTri, UpdatedAt) VALUES (@k, @v, SYSDATETIME())');
  }
  return sach;
}

// ---------------------------------------------------------------- đọc
const COT_HD = `h.HopDongMBID, h.SoHopDong, h.TenHopDong, h.KhachHangID, h.BenMuaJson, h.Nguon, h.MaMau, h.PhienBanMau, h.GiaTriBien, h.NoiDungHtml,
  h.TongTien, h.TrangThai, h.TrangThaiThanhToan, h.PhienBan, h.FileNguon, h.FileGoc, h.HashGoc, h.FileKhachKy, h.FileChoMoyn, h.FileCuoi, h.HashCuoi,
  h.MaTraCuu, ${SQL_NGAY_GIO('h.HanKy')} AS HanKy, ${SQL_NGAY_GIO('h.XuatBanLuc')} AS XuatBanLuc, ${SQL_NGAY_GIO('h.KhachKyLuc')} AS KhachKyLuc,
  ${SQL_NGAY_GIO('h.KyXongLuc')} AS KyXongLuc, h.LoiKySo, h.GhiChu, h.NguoiTaoID, ${SQL_NGAY_GIO('h.CreatedAt')} AS CreatedAt, ${SQL_NGAY_GIO('h.UpdatedAt')} AS UpdatedAt,
  CASE WHEN h.HanKy IS NOT NULL AND h.HanKy < SYSDATETIME() THEN 1 ELSE 0 END AS QuaHan, u.HoTen AS NguoiTao, kh.TenKhachHang`;
const COT_BEN = `b.BenKyID, b.HopDongMBID, b.Ben, b.HoTen, b.ChucVu, b.Email, b.SDT, b.CachKy, b.TrangThai, ${SQL_NGAY_GIO('b.KyLuc')} AS KyLuc, b.IP, b.UserAgent,
  b.KenhOTP, b.DichOTP, b.ChungThuCN, b.ChungThuMST, b.ChungThuSerial, ${SQL_NGAY_GIO('b.ChungThuHetHan')} AS ChungThuHetHan, b.LyDoTuChoi, b.ThuTu`;

/* v9.62: cột thêm của migration_v894 (loại văn bản, hợp đồng cha, hóa đơn, nhắc; bên ký: ký từ xa, chuỗi tin cậy). */
const COT_HD_V894 = `, h.LoaiVanBan, h.HopDongChaID, h.SoHoaDon, CONVERT(varchar(10), h.NgayHoaDon, 23) AS NgayHoaDon, ${SQL_NGAY_GIO('h.NhacLanCuoi')} AS NhacLanCuoi,
  cha.SoHopDong AS HopDongCha_So, cha.TenHopDong AS HopDongCha_Ten, CONVERT(varchar(10), ISNULL(cha.KyXongLuc, cha.XuatBanLuc), 23) AS HopDongCha_Ngay`;
const COT_BEN_V894 = ', b.KyTuXaNha, b.KyTuXaUserId, b.ChuoiTinCay';

async function docHopDong(pool, id) {
  const v894 = await coV894(pool);
  const hd = (await pool.request().input('id', sql.Int, Number(id)).query(`
    SELECT ${COT_HD}${v894 ? COT_HD_V894 : ''} FROM HopDongMB h LEFT JOIN Users u ON u.UserID = h.NguoiTaoID LEFT JOIN KhachHang kh ON kh.KhachHangID = h.KhachHangID
    ${v894 ? 'LEFT JOIN HopDongMB cha ON cha.HopDongMBID = h.HopDongChaID' : ''}
    WHERE h.HopDongMBID=@id`)).recordset[0];
  if (!hd) return null;
  if (!hd.LoaiVanBan) hd.LoaiVanBan = 'HopDong';
  const ben = (await pool.request().input('id', sql.Int, hd.HopDongMBID).query(`SELECT ${COT_BEN}${v894 ? COT_BEN_V894 : ''} FROM HopDongMBBenKy b WHERE b.HopDongMBID=@id ORDER BY b.ThuTu, b.BenKyID`)).recordset;
  const hang = (await pool.request().input('id', sql.Int, hd.HopDongMBID).query(`SELECT * FROM HopDongMBHang WHERE HopDongMBID=@id ORDER BY ThuTu, ID`)).recordset;
  try { hd.BenMua = hd.BenMuaJson ? JSON.parse(hd.BenMuaJson) : null; } catch (e) { hd.BenMua = null; }
  try { hd.GiaTriBienObj = hd.GiaTriBien ? JSON.parse(hd.GiaTriBien) : {}; } catch (e) { hd.GiaTriBienObj = {}; }
  return { hd, ben, hang, benKhach: ben.find(b => b.Ben === 'Khach') || null, benMoyn: ben.find(b => b.Ben === 'MOYN') || null };
}

/* Tìm theo token link (chỉ có hash trong CSDL). Trả null nếu không có; kèm cờ hetHan / voHieu. */
async function docTheoToken(pool, token) {
  const t = String(token || '').trim();
  if (!/^[A-Za-z0-9_-]{30,80}$/.test(t)) return null;
  const link = (await pool.request().input('h', sql.Char(64), sha256Hex(t)).query(`
    SELECT l.LinkID, l.HopDongMBID, l.BenKyID, l.PhienBan, l.VoHieu, l.SoLanMo, ${SQL_NGAY_GIO('l.HetHan')} AS HetHan,
           CASE WHEN l.HetHan < SYSDATETIME() THEN 1 ELSE 0 END AS HetHanRoi
    FROM HopDongMBLink l WHERE l.TokenHash=@h`)).recordset[0];
  if (!link) return null;
  const d = await docHopDong(pool, link.HopDongMBID);
  if (!d) return null;
  const ben = d.ben.find(b => b.BenKyID === link.BenKyID) || null;
  return Object.assign(d, { link, benLink: ben });
}

// ---------------------------------------------------------------- số hợp đồng
async function soHopDongMoi(pool, loaiVanBan) {
  const tt = TIEN_TO_SO[loaiVanBan] || 'HD';   // v9.62: HD / PL (phụ lục) / TL (thanh lý)
  const yy = String(new Date().getFullYear()).slice(-2);
  const r = (await pool.request().input('p', sql.NVarChar, tt + yy + '%').query(
    "SELECT MAX(CAST(SUBSTRING(SoHopDong, 5, 10) AS INT)) AS m FROM HopDongMB WHERE SoHopDong LIKE @p AND LEN(SoHopDong) >= 8 AND ISNUMERIC(SUBSTRING(SoHopDong, 5, 10)) = 1")).recordset[0];
  const n = (r && r.m ? Number(r.m) : 0) + 1;
  return tt + yy + String(n).padStart(4, '0');
}

// ---------------------------------------------------------------- biến + HTML hợp đồng
function benMuaTuKhach(k) {
  if (!k) return {};
  return {
    LoaiDoiTac: k.LoaiDoiTac || '', Ten: k.TenHoaDon || k.TenKhachHang || '', DiaChi: k.DiaChiHoaDon || k.DiaChi || '', MST: k.MaSoThue || '',
    SoDKKD: k.SoDKKD || '', NgayCapDKKD: k.NgayCapDKKD || '', NoiCapDKKD: k.NoiCapDKKD || '', NguoiDaiDien: k.NguoiDaiDien || '',
    ChucVu: k.ChucVuNDD || '', CCCD: k.SoCCCD || '', SDT: k.SDTNguoiKy || k.SDT || '', Email: k.EmailNguoiKy || k.EmailHoaDon || k.Email || ''
  };
}
/* Giá trị biến chuẩn: cấu hình bên bán + bên mua + hợp đồng. Người dùng gõ đè được (GiaTriBien). */
function bienChuan(hd, benMua, cfg, hang) {
  const bm = benMua || {};
  const tong = (hang || []).reduce((t, h) => t + (Number(h.ThanhTien) || 0), 0) || Number(hd.TongTien) || 0;
  return {
    SoHopDong: hd.SoHopDong || '', TenHopDong: hd.TenHopDong || '', NgayKy: pdfU.ngayChu(new Date()), DiaDiemKy: cfg.diaDiemKy || '',
    BenBan_Ten: cfg.tenCongTy || '', BenBan_DiaChi: cfg.diaChi || '', BenBan_MST: cfg.mst || '', BenBan_NguoiDaiDien: cfg.nguoiKy || '',
    BenBan_ChucVu: cfg.chucVu || '', BenBan_SDT: cfg.sdt || '', BenBan_Email: cfg.email || '', BenBan_SoTaiKhoan: cfg.soTaiKhoan || '',
    BenMua_Ten: bm.Ten || '', BenMua_DiaChi: bm.DiaChi || '', BenMua_MST: bm.MST || '', BenMua_SoDKKD: bm.SoDKKD || '',
    BenMua_NgayCapDKKD: bm.NgayCapDKKD ? pdfU.ddmmyyyy(bm.NgayCapDKKD) : '', BenMua_NoiCapDKKD: bm.NoiCapDKKD || '',
    BenMua_NguoiDaiDien: bm.NguoiDaiDien || '', BenMua_ChucVu: bm.ChucVu || '', BenMua_CCCD: bm.CCCD || '', BenMua_SDT: bm.SDT || '', BenMua_Email: bm.Email || '',
    TongTien: tong ? pdfU.fmtSo(tong) : '', TongTienBangChu: tong ? pdfU.soThanhChu(tong) : '', GhiChuThue: cfg.ghiChuThue || '',
    // v9.62: phụ lục / thanh lý tham chiếu văn bản gốc
    LoaiVanBan: TEN_LOAI_VAN_BAN[hd.LoaiVanBan] || 'Hợp đồng', HopDongCha_So: hd.HopDongCha_So || '', HopDongCha_Ten: hd.HopDongCha_Ten || '',
    HopDongCha_Ngay: hd.HopDongCha_Ngay ? pdfU.ddmmyyyy(hd.HopDongCha_Ngay) : ''
  };
}
async function docMau(pool, maMau) {
  return (await pool.request().input('m', sql.NVarChar, String(maMau || '')).query('SELECT MaMau, TenMau, NoiDung, PhienBan FROM MauHopDongMB WHERE MaMau=@m')).recordset[0] || null;
}
/* HTML (không bọc A4) của hợp đồng từ mẫu + biến. Trả { html, bienThieu, phienBanMau }. */
async function dungHtml(pool, d, cfg) {
  const hd = d.hd;
  const mau = await docMau(pool, hd.MaMau);
  if (!mau) throw new Error('Không thấy mẫu hợp đồng "' + hd.MaMau + '"');
  /* Ô người dùng để TRỐNG thì không đè giá trị tự điền (NgayKy, DiaDiemKy, HopDongCha_* …) — v9.62. */
  const goTay = {};
  Object.keys(hd.GiaTriBienObj || {}).forEach(k => { const v = hd.GiaTriBienObj[k]; if (v != null && String(v).trim() !== '') goTay[k] = v; });
  const gia = Object.assign(bienChuan(hd, hd.BenMua, cfg, d.hang), goTay);
  const bang = pdfU.bangHangHtml(d.hang);
  const bienTrongMau = pdfU.timBien(mau.NoiDung);
  const bienThieu = bienTrongMau.filter(b => b !== 'BangHang' && (gia[b] == null || String(gia[b]).trim() === ''));
  return { html: pdfU.thayBien(mau.NoiDung, gia, bang), bienThieu, phienBanMau: mau.PhienBan, gia };
}

// ---------------------------------------------------------------- link + gửi
async function taoLink(pool, hd, benKhach, hanNgay) {
  const token = crypto.randomBytes(TOKEN_BYTES).toString('base64url');
  await pool.request().input('hd', sql.Int, hd.HopDongMBID).query('UPDATE HopDongMBLink SET VoHieu=1 WHERE HopDongMBID=@hd AND VoHieu=0');
  await pool.request().input('hd', sql.Int, hd.HopDongMBID).input('ben', sql.Int, benKhach.BenKyID).input('h', sql.Char(64), sha256Hex(token))
    .input('pb', sql.Int, hd.PhienBan || 1).input('ngay', sql.Int, Number(hanNgay) || 7)
    .query(`INSERT INTO HopDongMBLink (HopDongMBID, BenKyID, TokenHash, PhienBan, HetHan) VALUES (@hd, @ben, @h, @pb, DATEADD(day, @ngay, SYSDATETIME()))`);
  await pool.request().input('hd', sql.Int, hd.HopDongMBID).input('ngay', sql.Int, Number(hanNgay) || 7)
    .query('UPDATE HopDongMB SET HanKy = DATEADD(day, @ngay, SYSDATETIME()) WHERE HopDongMBID=@hd');
  return { token, link: urlCongKhai('/ky.html?t=' + token) };
}
/* Lấy link còn hiệu lực hay tạo mới (token chỉ biết lúc tạo — gửi lại = tạo token mới, link cũ vô hiệu). */
async function guiLinkChoKhach(pool, d, kenh, ctx) {
  const { hd, benKhach } = d;
  if (!benKhach) throw new Error('Hợp đồng chưa có bên ký phía khách');
  const cfg = await docCauHinhKy(pool);
  const { link } = await taoLink(pool, hd, benKhach, cfg.hanLinkNgay);
  const dich = kenh === 'email' ? benKhach.Email : benKhach.SDT;
  const kq = await gui.guiLinkKy(kenh, dich, { link, soHopDong: hd.SoHopDong, tenHopDong: hd.TenHopDong, tenNguoiKy: benKhach.HoTen, hanKy: cfg.hanLinkNgay + ' ngày' });
  await nhatKy.ghi(pool, { hopDongId: hd.HopDongMBID, hanhDong: 'GUI_LINK', chiTiet: { kenh, dich: gui.cheDich(kenh, dich), ok: kq.ok, loi: kq.loi }, ip: ctx && ctx.ip, ua: ctx && ctx.ua, userId: ctx && ctx.userId, benKyId: benKhach.BenKyID });
  return { link, kq, dich: gui.cheDich(kenh, dich) };
}

// ---------------------------------------------------------------- xuất bản
async function xuatBan(pool, id, ctx) {
  const d = await docHopDong(pool, id);
  if (!d) throw new Error('Không thấy hợp đồng');
  const hd = d.hd;
  if (!['Nhap', 'TuChoi', 'HetHan', 'ChoKy'].includes(hd.TrangThai)) throw new Error('Hợp đồng đang ở trạng thái "' + (TEN_TRANG_THAI[hd.TrangThai] || hd.TrangThai) + '" — không xuất bản lại được.');
  if (!d.benKhach) throw new Error('Chưa khai người ký phía khách');
  if (!d.benKhach.Email && !d.benKhach.SDT) throw new Error('Người ký phía khách phải có email hoặc số điện thoại (để nhận link và OTP).');
  const cfg = await docCauHinhKy(pool);
  let pdf, phienBanMau = hd.PhienBanMau, html = hd.NoiDungHtml, bienThieu = [];
  if (hd.Nguon === 'PDF') {
    if (!coFile(hd.FileNguon)) throw new Error('Chưa tải lên file PDF soạn sẵn.');
    pdf = await pdfU.chuanHoaPdf(await docFile(hd.FileNguon));
  } else {
    const kq = await dungHtml(pool, d, cfg);
    html = kq.html; bienThieu = kq.bienThieu; phienBanMau = kq.phienBanMau;
    pdf = await pdfU.htmlToPdf(pdfU.wrapA4(html, hd.SoHopDong + ' ' + hd.TenHopDong));
  }
  const phienBan = (hd.PhienBan || 0) + 1;
  const tenFile = `goc_${hd.HopDongMBID}_v${phienBan}.pdf`;
  await ghiFile(tenFile, pdf);
  const hash = pdfU.sha256Hex(pdf);
  const maTraCuu = hd.MaTraCuu || pdfU.maTraCuuMoi();
  await pool.request().input('id', sql.Int, hd.HopDongMBID).input('f', sql.NVarChar(260), tenFile).input('h', sql.Char(64), hash)
    .input('pb', sql.Int, phienBan).input('pbm', sql.Int, phienBanMau || null).input('html', sql.NVarChar(sql.MAX), html || null).input('ma', sql.NVarChar(24), maTraCuu)
    .query(`UPDATE HopDongMB SET FileGoc=@f, HashGoc=@h, PhienBan=@pb, PhienBanMau=@pbm, NoiDungHtml=@html, MaTraCuu=@ma, TrangThai=N'ChoKy',
            XuatBanLuc=SYSDATETIME(), UpdatedAt=SYSDATETIME(), FileKhachKy=NULL, FileChoMoyn=NULL, FileCuoi=NULL, HashCuoi=NULL, LoiKySo=NULL WHERE HopDongMBID=@id`);
  await pool.request().input('id', sql.Int, hd.HopDongMBID).query(`UPDATE HopDongMBBenKy SET TrangThai=N'ChoKy', CachKy=NULL, KyLuc=NULL, IP=NULL, UserAgent=NULL, AnhChuKy=NULL, KenhOTP=NULL, DichOTP=NULL,
    ChungThuCN=NULL, ChungThuMST=NULL, ChungThuSerial=NULL, ChungThuHetHan=NULL, LyDoTuChoi=NULL WHERE HopDongMBID=@id`);
  await nhatKy.ghi(pool, { hopDongId: hd.HopDongMBID, hanhDong: 'XUAT_BAN', chiTiet: { phienBan, hash, bienThieu }, ip: ctx && ctx.ip, ua: ctx && ctx.ua, userId: ctx && ctx.userId });
  const d2 = await docHopDong(pool, hd.HopDongMBID);
  const { token, link } = await taoLink(pool, d2.hd, d2.benKhach, cfg.hanLinkNgay);
  return { d: d2, token, link, bienThieu, hash };
}

// ---------------------------------------------------------------- OTP
async function taoOtp(pool, d, kenh, ctx) {
  const { hd, benKhach } = d;
  const san = gui.kenhSanSang();
  if (!san[kenh]) throw new Error({ email: 'Máy chủ chưa cấu hình gửi email.', sms: 'Kênh SMS chưa được cấu hình trên máy chủ — dùng Email.', zalo: 'Kênh Zalo chưa bật — dùng Email/SMS.' }[kenh] || 'Kênh không hợp lệ.');
  const dich = kenh === 'email' ? benKhach.Email : benKhach.SDT;
  if (!dich) throw new Error(kenh === 'email' ? 'Hợp đồng chưa khai email người ký.' : 'Hợp đồng chưa khai số điện thoại người ký.');
  // chống spam: ≤ 6 OTP / giờ cho một bên ký
  const dem = (await pool.request().input('b', sql.Int, benKhach.BenKyID).query('SELECT COUNT(*) AS n FROM HopDongMBOTP WHERE BenKyID=@b AND CreatedAt > DATEADD(hour, -1, SYSDATETIME())')).recordset[0];
  if (dem && dem.n >= OTP_GUI_TOI_DA_GIO) throw new Error('Đã gửi quá nhiều mã trong 1 giờ. Vui lòng thử lại sau.');
  const khoa = (await pool.request().input('b', sql.Int, benKhach.BenKyID).query('SELECT TOP 1 CASE WHEN KhoaDen IS NOT NULL AND KhoaDen > SYSDATETIME() THEN 1 ELSE 0 END AS k FROM HopDongMBOTP WHERE BenKyID=@b ORDER BY OtpID DESC')).recordset[0];
  if (khoa && khoa.k) throw new Error(`Nhập sai quá ${OTP_SAI_TOI_DA} lần — tạm khóa ${OTP_KHOA_PHUT} phút.`);
  const ma = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  await pool.request().input('b', sql.Int, benKhach.BenKyID).query('UPDATE HopDongMBOTP SET HetHan = SYSDATETIME() WHERE BenKyID=@b AND DungLuc IS NULL');   // mã cũ hết hiệu lực
  await pool.request().input('b', sql.Int, benKhach.BenKyID).input('h', sql.Char(64), sha256Hex(ma + '|' + benKhach.BenKyID)).input('k', sql.NVarChar(10), kenh)
    .input('d', sql.NVarChar(150), gui.cheDich(kenh, dich)).input('p', sql.Int, OTP_HAN_PHUT)
    .query('INSERT INTO HopDongMBOTP (BenKyID, OtpHash, Kenh, Dich, HetHan) VALUES (@b, @h, @k, @d, DATEADD(minute, @p, SYSDATETIME()))');
  const kq = await gui.guiOtp(kenh, dich, ma, { soHopDong: hd.SoHopDong, tenHopDong: hd.TenHopDong, hanPhut: OTP_HAN_PHUT });
  await nhatKy.ghi(pool, { hopDongId: hd.HopDongMBID, hanhDong: 'GUI_OTP', chiTiet: { kenh, dich: gui.cheDich(kenh, dich), ok: kq.ok, loi: kq.loi }, ip: ctx && ctx.ip, ua: ctx && ctx.ua, userId: ctx && ctx.userId, benKyId: benKhach.BenKyID });
  if (!kq.ok) throw new Error('Không gửi được OTP: ' + kq.loi);
  return { kenh, dich: gui.cheDich(kenh, dich), hanPhut: OTP_HAN_PHUT };
}
/* Kiểm OTP: đúng ⇒ { ok:true, otp } ; sai ⇒ ném lỗi (đếm sai, khóa). */
async function kiemOtp(pool, d, ma, ctx) {
  const { hd, benKhach } = d;
  const so = String(ma || '').replace(/\D/g, '');
  const otp = (await pool.request().input('b', sql.Int, benKhach.BenKyID).query(`
    SELECT TOP 1 OtpID, OtpHash, Kenh, Dich, SoLanSai, CASE WHEN HetHan > SYSDATETIME() THEN 1 ELSE 0 END AS ConHan,
           CASE WHEN KhoaDen IS NOT NULL AND KhoaDen > SYSDATETIME() THEN 1 ELSE 0 END AS DangKhoa, DungLuc
    FROM HopDongMBOTP WHERE BenKyID=@b ORDER BY OtpID DESC`)).recordset[0];
  if (!otp) throw new Error('Chưa gửi mã OTP. Bấm "Gửi mã OTP" trước.');
  if (otp.DangKhoa) throw new Error(`Nhập sai quá ${OTP_SAI_TOI_DA} lần — tạm khóa ${OTP_KHOA_PHUT} phút.`);
  if (otp.DungLuc) throw new Error('Mã này đã dùng rồi. Bấm gửi mã mới.');
  if (!otp.ConHan) throw new Error('Mã OTP đã hết hạn (' + OTP_HAN_PHUT + ' phút). Bấm gửi mã mới.');
  if (so.length !== 6 || sha256Hex(so + '|' + benKhach.BenKyID) !== otp.OtpHash) {
    const sai = (otp.SoLanSai || 0) + 1;
    await pool.request().input('id', sql.Int, otp.OtpID).input('s', sql.Int, sai).input('kh', sql.Int, OTP_KHOA_PHUT)
      .query(`UPDATE HopDongMBOTP SET SoLanSai=@s, KhoaDen = CASE WHEN @s >= ${OTP_SAI_TOI_DA} THEN DATEADD(minute, @kh, SYSDATETIME()) ELSE KhoaDen END WHERE OtpID=@id`);
    await nhatKy.ghi(pool, { hopDongId: hd.HopDongMBID, hanhDong: 'OTP_SAI', chiTiet: { lanSai: sai }, ip: ctx && ctx.ip, ua: ctx && ctx.ua, benKyId: benKhach.BenKyID });
    throw new Error(sai >= OTP_SAI_TOI_DA ? `Sai ${sai} lần — tạm khóa ${OTP_KHOA_PHUT} phút.` : `Mã OTP không đúng (còn ${OTP_SAI_TOI_DA - sai} lần).`);
  }
  await pool.request().input('id', sql.Int, otp.OtpID).query('UPDATE HopDongMBOTP SET DungLuc=SYSDATETIME() WHERE OtpID=@id');
  await nhatKy.ghi(pool, { hopDongId: hd.HopDongMBID, hanhDong: 'OTP_DUNG', chiTiet: { kenh: otp.Kenh, dich: otp.Dich }, ip: ctx && ctx.ip, ua: ctx && ctx.ua, benKyId: benKhach.BenKyID });
  return { ok: true, otp };
}

// ---------------------------------------------------------------- khách ký
async function ghiKhachKy(pool, d, tt, ctx) {
  const { hd, benKhach } = d;
  await pool.request().input('b', sql.Int, benKhach.BenKyID).input('cach', sql.NVarChar(10), tt.cachKy)
    .input('ip', sql.NVarChar(64), (ctx && ctx.ip) || null).input('ua', sql.NVarChar(300), ctx && ctx.ua ? String(ctx.ua).slice(0, 300) : null)
    .input('anh', sql.NVarChar(sql.MAX), tt.anhChuKy || null).input('kenh', sql.NVarChar(10), tt.kenhOTP || null).input('dich', sql.NVarChar(150), tt.dichOTP || null)
    .input('cn', sql.NVarChar(255), tt.chungThu ? String(tt.chungThu.CN || '').slice(0, 255) : null).input('mst', sql.NVarChar(50), tt.chungThu ? String(tt.chungThu.MST || '').slice(0, 50) : null)
    .input('ser', sql.NVarChar(100), tt.chungThu ? String(tt.chungThu.serial || '').slice(0, 100) : null).input('hh', sql.DateTime2, tt.chungThu && tt.chungThu.denNgay ? new Date(tt.chungThu.denNgay) : null)
    .query(`UPDATE HopDongMBBenKy SET TrangThai=N'DaKy', CachKy=@cach, KyLuc=SYSDATETIME(), IP=@ip, UserAgent=@ua, AnhChuKy=@anh, KenhOTP=@kenh, DichOTP=@dich,
            ChungThuCN=@cn, ChungThuMST=@mst, ChungThuSerial=@ser, ChungThuHetHan=@hh WHERE BenKyID=@b`);
  await pool.request().input('id', sql.Int, hd.HopDongMBID).input('fk', sql.NVarChar(260), tt.fileKhachKy || null)
    .query(`UPDATE HopDongMB SET TrangThai=N'DangKySo', KhachKyLuc=SYSDATETIME(), FileKhachKy=ISNULL(@fk, FileKhachKy), UpdatedAt=SYSDATETIME() WHERE HopDongMBID=@id`);
  // link KHÔNG vô hiệu sau khi ký: khách còn dùng nó để tải bản cuối (route công khai chặn mọi thao tác ký khi đã ký).
  await nhatKy.ghi(pool, { hopDongId: hd.HopDongMBID, hanhDong: tt.cachKy === 'OTP' ? 'KY_OTP' : 'KY_SO_KHACH', chiTiet: tt.chiTiet || {}, ip: ctx && ctx.ip, ua: ctx && ctx.ua, benKyId: benKhach.BenKyID });
  if (tt.kyTuXa) {
    try { await pool.request().input('b', sql.Int, benKhach.BenKyID).input('n', sql.NVarChar(20), String(tt.kyTuXa.nha || '').slice(0, 20)).input('u', sql.NVarChar(100), String(tt.kyTuXa.userId || '').slice(0, 100)).query('UPDATE HopDongMBBenKy SET KyTuXaNha=@n, KyTuXaUserId=@u WHERE BenKyID=@b'); } catch (e) { /* chưa migration_v894 */ }
  }
  if (tt.cachKy === 'KySo' && tt.fileKhachKy) await ghiChuoiTinCay(pool, hd.HopDongMBID, benKhach.BenKyID, tt.fileKhachKy, 'khách');
}

/* v9.62: kiểm chuỗi tin cậy chữ ký cuối trong file → BenKy.ChuoiTinCay + nhật ký (không chặn luồng, không ném). */
async function ghiChuoiTinCay(pool, hopDongId, benKyId, tenFile, phia) {
  try {
    const chuoi = require('./chuoiTinCay');
    const kq = await chuoi.kiemPdfDaKy(await docFile(tenFile));
    const tom = chuoi.tomTat(kq).slice(0, 300);
    try { await pool.request().input('b', sql.Int, benKyId).input('c', sql.NVarChar(300), tom).query('UPDATE HopDongMBBenKy SET ChuoiTinCay=@c WHERE BenKyID=@b'); } catch (e) { /* chưa migration_v894 */ }
    await nhatKy.ghi(pool, { hopDongId, hanhDong: 'CHUOI_TIN_CAY', chiTiet: { phia, ok: kq && kq.ok, lyDo: kq && kq.lyDo, goc: kq && kq.goc, crl: kq && kq.crl && kq.crl.lyDo }, benKyId });
    return kq;
  } catch (e) { console.error('[hopdong] kiểm chuỗi tin cậy lỗi: ' + e.message); return null; }
}

/* Sau khi khách ký: dựng trang chứng nhận, ghép vào BẢN GỐC → FileChoMoyn; rồi ký số MOYN tự động (PFX/PKCS#11)
   + dấu thời gian → FileCuoi, DaKy. Tắt/lỗi ⇒ ChoMoynKy / LoiKySo, giữ bằng chứng.
   🔴 Khách ký SỐ thì bản khách ký (FileKhachKy) GIỮ NGUYÊN làm bằng chứng riêng — KHÔNG ghép trang vào nó: pdf-lib ghi lại
   toàn bộ file sẽ làm chữ ký số của khách VÔ HIỆU. Bản cuối = gốc + trang chứng nhận (ghi SHA-256 bản khách ký) + chữ ký MOYN. */
async function hoanTatSauKhachKy(pool, hopDongId, ctx) {
  const d = await docHopDong(pool, hopDongId);
  if (!d) throw new Error('Không thấy hợp đồng');
  const { hd } = d;
  const cfg = await docCauHinhKy(pool);
  const nk = await nhatKy.doc(pool, hd.HopDongMBID);
  const cfgKy = kySo.cauHinh();
  const urlTra = urlCongKhai('/ky.html?tra=' + encodeURIComponent(hd.MaTraCuu || ''));
  const qr = await pdfU.taoQrDataUrl(urlTra);
  if (coFile(hd.FileKhachKy)) hd.HashKhachKy = pdfU.sha256Hex(await docFile(hd.FileKhachKy));
  const trang = pdfU.wrapA4(pdfU.trangChungNhanHtml({ hd, ben: d.ben, nhatKy: nk.rows, qrDataUrl: qr, urlTra, cfg: { tenCongTy: cfg.tenCongTy, tsaCongCong: cfgKy.tsaCongCong } }), 'Chung nhan ky');
  const pdfTrang = await pdfU.htmlToPdf(trang);
  const goc = await docFile(hd.FileGoc);
  const choMoyn = await pdfU.ghepPdf(goc, pdfTrang);
  const tenCho = `chomoyn_${hd.HopDongMBID}_v${hd.PhienBan}.pdf`;
  await ghiFile(tenCho, choMoyn);
  await pool.request().input('id', sql.Int, hd.HopDongMBID).input('f', sql.NVarChar(260), tenCho).query('UPDATE HopDongMB SET FileChoMoyn=@f, UpdatedAt=SYSDATETIME() WHERE HopDongMBID=@id');
  // ký số MOYN tự động
  let kq = null;
  try {
    kq = await kySo.kyTuDong(choMoyn, { lyDo: 'Ký hợp đồng ' + hd.SoHopDong, lienHe: cfg.email || '', viTri: cfg.diaDiemKy || 'Việt Nam' });
  } catch (e) {
    await pool.request().input('id', sql.Int, hd.HopDongMBID).input('l', sql.NVarChar(500), String(e.message).slice(0, 500))
      .query(`UPDATE HopDongMB SET TrangThai=N'LoiKySo', LoiKySo=@l, UpdatedAt=SYSDATETIME() WHERE HopDongMBID=@id`);
    await nhatKy.ghi(pool, { hopDongId: hd.HopDongMBID, hanhDong: 'LOI_KY_SO', chiTiet: { loi: e.message, boKy: cfgKy.loai }, userId: ctx && ctx.userId });
    return { trangThai: 'LoiKySo', loi: e.message };
  }
  if (!kq) {
    await pool.request().input('id', sql.Int, hd.HopDongMBID).query(`UPDATE HopDongMB SET TrangThai=N'ChoMoynKy', UpdatedAt=SYSDATETIME() WHERE HopDongMBID=@id`);
    await nhatKy.ghi(pool, { hopDongId: hd.HopDongMBID, hanhDong: 'CHO_MOYN_KY', chiTiet: { lyDo: 'Ký tự động đang TẮT (HOPDONG_KY_TU_DONG) — người có quyền ký bằng công cụ hoặc tải lên.' }, userId: ctx && ctx.userId });
    return { trangThai: 'ChoMoynKy' };
  }
  await hoanTatMoynKy(pool, hd.HopDongMBID, kq, 'TuDong', ctx);
  return { trangThai: 'DaKy', tsa: kq.tsa };
}

/* Lưu bản cuối (đã có chữ ký số MOYN), DaKy, báo khách + kế toán. kq = { pdf, thongTin, tsa, signingTime }. */
async function hoanTatMoynKy(pool, hopDongId, kq, cachKy, ctx) {
  const d = await docHopDong(pool, hopDongId);
  const { hd, benMoyn, benKhach } = d;
  const tenCuoi = `cuoi_${hd.HopDongMBID}_v${hd.PhienBan}.pdf`;
  await ghiFile(tenCuoi, kq.pdf);
  const hash = pdfU.sha256Hex(kq.pdf);
  const tt = kq.thongTin || {};
  if (benMoyn) {
    await pool.request().input('b', sql.Int, benMoyn.BenKyID).input('cach', sql.NVarChar(10), cachKy)
      .input('ip', sql.NVarChar(64), (ctx && ctx.ip) || null).input('ua', sql.NVarChar(300), ctx && ctx.ua ? String(ctx.ua).slice(0, 300) : null)
      .input('cn', sql.NVarChar(255), String(tt.CN || '').slice(0, 255)).input('mst', sql.NVarChar(50), String(tt.MST || '').slice(0, 50))
      .input('ser', sql.NVarChar(100), String(tt.serial || '').slice(0, 100)).input('hh', sql.DateTime2, tt.denNgay ? new Date(tt.denNgay) : null)
      .query(`UPDATE HopDongMBBenKy SET TrangThai=N'DaKy', CachKy=@cach, KyLuc=SYSDATETIME(), IP=@ip, UserAgent=@ua, ChungThuCN=@cn, ChungThuMST=@mst, ChungThuSerial=@ser, ChungThuHetHan=@hh WHERE BenKyID=@b`);
  }
  await pool.request().input('id', sql.Int, hd.HopDongMBID).input('f', sql.NVarChar(260), tenCuoi).input('h', sql.Char(64), hash)
    .query(`UPDATE HopDongMB SET FileCuoi=@f, HashCuoi=@h, TrangThai=N'DaKy', KyXongLuc=SYSDATETIME(), LoiKySo=NULL, UpdatedAt=SYSDATETIME() WHERE HopDongMBID=@id`);
  await nhatKy.ghi(pool, { hopDongId: hd.HopDongMBID, hanhDong: 'KY_SO_MOYN', chiTiet: { cachKy, chungThu: tt.CN, mst: tt.MST, serial: tt.serial, hash }, ip: ctx && ctx.ip, ua: ctx && ctx.ua, userId: ctx && ctx.userId, benKyId: benMoyn && benMoyn.BenKyID });
  await nhatKy.ghi(pool, { hopDongId: hd.HopDongMBID, hanhDong: 'DAU_THOI_GIAN', chiTiet: kq.tsa && kq.tsa.ok ? { ok: true, tsa: kq.tsa.tsaUrl, luc: kq.tsa.luc } : { ok: false, loi: (kq.tsa && kq.tsa.loi) || 'không có' }, userId: ctx && ctx.userId });
  if (benMoyn) await ghiChuoiTinCay(pool, hd.HopDongMBID, benMoyn.BenKyID, tenCuoi, 'MOYN');   // v9.62
  // báo khách (link tải riêng, hạn 30 ngày — token cũ chỉ có hash trong CSDL nên không gửi lại được) + kế toán — lỗi gửi chỉ ghi nhật ký
  try {
    const cfg = await docCauHinhKy(pool);
    const dsGui = [];
    if (benKhach && benKhach.Email) {
      const { link } = await taoLink(pool, hd, benKhach, 30);
      dsGui.push(['email', benKhach.Email, link]);
    }
    if (cfg.emailKeToan) dsGui.push(['email', cfg.emailKeToan, urlCongKhai('/ky.html?tra=' + encodeURIComponent(hd.MaTraCuu || ''))]);
    for (const [kenh, dich, url] of dsGui) {
      const r = await gui.guiBaoKyXong(kenh, dich, { soHopDong: hd.SoHopDong, tenHopDong: hd.TenHopDong, link: url, maTraCuu: hd.MaTraCuu });
      await nhatKy.ghi(pool, { hopDongId: hd.HopDongMBID, hanhDong: 'BAO_KY_XONG', chiTiet: { kenh, dich: gui.cheDich(kenh, dich), ok: r.ok, loi: r.loi } });
    }
  } catch (e) { console.error('[hopdong] báo ký xong lỗi: ' + e.message); }
  return { tenCuoi, hash };
}

/* Khách TỪ CHỐI. */
async function tuChoi(pool, d, lyDo, ctx) {
  const { hd, benKhach } = d;
  await pool.request().input('b', sql.Int, benKhach.BenKyID).input('ld', sql.NVarChar(500), String(lyDo || '').slice(0, 500))
    .input('ip', sql.NVarChar(64), (ctx && ctx.ip) || null).input('ua', sql.NVarChar(300), ctx && ctx.ua ? String(ctx.ua).slice(0, 300) : null)
    .query(`UPDATE HopDongMBBenKy SET TrangThai=N'TuChoi', LyDoTuChoi=@ld, KyLuc=SYSDATETIME(), IP=@ip, UserAgent=@ua WHERE BenKyID=@b`);
  await pool.request().input('id', sql.Int, hd.HopDongMBID).query(`UPDATE HopDongMB SET TrangThai=N'TuChoi', UpdatedAt=SYSDATETIME() WHERE HopDongMBID=@id`);
  await pool.request().input('hd', sql.Int, hd.HopDongMBID).query('UPDATE HopDongMBLink SET VoHieu=1 WHERE HopDongMBID=@hd');
  await nhatKy.ghi(pool, { hopDongId: hd.HopDongMBID, hanhDong: 'TU_CHOI', chiTiet: { lyDo: String(lyDo || '').slice(0, 500) }, ip: ctx && ctx.ip, ua: ctx && ctx.ua, benKyId: benKhach.BenKyID });
}

/* Đánh dấu hết hạn (gọi lúc xem danh sách / mở link): ChoKy mà HanKy < nay ⇒ HetHan. */
async function danhDauHetHan(pool) {
  try {
    await pool.request().query(`UPDATE HopDongMB SET TrangThai=N'HetHan', UpdatedAt=SYSDATETIME() WHERE TrangThai=N'ChoKy' AND HanKy IS NOT NULL AND HanKy < SYSDATETIME()`);
  } catch (e) { /* bảng chưa có */ }
}

module.exports = {
  THU_MUC, duongFile, docFile, ghiFile, coFile, KHOA_CAU_HINH, CAU_HINH_MAC_DINH, TRANG_THAI, TEN_TRANG_THAI, TEN_LOAI_VAN_BAN, TIEN_TO_SO, OTP_HAN_PHUT, OTP_SAI_TOI_DA, OTP_KHOA_PHUT,
  sha256Hex, urlCongKhai, coV894, docCauHinhKy, luuCauHinhKy, docHopDong, docTheoToken, soHopDongMoi, benMuaTuKhach, bienChuan, docMau, dungHtml,
  taoLink, guiLinkChoKhach, xuatBan, taoOtp, kiemOtp, ghiKhachKy, ghiChuoiTinCay, hoanTatSauKhachKy, hoanTatMoynKy, tuChoi, danhDauHetHan
};
