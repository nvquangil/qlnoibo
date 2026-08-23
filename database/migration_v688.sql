/* ================================================================================================
   migration_v688.sql   (v7.28)
   GIU DAU VET SHOP TREN CHUNG TU  ->  cho phep XOA shop ma khong mat du lieu ke toan

   VAN DE: shop ngung ban roi thi muon xoa khoi danh muc cho gon, nhung phieu ban hang cu dang tro
   vao no (`PhieuBanHang.ShopID`). Ban v7.27 chan xoa han vi so mat dau vet.
   Thuc te: chung tu ke toan KHONG phu thuoc shop — khach hang cua phieu la NHA PHAN PHOI
   (`KhachHangID` + `TenKhach`), doanh so ghi cho NHAN VIEN (`NhanVienID`). Shop chi la DIEM GIAO.
   Nen chi can GIU LAI TEN SHOP dang chu (snapshot) la xoa duoc shop ma bao cao cu van doc duoc
   "lo hang do giao tai shop nao".

   Day dung nguyen tac SNAPSHOT da dung cho `PhieuBanHang.TenKhach` (luu ten luc ban, doi ten khach
   ve sau khong lam sai phieu cu). Ap dung tiep cho ten shop.
   ================================================================================================ */
IF DB_NAME() <> N'QLNoiBo'
BEGIN
    RAISERROR (N'!! DANG KHONG O DATABASE QLNoiBo. Chon dung database roi chay lai.', 20, 1) WITH LOG;
    SET NOEXEC ON;
END
GO

IF COL_LENGTH('PhieuBanHang', 'TenShop') IS NULL
BEGIN
  ALTER TABLE PhieuBanHang ADD TenShop NVARCHAR(180) NULL;
  PRINT '  + PhieuBanHang.TenShop (snapshot ten shop luc ban)';
END
ELSE PRINT '  = PhieuBanHang.TenShop da co';
GO

/* Backfill cho cac phieu DA co ShopID nhung chua co snapshot (phieu lap truoc ban nay). */
IF COL_LENGTH('PhieuBanHang', 'TenShop') IS NOT NULL AND OBJECT_ID('ShopBanLe', 'U') IS NOT NULL
BEGIN
  UPDATE p SET p.TenShop = s.MaShop + N' · ' + s.TenShop
  FROM PhieuBanHang p JOIN ShopBanLe s ON s.ShopID = p.ShopID
  WHERE p.TenShop IS NULL;
  PRINT '  + Da dien TenShop cho ' + CAST(@@ROWCOUNT AS NVARCHAR(10)) + ' phieu ban hang cu.';
END
GO

/* Don khach dat cung nen giu ten shop (bao cao don theo shop sau khi shop bi xoa). */
IF COL_LENGTH('DonKhachDatHang', 'TenShop') IS NULL
BEGIN
  ALTER TABLE DonKhachDatHang ADD TenShop NVARCHAR(180) NULL;
  PRINT '  + DonKhachDatHang.TenShop';
END
ELSE PRINT '  = DonKhachDatHang.TenShop da co';
GO

IF COL_LENGTH('DonKhachDatHang', 'TenShop') IS NOT NULL AND OBJECT_ID('ShopBanLe', 'U') IS NOT NULL
BEGIN
  UPDATE o SET o.TenShop = s.MaShop + N' · ' + s.TenShop
  FROM DonKhachDatHang o JOIN ShopBanLe s ON s.ShopID = o.ShopID
  WHERE o.TenShop IS NULL;
  PRINT '  + Da dien TenShop cho ' + CAST(@@ROWCOUNT AS NVARCHAR(10)) + ' don khach cu.';
END
GO

PRINT '';
PRINT '=== migration_v688 XONG ===';
PRINT 'PHAI pm2 restart qlnoibo (sua backend/routes/banhang.js + dms.js).';
PRINT 'Tu day: xoa shop (trang thai Ngung) se GO lien ket khoi phieu/don nhung GIU nguyen so tien,';
PRINT '        khach hang (nha phan phoi), nhan vien va TEN SHOP da luu -> ke toan khong mat gi.';
GO
