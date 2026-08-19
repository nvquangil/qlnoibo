-- ================================================================
-- migration_v651.sql  (v5.56)
-- "Nhiều bản có TÊN cho 1 đơn" — WAVE CUỐI: 4 bảng ĐƠN GIÁ.
--   Thêm cột TenPhieu + BỎ 2 ràng buộc UNIQUE "1 dòng/đơn" đang chặn nhiều bản.
-- (3 bảng tài liệu header + BangKeBanThanhPham đã xử lý ở migration_v650.)
--
-- >>> QUAN TRỌNG: PHẢI CHỌN ĐÚNG DATABASE QLNoiBo TRƯỚC KHI CHẠY <<<
--     Trong SSMS, cửa sổ New Query MẶC ĐỊNH nối vào [master] → chạy sẽ báo
--     "Msg 4902 ... Cannot find the object ... does not exist or you do not have permissions".
--     Cách xử lý: chọn database ở ô dropdown trên thanh công cụ, HOẶC bỏ chú thích dòng USE bên dưới.
--
--     USE [QLNoiBo];   -- <- sửa đúng tên database rồi bỏ 2 dấu gạch đầu dòng
--     GO
--
-- Bản này TỰ KIỂM TRA: sai database hoặc thiếu bảng → in thông báo rõ ràng, KHÔNG đổ lỗi khó hiểu.
-- An toàn chạy lại nhiều lần.
-- ================================================================

PRINT N'--- migration_v651: bat dau. Database hien tai: ' + DB_NAME() + N' ---';
GO

-- 0) Chan sai database: bang goc DonHangSanXuat phai ton tai.
IF OBJECT_ID(N'DonHangSanXuat', N'U') IS NULL
BEGIN
    PRINT N'*** DUNG LAI: KHONG THAY bang DonHangSanXuat trong database [' + DB_NAME() + N'].';
    PRINT N'*** => Ban dang chay SAI DATABASE (thuong la [master]). Hay chon dung database QLNoiBo';
    PRINT N'***    (o dropdown SSMS) hoac them "USE [ten_database]; GO" o dau file, roi chay lai.';
    SET NOEXEC ON;   -- bo qua toan bo phan con lai cua script
END
GO

-- 1) Them cot TenPhieu cho 4 bang don gia (co kiem tra bang ton tai truoc khi ALTER).
IF OBJECT_ID(N'DonHangDonGiaCongDoanMay', N'U') IS NULL
    PRINT N'BO QUA: chua co bang DonHangDonGiaCongDoanMay (can migration_v534b).';
ELSE IF COL_LENGTH(N'DonHangDonGiaCongDoanMay', N'TenPhieu') IS NULL
BEGIN
    ALTER TABLE DonHangDonGiaCongDoanMay ADD TenPhieu NVARCHAR(200) NULL;
    PRINT N'OK: da them TenPhieu vao DonHangDonGiaCongDoanMay.';
END
ELSE PRINT N'DA CO SAN: TenPhieu trong DonHangDonGiaCongDoanMay.';
GO

IF OBJECT_ID(N'DonHangHangMucGiaCong', N'U') IS NULL
    PRINT N'BO QUA: chua co bang DonHangHangMucGiaCong (can migration_v524).';
ELSE IF COL_LENGTH(N'DonHangHangMucGiaCong', N'TenPhieu') IS NULL
BEGIN
    ALTER TABLE DonHangHangMucGiaCong ADD TenPhieu NVARCHAR(200) NULL;
    PRINT N'OK: da them TenPhieu vao DonHangHangMucGiaCong.';
END
ELSE PRINT N'DA CO SAN: TenPhieu trong DonHangHangMucGiaCong.';
GO

IF OBJECT_ID(N'DonHangDonGiaLaDongGoi', N'U') IS NULL
    PRINT N'BO QUA: chua co bang DonHangDonGiaLaDongGoi (can migration_v640).';
ELSE IF COL_LENGTH(N'DonHangDonGiaLaDongGoi', N'TenPhieu') IS NULL
BEGIN
    ALTER TABLE DonHangDonGiaLaDongGoi ADD TenPhieu NVARCHAR(200) NULL;
    PRINT N'OK: da them TenPhieu vao DonHangDonGiaLaDongGoi.';
END
ELSE PRINT N'DA CO SAN: TenPhieu trong DonHangDonGiaLaDongGoi.';
GO

IF OBJECT_ID(N'DonHangDonGiaInThe', N'U') IS NULL
    PRINT N'BO QUA: chua co bang DonHangDonGiaInThe (can migration_v534c).';
ELSE IF COL_LENGTH(N'DonHangDonGiaInThe', N'TenPhieu') IS NULL
BEGIN
    ALTER TABLE DonHangDonGiaInThe ADD TenPhieu NVARCHAR(200) NULL;
    PRINT N'OK: da them TenPhieu vao DonHangDonGiaInThe.';
END
ELSE PRINT N'DA CO SAN: TenPhieu trong DonHangDonGiaInThe.';
GO

-- 2) BO 2 rang buoc UNIQUE "1 dong/don" (dang chan nhieu ban).
--    Chung la KEY CONSTRAINT (khong phai index thuong) nen phai ALTER TABLE ... DROP CONSTRAINT.
--    Upsert theo ban da quet sach theo (DonHangID, ISNULL(TenPhieu,'')) roi chen lai nen khong can UNIQUE nua.
IF OBJECT_ID(N'DonHangHangMucGiaCong', N'U') IS NOT NULL
   AND EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'UQ_DonHangHangMucGiaCong' AND parent_object_id = OBJECT_ID(N'DonHangHangMucGiaCong'))
BEGIN
    ALTER TABLE DonHangHangMucGiaCong DROP CONSTRAINT UQ_DonHangHangMucGiaCong;
    PRINT N'OK: da bo UQ_DonHangHangMucGiaCong.';
END
GO
-- phong truong hop ban cu tao bang unique INDEX (khac constraint) cung ten
IF OBJECT_ID(N'DonHangHangMucGiaCong', N'U') IS NOT NULL
   AND EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_DonHangHangMucGiaCong' AND object_id = OBJECT_ID(N'DonHangHangMucGiaCong') AND is_unique_constraint = 0)
BEGIN
    DROP INDEX UQ_DonHangHangMucGiaCong ON DonHangHangMucGiaCong;
    PRINT N'OK: da bo INDEX UQ_DonHangHangMucGiaCong.';
END
GO

IF OBJECT_ID(N'DonHangDonGiaLaDongGoi', N'U') IS NOT NULL
   AND EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'UQ_DGLaDongGoi' AND parent_object_id = OBJECT_ID(N'DonHangDonGiaLaDongGoi'))
BEGIN
    ALTER TABLE DonHangDonGiaLaDongGoi DROP CONSTRAINT UQ_DGLaDongGoi;
    PRINT N'OK: da bo UQ_DGLaDongGoi.';
END
GO
IF OBJECT_ID(N'DonHangDonGiaLaDongGoi', N'U') IS NOT NULL
   AND EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_DGLaDongGoi' AND object_id = OBJECT_ID(N'DonHangDonGiaLaDongGoi') AND is_unique_constraint = 0)
BEGIN
    DROP INDEX UQ_DGLaDongGoi ON DonHangDonGiaLaDongGoi;
    PRINT N'OK: da bo INDEX UQ_DGLaDongGoi.';
END
GO

-- 3) BAO CAO KET QUA (gui ket qua nay lai neu con van de).
SELECT t.name AS Bang,
       CASE WHEN COL_LENGTH(t.name, 'TenPhieu') IS NULL THEN N'THIEU TenPhieu' ELSE N'OK co TenPhieu' END AS TrangThai
FROM sys.tables t
WHERE t.name IN ('DonHangDonGiaCongDoanMay', 'DonHangHangMucGiaCong', 'DonHangDonGiaLaDongGoi', 'DonHangDonGiaInThe',
                 'TaiLieuKyThuatChung', 'TaiLieuThongSoDo', 'TaiLieuMoTaSanPham', 'BangKeBanThanhPham')
ORDER BY t.name;

-- Neu bang nao KHONG xuat hien o tren = bang do khong ton tai trong database nay.
-- Chay them cau nay va gui ket qua de doi chieu TEN THUC TE:
SELECT SCHEMA_NAME(schema_id) AS Schema_, name AS TenBang FROM sys.tables
WHERE name LIKE '%DonGia%' OR name LIKE '%GiaCong%' ORDER BY name;
GO

SET NOEXEC OFF;
PRINT N'--- migration_v651: ket thuc ---';
GO
