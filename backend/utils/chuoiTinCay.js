/* ==================================================================================================
   v9.62 — KIỂM CHUỖI TIN CẬY chứng thư số (tới gốc) + THU HỒI (CRL) — pkijs.
   --------------------------------------------------------------------------------------------------
   Chứng thư gốc / trung gian được TIN nằm ở backend/chungthu_goc/ (*.cer, *.crt, *.pem, *.der): tải từ cổng NEAC
   (rootca.gov.vn — "Chứng thư số CA gốc quốc gia" + CA công cộng: VNPT-CA, Viettel-CA, FPT-CA, MISA, BKAV, NewCA…).
   Chưa có file nào ⇒ kết quả "chưa nạp chứng thư gốc" (KHÔNG coi là sai — trang chứng nhận ghi "kiểm bằng Adobe Reader").
   CRL: đọc điểm phân phối trong chứng thư (2.5.29.31), tải về (đệm 6 giờ), hỏi isCertificateRevoked. OCSP: chưa (giai đoạn 3).
   Trả { ok: true|false|null, lyDo, goc, duongDi[], crl: { kiem: true|false, lyDo } } — không ném.
   ================================================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const kiemCK = require('./kiemChuKySo');

const THU_MUC_GOC = path.join(__dirname, '..', 'chungthu_goc');
let _goc = { luc: 0, ds: [], loi: [] };
const _crl = new Map();   // url -> { luc, crl }
const CRL_DEM_MS = 6 * 60 * 60 * 1000;

function docPemHoacDer(buf) {
  const s = buf.toString('latin1');
  if (/-----BEGIN CERTIFICATE-----/.test(s)) {
    return s.split(/-----BEGIN CERTIFICATE-----/).slice(1).map(p => Buffer.from(p.split('-----END CERTIFICATE-----')[0].replace(/\s/g, ''), 'base64'));
  }
  return [buf];
}
/* Nạp (đệm theo mtime thư mục). */
function docChungThuGoc() {
  try {
    if (!fs.existsSync(THU_MUC_GOC)) { fs.mkdirSync(THU_MUC_GOC, { recursive: true }); return { ds: [], loi: [] }; }
    const st = fs.statSync(THU_MUC_GOC);
    const files = fs.readdirSync(THU_MUC_GOC).filter(f => /\.(cer|crt|pem|der)$/i.test(f));
    const dau = st.mtimeMs + ':' + files.join(',');
    if (_goc.dau === dau) return _goc;
    const { pkijs, asn1js } = kiemCK.nap();
    const ds = [], loi = [];
    for (const f of files) {
      try {
        for (const der of docPemHoacDer(fs.readFileSync(path.join(THU_MUC_GOC, f)))) {
          const asn = asn1js.fromBER(kiemCK.toAB(der));
          if (asn.offset === -1) throw new Error('DER hỏng');
          const c = new pkijs.Certificate({ schema: asn.result });
          ds.push({ file: f, cert: c, tt: kiemCK.thongTinChungThu(c) });
        }
      } catch (e) { loi.push(f + ': ' + e.message); }
    }
    _goc = { dau, ds, loi };
    return _goc;
  } catch (e) { return { ds: [], loi: [e.message] }; }
}

function cdpUrls(cert) {
  const ra = [];
  try {
    const ext = (cert.extensions || []).find(x => x.extnID === '2.5.29.31');
    if (!ext || !ext.parsedValue) return ra;
    (ext.parsedValue.distributionPoints || []).forEach(dp => {
      const names = Array.isArray(dp.distributionPoint) ? dp.distributionPoint : [];
      names.forEach(n => { if (n.type === 6 && /^https?:\/\//i.test(String(n.value))) ra.push(String(n.value)); });
    });
  } catch (e) { /* bỏ */ }
  return ra;
}
async function taiCrl(url) {
  const c = _crl.get(url);
  if (c && Date.now() - c.luc < CRL_DEM_MS) return c.crl;
  const { pkijs, asn1js } = kiemCK.nap();
  const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  let der = Buffer.from(await r.arrayBuffer());
  if (/-----BEGIN X509 CRL-----/.test(der.toString('latin1'))) der = Buffer.from(der.toString('latin1').replace(/-----[^-]+-----|\s/g, ''), 'base64');
  const asn = asn1js.fromBER(kiemCK.toAB(der));
  if (asn.offset === -1) throw new Error('CRL không đọc được');
  const crl = new pkijs.CertificateRevocationList({ schema: asn.result });
  _crl.set(url, { luc: Date.now(), crl });
  return crl;
}

/* Kiểm chuỗi: cert (pkijs.Certificate) + chain (mảng pkijs.Certificate, có thể rỗng) tại thời điểm tuyChon.luc. */
async function kiemChuoi(cert, chain, tuyChon) {
  const tc = tuyChon || {};
  const goc = docChungThuGoc();
  if (!goc.ds.length) return { ok: null, lyDo: 'Chưa nạp chứng thư gốc (backend\\chungthu_goc\\ trống) — kiểm chuỗi tin cậy bằng Adobe Reader.', goc: null, duongDi: [], crl: { kiem: false, lyDo: 'chưa kiểm' } };
  const { pkijs } = kiemCK.nap();
  let kq;
  try {
    /* pkijs: chứng thư NGƯỜI KÝ phải ở CUỐI mảng certs ("end entity must be the last") — trung gian đứng trước. Đường đi trả về: [người ký, …, gốc]. */
    const engine = new pkijs.CertificateChainValidationEngine({ trustedCerts: goc.ds.map(x => x.cert), certs: (chain || []).concat([cert]), crls: [], checkDate: tc.luc ? new Date(tc.luc) : new Date() });
    kq = await engine.verify();
  } catch (e) { return { ok: false, lyDo: 'Lỗi kiểm chuỗi: ' + e.message, goc: null, duongDi: [], crl: { kiem: false, lyDo: 'chưa kiểm' } }; }
  const duongDi = (kq.certificatePath || []).map(c => { try { return kiemCK.thongTinChungThu(c).CN; } catch (e) { return '?'; } });
  if (!kq.result) return { ok: false, lyDo: 'Không nối được tới chứng thư gốc tin cậy: ' + (kq.resultMessage || ('mã ' + kq.resultCode)), goc: null, duongDi, crl: { kiem: false, lyDo: 'chưa kiểm' } };
  const gocCN = duongDi.length ? duongDi[duongDi.length - 1] : null;
  // CRL cho chứng thư người ký (và trung gian nếu có)
  const crl = { kiem: false, lyDo: '' };
  if (tc.checkCRL !== false) {
    const canKiem = [cert].concat((kq.certificatePath || []).slice(1, -1));
    const loi = [];
    let daKiem = 0;
    for (const c of canKiem) {
      const urls = cdpUrls(c);
      if (!urls.length) { loi.push('không có điểm CRL'); continue; }
      let xong = false;
      for (const u of urls) {
        try {
          const l = await taiCrl(u);
          if (l.isCertificateRevoked(c)) return { ok: false, lyDo: 'Chứng thư ĐÃ BỊ THU HỒI (CRL ' + u + ')', goc: gocCN, duongDi, crl: { kiem: true, lyDo: 'đã thu hồi' } };
          xong = true; daKiem++; break;
        } catch (e) { loi.push(u + ': ' + e.message); }
      }
      if (!xong) loi.push('không tải được CRL');
    }
    crl.kiem = daKiem === canKiem.length;
    crl.lyDo = crl.kiem ? 'không bị thu hồi (CRL)' : ('không kiểm được CRL: ' + loi.join('; ').slice(0, 200));
  } else crl.lyDo = 'bỏ qua';
  return { ok: true, lyDo: 'Chuỗi tin cậy hợp lệ tới gốc "' + gocCN + '"', goc: gocCN, duongDi, crl };
}

/* Chuỗi ngắn để lưu CSDL / in trang chứng nhận. */
function tomTat(kq) {
  if (!kq) return '';
  if (kq.ok === null) return 'Chưa kiểm chuỗi tin cậy (chưa nạp chứng thư gốc)';
  return (kq.ok ? '✔ ' : '✖ ') + kq.lyDo + (kq.crl && kq.crl.lyDo ? ' · ' + kq.crl.lyDo : '');
}

/* Kiểm chữ ký cuối trong một PDF đã ký (dùng cho bản khách tải lên / bản MOYN). */
async function kiemPdfDaKy(buf, luc) {
  const ds = kiemCK.timChuKy(buf);
  if (!ds.length) return { ok: null, lyDo: 'không có chữ ký' };
  const { pkijs, asn1js } = kiemCK.nap();
  const ck = ds.slice().sort((x, y) => (y.byteRange[2] + y.byteRange[3]) - (x.byteRange[2] + x.byteRange[3]))[0];
  try {
    const der = Buffer.from(ck.hex.replace(/(00)+$/, ''), 'hex');
    const ci = new pkijs.ContentInfo({ schema: asn1js.fromBER(kiemCK.toAB(der)).result });
    const sd = new pkijs.SignedData({ schema: ci.content });
    const si = sd.signerInfos[0];
    const cert = (sd.certificates || []).find(c0 => { try { return c0.issuer.isEqual(si.sid.issuer) && c0.serialNumber.isEqual(si.sid.serialNumber); } catch (e) { return false; } }) || (sd.certificates || [])[0];
    if (!cert) return { ok: null, lyDo: 'CMS không chứa chứng thư' };
    return kiemChuoi(cert, (sd.certificates || []).filter(c => c !== cert), { luc });
  } catch (e) { return { ok: null, lyDo: 'không đọc được CMS: ' + e.message }; }
}

module.exports = { THU_MUC_GOC, docChungThuGoc, kiemChuoi, kiemPdfDaKy, tomTat, cdpUrls };
