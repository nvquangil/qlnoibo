// Middleware xac thuc dang nhap va phan quyen theo module (DANHMUC, USERS, QLSX, KHOVAI, KHOHANG)
// Quyen cua user duoc tinh 1 lan luc dang nhap va luu trong session (session.user.permissions),
// vi vay khi doi phan quyen 1 nhom, cac user dang online can dang nhap lai de nhan quyen moi.

function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ success: false, message: 'Chưa đăng nhập hoặc phiên đã hết hạn.' });
  }
  next();
}

function requirePermission(moduleCode, action) {
  // action: 'view' | 'create' | 'edit' | 'delete'
  return (req, res, next) => {
    const user = req.session && req.session.user;
    if (!user) return res.status(401).json({ success: false, message: 'Chưa đăng nhập.' });
    if (user.isAdmin) return next();

    const perm = user.permissions && user.permissions[moduleCode];
    const key = 'can' + action.charAt(0).toUpperCase() + action.slice(1); // canView/canCreate/canEdit/canDelete
    if (perm && perm[key]) return next();

    return res.status(403).json({ success: false, message: 'Tài khoản của bạn không có quyền thực hiện thao tác này.' });
  };
}

// Kiem tra user co duoc cap nhat 1 cong doan san xuat cu the khong (dung rieng cho QLSX)
// v5.9 (yeu cau "Mã công đoạn... mở rộng thành sửa lại toàn bộ các chỗ so sánh trực tiếp theo TÊN công
// đoạn... sang so sánh theo mã/StageID"): stageId gio la StageID (so), khong con la TEN cong doan nhu
// truoc - so sanh voi user.congDoanIds (mang StageID, xem loadUserContext.js) thay vi user.congDoan
// (mang TEN, VAN con giu lai o do de tuong thich nguoc/hien thi, nhung KHONG con dung de so sanh quyen
// o day nua). Truoc day doi ten 1 cong doan trong Danh muc se khien user dang duoc phan cong dung cong
// doan do BI MAT quyen cap nhat tien do - loi ngam, kho phat hien vi khong co dong nao trong bang phan
// quyen (UserCongDoan) thuc su thay doi khi doi ten.
function canUpdateStage(user, stageId) {
  if (!user) return false;
  if (user.isAdmin) return true;
  return Array.isArray(user.congDoanIds) && user.congDoanIds.indexOf(Number(stageId)) !== -1;
}

// v5.0: kiem tra quyen theo TUNG CHUC NANG (1 tab con cu the trong 1 phan he) - khac voi
// requirePermission (chi kiem tra CAP PHAN HE: co duoc vao module khong, co duoc them/sua/xoa
// trong module khong). Truoc day ChucNangPermissions (xem migration_v5_chucnang.sql) CHI dung de
// an/hien tab tren menu (app.js -> visibleTabsOf, thuan giao dien) - user van goi duoc API truc tiep
// neu biet URL vi cac route chi kiem requirePermission theo phan he. Ham nay bit chan THAT SU o backend:
// dat sau requirePermission tren cac route THAO TAC chinh gan voi 1 tab cu the (nhap/xuat/kiemke/dinhmuc,
// ralenh, dongiamay...) de an tab do khoi menu = chan duoc hanh dong, khong chi la don gian trang tri.
// Neu chua chay migration_v5_chucnang.sql, session.user.chucNangPerm se la {} -> luon cho qua,
// dam bao khong lam gay he thong o cac ban cai dat chua nang cap len v5.0.
//
// v5.3: chuc nang gio co Xem/Sua/Xoa RIENG (khong chi An/Hien) - xem migration_v53.sql. Action can
// kiem tra duoc SUY TU HTTP METHOD cua chinh request (khong can sua tung cho goi requireChucNang
// trong cac route hien co): GET = view, POST/PUT/PATCH = edit (chuc nang cap tab khong tach rieng
// "them" khoi "sua" - neu duoc Sua trong tab thi cung duoc Tao moi trong tab do), DELETE = delete.
// Nguyen tac AND voi requirePermission cap phan he: ca 2 lop deu phai cho phep thi moi qua duoc -
// chuc nang chi co the SIET CHAT THEM quyen cap phan he, khong the noi rong hon.
function actionFromMethod(method) {
  if (method === 'DELETE') return 'delete';
  if (method === 'GET' || method === 'HEAD') return 'view';
  return 'edit'; // POST, PUT, PATCH
}

/* v9.11 — chi CO DUNG BA hanh dong trong chucNangPerm: canView / canEdit / canDelete
   (xem loadUserContext.js). Go nham mot gia tri khac — de nhat la 'create', vi requirePermission
   viet ngay ben canh CO 'create' — se sinh key 'canCreate', ma key do KHONG TON TAI => `undefined
   === false` la false => **gate bien mat hoan toan, khong log, khong bao**. Mo toang quyen trong im
   lang la thu nguy hiem nhat o file nay, nen chan tai cho: gia tri la thi bo qua, lui ve suy theo
   method (hanh vi cu, an toan hon) va ghi console cho con biet.
   KHONG `throw` — se no ngay luc dang ky route, tuc sap server luc khoi dong, ma du an nay khong co
   ban chay thu de phat hien. */
const HANH_DONG_HOP_LE = ['view', 'edit', 'delete'];
function chuanHoaHanhDong(hanhDong, method, oDau) {
  if (hanhDong == null) return actionFromMethod(method);
  if (HANH_DONG_HOP_LE.indexOf(hanhDong) !== -1) return hanhDong;
  console.error('[auth] hanh dong khong hop le "' + hanhDong + '" tai ' + oDau
    + ' — chi nhan: ' + HANH_DONG_HOP_LE.join(' / ') + '. Tam lui ve suy theo HTTP method.');
  return actionFromMethod(method);
}

/* v9.11 — THAM SO THU BA `hanhDong` (tuy chon): ep hanh dong can kiem, thay vi suy tu HTTP method.
   ------------------------------------------------------------------------------------------------
   🔴 VI SAO PHAI CO: co nhung route CHI DOC nhung bat buoc phai la POST (gui tham so phuc tap, hoac
   goi thiet bi ngoai). Vi actionFromMethod() quy POST = 'edit', nhung route do am tham doi quyen
   SUA du khong ghi gi — mau thuan ngay voi dong requirePermission(..., 'view') viet ngay ben canh.
   Nguoi dung duoc cap XEM o tab do bam nut la an 403 "khong co quyen sua", trong khi ho (va ca
   quan tri) deu tin la "da du quyen". Ca mẫu: nut "Tải NV từ máy" o Cham cong (Nguyen bao 2026-10-31).

   Bo trong tham so nay => HANH VI Y HET TRUOC (suy tu method) => ~200 cho goi san khong doi gi.
   Chi truyen 'view' cho route THUC SU khong ghi gi. Route co ghi (ke ca ghi gian tiep nhu gui email)
   thi DUNG truyen — de no doi quyen sua la dung.

   Kem: cau tu choi nay GOI TEN chuc nang (vd "PAYROLL/chamcong"). Ban cu chi noi "o chuc nang nay",
   nguoi dung khong biet thieu gi ma quan tri cung khong biet bat o dau — dung kieu loi
   "khong noi ly do" da ghi trong feedback_qlnoibo_an_nut_khong_noi_ly_do. */
function requireChucNang(moduleCode, maChucNang, hanhDong) {
  return (req, res, next) => {
    const user = req.session && req.session.user;
    if (!user) return res.status(401).json({ success: false, message: 'Chưa đăng nhập.' });
    if (user.isAdmin) return next();
    const cn = (user.chucNangPerm && user.chucNangPerm[moduleCode + ':' + maChucNang]) || null;
    if (!cn) return next(); // khong co dong cau hinh rieng -> mac dinh duoc phep (an toan)
    const action = chuanHoaHanhDong(hanhDong, req.method, moduleCode + '/' + maChucNang);
    const key = 'can' + action.charAt(0).toUpperCase() + action.slice(1); // canView/canEdit/canDelete
    if (cn[key] === false) {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản của bạn không có quyền ' + (action === 'view' ? 'xem' : action === 'delete' ? 'xóa' : 'sửa')
               + ' ở chức năng "' + moduleCode + '/' + maChucNang + '". Nhờ quản trị bật quyền đó cho tài khoản này.'
      });
    }
    next();
  };
}

// v5.52: cho qua nếu ÍT NHẤT 1 trong các chức năng cho phép (thiếu dòng cấu hình = mặc định cho phép).
// Dùng cho route DÙNG CHUNG nhiều chức năng, vd /orders/:maDH/phukien vừa là "Chỉ định NPL" (chidinhnpl)
// vừa là công đoạn "Phụ kiện" trong Ghi tiến độ (tiendo).
// v9.11: nhan them `hanhDong` tuy chon, y het requireChucNang o tren — de hai ham khong lech luat.
function requireChucNangAny(moduleCode, maChucNangs, hanhDong) {
  return (req, res, next) => {
    const user = req.session && req.session.user;
    if (!user) return res.status(401).json({ success: false, message: 'Chưa đăng nhập.' });
    if (user.isAdmin) return next();
    const action = chuanHoaHanhDong(hanhDong, req.method, moduleCode + '/[' + (maChucNangs || []).join('|') + ']');
    const key = 'can' + action.charAt(0).toUpperCase() + action.slice(1);
    const ok = (maChucNangs || []).some(mcn => {
      const cn = (user.chucNangPerm && user.chucNangPerm[moduleCode + ':' + mcn]) || null;
      return !cn || cn[key] !== false;
    });
    if (!ok) return res.status(403).json({
      success: false,
      message: 'Tài khoản của bạn không có quyền ' + (action === 'view' ? 'xem' : action === 'delete' ? 'xóa' : 'sửa')
             + ' ở bất kỳ chức năng nào trong: ' + (maChucNangs || []).map(m => moduleCode + '/' + m).join(', ')
             + '. Nhờ quản trị bật một trong số đó.'
    });
    next();
  };
}

/* v7.10 — KIEM TRA MOT NANG LUC (chuc nang co ChucNang.MacDinhCho = 0, vd 'QLSX/xemtatca').
   KHAC HAN requireChucNang o tren: o day "khong co dong cau hinh" = KHONG CO QUYEN (opt-in), vi
   loadUserContext.js da tu dien entry canView=false cho cac chuc nang MacDinhCho = 0. Dung cho cac
   quyen MO RONG pham vi (thay nhieu hon binh thuong) - mac dinh cho moi nguoi thi vo nghia.
   Tra ve BOOLEAN (khong phai middleware) vi cho dung la giua mot route, de noi rong bo loc. */
function coQuyenChucNang(user, moduleCode, maChucNang) {
  if (!user) return false;
  if (user.isAdmin) return true;
  const cn = user.chucNangPerm && user.chucNangPerm[moduleCode + ':' + maChucNang];
  return !!(cn && cn.canView === true);
}

module.exports = { requireAuth, requirePermission, canUpdateStage, requireChucNang, requireChucNangAny, coQuyenChucNang };
