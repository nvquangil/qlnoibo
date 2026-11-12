/* ================================================================================================
   kiem_quyen_route_chi_doc.js  —  bo tu kiem cho v9.11
   "Route CHI DOC nhung la POST thi KHONG duoc am tham doi quyen SUA."

   Bay: requireChucNang() suy hanh dong tu HTTP METHOD (POST => 'edit'). Mot route POST chi-doc da
   khai requirePermission(..., 'view') ngay ben canh van bi doi quyen SUA => nguoi dung duoc cap XEM
   bam nut la an 403, trong khi ho va ca quan tri deu tin la "da du quyen".
   Ca mau: nut "Tải NV từ máy" o Cham cong (Nguyen bao 2026-10-31).

   Chay:  node backend\utils\kiem_quyen_route_chi_doc.js
   KHONG copy file nay sang D:\QLSX.
   ================================================================================================ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const GOC = path.join(__dirname, '..', '..');
const THU_MUC_ROUTE = path.join(GOC, 'backend', 'routes');
const F_AUTH = 'backend/middleware/auth.js';

let sai = 0, dat = 0;
function kiem(ten, dung, thongDiep) {
  if (dung) { dat++; console.log('  ✓ ' + ten); }
  else { sai++; console.log('  ❌ ' + ten + (thongDiep ? ' — ' + thongDiep : '')); }
}

console.log('\n=== 1. BIEN DICH (thay cho node --check) ===');
const srcAuth = fs.readFileSync(path.join(GOC, F_AUTH), 'utf8');
const dsRoute = fs.readdirSync(THU_MUC_ROUTE).filter(f => f.endsWith('.js'));
/* v9.11: PHAI gom ca file FRONTEND da sua. Ban dau toi chi nap auth.js + routes, nen
   module.payroll.js — file co comment chua backtick — khong duoc kiem cu phap boi chinh bo kiem
   nay; no chi nam o mot dong `node --check` roi trong huong dan deploy, tuc rat de bo sot. */
const FE_SUA = ['frontend/js/module.payroll.js', 'frontend/js/module.users.js', 'frontend/js/module.khohang.js'];
[[F_AUTH, srcAuth]]
  .concat(dsRoute.map(f => ['backend/routes/' + f, fs.readFileSync(path.join(THU_MUC_ROUTE, f), 'utf8')]))
  .concat(FE_SUA.map(p => [p, fs.readFileSync(path.join(GOC, p), 'utf8')]))
  .forEach(([ten, src]) => {
  try { new vm.Script(src, { filename: ten }); dat++; console.log('  ✓ ' + ten); }
  catch (e) { sai++; console.log('  ❌ ' + ten + ' VO CU PHAP: ' + e.message); }
});

console.log('\n=== 2. MIDDLEWARE — tham so hanh dong phai LA TUY CHON ===');
/* 🔴 Day la phep QUAN TRONG NHAT cua file nay. middleware/auth.js duoc MOI route dung; neu tham so
   thu ba thanh BAT BUOC, hoac mat nhanh "bo trong thi suy tu method", thi ~200 cho goi san doi hanh
   vi cung luc — hong toan he thong chu khong phai mot man. */
/* 🔴 KIEM HANH VI THAT, KHONG SO CHUOI NUA.
   Ba lan lien tiep (v9.10 regex, v9.11 includes-qua-khit, v9.11 regex theo ban nhap cu) toi viet
   phep so chuoi roi no BAO DO OAN => ca bo kiem exit 1 => mat luoi an toan duy nhat. Lan nay goi
   THANG middleware voi req gia va xem no cho qua hay chan. Doi cach viet trong auth.js bao nhieu
   lan cung khong lam phep nay do oan — chi hanh vi sai moi do.
   auth.js khong require gi, khong dung DB nen nap duoc truc tiep. */
const auth = require('../middleware/auth');
function thu(mw, { method, perm, isAdmin }) {
  const req = { method, session: { user: { isAdmin: !!isAdmin, chucNangPerm: perm || {} } } };
  let ketQua = 'qua', maLoi = 0;
  const res = { status(c) { maLoi = c; return this; }, json() { ketQua = 'chan'; return this; } };
  mw(req, res, () => { ketQua = 'qua'; });
  return { ketQua, maLoi };
}
const P_SUA_CAM = { 'X:y': { canView: true, canEdit: false, canDelete: true } };
const P_XEM_CAM = { 'X:y': { canView: false, canEdit: true, canDelete: true } };

kiem('BO TRONG + POST => van doi quyen SUA (hanh vi cu, ~200 route khong duoc doi)',
     thu(auth.requireChucNang('X', 'y'), { method: 'POST', perm: P_SUA_CAM }).ketQua === 'chan');
kiem('BO TRONG + GET => doi quyen XEM',
     thu(auth.requireChucNang('X', 'y'), { method: 'GET', perm: P_XEM_CAM }).ketQua === 'chan'
       && thu(auth.requireChucNang('X', 'y'), { method: 'GET', perm: P_SUA_CAM }).ketQua === 'qua');
kiem("EP 'view' + POST => chi doi quyen XEM (day la ca can vá)",
     thu(auth.requireChucNang('X', 'y', 'view'), { method: 'POST', perm: P_SUA_CAM }).ketQua === 'qua'
       && thu(auth.requireChucNang('X', 'y', 'view'), { method: 'POST', perm: P_XEM_CAM }).ketQua === 'chan',
     'day la toan bo muc dich cua ban va — hong phep nay la hong ban va');
kiem('HANH DONG LA => lui ve suy theo method, KHONG mo toang gate',
     thu(auth.requireChucNang('X', 'y', 'create'), { method: 'POST', perm: P_SUA_CAM }).ketQua === 'chan',
     "go nham 'create' => key canCreate khong ton tai => undefined !== false => gate bien mat");
kiem('Admin van di qua moi truong hop',
     thu(auth.requireChucNang('X', 'y'), { method: 'POST', perm: P_SUA_CAM, isAdmin: true }).ketQua === 'qua');
kiem('Khong co dong cau hinh rieng => mac dinh CHO PHEP (an toan, khong khoa he thong)',
     thu(auth.requireChucNang('K', 'z'), { method: 'POST', perm: P_SUA_CAM }).ketQua === 'qua');
kiem('Bi chan thi tra 403 (khong phai 401 — 401 bi common.js da ve /login)',
     thu(auth.requireChucNang('X', 'y'), { method: 'POST', perm: P_SUA_CAM }).maLoi === 403);
kiem('requireChucNangAny cung theo dung luat do',
     thu(auth.requireChucNangAny('X', ['y'], 'view'), { method: 'POST', perm: P_SUA_CAM }).ketQua === 'qua'
       && thu(auth.requireChucNangAny('X', ['y']), { method: 'POST', perm: P_SUA_CAM }).ketQua === 'chan');
kiem('cau tu choi GOI TEN chuc nang thieu quyen',
     /ở chức năng[^\n]*moduleCode[^\n]*maChucNang/.test(srcAuth),
     'khong goi ten thi nguoi dung lan quan tri deu khong biet bat o dau');
/* ⚠️ So KHIT tung ky tu la de bao DO OAN: ban dau toi doi chuoi ket thuc bang nhay-kep + nhay-don,
   trong khi nguon that la nhay-kep + dau cham. Phep kiem hong lam ca bo kiem exit 1 => mat luoi an
   toan. Chi can kiem CO noi ten module va ma chuc nang vao cau tu choi. */
kiem('cau tu choi GOI TEN chuc nang thieu quyen',
     /ở chức năng[^\n]*moduleCode[^\n]*maChucNang/.test(srcAuth),
     'khong goi ten thi nguoi dung lan quan tri deu khong biet bat o dau');
/* Khong so chuoi quanh chuanHoaHanhDong nua — hanh vi cua no da duoc phep "HANH DONG LA" o tren
   kiem that roi. Chi giu lai mot phep: no KHONG duoc throw, vi throw luc dang ky route la sap
   server ngay khi khoi dong, ma du an nay khong co ban chay thu de phat hien. */
let throwLucDangKy = false;
try { auth.requireChucNang('X', 'y', 'bay-gio-la-gia-tri-la'); } catch (e) { throwLucDangKy = true; }
kiem('gia tri la KHONG lam no throw luc dang ky route', !throwLucDangKy,
     'throw o day = pm2 restart xong server khong len duoc');

console.log('\n=== 3. RA SOAT TOAN BO route POST CHI-DOC ===');
/* Dau hieu mau thuan: cung mot dong vua co requirePermission(..., 'view') — tuc tac gia khai day la
   viec CHI DOC — vua co requireChucNang(...) KHONG ep hanh dong => am tham doi quyen SUA. */
const NGOAI_LE = {
  // Route co GHI / co tac dong ra ngoai (gui email...) thi DUNG ep 'view'. Ghi ro tung cai + ly do.
  'qlsx.js:/canhbao/chay-ngay': 'GUI EMAIL canh bao tre han — khong phai viec chi-doc, giu doi quyen sua'
};
/* Ngoai le theo CA FILE, dung cho file khai middleware qua ham dung. */
const NGOAI_LE_FILE = {
  'hoadon.js': 'CHUA RA (v9.11) — 5 route POST dung CN(\'view\',...): /dangnhap /dangxuat /tracuu '
             + '/taifile /dunglaipdf. Phai DOC THAN tung ham truoc khi ep \'view\': dang nhap cong '
             + 'TCT va tai file deu co tac dong ra ngoai, khong chac la viec chi-doc. Module HOADON '
             + 'moi P1, chua cap quyen rong nen chua ai vap. Ra xong thi xoa dong nay.'
};
/* 🔴 KHONG quet theo TUNG DONG. Ra soat cheo bat duoc hai diem mu cua ban dau:
     (a) `hoadon.js` khai middleware qua HAM DUNG:
           const CN = (action, chucNang) => [requireAuth, requirePermission('HOADON', action),
                                             requireChucNang('HOADON', chucNang)];
         roi 5 route POST goi `CN('view','dauvao')` — dong router.post KHONG he chua chu
         requirePermission nao, nen quet theo dong khong bao gio thay.
     (b) Co route khai middleware XUONG NHIEU DONG (banhang.js, tailieukythuat.js).
   Nen quet theo KHOI: gop ca file roi tach theo tung loi goi router.post/put/patch. */
let mauThuan = 0;
dsRoute.forEach(f => {
  const src = fs.readFileSync(path.join(THU_MUC_ROUTE, f), 'utf8');

  // (a) Ham dung middleware: bat kieu `requirePermission(<M>, action)` + `requireChucNang(...)` cung mot bieu thuc
  const hamDung = /requirePermission\(\s*[^,]+,\s*(\w+)\s*\)[\s\S]{0,160}?requireChucNang(Any)?\([^)]*\)/.test(src)
               && !/requireChucNang(Any)?\([^)]*,\s*'(view|edit|delete)'\s*\)/.test(src);
  if (hamDung) {
    const soPostView = (src.match(/\w+\(\s*'view'\s*,/g) || []).length;
    if (soPostView > 0) {
      if (NGOAI_LE_FILE[f]) {
        console.log('  … bo qua CO CHU DICH ' + f + ' (' + soPostView + ' cho) — ' + NGOAI_LE_FILE[f]);
      } else {
        mauThuan++;
        console.log('  ❌ ' + f + '  — khai middleware qua HAM DUNG, co ' + soPostView
          + " cho goi voi 'view' nhung requireChucNang trong ham do khong ep hanh dong");
      }
    }
  }

  // (b) Khai truc tiep: tach theo tung loi goi router.post/put/patch, cho phep xuong dong
  const re = /router\.(post|put|patch)\(\s*'([^']+)'([\s\S]*?)(?=\n\s*(?:router\.|module\.exports|\/\*\s*=)|$)/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const duong = m[2];
    const khoi = m[3].slice(0, 600);   // chi phan khai middleware, khong lan vao than ham
    if (!/requirePermission\([^)]*'view'\)/.test(khoi)) continue;
    if (!/requireChucNang(Any)?\(/.test(khoi)) continue;
    if (/requireChucNang(Any)?\([^)]*,\s*'(view|edit|delete)'\s*\)/.test(khoi)) continue;
    const khoa = f + ':' + duong;
    if (NGOAI_LE[khoa]) { console.log('  … bo qua CO CHU DICH ' + khoa + ' — ' + NGOAI_LE[khoa]); continue; }
    mauThuan++;
    console.log('  ❌ ' + khoa + '  — khai view o requirePermission nhung requireChucNang van doi SUA');
  }
});
kiem('khong con route POST chi-doc nao am tham doi quyen SUA', mauThuan === 0,
     'moi dong o tren: them tham so thu ba \'view\' vao requireChucNang, HOAC ghi vao NGOAI_LE kem ly do');

console.log('\n=== 4. BON ROUTE DA SUA O v9.11 ===');
[['payroll.js', '/maychamcong/:id/nhanvien-tumay'],
 ['payroll.js', '/maychamcong/:id/test'],
 ['khuyenmai.js', '/kiem-trung'],
 ['nhaplai.js', '/tinhthu']].forEach(([f, duong]) => {
  const src = fs.readFileSync(path.join(THU_MUC_ROUTE, f), 'utf8');
  const dong = src.split('\n').find(d => d.includes("router.post('" + duong + "'"));
  kiem(f + ' ' + duong + " ep 'view'",
       !!dong && /requireChucNang\([^)]*,\s*'view'\s*\)/.test(dong));
});

console.log('\n=== 5. MAN KHONG DUOC DI MUON ROUTE CUA PHAN HE KHAC ===');
/* 🔴 Loi that cua ca nay: man Cham cong goi GET /api/danhmuc/nhanvien => bat nguoi lam cham cong
   phai duoc cap ca phan he DANH MUC (von chua khach hang, NCC, ma hang, mau sac...). Tai khoan
   huongns co du Nhan su + Tinh luong van bi chan. Moi man phai dung route gac bang CHINH quyen
   cua no. */
const srcPayrollFe = fs.readFileSync(path.join(GOC, 'frontend', 'js', 'module.payroll.js'), 'utf8');
const srcPayrollBe = fs.readFileSync(path.join(THU_MUC_ROUTE, 'payroll.js'), 'utf8');
kiem('module.payroll.js KHONG con goi /api/danhmuc/nhanvien',
     !/apiGet\('\/api\/danhmuc\/nhanvien'\)/.test(srcPayrollFe),
     'con muon route Danh muc => nguoi lam cham cong van phai co quyen Danh muc');
kiem('payroll.js CO route GET /nhanvien gac bang quyen PAYROLL',
     /router\.get\('\/nhanvien',[^\n]*requirePermission\('PAYROLL', 'view'\)[^\n]*requireChucNang\('PAYROLL', 'chamcong'\)/.test(srcPayrollBe));
kiem('route do CHI tra 4 cot cham cong can (khong kem thong tin nhan su nhay cam)',
     /SELECT NhanVienID, MaNhanVien, HoTen, MaChamCong FROM NhanVien/.test(srcPayrollBe),
     'tra ca bang NhanVien la lo luong / CCCD cho nguoi chi lam cham cong');
kiem('payroll.js khong co route GET /:param cap 1 chan mat /nhanvien',
     !/router\.get\('\/:[A-Za-z]/.test(srcPayrollBe),
     'route literal phai dung TRUOC route :param — bai hoc v5.59');
/* Cung benh, muc do NANG HON: 3 loi goi sang Danh muc trong mot Promise.all cua man Phan quyen —
   thieu .catch la vo CA MAN (ca 3 tab), khong phai mat mot o chon. */
const srcUsers = fs.readFileSync(path.join(GOC, 'frontend', 'js', 'module.users.js'), 'utf8');
['bophan', 'congdoan', 'nhanvien'].forEach(b => {
  kiem('module.users.js: /api/danhmuc/' + b + ' co .catch',
       new RegExp("apiGet\\('/api/danhmuc/" + b + "'\\)\\.catch").test(srcUsers),
       'thieu .catch => Promise.all do theo => vo CA man Phan quyen');
});

console.log('\n' + '='.repeat(70));
console.log(sai === 0 ? `✅ ${dat} phep DAT, 0 sai` : `❌ ${sai} SAI / ${dat + sai} phep`);
console.log('='.repeat(70) + '\n');
process.exit(sai === 0 ? 0 : 1);
