/* ================================================================
   MIGRATION v6.43 — Chỉ định sản xuất: thêm trường Mác + Phụ kiện
   ----------------------------------------------------------------
   - Mac      : nhãn "Mác" nhập tự do (1 dòng).
   - PhuLieu  : "Phụ kiện" nhập tự do, NHIỀU dòng — lưu dạng text nối bằng ký tự xuống dòng (\n).
                (Trùng tên cột mà bản in Form 1 màu đã đọc sẵn: o.PhuLieu.)
   Additive, NULL được, không ảnh hưởng dữ liệu cũ. Idempotent (guard COL_LENGTH). Chạy 1 lần.
   ================================================================ */
USE QLNoiBo;
GO

IF COL_LENGTH('DonHangSanXuat', 'Mac') IS NULL
BEGIN
    ALTER TABLE DonHangSanXuat ADD Mac NVARCHAR(255) NULL;
    PRINT 'Da them cot DonHangSanXuat.Mac.';
END ELSE PRINT 'Cot DonHangSanXuat.Mac da ton tai, bo qua.';
GO

IF COL_LENGTH('DonHangSanXuat', 'PhuLieu') IS NULL
BEGIN
    ALTER TABLE DonHangSanXuat ADD PhuLieu NVARCHAR(MAX) NULL;
    PRINT 'Da them cot DonHangSanXuat.PhuLieu.';
END ELSE PRINT 'Cot DonHangSanXuat.PhuLieu da ton tai, bo qua.';
GO

PRINT '=== migration_v643.sql (Mac + PhuLieu cho DonHangSanXuat) hoan tat ===';
GO
