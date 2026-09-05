/* ================================================================================================
   KIEM CHUNG v7.44 — Dashboard kinh doanh: bam TEN KHACH phai ra SO CHI TIET CUA CHINH KHACH DO
   ------------------------------------------------------------------------------------------------
   Loi da xay ra: handler chi lam `location.hash = '#CONGNO/congnokh'; location.reload()` nen bam
   khach NAO cung ra DANH SACH cong no tat ca khach — mat luon cai ten vua bam.

   Cach kiem: KHONG mo trinh duyet. CAT nguyen doan than handler tu file .js that (khong copy lai,
   copy la sau nay code doi ma test van xanh) roi CHAY nó bang new Function voi:
     · `a`           = the <a> gia mang data-khach
     · window/toast/location = gia, ghi lai da goi gi
   Nho vay test tra loi dung cau hoi cua nguoi dung: "bam khach B thi co goi so cua khach B khong".

   Chay:  node utils/kiem_dashboard_so_congno.js
   ================================================================================================ */
const fs = require('fs');
const path = require('path');

const FE = path.join(__dirname, '..', '..', 'frontend');
const F_DASH = path.join(FE, 'js', 'module.dashboard.js');
const F_CN = path.join(FE, 'js', 'module.congno.js');
const F_HTML = path.join(FE, 'index.html');
const B_CN = path.join(__dirname, '..', 'routes', 'congno.js');
const B_DASH = path.join(__dirname, '..', 'routes', 'dashboard.js');

let dat = 0, truot = 0;
const OK = (m) => { dat++; console.log('  OK   ' + m); };
const NO = (m) => { truot++; console.log('  SAI  ' + m); };
const kiem = (dk, m) => (dk ? OK(m) : NO(m));
const bang = (thuc, mong, m) =>
  kiem(JSON.stringify(thuc) === JSON.stringify(mong), `${m}  [duoc: ${JSON.stringify(thuc)}]`);

const srcDash = fs.readFileSync(F_DASH, 'utf8');
const srcCN = fs.readFileSync(F_CN, 'utf8');
const srcHtml = fs.readFileSync(F_HTML, 'utf8');

/* ------------------------------------------------------------------------------------------------
   Cat than handler ra khoi file that bang cach dem ngoac (khong regex mot phat — trong than co ca
   `{` cua object va template string).
   ------------------------------------------------------------------------------------------------ */
function catThanHandler(src) {
  const moc = src.indexOf(".db-congno').forEach(a => a.onclick");
  if (moc < 0) return null;
  const mo = src.indexOf('{', src.indexOf('=>', moc + 30));
  let sau = 1, i = mo + 1;
  while (i < src.length && sau > 0) {
    const c = src[i];
    if (c === '{') sau++;
    else if (c === '}') sau--;
    i++;
  }
  return sau === 0 ? src.slice(mo + 1, i - 1) : null;
}

const than = catThanHandler(srcDash);
console.log('\n=== 1. Cat duoc than handler tu file that ===');
kiem(!!than, 'tim thay va cat duoc than handler .db-congno');
if (!than) { console.log('\nDUNG: khong cat duoc handler, cac muc sau khong kiem duoc.'); process.exit(1); }

/* Chay than handler trong hop kin. Tra ve nhat ky da goi gi. */
function chay({ khach, isAdmin = false, xemCongNo = true, coHam = true }) {
  const nk = { goiSo: [], toast: [], hash: null, reload: 0 };
  const a = { dataset: khach === undefined ? {} : { khach } };
  const e = { preventDefault() {} };
  const currentUser = {
    isAdmin,
    permissions: { CONGNO: { canView: xemCongNo } }
  };
  const toast = (msg, kieu) => nk.toast.push({ msg, kieu });
  const location = { set hash(v) { nk.hash = v; }, get hash() { return nk.hash; }, reload: () => { nk.reload++; } };
  const win = coHam
    ? { ModuleCongNo: { render() {}, getTabs() {}, soChiTietKH: (k) => nk.goiSo.push(k) } }
    : { ModuleCongNo: { render() {}, getTabs() {} } };   // ban CU con trong cache trinh duyet
  /* `window` la tham so nen `window.ModuleCongNo` trong than handler tro vao ban gia o day. */
  new Function('a', 'e', 'currentUser', 'toast', 'location', 'window', than)(a, e, currentUser, toast, location, win);
  return nk;
}

console.log('\n=== 2. Bam khach nao ra so cua chinh khach do (loi goc) ===');
const k1 = chay({ khach: 'NPP Vĩnh Phúc - A Chung', isAdmin: true });
bang(k1.goiSo, ['NPP Vĩnh Phúc - A Chung'], 'bam khach A -> mo so chi tiet cua A');
bang(k1.reload, 0, 'KHONG reload trang (truoc day reload nen mat man dashboard)');
bang(k1.hash, null, 'KHONG doi hash sang #CONGNO/congnokh (danh sach chung)');

const k2 = chay({ khach: 'Shop Hà Đông', isAdmin: true });
bang(k2.goiSo, ['Shop Hà Đông'], 'bam khach B -> mo so cua B, khong phai cua A');
kiem(k1.goiSo[0] !== k2.goiSo[0], 'hai khach khac nhau ra hai so khac nhau (khong dinh cung 1 ten)');

console.log('\n=== 3. Ten khach co dau/khoang trang/ky tu la van di nguyen ven ===');
const laLung = 'Cty TNHH "A & B" - chị Hoà (Q.7)';
bang(chay({ khach: laLung, isAdmin: true }).goiSo, [laLung], 'ten co dau ngoac kep, & va dau tieng Viet');

console.log('\n=== 4. Quyen ===');
const k3 = chay({ khach: 'Khách X', isAdmin: false, xemCongNo: false });
bang(k3.goiSo, [], 'khong co quyen xem Cong no -> KHONG mo so');
kiem(k3.toast.length === 1 && k3.toast[0].kieu === 'error', 'bao loi ro rang thay vi im lang / man trang');
const k4 = chay({ khach: 'Khách X', isAdmin: false, xemCongNo: true });
bang(k4.goiSo, ['Khách X'], 'co quyen xem (khong phai admin) -> mo duoc so');

console.log('\n=== 5. Dong khong co ten khach ===');
const k5 = chay({ khach: undefined, isAdmin: true });
bang(k5.goiSo, [], 'thieu data-khach -> KHONG goi so voi ten rong');
kiem(k5.toast.length === 1, 'co thong bao thay vi bam khong phan ung');

console.log('\n=== 6. Trinh duyet con giu module.congno.js CU (thieu ham) -> lui ve cach cu ===');
const k6 = chay({ khach: 'Khách Y', isAdmin: true, coHam: false });
bang(k6.goiSo, [], 'khong co ham thi khong goi');
bang(k6.hash, '#CONGNO/congnokh', 'lui ve mo danh sach cong no');
bang(k6.reload, 1, 'reload de nap lai file moi');
kiem(k6.toast.length === 1 && /Ctrl\+F5/.test(k6.toast[0].msg), 'nhac nguoi dung Ctrl+F5 mot lan');

console.log('\n=== 7. The <a> trong bang co mang ten khach di (data-khach) ===');
kiem(/class="db-congno"[^>]*data-khach="\$\{escapeHtml\(r\.TenKhach\)\}"/.test(srcDash),
  'bangKhach() sinh <a class="db-congno" data-khach="...TenKhach...">');
kiem(/title="Xem sổ chi tiết công nợ của/.test(srcDash), 'co title goi y bam duoc de lam gi');

console.log('\n=== 8. module.congno.js mo ra dung 1 ham (mot nghiep vu = mot form) ===');
kiem(/return \{ render, getTabs, soChiTietKH \};/.test(srcCN), 'export { render, getTabs, soChiTietKH }');
kiem(!/function soChiTietKHDashboard|function soChiTietKH2/.test(srcCN),
  'KHONG co ban sao thu hai cua so chi tiet');
kiem(!/api\/congno\/congnokh\/chitiet/.test(srcDash),
  'dashboard KHONG tu goi API so chi tiet (phai di qua ModuleCongNo)');
kiem(!/<table[^>]*>[\s\S]{0,400}Còn nợ lũy kế/.test(srcDash),
  'dashboard KHONG tu dung lai bang so cong no');

console.log('\n=== 9. soChiTietKH bat loi 403 (route con chan requireChucNang) ===');
const doanSo = srcCN.slice(srcCN.indexOf('async function soChiTietKH(khach)'),
  srcCN.indexOf('function ngayISO'));
kiem(/try \{[\s\S]*apiGet\('\/api\/congno\/congnokh\/chitiet/.test(doanSo),
  'apiGet nam trong try');
kiem(/catch \(err\) \{[\s\S]{0,200}toast\(/.test(doanSo), 'catch co toast bao loi');
kiem(/requireChucNang\('CONGNO', 'congnokh'\)/.test(fs.readFileSync(B_CN, 'utf8')),
  'route /congnokh/chitiet that su con chan requireChucNang -> nen phai bat loi');

console.log('\n=== 10. Ten khach hai ben KHOP nhau (neu lech thi so mo ra rong) ===');
const srcBCN = fs.readFileSync(B_CN, 'utf8');
const srcBDash = fs.readFileSync(B_DASH, 'utf8');
kiem(/LTRIM\(RTRIM\(TenKhach\)\) = @k/.test(srcBCN),
  'backend congno so sanh LTRIM(RTRIM(TenKhach)) = @k');
kiem(/GROUP BY LTRIM\(RTRIM\(TenKhach\)\)/.test(srcBDash),
  'backend dashboard nhom theo LTRIM(RTRIM(TenKhach)) -> ten tra ve da chuan hoa giong nhau');

console.log('\n=== 11. index.html da bump ?v= (khong thi trinh duyet chay file cu) ===');
kiem(/module\.dashboard\.js\?v=7\.44/.test(srcHtml), 'module.dashboard.js?v=7.44');
/* v7.59: ghim CUNG so ?v= la sai — moi ban sau nay bump so len deu lam test nay do oan (da dinh 3
   lan). Chi can dam bao KHONG TUT lai duoi ban da sua loi nay. */
kiem(parseFloat((srcHtml.match(/module\.congno\.js\?v=([\d.]+)/) || [])[1]) >= 7.44,
  'module.congno.js?v= >= 7.44 (khong tut lai ban cu hon ban sua loi nay)');

console.log(`\n================ KET QUA: ${dat} dat / ${truot} sai ================`);
process.exit(truot ? 1 : 0);
