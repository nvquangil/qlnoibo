/* ==================================================================================================
   v9.61 — KÝ SỐ PDF (PAdES / adbe.pkcs7.detached) + DẤU THỜI GIAN (RFC 3161) — bộ ký có CHỖ CẮM.
   --------------------------------------------------------------------------------------------------
   Một đường ghép chữ ký duy nhất (@signpdf đặt chỗ giữ + ghi hex vào /Contents), ba nguồn chữ ký:
     · pfx     — chứng thư dạng file .pfx/.p12 ở máy chủ (HOPDONG_PFX_PATH + HOPDONG_PFX_PASS): ký TỰ ĐỘNG.
     · pkcs11  — USB token cắm cố định ở máy chủ (HOPDONG_PKCS11_DLL + HOPDONG_PKCS11_PIN): ký TỰ ĐỘNG.
                 🔴 PIN sai là KHÔNG thử lại (token khóa sau vài lần). Nguyen chọn cách này 14/11 ("dùng token sẵn có").
     · ngoai   — ký NGOÀI máy chủ: trang web + công cụ "MOYN Ký số" (tools/MoynKySo) hoặc plugin trên máy người ký:
                 máy chủ đưa dữ liệu cần ký (SET signedAttrs), nhận lại chữ ký RSA PKCS#1 v1.5 + chứng thư, tự ghép CMS.
   CMS dựng bằng pkijs với chữ ký TÍNH NGOÀI (externally signed): signedAttrs = contentType + signingTime + messageDigest;
   signatureAlgorithm rsaEncryption (1.2.840.113549.1.1.1) + digest SHA-256 — Adobe/Foxit/cổng NEAC đọc được.
   Dấu thời gian: băm chữ ký → TimeStampReq → POST HOPDONG_TSA_URL → token vào unsignedAttrs (id-aa-signatureTimeStampToken).
   TSA lỗi ⇒ VẪN KÝ, trả tsa.ok=false để nhật ký ghi "thiếu dấu thời gian" (route cho ghép lại sau).
   Sau khi ký: tự kiểm lại bằng utils/kiemChuKySo.js — ký hỏng thì ném lỗi, không lưu bản hỏng.
   ================================================================================================== */
'use strict';
const crypto = require('crypto');
const fs = require('fs');
const kiem = require('./kiemChuKySo');

const OID = {
  data: '1.2.840.113549.1.7.1', signedData: '1.2.840.113549.1.7.2', sha256: '2.16.840.1.101.3.4.2.1', rsa: '1.2.840.113549.1.1.1',
  contentType: '1.2.840.113549.1.9.3', messageDigest: '1.2.840.113549.1.9.4', signingTime: '1.2.840.113549.1.9.5',
  tstToken: '1.2.840.113549.1.9.16.2.14'
};
const TSA_MAC_DINH = 'http://timestamp.digicert.com';
const DO_DAI_CHO_KY = 24576;   // byte cho /Contents (hex 49152): chuỗi chứng thư + dấu thời gian công cộng ~10-14 KB

function cauHinh() {
  const loai = String(process.env.HOPDONG_KY_TU_DONG || '').toLowerCase().trim();
  return {
    loai: ['pfx', 'pkcs11'].includes(loai) ? loai : 'tat',
    pfxPath: process.env.HOPDONG_PFX_PATH || '', pfxPass: process.env.HOPDONG_PFX_PASS || '',
    dll: process.env.HOPDONG_PKCS11_DLL || '', pin: process.env.HOPDONG_PKCS11_PIN || '',
    slot: process.env.HOPDONG_PKCS11_SLOT || '', certSerial: String(process.env.HOPDONG_PKCS11_SERIAL || '').replace(/[^0-9A-Fa-f]/g, '').toUpperCase(),
    tsaUrl: process.env.HOPDONG_TSA_URL === undefined ? TSA_MAC_DINH : String(process.env.HOPDONG_TSA_URL || '').trim(),
    tsaCongCong: !process.env.HOPDONG_TSA_URL || /digicert|sectigo|globalsign|freetsa|apple|entrust/i.test(process.env.HOPDONG_TSA_URL)
  };
}

// ------------------------------------------------------------------ chứng thư (pkijs)
function certTuDer(der) {
  const { pkijs, asn1js } = kiem.nap();
  const asn = asn1js.fromBER(kiem.toAB(Buffer.from(der)));
  if (asn.offset === -1) throw new Error('Chứng thư không đọc được (DER hỏng)');
  return new pkijs.Certificate({ schema: asn.result });
}
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest();

// ------------------------------------------------------------------ dấu thời gian
async function layDauThoiGian(signatureBuf, tsaUrl) {
  const { pkijs, asn1js } = kiem.nap();
  if (!tsaUrl) return { ok: false, loi: 'Chưa cấu hình HOPDONG_TSA_URL' };
  try {
    const nonce = crypto.randomBytes(8); nonce[0] &= 0x7f;
    const req = new pkijs.TimeStampReq({
      version: 1,
      messageImprint: new pkijs.MessageImprint({ hashAlgorithm: new pkijs.AlgorithmIdentifier({ algorithmId: OID.sha256 }), hashedMessage: new asn1js.OctetString({ valueHex: kiem.toAB(sha256(signatureBuf)) }) }),
      nonce: new asn1js.Integer({ valueHex: kiem.toAB(nonce) }),
      certReq: true
    });
    const body = Buffer.from(req.toSchema().toBER(false));
    const r = await fetch(tsaUrl, { method: 'POST', headers: { 'Content-Type': 'application/timestamp-query', 'Content-Length': String(body.length) }, body, signal: AbortSignal.timeout(20000) });
    if (!r.ok) return { ok: false, loi: 'TSA trả HTTP ' + r.status };
    const der = Buffer.from(await r.arrayBuffer());
    const asn = asn1js.fromBER(kiem.toAB(der));
    if (asn.offset === -1) return { ok: false, loi: 'TSA trả dữ liệu không đọc được' };
    const resp = new pkijs.TimeStampResp({ schema: asn.result });
    const st = resp.status && resp.status.status;
    if (st !== 0 && st !== 1) return { ok: false, loi: 'TSA từ chối (status ' + st + ')' };
    if (!resp.timeStampToken) return { ok: false, loi: 'TSA không trả token' };
    let luc = null;
    try {
      const sd = new pkijs.SignedData({ schema: resp.timeStampToken.content });
      const tst = new pkijs.TSTInfo({ schema: asn1js.fromBER(sd.encapContentInfo.eContent.valueBlock.valueHexView || sd.encapContentInfo.eContent.valueBlock.valueHex).result });
      luc = tst.genTime;
    } catch (e) { /* không đọc được giờ cũng không sao */ }
    return { ok: true, token: resp.timeStampToken, luc, tsaUrl };
  } catch (e) { return { ok: false, loi: 'TSA lỗi: ' + e.message }; }
}

// ------------------------------------------------------------------ CMS với chữ ký tính ngoài
/* chuanBiCms: dựng SignedData + signedAttrs, trả { sd, si, dataKy (Buffer SET signedAttrs), signingTime } — ký dataKy bằng RSA-SHA256 PKCS#1 v1.5. */
function chuanBiCms({ cert, chain, hashNoiDung, signingTime }) {
  const { pkijs, asn1js } = kiem.nap();
  const luc = signingTime || new Date();
  const sd = new pkijs.SignedData({
    version: 1,
    encapContentInfo: new pkijs.EncapsulatedContentInfo({ eContentType: OID.data }),
    signerInfos: [new pkijs.SignerInfo({ version: 1, sid: new pkijs.IssuerAndSerialNumber({ issuer: cert.issuer, serialNumber: cert.serialNumber }) })],
    certificates: [cert].concat(chain || [])
  });
  sd.digestAlgorithms.push(new pkijs.AlgorithmIdentifier({ algorithmId: OID.sha256 }));
  const si = sd.signerInfos[0];
  si.digestAlgorithm = new pkijs.AlgorithmIdentifier({ algorithmId: OID.sha256 });
  si.signatureAlgorithm = new pkijs.AlgorithmIdentifier({ algorithmId: OID.rsa });
  si.signedAttrs = new pkijs.SignedAndUnsignedAttributes({ type: 0, attributes: [
    new pkijs.Attribute({ type: OID.contentType, values: [new asn1js.ObjectIdentifier({ value: OID.data })] }),
    new pkijs.Attribute({ type: OID.signingTime, values: [new asn1js.UTCTime({ valueDate: luc })] }),
    new pkijs.Attribute({ type: OID.messageDigest, values: [new asn1js.OctetString({ valueHex: kiem.toAB(Buffer.from(hashNoiDung)) })] })
  ] });
  /* Dữ liệu ký = DER của signedAttrs với tag SET (0x31) thay cho [0] IMPLICIT (0xA0) — đúng cách pkijs làm trong SignedData.sign(). */
  const ab = si.signedAttrs.toSchema(true).toBER(false);
  const dataKy = Buffer.from(ab);
  dataKy[0] = 0x31;
  return { sd, si, dataKy, signingTime: luc };
}
/* hoanTatCms: gắn chữ ký (+ dấu thời gian) → DER ContentInfo. */
async function hoanTatCms({ sd, si }, chuKy, tsaUrl) {
  const { pkijs, asn1js } = kiem.nap();
  si.signature = new asn1js.OctetString({ valueHex: kiem.toAB(Buffer.from(chuKy)) });
  const tsa = await layDauThoiGian(Buffer.from(chuKy), tsaUrl);
  if (tsa.ok) {
    si.unsignedAttrs = new pkijs.SignedAndUnsignedAttributes({ type: 1, attributes: [
      new pkijs.Attribute({ type: OID.tstToken, values: [tsa.token.toSchema()] })
    ] });
  }
  const ci = new pkijs.ContentInfo({ contentType: OID.signedData, content: sd.toSchema(true) });
  return { der: Buffer.from(ci.toSchema().toBER(false)), tsa };
}

// ------------------------------------------------------------------ nguồn chữ ký
/* PFX: node-forge đọc PKCS#12 → khóa PEM + chứng thư (DER) + chuỗi. Ký bằng crypto.sign (RSA PKCS#1 v1.5 SHA-256). */
function boKyPfx(cfg) {
  const forge = require('node-forge');
  if (!cfg.pfxPath || !fs.existsSync(cfg.pfxPath)) throw new Error('Không thấy file PFX: ' + (cfg.pfxPath || '(chưa khai HOPDONG_PFX_PATH)'));
  const p12Der = fs.readFileSync(cfg.pfxPath);
  const p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(p12Der.toString('binary')), false, cfg.pfxPass);
  const oids = forge.pki.oids;
  const keyBags = (p12.getBags({ bagType: oids.pkcs8ShroudedKeyBag })[oids.pkcs8ShroudedKeyBag] || []).concat(p12.getBags({ bagType: oids.keyBag })[oids.keyBag] || []);
  const key = keyBags.length && keyBags[0].key;
  if (!key) throw new Error('PFX không chứa khóa riêng');
  const certs = (p12.getBags({ bagType: oids.certBag })[oids.certBag] || []).map(b => b.cert).filter(Boolean);
  const cuaKhoa = certs.find(c => c.publicKey && c.publicKey.n && c.publicKey.n.toString(16) === key.n.toString(16)) || certs[0];
  if (!cuaKhoa) throw new Error('PFX không chứa chứng thư');
  const der = (c) => Buffer.from(forge.asn1.toDer(forge.pki.certificateToAsn1(c)).getBytes(), 'binary');
  const keyPem = forge.pki.privateKeyToPem(key);
  const cert = certTuDer(der(cuaKhoa));
  const chain = certs.filter(c => c !== cuaKhoa).map(c => { try { return certTuDer(der(c)); } catch (e) { return null; } }).filter(Boolean);
  return {
    loai: 'pfx', cert, chain, thongTin: kiem.thongTinChungThu(cert),
    async ky(dataKy) { return crypto.sign('sha256', dataKy, { key: keyPem }); },
    dong() { }
  };
}

/* PKCS#11: USB token cắm ở máy chủ. Nạp lười (pkcs11js là module native — thiếu thì chỉ cách này không chạy). */
function boKyPkcs11(cfg) {
  const pkcs11js = require('pkcs11js');
  if (!cfg.dll || !fs.existsSync(cfg.dll)) throw new Error('Không thấy thư viện PKCS#11 của token: ' + (cfg.dll || '(chưa khai HOPDONG_PKCS11_DLL)'));
  if (!cfg.pin) throw new Error('Chưa khai HOPDONG_PKCS11_PIN');
  const p = new pkcs11js.PKCS11();
  p.load(cfg.dll);
  try { p.C_Initialize(); } catch (e) { if (!/ALREADY_INITIALIZED/.test(e.message)) throw e; }
  const slots = p.C_GetSlotList(true);
  if (!slots.length) { try { p.C_Finalize(); } catch (e) { /* bỏ */ } throw new Error('Không thấy USB token nào cắm ở máy chủ'); }
  const slot = cfg.slot !== '' && slots[Number(cfg.slot)] ? slots[Number(cfg.slot)] : slots[0];
  const session = p.C_OpenSession(slot, pkcs11js.CKF_SERIAL_SESSION | pkcs11js.CKF_RW_SESSION);
  const tim = (template) => { p.C_FindObjectsInit(session, template); const r = p.C_FindObjects(session, 32); p.C_FindObjectsFinal(session); return r == null ? [] : (Array.isArray(r) ? r : [r]); };
  const attr = (h, types) => { const a = p.C_GetAttributeValue(session, h, types.map(t => ({ type: t }))); return a.map(x => x.value); };
  let daLogin = false;
  const dong = () => { try { if (daLogin) p.C_Logout(session); } catch (e) { /* bỏ */ } try { p.C_CloseSession(session); } catch (e) { /* bỏ */ } try { p.C_Finalize(); } catch (e) { /* bỏ */ } };
  try {
    // Chứng thư đọc được KHÔNG cần PIN ở đa số token; chọn theo serial cấu hình, không thì cái còn hạn xa nhất.
    const certs = tim([{ type: pkcs11js.CKA_CLASS, value: pkcs11js.CKO_CERTIFICATE }, { type: pkcs11js.CKA_CERTIFICATE_TYPE, value: pkcs11js.CKC_X_509 }])
      .map(h => { const [val, id] = attr(h, [pkcs11js.CKA_VALUE, pkcs11js.CKA_ID]); let c = null; try { c = certTuDer(val); } catch (e) { /* bỏ */ } return c && { h, id, cert: c, tt: kiem.thongTinChungThu(c) }; }).filter(Boolean);
    if (!certs.length) throw new Error('Token không có chứng thư X.509 nào');
    let chon = cfg.certSerial ? certs.find(c => c.tt.serial === cfg.certSerial) : null;
    if (!chon) chon = certs.slice().sort((a, b) => (b.tt.denNgay || 0) - (a.tt.denNgay || 0))[0];
    const chain = certs.filter(c => c !== chon).map(c => c.cert);
    return {
      loai: 'pkcs11', cert: chon.cert, chain, thongTin: chon.tt,
      async ky(dataKy) {
        if (!daLogin) {
          /* 🔴 Đăng nhập ĐÚNG MỘT LẦN, không thử lại: PIN sai 3-10 lần là token khóa vĩnh viễn — rủi ro lớn hơn hợp đồng chậm. */
          try { p.C_Login(session, pkcs11js.CKU_USER, cfg.pin); daLogin = true; }
          catch (e) {
            if (/ALREADY_LOGGED_IN/.test(e.message)) daLogin = true;
            else if (/PIN_INCORRECT|PIN_LOCKED|PIN_EXPIRED/.test(e.message)) throw new Error('PIN token SAI hoặc token đã khóa (' + e.message + ') — KHÔNG tự thử lại. Kiểm HOPDONG_PKCS11_PIN rồi ký lại bằng tay.');
            else throw e;
          }
        }
        const keys = tim([{ type: pkcs11js.CKA_CLASS, value: pkcs11js.CKO_PRIVATE_KEY }, { type: pkcs11js.CKA_ID, value: chon.id }]);
        const hKey = keys[0] || tim([{ type: pkcs11js.CKA_CLASS, value: pkcs11js.CKO_PRIVATE_KEY }])[0];
        if (hKey == null) throw new Error('Token không có khóa riêng ứng với chứng thư đã chọn');
        p.C_SignInit(session, { mechanism: pkcs11js.CKM_SHA256_RSA_PKCS }, hKey);
        return p.C_Sign(session, Buffer.from(dataKy), Buffer.alloc(1024));
      },
      dong
    };
  } catch (e) { dong(); throw e; }
}

function boKyTuDong() {
  const cfg = cauHinh();
  if (cfg.loai === 'pfx') return boKyPfx(cfg);
  if (cfg.loai === 'pkcs11') return boKyPkcs11(cfg);
  return null;   // tắt: người có quyền ký bằng công cụ / tải lên
}

// ------------------------------------------------------------------ đặt chỗ giữ + ghép (@signpdf)
async function datChoKy(pdfBuffer, tt) {
  const { PDFDocument } = require('pdf-lib');
  const { pdflibAddPlaceholder } = require('@signpdf/placeholder-pdf-lib');
  const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  pdflibAddPlaceholder({ pdfDoc, reason: (tt && tt.lyDo) || 'Ký hợp đồng', contactInfo: (tt && tt.lienHe) || '', name: (tt && tt.ten) || '',
    location: (tt && tt.viTri) || 'Việt Nam', signatureLength: (tt && tt.doDai) || DO_DAI_CHO_KY, signingTime: (tt && tt.signingTime) || new Date() });
  return Buffer.from(await pdfDoc.save({ useObjectStreams: false }));
}
function layLopKy() {
  const mod = require('@signpdf/signpdf');
  const SignPdf = mod.SignPdf || (mod.default && mod.default.constructor);
  const { Signer } = require('@signpdf/utils');
  return { SignPdf, Signer };
}

/* Ký bằng một bộ ký có sẵn khóa (pfx / pkcs11): trả { pdf, thongTin, tsa, signingTime }. */
async function kyPdf(pdfBuffer, boKy, tt) {
  const cfg = cauHinh();
  const { SignPdf, Signer } = layLopKy();
  const coChoKy = kiem.timChuKy(pdfBuffer).length === 0 && !/\/ByteRange\s*\[/.test(pdfBuffer.toString('latin1'));
  const pdfSan = coChoKy ? await datChoKy(pdfBuffer, Object.assign({ ten: boKy.thongTin && boKy.thongTin.CN }, tt)) : pdfBuffer;
  let tsaKq = { ok: false, loi: 'chưa chạy' }, luc = null;
  class BoKySigner extends Signer {
    async sign(data, signingTime) {
      const cb = chuanBiCms({ cert: boKy.cert, chain: boKy.chain, hashNoiDung: sha256(Buffer.from(data)), signingTime });
      luc = cb.signingTime;
      const chuKy = await boKy.ky(cb.dataKy);
      const kq = await hoanTatCms(cb, chuKy, cfg.tsaUrl);
      tsaKq = kq.tsa;
      return kq.der;
    }
  }
  try {
    const signed = await new SignPdf().sign(pdfSan, new BoKySigner());
    const kiemLai = await kiem.kiemPdf(signed);
    if (!kiemLai.ok) throw new Error('Ký xong nhưng tự kiểm KHÔNG hợp lệ: ' + kiemLai.loi);
    return { pdf: signed, thongTin: boKy.thongTin, tsa: tsaKq, signingTime: luc };
  } finally { try { boKy.dong && boKy.dong(); } catch (e) { /* bỏ */ } }
}

/* Ký tự động theo cấu hình .env; trả null nếu tắt. */
async function kyTuDong(pdfBuffer, tt) {
  const boKy = boKyTuDong();
  if (!boKy) return null;
  return kyPdf(pdfBuffer, boKy, tt);
}

// ------------------------------------------------------------------ ký NGOÀI (công cụ MOYN Ký số / plugin) — 2 bước
/* Phiên ký ngoài sống trong bộ nhớ ≤ 10 phút: batDau() đặt chỗ ký, dựng signedAttrs từ chứng thư của người ký, trả
   dữ liệu cần ký; hoanTat() nhận chữ ký, ghép CMS (+TSA), hoàn tất @signpdf. Cùng MỘT đường ghép với ký tự động. */
const phienNgoai = new Map();
const HAN_PHIEN_MS = 10 * 60 * 1000;
function donPhien() { const now = Date.now(); for (const [k, v] of phienNgoai) if (v.hetHan < now) { try { v.tuChoi(new Error('Hết hạn phiên ký')); } catch (e) { /* bỏ */ } phienNgoai.delete(k); } }

async function batDauKyNgoai(pdfBuffer, certDer, tt) {
  donPhien();
  const cfg = cauHinh();
  const { SignPdf, Signer } = layLopKy();
  const cert = certTuDer(certDer);
  const thongTin = kiem.thongTinChungThu(cert);
  const now = new Date();
  if (thongTin.denNgay && now > thongTin.denNgay) throw new Error('Chứng thư số đã hết hạn (' + thongTin.denNgay.toISOString().slice(0, 10) + ')');
  const pdfSan = await datChoKy(pdfBuffer, Object.assign({ ten: thongTin.CN }, tt));
  const phienKy = crypto.randomBytes(16).toString('hex');
  const ph = { hetHan: Date.now() + HAN_PHIEN_MS, thongTin, cert, tsa: null, signingTime: null };
  let sanSang;
  const choSanSang = new Promise(r => { sanSang = r; });
  class NgoaiSigner extends Signer {
    async sign(data, signingTime) {
      const cb = chuanBiCms({ cert, chain: [], hashNoiDung: sha256(Buffer.from(data)), signingTime });
      ph.signingTime = cb.signingTime;
      const chuKy = await new Promise((resolve, reject) => { ph.nhanChuKy = resolve; ph.tuChoi = reject; sanSang({ dataKy: cb.dataKy }); });
      const kq = await hoanTatCms(cb, chuKy, cfg.tsaUrl);
      ph.tsa = kq.tsa;
      return kq.der;
    }
  }
  ph.ketQua = new SignPdf().sign(pdfSan, new NgoaiSigner());
  ph.ketQua.catch(() => {});   // lỗi được đọc ở hoanTatKyNgoai; không để unhandledRejection
  phienNgoai.set(phienKy, ph);
  const { dataKy } = await choSanSang;
  return { phienKy, dataKy: dataKy.toString('base64'), thuatToan: 'SHA256withRSA', thongTin, hetHanSau: HAN_PHIEN_MS / 1000 };
}
async function hoanTatKyNgoai(phienKy, chuKyBase64) {
  donPhien();
  const ph = phienNgoai.get(String(phienKy || ''));
  if (!ph) throw new Error('Phiên ký không tồn tại hoặc đã hết hạn (10 phút) — bấm ký lại từ đầu.');
  phienNgoai.delete(phienKy);
  const chuKy = Buffer.from(String(chuKyBase64 || ''), 'base64');
  if (chuKy.length < 64) { ph.tuChoi(new Error('Chữ ký trống')); throw new Error('Chữ ký nhận về trống / không hợp lệ.'); }
  ph.nhanChuKy(chuKy);
  const signed = await ph.ketQua;
  const kiemLai = await kiem.kiemPdf(signed);
  if (!kiemLai.ok) throw new Error('Chữ ký từ công cụ KHÔNG hợp lệ với tài liệu: ' + kiemLai.loi + ' (sai chứng thư, hoặc dữ liệu ký bị đổi).');
  return { pdf: signed, thongTin: ph.thongTin, tsa: ph.tsa, signingTime: ph.signingTime };
}
function huyKyNgoai(phienKy) { const ph = phienNgoai.get(String(phienKy || '')); if (ph) { phienNgoai.delete(phienKy); try { ph.tuChoi(new Error('Hủy')); } catch (e) { /* bỏ */ } } }

/* Chỉ ghép dấu thời gian cho bản đã ký thì PDF không cho ghi lại chữ ký cũ — "ghép lại dấu thời gian" = ký lại cả bản. */
module.exports = { cauHinh, TSA_MAC_DINH, DO_DAI_CHO_KY, certTuDer, chuanBiCms, hoanTatCms, layDauThoiGian, boKyPfx, boKyPkcs11, boKyTuDong,
  datChoKy, kyPdf, kyTuDong, batDauKyNgoai, hoanTatKyNgoai, huyKyNgoai, sha256 };
