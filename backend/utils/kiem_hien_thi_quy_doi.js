/* ================================================================================================
   KIEM CHUNG v7.74 — HIEN THI SO LUONG QUY DOI: BO CAP NGOAC
   ------------------------------------------------------------------------------------------------
   Nguyen: "ra lenh san xuat ban in lenh san xuat So luong 240 Ri (×5 = 1.200 Cai). bo dau ngoac di."
   Da hoi va chot: BO CAP NGOAC, GIU nguyen thong tin quy doi; ap cho MOI CHO (10 loi goi) de man
   hinh va to giay in khong lech nhau.

        Truoc:  240 Ri (×5 = 1.200 Cái)
        Nay:    240 Ri × 5 = 1.200 Cái

   Test CHAY THAT ham fmtQuyDoi() cat tu frontend/js/common.js — khong grep chuoi.

   Chay:  node utils/kiem_hien_thi_quy_doi.js
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

const sCommon = doc('../frontend/js/common.js');
const sQlsx = doc('../frontend/js/module.qlsx.js');
const sIndex = doc('../frontend/index.html');

function catHam(s, moc) {
  const i = s.indexOf(moc);
  if (i < 0) return '';
  let d = 0;
  for (let k = s.indexOf('{', i); k < s.length; k++) {
    if (s[k] === '{') d++;
    else if (s[k] === '}') { d--; if (!d) return s.slice(i, k + 1); }
  }
  return '';
}
const than = [catHam(sCommon, 'function fmtQuyDoi('), catHam(sCommon, 'function fmtNumber('),
  catHam(sCommon, 'function escapeHtml(')].join('\n');
kiem(!!catHam(sCommon, 'function fmtQuyDoi('), 'cat duoc ham fmtQuyDoi tu common.js');
const f = new Function(than + '\nreturn fmtQuyDoi;')();

console.log('\n=== 1. CHAY THAT: dung ca ca Nguyen neu ===');
bang(f(240, 5, 'Nhan', 'Ri', 'Cái'), '240 Ri × 5 = 1.200 Cái',
  'DUNG CA NGUYEN NEU: "240 Ri (×5 = 1.200 Cái)" -> bo cap ngoac');
kiem(!/[()]/.test(f(240, 5, 'Nhan', 'Ri', 'Cái')), 'khong con dau ngoac nao trong ket qua');
kiem(/1\.200 Cái/.test(f(240, 5, 'Nhan', 'Ri', 'Cái')),
  'VAN GIU thong tin quy doi (khong bo mat so cai) — dung lua chon Nguyen da chot');
kiem(/× 5/.test(f(240, 5, 'Nhan', 'Ri', 'Cái')), 'VAN GIU he so quy doi');

console.log('\n=== 2. Phep CHIA + cac canh khac ===');
bang(f(1200, 12, 'Chia', 'Cái', 'Bộ'), '1.200 Cái ÷ 12 = 100 Bộ', 'phep chia dung dau ÷');
bang(f(37, 5, 'Nhan', 'Ri', 'Cái'), '37 Ri × 5 = 185 Cái', 'so le van dung');
bang(f(2400, 5, 'Nhan', 'Ri', 'Cái'), '2.400 Ri × 5 = 12.000 Cái', 'so lon: dau phan cach nghin kieu Viet');
bang(f(0, 5, 'Nhan', 'Ri', 'Cái'), '0 Ri × 5 = 0 Cái', 'so 0 van hien day du');

console.log('\n=== 3. Khong quy doi thi CHI hien don vi chinh (giu nguyen hanh vi cu) ===');
bang(f(240, 1, 'Nhan', 'Ri', 'Cái'), '240 Ri', 'he so = 1 -> khong hien phan quy doi');
bang(f(240, 5, null, 'Ri', null), '240 Ri', 'chua khai don vi quy doi -> chi don vi chinh');
bang(f(240, 5, 'Nhan', 'Ri', ''), '240 Ri', 'don vi quy doi rong -> chi don vi chinh');
bang(f(240, 0, 'Nhan', 'Ri', 'Cái'), '240 Ri', 'he so 0 (chua khai) -> coi nhu 1, khong chia cho 0');
bang(f(null, 5, 'Nhan', 'Ri', 'Cái'), '0 Ri × 5 = 0 Cái', 'so luong null -> 0, khong ra NaN');
bang(f(240, 5, 'Nhan', null, 'Cái'), '240 Cái × 5 = 1.200 Cái', 'thieu don vi chinh -> mac dinh "Cái"');

console.log('\n=== 4. Van chan chen ma HTML (o nhap don vi la chu tu do) ===');
const xau = f(1, 2, 'Nhan', '<img src=x onerror=alert(1)>', 'Cái');
kiem(!/<img/.test(xau), 'ten don vi co ma HTML bi ma hoa, khong chen duoc vao trang', xau);

console.log('\n=== 5. Ap cho MOI CHO: 10 loi goi deu qua 1 ham ===');
const soLoiGoi = (sQlsx.match(/fmtQuyDoi\(/g) || []).length;
kiem(soLoiGoi >= 8, 'module.qlsx.js goi fmtQuyDoi o nhieu cho (ban in, form, danh sach, popup, so cat)',
  soLoiGoi + ' loi goi');
kiem(!/\(\$\{dauPhep\}/.test(sCommon), 'common.js: khong con ban dung chuoi co ngoac');
kiem(/\$\{fmtNumber\(n\)\} \$\{dvChinh\} \$\{dauPhep\} \$\{fmtNumber\(he\)\} = /.test(sCommon),
  'common.js: chuoi moi khong ngoac, co khoang trang hai ben dau phep cho de doc');
/* Khong con cho nao TU GHEP chuoi so luong quy doi (co thi sua 1 cho la lech kieu hien thi).
   ⚠️ Mau phai HEP: ban dau toi chan moi "(× " / "(÷ " nen bao SAI oan dong
       GIÁ THÀNH 1 SẢN PHẨM (÷ 240)
   — do la NHAN cua bang gia thanh (chia tong chi phi cho san luong), viec KHAC hoan toan, khong
   phai hien thi so luong quy doi. Nay chi chan mau "(<dau phep><bien>" tuc ghep thang so quy doi. */
kiem(!/\(×\$\{|\(÷\$\{/.test(sQlsx),
  'module.qlsx.js khong tu ghep chuoi SO LUONG quy doi co ngoac o cho nao khac');
kiem(/GIÁ THÀNH 1 SẢN PHẨM\$\{d\.slDungTinh > 0 \? ` \(÷ /.test(sQlsx),
  'ngoai le da biet: nhan "GIÁ THÀNH 1 SẢN PHẨM (÷ N)" cua bang gia thanh GIU NGUYEN ngoac');

console.log('\n=== 6. Bump ?v= ===');
const v = (sIndex.match(/common\.js\?v=([\d.]+)/) || [])[1];
kiem(v && parseFloat(v) >= 7.74, 'index.html: common.js?v= >= 7.74', String(v));

console.log('\n================================================================');
console.log(`KET QUA: ${dat} dat / ${truot} truot`);
process.exit(truot ? 1 : 0);
