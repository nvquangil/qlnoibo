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

function requireChucNang(moduleCode, maChucNang) {
  return (req, res, next) => {
    const user = req.session && req.session.user;
    if (!user) return res.status(401).json({ success: false, message: 'Chưa đăng nhập.' });
    if (user.isAdmin) return next();
    const cn = (user.chucNangPerm && user.chucNangPerm[moduleCode + ':' + maChucNang]) || null;
    if (!cn) return next(); // khong co dong cau hinh rieng -> mac dinh duoc phep (an toan)
    const action = actionFromMethod(req.method);
    const key = 'can' + action.charAt(0).toUpperCase() + action.slice(1); // canView/canEdit/canDelete
    if (cn[key] === false) {
      return res.status(403).json({ success: false, message: 'Tài khoản của bạn không có quyền ' + (action === 'view' ? 'xem' : action === 'delete' ? 'xóa' : 'sửa') + ' ở chức năng này.' });
    }
    next();
  };
}

// v5.52: cho qua nếu ÍT NHẤT 1 trong các chức năng cho phép (thiếu dòng cấu hình = mặc định cho phép).
// Dùng cho route DÙNG CHUNG nhiều chức năng, vd /orders/:maDH/phukien vừa là "Chỉ định NPL" (chidinhnpl)
// vừa là công đoạn "Phụ kiện" trong Ghi tiến độ (tiendo).
function requireChucNangAny(moduleCode, maChucNangs) {
  return (req, res, next) => {
    const user = req.session && req.session.user;
    if (!user) return res.status(401).json({ success: false, message: 'Chưa đăng nhập.' });
    if (user.isAdmin) return next();
    const action = actionFromMethod(req.method);
    const key = 'can' + action.charAt(0).toUpperCase() + action.slice(1);
    const ok = (maChucNangs || []).some(mcn => {
      const cn = (user.chucNangPerm && user.chucNangPerm[moduleCode + ':' + mcn]) || null;
      return !cn || cn[key] !== false;
    });
    if (!ok) return res.status(403).json({ success: false, message: 'Tài khoản của bạn không có quyền thao tác ở chức năng này.' });
    next();
  };
}

module.exports = { requireAuth, requirePermission, canUpdateStage, requireChucNang, requireChucNangAny };
