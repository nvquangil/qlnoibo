/* ================================================================================================
   LỊCH SAO LƯU — đặt được lại khi người dùng đổi cấu hình                                 v9.37
   ------------------------------------------------------------------------------------------------
   Tách khỏi server.js vì lịch phải ĐẶT LẠI ĐƯỢC: người dùng đổi giờ chạy trên màn hình mà lịch vẫn
   theo giờ cũ tới lần restart sau là hỏng im lặng — màn hình báo đã lưu, thực tế không đổi gì.

   🔴 Phải HỦY task cũ trước khi tạo task mới. node-cron không tự thay thế: gọi `schedule()` hai lần
   là hai task cùng chạy, sao lưu hai lần một đêm, và sau vài lần đổi giờ thì thành năm sáu task.
   ================================================================================================ */
const cron = require('node-cron');
const saoLuu = require('./saoLuuCSDL');
const canhBao = require('./canhBaoSaoLuu');

let __task = null;
/* 🔴 v9.40: GHI LẠI trạng thái thật của lịch. Thiếu nó thì màn hình chỉ biết Ý MUỐN đã lưu (ô tick
   "Chạy tự động") chứ không biết THỰC TẾ — và `datLaiLich()` có ba đường từ chối đặt lịch mà chỉ
   console.warn, không ai đọc. Người dùng nhìn ô tick xanh rồi tin đêm nay có bản sao lưu. */
let __tt = { chay: false, lyDo: 'Lịch chưa được khởi động.' };
/* v9.41: lịch SAO LƯU LOG là task THỨ HAI, độc lập. Gộp vào một task là buộc hai nhịp hoàn toàn
   khác nhau (1 lần/ngày và 1 lần/giờ) vào cùng một biểu thức — không làm được. */
let __taskLog = null;
let __ttLog = { chay: false, lyDo: 'Chưa bật sao lưu log.' };

function huyMot(t) {
  if (!t) return;
  try { t.stop(); } catch (e) { /* bỏ qua */ }
  /* `destroy` có ở node-cron 3.x; gọi phòng khi `stop` chưa gỡ hẳn khỏi bộ đếm. */
  try { if (typeof t.destroy === 'function') t.destroy(); } catch (e) { /* bỏ qua */ }
}

function huyLich() {
  huyMot(__task); __task = null;
  huyMot(__taskLog); __taskLog = null;
}

/* Trạng thái lịch HIỆN TẠI — saoLuuCSDL.trangThai() đọc cái này để đẩy vào danh sách cảnh báo. */
function trangThaiLich() { return __tt; }
function trangThaiLichLog() { return __ttLog; }

/* Trả về mô tả trạng thái để route/màn hình nói được "lịch đang chạy lúc nào". */
function datLaiLich() {
  huyLich();
  const ch = saoLuu.cauHinh();

  /* 🔴 Tắt lịch chính thì PHẢI tắt luôn trạng thái lịch log. `huyLich()` ở trên đã hủy task thật,
     nhưng nếu không đặt lại `__ttLog` thì màn hình vẫn hiện "log đang chạy 01:00" — một lời nói dối
     đúng kiểu nguy hiểm nhất của màn hình sao lưu. Và sao lưu log mà không có sao lưu đầy đủ thì
     chuỗi log cũng vô nghĩa, nên tắt cùng nhau là đúng nghiệp vụ. */
  const tat = (lyDo) => {
    __tt = { chay: false, lyDo };
    __ttLog = { chay: false, lyDo: 'Lịch sao lưu đầy đủ không chạy — ' + lyDo };
    return __tt;
  };

  if (!ch.bat) return tat('Lịch đang TẮT trong cấu hình.');
  if (!ch.thuMuc) return tat('Chưa chọn thư mục sao lưu.');
  if (!cron.validate(ch.gioChay)) return tat('Giờ chạy không hợp lệ: "' + ch.gioChay + '".');

  try {
    __task = cron.schedule(ch.gioChay, async () => {
      try { await canhBao.chayVaBao('lich'); }
      catch (e) { console.error('[saoluu] lỗi ở lịch: ' + (e && e.message)); }
    });
  } catch (e) {
    /* `cron.validate` đã qua mà `schedule` vẫn ném = biểu thức lạ node-cron không nhận. Nuốt lỗi ở
       đây thì lịch chết câm; trả về trạng thái để màn hình nói ra. */
    return tat('node-cron từ chối biểu thức "' + ch.gioChay + '": ' + (e && e.message));
  }
  console.log('[saoluu] Lịch: "' + ch.gioChay + '" -> ' + ch.thuMuc
    + ' (giữ ' + ch.soNgayGiu + ' ngày, luôn giữ ' + ch.soBanLuonGiu + ' bản mới nhất)');
  __tt = { chay: true, gioChay: ch.gioChay, thuMuc: ch.thuMuc };

  /* --- v9.41: lịch sao lưu TRANSACTION LOG --- */
  const tatLog = (lyDo) => { __ttLog = { chay: false, lyDo }; };
  if (!ch.batLog) tatLog('Sao lưu log đang TẮT.');
  else if (!cron.validate(ch.gioChayLog)) tatLog('Giờ chạy log không hợp lệ: "' + ch.gioChayLog + '".');
  else {
    try {
      __taskLog = cron.schedule(ch.gioChayLog, async () => {
        try { await canhBao.chayLogVaBao('lich'); }
        catch (e) { console.error('[saoluu-log] lỗi ở lịch: ' + (e && e.message)); }
      });
      console.log('[saoluu-log] Lịch log: "' + ch.gioChayLog + '" -> ' + ch.thuMuc);
      __ttLog = { chay: true, gioChay: ch.gioChayLog };
    } catch (e) {
      tatLog('node-cron từ chối biểu thức "' + ch.gioChayLog + '": ' + (e && e.message));
    }
  }
  return __tt;
}

/* Gọi MỘT lần lúc khởi động: nạp cấu hình từ CSDL rồi bật lịch, và chạy bù nếu hôm nay chưa có bản.
   KHÔNG BAO GIỜ ném ra ngoài — lỗi ở đây tuyệt đối không được chặn việc khởi động phần mềm. */
async function khoiDong() {
  try {
    await saoLuu.napCauHinh();
    const tt = datLaiLich();
    if (!tt.chay) console.warn('[saoluu] LỊCH KHÔNG CHẠY — ' + tt.lyDo
      + ' Vào phân hệ "💾 Sao lưu dữ liệu" để cấu hình.');

    /* 🔴 CHẠY BÙ. pm2 restart đúng vào giờ hẹn là MẤT LƯỢT — cả ngày đó không có bản nào mà không
       ai biết. Hoãn 2 phút để không giành tài nguyên lúc phần mềm vừa khởi động. */
    setTimeout(async () => {
      try {
        if (!saoLuu.cauHinh().bat || !saoLuu.cauHinh().thuMuc) return;
        if (saoLuu.daCoBanHomNay()) return;
        console.log('[saoluu] Hôm nay chưa có bản nào — chạy bù.');
        await canhBao.chayVaBao('bu');
      } catch (e) { console.error('[saoluu] lỗi chạy bù: ' + (e && e.message)); }
    }, 2 * 60 * 1000).unref();
  } catch (e) {
    console.error('[saoluu] KHÔNG khởi động được lịch sao lưu: ' + (e && e.message));
  }
}

module.exports = { khoiDong, datLaiLich, huyLich, trangThaiLich, trangThaiLichLog };
