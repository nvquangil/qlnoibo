/* ================================================================
   migration_v645.sql (v5.47.1)
   Bảng "Chỉ định vải SX" RIÊNG — ĐỘC LẬP với cấu trúc vải của Ra lệnh SX.
   Người dùng CHỌN Loại vải + Màu TỪ DANH MỤC (có ID) + rõ Chính/Phối + KG yêu cầu.
   Dùng làm nguồn KHÓA xuất kho vải (khovai.js GET /orders + /vaichophep khớp LoaiVaiID/MauSacID).
   An toàn chạy lại nhiều lần.
   ================================================================ */
USE QLNoiBo;
GO
IF OBJECT_ID('ChiDinhVaiSX', 'U') IS NULL
BEGIN
    CREATE TABLE ChiDinhVaiSX (
        Id            INT IDENTITY(1,1) PRIMARY KEY,
        DonHangID     INT NOT NULL FOREIGN KEY REFERENCES DonHangSanXuat(DonHangID),
        Kieu          NVARCHAR(10) NOT NULL DEFAULT N'Chính',   -- Chính / Phối
        LoaiVaiID     INT NULL FOREIGN KEY REFERENCES LoaiVai(LoaiVaiID),
        MauSacID      INT NULL FOREIGN KEY REFERENCES MauSac(MauSacID),
        SoKGYeuCau    DECIMAL(10,2) NULL,
        DVTVaiYeuCau  NVARCHAR(30) NULL DEFAULT N'Kg'
    );
    CREATE INDEX IX_ChiDinhVaiSX_DonHang ON ChiDinhVaiSX(DonHangID);
    PRINT N'Da tao bang ChiDinhVaiSX.';
END ELSE PRINT N'Bang ChiDinhVaiSX da ton tai, bo qua.';
GO
