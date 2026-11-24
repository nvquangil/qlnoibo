/* ==================================================================================================
   migration_v903.sql — v9.77: NHOM KHACH HANG (Nguyen 19/11/2026)
   "Them chuc nang danh muc nhom khach hang, tu them khach hang vao nhom hoac khi tao danh muc khach hang thi chon nhom.
    Dashboard kinh doanh them theo nhom khach hang."

     1. Bang NhomKhachHang (TenNhom duy nhat, MoTa, ThuTu).
     2. KhachHang.NhomKhachHangID (NULL = chua gan nhom) + FK.
     3. ChucNang DANHMUC/nhomkhachhang — tab moi (key PHAI trung key tab o module.danhmuc.js getTabs).

   🔴 Dashboard gom phieu theo TEN khach (PhieuBanHang.TenKhach), con nhom gan o bang KhachHang ⇒ ghep theo TEN
      (LTRIM/RTRIM), cung khoa nghiep vu voi danhmuc.js BANG_TEN_KHACH. Ten khong co trong danh muc ⇒ "Chua gan nhom".
   🔴 Gac IF — chay lai an toan. Sau khi chay: pm2 restart qlnoibo.
   ================================================================================================== */
PRINT '=== migration_v903: nhom khach hang (v9.77) ===';
GO

/* ---------- 1. NhomKhachHang ---------- */
IF OBJECT_ID('NhomKhachHang') IS NULL
BEGIN
    CREATE TABLE NhomKhachHang (
        NhomKhachHangID INT IDENTITY(1,1) PRIMARY KEY,
        TenNhom         NVARCHAR(100) NOT NULL UNIQUE,
        MoTa            NVARCHAR(255) NULL,
        ThuTu           INT NULL,
        CreatedAt       DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    PRINT '  + NhomKhachHang';
END ELSE PRINT '  = NhomKhachHang da co';
GO

/* ---------- 2. KhachHang.NhomKhachHangID ---------- */
IF COL_LENGTH('KhachHang', 'NhomKhachHangID') IS NULL
BEGIN
    ALTER TABLE KhachHang ADD NhomKhachHangID INT NULL;
    PRINT '  + KhachHang.NhomKhachHangID';
END ELSE PRINT '  = KhachHang.NhomKhachHangID da co';
GO
IF OBJECT_ID('NhomKhachHang') IS NOT NULL AND COL_LENGTH('KhachHang', 'NhomKhachHangID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_KhachHang_NhomKhachHang')
BEGIN
    ALTER TABLE KhachHang ADD CONSTRAINT FK_KhachHang_NhomKhachHang
        FOREIGN KEY (NhomKhachHangID) REFERENCES NhomKhachHang(NhomKhachHangID);
    PRINT '  + FK_KhachHang_NhomKhachHang';
END ELSE PRINT '  = FK_KhachHang_NhomKhachHang da co (hoac chua du bang/cot)';
GO

/* ---------- 3. ChucNang cho tab danh muc moi ---------- */
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ChucNang')
BEGIN
    MERGE ChucNang AS t
    USING (VALUES ('DANHMUC', 'nhomkhachhang', N'Nhóm khách hàng', 21)) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu)
    ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
    WHEN NOT MATCHED THEN INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu) VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu);
    PRINT '  + ChucNang DANHMUC/nhomkhachhang';
END
GO

PRINT '=== migration_v903 xong. pm2 restart qlnoibo ===';
GO
