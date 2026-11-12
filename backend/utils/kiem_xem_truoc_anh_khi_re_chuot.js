/* ================================================================================================
   kiem_xem_truoc_anh_khi_re_chuot.js — bo tu kiem cho v9.47 (re chuot vao anh nho la hien to ngay;
   Nguyen 12/11/2026: "the kho hang hoa, chi tiet hang hoa, the kho phu kien, the kho vai")

   CHAY THAT khoi ma cua common.js (cat theo MOC dau/cuoi, khong dem ngoac) trong mot "trinh duyet
   gia" toi thieu: document/window/Image/setTimeout deu la stub ghi lai nhung gi xay ra. Nho vay kiem
   duoc HANH VI: re vao -> cho 120 ms -> hien khung voi anh nho phong len -> tai xong ban 800px thi
   thay -> roi anh / bam / cuon thi an va tra lai `title`.

   Chay:  node backend\utils\kiem_xem_truoc_anh_khi_re_chuot.js
   KHONG copy sang D:\QLSX. KHONG dung toi CSDL.
   ================================================================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const GOC = path.join(__dirname, '..', '..');
const doc = (...p) => fs.existsSync(path.join(GOC, ...p)) ? fs.readFileSync(path.join(GOC, ...p), 'utf8') : '';
let sai = 0, dat = 0;
function kiem(ten, dung, td) {
  if (dung) { dat++; console.log('  ✓ ' + ten); }
  else { sai++; console.log('  ❌ ' + ten + (td ? ' — ' + td : '')); }
}
const sCommon = doc('frontend', 'js', 'common.js');
const html = doc('frontend', 'index.html');

console.log('\n=== 1. BIEN DICH (vm.Script) ===');
try { new vm.Script(sCommon, { filename: 'common.js' }); kiem('frontend/js/common.js', true); }
catch (e) { kiem('frontend/js/common.js', false, 'VO CU PHAP: ' + e.message); }

/* ---- Cat ba khoi theo MOC (dong mo dau khoi -> dong mo dau khoi ke tiep) ---- */
function catTheoMoc(s, tu, den) {
  const i = s.indexOf(tu); if (i < 0) return '';
  const j = s.indexOf(den, i); if (j < 0) return '';
  return s.slice(i, j);
}
const kAnhNho = catTheoMoc(sCommon, 'const ANH_CANH_CHO_PHEP', '\n/* v8.94');
const kLaAnh = catTheoMoc(sCommon, 'function laDuongDanAnh(', '\nlet __xemAnhDong');
const kXemTruoc = catTheoMoc(sCommon, 'function anhGocTuDuongDan(', '\nfunction closeModal(');
kiem('cat duoc 3 khoi: anhNho / laDuongDanAnh / xem truoc', !!kAnhNho && !!kLaAnh && !!kXemTruoc,
  JSON.stringify([kAnhNho.length, kLaAnh.length, kXemTruoc.length]));
kiem('khoi xem truoc chua IIFE bat mouseover', /document\.addEventListener\('mouseover'/.test(kXemTruoc));

/* ================================================================================================
   TRINH DUYET GIA — du cho khoi tren chay: closest/matches (chon don gian), dataset, classList,
   getBoundingClientRect, innerHTML (chi tao the con tu <tag attr="...">), appendChild, isConnected.
   ================================================================================================ */
class El {
  constructor(tag, attrs) {
    this.tagName = String(tag).toUpperCase(); this.attrs = {}; this.style = {}; this.children = []; this.parent = null;
    this.isConnected = false; this.rect = { left: 100, top: 100, width: 36, height: 36, right: 136, bottom: 136 };
    this.naturalWidth = 0; this.naturalHeight = 0; this.offsetWidth = 0; this.offsetHeight = 0; this.textContent = '';
    Object.keys(attrs || {}).forEach(k => this.setAttribute(k, attrs[k]));
  }
  get dataset() {
    const d = {};
    Object.keys(this.attrs).forEach(k => { if (k.indexOf('data-') === 0) d[k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = this.attrs[k]; });
    return d;
  }
  get classList() { const cls = String(this.attrs.class || '').split(/\s+/).filter(Boolean); return { contains: c => cls.indexOf(c) !== -1 }; }
  get className() { return this.attrs.class || ''; } set className(v) { this.attrs.class = String(v); }
  get src() { return this.attrs.src || ''; } set src(v) { this.attrs.src = String(v); }
  get currentSrc() { return this.attrs.src || ''; }
  getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  hasAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k); }
  removeAttribute(k) { delete this.attrs[k]; }
  getBoundingClientRect() { return this.rect; }
  matches(sel) {
    return String(sel).split(',').some(s => {
      s = s.trim();
      const m = /^([a-zA-Z]*)((?:[.#\[][^.#\[]*)*)$/.exec(s);
      if (!m) return false;
      if (m[1] && this.tagName !== m[1].toUpperCase()) return false;
      const parts = m[2].match(/[.#\[][^.#\[]*/g) || [];
      return parts.every(p => p[0] === '.' ? this.classList.contains(p.slice(1)) : (p[0] === '#' ? this.attrs.id === p.slice(1) : this.hasAttribute(p.slice(1, -1))));
    });
  }
  closest(sel) { let e = this; while (e) { if (e.matches(sel)) return e; e = e.parent; } return null; }
  contains(x) { let e = x; while (e) { if (e === this) return true; e = e.parent; } return false; }
  appendChild(c) {
    c.parent = this; this.children.push(c);
    const lan = (e) => { e.isConnected = this.isConnected; e.children.forEach(lan); }; lan(c);
    return c;
  }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); const lan = (e) => { e.isConnected = false; e.children.forEach(lan); }; lan(this); this.parent = null; }
  querySelector(sel) { for (const c of this.children) { if (c.matches(sel)) return c; const t = c.querySelector(sel); if (t) return t; } return null; }
  set innerHTML(h) {
    this.children = [];
    const re = /<([a-z]+)((?:\s+[\w-]+="[^"]*")*)\s*\/?>/g; let m;
    while ((m = re.exec(h))) { const at = {}; const ra = /([\w-]+)="([^"]*)"/g; let x; while ((x = ra.exec(m[2]))) at[x[1]] = x[2]; this.appendChild(new El(m[1], at)); }
  }
  get innerHTML() { return ''; }
}

function dungTrinhDuyetGia(coChuot) {
  const body = new El('body'); body.isConnected = true;
  const nghe = {}, ngheWin = {};
  const document = {
    readyState: 'complete', hidden: false, body,
    addEventListener(t, fn, opt) { (nghe[t] = nghe[t] || []).push({ fn, capture: opt === true || !!(opt && opt.capture) }); },
    removeEventListener() { }, createElement: (tag) => new El(tag), querySelector: () => null, querySelectorAll: () => [], getElementById: () => null
  };
  const window = {
    innerWidth: 1600, innerHeight: 900,
    matchMedia: () => ({ matches: !!coChuot }),
    addEventListener(t, fn) { (ngheWin[t] = ngheWin[t] || []).push(fn); }, removeEventListener() { }
  };
  let hens = [], idHen = 0;
  const setTimeout = (fn, ms) => { const id = ++idHen; hens.push({ id, fn, ms }); return id; };
  const clearTimeout = (id) => { hens = hens.filter(h => h.id !== id); };
  const images = [];
  function Image() { this.naturalWidth = 1600; this.naturalHeight = 1200; this.onload = null; images.push(this); }
  Object.defineProperty(Image.prototype, 'src', { set(v) { this._src = v; }, get() { return this._src; } });
  const ctx = { window, document, Image, setTimeout, clearTimeout, console };
  vm.createContext(ctx);
  vm.runInContext('var __xemAnhDong = null;\n' + kAnhNho + '\n' + kLaAnh + '\n' + kXemTruoc, ctx, { filename: 'xem_truoc_gia.js' });
  const phat = (t, ev) => {
    const ds = nghe[t] || [];
    ds.filter(l => l.capture).forEach(l => l.fn(ev));
    ds.filter(l => !l.capture).forEach(l => l.fn(ev));
  };
  const phatCapture = (t, ev) => (nghe[t] || []).filter(l => l.capture).forEach(l => l.fn(ev));
  const chayHen = () => { const ds = hens; hens = []; ds.forEach(h => h.fn()); };
  const khung = () => body.children.find(c => c.className === 'xem-truoc-anh') || null;
  return { ctx, body, nghe, ngheWin, phat, phatCapture, chayHen, hens: () => hens, images, khung };
}
/* Dung mot "o anh" nhu cac man that. parent = <td>, co the boc <a>. */
function taoAnh(opt) {
  const td = new El('td'); td.isConnected = true;
  let cha = td;
  if (opt.href !== undefined) { const a = new El('a', Object.assign({ href: opt.href }, opt.aAttrs || {})); td.appendChild(a); cha = a; }
  const img = new El('img', opt.attrs || {});
  cha.appendChild(img);
  if (opt.rong != null) { img.rect = { left: 100, top: 100, width: opt.rong, height: opt.rong, right: 100 + opt.rong, bottom: 100 + opt.rong }; }
  if (opt.rect) img.rect = opt.rect;
  img.naturalWidth = opt.nw != null ? opt.nw : 160; img.naturalHeight = opt.nh != null ? opt.nh : 120;
  return img;
}

console.log('\n=== 2. KHONG CO CHUOT THAT (dien thoai) -> khong bat gi ===');
{
  const t = dungTrinhDuyetGia(false);
  kiem('khong dang ky mouseover', !t.nghe.mouseover);
  kiem('ham anhGocTuDuongDan / anhXemTruocCua van co (dung chung)', typeof t.ctx.anhGocTuDuongDan === 'function' && typeof t.ctx.anhXemTruocCua === 'function');
}

console.log('\n=== 3. anhGocTuDuongDan + anhXemTruocCua ===');
{
  const t = dungTrinhDuyetGia(true);
  const g = t.ctx.anhGocTuDuongDan, x = t.ctx.anhXemTruocCua;
  kiem("'/anh/160/x.jpg' -> '/uploads/x.jpg'", g('/anh/160/x.jpg') === '/uploads/x.jpg', g('/anh/160/x.jpg'));
  kiem("'/anh/80/a.jpg?x=1' -> '/uploads/a.jpg' (bo query)", g('/anh/80/a.jpg?x=1') === '/uploads/a.jpg');
  kiem("'/uploads/y.png' giu nguyen", g('/uploads/y.png') === '/uploads/y.png');
  kiem("'data:image/png;base64,AAA' giu nguyen", g('data:image/png;base64,AAA') === 'data:image/png;base64,AAA');
  kiem('null -> chuoi rong', g(null) === '');

  // The kho hang hoa: <img class="thumb act-zoom-main" data-src=goc data-title=MaHang src=/anh/160/..>
  const i1 = taoAnh({ attrs: { class: 'thumb act-zoom-main', 'data-src': '/uploads/a.jpg', 'data-title': 'MH01', src: '/anh/160/a.jpg', title: 'Bấm để phóng to' } });
  const r1 = x(i1);
  kiem('the kho hang hoa (.thumb + data-src): src ban 800 + tieu de = data-title', !!r1 && r1.src === '/anh/800/a.jpg' && r1.tieuDe === 'MH01' && r1.a === null, JSON.stringify(r1));
  // Chi tiet theo mau: <img class="thumb hist-thumb" src=/anh/80/c.jpg> (khong data-src)
  const i2 = taoAnh({ attrs: { class: 'thumb hist-thumb', src: '/anh/80/c.jpg' } });
  kiem('chi tiet hang hoa (.thumb, src ban nho): suy nguoc ra goc -> ban 800', (x(i2) || {}).src === '/anh/800/c.jpg');
  // Phu kien: <a href=goc><img src=goc>
  const i3 = taoAnh({ href: '/uploads/b.jpg', aAttrs: { target: '_blank', title: 'Bấm để xem ảnh to' }, attrs: { src: '/uploads/b.jpg' }, rong: 42 });
  const r3 = x(i3);
  kiem('the kho phu kien (<a href=anh><img>): ban 800 + tra ve the <a> de cat title', !!r3 && r3.src === '/anh/800/b.jpg' && r3.a && r3.a.tagName === 'A');
  // Kho vai: anhMauThuNhoHtml -> <a href=goc><img src=/anh/80/..>
  const i4 = taoAnh({ href: '/uploads/d.jpg', aAttrs: { target: '_blank', title: 'Xem ảnh gốc' }, attrs: { src: '/anh/80/d.jpg', alt: '' }, rong: 40 });
  kiem('the kho vai (anhMauThuNhoHtml): ban 800, khong tieu de (alt rong)', (x(i4) || {}).src === '/anh/800/d.jpg' && (x(i4) || {}).tieuDe === '');
  // Anh may chu phuc vu, khong <a>, khong class (kho vai dong 1042)
  const i5 = taoAnh({ attrs: { src: '/anh/80/e.jpg' }, rong: 32 });
  kiem('img tran src=/anh/… (khong <a>, khong class) van xem truoc', (x(i5) || {}).src === '/anh/800/e.jpg');
  // Khong phai anh may chu: logo
  const i6 = taoAnh({ attrs: { src: '/img/logo.png' }, rong: 40 });
  kiem('logo /img/… -> KHONG xem truoc', x(i6) === null);
  // Da to san
  const i7 = taoAnh({ attrs: { class: 'thumb', src: '/uploads/f.jpg' }, rong: 300 });
  kiem('anh dang hien 300px (da to) -> KHONG xem truoc', x(i7) === null);
  // Chua ve (rong 0)
  const i8 = taoAnh({ attrs: { class: 'thumb', src: '/uploads/f.jpg' }, rong: 0 });
  kiem('anh chua ve (rong 0) -> KHONG', x(i8) === null);
  // Opt-out tren the cha
  const i9 = taoAnh({ attrs: { class: 'thumb', src: '/uploads/g.jpg' } });
  i9.parent.setAttribute('data-khong-xem-truoc', '');
  kiem('data-khong-xem-truoc o the cha -> KHONG', x(i9) === null);
  // Trong lightbox
  const i10 = taoAnh({ attrs: { src: '/uploads/h.jpg' } });
  i10.parent.setAttribute('class', 'xem-anh-lop');
  kiem('anh trong lop lightbox -> KHONG', x(i10) === null);
  // Link chu khong phai anh (Google Maps) boc anh may chu -> van xem truoc theo src
  const i11 = taoAnh({ href: 'https://maps.google.com/?q=1', attrs: { src: '/uploads/k.jpg' }, rong: 40 });
  const r11 = x(i11);
  kiem('<a> khong tro toi anh (Maps) boc img may chu: xem truoc theo src, khong cat title cua <a>', !!r11 && r11.src === '/anh/800/k.jpg' && r11.a === null);
  kiem('khong phai IMG -> null', x(new El('div')) === null && x(null) === null);
}

console.log('\n=== 4. HANH VI: re vao -> cho -> hien -> tai ban to -> thay -> roi -> an ===');
{
  const t = dungTrinhDuyetGia(true);
  const img = taoAnh({ attrs: { class: 'thumb act-zoom-main', 'data-src': '/uploads/a.jpg', 'data-title': 'MH01', src: '/anh/160/a.jpg', title: 'Bấm để phóng to' } });
  t.phat('mouseover', { target: img });
  kiem('re vao: CHUA hien ngay (co do tre), da hen 1 lan', !t.khung() && t.hens().length === 1 && t.hens()[0].ms === 120, JSON.stringify(t.hens().map(h => h.ms)));
  t.chayHen();
  const k = t.khung();
  kiem('het 120 ms: khung xuat hien trong body, display block', !!k && k.style.display === 'block');
  const hinh = k && k.querySelector('img'), chu = k && k.querySelector('.xem-truoc-anh-tieude');
  kiem('hien NGAY anh nho phong len (src = ban 160 dang co)', !!hinh && hinh.src === '/anh/160/a.jpg');
  kiem('co khung theo ty le 160x120 -> 640x480 (vua hop 640 / 60%x1600 / 80%x900)', !!hinh && hinh.style.width === '640px' && hinh.style.height === '480px', hinh && (hinh.style.width + 'x' + hinh.style.height));
  kiem('chu thich = data-title', !!chu && chu.textContent === 'MH01' && chu.style.display === '');
  kiem('title "Bấm để phóng to" tam CAT khi dang xem truoc', !img.hasAttribute('title'));
  kiem('bat dau tai ban 800', t.images.length === 1 && t.images[0].src === '/anh/800/a.jpg');
  kiem('khung dat BEN PHAI anh nho (left = right + 12)', k.style.left === '148px', k.style.left);
  const to = t.images[0]; to.naturalWidth = 1600; to.naturalHeight = 1200; to.onload();
  kiem('tai xong: thay sang ban 800, co khung giu nguyen 640x480 (cung ty le)', hinh.src === '/anh/800/a.jpg' && hinh.style.width === '640px' && hinh.style.height === '480px');
  // Re sang o khac (khong phai anh) -> an + tra title
  t.phat('mouseover', { target: img.parent });
  kiem('re ra khoi anh: an khung + tra lai title', k.style.display === 'none' && img.getAttribute('title') === 'Bấm để phóng to');
  // Re lai cung anh roi re tiep sang anh khac truoc khi het 120 ms -> chi hen 1 lan cho anh sau
  const img2 = taoAnh({ attrs: { class: 'thumb', src: '/anh/160/b.jpg' } });
  t.phat('mouseover', { target: img }); t.phat('mouseover', { target: img2 });
  kiem('luot nhanh qua 2 anh: chi con 1 hen (cua anh sau)', t.hens().length === 1);
  t.chayHen();
  kiem('…va hien anh sau', hinh.src === '/anh/160/b.jpg' && k.style.display === 'block');
  // Ban to ve TRE sau khi da an -> khong duoc hien lai (an() go handler; neu con thi goi cung khong hien)
  t.phat('mouseover', { target: img2.parent });
  const toTre = t.images[t.images.length - 1];
  if (typeof toTre.onload === 'function') toTre.onload();
  kiem('ban 800 ve tre sau khi da an: KHONG bat khung len lai', k.style.display === 'none');
  // Re THANG tu anh co title sang anh khac co title (khong qua o trong): title anh truoc phai duoc tra
  const imgA = taoAnh({ attrs: { class: 'thumb', src: '/uploads/ta.jpg', title: 'A' } });
  const imgB = taoAnh({ attrs: { class: 'thumb', src: '/uploads/tb.jpg', title: 'B' } });
  t.phat('mouseover', { target: imgA }); t.chayHen();
  t.phat('mouseover', { target: imgB }); t.chayHen();
  kiem('re thang A -> B: title A duoc tra, title B dang cat', imgA.getAttribute('title') === 'A' && !imgB.hasAttribute('title'));
  t.phat('mouseover', { target: imgB.parent });
  kiem('…roi B: title B duoc tra', imgB.getAttribute('title') === 'B');
}

console.log('\n=== 5. HANH VI: cac duong AN khac + vi tri + lightbox ===');
{
  const t = dungTrinhDuyetGia(true);
  const img = taoAnh({ href: '/uploads/b.jpg', aAttrs: { title: 'Bấm để xem ảnh to' }, attrs: { src: '/uploads/b.jpg' }, rong: 42 });
  const a = img.parent;
  const hienLen = () => { t.phat('mouseover', { target: img }); t.chayHen(); };
  hienLen();
  const k = t.khung();
  kiem('hien khung (phu kien)', !!k && k.style.display === 'block');
  kiem('title cua <a> boc anh cung tam cat', !a.hasAttribute('title'));
  // Bam: bat o pha CAPTURE -> an + tra title truoc khi lightbox (pha bubble) doc
  t.phatCapture('click', { target: img });
  kiem('BAM (pha capture): an khung + tra title cho lightbox doc', k.style.display === 'none' && a.getAttribute('title') === 'Bấm để xem ảnh to');
  kiem('listener click dang ky o pha capture', (t.nghe.click || []).some(l => l.capture));
  hienLen(); t.phat('scroll', {});
  kiem('CUON -> an', k.style.display === 'none');
  hienLen(); t.phat('wheel', {});
  kiem('lan chuot -> an', k.style.display === 'none');
  hienLen(); t.phat('keydown', { key: 'a' });
  kiem('go phim -> an', k.style.display === 'none');
  hienLen(); t.phat('mouseout', { target: img, relatedTarget: null });
  kiem('roi han cua so (relatedTarget null) -> an', k.style.display === 'none');
  hienLen(); t.phat('mouseout', { target: img, relatedTarget: img.parent });
  kiem('mouseout sang phan tu khac trong trang: KHONG an o day (mouseover ke tiep lo)', k.style.display === 'block');
  t.phat('mouseover', { target: img });
  kiem('re tiep trong cung anh: khong hen lai', t.hens().length === 0 && k.style.display === 'block');
  img.remove(); t.phat('mousemove', {});
  kiem('bang ve lai (anh mat khoi DOM) + chuot nhuc nhich -> an', k.style.display === 'none');
  // Dang hen ma re sang o khong phai anh -> huy hen, khong hien
  const img3 = taoAnh({ attrs: { class: 'thumb', src: '/uploads/c.jpg' } });
  t.phat('mouseover', { target: img3 }); t.phat('mouseover', { target: img3.parent }); t.chayHen();
  kiem('dang cho 120 ms ma re ra: huy hen, khong hien', k.style.display === 'none');
  // Lightbox dang mo -> khong xem truoc
  t.ctx.__xemAnhDong = () => { };
  t.phat('mouseover', { target: img3 });
  kiem('lightbox dang mo -> khong hen xem truoc', t.hens().length === 0);
  t.ctx.__xemAnhDong = null;
  // Vi tri: anh sat mep phai -> khung sang trai; anh sat mep tren -> top ke mep 8px
  const imgPhai = taoAnh({ attrs: { class: 'thumb', src: '/uploads/p.jpg' }, rect: { left: 1400, top: 100, width: 36, height: 36, right: 1436, bottom: 136 } });
  t.phat('mouseover', { target: imgPhai });
  k.offsetWidth = 652; k.offsetHeight = 492;
  t.chayHen();
  kiem('anh sat mep phai: khung sang BEN TRAI (left = 1400 - 12 - 652 = 736)', k.style.left === '736px', k.style.left);
  kiem('canh giua theo anh nho nhung khong tran mep tren (top = 8px)', k.style.top === '8px', k.style.top);
  const imgGiua = taoAnh({ attrs: { class: 'thumb', src: '/uploads/q.jpg' }, rect: { left: 300, top: 500, width: 36, height: 36, right: 336, bottom: 536 } });
  t.phat('mouseover', { target: imgGiua }); t.chayHen();
  kiem('anh giua man: ben phai (348px), top = 518 - 246 = 272px', k.style.left === '348px' && k.style.top === '272px', k.style.left + ' / ' + k.style.top);
  kiem('visibilitychange (an tab) -> an', (() => { t.phat('visibilitychange', {}); return k.style.display === 'block'; })() && (() => { t.ctx.document.hidden = true; t.phat('visibilitychange', {}); t.ctx.document.hidden = false; return k.style.display === 'none'; })());
  kiem('window.resize duoc nghe de dat lai vi tri', !!(t.ngheWin.resize && t.ngheWin.resize.length));
}

console.log('\n=== 6. KHOP NOI ===');
kiem('khung xem truoc KHONG an chuot (pointer-events:none) va nam duoi lightbox (11000 < 12000)', /pointer-events:none/.test(kXemTruoc) && /z-index:11000/.test(kXemTruoc));
kiem('index.html bump common.js >= 9.47', (() => { const m = /common\.js\?v=([\d.]+)/.exec(html); return !!m && parseFloat(m[1]) >= 9.47; })());

console.log(`\n=== KET QUA: ${dat} dat, ${sai} sai ===`);
process.exit(sai ? 1 : 0);
