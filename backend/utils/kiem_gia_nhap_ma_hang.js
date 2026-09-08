/* ================================================================================================
   KIEM CHUNG v7.88 — COT GIA NHAP O DANH MUC HANG HOA
   ------------------------------------------------------------------------------------------------
   Nguyen: "danh muc hang hoa (ma hang) them cot gia nhap" -> chot: TU TINH tu phieu nhap kho, theo
   DVT CHINH (cung don vi voi Gia ban). Roi bo sung: "nhap tu san xuat lay tu gia thanh 1 cai".

   ⚠️ DIEU QUAN TRONG NHAT: cong thuc nay DA CO tu v6.91 trong bao cao Ton kho hang hoa. Ban nay
   TACH RA util dung chung chu KHONG viet ban thu hai. Hai man hinh cung goi "gia nhap" ma ra hai so
   khac nhau la nguoi dung khong biet tin cai nao — va do ra thi phai doc ca hai cau SQL moi hieu.
   => Muc 1 khoa lai dieu do: chi con MOT cau SQL trong ca repo.

   ⚠️ BA CHO DE SAI KHAC:
     1. Chia cho SoLuongChinh (KHONG phai SoLuong) — chia nham la gia sai gap <he so> lan.
     2. Hang tu san xuat: GiaVonHangHoa.GiaVon la gia 1 DON VI GOC, con cot Gia ban theo DVT CHINH
        -> ma nao co don vi chinh la don vi GOP thi phai NHAN he so.
     3. Cot chi de XEM thi KHONG duoc dua vao form Sua — dung ra o nhap cho mot con so khong sua
        duoc la moi nguoi dung go vao roi bam Luu va tuong da doi.

   Chay:  NODE_PATH=/tmp/tsd/node_modules node utils/kiem_gia_nhap_ma_hang.js
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

const sUtil = doc('utils/giaNhapHangHoa.js');
const sBaoCao = doc('routes/baocao.js');
const sDM = doc('routes/danhmuc.js');
const sFeDM = doc('../frontend/js/module.danhmuc.js');
const sIndex = doc('../frontend/index.html');
const { JSDOM } = require('jsdom');
const boGhiChu = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

/* ================================================================================================
   1. ⚠️ MOT CAU SQL DUY NHAT trong ca repo
   ================================================================================================ */
console.log('\n=== 1. Mot ban cong thuc duy nhat ===');
/* ⚠️ Dau nhan dien phai DAC TRUNG cho dung cau gia nhap. Lan dau toi do bang `SUM(ct.ThanhTien)` —
   baocao.js con mot cau KHAC (top ma hang theo tien hang, doc PhieuBanHangChiTiet) cung co chuoi do
   nen bao SAI oan. Dau dac trung: gop SoLuongChinh trong OUTER APPLY. */
const demOuterApply = ['utils/giaNhapHangHoa.js', 'routes/baocao.js', 'routes/danhmuc.js',
  'routes/khohang.js', 'routes/nhapkho.js', 'routes/qlsx.js']
  .map(f => [f, (boGhiChu(doc(f))
    .match(/p\.LoaiNhap = N'NhaCungCap' AND ISNULL\(ct\.ThanhTien, 0\) > 0/g) || []).length]);
bang(demOuterApply.filter(([, n]) => n > 0).map(([f]) => f), ['utils/giaNhapHangHoa.js'],
  '⚠️ cau SQL tinh gia nhap chi con o DUNG util, khong con ban sao nao');
kiem(/require\('\.\.\/utils\/giaNhapHangHoa'\)/.test(sBaoCao), 'baocao.js dung LAI util');
kiem(/require\('\.\.\/utils\/giaNhapHangHoa'\)/.test(sDM), 'danhmuc.js dung LAI util');
kiem(/const giaNhapMap = await mapGiaNhap\(pool\);/.test(sBaoCao),
  'baocao.js goi mapGiaNhap (khong con tu dung Map)');
kiem(/donViChinhLaGop/.test(sDM) && /require\('\.\.\/utils\/banHangCommon'\)/.test(sDM),
  'danhmuc.js lay donViChinhLaGop tu ban dung chung, khong tu viet lai');

/* ================================================================================================
   2. CHAY THAT mapGiaNhap + giaTheoDvChinh
   ================================================================================================ */
console.log('\n=== 2. Chay that cong thuc ===');
const { mapGiaNhap, giaTheoDvChinh } = require(path.join(G, 'utils/giaNhapHangHoa.js'));
const donViChinhLaGop = require(path.join(G, 'utils/banHangCommon.js')).donViChinhLaGop;

function taoPool(rows, coBangGiaVon = true) {
  const daChay = [];
  return {
    daChay,
    pool: {
      request: () => ({
        async query(q) {
          daChay.push(String(q).replace(/\s+/g, ' ').trim());
          if (/OBJECT_ID\('dbo\.GiaVonHangHoa'/.test(q)) return { recordset: [{ t: coBangGiaVon ? 1 : null }] };
          if (/OBJECT_ID\(/.test(q)) return { recordset: [{ t: 1 }] };
          return { recordset: rows };
        }
      })
    }
  };
}

(async () => {
  /* MH 10: mua ngoai 2 dot — 100 don vi chinh / 1.000.000 va 300 / 2.000.000 => da gop san o SQL. */
  const g = taoPool([
    { MaHangID: 10, SLMua: 400, TienMua: 3000000, GiaVon: 9999, NguonGia: 'Lệnh SX', MaDHNguon: 'DH01' },
    { MaHangID: 11, SLMua: 0, TienMua: 0, GiaVon: 25000, NguonGia: 'Lệnh SX', MaDHNguon: 'DH02' },
    { MaHangID: 12, SLMua: 0, TienMua: 0, GiaVon: 0, NguonGia: null, MaDHNguon: null }
  ]);
  const m = await mapGiaNhap(g.pool);

  bang(m.get(10), { gia: 7500, goc: false, nguon: 'Phiếu nhập (BQGQ)' },
    'mua ngoai: BINH QUAN GIA QUYEN = 3.000.000 / 400 = 7.500 / DVT chinh');
  kiem(m.get(10).gia !== 9999,
    '⚠️ ma vua mua ngoai vua tu SX -> UU TIEN phieu NCC (tien THAT da bo ra), khong lay gia von');
  bang(m.get(11), { gia: 25000, goc: true, nguon: 'Lệnh SX DH02' },
    'hang tu san xuat: lay gia thanh 1 cai da chot + ghi ro lenh nao');
  bang(m.get(12), undefined, 'khong co nguon nao -> khong co gia (de trong, khong bia so 0)');

  console.log('\n  --- ⚠️ Chia cho SoLuongChinh, KHONG phai SoLuong ---');
  const cau = g.daChay.find(x => /OUTER APPLY/.test(x)) || '';
  kiem(/SUM\(ct\.SoLuongChinh\)/.test(cau), 'chia cho SoLuongChinh -> gia ra dung DVT chinh');
  kiem(!/SUM\(ct\.SoLuong\)/.test(cau), 'KHONG dung SoLuong (chia nham la sai gap <he so> lan)');
  kiem(/ISNULL\(ct\.ThanhTien, 0\) > 0/.test(cau),
    'chi tinh dong CO TIEN — dong gia 0 keo binh quan tut xuong sai');
  kiem(/p\.LoaiNhap = N'NhaCungCap'/.test(cau),
    'chi lay phieu tu NHA CUNG CAP (phieu tu san xuat luon DonGia = 0)');
  kiem(/p\.TrangThai <> N'Đã hủy'/.test(cau), 'bo phieu da huy');

  console.log('\n  --- ⚠️ Quy ve DVT CHINH ---');
  const mhCai = { DonViCoBan: 'Cái', DonViQuyDoi: 'Ri', LoaiRi: 5 };
  const mhRi = { DonViCoBan: 'Ri', DonViQuyDoi: 'Ri', LoaiRi: 5 };   // don vi chinh LA don vi gop
  bang(giaTheoDvChinh(m.get(10), mhCai, donViChinhLaGop), 7500,
    'nguon phieu nhap da theo DVT chinh -> giu nguyen');
  bang(giaTheoDvChinh(m.get(10), mhRi, donViChinhLaGop), 7500,
    'nguon phieu nhap: don vi chinh la Ri cung GIU NGUYEN (SoLuongChinh da la Ri)');
  bang(giaTheoDvChinh(m.get(11), mhCai, donViChinhLaGop), 25000,
    'gia von 1 cai, don vi chinh la Cái -> giu nguyen');
  bang(giaTheoDvChinh(m.get(11), mhRi, donViChinhLaGop), 125000,
    '⚠️ gia von 1 CAI ma don vi chinh la RI -> NHAN he so 5 (khong nhan la gia nhap be gap 5 lan gia ban)');
  bang(giaTheoDvChinh(null, mhCai, donViChinhLaGop), null, 'khong co gia -> tra null');

  console.log('\n  --- Chua co bang GiaVonHangHoa (ban CSDL cu) ---');
  const g2 = taoPool([{ MaHangID: 20, SLMua: 10, TienMua: 50000 }], false);
  const m2 = await mapGiaNhap(g2.pool);
  bang(m2.get(20).gia, 5000, 'van tinh duoc gia hang mua ngoai');
  kiem(!/GiaVonHangHoa/.test(g2.daChay.find(x => /OUTER APPLY/.test(x)) || ''),
    'chua co bang thi khong JOIN vao (khong nem loi)');

  /* ============================================================================================
     3. FRONTEND — cot moi, va KHONG duoc vao form
     ============================================================================================ */
  console.log('\n=== 3. Danh muc -> Hang hoa: cot Gia nhap ===');
  const d1 = new JSDOM('<body><div id="dmBody"></div></body>', { runScripts: 'outside-only' });
  const w1 = d1.window;
  const API = {
    '/api/danhmuc/donvitinh': { data: [{ TenDonVi: 'Cái' }, { TenDonVi: 'Ri' }] },
    '/api/danhmuc/thekhodanhmuc': { data: [{ TheKhoDanhMucID: 3, TenTheKho: 'Đồ bé trai' }] },
    '/api/danhmuc/hanghoa': { data: [
      { MaHangID: 10, MaHang: 'AO01', TenHang: 'Áo thu', DonViCoBan: 'Cái', DonViQuyDoi: 'Ri',
        LoaiRi: 5, GiaBan: 100000, TheKhoDanhMucID: 3, TenTheKho: 'Đồ bé trai',
        GiaNhap: 7500, NguonGiaNhap: 'Phiếu nhập (BQGQ)' },
      { MaHangID: 11, MaHang: 'AO02', TenHang: 'Áo đông', DonViCoBan: 'Cái', DonViQuyDoi: 'Ri',
        LoaiRi: 5, GiaBan: 200000, TheKhoDanhMucID: null, TenTheKho: null,
        GiaNhap: 25000, NguonGiaNhap: 'Lệnh SX DH02' },
      { MaHangID: 12, MaHang: 'AO03', TenHang: 'Áo lỡ', DonViCoBan: 'Cái', DonViQuyDoi: 'Ri',
        LoaiRi: 5, GiaBan: 0, TheKhoDanhMucID: null, TenTheKho: null,
        GiaNhap: null, NguonGiaNhap: null }
    ] }
  };
  Object.assign(w1, {
    apiGet: async (u) => API[u] || { data: [] }, apiPost: async () => ({}), apiPut: async () => ({}),
    apiDelete: async () => ({}), escapeHtml: (s) => String(s == null ? '' : s),
    fmtNumber: (n) => Number(n || 0).toLocaleString('vi-VN'), fmtDate: (x) => String(x || ''),
    toast: () => {}, searchBoxHtml: () => '<input id="dmSearchBox">', wireTableSearch: () => {},
    openModal: (h) => { const e = w1.document.createElement('div'); e.innerHTML = h; w1.document.body.appendChild(e); return e; },
    closeModal: () => {}, enhanceInputs: () => {}, uploadFile: async () => '', anhNho: (x) => x
  });
  const sTest = sFeDM.replace('return { render, getTabs };',
    'return { render, getTabs, __t: { renderTabBody, datTab: (k) => { activeTab = k; } } };');
  w1.eval(sTest);
  const T = w1.ModuleDanhMuc.__t;
  T.datTab('hanghoa');
  await T.renderTabBody({ canCreate: true, canEdit: true, canDelete: true });

  const body1 = w1.document.getElementById('dmBody');
  const dauCot = [...body1.querySelectorAll('thead th')].map(th => th.textContent.trim());
  kiem(dauCot.includes('Giá nhập (1 ĐVT chính)'), 'bang co cot "Giá nhập (1 ĐVT chính)"', dauCot.join(' | '));
  bang(dauCot.indexOf('Giá nhập (1 ĐVT chính)') - dauCot.indexOf('Giá bán (1 ĐVT chính)'), 1,
    'dat NGAY CANH cot Gia ban (cung don vi -> so duoc lai ngay)');
  const iGN = dauCot.indexOf('Giá nhập (1 ĐVT chính)');
  const hang = [...body1.querySelectorAll('tbody tr')];
  kiem(hang[0].children[iGN].textContent.includes('7.500'), 'hien so co dau phan cach nghin');
  kiem(hang[0].children[iGN].textContent.includes('Phiếu nhập (BQGQ)'), 'ghi ro NGUON gia');
  kiem(hang[1].children[iGN].textContent.includes('Lệnh SX DH02'), 'hang tu SX ghi ro lay tu lenh nao');
  kiem(hang[2].children[iGN].textContent.includes('chưa có'),
    'chua co gia -> ghi "chưa có" (khong hien 0, keo nguoi doc tuong nhap gia 0)');

  console.log('\n  --- ⚠️ Cot chi de XEM: KHONG duoc vao form Sua ---');
  hang[0].querySelector('.act-edit').click();
  const modal = [...w1.document.body.children].pop();
  const oNhap = [...modal.querySelectorAll('[name]')].map(x => x.getAttribute('name'));
  kiem(!oNhap.includes('GiaNhap'),
    '⚠️ form Sua KHONG co o "Giá nhập" (dung ra o nhap cho so khong sua duoc la moi go roi tuong da doi)',
    oNhap.join(', '));
  kiem(oNhap.includes('GiaBan') && oNhap.includes('TheKhoDanhMucID'),
    'cac o khai tay van con day du');
  kiem(/const oNhap = fields\.filter\(f => !f\.chiXem\);/.test(sFeDM), 'loc bang co `chiXem`');
  kiem(/oNhap\.forEach\(f => \{ body\[f\.name\] = fd\.get\(f\.name\); \}\)/.test(sFeDM),
    'payload gui len cung KHONG kem truong chi-xem (gui len la backend tuong duoc phep ghi)');

  console.log('\n=== 4. Bump ?v= ===');
  const v = (sIndex.match(/module\.danhmuc\.js\?v=([\d.]+)/) || [])[1];
  kiem(v && parseFloat(v) >= 7.88, 'index.html: module.danhmuc.js?v= >= 7.88', String(v));

  console.log('\n================================================================');
  console.log(`KET QUA: ${dat} dat / ${truot} truot`);
  process.exit(truot ? 1 : 0);
})().catch(e => { console.error('LOI TEST: ' + e.stack); process.exit(1); });
