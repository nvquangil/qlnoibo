/* ================================================================
   MIGRATION v5.0 — PHASE 2: Quan ly san xuat (Ra lenh san xuat, dinh gia cong doan may,
   giao vai san xuat tam, chi tiet cat theo cay, nha gia cong branching).
   Additive - KHONG xoa/doi cot cu. Idempotent (dung IF NOT EXISTS / MERGE) - chay lai an toan.
   Chay SAU migration_v4.sql va migration_v5_chucnang.sql.
   ================================================================ */

USE QLNoiBo;
GO

/* ---- 1. Bo sung truong cho "Ra lenh san xuat" (tach rieng khoi "Them don hang" cu) ---- */
IF COL_LENGTH('DonHangSanXuat', 'MaSanPham') IS NULL
    ALTER TABLE DonHangSanXuat ADD MaSanPham NVARCHAR(50) NULL;
GO
IF COL_LENGTH('DonHangSanXuat', 'Size') IS NULL
    ALTER TABLE DonHangSanXuat ADD Size NVARCHAR(50) NULL;
GO
IF COL_LENGTH('DonHangSanXuat', 'ThietKeVien') IS NULL
    ALTER TABLE DonHangSanXuat ADD ThietKeVien NVARCHAR(100) NULL;
GO
IF COL_LENGTH('DonHangSanXuat', 'KyThuatRap') IS NULL
    ALTER TABLE DonHangSanXuat ADD KyThuatRap NVARCHAR(100) NULL;
GO
IF COL_LENGTH('DonHangSanXuat', 'DongHinhIn') IS NULL
    ALTER TABLE DonHangSanXuat ADD DongHinhIn NVARCHAR(255) NULL;
GO
IF COL_LENGTH('DonHangSanXuat', 'GhiChuLenh') IS NULL
    ALTER TABLE DonHangSanXuat ADD GhiChuLenh NVARCHAR(500) NULL;
GO

/* ---- 2. Mau phoi nam TRONG mau chinh (thay vi 2 dong roi nhau nhu truoc) ----
   Voi dong Kieu = 'Phoi', MauChinhLienKetID tro ve dong Kieu = 'Chinh' cung DonHangID.
   Dong Kieu = 'Chinh' luon co MauChinhLienKetID = NULL. */
IF COL_LENGTH('DonHangChiTietVai', 'MauChinhLienKetID') IS NULL
    ALTER TABLE DonHangChiTietVai ADD MauChinhLienKetID INT NULL FOREIGN KEY REFERENCES DonHangChiTietVai(ID);
GO

/* ---- 3. Phu kien can dung cho don hang (chi dinh NPL khi Ra lenh san xuat) ----
   Day la BAN GHI CHI DINH/KE HOACH (chua tru kho) - khac voi PhieuPhuKien (giao dich xuat kho thuc te). */
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'DonHangChiTietPhuKien')
BEGIN
    CREATE TABLE DonHangChiTietPhuKien (
        ID          INT IDENTITY(1,1) PRIMARY KEY,
        DonHangID   INT NOT NULL FOREIGN KEY REFERENCES DonHangSanXuat(DonHangID) ON DELETE CASCADE,
        PhuKienID   INT NOT NULL FOREIGN KEY REFERENCES DanhMucPhuKien(PhuKienID),
        SoLuong     DECIMAL(14,2) NOT NULL DEFAULT 0,
        DonVi       NVARCHAR(30) NULL,
        GhiChu      NVARCHAR(255) NULL
    );
    PRINT 'Da tao bang DonHangChiTietPhuKien.';
END ELSE PRINT 'Bang DonHangChiTietPhuKien da ton tai, bo qua.';
GO

/* ---- 4. Ma cong doan (may) chi tiet hon: bo sung Ma cong doan + Bo phan (1 kim/vat so/tu danh) ---- */
IF COL_LENGTH('CongDoanMay', 'MaCongDoan') IS NULL
    ALTER TABLE CongDoanMay ADD MaCongDoan NVARCHAR(30) NULL;
GO
IF COL_LENGTH('CongDoanMay', 'BoPhanMay') IS NULL
    ALTER TABLE CongDoanMay ADD BoPhanMay NVARCHAR(50) NULL;
GO

/* ---- 5. Don gia cong doan may (dung tinh luong cong nhan sau nay) ---- */
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'DonGiaCongDoanMay')
BEGIN
    CREATE TABLE DonGiaCongDoanMay (
        ID             INT IDENTITY(1,1) PRIMARY KEY,
        CongDoanMayID  INT NOT NULL UNIQUE FOREIGN KEY REFERENCES CongDoanMay(CongDoanMayID) ON DELETE CASCADE,
        DonGia         DECIMAL(14,2) NOT NULL DEFAULT 0,
        HeSo           DECIMAL(10,4) NOT NULL DEFAULT 1,
        UpdatedAt      DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    PRINT 'Da tao bang DonGiaCongDoanMay.';
END ELSE PRINT 'Bang DonGiaCongDoanMay da ton tai, bo qua.';
GO

/* ---- 6. Giao vai san xuat TAM (chua tru The kho vai - chi la du kien cap cho don hang) ----
   Kho vai (phan he Kho vai) van la noi TRU KHO THUC (PhieuXuatVai) - xem migration Phase 3.
   Bang nay dung de: (a) QLSX chon truoc cac cay se cap cho don hang; (b) cong doan Cat lay danh
   sach cay nay de ghi SL lop/he so quy doi theo tung cay; (c) Phase 3: Kho vai xuat kho gan don
   hang se chi cho chon trong danh sach cay da "giao tam" o day. */
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'GiaoVaiSanXuat')
BEGIN
    CREATE TABLE GiaoVaiSanXuat (
        ID          INT IDENTITY(1,1) PRIMARY KEY,
        DonHangID   INT NOT NULL FOREIGN KEY REFERENCES DonHangSanXuat(DonHangID) ON DELETE CASCADE,
        CayID       INT NOT NULL FOREIGN KEY REFERENCES VaiCay(CayID),
        KGGiao      DECIMAL(10,2) NOT NULL DEFAULT 0,
        NgayGiao    DATE NOT NULL,
        GhiChu      NVARCHAR(255) NULL,
        NguoiTaoID  INT NULL FOREIGN KEY REFERENCES Users(UserID),
        CreatedAt   DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    PRINT 'Da tao bang GiaoVaiSanXuat.';
END ELSE PRINT 'Bang GiaoVaiSanXuat da ton tai, bo qua.';
GO

/* ---- 7. Chi tiet cong doan Cat theo TUNG CAY vai (STT cay A/B/C, SL lop, he so quy doi) ----
   SoLuongCai tinh tu = SoLuongLop * HeSoQuyDoi. Mau cua cay lay qua VaiCay -> DanhMucVai.MauSacID,
   dung de cong don ve TienDoChiTietMau (theo mau chinh) nhu truoc - khong pha vo pipeline bao cao
   nang suat / "SL tong tu Cat" dang dung o cong doan Kho nhap (xem routes/qlsx.js). */
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'TienDoCatChiTietCay')
BEGIN
    CREATE TABLE TienDoCatChiTietCay (
        ID              INT IDENTITY(1,1) PRIMARY KEY,
        TienDoID        INT NOT NULL FOREIGN KEY REFERENCES TienDoSanXuat(TienDoID) ON DELETE CASCADE,
        CayID           INT NOT NULL FOREIGN KEY REFERENCES VaiCay(CayID),
        SttCay          NVARCHAR(10) NULL,
        SoLuongLop      INT NOT NULL DEFAULT 0,
        HeSoQuyDoi      DECIMAL(10,3) NOT NULL DEFAULT 1
    );
    ALTER TABLE TienDoCatChiTietCay ADD SoLuongCai AS (SoLuongLop * HeSoQuyDoi) PERSISTED;
    PRINT 'Da tao bang TienDoCatChiTietCay.';
END ELSE PRINT 'Bang TienDoCatChiTietCay da ton tai, bo qua.';
GO

/* ---- 8. Seed ChucNang moi cho QLSX (Ra lenh san xuat / Don gia cong doan may) ----
   Idempotent - neu chua chay migration_v5_chucnang.sql thi bang ChucNang chua ton tai, bo qua an toan. */
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ChucNang')
BEGIN
    MERGE ChucNang AS t
    USING (VALUES
        ('QLSX','ralenh',N'Ra lệnh sản xuất',3),
        ('QLSX','dongiamay',N'Đơn giá công đoạn may',4)
    ) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu)
    ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
    WHEN NOT MATCHED THEN
        INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu) VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu);
    PRINT 'Da seed ChucNang moi cho QLSX (ralenh, dongiamay).';
END ELSE PRINT 'Bang ChucNang chua ton tai (chua chay migration_v5_chucnang.sql) - bo qua buoc seed nay, khong anh huong gi.';
GO

PRINT '=== Migration v5.0 Phase 2 (QLSX) hoan tat. ===';
GO
