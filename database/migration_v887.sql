/* ==================================================================================================
   migration_v887.sql  (v9.35)  —  NOI DUNG CONG VIEC CUA HOP DONG LAO DONG

   Nguyen 2026-11-09: "ky hop dong them truong noi dung cong viec de nhap tay va gan vao muc 1.5
   cua mau hop dong, vi moi nguoi 1 noi dung cu the khac nhau".

   Dat o HopDongLaoDong chu KHONG o NhanVien: noi dung cong viec thuoc ve MOT BAN HOP DONG cu the.
   Cung mot nguoi ky HD thu viec roi HD chinh thuc roi tai ky se co noi dung khac nhau, va ban IN
   phai giu dung noi dung cua ban hop dong DANG IN, khong phai trang thai hien tai cua nhan vien.

   NVARCHAR(MAX) vi day la doan van nhieu dong (khac GhiChu NVARCHAR(500), von dang dung viec khac
   va KHONG he in ra hop dong).

   NULL duoc phep: hop dong cu khong co noi dung rieng van in binh thuong — ban in lui ve dung cau
   goc cua muc 1.5 (xem bienChoHopDong trong frontend/js/module.hrm.js).

   🔴 CHAY TRUOC `pm2 restart qlnoibo`. Route hop dong do cot bang COL_LENGTH moi lan luu (co y
   KHONG cache), nhung cu restart cho chac — xem feedback_qlnoibo_chay_migration_sau_pm2_phai_restart.

   An toan chay LAI nhieu lan. KHONG xoa, KHONG sua du lieu nghiep vu nao.
   ================================================================================================== */

SET NOCOUNT ON;
PRINT N'--- migration_v887: HopDongLaoDong.NoiDungCongViec ---';

IF OBJECT_ID('HopDongLaoDong', 'U') IS NULL
BEGIN
    PRINT N'!! KHONG CO BANG HopDongLaoDong — chay migration_v600.sql truoc. Dung lai.';
END
ELSE
BEGIN
    IF COL_LENGTH('HopDongLaoDong', 'NoiDungCongViec') IS NULL
    BEGIN
        ALTER TABLE HopDongLaoDong ADD NoiDungCongViec NVARCHAR(MAX) NULL;
        PRINT N'  + Da them cot HopDongLaoDong.NoiDungCongViec.';
    END
    ELSE
        PRINT N'  = Cot HopDongLaoDong.NoiDungCongViec da ton tai, bo qua.';
END

PRINT N'--- migration_v887: XONG ---';
GO
