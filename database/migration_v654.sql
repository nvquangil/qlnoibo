-- ================================================================
-- migration_v654.sql  (v5.59) — KẾT NỐI MÁY CHẤM CÔNG HIKVISION (DS-K1T342MFWX)
--
-- Máy Hikvision KHÔNG dùng giao thức ZKTeco (cổng 4370) mà dùng ISAPI qua HTTP,
-- xác thực Digest bằng TÀI KHOẢN/MẬT KHẨU của máy (mặc định user 'admin').
-- => Bảng MayChamCong cần thêm: TenDangNhap, MatKhau, DungHTTPS.
--
-- An toàn chạy lại nhiều lần. >>> NHỚ CHỌN ĐÚNG DATABASE QLNoiBo <<<
-- ================================================================

PRINT N'--- migration_v654: database hien tai = ' + DB_NAME() + N' ---';
GO

IF OBJECT_ID(N'DonHangSanXuat', N'U') IS NULL
BEGIN
    PRINT N'*** DUNG LAI: khong thay bang DonHangSanXuat => SAI DATABASE (thuong la [master]).';
    SET NOEXEC ON;
END
GO

IF OBJECT_ID(N'MayChamCong', N'U') IS NULL
    PRINT N'BO QUA: chua co bang MayChamCong (can migration_v610).';
ELSE
BEGIN
    IF COL_LENGTH(N'MayChamCong', N'TenDangNhap') IS NULL
    BEGIN
        ALTER TABLE MayChamCong ADD TenDangNhap NVARCHAR(100) NULL;
        PRINT N'OK: them cot TenDangNhap vao MayChamCong.';
    END
    ELSE PRINT N'DA CO: MayChamCong.TenDangNhap.';

    IF COL_LENGTH(N'MayChamCong', N'MatKhau') IS NULL
    BEGIN
        ALTER TABLE MayChamCong ADD MatKhau NVARCHAR(200) NULL;
        PRINT N'OK: them cot MatKhau vao MayChamCong.';
    END
    ELSE PRINT N'DA CO: MayChamCong.MatKhau.';

    IF COL_LENGTH(N'MayChamCong', N'DungHTTPS') IS NULL
    BEGIN
        ALTER TABLE MayChamCong ADD DungHTTPS BIT NOT NULL CONSTRAINT DF_MayChamCong_HTTPS DEFAULT 0;
        PRINT N'OK: them cot DungHTTPS vao MayChamCong (mac dinh 0 = dung HTTP).';
    END
    ELSE PRINT N'DA CO: MayChamCong.DungHTTPS.';
END
GO

-- Báo cáo
SELECT MayChamCongID, TenMay, DiaChiIP, Port, LoaiGiaoThuc,
       CASE WHEN TenDangNhap IS NULL OR TenDangNhap = N'' THEN N'(chua dat)' ELSE TenDangNhap END AS TenDangNhap,
       CASE WHEN MatKhau IS NULL OR MatKhau = N'' THEN N'(chua dat)' ELSE N'***' END AS MatKhau,
       DungHTTPS
FROM MayChamCong ORDER BY MayChamCongID;
GO

SET NOEXEC OFF;
PRINT N'--- migration_v654: ket thuc. Sau do: pm2 restart qlnoibo + Ctrl+F5 ---';
PRINT N'Luu y: may Hikvision -> chon Giao thuc = Hikvision, Port = 80, nhap tai khoan/mat khau cua may.';
GO
