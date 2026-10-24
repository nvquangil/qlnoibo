/* ================================================================================================
   KIEM CHUNG v8.97 — THE KHO HANG HOA: COT "NGUON HANG" HIEN LENH SX + PHIEU NHAP KHO, BAM MO DUOC
   ------------------------------------------------------------------------------------------------
   Nguyen 2026-10-22: "thẻ kho hàng hóa. cột nguồn hàng nếu là nhà sx điền thêm lệnh sx và có thể
   click vào xem được lệnh đó".
   Nguyen 2026-10-23: "cột nguồn hàng thêm số phiếu nhập kho có thể mở xem luôn".

   NAM CHO DE SAI, moi cho co assert rieng:
     1. NGUON LENH: tu v6.82 the kho KHONG gan lenh nua, lenh nam o PHIEU NHAP KHO loai SX. Chi doc
        TheKhoHangHoa.DonHangID (nhu view cu) la hau het ma van trong. Phai HOP hai nguon, va phai la
        CUNG cong thuc voi maHangCuaLenh() ben gia von — khong thi hai man noi hai kieu.
     2. KHONG LAM SAP /items: endpoint nuoi 8 man hinh. Cau doc phai boc try/catch, loi -> rong.
     3. GOM LENH BANG JS tu cung mot lan quet phieu: SoPhieu dem DUNG so phieu (khong dem dong mau),
        NgayNhapGanNhat la MAX, lenh chi gan o the tay van co mat voi SoPhieu 0 va xep cuoi.
     4. GIAO DIEN: nhieu lenh/phieu -> chi hien SO_LENH_HIEN, con lai "+N ... nua" rieng tung dong;
        backend cu (chua deploy) khong co LenhSX -> lui ve MaDH cua view, van bam duoc; MaDH/SoPhieu
        la du lieu -> phai escape.
     5. MO: qlsx phai EXPORT openOrderDetail; khohang goi qua window.ModuleQLSX / window.ModuleNhapKho,
        bat loi quyen bang toast (apiGet nem Error, khong tu toast).

   Chay:  node backend\utils\kiem_lenh_sx_the_kho.js        (tu thu muc goc QLNoiBo)
          JSDOM khong bat buoc — thieu thi bo qua phan bam "+N ... nua".
   ================================================================================================ */
const fs = require('fs');
const path = require('path');
const G = path.join(__dirname, '..');
const doc = (p) => fs.readFileSync(path.join(G, p), 'utf8');

let dat = 0, truot = 0;
const OK = (m) => { dat++; console.log('  OK   ' + m); };
const NO = (m) => { truot++; console.log('  SAI  ' + m); };
const kiem = (dk, m, them) => (dk ? OK(m) : NO(m + (them ? '  -> ' + them : '')));

const sBE = doc('routes/khohang.js');
const sGV = doc('utils/giaVonLenhSX.js');
const sFe = doc('../frontend/js/module.khohang.js');
const sQL = doc('../frontend/js/module.qlsx.js');
const sNK = doc('../frontend/js/module.nhapkho.js');
const sIndex = doc('../frontend/index.html');

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
// Bo comment (khoi va dong) truoc khi kiem "KHONG duoc chua X" (bai hoc kiem_ho_so_nhan_su).
function boComment(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

/* ---------------------------------------------------------------------------------------------- */
console.log('\n=== 1. BACKEND — layNguonHangTheoMaHang: mot lan quet phieu + the tay, cung cong thuc voi gia von ===');
const fnNguon = catKhoi(sBE, 'async function layNguonHangTheoMaHang', '{', '}');
kiem(fnNguon.length > 0, 'co ham layNguonHangTheoMaHang');
kiem(/SELECT DISTINCT ct\.MaHangID, p\.PhieuNKID, p\.SoPhieu, p\.NgayNhap, p\.LoaiNhap,\s*p\.DonHangID, d\.MaDH, d\.TenSanPham, d\.TrangThai AS TrangThaiLenh, ncc\.TenNCC/.test(fnNguon),
  'cau phieu: DISTINCT theo (ma, phieu) + lenh cua phieu + ten NCC');
kiem(/FROM PhieuNhapKhoHangChiTiet ct\s+JOIN PhieuNhapKhoHang p ON p\.PhieuNKID = ct\.PhieuNKID/.test(fnNguon), 'nguon phieu: dong phieu -> phieu');
kiem(/LEFT JOIN DonHangSanXuat d ON d\.DonHangID = p\.DonHangID/.test(fnNguon) && /LEFT JOIN NhaCungCap ncc ON ncc\.NCC_ID = p\.NCC_ID/.test(fnNguon),
  'LEFT JOIN lenh va NCC (phieu NCC khong co lenh, phieu SX khong co NCC — khong duoc rot dong)');
kiem(/WHERE p\.TrangThai <> N'Đã hủy'\s+ORDER BY ct\.MaHangID, p\.NgayNhap DESC, p\.PhieuNKID DESC/.test(fnNguon),
  'bo phieu da huy; xep moi nhat truoc; moi cot ORDER BY deu co trong SELECT (DISTINCT bat buoc)');
kiem(/FROM TheKhoHangHoa h\s+JOIN DonHangSanXuat d ON d\.DonHangID = h\.DonHangID/.test(fnNguon), 'nguon 2 cua lenh: TheKhoHangHoa.DonHangID (the tao tay)');
kiem(/if \(x\.DonHangID && x\.MaDH\)/.test(fnNguon) && /l\.SoPhieu\+\+/.test(fnNguon), 'gom lenh tu phieu: moi cap (ma, phieu) cong 1 vao SoPhieu');
kiem(/dsTheTay\.forEach\(x => ghiLenh\(x\.MaHangID, x\)\)/.test(fnNguon), 'the tay chi THEM lenh chua co, khong de len SoPhieu/NgayNhap da gom tu phieu');
kiem(/return \(tb - ta\) \|\| \(b\.DonHangID - a\.DonHangID\)/.test(fnNguon), 'xep lenh: ngay nhap gan nhat truoc, cung ngay/chua nhap -> lenh moi hon truoc');
kiem(/try \{[\s\S]*\} catch \(e\) \{[\s\S]*console\.error[\s\S]*lenh\.clear\(\); phieu\.clear\(\);/.test(fnNguon) && !/throw/.test(boComment(fnNguon)),
  'boc try/catch, loi -> log + HAI Map rong, KHONG throw (khong lam sap /items)');
kiem(/return \{ lenh, phieu \};\s*\}$/.test(fnNguon.trim()), 'luon return { lenh, phieu }');
/* Cung cong thuc voi gia von: maHangCuaLenh cung dung TheKhoHangHoa.DonHangID + PhieuNhapKhoHang khong huy. */
const fnGV = catKhoi(sGV, 'async function maHangCuaLenh', '{', '}');
kiem(/TheKhoHangHoa h WHERE h\.DonHangID = @id/.test(fnGV) && /PhieuNhapKhoHang p ON p\.PhieuNKID = ct\.PhieuNKID[\s\S]*TrangThai <> N'Đã hủy'/.test(fnGV),
  'giaVonLenhSX.maHangCuaLenh van la HOP cua dung hai nguon do (doi chieu chieu nguoc)');

console.log('\n=== 2. BACKEND — chay that phan gom JS tren du lieu gia lap ===');
/* Trich phan JS sau hai cau SQL: thay pool bang stub tra ve 2 recordset. */
let gom = null;
try {
  const fnChay = new Function('pool', fnNguon.replace(/^async function layNguonHangTheoMaHang\(pool\)\s*\{/, '').replace(/\}\s*$/, '')
    .replace(/\(await pool\.request\(\)\.query\(`[\s\S]*?`\)\)\.recordset/, 'pool.phieu')
    .replace(/\(await pool\.request\(\)\.query\(`[\s\S]*?`\)\)\.recordset/, 'pool.theTay'));
  const d = (s) => new Date(s + 'T00:00:00');
  gom = fnChay({
    phieu: [   // da xep MaHangID, NgayNhap DESC, PhieuNKID DESC nhu SQL
      { MaHangID: 1, PhieuNKID: 30, SoPhieu: 'NK260030', NgayNhap: d('2026-10-20'), LoaiNhap: 'SanXuat', DonHangID: 7, MaDH: 'DH7', TenSanPham: 'SP7', TrangThaiLenh: 'Hoàn thành', TenNCC: null },
      { MaHangID: 1, PhieuNKID: 29, SoPhieu: 'NK260029', NgayNhap: d('2026-10-18'), LoaiNhap: 'SanXuat', DonHangID: 9, MaDH: 'DH9', TenSanPham: 'SP9', TrangThaiLenh: 'Đang sản xuất', TenNCC: null },
      { MaHangID: 1, PhieuNKID: 28, SoPhieu: 'NK260028', NgayNhap: d('2026-10-10'), LoaiNhap: 'SanXuat', DonHangID: 7, MaDH: 'DH7', TenSanPham: 'SP7', TrangThaiLenh: 'Hoàn thành', TenNCC: null },
      { MaHangID: 1, PhieuNKID: 27, SoPhieu: 'NK260027', NgayNhap: d('2026-10-01'), LoaiNhap: 'NhaCungCap', DonHangID: null, MaDH: null, TenSanPham: null, TrangThaiLenh: null, TenNCC: 'Cty A' },
      { MaHangID: 2, PhieuNKID: 26, SoPhieu: 'NK260026', NgayNhap: d('2026-09-30'), LoaiNhap: 'NhaCungCap', DonHangID: null, MaDH: null, TenSanPham: null, TrangThaiLenh: null, TenNCC: 'Cty B' }
    ],
    theTay: [
      { MaHangID: 1, DonHangID: 5, MaDH: 'DH5', TenSanPham: 'SP5', TrangThai: 'Hoàn thành' },   // the tay, chua co phieu
      { MaHangID: 1, DonHangID: 6, MaDH: 'DH6', TenSanPham: 'SP6', TrangThai: 'Hoàn thành' },   // the tay thu 2 -> ca hai NULL ngay: moi hon truoc
      { MaHangID: 1, DonHangID: 7, MaDH: 'DH7', TenSanPham: 'SP7', TrangThai: 'Hoàn thành' },   // trung voi phieu -> khong them, khong de len
      { MaHangID: 3, DonHangID: 4, MaDH: 'DH4', TenSanPham: 'SP4', TrangThai: 'Hoàn thành' }    // ma chi co the tay
    ]
  });
  // Ham that la async nhung sau khi thay SQL bang stub thi khong con await -> new Function tra thang gia tri.
  if (gom && typeof gom.then === 'function') throw new Error('stub van tra Promise');
  OK('nap duoc phan gom JS voi pool gia lap');
} catch (e) { NO('nap phan gom JS: ' + e.message); }
if (gom) {
  const l1 = gom.lenh.get(1) || [], p1 = gom.phieu.get(1) || [];
  kiem(l1.map(l => l.MaDH).join(',') === 'DH7,DH9,DH6,DH5',
    `ma 1: lenh xep DH7 (nhap 20/10) > DH9 (18/10) > DH6 > DH5 (hai the tay chua nhap: moi hon truoc)  [duoc: ${l1.map(l => l.MaDH).join(',')}]`);
  const dh7 = l1.find(l => l.MaDH === 'DH7') || {};
  kiem(dh7.SoPhieu === 2 && dh7.NgayNhapGanNhat && new Date(dh7.NgayNhapGanNhat).getDate() === 20, `ma 1/DH7: SoPhieu = 2, NgayNhapGanNhat = 20/10  [duoc: ${dh7.SoPhieu}, ${dh7.NgayNhapGanNhat}]`);
  const dh5 = l1.find(l => l.MaDH === 'DH5') || {};
  kiem(dh5.SoPhieu === 0 && dh5.NgayNhapGanNhat === null, 'ma 1/DH5 (the tay): SoPhieu 0, NgayNhapGanNhat null');
  kiem(p1.map(p => p.SoPhieu).join(',') === 'NK260030,NK260029,NK260028,NK260027', `ma 1: 4 phieu, moi nhat truoc, gom ca phieu NCC  [duoc: ${p1.map(p => p.SoPhieu).join(',')}]`);
  kiem(p1[3].TenNCC === 'Cty A' && p1[0].MaDH === 'DH7', 'phieu NCC mang TenNCC, phieu SX mang MaDH');
  kiem((gom.lenh.get(2) || []).length === 0 && (gom.phieu.get(2) || []).length === 1, 'ma 2 (chi phieu NCC): 0 lenh, 1 phieu');
  kiem((gom.lenh.get(3) || []).map(l => l.MaDH).join() === 'DH4' && !gom.phieu.has(3), 'ma 3 (chi the tay): 1 lenh, 0 phieu');
}

console.log('\n=== 3. BACKEND — /items va /items/export dung ham ===');
const rtItems = sBE.slice(sBE.indexOf("router.get('/items', requireAuth"), sBE.indexOf("router.get('/items/export'"));
kiem(/const canNguon = String\(req\.query\.nguon \|\| ''\) === '1';\s*const nguon = canNguon \? await layNguonHangTheoMaHang\(pool\) : null;/.test(rtItems),
  '/items: CHI goi layNguonHangTheoMaHang khi ?nguon=1 (9 man khac goi /items khong ganh them du lieu)');
kiem(/\.\.\.\(nguon \? \{ LenhSX: nguon\.lenh\.get\(r\.MaHangID\) \|\| \[\], PhieuNhap: nguon\.phieu\.get\(r\.MaHangID\) \|\| \[\] \} : \{\}\)/.test(rtItems),
  '/items: co co -> LenhSX + PhieuNhap (mang, rong khi khong co); khong co -> KHONG co truong (undefined = "chua hoi")');
kiem(/apiGet\('\/api\/khohang\/items\?nguon=1'\)/.test(sFe) && (sFe.match(/apiGet\('\/api\/khohang\/items\?nguon=1'\)/g) || []).length === 1,
  'frontend: DUNG MOT cho goi /items?nguon=1 (renderItems), cac cho khac van goi khong co');
kiem(/\.\.\.r, DangGiu: dangGiu/.test(rtItems), '/items: van tra ...r (MaDH cua view giu nguyen cho client cu)');
const rtExport = catKhoi(sBE, "router.get('/items/export'", '{', '}');
kiem(/const nguon = await layNguonHangTheoMaHang\(pool\)/.test(rtExport), '/items/export: goi layNguonHangTheoMaHang');
kiem(/MaDH: lenh\.length \? lenh\.map\(l => l\.MaDH\)\.join\(', '\) : \(r\.MaDH \|\| ''\)/.test(rtExport),
  '/items/export: cot "Ma don hang SX" = moi lenh noi dau phay, khong co thi giu MaDH cu');
kiem(/\{ header: 'Phiếu nhập kho', key: 'PhieuNhap'/.test(rtExport) && /PhieuNhap: pn\.map\(p => p\.SoPhieu\)\.join\(', '\)/.test(rtExport),
  '/items/export: them cot "Phieu nhap kho"');

console.log('\n=== 4. FRONTEND — qlsx export openOrderDetail; nhapkho export xemPhieu; khohang goi qua window.* ===');
kiem(/return \{ render, getTabs, printLenhSanXuat, openOrderDetail \};/.test(sQL), 'module.qlsx.js export openOrderDetail');
kiem(/async function openOrderDetail\(maDH\)/.test(sQL), 'openOrderDetail(maDH) ton tai trong qlsx');
kiem(/window\.ModuleNhapKho = \{[^}]*\bxemPhieu\b/.test(sNK) && /async function xemPhieu\(id\)/.test(sNK), 'module.nhapkho.js export xemPhieu(id) (co san tu v6.83)');
const fnMo = catKhoi(sFe, 'function moLenhSX', '{', '}');
kiem(/window\.ModuleQLSX/.test(fnMo), 'moLenhSX doc window.ModuleQLSX (khong goi ham noi bo cua module khac)');
kiem(/q\.openOrderDetail/.test(fnMo) && /q\.printLenhSanXuat/.test(fnMo), 'uu tien openOrderDetail, fallback printLenhSanXuat');
kiem(/toast\('module\.qlsx\.js trên máy chủ chưa cập nhật v8\.97/.test(fnMo),
  'fallback KHONG im lang: bao ro module.qlsx.js tren may chu con ban cu (bai hoc deploy v8.92)');
kiem(/\.catch\(err => toast\(/.test(fnMo), 'bat loi (403 quyen QLSX, 404 lenh) bang toast — apiGet nem Error, khong tu bao');
const fnMoP = catKhoi(sFe, 'function moPhieuNhap', '{', '}');
kiem(/window\.ModuleNhapKho/.test(fnMoP) && /m\.xemPhieu\(id\)/.test(fnMoP) && /\.catch\(err => toast\(/.test(fnMoP),
  'moPhieuNhap: window.ModuleNhapKho.xemPhieu(id), bat loi bang toast');

console.log('\n=== 5. FRONTEND — bang the kho: cot Nguon hang + tim kiem + wiring ===');
const rtRender = catKhoi(sFe, 'async function renderItems', '{', '}');
kiem(/<td>\$\{oNguonHangHtml\(r\)\}<\/td>/.test(rtRender), 'o Nguon hang ve bang oNguonHangHtml(r)');
kiem(!/Nhà SX\$\{r\.MaDH/.test(rtRender), 'da bo cach ve cu (Nha SX · MaDH chi la chu, khong bam duoc)');
kiem(/const chuoiLenh = dsLenhSXCuaDong\(r\)\.map\(l => l\.MaDH\)\.concat\(dsPhieuNhapCuaDong\(r\)\.map\(p => p\.SoPhieu\)\)\.join\(' '\)/.test(rtRender)
  && /\+ ' ' \+ chuoiLenh\)\.toLowerCase\(\)/.test(rtRender),
  'data-search gom MOI ma lenh + MOI so phieu (tim theo lenh/phieu ra duoc ma hang)');
kiem(/querySelectorAll\('\.act-xem-lenh'\)[\s\S]{0,200}moLenhSX\(a\.dataset\.madh\)/.test(rtRender), 'wire .act-xem-lenh -> moLenhSX');
kiem(/querySelectorAll\('\.act-xem-phieu'\)[\s\S]{0,200}moPhieuNhap\(a\.dataset\.id\)/.test(rtRender), 'wire .act-xem-phieu -> moPhieuNhap');
kiem(/querySelectorAll\('\.act-them'\)[\s\S]{0,400}querySelector\('\.kh-them'\)/.test(rtRender), 'wire .act-them -> xo .kh-them cua dung dong do');
kiem(/module\.khohang\.js\?v=8\.97/.test(sIndex), 'index.html: module.khohang.js?v=8.97');
const vQlsx = Number(((sIndex.match(/module\.qlsx\.js\?v=([\d.]+)/) || [])[1]) || 0);
kiem(vQlsx >= 8.97, `index.html: module.qlsx.js?v= >= 8.97 (co export moi)  [duoc: ${vQlsx}]`);

console.log('\n=== 6. CHAY THAT oNguonHangHtml tren du lieu gia lap ===');
const srcDs = catKhoi(sFe, 'function dsLenhSXCuaDong', '{', '}');
const srcDsP = catKhoi(sFe, 'function dsPhieuNhapCuaDong', '{', '}');
const srcGon = catKhoi(sFe, 'function dsLinkGonHtml', '{', '}');
const srcO = catKhoi(sFe, 'function oLenhSXHtml', '{', '}');
const srcOP = catKhoi(sFe, 'function oPhieuNhapHtml', '{', '}');
const srcN = catKhoi(sFe, 'function oNguonHangHtml', '{', '}');
const mSo = sFe.match(/const SO_LENH_HIEN = (\d+);/);
kiem(srcDs && srcDsP && srcGon && srcO && srcOP && srcN && mSo, 'trich duoc 6 ham + SO_LENH_HIEN');
const escapeHtml = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmtDate = (d) => { const x = new Date(d); return isNaN(x) ? '' : `${String(x.getDate()).padStart(2, '0')}/${String(x.getMonth() + 1).padStart(2, '0')}/${x.getFullYear()}`; };
let ve = null;
try {
  ve = new Function('escapeHtml', 'fmtDate', 'SO_LENH_HIEN',
    `${srcDs}\n${srcDsP}\n${srcGon}\n${srcO}\n${srcOP}\n${srcN}\nreturn { oNguonHangHtml };`)(escapeHtml, fmtDate, Number(mSo[1]));
  OK('6 ham nap duoc (khong tham chieu bien ngoai nao khac escapeHtml/fmtDate/SO_LENH_HIEN)');
} catch (e) { NO('nap 6 ham: ' + e.message); }
if (ve) {
  const dem = (html, re) => (html.match(re) || []).length;
  const lenh = (n) => Array.from({ length: n }, (_, i) => ({ DonHangID: 100 - i, MaDH: 'DH26' + String(100 - i).padStart(5, '0'), TenSanPham: 'SP ' + i, TrangThai: 'Hoàn thành' }));
  const phieu = (n) => Array.from({ length: n }, (_, i) => ({ PhieuNKID: 500 - i, SoPhieu: 'NK26' + String(500 - i).padStart(4, '0'), NgayNhap: '2026-10-0' + (9 - i % 9) + 'T00:00:00', LoaiNhap: i % 2 ? 'NhaCungCap' : 'SanXuat', MaDH: i % 2 ? null : 'DH2600100', TenNCC: i % 2 ? 'Cty A' : null }));

  let h = ve.oNguonHangHtml({ LoaiHang: 'NhaSanXuat', LenhSX: [], PhieuNhap: [] });
  kiem(/badge info">Nhà SX</.test(h) && !/Lệnh:/.test(h) && !/Phiếu:/.test(h), 'Nha SX, 0 lenh 0 phieu -> chi nhan');

  h = ve.oNguonHangHtml({ LoaiHang: 'DatNgoai', LenhSX: [], PhieuNhap: [{ PhieuNKID: 500, SoPhieu: 'NK260500', NgayNhap: '2026-10-09T00:00:00', LoaiNhap: 'NhaCungCap', TenNCC: 'Cty A' }] });
  kiem(/badge warn">Đặt ngoài</.test(h) && !/Lệnh:/.test(h) && /Phiếu: /.test(h) && dem(h, /class="act-xem-phieu"/g) === 1 && /data-id="500"/.test(h),
    'Dat ngoai, 1 phieu NCC -> khong dong Lenh, co dong Phieu voi 1 link data-id');

  h = ve.oNguonHangHtml({ LoaiHang: 'NhaSanXuat', LenhSX: lenh(1), PhieuNhap: phieu(2) });
  kiem(dem(h, /class="act-xem-lenh"/g) === 1 && /data-madh="DH2600100"/.test(h) && dem(h, /class="act-xem-phieu"/g) === 2 && !/act-them/.test(h),
    '1 lenh + 2 phieu -> 1 link lenh, 2 link phieu, khong co "+N"');
  kiem(h.indexOf('Lệnh:') < h.indexOf('Phiếu:'), 'dong Lenh dung tren dong Phieu');

  h = ve.oNguonHangHtml({ LoaiHang: 'NhaSanXuat', LenhSX: lenh(3), PhieuNhap: [] });
  kiem(dem(h, /class="act-xem-lenh"/g) === 3 && !/act-them/.test(h), '3 lenh (= SO_LENH_HIEN) -> 3 link, khong co "+N"');

  h = ve.oNguonHangHtml({ LoaiHang: 'NhaSanXuat', LenhSX: lenh(5), PhieuNhap: phieu(7) });
  kiem(dem(h, /class="act-xem-lenh"/g) === 5 && /\+2 lệnh nữa/.test(h) && dem(h, /class="act-xem-phieu"/g) === 7 && /\+4 phiếu nữa/.test(h)
    && dem(h, /class="kh-them" style="display:none;"/g) === 2 && dem(h, /class="act-them"/g) === 2,
    '5 lenh + 7 phieu -> "+2 lenh nua" va "+4 phieu nua", moi dong mot .kh-them + mot .act-them rieng');
  const iGiau = h.indexOf('kh-them'), iL4 = h.indexOf('DH2600097'), iL3 = h.indexOf('DH2600098');
  kiem(iL3 < iGiau && iL4 > iGiau, 'thu tu giu nguyen: 3 lenh dau hien, lenh thu 4 tro di nam trong phan giau');

  h = ve.oNguonHangHtml({ LoaiHang: 'NhaSanXuat', MaDH: 'DH2608073' });   // backend cu: khong co LenhSX/PhieuNhap
  kiem(dem(h, /class="act-xem-lenh"/g) === 1 && /data-madh="DH2608073"/.test(h) && !/Phiếu:/.test(h), 'backend cu (khong LenhSX/PhieuNhap) -> lui ve MaDH cua view, van la link; khong dong Phieu');

  h = ve.oNguonHangHtml({ LoaiHang: 'NhaSanXuat', MaDH: 'DH2608073', LenhSX: [] });
  kiem(!/act-xem-lenh/.test(h), 'backend moi tra LenhSX=[] thi KHONG lui ve MaDH (mang rong la cau tra loi that)');

  h = ve.oNguonHangHtml({ LoaiHang: 'DatNgoai', LenhSX: lenh(1) });
  kiem(/Đặt ngoài/.test(h) && /act-xem-lenh/.test(h), 'Dat ngoai ma co lenh -> van hien lenh (lo du lieu mau thuan, khong giau)');

  h = ve.oNguonHangHtml({ LoaiHang: 'NhaSanXuat', LenhSX: [{ MaDH: 'X"><img src=x onerror=alert(1)>', TenSanPham: '<b>' }], PhieuNhap: [{ PhieuNKID: 1, SoPhieu: '<s>', TenNCC: '"' }] });
  kiem(!/<img/.test(h) && /&lt;img/.test(h) && /data-madh="X&quot;&gt;/.test(h) && !/<s>/.test(h) && /&lt;s&gt;/.test(h), 'MaDH/TenSanPham/SoPhieu/TenNCC la du lieu -> escape (khong lot the)');

  h = ve.oNguonHangHtml({ LoaiHang: 'NhaSanXuat', LenhSX: [{ MaDH: 'DH1' }, { DonHangID: 2 }, null], PhieuNhap: [{ PhieuNKID: 1, SoPhieu: 'NK1' }, { PhieuNKID: 2 }, { SoPhieu: 'NK3' }, null] });
  kiem(dem(h, /class="act-xem-lenh"/g) === 1 && dem(h, /class="act-xem-phieu"/g) === 1, 'phan tu thieu MaDH / PhieuNKID / SoPhieu / null bi bo qua, khong ve link rong');

  h = ve.oNguonHangHtml({ LoaiHang: 'NhaSanXuat', LenhSX: [{ MaDH: 'DH2609111', TenSanPham: 'Quần bé trai', TrangThai: 'Đang sản xuất', NgayNhapGanNhat: '2026-10-15T00:00:00', SoPhieu: 2 }],
    PhieuNhap: [{ PhieuNKID: 9, SoPhieu: 'NK260009', NgayNhap: '2026-10-15T00:00:00', LoaiNhap: 'SanXuat', MaDH: 'DH2609111' }, { PhieuNKID: 8, SoPhieu: 'NK260008', NgayNhap: '2026-10-14T00:00:00', LoaiNhap: 'NhaCungCap', TenNCC: 'Cty A' }] });
  kiem(/title="Quần bé trai · Đang sản xuất · nhập gần nhất 15\/10\/2026 · 2 phiếu nhập — bấm để xem lệnh"/.test(h),
    'tooltip lenh: ten SP · trang thai · nhap gan nhat dd/mm/yyyy · so phieu');
  kiem(/title="15\/10\/2026 · từ sản xuất · DH2609111 — bấm để xem phiếu"/.test(h) && /title="14\/10\/2026 · từ NCC Cty A — bấm để xem phiếu"/.test(h),
    'tooltip phieu: ngay · tu san xuat · lenh  /  ngay · tu NCC ten');
  h = ve.oNguonHangHtml({ LoaiHang: 'NhaSanXuat', LenhSX: [{ MaDH: 'DH2609111', SoPhieu: 0, NgayNhapGanNhat: null }] });
  kiem(/title="Lệnh sản xuất — bấm để xem lệnh"/.test(h), 'tooltip lenh: the tay khong co phieu (SoPhieu 0, NgayNhap null) -> khong ghi "0 phieu" / "nhap gan nhat"');

  /* Bam "+N ... nua" -> xo DUNG dong do. Can JSDOM; thieu thi bo qua. */
  let JSDOM = null;
  try { JSDOM = require('jsdom').JSDOM; } catch (e) { console.log('  (bo qua) jsdom khong co — khong thu bam "+N ... nua"'); }
  if (JSDOM) {
    const dom = new JSDOM(`<table><tbody><tr><td id="o">${ve.oNguonHangHtml({ LoaiHang: 'NhaSanXuat', LenhSX: lenh(5), PhieuNhap: phieu(7) })}</td></tr></tbody></table>`);
    const body = dom.window.document;
    /* Chep dung doan wire trong renderItems de thu, khong viet lai bang tay. */
    const doanWire = (rtRender.match(/body\.querySelectorAll\('\.act-them'\)\.forEach\([\s\S]*?\n    \}\)\);/) || [''])[0];
    kiem(doanWire.length > 0, 'trich duoc doan wire .act-them trong renderItems');
    try {
      new Function('body', doanWire)(body);
      const nutLenh = body.querySelectorAll('.act-them')[0];   // nut cua dong Lenh (dong tren)
      nutLenh.click();
      const giau = body.querySelectorAll('.kh-them');
      kiem(giau[0].style.display === '' && giau[1].style.display === 'none' && body.querySelectorAll('.act-them').length === 1,
        'bam "+2 lenh nua" -> CHI dong Lenh xo ra, dong Phieu van giau, con lai dung 1 nut');
    } catch (e) { NO('chay doan wire: ' + e.message); }
  }
}

console.log(`\n=== KET QUA: ${dat} dat, ${truot} sai ===`);
process.exit(truot ? 1 : 0);
