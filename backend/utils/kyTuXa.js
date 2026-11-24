/* ==================================================================================================
   v9.62 — KÝ SỐ TỪ XA qua nhà cung cấp CA (VNPT SmartCA / chuẩn CSC: Viettel MySign, FPT.eSign…) — KHUNG CÓ CHỖ CẮM.
   --------------------------------------------------------------------------------------------------
   Người ký KHÔNG cần cài gì: chứng thư + khóa ở CA, xác nhận trên ứng dụng điện thoại của CA (SmartCA) hoặc OTP (CSC).
   Cách ghép: dùng ĐÚNG đường ký ngoài của utils/kySoPdf.js — máy chủ dựng signedAttrs (dataKy), băm SHA-256, gửi hash
   cho CA ký (RSA PKCS#1 v1.5 + DigestInfo SHA-256 = "sha256WithRSA"), nhận chữ ký về, hoanTatKyNgoai ghép CMS + TSA.

   ⚠️ CHƯA ĐỐI CHIẾU TÀI LIỆU + CHƯA CÓ TÀI KHOẢN (sandbox chết, chưa có hợp đồng với CA). Địa chỉ / tên trường để trong
   cấu hình, đổi được bằng .env mà không sửa mã. Lần gọi thật đầu tiên PHẢI xem log (`[kyTuXa]`): mọi trả lời của CA
   được ghi gọn (không ghi mật khẩu). Hai bộ chuyển đổi:
     · vnptsmartca — VNPT SmartCA "SP769" (giao dịch bất đồng bộ: gửi hash → khách bấm xác nhận trên app → poll trạng thái).
     · csc         — Cloud Signature Consortium API v1 (credentials/info → authorize (OTP/PIN) → signatures/signHash).
   Phiên sống trong bộ nhớ ≤ 10 phút (cùng hạn với phiên ký ngoài). Mọi hàm ném Error có câu rõ — route tự bắt.
   ================================================================================================== */
'use strict';
const crypto = require('crypto');
const kySo = require('./kySoPdf');

function cauHinh() {
  const nha = String(process.env.KYTUXA_NHA || '').toLowerCase().trim();
  const c = {
    nha: ['vnptsmartca', 'csc'].includes(nha) ? nha : '',
    tenHienThi: process.env.KYTUXA_TEN || (nha === 'csc' ? 'Ký từ xa (CSC)' : 'VNPT SmartCA'),
    baseUrl: String(process.env.KYTUXA_BASE_URL || (nha === 'vnptsmartca' ? 'https://gwsca.vnpt.vn/sca/sp769/v1' : '')).replace(/\/$/, ''),
    spId: process.env.KYTUXA_SP_ID || '', spPassword: process.env.KYTUXA_SP_PASSWORD || '',
    clientId: process.env.KYTUXA_CLIENT_ID || '', clientSecret: process.env.KYTUXA_CLIENT_SECRET || '',
    username: process.env.KYTUXA_USERNAME || '', password: process.env.KYTUXA_PASSWORD || '',
    tokenUrl: process.env.KYTUXA_TOKEN_URL || '',
    nhanUserId: process.env.KYTUXA_NHAN_USER_ID || (nha === 'csc' ? 'Tên đăng nhập / mã chứng thư tại CA' : 'Số điện thoại hoặc CCCD đăng ký SmartCA'),
    hetGioMs: 20000
  };
  c.san = !!c.nha && !!c.baseUrl && (c.nha === 'vnptsmartca' ? !!(c.spId && c.spPassword) : !!(c.clientId || c.username));
  return c;
}

const log = (...a) => console.log('[kyTuXa]', ...a.map(x => (typeof x === 'string' ? x.slice(0, 500) : x)));
async function goiJson(url, body, headers, hetGio) {
  const r = await fetch(url, { method: body === undefined ? 'GET' : 'POST', headers: Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' }, headers || {}),
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(hetGio || 20000) });
  const chu = await r.text();
  let j = null; try { j = JSON.parse(chu); } catch (e) { /* xem dưới */ }
  if (!j) throw new Error('CA trả về không phải JSON (HTTP ' + r.status + '): ' + chu.slice(0, 200));
  return { http: r.status, j };
}
const an = (o) => { try { const c = JSON.parse(JSON.stringify(o || {})); ['sp_password', 'password', 'client_secret', 'PIN', 'OTP', 'SAD', 'access_token'].forEach(k => { if (c[k]) c[k] = '***'; }); return JSON.stringify(c).slice(0, 400); } catch (e) { return ''; } };

/* ---------------------------------------------------------------- VNPT SmartCA (SP769) — ⚠️ theo trí nhớ, chưa đối chiếu */
function boVnpt(cfg) {
  const than = (them) => Object.assign({ sp_id: cfg.spId, sp_password: cfg.spPassword }, them);
  const ok = (j) => j && (Number(j.status_code) === 200 || Number(j.status_code) === 0 || j.code === 0 || j.status === 'success');
  return {
    kieu: 'poll',
    async layChungThu({ userId, serial }) {
      const { j } = await goiJson(cfg.baseUrl + '/credentials/get_certificate', than({ user_id: userId, serial_number: serial || undefined }), null, cfg.hetGioMs);
      log('get_certificate →', an(j));
      if (!ok(j)) throw new Error('SmartCA không trả chứng thư: ' + (j.message || j.status_code));
      const d = j.data || j;
      const ds = d.user_certificates || d.certificates || (d.cert_data ? [d] : []);
      if (!ds.length) throw new Error('Tài khoản SmartCA này chưa có chứng thư số.');
      const c = ds.find(x => !serial || String(x.serial_number || x.serial || '').toUpperCase() === String(serial).toUpperCase()) || ds[0];
      const b64 = c.cert_data || c.cert || c.certificate;
      if (!b64) throw new Error('SmartCA trả chứng thư nhưng không có trường cert_data.');
      return { certDer: Buffer.from(String(b64).replace(/-----[^-]+-----|\s/g, ''), 'base64'), serial: c.serial_number || c.serial || '' };
    },
    async guiKy({ userId, serial, hashBase64, moTa, maGiaoDich }) {
      const { j } = await goiJson(cfg.baseUrl + '/signatures/sign', than({ user_id: userId, serial_number: serial || undefined, transaction_desc: moTa, transaction_id: maGiaoDich,
        sign_files: [{ data_to_be_signed: hashBase64, doc_id: maGiaoDich, file_type: 'pdf', sign_type: 'hash' }] }), null, cfg.hetGioMs);
      log('sign →', an(j));
      if (!ok(j)) throw new Error('SmartCA từ chối yêu cầu ký: ' + (j.message || j.status_code));
      const d = j.data || j;
      const tranId = d.tran_code || d.transaction_id || d.tranId;
      if (!tranId) throw new Error('SmartCA không trả mã giao dịch.');
      return { tranId, huongDan: 'Mở ứng dụng VNPT SmartCA trên điện thoại, xác nhận giao dịch ký "' + moTa + '".' };
    },
    async trangThai({ tranId }) {
      const url = cfg.baseUrl + '/signatures/sign/' + encodeURIComponent(tranId) + '/status';
      const { j } = await goiJson(url, than({ tran_code: tranId }), null, cfg.hetGioMs);
      const d = j.data || j;
      const sigs = d.signatures || d.sign_files || [];
      const sv = sigs.length && (sigs[0].signature_value || sigs[0].signature || sigs[0].data_signed);
      if (ok(j) && sv) return { xong: true, chuKyBase64: String(sv).replace(/\s/g, '') };
      const msg = String(j.message || d.status_desc || d.status || '');
      if (/reject|từ chối|tu choi|cancel|hủy|huy|expire|hết hạn|het han|timeout/i.test(msg) || Number(j.status_code) >= 500) return { xong: false, loi: 'SmartCA: ' + (msg || ('mã ' + j.status_code)) };
      return { xong: false, dangCho: true, thongDiep: msg };
    }
  };
}

/* ---------------------------------------------------------------- CSC API v1 (Viettel MySign / FPT.eSign / CA theo chuẩn CSC) */
function boCsc(cfg) {
  let token = null, tokenHetHan = 0;
  async function layToken() {
    if (token && Date.now() < tokenHetHan) return token;
    if (cfg.tokenUrl) {   // OAuth2 client credentials / password
      const body = new URLSearchParams(cfg.username ? { grant_type: 'password', username: cfg.username, password: cfg.password, client_id: cfg.clientId, client_secret: cfg.clientSecret }
        : { grant_type: 'client_credentials', client_id: cfg.clientId, client_secret: cfg.clientSecret });
      const r = await fetch(cfg.tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body, signal: AbortSignal.timeout(cfg.hetGioMs) });
      const j = await r.json().catch(() => ({}));
      if (!j.access_token) throw new Error('CA không cấp access_token: ' + JSON.stringify(j).slice(0, 200));
      token = j.access_token; tokenHetHan = Date.now() + Math.max(60, Number(j.expires_in || 3600) - 60) * 1000;
      return token;
    }
    const { j } = await goiJson(cfg.baseUrl + '/auth/login', { rememberMe: false }, { Authorization: 'Basic ' + Buffer.from((cfg.username || cfg.clientId) + ':' + (cfg.password || cfg.clientSecret)).toString('base64') }, cfg.hetGioMs);
    if (!j.access_token) throw new Error('CSC auth/login không cấp access_token: ' + JSON.stringify(j).slice(0, 200));
    token = j.access_token; tokenHetHan = Date.now() + Math.max(60, Number(j.expires_in || 3600) - 60) * 1000;
    return token;
  }
  const goi = async (duong, body) => { const t = await layToken(); const { j } = await goiJson(cfg.baseUrl + duong, body, { Authorization: 'Bearer ' + t }, cfg.hetGioMs); if (j.error) throw new Error('CSC ' + duong + ': ' + (j.error_description || j.error)); return j; };
  return {
    kieu: 'otp',
    async layChungThu({ userId }) {
      // userId = credentialID (hoặc tên đăng nhập → lấy credentials/list rồi chọn cái đầu)
      let credentialID = userId;
      if (!credentialID) { const ds = await goi('/credentials/list', {}); credentialID = (ds.credentialIDs || [])[0]; }
      if (!credentialID) throw new Error('Không có credential nào ở CA cho tài khoản này.');
      const info = await goi('/credentials/info', { credentialID, certificates: 'chain', certInfo: true, authInfo: true });
      log('credentials/info →', an(info));
      const certs = (info.cert && info.cert.certificates) || [];
      if (!certs.length) throw new Error('CA không trả chứng thư cho credential ' + credentialID);
      return { certDer: Buffer.from(String(certs[0]).replace(/\s/g, ''), 'base64'), serial: credentialID, authMode: info.authMode || 'explicit', chain: certs.slice(1).map(s => Buffer.from(String(s).replace(/\s/g, ''), 'base64')) };
    },
    async guiKy({ userId, hashBase64 }) {
      // CSC: chưa ký ngay — cần SAD (OTP/PIN người ký nhập). Trả tranId = credentialID; chữ ký lấy ở xacNhan().
      return { tranId: userId, huongDan: 'Nhập mã OTP / PIN mà CA gửi cho bạn (ứng dụng hoặc SMS của CA) rồi bấm Xác nhận.', hashBase64 };
    },
    async xacNhan({ tranId, hashBase64, otp, pin }) {
      const au = await goi('/credentials/authorize', Object.assign({ credentialID: tranId, numSignatures: 1, hash: [hashBase64] }, otp ? { OTP: otp } : {}, pin ? { PIN: pin } : {}));
      if (!au.SAD) throw new Error('CA không cấp SAD (OTP/PIN sai?)');
      const s = await goi('/signatures/signHash', { credentialID: tranId, SAD: au.SAD, hash: [hashBase64], hashAlgo: '2.16.840.1.101.3.4.2.1', signAlgo: '1.2.840.113549.1.1.1' });
      const sv = (s.signatures || [])[0];
      if (!sv) throw new Error('CA không trả chữ ký.');
      return { xong: true, chuKyBase64: String(sv).replace(/\s/g, '') };
    },
    async trangThai() { return { xong: false, dangCho: true, thongDiep: 'Cần nhập OTP/PIN (CSC không poll).' }; }
  };
}

function boKy(cfg) {
  const c = cfg || cauHinh();
  if (!c.san) throw new Error('Ký từ xa chưa cấu hình (KYTUXA_NHA / KYTUXA_BASE_URL / tài khoản SP trong backend\\.env).');
  return c.nha === 'csc' ? boCsc(c) : boVnpt(c);
}

// ---------------------------------------------------------------- phiên
const phien = new Map();
const HAN_MS = 10 * 60 * 1000;
function don() { const now = Date.now(); for (const [k, v] of phien) if (v.taoLuc + HAN_MS < now) { kySo.huyKyNgoai(k); phien.delete(k); } }

/* Bắt đầu: lấy chứng thư ở CA → đặt chỗ ký + signedAttrs (kySoPdf) → gửi hash cho CA. Trả { phienKy, kieu, huongDan, thongTin }. */
async function batDau({ pdfBuffer, userId, serial, moTa, tt }) {
  don();
  const cfg = cauHinh();
  const bo = boKy(cfg);
  const uid = String(userId || '').trim();
  if (!uid && cfg.nha === 'vnptsmartca') throw new Error('Nhập ' + cfg.nhanUserId + '.');
  const ct = await bo.layChungThu({ userId: uid, serial });
  const bd = await kySo.batDauKyNgoai(pdfBuffer, ct.certDer, tt);
  const hashBase64 = crypto.createHash('sha256').update(Buffer.from(bd.dataKy, 'base64')).digest('base64');
  let gk;
  try { gk = await bo.guiKy({ userId: uid, serial: ct.serial, hashBase64, moTa: moTa || 'Ký hợp đồng', maGiaoDich: bd.phienKy }); }
  catch (e) { kySo.huyKyNgoai(bd.phienKy); throw e; }
  phien.set(bd.phienKy, { tranId: gk.tranId, userId: uid, hashBase64, nha: cfg.nha, taoLuc: Date.now(), kieu: bo.kieu, bo });
  return { phienKy: bd.phienKy, kieu: bo.kieu, huongDan: gk.huongDan, thongTin: bd.thongTin, nha: cfg.tenHienThi };
}
/* Poll (SmartCA): xong ⇒ { xong:true, kq:{pdf,thongTin,tsa} } ; đang chờ ⇒ { xong:false, dangCho:true } ; lỗi ⇒ ném. */
async function kiem(phienKy) {
  don();
  const p = phien.get(String(phienKy || ''));
  if (!p) throw new Error('Phiên ký từ xa không tồn tại hoặc đã hết hạn (10 phút).');
  const tt = await p.bo.trangThai({ tranId: p.tranId });
  if (tt.xong) {
    phien.delete(phienKy);
    const kq = await kySo.hoanTatKyNgoai(phienKy, tt.chuKyBase64);
    return { xong: true, kq };
  }
  if (tt.loi) { phien.delete(phienKy); kySo.huyKyNgoai(phienKy); throw new Error(tt.loi); }
  return { xong: false, dangCho: true, thongDiep: tt.thongDiep || '' };
}
/* Xác nhận OTP/PIN (CSC). */
async function xacNhan(phienKy, otp, pin) {
  don();
  const p = phien.get(String(phienKy || ''));
  if (!p) throw new Error('Phiên ký từ xa không tồn tại hoặc đã hết hạn (10 phút).');
  if (!p.bo.xacNhan) throw new Error('Nhà cung cấp này xác nhận trên ứng dụng — không nhập OTP ở đây.');
  let tt;
  try { tt = await p.bo.xacNhan({ tranId: p.tranId, hashBase64: p.hashBase64, otp, pin }); }
  catch (e) { throw new Error(e.message); }   // sai OTP thì phiên vẫn còn để nhập lại
  phien.delete(phienKy);
  const kq = await kySo.hoanTatKyNgoai(phienKy, tt.chuKyBase64);
  return { xong: true, kq };
}
function huy(phienKy) { phien.delete(String(phienKy || '')); kySo.huyKyNgoai(phienKy); }

module.exports = { cauHinh, boKy, boVnpt, boCsc, batDau, kiem, xacNhan, huy };
