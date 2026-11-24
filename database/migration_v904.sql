/* ==================================================================================================
   migration_v904.sql — v9.78: XANG XE THEO SO KM (Nguyen 19/11/2026)
   "Sua lai phan xang xe. Quy dinh bao nhieu / 1 km tinh tu nha den cong ty. Don gia chung cua cong ty la bao nhieu 1 km,
    con so km thi moi nguoi khac nhau nen so tien ho tro khac nhau x ngay cong thuc te di lam.
    Them trong cai dat luong tien xang ho tro / 1 km dung chung ca cong ty. So km nhap theo tung nguoi."

     1. CauHinhLuong.XangXeDonGiaKm DECIMAL(14,2) — don gia CHUNG ca cong ty (dong / 1 km).
     2. HopDongLaoDong.SoKmDiLam DECIMAL(6,2)     — so km cua TUNG NGUOI (nha -> cong ty).

   CONG THUC MOI (utils/luongCongNhat.js):
       xang = SoKmDiLam x XangXeDonGiaKm x so ngay cong di lam thuc te
   🔴 CHI ap dung khi CA HAI > 0. Nguoi chua khai km ⇒ GIU luat v9.72 (PhuCapXangXe la dong/NGAY x cong).
      Nho vay khong phai sua het 47 hop dong cung luc, va sua_phu_cap_xang_xe_theo_ngay_v972.sql chi con can
      cho nhung nguoi KHONG khai km.
   🔴 Gac IF — chay lai an toan. Sau khi chay: pm2 restart qlnoibo.
   ================================================================================================== */
PRINT '=== migration_v904: xang xe theo so km (v9.78) ===';
GO

/* ---------- 1. Don gia chung: dong / 1 km ---------- */
IF COL_LENGTH('CauHinhLuong', 'XangXeDonGiaKm') IS NULL
BEGIN
    ALTER TABLE CauHinhLuong ADD XangXeDonGiaKm DECIMAL(14,2) NULL;
    PRINT '  + CauHinhLuong.XangXeDonGiaKm';
END ELSE PRINT '  = CauHinhLuong.XangXeDonGiaKm da co';
GO

/* ---------- 2. So km cua tung nguoi (tren hop dong) ---------- */
IF COL_LENGTH('HopDongLaoDong', 'SoKmDiLam') IS NULL
BEGIN
    ALTER TABLE HopDongLaoDong ADD SoKmDiLam DECIMAL(6,2) NULL;
    PRINT '  + HopDongLaoDong.SoKmDiLam';
END ELSE PRINT '  = HopDongLaoDong.SoKmDiLam da co';
GO

PRINT '=== migration_v904 xong. pm2 restart qlnoibo ===';
GO
