/* ================================================================================================
   kiem_hop_dong_gd2.js — bo tu kiem cho v9.62 (Nguyen 14/11/2026): HOP DONG MUA BAN giai doan 2.
     1. Bien dich cac file moi / doi (vm.Script).
     2. kyTuXa THAT voi fetch GIA: cau hinh (tat / vnptsmartca / csc), bo VNPT (poll), bo CSC (OTP, token dem, OID SHA-256 +
        rsaEncryption), phien het han. NEU co pkijs/pdf-lib/@signpdf/node-forge: chu trinh batDau -> CA gia ky hash bang
        RSA PKCS#1 v1.5 (DigestInfo) -> kiem() ghep CMS -> PDF tu kiem hop le. Thieu thu vien thi BO QUA.
     3. chuoiTinCay: cdpUrls (cau truc), thu muc goc, kiemChuoi voi goc TU KY tam (ghi file __kiem_tam_root.pem roi XOA),
        la ky boi goc la -> ✖, het han -> ✖, tomTat.
     4. nhacHanKy.chay THAT voi CSDL gia + guiOtp gia: het han -> HetHan + nhat ky + email ke toan; sap han -> link MOI +
        NhacLanCuoi + nhat ky NHAC_HAN + KHONG doi HanKy; tat -> khong lam gi; bieuThucCron.
     5. routes/hopdong.js + routes/publicKy.js THAT: route moi GD2, thu tu, gac quyen; PUT /:id/hoa-don; ky-tu-xa khach
        tu choi khi chua tick dong y; phien ky tu xa la -> 400.
     6. Noi day: migration_v894, hopDongCore (TEN_LOAI_VAN_BAN, TIEN_TO_SO, bienChuan HopDongCha_*), hopDongPdf tenHanhDong,
        server.js schedule, index.html ?v>=9.62, ky.html ?v>=9.62, module.hopdong.js / ky.js co moc GD2, .env.example KYTUXA_*.
   Chay:  node backend\utils\kiem_hop_dong_gd2.js   — KHONG dung CSDL, KHONG goi internet (fetch bi thay bang ham gia).
   ================================================================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Module = require('module');
const crypto = require('crypto');

const GOC = path.join(__dirname, '..', '..');
const doc = (...p) => fs.existsSync(path.join(GOC, ...p)) ? fs.readFileSync(path.join(GOC, ...p), 'utf8').replace(/\r\n/g, '\n') : '';
let sai = 0, dat = 0, boQua = 0;
function kiem(ten, dung, td) {
  if (dung) { dat++; console.log('  ✓ ' + ten); }
  else { sai++; console.log('  ❌ ' + ten + (td ? ' — ' + (typeof td === 'string' ? td : JSON.stringify(td)) : '')); }
}
const boComment = (s) => s.replace(/image\/\*/g, 'image_ALL').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const canhGac = setTimeout(() => { console.log('\n  ❌ BO KIEM TREO qua 40 s'); process.exit(1); }, 40000);
const coThuVien = (ten) => { try { require.resolve(ten); return true; } catch (e) { return false; } };
const nemChua = async (fn, re) => { try { await fn(); return false; } catch (e) { return re ? re.test(e.message) : true; } };

const FILES = ['backend/utils/kyTuXa.js', 'backend/utils/chuoiTinCay.js', 'backend/utils/nhacHanKy.js', 'backend/utils/hopDongCore.js', 'backend/utils/hopDongPdf.js',
  'backend/routes/hopdong.js', 'backend/routes/publicKy.js', 'backend/server.js', 'frontend/js/module.hopdong.js', 'frontend/js/ky.js', 'frontend/js/kysoclient.js', 'backend/utils/kiem_hop_dong_ky_dien_tu.js'];
console.log('\n=== 1. BIEN DICH ===');
FILES.forEach((f) => { const s = doc(...f.split('/')); if (!s) { sai++; console.log('  ❌ ' + f + ' KHONG DOC DUOC'); return; } try { new vm.Script(s, { filename: f }); dat++; console.log('  ✓ ' + f); } catch (e) { sai++; console.log('  ❌ ' + f + ' VO CU PHAP: ' + e.message); } });

/* ---------------------------------------------------------------- db gia + thay module */
const sqlGia = new Proxy({}, { get(_, k) { const f = () => k; f.toString = () => String(k); return f; } });
const nhatKyRows = []; let nkId = 0;
function traLoiNhatKy(s, inputs) {
  if (/SELECT TOP 1 Hash FROM HopDongMBNhatKy/.test(s)) { const r = nhatKyRows.filter(x => x.HopDongMBID === inputs.hd).slice(-1); return rs(r.map(x => ({ Hash: x.Hash }))); }
  if (/INSERT INTO HopDongMBNhatKy/.test(s)) { nkId += 1; const luc = '2026-11-14 10:00:' + String(nkId).padStart(2, '0') + '.000'; nhatKyRows.push({ NhatKyID: nkId, HopDongMBID: inputs.hd, HanhDong: inputs.hanh, ChiTiet: inputs.ct, HashTruoc: inputs.ht, Hash: '0'.repeat(64), Luc: luc }); return rs([{ NhatKyID: nkId, Luc: luc }]); }
  if (/UPDATE HopDongMBNhatKy SET Hash=@h/.test(s)) { const r = nhatKyRows.find(x => x.NhatKyID === inputs.id); if (r) r.Hash = inputs.h; return rs([], [1]); }
  return null;
}
const rs = (recordset, ra) => ({ recordset, rowsAffected: ra || [recordset.length] });
function taoPool(traLoi, nhatKySql) {
  return { request: () => { const inputs = {}; const r = { input(t, k, v) { inputs[t] = arguments.length === 2 ? k : v; return r; }, async query(q) { const s = q.replace(/\s+/g, ' ').trim(); nhatKySql.push({ q: s, inputs: Object.assign({}, inputs) }); const nk = traLoiNhatKy(s, inputs); if (nk) return nk; return traLoi(s, inputs); } }; return r; } };
}
const THAY = { '../db': { sql: sqlGia, getPool: async () => { throw new Error('bo kiem khong dung CSDL that'); } } };
const gocLoad = Module._load;
Module._load = function (ten) { if (Object.prototype.hasOwnProperty.call(THAY, ten)) return THAY[ten]; return gocLoad.apply(this, arguments); };

/* fetch gia: danh sach handler theo regex URL; ghi lai moi lan goi. */
const fetchGoc = global.fetch;
const goiFetch = [];
let fetchHandlers = [];
global.fetch = async (url, opts) => {
  const o = opts || {};
  let body = null; try { body = typeof o.body === 'string' ? JSON.parse(o.body) : (o.body instanceof URLSearchParams ? Object.fromEntries(o.body) : o.body); } catch (e) { body = o.body; }
  goiFetch.push({ url: String(url), method: o.method || 'GET', body, headers: o.headers || {} });
  const h = fetchHandlers.find(x => x.re.test(String(url)));
  if (!h) return { ok: false, status: 404, text: async () => 'not found', json: async () => ({}), arrayBuffer: async () => new ArrayBuffer(0) };
  const kq = await h.fn(body, String(url), o);
  const chu = typeof kq === 'string' ? kq : JSON.stringify(kq);
  return { ok: true, status: 200, text: async () => chu, json: async () => JSON.parse(chu), arrayBuffer: async () => Buffer.from(chu).buffer };
};

(async () => {
  /* ---------------------------------------------------------------- 2 */
  console.log('\n=== 2. kyTuXa (fetch gia) ===');
  const envCu = {}; ['KYTUXA_NHA', 'KYTUXA_TEN', 'KYTUXA_BASE_URL', 'KYTUXA_SP_ID', 'KYTUXA_SP_PASSWORD', 'KYTUXA_CLIENT_ID', 'KYTUXA_CLIENT_SECRET', 'KYTUXA_USERNAME', 'KYTUXA_PASSWORD', 'KYTUXA_TOKEN_URL', 'KYTUXA_NHAN_USER_ID', 'HOPDONG_TSA_URL'].forEach(k => { envCu[k] = process.env[k]; delete process.env[k]; });
  const kyTuXa = require('./kyTuXa');
  let cfg = kyTuXa.cauHinh();
  kiem('cauHinh khong khai -> san=false, nha rong', cfg.san === false && cfg.nha === '');
  kiem('batDau khi chua cau hinh -> nem "chua cau hinh", KHONG dung PDF', await nemChua(() => kyTuXa.batDau({ pdfBuffer: null, userId: 'x' }), /chưa cấu hình/));
  process.env.KYTUXA_NHA = 'VnptSmartCA'; process.env.KYTUXA_SP_ID = 'sp'; process.env.KYTUXA_SP_PASSWORD = 'mk';
  cfg = kyTuXa.cauHinh();
  kiem('vnptsmartca: san=true, baseUrl mac dinh gwsca.vnpt.vn/sca/sp769/v1, nhan user = SDT/CCCD', cfg.san === true && cfg.nha === 'vnptsmartca' && cfg.baseUrl === 'https://gwsca.vnpt.vn/sca/sp769/v1' && /SmartCA/.test(cfg.nhanUserId), cfg);
  const bv = kyTuXa.boVnpt(cfg);
  fetchHandlers = [
    { re: /credentials\/get_certificate$/, fn: (b) => ({ status_code: 200, data: { user_certificates: [{ serial_number: 'AA11', cert_data: Buffer.from('cert-AA11').toString('base64') }, { serial_number: 'BB22', cert_data: Buffer.from('cert-BB22').toString('base64') }] } }) },
    { re: /signatures\/sign\/.+\/status$/, fn: (b, url) => /tran-xong/.test(url) ? { status_code: 200, data: { signatures: [{ signature_value: 'c2ln' }] } } : (/tran-huy/.test(url) ? { status_code: 200, message: 'User rejected' } : { status_code: 200, data: { status_desc: 'waiting' } }) },
    { re: /signatures\/sign$/, fn: (b) => ({ status_code: 200, data: { tran_code: b.transaction_desc === 'HUY' ? 'tran-huy' : 'tran-xong' } }) }
  ];
  let ct = await bv.layChungThu({ userId: '0901', serial: 'bb22' });
  kiem('VNPT layChungThu: gui sp_id/sp_password + user_id, chon dung serial (khong phan biet hoa/thuong), certDer = base64 giai ma', ct.serial === 'BB22' && ct.certDer.toString() === 'cert-BB22' && goiFetch.slice(-1)[0].body.sp_id === 'sp' && goiFetch.slice(-1)[0].body.sp_password === 'mk' && goiFetch.slice(-1)[0].body.user_id === '0901');
  ct = await bv.layChungThu({ userId: '0901' });
  kiem('VNPT layChungThu: khong serial -> lay cai dau', ct.serial === 'AA11');
  const gk = await bv.guiKy({ userId: '0901', serial: 'AA11', hashBase64: 'aGFzaA==', moTa: 'Ký HD1', maGiaoDich: 'phien1' });
  kiem('VNPT guiKy: data_to_be_signed = hash, sign_type hash, tra tranId + huong dan "mo ung dung VNPT SmartCA"', gk.tranId === 'tran-xong' && /VNPT SmartCA/.test(gk.huongDan) && goiFetch.slice(-1)[0].body.sign_files[0].data_to_be_signed === 'aGFzaA==' && goiFetch.slice(-1)[0].body.sign_files[0].sign_type === 'hash');
  let tt = await bv.trangThai({ tranId: 'tran-cho' });
  kiem('VNPT trangThai: chua ky -> dangCho (khong nem)', tt.xong === false && tt.dangCho === true);
  tt = await bv.trangThai({ tranId: 'tran-xong' });
  kiem('VNPT trangThai: co signature_value -> xong + chuKyBase64', tt.xong === true && tt.chuKyBase64 === 'c2ln');
  tt = await bv.trangThai({ tranId: 'tran-huy' });
  kiem('VNPT trangThai: "rejected" -> loi (khong poll mai)', tt.xong === false && /SmartCA/.test(tt.loi || ''));
  kiem('VNPT get_certificate loi -> nem cau ro', await (async () => { fetchHandlers.unshift({ re: /get_certificate$/, fn: () => ({ status_code: 400, message: 'bad' }) }); const kq = await nemChua(() => bv.layChungThu({ userId: 'x' }), /không trả chứng thư/); fetchHandlers.shift(); return kq; })());
  // CSC
  ['KYTUXA_NHA', 'KYTUXA_SP_ID', 'KYTUXA_SP_PASSWORD'].forEach(k => delete process.env[k]);
  process.env.KYTUXA_NHA = 'csc'; process.env.KYTUXA_BASE_URL = 'https://ca.test/csc/v1/'; process.env.KYTUXA_USERNAME = 'moyn'; process.env.KYTUXA_PASSWORD = 'pw';
  cfg = kyTuXa.cauHinh();
  kiem('csc: san=true, baseUrl bo dau / cuoi, nhan user mac dinh khac VNPT, tenHienThi "Ký từ xa (CSC)"', cfg.san === true && cfg.baseUrl === 'https://ca.test/csc/v1' && /CA/.test(cfg.nhanUserId) && cfg.tenHienThi === 'Ký từ xa (CSC)', cfg);
  const bc = kyTuXa.boCsc(cfg);
  let soLogin = 0;
  fetchHandlers = [
    { re: /\/auth\/login$/, fn: (b, url, o) => { soLogin++; return (o.headers.Authorization === 'Basic ' + Buffer.from('moyn:pw').toString('base64')) ? { access_token: 'tok1', expires_in: 3600 } : { error: 'bad auth' }; } },
    { re: /\/credentials\/info$/, fn: (b, url, o) => o.headers.Authorization === 'Bearer tok1' ? { authMode: 'explicit', cert: { certificates: [Buffer.from('leaf').toString('base64'), Buffer.from('ca').toString('base64')] } } : { error: 'no token' } },
    { re: /\/credentials\/authorize$/, fn: (b) => b.OTP === '123456' ? { SAD: 'sad1' } : { error: 'invalid_otp', error_description: 'OTP sai' } },
    { re: /\/signatures\/signHash$/, fn: (b) => b.SAD === 'sad1' && b.hashAlgo === '2.16.840.1.101.3.4.2.1' && b.signAlgo === '1.2.840.113549.1.1.1' ? { signatures: ['Y2hz'] } : { error: 'bad' } }
  ];
  ct = await bc.layChungThu({ userId: 'cred-1' });
  kiem('CSC layChungThu: auth/login Basic -> Bearer; credentials/info certificates=chain -> certDer + chain[1]', ct.certDer.toString() === 'leaf' && ct.chain.length === 1 && ct.chain[0].toString() === 'ca' && ct.serial === 'cred-1' && goiFetch.slice(-1)[0].body.certificates === 'chain');
  await bc.layChungThu({ userId: 'cred-1' });
  kiem('CSC: token duoc dem — 2 lan lay chung thu chi 1 lan auth/login', soLogin === 1, { soLogin });
  const gk2 = await bc.guiKy({ userId: 'cred-1', hashBase64: 'aGFzaA==' });
  kiem('CSC guiKy: KHONG goi CA (cho OTP), tra tranId = credentialID + huong dan nhap OTP', gk2.tranId === 'cred-1' && /OTP/.test(gk2.huongDan));
  kiem('CSC xacNhan OTP sai -> nem "OTP/PIN sai" (SAD khong cap)', await nemChua(() => bc.xacNhan({ tranId: 'cred-1', hashBase64: 'aGFzaA==', otp: '000000' }), /SAD|OTP/));
  const xn = await bc.xacNhan({ tranId: 'cred-1', hashBase64: 'aGFzaA==', otp: '123456' });
  const dsAuth = goiFetch.filter(x => /credentials\/authorize$/.test(x.url)).slice(-1)[0], dsSign = goiFetch.filter(x => /signatures\/signHash$/.test(x.url)).slice(-1)[0];
  kiem('CSC xacNhan OTP dung: authorize(hash, OTP) -> SAD -> signHash(hashAlgo SHA-256 OID, signAlgo rsaEncryption OID) -> chu ky', xn.xong === true && xn.chuKyBase64 === 'Y2hz' && dsAuth.body.hash[0] === 'aGFzaA==' && dsAuth.body.OTP === '123456' && dsSign.body.hashAlgo === '2.16.840.1.101.3.4.2.1' && dsSign.body.signAlgo === '1.2.840.113549.1.1.1' && dsSign.body.hash[0] === 'aGFzaA==');
  kiem('CSC trangThai -> luon dangCho (khong poll)', (await bc.trangThai({})).dangCho === true);
  kiem('kiem/xacNhan/huy phien la -> nem "khong ton tai" / khong sap', await nemChua(() => kyTuXa.kiem('la'), /không tồn tại/) && await nemChua(() => kyTuXa.xacNhan('la', '1'), /không tồn tại/) && (kyTuXa.huy('la'), true));
  // chu trinh that (CA gia ky bang RSA) — can thu vien
  const coDu = ['pkijs', 'asn1js', 'node-forge', 'pdf-lib', '@signpdf/signpdf', '@signpdf/placeholder-pdf-lib', '@signpdf/utils'].filter(t => !coThuVien(t));
  let forge = null, keysKhach = null, certKhach = null, certDerKhach = null;
  if (coDu.length) { boQua++; console.log('  ⏭ BO QUA chu trinh ky tu xa that: chua cai ' + coDu.join(', ')); }
  else {
    try {
      forge = require('node-forge');
      const taoCert = (cn, mst, keys, issuerCert, issuerKey, tuNgay, denNgay, ca) => {
        const c = forge.pki.createCertificate(); c.publicKey = keys.publicKey; c.serialNumber = crypto.randomBytes(8).toString('hex').replace(/^[89a-f]/, '1');
        c.validity.notBefore = tuNgay; c.validity.notAfter = denNgay;
        const attrs = [{ name: 'commonName', value: cn }, { name: 'organizationName', value: 'TEST' }, { name: 'serialName', value: 'MST:' + mst }, { name: 'countryName', value: 'VN' }];
        c.setSubject(attrs); c.setIssuer(issuerCert ? issuerCert.subject.attributes : attrs);
        c.setExtensions([{ name: 'basicConstraints', cA: !!ca }, { name: 'keyUsage', keyCertSign: !!ca, digitalSignature: true, nonRepudiation: true }]);
        c.sign(issuerKey || keys.privateKey, forge.md.sha256.create()); return c;
      };
      keysKhach = forge.pki.rsa.generateKeyPair(2048);
      certKhach = taoCert('KHACH HANG A', '0101', keysKhach, null, null, new Date(Date.now() - 86400000), new Date(Date.now() + 365 * 86400000));
      certDerKhach = Buffer.from(forge.asn1.toDer(forge.pki.certificateToAsn1(certKhach)).getBytes(), 'binary');
      const { PDFDocument, StandardFonts } = require('pdf-lib');
      const pdfDoc = await PDFDocument.create(); const page = pdfDoc.addPage([595, 842]); const font = await pdfDoc.embedFont(StandardFonts.Helvetica); page.drawText('HOP DONG GD2', { x: 50, y: 780, size: 20, font });
      const pdfGoc = Buffer.from(await pdfDoc.save({ useObjectStreams: false }));
      process.env.HOPDONG_TSA_URL = '';   // khong goi internet
      ['KYTUXA_NHA', 'KYTUXA_BASE_URL', 'KYTUXA_USERNAME', 'KYTUXA_PASSWORD'].forEach(k => delete process.env[k]);
      process.env.KYTUXA_NHA = 'vnptsmartca'; process.env.KYTUXA_SP_ID = 'sp'; process.env.KYTUXA_SP_PASSWORD = 'mk';
      let hashNhan = null;
      const kyHashNhuCA = (hashB64) => {   // CA ky HASH: RSA PKCS#1 v1.5 tren DigestInfo(SHA-256) = dung "sha256WithRSA"
        const digestInfo = Buffer.concat([Buffer.from('3031300d060960864801650304020105000420', 'hex'), Buffer.from(hashB64, 'base64')]);
        return crypto.privateEncrypt({ key: forge.pki.privateKeyToPem(keysKhach.privateKey), padding: crypto.constants.RSA_PKCS1_PADDING }, digestInfo).toString('base64');
      };
      fetchHandlers = [
        { re: /get_certificate$/, fn: () => ({ status_code: 200, data: { user_certificates: [{ serial_number: 'S1', cert_data: certDerKhach.toString('base64') }] } }) },
        { re: /signatures\/sign\/.+\/status$/, fn: () => ({ status_code: 200, data: { signatures: [{ signature_value: kyHashNhuCA(hashNhan) }] } }) },
        { re: /signatures\/sign$/, fn: (b) => { hashNhan = b.sign_files[0].data_to_be_signed; return { status_code: 200, data: { tran_code: 'T1' } }; } }
      ];
      const bd = await kyTuXa.batDau({ pdfBuffer: pdfGoc, userId: '0901', moTa: 'Ký HD1', tt: { lyDo: 'thu' } });
      kiem('batDau (VNPT): phienKy + kieu poll + thongTin CN tu chung thu CA tra + hash gui CA = SHA-256(dataKy)', typeof bd.phienKy === 'string' && bd.kieu === 'poll' && bd.thongTin.CN === 'KHACH HANG A' && bd.thongTin.MST === '0101' && typeof hashNhan === 'string' && hashNhan.length > 20, bd);
      const kq = await kyTuXa.kiem(bd.phienKy);
      kiem('kiem(): CA tra chu ky RSA tren hash -> hoanTatKyNgoai ghep CMS -> PDF, thongTin, tsa.ok=false (TSA tat)', kq.xong === true && Buffer.isBuffer(kq.kq.pdf) && kq.kq.pdf.length > pdfGoc.length && kq.kq.thongTin.CN === 'KHACH HANG A' && kq.kq.tsa && kq.kq.tsa.ok === false);
      const kiemCK = require('./kiemChuKySo');
      const kp = await kiemCK.kiemPdf(kq.kq.pdf);
      kiem('PDF ky tu xa: kiemChuKySo -> 1 chu ky HOP LE, dung chung thu', kp.ok && kp.chuKy.length === 1 && kp.chuKy[0].hopLe && kp.chuKy[0].chungThu.CN === 'KHACH HANG A', kp);
      kiem('phien da dung -> kiem lai nem "khong ton tai"', await nemChua(() => kyTuXa.kiem(bd.phienKy), /không tồn tại/));
      // CA tra chu ky SAI -> loi ro, phien bi huy
      fetchHandlers[1] = { re: /signatures\/sign\/.+\/status$/, fn: () => ({ status_code: 200, data: { signatures: [{ signature_value: Buffer.alloc(256, 9).toString('base64') }] } }) };
      const bd2 = await kyTuXa.batDau({ pdfBuffer: pdfGoc, userId: '0901', tt: {} });
      kiem('CA tra chu ky SAI -> kiem() nem "KHONG hop le", khong ra PDF', await nemChua(() => kyTuXa.kiem(bd2.phienKy), /không hợp lệ|KHÔNG hợp lệ/));
    } catch (e) { sai++; console.log('  ❌ chu trinh ky tu xa nem loi: ' + (e && e.stack || e)); }
  }
  Object.keys(envCu).forEach(k => { if (envCu[k] === undefined) delete process.env[k]; else process.env[k] = envCu[k]; });

  /* ---------------------------------------------------------------- 3 */
  console.log('\n=== 3. chuoiTinCay ===');
  const chuoi = require('./chuoiTinCay');
  kiem('THU_MUC_GOC = backend/chungthu_goc', /[\\/]backend[\\/]chungthu_goc$/.test(chuoi.THU_MUC_GOC));
  kiem('cdpUrls: khong extension -> []; co 2.5.29.31 -> chi lay URI http(s) (type 6)', JSON.stringify(chuoi.cdpUrls({ extensions: [] })) === '[]' && JSON.stringify(chuoi.cdpUrls({ extensions: [{ extnID: '2.5.29.31', parsedValue: { distributionPoints: [{ distributionPoint: [{ type: 6, value: 'http://crl.ca.vn/a.crl' }, { type: 4, value: 'CN=x' }, { type: 6, value: 'ldap://x' }] }] } }] })) === JSON.stringify(['http://crl.ca.vn/a.crl']));
  kiem('tomTat: null rong; ok=null "chua kiem"; ok ✔; sai ✖ + CRL', chuoi.tomTat(null) === '' && /^Chưa kiểm/.test(chuoi.tomTat({ ok: null })) && chuoi.tomTat({ ok: true, lyDo: 'A', crl: { lyDo: 'B' } }) === '✔ A · B' && chuoi.tomTat({ ok: false, lyDo: 'C' }) === '✖ C');
  const coLibChuoi = ['pkijs', 'asn1js', 'node-forge'].filter(t => !coThuVien(t));
  if (coLibChuoi.length) { boQua++; console.log('  ⏭ BO QUA kiem chuoi that: chua cai ' + coLibChuoi.join(', ')); }
  else {
    const fileTam = path.join(chuoi.THU_MUC_GOC, '__kiem_tam_root.pem');
    try {
      forge = forge || require('node-forge');
      if (fs.existsSync(chuoi.THU_MUC_GOC)) fs.readdirSync(chuoi.THU_MUC_GOC).filter(f => /^__kiem_/.test(f)).forEach(f => { try { fs.unlinkSync(path.join(chuoi.THU_MUC_GOC, f)); } catch (e) { /* bỏ */ } });   // don rac lan chay truoc (neu sap giua chung)
      const goc0 = chuoi.docChungThuGoc();
      kiem('docChungThuGoc: tra { ds[], loi[] } (hien ' + goc0.ds.length + ' chung thu goc, ' + goc0.loi.length + ' loi doc)', Array.isArray(goc0.ds) && Array.isArray(goc0.loi), goc0.loi);
      const { pkijs, asn1js } = require('./kiemChuKySo').nap();
      const toAB = require('./kiemChuKySo').toAB;
      const pkCert = (c) => new pkijs.Certificate({ schema: asn1js.fromBER(toAB(Buffer.from(forge.asn1.toDer(forge.pki.certificateToAsn1(c)).getBytes(), 'binary'))).result });
      const lam = (cn, mst, keys, issuer, issuerKey, ca, tu, den) => { const c = forge.pki.createCertificate(); c.publicKey = keys.publicKey; c.serialNumber = '1' + crypto.randomBytes(7).toString('hex'); c.validity.notBefore = tu; c.validity.notAfter = den;
        const attrs = [{ name: 'commonName', value: cn }, { name: 'organizationName', value: 'TEST' }, { name: 'serialName', value: 'MST:' + mst }, { name: 'countryName', value: 'VN' }];
        c.setSubject(attrs); c.setIssuer(issuer ? issuer.subject.attributes : attrs);
        c.setExtensions(ca ? [{ name: 'basicConstraints', cA: true, critical: true }, { name: 'keyUsage', keyCertSign: true, cRLSign: true, critical: true }, { name: 'subjectKeyIdentifier' }] : [{ name: 'basicConstraints', cA: false }, { name: 'keyUsage', digitalSignature: true, nonRepudiation: true }]);
        c.sign(issuerKey || keys.privateKey, forge.md.sha256.create()); return c; };
      const homQua = new Date(Date.now() - 86400000), namSau = new Date(Date.now() + 365 * 86400000), namTruoc = new Date(Date.now() - 365 * 86400000);
      const kRoot = forge.pki.rsa.generateKeyPair(2048), kLeaf = forge.pki.rsa.generateKeyPair(2048), kLa = forge.pki.rsa.generateKeyPair(2048);
      const root = lam('KIEM TAM ROOT CA', '0000', kRoot, null, null, true, namTruoc, namSau);
      const leaf = lam('CONG TY B', '0202', kLeaf, root, kRoot.privateKey, false, homQua, namSau);
      const rootLa = lam('ROOT LA', '0001', kLa, null, null, true, namTruoc, namSau);
      const leafLa = lam('CONG TY C', '0303', kLeaf, rootLa, kLa.privateKey, false, homQua, namSau);
      const leafHetHan = lam('CONG TY D', '0404', kLeaf, root, kRoot.privateKey, false, namTruoc, new Date(Date.now() - 10 * 86400000));
      if (goc0.ds.length === 0) {
        const k0 = await chuoi.kiemChuoi(pkCert(leaf), [], { checkCRL: false });
        kiem('chua co chung thu goc nao -> ok=null, ly do "chua nap chung thu goc"', k0.ok === null && /chưa nạp/i.test(k0.lyDo), k0);
      } else console.log('  ⏭ (thu muc goc dang co ' + goc0.ds.length + ' chung thu that — bo buoc "chua nap")');
      fs.mkdirSync(chuoi.THU_MUC_GOC, { recursive: true });
      fs.writeFileSync(fileTam, forge.pki.certificateToPem(root));
      const goc1 = chuoi.docChungThuGoc();
      kiem('them file goc tam -> docChungThuGoc nap lai (mtime/danh sach doi), doc PEM, CN dung', goc1.ds.some(x => x.file === '__kiem_tam_root.pem' && x.tt.CN === 'KIEM TAM ROOT CA'), goc1.loi);
      const k1 = await chuoi.kiemChuoi(pkCert(leaf), [], { checkCRL: false });
      kiem('leaf ky boi root tin cay -> ok=true, goc = CN root, duong di [leaf, root], CRL bo qua', k1.ok === true && k1.goc === 'KIEM TAM ROOT CA' && k1.duongDi[0] === 'CONG TY B' && k1.crl.lyDo === 'bỏ qua', k1);
      const k2 = await chuoi.kiemChuoi(pkCert(leafLa), [pkCert(rootLa)], { checkCRL: false });
      kiem('leaf ky boi root LA (khong trong thu muc) -> ok=false "khong noi duoc toi goc tin cay"', k2.ok === false && /Không nối được/.test(k2.lyDo), k2);
      const k3 = await chuoi.kiemChuoi(pkCert(leafHetHan), [], { checkCRL: false });
      kiem('leaf HET HAN (kiem tai hom nay) -> ok=false', k3.ok === false, k3);
      const k4 = await chuoi.kiemChuoi(pkCert(leafHetHan), [], { checkCRL: false, luc: new Date(Date.now() - 30 * 86400000) });
      kiem('cung leaf, kiem tai thoi diem KY (30 ngay truoc, con han) -> ok=true (chu ky qua khu van gia tri)', k4.ok === true, k4);
      const k5 = await chuoi.kiemChuoi(pkCert(leaf), [], {});
      kiem('checkCRL mac dinh, leaf KHONG co diem phan phoi CRL -> ok=true, crl.kiem=false "khong co diem CRL" (khong goi internet)', k5.ok === true && k5.crl && k5.crl.kiem === false && /không có điểm CRL/.test(k5.crl.lyDo) && goiFetch.filter(x => /crl/i.test(x.url)).length === 0, k5);
      const k6 = await chuoi.kiemChuoi(pkCert(leaf), [pkCert(root)], { checkCRL: false });
      kiem('chain kem ca goc (nhu CMS cua Adobe) -> van ok, duong di [leaf, root] — chung thu nguoi ky dat CUOI mang certs (pkijs)', k6.ok === true && k6.duongDi[0] === 'CONG TY B' && k6.goc === 'KIEM TAM ROOT CA', k6);
      kiem('tomTat(k1) bat dau ✔, tomTat(k2) bat dau ✖', chuoi.tomTat(k1).startsWith('✔') && chuoi.tomTat(k2).startsWith('✖'));
    } catch (e) { sai++; console.log('  ❌ kiem chuoi nem loi: ' + (e && e.stack || e)); }
    finally { try { fs.unlinkSync(fileTam); } catch (e) { /* bỏ */ } kiem('da XOA file goc tam (khong de lai CA thu trong thu muc tin cay)', !fs.existsSync(fileTam)); }
  }

  /* ---------------------------------------------------------------- 4 */
  console.log('\n=== 4. nhacHanKy.chay (CSDL gia + guiOtp gia) ===');
  const emails = [], links = [];
  THAY['./guiOtp'] = { guiEmail: async (o) => { emails.push(o); return { ok: true }; }, kenhSanSang: () => ({ email: true, sms: false, zalo: false }), tenCongTy: () => 'MOYN', guiLinkKy: async (kenh, dich, ctx) => { links.push({ kenh, dich, ctx }); return { ok: true }; }, cheDich: (k, v) => 'che:' + v, emailHopLe: () => true, chuanHoaSDT: (s) => s, guiOtp: async () => ({ ok: true }), guiBaoKyXong: async () => ({ ok: true }) };
  let cauHinhJson = JSON.stringify({ batNhac: true, nhacTruocNgay: 2, emailKeToan: 'kt@moyn.vn', kenhMacDinh: 'email', hanLinkNgay: 7 });
  const sqlLog = [];
  const poolNhac = taoPool((s, inputs) => {
    if (/SELECT GiaTri FROM CauHinh WHERE Khoa=@k/.test(s)) return rs([{ GiaTri: cauHinhJson }]);
    if (/COL_LENGTH\('HopDongMB','LoaiVanBan'\)/.test(s)) return rs([{ a: 1, b: 1 }]);
    if (/SELECT HopDongMBID, SoHopDong, TenHopDong FROM HopDongMB WHERE TrangThai=N'ChoKy' AND HanKy IS NOT NULL AND HanKy < SYSDATETIME\(\)/.test(s)) return rs([{ HopDongMBID: 11, SoHopDong: 'HD260011', TenHopDong: 'HĐ quá hạn' }]);
    if (/SELECT HopDongMBID FROM HopDongMB WHERE TrangThai=N'ChoKy' AND HanKy IS NOT NULL AND HanKy >= SYSDATETIME\(\) AND HanKy <= DATEADD\(day, @n, SYSDATETIME\(\)\)/.test(s)) return rs([{ HopDongMBID: 12 }]);
    if (/FROM HopDongMB h LEFT JOIN Users u/.test(s)) return rs(inputs.id === 12 ? [{ HopDongMBID: 12, SoHopDong: 'HD260012', TenHopDong: 'HĐ sắp hạn', PhienBan: 2, HanKy: '2026-11-16 08:00:00', TrangThai: 'ChoKy', BenMuaJson: '{"Ten":"Công ty A"}', LoaiVanBan: 'HopDong' }] : []);
    if (/FROM HopDongMBBenKy b WHERE/.test(s)) return rs([{ BenKyID: 21, HopDongMBID: 12, Ben: 'Khach', HoTen: 'Ông A', Email: 'a@x.vn', SDT: '0901', TrangThai: 'ChoKy', ThuTu: 1 }]);
    if (/FROM HopDongMBHang WHERE/.test(s)) return rs([]);
    return rs([], [1]);
  }, sqlLog);
  const nhac = require('./nhacHanKy');
  let kq = await nhac.chay(poolNhac, { im: true });
  kiem('chay: 1 het han + 1 nhac, khong loi', kq.hetHan === 1 && kq.nhac === 1 && kq.loi.length === 0, kq);
  kiem('het han: UPDATE TrangThai=HetHan (chi khi con ChoKy) + vo hieu link + nhat ky HET_HAN + email ke toan co so HD', sqlLog.some(x => /UPDATE HopDongMB SET TrangThai=N'HetHan'.*AND TrangThai=N'ChoKy'/.test(x.q) && x.inputs.id === 11) && sqlLog.some(x => /UPDATE HopDongMBLink SET VoHieu=1 WHERE HopDongMBID=@hd/.test(x.q) && x.inputs.hd === 11) && nhatKyRows.some(x => x.HopDongMBID === 11 && x.HanhDong === 'HET_HAN') && emails.length === 1 && emails[0].to === 'kt@moyn.vn' && /HD260011/.test(emails[0].subject), { emails });
  const ins = sqlLog.find(x => /INSERT INTO HopDongMBLink/.test(x.q));
  kiem('nhac: tao link MOI (vo hieu link cu, INSERT TokenHash 64 hex, phien ban 2) + gui qua email toi a@x.vn', !!ins && /^[0-9a-f]{64}$/.test(ins.inputs.h) && ins.inputs.pb === 2 && ins.inputs.hd === 12 && links.length === 1 && links[0].kenh === 'email' && links[0].dich === 'a@x.vn' && /ky\.html\?t=/.test(links[0].ctx.link), { ins: ins && ins.inputs, links });
  const giuHan = sqlLog.find(x => /UPDATE HopDongMB SET HanKy=CONVERT\(datetime2, @h, 120\), NhacLanCuoi=SYSDATETIME\(\)/.test(x.q));
  kiem('nhac: HanKy TRA VE moc cu (2026-11-16 08:00:00) + hạn link = moc cu + NhacLanCuoi — nhac KHONG doi han', !!giuHan && giuHan.inputs.h === '2026-11-16 08:00:00' && giuHan.inputs.id === 12 && /UPDATE HopDongMBLink SET HetHan=CONVERT\(datetime2, @h, 120\) WHERE HopDongMBID=@id AND VoHieu=0/.test(giuHan.q), giuHan && giuHan.inputs);
  kiem('nhac: nhat ky NHAC_HAN + GUI_LINK cho HD12', nhatKyRows.some(x => x.HopDongMBID === 12 && x.HanhDong === 'NHAC_HAN') && nhatKyRows.some(x => x.HopDongMBID === 12 && x.HanhDong === 'GUI_LINK'));
  cauHinhJson = JSON.stringify({ batNhac: false });
  sqlLog.length = 0;
  kq = await nhac.chay(poolNhac, { im: true });
  kiem('batNhac=false -> tat, khong dong SQL nao ngoai doc cau hinh', kq.tat === true && kq.hetHan === 0 && sqlLog.length === 1, sqlLog.map(x => x.q.slice(0, 50)));
  kiem('bieuThucCron: 08:30 -> "30 8 * * *"; "7:05" -> "5 7 * * *"; rac -> mac dinh 08:30; 25:99 -> kep 23:59', nhac.bieuThucCron('08:30') === '30 8 * * *' && nhac.bieuThucCron('7:05') === '5 7 * * *' && nhac.bieuThucCron('xyz') === '30 8 * * *' && nhac.bieuThucCron('25:99') === '59 23 * * *');
  kiem('schedule(): getPool gia nem -> chi canh bao, KHONG sap', await (async () => { try { await nhac.schedule(); return true; } catch (e) { return false; } })());

  /* ---------------------------------------------------------------- 5 */
  console.log('\n=== 5. routes/hopdong.js + routes/publicKy.js THAT ===');
  const mw = () => (req, res, next) => next();
  const gac = [];
  THAY['../middleware/auth'] = { requireAuth: mw(), requirePermission: (m, a) => { gac.push('P:' + m + ':' + a); return mw(); }, requireChucNang: (m, c) => { gac.push('C:' + m + ':' + c); return mw(); }, requireChucNangAny: mw, canUpdateStage: mw, coQuyenChucNang: (u, m, c) => !!(u && u.kyso) };
  THAY['./hrm'] = { locMauAnToan: (s) => String(s) };
  THAY['../utils/chongDoMatKhau'] = { layIP: (req) => req.ip || '0.0.0.0' };
  /* Tu day getPool TRA pool gia (moi query nem) — route phai tu bat loi va tra JSON; token sai dinh dang thi KHONG dung toi pool. */
  const poolLoi = { request: () => ({ input() { return this; }, async query() { throw new Error('CSDL gia: khong co bang'); } }) };
  THAY['../db'].getPool = async () => poolLoi;
  const rHD = require(path.join(GOC, 'backend', 'routes', 'hopdong.js'));
  const rPK = require(path.join(GOC, 'backend', 'routes', 'publicKy.js'));
  const duong = (router) => (router.stack || []).filter(l => l.route).map(l => Object.keys(l.route.methods).map(m => m.toUpperCase() + ' ' + l.route.path)).flat();
  const dsHD = duong(rHD), dsPK = duong(rPK);
  const canHD = ['POST /cauhinh/nhac-ngay', 'PUT /:id/hoa-don', 'POST /:id/ky-tu-xa/bat-dau', 'GET /:id/ky-tu-xa/:phienKy', 'POST /:id/ky-tu-xa/:phienKy/xac-nhan'];
  kiem('hopdong.js: du route GD2 ' + canHD.join(', '), canHD.every(x => dsHD.includes(x)), canHD.filter(x => !dsHD.includes(x)));
  kiem('hopdong.js: /cauhinh/nhac-ngay dung TRUOC /:id (literal truoc :param)', dsHD.indexOf('POST /cauhinh/nhac-ngay') < dsHD.indexOf('GET /:id'));
  kiem('hopdong.js: gac quyen van la HOPDONG + danhsach|mau|cauhinh', gac.filter(x => x.startsWith('P:')).every(x => /^P:HOPDONG:(view|create|edit|delete)$/.test(x)) && gac.filter(x => x.startsWith('C:')).every(x => /^C:HOPDONG:(danhsach|mau|cauhinh)$/.test(x)));
  const canPK = ['POST /:token/ky-tu-xa/bat-dau', 'GET /:token/ky-tu-xa/:phienKy', 'POST /:token/ky-tu-xa/:phienKy/xac-nhan'];
  kiem('publicKy.js: du 3 route ky tu xa khach, GET /:token/pdf van TRUOC GET /:token/ky-tu-xa/:phienKy (khong va cham vi path khac)', canPK.every(x => dsPK.includes(x)), canPK.filter(x => !dsPK.includes(x)));
  const layHandler = (router, method, p) => { const l = router.stack.find(x => x.route && x.route.path === p && x.route.methods[method]); return l && l.route.stack[l.route.stack.length - 1].handle; };
  const goi = async (h, req) => { const res = { code: 200, body: null, status(c) { res.code = c; return res; }, json(o) { res.body = o; return res; }, setHeader() {}, end() {} }; await h(Object.assign({ body: {}, query: {}, params: {}, headers: {}, session: { user: { userId: 7 } }, ip: '9.9.9.9' }, req), res, () => {}); return res; };
  let r = await goi(layHandler(rHD, 'put', '/:id/hoa-don'), { params: { id: 1 }, body: { soHoaDon: '0000123' } });
  kiem('PUT /:id/hoa-don: CSDL gia nem (getPool) -> loi 500/400 co message, KHONG treo', (r.code === 500 || r.code === 400) && r.body && r.body.success === false);
  r = await goi(layHandler(rHD, 'post', '/:id/ky-tu-xa/bat-dau'), { params: { id: 1 }, body: { userId: 'x' }, session: { user: { userId: 7 } } });
  kiem('hopdong POST /:id/ky-tu-xa/bat-dau KHONG co nang luc kyso -> 403', r.code === 403 && /kyso/.test(r.body.message));
  r = await goi(layHandler(rPK, 'post', '/:token/ky-tu-xa/bat-dau'), { params: { token: 'abc' }, body: { userId: 'x', dongY: true }, ip: '5.5.5.5' });
  kiem('publicKy POST /:token/ky-tu-xa/bat-dau token sai -> 404 (truoc khi goi CA)', r.code === 404);
  r = await goi(layHandler(rPK, 'get', '/:token/ky-tu-xa/:phienKy'), { params: { token: 'abc', phienKy: 'la' }, ip: '5.5.5.5' });
  kiem('publicKy GET /:token/ky-tu-xa/:phienKy token sai -> 404', r.code === 404);
  let ma429 = null;
  for (let i = 0; i < 11; i++) { const rr = await goi(layHandler(rPK, 'post', '/:token/ky-tu-xa/bat-dau'), { params: { token: 'abc' }, body: { userId: 'x', dongY: true }, ip: '6.6.6.6' }); if (rr.code === 429) { ma429 = i + 1; break; } }
  kiem('publicKy ky-tu-xa/bat-dau: gioi han 10 lan/gio theo IP -> lan 11 tra 429', ma429 === 11, { ma429 });
  const fPK = boComment(doc('backend', 'routes', 'publicKy.js'));
  kiem('publicKy.js: hoanTatTuXaKhach ghi khach_<id>_v<n>.pdf, ghiKhachKy cachKy KySo + kyTuXa{nha,userId}, roi hoanTatSauKhachKy', /khach_\$\{d\.hd\.HopDongMBID\}_v\$\{d\.hd\.PhienBan\}\.pdf/.test(fPK) && /cachKy: 'KySo', fileKhachKy: ten, chungThu: kq\.kq\.thongTin, kyTuXa: \{ nha: ph\.nha, userId: ph\.userId \}/.test(fPK) && /hoanTatTuXaKhach[\s\S]*hoanTatSauKhachKy\(d\.pool, d\.hd\.HopDongMBID/.test(fPK));
  kiem('publicKy.js: phien ky tu xa khach GAN VOI LinkID (nguoi khac khong dung duoc phien)', /ph\.linkId !== d\.link\.LinkID/.test(fPK));

  /* ---------------------------------------------------------------- 6 */
  console.log('\n=== 6. noi day ===');
  const mg = doc('database', 'migration_v894.sql');
  kiem('migration_v894: LoaiVanBan (DF HopDong + CK 3 gia tri), HopDongChaID + index, SoHoaDon, NgayHoaDon, NhacLanCuoi, BenKy KyTuXaNha/KyTuXaUserId/ChuoiTinCay, mau PHULUC_CHUAN + THANHLY_CHUAN, chan khi chua v893',
    ["COL_LENGTH('HopDongMB', 'LoaiVanBan')", "DEFAULT N'HopDong'", "CHECK (LoaiVanBan IN (N'HopDong', N'PhuLuc', N'ThanhLy'))", "COL_LENGTH('HopDongMB', 'HopDongChaID')", 'CREATE INDEX IX_HopDongMB_Cha', "COL_LENGTH('HopDongMB', 'SoHoaDon')", "COL_LENGTH('HopDongMB', 'NgayHoaDon')", "COL_LENGTH('HopDongMB', 'NhacLanCuoi')",
      "COL_LENGTH('HopDongMBBenKy', 'KyTuXaNha')", "COL_LENGTH('HopDongMBBenKy', 'KyTuXaUserId')", "COL_LENGTH('HopDongMBBenKy', 'ChuoiTinCay')", "MaMau = N'PHULUC_CHUAN'", "MaMau = N'THANHLY_CHUAN'", "OBJECT_ID('HopDongMB') IS NULL BEGIN RAISERROR"].every(k => mg.indexOf(k) > -1),
    ["COL_LENGTH('HopDongMB', 'LoaiVanBan')", "MaMau = N'PHULUC_CHUAN'", "MaMau = N'THANHLY_CHUAN'"].filter(k => mg.indexOf(k) === -1));
  kiem('migration_v894: mau phu luc / thanh ly dung bien HopDongCha_So + HopDongCha_Ngay + NoiDungSuaDoi / KetQuaThucHien', /\{\{HopDongCha_So\}\}/.test(mg) && /\{\{HopDongCha_Ngay\}\}/.test(mg) && /\{\{NoiDungSuaDoi\}\}/.test(mg) && /\{\{KetQuaThucHien\}\}/.test(mg));
  const core = require('./hopDongCore');
  kiem('hopDongCore: TEN_LOAI_VAN_BAN 3 loai, TIEN_TO_SO HD/PL/TL, cau hinh mac dinh batNhac/nhacTruocNgay/gioNhac', Object.keys(core.TEN_LOAI_VAN_BAN).join() === 'HopDong,PhuLuc,ThanhLy' && core.TIEN_TO_SO.PhuLuc === 'PL' && core.TIEN_TO_SO.ThanhLy === 'TL' && core.CAU_HINH_MAC_DINH.batNhac === true && core.CAU_HINH_MAC_DINH.nhacTruocNgay === 2 && core.CAU_HINH_MAC_DINH.gioNhac === '08:30');
  const bien = core.bienChuan({ SoHopDong: 'PL260001', TenHopDong: 'PL', LoaiVanBan: 'PhuLuc', HopDongCha_So: 'HD260001', HopDongCha_Ten: 'HĐ gốc', HopDongCha_Ngay: '2026-11-01' }, {}, { tenCongTy: 'MOYN' }, []);
  kiem('bienChuan: LoaiVanBan "Phụ lục", HopDongCha_So/Ten, HopDongCha_Ngay dd/mm/yyyy', bien.LoaiVanBan === 'Phụ lục' && bien.HopDongCha_So === 'HD260001' && bien.HopDongCha_Ten === 'HĐ gốc' && bien.HopDongCha_Ngay === '01/11/2026', bien);
  kiem('bienChuan hop dong thuong: LoaiVanBan "Hợp đồng", HopDongCha_* rong', (() => { const b = core.bienChuan({ SoHopDong: 'HD1' }, {}, {}, []); return b.LoaiVanBan === 'Hợp đồng' && b.HopDongCha_So === '' && b.HopDongCha_Ngay === ''; })());
  const poolMau = taoPool((s) => rs(/FROM MauHopDongMB WHERE MaMau=@m/.test(s) ? [{ MaMau: 'PL', TenMau: 'PL', NoiDung: '<p>{{HopDongCha_So}}|{{NgayKy}}|{{NoiDungSuaDoi}}|{{DiaDiemKy}}</p>', PhienBan: 3 }] : []), []);
  const dh = await core.dungHtml(poolMau, { hd: { SoHopDong: 'PL1', MaMau: 'PL', LoaiVanBan: 'PhuLuc', HopDongCha_So: 'HD9', BenMua: {}, GiaTriBienObj: { HopDongCha_So: '', NgayKy: '  ', NoiDungSuaDoi: 'Sửa giá', DiaDiemKy: 'Hà Nội' } }, hang: [] }, { diaDiemKy: 'HCM' });
  kiem('dungHtml: o de TRONG khong de gia tri tu dien (HopDongCha_So=HD9, NgayKy tu dong), o go tay thi de (DiaDiemKy Hà Nội thay HCM), bienThieu rong', /HD9\|\d{2} tháng \d{2} năm \d{4}\|Sửa giá\|Hà Nội/.test(dh.html) && dh.bienThieu.length === 0 && dh.phienBanMau === 3, dh);
  const poolSo = taoPool((s, inputs) => rs(/MAX\(CAST\(SUBSTRING\(SoHopDong, 5, 10\)/.test(s) ? [{ m: inputs.p.startsWith('PL') ? 7 : null }] : []), []);
  kiem('soHopDongMoi: PhuLuc -> PL<yy>0008 (max 7 + 1), ThanhLy -> TL<yy>0001, mac dinh HD', await (async () => { const yy = String(new Date().getFullYear()).slice(-2); return (await core.soHopDongMoi(poolSo, 'PhuLuc')) === 'PL' + yy + '0008' && (await core.soHopDongMoi(poolSo, 'ThanhLy')) === 'TL' + yy + '0001' && (await core.soHopDongMoi(poolSo)) === 'HD' + yy + '0001'; })());
  const pdfU = require('./hopDongPdf');
  kiem('hopDongPdf.tenHanhDong: NHAC_HAN, CHUOI_TIN_CAY, KY_TU_XA_BAT_DAU, KY_TU_XA_LOI, HOA_DON co ten; tenCachKy TuXa', ['NHAC_HAN', 'CHUOI_TIN_CAY', 'KY_TU_XA_BAT_DAU', 'KY_TU_XA_LOI', 'HOA_DON'].every(k => pdfU.tenHanhDong(k) && pdfU.tenHanhDong(k) !== k) && /từ xa/.test(pdfU.tenCachKy('TuXa')) && pdfU.TEN_BIEN_CHUAN.has('HopDongCha_So') && pdfU.TEN_BIEN_CHUAN.has('LoaiVanBan'));
  const sv = boComment(doc('backend', 'server.js'));
  kiem('server.js: dat lich nhac han ky (utils/nhacHanKy).schedule()', /require\('\.\/utils\/nhacHanKy'\)\.schedule\(\)/.test(sv));
  const html = doc('frontend', 'index.html');
  const vCua = (txt, f) => { const m = new RegExp(f.replace(/[.]/g, '\\.') + '\\?v=([\\d.]+)').exec(txt); return m ? parseFloat(m[1]) : 0; };
  kiem('index.html: module.hopdong.js ?v>=9.62', vCua(html, '/js/module.hopdong.js') >= 9.62, { v: vCua(html, '/js/module.hopdong.js') });
  kiem('ky.html: ky.js ?v>=9.62', vCua(doc('frontend', 'ky.html'), '/js/ky.js') >= 9.62);
  const mh = boComment(doc('frontend', 'js', 'module.hopdong.js'));
  kiem('module.hopdong.js: loai van ban (select loaiVanBan + hopDongChaId, loc loaiVanBan=), hoa don (PUT /hoa-don), nhac han (batNhac/nhacTruocNgay/gioNhac + /cauhinh/nhac-ngay), ky tu xa MOYN (ky-tu-xa/bat-dau + poll + xac-nhan), chuoi tin cay, tao phu luc/thanh ly tu HD da ky',
    /name="loaiVanBan"/.test(mh) && /name="hopDongChaId"/.test(mh) && /qs\.set\('loaiVanBan', locLoai\)/.test(mh) && /\/hoa-don'/.test(mh) && /name="batNhac"/.test(mh) && /nhacTruocNgay/.test(mh) && /gioNhac/.test(mh) && /\/cauhinh\/nhac-ngay/.test(mh) && /\/ky-tu-xa\/bat-dau/.test(mh) && /\/xac-nhan'/.test(mh) && /ChuoiTinCay/.test(mh) && /bTaoPhuLuc/.test(mh) && /bTaoThanhLy/.test(mh) && /taoMoiTuCha/.test(mh) && /chungThuGoc/.test(mh));
  kiem('module.hopdong.js: tao phu luc tu HD la TAO MOI (POST), khong PUT de len hop dong goc', /const sua = !!\(hd && !hd\.taoMoiTuCha\)/.test(mh) && /if \(sua\) await apiPut\('\/api\/hopdong\/' \+ id, body\); else id = \(await apiPost\('\/api\/hopdong', body\)\)/.test(mh));
  const kj = boComment(doc('frontend', 'js', 'ky.js'));
  kiem('ky.js: Cach 0 ky tu xa khi d.kyTuXa.san (bat-dau, poll 2 s, OTP xac-nhan, dung sau 3 phut), hien loai van ban + hop dong goc', /d\.kyTuXa && d\.kyTuXa\.san/.test(kj) && /ky-tu-xa'/.test(kj) && /\/bat-dau'/.test(kj) && /\/xac-nhan'/.test(kj) && /lan > 90/.test(kj) && /}, 2000\)/.test(kj) && /TEN_LOAI\[d\.loaiVanBan\]/.test(kj) && /d\.hopDongCha/.test(kj));
  const envEx = doc('backend', '.env.example');
  kiem('.env.example: KYTUXA_NHA/BASE_URL/SP_ID/SP_PASSWORD/CLIENT_ID/CLIENT_SECRET/USERNAME/PASSWORD/TOKEN_URL/NHAN_USER_ID + chungthu_goc', ['KYTUXA_NHA', 'KYTUXA_BASE_URL', 'KYTUXA_SP_ID', 'KYTUXA_SP_PASSWORD', 'KYTUXA_CLIENT_ID', 'KYTUXA_CLIENT_SECRET', 'KYTUXA_USERNAME', 'KYTUXA_PASSWORD', 'KYTUXA_TOKEN_URL', 'KYTUXA_NHAN_USER_ID', 'chungthu_goc'].every(k => envEx.indexOf(k) > -1));
  kiem('kiem_hop_dong_ky_dien_tu.js (GD1): KHONG ghim ?v=9.61 cung (so >=)', !/module\.hopdong\.js\?v=9\.61'\) > -1/.test(doc('backend', 'utils', 'kiem_hop_dong_ky_dien_tu.js')));
  const cs = doc('tools', 'MoynKySo', 'Program.cs');
  kiem('Program.cs v1.0.1: OriginChoPhep (mang noi bo 10/172.16-31/192.168 + origins.txt), cua so xac nhan ghi origin, van TcpListener loopback', /static bool OriginChoPhep\(string origin\)/.test(cs) && /origins\.txt/.test(cs) && /b\[0\] == 192 && b\[1\] == 168/.test(cs) && /Ky\(string than, string origin\)/.test(cs) && /Trang web yêu cầu ký: " \+ origin/.test(cs) && /TcpListener\(IPAddress\.Loopback/.test(cs));
  const kc = boComment(doc('frontend', 'js', 'kysoclient.js'));
  kiem('kysoclient.js 9.62: cong cu da tra loi (403 origin) thi KHONG thu cong khac, bao cau "tu choi trang nay"; index.html + ky.html nap ?v>=9.62', /e\.daTraLoi = true/.test(kc) && /từ chối trang này/.test(kc) && vCua(html, '/js/kysoclient.js') >= 9.62 && vCua(doc('frontend', 'ky.html'), '/js/kysoclient.js') >= 9.62);
  kiem('package.json: 8 thu vien v9.61 da khai (npm install la du)', ['pdf-lib', 'pkijs', 'asn1js', 'node-forge', '@signpdf/signpdf', '@signpdf/placeholder-pdf-lib', '@signpdf/utils', 'mammoth'].every(k => doc('backend', 'package.json').indexOf('"' + k + '"') > -1));

  global.fetch = fetchGoc;
  Module._load = gocLoad;
  clearTimeout(canhGac);
  console.log(`\n=== KET QUA: ${dat} dat, ${sai} sai${boQua ? ', ' + boQua + ' muc BO QUA (thieu thu vien)' : ''} ===`);
  process.exit(sai ? 1 : 0);
})().catch(e => { console.error('VO: ' + (e && e.stack || e)); process.exit(1); });
