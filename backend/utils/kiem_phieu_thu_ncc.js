/* ================================================================================================
   KIEM CHUNG v8.78 — PHIEU THU LOAI "NHA CUNG CAP"
   ------------------------------------------------------------------------------------------------
   Thu tien tu NCC (NCC hoan tien thua / hang loi / chiet khau tra sau) => minh da tra IT DI
   => SO CON NO NCC TANG LAI.

   Hai rui ro that su cua viec nay, test o day chan ca hai:

   (1) WHITELIST NGUOC o chuanHoaPhieuThu()
       Ban cu: `loai: b.loaiDoiTuong === 'Khac' ? 'Khac' : 'KhachHang'` — MOI gia tri khac 'Khac'
       deu bi ep thanh 'KhachHang'. De nguyen dong do ma them option o form thi phieu thu NCC se
       LUU XUONG LA 'KhachHang' mang ten NCC, roi congNoKhachHang() (gom theo TEN) cong thang vao
       cong no cua mot "khach hang" trung ten. Khong bao loi, khong ai thay.

   (2) HAI CONG THUC LECH DAU NHAU
       congNoNCC()    tinh bang tong:  daTra = SUM(chi) - SUM(thu)
       soChiTietNCC() tinh so chi tiet: luy ke = PhatSinh - ThanhToan, phieu thu la ThanhToan AM
       Hai ban tinh SONG SONG. Lech dau la bang tong va so chi tiet ra hai con so khac nhau cho
       cung mot NCC — dung lop loi ma comment v6.78 trong congno.js da canh bao.
       Muc 3 duoi day KHONG doc regex ma TINH THAT bang so de chung minh hai ben bang nhau.

   Chay:  node utils/kiem_phieu_thu_ncc.js
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
const sBaoCao = doc('routes/baocao.js');
const sChungTu = doc('utils/chungTu.js');
const sFe = doc('../frontend/js/module.congno.js');
const sIndex = doc('../frontend/index.html');
const sMig = doc('../database/migration_v875.sql');

/* ------------------------------------------------------------------------------------------------
   1. CHUAN HOA: whitelist XUOI + NULL hoa cheo
   ------------------------------------------------------------------------------------------------ */
console.log('\n=== 1. chuanHoaPhieuThu(): khong con whitelist nguoc ===');
const khoiCH = sCongNo.slice(sCongNo.indexOf('async function chuanHoaPhieuThu'),
  sCongNo.indexOf('function chuanLoaiPhieu'));
kiem(!/loai: b\.loaiDoiTuong === 'Khac' \? 'Khac' : 'KhachHang'/.test(khoiCH),
  'DA BO dong whitelist nguoc (moi gia tri la -> KhachHang)');
kiem(/LOAI_DOI_TUONG_THU\.includes\(b\.loaiDoiTuong\)/.test(khoiCH),
  'dung whitelist XUOI qua LOAI_DOI_TUONG_THU');
kiem(/const LOAI_DOI_TUONG_THU = \['KhachHang', 'NhaCungCap', 'Khac'\]/.test(sCongNo),
  'LOAI_DOI_TUONG_THU khai dung 3 gia tri');
kiem(/if \(out\.loai !== 'KhachHang'\) out\.khachHangId = null;/.test(khoiCH),
  'NULL hoa KhachHangID khi loai khac KhachHang');
kiem(/if \(out\.loai !== 'NhaCungCap'\) out\.nccId = null;/.test(khoiCH),
  'NULL hoa NCC_ID khi loai khac NhaCungCap (chieu nguoc lai)');
kiem(/Thu của nhà cung cấp thì phải CHỌN nhà cung cấp/.test(khoiCH),
  'bat buoc chon NCC (cong no NCC nhom theo ID, khong theo ten)');
kiem(/SELECT TenNCC FROM NhaCungCap WHERE NCC_ID=@id/.test(khoiCH),
  'kiem NCC co that truoc khi luu');

console.log('\n=== 1b. INSERT / UPDATE ghi NCC_ID, co do cot ===');
kiem((sCongNo.match(/coCot\(pool, 'PhieuThu', 'NCC_ID'\)/g) || []).length >= 2,
  'POST va PUT deu do cot PhieuThu.NCC_ID truoc khi dung');
kiem(/INSERT INTO PhieuThu[\s\S]{0,400}coNCCThu \? ', NCC_ID' : ''/.test(sCongNo),
  'INSERT them cot NCC_ID theo ket qua do cot');
kiem(/coNCCThu \? 'NCC_ID=@NCC_ID,' : ''/.test(sCongNo),
  'UPDATE ghi NCC_ID THANG (khong ISNULL giu cu - doi loai phai xoa duoc lien ket)');
kiem(/chưa chạy migration_v875/.test(sCongNo),
  'CSDL chua chay migration thi bao ro rang thay vi loi SQL');

/* ------------------------------------------------------------------------------------------------
   2. HAI HAM CONG NO deu co nhanh phieu thu
   ------------------------------------------------------------------------------------------------ */
console.log('\n=== 2. congNoNCC() va soChiTietNCC() deu tinh phieu thu NCC ===');
const khoiTong = sCongNo.slice(sCongNo.indexOf('async function congNoNCC(pool)'),
  sCongNo.indexOf("router.get('/congnoncc'"));
const khoiCT = sCongNo.slice(sCongNo.indexOf('async function soChiTietNCC'),
  sCongNo.indexOf("router.get('/congnoncc/chitiet'"));

kiem(/FROM PhieuThu[\s\S]{0,120}LoaiDoiTuong = N'NhaCungCap'/.test(khoiTong),
  'congNoNCC() doc PhieuThu loc dung LoaiDoiTuong');
kiem(/const daTra = g\(chi, n\.NCC_ID\) - thuLaiNCC;/.test(khoiTong),
  'congNoNCC(): daTra = chi - thu  (thu cang nhieu, con no cang tang)');
kiem(/FROM PhieuThu[\s\S]{0,120}LoaiDoiTuong = N'NhaCungCap'/.test(khoiCT),
  'soChiTietNCC() doc PhieuThu loc dung LoaiDoiTuong');
kiem(/-SoTien AS ThanhToan/.test(khoiCT),
  'soChiTietNCC(): phieu thu vao cot ThanhToan voi DAU AM');
kiem(/N'PT' AS CtLoai/.test(khoiCT), 'dong phieu thu co CtLoai = PT (bam vao xem duoc chung tu)');
kiem(/\.\.\.chi, \.\.\.thuNCC,/.test(khoiCT), 'dong phieu thu duoc gop vao mang rows');
/* CtLoai 'PT' phai co nhanh doc trong utils/chungTu.js — dung lop loi da vo o v7.48. */
kiem(/if \(loai === 'PT'\)/.test(sChungTu), "docChungTu() co nhanh 'PT'");
kiem(/coCot\(pool, 'PhieuThu', 'NCC_ID'\)/.test(sChungTu),
  'nhanh PT do cot truoc khi JOIN NhaCungCap (CSDL chua migration khong duoc vo)');

/* ------------------------------------------------------------------------------------------------
   3. 🔴 HAI CONG THUC PHAI RA CUNG MOT SO — tinh that, khong doc regex
   ------------------------------------------------------------------------------------------------ */
console.log('\n=== 3. Bang tong va so chi tiet ra CUNG mot con no ===');
function moPhong({ nhapVai, nhapPK, nhapHH, dieuChinh, traLai, chi, thu }) {
  // (a) Cach cua congNoNCC()
  const phaiTra = nhapVai + nhapPK + nhapHH + dieuChinh - traLai;
  const daTra = chi - thu;
  const conNoTong = phaiTra - daTra;

  // (b) Cach cua soChiTietNCC(): luy ke = SUM(PhatSinh) - SUM(ThanhToan)
  const dong = [
    { PhatSinh: nhapVai, ThanhToan: 0 },
    { PhatSinh: nhapPK, ThanhToan: 0 },
    { PhatSinh: nhapHH, ThanhToan: 0 },
    { PhatSinh: dieuChinh, ThanhToan: 0 },
    { PhatSinh: -traLai, ThanhToan: 0 },     // v6.66: tra hang = phat sinh AM
    { PhatSinh: 0, ThanhToan: chi },         // phieu chi = thanh toan DUONG
    { PhatSinh: 0, ThanhToan: -thu }         // v8.78: phieu thu = thanh toan AM
  ];
  const conNoChiTiet = dong.reduce((s, r) => s + r.PhatSinh - r.ThanhToan, 0);
  return { conNoTong, conNoChiTiet };
}
[
  { ten: 'khong co phieu thu nao (phai y het truoc v8.78)',
    d: { nhapVai: 10e6, nhapPK: 2e6, nhapHH: 0, dieuChinh: 0, traLai: 0, chi: 7e6, thu: 0 }, mong: 5e6 },
  { ten: 'NCC hoan lai 1 trieu -> con no TANG 1 trieu',
    d: { nhapVai: 10e6, nhapPK: 2e6, nhapHH: 0, dieuChinh: 0, traLai: 0, chi: 7e6, thu: 1e6 }, mong: 6e6 },
  { ten: 'da tra het roi NCC moi hoan lai -> con no AM thanh DUONG',
    d: { nhapVai: 5e6, nhapPK: 0, nhapHH: 0, dieuChinh: 0, traLai: 0, chi: 5e6, thu: 2e6 }, mong: 2e6 },
  { ten: 'co du moi nguon lan tra hang',
    d: { nhapVai: 10e6, nhapPK: 3e6, nhapHH: 4e6, dieuChinh: 1e6, traLai: 2e6, chi: 9e6, thu: 1.5e6 }, mong: 8.5e6 }
].forEach(c => {
  const { conNoTong, conNoChiTiet } = moPhong(c.d);
  kiem(conNoTong === conNoChiTiet && conNoTong === c.mong,
    `${c.ten}: ${conNoTong.toLocaleString('vi-VN')}`,
    conNoTong !== conNoChiTiet ? `LECH! bang tong ${conNoTong} vs so chi tiet ${conNoChiTiet}`
      : `mong ${c.mong}, ra ${conNoTong}`);
});

/* ------------------------------------------------------------------------------------------------
   3b. SO KE TOAN — hai loi ra chieu ra soat bat duoc, ban dau test nay DE LOT
   ------------------------------------------------------------------------------------------------
   Ca hai deu nam o tang TRINH BAY cua So ke toan, va deu khong lam sai SO DU CUOI KY — nen canh bao
   "Lech" khong no, khong ai phat hien. Dung loai sai im lang.
   ------------------------------------------------------------------------------------------------ */
console.log('\n=== 3b. So ke toan trinh bay dung dong NCC hoan tien ===');
/* (a) xeTien(): ThanhToan AM phai chay sang cot TANG NO duoi dang so DUONG.
   De nguyen thi cot "Phieu chi" mang so am -> dong "Phat sinh trong ky" bi tru, khong doi chieu
   duoc voi chung tu nao. Tinh THAT thay vi doc regex. */
const nguonXeTien = sCongNo.slice(sCongNo.indexOf('function xeTien(r)'),
  sCongNo.indexOf('function xeTien(r)') + 400);
const soTest = v => { const n = Number(v); return isFinite(n) ? n : 0; };
let xeTien;
try {
  // eslint-disable-next-line no-new-func
  xeTien = new Function('so', 'return ' + nguonXeTien.slice(nguonXeTien.indexOf('function xeTien')))(soTest);
} catch (e) { xeTien = null; }
if (!xeTien) {
  NO('khong cat duoc ham xeTien() ra de chay thu (doi ten ham?)');
} else {
  const a = xeTien({ PhatSinh: 0, ThanhToan: -1e6 });
  kiem(a.tangNo === 1e6 && a.giamNo === 0,
    'xeTien(): ThanhToan AM (NCC hoan tien) -> cot TANG NO, so DUONG',
    `ra tangNo=${a.tangNo}, giamNo=${a.giamNo}`);
  const b = xeTien({ PhatSinh: -2e6, ThanhToan: 0 });
  kiem(b.tangNo === 0 && b.giamNo === 2e6, 'xeTien(): PhatSinh AM van chay sang GIAM NO (khong vo ban cu)');
  const c = xeTien({ PhatSinh: 5e6, ThanhToan: 0 });
  kiem(c.tangNo === 5e6 && c.giamNo === 0, 'xeTien(): PhatSinh duong binh thuong');
  const d = xeTien({ PhatSinh: 0, ThanhToan: 3e6 });
  kiem(d.tangNo === 0 && d.giamNo === 3e6, 'xeTien(): ThanhToan duong binh thuong');
}
/* (b) MA_CHUNG_TU tra theo chuoi `Loai`. Them nhan moi o soChiTietNCC ma quen them o bang tra thi
   cot "Ma" cua dong do BO TRONG — khong bao loi gi. */
kiem(/'Thu lại từ NCC': 'PT'/.test(sCongNo),
  "MA_CHUNG_TU co khoa 'Thu lại từ NCC' (khong thi cot Ma bo trong)");
/* Moi nhan Loai sinh ra o soChiTietNCC deu phai co trong MA_CHUNG_TU — chong tai pham ve sau. */
const khoiMa = sCongNo.slice(sCongNo.indexOf('const MA_CHUNG_TU = {'),
  sCongNo.indexOf('const CHU_GIAI_MA'));
const nhanSinhRa = [...new Set((khoiCT.match(/N'([^']+)' AS Loai/g) || [])
  .map(s => s.match(/N'([^']+)'/)[1]))];
const nhanThieu = nhanSinhRa.filter(n => !khoiMa.includes(`'${n}'`));
kiem(nhanThieu.length === 0, 'moi nhan Loai cua soChiTietNCC deu co ma viet tat',
  nhanThieu.length ? 'thieu: ' + nhanThieu.join(' / ') : '');

console.log('\n=== 3c. Chan to hop vo nghia: NCC hoan tien + Chuyen thang ===');
kiem(/ch\.loai === 'NhaCungCap' && hinhThuc === HT_CHUYEN_THANG/.test(sCongNo),
  'backend chan NCC hoan tien + Chuyen thang (khong thi sinh phieu chi kem vo nghia)');

/* ------------------------------------------------------------------------------------------------
   4. Muc B bao cao tai chinh KHOP voi man Cong no NCC
   ------------------------------------------------------------------------------------------------ */
console.log('\n=== 4. Bao cao tai chinh muc B tru thu-lai-NCC (khong thi lech voi man Cong no) ===');
kiem(/coCot\(pool, 'PhieuThu', 'NCC_ID'\)/.test(sBaoCao), 'baocao.js do cot PhieuThu.NCC_ID');
kiem(/sqlThuLaiNCC/.test(sBaoCao), 'co bieu thuc sqlThuLaiNCC dung chung');
kiem(/- \$\{sqlThuLaiNCC\} AS DaTra/.test(sBaoCao), 'DaTra = SUM(PhieuChi) - thu lai NCC');
kiem(/PhaiTra_ThuLaiNCC/.test(sBaoCao), 'tra ra PhaiTra_ThuLaiNCC de doi chieu');

/* ------------------------------------------------------------------------------------------------
   5. MIGRATION
   ------------------------------------------------------------------------------------------------ */
console.log('\n=== 5. migration_v875 chay lai duoc, khong dung du lieu cu ===');
kiem(/IF COL_LENGTH\('PhieuThu', 'NCC_ID'\) IS NULL/.test(sMig), 'them cot co guard COL_LENGTH');
kiem(/FK_PhieuThu_NhaCungCap/.test(sMig), 'co khoa ngoai ve NhaCungCap');
kiem(/sys\.foreign_keys WHERE name = 'FK_PhieuThu_NhaCungCap'/.test(sMig), 'FK cung idempotent');
kiem(/IF DB_NAME\(\) <> N'QLNoiBo'/.test(sMig), 'co guard dung database');
kiem(!/UPDATE PhieuThu SET/.test(sMig), 'migration KHONG dung den du lieu da co');
kiem(!/DELETE FROM/.test(sMig), 'migration KHONG xoa gi');

/* ------------------------------------------------------------------------------------------------
   6. FRONTEND
   ------------------------------------------------------------------------------------------------ */
console.log('\n=== 6. Form phieu thu ===');
kiem(/<option value="NhaCungCap"/.test(sFe), 'co option Nha cung cap');
kiem(/id="thuNcc"/.test(sFe), 'co o chon NCC lay tu danh muc');
kiem(/nccId: fd\.get\('nccId'\)/.test(sFe), 'payload gui nccId len backend');
/* Chi display:none ma khong xoa gia tri thi doi loai xong van gui id cu -> nguoi dung thay mat
   lien ket mot cach kho hieu. Cung bai hoc voi dongBoO() cua form phieu chi. */
const khoiDongBo = sFe.slice(sFe.indexOf('function dongBoLoaiThu'), sFe.indexOf('selLoai.addEventListener'));
kiem(/modal\.querySelector\('#thuKH'\)\.value = ''/.test(khoiDongBo),
  'doi sang NCC thi XOA gia tri o khach hang (khong chi an)');
kiem(/modal\.querySelector\('#thuNcc'\)\.value = ''/.test(khoiDongBo),
  'doi sang khach thi XOA gia tri o NCC');
kiem(/modal\.querySelector\('#thuPhieuBH'\)\.value = ''/.test(khoiDongBo),
  'doi sang NCC thi bo gan phieu ban hang (gan phieu BH chi co nghia voi khoan thu cua khach)');
kiem(/payload\.loaiDoiTuong === 'NhaCungCap' && !payload\.nccId/.test(sFe),
  'form chan truoc khi gui (backend van chan lan nua)');
kiem(/NCC hoàn tiền<\/span>/.test(sFe), 'bang danh sach co nhan phan biet phieu thu NCC');

console.log('\n=== 7. Bump ?v= ===');
const v = parseFloat((sIndex.match(/module\.congno\.js\?v=([\d.]+)/) || [])[1] || '0');
kiem(v >= 8.78, `index.html bump module.congno.js?v= len >= 8.78 (dang la ${v})`);

console.log(`\n${'='.repeat(70)}\nKET QUA: ${dat} dat / ${truot} sai\n${'='.repeat(70)}`);
process.exit(truot ? 1 : 0);
