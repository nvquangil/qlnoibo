/* ================================================================
   MIGRATION v5.5 — QLSX: anh "Hinh in", don gia gia cong ngoai chon
   ngay o cong doan Ky thuat. Additive - KHONG xoa/doi cot cu. Idempotent -
   chay lai an toan, khong mat du lieu. Khong dung migration rieng cho
   Dashboard/In phieu/Giao viec noi bo (PhanCongMay) - cac thay doi do
   dung lai dung bang/cot da co (xem HUONG_DAN_CAI_DAT.md muc v5.5).
   ================================================================ */

USE QLNoiBo;
GO

/* ---- 1. "Hinh in" gio co THEM anh tai len (giu nguyen cot chu DongHinhIn da co tu v5.0 - yeu
   cau la "THEM chuc nang tai anh len", khong phai thay the dong chu mo ta) ---- */
IF COL_LENGTH('DonHangSanXuat', 'AnhHinhIn') IS NULL
BEGIN
    ALTER TABLE DonHangSanXuat ADD AnhHinhIn NVARCHAR(500) NULL;
    PRINT 'Da them cot DonHangSanXuat.AnhHinhIn.';
END ELSE PRINT 'Cot DonHangSanXuat.AnhHinhIn da ton tai, bo qua.';
GO

/* ---- 2. Don gia gia cong NGOAI (khi giao cho 1 nha gia cong KHAC "Nha Lam"), chon/nhap ngay o
   cong doan "Ky thuat" trong Ghi tien do - dat CUNG cap voi NhaGiaCongID (da co tu truoc, cot don
   nay o muc DON HANG, khong phai theo tung cong doan may nhu DonHangCongDoanMay, vi gia cong ngoai
   thuong tra theo 1 don gia/don hang chu khong tach tung cong doan may noi bo). Chua dung o dau -
   se phuc vu phan he tinh luong/thanh toan nha gia cong lam sau, hien tai chi luu de xem lai. ---- */
IF COL_LENGTH('DonHangSanXuat', 'DonGiaGiaCongNgoai') IS NULL
BEGIN
    ALTER TABLE DonHangSanXuat ADD DonGiaGiaCongNgoai DECIMAL(14,2) NULL;
    PRINT 'Da them cot DonHangSanXuat.DonGiaGiaCongNgoai.';
END ELSE PRINT 'Cot DonHangSanXuat.DonGiaGiaCongNgoai da ton tai, bo qua.';
GO

PRINT 'Hoan tat migration v5.5.';
GO
