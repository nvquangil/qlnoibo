/* ==================================================================================================
   ⛔⛔⛔ KHONG CAN CHAY — HET HIEU LUC NGAY TRONG NGAY 19/11/2026 (v9.85). ⛔⛔⛔
   Nguyen chot: "Giu nguyen he so quy doi va bo cho vua them so size cai/1 ri. Phan dong goi va kho
   nhap lay tu he so quy doi." => KHONG them cot moi; o "He so quy doi" san co o Ra lenh SX CHINH LA
   so cai trong 1 ri, Dong goi / Kho nhap doc thang `DonHangSanXuat.HeSoQuyDoi` (xem caiMotRi()).
   File giu lai lam ho so. Chay cung khong hong gi (chi them mot cot khong ai doc), nhung KHONG CAN.
   ==================================================================================================

   ------ (noi dung cu, de doi chieu) --------------------------------------------------------------
   migration_v906.sql — v9.82: SO SIZE (SO CAI TRONG 1 RI) TREN LENH SAN XUAT — Nguyen 19/11/2026
   --------------------------------------------------------------------------------------------------
   Nguyen 19/11: "1 lenh co 1 mau trai nhieu ban cat he so khac nhau... Lay he so cua ban cat chia
   theo so size. Vi du 3-7 co 5 size lay 10/5 de tinh so ri: 10/5 = 2 x 5 lop = 10 ri."

   🔴 HAI CON SO KHAC NHAU, truoc nay bi gop lam MOT (goc cua loi):
        CAI / LOP = he so cua TUNG BAN CAT   -> TienDoCatChiTietCay.HeSoQuyDoi (da co tu v6.08)
        CAI / RI  = so size cua dai          -> DonHangDaiSize.HeSo (da co tu v859) khi CO tach dai
     Lenh KHONG tach dai thi truoc day khong co cho nao ghi "1 ri may cai" -> cot nay sinh ra cho viec do.

   CO Y KHONG dung lai DonHangSanXuat.HeSoQuyDoi: cot do la he so cua DON VI QUY DOI (DonViQuyDoiID),
   mac dinh 1 va "it ai khai" (ghi chu v8.92 trong routes/qlsx.js). Muon o Ri go duoc thi phai khai
   so size that; de NULL thi man Ghi tien do KHOA o Ri, bat go thang so CAI — khong doan, khong ra 1.

   AN TOAN: cot NULL, khong DEFAULT, khong backfill. Lenh cu giu nguyen hanh vi (o Ri khoa cho toi khi khai).
   🔴 Moi lenh gac IF — chay lai nhieu lan an toan. Sau khi chay: pm2 restart qlnoibo.
   ================================================================================================== */
PRINT '=== migration_v906: so size (cai / 1 ri) tren lenh SX (v9.82) ===';
GO

IF COL_LENGTH('DonHangSanXuat', 'SoSizeRi') IS NULL
BEGIN
    ALTER TABLE DonHangSanXuat ADD SoSizeRi INT NULL;
    PRINT '  + DonHangSanXuat.SoSizeRi';
END ELSE PRINT '  = DonHangSanXuat.SoSizeRi da co';
GO

/* Chan so vo nghia (0 hoac am) ngay o CSDL — "1 ri = 0 cai" se lam moi phep quy doi ve 0.
   Dat o batch rieng sau GO (them cot roi moi CHECK — bai hoc migration_v890). */
IF COL_LENGTH('DonHangSanXuat', 'SoSizeRi') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_DonHangSanXuat_SoSizeRi')
BEGIN
    ALTER TABLE DonHangSanXuat WITH CHECK ADD CONSTRAINT CK_DonHangSanXuat_SoSizeRi
        CHECK (SoSizeRi IS NULL OR SoSizeRi > 0);
    PRINT '  + CK_DonHangSanXuat_SoSizeRi (NULL hoac > 0)';
END ELSE PRINT '  = CK_DonHangSanXuat_SoSizeRi da co (hoac thieu cot)';
GO

PRINT '=== migration_v906 xong. Nho: pm2 restart qlnoibo ===';
GO

/* ==================================================================================================
   KIEM TRA SAU KHI CHAY:
   SELECT CASE WHEN COL_LENGTH('DonHangSanXuat','SoSizeRi') IS NULL THEN N'THIEU' ELSE N'OK' END;
   -- Lenh nao dang cat nhieu ban he so khac nhau (chinh la truong hop Nguyen hoi) va CHUA khai so size:
   SELECT d.MaDH, d.TenSanPham, d.SoSizeRi,
          COUNT(DISTINCT cc.HeSoQuyDoi) AS SoHeSoKhacNhau,
          MIN(cc.HeSoQuyDoi) AS HeSoMin, MAX(cc.HeSoQuyDoi) AS HeSoMax
   FROM DonHangSanXuat d
   JOIN TienDoSanXuat t ON t.DonHangID = d.DonHangID AND t.StageID = 'CAT'
   JOIN TienDoCatChiTietCay cc ON cc.TienDoID = t.TienDoID
   WHERE ISNULL(cc.HeSoQuyDoi, 0) > 0
   GROUP BY d.MaDH, d.TenSanPham, d.SoSizeRi
   HAVING COUNT(DISTINCT cc.HeSoQuyDoi) > 1
   ORDER BY d.MaDH DESC;
   ================================================================================================== */
