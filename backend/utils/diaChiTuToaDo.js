/* ==================================================================================================
   TRA ĐỊA CHỈ THẬT TỪ TOẠ ĐỘ GPS (reverse geocoding)                                       v7.73
   --------------------------------------------------------------------------------------------------
   Dùng cho dấu thời gian/địa điểm đóng lên ảnh check-in ghé thăm shop (kiểu app TimeMark).
   Nguồn: Nominatim của OpenStreetMap — miễn phí, KHÔNG cần khoá API.

   ⚠️ BA RÀNG BUỘC CỦA NOMINATIM, VI PHẠM LÀ BỊ CHẶN IP:
     1. Phải có `User-Agent` nêu rõ ứng dụng + liên hệ. Gọi mà không khai là bị chặn.
     2. Tối đa ~1 lượt/giây. Nhân viên bấm chụp liên tục là vượt ngay ⇒ có hàng đợi tuần tự
        (`hangDoi`) đảm bảo hai lượt gọi cách nhau tối thiểu 1,1 giây.
     3. Không được gọi lặp lại cùng một toạ độ ⇒ GHI ĐỆM. Khoá đệm làm tròn 4 chữ số thập phân
        (≈ 11 m) — đứng trong cùng một shop thì mọi lần chụp dùng lại kết quả cũ.

   ⚠️ KHÔNG BAO GIỜ ĐƯỢC LÀM VỠ VIỆC CHÍNH: mạng lỗi / Nominatim chặn / quá thời gian thì trả
   chuỗi rỗng, để ảnh vẫn đóng dấu được (thiếu dòng địa chỉ, còn đủ giờ + toạ độ + shop + nhân viên).
   Tuyệt đối không ném lỗi ra route.
   ================================================================================================== */

const DEM = new Map();                 // khoá "lat,lon" (4 số) -> { diaChi, luc }
const HAN_DEM_MS = 30 * 24 * 3600e3;   // địa chỉ đường/phường gần như không đổi -> giữ 30 ngày
const CACH_NHAU_MS = 1100;             // giãn giữa 2 lượt gọi ra ngoài (Nominatim: ~1 lượt/giây)
const CHO_TOI_DA_MS = 6000;            // chờ Nominatim tối đa 6s rồi bỏ, không để người dùng đứng chờ

let chuoiCho = Promise.resolve();      // hàng đợi tuần tự
function hangDoi(viec) {
  const ketQua = chuoiCho.then(viec, viec);
  /* Mắt kế tiếp chỉ chạy sau khi mắt này xong VÀ đã nghỉ đủ giãn cách. */
  chuoiCho = ketQua.then(
    () => new Promise(r => setTimeout(r, CACH_NHAU_MS)),
    () => new Promise(r => setTimeout(r, CACH_NHAU_MS))
  );
  return ketQua;
}

function khoaDem(lat, lon) {
  return Number(lat).toFixed(4) + ',' + Number(lon).toFixed(4);
}

/* Ghép địa chỉ gọn theo lối Việt Nam: số nhà + đường, phường/xã, quận/huyện, tỉnh/thành.
   `display_name` của Nominatim dài dòng (có cả mã bưu chính, "Việt Nam") nên tự ghép từ `address`. */
function ghepDiaChi(a) {
  if (!a) return '';
  const duong = [a.house_number, a.road || a.pedestrian || a.residential].filter(Boolean).join(' ');
  const phuong = a.quarter || a.suburb || a.village || a.hamlet || a.neighbourhood || '';
  const quan = a.city_district || a.district || a.town || a.county || '';
  const tinh = a.city || a.state || a.province || '';
  const phan = [duong, phuong, quan, tinh].map(s => String(s || '').trim()).filter(Boolean);
  /* Bỏ phần trùng nhau (Nominatim hay trả city = district ở một số nơi). */
  const gon = phan.filter((s, i) => phan.indexOf(s) === i);
  return gon.join(', ');
}

async function goiNominatim(lat, lon) {
  const url = 'https://nominatim.openstreetmap.org/reverse'
    + `?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&zoom=18&addressdetails=1`;
  const boQua = new AbortController();
  const hetGio = setTimeout(() => boQua.abort(), CHO_TOI_DA_MS);
  try {
    const r = await fetch(url, {
      signal: boQua.signal,
      headers: {
        /* Bắt buộc phải khai — xem ràng buộc 1 ở đầu file. */
        'User-Agent': 'QLNoiBo-MOYN/1.0 (he thong quan ly noi bo; lien he: nguyendlp@fpt.com)',
        'Accept-Language': 'vi'
      }
    });
    if (!r.ok) return '';
    const j = await r.json();
    return ghepDiaChi(j && j.address) || String((j && j.display_name) || '').trim();
  } finally {
    clearTimeout(hetGio);
  }
}

/* Trả về { diaChi, tuDem }. diaChi = '' nghĩa là không tra được (KHÔNG phải lỗi). */
async function diaChiTuToaDo(lat, lon) {
  const la = Number(lat), lo = Number(lon);
  if (!isFinite(la) || !isFinite(lo) || (la === 0 && lo === 0)) return { diaChi: '', tuDem: false };

  const k = khoaDem(la, lo);
  const cu = DEM.get(k);
  if (cu && (Date.now() - cu.luc) < HAN_DEM_MS) return { diaChi: cu.diaChi, tuDem: true };

  let diaChi = '';
  try {
    diaChi = await hangDoi(() => goiNominatim(la, lo));
  } catch (e) {
    /* Mạng lỗi / bị chặn / quá thời gian: im lặng trả rỗng. Ảnh vẫn đóng dấu được. */
    console.error('[diaChiTuToaDo] khong tra duoc dia chi:', e.message);
    diaChi = '';
  }
  /* CHỈ ghi đệm khi tra ĐƯỢC — đệm cả chuỗi rỗng là mất luôn cơ hội tra lại khi mạng đã tốt. */
  if (diaChi) DEM.set(k, { diaChi, luc: Date.now() });
  return { diaChi, tuDem: false };
}

module.exports = { diaChiTuToaDo, ghepDiaChi, khoaDem };
