/* ==================================================================================================
   migration_v896.sql — v9.70: CONG TAC VIEN THIET KE (danh muc + don gia + luong CTV) (Nguyen 16/11/2026)
   --------------------------------------------------------------------------------------------------
   Nguyen 16/11: "Them chuc nang luong CTV, don gia, danh muc CTV. Lenh san xuat them dau tich cong tac vien ben
   truong nhan vien thiet ke. Neu la CTV thi chon list CTV ra. Khong tich thi chon nhan vien thiet ke trong bo phan
   thiet ke. Ky thuat rap chon tu list nhan vien bo phan ky thuat."

     1. Bang CongTacVien: ten, SDT, email, DON GIA THIET KE (dong / lenh), ngan hang, ghi chu, trang thai.
     2. DonHangSanXuat.CongTacVienID (FK) — lenh do CTV thiet ke. ThietKeVien (chuoi ten) VAN duoc ghi = ten CTV
        de moi ban in cu khong doi.
     3. ChucNang DANHMUC/congtacvien (tab danh muc) + PAYROLL/luongctv (tab Luong CTV: so lenh thang x don gia).
   🔴 Moi lenh gac IF — chay lai nhieu lan an toan. Sau khi chay: pm2 restart qlnoibo.
   ================================================================================================== */
PRINT '=== migration_v896: cong tac vien thiet ke (v9.70) ===';
GO

IF OBJECT_ID('CongTacVien') IS NULL
BEGIN
    CREATE TABLE CongTacVien (
        CongTacVienID  INT IDENTITY(1,1) PRIMARY KEY,
        TenCTV         NVARCHAR(150) NOT NULL,
        SDT            NVARCHAR(30) NULL,
        Email          NVARCHAR(150) NULL,
        DonGiaThietKe  DECIMAL(14,2) NOT NULL DEFAULT 0,   -- dong / 1 lenh san xuat
        NganHang       NVARCHAR(200) NULL,                  -- so TK + ngan hang (de chuyen khoan)
        GhiChu         NVARCHAR(255) NULL,
        TrangThai      NVARCHAR(30) NOT NULL DEFAULT N'Đang hợp tác',   -- Đang hợp tác | Ngừng
        CreatedAt      DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        UpdatedAt      DATETIME2 NULL
    );
    PRINT '  + bang CongTacVien';
END ELSE PRINT '  = bang CongTacVien da co';
GO

IF COL_LENGTH('DonHangSanXuat', 'CongTacVienID') IS NULL
BEGIN
    ALTER TABLE DonHangSanXuat ADD CongTacVienID INT NULL;
    PRINT '  + DonHangSanXuat.CongTacVienID';
END ELSE PRINT '  = DonHangSanXuat.CongTacVienID da co';
GO
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_DonHangSanXuat_CongTacVien')
BEGIN
    ALTER TABLE DonHangSanXuat WITH CHECK ADD CONSTRAINT FK_DonHangSanXuat_CongTacVien
        FOREIGN KEY (CongTacVienID) REFERENCES CongTacVien(CongTacVienID);
    PRINT '  + FK_DonHangSanXuat_CongTacVien';
END ELSE PRINT '  = FK_DonHangSanXuat_CongTacVien da co';
GO

/* ChucNang: mac dinh tick (1) — tab danh muc + tab luong CTV la viec cua ke toan / quan tri, Phan quyen cam duoc. */
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ChucNang')
BEGIN
    MERGE ChucNang AS t
    USING (VALUES ('DANHMUC', 'congtacvien', N'Cộng tác viên thiết kế', 20),
                  ('PAYROLL', 'luongctv', N'Lương cộng tác viên thiết kế', 12)) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu)
    ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
    WHEN NOT MATCHED THEN INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu) VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu);
    PRINT '  + ChucNang DANHMUC/congtacvien, PAYROLL/luongctv';
END
GO
PRINT '=== migration_v896 xong. pm2 restart qlnoibo ===';
GO
