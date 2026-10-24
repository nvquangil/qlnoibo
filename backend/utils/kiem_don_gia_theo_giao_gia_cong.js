/* ================================================================================================
   KIEM CHUNG v8.99 — DON GIA MAY / DON GIA GIA CONG CHI LIET KE LENH DA GIAO DUNG KENH
   ------------------------------------------------------------------------------------------------
   Nguyen 2026-10-24: "khi công đoạn giao gia công chọn Giao nhà làm thì đưa lệnh vào đơn giá công
   đoạn may, chọn giao gia công thì đưa lệnh vào đơn giá gia công. Hiện tại đang thể hiện cả 2. Khi
   chưa giao gia công thì chưa đưa vào đơn giá nào cả."

   BA CHO DE SAI:
     1. Loc DUNG CO: dongiamay <- DaGiaoNhaLam, dongiagiacong <- DaGiaoGiaCong (hai checkbox doc lap o
        cong doan GC, qlsx.js v5.24). Dao nguoc la nguoi dung nhap don gia vao nham tab.
     2. KHONG GIAU du lieu da nhap: lenh da co don gia (EXISTS bang don gia) van phai hien du chua tick.
     3. Cac loai tai lieu KHAC khong bi loc theo (locGiao chi gan cho 2 loai).

   Chay:  node backend\utils\kiem_don_gia_theo_giao_gia_cong.js   (tu thu muc goc QLNoiBo)
   ================================================================================================ */
const fs = require('fs');
const path = require('path');
const G = path.join(__dirname, '..');
const doc = (p) => fs.readFileSync(path.join(G, p), 'utf8');

let dat = 0, truot = 0;
const OK = (m) => { dat++; console.log('  OK   ' + m); };
const NO = (m) => { truot++; console.log('  SAI  ' + m); };
const kiem = (dk, m) => (dk ? OK(m) : NO(m));

const sBE = doc('routes/tailieukythuat.js');
const sFe = doc('../frontend/js/module.tailieukythuat.js');
const sIndex = doc('../frontend/index.html');

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

console.log('\n=== 1. BACKEND getOrdersWithDocStatus ===');
const fn = catKhoi(sBE, 'async function getOrdersWithDocStatus', '{', '}');
kiem(fn.length > 0, 'trich duoc ham');
kiem(/const coCoGiao = await coCot\(pool, 'DonHangSanXuat', 'DaGiaoNhaLam'\) && await coCot\(pool, 'DonHangSanXuat', 'DaGiaoGiaCong'\)/.test(fn),
  'do CA HAI cot truoc khi loc (DB cu khong co cot -> khong loc, nhu CoInTheu v5.87)');
kiem(/if \(coCoGiao && loai === 'dongiamay'\) \{\s*locGiao = 'WHERE \(ISNULL\(d\.DaGiaoNhaLam, 0\) = 1 OR EXISTS \(SELECT 1 FROM DonHangDonGiaCongDoanMay g2 WHERE g2\.DonHangID = d\.DonHangID\)\)'/.test(fn),
  'dongiamay <- DaGiaoNhaLam = 1  OR  da co dong DonHangDonGiaCongDoanMay');
kiem(/else if \(coCoGiao && loai === 'dongiagiacong'\) \{\s*locGiao = 'WHERE \(ISNULL\(d\.DaGiaoGiaCong, 0\) = 1 OR EXISTS \(SELECT 1 FROM DonHangHangMucGiaCong g2 WHERE g2\.DonHangID = d\.DonHangID\)\)'/.test(fn),
  'dongiagiacong <- DaGiaoGiaCong = 1  OR  da co dong DonHangHangMucGiaCong');
kiem(/\$\{daCoExpr\}\$\{cotGiao\}/.test(fn), 'SELECT co them DaGiaoNhaLam/DaGiaoGiaCong (frontend gan nhan "chua tick")');
kiem(/: ', CAST\(NULL AS BIT\) AS DaGiaoNhaLam, CAST\(NULL AS BIT\) AS DaGiaoGiaCong'/.test(fn), 'DB cu: tra NULL (khong phai 0) de frontend khong gan nhan bua');
kiem(/\$\{locInTheu\}\$\{locGiao\}/.test(fn) && (fn.match(/locGiao = 'WHERE/g) || []).length === 2,
  'locGiao chi gan o DUNG 2 nhanh; loai khac van liet ke het');
kiem(/\(loai === 'hinhanhinthue' \|\| loai === 'dongiainthe'\)/.test(fn), 'locInTheu van gioi han 2 loai in theu -> khong bao gio co 2 WHERE trong cung cau');

console.log('\n=== 2. FRONTEND module.tailieukythuat.js ===');
const fnList = catKhoi(sFe, 'async function renderOrderList', '{', '}');
kiem(/activeChild === 'dongiamay'\s*\?\s*'Chỉ hiện lệnh đã tick <b>Giao nhà làm<\/b>/.test(fnList), 'tab Don gia may: ghi chu loc "Giao nha lam"');
kiem(/activeChild === 'dongiagiacong'\s*\?\s*'Chỉ hiện lệnh đã tick <b>Giao gia công<\/b>/.test(fnList), 'tab Don gia giao gia cong: ghi chu loc "Giao gia cong"');
kiem(/\$\{ghiChuLoc \? `<div class="empty-hint"/.test(fnList), 'ghi chu chi hien o 2 tab do (ghiChuLoc rong -> khong co dong)');
const fnRow = catKhoi(sFe, 'function rowHtml', '{', '}');
kiem(/const coCua = \(co\) => co != null && !Number\(co\);/.test(fnRow), 'coCua: NULL (DB cu) -> khong nhan; false/0 -> nhan');
kiem(/o\.DaCo && activeChild === 'dongiamay' && coCua\(o\.DaGiaoNhaLam\)/.test(fnRow) && /o\.DaCo && activeChild === 'dongiagiacong' && coCua\(o\.DaGiaoGiaCong\)/.test(fnRow),
  'nhan "chua tick" chi khi DA CO don gia va dung co cua tab do');
kiem(/⚠ \$\{nhanChuaGiao\}/.test(fnRow), 'nhan ve trong o Trang thai');
kiem(/module\.tailieukythuat\.js\?v=8\.99/.test(sIndex), 'index.html: module.tailieukythuat.js?v=8.99');

console.log('\n=== 3. KY TU DIEU KHIEN TRONG FILE NGUON (canh bao, khong tinh sai) ===');
/* ripgrep bao module.tailieukythuat.js la "binary" (co byte NUL) tu truoc v8.99. Node van parse duoc
   (NUL trong chuoi la hop le) nen chi CANH BAO kem vi tri — bai hoc v8.85: ky tu dieu khien vo hinh,
   khong ai sua lai duoc neu khong biet no o dau.
   Viet bang ma thoat \xNN — KHONG dan ky tu dieu khien that vao day (chinh file kiem se bi "binary"). */
const reDieuKhien = new RegExp('[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F]');
[['../frontend/js/module.tailieukythuat.js', sFe], ['routes/tailieukythuat.js', sBE], ['utils/kiem_don_gia_theo_giao_gia_cong.js', doc('utils/kiem_don_gia_theo_giao_gia_cong.js')]].forEach(([ten, s]) => {
  const vt = [];
  s.split('\n').forEach((d, i) => { if (reDieuKhien.test(d)) vt.push(i + 1); });
  console.log(vt.length
    ? `  !!   ${ten}: co ky tu dieu khien o dong ${vt.slice(0, 10).join(', ')}${vt.length > 10 ? ' ...' : ''} — mo bang editor hien ky tu an de xem`
    : `  OK   ${ten}: khong co ky tu dieu khien`);
});

console.log(`\n=== KET QUA: ${dat} dat, ${truot} sai ===`);
process.exit(truot ? 1 : 0);
