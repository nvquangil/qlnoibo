/* ================================================================================================
   docMaTuAnh.js  —  v9.28 (Zalo OA, Giai đoạn 1 — ĐỌC MÃ VẠCH / QR TỪ ẢNH CHỤP TEM)

   Nguyen 2026-11-06: tem sản phẩm có **mã sản phẩm (chữ) + mã vạch**, in từ phần mềm; và khách gửi
   cả ảnh chụp tem. Đây là đường tra CHẮC NHẤT trong các kiểu ảnh — đọc được mã là xong, không phải
   đoán gì.

   🔴 ĐỪNG KỲ VỌNG NHƯ MÁY QUÉT. Máy quét chĩa thẳng, đủ sáng, nét ⇒ ~99%. Còn ở đây là: khách cầm
   điện thoại chụp nghiêng, có khi lóa đèn, **rồi Zalo NÉN ảnh thêm một lần nữa**. Mã vạch 1D vạch
   mảnh, mất nét là mất luôn ⇒ thực tế 60–85%. QR chịu được mờ/nghiêng/che một phần nhờ tự sửa lỗi
   (90%+) nhưng tem hiện CHƯA có QR. Vì vậy hàm này thử nhiều biến thể ảnh trước khi chịu thua, và
   nơi gọi PHẢI có đường lùi (OCR / dHash / đưa ứng viên cho khách chọn).

   Thư viện: `@zxing/library` — thuần JS, KHÔNG cần biên dịch native (quan trọng: máy chủ là Windows
   ở xưởng; `zbar` nhanh hơn nhưng phải build). Nạp LƯỜI: chưa cài thì hàm trả `{ coThuVien: false }`
   chứ không làm sập cả tiến trình — phần tra theo chữ (v9.25) vẫn phải chạy bình thường.
   ================================================================================================ */
const sharp = require('sharp');
sharp.cache(false);   // v6.07.1 — libvips giữ file trên Windows, xem routes/anh.js

let __zx = null;
let __daThuNap = false;
function napThuVien() {
  if (__daThuNap) return __zx;
  __daThuNap = true;
  try { __zx = require('@zxing/library'); }
  catch (e) { __zx = null; }   // chưa `npm i @zxing/library` — đường này tắt, các đường khác vẫn chạy
  return __zx;
}
function coThuVien() { return !!napThuVien(); }

/* Một lần thử giải mã trên MỘT biến thể ảnh đã dựng sẵn (RGBA thô). */
function giaiMaRaw(zx, data, rong, cao) {
  /* RGBLuminanceSource nhận mảng Int32 ARGB/0xRRGGBB — dựng từ RGBA thô của sharp. */
  const luong = new Int32Array(rong * cao);
  for (let i = 0, j = 0; i < luong.length; i++, j += 4) {
    luong[i] = (data[j] << 16) | (data[j + 1] << 8) | data[j + 2];
  }
  const nguon = new zx.RGBLuminanceSource(luong, rong, cao);
  const anhNhiPhan = new zx.BinaryBitmap(new zx.HybridBinarizer(nguon));
  const reader = new zx.MultiFormatReader();
  const goiY = new Map();
  goiY.set(zx.DecodeHintType.TRY_HARDER, true);
  reader.setHints(goiY);
  try {
    const kq = reader.decode(anhNhiPhan);
    return kq ? { text: String(kq.getText() || '').trim(), dang: String(kq.getBarcodeFormat && kq.getBarcodeFormat()) } : null;
  } catch (e) { return null; }   // zxing ném NotFoundException khi không thấy — đó là chuyện thường
}

/* ------------------------------------------------------------------------------------------------
   ĐỌC MÃ TỪ ẢNH.

   🔴 v9.29 — SAU KHI XEM ẢNH THẬT KHÁCH GỬI (Nguyen 2026-11-06). Ba tấm mẫu cho thấy giả định cũ
   SAI ở chỗ nào: khách chụp CẢ ĐỐNG HÀNG trên sàn (2–3 món một ảnh, có tay người, nền gỗ/gạch),
   cái tem nằm lọt thỏm **chiếm chừng 1/20 chiều rộng ảnh** và còn nghiêng. Giải mã trên ảnh TOÀN
   CẢNH thu về 1600px thì vạch mã chỉ còn vài pixel — gần như chắc chắn trượt, dù ảnh gốc nét.

   Nên thêm bước QUÉT THEO Ô: chia ảnh thành lưới (3×3 + 5×5 chồng mép), mỗi ô **phóng to** rồi mới
   giải mã. Tem nhỏ trong ảnh lớn nhờ vậy mới đủ pixel. Đắt hơn (vài chục lần giải mã) nhưng vẫn
   dưới một giây và chỉ chạy khi ảnh toàn cảnh đã trượt.

   Thứ tự: ảnh nguyên (rẻ, ăn ngay khi khách chụp cận tem) → tăng tương phản/làm nét → xoay →
   QUÉT Ô 3×3 → QUÉT Ô 5×5. Dừng NGAY khi ra kết quả.
   Trả { ma, dang } hoặc null. KHÔNG tự tra cơ sở dữ liệu — việc đó của traCuuHangCongKhai.
   ------------------------------------------------------------------------------------------------ */
const CANH_TOI_DA = 1600;
const CANH_O = 900;          // mỗi ô cắt ra được phóng lên cỡ này trước khi giải mã
const CHONG_MEP = 0.25;      // ô chồng mép 25% — tem nằm vắt qua ranh giới vẫn lọt trọn vào một ô

async function raRGBA(sharpObj) {
  const r = await sharpObj.removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data, info } = r;
  /* sharp trả RGB 3 kênh sau removeAlpha — dựng mảng 4 kênh cho giaiMaRaw đọc đều bước. */
  const rgba = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0, j = 0, k = 0; i < info.width * info.height; i++, j += 3, k += 4) {
    rgba[k] = data[j]; rgba[k + 1] = data[j + 1]; rgba[k + 2] = data[j + 2]; rgba[k + 3] = 255;
  }
  return { rgba, w: info.width, h: info.height };
}

async function docMaTuAnh(buf) {
  const zx = napThuVien();
  if (!zx) return { coThuVien: false, ma: null, dang: null };

  /* --- Vòng 1: cả ảnh, vài biến thể rẻ ------------------------------------------------------- */
  const bienThe = [
    (s) => s,
    (s) => s.normalise().sharpen(),
    (s) => s.rotate(90),
    (s) => s.rotate(180),
    (s) => s.rotate(270),
    (s) => s.normalise().sharpen().rotate(90),
    (s) => s.normalise().sharpen().rotate(270)
  ];
  for (const dung of bienThe) {
    try {
      const { rgba, w, h } = await raRGBA(dung(sharp(buf).rotate()   // .rotate() trống = xoay theo EXIF
        .resize({ width: CANH_TOI_DA, height: CANH_TOI_DA, fit: 'inside', withoutEnlargement: true })));
      const kq = giaiMaRaw(zx, rgba, w, h);
      if (kq && kq.text) return { coThuVien: true, ma: kq.text, dang: kq.dang, duong: 'ca-anh' };
    } catch (e) { /* biến thể này dựng không nổi thì thử cái khác */ }
  }

  /* --- Vòng 2: QUÉT THEO Ô, phóng to từng ô --------------------------------------------------- */
  let goc;
  try {
    goc = await sharp(buf).rotate().removeAlpha()
      .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
      .toBuffer({ resolveWithObject: true });
  } catch (e) { return { coThuVien: true, ma: null, dang: null, duong: null }; }
  const W = goc.info.width, H = goc.info.height;

  for (const n of [3, 5]) {
    const buocX = Math.floor(W / n), buocY = Math.floor(H / n);
    const chongX = Math.floor(buocX * CHONG_MEP), chongY = Math.floor(buocY * CHONG_MEP);
    for (let iy = 0; iy < n; iy++) {
      for (let ix = 0; ix < n; ix++) {
        const left = Math.max(0, ix * buocX - chongX);
        const top = Math.max(0, iy * buocY - chongY);
        const width = Math.min(W - left, buocX + chongX * 2);
        const height = Math.min(H - top, buocY + chongY * 2);
        if (width < 40 || height < 40) continue;
        try {
          const o = sharp(goc.data, { raw: { width: W, height: H, channels: 3 } })
            .extract({ left, top, width, height })
            .resize({ width: CANH_O, height: CANH_O, fit: 'inside' })   // PHÓNG TO ô — mấu chốt
            .normalise().sharpen();
          const { rgba, w, h } = await raRGBA(o);
          const kq = giaiMaRaw(zx, rgba, w, h);
          if (kq && kq.text) return { coThuVien: true, ma: kq.text, dang: kq.dang, duong: 'quet-o-' + n };
        } catch (e) { /* ô này hỏng thì bỏ qua */ }
      }
    }
  }
  return { coThuVien: true, ma: null, dang: null, duong: null };
}

module.exports = { docMaTuAnh, coThuVien, CANH_TOI_DA, CANH_O, CHONG_MEP };

/* ---- chạy thẳng để đo trên ẢNH THẬT: node backend\utils\docMaTuAnh.js <file1> <file2> ... ------
   🔴 Đây là cách DUY NHẤT biết tỉ lệ đọc thật. Dùng đúng những ảnh khách gửi qua Zalo (tải về từ
   chat, KHÔNG phải ảnh gốc trong máy) — Zalo nén ảnh, đó mới là điều kiện thật. */
if (require.main === module) {
  const duongDan = process.argv.slice(2).filter(x => !x.startsWith('--'));
  if (!duongDan.length) {
    console.log('Dùng: node backend\\utils\\docMaTuAnh.js <ảnh1.jpg> [ảnh2.jpg ...]');
    process.exit(0);
  }
  (async () => {
    const fs = require('fs');
    if (!coThuVien()) console.log('⚠️  Chưa cài @zxing/library — chạy: npm i @zxing/library\n');
    let doc = 0;
    for (const f of duongDan) {
      const t0 = Date.now();
      let kq;
      try { kq = await docMaTuAnh(fs.readFileSync(f)); }
      catch (e) { console.log(`❌ ${f}: ${e.message}`); continue; }
      const giay = ((Date.now() - t0) / 1000).toFixed(1);
      if (kq.ma) { doc++; console.log(`✅ ${f}\n   mã: ${kq.ma}  (${kq.dang}, qua ${kq.duong}, ${giay}s)`); }
      else console.log(`—  ${f}: không đọc được mã (${giay}s)`);
    }
    console.log(`\nĐọc được ${doc}/${duongDan.length} ảnh.`);
  })();
}
