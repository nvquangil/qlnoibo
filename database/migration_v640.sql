/* ================================================================
   MIGRATION v6.4 (Payroll Phase 4b) — LƯƠNG LÀ (LA) + ĐÓNG GÓI (DG)
   ----------------------------------------------------------------
   - DonHangDonGiaLaDongGoi: đơn giá là / đóng gói theo đơn (Loai 'LA'/'DG') — khai ở "Tài liệu may/Đóng gói".
   - PhanCongLaDongGoi: giao việc LA/DG theo MÀU (NhanVien + SL / màu). Bảng RIÊNG (không dùng PhanCongMay)
     để KHÔNG lẫn vào lương khoán may (loadLuongKhoanMay không lọc stage). Stage suy từ TienDoSanXuat.StageID.
   - ChucNang PAYROLL 'luongladonggoi'.
   Chạy 1 lần. IDEMPOTENT.
   ================================================================ */
USE QLNoiBo;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'DonHangDonGiaLaDongGoi')
BEGIN
    CREATE TABLE DonHangDonGiaLaDongGoi (
        ID        INT IDENTITY(1,1) PRIMARY KEY,
        DonHangID INT NOT NULL FOREIGN KEY REFERENCES DonHangSanXuat(DonHangID) ON DELETE CASCADE,
        Loai      NVARCHAR(2) NOT NULL,   -- 'LA' (là/ủi) / 'DG' (đóng gói)
        DonGia    DECIMAL(14,2) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT UQ_DGLaDongGoi UNIQUE (DonHangID, Loai)
    );
    PRINT 'Da tao DonHangDonGiaLaDongGoi.';
END ELSE PRINT 'DonHangDonGiaLaDongGoi da ton tai, bo qua.';
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'PhanCongLaDongGoi')
BEGIN
    CREATE TABLE PhanCongLaDongGoi (
        ID         INT IDENTITY(1,1) PRIMARY KEY,
        TienDoID   INT NOT NULL FOREIGN KEY REFERENCES TienDoSanXuat(TienDoID) ON DELETE CASCADE,
        NhanVienID INT NOT NULL FOREIGN KEY REFERENCES NhanVien(NhanVienID),
        MauSacID   INT NULL FOREIGN KEY REFERENCES MauSac(MauSacID),
        SoLuong    INT NOT NULL DEFAULT 0
    );
    CREATE INDEX IX_PCLaDongGoi_TienDo ON PhanCongLaDongGoi(TienDoID);
    PRINT 'Da tao PhanCongLaDongGoi.';
END ELSE PRINT 'PhanCongLaDongGoi da ton tai, bo qua.';
GO

MERGE ChucNang AS t
USING (VALUES ('PAYROLL','luongladonggoi', N'Lương là / đóng gói', 6)) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu)
ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
WHEN NOT MATCHED THEN INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu) VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu);
GO

PRINT '=== migration_v640.sql (Luong la/dong goi) hoan tat ===';
GO
