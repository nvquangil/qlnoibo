/* ================================================================================================
   KIEM CHUNG v7.63 — "BAM CHUOT VAO O LA SO DANH SACH RA"
   ------------------------------------------------------------------------------------------------
   Bao loi: o nhap co danh sach chon, bam vao KHONG hien danh sach — phai XOA du lieu dang co roi
   moi so ra.

   Nguyen nhan: cac o do la `<input list="...">` dung datalist SAN CO cua trinh duyet. Trinh duyet
   LOC danh sach theo chu dang co trong o -> o dang la "Den" thi chi thay muc chua "Den".
   Va o `<select>` da boc combobox (enhanceOneSelect) thi chi co su kien `focus`, ma focus KHONG ban
   lai khi o DA duoc focus san.

   Test nay DUNG MOT DOM GIA de CHAY THAT enhanceOneDatalist: dat san gia tri "Đen" roi ban su kien
   `click`, va doi hoi panel phai liet ke DU CA 3 muc — chu khong phai 1 muc khop chu "Đen".

   Chay:  node utils/kiem_o_chon_so_danh_sach.js
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
const bo = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const sCommon = doc('../frontend/js/common.js');
const sIndex = doc('../frontend/index.html');

/* ================================================================================================
   1. DOM GIA — du de chay enhanceOneDatalist that
   ================================================================================================ */
function taoDom() {
  const nghe = () => ({});
  function el(tag) {
    const e = {
      tagName: String(tag || 'div').toUpperCase(),
      nodeType: 1, dataset: {}, style: {}, value: '', className: '',
      _attr: {}, _ev: {}, children: [], options: [],
      classList: { toggle() { }, add() { }, remove() { } },
      getAttribute(k) { return Object.prototype.hasOwnProperty.call(e._attr, k) ? e._attr[k] : null; },
      setAttribute(k, v) { e._attr[k] = String(v); },
      removeAttribute(k) { delete e._attr[k]; },
      addEventListener(t, fn) { (e._ev[t] = e._ev[t] || []).push(fn); },
      removeEventListener() { },
      dispatchEvent(ev) { (e._ev[ev.type] || []).forEach(fn => fn(ev)); return true; },
      getBoundingClientRect() { return { left: 0, top: 0, bottom: 20, width: 150 }; },
      scrollIntoView() { },
      select() { e._daSelect = (e._daSelect || 0) + 1; },
      appendChild(c) { e.children.push(c); return c; },
      remove() { e._daGo = true; },
      querySelectorAll() { return []; },
      set innerHTML(v) {
        e._html = v;
        // Dem so <div class="ss-option"> de dung so phan tu con tuong ung.
        const n = (String(v).match(/class="ss-option"/g) || []).length;
        e.children = []; for (let i = 0; i < n; i++) e.children.push(el('div'));
      },
      get innerHTML() { return e._html || ''; }
    };
    return e;
  }
  const theoId = {};
  const doc2 = {
    createElement: el,
    getElementById: (id) => theoId[id] || null,
    body: el('body'),
    activeElement: null
  };
  return { el, doc: doc2, theoId };
}

function catHam(src, ten) {
  const moc = src.search(new RegExp('function\\s+' + ten + '\\s*\\('));
  if (moc < 0) return null;
  const mo = src.indexOf('{', moc);
  let sau = 1, i = mo + 1, ch = null;
  for (; i < src.length && sau > 0; i++) {
    const c = src[i];
    if (ch) { if (c === ch && src[i - 1] !== '\\') ch = null; continue; }
    if (c === "'" || c === '"' || c === '`') { ch = c; continue; }
    if (c === '{') sau++; else if (c === '}') sau--;
  }
  return sau === 0 ? src.slice(moc, i) : null;
}

console.log('\n=== 1. CHAY THAT enhanceOneDatalist bang DOM gia ===');
const mHam = catHam(sCommon, 'enhanceOneDatalist');
kiem(!!mHam, 'cat duoc enhanceOneDatalist tu common.js');

const { el, doc: fakeDoc, theoId } = taoDom();
const chay = new Function('document', 'window', 'escapeHtml', 'Event', `
  ${mHam}
  return enhanceOneDatalist;`)(
  fakeDoc,
  { addEventListener() { }, removeEventListener() { } },
  (x) => String(x == null ? '' : x),
  function Event(type) { return { type, bubbles: true }; }
);

/* Datalist 3 mau. `value` la thu duoc ghi vao o; text la mo ta them. */
const dl = el('datalist');
dl.options = [
  { value: 'Đen', textContent: '' },
  { value: 'Hồng ruốc', textContent: '' },
  { value: 'Tím than', textContent: '' }
];
theoId['dlMau'] = dl;

const inp = el('input');
inp.setAttribute('list', 'dlMau');
inp.value = 'Đen';            // <- O DANG CO SAN GIA TRI: day chinh la canh bao loi
chay(inp);

kiem(inp.getAttribute('list') === null, 'da GO thuoc tinh list (tat popup goc cua trinh duyet)');
bang(inp.dataset.dl, 'dlMau', 'ten datalist duoc giu o data-dl de moi lan mo con doc lai');
bang(inp.dataset.dlEnhanced, '1', 'danh dau da boc (khong boc hai lan)');
kiem(inp.getAttribute('autocomplete') === 'off', 'tat goi y tu dong cua trinh duyet');

/* --- BAM CHUOT: phai so DU CA 3 muc du o dang la "Đen" --- */
const truocSoCon = fakeDoc.body.children.length;
inp.dispatchEvent({ type: 'click' });
const panel = fakeDoc.body.children[truocSoCon];
kiem(!!panel, 'bam chuot -> co dung panel danh sach');
bang(panel ? panel.children.length : 0, 3,
  'BAM CHUOT khi o DANG CO "Đen" -> van liet ke DU 3 muc (khong loc theo chu dang co)');
kiem(inp._daSelect > 0, 'boi den san chu dang co -> go la thay luon, khong phai xoa tay');

/* --- Go de loc --- */
inp.value = 'tím';
inp.dispatchEvent({ type: 'input' });
const panel2 = fakeDoc.body.children[fakeDoc.body.children.length - 1];
bang(panel2.children.length, 1, 'go "tím" -> loc con 1 muc');
inp.value = 'ruốc';
inp.dispatchEvent({ type: 'input' });
bang(fakeDoc.body.children[fakeDoc.body.children.length - 1].children.length, 1,
  'loc khop CA phan mo ta lan gia tri');

/* --- Chon mot muc: phai ban CA input LAN change --- */
/* Panel duoc DUNG LAI (build chi tao moi khi chua co), nen khong bam 'click' lai duoc — dung
   'input' voi o rong de dung lai du 3 muc. */
inp.value = '';
inp.dispatchEvent({ type: 'input' });
const panel3 = fakeDoc.body.children[fakeDoc.body.children.length - 1];
bang(panel3.children.length, 3, 'xoa het chu -> lai day du 3 muc');
const nhan = [];
inp.addEventListener('input', () => nhan.push('input'));
inp.addEventListener('change', () => nhan.push('change'));
panel3.children[1]._ev.mousedown[0]({ preventDefault() { } });
bang(inp.value, 'Hồng ruốc', 'chon muc thu 2 -> gan dung gia tri');
bang(nhan, ['input', 'change'],
  'ban CA HAI su kien (man cu noi tay bang .oninput hoac .onchange tuy cho)');

/* --- Enter KHONG duoc tu chon goi y dau tien --- */
inp.value = 'Màu mới chưa có';
inp.dispatchEvent({ type: 'click' });   // mo panel (khong khop gi -> panel dong)
let daChanSubmit = false;
inp._ev.keydown[0]({ key: 'Enter', preventDefault() { daChanSubmit = true; } });
bang(inp.value, 'Màu mới chưa có',
  'go TEN MOI roi Enter -> GIU NGUYEN chu vua go (o nay go tu do duoc, khong ep chon trong danh sach)');

console.log('\n=== 2. Bam chuot cung mo lai o <select> da boc combobox ===');
const mSel = catHam(sCommon, 'enhanceOneSelect');
kiem(!!mSel, 'cat duoc enhanceOneSelect');
kiem(/input\.addEventListener\('click', \(\) => \{ if \(!panel\) \{ input\.select\(\); build\(true\); \} \}\);/.test(sCommon),
  'o <select> cung co su kien click -> bam vao o dang focus van so danh sach');
kiem(/input\.addEventListener\('focus'/.test(mSel || ''), 'van giu su kien focus nhu cu');
/* Dang mo panel ma bam de dat con tro giua chu thi KHONG duoc dung lai danh sach. */
kiem(/click'[^\n]*if \(!panel\)/.test(sCommon),
  'dang mo danh sach thi bam khong dung lai (van dat duoc con tro giua chu)');

console.log('\n=== 3. Moc goi: khong man nao bi bo sot ===');
kiem(/function enhanceInputs\(root\) \{ enhanceSelects\(root\); enhanceDatalists\(root\); \}/.test(sCommon),
  'co enhanceInputs goi CA HAI');
/* 4 = 1 dong dinh nghia + 2 moc cua modal (mo modal + MutationObserver them dong) + 1 moc .content. */
const soGoi = (bo(sCommon).match(/enhanceInputs\(/g) || []).length;
kiem(soGoi === 4, 'enhanceInputs duoc goi o DU 3 moc (+1 dong dinh nghia)', String(soGoi));
kiem(!/enhanceSelects\(__mbody\)/.test(sCommon) && !/addedNodes\) if \(n && n\.nodeType === 1\) enhanceSelects\(n\)/.test(sCommon),
  'khong con moc nao chi goi enhanceSelects (se bo sot o <input list>)');
kiem(/MutationObserver\(muts =>[\s\S]{0,200}enhanceInputs\(n\)/.test(sCommon),
  'dong THEM DONG dong (Them cay / Them dong) cung duoc boc');

console.log('\n=== 4. Ra soat: moi <input list> deu duoc boc ===');
const dsFile = ['module.qlsx.js', 'module.tailieukythuat.js', 'module.khohang.js', 'module.nhapkho.js',
  'module.khovai.js', 'module.phukien.js', 'module.congno.js', 'module.danhmuc.js', 'module.nhaplai.js'];
let tongO = 0;
dsFile.forEach(f => {
  let src = '';
  try { src = doc('../frontend/js/' + f); } catch (e) { return; }
  const n = (src.match(/<input[^>]*\slist="/g) || []).length;
  tongO += n;
  if (n) console.log(`  · ${f}: ${n} o <input list>`);
});
kiem(tongO > 0, 'co tim thay cac o <input list> trong cac phieu', String(tongO));
/* ⚠️ Ban dau toi dinh kiem "moi o co nam trong modal khong" bang cach do nguoc tim `openModal(`.
   Cach do SAI: nhieu man dung `const html = \`...\`` roi moi goi `openModal(html)` O DUOI, nen doi
   chieu nguoc khong thay gi — `inpMaHang` cua form The kho bi bao nham la nam ngoai modal.
   Va quan trong hon: di soi tung man xem cai nao trong modal la CACH LAM SAI. Chi can sot mot cai
   la man do lai "bam khong so danh sach" ma khong ai biet. Nay theo doi luon `.content` nen KHONG
   CAN biet o nam o dau — muc duoi kiem dung cai moc do. */
kiem(/\(function boc0Ngoai\(\)/.test(sCommon), 'co moc boc cac o NGOAI modal (theo doi .content)');
kiem(/new MutationObserver\(gopNhip\)\.observe\(c, \{ childList: true, subtree: true \}\)/.test(sCommon),
  'moc do theo doi ca cay con -> form ve lai / them dong deu duoc boc');
kiem(/gopNhip = \(\) => \{ clearTimeout\(hen\); hen = setTimeout\(chay, 60\); \}/.test(sCommon),
  'co gop nhip 60ms — khong chay lai ham boc sau MOI thay doi DOM nho');
kiem(/dlEnhanced != null/.test(sCommon) && /ssEnhanced != null/.test(sCommon),
  'ca hai ham boc deu co co danh dau -> goi lai nhieu lan KHONG boc hai lan');

console.log('\n=== 5. Bump ?v= ===');
const v = (sIndex.match(/common\.js\?v=([\d.]+)/) || [])[1];
kiem(v && parseFloat(v) >= 7.63, 'index.html: common.js?v= >= 7.63', String(v));

console.log('\n================================================================');
console.log(`KET QUA: ${dat} dat / ${truot} truot`);
process.exit(truot ? 1 : 0);
