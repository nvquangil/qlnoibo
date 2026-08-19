-- ================================================================
-- migration_v649.sql  (v5.54)
-- "Nhiều bản có TÊN cho 1 đơn" — thêm cột TenPhieu để nhóm dòng theo từng bản chỉ định.
--   - ChiDinhVaiSX        (Chỉ định vải SX)  -> nhóm dòng theo (DonHangID, TenPhieu)
--   - DonHangChiTietPhuKien (Chỉ định NPL)   -> nhóm dòng theo (DonHangID, TenPhieu)
-- Dữ liệu cũ TenPhieu = NULL -> coi là 1 bản mặc định (tên rỗng).
-- An toàn chạy lại nhiều lần.
-- ================================================================
IF COL_LENGTH('ChiDinhVaiSX', 'TenPhieu') IS NULL
    ALTER TABLE ChiDinhVaiSX ADD TenPhieu NVARCHAR(200) NULL;
GO
IF COL_LENGTH('DonHangChiTietPhuKien', 'TenPhieu') IS NULL
    ALTER TABLE DonHangChiTietPhuKien ADD TenPhieu NVARCHAR(200) NULL;
GO
