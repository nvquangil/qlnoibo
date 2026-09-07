/* ================================================================================================
   KIEM CHUNG v7.75 — O NHAP NGAY HIEN dd/mm/yyyy (Dashboard kinh doanh)
   ------------------------------------------------------------------------------------------------
   Nguyen: "dashboard kinh doanh ngay de dinh dang dd/mm/yyyy" ... "hien tai dang de mm/dd/yyyy".

   NGUYEN NHAN: `<input type="date">` hien theo NGON NGU CUA TRINH DUYET/WINDOWS, khong theo trang
   web. May dat tieng Anh (My) la ra mm/dd/yyyy, va KHONG co cach ep bang CSS hay thuoc tinh HTML.
   Nen phai tu lam o: o CHU hien dd/mm/yyyy + nut 📅 mo bo chon ngay cua trinh duyet (input date an).

   Test CHAY THAT cac ham cat tu common.js, ke ca wireONgay() voi DOM GIA — de chac cac hanh vi:
   go tu chen dau /, go sai thi TRA LAI gia tri cu (khong xoa trang), va gia tri gui may chu VAN la
   ISO 'yyyy-mm-dd'.

   Chay:  TZ=Asia/Ho_Chi_Minh node utils/kiem_o_ngay_ddmmyyyy.js
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
  'function oNgayHtml(id, iso, thuocTinh) {', 'function wireONgay(root, id) {',
  'function docONgay(id, root) {', 'function datONgay(id, iso, root) {', 'function escapeHtml('];
MOC.forEach(m => kiem(!!catHam(sCommon, m), `cat duoc ${m.replace('function ', '').replace(' {', '')}`));
const than = MOC.map(m => catHam(sCommon, m)).join('\n');

let baoLoi = [];
const F = new Function('toast', 'Event', than
  + '\nreturn { ngayVNTuISO, isoTuNgayVN, oNgayHtml, wireONgay, docONgay, datONgay };')(
    (m) => baoLoi.push(m), class EventGia { constructor(t) { this.type = t; } });

console.log('\n=== 1. ISO -> dd/mm/yyyy ===');
bang(F.ngayVNTuISO('2026-09-07'), '07/09/2026', 'doi dung thu tu ngay/thang/nam');
bang(F.ngayVNTuISO('2026-01-01'), '01/01/2026', 'giu so 0 dang truoc');
bang(F.ngayVNTuISO('2026-12-31T00:00:00'), '31/12/2026', 'co phan gio o sau van cat dung');
bang(F.ngayVNTuISO(''), '', 'rong -> ""');
bang(F.ngayVNTuISO(null), '', 'null -> ""');
bang(F.ngayVNTuISO('07/09/2026'), '', 'dua vao dd/mm/yyyy (khong phai ISO) -> "" (khong doi bua)');

console.log('\n=== 2. dd/mm/yyyy -> ISO ===');
bang(F.isoTuNgayVN('07/09/2026'), '2026-09-07', 'ca thuong');
bang(F.isoTuNgayVN('7/9/2026'), '2026-09-07', 'go tat khong so 0 dang truoc');
bang(F.isoTuNgayVN('7/9/26'), '2026-09-07', 'go tat nam 2 chu so -> 20xx');
bang(F.isoTuNgayVN('07-09-2026'), '2026-09-07', 'dau gach ngang cung nhan');
bang(F.isoTuNgayVN('07.09.2026'), '2026-09-07', 'dau cham cung nhan');
bang(F.isoTuNgayVN('29/02/2024'), '2024-02-29', 'nam nhuan: 29/02/2024 HOP LE');
console.log('  --- chan ngay khong ton tai ---');
[['31/02/2026', '31 thang 2'], ['32/01/2026', 'ngay 32'], ['07/13/2026', 'thang 13 (go kieu My)'],
  ['29/02/2025', '29/02 nam khong nhuan'], ['00/09/2026', 'ngay 0'], ['07/00/2026', 'thang 0']]
  .forEach(([s, ten]) => bang(F.isoTuNgayVN(s), '', `${ten} -> "" (khong nhan)`));
bang(F.isoTuNgayVN('2026-09-07'), '', 'dua vao ISO -> "" (o nay chi nhan dd/mm/yyyy)');
bang(F.isoTuNgayVN('abc'), '', 'chu -> ""');
bang(F.isoTuNgayVN(''), '', 'rong -> ""');

console.log('\n=== 3. oNgayHtml() dung o ===');
const html = F.oNgayHtml('dbTu', '2026-09-01');
kiem(/value="01\/09\/2026"/.test(html), 'o CHU hien dd/mm/yyyy (khong phai ISO)');
kiem(/placeholder="dd\/mm\/yyyy"/.test(html), 'co goi y dinh dang dd/mm/yyyy');
kiem(/data-iso="2026-09-01"/.test(html), 'giu ISO trong data-iso de gui may chu');
kiem(/type="date" id="dbTu_lich" class="o-ngay-lich" value="2026-09-01"/.test(html),
  'co input date AN giu dung ISO -> bam 📅 la mo lich cua trinh duyet');
kiem(/o-ngay-nut" data-cho="dbTu"/.test(html), 'co nut 📅 (khong mat kha nang bam chon ngay)');
kiem(/inputmode="numeric"/.test(html), 'dien thoai mo ban phim SO (go ngay nhanh)');
kiem(/opacity:0/.test(html) && /pointer-events:none/.test(html),
  'input date bi an han (khong hien them mot o ngay kieu My canh ben)');
bang(F.oNgayHtml('x', '').match(/value=""/g).length >= 1, true, 'chua co ngay -> o de trong');

console.log('\n=== 4. CHAY THAT wireONgay + docONgay (DOM gia) ===');
/* DOM gia toi thieu: du de chay dung nhung nhanh cua wireONgay. */
function oGia(id, giaTri, iso) {
  return {
    id, value: giaTri || '', dataset: { iso: iso || '' }, style: { cssText: '' },
    _h: {}, addEventListener(t, cb) { (this._h[t] = this._h[t] || []).push(cb); },
    dispatchEvent() { return true; },
    ban(t, e) { (this._h[t] || []).forEach(cb => cb(e || {})); },
    focus() { }, click() { this.daClick = true; }, showPicker() { this.daMoLich = true; }
  };
}
function dungRoot(iso) {
  const chu = oGia('dbTu', iso ? '01/09/2026' : '', iso || '');
  const lich = oGia('dbTu_lich', iso || '');
  const nut = oGia('nut');
  return {
    chu, lich, nut,
    querySelector(sel) {
      if (sel === '#dbTu') return chu;
      if (sel === '#dbTu_lich') return lich;
      if (sel.indexOf('o-ngay-nut') >= 0) return nut;
      return null;
    }
  };
}

let R = dungRoot('2026-09-01');
F.wireONgay(R, 'dbTu');
bang(F.docONgay('dbTu', R), '2026-09-01', 'doc ra ISO (khong phai chuoi dd/mm/yyyy)');

console.log('  --- 4a. Go tay: tu chen dau / ---');
R.chu.value = '07092026'; R.chu.ban('input');
bang(R.chu.value, '07/09/2026', 'go 8 so lien -> tu chen 2 dau /');
R.chu.value = '0709'; R.chu.ban('input');
bang(R.chu.value, '07/09', 'go 4 so -> chen 1 dau /');
R.chu.value = '07'; R.chu.ban('input');
bang(R.chu.value, '07', 'go 2 so -> chua chen dau');
R.chu.value = '07/09/2026abc!!'; R.chu.ban('input');
bang(R.chu.value, '07/09/2026', 'go lan chu -> bo hết ky tu khong phai so');
R.chu.value = '070920261234'; R.chu.ban('input');
bang(R.chu.value, '07/09/2026', 'go qua 8 so -> cat, khong ra ngay rac');

console.log('  --- 4b. Roi o: chuan hoa / bao loi / KHONG xoa trang ---');
R = dungRoot('2026-09-01'); F.wireONgay(R, 'dbTu');
R.chu.value = '7/9/26'; R.chu.ban('blur');
bang([R.chu.value, R.chu.dataset.iso, R.lich.value], ['07/09/2026', '2026-09-07', '2026-09-07'],
  'go tat -> chuan hoa ca o chu, data-iso VA input date an');

R = dungRoot('2026-09-01'); F.wireONgay(R, 'dbTu'); baoLoi = [];
R.chu.value = '31/02/2026'; R.chu.ban('blur');
bang(R.chu.value, '01/09/2026', 'ngay khong ton tai -> TRA LAI gia tri cu (khong xoa trang ky dang xem)');
bang(R.chu.dataset.iso, '2026-09-01', 'va ISO cung giu nguyen');
kiem(/dd\/mm\/yyyy/.test(baoLoi.join(' ')), 'co bao loi noi ro dang can go', baoLoi.join(' | '));

R = dungRoot('2026-09-01'); F.wireONgay(R, 'dbTu'); baoLoi = [];
R.chu.value = '   '; R.chu.ban('blur');
bang([R.chu.value, R.chu.dataset.iso], ['', ''], 'CO Y xoa trang -> cho trong (de bo loc ngay)');
bang(baoLoi.length, 0, 'xoa trang co y thi KHONG bao loi');

console.log('  --- 4c. Enter cung chuan hoa; chon tren lich thi o chu doi theo ---');
R = dungRoot('2026-09-01'); F.wireONgay(R, 'dbTu');
R.chu.value = '15/10/2026'; R.chu.ban('keydown', { key: 'Enter' });
bang(F.docONgay('dbTu', R), '2026-10-15', 'bam Enter -> chuan hoa ngay, khong phai doi roi o');
R = dungRoot('2026-09-01'); F.wireONgay(R, 'dbTu');
R.lich.value = '2026-12-25'; R.lich.ban('change');
bang([R.chu.value, R.chu.dataset.iso], ['25/12/2026', '2026-12-25'],
  'chon 25/12 tren lich -> o chu hien 25/12/2026');

console.log('  --- 4d. Nut 📅 mo bo chon ngay cua trinh duyet ---');
R = dungRoot('2026-09-01'); F.wireONgay(R, 'dbTu');
R.nut.ban('click');
kiem(R.lich.daMoLich === true, 'bam 📅 -> goi showPicker() cua input date');
R = dungRoot('2026-09-01'); F.wireONgay(R, 'dbTu');
delete R.lich.showPicker;                       // trinh duyet cu khong co showPicker
R.nut.ban('click');
kiem(R.lich.daClick === true, 'trinh duyet khong co showPicker -> lui ve click() (van mo duoc lich)');
kiem(/opacity:1/.test(R.lich.style.cssText), 'khi lui ve click() thi hien input date ra cho bam duoc');

console.log('  --- 4e. datONgay() dat lai tu ben ngoai (nut "Thang nay" / "Nam nay") ---');
R = dungRoot('2026-09-01'); F.wireONgay(R, 'dbTu');
F.datONgay('dbTu', '2026-01-01', R);
bang([R.chu.value, R.chu.dataset.iso, R.lich.value], ['01/01/2026', '2026-01-01', '2026-01-01'],
  'dat bang ISO -> o hien dd/mm/yyyy, ca 3 cho khop nhau');
bang(F.docONgay('dbTu', R), '2026-01-01', 'doc lai ra dung ISO vua dat');
F.datONgay('dbTu', '', R);
bang([R.chu.value, R.chu.dataset.iso], ['', ''], 'dat rong -> o trong');

console.log('\n=== 5. Dashboard da dung o moi ===');
const sachDash = bo(sDash);
kiem(/\$\{oNgayHtml\('dbTu', k\.tu\)\}/.test(sachDash) && /\$\{oNgayHtml\('dbDen', k\.den\)\}/.test(sachDash),
  'ca 2 o Tu ngay / Den ngay dung oNgayHtml');
kiem(!/type="date" id="dbTu"/.test(sachDash) && !/type="date" id="dbDen"/.test(sachDash),
  'khong con input type="date" tho (thu pham hien mm/dd/yyyy)');
kiem(/wireONgay\(container, 'dbTu'\)/.test(sachDash) && /wireONgay\(container, 'dbDen'\)/.test(sachDash),
  'co gan su kien cho ca 2 o (thieu la go/bam lich khong an gi)');
kiem(/p\.set\('tuNgay', docONgay\('dbTu'\)\)/.test(sachDash) && /p\.set\('denNgay', docONgay\('dbDen'\)\)/.test(sachDash),
  'gui may chu VAN la ISO qua docONgay (khong gui chuoi dd/mm/yyyy)');
kiem(/datONgay\('dbTu', tu, container\)/.test(sachDash) && /datONgay\('dbDen', den, container\)/.test(sachDash),
  'nut "Thang nay"/"Nam nay" dat lai o bang datONgay');
kiem(!/getElementById\('dbTu'\)\.value/.test(sachDash),
  'khong con cho nao doc/ghi thang .value cua o ngay (se lay ra dd/mm/yyyy roi gui len API)');
kiem(/fmtDate\(k\.LanCuoi\)/.test(sachDash), 'cot "Mua lan cuoi" van qua fmtDate (da la dd/mm/yyyy)');

console.log('\n=== 6. Bump ?v= ===');
[['common.js', 7.75], ['module.dashboard.js', 7.75]].forEach(([f, min]) => {
  const v = (sIndex.match(new RegExp(f.replace(/\./g, '\\.') + '\\?v=([\\d.]+)')) || [])[1];
  kiem(v && parseFloat(v) >= min, `index.html: ${f}?v= >= ${min}`, String(v));
});

console.log('\n================================================================');
console.log(`KET QUA: ${dat} dat / ${truot} truot`);
process.exit(truot ? 1 : 0);
