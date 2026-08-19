/* ================================================================
   MIGRATION v1.0 -> v2.0
   Chi can chay file nay neu ban DA cai dat va co du lieu tu schema.sql v1.0.
   Neu ban dang cai dat lan dau, KHONG can chay file nay — schema.sql (v2.0)
   da bao gom san thay doi duoi day.

   Noi dung: them cot DonHangID vao PhieuXuatVai de lien ket "cap vai" tu
   phan he Quan ly san xuat voi phieu xuat kho vai (nghiep vu Cap phat vai
   theo don hang). Khong dung/xoa du lieu da co.
   ================================================================ */

USE QLNoiBo;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('PhieuXuatVai') AND name = 'DonHangID'
)
BEGIN
    ALTER TABLE PhieuXuatVai ADD DonHangID INT NULL;
    ALTER TABLE PhieuXuatVai ADD CONSTRAINT FK_PhieuXuatVai_DonHang
        FOREIGN KEY (DonHangID) REFERENCES DonHangSanXuat(DonHangID);
    PRINT 'Da them cot PhieuXuatVai.DonHangID.';
END
ELSE
BEGIN
    PRINT 'Cot PhieuXuatVai.DonHangID da ton tai, bo qua.';
END
GO
