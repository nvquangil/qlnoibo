/* ================================================================================================
   kiem_zalo_webhook.js  —  bộ tự kiểm cho v9.30 (webhook Zalo OA)

   KIỂM HÀNH VI: dựng app Express thật + router thật, bắn yêu cầu giả vào bằng http, xem nó trả gì.
   Không chạm mạng Zalo, không chạm cơ sở dữ liệu (chặn ở bước chữ ký là đủ cho phần nguy hiểm).

   Chạy:  node backend\utils\kiem_zalo_webhook.js
   KHÔNG copy file này sang D:\QLSX.
   ================================================================================================ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const http = require('http');
const crypto = require('crypto');
const express = require('express');

const GOC = path.join(__dirname, '..', '..');
const nguonZalo = fs.readFileSync(path.join(GOC, 'backend', 'routes', 'zalo.js'), 'utf8');
const nguonToken = fs.readFileSync(path.join(__dirname, 'zaloOaToken.js'), 'utf8');
const nguonApi = fs.readFileSync(path.join(__dirname, 'zaloOaApi.js'), 'utf8');
const nguonServer = fs.readFileSync(path.join(GOC, 'backend', 'server.js'), 'utf8');

let sai = 0, dat = 0;
const kiem = (ten, dung, td) => dung
  ? (dat++, console.log('  ✓ ' + ten))
  : (sai++, console.log('  ❌ ' + ten + (td ? ' — ' + td : '')));

/* Khóa giả. ĐẶT (không delete) — dotenv không đè biến đã có, nên dù .env của máy có khai khác thì
   bộ kiểm vẫn chạy với khóa của mình. 🔴 Đừng dùng `delete` ở đây: require bên dưới kéo theo
   dotenv, mà biến vừa bị xóa thì dotenv nạp LẠI từ .env — phép kiểm đỏ vì lý do chẳng liên quan. */
process.env.ZALO_OA_APP_ID = '1234567890';
process.env.ZALO_OA_APP_SECRET = 'bi-mat-gia-de-thu';
process.env.ZALO_OA_LOG_CHU_KY = '0';

(async () => {
  console.log('\n=== 1. BIÊN DỊCH ===');
  [['routes/zalo.js', nguonZalo], ['utils/zaloOaToken.js', nguonToken], ['utils/zaloOaApi.js', nguonApi],
   ['server.js', nguonServer]].forEach(([f, s]) => {
    try { new vm.Script(s, { filename: f }); dat++; console.log('  ✓ ' + f); }
    catch (e) { sai++; console.log('  ❌ ' + f + ' VỠ CÚ PHÁP: ' + e.message); }
  });

  console.log('\n=== 2. CỔNG CÔNG KHAI PHẢI CHO WEBHOOK QUA — NHƯNG CHỈ ĐÚNG NÓ ===');
  kiem('🔴 /api/zalo/webhook nằm trong danh sách trắng cổng 80',
       /\|\| duong === '\/api\/zalo\/webhook'/.test(nguonServer),
       'không có dòng này thì Zalo gọi vào ăn 403, webhook không bao giờ chạy');
  kiem('🔴 KHÔNG mở cả /api/zalo/ (route trangthai phải ở lại cổng nội bộ)',
       !/startsWith\('\/api\/zalo\/'\)/.test(nguonServer));
  kiem('giữ rawBody cho ĐÚNG đường dẫn webhook (chữ ký ký trên JSON nguyên bản)',
       /req\.originalUrl\.indexOf\('\/api\/zalo\/webhook'\) === 0\) req\.rawBody = buf/.test(nguonServer));
  kiem('đã gắn router vào app', /app\.use\('\/api\/zalo', zaloRoutes\);/.test(nguonServer));

  console.log('\n=== 3. CHỮ KÝ — chạy thật qua HTTP ===');
  const zaloRouter = require('../routes/zalo');
  const app = express();
  app.use(express.json({
    limit: '5mb',
    verify: (req, res, buf) => {
      if (req.originalUrl && req.originalUrl.indexOf('/api/zalo/webhook') === 0) req.rawBody = buf;
    }
  }));
  app.use('/api/zalo', zaloRouter);
  const server = http.createServer(app);
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const cong = server.address().port;

  function ban(body, sig) {
    const tho = JSON.stringify(body);
    return new Promise((giaiQuyet) => {
      const req = http.request({
        host: '127.0.0.1', port: cong, path: '/api/zalo/webhook', method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(tho) },
          sig ? { 'X-ZEvent-Signature': sig } : {})
      }, (res) => {
        let d = ''; res.on('data', c => d += c);
        res.on('end', () => giaiQuyet({ ma: res.statusCode, than: d }));
      });
      req.on('error', (e) => giaiQuyet({ ma: 0, than: String(e.message) }));
      req.end(tho);
    });
  }

  /* Sự kiện giả: cố ý KHÔNG dùng event_name thật để nếu lọt qua chữ ký cũng không chạm cơ sở dữ liệu.
     timestamp phải là GIỜ HIỆN TẠI — webhook chặn phát lại bằng cách đòi lệch dưới 5 phút. */
  const ky = (o) => crypto.createHash('sha256')
    .update(process.env.ZALO_OA_APP_ID + JSON.stringify(o) + String(o.timestamp) + process.env.ZALO_OA_APP_SECRET)
    .digest('hex');
  const moi = (them) => Object.assign({
    app_id: '1234567890', event_name: 'khong_co_that', timestamp: String(Date.now()),
    sender: { id: 'U_TEST' }, message: { msg_id: 'm' + Math.random(), text: 'xin chao' }
  }, them || {});
  /* 🔴 v9.34 — MÃ HTTP KHÔNG CÒN LÀ THƯỚC ĐO. Zalo chỉ khai được webhook khi URL trả 200, nên nay
     MỌI trường hợp đều 200; hàng rào là "không xử lý", không phải mã trả về (xem khối ghi chú trên
     router.post('/webhook')). Vì thế:
       · phép về mã: mọi POST phải 200, và thân trả về phải GIỐNG HỆT nhau (không thành máy dò);
       · phép về HÀNH VI: đếm `__demVut()` trước/sau mỗi lần bắn — tăng = đã vứt, không tăng = đã nhận.
     Đây mới đúng tinh thần "kiểm HÀNH VI, đừng so chuỗi". */
  const demVut = () => zaloRouter.__demVut();
  /* Trả về { ma, than, vut } — `vut` là thứ cần kiểm, `ma` chỉ để chắc Zalo khai được. */
  async function banDo(body, sig) {
    const truoc = demVut();
    const r = await ban(body, sig);
    return { ma: r.ma, than: r.than, vut: demVut() > truoc };
  }

  const sk = moi();
  const kyDung = ky(sk);

  let r = await banDo(sk, null);
  const thanChuan = r.than;
  kiem('🔴 KHÔNG có chữ ký -> VỨT (không xử lý)', r.vut === true);
  kiem('🔴 …nhưng vẫn trả 200 (Zalo chỉ khai webhook khi nhận 200)', r.ma === 200, 'nhận ' + r.ma);

  r = await banDo(sk, 'mac=' + 'f'.repeat(64));
  kiem('🔴 chữ ký SAI -> VỨT', r.vut === true);
  kiem('chữ ký SAI -> vẫn 200', r.ma === 200, 'nhận ' + r.ma);

  r = await banDo(sk, 'mac=' + kyDung);
  kiem('🔴 chữ ký ĐÚNG -> NHẬN (không vứt)', r.vut === false);
  kiem('chữ ký ĐÚNG -> 200', r.ma === 200, 'nhận ' + r.ma + ' ' + r.than);
  kiem('🔴 thân trả về của ca ĐÚNG và ca SAI phải GIỐNG HỆT (không làm máy dò công thức)',
       r.than === thanChuan, JSON.stringify(r.than) + ' vs ' + JSON.stringify(thanChuan));
  kiem('đã có ít nhất một tin qua được chữ ký (cờ __daTungQua bật)', zaloRouter.__daTungQua() === true);

  r = await banDo(sk, kyDung);   // không có tiền tố "mac="
  kiem('chấp nhận cả dạng không có tiền tố "mac=" -> NHẬN', r.vut === false);

  /* Đổi MỘT ký tự trong thân -> chữ ký cũ phải hỏng (chứng minh ký trên THÂN THÔ, không phải thân parse lại). */
  const skDoi = Object.assign({}, sk, { message: { msg_id: sk.message.msg_id, text: 'xin chao!' } });
  r = await banDo(skDoi, 'mac=' + kyDung);
  kiem('🔴 sửa thân mà giữ chữ ký cũ -> VỨT (ký trên THÂN THÔ)', r.vut === true);

  /* Các ca biên rà chéo chỉ ra là chưa ai chạy. */
  const skHoa = moi();
  r = await banDo(skHoa, 'mac=' + ky(skHoa).toUpperCase());
  kiem('chữ ký viết HOA -> vẫn NHẬN (nhánh toLowerCase)', r.vut === false);

  const skTs = moi();
  const kyTs = ky(skTs);
  r = await banDo(Object.assign({}, skTs, { timestamp: String(Date.now() - 1000) }), 'mac=' + kyTs);
  kiem('🔴 đổi mỗi timestamp -> VỨT (ts thật sự nằm trong công thức)', r.vut === true);

  const skCu = moi({ timestamp: String(Date.now() - 20 * 60 * 1000) });
  r = await banDo(skCu, 'mac=' + ky(skCu));
  kiem('🔴 chữ ký ĐÚNG nhưng timestamp CŨ 20 phút -> VỨT (chống phát lại)', r.vut === true);

  r = await banDo(moi(), 'mac=abc123');
  kiem('chữ ký ngắn hơn 64 ký tự -> VỨT, KHÔNG ném (chắn a.length===b.length)', r.vut === true);

  r = await banDo({}, 'mac=' + 'a'.repeat(64));
  kiem('thân RỖNG -> VỨT', r.vut === true);

  r = await new Promise((giaiQuyet) => {
    http.get({ host: '127.0.0.1', port: cong, path: '/api/zalo/webhook' }, (res) => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => giaiQuyet({ ma: res.statusCode, than: d }));
    }).on('error', e => giaiQuyet({ ma: 0, than: e.message }));
  });
  kiem('GET /webhook -> 200 (Zalo gọi thử lúc khai báo)', r.ma === 200, 'nhận ' + r.ma);

  server.close();

  console.log('\n=== 4. BỐN LUẬT CỦA WEBHOOK ===');
  /* "KHÔNG chứa X" thì phải lọc comment trước, không thì chính câu ghi chú giải thích luật lại làm
     phép đỏ (đã vấp 3 lần — xem feedback_qlnoibo_bo_tu_kiem_phai_loc_comment). */
  const maZalo = nguonZalo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  /* Hai phép thứ tự phải nhìn vào THÂN ROUTE (từ router.post('/webhook') trở đi) và tìm CHỖ GỌI
     `xuLy(sk).catch(` — `indexOf('xuLy(sk)')` trên cả file bắt nhầm dòng ĐỊNH NGHĨA `async function
     xuLy(sk)` nằm phía trên route ⇒ đỏ oan dù thứ tự thật đúng (14/11 chạy kiem_tat_ca lòi ra). */
  const iRoute = maZalo.indexOf("router.post('/webhook'");
  const thanRoute = iRoute > -1 ? maZalo.slice(iRoute) : '';
  kiem('🔴 trả 200 NGAY rồi mới xử lý (không để Zalo chờ → gửi lại → trả lời khách 2-3 lần)',
       iRoute > -1 && thanRoute.indexOf('res.json({ success: true });') > -1
         && thanRoute.indexOf('res.json({ success: true });') < thanRoute.indexOf('xuLy(sk).catch('));
  kiem('🔴 POST /webhook KHÔNG trả 401 nữa — 401 là Zalo KHÔNG khai được webhook',
       !/res\.status\(401\)/.test(maZalo),
       'siết lại thành 401 cho "chặt hơn" = tự khóa chính mình; hàng rào là KHÔNG XỬ LÝ, không phải mã HTTP');
  kiem('🔴 chữ ký sai thì return NGAY, trước khi chạm tới xuLy/tải ảnh/gọi API',
       iRoute > -1 && thanRoute.indexOf('if (!chuKyHopLe(req))') > -1
         && thanRoute.indexOf('if (!chuKyHopLe(req))') < thanRoute.indexOf('xuLy(sk).catch(')
         && /__demTuChoi\+\+;/.test(maZalo),
       'vứt muộn hơn một dòng là mở lại cửa SSRF và gửi tin mạo danh shop');
  kiem('🔴 chống tin LẶP theo msg_id', /function daXuLyRoi\(id\)/.test(nguonZalo) && /daXuLyRoi\(msgId\)/.test(nguonZalo));
  kiem('🔴 bắt lỗi của tác vụ nền (promise văng ra ngoài = Node giết tiến trình)',
       /xuLy\(sk\)\.catch\(/.test(nguonZalo));
  kiem('so chữ ký bằng timingSafeEqual, không dùng ===', /crypto\.timingSafeEqual/.test(nguonZalo));
  kiem('🔴 KHÔNG còn cờ CHO QUA chữ ký — chỉ có cờ GHI LOG để dò công thức',
       !/ZALO_OA_BO_QUA_CHU_KY/.test(nguonZalo) && /ZALO_OA_LOG_CHU_KY/.test(nguonZalo),
       'cờ cho qua = mở toang cửa ra internet: SSRF vào cổng nội bộ, gửi tin dưới danh nghĩa shop');
  kiem('🔴 thiếu rawBody -> TỪ CHỐI (không âm thầm ký trên thân đã parse lại)',
       /if \(!req\.rawBody\) \{/.test(nguonZalo) && /return false;/.test(nguonZalo));
  kiem('🔴 có phanh theo NGƯỜI GỬI + trần đồng thời cho nhánh ảnh',
       /function quaNhanh\(userId\)/.test(nguonZalo)
         && /TRAN_DONG_THOI_ANH/.test(nguonZalo)
         && /__dangChayAnh\+\+;/.test(nguonZalo) && /finally \{ __dangChayAnh--; \}/.test(nguonZalo),
       'một người gửi 20 ảnh = 20 việc song song = nghẽn máy chủ của CẢ XƯỞNG');
  kiem('có cron tự làm mới token (OA vắng khách 3 tháng vẫn không mất kết nối)',
       /cron\.schedule\('17 4 \* \* \*'/.test(nguonZalo));
  kiem('/trangthai đòi đăng nhập và KHÔNG trả đường dẫn file trên đĩa',
       /router\.get\('\/trangthai', requireAuth/.test(nguonZalo) && /delete t\.fileToken;/.test(nguonZalo));
  kiem('GET /webhook không khoe tên hệ thống ra internet',
       /router\.get\('\/webhook', \(req, res\) => res\.json\(\{ success: true \}\)\);/.test(nguonZalo));

  console.log('\n=== 5. LUẬT HIỂN THỊ — BOT KHÔNG ĐƯỢC NÓI NHIỀU HƠN WEB ===');
  kiem('🔴 câu trả lời chỉ gồm tên màu, KHÔNG số lượng',
       /ds\.length \? 'Còn màu: ' \+ ds\.join\(', '\) : 'Hiện đã hết hàng'/.test(nguonZalo)
         && !/tonCai|tongTon/i.test(nguonZalo.replace(/\/\*[\s\S]*?\*\//g, '')),
       'lộ số tồn qua bot là lộ cho cả người không phải khách');
  kiem('🔴 đọc được mã mà không ra hàng -> rơi tiếp xuống so ảnh, không trả lời sớm',
       /if \(kq\.items\.length\) return traLoi\(userId, kq, 'anh'\);/.test(nguonZalo),
       'nói "đọc được mã X nhưng không có" là xác nhận mã đó CÓ THẬT');
  kiem('dùng lại traCuuTheoChuoi + layThongTinCongKhai (một luật hiển thị duy nhất)',
       /traCuuTheoChuoi, layThongTinCongKhai \} = require\('\.\.\/utils\/traCuuHangCongKhai'\)/.test(nguonZalo));
  kiem('🔴 điều kiện công khai lấy từ MỘT bản dùng chung, không chép lại',
       /require\('\.\.\/utils\/dieuKienCongKhai'\)/.test(nguonZalo)
         && !/COL_LENGTH\('TheKhoHangHoa','CongKhai'\)/.test(nguonZalo),
       'ba bản chép tay thì sửa một chỗ quên hai chỗ = rò dữ liệu');
  kiem('…và cả catalogue lẫn bộ băm ảnh cũng dùng chung bản đó', (() => {
    const pub = fs.readFileSync(path.join(GOC, 'backend', 'routes', 'public.js'), 'utf8');
    const ah = fs.readFileSync(path.join(__dirname, 'anhHashSanPham.js'), 'utf8');
    return /require\('\.\.\/utils\/dieuKienCongKhai'\)/.test(pub) && /require\('\.\/dieuKienCongKhai'\)/.test(ah);
  })());
  /* Kiểm HÀNH VI của hàm soạn câu trả lời: nhét số tồn vào dữ liệu đầu vào rồi đòi nó KHÔNG ra. */
  kiem('🔴 theTuItem/dongMau KHÔNG để số lọt ra ngoài dù dữ liệu có mang', (() => {
    const { theTuItem, dongMau } = require('../routes/zalo');
    if (typeof theTuItem !== 'function') return false;
    const the = theTuItem({
      maHang: 'AB1', tenHang: 'Áo', giaBan: 185000, anhDaiDien: '/uploads/a.jpg',
      mauConLai: [{ tenMau: 'Đỏ', tonCai: 99, anh: '/uploads/d.jpg' }]
    });
    const chuoi = JSON.stringify(the) + dongMau({ mauConLai: [{ tenMau: 'Đỏ', tonCai: 99 }] });
    return chuoi.indexOf('99') === -1 && chuoi.indexOf('Đỏ') !== -1;
  })(), 'số tồn lọt vào câu trả lời là lộ năng lực kho cho cả người không phải khách');

  console.log('\n=== 6. KHO TOKEN — chỗ dễ mất kết nối nhất ===');
  kiem('🔴 ghi ATOMIC (file tạm rồi rename)', /fs\.renameSync\(tam, FILE_TOKEN\)/.test(nguonToken));
  kiem('🔴 KHÓA refresh — nhiều lời gọi chỉ sinh MỘT lần gọi mạng',
       /let __dangLamMoi = null;/.test(nguonToken) && /if \(__dangLamMoi\) return __dangLamMoi;/.test(nguonToken),
       'gọi song song = xoay refresh token hai lần = lần sau chết');
  kiem('🔴 GHI XUỐNG ĐĨA TRƯỚC rồi mới trả về',
       nguonToken.indexOf('ghi(moi);') < nguonToken.indexOf('return moi;'));
  kiem('giữ lại refresh token cũ một đời để còn lần mò', /refreshTokenCu/.test(nguonToken));
  kiem('🔴 file token KHÔNG nằm trong uploads/ (thư mục phục vụ công khai)',
       /FILE_TOKEN = path\.join\(__dirname, '\.\.', '\.zalo-oa\.json'\)/.test(nguonToken)
         && !/uploads/.test(nguonToken.split('FILE_TOKEN =')[1].split('\n')[0]));
  kiem('làm mới SỚM trước hạn, không đợi hết hạn', /SOM_HON_MS = 5 \* 60 \* 1000/.test(nguonToken));
  kiem('trangThai() KHÔNG trả ra token', (() => {
    const t = require('./zaloOaToken').trangThai();
    return !JSON.stringify(t).match(/accessToken"\s*:\s*"[^"]{10,}/);
  })());
  kiem('bắt lỗi Zalo báo trong THÂN JSON (HTTP vẫn 200)',
       /if \(j\.error && Number\(j\.error\) !== 0\)/.test(nguonApi));
  kiem('giới hạn cỡ ảnh tải về từ URL của Zalo', /CO_ANH_TOI_DA = 10 \* 1024 \* 1024/.test(nguonApi));

  console.log('\n' + '='.repeat(70));
  console.log(sai === 0 ? `✅ ${dat} phép ĐẠT, 0 sai` : `❌ ${sai} SAI / ${dat + sai} phép`);
  console.log('='.repeat(70) + '\n');
  process.exit(sai === 0 ? 0 : 1);
})().catch(e => { console.log('❌ NỔ: ' + e.stack); process.exit(1); });
