const { sql, getPool } = require('../db');

// Tai toan bo thong tin can thiet cho session: nhom, quyen theo module, cong doan duoc phep cap nhat
async function loadUserContext(userId) {
  const pool = await getPool();

  const userResult = await pool.request()
    .input('UserID', sql.Int, userId)
    .query(`SELECT u.UserID, u.Username, u.HoTen, u.Email, u.BoPhanID, u.NhanVienID, b.TenBoPhan
            FROM Users u LEFT JOIN BoPhan b ON b.BoPhanID = u.BoPhanID
            WHERE u.UserID = @UserID`);
  if (!userResult.recordset.length) return null;
  const u = userResult.recordset[0];

  const groupsResult = await pool.request()
    .input('UserID', sql.Int, userId)
    .query(`SELECT g.GroupID, g.TenNhom, g.IsAdmin
            FROM UserGroups ug JOIN Groups g ON g.GroupID = ug.GroupID
            WHERE ug.UserID = @UserID`);
  const groups = groupsResult.recordset;
  const isAdmin = groups.some(g => g.IsAdmin);

  const permissions = {};
  if (!isAdmin && groups.length) {
    const groupIds = groups.map(g => g.GroupID);
    const permResult = await pool.request().query(`
      SELECT m.ModuleCode,
             MAX(CAST(p.CanView AS INT)) AS CanView,
             MAX(CAST(p.CanCreate AS INT)) AS CanCreate,
             MAX(CAST(p.CanEdit AS INT)) AS CanEdit,
             MAX(CAST(p.CanDelete AS INT)) AS CanDelete
      FROM Permissions p
      JOIN Modules m ON m.ModuleID = p.ModuleID
      WHERE p.GroupID IN (${groupIds.join(',')})
      GROUP BY m.ModuleCode`);
    permResult.recordset.forEach(r => {
      permissions[r.ModuleCode] = {
        canView: !!r.CanView, canCreate: !!r.CanCreate, canEdit: !!r.CanEdit, canDelete: !!r.CanDelete
      };
    });
  }

  const stageResult = await pool.request()
    .input('UserID', sql.Int, userId)
    .query(`SELECT c.StageID, c.TenCongDoan FROM UserCongDoan uc
            JOIN CongDoanSanXuat c ON c.StageID = uc.StageID
            WHERE uc.UserID = @UserID ORDER BY c.ThuTu`);
  // v5.9 (yeu cau "Mã công đoạn... mở rộng thành sửa lại toàn bộ các chỗ so sánh trực tiếp theo TÊN công
  // đoạn... sang so sánh theo mã/StageID"): congDoan (mang TEN) GIU LAI de tuong thich nguoc/hien thi
  // (khong con noi nao trong code dung no de SO SANH quyen nua) - congDoanIds (mang StageID, on dinh,
  // khong doi khi ai do doi TEN cong doan trong Danh muc) la truong MOI, dung cho canUpdateStage() va
  // bo loc /orders theo cong doan (xem qlsx.js, middleware/auth.js).
  const congDoan = stageResult.recordset.map(r => r.TenCongDoan);
  const congDoanIds = stageResult.recordset.map(r => r.StageID);

  // Phan quyen CHI TIET theo tung CHUC NANG (v5.0: chi co Xem; v5.3: bo sung Sua/Xoa rieng -
  // xem migration_v53.sql). chucNangPerm la map "MODULECODE:machucnang" -> {canView,canEdit,canDelete},
  // CHI chua entry cho chuc nang nao co it nhat 1 dong cau hinh (theo nhom hoac rieng user); chuc
  // nang KHONG co trong map = mac dinh DUOC PHEP CA 3 (an toan, khong lam mat quyen ai khi chua cau
  // hinh gi them). Gia tri cuoi cung se duoc GIAO (AND) voi quyen cap PHAN HE o noi tieu thu
  // (middleware requireChucNang & frontend effectivePerm()) - map nay KHONG tu AND voi permissions o day.
  let chucNangPerm = {};
  if (!isAdmin && groups.length) {
    const groupIds = groups.map(g => g.GroupID);
    try {
      const cnResult = await pool.request().query(`
        SELECT cn.ModuleCode, cn.MaChucNang,
               MAX(CAST(cp.CanView AS INT)) AS CanView,
               MAX(CAST(cp.CanEdit AS INT)) AS CanEdit,
               MAX(CAST(cp.CanDelete AS INT)) AS CanDelete
        FROM ChucNangPermissions cp
        JOIN ChucNang cn ON cn.ChucNangID = cp.ChucNangID
        WHERE cp.GroupID IN (${groupIds.join(',')})
        GROUP BY cn.ModuleCode, cn.MaChucNang`);
      // MAX(CAST(bit AS INT)) theo nhom = "chi can 1 nhom cho phep la duoc" (giong tinh than cu:
      // uu tien nhom cho phep hon khi user thuoc nhieu nhom mau thuan nhau).
      cnResult.recordset.forEach(r => {
        chucNangPerm[r.ModuleCode + ':' + r.MaChucNang] = {
          canView: !!r.CanView, canEdit: !!r.CanEdit, canDelete: !!r.CanDelete
        };
      });
    } catch (e) {
      // Bang ChucNang/ChucNangPermissions chua duoc tao (chua chay migration_v5_chucnang.sql) -
      // bo qua, coi nhu khong han che gi ca (giu dung hanh vi cu truoc v5.0).
      chucNangPerm = {};
    }
  }

  // v5.0: phan quyen rieng theo TUNG USER (xem migration_v5_userperm.sql) - lop OVERRIDE cao nhat,
  // DE TREN phan quyen theo nhom da tinh o tren. Chi ap dung khi co dong tuong ung; khong co dong nao
  // thi giu nguyen ket qua tinh theo nhom (an toan, khong lam mat quyen ai khi chua cau hinh gi them).
  // Ap dung ke ca khi user KHONG thuoc nhom nao (cho phep cap quyen rieng ma khong can tao nhom).
  if (!isAdmin) {
    try {
      const upResult = await pool.request().input('uid', sql.Int, userId).query(`
        SELECT m.ModuleCode, up.CanView, up.CanCreate, up.CanEdit, up.CanDelete
        FROM UserPermissions up JOIN Modules m ON m.ModuleID = up.ModuleID
        WHERE up.UserID = @uid`);
      upResult.recordset.forEach(r => {
        permissions[r.ModuleCode] = {
          canView: !!r.CanView, canCreate: !!r.CanCreate, canEdit: !!r.CanEdit, canDelete: !!r.CanDelete
        };
      });
    } catch (e) {
      // Bang UserPermissions chua duoc tao (chua chay migration_v5_userperm.sql) - bo qua.
    }

    try {
      const ucnResult = await pool.request().input('uid', sql.Int, userId).query(`
        SELECT cn.ModuleCode, cn.MaChucNang, ucp.CanView, ucp.CanEdit, ucp.CanDelete
        FROM UserChucNangPermissions ucp JOIN ChucNang cn ON cn.ChucNangID = ucp.ChucNangID
        WHERE ucp.UserID = @uid`);
      // Dong UserChucNangPermissions la GHI DE TOAN BO (ca 3 co) cho dung chuc nang do, thay the
      // hoan toan gia tri tinh tu nhom o tren - giong dung tinh than UserPermissions cap phan he.
      ucnResult.recordset.forEach(r => {
        chucNangPerm[r.ModuleCode + ':' + r.MaChucNang] = {
          canView: !!r.CanView, canEdit: !!r.CanEdit, canDelete: !!r.CanDelete
        };
      });
    } catch (e) {
      // Bang UserChucNangPermissions chua duoc tao (chua chay migration_v5_userperm.sql) - bo qua.
    }
  }

  // hiddenChucNang duoc SUY RA tu chucNangPerm (canView=false) - giu lai de tuong thich nguoc voi
  // app.js (visibleTabsOf) dang doc truong nay de an/hien tab tren menu, khong can sua app.js.
  const hiddenChucNang = Object.keys(chucNangPerm).filter(k => chucNangPerm[k].canView === false);

  return {
    userId: u.UserID,
    username: u.Username,
    hoTen: u.HoTen,
    email: u.Email,
    boPhan: u.TenBoPhan || null,
    nhanVienId: u.NhanVienID || null,
    groups: groups.map(g => g.TenNhom),
    isAdmin,
    permissions,
    congDoan,
    congDoanIds,
    hiddenChucNang,
    chucNangPerm
  };
}

module.exports = { loadUserContext };
