/* ================================================================================================
   migration_v907.sql — v9.90: THỢ MAY TỰ GHI CÔNG ĐOẠN MAY CỦA MÌNH
   ------------------------------------------------------------------------------------------------
   Nguyen 23/11/2026: *"Công đoạn may phần cập nhật nhân viên và số lượng có thể cho nhân viên tự
   nhập khi phân quyền... hoặc nhân viên thuộc bộ phận may nhập công đoạn của mình... Để cả 2 cách
   cập nhật."* — chốt tiếp: *"chỉ cần thuộc bộ phận May, nhưng chỉ nhìn thấy của mình không thấy
   của người khác. Thêm tick quyền cho người khác như tổ trưởng nhìn thấy hết của mọi người."*

   KHÔNG có bảng/cột mới: dòng thợ may tự ghi vào ĐÚNG bảng `PhanCongMay` mà QLSX › Ghi tiến độ ›
   May vẫn ghi — một nghiệp vụ một luồng, lương khoán may chỉ có một nguồn.

   File này CHỈ thêm MỘT dòng chức năng:
     MYPAY/congdoanmaytatca — "tổ trưởng xem được công đoạn may của MỌI người".
   MacDinhCho = 0 ⇒ mặc định TẮT, phải tick mới có. Bắt buộc opt-in vì đây là quyền MỞ RỘNG phạm vi
   (thấy số của người khác = thấy lương khoán của người khác); mặc định bật cho mọi người là lộ
   lương chéo. Backend đọc bằng coQuyenChucNang() — hàm "không có dòng cấu hình = KHÔNG có quyền",
   ngược hẳn requireChucNang (thiếu cấu hình = cho qua).

   KHÔNG có chức năng cho việc TỰ GHI: theo đúng chốt của Nguyen, cứ thuộc bộ phận "May" là ghi
   được, không phải tick gì. Máy chủ kiểm bộ phận ở chanNeuKhongPhaiThoMay() trong routes/qlsx.js.

   Chạy SAU: migration_v895.sql (đã thêm MYPAY/sanluongcuatoi).
   Chạy TRƯỚC khi pm2 restart. Chạy lại nhiều lần vô hại (MERGE theo khóa ModuleCode + MaChucNang).
   ================================================================================================ */

SET NOCOUNT ON;
GO

/* ---- 1. Chức năng "xem hết của mọi người" (MacDinhCho = 0: phải tick) ---------------------- */
IF COL_LENGTH('ChucNang', 'MacDinhCho') IS NULL
BEGIN
  RAISERROR(N'Bang ChucNang chua co cot MacDinhCho — chay migration_v684.sql truoc roi chay lai file nay.', 16, 1);
END
ELSE
BEGIN
  MERGE ChucNang AS t
  USING (VALUES
    ('MYPAY', 'congdoanmaytatca', N'Công đoạn may: xem của MỌI người (tổ trưởng) — phải tick mới có', 3, 0)
  ) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu, MacDinhCho)
    ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
  WHEN MATCHED THEN UPDATE SET t.TenChucNang = s.TenChucNang, t.ThuTu = s.ThuTu, t.MacDinhCho = s.MacDinhCho
  WHEN NOT MATCHED THEN INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu, MacDinhCho)
    VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu, s.MacDinhCho);

  PRINT N'v907: da khai chuc nang MYPAY/congdoanmaytatca (MacDinhCho = 0).';
END
GO

/* ---- 2. Kiểm tra sau khi chạy (CHỈ ĐỌC) ---------------------------------------------------- */
/* a) Dòng chức năng vừa khai. */
SELECT ModuleCode, MaChucNang, TenChucNang, ThuTu, MacDinhCho
FROM ChucNang WHERE ModuleCode = 'MYPAY' ORDER BY ThuTu, MaChucNang;

/* b) 🔴 AI SẼ TỰ GHI ĐƯỢC NGAY SAU KHI DEPLOY — mọi tài khoản gắn nhân viên thuộc bộ phận "May".
      Xem trước danh sách này: đúng người thì thôi, có tên lạ thì sửa bộ phận ở Nhân sự trước. */
SELECT u.UserID, u.Username, nv.NhanVienID, nv.HoTen, ISNULL(bp.TenBoPhan, N'(chưa khai)') AS BoPhan
FROM Users u
JOIN NhanVien nv ON nv.NhanVienID = u.NhanVienID
LEFT JOIN BoPhan bp ON bp.BoPhanID = nv.BoPhanID
WHERE LTRIM(RTRIM(ISNULL(bp.TenBoPhan, N''))) = N'May'
ORDER BY nv.HoTen;

/* c) Tên bộ phận đang có — nếu bộ phận may của xưởng KHÔNG đặt đúng chữ "May" (vd "Tổ may",
      "May 1") thì KHÔNG ai tự ghi được. Trường hợp đó báo lại để đổi luật so khớp, đừng tự sửa
      tên bộ phận trong CSDL (tên bộ phận còn dùng ở lọc nhân viên Cắt/May nhiều màn khác). */
SELECT BoPhanID, TenBoPhan, (SELECT COUNT(*) FROM NhanVien n WHERE n.BoPhanID = b.BoPhanID) AS SoNhanVien
FROM BoPhan b ORDER BY TenBoPhan;
GO
