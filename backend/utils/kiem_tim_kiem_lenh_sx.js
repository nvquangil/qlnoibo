/* ================================================================================================
   KIEM CHUNG v7.92 — TIM KIEM TOAN DANH SACH LENH SAN XUAT
   ------------------------------------------------------------------------------------------------
   Nguyen: "Danh sach lenh san xuat them chuc nang tim kiem, go ky tu bat ky tim kiem trong toan bo
   danh sach bat ke cot nao".

   ⚠️ NAM CHO DE SAI — moi cho mot assert rieng:
     1. BANG NAY DA CO SAN mot bo loc (chip Qua han / Sap den han) cung ghi `tr.style.display`.
        Viet them mot bo loc doc lap la hai ben tranh nhau: dang loc "Qua han", go tim roi XOA het
        chu -> bang bung ra du moi lenh. Phai la MOT ham apLoc() duy nhat.
     2. Cot Thao tac co 6 nut CHU ("Ghi tien do / In lenh SX / In phieu / In tai lieu KT / Sua /
        Xoa"). Tim theo `tr.textContent` la go "in" khop HET MOI DONG. Phai tim theo `data-tim`
        dung sinh tu cac TRUONG DU LIEU.
     3. Cot STT cung nam trong textContent -> go "1" ra gan het bang. Cung duoc bit boi (2).
     4. Dong "Khong tim thay" phai duoc dung TRUOC khi themCotStt chay, neu khong `colspan` cua no
        hut dung 1 o so voi bang (bo STT chi noi colspan cho dong dang co mat).
     5. An bot dong thi STT phai danh lai 1..n LIEN MACH (khong con so cu).

   Chay:  NODE_PATH=/tmp/tsd/node_modules node utils/kiem_tim_kiem_lenh_sx.js
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
  `${m}  [duoc: ${JSON.stringify(thuc)} | mong: ${JSON.stringify(mong)}]`);

const sCommon = doc('../frontend/js/common.js');
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

/* ================================================================================================
   0. NAP THAT: cat ham that ra chay, khong go lai logic
   ================================================================================================ */
console.log('\n=== 0. Nap ham that vao jsdom ===');
const HAM_COMMON = ['function boDau(', 'function escapeHtml(', 'function fmtDate(', 'function fmtNumber(',
  'function __oTraiHet(', 'function __dongKhongDanhSo(', 'function __laDongDuLieu(', 'function __soCotCuaBang(',
  'function __daCoStt(', 'function danhLaiStt(', 'function __gioTheoDoiStt(',
  'function themCotSttMotBang(', 'function capNhatSttSauKhiDoi(', 'function themCotStt('];
const nguonCommon = HAM_COMMON.map(t => {
  const h = catKhoi(sCommon, t, '{', '}');
  kiem(!!h, 'cat duoc common.js :: ' + t.replace('function ', '').replace('(', '()'));
  return h;
}).join('\n');

const HAM_QLSX = ['function tinhDeadline(', 'function chuoiTim(', 'async function renderOrders('];
const nguonQlsx = HAM_QLSX.map(t => {
  const h = catKhoi(sQlsx, t, '{', '}');
  kiem(!!h, 'cat duoc module.qlsx.js :: ' + t.replace(/^(async )?function /, '').replace('(', '()'));
  return h;
}).join('\n');

const STT_RONG = (sCommon.match(/const STT_RONG = '([^']+)'/) || [])[1];
kiem(!!STT_RONG, 'STT_RONG van khai o MOT cho trong common.js', String(STT_RONG));

/* 8 lenh mau. Co CHU DICH:
     - DH2609001 "Áo thun cổ trụ" khach "Hồng Kông"  -> thu go KHONG DAU + go 2 tu o 2 cot khac nhau
     - DH2609002 "Quần jean" khach "Hồng Kông"       -> cung khach, khac ten SP
     - hai lenh QUA HAN de kiem giao giua tim kiem va chip loc
     - mot lenh da nhap kho (co SoPhieuNhapKho) de kiem tim theo so phieu */
const homNay = new Date();
const congNgay = (n) => { const d = new Date(homNay); d.setDate(d.getDate() + n); return d.toISOString(); };
const LENH = [
  { MaDH: 'DH2609001', TenSanPham: 'Áo thun cổ trụ', MaRap: 'RAP-A01', TenKhachHang: 'Hồng Kông', TongSoLuong: 3274, NgayDat: congNgay(-40), NgayGiaoDuKien: congNgay(-3), TenCongDoan: 'May', PhanTramHoanThanh: 60, TrangThai: 'Đang sản xuất', SoPhieuNhapKho: null, NgayNhapKho: null },
  { MaDH: 'DH2609002', TenSanPham: 'Quần jean ống suông', MaRap: 'RAP-Q07', TenKhachHang: 'Hồng Kông', TongSoLuong: 500, NgayDat: congNgay(-30), NgayGiaoDuKien: congNgay(2), TenCongDoan: 'Cắt', PhanTramHoanThanh: 20, TrangThai: 'Đang sản xuất', SoPhieuNhapKho: null, NgayNhapKho: null },
  { MaDH: 'DH2609003', TenSanPham: 'Áo khoác gió', MaRap: 'RAP-K02', TenKhachHang: 'Minh Long', TongSoLuong: 120, NgayDat: congNgay(-20), NgayGiaoDuKien: congNgay(-1), TenCongDoan: 'Hoàn thiện', PhanTramHoanThanh: 90, TrangThai: 'Đang sản xuất', SoPhieuNhapKho: null, NgayNhapKho: null },
  { MaDH: 'DH2609004', TenSanPham: 'Váy liền thân', MaRap: 'RAP-V11', TenKhachHang: 'Đại Phát', TongSoLuong: 80, NgayDat: congNgay(-15), NgayGiaoDuKien: congNgay(30), TenCongDoan: 'May', PhanTramHoanThanh: 10, TrangThai: 'Đang sản xuất', SoPhieuNhapKho: null, NgayNhapKho: null },
  { MaDH: 'DH2609005', TenSanPham: 'Áo sơ mi nam', MaRap: 'RAP-S03', TenKhachHang: 'Minh Long', TongSoLuong: 950, NgayDat: congNgay(-60), NgayGiaoDuKien: congNgay(-25), TenCongDoan: 'Nhập kho', PhanTramHoanThanh: 100, TrangThai: 'Hoàn thành', SoPhieuNhapKho: 'PNK2608012', NgayNhapKho: congNgay(-24) },
  { MaDH: 'DH2609006', TenSanPham: 'Quần short kaki', MaRap: 'RAP-Q09', TenKhachHang: 'Thiên Ân', TongSoLuong: 300, NgayDat: congNgay(-10), NgayGiaoDuKien: congNgay(45), TenCongDoan: 'Cắt', PhanTramHoanThanh: 5, TrangThai: 'Đang sản xuất', SoPhieuNhapKho: null, NgayNhapKho: null },
  { MaDH: 'DH2609007', TenSanPham: 'Áo thun trơn', MaRap: 'RAP-A02', TenKhachHang: 'Thiên Ân', TongSoLuong: 2000, NgayDat: congNgay(-5), NgayGiaoDuKien: congNgay(60), TenCongDoan: 'May', PhanTramHoanThanh: 15, TrangThai: 'Đang sản xuất', SoPhieuNhapKho: null, NgayNhapKho: null },
  { MaDH: 'DH2609008', TenSanPham: 'Đầm dạ hội', MaRap: 'RAP-D05', TenKhachHang: 'Minh Long', TongSoLuong: 40, NgayDat: congNgay(-8), NgayGiaoDuKien: congNgay(4), TenCongDoan: 'May', PhanTramHoanThanh: 50, TrangThai: 'Đang sản xuất', SoPhieuNhapKho: null, NgayNhapKho: null }
];

const dom = new JSDOM('<body><div class="content"><div id="qBody"></div></div></body>',
  { runScripts: 'outside-only' });
const w = dom.window;
const D = w.document;
w.eval(`
  const STT_NHAN = 'STT'; const STT_RONG = '${STT_RONG}';
  ${nguonCommon}
  /* Cac phu tro renderOrders can — KHONG lien quan den tim kiem, chi de ham chay duoc. */
  const apiGet = async () => ({ data: window.__LENH });
  const statusWithStage = (tt) => String(tt || '');
  const openProgressForm = () => {}, printLenhSanXuat = () => {}, openPrint = () => {};
  const openPrintTaiLieuKyThuatChooser = () => {}, openEditOrderForm = () => {}, doDeleteOrder = () => {};
  ${nguonQlsx}
  window.__api = { renderOrders, chuoiTim, boDau, themCotStt, danhLaiStt };
`);
w.__LENH = LENH;
const API = w.__api;

/* ================================================================================================
   1. CHUOI TIM lay tu TRUONG DU LIEU, khong dinh chu tren nut Thao tac
   ================================================================================================ */
console.log('\n=== 1. chuoiTim() lay dung nguon ===');
const ct = API.chuoiTim(LENH[4]);
kiem(ct.includes('dh2609005'), 'co Ma DH');
kiem(ct.includes('ao so mi nam'), 'co Ten SP (da bo dau + chu thuong)');
kiem(ct.includes('rap-s03'), 'co Ma rap');
kiem(ct.includes('minh long'), 'co Khach hang');
kiem(ct.includes('hoan thanh'), 'co Trang thai');
kiem(ct.includes('pnk2608012'), 'co So phieu nhap kho');
kiem(ct.includes('950'), 'co So luong');
kiem(/\d{2}\/\d{2}\/\d{4}/.test(ct), 'co ngay dinh dang dd/mm/yyyy (go "09/2026" tim duoc)');
kiem(!ct.includes('in phieu') && !ct.includes('ghi tien do') && !ct.includes('in lenh'),
  '⚠️ KHONG chua chu tren nut Thao tac — day la cai lam tim kiem theo textContent thanh vo dung');

/* ================================================================================================
   2. VE THAT bang roi chay bo cot STT (mo phong enhanceInputs cua .content)
   ================================================================================================ */
console.log('\n=== 2. Ve bang + chen cot STT ===');
const body = D.getElementById('qBody');

const soO = (tr) => [...tr.children].reduce((s, c) => s + (parseInt(c.getAttribute('colspan'), 10) || 1), 0);
const dongDL = () => [...body.querySelectorAll('table tbody tr[data-dl]')];
const dangHien = () => dongDL().filter(tr => tr.style.display !== 'none');
/* Doc Ma DH bang cach TIM O KHOP MAU MA, khong dem chi so cot: cot Ma DH la o thu 3 (sau STT +
   Anh SP) — dem tay la lan sau them/bot cot lai lech mot o va test do sai ma bao la code sai
   (dung bay nay hai lan trong dot v7.9x). */
const maDangHien = () => dangHien().map(tr =>
  ([...tr.children].map(td => td.textContent.trim()).find(t => /^DH\d+$/.test(t))) || '?');
const sttDangHien = () => dangHien().map(tr => tr.children[0].textContent.trim());
const go = (s) => {
  const o = body.querySelector('#qTim');
  o.value = s;
  o.dispatchEvent(new w.Event('input'));
};
const bamChip = (loc) => body.querySelector(`.dl-loc[data-loc="${loc}"]`).dispatchEvent(new w.Event('click'));

(async () => {
  await API.renderOrders({ canEdit: true, canDelete: true }, { canEdit: true }, { canEdit: true });
  API.themCotStt(body);

  const table = body.querySelector('table');
  const soTh = table.querySelectorAll('thead th').length;
  bang(soTh, 14, 'tieu de: 13 cot goc + 1 cot STT');
  bang([...table.querySelectorAll('thead th')][0].textContent.trim(), 'STT', 'cot dau la STT');
  bang(dongDL().length, LENH.length, 'du 8 dong lenh');
  bang([...new Set(dongDL().map(soO))], [14], '⚠️ moi dong du lieu dung 14 o (khong lech cot)');

  kiem(!!body.querySelector('#qTim'), 'co o tim kiem #qTim');
  kiem(/toàn bộ danh sách/i.test(body.querySelector('#qTim').getAttribute('placeholder') || ''),
    'placeholder noi ro la tim TOAN BO danh sach');

  /* Dong "Khong tim thay" phai duoc noi colspan len 14 (bay 4). */
  const oTrong = [...table.querySelectorAll('tbody tr')].find(tr => /Không tìm thấy/.test(tr.textContent));
  kiem(!!oTrong, 'co dung san dong "Khong tim thay"');
  bang(oTrong ? soO(oTrong) : 0, 14,
    '⚠️ dong "Khong tim thay" trai HET bang (dung TRUOC themCotStt nen colspan duoc noi 13->14)');
  bang(oTrong ? oTrong.style.display : 'x', 'none', 'luc chua go thi dong do an');

  /* ============================================================================================
     3. GO TIM — khop moi cot
     ============================================================================================ */
  console.log('\n=== 3. Go tim: khop moi cot ===');
  go('DH2609004');
  bang(maDangHien(), ['DH2609004'], 'tim theo MA DON HANG');

  go('vay lien than');   // khong dau
  bang(maDangHien(), ['DH2609004'], 'tim theo TEN SP go KHONG DAU van ra ("vay lien than" ~ "Váy liền thân")');

  go('rap-q07');
  bang(maDangHien(), ['DH2609002'], 'tim theo MA RAP');

  go('minh long');
  bang(maDangHien(), ['DH2609003', 'DH2609005', 'DH2609008'], 'tim theo KHACH HANG (3 lenh)');

  go('hoan thanh');
  bang(maDangHien(), ['DH2609005'], 'tim theo TRANG THAI');

  go('PNK2608012');
  bang(maDangHien(), ['DH2609005'], 'tim theo SO PHIEU NHAP KHO');

  go('2000');
  bang(maDangHien(), ['DH2609007'], 'tim theo SO LUONG');

  go('hong kong ao');
  bang(maDangHien(), ['DH2609001'],
    'go NHIEU TU o HAI COT khac nhau ("hong kong" o Khach hang + "ao" o Ten SP) -> khop CA HAI');

  go('   ');
  bang(maDangHien().length, LENH.length, 'go toan dau cach = khong loc gi');

  /* ⚠️ Bay 2/3: chu tren nut Thao tac va so STT KHONG duoc lot vao pham vi tim. */
  console.log('\n  --- ⚠️ Khong dinh chu tren nut / so STT ---');
  go('in phieu');
  bang(maDangHien().length, 0, '⚠️ go "in phieu" (chu tren NUT) -> KHONG dong nao khop');
  go('xoa');
  bang(maDangHien().length, 0, '⚠️ go "xoa" (chu tren NUT) -> KHONG dong nao khop');

  /* ============================================================================================
     4. KHONG TIM THAY
     ============================================================================================ */
  console.log('\n=== 4. Khong tim thay ===');
  go('khongcogiten');
  bang(maDangHien().length, 0, 'khong dong nao khop');
  bang(oTrong.style.display, '', 'hien dong "Khong tim thay"');
  go('');
  bang(oTrong.style.display, 'none', 'xoa chu -> an dong "Khong tim thay" di');
  bang(maDangHien().length, LENH.length, 'xoa chu -> hien lai DU 8 lenh');

  /* ============================================================================================
     5. ⚠️ TIM KIEM x CHIP LOC QUA HAN — mot ham apLoc duy nhat
     ============================================================================================ */
  console.log('\n=== 5. ⚠️ Tim kiem giao voi chip loc deadline ===');
  const quaHan = LENH.filter(o => new Date(o.NgayGiaoDuKien) < homNay
    && !/hoàn thành|hủy/i.test(o.TrangThai)).map(o => o.MaDH);
  bamChip('qua');
  bang(maDangHien(), quaHan, 'bam chip "Qua han" -> dung nhom qua han');

  go('minh long');
  bang(maDangHien(), quaHan.filter(m => ['DH2609003'].includes(m)),
    '⚠️ dang loc Qua han ma go tim -> GIAO cua hai dieu kien, khong phai bo loc cu');

  go('');
  bang(maDangHien(), quaHan,
    '⚠️ XOA HET CHU TIM -> van con nguyen bo loc Qua han (day la loi kinh dien khi viet 2 bo loc roi nhau)');

  /* ⚠️ Dung tu khoa "kaki" chu KHONG dung "thien an": go "thien an" tach thanh 2 tu, ma cong doan
     "Hoàn thiện" -> "hoan thien" CHUA CA "thien" LAN "an" (trong chu "hoan"). Do la ket qua DUNG
     cua tim-theo-tung-tu, chi la tu khoa test chon kem. */
  go('kaki');
  bang(maDangHien().length, 0, 'loc Qua han + tim lenh khong qua han -> rong');
  bang(oTrong.style.display, '', 'va hien dong "Khong tim thay"');

  bamChip('qua');   // bam lai = bo loc
  bang(maDangHien(), ['DH2609006'], 'bo loc Qua han -> con lai dung ket qua tim "kaki"');
  go('');
  bang(maDangHien().length, LENH.length, 'bo ca hai -> ve du 8 lenh');

  /* ============================================================================================
     6. ⚠️ STT DANH LAI 1..n THEO DONG DANG HIEN
     ============================================================================================ */
  console.log('\n=== 6. ⚠️ STT danh lai theo dong dang hien ===');
  bang(sttDangHien(), ['1', '2', '3', '4', '5', '6', '7', '8'], 'chua loc: 1..8');

  go('minh long');
  /* Bo STT chay qua MutationObserver (gop nhip 30ms) — cho mot nhip roi moi doc. */
  await new Promise(r => setTimeout(r, 120));
  bang(sttDangHien(), ['1', '2', '3'], '⚠️ loc con 3 dong -> STT danh lai 1,2,3 (khong giu so cu 3,5,8)');
  bang(maDangHien(), ['DH2609003', 'DH2609005', 'DH2609008'], 'va dung 3 lenh cua Minh Long');

  go('');
  await new Promise(r => setTimeout(r, 120));
  bang(sttDangHien(), ['1', '2', '3', '4', '5', '6', '7', '8'], 'bo loc -> ve 1..8');

  /* ============================================================================================
     7. NGUON: mot ham loc duy nhat + khong con ban sao boDau
     ============================================================================================ */
  console.log('\n=== 7. Doc nguon: mot ban cong thuc ===');
  const thanRender = catKhoi(sQlsx, 'async function renderOrders(', '{', '}');
  bang((thanRender.match(/tr\.style\.display =/g) || []).length, 1,
    '⚠️ CHI MOT cho ghi tr.style.display trong renderOrders (hai cho = hai bo loc tranh nhau)');
  kiem(/data-tim="\$\{escapeHtml\(chuoiTim\(o\)\)\}"/.test(thanRender),
    'chuoi tim gan vao data-tim va CO escapeHtml (ten hang co dau nhay la vo the HTML)');
  kiem(!/textContent\.toLowerCase\(\)\.includes/.test(thanRender),
    'khong tim theo textContent cua ca dong');

  bang((sCommon.match(/function boDau\(/g) || []).length, 1, 'boDau() khai DUNG MOT lan trong common.js');
  bang((sQlsx.match(/normalize\('NFD'\)/g) || []).length, 0,
    'module.qlsx.js khong con ban sao bo dau rieng (da dung boDau chung)');
  kiem(/const ds = \(dm\.nhanVien \|\| \[\]\)\.filter\(nv => boDau\(nv\.TenBoPhan\)/.test(sQlsx),
    'nhanVienKyThuat() dung boDau chung');
  kiem(/boDau\(tr\.textContent\)\.includes\(q\)/.test(sCommon),
    'wireTableSearch (cac man khac) cung so khop KHONG DAU');

  console.log('\n=== 8. Nap file: ?v= da bump ===');
  const v = (t) => (sIndex.match(new RegExp(t.replace('.', '\\.') + '\\?v=([\\d.]+)')) || [])[1];
  kiem(v('common.js') === v('module.qlsx.js'),
    'common.js va module.qlsx.js cung moc phien ban (hai file sua cung dot)',
    `${v('common.js')} vs ${v('module.qlsx.js')}`);
  kiem(parseFloat(v('module.qlsx.js')) >= 7.92, 'module.qlsx.js?v= >= 7.92', v('module.qlsx.js'));

  console.log(`\n================ KET QUA: ${dat} dat / ${truot} truot ================\n`);
  process.exit(truot ? 1 : 0);
})().catch(e => { console.error('\nLOI CHAY:', e); process.exit(1); });
