/* ================================================================================================
   KIEM CHUNG v7.69 — LICH SU NHAP/XUAT 1 MA PHU KIEN: NGAY MOI NHAT LEN DAU
   ------------------------------------------------------------------------------------------------
   Yeu cau Nguyen: "Quan ly phu kien / The kho ton kho khi bam vao ma phu kien ra lich su xuat nhap
   ... dang de ngay cu nhat len dau. Gio sua lai ngay moi nhat len dau."

   ⚠️ CAI BAY CUA VIEC "CHI DOI THU TU SAP XEP": cot "Ton cuoi" la SO DU LUY KE
   (`tonCuoi += nhap - xuat`). Doi `ORDER BY p.Ngay` thanh DESC o cau SQL la cong don nguoc chieu ->
   MOI DONG ra mot con so ton vo nghia, va dong dau bang bang chinh phieu moi nhat thay vi ton hien
   tai. Dung cach: cong theo chieu TANG roi DAO MANG khi tra ve.
   Test nay CHAY THAT bo cong thuc va so tung con so, khong chi kiem thu tu.

   Chay:  node utils/kiem_lich_su_phu_kien.js
   ================================================================================================ */
const fs = require('fs');
const path = require('path');
const G = path.join(__dirname, '..');
const doc = (p) => fs.readFileSync(path.join(G, p), 'utf8');

let dat = 0, truot = 0;
const OK = (m) => { dat++; console.log('  OK   ' + m); };
const NO = (m) => { truot++; console.log('  SAI  ' + m); };
const kiem = (dk, m, them) => (dk ? OK(m) : NO(m + (them ? '  -> ' + them : '')));
const bang = (thuc, mong, m) => kiem(JSON.stringify(thuc) === JSON.stringify(mong), `${m}  [duoc: ${JSON.stringify(thuc)}]`);
const bo = (s) => String(s).replace(/image\/\*/g, 'image_ALL')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const { dongLichSuPhuKien } = require('./lichSuPhuKien');
const sRoute = doc('routes/phukien.js');
const sFe = doc('../frontend/js/module.phukien.js');
const sIndex = doc('../frontend/index.html');

/* Du lieu vao: DA sap theo ngay TANG (dung nhu cau SQL tra ve). */
const vao = [
  { PhieuID: 11, Ngay: '2026-01-05', LoaiPhieu: 'Nhập', SoLuong: 100, DonVi: 'Cái', MaDon: 'D1' },
  { PhieuID: 12, Ngay: '2026-02-10', LoaiPhieu: 'Xuất', SoLuong: 30, DonVi: 'Cái', MaDonHang: 'DH2602001' },
  { PhieuID: 13, Ngay: '2026-03-15', LoaiPhieu: 'Nhập', SoLuong: 50, DonVi: 'Cái' },
  { PhieuID: 14, Ngay: '2026-04-20', LoaiPhieu: 'Xuất', SoLuong: 20, DonVi: 'Cái', MaDon: 'D4', MaDonHang: 'DH2604009' },
  { PhieuID: 15, Ngay: '2026-05-01', LoaiPhieu: 'Xuất', SoLuong: 5, DonVi: 'Cái' }
];

console.log('\n=== 1. CHAY THAT: thu tu hien thi = MOI NHAT LEN DAU ===');
const ra = dongLichSuPhuKien(vao);
bang(ra.map(r => r.phieuId), [15, 14, 13, 12, 11], 'dao chieu: phieu moi nhat dung dau, cu nhat cuoi');
bang(ra.map(r => r.ngay), ['2026-05-01', '2026-04-20', '2026-03-15', '2026-02-10', '2026-01-05'],
  'ngay giam dan tu tren xuong');

console.log('\n=== 2. Cot "Ton cuoi" van DUNG (day la cho de vo nhat) ===');
/* Luy ke theo chieu THOI GIAN: 100 -> 70 -> 120 -> 100 -> 95. Hien thi nguoc lai. */
bang(ra.map(r => r.ton), [95, 100, 120, 70, 100],
  'moi dong giu dung so ton TAI THOI DIEM cua no (khong bi cong nguoc)');
bang(ra[0].ton, 95, 'dong TREN CUNG = TON HIEN TAI (100-30+50-20-5)');
bang(ra[ra.length - 1].ton, 100, 'dong CUOI BANG = ton sau phieu dau tien');
/* Kiem tra doc lap: ton cua dong thu i phai bang tong nhap tru tong xuat cua moi phieu <= no. */
const theoThoiGian = ra.slice().reverse();
let luy = 0;
const luyKe = theoThoiGian.map(r => { luy += r.nhap - r.xuat; return luy; });
bang(theoThoiGian.map(r => r.ton), luyKe, 'tinh lai doc lap theo chieu tang -> khop tung dong');

console.log('\n=== 3. Nhap / Xuat tach dung cot ===');
bang(ra.map(r => [r.nhap, r.xuat]), [[0, 5], [0, 20], [50, 0], [0, 30], [100, 0]],
  'phieu Nhap vao cot Nhap, phieu Xuat vao cot Xuat');
bang(dongLichSuPhuKien([{ PhieuID: 1, LoaiPhieu: 'Nhập', SoLuong: null }])[0].nhap, 0,
  'SoLuong null -> 0 (khong ra NaN keo ca cot ton thanh NaN)');
bang(dongLichSuPhuKien([{ PhieuID: 1, LoaiPhieu: 'Nhập', SoLuong: '7' }])[0].ton, 7,
  'SoLuong kieu chuoi tu CSDL van cong duoc');
bang(dongLichSuPhuKien([{ PhieuID: 1, LoaiPhieu: 'Kiểm kê', SoLuong: 9 }])[0].ton, 0,
  'loai phieu khac Nhap/Xuat -> khong dung vao ton');

console.log('\n=== 4. Cac o khac giu nguyen hanh vi cu ===');
bang(ra.map(r => r.donHang), ['', 'DH2604009', '', 'DH2602001', 'D1'],
  'don hang: uu tien MaDonHang (ma lenh SX), thieu thi lui ve MaDon go tay');
bang(ra[0].loaiBaoCao, 'chitiet', 'giu co loaiBaoCao=chitiet (frontend re nhanh theo o nay)');
bang(ra[0].dvt, 'Cái', 'giu DVT');
bang(dongLichSuPhuKien([{ PhieuID: 1, LoaiPhieu: 'Nhập', SoLuong: 1, AnhDaiDien: '/uploads/a.jpg' }])[0].AnhDaiDien,
  '/uploads/a.jpg', 'giu AnhDaiDien (frontend hien 1 lan o dau bang)');
bang(dongLichSuPhuKien([{ PhieuID: 1, LoaiPhieu: 'Nhập', SoLuong: 1 }])[0].AnhDaiDien, null,
  'khong co anh -> null');

console.log('\n=== 5. Truong hop bien ===');
bang(dongLichSuPhuKien([]), [], 'khong co phat sinh -> mang rong');
bang(dongLichSuPhuKien(null), [], 'recordset null -> mang rong, khong nem loi');
bang(dongLichSuPhuKien(undefined), [], 'recordset undefined -> mang rong');
const motDong = dongLichSuPhuKien([{ PhieuID: 9, Ngay: '2026-06-01', LoaiPhieu: 'Nhập', SoLuong: 12 }]);
bang([motDong.length, motDong[0].ton], [1, 12], 'dung 1 phat sinh -> 1 dong, ton = so nhap');
/* Cung ngay, khac phieu: SQL sap theo (Ngay, PhieuID) tang -> hien thi phai la PhieuID giam. */
bang(dongLichSuPhuKien([
  { PhieuID: 21, Ngay: '2026-07-01', LoaiPhieu: 'Nhập', SoLuong: 10 },
  { PhieuID: 22, Ngay: '2026-07-01', LoaiPhieu: 'Xuất', SoLuong: 4 }
]).map(r => [r.phieuId, r.ton]), [[22, 6], [21, 10]],
  'cung ngay -> phieu lap sau len tren, ton van dung');
/* Khong duoc SUA mang goc (recordset) — cho khac con dung lai la vo dau. */
const gocGiuNguyen = [
  { PhieuID: 1, Ngay: '2026-01-01', LoaiPhieu: 'Nhập', SoLuong: 1 },
  { PhieuID: 2, Ngay: '2026-01-02', LoaiPhieu: 'Nhập', SoLuong: 1 }
];
dongLichSuPhuKien(gocGiuNguyen);
bang(gocGiuNguyen.map(r => r.PhieuID), [1, 2], 'KHONG dao mang recordset goc (chi dao ban da map)');

console.log('\n=== 6. Ma nguon: khong roi vao bay "doi ORDER BY thanh DESC" ===');
const sachRoute = bo(sRoute);
/* ⚠️ Phai soi DUNG CAU SQL CUA LICH SU, khong soi ca file: phukien.js con mot route khac (danh sach
   phieu nhap theo NCC) dung `ORDER BY p.Ngay DESC` mot cach HOP LE — cau do khong co cot ton luy ke.
   Kiem ca file la bao SAI oan cho cau khong lien quan. */
/* Moc duy nhat cua cau lich su: `WHERE dm.MaPhuKien = @m`. Cat tu day den dau ` dong template
   literal — dung `[\s\S]*?ORDER BY` la de khop lan sang cau SQL khac o duoi (da vap: bao SAI vi
   khop trung "ORDER BY p.PhieuID DESC" cua route danh sach phieu). */
const iMoc = sachRoute.indexOf('WHERE dm.MaPhuKien = @m');
const cauLichSu = iMoc < 0 ? '' : sachRoute.slice(iMoc, sachRoute.indexOf('`', iMoc));
kiem(!!cauLichSu, 'tim duoc dung cau SQL lich su theo ma phu kien');
kiem(/ORDER BY p\.Ngay, p\.PhieuID/.test(cauLichSu),
  'cau SQL lich su VAN sap theo ngay TANG (chieu cong don), khong doi thanh DESC',
  cauLichSu.replace(/\s+/g, ' ').slice(-60));
kiem(!/ORDER BY p\.Ngay DESC/.test(cauLichSu), 'cau SQL lich su khong dung DESC');
kiem(/dongLichSuPhuKien\(result\.recordset\)/.test(sachRoute), 'route goi ham dung chung');
kiem(/require\(['"]\.\.\/utils\/lichSuPhuKien['"]\)/.test(sRoute), 'route nap util');
kiem(!/tonCuoi \+= nhap - xuat/.test(sachRoute),
  'route KHONG con ban tu cong don (chi con trong util) — tranh sua mot noi quen noi kia');
kiem(/rows\.reverse\(\)/.test(bo(doc('utils/lichSuPhuKien.js'))), 'util dao chieu bang reverse()');

console.log('\n=== 7. Frontend khong sap lai lam mat tac dung ===');
const sachFe = bo(sFe);
const than = (() => {
  const i = sachFe.indexOf('function chiTietTableHtml(rows) {');
  if (i < 0) return '';
  let d = 0;
  for (let k = sachFe.indexOf('{', i); k < sachFe.length; k++) {
    if (sachFe[k] === '{') d++;
    else if (sachFe[k] === '}') { d--; if (!d) return sachFe.slice(i, k + 1); }
  }
  return '';
})();
kiem(!!than, 'cat duoc than chiTietTableHtml');
kiem(!/\.sort\(/.test(than), 'bang chi tiet KHONG tu sap lai (giu dung thu tu backend tra ve)');
kiem(!/\.reverse\(/.test(than), 'va khong dao them lan nua (dao 2 lan = tro ve nhu cu)');
/* Ca 3 cho xem lich su dung CHUNG mot API + mot bo dung bang -> chi can doi backend la du. */
kiem((sachFe.match(/api\/phukien\/thekho\?maPhuKien=/g) || []).length === 2,
  'co dung 2 loi goi API lich su (popup Danh muc + bam ma o bang tong hop)',
  String((sachFe.match(/api\/phukien\/thekho\?maPhuKien=/g) || []).length));
kiem((sachFe.match(/chiTietTableHtml\(/g) || []).length >= 4,
  'moi cho hien lich su deu qua chiTietTableHtml (1 dinh nghia + >=3 loi goi)',
  String((sachFe.match(/chiTietTableHtml\(/g) || []).length));

console.log('\n=== 8. Ban nay chi doi BACKEND -> khong can bump ?v= ===');
/* Thu tu sap xep do backend quyet dinh, frontend chi ve lai dung thu tu duoc tra ve. Nen KHONG
   phai sua module.phukien.js, va cung khong duoc bump ?v= cho co — bump ma khong co gi thay doi
   la bat ca xuong tai lai file vo ich. Chi can pm2 restart. */
kiem(/module\.phukien\.js\?v=/.test(sIndex), 'index.html van nap module.phukien.js co ?v=');
kiem(!/rows\.reverse\(\)|\.sort\(/.test(bo(sFe).slice(bo(sFe).indexOf('function moLichSuPK'),
  bo(sFe).indexOf('function moLichSuPK') + 900)),
  'moLichSuPK khong tu dao/sap — de backend lo (mot cho quyet dinh thu tu)');

console.log('\n================================================================');
console.log(`KET QUA: ${dat} dat / ${truot} truot`);
process.exit(truot ? 1 : 0);
