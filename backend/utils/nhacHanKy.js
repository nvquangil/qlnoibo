/* ==================================================================================================
   v9.62 — NHẮC HẠN KÝ + ĐÁNH DẤU HẾT HẠN tự động (node-cron, cùng kiểu utils/checkOverdue.js & lichChamCong.js).
   --------------------------------------------------------------------------------------------------
   Mỗi ngày lúc cfg.gioNhac (mặc định 08:30), nếu cfg.batNhac:
     1. Hợp đồng "Chờ khách ký" quá HanKy ⇒ HetHan + nhật ký HET_HAN + email kế toán (cfg.emailKeToan).
     2. Hợp đồng "Chờ khách ký" còn ≤ cfg.nhacTruocNgay ngày và hôm nay chưa nhắc ⇒ gửi lại link (token MỚI — link cũ vô hiệu,
        vì CSDL chỉ giữ hash) qua kênh mặc định (email; SMS nếu cấu hình) + nhật ký NHAC_HAN + NhacLanCuoi.
   Mọi lỗi chỉ ghi log — không được làm chết tiến trình. chay(pool) tách riêng để bộ kiểm gọi với CSDL giả.
   ================================================================================================== */
'use strict';
const { sql, getPool } = require('../db');
const core = require('./hopDongCore');
const gui = require('./guiOtp');
const nhatKy = require('./nhatKyHopDong');

let _task = null, _cron = null;

async function chay(pool, tuyChon) {
  const cfg = await core.docCauHinhKy(pool);
  const kq = { hetHan: 0, nhac: 0, loi: [] };
  if (cfg.batNhac === false) return Object.assign(kq, { tat: true });
  // 1. hết hạn
  try {
    const hh = (await pool.request().query(`SELECT HopDongMBID, SoHopDong, TenHopDong FROM HopDongMB WHERE TrangThai=N'ChoKy' AND HanKy IS NOT NULL AND HanKy < SYSDATETIME()`)).recordset;
    for (const h of hh) {
      await pool.request().input('id', sql.Int, h.HopDongMBID).query(`UPDATE HopDongMB SET TrangThai=N'HetHan', UpdatedAt=SYSDATETIME() WHERE HopDongMBID=@id AND TrangThai=N'ChoKy'`);
      await pool.request().input('hd', sql.Int, h.HopDongMBID).query('UPDATE HopDongMBLink SET VoHieu=1 WHERE HopDongMBID=@hd');
      await nhatKy.ghi(pool, { hopDongId: h.HopDongMBID, hanhDong: 'HET_HAN', chiTiet: { tuDong: true } });
      if (cfg.emailKeToan) {
        const r = await gui.guiEmail({ to: cfg.emailKeToan, subject: `[${gui.tenCongTy()}] Hợp đồng ${h.SoHopDong} hết hạn ký`, text: `Hợp đồng ${h.SoHopDong} — ${h.TenHopDong} đã quá hạn mà khách chưa ký. Vào phần mềm: Thu hồi về nháp → sửa/xuất bản lại để gửi link mới.` });
        if (!r.ok) kq.loi.push(h.SoHopDong + ': ' + r.loi);
      }
      kq.hetHan++;
    }
  } catch (e) { kq.loi.push('hết hạn: ' + e.message); }
  // 2. nhắc
  try {
    const ngay = Math.max(0, Number(cfg.nhacTruocNgay) >= 0 ? Number(cfg.nhacTruocNgay) : 2);
    const ds = (await pool.request().input('n', sql.Int, ngay).query(`
      SELECT HopDongMBID FROM HopDongMB WHERE TrangThai=N'ChoKy' AND HanKy IS NOT NULL AND HanKy >= SYSDATETIME() AND HanKy <= DATEADD(day, @n, SYSDATETIME())
        AND (NhacLanCuoi IS NULL OR CAST(NhacLanCuoi AS DATE) < CAST(SYSDATETIME() AS DATE))`)).recordset;
    for (const r of ds) {
      try {
        const d = await core.docHopDong(pool, r.HopDongMBID);
        if (!d || !d.benKhach) continue;
        const san = gui.kenhSanSang();
        const kenh = (cfg.kenhMacDinh === 'sms' && san.sms && d.benKhach.SDT) ? 'sms' : (san.email && d.benKhach.Email ? 'email' : (san.sms && d.benKhach.SDT ? 'sms' : null));
        if (!kenh) { kq.loi.push(d.hd.SoHopDong + ': không có kênh gửi'); continue; }
        const hanCu = d.hd.HanKy;   // chuỗi 'yyyy-mm-dd hh:mm:ss' (giờ máy chủ)
        const g = await core.guiLinkChoKhach(pool, d, kenh, { userId: null });
        /* guiLinkChoKhach → taoLink đặt lại HanKy = hôm nay + hanLinkNgay (đúng cho "gửi lại link" tay). NHẮC HẠN thì KHÔNG được
           dời hạn — nếu không hợp đồng không bao giờ hết hạn (nhắc → +7 ngày → nhắc …). Trả HanKy + hạn link về mốc cũ. */
        if (hanCu) {
          await pool.request().input('id', sql.Int, r.HopDongMBID).input('h', sql.NVarChar(19), String(hanCu))
            .query('UPDATE HopDongMB SET HanKy=CONVERT(datetime2, @h, 120), NhacLanCuoi=SYSDATETIME() WHERE HopDongMBID=@id; UPDATE HopDongMBLink SET HetHan=CONVERT(datetime2, @h, 120) WHERE HopDongMBID=@id AND VoHieu=0');
        } else await pool.request().input('id', sql.Int, r.HopDongMBID).query('UPDATE HopDongMB SET NhacLanCuoi=SYSDATETIME() WHERE HopDongMBID=@id');
        await nhatKy.ghi(pool, { hopDongId: r.HopDongMBID, hanhDong: 'NHAC_HAN', chiTiet: { kenh, ok: g.kq.ok, loi: g.kq.loi, conNgay: ngay } });
        kq.nhac++;
        if (!g.kq.ok) kq.loi.push(d.hd.SoHopDong + ': ' + g.kq.loi);
      } catch (e) { kq.loi.push('#' + r.HopDongMBID + ': ' + e.message); }
    }
  } catch (e) { kq.loi.push('nhắc: ' + e.message); }
  if (!tuyChon || !tuyChon.im) console.log(`[hopdong] nhắc hạn ký: ${kq.hetHan} hết hạn, ${kq.nhac} nhắc${kq.loi.length ? ' | lỗi: ' + kq.loi.join('; ').slice(0, 400) : ''}`);
  return kq;
}

function bieuThucCron(gio) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(gio || '08:30').trim());
  const h = m ? Math.min(23, Number(m[1])) : 8, p = m ? Math.min(59, Number(m[2])) : 30;
  return `${p} ${h} * * *`;
}
/* Đặt lịch theo cấu hình hiện tại; gọi lại khi lưu cấu hình (routes/hopdong.js PUT /cauhinh) để đổi giờ không cần restart. */
async function schedule() {
  try {
    const cron = require('node-cron');
    const pool = await getPool();
    const cfg = await core.docCauHinhKy(pool);
    if (_task) { try { _task.stop(); } catch (e) { /* bỏ */ } try { _task.destroy && _task.destroy(); } catch (e) { /* bỏ */ } _task = null; }   // như lichSaoLuu.js: hủy task cũ, node-cron không tự thay
    _cron = bieuThucCron(cfg.gioNhac);
    _task = cron.schedule(_cron, async () => { try { await chay(await getPool()); } catch (e) { console.error('[hopdong] nhắc hạn ký lỗi: ' + e.message); } }, { timezone: 'Asia/Ho_Chi_Minh' });
    console.log(`[hopdong] Lịch nhắc hạn ký: ${cfg.batNhac === false ? 'TẮT' : 'mỗi ngày ' + (cfg.gioNhac || '08:30') + ' (' + _cron + ')'}`);
  } catch (e) { console.warn('[hopdong] không đặt được lịch nhắc hạn ký: ' + e.message); }
}
module.exports = { chay, schedule, bieuThucCron };
