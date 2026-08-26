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

/* ------------------------------------------------------------------------------------------------
   1. DOI CHIEU: CtLoai SINH RA  vs  CtLoai DOC DUOC
   ------------------------------------------------------------------------------------------------ */
console.log('\n=== 1. Moi CtLoai sinh ra trong so cong no deu mo duoc ===');
const sinhRa = [...new Set((sCongNo.match(/N'([A-Z]{2,5})' AS CtLoai/g) || [])
  .map(s => s.match(/N'([A-Z]{2,5})'/)[1]))].sort();
/* Nhanh xu ly trong route /chungtu: `loai === 'XXX'`. Cat dung khoi route de khong nhat lan cho khac. */
const khoiCT = sCongNo.slice(sCongNo.indexOf("router.get('/chungtu'"),
  sCongNo.indexOf('8. XUAT EXCEL cong no'));
const docDuoc = [...new Set((khoiCT.match(/loai === '([A-Z]{2,5})'/g) || [])
  .map(s => s.match(/'([A-Z]{2,5})'/)[1]))].sort();
console.log('     sinh ra : ' + sinhRa.join(', '));
console.log('     doc duoc: ' + docDuoc.join(', ') + '   (+ PBH co man rieng o frontend)');
/* PBH khong di qua /chungtu: xemChungTu() re sang xemPhieuBanHangTuCongNo() truoc khi goi API. */
kiem(/if \(loai === 'PBH'\) return xemPhieuBanHangTuCongNo/.test(sFeCongNo),
  'PBH duoc re sang man rieng o frontend (nen khong can nhanh trong /chungtu)');
const thieu = sinhRa.filter(x => x !== 'PBH' && !docDuoc.includes(x));
kiem(thieu.length === 0, 'KHONG con loai nao sinh ra ma /chungtu khong doc duoc',
  thieu.length ? 'thieu: ' + thieu.join(', ') : '');
['PNKH', 'PXV', 'PXPK', 'PNL'].forEach(l => kiem(docDuoc.includes(l), `/chungtu xu ly ${l}`));
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
kiem(/'XKV-' \+ String\(id\)\.padStart\(5, '0'\)/.test(nhanhPXV),
  'so phieu XKV-##### GIONG chuoi so cong no dang hien');

console.log('\n=== 4. PNPK va PXPK dung CHUNG mot nhanh (khong viet hai ban) ===');
kiem(/if \(loai === 'PNPK' \|\| loai === 'PXPK'\)/.test(khoiCT), 'mot nhanh cho ca hai');
kiem(/laTra \? 'XPK-' : 'NPK-'/.test(khoiCT), 'tien to so phieu doi theo loai');
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
kiem(/module\.khovai\.js\?v=7\.48/.test(sIndex), 'index.html: module.khovai.js?v=7.48');

console.log(`\n================ KET QUA: ${dat} dat / ${truot} sai ================`);
process.exit(truot ? 1 : 0);
