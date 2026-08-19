-- ================================================================
-- migration_v655.sql  (v5.60) — CÀI ĐẶT CHẤM CÔNG (giờ vào/ra, 1 công, tăng ca)
--   + lưu SỐ GIỜ LÀM THỰC của từng ngày để đối chiếu khi công < 1.
--
-- Cấu hình lưu ở bảng key-value CauHinh (khoá 'CHAM_CONG', giá trị JSON) — cùng cách với
-- cấu hình máy in tem (khoá 'MAY_IN_TEM', xem migration_v644).
-- An toàn chạy lại nhiều lần. >>> NHỚ CHỌN ĐÚNG DATABASE QLNoiBo <<<
-- ================================================================

PRINT N'--- migration_v655: database hien tai = ' + DB_NAME() + N' ---';
GO

IF OBJECT_ID(N'DonHangSanXuat', N'U') IS NULL
BEGIN
    PRINT N'*** DUNG LAI: khong thay bang DonHangSanXuat => SAI DATABASE (thuong la [master]).';
    SET NOEXEC ON;
END
GO

-- 1) Bang cau hinh key-value (co the chua ton tai neu chua chay migration_v644)
IF OBJECT_ID(N'CauHinh', N'U') IS NULL
BEGIN
    CREATE TABLE CauHinh (
        Khoa      NVARCHAR(80)  NOT NULL PRIMARY KEY,
        GiaTri    NVARCHAR(MAX) NULL,
        UpdatedAt DATETIME2     NULL
    );
    PRINT N'OK: da tao bang CauHinh.';
END
ELSE PRINT N'DA CO: bang CauHinh.';
GO

-- 2) ChamCongNgay: luu so gio lam thuc (de biet vi sao cong = 0.5, 0.75...)
IF OBJECT_ID(N'ChamCongNgay', N'U') IS NULL
    PRINT N'BO QUA: chua co bang ChamCongNgay (can migration_v610).';
ELSE
BEGIN
    IF COL_LENGTH(N'ChamCongNgay', N'SoGioLam') IS NULL
    BEGIN
        ALTER TABLE ChamCongNgay ADD SoGioLam DECIMAL(5,2) NULL;
        PRINT N'OK: them cot SoGioLam vao ChamCongNgay.';
    END
    ELSE PRINT N'DA CO: ChamCongNgay.SoGioLam.';
END
GO

-- 3) Cai dat MAC DINH (chi chen neu chua co - KHONG ghi de cau hinh dang dung)
IF NOT EXISTS (SELECT 1 FROM CauHinh WHERE Khoa = N'CHAM_CONG')
BEGIN
    INSERT INTO CauHinh (Khoa, GiaTri, UpdatedAt) VALUES (N'CHAM_CONG',
      N'{"gioVao":"08:00","gioRa":"17:00","nghiTruaTu":"12:00","nghiTruaDen":"13:00","soGioMotCong":8,"lamTronCong":0,"toiThieuTinhCongPhut":30,"otBatDauSauPhut":30,"otLamTronGio":0.5,"otToiDaGioNgay":6,"tinhOtTruocGioVao":false,"ngayLe":[]}',
      SYSDATETIME());
    PRINT N'OK: da tao cau hinh cham cong MAC DINH (8:00-17:00, nghi trua 12-13, 8 gio = 1 cong).';
END
ELSE PRINT N'DA CO: cau hinh CHAM_CONG (giu nguyen, khong ghi de).';
GO

SELECT Khoa, GiaTri, UpdatedAt FROM CauHinh WHERE Khoa = N'CHAM_CONG';
GO

SET NOEXEC OFF;
PRINT N'--- migration_v655: ket thuc. Sau do: pm2 restart qlnoibo + Ctrl+F5 ---';
GO
