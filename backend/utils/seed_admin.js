// Chay 1 lan sau khi import schema.sql de tao tai khoan admin dau tien.
// Cach chay: node utils/seed_admin.js <username> <password> <ho_ten>
// Vi du:    node utils/seed_admin.js admin admin123 "Quan Ly Tong"

const bcrypt = require('bcryptjs');
const { sql, getPool } = require('../db');

async function main() {
  const [, , username, password, hoTen] = process.argv;
  if (!username || !password) {
    console.log('Cách dùng: node utils/seed_admin.js <username> <password> "<Họ tên>"');
    process.exit(1);
  }
  const pool = await getPool();
  const hash = await bcrypt.hash(password, 10);

  const existing = await pool.request()
    .input('Username', sql.NVarChar, username)
    .query('SELECT UserID FROM Users WHERE Username = @Username');

  let userId;
  if (existing.recordset.length) {
    userId = existing.recordset[0].UserID;
    await pool.request()
      .input('UserID', sql.Int, userId)
      .input('PasswordHash', sql.NVarChar, hash)
      .query('UPDATE Users SET PasswordHash = @PasswordHash, UpdatedAt = SYSDATETIME() WHERE UserID = @UserID');
    console.log(`Đã cập nhật mật khẩu cho user có sẵn: ${username}`);
  } else {
    const result = await pool.request()
      .input('Username', sql.NVarChar, username)
      .input('PasswordHash', sql.NVarChar, hash)
      .input('HoTen', sql.NVarChar, hoTen || 'Quản trị hệ thống')
      .query(`INSERT INTO Users (Username, PasswordHash, HoTen)
              OUTPUT INSERTED.UserID
              VALUES (@Username, @PasswordHash, @HoTen)`);
    userId = result.recordset[0].UserID;
    console.log(`Đã tạo user mới: ${username} (UserID=${userId})`);
  }

  const adminGroup = await pool.request().query("SELECT GroupID FROM Groups WHERE IsAdmin = 1");
  if (!adminGroup.recordset.length) {
    console.error('Không tìm thấy nhóm Admin trong bảng Groups. Hãy chạy schema.sql trước.');
    process.exit(1);
  }
  const groupId = adminGroup.recordset[0].GroupID;

  await pool.request()
    .input('UserID', sql.Int, userId)
    .input('GroupID', sql.Int, groupId)
    .query(`IF NOT EXISTS (SELECT 1 FROM UserGroups WHERE UserID=@UserID AND GroupID=@GroupID)
            INSERT INTO UserGroups (UserID, GroupID) VALUES (@UserID, @GroupID)`);

  console.log('Hoàn tất! Đăng nhập bằng:', username, '/', password);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
