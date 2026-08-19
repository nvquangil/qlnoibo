/* ================================================================
   MIGRATION v6.25.4 — 1 DONG PHIEU BAN HANG CO THE GOM NHIEU DON KHACH DAT
   ----------------------------------------------------------------
   Khi lay tu danh sach don dat: cung 1 KHACH, cung MA HANG + MAU nhung khach dat lam NHIEU LAN
   -> nay GOP thanh 1 DONG tren phieu (cong so luong), thay vi moi don 1 dong.
   Cot DonID cu (1 don/dong) VAN GIU de tuong thich nguoc; them DonIDs luu danh sach id cua ca nhom
   ("12,15,18") de khi HUY/XOA phieu he thong tra DUNG TAT CA cac don ve 'Cho xu ly'.

   Chay 1 lan. IDEMPOTENT. YEU CAU: migration_v668.sql.
   ================================================================ */
USE QLNoiBo;
GO
IF DB_NAME() <> 'QLNoiBo'
BEGIN
    RAISERROR('KHONG ket noi duoc database QLNoiBo - dung migration.', 16, 1);
    SET NOEXEC ON;
END
GO

IF COL_LENGTH('dbo.PhieuBanHangChiTiet', 'DonIDs') IS NULL
BEGIN
    ALTER TABLE dbo.PhieuBanHangChiTiet ADD DonIDs NVARCHAR(200) NULL;
    PRINT 'Da them cot PhieuBanHangChiTiet.DonIDs.';
END ELSE PRINT 'Cot DonIDs da ton tai, bo qua.';
GO

/* Du lieu cu: dong nao dang gan 1 don thi DonIDs = chinh don do (de code moi doc 1 duong duy nhat). */
UPDATE PhieuBanHangChiTiet
SET DonIDs = CAST(DonID AS NVARCHAR(200))
WHERE DonID IS NOT NULL AND DonIDs IS NULL;
GO

PRINT '';
PRINT '=== MIGRATION v671 HOAN TAT ===';
GO
SET NOEXEC OFF;
GO
