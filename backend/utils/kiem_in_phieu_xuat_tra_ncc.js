/* ================================================================================================
   KIEM CHUNG v7.49 — Ban in phieu XUAT KHO VAI: phieu TRA NCC phai ghi ro NCC + phieu nhap/ngay
   ------------------------------------------------------------------------------------------------
   Yeu cau: "in phieu xuat kho vai, neu tra nha cung cap thi them dong nha cung cap, phieu nhap ngay".

   Diem de sai NHAT: tu v7.48 mot phieu tra GOP DUOC cay cua NHIEU phieu nhap. Ghi mot phieu nhap
   (vd lay dong dau) la BAN IN NOI SAI — nen phai liet ke DU, gop trung. Test nay CHAY THAT ham
   `dsPhieuNhapCuaPhieuXuat()` va `khoiTraNCCHtml()` cat ra tu file frontend that (khong copy code,
   copy thi code doi ma test van xanh) voi 8 canh du lieu.

   Chay:  node utils/kiem_in_phieu_xuat_tra_ncc.js
   ================================================================================================ */
const fs = require('fs');
const path = require('path');

const G = path.join(__dirname, '..');
const doc = (p) => fs.readFileSync(path.join(G, p), 'utf8');

let dat = 0, truot = 0;
const OK = (m) => { dat++; console.log('  OK   ' + m); };
const NO = (m) => { truot++; console.log('  SAI  ' + m); };
const kiem = (dk, m, them) => (dk ? OK(m) : NO(m + (them ? '  -> ' + them : '')));

const sFe = doc('../frontend/js/module.khovai.js');
const sBe = doc('routes/khovai.js');
const sIndex = doc('../frontend/index.html');

/* ------------------------------------------------------------------------------------------------
   CAT 2 ham ra khoi file that roi CHAY. Cac ham phu (escapeHtml/fmtDate) nap ban gia.
   ------------------------------------------------------------------------------------------------ */
function catHam(src, ten) {
  const moc = src.indexOf('function ' + ten + '(');
  if (moc < 0) return null;
  const mo = src.indexOf('{', moc);
  let sau = 1, i = mo + 1, chuoi = null;
  for (; i < src.length && sau > 0; i++) {
    const c = src[i];
    if (chuoi) { if (c === chuoi && src[i - 1] !== '\\') chuoi = null; continue; }
    if (c === "'" || c === '"' || c === '`') { chuoi = c; continue; }
    if (c === '{') sau++;
    else if (c === '}') sau--;
  }
  return sau === 0 ? src.slice(moc, i) : null;
}
const mDs = catHam(sFe, 'dsPhieuNhapCuaPhieuXuat');
const mKhoi = catHam(sFe, 'khoiTraNCCHtml');

console.log('\n=== 1. Cat duoc 2 ham tu file that ===');
kiem(!!mDs, 'cat duoc dsPhieuNhapCuaPhieuXuat()');
kiem(!!mKhoi, 'cat duoc khoiTraNCCHtml()');
if (!mDs || !mKhoi) { console.log('\nDUNG: khong cat duoc ham.'); process.exit(1); }

const escapeHtml = (s) => (s == null ? '' : String(s).replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
const fmtDate = (d) => {
  const x = new Date(d);
  if (isNaN(x)) return '';
  const h = n => String(n).padStart(2, '0');
  return `${h(x.getDate())}/${h(x.getMonth() + 1)}/${x.getFullYear()}`;
};
const moi = new Function('escapeHtml', 'fmtDate',
  `${mDs}\n${mKhoi}\nreturn { dsPhieuNhapCuaPhieuXuat, khoiTraNCCHtml };`)(escapeHtml, fmtDate);
const { dsPhieuNhapCuaPhieuXuat: dsPN, khoiTraNCCHtml: khoi } = moi;

const dong = (id, ngay, hd) => ({ PhieuNhapID: id, NgayPhieuNhap: ngay, SoHoaDonNhap: hd || null });

console.log('\n=== 2. NHIEU phieu nhap trong mot phieu tra -> liet ke DU (loi de mac nhat) ===');
const lines2 = [dong(12, '2026-08-12'), dong(15, '2026-08-20'), dong(12, '2026-08-12')];
const ds2 = dsPN(lines2);
kiem(ds2.length === 2, '3 dong thuoc 2 phieu nhap -> 2 nhan (gop trung)', String(ds2.length));
kiem(ds2[0] === 'NKV-00012 (12/08/2026)', 'nhan 1 dung dinh dang NKV-##### (dd/mm/yyyy)', ds2[0]);
kiem(ds2[1] === 'NKV-00015 (20/08/2026)', 'nhan 2 dung', ds2[1]);
const html2 = khoi({ LaTraNCC: 1, TenNCC: 'Cty Dệt Phong Phú' }, lines2);
kiem(/Trả nhà cung cấp:<\/b> Cty Dệt Phong Phú/.test(html2), 'ban in co dong "Tra nha cung cap"');
kiem(/Theo phiếu nhập:<\/b> NKV-00012 \(12\/08\/2026\) · NKV-00015 \(20\/08\/2026\)/.test(html2),
  'ban in liet ke DU CA HAI phieu nhap', html2.replace(/\s+/g, ' '));

console.log('\n=== 3. KHONG phai phieu tra NCC -> KHONG hien gi ===');
kiem(khoi({ LaTraNCC: 0, TenNCC: 'X' }, lines2) === '', 'LaTraNCC = 0 -> chuoi rong');
kiem(khoi({}, lines2) === '', 'phieu cu / chua chay migration (khong co cot) -> chuoi rong');
kiem(khoi(null, lines2) === '', 'header null -> khong vang');
kiem(khoi({ LaTraNCC: true }, lines2) !== '', 'LaTraNCC = true (kieu Bit tra ve boolean) van hien');

console.log('\n=== 4. Cac canh du lieu thieu ===');
kiem(/chưa khai nhà cung cấp/.test(khoi({ LaTraNCC: 1 }, lines2)),
  'thieu TenNCC -> ghi ro "(chua khai nha cung cap)" chu khong de trang');
const htmlKhongPN = khoi({ LaTraNCC: 1, TenNCC: 'A' }, [{ PhieuNhapID: null }]);
kiem(!/Theo phiếu nhập/.test(htmlKhongPN), 'khong biet phieu nhap -> BO dong do, khong in dong rong');
const dsKhongNgay = dsPN([dong(7, null)]);
kiem(dsKhongNgay[0] === 'NKV-00007', 'thieu ngay -> chi ghi so phieu', dsKhongNgay[0]);
const dsHD = dsPN([dong(7, '2026-08-01', 'HD123')]);
kiem(dsHD[0] === 'NKV-00007 (01/08/2026 HĐ HD123)', 'co so hoa don thi ghi kem', dsHD[0]);
kiem(dsPN([]).length === 0 && dsPN(null).length === 0, 'lines rong / null -> mang rong');
kiem(/&lt;script&gt;/.test(khoi({ LaTraNCC: 1, TenNCC: '<script>x</script>' }, [])),
  'ten NCC duoc escape (khong nhung HTML tho vao ban in)');

console.log('\n=== 5. Dung CHUNG cho ban in va popup xem (khong hai ban) ===');
/* TRU dong DINH NGHIA: `function khoiTraNCCHtml(header, lines)` cung khop mau goi ham. Dem ca dong
   dinh nghia la con so lech 1 ma van "xanh" o lan sau — dung bay da mac o kiem_cong_no_truoc.js. */
const soGoi = (sFe.match(/khoiTraNCCHtml\(header, lines\)/g) || []).length
  - (sFe.match(/function khoiTraNCCHtml\(header, lines\)/g) || []).length;
kiem(soGoi === 2,
  'khoiTraNCCHtml() duoc goi o DUNG 2 cho: printPhieuXuatFromData + openXuatDetailModal',
  String(soGoi));
kiem((sFe.match(/Trả nhà cung cấp:<\/b>/g) || []).length === 1,
  'chuoi nhan chi xuat hien MOT lan trong code (khong copy sang cho thu hai)');

console.log('\n=== 6. Backend cap du du lieu ===');
const routeXem = sBe.slice(sBe.indexOf("router.get('/xuat/:id'"), sBe.indexOf("router.put('/xuat/:id'"));
kiem(/coCot\(pool, 'PhieuXuatVai', 'NCC_ID'\)/.test(routeXem),
  'DO COT NCC_ID truoc khi JOIN (migration v6.66 co the chua chay)');
kiem(/LEFT JOIN NhaCungCap ncc ON ncc\.NCC_ID = p\.NCC_ID/.test(routeXem), 'join lay TenNCC');
kiem(/CAST\(NULL AS NVARCHAR\(150\)\) AS TenNCC/.test(routeXem),
  'chua co cot -> tra NULL, route khong sap');
kiem(/v\.PhieuNhapID, pnv\.NgayNhap AS NgayPhieuNhap, pnv\.SoHoaDon AS SoHoaDonNhap/.test(routeXem),
  'moi DONG mang theo phieu nhap goc + ngay cua PHIEU (khong dung v.NgayNhap cua cay)');
kiem(/LEFT JOIN PhieuNhapVai pnv ON pnv\.PhieuNhapID = v\.PhieuNhapID/.test(routeXem),
  'join PhieuNhapVai (LEFT: cay mat phieu nhap thi dong van hien)');

console.log('\n=== 7. Bump ?v= ===');
kiem(/module\.khovai\.js\?v=7\.49/.test(sIndex), 'index.html: module.khovai.js?v=7.49');

console.log(`\n================ KET QUA: ${dat} dat / ${truot} sai ================`);
process.exit(truot ? 1 : 0);
