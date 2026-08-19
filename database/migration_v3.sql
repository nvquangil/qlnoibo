/* ================================================================
   MIGRATION v2.0 -> v3.0
   Chi can chay file nay neu ban DA cai dat schema.sql v1.0 hoac v2.0 va co du
   lieu that. Neu dang cai dat lan dau, KHONG can chay file nay va migration_v2.sql
   — schema.sql (v3.0) da bao gom san toan bo thay doi duoi day.

   Neu ban dang nang cap tu v1.0 (chua tung chay migration_v2.sql): chay
   migration_v2.sql TRUOC, roi chay file nay.

   Noi dung: them phan he Phu kien (bang LoaiPhuKien, DanhMucPhuKien,
   PhieuPhuKien, PhieuPhuKienChiTiet, view vw_TonKhoPhuKien), dang ky module
   PHUKIEN va cap quyen mac dinh cho cac nhom da co. Khong dung/xoa du lieu da co.
   ================================================================ */

USE QLNoiBo;
GO

IF OBJECT_ID('LoaiPhuKien') IS NULL
BEGIN
    CREATE TABLE LoaiPhuKien (
        LoaiPhuKienID  INT IDENTITY(1,1) PRIMARY KEY,
        TenLoai        NVARCHAR(100) NOT NULL UNIQUE
    );
    PRINT 'Da tao bang LoaiPhuKien.';
END
ELSE PRINT 'Bang LoaiPhuKien da ton tai, bo qua.';
GO

IF OBJECT_ID('DanhMucPhuKien') IS NULL
BEGIN
    CREATE TABLE DanhMucPhuKien (
        PhuKienID      INT IDENTITY(1,1) PRIMARY KEY,
        MaPhuKien      NVARCHAR(50) NOT NULL UNIQUE,
        TenPhuKien     NVARCHAR(150) NOT NULL,
        LoaiPhuKienID  INT NULL FOREIGN KEY REFERENCES LoaiPhuKien(LoaiPhuKienID),
        Size           NVARCHAR(30) NULL,
        DonViCoBan     NVARCHAR(30) NOT NULL,
        DonViQuyDoi    NVARCHAR(30) NULL,
        TyLeQuyDoi     DECIMAL(12,4) NULL,
        GhiChu         NVARCHAR(255) NULL
    );
    PRINT 'Da tao bang DanhMucPhuKien.';
END
ELSE PRINT 'Bang DanhMucPhuKien da ton tai, bo qua.';
GO

IF OBJECT_ID('PhieuPhuKien') IS NULL
BEGIN
    CREATE TABLE PhieuPhuKien (
        PhieuID      INT IDENTITY(1,1) PRIMARY KEY,
        Ngay         DATE NOT NULL,
        LoaiPhieu    NVARCHAR(10) NOT NULL CHECK (LoaiPhieu IN (N'Nhập', N'Xuất')),
        MaDon        NVARCHAR(30) NULL,
        DonHangID    INT NULL FOREIGN KEY REFERENCES DonHangSanXuat(DonHangID),
        GhiChu       NVARCHAR(255) NULL,
        NguoiTaoID   INT NULL FOREIGN KEY REFERENCES Users(UserID),
        CreatedAt    DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    PRINT 'Da tao bang PhieuPhuKien.';
END
ELSE PRINT 'Bang PhieuPhuKien da ton tai, bo qua.';
GO

IF OBJECT_ID('PhieuPhuKienChiTiet') IS NULL
BEGIN
    CREATE TABLE PhieuPhuKienChiTiet (
        ID           INT IDENTITY(1,1) PRIMARY KEY,
        PhieuID      INT NOT NULL FOREIGN KEY REFERENCES PhieuPhuKien(PhieuID) ON DELETE CASCADE,
        PhuKienID    INT NOT NULL FOREIGN KEY REFERENCES DanhMucPhuKien(PhuKienID),
        SoLuong      DECIMAL(14,2) NOT NULL,
        DonVi        NVARCHAR(30) NULL,
        GhiChu       NVARCHAR(255) NULL
    );
    PRINT 'Da tao bang PhieuPhuKienChiTiet.';
END
ELSE PRINT 'Bang PhieuPhuKienChiTiet da ton tai, bo qua.';
GO

IF OBJECT_ID('vw_TonKhoPhuKien') IS NULL
BEGIN
    EXEC('CREATE VIEW vw_TonKhoPhuKien AS
    SELECT
        dm.PhuKienID, dm.MaPhuKien, dm.TenPhuKien, lpk.TenLoai, dm.Size, dm.DonViCoBan,
        ISNULL(SUM(CASE WHEN p.LoaiPhieu = N''Nhập'' THEN ct.SoLuong ELSE 0 END), 0) AS TongNhap,
        ISNULL(SUM(CASE WHEN p.LoaiPhieu = N''Xuất'' THEN ct.SoLuong ELSE 0 END), 0) AS TongXuat,
        ISNULL(SUM(CASE WHEN p.LoaiPhieu = N''Nhập'' THEN ct.SoLuong ELSE -ct.SoLuong END), 0) AS TonKho
    FROM DanhMucPhuKien dm
    LEFT JOIN LoaiPhuKien lpk ON lpk.LoaiPhuKienID = dm.LoaiPhuKienID
    LEFT JOIN PhieuPhuKienChiTiet ct ON ct.PhuKienID = dm.PhuKienID
    LEFT JOIN PhieuPhuKien p ON p.PhieuID = ct.PhieuID
    GROUP BY dm.PhuKienID, dm.MaPhuKien, dm.TenPhuKien, lpk.TenLoai, dm.Size, dm.DonViCoBan');
    PRINT 'Da tao view vw_TonKhoPhuKien.';
END
ELSE PRINT 'View vw_TonKhoPhuKien da ton tai, bo qua.';
GO

IF NOT EXISTS (SELECT 1 FROM Modules WHERE ModuleCode = 'PHUKIEN')
BEGIN
    INSERT INTO Modules (ModuleCode, TenModule, ThuTu) VALUES (N'PHUKIEN', N'Quản lý phụ kiện', 6);
    PRINT 'Da dang ky module PHUKIEN.';

    -- Cap quyen Xem mac dinh cho toan bo nhom hien co (tru Admin, vi Admin da toan quyen)
    INSERT INTO Permissions (GroupID, ModuleID, CanView, CanCreate, CanEdit, CanDelete)
    SELECT g.GroupID, m.ModuleID, 1, 0, 0, 0
    FROM Groups g CROSS JOIN Modules m
    WHERE g.TenNhom <> N'Admin' AND m.ModuleCode = 'PHUKIEN';

    -- Neu co san nhom 'Kho', cap them quyen Them/Sua (giong quyen nhom nay dang co tren KHOVAI/KHOHANG)
    UPDATE p SET CanCreate = 1, CanEdit = 1
    FROM Permissions p
    JOIN Groups g ON g.GroupID = p.GroupID
    JOIN Modules m ON m.ModuleID = p.ModuleID
    WHERE g.TenNhom = N'Kho' AND m.ModuleCode = 'PHUKIEN';

    PRINT 'Da cap quyen Xem mac dinh cho cac nhom hien co tren module PHUKIEN (nhom Kho duoc them quyen Them/Sua). Vao Quan ly User -> Ma tran phan quyen de dieu chinh lai neu can.';
END
ELSE PRINT 'Module PHUKIEN da duoc dang ky, bo qua.';
GO

IF NOT EXISTS (SELECT 1 FROM LoaiPhuKien)
BEGIN
    INSERT INTO LoaiPhuKien (TenLoai) VALUES (N'Dây cổ'), (N'Mác Áo'), (N'Mác Quần'), (N'Chun'), (N'Thẻ bài');
    PRINT 'Da them du lieu mau cho LoaiPhuKien.';
END
ELSE PRINT 'LoaiPhuKien da co du lieu, bo qua du lieu mau.';
GO
