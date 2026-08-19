/* ================================================================
   MIGRATION v6.02 — Ra lệnh sản xuất: NHIỀU ảnh hình in thêu
   ----------------------------------------------------------------
   Yeu cau: "Ra lệnh sản xuất, hình ảnh in thêu thêm được nhiều hình ảnh".

   Cach lam: GIU NGUYEN 1 cot DonHangSanXuat.AnhHinhIn, luu NHIEU duong dan noi bang ky tu xuong dong
   (\n) - dung quy uoc da co san cua DonHangSanXuat.PhuLieu (nhieu dong phu kien noi bang \n, tu v5.42).
   Khong tao bang con -> khong phai sua moi cho doc (in lenh SX, form sua...) thanh JOIN.
   Chi can NOI RONG cot tu NVARCHAR(500) -> NVARCHAR(MAX): 500 ky tu chi chua duoc khoang 10 duong dan,
   dinh muc do se lam MAT ANH lang le khi luu (SQL Server bao loi truncate, nhung neu driver cat bot thi
   mat du lieu ma khong ai biet).

   ALTER COLUMN kieu noi rong (NVARCHAR(500) -> NVARCHAR(MAX)) la thao tac AN TOAN: khong mat du lieu cu,
   khong doi NULL/NOT NULL. Chay 1 lan. IDEMPOTENT (kiem tra max_length = -1 nghia la da la MAX).
   YEU CAU: migration_v55.sql (da tao cot AnhHinhIn).
   ================================================================ */
USE QLNoiBo;
GO
IF DB_NAME() <> 'QLNoiBo'
BEGIN
    RAISERROR('KHONG ket noi duoc database QLNoiBo - dung migration.', 16, 1);
    SET NOEXEC ON;
END
GO

IF COL_LENGTH('DonHangSanXuat', 'AnhHinhIn') IS NULL
BEGIN
    ALTER TABLE DonHangSanXuat ADD AnhHinhIn NVARCHAR(MAX) NULL;
    PRINT 'Da them DonHangSanXuat.AnhHinhIn (NVARCHAR(MAX)).';
END
ELSE IF EXISTS (SELECT 1 FROM sys.columns
                WHERE object_id = OBJECT_ID('DonHangSanXuat') AND name = 'AnhHinhIn' AND max_length <> -1)
BEGIN
    ALTER TABLE DonHangSanXuat ALTER COLUMN AnhHinhIn NVARCHAR(MAX) NULL;
    PRINT 'Da noi rong DonHangSanXuat.AnhHinhIn thanh NVARCHAR(MAX) (chua duoc nhieu duong dan anh).';
END
ELSE PRINT 'DonHangSanXuat.AnhHinhIn da la NVARCHAR(MAX), bo qua.';
GO

PRINT 'MIGRATION v663 HOAN TAT.';
GO
SET NOEXEC OFF;
GO
