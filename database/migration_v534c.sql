/* ================================================================
   MIGRATION v5.34c (Giai doan B2) — Quy cach dong goi + Tai lieu in theu
   ----------------------------------------------------------------
   1) Tong quat hoa TaiLieuMoTaSanPham bang cot Loai de dung lai l/editor "Mo ta san pham"
      cho 3 loai tai lieu anh-luoi:
        'motasp'         = Mo ta duong may  (Tai lieu may)      -- du lieu cu mac dinh
        'quycach'        = Quy cach dong goi (Tai lieu may)
        'hinhanhinthue'  = Hinh anh mo ta in/theu (Tai lieu in theu)
      Doi UNIQUE tu (DonHangID) sang (DonHangID, Loai) de moi don co ca 3 loai.
   2) Bang DonHangDonGiaInThe — don gia in theu theo don (nhieu dong): Ten (tu do) / DonGia.
   Chay 1 lan. IDEMPOTENT.
   ================================================================ */
USE QLNoiBo;
GO

/* --- 1) TaiLieuMoTaSanPham.Loai --- */
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('TaiLieuMoTaSanPham') AND name = 'Loai')
BEGIN
    ALTER TABLE TaiLieuMoTaSanPham ADD Loai NVARCHAR(30) NOT NULL DEFAULT 'motasp';
    PRINT 'Da them cot Loai vao TaiLieuMoTaSanPham (mac dinh motasp).';
END ELSE PRINT 'Cot Loai da ton tai, bo qua.';
GO

/* Go UNIQUE cu chi tren DonHangID (neu co) roi tao UNIQUE (DonHangID, Loai). */
DECLARE @uq NVARCHAR(200);
SELECT @uq = i.name FROM sys.indexes i
  WHERE i.object_id = OBJECT_ID('TaiLieuMoTaSanPham') AND i.is_unique = 1 AND i.name LIKE '%DonHang%'
    AND (SELECT COUNT(*) FROM sys.index_columns ic WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id) = 1;
IF @uq IS NOT NULL
BEGIN
    EXEC('DROP INDEX ' + @uq + ' ON TaiLieuMoTaSanPham;');
    PRINT 'Da go UNIQUE cu (chi DonHangID).';
END
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('TaiLieuMoTaSanPham') AND name = 'UX_TLMoTa_Don_Loai')
BEGIN
    CREATE UNIQUE INDEX UX_TLMoTa_Don_Loai ON TaiLieuMoTaSanPham(DonHangID, Loai);
    PRINT 'Da tao UNIQUE (DonHangID, Loai).';
END ELSE PRINT 'UNIQUE (DonHangID, Loai) da ton tai, bo qua.';
GO

/* --- 2) DonHangDonGiaInThe --- */
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'DonHangDonGiaInThe')
BEGIN
    CREATE TABLE DonHangDonGiaInThe (
        ID        INT IDENTITY(1,1) PRIMARY KEY,
        DonHangID INT NOT NULL FOREIGN KEY REFERENCES DonHangSanXuat(DonHangID) ON DELETE CASCADE,
        Ten       NVARCHAR(200) NOT NULL,
        DonGia    DECIMAL(14,2) NULL,
        ThuTu     INT NOT NULL DEFAULT 0,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    CREATE INDEX IX_DGInThe_Don ON DonHangDonGiaInThe(DonHangID);
    PRINT 'Da tao DonHangDonGiaInThe.';
END ELSE PRINT 'DonHangDonGiaInThe da ton tai, bo qua.';
GO

PRINT '=== migration_v534c.sql (Quy cach dong goi + Tai lieu in theu) hoan tat ===';
GO
