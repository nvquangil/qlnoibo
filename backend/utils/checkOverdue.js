// Kiem tra don hang tre han / sap den han va gui email canh bao.
// Duoc goi tu dong hang ngay luc 8:00 sang (qua node-cron, xem ham schedule() o cuoi file),
// hoac goi thu cong qua endpoint POST /api/qlsx/canhbao/chay-ngay (xem routes/qlsx.js).

const cron = require('node-cron');
const nodemailer = require('nodemailer');
const { sql, getPool } = require('../db');

async function checkOverdueOrders() {
  const pool = await getPool();

  const cfgResult = await pool.request().query('SELECT * FROM CauHinhHeThong');
  const cfg = {};
  cfgResult.recordset.forEach(r => { cfg[r.ConfigKey] = r.ConfigValue; });
  const emails = (cfg.EmailCanhBao || '').split(',').map(s => s.trim()).filter(Boolean);
  const warnDays = Number(cfg.SoNgayCanhBaoTruocHan) || 2;

  const ordersResult = await pool.request().query(`
    SELECT MaDH, TenSanPham, kh.TenKhachHang, NgayGiaoDuKien, PhanTramHoanThanh, TrangThai, c.TenCongDoan
    FROM DonHangSanXuat d
    LEFT JOIN KhachHang kh ON kh.KhachHangID = d.KhachHangID
    LEFT JOIN CongDoanSanXuat c ON c.StageID = d.CongDoanHienTaiID
    WHERE d.TrangThai <> N'Hoàn thành'`);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const overdue = [], soon = [];

  ordersResult.recordset.forEach(o => {
    if (!o.NgayGiaoDuKien) return;
    const ngayGiao = new Date(o.NgayGiaoDuKien); ngayGiao.setHours(0, 0, 0, 0);
    const diffDays = Math.round((ngayGiao - today) / (1000 * 60 * 60 * 24));
    const item = { ...o, diffDays };
    if (diffDays < 0) overdue.push(item);
    else if (diffDays <= warnDays) soon.push(item);
  });

  if ((overdue.length || soon.length) && emails.length && process.env.SMTP_HOST) {
    await sendAlertEmail(emails, overdue, soon);
  }
  return { overdue: overdue.length, soon: soon.length };
}

async function sendAlertEmail(emails, overdue, soon) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 465,
    secure: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });

  let html = '<h3>Báo cáo tiến độ sản xuất</h3>';
  if (overdue.length) {
    html += '<h4 style="color:red;">Đơn hàng TRỄ HẠN:</h4><ul>';
    overdue.forEach(o => {
      html += `<li><b>${o.MaDH}</b> - ${o.TenSanPham} (${o.TenKhachHang || ''}) - trễ ${Math.abs(o.diffDays)} ngày - công đoạn: ${o.TenCongDoan || ''} - ${o.PhanTramHoanThanh}%</li>`;
    });
    html += '</ul>';
  }
  if (soon.length) {
    html += '<h4 style="color:orange;">Đơn hàng SẮP ĐẾN HẠN:</h4><ul>';
    soon.forEach(o => {
      html += `<li><b>${o.MaDH}</b> - ${o.TenSanPham} (${o.TenKhachHang || ''}) - còn ${o.diffDays} ngày - công đoạn: ${o.TenCongDoan || ''} - ${o.PhanTramHoanThanh}%</li>`;
    });
    html += '</ul>';
  }

  await transporter.sendMail({
    from: process.env.SMTP_USER,
    to: emails.join(','),
    subject: `Cảnh báo tiến độ đơn hàng (${overdue.length} trễ hạn, ${soon.length} sắp đến hạn)`,
    html
  });
}

function schedule() {
  // 8:00 sang moi ngay, gio server
  cron.schedule('0 8 * * *', () => {
    checkOverdueOrders().catch(err => console.error('[CanhBao] Lỗi:', err.message));
  });
  console.log('[CanhBao] Đã lên lịch kiểm tra trễ hạn lúc 8:00 sáng hàng ngày.');
}

module.exports = { checkOverdueOrders, schedule };
