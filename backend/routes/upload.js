const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');   // v6.07 — đã có sẵn từ v5.18 (xuất Excel ảnh), không phải cài mới
sharp.cache(false);   // v6.07.1: không cho libvips giữ file ảnh đang mở (trên Windows sẽ chặn ghi/xóa file đó)
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

/* ==================================================================================================
   v6.07 — NÉN / THU NHỎ ẢNH NGAY KHI TẢI LÊN
   Vì sao: trước đây ảnh được ghi vào ổ đĩa Y NGUYÊN như máy ảnh/điện thoại xuất ra (1 ảnh 24 MB, 4000px).
   Hệ quả: (1) tải lên rất chậm vì phải đẩy đủ 24 MB qua mạng; (2) MỌI trang có ảnh (thẻ kho, catalogue)
   phải tải lại đúng file 24 MB đó chỉ để hiển thị 1 ô 40×40px -> mở catalogue vài chục sản phẩm là hàng
   trăm MB. Không cần thiết: ảnh dùng trong hệ thống chỉ cần cạnh dài ~1600px.
   Cách làm: nhận file vào BỘ NHỚ (không ghi file tạm) -> sharp: xoay đúng chiều theo EXIF -> thu nhỏ về
   cạnh dài tối đa 1600px (KHÔNG phóng to ảnh nhỏ) -> nén JPEG q82 (ảnh có nền trong suốt thì giữ PNG).
   Giới hạn nâng từ 8 MB lên 30 MB: ảnh điện thoại thường 8–25 MB, trước đây bị CHẶN thẳng ở 8 MB với
   thông báo lỗi khó hiểu. Nay nhận rồi nén xuống còn vài trăm KB.
   Ảnh CŨ (đã nằm trên ổ đĩa) không bị ảnh hưởng — dùng `node utils/nen_anh_uploads.js` để nén hàng loạt.
   ================================================================================================== */
const CANH_TOI_DA = 1600;          // cạnh dài tối đa sau khi thu nhỏ
const CHAT_LUONG_JPEG = 82;        // đủ đẹp cho ảnh sản phẩm, dung lượng nhỏ
const GIOI_HAN_TAI_LEN = 30 * 1024 * 1024;

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: GIOI_HAN_TAI_LEN } });

// Bọc multer để lỗi "file quá lớn" ra thông báo TIẾNG VIỆT rõ ràng (trước đây rơi vào handler lỗi chung).
function nhanFile(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: `Ảnh quá lớn (giới hạn ${Math.round(GIOI_HAN_TAI_LEN / 1024 / 1024)} MB). Hãy chụp/xuất ảnh nhỏ hơn rồi thử lại.`
      });
    }
    return res.status(400).json({ success: false, message: 'Lỗi khi nhận file: ' + err.message });
  });
}

function tenFileAnToan(prefix, ext) {
  const safeBase = String(prefix || 'anh').replace(/[^a-zA-Z0-9_\-]/g, '') || 'anh';
  return `${safeBase}_${Date.now()}${ext}`;
}

// POST /api/upload  (multipart/form-data, field name = "file", optional field "prefix")
router.post('/', requireAuth, nhanFile, async (req, res) => {
  if (!req.file || !req.file.buffer) return res.status(400).json({ success: false, message: 'Không nhận được file.' });
  const goc = req.file.buffer;
  const laAnh = /^image\//i.test(req.file.mimetype || '');
  try {
    if (!laAnh) {
      // Không phải ảnh (rất ít gặp ở luồng này) -> ghi nguyên bản, không xử lý gì.
      const ten = tenFileAnToan(req.body.prefix, path.extname(req.file.originalname) || '');
      fs.writeFileSync(path.join(uploadDir, ten), goc);
      return res.json({ success: true, url: `/uploads/${ten}` });
    }
    const anh = sharp(goc, { failOn: 'none' });
    const meta = await anh.metadata();
    const giuPng = !!meta.hasAlpha;   // ảnh có nền trong suốt: đổi sang JPEG sẽ thành nền đen -> giữ PNG
    let xuLy = anh.rotate().resize({
      width: CANH_TOI_DA, height: CANH_TOI_DA, fit: 'inside', withoutEnlargement: true
    });
    xuLy = giuPng ? xuLy.png({ compressionLevel: 9 }) : xuLy.jpeg({ quality: CHAT_LUONG_JPEG, mozjpeg: true });
    const buf = await xuLy.toBuffer();
    const ten = tenFileAnToan(req.body.prefix, giuPng ? '.png' : '.jpg');
    fs.writeFileSync(path.join(uploadDir, ten), buf);
    return res.json({
      success: true, url: `/uploads/${ten}`,
      // Trả kèm số liệu để có thể hiện "đã nén từ 24 MB -> 280 KB" nếu cần đối chiếu.
      kichThuocGoc: goc.length, kichThuocSauNen: buf.length
    });
  } catch (err) {
    console.error('Lỗi nén ảnh khi tải lên, ghi nguyên bản:', err.message);
    // sharp không đọc được (định dạng lạ, ảnh hỏng) -> KHÔNG làm người dùng mất ảnh: ghi nguyên bản.
    try {
      const ten = tenFileAnToan(req.body.prefix, path.extname(req.file.originalname) || '.jpg');
      fs.writeFileSync(path.join(uploadDir, ten), goc);
      return res.json({ success: true, url: `/uploads/${ten}`, canhBao: 'Không nén được ảnh, đã lưu nguyên bản.' });
    } catch (e2) {
      return res.status(500).json({ success: false, message: 'Không lưu được ảnh: ' + e2.message });
    }
  }
});

module.exports = router;
