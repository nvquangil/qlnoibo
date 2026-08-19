-- ================================================================
-- migration_v647.sql  (v5.52)
-- Thêm cột Ghi chú cho TỪNG MÀU trong Thẻ kho (chi tiết theo màu).
-- An toàn chạy lại nhiều lần.
-- ================================================================
IF COL_LENGTH('TheKhoChiTietMau', 'GhiChu') IS NULL
    ALTER TABLE TheKhoChiTietMau ADD GhiChu NVARCHAR(255) NULL;
GO
