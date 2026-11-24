/* ================================================================================================
   kiem_tra_tho_may_khong_thay_muc_v993.sql — CHỈ ĐỌC, không sửa gì
   ------------------------------------------------------------------------------------------------
   Nguyen 23/11: *"Nhân viên bộ phận may vào nhưng không có phần tự cập nhật của mình"* (v9.90 đã
   deploy). File này trả lời dứt điểm VÌ SAO, thay vì đoán.

   v9.90 ẩn mục đi mà không nói lý do — đó là lỗi thiết kế, v9.93 đã sửa (mục luôn hiện, kèm câu
   lý do). Nhưng vẫn nên chạy file này một lần để biết dữ liệu đang vướng chỗ nào.

   ⚠️ Chạy TRÊN CSDL THẬT. Không có UPDATE/DELETE/INSERT nào.
   ================================================================================================ */
SET NOCOUNT ON;

/* ---- A. BA ĐIỀU KIỆN để thấy mục "Công đoạn may của tôi" ------------------------------------
   ① Users.NhanVienID khác NULL (tài khoản đã liên kết hồ sơ nhân viên)
   ② NhanVien.BoPhanID khác NULL
   ③ BoPhan.TenBoPhan có MỘT TỪ đúng là "May"  (v9.90 bắt BẰNG ĐÚNG 'May'; v9.93 nới ra theo từ,
      nên "Tổ may" / "May 1" sẽ chạy được từ v9.93 trở đi — nhưng "Máy" (có dấu) thì KHÔNG, cố ý.)
   Cột KetLuan nói thẳng tài khoản nào vướng gì. */
SELECT
  u.UserID, u.Username, u.HoTen AS TenTaiKhoan,
  u.NhanVienID,
  nv.HoTen       AS TenNhanVien,
  bp.TenBoPhan,
  KetLuan = CASE
    WHEN u.NhanVienID IS NULL       THEN N'① CHUA LIEN KET NHAN VIEN -> Quan ly User > sua tai khoan > Lien ket nhan vien'
    WHEN nv.NhanVienID IS NULL      THEN N'① Lien ket toi NhanVienID khong ton tai -> gan lai'
    WHEN nv.BoPhanID IS NULL        THEN N'② NHAN VIEN CHUA KHAI BO PHAN -> Nhan su > sua nhan vien > chon bo phan May'
    WHEN LTRIM(RTRIM(bp.TenBoPhan)) = N'May' THEN N'OK — thay duoc o CA v9.90 lan v9.93'
    WHEN N' ' + bp.TenBoPhan + N' ' LIKE N'% May %' THEN N'③ Ten bo phan co tu "May" nhung KHONG bang dung "May" -> v9.90 KHONG thay, v9.93 THAY'
    ELSE N'③ Bo phan khong phai May -> dung nhu thiet ke, khong tu ghi duoc'
  END
FROM Users u
LEFT JOIN NhanVien nv ON nv.NhanVienID = u.NhanVienID
LEFT JOIN BoPhan  bp ON bp.BoPhanID   = nv.BoPhanID
ORDER BY CASE WHEN u.Username = 'quan' THEN 0 ELSE 1 END, u.Username;

/* ---- B. Danh sách bộ phận đang có (xem tên có đúng chữ "May" không) ------------------------- */
SELECT b.BoPhanID, b.TenBoPhan,
       SoNhanVien = (SELECT COUNT(*) FROM NhanVien n WHERE n.BoPhanID = b.BoPhanID),
       SoTaiKhoan = (SELECT COUNT(*) FROM Users u2 JOIN NhanVien n2 ON n2.NhanVienID = u2.NhanVienID WHERE n2.BoPhanID = b.BoPhanID)
FROM BoPhan b ORDER BY b.TenBoPhan;

/* ---- C. Có lệnh nào ĐANG ĐỨNG ở công đoạn May không? ----------------------------------------
   v9.93 chỉ liệt kê lệnh có CongDoanHienTaiID = StageID của 'MAY'. Không có lệnh nào ở đó thì thợ
   may mở ra vẫn thấy mục, nhưng danh sách rỗng — và màn hình nói rõ điều đó. */
SELECT s.StageID, s.MaCongDoan, s.TenCongDoan,
       SoLenhDangODay = (SELECT COUNT(*) FROM DonHangSanXuat d WHERE d.CongDoanHienTaiID = s.StageID)
FROM CongDoanSanXuat s WHERE s.MaCongDoan = 'MAY';

SELECT TOP 30 d.MaDH, d.TenSanPham, CONVERT(varchar(10), d.NgayGiaoDuKien, 23) AS Deadline,
       SoCongDoanMayDaKhai = (SELECT COUNT(*) FROM DonHangDonGiaCongDoanMay g WHERE g.DonHangID = d.DonHangID)
FROM DonHangSanXuat d
WHERE d.CongDoanHienTaiID = (SELECT TOP 1 StageID FROM CongDoanSanXuat WHERE MaCongDoan = 'MAY')
ORDER BY d.NgayGiaoDuKien;

/* ---- D. Chức năng "xem tất cả" đã khai chưa (migration_v907) -------------------------------- */
SELECT ModuleCode, MaChucNang, TenChucNang, MacDinhCho
FROM ChucNang WHERE MaChucNang = 'congdoanmaytatca';
/* Rỗng = CHƯA chạy migration_v907.sql. Không ảnh hưởng việc TỰ GHI (tự ghi không cần tick),
   chỉ làm tổ trưởng không bật được quyền xem của mọi người. */
