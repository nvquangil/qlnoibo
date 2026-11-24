/* ==================================================================================================
   v9.61 — GỬI LINK KÝ + OTP cho hợp đồng mua bán: email (SMTP sẵn có) / SMS (eSMS.vn, SpeedSMS) / Zalo (chưa).
   --------------------------------------------------------------------------------------------------
   · Email dùng ĐÚNG cấu hình SMTP_HOST/PORT/USER/PASS/SECURE của utils/checkOverdue.js & canhBaoSaoLuu.js.
   · SMS: SMS_PROVIDER = esms | speedsms (+ SMS_API_KEY, SMS_SECRET, SMS_BRANDNAME, SMS_TYPE). Chưa khai = kênh tắt.
     Brandname OTP ở Việt Nam phải đăng ký với nhà cung cấp — không có brandname thì tin đi đầu số ngẫu nhiên,
     dễ bị coi là spam; Nguyen đăng ký rồi gõ thẳng vào .env (KHÔNG dán key vào chat).
   · Zalo: OA đang kẹt gói, gửi OTP cần ZNS (có phí, duyệt mẫu) — để chỗ cắm, trả "chưa bật".
   · Mọi hàm TRẢ { ok, loi } — không ném; route quyết định báo gì. Không bao giờ log nội dung OTP.
   ================================================================================================== */
'use strict';
const nodemailer = require('nodemailer');

function kenhSanSang() {
  return {
    email: !!process.env.SMTP_HOST,
    sms: ['esms', 'speedsms'].includes(String(process.env.SMS_PROVIDER || '').toLowerCase()) && !!process.env.SMS_API_KEY,
    /* Zalo ZNS (Nguyen 14/11: "làm sẵn OTP SMS, Zalo"): bật khi có mẫu ZNS OTP đã được Zalo duyệt
       (ZALO_ZNS_TEMPLATE_OTP) — access token lấy qua utils/zaloOaToken.js như webhook v9.30. */
    zalo: !!process.env.ZALO_ZNS_TEMPLATE_OTP
  };
}

/* Zalo ZNS — gửi tin theo mẫu đã duyệt tới SĐT (không cần khách follow OA). Mẫu OTP của Zalo có tham số "otp";
   mẫu link ký cần tham số theo mẫu anh đăng ký (ZALO_ZNS_TEMPLATE_LINK, tham số: so_hop_dong, link). */
async function guiZaloZNS({ to, templateId, templateData }) {
  const so = chuanHoaSDT(to);
  if (!so) return { ok: false, loi: 'Số điện thoại không hợp lệ: ' + String(to || '(trống)') };
  if (!templateId) return { ok: false, loi: 'Chưa khai mẫu ZNS (ZALO_ZNS_TEMPLATE_OTP / ZALO_ZNS_TEMPLATE_LINK trong backend\\.env).' };
  try {
    const { layAccessToken } = require('./zaloOaToken');
    const token = await layAccessToken();
    const r = await fetch(process.env.ZALO_ZNS_URL || 'https://business.openapi.zalo.me/message/template', {
      method: 'POST', headers: { 'Content-Type': 'application/json', access_token: token },
      body: JSON.stringify({ phone: so, template_id: String(templateId), template_data: templateData || {}, tracking_id: 'hd' + Date.now() }),
      signal: AbortSignal.timeout(15000)
    });
    const j = await r.json().catch(() => ({}));
    if (j && Number(j.error) === 0) return { ok: true, id: j.data && j.data.msg_id };
    return { ok: false, loi: 'Zalo ZNS từ chối (error ' + (j && j.error) + '): ' + ((j && j.message) || r.status) };
  } catch (e) { return { ok: false, loi: 'Gửi Zalo ZNS lỗi: ' + e.message }; }
}

/* Che đích để lưu nhật ký / hiện trên trang ký: 0912345678 -> 09*****678 ; an.thuy@gmail.com -> a******@gmail.com */
function cheDich(kenh, dich) {
  const s = String(dich || '').trim();
  if (!s) return '';
  if (kenh === 'email') {
    const i = s.indexOf('@');
    if (i <= 0) return s[0] + '***';
    return s[0] + '*'.repeat(Math.max(3, Math.min(8, i - 1))) + s.slice(i);
  }
  const so = s.replace(/\D/g, '');
  if (so.length < 6) return '***';
  return so.slice(0, 2) + '*'.repeat(so.length - 5) + so.slice(-3);
}

/* Số điện thoại VN → dạng 84xxxxxxxxx cho API SMS; trả '' nếu không hợp lệ. */
function chuanHoaSDT(sdt) {
  let so = String(sdt || '').replace(/\D/g, '');
  if (so.startsWith('0084')) so = so.slice(2);
  if (so.startsWith('0')) so = '84' + so.slice(1);
  if (!so.startsWith('84')) so = '84' + so;
  return /^84\d{9}$/.test(so) ? so : '';
}
function emailHopLe(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || '').trim()); }

// ------------------------------------------------------------------ email
function taoTransporter() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 465,
    secure: String(process.env.SMTP_SECURE || 'true') !== 'false',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
}
async function guiEmail({ to, subject, text, html }) {
  try {
    const tr = taoTransporter();
    if (!tr) return { ok: false, loi: 'Máy chủ chưa cấu hình SMTP (SMTP_HOST trong backend\\.env).' };
    if (!emailHopLe(to)) return { ok: false, loi: 'Địa chỉ email không hợp lệ: ' + String(to || '(trống)') };
    await tr.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject, text, html });
    return { ok: true };
  } catch (e) { return { ok: false, loi: 'Gửi email lỗi: ' + e.message }; }
}

// ------------------------------------------------------------------ sms
async function guiSMS({ to, noiDung }) {
  const nha = String(process.env.SMS_PROVIDER || '').toLowerCase();
  const so = chuanHoaSDT(to);
  if (!so) return { ok: false, loi: 'Số điện thoại không hợp lệ: ' + String(to || '(trống)') };
  if (!kenhSanSang().sms) return { ok: false, loi: 'Máy chủ chưa cấu hình SMS (SMS_PROVIDER / SMS_API_KEY trong backend\\.env).' };
  try {
    if (nha === 'esms') {
      /* eSMS.vn — SendMultipleMessage_V4_post_json: SmsType 2 = CSKH (brandname), IsUnicode 0 (OTP không dấu). */
      const r = await fetch('https://rest.esms.vn/MainService.svc/json/SendMultipleMessage_V4_post_json/', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ApiKey: process.env.SMS_API_KEY, SecretKey: process.env.SMS_SECRET || '', Content: noiDung,
          Phone: so, Brandname: process.env.SMS_BRANDNAME || '', SmsType: String(process.env.SMS_TYPE || '2'), IsUnicode: '0' }),
        signal: AbortSignal.timeout(15000)
      });
      const j = await r.json().catch(() => ({}));
      if (String(j.CodeResult) === '100') return { ok: true, id: j.SMSID };
      return { ok: false, loi: 'eSMS từ chối: ' + (j.ErrorMessage || j.CodeResult || r.status) };
    }
    if (nha === 'speedsms') {
      /* SpeedSMS — Basic auth: access token làm username. sms_type 2 = brandname CSKH, 3 = ngẫu nhiên, 5 = cố định. */
      const r = await fetch('https://api.speedsms.vn/index.php/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Basic ' + Buffer.from(process.env.SMS_API_KEY + ':x').toString('base64') },
        body: JSON.stringify({ to: [so], content: noiDung, sms_type: Number(process.env.SMS_TYPE || 2), sender: process.env.SMS_BRANDNAME || '' }),
        signal: AbortSignal.timeout(15000)
      });
      const j = await r.json().catch(() => ({}));
      if (j.status === 'success') return { ok: true, id: (j.data && j.data.tranId) || null };
      return { ok: false, loi: 'SpeedSMS từ chối: ' + (j.message || j.code || r.status) };
    }
    return { ok: false, loi: 'SMS_PROVIDER không hợp lệ: ' + nha };
  } catch (e) { return { ok: false, loi: 'Gửi SMS lỗi: ' + e.message }; }
}

// ------------------------------------------------------------------ dùng cho hợp đồng
function tenCongTy() { return process.env.HOPDONG_TEN_CONG_TY || 'MOYN'; }

/* Gửi OTP. kenh: 'sms' | 'email' | 'zalo'. KHÔNG log mã. */
async function guiOtp(kenh, dich, ma, tt) {
  const t = tt || {};
  const hanPhut = t.hanPhut || 5;
  if (kenh === 'sms') return guiSMS({ to: dich, noiDung: `${tenCongTy()}: Ma OTP ky hop dong ${t.soHopDong || ''} la ${ma}. Hieu luc ${hanPhut} phut. KHONG chia se ma nay.` });
  if (kenh === 'email') return guiEmail({ to: dich,
    subject: `[${tenCongTy()}] Mã OTP ký hợp đồng ${t.soHopDong || ''}`,
    text: `Mã OTP để ký hợp đồng ${t.soHopDong || ''}${t.tenHopDong ? ' — ' + t.tenHopDong : ''} là: ${ma}\nHiệu lực ${hanPhut} phút. Không chia sẻ mã này cho bất kỳ ai.\n${tenCongTy()}`,
    html: `<p>Mã OTP để ký hợp đồng <b>${esc(t.soHopDong || '')}</b>${t.tenHopDong ? ' — ' + esc(t.tenHopDong) : ''} là:</p>
           <p style="font-size:28px;letter-spacing:6px;font-weight:700">${esc(ma)}</p>
           <p>Hiệu lực ${hanPhut} phút. <b>Không chia sẻ mã này cho bất kỳ ai.</b></p><p>${esc(tenCongTy())}</p>` });
  if (kenh === 'zalo') {
    if (!kenhSanSang().zalo) return { ok: false, loi: 'Kênh Zalo (ZNS) chưa bật — cần mẫu ZNS OTP được duyệt + gói Zalo OA. Dùng SMS hoặc Email.' };
    return guiZaloZNS({ to: dich, templateId: process.env.ZALO_ZNS_TEMPLATE_OTP, templateData: { otp: String(ma) } });
  }
  return { ok: false, loi: 'Kênh OTP không hợp lệ: ' + kenh };
}

/* Gửi link ký (lần đầu / gửi lại). */
async function guiLinkKy(kenh, dich, tt) {
  const t = tt || {};
  const han = t.hanKy ? ` (hiệu lực đến ${t.hanKy})` : '';
  if (kenh === 'sms') return guiSMS({ to: dich, noiDung: `${tenCongTy()}: Moi ky hop dong ${t.soHopDong || ''}. Mo link: ${t.link}${han ? ' (het han ' + t.hanKy + ')' : ''}` });
  if (kenh === 'email') return guiEmail({ to: dich,
    subject: `[${tenCongTy()}] Mời ký hợp đồng ${t.soHopDong || ''}${t.tenHopDong ? ' — ' + t.tenHopDong : ''}`,
    text: `${tenCongTy()} mời ${t.tenNguoiKy || 'quý khách'} xem và ký hợp đồng ${t.soHopDong || ''}${t.tenHopDong ? ' — ' + t.tenHopDong : ''}.\nMở link sau trên điện thoại hoặc máy tính${han}:\n${t.link}\n\nKhi bấm ký, hệ thống gửi mã OTP tới số điện thoại / email đã đăng ký.`,
    html: `<p>${esc(tenCongTy())} mời <b>${esc(t.tenNguoiKy || 'quý khách')}</b> xem và ký hợp đồng <b>${esc(t.soHopDong || '')}</b>${t.tenHopDong ? ' — ' + esc(t.tenHopDong) : ''}.</p>
           <p><a href="${esc(t.link)}" style="display:inline-block;padding:12px 22px;background:#1a73e8;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">Xem và ký hợp đồng</a></p>
           <p style="color:#5f6368;font-size:13px">Hoặc mở link: ${esc(t.link)}${esc(han)}<br>Khi bấm ký, hệ thống gửi mã OTP tới số điện thoại / email đã đăng ký.</p>` });
  if (kenh === 'zalo') {
    if (!process.env.ZALO_ZNS_TEMPLATE_LINK) return { ok: false, loi: 'Kênh Zalo (ZNS) chưa có mẫu "link ký" (ZALO_ZNS_TEMPLATE_LINK) — gửi bằng Email/SMS.' };
    return guiZaloZNS({ to: dich, templateId: process.env.ZALO_ZNS_TEMPLATE_LINK, templateData: { so_hop_dong: String(t.soHopDong || ''), link: String(t.link || '') } });
  }
  return { ok: false, loi: 'Kênh gửi không hợp lệ: ' + kenh };
}

/* Báo sau khi ký xong (cho khách + kế toán). */
async function guiBaoKyXong(kenh, dich, tt) {
  const t = tt || {};
  if (kenh === 'sms') return guiSMS({ to: dich, noiDung: `${tenCongTy()}: Hop dong ${t.soHopDong || ''} da ky xong. Tai ban PDF: ${t.link}` });
  if (kenh === 'email') return guiEmail({ to: dich,
    subject: `[${tenCongTy()}] Hợp đồng ${t.soHopDong || ''} đã ký xong`,
    text: `Hợp đồng ${t.soHopDong || ''}${t.tenHopDong ? ' — ' + t.tenHopDong : ''} đã được các bên ký xong.\nTải bản PDF có chữ ký số: ${t.link}\nMã tra cứu: ${t.maTraCuu || ''}`,
    html: `<p>Hợp đồng <b>${esc(t.soHopDong || '')}</b>${t.tenHopDong ? ' — ' + esc(t.tenHopDong) : ''} đã được các bên ký xong.</p>
           <p><a href="${esc(t.link)}">Tải bản PDF có chữ ký số</a> · Mã tra cứu: <b>${esc(t.maTraCuu || '')}</b></p>` });
  return { ok: false, loi: 'Kênh không hợp lệ: ' + kenh };
}

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

module.exports = { kenhSanSang, cheDich, chuanHoaSDT, emailHopLe, guiEmail, guiSMS, guiZaloZNS, guiOtp, guiLinkKy, guiBaoKyXong, tenCongTy };
