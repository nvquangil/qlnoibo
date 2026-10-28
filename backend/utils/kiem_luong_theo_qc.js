/* ================================================================================================
   KIEM CHUNG v9.02 — MOI BANG LUONG THEO LENH SX CHI TINH LENH DA GHI QC
   ------------------------------------------------------------------------------------------------
   Nguyen 2026-10-24: "rà soát lại tất cả phần tính lương. Tất cả các lệnh sản xuất khi công đoạn QC
   ghi nhận tiến độ mới tính lương" + chot ky = thang MUON HON giua ngay ghi va ngay QC dau.

   BON BANG LUONG THEO LENH (luong cong nhat theo cham cong — khong lien quan):
     1. Khoan may          payroll.js loadLuongKhoanMay      — QC tu v8.61 (CROSS APPLY + loc qc.NgayQC)
     2. Gia cong / in theu utils/luongGiaCongInThe.js        — QC tu v8.61 (APPLY_NGAY_QC + dieuKienKy)
     3. La / Dong goi      payroll.js loadLuongLaDongGoi     — v9.02 (APPLY_NGAY_QC + bieuThucNgayKy)
     4. Trai vai cat       payroll.js loadSoDoCat            — v9.02 (APPLY_NGAY_QC + bieuThucNgayKy)
   Cong no nha gia cong (congno.js) dung util so 2 -> cung so voi bang luong.

   Chay:  node backend\utils\kiem_luong_theo_qc.js   (tu thu muc goc QLNoiBo)
   ================================================================================================ */
const fs = require('fs');
const path = require('path');
const G = path.join(__dirname, '..');
const doc = (p) => fs.readFileSync(path.join(G, p), 'utf8');

let dat = 0, truot = 0;
const OK = (m) => { dat++; console.log('  OK   ' + m); };
const NO = (m) => { truot++; console.log('  SAI  ' + m); };
const kiem = (dk, m) => (dk ? OK(m) : NO(m));

function catKhoi(s, moc, mo, dong) {
  const i = s.indexOf(moc);
  if (i < 0) return '';
  let d = 0;
  for (let k = s.indexOf(mo, i); k < s.length; k++) {
    if (s[k] === mo) d++;
    else if (s[k] === dong) { d--; if (!d) return s.slice(i, k + 1); }
  }
  return '';
}

const sPay = doc('routes/payroll.js');
const sUtil = doc('utils/luongGiaCongInThe.js');
const sCongNo = doc('routes/congno.js');
const sFe = doc('../frontend/js/module.payroll.js');
const sIndex = doc('../frontend/index.html');
const CO_QC = /MIN\(q\.NgayGhiNhan\) AS NgayQC/;

console.log('\n=== 1. util luongGiaCongInThe.js — nguon chung ===');
kiem(/const APPLY_NGAY_QC = \(bd\) => `\s*CROSS APPLY \(SELECT MIN\(q\.NgayGhiNhan\) AS NgayQC/.test(sUtil), 'APPLY_NGAY_QC: CROSS APPLY MIN(NgayGhiNhan) cua QC');
/* 🔴 Day la phep kiem QUAN TRONG NHAT cua v9.02. Ra soat chéo 2026-10-24: MIN() khong GROUP BY luon
   tra ve DUNG MOT dong (NULL khi khong co QC) -> CROSS APPLY tran KHONG loai dong nao. HAVING
   COUNT(*) > 0 moi that su loai. Bo dong nay la gate QC bien mat ma moi phep kiem khac van xanh. */
kiem(/\n\s*HAVING COUNT\(\*\) > 0\) qc`;/.test(sUtil),
  '🔴 APPLY_NGAY_QC co HAVING COUNT(*) > 0 — thu CHINH lam nen cong "chua QC thi loai"');
kiem(/const bieuThucNgayKy = \(cot\) => `CASE WHEN qc\.NgayQC > \$\{cot\} THEN qc\.NgayQC ELSE \$\{cot\} END`;/.test(sUtil), 'bieuThucNgayKy = ngay MUON HON giua ngay ghi va ngay QC');
kiem(/module\.exports = \{ loadGiaCong, loadInThe, tongHopTheoNha, APPLY_NGAY_QC, bieuThucNgayKy \};/.test(sUtil), 'export du APPLY_NGAY_QC + bieuThucNgayKy');
const fnGC = catKhoi(sUtil, 'async function loadGiaCong', '{', '}'), fnIT = catKhoi(sUtil, 'async function loadInThe', '{', '}');
kiem(/\$\{APPLY_NGAY_QC\('ct'\)\}/.test(fnGC) && /\$\{dieuKienKy\(null, ky\)\}/.test(fnGC), '2a. gia cong: APPLY QC + loc ky theo qc.NgayQC (v8.61 giu nguyen)');
kiem(/\$\{APPLY_NGAY_QC\('it'\)\}/.test(fnIT) && /\$\{dieuKienKy\(null, ky\)\}/.test(fnIT), '2b. in theu: APPLY QC + loc ky theo qc.NgayQC (v8.61 giu nguyen)');
kiem(/AND YEAR\(qc\.NgayQC\)=@n AND MONTH\(qc\.NgayQC\)=@t/.test(sUtil), 'dieuKienKy loc theo qc.NgayQC');
kiem(/require\('\.\.\/utils\/luongGiaCongInThe'\)/.test(sCongNo), 'congno.js dung cung util -> so cong no = so bang luong');
/* ⚠️ congno.js goi loadGiaCong(pool, sql) KHONG truyen ky -> truoc v9.02 khong co WHERE qc.NgayQC nao,
   nen van cong ca lenh chua QC (du ghi chu v8.61 noi da loai). Tu v9.02 HAVING loai that -> SO CONG NO
   NHA GIA CONG GIAM dung phan lenh chua QC. Phep kiem nay de nho rang day la thay doi CO CHU DICH. */
kiem(/loadGiaCong\(pool, sql\)/.test(sCongNo) && /loadInThe\(pool, sql\)/.test(sCongNo),
  'congno.js goi khong truyen ky (luy ke) — tu v9.02 lenh chua QC bi loai khoi so cong no');

console.log('\n=== 2. payroll.js — bon loader ===');
kiem(/const \{ loadGiaCong: __loadGiaCong, loadInThe: __loadInThe, tongHopTheoNha, APPLY_NGAY_QC, bieuThucNgayKy \} = require\('\.\.\/utils\/luongGiaCongInThe'\)/.test(sPay),
  'payroll.js import APPLY_NGAY_QC + bieuThucNgayKy tu util');
const fnMay = catKhoi(sPay, 'async function loadLuongKhoanMay', '{', '}');
kiem(/\$\{APPLY_NGAY_QC\('td'\)\}/.test(fnMay), '1. khoan may: dung CHUNG APPLY_NGAY_QC (khong con ban chep tay)');
kiem(/WHERE qc\.NgayQC IS NOT NULL/.test(fnMay), '1. khoan may: lenh chua QC bi loai (IS NOT NULL)');
kiem(/YEAR\(\$\{bieuThucNgayKy\('td\.NgayGhiNhan'\)\}\) = @n AND MONTH\(\$\{bieuThucNgayKy\('td\.NgayGhiNhan'\)\}\) = @t/.test(fnMay),
  '1. khoan may: ky = thang MUON HON (v9.02; truoc la thang QC thuan — sai khi ghi May sau dot QC dau)');
kiem(!/CROSS APPLY \(SELECT MIN\(q\.NgayGhiNhan\)/.test(fnMay), '1. khoan may: da bo ban CROSS APPLY chep tay');
const fnDG = catKhoi(sPay, 'async function loadLuongLaDongGoi', '{', '}');
kiem(/const ngayKy = bieuThucNgayKy\('td\.NgayGhiNhan'\);/.test(fnDG), '3. la/dong goi: ngayKy = bieuThucNgayKy(td.NgayGhiNhan)');
kiem(/\$\{APPLY_NGAY_QC\('td'\)\}/.test(fnDG), '3. la/dong goi: APPLY_NGAY_QC(td)');
kiem(/WHERE c\.MaCongDoan IN \('LA','DG'\) AND qc\.NgayQC IS NOT NULL/.test(fnDG), '3. la/dong goi: lenh chua QC bi loai (IS NOT NULL)');
kiem(/AND YEAR\(\$\{ngayKy\}\)=@n AND MONTH\(\$\{ngayKy\}\)=@t/.test(fnDG), '3. la/dong goi: loc ky theo ngayKy (khong con theo td.NgayGhiNhan tran)');
kiem(/qc\.NgayQC, \$\{ngayKy\} AS NgayKy/.test(fnDG), '3. la/dong goi: tra NgayQC + NgayKy cho man hinh');
kiem(!/YEAR\(td\.NgayGhiNhan\)=@n/.test(fnDG), '3. la/dong goi: KHONG con loc tran YEAR(td.NgayGhiNhan)');
const fnCat = catKhoi(sPay, 'async function loadSoDoCat', '{', '}');
kiem(/const ngayKy = bieuThucNgayKy\('td\.NgayGhiNhan'\);/.test(fnCat), '4. trai vai cat: ngayKy = bieuThucNgayKy(td.NgayGhiNhan)');
kiem(/\$\{APPLY_NGAY_QC\('td'\)\}/.test(fnCat), '4. trai vai cat: APPLY_NGAY_QC(td)');
kiem(/WHERE c\.MaCongDoan = 'CAT' AND qc\.NgayQC IS NOT NULL/.test(fnCat), '4. trai vai cat: so cat cua lenh chua QC khong vao quy (IS NOT NULL)');
kiem(/AND YEAR\(\$\{ngayKy\}\)=@n AND MONTH\(\$\{ngayKy\}\)=@t/.test(fnCat), '4. trai vai cat: loc ky theo ngayKy');
kiem(/qc\.NgayQC, \$\{ngayKy\} AS NgayKy/.test(fnCat), '4. trai vai cat: tra NgayQC + NgayKy');
kiem(!/YEAR\(td\.NgayGhiNhan\)=@n/.test(fnCat), '4. trai vai cat: KHONG con loc tran YEAR(td.NgayGhiNhan)');
const fnTH = catKhoi(sPay, 'function tongHopLuongCat', '{', '}');
kiem(/NgayQC: s\.NgayQC \|\| null/.test(fnTH), '4. tongHopLuongCat: moi lenh mang NgayQC');
/* Gio cong chia quy van theo thang (co y — xem ghi chu loadSoDoCat). */
const fnGio = catKhoi(sPay, 'async function loadGioCongCat', '{', '}');
kiem(/YEAR\(cc\.Ngay\)=@n AND MONTH\(cc\.Ngay\)=@t/.test(fnGio), '4. gio cong cat van theo thang cham cong (co y)');
/* Khong con loader nao theo lenh ma loc tran theo NgayGhiNhan: dem so lan "YEAR(td.NgayGhiNhan)" trong ca file. */
kiem((sPay.match(/YEAR\(td\.NgayGhiNhan\)/g) || []).length === 0, 'payroll.js: khong con cho nao loc tran YEAR(td.NgayGhiNhan)');

console.log('\n=== 3. frontend module.payroll.js ===');
const fnLDG = catKhoi(sFe, 'async function renderLuongLaDongGoi', '{', '}');
kiem(/<th>Ngày<\/th><th>Ngày QC<\/th>/.test(fnLDG) && /\$\{fmtDate\(r\.NgayQC\)\}/.test(fnLDG), 'la/dong goi: bang chi tiet co cot Ngay QC');
kiem(/colspan="12" class="empty-hint"/.test(fnLDG), 'la/dong goi: dong rong colspan 12 (= so cot)');
kiem(/Chỉ tính lệnh đã ghi tiến độ QC/.test(fnLDG), 'la/dong goi: ghi chu noi ro dieu kien QC');
const fnLDGIn = catKhoi(sFe, 'function buildLaDgBody', '{', '}');
kiem(/<th>Ngày QC<\/th>/.test(fnLDGIn) && /colspan="12"/.test(fnLDGIn) && /<td colspan="10" style="text-align:right;">TỔNG<\/td>/.test(fnLDGIn), 'la/dong goi: ban in ca bang 12 cot, TONG colspan 10');
const fnLDGNV = catKhoi(sFe, 'function buildLaDgNVBody', '{', '}');
kiem(/<th>Ngày QC<\/th>/.test(fnLDGNV) && /colspan="10" style="text-align:center;"/.test(fnLDGNV) && /<td colspan="8" style="text-align:right;">TỔNG<\/td>/.test(fnLDGNV), 'la/dong goi: phieu luong NV 10 cot, TONG colspan 8');
const fnCatUI = catKhoi(sFe, 'async function renderLuongTraiVaiCat', '{', '}');
kiem(/<th>Tên sản phẩm<\/th><th>Ngày QC<\/th>/.test(fnCatUI) && /\$\{fmtDate\(o\.NgayQC\)\}/.test(fnCatUI), 'trai vai cat: bang theo lenh co cot Ngay QC');
kiem(/colspan="8" class="empty-hint"/.test(fnCatUI) && /<td colspan="4" style="text-align:right;">TỔNG BÀN CẮT<\/td>/.test(fnCatUI), 'trai vai cat: dong rong colspan 8, tfoot TONG colspan 4 (8 cot)');
kiem(/Chỉ tính sổ cắt của lệnh đã ghi tiến độ QC/.test(fnCatUI), 'trai vai cat: ghi chu noi ro dieu kien QC');
const fnQuy = catKhoi(sFe, 'function buildLuongCatQuyBody', '{', '}');
kiem(/<th>Ngày cắt<\/th><th>Ngày QC<\/th>/.test(fnQuy) && /<td colspan="7">Lệnh SX/.test(fnQuy) && /colspan="9" style="text-align:center;"/.test(fnQuy) && /<td colspan="6" style="text-align:right;">TỔNG BÀN CẮT:/.test(fnQuy),
  'trai vai cat: ban in quy 9 cot (dong lenh colspan 7, rong 9, TONG colspan 6)');
const fnDon = catKhoi(sFe, 'function openLuongCatDonDetail', '{', '}');
kiem(/<th>Ngày cắt<\/th><th>Ngày QC<\/th>/.test(fnDon) && /<td colspan="10" style="text-align:right;">TỔNG<\/td>/.test(fnDon), 'trai vai cat: chi tiet lenh 12 cot, TONG colspan 10');
/* v9.02 sua kem 4 loi colspan/STT CO TU TRUOC (ra soat chéo chi ra). Giu phep kiem de khong ai lui lai. */
kiem(/<tr data-tong style="background:#f1f3f4;font-weight:600;"><td><\/td><td colspan="7">Lệnh SX/.test(fnQuy),
  'trai vai cat: dong tieu de lenh co data-tong (khong bi danhLaiStt danh so de len STT so do)');
kiem(/colspan="5" class="empty-hint">Chưa có dữ liệu là\/đóng gói/.test(fnLDG), 'la/dong goi: dong rong bang tong hop colspan 5 (= 5 cot)');
kiem(/colspan="7" class="empty-hint">Chưa có nhân viên bộ phận Cắt/.test(fnCatUI), 'trai vai cat: dong rong bang NV colspan 7 (= 7 cot)');
const fnBang = catKhoi(sFe, 'function buildLuongCatBangBody', '{', '}');
kiem(/colspan="7" style="text-align:center;">—/.test(fnBang), 'trai vai cat: ban in bang luong dong rong colspan 7');
// Bay v8.06: comment kieu "dollar-ngoac-nhon + comment khoi + chuoi rong" dat NGOAI template literal
// = SyntaxError. Kiem tho: dong bat dau bang khoang trang roi dollar-ngoac-nhon-slash-sao ma dong
// TRUOC no ket thuc bang ";" thi gan nhu chac chan dang nam ngoai template literal.
const dongFe = sFe.split('\n');
let loiNgoai = [];
dongFe.forEach((d, i) => {
  if (/^\s*\$\{\/\*/.test(d) && i > 0 && /;\s*$/.test(dongFe[i - 1])) loiNgoai.push(i + 1);
});
kiem(loiNgoai.length === 0, 'khong co comment-trong-template dung ngay sau dong ket thuc bang ";" (bay v8.06)' + (loiNgoai.length ? '  -> dong ' + loiNgoai.join(', ') : ''));
const vPay = parseFloat((sIndex.match(/module\.payroll\.js\?v=([\d.]+)/) || [])[1] || 0);
kiem(vPay >= 9.02, `index.html: module.payroll.js?v= >= 9.02  [duoc: ${vPay}]`);

console.log('\n=== 4. file kiem tra du lieu ===');
kiem(fs.existsSync(path.join(G, '../database/kiem_tra_v902_luong_theo_qc.sql')), 'database/kiem_tra_v902_luong_theo_qc.sql co san (tien to kiem_tra_ — khong bi gop vao CAI_DAT_DAY_DU)');

console.log(`\n=== KET QUA: ${dat} dat, ${truot} sai ===`);
process.exit(truot ? 1 : 0);
