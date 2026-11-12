/* ================================================================================================
   kiem_bangke_size_tu_dai.js  —  bo tu kiem cho v9.14
   "Bang ke BTP: lenh khong co Thong so do thi cot size lay tu DAI SIZE (2-7 -> 2..7), khong roi
    thang ve S/M/L nua."

   Chay:  node backend\utils\kiem_bangke_size_tu_dai.js
   KHONG copy file nay sang D:\QLSX.
   ================================================================================================ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const GOC = path.join(__dirname, '..', '..');
const F = { be: 'backend/routes/bangke.js', fe: 'frontend/js/module.bangkebtp.js', html: 'frontend/index.html' };
let sai = 0, dat = 0;
const src = {};
function kiem(ten, dung, td) {
  if (dung) { dat++; console.log('  ✓ ' + ten); }
  else { sai++; console.log('  ❌ ' + ten + (td ? ' — ' + td : '')); }
}

console.log('\n=== 1. BIEN DICH (thay cho node --check) ===');
['be', 'fe'].forEach(k => {
  src[k] = fs.readFileSync(path.join(GOC, F[k]), 'utf8');
  try { new vm.Script(src[k], { filename: F[k] }); dat++; console.log('  ✓ ' + F[k]); }
  catch (e) { sai++; console.log('  ❌ ' + F[k] + ' VO CU PHAP: ' + e.message); }
});
src.html = fs.readFileSync(path.join(GOC, F.html), 'utf8');

console.log('\n=== 2. KIEM HANH VI noDaiThanhSize (trich ham, chay that) ===');
function trichHam(nguon, ten) {
  const i = nguon.indexOf('function ' + ten + '(');
  if (i < 0) return null;
  let mo = 0, j = nguon.indexOf('{', i);
  if (j < 0) return null;
  for (; j < nguon.length; j++) {
    if (nguon[j] === '{') mo++;
    else if (nguon[j] === '}') { mo--; if (mo === 0) return nguon.slice(i, j + 1); }
  }
  return null;
}
const than = trichHam(src.be, 'noDaiThanhSize');
kiem('tim thay noDaiThanhSize', !!than);
if (than) {
  let fn = null;
  try { const s = {}; vm.runInNewContext(than + '; __r = noDaiThanhSize;', s); fn = s.__r; }
  catch (e) { sai++; console.log('  ❌ khong nap duoc noDaiThanhSize: ' + e.message); }
  if (fn) {
    const CA = [
      ['"2-7" no thanh 6 size', () => JSON.stringify(fn('2-7')) === JSON.stringify(['2', '3', '4', '5', '6', '7'])],
      ['"8-12" no thanh 5 size', () => JSON.stringify(fn('8-12')) === JSON.stringify(['8', '9', '10', '11', '12'])],
      ['co khoang trang " 2 - 7 " van nhan', () => JSON.stringify(fn(' 2 - 7 ')) === JSON.stringify(['2', '3', '4', '5', '6', '7'])],
      ['ten chu "XS-XL" tra null (lui ve S/M/L)', () => fn('XS-XL') === null],
      ['nguoc chieu "7-2" tra null', () => fn('7-2') === null],
      ['bang nhau "5-5" tra null', () => fn('5-5') === null],
      ['qua dai "1-99" tra null (chan bia 99 cot)', () => fn('1-99') === null],
      ['rong / null tra null', () => fn('') === null && fn(null) === null],
      ['so don "7" (khong phai khoang) tra null', () => fn('7') === null]
    ];
    CA.forEach(([ten, phep]) => { let ok = false; try { ok = phep(); } catch (e) { ok = false; } kiem(ten, ok); });
  }
}

console.log('\n=== 3. NOI DAY ===');
kiem('backend: chi lay tu dai khi Thong so do RONG (TSD van thang)',
     /if \(!sizeCols\.length\) \{[\s\S]{0,400}?DonHangDaiSize/.test(src.be),
     'dai ma de len Thong so do la doi khai bao tuong minh cua lenh');
kiem('backend: MOI dai phai no duoc moi dung (mot dai ten chu => giu nguyen S/M/L)',
     /no\.every\(x => Array\.isArray\(x\) && x\.length\)/.test(src.be));
/* Khong co ve `|| /sizeColsNguon/` du phong — ve do lam phep KHONG BAO GIO do duoc (bo field khoi
   res.json ma bien con trong file van xanh). Ra soat cheo v9.14 bat. */
kiem('backend: tra sizeColsNguon ra ngoai trong res.json',
     /sizeCols, sizeColsNguon \}/.test(src.be.replace(/\s+/g, ' ')));
kiem('backend: doc dai co boc try/catch (may chua chay v859 khong duoc chet man)',
     /catch \(e\) \{ console\.error\('\[bangke\] lấy size từ dải size lỗi/.test(src.be));
kiem('frontend: nhan nut + toast noi dung NGUON (Dai size / Thong so do)',
     /nhanNguonSize/.test(src.fe) && /Dải size \(công đoạn Cắt\)/.test(src.fe));
kiem('frontend: mac dinh S/M/L van con cho lenh khong co nguon nao',
     /\['S', 'M', 'L'\]/.test(src.fe),
     'bo han fallback la lenh khong dai khong TSD mo form ra bang 0 cot');

console.log('\n=== 3a. v9.14c — nguon thu BA: o Size cua lenh (DonHangSanXuat.Size) ===');
kiem('backend: co nhanh no order.Size khi TSD + dai deu rong',
     /noDaiThanhSize\(order\.Size\)/.test(src.be) && /sizeColsNguon = 'size'/.test(src.be),
     'lenh nhu DH2610119 co o Size "2-7" phai tu ra cot 2..7, khong can thao tac gi');
kiem('frontend: co nhan nguon "ô Size của lệnh"',
     /ô Size của lệnh/.test(src.fe));

console.log('\n=== 3b. v9.14b — 100% lay tu Thong so ky thuat ===');
kiem('backend: KHU TRUNG cot size khi lenh co nhieu BAN Thong so do',
     /sizeCols = sizeCols\.filter\(\(s, i\) => sizeCols\.indexOf\(s\) === i\)/.test(src.be),
     'lenh 2 ban cung khai SIZE 2..7 se ra cot trung lap');
kiem('frontend: ban DA LUU lech voi nguon hien tai thi BAO RO + chi duong dong bo',
     /colsLechNguon/.test(src.fe) && /đang <b>KHÁC<\/b>/.test(src.fe),
     'lech ma im lang la nguoi dung tuong he thong khong lay tu thong so ky thuat');

console.log('\n=== 4. index.html ===');
kiem('module.bangkebtp.js da bump ?v=9.14', src.html.includes('module.bangkebtp.js?v=9.14'));

console.log('\n' + '='.repeat(70));
console.log(sai === 0 ? `✅ ${dat} phep DAT, 0 sai` : `❌ ${sai} SAI / ${dat + sai} phep`);
console.log('='.repeat(70) + '\n');
process.exit(sai === 0 ? 0 : 1);
