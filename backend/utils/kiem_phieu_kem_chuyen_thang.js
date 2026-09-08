/* ================================================================================================
   KIEM CHUNG v7.83 — CAP CHUNG TU "CHUYEN THANG": PHIEU THU <-> PHIEU CHI
   ------------------------------------------------------------------------------------------------
   Nguyen: "Quan ly cong no / danh sach phieu thu them cot phieu chi gan voi phieu thu do neu
   chuyen thang."

   Nghiep vu da co tu v6.54 (migration_v675): phieu thu hinh thuc 'Chuyen thang' TU SINH mot phieu
   chi cung ngay / cung so tien, lien ket 2 chieu qua PhieuThu.PhieuChiKemID va PhieuChi.PhieuThuKemID.
   Ban nay chi LAM HIEN cap do tren danh sach + file Excel — KHONG doi phep tinh nao.

   Lam CA HAI CHIEU (phieu thu -> phieu chi VA phieu chi -> phieu thu): phieu chi sinh tu chuyen
   thang khong sua/xoa duoc tu man phieu chi, nen phai chi ro no thuoc phieu thu nao.

   ⚠️ HAI LOP LOI DE MAC:
     1. Them <th> ma quen sua colspan cua dong "chua co phieu nao" -> bang xo lech 1 o. Test DEM O
        tung hang bang jsdom (cong ca colspan), khong doc chuoi.
     2. Excel: khai cot { key: 'X' } nhung addRow lai ghi khoa khac -> cot trong tron, khong bao loi.
        Test doi chieu MOI khoa trong `cot` phai co trong doi tuong addRow.

   Chay:  NODE_PATH=/tmp/tsd/node_modules node utils/kiem_phieu_kem_chuyen_thang.js
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

const sBe = doc('routes/congno.js');
const sFe = doc('../frontend/js/module.congno.js');
const sIndex = doc('../frontend/index.html');
const sMig = doc('../database/migration_v675.sql');
const sCaiDat = doc('../database/CAI_DAT_DAY_DU.sql');

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
   1. TEN BANG / COT — khong doan, doi chieu voi file SQL
   ================================================================================================ */
console.log('\n=== 1. Ten cot lien ket co THAT trong CSDL ===');
[['PhieuThu', 'PhieuChiKemID'], ['PhieuChi', 'PhieuThuKemID']].forEach(([b, c]) => {
  kiem(new RegExp(`ALTER TABLE ${b} ADD ${c} INT NULL`).test(sMig), `migration_v675 them ${b}.${c}`);
  kiem(new RegExp(`ALTER TABLE ${b} ADD ${c} INT NULL`).test(sCaiDat),
    `CAI_DAT_DAY_DU.sql cung co ${b}.${c} (cai moi khong thieu cot)`);
});
/* Cac cot khac ma cau JOIN moi dua vao. Doi chieu voi CREATE TABLE trong file cai dat. */
const khoiBang = (t) => {
  const i = sCaiDat.indexOf('CREATE TABLE ' + t + ' (');
  return i < 0 ? '' : sCaiDat.slice(i, sCaiDat.indexOf(');', i));
};
[['PhieuThu', ['NgayThu', 'TenDoiTuong', 'SoPhieu']],
 ['PhieuChi', ['NgayChi', 'TenDoiTuong', 'NCC_ID', 'SoPhieu']]].forEach(([t, cs]) => {
  const k = khoiBang(t);
  cs.forEach(c => kiem(new RegExp('\\b' + c + '\\b').test(k), `${t}.${c} co that`));
});

/* ================================================================================================
   2. BACKEND — JOIN co DO COT, chua chay migration van chay
   ================================================================================================ */
console.log('\n=== 2. Route danh sach: JOIN co do cot ===');
const rtThu = catKhoi(sBe, "router.get('/phieuthu', requireAuth", '{', '}');
const rtChi = catKhoi(sBe, "router.get('/phieuchi', requireAuth", '{', '}');
kiem(!!rtThu && !!rtChi, 'cat duoc 2 route danh sach');

kiem(/const coCT = await coCotChuyenThang\(pool\)/.test(rtThu),
  'route /phieuthu do cot truoc khi JOIN (chua chay migration_v675 van chay)');
kiem(/const coCT = await coCotChuyenThang\(pool\)/.test(rtChi),
  'route /phieuchi do cot truoc khi JOIN');
kiem(/coCT \? `LEFT JOIN PhieuChi pc ON pc\.PhieuChiID = t\.PhieuChiKemID/.test(rtThu),
  '/phieuthu JOIN sang PhieuChi qua PhieuChiKemID');
kiem(/coCT \? 'LEFT JOIN PhieuThu pt ON pt\.PhieuThuID = c\.PhieuThuKemID'/.test(rtChi),
  '/phieuchi JOIN sang PhieuThu qua PhieuThuKemID');
kiem(/SoPhieuChiKem/.test(rtThu) && /SoPhieuThuKem/.test(rtChi),
  'moi route tra ve so phieu cua chung tu di kem');
/* Bi danh khong duoc dung trung voi bi danh da co trong chinh cau do. */
[[rtThu, ['t', 'tk', 'l', 'p', 'u', 'nh', 'pc', 'nccK']], [rtChi, ['c', 'tk', 'l', 'ncc', 'ngc', 'u', 'nh', 'pt']]]
  .forEach(([sql1, ds], i) => {
    const dem = {};
    ds.forEach(a => {
      const n = (sql1.match(new RegExp(`(?:FROM|JOIN)\\s+\\w+\\s+${a}\\b`, 'g')) || []).length;
      if (n > 1) dem[a] = n;
    });
    bang(dem, {}, `cau SQL ${i ? '/phieuchi' : '/phieuthu'}: khong co bi danh nao bi dung 2 lan`);
  });
/* Bai hoc feedback: khong (SELECT ...) trong ham gom. */
kiem(!/(SUM|COUNT|AVG|MIN|MAX)\s*\(\s*\(?\s*SELECT/i.test(rtThu + rtChi),
  'khong co subquery nao nam trong SUM/COUNT/AVG (SQL Server Msg 130)');

/* ================================================================================================
   3. FRONTEND — chay THAT 2 ham ve bang roi DEM O
   ================================================================================================ */
console.log('\n=== 3. Chay that renderPhieuThu / renderPhieuChi, dem o tung hang ===');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<body><div id="cnBody"></div></body>', { runScripts: 'outside-only' });
const w = dom.window;

const DL = {
  '/api/congno/phieuthu': {
    data: [
      { PhieuThuID: 1, SoPhieu: 'PT01', NgayThu: '2026-09-06', TenDoiTuong: 'Cty ABC', LoaiDoiTuong: 'KhachHang',
        SoPhieuBH: 'BH01', MaTK: '111', TenTK: 'Tiền mặt', SoTien: 1000000, HinhThuc: 'Tiền mặt',
        DienGiai: 'thu tiền', NguoiTao: 'Quân', PhieuChiKemID: null, SoPhieuChiKem: null, TenNhanChuyenThang: null },
      /* Dong CHUYEN THANG — dong duy nhat co chung tu di kem. */
      { PhieuThuID: 2, SoPhieu: 'PT02', NgayThu: '2026-09-05', TenDoiTuong: 'Cty XYZ', LoaiDoiTuong: 'KhachHang',
        SoPhieuBH: '', MaTK: '', TenTK: '', SoTien: 500000, HinhThuc: 'Chuyển thẳng',
        DienGiai: '', NguoiTao: 'Quân', PhieuChiKemID: 9, SoPhieuChiKem: 'PC07', TenNhanChuyenThang: 'NCC Vải Nam Định' }
    ], soPhieuTiepTheo: 'PT03'
  },
  '/api/congno/phieuchi': {
    data: [
      { PhieuChiID: 9, SoPhieu: 'PC07', NgayChi: '2026-09-05', TenNCC: 'NCC Vải Nam Định', LoaiDoiTuong: 'NhaCungCap',
        MaTK: '', TenTK: '', TinhChiPhiKD: 0, SoTien: 500000, HinhThuc: 'Chuyển thẳng', DienGiai: '',
        NguoiTao: 'Quân', PhieuThuKemID: 2, SoPhieuThuKem: 'PT02', TenNguoiNopKem: 'Cty XYZ' },
      { PhieuChiID: 10, SoPhieu: 'PC08', NgayChi: '2026-09-04', TenNCC: 'NCC khác', LoaiDoiTuong: 'NhaCungCap',
        MaTK: '112', TenTK: 'Ngân hàng', TinhChiPhiKD: 1, SoTien: 200000, HinhThuc: 'Chuyển khoản', DienGiai: '',
        NguoiTao: 'Quân', PhieuThuKemID: null, SoPhieuThuKem: null, TenNguoiNopKem: null }
    ], soPhieuTiepTheo: 'PC09'
  }
};

/* Mo them 2 ham ra de goi truc tiep — KHONG sua file that, chi sua BAN NAP TRONG TEST. */
const sTest = sFe.replace('return { render, getTabs, soChiTietKH };',
  'return { render, getTabs, soChiTietKH, __t: { renderPhieuThu, renderPhieuChi, oPhieuKem } };');
kiem(sTest !== sFe, 'mo duoc renderPhieuThu / renderPhieuChi / oPhieuKem cho test');

Object.assign(w, {
  apiGet: async (u) => DL[u] || { data: [] },
  apiDelete: async () => ({}),
  escapeHtml: (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
  fmtNumber: (n) => Number(n || 0).toLocaleString('vi-VN'),
  fmtTien: (n) => Number(n || 0).toLocaleString('vi-VN'),
  fmtDate: (d) => { const t = new Date(d); return isNaN(t) ? '' : `${String(t.getUTCDate()).padStart(2, '0')}/${String(t.getUTCMonth() + 1).padStart(2, '0')}/${t.getUTCFullYear()}`; },
  searchBoxHtml: () => '<input id="dmSearchBox">', wireTableSearch: () => {}, wireTableSort: () => {},
  taiFile: () => {}, toast: () => {}, openModal: () => w.document.createElement('div'),
  closeModal: () => {}, printHtml: () => {}, homNayISO: () => '2026-09-08',
  docSoTienBangChu: () => '', enhanceInputs: () => {}, apiPost: async () => ({}), apiPut: async () => ({})
});
w.eval(sTest);
const T = w.ModuleCongNo.__t;

(async () => {
  const soO = (tr) => [...tr.children].reduce((s, td) => s + (parseInt(td.getAttribute('colspan'), 10) || 1), 0);
  async function veVaDo(fn, nhan, cotMoi, viTri) {
    await fn({ canCreate: true, canEdit: true, canDelete: true });
    const b = w.document.getElementById('cnBody');
    const t = b.querySelector('table');
    const dauCot = [...t.querySelectorAll('thead th')].map(th => th.textContent.trim());
    console.log(`\n  --- ${nhan} ---`);
    kiem(dauCot.includes(cotMoi), `co cot "${cotMoi}"`, dauCot.join(' | '));
    bang(dauCot.indexOf(cotMoi), viTri, `cot "${cotMoi}" dat ngay sau cot "Hình thức"`);
    const hang = [...t.querySelectorAll('tbody tr')];
    bang(hang.map(soO), hang.map(() => dauCot.length),
      `moi hang du ${dauCot.length} o (them <th> ma quen sua colspan la lech o day)`);
    return { t, dauCot, hang };
  }

  const A = await veVaDo(T.renderPhieuThu, 'Danh sach PHIEU THU', 'Phiếu chi kèm', 7);
  const iA = A.dauCot.indexOf('Phiếu chi kèm');
  bang(A.hang[0].children[iA].textContent.trim(), '',
    'phieu thu THUONG -> o trong (khong rai dau gach cho co)');
  kiem(A.hang[1].children[iA].textContent.includes('PC07'), 'phieu thu CHUYEN THANG -> hien so phieu chi');
  kiem(A.hang[1].children[iA].textContent.includes('NCC Vải Nam Định'),
    'kem ten doi tuong nhan tien (biet tien chuyen cho ai, khong phai mo phieu moi biet)');
  const aA = A.hang[1].children[iA].querySelector('a.act-ct-xem');
  kiem(!!aA, 'so phieu chi BAM DUOC');
  bang([aA && aA.dataset.loai, aA && aA.dataset.id], ['PC', '9'],
    'bam ra dung loai PC + dung id (dung chung act-ct-xem/xemChungTu voi ca file)');

  const B = await veVaDo(T.renderPhieuChi, 'Danh sach PHIEU CHI (chieu nguoc)', 'Phiếu thu kèm', 7);
  const iB = B.dauCot.indexOf('Phiếu thu kèm');
  const aB = B.hang[0].children[iB].querySelector('a.act-ct-xem');
  kiem(!!aB, 'phieu chi sinh tu chuyen thang -> hien so phieu thu, bam duoc');
  bang([aB && aB.dataset.loai, aB && aB.dataset.id], ['PT', '2'], 'bam ra dung loai PT + dung id');
  bang(B.hang[1].children[iB].textContent.trim(), '', 'phieu chi thuong -> o trong');

  console.log('\n  --- Dong "chua co phieu nao" cung phai du o ---');
  DL['/api/congno/phieuthu'] = { data: [], soPhieuTiepTheo: 'PT01' };
  const C = await veVaDo(T.renderPhieuThu, 'PHIEU THU rong', 'Phiếu chi kèm', 7);
  bang(C.hang.length, 1, 'so rong -> 1 hang thong bao');

  console.log('\n  --- oPhieuKem: mot ban dung cho CA HAI chieu ---');
  bang(T.oPhieuKem(null, null, 'PC', 'X'), '', 'khong co chung tu kem -> chuoi rong');
  bang(T.oPhieuKem(5, null, 'PC', 'X'), '', 'co id nhung thieu so phieu -> chuoi rong (khong ve link hong)');
  kiem(T.oPhieuKem(5, 'PC01', 'PC', 'NCC A').includes('Chuyển thẳng cho: NCC A'), 'nhan chieu THU->CHI');
  kiem(T.oPhieuKem(5, 'PT01', 'PT', 'Cty B').includes('Thu từ: Cty B'), 'nhan chieu CHI->THU');
  kiem(T.oPhieuKem(5, '<b>x</b>', 'PC', '<i>y</i>').indexOf('<b>x</b>') < 0,
    'so phieu / ten deu qua escapeHtml (khong chen thang HTML tu CSDL)');

  /* ============================================================================================
     4. EXCEL — moi khoa khai trong `cot` phai duoc addRow ghi that
     ============================================================================================ */
  console.log('\n=== 4. Excel: khoa cot khai ra phai duoc ghi ===');
  [['sheetPhieuThu', 'Phiếu chi kèm', 'SoPhieuChiKem'],
   ['sheetPhieuChi', 'Phiếu thu kèm', 'SoPhieuThuKem']].forEach(([ten, header, khoa]) => {
    const than = catKhoi(sBe, `async function ${ten}(`, '{', '}');
    kiem(!!than, `cat duoc ${ten}`);
    kiem(than.includes(`{ header: '${header}', key: '${khoa}'`), `${ten}: khai cot "${header}"`);
    /* Loi kinh dien: khai key nhung addRow ghi khoa khac -> cot trong tron, khong bao loi. */
    const addRow = catKhoi(than, 'rows.forEach(r => ws.addRow(', '{', '}');
    kiem(addRow.includes(khoa + ':'), `${ten}: addRow CO ghi khoa ${khoa} (khong de cot trong tron)`);
    /* Va nguoc lai: moi key khai trong `cot` deu phai xuat hien trong addRow. */
    const cotArr = catKhoi(than, 'const cot = [', '[', ']');
    const thieu = [...cotArr.matchAll(/key: '([A-Za-z0-9_]+)'/g)].map(m => m[1])
      .filter(k => !addRow.includes(k + ':'));
    bang(thieu, [], `${ten}: khong con khoa nao khai ma khong ghi`);
    kiem(new RegExp(`${ten === 'sheetPhieuThu' ? "cT" : "cC"}\\.has\\('${ten === 'sheetPhieuThu' ? 'PhieuChiKemID' : 'PhieuThuKemID'}'\\)`).test(than),
      `${ten}: do cot truoc khi JOIN (chua chay migration van xuat duoc file)`);
  });

  console.log('\n=== 5. Bump ?v= ===');
  const v = (sIndex.match(/module\.congno\.js\?v=([\d.]+)/) || [])[1];
  kiem(v && parseFloat(v) >= 7.83, 'index.html: module.congno.js?v= >= 7.83', String(v));

  console.log('\n================================================================');
  console.log(`KET QUA: ${dat} dat / ${truot} truot`);
  process.exit(truot ? 1 : 0);
})().catch(e => { console.error('LOI TEST: ' + e.stack); process.exit(1); });
