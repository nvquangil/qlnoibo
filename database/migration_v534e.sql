/* ================================================================
   MIGRATION v5.34e (Giai doan B, "Tao mau") — them Tao/Ap/Quan ly MAU cho
   Thong so ky thuat (thongsodo) + Mo ta duong may/Quy cach dong goi (motasp/quycach).
   ----------------------------------------------------------------
   Mirror pattern TaiLieuKyThuatChung: mau = LaMau=1 + DonHangID NULL. Phai:
     - DonHangID -> NULL (dang NOT NULL).
     - Them LaMau BIT + TenMau NVARCHAR.
     - Doi unique index sang FILTERED (WHERE LaMau=0) de nhieu mau (DonHangID NULL) khong dung nhau,
       don hang van chi 1 ban that.
   TaiLieuMoTaSanPham co them cot Loai (v534c) -> unique van la (DonHangID, Loai) nhung LOC WHERE LaMau=0.
   Chay 1 lan. IDEMPOTENT.
   ================================================================ */
USE QLNoiBo;
GO

/* ===== 1) TaiLieuThongSoDo ===== */
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_TLTSD_DonHang' AND object_id = OBJECT_ID('TaiLieuThongSoDo'))
BEGIN
    DROP INDEX UQ_TLTSD_DonHang ON TaiLieuThongSoDo;
    PRINT 'Da go UQ_TLTSD_DonHang (unfiltered).';
END
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('TaiLieuThongSoDo') AND name = 'DonHangID' AND is_nullable = 0)
BEGIN
    ALTER TABLE TaiLieuThongSoDo ALTER COLUMN DonHangID INT NULL;
    PRINT 'TaiLieuThongSoDo.DonHangID -> NULL.';
END
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('TaiLieuThongSoDo') AND name = 'LaMau')
    ALTER TABLE TaiLieuThongSoDo ADD LaMau BIT NOT NULL DEFAULT 0;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('TaiLieuThongSoDo') AND name = 'TenMau')
    ALTER TABLE TaiLieuThongSoDo ADD TenMau NVARCHAR(255) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_TLTSD_Don_Real' AND object_id = OBJECT_ID('TaiLieuThongSoDo'))
    CREATE UNIQUE INDEX UX_TLTSD_Don_Real ON TaiLieuThongSoDo(DonHangID) WHERE LaMau = 0;
GO
PRINT '=== TaiLieuThongSoDo san sang cho mau ===';
GO

/* ===== 2) TaiLieuMoTaSanPham (motasp/quycach/hinhanhinthue) ===== */
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_TLMoTa_Don_Loai' AND object_id = OBJECT_ID('TaiLieuMoTaSanPham'))
BEGIN
    DROP INDEX UX_TLMoTa_Don_Loai ON TaiLieuMoTaSanPham;
    PRINT 'Da go UX_TLMoTa_Don_Loai (unfiltered).';
END
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('TaiLieuMoTaSanPham') AND name = 'DonHangID' AND is_nullable = 0)
BEGIN
    ALTER TABLE TaiLieuMoTaSanPham ALTER COLUMN DonHangID INT NULL;
    PRINT 'TaiLieuMoTaSanPham.DonHangID -> NULL.';
END
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('TaiLieuMoTaSanPham') AND name = 'LaMau')
    ALTER TABLE TaiLieuMoTaSanPham ADD LaMau BIT NOT NULL DEFAULT 0;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('TaiLieuMoTaSanPham') AND name = 'TenMau')
    ALTER TABLE TaiLieuMoTaSanPham ADD TenMau NVARCHAR(255) NULL;
GO
-- Unique CHI ap cho ban that (LaMau=0): moi don 1 ban / 1 loai. Mau (LaMau=1, DonHangID NULL) khong bi rang buoc.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_TLMoTa_Don_Loai_Real' AND object_id = OBJECT_ID('TaiLieuMoTaSanPham'))
    CREATE UNIQUE INDEX UX_TLMoTa_Don_Loai_Real ON TaiLieuMoTaSanPham(DonHangID, Loai) WHERE LaMau = 0;
GO
PRINT '=== TaiLieuMoTaSanPham san sang cho mau ===';
GO

PRINT '=== migration_v534e.sql (Tao mau cho Thong so/Mo ta/Quy cach) hoan tat ===';
GO
