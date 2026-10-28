/* ================================================================================================
   KIEM CHUNG v9.07 — TON KHO VAI: NUT TAI ANH THEO LOC DANG HIEN
   ------------------------------------------------------------------------------------------------
   Nguyen 2026-10-27: "ton kho vai them nut tai anh ve theo loc hien tren man hinh" — "giong nhu
   nut tai anh mau con ton cua the kho hang hoa".

   KHAC BIET duy nhat so voi nut cua the kho hang hoa (chuoi v8.16→v8.23): bo loc cua man Ton kho
   vai la O TIM chay o trinh duyet (an/hien dong) nen danh sach anh lay TU CAC DONG DANG HIEN roi
   gui len bang POST; server chi kiem an toan tung link va dong goi .zip.

   BON CHO DE SAI, moi cho mot nhom phep kiem:
     1. POST bi requireChucNang suy thanh 'edit' => nguoi chi-co-quyen-XEM bi 403 oan. Route phai
        TU kiem canView cua KHOVAI:dashboard, khong dung requireChucNang.
     2. Pipe zip truoc khi biet co file that => danh sach rong tra ve zip rong/response dang do.
        Phai KIEM + GOM truoc, pipe sau.
     3. Link rac (khong /uploads/) va path traversal — mot tieu chi duy nhat voi route zip cua
        khohang (v8.17/v8.22).
     4. Ban sao Web Share lech cong thuc voi ban goc khohang (sua mot ben quen ben kia).

   Chay:  node backend\utils\kiem_tai_anh_ton_vai.js   (tu thu muc goc QLNoiBo)
   ================================================================================================ */
const fs = require('fs');
const path = require('path');
const G = path.join(__dirname, '..');
const doc = (p) => fs.readFileSync(path.join(G, p), 'utf8');

let dat = 0, truot = 0;
const OK = (m) => { dat++; console.log('  OK   ' + m); };
const NO = (m) => { truot++; console.log('  SAI  ' + m); };
const kiem = (dk, m) => (dk ? OK(m) : NO(m));

// Bo comment truoc khi kiem "KHONG duoc chua X" (dau mo comment chi tinh sau ky tu mo hop le).
const boComment = (s) => s
  .replace(/(^|[\s{(:;,=])\/\*[\s\S]*?\*\//g, '$1 ')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

const sBE = doc('routes/khovai.js');
const sFE = doc('../frontend/js/module.khovai.js');
const sKH = doc('../frontend/js/module.khohang.js');
const sIndex = doc('../frontend/index.html');
const mBE = boComment(sBE);
const mFE = boComment(sFE);

console.log('\n=== 0. Hai file PHAI parse duoc (vm.Script — thay node --check) ===');
[['routes/khovai.js', sBE], ['module.khovai.js', sFE]].forEach(([ten, src]) => {
  try { new (require('vm').Script)(src, { filename: ten }); OK(ten + ' parse duoc'); }
  catch (e) { NO(ten + ' KHONG parse duoc: ' + e.message); }
});

console.log('\n=== 1. Backend: route POST /rolls/anh.zip ===');
const iR = mBE.indexOf("router.post('/rolls/anh.zip'");
kiem(iR >= 0, 'co route POST /rolls/anh.zip');
/* iR >= 0 BAT BUOC o day: route bien mat thi indexOf(-1) quet tu dau file va van ra so duong —
   phep nay se OK oan trong khi rZip rong (ra cheo v9.07 chi ra). */
const iRHet = iR >= 0 ? mBE.indexOf('\n});', mBE.indexOf('finalize', iR)) : -1;
kiem(iR >= 0 && iRHet > iR, 'cat duoc dung than route');
const rZip = iR >= 0 && iRHet > iR ? mBE.slice(iR, iRHet + 4) : '';
kiem(/requirePermission\('KHOVAI', 'view'\)/.test(rZip), 'gate cap phan he: KHOVAI/view');
kiem(!/requireChucNang\(/.test(rZip),
  'KHONG dung requireChucNang — POST bi suy thanh edit, nguoi chi-co-quyen-XEM se 403 oan');
kiem(/chucNangPerm\['KHOVAI:rolls'\]/.test(rZip) && /canView === false/.test(rZip),
  'tu kiem canView cua chuc nang rolls — DUNG tab Ton theo cay (khong phai dashboard)');
kiem(/require\('archiver'\)/.test(rZip) && rZip.indexOf("require('archiver')") > rZip.indexOf('async (req, res)'),
  'require(archiver) nam TRONG handler — thieu thu vien chi hong route nay, khong sap server');
kiem(/indexOf\('\/uploads\/'\) !== 0/.test(rZip), 'chi nhan link /uploads/ (chan link rac — bai hoc v8.22)');
kiem(/path\.basename\(/.test(rZip), 'path.basename lay dung ten file');
/* basename KHONG chan '..' ('/uploads/..' -> '..' -> join ra thu muc backend, existsSync van true,
   archiver nhan thu muc la no giua stream) — phai co whitelist ky tu + bat buoc la FILE that. */
kiem(/\^\[A-Za-z0-9_\\-\.\]\+\$/.test(rZip) || /\^\[A-Za-z0-9_\\\-\.\]\+\$/.test(rZip) || rZip.indexOf('/^[A-Za-z0-9_\\-.]+$/') >= 0,
  'whitelist ky tu ten file (chan ca .. va ten ky di)');
kiem(/isFile\(\)/.test(rZip), 'bat buoc la FILE that (statSync.isFile) — khong nen nham thu muc');
kiem(/> 800/.test(rZip), 'gioi han 800 muc mot lan');
/* Thu tu: setHeader zip phai o SAU buoc gom dsNen (kiem truoc, pipe sau). */
const iGom = rZip.indexOf('const dsNen = [];');
const iHdr = rZip.indexOf("setHeader('Content-Type', 'application/zip')");
kiem(iGom >= 0 && iHdr > iGom, 'KIEM + GOM truoc, set header zip SAU — danh sach rong tra JSON 400 tu te');
kiem(/if \(!dsNen\.length\) return res\.status\(400\)/.test(rZip), 'dsNen rong => 400 JSON, khong zip rong');

console.log('\n=== 2. Frontend: nut o tab TON THEO CAY + thu thap theo danh sach dang hien ===');
kiem(/id="kvTaiAnhCay"/.test(mFE), 'co nut 📥 Tai anh theo loc trong toolbar tab Ton theo cay');
/* Nut phai nam trong renderRolls, KHONG con dau vet o renderDashboard (Nguyen chot lai vi tri). */
const iRolls = mFE.indexOf('async function renderRolls');
const iDash = mFE.indexOf('async function renderDashboard');
kiem(iRolls >= 0 && iDash >= 0 && mFE.indexOf('kvTaiAnhCay') > iRolls,
  'nut nam trong renderRolls (tab Ton theo cay)');
kiem(iDash >= 0 && !mFE.slice(iDash, iRolls > iDash ? iRolls : mFE.length).includes('kvTaiAnh'),
  'renderDashboard (tab Ton kho) KHONG con nut tai anh nao');
/* O tim #fSearch VE LAI tbody tu mang loc — nut phai doc tu bien dangHien, va fSearch phai gan lai
   bien do moi lan loc; thieu mot trong hai la nut tai theo danh sach CU. */
kiem(/let dangHien = shownRows;/.test(mFE), 'co bien dangHien khoi tao tu shownRows');
kiem(/dangHien = filtered;/.test(mFE), 'handler fSearch gan lai dangHien moi lan loc');
const iH = mFE.indexOf("kvBtnAnh.addEventListener('click'");
kiem(iH >= 0, 'co handler nut');
const iHHet = mFE.indexOf('\n    });', iH);
const hNut = iH >= 0 && iHHet > iH ? mFE.slice(iH, iHHet + 8) : '';
kiem(/dangHien\.forEach\(r => \{/.test(hNut), 'gom anh tu dangHien (dung danh sach dang hien)');
kiem(/String\(r\.MaCay \|\| 'cay'\)/.test(hNut), 'ten file theo MA CAY');
kiem(/indexOf\('\/uploads\/'\) !== 0\) return;/.test(hNut), 'loai link rac ngay o client (cung tieu chi backend)');
/* Khu trung theo CA ten LAN link — khu theo link tran la nhieu ma vai dung chung 1 anh chi con
   ma dau tien trong zip, cac ma sau bien mat khong dau vet (ra cheo v9.07). */
kiem(/const khoa = ten \+ '\|' \+ link;/.test(hNut) && /daCo\.has\(khoa\)/.test(hNut),
  'khu trung theo ten + link (chi gop dong lap that su)');
kiem(/ds\.length > 800/.test(hNut), 'tran CUNG o client khop tran server (800) — chan ngay tai cho');
kiem(/ds\.length > 150 && !confirm/.test(hNut), 'hoi lai khi qua 150 anh (cung nguong voi the kho hang hoa)');
/* try NGOAI phai mo TRUOC phan gom du lieu — co cap try/catch LONG cua nhanh Web Share nen chi
   test "co try" la khong du (ra cheo v9.07). */
kiem(hNut.indexOf('try {') >= 0 && hNut.indexOf('try {') < hNut.indexOf('const daCo'),
  'try NGOAI bao tron ca phan gom du lieu');
kiem(/catch \(err\)/.test(hNut) && /finally \{/.test(hNut)
  && /disabled = false/.test(hNut.slice(hNut.indexOf('finally'))),
  'handler co catch/finally — nut khong bao gio cam hay ket disabled (bai hoc v9.06)');
kiem(/await kvTaiZipVeMay\(ds\)/.test(hNut), 'desktop: tai .zip (co await de loi rot vao catch)');
kiem(/Đã tải xong file anh_ton_theo_cay\.zip/.test(hNut), 'desktop co toast bao XONG (nhanh mobile von co)');

console.log('\n=== 3. Duong tai zip qua POST ===');
const iZ = mFE.indexOf('async function kvTaiZipVeMay');
const fZ = iZ >= 0 ? mFE.slice(iZ, mFE.indexOf('\n  }', iZ) + 4) : '';
kiem(/fetch\('\/api\/khovai\/rolls\/anh\.zip'/.test(fZ), 'goi dung route moi');
kiem(/method: 'POST'/.test(fZ) && /credentials: 'include'/.test(fZ), 'POST + mang phien dang nhap');
kiem(/if \(!res\.ok\)/.test(fZ) && /throw new Error\(msg\)/.test(fZ),
  'loi server duoc doc ra va nem len handler (khong nut cam)');
kiem(/a\.download = 'anh_ton_theo_cay\.zip'/.test(fZ), 'tai ve bang the a download tu blob');
kiem(/revokeObjectURL/.test(fZ), 'thu don objectURL sau khi tai');

console.log('\n=== 4. Ban sao Web Share phai GIONG CONG THUC ban goc khohang ===');
/* Sua mot ben quen ben kia la hai nut lech hanh vi — kiem cac BAT BIEN cot loi co mat o CA HAI file. */
const capBatBien = [
  [/\\\.\[a-zA-Z0-9\]\+\(\$\|\\\?\)/, 'regex duoi file .ext($|?)'],
  [/setTimeout\(res, 400\)/, 'gian cach 400ms khi tai tung anh'],
  [/err\.name === 'AbortError'/, 'AbortError = nguoi dung tu Huy, khong phai loi'],
  [/navigator\.canShare\(\{ files \}\)/, 'kiem canShare voi CA danh sach files'],
  [/await Promise\.all\(ds\.map\(/, 'dung TAT CA File roi share 1 lan (khong chia lo — bai hoc v8.23)']
];
capBatBien.forEach(([re, nhan]) => {
  kiem(re.test(sFE) && re.test(sKH), `ca khovai LAN khohang deu co: ${nhan}`);
});
kiem((mFE.match(/navigator\.share\(\{/g) || []).length === 1,
  'khovai goi navigator.share dung MOT cho (mot lan cho ca danh sach)');

console.log('\n=== 5. index.html ===');
const v = parseFloat((sIndex.match(/module\.khovai\.js\?v=([\d.]+)/) || [])[1] || 0);
kiem(v >= 9.07, `module.khovai.js?v= >= 9.07  [duoc: ${v}]`);
kiem((sIndex.match(/module\.khovai\.js\?v=/g) || []).length === 1, 'index.html co DUNG MOT the module.khovai.js');

console.log(`\n=== KET QUA: ${dat} dat, ${truot} sai ===`);
process.exit(truot ? 1 : 0);
