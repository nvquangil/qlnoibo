/* ================================================================================================
   KIEM CHUNG v8.80 — HO SO NHAN SU: anh / file dinh kem / nguoi phu thuoc
   ------------------------------------------------------------------------------------------------
   Hai thu test nay thuc su canh giu:

   (1) FILE HO SO KHONG DUOC ROI VAO /uploads
       backend/uploads duoc express.static phuc vu KHONG qua dang nhap, VA nam trong whitelist
       duocPhepCongKhai() cua CONG 80 cong khai. Anh vai lo thi khong sao; ban scan CCCD, hop dong
       lao dong, quyet dinh luong thi la du lieu ca nhan. Ho so nhan su phai di duong rieng
       uploads_hr + route co kiem quyen.

   (2) SoNguoiPhuThuoc PHAI DUOC DONG BO
       payroll.js tinh giam tru gia canh bang NhanVien.SoNguoiPhuThuoc, KHONG doc bang NguoiPhuThuoc.
       Quen goi dongBoSoNPT() o bat ky duong ghi nao (them/sua/xoa) la luong tinh theo con so CU —
       khong bao loi, khong ai thay.

   ⚠️ BAI HOC TU v8.77 (da mac): test quet CA FILE bang includes() thi COMMENT cung bi tinh la code.
   Lan do chinh comment "KHONG goi thang /api/khovai/..." lam truot phep kiem "khong goi thang
   /api/khovai/". O day cac phep kiem bat LOI GOI THAT (co dau ngoac + doi so) chu khong bat chuoi.

   Chay:  node utils/kiem_ho_so_nhan_su.js
   ================================================================================================ */
const fs = require('fs');
const path = require('path');

const G = path.join(__dirname, '..');
const doc = (p) => fs.readFileSync(path.join(G, p), 'utf8');

let dat = 0, truot = 0;
const OK = (m) => { dat++; console.log('  OK   ' + m); };
const NO = (m) => { truot++; console.log('  SAI  ' + m); };
const kiem = (dk, m, them) => (dk ? OK(m) : NO(m + (them ? '  -> ' + them : '')));

const sHrm = doc('routes/hrm.js');
const sServer = doc('server.js');
const sPayroll = doc('routes/payroll.js');
const sFe = doc('../frontend/js/module.hrm.js');
const sIndex = doc('../frontend/index.html');
const sMig = doc('../database/migration_v876.sql');

/* ------------------------------------------------------------------------------------------------
   1. 🔴 FILE HO SO NAM NGOAI /uploads VA CO CUA CO KHOA
   ------------------------------------------------------------------------------------------------ */
console.log('\n=== 1. File ho so nhan su khong lot ra cong khai ===');
kiem(/uploads_hr/.test(sHrm), 'hrm.js dung thu muc rieng uploads_hr');
kiem(/THU_MUC_HR = path\.join\(__dirname, '\.\.', 'uploads_hr'\)/.test(sHrm),
  'THU_MUC_HR tro dung backend/uploads_hr');
/* Khong duoc co express.static nao tro vao uploads_hr — chi mot dong la thanh cong khai nhu /uploads. */
kiem(!/express\.static\([^)]*uploads_hr/.test(sServer),
  'server.js KHONG co express.static nao tro vao uploads_hr');
/* Va khong duoc them vao whitelist cong 80. */
const khoiCongKhai = sServer.slice(sServer.indexOf('function duocPhepCongKhai'),
  sServer.indexOf('function duocPhepCongKhai') + 1500);
kiem(!/uploads_hr/.test(khoiCongKhai),
  'uploads_hr KHONG nam trong duocPhepCongKhai() (cong 80)');
/* Cua duy nhat: route co requirePermission HRM. */
kiem(/router\.get\('\/file\/:tenLuu', requireAuth, requirePermission\('HRM', 'view'\)/.test(sHrm),
  'GET /api/hrm/file/:tenLuu gate requireAuth + HRM/view');
kiem(/router\.post\('\/upload', requireAuth, requirePermission\('HRM', 'edit'\)/.test(sHrm),
  'POST /api/hrm/upload gate requireAuth + HRM/edit');

/* 🔴 LOI THAT DA MAC o ban dau v8.80: .gitignore chi loai `uploads/*`, KHONG loai `uploads_hr/`.
   Ho so nhan su se bi commit THANG vao git. Lo mot lan la no nam trong LICH SU git vinh vien —
   xoa file o commit sau khong go duoc, phai viet lai lich su. */
const sGitIgnore = doc('.gitignore');
kiem(/^uploads_hr\/\*$/m.test(sGitIgnore),
  '.gitignore co loai uploads_hr/* (file ho so KHONG duoc vao git)');
kiem(/^!uploads_hr\/\.gitkeep$/m.test(sGitIgnore),
  '.gitignore giu lai uploads_hr/.gitkeep (de thu muc ton tai sau khi clone)');
kiem(fs.existsSync(path.join(G, 'uploads_hr', '.gitkeep')),
  'co file uploads_hr/.gitkeep');

console.log('\n=== 1b. Chong path traversal + loc duoi file ===');
kiem(/function duongDanHRAnToan/.test(sHrm), 'co ham duongDanHRAnToan()');
kiem(/path\.basename\(String\(tenLuu/.test(sHrm), 'dung path.basename (chan ../..)');
kiem(/if \(!duong\.startsWith\(THU_MUC_HR\)\) return null/.test(sHrm),
  'kiem file van nam trong thu muc goc sau khi ghep');
kiem(/DUOI_CHO_PHEP/.test(sHrm) && /'\.pdf'/.test(sHrm), 'co whitelist duoi file');
/* .html / .svg chay duoc script trong trinh duyet nguoi xem -> tuyet doi khong cho. */
const khoiDuoi = sHrm.slice(sHrm.indexOf('const DUOI_CHO_PHEP'), sHrm.indexOf('const KIEU_NOI_DUNG'));
['.html', '.htm', '.svg', '.js'].forEach(d =>
  kiem(!khoiDuoi.includes(`'${d}'`), `KHONG cho phep ${d} (chay duoc script o trinh duyet)`));

console.log('\n=== 1c. Frontend KHONG day ho so qua duong /uploads ===');
/* ⚠️ Bat LOI GOI THAT: `uploadFile(` co doi so. Comment viet "uploadFile() cua common.js" (ngoac
   rong) nen khong dinh — chinh la cai bay da lam truot test o v8.77. */
kiem(!/uploadFile\(\s*[a-zA-Z]/.test(sFe),
  'module.hrm.js KHONG goi uploadFile() cua common.js (ham do day vao /uploads cong khai)');
kiem(/async function uploadHoSo\(file\)/.test(sFe), 'co ham rieng uploadHoSo()');
kiem(/fetch\('\/api\/hrm\/upload'/.test(sFe), 'uploadHoSo day len /api/hrm/upload');
/* Khong duoc dung duong dan /uploads trong thuoc tinh src/href nao. */
kiem(!/(src|href)="\/uploads/.test(sFe),
  'khong co src/href nao tro thang vao /uploads');
kiem(/const urlXemHR = /.test(sFe) && /const urlTaiHR = /.test(sFe),
  'xem/tai file deu qua /api/hrm/file (co kiem quyen)');

/* ------------------------------------------------------------------------------------------------
   2. 🔴 SoNguoiPhuThuoc — MOI DUONG GHI DEU PHAI DONG BO
   ------------------------------------------------------------------------------------------------ */
console.log('\n=== 2. So nguoi phu thuoc luon khop so dong (payroll.js dung con so nay) ===');
kiem(/async function dongBoSoNPT\(pool, nhanVienId\)/.test(sHrm), 'co ham dongBoSoNPT()');
kiem(/SET SoNguoiPhuThuoc = \(SELECT COUNT\(\*\) FROM NguoiPhuThuoc WHERE NhanVienID = @id\)/.test(sHrm),
  'dongBoSoNPT dem dung tu bang NguoiPhuThuoc');
/* Ba duong ghi: POST (them), PUT (sua), DELETE (xoa) — ca ba phai goi. */
const duongGhi = [
  ["router.post('/nhanvien/:id/nguoiphuthuoc'", 'them'],
  ["router.put('/nguoiphuthuoc/:id'", 'sua'],
  ["router.delete('/nguoiphuthuoc/:id'", 'xoa']
];
duongGhi.forEach(([moc, ten]) => {
  const i = sHrm.indexOf(moc);
  const khoi = i < 0 ? '' : sHrm.slice(i, i + 1600);
  kiem(i >= 0 && /dongBoSoNPT\(pool,/.test(khoi), `duong ${ten} co goi dongBoSoNPT()`);
});
/* Nhanh XOA phai lay NhanVienID TRUOC khi xoa — xoa roi thi khong con dong nao de biet dong bo cho ai. */
const khoiXoa = sHrm.slice(sHrm.indexOf("router.delete('/nguoiphuthuoc/:id'"),
  sHrm.indexOf("router.delete('/nguoiphuthuoc/:id'") + 1200);
kiem(khoiXoa.indexOf('SELECT NhanVienID') < khoiXoa.indexOf('DELETE FROM NguoiPhuThuoc'),
  'duong xoa lay NhanVienID TRUOC khi DELETE');

console.log('\n=== 2b. payroll.js KHONG bi sua (ky luong da chot khong duoc doi) ===');
kiem(/giamTruNPT = \(Number\(cfg\.GiamTruNPT\) \|\| 0\) \* \(Number\(e\.SoNguoiPhuThuoc\) \|\| 0\)/.test(sPayroll),
  'payroll.js van tinh theo NhanVien.SoNguoiPhuThuoc nhu cu');
kiem(!/FROM NguoiPhuThuoc/.test(sPayroll),
  'payroll.js KHONG doc bang NguoiPhuThuoc (doc se hoi to vao ky luong da chot)');

/* ------------------------------------------------------------------------------------------------
   3. AnhDaiDien — CSDL chua chay migration van phai chay duoc
   ------------------------------------------------------------------------------------------------ */
console.log('\n=== 3. Anh dai dien: do cot truoc, khong vo man them/sua nhan vien ===');
kiem(/async function coCotAnhDaiDien\(pool\)/.test(sHrm), 'co ham do cot coCotAnhDaiDien()');
kiem(!/\.input\('AnhDaiDien'[\s\S]{0,40}\n/.test(sHrm.slice(sHrm.indexOf('function bindNhanVien'),
  sHrm.indexOf('let __coCotAnh'))),
  'AnhDaiDien KHONG nam trong bindNhanVien (gop vao se vo ca them lan sua khi chua migration)');
kiem((sHrm.match(/coAnh \? ', AnhDaiDien' : ''/g) || []).length >= 1, 'INSERT them cot theo ket qua do');
kiem(/GhiDeAnh = 1 THEN @AnhDaiDien ELSE AnhDaiDien END/.test(sHrm),
  'UPDATE theo luat "client khong gui thi GIU NGUYEN" (man Danh muc > Nhan vien khong gui anh)');

/* ------------------------------------------------------------------------------------------------
   4. MIGRATION
   ------------------------------------------------------------------------------------------------ */
console.log('\n=== 4. migration_v876 chay lai duoc, khong dung du lieu cu ===');
kiem(/IF COL_LENGTH\('NhanVien', 'AnhDaiDien'\) IS NULL/.test(sMig), 'them cot co guard');
kiem(/IF OBJECT_ID\('HoSoDinhKemNhanVien'\) IS NULL/.test(sMig), 'tao bang dinh kem co guard');
kiem(/IF OBJECT_ID\('NguoiPhuThuoc'\) IS NULL/.test(sMig), 'tao bang NPT co guard');
/* 🔴 LOI THAT DA MAC: ban dau file nay INSERT vao ChucNang voi ten cot `ChucNangCode` — cot that la
   `MaChucNang` (xem CREATE TABLE ChucNang trong CAI_DAT_DAY_DU.sql). Migration chay toi do thi do
   ngay tren man hinh (Msg 207 Invalid column name), 3 buoc truoc do da chay roi.
   Hai phep kiem duoi chan ca hai mat: khong duoc go sai ten cot, va neu co INSERT that thi phai
   dung khuon MERGE cua repo. */
const sSchema = doc('../database/CAI_DAT_DAY_DU.sql');
const khoiChucNang = sSchema.slice(sSchema.indexOf('CREATE TABLE ChucNang ('),
  sSchema.indexOf('CREATE TABLE ChucNang (') + 600);
kiem(/MaChucNang NVARCHAR/.test(khoiChucNang), 'xac nhan cot that cua ChucNang la MaChucNang');

/* ⚠️ PHAI BO COMMENT TRUOC KHI KIEM. Lan thu BA vap bay nay trong cung mot file:
     v8.77 — comment chua '/api/khovai/' lam phep kiem bao sai;
     v8.85 — comment "CO Y khong gate requireChucNang" lam phep kiem bao sai;
     v8.86 — migration_v876 muc 4 giai thich "cot that la MaChucNang, khong phai ChucNangCode",
             chinh chu do lam phep kiem nay bao sai (2026-10-10, Nguyen chay ra 1 dong SAI).
   Quy tac: moi phep kiem dang "file KHONG duoc chua chuoi X" deu phai loc comment truoc. */
const boCommentSql = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*--.*$/gm, '');
const sMigCode = boCommentSql(sMig);
kiem(!/ChucNangCode/.test(sMigCode),
  'migration KHONG dung ten cot bia "ChucNangCode" (cot that: MaChucNang)');
kiem(!/INSERT INTO ChucNang/.test(sMigCode) || /MERGE ChucNang AS t/.test(sMigCode),
  'neu co ghi ChucNang thi phai dung khuon MERGE ... WHEN NOT MATCHED cua repo');
kiem(/IF DB_NAME\(\) <> N'QLNoiBo'/.test(sMig), 'co guard dung database');
kiem(!/UPDATE NhanVien SET/.test(sMigCode), 'migration KHONG dung den du lieu nhan vien da co');
kiem(!/DROP TABLE|DELETE FROM/.test(sMigCode), 'migration KHONG xoa gi');
/* Bang dinh kem phai giu TEN GOC rieng voi TEN TREN DIA. */
kiem(/TenFile      NVARCHAR\(255\) NOT NULL/.test(sMig) && /TenLuu       NVARCHAR\(255\) NOT NULL/.test(sMig),
  'tach TenFile (ten goc nguoi dung thay) va TenLuu (ten that tren dia)');

/* ------------------------------------------------------------------------------------------------
   5. 4 FORM VAN BAN — noi not duong ong FileDinhKem co tu v6.00
   ------------------------------------------------------------------------------------------------ */
console.log('\n=== 5. Hop dong / Phu luc / Quyet dinh / Thanh ly deu gan duoc file ===');
kiem((sFe.match(/oFileVanBanHtml\(/g) || []).length >= 5,
  'oFileVanBanHtml dung o ca 4 form (1 dinh nghia + 4 lan dung)');
kiem((sFe.match(/wireOFileVanBan\(modal\);/g) || []).length === 4,
  'ca 4 form deu goi wireOFileVanBan (khong goi thi o co ma chon file khong an)');
kiem((sFe.match(/fileDinhKem: val\(modal, 'f_file'\)/g) || []).length === 4,
  'ca 4 payload deu gui fileDinhKem (cot da co tu v6.00 nhung frontend chua bao gio gui)');

/* ------------------------------------------------------------------------------------------------
   6. v8.82 — MAU IN THEO DUNG MAU CUA CONG TY
   ------------------------------------------------------------------------------------------------ */
console.log('\n=== 6. Mau in hop dong / quyet dinh theo mau cong ty ===');
const sMig877 = doc('../database/migration_v877.sql');
/* 10 cot moi: thieu mot cai thi mot cho "..." trong mau in khong bao gio dien duoc. */
[['NhanVien', 'QuocTich'], ['HopDongLaoDong', 'NgayKy'], ['HopDongLaoDong', 'QuanLyTrucTiep'],
 ['HopDongLaoDong', 'PhuCapChuyenCan'], ['HopDongLaoDong', 'PhuCapChucVu'], ['HopDongLaoDong', 'QuyKPI'],
 ['HopDongLaoDong', 'SoCongXangXe'], ['HopDongLaoDong', 'SoCongAnTrua'], ['HopDongLaoDong', 'TyLeThuViec'],
 ['QuyetDinhNhanSu', 'NgayKy']
].forEach(([bang, cot]) =>
  kiem(new RegExp(`IF COL_LENGTH\\('${bang}', '${cot}'\\) IS NULL`).test(sMig877),
    `migration_v877 them ${bang}.${cot} (co guard)`));
kiem(!/UPDATE NhanVien SET|UPDATE HopDongLaoDong SET|UPDATE QuyetDinhNhanSu SET/.test(
  sMig877.replace(/^--.*$/gm, '')),
  'migration_v877 KHONG tu sua du lieu cu (cac cau UPDATE goi y deu bi chu thich)');
// ⚠️ Loi da suyt mac khi viet migration_v877: dat mot cap dau DONG comment ngay BEN TRONG mot khoi
// comment thi khoi do bi dong som, phan con lai thanh SQL that va chay nham. Muc 5 cua file do chua
// cac cau SQL mau nen phai dung dong comment '--', khong dung khoi.
// (Chinh comment nay cung phai viet bang '--' / '//' vi ly do do.)
kiem(!/\/\*[^*]*\*\/[^*]*\*\//.test(sMig877), 'migration_v877 khong co khoi comment long nhau');

console.log('\n=== 6b. Chon dung mau theo loai ===');
kiem(/const laThuViec = String\(h\.LoaiHopDong \|\| ''\) === 'Thử việc'/.test(sFe),
  'HD: Thu viec -> mau thu viec, con lai -> mau chinh thuc');
kiem(/MAU_GOC\.HDLD_CHINHTHUC|HDLD_CHINHTHUC: \{/.test(sFe) && /HDLD_THUVIEC: \{/.test(sFe),
  'co du 2 mau hop dong trong MAU_GOC');
kiem(/const laTangLuong = String\(q\.LoaiQuyetDinh \|\| ''\) === 'Tăng lương'/.test(sFe),
  'QD: Tang luong -> mau cong ty; 4 loai con lai giu khuon chung');
kiem(/QD_TANGLUONG: \{/.test(sFe) && /QD_CHUNG: \{/.test(sFe),
  'giu CA HAI khuon quyet dinh (chua ep 4 loai kia vao mau tang luong)');
kiem(/giamDoc: 'NGUYỄN VĂN QUÂN'/.test(sFe), 'COMPANY.giamDoc da dien (truoc day de rong)');

console.log('\n=== 6c. Thieu du lieu thi in dau cham, KHONG in "0 dong" ===');
/* Hop dong la van ban phap ly: mot o "0 dong" in nham con te hon mot o de trong. */
kiem(/const chTien = \(v\) => \(v == null \|\| v === '' \|\| Number\(v\) === 0 \? '\.{10,}' : money\(v\)\)/.test(sFe),
  'chTien(): tien rong/0 -> in dau cham de dien tay');
kiem(/const chNgay = \(d\) => \(d \? dmy\(d\) : /.test(sFe), 'chNgay(): ngay rong -> in o trong');
kiem(/docSoTienBangChu\(h\.LuongCoBan\)/.test(sFe), 'muc 3.1 in "Bang chu" cua luong co ban');

console.log('\n=== 6d. payroll.js VAN khong doc cac phu cap moi ===');
/* Cac khoan nay CHI de in hop dong. Doc chung trong payroll la doi luong ky da chot. */
['PhuCapChuyenCan', 'PhuCapChucVu', 'QuyKPI'].forEach(c =>
  kiem(!new RegExp(c).test(sPayroll), `payroll.js KHONG doc ${c} (chi de in hop dong)`));

/* ------------------------------------------------------------------------------------------------
   6e. 🔴 /refs PHAI TRA DU THONG TIN NHAN VIEN — ban in doc tu day
   ------------------------------------------------------------------------------------------------
   printHopDong() / mauQuyetDinhTangLuong() tra refs.nhanVien.find(...) roi doc nv.NgaySinh,
   nv.SoCCCD, nv.DiaChi, nv.TenBoPhan... Neu /refs chi tra 3 cot (ban truoc v8.83) thi cac truong do
   la `undefined` -> HOP DONG IN RA MAT SACH THONG TIN BEN B, chi con dau cham, ma KHONG bao loi gi.
   ------------------------------------------------------------------------------------------------ */
console.log('\n=== 6e. /refs tra du cot cho ban in ===');
const khoiRefs = sHrm.slice(sHrm.indexOf("router.get('/refs'"),
  sHrm.indexOf("router.get('/refs'") + 2200);
['NgaySinh', 'SoCCCD', 'NgayCapCCCD', 'NoiCapCCCD', 'DiaChi', 'ChucVu', 'SDT'].forEach(c =>
  kiem(new RegExp(`nv\\.${c}`).test(khoiRefs), `/refs tra nv.${c} (ban in hop dong can)`));
kiem(/LEFT JOIN BoPhan bp/.test(khoiRefs) && /bp\.TenBoPhan/.test(khoiRefs),
  '/refs JOIN BoPhan de co TenBoPhan (dong "Bo phan/chuc vu" cua quyet dinh)');
kiem(/coCotQuocTich\(pool\)/.test(khoiRefs), '/refs do cot QuocTich truoc khi SELECT');

console.log('\n=== 6f. Ban in van ban: bo letterhead mac dinh + bo danh so trang ===');
/* printHtml() mac dinh chen letterhead cua rieng no -> hop dong/quyet dinh da co khoi tieu de
   hanh chinh rieng se bi HAI tieu de. Va co che danh so trang cat theo chieu cao lam wrapA4()
   (mot <div> duy nhat) bi day nguyen khoi -> TRANG TRANG o dau. */
kiem(/const IN_VAN_BAN = \{ noLetterhead: true, khongSoTrang: true \}/.test(sFe),
  'co hang IN_VAN_BAN dung chung');
// v8.85: moi ban in di qua inVanBan() -> chi can mot cho truyen IN_VAN_BAN la ca 6 mau dung chung.
kiem(/printHtml\(tieuDeFile, wrapA4\(thayBien\(mau, bien\)\), IN_VAN_BAN\)/.test(sFe),
  'inVanBan() truyen IN_VAN_BAN cho moi mau');

console.log('\n=== 6g. v8.84 — tu sinh so quyet dinh theo STT CHUNG ===');
kiem(/async function sinhSoQuyetDinh\(pool, loaiQuyetDinh\)/.test(sHrm), 'co ham sinhSoQuyetDinh()');
kiem(/const HAU_TO_QD = \{/.test(sHrm), 'co bang hau to theo loai quyet dinh');
['QĐTL', 'QĐKT', 'QĐKL', 'QĐBN', 'QĐĐC'].forEach(h =>
  kiem(sHrm.includes(`'${h}'`), `co hau to ${h}`));
/* "STT CHUNG": dem theo phan /<nam>/ o giua -> khop MOI hau to. Neu dem theo tung hau to thi
   tang luong 04 ma khen thuong lai ra 01 — khong con la so thu tu chung. */
kiem(/`%\/\$\{nam\}\/%`/.test(sHrm), 'dem theo /<nam>/ (chung moi loai), khong dem rieng tung hau to');
kiem(/nn\(b\.soQuyetDinh\) \|\| await sinhSoQuyetDinh/.test(sHrm),
  'chi sinh khi nguoi dung de trong (go so rieng thi ton trong)');
/* Sua quyet dinh KHONG duoc sinh lai so: so da cap va phat hanh thi khong tu doi. */
const khoiPutQD = sHrm.slice(sHrm.indexOf("router.put('/quyetdinh/:id'"),
  sHrm.indexOf("router.put('/quyetdinh/:id'") + 1500);
kiem(!/sinhSoQuyetDinh/.test(khoiPutQD), 'duong SUA khong sinh lai so quyet dinh');
/* Mau in phai in NGUYEN SoQuyetDinh — ghep them hau to la lap "04/2026/QĐTL/QĐTL". */
kiem(!/SoQuyetDinh, 6\) \+ '\/QĐTL'/.test(sFe),
  'mau in KHONG con ghep them "/QĐTL" vao so quyet dinh');

/* ------------------------------------------------------------------------------------------------
   7. v8.85 — SUA MAU VAN BAN
   ------------------------------------------------------------------------------------------------ */
const sMig878 = doc('../database/migration_v878.sql');
const MA_MAU = ['HDLD_CHINHTHUC', 'HDLD_THUVIEC', 'QD_TANGLUONG', 'QD_CHUNG', 'PHULUC', 'THANHLY'];

console.log('\n=== 7a. Mau goc nam MOT CHO duy nhat (code), CSDL chi giu ban da sua ===');
kiem(/const MAU_GOC = \{/.test(sFe), 'co hang MAU_GOC trong module.hrm.js');
MA_MAU.forEach(m => kiem(new RegExp(`${m}: \\{`).test(sFe), `MAU_GOC co mau ${m}`));
// Seed noi dung vao CSDL = co hai ban goc; sua ben nay ben kia khong doi theo.
const sMig878Code = boCommentSql(sMig878);   // loc comment — xem ghi chu o muc 4
kiem(!/INSERT INTO MauVanBanHRM\b/.test(sMig878Code),
  'migration_v878 KHONG seed noi dung mau (ban goc chi nam trong code)');
kiem(/IF OBJECT_ID\('MauVanBanHRM'\) IS NULL/.test(sMig878), 'tao bang MauVanBanHRM co guard');
kiem(/IF OBJECT_ID\('MauVanBanHRM_LichSu'\) IS NULL/.test(sMig878), 'tao bang lich su co guard');
kiem(!/DROP TABLE|UPDATE HopDongLaoDong|UPDATE QuyetDinhNhanSu/.test(sMig878Code),
  'migration_v878 KHONG dung den du lieu cu');
kiem(!/\/\*[^*]*\*\/[^*]*\*\//.test(sMig878), 'migration_v878 khong co khoi comment long nhau');

console.log('\n=== 7b. CSDL chua chay migration van in duoc (luoi an toan) ===');
kiem(/return \(sua && String\(sua\)\.trim\(\)\) \? sua : \(MAU_GOC\[maMau\] \? MAU_GOC\[maMau\]\.than : ''\)/.test(sFe),
  'layMau(): co ban sua thi dung, khong thi roi ve mau goc trong code');
const khoiNap = sFe.slice(sFe.indexOf('async function napMauDaSua()'),
  sFe.indexOf('async function napMauDaSua()') + 500);
kiem(/catch \(e\) \{/.test(khoiNap) && !/throw/.test(khoiNap),
  'napMauDaSua(): loi mang hoac CSDL KHONG chan viec in (nuot loi, dung mau goc)');
kiem(/if \(!await coBangMau\(pool\)\) return res\.json\(\{ success: true, data: \[\], chuaCaiDat: true \}\)/.test(sHrm),
  'GET /mauvanban: chua co bang thi tra rong + co co chuaCaiDat, khong 500');

console.log('\n=== 7c. Noi dung nguoi dung nhap duoc LOC truoc khi luu ===');
/* Day la cho DUY NHAT trong he thong nguoi dung nhap HTML roi he thong dem hien thi nguyen trang. */
kiem(/function locMauAnToan\(html\)/.test(sHrm), 'co ham locMauAnToan()');
/* 🔴 PHAI la DANH SACH TRANG. Ban dau lam danh sach den va thung 2 cho (ra cheo 2026-10-10):
     <img src=x/onerror=...>   -> <img> khong trong danh sach cam, va regex go on* doi ky tu dung
                                  truoc la \s, trong khi trinh duyet chap nhan dau "/".
     <a href=javascript:...>   -> regex chan javascript: doi phai co dau nhay.
   Danh sach den phai doan het moi cach viet; danh sach trang chi can biet minh CAN gi. */
/* 🔴 LO XSS THU HAI (ra cheo 2026-10-10, ban vay dau): regex boc the DOI phai co dau ">", nen mot
   the mo KHONG DONG o cuoi noi dung lot nguyen van. Luc in, wrapA4() noi them "</div>" phia sau va
   trinh duyet muon luon dau ">" do de dong the ⇒ <img src=x onerror=...> CHAY.
   Cach bit: khong va chuoi tai cho ma DUNG LAI chuoi ra, moi doan khong phai the hop le deu thanh chu. */
kiem(/return ra \+ thoat\(s\.slice\(i\)\)/.test(sHrm),
  'phan duoi (the cut o cuoi) duoc thoat thanh chu, khong lot nguyen van');
kiem(/const thoat = \(x\) => x\.replace\(\/<\/g, '&lt;'\)/.test(sHrm), 'co ham thoat() bien < > thanh chu');
kiem(/function boKyTuDieuKhien/.test(sHrm) && /charCodeAt\(0\) > 31/.test(sHrm),
  'bo ky tu dieu khien truoc khi loc (java<TAB>script: van chay)');
// Hai khoi __CU_ la xac ban cu, BEN TRONG comment, con sot ky tu dieu khien vo hinh. Xoa tay.
if (/function __CU_/.test(sHrm)) console.log('  (!)  hrm.js con khoi __CU_* trong comment — nen xoa tay, xem huong dan deploy');
kiem(/const THE_CHO_PHEP = new Set\(/.test(sHrm), 'loc theo DANH SACH TRANG the (khong phai danh sach den)');
kiem(/const THUOC_TINH_CHO_PHEP = new Set\(/.test(sHrm), 'loc theo danh sach trang THUOC TINH');
kiem(/if \(THE_CHO_PHEP\.has\(t\)\) \{/.test(sHrm), 'chi viet lai the NAM TRONG danh sach trang');
kiem(/if \(!THUOC_TINH_CHO_PHEP\.has\(ten\)\) continue/.test(sHrm),
  'thuoc tinh ngoai danh sach bi go (on*, href, src deu roi vao day)');
['script', 'style', 'iframe', 'object', 'embed'].forEach(t =>
  kiem(new RegExp(`\\b${t}\\b`).test(sHrm.slice(sHrm.indexOf('function locMauAnToan'),
    sHrm.indexOf('function locMauAnToan') + 900)), `locMauAnToan xoa ca THAN cua <${t}>`));
['script', 'a', 'img', 'form', 'input', 'svg', 'link', 'meta', 'base'].forEach(t =>
  kiem(!sHrm.slice(sHrm.indexOf('const THE_CHO_PHEP'), sHrm.indexOf('const THUOC_TINH_CHO_PHEP'))
    .includes(`'${t}'`), `danh sach the cho phep KHONG co <${t}>`));
['onclick', 'onerror', 'href', 'src', 'srcset', 'formaction'].forEach(a =>
  kiem(!sHrm.slice(sHrm.indexOf('const THUOC_TINH_CHO_PHEP'), sHrm.indexOf('function locThuocTinh'))
    .includes(`'${a}'`), `danh sach thuoc tinh cho phep KHONG co ${a}`));
// style van chay duoc ma qua url(javascript:) / expression() tren trinh duyet cu.
const khoiLocTT = sHrm.slice(sHrm.indexOf('function locThuocTinh'), sHrm.indexOf('function locMauAnToan'));
['javascript:', 'expression\\(', 'url\\(', 'position:(fixed|absolute)'].forEach(x =>
  kiem(khoiLocTT.includes(x), `gia tri thuoc tinh bi loc "${x}"`));
// Phai giai ma thuc the TRUOC khi kiem: "&#106;avascript:" so chuoi tho la truot.
kiem(/giaiMaDeKiem\(gia\)/.test(khoiLocTT), 'gia tri duoc giai ma thuc the truoc khi kiem');
kiem(/const noiDung = locMauAnToan\(\(req\.body \|\| \{\}\)\.noiDung\)/.test(sHrm),
  'duong LUU goi locMauAnToan (loc o backend, khong tin frontend)');
kiem((sHrm.match(/MA_MAU_HOP_LE\.includes\(maMau\)/g) || []).length >= 2,
  'ca duong LUU va duong XOA deu chi nhan 6 ma mau trong danh sach trang');

console.log('\n=== 7d. Sua hong van lay lai duoc ===');
kiem(/INSERT INTO MauVanBanHRM_LichSu/.test(sHrm), 'ban cu duoc day vao lich su truoc khi ghi de');
const khoiXoaMau = sHrm.slice(sHrm.indexOf("router.delete('/mauvanban/:maMau'"),
  sHrm.indexOf("router.delete('/mauvanban/:maMau'") + 1400);
kiem(/INSERT INTO MauVanBanHRM_LichSu/.test(khoiXoaMau),
  'nut "Mau goc" cung day ban dang dung vao lich su truoc khi xoa');
kiem(/const GIU_LICH_SU = \d+/.test(sHrm), 'co han muc so ban lich su giu lai');
kiem(/DELETE FROM MauVanBanHRM_LichSu WHERE MaMau = @m AND LichSuID NOT IN/.test(sHrm),
  'don ban cu vuot han muc (khong don thi bang phinh theo so lan sua)');

console.log('\n=== 7e. Tab moi phai co dong ChucNang (bai hoc v8.70) ===');
kiem(/\{ key: 'mauvanban', label: 'Mẫu văn bản' \}/.test(sFe), 'TABS co tab mauvanban');
kiem(/if \(activeTab === 'mauvanban'\) return renderMauVanBan\(\)/.test(sFe),
  'render() co nhanh cho tab moi (thieu la bam vao tab trang tron)');
kiem(/MaChucNang = N'mauvanban'/.test(sMig878) && /ModuleCode = N'HRM'/.test(sMig878),
  'migration_v878 dang ky ChucNang HRM/mauvanban');
kiem(!/ChucNangCode/.test(sMig878Code), 'migration_v878 dung ten cot that MaChucNang');
/* GET /mauvanban KHONG duoc gate theo chuc nang: moi ban in deu goi no de lay mau. */
/* ⚠️ Phai BO COMMENT truoc khi kiem: ngay duoi dong router.get do co mot comment giai thich
   "CO Y khong gate requireChucNang" — chinh chu requireChucNang trong comment lam phep kiem bao sai.
   Day la lan thu hai vap bay nay (lan dau: v8.77, comment chua '/api/khovai/'). */
const khoiGetMau = sHrm.slice(sHrm.indexOf("router.get('/mauvanban',"),
  sHrm.indexOf("router.get('/mauvanban',") + 600).replace(/\/\/[^\n]*/g, '');
kiem(!/requireChucNang\s*\(/.test(khoiGetMau),
  'GET /mauvanban KHONG gate chuc nang (chan la ai khong vao tab cung khong in duoc hop dong)');
kiem(/router\.put\('\/mauvanban\/:maMau'[^\n]*requireChucNang\('HRM', 'mauvanban'\)/.test(sHrm),
  'duong SUA mau co gate chuc nang');

console.log('\n=== 7f. Bien go sai ten phai LO RA, khong im lang ===');
kiem(/Object\.prototype\.hasOwnProperty\.call\(bien, ten\) \? bien\[ten\] : ca/.test(sFe),
  'thayBien(): bien la giu nguyen {{X}} de nhin thay, khong thay bang chuoi rong');
kiem(/function bienLa\(mau, dsBienHopLe\)/.test(sFe), 'co ham bienLa() de canh bao truoc khi luu');
kiem(/const BIEN_THEO_MAU = \{/.test(sFe), 'co bang tra bien hop le theo tung mau');
/* MAU_GOC viet bang backtick: lo go ${ vao la JavaScript noi suy ngay luc tai file. */
const khoiMauGoc = sFe.slice(sFe.indexOf('const MAU_GOC = {'), sFe.indexOf('const BIEN_THEO_MAU'));
kiem(!/\$\{/.test(khoiMauGoc.replace(/` \+ khoiKyMau\([^)]*\)/g, '')),
  'than cac mau KHONG chua ${...} (bien phai la {{...}})');
/* Moi bien xuat hien trong mau phai co trong bang bien tuong ung — thieu la in ra nguyen {{X}}. */
const BIEN_CHUNG = ['TenCongTy', 'DiaChiCongTy', 'MaSoThueCongTy', 'TenGiamDoc', 'HoTen', 'MaNV',
  'NgaySinh', 'GioiTinh', 'SoCCCD', 'NgayCapCCCD', 'NoiCapCCCD', 'DiaChi', 'SDT', 'Email',
  'QuocTich', 'BoPhan', 'ChucVuNhanVien', 'MaSoThueCaNhan', 'SoSoBHXH', 'NgayThangNamKy'];
const BIEN_RIENG = {
  HDLD_CHINHTHUC: ['SoHopDong', 'LoaiHopDong', 'NgayKy', 'TuNgay', 'DenNgay', 'SoNamHopDong',
    'SoNgayThuViec', 'ChucVu', 'NoiLamViec', 'QuanLyTrucTiep', 'LuongCoBan', 'LuongCoBanBangChu',
    'HeSoLuong', 'PhuCapAnCa', 'PhuCapTrangPhuc', 'PhuCapXangXe', 'PhuCapDienThoai',
    'PhuCapChuyenCan', 'PhuCapChucVu', 'QuyKPI', 'SoCongXangXe', 'SoCongAnTrua', 'TyLeThuViec',
    'CauThoiHan'],
  QD_TANGLUONG: ['SoQuyetDinh', 'LoaiQuyetDinh', 'NgayKy', 'NgayHieuLuc', 'GiaTriCu', 'GiaTriMoi',
    'NoiDung', 'KhoiNoiDung', 'BoPhanChucVu'],
  PHULUC: ['SoPhuLuc', 'SoHopDong', 'NgayKy', 'NgayHieuLuc', 'LuongCoBanMoi',
    'LuongCoBanMoiBangChu', 'ChucVuMoi', 'NoiDungThayDoi'],
  THANHLY: ['SoHopDong', 'NgayNghiViec', 'LyDoNghi', 'TroCap', 'KhauTru', 'TrangThaiBanGiao']
};
BIEN_RIENG.HDLD_THUVIEC = BIEN_RIENG.HDLD_CHINHTHUC;
BIEN_RIENG.QD_CHUNG = BIEN_RIENG.QD_TANGLUONG;
MA_MAU.forEach(ma => {
  const i = khoiMauGoc.indexOf(ma + ': {');
  if (i < 0) { NO(`khong tim thay mau ${ma} de doi chieu bien`); return; }
  const ke = MA_MAU.map(x => khoiMauGoc.indexOf(x + ': {')).filter(j => j > i).sort((a, b) => a - b)[0];
  const than = khoiMauGoc.slice(i, ke > 0 ? ke : khoiMauGoc.length);
  const hopLe = BIEN_CHUNG.concat(BIEN_RIENG[ma] || []);
  /* SO_VAN_BAN la cho giu cho bi .replace() nuot NGAY LUC DUNG MAU_GOC, khong bao gio toi thayBien().
     Khong loai ra thi phep kiem nay bao sai ca 6 mau. */
  const dung = [...new Set((than.match(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g) || [])
    .map(s => s.replace(/[{}\s]/g, '')))].filter(b => b !== 'SO_VAN_BAN');
  const thieu = dung.filter(b => !hopLe.includes(b));
  kiem(thieu.length === 0, `mau ${ma}: moi bien deu co trong bang bien`,
    thieu.length ? 'bien khong co that: ' + thieu.join(', ') : '');
});

console.log('\n=== 7g. Ham dung mau cu da go het (khong de hai ban van ban phap ly) ===');
/* Kiem CA HAI chieu: khai bao da go, VA khong con cho nao goi. Chi kiem khai bao thi mot loi goi
   con sot se lam vo trang luc in ma bo tu kiem van bao DAT. Bo comment truoc khi tim loi goi. */
const sFeKhongComment = sFe.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
['mauHopDongChinhThuc', 'mauHopDongThuViec', 'mauQuyetDinhTangLuong', 'mauQuyetDinhChung',
 'khoiBenA', 'khoiBenB', 'tieuDeVanBan', 'khoiKy', 'docHeader', 'signBlock'].forEach(h => {
  kiem(!new RegExp(`function ${h}\\s*\\(`).test(sFe), `da go khai bao ${h}()`);
  kiem(!new RegExp(`(?<![A-Za-z0-9_])${h}\\s*\\(`).test(sFeKhongComment), `khong con cho nao goi ${h}()`);
});
// Ban sao chet cua TEN_MAU: moi mau chi duoc co khoa "than", khong co khoa "ten".
kiem(!/^\s*ten: '/m.test(sFe.slice(sFe.indexOf('const MAU_GOC = {'), sFe.indexOf('const BIEN_THEO_MAU'))),
  'MAU_GOC khong giu ban sao ten mau (ten hien thi chi o TEN_MAU)');
/* Ca 4 duong in deu phai di qua inVanBan() — sot mot cai la cai do khong an mau da sua. */
['printHopDong', 'printPhuLuc', 'printQuyetDinh', 'printThanhLy'].forEach(f => {
  const i = sFe.indexOf(`function ${f}(`);
  kiem(i > 0 && /inVanBan\(/.test(sFe.slice(i, i + 400)), `${f}() goi inVanBan()`);
});

console.log('\n=== 7h. v8.86 — sua bang trong o soan thao ===');
/* Trong contenteditable, bang la MOT KHOI: boi den roi bam Delete chi xoa chu trong o, bang rong
   van nam do. execCommand khong co lenh nao cho bang => phai thao tac thang tren DOM. */
['themDong', 'xoaDong', 'themCot', 'xoaCot', 'xoaBang'].forEach(v =>
  kiem(new RegExp(`data-bang="${v}"`).test(sFe) && new RegExp(`${v}\\(td\\)`).test(sFe),
    `co nut va ham xu ly "${v}"`));
kiem(/function oDangDung\(\)/.test(sFe), 'co ham tim o <td>/<th> dang dat con tro');
// Khong chan mousedown thi bam nut la o soan thao mat focus, con tro bay mat.
kiem((sFe.match(/addEventListener\('mousedown', e => e\.preventDefault\(\)\)/g) || []).length >= 2,
  'cac nut thanh cong cu deu chan mousedown de giu con tro');
kiem(/function coOGop\(bang\)/.test(sFe), 'canh bao truoc khi them/xoa cot o bang co o gop (colspan)');
// Backend phai cho phep colspan/rowspan, khong thi sua bang xong luu la mat o gop.
['colspan', 'rowspan', 'th', 'td', 'tr', 'table'].forEach(x =>
  kiem(sHrm.slice(sHrm.indexOf('const THE_CHO_PHEP'), sHrm.indexOf('function locThuocTinh')).includes(`'${x}'`),
    `danh sach trang backend co "${x}" (sua bang xong luu khong bi mat)`));

/* ------------------------------------------------------------------------------------------------
   8. v8.88 — FORM THEM/SUA NHAN SU CO LUON DINH KEM + NGUOI PHU THUOC
   ------------------------------------------------------------------------------------------------ */
console.log('\n=== 8a. Hai khoi co mat o CA hai duong (them moi va sua) ===');
const iForm = sFe.indexOf('async function openNhanVienForm(');
const hForm = iForm < 0 ? '' : sFe.slice(iForm, sFe.indexOf('async function deleteNhanVien'));
kiem(iForm >= 0, 'cat duoc openNhanVienForm()');
kiem(/id="hsDinhKem"/.test(hForm) && /id="hsNPT"/.test(hForm), 'form co ca 2 khoi');
kiem(/if \(id\) \{ veDinhKem\(modal, id\); veNguoiPhuThuoc\(modal, id\); \}/.test(hForm),
  'duong SUA dung lai NGUYEN hai ham cua man Ho so (khong viet ban thu hai de troi khoi nhau)');
kiem(/veDinhKemCho\(modal, dkCho\); veNPTCho\(modal, nptCho\)/.test(hForm),
  'duong THEM MOI dung hai khoi "cho"');

console.log('\n=== 8b. 🔴 Nut trong <form> PHAI co type="button" ===');
/* Thieu type, trinh duyet coi la nut submit: bam "Xoa file" hay "Them nguoi phu thuoc" la LUU LUON
   ho so. Hai khoi nay truoc v8.88 chi nam o man Ho so (khong co <form>) nen khong lo. */
['act-dk-xoa', 'act-npt-sua', 'act-npt-xoa', 'act-dkc-xoa', 'act-nptc-sua', 'act-nptc-xoa',
 'nptThem', 'nptcThem'].forEach(c => {
  const re = new RegExp(`<button[^>]*(class="[^"]*${c}|id="${c}")`, 'g');
  const nut = sFe.match(re) || [];
  kiem(nut.length > 0 && nut.every(x => /type="button"/.test(x)), `nut ${c} co type="button"`);
});

console.log('\n=== 8c. 🔴 So nguoi phu thuoc — con so nay vao thang giam tru gia canh ===');
/* Gui nptCho.length luc TAO: neu moi lan chen NguoiPhuThuoc deu hong thi cot con nguyen so do trong
   khi bang rong -> payroll cho N suat giam tru cho nguoi khong co ai phu thuoc. */
kiem(/soNguoiPhuThuoc: id \? val\(modal, 'f_npt'\) : 0/.test(hForm),
  'THEM MOI gui 0; dongBoSoNPT() o backend la noi DUY NHAT ghi cot nay');
kiem(/id="f_npt" readonly/.test(hForm), 'o So nguoi phu thuoc chi doc (khong de hai nguon cho mot so)');
// Them mot nguoi roi bam Luu: neu lay nv.SoNguoiPhuThuoc doc luc mo form thi ghi de nguoc so vua dong bo.
kiem(!/soNguoiPhuThuoc: .*nv\.SoNguoiPhuThuoc/.test(hForm),
  'duong SUA KHONG gui lai nv.SoNguoiPhuThuoc doc luc mo form');
const iVeNPT = sFe.indexOf('async function veNguoiPhuThuoc(');
kiem(/const oNhap = modal\.querySelector\('#f_npt'\)/.test(sFe.slice(iVeNPT, iVeNPT + 900)),
  'veNguoiPhuThuoc() ve lai ca o #f_npt (form Sua cung co o do)');
kiem(/SoNguoiPhuThuoc/.test(sPayroll) && !/FROM NguoiPhuThuoc/.test(sPayroll),
  'payroll.js VAN doc NhanVien.SoNguoiPhuThuoc nhu cu (khong doi cach tinh luong)');

console.log('\n=== 8d. Luu nhan vien xong ma ghi phan phu loi ===');
/* KHONG rollback: xoa nhan vien vua tao la mat ca ho so nguoi dung vua go chi vi mot file hong. */
kiem(!/apiDelete\('\/api\/hrm\/nhanvien\/' \+ idMoi/.test(hForm),
  'KHONG xoa nhan vien vua tao khi phan phu ghi loi');
kiem(/const hong = \[\]/.test(hForm) && /hong\.length/.test(hForm), 'dem va bao so muc ghi hong');
kiem(/openNhanVienDetail\(idMoi\)/.test(hForm), 'mo luon Ho so de bo sung, khoi di tim lai');
kiem(/if \(!idMoi\) throw new Error/.test(hForm), 'may chu khong tra ID thi dung han, khong ghi tiep');

console.log('\n=== 8e. Danh sach "cho" phai noi ro la chua luu ===');
kiem(/GHI_CHU_CHO/.test(sFe) && /lưu khi bấm/.test(sFe),
  'co dong nhac "luu khi bam Them nhan vien" (khong thi nguoi dung dong cua so va tuong da luu)');
kiem(/function goiNPT\(p\)/.test(sFe), 'giu ca payload (gui API) lan hienThi (ve bang) cho NPT cho');
kiem(/function formNPT\(npt, nhanVienId, modalCha, luuTam\)/.test(sFe),
  'formNPT nhan luuTam — ba tham so dau GIU NGUYEN nen cho goi cu khong doi');
kiem(/if \(luuTam\) \{/.test(sFe), 'co luuTam thi KHONG goi API');

console.log('\n=== 9. Bump ?v= ===');
const v = parseFloat((sIndex.match(/module\.hrm\.js\?v=([\d.]+)/) || [])[1] || '0');
kiem(v >= 8.88, `index.html bump module.hrm.js?v= len >= 8.88 (dang la ${v})`);

console.log(`\n${'='.repeat(70)}\nKET QUA: ${dat} dat / ${truot} sai\n${'='.repeat(70)}`);
if (truot) {
  console.log('\n⚠️ Co phep kiem SAI. Doc ky phan 1 va 2 — do la hai cho mat du lieu / lech luong.');
}
process.exit(truot ? 1 : 0);
