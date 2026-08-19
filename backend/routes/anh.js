const express = require('express');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

/* v6.07.1: TẮT bộ nhớ đệm của libvips. Nếu bật (mặc định), libvips GIỮ file ảnh đang mở sau khi đọc —
   trên Windows thì mọi thao tác ghi/xóa/đổi tên file đó về sau đều lỗi "UNKNOWN: unknown error, open ..."
   (đúng lỗi gặp khi chạy utils/nen_anh_uploads.js). Ở đây cũng ĐỌC ảnh vào bộ nhớ trước rồi mới xử lý,
   để route này không bao giờ là thứ đang giữ file gốc. */
sharp.cache(false);

const router = express.Router();

/* ==================================================================================================
   v6.07 — ẢNH XEM TRƯỚC (thumbnail) TẠO THEO YÊU CẦU
   GET /anh/<cạnh>/<tên file trong uploads>     ví dụ: /anh/160/anh_1730000000000.jpg

   Vì sao cần: các bảng/danh sách và catalogue hiển thị ảnh ở ô 40–320px nhưng lại tải ĐÚNG file gốc
   (có ảnh 24 MB). Mở catalogue vài chục sản phẩm là tải hàng trăm MB -> "load ảnh rất lâu".
   Cách làm: lần đầu ai đó xin ảnh cỡ nhỏ thì tạo bằng sharp rồi GHI ĐỆM vào uploads/.thumb/<cạnh>/,
   các lần sau đọc thẳng file đệm (không xử lý lại). Nhờ vậy ẢNH CŨ đã nằm trên ổ đĩa cũng được hưởng
   ngay, KHÔNG cần sửa dữ liệu và KHÔNG cần thêm cột nào trong CSDL.
   Không đọc/ghi được (ảnh hỏng, định dạng lạ) -> trả về ẢNH GỐC, không bao giờ trả ảnh lỗi.
   Route này CÔNG KHAI (giống /uploads) để trang catalogue dùng được — xem laDuongDanCong() ở server.js.
   ================================================================================================== */
const uploadDir = path.join(__dirname, '..', 'uploads');
const thumbDir = path.join(uploadDir, '.thumb');
const CANH_CHO_PHEP = [80, 160, 320, 640, 800, 1200];
const MOT_NAM = 365 * 24 * 60 * 60;   // giây — tên file có timestamp nên không sợ đệm sai ảnh

// Chặn path traversal: chỉ nhận tên file phẳng, ký tự an toàn.
function tenAnToan(ten) {
  const t = path.basename(String(ten || ''));
  return /^[A-Za-z0-9._-]+$/.test(t) ? t : null;
}

router.get('/:canh/:ten', async (req, res) => {
  const canh = parseInt(req.params.canh, 10);
  const ten = tenAnToan(req.params.ten);
  if (!ten) return res.status(400).end();
  if (CANH_CHO_PHEP.indexOf(canh) === -1) {
    return res.status(400).json({ success: false, message: 'Cỡ ảnh không hợp lệ (chỉ nhận: ' + CANH_CHO_PHEP.join(', ') + ').' });
  }
  const fileGoc = path.join(uploadDir, ten);
  if (!fs.existsSync(fileGoc)) return res.status(404).end();

  const guiGoc = () => res.sendFile(fileGoc, { maxAge: MOT_NAM * 1000, immutable: true });
  const thuMuc = path.join(thumbDir, String(canh));
  // Ảnh đệm luôn là .jpg, TRỪ ảnh nền trong suốt (giữ .png) — thử cả 2 khi đọc đệm.
  const dem = (duoi) => path.join(thuMuc, ten.replace(/\.[^.]+$/, '') + duoi);
  for (const duoi of ['.jpg', '.png']) {
    if (fs.existsSync(dem(duoi))) return res.sendFile(dem(duoi), { maxAge: MOT_NAM * 1000, immutable: true });
  }
  try {
    if (!fs.existsSync(thuMuc)) fs.mkdirSync(thuMuc, { recursive: true });
    const anh = sharp(fs.readFileSync(fileGoc), { failOn: 'none' });   // v6.07.1: đọc buffer, không giữ file
    const meta = await anh.metadata();
    const giuPng = !!meta.hasAlpha;
    let xuLy = anh.rotate().resize({ width: canh, height: canh, fit: 'inside', withoutEnlargement: true });
    xuLy = giuPng ? xuLy.png({ compressionLevel: 9 }) : xuLy.jpeg({ quality: 80, mozjpeg: true });
    const buf = await xuLy.toBuffer();
    const dich = dem(giuPng ? '.png' : '.jpg');
    fs.writeFileSync(dich, buf);
    res.set('Cache-Control', `public, max-age=${MOT_NAM}, immutable`);
    res.type(giuPng ? 'image/png' : 'image/jpeg');
    return res.end(buf);
  } catch (err) {
    console.error('Không tạo được ảnh xem trước cho', ten, '-', err.message);
    return guiGoc();
  }
});

module.exports = router;
