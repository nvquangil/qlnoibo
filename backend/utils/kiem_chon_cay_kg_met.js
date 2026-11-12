/* ================================================================================================
   kiem_chon_cay_kg_met.js  —  bo tu kiem cho v9.24
   "Cong doan Cat, o chon cay: hien them SO KG va SO MET, dang chi co ma cay".

   Chay:  node backend\utils\kiem_chon_cay_kg_met.js
   KHONG copy file nay sang D:\QLSX.
   ================================================================================================ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const GOC = path.join(__dirname, '..', '..');
const be = fs.readFileSync(path.join(GOC, 'backend', 'routes', 'qlsx.js'), 'utf8');
const fe = fs.readFileSync(path.join(GOC, 'frontend', 'js', 'module.qlsx.js'), 'utf8');
const html = fs.readFileSync(path.join(GOC, 'frontend', 'index.html'), 'utf8');
let sai = 0, dat = 0;
const kiem = (ten, dung, td) => dung
  ? (dat++, console.log('  ✓ ' + ten))
  : (sai++, console.log('  ❌ ' + ten + (td ? ' — ' + td : '')));

console.log('\n=== 1. BIEN DICH ===');
[['backend/routes/qlsx.js', be], ['frontend/js/module.qlsx.js', fe]].forEach(([f, s]) => {
  try { new vm.Script(s, { filename: f }); dat++; console.log('  ✓ ' + f); }
  catch (e) { sai++; console.log('  ❌ ' + f + ' VO CU PHAP: ' + e.message); }
});

console.log('\n=== 2. BACKEND tra SO MET kem SO KG ===');
/* 🔴 Phai lay met cua CHINH DONG phieu xuat (ct.SoMet — cung cap voi ct.KGXuat), KHONG phai met luc
   NHAP ca cay (vc.SoMet). Lay nham la o chon cay khoe "da xuat 25 KG · 300 m" trong khi ca cay nhap
   300 m moi cap 60 m — nguoi cat tuong con thua vai. */
kiem('getVaiCayDaXuatChoDon tra MetGiao = ct.SoMet (met DA XUAT cua dong phieu)',
     /ct\.SoMet AS MetGiao/.test(be),
     'ct.SoMet di cap voi ct.KGXuat AS KGGiao — cung mot dong phieu xuat');
kiem('🔴 KHONG lay vc.SoMet (met luc NHAP ca cay) lam so da cap',
     !/vc\.SoMet/.test(be),
     'cay nhap 300 m moi cap 60 m ma hien 300 la nguoi cat tuong con thua vai');
kiem('khong doi ten cot cu (KGGiao/MaCay/KGNhap… con nguyen)',
     /ct\.KGXuat AS KGGiao/.test(be) && /vc\.MaCay, vc\.KGNhap/.test(be),
     'frontend doc cac ten nay o nhieu cho — doi la vo am tham');

console.log('\n=== 3. FRONTEND: MOT ham dung chung cho CA HAI o chon cay ===');
const than = (() => {
  const i = fe.indexOf('function soKgMet(kg, met)');
  if (i < 0) return null;
  let mo = 0, j = fe.indexOf('{', i);
  for (; j < fe.length; j++) {
    if (fe[j] === '{') mo++;
    else if (fe[j] === '}') { mo--; if (!mo) return fe.slice(i, j + 1); }
  }
  return null;
})();
kiem('co ham soKgMet o MUC MODULE (dung chung, khong viet hai ban)', !!than);
kiem('ca Ghi tien do Cat LAN Sua so cat deu goi soKgMet',
     (fe.match(/soKgMet\(/g) || []).length >= 3,
     '1 dinh nghia + 2 noi goi; thieu mot ben la hai man noi hai kieu');

if (than) {
  const chay = (kg, met) => {
    const s = { fmtNumber: (n) => String(n) };
    vm.runInNewContext(`${than}; __r = soKgMet(${JSON.stringify(kg)}, ${JSON.stringify(met)});`, s);
    return s.__r;
  };
  kiem('ca hai co -> "25 KG · 60 m"', chay(25, 60) === '25 KG · 60 m', 'duoc ' + chay(25, 60));
  kiem('chi co KG (cay quan theo kg) -> khong in chu met thua', chay(25, null) === '25 KG', 'duoc ' + chay(25, null));
  kiem('chi co met -> "60 m"', chay(0, 60) === '60 m', 'duoc ' + chay(0, 60));
  kiem('ca hai trong/am -> chuoi rong (noi goi tu quyet dinh in gi)',
       chay(0, 0) === '' && chay(null, undefined) === '' && chay(-5, 0) === '',
       'so am/0 ma van in ra la nhan noi doi');
}

console.log('\n=== 4. FRONTEND: nhan cua tung o ===');
kiem('o chon cay o Ghi tien do Cat: ma cay + loai + mau + (da xuat KG · m, ngay)',
     /const so = soKgMet\(r\.KGGiao, r\.MetGiao\);/.test(fe)
       && /\(đã xuất \$\{so \|\| '—'\}\$\{ngay\}\)/.test(fe),
     'so trong phai ra dau gach, khong duoc ra "da xuat  ," cut ngang');
kiem('o chon cay o SUA SO CAT cung co KG · m',
     /const so = soKgMet\(c\.KGGiao, c\.MetGiao\);/.test(fe)
       && /\(so \? ` — đã xuất \$\{so\}` : ''\)/.test(fe));
console.log('\n=== 4b. 🔴 HAI MAN PHAI NOI CUNG MOT SO (ra soat cheo bat duoc) ===');
/* Ghi tien do Cat va Sua so cat cung doc detail.giaoVai. Mot cay xuat qua NHIEU phieu ma chi mot ben
   gom thi hai man in hai con so cho cung mot cay — dung ham CHUNG, dung viet hai ban. */
kiem('co ham gom dung chung gomCayDaXuat()', /function gomCayDaXuat\(ds\)/.test(fe));
kiem('CA HAI man deu goi gomCayDaXuat (Ghi tien do Cat + Sua so cat)',
     /let giaoVaiList = gomCayDaXuat\(detail\.giaoVai\);/.test(fe)
       && /const dsCay = gomCayDaXuat\(det\.giaoVai\);/.test(fe),
     'mot ben gom mot ben khong = hai man noi hai so cho cung mot cay');
kiem('gom = CONG DON KG/met, khong lay moi dong dau',
     /cu\.KGGiao \+= kg; cu\.MetGiao \+= met; cu\.SoPhieu\+\+;/.test(fe));
kiem('🔴 tra BAN SAO, khong sua vao detail.giaoVai goc',
     /out\.push\(Object\.assign\(\{\}, c, \{ KGGiao: kg, MetGiao: met/.test(fe),
     'man khac doc chung mang do — sua tai cho la so o man kia nhan doi sau moi lan mo form');
kiem('dong da gop KHONG in mot ngay le (NgayDau–NgayCuoi)',
     /function chuoiNgayXuat\(c\)/.test(fe) && !/fmtDate\(r\.NgayGiao\)/.test(fe),
     'gop 2 phieu ma in ngay cua phieu dau la noi doi');

/* Chay THAT ham gom tren mot ca co that: CAY-01 xuat 2 phieu, CAY-02 xuat 1 phieu. */
const thanGom = (() => {
  const i = fe.indexOf('function gomCayDaXuat(ds)');
  if (i < 0) return null;
  let mo = 0, j = fe.indexOf('{', i);
  for (; j < fe.length; j++) {
    if (fe[j] === '{') mo++;
    else if (fe[j] === '}') { mo--; if (!mo) return fe.slice(i, j + 1); }
  }
  return null;
})();
if (thanGom) {
  const goc = [
    { CayID: 1, MaCay: 'CAY-01', KGGiao: 25, MetGiao: 60, NgayGiao: '2026-10-12' },
    { CayID: 1, MaCay: 'CAY-01', KGGiao: 10, MetGiao: 24, NgayGiao: '2026-10-20' },
    { CayID: 2, MaCay: 'CAY-02', KGGiao: 8, MetGiao: null, NgayGiao: '2026-10-12' }
  ];
  const s = { __goc: JSON.parse(JSON.stringify(goc)) };
  vm.runInNewContext(`${thanGom}; __r = gomCayDaXuat(__goc);`, s);
  const r = s.__r;
  kiem('gom: 3 dong phieu -> 2 cay', Array.isArray(r) && r.length === 2, 'duoc ' + JSON.stringify(r));
  kiem('gom: CAY-01 cong don 35 KG / 84 m / 2 phieu',
       r && r[0].KGGiao === 35 && r[0].MetGiao === 84 && r[0].SoPhieu === 2, JSON.stringify(r && r[0]));
  kiem('gom: khoang ngay 2026-10-12 → 2026-10-20',
       r && r[0].NgayDau === '2026-10-12' && r[0].NgayCuoi === '2026-10-20');
  kiem('gom: met trong -> 0, khong thanh NaN', r && r[1].MetGiao === 0);
  kiem('🔴 gom: KHONG sua mang goc',
       JSON.stringify(s.__goc) === JSON.stringify(goc), 'mang goc da bi sua tai cho');
  kiem('gom: list rong / null -> mang rong, khong no',
       (() => { const t = {}; vm.runInNewContext(`${thanGom}; __a = gomCayDaXuat(null).length; __b = gomCayDaXuat([]).length;`, t);
                return t.__a === 0 && t.__b === 0; })());
}

console.log('\n=== 4c. O CHON CAY: html va wire PHAI cung labelFn + cung list ===');
/* Lech nhau thi gia tri da chon hien ra mot kieu, luc resolve lai so bang kieu khac => o nhap do
   "ss-invalid" va CayID ve rong ma khong noi gi. */
kiem('catpick_: ca hai loi goi dung labelForGiaoVai',
     (fe.match(/'catpick_' \+ (?:idx|rowEl\.dataset\.idx)[\s\S]{0,120}?labelForGiaoVai/g) || []).length >= 2);
kiem('sscay_: ca hai loi goi dung nhanApp',
     (fe.match(/'sscay_' \+ (?:idx|r\.dataset\.idx)[\s\S]{0,80}?nhanApp/g) || []).length >= 2);

console.log('\n=== 5. BUMP ===');
kiem('index.html bump module.qlsx.js?v >= 9.24', (() => {
  const m = html.match(/module\.qlsx\.js\?v=([\d.]+)/);
  return !!m && parseFloat(m[1]) >= 9.24;
})(), 'khong bump la may dang mo van chay ban cu, nhan khong doi');

console.log('\n' + '='.repeat(70));
console.log(sai === 0 ? `✅ ${dat} phep DAT, 0 sai` : `❌ ${sai} SAI / ${dat + sai} phep`);
console.log('='.repeat(70) + '\n');
process.exit(sai === 0 ? 0 : 1);
