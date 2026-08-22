/* ================================================================================================
   migration_v687.sql   (v7.24)
   NOI DMS VAO LUONG BAN HANG: nhan vien di tuyen LEN DON NGAY TAI SHOP

   VAN DE cua v7.23: da co shop / ghe tham / doanh so, nhung CHUA co duong lay don. Nhan vien ghe
   shop, khach dat hang -> phai goi ve van phong nho nguoi khac lap don, va don do KHONG mang dau vet
   "cua nhan vien nao, o shop nao" => cot doanh so o tab Doanh so mai mai bang 0.

   NAY:
     1. `DonKhachDatHang` co them `ShopID` + `NhanVienID` -> nhan vien lap don ngay tren dien thoai.
     2. Khi don len PHIEU BAN HANG, phieu KE THUA `ShopID`/`NhanVienID` tu don (routes/banhang.js)
        => doanh so nhan vien tu chay, khong phai nho ai go tay.
     3. `GheTham.DonID` (da co tu v686) duoc gan luon -> mo lan ghe la thay don lay duoc o do.

   ⚠️ KHONG dung `KhachHangID` cho shop: shop nam o bang rieng `ShopBanLe` (quyet dinh o v686).
      `TenKhach` cua don van ghi TEN SHOP vi cong no + phieu in dang gom theo ten (xem ghi chu trong
      backend/routes/danhmuc.js) — doi sang khoa so la pha ca phan he cong no dang chay.
   ================================================================================================ */
IF DB_NAME() <> N'QLNoiBo'
BEGIN
    RAISERROR (N'!! DANG KHONG O DATABASE QLNoiBo. Chon dung database roi chay lai.', 20, 1) WITH LOG;
    SET NOEXEC ON;
END
GO

IF COL_LENGTH('DonKhachDatHang', 'ShopID') IS NULL
BEGIN
  ALTER TABLE DonKhachDatHang ADD ShopID INT NULL;
  PRINT '  + DonKhachDatHang.ShopID';
END
ELSE PRINT '  = DonKhachDatHang.ShopID da co';
GO

IF COL_LENGTH('DonKhachDatHang', 'NhanVienID') IS NULL
BEGIN
  ALTER TABLE DonKhachDatHang ADD NhanVienID INT NULL;
  PRINT '  + DonKhachDatHang.NhanVienID';
END
ELSE PRINT '  = DonKhachDatHang.NhanVienID da co';
GO

IF OBJECT_ID('FK_DonKhach_Shop', 'F') IS NULL AND OBJECT_ID('ShopBanLe', 'U') IS NOT NULL
    ALTER TABLE DonKhachDatHang ADD CONSTRAINT FK_DonKhach_Shop FOREIGN KEY (ShopID) REFERENCES ShopBanLe(ShopID);
GO
IF OBJECT_ID('FK_DonKhach_NVKD', 'F') IS NULL
    ALTER TABLE DonKhachDatHang ADD CONSTRAINT FK_DonKhach_NVKD FOREIGN KEY (NhanVienID) REFERENCES NhanVien(NhanVienID);
GO

/* Index cho man hinh "don cua toi" tren dien thoai (loc theo nhan vien + ngay). */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_DonKhach_NVKD' AND object_id = OBJECT_ID('DonKhachDatHang'))
    CREATE INDEX IX_DonKhach_NVKD ON DonKhachDatHang(NhanVienID, ThoiGian);
GO

PRINT '';
PRINT '=== migration_v687 XONG ===';
PRINT 'PHAI pm2 restart qlnoibo (sua backend/routes/dms.js + banhang.js).';
PRINT 'Luong day du: Ghe tham -> "Len don" (don gan Shop + Nhan vien)';
PRINT '           -> Ban hang: "Chuyen sang phieu ban hang" (phieu KE THUA Shop + Nhan vien)';
PRINT '           -> DMS: tab Doanh so tu co so.';
GO
