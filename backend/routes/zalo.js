/* ================================================================================================
   routes/zalo.js  —  v9.30 — WEBHOOK ZALO OA

   Khách nhắn mã hàng / mã vạch / gửi ảnh vào OA → bot trả lời ngay: ảnh, tên hàng, giá bán và
   **tên các màu còn hàng** (Nguyen chốt: đúng mức catalogue, KHÔNG hiện số tồn).

   BỐN ĐIỀU BẮT BUỘC CỦA MỘT WEBHOOK, đừng bỏ cái nào:

   1. 🔴 XÁC THỰC CHỮ KÝ. Đây là cửa mở ra internet, ai cũng gọi được. Không kiểm chữ ký thì người
      lạ giả làm Zalo, bắt máy chủ tra cứu và nhắn tin thay mình.
   2. 🔴 TRẢ 200 NGAY, xử lý sau. Zalo chờ vài giây rồi coi là hỏng và GỬI LẠI. Đọc ảnh mất mấy
      giây ⇒ trả lời chậm là Zalo gửi lại, bot trả lời khách hai ba lần.
   3. 🔴 CHỐNG LẶP theo `msg_id`. Dù đã làm đúng (2), Zalo vẫn có thể gửi lại khi mạng chập chờn.
   4. 🔴 KHÔNG BAO GIỜ ĐỂ LỖI LÀM SẬP TIẾN TRÌNH. Xử lý chạy nền, mọi lỗi phải bắt tại chỗ —
      promise văng ra ngoài là Node đời mới giết tiến trình, mất cả phần mềm nội bộ.

   5. 🔴 PHANH THEO NGƯỜI GỬI + TRẦN ĐỒNG THỜI. Một tin ảnh tốn tới ~41 lượt giải mã; máy chủ này
      cùng lúc chạy phần mềm nội bộ của cả xưởng.
   6. 🔴 TỰ LÀM MỚI TOKEN ĐỊNH KỲ, đừng đợi có khách nhắn mới làm mới.

   ⚠️ CHƯA ĐỐI CHIẾU ĐƯỢC TÀI LIỆU Zalo trong phiên viết (trang docs dựng bằng JS). Tên header chữ
   ký, công thức ký và tên trường payload theo hiểu biết chung về Zalo OA — **lần gọi thật đầu tiên
   phải xem log** `[zalo] ` để xác nhận.
   Cách dò an toàn: đặt `ZALO_OA_LOG_CHU_KY=1` — nó IN RA chữ ký nhận được và chữ ký tính được để
   đối chiếu, nhưng **vẫn VỨT, không xử lý**. Dò công thức thì chỉ cần NHÌN, không cần CHO VÀO.
   (Bản đầu từng có cờ "bỏ qua chữ ký"; rà chéo chỉ ra đó là mở toang cửa ra internet — ai cũng POST
   được, kéo theo SSRF bắt máy chủ tự gọi cổng nội bộ qua URL ảnh. Đã bỏ hẳn, đừng thêm lại.)

   🔴 v9.34: chữ ký sai nay trả **200 + vứt**, KHÔNG còn trả 401 — Zalo dùng mã HTTP để ĐĂNG KÝ
   webhook, trả 401 là tự khóa chính mình. Lý lẽ đầy đủ ở khối ghi chú trên `router.post('/webhook')`.
   ================================================================================================ */
const express = require('express');
const crypto = require('crypto');
const { getPool } = require('../db');
const { traCuuTheoChuoi, layThongTinCongKhai } = require('../utils/traCuuHangCongKhai');
const { timTheoAnh } = require('../utils/anhHashSanPham');
const { docMaTuAnh } = require('../utils/docMaTuAnh');
const { guiChu, guiThe, taiAnh } = require('../utils/zaloOaApi');
const { trangThai, layAccessToken, daKhaiKhoa } = require('../utils/zaloOaToken');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

/* v9.31: điều kiện công khai lấy từ MỘT bản duy nhất (utils/dieuKienCongKhai.js) — catalogue, bot
   và bộ băm ảnh dùng chung. Chép lại ở đây là có ngày ba bản lệch nhau = rò dữ liệu. */
const { dieuKienCongKhaiMH, dieuKienCongKhaiDM } = require('../utils/dieuKienCongKhai');
const { layHangDangGiu } = require('./banhang');
const PHU_THUOC = { dieuKienCongKhaiMH, dieuKienCongKhaiDM, layHangDangGiu };

const BASE = String(process.env.PUBLIC_BASE_URL || 'https://thoitrangmoyn.id.vn').replace(/\/+$/, '');
const fmtTien = (n) => (Number(n) || 0).toLocaleString('vi-VN') + 'đ';

/* ------------------------------------------------------------------------------------------------
   1. CHỮ KÝ
   Zalo ký bằng SHA256 của (appId + data + timestamp + OASecretKey), `data` là THÂN YÊU CẦU THÔ.
   Vì vậy server.js phải giữ lại rawBody cho đúng đường dẫn này — xem app.use(express.json(...)).

   🔴 v9.34 — ZALO CÓ **HAI** KHÓA BÍ MẬT KHÁC NHAU. Bản v9.30 nạp nhầm khóa (Nguyen phát hiện
   2026-11-09 khi nhìn thấy ô "OA Secret Key" ngay trên màn Webhook):

     · `ZALO_OA_APP_SECRET`  = "Application's private key", ở màn **Application information**.
       Dùng để **ĐỔI/LÀM MỚI TOKEN** (header `secret_key` của oauth.zaloapp.com). Cái này đã đúng —
       Zalo đã nhận refresh token bằng nó.
     · `ZALO_OA_SECRET_KEY`  = "OA Secret Key", ở màn **Webhook** của ứng dụng.
       Dùng để **KÝ WEBHOOK**. Đây mới là khóa phải đưa vào công thức dưới đây.

   Comment của bản cũ ghi đúng là "OASecretKey" nhưng mã lại nạp app secret vào ⇒ chữ ký không bao
   giờ khớp. Đừng gộp hai biến này lại "cho gọn".
   ------------------------------------------------------------------------------------------------ */
const LECH_GIO_TOI_DA_MS = 5 * 60 * 1000;

/* Khóa KÝ WEBHOOK. Chưa khai thì lùi về app secret để không làm hỏng máy đang chạy bản cũ, nhưng
   GÀO LÊN — vì triệu chứng của việc dùng nhầm khóa là "webhook khai xong mà bot câm". */
let __daNhacThieuKhoaKy = false;
function khoaKyWebhook() {
  const oa = String(process.env.ZALO_OA_SECRET_KEY || '').trim();
  if (oa) return oa;
  if (!__daNhacThieuKhoaKy) {
    __daNhacThieuKhoaKy = true;
    console.error('[zalo] 🔴 CHƯA KHAI ZALO_OA_SECRET_KEY (ô "OA Secret Key" ở màn Webhook của ứng dụng).'
      + ' Đang tạm ký bằng ZALO_OA_APP_SECRET — gần như chắc chắn SAI, bot sẽ không trả lời khách.');
  }
  return String(process.env.ZALO_OA_APP_SECRET || '').trim();
}

function chuKyHopLe(req) {
  const secret = khoaKyWebhook();
  const appId = String(process.env.ZALO_OA_APP_ID || '').trim();
  if (!secret || !appId) { console.warn('[zalo] chưa khai ZALO_OA_APP_ID / khóa ký webhook'); return false; }

  /* 🔴 rawBody hụt là KHÔNG kiểm được chữ ký — phải TỪ CHỐI, đừng âm thầm đổi sang thân đã parse
     (JSON.stringify sinh lại chuỗi khác bản gốc ⇒ chữ ký không bao giờ khớp, và triệu chứng là
     "Zalo gọi mà cứ 401", truy sai chỗ cả buổi). Nói rõ nguyên nhân ngay trong log. */
  if (!req.rawBody) {
    console.warn('[zalo] THIẾU rawBody — kiểm lại `verify` của express.json trong server.js, '
      + 'hoặc Content-Type không phải application/json. Content-Type=' + (req.get('content-type') || '?'));
    return false;
  }

  const nhan = String(req.get('X-ZEvent-Signature') || '').replace(/^mac=/i, '').trim().toLowerCase();
  if (!nhan) return false;
  const tho = req.rawBody.toString('utf8');
  const ts = String((req.body && req.body.timestamp) || '');

  /* Chặn PHÁT LẠI: một yêu cầu hợp lệ bị bắt được (log proxy, ảnh chụp màn hình lúc gỡ lỗi) mà
     không kiểm thời gian thì dùng lại được mãi mãi — chống lặp theo msg_id chỉ nhớ 10 phút. */
  const soTs = Number(ts);
  if (!soTs || Math.abs(Date.now() - soTs) > LECH_GIO_TOI_DA_MS) {
    console.warn('[zalo] timestamp lệch quá xa hoặc thiếu: ' + ts);
    return false;
  }

  const tinh = crypto.createHash('sha256').update(appId + tho + ts + secret).digest('hex');
  /* 🔴 CHẾ ĐỘ DÒ CÔNG THỨC (ZALO_OA_LOG_CHU_KY=1): in ra để đối chiếu, nhưng VẪN TỪ CHỐI.
     Trước đây chỗ này là một cờ "cho qua" — rà chéo chỉ ra đó là mở toang cửa ra internet: ai cũng
     POST được, kéo theo SSRF (bắt máy chủ tự gọi cổng nội bộ qua URL ảnh), gửi tin dưới danh nghĩa
     shop, và dò cả kho hàng. Dò công thức thì chỉ cần NHÌN, không cần CHO VÀO. */
  if (String(process.env.ZALO_OA_LOG_CHU_KY || '') === '1') {
    console.log('[zalo] dò chữ ký — nhận=' + nhan.slice(0, 16) + '… tính=' + tinh.slice(0, 16)
      + '… ts=' + ts + ' dài thân=' + tho.length + ' đầu thân=' + tho.slice(0, 120));
    /* 🔴 Công thức vẫn CHƯA đối chiếu được bằng tài liệu. In sẵn các biến thể hay gặp để MỘT tin
       thật là đủ xác định đúng cái nào — khỏi phải sửa mã, restart, nhắn lại nhiều vòng.
       Chỉ IN RA, không cái nào được dùng để cho qua: chấp nhận "bất kỳ cái nào khớp" là tự hạ hàng
       rào xuống còn bằng biến thể yếu nhất. Tìm ra đúng công thức rồi thì SỬA `tinh` ở trên. */
    const oa = String(process.env.ZALO_OA_SECRET_KEY || '').trim();
    const app = String(process.env.ZALO_OA_APP_SECRET || '').trim();
    const bam = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
    const bienThe = {
      'appId+body+ts+OAsecret': oa ? bam(appId + tho + ts + oa) : '(chưa khai OA secret)',
      'appId+body+ts+APPsecret': app ? bam(appId + tho + ts + app) : '(chưa khai app secret)',
      'OAsecret+appId+body+ts': oa ? bam(oa + appId + tho + ts) : '-',
      'appId+body+OAsecret': oa ? bam(appId + tho + oa) : '-',
      'body+ts+OAsecret': oa ? bam(tho + ts + oa) : '-'
    };
    console.log('[zalo] dò công thức — nhận=' + nhan.slice(0, 16) + '… | '
      + Object.keys(bienThe).map(k => k + '=' + bienThe[k]).join(' | '));
  }
  /* So bằng timingSafeEqual — so bằng `===` rò rỉ thông tin qua thời gian so sánh. */
  const a = Buffer.from(nhan, 'utf8'), b = Buffer.from(tinh, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/* 3. Chống lặp: nhớ msg_id đã xử lý trong 10 phút. */
const DA_XU_LY = new Map();
const NHO_MS = 10 * 60 * 1000;
function daXuLyRoi(id) {
  if (!id) return false;
  const bayGio = Date.now();
  for (const [k, t] of DA_XU_LY) if (bayGio - t > NHO_MS) DA_XU_LY.delete(k);
  if (DA_XU_LY.has(id)) return true;
  DA_XU_LY.set(id, bayGio);
  return false;
}

/* ------------------------------------------------------------------------------------------------
   🔴 5. GIỚI HẠN TẦN SUẤT + TRẦN ĐỒNG THỜI — bảo vệ CHÍNH MÁY CHỦ CỦA XƯỞNG.

   Một tin ẢNH tốn tới ~41 lượt giải mã (7 biến thể toàn ảnh + 9 ô 3×3 + 25 ô 5×5) rồi còn quét
   dHash toàn bộ ảnh hàng công khai. Máy chủ này CÙNG LÚC phục vụ phần mềm nội bộ của cả xưởng trên
   cổng 3000. Một người gửi liên tiếp 20 ảnh mà không có phanh ⇒ 20 việc chạy song song ⇒ CPU cạn ⇒
   cả xưởng đứng hình. Không phải lo xa: cùng một tiến trình Node.
   ------------------------------------------------------------------------------------------------ */
const CUA_SO_MS = 60 * 1000;
const TIN_TOI_DA_MOI_PHUT = 10;        // người thật nhắn tay không tới mức này
const TRAN_DONG_THOI_ANH = 2;          // số việc xử lý ẢNH chạy cùng lúc trên toàn hệ thống
const DEM_THEO_USER = new Map();
let __dangChayAnh = 0;

function quaNhanh(userId) {
  const bayGio = Date.now();
  if (DEM_THEO_USER.size > 5000) DEM_THEO_USER.clear();   // chặn Map phình vì user lạ
  const o = DEM_THEO_USER.get(userId);
  if (!o || (bayGio - o.moc) > CUA_SO_MS) { DEM_THEO_USER.set(userId, { moc: bayGio, soLan: 1 }); return false; }
  o.soLan++;
  return o.soLan > TIN_TOI_DA_MOI_PHUT;
}

/* ------------------------------------------------------------------------------------------------
   SOẠN CÂU TRẢ LỜI — nơi DUY NHẤT quyết định khách đọc được gì.
   🔴 Chỉ: tên hàng, giá bán, TÊN các màu còn hàng. Không số lượng, không mã vạch, không ID.
   ------------------------------------------------------------------------------------------------ */
function dongMau(it) {
  const ds = (it.mauConLai || []).map(m => m.tenMau);
  return ds.length ? 'Còn màu: ' + ds.join(', ') : 'Hiện đã hết hàng';
}
function theTuItem(it) {
  return {
    tieuDe: `${it.tenHang} (${it.maHang})`,
    moTa: `${fmtTien(it.giaBan)} · ${dongMau(it)}`,
    anhUrl: it.anhDaiDien ? BASE + it.anhDaiDien : undefined,
    moUrl: BASE + '/catalogue.html'
  };
}

async function traLoi(userId, kq, boiCanh) {
  if (kq.trangThai === 'thay') {
    const it = kq.items[0];
    await guiThe(userId, [theTuItem(it)]);
    await guiChu(userId, `${it.tenHang} — ${fmtTien(it.giaBan)}\n${dongMau(it)}\n\nĐặt hàng hoặc xem thêm: ${BASE}/catalogue.html`);
    return;
  }
  if (kq.trangThai === 'nhieu') {
    await guiChu(userId, 'Shop tìm được mấy mẫu gần giống, bạn xem đúng mẫu nào giúp shop nhé:');
    await guiThe(userId, kq.items.map(theTuItem));
    return;
  }
  /* KHÔNG tìm thấy — dẫn khách đi tiếp, đừng chỉ xin lỗi. Với ảnh thì nói rõ cách chụp lại:
     ảnh khách gửi thường là cả đống hàng trên sàn, cái tem bé xíu, nên xin ảnh CẬN TEM mới có cửa. */
  if (boiCanh === 'anh') {
    await guiChu(userId,
      'Ảnh có nhiều mẫu nên shop chưa nhận ra chính xác 😅\n'
      + 'Bạn chụp CẬN cái tem (chỗ có mã vạch) gửi lại giúp shop, hoặc gõ mã trên tem — shop trả lời ngay.\n\n'
      + `Hoặc xem toàn bộ hàng còn tại: ${BASE}/catalogue.html`);
    return;
  }
  await guiChu(userId,
    'Shop chưa tìm thấy mã này. Bạn kiểm tra lại giúp, hoặc gửi ảnh chụp cận cái tem nhé.\n\n'
    + `Xem toàn bộ hàng còn: ${BASE}/catalogue.html`);
}

/* ------------------------------------------------------------------------------------------------
   XỬ LÝ MỘT SỰ KIỆN — chạy NỀN, sau khi đã trả 200. Mọi lỗi bắt tại đây.
   ------------------------------------------------------------------------------------------------ */
async function xuLy(sk) {
  const userId = sk && sk.sender && sk.sender.id;
  if (!userId) return;
  const ten = String(sk.event_name || '');
  /* Chỉ mở kết nối CSDL khi thật sự cần — Zalo bắn nhiều loại sự kiện mình không quan tâm. */
  if (ten !== 'user_send_text' && ten !== 'user_send_image' && ten !== 'follow') return;
  const pool = (ten === 'follow') ? null : await getPool();

  if (ten === 'user_send_text') {
    const chu = String((sk.message && sk.message.text) || '').trim();
    if (!chu) return;
    const kq = await traCuuTheoChuoi(pool, chu, PHU_THUOC);
    console.log(`[zalo] ${userId} hỏi "${chu.slice(0, 60)}" -> ${kq.trangThai} (${kq.nguon || '-'})`);
    await traLoi(userId, kq, 'chu');
    return;
  }

  if (ten === 'user_send_image') {
    const dsAnh = ((sk.message && sk.message.attachments) || [])
      .map(a => a && a.payload && (a.payload.url || a.payload.thumbnail))
      .filter(Boolean);
    if (!dsAnh.length) return;
    /* Trần đồng thời: thà bảo khách chờ còn hơn làm nghẽn phần mềm của cả xưởng. */
    if (__dangChayAnh >= TRAN_DONG_THOI_ANH) {
      await guiChu(userId, 'Shop đang xử lý mấy ảnh trước, bạn chờ chút rồi gửi lại giúp nhé 🙏');
      return;
    }
    __dangChayAnh++;
    try {
      await xuLyAnh(pool, userId, dsAnh[0]);
    } finally { __dangChayAnh--; }
    return;
  }

  if (ten === 'follow') {
    await guiChu(userId,
      'Chào bạn 👋 Gửi shop MÃ SẢN PHẨM (chữ trên tem) hoặc ảnh chụp cận cái tem, shop báo ngay còn màu nào và giá.\n\n'
      + `Xem toàn bộ hàng còn: ${BASE}/catalogue.html`);
  }
}

/* Nhánh ẢNH tách riêng để đếm được trần đồng thời (xem khối giới hạn tần suất ở trên). */
async function xuLyAnh(pool, userId, urlAnh) {
  {
    await guiChu(userId, 'Shop đang xem ảnh, chờ chút nhé…');
    const buf = await taiAnh(urlAnh);

    // ① mã vạch / QR trên tem
    const doc = await docMaTuAnh(buf);
    if (doc.ma) {
      const kq = await traCuuTheoChuoi(pool, doc.ma, PHU_THUOC);
      console.log(`[zalo] ${userId} gửi ảnh -> đọc mã "${doc.ma}" qua ${doc.duong} -> ${kq.trangThai}`);
      if (kq.items.length) return traLoi(userId, kq, 'anh');
      /* Đọc được mã nhưng không ra hàng công khai: KHÔNG nói "đọc được mã X" (nói vậy là xác nhận
         mã đó có thật), rơi tiếp xuống so ảnh. */
    }

    // ③ so ảnh (dHash)
    const theoAnh = await timTheoAnh(pool, buf, PHU_THUOC);
    const items = theoAnh.dsUngVien.length
      ? await layThongTinCongKhai(pool, theoAnh.dsUngVien.map(x => x.maHangID), PHU_THUOC) : [];
    const trangThai = !items.length ? 'khong'
      : (theoAnh.kieu === 'chac' && items.length === 1) ? 'thay' : 'nhieu';
    console.log(`[zalo] ${userId} gửi ảnh -> dHash ${theoAnh.kieu} -> ${trangThai}`);
    await traLoi(userId, { trangThai, items }, 'anh');
  }
}

/* ------------------------------------------------------------------------------------------------
   2. NHẬN: trả 200 NGAY → xác thực → xử lý nền.

   🔴 v9.34 — SỬA SAI THIẾT KẾ (Nguyen 2026-11-09, Zalo báo khi khai webhook:
   *"nhận về http code 401. Webhook của bạn chỉ được thiết lập khi trả về http code 200 OK"*).

   Bản v9.30 dùng MÃ HTTP làm hàng rào: chữ ký sai ⇒ 401. Sai ở chỗ Zalo đọc mã trả về để **đăng ký**
   webhook, không phải để biết ta có xử lý hay không. Lần gọi thử lúc khai báo rất có thể KHÔNG mang
   chữ ký nào ⇒ 401 ⇒ không bao giờ khai được webhook, kể cả khi công thức ký đã đúng.

   Hàng rào thật nằm ở chỗ **KHÔNG HÀNH ĐỘNG**, không nằm ở mã HTTP:
     · luôn trả 200 — Zalo khai được, và không gửi lại nhiều lần cho mệt máy;
     · chữ ký không hợp lệ ⇒ `return` NGAY, trước khi đụng tới bất cứ thứ gì: không tải ảnh (cửa
       SSRF), không gọi API Zalo (gửi tin mạo danh shop), không tra kho. Kẻ lạ POST vào chỉ tốn của
       ta đúng một câu trả lời rỗng;
     · trả CÙNG MỘT câu `{"success":true}` cho cả hai trường hợp — kẻ dò không biết chữ ký nó sai hay
       đúng, không biến đường dẫn này thành máy thử công thức.
   Đây KHÔNG phải cờ "bỏ qua chữ ký" của bản đầu (rà chéo đã bác): cái đó CHO VÀO XỬ LÝ, cái này
   vẫn vứt. Đừng "sửa lại cho chặt" bằng cách trả 401 — là tự khóa chính mình lần nữa.

   ⚠️ Đổi lại phải chấp nhận một rủi ro, nên nó được GÀO trong log: công thức ký sai thì webhook khai
   THÀNH CÔNG nhưng im lặng không trả lời khách — nhìn ngoài tưởng chạy. Xem dòng `[zalo] 🔴 ...`.
   ------------------------------------------------------------------------------------------------ */
let __demTuChoi = 0;        // đếm số lần vứt vì chữ ký — nhiều mà không có lần nào qua = sai công thức
let __daTungQua = false;    // đã từng có một tin chữ ký ĐÚNG chưa
let __daNhacGoiDichVu = false;   // chỉ gào MỘT lần về rào gói dịch vụ, đừng spam log của cả xưởng

/* 🔴 Từ v9.34 mọi trường hợp đều trả 200, nên MÃ HTTP không còn phân biệt được "vứt" với "xử lý" —
   mà đó mới là điều cần kiểm. Hai hàm này cho bộ tự kiểm ĐO được việc đó. KHÔNG có route nào phơi
   chúng ra ngoài: `kiem_zalo_webhook.js` dựng app ngay trong tiến trình của nó rồi đọc thẳng. */
router.__demVut = () => __demTuChoi;
router.__daTungQua = () => __daTungQua;

router.post('/webhook', (req, res) => {
  const sk = req.body || {};
  /* 🔴 Trả 200 TRƯỚC MỌI THỨ — kể cả khi sắp vứt. Xem khối ghi chú ngay trên. */
  res.json({ success: true });

  if (!chuKyHopLe(req)) {
    __demTuChoi++;
    console.warn('[zalo] VỨT (không xử lý): chữ ký sai hoặc thiếu. event=' + (sk.event_name || '?')
      + ' sig=' + String(req.get('X-ZEvent-Signature') || '(không có)').slice(0, 24)
      + ' — đã vứt ' + __demTuChoi + ' lần');
    /* Chưa từng có tin nào lọt mà đã vứt kha khá ⇒ gần như chắc chắn CÔNG THỨC KÝ SAI, không phải
       bị quét bậy. Nói thẳng ra cách dò, kẻo lại đi truy nhầm sang tunnel/cổng/token. */
    if (!__daTungQua && (__demTuChoi === 3 || __demTuChoi === 10 || __demTuChoi % 50 === 0)) {
      console.error('[zalo] 🔴 CHƯA CÓ TIN NÀO QUA ĐƯỢC CHỮ KÝ (' + __demTuChoi + ' lần vứt).'
        + ' Webhook ĐÃ khai được nhưng KHÁCH NHẮN SẼ KHÔNG ĐƯỢC TRẢ LỜI.'
        + ' Đặt ZALO_OA_LOG_CHU_KY=1 + pm2 restart, nhắn thử một tin, rồi đối chiếu'
        + ' "nhận=" với "tính=" trong log để sửa công thức ở chuKyHopLe().');
    }
    return;
  }
  __daTungQua = true;

  const msgId = (sk.message && sk.message.msg_id) || sk.msg_id || null;
  if (daXuLyRoi(msgId)) { console.log('[zalo] bỏ qua tin lặp ' + msgId); return; }

  /* Phanh theo NGƯỜI GỬI — xem khối giới hạn tần suất. Nói một câu rồi thôi, không im lặng (im lặng
     thì khách tưởng shop lờ, lại nhắn tiếp). */
  const uid = sk.sender && sk.sender.id;
  if (uid && quaNhanh(uid)) {
    console.warn('[zalo] ' + uid + ' gửi quá nhanh — tạm dừng trả lời');
    const o = DEM_THEO_USER.get(uid);
    if (o && o.soLan === TIN_TOI_DA_MOI_PHUT + 1)   // chỉ nhắc ĐÚNG MỘT lần mỗi cửa sổ
      guiChu(uid, 'Bạn gửi hơi nhanh, shop xử lý chưa kịp 😅 Chờ một phút rồi nhắn lại giúp nhé.').catch(() => {});
    return;
  }

  /* 🔴 Bắt lỗi TẠI ĐÂY. Promise văng ra ngoài là Node giết tiến trình — sập cả phần mềm nội bộ. */
  xuLy(sk).catch(err => {
    const loi = String((err && err.message) || err);
    /* 🔴 v9.34 — PHÂN BIỆT "LỖI CỦA TA" VỚI "ZALO KHÔNG CHO". Lần chạy thật đầu tiên (2026-11-09)
       mọi thứ thông hết — chữ ký khớp, tra được hàng — rồi Zalo chặn ở bước GỬI:
         error -224: "The OA needs to upgrade OA Tier Package to use this feature"
       Đây là rào THƯƠNG MẠI (gói dịch vụ của OA), không phải hỏng code. Gộp chung vào câu
       "lỗi xử lý" là lần sau lại ngồi truy nhầm sang token/chữ ký/tunnel cả buổi.
       Và KHÔNG gửi câu xin lỗi: nó cũng đi qua đúng API vừa bị chặn ⇒ chắc chắn hỏng nốt, chỉ tổ
       thêm một dòng lỗi nữa vào log. */
    if (/-224|upgrade OA Tier|zalo\.cloud\/oa\/pricing/i.test(loi)) {
      if (!__daNhacGoiDichVu) {
        __daNhacGoiDichVu = true;
        console.error('[zalo] 🔴 ZALO CHẶN Ở BƯỚC GỬI TIN — GÓI DỊCH VỤ CỦA OA KHÔNG CHO DÙNG API GỬI.'
          + ' Webhook, chữ ký, token, tra hàng ĐỀU ĐÚNG; chỉ thiếu gói. Nâng gói tại'
          + ' https://zalo.cloud/oa/pricing rồi thử lại — KHÔNG phải sửa code.');
      }
      console.warn('[zalo] không trả lời được ' + (sk.sender && sk.sender.id) + ' (thiếu gói dịch vụ)');
      return;
    }
    console.error('[zalo] lỗi xử lý: ' + loi);
    const uid = sk.sender && sk.sender.id;
    if (uid) guiChu(uid, 'Shop đang bận xíu, bạn nhắn lại giúp hoặc gọi trực tiếp nhé.').catch(() => {});
  });
});

/* Zalo gọi thử bằng GET khi khai webhook — trả 200 cho khỏi báo đỏ.
   KHÔNG kèm tên hệ thống: cổng 80 ai quét cũng thấy, đừng khoe mình chạy phần mềm gì. */
router.get('/webhook', (req, res) => res.json({ success: true }));

/* Xem trạng thái token. Cổng công khai đã chặn (chỉ /webhook lọt), nhưng trong LAN xưởng ai cũng gõ
   được cổng 3000 — nên vẫn đòi đăng nhập, và KHÔNG trả đường dẫn file trên đĩa máy chủ. */
router.get('/trangthai', requireAuth, (req, res) => {
  const t = trangThai();
  delete t.fileToken;
  res.json({ success: true, data: t });
});

/* ------------------------------------------------------------------------------------------------
   🔴 6. TỰ LÀM MỚI TOKEN ĐỊNH KỲ.
   `layAccessToken` chỉ làm mới KHI CÓ NGƯỜI NHẮN. Refresh token của Zalo sống cỡ 3 tháng — OA vắng
   khách qua mốc đó là mất kết nối, phải vào developers.zalo.me cấp quyền lại bằng tay. Một lần gọi
   mỗi ngày là đủ để điều đó không bao giờ xảy ra.
   ------------------------------------------------------------------------------------------------ */
if (daKhaiKhoa()) {
  const cron = require('node-cron');
  cron.schedule('17 4 * * *', () => {                  // 4:17 sáng, giờ máy chủ — lúc không ai dùng
    layAccessToken()
      .then(() => console.log('[zalo] token còn sống (kiểm định kỳ).'))
      .catch(e => console.error('[zalo] 🔴 KHÔNG làm mới được token: ' + e.message
        + ' — bot sẽ ngừng trả lời. Xem docs/HUONG_DAN_KET_NOI_ZALO_OA.md bước A3.'));
  });
}

/* Export thêm hai hàm soạn câu trả lời để bộ tự kiểm chạy được HÀNH VI của chúng (nhét số tồn vào
   dữ liệu rồi đòi nó không lọt ra) — thay vì chỉ grep chuỗi. */
module.exports = router;
module.exports.theTuItem = theTuItem;
module.exports.dongMau = dongMau;
