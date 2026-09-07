/* ================================================================================================
   KIEM CHUNG v7.72 — NGAY yyyy-mm-dd PHAI THEO GIO VIET NAM, KHONG QUA UTC
   ------------------------------------------------------------------------------------------------
   Nguyen bao: "Dashboard kinh doanh xem thang nay dang lay tu 31 thang truoc. Vi du Thang 9 lay tu
   31-8."

   NGUYEN NHAN: `new Date(2026, 8, 1)` la 1/9 luc 00:00 GIO VN. `toISOString()` doi sang UTC (VN =
   UTC+7) thanh 2026-08-31T17:00Z -> cat 10 ky tu dau ra "2026-08-31".
   Cung loi do o ~21 cho khac dung cho "hom nay": tu 00:00 den 06:59 gio VN, UTC van la NGAY HOM QUA
   -> moi o Ngay mac dinh (phieu nhap/xuat/thu/chi/tien do...) bi LUI 1 NGAY, khong bao gi ca.

   ⚠️ HAI NHOM NGUOC CHIEU NHAU (muc 5 duoi ep dung nguyen tac nay):
     NHOM A — moc thoi gian tinh tu `new Date()` cua may  -> PHAI dung ngayISO() (gio may).
     NHOM B — dinh dang lai gia tri DOC TU CSDL           -> PHAI giu toISOString(), vi `mssql` mac
              dinh `useUTC = true` nen DATETIME luu "20:00 gio VN" thanh Date co UTC = 20:00Z;
              lay theo gio may (+7) se lech sang ngay hom sau.

   Test CHAY THAT ca hai ban (backend util + ban song sinh trong frontend/js/common.js) voi
   TZ=Asia/Ho_Chi_Minh, va CHUNG MINH ban cu sai.

   Chay:  TZ=Asia/Ho_Chi_Minh node utils/kiem_ngay_theo_gio_vn.js
   ================================================================================================ */
process.env.TZ = process.env.TZ || 'Asia/Ho_Chi_Minh';

const fs = require('fs');
const path = require('path');
const G = path.join(__dirname, '..');
const doc = (p) => fs.readFileSync(path.join(G, p), 'utf8');

let dat = 0, truot = 0;
const OK = (m) => { dat++; console.log('  OK   ' + m); };
const NO = (m) => { truot++; console.log('  SAI  ' + m); };
const kiem = (dk, m, them) => (dk ? OK(m) : NO(m + (them ? '  -> ' + them : '')));
const bang = (thuc, mong, m) => kiem(JSON.stringify(thuc) === JSON.stringify(mong), `${m}  [duoc: ${JSON.stringify(thuc)}]`);
const bo = (s) => String(s).replace(/image\/\*/g, 'image_ALL')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const B = require('./ngayISO');
const sCommon = doc('../frontend/js/common.js');
const sDash = doc('../frontend/js/module.dashboard.js');
const sDms = doc('routes/dms.js');
const sPayroll = doc('routes/payroll.js');
const sIndex = doc('../frontend/index.html');

/* Mui gio thuc te dang chay — moi phep so sanh duoi day gia dinh UTC+7. */
const lech = -new Date(2026, 8, 1).getTimezoneOffset() / 60;
console.log(`\n(mui gio dang chay: UTC${lech >= 0 ? '+' : ''}${lech})`);

console.log('\n=== 1. CHAY THAT util backend: dung ngay theo gio may ===');
bang(B.ngayISO(new Date(2026, 8, 1)), '2026-09-01',
  'DAU THANG 9 -> 2026-09-01 (day la loi Nguyen bao: truoc ra 2026-08-31)');
bang(B.ngayISO(new Date(2026, 8, 5, 6, 0, 0)), '2026-09-05',
  '05/09 luc 06:00 SANG -> dung ngay 05 (truoc bi lui ve 04)');
bang(B.ngayISO(new Date(2026, 8, 5, 0, 0, 0)), '2026-09-05', '05/09 luc 00:00 -> dung ngay 05');
bang(B.ngayISO(new Date(2026, 8, 5, 23, 59, 59)), '2026-09-05', '05/09 luc 23:59 -> van ngay 05');
bang(B.ngayISO(new Date(2026, 0, 1)), '2026-01-01', 'dau nam: 01/01 -> 2026-01-01');
bang(B.ngayISO(new Date(2025, 11, 31, 22, 0, 0)), '2025-12-31', 'cuoi nam 31/12 22:00 -> giu 2025-12-31');
bang(B.ngayISO(new Date(2024, 1, 29)), '2024-02-29', 'nam nhuan 29/02 doc dung');
bang(B.ngayISO('2026-03-07'), '2026-03-07', 'nhan ca chuoi ngay');

console.log('\n=== 2. CHUNG MINH ban cu SAI (de sau nay khong ai "toi uu" quay lai) ===');
if (lech === 7) {
  bang(new Date(2026, 8, 1).toISOString().slice(0, 10), '2026-08-31',
    'ban cu (toISOString) cho dau thang 9 ra 2026-08-31 — SAI, dung nhu bao loi');
  bang(new Date(2026, 8, 5, 6, 0, 0).toISOString().slice(0, 10), '2026-09-04',
    'ban cu cho 05/09 06:00 ra 2026-09-04 — SAI, lui 1 ngay');
  kiem(B.ngayISO(new Date(2026, 8, 1)) !== new Date(2026, 8, 1).toISOString().slice(0, 10),
    'hai ban CHO KET QUA KHAC NHAU o dau thang -> loi la thuc, khong phai tuong tuong');
  bang(new Date(2026, 8, 5, 9, 0, 0).toISOString().slice(0, 10), '2026-09-05',
    'sau 07:00 sang thi ban cu tinh cờ dung -> vi sao loi kho phat hien');
} else {
  console.log(`  (bo qua: may dang chay UTC${lech >= 0 ? '+' : ''}${lech}, khong phai +7 nen khong tai hien duoc)`);
}

console.log('\n=== 3. homNayISO / ngayTruocISO ===');
const n = new Date();
bang(B.homNayISO(), `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`,
  'homNayISO = ngay tren dong ho may (tinh lai doc lap)');
bang(B.ngayTruocISO(0), B.homNayISO(), '0 ngay truoc = hom nay');
/* Tinh lai doc lap: lui N ngay bang moc thoi gian, roi so. */
[1, 7, 29, 30, 365].forEach(k => {
  const d = new Date();
  d.setDate(d.getDate() - k);
  bang(B.ngayTruocISO(k), B.ngayISO(d), `${k} ngay truoc khop voi phep tru doc lap`);
});
bang(B.ngayTruocISO('29'), B.ngayTruocISO(29), 'nhan ca chuoi so');

console.log('\n=== 4. Truong hop bien: khong nem loi, khong tra rac ===');
bang(B.ngayISO(''), '', 'chuoi rong -> ""');
bang(B.ngayISO(null), '', 'null -> ""');
bang(B.ngayISO(undefined), '', 'undefined -> ""');
bang(B.ngayISO('abc'), '', 'chuoi khong phai ngay -> "" (khong ra NaN-NaN-NaN)');
bang(B.ngayISO(new Date('x')), '', 'Date khong hop le -> ""');

console.log('\n=== 5. Ban SONG SINH o frontend/js/common.js cho ra Y HET ===');
/* Cat 2 ham ra chay that — khong grep chuoi, vi phai chac ca hai ben cung cong thuc. */
function catHam(src, moc) {
  const i = src.indexOf(moc);
  if (i < 0) return '';
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); }
  }
  return '';
}
const hamFe = catHam(sCommon, 'function ngayISO(d) {') + '\n' + catHam(sCommon, 'function homNayISO() {');
kiem(hamFe.indexOf('function ngayISO') === 0 && /homNayISO/.test(hamFe), 'cat duoc 2 ham cua common.js');
const FE = new Function(hamFe + '\nreturn { ngayISO, homNayISO };')();
[
  new Date(2026, 8, 1), new Date(2026, 8, 5, 6, 0), new Date(2026, 0, 1),
  new Date(2025, 11, 31, 22, 0), new Date(2024, 1, 29)
].forEach(d => bang(FE.ngayISO(d), B.ngayISO(d), `FE va BE cung ket qua cho ${d.toString().slice(0, 15)}`));
bang(FE.ngayISO('abc'), '', 'ban FE cung tra "" khi khong phai ngay');
bang(FE.homNayISO(), B.homNayISO(), 'homNayISO hai ben giong nhau');

console.log('\n=== 6. Ma nguon: khong con NHOM A dung toISOString ===');
const nhomA = /new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/;
['../frontend/js/common.js', '../frontend/js/module.dashboard.js', '../frontend/js/module.congno.js',
  '../frontend/js/module.khovai.js', '../frontend/js/module.phukien.js', '../frontend/js/module.qlsx.js',
  '../frontend/js/module.dms.js', '../frontend/js/module.nhapkho.js', '../frontend/js/module.nhaplai.js',
  '../frontend/js/module.khohang.js', '../frontend/js/module.bangkebtp.js',
  '../frontend/js/module.tailieukythuat.js', 'routes/dms.js'
].forEach(f => kiem(!nhomA.test(bo(doc(f))), `${f.replace('../frontend/js/', '')}: khong con "new Date().toISOString().slice(0, 10)"`));
kiem(/return \{ tu: ngayISO\(dau\), den: ngayISO\(n\) \};/.test(sDash),
  'dashboard: ky mac dinh dung ngayISO (dau thang khong con lui 1 ngay)');
kiem(!/const iso = \(d\) => d\.toISOString\(\)/.test(sDash), 'dashboard: bo ban iso() tu viet bang toISOString');
kiem(/dat\(`\$\{n\.getFullYear\(\)\}-01-01`, ngayISO\(n\)\)/.test(sDash), 'dashboard: nut "Nam nay" cung sua');
kiem(/require\(['"]\.\.\/utils\/ngayISO['"]\)/.test(sDms), 'dms.js nap util ngayISO');
kiem(/ngayTruocISO\(29\)/.test(sDms), 'dms.js: "30 ngay gan nhat" dung ngayTruocISO(29)');
kiem((bo(sDms).match(/homNayISO\(\)/g) || []).length === 3, 'dms.js: 3 cho "hom nay" da doi',
  String((bo(sDms).match(/homNayISO\(\)/g) || []).length));
kiem(/function homNayISO\(\)/.test(sCommon) && /function ngayISO\(d\)/.test(sCommon),
  'common.js co 2 ham dung chung cho toan bo frontend');

console.log('\n=== 7. NHOM B phai GIU NGUYEN toISOString (nguoc chieu — dung "sua cho dong bo") ===');
kiem(/new Date\(d\.ThoiGianVao\)\.toISOString\(\)\.slice\(0, 10\)/.test(sDms),
  'dms.js: gio check-in DOC TU CSDL van dung toISOString (mssql useUTC=true)');
kiem(/a\.Ngay\.toISOString\(\)\.slice\(0, 10\)/.test(sPayroll),
  'payroll.js: ngay cham cong doc tu CSDL van dung toISOString');
kiem(/KHÔNG DÙNG HÀM NÀY CHO GIÁ TRỊ ĐỌC TỪ CSDL/.test(doc('utils/ngayISO.js')),
  'util co canh bao ro ve 2 nhom nguoc chieu (khoi bi "toi uu" sai lan sau)');
kiem(/useUTC/.test(doc('utils/ngayISO.js')), 'va noi ro ly do: mssql useUTC = true');

console.log('\n=== 8. Bump ?v= ===');
['common.js', 'module.dashboard.js', 'module.congno.js', 'module.khovai.js', 'module.phukien.js',
  'module.qlsx.js', 'module.dms.js', 'module.nhapkho.js', 'module.nhaplai.js', 'module.khohang.js',
  'module.bangkebtp.js', 'module.tailieukythuat.js'
].forEach(f => {
  const v = (sIndex.match(new RegExp(f.replace(/\./g, '\\.') + '\\?v=([\\d.]+)')) || [])[1];
  kiem(v && parseFloat(v) >= 7.72, `index.html: ${f}?v= >= 7.72`, String(v));
});

console.log('\n================================================================');
console.log(`KET QUA: ${dat} dat / ${truot} truot`);
process.exit(truot ? 1 : 0);
