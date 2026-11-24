/* ==================================================================================================
   v9.61 — HỢP ĐỒNG MUA BÁN: điền mẫu {{Bien}}, dựng PDF (puppeteer), trang CHỨNG NHẬN KÝ ĐIỆN TỬ,
   ghép PDF (pdf-lib), QR mã tra cứu, số thành chữ.
   --------------------------------------------------------------------------------------------------
   · Mẫu là HTML đã qua locMauAnToan (routes/hrm.js) lúc lưu; giá trị biến do người dùng gõ được ESCAPE
     khi điền — chỉ {{BangHang}} (bảng hàng do chính util này dựng) được chèn dạng HTML.
   · PDF dựng ở máy chủ bằng Chrome (puppeteer đã có từ v8.36.3): bản PDF là thứ được băm + ký, nên PHẢI
     cố định ở máy chủ, không in từ trình duyệt người dùng.
   · pdf-lib save({ useObjectStreams: false }) — @signpdf cần cấu trúc PDF không nén object stream để
     đặt chỗ giữ chữ ký (xem utils/kySoPdf.js).
   ================================================================================================== */
'use strict';
const crypto = require('crypto');

/* Biến chuẩn — điền sẵn từ cấu hình Bên bán, hồ sơ Bên mua, hợp đồng. Mẫu có biến KHÁC danh sách này thì
   form tạo hợp đồng tự sinh ô nhập cho biến đó ("điền các trường nhập vào" — Nguyen 14/11). */
const BIEN_CHUAN = [
  ['SoHopDong', 'Số hợp đồng'], ['TenHopDong', 'Tên hợp đồng'], ['NgayKy', 'Ngày ký (chữ)'], ['DiaDiemKy', 'Địa điểm ký'],
  ['BenBan_Ten', 'Bên bán — tên'], ['BenBan_DiaChi', 'Bên bán — địa chỉ'], ['BenBan_MST', 'Bên bán — MST'],
  ['BenBan_NguoiDaiDien', 'Bên bán — người đại diện'], ['BenBan_ChucVu', 'Bên bán — chức vụ'],
  ['BenBan_SDT', 'Bên bán — điện thoại'], ['BenBan_Email', 'Bên bán — email'], ['BenBan_SoTaiKhoan', 'Bên bán — số tài khoản'],
  ['BenMua_Ten', 'Bên mua — tên'], ['BenMua_DiaChi', 'Bên mua — địa chỉ'], ['BenMua_MST', 'Bên mua — MST'],
  ['BenMua_SoDKKD', 'Bên mua — số ĐKKD'], ['BenMua_NgayCapDKKD', 'Bên mua — ngày cấp ĐKKD'], ['BenMua_NoiCapDKKD', 'Bên mua — nơi cấp ĐKKD'],
  ['BenMua_NguoiDaiDien', 'Bên mua — người đại diện / chủ hộ'], ['BenMua_ChucVu', 'Bên mua — chức vụ'],
  ['BenMua_CCCD', 'Bên mua — số CCCD'], ['BenMua_SDT', 'Bên mua — điện thoại'], ['BenMua_Email', 'Bên mua — email'],
  ['BangHang', 'Bảng hàng hóa (tự dựng từ dòng hàng)'], ['TongTien', 'Tổng tiền (số)'], ['TongTienBangChu', 'Tổng tiền bằng chữ'],
  // v9.62: phụ lục / thanh lý
  ['LoaiVanBan', 'Loại văn bản (Hợp đồng / Phụ lục / Biên bản thanh lý)'], ['HopDongCha_So', 'Hợp đồng gốc — số'], ['HopDongCha_Ten', 'Hợp đồng gốc — tên'], ['HopDongCha_Ngay', 'Hợp đồng gốc — ngày ký']
];
const TEN_BIEN_CHUAN = new Set(BIEN_CHUAN.map(b => b[0]));

function timBien(html) {
  const ra = [], co = new Set();
  const re = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;
  let m;
  while ((m = re.exec(String(html || ''))) !== null) { if (!co.has(m[1])) { co.add(m[1]); ra.push(m[1]); } }
  return ra;
}
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* Điền biến: giá trị người gõ được escape + giữ xuống dòng; BangHang chèn HTML (đã dựng ở đây). Biến trống -> ''. */
function thayBien(html, gia, bangHangHtml) {
  const g = gia || {};
  return String(html || '').replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (ca, ten) => {
    if (ten === 'BangHang') return bangHangHtml || '';
    const v = g[ten];
    if (v == null || v === '') return '';
    return esc(v).replace(/\r?\n/g, '<br>');
  });
}

// ---------------------------------------------------------------- số → chữ (tiếng Việt)
const CHU_SO = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
function docBaSo(tram, chuc, dv, daySo) {
  let s = '';
  if (daySo || tram > 0) s += CHU_SO[tram] + ' trăm';
  if (chuc === 0) { if (dv > 0) s += (s ? ' lẻ ' : '') + CHU_SO[dv]; }
  else if (chuc === 1) { s += (s ? ' ' : '') + 'mười'; if (dv === 5) s += ' lăm'; else if (dv > 0) s += ' ' + CHU_SO[dv]; }
  else {
    s += (s ? ' ' : '') + CHU_SO[chuc] + ' mươi';
    if (dv === 1) s += ' mốt'; else if (dv === 4) s += ' tư'; else if (dv === 5) s += ' lăm'; else if (dv > 0) s += ' ' + CHU_SO[dv];
  }
  return s;
}
function soThanhChu(n) {
  let so = Math.round(Math.abs(Number(n) || 0));
  if (so === 0) return 'Không đồng';
  const donVi = ['', ' nghìn', ' triệu', ' tỷ'];
  const khoi = [];
  while (so > 0) { khoi.push(so % 1000); so = Math.floor(so / 1000); }
  let ra = '';
  for (let i = khoi.length - 1; i >= 0; i--) {
    const k = khoi[i];
    if (k === 0) continue;
    const tram = Math.floor(k / 100), chuc = Math.floor((k % 100) / 10), dv = k % 10;
    const phan = docBaSo(tram, chuc, dv, i !== khoi.length - 1);
    // nhóm 3 = tỷ, 4 = nghìn tỷ, 5 = triệu tỷ, 6 = tỷ tỷ...
    const d = i >= 3 ? donVi[i % 3] + ' tỷ'.repeat(Math.floor(i / 3)) : donVi[i];
    ra += (ra ? ' ' : '') + phan + d;
  }
  ra = ra.trim();
  return (ra.charAt(0).toUpperCase() + ra.slice(1)) + ' đồng' + (Number(n) < 0 ? ' (âm)' : '');
}

const fmtSo = (v) => { const x = Number(v) || 0; return x.toLocaleString('vi-VN', { maximumFractionDigits: 2 }); };
const ddmmyyyy = (d) => {
  if (!d) return '';
  const x = (d instanceof Date) ? d : new Date(d);
  if (isNaN(x.getTime())) return String(d);
  return `${String(x.getDate()).padStart(2, '0')}/${String(x.getMonth() + 1).padStart(2, '0')}/${x.getFullYear()}`;
};
const ngayChu = (d) => {
  const x = (d instanceof Date) ? d : new Date(d || Date.now());
  return `${String(x.getDate()).padStart(2, '0')} tháng ${String(x.getMonth() + 1).padStart(2, '0')} năm ${x.getFullYear()}`;
};

/* Bảng hàng hóa cho {{BangHang}} — cột cố định, in được trên A4. */
function bangHangHtml(dsHang) {
  const ds = Array.isArray(dsHang) ? dsHang : [];
  if (!ds.length) return '';
  const tong = ds.reduce((t, h) => t + (Number(h.ThanhTien) || 0), 0);
  return `<table style="width:100%;border-collapse:collapse;font-size:12pt" border="1" cellpadding="4">
    <thead><tr style="background:#f1f3f4"><th style="width:28px">STT</th><th>Mã SP</th><th>Tên sản phẩm</th><th>Màu</th><th>ĐVT</th><th>Số lượng</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead>
    <tbody>${ds.map((h, i) => `<tr><td style="text-align:center">${i + 1}</td><td>${esc(h.MaSanPham || '')}</td><td>${esc(h.TenSanPham || '')}</td><td>${esc(h.MauSac || '')}</td><td>${esc(h.DonVi || '')}</td><td style="text-align:right">${fmtSo(h.SoLuong)}</td><td style="text-align:right">${fmtSo(h.DonGia)}</td><td style="text-align:right">${fmtSo(h.ThanhTien)}</td></tr>`).join('')}
    <tr><td colspan="7" style="text-align:right"><b>TỔNG CỘNG</b></td><td style="text-align:right"><b>${fmtSo(tong)}</b></td></tr></tbody></table>`;
}

/* Khung A4 cho Chrome in — Times New Roman 13pt như mẫu HRM. */
function wrapA4(noiDung, tieuDe) {
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${esc(tieuDe || 'Hop dong')}</title>
<style>
  @page { size: A4; margin: 20mm 18mm 20mm 20mm; }
  body { font-family: 'Times New Roman', Times, serif; font-size: 13pt; line-height: 1.45; color: #000; margin: 0; }
  table { border-collapse: collapse; page-break-inside: auto; } tr { page-break-inside: avoid; }
  td, th { vertical-align: top; }
  h1, h2, h3 { margin: 10px 0 6px; } p { margin: 6px 0; }
  .cn-tieude { text-align:center; font-size: 16pt; font-weight: 700; margin: 0 0 10px; }
  .cn-bang { width:100%; border-collapse:collapse; font-size: 11pt; } .cn-bang td, .cn-bang th { border:1px solid #000; padding: 4px 6px; }
  .cn-nho { font-size: 10pt; color: #333; }
</style></head><body>${noiDung}</body></html>`;
}

// ---------------------------------------------------------------- HTML -> PDF (puppeteer)
async function htmlToPdf(html) {
  const puppeteer = require('puppeteer');
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'] });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load', timeout: 60000 });
    const buf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true, timeout: 60000 });
    return Buffer.from(buf);
  } finally { await browser.close().catch(() => {}); }
}

// ---------------------------------------------------------------- QR + mã
async function taoQrDataUrl(text) {
  try { const QRCode = require('qrcode'); return await QRCode.toDataURL(String(text), { margin: 1, width: 160 }); }
  catch (e) { return ''; }
}
const BANG_MA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // bỏ I/O/0/1 dễ nhầm khi gõ tay
function maTraCuuMoi() {
  const b = crypto.randomBytes(10);
  let s = '';
  for (let i = 0; i < 10; i++) s += BANG_MA[b[i] % BANG_MA.length];
  return 'HD' + s.slice(0, 5) + '-' + s.slice(5);
}
const sha256Hex = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

// ---------------------------------------------------------------- trang chứng nhận
/* hd: dòng HopDongMB; ben: mảng HopDongMBBenKy; nhatKy: rows (đã sắp theo thời gian); cfg: cấu hình ký; urlTra: link tra cứu. */
function trangChungNhanHtml({ hd, ben, nhatKy, qrDataUrl, urlTra, cfg }) {
  const b = ben || [];
  const nk = nhatKy || [];
  const dongBen = b.map(x => `<tr>
      <td>${esc(x.Ben === 'MOYN' ? 'Bên bán' : 'Bên mua')}</td>
      <td>${esc(x.HoTen || '')}${x.ChucVu ? '<br><span class="cn-nho">' + esc(x.ChucVu) + '</span>' : ''}</td>
      <td>${esc(tenCachKy(x.CachKy))}${x.KenhOTP ? '<br><span class="cn-nho">OTP qua ' + esc(x.KenhOTP.toUpperCase()) + ' → ' + esc(x.DichOTP || '') + '</span>' : ''}${x.ChungThuCN ? '<br><span class="cn-nho">Chứng thư: ' + esc(x.ChungThuCN) + (x.ChungThuMST ? ' · ' + esc(x.ChungThuMST) : '') + (x.ChungThuSerial ? ' · serial ' + esc(x.ChungThuSerial) : '') + '</span>' : ''}${x.KyTuXaNha ? '<br><span class="cn-nho">Ký từ xa qua ' + esc(x.KyTuXaNha) + '</span>' : ''}${x.ChuoiTinCay ? '<br><span class="cn-nho">' + esc(x.ChuoiTinCay) + '</span>' : ''}</td>
      <td>${esc(x.TrangThai === 'DaKy' ? 'Đã ký' : (x.TrangThai === 'TuChoi' ? 'Từ chối' : 'Chờ ký'))}<br><span class="cn-nho">${esc(x.KyLuc ? ddmmyyyyHHmm(x.KyLuc) : '')}</span></td>
      <td class="cn-nho">${esc(x.IP || '')}${x.UserAgent ? '<br>' + esc(String(x.UserAgent).slice(0, 90)) : ''}</td>
    </tr>`).join('');
  const suKien = nk.filter(r => ['XUAT_BAN', 'GUI_LINK', 'XEM', 'GUI_OTP', 'OTP_SAI', 'OTP_DUNG', 'KY_OTP', 'KY_SO_KHACH', 'TU_CHOI', 'KY_SO_MOYN', 'DAU_THOI_GIAN', 'LOI_KY_SO'].includes(r.HanhDong))
    .map(r => `<tr><td class="cn-nho">${esc(r.Luc ? ddmmyyyyHHmm(r.Luc) : '')}</td><td>${esc(tenHanhDong(r.HanhDong))}</td><td class="cn-nho">${esc(r.IP || '')}</td><td class="cn-nho">${esc(tomTatChiTiet(r))}</td></tr>`).join('');
  return `
<div class="cn-tieude">CHỨNG NHẬN KÝ ĐIỆN TỬ</div>
<p style="text-align:center" class="cn-nho">Trang này do hệ thống ${esc((cfg && cfg.tenCongTy) || 'MOYN')} tự động ghép vào cuối hợp đồng — là bằng chứng kỹ thuật của việc ký; chữ ký số phía bên bán bao trùm toàn bộ tài liệu kể cả trang này.</p>
<table class="cn-bang"><tr><td style="width:32%"><b>Hợp đồng</b></td><td>${esc(hd.SoHopDong || '')} — ${esc(hd.TenHopDong || '')}</td></tr>
<tr><td><b>Phiên bản xuất bản</b></td><td>${esc(hd.PhienBan || '')}${hd.XuatBanLuc ? ' · lúc ' + esc(ddmmyyyyHHmm(hd.XuatBanLuc)) : ''}</td></tr>
<tr><td><b>SHA-256 bản gốc đã gửi ký</b></td><td style="font-family:monospace;font-size:9.5pt;word-break:break-all">${esc(hd.HashGoc || '')}</td></tr>
${hd.HashKhachKy ? `<tr><td><b>SHA-256 bản bên mua đã ký số</b></td><td style="font-family:monospace;font-size:9.5pt;word-break:break-all">${esc(hd.HashKhachKy)}<br><span class="cn-nho">(file riêng, giữ nguyên chữ ký số của bên mua — lưu kèm hợp đồng này)</span></td></tr>` : ''}
<tr><td><b>Mã tra cứu</b></td><td><b>${esc(hd.MaTraCuu || '')}</b> — kiểm tra tại ${esc(urlTra || '')}</td></tr></table>
<p><b>Các bên ký</b></p>
<table class="cn-bang"><thead><tr><th>Bên</th><th>Người ký</th><th>Cách ký</th><th>Kết quả</th><th>IP / thiết bị</th></tr></thead><tbody>${dongBen}</tbody></table>
<p><b>Nhật ký (trích)</b></p>
<table class="cn-bang"><thead><tr><th style="width:120px">Thời điểm</th><th>Sự kiện</th><th style="width:110px">IP</th><th>Chi tiết</th></tr></thead><tbody>${suKien || '<tr><td colspan="4">—</td></tr>'}</tbody></table>
<table style="width:100%;margin-top:10px"><tr><td style="width:170px">${qrDataUrl ? `<img src="${qrDataUrl}" style="width:150px;height:150px">` : ''}</td>
<td class="cn-nho">Quét QR hoặc nhập mã tra cứu để kiểm tra trạng thái và mã băm. Chữ ký số của bên bán và dấu thời gian kiểm tra được bằng Adobe Acrobat Reader (bảng Signatures). ${cfg && cfg.tsaCongCong ? 'Dấu thời gian lấy từ TSA công cộng (không phải tổ chức cấp dấu thời gian được cấp phép tại Việt Nam).' : ''}
Ký bằng OTP là chữ ký điện tử theo thỏa thuận của các bên tại hợp đồng (Luật Giao dịch điện tử 2023); mã OTP được gửi tới đúng số điện thoại / email do bên ký cung cấp và chỉ người giữ thiết bị đó nhập được.</td></tr></table>`;
}
function ddmmyyyyHHmm(d) {
  const x = (d instanceof Date) ? d : new Date(d);
  if (isNaN(x.getTime())) return String(d);
  return `${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}:${String(x.getSeconds()).padStart(2, '0')} ${ddmmyyyy(x)}`;
}
function tenCachKy(c) { return { OTP: 'Ký điện tử (OTP)', KySo: 'Chữ ký số', TuDong: 'Chữ ký số (máy chủ)', TaiLen: 'Chữ ký số (tải lên)', CongCu: 'Chữ ký số (USB token)', TuXa: 'Chữ ký số (ký từ xa qua CA)' }[c] || (c || ''); }
function tenHanhDong(h) {
  return { TAO: 'Tạo hợp đồng', SUA: 'Sửa', XUAT_BAN: 'Xuất bản để ký', GUI_LINK: 'Gửi link ký', XEM: 'Mở link xem hợp đồng', GUI_OTP: 'Gửi OTP',
    OTP_SAI: 'Nhập OTP sai', OTP_DUNG: 'OTP đúng', KY_OTP: 'Ký bằng OTP', KY_SO_KHACH: 'Bên mua ký số', TU_CHOI: 'Từ chối ký', KY_SO_MOYN: 'Bên bán ký số',
    DAU_THOI_GIAN: 'Dấu thời gian', LOI_KY_SO: 'Lỗi ký số', HUY: 'Hủy', TAI_PDF: 'Tải PDF', HET_HAN: 'Hết hạn', KY_LAI: 'Ký số lại',
    CHO_MOYN_KY: 'Chờ bên bán ký số', BAO_KY_XONG: 'Báo đã ký xong', THU_HOI: 'Thu hồi về nháp', THANH_TOAN: 'Cập nhật thanh toán', TAI_LEN_PDF: 'Tải PDF soạn sẵn',
    NHAC_HAN: 'Nhắc hạn ký (tự động)', CHUOI_TIN_CAY: 'Kiểm chuỗi tin cậy chứng thư', KY_TU_XA_BAT_DAU: 'Gửi yêu cầu ký từ xa', KY_TU_XA_LOI: 'Ký từ xa lỗi', HOA_DON: 'Cập nhật hóa đơn', KY_SO_KHACH_LOI: 'Bên mua tải bản ký số lỗi' }[h] || h;
}
function tomTatChiTiet(r) {
  try {
    const c = r.ChiTiet ? JSON.parse(r.ChiTiet) : null;
    if (!c || typeof c !== 'object') return r.ChiTiet || '';
    return Object.keys(c).filter(k => !['token', 'otp', 'ma'].includes(k)).map(k => `${k}: ${typeof c[k] === 'object' ? JSON.stringify(c[k]) : c[k]}`).join(' · ').slice(0, 160);
  } catch (e) { return String(r.ChiTiet || '').slice(0, 160); }
}

// ---------------------------------------------------------------- ghép PDF
async function ghepPdf(pdfGoc, pdfThem) {
  const { PDFDocument } = require('pdf-lib');
  const a = await PDFDocument.load(pdfGoc, { ignoreEncryption: true });
  const b = await PDFDocument.load(pdfThem, { ignoreEncryption: true });
  const pages = await a.copyPages(b, b.getPageIndices());
  pages.forEach(p => a.addPage(p));
  return Buffer.from(await a.save({ useObjectStreams: false }));
}
/* Chuẩn hóa PDF tải lên (soạn sẵn) sang dạng pdf-lib ghi lại không object stream — để đặt chỗ ký được. */
async function chuanHoaPdf(buf) {
  const { PDFDocument } = require('pdf-lib');
  const a = await PDFDocument.load(buf, { ignoreEncryption: true });
  return Buffer.from(await a.save({ useObjectStreams: false }));
}

module.exports = { BIEN_CHUAN, TEN_BIEN_CHUAN, timBien, thayBien, esc, soThanhChu, fmtSo, ddmmyyyy, ddmmyyyyHHmm, ngayChu,
  bangHangHtml, wrapA4, htmlToPdf, taoQrDataUrl, maTraCuuMoi, sha256Hex, trangChungNhanHtml, tenCachKy, tenHanhDong, ghepPdf, chuanHoaPdf };
