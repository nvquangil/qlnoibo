/* ================================================================================================
   migration_v682.sql   (v6.87)
   PHIEU NHAP KHO KHONG CON TU TAO MA HANG / THE KHO.

   TRUOC DAY (v6.78 - v6.86): luu phieu nhap kho la BACKEND TU TAO luon ma hang trong
   TheKhoHangHoa (ham timHoacTaoMaHang, co `taoMoi: true`). Hai hau qua:
     - Danh muc bi tao ngam boi mot chung tu nhap kho. Go sai chinh ta ma hang = rac danh muc,
       khong ai biet ma nao do ai tao, luc nao.
     - Nut "Tao the kho" o phieu nhap luon bao "Ma hang da ton tai, dung chuc nang Sua" - vi
       chinh luc luu phieu no da tao ma roi. Hai chuc nang do nhau.

   NAY: PHIEU NHAP CHI LA PHIEU NHAP.
     - Dong hang tro tot ma DA CO trong danh muc  -> MaHangID co gia tri, CONG TON ngay (nhu cu).
     - Dong hang mang ma CHUA CO trong danh muc   -> MaHangID = NULL, luu ma/ten/DVT vao cot *Cho,
       KHONG tao ma hang, KHONG cong ton. Dong do dang "CHO TAO THE KHO".
     - Khi nguoi dung THUC SU tao the kho cho ma do (tab The kho hang hoa), backend tu tim moi dong
       dang cho mang dung ma ay, gan MaHangID vao va LUC DO moi cong ton (route POST
       /api/nhapkho/gan-mahang, goi tu dong sau khi luu the kho moi).

   => Ton kho van khong bi dem hai lan, vi CHI CO MOT LUOT cong ton cho moi dong: hoac luc luu
      phieu (ma da co), hoac luc tao the kho (ma chua co). Khong bao gio ca hai.
   ================================================================================================ */

/* ---------------- 1. MaHangID / MauSacID cho phep NULL ----------------
   Khoa ngoai FK_PNKHCT_MaHang / FK_PNKHCT_Mau GIU NGUYEN - SQL Server khong kiem tra FK khi gia
   tri la NULL, nen dong "cho tao the kho" hop le ma van khong the tro sai vao ma khong ton tai. */
IF EXISTS (SELECT 1 FROM sys.columns
           WHERE object_id = OBJECT_ID('PhieuNhapKhoHangChiTiet') AND name = 'MaHangID' AND is_nullable = 0)
BEGIN
  ALTER TABLE PhieuNhapKhoHangChiTiet ALTER COLUMN MaHangID INT NULL;
  PRINT '  + PhieuNhapKhoHangChiTiet.MaHangID -> cho phep NULL';
END
ELSE PRINT '  = MaHangID da cho phep NULL, bo qua';
GO

IF EXISTS (SELECT 1 FROM sys.columns
           WHERE object_id = OBJECT_ID('PhieuNhapKhoHangChiTiet') AND name = 'MauSacID' AND is_nullable = 0)
BEGIN
  ALTER TABLE PhieuNhapKhoHangChiTiet ALTER COLUMN MauSacID INT NULL;
  PRINT '  + PhieuNhapKhoHangChiTiet.MauSacID -> cho phep NULL';
END
ELSE PRINT '  = MauSacID da cho phep NULL, bo qua';
GO

/* SoLuongChinh: dong dang cho chua biet quy ve don vi chinh la bao nhieu (chua co ma hang thi chua
   co ty le quy doi). De 0 chu khong de NULL - moi phep SUM ton kho dang cong thang cot nay. */
IF EXISTS (SELECT 1 FROM sys.columns
           WHERE object_id = OBJECT_ID('PhieuNhapKhoHangChiTiet') AND name = 'SoLuongChinh' AND is_nullable = 0)
BEGIN
  ALTER TABLE PhieuNhapKhoHangChiTiet ALTER COLUMN SoLuongChinh INT NULL;
  PRINT '  + PhieuNhapKhoHangChiTiet.SoLuongChinh -> cho phep NULL';
END
ELSE PRINT '  = SoLuongChinh da cho phep NULL, bo qua';
GO

/* ---------------- 2. Cot luu ma hang DANG CHO ----------------
   Day la thong tin nguoi dung go tren phieu, chua thanh ma hang thuc. Luu nguyen van de sau nay
   tao the kho con dien lai duoc, va de bao cao con biet phieu nhap gi. */
IF COL_LENGTH('PhieuNhapKhoHangChiTiet', 'MaHangCho') IS NULL
BEGIN
  ALTER TABLE PhieuNhapKhoHangChiTiet ADD
    MaHangCho       NVARCHAR(50)  NULL,   -- ma hang nguoi dung go, chua co trong danh muc
    TenHangCho      NVARCHAR(255) NULL,
    LoaiRiCho       INT           NULL,   -- ty le quy doi nguoi dung khai (goi y khi tao the kho)
    DonViCoBanCho   NVARCHAR(20)  NULL,
    DonViQuyDoiCho  NVARCHAR(20)  NULL;
  PRINT '  + Da them 5 cot *Cho vao PhieuNhapKhoHangChiTiet';
END
ELSE PRINT '  = Cac cot *Cho da co, bo qua';
GO

/* Tra nhanh "phieu nao con dong cho tao the kho" */
IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE object_id = OBJECT_ID('PhieuNhapKhoHangChiTiet') AND name = 'IX_PNKHCT_MaHangCho')
BEGIN
  CREATE INDEX IX_PNKHCT_MaHangCho ON PhieuNhapKhoHangChiTiet(MaHangCho) WHERE MaHangCho IS NOT NULL;
  PRINT '  + Da tao index IX_PNKHCT_MaHangCho';
END
ELSE PRINT '  = Index IX_PNKHCT_MaHangCho da co, bo qua';
GO

PRINT '';
PRINT '=== migration_v682 XONG ===';
PRINT 'KHONG can sua du lieu cu: moi dong dang co deu da co MaHangID, van chay nhu truoc.';
PRINT 'LUU Y: phai pm2 restart qlnoibo (sua backend/routes/nhapkho.js).';
GO
