/* ================================================================
   MIGRATION v6.25 — LOAI TAI KHOAN PHAN THEO PHIEU THU / PHIEU CHI
   ----------------------------------------------------------------
   Truoc day form Phieu thu va Phieu chi deu hien TAT CA tai khoan -> de chon nham
   (vd phieu thu lai chon "Chi mua vai"). Nay moi LOAI tai khoan co them cot LoaiPhieu:
        N'Thu'    -> chi hien khi lap PHIEU THU
        N'Chi'    -> chi hien khi lap PHIEU CHI
        N'Cả hai' -> hien o ca 2 (vd tai khoan trung gian, dieu chuyen quy)
   Suy ra tai khoan nao hien o phieu nao qua LOAI cua no (DanhMucTaiKhoan.LoaiTKID).

   Chay 1 lan. IDEMPOTENT. YEU CAU: migration_v668.sql.
   ================================================================ */
USE QLNoiBo;
GO
IF DB_NAME() <> 'QLNoiBo'
BEGIN
    RAISERROR('KHONG ket noi duoc database QLNoiBo - dung migration.', 16, 1);
    SET NOEXEC ON;
END
GO

IF COL_LENGTH('dbo.DanhMucLoaiTaiKhoan', 'LoaiPhieu') IS NULL
BEGIN
    ALTER TABLE dbo.DanhMucLoaiTaiKhoan
        ADD LoaiPhieu NVARCHAR(10) NOT NULL CONSTRAINT DF_LoaiTK_LoaiPhieu DEFAULT N'Chi';
    PRINT 'Da them cot DanhMucLoaiTaiKhoan.LoaiPhieu (mac dinh N''Chi'').';
END ELSE PRINT 'Cot LoaiPhieu da ton tai, bo qua.';
GO

/* Doan lai cho du lieu DA CO: ten bat dau bang "Thu" -> loai THU, con lai giu N'Chi'.
   Chi chay khi cot vua duoc them (tat ca dang la 'Chi' mac dinh) - khong ghi de lua chon nguoi dung. */
UPDATE DanhMucLoaiTaiKhoan
SET LoaiPhieu = N'Thu'
WHERE LoaiPhieu = N'Chi' AND (TenLoai LIKE N'Thu %' OR TenLoai LIKE N'Thu' OR TenLoai LIKE N'Thu_%');
GO

SELECT LoaiTKID, TenLoai, LoaiPhieu, TinhChiPhiKD FROM DanhMucLoaiTaiKhoan ORDER BY LoaiPhieu DESC, TenLoai;
GO

PRINT '';
PRINT '=== MIGRATION v670 HOAN TAT ===';
PRINT 'Kiem lai o Danh muc -> Loai tai khoan: cot "Dung cho phieu" (Thu / Chi / Ca hai).';
GO
SET NOEXEC OFF;
GO
