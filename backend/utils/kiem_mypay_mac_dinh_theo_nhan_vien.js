/* ================================================================================================
   kiem_mypay_mac_dinh_theo_nhan_vien.js — bo tu kiem cho v9.59 (Nguyen 14/11/2026):
     "Bảng lương của tôi mặc định tự phân quyền cho user được gán mã nhân viên"

   Luat o backend/utils/loadUserContext.js: co Users.NhanVienID => permissions.MYPAY.canView = true
   + tab MYPAY:luongcuatoi khong bi an, BAT KE nhom; chi nhuong dong GHI DE RIENG THEO USER CanView=0.

   Chay:  node backend\utils\kiem_mypay_mac_dinh_theo_nhan_vien.js
   KHONG copy sang D:\QLSX. KHONG dung toi CSDL (thay '../db' bang pool gia qua Module._load).
   Hanh vi truoc (require that loadUserContext), so chuoi sau.
   ================================================================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Module = require('module');

const GOC = path.join(__dirname, '..', '..');
const doc = (...p) => fs.existsSync(path.join(GOC, ...p)) ? fs.readFileSync(path.join(GOC, ...p), 'utf8').replace(/\r\n/g, '\n') : '';
let sai = 0, dat = 0;
function kiem(ten, dung, td) {
  if (dung) { dat++; console.log('  ✓ ' + ten); }
  else { sai++; console.log('  ❌ ' + ten + (td ? ' — ' + (typeof td === 'string' ? td : JSON.stringify(td)) : '')); }
}
const boComment = (s) => s.replace(/image\/\*/g, 'image_ALL').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const canhGac = setTimeout(() => { console.log('\n  ❌ BO KIEM TREO qua 20 s'); process.exit(1); }, 20000);

const fLUC = doc('backend', 'utils', 'loadUserContext.js');
const fUsers = doc('backend', 'routes', 'users.js');
const fUS = doc('frontend', 'js', 'module.users.js');
const html = doc('frontend', 'index.html');

console.log('\n=== 1. BIEN DICH (vm.Script) ===');
[['backend/utils/loadUserContext.js', fLUC], ['backend/routes/users.js', fUsers], ['frontend/js/module.users.js', fUS]].forEach(([f, s]) => {
  if (!s) { sai++; console.log('  ❌ ' + f + ' KHONG DOC DUOC'); return; }
  try { new vm.Script(s, { filename: f }); dat++; console.log('  ✓ ' + f); }
  catch (e) { sai++; console.log('  ❌ ' + f + ' VO CU PHAP: ' + e.message); }
});

/* ---------------------------------------------------------------------------------------------
   Pool gia: tra recordset theo cau SQL that trong loadUserContext.js (so sau khi gop khoang trang).
   Cau nao khong nhan ra => nem loi, de bo kiem do thay vi lang le tra [] (giau loi).
   --------------------------------------------------------------------------------------------- */
let poolHienTai = null;
const goc = Module._load;
Module._load = function (request, parent) {
  if (request === '../db' && parent && /loadUserContext\.js$/.test(parent.filename || '')) {
    return { sql: { Int: 'Int' }, getPool: async () => poolHienTai };
  }
  return goc.apply(this, arguments);
};
const { loadUserContext } = require('./loadUserContext');

function taoPool(cfg) {
  const nk = [];
  const pool = { request() { const inputs = {}; const r = { input(t, k, v) { inputs[t] = v; return r; }, async query(q) {
    const s = q.replace(/\s+/g, ' ').trim(); nk.push({ q: s, inputs: { ...inputs } });
    if (/FROM Users u LEFT JOIN BoPhan b/.test(s)) return { recordset: cfg.user ? [cfg.user] : [] };
    if (/FROM UserGroups ug JOIN Groups g/.test(s)) return { recordset: cfg.groups || [] };
    if (/FROM Permissions p JOIN Modules m/.test(s)) return { recordset: cfg.permNhom || [] };
    if (/FROM UserCongDoan uc/.test(s)) return { recordset: [] };
    if (/FROM ChucNangPermissions cp JOIN ChucNang cn/.test(s)) return { recordset: cfg.cnNhom || [] };
    if (/FROM UserPermissions up JOIN Modules m/.test(s)) { if (cfg.thieuBangUser) throw new Error("Invalid object name 'UserPermissions'."); return { recordset: cfg.permUser || [] }; }
    if (/FROM UserChucNangPermissions ucp JOIN ChucNang cn/.test(s)) { if (cfg.thieuBangUser) throw new Error("Invalid object name 'UserChucNangPermissions'."); return { recordset: cfg.cnUser || [] }; }
    if (/FROM ChucNang WHERE ISNULL\(MacDinhCho, 1\) = 0/.test(s)) return { recordset: cfg.optIn || [] };
    throw new Error('query la: ' + s);
  } }; return r; } };
  return { pool, nk };
}
async function chay(cfg) {
  const { pool, nk } = taoPool(cfg);
  poolHienTai = pool;
  const ctx = await loadUserContext(7);
  return { ctx, nk };
}
const NV = (nhanVienId) => ({ UserID: 7, Username: 'an.thuy', HoTen: 'An Thu Thủy', Email: null, BoPhanID: null, NhanVienID: nhanVienId, TenBoPhan: null });
const NHOM_KHO = [{ GroupID: 3, TenNhom: 'Kho', IsAdmin: false }];
// Nhom "Kho" tung mo Ma tran phan quyen roi bam Luu: MERGE ghi CanView=0 cho MYPAY (khong co y cam) + an tab luongcuatoi.
const PERM_KHO = [{ ModuleCode: 'KHOHANG', CanView: 1, CanCreate: 1, CanEdit: 0, CanDelete: 0 }, { ModuleCode: 'MYPAY', CanView: 0, CanCreate: 0, CanEdit: 0, CanDelete: 0 }];
const CN_KHO = [{ ModuleCode: 'MYPAY', MaChucNang: 'luongcuatoi', CanView: 0, CanEdit: 0, CanDelete: 0 }, { ModuleCode: 'KHOHANG', MaChucNang: 'nhap', CanView: 0, CanEdit: 0, CanDelete: 0 }];

(async () => {
  console.log('\n=== 2. HANH VI: loadUserContext(userId) voi pool gia ===');
  let r;

  r = await chay({ user: NV(61) });
  kiem('gan NV, KHONG thuoc nhom nao -> permissions.MYPAY = { canView:true, 3 co kia false }, myPayTuDong = true', !!r.ctx && !!r.ctx.permissions.MYPAY && r.ctx.permissions.MYPAY.canView === true
    && r.ctx.permissions.MYPAY.canCreate === false && r.ctx.permissions.MYPAY.canEdit === false && r.ctx.permissions.MYPAY.canDelete === false && r.ctx.myPayTuDong === true, r.ctx && r.ctx.permissions);
  kiem('  ... khong mo them phan he nao khac (chi MYPAY), nhanVienId = 61, tab khong bi an', !!r.ctx && Object.keys(r.ctx.permissions).join() === 'MYPAY' && r.ctx.nhanVienId === 61 && r.ctx.hiddenChucNang.indexOf('MYPAY:luongcuatoi') === -1);
  kiem('  ... luat LUC NAP PHIEN: KHONG ghi gi vao CSDL (khong MERGE/INSERT/UPDATE/DELETE)', !r.nk.some(x => /^(MERGE|INSERT|UPDATE|DELETE)/i.test(x.q)));

  r = await chay({ user: NV(61), groups: NHOM_KHO, permNhom: PERM_KHO, cnNhom: CN_KHO });
  kiem('gan NV + nhom ghi MYPAY CanView=0 va AN tab luongcuatoi (ma tran bam Luu) -> van MYPAY canView=true, tab KHONG bi an, myPayTuDong = true',
    !!r.ctx && r.ctx.permissions.MYPAY.canView === true && r.ctx.chucNangPerm['MYPAY:luongcuatoi'].canView === true && r.ctx.hiddenChucNang.indexOf('MYPAY:luongcuatoi') === -1 && r.ctx.myPayTuDong === true,
    r.ctx && { MYPAY: r.ctx.permissions.MYPAY, hidden: r.ctx.hiddenChucNang });
  kiem('  ... quyen nhom KHAC giu nguyen: KHOHANG canView/canCreate dung, tab KHOHANG:nhap van bi an', !!r.ctx && r.ctx.permissions.KHOHANG.canView === true && r.ctx.permissions.KHOHANG.canCreate === true
    && r.ctx.permissions.KHOHANG.canEdit === false && r.ctx.hiddenChucNang.indexOf('KHOHANG:nhap') !== -1);

  r = await chay({ user: NV(null), groups: NHOM_KHO, permNhom: PERM_KHO, cnNhom: CN_KHO });
  kiem('KHONG gan NV (NhanVienID null) + cung nhom -> MYPAY canView=false nhu nhom dat, tab bi an, myPayTuDong = false (khong mo bua)',
    !!r.ctx && r.ctx.permissions.MYPAY.canView === false && r.ctx.hiddenChucNang.indexOf('MYPAY:luongcuatoi') !== -1 && r.ctx.myPayTuDong === false && r.ctx.nhanVienId === null);

  r = await chay({ user: NV(61), groups: NHOM_KHO, permNhom: PERM_KHO, permUser: [{ ModuleCode: 'MYPAY', CanView: 0, CanCreate: 0, CanEdit: 0, CanDelete: 0 }] });
  kiem('gan NV nhung quan tri GHI DE RIENG MYPAY CanView=0 (co y chan dung nguoi nay) -> NHUONG: canView=false, myPayTuDong = false',
    !!r.ctx && r.ctx.permissions.MYPAY.canView === false && r.ctx.myPayTuDong === false, r.ctx && r.ctx.permissions.MYPAY);

  r = await chay({ user: NV(61), groups: NHOM_KHO, permNhom: PERM_KHO, cnNhom: CN_KHO, cnUser: [{ ModuleCode: 'MYPAY', MaChucNang: 'luongcuatoi', CanView: 0, CanEdit: 0, CanDelete: 0 }] });
  kiem('gan NV, ghi de rieng CHUC NANG luongcuatoi CanView=0 -> phan he mo (myPayTuDong true) nhung tab van bi an (nhuong dong rieng)',
    !!r.ctx && r.ctx.permissions.MYPAY.canView === true && r.ctx.myPayTuDong === true && r.ctx.hiddenChucNang.indexOf('MYPAY:luongcuatoi') !== -1);

  r = await chay({ user: NV(61), groups: [{ GroupID: 1, TenNhom: 'Admin', IsAdmin: true }] });
  kiem('ADMIN gan NV -> isAdmin, permissions {} (thay het san), myPayTuDong = false, khong nem', !!r.ctx && r.ctx.isAdmin === true && Object.keys(r.ctx.permissions).length === 0 && r.ctx.myPayTuDong === false);

  r = await chay({ user: NV(61), groups: NHOM_KHO, permNhom: [{ ModuleCode: 'MYPAY', CanView: 1, CanCreate: 0, CanEdit: 0, CanDelete: 0 }] });
  kiem('nhom DA cap MYPAY (migration_v620) -> giu nguyen, myPayTuDong = false (khong phai tu mo)', !!r.ctx && r.ctx.permissions.MYPAY.canView === true && r.ctx.myPayTuDong === false);

  r = await chay({ user: NV(61), permUser: [{ ModuleCode: 'MYPAY', CanView: 1, CanCreate: 0, CanEdit: 0, CanDelete: 0 }] });
  kiem('dong ghi de rieng v9.52 CanView=1 (user gan sau v9.52) -> van xem duoc, myPayTuDong = false', !!r.ctx && r.ctx.permissions.MYPAY.canView === true && r.ctx.myPayTuDong === false);

  r = await chay({ user: NV(61), groups: NHOM_KHO, permNhom: PERM_KHO, cnNhom: CN_KHO, thieuBangUser: true });
  kiem('may CHUA chay migration_v5_userperm (bang UserPermissions nem loi) -> khong vo, luat van ap: MYPAY canView=true, tab khong an',
    !!r.ctx && r.ctx.permissions.MYPAY.canView === true && r.ctx.hiddenChucNang.indexOf('MYPAY:luongcuatoi') === -1 && r.ctx.myPayTuDong === true);

  r = await chay({});
  kiem('user khong ton tai -> null (hanh vi cu)', r.ctx === null);

  /* ---------------------------------------------------------------------------------------------
     3. SO CHUOI (tren ban da bo comment, sau khi hanh vi da dung)
     --------------------------------------------------------------------------------------------- */
  console.log('\n=== 3. ROUTE + GIAO DIEN ===');
  kiem('loadUserContext.js: co 2 dau moc v9.59 va tra myPayTuDong', fLUC.indexOf('/* === v9.59 MYPAY MAC DINH THEO NHAN VIEN — BAT DAU === */') > -1
    && fLUC.indexOf('/* === v9.59 MYPAY MAC DINH THEO NHAN VIEN — KET THUC === */') > -1 && /myPayTuDong\s*(\/\/[^\n]*)?\n\s*\};/.test(fLUC));
  const us = boComment(fUsers);
  kiem('GET /api/users (danh sach): SELECT va GROUP BY deu co u.NhanVienID (man Phan quyen rieng can biet da gan chua)',
    /SELECT u\.UserID, u\.Username, u\.HoTen, u\.Email, u\.IsActive, u\.BoPhanID, u\.NhanVienID, b\.TenBoPhan,/.test(us)
    && /GROUP BY u\.UserID, u\.Username, u\.HoTen, u\.Email, u\.IsActive, u\.BoPhanID, u\.NhanVienID, b\.TenBoPhan/.test(us));
  kiem('v9.52 moBangLuongCuaToi GIU LAI (khong xoa, bo kiem v9.52 van xanh)', /async function moBangLuongCuaToi\(pool, userId\)/.test(us));
  const usFE = boComment(fUS);
  kiem('module.users.js: dong MYPAY o ma tran rieng theo user co nhac "tu thay" khi da gan NV / "tu co khi gan" khi chua', /const nhacMyPay = \(r\) => r\.ModuleCode !== 'MYPAY' \? '' : \(uDangChon\.NhanVienID/.test(usFE)
    && /TỰ thấy phân hệ này, không cần tick/.test(usFE) && /Tự có khi tài khoản được gắn nhân viên/.test(usFE) && /\$\{escapeHtml\(r\.TenModule\)\}\$\{nhacMyPay\(r\)\}<\/td>/.test(usFE));
  kiem('module.users.js: nhan o "Lien ket nhan vien" noi gan la tu thay, khong can cap quyen', /Liên kết nhân viên \(gắn là tự thấy phân hệ "Bảng lương của tôi" — không cần cấp quyền\)/.test(usFE));
  kiem('module.users.js: toast v9.52 van giu dieu kien daMoMyPay + nhac dang nhap lai (bo kiem v9.52 ghim)', /if \(r && r\.data && r\.data\.daMoMyPay\) toast\(/.test(usFE) && /đăng nhập lại/.test(usFE));
  const v = (f) => { const x = new RegExp(f.replace(/\./g, '\\.') + '\\?v=([\\d.]+)').exec(html); return x ? parseFloat(x[1]) : 0; };
  kiem('index.html bump module.users.js >= 9.59', v('module.users.js') >= 9.59, { users: v('module.users.js') });

  clearTimeout(canhGac);
  console.log(`\n=== KET QUA: ${dat} dat, ${sai} sai ===`);
  process.exit(sai ? 1 : 0);
})().catch(e => { console.error('VO: ' + (e && e.stack || e)); process.exit(1); });
