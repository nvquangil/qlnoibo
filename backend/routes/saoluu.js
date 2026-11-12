/* ================================================================================================
   SAO LƯU CSDL — ROUTE                                                                      v9.37
   ------------------------------------------------------------------------------------------------
   Nguyen 2026-11-10: *"không quan tâm SQL, tự cấu hình backup trên phần mềm và có nút backup"*.

   Ba đường:
     GET  /api/saoluu/trangthai   — màn hình theo dõi (lần gần nhất, cảnh báo, danh sách bản)
     POST /api/saoluu/chay        — nút "Sao lưu ngay"
     GET  /api/saoluu/tai/:ten    — tải một bản về máy

   🔴 QUYỀN: cả ba đều đòi ADMIN, không chỉ requireAuth. File .bak là TOÀN BỘ dữ liệu công ty —
   lương từng người, giá vốn, công nợ, giá bán từng khách. Một tài khoản tổ cắt tải được file này là
   lộ sạch. Đây KHÔNG phải chỗ dùng ma trận phân quyền theo module như các màn nghiệp vụ.

   🔴 /tai/:ten — chống đi ngược thư mục (path traversal). Tên file do người dùng gửi lên; không
   chặn thì `..\..\..\Windows\win.ini` tải được bất cứ file nào trên máy chủ. Chỉ nhận đúng dạng tên
   mà chính hệ thống sinh ra, và sau khi ghép đường dẫn còn kiểm lại nó có THỰC SỰ nằm trong thư mục
   sao lưu không.
   ================================================================================================ */
const express = require('express');
const fs = require('fs');
const path = require('path');
const { requireAuth } = require('../middleware/auth');
const saoLuu = require('../utils/saoLuuCSDL');

const router = express.Router();

/* Chỉ Admin. `isAdmin` là trường THẬT của phiên đăng nhập — utils/loadUserContext.js:158, bật khi
   user thuộc một nhóm có `Groups.IsAdmin = 1`. KHÔNG dò theo TÊN nhóm: tên nhóm người dùng đổi
   được trong Danh mục, đổi xong là quyền mở toang hoặc đóng sập mà không ai biết vì sao. */
function chiAdmin(req, res, next) {
  const u = req.session && req.session.user;
  if (!u) return res.status(401).json({ success: false, message: 'Chưa đăng nhập.' });
  if (u.isAdmin !== true) {
    return res.status(403).json({ success: false,
      message: 'Chỉ quản trị viên mới xem/chạy được sao lưu — file sao lưu chứa toàn bộ dữ liệu công ty.' });
  }
  next();
}

router.get('/trangthai', requireAuth, chiAdmin, async (req, res) => {
  try {
    res.json({ success: true, data: await saoLuu.trangThai() });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: err.message });
  }
});

router.post('/chay', requireAuth, chiAdmin, async (req, res) => {
  /* chayMotLan() KHÔNG BAO GIỜ ném — nó luôn trả { thanhCong, thongDiep }. Thất bại thì trả 200 kèm
     thanhCong:false chứ không phải mã lỗi HTTP: đây là KẾT QUẢ NGHIỆP VỤ (ổ đầy, thiếu quyền ghi),
     không phải hỏng request. Xem feedback_qlnoibo_khong_tra_401_cho_loi_nghiep_vu. */
  /* 🔴 try/catch VẪN cần: `trangThai()` ở dòng dưới CÓ thể ném (fs.readdirSync EACCES trên thư mục
     đích, CSDL rớt giữa chừng). Express 4 không bắt lỗi của handler async ⇒ request TREO vĩnh viễn,
     người dùng ngồi chờ hết giờ rồi nhận câu lỗi sai hoàn toàn. */
  try {
    /* Bấm tay thì đi qua `chayVaBao` chứ không gọi thẳng `chayMotLan`: sửa xong lỗi rồi bấm tay mà
       không gỡ cờ "đang hỏng" thì email "đã bình thường trở lại" phải đợi tới lần chạy theo lịch. */
    const kq = await require('../utils/canhBaoSaoLuu').chayVaBao('tay');
    res.json({ success: true, data: Object.assign({}, kq, { trangThai: await saoLuu.trangThai() }) });
  } catch (err) {
    console.error('[saoluu] POST /chay: ' + (err && err.message));
    res.json({ success: true, data: { thanhCong: false, thongDiep: 'Lỗi ngoài dự kiến: ' + (err && err.message) } });
  }
});

/* v9.41: chạy tay một lần sao lưu transaction log. Nhanh hơn sao lưu đầy đủ rất nhiều (chỉ phần
   phát sinh từ lần log trước), nên không cần cơ chế quay vòng như POST /chay. */
router.post('/chaylog', requireAuth, chiAdmin, async (req, res) => {
  try {
    const kq = await require('../utils/canhBaoSaoLuu').chayLogVaBao('tay');
    res.json({ success: true, data: Object.assign({}, kq, { trangThai: await saoLuu.trangThai() }) });
  } catch (err) {
    console.error('[saoluu] POST /chaylog: ' + (err && err.message));
    res.json({ success: true, data: { thanhCong: false, thongDiep: 'Lỗi ngoài dự kiến: ' + (err && err.message) } });
  }
});

/* ------------------------------------------------------------------------------------------------
   CẤU HÌNH — Nguyen 2026-11-10: *"trong backup có chọn thư mục backup"*.
   Lưu ở bảng CauHinh (khóa SAO_LUU), không ở .env. Xem khối ghi chú trong utils/saoLuuCSDL.js.
   ------------------------------------------------------------------------------------------------ */
router.get('/odia', requireAuth, chiAdmin, async (req, res) => {
  try { res.json({ success: true, data: await saoLuu.danhSachODia() }); }
  catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

/* Kiểm thư mục bằng PHÉP THỬ THẬT (bắt SQL Server ghi file vào đó) — xem kiemThuMuc().
   Trả 200 kèm ok:false khi thư mục không dùng được: đó là KẾT QUẢ kiểm tra, không phải request hỏng. */
router.post('/kiemthumuc', requireAuth, chiAdmin, async (req, res) => {
  try {
    const b = req.body || {};
    const chinh = await saoLuu.kiemThuMuc(b.thuMuc);
    /* Thư mục thứ hai kiểm bằng phép thử KHÁC (Node ghi, không phải SQL) — xem kiemThuMucPhu().
       Trả cả hai trong một lần bấm: bắt người dùng bấm hai nút cho hai thư mục là mời họ quên một. */
    const phu = b.thuMucPhu ? saoLuu.kiemThuMucPhu(b.thuMucPhu) : null;
    res.json({ success: true, data: Object.assign({}, chinh, { phu }) });
  } catch (err) { res.json({ success: true, data: { ok: false, thongDiep: err.message } }); }
});

router.put('/cauhinh', requireAuth, chiAdmin, async (req, res) => {
  try {
    const ch = await saoLuu.luuCauHinh(req.body || {});
    /* Đổi giờ chạy / bật-tắt thì phải ĐẶT LẠI LỊCH ngay. Không thì người dùng đổi giờ, thấy màn
       hình báo đã lưu, mà lịch vẫn chạy theo giờ cũ cho tới lần restart sau — im lặng và khó tin. */
    let lich = null;
    try { lich = require('../utils/lichSaoLuu').datLaiLich(); }
    catch (e) { console.error('[saoluu] không đặt lại được lịch: ' + e.message); }
    res.json({ success: true, data: { cauHinh: ch, lich } });
  } catch (err) {
    /* Thư mục không hợp lệ là LỖI NGHIỆP VỤ -> 400, kèm đúng câu giải thích của kiemThuMucAnToan. */
    res.status(400).json({ success: false, message: err.message });
  }
});

router.get('/tai/:ten', requireAuth, chiAdmin, (req, res) => {
  const ten = String(req.params.ten || '');
  /* Chỉ nhận ĐÚNG dạng tên hệ thống sinh ra: <TenCSDL>_YYYYMMDD_HHmm.bak
     🔴 Dùng CHUNG `khuonTenBan()` với nơi liệt kê và nơi dọn bản cũ. Bản đầu dựng regex riêng ở đây
     bằng cách XÓA ký tự lạ khỏi tên CSDL (`replace(/[^A-Za-z0-9_]/g,'')`) thay vì escape — tên CSDL
     có dấu "-" hay khoảng trắng là khuôn lệch hẳn với tên file thật, không ai tải được bản nào mà
     câu báo lại là "Tên file không hợp lệ". Ba nơi ba khuôn khác nhau là ba hành vi khác nhau. */
  /* v9.41: nhận CẢ bản log (.trn). Hai khuôn riêng, không nới một khuôn cho khớp cả hai — nới ra
     là mở đúng cái cửa mà hai lớp chắn này sinh ra để đóng. */
  if (!saoLuu.khuonTenBan().test(ten) && !saoLuu.khuonTenLog().test(ten)) {
    return res.status(400).json({ success: false, message: 'Tên file sao lưu không hợp lệ.' });
  }
  const thuMuc = saoLuu.cauHinh().thuMuc || '';
  const duongDan = path.join(thuMuc, ten);
  /* Lớp chắn thứ hai: sau khi ghép xong vẫn phải nằm trong thư mục sao lưu. */
  const goc = path.resolve(thuMuc);
  if (!goc || path.resolve(duongDan).indexOf(goc + path.sep) !== 0) {
    return res.status(400).json({ success: false, message: 'Đường dẫn không hợp lệ.' });
  }
  if (!fs.existsSync(duongDan)) {
    return res.status(404).json({ success: false, message: 'Không còn file này (có thể đã bị dọn theo hạn giữ).' });
  }
  console.log('[saoluu] ' + (req.session.user.hoTen || req.session.user.userId) + ' tải bản ' + ten);
  res.download(duongDan, ten);
});

module.exports = router;
