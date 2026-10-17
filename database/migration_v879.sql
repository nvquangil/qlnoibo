/* ================================================================================================
   migration_v879.sql   (v8.91)
   DON GIA TRA cho phieu xuat vai TRA NHA CUNG CAP
   ------------------------------------------------------------------------------------------------
   Nguyen 2026-10-15: "Phieu xuat kho vai, tra nha cung cap: bo cot Kieu, chi can cot Ma cay va
   So kg, them cot Don gia." — chot: don gia GO TAY duoc, de trong thi lay gia nhap cua chinh cay do.

   Truoc day cong no NCC khi tra hang luon lay VaiCay.DonGiaNhap, co y de "khong ai phai go, khong
   the lech voi luc nhap" (xem routes/congno.js). Nay cho go de xu ly truong hop thoa thuan tra lai
   gia khac gia mua.

   ⚠️ NULL = DUNG GIA NHAP NHU CU. Day la diem mau chot de DU LIEU CU KHONG DOI SO:
   moi dong phieu xuat da co deu NULL => cong no tinh y het truoc khi chay migration nay.
   Vi vay cot phai NULL, KHONG duoc DEFAULT 0 — default 0 la moi phieu tra NCC cu bong dung
   giam no 0 dong, cong no NCC nhay vot ma khong ai hieu tai sao.

   Chay:  SSMS tren database QLNoiBo
   Sau do: pm2 restart qlnoibo + Ctrl+F5
   ================================================================================================ */

USE QLNoiBo;
GO

IF DB_NAME() <> N'QLNoiBo'
BEGIN
    RAISERROR (N'!! DANG KHONG O DATABASE QLNoiBo. Chon dung database roi chay lai.', 20, 1) WITH LOG;
    SET NOEXEC ON;
END
GO

PRINT '=== migration_v879: don gia tra NCC tren phieu xuat vai ===';
GO

/* ---------------- 1. Cot DonGiaTra ----------------
   DECIMAL(18,2) — RONG HON `VaiCay.DonGiaNhap` (DECIMAL(14,2)) mot chut, co y: COALESCE giua hai cot
   se lay kieu rong hon nen khong bao gio tran so. Khong thu hep xuong 14,2 de khoi phai nghi lai. */
IF COL_LENGTH('PhieuXuatVaiChiTiet', 'DonGiaTra') IS NULL
BEGIN
    ALTER TABLE PhieuXuatVaiChiTiet ADD DonGiaTra DECIMAL(18,2) NULL;
    PRINT '  + Cot PhieuXuatVaiChiTiet.DonGiaTra';
END
ELSE PRINT '  = Cot PhieuXuatVaiChiTiet.DonGiaTra da co';
GO

/* ---------------- 2. DOI CHIEU SAU KHI CHAY ----------------
   So dong co DonGiaTra phai = 0 ngay sau khi chay: chua ai go gia nao, moi phieu cu van dung
   gia nhap. Neu khac 0 ngay lan dau chay thi dung lai va xem lai. */
PRINT '';
PRINT '--- Doi chieu (phai = 0 ngay sau khi chay) ---';
SELECT COUNT(*) AS SoDongDaGoDonGiaTra FROM PhieuXuatVaiChiTiet WHERE DonGiaTra IS NOT NULL;
GO

/* Cong no NCC tu phan "tra hang ve" TRUOC va SAU migration phai y het nhau (vi tat ca deu NULL).
   Chay cau nay TRUOC khi chay migration va SAU khi chay, hai ket qua phai trung tung dong. */
PRINT '';
PRINT '--- Tien tra hang ve NCC theo tung nha (dung de doi chieu truoc/sau) ---';
SELECT px.NCC_ID, SUM(ISNULL(ct.KGXuat, 0) * ISNULL(vc.DonGiaNhap, 0)) AS TienTraVe
FROM PhieuXuatVai px
JOIN PhieuXuatVaiChiTiet ct ON ct.PhieuXuatID = px.PhieuXuatID
JOIN VaiCay vc ON vc.CayID = ct.CayID
WHERE px.LaTraNCC = 1 AND px.NCC_ID IS NOT NULL
GROUP BY px.NCC_ID
ORDER BY px.NCC_ID;
GO

PRINT '';
PRINT '=== migration_v879 XONG ===';
PRINT 'DonGiaTra NULL = dung VaiCay.DonGiaNhap nhu truoc. Du lieu cu KHONG doi so.';
GO
