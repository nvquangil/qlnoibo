/* ================================================================
   MIGRATION v5.2 — Quan ly san xuat (dot 2): danh muc May san xuat gan vao
   Nhan vien, don gia cong doan may RIENG THEO DON HANG (chon o cong doan
   "Ky thuat"), anh theo TUNG mau chinh, 2 cong doan moi "Giao vai" / "Phu
   kien" chen vao luong Ghi tien do (truoc "Cat"), cong doan Cat bo sung
   KG/met da su dung + nhieu nhan vien trai vai (toi da 2 nguoi).
   Additive - KHONG xoa/doi cot cu. Idempotent (IF NOT EXISTS / COL_LENGTH) -
   chay lai an toan. Chay SAU migration_v5_qlsx.sql (va migration_v5_chucnang.sql
   neu co dung phan quyen theo chuc nang).
   ================================================================ */

USE QLNoiBo;
GO

/* ---- 1. Danh muc May san xuat (vd "1 kim", "Vat so") + gan vao Nhan vien ----
   Yeu cau v5.2 muc 2: "gan theo nhan vien de the hien ho ngoi may san xuat nao de tinh luong". */
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'MaySanXuat')
BEGIN
    CREATE TABLE MaySanXuat (
        MaySanXuatID  INT IDENTITY(1,1) PRIMARY KEY,
        TenMay        NVARCHAR(50) NOT NULL UNIQUE,
        GhiChu        NVARCHAR(255) NULL
    );
    INSERT INTO MaySanXuat (TenMay) VALUES (N'1 kim'), (N'Vắt sổ');
    PRINT 'Da tao bang MaySanXuat + du lieu mau (1 kim, Vắt sổ).';
END ELSE PRINT 'Bang MaySanXuat da ton tai, bo qua.';
GO

IF COL_LENGTH('NhanVien', 'MaySanXuatID') IS NULL
BEGIN
    ALTER TABLE NhanVien ADD MaySanXuatID INT NULL FOREIGN KEY REFERENCES MaySanXuat(MaySanXuatID);
    PRINT 'Da them cot NhanVien.MaySanXuatID.';
END ELSE PRINT 'Cot NhanVien.MaySanXuatID da ton tai, bo qua.';
GO

/* ---- 2. Don gia cong doan may RIENG THEO DON HANG (khac DonGiaCongDoanMay - gia mac dinh toan he
   thong) - chon o cong doan "Ky thuat", dung tinh luong theo dung do phuc tap cua tung don hang. ---- */
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'DonHangCongDoanMay')
BEGIN
    CREATE TABLE DonHangCongDoanMay (
        ID             INT IDENTITY(1,1) PRIMARY KEY,
        DonHangID      INT NOT NULL FOREIGN KEY REFERENCES DonHangSanXuat(DonHangID) ON DELETE CASCADE,
        CongDoanMayID  INT NOT NULL FOREIGN KEY REFERENCES CongDoanMay(CongDoanMayID),
        DonGia         DECIMAL(14,2) NOT NULL DEFAULT 0,
        HeSo           DECIMAL(10,4) NOT NULL DEFAULT 1,
        CONSTRAINT UQ_DonHangCongDoanMay UNIQUE (DonHangID, CongDoanMayID)
    );
    PRINT 'Da tao bang DonHangCongDoanMay.';
END ELSE PRINT 'Bang DonHangCongDoanMay da ton tai, bo qua.';
GO

/* ---- 3. Anh theo TUNG mau CHINH trong cau truc vai (moi vai chinh 1 anh) ---- */
IF COL_LENGTH('DonHangChiTietVai', 'AnhMau') IS NULL
BEGIN
    ALTER TABLE DonHangChiTietVai ADD AnhMau NVARCHAR(500) NULL;
    PRINT 'Da them cot DonHangChiTietVai.AnhMau.';
END ELSE PRINT 'Cot DonHangChiTietVai.AnhMau da ton tai, bo qua.';
GO

/* ---- 4. Cong doan moi: "Giao vải" va "Phụ kiện" - chen giua "Kỹ thuật" va "Cắt" ----
   Khong anh huong don hang dang chay o cong doan khac: CongDoanHienTaiID luon tro theo StageID (khong
   doi), chi ThuTu cua CAC CONG DOAN TU "Cắt" tro di duoc +2 de nhuong cho 2 cong doan moi chen vao giua. */
IF NOT EXISTS (SELECT 1 FROM CongDoanSanXuat WHERE TenCongDoan = N'Giao vải')
   AND EXISTS (SELECT 1 FROM CongDoanSanXuat WHERE TenCongDoan = N'Cắt')
BEGIN
    DECLARE @thuTuCat INT = (SELECT ThuTu FROM CongDoanSanXuat WHERE TenCongDoan = N'Cắt');
    UPDATE CongDoanSanXuat SET ThuTu = ThuTu + 2 WHERE ThuTu >= @thuTuCat;
    INSERT INTO CongDoanSanXuat (TenCongDoan, ThuTu) VALUES (N'Giao vải', @thuTuCat), (N'Phụ kiện', @thuTuCat + 1);
    PRINT 'Da them cong doan "Giao vải" va "Phụ kiện" (chen truoc "Cắt").';
END ELSE PRINT 'Cong doan "Giao vải" da ton tai hoac khong tim thay "Cắt" trong CongDoanSanXuat - bo qua (kiem tra lai thu tu cong doan neu can).';
GO

/* ---- 5. Cong doan Cat: cot KG/met da su dung theo tung cay + nhieu nhan vien trai vai (toi da 2 nguoi) ---- */
IF COL_LENGTH('TienDoCatChiTietCay', 'SoKgMetSuDung') IS NULL
BEGIN
    ALTER TABLE TienDoCatChiTietCay ADD SoKgMetSuDung DECIMAL(10,2) NULL;
    PRINT 'Da them cot TienDoCatChiTietCay.SoKgMetSuDung.';
END ELSE PRINT 'Cot TienDoCatChiTietCay.SoKgMetSuDung da ton tai, bo qua.';
GO

-- TienDoSanXuat.NhanVienTraiVaiID (cot don, tu ban v4.0) VAN GIU LAI de tuong thich nguoc (luu nguoi
-- dau tien) - bang duoi day luu DAY DU danh sach (frontend gioi han toi da 2 dong).
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'TienDoTraiVai')
BEGIN
    CREATE TABLE TienDoTraiVai (
        ID          INT IDENTITY(1,1) PRIMARY KEY,
        TienDoID    INT NOT NULL FOREIGN KEY REFERENCES TienDoSanXuat(TienDoID) ON DELETE CASCADE,
        NhanVienID  INT NOT NULL FOREIGN KEY REFERENCES NhanVien(NhanVienID)
    );
    PRINT 'Da tao bang TienDoTraiVai (nhieu nhan vien trai vai / 1 lan ghi tien do).';
END ELSE PRINT 'Bang TienDoTraiVai da ton tai, bo qua.';
GO

/* ---- 6. Seed ChucNang moi (neu da chay migration_v5_chucnang.sql) ---- */
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ChucNang')
BEGIN
    MERGE ChucNang AS t
    USING (VALUES ('DANHMUC','maysanxuat',N'Máy sản xuất',6)) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu)
    ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
    WHEN NOT MATCHED THEN INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu) VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu);
    PRINT 'Da seed ChucNang moi (DANHMUC:maysanxuat).';
END ELSE PRINT 'Bang ChucNang chua ton tai (chua chay migration_v5_chucnang.sql) - bo qua buoc seed, khong anh huong gi.';
GO

PRINT '=== Migration v5.2 (QLSX dot 2) hoan tat. ===';
GO
