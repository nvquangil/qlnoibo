/* ================================================================================================
   KIEM CHUNG v7.47 — Excel MOT PHIEU BAN HANG: cot "SL quy doi" phai la SO QUY DOI, khong phai so cai
   ------------------------------------------------------------------------------------------------
   Loi nguoi dung bao: "cot don vi quy doi dang bi sai ra so cai chu khong phai so quy doi".
   Nguyen nhan: route ghi `SoLuongCai` vao cot do. Dung phai la `SoLuongQuyDoi` + `DonViQuyDoi` —
   hai cot CO SAN tren PhieuBanHangChiTiet, ghi luc luu phieu.

   Test doc chinh routes/banhang.js (khoi route /phieu/:id/export) va doi chieu tung diem, KHONG can
   CSDL. Kem kiem quy uoc "NULL = ma khong co quy doi -> de TRONG" va cong thuc SUM phai theo chu cai
   cot (viet cung 'K' la them cot thi SUM tro sai cot ma Excel khong bao gi).

   Chay:  node utils/kiem_excel_phieu_ban_hang.js
   ================================================================================================ */
const fs = require('fs');
const path = require('path');

let dat = 0, truot = 0;
const OK = (m) => { dat++; console.log('  OK   ' + m); };
const NO = (m) => { truot++; console.log('  SAI  ' + m); };
const kiem = (dk, m, them) => (dk ? OK(m) : NO(m + (them ? '  -> ' + them : '')));

const src = fs.readFileSync(path.join(__dirname, '..', 'routes', 'banhang.js'), 'utf8');
/* Cat DUNG khoi route xuat MOT phieu (khong lan sang route xuat DANH SACH phieu o tren). */
const moc = src.indexOf("router.get('/phieu/:id/export'");
const khoi = src.slice(moc, src.indexOf("router.get('/phieu/:id/hoadon'", moc) > moc
  ? src.indexOf("router.get('/phieu/:id/hoadon'", moc)
  : moc + 6000);

console.log('\n=== 1. Cat duoc khoi route ===');
kiem(moc > 0, "tim thay route '/phieu/:id/export'");
kiem(khoi.length > 500 && /ws\.columns = \[/.test(khoi), 'khoi route co phan dung Excel');

console.log('\n=== 2. Cot "SL quy doi" lay dung nguon ===');
kiem(/c\.SoLuongQuyDoi/.test(khoi), 'ghi tu ct.SoLuongQuyDoi');
kiem(/c\.DonViQuyDoi \|\| ''/.test(khoi), 'co cot DVT quy doi di kem (so phai co don vi)');
kiem(!/so\(c\.SoLuongCai\)/.test(khoi),
  'KHONG con ghi SoLuongCai vao cot quy doi (chinh la loi cu)');
kiem(/'SL quy đổi', 'ĐVT quy đổi'/.test(khoi), 'tieu de 2 cot dat canh nhau');

console.log('\n=== 3. NULL = ma khong co quy doi -> de TRONG, khong ghi 0 ===');
kiem(/c\.SoLuongQuyDoi == null \? '' :/.test(khoi),
  "NULL -> chuoi rong (ghi 0 la nguoi doc tuong 'quy doi ra 0')");

console.log('\n=== 4. So cot va cong thuc SUM khong viet cung ===');
kiem(/const SO_COT = ws\.columns\.length/.test(khoi),
  'SO_COT lay tu ws.columns.length (khong go cung 11/12)');
kiem(/ws\.getColumn\(SO_COT\)\.letter/.test(khoi), 'chu cai cot Thanh tien lay qua getColumn().letter');
kiem(!/SUM\(K\$\{dongDau\}/.test(khoi), "KHONG con SUM('K...') go cung");

console.log('\n=== 5. Dem cot: tieu de, ws.columns va dong du lieu phai KHOP nhau ===');
const mColumns = khoi.match(/ws\.columns = \[([\s\S]*?)\n    \];/);
const soKey = mColumns ? (mColumns[1].match(/key:/g) || []).length : 0;
const mTitle = khoi.match(/const rTitle = ws\.addRow\(\[([\s\S]*?)\]\);/);
const soTieuDe = mTitle ? (mTitle[1].match(/'/g) || []).length / 2 : 0;
kiem(soKey === 12, `ws.columns co 12 cot`, String(soKey));
kiem(soTieuDe === 12, `dong tieu de co 12 o`, String(soTieuDe));
/* Dong du lieu: dem so bieu thuc ngan cach boi dau phay o cap ngoai cua addRow([...]). */
const mData = khoi.match(/ct\.forEach\(\(c, i\) => ws\.addRow\(\[([\s\S]*?)\]\)\);/);
let soO = 0;
if (mData) {
  let sau = 0, dem = 1, trongChuoi = null, i = 0;
  const s = mData[1].replace(/\/\*[\s\S]*?\*\//g, '');   // bo comment de khong dem dau phay trong do
  for (; i < s.length; i++) {
    const c = s[i];
    if (trongChuoi) { if (c === trongChuoi && s[i - 1] !== '\\') trongChuoi = null; continue; }
    if (c === "'" || c === '"' || c === '`') { trongChuoi = c; continue; }
    if ('([{'.includes(c)) sau++;
    else if (')]}'.includes(c)) sau--;
    else if (c === ',' && sau === 0) dem++;
  }
  soO = dem;
}
kiem(soO === 12, 'dong du lieu ghi dung 12 o (khong lech cot)', String(soO));

console.log('\n=== 6. Ban xuat DANH SACH phieu van dung 2 cot nay (mot nguon su that) ===');
kiem(/ct\.SoLuong, ct\.DonVi, ct\.SoLuongCai, ct\.SoLuongQuyDoi, ct\.DonViQuyDoi/.test(src),
  '/phieu/export doc SoLuongQuyDoi + DonViQuyDoi');

console.log('\n=== 7. Cot ton tai that trong schema (khong doan ten cot) ===');
const schema = fs.readFileSync(path.join(__dirname, '..', '..', 'database', 'CAI_DAT_DAY_DU.sql'), 'utf8');
const bang = schema.slice(schema.indexOf('CREATE TABLE PhieuBanHangChiTiet'),
  schema.indexOf('IX_PhieuBanHangChiTiet_Phieu'));
kiem(/SoLuongQuyDoi\s+DECIMAL/.test(bang), 'PhieuBanHangChiTiet.SoLuongQuyDoi co that');
kiem(/DonViQuyDoi\s+NVARCHAR/.test(bang), 'PhieuBanHangChiTiet.DonViQuyDoi co that');
/* Query cua route dung `ct.*` nen 2 cot tu co — kiem lai de sau nay ai doi thanh liet ke cot thi biet. */
kiem(/SELECT ct\.\*, h\.MaHang, h\.TenHang, ms\.TenMau/.test(khoi),
  'query dung ct.* nen 2 cot quy doi tu co (doi sang liet ke cot thi phai them tay)');

console.log(`\n================ KET QUA: ${dat} dat / ${truot} sai ================`);
process.exit(truot ? 1 : 0);
