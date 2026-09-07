/* ================================================================================================
   KIEM CHUNG v7.76 — MOI O NGAY TRONG HE THONG HIEN dd/mm/yyyy
   ------------------------------------------------------------------------------------------------
   Nguyen: "dashboard kinh doanh ngay de dinh dang dd/mm/yyyy" -> "hien tai dang de mm/dd/yyyy"
        -> "co ra het luot lam dong bo".

   NGUYEN NHAN: `<input type="date">` hien theo NGON NGU CUA TRINH DUYET/WINDOWS, khong theo trang
   web. May dat tieng Anh (My) la ra mm/dd/yyyy, KHONG ep duoc bang CSS/thuoc tinh HTML.

   ⚠️ VI SAO KHONG SUA TUNG O: he thong co 62 o `type="date"` o 15 file, trong do 25 o mang `name=`
   (gia tri di qua FormData len API) va 19 o `required`. Doi tung o sang o chu la phai sua moi cho
   `fd.get('ngay')` / `.value` / handler 'change' — sai 1 cho la phieu ghi "07/09/2026" vao cot DATE
   hoac nut Luu im lang khong phan ung.
   CACH LAM: `enhanceONgay()` nang cap TAI CHO — GIU NGUYEN input date lam nguon gia tri (nguyen id,
   name, value, min, max), chi an di va chen them o CHU hien dd/mm/yyyy. Moi code cu chay y nguyen.

   Test dung JSDOM (DOM THAT, khong phai DOM gia) va NAP THAT common.js.

   Chay:  TZ=Asia/Ho_Chi_Minh NODE_PATH=/tmp/tsd/node_modules node utils/kiem_o_ngay_ddmmyyyy.js
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

const sCommon = doc('../frontend/js/common.js');
const sDash = doc('../frontend/js/module.dashboard.js');
const sIndex = doc('../frontend/index.html');

let JSDOM = null;
try { JSDOM = require('jsdom').JSDOM; } catch (e) { /* sandbox chua cai */ }

function catHam(s, moc) {
  const i = s.indexOf(moc);
  if (i < 0) return '';
  let d = 0;
  for (let k = s.indexOf('{', i); k < s.length; k++) {
    if (s[k] === '{') d++;
    else if (s[k] === '}') { d--; if (!d) return s.slice(i, k + 1); }
  }
  return '';
}
const MOC = ['function ngayISO(d) {', 'function ngayVNTuISO(iso) {', 'function isoTuNgayVN(s) {',
  'function enhanceONgay(root) {', 'function enhanceOneONgay(oNgay) {', 'function escapeHtml('];
MOC.forEach(m => kiem(!!catHam(sCommon, m), `cat duoc ${m.replace('function ', '').replace(/ ?\{$/, '')}`));
const than = MOC.map(m => catHam(sCommon, m)).join('\n');

/* ================================================================================================
   1 + 2. Doi qua lai giua ISO va dd/mm/yyyy (chay that, khong can DOM)
   ================================================================================================ */
const F0 = new Function(than.replace(/toast\(/g, 'void(')
  + '\nreturn { ngayVNTuISO, isoTuNgayVN };')();

console.log('\n=== 1. ISO -> dd/mm/yyyy ===');
bang(F0.ngayVNTuISO('2026-09-07'), '07/09/2026', 'doi dung thu tu ngay/thang/nam');
bang(F0.ngayVNTuISO('2026-01-01'), '01/01/2026', 'giu so 0 dang truoc');
bang(F0.ngayVNTuISO('2026-12-31T00:00:00'), '31/12/2026', 'co phan gio o sau van cat dung');
bang(F0.ngayVNTuISO(''), '', 'rong -> ""');
bang(F0.ngayVNTuISO(null), '', 'null -> ""');

console.log('\n=== 2. dd/mm/yyyy -> ISO ===');
bang(F0.isoTuNgayVN('07/09/2026'), '2026-09-07', 'ca thuong');
bang(F0.isoTuNgayVN('7/9/2026'), '2026-09-07', 'go tat khong so 0 dang truoc');
bang(F0.isoTuNgayVN('7/9/26'), '2026-09-07', 'go tat nam 2 chu so -> 20xx');
bang(F0.isoTuNgayVN('07-09-2026'), '2026-09-07', 'dau gach ngang cung nhan');
bang(F0.isoTuNgayVN('29/02/2024'), '2024-02-29', 'nam nhuan: 29/02/2024 HOP LE');
[['31/02/2026', '31 thang 2'], ['32/01/2026', 'ngay 32'], ['07/13/2026', 'thang 13 (go kieu My)'],
  ['29/02/2025', '29/02 nam khong nhuan'], ['00/09/2026', 'ngay 0'], ['abc', 'chu'], ['', 'rong']]
  .forEach(([s, ten]) => bang(F0.isoTuNgayVN(s), '', `${ten} -> "" (khong nhan)`));

/* ================================================================================================
   3. CHAY THAT enhanceONgay tren DOM THAT (jsdom)
   ================================================================================================ */
console.log('\n=== 3. CHAY THAT enhanceONgay tren DOM that (jsdom) ===');
if (!JSDOM) {
  console.log('  (bo qua: chua cai jsdom — chay lai voi NODE_PATH=/tmp/tsd/node_modules)');
} else {
  const dungDom = (htmlBenTrong) => {
    const dom = new JSDOM(`<!doctype html><body><form id="f">${htmlBenTrong}</form></body>`,
      { pretendToBeVisual: true });
    const w = dom.window;
    const baoLoi = [];
    const F = new Function('window', 'document', 'HTMLInputElement', 'MutationObserver', 'Event', 'toast',
      than + '\nreturn { enhanceONgay, enhanceOneONgay, ngayVNTuISO, isoTuNgayVN };')(
        w, w.document, w.HTMLInputElement, w.MutationObserver, w.Event, (m) => baoLoi.push(m));
    return { w, d: w.document, F, baoLoi };
  };

  /* --- 3a. Bọc đúng: giữ nguyên id/name/value, thêm ô chữ + nút --- */
  let { w, d, F, baoLoi } = dungDom('<input type="date" id="ngay1" name="ngay" value="2026-09-07" required>');
  F.enhanceONgay(d.body);
  const oNgay = d.getElementById('ngay1');
  const oChu = d.querySelector('.o-ngay-chu');
  const nut = d.querySelector('.o-ngay-nut');
  kiem(!!oChu && !!nut, 'da chen o CHU va nut 📅');
  bang(oChu.value, '07/09/2026', 'o chu hien dd/mm/yyyy');
  bang(oChu.placeholder, 'dd/mm/yyyy', 'co goi y dinh dang');
  bang(oNgay.value, '2026-09-07', 'input date GIU NGUYEN gia tri ISO');
  bang(oNgay.getAttribute('name'), 'ngay', 'GIU NGUYEN name -> FormData van lay dung');
  bang(oNgay.id, 'ngay1', 'GIU NGUYEN id -> getElementById(...).value van chay');
  kiem(!oChu.getAttribute('name'), 'o chu KHONG co name (khong gui chuoi dd/mm/yyyy len API)');
  /* required phai CHUYEN sang o chu, khong duoc de tren o dang an. */
  kiem(oChu.required === true, 'required chuyen sang o CHU');
  kiem(oNgay.required === false, 'BO required tren o date an (khong thi Chrome chan submit: "not focusable")');
  kiem(/opacity:\s*0/.test(oNgay.getAttribute('style') || ''), 'o date bi an han');
  bang(oNgay.getAttribute('tabindex'), '-1', 'o date an khong nhan tab');

  /* FormData — day la cai de vo nhat khi doi o ngay. */
  const fd = new w.FormData(d.getElementById('f'));
  bang(fd.get('ngay'), '2026-09-07', 'FormData VAN tra ISO (khong phai "07/09/2026")');
  bang([...fd.keys()].filter(k => k === 'ngay').length, 1, 'chi MOT truong "ngay" trong FormData');

  /* --- 3b. Go tay: tu chen dau / --- */
  const go = (o, v, dom) => { o.value = v; o.dispatchEvent(new dom.window.Event('input', { bubbles: true })); };
  go(oChu, '07092026', w); bang(oChu.value, '07/09/2026', 'go 8 so lien -> tu chen 2 dau /');
  go(oChu, '0709', w); bang(oChu.value, '07/09', 'go 4 so -> chen 1 dau /');
  go(oChu, '07', w); bang(oChu.value, '07', 'go 2 so -> chua chen dau');
  go(oChu, '07/09/2026abc', w); bang(oChu.value, '07/09/2026', 'go lan chu -> bo ky tu khong phai so');
  go(oChu, '070920261234', w); bang(oChu.value, '07/09/2026', 'go qua 8 so -> cat');

  /* --- 3c. Roi o: chuan hoa + BAN 'change' tren o date (code cu lang nghe phai nhan) --- */
  ({ w, d, F, baoLoi } = dungDom('<input type="date" id="n2" name="ngay" value="2026-09-01">'));
  F.enhanceONgay(d.body);
  const o2 = d.getElementById('n2'), c2 = d.querySelector('.o-ngay-chu');
  let soChange = 0;
  o2.addEventListener('change', () => soChange++);
  c2.value = '7/9/26';
  c2.dispatchEvent(new w.Event('blur', { bubbles: true }));
  bang([o2.value, c2.value], ['2026-09-07', '07/09/2026'], 'go tat + roi o -> ca hai o dung');
  bang(soChange, 1, "BAN su kien 'change' tren o date -> code cu lang nghe van nhan");

  /* Go sai: TRA LAI gia tri cu, KHONG xoa trang, co bao loi. */
  baoLoi.length = 0; soChange = 0;
  c2.value = '31/02/2026';
  c2.dispatchEvent(new w.Event('blur', { bubbles: true }));
  bang([o2.value, c2.value], ['2026-09-07', '07/09/2026'], 'ngay khong ton tai -> TRA LAI gia tri cu');
  bang(soChange, 0, 'khong ban change vo ich khi go sai');
  kiem(/dd\/mm\/yyyy/.test(baoLoi.join(' ')), 'co bao loi noi ro dang can go', baoLoi.join(' | '));

  /* Co y xoa trang -> cho trong, khong bao loi. */
  baoLoi.length = 0;
  c2.value = '   ';
  c2.dispatchEvent(new w.Event('blur', { bubbles: true }));
  /* O chu duoc DON SACH luon (khong giu lai may dau cach vua go): o date ve rong -> setter .value
     goi veLaiChu() -> o chu = ''. Sach hon la de lai khoang trang vo hinh. */
  bang([o2.value, c2.value], ['', ''], 'CO Y xoa trang -> ca o date lan o chu ve rong (bo loc ngay)');
  bang(baoLoi.length, 0, 'xoa trang co y thi KHONG bao loi');

  /* --- 3d. Code cu gan .value bang JS -> o chu phai theo (nut "Thang nay", nap lai phieu...) --- */
  ({ w, d, F } = dungDom('<input type="date" id="n3" value="2026-09-01">'));
  F.enhanceONgay(d.body);
  const o3 = d.getElementById('n3'), c3 = d.querySelector('.o-ngay-chu');
  o3.value = '2026-01-01';
  bang(c3.value, '01/01/2026', 'code cu gan .value -> o chu TU VE LAI (chan o tang property)');
  bang(o3.value, '2026-01-01', 'va doc .value van ra ISO vua gan');
  o3.value = '';
  bang(c3.value, '', 'gan rong -> o chu trong');

  /* --- 3e. Goi lai KHONG boc hai lan --- */
  ({ w, d, F } = dungDom('<input type="date" id="n4" value="2026-09-01">'));
  F.enhanceONgay(d.body);
  F.enhanceONgay(d.body);
  F.enhanceONgay(d.body);
  bang(d.querySelectorAll('.o-ngay-chu').length, 1, 'goi 3 lan van chi MOT o chu (co co danh dau)');
  bang(d.querySelectorAll('.o-ngay-nut').length, 1, 'va mot nut 📅');

  /* --- 3f. Opt-out bang data-nosearch --- */
  ({ w, d, F } = dungDom('<input type="date" id="n5" value="2026-09-01" data-nosearch>'));
  F.enhanceONgay(d.body);
  bang(d.querySelectorAll('.o-ngay-chu').length, 0, 'data-nosearch -> KHONG boc (con duong thoat)');

  /* --- 3g. disabled: o chu + nut cung phai tat --- */
  ({ w, d, F } = dungDom('<input type="date" id="n6" value="2026-09-01" disabled>'));
  F.enhanceONgay(d.body);
  kiem(d.querySelector('.o-ngay-chu').disabled === true, 'o date disabled -> o chu cung disabled');
  kiem(d.querySelector('.o-ngay-nut').disabled === true, 'va nut 📅 cung tat');

  /* --- 3h. Thua huong style/min/max cua o goc --- */
  ({ w, d, F } = dungDom('<input type="date" id="n7" value="2026-09-01" style="max-width:150px;" min="2026-01-01" max="2026-12-31">'));
  F.enhanceONgay(d.body);
  kiem(/max-width:\s*150px/.test(d.querySelector('.o-ngay-chu').getAttribute('style') || ''),
    'o chu thua huong style (be rong da dat cho vua cot phieu)');
  bang([d.getElementById('n7').getAttribute('min'), d.getElementById('n7').getAttribute('max')],
    ['2026-01-01', '2026-12-31'], 'GIU min/max tren o date -> lich van chan ngoai khoang');

  /* --- 3i. Nut 📅 mo lich; khong co showPicker thi lui ve click() --- */
  ({ w, d, F } = dungDom('<input type="date" id="n8" value="2026-09-01">'));
  F.enhanceONgay(d.body);
  const o8 = d.getElementById('n8');
  let daMo = 0, daClick = 0;
  o8.showPicker = () => { daMo++; };
  o8.addEventListener('click', () => daClick++);
  d.querySelector('.o-ngay-nut').dispatchEvent(new w.Event('click', { bubbles: true }));
  bang([daMo, daClick], [1, 0], 'bam 📅 -> goi showPicker() cua trinh duyet');
  delete o8.showPicker;
  d.querySelector('.o-ngay-nut').dispatchEvent(new w.Event('click', { bubbles: true }));
  kiem(daClick >= 1, 'trinh duyet khong co showPicker -> lui ve click() (van mo duoc lich)');
  kiem(!/opacity:\s*0/.test(o8.getAttribute('style') || ''), 'khi lui ve click() thi hien o date ra cho bam');

  /* --- 3j. Mui tien xuong / F4 trong o chu cung mo lich (thoi quen Excel) --- */
  ({ w, d, F } = dungDom('<input type="date" id="n9" value="2026-09-01">'));
  F.enhanceONgay(d.body);
  const o9 = d.getElementById('n9');
  let mo9 = 0; o9.showPicker = () => { mo9++; };
  const c9 = d.querySelector('.o-ngay-chu');
  c9.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  c9.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'F4', bubbles: true }));
  bang(mo9, 2, 'mui tien xuong va F4 deu mo lich');

  /* --- 3k. NHIEU o ngay trong cung mot form (phieu nhap co Ngay + Ngay hoa don) --- */
  ({ w, d, F } = dungDom(
    '<input type="date" name="ngay" value="2026-09-07" required>' +
    '<input type="date" name="ngayHoaDon" value="">'));
  F.enhanceONgay(d.body);
  bang(d.querySelectorAll('.o-ngay-chu').length, 2, 'boc du 2 o');
  const cs = d.querySelectorAll('.o-ngay-chu');
  bang([cs[0].value, cs[1].value], ['07/09/2026', ''], 'o co ngay thi hien, o trong thi de trong');
  const fd2 = new w.FormData(d.getElementById('f'));
  bang([fd2.get('ngay'), fd2.get('ngayHoaDon')], ['2026-09-07', ''],
    'FormData tra dung ISO cho ca hai (o trong -> rong, khong phai rac)');
  /* Go vao o thu hai khong duoc lam anh huong o thu nhat. */
  cs[1].value = '31/12/2026';
  cs[1].dispatchEvent(new w.Event('blur', { bubbles: true }));
  const fd3 = new w.FormData(d.getElementById('f'));
  bang([fd3.get('ngay'), fd3.get('ngayHoaDon')], ['2026-09-07', '2026-12-31'], 'hai o doc lap nhau');
}

/* ================================================================================================
   4. Ma nguon: noi vao dung cho, khong con hai co che song song
   ================================================================================================ */
console.log('\n=== 4. Ma nguon ===');
const sachCommon = bo(sCommon), sachDash = bo(sDash);
kiem(/function enhanceInputs\(root\) \{ enhanceSelects\(root\); enhanceDatalists\(root\); enhanceONgay\(root\); \}/.test(sachCommon),
  'enhanceInputs goi enhanceONgay -> tu ap cho MOI o ngay (trong modal lan ngoai modal)');
kiem(/oNgay\.dataset\.ngayEnhanced != null \|\| oNgay\.dataset\.nosearch != null/.test(sachCommon),
  'co co danh dau + duong opt-out (goi lai khong boc hai lan)');
kiem(/if \(oNgay\.required\) \{ oChu\.required = true; oNgay\.required = false; \}/.test(sachCommon),
  'chuyen required sang o chu (19 o required trong he thong)');
kiem(/Object\.defineProperty\(oNgay, 'value'/.test(sachCommon),
  'chan tang property .value -> code cu gan bang JS thi o chu van ve lai');
kiem(/oNgay\.dispatchEvent\(new Event\('change', \{ bubbles: true \}\)\)/.test(sachCommon),
  "ban lai 'change' tren o date -> moi handler cu van nhan");
/* Chi con MOT co che: cac ham rieng cua v7.75 da bo. */
['function oNgayHtml(', 'function wireONgay(', 'function docONgay(', 'function datONgay(']
  .forEach(h => kiem(sachCommon.indexOf(h) < 0, `da bo ${h.replace('function ', '').replace('(', '')}() cua v7.75 (chi con MOT co che)`));
kiem(!/oNgayHtml\(|wireONgay\(|docONgay\(|datONgay\(/.test(sachDash),
  'dashboard khong con dung cac ham rieng do');
kiem(/<input type="date" id="dbTu"/.test(sachDash) && /<input type="date" id="dbDen"/.test(sachDash),
  'dashboard quay lai input type="date" nhu moi man khac');
kiem(/document\.getElementById\('dbTu'\)\.value/.test(sachDash),
  'dashboard doc .value nhu cu (khong phai sua gi them)');

console.log('\n=== 5. Pham vi: dem so o ngay se duoc nang cap ===');
const cacFile = fs.readdirSync(path.join(G, '../frontend/js')).filter(f => f.endsWith('.js'));
let tong = 0, theoFile = [];
cacFile.forEach(f => {
  const n = (doc('../frontend/js/' + f).match(/type="date"/g) || []).length;
  if (n) { tong += n; theoFile.push(`${f}=${n}`); }
});
kiem(tong >= 55, `co ${tong} o type="date" — TAT CA di qua enhanceONgay, khong phai sua tung o`,
  theoFile.join(' '));
kiem(!/type="text"[^>]*id="dbTu"/.test(sachDash), 'khong con o ngay nao bi doi type sang text (giu hop dong du lieu)');

console.log('\n=== 6. Bump ?v= ===');
[['common.js', 7.76], ['module.dashboard.js', 7.76]].forEach(([f, min]) => {
  const v = (sIndex.match(new RegExp(f.replace(/\./g, '\\.') + '\\?v=([\\d.]+)')) || [])[1];
  kiem(v && parseFloat(v) >= min, `index.html: ${f}?v= >= ${min}`, String(v));
});

console.log('\n================================================================');
console.log(`KET QUA: ${dat} dat / ${truot} truot`);
process.exit(truot ? 1 : 0);
