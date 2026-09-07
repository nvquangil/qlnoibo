/* ==================================================================================================
   NGÀY DẠNG yyyy-mm-dd THEO GIỜ MÁY CHỦ (giờ Việt Nam) — KHÔNG QUA UTC                      v7.72
   --------------------------------------------------------------------------------------------------
   ⚠️ `new Date().toISOString().slice(0, 10)` LÀ SAI với múi giờ Việt Nam (UTC+7):

     · `new Date(2026, 8, 1)` = 1/9 lúc 00:00 giờ VN → UTC là 2026-08-31T17:00Z
       ⇒ cắt 10 ký tự đầu ra **"2026-08-31"**. Đây là lỗi Nguyen báo ở v7.72:
       "Dashboard kinh doanh xem tháng này đang lấy từ 31 tháng trước".
     · Với "hôm nay": từ 00:00 đến 06:59 giờ VN, UTC vẫn đang là ngày HÔM QUA ⇒ mọi mặc định
       "hôm nay" bị **lùi 1 ngày**. Lỗi không báo gì, chỉ âm thầm ghi/lọc sai ngày.

   Cách đúng: lấy năm/tháng/ngày theo giờ máy (getFullYear/getMonth/getDate) rồi tự ghép chuỗi.

   Bản song sinh ở frontend: `ngayISO()` / `homNayISO()` trong frontend/js/common.js — sửa một bên
   thì sửa cả bên kia.

   ⚠️⚠️ KHÔNG DÙNG HÀM NÀY CHO GIÁ TRỊ ĐỌC TỪ CSDL — ở đó `toISOString()` MỚI LÀ ĐÚNG.
   Lý do: `mssql` mặc định `options.useUTC = true` (db.js không khai lại), nên một cột DATETIME lưu
   "05/09/2026 20:00" (giờ VN) được dựng thành Date có **UTC = 20:00Z**. Khi đó:
       · `toISOString().slice(0,10)` -> "2026-09-05"  ✔ đúng ngày đã lưu
       · `ngayISO()` (giờ máy +7)    -> "2026-09-06"  ✘ lệch sang ngày sau
   Tức HAI NHÓM NGƯỢC CHIỀU NHAU, đừng "đổi cho đồng bộ":
       NHÓM A — mốc thời gian tính từ `new Date()` ở máy (hôm nay, đầu tháng, N ngày trước)
                => DÙNG các hàm trong file này.
       NHÓM B — định dạng lại giá trị lấy từ CSDL
                => giữ `toISOString().slice(0,10)` hoặc `String(x).slice(0,10)`.
   ================================================================================================== */

function ngayISO(d) {
  /* Chặn rỗng TRƯỚC khi dựng Date: `new Date(null)` KHÔNG phải NaN mà là mốc 1970-01-01 — để lọt
     là ô ngày trên phiếu hiện "1970-01-01" thay vì để trống. (Bộ kiểm chứng bắt được lỗi này.) */
  if (d === null || d === undefined || d === '') return '';
  const dt = (d instanceof Date) ? d : new Date(d);
  if (isNaN(dt)) return '';
  return dt.getFullYear() + '-'
    + String(dt.getMonth() + 1).padStart(2, '0') + '-'
    + String(dt.getDate()).padStart(2, '0');
}

function homNayISO() { return ngayISO(new Date()); }

/* N ngày trước hôm nay (nNgay = 0 -> hôm nay). Cộng/trừ bằng setDate nên tự nhảy tháng/năm đúng. */
function ngayTruocISO(nNgay) {
  const d = new Date();
  d.setDate(d.getDate() - (Number(nNgay) || 0));
  return ngayISO(d);
}

module.exports = { ngayISO, homNayISO, ngayTruocISO };
