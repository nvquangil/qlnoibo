/* ================================================================================================
   KIEM CHUNG v7.77 — XEM ANH TO CO NUT ✕ (lam cho DIEN THOAI)
   ------------------------------------------------------------------------------------------------
   Nguyen: "ghe tham shop chup anh bam vao anh xem nhung ko co nut thoat khi dang mo tren dien
   thoai. ra soat khi mo anh tren dien thoai co nut x de thoat anh ra ve man hinh gan nhat".

   NGUYEN NHAN: cac o anh mo bang `<a target="_blank">` = mo TAB MOI. Tren dien thoai thanh dia chi
   hay bi an nen khong thay nut nao de ve -> tuong bi ket trong anh.

   Test dung JSDOM (DOM THAT) + NAP THAT common.js: kiem lop xem anh co nut ✕ du to de bam bang
   ngon, bam nen / Esc / NUT BACK dien thoai deu dong, va bo bat click khong giành link khac
   (Google Maps, tai file).

   Chay:  NODE_PATH=/tmp/tsd/node_modules node utils/kiem_xem_anh_dien_thoai.js
   ================================================================================================ */
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
const sKhohang = doc('../frontend/js/module.khohang.js');
const sDms = doc('../frontend/js/module.dms.js');
const sIndex = doc('../frontend/index.html');

let JSDOM = null;
try { JSDOM = require('jsdom').JSDOM; } catch (e) { }

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
const MOC = ['function laDuongDanAnh(href) {', 'function xemAnh(src, tieuDe) {', 'function escapeHtml('];
MOC.forEach(m => kiem(!!catHam(sCommon, m), `cat duoc ${m.replace('function ', '').replace(/ ?\{$/, '')}`));

console.log('\n=== 1. Nhan dien duong dan ANH (khong giành link khac) ===');
const F0 = new Function(catHam(sCommon, 'function laDuongDanAnh(href) {') + '\nreturn laDuongDanAnh;')();
[['/uploads/a.jpg', true, 'anh trong uploads'],
  ['/uploads/rap_1.svg', true, 'hinh rap SVG'],
  ['/anh/320/a.jpg', true, 'anh xem truoc co ghi dem'],
  ['/uploads/x.JPEG', true, 'duoi chu HOA'],
  ['https://x.com/a.png?v=2', true, 'co tham so ?v='],
  ['data:image/png;base64,AAA', true, 'anh dang data:'],
  ['https://www.google.com/maps?q=1,2', false, 'link Google Maps -> KHONG cham'],
  ['/danhmuc/abc', false, 'trang catalogue cong khai -> KHONG cham'],
  ['/api/baocao/export.xlsx', false, 'tai file Excel -> KHONG cham'],
  ['/tai/hopdong.pdf', false, 'tai file PDF -> KHONG cham'],
  ['', false, 'rong'], [null, false, 'null']
].forEach(([h, mong, ten]) => bang(F0(h), mong, ten));

console.log('\n=== 2. CHAY THAT lop xem anh tren DOM that (jsdom) ===');
if (!JSDOM) {
  console.log('  (bo qua: chua cai jsdom — chay lai voi NODE_PATH=/tmp/tsd/node_modules)');
} else {
  const than = MOC.map(m => catHam(sCommon, m)).join('\n');
  /* Cat luon bo bat click o tang document (khoi IIFE cuoi khoi v7.77). */
  const iIife = sCommon.indexOf("/* Bắt click một lần cho cả trang.");
  const thanIife = iIife >= 0 ? sCommon.slice(iIife, sCommon.indexOf('})();', iIife) + 5) : '';
  kiem(!!thanIife, 'cat duoc bo bat click o tang document');

  const dung = (htmlBody) => {
    const dom = new JSDOM(`<!doctype html><body>${htmlBody || ''}</body>`, { pretendToBeVisual: true, url: 'https://x.local/' });
    const w = dom.window;
    const F = new Function('window', 'document', 'history', 'escapeHtml_x',
      'let __xemAnhDong = null;\n' + than + '\n' + thanIife
      + '\nreturn { xemAnh, laDuongDanAnh, dangMo: () => __xemAnhDong };')(w, w.document, w.history);
    /* common.js nap qua <script> o cuoi body nen luc chay `readyState` la 'loading' -> bo bat click
       tu doi 'DOMContentLoaded'. Trong jsdom su kien do da ban xong truoc khi ta eval, nen phai ban
       lai — khong thi bo bat click KHONG BAO GIO gan, va test bao "khong chan mo tab moi" oan. */
    try { w.document.dispatchEvent(new w.Event('DOMContentLoaded', { bubbles: true })); } catch (e) { }
    return { w, d: w.document, F };
  };

  /* --- 2a. Mo lop: co nut ✕ du to, co anh --- */
  let { w, d, F } = dung('');
  F.xemAnh('/uploads/a.jpg', 'Shop Hương Lan');
  const lop = d.querySelector('.xem-anh-lop');
  kiem(!!lop, 'mo duoc lop xem anh');
  const nutX = d.querySelector('.xem-anh-dong');
  kiem(!!nutX, 'CO NUT ✕ (day la thu Nguyen bao thieu)');
  bang(nutX.textContent, '✕', 'nut ghi dau ✕');
  const st = nutX.getAttribute('style') || '';
  kiem(/width:\s*44px/.test(st) && /height:\s*44px/.test(st),
    'nut ✕ 44x44 — co toi thieu bam duoc bang ngon tay tren dien thoai', st.slice(0, 60));
  kiem(/position:\s*fixed/.test(lop.getAttribute('style') || '') && /inset:\s*0/.test(lop.getAttribute('style') || ''),
    'lop phu TOAN MAN (khong phai hop nho phai cuon moi thay nut)');
  bang(d.querySelector('.xem-anh-hinh').getAttribute('src'), '/uploads/a.jpg', 'hien dung anh');
  kiem(/Shop Hương Lan/.test(lop.innerHTML), 'co tieu de anh');
  bang(d.body.style.overflow, 'hidden', 'chan cuon trang duoi trong luc xem anh');

  /* --- 2b. Bam ✕ -> dong, tra lai trang nhu cu --- */
  nutX.dispatchEvent(new w.Event('click', { bubbles: true }));
  bang(d.querySelectorAll('.xem-anh-lop').length, 0, 'bam ✕ -> DONG lop, ve man hinh cu');
  bang(d.body.style.overflow, '', 'tra lai kha nang cuon trang');

  /* --- 2c. Bam ra NEN thi dong; bam vao chinh ANH thi KHONG --- */
  ({ w, d, F } = dung(''));
  F.xemAnh('/uploads/a.jpg', 'A');
  d.querySelector('.xem-anh-hinh').dispatchEvent(new w.Event('click', { bubbles: true }));
  bang(d.querySelectorAll('.xem-anh-lop').length, 1, 'bam vao chinh tam anh -> KHONG dong (con phong to xem)');
  d.querySelector('.xem-anh-lop').dispatchEvent(new w.Event('click', { bubbles: true }));
  bang(d.querySelectorAll('.xem-anh-lop').length, 0, 'bam ra nen toi -> dong');

  /* --- 2d. Esc dong (may tinh) --- */
  ({ w, d, F } = dung(''));
  F.xemAnh('/uploads/a.jpg', 'A');
  d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  bang(d.querySelectorAll('.xem-anh-lop').length, 0, 'Esc -> dong');

  /* --- 2e. NUT BACK cua dien thoai: dong ANH, KHONG roi khoi trang --- */
  ({ w, d, F } = dung(''));
  const soMocTruoc = w.history.length;
  F.xemAnh('/uploads/a.jpg', 'A');
  kiem(w.history.length > soMocTruoc, 'mo anh -> THEM mot moc lich su (de Back bam vao no)',
    `${soMocTruoc} -> ${w.history.length}`);
  w.dispatchEvent(new w.Event('popstate'));
  bang(d.querySelectorAll('.xem-anh-lop').length, 0,
    'bam BACK tren dien thoai -> DONG ANH (khong roi khoi trang dang lam)');

  /* --- 2f. Mo anh khac trong luc dang xem: khong de lai 2 lop --- */
  ({ w, d, F } = dung(''));
  F.xemAnh('/uploads/a.jpg', 'A');
  F.xemAnh('/uploads/b.jpg', 'B');
  bang(d.querySelectorAll('.xem-anh-lop').length, 1, 'chi con MOT lop (khong xep chong nhieu anh)');
  bang(d.querySelector('.xem-anh-hinh').getAttribute('src'), '/uploads/b.jpg', 'va la anh moi nhat');

  /* --- 2g. Khong co anh thi khong mo lop rong --- */
  ({ w, d, F } = dung(''));
  F.xemAnh('', 'A');
  bang(d.querySelectorAll('.xem-anh-lop').length, 0, 'src rong -> khong mo lop trong');

  /* --- 2h. Bam vao O ANH: chan mo tab moi, mo lop thay the --- */
  ({ w, d, F } = dung(
    '<a id="la" href="/uploads/sp.jpg" target="_blank" title="Ảnh sản phẩm"><img src="/anh/160/sp.jpg"></a>'
    + '<a id="lb" href="https://www.google.com/maps?q=1,2" target="_blank">📍 xem</a>'
    + '<a id="lc" href="/api/x.xlsx">Tải Excel</a>'
    + '<a id="ld" href="/uploads/qr.png">Xem QR</a>'
    + '<a id="le" href="/uploads/sp.jpg" download>Tải ảnh</a>'
    + '<a id="lf" href="/uploads/sp.jpg" data-khong-lightbox><img src="/uploads/sp.jpg"></a>'));
  const bam = (id) => {
    const el = d.getElementById(id);
    const ev = new w.MouseEvent('click', { bubbles: true, cancelable: true });
    el.dispatchEvent(ev);
    return ev.defaultPrevented;
  };
  kiem(bam('la') === true, 'bam O ANH -> CHAN mo tab moi');
  bang(d.querySelectorAll('.xem-anh-lop').length, 1, 'va mo lop xem anh thay the');
  bang(d.querySelector('.xem-anh-hinh').getAttribute('src'), '/uploads/sp.jpg',
    'lop hien anh GOC (khong phai ban xem truoc co ghi dem)');
  kiem(/Ảnh sản phẩm/.test(d.querySelector('.xem-anh-lop').innerHTML), 'lay tieu de tu title cua link');
  d.querySelector('.xem-anh-dong').dispatchEvent(new w.Event('click', { bubbles: true }));

  kiem(bam('lb') === false, 'link Google Maps -> KHONG chan (van mo Maps nhu cu)');
  kiem(bam('lc') === false, 'link tai Excel -> KHONG chan');
  bang(d.querySelectorAll('.xem-anh-lop').length, 0, 'hai link tren khong mo lop nao');
  kiem(bam('ld') === true, 'link CHU tro toi anh ("Xem QR") -> cung mo lop (dien thoai khoi ket)');
  d.querySelector('.xem-anh-dong').dispatchEvent(new w.Event('click', { bubbles: true }));
  kiem(bam('le') === false, 'link co thuoc tinh download -> KHONG chan (de nguoi dung tai ve)');
  kiem(bam('lf') === false, 'link co data-khong-lightbox -> KHONG chan (duong opt-out)');
  bang(d.querySelectorAll('.xem-anh-lop').length, 0, 'ca hai truong hop tren deu khong mo lop');

  /* Ctrl+bam / bam chuot giua: nguoi dung CO Y mo tab moi -> khong giành. */
  ({ w, d, F } = dung('<a id="la" href="/uploads/sp.jpg"><img src="/uploads/sp.jpg"></a>'));
  const evCtrl = new w.MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true });
  d.getElementById('la').dispatchEvent(evCtrl);
  kiem(evCtrl.defaultPrevented === false, 'Ctrl+bam -> de trinh duyet mo tab moi nhu y nguoi dung');
}

/* ================================================================================================
   3. Ma nguon: gop ve MOT ban dung chung
   ================================================================================================ */
console.log('\n=== 3. Ma nguon ===');
const sachCommon = bo(sCommon), sachKho = bo(sKhohang), sachDms = bo(sDms);
kiem(/function xemAnh\(src, tieuDe\)/.test(sachCommon), 'common.js co ham xemAnh dung chung');
kiem(/window\.addEventListener\('popstate', onBack\)/.test(sachCommon),
  'co nghe nut Back cua dien thoai');
kiem(/history\.pushState\(\{ xemAnh: 1 \}/.test(sachCommon), 'co them moc lich su khi mo anh');
kiem(/document\.body\.style\.overflow = 'hidden'/.test(sachCommon), 'chan cuon trang duoi');
/* khohang.js: ban cu dung openModal -> nay goi ban dung chung. */
kiem(/function openImageLightbox\(src, title, onCloseCb\) \{\s*xemAnh\(src, title \|\| 'Ảnh'\);\s*\}/.test(sachKho),
  'khohang.js: openImageLightbox nay goi xemAnh dung chung');
kiem(!/id="btnCloseImg"/.test(sachKho), 'khohang.js: bo ban lightbox cu dung openModal');
/* dms.js: bo ban rieng, dung ban chung. */
kiem(!/function xemAnh\(url, tieuDe\)/.test(sachDms), 'dms.js: da bo ban xem anh rieng');
kiem(/xemAnh\(img\.dataset\.src, 'Ảnh mặt tiền'\)/.test(sachDms), 'dms.js: van goi xemAnh (nay la ban chung)');
kiem(!/Mở ảnh gốc/.test(sachDms), 'dms.js: bo nut "Mo anh goc" mo tab moi (nguon con lai cua loi)');
/* Khong con cho nao tu dung lightbox rieng. */
const soRieng = (sachCommon.match(/function xemAnh\(/g) || []).length;
bang(soRieng, 1, 'chi co DUNG MOT ban xemAnh trong toan he thong');

console.log('\n=== 4. Bump ?v= ===');
[['common.js', 7.77], ['module.khohang.js', 7.77], ['module.dms.js', 7.77]].forEach(([f, min]) => {
  const v = (sIndex.match(new RegExp(f.replace(/\./g, '\\.') + '\\?v=([\\d.]+)')) || [])[1];
  kiem(v && parseFloat(v) >= min, `index.html: ${f}?v= >= ${min}`, String(v));
});

console.log('\n================================================================');
console.log(`KET QUA: ${dat} dat / ${truot} truot`);
process.exit(truot ? 1 : 0);
