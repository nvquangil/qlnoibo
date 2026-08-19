-- ================================================================
-- migration_v650.sql  (v5.55)
-- (1) ChucNang QLSX 'bosungsodo' — hiện trong Phân quyền chức năng.
-- (2) "Nhiều bản có TÊN cho 1 đơn" cho tài liệu header-based + BTP:
--     thêm cột TenPhieu + BỎ unique index "1 bản/đơn" để cho phép nhiều bản.
-- An toàn chạy lại nhiều lần.
-- ================================================================

MERGE ChucNang AS t
USING (VALUES ('QLSX', 'bosungsodo', N'Bổ sung sơ đồ', 12)) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu)
ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
WHEN NOT MATCHED THEN
    INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu) VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu);
GO

IF COL_LENGTH('TaiLieuKyThuatChung', 'TenPhieu') IS NULL ALTER TABLE TaiLieuKyThuatChung ADD TenPhieu NVARCHAR(200) NULL;
GO
IF COL_LENGTH('TaiLieuThongSoDo', 'TenPhieu') IS NULL ALTER TABLE TaiLieuThongSoDo ADD TenPhieu NVARCHAR(200) NULL;
GO
IF COL_LENGTH('TaiLieuMoTaSanPham', 'TenPhieu') IS NULL ALTER TABLE TaiLieuMoTaSanPham ADD TenPhieu NVARCHAR(200) NULL;
GO
IF COL_LENGTH('BangKeBanThanhPham', 'TenPhieu') IS NULL ALTER TABLE BangKeBanThanhPham ADD TenPhieu NVARCHAR(200) NULL;
GO

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_TLKTC_DonHang' AND object_id = OBJECT_ID('TaiLieuKyThuatChung')) DROP INDEX UQ_TLKTC_DonHang ON TaiLieuKyThuatChung;
GO
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_TLTSD_Don_Real' AND object_id = OBJECT_ID('TaiLieuThongSoDo')) DROP INDEX UX_TLTSD_Don_Real ON TaiLieuThongSoDo;
GO
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_TLMoTa_Don_Loai_Real' AND object_id = OBJECT_ID('TaiLieuMoTaSanPham')) DROP INDEX UX_TLMoTa_Don_Loai_Real ON TaiLieuMoTaSanPham;
GO
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_BangKeBTP_Don' AND object_id = OBJECT_ID('BangKeBanThanhPham')) DROP INDEX UX_BangKeBTP_Don ON BangKeBanThanhPham;
GO
