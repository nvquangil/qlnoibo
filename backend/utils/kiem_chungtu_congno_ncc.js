/* ================================================================================================
   KIEM CHUNG v7.48
     (1) So cong no NCC: MOI loai chung tu sinh ra deu mo duoc chi tiet
     (2) Form xuat kho vai: o "Phieu nhap cua NCC" KHONG con bat buoc
   ------------------------------------------------------------------------------------------------
   (1) Loi nguoi dung bao: bam dong "Nhap kho hang hoa" -> "Loai chung tu khong ho tro xem chi tiet".
   Goc: soChiTietNCC() sinh CtLoai cho 6 loai chung tu, route /chungtu chi xu ly 4. Sinh o mot ben,
   doc o ben kia — hai danh sach khong ai buoc phai khop nhau, nen test nay DOI CHIEU HAI DANH SACH:
   moi CtLoai xuat hien trong so (KH va NCC) phai co nhanh xu ly trong /chungtu. Them loai moi ve sau
   ma quen route la test do.

   (2) Bat chon dung MOT phieu nhap thi mot lan tra gom cay cua 2 phieu phai lap 2 phieu tra — sai
   thuc te. Kiem: co route lay cay theo NCC, bo chon phieu nhap thi QUAY LAI toan bo cay cua NCC
   (khong de trong), va nhan o khong con dau '*' do.

   Chay:  node utils/kiem_chungtu_congno_ncc.js
   ================================================================================================ */
const fs = require('fs');
const path = require('path');

const G = path.join(__dirname, '..');
const doc = (p) => fs.readFileSync(path.join(G, p), 'utf8');

let dat = 0, truot = 0;
const OK = (m) => { dat++; console.log('  OK   ' + m); };
const NO = (m) => { truot++; console.log('  SAI  ' + m); };
const kiem = (dk, m, them) => (dk ? OK(m) : NO(m + (them ? '  -> ' + them : '')));

const sCongNo = doc('routes/congno.js');
const sKhoVai = doc('routes/khovai.js');
const sFeKhoVai = doc('../frontend/js/module.khovai.js');
const sFeCongNo = doc('../frontend/js/module.congno.js');
const sIndex = doc('../frontend/index.html');
/* v8.77: phan DOC chung tu da chuyen tu routes/congno.js sang utils/chungTu.js (dung chung voi
   Bao cao kinh doanh). Moi phep kiem "nhanh xu ly" ben duoi doc tu file nay. */
const sChungTu = doc('utils/chungTu.js');
const sBaoCao = doc('routes/baocao.js');
const sFeBaoCao = doc('../frontend/js/module.baocao.js');

/* ------------------------------------------------------------------------------------------------
   1. DOI CHIEU: CtLoai SINH RA  vs  CtLoai DOC DUOC
   ------------------------------------------------------------------------------------------------ */
console.log('\n=== 1. Moi CtLoai sinh ra trong so cong no deu mo duoc ===');
const sinhRa = [...new Set((sCongNo.match(/N'([A-Z]{2,5})' AS CtLoai/g) || [])
  .map(s => s.match(/N'([A-Z]{2,5})'/)[1]))].sort();
/* Nhanh xu ly: `loai === 'XXX'` trong utils/chungTu.js. */
const khoiCT = sChungTu;
const docDuoc = [...new Set((khoiCT.match(/loai === '([A-Z]{2,5})'/g) || [])
  .map(s => s.match(/'([A-Z]{2,5})'/)[1]))].sort();
console.log('     sinh ra : ' + sinhRa.join(', '));
console.log('     doc duoc: ' + docDuoc.join(', '));
const thieu = sinhRa.filter(x => !docDuoc.includes(x));
kiem(thieu.length === 0, 'KHONG con loai nao sinh ra ma docChungTu() khong doc duoc',
  thieu.length ? 'thieu: ' + thieu.join(', ') : '');
['PNKH', 'PXV', 'PXPK', 'PNL', 'PBH'].forEach(l => kiem(docDuoc.includes(l), `docChungTu xu ly ${l}`));

/* v8.77 — PBH: modal RIENG duoc GIU (co khoi CK NPP / VAT / da thu theo mau Word ma modal chung
   khong co), nhung NGUON du lieu doi sang /api/congno/chungtu. Truoc day no goi thang
   /api/banhang/phieu/:id — route do gate KHOHANG/view nen nguoi CHI co quyen Cong no bam vao la 403.
   Hai phep kiem duoi day chong viec ai do "don dep" nguoc tro lai duong cu. */
kiem(!/apiGet\('\/api\/banhang\/phieu\/'/.test(sFeCongNo),
  'module.congno.js KHONG con goi thang /api/banhang/phieu/:id (gate KHOHANG -> 403)');
kiem(/\/api\/congno\/chungtu\?loai=PBH/.test(sFeCongNo),
  'module.congno.js doc phieu ban hang qua /api/congno/chungtu (gate CONGNO)');
/* Route cu tra `chiTiet`, docChungTu tra `dong` — doc nham khoa thi bang hang TRONG ma khong bao loi. */
const khoiPBH = sFeCongNo.slice(sFeCongNo.indexOf('async function xemPhieuBanHangTuCongNo'));
kiem(/const ct = d\.dong \|\| \[\]/.test(khoiPBH.slice(0, 2000)),
  'doc dong hang tu d.dong (khuon docChungTu), khong phai d.chiTiet cua route cu');
/* Modal do hien GiaBanLe + PhanTramCKShop -> nhanh PBH phai tra DU hai cot do, khong chi khuon chung. */
const nhanhPBH = sChungTu.slice(sChungTu.indexOf("if (loai === 'PBH')"));
['ct.GiaBanLe', 'ct.PhanTramCKShop', 'hh.MaHang', 'hh.TenHang', 'ms.TenMau'].forEach(c =>
  kiem(nhanhPBH.includes(c), `nhanh PBH tra ${c} (man So cong no can cot nay)`));
kiem(/AS DaThu/.test(nhanhPBH), 'nhanh PBH tra DaThu (modal So cong no hien "Da thu")');
kiem(/p\.TongThanhToan AS SoTien/.test(nhanhPBH),
  'nhanh PBH co but danh SoTien = TongThanhToan (khong de modal tu cong SUM dong -> lech CK/VAT)');

/* ------------------------------------------------------------------------------------------------
   1b. v8.77 — DOI CHIEU CHO BAO CAO KINH DOANH (dung lop loi voi muc 1, khac cho sinh)
   ------------------------------------------------------------------------------------------------
   Bao cao sinh CtLoai qua ham ctLoai('XXX'). Ham do nem loi ngay neu ma khong co trong CT_LOAI,
   nhung day la test TINH: bat duoc truoc khi chay, khong cho toi luc nguoi dung bam vao.
   ------------------------------------------------------------------------------------------------ */
console.log('\n=== 1b. Moi CtLoai sinh ra trong BAO CAO deu mo duoc ===');
/* ⚠️ Bat CA dang `ctLoai('PNV')` LAN dang `ctLoai(dk ? 'PNPK' : 'PXPK')` — bat moi chuoi HOA nam
   trong ngoac cua loi goi. Ban dau test nay chi bat dang don gian, nen PNPK/PXPK lot luoi: test
   xanh ma van co the lech. Dung lop loi ma chinh test nay sinh ra de chan. */
const sinhRaBC = [...new Set((sBaoCao.match(/ctLoai\([^)]*\)/g) || [])
  .flatMap(s => (s.match(/'([A-Z]{2,5})'/g) || []).map(x => x.replace(/'/g, ''))))].sort();
console.log('     bao cao sinh ra: ' + sinhRaBC.join(', '));
kiem(sinhRaBC.length > 0, 'baocao.js co sinh CtLoai (neu rong la da go chuoi tay o dau do)');
const thieuBC = sinhRaBC.filter(x => !docDuoc.includes(x));
kiem(thieuBC.length === 0, 'moi CtLoai cua bao cao deu co nhanh trong docChungTu()',
  thieuBC.length ? 'thieu: ' + thieuBC.join(', ') : '');
/* Khai trong CT_LOAI nhung quen viet nhanh doc -> route tra 500 "co trong CT_LOAI nhung chua co nhanh". */
const khaiCT = [...new Set((sChungTu.match(/^\s{2}([A-Z]{2,5}):\s+'/gm) || [])
  .map(s => s.trim().split(':')[0]))].sort();
console.log('     khai trong CT_LOAI: ' + khaiCT.join(', '));
const khaiMaKhongDoc = khaiCT.filter(x => !docDuoc.includes(x));
kiem(khaiMaKhongDoc.length === 0, 'moi ma khai trong CT_LOAI deu co nhanh doc',
  khaiMaKhongDoc.length ? 'khai ma khong co nhanh: ' + khaiMaKhongDoc.join(', ') : '');
kiem(/function ctLoai\(ma\)/.test(sBaoCao) && /CT_LOAI\[ma\]/.test(sBaoCao),
  'baocao.js lay ma qua ctLoai() co kiem tra, khong go chuoi tay');
kiem(!/CtLoai: '[A-Z]{2,5}'/.test(sBaoCao),
  'baocao.js KHONG gan CtLoai bang chuoi tran (phai qua ctLoai())');

console.log('\n=== 1c. v8.77 — hai route /chungtu gate HAI quyen khac nhau ===');
kiem(/router\.get\('\/chungtu', requireAuth, requirePermission\('CONGNO', 'view'\)/.test(sCongNo),
  'congno.js: /chungtu gate CONGNO/view');
kiem(/router\.get\('\/chungtu', requireAuth, requirePermission\('BAOCAO', 'view'\)/.test(sBaoCao),
  'baocao.js: /chungtu gate BAOCAO/view');
kiem(/require\('\.\.\/utils\/chungTu'\)/.test(sCongNo) && /require\('\.\.\/utils\/chungTu'\)/.test(sBaoCao),
  'ca hai route deu goi CHUNG mot ham docChungTu (khong ban sao logic)');
kiem(!/loai === 'PNV'/.test(sCongNo), 'congno.js khong con giu ban sao cac nhanh doc chung tu');

console.log('\n=== 1d. v8.77 — frontend bao cao dung link so phieu ===');
kiem(/function oSoPhieu\(r\)/.test(sFeBaoCao), 'module.baocao.js co oSoPhieu()');
kiem(/!r\.CtLoai \|\| !r\.CtID/.test(sFeBaoCao),
  'dong khong co chung tu (vd "Don khach (du lieu cu)") KHONG dung link');
kiem((sFeBaoCao.match(/<td>\$\{oSoPhieu\(r\)\}<\/td>/g) || []).length === 2,
  'ca HAI popup (ton kho + thu chi) deu dung oSoPhieu — thieu mot la mot ben van la chu thuong');
/* Co dau ';' de KHONG dem ca dong dinh nghia ham `function noiDaySoPhieu(modal) {`. */
kiem((sFeBaoCao.match(/noiDaySoPhieu\(modal\);/g) || []).length === 2,
  'ca HAI popup deu goi noiDaySoPhieu — khong goi thi link co ma bam khong an');
kiem(/\/api\/baocao\/chungtu\?loai=/.test(sFeBaoCao),
  'doc qua /api/baocao/chungtu (gate BAOCAO), KHONG goi thang route cua phan he khac');
['/api/khovai/', '/api/phukien/', '/api/banhang/'].forEach(r =>
  kiem(!sFeBaoCao.includes(r), `module.baocao.js khong goi thang ${r} (se bi 403)`));
/* Sua file JS da deploy ma quen bump ?v= thi trinh duyet chay BAN CU trong cache — "da sua ma van
   loi y het", lop loi da mat thoi gian nhieu lan. */
const vBaoCao = parseFloat((sIndex.match(/module\.baocao\.js\?v=([\d.]+)/) || [])[1] || '0');
kiem(vBaoCao >= 8.77, `index.html da bump module.baocao.js?v= len >= 8.77 (dang la ${vBaoCao})`);
/* module.congno.js CO sua o v8.77 (them NgayXuat/NgayBan vao fallback ngay) -> cung phai bump. */
const vCongNo = parseFloat((sIndex.match(/module\.congno\.js\?v=([\d.]+)/) || [])[1] || '0');
kiem(vCongNo >= 8.77, `index.html da bump module.congno.js?v= len >= 8.77 (dang la ${vCongNo})`);
/* PNL: modal xem chung tu dung chung doc `TenDoiTuong` va `SoTien` — bang PhieuNhapLai khong co 2 cot
   do nen phai dat BUT DANH. Quen la popup mo ra khong ten khach, khong so tien. */
const nhanhPNL = khoiCT.slice(khoiCT.indexOf("if (loai === 'PNL')"), khoiCT.indexOf("if (loai === 'PXV')"));
kiem(/p\.TenKhach AS TenDoiTuong/.test(nhanhPNL), 'PNL: TenKhach -> but danh TenDoiTuong cho modal');
kiem(/p\.TongThanhToan AS SoTien/.test(nhanhPNL), 'PNL: TongThanhToan -> but danh SoTien cho modal');
kiem(/h\.TenDoiTuong \|\| h\.TenNCC/.test(sFeCongNo) && /h\.SoTien != null/.test(sFeCongNo),
  'modal that su doc TenDoiTuong / SoTien (but danh dat dung ten)');

console.log('\n=== 2. PNKH doc dung bang/cot (khong doan ten cot) ===');
const schema = doc('../database/CAI_DAT_DAY_DU.sql');
const bangPNKH = schema.slice(schema.indexOf('CREATE TABLE PhieuNhapKhoHang ('),
  schema.indexOf('IX_PhieuNhapKhoHang_Ngay'));
const bangCT = schema.slice(schema.indexOf('CREATE TABLE PhieuNhapKhoHangChiTiet'),
  schema.indexOf('IX_PhieuNhapKhoHangChiTiet_Phieu'));
kiem(/PhieuNKID/.test(bangPNKH) && /SoPhieu/.test(bangPNKH) && /NgayNhap/.test(bangPNKH),
  'PhieuNhapKhoHang co PhieuNKID / SoPhieu / NgayNhap');
['SoLuong', 'DonVi', 'DonGia', 'ThanhTien', 'MaHangID', 'MauSacID'].forEach(c =>
  kiem(new RegExp('\\b' + c + '\\b').test(bangCT), `PhieuNhapKhoHangChiTiet.${c} co that`));
const nhanhPNKH = khoiCT.slice(khoiCT.indexOf("if (loai === 'PNKH')"), khoiCT.indexOf("if (loai === 'PXV')"));
kiem(/WHERE p\.PhieuNKID = @id/.test(nhanhPNKH), 'lay header theo PhieuNKID');
kiem(/WHERE ct\.PhieuNKID = @id/.test(nhanhPNKH), 'lay dong theo ct.PhieuNKID');
kiem(/hh\.TenHang[\s\S]{0,80}ms\.TenMau/.test(nhanhPNKH), 'ten dong = Ten hang + Mau');
/* Modal xem chung tu doc ngay tu h.NgayThu||h.NgayChi||h.NgayNhap||h.Ngay -> PNKH phai co NgayNhap. */
kiem(/h\.NgayThu \|\| h\.NgayChi \|\| h\.NgayNhap \|\| h\.Ngay/.test(sFeCongNo),
  'modal doc ngay co xet NgayNhap (khop cot cua PNKH)');

console.log('\n=== 3. PXV: do cot truoc khi JOIN (migration v6.66 co the chua chay) ===');
const nhanhPXV = khoiCT.slice(khoiCT.indexOf("if (loai === 'PXV')"));
kiem(/coCot\(pool, 'PhieuXuatVai', 'NCC_ID'\)/.test(nhanhPXV), 'do cot PhieuXuatVai.NCC_ID');
kiem(/coCot\(pool, 'VaiCay', 'DonGiaNhap'\)/.test(nhanhPXV), 'do cot VaiCay.DonGiaNhap');
kiem(/CAST\(NULL AS DECIMAL\(14,2\)\)/.test(nhanhPXV), 'chua co cot gia -> tra NULL, khong sap route');
kiem(/soPhieuDem5\('XKV-', id\)/.test(nhanhPXV),
  'so phieu XKV-##### GIONG chuoi so cong no dang hien');
/* v8.77: nhanh PXV doc CA phieu xuat thuong (mo tu Bao cao ton kho), khong chi phieu tra NCC —
   nen nhan phai doi theo co LaTraNCC, khong duoc cung la "Phieu tra vai NCC". */
kiem(/coCot\(pool, 'PhieuXuatVai', 'LaTraNCC'\)/.test(nhanhPXV), 'PXV: do co LaTraNCC de dat ten');
kiem(/'Phiếu xuất kho vải '/.test(nhanhPXV), 'PXV: phieu xuat thuong goi dung ten');

console.log('\n=== 4. PNPK va PXPK dung CHUNG mot nhanh (khong viet hai ban) ===');
kiem(/if \(loai === 'PNPK' \|\| loai === 'PXPK'\)/.test(khoiCT), 'mot nhanh cho ca hai');
kiem(/laXuat \? 'XPK-' : 'NPK-'/.test(khoiCT), 'tien to so phieu doi theo loai');
kiem(/'Phiếu xuất phụ kiện '/.test(khoiCT), 'PXPK: phieu xuat thuong goi dung ten (khong phai "tra NCC")');
kiem((khoiCT.match(/FROM PhieuPhuKienChiTiet ct/g) || []).length === 1,
  'chi mot cau SQL doc dong phu kien (khong ban sao)');

console.log('\n=== 5. Thong bao loi con lai co NEU RO loai gi ===');
kiem(/Loại chứng từ "\$\{loai \|\| '\(trống\)'\}" không hỗ trợ/.test(khoiCT),
  'thong bao ghi ro CtLoai (truoc chi noi chung, khong biet loai nao)');

/* ------------------------------------------------------------------------------------------------
   6-8. FORM XUAT KHO VAI: phieu nhap KHONG bat buoc
   ------------------------------------------------------------------------------------------------ */
console.log('\n=== 6. Backend: co route lay cay theo NCC (moi phieu nhap) ===');
kiem(/router\.get\('\/ncc\/:nccId\/cay'/.test(sKhoVai), "co GET /khovai/ncc/:nccId/cay");
const routeNccCay = sKhoVai.slice(sKhoVai.indexOf("router.get('/ncc/:nccId/cay'"),
  sKhoVai.indexOf("router.get('/phieunhap/:id/cay'"));
kiem(/JOIN PhieuNhapVai pn ON pn\.PhieuNhapID = vc\.PhieuNhapID/.test(routeNccCay),
  'join qua PhieuNhapVai de biet cay thuoc NCC nao');
kiem(/WHERE pn\.NCC_ID = @ncc/.test(routeNccCay), 'VAN khoanh vung theo NCC (khong mo toan kho)');
kiem(/conHangSQL\('t'\)/.test(routeNccCay),
  'dung conHangSQL dung chung (con KG HOAC con MET — bai hoc v7.36)');
kiem(/SELECT t\.\*, vc\.DonGiaNhap/.test(routeNccCay),
  'tra dung khuon vw_TonCayVai + DonGiaNhap giong route theo phieu nhap');

console.log('\n=== 7. Frontend: bo chon phieu nhap -> QUAY LAI toan bo cay cua NCC ===');
kiem(/const napCayCuaNCC = async \(\) => \{/.test(sFeKhoVai), 'co ham napCayCuaNCC dung chung');
kiem(/if \(!selNhap\.value\) return napCayCuaNCC\(\);/.test(sFeKhoVai),
  'bo chon phieu nhap -> nap lai cay cua NCC (KHONG de danh sach trong)');
kiem(/-- Tất cả phiếu nhập --/.test(sFeKhoVai), 'option dau doi thanh "Tat ca phieu nhap"');
kiem(/\(không bắt buộc\)/.test(sFeKhoVai), 'nhan o ghi ro khong bat buoc');
kiem(!/Phiếu nhập của NCC <span style="color:#c62828;">\*<\/span>/.test(sFeKhoVai),
  'KHONG con dau * do o nhan "Phieu nhap cua NCC"');
kiem(/if \(b && selNcc\.value\) napCayCuaNCC\(\)/.test(sFeKhoVai),
  'tich lai o "Tra NCC" khi da chon NCC -> nap lai cay, khong de trong');
/* `const` khong hoisted: khai napCayCuaNCC SAU doiHien la ReferenceError giua handler. */
kiem(sFeKhoVai.indexOf('const napCayCuaNCC') < sFeKhoVai.indexOf('const doiHien'),
  'napCayCuaNCC khai TRUOC doiHien (const khong hoisted)');
/* NCC van bat buoc — chi phieu nhap la tuy chon. */
kiem(/Đã tích "Trả nhà cung cấp" — hãy chọn nhà cung cấp nhận lại/.test(sFeKhoVai),
  'VAN chan khi thieu NHA CUNG CAP (chi phieu nhap moi la tuy chon)');
kiem(!/xPhieuNhapId'\) \|\| \{\}\)\.value \|\| ''\)\s*return toast/.test(sFeKhoVai),
  'KHONG co doan chan thieu phieu nhap luc submit');

console.log('\n=== 8. Bump ?v= de trinh duyet khong chay file cu ===');
/* Chi kiem "DA bump khoi ban truoc (7.36)", khong ghim dung mot so: ban sau sua tiep file nay se bump
   len 7.49, 7.50... — ghim so la test cu do oan mot thay doi hoan toan dung. */
const vKhoVai = (sIndex.match(/module\.khovai\.js\?v=([\d.]+)/) || [])[1] || '';
kiem(parseFloat(vKhoVai) >= 7.48, 'index.html: module.khovai.js da bump >= 7.48', 'dang la ' + vKhoVai);

console.log(`\n================ KET QUA: ${dat} dat / ${truot} sai ================`);
process.exit(truot ? 1 : 0);
