/* ================================================================================================
   KIEM CHUNG v7.90 — BE RONG COT TREN CAC FORM NHAP/XUAT
   ------------------------------------------------------------------------------------------------
   Nguyen: "Phieu xuat phu kien cot stt cho ngan 1/2, cot o phu kien cho rong gap doi" · "cot quy doi
   cho ngan 1/2" · "cot stt the hien moi so thoi de kich thuoc du 2 so la duoc" · "Ra soat lai het
   cac form nhap xuat o stt de be thoi, cac o the hien hang hoa / phu kien cho to de de nhin" ·
   "ton cay vai: de khong tim kiem thi phom dung, tim kiem thi phom sai".

   ⚠️ HAI LOP LOI CUA v7.84 — DAY MOI LA GOC, khong phai chuyen chinh so px tung man:

   (A) themCotStt CHEN <th>/<td> MA QUEN <col>.
       <colgroup> gan be rong THEO VI TRI. Chen them mot cot dau bang ma khong chen <col> la TOAN BO
       be rong lech di mot cot. O luoi phu kien: STT an 32% cua o Phu kien, o Phu kien tut xuong 10%
       cua So luong, Quy doi phinh len 36% cua Ghi chu. Dung ba thu Nguyen bao, va vo o MOI bang co
       colgroup (phu kien, kho vai, QLSX) chu khong rieng mot man.

   (B) BANG TU CO SAN COT STT bi CHEN THEM O khi ve lai tbody.
       Ton cay vai tu render `<td>${i+1}</td>`. Khi tim kiem, no thay sach tbody; o moi khong mang
       dau `data-stt` nen capNhatSttSauKhiDoi tuong "dong nay thieu o STT" va CHEN THEM mot o ->
       dong 19 o / tieu de 18 o -> ca bang xo phai mot cot. Khong tim kiem thi khong ve lai nen phom
       van dung — dung nhu Nguyen mo ta.

   Chay:  NODE_PATH=/tmp/tsd/node_modules node utils/kiem_be_rong_cot_form.js
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
const sPK = doc('../frontend/js/module.phukien.js');
const sKV = doc('../frontend/js/module.khovai.js');
const sQlsx = doc('../frontend/js/module.qlsx.js');
const sIndex = doc('../frontend/index.html');
const { JSDOM } = require('jsdom');

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

/* Nap THAT bo STT ra chay. */
const TEN = ['function __oTraiHet(', 'function __dongKhongDanhSo(', 'function __laDongDuLieu(', 'function __soCotCuaBang(',
  'function __daCoStt(', 'function danhLaiStt(', 'function __gioTheoDoiStt(',
  'function themCotSttMotBang(', 'function capNhatSttSauKhiDoi(', 'function themCotStt('];
const nguon = TEN.map(t => catKhoi(sCommon, t, '{', '}')).join('\n');
const RONG = (sCommon.match(/const STT_RONG = '([^']+)'/) || [])[1];

function moiTruong() {
  const dom = new JSDOM('<body><div class="content"></div></body>', { runScripts: 'outside-only' });
  const w = dom.window;
  w.eval(`const STT_NHAN = 'STT'; const STT_RONG = '${RONG}';\n${nguon}`
    + '\nwindow.__stt = { themCotStt, danhLaiStt, capNhatSttSauKhiDoi };');
  return w;
}
const soO = (tr) => [...tr.children].reduce((s, c) => s + (parseInt(c.getAttribute('colspan'), 10) || 1), 0);

/* ================================================================================================
   1. BE RONG O STT — "du 2 so la duoc"
   ================================================================================================ */
console.log('\n=== 1. O STT chi vua du con so ===');
kiem(!!RONG, 'be rong o STT khai o MOT cho (STT_RONG)', String(RONG));
const px = parseInt(RONG, 10);
kiem(px >= 30 && px <= 42, `STT_RONG = ${RONG} — du 2 chu so, khong thua`, RONG);
kiem(px < 46, 'da NHO HON 46px cua ban v7.84');
kiem(/th\.style\.padding = '6px 4px'/.test(sCommon) && /td\.style\.padding = '6px 4px'/.test(sCommon),
  'bop padding o STT con 4px hai ben (mac dinh 11px, rieng padding da rong hon 2 chu so)');

/* ================================================================================================
   2. ⚠️ LOP LOI (A): chen <th> thi phai chen ca <col>
   ================================================================================================ */
console.log('\n=== 2. ⚠️ Chen cot STT phai chen ca <col> ===');
kiem(/querySelectorAll\(':scope > colgroup'\)\.forEach\(cg => \{/.test(sCommon),
  'themCotSttMotBang co chen <col> vao colgroup');

let w = moiTruong();
let D = w.document;
D.querySelector('.content').innerHTML =
  '<table class="lap-table">'
  + '<colgroup><col style="width:44%"><col style="width:10%"><col style="width:9%"><col style="width:7%"><col style="width:30%"><col style="width:42px"></colgroup>'
  + '<thead><tr><th>Phụ kiện</th><th>Số lượng</th><th>ĐVT</th><th>Quy đổi</th><th>Ghi chú</th><th></th></tr></thead>'
  + '<tbody><tr><td>a</td><td>b</td><td>c</td><td>d</td><td>e</td><td>x</td></tr></tbody></table>';
w.__stt.themCotStt(D.querySelector('.content'));
let t = D.querySelector('table');
let cols = [...t.querySelectorAll('col')].map(c => c.style.width);
let ths = [...t.querySelectorAll('thead th')].map(x => x.textContent.trim() || '(trống)');
bang(cols.length, ths.length, '⚠️ so <col> BANG so <th> sau khi chen STT');
bang(cols[0], RONG, 'col dau tien la cua STT');
bang(ths[0], 'STT', 'th dau tien la STT');
bang(cols[1], '44%', '⚠️ o Phụ kiện van an dung 44% (truoc khi sua no bi tut xuong 10%)');
/* Chen STT vao dau -> Ghi chú lui tu vi tri 4 sang 5. Dem nham chi so la loi CUA TEST. */
bang(cols[5], '30%', 'Ghi chú van an dung 30% (truoc khi sua bi day sang 42px)');
bang(ths.map((x, i) => x + '=' + cols[i]),
  ['STT=' + RONG, 'Phụ kiện=44%', 'Số lượng=10%', 'ĐVT=9%', 'Quy đổi=7%', 'Ghi chú=30%', '(trống)=42px'],
  'toan bo cot khop dung be rong cua chinh no');

console.log('\n  --- Bang KHONG co colgroup: khong duoc sinh colgroup thua ---');
w = moiTruong(); D = w.document;
D.querySelector('.content').innerHTML =
  '<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>';
w.__stt.themCotStt(D.querySelector('.content'));
bang(D.querySelectorAll('col').length, 0, 'khong tu bia ra colgroup cho bang von khong co');

/* ================================================================================================
   3. ⚠️ LOP LOI (B): bang TU CO SAN cot STT, ve lai tbody khi tim kiem
   ================================================================================================ */
console.log('\n=== 3. ⚠️ Ton cay vai: tim kiem KHONG duoc lam xo bang ===');
w = moiTruong(); D = w.document;
const THEAD = '<thead><tr><th>STT</th><th>Mã cây</th><th>Mã vải</th><th>KG còn</th><th>Thao tác</th></tr></thead>';
const DONG = (i, ma) => `<tr><td>${i}</td><td>${ma}</td><td>V-${ma}</td><td>10</td><td>Xuất kho</td></tr>`;
D.querySelector('.content').innerHTML =
  `<table id="rollsTable">${THEAD}<tbody>${DONG(1, 'C1')}${DONG(2, 'C2')}${DONG(3, 'C3')}</tbody></table>`;
w.__stt.themCotStt(D.querySelector('.content'));
t = D.querySelector('table');
const soCotDau = [...t.querySelectorAll('thead th')].length;
bang(soCotDau, 5, 'chua tim kiem: 5 cot (KHONG chen them cot STT thu hai)');
bang([...t.querySelectorAll('tbody tr')].map(soO), [5, 5, 5], 'chua tim kiem: moi dong 5 o — phom dung');

/* Gio TIM KIEM: man hinh ve lai tbody y het cach module.khovai.js dang lam. */
t.querySelector('tbody').innerHTML = DONG(1, 'C1') + DONG(2, 'C3');
w.__stt.capNhatSttSauKhiDoi(t);
bang([...t.querySelectorAll('thead th')].length, 5, 'sau tim kiem: tieu de van 5 cot');
bang([...t.querySelectorAll('tbody tr')].map(soO), [5, 5],
  '⚠️ sau tim kiem: moi dong VAN 5 o — khong chen them o (day la loi Nguyen bao)');
bang([...t.querySelectorAll('tbody tr')].map(tr => tr.children[1].textContent),
  ['C1', 'C3'], '⚠️ o thu 2 van la MA CAY (truoc khi sua no bi day thanh so STT nhan doi)');
bang([...t.querySelectorAll('tbody tr')].map(tr => tr.children[0].textContent), ['1', '2'],
  'STT van duoc danh lai 1,2 theo dong dang hien');
kiem(t.__sttCoSan === true, 'nho duoc "cot STT von co san" de khong bao gio chen o');

console.log('\n  --- Bang do CHINH bo STT sinh cot: dong moi VAN phai duoc chen o ---');
w = moiTruong(); D = w.document;
D.querySelector('.content').innerHTML =
  '<table><thead><tr><th>Tên</th><th>SL</th></tr></thead><tbody><tr><td>a</td><td>1</td></tr></tbody></table>';
w.__stt.themCotStt(D.querySelector('.content'));
t = D.querySelector('table');
kiem(t.__sttCoSan === false, 'bang nay do bo STT sinh cot');
t.querySelector('tbody').innerHTML = '<tr><td>a</td><td>1</td></tr><tr><td>b</td><td>2</td></tr>';
w.__stt.capNhatSttSauKhiDoi(t);
bang([...t.querySelectorAll('tbody tr')].map(soO), [3, 3], 'dong moi duoc va them o STT nhu cu');
bang([...t.querySelectorAll('tbody tr')].map(tr => tr.children[0].textContent), ['1', '2'], 'danh so 1,2');

/* ================================================================================================
   3b. ⚠️ v7.91 — BAN IN PHIEU BAN HANG: KHONG DUOC GHI DE NHAN CUA DONG TONG
   ------------------------------------------------------------------------------------------------
   Nguyen gui anh ban in: cac dong "TỔNG CỘNG / CK NPP / TỔNG TIỀN HÀNG / THUẾ GTGT / TỔNG TIỀN SAU
   THUẾ" MAT SACH NHAN, thay bang 2,3,4,5,6.
   Vi ban in do TU CO cot STT -> nhanh __sttCoSan danh dau `data-stt` len o dau cua MOI dong roi
   danhLaiStt() ghi de. O dau cua dong tong lai chinh la O NHAN (gop nhieu cot) -> nhan bi xoa.
   Mat nhan tren chung tu GIAO CHO KHACH la hong nang nhat trong ca nhom loi nay.
   ================================================================================================ */
console.log('\n=== 3b. ⚠️ Ban in phieu ban hang: giu nguyen nhan dong TONG ===');
w = moiTruong(); D = w.document;
/* Dung lai dung phom ban in: 10 cot, 1 dong hang, roi 5 dong tong co o nhan gop cot. */
const NHAN = ['TỔNG CỘNG', 'CK NPP (17% × tổng cộng)', 'TỔNG TIỀN HÀNG', 'THUẾ GTGT (0%)',
  'TỔNG TIỀN SAU THUẾ GTGT'];
D.querySelector('.content').innerHTML = `<table>
  <thead><tr><th>STT</th><th>MÃ + ẢNH</th><th>TÊN HÀNG</th><th>ĐVT</th><th>SỐ LƯỢNG</th>
    <th>ĐVT QUY ĐỔI</th><th>GIÁ BÁN LẺ</th><th>CK SHOP</th><th>GIÁ BÁN</th><th>THÀNH TIỀN</th></tr></thead>
  <tbody>
    <tr><td>1</td><td>A26T0221</td><td>Áo sơ mi BT 2 túi ngực</td><td>Cái</td><td>5</td>
      <td>1 Ri5</td><td>115.000</td><td>33%</td><td>77.050</td><td>385.250</td></tr>
    <tr><td colspan="4">${NHAN[0]}</td><td>46</td><td colspan="4"></td><td>5.458.490</td></tr>
    <tr><td colspan="9">${NHAN[1]}</td><td>927.943</td></tr>
    <tr><td colspan="9">${NHAN[2]}</td><td>4.530.547</td></tr>
    <tr><td colspan="9">${NHAN[3]}</td><td>0</td></tr>
    <tr><td colspan="9">${NHAN[4]}</td><td>4.530.547</td></tr>
  </tbody></table>`;
w.__stt.themCotStt(D.querySelector('.content'));
t = D.querySelector('table');
const hangIn = [...t.querySelectorAll('tbody tr')];
bang(hangIn[0].children[0].textContent, '1', 'dong hang that van duoc danh so 1');
bang(hangIn.slice(1).map(tr => tr.children[0].textContent), NHAN,
  '⚠️ 5 dong TONG GIU NGUYEN NHAN — khong bi thay bang 2,3,4,5,6');
kiem(!hangIn.slice(1).some(tr => /^[0-9]+$/.test(tr.children[0].textContent.trim())),
  'khong dong tong nao bi ghi mot con so vao o nhan');
bang(t.querySelectorAll('thead th').length, 10, 'ban in tu co STT -> KHONG chen them cot');
bang(hangIn.map(soO), [10, 10, 10, 10, 10, 10], 'moi dong van du 10 o');

console.log('\n  --- Bang KHONG co STT san + co dong tong gop o ---');
w = moiTruong(); D = w.document;
D.querySelector('.content').innerHTML = `<table>
  <thead><tr><th>Tên</th><th>SL</th><th>Tiền</th></tr></thead>
  <tbody>
    <tr><td>a</td><td>1</td><td>10</td></tr>
    <tr><td>b</td><td>2</td><td>20</td></tr>
    <tr><td colspan="2">TỔNG CỘNG</td><td>30</td></tr>
  </tbody></table>`;
w.__stt.themCotStt(D.querySelector('.content'));
t = D.querySelector('table');
const h2 = [...t.querySelectorAll('tbody tr')];
bang(h2.map(soO), [4, 4, 4], 'moi dong du 4 o sau khi chen STT');
bang(h2.map(tr => tr.children[0].textContent), ['1', '2', ''],
  '⚠️ 2 dong hang danh so 1,2; dong TONG de TRONG o STT');
bang(h2[2].children[1].textContent, 'TỔNG CỘNG', 'nhan TỔNG CỘNG con nguyen ven');

/* ================================================================================================
   4. LUOI PHU KIEN — Quy doi ngan 1/2, o Phu kien rong ra
   ================================================================================================ */
console.log('\n=== 4. Luoi phu kien ===');
const thanCols = catKhoi(sPK, 'function pkColsHtml(opts) {', '{', '}');
kiem(!!thanCols, 'cat duoc pkColsHtml');
const F = new Function(`${thanCols}\nreturn pkColsHtml;`)();
const doCol = (html) => [...html.matchAll(/width:([^"]+)"/g)].map(m => m[1]);
const tongPhanTram = (ds) => ds.filter(x => x.endsWith('%')).reduce((s, x) => s + parseFloat(x), 0);

[['XUAT (khong don gia)', {}, 5],
 ['XUAT (co don gia)', { showDonGia: true }, 7],
 ['NHAP (khong don gia)', { showLoaiFilter: true }, 6],
 ['NHAP (co don gia)', { showLoaiFilter: true, showDonGia: true }, 8]
].forEach(([ten, opts, soCotPhanTram]) => {
  const ds = doCol(F(opts));
  bang(tongPhanTram(ds), 100, `${ten}: tong % dung 100`);
  bang(ds.filter(x => x.endsWith('%')).length, soCotPhanTram, `${ten}: du ${soCotPhanTram} cot theo %`);
});

/* So sanh voi ban CU de chac chan da doi dung huong. */
console.log('\n  --- Doi chieu voi ban cu ---');
const xuat = doCol(F({}));            // Phu kien · SL · DVT · Quy doi · Ghi chu · nut
bang(xuat[0], '44%', '⚠️ o PHU KIEN rong ra (cu 32%)');
bang(xuat[3], '7%', '⚠️ cot QUY DOI ngan gan mot nua (cu 13%)');
kiem(parseFloat(xuat[0]) > 2 * parseFloat(xuat[3]) * 2,
  'o Phu kien rong hon han cot Quy doi', `${xuat[0]} vs ${xuat[3]}`);
const nhapDG = doCol(F({ showLoaiFilter: true, showDonGia: true }));
bang(nhapDG[1], '32%', 'phieu NHAP: o Phu kien cung rong ra (cu 24%)');
bang([nhapDG[4], nhapDG[6]], ['6%', '6%'], 'ca 2 cot "chi de xem" (Quy doi / Gia quy doi) deu ngan lai');

/* Chay that: colgroup + thead cua luoi phu kien phai khop nhau, KE CA sau khi chen STT. */
console.log('\n  --- Chay that: colgroup khop thead o ca 4 bien the ---');
const thanHead = catKhoi(sPK, 'function pkHeadHtml(opts) {', '{', '}');
const H = new Function(`${thanHead}\nreturn pkHeadHtml;`)();
[{}, { showDonGia: true }, { showLoaiFilter: true }, { showLoaiFilter: true, showDonGia: true }]
  .forEach((opts) => {
    const w2 = moiTruong();
    w2.document.querySelector('.content').innerHTML =
      `<table class="lap-table">${F(opts)}${H(opts)}<tbody><tr>${'<td>x</td>'.repeat(20)}</tr></tbody></table>`;
    const t2 = w2.document.querySelector('table');
    const nTh0 = t2.querySelectorAll('thead th').length;
    /* Cat bot <td> thua cho dung so cot roi moi chay (dong tren co san 20 o cho tien). */
    const tr0 = t2.querySelector('tbody tr');
    while (tr0.children.length > nTh0) tr0.removeChild(tr0.lastChild);
    w2.__stt.themCotStt(w2.document.querySelector('.content'));
    const nCol = t2.querySelectorAll('col').length, nTh = t2.querySelectorAll('thead th').length;
    bang([nCol, nTh, soO(t2.querySelector('tbody tr'))], [nTh0 + 1, nTh0 + 1, nTh0 + 1],
      `bien the ${JSON.stringify(opts)}: col = th = so o cua dong = ${nTh0 + 1}`);
  });

/* ================================================================================================
   5. RA SOAT: moi <colgroup> trong ma nguon phai co du <col> cho tung <th>
   ================================================================================================ */
console.log('\n=== 5. Ra soat moi colgroup trong ma nguon ===');
const lech = [];
[['module.khovai.js', sKV], ['module.qlsx.js', sQlsx], ['module.phukien.js', sPK]].forEach(([ten, src]) => {
  const re = /<colgroup>([\s\S]{0,900}?)<\/colgroup>([\s\S]{0,1600}?)<\/thead>/g; let m;
  while ((m = re.exec(src))) {
    if (/\$\{/.test(m[1])) continue;           // colgroup dung theo nhanh -> da kiem rieng o muc 4
    const nCol = (m[1].match(/<col\b/g) || []).length;
    const nTh = (m[2].match(/<th[\s>]/g) || []).length;
    if (nCol !== nTh) lech.push(`${ten}:${src.slice(0, m.index).split('\n').length} col=${nCol} th=${nTh}`);
  }
});
bang(lech, [], '⚠️ khong con colgroup nao thieu/thua <col> so voi so <th>');

console.log('\n=== 6. Bump ?v= ===');
[['common.js', 7.90], ['module.phukien.js', 7.90], ['module.qlsx.js', 7.90]].forEach(([f, min]) => {
  const v = (sIndex.match(new RegExp(f.replace(/\./g, '\\.') + '\\?v=([\\d.]+)')) || [])[1];
  kiem(v && parseFloat(v) >= min, `index.html: ${f}?v= >= ${min}`, String(v));
});

console.log('\n================================================================');
console.log(`KET QUA: ${dat} dat / ${truot} truot`);
process.exit(truot ? 1 : 0);
