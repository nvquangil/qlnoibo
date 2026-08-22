require('dotenv').config();
const fs = require('fs');
const path = require('path');
const https = require('https');
const express = require('express');
const session = require('express-session');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const danhMucRoutes = require('./routes/danhmuc');
const qlsxRoutes = require('./routes/qlsx');
const khoVaiRoutes = require('./routes/khovai');
const khoHangRoutes = require('./routes/khohang');
const phuKienRoutes = require('./routes/phukien');
const banHangRoutes = require('./routes/banhang');   // v6.23: phiếu bán hàng (trừ tồn) + tồn khả dụng
const nhapLaiRoutes = require('./routes/nhaplai');   // v6.66: phiếu nhập lại (hàng khách trả) - hoàn tồn + giảm công nợ
const dashboardRoutes = require('./routes/dashboard'); // v6.67: dashboard kinh doanh (trang chủ khi đăng nhập)
const doiSoatRoutes = require('./routes/doisoat');   // v6.74: đối soát ngân hàng (khớp chuyển khoản -> phiếu thu)
const nhapKhoRoutes = require('./routes/nhapkho');   // v6.78: phiếu nhập kho hàng hóa (NCC / sản xuất)
const congNoRoutes = require('./routes/congno');     // v6.23: phiếu thu/chi + công nợ KH/NCC + danh mục tài khoản
const baoCaoRoutes = require('./routes/baocao');     // v6.26: báo cáo tồn kho / tài chính / kết quả kinh doanh
const dmsRoutes = require('./routes/dms');            // v7.23: đi tuyến thị trường (shop bán lẻ, ghé thăm GPS, doanh số NVKD)
const taiLieuKyThuatRoutes = require('./routes/tailieukythuat');
const bangKeRoutes = require('./routes/bangke');
const hrmRoutes = require('./routes/hrm');
const payrollRoutes = require('./routes/payroll');
const uploadRoutes = require('./routes/upload');
const anhRoutes = require('./routes/anh');   // v6.07: ảnh xem trước cỡ nhỏ (thumbnail) tạo theo yêu cầu
const notificationRoutes = require('./routes/notifications');
const publicRoutes = require('./routes/public');

const app = express();

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

/* v5.66.1: khi máy chủ nằm sau proxy/tunnel (Cloudflare Tunnel, nginx, IIS ARR...) thì bật
   TRUST_PROXY=1 trong .env để req.ip lấy đúng IP thật của khách (dùng cho log + chống dò mật khẩu)
   và để cookie "secure" nhận biết được kết nối HTTPS. KHÔNG bật khi nối thẳng — bật thừa sẽ cho
   phép kẻ tấn công giả IP bằng header X-Forwarded-For. */
if (process.env.TRUST_PROXY) {
  const tp = String(process.env.TRUST_PROXY).trim();
  /* Giá trị NÊN DÙNG khi chạy Cloudflare Tunnel: TRUST_PROXY=loopback
     -> chỉ tin header X-Forwarded-For khi request đến từ 127.0.0.1 (tức là do cloudflared chuyển
     tiếp). Truy cập THẲNG từ internet (NAT cổng) không đi qua loopback nên KHÔNG giả IP được —
     quan trọng vì bộ đếm chống dò mật khẩu tính theo IP. Đặt TRUST_PROXY=1 sẽ tin mọi nguồn. */
  app.set('trust proxy', /^\d+$/.test(tp) ? Number(tp) : tp);
}

/* ================================================================================================
   v5.68: TỰ ĐỘNG CHUYỂN http:// -> https://
   CHỈ chuyển khi CHẮC CHẮN địa chỉ đó có HTTPS, nếu không sẽ đẩy người dùng vào ngõ cụt:
     (a) Request đi qua Cloudflare/tunnel và báo `x-forwarded-proto: http`  -> chuyển
     (b) Tên miền nằm trong HTTPS_HOSTS khai ở .env                          -> chuyển
   Vào LAN bằng http://<tên máy>:3000 KHÔNG bị chuyển (máy đó không có chứng chỉ hợp lệ, chuyển là
   hỏng việc của cả xưởng). Chỉ chuyển GET/HEAD — chuyển hướng POST sẽ làm mất dữ liệu đang gửi.
   Dùng 302 (không phải 301) để sau này gỡ HTTPS thì trình duyệt không nhớ mãi.
   ================================================================================================ */
const HTTPS_HOSTS = String(process.env.HTTPS_HOSTS || '')
  .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

app.use((req, res, next) => {
  if (req.secure) return next();
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  /* v5.77: request ĐI QUA CLOUDFLARE (có header cf-ray) thì TUYỆT ĐỐI KHÔNG tự chuyển hướng ở đây.
     Cloudflare đã bọc HTTPS ở biên và có công tắc "Always Use HTTPS" lo việc này; nếu origin chạy
     sau chế độ SSL "Flexible" (Cloudflare -> origin bằng HTTP) mà ta lại trả 302 sang https thì
     trình duyệt quay lại Cloudflare -> Cloudflare gọi origin bằng http -> ta lại 302...
     => VÒNG LẶP CHUYỂN HƯỚNG VÔ HẠN (ERR_TOO_MANY_REDIRECTS). */
  if (req.headers['cf-ray']) return next();
  const xfp = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  const host = String(req.hostname || '').toLowerCase();
  const nenChuyen = xfp === 'http' || (HTTPS_HOSTS.length > 0 && HTTPS_HOSTS.includes(host));
  if (!nenChuyen) return next();
  /* v5.71: HTTPS_REDIRECT_PORT — nếu HTTPS KHÔNG chạy ở cổng 443 (vd nội bộ dùng 3443) thì phải
     chuyển kèm cổng, không thì đẩy người dùng sang cổng 443 không có ai nghe. Để trống = 443. */
  const congHttps = String(process.env.HTTPS_REDIRECT_PORT || '').trim();
  const hostKhongCong = String(req.headers.host || host).replace(/:\d+$/, '');
  const dich = hostKhongCong + (congHttps && congHttps !== '443' ? ':' + congHttps : '');
  return res.redirect(302, 'https://' + dich + req.originalUrl);
});

app.use(session({
  secret: process.env.SESSION_SECRET || 'change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',     // v5.66.1: không gửi cookie phiên khi bị trang khác nhúng/POST sang (chống CSRF cơ bản)
    secure: 'auto',      // tự bật cờ Secure khi truy cập qua HTTPS; qua HTTP thì như cũ
    maxAge: 8 * 60 * 60 * 1000 // 8 gio
  }
}));

/* ================================================================================================
   v5.66: TÁCH CỔNG — CÔNG KHAI vs NỘI BỘ
     http://<tên máy>          (cổng 80)   -> CHỈ trang Catalogue cho khách
     http://<tên máy>:3000                 -> Phần mềm nội bộ (đăng nhập, mọi phân hệ)
   Cùng MỘT ứng dụng Express nghe trên 2 cổng (để dùng CHUNG 1 phiên đăng nhập; nếu tách 2 app thì
   cookie chung theo tên máy nhưng kho phiên khác nhau -> đá nhau, khách/nhân viên bị văng liên tục).
   Cửa chặn dưới đây nhìn vào CỔNG mà request đi vào (req.socket.localPort) để quyết định cho qua.
   AN TOÀN: cổng công khai KHÔNG phục vụ index.html/login.html và KHÔNG cho gọi bất kỳ /api/ nào
   ngoài /api/public/* — kể cả khi ai đó biết đường dẫn.
   ================================================================================================ */
const PORT = Number(process.env.PORT || 3000);                 // nội bộ
const PUBLIC_PORT = Number(process.env.PUBLIC_PORT || 80);     // công khai (0 = tắt hẳn)
const TACH_CONG = PUBLIC_PORT > 0 && PUBLIC_PORT !== PORT;     // 2 cổng trùng nhau -> không chặn gì

// Đường dẫn tĩnh mà trang catalogue cần để hiển thị được.
function duocPhepCongKhai(duong) {
  return duong === '/catalogue.html'
    || duong === '/js/catalogue.js'
    || duong === '/favicon.ico'
    || duong.startsWith('/api/public/')
    || duong.startsWith('/css/')
    || duong.startsWith('/icons/')
    || duong.startsWith('/uploads/')       // ảnh sản phẩm (ảnh gốc)
    || duong.startsWith('/anh/')           // v6.07: ảnh xem trước cỡ nhỏ (routes/anh.js) — catalogue dùng
    || duong.startsWith('/.well-known/');  // để Let's Encrypt (win-acme) xác thực được qua cổng 80
}

app.use((req, res, next) => {
  if (!TACH_CONG) return next();
  const cong = req.socket && req.socket.localPort;
  if (Number(cong) !== PUBLIC_PORT) return next();             // đi vào cổng nội bộ -> qua bình thường
  if (req.path === '/' || req.path === '/index.html') return res.redirect('/catalogue.html');
  if (duocPhepCongKhai(req.path)) return next();
  if (req.path.startsWith('/api/')) {
    return res.status(403).json({ success: false, message: 'Địa chỉ này chỉ phục vụ trang catalogue công khai.' });
  }
  return res.redirect('/catalogue.html');
});

/* v6.07: ảnh trong /uploads có TÊN chứa mốc thời gian nên nội dung không bao giờ đổi -> cho trình duyệt
   nhớ đệm 1 NĂM (immutable). Trước đây không đặt maxAge nên mỗi lần mở trang, MỖI ảnh vẫn phải hỏi lại
   máy chủ (304) — vài chục ảnh là vài chục lượt chờ mạng, mở catalogue thấy ảnh hiện ra rất chậm.
   `dotfiles: 'deny'` để thư mục đệm .thumb không bị lộ qua /uploads/. */
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '365d', immutable: true, dotfiles: 'deny'
}));
// v6.07: /anh/<cạnh>/<tên file> — ảnh xem trước cỡ nhỏ, tạo theo yêu cầu + ghi đệm (xem routes/anh.js).
app.use('/anh', anhRoutes);

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/danhmuc', danhMucRoutes);
app.use('/api/qlsx', qlsxRoutes);
app.use('/api/khovai', khoVaiRoutes);
app.use('/api/khohang', khoHangRoutes);
app.use('/api/phukien', phuKienRoutes);
app.use('/api/banhang', banHangRoutes);   // v6.23
app.use('/api/nhaplai', nhapLaiRoutes);   // v6.66
app.use('/api/dashboard', dashboardRoutes);   // v6.67
app.use('/api/doisoat', doiSoatRoutes);   // v6.74
app.use('/api/nhapkho', nhapKhoRoutes);   // v6.78
app.use('/api/congno', congNoRoutes);     // v6.23
app.use('/api/baocao', baoCaoRoutes);     // v6.26
app.use('/api/dms', dmsRoutes);           // v7.23
app.use('/api/tailieukythuat', taiLieuKyThuatRoutes);
app.use('/api/bangke', bangKeRoutes);
app.use('/api/hrm', hrmRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/public', publicRoutes);   // khong qua requireAuth - dung cho catalogue.html cong khai

// Phuc vu frontend tinh (single deployable app)
const frontendDir = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendDir));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(frontendDir, 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ success: false, message: 'Lỗi máy chủ: ' + (err && err.message ? err.message : 'không rõ') });
});

// v5.56 — CHỐNG SẬP SERVER VÌ 1 ROUTE LỖI.
// Express 4 không bắt lỗi của handler `async`; từ Node 15 trở đi, một Promise bị reject mà không ai bắt
// sẽ làm SẬP CẢ TIẾN TRÌNH (pm2 khởi động lại → mọi người đang dùng bị văng/đăng nhập lại). Đây chính là
// nguyên nhân gốc khiến bấm mở Bảng kê BTP "không có gì xảy ra": request chết theo tiến trình, không có
// phản hồi nào để frontend báo lỗi. Nay chỉ GHI LOG và giữ server sống; frontend có timeout 30s để báo.
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection] Route async lỗi mà thiếu try/catch:', reason);
});

// PORT / PUBLIC_PORT đã khai báo ở phần "TÁCH CỔNG" phía trên.
const srvNoiBo = app.listen(PORT, () => console.log(`[Server] NỘI BỘ  : http://localhost:${PORT}  (đăng nhập, mọi phân hệ)`));
srvNoiBo.on('error', (e) => console.error(`[Server] KHÔNG mở được cổng nội bộ ${PORT}: ${e.message}`));

if (TACH_CONG) {
  const srvCongKhai = app.listen(PUBLIC_PORT, () =>
    console.log(`[Server] CÔNG KHAI: http://localhost:${PUBLIC_PORT}  -> chỉ trang Catalogue (gửi link này cho khách)`));
  // Cổng 80 hay bị IIS/Skype/World Wide Web Publishing Service chiếm. Nếu bận thì CHỈ cảnh báo,
  // KHÔNG để sập cả tiến trình (phần mềm nội bộ vẫn phải chạy).
  srvCongKhai.on('error', (e) => console.error(
    `[Server] KHÔNG mở được cổng công khai ${PUBLIC_PORT}: ${e.message}\n` +
    `         (cổng đang bị chương trình khác chiếm — xem: netstat -ano | findstr :${PUBLIC_PORT} ).\n` +
    `         Phần mềm nội bộ vẫn chạy bình thường ở cổng ${PORT}.`));
} else {
  console.log(`[Server] PUBLIC_PORT trùng PORT (hoặc = 0) -> KHÔNG tách cổng: cổng ${PORT} phục vụ cả nội bộ lẫn catalogue.`);
}

// v5.3 (muc 3): bat THEM 1 cong HTTPS song song (khong thay the HTTP) neu .env co khai bao duong dan
// chung chi (SSL_CERT_PATH/SSL_KEY_PATH) - dung de camera (quet QR) hoat dong duoc tren MOI may trong
// mang LAN, vi trinh duyet chi cho truy cap camera qua "secure context" (HTTPS, hoac rieng may chu qua
// localhost). Xem HUONG_DAN_CAI_DAT.md muc "Bat HTTPS bang mkcert" de tao chung chi + cai dat len tung
// thiet bi. Neu khong khai bao gi trong .env, phan nay tu bo qua - server chay HTTP nhu truoc, khong
// anh huong ai chua can dung tinh nang nay.
const SSL_CERT_PATH = process.env.SSL_CERT_PATH;
const SSL_KEY_PATH = process.env.SSL_KEY_PATH;
/* v5.72: NHẬN CẢ FILE .pfx (Windows). Chứng chỉ tự ký tạo bằng PowerShell (New-SelfSignedCertificate
   + Export-PfxCertificate) ra đúng định dạng .pfx — khai SSL_PFX_PATH là chạy, KHÔNG cần openssl,
   không cần tên miền, không cần internet. Dùng cho mục đích duy nhất: máy tính bảng trong mạng LAN
   quét QR bằng camera (trình duyệt chỉ mở camera trên HTTPS). */
const SSL_PFX_PATH = process.env.SSL_PFX_PATH;
const SSL_PFX_PASS = process.env.SSL_PFX_PASS || '';
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;

let httpsOptions = null;
try {
  if (SSL_PFX_PATH) {
    console.log(`[Server] HTTPS: đang đọc chứng chỉ .pfx  ${SSL_PFX_PATH}`);
    httpsOptions = { pfx: fs.readFileSync(SSL_PFX_PATH), passphrase: SSL_PFX_PASS };
  } else if (SSL_CERT_PATH && SSL_KEY_PATH) {
    console.log(`[Server] HTTPS: đang đọc chứng chỉ PEM  ${SSL_CERT_PATH}`);
    httpsOptions = { cert: fs.readFileSync(SSL_CERT_PATH), key: fs.readFileSync(SSL_KEY_PATH) };
  }
} catch (err) {
  console.error(`[Server] KHÔNG đọc được file chứng chỉ: ${err.message}\n` +
    `         Kiểm tra lại đường dẫn trong .env (SSL_PFX_PATH / SSL_CERT_PATH + SSL_KEY_PATH) và quyền đọc file.`);
}

if (httpsOptions) {
  /* v5.72.1: BỌC try/catch quanh createServer — mật khẩu .pfx SAI làm hàm này NÉM LỖI NGAY, không
     bắt thì sập cả tiến trình và pm2 restart vòng lặp (phần mềm nội bộ chết theo). */
  try {
    const srvHttps = https.createServer(httpsOptions, app);
    srvHttps.on('error', (e) => console.error(
      `[Server] KHÔNG mở được cổng HTTPS ${HTTPS_PORT}: ${e.message}\n` +
      `         (cổng bị chiếm — xem: netstat -ano | findstr :${HTTPS_PORT} ). Phần mềm vẫn chạy HTTP bình thường.`));
    srvHttps.listen(HTTPS_PORT, '0.0.0.0', () => {
      console.log(`[Server] HTTPS  : https://localhost:${HTTPS_PORT}  (máy tính bảng/điện thoại trong LAN quét QR bằng camera)`);
    });
  } catch (err) {
    console.error(`[Server] KHÔNG bật được HTTPS: ${err.message}\n` +
      `         Thường là SAI MẬT KHẨU file .pfx (SSL_PFX_PASS) hoặc file .pfx bị lỗi. Phần mềm vẫn chạy HTTP bình thường.`);
  }
} else {
  console.log('[Server] Chưa cấu hình chứng chỉ trong .env (SSL_PFX_PATH hoặc SSL_CERT_PATH+SSL_KEY_PATH) - chỉ chạy HTTP. Camera quét QR sẽ KHÔNG dùng được trên máy khác trong LAN.');
}

// Bat canh bao tre han tu dong (chay ngam trong tien trinh nay). Neu khong muon, comment dong duoi.
try { require('./utils/checkOverdue').schedule(); } catch (e) { console.warn('Không bật được lịch cảnh báo:', e.message); }
