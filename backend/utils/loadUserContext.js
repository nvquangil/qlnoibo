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
  /* v9.71 (Nguyen 16/11: "tạo user mới không có mật khẩu thì đăng nhập lần đầu yêu cầu đổi mật khẩu"): cờ Users.PhaiDoiMatKhau
     (migration_v897). Truy vấn RIÊNG + try/catch — bản chưa migration (hoặc bộ kiểm với CSDL giả) vẫn chạy, cờ = false. */
  let phaiDoiMatKhau = false;
  try {
    const r = (await pool.request().input('UserID', sql.Int, userId).query('SELECT PhaiDoiMatKhau FROM Users WHERE UserID = @UserID')).recordset[0];
    phaiDoiMatKhau = !!(r && r.PhaiDoiMatKhau);
  } catch (e) { phaiDoiMatKhau = false; }

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
  // v9.59: ghi nho phan he / chuc nang nao CO dong ghi de rieng — luat MYPAY ben duoi chi nhuong
  // nhung dong nay (quan tri co y dat), khong nhuong dong theo nhom.
  const ghiDeRiengPhanHe = new Set();
  const ghiDeRiengChucNang = new Set();
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
        ghiDeRiengPhanHe.add(r.ModuleCode);
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
        ghiDeRiengChucNang.add(r.ModuleCode + ':' + r.MaChucNang);
      });
    } catch (e) {
      // Bang UserChucNangPermissions chua duoc tao (chua chay migration_v5_userperm.sql) - bo qua.
    }
  }

  /* ================================================================================================
     v9.59 — Nguyen 14/11/2026: "Bảng lương của tôi mặc định tự phân quyền cho user được gán mã nhân viên".
     v9.52 mới chỉ GHI DÒNG ghi đè riêng đúng lúc gắn (tạo / sửa user — routes/users.js moBangLuongCuaToi):
     người gắn TRƯỚC v9.52 không có dòng; nhóm nào từng mở Ma trận phân quyền rồi bấm Lưu thì bị MERGE
     CanView=0 cho MỌI phân hệ chưa tick (PUT /permissions/:groupId) ⇒ vẫn "gắn rồi mà không thấy".
     Nay là LUẬT LÚC NẠP PHIÊN, không cần dòng nào trong CSDL: có Users.NhanVienID ⇒ phân hệ MYPAY
     canView=true và tab luongcuatoi không bị ẩn, bất kể nhóm. Chỉ NHƯỜNG dòng GHI ĐÈ RIÊNG THEO USER
     đang CanView=0 — quản trị phải cố ý tick "Ghi đè riêng" rồi bỏ "Xem" cho đúng người đó (màn Phân
     quyền riêng hiện đúng dòng ấy, nên màn hình và máy chủ không nói hai kiểu). Dòng theo NHÓM không
     được coi là "cấm" vì lý do ở trên (ma trận ghi 0 hàng loạt, không phải cố ý).
     Route /bangluong/cuatoi và /luongmay/cuatoi vốn chỉ requireAuth và tự lọc theo NhanVienID của chính
     phiên ⇒ luật này chỉ MỞ MENU, không mở thêm dữ liệu của ai khác. Admin bỏ qua (thấy hết sẵn).
     Quyền nạp lúc đăng nhập (middleware/auth.js) ⇒ gắn xong, người đó đăng nhập lại mới thấy — như v9.52.
     myPayTuDong trả về để màn hình / bộ kiểm biết quyền đó là tự mở chứ không do dòng cấu hình nào.
     ================================================================================================ */
  /* === v9.59 MYPAY MAC DINH THEO NHAN VIEN — BAT DAU === */
  let myPayTuDong = false;
  if (!isAdmin && u.NhanVienID) {
    const mp = permissions.MYPAY;
    if (!(mp && mp.canView) && !ghiDeRiengPhanHe.has('MYPAY')) {
      permissions.MYPAY = Object.assign({ canCreate: false, canEdit: false, canDelete: false }, mp || {}, { canView: true });
      myPayTuDong = true;
    }
    /* v9.99: DANH SÁCH TRẮNG các chức năng TỰ PHỤC VỤ của MYPAY — mỗi mục chỉ xem dữ liệu của
       CHÍNH người đang đăng nhập (máy chủ lọc theo Users.NhanVienID của phiên), nên mở menu không
       mở thêm dữ liệu của ai. Trước v9.99 chỗ này ghi cứng mỗi 'luongcuatoi'; từ khi bảng chấm công
       tách thành chức năng riêng (migration_v908) mà không thêm vào đây thì nhóm nào từng bấm Lưu ở
       Ma trận phân quyền sẽ mất mục chấm công trong khi vẫn thấy phiếu lương — hai mục cùng tính
       chất mà xử sự khác nhau. Với 'congdoanmaycuatoi' hậu quả nặng hơn: thợ may MẤT ĐƯỜNG TỰ GHI
       công đoạn ⇒ mất lương khoán, im lặng — đúng loại thiệt hại mà luật v9.59 sinh ra để chặn.
       ⛔ KHÔNG thêm 'sanluongcuatoi' / 'congdoanmaytatca' vào đây: đó là NĂNG LỰC MacDinhCho = 0
          (phải tick mới có), tự mở là phá đúng ý nghĩa opt-in của chúng. */
    ['MYPAY:luongcuatoi', 'MYPAY:chamcongcuatoi', 'MYPAY:congdoanmaycuatoi'].forEach(kTab => {
      if (chucNangPerm[kTab] && chucNangPerm[kTab].canView === false && !ghiDeRiengChucNang.has(kTab)) {
        chucNangPerm[kTab] = Object.assign({}, chucNangPerm[kTab], { canView: true });
        myPayTuDong = true;
      }
    });
  }
  /* === v9.59 MYPAY MAC DINH THEO NHAN VIEN — KET THUC === */

  // hiddenChucNang duoc SUY RA tu chucNangPerm (canView=false) - giu lai de tuong thich nguoc voi
  // app.js (visibleTabsOf) dang doc truong nay de an/hien tab tren menu, khong can sua app.js.
  // TINH TRUOC khi bo sung cac chuc nang MacDinhCho=0 o duoi: chung la NANG LUC (vd QLSX/xemtatca),
  // KHONG phai tab tren menu - dua vao day chi lam ban danh sach tab bi an.
  const hiddenChucNang = Object.keys(chucNangPerm).filter(k => chucNangPerm[k].canView === false);

  /* v7.10 (migration_v684) — CHUC NANG "PHAI TICK MOI CO" (ChucNang.MacDinhCho = 0).
     Quy uoc chung cua he thong chuc nang la "khong co dong cau hinh = DUOC PHEP" (xem ghi chu tren
     va requireChucNang). Quy uoc do dung cho viec AN/HIEN tab, nhung SAI hoan toan voi cac chuc nang
     kieu NANG LUC MO RONG (vd 'QLSX/xemtatca' = xem het lenh SX bat ke cong doan): mac dinh cho la
     ai cung co, chang con y nghia gi. Nen voi cac dong MacDinhCho = 0, ta TU DIEN entry canView=false
     khi user chua duoc cap - de moi cho tieu thu (coQuyenChucNang) doc ra "khong co quyen". */
  if (!isAdmin) {
    try {
      const optIn = (await pool.request().query(
        `SELECT ModuleCode, MaChucNang FROM ChucNang WHERE ISNULL(MacDinhCho, 1) = 0`)).recordset;
      optIn.forEach(r => {
        const key = r.ModuleCode + ':' + r.MaChucNang;
        if (!chucNangPerm[key]) chucNangPerm[key] = { canView: false, canEdit: false, canDelete: false };
      });
    } catch (e) {
      // Chua chay migration_v684 (chua co cot MacDinhCho) - bo qua, giu nguyen hanh vi cu.
    }
  }

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
    chucNangPerm,
    phaiDoiMatKhau,   // v9.71: true = phải đổi mật khẩu trước khi dùng (app.js chặn màn hình)
    myPayTuDong   // v9.59: true = MYPAY mở tự động vì gắn nhân viên (không do dòng cấu hình nào)
  };
}

module.exports = { loadUserContext };
