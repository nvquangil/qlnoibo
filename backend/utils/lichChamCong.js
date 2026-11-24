/* ================================================================================================
   LỊCH KÉO CHẤM CÔNG TỰ ĐỘNG                                                              v9.49
   ------------------------------------------------------------------------------------------------
   Nguyen 13/11/2026: "phần tải về chấm công từ máy chấm công cho tải tự động vào 1 thời gian cài đặt".

   Mỗi ngày đúng giờ cài (CauHinh CHAM_CONG_TU_DONG.gioChay): với MỌI máy chấm công đang Hoạt động,
   kéo `soNgayLui` ngày gần nhất (mặc định 3 — máy tắt / mạng hỏng một hai hôm thì lần sau vẫn vớt
   được, chống trùng đã có ở luuPunches), rồi TỔNG HỢP tháng hiện tại (+ tháng trước trong 3 ngày
   đầu tháng, vì ngày 1–3 vẫn còn kéo bù dữ liệu cuối tháng cũ).

   Cùng khuôn với lichSaoLuu.js: hủy task cũ trước khi đặt lại (node-cron không tự thay), ghi trạng
   thái THẬT (`__tt`) để màn hình nói đúng, chạy một lần không bao giờ ném ra ngoài.
   Dùng chung đúng hàm của nút "Kéo dữ liệu" / "Tổng hợp" (routes/payroll.js gắn lên router) —
   không viết bản thứ hai của việc kéo.

   🔴 KHÔNG đụng dòng ChamCongNgay đã sửa tay: tongHopChamCongThang chỉ MERGE dòng Nguon='May'.
   ================================================================================================ */
const cron = require('node-cron');

let __task = null;
let __tt = { chay: false, lyDo: 'Lịch chưa được khởi động.' };
let __lanCuoi = null;      // { luc, nguon, ketQua: [{may, ok, thongBao, inserted}], tongHop, loi }
let __dangChay = false;

function huyLich() {
  if (!__task) return;
  try { __task.stop(); } catch (e) { /* bỏ qua */ }
  try { if (typeof __task.destroy === 'function') __task.destroy(); } catch (e) { /* bỏ qua */ }
  __task = null;
}

/* 'HH:mm' -> biểu thức cron 'mm HH * * *'. Trả null nếu không hợp lệ. */
function cronTuGio(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
  if (!m) return null;
  const h = Number(m[1]), p = Number(m[2]);
  if (h > 23 || p > 59) return null;
  return `${p} ${h} * * *`;
}

function trangThai() {
  return Object.assign({}, __tt, { lanCuoi: __lanCuoi, dangChay: __dangChay });
}

/* Giờ địa phương dạng 'yyyy-mm-dd hh:mi' — KHÔNG toISOString (lệch UTC, bài học v7.72). */
function lucBayGio() {
  const d = new Date(), p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/* CHẠY MỘT LẦN: kéo mọi máy rồi tổng hợp. Không ném; trả kết quả để route "Chạy ngay" hiện ra. */
async function chayMotLan(nguon) {
  if (__dangChay) return { boQua: true, lyDo: 'Đang có một lượt kéo chưa xong.' };
  __dangChay = true;
  const kq = { luc: lucBayGio(), nguon: nguon || 'lich', ketQua: [], tongHop: [], loi: null };
  try {
    const { getPool, sql } = require('../db');
    const payroll = require('../routes/payroll');
    const pool = await getPool();
    const cfg = await payroll.getCauHinhChamCongTuDong(pool);
    /* 'Tạm dừng' là giá trị của ô Trạng thái trên form máy (module.payroll.js #m_tt) — máy tạm dừng thì bỏ qua. */
    const mays = (await pool.request().query(`SELECT * FROM MayChamCong WHERE ISNULL(TrangThai, N'') <> N'Tạm dừng' ORDER BY MayChamCongID`)).recordset;
    if (!mays.length) kq.loi = 'Không có máy chấm công nào đang Hoạt động.';
    const soNgay = Math.min(31, Math.max(1, Number(cfg.soNgayLui) || 3));
    const denNgay = new Date(); denNgay.setHours(23, 59, 59, 0);
    const tuNgay = new Date(); tuNgay.setDate(tuNgay.getDate() - (soNgay - 1)); tuNgay.setHours(0, 0, 0, 0);
    for (const may of mays) {
      try {
        const d = await payroll.keoDuLieuMay(pool, may, { tuNgay, denNgay, loMa: null });
        kq.ketQua.push({ mayId: may.MayChamCongID, may: may.TenMay, ok: true, inserted: d.inserted, filtered: d.filtered, unmatched: d.unmatched });
        console.log(`[chamcong-tudong] ${may.TenMay}: +${d.inserted} lần quẹt mới (${d.filtered} trong ${soNgay} ngày, ${d.unmatched} chưa gán NV)`);
      } catch (e) {
        kq.ketQua.push({ mayId: may.MayChamCongID, may: may.TenMay, ok: false, thongBao: e && e.message });
        console.error(`[chamcong-tudong] ${may.TenMay}: LỖI ${e && e.message}`);
      }
    }
    /* Tổng hợp chỉ khi có ít nhất một máy kéo được — máy nào cũng lỗi thì tổng hợp lại chẳng đổi gì,
       và tháng nào cũng ghi đè không cần thiết. Tháng trước: 3 ngày đầu tháng (kéo bù cuối tháng cũ). */
    if (cfg.tongHop !== false && kq.ketQua.some(x => x.ok)) {
      const hom = new Date();
      const ds = [[hom.getFullYear(), hom.getMonth() + 1]];
      if (hom.getDate() <= 3) { const t = new Date(hom.getFullYear(), hom.getMonth() - 1, 1); ds.push([t.getFullYear(), t.getMonth() + 1]); }
      for (const [nam, thang] of ds) {
        try {
          const r = await payroll.tongHopChamCongThang(pool, nam, thang);
          kq.tongHop.push({ nam, thang, ok: true, affected: r.affected, ngay: r.ngay, thieuQuet: r.thieuQuet });
          console.log(`[chamcong-tudong] tổng hợp ${thang}/${nam}: ${r.affected} dòng, ${r.thieuQuet} ngày thiếu quẹt`);
        } catch (e) {
          kq.tongHop.push({ nam, thang, ok: false, thongBao: e && e.message });
          console.error(`[chamcong-tudong] tổng hợp ${thang}/${nam}: LỖI ${e && e.message}`);
        }
      }
    }
  } catch (e) {
    kq.loi = (e && e.message) || String(e);
    console.error('[chamcong-tudong] LỖI: ' + kq.loi);
  } finally {
    __dangChay = false;
    __lanCuoi = kq;
  }
  return kq;
}

async function datLaiLich() {
  huyLich();
  let cfg;
  try {
    const { getPool } = require('../db');
    const payroll = require('../routes/payroll');
    cfg = await payroll.getCauHinhChamCongTuDong(await getPool());
  } catch (e) {
    __tt = { chay: false, lyDo: 'Không đọc được cấu hình: ' + (e && e.message) };
    return __tt;
  }
  if (!cfg.bat) { __tt = { chay: false, lyDo: 'Kéo tự động đang TẮT.' }; return __tt; }
  const bieuThuc = cronTuGio(cfg.gioChay);
  if (!bieuThuc || !cron.validate(bieuThuc)) { __tt = { chay: false, lyDo: 'Giờ chạy không hợp lệ: "' + cfg.gioChay + '".' }; return __tt; }
  try {
    __task = cron.schedule(bieuThuc, async () => {
      try { await chayMotLan('lich'); }
      catch (e) { console.error('[chamcong-tudong] lỗi ở lịch: ' + (e && e.message)); }
    });
  } catch (e) {
    __tt = { chay: false, lyDo: 'node-cron từ chối biểu thức "' + bieuThuc + '": ' + (e && e.message) };
    return __tt;
  }
  console.log(`[chamcong-tudong] Lịch: mỗi ngày ${cfg.gioChay}, kéo ${cfg.soNgayLui} ngày gần nhất${cfg.tongHop !== false ? ' + tổng hợp' : ''}`);
  __tt = { chay: true, gioChay: cfg.gioChay, soNgayLui: cfg.soNgayLui, tongHop: cfg.tongHop !== false };
  return __tt;
}

/* Gọi MỘT lần lúc khởi động. KHÔNG BAO GIỜ ném — không được chặn khởi động phần mềm.
   Không "chạy bù" như sao lưu: kéo chậm một ngày không mất gì (lần sau kéo soNgayLui ngày), còn kéo
   ngay lúc pm2 restart giữa ngày làm việc thì tổng hợp ra bảng công nửa ngày. */
async function khoiDong() {
  try {
    const tt = await datLaiLich();
    if (!tt.chay) console.log('[chamcong-tudong] Lịch không chạy — ' + tt.lyDo);
  } catch (e) {
    console.error('[chamcong-tudong] KHÔNG khởi động được lịch: ' + (e && e.message));
  }
}

module.exports = { khoiDong, datLaiLich, huyLich, trangThai, chayMotLan, cronTuGio };
