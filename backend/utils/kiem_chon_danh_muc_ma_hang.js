/* ================================================================================================
   KIEM CHUNG v7.86 — CHON DANH MUC THE KHO CHO MA HANG
   ------------------------------------------------------------------------------------------------
   Nguyen: "phan danh muc hang hoa (ma hang) them phan chon danh muc khi sua ma hang hay khi tao moi
   o phieu nhap kho. Phieu nhap kho them chon danh muc khi tao ma hang moi ap cho ca phieu."

   HAI VIEC:
     A. Danh muc -> Hang hoa: form Them/Sua co o "Danh muc the kho"; bang hien TEN chu khong hien ID.
     B. Phieu nhap kho: MOT o o dau phieu, ap cho MOI ma MOI cua phieu.

   ⚠️ BA CHO DE SAI, moi cho co assert rieng:
     1. CHI AP CHO MA MOI. Ma da co trong danh muc thi thong tin cap ma hang sua o Danh muc -> Hang
        hoa (quy tac v6.99). Ap bua o phieu nhap la luu mot cai doi luon danh muc cua hang dang ban.
     2. O CHON PHAI XOA DUOC. capNhatMaHang boc ISNULL cho moi truong => chon "— khong —" xong bam
        Luu bao nhieu lan cung khong bo duoc danh muc. Cung bay da gap voi TenHoaDon o v7.46.
     3. NHUNG CLIENT KHONG GUI TRUONG NAY THI TUYET DOI KHONG DUOC COI LA XOA (hasOwnProperty).

   Chay:  NODE_PATH=/tmp/tsd/node_modules node utils/kiem_chon_danh_muc_ma_hang.js
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

const sDM = doc('routes/danhmuc.js');
const sUtil = doc('utils/maHangCapNhat.js');
const sFeDM = doc('../frontend/js/module.danhmuc.js');
const sFeNK = doc('../frontend/js/module.nhapkho.js');
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

/* ================================================================================================
   1. BACKEND — doc / ghi / xoa duoc
   ================================================================================================ */
console.log('\n=== 1. Backend danh muc hang hoa ===');
const rtGet = catKhoi(sDM, "router.get('/hanghoa'", '{', '}');
kiem(/h\.TheKhoDanhMucID/.test(rtGet),
  'GET /hanghoa tra ve CA ID (form Sua can ID de chon san) chu khong chi TenTheKho');
kiem(/tk\.TenTheKho/.test(rtGet), 'van tra ve TenTheKho de bang hien ten');

const rtPost = catKhoi(sDM, "router.post('/hanghoa'", '{', '}');
kiem(/INSERT INTO TheKhoHangHoa[\s\S]*TheKhoDanhMucID/.test(rtPost),
  'POST /hanghoa: THEM MOI cung luu danh muc (khong bat mo lai form Sua)');
kiem(/\.input\('TheKhoDanhMucID', sql\.Int, b\.TheKhoDanhMucID \|\| null\)/.test(rtPost),
  'POST nhan TheKhoDanhMucID, de trong -> NULL');

console.log('\n  --- ⚠️ O chon phai XOA duoc ---');
kiem(/const guiDM = Object\.prototype\.hasOwnProperty\.call\(f, 'theKhoDanhMucId'\)/.test(sUtil),
  'capNhatMaHang phan biet "co gui" voi "khong gui" bang hasOwnProperty');
kiem(/TheKhoDanhMucID = \$\{guiDM \? '@TheKhoDanhMucID' : 'ISNULL\(@TheKhoDanhMucID, TheKhoDanhMucID\)'\}/.test(sUtil),
  'CO gui -> ghi thang (xoa duoc); KHONG gui -> ISNULL (giu nguyen)');
const rtPut = catKhoi(sDM, "router.put('/hanghoa/:id'", '{', '}');
kiem(/hasOwnProperty\.call\(b, 'TheKhoDanhMucID'\) \? \{ theKhoDanhMucId: b\.TheKhoDanhMucID \} : \{\}/.test(rtPut),
  '⚠️ PUT chi truyen khoa khi client CO gui — dat san undefined la thanh "xoa"');
kiem(!/theKhoDanhMucId: b\.TheKhoDanhMucID,/.test(rtPut),
  'khong con cho nao truyen thang khoa (se lam client cu xoa mat danh muc)');

/* Chay THAT capNhatMaHang de xem cau SQL sinh ra. */
console.log('\n  --- Chay that capNhatMaHang, doc cau SQL sinh ra ---');
const thanCapNhat = catKhoi(sUtil, 'async function capNhatMaHang(', '{', '}');
kiem(!!thanCapNhat, 'cat duoc capNhatMaHang');
async function chayCapNhat(f) {
  const daChay = [];
  const rq = () => ({
    _in: {},
    input(k, t, v) { this._in[k] = v; return this; },
    async query(q) {
      daChay.push({ q: String(q).replace(/\s+/g, ' ').trim(), tham: { ...this._in } });
      if (/SELECT MaHangID, MaHang FROM/.test(q)) return { recordset: [{ MaHangID: 7, MaHang: 'AO01' }] };
      if (/SELECT LoaiRi, DonViCoBan/.test(q)) return { recordset: [{ LoaiRi: 1, DonViCoBan: 'Cái', DonViQuyDoi: 'Ri' }] };
      return { recordset: [] };
    }
  });
  const pool = { request: rq };
  const F = new Function('sql', 'chuanMaHang', 'coCotTenHoaDon',
    `${thanCapNhat}\nreturn capNhatMaHang;`)(
      { Int: 'Int', NVarChar: 'NVarChar', Decimal: () => 'Decimal' },
      (x) => String(x || '').trim().toUpperCase(),
      async () => false);
  await F(pool, null, 7, f);
  return daChay.find(x => /UPDATE TheKhoHangHoa/.test(x.q));
}

(async () => {
  let u = await chayCapNhat({ tenHang: 'Áo thu', theKhoDanhMucId: '3' });
  kiem(/TheKhoDanhMucID = @TheKhoDanhMucID/.test(u.q), 'chon danh muc 3 -> ghi thang');
  bang(u.tham.TheKhoDanhMucID, '3', 'gui dung gia tri 3');

  u = await chayCapNhat({ tenHang: 'Áo thu', theKhoDanhMucId: '' });
  kiem(/TheKhoDanhMucID = @TheKhoDanhMucID/.test(u.q), '⚠️ chon "— khong —" -> ghi thang (XOA duoc)');
  bang(u.tham.TheKhoDanhMucID, null, 'gia tri gui xuong la NULL');

  u = await chayCapNhat({ tenHang: 'Áo thu' });
  kiem(/TheKhoDanhMucID = ISNULL\(@TheKhoDanhMucID, TheKhoDanhMucID\)/.test(u.q),
    '⚠️ KHONG gui truong -> ISNULL, giu nguyen danh muc dang co');

  /* ============================================================================================
     2. FRONTEND — Danh muc -> Hang hoa
     ============================================================================================ */
  console.log('\n=== 2. Danh muc -> Hang hoa (chay that trong jsdom) ===');
  const d1 = new JSDOM('<body><div id="dmBody"></div></body>', { runScripts: 'outside-only' });
  const w1 = d1.window;
  const API = {
    '/api/danhmuc/donvitinh': { data: [{ TenDonVi: 'Cái' }, { TenDonVi: 'Ri' }] },
    '/api/danhmuc/thekhodanhmuc': { data: [
      { TheKhoDanhMucID: 3, TenTheKho: 'Đồ bé trai' }, { TheKhoDanhMucID: 5, TenTheKho: 'Đồ bé gái' }] }
  };
  Object.assign(w1, {
    apiGet: async (u) => API[u] || { data: [] }, apiPost: async () => ({}), apiPut: async () => ({}),
    apiDelete: async () => ({}), escapeHtml: (s) => String(s == null ? '' : s),
    fmtNumber: (n) => String(n), fmtDate: (x) => String(x || ''), toast: () => {},
    searchBoxHtml: () => '<input id="dmSearchBox">', wireTableSearch: () => {},
    openModal: (h) => { const e = w1.document.createElement('div'); e.innerHTML = h; w1.document.body.appendChild(e); return e; },
    closeModal: () => {}, enhanceInputs: () => {}, uploadFile: async () => '', anhNho: (x) => x
  });
  const sTest1 = sFeDM.replace('return { render, getTabs };',
    'return { render, getTabs, __t: { renderTabBody, openCustomForm, fieldHtml, datTab: (k) => { activeTab = k; } } };');
  kiem(sTest1 !== sFeDM, 'mo duoc noi bo module.danhmuc.js cho test');
  w1.eval(sTest1);
  const T1 = w1.ModuleDanhMuc.__t;

  const tabHH = w1.ModuleDanhMuc.getTabs().find(t => t.key === 'hanghoa');
  kiem(!!tabHH, 'tim duoc tab "Hàng hóa (mã hàng)"');
  const rowsHH = [
    { MaHangID: 7, MaHang: 'AO01', TenHang: 'Áo thu', DonViCoBan: 'Cái', DonViQuyDoi: 'Ri',
      LoaiRi: 5, GiaBan: 100, TheKhoDanhMucID: 3, TenTheKho: 'Đồ bé trai' },
    { MaHangID: 8, MaHang: 'AO02', TenHang: 'Áo đông', DonViCoBan: 'Cái', DonViQuyDoi: 'Ri',
      LoaiRi: 5, GiaBan: 200, TheKhoDanhMucID: null, TenTheKho: null }
  ];
  /* Chay DUNG duong that: renderTabBody() tu goi apiGet(tab.api) roi re nhanh 'hanghoa'. */
  API['/api/danhmuc/hanghoa'] = { data: rowsHH };
  const body1 = w1.document.getElementById('dmBody');
  T1.datTab('hanghoa');
  await T1.renderTabBody({ canCreate: true, canEdit: true, canDelete: true });

  const dauCot = [...body1.querySelectorAll('thead th')].map(th => th.textContent.trim());
  kiem(dauCot.includes('Danh mục thẻ kho'), 'bang co cot "Danh mục thẻ kho"', dauCot.join(' | '));
  const iDM = dauCot.indexOf('Danh mục thẻ kho');
  const o = [...body1.querySelectorAll('tbody tr')].map(tr => tr.children[iDM].textContent.trim());
  bang(o, ['Đồ bé trai', ''],
    '⚠️ bang hien TEN danh muc, KHONG hien ID (o chon luu ID nen de mac dinh la ra day so vo nghia)');

  console.log('\n  --- Form Sua: chon san dung danh muc dang co ---');
  /* BAM DUNG nut "Sửa" tren bang (chay ca wireRowActions), khong goi thang openCustomForm — goi thang
     thi phai tu truyen danh sach truong, tuc la test tu dung bo truong cua rieng no chu khong phai
     bo truong ma man hinh that dang dung. */
  const hang = [...body1.querySelectorAll('tbody tr')];
  hang[0].querySelector('.act-edit').click();
  const modal = [...w1.document.body.children].pop();
  const sel = modal.querySelector('select[name="TheKhoDanhMucID"]');
  kiem(!!sel, 'form Sua co o chon TheKhoDanhMucID');
  bang(sel && sel.value, '3', 'chon san dung danh muc dang luu cua ma');
  bang([...sel.options].map(x => x.textContent), ['— không —', 'Đồ bé trai', 'Đồ bé gái'],
    'du muc "— không —" de BO danh muc');
  hang[1].querySelector('.act-edit').click();
  bang([...w1.document.body.children].pop().querySelector('select[name="TheKhoDanhMucID"]').value, '',
    'ma chua co danh muc -> o chon de trong');

  /* ============================================================================================
     3. PHIEU NHAP KHO — ap cho ca phieu
     ============================================================================================ */
  console.log('\n=== 3. Phieu nhap kho: ap danh muc cho CA PHIEU ===');
  kiem(/id="nkfDmChung"/.test(sFeNK), 'co o chon o dau phieu');
  kiem(/Danh mục thẻ kho cho <b>mã mới<\/b>/.test(sFeNK), 'nhan noi ro chi ap cho MA MOI');
  const thanAp = catKhoi(sFeNK, 'const apDmChoMaMoi = (ghiDe) => {', '{', '}');
  kiem(!!thanAp, 'cat duoc apDmChoMaMoi');
  kiem(/if \(d\.maHangId\) return;/.test(thanAp),
    '⚠️ ma DA CO (co maHangId) thi KHONG dung den — thong tin cap ma hang sua o Danh muc');
  kiem(/if \(!ghiDe && d\.theKhoDanhMucId\) return;/.test(thanAp),
    'dong da chon rieng thi lan ve sau khong bi ghi de');
  kiem(/if \(!ghiDe && !dmChungPhieu\) return;/.test(thanAp),
    'chua chon gi thi khong dung vao dong nao');
  kiem(/apDmChoMaMoi\(true\)/.test(sFeNK), 'bam chon -> ghi de ca cac dong da chon (hanh dong ro rang)');
  kiem(/apDmChoMaMoi\(false\)/.test(catKhoi(sFeNK, 'function veDong() {', '{', '}')),
    'ma go SAU khi da chon danh muc chung cung duoc ap (goi trong veDong)');
  /* Thu tu: ap TRUOC dongBoMaMoi thi dong khai moi co gia tri de toa sang cac dong cung ma.
     ⚠️ PHAI BO GHI CHU truoc khi so vi tri — chinh ghi chu giai thich thu tu cung nhac ten
     `dongBoMaMoi()`, va no dung TRUOC loi goi that, nen indexOf bat nham vao ghi chu va bao SAI
     trong khi code dung. Da mac dung bay do. */
  const boGhiChu = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const thanVe = boGhiChu(catKhoi(sFeNK, 'function veDong() {', '{', '}'));
  kiem(thanVe.indexOf('apDmChoMaMoi(false)') >= 0
    && thanVe.indexOf('apDmChoMaMoi(false)') < thanVe.indexOf('dongBoMaMoi()'),
    'ap TRUOC dongBoMaMoi() — nguoc lai thi cac dong cung ma khong nhan duoc');

  console.log('\n  --- Chay that vong lap ap danh muc ---');
  /* Chay dung than ham that voi 4 dong: 2 ma moi, 1 ma da co, 1 ma moi da chon rieng. */
  function chayAp(dmChung, ghiDe, dong) {
    const F = new Function('dongForm', 'dmChungPhieu',
      `const apDmChoMaMoi = ${thanAp.slice(thanAp.indexOf('('))};\napDmChoMaMoi(${ghiDe});\nreturn dongForm;`);
    return F(dong, dmChung);
  }
  const mau = () => ([
    { idx: 1, maHangId: null, maHang: 'MOI1', theKhoDanhMucId: null },
    { idx: 2, maHangId: null, maHang: 'MOI1', theKhoDanhMucId: null },
    { idx: 3, maHangId: 99, maHang: 'DACO', theKhoDanhMucId: 7 },
    { idx: 4, maHangId: null, maHang: 'MOI2', theKhoDanhMucId: 5 }
  ]);
  let ds = chayAp('3', true, mau());
  bang(ds.map(d => d.theKhoDanhMucId), ['3', '3', 7, '3'],
    'bam chon: moi ma MOI nhan danh muc 3; ma DA CO giu nguyen 7');
  ds = chayAp('3', false, mau());
  bang(ds.map(d => d.theKhoDanhMucId), ['3', '3', 7, 5],
    've lai: chi dien vao o CON TRONG; dong 4 da chon rieng (5) va ma da co (7) giu nguyen');
  ds = chayAp('', false, mau());
  bang(ds.map(d => d.theKhoDanhMucId), [null, null, 7, 5], 'chua chon gi -> khong doi dong nao');
  ds = chayAp('', true, mau());
  bang(ds.map(d => d.theKhoDanhMucId), [null, null, 7, null],
    'chon lai muc rong -> bo danh muc o cac ma MOI, ma da co van nguyen');

  console.log('\n  --- O chon tung dong van con ---');
  kiem(/class="nk-dmthekho"/.test(sFeNK), 'dong khai van co o "Danh mục thẻ kho" rieng');
  kiem(/g\('\.nk-dmthekho'\)\.onchange/.test(sFeNK), 'o rieng van noi day duoc');

  console.log('\n=== 4. Bump ?v= ===');
  [['module.danhmuc.js', 7.86], ['module.nhapkho.js', 7.86]].forEach(([f, min]) => {
    const v = (sIndex.match(new RegExp(f.replace(/\./g, '\\.') + '\\?v=([\\d.]+)')) || [])[1];
    kiem(v && parseFloat(v) >= min, `index.html: ${f}?v= >= ${min}`, String(v));
  });

  console.log('\n================================================================');
  console.log(`KET QUA: ${dat} dat / ${truot} truot`);
  process.exit(truot ? 1 : 0);
})().catch(e => { console.error('LOI TEST: ' + e.stack); process.exit(1); });
