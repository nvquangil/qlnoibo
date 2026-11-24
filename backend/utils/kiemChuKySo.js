/* ==================================================================================================
   v9.61 — KIỂM CHỮ KÝ SỐ TRONG PDF (PAdES / adbe.pkcs7.detached) bằng pkijs + asn1js (thuần JS).
   --------------------------------------------------------------------------------------------------
   Dùng ở hai chỗ:
     1. Khách chọn "ký số" rồi TẢI LÊN bản PDF đã ký bằng phần mềm CA của họ (utils/hopDongPdf + routes/publicKy):
        kiemBanTaiLen(buf, bufGoc) — phần đầu file phải BẰNG ĐÚNG bản gốc đã gửi (chữ ký số chuẩn ghi thêm
        "incremental update", không ghi lại file), rồi kiểm từng chữ ký: băm đúng /ByteRange, so messageDigest,
        xác minh chữ ký bằng khóa công khai trong chứng thư, hạn chứng thư tại thời điểm ký, tên/MST trên chứng thư.
     2. Tự kiểm bản MOYN vừa ký (utils/kySoPdf.js) trước khi lưu — ký hỏng thì biết ngay, không gửi bản lỗi cho khách.
   KHÔNG kiểm chuỗi tin cậy tới gốc (NEAC) / thu hồi CRL-OCSP ở giai đoạn 1 — ghi rõ trên trang chứng nhận:
   "kiểm chuỗi tin cậy bằng Adobe Reader". Mọi hàm trả { ok, loi, ... }, không ném.
   ================================================================================================== */
'use strict';
const crypto = require('crypto');

let _pkijs = null, _asn1js = null;
function nap() {
  if (_pkijs) return { pkijs: _pkijs, asn1js: _asn1js };
  const pkijs = require('pkijs');
  const asn1js = require('asn1js');
  const webcrypto = crypto.webcrypto;
  /* pkijs v3: setEngine(name, engine) với CryptoEngine({ name, crypto }); v2: setEngine(name, crypto, subtle). Thử v3 trước. */
  try {
    pkijs.setEngine('node', new pkijs.CryptoEngine({ name: 'node', crypto: webcrypto }));
  } catch (e) {
    try { pkijs.setEngine('node', webcrypto, new pkijs.CryptoEngine({ name: 'node', crypto: webcrypto, subtle: webcrypto.subtle })); }
    catch (e2) { /* pkijs tự dùng globalThis.crypto (Node >= 19) */ }
  }
  _pkijs = pkijs; _asn1js = asn1js;
  return { pkijs, asn1js };
}

const toAB = (buf) => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const OID_TEN = { '2.5.4.3': 'CN', '2.5.4.5': 'SERIALNUMBER', '2.5.4.6': 'C', '2.5.4.7': 'L', '2.5.4.8': 'ST', '2.5.4.10': 'O', '2.5.4.11': 'OU', '1.2.840.113549.1.9.1': 'E', '2.5.4.4': 'SN', '2.5.4.42': 'GN', '2.5.4.12': 'T' };

function docTenRDN(rdn) {
  const o = {};
  try {
    (rdn.typesAndValues || []).forEach(tv => {
      const k = OID_TEN[tv.type] || tv.type;
      const v = tv.value && tv.value.valueBlock ? tv.value.valueBlock.value : String(tv.value || '');
      o[k] = o[k] ? o[k] + ', ' + v : String(v);
    });
  } catch (e) { /* bỏ qua */ }
  return o;
}
/* MST trên chứng thư Việt Nam thường nằm ở SERIALNUMBER dạng "MST:0101234567" (doanh nghiệp) hoặc "CCCD:..."/"CMND:..." (cá nhân). */
function layMST(chu) {
  const s = String(chu.SERIALNUMBER || chu.serialNumber || '');
  const m = /MST\s*:?\s*([0-9\-]{8,16})/i.exec(s) || /([0-9]{10}(?:-[0-9]{3})?)/.exec(s);
  return m ? m[1] : '';
}
function thongTinChungThu(cert) {
  const chu = docTenRDN(cert.subject);
  const nguoiCap = docTenRDN(cert.issuer);
  let serial = '';
  try { serial = Buffer.from(cert.serialNumber.valueBlock.valueHexView || cert.serialNumber.valueBlock.valueHex).toString('hex').toUpperCase(); } catch (e) { /* bỏ */ }
  return {
    CN: chu.CN || '', O: chu.O || '', MST: layMST(chu), SERIALNUMBER: chu.SERIALNUMBER || '',
    nguoiCap: nguoiCap.CN || nguoiCap.O || '', serial,
    tuNgay: cert.notBefore && cert.notBefore.value, denNgay: cert.notAfter && cert.notAfter.value,
    chuDe: Object.keys(chu).map(k => k + '=' + chu[k]).join(', ')
  };
}

/* Tìm MỌI chữ ký trong PDF: mỗi /ByteRange [a b c d] ⇒ phần hex /Contents nằm đúng trong khoảng trống [a+b, c). */
function timChuKy(buf) {
  const s = buf.toString('latin1');
  const re = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g;
  const ra = [];
  let m;
  while ((m = re.exec(s)) !== null) {
    const a = +m[1], b = +m[2], c = +m[3], d = +m[4];
    if (a !== 0 || b <= 0 || c < a + b || c + d > buf.length) continue;   // ByteRange hỏng/placeholder chưa điền
    const hole = s.slice(a + b, c);
    const hex = hole.replace(/[^0-9A-Fa-f]/g, '');
    if (!hex) continue;
    ra.push({ byteRange: [a, b, c, d], hex, viTri: m.index });
  }
  // cùng ByteRange (placeholder tự lặp trong incremental update) thì giữ một
  const daCo = new Set();
  return ra.filter(x => { const k = x.byteRange.join(','); if (daCo.has(k)) return false; daCo.add(k); return true; });
}

/* Kiểm MỘT chữ ký: trả { hopLe, chungThu, kyLuc, coDauThoiGian, loi }. */
async function kiemMotChuKy(buf, ck) {
  const { pkijs, asn1js } = nap();
  try {
    const der = Buffer.from(ck.hex.replace(/(00)+$/, ''), 'hex');   // bỏ đệm 0 phía sau placeholder
    const asn = asn1js.fromBER(toAB(der));
    if (asn.offset === -1) return { hopLe: false, loi: 'CMS không đọc được (ASN.1 hỏng)' };
    const ci = new pkijs.ContentInfo({ schema: asn.result });
    if (ci.contentType !== '1.2.840.113549.1.7.2') return { hopLe: false, loi: 'Không phải SignedData (' + ci.contentType + ')' };
    const sd = new pkijs.SignedData({ schema: ci.content });
    const [a, b, c, d] = ck.byteRange;
    const data = Buffer.concat([buf.slice(a, a + b), buf.slice(c, c + d)]);
    let hopLe = false, loi = '';
    try {
      const kq = await sd.verify({ signer: 0, data: toAB(data), checkChain: false, trustedCerts: [] });
      hopLe = kq === true || (kq && kq.signatureVerified === true);
      if (!hopLe && kq && kq.message) loi = kq.message;
    } catch (e) { loi = 'Xác minh thất bại: ' + (e && e.message ? e.message : String(e)); }
    const si = sd.signerInfos && sd.signerInfos[0];
    // chứng thư người ký: khớp issuer+serial của sid
    let cert = null;
    try {
      const sid = si.sid;
      cert = (sd.certificates || []).find(c0 => c0.issuer && sid.issuer && c0.issuer.isEqual(sid.issuer) && c0.serialNumber.isEqual(sid.serialNumber)) || (sd.certificates || [])[0] || null;
    } catch (e) { cert = (sd.certificates || [])[0] || null; }
    let kyLuc = null, coDauThoiGian = false;
    try {
      const at = si.signedAttrs && si.signedAttrs.attributes.find(x => x.type === '1.2.840.113549.1.9.5');
      if (at && at.values[0] && at.values[0].toDate) kyLuc = at.values[0].toDate();
      coDauThoiGian = !!(si.unsignedAttrs && si.unsignedAttrs.attributes.some(x => x.type === '1.2.840.113549.1.9.16.2.14'));
    } catch (e) { /* bỏ */ }
    const tt = cert ? thongTinChungThu(cert) : null;
    let conHan = null;
    if (tt && tt.tuNgay && tt.denNgay) {
      const moc = kyLuc || new Date();
      conHan = moc >= tt.tuNgay && moc <= tt.denNgay;
    }
    return { hopLe, loi, chungThu: tt, kyLuc, coDauThoiGian, conHan, byteRange: ck.byteRange };
  } catch (e) { return { hopLe: false, loi: 'Lỗi đọc chữ ký: ' + e.message }; }
}

/* Kiểm mọi chữ ký trong file. */
async function kiemPdf(buf) {
  const ds = timChuKy(buf);
  if (!ds.length) return { ok: false, loi: 'File không có chữ ký số nào.', chuKy: [] };
  const chuKy = [];
  for (const ck of ds) chuKy.push(await kiemMotChuKy(buf, ck));
  return { ok: chuKy.every(x => x.hopLe), loi: chuKy.filter(x => !x.hopLe).map(x => x.loi).join('; '), chuKy };
}

/* Bản khách TẢI LÊN: phần đầu phải bằng đúng bản gốc (incremental update), rồi chữ ký CUỐI phải hợp lệ. */
async function kiemBanTaiLen(buf, bufGoc, mongDoi) {
  if (!Buffer.isBuffer(buf) || buf.length < 100) return { ok: false, loi: 'File tải lên trống hoặc không phải PDF.' };
  if (buf.slice(0, 5).toString('latin1') !== '%PDF-') return { ok: false, loi: 'File tải lên không phải PDF.' };
  if (bufGoc) {
    if (buf.length <= bufGoc.length || !buf.slice(0, bufGoc.length).equals(bufGoc)) {
      return { ok: false, maLoi: 'KHONG_INCREMENTAL',
        loi: 'Nội dung không còn là bản đã gửi: phần mềm ký đã GHI LẠI toàn bộ file (hoặc đây là file khác). Hãy ký bằng Adobe Acrobat Reader, Foxit hoặc plugin của nhà cung cấp chữ ký số — các phần mềm này ghi thêm chữ ký vào cuối file, không thay nội dung — rồi tải lại đúng file vừa tải về.' };
    }
  }
  const kq = await kiemPdf(buf);
  if (!kq.chuKy.length) return { ok: false, maLoi: 'KHONG_CHU_KY', loi: kq.loi };
  // chữ ký mới nhất = ByteRange rộng nhất (incremental cuối cùng)
  const cuoi = kq.chuKy.slice().sort((x, y) => (y.byteRange[2] + y.byteRange[3]) - (x.byteRange[2] + x.byteRange[3]))[0];
  if (!cuoi.hopLe) return { ok: false, maLoi: 'CHU_KY_SAI', loi: 'Chữ ký số không hợp lệ: ' + (cuoi.loi || 'không xác minh được'), chuKy: kq.chuKy };
  if (cuoi.conHan === false) return { ok: false, maLoi: 'HET_HAN', loi: 'Chứng thư số đã hết hạn / chưa có hiệu lực tại thời điểm ký.', chuKy: kq.chuKy };
  const canhBao = [];
  const m = mongDoi || {};
  if (m.mst && cuoi.chungThu && cuoi.chungThu.MST && String(cuoi.chungThu.MST).replace(/\D/g, '') !== String(m.mst).replace(/\D/g, '')) {
    canhBao.push(`MST trên chứng thư (${cuoi.chungThu.MST}) khác MST bên ký (${m.mst}).`);
  }
  if (m.ten && cuoi.chungThu && cuoi.chungThu.CN && !khopTen(cuoi.chungThu.CN, m.ten) && !khopTen(cuoi.chungThu.O, m.ten)) {
    canhBao.push(`Tên trên chứng thư ("${cuoi.chungThu.CN}") không khớp tên bên ký ("${m.ten}").`);
  }
  return { ok: true, chuKy: kq.chuKy, cuoi, canhBao };
}
function boDau(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/[^a-z0-9]/g, ''); }
function khopTen(a, b) { const x = boDau(a), y = boDau(b); return !!x && !!y && (x.includes(y) || y.includes(x)); }

module.exports = { nap, toAB, thongTinChungThu, docTenRDN, timChuKy, kiemMotChuKy, kiemPdf, kiemBanTaiLen, khopTen, boDau };
