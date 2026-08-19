/* ================================================================
   MIGRATION v6.15 — TÍNH GIÁ THÀNH SẢN PHẨM THEO LỆNH SẢN XUẤT
   ----------------------------------------------------------------
   Chuc nang moi trong phan he Quan ly san xuat: gom MOI chi phi lien quan den 1 lenh SX de ra gia thanh
   1 san pham. Cac khoan chi phi VON DA CO SAN trong CSDL (khong tao bang moi):
     1. Vai      = SO KG/MET DA DUNG khi cat cua tung cay (TienDoCatChiTietCay.SoKgMetSuDung)
                   x DON GIA CUA CHINH CAY DO (VaiCay.DonGiaNhap)
     2. Phu kien = SL xuat cho don (PhieuPhuKienChiTiet cua phieu Xuat) x don gia LAN NHAP GAN NHAT
                   (phieu Xuat khong co cot don gia - xem migration_v54.sql)
     3. Gia cong ngoai = DonHangChiTietNhaGiaCong.SoLuongNhan x don gia hang muc gia cong
        May nha lam    = PhanCongMay.SoLuong x thanh tien/cai (dung DUNG cong thuc cua bang luong khoan may)
     4. In theu  = DonHangNhaInTheu.SoLuongNhan x don gia hang muc in theu (xem migration_v662.sql)
   Chi THIEU 1 thu: cac khoan CHI PHI CHUNG nhap tay (dien, nuoc, khau hao, van chuyen...) -> bang moi
   ChiPhiChungDonHang duoi day.

   Gia thanh 1 SP = TONG chi phi / SL hoan thanh (SL NHAP KHO thuc te; chua nhap kho thi lay SL cat).

   Chay 1 lan. IDEMPOTENT. YEU CAU: schema.sql, migration_v5_chucnang.sql.
   ================================================================ */
USE QLNoiBo;
GO
IF DB_NAME() <> 'QLNoiBo'
BEGIN
    RAISERROR('KHONG ket noi duoc database QLNoiBo - dung migration.', 16, 1);
    SET NOEXEC ON;
END
GO

/* ---------------- 1. Bang chi phi chung nhap tay theo tung lenh SX ---------------- */
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ChiPhiChungDonHang')
BEGIN
    CREATE TABLE ChiPhiChungDonHang (
        ID          INT IDENTITY(1,1) PRIMARY KEY,
        DonHangID   INT NOT NULL FOREIGN KEY REFERENCES DonHangSanXuat(DonHangID) ON DELETE CASCADE,
        TenChiPhi   NVARCHAR(200) NOT NULL,          -- vd: Dien nuoc, Van chuyen, Khau hao may...
        SoTien      DECIMAL(18,2) NOT NULL DEFAULT 0,
        GhiChu      NVARCHAR(255) NULL,
        ThuTu       INT NULL,
        CreatedAt   DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    CREATE INDEX IX_ChiPhiChungDonHang_Don ON ChiPhiChungDonHang(DonHangID);
    PRINT 'Da tao bang ChiPhiChungDonHang.';
END ELSE PRINT 'Bang ChiPhiChungDonHang da ton tai, bo qua.';
GO

/* ---------------- 2. ChucNang cho tab moi trong QLSX ---------------- */
IF OBJECT_ID('dbo.ChucNang', 'U') IS NULL
    PRINT '!! Chua co bang ChucNang - bo qua phan seed phan quyen.';
ELSE
BEGIN
    MERGE ChucNang AS t
    USING (VALUES ('QLSX', 'giathanh', N'Giá thành sản phẩm', 14)) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu)
      ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
    WHEN NOT MATCHED THEN
      INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu)
      VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu);
    PRINT 'Da seed ChucNang QLSX/giathanh (nho CAP QUYEN trong Ma tran phan quyen).';
END
GO

PRINT '';
PRINT '=== MIGRATION v665 HOAN TAT ===';
GO
SET NOEXEC OFF;
GO
