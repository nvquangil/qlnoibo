const express = require('express');
const { sql, getPool } = require('../db');
const { requireAuth } = require('../middleware/auth');
const push = require('../utils/webpush');   // v5.67: thông báo đẩy (Web Push)

const router = express.Router();

/* v5.67: bọc bắt lỗi async cấp router — Express 4 + Node ≥15, route async lỗi mà không try/catch
   sẽ làm SẬP tiến trình (xem ghi chú ở backend/server.js). */
['get', 'post', 'put', 'delete'].forEach(method => {
  const original = router[method].bind(router);
  router[method] = function (path, ...handlers) {
    return original(path, ...handlers.map(h => {
      if (typeof h !== 'function' || h.length > 3) return h;
      return function (req, res, next) {
        try {
          const out = h(req, res, next);
          if (out && typeof out.catch === 'function') out.catch(next);
          return out;
        } catch (e) { next(e); }
      };
    }));
  };
});

// ============ DANH SACH THONG BAO CUA TOI (moi nhat truoc, toi da 50) ============
router.get('/', requireAuth, async (req, res) => {
  const pool = await getPool();
  const userId = req.session.user.userId;
  const result = await pool.request().input('uid', sql.Int, userId).query(`
    SELECT TOP 50 n.NotificationID, n.NoiDung, n.DaDoc, n.CreatedAt, n.DonHangID, d.MaDH
    FROM ThongBao n
    LEFT JOIN DonHangSanXuat d ON d.DonHangID = n.DonHangID
    WHERE n.UserID = @uid
    ORDER BY n.CreatedAt DESC`);
  const unreadResult = await pool.request().input('uid', sql.Int, userId)
    .query('SELECT COUNT(*) AS SoLuong FROM ThongBao WHERE UserID=@uid AND DaDoc=0');
  res.json({ success: true, data: result.recordset, unread: unreadResult.recordset[0].SoLuong });
});

// ============ DANH DAU DA DOC (1 thong bao) ============
router.put('/:id/read', requireAuth, async (req, res) => {
  const pool = await getPool();
  await pool.request()
    .input('id', sql.Int, req.params.id).input('uid', sql.Int, req.session.user.userId)
    .query('UPDATE ThongBao SET DaDoc = 1 WHERE NotificationID = @id AND UserID = @uid');
  res.json({ success: true });
});

// ============ DANH DAU DA DOC TAT CA ============
router.put('/read-all', requireAuth, async (req, res) => {
  const pool = await getPool();
  await pool.request().input('uid', sql.Int, req.session.user.userId)
    .query('UPDATE ThongBao SET DaDoc = 1 WHERE UserID = @uid AND DaDoc = 0');
  res.json({ success: true });
});

/* ================================================================================================
   v5.67 — WEB PUSH: đăng ký / gỡ / thử. Mỗi THIẾT BỊ (trình duyệt) là 1 bản ghi.
   Yêu cầu bắt buộc của trình duyệt: trang phải chạy trên HTTPS (hoặc localhost). Vào bằng
   http://<tên máy>:3000 trong LAN sẽ KHÔNG đăng ký được — xem HUONG_DAN_CAI_DAT.md BƯỚC 2.86.
   ================================================================================================ */
router.get('/push/config', requireAuth, async (req, res) => {
  const pool = await getPool();
  const soThietBi = (await pool.request().input('uid', sql.Int, req.session.user.userId)
    .query('SELECT COUNT(*) AS n FROM PushSubscription WHERE UserID=@uid')).recordset[0].n;
  res.json({ success: true, data: { batDuoc: push.dangBat(), publicKey: push.khoaCongKhai(), soThietBi } });
});

router.post('/push/subscribe', requireAuth, async (req, res) => {
  const b = req.body || {};
  const endpoint = String(b.endpoint || '').trim();
  const p256dh = String((b.keys && b.keys.p256dh) || '').trim();
  const auth = String((b.keys && b.keys.auth) || '').trim();
  if (!endpoint || !p256dh || !auth) return res.status(400).json({ success: false, message: 'Thiếu thông tin đăng ký.' });
  const pool = await getPool();
  // Cùng 1 endpoint có thể đổi chủ (máy dùng chung, người khác đăng nhập) -> ghi đè UserID.
  await pool.request()
    .input('uid', sql.Int, req.session.user.userId)
    .input('ep', sql.NVarChar, endpoint).input('p', sql.NVarChar, p256dh).input('a', sql.NVarChar, auth)
    .input('ua', sql.NVarChar, String(req.headers['user-agent'] || '').slice(0, 300))
    .query(`
      MERGE PushSubscription AS t
      USING (SELECT @ep AS Endpoint) AS s ON t.Endpoint = s.Endpoint
      WHEN MATCHED THEN UPDATE SET UserID=@uid, P256dh=@p, Auth=@a, UserAgent=@ua
      WHEN NOT MATCHED THEN INSERT (UserID, Endpoint, P256dh, Auth, UserAgent) VALUES (@uid, @ep, @p, @a, @ua);`);
  res.json({ success: true });
});

router.post('/push/unsubscribe', requireAuth, async (req, res) => {
  const endpoint = String((req.body || {}).endpoint || '').trim();
  const pool = await getPool();
  await pool.request().input('ep', sql.NVarChar, endpoint).input('uid', sql.Int, req.session.user.userId)
    .query('DELETE FROM PushSubscription WHERE Endpoint=@ep AND UserID=@uid');
  res.json({ success: true });
});

// Gửi thử cho CHÍNH MÌNH — dùng để kiểm tra sau khi cài đặt.
router.post('/push/test', requireAuth, async (req, res) => {
  const pool = await getPool();
  const kq = await push.guiPush(pool, [req.session.user.userId], {
    title: 'QLNoiBo — thử thông báo',
    body: 'Nếu bạn thấy dòng này thì thông báo đẩy đã hoạt động. Bấm vào để mở phần mềm.',
    url: '/', tag: 'test'
  });
  if (!kq.guiDuoc) {
    return res.status(400).json({ success: false,
      message: kq.boQua === 'chua-cau-hinh'
        ? 'Máy chủ chưa cấu hình Web Push (thiếu thư viện web-push hoặc khoá VAPID).'
        : 'Chưa có thiết bị nào đăng ký nhận thông báo cho tài khoản này.' });
  }
  res.json({ success: true, message: `Đã gửi tới ${kq.guiDuoc} thiết bị.` });
});

// Ham dung chung: bao cho tat ca user duoc phan cong cong doan `stageId` biet don hang `order`
// vua chuyen sang cong doan do (dung trong routes/qlsx.js sau khi Ghi nhan tien do thanh cong).
// Khong bao cho chinh nguoi vua ghi nhan (thuong ho da biet).
async function notifyStageUsers(pool, { stageId, stageName, order, excludeUserId }) {
  if (!stageId || !order) return;
  const usersResult = await pool.request().input('stage', sql.Int, stageId).query(`
    SELECT DISTINCT uc.UserID FROM UserCongDoan uc WHERE uc.StageID = @stage`);
  const noiDung = `Đơn hàng ${order.MaDH} (${order.TenSanPham}) đã chuyển sang công đoạn "${stageName}", cần bạn cập nhật tiến độ.`;
  const nguoiNhan = [];
  for (const row of usersResult.recordset) {
    if (excludeUserId && Number(row.UserID) === Number(excludeUserId)) continue;
    await pool.request()
      .input('uid', sql.Int, row.UserID).input('don', sql.Int, order.DonHangID).input('nd', sql.NVarChar, noiDung)
      .query('INSERT INTO ThongBao (UserID, DonHangID, NoiDung) VALUES (@uid, @don, @nd)');
    nguoiNhan.push(row.UserID);
  }
  // v5.67: đẩy luôn ra ngoài màn hình (kể cả khi họ không mở phần mềm). Lỗi push không ảnh hưởng gì.
  await push.guiPush(pool, nguoiNhan, {
    title: `Công đoạn ${stageName}`,
    body: noiDung,
    url: '/#QLSX/tiendo',
    tag: 'tiendo-' + order.DonHangID
  });
}

module.exports = router;
module.exports.notifyStageUsers = notifyStageUsers;
