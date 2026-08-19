/* ================================================================================================
   v5.67 — WEB PUSH NOTIFICATION (thông báo đẩy tới máy tính/điện thoại kể cả khi không mở web).

   Cách hoạt động:
     1. Trình duyệt của từng người đăng ký nhận thông báo -> trả về "endpoint" + 2 khoá; lưu vào
        bảng PushSubscription (migration_v659).
     2. Khi có việc cần báo, backend gọi guiPush(pool, [userId...], {...}) -> thư viện `web-push`
        gửi tới máy chủ đẩy của Google/Mozilla/Apple -> máy chủ đó đánh thức service worker
        (frontend/sw.js) trên thiết bị -> sw hiện thông báo với requireInteraction: true.

   NGUYÊN TẮC: LỖI GỬI PUSH KHÔNG BAO GIỜ ĐƯỢC LÀM HỎNG NGHIỆP VỤ CHÍNH. Mọi thứ ở đây đều nuốt lỗi
   và chỉ ghi log. Thiếu thư viện / thiếu khoá VAPID -> tự tắt, phần mềm chạy như chưa có tính năng.
   ================================================================================================ */
const { sql } = require('../db');

let webpush = null;
let sanSang = false;
let daCanhBao = false;

function khoiTao() {
  if (webpush !== null) return sanSang;
  try {
    webpush = require('web-push');
  } catch (e) {
    webpush = false;
    if (!daCanhBao) { daCanhBao = true; console.warn('[push] Chua cai thu vien: cd backend && npm install web-push  -> tinh nang thong bao day dang TAT.'); }
    return false;
  }
  const pub = process.env.VAPID_PUBLIC_KEY;
  const pri = process.env.VAPID_PRIVATE_KEY;
  const mail = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';
  if (!pub || !pri) {
    if (!daCanhBao) { daCanhBao = true; console.warn('[push] Thieu VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY trong .env -> tinh nang thong bao day dang TAT. Chay: node utils/taoVapidKeys.js'); }
    return false;
  }
  webpush.setVapidDetails(mail, pub, pri);
  sanSang = true;
  console.log('[push] Web Push da san sang.');
  return true;
}

function dangBat() { return khoiTao(); }
function khoaCongKhai() { return process.env.VAPID_PUBLIC_KEY || ''; }

/* Gửi thông báo đẩy tới TẤT CẢ thiết bị của danh sách userId.
   payload: { title, body, url, tag }
   - url: đường dẫn mở ra khi bấm vào thông báo (vd '/#KHOHANG/orders').
   - tag: thông báo cùng tag sẽ thay thế nhau thay vì xếp chồng (tránh spam).
   Endpoint chết (404/410) sẽ được XOÁ khỏi CSDL để lần sau không gửi nữa. */
async function guiPush(pool, userIds, payload) {
  try {
    if (!khoiTao()) return { guiDuoc: 0, boQua: 'chua-cau-hinh' };
    const ids = [...new Set((userIds || []).map(Number).filter(n => n > 0))];
    if (!ids.length) return { guiDuoc: 0 };

    const rq = pool.request();
    const thamSo = ids.map((id, i) => { rq.input('u' + i, sql.Int, id); return '@u' + i; }).join(',');
    const rows = (await rq.query(
      `SELECT PushID, Endpoint, P256dh, Auth FROM PushSubscription WHERE UserID IN (${thamSo})`)).recordset;
    if (!rows.length) return { guiDuoc: 0 };

    const noiDung = JSON.stringify({
      title: payload.title || 'QLNoiBo',
      body: payload.body || '',
      url: payload.url || '/',
      tag: payload.tag || 'qlnoibo'
    });

    let guiDuoc = 0;
    for (const r of rows) {
      try {
        await webpush.sendNotification(
          { endpoint: r.Endpoint, keys: { p256dh: r.P256dh, auth: r.Auth } },
          noiDung,
          { TTL: 24 * 60 * 60, urgency: 'high' }
        );
        guiDuoc++;
        await pool.request().input('id', sql.Int, r.PushID)
          .query('UPDATE PushSubscription SET LanGuiCuoi = SYSDATETIME() WHERE PushID=@id');
      } catch (err) {
        const ma = err && err.statusCode;
        if (ma === 404 || ma === 410) {   // thiết bị đã gỡ đăng ký / đổi endpoint -> dọn rác
          await pool.request().input('id', sql.Int, r.PushID)
            .query('DELETE FROM PushSubscription WHERE PushID=@id').catch(() => {});
          console.log(`[push] Xoa dang ky het han (PushID=${r.PushID}).`);
        } else {
          console.warn('[push] Gui that bai:', ma || (err && err.message));
        }
      }
    }
    return { guiDuoc };
  } catch (e) {
    console.error('[push] Loi tong quat (bo qua):', e.message);
    return { guiDuoc: 0 };
  }
}

module.exports = { dangBat, khoaCongKhai, guiPush };
