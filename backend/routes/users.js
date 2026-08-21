const express = require('express');
const bcrypt = require('bcryptjs');
const { sql, getPool } = require('../db');
const { requireAuth, requirePermission } = require('../middleware/auth');

const router = express.Router();

// ============ USERS ============
router.get('/', requireAuth, requirePermission('USERS', 'view'), async (req, res) => {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT u.UserID, u.Username, u.HoTen, u.Email, u.IsActive, u.BoPhanID, b.TenBoPhan,
           STRING_AGG(g.TenNhom, ', ') AS Nhom
    FROM Users u
    LEFT JOIN BoPhan b ON b.BoPhanID = u.BoPhanID
    LEFT JOIN UserGroups ug ON ug.UserID = u.UserID
    LEFT JOIN Groups g ON g.GroupID = ug.GroupID
    GROUP BY u.UserID, u.Username, u.HoTen, u.Email, u.IsActive, u.BoPhanID, b.TenBoPhan
    ORDER BY u.UserID`);
  res.json({ success: true, data: result.recordset });
});

router.get('/:id', requireAuth, requirePermission('USERS', 'view'), async (req, res) => {
  const pool = await getPool();
  const id = req.params.id;
  const u = await pool.request().input('id', sql.Int, id).query('SELECT * FROM Users WHERE UserID=@id');
  if (!u.recordset.length) return res.status(404).json({ success: false, message: 'Không tìm thấy user.' });
  const groups = await pool.request().input('id', sql.Int, id).query('SELECT GroupID FROM UserGroups WHERE UserID=@id');
  const stages = await pool.request().input('id', sql.Int, id).query('SELECT StageID FROM UserCongDoan WHERE UserID=@id');
  const { PasswordHash, ...safe } = u.recordset[0];
  res.json({ success: true, data: { ...safe, groupIds: groups.recordset.map(r => r.GroupID), stageIds: stages.recordset.map(r => r.StageID) } });
});

router.post('/', requireAuth, requirePermission('USERS', 'create'), async (req, res) => {
  try {
    const { username, password, hoTen, email, boPhanId, groupIds, stageIds, isActive, nhanVienId } = req.body;
    if (!username || !password || !hoTen) {
      return res.status(400).json({ success: false, message: 'Thiếu tên đăng nhập / mật khẩu / họ tên.' });
    }
    const pool = await getPool();
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.request()
      .input('Username', sql.NVarChar, username.trim())
      .input('PasswordHash', sql.NVarChar, hash)
      .input('HoTen', sql.NVarChar, hoTen)
      .input('Email', sql.NVarChar, email || null)
      .input('BoPhanID', sql.Int, boPhanId || null)
      .input('IsActive', sql.Bit, isActive !== false)
      .input('NhanVienID', sql.Int, nhanVienId || null)
      .query(`INSERT INTO Users (Username, PasswordHash, HoTen, Email, BoPhanID, IsActive, NhanVienID)
              OUTPUT INSERTED.UserID
              VALUES (@Username, @PasswordHash, @HoTen, @Email, @BoPhanID, @IsActive, @NhanVienID)`);
    const userId = result.recordset[0].UserID;
    await assignGroupsAndStages(pool, userId, groupIds, stageIds);
    res.json({ success: true, data: { userId } });
  } catch (err) {
    console.error(err);
    const dup = /UNIQUE|duplicate/i.test(err.message);
    res.status(400).json({ success: false, message: dup ? 'Tên đăng nhập đã tồn tại.' : 'Lỗi khi tạo user.' });
  }
});

router.put('/:id', requireAuth, requirePermission('USERS', 'edit'), async (req, res) => {
  try {
    const id = req.params.id;
    const { password, hoTen, email, boPhanId, groupIds, stageIds, isActive, nhanVienId } = req.body;
    const pool = await getPool();
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      await pool.request().input('id', sql.Int, id).input('h', sql.NVarChar, hash)
        .query('UPDATE Users SET PasswordHash=@h, UpdatedAt=SYSDATETIME() WHERE UserID=@id');
    }
    await pool.request()
      .input('id', sql.Int, id)
      .input('HoTen', sql.NVarChar, hoTen)
      .input('Email', sql.NVarChar, email || null)
      .input('BoPhanID', sql.Int, boPhanId || null)
      .input('IsActive', sql.Bit, isActive !== false)
      .input('NhanVienID', sql.Int, nhanVienId || null)
      .query(`UPDATE Users SET HoTen=@HoTen, Email=@Email, BoPhanID=@BoPhanID, IsActive=@IsActive, NhanVienID=@NhanVienID, UpdatedAt=SYSDATETIME()
              WHERE UserID=@id`);
    await assignGroupsAndStages(pool, id, groupIds, stageIds);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Lỗi khi cập nhật user.' });
  }
});

router.delete('/:id', requireAuth, requirePermission('USERS', 'delete'), async (req, res) => {
  const pool = await getPool();
  await pool.request().input('id', sql.Int, req.params.id).query('DELETE FROM Users WHERE UserID=@id');
  res.json({ success: true });
});

async function assignGroupsAndStages(pool, userId, groupIds, stageIds) {
  await pool.request().input('id', sql.Int, userId).query('DELETE FROM UserGroups WHERE UserID=@id');
  if (Array.isArray(groupIds)) {
    for (const gid of groupIds) {
      await pool.request().input('id', sql.Int, userId).input('gid', sql.Int, gid)
        .query('INSERT INTO UserGroups (UserID, GroupID) VALUES (@id, @gid)');
    }
  }
  await pool.request().input('id', sql.Int, userId).query('DELETE FROM UserCongDoan WHERE UserID=@id');
  if (Array.isArray(stageIds)) {
    for (const sid of stageIds) {
      await pool.request().input('id', sql.Int, userId).input('sid', sql.Int, sid)
        .query('INSERT INTO UserCongDoan (UserID, StageID) VALUES (@id, @sid)');
    }
  }
}

// ============ GROUPS ============
router.get('/groups/list', requireAuth, requirePermission('USERS', 'view'), async (req, res) => {
  const pool = await getPool();
  const result = await pool.request().query('SELECT * FROM Groups ORDER BY GroupID');
  res.json({ success: true, data: result.recordset });
});

router.post('/groups', requireAuth, requirePermission('USERS', 'create'), async (req, res) => {
  const pool = await getPool();
  const { tenNhom, moTa, isAdmin } = req.body;
  const result = await pool.request()
    .input('TenNhom', sql.NVarChar, tenNhom)
    .input('MoTa', sql.NVarChar, moTa || null)
    .input('IsAdmin', sql.Bit, !!isAdmin)
    .query('INSERT INTO Groups (TenNhom, MoTa, IsAdmin) OUTPUT INSERTED.* VALUES (@TenNhom, @MoTa, @IsAdmin)');
  res.json({ success: true, data: result.recordset[0] });
});

router.delete('/groups/:id', requireAuth, requirePermission('USERS', 'delete'), async (req, res) => {
  const pool = await getPool();
  await pool.request().input('id', sql.Int, req.params.id).query('DELETE FROM Groups WHERE GroupID=@id');
  res.json({ success: true });
});

// ============ MODULES (danh sach phan he de dung trong ma tran phan quyen) ============
router.get('/modules/list', requireAuth, requirePermission('USERS', 'view'), async (req, res) => {
  const pool = await getPool();
  const result = await pool.request().query('SELECT * FROM Modules ORDER BY ThuTu');
  res.json({ success: true, data: result.recordset });
});

// ============ PERMISSIONS MATRIX (theo GroupID) ============
router.get('/permissions/:groupId', requireAuth, requirePermission('USERS', 'view'), async (req, res) => {
  const pool = await getPool();
  const result = await pool.request().input('gid', sql.Int, req.params.groupId).query(`
    SELECT m.ModuleID, m.ModuleCode, m.TenModule,
           ISNULL(p.CanView,0) AS CanView, ISNULL(p.CanCreate,0) AS CanCreate,
           ISNULL(p.CanEdit,0) AS CanEdit, ISNULL(p.CanDelete,0) AS CanDelete
    FROM Modules m
    LEFT JOIN Permissions p ON p.ModuleID = m.ModuleID AND p.GroupID = @gid
    ORDER BY m.ThuTu`);
  res.json({ success: true, data: result.recordset });
});

router.put('/permissions/:groupId', requireAuth, requirePermission('USERS', 'edit'), async (req, res) => {
  const pool = await getPool();
  const groupId = req.params.groupId;
  const rows = req.body.permissions || []; // [{ moduleId, canView, canCreate, canEdit, canDelete }]
  for (const r of rows) {
    await pool.request()
      .input('gid', sql.Int, groupId).input('mid', sql.Int, r.moduleId)
      .input('v', sql.Bit, !!r.canView).input('c', sql.Bit, !!r.canCreate)
      .input('e', sql.Bit, !!r.canEdit).input('d', sql.Bit, !!r.canDelete)
      .query(`MERGE Permissions AS t USING (SELECT @gid AS GroupID, @mid AS ModuleID) AS s
              ON t.GroupID = s.GroupID AND t.ModuleID = s.ModuleID
              WHEN MATCHED THEN UPDATE SET CanView=@v, CanCreate=@c, CanEdit=@e, CanDelete=@d
              WHEN NOT MATCHED THEN INSERT (GroupID, ModuleID, CanView, CanCreate, CanEdit, CanDelete)
                VALUES (@gid, @mid, @v, @c, @e, @d);`);
  }
  res.json({ success: true });
});

// ============ PHAN QUYEN CHI TIET THEO CHUC NANG (v5.0 - bo sung, xem migration_v5_chucnang.sql) ============
// An/hien tung tab/man hinh con trong 1 phan he theo tung nhom quyen. Doc them ghi chu trong
// loadUserContext.js: mac dinh (chua co dong nao trong ChucNangPermissions) = duoc xem.
/* v7.10 (migration_v684) — `MacDinhCho` quyet dinh o TICK SAN hay KHONG khi chua co dong cau hinh.
   Chuc nang thuong: MacDinhCho = 1 (tick san, dung nhu truoc gio). Chuc nang kieu NANG LUC MO RONG
   (vd QLSX/xemtatca): MacDinhCho = 0 -> KHONG tick san. Neu de tick san thi chi can ai mo Ma tran
   phan quyen ra bam Luu la MERGE se ghi CanView = 1 cho ca nhom = vo tinh cap quyen xem het lenh SX.
   Ham nay tra ve mot manh SQL cho gia tri mac dinh, tu do doi ban cai chua chay migration_v684. */
async function bieuThucMacDinhChucNang(pool) {
  const r = await pool.request().query("SELECT COL_LENGTH('ChucNang','MacDinhCho') AS Co");
  return r.recordset[0] && r.recordset[0].Co ? 'ISNULL(cn.MacDinhCho, 1)' : '1';
}

router.get('/permissions-chucnang/:groupId', requireAuth, requirePermission('USERS', 'view'), async (req, res) => {
  const pool = await getPool();
  try {
    const macDinh = await bieuThucMacDinhChucNang(pool);
    const result = await pool.request().input('gid', sql.Int, req.params.groupId).query(`
      SELECT cn.ChucNangID, cn.ModuleCode, cn.MaChucNang, cn.TenChucNang,
             CAST(${macDinh} AS BIT) AS MacDinhCho,
             ISNULL(cp.CanView, ${macDinh}) AS CanView,
             ISNULL(cp.CanEdit, ${macDinh}) AS CanEdit,
             ISNULL(cp.CanDelete, ${macDinh}) AS CanDelete
      FROM ChucNang cn
      LEFT JOIN ChucNangPermissions cp ON cp.ChucNangID = cn.ChucNangID AND cp.GroupID = @gid
      ORDER BY cn.ModuleCode, cn.ThuTu`);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.json({ success: true, data: [], message: 'Chưa chạy migration_v5_chucnang.sql nên chưa có danh mục chức năng.' });
  }
});

// v5.3: nhan them canEdit/canDelete (truoc chi co canView). Neu client cu (chua nang cap) chi gui
// canView, canEdit/canDelete se undefined -> !!undefined = false -> MAC DINH SIET CHAT khi thieu du
// lieu la an toan hon la mo rong nham, nhung frontend v5.3 luon gui du ca 3 nen truong hop nay hiem.
router.put('/permissions-chucnang/:groupId', requireAuth, requirePermission('USERS', 'edit'), async (req, res) => {
  const pool = await getPool();
  const groupId = req.params.groupId;
  const rows = req.body.items || []; // [{ chucNangId, canView, canEdit, canDelete }]
  for (const r of rows) {
    await pool.request()
      .input('gid', sql.Int, groupId).input('cnid', sql.Int, r.chucNangId)
      .input('v', sql.Bit, !!r.canView).input('e', sql.Bit, !!r.canEdit).input('d', sql.Bit, !!r.canDelete)
      .query(`MERGE ChucNangPermissions AS t USING (SELECT @gid AS GroupID, @cnid AS ChucNangID) AS s
              ON t.GroupID = s.GroupID AND t.ChucNangID = s.ChucNangID
              WHEN MATCHED THEN UPDATE SET CanView = @v, CanEdit = @e, CanDelete = @d
              WHEN NOT MATCHED THEN INSERT (GroupID, ChucNangID, CanView, CanEdit, CanDelete) VALUES (@gid, @cnid, @v, @e, @d);`);
  }
  res.json({ success: true });
});

// ============ PHAN QUYEN THEO TUNG USER (v5.0 - bo sung, xem migration_v5_userperm.sql) ============
// Lop OVERRIDE cao nhat, DE TREN phan quyen theo nhom: chon 1 user cu the, tick truc tiep vao o
// phan quyen cho dung user do (khong can tao/doi nhom). Khong tick "Ghi de rieng" = user van dung
// dung quyen tinh tu (cac) nhom cua ho nhu binh thuong. Doc them ghi chu trong loadUserContext.js.
router.get('/permissions-user/:userId', requireAuth, requirePermission('USERS', 'view'), async (req, res) => {
  const pool = await getPool();
  try {
    const result = await pool.request().input('uid', sql.Int, req.params.userId).query(`
      SELECT m.ModuleID, m.ModuleCode, m.TenModule,
             CASE WHEN up.UserPermissionID IS NULL THEN 0 ELSE 1 END AS HasOverride,
             ISNULL(up.CanView,0) AS CanView, ISNULL(up.CanCreate,0) AS CanCreate,
             ISNULL(up.CanEdit,0) AS CanEdit, ISNULL(up.CanDelete,0) AS CanDelete
      FROM Modules m
      LEFT JOIN UserPermissions up ON up.ModuleID = m.ModuleID AND up.UserID = @uid
      ORDER BY m.ThuTu`);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.json({ success: true, data: [], message: 'Chưa chạy migration_v5_userperm.sql nên chưa có bảng phân quyền riêng theo user.' });
  }
});

router.put('/permissions-user/:userId', requireAuth, requirePermission('USERS', 'edit'), async (req, res) => {
  const pool = await getPool();
  const userId = req.params.userId;
  const rows = req.body.permissions || []; // [{ moduleId, override, canView, canCreate, canEdit, canDelete }]
  try {
    for (const r of rows) {
      if (r.override) {
        await pool.request()
          .input('uid', sql.Int, userId).input('mid', sql.Int, r.moduleId)
          .input('v', sql.Bit, !!r.canView).input('c', sql.Bit, !!r.canCreate)
          .input('e', sql.Bit, !!r.canEdit).input('d', sql.Bit, !!r.canDelete)
          .query(`MERGE UserPermissions AS t USING (SELECT @uid AS UserID, @mid AS ModuleID) AS s
                  ON t.UserID = s.UserID AND t.ModuleID = s.ModuleID
                  WHEN MATCHED THEN UPDATE SET CanView=@v, CanCreate=@c, CanEdit=@e, CanDelete=@d
                  WHEN NOT MATCHED THEN INSERT (UserID, ModuleID, CanView, CanCreate, CanEdit, CanDelete)
                    VALUES (@uid, @mid, @v, @c, @e, @d);`);
      } else {
        // Bo tick "Ghi de rieng" -> xoa dong override, user tro lai dung quyen tinh tu nhom.
        await pool.request().input('uid', sql.Int, userId).input('mid', sql.Int, r.moduleId)
          .query('DELETE FROM UserPermissions WHERE UserID=@uid AND ModuleID=@mid');
      }
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Lỗi khi lưu phân quyền riêng theo user (đã chạy migration_v5_userperm.sql chưa?): ' + err.message });
  }
});

router.get('/permissions-chucnang-user/:userId', requireAuth, requirePermission('USERS', 'view'), async (req, res) => {
  const pool = await getPool();
  try {
    const macDinh = await bieuThucMacDinhChucNang(pool); // v7.10: xem ghi chu o /permissions-chucnang
    const result = await pool.request().input('uid', sql.Int, req.params.userId).query(`
      SELECT cn.ChucNangID, cn.ModuleCode, cn.MaChucNang, cn.TenChucNang,
             CASE WHEN ucp.UserChucNangPermissionID IS NULL THEN 0 ELSE 1 END AS HasOverride,
             CAST(${macDinh} AS BIT) AS MacDinhCho,
             ISNULL(ucp.CanView, ${macDinh}) AS CanView,
             ISNULL(ucp.CanEdit, ${macDinh}) AS CanEdit,
             ISNULL(ucp.CanDelete, ${macDinh}) AS CanDelete
      FROM ChucNang cn
      LEFT JOIN UserChucNangPermissions ucp ON ucp.ChucNangID = cn.ChucNangID AND ucp.UserID = @uid
      ORDER BY cn.ModuleCode, cn.ThuTu`);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.json({ success: true, data: [], message: 'Chưa chạy migration_v5_chucnang.sql / migration_v5_userperm.sql nên chưa có danh mục chức năng riêng theo user.' });
  }
});

router.put('/permissions-chucnang-user/:userId', requireAuth, requirePermission('USERS', 'edit'), async (req, res) => {
  const pool = await getPool();
  const userId = req.params.userId;
  const rows = req.body.items || []; // [{ chucNangId, override, canView, canEdit, canDelete }]
  try {
    for (const r of rows) {
      if (r.override) {
        await pool.request()
          .input('uid', sql.Int, userId).input('cnid', sql.Int, r.chucNangId)
          .input('v', sql.Bit, !!r.canView).input('e', sql.Bit, !!r.canEdit).input('d', sql.Bit, !!r.canDelete)
          .query(`MERGE UserChucNangPermissions AS t USING (SELECT @uid AS UserID, @cnid AS ChucNangID) AS s
                  ON t.UserID = s.UserID AND t.ChucNangID = s.ChucNangID
                  WHEN MATCHED THEN UPDATE SET CanView = @v, CanEdit = @e, CanDelete = @d
                  WHEN NOT MATCHED THEN INSERT (UserID, ChucNangID, CanView, CanEdit, CanDelete) VALUES (@uid, @cnid, @v, @e, @d);`);
      } else {
        await pool.request().input('uid', sql.Int, userId).input('cnid', sql.Int, r.chucNangId)
          .query('DELETE FROM UserChucNangPermissions WHERE UserID=@uid AND ChucNangID=@cnid');
      }
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Lỗi khi lưu phân quyền chức năng riêng theo user: ' + err.message });
  }
});

module.exports = router;
