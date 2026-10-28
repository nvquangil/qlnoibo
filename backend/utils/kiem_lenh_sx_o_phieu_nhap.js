/* ================================================================================================
   kiem_lenh_sx_o_phieu_nhap.js  —  bo tu kiem cho v9.09
   "Lenh SX o lai trong o chon phieu nhap kho cho den khi NHAP XONG."

   Chay:  node backend\utils\kiem_lenh_sx_o_phieu_nhap.js
   KHONG copy file nay sang D:\QLSX — no la dung cu kiem tra o may sua.
   ================================================================================================ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const GOC = path.join(__dirname, '..', '..');
const F = {
  util:  'backend/utils/slNhapKhoChungTu.js',
  nhap:  'backend/routes/nhapkho.js',
  qlsx:  'backend/routes/qlsx.js',
  fe:    'frontend/js/module.nhapkho.js',
  html:  'frontend/index.html'
};

let sai = 0, dat = 0;
const src = {};

function doc(k) {
  const p = path.join(GOC, F[k]);
  if (!fs.existsSync(p)) { console.log('  ❌ KHONG CO FILE: ' + F[k]); sai++; return ''; }
  return fs.readFileSync(p, 'utf8');
}
function kiem(ten, dung, thongDiep) {
  if (dung) { dat++; console.log('  ✓ ' + ten); }
  else { sai++; console.log('  ❌ ' + ten + (thongDiep ? ' — ' + thongDiep : '')); }
}
/* Bo COMMENT truoc khi kiem "file KHONG duoc chua X" — da vap 3 lan: chinh cai comment giai thich
   loi lai lam phep kiem bao sai. Chi dung cho cac phep PHU DINH ben duoi. */
function boComment(s) {
  return s
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[\s{(:;,=])\/\/[^\n]*/g, '$1 ');
}

console.log('\n=== 1. BIEN DICH (thay cho node --check) ===');
['util', 'nhap', 'qlsx', 'fe'].forEach(k => {
  src[k] = doc(k);
  if (!src[k]) return;
  try {
    new vm.Script(src[k], { filename: F[k] });
    dat++; console.log('  ✓ ' + F[k] + ' bien dich duoc');
  } catch (e) {
    sai++; console.log('  ❌ ' + F[k] + ' VO CU PHAP: ' + e.message);
  }
});
src.html = doc('html');

console.log('\n=== 2. CONG THUC QUY VE CAI — hai noi phai GIONG NHAU ===');
/* Bieu thuc trong slNhapKhoChungTu.js la ban sao co y cua mau so trong tinhGiaThanh() (qlsx.js).
   Doi mot ben ma quen ben kia = o chon phieu nhap va gia thanh dem hai so khac nhau cho cung mot
   lenh. So theo cac MANH dac trung, khong so nguyen van (hai noi thut le khac nhau). */
const MANH = [
  /* 🔴 Manh QUAN TRONG NHAT, ra soat cheo v9.09 bat duoc la thieu: doi tinhGiaThanh thanh
     `ct.SoLuong * CASE ...` (cong so nguoi dung go thay vi so quy ve don vi chinh) thi ba manh
     con lai VAN con nguyen => phep kiem xanh trong khi hai noi da lech. */
  'ct.SoLuongChinh * CASE',
  'LOWER(LTRIM(RTRIM(h.DonViCoBan)))',
  "ISNULL(NULLIF(LTRIM(RTRIM(h.DonViQuyDoi)), N''), N'ri')",
  'ISNULL(h.LoaiRi, 1) > 0',
  'THEN ISNULL(h.LoaiRi, 1) ELSE 1 END'
];
/* ⚠️ KHONG dung boComment() cho qlsx.js: file 5000 dong co nhieu chuoi SQL chua `/*` tran, dau mo
   do se bat cap voi `*/` cua mot comment that o xa va NUOT luon doan o giua (dung loi da mac o
   v9.04: boComment nuot 43 dong). O day chi can tim mot doan cong thuc CO TON TAI => doc nguyen
   van la dung nhat, khong co rui ro nuot.
   Rieng phep "KHONG duoc chua X" o muc 3 thi van phai loc comment — xem ghi chu o do. */
MANH.forEach(m => {
  kiem('util co manh: ' + m.slice(0, 42), src.util.includes(m));
  kiem('qlsx (tinhGiaThanh) con manh: ' + m.slice(0, 42), src.qlsx.includes(m),
       'cong thuc gia thanh da doi — phai cap nhat slNhapKhoChungTu.js cho khop');
});
/* HINH DANG ban do tra ve: nhapkho.js doc `(luyKeKN[id] || {}).SLKhoNhapCai`. Neu ai do doi
   slKhoNhapTheoDon thanh map so thuan thi canNhapCai = 0 cho MOI lenh => lui em ve luat cu
   "co phieu la an" => dung tinh nang nay bien mat ma khong phep kiem nao do. */
kiem('qlsx tra object co SLKhoNhapCai', /SLKhoNhapCai\s*:/.test(src.qlsx));
kiem('nhapkho doc dung .SLKhoNhapCai', boComment(src.nhap).includes('.SLKhoNhapCai'));
kiem('util tra object co SoLanNhap + SLCai + SoPhieuGanNhat',
     /SoLanNhap\s*:/.test(src.util) && /SLCai\s*:/.test(src.util) && /SoPhieuGanNhat\s*:/.test(src.util));
kiem('util dung LEFT JOIN chi tiet (phieu rong van duoc dem)',
     src.util.includes('LEFT JOIN PhieuNhapKhoHangChiTiet'),
     'JOIN thuong lam phieu khong co dong chi tiet bien mat => dem thieu so lan nhap');
kiem('util nhan SoLuongChinh (khong cong SoLuong tho)',
     src.util.includes('ct.SoLuongChinh') && !boComment(src.util).includes('SUM(ct.SoLuong)'),
     'cong SoLuong la cong so nguoi dung go, sai don vi');

console.log('\n=== 3. BACKEND nhapkho.js ===');
const nhapSach = boComment(src.nhap);
kiem('da bo bo loc NOT EXISTS(phieu) khoi cau SQL',
     !nhapSach.includes('NOT EXISTS (SELECT 1 FROM PhieuNhapKhoHang p'),
     'van con luat cu "co phieu la bien mat"');
/* 🔴 Cua so quet: ban dau toi doi TOP 300-sau-loc thanh TOP 500-truoc-loc => lenh xep hang 501 tro
   di khong bao gio vao duoc o chon du chua tung lap phieu. Phai KHONG CON `TOP` o cau lenh SX. */
kiem('cau lenh SX KHONG con TOP (cua so quet khong bi thu hep)',
     !/SELECT\s+TOP\s+\d+\s+d\.DonHangID/.test(nhapSach),
     'TOP dat TRUOC bo loc JS la thu hep cua so — lenh cu bien mat khoi o chon');
kiem('co ham locLenhChoPhieuNhap', nhapSach.includes('async function locLenhChoPhieuNhap'));
kiem('route /danhmuc tra donHang DA LOC',
     /donHang:\s*donHangLoc/.test(nhapSach),
     'van tra mang goc — loc viet ra ma khong ai dung');
kiem('dung luy ke KN tu qlsx (khong viet lai CTE)',
     nhapSach.includes("require('./qlsx').slKhoNhapTheoDon"),
     'chep lai CTE knTd/heCat la sai he so Ri lan thu 4');
/* Quet THEO DONG va bo dong bi comment bang `//` — chinh xac hon boComment() ma khong co rui ro
   nuot doan. Dong `// module.exports.slKhoNhapTheoDon = ...` phai bi coi la THIEU export. */
kiem('qlsx CO export slKhoNhapTheoDon',
     src.qlsx.split('\n').some(d => !/^\s*(\/\/|\*)/.test(d) && /module\.exports\.slKhoNhapTheoDon\s*=/.test(d)),
     'thieu export => require tra undefined => luon coi nhu 0 => khong an lenh nao');
kiem('ba dieu kien an lenh deu co mat (phieu + Hoan thanh + du so)',
     /soPhieu\s*>\s*0\s*&&\s*\(tt === 'Đã hủy' \|\| \(tt === 'Hoàn thành' && daDu\)\)/.test(nhapSach));
kiem('lenh ĐÃ HỦY van roi danh sach nhu luat cu',
     nhapSach.includes("tt === 'Đã hủy'"),
     'thieu => lenh da huy nam lai o chon VINH VIEN vi no khong bao gio Hoan thanh');
kiem('lenh cua phieu DANG SUA luon duoc giu',
     /id\s*!==\s*donDangSua/.test(nhapSach) && /if \(donDangSua && !coDonDangSua\)/.test(nhapSach),
     'thieu => mo form Sua thay o lenh SX rong, bam Luu la mat lien ket');
kiem('lui ve an toan khi lenh cu khong co luy ke KN',
     /canNhapCai\s*>\s*0\s*\?.*:\s*\(soPhieu\s*>\s*0\)/.test(nhapSach),
     'thieu => moi lenh cu dot nhien o lai danh sach vinh vien');
kiem('lam tron truoc khi so (so le vs INT)',
     nhapSach.includes('Math.round(Number((luyKeKN[id]') && nhapSach.includes('Math.round(Number(p.SLCai)'),
     'khong lam tron thi 119.99 >= 120 mai mai false');
/* Khong bat nguyen van ca cum console.error — format lai mot dong la do oan. Dem so lan catch
   trong than ham loc la du. */
kiem('moi loi doc deu co catch (hong nguon => KHONG an lenh nao)',
     (nhapSach.slice(nhapSach.indexOf('async function locLenhChoPhieuNhap'))
              .match(/catch\s*\(e\)/g) || []).length >= 4);
kiem('co require slNhapKhoChungTu', nhapSach.includes("require('../utils/slNhapKhoChungTu')"));
kiem('CHAN luu phieu SanXuat ma khong chon lenh (ca POST va PUT)',
     (nhapSach.match(/loai === 'SanXuat' && !b\.donHangId/g) || []).length >= 2,
     'thieu => phieu luu voi DonHangID NULL, am tham go phieu khoi lenh SX');

console.log('\n=== 4. FRONTEND module.nhapkho.js ===');
const feSach = boComment(src.fe);
kiem('co ham nhan() dung cac truong moi',
     feSach.includes('d2.CanNhapCai') && feSach.includes('d2.DaNhapCai') && feSach.includes('d2.NhapXong'));
kiem('nhan di qua escapeHtml', /escapeHtml\(nhan\(d2\)\)/.test(feSach),
     'MaDH/so phieu la du lieu nguoi dung go — phai escape');
kiem('khong bia "con thieu" khi lenh cu khong co luy ke KN',
     /can\s*>\s*0\s*\?/.test(feSach));
kiem('nhan o tich da doi nghia', src.fe.includes('Hiện cả lệnh SX đã nhập xong'),
     'con chu "hiện cả lệnh SX đã nhập kho" la noi sai viec o tich bay gio lam');
kiem('van giu duong nap lai khi tich o', feSach.includes('keCaDaNhap=1'));

console.log('\n=== 5. index.html ===');
kiem('module.nhapkho.js da bump ?v=9.09', src.html.includes('module.nhapkho.js?v=9.09'),
     'khong bump thi trinh duyet chay ban cu, sua xong van "khong thay gi doi"');

console.log('\n=== 6. BAY CU PHAP DA TUNG LAM SAP PRODUCTION ===');
// Backtick dat trong comment khoi TRAN nam ben trong template literal se dong chuoi => SyntaxError
// (da lam sap may chay that o v7.98 va v8.73). Phep 1 (vm.Script) bat duoc viec do roi; phep duoi
// day lo chuyen khac: byte NUL lot vao file nguon thi vo hinh, khong sua lai duoc bang mat thuong.
['util', 'nhap', 'fe'].forEach(k => {
  const d = src[k] || '';
  const coNul = d.includes('\u0000');
  kiem(F[k] + ' khong co byte NUL', !coNul, 'ky tu dieu khien vo hinh, sua lai rat kho');
});

console.log('\n' + '='.repeat(70));
console.log(sai === 0 ? `✅ ${dat} phep DAT, 0 sai` : `❌ ${sai} SAI / ${dat + sai} phep`);
console.log('='.repeat(70) + '\n');
process.exit(sai === 0 ? 0 : 1);
