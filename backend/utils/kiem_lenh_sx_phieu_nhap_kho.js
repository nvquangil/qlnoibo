/* ================================================================================================
   KIEM CHUNG v7.87 — LENH SX <-> PHIEU NHAP KHO
   ------------------------------------------------------------------------------------------------
   Nguyen:
     (1) "nhung lenh sx da nhap kho khong hien o phieu nhap kho nua. Them dau tich nhap bo sung lenh
          da nhap o phan chon lenh san xuat da nhap truoc do (hien thi lai cac lenh san xuat de nhap
          bo sung)"
     (2) "Danh sach lenh san xuat them cot phieu nhap kho khi da nhap kho hien phieu nhap kho cho
          lenh do vao. Khi in phieu cua lenh san xuat do co phieu nhap kho va ngay nhap kho"

   ⚠️ BON CHO DE SAI, moi cho co assert rieng:
     1. MAC DINH VAN PHAI BO lenh da nhap (v6.89) — chi khi nguoi dung CHU DONG tich moi hien lai.
        De mac dinh hien la mo duong nhap trung ca lenh, loi nang hon la thieu tien ich.
     2. MO FORM SUA van phai giu lenh cua CHINH phieu do (?phieuNKID=) — bo mat la bam Luu thanh
        mat lien ket lenh SX, am tham.
     3. Subquery TUYET DOI khong long trong SUM/COUNT/AVG (SQL Server Msg 130 -> man hinh trang;
        da lam vo production o v7.62).
     4. Them <th> ma quen sua colspan dong "chua co lenh nao" -> bang lech dung 1 o. DEM O bang jsdom.

   Chay:  NODE_PATH=/tmp/tsd/node_modules node utils/kiem_lenh_sx_phieu_nhap_kho.js
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

const sQlsx = doc('routes/qlsx.js');
const sNK = doc('routes/nhapkho.js');
const sFeQlsx = doc('../frontend/js/module.qlsx.js');
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
const boGhiChu = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

/* ================================================================================================
   1. MOT BAN CONG THUC DUY NHAT cho 2 cot phieu nhap kho
   ================================================================================================ */
console.log('\n=== 1. Mot ban cong thuc duy nhat ===');
kiem(/const COT_PHIEU_NHAP_KHO = \(bd\) =>/.test(sQlsx), 'co COT_PHIEU_NHAP_KHO nhan bi danh bang');
bang((sQlsx.match(/COT_PHIEU_NHAP_KHO\('d'\)/g) || []).length, 2,
  'dung o DUNG 2 cho: danh sach lenh (GET /orders) + doc lenh cho ban in (getOrderByMaDH)');
bang((boGhiChu(sQlsx).match(/AS SoPhieuNhapKho/g) || []).length, 1,
  '⚠️ chi con MOT cho viet cau SQL do (viet 2 lan la som muon lech, vd mot ben quen loai "Đã hủy")');
const thanCot = catKhoi(sQlsx, 'const COT_PHIEU_NHAP_KHO = (bd) => `', '`', '`') || sQlsx;
kiem(/TrangThai <> N'Đã hủy'/.test(sQlsx.slice(sQlsx.indexOf('const COT_PHIEU_NHAP_KHO'), sQlsx.indexOf('const COT_PHIEU_NHAP_KHO') + 900)),
  'loai phieu ĐÃ HỦY ra khoi ca so phieu lan ngay nhap');
kiem(/MAX\(pk2\.NgayNhap\)/.test(sQlsx), 'ngay nhap lay lan GAN NHAT (MAX) — lenh nhap nhieu dot');
kiem(/FOR XML PATH\(''\)/.test(sQlsx), 'nhieu phieu -> gop thanh mot chuoi');

console.log('\n  --- ⚠️ Khong subquery trong ham gom ---');
const sachQlsx = boGhiChu(sQlsx);
kiem(!/(SUM|COUNT|AVG|MIN|MAX)\s*\(\s*\(?\s*SELECT/i.test(sachQlsx),
  'qlsx.js: khong co subquery nao nam trong SUM/COUNT/AVG/MIN/MAX');
kiem(!/(SUM|COUNT|AVG|MIN|MAX)\s*\(\s*\(?\s*SELECT/i.test(boGhiChu(sNK)),
  'nhapkho.js: khong co subquery nao nam trong SUM/COUNT/AVG/MIN/MAX');

/* ================================================================================================
   2. NHAP BO SUNG — chay THAT cau SQL sinh ra o route /danhmuc
   ================================================================================================ */
console.log('\n=== 2. Nhap bo sung: cau SQL sinh ra ===');
const rtDM = catKhoi(sNK, "router.get('/danhmuc', requireAuth", '{', '}');
kiem(!!rtDM, 'cat duoc route /nhapkho/danhmuc');

/* Chay dung than route voi pool gia, ghi lai moi cau SQL. */
async function chayDanhMuc(query) {
  const daChay = [];
  const pool = { request: () => ({ query: async (t) => { daChay.push(String(t).replace(/\s+/g, ' ').trim()); return { recordset: [] }; } }) };
  const F = new Function('getPool', 'coCotTenHoaDon', 'req', 'res',
    `return (async () => { ${rtDM.slice(rtDM.indexOf('{') + 1, rtDM.lastIndexOf('}'))} })();`);
  await F(async () => pool, async () => false, { query }, { json: () => {} });
  return daChay.find(x => /FROM DonHangSanXuat d/.test(x)) || '';
}

(async () => {
  let sql1 = await chayDanhMuc({});
  kiem(/NOT EXISTS \(SELECT 1 FROM PhieuNhapKhoHang p/.test(sql1),
    '⚠️ MAC DINH van BO lenh da nhap kho (giu nguyen quy tac v6.89)');
  kiem(/SoPhieuDaNhap/.test(sql1) && /SoPhieuGanNhat/.test(sql1),
    'tra ve so phieu da nhap + so phieu gan nhat de o chon ghi ro');

  sql1 = await chayDanhMuc({ keCaDaNhap: '1' });
  kiem(!/NOT EXISTS \(SELECT 1 FROM PhieuNhapKhoHang p\b/.test(sql1),
    'tich "Nhập bổ sung" (?keCaDaNhap=1) -> GIU LAI ca lenh da nhap kho');
  kiem(/TrangThai = N'Hoàn thành'/.test(sql1),
    'van chi lay lenh DA HOAN THANH (nhap kho lenh dang chay la lech so hoan thanh voi ton)');

  sql1 = await chayDanhMuc({ phieuNKID: '42' });
  kiem(/p\.PhieuNKID <> 42/.test(sql1),
    '⚠️ mo form SUA van giu lenh cua CHINH phieu do (bo mat la bam Luu thanh mat lien ket)');

  sql1 = await chayDanhMuc({ phieuNKID: "1; DROP TABLE X" });
  kiem(/p\.PhieuNKID <> 1\b/.test(sql1) && !/DROP TABLE/.test(sql1),
    'phieuNKID qua parseInt -> khong chen duoc chuoi la vao cau SQL');

  console.log('\n  --- Frontend: o tich + nap lai ---');
  kiem(/id="nkfKeDaNhap"/.test(sFeNK), 'co o tich "Nhập bổ sung"');
  kiem(/Nhập bổ sung — hiện cả lệnh SX đã nhập kho/.test(sFeNK), 'nhan noi ro tac dung');
  kiem(/keCaDaNhap=1/.test(sFeNK), 'nap lai bang CHINH route /nhapkho/danhmuc, chi them tham so');
  bang((sFeNK.match(/apiGet\('\/api\/nhapkho\/danhmuc'/g) || []).length >= 1, true,
    'khong viet endpoint thu hai chi de lay them may lenh');
  kiem(/let keDaNhap = false;/.test(sFeNK),
    '⚠️ MO FORM la ve trang thai mac dinh (khong nho lua chon lan truoc, keo lan sau vo tinh thay lenh da nhap)');
  kiem(/⚠️ đã nhập \$\{d2\.SoPhieuDaNhap\} phiếu/.test(sFeNK),
    'o chon danh dau ro lenh nao da nhap va may phieu');
  kiem(/Không còn lệnh SX nào chưa nhập kho/.test(sFeNK),
    'het lenh chua nhap -> chi duong tich "Nhập bổ sung" thay vi de trong tro');

  /* ============================================================================================
     3. DANH SACH LENH SX — cot moi, DEM O
     ============================================================================================ */
  console.log('\n=== 3. Danh sach lenh SX: cot Phieu nhap kho ===');
  const d2 = new JSDOM('<body><div class="content"><div id="qBody"></div></div></body>',
    { runScripts: 'outside-only' });
  const w2 = d2.window;
  const DL = {
    '/api/qlsx/orders': { data: [
      { DonHangID: 1, MaDH: 'DH2609001', TenSanPham: 'Áo thu', MaRap: 'R1', TenKhachHang: 'Cty A',
        TongSoLuong: 100, NgayDat: '2026-09-01', NgayGiaoDuKien: '2026-09-20', TenCongDoan: 'Kho nhập',
        PhanTramHoanThanh: 100, TrangThai: 'Hoàn thành', SoPhieuNhapKho: 'NK0001, NK0007', NgayNhapKho: '2026-09-06' },
      { DonHangID: 2, MaDH: 'DH2609002', TenSanPham: 'Áo đông', MaRap: 'R2', TenKhachHang: 'Cty B',
        TongSoLuong: 50, NgayDat: '2026-09-02', NgayGiaoDuKien: '2026-09-25', TenCongDoan: 'May',
        PhanTramHoanThanh: 40, TrangThai: 'Đang sản xuất', SoPhieuNhapKho: null, NgayNhapKho: null }
    ] },
    '/api/qlsx/congdoan': { data: [] }, '/api/qlsx/nhagiacong': { data: [] }
  };
  Object.assign(w2, {
    apiGet: async (u) => DL[u] || { data: [] }, apiPost: async () => ({}), apiPut: async () => ({}),
    apiDelete: async () => ({}), escapeHtml: (s) => String(s == null ? '' : s),
    fmtNumber: (n) => String(Number(n) || 0),
    fmtDate: (x) => { const t = new Date(x); return isNaN(t) ? '' : `${String(t.getUTCDate()).padStart(2, '0')}/${String(t.getUTCMonth() + 1).padStart(2, '0')}/${t.getUTCFullYear()}`; },
    fmtQuyDoi: (n) => String(n), toast: () => {}, searchBoxHtml: () => '<input id="s">',
    wireTableSearch: () => {}, openModal: () => w2.document.createElement('div'), closeModal: () => {},
    printHtml: (t, h) => { w2.__banIn = h; }, homNayISO: () => '2026-09-08', uploadFile: async () => '',
    anhNho: (x) => x, enhanceInputs: () => {}, taiFile: () => {}, choAnhTai: async () => {},
    statusWithStage: (t) => String(t || ''), docSoTienBangChu: () => ''
  });
  /* v7.92: renderOrders nay dung boDau() de dung chuoi tim kiem. LAY BAN THAT tu common.js chu
     KHONG go lai o day — go lai la hai ban cong thuc, sua mot ben test van xanh. */
  const sCommon = doc('../frontend/js/common.js');
  const nguonBoDau = catKhoi(sCommon, 'function boDau(', '{', '}');
  kiem(!!nguonBoDau, 'cat duoc boDau() that tu common.js');
  w2.eval(nguonBoDau + '\nwindow.boDau = boDau;');
  const sTest = sFeQlsx.replace('return { render, getTabs, printLenhSanXuat };',
    'return { render, getTabs, printLenhSanXuat, __t: { renderOrders, bangThongTinBaoCao } };');
  kiem(sTest !== sFeQlsx, 'mo duoc renderOrders + bangThongTinBaoCao cho test');
  w2.eval(sTest);
  const T = w2.ModuleQLSX.__t;

  await T.renderOrders({ canEdit: true, canDelete: true }, { canEdit: true }, { canView: true });
  const t3 = w2.document.getElementById('qBody').querySelector('table');
  const dauCot = [...t3.querySelectorAll('thead th')].map(th => th.textContent.trim());
  kiem(dauCot.includes('Phiếu nhập kho'), 'bang co cot "Phiếu nhập kho"', dauCot.join(' | '));
  const soO = (tr) => [...tr.children].reduce((s, c) => s + (parseInt(c.getAttribute('colspan'), 10) || 1), 0);
  const hang = [...t3.querySelectorAll('tbody tr')];
  bang(hang.map(soO), hang.map(() => dauCot.length),
    `⚠️ moi hang du ${dauCot.length} o (them <th> ma quen sua colspan la lech dung o day)`);
  const iPN = dauCot.indexOf('Phiếu nhập kho');
  kiem(hang[0].children[iPN].textContent.includes('NK0001, NK0007'), 'lenh da nhap: hien du CAC so phieu');
  kiem(hang[0].children[iPN].textContent.includes('06/09/2026'), 'kem NGAY nhap kho');
  bang(hang[1].children[iPN].textContent.trim(), '',
    'lenh chua nhap kho -> o TRONG (khong rai dau gach, cot nay trong o phan lon lenh dang chay)');

  console.log('\n  --- Dong "chua co lenh nao" ---');
  DL['/api/qlsx/orders'] = { data: [] };
  await T.renderOrders({ canEdit: true, canDelete: true }, { canEdit: true }, { canView: true });
  const t4 = w2.document.getElementById('qBody').querySelector('table');
  const sCot4 = [...t4.querySelectorAll('thead th')].length;
  /* v7.92: tbody con them mot hang "Khong tim thay" DUNG SAN nhung LUON AN (display:none) — dung
     san la de bo cot STT noi colspan cho no. Chi dem cac hang DANG HIEN. */
  const h4 = [...t4.querySelectorAll('tbody tr')].filter(tr => tr.style.display !== 'none');
  bang(h4.length, 1, 'khong co lenh -> 1 hang thong bao DANG HIEN');
  bang(soO(h4[0]), sCot4, `hang thong bao trai du ${sCot4} o`);
  const hAn = [...t4.querySelectorAll('tbody tr')].filter(tr => tr.style.display === 'none');
  bang(hAn.length, 1, 'va dung 1 hang an san cho tim kiem');
  bang(hAn.length ? soO(hAn[0]) : 0, sCot4, `hang "Khong tim thay" cung trai du ${sCot4} o`);

  /* ============================================================================================
     4. BAN IN cua lenh
     ============================================================================================ */
  console.log('\n=== 4. Ban in lenh SX co phieu nhap kho + ngay ===');
  let htmlIn = T.bangThongTinBaoCao({
    TenSanPham: 'Áo thu', TenKhachHang: 'Cty A', TongSoLuong: 100, TrangThai: 'Hoàn thành',
    PhanTramHoanThanh: 100, SoPhieuNhapKho: 'NK0001, NK0007', NgayNhapKho: '2026-09-06'
  }, '', 'Cái');
  kiem(/Phiếu nhập kho/.test(htmlIn), 'ban in co dong "Phiếu nhập kho"');
  kiem(/NK0001, NK0007/.test(htmlIn), 'in du cac so phieu');
  kiem(/Ngày nhập kho/.test(htmlIn) && /06\/09\/2026/.test(htmlIn), 'ban in co dong "Ngày nhập kho"');

  htmlIn = T.bangThongTinBaoCao({
    TenSanPham: 'Áo đông', TrangThai: 'Đang sản xuất', PhanTramHoanThanh: 40,
    SoPhieuNhapKho: null, NgayNhapKho: null
  }, '', 'Cái');
  kiem(!/Phiếu nhập kho/.test(htmlIn) && !/Ngày nhập kho/.test(htmlIn),
    'lenh CHUA nhap kho -> ban in KHONG in 2 dong trong cho co');

  /* Cot phai co san o MOI ban in vi dat o cho doc lenh dung chung. */
  const thanGet = catKhoi(sQlsx, 'async function getOrderByMaDH(pool, maDH) {', '{', '}');
  kiem(/COT_PHIEU_NHAP_KHO\('d'\)/.test(thanGet),
    'dat trong getOrderByMaDH -> MOI ban in cua lenh deu co san, khong phai nho tung ban in');

  console.log('\n=== 5. Bump ?v= ===');
  [['module.qlsx.js', 7.87], ['module.nhapkho.js', 7.87]].forEach(([f, min]) => {
    const v = (sIndex.match(new RegExp(f.replace(/\./g, '\\.') + '\\?v=([\\d.]+)')) || [])[1];
    kiem(v && parseFloat(v) >= min, `index.html: ${f}?v= >= ${min}`, String(v));
  });

  console.log('\n================================================================');
  console.log(`KET QUA: ${dat} dat / ${truot} truot`);
  process.exit(truot ? 1 : 0);
})().catch(e => { console.error('LOI TEST: ' + e.stack); process.exit(1); });
