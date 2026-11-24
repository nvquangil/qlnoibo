/* ================================================================================================
   kiem_bao_gia_gia_sau_thue.js  —  bo tu kiem cho v9.16
   "Bao gia Aloha: GIA BAN la gia SAU THUE (bo CK shop), chia nguoc ra gia truoc thue.
    + nut Chon tat ca / Bo chon (dong dang hien) o form tao/sua bao gia."

   Vi du so Nguyen chot (2026-11-04): Gia ban 100.000, VAT 8% => Sau VAT 100.000, Truoc VAT 92.593.
   Chay:  node backend\utils\kiem_bao_gia_gia_sau_thue.js
   KHONG copy file nay sang D:\QLSX.
   ================================================================================================ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const GOC = path.join(__dirname, '..', '..');
const beSrc = fs.readFileSync(path.join(GOC, 'backend', 'routes', 'khohang.js'), 'utf8');
const feSrc = fs.readFileSync(path.join(GOC, 'frontend', 'js', 'module.khohang.js'), 'utf8');
const html = fs.readFileSync(path.join(GOC, 'frontend', 'index.html'), 'utf8');
let sai = 0, dat = 0;
function kiem(ten, dung, td) {
  if (dung) { dat++; console.log('  ✓ ' + ten); }
  else { sai++; console.log('  ❌ ' + ten + (td ? ' — ' + td : '')); }
}

console.log('\n=== 1. BIEN DICH (thay cho node --check) ===');
[['backend/routes/khohang.js', beSrc], ['frontend/js/module.khohang.js', feSrc]].forEach(([f, s]) => {
  try { new vm.Script(s, { filename: f }); dat++; console.log('  ✓ ' + f); }
  catch (e) { sai++; console.log('  ❌ ' + f + ' VO CU PHAP: ' + e.message); }
});

console.log('\n=== 2. KIEM HANH VI baoGiaSauVat / baoGiaTruocVat (trich ham, chay that) ===');
function trichHam(nguon, ten) {
  const i = nguon.indexOf('function ' + ten + '(');
  if (i < 0) return null;
  let mo = 0, j = nguon.indexOf('{', i);
  if (j < 0) return null;
  for (; j < nguon.length; j++) {
    if (nguon[j] === '{') mo++;
    else if (nguon[j] === '}') { mo--; if (mo === 0) return nguon.slice(i, j + 1); }
  }
  return null;
}
const thanSau = trichHam(feSrc, 'baoGiaSauVat');
const thanTruoc = trichHam(feSrc, 'baoGiaTruocVat');
kiem('tim thay ca hai ham', !!thanSau && !!thanTruoc);
if (thanSau && thanTruoc) {
  let sauVat = null, truocVat = null;
  try {
    const s = {};
    vm.runInNewContext(thanSau + ';' + thanTruoc + '; __s = baoGiaSauVat; __t = baoGiaTruocVat;', s);
    sauVat = s.__s; truocVat = s.__t;
  } catch (e) { sai++; console.log('  ❌ khong nap duoc ham: ' + e.message); }
  if (sauVat && truocVat) {
    const gan = (a, b) => a != null && Math.abs(a - b) < 1e-6;
    const CA = [
      ['vi du chot: 100.000 VAT 8% -> SAU thue = 100.000 (khong nhan len 108.000 nua)',
        () => gan(sauVat({ GiaAloha: 100000, PhanTramVAT: 0.08 }), 100000)],
      ['vi du chot: 100.000 VAT 8% -> TRUOC thue lam tron = 92.593',
        () => Math.round(truocVat({ GiaAloha: 100000, PhanTramVAT: 0.08 })) === 92593],
      ['nghich dao dung: truoc x (1+VAT) tra lai dung gia ban',
        () => gan(truocVat({ GiaAloha: 100000, PhanTramVAT: 0.08 }) * 1.08, 100000)],
      ['VAT 10%: 110.000 -> truoc thue 100.000 chan',
        () => gan(truocVat({ GiaAloha: 110000, PhanTramVAT: 0.1 }), 100000)],
      ['VAT 0 / null: truoc = sau = gia ban (khong chia 0, khong NaN)',
        () => gan(truocVat({ GiaAloha: 50000, PhanTramVAT: 0 }), 50000)
           && gan(truocVat({ GiaAloha: 50000, PhanTramVAT: null }), 50000)],
      ['GiaAloha null -> ca hai tra null (o trong, khong ra 0)',
        () => sauVat({ GiaAloha: null, PhanTramVAT: 0.08 }) === null
           && truocVat({ GiaAloha: null, PhanTramVAT: 0.08 }) === null]
    ];
    CA.forEach(([ten, phep]) => { let ok = false; try { ok = phep(); } catch (e) { ok = false; } kiem(ten, ok); });
  }
}

console.log('\n=== 3. BACKEND khop cung chieu (Excel /baogia/:id/export) ===');
kiem('SQL_GIA_ALOHA = GiaBan tho (het CK shop trong SQL)',
     /const SQL_GIA_ALOHA = 'h\.GiaBan AS GiaAloha';/.test(beSrc));
kiem('khong con LOI GOI .input(ckShop) nao (3 route bao gia da go)',
     !/\.input\('ckShop', sql\.Decimal/.test(beSrc),
     'con mot route truyen tham so chet la nguoi sau tuong SQL van dung @ckShop');
kiem('Excel: Sau VAT = GiaAloha tho',
     /const sauVat = it\.GiaAloha != null \? Number\(it\.GiaAloha\) : null;/.test(beSrc));
kiem('Excel: Truoc VAT = sauVat CHIA (1+vat) — cung chieu voi frontend',
     /const giaTruocVat = sauVat != null \? sauVat \/ \(1 \+ vat\) : null;/.test(beSrc));
kiem('het chieu NHAN cua v8.37 trong code export',
     !/giaTruocVat \* \(1 \+ vat\)/.test(beSrc));

console.log('\n=== 4. FORM TAO/SUA: chon tat ca / bo chon (dong dang hien) ===');
kiem('co du HAI nut, deu type="button" (nut tran trong form la submit — bam chon tat ca ma luu luon la hong)',
     /<button type="button" class="btn small secondary" id="bgChonHet">/.test(feSrc)
       && /<button type="button" class="btn small secondary" id="bgBoChonHet">/.test(feSrc));
kiem('chi tac dong dong DANG HIEN (ton trong bo loc — luat cmChonHet v8.24)',
     /function datChonDongDangHien\(chon\) \{[\s\S]{0,300}?display === 'none'\) return;/.test(feSrc));
kiem('tu bat/tat o %VAT theo trang thai tich (set .checked khong ban su kien change)',
     /row\.querySelector\('\.bg-vat'\)\.disabled = !chon;/.test(feSrc));
kiem('goi lai apDungLoc() de dong dem "da tich dang bi an" cap nhat',
     /datChonDongDangHien\(chon\) \{[\s\S]{0,400}?apDungLoc\(\);\s*\}/.test(feSrc));
kiem('hai nut co handler', /#bgChonHet'\)\.addEventListener\('click'/.test(feSrc)
       && /#bgBoChonHet'\)\.addEventListener\('click'/.test(feSrc));

console.log('\n=== 5. NHAN + BUMP ===');
kiem('nhan o chon ma doi thanh "(giá bán: …)" — het nhan "(sau CK: …)" cu',
     feSrc.includes('(giá bán: ') && !feSrc.includes('(sau CK: '));
// >= chu khong phai ==: ban sau bump tiep la do oan (14/11 chay kiem_tat_ca thay 4 bo cung loi nay).
kiem('index.html bump module.khohang.js?v >= 9.16', (() => { const m = /module\.khohang\.js\?v=([\d.]+)/.exec(html); return !!m && parseFloat(m[1]) >= 9.16; })());

console.log('\n' + '='.repeat(70));
console.log(sai === 0 ? `✅ ${dat} phep DAT, 0 sai` : `❌ ${sai} SAI / ${dat + sai} phep`);
console.log('='.repeat(70) + '\n');
process.exit(sai === 0 ? 0 : 1);
