/* ==================================================================================================
   migration_v898.sql — v9.72: HopDongChuyenCan.SoNgayNghiToiDa — thuong chuyen can theo SO NGAY NGHI trong thang
   (Nguyen 17/11/2026: "di lam du so ngay cua thang thi 500k, nghi 2 ngay tren 1 thang thi 300k; thang 30/31 ngay tinh ca
   chu nhat").
   Dong bac kieu MOI: SoCong = 0 + SoNgayNghiToiDa = N (0 = di du). Dong cu (SoCong > 0, SoNgayNghiToiDa NULL) bo tinh van
   chay luat v9.55 cho toi khi khai lai o form hop dong.
   KHONG doi PhuCapXangXe o day — xem sua_phu_cap_xang_xe_theo_ngay_v972.sql (du lieu, chay rieng, mac dinh ROLLBACK).
   🔴 Gac IF — chay lai an toan. Sau khi chay: pm2 restart qlnoibo.
   ================================================================================================== */
PRINT '=== migration_v898: HopDongChuyenCan.SoNgayNghiToiDa (v9.72) ===';
GO
IF OBJECT_ID('HopDongChuyenCan') IS NOT NULL AND COL_LENGTH('HopDongChuyenCan', 'SoNgayNghiToiDa') IS NULL
BEGIN
    ALTER TABLE HopDongChuyenCan ADD SoNgayNghiToiDa DECIMAL(5,1) NULL;
    PRINT '  + HopDongChuyenCan.SoNgayNghiToiDa';
END ELSE PRINT '  = HopDongChuyenCan.SoNgayNghiToiDa da co (hoac chua co bang — chay migration_v892 truoc)';
GO
PRINT '=== migration_v898 xong. pm2 restart qlnoibo ===';
GO
