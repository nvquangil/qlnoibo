/* ================================================================
   MIGRATION v5.34d (Giai doan C) — May giao viec theo don gia cong doan may MOI + luong = SL x Thanh tien
   ----------------------------------------------------------------
   Bang moi DonHangDonGiaCongDoanMay (v534b) khong co CongDoanMayID (dinh danh bang ID + TenCongDoan tu do),
   trong khi PhanCongMay (phan cong NV+SL) tham chieu CongDoanMayID. => Them cot noi:
     PhanCongMay.DonGiaCongDoanMayID -> DonHangDonGiaCongDoanMay(ID)  (nullable, dong cu van dung CongDoanMayID).
   Payroll doc dual-path: uu tien dong-gia-moi (SL x ThanhTien), fallback model cu (SL x DonGia x HeSo).
   Chay 1 lan. IDEMPOTENT.
   ================================================================ */
USE QLNoiBo;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('PhanCongMay') AND name = 'DonGiaCongDoanMayID')
BEGIN
    ALTER TABLE PhanCongMay ADD DonGiaCongDoanMayID INT NULL
        FOREIGN KEY REFERENCES DonHangDonGiaCongDoanMay(ID);
    PRINT 'Da them cot PhanCongMay.DonGiaCongDoanMayID (FK -> DonHangDonGiaCongDoanMay).';
END ELSE PRINT 'Cot PhanCongMay.DonGiaCongDoanMayID da ton tai, bo qua.';
GO

PRINT '=== migration_v534d.sql (May giao viec theo don gia moi + luong SL x Thanh tien) hoan tat ===';
GO
