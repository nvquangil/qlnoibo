-- ================================================================
-- migration_v652.sql  (v5.56c) — TỰ CHỮA các cột còn THIẾU khiến mở form bị lỗi
--
-- Vì sao cần: form "Bảng kê BTP" khi mở có đọc thêm cột size từ Thông số đo bằng câu
--   ... FROM TaiLieuThongSoDoDong d JOIN TaiLieuThongSoDo t ... WHERE ISNULL(t.LaMau,0)=0
-- Nếu database CHƯA có cột LaMau (do chưa chạy migration_v534e) thì câu này lỗi
-- "Invalid column name 'LaMau'" -> route async ném lỗi -> (Express 4 + Node >=15) SẬP TIẾN TRÌNH
-- -> request không có phản hồi -> giao diện "bấm nút không có gì xảy ra" (không hề báo lỗi).
-- Đúng triệu chứng: DANH SÁCH BẢN mở được (không dùng LaMau), MỞ FORM thì chết.
--
-- Script này bổ sung mọi cột còn thiếu cho các bảng tài liệu + BTP. An toàn chạy lại nhiều lần.
-- >>> NHỚ CHỌN ĐÚNG DATABASE QLNoiBo (SSMS mở New Query mặc định vào [master]) <<<
-- ================================================================

PRINT N'--- migration_v652: database hien tai = ' + DB_NAME() + N' ---';
GO

IF OBJECT_ID(N'DonHangSanXuat', N'U') IS NULL
BEGIN
    PRINT N'*** DUNG LAI: khong thay bang DonHangSanXuat => SAI DATABASE (thuong la [master]).';
    PRINT N'*** Hay chon dung database QLNoiBo o dropdown SSMS roi chay lai.';
    SET NOEXEC ON;
END
GO

-- 1) TaiLieuThongSoDo: LaMau / TenMau (migration_v534e) — NGUYÊN NHÂN NGHI VẤN SỐ 1 của lỗi BTP.
IF OBJECT_ID(N'TaiLieuThongSoDo', N'U') IS NULL
    PRINT N'BO QUA: chua co bang TaiLieuThongSoDo.';
ELSE
BEGIN
    IF COL_LENGTH(N'TaiLieuThongSoDo', N'LaMau') IS NULL
    BEGIN
        ALTER TABLE TaiLieuThongSoDo ADD LaMau BIT NOT NULL CONSTRAINT DF_TLTSD_LaMau DEFAULT 0;
        PRINT N'*** DA VA: them cot LaMau vao TaiLieuThongSoDo (day rat co the la nguyen nhan loi Bang ke BTP).';
    END
    ELSE PRINT N'OK: TaiLieuThongSoDo.LaMau da co.';

    IF COL_LENGTH(N'TaiLieuThongSoDo', N'TenMau') IS NULL
    BEGIN
        ALTER TABLE TaiLieuThongSoDo ADD TenMau NVARCHAR(255) NULL;
        PRINT N'OK: them cot TenMau vao TaiLieuThongSoDo.';
    END
    ELSE PRINT N'OK: TaiLieuThongSoDo.TenMau da co.';
END
GO

-- Cho phep DonHangID NULL (ban ghi MAU khong gan don hang) — migration_v534e.
IF OBJECT_ID(N'TaiLieuThongSoDo', N'U') IS NOT NULL
   AND EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'TaiLieuThongSoDo') AND name = 'DonHangID' AND is_nullable = 0)
BEGIN
    BEGIN TRY
        ALTER TABLE TaiLieuThongSoDo ALTER COLUMN DonHangID INT NULL;
        PRINT N'OK: TaiLieuThongSoDo.DonHangID cho phep NULL (de luu tai lieu MAU).';
    END TRY
    BEGIN CATCH
        PRINT N'CANH BAO: khong doi duoc DonHangID sang NULL (co the dang bi rang buoc): ' + ERROR_MESSAGE();
    END CATCH
END
GO

-- 2) TaiLieuMoTaSanPham: LaMau / TenMau / Loai (migration_v534c, v534e).
IF OBJECT_ID(N'TaiLieuMoTaSanPham', N'U') IS NULL
    PRINT N'BO QUA: chua co bang TaiLieuMoTaSanPham.';
ELSE
BEGIN
    IF COL_LENGTH(N'TaiLieuMoTaSanPham', N'Loai') IS NULL
    BEGIN
        ALTER TABLE TaiLieuMoTaSanPham ADD Loai NVARCHAR(30) NOT NULL CONSTRAINT DF_TLMoTa_Loai DEFAULT N'motasp';
        PRINT N'OK: them cot Loai vao TaiLieuMoTaSanPham.';
    END
    IF COL_LENGTH(N'TaiLieuMoTaSanPham', N'LaMau') IS NULL
    BEGIN
        ALTER TABLE TaiLieuMoTaSanPham ADD LaMau BIT NOT NULL CONSTRAINT DF_TLMoTa_LaMau DEFAULT 0;
        PRINT N'OK: them cot LaMau vao TaiLieuMoTaSanPham.';
    END
    IF COL_LENGTH(N'TaiLieuMoTaSanPham', N'TenMau') IS NULL
    BEGIN
        ALTER TABLE TaiLieuMoTaSanPham ADD TenMau NVARCHAR(255) NULL;
        PRINT N'OK: them cot TenMau vao TaiLieuMoTaSanPham.';
    END
    IF COL_LENGTH(N'TaiLieuMoTaSanPham', N'ChuY') IS NULL
    BEGIN
        ALTER TABLE TaiLieuMoTaSanPham ADD ChuY NVARCHAR(MAX) NULL;
        PRINT N'OK: them cot ChuY vao TaiLieuMoTaSanPham.';
    END
END
GO

-- 3) TaiLieuKyThuatChung: LaMau / TenMau.
IF OBJECT_ID(N'TaiLieuKyThuatChung', N'U') IS NOT NULL
BEGIN
    IF COL_LENGTH(N'TaiLieuKyThuatChung', N'LaMau') IS NULL
    BEGIN
        ALTER TABLE TaiLieuKyThuatChung ADD LaMau BIT NOT NULL CONSTRAINT DF_TLKTC_LaMau DEFAULT 0;
        PRINT N'OK: them cot LaMau vao TaiLieuKyThuatChung.';
    END
    IF COL_LENGTH(N'TaiLieuKyThuatChung', N'TenMau') IS NULL
    BEGIN
        ALTER TABLE TaiLieuKyThuatChung ADD TenMau NVARCHAR(255) NULL;
        PRINT N'OK: them cot TenMau vao TaiLieuKyThuatChung.';
    END
END
GO

-- 4) BangKeBanThanhPham: LaMau / TenMau / GhiChu / TenPhieu (v534, v650).
IF OBJECT_ID(N'BangKeBanThanhPham', N'U') IS NOT NULL
BEGIN
    IF COL_LENGTH(N'BangKeBanThanhPham', N'LaMau') IS NULL
    BEGIN
        ALTER TABLE BangKeBanThanhPham ADD LaMau BIT NOT NULL CONSTRAINT DF_BKBTP_LaMau DEFAULT 0;
        PRINT N'OK: them cot LaMau vao BangKeBanThanhPham.';
    END
    IF COL_LENGTH(N'BangKeBanThanhPham', N'TenMau') IS NULL
    BEGIN
        ALTER TABLE BangKeBanThanhPham ADD TenMau NVARCHAR(255) NULL;
        PRINT N'OK: them cot TenMau vao BangKeBanThanhPham.';
    END
    IF COL_LENGTH(N'BangKeBanThanhPham', N'TenPhieu') IS NULL
    BEGIN
        ALTER TABLE BangKeBanThanhPham ADD TenPhieu NVARCHAR(200) NULL;
        PRINT N'OK: them cot TenPhieu vao BangKeBanThanhPham.';
    END
END
GO

-- 5) BAO CAO: gui ket qua bang nay lai neu con loi.
SELECT t.name AS Bang,
       CASE WHEN COL_LENGTH(t.name, 'LaMau')    IS NULL THEN N'THIEU' ELSE N'OK' END AS LaMau,
       CASE WHEN COL_LENGTH(t.name, 'TenMau')   IS NULL THEN N'THIEU' ELSE N'OK' END AS TenMau,
       CASE WHEN COL_LENGTH(t.name, 'TenPhieu') IS NULL THEN N'THIEU' ELSE N'OK' END AS TenPhieu
FROM sys.tables t
WHERE t.name IN ('TaiLieuKyThuatChung', 'TaiLieuThongSoDo', 'TaiLieuMoTaSanPham', 'BangKeBanThanhPham')
ORDER BY t.name;
GO

SET NOEXEC OFF;
PRINT N'--- migration_v652: ket thuc. Sau do: pm2 restart qlnoibo + Ctrl+F5 ---';
GO
