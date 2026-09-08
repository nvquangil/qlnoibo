/* ================================================================================================
   KIEM CHUNG v7.84 — COT STT TU DONG CHO MOI BANG
   ------------------------------------------------------------------------------------------------
   Nguyen: "chi can lam cot stt cho cac bang con lai". Chot: lam TU DONG toan he thong, pham vi gom
   ca 4 nhom (danh sach chinh / popup chi tiet / luoi nhap lieu / ban in), va LOC thi DANH LAI SO
   1,2,3... theo dong dang hien.

   Vi sao khong sua tay 120 bang: xem ghi chu dau khoi v7.84 trong frontend/js/common.js.

   ⚠️ BA LOP LOI DE MAC, moi cai co assert rieng:
     1. Them <th> ma khong noi `colspan` cua dong "chua co du lieu" / dong TONG -> bang lech dung 1 o.
        Test DEM O tung hang (cong ca colspan) bang jsdom, khong doc chuoi.
     2. Loc an bot dong (wireTableSearch dat style.display='none') -> so phai la 1..n LIEN MACH.
     3. Chen cot lam LECH moi chi so cot chup san truoc do — wireTableSort tung chup `idx` luc gan
        tay, chen them 1 cot la bam "Ngay" sap theo "Loai". Nay phai doc `th.cellIndex` luc BAM.

   Chay:  NODE_PATH=/tmp/tsd/node_modules node utils/kiem_cot_stt_tu_dong.js
   ================================================================================================ */
const fs = require('fs');
const path = require('path');
const G = path.join(__dirname, '..');
const doc = (p) => fs.readFileSync(path.join(G, p), 'utf8');

let dat = 0, truot = 0;
const OK = (m) => { dat++; console.log('  OK   ' + m); };
const NO = (m) => { truot++; console.log('  SAI  ' + m); };
const kiem = (dk, m, them) => (dk ? OK(m) : NO(m + (them ? '  -> ' + them : '')));
const bang = (thuc, mong, m) => kiem(JSON.stringify(thuc) === JSON.stringify(mong),
  `${m}  [duoc: ${JSON.stringify(thuc)}]`);

const sCommon = doc('../frontend/js/common.js');
const sIndex = doc('../frontend/index.html');
const { JSDOM } = require('jsdom');

/* ================================================================================================
   0. NAP THAT bo STT ra chay — cat cac ham ra khoi common.js
   ================================================================================================ */
function catKhoi(s, moc, mo, dong) {
  const i = s.indexOf(moc);
  if (i < 0) return '';
  let d = 0;
  for (let k = s.indexOf(mo, i); k < s.length; k++) {
    if (s[k] === mo) d++;
    else if (s[k] === dong) { d--; if (!d) return s.slice(i, k + 1); }
  }
  return '';
}
const TEN = ['function __oTraiHet(', 'function __dongKhongDanhSo(', 'function __soCotCuaBang(',
  'function __daCoStt(', 'function danhLaiStt(', 'function __gioTheoDoiStt(',
  'function themCotSttMotBang(', 'function capNhatSttSauKhiDoi(', 'function themCotStt('];
const nguon = TEN.map(t => {
  const h = catKhoi(sCommon, t, '{', '}');
  kiem(!!h, 'cat duoc ' + t.replace('function ', '').replace('(', '()'));
  return h;
}).join('\n');
kiem(/const STT_NHAN = 'STT'/.test(sCommon), 'nhan cot khai o MOT cho (STT_NHAN)');

/* runScripts: 'outside-only' -> `window.eval` chay TRONG cua so cua jsdom, nen code lay duoc
   document / MutationObserver / setTimeout that. Thieu co nay thi eval chay o ngu canh Node. */
const dom = new JSDOM('<body><div class="content"></div></body>', { runScripts: 'outside-only' });
const w = dom.window;
w.eval("const STT_NHAN = 'STT';\n" + nguon
  + '\nwindow.__stt = { themCotStt, danhLaiStt, capNhatSttSauKhiDoi };');
const S = w.__stt;
const D = w.document;

/* Do so o mot hang, CONG ca colspan. */
const soO = (tr) => [...tr.children].reduce((s, c) => s + (parseInt(c.getAttribute('colspan'), 10) || 1), 0);
function dungBang(html) {
  const hop = D.createElement('div');
  hop.innerHTML = html;
  D.querySelector('.content').appendChild(hop);
  return hop.querySelector('table');
}
const dauCot = (t) => [...t.querySelectorAll('thead th')].map(th => th.textContent.trim());
const cotSttCuaHang = (t) => [...t.querySelectorAll('tbody tr')].map(tr => tr.children[0].textContent.trim());

/* ================================================================================================
   1. BANG THUONG — chen cot, dem o
   ================================================================================================ */
console.log('\n=== 1. Bang danh sach thuong ===');
let t = dungBang(`<table><thead><tr><th>Ngày</th><th>Số phiếu</th><th>Số tiền</th></tr></thead>
  <tbody>
    <tr><td>06/09</td><td>PT01</td><td>100</td></tr>
    <tr><td>05/09</td><td>PT02</td><td>200</td></tr>
    <tr><td>04/09</td><td>PT03</td><td>300</td></tr>
  </tbody></table>`);
S.themCotStt(D.querySelector('.content'));
bang(dauCot(t), ['STT', 'Ngày', 'Số phiếu', 'Số tiền'], 'chen cot STT vao DAU BANG');
bang([...t.querySelectorAll('tbody tr')].map(soO), [4, 4, 4], 'moi hang du 4 o');
bang(cotSttCuaHang(t), ['1', '2', '3'], 'danh so 1,2,3');
kiem(t.querySelector('thead th').hasAttribute('data-nosort'),
  'o STT khai data-nosort (sap xep theo STT la vo nghia)');

console.log('\n  --- Chay lai: KHONG chen hai lan ---');
S.themCotStt(D.querySelector('.content'));
S.themCotStt(D.querySelector('.content'));
bang(dauCot(t), ['STT', 'Ngày', 'Số phiếu', 'Số tiền'], 'quet 3 lan van dung 1 cot STT');

/* ================================================================================================
   2. DONG "CHUA CO DU LIEU" va DONG TONG — phai NOI colspan, khong them o
   ================================================================================================ */
console.log('\n=== 2. Dong trai het bang: NOI colspan chu khong them o ===');
t = dungBang(`<table><thead><tr><th>A</th><th>B</th><th>C</th></tr></thead>
  <tbody><tr><td colspan="3" class="empty-hint">Chưa có dữ liệu</td></tr></tbody></table>`);
S.themCotStt(D.querySelector('.content'));
bang(t.querySelector('tbody td').getAttribute('colspan'), '4', 'colspan 3 -> 4');
bang(soO(t.querySelector('tbody tr')), 4, 'hang thong bao van trai du 4 o');
bang(t.querySelectorAll('tbody td').length, 1, 'KHONG them o vao dong thong bao');

t = dungBang(`<table><thead><tr><th>A</th><th>B</th><th>C</th></tr></thead>
  <tbody>
    <tr><td>x</td><td>y</td><td>1</td></tr>
    <tr data-tong><td colspan="2">TỔNG</td><td>1</td></tr>
  </tbody>
  <tfoot><tr><td colspan="3">ghi chú cuối bảng</td></tr></tfoot></table>`);
S.themCotStt(D.querySelector('.content'));
bang([...t.querySelectorAll('tbody tr')].map(soO), [4, 4], 'dong TONG gop 2 o van du 4 o');
/* Sau khi chen, o dau tien cua dong TONG la o STT moi -> o gop 2 nam o vi tri thu HAI. */
bang(t.querySelector('tbody tr[data-tong]').children[1].getAttribute('colspan'), '2',
  'dong TONG gop 2 o (KHONG trai het bang) thi THEM o, khong noi colspan');
bang(soO(t.querySelector('tfoot tr')), 4, 'dong tfoot trai het bang -> noi colspan');
bang(cotSttCuaHang(t), ['1', ''], 'dong TONG khong duoc danh so');

/* ================================================================================================
   3. LOC AN DONG -> DANH LAI 1..n LIEN MACH  (yeu cau cua Nguyen)
   ================================================================================================ */
console.log('\n=== 3. Loc an dong -> danh lai so lien mach ===');
t = dungBang(`<table><thead><tr><th>Tên</th></tr></thead><tbody>
  <tr><td>a</td></tr><tr><td>b</td></tr><tr><td>c</td></tr><tr><td>d</td></tr><tr><td>e</td></tr>
  </tbody></table>`);
S.themCotStt(D.querySelector('.content'));
bang(cotSttCuaHang(t), ['1', '2', '3', '4', '5'], 'chua loc: 1..5');
/* Gia lap dung cach wireTableSearch an dong. */
const hg = [...t.querySelectorAll('tbody tr')];
[hg[1], hg[3]].forEach(tr => { tr.style.display = 'none'; });
S.danhLaiStt(t);
bang(cotSttCuaHang(t), ['1', '', '2', '', '3'],
  'loc con 3 dong -> 1,2,3 LIEN MACH (dong an de trong, khong giu so cu)');
hg.forEach(tr => { tr.style.display = ''; });
S.danhLaiStt(t);
bang(cotSttCuaHang(t), ['1', '2', '3', '4', '5'], 'bo loc -> tro lai 1..5');

console.log('\n  --- Dong THEM MOI sau khi da co STT (luoi nhap lieu) ---');
const tb = t.querySelector('tbody');
const trMoi = D.createElement('tr');
trMoi.innerHTML = '<td>f</td>';
tb.appendChild(trMoi);
S.capNhatSttSauKhiDoi(t);
bang(soO(trMoi), 2, 'dong moi duoc va them o STT');
bang(cotSttCuaHang(t), ['1', '2', '3', '4', '5', '6'], 'dong moi duoc danh so 6');

console.log('\n  --- Doi thu tu dong (sap xep) -> so chay lai tu tren xuong ---');
tb.insertBefore(tb.lastElementChild, tb.firstElementChild);
S.danhLaiStt(t);
bang(cotSttCuaHang(t), ['1', '2', '3', '4', '5', '6'],
  'sap xep xong STT van 1..6 theo THU TU MOI (khong dinh vao dong cu)');
bang([...t.querySelectorAll('tbody tr')].map(tr => tr.children[1].textContent),
  ['f', 'a', 'b', 'c', 'd', 'e'], 'du lieu da doi thu tu that (test khong tu lua)');

/* ================================================================================================
   4. data-nostt — bang khong nen co STT
   ================================================================================================ */
console.log('\n=== 4. data-nostt ===');
t = dungBang(`<table data-nostt><thead><tr><th>Phân hệ</th><th>Xem</th></tr></thead>
  <tbody><tr><td>QLSX</td><td><input type="checkbox"></td></tr></tbody></table>`);
S.themCotStt(D.querySelector('.content'));
bang(dauCot(t), ['Phân hệ', 'Xem'], 'khai data-nostt -> KHONG chen STT');

t = dungBang(`<div data-nostt><table><thead><tr><th>A</th></tr></thead>
  <tbody><tr><td>x</td></tr></tbody></table></div>`);
S.themCotStt(D.querySelector('.content'));
bang(dauCot(t), ['A'], 'data-nostt tren the BOC NGOAI cung an');

console.log('\n  --- Bang khong the chen thi bo qua, khong vo ---');
t = dungBang('<table><tbody><tr><td>đầu phiếu, không có thead</td></tr></tbody></table>');
S.themCotStt(D.querySelector('.content'));
bang(soO(t.querySelector('tbody tr')), 1, 'bang KHONG CO thead (khoi dau phieu) -> bo qua');

/* ================================================================================================
   5. BANG DA CO STT san (95 bang cu) — khong chen hai lan, van danh lai khi loc
   ================================================================================================ */
console.log('\n=== 5. Bang da co STT san ===');
t = dungBang(`<table><thead><tr><th>STT</th><th>Tên</th></tr></thead><tbody>
  <tr><td>1</td><td>a</td></tr><tr><td>2</td><td>b</td></tr><tr><td>3</td><td>c</td></tr>
  </tbody></table>`);
S.themCotStt(D.querySelector('.content'));
bang(dauCot(t), ['STT', 'Tên'], 'KHONG chen them cot STT thu hai');
[...t.querySelectorAll('tbody tr')][1].style.display = 'none';
S.danhLaiStt(t);
bang(cotSttCuaHang(t), ['1', '', '2'],
  'bang cu cung duoc DANH LAI khi loc (truoc day in cung i+1 nen so nhay cach quang)');

console.log('\n  --- Nhan "TT" va cot dau la o TICH CHON ---');
t = dungBang(`<table><thead><tr><th>TT</th><th>Tên</th></tr></thead>
  <tbody><tr><td>1</td><td>a</td></tr></tbody></table>`);
S.themCotStt(D.querySelector('.content'));
bang(dauCot(t), ['TT', 'Tên'], 'nhan "TT" cung tinh la da co STT');

t = dungBang(`<table><thead><tr><th></th><th>STT</th><th>Tên</th></tr></thead>
  <tbody><tr><td><input type="checkbox"></td><td>1</td><td>a</td></tr></tbody></table>`);
S.themCotStt(D.querySelector('.content'));
bang(dauCot(t), ['', 'STT', 'Tên'],
  'o TICH CHON dung truoc STT van tinh la da co (soi 3 o dau, khong chi o so 1)');

/* ================================================================================================
   6. thead NHIEU HANG (tieu de nhom) -> o STT phai rowspan
   ================================================================================================ */
console.log('\n=== 6. thead nhieu hang ===');
t = dungBang(`<table><thead>
  <tr><th colspan="2">Nhóm A</th><th>C</th></tr>
  <tr><th>A1</th><th>A2</th><th>C1</th></tr></thead>
  <tbody><tr><td>1</td><td>2</td><td>3</td></tr></tbody></table>`);
S.themCotStt(D.querySelector('.content'));
bang(t.querySelector('thead th').getAttribute('rowspan'), '2',
  'thead 2 hang -> o STT rowspan=2 (khong thi lech ca khoi tieu de)');
bang(soO(t.querySelector('thead tr')), 4, 'hang tieu de dau du 4 o');
bang(soO(t.querySelector('tbody tr')), 4, 'hang du lieu du 4 o');

/* ================================================================================================
   7. VE LAI SACH innerHTML cua <table> -> phai chen lai
   ================================================================================================ */
console.log('\n=== 7. Man hinh ve lai sach ca bang ===');
t = dungBang(`<table><thead><tr><th>A</th></tr></thead><tbody><tr><td>x</td></tr></tbody></table>`);
S.themCotStt(D.querySelector('.content'));
bang(dauCot(t), ['STT', 'A'], 'lan dau: co STT');
t.innerHTML = '<thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>x</td><td>y</td></tr></tbody>';
S.themCotStt(D.querySelector('.content'));
bang(dauCot(t), ['STT', 'A', 'B'],
  'thay sach innerHTML -> nhan ra co da mat, chen lai (chi tin co la bang do het STT vinh vien)');
bang(soO(t.querySelector('tbody tr')), 3, 'hang du lieu du 3 o sau khi chen lai');

/* ================================================================================================
   8. MOC NOI VAO HE THONG
   ================================================================================================ */
console.log('\n=== 8. Moc noi vao he thong ===');
kiem(/function enhanceInputs\(root\) \{[^}]*themCotStt\(root\)/.test(sCommon),
  'themCotStt cuoi len enhanceInputs -> dung 2 moc san co (openModal .modal-body + observer .content)');
kiem(/try \{ themCotStt\(doc\); \} catch/.test(sCommon),
  'printHtml goi themCotStt cho document CUA IFRAME (ban in la document khac)');
const iStt = sCommon.indexOf('try { themCotStt(doc); } catch');
const iDo = sCommon.indexOf('function chenSoTrang()');
kiem(iStt > 0 && iDo > 0 && iStt < iDo,
  'goi TRUOC khi do trang: them cot la doi be rong/chieu cao, do truoc chen sau thi so trang sai');
kiem(/table\.ownerDocument/.test(sCommon),
  'tao the bang ownerDocument (khong phai `document`) -> chay duoc trong iframe ban in');
kiem(/__gioTheoDoiStt/.test(sCommon), 'co gan LAI bo theo doi khi tbody bi thay');
kiem(/attributeFilter: \['style', 'class', 'hidden'\]/.test(sCommon),
  'theo doi CA thuoc tinh (wireTableSearch an dong bang style.display, khong phai childList)');
kiem(/__dangDanhSo/.test(sCommon), 'co co chan tai nhap (ghi vao o STT lai kich chinh observer)');
kiem(/if \(o\.textContent !== s\) o\.textContent = s;/.test(sCommon),
  'chi ghi khi KHAC -> hoi tu sau mot luot, observer khong tu kich vo han');
kiem(/function themCotStt\(root\)[\s\S]{0,800}?catch \(e\) \{/.test(sCommon),
  'themCotStt boc try/catch -> loi cot STT khong lam gian doan ca man hinh');

/* ⚠️ Chi so cot chup san bi lech khi chen them cot — loi that, da sua. */
console.log('\n  --- Chi so cot chup san (wireTableSort) ---');
const sCongNo = doc('../frontend/js/module.congno.js');
kiem(/const cot = th\.cellIndex >= 0 \? th\.cellIndex : idx;/.test(sCongNo),
  'wireTableSort doc th.cellIndex LUC BAM, khong dung idx chup luc gan');
kiem(!/tr\.cells\[idx\]/.test(sCongNo), 'khong con cho nao dung idx chup san de lay o');
/* Ca frontend khong duoc con cho nao lay o theo chi so cung. */
const files = fs.readdirSync(path.join(G, '../frontend/js')).filter(f => f.endsWith('.js'));
const xau = [];
files.forEach(f => {
  const s = doc('../frontend/js/' + f);
  if (/nth-child\(\s*\d/.test(s)) xau.push(f + ': nth-child(so)');
  if (/\.children\[\s*\d/.test(s)) xau.push(f + ': .children[so]');
  if (/\.cells\[\s*\d/.test(s)) xau.push(f + ': .cells[so]');
});
bang(xau, [], 'khong file nao lay o bang CHI SO CUNG (chen cot la lech het)');

console.log('\n=== 9. data-nostt da khai o dung cho ===');
[['module.users.js', 4, 'ma tran phan quyen'],
 ['module.baocao.js', 2, 'bang chi tieu / khoan muc'],
 ['module.qlsx.js', 3, 'bang nang suat 1 dong + ma tran size']].forEach(([f, n, vi]) => {
  const c = (doc('../frontend/js/' + f).match(/<table data-nostt/g) || []).length;
  bang(c, n, `${f}: ${n} bang khai data-nostt (${vi})`);
});

/* ================================================================================================
   9b. CHAY TREN BANG THAT CUA UNG DUNG (khong phai bang dung tay trong test)
   ------------------------------------------------------------------------------------------------
   Bang tu dung trong test bao gio cung "de bao" hon bang that: bang that co nut Thao tac, badge,
   dong data-tong, dong empty-hint, va co ca dong "Khong tim thay ket qua" do wireTableSearch tu
   them vao SAU. Phai chay het qua duong day that moi tin duoc.
   ================================================================================================ */
console.log('\n=== 9b. Chay tren bang THAT (renderPhieuThu / renderCongNoKH) ===');
(function bangThat() {
  const sFeCongNo = doc('../frontend/js/module.congno.js');
  const d2 = new JSDOM('<body><div class="content"><div id="cnBody"></div></div></body>',
    { runScripts: 'outside-only' });
  const w2 = d2.window;
  const DL = {
    '/api/congno/phieuthu': { data: [
      /* So tien co Y DO xep GIAM (200 truoc 100) va Hinh thuc GIONG NHAU, de phep kiem sap xep
         phan biet duoc dung/sai:
           · doc DUNG cot "So tien" -> tang dan -> 100, 200
           · lech 1 cot sang "Hinh thuc" -> hai o bang nhau -> giu nguyen 200, 100
         Neu du lieu de 100 truoc 200 thi ca hai truong hop deu ra 100,200 — phep kiem vo dung. */
      { PhieuThuID: 1, SoPhieu: 'PT01', NgayThu: '2026-09-06', TenDoiTuong: 'Cty A', SoTien: 200, HinhThuc: 'Tiền mặt' },
      { PhieuThuID: 2, SoPhieu: 'PT02', NgayThu: '2026-09-05', TenDoiTuong: 'Cty B', SoTien: 100, HinhThuc: 'Tiền mặt', PhieuChiKemID: 9, SoPhieuChiKem: 'PC07' }
    ], soPhieuTiepTheo: 'PT03' },
    '/api/congno/congnokh': { data: [
      { TenDoiTuong: 'Cty A', PhaiThu: 100, DieuChinh: 0, DaThu: 40, ConNo: 60, SoPhieuBH: 1 },
      { TenDoiTuong: 'Cty B', PhaiThu: 200, DieuChinh: 0, DaThu: 0, ConNo: 200, SoPhieuBH: 2 }
    ] },
    '/api/congno/doitac': { data: [] }
  };
  Object.assign(w2, {
    apiGet: async (u) => DL[u] || { data: [] }, apiDelete: async () => ({}),
    escapeHtml: (s) => String(s == null ? '' : s), fmtNumber: (n) => String(Number(n) || 0),
    fmtTien: (n) => String(Number(n) || 0), fmtDate: (x) => String(x || '').slice(0, 10),
    searchBoxHtml: () => '<input id="dmSearchBox">', taiFile: () => {}, toast: () => {},
    openModal: () => w2.document.createElement('div'), closeModal: () => {}, printHtml: () => {},
    homNayISO: () => '2026-09-08', docSoTienBangChu: () => '', enhanceInputs: () => {},
    apiPost: async () => ({}), apiPut: async () => ({})
  });
  /* ⚠️ jsdom KHONG cai `innerText`. wireTableSort doc o bang `.innerText` nen khong va vao thi ham
     sap xep THROW giua chung, thu tu dong khong doi — va phep kiem "sap xep dung" se DAT DO MAY.
     Da mac dung bay do mot lan. Va bang textContent (du dung cho o bang thuong). */
  if (!('innerText' in w2.HTMLElement.prototype)) {
    Object.defineProperty(w2.HTMLElement.prototype, 'innerText', {
      get() { return this.textContent; }, set(v) { this.textContent = v; }, configurable: true
    });
  }
  /* wireTableSearch / wireTableSort THAT — day moi la cho de va nhau voi cot STT. */
  const thanTimKiem = catKhoi(sCommon, 'function wireTableSearch(body, id) {', '{', '}');
  w2.eval(thanTimKiem + "\nwindow.__timKiem = wireTableSearch;");
  w2.eval("const STT_NHAN = 'STT';\n" + nguon + '\nwindow.__stt = { themCotStt, danhLaiStt };');
  const sTest = sFeCongNo.replace('return { render, getTabs, soChiTietKH };',
    'return { render, getTabs, soChiTietKH, __t: { renderPhieuThu, renderCongNoKH, wireTableSort } };');
  w2.eval(sTest);
  const T2 = w2.ModuleCongNo.__t;
  const D2 = w2.document;
  const soO2 = (tr) => [...tr.children].reduce((s, c) => s + (parseInt(c.getAttribute('colspan'), 10) || 1), 0);

  return (async () => {
    /* Duong THAT cua man hinh khong-modal: render -> wireTableSearch/Sort ngay -> STT chay SAU
       (observer .content gop nhip 60ms). Dung thu tu do de bat loi lech chi so cot. */
    await T2.renderPhieuThu({ canCreate: true, canEdit: true, canDelete: true });
    const body = D2.getElementById('cnBody');
    w2.__timKiem(body);                       // them dong "Khong tim thay ket qua" (an)
    T2.wireTableSort(body);                   // chup chi so cot (neu con chup)
    w2.__stt.themCotStt(D2.querySelector('.content'));

    const t1 = body.querySelector('table');
    const soCot1 = [...t1.querySelectorAll('thead th')].length;
    bang([...t1.querySelectorAll('thead th')][0].textContent.trim(), 'STT', 'phieu thu THAT: co cot STT');
    bang([...t1.querySelectorAll('tbody tr')].map(soO2),
      [...t1.querySelectorAll('tbody tr')].map(() => soCot1),
      `phieu thu THAT: moi hang du ${soCot1} o (ke ca dong "Khong tim thay" cua wireTableSearch)`);
    bang([...t1.querySelectorAll('tbody tr')].slice(0, 2).map(tr => tr.children[0].textContent.trim()),
      ['1', '2'], 'phieu thu THAT: danh so 1,2');

    /* Bam tieu de cot "Số tiền" -> phai sap theo DUNG cot do, khong lech vi cot STT chen sau. */
    const ths = [...t1.querySelectorAll('thead th')];
    const thTien = ths.find(x => x.textContent.trim() === 'Số tiền');
    kiem(!!thTien, 'tim duoc cot "Số tiền"');
    const cotTien = thTien.cellIndex;
    const doc1 = () => [...t1.querySelectorAll('tbody tr')]
      .filter(tr => tr.children[0].hasAttribute('data-stt'))
      .map(tr => tr.children[cotTien].textContent.trim());
    bang(doc1(), ['200', '100'], 'truoc khi sap: 200 truoc 100 (du lieu co y dat vay)');
    thTien.click();
    bang(doc1(), ['100', '200'],
      '⚠️ bam "Số tiền" sap TANG DAN dung theo cot tien — lech 1 cot sang "Hình thức" thi hai o '
      + 'bang nhau, thu tu se giu nguyen 200,100 (chen cot STT KHONG lam lech chi so cot)');
    /* Sap xep xong -> STT phai chay lai 1,2 theo thu tu MOI. */
    w2.__stt.danhLaiStt(t1);
    bang([...t1.querySelectorAll('tbody tr')]
      .filter(tr => tr.children[0].hasAttribute('data-stt'))
      .map(tr => tr.children[0].textContent.trim()), ['1', '2'],
      'sap xep xong STT van 1,2 tu tren xuong');

    /* Bang cong no khach co dong TONG (data-tong) — dung bang that de kiem. */
    await T2.renderCongNoKH({ canCreate: true, canEdit: true, canDelete: true });
    w2.__stt.themCotStt(D2.querySelector('.content'));
    const t2 = body.querySelector('table');
    const soCot2 = [...t2.querySelectorAll('thead th')].length;
    bang([...t2.querySelectorAll('tbody tr')].map(soO2),
      [...t2.querySelectorAll('tbody tr')].map(() => soCot2),
      `cong no KH THAT: moi hang du ${soCot2} o (ke ca dong TONG)`);
    const dongTong = t2.querySelector('tbody tr[data-tong]');
    kiem(!!dongTong, 'bang cong no KH co dong TONG');
    bang(dongTong && dongTong.children[0].textContent.trim(), '', 'dong TONG khong bi danh so');

    console.log('\n=== 10. Bump ?v= ===');
    [['common.js', 7.84], ['module.congno.js', 7.84], ['module.users.js', 7.84],
     ['module.baocao.js', 7.84], ['module.qlsx.js', 7.84]].forEach(([f, min]) => {
      const v = (sIndex.match(new RegExp(f.replace(/\./g, '\\.') + '\\?v=([\\d.]+)')) || [])[1];
      kiem(v && parseFloat(v) >= min, `index.html: ${f}?v= >= ${min}`, String(v));
    });
  })();
})().then(() => {
  console.log('\n================================================================');
  console.log(`KET QUA: ${dat} dat / ${truot} truot`);
  process.exit(truot ? 1 : 0);
}).catch(e => { console.error('LOI TEST: ' + e.stack); process.exit(1); });
