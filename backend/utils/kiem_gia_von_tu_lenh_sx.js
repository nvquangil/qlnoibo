/* ================================================================================================
   KIEM CHUNG v8.90 — GIA VON HANG TU SAN XUAT TU CAP NHAT
   ------------------------------------------------------------------------------------------------
   Nguyen 2026-10-12: "Bao cao kinh doanh / Gia von hang hoa: khi co gia thanh san pham tu Quan ly
   san xuat se tu cap nhat vao, khong can phai chay 'lay gia thanh tu lenh SX'."
   Chot luat ghi de: "Cap nhat, nhung CHI KHI CUNG LENH SX DO."

   ⚠️ DAY LA TIEN. Gia von vao thang lai gop cua bao cao kinh doanh, va bang GiaVonHangHoa chi giu
   MOT gia moi ma (khong co lich su theo ky) nen moi lan ghi de la doi lai gop ca cac ky da chot.

   BA LOI NANG NHAT, RA CHEO 2026-10-12 BAT DUOC — muc 1/2/3 khoa lai tung cai:
     1. Chi nap cho ma TREN PHIEU, trong khi mau so la cua CA LENH.
        Lenh 1.000 cai: dot 1 nhap ma A 50 cai -> A = tongCP/50 (gap 20 lan). Dot 2 nhap ma B 950
        cai -> B dung gia, con A GIU GIA SAI VINH VIEN vi A khong co tren phieu dot 2.
     2. Huy/xoa phieu cuoi cung KHONG lam giaThanh1SP thanh null — tinhGiaThanh() lui ve luy ke
        cong doan KN roi SL CAT. SL cat thuong lon hon SL nhap kho that => gia von TUT, lai gop
        PHINH. Chi duoc ghi khi mau so den tu phieu nhap kho (gt.donViSLDungTinh === 'Cái').
     3. Bi luat chan ma im lang -> nguoi dung thay "Da luu phieu" va tin rang gia von da dung.

   Chay:  node utils/kiem_gia_von_tu_lenh_sx.js
   ================================================================================================ */
const fs = require('fs');
const path = require('path');
const G = path.join(__dirname, '..');
const doc = (p) => fs.readFileSync(path.join(G, p), 'utf8');

let dat = 0, truot = 0;
const OK = (m) => { dat++; console.log('  OK   ' + m); };
const NO = (m) => { truot++; console.log('  SAI  ' + m); };
const kiem = (dk, m, them) => (dk ? OK(m) : NO(m + (them ? '  -> ' + them : '')));

/* Bo comment truoc moi phep kiem dang "KHONG duoc chua X" — xem
   feedback_qlnoibo_bo_tu_kiem_phai_loc_comment (da vap 3 lan o kiem_ho_so_nhan_su.js). */
const boGhiChu = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const sUtil = doc('utils/giaVonLenhSX.js');
const sNCC = doc('utils/giaNhapHangHoa.js');
const sNhapKho = doc('routes/nhapkho.js');
const sBaoCao = doc('routes/baocao.js');
const sFeBC = doc('../frontend/js/module.baocao.js');
const sIndex = doc('../frontend/index.html');
const sQlsx = doc('routes/qlsx.js');
const maNhapKho = boGhiChu(sNhapKho);
const maUtil = boGhiChu(sUtil);

/* Cat than cua tung route trong nhapkho.js, de kiem TUNG DUONG chu khong dem tong so lan goi.
   Dem tong so la: bo mot loi goi o route XOA roi them mot loi goi thua o route TAO van du so. */
function thanRoute(ten, moc) {
  const i = sNhapKho.indexOf(moc);
  if (i < 0) return '';
  // Den moc cua route ke tiep, hoac het file.
  const sau = ["router.put('/phieu/:id'", "router.put('/phieu/:id/huy'", "router.delete('/phieu/:id'"]
    .map(m => sNhapKho.indexOf(m, i + moc.length)).filter(x => x > 0).sort((a, b) => a - b)[0];
  return sNhapKho.slice(i, sau > 0 ? sau : sNhapKho.length);
}
const ROUTE = {
  'TAO phieu': thanRoute('tao', "router.post('/phieu'"),
  'SUA phieu': thanRoute('sua', "router.put('/phieu/:id'"),
  'HUY phieu': thanRoute('huy', "router.put('/phieu/:id/huy'"),
  'XOA phieu': thanRoute('xoa', "router.delete('/phieu/:id'")
};

console.log('\n=== 1. 🔴 NAP CHO MOI MA CUA CA LENH, khong chi ma tren phieu ===');
kiem(/async function maHangCuaLenh\(pool, donHangId\)/.test(sUtil),
  'co ham maHangCuaLenh() lay moi ma cua lenh');
kiem(/FROM TheKhoHangHoa h WHERE h\.DonHangID = @id/.test(sUtil), 'duong (A): the kho co chon lenh SX');
kiem(/FROM PhieuNhapKhoHangChiTiet ct/.test(sUtil) && /p\.DonHangID = @id/.test(sUtil),
  'duong (B): ma do phieu nhap kho sinh ra');
kiem(/const ids = await maHangCuaLenh\(pool, donHangId\)/.test(sUtil),
  'danh sach ma lay TU LENH, khong phai tham so truyen vao');
/* Cho goi KHONG duoc truyen danh sach ma cua phieu — truyen la quay lai dung loi 1. */
Object.entries(ROUTE).forEach(([ten, than]) => {
  const m = /napGiaVonTuLenhSX\(pool, ([^,]+), ([^,]+),/.exec(boGhiChu(than));
  kiem(!!m, `${ten}: co goi napGiaVonTuLenhSX`);
  if (m) kiem(m[2].trim() === 'null', `${ten}: KHONG truyen danh sach ma cua phieu (truyen null)`,
    'dang truyen: ' + m[2].trim());
});

console.log('\n=== 2. 🔴 CHI ghi khi mau so den tu PHIEU NHAP KHO ===');
kiem(/gt\.donViSLDungTinh !== 'Cái'/.test(sUtil), 'kiem co donViSLDungTinh === "Cái" truoc khi ghi');
/* Co do do chinh tinhGiaThanh() gan, va CHI gan khi mau so den tu phieu nhap kho. */
kiem(/donViSLDungTinh: \(slNhapKho > 0 && nguonNhap\.indexOf\('phiếu'\) >= 0\) \? 'Cái' : null/.test(sQlsx),
  'qlsx.js that su chi gan "Cái" cho nhanh phieu nhap kho');
kiem(/slDungTinh = slNhapKho > 0 \? slNhapKho : slCat/.test(sQlsx),
  'xac nhan tinhGiaThanh() CO lui ve SL cat — ly do phai co co tren');
kiem(/if \(!\(gia > 0\)\)/.test(sUtil), 'gia <= 0 thi dung lai, khong ghi');
kiem(!/GiaVon = 0|GiaVon, 0/.test(maUtil), 'khong co duong nao ghi GiaVon = 0');

console.log('\n=== 3. 🔴 Bi luat chan thi PHAI noi ra ===');
kiem(/chiTietBoQua/.test(sUtil), 'ham tra ve chi tiet tung ma bi bo qua');
kiem(/function loiNhanGiaVon\(kq\)/.test(sUtil), 'co ham dung loi nhan dung chung');
kiem(/KHÔNG cập nhật được/.test(sUtil), 'loi nhan noi ro so ma KHONG cap nhat duoc');
Object.entries(ROUTE).forEach(([ten, than]) => {
  kiem(/loiNhanGiaVon\(/.test(boGhiChu(than)), `${ten}: dung loiNhanGiaVon (khong tu che loi nhan)`);
});

console.log('\n=== 4. Luat ghi de ===');
kiem(/function duocGhi\(cu, maDH\)/.test(sUtil), 'luat ghi de nam trong mot ham rieng, doc duoc');
kiem(/cu\.NguonGia === 'Khai tay'/.test(sUtil), 'KHONG de len gia "Khai tay"');
kiem(/cu\.NguonGia === 'Lệnh SX' && cu\.MaDHNguon && cu\.MaDHNguon !== maDH/.test(sUtil),
  'KHONG de len gia von thuoc LENH SX KHAC');
/* MaDHNguon NULL phai roi vao nhanh GHI: cot NguonGia co DEFAULT N'Lệnh SX' nen mot dong chen bang
   SQL tay ma bo cot do se thanh 'Lệnh SX' + MaDHNguon NULL -> xep vao "lenh khac" la DONG BANG
   vinh vien va im lang. */
kiem(/cu\.MaDHNguon &&/.test(sUtil), 'MaDHNguon NULL van duoc ghi (khong xep vao "lenh khac")');
kiem(/WITH \(HOLDLOCK\)/.test(sUtil), 'MERGE co HOLDLOCK (hai phieu luu dong thoi khong vi pham UNIQUE)');

console.log('\n=== 5. 🔴 Duong NCC KHONG de len gia thanh san xuat ===');
/* Tu v8.90 CA HAI duong deu tu dong. Khong chan thi mot ma vua mua vua tu SX se co gia von nhay
   qua nhay lai giua hai nguon tuy thu tu thao tac — moi lan nhay la doi lai gop ky da chot. */
kiem(/if \(mh\.NguonGia === 'Lệnh SX'\) \{ boQua\+\+; continue; \}/.test(sNCC),
  'giaNhapHangHoa.js bo qua ma dang mang gia von tu Lenh SX');
kiem(/if \(mh\.NguonGia === 'Khai tay'\)/.test(sNCC), 'van giu luat cu: khong de len "Khai tay"');

console.log('\n=== 6. Goi THANG tinhGiaThanh, KHONG qua mapGiaNhap ===');
/* mapGiaNhap() co nhanh "khong co phieu NCC thi doc nguoc GiaVonHangHoa.GiaVon" — dung cho hang tu
   SX la doc lai chinh gia von cu => gia von dung im vinh vien ma khong bao loi gi. */
kiem(/tinhGiaThanh\(pool, order\)/.test(sUtil), 'goi thang tinhGiaThanh()');
kiem(!/mapGiaNhap/.test(maUtil), 'KHONG dung mapGiaNhap()');
kiem(/giaThanh1SP/.test(sUtil), 'lay dung truong giaThanh1SP');
// giaThanh1SP da la gia 1 CAI — tu chia lai la sai hang tram lan.
kiem(!/\/\s*slDungTinh|\/\s*slCai|\/\s*slNhapKho/.test(maUtil), 'KHONG tu chia lai mau so');
const iHam = sUtil.indexOf('async function napGiaVonTuLenhSX');
kiem(iHam > 0 && sUtil.indexOf("require('../routes/qlsx')") > iHam,
  'require qlsx nam TRONG ham (tranh vong phu thuoc luc nap module)');
kiem(/module\.exports\.tinhGiaThanh/.test(sQlsx), 'qlsx.js that su export tinhGiaThanh');

console.log('\n=== 7. Loi nap gia von KHONG duoc lam hong viec luu phieu ===');
/* Phieu da commit xong roi moi nap gia von. Nem loi ra ngoai la nguoi dung thay "luu that bai"
   trong khi phieu DA nam trong CSDL -> ho luu lai lan nua, thanh hai phieu. */
Object.entries(ROUTE).forEach(([ten, than]) => {
  const ma = boGhiChu(than);
  const i = ma.indexOf('napGiaVonTuLenhSX(');
  if (i < 0) { NO(`${ten}: khong thay loi goi de kiem try/catch`); return; }
  // Loi goi phai nam SAU mot "try {" va TRUOC "catch" gan nhat.
  const truoc = ma.slice(0, i), sau = ma.slice(i);
  const coTry = truoc.lastIndexOf('try {') > truoc.lastIndexOf('catch');
  kiem(coTry && /^[\s\S]{0,400}catch \(/.test(sau), `${ten}: loi goi nam trong try/catch rieng`);
  kiem(/await tran\.commit\(\)/.test(truoc), `${ten}: nap gia von chay SAU commit`);
});

console.log('\n=== 8. Phieu SanXuat khong chon lenh thi phai BAO ===');
/* Nhanh SanXuat khong bat buoc chon lenh SX. Khong bao thi phieu luu xong, gia von khong bao gio
   cap nhat, va nut nap hang loat cung khong vot duoc (route do doi DonHangID IS NOT NULL). */
kiem(/không chọn lệnh SX nên KHÔNG cập nhật được giá vốn/.test(sNhapKho),
  'co canh bao khi phieu SanXuat thieu lenh SX');

console.log('\n=== 9. Nut nap tay VAN GIU (du lieu cu + nap lai hang loat) ===');
kiem(/id="gvNap"/.test(sFeBC), 'nut nap hang loat van con');
kiem(/giavon\/naptulenhsx/.test(sBaoCao) && /giavon\/naptulenhsx/.test(sFeBC), 'route nap hang loat van con');
kiem(/Nạp lại hàng loạt/.test(sFeBC), 'nhan nut noi ro la "nap lai hang loat", khong con la cach duy nhat');

console.log('\n=== 10. Man hinh noi THAT ve hau qua so tien ===');
kiem(/tự lấy giá thành của lệnh SX/.test(sFeBC), 'giai thich hang tu SX nay da tu cap nhat');
kiem(/mọi mã hàng của lệnh đó/.test(sFeBC), 'noi ro ca lenh duoc tinh lai, khong chi ma tren phieu');
kiem(/chưa có phiếu nhập kho nào/.test(sFeBC), 'noi ro chua co phieu nhap kho thi chua tinh gia von');
kiem(/lãi gộp của các kỳ đã chốt cũng đổi theo/.test(sFeBC),
  'canh bao ro: cap nhat gia von lam doi lai gop cua ky da chot');

console.log('\n=== 11. Bump ?v= ===');
const v = parseFloat((sIndex.match(/module\.baocao\.js\?v=([\d.]+)/) || [])[1] || '0');
kiem(v >= 8.90, `index.html bump module.baocao.js?v= len >= 8.90 (dang la ${v})`);

console.log('\n======================================================================');
console.log(`KET QUA: ${dat} dat / ${truot} sai`);
if (truot) {
  console.log('');
  console.log('⚠️ Co phep kiem SAI. Gia von vao thang lai gop cua bao cao kinh doanh — doc ky muc 1-3.');
}
console.log('======================================================================');
process.exit(truot ? 1 : 0);
