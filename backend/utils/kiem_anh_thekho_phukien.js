/* ================================================================================================
   KIEM CHUNG v7.52 — The kho / Ton kho PHU KIEN: them cot HINH ANH
   ------------------------------------------------------------------------------------------------
   Anh lay tu `DanhMucPhuKien.AnhDaiDien` (co tu v5.87 / migration_v660) — CUNG NGUON voi anh dang
   hien tren moi phieu NPL, nen khai mot lan la moi cho deu co.

   Hai bang trong tab nay KHAC NHAU ve ban chat:
     · TONG HOP (nhieu ma)   -> THEM MOT COT anh.
     · CHI TIET (1 ma)       -> moi dong cung mot ma, them cot la lap lai cung tam anh xuong may chuc
                                dong => hien MOT LAN phia tren bang.
   Test CHAY THAT ham dung bang cat tu file frontend that + doi chieu backend.

   Chay:  node utils/kiem_anh_thekho_phukien.js
   ================================================================================================ */
const fs = require('fs');
const path = require('path');

const G = path.join(__dirname, '..');
const doc = (p) => fs.readFileSync(path.join(G, p), 'utf8');

let dat = 0, truot = 0;
const OK = (m) => { dat++; console.log('  OK   ' + m); };
const NO = (m) => { truot++; console.log('  SAI  ' + m); };
const kiem = (dk, m, them) => (dk ? OK(m) : NO(m + (them ? '  -> ' + them : '')));

const sFe = doc('../frontend/js/module.phukien.js');
const sBe = doc('routes/phukien.js');
const sIndex = doc('../frontend/index.html');
const schema = doc('../database/migration_v660.sql');

function catHam(src, ten) {
  const moc = src.indexOf('function ' + ten + '(');
  if (moc < 0) return null;
  const mo = src.indexOf('{', moc);
  let sau = 1, i = mo + 1, chuoi = null;
  for (; i < src.length && sau > 0; i++) {
    const c = src[i];
    if (chuoi) { if (c === chuoi && src[i - 1] !== '\\') chuoi = null; continue; }
    if (c === "'" || c === '"' || c === '`') { chuoi = c; continue; }
    if (c === '{') sau++; else if (c === '}') sau--;
  }
  return sau === 0 ? src.slice(moc, i) : null;
}

console.log('\n=== 1. Cot AnhDaiDien co that (khong doan ten cot) ===');
kiem(/ALTER TABLE dbo\.DanhMucPhuKien ADD AnhDaiDien NVARCHAR\(500\) NULL/.test(schema),
  'migration_v660 co them DanhMucPhuKien.AnhDaiDien');

console.log('\n=== 2. Ham dung deu KHAI trong chinh file (bai hoc v7.49.1) ===');
['anhPKThumbHtml', 'anhPKMotLanHtml', 'chiTietTableHtml', 'tonQuyDoiHtml'].forEach(h =>
  kiem(new RegExp(`function ${h}\\s*\\(`).test(sFe), `frontend co khai ${h}()`));
kiem(/const coCotPK|function coCotPK/.test(sBe), 'backend co ham do cot coCotPK()');
kiem(/coCotPK\(pool, 'DanhMucPhuKien', 'AnhDaiDien'\)/.test(sBe),
  'route /thekho DO COT truoc khi SELECT (chua chay migration van chay)');

console.log('\n=== 3. Backend tra AnhDaiDien o CA HAI dang bao cao ===');
const routeTK = sBe.slice(sBe.indexOf("router.get('/thekho'"), sBe.indexOf("router.get('/thekho/export'"));
kiem(/\$\{cotAnhTK\('dm'\)\} AS AnhDaiDien/.test(routeTK), 'nhanh CHI TIET tra AnhDaiDien');
kiem(/\$\{cotAnhTK\('dm2'\)\} AS AnhDaiDien/.test(routeTK), 'nhanh TONG HOP tra AnhDaiDien');
kiem(/AnhDaiDien: r\.AnhDaiDien \|\| null/.test(routeTK), 'nhanh CHI TIET map ra field cho frontend');
kiem(/CAST\(NULL AS NVARCHAR\(500\)\)/.test(routeTK), 'chua co cot -> tra NULL, khong sap route');
kiem(!/vw_TonKhoPhuKien[\s\S]{0,200}AnhDaiDien\s+FROM/.test(sBe),
  'KHONG sua view vw_TonKhoPhuKien (view la phep tinh ton tu 3 nguon phieu)');

console.log('\n=== 4. CHAY THAT: bang TONG HOP co dung mot cot anh ===');
const mThumb = catHam(sFe, 'anhPKThumbHtml');
const mMotLan = catHam(sFe, 'anhPKMotLanHtml');
kiem(!!mThumb && !!mMotLan, 'cat duoc 2 ham dung anh');
if (mThumb && mMotLan) {
  const escapeHtml = (s) => (s == null ? '' : String(s).replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  const { anhPKThumbHtml: thumb, anhPKMotLanHtml: motLan } = new Function('escapeHtml',
    `${mThumb}\n${mMotLan}\nreturn { anhPKThumbHtml, anhPKMotLanHtml };`)(escapeHtml);
  kiem(/<img src="\/uploads\/pk1\.jpg"/.test(thumb({ AnhDaiDien: '/uploads/pk1.jpg' })),
    'co anh -> ra the <img>');
  kiem(thumb({ AnhDaiDien: null }) === '' && thumb({}) === '' && thumb(null) === '',
    'khong co anh -> o TRONG (khong ra khung vo, khong vang)');
  kiem(/AnhPhuKien/.test(mThumb), 'van doc ca ten cu AnhPhuKien (du lieu/phieu cu)');
  kiem(motLan({ AnhDaiDien: null }) === '', 'khong co anh -> khoi anh mot lan KHONG chiem cho');
  kiem(/margin-bottom/.test(motLan({ AnhDaiDien: '/x.jpg' })), 'co anh -> boc trong div co khoang cach');
  kiem(/&quot;|&lt;/.test(thumb({ AnhDaiDien: '"><script>' })), 'duong dan anh duoc escape');
}

console.log('\n=== 5. Dat dung cho: TONG HOP them cot, CHI TIET hien mot lan ===');
/* Cat DUNG bang tong hop: `<th>Mã PK</th>` xuat hien o nhieu bang khac trong file, lay tu no la
   quet lan ca chuc bang (da mac: dem ra 79 cot). Neo bang chuoi DUY NHAT cua bang nay roi lui ve
   `resultEl.innerHTML =` gan nhat va tien den `</tbody></table>` gan nhat. */
const neo = sFe.indexOf('<th style="width:56px;">Ảnh</th>');
const veTongHop = neo < 0 ? '' : sFe.slice(
  sFe.lastIndexOf('resultEl.innerHTML =', neo),
  sFe.indexOf('</tbody></table>', neo) + 16);
kiem(/<th>Mã PK<\/th><th style="width:56px;">Ảnh<\/th><th>Tên phụ kiện<\/th>/.test(veTongHop),
  'tieu de: Anh nam ngay SAU Ma PK');
kiem(/<td>\$\{anhPKThumbHtml\(r\)\}<\/td>/.test(veTongHop), 'dong du lieu co o anh');
/* Dem cot: tieu de va dong du lieu phai bang nhau — them cot ma quen mot ben la lech ca bang. */
const soTh = (veTongHop.match(/<th[\s>]/g) || []).length;
const soTd = (veTongHop.match(/<td[\s>]/g) || []).length;
kiem(soTh === 9, 'bang tong hop co 9 cot (8 cu + Anh)', String(soTh));
kiem(soTd === 9, 'dong du lieu cung 9 o — khong lech cot', String(soTd));
kiem(/resultEl\.innerHTML = anhPKMotLanHtml\(rows\[0\]\) \+ chiTietTableHtml\(rows\)/.test(sFe),
  'bang CHI TIET: anh hien MOT LAN phia tren, khong them cot');
kiem(!/<th>Ảnh<\/th>[\s\S]{0,120}Số phiếu/.test(sFe),
  'bang CHI TIET KHONG co cot Anh lap lai tung dong');
kiem(/anhPKMotLanHtml\(\(rows\[0\] && rows\[0\]\.AnhDaiDien\) \? rows\[0\] : it\)/.test(sFe),
  'popup Lich su cung hien anh (uu tien du lieu vua tra ve)');

console.log('\n=== 6. Bump ?v= ===');
const v = (sIndex.match(/module\.phukien\.js\?v=([\d.]+)/) || [])[1] || '';
kiem(parseFloat(v) >= 7.52, 'index.html: module.phukien.js da bump >= 7.52', 'dang la ' + v);

console.log(`\n================ KET QUA: ${dat} dat / ${truot} sai ================`);
process.exit(truot ? 1 : 0);
