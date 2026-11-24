/* ==================================================================================================
   migration_v900.sql — v9.74: HopDongLaoDong.ChuyenCanTinhCN BIT NOT NULL DEFAULT 1
   (Nguyen 17/11/2026: "bo phan van phong nghi chu nhat, thang co 4 hay 5 chu nhat thi lam the nao;
    chi co khoi san xuat la tinh nghi 2 ngay 1 thang").
   1 (mac dinh — moi hop dong hien co): chuyen can theo SO NGAY NGHI dem MOI ngay cua thang, ca chu nhat (luat v9.72).
   0 (van phong nghi CN): CN khong phai ngay phai di lam — khong tinh la nghi, CN di lam cung khong bu.
   Khai o form hop dong (o tich trong khung bac chuyen can). Khong doi du lieu khac.
   🔴 Gac IF — chay lai an toan. Sau khi chay: pm2 restart qlnoibo.
   ================================================================================================== */
PRINT '=== migration_v900: HopDongLaoDong.ChuyenCanTinhCN (v9.74) ===';
GO
IF COL_LENGTH('HopDongLaoDong', 'ChuyenCanTinhCN') IS NULL
BEGIN
    ALTER TABLE HopDongLaoDong ADD ChuyenCanTinhCN BIT NOT NULL CONSTRAINT DF_HopDongLaoDong_ChuyenCanTinhCN DEFAULT 1;
    PRINT '  + HopDongLaoDong.ChuyenCanTinhCN (mac dinh 1 = tinh ca chu nhat)';
END ELSE PRINT '  = HopDongLaoDong.ChuyenCanTinhCN da co';
GO
PRINT '=== migration_v900 xong. pm2 restart qlnoibo ===';
GO
