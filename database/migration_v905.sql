/* ==================================================================================================
   migration_v905.sql — v9.81: GHI SAN LUONG "LAM LAI MA CU" (khong co lenh SX) — Nguyen 19/11/2026
   --------------------------------------------------------------------------------------------------
   Nguyen 19/11: "Ghi san luong theo lenh, truong lenh SX them dau tich LAM LAI MA CU — nhap ma hang."
   => Co viec lam lai mot ma hang cu, KHONG co lenh san xuat moi nao de chon. Dong san luong van phai
      ghi duoc (de tinh thuong theo san pham), nen:
        1. SanLuongTheoLenh.DonHangID: NOT NULL -> NULL (dong "lam lai" khong gan lenh nao).
        2. Them cot MaHangCu NVARCHAR(100) NULL — go tay ma hang cu.
        3. CHECK: moi dong phai co DonHangID HOAC MaHangCu (khong duoc trong ca hai).

   🔴 DOI COT SANG NULL: khoa ngoai FK_... (DonHangID -> DonHangSanXuat) va index IX_SanLuongTheoLenh_DH
      VAN GIU NGUYEN — ALTER COLUMN chi doi tinh NULL, khong doi kieu, SQL Server cho phep. Du lieu cu
      KHONG doi (moi dong dang co deu co DonHangID).
   🔴 Moi lenh gac IF — chay lai nhieu lan an toan. Sau khi chay: pm2 restart qlnoibo.
   Can migration_v895 (bang SanLuongTheoLenh) chay truoc.
   ================================================================================================== */
PRINT '=== migration_v905: san luong "lam lai ma cu" (v9.81) ===';
GO

IF OBJECT_ID('SanLuongTheoLenh') IS NULL
BEGIN
    PRINT '  !! CHUA CO bang SanLuongTheoLenh — chay migration_v895.sql TRUOC roi chay lai file nay.';
END
GO

/* ---------- 1. DonHangID cho phep NULL ---------- */
IF OBJECT_ID('SanLuongTheoLenh') IS NOT NULL
   AND EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('SanLuongTheoLenh')
               AND name = 'DonHangID' AND is_nullable = 0)
BEGIN
    ALTER TABLE SanLuongTheoLenh ALTER COLUMN DonHangID INT NULL;
    PRINT '  + SanLuongTheoLenh.DonHangID -> NULL duoc';
END ELSE PRINT '  = SanLuongTheoLenh.DonHangID da cho NULL (hoac chua co bang)';
GO

/* ---------- 2. MaHangCu ---------- */
IF OBJECT_ID('SanLuongTheoLenh') IS NOT NULL AND COL_LENGTH('SanLuongTheoLenh', 'MaHangCu') IS NULL
BEGIN
    ALTER TABLE SanLuongTheoLenh ADD MaHangCu NVARCHAR(100) NULL;
    PRINT '  + SanLuongTheoLenh.MaHangCu';
END ELSE PRINT '  = SanLuongTheoLenh.MaHangCu da co';
GO

/* ---------- 3. Rang buoc: phai co lenh HOAC ma hang cu ----------
   Dat SAU khi them cot (batch rieng sau GO) — cung bai hoc migration_v890: them cot roi moi CHECK. */
IF OBJECT_ID('SanLuongTheoLenh') IS NOT NULL AND COL_LENGTH('SanLuongTheoLenh', 'MaHangCu') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_SanLuongTheoLenh_LenhHoacMaCu')
BEGIN
    ALTER TABLE SanLuongTheoLenh WITH CHECK ADD CONSTRAINT CK_SanLuongTheoLenh_LenhHoacMaCu
        CHECK (DonHangID IS NOT NULL OR MaHangCu IS NOT NULL);
    PRINT '  + CK_SanLuongTheoLenh_LenhHoacMaCu';
END ELSE PRINT '  = CK_SanLuongTheoLenh_LenhHoacMaCu da co (hoac thieu cot)';
GO

PRINT '=== migration_v905 xong. Nho: pm2 restart qlnoibo ===';
GO
