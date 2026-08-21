/* ================================================================================================
   migration_v685.sql   (v7.22)
   LUONG DU LIEU HAI CHIEU: PHIEU BAN HANG  <->  CHI TIET DAT HANG

   YEU CAU: sua phieu ban hang (doi mau / xoa ma hang / them ma moi) thi CHI TIET DAT HANG cua ma
   hang do phai phan anh theo. Muon lam duoc phai PHAN BIET hai loai dong trong DonKhachDatHang:

     1. DON THAT cua khach  (khach dat trong app hoac tren web)
        -> Doi mau: don doi theo phieu. Bo khoi phieu: HOI nguoi dung (huy hay giu cho giao sau).
     2. DON PHAN CHIEU tu phieu ban hang  (`NguonDat = 'PhieuBH'`)
        Sinh tu dong khi mot dong phieu KHONG xuat phat tu don nao (ban thang, hoac them ma moi luc
        sua phieu). No chi la BAN GHI PHAN CHIEU cua dong phieu, khong phai yeu cau cua khach.
        -> Dong phieu mat thi XOA luon don nay (khong de treo, khong giu ton).

   Cot `NguonDat` da co tu migration_v657 (dung cho don dat qua Web). File nay chi DAM BAO cot ton
   tai o cac ban cai chua chay v657, va noi rong do dai neu cot dang qua ngan.
   KHONG sua mot dong du lieu nao dang co.
   ================================================================================================ */
SET NOCOUNT ON;
GO

IF COL_LENGTH('DonKhachDatHang', 'NguonDat') IS NULL
BEGIN
    ALTER TABLE DonKhachDatHang ADD NguonDat NVARCHAR(30) NULL;
    PRINT '  + Da them cot DonKhachDatHang.NguonDat.';
END
ELSE
    PRINT '  = Cot DonKhachDatHang.NguonDat da co.';
GO

/* Do dai phai chua duoc chuoi 'PhieuBH' (7 ky tu) - cac ban cu khai NVARCHAR(10) van du, nhung neu
   ai do khai ngan hon thi noi ra cho chac. */
IF COL_LENGTH('DonKhachDatHang', 'NguonDat') < 20
BEGIN
    ALTER TABLE DonKhachDatHang ALTER COLUMN NguonDat NVARCHAR(30) NULL;
    PRINT '  + Da noi rong NguonDat len NVARCHAR(30).';
END
GO

PRINT '';
PRINT '=== migration_v685 XONG ===';
PRINT 'PHAI pm2 restart qlnoibo (sua backend/routes/banhang.js).';
PRINT 'Tu day: moi dong phieu ban hang khong gan don se tu sinh 1 dong o Chi tiet dat hang';
PRINT '        (NguonDat = PhieuBH, trang thai "Đã xuất hàng", KHONG tru ton lan hai).';
PRINT 'Kiem nhanh sau khi dung mot thoi gian:';
PRINT '  SELECT NguonDat, COUNT(*) FROM DonKhachDatHang GROUP BY NguonDat;';
GO
