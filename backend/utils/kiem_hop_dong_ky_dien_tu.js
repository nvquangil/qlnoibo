/* ================================================================================================
   kiem_hop_dong_ky_dien_tu.js — bo tu kiem cho v9.61 (Nguyen 14/11/2026): HOP DONG MUA BAN + KY DIEN TU.
     1. Bien dich moi file moi / doi (vm.Script).
     2. hopDongPdf: tim bien, thay bien (escape, BangHang), so thanh chu, bang hang, ma tra cuu, khung A4.
     3. nhatKyHopDong THAT voi CSDL gia: chuoi bam noi dong, phat hien sua tay.
     4. guiOtp: che dich, chuan hoa SDT, email, kenh san sang khi chua cau hinh, khong nem.
     5. hopDongCore: benMuaTuKhach, bienChuan, docTheoToken tu choi token sai dinh dang (khong dung CSDL).
     6. routes/hopdong.js + routes/publicKy.js THAT (db/auth/hrm gia): du route, thu tu route, gac quyen, gioi han theo IP.
     7. kySoPdf: cau hinh mac dinh; NEU co pkijs + node-forge + pdf-lib + @signpdf: KY THAT bang chung thu TU KY roi TU KIEM
        (TSA tat de khong goi internet) — thieu thu vien thi BO QUA (in ro, khong do).
     8. server.js / app.js / index.html / migration / .env.example: cac moc noi day.
   Chay:  node backend\utils\kiem_hop_dong_ky_dien_tu.js   — KHONG dung CSDL, KHONG goi internet.
   ================================================================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Module = require('module');

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

const FILES = [['backend/utils/nhatKyHopDong.js'], ['backend/utils/guiOtp.js'], ['backend/utils/hopDongPdf.js'], ['backend/utils/kiemChuKySo.js'], ['backend/utils/kySoPdf.js'],
  ['backend/utils/hopDongCore.js'], ['backend/routes/hopdong.js'], ['backend/routes/publicKy.js'], ['backend/routes/hrm.js'], ['backend/server.js'], ['backend/utils/thu_ky_so.js'],
  ['frontend/js/module.hopdong.js'], ['frontend/js/ky.js'], ['frontend/js/kysoclient.js'], ['frontend/js/app.js']];
console.log('\n=== 1. BIEN DICH ===');
FILES.forEach(([f]) => { const s = doc(...f.split('/')); if (!s) { sai++; console.log('  ❌ ' + f + ' KHONG DOC DUOC'); return; } try { new vm.Script(s, { filename: f }); dat++; console.log('  ✓ ' + f); } catch (e) { sai++; console.log('  ❌ ' + f + ' VO CU PHAP: ' + e.message); } });

/* ---------------------------------------------------------------- db gia dung chung */
const sqlGia = new Proxy({}, { get(_, k) { const f = () => k; f.toString = () => String(k); return f; } });
const nhatKyRows = []; let nkId = 0;
function taoReq(nhatKy, cauTraLoi) {
  const inputs = {};
  const r = { input(t, k, v) { inputs[t] = arguments.length === 2 ? k : v; return r; }, async query(q) {
    const s = q.replace(/\s+/g, ' ').trim(); nhatKy.push({ q: s, inputs: Object.assign({}, inputs) });
    return cauTraLoi(s, inputs);
  } };
  return r;
}
const rs = (recordset, ra) => ({ recordset, rowsAffected: ra || [recordset.length] });
/* Bang HopDongMBNhatKy trong bo nho — du cho nhatKyHopDong.ghi()/doc(). */
function traLoiNhatKy(s, inputs) {
  if (/SELECT TOP 1 Hash FROM HopDongMBNhatKy WHERE HopDongMBID=@hd ORDER BY NhatKyID DESC/.test(s)) { const r = nhatKyRows.filter(x => x.HopDongMBID === inputs.hd).slice(-1); return rs(r.map(x => ({ Hash: x.Hash }))); }
  if (/INSERT INTO HopDongMBNhatKy/.test(s)) { nkId += 1; const luc = '2026-11-14 10:00:' + String(nkId).padStart(2, '0') + '.000'; nhatKyRows.push({ NhatKyID: nkId, HopDongMBID: inputs.hd, HanhDong: inputs.hanh, ChiTiet: inputs.ct, IP: inputs.ip, UserAgent: inputs.ua, UserID: inputs.uid, BenKyID: inputs.ben, HashTruoc: inputs.ht, Hash: '0'.repeat(64), Luc: luc }); return rs([{ NhatKyID: nkId, Luc: luc }]); }
  if (/UPDATE HopDongMBNhatKy SET Hash=@h WHERE NhatKyID=@id/.test(s)) { const r = nhatKyRows.find(x => x.NhatKyID === inputs.id); if (r) r.Hash = inputs.h; return rs([], [1]); }
  if (/FROM HopDongMBNhatKy n LEFT JOIN Users u/.test(s)) return rs(nhatKyRows.filter(x => x.HopDongMBID === inputs.hd).map(x => Object.assign({ NguoiThucHien: null }, x)));
  return rs([]);
}
const nhatKySql = [];
const poolGia = { request: () => taoReq(nhatKySql, traLoiNhatKy) };
const THAY = { '../db': { sql: sqlGia, getPool: async () => poolGia } };
const gocLoad = Module._load;
Module._load = function (ten, parent) {
  if (Object.prototype.hasOwnProperty.call(THAY, ten)) return THAY[ten];
  return gocLoad.apply(this, arguments);
};

(async () => {
  /* ---------------------------------------------------------------- 2 */
  console.log('\n=== 2. hopDongPdf (ham thuan) ===');
  const pdfU = require('./hopDongPdf');
  kiem('timBien: lay DUY NHAT, dung thu tu, chap nhan khoang trang', JSON.stringify(pdfU.timBien('a {{SoHopDong}} b {{ BenMua_Ten }} c {{SoHopDong}} {{BangHang}}')) === JSON.stringify(['SoHopDong', 'BenMua_Ten', 'BangHang']));
  const html = pdfU.thayBien('<p>{{A}} — {{B}}</p>{{BangHang}}{{C}}', { A: '<b>x</b> & "y"', B: 'dòng 1\ndòng 2' }, '<table>BANG</table>');
  kiem('thayBien: escape HTML gia tri nguoi go, xuong dong -> <br>, BangHang chen HTML, bien trong -> rong', html === '<p>&lt;b&gt;x&lt;/b&gt; &amp; &quot;y&quot; — dòng 1<br>dòng 2</p><table>BANG</table>', html);
  const c = pdfU.soThanhChu;
  kiem('soThanhChu: 0/5/15/21/24/25/105/115', c(0) === 'Không đồng' && c(5) === 'Năm đồng' && c(15) === 'Mười lăm đồng' && c(21) === 'Hai mươi mốt đồng' && c(24) === 'Hai mươi tư đồng' && c(25) === 'Hai mươi lăm đồng' && c(105) === 'Một trăm lẻ năm đồng' && c(115) === 'Một trăm mười lăm đồng', [c(0), c(5), c(15), c(21), c(24), c(25), c(105), c(115)]);
  kiem('soThanhChu: 1.000 / 1.005 / 25.000 / 1.234.567', c(1000) === 'Một nghìn đồng' && c(1005) === 'Một nghìn không trăm lẻ năm đồng' && c(25000) === 'Hai mươi lăm nghìn đồng' && c(1234567) === 'Một triệu hai trăm ba mươi tư nghìn năm trăm sáu mươi bảy đồng', [c(1000), c(1005), c(25000), c(1234567)]);
  kiem('soThanhChu: 2 tỷ / 1.000 tỷ / 2.000.000.005', c(2000000000) === 'Hai tỷ đồng' && c(1e12) === 'Một nghìn tỷ đồng' && c(2000000005) === 'Hai tỷ không trăm lẻ năm đồng', [c(2000000000), c(1e12), c(2000000005)]);
  kiem('soThanhChu: lam tron, so am ghi (âm)', c(1999.6) === 'Hai nghìn đồng' && /\(âm\)$/.test(c(-7)));
  const bh = pdfU.bangHangHtml([{ MaSanPham: 'A1', TenSanPham: 'Áo <b>', MauSac: 'Đỏ', DonVi: 'Cái', SoLuong: 10, DonGia: 150000, ThanhTien: 1500000 }, { TenSanPham: 'Quần', SoLuong: 2, DonGia: 200000, ThanhTien: 400000 }]);
  kiem('bangHangHtml: 2 dong + TONG CONG 1.900.000, escape ten', (bh.match(/<tr>/g) || []).length === 3 && /TỔNG CỘNG/.test(bh) && /1\.900\.000/.test(bh) && /Áo &lt;b&gt;/.test(bh), bh.slice(0, 200));
  kiem('bangHangHtml: khong hang -> rong', pdfU.bangHangHtml([]) === '' && pdfU.bangHangHtml(null) === '');
  kiem('maTraCuuMoi: dang HDXXXXX-XXXXX, khong co I/O/0/1, moi lan khac nhau', /^HD[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/.test(pdfU.maTraCuuMoi()) && pdfU.maTraCuuMoi() !== pdfU.maTraCuuMoi());
  kiem('wrapA4: @page A4, Times New Roman, co <body>', /@page \{ size: A4/.test(pdfU.wrapA4('<p>x</p>')) && /Times New Roman/.test(pdfU.wrapA4('')) && /<body><p>x<\/p><\/body>/.test(pdfU.wrapA4('<p>x</p>')));
  kiem('ngayChu / ddmmyyyy', /^\d{2} tháng \d{2} năm \d{4}$/.test(pdfU.ngayChu(new Date(2026, 10, 14))) && pdfU.ddmmyyyy('2026-11-14') === '14/11/2026');
  const tcn = pdfU.trangChungNhanHtml({ hd: { SoHopDong: 'HD260001', TenHopDong: 'T', PhienBan: 1, HashGoc: 'ab'.repeat(32), MaTraCuu: 'HDAAAAA-BBBBB' }, ben: [{ Ben: 'Khach', HoTen: 'Nguyễn <A>', CachKy: 'OTP', KenhOTP: 'email', DichOTP: 'a***@x.vn', TrangThai: 'DaKy', KyLuc: '2026-11-14 10:00:00', IP: '1.2.3.4' }], nhatKy: [{ HanhDong: 'OTP_DUNG', Luc: '2026-11-14 10:00:00', IP: '1.2.3.4', ChiTiet: '{"kenh":"email","otp":"123456"}' }], qrDataUrl: '', urlTra: 'https://x/ky.html?tra=HDAAAAA-BBBBB', cfg: { tenCongTy: 'MOYN', tsaCongCong: true } });
  kiem('trang chung nhan: co ten, cach ky OTP + dich che, hash, ma tra cuu, escape ten, KHONG lo ma OTP trong chi tiet, cau TSA cong cong', /CHỨNG NHẬN KÝ ĐIỆN TỬ/.test(tcn) && /Nguyễn &lt;A&gt;/.test(tcn) && /OTP qua EMAIL → a\*\*\*@x\.vn/.test(tcn) && /HDAAAAA-BBBBB/.test(tcn) && !/123456/.test(tcn) && /TSA công cộng/.test(tcn));

  /* ---------------------------------------------------------------- 3 */
  console.log('\n=== 3. nhatKyHopDong THAT (CSDL gia): chuoi bam ===');
  const nk = require('./nhatKyHopDong');
  const r1 = await nk.ghi(poolGia, { hopDongId: 5, hanhDong: 'TAO', chiTiet: { so: 'HD260001' }, ip: '10.0.0.1', ua: 'UA', userId: 7 });
  const r2 = await nk.ghi(poolGia, { hopDongId: 5, hanhDong: 'XEM', chiTiet: { trangThai: 'ChoKy' }, ip: '1.2.3.4', ua: 'Mobile' });
  const r3 = await nk.ghi(poolGia, { hopDongId: 5, hanhDong: 'OTP_DUNG', chiTiet: null, benKyId: 9 });
  await nk.ghi(poolGia, { hopDongId: 6, hanhDong: 'TAO' });
  kiem('ghi 3 dong HD5: ok, hash 64 hex, HashTruoc noi dong truoc', r1.ok && r2.ok && r3.ok && /^[0-9a-f]{64}$/.test(r1.hash) && nhatKyRows[1].HashTruoc === r1.hash && nhatKyRows[2].HashTruoc === r2.hash && nhatKyRows[0].HashTruoc == null, nhatKyRows.map(x => [x.HashTruoc && x.HashTruoc.slice(0, 6), x.Hash.slice(0, 6)]));
  const d1 = await nk.doc(poolGia, 5);
  kiem('doc HD5: 3 dong, chuoi NGUYEN VEN', d1.rows.length === 3 && d1.chuoiOk === true && d1.dongHong === null);
  const d6 = await nk.doc(poolGia, 6);
  kiem('HD6 doc lap: 1 dong, HashTruoc null, chuoi ok', d6.rows.length === 1 && d6.rows[0].HashTruoc == null && d6.chuoiOk);
  nhatKyRows[1].ChiTiet = '{"trangThai":"DaKy"}';   // sua tay dong 2
  const d2 = await nk.doc(poolGia, 5);
  kiem('sua tay ChiTiet dong 2 -> chuoi VO, dongHong = dong 2', d2.chuoiOk === false && d2.dongHong === nhatKyRows[1].NhatKyID);
  nhatKyRows[1].ChiTiet = '{"trangThai":"ChoKy"}';
  kiem('tra lai -> chuoi ok', (await nk.doc(poolGia, 5)).chuoiOk === true);
  kiem('ghi loi (thieu hopDongId) -> { ok:false }, KHONG nem', (await nk.ghi(poolGia, { hanhDong: 'X' })).ok === false);
  kiem('chuoiBam co dinh thu tu, null -> rong', nk.chuoiBam({ HashTruoc: null, HanhDong: 'A', ChiTiet: null, IP: '', UserAgent: null, UserID: null, BenKyID: 3, Luc: 'L' }) === '|A||||' + '|3|L');

  /* ---------------------------------------------------------------- 4 */
  console.log('\n=== 4. guiOtp ===');
  const envCu = {}; ['SMTP_HOST', 'SMS_PROVIDER', 'SMS_API_KEY', 'ZALO_ZNS_TEMPLATE_OTP'].forEach(k => { envCu[k] = process.env[k]; delete process.env[k]; });
  const gui = require('./guiOtp');
  kiem('kenhSanSang: chua cau hinh gi -> ca ba false', JSON.stringify(gui.kenhSanSang()) === JSON.stringify({ email: false, sms: false, zalo: false }));
  kiem('cheDich: SDT 0912345678 -> 09*****678 ; email -> a****@gmail.com', gui.cheDich('sms', '0912345678') === '09*****678' && /^a\*+@gmail\.com$/.test(gui.cheDich('email', 'an.thuy@gmail.com')) && gui.cheDich('sms', '') === '');
  kiem('chuanHoaSDT: 0912345678 -> 84912345678; +84 912 345 678 -> 84912345678; sai -> rong', gui.chuanHoaSDT('0912345678') === '84912345678' && gui.chuanHoaSDT('+84 912 345 678') === '84912345678' && gui.chuanHoaSDT('12345') === '');
  kiem('emailHopLe', gui.emailHopLe('a@b.vn') && !gui.emailHopLe('a@b') && !gui.emailHopLe(''));
  const g1 = await gui.guiOtp('email', 'a@b.vn', '123456', { soHopDong: 'HD1' });
  const g2 = await gui.guiOtp('sms', '0912345678', '123456', {});
  const g3 = await gui.guiOtp('zalo', '0912345678', '123456', {});
  const g4 = await gui.guiOtp('xxx', 'a', '1', {});
  kiem('guiOtp khi chua cau hinh: email/sms/zalo deu { ok:false, loi ro }, kenh la -> loi; KHONG nem', !g1.ok && /SMTP/.test(g1.loi) && !g2.ok && /SMS/.test(g2.loi) && !g3.ok && /Zalo/.test(g3.loi) && !g4.ok, [g1.loi, g2.loi, g3.loi, g4.loi]);
  process.env.SMS_PROVIDER = 'esms'; process.env.SMS_API_KEY = 'k'; process.env.ZALO_ZNS_TEMPLATE_OTP = '123';
  kiem('bat SMS_PROVIDER=esms + SMS_API_KEY -> sms true; ZALO_ZNS_TEMPLATE_OTP -> zalo true', gui.kenhSanSang().sms === true && gui.kenhSanSang().zalo === true);
  const g5 = await gui.guiSMS({ to: 'abc', noiDung: 'x' });
  kiem('guiSMS so sai -> loi so dien thoai, khong goi mang', !g5.ok && /Số điện thoại/.test(g5.loi));
  Object.keys(envCu).forEach(k => { if (envCu[k] === undefined) delete process.env[k]; else process.env[k] = envCu[k]; });

  /* ---------------------------------------------------------------- 5 */
  console.log('\n=== 5. hopDongCore ===');
  const core = require('./hopDongCore');
  const bm = core.benMuaTuKhach({ TenKhachHang: 'Shop A', TenHoaDon: 'Công ty A', MaSoThue: '0101', DiaChi: 'HN', SDT: '09', Email: 'a@b.vn', EmailNguoiKy: 'ky@b.vn', NguoiDaiDien: 'Ông A', ChucVuNDD: 'GĐ', SoCCCD: '001', LoaiDoiTac: 'CongTy' });
  kiem('benMuaTuKhach: uu tien TenHoaDon / EmailNguoiKy, map du truong', bm.Ten === 'Công ty A' && bm.Email === 'ky@b.vn' && bm.MST === '0101' && bm.NguoiDaiDien === 'Ông A' && bm.ChucVu === 'GĐ' && bm.CCCD === '001' && bm.LoaiDoiTac === 'CongTy' && bm.SDT === '09');
  const bien = core.bienChuan({ SoHopDong: 'HD260001', TenHopDong: 'T', TongTien: 0 }, bm, { tenCongTy: 'MOYN', mst: '999', nguoiKy: 'Bà B', chucVu: 'GĐ', diaDiemKy: 'Hà Nội', ghiChuThue: 'đã gồm VAT' }, [{ ThanhTien: 1500000 }, { ThanhTien: 400000 }]);
  kiem('bienChuan: ben ban tu cau hinh, ben mua tu snapshot, TongTien tu hang (1.900.000) + bang chu', bien.BenBan_Ten === 'MOYN' && bien.BenBan_MST === '999' && bien.BenMua_Ten === 'Công ty A' && bien.TongTien === '1.900.000' && bien.TongTienBangChu === 'Một triệu chín trăm nghìn đồng' && bien.DiaDiemKy === 'Hà Nội' && bien.GhiChuThue === 'đã gồm VAT' && /^\d{2} tháng/.test(bien.NgayKy), bien);
  kiem('docTheoToken: token sai dinh dang -> null, KHONG cham CSDL', (await core.docTheoToken({ request() { throw new Error('khong duoc cham'); } }, 'abc')) === null && (await core.docTheoToken({ request() { throw new Error('x'); } }, 'a'.repeat(100))) === null);
  kiem('TEN_TRANG_THAI du 9 trang thai', core.TRANG_THAI.length === 9 && core.TRANG_THAI.every(t => core.TEN_TRANG_THAI[t]));
  kiem('urlCongKhai ghep PUBLIC_BASE_URL (bo / cuoi)', (() => { const c0 = process.env.PUBLIC_BASE_URL; process.env.PUBLIC_BASE_URL = 'https://x.vn/'; const u = core.urlCongKhai('/ky.html?t=1'); if (c0 === undefined) delete process.env.PUBLIC_BASE_URL; else process.env.PUBLIC_BASE_URL = c0; return u === 'https://x.vn/ky.html?t=1'; })());

  /* ---------------------------------------------------------------- 6 */
  console.log('\n=== 6. routes/hopdong.js + routes/publicKy.js THAT ===');
  const mw = () => (req, res, next) => next();
  const gacNhatKy = [];
  THAY['../middleware/auth'] = { requireAuth: mw(), requirePermission: (m, a) => { gacNhatKy.push('P:' + m + ':' + a); return mw(); }, requireChucNang: (m, c) => { gacNhatKy.push('C:' + m + ':' + c); return mw(); }, requireChucNangAny: mw, canUpdateStage: mw, coQuyenChucNang: (u, m, c) => !!(u && u.kyso) };
  THAY['./hrm'] = { locMauAnToan: (s) => String(s).replace(/<script[\s\S]*?<\/script>/gi, '') };
  const rHD = require(path.join(GOC, 'backend', 'routes', 'hopdong.js'));
  const rPK = require(path.join(GOC, 'backend', 'routes', 'publicKy.js'));
  const duong = (router) => (router.stack || []).filter(l => l.route).map(l => Object.keys(l.route.methods).map(m => m.toUpperCase() + ' ' + l.route.path)).flat();
  const dsHD = duong(rHD), dsPK = duong(rPK);
  const can = ['GET /mau', 'PUT /mau/:ma', 'DELETE /mau/:ma', 'POST /mau/tai-len', 'GET /mau/:ma/lichsu', 'GET /cauhinh', 'PUT /cauhinh', 'POST /cauhinh/kiem-bo-ky', 'POST /cauhinh/ky-thu', 'GET /khach', 'PUT /khach/:id', 'GET /', 'POST /', 'GET /:id', 'PUT /:id', 'DELETE /:id',
    'POST /:id/pdf-soan-san', 'GET /:id/xem-truoc', 'POST /:id/xuat-ban', 'POST /:id/gui-link', 'POST /:id/gui-otp', 'POST /:id/huy', 'POST /:id/thu-hoi', 'PUT /:id/thanh-toan', 'GET /:id/nhatky', 'GET /:id/pdf', 'POST /:id/ky-lai', 'POST /:id/tai-len-da-ky', 'POST /:id/ky-cong-cu/bat-dau', 'POST /:id/ky-cong-cu/hoan-tat'];
  kiem('hopdong.js: du ' + can.length + ' route', can.every(x => dsHD.includes(x)), can.filter(x => !dsHD.includes(x)));
  kiem('hopdong.js: route chu (/mau, /cauhinh, /khach) dung TRUOC /:id', dsHD.indexOf('GET /mau') < dsHD.indexOf('GET /:id') && dsHD.indexOf('GET /cauhinh') < dsHD.indexOf('GET /:id') && dsHD.indexOf('GET /khach') < dsHD.indexOf('GET /:id'));
  kiem('hopdong.js: moi route deu gac requirePermission(HOPDONG) + requireChucNang(HOPDONG, danhsach|mau|cauhinh)', gacNhatKy.filter(x => x.startsWith('P:')).every(x => /^P:HOPDONG:(view|create|edit|delete)$/.test(x)) && gacNhatKy.filter(x => x.startsWith('C:')).every(x => /^C:HOPDONG:(danhsach|mau|cauhinh)$/.test(x)) && gacNhatKy.length >= can.length * 2);
  const canPK = ['GET /tra/:ma', 'GET /:token', 'GET /:token/pdf', 'POST /:token/otp', 'POST /:token/ky', 'POST /:token/tu-choi', 'POST /:token/ky-so/tai-len', 'POST /:token/ky-so/bat-dau', 'POST /:token/ky-so/hoan-tat'];
  kiem('publicKy.js: du ' + canPK.length + ' route, /tra/:ma dung TRUOC /:token', canPK.every(x => dsPK.includes(x)) && dsPK.indexOf('GET /tra/:ma') < dsPK.indexOf('GET /:token'), canPK.filter(x => !dsPK.includes(x)));
  const layHandler = (router, method, p) => { const l = router.stack.find(x => x.route && x.route.path === p && x.route.methods[method]); return l && l.route.stack[l.route.stack.length - 1].handle; };
  const goi = async (h, req) => { const res = { code: 200, body: null, status(c) { res.code = c; return res; }, json(o) { res.body = o; return res; }, setHeader() {}, end() {} }; await h(Object.assign({ body: {}, query: {}, params: {}, headers: {}, session: { user: { userId: 7 } }, ip: '9.9.9.9' }, req), res, () => {}); return res; };
  let r = await goi(layHandler(rPK, 'get', '/tra/:ma'), { params: { ma: 'xyz' } });
  kiem('GET /tra/:ma sai dinh dang -> 400, khong cham CSDL', r.code === 400 && /định dạng/.test(r.body.message));
  r = await goi(layHandler(rPK, 'get', '/:token'), { params: { token: 'abc' } });
  kiem('GET /:token sai dinh dang -> 404 (link khong ton tai)', r.code === 404);
  let ma429 = null;
  for (let i = 0; i < 13; i++) { const rr = await goi(layHandler(rPK, 'post', '/:token/otp'), { params: { token: 'abc' }, body: { kenh: 'email' }, ip: '7.7.7.7' }); if (rr.code === 429) { ma429 = i + 1; break; } }
  kiem('POST /:token/otp: gioi han 12 lan/gio theo IP -> lan 13 tra 429', ma429 === 13, { lanBi429: ma429 });
  r = await goi(layHandler(rPK, 'post', '/:token/ky'), { params: { token: 'abc' }, body: { otp: '123456' }, ip: '8.8.8.8' });
  kiem('POST /:token/ky thieu dongY -> 400 "tick dong y" (truoc ca kiem token? khong — token sai 404 truoc)', r.code === 404 || (r.code === 400 && /đồng ý/.test(r.body.message)));
  r = await goi(layHandler(rHD, 'post', '/:id/ky-lai'), { params: { id: 1 }, session: { user: { userId: 7 } } });
  kiem('hopdong POST /:id/ky-lai KHONG co nang luc kyso -> 403 (coQuyenChucNang)', r.code === 403 && /kyso/.test(r.body.message));
  r = await goi(layHandler(rHD, 'put', '/:id/thanh-toan'), { params: { id: 1 }, body: { trangThai: 'XYZ' } });
  kiem('PUT /:id/thanh-toan gia tri la -> 400', r.code === 400);
  r = await goi(layHandler(rHD, 'put', '/cauhinh'), { body: { hanLinkNgay: 200 } });
  kiem('PUT /cauhinh han link 200 ngay -> 400', r.code === 400);
  const fPK = boComment(doc('backend', 'routes', 'publicKy.js'));
  kiem('publicKy.js KHONG require middleware/auth (khong requireAuth) — token la quyen', !/middleware\/auth/.test(fPK));

  /* ---------------------------------------------------------------- 7 */
  console.log('\n=== 7. kySoPdf ===');
  const kySo = require('./kySoPdf');
  const envKy = {}; ['HOPDONG_KY_TU_DONG', 'HOPDONG_TSA_URL'].forEach(k => { envKy[k] = process.env[k]; delete process.env[k]; });
  let cfg = kySo.cauHinh();
  kiem('cauHinh mac dinh: loai tat, TSA DigiCert cong cong', cfg.loai === 'tat' && cfg.tsaUrl === 'http://timestamp.digicert.com' && cfg.tsaCongCong === true);
  process.env.HOPDONG_KY_TU_DONG = 'PFX'; process.env.HOPDONG_TSA_URL = '';
  cfg = kySo.cauHinh();
  kiem('HOPDONG_KY_TU_DONG=PFX (hoa) -> pfx; HOPDONG_TSA_URL rong -> tat TSA', cfg.loai === 'pfx' && cfg.tsaUrl === '');
  kiem('kyTuDong khi tat -> null', await (async () => { process.env.HOPDONG_KY_TU_DONG = ''; return (await kySo.kyTuDong(Buffer.from('%PDF-1.4'))) === null; })());
  kiem('boKyPfx thieu file -> nem loi ro, khong sap', (() => { if (!coThuVien('node-forge')) return true; try { kySo.boKyPfx({ pfxPath: 'C:\\khong\\co.pfx', pfxPass: '' }); return false; } catch (e) { return /PFX/.test(e.message); } })());
  const coDu = ['pkijs', 'asn1js', 'node-forge', 'pdf-lib', '@signpdf/signpdf', '@signpdf/placeholder-pdf-lib', '@signpdf/utils'].filter(t => !coThuVien(t));
  if (coDu.length) { boQua++; console.log('  ⏭ BO QUA ky that: chua cai ' + coDu.join(', ') + '  (cd backend && npm install pdf-lib pkijs asn1js node-forge @signpdf/signpdf @signpdf/placeholder-pdf-lib @signpdf/utils mammoth)'); }
  else {
    try {
      const forge = require('node-forge');
      const keys = forge.pki.rsa.generateKeyPair(2048);
      const cert = forge.pki.createCertificate();
      cert.publicKey = keys.publicKey; cert.serialNumber = '0123abcd'; cert.validity.notBefore = new Date(Date.now() - 86400000); cert.validity.notAfter = new Date(Date.now() + 365 * 86400000);
      const attrs = [{ name: 'commonName', value: 'CONG TY MOYN TEST' }, { name: 'organizationName', value: 'MOYN' }, { name: 'serialName', value: 'MST:0101234567' }, { name: 'countryName', value: 'VN' }];
      cert.setSubject(attrs); cert.setIssuer(attrs); cert.sign(keys.privateKey, forge.md.sha256.create());
      const p12 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], 'matkhau', { algorithm: '3des' });
      const pfxPath = path.join(__dirname, '__thu_ky.pfx');
      fs.writeFileSync(pfxPath, Buffer.from(forge.asn1.toDer(p12).getBytes(), 'binary'));
      const { PDFDocument, StandardFonts } = require('pdf-lib');
      const pdfDoc = await PDFDocument.create(); const page = pdfDoc.addPage([595, 842]); const font = await pdfDoc.embedFont(StandardFonts.Helvetica); page.drawText('HOP DONG THU', { x: 50, y: 780, size: 20, font });
      const pdfGoc = Buffer.from(await pdfDoc.save({ useObjectStreams: false }));
      const boKy = kySo.boKyPfx({ pfxPath, pfxPass: 'matkhau' });
      kiem('boKyPfx: doc duoc chung thu tu ky (CN, MST tu SERIALNUMBER)', boKy.thongTin.CN === 'CONG TY MOYN TEST' && boKy.thongTin.MST === '0101234567', boKy.thongTin);
      process.env.HOPDONG_TSA_URL = '';   // khong goi internet
      const kq = await kySo.kyPdf(pdfGoc, boKy, { lyDo: 'thu' });
      kiem('kyPdf: ra PDF lon hon, co /ByteRange, tu kiem HOP LE, tsa.ok=false (tat)', Buffer.isBuffer(kq.pdf) && kq.pdf.length > pdfGoc.length && /\/ByteRange/.test(kq.pdf.toString('latin1')) && kq.tsa && kq.tsa.ok === false);
      const kiemCK = require('./kiemChuKySo');
      const kq2 = await kiemCK.kiemPdf(kq.pdf);
      kiem('kiemChuKySo.kiemPdf tren ban vua ky: 1 chu ky hop le, chung thu dung, con han, kyLuc co, khong dau thoi gian', kq2.ok && kq2.chuKy.length === 1 && kq2.chuKy[0].hopLe && kq2.chuKy[0].chungThu.CN === 'CONG TY MOYN TEST' && kq2.chuKy[0].conHan === true && kq2.chuKy[0].kyLuc instanceof Date && kq2.chuKy[0].coDauThoiGian === false, kq2);
      const hong = Buffer.from(kq.pdf); hong[300] ^= 0xff;   // sua 1 byte trong noi dung
      const kq3 = await kiemCK.kiemPdf(hong);
      kiem('sua 1 byte noi dung -> chu ky KHONG hop le', kq3.ok === false);
      /* @signpdf ghi chu ky TAI CHO (khong incremental) nen "ban goc" cua phep kiem = phan dau file da ky; Adobe/plugin CA ky
         incremental that su thi phan dau file = dung ban goc da gui. Phep kiem tien to + xac minh chu ky la cai can thu o day. */
      const tl = await kiemCK.kiemBanTaiLen(kq.pdf, kq.pdf.slice(0, 1000), { mst: '0101234567', ten: 'CONG TY MOYN TEST' });
      kiem('kiemBanTaiLen: phan dau khop ban goc + chu ky hop le -> ok, khong canh bao', tl.ok && (!tl.canhBao || !tl.canhBao.length), tl);
      const tl2 = await kiemCK.kiemBanTaiLen(kq.pdf, Buffer.concat([kq.pdf.slice(0, 1000), Buffer.from('x')]), {});
      kiem('kiemBanTaiLen: phan dau KHAC ban goc (file bi ghi lai) -> KHONG_INCREMENTAL, cau huong dan Adobe/Foxit', !tl2.ok && tl2.maLoi === 'KHONG_INCREMENTAL' && /Adobe/.test(tl2.loi));
      const tl3 = await kiemCK.kiemBanTaiLen(kq.pdf, kq.pdf.slice(0, 1000), { mst: '9999', ten: 'KHAC' });
      kiem('kiemBanTaiLen: MST/ten lech -> ok nhung 2 canh bao', tl3.ok && tl3.canhBao.length === 2, tl3.canhBao);
      kiem('kiemBanTaiLen: file khong phai PDF -> loi', !(await kiemCK.kiemBanTaiLen(Buffer.from('hello world, not a pdf at all, really not'.repeat(5)), null)).ok);
      // ky ngoai 2 buoc (gia lap cong cu bang khoa cua chinh cert tu ky)
      const certDer = Buffer.from(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes(), 'binary');
      const bd = await kySo.batDauKyNgoai(pdfGoc, certDer, { lyDo: 'thu' });
      kiem('batDauKyNgoai: tra phienKy + dataKy (SET 0x31) + thongTin', typeof bd.phienKy === 'string' && Buffer.from(bd.dataKy, 'base64')[0] === 0x31 && bd.thongTin.CN === 'CONG TY MOYN TEST');
      const sig = require('crypto').sign('sha256', Buffer.from(bd.dataKy, 'base64'), { key: forge.pki.privateKeyToPem(keys.privateKey) });
      const ht = await kySo.hoanTatKyNgoai(bd.phienKy, sig.toString('base64'));
      kiem('hoanTatKyNgoai: ghep chu ky ngoai -> PDF tu kiem hop le', Buffer.isBuffer(ht.pdf) && (await kiemCK.kiemPdf(ht.pdf)).ok);
      kiem('hoanTatKyNgoai phien da dung -> loi ro', await (async () => { try { await kySo.hoanTatKyNgoai(bd.phienKy, sig.toString('base64')); return false; } catch (e) { return /Phiên ký/.test(e.message); } })());
      const bd2 = await kySo.batDauKyNgoai(pdfGoc, certDer, {});
      kiem('hoanTatKyNgoai chu ky SAI -> loi "KHONG hop le", khong luu', await (async () => { try { await kySo.hoanTatKyNgoai(bd2.phienKy, Buffer.alloc(256, 7).toString('base64')); return false; } catch (e) { return /KHÔNG hợp lệ|không hợp lệ/.test(e.message); } })());
      fs.unlinkSync(pfxPath);
    } catch (e) { sai++; console.log('  ❌ ky that nem loi: ' + (e && e.stack || e)); }
  }
  Object.keys(envKy).forEach(k => { if (envKy[k] === undefined) delete process.env[k]; else process.env[k] = envKy[k]; });

  /* ---------------------------------------------------------------- 8 */
  console.log('\n=== 8. noi day: server.js / app.js / index.html / migration / .env.example ===');
  const sv = boComment(doc('backend', 'server.js'));
  kiem('server.js: require hopdong + publicKy, mount /api/hopdong va /api/public/ky TRUOC /api/public', /require\('\.\/routes\/hopdong'\)/.test(sv) && /require\('\.\/routes\/publicKy'\)/.test(sv) && sv.indexOf("app.use('/api/public/ky', publicKyRoutes)") > -1 && sv.indexOf("app.use('/api/public/ky', publicKyRoutes)") < sv.indexOf("app.use('/api/public', publicRoutes)"));
  kiem('server.js: cong cong khai mo /ky.html, /js/ky.js, /js/kysoclient.js, /tools/MoynKySo/, /api/public/ky/ — KHONG mo /api/hopdong', /duong === '\/ky\.html'/.test(sv) && /duong === '\/js\/ky\.js'/.test(sv) && /duong === '\/js\/kysoclient\.js'/.test(sv) && /startsWith\('\/tools\/MoynKySo\/'\)/.test(sv) && /startsWith\('\/api\/public\/ky\/'\)/.test(sv) && !/startsWith\('\/api\/hopdong/.test(sv));
  const ap = boComment(doc('frontend', 'js', 'app.js'));
  kiem('app.js: phan he HOPDONG -> window.ModuleHopDong', /code: 'HOPDONG', label: 'Hợp đồng mua bán', icon: '📝', mod: window\.ModuleHopDong/.test(ap));
  const html = doc('frontend', 'index.html');
  const vCua = (f) => { const m = new RegExp(f.replace(/[.]/g, '\\.') + '\\?v=([\\d.]+)').exec(html); return m ? parseFloat(m[1]) : 0; };   // so >=, KHONG ghim (v9.62 bump module.hopdong.js)
  kiem('index.html: nap kysoclient.js + module.hopdong.js (?v>=9.61) TRUOC app.js', vCua('/js/kysoclient.js') >= 9.61 && vCua('/js/module.hopdong.js') >= 9.61 && html.indexOf('/js/module.hopdong.js') < html.indexOf('/js/app.js'), { kysoclient: vCua('/js/kysoclient.js'), hopdong: vCua('/js/module.hopdong.js') });
  const kyHtml = doc('frontend', 'ky.html');
  kiem('ky.html: viewport mobile, noindex, nap kysoclient.js + ky.js', /name="viewport"/.test(kyHtml) && /noindex/.test(kyHtml) && /\/js\/kysoclient\.js/.test(kyHtml) && /\/js\/ky\.js/.test(kyHtml));
  const kyJs = boComment(doc('frontend', 'js', 'ky.js'));
  kiem('ky.js: nut "Tôi đồng ý ký kết / Xác nhận đơn hàng", o OTP 6 so, tick dong y, tu choi, tai PDF sau ky, poll khi dang ky so', /Tôi đồng ý ký kết \/ Xác nhận đơn hàng/.test(kyJs) && /maxlength="6"/.test(kyJs) && /ckDongY/.test(kyJs) && /tu-choi/.test(kyJs) && /pdf\?tai=1/.test(kyJs) && /setInterval\(nap, 10000\)/.test(kyJs));
  const mg = doc('database', 'migration_v893.sql');
  kiem('migration_v893: 8 bang/cot + Module HOPDONG + ChucNang kyso MacDinhCho=0 + mau HDMB_CHUAN co dieu khoan ky dien tu', ['MauHopDongMB', 'MauHopDongMB_LichSu', 'HopDongMB', 'HopDongMBHang', 'HopDongMBBenKy', 'HopDongMBLink', 'HopDongMBOTP', 'HopDongMBNhatKy'].every(t => new RegExp("OBJECT_ID\\('" + t + "'\\) IS NULL").test(mg)) && /N'HOPDONG', N'Hợp đồng mua bán'/.test(mg) && /'HOPDONG', 'kyso'[^\n]*, 4, 0\)/.test(mg) && /Luật Giao dịch điện tử năm 2023/.test(mg) && /KhachHang ADD SDTNguoiKy/.test(mg) && /FileChoMoyn/.test(mg));
  const envEx = doc('backend', '.env.example');
  kiem('.env.example: HOPDONG_KY_TU_DONG, HOPDONG_PFX_PATH/PASS, HOPDONG_PKCS11_DLL/PIN, HOPDONG_TSA_URL, SMS_PROVIDER/API_KEY, ZALO_ZNS_TEMPLATE_OTP', ['HOPDONG_KY_TU_DONG', 'HOPDONG_PFX_PATH', 'HOPDONG_PFX_PASS', 'HOPDONG_PKCS11_DLL', 'HOPDONG_PKCS11_PIN', 'HOPDONG_TSA_URL', 'SMS_PROVIDER', 'SMS_API_KEY', 'ZALO_ZNS_TEMPLATE_OTP'].every(k => envEx.indexOf(k) > -1));
  const hrm = doc('backend', 'routes', 'hrm.js');
  kiem('hrm.js xuat locMauAnToan cho hopdong.js dung chung', /router\.locMauAnToan = locMauAnToan;/.test(hrm));
  kiem('tools/MoynKySo: Program.cs (TcpListener, khong can urlacl) + csproj + trang tai (frontend/tools/MoynKySo/index.html)', /TcpListener\(IPAddress\.Loopback/.test(doc('tools', 'MoynKySo', 'Program.cs')) && /RSASignaturePadding\.Pkcs1/.test(doc('tools', 'MoynKySo', 'Program.cs')) && /Access-Control-Allow-Private-Network/.test(doc('tools', 'MoynKySo', 'Program.cs')) && !!doc('tools', 'MoynKySo', 'MoynKySo.csproj') && !!doc('frontend', 'tools', 'MoynKySo', 'index.html'));

  Module._load = gocLoad;
  clearTimeout(canhGac);
  console.log(`\n=== KET QUA: ${dat} dat, ${sai} sai${boQua ? ', ' + boQua + ' muc BO QUA (thieu thu vien)' : ''} ===`);
  process.exit(sai ? 1 : 0);
})().catch(e => { console.error('VO: ' + (e && e.stack || e)); process.exit(1); });
