/* ================================================================================================
   KIEM CHUNG v8.79 — LENH CO 1 SO DO VAN PHAI HIEN O CHON SO DO ANH
   ------------------------------------------------------------------------------------------------
   Nguyen bao 2026-10-10: "cap nhat lenh sx co 1 so do, cong doan cat khong hien so do len; them 1
   so do nua vao moi hien".

   Goc: module.qlsx.js co `if (soDoList.length > 1) renderCatMultiSoDo(box) else <form phang>`, va o
   nhanh form phang so do duy nhat bi nhet vao <input type="hidden"> — du lieu luu DUNG nhung nguoi
   dung khong nhin thay gi. Day la hanh vi CO Y tu v5.16, nay bo.

   🔴 LOI NANG HON di kem (khong ai bao, chi lo ra khi doc code):
   Nhanh form phang KHONG loc so do da co so cat (v6.17 chi lam cho nhanh multi), ma
   effectiveTienDoIds() nhanh CAT chi lay MAX(TienDoID) cho MOI SoDoID. Nen lenh 1 so do ghi so cat
   LAN HAI se DE LAN DAU — khong cong don, khong canh bao. Doi sang nhanh multi la het, vi so do da
   cat bi loc khoi o chon.

   Chay:  node utils/kiem_cat_mot_so_do.js
   ================================================================================================ */
const fs = require('fs');
const path = require('path');

const G = path.join(__dirname, '..');
const doc = (p) => fs.readFileSync(path.join(G, p), 'utf8');

let dat = 0, truot = 0;
const OK = (m) => { dat++; console.log('  OK   ' + m); };
const NO = (m) => { truot++; console.log('  SAI  ' + m); };
const kiem = (dk, m, them) => (dk ? OK(m) : NO(m + (them ? '  -> ' + them : '')));

const sFe = doc('../frontend/js/module.qlsx.js');
const sBe = doc('routes/qlsx.js');
const sIndex = doc('../frontend/index.html');

console.log('\n=== 1. Nhanh CAT: 1 so do cung di duong multi ===');
kiem(/if \(soDoList\.length >= 1\) \{\s*\n\s*renderCatMultiSoDo\(box\);/.test(sFe),
  'dieu kien la `soDoList.length >= 1` (khong con `> 1`)');
kiem(!/if \(soDoList\.length > 1\) \{/.test(sFe),
  'KHONG con dieu kien `soDoList.length > 1` nao o nhanh CAT');
kiem(!/soDoHiddenHtml/.test(sFe),
  'DA BO input hidden giau so do (nguon goc cua "khong hien so do len")');
kiem(!/name="soDoId" value=/.test(sFe),
  'khong con cho nao nhet soDoId vao input an');

console.log('\n=== 2. Nhanh multi van du co che chong ghi de ===');
const khoiMulti = sFe.slice(sFe.indexOf('async function renderCatMultiSoDo'),
  sFe.indexOf('async function renderCatMultiSoDo') + 9000);
kiem(/soDoConLai = soDoList\.filter\(s => !daLuu\.has\(String\(s\.ID\)\)\)/.test(khoiMulti),
  'loc bo so do DA CO so cat khoi o chon (v6.17) — day la thu chong ghi de am tham');
kiem(/socat\?tatCa=1/.test(khoiMulti), 'doc danh sach so cat da ghi de biet so do nao da luu');
kiem(/box\.__getCatGroupsForSubmit/.test(khoiMulti),
  'submit di nhanh catGroups (backend ho tro tu v5.16, 1 phan tu van chay)');
kiem(/soDoList\.length === 1 \? 'Sơ đồ của lệnh này ĐÃ CÓ SỔ CẮT'/.test(sFe),
  'cau chu "da cat het" doc duoc ca khi chi co 1 so do');

console.log('\n=== 3. Backend KHONG doi — chi la hien thi ===');
kiem(/SELECT \* FROM DonHangChiTietSoDo WHERE DonHangID = @id ORDER BY ID/.test(sBe),
  'getSoDoList() khong loc theo so luong (backend von da tra du 1 so do)');
kiem(/t\.SoDoID IS NULL\s*\n?\s*OR t\.TienDoID = \(SELECT MAX\(t2\.TienDoID\)/.test(sBe),
  'effectiveTienDoIds nhanh CAT van lay MAX theo tung SoDoID (khong dong vao)');

console.log('\n=== 4. Bump ?v= (sua file JS da deploy ma quen bump = chay ban cu trong cache) ===');
const v = parseFloat((sIndex.match(/module\.qlsx\.js\?v=([\d.]+)/) || [])[1] || '0');
kiem(v >= 8.79, `index.html bump module.qlsx.js?v= len >= 8.79 (dang la ${v})`);

/* ------------------------------------------------------------------------------------------------
   GHI CHU — VIEC CHUA LAM, CO Y de lai
   ------------------------------------------------------------------------------------------------
   routes/qlsx.js: `o.ConPhaiCat = soSoDo >= 2 && daCat < soSoDo;`
   Luoi an toan v5.99 cho to Cat chi bat dau tu 2 so do. Lenh 1 so do chua cat ma con tro cong doan
   da bi day di (ep cong doan thu cong) thi to Cat KHONG thay don do nua. Hiem, va sua no doi hanh vi
   danh sach don — de rieng, khong gop vao ban nay. */
const dongConPhaiCat = (sBe.match(/o\.ConPhaiCat = soSoDo >= \d+ && daCat < soSoDo;/) || [])[0];
console.log('\n--- Ghi chu (khong tinh dat/truot) ---');
console.log('  routes/qlsx.js: ' + (dongConPhaiCat || '(khong tim thay dong ConPhaiCat)'));
console.log('  -> van la >= 2: lenh 1 so do chua cat ma con tro da di qua thi to Cat khong thay don.');

console.log(`\n${'='.repeat(70)}\nKET QUA: ${dat} dat / ${truot} sai\n${'='.repeat(70)}`);
process.exit(truot ? 1 : 0);
