/* ================================================================================================
   zaloOaApi.js  —  v9.30 (Zalo OA) — GỬI TIN + TẢI ẢNH KHÁCH GỬI

   ⚠️ CHƯA ĐỐI CHIẾU ĐƯỢC TÀI LIỆU (trang docs của Zalo dựng bằng JS, không tải được bằng máy).
   Địa chỉ API để trong hằng số, đổi được bằng .env. Lần gửi thật đầu tiên PHẢI xem log: Zalo báo
   lỗi trong THÂN JSON (`error` khác 0) chứ không bằng mã HTTP — hàm dưới đã bắt đúng kiểu đó.

   🔴 CỬA SỔ NHẮN TIN: OA chỉ được nhắn "tin tư vấn" trong một khoảng thời gian sau tin cuối của
   khách. Bot trả lời NGAY nên luôn nằm trong cửa sổ — nhưng ĐỪNG dùng hàm này để nhắn chủ động sau
   nhiều giờ, sẽ bị từ chối (muốn vậy phải dùng ZNS, có phí).
   ================================================================================================ */
const { layAccessToken } = require('./zaloOaToken');

const URL_GUI_TIN = process.env.ZALO_OA_SEND_URL || 'https://openapi.zalo.me/v3.0/oa/message/cs';
const DAI_TOI_DA = 2000;            // cắt cho chắc, tin quá dài Zalo từ chối

async function goi(body) {
  const token = await layAccessToken();
  const res = await fetch(URL_GUI_TIN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', access_token: token },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000)   // fetch của Node KHÔNG tự hết giờ — treo là giữ tác vụ mãi
  });
  const chu = await res.text();
  let j = null;
  try { j = JSON.parse(chu); } catch (e) { /* xem dưới */ }
  if (!j) throw new Error('Zalo trả về không phải JSON (HTTP ' + res.status + '): ' + chu.slice(0, 300));
  /* Zalo báo lỗi bằng trường `error` trong thân JSON, HTTP vẫn 200 — không bắt là tưởng gửi thành công. */
  if (j.error && Number(j.error) !== 0)
    throw new Error('Zalo từ chối (error ' + j.error + '): ' + (j.message || JSON.stringify(j).slice(0, 300)));
  return j;
}

function catBot(s) {
  const t = String(s == null ? '' : s);
  return t.length > DAI_TOI_DA ? t.slice(0, DAI_TOI_DA - 1) + '…' : t;
}

async function guiChu(userId, text) {
  return goi({ recipient: { user_id: String(userId) }, message: { text: catBot(text) } });
}

/* Gửi một thẻ có ẢNH + chữ + nút. Dùng khi trả lời đúng một mã hàng, và khi đưa ứng viên cho khách
   bấm chọn. `items`: [{ tieuDe, moTa, anhUrl, moUrl }] — tối đa 5 (giới hạn của Zalo, nhớ chừng). */
async function guiThe(userId, items) {
  const ds = (items || []).slice(0, 5).map(it => ({
    title: catBot(it.tieuDe || ''),
    subtitle: catBot(it.moTa || ''),
    image_url: it.anhUrl || undefined,
    default_action: it.moUrl ? { type: 'oa.open.url', url: it.moUrl } : undefined
  }));
  if (!ds.length) return null;
  return goi({
    recipient: { user_id: String(userId) },
    message: {
      attachment: {
        type: 'template',
        payload: { template_type: 'list', elements: ds }
      }
    }
  });
}

/* ------------------------------------------------------------------------------------------------
   TẢI ẢNH KHÁCH GỬI. Zalo đưa URL trong payload webhook — nhưng URL đó là THỨ TỪ BÊN NGOÀI, phải
   coi như người lạ đưa, kể cả khi chữ ký hợp lệ.

   🔴 BA chỗ phải chặn, thiếu một là có lỗ:
   1. SSRF — URL trỏ vào `127.0.0.1:3000` là bắt máy chủ tự gọi CỔNG NỘI BỘ của chính mình (nơi
      không có cơ chế tách cổng bảo vệ), hoặc quét máy khác trong LAN xưởng. Chặn bằng danh sách
      trắng host + cấm IP riêng, và `redirect: 'error'` vì theo chuyển hướng là host cuối có thể
      khác hẳn host đầu đã kiểm.
   2. CỠ FILE — `await res.arrayBuffer()` nạp HẾT vào RAM rồi mới kiểm độ dài thì phép kiểm đó vô
      nghĩa: muốn giết máy chủ thì nó đã chết trước khi tới dòng kiểm. Phải đọc theo LUỒNG và cắt
      giữa chừng. `content-length` là do đầu kia TỰ KHAI, không tin được.
   3. TREO — fetch của Node KHÔNG tự hết giờ. Một URL không bao giờ trả lời sẽ giữ tác vụ sống mãi.
   ------------------------------------------------------------------------------------------------ */
const CO_ANH_TOI_DA = 10 * 1024 * 1024;
const HET_GIO_MS = 15000;
/* Host của Zalo. Để sửa được bằng .env phòng khi Zalo đổi CDN. */
const HOST_CHO_PHEP = String(process.env.ZALO_OA_HOST_ANH || 'zalo.me,zadn.vn,zaloapp.com,zdn.vn')
  .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

function laIPRieng(host) {
  const h = String(host || '').toLowerCase();
  if (h === 'localhost' || h === '::1' || h.endsWith('.local') || h.endsWith('.internal')) return true;
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return false;
  const a = +m[1], b = +m[2];
  return a === 127 || a === 10 || a === 0
    || (a === 192 && b === 168)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 169 && b === 254);      // metadata của máy ảo đám mây
}
function hostHopLe(host) {
  const h = String(host || '').toLowerCase();
  if (!h || laIPRieng(h)) return false;
  return HOST_CHO_PHEP.some(d => h === d || h.endsWith('.' + d));
}

async function taiAnh(url) {
  let u;
  try { u = new URL(String(url)); } catch (e) { throw new Error('URL ảnh không hợp lệ.'); }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('Giao thức không cho phép: ' + u.protocol);
  if (!hostHopLe(u.hostname)) throw new Error('Host ảnh không nằm trong danh sách cho phép: ' + u.hostname);

  const res = await fetch(u.toString(), {
    redirect: 'error',                       // không theo chuyển hướng — host cuối có thể khác host đã kiểm
    signal: AbortSignal.timeout(HET_GIO_MS)
  });
  if (!res.ok) throw new Error('Tải ảnh lỗi HTTP ' + res.status);
  const loai = String(res.headers.get('content-type') || '');
  if (loai && !/^image\//i.test(loai)) throw new Error('Không phải ảnh: ' + loai);
  const coBao = Number(res.headers.get('content-length') || 0);
  if (coBao && coBao > CO_ANH_TOI_DA) throw new Error('Ảnh quá lớn (khai báo): ' + coBao);

  /* Đọc theo LUỒNG, cắt ngay khi vượt ngưỡng — không bao giờ để cả file lọt vào RAM trước. */
  if (!res.body) throw new Error('Không đọc được nội dung ảnh.');
  const reader = res.body.getReader();
  const manh = [];
  let tong = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    tong += value.length;
    if (tong > CO_ANH_TOI_DA) {
      try { await reader.cancel(); } catch (e) { /* đóng được thì tốt, không thì thôi */ }
      throw new Error('Ảnh quá lớn (đang tải): > ' + CO_ANH_TOI_DA);
    }
    manh.push(Buffer.from(value));
  }
  return Buffer.concat(manh, tong);
}

module.exports = { guiChu, guiThe, taiAnh, hostHopLe, laIPRieng, URL_GUI_TIN, CO_ANH_TOI_DA, HET_GIO_MS };
