const express = require('express');
const bcrypt = require('bcryptjs');
const { sql, getPool } = require('../db');
const { loadUserContext } = require('../utils/loadUserContext');
const chongDo = require('../utils/chongDoMatKhau');   // v5.66.1: chặn dò mật khẩu tự động

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập tên đăng nhập và mật khẩu.' });
    }
    /* v5.66.1: khoá tạm sau nhiều lần sai liên tiếp (theo IP và theo IP+tên đăng nhập).
       BẮT BUỘC khi cổng nội bộ mở ra ngoài LAN — xem backend/utils/chongDoMatKhau.js. */
    const keys = chongDo.kiemTraTruocKhiDangNhap(req, username);
    if (keys.biKhoa) {
      console.warn(`[login] KHOA TAM ${keys.ip} - con ${keys.phut} phut (tai khoan thu: "${String(username).trim()}")`);
      return res.status(429).json({ success: false,
        message: `Sai quá nhiều lần. Vui lòng thử lại sau ${keys.phut} phút.` });
    }

    const pool = await getPool();
    const result = await pool.request()
      .input('Username', sql.NVarChar, String(username).trim())
      .query('SELECT UserID, PasswordHash, IsActive FROM Users WHERE Username = @Username');

    if (!result.recordset.length) {
      chongDo.ghiNhanDangNhapSai(keys);
      console.warn(`[login] SAI TEN "${String(username).trim()}" tu ${keys.ip}`);
      return res.status(401).json({ success: false, message: 'Sai tên đăng nhập hoặc mật khẩu.' });
    }
    const row = result.recordset[0];
    if (!row.IsActive) {
      return res.status(403).json({ success: false, message: 'Tài khoản đã bị khóa.' });
    }
    const ok = await bcrypt.compare(password, row.PasswordHash);
    if (!ok) {
      chongDo.ghiNhanDangNhapSai(keys);
      console.warn(`[login] SAI MAT KHAU "${String(username).trim()}" tu ${keys.ip}`);
      return res.status(401).json({ success: false, message: 'Sai tên đăng nhập hoặc mật khẩu.' });
    }

    chongDo.ghiNhanDangNhapDung(keys);
    const ctx = await loadUserContext(row.UserID);
    req.session.user = ctx;
    res.json({ success: true, user: ctx });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi đăng nhập.' });
  }
});

// Doi mat khau tu phuc vu (user dang nhap tu doi mat khau cua chinh minh - can nhap dung mat khau
// hien tai). Khac voi Admin reset mat khau cho nhan vien (PUT /api/users/:id, khong can biet mat
// khau cu - xem module.users.js openUserForm, da co san tu truoc).
router.put('/change-password', async (req, res) => {
  if (!req.session || !req.session.user) return res.status(401).json({ success: false, message: 'Chưa đăng nhập.' });
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập mật khẩu hiện tại và mật khẩu mới.' });
  }
  if (String(newPassword).length < 6) {
    return res.status(400).json({ success: false, message: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
  }
  const pool = await getPool();
  const userId = req.session.user.userId;
  const result = await pool.request().input('id', sql.Int, userId).query('SELECT PasswordHash FROM Users WHERE UserID=@id');
  if (!result.recordset.length) return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản.' });
  const ok = await bcrypt.compare(currentPassword, result.recordset[0].PasswordHash);
  if (!ok) return res.status(400).json({ success: false, message: 'Mật khẩu hiện tại không đúng.' });
  const hash = await bcrypt.hash(newPassword, 10);
  await pool.request().input('id', sql.Int, userId).input('h', sql.NVarChar, hash)
    .query('UPDATE Users SET PasswordHash=@h, UpdatedAt=SYSDATETIME() WHERE UserID=@id');
  res.json({ success: true, message: 'Đã đổi mật khẩu.' });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

router.get('/session', (req, res) => {
  if (req.session && req.session.user) {
    return res.json({ success: true, user: req.session.user });
  }
  res.status(401).json({ success: false });
});

module.exports = router;
