/* ================================================================================================
   KIEM CHUNG v7.89 — GIA THANH SAN PHAM
   ------------------------------------------------------------------------------------------------
   Nguyen (2 yeu cau, cung mot man hinh):
     (1) "hien tai dang tinh chung gia tong so luong xong moi chia ra thanh gia thanh 1 san pham
          nhung chi phi chung dang de cong vao gia tong so luong. Thay doi thanh gia thanh = gia
          1 san pham + chi phi chung"
     (2) "Cot ma hang doi thanh ma rap va hien thi ma rap. Cot tong SL lay so luong theo tong so
          luong so cat theo vai chinh"

         Truoc:  gia thanh 1 SP = (chi phi san xuat + chi phi chung) / SL
         Nay:    gia thanh 1 SP = (chi phi san xuat / SL) + chi phi chung

   ⚠️ BON CHO DE SAI:
     1. Dong TONG CHI PHI phai van bang GIA THANH x SL. Doi cong thuc mot ve ma quen ve kia la tren
        cung mot bang co hai con so khong cong ra duoc nhau — nguoi doc mat tin ca bang.
     2. SL = 0 thi khong nhan duoc chi phi chung -> khong duoc de tong nhay lung tung, va gia thanh
        van phai la null nhu cu.
     3. Cot "Tong SL" lay SO CAT vai chinh; chua ghi so cat thi PHAI noi ro, KHONG duoc lui ve
        TongSoLuong khai o Ra lenh SX (lui am tham la nguoi doc tuong da cat xong du so do).
     4. Ma rap phai lay tu util maRapTheoDon (ban duy nhat tu v7.67, gop ca nguon "Ghi tien do"),
        khong doc thang DonHangChiTietSoDo.

   Chay:  NODE_PATH=/tmp/tsd/node_modules node utils/kiem_gia_thanh_chi_phi_chung.js
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
const sFe = doc('../frontend/js/module.qlsx.js');
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
   1. CHAY THAT tinhGiaThanh()
   ------------------------------------------------------------------------------------------------
   Cat nguyen than ham ra chay voi pool gia + cac ham phu duoc thay the. Khong mo phong lai phep
   tinh trong test: mo phong lai la test dung mot cong thuc, code dung cong thuc khac, ca hai deu
   "dat" ma san pham van sai.
   ================================================================================================ */
console.log('\n=== 1. Chay that tinhGiaThanh() ===');
const than = catKhoi(sQlsx, 'async function tinhGiaThanh(pool, order) {', '{', '}');
kiem(!!than, 'cat duoc tinhGiaThanh');

/* Pool gia: nhan dien tung cau SQL theo dau hieu roi tra so lieu dung san. */
function taoPool(sl) {
  return {
    request: () => ({
      _in: {},
      input(k, t, v) { this._in[k] = v; return this; },
      async query(q) {
        const s = String(q);
        if (/COL_LENGTH/.test(s)) return { recordset: [{ c: 1 }] };
        if (/FROM TienDoCatChiTietCay cay/.test(s)) {
          /* 1 cay vai: 10 kg x 30.000 = 300.000 */
          return { recordset: [{ CayID: 1, MaCay: 'C1', MaVai: 'V1', TenLoaiVai: 'Cotton', TenMau: 'Đỏ',
            DonGiaNhap: 30000, KgMetDaDung: 10, TongLop: 5, KgDaXuatChoDon: 10 }] };
        }
        if (/ChiPhiChungDonHang/.test(s)) {
          return { recordset: [{ ID: 1, TenChiPhi: 'Điện nước', SoTien: 2000, GhiChu: '' }] };
        }
        if (/MaCongDoan IN \('KN','CAT'\)/.test(s)) {
          return { recordset: [{ StageID: 91, MaCongDoan: 'KN' }, { StageID: 92, MaCongDoan: 'CAT' }] };
        }
        if (/PhieuNhapKhoHangChiTiet/.test(s)) return { recordset: [{ SL: sl }] };
        return { recordset: [] };
      }
    })
  };
}
const F = new Function('sql', 'coCotQLSX', 'getStageActualQty', 'getTongSLCatForOrder',
  'getMaRapCuaDon', 'getDonViTinhCuaDon',
  `${than}\nreturn tinhGiaThanh;`)(
    { Int: 'Int', NVarChar: (n) => 'NVarChar', Decimal: () => 'Decimal' },
    async () => true, async () => 0, async () => 0, async () => 'R1', async () => 'Cái');

(async () => {
  const order = { DonHangID: 1, MaDH: 'DH01', TenSanPham: 'Áo', TongSoLuong: 999 };

  /* Chi phi san xuat = 300.000 (vai) — cac nhom khac tra rong. Chi phi chung = 2.000 / 1 SP. */
  let d = await F(taoPool(100), order);
  console.log('\n  --- SL = 100, chi phi SX = 300.000, chi phi chung = 2.000/SP ---');
  bang(d.tong.sanXuat, 300000, 'chi phi san xuat KHONG gom chi phi chung');
  bang(d.tong.chiPhiChung, 2000, 'chi phi chung = tien cho 1 SP (nguyen so da khai)');
  bang(d.tong.chiPhiChungCaLenh, 200000, 'chi phi chung ca lenh = 2.000 x 100');
  bang(d.giaThanh1SP, 5000,
    '⚠️ gia thanh = 300.000/100 + 2.000 = 5.000 (KHONG phai (300.000+2.000)/100 = 3.020)');
  bang(d.tong.tongCong, 500000, 'TONG CHI PHI = 300.000 + 200.000');
  bang(d.tong.tongCong, d.giaThanh1SP * d.slDungTinh,
    '⚠️ TONG CHI PHI dung bang GIA THANH x SL (hai so tren cung bang phai cong ra duoc nhau)');

  console.log('\n  --- Doi chieu voi cong thuc CU (de thay ro da doi) ---');
  const cu = (300000 + 2000) / 100;
  kiem(d.giaThanh1SP !== cu, `khac han cong thuc cu (cu se ra ${cu})`);

  console.log('\n  --- SL = 0: khong nhan duoc chi phi chung ---');
  d = await F(taoPool(0), order);
  bang(d.slDungTinh, 0, 'khong co SL nhap kho lan SL cat -> 0');
  bang(d.giaThanh1SP, null, 'gia thanh de NULL nhu cu, khong chia cho 0');
  bang(d.tong.tongCong, 300000, 'tong chi phi chi con phan san xuat (chua nhan duoc chi phi chung)');
  bang(d.tong.chiPhiChungCaLenh, 0, 'chi phi chung ca lenh = 0 khi chua co SL');

  console.log('\n  --- Chi phi chung = 0 thi ket qua y nhu truoc khi doi ---');
  const F2 = new Function('sql', 'coCotQLSX', 'getStageActualQty', 'getTongSLCatForOrder',
    'getMaRapCuaDon', 'getDonViTinhCuaDon', `${than}\nreturn tinhGiaThanh;`)(
      { Int: 'Int', NVarChar: () => 'NVarChar', Decimal: () => 'Decimal' },
      async () => true, async () => 0, async () => 0, async () => '', async () => 'Cái');
  const poolKhongCPC = taoPool(100);
  const goc = poolKhongCPC.request;
  poolKhongCPC.request = () => {
    const r = goc();
    const q0 = r.query.bind(r);
    r.query = async (s) => (/ChiPhiChungDonHang/.test(String(s)) ? { recordset: [] } : q0(s));
    return r;
  };
  const d0 = await F2(poolKhongCPC, order);
  bang(d0.giaThanh1SP, 3000, 'khong khai chi phi chung -> 300.000/100 = 3.000 (y nhu cu)');

  /* ============================================================================================
     2. NGUON GIA VON van dung ham nay -> gia von tu dong theo cong thuc moi khi bam "Nap tu lenh SX"
     ============================================================================================ */
  console.log('\n=== 2. Giá vốn vẫn dùng chung một hàm ===');
  kiem(/const \{ tinhGiaThanh, getOrderByMaDH \} = require\('\.\/qlsx'\)/.test(doc('routes/baocao.js')),
    'Nạp giá vốn từ lệnh SX dùng LẠI tinhGiaThanh (1 nguồn sự thật, không chép công thức)');

  /* ============================================================================================
     3. DANH SACH GIA THANH: Ma rap + Tong SL so cat vai chinh
     ============================================================================================ */
  console.log('\n=== 3. Danh sách giá thành: 2 cột mới ===');
  const rtList = catKhoi(sQlsx, "router.get('/giathanh', requireAuth", '{', '}');
  kiem(/const mrMap = await maRapTheoDon\(pool\)/.test(rtList),
    'mã rập lấy từ util maRapTheoDon (bản duy nhất từ v7.67), lấy 1 lần cho cả danh sách');
  kiem(/getTongSLCatForOrder\(pool, r\.DonHangID\)/.test(rtList),
    'tổng SL lấy từ getTongSLCatForOrder — hàm đã lọc đúng màu VẢI CHÍNH');
  kiem(!/KieuVai/.test(boGhiChu(rtList)),
    '⚠️ KHÔNG viết lại phép lọc màu chính ở đây (hai luật khác nhau là hai màn ra hai số)');
  kiem(/for \(let i = 0; i < rows\.length; i \+= LO\)/.test(rtList) && /Promise\.all/.test(rtList),
    'chạy theo LÔ song song, không 300 lượt nối đuôi');
  kiem(/catch \(e\) \{ r\.TongSLCatChinh = null; \}/.test(rtList),
    'lỗi một lệnh không làm hỏng cả danh sách');

  console.log('\n  --- Frontend: chạy thật renderGiaThanh ---');
  const dom = new JSDOM('<body><div class="content"><div id="qBody"></div></div></body>',
    { runScripts: 'outside-only' });
  const w = dom.window;
  const DL = { '/api/qlsx/giathanh': { data: [
    { DonHangID: 1, MaDH: 'DH01', TenSanPham: 'Áo thu', MaSanPham: 'AO01', MaRap: 'R-123',
      TongSoLuong: 999, TongSLCatChinh: 480, SoChiPhiChung: 2 },
    { DonHangID: 2, MaDH: 'DH02', TenSanPham: 'Áo đông', MaSanPham: 'AO02', MaRap: '',
      TongSoLuong: 500, TongSLCatChinh: 0, SoChiPhiChung: 0 }
  ] } };
  Object.assign(w, {
    apiGet: async (u) => DL[u] || { data: [] }, apiPost: async () => ({}), apiPut: async () => ({}),
    apiDelete: async () => ({}), escapeHtml: (s) => String(s == null ? '' : s),
    fmtNumber: (n) => Number(n || 0).toLocaleString('vi-VN'), fmtDate: (x) => String(x || ''),
    fmtQuyDoi: (n) => String(n), toast: () => {}, searchBoxHtml: () => '<input id="s">',
    wireTableSearch: () => {}, openModal: () => w.document.createElement('div'), closeModal: () => {},
    printHtml: () => {}, homNayISO: () => '2026-09-08', uploadFile: async () => '', anhNho: (x) => x,
    enhanceInputs: () => {}, taiFile: () => {}, choAnhTai: async () => {},
    statusWithStage: (t) => String(t || ''), docSoTienBangChu: () => ''
  });
  const sTest = sFe.replace('return { render, getTabs, printLenhSanXuat };',
    'return { render, getTabs, printLenhSanXuat, __t: { renderGiaThanh, buildGiaThanhBody } };');
  w.eval(sTest);
  const T = w.ModuleQLSX.__t;
  await T.renderGiaThanh({ canEdit: true });
  const t3 = w.document.getElementById('qBody').querySelector('table');
  const dauCot = [...t3.querySelectorAll('thead th')].map(th => th.textContent.trim());
  kiem(dauCot.includes('Mã rập'), 'cột đổi tên thành "Mã rập"', dauCot.join(' | '));
  kiem(!dauCot.includes('Mã hàng'), 'không còn cột "Mã hàng"');
  kiem(dauCot.some(x => x.indexOf('sổ cắt') >= 0), 'tiêu đề nói rõ Tổng SL lấy từ SỔ CẮT — vải chính');
  const soO = (tr) => [...tr.children].reduce((s, c) => s + (parseInt(c.getAttribute('colspan'), 10) || 1), 0);
  const hang = [...t3.querySelectorAll('tbody tr')];
  bang(hang.map(soO), hang.map(() => dauCot.length), `mọi hàng đủ ${dauCot.length} ô`);
  const iMR = dauCot.indexOf('Mã rập');
  bang(hang[0].children[iMR].textContent.trim(), 'R-123', 'hiện đúng MÃ RẬP, không phải mã hàng');
  kiem(hang[0].children[iMR].textContent.indexOf('AO01') < 0, 'không còn hiện mã hàng AO01');
  const iSL = dauCot.findIndex(x => x.indexOf('Tổng SL') >= 0);
  bang(hang[0].children[iSL].textContent.trim(), '480', 'hiện SL sổ cắt (480), không phải 999 khai ở lệnh');
  kiem(hang[1].children[iSL].textContent.includes('chưa ghi sổ cắt'),
    '⚠️ chưa ghi sổ cắt -> nói rõ, KHÔNG lùi về 500 khai ở Ra lệnh SX');

  console.log('\n  --- Bảng bóc tách: nói rõ chi phí chung là của 1 SP ---');
  const html = T.buildGiaThanhBody({
    order: { MaDH: 'DH01', TenSanPham: 'Áo thu' },
    vai: [], phuKien: [], giaCong: [], mayNhaLam: [], inThe: [], boPhanCat: [], chiPhiChung: [],
    tong: { vai: 300000, phuKien: 0, giaCong: 0, mayNhaLam: 0, inThe: 0, boPhanCat: 0,
      chiPhiChung: 2000, chiPhiChungCaLenh: 200000, sanXuat: 300000, tongCong: 500000 },
    slDungTinh: 100, nguonSL: 'SL nhập kho', giaThanh1SP: 5000
  });
  kiem(/khai cho <b>1 sản phẩm<\/b>/.test(html), 'ghi rõ chi phí chung khai cho 1 SẢN PHẨM');
  kiem(/CHI PHÍ SẢN XUẤT/.test(html), 'có dòng CHI PHÍ SẢN XUẤT tách riêng');
  kiem(/× 100 = 200.000/.test(html), 'hiện luôn chi phí chung × SL để đối chiếu dòng TỔNG');
  kiem(/300.000 ÷ 100 \+ 2.000/.test(html), 'viết rõ phép tính giá thành ngay trên bảng');

  console.log('\n=== 4. Bump ?v= ===');
  const v = (sIndex.match(/module\.qlsx\.js\?v=([\d.]+)/) || [])[1];
  kiem(v && parseFloat(v) >= 7.89, 'index.html: module.qlsx.js?v= >= 7.89', String(v));

  console.log('\n================================================================');
  console.log(`KET QUA: ${dat} dat / ${truot} truot`);
  process.exit(truot ? 1 : 0);
})().catch(e => { console.error('LOI TEST: ' + e.stack); process.exit(1); });
