/* ================================================================================================
   migration_v909.sql — v10.01: CHỨC NĂNG "NGÀY NGHỈ THEO NĂM" TRONG PHÂN HỆ TÍNH LƯƠNG
   ------------------------------------------------------------------------------------------------
   Nguyen 23/11/2026: *"Thêm chức năng xem ngày nghỉ phép của nhân viên trong 1 năm. Tổng cộng bao
   nhiêu ngày đã nghỉ."*

   Thêm MỘT dòng danh mục chức năng: PAYROLL/nghiphepnam — tab "Ngày nghỉ theo năm".
   MacDinhCho = 1 (TICK SẴN) như mọi tab nghiệp vụ bình thường của phân hệ Tính lương
   (so sánh: PAYROLL/nghiphep khai ở migration_v892 cũng không phải quyền opt-in).
   Ai vào được vẫn phải có quyền XEM phân hệ PAYROLL — chức năng chỉ ẩn/hiện TAB bên trong.

   KHÔNG tạo bảng/cột mới, KHÔNG đụng một dòng dữ liệu nào: màn hình chỉ ĐỌC và GỘP lại
   `ChamCongNgay` (mã P / KL / TS / TN) theo đúng cách bảng lương đếm.
   Chạy TRƯỚC khi pm2 restart. Chạy lại nhiều lần vô hại (MERGE theo ModuleCode + MaChucNang).
   ================================================================================================ */

SET NOCOUNT ON;
GO

IF COL_LENGTH('ChucNang', 'MacDinhCho') IS NULL
BEGIN
  MERGE ChucNang AS t
  USING (VALUES ('PAYROLL', 'nghiphepnam', N'Ngày nghỉ theo năm', 4)) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu)
    ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
  WHEN MATCHED THEN UPDATE SET t.TenChucNang = s.TenChucNang, t.ThuTu = s.ThuTu
  WHEN NOT MATCHED THEN INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu)
    VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu);
  PRINT N'v909: da khai PAYROLL/nghiphepnam (ban cai chua co cot MacDinhCho - mac dinh van la CHO XEM).';
END
ELSE
BEGIN
  MERGE ChucNang AS t
  USING (VALUES ('PAYROLL', 'nghiphepnam', N'Ngày nghỉ theo năm', 4, 1)) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu, MacDinhCho)
    ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
  WHEN MATCHED THEN UPDATE SET t.TenChucNang = s.TenChucNang, t.ThuTu = s.ThuTu, t.MacDinhCho = s.MacDinhCho
  WHEN NOT MATCHED THEN INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu, MacDinhCho)
    VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu, s.MacDinhCho);
  PRINT N'v909: da khai chuc nang PAYROLL/nghiphepnam (MacDinhCho = 1 - tick san).';
END
GO

/* ---- Kiểm tra sau khi chạy (CHỈ ĐỌC) ------------------------------------------------------- */
/* a) Danh mục chức năng của phân hệ Tính lương — phải thấy dòng nghiphepnam. */
SELECT ModuleCode, MaChucNang, TenChucNang, ThuTu, MacDinhCho
FROM ChucNang WHERE ModuleCode = 'PAYROLL' ORDER BY ThuTu, MaChucNang;

/* b) ĐỐI CHIẾU SỐ: tổng ngày nghỉ năm nay theo CÙNG công thức mà màn hình dùng
      (SoCong > 0 thì lấy SoCong — giấy nửa ngày = 0,5 — không thì trọn 1 ngày).
      Chạy câu này và so với con số trên màn hình: phải bằng nhau. */
DECLARE @nam INT = YEAR(GETDATE());
SELECT UPPER(LTRIM(RTRIM(cc.MaCham))) AS Ma,
       SUM(CASE WHEN ISNULL(cc.SoCong, 0) > 0 THEN cc.SoCong ELSE 1 END) AS SoNgay,
       COUNT(*) AS SoDongChamCong
FROM ChamCongNgay cc
WHERE YEAR(cc.Ngay) = @nam
  AND UPPER(LTRIM(RTRIM(ISNULL(cc.MaCham, N'')))) IN (N'P', N'KL', N'TS', N'TN')
GROUP BY UPPER(LTRIM(RTRIM(cc.MaCham)))
ORDER BY Ma;

/* c) Phần KHÔNG lên bảng (người đã nghỉ việc) — bảng chỉ liệt kê nhân viên đang làm; màn hình có
      băng cảnh báo khi con số này khác 0, nhưng xem trước ở đây cho chắc. */
SELECT nv.MaNhanVien, nv.HoTen, nv.TrangThaiLaoDong,
       SUM(CASE WHEN ISNULL(cc.SoCong, 0) > 0 THEN cc.SoCong ELSE 1 END) AS SoNgayNghi
FROM ChamCongNgay cc
JOIN NhanVien nv ON nv.NhanVienID = cc.NhanVienID
WHERE YEAR(cc.Ngay) = @nam
  AND UPPER(LTRIM(RTRIM(ISNULL(cc.MaCham, N'')))) IN (N'P', N'KL', N'TS', N'TN')
  AND ISNULL(nv.TrangThaiLaoDong, N'') = N'Đã nghỉ việc'
GROUP BY nv.MaNhanVien, nv.HoTen, nv.TrangThaiLaoDong
ORDER BY nv.HoTen;
GO
