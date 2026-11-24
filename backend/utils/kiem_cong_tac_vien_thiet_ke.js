/* ================================================================================================
   kiem_cong_tac_vien_thiet_ke.js — bo tu kiem v9.70 (Nguyen 16/11/2026):
   "Them chuc nang luong CTV, don gia, danh muc CTV. Lenh SX them dau tich cong tac vien ben truong Thiet ke:
    tich -> list CTV; khong tich -> NV bo phan Thiet ke. Ky thuat rap chon tu NV bo phan Ky thuat."
   + "Ghi san luong: nhung lenh da cap nhat thi khong hien ra o list lenh nua."
     1. Bien dich + migration_v896 (bang CongTacVien, cot DonHangSanXuat.CongTacVienID, 2 ChucNang).
     2. danhmuc.js CRUD /congtacvien; module.danhmuc tab.
     3. qlsx.js: /danhmuc tra congTacVien; ghiCongTacVien goi o POST + PUT (ghi FK + ThietKeVien = ten CTV); getOrderByMaDH tra TenCongTacVien;
        timLenhChuaGhi loai lenh da co dong Tay (theo nguoi neu biet), giu lenh dang sua — chay THAT voi pool gia.
     4. module.qlsx: oThietKeHtml (checkbox + 2 khung), wireThietKeCTV, docCongTacVien gui congTacVienId; Ky thuat rap loc 'ky thuat', Thiet ke loc 'thiet ke'.
     5. payroll.js /luongctv + module.payroll tab luongctv; index.html ?v>=9.70.
   Chay: node backend\utils\kiem_cong_tac_vien_thiet_ke.js — KHONG dung CSDL.
   ================================================================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const GOC = path.join(__dirname, '..', '..');
const doc = (...p) => fs.existsSync(path.join(GOC, ...p)) ? fs.readFileSync(path.join(GOC, ...p), 'utf8').replace(/\r\n/g, '\n') : '';
let sai = 0, dat = 0;
function kiem(ten, dung, td) {
  if (dung) { dat++; console.log('  ✓ ' + ten); }
  else { sai++; console.log('  ❌ ' + ten + (td ? ' — ' + (typeof td === 'string' ? td : JSON.stringify(td)) : '')); }
}
const boComment = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const canhGac = setTimeout(() => { console.log('\n  ❌ BO KIEM TREO qua 20 s'); process.exit(1); }, 20000);

console.log('\n=== 1. BIEN DICH + MIGRATION ===');
['backend/routes/qlsx.js', 'backend/routes/payroll.js', 'backend/routes/danhmuc.js', 'frontend/js/module.qlsx.js', 'frontend/js/module.payroll.js', 'frontend/js/module.danhmuc.js', 'frontend/js/module.mypay.js'].forEach(f => {
  const s = doc(...f.split('/')); if (!s) { sai++; console.log('  ❌ ' + f + ' KHONG DOC DUOC'); return; }
  try { new vm.Script(s, { filename: f }); dat++; console.log('  ✓ ' + f); } catch (e) { sai++; console.log('  ❌ ' + f + ' VO CU PHAP: ' + e.message); }
});
const mg = doc('database', 'migration_v896.sql');
kiem('migration_v896: bang CongTacVien (DonGiaThietKe, TrangThai) + cot DonHangSanXuat.CongTacVienID + FK + ChucNang DANHMUC/congtacvien, PAYROLL/luongctv',
  /CREATE TABLE CongTacVien/.test(mg) && /DonGiaThietKe\s+DECIMAL\(14,2\)/.test(mg) && /ALTER TABLE DonHangSanXuat ADD CongTacVienID INT NULL/.test(mg)
  && /FK_DonHangSanXuat_CongTacVien/.test(mg) && /\('DANHMUC', 'congtacvien'/.test(mg) && /\('PAYROLL', 'luongctv'/.test(mg));

(async () => {
  console.log('\n=== 2. danh muc ===');
  const dmb = boComment(doc('backend', 'routes', 'danhmuc.js'));
  kiem("danhmuc.js: router.use('/congtacvien', buildCrudRouter) voi TenCTV required + DonGiaThietKe Decimal", /router\.use\('\/congtacvien', buildCrudRouter\(\{\s*table: 'CongTacVien', idCol: 'CongTacVienID'/.test(dmb) && /\{ name: 'TenCTV', sqlType: sql\.NVarChar, required: true \}/.test(dmb) && /\{ name: 'DonGiaThietKe', sqlType: sql\.Decimal\(14, 2\) \}/.test(dmb));
  const dmf = boComment(doc('frontend', 'js', 'module.danhmuc.js'));
  kiem('module.danhmuc: tab congtacvien voi DonGiaThietKe (number) + TrangThai options', /key: 'congtacvien', label: 'Cộng tác viên thiết kế', api: '\/api\/danhmuc\/congtacvien', idCol: 'CongTacVienID'/.test(dmf) && /name: 'DonGiaThietKe'[^\n]*type: 'number'/.test(dmf) && /value: 'Ngừng'/.test(dmf));

  console.log('\n=== 3. routes/qlsx.js ===');
  const q = boComment(doc('backend', 'routes', 'qlsx.js'));
  kiem('/danhmuc tra congTacVien (dang hop tac), bang chua co -> rong', /FROM CongTacVien WHERE ISNULL\(TrangThai, N'Đang hợp tác'\) <> N'Ngừng'/.test(q) && /congTacVien\s*\}\s*\}\);/.test(q));
  kiem('ghiCongTacVien: undefined -> khong dung; do cot; FK + ThietKeVien = ten CTV; goi o POST + PUT', /async function ghiCongTacVien\(pool, donHangId, congTacVienId\)/.test(q) && /if \(congTacVienId === undefined\) return undefined;/.test(q)
    && /UPDATE DonHangSanXuat SET CongTacVienID = @ctv\$\{ten \? ', ThietKeVien = @tk' : ''\} WHERE DonHangID = @id/.test(q)
    && /await ghiCongTacVien\(pool, donHangId, req\.body\.congTacVienId\);/.test(q) && /await ghiCongTacVien\(pool, order\.DonHangID, req\.body\.congTacVienId\);/.test(q));
  kiem('getOrderByMaDH tra TenCongTacVien (join theo cot)', /ctv\.TenCTV AS TenCongTacVien/.test(q) && /LEFT JOIN CongTacVien ctv ON ctv\.CongTacVienID = d\.CongTacVienID/.test(q));
  kiem('2 route picker dung timLenhChuaGhi (QLSX: nhanVienId + giu; cuatoi: nv phien + giu)', /await timLenhChuaGhi\(pool, req\.query\.q, req\.query\.nhanVienId, req\.query\.giu\)/.test(q) && /await timLenhChuaGhi\(pool, req\.query\.q, nv, req\.query\.giu\)/.test(q));

  /* chay that timLenhChuaGhi: cat ham + stub sanLuongLenh/sql */
  const i0 = q.indexOf('async function timLenhChuaGhi('), i1 = q.indexOf("router.get('/sanluong/lenh'");
  kiem('cat duoc timLenhChuaGhi', i0 > 0 && i1 > i0);
  const cau = [];
  const ctx = { sanLuongLenh: { coBang: async () => true }, sql: new Proxy({}, { get(_, k) { const f = () => k; f.toString = () => String(k); return f; } }) };
  vm.createContext(ctx);
  vm.runInContext(q.slice(i0, i1) + '\nthis.timLenhChuaGhi = timLenhChuaGhi;', ctx, { filename: 'tim_lenh_gia.js' });
  const poolGia = { request: () => { const inp = {}; const rq = { input(k, t, v) { inp[k] = v; return rq; }, async query(s) { cau.push({ s: String(s).replace(/\s+/g, ' '), inp: { ...inp } }); return { recordset: [] }; } }; return rq; } };
  await ctx.timLenhChuaGhi(poolGia, 'DH26', 61, 'DH2611001');
  kiem('co nguoi: NOT EXISTS dong Tay CUA NGUOI DO (s.NhanVienID = @nv) hoac d.MaDH = @giu; q bao %..%', /NOT EXISTS \(SELECT 1 FROM SanLuongTheoLenh s WHERE s\.DonHangID = d\.DonHangID AND s\.Nguon = N'Tay' AND s\.NhanVienID = @nv\)/.test(cau[0].s) && /d\.MaDH = @giu OR NOT EXISTS/.test(cau[0].s) && cau[0].inp.q === '%DH26%' && cau[0].inp.giu === 'DH2611001' && cau[0].inp.nv === 61, cau[0]);
  await ctx.timLenhChuaGhi(poolGia, '', '', '');
  kiem('khong nguoi: loai lenh BAT KY AI da ghi tay (khong co dieu kien NhanVienID)', /s\.Nguon = N'Tay'\)\)/.test(cau[1].s) && !/s\.NhanVienID = @nv/.test(cau[1].s));
  ctx.sanLuongLenh.coBang = async () => false;
  await ctx.timLenhChuaGhi(poolGia, '', '', '');
  kiem('bang chua co (chua migration_v895) -> khong loc, cau van chay', !/SanLuongTheoLenh/.test(cau[2].s));

  console.log('\n=== 4. module.qlsx.js ===');
  const fq = boComment(doc('frontend', 'js', 'module.qlsx.js'));
  kiem('oThietKeHtml: checkbox chkCTV + khung NV (bo phan thiet ke) + khung CTV; goi o 2 form', /function oThietKeHtml\(sfx, detail\)/.test(fq) && /id="chkCTV\$\{sfx\}"/.test(fq) && /opt\(nhanVienBoPhan\('thiet ke'\), 'HoTen', 'HoTen'\)/.test(fq) && /id="selCTV\$\{sfx\}"/.test(fq) && /\$\{oThietKeHtml\('', null\)\}/.test(fq) && /\$\{oThietKeHtml\('Edit', detail\)\}/.test(fq));
  kiem('Ky thuat rap loc NV bo phan "ky thuat" o ca 2 form', (fq.match(/opt\(nhanVienBoPhan\('ky thuat'\), 'HoTen', 'HoTen'\)/g) || []).length === 2);
  kiem('wireThietKeCTV o 2 form; chon CTV -> o ten thiet ke = ten CTV; payload congTacVienId (null khi khong tich)', /wireThietKeCTV\(area, ''\)/.test(fq) && /wireThietKeCTV\(modal, 'Edit'\)/.test(fq) && /inp\.value = o\.textContent\.split\(' — '\)\[0\]/.test(fq) && /congTacVienId: docCongTacVien\(area, ''\)/.test(fq) && /congTacVienId: docCongTacVien\(modal, 'Edit'\)/.test(fq) && /return chk && chk\.checked && sel && sel\.value \? sel\.value : null;/.test(fq));
  kiem('picker san luong gui nhanVienId + giu; doi nguoi thi tim lai lenh', /&nhanVienId=\$\{encodeURIComponent\(nvDangChon\)\}&giu=/.test(fq) && /oNV\.addEventListener\('change', \(\) => \{ napSP\(\); timLenh\(\); \}\)/.test(fq));
  kiem('ban in: "(CTV)" sau ten thiet ke (2 bo cuc)', (fq.match(/\$\{o\.TenCongTacVien \? ' \(CTV\)' : ''\}/g) || []).length === 2);
  const fm = boComment(doc('frontend', 'js', 'module.mypay.js'));
  kiem('mypay picker gui giu', /\/api\/qlsx\/sanluong\/cuatoi\/lenh\?q=\$\{encodeURIComponent\(q\)\}&giu=/.test(fm));

  console.log('\n=== 5. luong CTV — theo MA RAP, moi ma rap mot lan (v9.71) ===');
  const p = boComment(doc('backend', 'routes', 'payroll.js'));
  kiem("payroll.js GET /luongctv gac ChucNang luongctv; doc MOI lenh gan CTV (khong loc thang) + maRapTheoDon; tra rows/trung/chuaCoMaRap/tongHop/tong",
    /router\.get\('\/luongctv', requireAuth, requirePermission\('PAYROLL', 'view'\), requireChucNang\('PAYROLL', 'luongctv'\)/.test(p) && /JOIN CongTacVien c ON c\.CongTacVienID = d\.CongTacVienID\s+ORDER BY d\.NgayDat, d\.DonHangID/.test(p)
    && /tinhLuongCTVTheoMaRap\(tatCa, await maRapTheoDonCTV\(pool\)\)/.test(p) && /data: \{ nam, thang, rows, trung, chuaCoMaRap, tongHop, tong:/.test(p));
  /* chay THAT ham thuan tinhLuongCTVTheoMaRap */
  const j0 = p.indexOf('function tinhLuongCTVTheoMaRap(rows, maRapCua)'), j1 = p.indexOf('const thangCua = ');
  kiem('cat duoc tinhLuongCTVTheoMaRap', j0 > 0 && j1 > j0);
  const ctxP = {}; vm.createContext(ctxP);
  vm.runInContext(p.slice(j0, j1) + '\nthis.f = tinhLuongCTVTheoMaRap;', ctxP, { filename: 'luong_ctv_gia.js' });
  const L = (id, ma, ngay, ctv, dg) => ({ DonHangID: id, MaDH: ma, NgayDat: ngay, CongTacVienID: ctv, TenCTV: 'CTV' + ctv, DonGiaThietKe: dg });
  const kq = ctxP.f([L(1, 'DH1', '2026-10-05', 1, 500000), L(2, 'DH2', '2026-10-20', 1, 500000), L(3, 'DH3', '2026-11-02', 2, 300000), L(4, 'DH4', '2026-11-10', 1, 500000)],
    { 1: 'MR01, MR02', 2: 'mr01', 3: 'MR02', 4: '' });
  kiem('DH1 co 2 ma rap -> 2 dong x 500k; DH2 dung lai MR01 (khac hoa/thuong) -> trung, DaTinhO DH1, 0 d', kq.tinh.length === 2 && kq.tinh.every(x => x.MaDH === 'DH1' && x.ThanhTien === 500000)
    && kq.trung.length === 2 && kq.trung[0].MaDH === 'DH2' && kq.trung[0].DaTinhO === 'DH1' && kq.trung[0].ThanhTien === 0, { tinh: kq.tinh.map(x => x.MaRap), trung: kq.trung.map(x => x.MaDH + ':' + x.MaRap) });
  kiem('DH3 (CTV khac) dung lai MR02 -> KHONG tinh (moi ma rap mot lan TOAN HE THONG, tra cho CTV cua lenh dau)', kq.trung.some(x => x.MaDH === 'DH3' && x.DaTinhO === 'DH1') && !kq.tinh.some(x => x.MaDH === 'DH3'));
  kiem('DH4 chua co ma rap -> chuaCoMaRap, khong tinh', kq.chuaCoMaRap.length === 1 && kq.chuaCoMaRap[0].MaDH === 'DH4');
  kiem('v9.72: /luongctv tra Anh (utils/anhLenhSX.COT_ANH_LENH — cung cong thuc voi san luong theo lenh)', /require\('\.\.\/utils\/anhLenhSX'\)/.test(p) && /\$\{COT_ANH_LENH\('d'\)\}/.test(p));
  const fp = boComment(doc('frontend', 'js', 'module.payroll.js'));
  kiem('v9.72: bang Luong CTV co cot Anh (anhCTVHtml, thumb anhNho)', /function anhCTVHtml\(url\)/.test(fp) && /anhCTVHtml\(r\.Anh\)/.test(fp));
  kiem('module.payroll: tab luongctv + renderLuongCTV (cot Ma rap, bang trung, bang chua co ma rap) + in', /key: 'luongctv', label: 'Lương CTV thiết kế'/.test(fp) && /if \(activeTab === 'luongctv'\) return renderLuongCTV\(\);/.test(fp) && /async function renderLuongCTV\(\)/.test(fp) && /\/api\/payroll\/luongctv\?nam=/.test(fp)
    && /Chi tiết theo mã rập/.test(fp) && /d\.trung \|\| \[\]/.test(fp) && /d\.chuaCoMaRap \|\| \[\]/.test(fp) && /num\(r\.SoMaRap\)/.test(fp));

  console.log('\n=== 6. v9.71 user khong mat khau -> bat doi lan dau ===');
  const mg7 = doc('database', 'migration_v897.sql');
  kiem('migration_v897: Users.PhaiDoiMatKhau BIT DEFAULT 0', /ALTER TABLE Users ADD PhaiDoiMatKhau BIT NOT NULL CONSTRAINT DF_Users_PhaiDoiMatKhau DEFAULT 0/.test(mg7));
  const us = boComment(doc('backend', 'routes', 'users.js'));
  kiem('users.js POST: khong bat buoc password; trong -> hash(username) + PhaiDoiMatKhau=1 (co cot); chua migration -> 400; tra matKhauTam',
    /if \(!username \|\| !hoTen\) \{/.test(us) && /const khongCoMatKhau = !password;/.test(us) && /bcrypt\.hash\(khongCoMatKhau \? tenDN : password, 10\)/.test(us)
    && /if \(khongCoMatKhau && !coCoBatDoi\) return res\.status\(400\)/.test(us) && /\.input\('PhaiDoi', sql\.Bit, khongCoMatKhau \? 1 : 0\)/.test(us) && /matKhauTam: khongCoMatKhau \? tenDN : null/.test(us));
  const au = boComment(doc('backend', 'routes', 'auth.js'));
  kiem('auth.js change-password: chan trung ten dang nhap; ha co PhaiDoiMatKhau=0 (co cot) + ha co trong phien', /không được trùng tên đăng nhập/.test(au) && /PhaiDoiMatKhau=0/.test(au) && /req\.session\.user\.phaiDoiMatKhau = false;/.test(au));
  const luc = boComment(doc('backend', 'utils', 'loadUserContext.js'));
  kiem('loadUserContext: doc PhaiDoiMatKhau rieng trong try/catch, tra phaiDoiMatKhau TRUOC myPayTuDong (giu moc v9.59)', /SELECT PhaiDoiMatKhau FROM Users WHERE UserID = @UserID/.test(luc) && /phaiDoiMatKhau,[^\n]*\n\s*myPayTuDong[^\n]*\n\s*\};/.test(luc));
  const app = boComment(doc('frontend', 'js', 'app.js'));
  kiem('app.js: phaiDoiMatKhau -> chan toan man hinh (form #cpFormLanDau, return truoc khi ve menu), doi xong reload', /if \(currentUser\.phaiDoiMatKhau\) \{/.test(app) && /id="cpFormLanDau"/.test(app) && /window\.location\.reload\(\)/.test(app) && app.indexOf('if (currentUser.phaiDoiMatKhau) {') < app.indexOf('initMobileNav();'));
  const mu = boComment(doc('frontend', 'js', 'module.users.js'));
  kiem('module.users: o mat khau khong required khi tao; toast mat khau tam', !/name="password" required/.test(mu) && /r\.data\.matKhauTam/.test(mu));
  const html71 = doc('frontend', 'index.html');
  ['app.js', 'module.users.js', 'module.payroll.js'].forEach(f => { const v = new RegExp('/' + f.replace('.', '\\.') + '\\?v=([\\d.]+)').exec(html71); kiem('index.html ' + f + ' ?v>=9.71', !!v && parseFloat(v[1]) >= 9.71, v && v[1]); });
  const html = doc('frontend', 'index.html');
  ['module.qlsx.js', 'module.payroll.js', 'module.danhmuc.js', 'module.mypay.js'].forEach(f => {
    const v = new RegExp(f.replace('.', '\\.') + '\\?v=([\\d.]+)').exec(html);
    kiem('index.html ' + f + ' ?v>=9.70', !!v && parseFloat(v[1]) >= 9.70, v && v[1]);
  });

  clearTimeout(canhGac);
  console.log(`\n=== KET QUA: ${dat} dat, ${sai} sai ===`);
  process.exit(sai ? 1 : 0);
})().catch(e => { console.error('VO: ' + (e && e.stack || e)); process.exit(1); });
