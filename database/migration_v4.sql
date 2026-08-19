/* ================================================================
   MIGRATION v3.0 -> v4.0
   Chi can chay file nay neu ban DA cai dat schema.sql v1.0/v2.0/v3.0 va co du
   lieu that. Neu dang cai dat lan dau, KHONG can chay file nay va cac migration
   truoc do — schema.sql (v4.0) da bao gom san toan bo thay doi duoi day.

   Neu ban dang nang cap tu ban cu hon: chay migration_v2.sql -> migration_v3.sql
   -> file nay theo dung thu tu.

   Noi dung v4.0:
   - Danh muc moi: DanhMucDonViTinh, CongDoanMay, NhanVien (dung cho form nhap
     lieu chon theo danh muc va cho bang luong/cham cong sau nay).
   - Thong bao trong he thong (ThongBao): bao cho nhan vien khi don hang chuyen
     sang cong doan thuoc pham vi phu trach cua ho.
   - Cong doan Cat: chi tiet mau phu theo mau chinh (TienDoChiTietMauPhu) +
     nhan vien trai vai / nhan vien cat (them cot tren TienDoSanXuat).
   - Cong doan May: giao viec noi bo theo nhan vien - cong doan may - mau - SL
     khi nha gia cong la "Nha Lam" (PhanCongMay).
   - Kho vai: don gia nhap theo cay (VaiCay.DonGiaNhap).
   - The kho hang hoa: phan loai Nha san xuat / Dat ngoai, lien ket don hang
     san xuat, nhan lai don vi tinh chinh/quy doi cho tong quat hoa (khong doi
     cong thuc LoaiRi dang dung).
   - Phu kien: phieu Nhap co the gan Nha cung cap + So hoa don.
   - Phan quyen: nhom "Kho" duoc them CanEdit tren module QLSX (de cap nhat
     duoc cong doan "Kho nhap").
   Idempotent — chay lai nhieu lan khong loi, khong dung/xoa du lieu cu.
   ================================================================ */

USE QLNoiBo;
GO

/* ---------- 1. Danh muc Don vi tinh (dung cho dropdown DVT trong don hang) ---------- */
IF OBJECT_ID('DanhMucDonViTinh') IS NULL
BEGIN
    CREATE TABLE DanhMucDonViTinh (
        DonViTinhID  INT IDENTITY(1,1) PRIMARY KEY,
        TenDonVi     NVARCHAR(30) NOT NULL UNIQUE,
        GhiChu       NVARCHAR(255) NULL
    );
    PRINT 'Da tao bang DanhMucDonViTinh.';
END ELSE PRINT 'Bang DanhMucDonViTinh da ton tai, bo qua.';
GO

IF NOT EXISTS (SELECT 1 FROM DanhMucDonViTinh)
BEGIN
    INSERT INTO DanhMucDonViTinh (TenDonVi) VALUES (N'Cái'), (N'Bộ'), (N'Mét'), (N'Kg'), (N'Cuộn'), (N'Ri'), (N'Chiếc');
    PRINT 'Da them du lieu mau cho DanhMucDonViTinh.';
END ELSE PRINT 'DanhMucDonViTinh da co du lieu, bo qua du lieu mau.';
GO

/* ---------- 2. Danh muc Cong doan may (khac Cong doan san xuat: dung cho giao viec/luong) ---------- */
IF OBJECT_ID('CongDoanMay') IS NULL
BEGIN
    CREATE TABLE CongDoanMay (
        CongDoanMayID  INT IDENTITY(1,1) PRIMARY KEY,
        TenCongDoan    NVARCHAR(100) NOT NULL UNIQUE,
        GhiChu         NVARCHAR(255) NULL
    );
    PRINT 'Da tao bang CongDoanMay.';
END ELSE PRINT 'Bang CongDoanMay da ton tai, bo qua.';
GO

IF NOT EXISTS (SELECT 1 FROM CongDoanMay)
BEGIN
    INSERT INTO CongDoanMay (TenCongDoan) VALUES
    (N'May cổ'), (N'May tay'), (N'May thân'), (N'Vắt sổ'), (N'Tra khóa'), (N'Đính nút'), (N'May lai'), (N'Ủi hoàn thiện');
    PRINT 'Da them du lieu mau cho CongDoanMay.';
END ELSE PRINT 'CongDoanMay da co du lieu, bo qua du lieu mau.';
GO

/* ---------- 3. Danh muc Nhan vien (danh sach cong nhan theo bo phan, dung cho giao viec + luong/cham cong) ---------- */
IF OBJECT_ID('NhanVien') IS NULL
BEGIN
    CREATE TABLE NhanVien (
        NhanVienID   INT IDENTITY(1,1) PRIMARY KEY,
        HoTen        NVARCHAR(100) NOT NULL,
        MaNhanVien   NVARCHAR(30) NULL UNIQUE,
        BoPhanID     INT NULL FOREIGN KEY REFERENCES BoPhan(BoPhanID),
        SDT          NVARCHAR(30) NULL,
        NgayVao      DATE NULL,
        TrangThai    NVARCHAR(20) NOT NULL DEFAULT N'Đang làm' CHECK (TrangThai IN (N'Đang làm', N'Đã nghỉ')),
        GhiChu       NVARCHAR(255) NULL
    );
    PRINT 'Da tao bang NhanVien.';
END ELSE PRINT 'Bang NhanVien da ton tai, bo qua.';
GO

/* ---------- 4. Thong bao he thong (bao tien do don hang moi cho dung bo phan) ---------- */
IF OBJECT_ID('ThongBao') IS NULL
BEGIN
    CREATE TABLE ThongBao (
        NotificationID  INT IDENTITY(1,1) PRIMARY KEY,
        UserID          INT NOT NULL FOREIGN KEY REFERENCES Users(UserID) ON DELETE CASCADE,
        DonHangID       INT NULL FOREIGN KEY REFERENCES DonHangSanXuat(DonHangID),
        NoiDung         NVARCHAR(500) NOT NULL,
        DaDoc           BIT NOT NULL DEFAULT 0,
        CreatedAt       DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    CREATE INDEX IX_ThongBao_UserID ON ThongBao(UserID, DaDoc);
    PRINT 'Da tao bang ThongBao.';
END ELSE PRINT 'Bang ThongBao da ton tai, bo qua.';
GO

/* ---------- 5. Cong doan Cat: nhan vien trai vai / nhan vien cat ---------- */
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('TienDoSanXuat') AND name = 'NhanVienTraiVaiID')
BEGIN
    ALTER TABLE TienDoSanXuat ADD NhanVienTraiVaiID INT NULL;
    ALTER TABLE TienDoSanXuat ADD CONSTRAINT FK_TienDo_NVTraiVai FOREIGN KEY (NhanVienTraiVaiID) REFERENCES NhanVien(NhanVienID);
    PRINT 'Da them cot TienDoSanXuat.NhanVienTraiVaiID.';
END ELSE PRINT 'Cot TienDoSanXuat.NhanVienTraiVaiID da ton tai, bo qua.';
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('TienDoSanXuat') AND name = 'NhanVienCatID')
BEGIN
    ALTER TABLE TienDoSanXuat ADD NhanVienCatID INT NULL;
    ALTER TABLE TienDoSanXuat ADD CONSTRAINT FK_TienDo_NVCat FOREIGN KEY (NhanVienCatID) REFERENCES NhanVien(NhanVienID);
    PRINT 'Da them cot TienDoSanXuat.NhanVienCatID.';
END ELSE PRINT 'Cot TienDoSanXuat.NhanVienCatID da ton tai, bo qua.';
GO

/* ---------- 6. Chi tiet mau phu theo mau chinh (rieng cong doan Cat) ---------- */
IF OBJECT_ID('TienDoChiTietMauPhu') IS NULL
BEGIN
    CREATE TABLE TienDoChiTietMauPhu (
        ID                    INT IDENTITY(1,1) PRIMARY KEY,
        TienDoChiTietMauID    INT NOT NULL FOREIGN KEY REFERENCES TienDoChiTietMau(ID) ON DELETE CASCADE,
        TenMauPhu             NVARCHAR(50) NULL,
        SoLuong               INT NOT NULL DEFAULT 0
    );
    PRINT 'Da tao bang TienDoChiTietMauPhu.';
END ELSE PRINT 'Bang TienDoChiTietMauPhu da ton tai, bo qua.';
GO

/* ---------- 7. Giao viec may noi bo (khi Nha gia cong = "Nha Lam") ---------- */
IF OBJECT_ID('PhanCongMay') IS NULL
BEGIN
    CREATE TABLE PhanCongMay (
        ID             INT IDENTITY(1,1) PRIMARY KEY,
        TienDoID       INT NOT NULL FOREIGN KEY REFERENCES TienDoSanXuat(TienDoID) ON DELETE CASCADE,
        NhanVienID     INT NOT NULL FOREIGN KEY REFERENCES NhanVien(NhanVienID),
        CongDoanMayID  INT NULL FOREIGN KEY REFERENCES CongDoanMay(CongDoanMayID),
        MauSacID       INT NOT NULL FOREIGN KEY REFERENCES MauSac(MauSacID),
        SoLuong        INT NOT NULL DEFAULT 0
    );
    PRINT 'Da tao bang PhanCongMay.';
END ELSE PRINT 'Bang PhanCongMay da ton tai, bo qua.';
GO

/* ---------- 8. Kho vai: don gia nhap theo cay ---------- */
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('VaiCay') AND name = 'DonGiaNhap')
BEGIN
    ALTER TABLE VaiCay ADD DonGiaNhap DECIMAL(14,2) NULL;
    PRINT 'Da them cot VaiCay.DonGiaNhap.';
END ELSE PRINT 'Cot VaiCay.DonGiaNhap da ton tai, bo qua.';
GO

/* ---------- 9. The kho hang hoa: loai hang (Nha san xuat / Dat ngoai) + lien ket don hang + nhan don vi ---------- */
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('TheKhoHangHoa') AND name = 'LoaiHang')
BEGIN
    ALTER TABLE TheKhoHangHoa ADD LoaiHang NVARCHAR(20) NOT NULL
        CONSTRAINT DF_TheKho_LoaiHang DEFAULT N'DatNgoai'
        CONSTRAINT CK_TheKho_LoaiHang CHECK (LoaiHang IN (N'NhaSanXuat', N'DatNgoai'));
    PRINT 'Da them cot TheKhoHangHoa.LoaiHang.';
END ELSE PRINT 'Cot TheKhoHangHoa.LoaiHang da ton tai, bo qua.';
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('TheKhoHangHoa') AND name = 'DonHangID')
BEGIN
    ALTER TABLE TheKhoHangHoa ADD DonHangID INT NULL;
    ALTER TABLE TheKhoHangHoa ADD CONSTRAINT FK_TheKho_DonHang FOREIGN KEY (DonHangID) REFERENCES DonHangSanXuat(DonHangID);
    PRINT 'Da them cot TheKhoHangHoa.DonHangID.';
END ELSE PRINT 'Cot TheKhoHangHoa.DonHangID da ton tai, bo qua.';
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('TheKhoHangHoa') AND name = 'DonViCoBan')
BEGIN
    ALTER TABLE TheKhoHangHoa ADD DonViCoBan NVARCHAR(30) NOT NULL CONSTRAINT DF_TheKho_DonViCoBan DEFAULT N'Cái';
    PRINT 'Da them cot TheKhoHangHoa.DonViCoBan.';
END ELSE PRINT 'Cot TheKhoHangHoa.DonViCoBan da ton tai, bo qua.';
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('TheKhoHangHoa') AND name = 'DonViQuyDoi')
BEGIN
    ALTER TABLE TheKhoHangHoa ADD DonViQuyDoi NVARCHAR(30) NOT NULL CONSTRAINT DF_TheKho_DonViQuyDoi DEFAULT N'Ri';
    PRINT 'Da them cot TheKhoHangHoa.DonViQuyDoi.';
END ELSE PRINT 'Cot TheKhoHangHoa.DonViQuyDoi da ton tai, bo qua.';
GO

/* ---------- 10. Phu kien: phieu Nhap gan Nha cung cap + So hoa don ---------- */
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('PhieuPhuKien') AND name = 'NCC_ID')
BEGIN
    ALTER TABLE PhieuPhuKien ADD NCC_ID INT NULL;
    ALTER TABLE PhieuPhuKien ADD CONSTRAINT FK_PhieuPhuKien_NCC FOREIGN KEY (NCC_ID) REFERENCES NhaCungCap(NCC_ID);
    PRINT 'Da them cot PhieuPhuKien.NCC_ID.';
END ELSE PRINT 'Cot PhieuPhuKien.NCC_ID da ton tai, bo qua.';
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('PhieuPhuKien') AND name = 'SoHoaDon')
BEGIN
    ALTER TABLE PhieuPhuKien ADD SoHoaDon NVARCHAR(50) NULL;
    PRINT 'Da them cot PhieuPhuKien.SoHoaDon.';
END ELSE PRINT 'Cot PhieuPhuKien.SoHoaDon da ton tai, bo qua.';
GO

/* ---------- 11. Phan quyen: nhom Kho duoc CanEdit tren QLSX (de cap nhat cong doan "Kho nhap") ---------- */
UPDATE p SET CanEdit = 1
FROM Permissions p
JOIN Groups g ON g.GroupID = p.GroupID
JOIN Modules m ON m.ModuleID = p.ModuleID
WHERE g.TenNhom = N'Kho' AND m.ModuleCode = N'QLSX' AND p.CanEdit = 0;
GO

PRINT 'Hoan tat migration_v4.sql.';
GO
