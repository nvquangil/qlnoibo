/* ================================================================================================
   v5.66.1 — CHỐNG DÒ MẬT KHẨU (brute force) cho mọi màn hình đăng nhập.
   Cần thiết từ khi cổng nội bộ được mở ra ngoài mạng LAN: bot quét cổng sẽ tìm thấy trang đăng
   nhập trong vài giờ và thử hàng nghìn mật khẩu phổ biến. Không thêm thư viện ngoài (không dùng
   express-rate-limit) để giữ nguyên danh sách dependency đang chạy ổn định.

   Cách hoạt động: đếm số lần SAI liên tiếp theo 2 chìa khoá độc lập
     - theo ĐỊA CHỈ IP            -> chặn 1 máy thử nhiều tài khoản khác nhau (spray)
     - theo IP + TÊN ĐĂNG NHẬP    -> chặn thử nhiều mật khẩu của cùng 1 tài khoản
   Quá ngưỡng thì KHOÁ TẠM 15 phút và trả 429. Đăng nhập đúng thì xoá bộ đếm.

   HẠN CHẾ CẦN BIẾT: bộ đếm nằm trong BỘ NHỚ tiến trình -> `pm2 restart` là xoá sạch. Đây là lớp
   phòng thủ cho kẻ tấn công tự động, KHÔNG thay thế được HTTPS + mật khẩu mạnh + hạn chế IP.
   ================================================================================================ */

const SO_LAN_TOI_DA = 8;                 // sai liên tiếp bao nhiêu lần thì khoá
const THOI_GIAN_KHOA_MS = 15 * 60 * 1000; // khoá 15 phút
const TOI_DA_BAN_GHI = 5000;              // dọn bớt để không phình bộ nhớ khi bị quét ồ ạt

const bangDem = new Map();   // key -> { dem, denKhi }

function layIP(req) {
  // req.ip đã tính sẵn theo cấu hình 'trust proxy' của Express (xem TRUST_PROXY trong .env).
  return String((req && (req.ip || (req.socket && req.socket.remoteAddress))) || '?');
}

function donRac() {
  if (bangDem.size <= TOI_DA_BAN_GHI) return;
  const now = Date.now();
  for (const [k, v] of bangDem) if (!v.denKhi || v.denKhi < now) bangDem.delete(k);
}

/* Trả về SỐ PHÚT còn bị khoá (0 = không bị khoá). */
function conBiKhoa(key) {
  const v = bangDem.get(key);
  if (!v || !v.denKhi) return 0;
  if (v.denKhi <= Date.now()) { bangDem.delete(key); return 0; }
  return Math.ceil((v.denKhi - Date.now()) / 60000);
}

function ghiNhanSai(key) {
  const v = bangDem.get(key) || { dem: 0, denKhi: 0 };
  v.dem += 1;
  if (v.dem >= SO_LAN_TOI_DA) { v.denKhi = Date.now() + THOI_GIAN_KHOA_MS; v.dem = 0; }
  bangDem.set(key, v);
  donRac();
}

function xoaBoDem(key) { bangDem.delete(key); }

/* ---- 3 hàm dùng ở route đăng nhập ----------------------------------------------------------
   kiemTraTruocKhiDangNhap(req, tenDangNhap)  -> { bikhoa: bool, phut, keyIP, keyUser }
   ghiNhanDangNhapSai(keys)                   -> tăng bộ đếm cả 2 chìa
   ghiNhanDangNhapDung(keys)                  -> xoá bộ đếm cả 2 chìa
------------------------------------------------------------------------------------------- */
function kiemTraTruocKhiDangNhap(req, tenDangNhap) {
  const ip = layIP(req);
  const keyIP = 'ip:' + ip;
  const keyUser = 'u:' + ip + '|' + String(tenDangNhap || '').trim().toLowerCase();
  const phut = Math.max(conBiKhoa(keyIP), conBiKhoa(keyUser));
  return { biKhoa: phut > 0, phut, ip, keyIP, keyUser };
}
function ghiNhanDangNhapSai(k) { ghiNhanSai(k.keyIP); ghiNhanSai(k.keyUser); }
function ghiNhanDangNhapDung(k) { xoaBoDem(k.keyIP); xoaBoDem(k.keyUser); }

module.exports = {
  SO_LAN_TOI_DA, THOI_GIAN_KHOA_MS,
  layIP, kiemTraTruocKhiDangNhap, ghiNhanDangNhapSai, ghiNhanDangNhapDung
};
