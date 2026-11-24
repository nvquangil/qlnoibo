/* ==================================================================================================
   migration_v902.sql — v9.76: DonHangSanXuat.MayMauTenSP NVARCHAR(150) NULL
   (Nguyen 17/11/2026: "Nhan vien may mau (thuong theo SP tu dong) them lua chon theo danh muc san pham trong ky hop dong").
   Ten san pham may mau nguoi lap lenh CHON tu danh muc hop dong cua nguoi may mau (vd "May mẫu áo" 150k / "May mẫu quần"
   200k). NULL = luat cu v9.67 (tu lay dong co chu "mẫu" trong hop dong). Dong SanLuongTheoLenh Nguon='MayMau' ghi dung ten nay.
   🔴 Gac IF — chay lai an toan. Sau khi chay: pm2 restart qlnoibo.
   ================================================================================================== */
PRINT '=== migration_v902: DonHangSanXuat.MayMauTenSP (v9.76) ===';
GO
IF COL_LENGTH('DonHangSanXuat', 'MayMauTenSP') IS NULL
BEGIN
    ALTER TABLE DonHangSanXuat ADD MayMauTenSP NVARCHAR(150) NULL;
    PRINT '  + DonHangSanXuat.MayMauTenSP';
END ELSE PRINT '  = DonHangSanXuat.MayMauTenSP da co';
GO
PRINT '=== migration_v902 xong. pm2 restart qlnoibo ===';
GO
