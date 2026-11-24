/* ================================================================================================
   kiem_co_gui_mau_so_cong_no.js  —  bo tu kiem cho v9.10
   "So cong no + so chi tiet cong no: dong phieu GUI MAU phai co co, o CA 4 dau ra."

   Bon dau ra: (1) bang tren man hinh, (2) BAN IN so tong hop, (3) so chi tiet (xem + in),
               (4) hai ban Excel (so tong hop, so ke toan).

   Chay:  node backend\utils\kiem_co_gui_mau_so_cong_no.js
   KHONG copy file nay sang D:\QLSX.
   ================================================================================================ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const GOC = path.join(__dirname, '..', '..');
const F = {
  be:   'backend/routes/congno.js',
  fe:   'frontend/js/module.congno.js',
  html: 'frontend/index.html'
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

console.log('\n=== 1. BIEN DICH (thay cho node --check) ===');
['be', 'fe'].forEach(k => {
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

/* Bo COMMENT truoc moi phep so chuoi tren backend — chinh cai comment giai thich tinh nang lai
   lam phep kiem bao OK oan (da vap 3 lan trong kiem_ho_so_nhan_su.js). */
function boComment(s) {
  return String(s || '')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[\s{(:;,=])\/\/[^\n]*/g, '$1 ');
}

console.log('\n=== 2. BACKEND — KHONG duoc lam ROT LaHangMau o cac cho MAP LAI ===');
const beSach = boComment(src.be);
/* soChiTietKH() da tra ve LaHangMau tu v7.59. Moi ham map lai tung field deu phai mang theo no,
   neu khong la dung lai loi cu: man hinh co nhan ma ban in / Excel thi khong. */
kiem('soChiTietKH van SELECT LaHangMau',
     /AS LaHangMau/.test(beSach),
     'mat goc du lieu thi moi dau ra deu khong co co');
kiem('duLieuSoKeToan giu LaHangMau',
     /LaHangMau:\s*Number\(r\.LaHangMau\)\s*===\s*1\s*\?\s*1\s*:\s*0/.test(beSach),
     'so chi tiet (xem + in) se khong co nhan');
/* Soi TRONG THAN ham soDoiTac2Chieu, khong dem toan file: xoa dong o day ma them mot cho khac bat
   ky van lam phep dem toan file di qua. */
const thanDT2C = beSach.slice(beSach.indexOf('async function soDoiTac2Chieu'),
                              beSach.indexOf('async function soDoiTac2Chieu') + 3000);
kiem('soDoiTac2Chieu giu LaHangMau',
     /LaHangMau:\s*Number\(r\.LaHangMau\)/.test(thanDT2C),
     'so 2 chieu (khach dong thoi la NCC) se khong co nhan');
kiem('Excel so ke toan ghi [Gửi mẫu] vao Dien giai',
     beSach.includes("'[Gửi mẫu] '"),
     'Excel khong co badge — phai ghi thang chu');
kiem('Excel so tong hop ghi (Gửi mẫu) vao cot Loai',
     beSach.includes("' (Gửi mẫu)'"),
     'phai dat CUNG CHO voi ban in (cot Loai) de hai ban doc giong nhau');
kiem('Excel so 2 chieu cung ghi (Gửi mẫu)',
     (beSach.match(/\(Gửi mẫu\)/g) || []).length >= 2,
     'ban in so 2 chieu co nhan ma Excel khong — hai ban doc lech nhau');

console.log('\n=== 3. FRONTEND — MOT ham nhan, BON noi goi ===');
kiem('co ham nhanGuiMau', /const nhanGuiMau\s*=/.test(src.fe));
/* Ban in: trinh duyet mac dinh TAT in nen => chi to nen vang la in ra trang tron.
   Nhan bat buoc phai co VIEN + CHU. */
kiem('nhan co VIEN dam (in den trang van doc duoc)',
     /border:1px solid #ad6800/.test(src.fe),
     'vien nhat #ffd591 in ra gan nhu khong thay');
kiem('nhan co print-color-adjust', src.fe.includes('print-color-adjust:exact'));
/* ⚠️ Nguon that la  escapeHtml(r.Loai)}${nhanGuiMau(r)}  — co dau } DONG substitution o giua.
   Ban dau toi viet thieu dau } do nen phep nay bao DO OAN. Ra soat cheo bat duoc. */
kiem('bang man hinh dung ham chung',
     /escapeHtml\(r\.Loai\)\}\$\{nhanGuiMau\(r\)\}/.test(src.fe),
     'con badge viet tay rieng => sua mot noi quen noi kia');
kiem('BAN IN so tong hop (COT_SO_1CHIEU) co nhan',
     /nhan: 'Loại', o: r => escapeHtml\(r\.Loai \|\| ''\) \+ nhanGuiMau\(r\)/.test(src.fe),
     'day la ban khach KY — thieu la hong muc dich cua ca ban nay');
kiem('BAN IN so 2 chieu (COT_SO_2CHIEU) co nhan',
     /nhan: 'Loại chứng từ', o: r => escapeHtml\(r\.Loai \|\| ''\) \+ nhanGuiMau\(r\)/.test(src.fe));
kiem('SO CHI TIET (soKeToanHtml) co nhan o cot Dien giai',
     /escapeHtml\(r\.DienGiai \|\| ''\)\}\$\{nhanGuiMau\(r\)\}/.test(src.fe));
kiem('nhanGuiMau khai TRUOC inSoCongNo',
     src.fe.indexOf('const nhanGuiMau') > 0
       && src.fe.indexOf('const nhanGuiMau') < src.fe.indexOf('function inSoCongNo'));

console.log('\n=== 4. BAY CU PHAP DA LAM SAP PRODUCTION ===');
/* Toi da vap CA HAI bay nay trong chinh ban v9.10 nay, bo kiem bat lai:
   - dau-do-la + ngoac-nhon + comment dat o vi tri CAU LENH (ngoai template literal) = SyntaxError (v8.06)
   - cap dong comment nam BEN TRONG mot comment khac = cat comment som (v8.61)
   🔴 DUNG VIET PHEP REGEX CHO HAI BAY NAY. Toi co viet, va CA HAI deu BAO DO OAN (ra soat cheo bat
   duoc) nen ca bo kiem luon that bai — tuc la mat han luoi an toan:
     - Bay (1): ben TRONG mot template literal, dong mo dau bang dau-do-la + ngoac-nhon + mo-comment
       la HOP LE, va file nay co hang chuc dong nhu the. Regex khong the biet dang o trong hay ngoai
       template literal; muon biet phai PHAN TICH CU PHAP — dung viec ma vm.Script lam.
     - Bay (2): regex toi viet co luong tu lam dau gach cheo nguoc thanh "khong hoac nhieu", nen no
       khop MOI block comment co chua dau gach cheo (vd "khach hang / nha cung cap").
   Phep o MUC 1 (vm.Script) bat duoc CA HAI bay — do moi la phep dung. Giu ghi chu nay de lan sau
   khong ai viet lai hai phep regex do. */
['be', 'fe'].forEach(k => kiem(F[k] + ' khong co byte NUL', !(src[k] || '').includes('\u0000')));

console.log('\n=== 5. index.html ===');
kiem('module.congno.js da bump ?v >= 9.10', (() => { const m = /module\.congno\.js\?v=([\d.]+)/.exec(src.html); return !!m && parseFloat(m[1]) >= 9.10; })(),
     'khong bump thi trinh duyet chay ban cu');

console.log('\n' + '='.repeat(70));
console.log(sai === 0 ? `✅ ${dat} phep DAT, 0 sai` : `❌ ${sai} SAI / ${dat + sai} phep`);
console.log('='.repeat(70) + '\n');
process.exit(sai === 0 ? 0 : 1);
