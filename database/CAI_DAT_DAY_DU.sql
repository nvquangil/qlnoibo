/* ================================================================================================
   QLNoiBo - FILE CAI DAT DAY DU
   Sinh tu dong luc 2026-08-19 05:27:13 boi: node tao_file_cai_dat.js
   Gom: schema.sql + 80 file migration, theo dung thu tu chay.

   ⚠️ KHONG SUA TAY FILE NAY. Sua thi lan sinh sau se mat. Sua o file goc roi sinh lai.

   CACH DUNG - MAY MOI:
     1. Trong SSMS chay truoc:   CREATE DATABASE QLNoiBo;
     2. Mo file nay, chon dung database QLNoiBo o thanh cong cu, bam Execute (F5).
     3. Doc ket qua o tab Messages - moi buoc deu in ra da tao gi / da co san gi.

   ⚠️ TUYET DOI KHONG chay file nay len CSDL DANG CHAY THAT.
      Cac lenh deu viet kieu "IF chua co THI tao" nen phan lon vo hai, nhung "phan lon" khong phai
      "chac chan". May dang chay muon nang cap thi dung:  node chay_migration.js
   ================================================================================================ */


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [ 1/81]  schema.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [1/81] schema.sql';
GO

/* ================================================================
   HE THONG QUAN LY NOI BO - UNIFIED DATABASE (MICROSOFT SQL SERVER)
   Gop 4 he thong rieng le: Quan ly san xuat, Kho vai, The kho hang hoa, Phu kien
   Phien ban schema: 4.0 (bo sung: danh muc Don vi tinh / Cong doan may / Nhan
   vien; Thong bao trong he thong; chi tiet mau phu + nhan vien trai vai/cat
   cho cong doan Cat; giao viec may noi bo cho cong doan May; don gia nhap
   theo cay vai; phan loai The kho hang hoa Nha san xuat/Dat ngoai + lien ket
   don hang; Phieu phu kien Nhap gan Nha cung cap/So hoa don.
   Neu nang cap tu ban cu: chay migration_v2.sql -> migration_v3.sql ->
   migration_v4.sql theo thu tu, xem HUONG_DAN_CAI_DAT.md Buoc 2.1 / 2.2 / 2.3)
   ================================================================ */

IF DB_ID('QLNoiBo') IS NULL
BEGIN
    CREATE DATABASE QLNoiBo;
END
GO

USE QLNoiBo;
GO

/* ============================================================
   1. BO PHAN / PHONG BAN
   ============================================================ */
CREATE TABLE BoPhan (
    BoPhanID    INT IDENTITY(1,1) PRIMARY KEY,
    TenBoPhan   NVARCHAR(100) NOT NULL UNIQUE,
    GhiChu      NVARCHAR(255) NULL
);
GO

/* ============================================================
   2. NHOM QUYEN (GROUPS) + PHAN QUYEN THEO PHAN HE (MODULE)
   ============================================================ */
CREATE TABLE Groups (
    GroupID     INT IDENTITY(1,1) PRIMARY KEY,
    TenNhom     NVARCHAR(100) NOT NULL UNIQUE,
    MoTa        NVARCHAR(255) NULL,
    IsAdmin     BIT NOT NULL DEFAULT 0      -- IsAdmin = 1 => toan quyen tren moi phan he, bo qua bang Permissions
);
GO

CREATE TABLE Modules (
    ModuleID    INT IDENTITY(1,1) PRIMARY KEY,
    ModuleCode  NVARCHAR(30) NOT NULL UNIQUE,   -- DANHMUC, USERS, QLSX, KHOVAI, KHOHANG, PHUKIEN
    TenModule   NVARCHAR(100) NOT NULL,
    ThuTu       INT NOT NULL DEFAULT 0
);
GO

CREATE TABLE Permissions (
    PermissionID INT IDENTITY(1,1) PRIMARY KEY,
    GroupID      INT NOT NULL FOREIGN KEY REFERENCES Groups(GroupID) ON DELETE CASCADE,
    ModuleID     INT NOT NULL FOREIGN KEY REFERENCES Modules(ModuleID) ON DELETE CASCADE,
    CanView      BIT NOT NULL DEFAULT 0,
    CanCreate    BIT NOT NULL DEFAULT 0,
    CanEdit      BIT NOT NULL DEFAULT 0,
    CanDelete    BIT NOT NULL DEFAULT 0,
    CONSTRAINT UQ_Permissions UNIQUE (GroupID, ModuleID)
);
GO

/* ============================================================
   3. NGUOI DUNG (USERS) - thay the 3 sheet TaiKhoan/Phan Quyen/USERS rieng le
   ============================================================ */
CREATE TABLE Users (
    UserID        INT IDENTITY(1,1) PRIMARY KEY,
    Username      NVARCHAR(50) NOT NULL UNIQUE,
    PasswordHash  NVARCHAR(255) NOT NULL,
    HoTen         NVARCHAR(100) NOT NULL,
    Email         NVARCHAR(100) NULL,
    BoPhanID      INT NULL FOREIGN KEY REFERENCES BoPhan(BoPhanID),
    IsActive      BIT NOT NULL DEFAULT 1,
    CreatedAt     DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    UpdatedAt     DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO

CREATE TABLE UserGroups (
    UserID   INT NOT NULL FOREIGN KEY REFERENCES Users(UserID) ON DELETE CASCADE,
    GroupID  INT NOT NULL FOREIGN KEY REFERENCES Groups(GroupID) ON DELETE CASCADE,
    PRIMARY KEY (UserID, GroupID)
);
GO

/* ============================================================
   4. CONG DOAN SAN XUAT (thu tu co dinh) + PHAN QUYEN CONG DOAN THEO USER
   ============================================================ */
CREATE TABLE CongDoanSanXuat (
    StageID       INT IDENTITY(1,1) PRIMARY KEY,
    TenCongDoan   NVARCHAR(100) NOT NULL UNIQUE,
    ThuTu         INT NOT NULL
);
GO

CREATE TABLE UserCongDoan (
    UserID   INT NOT NULL FOREIGN KEY REFERENCES Users(UserID) ON DELETE CASCADE,
    StageID  INT NOT NULL FOREIGN KEY REFERENCES CongDoanSanXuat(StageID) ON DELETE CASCADE,
    PRIMARY KEY (UserID, StageID)
);
GO

/* ============================================================
   5. DANH MUC DUNG CHUNG
   ============================================================ */
CREATE TABLE LoaiVai (
    LoaiVaiID    INT IDENTITY(1,1) PRIMARY KEY,
    TenLoaiVai   NVARCHAR(100) NOT NULL UNIQUE,
    MaLoai       NVARCHAR(50) NULL
);
GO

CREATE TABLE MauSac (
    MauSacID  INT IDENTITY(1,1) PRIMARY KEY,
    MaMau     NVARCHAR(30) NOT NULL UNIQUE,
    TenMau    NVARCHAR(100) NOT NULL
);
GO

CREATE TABLE DanhMucVai (
    VaiID          INT IDENTITY(1,1) PRIMARY KEY,
    MaVai          NVARCHAR(50) NOT NULL UNIQUE,
    LoaiVaiID      INT NOT NULL FOREIGN KEY REFERENCES LoaiVai(LoaiVaiID),
    MauSacID       INT NOT NULL FOREIGN KEY REFERENCES MauSac(MauSacID),
    KhoVai         DECIMAL(10,2) NULL,
    GSM            DECIMAL(10,2) NULL,
    ViTriKho       NVARCHAR(50) NULL,
    TonToiThieuKG  DECIMAL(10,2) NULL,
    MaPM           NVARCHAR(50) NULL,   -- Ma phan mem: ma tham chieu noi bo/he thong khac (v4.0)
    GhiChu         NVARCHAR(255) NULL
);
GO

CREATE TABLE PhuLieu (
    PhuLieuID     INT IDENTITY(1,1) PRIMARY KEY,
    LoaiPhuLieu   NVARCHAR(30) NOT NULL CHECK (LoaiPhuLieu IN (N'The bai', N'Mac', N'Chun', N'Tui bong', N'Khac')),
    MaPhuLieu     NVARCHAR(50) NOT NULL UNIQUE,
    TenPhuLieu    NVARCHAR(150) NOT NULL,
    DonViTinh     NVARCHAR(30) NULL,
    GhiChu        NVARCHAR(255) NULL
);
GO

CREATE TABLE NhaGiaCong (
    NhaGiaCongID  INT IDENTITY(1,1) PRIMARY KEY,
    TenNha        NVARCHAR(150) NOT NULL,
    LoaiHinh      NVARCHAR(20) NOT NULL CHECK (LoaiHinh IN (N'GiaCong', N'InTheu')),
    DiaChi        NVARCHAR(255) NULL,
    SDT           NVARCHAR(30) NULL,
    GhiChu        NVARCHAR(255) NULL
);
GO

CREATE TABLE NhaCungCap (
    NCC_ID    INT IDENTITY(1,1) PRIMARY KEY,
    TenNCC    NVARCHAR(150) NOT NULL,
    DiaChi    NVARCHAR(255) NULL,
    SDT       NVARCHAR(30) NULL,
    MaSoThue  NVARCHAR(30) NULL,
    GhiChu    NVARCHAR(255) NULL
);
GO

CREATE TABLE KhachHang (
    KhachHangID    INT IDENTITY(1,1) PRIMARY KEY,
    TenKhachHang   NVARCHAR(150) NOT NULL,
    DiaChi         NVARCHAR(255) NULL,
    SDT            NVARCHAR(30) NULL,
    Email          NVARCHAR(100) NULL,
    GhiChu         NVARCHAR(255) NULL
);
GO

CREATE TABLE TheKhoDanhMuc (
    TheKhoDanhMucID  INT IDENTITY(1,1) PRIMARY KEY,
    TenTheKho        NVARCHAR(100) NOT NULL UNIQUE
);
GO

/* ============================================================
   5b. DANH MUC MOI (v4.0): Don vi tinh / Cong doan may / Nhan vien
   Dung cho dropdown don vi tinh trong don hang, giao viec cong doan May,
   va lam nen cho bang luong/cham cong sau nay (chua tinh don gia/luong o
   ban 4.0 nay - chi co danh muc + ghi nhan giao viec).
   ============================================================ */
CREATE TABLE DanhMucDonViTinh (
    DonViTinhID  INT IDENTITY(1,1) PRIMARY KEY,
    TenDonVi     NVARCHAR(30) NOT NULL UNIQUE,
    GhiChu       NVARCHAR(255) NULL
);
GO

CREATE TABLE CongDoanMay (
    CongDoanMayID  INT IDENTITY(1,1) PRIMARY KEY,
    TenCongDoan    NVARCHAR(100) NOT NULL UNIQUE,
    GhiChu         NVARCHAR(255) NULL
);
GO

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
GO

/* ============================================================
   6. QUAN LY SAN XUAT
   ============================================================ */
CREATE TABLE DonHangSanXuat (
    DonHangID          INT IDENTITY(1,1) PRIMARY KEY,
    MaDH               NVARCHAR(30) NOT NULL UNIQUE,
    TenSanPham         NVARCHAR(150) NOT NULL,
    KhachHangID        INT NULL FOREIGN KEY REFERENCES KhachHang(KhachHangID),
    NgayDat            DATE NULL,
    NgayGiaoDuKien     DATE NULL,
    TongSoLuong        INT NOT NULL DEFAULT 0,
    CongDoanHienTaiID  INT NULL FOREIGN KEY REFERENCES CongDoanSanXuat(StageID),
    PhanTramHoanThanh  INT NOT NULL DEFAULT 0,
    TrangThai          NVARCHAR(30) NOT NULL DEFAULT N'Chưa bắt đầu',
    AnhSanPham         NVARCHAR(500) NULL,
    NhaGiaCongID       INT NULL FOREIGN KEY REFERENCES NhaGiaCong(NhaGiaCongID),
    NgayGiaoGC         DATE NULL,
    NgayNhanGC         DATE NULL,
    NhaInID            INT NULL FOREIGN KEY REFERENCES NhaGiaCong(NhaGiaCongID),
    NgayGiaoIn         DATE NULL,
    NgayNhanIn         DATE NULL,
    CreatedAt          DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    UpdatedAt          DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO
ALTER TABLE DonHangSanXuat ADD SoNgayGC AS (CASE WHEN NgayGiaoGC IS NOT NULL AND NgayNhanGC IS NOT NULL THEN DATEDIFF(DAY, NgayGiaoGC, NgayNhanGC) ELSE NULL END);
ALTER TABLE DonHangSanXuat ADD SoNgayIn AS (CASE WHEN NgayGiaoIn IS NOT NULL AND NgayNhanIn IS NOT NULL THEN DATEDIFF(DAY, NgayGiaoIn, NgayNhanIn) ELSE NULL END);
GO

CREATE TABLE DonHangChiTietVai (
    ID          INT IDENTITY(1,1) PRIMARY KEY,
    DonHangID   INT NOT NULL FOREIGN KEY REFERENCES DonHangSanXuat(DonHangID) ON DELETE CASCADE,
    LoaiVaiID   INT NULL FOREIGN KEY REFERENCES LoaiVai(LoaiVaiID),    -- loai vai ke hoach (vd "Cotton SG"), doc lap voi ma vai cu the trong kho
    Kieu        NVARCHAR(20) NOT NULL DEFAULT N'Chính',    -- Chính / Phối
    MauSacID    INT NOT NULL FOREIGN KEY REFERENCES MauSac(MauSacID),
    DonViTinh   NVARCHAR(30) NULL,
    SoLuong     INT NOT NULL DEFAULT 0
);
GO

CREATE TABLE TienDoSanXuat (
    TienDoID        INT IDENTITY(1,1) PRIMARY KEY,
    DonHangID       INT NOT NULL FOREIGN KEY REFERENCES DonHangSanXuat(DonHangID) ON DELETE CASCADE,
    NgayGhiNhan     DATE NOT NULL,
    ThoiGianNhap    DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    StageID         INT NOT NULL FOREIGN KEY REFERENCES CongDoanSanXuat(StageID),
    NguoiCapNhatID  INT NULL FOREIGN KEY REFERENCES Users(UserID),
    GhiChu          NVARCHAR(255) NULL,
    MetSoDoDai      DECIMAL(10,2) NULL,
    KhoVaiSoDo      DECIMAL(10,2) NULL,
    MaRap           NVARCHAR(50) NULL,
    SttSoCat        INT NULL,
    NhanVienTraiVaiID  INT NULL FOREIGN KEY REFERENCES NhanVien(NhanVienID),
    NhanVienCatID      INT NULL FOREIGN KEY REFERENCES NhanVien(NhanVienID)
);
GO

CREATE TABLE TienDoChiTietMau (
    ID             INT IDENTITY(1,1) PRIMARY KEY,
    TienDoID       INT NOT NULL FOREIGN KEY REFERENCES TienDoSanXuat(TienDoID) ON DELETE CASCADE,
    MauSacID       INT NOT NULL FOREIGN KEY REFERENCES MauSac(MauSacID),
    SoLuongLuyKe   INT NOT NULL DEFAULT 0
);
GO

-- Chi tiet mau phu theo mau chinh, rieng cong doan Cat (vd mau chinh Do, mau phu A/B/C)
-- SoLuongLuyKe cua TienDoChiTietMau (mau chinh) = tong cac dong phu ben duoi, tinh tu frontend truoc khi gui.
CREATE TABLE TienDoChiTietMauPhu (
    ID                    INT IDENTITY(1,1) PRIMARY KEY,
    TienDoChiTietMauID    INT NOT NULL FOREIGN KEY REFERENCES TienDoChiTietMau(ID) ON DELETE CASCADE,
    TenMauPhu             NVARCHAR(50) NULL,
    SoLuong               INT NOT NULL DEFAULT 0
);
GO

-- Giao viec may noi bo khi Nha gia cong cua don hang la "Nha Lam": 1 mau trong 1 cong doan may
-- co the giao cho nhieu nhan vien voi SL khac nhau (nhieu dong PhanCongMay cung TienDoID).
CREATE TABLE PhanCongMay (
    ID             INT IDENTITY(1,1) PRIMARY KEY,
    TienDoID       INT NOT NULL FOREIGN KEY REFERENCES TienDoSanXuat(TienDoID) ON DELETE CASCADE,
    NhanVienID     INT NOT NULL FOREIGN KEY REFERENCES NhanVien(NhanVienID),
    CongDoanMayID  INT NULL FOREIGN KEY REFERENCES CongDoanMay(CongDoanMayID),
    MauSacID       INT NOT NULL FOREIGN KEY REFERENCES MauSac(MauSacID),
    SoLuong        INT NOT NULL DEFAULT 0
);
GO

-- Thong bao trong he thong: bao cho tung user khi don hang chuyen sang cong doan
-- thuoc pham vi UserCongDoan cua ho (xem routes/qlsx.js -> notifyStageUsers()).
CREATE TABLE ThongBao (
    NotificationID  INT IDENTITY(1,1) PRIMARY KEY,
    UserID          INT NOT NULL FOREIGN KEY REFERENCES Users(UserID) ON DELETE CASCADE,
    DonHangID       INT NULL FOREIGN KEY REFERENCES DonHangSanXuat(DonHangID),
    NoiDung         NVARCHAR(500) NOT NULL,
    DaDoc           BIT NOT NULL DEFAULT 0,
    CreatedAt       DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO
CREATE INDEX IX_ThongBao_UserID ON ThongBao(UserID, DaDoc);
GO

/* ============================================================
   7. KHO VAI (quan ly theo cay vai, nhap/xuat theo phieu)
   ============================================================ */
CREATE TABLE PhieuNhapVai (
    PhieuNhapID  INT IDENTITY(1,1) PRIMARY KEY,
    NgayNhap     DATE NOT NULL,
    NCC_ID       INT NULL FOREIGN KEY REFERENCES NhaCungCap(NCC_ID),
    SoHoaDon     NVARCHAR(50) NULL,
    GhiChu       NVARCHAR(255) NULL,
    NguoiTaoID   INT NULL FOREIGN KEY REFERENCES Users(UserID),
    CreatedAt    DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO

CREATE TABLE VaiCay (
    CayID           INT IDENTITY(1,1) PRIMARY KEY,
    MaCay           NVARCHAR(50) NOT NULL UNIQUE,
    PhieuNhapID     INT NOT NULL FOREIGN KEY REFERENCES PhieuNhapVai(PhieuNhapID),
    VaiID           INT NOT NULL FOREIGN KEY REFERENCES DanhMucVai(VaiID),
    KhoVaiThucTe    DECIMAL(10,2) NULL,
    GSM             DECIMAL(10,2) NULL,
    KGNhap          DECIMAL(10,2) NOT NULL,
    QRCode          NVARCHAR(255) NULL,
    ViTriKho        NVARCHAR(50) NULL,
    NgayNhap        DATE NOT NULL,
    TrangThai       NVARCHAR(20) NOT NULL DEFAULT N'Nguyên cây',   -- Nguyên cây / Cây lẻ / Hết
    DonGiaNhap      DECIMAL(14,2) NULL   -- don gia nhap theo cay/lo (v4.0)
);
GO

CREATE TABLE PhieuXuatVai (
    PhieuXuatID  INT IDENTITY(1,1) PRIMARY KEY,
    NgayXuat     DATE NOT NULL,
    MaDon        NVARCHAR(30) NULL,                                          -- giu de hien thi/tuong thich nguoc; DonHangID moi la khoa lien ket that su
    DonHangID    INT NULL FOREIGN KEY REFERENCES DonHangSanXuat(DonHangID),   -- lien ket cap vai truc tiep voi don hang san xuat (cap vai tu phan he QLSX)
    Chuyen       NVARCHAR(50) NULL,
    NguoiNhan    NVARCHAR(100) NULL,
    MucDich      NVARCHAR(100) NULL,
    GhiChu       NVARCHAR(255) NULL,
    NguoiTaoID   INT NULL FOREIGN KEY REFERENCES Users(UserID),
    CreatedAt    DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO

CREATE TABLE PhieuXuatVaiChiTiet (
    ID            INT IDENTITY(1,1) PRIMARY KEY,
    PhieuXuatID   INT NOT NULL FOREIGN KEY REFERENCES PhieuXuatVai(PhieuXuatID) ON DELETE CASCADE,
    CayID         INT NOT NULL FOREIGN KEY REFERENCES VaiCay(CayID),
    KGXuat        DECIMAL(10,2) NOT NULL
);
GO

-- Dinh muc vai theo mau hang + ty le hao hut cho phep (dung de tinh bao cao hao hut, xem routes/khovai.js -> /haohut)
CREATE TABLE DinhMucVai (
    ID               INT IDENTITY(1,1) PRIMARY KEY,
    MauHang          NVARCHAR(100) NULL,
    VaiID            INT NULL FOREIGN KEY REFERENCES DanhMucVai(VaiID),
    DinhMucKGTrenSP  DECIMAL(10,4) NULL,
    TyLeHaoHut       DECIMAL(5,2) NULL,
    GhiChu           NVARCHAR(255) NULL
);
GO

CREATE TABLE KiemKeVai (
    ID           INT IDENTITY(1,1) PRIMARY KEY,
    NgayKiem     DATE NOT NULL,
    CayID        INT NOT NULL FOREIGN KEY REFERENCES VaiCay(CayID),
    KGHeThong    DECIMAL(10,2) NULL,
    KGThucTe     DECIMAL(10,2) NULL,
    NguoiKiemID  INT NULL FOREIGN KEY REFERENCES Users(UserID),
    GhiChu       NVARCHAR(255) NULL
);
GO

/* ============================================================
   8. THE KHO HANG HOA (THANH PHAM)
   ============================================================ */
CREATE TABLE TheKhoHangHoa (
    MaHangID          INT IDENTITY(1,1) PRIMARY KEY,
    MaHang            NVARCHAR(50) NOT NULL UNIQUE,
    TenHang           NVARCHAR(150) NOT NULL,
    GiaBan            DECIMAL(14,2) NULL,
    LoaiRi            INT NOT NULL DEFAULT 1,        -- ty le quy doi DonViCoBan -> DonViQuyDoi (vd 5 Cai = 1 Ri); cong thuc SoCatCai/NhapCai/XuatCai KHONG doi, chi doi nhan hien thi
    TheKhoDanhMucID   INT NULL FOREIGN KEY REFERENCES TheKhoDanhMuc(TheKhoDanhMucID),
    AnhDaiDien        NVARCHAR(500) NULL,
    GhiChu            NVARCHAR(255) NULL,
    LoaiHang          NVARCHAR(20) NOT NULL DEFAULT N'DatNgoai' CHECK (LoaiHang IN (N'NhaSanXuat', N'DatNgoai')),  -- v4.0
    DonHangID         INT NULL FOREIGN KEY REFERENCES DonHangSanXuat(DonHangID),   -- v4.0: lien ket don hang san xuat khi LoaiHang = NhaSanXuat
    DonViCoBan        NVARCHAR(30) NOT NULL DEFAULT N'Cái',   -- v4.0: nhan don vi tinh chinh (thay the gia dinh cung "Cái")
    DonViQuyDoi       NVARCHAR(30) NOT NULL DEFAULT N'Ri',    -- v4.0: nhan don vi quy doi (thay the gia dinh cung "Ri")
    GiaAloha          DECIMAL(14,2) NULL,      -- v5.17: gia truoc VAT dung cho "Báo giá Aloha" (khac GiaBan noi bo)
    MaBarcode         NVARCHAR(50) NULL,       -- v5.17: ma vach rieng, dung trong "Báo giá Aloha"
    CreatedAt         DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO

CREATE TABLE TheKhoChiTietMau (
    ID          INT IDENTITY(1,1) PRIMARY KEY,
    MaHangID    INT NOT NULL FOREIGN KEY REFERENCES TheKhoHangHoa(MaHangID) ON DELETE CASCADE,
    MauSacID    INT NOT NULL FOREIGN KEY REFERENCES MauSac(MauSacID),
    LinkAnh     NVARCHAR(500) NULL,
    SoCatCai    INT NOT NULL DEFAULT 0,
    NhapCai     INT NOT NULL DEFAULT 0,
    XuatCai     INT NOT NULL DEFAULT 0,
    CONSTRAINT UQ_TheKhoChiTietMau UNIQUE (MaHangID, MauSacID)
);
GO
ALTER TABLE TheKhoChiTietMau ADD TonCai AS (NhapCai - XuatCai) PERSISTED;
GO

-- v5.17 (muc 1.2): "Báo giá Aloha". Header = 1 lan tao bao gia; TenCongTySanXuatNhapKhau/
-- MaNCC/TenNCC ap dung 1 LAN cho ca bao gia (file mau merge cac o nay xuyen suot moi dong hang).
CREATE TABLE BaoGiaAloha (
    ID                          INT IDENTITY(1,1) PRIMARY KEY,
    TenBaoGia                  NVARCHAR(255) NULL,
    NgayTao                    DATE NOT NULL DEFAULT CAST(SYSDATETIME() AS DATE),
    TenCongTySanXuatNhapKhau   NVARCHAR(255) NULL,
    MaNCC                      NVARCHAR(50) NULL,
    TenNCC                     NVARCHAR(255) NULL,
    GhiChu                     NVARCHAR(255) NULL,
    NguoiTaoID                 INT NULL FOREIGN KEY REFERENCES Users(UserID),
    CreatedAt                  DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO

-- UNIQUE tren MaHangID (khong phai UNIQUE(BaoGiaAlohaID,MaHangID)): 1 ma hang chi duoc
-- bao gia DUNG 1 LAN trong toan bo lich su he thong - dung yeu cau "mã hàng đã chọn ở
-- báo giá trước thì không hiện ra nữa", ep o tang du lieu chu khong chi loc o frontend.
CREATE TABLE BaoGiaAlohaChiTiet (
    ID              INT IDENTITY(1,1) PRIMARY KEY,
    BaoGiaAlohaID   INT NOT NULL FOREIGN KEY REFERENCES BaoGiaAloha(ID) ON DELETE CASCADE,
    MaHangID        INT NOT NULL UNIQUE FOREIGN KEY REFERENCES TheKhoHangHoa(MaHangID),
    PhanTramVAT     DECIMAL(5,4) NOT NULL DEFAULT 0.08,
    ThuTu           INT NOT NULL DEFAULT 0,
    CreatedAt       DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO
CREATE INDEX IX_BaoGiaAlohaChiTiet_BaoGiaAlohaID ON BaoGiaAlohaChiTiet(BaoGiaAlohaID);
GO

CREATE TABLE DonKhachDatHang (
    DonID         INT IDENTITY(1,1) PRIMARY KEY,
    ThoiGian      DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    TenKhach      NVARCHAR(150) NOT NULL,
    MaHangID      INT NOT NULL FOREIGN KEY REFERENCES TheKhoHangHoa(MaHangID),
    MauSacID      INT NOT NULL FOREIGN KEY REFERENCES MauSac(MauSacID),
    SoLuongDat    INT NOT NULL,
    DonVi         NVARCHAR(10) NOT NULL DEFAULT N'Cái',   -- Cái / Ri
    TrangThai     NVARCHAR(30) NOT NULL DEFAULT N'Chờ xử lý',
    NguoiTaoID    INT NULL FOREIGN KEY REFERENCES Users(UserID)
);
GO

/* ============================================================
   9. PHU KIEN (mac, the bai, chun, day rut, day co...) - moi tu v3.0
   Ledger theo phieu Nhap/Xuat (giong Kho vai), khac voi ban goc Apps Script
   luu 1 dong phang cho moi (dau phieu + chi tiet) trong 1 sheet Data_Nhap_Xuat.
   Phieu Xuat co the gan DonHangID de bao cao "SL phu kien xuat kem theo don hang"
   trong phan he QLSX (xem routes/qlsx.js -> /orders/:maDH/print).
   ============================================================ */
CREATE TABLE LoaiPhuKien (
    LoaiPhuKienID  INT IDENTITY(1,1) PRIMARY KEY,
    TenLoai        NVARCHAR(100) NOT NULL UNIQUE
);
GO

CREATE TABLE DanhMucPhuKien (
    PhuKienID      INT IDENTITY(1,1) PRIMARY KEY,
    MaPhuKien      NVARCHAR(50) NOT NULL UNIQUE,
    TenPhuKien     NVARCHAR(150) NOT NULL,
    LoaiPhuKienID  INT NULL FOREIGN KEY REFERENCES LoaiPhuKien(LoaiPhuKienID),
    Size           NVARCHAR(30) NULL,
    DonViCoBan     NVARCHAR(30) NOT NULL,
    DonViQuyDoi    NVARCHAR(30) NULL,
    TyLeQuyDoi     DECIMAL(12,4) NULL,      -- vd 1 DonViQuyDoi (Bó) = TyLeQuyDoi x DonViCoBan (Kg), theo dung logic ban goc
    GhiChu         NVARCHAR(255) NULL
);
GO

CREATE TABLE PhieuPhuKien (
    PhieuID      INT IDENTITY(1,1) PRIMARY KEY,
    Ngay         DATE NOT NULL,
    LoaiPhieu    NVARCHAR(10) NOT NULL CHECK (LoaiPhieu IN (N'Nhập', N'Xuất')),
    MaDon        NVARCHAR(30) NULL,                                          -- giu de hien thi/tuong thich nguoc; DonHangID moi la khoa lien ket that su
    DonHangID    INT NULL FOREIGN KEY REFERENCES DonHangSanXuat(DonHangID),   -- xuat phu kien kem theo don hang san xuat
    NCC_ID       INT NULL FOREIGN KEY REFERENCES NhaCungCap(NCC_ID),          -- v4.0: nha cung cap (chu yeu dung cho phieu Nhap)
    SoHoaDon     NVARCHAR(50) NULL,                                          -- v4.0: so hoa don (chu yeu dung cho phieu Nhap, khong bat buoc gan don hang)
    GhiChu       NVARCHAR(255) NULL,
    NguoiTaoID   INT NULL FOREIGN KEY REFERENCES Users(UserID),
    CreatedAt    DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO

CREATE TABLE PhieuPhuKienChiTiet (
    ID           INT IDENTITY(1,1) PRIMARY KEY,
    PhieuID      INT NOT NULL FOREIGN KEY REFERENCES PhieuPhuKien(PhieuID) ON DELETE CASCADE,
    PhuKienID    INT NOT NULL FOREIGN KEY REFERENCES DanhMucPhuKien(PhuKienID),
    SoLuong      DECIMAL(14,2) NOT NULL,
    DonVi        NVARCHAR(30) NULL,
    GhiChu       NVARCHAR(255) NULL
);
GO

/* ============================================================
   10. CAU HINH HE THONG (thay the sheet CauHinh: email canh bao, so ngay canh bao...)
   ============================================================ */
CREATE TABLE CauHinhHeThong (
    ConfigKey    NVARCHAR(50) PRIMARY KEY,
    ConfigValue  NVARCHAR(500) NULL
);
GO

/* ============================================================
   VIEWS BAO CAO
   ============================================================ */
CREATE VIEW vw_TonKhoVai AS
SELECT
    v.VaiID, v.MaVai, v.MaPM, lv.TenLoaiVai, lv.MaLoai, ms.TenMau,
    v.KhoVai, v.GSM, v.ViTriKho, v.TonToiThieuKG,
    ISNULL(SUM(c.KGNhap), 0) AS TongKGNhap,
    ISNULL(SUM(x.KGXuatTong), 0) AS TongKGXuat,
    ISNULL(SUM(c.KGNhap), 0) - ISNULL(SUM(x.KGXuatTong), 0) AS TonKG,
    COUNT(DISTINCT c.CayID) AS TongCayNhap,
    SUM(CASE WHEN c.TrangThai <> N'Hết' THEN 1 ELSE 0 END) AS CayConTon
FROM DanhMucVai v
LEFT JOIN LoaiVai lv ON lv.LoaiVaiID = v.LoaiVaiID
LEFT JOIN MauSac ms ON ms.MauSacID = v.MauSacID
LEFT JOIN VaiCay c ON c.VaiID = v.VaiID
LEFT JOIN (
    SELECT CayID, SUM(KGXuat) AS KGXuatTong FROM PhieuXuatVaiChiTiet GROUP BY CayID
) x ON x.CayID = c.CayID
GROUP BY v.VaiID, v.MaVai, v.MaPM, lv.TenLoaiVai, lv.MaLoai, ms.TenMau, v.KhoVai, v.GSM, v.ViTriKho, v.TonToiThieuKG;
GO

CREATE VIEW vw_TonCayVai AS
SELECT
    c.CayID, c.MaCay, c.VaiID, v.MaVai, v.MaPM, lv.TenLoaiVai, lv.MaLoai, ms.TenMau,
    c.KGNhap, ISNULL(x.KGXuatTong, 0) AS KGDaXuat,
    c.KGNhap - ISNULL(x.KGXuatTong, 0) AS KGCon,
    c.TrangThai, c.NgayNhap, c.ViTriKho, c.QRCode
FROM VaiCay c
JOIN DanhMucVai v ON v.VaiID = c.VaiID
LEFT JOIN LoaiVai lv ON lv.LoaiVaiID = v.LoaiVaiID
LEFT JOIN MauSac ms ON ms.MauSacID = v.MauSacID
LEFT JOIN (
    SELECT CayID, SUM(KGXuat) AS KGXuatTong FROM PhieuXuatVaiChiTiet GROUP BY CayID
) x ON x.CayID = c.CayID;
GO

CREATE VIEW vw_TonKhoHangHoa AS
SELECT
    h.MaHangID, h.MaHang, h.TenHang, h.GiaBan, h.LoaiRi, h.AnhDaiDien, tk.TenTheKho,
    h.LoaiHang, h.DonHangID, h.DonViCoBan, h.DonViQuyDoi, d.MaDH,
    h.GiaAloha, h.MaBarcode,
    ISNULL(SUM(ct.SoCatCai), 0) AS TongSoCat,
    ISNULL(SUM(ct.NhapCai), 0) AS TongNhap,
    ISNULL(SUM(ct.XuatCai), 0) AS TongXuat,
    ISNULL(SUM(ct.NhapCai - ct.XuatCai), 0) AS TongTon
FROM TheKhoHangHoa h
LEFT JOIN TheKhoDanhMuc tk ON tk.TheKhoDanhMucID = h.TheKhoDanhMucID
LEFT JOIN TheKhoChiTietMau ct ON ct.MaHangID = h.MaHangID
LEFT JOIN DonHangSanXuat d ON d.DonHangID = h.DonHangID
GROUP BY h.MaHangID, h.MaHang, h.TenHang, h.GiaBan, h.LoaiRi, h.AnhDaiDien, tk.TenTheKho,
         h.LoaiHang, h.DonHangID, h.DonViCoBan, h.DonViQuyDoi, d.MaDH, h.GiaAloha, h.MaBarcode;
GO

CREATE VIEW vw_TonKhoPhuKien AS
SELECT
    dm.PhuKienID, dm.MaPhuKien, dm.TenPhuKien, lpk.TenLoai, dm.Size, dm.DonViCoBan,
    ISNULL(SUM(CASE WHEN p.LoaiPhieu = N'Nhập' THEN ct.SoLuong ELSE 0 END), 0) AS TongNhap,
    ISNULL(SUM(CASE WHEN p.LoaiPhieu = N'Xuất' THEN ct.SoLuong ELSE 0 END), 0) AS TongXuat,
    ISNULL(SUM(CASE WHEN p.LoaiPhieu = N'Nhập' THEN ct.SoLuong ELSE -ct.SoLuong END), 0) AS TonKho
FROM DanhMucPhuKien dm
LEFT JOIN LoaiPhuKien lpk ON lpk.LoaiPhuKienID = dm.LoaiPhuKienID
LEFT JOIN PhieuPhuKienChiTiet ct ON ct.PhuKienID = dm.PhuKienID
LEFT JOIN PhieuPhuKien p ON p.PhieuID = ct.PhieuID
GROUP BY dm.PhuKienID, dm.MaPhuKien, dm.TenPhuKien, lpk.TenLoai, dm.Size, dm.DonViCoBan;
GO

/* ============================================================
   DU LIEU KHOI TAO (SEED DATA)
   ============================================================ */

-- Modules
INSERT INTO Modules (ModuleCode, TenModule, ThuTu) VALUES
(N'DANHMUC', N'Danh mục', 1),
(N'USERS',   N'Quản lý User', 2),
(N'QLSX',    N'Quản lý sản xuất', 3),
(N'KHOVAI',  N'Quản lý kho vải', 4),
(N'KHOHANG', N'Thẻ kho hàng hóa', 5),
(N'PHUKIEN', N'Quản lý phụ kiện', 6);
GO

-- Groups
INSERT INTO Groups (TenNhom, MoTa, IsAdmin) VALUES
(N'Admin', N'Toàn quyền hệ thống', 1),
(N'Kỹ thuật', N'Bộ phận kỹ thuật', 0),
(N'Cắt', N'Tổ cắt', 0),
(N'May', N'Tổ may', 0),
(N'Kho', N'Thủ kho (vải + hàng hóa + phụ kiện)', 0),
(N'Giao nhận', N'Giao nhận nhà gia công / nhà in', 0),
(N'Kinh doanh', N'Tạo đơn / chăm sóc khách hàng', 0);
GO

-- Phan quyen mac dinh cho tung nhom (Admin bo qua vi IsAdmin=1)
INSERT INTO Permissions (GroupID, ModuleID, CanView, CanCreate, CanEdit, CanDelete)
SELECT g.GroupID, m.ModuleID, 1, 0, 0, 0
FROM Groups g CROSS JOIN Modules m WHERE g.TenNhom <> N'Admin';
GO
-- Vi du: nhom 'Kho' duoc them quyen tao/sua tren module KHOVAI, KHOHANG va PHUKIEN
UPDATE p SET CanCreate = 1, CanEdit = 1
FROM Permissions p
JOIN Groups g ON g.GroupID = p.GroupID
JOIN Modules m ON m.ModuleID = p.ModuleID
WHERE g.TenNhom = N'Kho' AND m.ModuleCode IN (N'KHOVAI', N'KHOHANG', N'PHUKIEN');

UPDATE p SET CanCreate = 1, CanEdit = 1
FROM Permissions p
JOIN Groups g ON g.GroupID = p.GroupID
JOIN Modules m ON m.ModuleID = p.ModuleID
WHERE g.TenNhom = N'Kinh doanh' AND m.ModuleCode = N'QLSX';

UPDATE p SET CanEdit = 1
FROM Permissions p
JOIN Groups g ON g.GroupID = p.GroupID
JOIN Modules m ON m.ModuleID = p.ModuleID
WHERE g.TenNhom IN (N'Kỹ thuật', N'Cắt', N'May') AND m.ModuleCode = N'QLSX';

-- v4.0: nhom 'Kho' cung duoc CanEdit tren QLSX (de cap nhat cong doan "Kho nhập")
UPDATE p SET CanEdit = 1
FROM Permissions p
JOIN Groups g ON g.GroupID = p.GroupID
JOIN Modules m ON m.ModuleID = p.ModuleID
WHERE g.TenNhom = N'Kho' AND m.ModuleCode = N'QLSX';
GO

-- Bo phan
INSERT INTO BoPhan (TenBoPhan) VALUES (N'Quản lý'), (N'Kinh doanh'), (N'Kỹ thuật'), (N'Cắt'), (N'May'), (N'Hoàn thiện'), (N'Kho'), (N'Giao nhận');
GO

-- Cong doan san xuat mac dinh
INSERT INTO CongDoanSanXuat (TenCongDoan, ThuTu) VALUES
(N'Kỹ thuật', 1), (N'Cắt', 2), (N'May', 3), (N'Hoàn thiện', 4), (N'Kho nhập', 5), (N'Đóng gói', 6);
GO

-- Mau sac mau
INSERT INTO MauSac (MaMau, TenMau) VALUES
(N'DEN', N'Đen'), (N'TRANG', N'Trắng'), (N'NAVY', N'Xanh navy'), (N'DO', N'Đỏ');
GO

-- Loai vai mau
INSERT INTO LoaiVai (TenLoaiVai) VALUES (N'Vải Gió Tráng PU'), (N'Vải Khaki'), (N'Vải Thun Cotton'), (N'Vải Nỉ');
GO

-- Nha gia cong / in theu mau
INSERT INTO NhaGiaCong (TenNha, LoaiHinh) VALUES
(N'Nhà Làm', N'GiaCong'), (N'Thu Vân Côn', N'GiaCong'), (N'Thúy Thanh Hóa', N'GiaCong'), (N'Loan Thạch Thất', N'GiaCong'),
(N'A Hoàng Trôi', N'InTheu'), (N'Đông Đại Tự', N'InTheu');
GO

-- The kho danh muc mau
INSERT INTO TheKhoDanhMuc (TenTheKho) VALUES (N'Hàng hè 2026'), (N'Hàng thu 2026');
GO

-- Loai phu kien mau (theo danh sach thuc te trong file goc "data phu kien.xlsx")
INSERT INTO LoaiPhuKien (TenLoai) VALUES (N'Dây cổ'), (N'Mác Áo'), (N'Mác Quần'), (N'Chun'), (N'Thẻ bài');
GO

-- Don vi tinh mau (v4.0)
INSERT INTO DanhMucDonViTinh (TenDonVi) VALUES (N'Cái'), (N'Bộ'), (N'Mét'), (N'Kg'), (N'Cuộn'), (N'Ri'), (N'Chiếc');
GO

-- Cong doan may mau (v4.0)
INSERT INTO CongDoanMay (TenCongDoan) VALUES
(N'May cổ'), (N'May tay'), (N'May thân'), (N'Vắt sổ'), (N'Tra khóa'), (N'Đính nút'), (N'May lai'), (N'Ủi hoàn thiện');
GO

-- Cau hinh he thong mau
INSERT INTO CauHinhHeThong (ConfigKey, ConfigValue) VALUES
(N'EmailCanhBao', N'nhap-email-cua-ban@gmail.com'),
(N'SoNgayCanhBaoTruocHan', N'2');
GO

-- Tai khoan admin mac dinh: username=admin / password=admin123
-- (mat khau duoc bam bang bcrypt trong lan chay seed_admin.js dau tien, xem HUONG_DAN_CAI_DAT.md)

GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [ 2/81]  migration_v2.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [2/81] migration_v2.sql';
GO

/* ================================================================
   MIGRATION v1.0 -> v2.0
   Chi can chay file nay neu ban DA cai dat va co du lieu tu schema.sql v1.0.
   Neu ban dang cai dat lan dau, KHONG can chay file nay — schema.sql (v2.0)
   da bao gom san thay doi duoi day.

   Noi dung: them cot DonHangID vao PhieuXuatVai de lien ket "cap vai" tu
   phan he Quan ly san xuat voi phieu xuat kho vai (nghiep vu Cap phat vai
   theo don hang). Khong dung/xoa du lieu da co.
   ================================================================ */

USE QLNoiBo;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('PhieuXuatVai') AND name = 'DonHangID'
)
BEGIN
    ALTER TABLE PhieuXuatVai ADD DonHangID INT NULL;
    ALTER TABLE PhieuXuatVai ADD CONSTRAINT FK_PhieuXuatVai_DonHang
        FOREIGN KEY (DonHangID) REFERENCES DonHangSanXuat(DonHangID);
    PRINT 'Da them cot PhieuXuatVai.DonHangID.';
END
ELSE
BEGIN
    PRINT 'Cot PhieuXuatVai.DonHangID da ton tai, bo qua.';
END
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [ 3/81]  migration_v3.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [3/81] migration_v3.sql';
GO

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


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [ 4/81]  migration_v4.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [4/81] migration_v4.sql';
GO

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


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [ 5/81]  migration_v5_chucnang.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [5/81] migration_v5_chucnang.sql';
GO

/* ================================================================
   MIGRATION v5.0 — Phan quyen chi tiet theo tung CHUC NANG (tab/man hinh con trong 1 phan he).
   Bo sung, KHONG thay doi logic phan quyen theo PHAN HE (Modules/Permissions) da co - 2 lop nay
   hoat dong song song:
     - Permissions (cu)        : co duoc VAO phan he nay khong, co duoc Them/Sua/Xoa trong do khong.
     - ChucNangPermissions (moi): trong phan he da duoc vao, co duoc THAY man hinh con (tab) cu the
                                  nay trong menu khong. Mac dinh (chua co dong nao) = duoc thay (an toan,
                                  khong lam mat quyen cua nhom da cau hinh tu truoc khi chay migration nay).
   Chay 1 lan. Idempotent - chay lai khong tao trung du lieu.
   ================================================================ */

USE QLNoiBo;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ChucNang')
BEGIN
    CREATE TABLE ChucNang (
        ChucNangID INT IDENTITY(1,1) PRIMARY KEY,
        ModuleCode NVARCHAR(30) NOT NULL,
        MaChucNang NVARCHAR(30) NOT NULL,     -- khop dung voi "key" tra ve tu getTabs() o frontend
        TenChucNang NVARCHAR(100) NOT NULL,
        ThuTu INT NOT NULL DEFAULT 0,
        CONSTRAINT UQ_ChucNang_Module_Ma UNIQUE (ModuleCode, MaChucNang)
    );
    PRINT 'Da tao bang ChucNang.';
END ELSE PRINT 'Bang ChucNang da ton tai, bo qua.';
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ChucNangPermissions')
BEGIN
    CREATE TABLE ChucNangPermissions (
        GroupID INT NOT NULL REFERENCES Groups(GroupID) ON DELETE CASCADE,
        ChucNangID INT NOT NULL REFERENCES ChucNang(ChucNangID) ON DELETE CASCADE,
        CanView BIT NOT NULL DEFAULT 1,
        PRIMARY KEY (GroupID, ChucNangID)
    );
    PRINT 'Da tao bang ChucNangPermissions.';
END ELSE PRINT 'Bang ChucNangPermissions da ton tai, bo qua.';
GO

-- Seed danh muc chuc nang (khop dung key/label trong getTabs() cua tung module.*.js frontend).
-- Dung MERGE de idempotent - chay lai nhieu lan khong tao trung, khong xoa/doi ThuTu cua dong da co.
-- (Phase 4 patch: bo sung 2 dong QLSX 'ralenh'/'dongiamay' bi thieu tu Phase 2 - khien 2 tab nay
--  khong the bi an/chan qua man hinh Ma tran phan quyen du middleware requireChucNang da co san.)
MERGE ChucNang AS t
USING (VALUES
    ('DANHMUC','bophan',N'Bộ phận',1),
    ('DANHMUC','loaivai',N'Loại vải',2),
    ('DANHMUC','mausac',N'Màu sắc',3),
    ('DANHMUC','vai',N'Danh mục vải (mã vải)',4),
    ('DANHMUC','phulieu',N'Phụ liệu',5),
    ('DANHMUC','nhagiacong',N'Nhà gia công / In thêu',6),
    ('DANHMUC','nhacungcap',N'Nhà cung cấp',7),
    ('DANHMUC','khachhang',N'Khách hàng',8),
    ('DANHMUC','thekhodanhmuc',N'Danh mục thẻ kho',9),
    ('DANHMUC','congdoan',N'Công đoạn sản xuất',10),
    ('DANHMUC','donvitinh',N'Đơn vị tính',11),
    ('DANHMUC','congdoanmay',N'Công đoạn may',12),
    ('DANHMUC','nhanvien',N'Nhân viên',13),
    ('DANHMUC','cauhinh',N'Cấu hình hệ thống',14),
    ('USERS','users',N'Tài khoản',1),
    ('USERS','groups',N'Nhóm quyền',2),
    ('USERS','perm',N'Ma trận phân quyền',3),
    ('QLSX','dashboard',N'Dashboard',1),
    ('QLSX','ralenh',N'Ra lệnh sản xuất',2),
    ('QLSX','orders',N'Danh sách đơn hàng',3),
    ('QLSX','dongiamay',N'Đơn giá công đoạn may',4),
    ('KHOVAI','dashboard',N'Tồn kho',1),
    ('KHOVAI','rolls',N'Tồn theo cây',2),
    ('KHOVAI','nhap',N'Nhập kho',3),
    ('KHOVAI','xuat',N'Xuất kho',4),
    ('KHOVAI','dinhmuc',N'Định mức & Hao hụt',5),
    ('KHOVAI','kiemke',N'Kiểm kê',6),
    ('KHOVAI','tem',N'In tem theo ngày nhập',7),
    ('KHOHANG','items',N'Thẻ kho / Tồn kho',1),
    ('KHOHANG','orders',N'Đơn khách đặt hàng',2),
    ('PHUKIEN','phieunhap',N'Phiếu Nhập',1),
    ('PHUKIEN','phieuxuat',N'Phiếu Xuất',2),
    ('PHUKIEN','thekho',N'Thẻ kho / Tồn kho',3),
    ('PHUKIEN','danhmuc',N'Danh mục phụ kiện',4),
    ('PHUKIEN','loai',N'Loại phụ kiện',5)
) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu)
ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
WHEN NOT MATCHED THEN
    INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu) VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu);
GO
PRINT 'Da seed danh muc ChucNang (idempotent).';
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [ 6/81]  migration_v5_qlsx.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [6/81] migration_v5_qlsx.sql';
GO

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


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [ 7/81]  migration_v5_userperm.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [7/81] migration_v5_userperm.sql';
GO

/* ================================================================
   MIGRATION v5.0 — Phan quyen chi tiet theo TUNG USER (bo sung, KHONG thay the phan quyen theo NHOM
   da co). Yeu cau: "Phan quyen can chi tiet hon - chon tung user do va tick vao o phan quyen."

   Nguyen tac OVERRIDE (giong het tinh than cua ChucNangPermissions o migration_v5_chucnang.sql):
     - UserPermissions        : neu co dong (UserID, ModuleID) -> DUNG HAN GIA TRI cua dong nay cho
                                dung module do (bo qua hoan toan gia tri tinh tu nhom). Neu KHONG co
                                dong nao -> giu nguyen cach tinh theo nhom nhu truoc (an toan, khong
                                lam mat quyen ai ca khi vua chay migration nay xong).
     - UserChucNangPermissions: tuong tu, nhung theo tung CHUC NANG (tab con) thay vi ca phan he.
   2 bang nay la lop OVERRIDE cao nhat: User > Nhom. Xem loadUserContext.js de biet thu tu ap dung.
   Chay 1 lan. Idempotent - chay lai khong tao trung du lieu, khong xoa du lieu da co.
   ================================================================ */

USE QLNoiBo;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'UserPermissions')
BEGIN
    CREATE TABLE UserPermissions (
        UserPermissionID INT IDENTITY(1,1) PRIMARY KEY,
        UserID INT NOT NULL REFERENCES Users(UserID) ON DELETE CASCADE,
        ModuleID INT NOT NULL REFERENCES Modules(ModuleID) ON DELETE CASCADE,
        CanView BIT NOT NULL DEFAULT 0,
        CanCreate BIT NOT NULL DEFAULT 0,
        CanEdit BIT NOT NULL DEFAULT 0,
        CanDelete BIT NOT NULL DEFAULT 0,
        CONSTRAINT UQ_UserPermissions_User_Module UNIQUE (UserID, ModuleID)
    );
    PRINT 'Da tao bang UserPermissions.';
END ELSE PRINT 'Bang UserPermissions da ton tai, bo qua.';
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'UserChucNangPermissions')
BEGIN
    CREATE TABLE UserChucNangPermissions (
        UserChucNangPermissionID INT IDENTITY(1,1) PRIMARY KEY,
        UserID INT NOT NULL REFERENCES Users(UserID) ON DELETE CASCADE,
        ChucNangID INT NOT NULL REFERENCES ChucNang(ChucNangID) ON DELETE CASCADE,
        CanView BIT NOT NULL DEFAULT 0,
        CONSTRAINT UQ_UserChucNangPermissions_User_ChucNang UNIQUE (UserID, ChucNangID)
    );
    PRINT 'Da tao bang UserChucNangPermissions.';
END ELSE PRINT 'Bang UserChucNangPermissions da ton tai, bo qua.';
GO

PRINT 'Hoan tat migration_v5_userperm.sql.';
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [ 8/81]  migration_v52_qlsx.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [8/81] migration_v52_qlsx.sql';
GO

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


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [ 9/81]  migration_v53.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [9/81] migration_v53.sql';
GO

/* ================================================================
   MIGRATION v5.3 — Dot refinement da phan he: phan quyen Sua/Xoa RIENG theo
   tung CHUC NANG (khong chi An/Hien nhu truoc), tach "Tao the kho moi" thanh
   1 chuc nang rieng trong KHOHANG.
   Additive - KHONG xoa/doi cot cu. Idempotent (COL_LENGTH / MERGE) - chay lai an toan.
   Chay SAU migration_v5_chucnang.sql (bang ChucNang/ChucNangPermissions phai da ton tai)
   va migration_v5_userperm.sql (bang UserChucNangPermissions phai da ton tai).
   ================================================================ */

USE QLNoiBo;
GO

/* ---- 1. Them CanEdit/CanDelete vao ChucNangPermissions (theo NHOM) ----
   Truoc day bang nay chi co CanView (An/Hien tab). Gio them 2 co Sua/Xoa RIENG
   cho tung chuc nang - vd 1 nhom co the duoc XEM tab "Xuat kho" nhung khong
   duoc SUA/XOA phieu trong do, du van co quyen Sua/Xoa o cap PHAN HE (Permissions).
   Nguyen tac AND: phai duoc ca 2 cap (Phan he VA Chuc nang) moi thuc su lam duoc.
   Mac dinh = 1 (duoc phep) de KHONG lam mat quyen cua ai dang dung truoc khi chay
   migration nay - giong dung tinh than CanView mac dinh 1 da co. */
IF COL_LENGTH('ChucNangPermissions', 'CanEdit') IS NULL
BEGIN
    ALTER TABLE ChucNangPermissions ADD CanEdit BIT NOT NULL DEFAULT 1;
    PRINT 'Da them cot ChucNangPermissions.CanEdit.';
END ELSE PRINT 'Cot ChucNangPermissions.CanEdit da ton tai, bo qua.';
GO

IF COL_LENGTH('ChucNangPermissions', 'CanDelete') IS NULL
BEGIN
    ALTER TABLE ChucNangPermissions ADD CanDelete BIT NOT NULL DEFAULT 1;
    PRINT 'Da them cot ChucNangPermissions.CanDelete.';
END ELSE PRINT 'Cot ChucNangPermissions.CanDelete da ton tai, bo qua.';
GO

/* ---- 2. Them CanEdit/CanDelete vao UserChucNangPermissions (rieng TUNG USER) ---- */
IF COL_LENGTH('UserChucNangPermissions', 'CanEdit') IS NULL
BEGIN
    ALTER TABLE UserChucNangPermissions ADD CanEdit BIT NOT NULL DEFAULT 1;
    PRINT 'Da them cot UserChucNangPermissions.CanEdit.';
END ELSE PRINT 'Cot UserChucNangPermissions.CanEdit da ton tai, bo qua.';
GO

IF COL_LENGTH('UserChucNangPermissions', 'CanDelete') IS NULL
BEGIN
    ALTER TABLE UserChucNangPermissions ADD CanDelete BIT NOT NULL DEFAULT 1;
    PRINT 'Da them cot UserChucNangPermissions.CanDelete.';
END ELSE PRINT 'Cot UserChucNangPermissions.CanDelete da ton tai, bo qua.';
GO

/* ---- 3. Chuc nang moi: "Tao the kho moi" tach rieng khoi list "The kho hang hoa" ---- */
MERGE ChucNang AS t
USING (VALUES
    ('KHOHANG','taomoi',N'Tạo thẻ kho mới',3)
) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu)
ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
WHEN NOT MATCHED THEN
    INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu) VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu);
GO
PRINT 'Da seed chuc nang KHOHANG:taomoi (idempotent).';
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [10/81]  migration_v54.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [10/81] migration_v54.sql';
GO

/* ================================================================
   MIGRATION v5.4 — Danh muc "Loai hang" (nhom san pham, vd Quan be trai/gai)
   cho The kho hang hoa; tach doc lap voi cot TheKhoHangHoa.LoaiHang da co tu
   truoc (NhaSanXuat/DatNgoai - phan biet NGUON hang, khong phai NHOM san pham).
   Additive - KHONG xoa/doi cot cu. Idempotent - chay lai an toan, khong mat du lieu.
   ================================================================ */

USE QLNoiBo;
GO

/* ---- 1. Danh muc Nhom san pham (vd: Quan be trai, Quan be gai, Ao thun...) ----
   LUU Y DAT TEN: yeu cau goi la "Loai hang" nhung TheKhoHangHoa.LoaiHang da dung cho
   2 gia tri NhaSanXuat/DatNgoai (phan biet NGUON goc: tu san xuat hay dat mua ngoai).
   De tranh trung ten cot/bang gay nham lan khi doc code sau nay, dat ten BANG/COT noi
   bo la "NhomSanPham" - giao dien nguoi dung van hien dung nhan "Loai hang" nhu yeu cau. */
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'DanhMucNhomSanPham')
BEGIN
    CREATE TABLE DanhMucNhomSanPham (
        NhomSanPhamID  INT IDENTITY(1,1) PRIMARY KEY,
        TenNhom        NVARCHAR(100) NOT NULL UNIQUE
    );
    PRINT 'Da tao bang DanhMucNhomSanPham.';
END ELSE PRINT 'Bang DanhMucNhomSanPham da ton tai, bo qua.';
GO

/* ---- 2. Gan Nhom san pham (tuy chon) cho tung the kho ---- */
IF COL_LENGTH('TheKhoHangHoa', 'NhomSanPhamID') IS NULL
BEGIN
    ALTER TABLE TheKhoHangHoa ADD NhomSanPhamID INT NULL FOREIGN KEY REFERENCES DanhMucNhomSanPham(NhomSanPhamID);
    PRINT 'Da them cot TheKhoHangHoa.NhomSanPhamID.';
END ELSE PRINT 'Cot TheKhoHangHoa.NhomSanPhamID da ton tai, bo qua.';
GO

/* ---- 3. Cap nhat view vw_TonKhoHangHoa: them TenNhom (dung cho loc Catalogue + hien thi Kho hang) ----
   CREATE OR ALTER de idempotent - chay lai nhieu lan an toan, khong mat du lieu (view khong luu du lieu). */
CREATE OR ALTER VIEW vw_TonKhoHangHoa AS
SELECT
    h.MaHangID, h.MaHang, h.TenHang, h.GiaBan, h.LoaiRi, h.AnhDaiDien, tk.TenTheKho,
    h.LoaiHang, h.DonHangID, h.DonViCoBan, h.DonViQuyDoi, d.MaDH,
    h.NhomSanPhamID, nsp.TenNhom,
    ISNULL(SUM(ct.SoCatCai), 0) AS TongSoCat,
    ISNULL(SUM(ct.NhapCai), 0) AS TongNhap,
    ISNULL(SUM(ct.XuatCai), 0) AS TongXuat,
    ISNULL(SUM(ct.NhapCai - ct.XuatCai), 0) AS TongTon
FROM TheKhoHangHoa h
LEFT JOIN TheKhoDanhMuc tk ON tk.TheKhoDanhMucID = h.TheKhoDanhMucID
LEFT JOIN DanhMucNhomSanPham nsp ON nsp.NhomSanPhamID = h.NhomSanPhamID
LEFT JOIN TheKhoChiTietMau ct ON ct.MaHangID = h.MaHangID
LEFT JOIN DonHangSanXuat d ON d.DonHangID = h.DonHangID
GROUP BY h.MaHangID, h.MaHang, h.TenHang, h.GiaBan, h.LoaiRi, h.AnhDaiDien, tk.TenTheKho,
         h.LoaiHang, h.DonHangID, h.DonViCoBan, h.DonViQuyDoi, d.MaDH, h.NhomSanPhamID, nsp.TenNhom;
GO
PRINT 'Da cap nhat view vw_TonKhoHangHoa (them TenNhom).';
GO

/* ---- 4. Khop mau in mau_phieu.docx: cac phieu Nhap co dong "Ngay hoa don" rieng (nhap tay,
   khac Ngay nhap/Ngay cua phieu) - bo sung cho ca Nhap kho vai va Nhap kho phu kien. Additive,
   NULL duoc, khong anh huong du lieu cu (cac phieu da tao truoc se co gia tri NULL). ---- */
IF COL_LENGTH('PhieuNhapVai', 'NgayHoaDon') IS NULL
BEGIN
    ALTER TABLE PhieuNhapVai ADD NgayHoaDon DATE NULL;
    PRINT 'Da them cot PhieuNhapVai.NgayHoaDon.';
END ELSE PRINT 'Cot PhieuNhapVai.NgayHoaDon da ton tai, bo qua.';
GO

IF COL_LENGTH('PhieuPhuKien', 'NgayHoaDon') IS NULL
BEGIN
    ALTER TABLE PhieuPhuKien ADD NgayHoaDon DATE NULL;
    PRINT 'Da them cot PhieuPhuKien.NgayHoaDon.';
END ELSE PRINT 'Cot PhieuPhuKien.NgayHoaDon da ton tai, bo qua.';
GO

/* ---- 5. Khop mau in: Phieu Nhap kho phu kien co cot "Don gia" tren tung dong (mau_phieu.docx) -
   dat o PhieuPhuKienChiTiet (theo dung dong, gia co the khac nhau giua cac lan nhap - giong cach
   VaiCay.DonGiaNhap luu theo tung cay thay vi mot gia co dinh tren DanhMucVai). ---- */
IF COL_LENGTH('PhieuPhuKienChiTiet', 'DonGia') IS NULL
BEGIN
    ALTER TABLE PhieuPhuKienChiTiet ADD DonGia DECIMAL(14,2) NULL;
    PRINT 'Da them cot PhieuPhuKienChiTiet.DonGia.';
END ELSE PRINT 'Cot PhieuPhuKienChiTiet.DonGia da ton tai, bo qua.';
GO
PRINT 'Hoan tat migration v5.4.';
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [11/81]  migration_v55.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [11/81] migration_v55.sql';
GO

/* ================================================================
   MIGRATION v5.5 — QLSX: anh "Hinh in", don gia gia cong ngoai chon
   ngay o cong doan Ky thuat. Additive - KHONG xoa/doi cot cu. Idempotent -
   chay lai an toan, khong mat du lieu. Khong dung migration rieng cho
   Dashboard/In phieu/Giao viec noi bo (PhanCongMay) - cac thay doi do
   dung lai dung bang/cot da co (xem HUONG_DAN_CAI_DAT.md muc v5.5).
   ================================================================ */

USE QLNoiBo;
GO

/* ---- 1. "Hinh in" gio co THEM anh tai len (giu nguyen cot chu DongHinhIn da co tu v5.0 - yeu
   cau la "THEM chuc nang tai anh len", khong phai thay the dong chu mo ta) ---- */
IF COL_LENGTH('DonHangSanXuat', 'AnhHinhIn') IS NULL
BEGIN
    ALTER TABLE DonHangSanXuat ADD AnhHinhIn NVARCHAR(500) NULL;
    PRINT 'Da them cot DonHangSanXuat.AnhHinhIn.';
END ELSE PRINT 'Cot DonHangSanXuat.AnhHinhIn da ton tai, bo qua.';
GO

/* ---- 2. Don gia gia cong NGOAI (khi giao cho 1 nha gia cong KHAC "Nha Lam"), chon/nhap ngay o
   cong doan "Ky thuat" trong Ghi tien do - dat CUNG cap voi NhaGiaCongID (da co tu truoc, cot don
   nay o muc DON HANG, khong phai theo tung cong doan may nhu DonHangCongDoanMay, vi gia cong ngoai
   thuong tra theo 1 don gia/don hang chu khong tach tung cong doan may noi bo). Chua dung o dau -
   se phuc vu phan he tinh luong/thanh toan nha gia cong lam sau, hien tai chi luu de xem lai. ---- */
IF COL_LENGTH('DonHangSanXuat', 'DonGiaGiaCongNgoai') IS NULL
BEGIN
    ALTER TABLE DonHangSanXuat ADD DonGiaGiaCongNgoai DECIMAL(14,2) NULL;
    PRINT 'Da them cot DonHangSanXuat.DonGiaGiaCongNgoai.';
END ELSE PRINT 'Cot DonHangSanXuat.DonGiaGiaCongNgoai da ton tai, bo qua.';
GO

PRINT 'Hoan tat migration v5.5.';
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [12/81]  migration_v56.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [12/81] migration_v56.sql';
GO

/* ================================================================
   MIGRATION v5.6 — QLSX: mau khong con bat buoc o Giao viec may (PhanCongMay.
   MauSacID -> NULL-able), tach chuc nang "Ghi nhan tien do" rieng khoi "Xem/
   Sua lenh san xuat" (yeu cau v5.6 phan phan quyen); Kho vai: Ton kho tong hop
   bo sung dem cay theo trang thai (view vw_TonKhoVai). Additive - KHONG xoa
   bang/cot cu. Idempotent - chay lai an toan, khong mat du lieu.
   ================================================================ */

USE QLNoiBo;
GO

/* ---- 1. PhanCongMay.MauSacID -> cho phep NULL (yeu cau v5.6 "không cần chọn mầu" o cong doan May) -
   SL cat theo mau da hien san (mauQtyRowsHtml, tu du lieu TienDoChiTietMau) de doi chieu, khong can bat
   nguoi dung chon lai mau moi lan giao viec. FK toi MauSac van giu nguyen (NULL van hop le voi FK). ---- */
IF EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'PhanCongMay' AND COLUMN_NAME = 'MauSacID' AND IS_NULLABLE = 'NO'
)
BEGIN
    ALTER TABLE PhanCongMay ALTER COLUMN MauSacID INT NULL;
    PRINT 'Da doi PhanCongMay.MauSacID sang cho phep NULL.';
END ELSE PRINT 'PhanCongMay.MauSacID da cho phep NULL (hoac khong ton tai), bo qua.';
GO

/* ---- 2. Cap nhat view vw_TonKhoVai: them 3 cot dem cay theo TUNG trang thai (Nguyen cay/Cay le/Het) -
   dung cho drilldown "kích vào trạng thái" o tab Ton kho TONG HOP (yeu cau v5.6 - truoc day drilldown
   nay CHI co o tab "Tồn theo cây", vi tab tong hop gop nhieu cay/nhieu trang thai chung 1 dong theo Ma
   vai, khong co san 1 cot Trang thai don le de bam vao). CREATE OR ALTER de idempotent - view khong
   luu du lieu nen chay lai an toan. */
CREATE OR ALTER VIEW vw_TonKhoVai AS
SELECT
    v.VaiID, v.MaVai, v.MaPM, lv.TenLoaiVai, lv.MaLoai, ms.TenMau,
    v.KhoVai, v.GSM, v.ViTriKho, v.TonToiThieuKG,
    ISNULL(SUM(c.KGNhap), 0) AS TongKGNhap,
    ISNULL(SUM(x.KGXuatTong), 0) AS TongKGXuat,
    ISNULL(SUM(c.KGNhap), 0) - ISNULL(SUM(x.KGXuatTong), 0) AS TonKG,
    COUNT(DISTINCT c.CayID) AS TongCayNhap,
    SUM(CASE WHEN c.TrangThai <> N'Hết' THEN 1 ELSE 0 END) AS CayConTon,
    SUM(CASE WHEN c.TrangThai = N'Nguyên cây' THEN 1 ELSE 0 END) AS SoCayNguyenCay,
    SUM(CASE WHEN c.TrangThai = N'Cây lẻ' THEN 1 ELSE 0 END) AS SoCayLe,
    SUM(CASE WHEN c.TrangThai = N'Hết' THEN 1 ELSE 0 END) AS SoCayHet
FROM DanhMucVai v
LEFT JOIN LoaiVai lv ON lv.LoaiVaiID = v.LoaiVaiID
LEFT JOIN MauSac ms ON ms.MauSacID = v.MauSacID
LEFT JOIN VaiCay c ON c.VaiID = v.VaiID
LEFT JOIN (
    SELECT CayID, SUM(KGXuat) AS KGXuatTong FROM PhieuXuatVaiChiTiet GROUP BY CayID
) x ON x.CayID = c.CayID
GROUP BY v.VaiID, v.MaVai, v.MaPM, lv.TenLoaiVai, lv.MaLoai, ms.TenMau, v.KhoVai, v.GSM, v.ViTriKho, v.TonToiThieuKG;
GO
PRINT 'Da cap nhat view vw_TonKhoVai (them SoCayNguyenCay/SoCayLe/SoCayHet).';
GO

/* ---- 3. Chuc nang moi QLSX.'tiendo' ("Ghi nhận tiến độ") - tach rieng khoi QLSX.'orders' ("Xem/Sửa
   lệnh sản xuất") - yeu cau v5.6 "nếu cho user sửa thì sửa được cả lệnh sản xuất... thêm chi tiết là
   được ghi nhận tiến độ, xem sửa lệnh sản xuất". Truoc day 1 chuc nang 'orders' duy nhat gate CA hai
   viec (sua thong tin lenh VA ghi nhan tien do/giao vai/phu kien/giao viec may/vendor/forcestage), nen
   khong the giao rieng "chi ghi tien do, khong sua duoc lenh" cho 1 nhom/user. Xem backend qlsx.js:
   cac route lien quan da doi sang requireChucNang('QLSX','tiendo'), CHI con GET/PUT/DELETE lenh + in
   phieu la con dung 'orders'. */
IF NOT EXISTS (SELECT 1 FROM ChucNang WHERE ModuleCode = 'QLSX' AND MaChucNang = 'tiendo')
BEGIN
    INSERT INTO ChucNang (ModuleCode, MaChucNang, TenChucNang, ThuTu)
    SELECT 'QLSX', 'tiendo', N'Ghi nhận tiến độ', ISNULL(MAX(ThuTu), 0) + 1 FROM ChucNang WHERE ModuleCode = 'QLSX';
    PRINT 'Da them chuc nang QLSX.tiendo (Ghi nhan tien do).';
END ELSE PRINT 'Chuc nang QLSX.tiendo da ton tai, bo qua.';
GO

/* ---- 4. Sao chep quyen HIEN CO cua 'orders' sang 'tiendo' cho TUNG NHOM (ChucNangPermissions) - giu
   nguyen hanh vi cho MOI nguoi dung ngay sau khi nang cap (ai dang sua/ghi tien do duoc thi van tiep
   tuc lam duoc ca 2 cho toi khi Admin chu dong vao "Ma trận phân quyền" tach rieng ra). Chi copy neu
   nhom do CHUA co dong rieng cho 'tiendo' (idempotent - chay lai khong ghi de tuy chinh da lam sau nay). */
INSERT INTO ChucNangPermissions (GroupID, ChucNangID, CanView, CanEdit, CanDelete)
SELECT gcp.GroupID, cnMoi.ChucNangID, gcp.CanView, gcp.CanEdit, gcp.CanDelete
FROM ChucNangPermissions gcp
JOIN ChucNang cnCu ON cnCu.ChucNangID = gcp.ChucNangID AND cnCu.ModuleCode = 'QLSX' AND cnCu.MaChucNang = 'orders'
JOIN ChucNang cnMoi ON cnMoi.ModuleCode = 'QLSX' AND cnMoi.MaChucNang = 'tiendo'
WHERE NOT EXISTS (
    SELECT 1 FROM ChucNangPermissions x WHERE x.GroupID = gcp.GroupID AND x.ChucNangID = cnMoi.ChucNangID
);
PRINT 'Da sao chep quyen theo NHOM tu QLSX.orders sang QLSX.tiendo (neu chua co).';
GO

/* ---- 5. Sao chep quyen ghi de RIENG TUNG USER (UserChucNangPermissions) - cung nguyen tac nhu muc 4,
   ap dung cho cac user co ghi de rieng (khac voi quyen mac dinh cua nhom). ---- */
INSERT INTO UserChucNangPermissions (UserID, ChucNangID, CanView, CanEdit, CanDelete)
SELECT ucp.UserID, cnMoi.ChucNangID, ucp.CanView, ucp.CanEdit, ucp.CanDelete
FROM UserChucNangPermissions ucp
JOIN ChucNang cnCu ON cnCu.ChucNangID = ucp.ChucNangID AND cnCu.ModuleCode = 'QLSX' AND cnCu.MaChucNang = 'orders'
JOIN ChucNang cnMoi ON cnMoi.ModuleCode = 'QLSX' AND cnMoi.MaChucNang = 'tiendo'
WHERE NOT EXISTS (
    SELECT 1 FROM UserChucNangPermissions x WHERE x.UserID = ucp.UserID AND x.ChucNangID = cnMoi.ChucNangID
);
PRINT 'Da sao chep quyen ghi de RIENG USER tu QLSX.orders sang QLSX.tiendo (neu chua co).';
GO

PRINT 'Hoan tat migration v5.6.';
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [13/81]  migration_v57.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [13/81] migration_v57.sql';
GO

/* ================================================================
   MIGRATION v5.7 — QLSX: them "Ma cong doan" cho danh muc Cong doan
   san xuat (Cat/May/Ky thuat...), luu VET SU KIEN don vi tinh da chon
   luc "Kho nhap" va ten nha gia cong TAI THOI DIEM ghi nhan "May" (de
   hien thi day du hon o Lich su cap nhat tien do / phieu in). Additive
   - KHONG xoa bang/cot cu, chi ALTER TABLE ADD cot moi NULL-able.
   Idempotent - chay lai an toan, khong mat du lieu.
   ================================================================ */

USE QLNoiBo;
GO

/* ---- 1. CongDoanSanXuat.MaCongDoan - yeu cau v5.7 "Danh mục Công đoạn sản xuất – thêm mã công đoạn,
   để công đoạn Ghi nhận tiến độ liên kết theo mã, không bị đứt khi đổi tên công đoạn". Chi them COT,
   KHONG doi cac cho dang so sanh truc tiep theo TenCongDoan trong code (qlsx.js) sang so sanh theo
   StageID/MaCongDoan - pham vi v5.7 dung o muc "them truong + hien thi trong danh muc" (xem
   HUONG_DAN_CAI_DAT.md - phan quyet dinh v5.7 - de biet ly do khong lam full refactor ngay). Cung
   pattern da dung cho CongDoanMay.MaCongDoan (migration_v5_qlsx.sql). */
IF COL_LENGTH('CongDoanSanXuat', 'MaCongDoan') IS NULL
    ALTER TABLE CongDoanSanXuat ADD MaCongDoan NVARCHAR(30) NULL;
GO

/* ---- 2. TienDoChiTietMau.DonViDaChon - yeu cau v5.7 "Lịch sử cập nhật tiến độ - Kho nhập hiển thị đơn
   vị tính". Truoc day don vi chon o cong doan "Kho nhap" (Cai/Ri) CHI dung TAM THOI de tinh delta cho
   The kho hang hoa (xem POST /orders/:maDH/tiendo) roi bi bo, khong luu lai lam ban ghi lich su - day
   la CHUA co du lieu de hien (khac loi hien thi/truy van don thuan), can them cot moi. Chi ap dung cho
   dong Kho nhap tu sau khi nang cap; du lieu Kho nhap TRUOC do se hien trong (khong bia them lich su
   khong co that). */
IF COL_LENGTH('TienDoChiTietMau', 'DonViDaChon') IS NULL
    ALTER TABLE TienDoChiTietMau ADD DonViDaChon NVARCHAR(30) NULL;
GO

/* ---- 3. TienDoSanXuat.TenNhaGiaCongTaiThoiDiem - yeu cau v5.7 "Lịch sử cập nhật tiến độ - May hiển thị
   tên nhà gia công". NhaGiaCongID tren DonHangSanXuat la 1 GIA TRI DUY NHAT bi GHI DE moi lan doi (xem
   openVendorForm/POST .../tiendo nhanh "Ky thuat"), khong co lich su rieng theo tung lan cap nhat "May".
   Chup lai (snapshot) ten nha gia cong HIEN TAI ngay luc ghi nhan tien do "May" vao cot moi nay - CHINH
   XAC cho tung lan ghi nhan tu sau khi nang cap, khong hoi to lai duoc cho du lieu "May" da co TRUOC do
   (se hien trong - phieu in van con hien 1 dong "Nha gia cong hien tai" rieng ngoai bang lich su, xem
   openPrint() trong module.qlsx.js, nen thong tin khong bi mat hoan toan). */
IF COL_LENGTH('TienDoSanXuat', 'TenNhaGiaCongTaiThoiDiem') IS NULL
    ALTER TABLE TienDoSanXuat ADD TenNhaGiaCongTaiThoiDiem NVARCHAR(200) NULL;
GO

PRINT 'Hoan tat migration v5.7.';
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [14/81]  migration_v58.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [14/81] migration_v58.sql';
GO

/* MIGRATION v5.8 — QLSX: them NhaGiaCong.LaNoiBo (BIT) de xac dinh CHINH XAC dong "Nha Lam" trong danh
   muc Nha gia cong, thay cho so sanh CHUOI TenNha = N'Nhà Làm' mong manh (doi ten/thua khoang trang o
   Danh muc se lam sai logic bo qua cong doan May / hien khoi "Giao viec noi bo"). Additive, idempotent -
   an toan chay lai nhieu lan va khong anh huong du lieu hien co. */
USE QLNoiBo;
GO

IF COL_LENGTH('NhaGiaCong', 'LaNoiBo') IS NULL
BEGIN
    ALTER TABLE NhaGiaCong ADD LaNoiBo BIT NOT NULL DEFAULT 0;
END
GO

-- Danh dau dong "Nha Lam" hien co (seed tu schema.sql) la LaNoiBo = 1. Idempotent: chi set lai neu
-- dang la 0, khong gay loi/thay doi gi neu chay lai lan nua.
UPDATE NhaGiaCong SET LaNoiBo = 1 WHERE TenNha = N'Nhà Làm' AND LaNoiBo = 0;
GO

PRINT 'Hoan tat migration v5.8.';
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [15/81]  migration_v59.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [15/81] migration_v59.sql';
GO

/* ================================================================
   migration_v59.sql - Nang cap tu v5.8 len v5.9

   Yeu cau: "Mã công đoạn" cho Công đoạn sản xuất — mở rộng thành sửa lại
   TOÀN BỘ các chỗ trong qlsx.js (và các file liên quan) đang so sánh trực
   tiếp theo TÊN công đoạn (renderStageFields, hằng số TEN_CONG_DOAN_MAY,
   các câu lệnh WHERE TenCongDoan=N'...') sang so sánh theo mã/StageID.

   v5.7 da them cot CongDoanSanXuat.MaCongDoan nhung CHI dung de hien
   thi/tra cuu trong Danh muc - chua khoa, chua duoc code dung cho logic
   that su (van con nguyen rui ro: doi TEN cong doan trong Danh muc lam
   gian doan luong Ghi nhan tien do, bao cao nang suat, phan quyen theo
   cong doan...).

   Dot nay (code da doi xong o backend/frontend, xem HUONG_DAN_CAI_DAT.md
   Buoc 2.13):
   1. Them CongDoanSanXuat.LaHeThong (BIT) - danh dau 8 cong doan HE THONG
      goc (Ky thuat/Giao vai/Phu kien/Cat/May/Hoan thien/Kho nhap/Dong goi).
      Cot nay la CHOT AN TOAN: neu MaCongDoan van tu do sua duoc nhu
      TenCongDoan truoc day thi coi nhu chi CHUYEN fragility sang cho khac,
      khong that su fix duoc gi - LaHeThong=1 se bi backend (xem
      backend/routes/danhmuc.js, PUT/DELETE /congdoan/:id) CHAN sua/xoa
      MaCongDoan cua chinh dong do.
   2. Backfill MaCongDoan canonical (KT/GV/PK/CAT/MAY/HT/KN/DG) + LaHeThong=1
      cho 8 cong doan he thong, khop theo TenCongDoan HIEN TAI. Neu 1 trong
      8 ten nay da bi doi TRUOC khi chay migration nay (vd ai do da sua
      "Cắt" thanh ten khac o ban v5.8 tro ve truoc), script se KHONG khop
      duoc dong do va se PRINT canh bao - can tu gan MaCongDoan/LaHeThong
      thu cong qua SSMS cho dung dong tuong ung (xem Buoc 2.13).
   3. Filtered unique index tren MaCongDoan (cho phep nhieu dong NULL - cac
      cong doan tuy chinh nguoi dung tu them sau nay chua chac co ma - nhung
      khong cho 2 dong CUNG 1 ma khac NULL, tranh nham lan).

   LUU Y PHAM VI: day la bang CongDoanSanXuat (cac CONG DOAN SAN XUAT /
   STAGE - Ky thuat, Cat, May...), KHAC voi bang CongDoanMay (danh muc CAC
   THAO TAC MAY - vd "Ráp cổ", "Vắt sổ" - da dung CongDoanMayID lam FK moi
   noi tu truoc, khong can sua gi them o dot nay).
   ================================================================ */

IF COL_LENGTH('CongDoanSanXuat', 'LaHeThong') IS NULL
BEGIN
    ALTER TABLE CongDoanSanXuat ADD LaHeThong BIT NOT NULL DEFAULT 0;
    PRINT 'Da them cot CongDoanSanXuat.LaHeThong.';
END ELSE PRINT 'Cot CongDoanSanXuat.LaHeThong da ton tai, bo qua.';
GO

-- Backfill ma cong doan canonical + khoa (LaHeThong=1) cho 8 cong doan he thong,
-- khop theo TEN HIEN TAI (dung nguyen ban tu schema.sql + migration_v52_qlsx.sql).
-- An toan chay lai nhieu lan (cung dieu kien, cung gia tri gan lai).
UPDATE CongDoanSanXuat SET MaCongDoan = 'KT',  LaHeThong = 1 WHERE TenCongDoan = N'Kỹ thuật';
UPDATE CongDoanSanXuat SET MaCongDoan = 'GV',  LaHeThong = 1 WHERE TenCongDoan = N'Giao vải';
UPDATE CongDoanSanXuat SET MaCongDoan = 'PK',  LaHeThong = 1 WHERE TenCongDoan = N'Phụ kiện';
UPDATE CongDoanSanXuat SET MaCongDoan = 'CAT', LaHeThong = 1 WHERE TenCongDoan = N'Cắt';
UPDATE CongDoanSanXuat SET MaCongDoan = 'MAY', LaHeThong = 1 WHERE TenCongDoan = N'May';
UPDATE CongDoanSanXuat SET MaCongDoan = 'HT',  LaHeThong = 1 WHERE TenCongDoan = N'Hoàn thiện';
UPDATE CongDoanSanXuat SET MaCongDoan = 'KN',  LaHeThong = 1 WHERE TenCongDoan = N'Kho nhập';
UPDATE CongDoanSanXuat SET MaCongDoan = 'DG',  LaHeThong = 1 WHERE TenCongDoan = N'Đóng gói';
GO

-- Canh bao neu khong du 8 dong duoc khoa (vd 1 ten da bi doi truoc khi nang cap) - KHONG chan migration,
-- chi in canh bao de nguoi trien khai tu kiem tra lai thu cong qua SSMS truoc khi coi nhu xong.
DECLARE @locked INT = (SELECT COUNT(*) FROM CongDoanSanXuat WHERE LaHeThong = 1);
IF @locked < 8
    PRINT 'CANH BAO: chi khoa duoc ' + CAST(@locked AS NVARCHAR) + '/8 cong doan he thong - kiem tra lai TenCongDoan cua Ky thuat/Giao vai/Phu kien/Cat/May/Hoan thien/Kho nhap/Dong goi co bi doi ten truoc khi nang cap khong (xem HUONG_DAN_CAI_DAT.md Buoc 2.13) va tu gan MaCongDoan + LaHeThong=1 thu cong cho dung dong qua SSMS neu can.';
ELSE
    PRINT 'Da khoa du 8/8 cong doan he thong voi ma tuong ung (KT/GV/PK/CAT/MAY/HT/KN/DG).';
GO

-- Filtered unique index: cho phep nhieu dong MaCongDoan = NULL (cong doan tuy chinh chua gan ma),
-- nhung khong cho 2 dong CUNG 1 ma khac NULL (tranh nham lan neu sau nay ai do vo tinh dat trung ma).
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_CongDoanSanXuat_MaCongDoan')
BEGIN
    CREATE UNIQUE INDEX UQ_CongDoanSanXuat_MaCongDoan ON CongDoanSanXuat(MaCongDoan) WHERE MaCongDoan IS NOT NULL;
    PRINT 'Da them unique index UQ_CongDoanSanXuat_MaCongDoan.';
END ELSE PRINT 'Index UQ_CongDoanSanXuat_MaCongDoan da ton tai, bo qua.';
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [16/81]  migration_v513.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [16/81] migration_v513.sql';
GO

/* ================================================================
   migration_v513.sql - Nang cap tu v5.12 len v5.13

   Yeu cau (Quan ly san xuat, 1 dot lon gom nhieu muc - xem HUONG_DAN_CAI_DAT.md
   Buoc 2.18 de biet chi tiet tung muc va ly do chon giai phap):

   1.1 Ra lenh san xuat:
       - Bo "Tong so luong" nhap tay - tu tinh tu tong SL cac dong mau CHINH
         trong Cau truc vai (xem POST/PUT /orders trong qlsx.js).
       - Them "He so quy doi" (Cai/Ri) O DON HANG - dung CHUNG cho cong doan
         Cat thay vi phai nhap lai o TUNG cay vai moi lan Ghi tien do.
       - Cau truc vai: them hang "Tong cong" (SL + SL sau quy doi), them Loai
         vai/Mau moi ngay tai cho (goi lai /api/danhmuc/loaivai,mausac da co
         san), o chon go tim duoc (searchableSelectHtml da co san).

   1.2 Ghi nhan tien do:
       - Ky thuat: "Met so do"/"Kho vai so do" tu 1 bo gia tri DUY NHAT tren
         TienDoSanXuat (khong doi duoc, khong ghi chu rieng) sang NHIEU "so
         do" moi don hang (bang moi DonHangChiTietSoDo, dung CHUNG mo hinh
         voi Giao vai/Phu kien - danh sach rieng, luu ngay qua nut "Luu",
         doc lap voi lan "Gui" chinh cua form Ghi tien do).
       - Ky thuat: "Giao nha gia cong" gio co THEM 1 danh sach chi tiet
         (DonHangChiTietNhaGiaCong) cho phep nhieu nha gia cong + ghi chu -
         DAY LA BO SUNG, KHONG thay the o chon don-nha-gia-cong hien co
         (DonHangSanXuat.NhaGiaCongID) - o do van la nguon du lieu DUY NHAT
         quyet dinh co bo qua cong doan May hay khong (tinhNextStage() trong
         qlsx.js) va hien thi o Dashboard/bao cao vendor; doi thanh nhieu gia
         tri se pha vo logic dieu huong 1-doi-1 do. Xem ghi chu chi tiet
         ngay tren khai bao route /nhagiacongchitiet trong qlsx.js.
       - Cat: them lua chon "So do" (chi hien khi don hang co > 1 dong trong
         DonHangChiTietSoDo) va bo o nhap "He so" tren tung cay - gio lay
         thang tu DonHangSanXuat.HeSoQuyDoi (server tinh, khong con tin theo
         gia tri client gui).

   Bang moi: DonHangChiTietSoDo, DonHangChiTietNhaGiaCong.
   Cot moi: DonHangSanXuat.HeSoQuyDoi, TienDoSanXuat.SoDoID (FK toi dong so
   do DA DUNG cho lan Ghi tien do Cat nay - NULL cho cac cong doan khac hoac
   don hang chua khai bao so do nao).

   An toan chay lai nhieu lan (idempotent) - dung IF COL_LENGTH/OBJECT_ID
   giong cac migration truoc.
   ================================================================ */

IF COL_LENGTH('DonHangSanXuat', 'HeSoQuyDoi') IS NULL
BEGIN
    ALTER TABLE DonHangSanXuat ADD HeSoQuyDoi DECIMAL(10,3) NOT NULL DEFAULT 1;
    PRINT 'Da them cot DonHangSanXuat.HeSoQuyDoi.';
END ELSE PRINT 'Cot DonHangSanXuat.HeSoQuyDoi da ton tai, bo qua.';
GO

IF OBJECT_ID('DonHangChiTietSoDo') IS NULL
BEGIN
    CREATE TABLE DonHangChiTietSoDo (
        ID           INT IDENTITY(1,1) PRIMARY KEY,
        DonHangID    INT NOT NULL FOREIGN KEY REFERENCES DonHangSanXuat(DonHangID) ON DELETE CASCADE,
        MetSoDoDai   DECIMAL(10,2) NULL,
        KhoVaiSoDo   DECIMAL(10,2) NULL,
        MaRap        NVARCHAR(50) NULL,
        GhiChu       NVARCHAR(255) NULL,
        CreatedAt    DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    PRINT 'Da tao bang DonHangChiTietSoDo.';
END ELSE PRINT 'Bang DonHangChiTietSoDo da ton tai, bo qua.';
GO

IF COL_LENGTH('TienDoSanXuat', 'SoDoID') IS NULL
BEGIN
    ALTER TABLE TienDoSanXuat ADD SoDoID INT NULL FOREIGN KEY REFERENCES DonHangChiTietSoDo(ID);
    PRINT 'Da them cot TienDoSanXuat.SoDoID.';
END ELSE PRINT 'Cot TienDoSanXuat.SoDoID da ton tai, bo qua.';
GO

IF OBJECT_ID('DonHangChiTietNhaGiaCong') IS NULL
BEGIN
    CREATE TABLE DonHangChiTietNhaGiaCong (
        ID           INT IDENTITY(1,1) PRIMARY KEY,
        DonHangID    INT NOT NULL FOREIGN KEY REFERENCES DonHangSanXuat(DonHangID) ON DELETE CASCADE,
        NhaGiaCongID INT NOT NULL FOREIGN KEY REFERENCES NhaGiaCong(NhaGiaCongID),
        GhiChu       NVARCHAR(255) NULL,
        CreatedAt    DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    PRINT 'Da tao bang DonHangChiTietNhaGiaCong.';
END ELSE PRINT 'Bang DonHangChiTietNhaGiaCong da ton tai, bo qua.';
GO

-- Backfill HeSoQuyDoi cho don hang DA CO tu truoc nang cap, tu he so Cat GAN NHAT
-- da tung nhap tay cho don do (neu da co Ghi tien do Cat) - tranh SL cai tinh sai
-- lech nếu ho quay lai Sua/xem sau nang cap. Don chua tung ghi nhan Cat -> giu
-- mac dinh 1 (DEFAULT o cau ALTER TABLE tren).
UPDATE d
SET d.HeSoQuyDoi = t.HeSo
FROM DonHangSanXuat d
CROSS APPLY (
    SELECT TOP 1 c.HeSoQuyDoi AS HeSo
    FROM TienDoCatChiTietCay c
    JOIN TienDoSanXuat td ON td.TienDoID = c.TienDoID
    WHERE td.DonHangID = d.DonHangID
    ORDER BY td.TienDoID DESC
) t
WHERE t.HeSo IS NOT NULL;
PRINT 'Da backfill HeSoQuyDoi cho don hang da co tien do Cat truoc do (neu co).';
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [17/81]  migration_v514.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [17/81] migration_v514.sql';
GO

/* ================================================================
   migration_v514.sql - Nang cap tu v5.13 len v5.14

   Yeu cau: bo sung chuc nang moi "Tai lieu ky thuat" trong phan he Quan ly
   san xuat (xem HUONG_DAN_CAI_DAT.md Buoc 2.19 de biet chi tiet tung muc va
   ly do chon giai phap), gom 4 chuc nang con:

     1. Tai lieu ky thuat chung - form nhap lieu theo mau
        tieuchuankythuatchung.docx (cac "muc" danh so, moi muc co 1 tieu de +
        nhieu dong noi dung - them duoc CA muc lan dong). Co "tai lieu mau"
        dung chung nhieu lan (LaMau=1, khong gan don hang cu the), khi tao
        tai lieu cho 1 don hang co the chon "lay tu tai lieu mau".
     2. Thong so do - form nhap lieu theo mau thongsodo.docx (bang Size x Vi
        tri do), them duoc CA dong (size) LAN cot (vi tri do moi).
     3. Chi dinh NPL - RUT RA khoi cong doan "Phu kien" trong Ghi nhan tien do
        thanh 1 man hinh doc lap - KHONG tao bang moi, dung lai NGUYEN VEN
        DonHangChiTietPhuKien + 3 route CRUD da co san
        (GET/POST/DELETE /api/qlsx/orders/:maDH/phukien, van gate theo
        chuc nang QLSX/tiendo nhu cu - xem qlsx.js, KHONG doi).
     4. Mo ta san pham - form nhap lieu theo mau motasanpham.docx (luoi cac o
        "Khoang trong" de dan/tai anh, them duoc dong lan cot), co truong
        "Chu y" tu do.

   QUYET DINH THIET KE quan trong (Chi dinh NPL, khong doi schema o day):
   Cong doan "Phu kien" (CongDoanSanXuat.MaCongDoan='PK', LaHeThong=1) VAN
   GIU NGUYEN 100% trong chuoi tien do san xuat - khong doi ThuTu, khong xoa,
   khong doi LaHeThong, khong dong toi tinhNextStage()/lich su TienDoSanXuat/
   phan quyen theo cong doan. Cai DUY NHAT thay doi la GIAO DIEN nhap lieu -
   xem module.qlsx.js (da bo renderPhuKienBox khoi renderStageFields('PK'),
   thay bang 1 dong thong bao + nut dan sang man hinh moi) va
   module.tailieukythuat.js (man hinh "Chi dinh NPL" moi, goi lai DUNG 3
   route cu). Moi noi dang doc DonHangChiTietPhuKien (Phieu xuat phu kien,
   Bao cao don hang...) khong bi anh huong vi bang/route khong doi.

   Bang moi: TaiLieuKyThuatChung(+Muc,+Dong), TaiLieuThongSoDo(+Cot,+Dong,
   +GiaTri), TaiLieuMoTaSanPham(+O). Them 1 chuc nang QLSX/tailieukythuat.

   An toan chay lai nhieu lan (idempotent) - dung IF OBJECT_ID/COL_LENGTH/
   sys.indexes giong cac migration truoc.
   ================================================================ */

-- ============ 1. TAI LIEU KY THUAT CHUNG ============
-- LaMau=1 -> "tai lieu mau" dung chung nhieu lan (DonHangID phai NULL).
-- LaMau=0 -> gan DUNG 1 don hang cu the (DonHangID bat buoc, unique loc theo
-- LaMau=0 nen 1 don hang chi co toi da 1 ban "khong phai mau").
IF OBJECT_ID('TaiLieuKyThuatChung') IS NULL
BEGIN
    CREATE TABLE TaiLieuKyThuatChung (
        ID           INT IDENTITY(1,1) PRIMARY KEY,
        DonHangID    INT NULL FOREIGN KEY REFERENCES DonHangSanXuat(DonHangID) ON DELETE CASCADE,
        LaMau        BIT NOT NULL DEFAULT 0,
        TenMau       NVARCHAR(255) NULL,
        MaHang       NVARCHAR(50) NULL,
        DienGiai     NVARCHAR(255) NULL,
        NgayCapNhat  DATE NULL,
        NguoiLapID   INT NULL FOREIGN KEY REFERENCES Users(UserID),
        CreatedAt    DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        UpdatedAt    DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    PRINT 'Da tao bang TaiLieuKyThuatChung.';
END ELSE PRINT 'Bang TaiLieuKyThuatChung da ton tai, bo qua.';
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_TLKTC_DonHang')
    CREATE UNIQUE INDEX UQ_TLKTC_DonHang ON TaiLieuKyThuatChung(DonHangID) WHERE LaMau = 0;
GO

IF OBJECT_ID('TaiLieuKyThuatChungMuc') IS NULL
BEGIN
    CREATE TABLE TaiLieuKyThuatChungMuc (
        ID        INT IDENTITY(1,1) PRIMARY KEY,
        TaiLieuID INT NOT NULL FOREIGN KEY REFERENCES TaiLieuKyThuatChung(ID) ON DELETE CASCADE,
        ThuTu     INT NOT NULL DEFAULT 0,
        TieuDe    NVARCHAR(500) NULL
    );
    PRINT 'Da tao bang TaiLieuKyThuatChungMuc.';
END ELSE PRINT 'Bang TaiLieuKyThuatChungMuc da ton tai, bo qua.';
GO

IF OBJECT_ID('TaiLieuKyThuatChungDong') IS NULL
BEGIN
    CREATE TABLE TaiLieuKyThuatChungDong (
        ID      INT IDENTITY(1,1) PRIMARY KEY,
        MucID   INT NOT NULL FOREIGN KEY REFERENCES TaiLieuKyThuatChungMuc(ID) ON DELETE CASCADE,
        NoiDung NVARCHAR(MAX) NULL,
        ThuTu   INT NOT NULL DEFAULT 0
    );
    PRINT 'Da tao bang TaiLieuKyThuatChungDong.';
END ELSE PRINT 'Bang TaiLieuKyThuatChungDong da ton tai, bo qua.';
GO

-- ============ 2. THONG SO DO ============
IF OBJECT_ID('TaiLieuThongSoDo') IS NULL
BEGIN
    CREATE TABLE TaiLieuThongSoDo (
        ID           INT IDENTITY(1,1) PRIMARY KEY,
        DonHangID    INT NOT NULL FOREIGN KEY REFERENCES DonHangSanXuat(DonHangID) ON DELETE CASCADE,
        MaHang       NVARCHAR(50) NULL,
        DienGiai     NVARCHAR(255) NULL,
        NgayCapNhat  DATE NULL,
        NguoiLapID   INT NULL FOREIGN KEY REFERENCES Users(UserID),
        CreatedAt    DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        UpdatedAt    DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    PRINT 'Da tao bang TaiLieuThongSoDo.';
END ELSE PRINT 'Bang TaiLieuThongSoDo da ton tai, bo qua.';
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_TLTSD_DonHang')
    CREATE UNIQUE INDEX UQ_TLTSD_DonHang ON TaiLieuThongSoDo(DonHangID);
GO

IF OBJECT_ID('TaiLieuThongSoDoCot') IS NULL
BEGIN
    CREATE TABLE TaiLieuThongSoDoCot (
        ID        INT IDENTITY(1,1) PRIMARY KEY,
        TaiLieuID INT NOT NULL FOREIGN KEY REFERENCES TaiLieuThongSoDo(ID) ON DELETE CASCADE,
        TenCot    NVARCHAR(255) NOT NULL,
        ThuTu     INT NOT NULL DEFAULT 0
    );
    PRINT 'Da tao bang TaiLieuThongSoDoCot.';
END ELSE PRINT 'Bang TaiLieuThongSoDoCot da ton tai, bo qua.';
GO

IF OBJECT_ID('TaiLieuThongSoDoDong') IS NULL
BEGIN
    CREATE TABLE TaiLieuThongSoDoDong (
        ID        INT IDENTITY(1,1) PRIMARY KEY,
        TaiLieuID INT NOT NULL FOREIGN KEY REFERENCES TaiLieuThongSoDo(ID) ON DELETE CASCADE,
        TenDong   NVARCHAR(100) NOT NULL,
        ThuTu     INT NOT NULL DEFAULT 0
    );
    PRINT 'Da tao bang TaiLieuThongSoDoDong.';
END ELSE PRINT 'Bang TaiLieuThongSoDoDong da ton tai, bo qua.';
GO

IF OBJECT_ID('TaiLieuThongSoDoGiaTri') IS NULL
BEGIN
    CREATE TABLE TaiLieuThongSoDoGiaTri (
        ID     INT IDENTITY(1,1) PRIMARY KEY,
        DongID INT NOT NULL FOREIGN KEY REFERENCES TaiLieuThongSoDoDong(ID) ON DELETE CASCADE,
        CotID  INT NOT NULL FOREIGN KEY REFERENCES TaiLieuThongSoDoCot(ID),
        GiaTri NVARCHAR(50) NULL
    );
    PRINT 'Da tao bang TaiLieuThongSoDoGiaTri.';
END ELSE PRINT 'Bang TaiLieuThongSoDoGiaTri da ton tai, bo qua.';
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_TLTSDGT_Dong_Cot')
    CREATE UNIQUE INDEX UQ_TLTSDGT_Dong_Cot ON TaiLieuThongSoDoGiaTri(DongID, CotID);
GO

-- ============ 4. MO TA SAN PHAM ============
IF OBJECT_ID('TaiLieuMoTaSanPham') IS NULL
BEGIN
    CREATE TABLE TaiLieuMoTaSanPham (
        ID           INT IDENTITY(1,1) PRIMARY KEY,
        DonHangID    INT NOT NULL FOREIGN KEY REFERENCES DonHangSanXuat(DonHangID) ON DELETE CASCADE,
        MaHang       NVARCHAR(50) NULL,
        DienGiai     NVARCHAR(255) NULL,
        NgayCapNhat  DATE NULL,
        NguoiLapID   INT NULL FOREIGN KEY REFERENCES Users(UserID),
        ChuY         NVARCHAR(MAX) NULL,
        CreatedAt    DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        UpdatedAt    DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    PRINT 'Da tao bang TaiLieuMoTaSanPham.';
END ELSE PRINT 'Bang TaiLieuMoTaSanPham da ton tai, bo qua.';
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_TLMTSP_DonHang')
    CREATE UNIQUE INDEX UQ_TLMTSP_DonHang ON TaiLieuMoTaSanPham(DonHangID);
GO

IF OBJECT_ID('TaiLieuMoTaSanPhamO') IS NULL
BEGIN
    CREATE TABLE TaiLieuMoTaSanPhamO (
        ID        INT IDENTITY(1,1) PRIMARY KEY,
        TaiLieuID INT NOT NULL FOREIGN KEY REFERENCES TaiLieuMoTaSanPham(ID) ON DELETE CASCADE,
        Dong      INT NOT NULL DEFAULT 0,
        Cot       INT NOT NULL DEFAULT 0,
        AnhUrl    NVARCHAR(500) NULL,
        ChuThich  NVARCHAR(255) NULL
    );
    PRINT 'Da tao bang TaiLieuMoTaSanPhamO.';
END ELSE PRINT 'Bang TaiLieuMoTaSanPhamO da ton tai, bo qua.';
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_TLMTSPO_Dong_Cot')
    CREATE UNIQUE INDEX UQ_TLMTSPO_Dong_Cot ON TaiLieuMoTaSanPhamO(TaiLieuID, Dong, Cot);
GO

-- ============ 5. CHUC NANG (phan quyen) ============
-- 1 ma chuc nang DUY NHAT cho ca 4 man hinh con (giong cach 'tiendo' gom nhieu
-- man hinh con cua Ghi nhan tien do) - rieng thao tac Luu/Xoa cua "Chi dinh
-- NPL" van tiep tuc gate theo QLSX/tiendo nhu truoc (dung lai route cu), CHI
-- rieng viec HIEN/AN muc "Chi dinh NPL" trong danh sach 4 chuc nang con la
-- theo QLSX/tailieukythuat - xem ghi chu trong module.tailieukythuat.js.
IF NOT EXISTS (SELECT 1 FROM ChucNang WHERE ModuleCode = 'QLSX' AND MaChucNang = 'tailieukythuat')
BEGIN
    INSERT INTO ChucNang (ModuleCode, MaChucNang, TenChucNang, ThuTu)
    SELECT 'QLSX', 'tailieukythuat', N'Tài liệu kỹ thuật', ISNULL(MAX(ThuTu), 0) + 1
    FROM ChucNang WHERE ModuleCode = 'QLSX';
    PRINT 'Da them chuc nang QLSX/tailieukythuat.';
END ELSE PRINT 'Chuc nang QLSX/tailieukythuat da ton tai, bo qua.';
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [18/81]  migration_v516.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [18/81] migration_v516.sql';
GO

/* ================================================================
   migration_v516.sql - Nang cap tu v5.15 len v5.16

   Yeu cau lien quan schema (xem HUONG_DAN_CAI_DAT.md Buoc 2.21 cho toan bo
   9 muc cua dot nay, phan lon la thay doi frontend/backend logic thuan tuy,
   khong dong schema):

     Muc 2.2.1/2.2.2 - Cong doan "Cắt": khi don hang khai bao >= 2 dong "sơ đồ"
     (DonHangChiTietSoDo, xem migration_v513.sql), man hinh Ghi nhan tien do
     Cat gio tach thanh N form RIENG (1 form/so do) thay vi 1 form phang dung
     chung 1 o chon so do nhu truoc (v5.13). Nop 1 lan (1 nut "Gửi" duy nhat)
     se tao NHIEU ban ghi TienDoSanXuat - 1 ban ghi/so do CO du lieu nhap -
     thay vi CHI 1 ban ghi nhu truoc gio. De "Tổng số bàn cắt" (tham khao, xem
     getStageCayCount() trong qlsx.js) cong don DUNG qua ca N ban ghi nay (thay
     vi chi tinh rieng 1 ban ghi "moi nhat" nhu quy uoc cu, se bi thieu neu chi
     tinh 1/N ban ghi), can 1 cot MOI de "danh dau" cac ban ghi nay thuoc CUNG
     1 lan nop - xem TienDoSanXuat.NhomTienDoID duoi day.

   An toan chay lai nhieu lan (idempotent) - dung IF COL_LENGTH/sys.indexes
   giong cac migration truoc (vd migration_v58.sql, migration_v513.sql).
   ================================================================ */

-- ============ TienDoSanXuat.NhomTienDoID ============
-- NULL cho MOI ban ghi tu truoc gio (submission "1-form-1-ban-ghi" nhu cu,
-- van la truong hop pho bien nhat - don hang chi co 0/1 so do). CHI duoc set
-- (bang chinh TienDoID cua ban ghi DAU TIEN trong lan nop) khi 1 lan Gửi tao
-- ra >= 2 ban ghi cung luc (don hang co >= 2 so do) - xem POST
-- /orders/:maDH/tiendo trong qlsx.js. Tu tham chieu (self-FK) vi luon tro toi
-- 1 TienDoID KHAC (hoac chinh no) DA TON TAI trong CUNG bang, dam bao toan
-- ven du lieu ma khong can bang phu.
IF COL_LENGTH('TienDoSanXuat', 'NhomTienDoID') IS NULL
BEGIN
    ALTER TABLE TienDoSanXuat ADD NhomTienDoID INT NULL FOREIGN KEY REFERENCES TienDoSanXuat(TienDoID);
    PRINT 'Da them cot TienDoSanXuat.NhomTienDoID.';
END ELSE PRINT 'Cot TienDoSanXuat.NhomTienDoID da ton tai, bo qua.';
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_TienDoSanXuat_NhomTienDoID')
    CREATE INDEX IX_TienDoSanXuat_NhomTienDoID ON TienDoSanXuat(NhomTienDoID) WHERE NhomTienDoID IS NOT NULL;
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [19/81]  migration_v517.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [19/81] migration_v517.sql';
GO

/* ================================================================
   migration_v517.sql - Nang cap tu v5.16 len v5.17

   Yeu cau: phan he "Thẻ kho hàng hóa" bo sung:
     1.1 - 2 truong moi trong Tao/Sua the kho: Gia Aloha, Ma Barcode.
     1.2 - chuc nang moi "Báo giá Aloha" (thiet ke theo file mau nguoi dung
           cung cap - "Danh sách các mặt hàng mở mã mới" cua CTY TNHH Thai
           Hung, phong mua hang) - 2 chuc nang con:
       1.2.1 Tao bao gia: chon nhieu ma hang tu The kho hang hoa (CHI hien
             ma hang CHUA tung xuat hien o bat ky bao gia nao truoc do - moi
             ma hang chi duoc bao gia DUNG 1 LAN trong toan he thong, ep bang
             UNIQUE tren BaoGiaAlohaChiTiet.MaHangID ben duoi), luu + xuat
             Excel.
       1.2.2 Danh sach bao gia: liet ke cac bao gia da tao, xuat Excel tung
             bao gia rieng.

   Gia Aloha (TheKhoHangHoa.GiaAloha) anh xa vao cot "Giá trước VAT" cua file
   xuat; Ma Barcode (TheKhoHangHoa.MaBarcode) anh xa vao cot "Mã Barcode" -
   dung theo dung chu thich trong file mau nguoi dung gui ("lấy từ trường giá
   Aloha trong Tạo thẻ kho hàng hóa" / "lấy từ trường Mã Bardcode trong tạo
   thẻ kho mới").

   An toan chay lai nhieu lan (idempotent) - dung COL_LENGTH/OBJECT_ID/
   sys.indexes giong cac migration truoc.
   ================================================================ */

-- ============ 1.1. TheKhoHangHoa.GiaAloha + MaBarcode ============
IF COL_LENGTH('TheKhoHangHoa', 'GiaAloha') IS NULL
BEGIN
    ALTER TABLE TheKhoHangHoa ADD GiaAloha DECIMAL(14,2) NULL;
    PRINT 'Da them cot TheKhoHangHoa.GiaAloha.';
END ELSE PRINT 'Cot TheKhoHangHoa.GiaAloha da ton tai, bo qua.';
GO

IF COL_LENGTH('TheKhoHangHoa', 'MaBarcode') IS NULL
BEGIN
    ALTER TABLE TheKhoHangHoa ADD MaBarcode NVARCHAR(50) NULL;
    PRINT 'Da them cot TheKhoHangHoa.MaBarcode.';
END ELSE PRINT 'Cot TheKhoHangHoa.MaBarcode da ton tai, bo qua.';
GO

-- vw_TonKhoHangHoa liet ke cot tuong minh (khong SELECT *) nen phai cap nhat lai
-- de GiaAloha/MaBarcode duoc tra ve cho man hinh Danh sach/Sua the kho. Dung
-- CREATE OR ALTER VIEW theo dung tien le migration_v54.sql (an toan chay lai).
CREATE OR ALTER VIEW vw_TonKhoHangHoa AS
SELECT
    h.MaHangID, h.MaHang, h.TenHang, h.GiaBan, h.LoaiRi, h.AnhDaiDien, tk.TenTheKho,
    h.LoaiHang, h.DonHangID, h.DonViCoBan, h.DonViQuyDoi, d.MaDH,
    h.GiaAloha, h.MaBarcode,
    ISNULL(SUM(ct.SoCatCai), 0) AS TongSoCat,
    ISNULL(SUM(ct.NhapCai), 0) AS TongNhap,
    ISNULL(SUM(ct.XuatCai), 0) AS TongXuat,
    ISNULL(SUM(ct.NhapCai - ct.XuatCai), 0) AS TongTon
FROM TheKhoHangHoa h
LEFT JOIN TheKhoDanhMuc tk ON tk.TheKhoDanhMucID = h.TheKhoDanhMucID
LEFT JOIN TheKhoChiTietMau ct ON ct.MaHangID = h.MaHangID
LEFT JOIN DonHangSanXuat d ON d.DonHangID = h.DonHangID
GROUP BY h.MaHangID, h.MaHang, h.TenHang, h.GiaBan, h.LoaiRi, h.AnhDaiDien, tk.TenTheKho,
         h.LoaiHang, h.DonHangID, h.DonViCoBan, h.DonViQuyDoi, d.MaDH, h.GiaAloha, h.MaBarcode;
PRINT 'Da cap nhat view vw_TonKhoHangHoa (them GiaAloha, MaBarcode).';
GO

-- ============ 1.2. BAO GIA ALOHA ============
-- Header - 1 dong = 1 lan tao bao gia. TenCongTySanXuatNhapKhau/MaNCC/TenNCC
-- khai bao 1 LAN cho ca bao gia (khop voi file mau: o "Tên Công ty Sản Xuất/
-- Nhập Khẩu" va "Tên NCC" gop o (merge) xuyen suot moi dong hang trong CUNG
-- 1 bao gia - nghia la 1 gia tri DUY NHAT ap dung cho ca lo hang dang de nghi
-- mo ma, khong doi tung dong).
IF OBJECT_ID('BaoGiaAloha') IS NULL
BEGIN
    CREATE TABLE BaoGiaAloha (
        ID                          INT IDENTITY(1,1) PRIMARY KEY,
        TenBaoGia                  NVARCHAR(255) NULL,
        NgayTao                    DATE NOT NULL DEFAULT CAST(SYSDATETIME() AS DATE),
        TenCongTySanXuatNhapKhau   NVARCHAR(255) NULL,
        MaNCC                      NVARCHAR(50) NULL,
        TenNCC                     NVARCHAR(255) NULL,
        GhiChu                     NVARCHAR(255) NULL,
        NguoiTaoID                 INT NULL FOREIGN KEY REFERENCES Users(UserID),
        CreatedAt                  DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    PRINT 'Da tao bang BaoGiaAloha.';
END ELSE PRINT 'Bang BaoGiaAloha da ton tai, bo qua.';
GO

-- Chi tiet (dong hang) - UNIQUE tren MaHangID (KHONG phai UNIQUE(BaoGiaAlohaID,
-- MaHangID)) la co y: yeu cau nguoi dung "mã hàng đã chọn ở báo giá trước thì
-- không hiện ra nữa" khi tao bao gia MOI - nghia la 1 ma hang chi duoc xuat
-- hien o DUNG 1 bao gia trong toan bo lich su, khong phai chi loai tru khoi
-- bao gia GAN NHAT. Rang buoc nay ep dung ngay o tang du lieu (khong chi loc
-- o frontend), tranh truong hop 2 nguoi cung tao bao gia dong thoi chon trung
-- 1 ma hang.
IF OBJECT_ID('BaoGiaAlohaChiTiet') IS NULL
BEGIN
    CREATE TABLE BaoGiaAlohaChiTiet (
        ID              INT IDENTITY(1,1) PRIMARY KEY,
        BaoGiaAlohaID   INT NOT NULL FOREIGN KEY REFERENCES BaoGiaAloha(ID) ON DELETE CASCADE,
        MaHangID        INT NOT NULL UNIQUE FOREIGN KEY REFERENCES TheKhoHangHoa(MaHangID),
        PhanTramVAT     DECIMAL(5,4) NOT NULL DEFAULT 0.08,
        ThuTu           INT NOT NULL DEFAULT 0,
        CreatedAt       DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    PRINT 'Da tao bang BaoGiaAlohaChiTiet.';
END ELSE PRINT 'Bang BaoGiaAlohaChiTiet da ton tai, bo qua.';
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_BaoGiaAlohaChiTiet_BaoGiaAlohaID')
    CREATE INDEX IX_BaoGiaAlohaChiTiet_BaoGiaAlohaID ON BaoGiaAlohaChiTiet(BaoGiaAlohaID);
GO

-- ============ CHUC NANG (phan quyen) ============
IF NOT EXISTS (SELECT 1 FROM ChucNang WHERE ModuleCode = 'KHOHANG' AND MaChucNang = 'baogiaaloha')
BEGIN
    INSERT INTO ChucNang (ModuleCode, MaChucNang, TenChucNang, ThuTu)
    SELECT 'KHOHANG', 'baogiaaloha', N'Báo giá Aloha', ISNULL(MAX(ThuTu), 0) + 1
    FROM ChucNang WHERE ModuleCode = 'KHOHANG';
    PRINT 'Da them chuc nang KHOHANG/baogiaaloha.';
END ELSE PRINT 'Chuc nang KHOHANG/baogiaaloha da ton tai, bo qua.';
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [20/81]  migration_v518.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [20/81] migration_v518.sql';
GO

/* ================================================================
   migration_v518.sql - Nang cap tu v5.17 len v5.18

   Yeu cau (Quan ly san xuat, muc 1.1 + 1.2):
     1.1   - Danh sach lenh san xuat: user chi duoc phan quyen "Xem" (khong
             gan cong doan nao) van phai thay danh sach don hang (sua o
             backend/routes/qlsx.js GET /orders - KHONG can migration).
     1.2.1 - Bo cong doan "Chỉ định phụ kiện" (PK) ra khoi luong Ghi nhan
             tien do.
     1.2.2 - Bo cong doan "Giao vải" (GV) ra khoi luong Ghi nhan tien do;
             dieu kien cap nhat cong doan "Cắt" la don hang phai da co
             Phieu xuat kho vai (PhieuXuatVai/PhieuXuatVaiChiTiet).
     1.2.3 - Cong doan Cat: cho CHON cay vai (trong so cay DA XUAT that cho
             don hang) vao tung so do, thay vi hien san toan bo danh sach.

   GV/PK KHONG bi xoa khoi CongDoanSanXuat (van la 2 dong LaHeThong=1, giu
   nguyen StageID cho du lieu lich su TienDoSanXuat/bao cao cu doi chieu
   dung) - CHUNG chi khong con la diem dung tren duong di cua don hang MOI
   nua (xem tinhNextStage() trong backend/routes/qlsx.js, da sua de LUON bo
   qua GV/PK khi tinh cong doan ke tiep - truoc day chi bo qua May co dieu
   kien).

   Migration nay CHI can xu ly DU LIEU: don hang nao dang "dung" (tai
   DonHangSanXuat.CongDoanHienTaiID) o GV hoac PK tai thoi diem nang cap se
   duoc CHUYEN THANG toi CAT (cong doan tiep theo ma tinhNextStage() moi se
   cho ra, neu ho ghi nhan tien do "tu day tro di"). KHONG dong den lich su
   TienDoSanXuat da co (cac dong da ghi nhan GV/PK tu truoc GIU NGUYEN,
   khong xoa/sua) - chi doi CON TRO "dang o dau" cua don hang. PhanTramHoanThanh
   duoc tinh lai theo vi tri THAT cua CAT trong ThuTu (khop voi cong thuc
   backend dang dung: (vi tri + 1) / tong so cong doan) de thanh % hien thi
   dung ngay, khong doi cho toi lan ghi tien do ke tiep moi tu cap nhat lai.

   YEU CAU TIEN QUYET: da chay migration_v59.sql (them MaCongDoan/LaHeThong)
   va migration_v52_qlsx.sql (them GV/PK) tu truoc - neu chua, script se bao
   loi va dung lai (khong lam gi ca), xem RAISERROR ben duoi.

   An toan chay lai nhieu lan (idempotent) - lan chay thu 2 tro di se
   khong con don nao dang o GV/PK nua nen @@ROWCOUNT = 0, khong gay hai gi.
   ================================================================ */

USE QLNoiBo;
GO

DECLARE @GVStageID INT = (SELECT StageID FROM CongDoanSanXuat WHERE MaCongDoan = N'GV');
DECLARE @PKStageID INT = (SELECT StageID FROM CongDoanSanXuat WHERE MaCongDoan = N'PK');
DECLARE @CATStageID INT = (SELECT StageID FROM CongDoanSanXuat WHERE MaCongDoan = N'CAT');

IF @GVStageID IS NULL OR @PKStageID IS NULL OR @CATStageID IS NULL
BEGIN
    RAISERROR(N'Khong tim thay du 3 cong doan GV/PK/CAT (MaCongDoan) trong CongDoanSanXuat - kiem tra lai migration_v59.sql va migration_v52_qlsx.sql da chay chua truoc khi chay migration nay.', 16, 1);
    RETURN;
END

DECLARE @TotalStages INT = (SELECT COUNT(*) FROM CongDoanSanXuat);
DECLARE @CatThuTu INT = (SELECT ThuTu FROM CongDoanSanXuat WHERE StageID = @CATStageID);
DECLARE @CatViTri INT = (SELECT COUNT(*) FROM CongDoanSanXuat WHERE ThuTu <= @CatThuTu);
DECLARE @CatPercent INT = CASE WHEN @TotalStages > 0 THEN ROUND((CAST(@CatViTri AS FLOAT) / @TotalStages) * 100, 0) ELSE 0 END;

UPDATE DonHangSanXuat
SET CongDoanHienTaiID = @CATStageID,
    PhanTramHoanThanh = @CatPercent,
    UpdatedAt = SYSDATETIME()
WHERE CongDoanHienTaiID IN (@GVStageID, @PKStageID);

PRINT N'Da chuyen ' + CAST(@@ROWCOUNT AS NVARCHAR(20)) + N' don hang dang dung o "Giao vải"/"Chỉ định phụ kiện" sang "Cắt" (% hoàn thành cập nhật lại theo vị trí Cắt).';
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [21/81]  migration_v519.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [21/81] migration_v519.sql';
GO

/* ================================================================
   migration_v519.sql - Nang cap tu v5.18 len v5.19

   Yeu cau (dot lon nhieu muc - xem HUONG_DAN_CAI_DAT.md Buoc 2.25 de biet
   chi tiet tung muc va ly do chon giai phap):

   1.1.1 - Nha gia cong chi tiet (Ky thuat): them don gia rieng cho tung nha
           gia cong (khi khac "Nha Lam") - dung de tinh luong sau nay.
   1.1.2 - "Giao/nhan nha gia cong": tach thanh 2 chuc nang con MOI trong
           Quan ly san xuat - "Giao nha gia cong" / "Nhan nha gia cong".
           MOI chuc nang la 1 SO GHI CHEP (ledger) rieng, gan voi TUNG dong
           trong DonHangChiTietNhaGiaCong (nha gia cong chi tiet cua don) -
           KHONG dung/doi DonHangSanXuat.NhaGiaCongID/NgayGiaoGC/NgayNhanGC
           (van la nguon DUY NHAT quyet dinh bo qua cong doan May, xem
           tinhNextStage() trong qlsx.js va ghi chu tai migration_v513.sql
           dong 22-29) - man hinh "Giao/nhan nha gia cong" cu (openVendorForm,
           nut trong Danh sach lenh san xuat) VAN GIU NGUYEN de khong pha vo
           logic do; 2 chuc nang MOI la BO SUNG, phuc vu rieng viec theo doi
           SL/don gia/ghi chu THEO TUNG nha gia cong (khi 1 don co nhieu nha
           gia cong chi tiet) de tinh luong - dung SoLuong/DonGia rieng cho
           TUNG lan giao/nhan (co the giao/nhan nhieu dot).
   1.4   - "Chi dinh vai SX" (chuc nang con MOI): tai su dung CHINH DonHang
           ChiTietVai (loai vai/mau/kieu Chinh-Phoi da khai bao o Ra lenh san
           xuat) - THEM 2 cot moi (DVTVaiYeuCau/SoKGYeuCau) thay vi tao bang
           rieng, vi day la "chi dinh THEM" cho CUNG cac dong Loai vai/Mau da
           co, khong phai danh muc doc lap. KHONG dung lai cot DonViTinh co
           san (dang dung cho don vi SO LUONG SAN PHAM vd "Cai" o Ra lenh SX -
           neu dung chung se xung dot 2 y nghia tren CUNG 1 dong).

   Bang moi: GiaoNhaGiaCongChiTiet, NhanNhaGiaCongChiTiet.
   Cot moi: DonHangChiTietNhaGiaCong.DonGia; DonHangChiTietVai.DVTVaiYeuCau,
   DonHangChiTietVai.SoKGYeuCau.
   ChucNang moi (QLSX): giaonhagiacong, nhannhagiacong, chidinhvaisx.

   YEU CAU TIEN QUYET: da chay migration_v513.sql (tao DonHangChiTietNhaGiaCong)
   va migration_v5_chucnang.sql (tao bang ChucNang/ChucNangPermissions) tu
   truoc - neu chua, script se bao loi va dung lai.

   An toan chay lai nhieu lan (idempotent) - dung IF COL_LENGTH/OBJECT_ID/
   MERGE giong cac migration truoc.
   ================================================================ */

USE QLNoiBo;
GO

IF OBJECT_ID('DonHangChiTietNhaGiaCong') IS NULL
BEGIN
    RAISERROR(N'Khong tim thay bang DonHangChiTietNhaGiaCong - can chay migration_v513.sql truoc khi chay migration nay.', 16, 1);
    RETURN;
END
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ChucNang')
BEGIN
    RAISERROR(N'Khong tim thay bang ChucNang - can chay migration_v5_chucnang.sql truoc khi chay migration nay.', 16, 1);
    RETURN;
END
GO

/* ---------- 1.1.1: Don gia tren Nha gia cong chi tiet ---------- */
IF COL_LENGTH('DonHangChiTietNhaGiaCong', 'DonGia') IS NULL
BEGIN
    ALTER TABLE DonHangChiTietNhaGiaCong ADD DonGia DECIMAL(14,2) NULL;
    PRINT N'Da them cot DonHangChiTietNhaGiaCong.DonGia.';
END ELSE PRINT N'Cot DonHangChiTietNhaGiaCong.DonGia da ton tai, bo qua.';
GO

/* ---------- 1.1.2: So ghi chep Giao / Nhan nha gia cong (theo tung dong chi tiet) ---------- */
IF OBJECT_ID('GiaoNhaGiaCongChiTiet') IS NULL
BEGIN
    CREATE TABLE GiaoNhaGiaCongChiTiet (
        ID                    INT IDENTITY(1,1) PRIMARY KEY,
        ChiTietNhaGiaCongID   INT NOT NULL FOREIGN KEY REFERENCES DonHangChiTietNhaGiaCong(ID) ON DELETE CASCADE,
        NgayGiao              DATE NOT NULL,
        SoLuong               INT NOT NULL DEFAULT 0,
        DonGia                DECIMAL(14,2) NULL,
        GhiChu                NVARCHAR(255) NULL,
        NguoiTaoID            INT NULL FOREIGN KEY REFERENCES Users(UserID),
        CreatedAt             DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    PRINT N'Da tao bang GiaoNhaGiaCongChiTiet.';
END ELSE PRINT N'Bang GiaoNhaGiaCongChiTiet da ton tai, bo qua.';
GO

IF OBJECT_ID('NhanNhaGiaCongChiTiet') IS NULL
BEGIN
    CREATE TABLE NhanNhaGiaCongChiTiet (
        ID                    INT IDENTITY(1,1) PRIMARY KEY,
        ChiTietNhaGiaCongID   INT NOT NULL FOREIGN KEY REFERENCES DonHangChiTietNhaGiaCong(ID) ON DELETE CASCADE,
        NgayNhan              DATE NOT NULL,
        SoLuong               INT NOT NULL DEFAULT 0,
        DonGia                DECIMAL(14,2) NULL,
        GhiChu                NVARCHAR(255) NULL,
        NguoiTaoID            INT NULL FOREIGN KEY REFERENCES Users(UserID),
        CreatedAt             DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    PRINT N'Da tao bang NhanNhaGiaCongChiTiet.';
END ELSE PRINT N'Bang NhanNhaGiaCongChiTiet da ton tai, bo qua.';
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_GiaoNhaGiaCongChiTiet_ChiTiet')
    CREATE INDEX IX_GiaoNhaGiaCongChiTiet_ChiTiet ON GiaoNhaGiaCongChiTiet(ChiTietNhaGiaCongID);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_NhanNhaGiaCongChiTiet_ChiTiet')
    CREATE INDEX IX_NhanNhaGiaCongChiTiet_ChiTiet ON NhanNhaGiaCongChiTiet(ChiTietNhaGiaCongID);
GO

/* ---------- 1.4: Chi dinh vai SX (tai su dung DonHangChiTietVai) ---------- */
IF COL_LENGTH('DonHangChiTietVai', 'DVTVaiYeuCau') IS NULL
BEGIN
    ALTER TABLE DonHangChiTietVai ADD DVTVaiYeuCau NVARCHAR(30) NULL DEFAULT N'Kg';
    PRINT N'Da them cot DonHangChiTietVai.DVTVaiYeuCau.';
END ELSE PRINT N'Cot DonHangChiTietVai.DVTVaiYeuCau da ton tai, bo qua.';
GO

IF COL_LENGTH('DonHangChiTietVai', 'SoKGYeuCau') IS NULL
BEGIN
    ALTER TABLE DonHangChiTietVai ADD SoKGYeuCau DECIMAL(10,2) NULL;
    PRINT N'Da them cot DonHangChiTietVai.SoKGYeuCau.';
END ELSE PRINT N'Cot DonHangChiTietVai.SoKGYeuCau da ton tai, bo qua.';
GO

/* ---------- ChucNang moi (QLSX): giaonhagiacong / nhannhagiacong / chidinhvaisx ---------- */
MERGE ChucNang AS t
USING (VALUES
    ('QLSX','giaonhagiacong',N'Giao nhà gia công',5),
    ('QLSX','nhannhagiacong',N'Nhận nhà gia công',6),
    ('QLSX','chidinhvaisx',N'Chỉ định vải SX',7)
) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu)
ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
WHEN NOT MATCHED THEN
    INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu) VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu);
GO
PRINT N'Da seed ChucNang moi cho QLSX (giaonhagiacong/nhannhagiacong/chidinhvaisx).';
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [22/81]  migration_v520.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [22/81] migration_v520.sql';
GO

/* ================================================================
   migration_v520.sql - Nang cap tu v5.19 len v5.20

   Yeu cau (dot lon - "xac dinh lai luong ghi tien do san xuat"):

   1   - Dinh nghia lai toan bo trinh tu cong doan san xuat (CongDoanSanXuat)
         theo luong moi:
         Ra lenh SX -> Tai lieu KT -> Ky thuat -> Chi dinh vai SX -> Xuat vai
         -> Cat -> Chi dinh phu kien -> Xuat phu kien -> Giao nha in theu ->
         Nhan nha in theu -> Giao nha gia cong -> Nhan nha gia cong -> May ->
         Nhat chi -> QC -> La -> Dong goi -> Kho nhap.
         Cac buoc KHONG phai 1 "cong doan" thuc su trong CongDoanSanXuat (vi
         da co san man hinh/co che rieng, khong can them 1 diem dung Ghi nhan
         tien do nua):
           - "Ra lenh SX": diem bat dau, khong phai cong doan.
           - "Tai lieu KT": chuc nang rieng tu v5.14 (module.tailieukythuat.js).
           - "Chi dinh vai SX": chuc nang rieng tu v5.19 (DonHangChiTietVai.
             SoKGYeuCau), nay LA NGUON DU LIEU cho "Xuat vai" (xem muc 4/4.1
             duoi day) thay vi 1 cong doan can bam "Gui" rieng.
           - "Xuat vai": chinh la Phieu xuat kho vai (KHOVAI - da la dieu
             kien CUNG cho cong doan "Cat" tu v5.18, khong doi).
           - "Chi dinh phu kien": chinh la khoi "Phu kien can dung (NPL)" da
             co san trong Ra lenh san xuat (DonHangChiTietPhuKien).
           - "Xuat phu kien": Phieu xuat phu kien (module PHUKIEN, da co san).
         2 cong doan DU DINH ban dau (GNIT/NNIT, SUA LAI o v5.21, xem duoi)
         va 2 cong doan khac (GNGC/NNGC, SUA LAI o v5.22, xem duoi) KHONG con
         duoc them vao CongDoanSanXuat nua - ca 4 deu da bi rut khoi ke hoach
         ban dau cua migration nay truoc khi tung duoc trien khai (an toan
         sua truc tiep, khong can migration "undo" rieng).
         SUA LAI o v5.21 (yeu cau muc 8, "Tách Giao nhà in thêu, nhận nhà in
         thêu ra thành chức năng riêng... không phải trong ghi nhận tiến
         độ"): "Giao nha in theu"/"Nhan nha in theu" (GNIT/NNIT) KHONG con
         duoc them vao CongDoanSanXuat nua (migration nay CHUA tung duoc
         trien khai nen sua truc tiep an toan, khong can 1 migration "undo"
         rieng) - thay bang 2 chuc nang doc lap (xem migration_v521.sql +
         backend/routes/qlsx.js GET/POST /giaonhaintheu, /nhannhaintheu).
         SUA LAI TIEP o v5.22 (muc 1.1, "xóa bỏ Giao nhà in thêu, nhận nhà in
         thêu, giao nhà gia công, nhận nhà gia công ở trong tiến độ sản
         xuất"): "Giao nha gia cong"/"Nhan nha gia cong" (GNGC/NNGC) CUNG bi
         rut khoi CongDoanSanXuat theo DUNG cach v5.21 da lam cho GNIT/NNIT -
         thay bang 2 tab doc lap /giaonhagiacong, /nhannhagiacong (ChucNang
         da co san tu v5.19, xem migration_v519.sql - KHONG can them dong
         ChucNang moi), nay xay lai theo mo hinh danh-sach-don-hang-truoc
         (xem migration_v522.sql neu co + backend/routes/qlsx.js).
         3 cong doan MOI khac, don gian (dung chung form "SL luy ke theo
         mau" nhu Hoan thien cu, KHONG can sua renderStageFields): "Nhat chi"
         (NCH), "QC", "La" (LA) - chen giua May va Dong goi.
         "Hoan thien" (HT) - KHONG con trong luong moi (khong nam trong danh
         sach cong doan nguoi dung liet ke) - them vao danh sach BO QUA
         KHONG DIEU KIEN (MA_CONG_DOAN_BO_QUA trong qlsx.js), CUNG canh voi
         GV/PK (da bo qua tu v5.18) - GIU NGUYEN dong nay trong danh muc,
         KHONG xoa, de khong pha vo du lieu lich su TienDoSanXuat cu.
         "Dong goi" (DG) chuyen ra SAU "Kho nhap" (KN) trong ThuTu hien tai
         (KT=1,GV=2,PK=3,CAT=4,MAY=5,HT=6,KN=7,DG=8) - doi thanh KN o SAU DG
         (dung thu tu nguoi dung yeu cau "...Đóng gói → Kho Nhập").

   2/3 - Xem ghi chu tai frontend/js/module.qlsx.js (openVendorForm da bi
         XOA) va backend/routes/qlsx.js (POST /orders/:maDH/vendor da bi
         XOA). "Giao/nhan nha gia cong" VA "Giao/nhan nha in theu" deu dung
         2 tab doc lap co san (khong con la cong doan trong CongDoanSanXuat,
         xem SUA LAI o muc 1 phia tren) - nha gia cong dung ChucNang
         giaonhagiacong/nhannhagiacong (co san tu v5.19), nha in/theu dung
         ChucNang giaonhaintheu/nhannhaintheu (them moi o migration_v521.sql).

   4/4.1 - Xem ghi chu tai backend/routes/khovai.js (GET /orders VA GET
         /orders/:donHangId/vaichophep) - co che "Giao vai" (GiaoVaiSanXuat)
         KHONG con duoc dung lam nguon "cay vai cho phep xuat" nua; thay
         bang JOIN truc tiep DonHangChiTietVai (Chi dinh vai SX/Cau truc
         vai) -> DanhMucVai -> vw_TonCayVai theo Loai vai + Mau. Bang
         GiaoVaiSanXuat KHONG bi xoa (van con du lieu lich su, van duoc cac
         kiem tra "da phat sinh giao dich" o Nhap kho vai/1.3.x tham chieu -
         xem khovai.js PUT /nhap/:id) - chi khong con la co che gating cho
         Xuat kho vai nua.

   Bang moi: KHONG co (chi them dong CongDoanSanXuat + doi ThuTu, dung lai
   100% cot da co san tren DonHangSanXuat: NhaInID/NgayGiaoIn/NgayNhanIn/
   NhaGiaCongID/NgayGiaoGC/NgayNhanGC).

   YEU CAU TIEN QUYET: da chay migration_v59.sql (MaCongDoan/LaHeThong) va
   migration_v518.sql (GV/PK bo qua khong dieu kien) tu truoc.

   An toan chay lai nhieu lan (idempotent) - dung IF NOT EXISTS/IF EXISTS
   truoc moi INSERT/UPDATE dinh danh theo MaCongDoan (UNIQUE khi khac NULL,
   xem migration_v59.sql).
   ================================================================ */

USE QLNoiBo;
GO

IF NOT EXISTS (SELECT 1 FROM CongDoanSanXuat WHERE MaCongDoan = N'KT')
BEGIN
    RAISERROR(N'Khong tim thay cong doan he thong (MaCongDoan) trong CongDoanSanXuat - can chay migration_v59.sql va migration_v518.sql truoc khi chay migration nay.', 16, 1);
    RETURN;
END
GO

/* ---------- 1a: danh so lai (renumber) cac cong doan HE THONG hien co theo
   khoang cach 10 don vi - de lai khoang trong cho cac cong doan MOI chen
   vao giua ma KHONG can dich chuyen (shift) hang loat nhu cac migration
   truoc (v5.2). Khong doi StageID (identity) cua bat ky dong nao nen KHONG
   anh huong don hang dang o giua chung (CongDoanHienTaiID tham chieu StageID,
   khong tham chieu ThuTu). ---------- */
UPDATE CongDoanSanXuat SET ThuTu = 10  WHERE MaCongDoan = N'KT';
UPDATE CongDoanSanXuat SET ThuTu = 20  WHERE MaCongDoan = N'CAT';
UPDATE CongDoanSanXuat SET ThuTu = 70  WHERE MaCongDoan = N'MAY';
UPDATE CongDoanSanXuat SET ThuTu = 110 WHERE MaCongDoan = N'DG';
UPDATE CongDoanSanXuat SET ThuTu = 120 WHERE MaCongDoan = N'KN';
-- Cac cong doan da/dang bi loai khoi luong Ghi nhan tien do (GV/PK tu v5.18,
-- HT tu migration nay) - day ve cuoi danh sach, GIU NGUYEN LaHeThong=1/du
-- lieu lich su, chi khong con anh huong gi den tinhNextStage() (van luon bi
-- bo qua qua MA_CONG_DOAN_BO_QUA, xem qlsx.js).
UPDATE CongDoanSanXuat SET ThuTu = 900 WHERE MaCongDoan = N'GV';
UPDATE CongDoanSanXuat SET ThuTu = 910 WHERE MaCongDoan = N'PK';
UPDATE CongDoanSanXuat SET ThuTu = 920 WHERE MaCongDoan = N'HT';
PRINT N'Da danh so lai ThuTu cac cong doan he thong hien co.';
GO

/* ---------- 1b: them 3 cong doan MOI ---------- */
/* v5.21 (muc 8): BO 2 dong GNIT/NNIT (Giao/Nhan nha in theu) khoi day - da doi thanh 2 chuc nang doc
   lap ngoai CongDoanSanXuat, xem migration_v521.sql.
   v5.22 (muc 1.1): BO TIEP 2 dong GNGC/NNGC (Giao/Nhan nha gia cong) khoi day - cung ly do, cung doi
   thanh 2 tab doc lap (ChucNang giaonhagiacong/nhannhagiacong da co san tu v5.19). Chi con lai 3 cong
   doan don gian (Nhat chi/QC/La) thuc su can them vao CongDoanSanXuat. */
IF NOT EXISTS (SELECT 1 FROM CongDoanSanXuat WHERE MaCongDoan = N'NCH')
    INSERT INTO CongDoanSanXuat (TenCongDoan, ThuTu, MaCongDoan, LaHeThong) VALUES (N'Nhặt chỉ', 80, N'NCH', 1);
IF NOT EXISTS (SELECT 1 FROM CongDoanSanXuat WHERE MaCongDoan = N'QC')
    INSERT INTO CongDoanSanXuat (TenCongDoan, ThuTu, MaCongDoan, LaHeThong) VALUES (N'QC', 90, N'QC', 1);
IF NOT EXISTS (SELECT 1 FROM CongDoanSanXuat WHERE MaCongDoan = N'LA')
    INSERT INTO CongDoanSanXuat (TenCongDoan, ThuTu, MaCongDoan, LaHeThong) VALUES (N'Là', 100, N'LA', 1);
PRINT N'Da them (neu chua co) 3 cong doan moi: NCH/QC/LA.';
GO

/* ---------- 1c: chuyen don hang dang "dung" o Hoan thien (HT) - cong doan
   nay khong con trong luong moi - sang "Nhat chi" (NCH), cong doan ke tiep
   thuc su trong danh muc moi ngay sau May. Mirror dung cach lam cua
   migration_v518.sql cho GV/PK -> Cat (StageID khong doi voi don KHONG o
   HT nen an toan chay lai nhieu lan - @@ROWCOUNT = 0 tu lan thu 2). ---------- */
DECLARE @HTStageID INT = (SELECT StageID FROM CongDoanSanXuat WHERE MaCongDoan = N'HT');
DECLARE @NCHStageID INT = (SELECT StageID FROM CongDoanSanXuat WHERE MaCongDoan = N'NCH');

IF @HTStageID IS NOT NULL AND @NCHStageID IS NOT NULL
BEGIN
    DECLARE @TotalStages INT = (SELECT COUNT(*) FROM CongDoanSanXuat);
    DECLARE @NCHThuTu INT = (SELECT ThuTu FROM CongDoanSanXuat WHERE StageID = @NCHStageID);
    DECLARE @NCHViTri INT = (SELECT COUNT(*) FROM CongDoanSanXuat WHERE ThuTu <= @NCHThuTu);
    DECLARE @NCHPercent INT = CASE WHEN @TotalStages > 0 THEN ROUND((CAST(@NCHViTri AS FLOAT) / @TotalStages) * 100, 0) ELSE 0 END;

    UPDATE DonHangSanXuat
    SET CongDoanHienTaiID = @NCHStageID,
        PhanTramHoanThanh = @NCHPercent,
        UpdatedAt = SYSDATETIME()
    WHERE CongDoanHienTaiID = @HTStageID;

    PRINT N'Da chuyen ' + CAST(@@ROWCOUNT AS NVARCHAR(20)) + N' đơn hàng đang đứng ở "Hoàn thiện" sang "Nhặt chỉ" (% hoàn thành cập nhật lại theo vị trí mới).';
END
GO

PRINT N'migration_v520.sql hoan tat.';
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [23/81]  migration_v521.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [23/81] migration_v521.sql';
GO

/* ================================================================
   migration_v521.sql - Nang cap tu v5.20 len v5.21

   Yeu cau (dot 8 muc, sua/tinh chinh lai mot phan cua v5.20 - xem
   HUONG_DAN_CAI_DAT.md Buoc 2.27 de biet chi tiet tung muc va ly do chon
   giai phap):

   1   - Danh muc MOI "Đơn vị quy đổi" (DanhMucDonViQuyDoi): moi dong la 1
         CAP don vi (Don vi chinh -> Don vi quy doi, Phep tinh Nhan/Chia,
         He so) - cho phep khai bao NHIEU cap (yeu cau "Tạo nhiều danh mục
         đơn vị quy đổi"). Quan ly qua Danh muc (module DANHMUC, tab moi
         "Đơn vị quy đổi") dung chung buildCrudRouter() - xem danhmuc.js.

   2   - Cau truc vai (Ra lenh san xuat): dong "Tổng cộng" doi tu CHIA lay
         thuong/du (fmtDualUnit() - vay tu The kho hang hoa, sai ban chat -
         xem v5.19 muc 1.2/1.3) sang NHAN theo dung dong "Đơn vị quy đổi"
         da chon cho don hang (fmtQuyDoi() moi trong common.js). Them cot
         DonHangSanXuat.DonViQuyDoiID (FK toi DanhMucDonViQuyDoi) - CHI
         dung de dinh dang hien thi; DonHangSanXuat.HeSoQuyDoi (da co tu
         v5.13) VAN la con so THAT SU dung cho tinh toan o cong doan Cat,
         khong doi - chon 1 dong danh muc chi AUTO-DIEN lai o "He so quy
         đổi" (van sua tay duoc rieng sau do).

   3   - Ky thuat: them toggle TUONG MINH "Giao nhà làm"/"Giao gia công"
         (radio, cot moi DonHangSanXuat.KenhSanXuat NVARCHAR(20) NULL) -
         TACH KHOI viec chon nha gia cong CU THE (ktNhaGiaCong/Nhà gia
         công chi tiết van con, nay chi la THAM KHAO/dai dien). tinhNextStage()
         (GNGC/NNGC/May) va frontend showGiaoViec doc KenhSanXuat truoc
         tien, fallback ve suy luan CU (NhaGiaCongID/LaNoiBoNhaGiaCong)
         cho don hang CU chua tung mo lai Ky thuat sau nang cap (KenhSanXuat
         con NULL) - xem backend qlsx.js tinhNextStage()/module.qlsx.js
         showGiaoViec. Man hinh con "Giao nhà gia công" (chon tung nha +
         gia + so luong, nhieu nha) da co san tu v5.19 - khong doi.

   5   - "Nhận nhà gia công" (GET /nhannhagiacong): CHI liet ke dong "Nha
         gia cong chi tiet" DA co it nhat 1 lan Giao (TongDaGiao > 0) -
         truoc day hien TAT CA dong da khai bao o Ky thuat, ke ca chua
         tung duoc giao lan nao.

   6   - Phieu xuat kho vai (KHOVAI, khong doi schema, xem backend/routes/
         khovai.js):
           a) GET /orders (dropdown chon don hang o Tao phieu xuat): PHAI
              co Chi dinh vai SX (SUM SoKGYeuCau > 0) moi hien - dao nguoc
              lai quyet dinh "cho hien ca don CHUA khai" cua v5.20.
           b) GET /orders/:donHangId/vaichophep: them chiTietTheoMau (KG
              yeu cau + KG da xuat rieng TUNG Loai vai/Mau) thay vi chi co
              tong Chinh/Phoi gop lai.
           c) In phieu: cot "Kg chỉ định" doi nguon tu DonHangChiTietVai.
              SoKGYeuCau (Chi dinh vai SX) thay vi .SoLuong (Ra lenh SX,
              sai don vi).

   7   - getStageActualQty()/getStageActualQtyByColor() (backend qlsx.js):
         sua bug cong SAI cho don hang >= 2 so do (chi lay 1 ban thay vi
         tat ca) - dong nhat cach gop nhom NhomTienDoID voi getStageCayCount()
         da dung tu v5.16. Sua ca "Tổng SL cắt" o cong doan May LAN "SL cắt
         thực tế" o bao cao in phieu (dung chung 1 ham).

   8   - "Giao/Nhận nhà in thêu": DAO NGUOC lai phan tuong ung cua v5.20 -
         KHONG con la 2 cong doan (GNIT/NNIT) trong CongDoanSanXuat/Ghi
         nhan tien do nua (2 dong nay CHUA tung duoc them vao CSDL that su
         - migration_v520.sql da duoc sua truc tiep de KHONG con tao 2 dong
         nay, an toan vi CHUA deploy) - thay bang 2 chuc nang DOC LAP
         (ChucNang moi 'giaonhaintheu'/'nhannhaintheu', tab rieng trong
         Quan ly san xuat) khong gate/chan luong Ghi nhan tien do, dung
         LAI dung 3 cot DonHangSanXuat.NhaInID/NgayGiaoIn/NgayNhanIn (khong
         doi schema). "Giao": chon nha in/theu + ngay giao, cho doi lai bat
         ky luc nao. "Nhan": CHI hien don DA duoc giao, chi ghi ngay nhan -
         KHONG can so luong. Lich su "Ghi nhận tiến độ" (GET /orders/:maDH/
         print) van chen 2 dong tong hop "Giao/Nhận nhà in thêu" (tu chinh
         NgayGiaoIn/NgayNhanIn cua don hang) de van phan anh du 2 su kien
         nay nhu yeu cau, du KHONG con la cong doan that.

   Bang moi: DanhMucDonViQuyDoi.
   Cot moi: DonHangSanXuat.DonViQuyDoiID, DonHangSanXuat.KenhSanXuat.
   ChucNang moi (QLSX): giaonhaintheu, nhannhaintheu.

   YEU CAU TIEN QUYET: da chay migration_v520.sql (ban da SUA - khong con
   tao GNIT/NNIT nua), migration_v519.sql, migration_v5_chucnang.sql tu truoc.

   An toan chay lai nhieu lan (idempotent) - dung IF COL_LENGTH/OBJECT_ID/
   MERGE giong cac migration truoc.
   ================================================================ */

USE QLNoiBo;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ChucNang')
BEGIN
    RAISERROR(N'Khong tim thay bang ChucNang - can chay migration_v5_chucnang.sql truoc khi chay migration nay.', 16, 1);
    RETURN;
END
IF OBJECT_ID('DonHangSanXuat') IS NULL
BEGIN
    RAISERROR(N'Khong tim thay bang DonHangSanXuat - kiem tra lai schema.sql da chay chua.', 16, 1);
    RETURN;
END
GO

/* ---------- 1/2: Danh muc Don vi quy doi + cot FK tren DonHangSanXuat ---------- */
IF OBJECT_ID('DanhMucDonViQuyDoi') IS NULL
BEGIN
    CREATE TABLE DanhMucDonViQuyDoi (
        ID           INT IDENTITY(1,1) PRIMARY KEY,
        DonViChinh   NVARCHAR(30) NOT NULL,
        DonViQuyDoi  NVARCHAR(30) NOT NULL,
        HeSo         DECIMAL(14,4) NOT NULL DEFAULT 1,
        PhepTinh     NVARCHAR(10) NOT NULL DEFAULT N'Nhan',   -- 'Nhan' hoac 'Chia'
        GhiChu       NVARCHAR(255) NULL
    );
    PRINT N'Da tao bang DanhMucDonViQuyDoi.';
END ELSE PRINT N'Bang DanhMucDonViQuyDoi da ton tai, bo qua.';
GO

-- Seed 1 dong vi du pho bien nhat (Ri -> Cai, x5) - khop dung dong dan trong yeu cau
-- ("ví dụ đơn vị tính chính là ri thì đơn vị quy đổi sẽ là ri x hệ số quy đổi (cái)").
-- Chi seed neu bang dang RONG (tranh tao trung lap moi lan chay lai migration).
IF NOT EXISTS (SELECT 1 FROM DanhMucDonViQuyDoi)
BEGIN
    INSERT INTO DanhMucDonViQuyDoi (DonViChinh, DonViQuyDoi, HeSo, PhepTinh, GhiChu)
    VALUES (N'Ri', N'Cái', 5, N'Nhan', N'Mặc định — chỉnh sửa hệ số cho đúng thực tế nếu khác 5.');
    PRINT N'Da seed 1 dong vi du (Ri -> Cái, x5) vao DanhMucDonViQuyDoi.';
END
GO

IF COL_LENGTH('DonHangSanXuat', 'DonViQuyDoiID') IS NULL
BEGIN
    ALTER TABLE DonHangSanXuat ADD DonViQuyDoiID INT NULL FOREIGN KEY REFERENCES DanhMucDonViQuyDoi(ID);
    PRINT N'Da them cot DonHangSanXuat.DonViQuyDoiID.';
END ELSE PRINT N'Cot DonHangSanXuat.DonViQuyDoiID da ton tai, bo qua.';
GO

/* ---------- 3: Kenh san xuat (Nha Lam / Gia cong) - toggle tuong minh o Ky thuat ---------- */
IF COL_LENGTH('DonHangSanXuat', 'KenhSanXuat') IS NULL
BEGIN
    ALTER TABLE DonHangSanXuat ADD KenhSanXuat NVARCHAR(20) NULL;
    PRINT N'Da them cot DonHangSanXuat.KenhSanXuat.';
END ELSE PRINT N'Cot DonHangSanXuat.KenhSanXuat da ton tai, bo qua.';
GO

-- Backfill KenhSanXuat cho don hang DA CO tu truoc nang cap, tu chinh cach suy luan CU
-- (NhaGiaCongID/LaNoiBoNhaGiaCong) - tranh doi kenh cua don dang chay so voi ngay hom truoc
-- khi ho quay lai Ky thuat sau nang cap (form se hien dung radio da duoc backfill, khong bi
-- mac dinh nham ve "Giao nhà làm"). Chi backfill dong con NULL (chua tung ghi qua form moi).
UPDATE d
SET d.KenhSanXuat = CASE
    WHEN d.NhaGiaCongID IS NOT NULL AND ncc.LaNoiBo = 0 THEN N'GiaCong'
    ELSE N'NhaLam'
END
FROM DonHangSanXuat d
LEFT JOIN NhaGiaCong ncc ON ncc.NhaGiaCongID = d.NhaGiaCongID
WHERE d.KenhSanXuat IS NULL;
PRINT N'Da backfill KenhSanXuat cho don hang da co tu truoc (tu NhaGiaCongID/LaNoiBoNhaGiaCong).';
GO

/* ---------- 8: ChucNang moi (QLSX) - Giao/Nhan nha in theu (chuc nang doc lap) ---------- */
MERGE ChucNang AS t
USING (VALUES
    ('QLSX','giaonhaintheu',N'Giao nhà in thêu',8),
    ('QLSX','nhannhaintheu',N'Nhận nhà in thêu',9)
) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu)
ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
WHEN NOT MATCHED THEN
    INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu) VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu);
GO
PRINT N'Da seed ChucNang moi cho QLSX (giaonhaintheu/nhannhaintheu).';
GO

PRINT N'migration_v521.sql hoan tat.';
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [24/81]  migration_v523.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [24/81] migration_v523.sql';
GO

/* ================================================================
   migration_v523.sql - Nang cap tu v5.22 len v5.23

   Sua sai kien truc v5.21 (muc 3) theo phan hoi truc tiep cua nguoi dung:

   "Sau công đoạn cắt có công đoạn giao gia công. khi đó sẽ chọn giao nhà
   làm hay giao gia công. Nếu giao gia công bên chức năng Giao gia công sẽ
   hiển thị lệnh sx như hiện tại. Nếu giao nhà làm thì chuyển sang công
   đoạn may trong ghi nhận tiến độ. Trong công đoạn may ở các công đoạn chi
   tiết có chọn giao cho nhân viên (1 công đoạn chọn nhiều nhân viên) số
   lượng. hiển thị đơn giá từ công đoạn kỹ thuật đã nhập"

   v5.21 (muc 3) dat toggle "Kenh san xuat" (NhaLam/GiaCong, cot
   DonHangSanXuat.KenhSanXuat) NGAY TAI Ky thuat (KT) - SAI vi tri theo dung
   yeu cau nay: toggle phai la 1 CONG DOAN THAT rieng, dung NGAY SAU Cat,
   TRUOC May - KHONG con o Ky thuat nua.

   1 - Them 1 CongDoanSanXuat MOI: MaCongDoan='GC', TenCongDoan='Giao gia
       công', ThuTu=30 (giua CAT=20 va MAY=70 - dung khoang trong da bo lai
       tu khi GNGC bi rut khoi day o v5.22, xem migration_v520.sql), LaHeThong=1.
       Day KHONG phai hoi sinh lai GNGC/NNGC day du (ledger nhieu nha gia
       cong/nhieu lan giao-nhan cua v5.19 VAN o nguyen, KHONG doi, van qua 2
       tab doc lap /giaonhagiacong, /nhannhagiacong) - 'GC' o day CHI la 1
       diem QUYET DINH kenh (NhaLam/GiaCong) + 1 nha gia cong dai dien/don
       gia tham khao, dung dung vai tro ma 'KT' tung lam o v5.21, chi doi
       VI TRI trong luong (tu KT chuyen sang sau CAT).

   2 - KHONG can doi schema DonHangSanXuat - KenhSanXuat/NhaGiaCongID/
       DonGiaGiaCongNgoai (da co tu migration_v521.sql/v55) dung nguyen,
       chi doi CONG DOAN nao ghi vao chung (xem backend/routes/qlsx.js POST
       /orders/:maDH/tiendo, nhanh doi tu stage.MaCongDoan==='KT' sang
       ==='GC'). Don hang DA tung mo Ky thuat va chon kenh truoc khi nang
       cap nay (KenhSanXuat da co gia tri) KHONG bi anh huong - gia tri cu
       van dung, chi lan SUA/chon LAI tiep theo moi thuc hien o 'GC' thay
       vi 'KT'.

   3 - Don hang dang o dung STAGEID cua 'KT' KHONG can chuyen di dau (KT
       van la 1 cong doan hop le, chi khong con giu vai tro quyet dinh kenh
       nua) - luong Ghi nhan tien do se tu nhien dua don di qua 'GC' (dong
       StageID MOI nay) ngay sau khi hoan tat 'Cat', truoc khi den 'May'.

   YEU CAU TIEN QUYET: da chay migration_v59.sql, migration_v520.sql,
   migration_v521.sql, migration_v522.sql (neu co) tu truoc.

   An toan chay lai nhieu lan (idempotent) - IF NOT EXISTS truoc INSERT.
   ================================================================ */

USE QLNoiBo;
GO

IF NOT EXISTS (SELECT 1 FROM CongDoanSanXuat WHERE MaCongDoan = N'CAT')
BEGIN
    RAISERROR(N'Khong tim thay cong doan he thong CAT trong CongDoanSanXuat - can chay migration_v520.sql truoc khi chay migration nay.', 16, 1);
    RETURN;
END
GO

IF NOT EXISTS (SELECT 1 FROM CongDoanSanXuat WHERE MaCongDoan = N'GC')
    INSERT INTO CongDoanSanXuat (TenCongDoan, ThuTu, MaCongDoan, LaHeThong) VALUES (N'Giao gia công', 30, N'GC', 1);
PRINT N'Da them (neu chua co) cong doan moi: Giao gia công (GC), ThuTu=30 - giua Cắt (20) va May (70).';
GO

PRINT N'migration_v523.sql hoan tat.';
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [25/81]  migration_v524.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [25/81] migration_v524.sql';
GO

/* ================================================================
   migration_v524.sql - Nang cap tu v5.23 len v5.24

   Dot sua tiep theo tren cong doan "Giao gia cong", theo phan hoi truc tiep
   cua nguoi dung ve viec v5.21-v5.23 tao ra NHIEU noi trung nhau cho CUNG 1
   nghiep vu (chon kenh san xuat, giao nha gia cong):

   1.1.1 - Ky thuat: them "Don gia Giao gia cong" (nhieu dong, giong het co
           che "Don gia cong doan may" - danh muc HangMucGiaCong + bang
           DonHangHangMucGiaCong luu rieng cho tung don hang).
   1.3   - Cong doan "Giao gia cong": tu RADIO (chon 1 trong 2) doi thanh 2
           CHECKBOX doc lap "Giao nha lam"/"Giao gia cong" - co the tick CA
           HAI (don hang chia mot phan lam noi bo, mot phan thue ngoai) hoac
           chi 1 trong 2.
         - Neu tick "Giao gia cong": BO o "Nha gia cong (dai dien)" (chi con
           1 co che DUY NHAT - "Nha gia cong chi tiet", them cot So luong
           (dung tinh luong sau nay) - KHONG con o "Don gia gia cong" rieng
           (moi dong nha gia cong da co don gia rieng).
         - Bo tab "Giao nha gia cong" (chuc nang con rieng trong Quan ly san
           xuat) - viec giao nha gia cong gio HOAN TOAN lam ngay tai cong
           doan "Giao gia cong" trong Ghi nhan tien do, khong con 2 noi song
           song lam CUNG 1 viec nua.
         - Neu tick "Giao nha lam": hien bang cong doan may DA nhap o Ky
           thuat de THAM KHAO (ten/don gia/he so) - viec chon NHAN VIEN + SL
           van CHI lam o cong doan May nhu tu truoc (KHONG doi - xac nhan
           qua cau hoi lam ro voi nguoi dung, tranh trung lap them 1 lan
           nua o ca 2 noi).
         - "Nhan nha gia cong": con lai CHI la man hinh XEM (khong con nut
           "Ghi nhan" rieng, khong con cot "Tong da nhan" o danh sach) - hien
           dung nha gia cong + so luong da duoc gan o "Giao gia cong".

   Doi mo hinh du lieu: DonHangSanXuat.KenhSanXuat (chuoi don, 'NhaLam'/
   'GiaCong', them o migration_v521.sql) THAY BANG 2 cot BIT doc lap
   DaGiaoNhaLam/DaGiaoGiaCong (ho tro tick CA HAI). KenhSanXuat GIU NGUYEN
   (khong xoa cot - "mo coi", dung backfill 1 lan cho du lieu cu, khong con
   noi nao ghi/doc nua tu sau migration nay).

   Bang moi: HangMucGiaCong (danh muc), DonHangHangMucGiaCong (rieng tung
   don hang - mirror dung cap CongDoanMay/DonHangCongDoanMay da co san).
   Cot moi: DonHangSanXuat.DaGiaoNhaLam, DonHangSanXuat.DaGiaoGiaCong;
   DonHangChiTietNhaGiaCong.SoLuong.

   SUA LAI o v5.25 (CHUA TUNG deploy nen sua truc tiep file nay, khong tao
   file moi): BO ChucNang 'dongiagiacong' - man hinh danh muc rieng "Đơn giá
   gia công" bi xoa theo phan hoi nguoi dung ("không cần thêm chức năng đơn
   giá gia công"), hang muc gia cong MOI them truc tiep qua nut "+ Mới" ngay
   tai Ky thuat, gate lai theo ChucNang 'tiendo' co san (xem qlsx.js).

   YEU CAU TIEN QUYET: da chay migration_v513.sql (DonHangChiTietNhaGiaCong),
   migration_v521.sql (KenhSanXuat), migration_v523.sql (cong doan GC) tu
   truoc.

   An toan chay lai nhieu lan (idempotent).
   ================================================================ */

USE QLNoiBo;
GO

IF OBJECT_ID('DonHangChiTietNhaGiaCong') IS NULL
BEGIN
    RAISERROR(N'Khong tim thay bang DonHangChiTietNhaGiaCong - can chay migration_v513.sql truoc khi chay migration nay.', 16, 1);
    RETURN;
END
IF COL_LENGTH('DonHangSanXuat', 'KenhSanXuat') IS NULL
BEGIN
    RAISERROR(N'Khong tim thay cot DonHangSanXuat.KenhSanXuat - can chay migration_v521.sql truoc khi chay migration nay.', 16, 1);
    RETURN;
END
GO

/* ---------- 1: DaGiaoNhaLam / DaGiaoGiaCong - thay the KenhSanXuat (don gia tri) bang 2 co doc lap ---------- */
IF COL_LENGTH('DonHangSanXuat', 'DaGiaoNhaLam') IS NULL
BEGIN
    ALTER TABLE DonHangSanXuat ADD DaGiaoNhaLam BIT NOT NULL DEFAULT 0;
    PRINT N'Da them cot DonHangSanXuat.DaGiaoNhaLam.';
END ELSE PRINT N'Cot DonHangSanXuat.DaGiaoNhaLam da ton tai, bo qua.';
GO
IF COL_LENGTH('DonHangSanXuat', 'DaGiaoGiaCong') IS NULL
BEGIN
    ALTER TABLE DonHangSanXuat ADD DaGiaoGiaCong BIT NOT NULL DEFAULT 0;
    PRINT N'Da them cot DonHangSanXuat.DaGiaoGiaCong.';
END ELSE PRINT N'Cot DonHangSanXuat.DaGiaoGiaCong da ton tai, bo qua.';
GO

-- Backfill 1 lan tu KenhSanXuat (don da tung mo "Giao gia cong"/'KT' truoc day) va tu suy luan
-- NhaGiaCongID/LaNoiBoNhaGiaCong cho don CU HON nua (truoc ca v5.21, KenhSanXuat con NULL). Mac dinh
-- "chua ro" -> DaGiaoNhaLam=1 (giu dung quy uoc cu "chua giao ai thi coi nhu Nha Lam" tu v5.0).
UPDATE DonHangSanXuat SET DaGiaoNhaLam = 1
WHERE DaGiaoNhaLam = 0 AND DaGiaoGiaCong = 0
  AND (KenhSanXuat = N'NhaLam' OR (KenhSanXuat IS NULL AND NOT (NhaGiaCongID IS NOT NULL AND LaNoiBoNhaGiaCong = 0)));
UPDATE DonHangSanXuat SET DaGiaoGiaCong = 1
WHERE KenhSanXuat = N'GiaCong' OR (KenhSanXuat IS NULL AND NhaGiaCongID IS NOT NULL AND LaNoiBoNhaGiaCong = 0);
PRINT N'Da backfill DaGiaoNhaLam/DaGiaoGiaCong tu KenhSanXuat (cot nay tu nay khong con noi nao ghi/doc nua - "mo coi", khong xoa).';
GO

/* ---------- 2: So luong tren Nha gia cong chi tiet (dung tinh luong, nhap ngay tai Giao gia cong) ---------- */
IF COL_LENGTH('DonHangChiTietNhaGiaCong', 'SoLuong') IS NULL
BEGIN
    ALTER TABLE DonHangChiTietNhaGiaCong ADD SoLuong INT NULL;
    PRINT N'Da them cot DonHangChiTietNhaGiaCong.SoLuong.';
END ELSE PRINT N'Cot DonHangChiTietNhaGiaCong.SoLuong da ton tai, bo qua.';
GO

/* ---------- 3: Danh muc "Hang muc gia cong" + bang rieng tung don hang - mirror dung cap
   CongDoanMay/DonHangCongDoanMay da co san cho "cong doan may" ---------- */
IF OBJECT_ID('HangMucGiaCong') IS NULL
BEGIN
    CREATE TABLE HangMucGiaCong (
        HangMucGiaCongID INT IDENTITY(1,1) PRIMARY KEY,
        TenHangMuc       NVARCHAR(200) NOT NULL,
        DonGiaMacDinh     DECIMAL(14,2) NULL,
        HeSoMacDinh       DECIMAL(10,4) NOT NULL DEFAULT 1,
        GhiChu            NVARCHAR(255) NULL,
        CreatedAt         DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT UQ_HangMucGiaCong_Ten UNIQUE (TenHangMuc)
    );
    PRINT N'Da tao bang HangMucGiaCong.';
END ELSE PRINT N'Bang HangMucGiaCong da ton tai, bo qua.';
GO

IF OBJECT_ID('DonHangHangMucGiaCong') IS NULL
BEGIN
    CREATE TABLE DonHangHangMucGiaCong (
        ID                INT IDENTITY(1,1) PRIMARY KEY,
        DonHangID         INT NOT NULL FOREIGN KEY REFERENCES DonHangSanXuat(DonHangID) ON DELETE CASCADE,
        HangMucGiaCongID  INT NOT NULL FOREIGN KEY REFERENCES HangMucGiaCong(HangMucGiaCongID),
        DonGia            DECIMAL(14,2) NULL,
        HeSo              DECIMAL(10,4) NOT NULL DEFAULT 1,
        CreatedAt         DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT UQ_DonHangHangMucGiaCong UNIQUE (DonHangID, HangMucGiaCongID)
    );
    PRINT N'Da tao bang DonHangHangMucGiaCong.';
END ELSE PRINT N'Bang DonHangHangMucGiaCong da ton tai, bo qua.';
GO

/* ---------- 4: (v5.25 - da BO, xem ghi chu dau file) ChucNang 'dongiagiacong' KHONG con can nua - man
   hinh danh muc rieng "Đơn giá gia công" bi xoa (chua bao gio co ham render, tab se loi ReferenceError
   neu bam vao) theo phan hoi nguoi dung "không cần thêm chức năng đơn giá gia công". Hang muc gia cong
   MOI gio them truc tiep qua nut "+ Mới" ngay tai Ky thuat (POST /hangmucgiacong, gate lai theo ChucNang
   'tiendo' co san - xem qlsx.js), khong can ChucNang rieng nao ca. ---------- */

PRINT N'migration_v524.sql hoan tat.';
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [26/81]  migration_v527.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [26/81] migration_v527.sql';
GO

/* ================================================================
   MIGRATION v5.27 — Ra lenh SX: loai vai GO TU DO + bo Chi dinh vai SX/NPL
   ----------------------------------------------------------------
   - Cau truc vai: "Loai vai" chuyen tu chon-tu-danh-muc (LoaiVaiID) sang GO TU DO
     (cot moi TenLoaiVaiTuDo). Muc dich: khong rang buoc buoc xuat vai theo lenh SX
     (truoc day Phieu xuat kho vai match cay vai theo LoaiVaiID+MauSacID). LoaiVaiID
     GIU LAI (nullable) cho don CU; don MOI dung TenLoaiVaiTuDo.
   - "Mau" v5.27.1 CUNG go tu do (cot moi TenMauTuDo) - chi la thong tin THAM KHAO tren Ra lenh SX,
     KHONG con dieu khien theo doi tien do (yeu cau: "mau chi de tham khao, khong anh huong cong doan
     khac"). Per-mau tracking o May/Kho nhap gio lay danh sach mau tu KET QUA CAT (cay vai da xuat,
     DanhMucVai.MauSacID that) chu khong tu DonHangChiTietVai - xem getStageActualQtyByColor +
     openProgressForm (Option 4). DonHangChiTietVai.MauSacID doi sang NULLABLE.
   - Chuc nang "Chi dinh vai SX" (chidinhvaisx) + "Chi dinh NPL" (chidinhnpl) bi BO
     khoi giao dien. KHONG xoa cot/ChucNang - de "mo coi" theo dung quy uoc (giong
     giaonhagiacong/nhannhagiacong). Cong DonHangChiTietVai.DVTVaiYeuCau/SoKGYeuCau
     (v5.19) tu nay khong con noi nhap - de trong, khong xoa.

   Chay 1 lan. IDEMPOTENT. YEU CAU TIEN QUYET: schema.sql + migration_v519.sql.
   ================================================================ */

USE QLNoiBo;
GO

IF COL_LENGTH('dbo.DonHangChiTietVai','TenLoaiVaiTuDo') IS NULL
    ALTER TABLE DonHangChiTietVai ADD TenLoaiVaiTuDo NVARCHAR(150) NULL;
-- v5.27.1 (yeu cau bo sung): mau CUNG go tu do (chi la thong tin tham khao, khong anh huong cong doan
-- khac) + moi dong mau chinh them 1 o Ghi chu.
IF COL_LENGTH('dbo.DonHangChiTietVai','TenMauTuDo') IS NULL
    ALTER TABLE DonHangChiTietVai ADD TenMauTuDo NVARCHAR(100) NULL;
IF COL_LENGTH('dbo.DonHangChiTietVai','GhiChu') IS NULL
    ALTER TABLE DonHangChiTietVai ADD GhiChu NVARCHAR(255) NULL;
GO

-- v5.27.1: mau go tu do -> DonHangChiTietVai.MauSacID doi sang NULLABLE (don moi co the khong gan mau
-- catalog). Idempotent (chi doi khi dang NOT NULL). Theo doi per-mau tien do KHONG dung cot nay nua.
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.DonHangChiTietVai') AND name = 'MauSacID' AND is_nullable = 0)
    ALTER TABLE DonHangChiTietVai ALTER COLUMN MauSacID INT NULL;
GO

PRINT '=== migration_v527.sql (Ra lenh SX - loai vai + mau tu do) hoan tat ===';
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [27/81]  migration_v528.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [27/81] migration_v528.sql';
GO

/* ================================================================
   MIGRATION v5.28 (item 2) — PHIEU XUAT VAT TU (gop Phieu xuat Vai + Phieu xuat NPL)
   ----------------------------------------------------------------
   Nguoi dung chon Option 1 (gop THAT bang bang moi). 1 "Phieu xuat Vat tu" xuat CHUNG:
     - Vai CHINH + vai PHOI (theo tung CAY vai, KG) - rut ton VaiCay (qua vw_TonCayVai).
     - Phu kien / NPL (theo So luong) - rut ton phu kien (qua vw_TonKhoPhuKien).
   Mau cua vai CHINH tren phieu nay la mau THAT (tu DanhMucVai qua cay vai) -> chinh la khoa
   theo doi tien do Cat/May/Kho nhap theo mau (yeu cau nguoi dung: "MauSacID theo doi tien do se
   phu thuoc mau vai chinh theo phieu xuat vat tu"). Cong doan Cat lay cay vai da xuat cho don tu
   CA 2 nguon: PhieuXuatVaiChiTiet (cu) + PhieuXuatVatTuVai (moi) - se sua getVaiCayDaXuatChoDon()
   trong qlsx.js o buoc backend.

   Cach gop (Option 1) KHONG pha du lieu cu: 2 view ton kho (vw_TonCayVai, vw_TonKhoPhuKien) duoc
   TAO LAI de UNION them nguon xuat moi -> phieu cu (PhieuXuatVai/PhieuPhuKien) VAN tru ton nhu
   truoc, phieu moi cung tru ton. Cac man hinh "Phieu xuat kho vai" + "Phieu xuat phu kien" cu se
   duoc AN o buoc frontend (khong xoa route/bang - de doi soat lich su).

   Chay 1 lan. IDEMPOTENT. YEU CAU TIEN QUYET: schema.sql goc (co VaiCay/PhieuXuatVaiChiTiet/
   DanhMucPhuKien/PhieuPhuKien + 2 view tren) + migration_v5_chucnang.sql.
   ================================================================ */

USE QLNoiBo;
GO

/* ---------------- 1. PHIEU XUAT VAT TU (header + 2 bang chi tiet) ---------------- */
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'PhieuXuatVatTu')
BEGIN
    CREATE TABLE PhieuXuatVatTu (
        PhieuVatTuID INT IDENTITY(1,1) PRIMARY KEY,
        NgayXuat     DATE NOT NULL,
        MaDon        NVARCHAR(30) NULL,                                   -- so tham chieu tu do (tuy chon)
        DonHangID    INT NULL FOREIGN KEY REFERENCES DonHangSanXuat(DonHangID),  -- gan don (tuy chon)
        NguoiNhan    NVARCHAR(100) NULL,
        MucDich      NVARCHAR(150) NULL,
        GhiChu       NVARCHAR(255) NULL,
        NguoiTaoID   INT NULL FOREIGN KEY REFERENCES Users(UserID),
        CreatedAt    DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    PRINT 'Da tao PhieuXuatVatTu.';
END ELSE PRINT 'PhieuXuatVatTu da ton tai, bo qua.';
GO

-- Chi tiet VAI: moi dong = 1 cay vai (VaiCay) xuat, KieuVai = Chính/Phối, KGXuat.
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'PhieuXuatVatTuVai')
BEGIN
    CREATE TABLE PhieuXuatVatTuVai (
        ID           INT IDENTITY(1,1) PRIMARY KEY,
        PhieuVatTuID INT NOT NULL FOREIGN KEY REFERENCES PhieuXuatVatTu(PhieuVatTuID) ON DELETE CASCADE,
        CayID        INT NOT NULL FOREIGN KEY REFERENCES VaiCay(CayID),
        KieuVai      NVARCHAR(10) NOT NULL DEFAULT N'Chính',  -- Chính / Phối
        KGXuat       DECIMAL(10,2) NOT NULL
    );
    CREATE INDEX IX_PXVTVai_Phieu ON PhieuXuatVatTuVai(PhieuVatTuID);
    CREATE INDEX IX_PXVTVai_Cay ON PhieuXuatVatTuVai(CayID);
    PRINT 'Da tao PhieuXuatVatTuVai.';
END ELSE PRINT 'PhieuXuatVatTuVai da ton tai, bo qua.';
GO

-- Chi tiet PHU KIEN / NPL: moi dong = 1 phu kien, SoLuong + DonVi.
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'PhieuXuatVatTuPhuKien')
BEGIN
    CREATE TABLE PhieuXuatVatTuPhuKien (
        ID           INT IDENTITY(1,1) PRIMARY KEY,
        PhieuVatTuID INT NOT NULL FOREIGN KEY REFERENCES PhieuXuatVatTu(PhieuVatTuID) ON DELETE CASCADE,
        PhuKienID    INT NOT NULL FOREIGN KEY REFERENCES DanhMucPhuKien(PhuKienID),
        SoLuong      DECIMAL(14,2) NOT NULL,
        DonVi        NVARCHAR(30) NULL,
        GhiChu       NVARCHAR(255) NULL
    );
    CREATE INDEX IX_PXVTPk_Phieu ON PhieuXuatVatTuPhuKien(PhieuVatTuID);
    PRINT 'Da tao PhieuXuatVatTuPhuKien.';
END ELSE PRINT 'PhieuXuatVatTuPhuKien da ton tai, bo qua.';
GO

/* ---------------- 2. TAO LAI vw_TonCayVai - UNION them PhieuXuatVatTuVai ---------------- */
-- Ton cay vai = KGNhap - TONG KG da xuat qua CA 2 loai phieu (cu + moi). Phieu cu van tru ton nhu truoc.
IF OBJECT_ID('dbo.vw_TonCayVai', 'V') IS NOT NULL DROP VIEW dbo.vw_TonCayVai;
GO
CREATE VIEW vw_TonCayVai AS
SELECT
    c.CayID, c.MaCay, c.VaiID, v.MaVai, v.MaPM, lv.TenLoaiVai, lv.MaLoai, ms.TenMau,
    c.KGNhap, ISNULL(x.KGXuatTong, 0) AS KGDaXuat,
    c.KGNhap - ISNULL(x.KGXuatTong, 0) AS KGCon,
    c.TrangThai, c.NgayNhap, c.ViTriKho, c.QRCode
FROM VaiCay c
JOIN DanhMucVai v ON v.VaiID = c.VaiID
LEFT JOIN LoaiVai lv ON lv.LoaiVaiID = v.LoaiVaiID
LEFT JOIN MauSac ms ON ms.MauSacID = v.MauSacID
LEFT JOIN (
    SELECT CayID, SUM(KGXuat) AS KGXuatTong FROM (
        SELECT CayID, KGXuat FROM PhieuXuatVaiChiTiet
        UNION ALL
        SELECT CayID, KGXuat FROM PhieuXuatVatTuVai
    ) z GROUP BY CayID
) x ON x.CayID = c.CayID;
GO

/* ---------------- 3. TAO LAI vw_TonKhoPhuKien - UNION them PhieuXuatVatTuPhuKien (luon la Xuat) ---------------- */
IF OBJECT_ID('dbo.vw_TonKhoPhuKien', 'V') IS NOT NULL DROP VIEW dbo.vw_TonKhoPhuKien;
GO
CREATE VIEW vw_TonKhoPhuKien AS
SELECT
    dm.PhuKienID, dm.MaPhuKien, dm.TenPhuKien, lpk.TenLoai, dm.Size, dm.DonViCoBan,
    ISNULL(SUM(CASE WHEN m.Loai = N'Nhập' THEN m.SoLuong ELSE 0 END), 0) AS TongNhap,
    ISNULL(SUM(CASE WHEN m.Loai = N'Xuất' THEN m.SoLuong ELSE 0 END), 0) AS TongXuat,
    ISNULL(SUM(CASE WHEN m.Loai = N'Nhập' THEN m.SoLuong ELSE -m.SoLuong END), 0) AS TonKho
FROM DanhMucPhuKien dm
LEFT JOIN LoaiPhuKien lpk ON lpk.LoaiPhuKienID = dm.LoaiPhuKienID
LEFT JOIN (
    -- Nguon cu: phieu phu kien (Nhap/Xuat)
    SELECT ct.PhuKienID, p.LoaiPhieu AS Loai, ct.SoLuong
    FROM PhieuPhuKienChiTiet ct JOIN PhieuPhuKien p ON p.PhieuID = ct.PhieuID
    UNION ALL
    -- Nguon moi: phieu xuat vat tu (luon la Xuat)
    SELECT PhuKienID, N'Xuất' AS Loai, SoLuong FROM PhieuXuatVatTuPhuKien
) m ON m.PhuKienID = dm.PhuKienID
GROUP BY dm.PhuKienID, dm.MaPhuKien, dm.TenPhuKien, lpk.TenLoai, dm.Size, dm.DonViCoBan;
GO

/* ---------------- 4. Module VATTU + ChucNang + Permissions ---------------- */
IF NOT EXISTS (SELECT 1 FROM Modules WHERE ModuleCode = N'VATTU')
    INSERT INTO Modules (ModuleCode, TenModule, ThuTu) VALUES (N'VATTU', N'Xuất vật tư', 10);
GO
-- Cap quyen day du cho nhom 'Kho' (von quan ly xuat vai + phu kien); nhom khac = 0 (Admin bypass).
INSERT INTO Permissions (GroupID, ModuleID, CanView, CanCreate, CanEdit, CanDelete)
SELECT g.GroupID, m.ModuleID,
       CASE WHEN g.TenNhom = N'Kho' THEN 1 ELSE 0 END,
       CASE WHEN g.TenNhom = N'Kho' THEN 1 ELSE 0 END,
       CASE WHEN g.TenNhom = N'Kho' THEN 1 ELSE 0 END,
       CASE WHEN g.TenNhom = N'Kho' THEN 1 ELSE 0 END
FROM Groups g CROSS JOIN Modules m
WHERE m.ModuleCode = N'VATTU' AND g.TenNhom <> N'Admin'
  AND NOT EXISTS (SELECT 1 FROM Permissions p WHERE p.GroupID = g.GroupID AND p.ModuleID = m.ModuleID);
GO
MERGE ChucNang AS t
USING (VALUES ('VATTU','xuatvattu', N'Phiếu xuất vật tư', 1)) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu)
ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
WHEN NOT MATCHED THEN INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu) VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu);
GO

PRINT '=== migration_v528.sql (Phieu xuat Vat tu) hoan tat ===';
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [28/81]  migration_v530.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [28/81] migration_v530.sql';
GO

/* ================================================================
   MIGRATION v5.30 — Gia cong: hang muc + nhieu nha + SL nhan; cong doan "Nhan gia cong" (NGC)
   ----------------------------------------------------------------
   Theo yeu cau (Ghi nhan tien do):
   - Cong doan "Giao gia cong" (GC): tick giao gia cong -> chon HANG MUC gia cong (don gia lay tu Ky
     thuat, BO he so), duoi moi hang muc them NHIEU nha gia cong + so luong tung nha. => them cot
     HangMucGiaCongID vao DonHangChiTietNhaGiaCong (moi dong = 1 nha thuoc 1 hang muc, don gia dung
     chung cua hang muc do lay tu DonHangHangMucGiaCong - chi xem).
   - Cong doan MOI "Nhan gia cong" (NGC) sau GC: hien cac nha da giao + SL giao, nhap SL NHAN.
     => them cot SoLuongNhan vao DonHangChiTietNhaGiaCong + them cong doan NGC vao CongDoanSanXuat.
   - He so o "Don gia Giao gia cong" (HangMucGiaCong.HeSoMacDinh / DonHangHangMucGiaCong.HeSo) chi bo
     KHOI GIAO DIEN, cot DB giu nguyen (mo coi) de khong mat du lieu / khong can migration pha.

   Chay 1 lan. IDEMPOTENT. YEU CAU: da co DonHangChiTietNhaGiaCong (migration_v513/v519/v524) +
   HangMucGiaCong/DonHangHangMucGiaCong (migration_v524) + CongDoanSanXuat.
   ================================================================ */
USE QLNoiBo;
GO

/* ---------------- 1. DonHangChiTietNhaGiaCong: + HangMucGiaCongID, + SoLuongNhan ---------------- */
IF COL_LENGTH('DonHangChiTietNhaGiaCong', 'HangMucGiaCongID') IS NULL
BEGIN
    ALTER TABLE DonHangChiTietNhaGiaCong ADD HangMucGiaCongID INT NULL
        FOREIGN KEY REFERENCES HangMucGiaCong(HangMucGiaCongID);
    PRINT 'Da them cot DonHangChiTietNhaGiaCong.HangMucGiaCongID.';
END ELSE PRINT 'Cot HangMucGiaCongID da ton tai, bo qua.';
GO

IF COL_LENGTH('DonHangChiTietNhaGiaCong', 'SoLuongNhan') IS NULL
BEGIN
    ALTER TABLE DonHangChiTietNhaGiaCong ADD SoLuongNhan INT NULL;
    PRINT 'Da them cot DonHangChiTietNhaGiaCong.SoLuongNhan.';
END ELSE PRINT 'Cot SoLuongNhan da ton tai, bo qua.';
GO

/* ---------------- 2. Cong doan moi 'NGC' (Nhan gia cong) - ThuTu 40, ngay sau GC(30), truoc MAY(70) --------- */
IF NOT EXISTS (SELECT 1 FROM CongDoanSanXuat WHERE MaCongDoan = N'NGC')
    INSERT INTO CongDoanSanXuat (TenCongDoan, ThuTu, MaCongDoan, LaHeThong) VALUES (N'Nhận gia công', 40, N'NGC', 1);
GO

PRINT '=== migration_v530.sql hoan tat ===';
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [29/81]  migration_v531.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [29/81] migration_v531.sql';
GO

/* ================================================================
   MIGRATION v5.31 — Fix cot DonHangChiTietVai (loi tao don hang) + Kieu vai o Phieu xuat kho + bo GNGC/NNGC
   ----------------------------------------------------------------
   1. FIX LOI "Invalid column name 'GhiChu'" khi tao/luu lenh san xuat: dam bao DonHangChiTietVai co du
      cac cot v5.27.1 (TenLoaiVaiTuDo / TenMauTuDo / GhiChu, MauSacID nullable). Loi xay ra khi da deploy
      code v5.27.1 nhung DB moi chi chay migration_v527 ban CU (chi co TenLoaiVaiTuDo). Doan nay lap lai
      y het migration_v527 (idempotent) - chay v531 la du de het loi, khong can tim lai v527.
   2. Phieu xuat kho vai: them cot KieuVai (Chính/Phối) cho tung cay tren phieu xuat.
   3. (Cong doan GNGC/NNGC cu - neu con trong CongDoanSanXuat cua DB - se duoc AN o tang code, khong xoa
      dong DB de tranh loi khoa ngoai/lich su; xem MA_CONG_DOAN_BO_QUA trong qlsx.js + loc dropdown.)

   Chay 1 lan. IDEMPOTENT.
   ================================================================ */
USE QLNoiBo;
GO

/* ---------------- 1. FIX cot DonHangChiTietVai (v5.27.1) ---------------- */
IF COL_LENGTH('dbo.DonHangChiTietVai','TenLoaiVaiTuDo') IS NULL
    ALTER TABLE DonHangChiTietVai ADD TenLoaiVaiTuDo NVARCHAR(150) NULL;
IF COL_LENGTH('dbo.DonHangChiTietVai','TenMauTuDo') IS NULL
    ALTER TABLE DonHangChiTietVai ADD TenMauTuDo NVARCHAR(100) NULL;
IF COL_LENGTH('dbo.DonHangChiTietVai','GhiChu') IS NULL
    ALTER TABLE DonHangChiTietVai ADD GhiChu NVARCHAR(255) NULL;
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.DonHangChiTietVai') AND name = 'MauSacID' AND is_nullable = 0)
    ALTER TABLE DonHangChiTietVai ALTER COLUMN MauSacID INT NULL;
GO

/* ---------------- 2. Phieu xuat kho vai: cot KieuVai (Chính/Phối) ---------------- */
IF COL_LENGTH('dbo.PhieuXuatVaiChiTiet','KieuVai') IS NULL
    ALTER TABLE PhieuXuatVaiChiTiet ADD KieuVai NVARCHAR(10) NULL;   -- Chính / Phối (NULL = coi nhu Chính)
GO

PRINT '=== migration_v531.sql hoan tat (fix DonHangChiTietVai + KieuVai phieu xuat kho) ===';
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [30/81]  migration_v532.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [30/81] migration_v532.sql';
GO

/* ================================================================
   MIGRATION v5.32 — In thêu thành 2 công đoạn (Giao/Nhận nhà in thêu), chèn sau Cắt trước Giao gia công
   ----------------------------------------------------------------
   Theo yeu cau: "Giao nha in theu" + "Nhan nha in theu" tro thanh 2 CONG DOAN trong Ghi nhan tien do
   (thay cho 2 tab rieng cu, se bo o frontend). Moi don CHON DUOC NHIEU nha in theu, moi nha co SL giao
   (cong doan Giao) + SL nhan (cong doan Nhan). Hien tong SL ban cat mau chinh o cong doan Giao (tham khao).

   - Bang moi DonHangNhaInTheu: nhieu dong/don (1 dong = 1 nha in theu + SL giao + SL nhan).
   - 2 cong doan moi: GIT (Giao in theu, ThuTu 22) + NIT (Nhan in theu, ThuTu 24) - nam GIUA Cat(20) va
     Giao gia cong GC(30). Luong: ... Cat -> Giao in theu -> Nhan in theu -> Giao gia cong -> ...
   - Cot cu DonHangSanXuat.NhaInID/NgayGiaoIn/NgayNhanIn GIU LAI (mo coi) cho lich su don cu + bao cao in.

   Chay 1 lan. IDEMPOTENT. YEU CAU: schema.sql (co NhaGiaCong, DonHangSanXuat, CongDoanSanXuat).
   ================================================================ */
USE QLNoiBo;
GO

/* ---------------- 1. Bang DonHangNhaInTheu (nhieu nha in theu / don) ---------------- */
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'DonHangNhaInTheu')
BEGIN
    CREATE TABLE DonHangNhaInTheu (
        ID          INT IDENTITY(1,1) PRIMARY KEY,
        DonHangID   INT NOT NULL FOREIGN KEY REFERENCES DonHangSanXuat(DonHangID) ON DELETE CASCADE,
        NhaInID     INT NOT NULL FOREIGN KEY REFERENCES NhaGiaCong(NhaGiaCongID),
        SoLuongGiao INT NULL,
        SoLuongNhan INT NULL,
        GhiChu      NVARCHAR(255) NULL,
        CreatedAt   DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    CREATE INDEX IX_DHNhaInTheu_Don ON DonHangNhaInTheu(DonHangID);
    PRINT 'Da tao DonHangNhaInTheu.';
END ELSE PRINT 'DonHangNhaInTheu da ton tai, bo qua.';
GO

/* ---------------- 2. 2 cong doan moi GIT + NIT (giua Cat 20 va GC 30) ---------------- */
IF NOT EXISTS (SELECT 1 FROM CongDoanSanXuat WHERE MaCongDoan = N'GIT')
    INSERT INTO CongDoanSanXuat (TenCongDoan, ThuTu, MaCongDoan, LaHeThong) VALUES (N'Giao in thêu', 22, N'GIT', 1);
IF NOT EXISTS (SELECT 1 FROM CongDoanSanXuat WHERE MaCongDoan = N'NIT')
    INSERT INTO CongDoanSanXuat (TenCongDoan, ThuTu, MaCongDoan, LaHeThong) VALUES (N'Nhận in thêu', 24, N'NIT', 1);
GO

PRINT '=== migration_v532.sql hoan tat (in theu 2 cong doan + DonHangNhaInTheu) ===';
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [31/81]  migration_v533.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [31/81] migration_v533.sql';
GO

/* ================================================================
   MIGRATION v5.33 — Cờ "Có in thêu" cho đơn hàng (bỏ qua công đoạn GIT/NIT nếu không in thêu)
   ----------------------------------------------------------------
   Theo yeu cau: don KHONG in theu thi bo qua 2 cong doan Giao/Nhan in theu (GIT/NIT), chuyen thang tu
   Cat sang Giao gia cong. Them cot bit CoInTheu tren DonHangSanXuat (mac dinh 0 = khong in theu).
   tinhNextStage() (qlsx.js) se bo qua GIT/NIT khi CoInTheu = 0; dropdown Ghi nhan tien do cung an GIT/NIT
   khi don khong in theu. Khai bao CoInTheu o "Ra lenh san xuat" (tao/sua don).

   Chay 1 lan. IDEMPOTENT.
   ================================================================ */
USE QLNoiBo;
GO

IF COL_LENGTH('dbo.DonHangSanXuat', 'CoInTheu') IS NULL
    ALTER TABLE DonHangSanXuat ADD CoInTheu BIT NOT NULL DEFAULT 0;
GO

PRINT '=== migration_v533.sql hoan tat (them DonHangSanXuat.CoInTheu) ===';
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [32/81]  migration_v534.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [32/81] migration_v534.sql';
GO

/* ================================================================
   MIGRATION v5.34 (Giai doan A) — Bang ke ban thanh pham (BTP)
   ----------------------------------------------------------------
   Chuc nang moi "Bang ke ban thanh pham" theo BANGKEBANTHANHPHAM.xlsx: bang luoi
     - Cot Size (them tu do, giong Thong so do).
     - Hang = MAU VAI CHINH lay tu cong doan Cat (cay vai Chinh -> DanhMucVai.MauSacID -> mau).
     - So lop dien san TU CONG DOAN CAT: tong TienDoCatChiTietCay.SoLuongLop cua cac cay CHINH cung mau
       (cay Chinh xac dinh qua PhieuXuatVaiChiTiet.KieuVai = N'Chính'; 1 mau nhieu ma cay -> cong don).
     - Moi o = so lop (sua duoc). Tong cong theo hang = tong cac o. Co Xem/In + Tao/Ap mau.

   Luu luoi dang JSON (ColsJson/RowsJson) cho don gian - bang la phieu in, khong truy van theo o.
   Chay 1 lan. IDEMPOTENT.
   ================================================================ */
USE QLNoiBo;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'BangKeBanThanhPham')
BEGIN
    CREATE TABLE BangKeBanThanhPham (
        ID          INT IDENTITY(1,1) PRIMARY KEY,
        DonHangID   INT NULL FOREIGN KEY REFERENCES DonHangSanXuat(DonHangID) ON DELETE CASCADE,  -- NULL = tai lieu mau
        MaHang      NVARCHAR(100) NULL,
        NgayCapNhat DATE NULL,
        GhiChu      NVARCHAR(255) NULL,
        LaMau       BIT NOT NULL DEFAULT 0,
        TenMau      NVARCHAR(150) NULL,
        ColsJson    NVARCHAR(MAX) NULL,   -- ["2","3",...] danh sach ten cot size
        RowsJson    NVARCHAR(MAX) NULL,   -- [{mauSacId, tenMau, ghiChu, values:["54",...]}]
        NguoiLapID  INT NULL FOREIGN KEY REFERENCES Users(UserID),
        CreatedAt   DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        UpdatedAt   DATETIME2 NULL
    );
    -- Moi don hang chi 1 bang ke (mau thi DonHangID NULL, khong ap rang buoc).
    CREATE UNIQUE INDEX UX_BangKeBTP_Don ON BangKeBanThanhPham(DonHangID) WHERE DonHangID IS NOT NULL;
    PRINT 'Da tao BangKeBanThanhPham.';
END ELSE PRINT 'BangKeBanThanhPham da ton tai, bo qua.';
GO

/* ChucNang 'bangkebtp' (QLSX) */
MERGE ChucNang AS t
USING (VALUES ('QLSX','bangkebtp', N'Bảng kê bán thành phẩm', 7)) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu)
ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
WHEN NOT MATCHED THEN INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu) VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu);
GO

PRINT '=== migration_v534.sql (Bang ke ban thanh pham) hoan tat ===';
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [33/81]  migration_v534b.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [33/81] migration_v534b.sql';
GO

/* ================================================================
   MIGRATION v5.34b (Giai doan B2) — Don gia cong doan may (model MOI)
   ----------------------------------------------------------------
   Muc 4.3: bang don gia cong doan may theo don hang, model MOI (khac DonHangCongDoanMay cu):
     Ten cong doan (tu do) / Giay gio (so) / He so cong doan (so) / He so cong nhan (mac dinh 4) /
     Thanh tien = Giay gio x He so cong doan x He so cong nhan.
   Nhieu dong / don. Thanh tien la cot TINH (PERSISTED) dung cho tinh luong khoan may (Giai doan C:
   luong = SL x Thanh tien). Nhap tai "Tài liệu may/Đóng gói" > "Đơn giá công đoạn may".
   Chay 1 lan. IDEMPOTENT.
   ================================================================ */
USE QLNoiBo;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'DonHangDonGiaCongDoanMay')
BEGIN
    CREATE TABLE DonHangDonGiaCongDoanMay (
        ID           INT IDENTITY(1,1) PRIMARY KEY,
        DonHangID    INT NOT NULL FOREIGN KEY REFERENCES DonHangSanXuat(DonHangID) ON DELETE CASCADE,
        TenCongDoan  NVARCHAR(150) NOT NULL,
        GiayGio      DECIMAL(14,4) NULL,
        HeSoCongDoan DECIMAL(14,4) NULL,
        HeSoCongNhan DECIMAL(14,4) NOT NULL DEFAULT 4,
        ThuTu        INT NOT NULL DEFAULT 0,
        ThanhTien    AS (ISNULL(GiayGio,0) * ISNULL(HeSoCongDoan,0) * ISNULL(HeSoCongNhan,0)) PERSISTED,
        CreatedAt    DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    CREATE INDEX IX_DGCDMay_Don ON DonHangDonGiaCongDoanMay(DonHangID);
    PRINT 'Da tao DonHangDonGiaCongDoanMay.';
END ELSE PRINT 'DonHangDonGiaCongDoanMay da ton tai, bo qua.';
GO

PRINT '=== migration_v534b.sql (Don gia cong doan may model moi) hoan tat ===';
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [34/81]  migration_v534c.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [34/81] migration_v534c.sql';
GO

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


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [35/81]  migration_v534d.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [35/81] migration_v534d.sql';
GO

/* ================================================================
   MIGRATION v5.34d (Giai doan C) — May giao viec theo don gia cong doan may MOI + luong = SL x Thanh tien
   ----------------------------------------------------------------
   Bang moi DonHangDonGiaCongDoanMay (v534b) khong co CongDoanMayID (dinh danh bang ID + TenCongDoan tu do),
   trong khi PhanCongMay (phan cong NV+SL) tham chieu CongDoanMayID. => Them cot noi:
     PhanCongMay.DonGiaCongDoanMayID -> DonHangDonGiaCongDoanMay(ID)  (nullable, dong cu van dung CongDoanMayID).
   Payroll doc dual-path: uu tien dong-gia-moi (SL x ThanhTien), fallback model cu (SL x DonGia x HeSo).
   Chay 1 lan. IDEMPOTENT.
   ================================================================ */
USE QLNoiBo;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('PhanCongMay') AND name = 'DonGiaCongDoanMayID')
BEGIN
    ALTER TABLE PhanCongMay ADD DonGiaCongDoanMayID INT NULL
        FOREIGN KEY REFERENCES DonHangDonGiaCongDoanMay(ID);
    PRINT 'Da them cot PhanCongMay.DonGiaCongDoanMayID (FK -> DonHangDonGiaCongDoanMay).';
END ELSE PRINT 'Cot PhanCongMay.DonGiaCongDoanMayID da ton tai, bo qua.';
GO

PRINT '=== migration_v534d.sql (May giao viec theo don gia moi + luong SL x Thanh tien) hoan tat ===';
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [36/81]  migration_v534e.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [36/81] migration_v534e.sql';
GO

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


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [37/81]  migration_v600.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [37/81] migration_v600.sql';
GO

/* ================================================================
   MIGRATION v6.0 (Phase 1) — PHAN HE QUAN LY NHAN SU (HRM)
   ----------------------------------------------------------------
   Bo sung phan he MOI "Quan ly nhan su" (module code 'HRM'). KHONG dung cham
   QLSX / Kho / Phu kien - chi THEM bang/cot moi, khong sua logic cu.

   Nguyen tac thiet ke:
   - MO RONG bang NhanVien da co (them cac truong ho so nhan su chuan) - TUYET DOI
     KHONG tao bang nhan vien moi. NhanVien da duoc QLSX dung (phan cong may/cat,
     PhanCongMay.NhanVienID...), tao bang song song se gay trung lap + lech du lieu.
   - Cot TrangThai cu (CHECK IN N'Dang lam'/N'Da nghi', QLSX loc theo do) GIU NGUYEN,
     KHONG doi. Trang thai lao dong HR chi tiet (Thu viec/Chinh thuc/Da nghi viec)
     dung 1 cot MOI 'TrangThaiLaoDong' de khong pha CHECK cu + khong lam hong QLSX.
   - Them Users.NhanVienID (FK) - nen mong cho "nhan vien dang nhap xem luong cua minh"
     o cac Phase Payroll sau. Nullable, khong bat buoc, khong anh huong dang nhap hien tai.
   - 4 bang moi luu vet lich su: HopDongLaoDong, PhuLucHopDong, QuyetDinhNhanSu,
     ThanhLyHopDong.
   - Seed Module 'HRM' + 5 ChucNang (hoso/hopdong/phuluc/quyetdinh/thanhly) khop key
     getTabs() ben frontend + hang Permissions (mac dinh 0 cho moi nhom tru Admin -
     du lieu nhan su nhay cam, Admin vao "Ma tran phan quyen" cap sau khi can).

   Chay 1 lan. IDEMPOTENT - chay lai khong tao trung, khong loi.
   YEU CAU TIEN QUYET: schema.sql goc + migration_v5_chucnang.sql (co bang
   ChucNang / ChucNangPermissions / Modules / Permissions / Groups / NhanVien / Users).
   ================================================================ */

USE QLNoiBo;
GO

/* ----------------------------------------------------------------
   1. MO RONG BANG NhanVien - them cac truong HO SO NHAN SU
   (moi cot deu NULLable + guard COL_LENGTH de chay lai an toan)
   ---------------------------------------------------------------- */
-- Thong tin ca nhan
IF COL_LENGTH('dbo.NhanVien','NgaySinh')        IS NULL ALTER TABLE NhanVien ADD NgaySinh DATE NULL;
IF COL_LENGTH('dbo.NhanVien','GioiTinh')        IS NULL ALTER TABLE NhanVien ADD GioiTinh NVARCHAR(10) NULL;      -- Nam / Nu / Khac
IF COL_LENGTH('dbo.NhanVien','SoCCCD')          IS NULL ALTER TABLE NhanVien ADD SoCCCD NVARCHAR(20) NULL;        -- CMND / CCCD
IF COL_LENGTH('dbo.NhanVien','NgayCapCCCD')     IS NULL ALTER TABLE NhanVien ADD NgayCapCCCD DATE NULL;
IF COL_LENGTH('dbo.NhanVien','NoiCapCCCD')      IS NULL ALTER TABLE NhanVien ADD NoiCapCCCD NVARCHAR(150) NULL;
IF COL_LENGTH('dbo.NhanVien','Email')           IS NULL ALTER TABLE NhanVien ADD Email NVARCHAR(100) NULL;
IF COL_LENGTH('dbo.NhanVien','DiaChi')          IS NULL ALTER TABLE NhanVien ADD DiaChi NVARCHAR(255) NULL;       -- dia chi cu tru (dung cho HDLD)
-- Thong tin cong viec
IF COL_LENGTH('dbo.NhanVien','ChucVu')          IS NULL ALTER TABLE NhanVien ADD ChucVu NVARCHAR(100) NULL;
IF COL_LENGTH('dbo.NhanVien','ChuyenMon')       IS NULL ALTER TABLE NhanVien ADD ChuyenMon NVARCHAR(150) NULL;
IF COL_LENGTH('dbo.NhanVien','TrangThaiLaoDong') IS NULL ALTER TABLE NhanVien ADD TrangThaiLaoDong NVARCHAR(30) NULL; -- Thu viec / Chinh thuc / Da nghi viec
IF COL_LENGTH('dbo.NhanVien','SoNguoiPhuThuoc') IS NULL ALTER TABLE NhanVien ADD SoNguoiPhuThuoc INT NULL;        -- so NPT (giam tru thue TNCN)
-- Thong tin tai khoan / thue / BHXH
IF COL_LENGTH('dbo.NhanVien','SoTaiKhoanNH')    IS NULL ALTER TABLE NhanVien ADD SoTaiKhoanNH NVARCHAR(50) NULL;
IF COL_LENGTH('dbo.NhanVien','TenNganHang')     IS NULL ALTER TABLE NhanVien ADD TenNganHang NVARCHAR(150) NULL;
IF COL_LENGTH('dbo.NhanVien','ChiNhanhNH')      IS NULL ALTER TABLE NhanVien ADD ChiNhanhNH NVARCHAR(150) NULL;   -- dung cho file chuyen khoan CK
IF COL_LENGTH('dbo.NhanVien','MaSoThueCaNhan')  IS NULL ALTER TABLE NhanVien ADD MaSoThueCaNhan NVARCHAR(30) NULL;
IF COL_LENGTH('dbo.NhanVien','NgayCapMST')      IS NULL ALTER TABLE NhanVien ADD NgayCapMST DATE NULL;
IF COL_LENGTH('dbo.NhanVien','SoSoBHXH')        IS NULL ALTER TABLE NhanVien ADD SoSoBHXH NVARCHAR(30) NULL;
GO

-- Backfill: nhan vien DA co truoc migration nay coi nhu 'Chinh thuc' (tranh de trong).
UPDATE NhanVien SET TrangThaiLaoDong = N'Chính thức' WHERE TrangThaiLaoDong IS NULL;
GO

/* ----------------------------------------------------------------
   2. LIEN KET Users -> NhanVien (nen mong cho self-service xem luong)
   ---------------------------------------------------------------- */
IF COL_LENGTH('dbo.Users','NhanVienID') IS NULL
    ALTER TABLE Users ADD NhanVienID INT NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Users_NhanVien')
    ALTER TABLE Users ADD CONSTRAINT FK_Users_NhanVien
        FOREIGN KEY (NhanVienID) REFERENCES NhanVien(NhanVienID);
GO

/* ----------------------------------------------------------------
   3. HOP DONG LAO DONG
   ---------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'HopDongLaoDong')
BEGIN
    CREATE TABLE HopDongLaoDong (
        HopDongID     INT IDENTITY(1,1) PRIMARY KEY,
        NhanVienID    INT NOT NULL FOREIGN KEY REFERENCES NhanVien(NhanVienID) ON DELETE CASCADE,
        SoHopDong     NVARCHAR(50) NULL,
        LoaiHopDong   NVARCHAR(50) NOT NULL DEFAULT N'Xác định thời hạn',  -- Thu viec / Xac dinh thoi han / Khong xac dinh thoi han
        TuNgay        DATE NULL,
        DenNgay       DATE NULL,                                            -- NULL = khong xac dinh thoi han
        ChucVu        NVARCHAR(100) NULL,
        NoiLamViec    NVARCHAR(150) NULL,
        LuongCoBan    DECIMAL(14,2) NULL,                                   -- LUONG CB - can cu tinh luong cong nhat + BHXH
        HeSoLuong     DECIMAL(10,4) NULL,
        PhuCapAnCa    DECIMAL(14,2) NULL,                                   -- an ca (mien thue)
        PhuCapTrangPhuc DECIMAL(14,2) NULL,                                 -- trang phuc (mien thue)
        PhuCapXangXe  DECIMAL(14,2) NULL,                                   -- xang xe (chiu thue)
        PhuCapDienThoai DECIMAL(14,2) NULL,                                 -- dien thoai (chiu thue)
        TrangThai     NVARCHAR(30) NOT NULL DEFAULT N'Hiệu lực',           -- Hieu luc / Het han / Da thanh ly
        FileDinhKem   NVARCHAR(500) NULL,                                   -- ban scan (tuy chon)
        GhiChu        NVARCHAR(500) NULL,
        NguoiTaoID    INT NULL FOREIGN KEY REFERENCES Users(UserID),
        CreatedAt     DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        UpdatedAt     DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    CREATE INDEX IX_HopDongLaoDong_NhanVien ON HopDongLaoDong(NhanVienID);
    PRINT 'Da tao bang HopDongLaoDong.';
END ELSE PRINT 'Bang HopDongLaoDong da ton tai, bo qua.';
GO

/* ----------------------------------------------------------------
   4. PHU LUC HOP DONG (luu vet thay doi luong / vi tri / dieu khoan)
   Chi tham chieu HopDongLaoDong (khong tham chieu truc tiep NhanVien de
   tranh nhieu duong cascade ve NhanVien).
   ---------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'PhuLucHopDong')
BEGIN
    CREATE TABLE PhuLucHopDong (
        PhuLucID       INT IDENTITY(1,1) PRIMARY KEY,
        HopDongID      INT NOT NULL FOREIGN KEY REFERENCES HopDongLaoDong(HopDongID) ON DELETE CASCADE,
        SoPhuLuc       NVARCHAR(50) NULL,
        NgayKy         DATE NULL,
        NgayHieuLuc    DATE NULL,
        NoiDungThayDoi NVARCHAR(MAX) NULL,
        LuongCoBanMoi  DECIMAL(14,2) NULL,
        ChucVuMoi      NVARCHAR(100) NULL,
        FileDinhKem    NVARCHAR(500) NULL,
        GhiChu         NVARCHAR(500) NULL,
        NguoiTaoID     INT NULL FOREIGN KEY REFERENCES Users(UserID),
        CreatedAt      DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    CREATE INDEX IX_PhuLucHopDong_HopDong ON PhuLucHopDong(HopDongID);
    PRINT 'Da tao bang PhuLucHopDong.';
END ELSE PRINT 'Bang PhuLucHopDong da ton tai, bo qua.';
GO

/* ----------------------------------------------------------------
   5. QUYET DINH NHAN SU (tang luong / khen thuong / ky luat / bo nhiem / dieu chuyen)
   ---------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'QuyetDinhNhanSu')
BEGIN
    CREATE TABLE QuyetDinhNhanSu (
        QuyetDinhID    INT IDENTITY(1,1) PRIMARY KEY,
        NhanVienID     INT NOT NULL FOREIGN KEY REFERENCES NhanVien(NhanVienID) ON DELETE CASCADE,
        SoQuyetDinh    NVARCHAR(50) NULL,
        LoaiQuyetDinh  NVARCHAR(50) NOT NULL,                 -- Tang luong / Khen thuong / Ky luat / Bo nhiem / Dieu chuyen
        NgayHieuLuc    DATE NULL,
        NoiDung        NVARCHAR(MAX) NULL,
        GiaTriCu       NVARCHAR(200) NULL,                    -- vd luong cu / chuc vu cu
        GiaTriMoi      NVARCHAR(200) NULL,                    -- vd luong moi / chuc vu moi
        FileDinhKem    NVARCHAR(500) NULL,
        GhiChu         NVARCHAR(500) NULL,
        NguoiTaoID     INT NULL FOREIGN KEY REFERENCES Users(UserID),
        CreatedAt      DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    CREATE INDEX IX_QuyetDinhNhanSu_NhanVien ON QuyetDinhNhanSu(NhanVienID);
    PRINT 'Da tao bang QuyetDinhNhanSu.';
END ELSE PRINT 'Bang QuyetDinhNhanSu da ton tai, bo qua.';
GO

/* ----------------------------------------------------------------
   6. THANH LY HOP DONG (nghi viec)
   NhanVienID: cascade. HopDongID: KHONG cascade (tranh nhieu duong cascade
   ve NhanVien -> loi "multiple cascade paths"); dung NO ACTION + nullable.
   ---------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ThanhLyHopDong')
BEGIN
    CREATE TABLE ThanhLyHopDong (
        ThanhLyID         INT IDENTITY(1,1) PRIMARY KEY,
        NhanVienID        INT NOT NULL FOREIGN KEY REFERENCES NhanVien(NhanVienID) ON DELETE CASCADE,
        HopDongID         INT NULL FOREIGN KEY REFERENCES HopDongLaoDong(HopDongID),  -- NO ACTION co y
        NgayNghiViec      DATE NOT NULL,
        LyDoNghi          NVARCHAR(500) NULL,
        TroCap            DECIMAL(14,2) NULL,                  -- tro cap thoi viec
        KhauTru           DECIMAL(14,2) NULL,                  -- khau tru khi nghi
        TrangThaiBanGiao  NVARCHAR(50) NULL DEFAULT N'Chưa bàn giao', -- Chua ban giao / Dang ban giao / Da ban giao
        FileDinhKem       NVARCHAR(500) NULL,
        GhiChu            NVARCHAR(500) NULL,
        NguoiTaoID        INT NULL FOREIGN KEY REFERENCES Users(UserID),
        CreatedAt         DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    CREATE INDEX IX_ThanhLyHopDong_NhanVien ON ThanhLyHopDong(NhanVienID);
    PRINT 'Da tao bang ThanhLyHopDong.';
END ELSE PRINT 'Bang ThanhLyHopDong da ton tai, bo qua.';
GO

/* ----------------------------------------------------------------
   7. SEED Module 'HRM' + Permissions (mac dinh chi Admin thay)
   ---------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM Modules WHERE ModuleCode = N'HRM')
    INSERT INTO Modules (ModuleCode, TenModule, ThuTu) VALUES (N'HRM', N'Quản lý nhân sự', 7);
GO

-- Tao hang Permissions cho moi nhom (tru Admin) voi TAT CA = 0, de module hien trong
-- "Ma tran phan quyen" nhung mac dinh khong nhom nao thay (du lieu nhan su nhay cam).
-- Admin (IsAdmin=1) bo qua bang Permissions nen luon thay.
INSERT INTO Permissions (GroupID, ModuleID, CanView, CanCreate, CanEdit, CanDelete)
SELECT g.GroupID, m.ModuleID, 0, 0, 0, 0
FROM Groups g CROSS JOIN Modules m
WHERE m.ModuleCode = N'HRM' AND g.TenNhom <> N'Admin'
  AND NOT EXISTS (SELECT 1 FROM Permissions p WHERE p.GroupID = g.GroupID AND p.ModuleID = m.ModuleID);
GO

/* ----------------------------------------------------------------
   8. SEED ChucNang cho HRM (khop dung key getTabs() cua module.hrm.js)
   ---------------------------------------------------------------- */
MERGE ChucNang AS t
USING (VALUES
    ('HRM','hoso',      N'Hồ sơ nhân sự',     1),
    ('HRM','hopdong',   N'Hợp đồng lao động', 2),
    ('HRM','phuluc',    N'Phụ lục hợp đồng',  3),
    ('HRM','quyetdinh', N'Quyết định nhân sự',4),
    ('HRM','thanhly',   N'Thanh lý hợp đồng', 5)
) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu)
ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
WHEN NOT MATCHED THEN
    INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu) VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu);
GO

PRINT '=== migration_v600.sql (HRM Phase 1) hoan tat ===';
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [38/81]  migration_v610.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [38/81] migration_v610.sql';
GO

/* ================================================================
   MIGRATION v6.1 (Payroll Phase 2) — CAU HINH LUONG + CHAM CONG + BANG LUONG CONG NHAT
   ----------------------------------------------------------------
   Phan he MOI 'PAYROLL' (Tinh luong). Phase 2 phu trach: cau hinh hang so luong,
   bieu thue TNCN, cong chuan thang, may cham cong (ket noi IP/port), bang cham cong,
   va bang luong CONG NHAT (tinh theo cong thuc BANG LUONG cua file luong.xlsm).
   Cac mo hinh luong khac (khoan may / gia cong / in theu) o cac Phase sau.

   Nguyen tac:
   - Hang so luong (BHXH/BHYT/BHTN, giam tru, gio chuan, he so tang ca, bieu thue) deu
     CAU HINH DUOC (bang CauHinhLuong + BacThueTNCN + CongChuanThang) - KHONG hard-code
     trong code (so lieu cong ty MOYN dang dung khac luat: giam tru 15.5tr/6.2tr, bieu
     thue 5 bac tuy chinh - seed sang mac dinh theo dung file, sua duoc sau).
   - Cham cong: ho tro ket noi may cham cong theo IP+Port (mac dinh giao thuc ZKTeco,
     cong 4370) + import file, luu raw punch (ChamCongRaw) roi tong hop thanh ngay
     (ChamCongNgay). Map ma tren may -> nhan vien qua cot moi NhanVien.MaChamCong.
   - Bang luong = header (BangLuong theo Nam/Thang/Loai) + chi tiet (BangLuongChiTiet,
     SNAPSHOT cac cot da tinh de khong bi doi khi sua cau hinh sau).

   Chay 1 lan. IDEMPOTENT. YEU CAU TIEN QUYET: schema.sql + migration_v5_chucnang.sql
   + migration_v600.sql (NhanVien da mo rong, co Users.NhanVienID).
   ================================================================ */

USE QLNoiBo;
GO

/* ----------------------------------------------------------------
   1. CAU HINH LUONG (1 dong duy nhat, ID = 1)
   ---------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CauHinhLuong')
BEGIN
    CREATE TABLE CauHinhLuong (
        ID              INT NOT NULL PRIMARY KEY DEFAULT 1 CHECK (ID = 1),  -- ep chi 1 dong
        BhxhNld         DECIMAL(5,2) NOT NULL DEFAULT 8,     -- % BHXH nguoi lao dong
        BhytNld         DECIMAL(5,2) NOT NULL DEFAULT 1.5,   -- % BHYT NLD
        BhtnNld         DECIMAL(5,2) NOT NULL DEFAULT 1,     -- % BHTN NLD
        BhxhDn          DECIMAL(5,2) NOT NULL DEFAULT 17.5,  -- % BHXH doanh nghiep
        BhytDn          DECIMAL(5,2) NOT NULL DEFAULT 3,
        BhtnDn          DECIMAL(5,2) NOT NULL DEFAULT 1,
        GiamTruBanThan  DECIMAL(14,2) NOT NULL DEFAULT 15500000, -- giam tru gia canh ban than (MOYN dung 15.5tr)
        GiamTruNPT      DECIMAL(14,2) NOT NULL DEFAULT 6200000,  -- giam tru moi nguoi phu thuoc (MOYN dung 6.2tr)
        GioChuanNgay    DECIMAL(4,1) NOT NULL DEFAULT 8,     -- so gio chuan 1 ngay cong
        HsTangCaThuong  DECIMAL(4,2) NOT NULL DEFAULT 1.5,   -- he so tang ca ngay thuong (150%)
        HsTangCaChuNhat DECIMAL(4,2) NOT NULL DEFAULT 2.0,   -- CN/nghi tuan (200%)
        HsTangCaLeTet   DECIMAL(4,2) NOT NULL DEFAULT 3.0,   -- le tet (300%)
        PcCaDem         DECIMAL(4,2) NOT NULL DEFAULT 0.3,   -- phu cap ca dem (+30%)
        PcTangCaDem     DECIMAL(4,2) NOT NULL DEFAULT 0.2,   -- tang ca vao ban dem (+20%)
        NgayTraLuong    INT NOT NULL DEFAULT 10,             -- ngay tra luong hang thang
        UpdatedAt       DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    INSERT INTO CauHinhLuong (ID) VALUES (1);   -- seed 1 dong mac dinh
    PRINT 'Da tao + seed CauHinhLuong.';
END ELSE PRINT 'Bang CauHinhLuong da ton tai, bo qua.';
GO

/* ----------------------------------------------------------------
   2. CONG CHUAN THANG (so ngay cong chuan tung thang - dung chia luong ngay cong)
   ---------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CongChuanThang')
BEGIN
    CREATE TABLE CongChuanThang (
        Nam         INT NOT NULL,
        Thang       INT NOT NULL,
        SoNgayCong  DECIMAL(4,1) NOT NULL,
        PRIMARY KEY (Nam, Thang)
    );
    PRINT 'Da tao CongChuanThang.';
END ELSE PRINT 'Bang CongChuanThang da ton tai, bo qua.';
GO
-- Seed cong chuan 2026 (theo INFO!E90:E101 cua file luong.xlsm). Idempotent.
MERGE CongChuanThang AS t
USING (VALUES
    (2026,1,27),(2026,2,24),(2026,3,26),(2026,4,26),(2026,5,26),(2026,6,26),
    (2026,7,27),(2026,8,26),(2026,9,26),(2026,10,27),(2026,11,25),(2026,12,27)
) AS s (Nam, Thang, SoNgayCong)
ON t.Nam = s.Nam AND t.Thang = s.Thang
WHEN NOT MATCHED THEN INSERT (Nam, Thang, SoNgayCong) VALUES (s.Nam, s.Thang, s.SoNgayCong);
GO

/* ----------------------------------------------------------------
   3. BIEU THUE TNCN (5 bac tuy chinh theo file - MAX-of-lines: thue = TNtinhthue*suat - trudi)
   ---------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'BacThueTNCN')
BEGIN
    CREATE TABLE BacThueTNCN (
        Bac       INT NOT NULL PRIMARY KEY,
        TuMuc     DECIMAL(14,2) NOT NULL,        -- gioi han duoi (thang)
        DenMuc    DECIMAL(14,2) NULL,            -- gioi han tren (NULL = tro len)
        ThueSuat  DECIMAL(6,4) NOT NULL,         -- vd 0.05
        TruDi     DECIMAL(14,2) NOT NULL DEFAULT 0
    );
    PRINT 'Da tao BacThueTNCN.';
END ELSE PRINT 'Bang BacThueTNCN da ton tai, bo qua.';
GO
MERGE BacThueTNCN AS t
USING (VALUES
    (1, 0,          10000000,  0.05, 0),
    (2, 10000000,   30000000,  0.10, 500000),
    (3, 30000000,   60000000,  0.20, 3500000),
    (4, 60000000,   100000000, 0.30, 9500000),
    (5, 100000000,  NULL,      0.35, 14500000)
) AS s (Bac, TuMuc, DenMuc, ThueSuat, TruDi)
ON t.Bac = s.Bac
WHEN NOT MATCHED THEN INSERT (Bac, TuMuc, DenMuc, ThueSuat, TruDi) VALUES (s.Bac, s.TuMuc, s.DenMuc, s.ThueSuat, s.TruDi);
GO

/* ----------------------------------------------------------------
   4. MAY CHAM CONG (ket noi IP + Port) + cot map ma may tren NhanVien
   ---------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'MayChamCong')
BEGIN
    CREATE TABLE MayChamCong (
        MayChamCongID INT IDENTITY(1,1) PRIMARY KEY,
        TenMay        NVARCHAR(100) NOT NULL,
        DiaChiIP      NVARCHAR(50) NOT NULL,
        Port          INT NOT NULL DEFAULT 4370,
        LoaiGiaoThuc  NVARCHAR(30) NOT NULL DEFAULT N'ZKTeco',  -- ZKTeco (mac dinh) / khac
        ViTri         NVARCHAR(150) NULL,
        TrangThai     NVARCHAR(20) NOT NULL DEFAULT N'Hoạt động',
        GhiChu        NVARCHAR(255) NULL,
        LanDongBoCuoi DATETIME2 NULL,       -- lan keo du lieu gan nhat
        CreatedAt     DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    PRINT 'Da tao MayChamCong.';
END ELSE PRINT 'Bang MayChamCong da ton tai, bo qua.';
GO
-- Ma dinh danh nhan vien tren may cham cong (Enroll ID) - map raw punch -> NhanVien.
IF COL_LENGTH('dbo.NhanVien','MaChamCong') IS NULL ALTER TABLE NhanVien ADD MaChamCong NVARCHAR(30) NULL;
GO

/* ----------------------------------------------------------------
   5. CHAM CONG RAW (punch tho keo tu may) + CHAM CONG NGAY (tong hop 1 nhan vien / 1 ngay)
   ---------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ChamCongRaw')
BEGIN
    CREATE TABLE ChamCongRaw (
        ID            BIGINT IDENTITY(1,1) PRIMARY KEY,
        MayChamCongID INT NULL FOREIGN KEY REFERENCES MayChamCong(MayChamCongID),
        MaChamMay     NVARCHAR(30) NULL,      -- enroll id tren may (map sang NhanVien.MaChamCong)
        NhanVienID    INT NULL FOREIGN KEY REFERENCES NhanVien(NhanVienID),
        ThoiGian      DATETIME2 NOT NULL,
        TrangThai     NVARCHAR(10) NULL,      -- in / out (neu may co tra)
        Nguon         NVARCHAR(20) NOT NULL DEFAULT N'May',  -- May / Import
        CreatedAt     DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT UQ_ChamCongRaw UNIQUE (MayChamCongID, MaChamMay, ThoiGian)  -- chong keo trung 1 punch
    );
    CREATE INDEX IX_ChamCongRaw_Time ON ChamCongRaw(ThoiGian);
    PRINT 'Da tao ChamCongRaw.';
END ELSE PRINT 'Bang ChamCongRaw da ton tai, bo qua.';
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ChamCongNgay')
BEGIN
    CREATE TABLE ChamCongNgay (
        ID             INT IDENTITY(1,1) PRIMARY KEY,
        NhanVienID     INT NOT NULL FOREIGN KEY REFERENCES NhanVien(NhanVienID) ON DELETE CASCADE,
        Ngay           DATE NOT NULL,
        MaCham         NVARCHAR(10) NULL,       -- x / x2 (nua cong) / P / TS / KL / LT ...
        SoCong         DECIMAL(4,2) NOT NULL DEFAULT 0,  -- 1 / 0.5 ...
        GioTangCaThuong DECIMAL(5,2) NOT NULL DEFAULT 0,
        GioTangCaChuNhat DECIMAL(5,2) NOT NULL DEFAULT 0,
        GioTangCaLeTet DECIMAL(5,2) NOT NULL DEFAULT 0,
        CaDem          BIT NOT NULL DEFAULT 0,
        GioVao         TIME NULL,
        GioRa          TIME NULL,
        Nguon          NVARCHAR(20) NOT NULL DEFAULT N'May',  -- May / Import / ThuCong
        GhiChu         NVARCHAR(255) NULL,
        CONSTRAINT UQ_ChamCongNgay UNIQUE (NhanVienID, Ngay)
    );
    CREATE INDEX IX_ChamCongNgay_Ngay ON ChamCongNgay(Ngay);
    PRINT 'Da tao ChamCongNgay.';
END ELSE PRINT 'Bang ChamCongNgay da ton tai, bo qua.';
GO

/* ----------------------------------------------------------------
   6. BANG LUONG (header) + BANG LUONG CHI TIET (snapshot cac cot da tinh)
   ---------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'BangLuong')
BEGIN
    CREATE TABLE BangLuong (
        BangLuongID INT IDENTITY(1,1) PRIMARY KEY,
        Nam         INT NOT NULL,
        Thang       INT NOT NULL,
        Loai        NVARCHAR(20) NOT NULL DEFAULT N'CongNhat',  -- CongNhat / KhoanMay / GiaCong / InTheu (Phase sau)
        NgayLap     DATE NULL,
        NguoiLapID  INT NULL FOREIGN KEY REFERENCES Users(UserID),
        TrangThai   NVARCHAR(20) NOT NULL DEFAULT N'Nháp',      -- Nhap / Da chot
        GhiChu      NVARCHAR(500) NULL,
        CreatedAt   DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT UQ_BangLuong UNIQUE (Nam, Thang, Loai)
    );
    PRINT 'Da tao BangLuong.';
END ELSE PRINT 'Bang BangLuong da ton tai, bo qua.';
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'BangLuongChiTiet')
BEGIN
    CREATE TABLE BangLuongChiTiet (
        ID            INT IDENTITY(1,1) PRIMARY KEY,
        BangLuongID   INT NOT NULL FOREIGN KEY REFERENCES BangLuong(BangLuongID) ON DELETE CASCADE,
        NhanVienID    INT NOT NULL FOREIGN KEY REFERENCES NhanVien(NhanVienID),
        Cong          DECIMAL(6,2) NOT NULL DEFAULT 0,   -- cong thuc te
        LuongCoBan    DECIMAL(14,2) NOT NULL DEFAULT 0,
        LuongNgayCong DECIMAL(14,2) NOT NULL DEFAULT 0,   -- LuongCB * Cong / CongChuan
        PcAnCa        DECIMAL(14,2) NOT NULL DEFAULT 0,
        PcTrangPhuc   DECIMAL(14,2) NOT NULL DEFAULT 0,
        PcXangXe      DECIMAL(14,2) NOT NULL DEFAULT 0,
        PcDienThoai   DECIMAL(14,2) NOT NULL DEFAULT 0,
        TangCa        DECIMAL(14,2) NOT NULL DEFAULT 0,   -- tien tang ca (neu gop)
        Thuong        DECIMAL(14,2) NOT NULL DEFAULT 0,
        TnMienThue    DECIMAL(14,2) NOT NULL DEFAULT 0,   -- an ca + trang phuc
        TnChiuThue    DECIMAL(14,2) NOT NULL DEFAULT 0,
        BhxhNld       DECIMAL(14,2) NOT NULL DEFAULT 0,
        BhytNld       DECIMAL(14,2) NOT NULL DEFAULT 0,
        BhtnNld       DECIMAL(14,2) NOT NULL DEFAULT 0,
        TongBH        DECIMAL(14,2) NOT NULL DEFAULT 0,
        GiamTruBanThan DECIMAL(14,2) NOT NULL DEFAULT 0,
        GiamTruNPT    DECIMAL(14,2) NOT NULL DEFAULT 0,
        TnTinhThue    DECIMAL(14,2) NOT NULL DEFAULT 0,
        ThueTNCN      DECIMAL(14,2) NOT NULL DEFAULT 0,
        TamUng        DECIMAL(14,2) NOT NULL DEFAULT 0,
        ThucLinh      DECIMAL(14,2) NOT NULL DEFAULT 0,
        GhiChu        NVARCHAR(255) NULL,
        CONSTRAINT UQ_BangLuongChiTiet UNIQUE (BangLuongID, NhanVienID)
    );
    PRINT 'Da tao BangLuongChiTiet.';
END ELSE PRINT 'Bang BangLuongChiTiet da ton tai, bo qua.';
GO

/* ----------------------------------------------------------------
   7. SEED Module 'PAYROLL' + Permissions (mac dinh chi Admin) + ChucNang Phase 2
   ---------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM Modules WHERE ModuleCode = N'PAYROLL')
    INSERT INTO Modules (ModuleCode, TenModule, ThuTu) VALUES (N'PAYROLL', N'Tính lương', 8);
GO
INSERT INTO Permissions (GroupID, ModuleID, CanView, CanCreate, CanEdit, CanDelete)
SELECT g.GroupID, m.ModuleID, 0, 0, 0, 0
FROM Groups g CROSS JOIN Modules m
WHERE m.ModuleCode = N'PAYROLL' AND g.TenNhom <> N'Admin'
  AND NOT EXISTS (SELECT 1 FROM Permissions p WHERE p.GroupID = g.GroupID AND p.ModuleID = m.ModuleID);
GO
-- ChucNang Phase 2 (khop key getTabs() cua module.payroll.js). Cac mo hinh luong khac them o Phase sau.
MERGE ChucNang AS t
USING (VALUES
    ('PAYROLL','cauhinh',       N'Cấu hình lương', 1),
    ('PAYROLL','chamcong',      N'Chấm công',      2),
    ('PAYROLL','luongcongnhat', N'Lương công nhật',3)
) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu)
ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
WHEN NOT MATCHED THEN INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu) VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu);
GO

PRINT '=== migration_v610.sql (Payroll Phase 2) hoan tat ===';
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [39/81]  migration_v620.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [39/81] migration_v620.sql';
GO

/* ================================================================
   MIGRATION v6.2 (Payroll Phase 3) — LUONG KHOAN MAY + SELF-SERVICE "Bang luong cua toi"
   ----------------------------------------------------------------
   - Them ChucNang PAYROLL 'luongmay' (bang luong khoan may - tinh tu PhanCongMay x don gia
     cong doan may cua don hang, KHONG doi schema QLSX - chi doc).
   - Them phan he MOI 'MYPAY' (Bang luong cua toi) - HIEN cho MOI nhan vien dang nhap (khong
     phai quyen quan tri): seed Permissions CanView=1 cho tat ca cac nhom (tru Admin da bypass).
     Nhan vien chi thay luong CUA CHINH MINH (backend loc theo Users.NhanVienID - da them o v600).
   - (Cot Users.NhanVienID da co tu migration_v600.sql; Phase 3 bat dau DUNG no: form Tai khoan
     them lien ket nhan vien, loadUserContext tra ve nhanVienId.)

   Chay 1 lan. IDEMPOTENT. YEU CAU TIEN QUYET: migration_v600.sql + migration_v610.sql.
   ================================================================ */

USE QLNoiBo;
GO

-- 1. ChucNang moi cho PAYROLL: 'luongmay'
MERGE ChucNang AS t
USING (VALUES ('PAYROLL','luongmay', N'Lương khoán may', 4)) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu)
ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
WHEN NOT MATCHED THEN INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu) VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu);
GO

-- 2. Module MYPAY (Bang luong cua toi) - hien cho moi nguoi
IF NOT EXISTS (SELECT 1 FROM Modules WHERE ModuleCode = N'MYPAY')
    INSERT INTO Modules (ModuleCode, TenModule, ThuTu) VALUES (N'MYPAY', N'Bảng lương của tôi', 9);
GO
-- Cap quyen XEM cho TAT CA cac nhom (tru Admin - da bypass). Nhan vien thuong van thay module nay.
INSERT INTO Permissions (GroupID, ModuleID, CanView, CanCreate, CanEdit, CanDelete)
SELECT g.GroupID, m.ModuleID, 1, 0, 0, 0
FROM Groups g CROSS JOIN Modules m
WHERE m.ModuleCode = N'MYPAY' AND g.TenNhom <> N'Admin'
  AND NOT EXISTS (SELECT 1 FROM Permissions p WHERE p.GroupID = g.GroupID AND p.ModuleID = m.ModuleID);
GO
-- Neu module MYPAY da ton tai tu lan chay truoc nhung 1 so nhom dang CanView=0, dam bao bat len 1.
UPDATE p SET CanView = 1
FROM Permissions p JOIN Modules m ON m.ModuleID = p.ModuleID
WHERE m.ModuleCode = N'MYPAY';
GO
MERGE ChucNang AS t
USING (VALUES ('MYPAY','luongcuatoi', N'Bảng lương của tôi', 1)) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu)
ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
WHEN NOT MATCHED THEN INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu) VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu);
GO

PRINT '=== migration_v620.sql (Payroll Phase 3) hoan tat ===';
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [40/81]  migration_v630.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [40/81] migration_v630.sql';
GO

/* ================================================================
   MIGRATION v6.3 (Payroll Phase 4) — LUONG/CHI PHI GIA CONG NGOAI + IN THEU
   ----------------------------------------------------------------
   - Them ChucNang PAYROLL 'luonggcinthe' (tong hop tu QLSX, KHONG doi schema - chi doc):
       Gia cong: SUM(DonHangChiTietNhaGiaCong.SoLuongNhan x don gia hang muc) theo tung Nha gia cong.
       In theu:  DonHangNhaInTheu.SoLuongNhan x (tong DonHangDonGiaInThe.DonGia cua don) theo tung Nha in.
   - Loc theo thang tao dong giao (CreatedAt) vi SL nhan khong co cot ngay rieng.
   Chay 1 lan. IDEMPOTENT. YEU CAU: migration_v600/v610/v620 (+ nhanh QLSX v5.30/v5.32/v5.34c da co
   cac cot SoLuongNhan / bang DonHangNhaInTheu / DonHangDonGiaInThe).
   ================================================================ */
USE QLNoiBo;
GO

MERGE ChucNang AS t
USING (VALUES ('PAYROLL','luonggcinthe', N'Lương gia công / In thêu', 5)) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu)
ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
WHEN NOT MATCHED THEN INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu) VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu);
GO

PRINT '=== migration_v630.sql (Payroll Phase 4 - luong gia cong/in theu) hoan tat ===';
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [41/81]  migration_v640.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [41/81] migration_v640.sql';
GO

/* ================================================================
   MIGRATION v6.4 (Payroll Phase 4b) — LƯƠNG LÀ (LA) + ĐÓNG GÓI (DG)
   ----------------------------------------------------------------
   - DonHangDonGiaLaDongGoi: đơn giá là / đóng gói theo đơn (Loai 'LA'/'DG') — khai ở "Tài liệu may/Đóng gói".
   - PhanCongLaDongGoi: giao việc LA/DG theo MÀU (NhanVien + SL / màu). Bảng RIÊNG (không dùng PhanCongMay)
     để KHÔNG lẫn vào lương khoán may (loadLuongKhoanMay không lọc stage). Stage suy từ TienDoSanXuat.StageID.
   - ChucNang PAYROLL 'luongladonggoi'.
   Chạy 1 lần. IDEMPOTENT.
   ================================================================ */
USE QLNoiBo;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'DonHangDonGiaLaDongGoi')
BEGIN
    CREATE TABLE DonHangDonGiaLaDongGoi (
        ID        INT IDENTITY(1,1) PRIMARY KEY,
        DonHangID INT NOT NULL FOREIGN KEY REFERENCES DonHangSanXuat(DonHangID) ON DELETE CASCADE,
        Loai      NVARCHAR(2) NOT NULL,   -- 'LA' (là/ủi) / 'DG' (đóng gói)
        DonGia    DECIMAL(14,2) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT UQ_DGLaDongGoi UNIQUE (DonHangID, Loai)
    );
    PRINT 'Da tao DonHangDonGiaLaDongGoi.';
END ELSE PRINT 'DonHangDonGiaLaDongGoi da ton tai, bo qua.';
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'PhanCongLaDongGoi')
BEGIN
    CREATE TABLE PhanCongLaDongGoi (
        ID         INT IDENTITY(1,1) PRIMARY KEY,
        TienDoID   INT NOT NULL FOREIGN KEY REFERENCES TienDoSanXuat(TienDoID) ON DELETE CASCADE,
        NhanVienID INT NOT NULL FOREIGN KEY REFERENCES NhanVien(NhanVienID),
        MauSacID   INT NULL FOREIGN KEY REFERENCES MauSac(MauSacID),
        SoLuong    INT NOT NULL DEFAULT 0
    );
    CREATE INDEX IX_PCLaDongGoi_TienDo ON PhanCongLaDongGoi(TienDoID);
    PRINT 'Da tao PhanCongLaDongGoi.';
END ELSE PRINT 'PhanCongLaDongGoi da ton tai, bo qua.';
GO

MERGE ChucNang AS t
USING (VALUES ('PAYROLL','luongladonggoi', N'Lương là / đóng gói', 6)) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu)
ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
WHEN NOT MATCHED THEN INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu) VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu);
GO

PRINT '=== migration_v640.sql (Luong la/dong goi) hoan tat ===';
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [42/81]  migration_v641.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [42/81] migration_v641.sql';
GO

/* ================================================================
   MIGRATION v6.41 — Phân quyền cho 2 tab "Tài liệu may/Đóng gói" + "Tài liệu in thêu"
   ----------------------------------------------------------------
   2 tab này (thêm ở v5.34) trước đây gate CHUNG ChucNang 'tailieukythuat' nên KHÔNG hiện
   trong màn Phân quyền. Thêm 2 ChucNang QLSX riêng để admin cấp/ẩn từng tab (ma trận phân quyền
   đọc động bảng ChucNang nên chỉ cần seed là hiện). Backend đã đổi sang gate theo loai.
   Chạy 1 lần. IDEMPOTENT.
   ================================================================ */
USE QLNoiBo;
GO

MERGE ChucNang AS t
USING (VALUES
    ('QLSX','tailieumay',   N'Tài liệu may/Đóng gói', 10),
    ('QLSX','tailieuinthe', N'Tài liệu in thêu',      11)
) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu)
ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
WHEN NOT MATCHED THEN INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu) VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu);
GO

PRINT '=== migration_v641.sql (ChucNang tailieumay + tailieuinthe) hoan tat ===';
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [43/81]  migration_v642.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [43/81] migration_v642.sql';
GO

/* ================================================================
   MIGRATION v6.42 — Sửa mất dữ liệu khi SỬA thẻ kho hàng hóa
   ----------------------------------------------------------------
   Nguyên nhân: form "Sửa thẻ kho" lấy dữ liệu từ view vw_TonKhoHangHoa để điền sẵn.
   Qua các lần sửa view (migration_v54 thêm NhomSanPhamID/TenNhom; migration_v517
   thêm GiaAloha/MaBarcode nhưng LỠ BỎ NhomSanPhamID/TenNhom), view KHÔNG bao giờ
   trả về TheKhoDanhMucID (chỉ có TenTheKho) và có bản còn thiếu GiaAloha/NhomSanPhamID.
   => Khi Sửa, các ô "Danh mục thẻ kho" (TheKhoDanhMucID), "Loại hàng" (NhomSanPhamID),
   "Giá Aloha" không điền lại được -> lưu xuống NULL -> mất dữ liệu dù không sửa.

   Bản này DỰNG LẠI view với ĐẦY ĐỦ mọi cột frontend cần (hợp nhất v54 + v517 + thêm
   TheKhoDanhMucID). CREATE OR ALTER — idempotent, không đổi dữ liệu (view không lưu data).
   Chạy 1 lần.
   ================================================================ */
USE QLNoiBo;
GO

CREATE OR ALTER VIEW vw_TonKhoHangHoa AS
SELECT
    h.MaHangID, h.MaHang, h.TenHang, h.GiaBan, h.LoaiRi, h.AnhDaiDien,
    h.TheKhoDanhMucID, tk.TenTheKho,
    h.LoaiHang, h.DonHangID, h.DonViCoBan, h.DonViQuyDoi, d.MaDH,
    h.GiaAloha, h.MaBarcode,
    h.NhomSanPhamID, nsp.TenNhom,
    ISNULL(SUM(ct.SoCatCai), 0) AS TongSoCat,
    ISNULL(SUM(ct.NhapCai), 0) AS TongNhap,
    ISNULL(SUM(ct.XuatCai), 0) AS TongXuat,
    ISNULL(SUM(ct.NhapCai - ct.XuatCai), 0) AS TongTon
FROM TheKhoHangHoa h
LEFT JOIN TheKhoDanhMuc tk ON tk.TheKhoDanhMucID = h.TheKhoDanhMucID
LEFT JOIN DanhMucNhomSanPham nsp ON nsp.NhomSanPhamID = h.NhomSanPhamID
LEFT JOIN TheKhoChiTietMau ct ON ct.MaHangID = h.MaHangID
LEFT JOIN DonHangSanXuat d ON d.DonHangID = h.DonHangID
GROUP BY h.MaHangID, h.MaHang, h.TenHang, h.GiaBan, h.LoaiRi, h.AnhDaiDien,
         h.TheKhoDanhMucID, tk.TenTheKho, h.LoaiHang, h.DonHangID, h.DonViCoBan, h.DonViQuyDoi, d.MaDH,
         h.GiaAloha, h.MaBarcode, h.NhomSanPhamID, nsp.TenNhom;
GO

PRINT '=== migration_v642.sql: vw_TonKhoHangHoa da co du TheKhoDanhMucID + NhomSanPhamID/TenNhom + GiaAloha/MaBarcode ===';
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [44/81]  migration_v643.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [44/81] migration_v643.sql';
GO

/* ================================================================
   MIGRATION v6.43 — Chỉ định sản xuất: thêm trường Mác + Phụ kiện
   ----------------------------------------------------------------
   - Mac      : nhãn "Mác" nhập tự do (1 dòng).
   - PhuLieu  : "Phụ kiện" nhập tự do, NHIỀU dòng — lưu dạng text nối bằng ký tự xuống dòng (\n).
                (Trùng tên cột mà bản in Form 1 màu đã đọc sẵn: o.PhuLieu.)
   Additive, NULL được, không ảnh hưởng dữ liệu cũ. Idempotent (guard COL_LENGTH). Chạy 1 lần.
   ================================================================ */
USE QLNoiBo;
GO

IF COL_LENGTH('DonHangSanXuat', 'Mac') IS NULL
BEGIN
    ALTER TABLE DonHangSanXuat ADD Mac NVARCHAR(255) NULL;
    PRINT 'Da them cot DonHangSanXuat.Mac.';
END ELSE PRINT 'Cot DonHangSanXuat.Mac da ton tai, bo qua.';
GO

IF COL_LENGTH('DonHangSanXuat', 'PhuLieu') IS NULL
BEGIN
    ALTER TABLE DonHangSanXuat ADD PhuLieu NVARCHAR(MAX) NULL;
    PRINT 'Da them cot DonHangSanXuat.PhuLieu.';
END ELSE PRINT 'Cot DonHangSanXuat.PhuLieu da ton tai, bo qua.';
GO

PRINT '=== migration_v643.sql (Mac + PhuLieu cho DonHangSanXuat) hoan tat ===';
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [45/81]  migration_v644.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [45/81] migration_v644.sql';
GO

-- ================================================================
-- migration_v644.sql  (v5.45)
-- (1) Thêm cột KhoVai vào view vw_TonCayVai để IN LÊN TEM cây vải.
--     KhoVai = ISNULL(VaiCay.KhoVaiThucTe, DanhMucVai.KhoVai) (ưu tiên khổ thực tế của cây).
-- (2) Bảng CauHinh (key-value) lưu cấu hình chung — dùng cho "Máy in tem qua mạng" (khóa 'MAY_IN_TEM').
-- An toàn chạy lại nhiều lần.
-- ================================================================

IF OBJECT_ID('vw_TonCayVai', 'V') IS NOT NULL DROP VIEW vw_TonCayVai;
GO
CREATE VIEW vw_TonCayVai AS
SELECT
    c.CayID, c.MaCay, c.VaiID, v.MaVai, v.MaPM, lv.TenLoaiVai, lv.MaLoai, ms.TenMau,
    c.KGNhap, ISNULL(x.KGXuatTong, 0) AS KGDaXuat,
    c.KGNhap - ISNULL(x.KGXuatTong, 0) AS KGCon,
    c.TrangThai, c.NgayNhap, c.ViTriKho, c.QRCode,
    ISNULL(c.KhoVaiThucTe, v.KhoVai) AS KhoVai
FROM VaiCay c
JOIN DanhMucVai v ON v.VaiID = c.VaiID
LEFT JOIN LoaiVai lv ON lv.LoaiVaiID = v.LoaiVaiID
LEFT JOIN MauSac ms ON ms.MauSacID = v.MauSacID
LEFT JOIN (
    SELECT CayID, SUM(KGXuat) AS KGXuatTong FROM PhieuXuatVaiChiTiet GROUP BY CayID
) x ON x.CayID = c.CayID;
GO

IF OBJECT_ID('CauHinh', 'U') IS NULL
CREATE TABLE CauHinh (
    Khoa       NVARCHAR(80)  NOT NULL PRIMARY KEY,
    GiaTri     NVARCHAR(MAX) NULL,
    UpdatedAt  DATETIME2     NULL
);
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [46/81]  migration_v645.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [46/81] migration_v645.sql';
GO

/* ================================================================
   migration_v645.sql (v5.47.1)
   Bảng "Chỉ định vải SX" RIÊNG — ĐỘC LẬP với cấu trúc vải của Ra lệnh SX.
   Người dùng CHỌN Loại vải + Màu TỪ DANH MỤC (có ID) + rõ Chính/Phối + KG yêu cầu.
   Dùng làm nguồn KHÓA xuất kho vải (khovai.js GET /orders + /vaichophep khớp LoaiVaiID/MauSacID).
   An toàn chạy lại nhiều lần.
   ================================================================ */
USE QLNoiBo;
GO
IF OBJECT_ID('ChiDinhVaiSX', 'U') IS NULL
BEGIN
    CREATE TABLE ChiDinhVaiSX (
        Id            INT IDENTITY(1,1) PRIMARY KEY,
        DonHangID     INT NOT NULL FOREIGN KEY REFERENCES DonHangSanXuat(DonHangID),
        Kieu          NVARCHAR(10) NOT NULL DEFAULT N'Chính',   -- Chính / Phối
        LoaiVaiID     INT NULL FOREIGN KEY REFERENCES LoaiVai(LoaiVaiID),
        MauSacID      INT NULL FOREIGN KEY REFERENCES MauSac(MauSacID),
        SoKGYeuCau    DECIMAL(10,2) NULL,
        DVTVaiYeuCau  NVARCHAR(30) NULL DEFAULT N'Kg'
    );
    CREATE INDEX IX_ChiDinhVaiSX_DonHang ON ChiDinhVaiSX(DonHangID);
    PRINT N'Da tao bang ChiDinhVaiSX.';
END ELSE PRINT N'Bang ChiDinhVaiSX da ton tai, bo qua.';
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [47/81]  migration_v646.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [47/81] migration_v646.sql';
GO

-- ================================================================
-- migration_v646.sql  (v5.50)
-- (1) ChucNang QLSX 'chidinhnpl' — tách "Chỉ định NPL" ra tab riêng
--     trong Quản lý sản xuất (trước đây là 1 mục con của "Tài liệu may/Đóng gói").
-- (2) Thêm cột SoMet (số mét) cho:
--       - VaiCay               (phiếu NHẬP kho vải — số mét mỗi cây)
--       - PhieuXuatVaiChiTiet  (phiếu XUẤT kho vải — số mét mỗi dòng)
--       - ChiDinhVaiSX         (Chỉ định vải SX — số mét yêu cầu)
-- (3) Dựng lại view vw_TonCayVai để trả thêm SoMet (tồn theo cây + bản in tem).
-- An toàn chạy lại nhiều lần.
-- ================================================================

/* ---------- (1) ChucNang: Chỉ định NPL (tab riêng của QLSX) ---------- */
MERGE ChucNang AS t
USING (VALUES ('QLSX', 'chidinhnpl', N'Chỉ định NPL', 8)) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu)
ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
WHEN NOT MATCHED THEN
    INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu) VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu);
GO

/* ---------- (2) Cột SoMet ---------- */
IF COL_LENGTH('VaiCay', 'SoMet') IS NULL
    ALTER TABLE VaiCay ADD SoMet DECIMAL(10, 2) NULL;
GO
IF COL_LENGTH('PhieuXuatVaiChiTiet', 'SoMet') IS NULL
    ALTER TABLE PhieuXuatVaiChiTiet ADD SoMet DECIMAL(10, 2) NULL;
GO
IF COL_LENGTH('ChiDinhVaiSX', 'SoMet') IS NULL
    ALTER TABLE ChiDinhVaiSX ADD SoMet DECIMAL(10, 2) NULL;
GO

/* ---------- (3) view vw_TonCayVai + SoMet (giữ nguyên KhoVai của v644) ---------- */
IF OBJECT_ID('vw_TonCayVai', 'V') IS NOT NULL DROP VIEW vw_TonCayVai;
GO
CREATE VIEW vw_TonCayVai AS
SELECT
    c.CayID, c.MaCay, c.VaiID, v.MaVai, v.MaPM, lv.TenLoaiVai, lv.MaLoai, ms.TenMau,
    c.KGNhap, c.SoMet, ISNULL(x.KGXuatTong, 0) AS KGDaXuat,
    c.KGNhap - ISNULL(x.KGXuatTong, 0) AS KGCon,
    c.TrangThai, c.NgayNhap, c.ViTriKho, c.QRCode,
    ISNULL(c.KhoVaiThucTe, v.KhoVai) AS KhoVai
FROM VaiCay c
JOIN DanhMucVai v ON v.VaiID = c.VaiID
LEFT JOIN LoaiVai lv ON lv.LoaiVaiID = v.LoaiVaiID
LEFT JOIN MauSac ms ON ms.MauSacID = v.MauSacID
LEFT JOIN (
    SELECT CayID, SUM(KGXuat) AS KGXuatTong FROM PhieuXuatVaiChiTiet GROUP BY CayID
) x ON x.CayID = c.CayID;
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [48/81]  migration_v647.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [48/81] migration_v647.sql';
GO

-- ================================================================
-- migration_v647.sql  (v5.52)
-- Thêm cột Ghi chú cho TỪNG MÀU trong Thẻ kho (chi tiết theo màu).
-- An toàn chạy lại nhiều lần.
-- ================================================================
IF COL_LENGTH('TheKhoChiTietMau', 'GhiChu') IS NULL
    ALTER TABLE TheKhoChiTietMau ADD GhiChu NVARCHAR(255) NULL;
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [49/81]  migration_v648.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [49/81] migration_v648.sql';
GO

-- ================================================================
-- migration_v648.sql  (v5.53)
-- Dựng lại view vw_TonCayVai: thêm MetDaXuat (tổng SoMet đã xuất) + MetCon (SoMet nhập - MetDaXuat).
-- Giữ nguyên KhoVai + SoMet + các cột KG* của v646/v647.
-- An toàn chạy lại nhiều lần.
-- ================================================================
IF OBJECT_ID('vw_TonCayVai', 'V') IS NOT NULL DROP VIEW vw_TonCayVai;
GO
CREATE VIEW vw_TonCayVai AS
SELECT
    c.CayID, c.MaCay, c.VaiID, v.MaVai, v.MaPM, lv.TenLoaiVai, lv.MaLoai, ms.TenMau,
    c.KGNhap, c.SoMet, ISNULL(x.KGXuatTong, 0) AS KGDaXuat,
    c.KGNhap - ISNULL(x.KGXuatTong, 0) AS KGCon,
    ISNULL(x.MetXuatTong, 0) AS MetDaXuat,
    ISNULL(c.SoMet, 0) - ISNULL(x.MetXuatTong, 0) AS MetCon,
    c.TrangThai, c.NgayNhap, c.ViTriKho, c.QRCode,
    ISNULL(c.KhoVaiThucTe, v.KhoVai) AS KhoVai
FROM VaiCay c
JOIN DanhMucVai v ON v.VaiID = c.VaiID
LEFT JOIN LoaiVai lv ON lv.LoaiVaiID = v.LoaiVaiID
LEFT JOIN MauSac ms ON ms.MauSacID = v.MauSacID
LEFT JOIN (
    SELECT CayID, SUM(KGXuat) AS KGXuatTong, SUM(SoMet) AS MetXuatTong
    FROM PhieuXuatVaiChiTiet GROUP BY CayID
) x ON x.CayID = c.CayID;
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [50/81]  migration_v649.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [50/81] migration_v649.sql';
GO

-- ================================================================
-- migration_v649.sql  (v5.54)
-- "Nhiều bản có TÊN cho 1 đơn" — thêm cột TenPhieu để nhóm dòng theo từng bản chỉ định.
--   - ChiDinhVaiSX        (Chỉ định vải SX)  -> nhóm dòng theo (DonHangID, TenPhieu)
--   - DonHangChiTietPhuKien (Chỉ định NPL)   -> nhóm dòng theo (DonHangID, TenPhieu)
-- Dữ liệu cũ TenPhieu = NULL -> coi là 1 bản mặc định (tên rỗng).
-- An toàn chạy lại nhiều lần.
-- ================================================================
IF COL_LENGTH('ChiDinhVaiSX', 'TenPhieu') IS NULL
    ALTER TABLE ChiDinhVaiSX ADD TenPhieu NVARCHAR(200) NULL;
GO
IF COL_LENGTH('DonHangChiTietPhuKien', 'TenPhieu') IS NULL
    ALTER TABLE DonHangChiTietPhuKien ADD TenPhieu NVARCHAR(200) NULL;
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [51/81]  migration_v650.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [51/81] migration_v650.sql';
GO

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


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [52/81]  migration_v651.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [52/81] migration_v651.sql';
GO

-- ================================================================
-- migration_v651.sql  (v5.56)
-- "Nhiều bản có TÊN cho 1 đơn" — WAVE CUỐI: 4 bảng ĐƠN GIÁ.
--   Thêm cột TenPhieu + BỎ 2 ràng buộc UNIQUE "1 dòng/đơn" đang chặn nhiều bản.
-- (3 bảng tài liệu header + BangKeBanThanhPham đã xử lý ở migration_v650.)
--
-- >>> QUAN TRỌNG: PHẢI CHỌN ĐÚNG DATABASE QLNoiBo TRƯỚC KHI CHẠY <<<
--     Trong SSMS, cửa sổ New Query MẶC ĐỊNH nối vào [master] → chạy sẽ báo
--     "Msg 4902 ... Cannot find the object ... does not exist or you do not have permissions".
--     Cách xử lý: chọn database ở ô dropdown trên thanh công cụ, HOẶC bỏ chú thích dòng USE bên dưới.
--
--     USE [QLNoiBo];   -- <- sửa đúng tên database rồi bỏ 2 dấu gạch đầu dòng
--     GO
--
-- Bản này TỰ KIỂM TRA: sai database hoặc thiếu bảng → in thông báo rõ ràng, KHÔNG đổ lỗi khó hiểu.
-- An toàn chạy lại nhiều lần.
-- ================================================================

PRINT N'--- migration_v651: bat dau. Database hien tai: ' + DB_NAME() + N' ---';
GO

-- 0) Chan sai database: bang goc DonHangSanXuat phai ton tai.
IF OBJECT_ID(N'DonHangSanXuat', N'U') IS NULL
BEGIN
    PRINT N'*** DUNG LAI: KHONG THAY bang DonHangSanXuat trong database [' + DB_NAME() + N'].';
    PRINT N'*** => Ban dang chay SAI DATABASE (thuong la [master]). Hay chon dung database QLNoiBo';
    PRINT N'***    (o dropdown SSMS) hoac them "USE [ten_database]; GO" o dau file, roi chay lai.';
    SET NOEXEC ON;   -- bo qua toan bo phan con lai cua script
END
GO

-- 1) Them cot TenPhieu cho 4 bang don gia (co kiem tra bang ton tai truoc khi ALTER).
IF OBJECT_ID(N'DonHangDonGiaCongDoanMay', N'U') IS NULL
    PRINT N'BO QUA: chua co bang DonHangDonGiaCongDoanMay (can migration_v534b).';
ELSE IF COL_LENGTH(N'DonHangDonGiaCongDoanMay', N'TenPhieu') IS NULL
BEGIN
    ALTER TABLE DonHangDonGiaCongDoanMay ADD TenPhieu NVARCHAR(200) NULL;
    PRINT N'OK: da them TenPhieu vao DonHangDonGiaCongDoanMay.';
END
ELSE PRINT N'DA CO SAN: TenPhieu trong DonHangDonGiaCongDoanMay.';
GO

IF OBJECT_ID(N'DonHangHangMucGiaCong', N'U') IS NULL
    PRINT N'BO QUA: chua co bang DonHangHangMucGiaCong (can migration_v524).';
ELSE IF COL_LENGTH(N'DonHangHangMucGiaCong', N'TenPhieu') IS NULL
BEGIN
    ALTER TABLE DonHangHangMucGiaCong ADD TenPhieu NVARCHAR(200) NULL;
    PRINT N'OK: da them TenPhieu vao DonHangHangMucGiaCong.';
END
ELSE PRINT N'DA CO SAN: TenPhieu trong DonHangHangMucGiaCong.';
GO

IF OBJECT_ID(N'DonHangDonGiaLaDongGoi', N'U') IS NULL
    PRINT N'BO QUA: chua co bang DonHangDonGiaLaDongGoi (can migration_v640).';
ELSE IF COL_LENGTH(N'DonHangDonGiaLaDongGoi', N'TenPhieu') IS NULL
BEGIN
    ALTER TABLE DonHangDonGiaLaDongGoi ADD TenPhieu NVARCHAR(200) NULL;
    PRINT N'OK: da them TenPhieu vao DonHangDonGiaLaDongGoi.';
END
ELSE PRINT N'DA CO SAN: TenPhieu trong DonHangDonGiaLaDongGoi.';
GO

IF OBJECT_ID(N'DonHangDonGiaInThe', N'U') IS NULL
    PRINT N'BO QUA: chua co bang DonHangDonGiaInThe (can migration_v534c).';
ELSE IF COL_LENGTH(N'DonHangDonGiaInThe', N'TenPhieu') IS NULL
BEGIN
    ALTER TABLE DonHangDonGiaInThe ADD TenPhieu NVARCHAR(200) NULL;
    PRINT N'OK: da them TenPhieu vao DonHangDonGiaInThe.';
END
ELSE PRINT N'DA CO SAN: TenPhieu trong DonHangDonGiaInThe.';
GO

-- 2) BO 2 rang buoc UNIQUE "1 dong/don" (dang chan nhieu ban).
--    Chung la KEY CONSTRAINT (khong phai index thuong) nen phai ALTER TABLE ... DROP CONSTRAINT.
--    Upsert theo ban da quet sach theo (DonHangID, ISNULL(TenPhieu,'')) roi chen lai nen khong can UNIQUE nua.
IF OBJECT_ID(N'DonHangHangMucGiaCong', N'U') IS NOT NULL
   AND EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'UQ_DonHangHangMucGiaCong' AND parent_object_id = OBJECT_ID(N'DonHangHangMucGiaCong'))
BEGIN
    ALTER TABLE DonHangHangMucGiaCong DROP CONSTRAINT UQ_DonHangHangMucGiaCong;
    PRINT N'OK: da bo UQ_DonHangHangMucGiaCong.';
END
GO
-- phong truong hop ban cu tao bang unique INDEX (khac constraint) cung ten
IF OBJECT_ID(N'DonHangHangMucGiaCong', N'U') IS NOT NULL
   AND EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_DonHangHangMucGiaCong' AND object_id = OBJECT_ID(N'DonHangHangMucGiaCong') AND is_unique_constraint = 0)
BEGIN
    DROP INDEX UQ_DonHangHangMucGiaCong ON DonHangHangMucGiaCong;
    PRINT N'OK: da bo INDEX UQ_DonHangHangMucGiaCong.';
END
GO

IF OBJECT_ID(N'DonHangDonGiaLaDongGoi', N'U') IS NOT NULL
   AND EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'UQ_DGLaDongGoi' AND parent_object_id = OBJECT_ID(N'DonHangDonGiaLaDongGoi'))
BEGIN
    ALTER TABLE DonHangDonGiaLaDongGoi DROP CONSTRAINT UQ_DGLaDongGoi;
    PRINT N'OK: da bo UQ_DGLaDongGoi.';
END
GO
IF OBJECT_ID(N'DonHangDonGiaLaDongGoi', N'U') IS NOT NULL
   AND EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_DGLaDongGoi' AND object_id = OBJECT_ID(N'DonHangDonGiaLaDongGoi') AND is_unique_constraint = 0)
BEGIN
    DROP INDEX UQ_DGLaDongGoi ON DonHangDonGiaLaDongGoi;
    PRINT N'OK: da bo INDEX UQ_DGLaDongGoi.';
END
GO

-- 3) BAO CAO KET QUA (gui ket qua nay lai neu con van de).
SELECT t.name AS Bang,
       CASE WHEN COL_LENGTH(t.name, 'TenPhieu') IS NULL THEN N'THIEU TenPhieu' ELSE N'OK co TenPhieu' END AS TrangThai
FROM sys.tables t
WHERE t.name IN ('DonHangDonGiaCongDoanMay', 'DonHangHangMucGiaCong', 'DonHangDonGiaLaDongGoi', 'DonHangDonGiaInThe',
                 'TaiLieuKyThuatChung', 'TaiLieuThongSoDo', 'TaiLieuMoTaSanPham', 'BangKeBanThanhPham')
ORDER BY t.name;

-- Neu bang nao KHONG xuat hien o tren = bang do khong ton tai trong database nay.
-- Chay them cau nay va gui ket qua de doi chieu TEN THUC TE:
SELECT SCHEMA_NAME(schema_id) AS Schema_, name AS TenBang FROM sys.tables
WHERE name LIKE '%DonGia%' OR name LIKE '%GiaCong%' ORDER BY name;
GO

SET NOEXEC OFF;
PRINT N'--- migration_v651: ket thuc ---';
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [53/81]  migration_v652.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [53/81] migration_v652.sql';
GO

-- ================================================================
-- migration_v652.sql  (v5.56c) — TỰ CHỮA các cột còn THIẾU khiến mở form bị lỗi
--
-- Vì sao cần: form "Bảng kê BTP" khi mở có đọc thêm cột size từ Thông số đo bằng câu
--   ... FROM TaiLieuThongSoDoDong d JOIN TaiLieuThongSoDo t ... WHERE ISNULL(t.LaMau,0)=0
-- Nếu database CHƯA có cột LaMau (do chưa chạy migration_v534e) thì câu này lỗi
-- "Invalid column name 'LaMau'" -> route async ném lỗi -> (Express 4 + Node >=15) SẬP TIẾN TRÌNH
-- -> request không có phản hồi -> giao diện "bấm nút không có gì xảy ra" (không hề báo lỗi).
-- Đúng triệu chứng: DANH SÁCH BẢN mở được (không dùng LaMau), MỞ FORM thì chết.
--
-- Script này bổ sung mọi cột còn thiếu cho các bảng tài liệu + BTP. An toàn chạy lại nhiều lần.
-- >>> NHỚ CHỌN ĐÚNG DATABASE QLNoiBo (SSMS mở New Query mặc định vào [master]) <<<
-- ================================================================

PRINT N'--- migration_v652: database hien tai = ' + DB_NAME() + N' ---';
GO

IF OBJECT_ID(N'DonHangSanXuat', N'U') IS NULL
BEGIN
    PRINT N'*** DUNG LAI: khong thay bang DonHangSanXuat => SAI DATABASE (thuong la [master]).';
    PRINT N'*** Hay chon dung database QLNoiBo o dropdown SSMS roi chay lai.';
    SET NOEXEC ON;
END
GO

-- 1) TaiLieuThongSoDo: LaMau / TenMau (migration_v534e) — NGUYÊN NHÂN NGHI VẤN SỐ 1 của lỗi BTP.
IF OBJECT_ID(N'TaiLieuThongSoDo', N'U') IS NULL
    PRINT N'BO QUA: chua co bang TaiLieuThongSoDo.';
ELSE
BEGIN
    IF COL_LENGTH(N'TaiLieuThongSoDo', N'LaMau') IS NULL
    BEGIN
        ALTER TABLE TaiLieuThongSoDo ADD LaMau BIT NOT NULL CONSTRAINT DF_TLTSD_LaMau DEFAULT 0;
        PRINT N'*** DA VA: them cot LaMau vao TaiLieuThongSoDo (day rat co the la nguyen nhan loi Bang ke BTP).';
    END
    ELSE PRINT N'OK: TaiLieuThongSoDo.LaMau da co.';

    IF COL_LENGTH(N'TaiLieuThongSoDo', N'TenMau') IS NULL
    BEGIN
        ALTER TABLE TaiLieuThongSoDo ADD TenMau NVARCHAR(255) NULL;
        PRINT N'OK: them cot TenMau vao TaiLieuThongSoDo.';
    END
    ELSE PRINT N'OK: TaiLieuThongSoDo.TenMau da co.';
END
GO

-- Cho phep DonHangID NULL (ban ghi MAU khong gan don hang) — migration_v534e.
IF OBJECT_ID(N'TaiLieuThongSoDo', N'U') IS NOT NULL
   AND EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'TaiLieuThongSoDo') AND name = 'DonHangID' AND is_nullable = 0)
BEGIN
    BEGIN TRY
        ALTER TABLE TaiLieuThongSoDo ALTER COLUMN DonHangID INT NULL;
        PRINT N'OK: TaiLieuThongSoDo.DonHangID cho phep NULL (de luu tai lieu MAU).';
    END TRY
    BEGIN CATCH
        PRINT N'CANH BAO: khong doi duoc DonHangID sang NULL (co the dang bi rang buoc): ' + ERROR_MESSAGE();
    END CATCH
END
GO

-- 2) TaiLieuMoTaSanPham: LaMau / TenMau / Loai (migration_v534c, v534e).
IF OBJECT_ID(N'TaiLieuMoTaSanPham', N'U') IS NULL
    PRINT N'BO QUA: chua co bang TaiLieuMoTaSanPham.';
ELSE
BEGIN
    IF COL_LENGTH(N'TaiLieuMoTaSanPham', N'Loai') IS NULL
    BEGIN
        ALTER TABLE TaiLieuMoTaSanPham ADD Loai NVARCHAR(30) NOT NULL CONSTRAINT DF_TLMoTa_Loai DEFAULT N'motasp';
        PRINT N'OK: them cot Loai vao TaiLieuMoTaSanPham.';
    END
    IF COL_LENGTH(N'TaiLieuMoTaSanPham', N'LaMau') IS NULL
    BEGIN
        ALTER TABLE TaiLieuMoTaSanPham ADD LaMau BIT NOT NULL CONSTRAINT DF_TLMoTa_LaMau DEFAULT 0;
        PRINT N'OK: them cot LaMau vao TaiLieuMoTaSanPham.';
    END
    IF COL_LENGTH(N'TaiLieuMoTaSanPham', N'TenMau') IS NULL
    BEGIN
        ALTER TABLE TaiLieuMoTaSanPham ADD TenMau NVARCHAR(255) NULL;
        PRINT N'OK: them cot TenMau vao TaiLieuMoTaSanPham.';
    END
    IF COL_LENGTH(N'TaiLieuMoTaSanPham', N'ChuY') IS NULL
    BEGIN
        ALTER TABLE TaiLieuMoTaSanPham ADD ChuY NVARCHAR(MAX) NULL;
        PRINT N'OK: them cot ChuY vao TaiLieuMoTaSanPham.';
    END
END
GO

-- 3) TaiLieuKyThuatChung: LaMau / TenMau.
IF OBJECT_ID(N'TaiLieuKyThuatChung', N'U') IS NOT NULL
BEGIN
    IF COL_LENGTH(N'TaiLieuKyThuatChung', N'LaMau') IS NULL
    BEGIN
        ALTER TABLE TaiLieuKyThuatChung ADD LaMau BIT NOT NULL CONSTRAINT DF_TLKTC_LaMau DEFAULT 0;
        PRINT N'OK: them cot LaMau vao TaiLieuKyThuatChung.';
    END
    IF COL_LENGTH(N'TaiLieuKyThuatChung', N'TenMau') IS NULL
    BEGIN
        ALTER TABLE TaiLieuKyThuatChung ADD TenMau NVARCHAR(255) NULL;
        PRINT N'OK: them cot TenMau vao TaiLieuKyThuatChung.';
    END
END
GO

-- 4) BangKeBanThanhPham: LaMau / TenMau / GhiChu / TenPhieu (v534, v650).
IF OBJECT_ID(N'BangKeBanThanhPham', N'U') IS NOT NULL
BEGIN
    IF COL_LENGTH(N'BangKeBanThanhPham', N'LaMau') IS NULL
    BEGIN
        ALTER TABLE BangKeBanThanhPham ADD LaMau BIT NOT NULL CONSTRAINT DF_BKBTP_LaMau DEFAULT 0;
        PRINT N'OK: them cot LaMau vao BangKeBanThanhPham.';
    END
    IF COL_LENGTH(N'BangKeBanThanhPham', N'TenMau') IS NULL
    BEGIN
        ALTER TABLE BangKeBanThanhPham ADD TenMau NVARCHAR(255) NULL;
        PRINT N'OK: them cot TenMau vao BangKeBanThanhPham.';
    END
    IF COL_LENGTH(N'BangKeBanThanhPham', N'TenPhieu') IS NULL
    BEGIN
        ALTER TABLE BangKeBanThanhPham ADD TenPhieu NVARCHAR(200) NULL;
        PRINT N'OK: them cot TenPhieu vao BangKeBanThanhPham.';
    END
END
GO

-- 5) BAO CAO: gui ket qua bang nay lai neu con loi.
SELECT t.name AS Bang,
       CASE WHEN COL_LENGTH(t.name, 'LaMau')    IS NULL THEN N'THIEU' ELSE N'OK' END AS LaMau,
       CASE WHEN COL_LENGTH(t.name, 'TenMau')   IS NULL THEN N'THIEU' ELSE N'OK' END AS TenMau,
       CASE WHEN COL_LENGTH(t.name, 'TenPhieu') IS NULL THEN N'THIEU' ELSE N'OK' END AS TenPhieu
FROM sys.tables t
WHERE t.name IN ('TaiLieuKyThuatChung', 'TaiLieuThongSoDo', 'TaiLieuMoTaSanPham', 'BangKeBanThanhPham')
ORDER BY t.name;
GO

SET NOEXEC OFF;
PRINT N'--- migration_v652: ket thuc. Sau do: pm2 restart qlnoibo + Ctrl+F5 ---';
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [54/81]  migration_v653.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [54/81] migration_v653.sql';
GO

-- ================================================================
-- migration_v653.sql  (v5.58) — BIỂU MẪU THÔNG SỐ ĐO MỚI (theo file thongsodo.xls)
--
-- Mẫu mới:  DÒNG = THÔNG SỐ (Dài áo, Rộng ngang ngực, Chéo nách...) + VỊ TRÍ ĐO + dung sai (+/-)
--           CỘT  = SIZE (80, 90, 100, 110, 120, 130, 140...)
--           Bên phải là khối "Ghi chú / YÊU CẦU KỸ THUẬT" dùng chung + ảnh sản phẩm.
-- (Trước đây: DÒNG = size, CỘT = vị trí đo — tức HOÁN VỊ so với mẫu mới.)
--
-- Thêm:
--   TaiLieuThongSoDoDong : ViTriDo (cách đo) + DungSai (+/-)
--   TaiLieuThongSoDo     : YeuCauKyThuat (khối Ghi chú) + AnhGhiChu (JSON danh sách ảnh)
-- An toàn chạy lại nhiều lần. >>> NHỚ CHỌN ĐÚNG DATABASE QLNoiBo <<<
-- ================================================================

PRINT N'--- migration_v653: database hien tai = ' + DB_NAME() + N' ---';
GO

IF OBJECT_ID(N'DonHangSanXuat', N'U') IS NULL
BEGIN
    PRINT N'*** DUNG LAI: khong thay bang DonHangSanXuat => SAI DATABASE (thuong la [master]).';
    SET NOEXEC ON;
END
GO

-- 1) Dòng thông số: thêm VỊ TRÍ ĐO + DUNG SAI
IF OBJECT_ID(N'TaiLieuThongSoDoDong', N'U') IS NULL
    PRINT N'BO QUA: chua co bang TaiLieuThongSoDoDong.';
ELSE
BEGIN
    IF COL_LENGTH(N'TaiLieuThongSoDoDong', N'ViTriDo') IS NULL
    BEGIN
        ALTER TABLE TaiLieuThongSoDoDong ADD ViTriDo NVARCHAR(400) NULL;
        PRINT N'OK: them cot ViTriDo vao TaiLieuThongSoDoDong.';
    END
    ELSE PRINT N'DA CO: TaiLieuThongSoDoDong.ViTriDo.';

    IF COL_LENGTH(N'TaiLieuThongSoDoDong', N'DungSai') IS NULL
    BEGIN
        ALTER TABLE TaiLieuThongSoDoDong ADD DungSai NVARCHAR(50) NULL;
        PRINT N'OK: them cot DungSai vao TaiLieuThongSoDoDong.';
    END
    ELSE PRINT N'DA CO: TaiLieuThongSoDoDong.DungSai.';
END
GO

-- 2) Header: khối Ghi chú "YÊU CẦU KỸ THUẬT" + ảnh minh hoạ (JSON mảng URL)
IF OBJECT_ID(N'TaiLieuThongSoDo', N'U') IS NULL
    PRINT N'BO QUA: chua co bang TaiLieuThongSoDo.';
ELSE
BEGIN
    IF COL_LENGTH(N'TaiLieuThongSoDo', N'YeuCauKyThuat') IS NULL
    BEGIN
        ALTER TABLE TaiLieuThongSoDo ADD YeuCauKyThuat NVARCHAR(MAX) NULL;
        PRINT N'OK: them cot YeuCauKyThuat vao TaiLieuThongSoDo.';
    END
    ELSE PRINT N'DA CO: TaiLieuThongSoDo.YeuCauKyThuat.';

    IF COL_LENGTH(N'TaiLieuThongSoDo', N'AnhGhiChu') IS NULL
    BEGIN
        ALTER TABLE TaiLieuThongSoDo ADD AnhGhiChu NVARCHAR(MAX) NULL;
        PRINT N'OK: them cot AnhGhiChu vao TaiLieuThongSoDo (JSON danh sach anh).';
    END
    ELSE PRINT N'DA CO: TaiLieuThongSoDo.AnhGhiChu.';

    -- Cột LaMau/TenMau (migration_v534e) — bổ sung luôn nếu thiếu (xem migration_v652).
    IF COL_LENGTH(N'TaiLieuThongSoDo', N'LaMau') IS NULL
    BEGIN
        ALTER TABLE TaiLieuThongSoDo ADD LaMau BIT NOT NULL CONSTRAINT DF_TLTSD_LaMau_653 DEFAULT 0;
        PRINT N'OK: them cot LaMau vao TaiLieuThongSoDo.';
    END
    IF COL_LENGTH(N'TaiLieuThongSoDo', N'TenMau') IS NULL
    BEGIN
        ALTER TABLE TaiLieuThongSoDo ADD TenMau NVARCHAR(255) NULL;
        PRINT N'OK: them cot TenMau vao TaiLieuThongSoDo.';
    END
END
GO

-- 3) BAO CAO
SELECT 'TaiLieuThongSoDoDong' AS Bang,
       CASE WHEN COL_LENGTH('TaiLieuThongSoDoDong','ViTriDo') IS NULL THEN N'THIEU' ELSE N'OK' END AS ViTriDo,
       CASE WHEN COL_LENGTH('TaiLieuThongSoDoDong','DungSai') IS NULL THEN N'THIEU' ELSE N'OK' END AS DungSai
UNION ALL
SELECT 'TaiLieuThongSoDo',
       CASE WHEN COL_LENGTH('TaiLieuThongSoDo','YeuCauKyThuat') IS NULL THEN N'THIEU' ELSE N'OK' END,
       CASE WHEN COL_LENGTH('TaiLieuThongSoDo','AnhGhiChu') IS NULL THEN N'THIEU' ELSE N'OK' END;
GO

SET NOEXEC OFF;
PRINT N'--- migration_v653: ket thuc. Sau do: pm2 restart qlnoibo + Ctrl+F5 ---';
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [55/81]  migration_v654.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [55/81] migration_v654.sql';
GO

-- ================================================================
-- migration_v654.sql  (v5.59) — KẾT NỐI MÁY CHẤM CÔNG HIKVISION (DS-K1T342MFWX)
--
-- Máy Hikvision KHÔNG dùng giao thức ZKTeco (cổng 4370) mà dùng ISAPI qua HTTP,
-- xác thực Digest bằng TÀI KHOẢN/MẬT KHẨU của máy (mặc định user 'admin').
-- => Bảng MayChamCong cần thêm: TenDangNhap, MatKhau, DungHTTPS.
--
-- An toàn chạy lại nhiều lần. >>> NHỚ CHỌN ĐÚNG DATABASE QLNoiBo <<<
-- ================================================================

PRINT N'--- migration_v654: database hien tai = ' + DB_NAME() + N' ---';
GO

IF OBJECT_ID(N'DonHangSanXuat', N'U') IS NULL
BEGIN
    PRINT N'*** DUNG LAI: khong thay bang DonHangSanXuat => SAI DATABASE (thuong la [master]).';
    SET NOEXEC ON;
END
GO

IF OBJECT_ID(N'MayChamCong', N'U') IS NULL
    PRINT N'BO QUA: chua co bang MayChamCong (can migration_v610).';
ELSE
BEGIN
    IF COL_LENGTH(N'MayChamCong', N'TenDangNhap') IS NULL
    BEGIN
        ALTER TABLE MayChamCong ADD TenDangNhap NVARCHAR(100) NULL;
        PRINT N'OK: them cot TenDangNhap vao MayChamCong.';
    END
    ELSE PRINT N'DA CO: MayChamCong.TenDangNhap.';

    IF COL_LENGTH(N'MayChamCong', N'MatKhau') IS NULL
    BEGIN
        ALTER TABLE MayChamCong ADD MatKhau NVARCHAR(200) NULL;
        PRINT N'OK: them cot MatKhau vao MayChamCong.';
    END
    ELSE PRINT N'DA CO: MayChamCong.MatKhau.';

    IF COL_LENGTH(N'MayChamCong', N'DungHTTPS') IS NULL
    BEGIN
        ALTER TABLE MayChamCong ADD DungHTTPS BIT NOT NULL CONSTRAINT DF_MayChamCong_HTTPS DEFAULT 0;
        PRINT N'OK: them cot DungHTTPS vao MayChamCong (mac dinh 0 = dung HTTP).';
    END
    ELSE PRINT N'DA CO: MayChamCong.DungHTTPS.';
END
GO

-- Báo cáo
SELECT MayChamCongID, TenMay, DiaChiIP, Port, LoaiGiaoThuc,
       CASE WHEN TenDangNhap IS NULL OR TenDangNhap = N'' THEN N'(chua dat)' ELSE TenDangNhap END AS TenDangNhap,
       CASE WHEN MatKhau IS NULL OR MatKhau = N'' THEN N'(chua dat)' ELSE N'***' END AS MatKhau,
       DungHTTPS
FROM MayChamCong ORDER BY MayChamCongID;
GO

SET NOEXEC OFF;
PRINT N'--- migration_v654: ket thuc. Sau do: pm2 restart qlnoibo + Ctrl+F5 ---';
PRINT N'Luu y: may Hikvision -> chon Giao thuc = Hikvision, Port = 80, nhap tai khoan/mat khau cua may.';
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [56/81]  migration_v655.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [56/81] migration_v655.sql';
GO

-- ================================================================
-- migration_v655.sql  (v5.60) — CÀI ĐẶT CHẤM CÔNG (giờ vào/ra, 1 công, tăng ca)
--   + lưu SỐ GIỜ LÀM THỰC của từng ngày để đối chiếu khi công < 1.
--
-- Cấu hình lưu ở bảng key-value CauHinh (khoá 'CHAM_CONG', giá trị JSON) — cùng cách với
-- cấu hình máy in tem (khoá 'MAY_IN_TEM', xem migration_v644).
-- An toàn chạy lại nhiều lần. >>> NHỚ CHỌN ĐÚNG DATABASE QLNoiBo <<<
-- ================================================================

PRINT N'--- migration_v655: database hien tai = ' + DB_NAME() + N' ---';
GO

IF OBJECT_ID(N'DonHangSanXuat', N'U') IS NULL
BEGIN
    PRINT N'*** DUNG LAI: khong thay bang DonHangSanXuat => SAI DATABASE (thuong la [master]).';
    SET NOEXEC ON;
END
GO

-- 1) Bang cau hinh key-value (co the chua ton tai neu chua chay migration_v644)
IF OBJECT_ID(N'CauHinh', N'U') IS NULL
BEGIN
    CREATE TABLE CauHinh (
        Khoa      NVARCHAR(80)  NOT NULL PRIMARY KEY,
        GiaTri    NVARCHAR(MAX) NULL,
        UpdatedAt DATETIME2     NULL
    );
    PRINT N'OK: da tao bang CauHinh.';
END
ELSE PRINT N'DA CO: bang CauHinh.';
GO

-- 2) ChamCongNgay: luu so gio lam thuc (de biet vi sao cong = 0.5, 0.75...)
IF OBJECT_ID(N'ChamCongNgay', N'U') IS NULL
    PRINT N'BO QUA: chua co bang ChamCongNgay (can migration_v610).';
ELSE
BEGIN
    IF COL_LENGTH(N'ChamCongNgay', N'SoGioLam') IS NULL
    BEGIN
        ALTER TABLE ChamCongNgay ADD SoGioLam DECIMAL(5,2) NULL;
        PRINT N'OK: them cot SoGioLam vao ChamCongNgay.';
    END
    ELSE PRINT N'DA CO: ChamCongNgay.SoGioLam.';
END
GO

-- 3) Cai dat MAC DINH (chi chen neu chua co - KHONG ghi de cau hinh dang dung)
IF NOT EXISTS (SELECT 1 FROM CauHinh WHERE Khoa = N'CHAM_CONG')
BEGIN
    INSERT INTO CauHinh (Khoa, GiaTri, UpdatedAt) VALUES (N'CHAM_CONG',
      N'{"gioVao":"08:00","gioRa":"17:00","nghiTruaTu":"12:00","nghiTruaDen":"13:00","soGioMotCong":8,"lamTronCong":0,"toiThieuTinhCongPhut":30,"otBatDauSauPhut":30,"otLamTronGio":0.5,"otToiDaGioNgay":6,"tinhOtTruocGioVao":false,"ngayLe":[]}',
      SYSDATETIME());
    PRINT N'OK: da tao cau hinh cham cong MAC DINH (8:00-17:00, nghi trua 12-13, 8 gio = 1 cong).';
END
ELSE PRINT N'DA CO: cau hinh CHAM_CONG (giu nguyen, khong ghi de).';
GO

SELECT Khoa, GiaTri, UpdatedAt FROM CauHinh WHERE Khoa = N'CHAM_CONG';
GO

SET NOEXEC OFF;
PRINT N'--- migration_v655: ket thuc. Sau do: pm2 restart qlnoibo + Ctrl+F5 ---';
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [57/81]  migration_v656.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [57/81] migration_v656.sql';
GO

-- ================================================================
-- migration_v656.sql  (v5.62) — CÔNG KHAI THẺ KHO THEO TỪNG DANH MỤC
--
-- Mục tiêu: mỗi "Danh mục thẻ kho" có 1 ĐƯỜNG LINK RIÊNG để gửi khách xem, và chỉ danh mục
-- được BẬT công khai mới xem được (danh mục chưa bật -> mở link báo không tồn tại).
--
-- Thêm vào TheKhoDanhMuc:
--   CongKhai BIT      : công tắc Bật/Tắt chia sẻ (mặc định 0 = TẮT -> an toàn, không lộ gì sau khi cập nhật)
--   Slug     NVARCHAR : mã đường link không dấu (vd 'hang-he-2026'); dùng trong URL thay cho ID nội bộ
--   TieuDeCongKhai    : tiêu đề hiện trên trang khách xem (để trống = dùng tên danh mục)
--   MoTaCongKhai      : dòng mô tả ngắn dưới tiêu đề (tùy chọn)
--
-- An toàn chạy lại nhiều lần. >>> NHỚ CHỌN ĐÚNG DATABASE QLNoiBo <<<
-- ================================================================

PRINT N'--- migration_v656: database hien tai = ' + DB_NAME() + N' ---';
GO

IF OBJECT_ID(N'DonHangSanXuat', N'U') IS NULL
BEGIN
    PRINT N'*** DUNG LAI: khong thay bang DonHangSanXuat => SAI DATABASE (thuong la [master]).';
    SET NOEXEC ON;
END
GO

IF OBJECT_ID(N'TheKhoDanhMuc', N'U') IS NULL
    PRINT N'BO QUA: chua co bang TheKhoDanhMuc.';
ELSE
BEGIN
    IF COL_LENGTH(N'TheKhoDanhMuc', N'CongKhai') IS NULL
    BEGIN
        ALTER TABLE TheKhoDanhMuc ADD CongKhai BIT NOT NULL CONSTRAINT DF_TKDM_CongKhai DEFAULT 0;
        PRINT N'OK: them cot CongKhai vao TheKhoDanhMuc (mac dinh 0 = TAT).';
    END
    ELSE PRINT N'DA CO: TheKhoDanhMuc.CongKhai.';

    IF COL_LENGTH(N'TheKhoDanhMuc', N'Slug') IS NULL
    BEGIN
        ALTER TABLE TheKhoDanhMuc ADD Slug NVARCHAR(120) NULL;
        PRINT N'OK: them cot Slug vao TheKhoDanhMuc.';
    END
    ELSE PRINT N'DA CO: TheKhoDanhMuc.Slug.';

    IF COL_LENGTH(N'TheKhoDanhMuc', N'TieuDeCongKhai') IS NULL
    BEGIN
        ALTER TABLE TheKhoDanhMuc ADD TieuDeCongKhai NVARCHAR(200) NULL;
        PRINT N'OK: them cot TieuDeCongKhai vao TheKhoDanhMuc.';
    END

    IF COL_LENGTH(N'TheKhoDanhMuc', N'MoTaCongKhai') IS NULL
    BEGIN
        ALTER TABLE TheKhoDanhMuc ADD MoTaCongKhai NVARCHAR(500) NULL;
        PRINT N'OK: them cot MoTaCongKhai vao TheKhoDanhMuc.';
    END
END
GO

-- Sinh Slug cho các danh mục đang có (bỏ dấu, thay khoảng trắng bằng '-', chữ thường).
-- Chỉ điền cho dòng CHƯA có Slug; không ghi đè slug người dùng tự đặt.
IF OBJECT_ID(N'TheKhoDanhMuc', N'U') IS NOT NULL AND COL_LENGTH(N'TheKhoDanhMuc', N'Slug') IS NOT NULL
BEGIN
    UPDATE TheKhoDanhMuc
    SET Slug = LOWER(
        REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
        REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
        REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
            LTRIM(RTRIM(TenTheKho)) COLLATE Vietnamese_CI_AI,
            N' ', N'-'), N'/', N'-'), N'\', N'-'), N'.', N''), N',', N''),
            N'(', N''), N')', N''), N'''', N''), N'"', N''), N'&', N'-'),
            N'+', N'-'), N'#', N''), N'%', N''), N'?', N''), N'=', N''),
            N':', N''), N';', N''), N'!', N''), N'*', N''), N'@', N''),
            N'[', N''), N']', N''), N'{', N''), N'}', N''), N'|', N'-'),
            N'<', N''), N'>', N''), N'~', N''), N'`', N''), N'^', N'')
    )
    WHERE Slug IS NULL OR LTRIM(RTRIM(Slug)) = N'';
    PRINT N'OK: da sinh Slug cho cac danh muc chua co (dung COLLATE Vietnamese_CI_AI de bo dau).';

    -- Gộp dấu '-' liên tiếp (chạy vài lượt cho chắc)
    UPDATE TheKhoDanhMuc SET Slug = REPLACE(Slug, N'--', N'-') WHERE Slug LIKE N'%--%';
    UPDATE TheKhoDanhMuc SET Slug = REPLACE(Slug, N'--', N'-') WHERE Slug LIKE N'%--%';
    UPDATE TheKhoDanhMuc SET Slug = REPLACE(Slug, N'--', N'-') WHERE Slug LIKE N'%--%';

    -- Nếu trùng slug: thêm ID vào sau cho khác nhau.
    UPDATE d SET Slug = d.Slug + N'-' + CAST(d.TheKhoDanhMucID AS NVARCHAR(10))
    FROM TheKhoDanhMuc d
    WHERE EXISTS (SELECT 1 FROM TheKhoDanhMuc x WHERE x.Slug = d.Slug AND x.TheKhoDanhMucID < d.TheKhoDanhMucID);
END
GO

-- Chỉ mục duy nhất trên Slug (bỏ qua NULL) — chặn 2 danh mục cùng đường link.
IF OBJECT_ID(N'TheKhoDanhMuc', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_TheKhoDanhMuc_Slug' AND object_id = OBJECT_ID(N'TheKhoDanhMuc'))
BEGIN
    BEGIN TRY
        CREATE UNIQUE INDEX UX_TheKhoDanhMuc_Slug ON TheKhoDanhMuc(Slug) WHERE Slug IS NOT NULL;
        PRINT N'OK: da tao chi muc duy nhat UX_TheKhoDanhMuc_Slug.';
    END TRY
    BEGIN CATCH
        PRINT N'CANH BAO: khong tao duoc chi muc duy nhat tren Slug (co the con slug trung): ' + ERROR_MESSAGE();
    END CATCH
END
GO

SELECT TheKhoDanhMucID, TenTheKho, CongKhai, Slug, TieuDeCongKhai FROM TheKhoDanhMuc ORDER BY TenTheKho;
GO

SET NOEXEC OFF;
PRINT N'--- migration_v656: ket thuc. Sau do: pm2 restart qlnoibo + Ctrl+F5 ---';
PRINT N'Luu y: TAT CA danh muc mac dinh TAT cong khai. Vao Danh muc the kho -> bat "Cong khai" cho danh muc muon chia se.';
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [58/81]  migration_v657.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [58/81] migration_v657.sql';
GO

-- ================================================================
-- migration_v657.sql  (v5.63) — KHÁCH ĐĂNG NHẬP ĐẶT HÀNG TRÊN WEB CÔNG KHAI
--
-- Luồng đã chốt với người dùng:
--   1. NHÂN VIÊN tạo sẵn tài khoản cho từng khách (khách KHÔNG tự đăng ký) -> bảng TaiKhoanKhach.
--   2. Khách đăng nhập ở trang công khai, chỉ đặt được hàng thuộc danh mục ĐÃ BẬT công khai,
--      KHÔNG thấy số tồn kho.
--   3. Đơn khách đặt vào Danh sách đơn đặt hàng với trạng thái N'Chờ xác nhận' và
--      *** CHƯA TRỪ TỒN KHO ***. Nhân viên bấm Xác nhận thì mới trừ tồn.
--   4. Thông báo cho mọi người có quyền Thẻ kho hàng hóa (+ Admin).
--
-- Vì sao cần cột DaTruTon: bảng DonKhachDatHang hiện TRỪ TỒN NGAY khi tạo đơn, và khi chuyển
-- trạng thái sang N'Đã hủy' thì CỘNG TRẢ tồn. Nếu đơn 'Chờ xác nhận' (chưa trừ) mà bị hủy thì
-- code cũ sẽ cộng trả một lượng CHƯA TỪNG TRỪ => tồn kho bị thừa. DaTruTon là cờ đánh dấu
-- "đơn này đã trừ tồn hay chưa" để cộng/trừ luôn khớp.
--
-- An toàn chạy lại nhiều lần. >>> NHỚ CHỌN ĐÚNG DATABASE QLNoiBo <<<
-- ================================================================

PRINT N'--- migration_v657: database hien tai = ' + DB_NAME() + N' ---';
GO

IF OBJECT_ID(N'DonHangSanXuat', N'U') IS NULL
BEGIN
    PRINT N'*** DUNG LAI: khong thay bang DonHangSanXuat => SAI DATABASE (thuong la [master]).';
    SET NOEXEC ON;
END
GO

-- 1) TÀI KHOẢN KHÁCH (nhân viên tạo, gửi khách đăng nhập)
IF OBJECT_ID(N'TaiKhoanKhach', N'U') IS NULL
BEGIN
    CREATE TABLE TaiKhoanKhach (
        TaiKhoanKhachID INT IDENTITY(1,1) PRIMARY KEY,
        TenDangNhap     NVARCHAR(80)  NOT NULL UNIQUE,
        MatKhauHash     NVARCHAR(200) NOT NULL,
        TenKhach        NVARCHAR(150) NOT NULL,          -- tên hiển thị + ghi vào đơn (DonKhachDatHang.TenKhach)
        SDT             NVARCHAR(30)  NULL,
        Email           NVARCHAR(100) NULL,
        DiaChi          NVARCHAR(255) NULL,
        KhachHangID     INT NULL FOREIGN KEY REFERENCES KhachHang(KhachHangID),   -- gắn với danh mục Khách hàng (tùy chọn)
        TrangThai       NVARCHAR(20)  NOT NULL DEFAULT N'Hoạt động',              -- Hoạt động / Tạm dừng
        GhiChu          NVARCHAR(255) NULL,
        LanDangNhapCuoi DATETIME2     NULL,
        CreatedAt       DATETIME2     NOT NULL DEFAULT SYSDATETIME()
    );
    PRINT N'OK: da tao bang TaiKhoanKhach.';
END
ELSE PRINT N'DA CO: bang TaiKhoanKhach.';
GO

-- 2) DonKhachDatHang: nguồn đơn + tài khoản khách + ghi chú của khách + cờ đã trừ tồn
IF OBJECT_ID(N'DonKhachDatHang', N'U') IS NULL
    PRINT N'BO QUA: chua co bang DonKhachDatHang.';
ELSE
BEGIN
    IF COL_LENGTH(N'DonKhachDatHang', N'TaiKhoanKhachID') IS NULL
    BEGIN
        ALTER TABLE DonKhachDatHang ADD TaiKhoanKhachID INT NULL;
        PRINT N'OK: them cot TaiKhoanKhachID vao DonKhachDatHang.';
    END
    IF COL_LENGTH(N'DonKhachDatHang', N'NguonDat') IS NULL
    BEGIN
        ALTER TABLE DonKhachDatHang ADD NguonDat NVARCHAR(20) NOT NULL CONSTRAINT DF_DKDH_NguonDat DEFAULT N'NoiBo';
        PRINT N'OK: them cot NguonDat vao DonKhachDatHang (NoiBo = nhan vien nhap, Web = khach tu dat).';
    END
    IF COL_LENGTH(N'DonKhachDatHang', N'GhiChuKhach') IS NULL
    BEGIN
        ALTER TABLE DonKhachDatHang ADD GhiChuKhach NVARCHAR(500) NULL;
        PRINT N'OK: them cot GhiChuKhach vao DonKhachDatHang.';
    END
    IF COL_LENGTH(N'DonKhachDatHang', N'DaTruTon') IS NULL
    BEGIN
        ALTER TABLE DonKhachDatHang ADD DaTruTon BIT NOT NULL CONSTRAINT DF_DKDH_DaTruTon DEFAULT 1;
        PRINT N'*** OK: them cot DaTruTon (mac dinh 1). Xem giai thich o dau file.';
    END
    IF COL_LENGTH(N'DonKhachDatHang', N'NguoiXacNhanID') IS NULL
    BEGIN
        ALTER TABLE DonKhachDatHang ADD NguoiXacNhanID INT NULL;
        PRINT N'OK: them cot NguoiXacNhanID vao DonKhachDatHang.';
    END
    IF COL_LENGTH(N'DonKhachDatHang', N'ThoiGianXacNhan') IS NULL
    BEGIN
        ALTER TABLE DonKhachDatHang ADD ThoiGianXacNhan DATETIME2 NULL;
        PRINT N'OK: them cot ThoiGianXacNhan vao DonKhachDatHang.';
    END
END
GO

-- Dữ liệu CŨ: mọi đơn đã tạo trước bản này đều ĐÃ trừ tồn lúc tạo, TRỪ đơn đã hủy (đã được cộng trả).
IF OBJECT_ID(N'DonKhachDatHang', N'U') IS NOT NULL AND COL_LENGTH(N'DonKhachDatHang', N'DaTruTon') IS NOT NULL
BEGIN
    UPDATE DonKhachDatHang SET DaTruTon = 0 WHERE TrangThai = N'Đã hủy';
    PRINT N'OK: da danh dau DaTruTon=0 cho cac don DA HUY (ton da duoc cong tra tu truoc).';
END
GO

-- 3) Quyền: thêm chức năng "Tài khoản khách" trong phân hệ Thẻ kho hàng hóa (KHOHANG)
IF OBJECT_ID(N'ChucNang', N'U') IS NOT NULL
BEGIN
    MERGE ChucNang AS t
    USING (VALUES ('KHOHANG', 'taikhoankhach', N'Tài khoản khách (đặt hàng web)', 90)) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu)
    ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
    WHEN NOT MATCHED THEN
        INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu) VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu);
    PRINT N'OK: da them ChucNang KHOHANG/taikhoankhach vao ma tran phan quyen.';
END
GO

SELECT 'TaiKhoanKhach' AS Bang, COUNT(*) AS SoDong FROM TaiKhoanKhach
UNION ALL
SELECT 'DonKhachDatHang (Cho xac nhan)', COUNT(*) FROM DonKhachDatHang WHERE TrangThai = N'Chờ xác nhận';
GO

SET NOEXEC OFF;
PRINT N'--- migration_v657: ket thuc. Sau do: pm2 restart qlnoibo + Ctrl+F5 ---';
PRINT N'Buoc tiep: Tho kho hang hoa -> tab "Tai khoan khach" -> tao tai khoan cho khach, roi gui link danh muc + tai khoan.';
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [59/81]  migration_v658.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [59/81] migration_v658.sql';
GO

/* ================================================================
   migration_v658.sql  (QLNoiBo v5.65)

   MỤC ĐÍCH: Thẻ kho hàng hóa sắp xếp theo YÊU CẦU MỚI
     - Mã hàng HẾT HÀNG (tồn <= 0) tụt xuống DƯỚI CÙNG.
     - Mã hàng vừa tạo / vừa lưu gần nhất nằm TRÊN CÙNG.

   Để biết "lần lưu cuối cùng" thì bảng TheKhoHangHoa cần cột UpdatedAt
   (trước đây chỉ có CreatedAt). Bản này:
     1. Thêm cột UpdatedAt DATETIME2 NULL (nếu chưa có).
     2. Điền UpdatedAt = CreatedAt cho toàn bộ dòng cũ (để thứ tự ban đầu
        vẫn hợp lý: hàng tạo sau nằm trên).
   Từ v5.65 backend tự cập nhật UpdatedAt mỗi lần bấm Lưu ở form Sửa thẻ kho.

   AN TOÀN: chỉ THÊM cột, KHÔNG sửa/xóa dữ liệu. Chạy nhiều lần vô hại.
   Nếu CHƯA chạy file này, phần mềm vẫn chạy bình thường (backend tự dò cột,
   thiếu thì xếp theo ngày tạo) — nhưng thứ tự sẽ không đổi khi Sửa thẻ kho.
   ================================================================ */
USE QLNoiBo;
GO

-- Chặn chạy nhầm database (SSMS hay mở New Query ở master).
IF DB_NAME() <> 'QLNoiBo'
BEGIN
    PRINT '*** SAI DATABASE: dang o [' + DB_NAME() + ']. Hay chon QLNoiBo roi chay lai. ***';
    SET NOEXEC ON;
END
GO

IF OBJECT_ID('dbo.TheKhoHangHoa', 'U') IS NULL
    PRINT '!! Khong tim thay bang TheKhoHangHoa - bo qua.';
ELSE IF COL_LENGTH('dbo.TheKhoHangHoa', 'UpdatedAt') IS NULL
BEGIN
    ALTER TABLE dbo.TheKhoHangHoa ADD UpdatedAt DATETIME2 NULL;
    PRINT '   + TheKhoHangHoa.UpdatedAt da them.';
END
ELSE
    PRINT '   = TheKhoHangHoa.UpdatedAt da co tu truoc.';
GO

-- Dòng cũ chưa có UpdatedAt -> lấy theo CreatedAt.
IF COL_LENGTH('dbo.TheKhoHangHoa', 'UpdatedAt') IS NOT NULL
BEGIN
    UPDATE dbo.TheKhoHangHoa SET UpdatedAt = CreatedAt WHERE UpdatedAt IS NULL;
    PRINT '   + Da dien UpdatedAt = CreatedAt cho cac dong cu.';
END
GO

PRINT '';
PRINT '=== migration_v658.sql HOAN TAT ===';
SELECT COL_LENGTH('dbo.TheKhoHangHoa', 'UpdatedAt') AS UpdatedAt_DoDai,
       (SELECT COUNT(*) FROM dbo.TheKhoHangHoa WHERE UpdatedAt IS NULL) AS SoDongConThieu;
GO

SET NOEXEC OFF;
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [60/81]  migration_v659.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [60/81] migration_v659.sql';
GO

/* ================================================================
   migration_v659.sql  (QLNoiBo v5.67)

   WEB PUSH NOTIFICATION — thông báo đẩy tới máy tính / điện thoại
   kể cả khi KHÔNG mở trang web.

   Bảng PushSubscription lưu "địa chỉ nhận thông báo" mà trình duyệt
   cấp cho từng THIẾT BỊ (endpoint + 2 khoá mã hoá). Một người dùng
   có thể có nhiều dòng (máy tính công ty, máy tính nhà, điện thoại).

   AN TOÀN: chỉ THÊM bảng mới, không đụng dữ liệu cũ. Chạy nhiều lần vô hại.
   ================================================================ */
USE QLNoiBo;
GO

IF DB_NAME() <> 'QLNoiBo'
BEGIN
    PRINT '*** SAI DATABASE: dang o [' + DB_NAME() + ']. Hay chon QLNoiBo roi chay lai. ***';
    SET NOEXEC ON;
END
GO

IF OBJECT_ID('dbo.PushSubscription', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.PushSubscription (
        PushID      INT IDENTITY(1,1) PRIMARY KEY,
        UserID      INT NOT NULL FOREIGN KEY REFERENCES Users(UserID) ON DELETE CASCADE,
        Endpoint    NVARCHAR(500) NOT NULL,   -- địa chỉ đẩy do trình duyệt cấp (dài, duy nhất/thiết bị)
        P256dh      NVARCHAR(200) NOT NULL,   -- khoá công khai của thiết bị
        Auth        NVARCHAR(100) NOT NULL,   -- khoá xác thực của thiết bị
        UserAgent   NVARCHAR(300) NULL,       -- để người dùng nhận ra "máy nào" khi cần gỡ
        CreatedAt   DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        LanGuiCuoi  DATETIME2 NULL
    );
    -- Endpoint dài -> đánh index trên 200 ký tự đầu là đủ để tra cứu nhanh.
    CREATE UNIQUE INDEX UX_PushSubscription_Endpoint ON dbo.PushSubscription (Endpoint);
    CREATE INDEX IX_PushSubscription_User ON dbo.PushSubscription (UserID);
    PRINT '   + Da tao bang PushSubscription.';
END
ELSE
    PRINT '   = Bang PushSubscription da co tu truoc.';
GO

PRINT '';
PRINT '=== migration_v659.sql HOAN TAT ===';
PRINT 'Buoc tiep theo (xem HUONG_DAN_CAI_DAT.md BUOC 2.86):';
PRINT '   1) cd backend  &&  npm install web-push';
PRINT '   2) node utils/taoVapidKeys.js   -> dan 3 dong VAPID_* vao .env';
PRINT '   3) pm2 restart qlnoibo';
SELECT OBJECT_ID('dbo.PushSubscription') AS PushSubscription_ObjectID;
GO

SET NOEXEC OFF;
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [61/81]  migration_v660.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [61/81] migration_v660.sql';
GO

/* ================================================================
   migration_v660.sql  (QLNoiBo v5.87)

   MỤC ĐÍCH: thêm 3 cột ẢNH (chỉ lưu ĐƯỜNG DẪN /uploads/..., giống mọi ảnh
   khác trong phần mềm — KHÔNG nhồi ảnh vào database):

     1. DonHangDonGiaInThe.AnhMinhHoa  — ảnh cho TỪNG DÒNG đơn giá in thêu.
     2. DanhMucPhuKien.AnhDaiDien      — ảnh của từng phụ kiện (danh mục).
     3. TienDoCatChiTietCay.AnhCay     — ảnh chụp TỪNG CÂY VẢI ở công đoạn Cắt
                                          (chụp bằng camera điện thoại hoặc tải file).

   AN TOÀN: chỉ THÊM cột, KHÔNG sửa/xóa dữ liệu. Chạy nhiều lần vô hại.
   Nếu CHƯA chạy file này: các màn hình vẫn mở bình thường (backend dò cột
   bằng COL_LENGTH, thiếu cột thì bỏ qua phần ảnh) — chỉ là chưa lưu được ảnh.
   ================================================================ */
USE QLNoiBo;
GO

-- Chặn chạy nhầm database (SSMS hay mở New Query ở master).
IF DB_NAME() <> 'QLNoiBo'
BEGIN
    PRINT '*** SAI DATABASE: dang o [' + DB_NAME() + ']. Hay chon QLNoiBo roi chay lai. ***';
    SET NOEXEC ON;
END
GO

-- 1) Đơn giá in thêu: ảnh minh họa cho từng dòng hạng mục.
IF OBJECT_ID('dbo.DonHangDonGiaInThe', 'U') IS NULL
    PRINT '!! Khong tim thay bang DonHangDonGiaInThe - bo qua.';
ELSE IF COL_LENGTH('dbo.DonHangDonGiaInThe', 'AnhMinhHoa') IS NULL
BEGIN
    ALTER TABLE dbo.DonHangDonGiaInThe ADD AnhMinhHoa NVARCHAR(500) NULL;
    PRINT '   + DonHangDonGiaInThe.AnhMinhHoa da them.';
END
ELSE
    PRINT '   = DonHangDonGiaInThe.AnhMinhHoa da co tu truoc.';
GO

-- 2) Danh mục phụ kiện: ảnh của phụ kiện.
IF OBJECT_ID('dbo.DanhMucPhuKien', 'U') IS NULL
    PRINT '!! Khong tim thay bang DanhMucPhuKien - bo qua.';
ELSE IF COL_LENGTH('dbo.DanhMucPhuKien', 'AnhDaiDien') IS NULL
BEGIN
    ALTER TABLE dbo.DanhMucPhuKien ADD AnhDaiDien NVARCHAR(500) NULL;
    PRINT '   + DanhMucPhuKien.AnhDaiDien da them.';
END
ELSE
    PRINT '   = DanhMucPhuKien.AnhDaiDien da co tu truoc.';
GO

-- 3) Công đoạn Cắt: ảnh chụp từng cây vải trong 1 lần ghi tiến độ.
IF OBJECT_ID('dbo.TienDoCatChiTietCay', 'U') IS NULL
    PRINT '!! Khong tim thay bang TienDoCatChiTietCay - bo qua.';
ELSE IF COL_LENGTH('dbo.TienDoCatChiTietCay', 'AnhCay') IS NULL
BEGIN
    ALTER TABLE dbo.TienDoCatChiTietCay ADD AnhCay NVARCHAR(500) NULL;
    PRINT '   + TienDoCatChiTietCay.AnhCay da them.';
END
ELSE
    PRINT '   = TienDoCatChiTietCay.AnhCay da co tu truoc.';
GO

PRINT '';
PRINT '=== migration_v660.sql HOAN TAT ===';
SELECT COL_LENGTH('dbo.DonHangDonGiaInThe', 'AnhMinhHoa') AS DonGiaInThe_AnhMinhHoa,
       COL_LENGTH('dbo.DanhMucPhuKien',     'AnhDaiDien') AS PhuKien_AnhDaiDien,
       COL_LENGTH('dbo.TienDoCatChiTietCay','AnhCay')     AS Cat_AnhCay;
GO

SET NOEXEC OFF;
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [62/81]  migration_v661.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [62/81] migration_v661.sql';
GO

/* ================================================================
   migration_v661.sql  (QLNoiBo v5.91)

   MỤC ĐÍCH: thêm chức năng "LƯƠNG TRẢI VẢI CẮT" trong phân hệ Tính lương.

     1. Bảng CauHinhLuongCat — HỆ SỐ LƯƠNG của từng nhân viên bộ phận Cắt
        (mặc định 1.0 nếu chưa khai).
     2. Seed khoá cấu hình 'LUONG_CAT' trong bảng CauHinh — chứa ĐƠN GIÁ
        (mặc định 1100 đ) dùng cho công thức:
            mét sơ đồ × tổng số lớp × khổ vải × đơn giá = tiền 1 sơ đồ
        Sửa đơn giá ngay trong phần mềm, KHÔNG cần sửa code.
     3. Seed ChucNang 'luongtraivaicat' để phân quyền tab mới như các tab lương khác.

   AN TOÀN: chỉ THÊM, không sửa/xóa dữ liệu cũ. Chạy nhiều lần vô hại.
   ================================================================ */
USE QLNoiBo;
GO

IF DB_NAME() <> 'QLNoiBo'
BEGIN
    PRINT '*** SAI DATABASE: dang o [' + DB_NAME() + ']. Hay chon QLNoiBo roi chay lai. ***';
    SET NOEXEC ON;
END
GO

-- 1) Hệ số lương từng nhân viên cắt.
IF OBJECT_ID('dbo.CauHinhLuongCat', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.CauHinhLuongCat (
        NhanVienID  INT NOT NULL PRIMARY KEY FOREIGN KEY REFERENCES NhanVien(NhanVienID),
        HeSoLuong   DECIMAL(10,3) NOT NULL DEFAULT 1,
        GhiChu      NVARCHAR(255) NULL,
        UpdatedAt   DATETIME2 NULL
    );
    PRINT '   + Da tao bang CauHinhLuongCat.';
END
ELSE
    PRINT '   = Bang CauHinhLuongCat da co tu truoc.';
GO

-- 2) Đơn giá cắt (JSON trong CauHinh). Bảng CauHinh do migration_v655 tạo.
IF OBJECT_ID('dbo.CauHinh', 'U') IS NULL
    PRINT '!! Chua co bang CauHinh - hay chay migration_v655.sql truoc.';
ELSE IF NOT EXISTS (SELECT 1 FROM dbo.CauHinh WHERE Khoa = N'LUONG_CAT')
BEGIN
    INSERT INTO dbo.CauHinh (Khoa, GiaTri, UpdatedAt)
    VALUES (N'LUONG_CAT', N'{"donGia":1100}', SYSDATETIME());
    PRINT '   + Da seed CauHinh[LUONG_CAT] = don gia 1100.';
END
ELSE
    PRINT '   = CauHinh[LUONG_CAT] da co tu truoc (khong ghi de don gia dang dung).';
GO

-- 3) Chức năng phân quyền cho tab mới (giống luongmay / luongladonggoi).
IF OBJECT_ID('dbo.ChucNang', 'U') IS NULL
    PRINT '!! Chua co bang ChucNang - bo qua phan seed phan quyen.';
ELSE
BEGIN
    MERGE ChucNang AS t
    USING (VALUES ('PAYROLL', 'luongtraivaicat', N'Lương trải vải cắt', 7)) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu)
      ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
    WHEN NOT MATCHED THEN
      INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu)
      VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu);
    PRINT '   + Da seed ChucNang PAYROLL/luongtraivaicat.';
END
GO

PRINT '';
PRINT '=== migration_v661.sql HOAN TAT ===';
SELECT (SELECT COUNT(*) FROM dbo.CauHinhLuongCat) AS SoNhanVienDaKhaiHeSo,
       (SELECT GiaTri FROM dbo.CauHinh WHERE Khoa = N'LUONG_CAT') AS CauHinh_LuongCat;
GO

SET NOEXEC OFF;
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [63/81]  migration_v662.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [63/81] migration_v662.sql';
GO

/* ================================================================
   MIGRATION v6.01 — (1) Sổ cắt: cột GIẬT CẤP; (2) Giao in thêu: HẠNG MỤC IN THÊU
   ----------------------------------------------------------------
   1) TienDoCatChiTietCay.SoCaiGiatCap (INT NULL)
      Số lượng CÁI cắt giật cấp của từng cây/bàn cắt.
      QUY TẮC NGHIỆP VỤ (theo yêu cầu): giật cấp KHÔNG cộng vào SỐ LỚP, chỉ cộng vào TỔNG SỐ LƯỢNG CÁI
      của bàn cắt đó. Vì vậy:
        - Cột tính sẵn SoLuongCai (= SoLuongLop * HeSoQuyDoi, PERSISTED từ migration_v5_qlsx.sql) GIỮ
          NGUYÊN, KHÔNG sửa công thức (sửa cột tính sẵn phải DROP/ADD lại, rủi ro cao và không cần thiết).
        - Tổng SL cái thật = SoLuongCai + ISNULL(SoCaiGiatCap, 0) — được cộng ở tầng code (qlsx.js khi ghi
          TienDoChiTietMau, và ở bản in sổ cắt).
      Hệ quả có Ý ĐỊNH: TienDoChiTietMau (SL cắt theo màu — Kho nhập / báo cáo năng suất đọc) TĂNG thêm
      phần giật cấp. KHÔNG ảnh hưởng: Bảng kê BTP (điền theo SỐ LỚP) và Lương trải vải cắt (mét × lớp × khổ).

   2) DonHangNhaInTheu.HangMucInThe (NVARCHAR(200) NULL)
      Tên hạng mục in/thêu của dòng giao — CHỌN từ "Đơn giá in thêu" của đơn (DonHangDonGiaInThe.Ten)
      nhưng lưu dạng CHỮ (snapshot), KHÔNG lưu khóa ngoại: màn "Đơn giá in thêu" khi Lưu là XÓA HẾT dòng
      của bản rồi chèn lại (ID đổi mỗi lần sửa) nên khóa ngoại sẽ mồ côi. Cùng quy ước với
      TienDoSanXuat.TenNhaGiaCongTaiThoiDiem.
      Bảng lương gia công in thêu: dòng ĐÃ chọn hạng mục -> đơn giá = đơn giá CỦA hạng mục đó; dòng để
      trống (dữ liệu cũ) -> giữ cách cũ = TỔNG đơn giá in thêu của đơn.

   Chạy 1 lần. IDEMPOTENT. Chạy được nhiều lần không lỗi.
   YEU CAU: migration_v5_qlsx.sql (TienDoCatChiTietCay), migration_v532.sql (DonHangNhaInTheu).
   ================================================================ */
USE QLNoiBo;
GO
IF DB_NAME() <> 'QLNoiBo'
BEGIN
    RAISERROR('KHONG ket noi duoc database QLNoiBo - dung migration.', 16, 1);
    SET NOEXEC ON;
END
GO

/* ---------------- 1. TienDoCatChiTietCay.SoCaiGiatCap ---------------- */
IF COL_LENGTH('TienDoCatChiTietCay', 'SoCaiGiatCap') IS NULL
BEGIN
    ALTER TABLE TienDoCatChiTietCay ADD SoCaiGiatCap INT NULL;
    PRINT 'Da them TienDoCatChiTietCay.SoCaiGiatCap.';
END
ELSE PRINT 'TienDoCatChiTietCay.SoCaiGiatCap da co, bo qua.';
GO

/* ---------------- 2. DonHangNhaInTheu.HangMucInThe ---------------- */
IF COL_LENGTH('DonHangNhaInTheu', 'HangMucInThe') IS NULL
BEGIN
    ALTER TABLE DonHangNhaInTheu ADD HangMucInThe NVARCHAR(200) NULL;
    PRINT 'Da them DonHangNhaInTheu.HangMucInThe.';
END
ELSE PRINT 'DonHangNhaInTheu.HangMucInThe da co, bo qua.';
GO

PRINT 'MIGRATION v662 HOAN TAT.';
GO
SET NOEXEC OFF;
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [64/81]  migration_v663.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [64/81] migration_v663.sql';
GO

/* ================================================================
   MIGRATION v6.02 — Ra lệnh sản xuất: NHIỀU ảnh hình in thêu
   ----------------------------------------------------------------
   Yeu cau: "Ra lệnh sản xuất, hình ảnh in thêu thêm được nhiều hình ảnh".

   Cach lam: GIU NGUYEN 1 cot DonHangSanXuat.AnhHinhIn, luu NHIEU duong dan noi bang ky tu xuong dong
   (\n) - dung quy uoc da co san cua DonHangSanXuat.PhuLieu (nhieu dong phu kien noi bang \n, tu v5.42).
   Khong tao bang con -> khong phai sua moi cho doc (in lenh SX, form sua...) thanh JOIN.
   Chi can NOI RONG cot tu NVARCHAR(500) -> NVARCHAR(MAX): 500 ky tu chi chua duoc khoang 10 duong dan,
   dinh muc do se lam MAT ANH lang le khi luu (SQL Server bao loi truncate, nhung neu driver cat bot thi
   mat du lieu ma khong ai biet).

   ALTER COLUMN kieu noi rong (NVARCHAR(500) -> NVARCHAR(MAX)) la thao tac AN TOAN: khong mat du lieu cu,
   khong doi NULL/NOT NULL. Chay 1 lan. IDEMPOTENT (kiem tra max_length = -1 nghia la da la MAX).
   YEU CAU: migration_v55.sql (da tao cot AnhHinhIn).
   ================================================================ */
USE QLNoiBo;
GO
IF DB_NAME() <> 'QLNoiBo'
BEGIN
    RAISERROR('KHONG ket noi duoc database QLNoiBo - dung migration.', 16, 1);
    SET NOEXEC ON;
END
GO

IF COL_LENGTH('DonHangSanXuat', 'AnhHinhIn') IS NULL
BEGIN
    ALTER TABLE DonHangSanXuat ADD AnhHinhIn NVARCHAR(MAX) NULL;
    PRINT 'Da them DonHangSanXuat.AnhHinhIn (NVARCHAR(MAX)).';
END
ELSE IF EXISTS (SELECT 1 FROM sys.columns
                WHERE object_id = OBJECT_ID('DonHangSanXuat') AND name = 'AnhHinhIn' AND max_length <> -1)
BEGIN
    ALTER TABLE DonHangSanXuat ALTER COLUMN AnhHinhIn NVARCHAR(MAX) NULL;
    PRINT 'Da noi rong DonHangSanXuat.AnhHinhIn thanh NVARCHAR(MAX) (chua duoc nhieu duong dan anh).';
END
ELSE PRINT 'DonHangSanXuat.AnhHinhIn da la NVARCHAR(MAX), bo qua.';
GO

PRINT 'MIGRATION v663 HOAN TAT.';
GO
SET NOEXEC OFF;
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [65/81]  migration_v664.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [65/81] migration_v664.sql';
GO

/* ================================================================
   MIGRATION v6.04 — Định mức & Hao hụt: chuyển sang Quản lý sản xuất, khai THEO LỆNH SX + THEO LOẠI VẢI
   ----------------------------------------------------------------
   Yeu cau:
     - Dua chuc nang "Dinh muc / Hao hut" tu phan he Kho vai sang phan he Quan ly san xuat.
     - Chon lenh SX tu DANH SACH lenh (khong con go tay "Ten mau hang" phai khop chu voi Ten san pham -
       cach cu rat de sai chinh ta/khoang trang -> khong khop -> bao cao hao hut trong tron).
     - Dinh muc khai theo LOAI VAI (LoaiVai) chu khong theo tung MA VAI/ma cay, va CHON DUOC don vi tinh
       (Kg hoac Met) vi vai co the quan ly theo kg hoac theo met.
     - "SL hoan thanh" lay tu SO LUONG NHAP KHO (tien do cong doan 'KN') thay vi TongSoLuong x % hoan thanh.

   Cach lam: GIU bang DinhMucVai da co (khong mat du lieu cu), THEM 3 cot:
     - DonHangID  -> khai theo dung 1 lenh SX (NULL = dong cu khai theo MauHang, van doc duoc)
     - LoaiVaiID  -> loai vai (thay cho VaiID = ma vai cu the; cot VaiID GIU LAI cho du lieu cu)
     - DonViTinh  -> N'Kg' / N'Mét' (mac dinh Kg cho du lieu cu -> giu nguyen y nghia cot DinhMucKGTrenSP)
   + seed ChucNang('QLSX','dinhmuc') de tab moi hien theo phan quyen.
   ChucNang('KHOVAI','dinhmuc') GIU NGUYEN (mo coi) - khong xoa de khong lam hong ma tran phan quyen cu.

   Chay 1 lan. IDEMPOTENT. YEU CAU: schema.sql (bang DinhMucVai, LoaiVai, ChucNang).
   ================================================================ */
USE QLNoiBo;
GO
IF DB_NAME() <> 'QLNoiBo'
BEGIN
    RAISERROR('KHONG ket noi duoc database QLNoiBo - dung migration.', 16, 1);
    SET NOEXEC ON;
END
GO

/* ---------------- 1. 3 cot moi tren DinhMucVai ---------------- */
IF COL_LENGTH('DinhMucVai', 'DonHangID') IS NULL
BEGIN
    ALTER TABLE DinhMucVai ADD DonHangID INT NULL;
    PRINT 'Da them DinhMucVai.DonHangID.';
END ELSE PRINT 'DinhMucVai.DonHangID da co, bo qua.';
GO
IF COL_LENGTH('DinhMucVai', 'LoaiVaiID') IS NULL
BEGIN
    ALTER TABLE DinhMucVai ADD LoaiVaiID INT NULL;
    PRINT 'Da them DinhMucVai.LoaiVaiID.';
END ELSE PRINT 'DinhMucVai.LoaiVaiID da co, bo qua.';
GO
IF COL_LENGTH('DinhMucVai', 'DonViTinh') IS NULL
BEGIN
    ALTER TABLE DinhMucVai ADD DonViTinh NVARCHAR(20) NULL;
    PRINT 'Da them DinhMucVai.DonViTinh.';
END ELSE PRINT 'DinhMucVai.DonViTinh da co, bo qua.';
GO

-- Du lieu cu: dinh muc von la KG/SP -> gan don vi Kg de bao cao hieu dung.
UPDATE DinhMucVai SET DonViTinh = N'Kg' WHERE DonViTinh IS NULL OR LTRIM(RTRIM(DonViTinh)) = N'';
GO

-- Du lieu cu tro toi VaiID (ma vai): suy ra LoaiVaiID tuong ung de van hien dung o ban moi.
UPDATE dm SET dm.LoaiVaiID = dv.LoaiVaiID
FROM DinhMucVai dm JOIN DanhMucVai dv ON dv.VaiID = dm.VaiID
WHERE dm.LoaiVaiID IS NULL AND dm.VaiID IS NOT NULL;
GO

-- Du lieu cu khop theo TEN san pham: gan luon DonHangID neu ten khop DUY NHAT 1 lenh SX
-- (khop nhieu lenh thi de NULL, dong do van doc duoc theo MauHang nhu truoc).
UPDATE dm SET dm.DonHangID = x.DonHangID
FROM DinhMucVai dm
CROSS APPLY (
    SELECT MIN(d.DonHangID) AS DonHangID, COUNT(*) AS SoLenh
    FROM DonHangSanXuat d
    WHERE LTRIM(RTRIM(LOWER(d.TenSanPham))) = LTRIM(RTRIM(LOWER(dm.MauHang)))
) x
WHERE dm.DonHangID IS NULL AND x.SoLenh = 1;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_DinhMucVai_Don')
    CREATE INDEX IX_DinhMucVai_Don ON DinhMucVai(DonHangID);
GO

/* ---------------- 2. ChucNang cho tab moi trong QLSX ---------------- */
IF OBJECT_ID('dbo.ChucNang', 'U') IS NULL
    PRINT '!! Chua co bang ChucNang - bo qua phan seed phan quyen.';
ELSE
BEGIN
    MERGE ChucNang AS t
    USING (VALUES ('QLSX', 'dinhmuc', N'Định mức & Hao hụt', 13)) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu)
      ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
    WHEN NOT MATCHED THEN
      INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu)
      VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu);
    PRINT 'Da seed ChucNang QLSX/dinhmuc (nho CAP QUYEN cho nhom/nguoi dung trong Ma tran phan quyen).';
END
GO

PRINT '';
PRINT '=== MIGRATION v664 HOAN TAT ===';
SELECT COUNT(*) AS SoDongDinhMuc,
       SUM(CASE WHEN DonHangID IS NOT NULL THEN 1 ELSE 0 END) AS DaGanLenhSX,
       SUM(CASE WHEN LoaiVaiID IS NOT NULL THEN 1 ELSE 0 END) AS DaGanLoaiVai
FROM DinhMucVai;
GO
SET NOEXEC OFF;
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [66/81]  migration_v665.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [66/81] migration_v665.sql';
GO

/* ================================================================
   MIGRATION v6.15 — TÍNH GIÁ THÀNH SẢN PHẨM THEO LỆNH SẢN XUẤT
   ----------------------------------------------------------------
   Chuc nang moi trong phan he Quan ly san xuat: gom MOI chi phi lien quan den 1 lenh SX de ra gia thanh
   1 san pham. Cac khoan chi phi VON DA CO SAN trong CSDL (khong tao bang moi):
     1. Vai      = SO KG/MET DA DUNG khi cat cua tung cay (TienDoCatChiTietCay.SoKgMetSuDung)
                   x DON GIA CUA CHINH CAY DO (VaiCay.DonGiaNhap)
     2. Phu kien = SL xuat cho don (PhieuPhuKienChiTiet cua phieu Xuat) x don gia LAN NHAP GAN NHAT
                   (phieu Xuat khong co cot don gia - xem migration_v54.sql)
     3. Gia cong ngoai = DonHangChiTietNhaGiaCong.SoLuongNhan x don gia hang muc gia cong
        May nha lam    = PhanCongMay.SoLuong x thanh tien/cai (dung DUNG cong thuc cua bang luong khoan may)
     4. In theu  = DonHangNhaInTheu.SoLuongNhan x don gia hang muc in theu (xem migration_v662.sql)
   Chi THIEU 1 thu: cac khoan CHI PHI CHUNG nhap tay (dien, nuoc, khau hao, van chuyen...) -> bang moi
   ChiPhiChungDonHang duoi day.

   Gia thanh 1 SP = TONG chi phi / SL hoan thanh (SL NHAP KHO thuc te; chua nhap kho thi lay SL cat).

   Chay 1 lan. IDEMPOTENT. YEU CAU: schema.sql, migration_v5_chucnang.sql.
   ================================================================ */
USE QLNoiBo;
GO
IF DB_NAME() <> 'QLNoiBo'
BEGIN
    RAISERROR('KHONG ket noi duoc database QLNoiBo - dung migration.', 16, 1);
    SET NOEXEC ON;
END
GO

/* ---------------- 1. Bang chi phi chung nhap tay theo tung lenh SX ---------------- */
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ChiPhiChungDonHang')
BEGIN
    CREATE TABLE ChiPhiChungDonHang (
        ID          INT IDENTITY(1,1) PRIMARY KEY,
        DonHangID   INT NOT NULL FOREIGN KEY REFERENCES DonHangSanXuat(DonHangID) ON DELETE CASCADE,
        TenChiPhi   NVARCHAR(200) NOT NULL,          -- vd: Dien nuoc, Van chuyen, Khau hao may...
        SoTien      DECIMAL(18,2) NOT NULL DEFAULT 0,
        GhiChu      NVARCHAR(255) NULL,
        ThuTu       INT NULL,
        CreatedAt   DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    CREATE INDEX IX_ChiPhiChungDonHang_Don ON ChiPhiChungDonHang(DonHangID);
    PRINT 'Da tao bang ChiPhiChungDonHang.';
END ELSE PRINT 'Bang ChiPhiChungDonHang da ton tai, bo qua.';
GO

/* ---------------- 2. ChucNang cho tab moi trong QLSX ---------------- */
IF OBJECT_ID('dbo.ChucNang', 'U') IS NULL
    PRINT '!! Chua co bang ChucNang - bo qua phan seed phan quyen.';
ELSE
BEGIN
    MERGE ChucNang AS t
    USING (VALUES ('QLSX', 'giathanh', N'Giá thành sản phẩm', 14)) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu)
      ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
    WHEN NOT MATCHED THEN
      INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu)
      VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu);
    PRINT 'Da seed ChucNang QLSX/giathanh (nho CAP QUYEN trong Ma tran phan quyen).';
END
GO

PRINT '';
PRINT '=== MIGRATION v665 HOAN TAT ===';
GO
SET NOEXEC OFF;
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [67/81]  migration_v666.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [67/81] migration_v666.sql';
GO

/* ================================================================
   MIGRATION v6.20 — THE KHO HANG HOA: % CHIET KHAU SHOP / NPP
   ----------------------------------------------------------------
   Yeu cau: "The kho hang hoa: them cot gia sau CK shop (nhap %), cot gia sau CK NPP (nhap %)".
   => NGUOI DUNG CHI NHAP % CHIET KHAU, gia sau CK KHONG luu vao CSDL ma TINH LUC DOC:
        Gia sau CK = GiaBan x (1 - PhanTram/100)
      (nguyen tac da dung tu v5.89/v6.06: tinh o duong DOC de du lieu cu khong can migration du lieu;
       sua GiaBan la moi cot gia sau CK tu dung theo, khong bao gio lech)

   !! LUU Y VE DON VI: 2 cot nay luu SO PHAN TRAM (20 = 20%), KHAC voi
      BaoGiaAloha.PhanTramVAT (luu dang PHAN SO: 0.1 = 10%). Dung sao chep cong thuc giua 2 cho.

   DECIMAL(5,2) => toi da 999.99 (du cho 0-100, van cho phep nhap sai > 100 de con thay ma sua,
   khong chan cung o CSDL vi co the co truong hop CK 100% - hang tang).

   Chay 1 lan. IDEMPOTENT (chay lai khong sao). YEU CAU: schema.sql.
   ================================================================ */
USE QLNoiBo;
GO
IF DB_NAME() <> 'QLNoiBo'
BEGIN
    RAISERROR('KHONG ket noi duoc database QLNoiBo - dung migration.', 16, 1);
    SET NOEXEC ON;
END
GO

IF COL_LENGTH('dbo.TheKhoHangHoa', 'PhanTramCKShop') IS NULL
BEGIN
    ALTER TABLE dbo.TheKhoHangHoa ADD PhanTramCKShop DECIMAL(5,2) NULL;   -- 20 = 20% (KHONG phai 0.2)
    PRINT 'Da them cot TheKhoHangHoa.PhanTramCKShop.';
END ELSE PRINT 'Cot PhanTramCKShop da ton tai, bo qua.';
GO

IF COL_LENGTH('dbo.TheKhoHangHoa', 'PhanTramCKNPP') IS NULL
BEGIN
    ALTER TABLE dbo.TheKhoHangHoa ADD PhanTramCKNPP DECIMAL(5,2) NULL;    -- 20 = 20% (KHONG phai 0.2)
    PRINT 'Da them cot TheKhoHangHoa.PhanTramCKNPP.';
END ELSE PRINT 'Cot PhanTramCKNPP da ton tai, bo qua.';
GO

/* Khong sua vw_TonKhoHangHoa: route /khohang/items da JOIN TheKhoHangHoa (de lay UpdatedAt tu v658)
   nen chi can bo sung 2 cot vao SELECT do -> khong phai ALTER VIEW, khong rui ro voi cac ban DB
   chua chay du migration (backend van do bang COL_LENGTH truoc khi doc). */

PRINT '';
PRINT '=== MIGRATION v666 HOAN TAT ===';
PRINT 'Nho: Ctrl+F5 trinh duyet. Khong can cap quyen moi (dung chuc nang KHOHANG/items san co).';
GO
SET NOEXEC OFF;
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [68/81]  migration_v667.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [68/81] migration_v667.sql';
GO

/* ================================================================
   MIGRATION v6.21 — TY LE CHIET KHAU SHOP / NPP: DANH CHUNG 1 TY LE
   ----------------------------------------------------------------
   Yeu cau: "phan chiet khau shop va NPP danh chung ty le chu khong tung ma hang"
            "gia CK cua NPP = gia shop sau CK 33% x 17%"  => CHIET KHAU CHONG:
              Gia shop = GiaBan   x (1 - CK_SHOP/100)
              Gia NPP  = Gia shop x (1 - CK_NPP/100)
            vd GiaBan 100.000, 33%/17% -> shop 67.000 -> NPP 55.610

   Ty le luu o CauHinhHeThong (bang da co san tu schema.sql, khong tao bang moi):
      CK_SHOP = 33
      CK_NPP  = 17
   -> Sua 1 cho, ca bang The kho + bang ke in + file Excel doi theo.

   !! MIGRATION NAY LA TUY CHON: backend tu mac dinh 33/17 khi chua co 2 dong nay, va luu bang MERGE
      (lan bam "Luu ty le" dau tien se tu tao dong). Chay de gia tri nam san trong CSDL cho ro rang.

   ---- Ve migration_v666 (v6.20) ----
   v6.20 tung them 2 cot TheKhoHangHoa.PhanTramCKShop / PhanTramCKNPP de khai % THEO TUNG MA HANG.
   Cach do DA BO. 2 cot nay KHONG con duoc doc/ghi. CO TINH GIU LAI (khong DROP) de:
     - ban DB da chay v666 khong bi loi gi,
     - ban DB chua chay v666 cung khong can chay nua.
   Neu muon don sach, chay tay:
     -- ALTER TABLE dbo.TheKhoHangHoa DROP COLUMN PhanTramCKShop, PhanTramCKNPP;

   Chay 1 lan. IDEMPOTENT. YEU CAU: schema.sql.
   ================================================================ */
USE QLNoiBo;
GO
IF DB_NAME() <> 'QLNoiBo'
BEGIN
    RAISERROR('KHONG ket noi duoc database QLNoiBo - dung migration.', 16, 1);
    SET NOEXEC ON;
END
GO

/* Chi INSERT khi CHUA co - KHONG ghi de gia tri nguoi dung da tu sua tren giao dien. */
MERGE CauHinhHeThong AS t
USING (VALUES ('CK_SHOP', N'33'), ('CK_NPP', N'17')) AS s (ConfigKey, ConfigValue)
  ON t.ConfigKey = s.ConfigKey
WHEN NOT MATCHED THEN INSERT (ConfigKey, ConfigValue) VALUES (s.ConfigKey, s.ConfigValue);
GO

SELECT ConfigKey, ConfigValue FROM CauHinhHeThong WHERE ConfigKey IN ('CK_SHOP', 'CK_NPP');
GO

PRINT '';
PRINT '=== MIGRATION v667 HOAN TAT ===';
PRINT 'Doi ty le ngay tren tab "The kho / Ton kho" (o CK shop / CK NPP + nut Luu ty le).';
GO
SET NOEXEC OFF;
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [69/81]  migration_v668.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [69/81] migration_v668.sql';
GO

/* ================================================================
   MIGRATION v6.23 — BAN HANG + QUAN LY CONG NO (phieu thu / phieu chi / cong no KH-NCC)
   ----------------------------------------------------------------
   Tham khao cach lam cua KiotViet + phan mem ke toan, nhung GIU DUNG du lieu da co san
   (khong bat nhap lai): cong no NCC tu tinh tu PHIEU NHAP VAI + PHIEU NHAP PHU KIEN.

   ---------------- 1. DOI MO HINH TRU TON (quan trong nhat) ----------------
   TRUOC (v5.65): tao don khach dat  ->  TRU TON NGAY.
   NAY:            don khach dat 'Cho xac nhan'/'Cho xu ly' = GIU HANG (chua tru ton);
                   chi PHIEU BAN HANG moi TRU TON that su, don chuyen 'Da xuat hang'.
   => The kho + Catalogue hien TON KHA DUNG = ton kho - SL cac don dang giu, de khach dat tiep
      khong bi ban trung hang.
   !! DU LIEU CU: cac don dang 'Cho xu ly'/'Cho xac nhan' co DaTruTon=1 la DA tru ton theo cach cu.
      Phai chay CLI hoan ton 1 lan sau migration nay, neu khong se bi TRU 2 LAN khi xuat phieu ban hang:
         cd backend
         node utils/hoan_ton_don_cho_xu_ly.js              (chay thu, KHONG ghi)
         node utils/hoan_ton_don_cho_xu_ly.js --ghi        (ghi that, co backup JSON)

   ---------------- 2. Bang moi ----------------
     DanhMucLoaiTaiKhoan  - loai tai khoan, co co "tinh chi phi KD" (dung cho bao cao lai lo sau nay)
     DanhMucTaiKhoan      - tai khoan thu/chi thuoc 1 loai
     PhieuBanHang         - phieu ban hang (= PHIEU XUAT KHO KIEM BIEN BAN BAN GIAO, mau Word)
     PhieuBanHangChiTiet  - dong hang: gia ban le, % CK shop, gia ban, thanh tien, SL quy doi Cai
     PhieuThu             - thu tien (khach hang / khac), co the gan vao 1 phieu ban hang
     PhieuChi             - chi tien (nha cung cap / khac)
     CongNoDieuChinh      - dieu chinh no nhap tay: no dau ky, tien gia cong, in theu, giam gia...
                            (theo yeu cau: cong no NCC tu dong CHI tu vai + phu kien, phan khac nhap tay)
   Cong no KHACH HANG nhom theo TEN KHACH (chuoi) vi toan he thong dang dung ten khach go tu do
   (DonKhachDatHang.TenKhach); van luu KhachHangID khi chon tu danh muc.

   Chay 1 lan. IDEMPOTENT. YEU CAU: schema.sql, migration_v5_chucnang.sql, migration_v657.sql.
   ================================================================ */
USE QLNoiBo;
GO
IF DB_NAME() <> 'QLNoiBo'
BEGIN
    RAISERROR('KHONG ket noi duoc database QLNoiBo - dung migration.', 16, 1);
    SET NOEXEC ON;
END
GO

/* ---------------- 1. Danh muc tai khoan ---------------- */
IF OBJECT_ID('dbo.DanhMucLoaiTaiKhoan', 'U') IS NULL
BEGIN
    CREATE TABLE DanhMucLoaiTaiKhoan (
        LoaiTKID     INT IDENTITY(1,1) PRIMARY KEY,
        TenLoai      NVARCHAR(100) NOT NULL UNIQUE,
        TinhChiPhiKD BIT NOT NULL DEFAULT 0,   -- 1 = khoan nay TINH vao chi phi kinh doanh (bao cao lai lo)
        GhiChu       NVARCHAR(255) NULL
    );
    PRINT 'Da tao bang DanhMucLoaiTaiKhoan.';
END ELSE PRINT 'Bang DanhMucLoaiTaiKhoan da ton tai, bo qua.';
GO

IF OBJECT_ID('dbo.DanhMucTaiKhoan', 'U') IS NULL
BEGIN
    CREATE TABLE DanhMucTaiKhoan (
        TaiKhoanID  INT IDENTITY(1,1) PRIMARY KEY,
        MaTK        NVARCHAR(30) NOT NULL UNIQUE,
        TenTK       NVARCHAR(150) NOT NULL,
        LoaiTKID    INT NULL FOREIGN KEY REFERENCES DanhMucLoaiTaiKhoan(LoaiTKID),
        GhiChu      NVARCHAR(255) NULL
    );
    PRINT 'Da tao bang DanhMucTaiKhoan.';
END ELSE PRINT 'Bang DanhMucTaiKhoan da ton tai, bo qua.';
GO

/* Seed vai loai + tai khoan thong dung (chi khi bang con rong - khong ghi de cai nguoi dung tu khai) */
IF NOT EXISTS (SELECT 1 FROM DanhMucLoaiTaiKhoan)
BEGIN
    INSERT INTO DanhMucLoaiTaiKhoan (TenLoai, TinhChiPhiKD, GhiChu) VALUES
      (N'Thu tiền bán hàng', 0, N'Tiền khách trả - KHÔNG phải chi phí'),
      (N'Thu khác',          0, NULL),
      (N'Chi mua nguyên phụ liệu', 1, N'Vải, phụ kiện'),
      (N'Chi gia công / in thêu',  1, NULL),
      (N'Chi lương',               1, NULL),
      (N'Chi phí bán hàng',        1, N'Vận chuyển, bao bì...'),
      (N'Chi phí quản lý',         1, N'Điện nước, thuê nhà, văn phòng...'),
      (N'Chi khác (không tính CPKD)', 0, N'Tạm ứng, trả nợ gốc, rút vốn...');
    PRINT 'Da seed 8 loai tai khoan mac dinh.';
END
GO
IF NOT EXISTS (SELECT 1 FROM DanhMucTaiKhoan)
BEGIN
    INSERT INTO DanhMucTaiKhoan (MaTK, TenTK, LoaiTKID)
    SELECT x.MaTK, x.TenTK, l.LoaiTKID
    FROM (VALUES
        (N'TBH', N'Thu tiền bán hàng',            N'Thu tiền bán hàng'),
        (N'TK',  N'Thu khác',                     N'Thu khác'),
        (N'CVL', N'Chi mua vải',                  N'Chi mua nguyên phụ liệu'),
        (N'CPK', N'Chi mua phụ kiện',             N'Chi mua nguyên phụ liệu'),
        (N'CGC', N'Chi gia công / in thêu',       N'Chi gia công / in thêu'),
        (N'CLG', N'Chi lương công nhân',          N'Chi lương'),
        (N'CVC', N'Chi vận chuyển',               N'Chi phí bán hàng'),
        (N'CQL', N'Chi phí quản lý chung',        N'Chi phí quản lý'),
        (N'CKH', N'Chi khác',                     N'Chi khác (không tính CPKD)')
    ) AS x (MaTK, TenTK, TenLoai)
    JOIN DanhMucLoaiTaiKhoan l ON l.TenLoai = x.TenLoai;
    PRINT 'Da seed 9 tai khoan mac dinh.';
END
GO

/* ---------------- 2. Phieu ban hang ---------------- */
IF OBJECT_ID('dbo.PhieuBanHang', 'U') IS NULL
BEGIN
    CREATE TABLE PhieuBanHang (
        PhieuBHID      INT IDENTITY(1,1) PRIMARY KEY,
        SoPhieu        NVARCHAR(30) NOT NULL UNIQUE,      -- PBH<yy><so thu tu 4 chu so>, chay suot ca nam
        NgayBan        DATE NOT NULL,
        KhachHangID    INT NULL FOREIGN KEY REFERENCES KhachHang(KhachHangID),
        TenKhach       NVARCHAR(150) NOT NULL,            -- khoa nhom cong no khach hang
        SDT            NVARCHAR(30) NULL,
        DiaChi         NVARCHAR(255) NULL,
        /* Chan phieu theo dung mau Word: Tong cong -> CK NPP -> Tong tien TT -> VAT -> Tong sau VAT */
        PhanTramCKNPP  DECIMAL(5,2) NOT NULL DEFAULT 0,
        PhanTramVAT    DECIMAL(5,2) NOT NULL DEFAULT 0,
        TongTienHang   DECIMAL(18,2) NOT NULL DEFAULT 0,  -- tong THANH TIEN cac dong (da tru CK shop)
        TienCKNPP      DECIMAL(18,2) NOT NULL DEFAULT 0,
        TienTruocVAT   DECIMAL(18,2) NOT NULL DEFAULT 0,  -- = TongTienHang - TienCKNPP
        TienVAT        DECIMAL(18,2) NOT NULL DEFAULT 0,
        TongThanhToan  DECIMAL(18,2) NOT NULL DEFAULT 0,  -- = TienTruocVAT + TienVAT  (so vao cong no)
        TongSLCai      INT NOT NULL DEFAULT 0,
        TrangThai      NVARCHAR(20) NOT NULL DEFAULT N'Hoàn thành',   -- Hoàn thành / Đã hủy
        GhiChu         NVARCHAR(500) NULL,
        NguoiTaoID     INT NULL FOREIGN KEY REFERENCES Users(UserID),
        CreatedAt      DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    CREATE INDEX IX_PhieuBanHang_Khach ON PhieuBanHang(TenKhach);
    CREATE INDEX IX_PhieuBanHang_Ngay ON PhieuBanHang(NgayBan);
    PRINT 'Da tao bang PhieuBanHang.';
END ELSE PRINT 'Bang PhieuBanHang da ton tai, bo qua.';
GO

IF OBJECT_ID('dbo.PhieuBanHangChiTiet', 'U') IS NULL
BEGIN
    CREATE TABLE PhieuBanHangChiTiet (
        ID             INT IDENTITY(1,1) PRIMARY KEY,
        PhieuBHID      INT NOT NULL FOREIGN KEY REFERENCES PhieuBanHang(PhieuBHID) ON DELETE CASCADE,
        MaHangID       INT NOT NULL FOREIGN KEY REFERENCES TheKhoHangHoa(MaHangID),
        MauSacID       INT NULL FOREIGN KEY REFERENCES MauSac(MauSacID),
        SoLuong        DECIMAL(14,2) NOT NULL,            -- theo DonVi ghi tren phieu (Cai / Ri)
        DonVi          NVARCHAR(20) NULL,
        SoLuongCai     INT NOT NULL DEFAULT 0,            -- quy ve CAI (tru ton + tinh tien theo cai)
        SoLuongQuyDoi  DECIMAL(14,2) NULL,                -- cot "DVT QUY DOI" cua mau Word
        DonViQuyDoi    NVARCHAR(20) NULL,
        GiaBanLe       DECIMAL(14,2) NOT NULL DEFAULT 0,  -- gia 1 CAI (lay tu TheKhoHangHoa.GiaBan)
        PhanTramCKShop DECIMAL(5,2) NOT NULL DEFAULT 0,
        GiaBan         DECIMAL(14,2) NOT NULL DEFAULT 0,  -- = GiaBanLe - GiaBanLe * %CK
        ThanhTien      DECIMAL(18,2) NOT NULL DEFAULT 0,  -- = GiaBan * SoLuongCai
        DonID          INT NULL FOREIGN KEY REFERENCES DonKhachDatHang(DonID),  -- neu lay tu don khach dat
        GhiChu         NVARCHAR(255) NULL
    );
    CREATE INDEX IX_PhieuBanHangChiTiet_Phieu ON PhieuBanHangChiTiet(PhieuBHID);
    PRINT 'Da tao bang PhieuBanHangChiTiet.';
END ELSE PRINT 'Bang PhieuBanHangChiTiet da ton tai, bo qua.';
GO

/* ---------------- 3. Phieu thu / Phieu chi ---------------- */
IF OBJECT_ID('dbo.PhieuThu', 'U') IS NULL
BEGIN
    CREATE TABLE PhieuThu (
        PhieuThuID   INT IDENTITY(1,1) PRIMARY KEY,
        SoPhieu      NVARCHAR(30) NOT NULL UNIQUE,        -- PT<yy><4 so>
        NgayThu      DATE NOT NULL,
        LoaiDoiTuong NVARCHAR(20) NOT NULL DEFAULT N'KhachHang',  -- KhachHang / Khac
        KhachHangID  INT NULL FOREIGN KEY REFERENCES KhachHang(KhachHangID),
        TenDoiTuong  NVARCHAR(150) NULL,                   -- ten khach (khoa nhom cong no) hoac nguoi nop
        TaiKhoanID   INT NULL FOREIGN KEY REFERENCES DanhMucTaiKhoan(TaiKhoanID),
        PhieuBHID    INT NULL FOREIGN KEY REFERENCES PhieuBanHang(PhieuBHID),  -- thu cho 1 phieu ban hang
        SoTien       DECIMAL(18,2) NOT NULL,
        HinhThuc     NVARCHAR(20) NOT NULL DEFAULT N'Tiền mặt',   -- Tiền mặt / Chuyển khoản
        DienGiai     NVARCHAR(500) NULL,
        NguoiTaoID   INT NULL FOREIGN KEY REFERENCES Users(UserID),
        CreatedAt    DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    CREATE INDEX IX_PhieuThu_Ngay ON PhieuThu(NgayThu);
    CREATE INDEX IX_PhieuThu_Khach ON PhieuThu(TenDoiTuong);
    PRINT 'Da tao bang PhieuThu.';
END ELSE PRINT 'Bang PhieuThu da ton tai, bo qua.';
GO

IF OBJECT_ID('dbo.PhieuChi', 'U') IS NULL
BEGIN
    CREATE TABLE PhieuChi (
        PhieuChiID   INT IDENTITY(1,1) PRIMARY KEY,
        SoPhieu      NVARCHAR(30) NOT NULL UNIQUE,        -- PC<yy><4 so>
        NgayChi      DATE NOT NULL,
        LoaiDoiTuong NVARCHAR(20) NOT NULL DEFAULT N'NhaCungCap', -- NhaCungCap / NhaGiaCong / NhanVien / Khac
        NCC_ID       INT NULL FOREIGN KEY REFERENCES NhaCungCap(NCC_ID),
        NhaGiaCongID INT NULL FOREIGN KEY REFERENCES NhaGiaCong(NhaGiaCongID),
        TenDoiTuong  NVARCHAR(150) NULL,
        TaiKhoanID   INT NULL FOREIGN KEY REFERENCES DanhMucTaiKhoan(TaiKhoanID),
        SoTien       DECIMAL(18,2) NOT NULL,
        HinhThuc     NVARCHAR(20) NOT NULL DEFAULT N'Tiền mặt',
        DienGiai     NVARCHAR(500) NULL,
        NguoiTaoID   INT NULL FOREIGN KEY REFERENCES Users(UserID),
        CreatedAt    DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    CREATE INDEX IX_PhieuChi_Ngay ON PhieuChi(NgayChi);
    PRINT 'Da tao bang PhieuChi.';
END ELSE PRINT 'Bang PhieuChi da ton tai, bo qua.';
GO

/* ---------------- 4. Dieu chinh cong no (nhap tay) ---------------- */
IF OBJECT_ID('dbo.CongNoDieuChinh', 'U') IS NULL
BEGIN
    CREATE TABLE CongNoDieuChinh (
        ID           INT IDENTITY(1,1) PRIMARY KEY,
        Ngay         DATE NOT NULL,
        LoaiDoiTuong NVARCHAR(20) NOT NULL,               -- KhachHang / NhaCungCap
        KhachHangID  INT NULL FOREIGN KEY REFERENCES KhachHang(KhachHangID),
        NCC_ID       INT NULL FOREIGN KEY REFERENCES NhaCungCap(NCC_ID),
        TenDoiTuong  NVARCHAR(150) NULL,
        SoTien       DECIMAL(18,2) NOT NULL,              -- DUONG = tang no phai tra/phai thu; AM = giam
        DienGiai     NVARCHAR(500) NULL,
        NguoiTaoID   INT NULL FOREIGN KEY REFERENCES Users(UserID),
        CreatedAt    DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    PRINT 'Da tao bang CongNoDieuChinh.';
END ELSE PRINT 'Bang CongNoDieuChinh da ton tai, bo qua.';
GO

/* ---------------- 5. Gan phieu ban hang vao don khach dat ---------------- */
IF COL_LENGTH('dbo.DonKhachDatHang', 'PhieuBHID') IS NULL
BEGIN
    ALTER TABLE dbo.DonKhachDatHang ADD PhieuBHID INT NULL
        FOREIGN KEY REFERENCES PhieuBanHang(PhieuBHID);
    PRINT 'Da them cot DonKhachDatHang.PhieuBHID.';
END ELSE PRINT 'Cot DonKhachDatHang.PhieuBHID da ton tai, bo qua.';
GO
/* TrangThai cua DonKhachDatHang la NVARCHAR khong co CHECK => them gia tri N'Đã xuất hàng'
   khong can sua rang buoc nao. */

/* ---------------- 6. Module + chuc nang + quyen ---------------- */
IF NOT EXISTS (SELECT 1 FROM Modules WHERE ModuleCode = N'CONGNO')
    INSERT INTO Modules (ModuleCode, TenModule, ThuTu) VALUES (N'CONGNO', N'Quản lý công nợ', 11);
GO
/* Chi seed DONG quyen (mac dinh TAT ca 0) cho cac nhom chua co - Admin bypass. Cap quyen that
   trong "Quản lý User -> Ma trận phân quyền". */
INSERT INTO Permissions (GroupID, ModuleID, CanView, CanCreate, CanEdit, CanDelete)
SELECT g.GroupID, m.ModuleID, 0, 0, 0, 0
FROM Groups g CROSS JOIN Modules m
WHERE m.ModuleCode = N'CONGNO'
  AND NOT EXISTS (SELECT 1 FROM Permissions p WHERE p.GroupID = g.GroupID AND p.ModuleID = m.ModuleID);
GO
MERGE ChucNang AS t
USING (VALUES
    ('CONGNO','phieuthu',  N'Phiếu thu', 1),
    ('CONGNO','phieuchi',  N'Phiếu chi', 2),
    ('CONGNO','congnokh',  N'Công nợ khách hàng', 3),
    ('CONGNO','congnoncc', N'Công nợ nhà cung cấp', 4),
    ('CONGNO','dieuchinh', N'Điều chỉnh công nợ', 5),
    ('KHOHANG','banhang',  N'Phiếu bán hàng', 5),
    ('DANHMUC','loaitaikhoan', N'Loại tài khoản', 20),
    ('DANHMUC','taikhoan',     N'Danh mục tài khoản', 21)
) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu)
ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
WHEN NOT MATCHED THEN INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu)
     VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu);
GO

/* ---------------- 7. Cau hinh mac dinh ---------------- */
MERGE CauHinhHeThong AS t
USING (VALUES ('VAT_MAC_DINH', N'0')) AS s (ConfigKey, ConfigValue)
  ON t.ConfigKey = s.ConfigKey
WHEN NOT MATCHED THEN INSERT (ConfigKey, ConfigValue) VALUES (s.ConfigKey, s.ConfigValue);
GO

PRINT '';
PRINT '=== MIGRATION v668 HOAN TAT ===';
PRINT '!! BUOC BAT BUOC TIEP THEO: cd backend && node utils/hoan_ton_don_cho_xu_ly.js  (chay thu)';
PRINT '   roi  node utils/hoan_ton_don_cho_xu_ly.js --ghi   de hoan ton cho cac don dang cho.';
PRINT '!! Sau do CAP QUYEN phan he "Quản lý công nợ" + cac chuc nang moi trong Ma tran phan quyen.';
GO
SET NOEXEC OFF;
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [70/81]  migration_v669.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [70/81] migration_v669.sql';
GO

/* ================================================================
   MIGRATION v6.24 — TAI KHOAN NGAN HANG + SO QUY (tien mat / ngan hang)
   ----------------------------------------------------------------
   1. DanhMucTaiKhoanNganHang: danh muc SO TAI KHOAN cua cong ty. Phieu thu / phieu chi chon
      hinh thuc "Chuyển khoản" thi chon them TK ngan hang nao -> biet tien vao/ra tai khoan nao.
   2. PhieuThu.TaiKhoanNHID / PhieuChi.TaiKhoanNHID: gan phieu vao 1 tai khoan ngan hang.
   3. SO QUY = so du dau ky + tong THU - tong CHI, tach rieng:
        - Quy TIEN MAT   : cac phieu HinhThuc = N'Tiền mặt'      (dau ky: CauHinhHeThong.QUY_TIEN_MAT_DAU_KY)
        - Quy NGAN HANG  : cac phieu HinhThuc = N'Chuyển khoản'  (dau ky: tung dong DanhMucTaiKhoanNganHang.SoDuDauKy)
      => KHONG tao bang so quy rieng: so quy luon TINH LAI tu chung tu, khong bao gio lech voi phieu.

   Chay 1 lan. IDEMPOTENT. YEU CAU: migration_v668.sql.
   ================================================================ */
USE QLNoiBo;
GO
IF DB_NAME() <> 'QLNoiBo'
BEGIN
    RAISERROR('KHONG ket noi duoc database QLNoiBo - dung migration.', 16, 1);
    SET NOEXEC ON;
END
GO

/* ---------------- 1. Danh muc tai khoan ngan hang ---------------- */
IF OBJECT_ID('dbo.DanhMucTaiKhoanNganHang', 'U') IS NULL
BEGIN
    CREATE TABLE DanhMucTaiKhoanNganHang (
        TaiKhoanNHID  INT IDENTITY(1,1) PRIMARY KEY,
        TenNganHang   NVARCHAR(150) NOT NULL,          -- vd: BIDV - CN Ha Dong
        SoTaiKhoan    NVARCHAR(50) NOT NULL,
        ChuTaiKhoan   NVARCHAR(150) NULL,
        ChiNhanh      NVARCHAR(150) NULL,
        SoDuDauKy     DECIMAL(18,2) NOT NULL DEFAULT 0,
        MacDinh       BIT NOT NULL DEFAULT 0,          -- 1 = tai khoan chon san khi lap phieu
        GhiChu        NVARCHAR(255) NULL,
        CreatedAt     DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    CREATE UNIQUE INDEX UX_TKNH_SoTaiKhoan ON DanhMucTaiKhoanNganHang(SoTaiKhoan);
    PRINT 'Da tao bang DanhMucTaiKhoanNganHang.';
END ELSE PRINT 'Bang DanhMucTaiKhoanNganHang da ton tai, bo qua.';
GO

/* ---------------- 2. Gan tai khoan ngan hang vao phieu thu / chi ---------------- */
IF COL_LENGTH('dbo.PhieuThu', 'TaiKhoanNHID') IS NULL
BEGIN
    ALTER TABLE dbo.PhieuThu ADD TaiKhoanNHID INT NULL
        FOREIGN KEY REFERENCES DanhMucTaiKhoanNganHang(TaiKhoanNHID);
    PRINT 'Da them cot PhieuThu.TaiKhoanNHID.';
END ELSE PRINT 'Cot PhieuThu.TaiKhoanNHID da ton tai, bo qua.';
GO
IF COL_LENGTH('dbo.PhieuChi', 'TaiKhoanNHID') IS NULL
BEGIN
    ALTER TABLE dbo.PhieuChi ADD TaiKhoanNHID INT NULL
        FOREIGN KEY REFERENCES DanhMucTaiKhoanNganHang(TaiKhoanNHID);
    PRINT 'Da them cot PhieuChi.TaiKhoanNHID.';
END ELSE PRINT 'Cot PhieuChi.TaiKhoanNHID da ton tai, bo qua.';
GO

/* ---------------- 3. Cau hinh so du dau ky quy tien mat ---------------- */
MERGE CauHinhHeThong AS t
USING (VALUES ('QUY_TIEN_MAT_DAU_KY', N'0')) AS s (ConfigKey, ConfigValue)
  ON t.ConfigKey = s.ConfigKey
WHEN NOT MATCHED THEN INSERT (ConfigKey, ConfigValue) VALUES (s.ConfigKey, s.ConfigValue);
GO

/* ---------------- 4. Chuc nang moi ---------------- */
MERGE ChucNang AS t
USING (VALUES
    ('CONGNO','soquy', N'Sổ quỹ tiền mặt / ngân hàng', 6),
    ('DANHMUC','taikhoannganhang', N'Tài khoản ngân hàng', 22)
) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu)
ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
WHEN NOT MATCHED THEN INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu)
     VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu);
GO

PRINT '';
PRINT '=== MIGRATION v669 HOAN TAT ===';
PRINT 'Nho: Danh muc -> Tai khoan ngan hang: khai cac STK + SO DU DAU KY.';
PRINT '     Quy tien mat dau ky: Danh muc -> Cau hinh he thong -> QUY_TIEN_MAT_DAU_KY.';
PRINT '     Cap quyen chuc nang "Sổ quỹ" cua phan he Quan ly cong no.';
GO
SET NOEXEC OFF;
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [71/81]  migration_v670.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [71/81] migration_v670.sql';
GO

/* ================================================================
   MIGRATION v6.25 — LOAI TAI KHOAN PHAN THEO PHIEU THU / PHIEU CHI
   ----------------------------------------------------------------
   Truoc day form Phieu thu va Phieu chi deu hien TAT CA tai khoan -> de chon nham
   (vd phieu thu lai chon "Chi mua vai"). Nay moi LOAI tai khoan co them cot LoaiPhieu:
        N'Thu'    -> chi hien khi lap PHIEU THU
        N'Chi'    -> chi hien khi lap PHIEU CHI
        N'Cả hai' -> hien o ca 2 (vd tai khoan trung gian, dieu chuyen quy)
   Suy ra tai khoan nao hien o phieu nao qua LOAI cua no (DanhMucTaiKhoan.LoaiTKID).

   Chay 1 lan. IDEMPOTENT. YEU CAU: migration_v668.sql.
   ================================================================ */
USE QLNoiBo;
GO
IF DB_NAME() <> 'QLNoiBo'
BEGIN
    RAISERROR('KHONG ket noi duoc database QLNoiBo - dung migration.', 16, 1);
    SET NOEXEC ON;
END
GO

IF COL_LENGTH('dbo.DanhMucLoaiTaiKhoan', 'LoaiPhieu') IS NULL
BEGIN
    ALTER TABLE dbo.DanhMucLoaiTaiKhoan
        ADD LoaiPhieu NVARCHAR(10) NOT NULL CONSTRAINT DF_LoaiTK_LoaiPhieu DEFAULT N'Chi';
    PRINT 'Da them cot DanhMucLoaiTaiKhoan.LoaiPhieu (mac dinh N''Chi'').';
END ELSE PRINT 'Cot LoaiPhieu da ton tai, bo qua.';
GO

/* Doan lai cho du lieu DA CO: ten bat dau bang "Thu" -> loai THU, con lai giu N'Chi'.
   Chi chay khi cot vua duoc them (tat ca dang la 'Chi' mac dinh) - khong ghi de lua chon nguoi dung. */
UPDATE DanhMucLoaiTaiKhoan
SET LoaiPhieu = N'Thu'
WHERE LoaiPhieu = N'Chi' AND (TenLoai LIKE N'Thu %' OR TenLoai LIKE N'Thu' OR TenLoai LIKE N'Thu_%');
GO

SELECT LoaiTKID, TenLoai, LoaiPhieu, TinhChiPhiKD FROM DanhMucLoaiTaiKhoan ORDER BY LoaiPhieu DESC, TenLoai;
GO

PRINT '';
PRINT '=== MIGRATION v670 HOAN TAT ===';
PRINT 'Kiem lai o Danh muc -> Loai tai khoan: cot "Dung cho phieu" (Thu / Chi / Ca hai).';
GO
SET NOEXEC OFF;
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [72/81]  migration_v671.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [72/81] migration_v671.sql';
GO

/* ================================================================
   MIGRATION v6.25.4 — 1 DONG PHIEU BAN HANG CO THE GOM NHIEU DON KHACH DAT
   ----------------------------------------------------------------
   Khi lay tu danh sach don dat: cung 1 KHACH, cung MA HANG + MAU nhung khach dat lam NHIEU LAN
   -> nay GOP thanh 1 DONG tren phieu (cong so luong), thay vi moi don 1 dong.
   Cot DonID cu (1 don/dong) VAN GIU de tuong thich nguoc; them DonIDs luu danh sach id cua ca nhom
   ("12,15,18") de khi HUY/XOA phieu he thong tra DUNG TAT CA cac don ve 'Cho xu ly'.

   Chay 1 lan. IDEMPOTENT. YEU CAU: migration_v668.sql.
   ================================================================ */
USE QLNoiBo;
GO
IF DB_NAME() <> 'QLNoiBo'
BEGIN
    RAISERROR('KHONG ket noi duoc database QLNoiBo - dung migration.', 16, 1);
    SET NOEXEC ON;
END
GO

IF COL_LENGTH('dbo.PhieuBanHangChiTiet', 'DonIDs') IS NULL
BEGIN
    ALTER TABLE dbo.PhieuBanHangChiTiet ADD DonIDs NVARCHAR(200) NULL;
    PRINT 'Da them cot PhieuBanHangChiTiet.DonIDs.';
END ELSE PRINT 'Cot DonIDs da ton tai, bo qua.';
GO

/* Du lieu cu: dong nao dang gan 1 don thi DonIDs = chinh don do (de code moi doc 1 duong duy nhat). */
UPDATE PhieuBanHangChiTiet
SET DonIDs = CAST(DonID AS NVARCHAR(200))
WHERE DonID IS NOT NULL AND DonIDs IS NULL;
GO

PRINT '';
PRINT '=== MIGRATION v671 HOAN TAT ===';
GO
SET NOEXEC OFF;
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [73/81]  migration_v672.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [73/81] migration_v672.sql';
GO

/* ================================================================================================
   MIGRATION v6.26 — PHAN HE "BAO CAO KINH DOANH"
   ------------------------------------------------------------------------------------------------
   Them 1 module moi (BAOCAO) voi 5 nhom bao cao:
       1. Ton kho hang hoa (thanh pham)      3. Ton kho phu kien       5. Ket qua kinh doanh (lai/lo)
       2. Ton kho vai                        4. Bao cao tai chinh

   BANG MOI DUY NHAT: GiaVonHangHoa
   ------------------------------------------------------------------------------------------------
   TAI SAO PHAI CO BANG NAY (dung nghiep vu ke toan):
     - Gia von phai duoc "CHOT" tai thoi diem ban, KHONG duoc doi hoi to. Neu bao cao goi thang
       ham tinhGiaThanh() cua lenh SX thi hom nay ai do them 1 dong chi phi chung -> lai/lo cua
       THANG TRUOC tu dong doi theo. Ke toan khong chap nhan dieu do.
     - Ma hang DAT NGOAI (LoaiHang = N'DatNgoai') khong co lenh SX nen khong co gia thanh -> phai
       khai tay, neu khong se tinh gia von = 0 va bao lai ao.
     - Toc do: tinhGiaThanh() chay ~10 truy van cho MOI lenh SX. Bao cao 50 ma hang = 500 truy van.
       Doc 1 bang nho thi tuc thi.
   => Man hinh "Ket qua kinh doanh" co nut "Lay gia thanh tu lenh SX" de NAP/CAP NHAT bang nay.

   Chay 1 lan. IDEMPOTENT (chay lai khong hong gi).
   YEU CAU: da chay migration_v665.sql (gia thanh) va migration_v668.sql (cong no).
   ================================================================================================ */
USE QLNoiBo;
GO
IF DB_NAME() <> 'QLNoiBo'
BEGIN
    RAISERROR('KHONG ket noi duoc database QLNoiBo - dung migration.', 16, 1);
    SET NOEXEC ON;
END
GO

/* ---------------- 1. Bang gia von hang hoa (chot theo tung ma hang) ---------------- */
IF OBJECT_ID('dbo.GiaVonHangHoa', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.GiaVonHangHoa (
        ID             INT IDENTITY(1,1) PRIMARY KEY,
        MaHangID       INT NOT NULL UNIQUE FOREIGN KEY REFERENCES TheKhoHangHoa(MaHangID) ON DELETE CASCADE,
        GiaVon         DECIMAL(18,2) NOT NULL DEFAULT 0,   -- gia von 1 CAI (cung don vi voi GiaBan)
        NguonGia       NVARCHAR(20) NOT NULL DEFAULT N'Lệnh SX',  -- N'Lệnh SX' / N'Khai tay'
        MaDHNguon      NVARCHAR(30) NULL,                  -- ma lenh SX da lay gia thanh (de doi chieu)
        NgayCapNhat    DATE NOT NULL DEFAULT CAST(SYSDATETIME() AS DATE),
        NguoiCapNhatID INT NULL FOREIGN KEY REFERENCES Users(UserID),
        GhiChu         NVARCHAR(255) NULL
    );
    PRINT 'Da tao bang GiaVonHangHoa.';
END ELSE PRINT 'Bang GiaVonHangHoa da ton tai, bo qua.';
GO

/* ================================================================================================
   2. SUA CO "TINH CHI PHI KD" CHO CAC KHOAN DA NAM TRONG GIA VON  — QUAN TRONG
   ------------------------------------------------------------------------------------------------
   Bao cao ket qua kinh doanh tinh:  LOI NHUAN = (Doanh thu - GIA VON) - CHI PHI KD
   Gia von = gia thanh lenh SX, DA GOM: vai + phu kien + gia cong ngoai + may nha lam + in theu
             + bo phan cat + chi phi chung cua lenh.
   => Neu tai khoan "Chi mua nguyen phu lieu" / "Chi gia cong / in theu" van de TinhChiPhiKD = 1 thi
      cung mot dong tien bi TRU HAI LAN (1 lan qua gia von, 1 lan qua chi phi KD) -> BAO LO AO dung
      bang so tien mua nguyen phu lieu trong ky.
   migration_v668 seed 2 loai nay = 1 (luc do chua co bao cao lai/lo) -> nay tat di.

   ⚠️ "Chi lương" GIU NGUYEN, phai tu quyet dinh: luong may/cat da nam trong gia thanh lenh SX,
      nhung luong van phong/quan ly thi khong. Neu dang tra chung 1 tai khoan thi nen TACH LAM 2
      loai tai khoan (Danh muc -> Loai tai khoan): "Chi luong san xuat" (TinhChiPhiKD = 0, vi da
      trong gia von) va "Chi luong quan ly" (TinhChiPhiKD = 1).
   ================================================================================================ */
UPDATE DanhMucLoaiTaiKhoan SET TinhChiPhiKD = 0,
       GhiChu = ISNULL(GhiChu, N'') + N' [v6.26: đã nằm trong giá vốn, không tính lại vào chi phí KD]'
WHERE TenLoai IN (N'Chi mua nguyên phụ liệu', N'Chi gia công / in thêu')
  AND TinhChiPhiKD = 1;
IF @@ROWCOUNT > 0
    PRINT 'Da TAT co "tinh chi phi KD" cho cac loai tai khoan thuoc GIA VON (tranh tru 2 lan).';
ELSE
    PRINT 'Cac loai tai khoan thuoc gia von da tat co tu truoc, bo qua.';
GO

/* ---------------- 3. Module + quyen + chuc nang ---------------- */
IF NOT EXISTS (SELECT 1 FROM Modules WHERE ModuleCode = N'BAOCAO')
    INSERT INTO Modules (ModuleCode, TenModule, ThuTu) VALUES (N'BAOCAO', N'Báo cáo kinh doanh', 12);
GO
/* Seed DONG quyen (mac dinh TAT ca 0) cho moi nhom chua co - Admin bypass.
   Cap quyen that trong "Quản lý User -> Ma trận phân quyền". */
INSERT INTO Permissions (GroupID, ModuleID, CanView, CanCreate, CanEdit, CanDelete)
SELECT g.GroupID, m.ModuleID, 0, 0, 0, 0
FROM Groups g CROSS JOIN Modules m
WHERE m.ModuleCode = N'BAOCAO'
  AND NOT EXISTS (SELECT 1 FROM Permissions p WHERE p.GroupID = g.GroupID AND p.ModuleID = m.ModuleID);
GO
MERGE ChucNang AS t
USING (VALUES
    ('BAOCAO','tonhanghoa', N'Tồn kho hàng hóa', 1),
    ('BAOCAO','tonvai',     N'Tồn kho vải', 2),
    ('BAOCAO','tonphukien', N'Tồn kho phụ kiện', 3),
    ('BAOCAO','taichinh',   N'Báo cáo tài chính', 4),
    ('BAOCAO','kinhdoanh',  N'Kết quả kinh doanh', 5),
    ('BAOCAO','giavon',     N'Khai giá vốn hàng hóa', 6)
) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu)
ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
WHEN NOT MATCHED THEN INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu)
     VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu);
GO

PRINT '';
PRINT '=== MIGRATION v672 HOAN TAT ===';
PRINT '!! BUOC TIEP THEO:';
PRINT '   1. Cap quyen phan he "Báo cáo kinh doanh" + 6 chuc nang trong Ma tran phan quyen.';
PRINT '   2. Vao Bao cao > Ket qua kinh doanh > nut "Lay gia thanh tu lenh SX" de nap gia von lan dau.';
PRINT '   3. Ma hang DAT NGOAI (khong co lenh SX) phai khai gia von tay o tab "Gia von hang hoa".';
GO
SET NOEXEC OFF;
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [74/81]  migration_v673.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [74/81] migration_v673.sql';
GO

/* ================================================================================================
   MIGRATION v6.31 — DANH MUC DON VI TINH LA NGUON DUY NHAT + BO CHUOI "Ri" KHOI PHEP TINH
   ------------------------------------------------------------------------------------------------
   VAN DE DANG CO:
     Chuoi 'Ri' bi GAI CUNG trong ~20 cho de quyet dinh CO NHAN/CHIA he so quy doi hay khong:
        banhang.js, khohang.js, public.js, baocao.js, common.js, module.khohang.js...
     Vi du: slSangCai() = (donVi.toLowerCase() === 'ri') ? soLuong * LoaiRi : soLuong
     => Ai khai don vi gop ten KHAC 'Ri' (Tá, Thùng, Lố...) thi he thong KHONG nhan he so
        -> TRU TON THIEU dung gap LoaiRi lan, KHONG bao loi gi ca.

   CACH CHUA (v6.31):
     Bo hoan toan viec so ten voi 'Ri'. Cau hoi dung phai la:
        "don vi nay CO PHAI la DON VI QUY DOI cua CHINH MA HANG DO khong?"
        tuc:  donVi == TheKhoHangHoa.DonViQuyDoi   ->  NHAN he so LoaiRi
     Cach nay von da duoc dung DUNG o qlsx.js (~dong 3187) tu lau — nay nhan rong ra toan he thong.
     Nho vay khai don vi gop ten gi cung chay dung, va du lieu cu (Ri) van y nguyen ket qua.

   BANG DANH MUC:
     DanhMucDonViTinh tro thanh NGUON DUY NHAT cho moi o chon don vi trong phan mem.
     Them cot LaDonViGop de danh dau "don vi nay gom nhieu don vi goc" (Ri, Tá, Thùng...) —
     dung cho GIAO DIEN goi y + canh bao, KHONG phai de tinh toan (tinh toan dua vao DonViQuyDoi
     cua tung ma hang nhu tren).

   Chay 1 lan. IDEMPOTENT.
   ================================================================================================ */
USE QLNoiBo;
GO
IF DB_NAME() <> 'QLNoiBo'
BEGIN
    RAISERROR('KHONG ket noi duoc database QLNoiBo - dung migration.', 16, 1);
    SET NOEXEC ON;
END
GO

/* ---------------- 1. Bang danh muc don vi tinh (tao neu chua co) ---------------- */
IF OBJECT_ID('dbo.DanhMucDonViTinh', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.DanhMucDonViTinh (
        DonViTinhID  INT IDENTITY(1,1) PRIMARY KEY,
        TenDonVi     NVARCHAR(30) NOT NULL UNIQUE,
        GhiChu       NVARCHAR(255) NULL
    );
    PRINT 'Da tao bang DanhMucDonViTinh.';
END
GO

/* ---------------- 2. Them cot phan loai + thu tu hien thi ---------------- */
IF COL_LENGTH('dbo.DanhMucDonViTinh', 'LaDonViGop') IS NULL
BEGIN
    ALTER TABLE dbo.DanhMucDonViTinh ADD LaDonViGop BIT NOT NULL
        CONSTRAINT DF_DMDVT_LaDonViGop DEFAULT 0;
    PRINT 'Da them cot DanhMucDonViTinh.LaDonViGop.';
END ELSE PRINT 'Cot LaDonViGop da ton tai, bo qua.';
GO
IF COL_LENGTH('dbo.DanhMucDonViTinh', 'ThuTu') IS NULL
BEGIN
    ALTER TABLE dbo.DanhMucDonViTinh ADD ThuTu INT NULL;
    PRINT 'Da them cot DanhMucDonViTinh.ThuTu.';
END ELSE PRINT 'Cot ThuTu da ton tai, bo qua.';
GO

/* ---------------- 3. Bo sung cac don vi DANG DUOC GO CUNG trong code nhung THIEU trong danh muc ----
   Neu khong bo sung, doi dropdown sang danh muc se LAM MAT cac lua chon dang dung
   (vd Yard o "Chi dinh vai SX", Bó/Túi/Thùng o "Tai lieu ky thuat").                              */
MERGE DanhMucDonViTinh AS t
USING (VALUES
    (N'Cái',    0,  1, NULL),
    (N'Bộ',     0,  2, N'Đơn vị gốc, xử lý y hệt Cái'),
    (N'Chiếc',  0,  3, NULL),
    (N'Đôi',    0,  4, NULL),
    (N'Mét',    0, 10, NULL),
    (N'Yard',   0, 11, NULL),
    (N'Kg',     0, 12, NULL),
    (N'Ri',     1, 20, N'Đơn vị GỘP: 1 Ri = <tỷ lệ quy đổi> đơn vị gốc'),
    (N'Tá',     1, 21, N'Đơn vị GỘP: 1 Tá = 12'),
    (N'Lố',     1, 22, N'Đơn vị GỘP'),
    (N'Cuộn',   1, 23, NULL),
    (N'Bó',     1, 24, NULL),
    (N'Túi',    1, 25, NULL),
    (N'Thùng',  1, 26, NULL),
    (N'Bao',    1, 27, NULL)
) AS s (TenDonVi, LaDonViGop, ThuTu, GhiChu)
ON t.TenDonVi = s.TenDonVi
WHEN NOT MATCHED THEN
    INSERT (TenDonVi, LaDonViGop, ThuTu, GhiChu) VALUES (s.TenDonVi, s.LaDonViGop, s.ThuTu, s.GhiChu);
GO

/* Danh dau lai LaDonViGop/ThuTu cho cac dong DA CO SAN tu truoc (seed cu chi co TenDonVi). */
UPDATE d SET d.LaDonViGop = s.LaDonViGop, d.ThuTu = ISNULL(d.ThuTu, s.ThuTu)
FROM DanhMucDonViTinh d
JOIN (VALUES
    (N'Cái',0,1),(N'Bộ',0,2),(N'Chiếc',0,3),(N'Đôi',0,4),
    (N'Mét',0,10),(N'Yard',0,11),(N'Kg',0,12),
    (N'Ri',1,20),(N'Tá',1,21),(N'Lố',1,22),(N'Cuộn',1,23),(N'Bó',1,24),(N'Túi',1,25),(N'Thùng',1,26),(N'Bao',1,27)
) AS s (TenDonVi, LaDonViGop, ThuTu) ON s.TenDonVi = d.TenDonVi;
PRINT 'Da cap nhat co "don vi gop" + thu tu hien thi.';
GO

/* Don vi nao DANG DUOC DUNG trong du lieu that ma CHUA co trong danh muc -> them vao, khong de mat. */
INSERT INTO DanhMucDonViTinh (TenDonVi, LaDonViGop, ThuTu, GhiChu)
SELECT dv, 0, 90, N'Tự thêm khi nâng cấp v6.31 (đang dùng trong dữ liệu)'
FROM (
    SELECT DISTINCT LTRIM(RTRIM(DonViCoBan)) AS dv FROM TheKhoHangHoa WHERE ISNULL(DonViCoBan,'') <> ''
    UNION SELECT DISTINCT LTRIM(RTRIM(DonViQuyDoi)) FROM TheKhoHangHoa WHERE ISNULL(DonViQuyDoi,'') <> ''
    UNION SELECT DISTINCT LTRIM(RTRIM(DonVi)) FROM DonKhachDatHang WHERE ISNULL(DonVi,'') <> ''
    UNION SELECT DISTINCT LTRIM(RTRIM(DonViCoBan)) FROM DanhMucPhuKien WHERE ISNULL(DonViCoBan,'') <> ''
    UNION SELECT DISTINCT LTRIM(RTRIM(DonViQuyDoi)) FROM DanhMucPhuKien WHERE ISNULL(DonViQuyDoi,'') <> ''
) x
WHERE NOT EXISTS (SELECT 1 FROM DanhMucDonViTinh d WHERE d.TenDonVi = x.dv);
IF @@ROWCOUNT > 0 PRINT 'Da tu them cac don vi dang dung trong du lieu nhung thieu trong danh muc.';
GO

/* ---------------- 4. Noi cot DonKhachDatHang.DonVi: NVARCHAR(10) -> NVARCHAR(30) ----------------
   Ten don vi trong danh muc dai toi 30 ky tu. Giu 10 thi khai "Thùng lớn" van duoc nhung
   "Cuộn 50 mét" (11 ky tu) se LOI TRUNCATE khi luu don. Cac bang khac da la 20-30 san.        */
IF COL_LENGTH('dbo.DonKhachDatHang', 'DonVi') < 60      -- NVARCHAR: 1 ky tu = 2 byte => 10 ky tu = 20
BEGIN
    /* Bo DEFAULT truoc khi doi kieu roi gan lai (SQL Server khong cho ALTER COLUMN khi con rang buoc). */
    DECLARE @df SYSNAME;
    SELECT @df = dc.name FROM sys.default_constraints dc
    JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
    WHERE dc.parent_object_id = OBJECT_ID('dbo.DonKhachDatHang') AND c.name = 'DonVi';
    IF @df IS NOT NULL EXEC('ALTER TABLE dbo.DonKhachDatHang DROP CONSTRAINT [' + @df + ']');

    ALTER TABLE dbo.DonKhachDatHang ALTER COLUMN DonVi NVARCHAR(30) NOT NULL;
    ALTER TABLE dbo.DonKhachDatHang ADD CONSTRAINT DF_DKDH_DonVi DEFAULT N'Cái' FOR DonVi;
    PRINT 'Da noi DonKhachDatHang.DonVi len NVARCHAR(30).';
END ELSE PRINT 'DonKhachDatHang.DonVi da du rong, bo qua.';
GO

/* ---------------- 5. Chuc nang cho man hinh danh muc (neu chua seed) ---------------- */
MERGE ChucNang AS t
USING (VALUES
    ('DANHMUC','donvitinh',  N'Đơn vị tính', 22),
    ('DANHMUC','donviquydoi', N'Đơn vị quy đổi', 23)
) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu)
ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
WHEN NOT MATCHED THEN INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu)
     VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu);
GO

/* ---------------- 6. Bao cao doi chieu sau khi chay ---------------- */
PRINT '';
PRINT '--- DANH MUC DON VI TINH SAU KHI CHAY ---';
SELECT TenDonVi, LaDonViGop AS [La don vi gop], ISNULL(ThuTu, 999) AS ThuTu, GhiChu
FROM DanhMucDonViTinh ORDER BY ISNULL(ThuTu, 999), TenDonVi;
GO
PRINT '';
PRINT '--- MA HANG THEO DON VI (de doi chieu) ---';
SELECT DonViCoBan AS [DVT chinh], DonViQuyDoi AS [DVT quy doi], COUNT(*) AS [So ma hang],
       MIN(LoaiRi) AS [Ty le nho nhat], MAX(LoaiRi) AS [Ty le lon nhat]
FROM TheKhoHangHoa GROUP BY DonViCoBan, DonViQuyDoi ORDER BY COUNT(*) DESC;
GO

/* ================================================================================================
   7. CHAN DOAN — DOI CHIEU TRUOC/SAU KHI DOI QUY TAC  (CHI DOC, KHONG SUA GI)
   ------------------------------------------------------------------------------------------------
   Quy tac CU:  don vi co ten = 'Ri'                      -> nhan he so LoaiRi
   Quy tac MOI: don vi = DonViQuyDoi cua CHINH ma hang do  -> nhan he so LoaiRi
   Voi du lieu chuan (DonViQuyDoi = N'Ri') thi HAI QUY TAC CHO KET QUA Y HET NHAU.
   3 truy van duoi liet ke DUNG nhung dong se DIEN GIAI KHAC di. Rong = khong anh huong gi.
   ================================================================================================ */
PRINT '';
PRINT '=== [1/3] MA HANG THIEU "DVT quy doi" (co ty le > 1 nhung khong khai quy doi) ===';
PRINT '     -> Don ghi don vi "Ri" cua nhung ma nay se KHONG con duoc nhan he so. Phai khai bo sung.';
SELECT MaHang, TenHang, DonViCoBan AS [DVT chinh], DonViQuyDoi AS [DVT quy doi], LoaiRi AS [Ty le]
FROM TheKhoHangHoa
WHERE LoaiRi > 1 AND ISNULL(LTRIM(RTRIM(DonViQuyDoi)), N'') = N''
ORDER BY MaHang;
GO

PRINT '';
PRINT '=== [2/3] MA HANG co "DVT quy doi" KHAC N''Ri'' ===';
PRINT '     -> Don cu ghi "Ri" cua nhung ma nay: quy tac CU nhan he so, quy tac MOI thi KHONG.';
SELECT h.MaHang, h.TenHang, h.DonViCoBan AS [DVT chinh], h.DonViQuyDoi AS [DVT quy doi], h.LoaiRi AS [Ty le],
       (SELECT COUNT(*) FROM DonKhachDatHang o
        WHERE o.MaHangID = h.MaHangID AND LTRIM(RTRIM(o.DonVi)) = N'Ri') AS [So don dang ghi "Ri"]
FROM TheKhoHangHoa h
WHERE h.LoaiRi > 1 AND ISNULL(LTRIM(RTRIM(h.DonViQuyDoi)), N'') NOT IN (N'', N'Ri')
ORDER BY h.MaHang;
GO

PRINT '';
PRINT '=== [3/3] DON KHACH DAT co don vi KHONG khop ca DVT chinh lan DVT quy doi cua ma hang ===';
PRINT '     -> Day la cac dong DIEN GIAI SE DOI. Trang thai "Da xuat hang" thi ton da tru xong, khong doi.';
SELECT o.DonID, o.ThoiGian, o.TenKhach, h.MaHang, o.SoLuongDat, o.DonVi AS [Don vi tren don],
       h.DonViCoBan AS [DVT chinh], h.DonViQuyDoi AS [DVT quy doi], h.LoaiRi AS [Ty le], o.TrangThai
FROM DonKhachDatHang o
JOIN TheKhoHangHoa h ON h.MaHangID = o.MaHangID
WHERE LTRIM(RTRIM(o.DonVi)) <> LTRIM(RTRIM(ISNULL(h.DonViCoBan, N'Cái')))
  AND LTRIM(RTRIM(o.DonVi)) <> LTRIM(RTRIM(ISNULL(h.DonViQuyDoi, N'')))
ORDER BY o.TrangThai, o.DonID DESC;
GO

PRINT '';
PRINT '=== MIGRATION v673 HOAN TAT ===';
PRINT '!! MIGRATION NAY KHONG SUA MOT SO LIEU TON KHO NAO (khong dong vao TheKhoChiTietMau).';
PRINT '!! Neu ca 3 truy van chan doan tren deu TRONG => doi quy tac khong lam doi bat ky con so nao.';
PRINT '!! Neu co dong -> khai bo sung "DVT quy doi" cho cac ma do TRUOC khi copy code v6.31.';
GO
SET NOEXEC OFF;
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [75/81]  migration_v674.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [75/81] migration_v674.sql';
GO

/* ============================================================================
   migration_v674 — v6.43: Ra lệnh SX ghi TÊN KHÁCH HÀNG TỰ DO
   ----------------------------------------------------------------------------
   Yêu cầu: ô Khách hàng ở form Ra lệnh sản xuất cho GÕ TỰ DO, tên gõ vào
   KHÔNG được thêm vào Danh mục khách hàng — chỉ hiện ở chính lệnh đó và trên
   các bản in.

   Vì vậy thêm MỘT cột chữ riêng, tách hẳn khỏi khóa nối KhachHangID:
     - Gõ trùng tên một khách CÓ trong danh mục  -> vẫn lưu KhachHangID như cũ,
       cột chữ để trống. Công nợ / lọc theo khách không mất liên kết nào.
     - Gõ tên KHÔNG có trong danh mục            -> KhachHangID = NULL, tên nằm
       ở cột chữ này. Danh mục khách hàng không bị đẻ thêm bản ghi rác.

   Mọi câu đọc lệnh SX đổi sang lấy tên hiển thị theo thứ tự:
       tên tự do (nếu có)  ->  tên trong danh mục
   nên tất cả danh sách và bản in tự hiện đúng, không phải sửa từng nơi.

   CHẠY 1 LẦN. Chạy lại không sao (đã kiểm tra tồn tại cột).
   ============================================================================ */

SET NOCOUNT ON;

IF COL_LENGTH('DonHangSanXuat', 'TenKhachHangTuDo') IS NULL
BEGIN
    ALTER TABLE DonHangSanXuat ADD TenKhachHangTuDo NVARCHAR(200) NULL;
    PRINT N'[v674] Da them cot DonHangSanXuat.TenKhachHangTuDo.';
END
ELSE
    PRINT N'[v674] Cot DonHangSanXuat.TenKhachHangTuDo da co - bo qua.';
GO

/* --- Kiem tra nhanh sau khi chay -------------------------------------------
   So lenh dang dung ten tu do (sau khi nguoi dung bat dau go) va so lenh van
   noi voi danh muc. Chay xong lan dau thi cot tu do con trong het la dung. */
SELECT
    N'Lenh co ten khach TU DO'      AS Loai,
    COUNT(*)                        AS SoLuong
FROM DonHangSanXuat
WHERE NULLIF(LTRIM(RTRIM(TenKhachHangTuDo)), '') IS NOT NULL
UNION ALL
SELECT
    N'Lenh noi Danh muc khach hang',
    COUNT(*)
FROM DonHangSanXuat
WHERE KhachHangID IS NOT NULL
UNION ALL
SELECT
    N'Lenh CHUA co khach nao',
    COUNT(*)
FROM DonHangSanXuat
WHERE KhachHangID IS NULL
  AND NULLIF(LTRIM(RTRIM(TenKhachHangTuDo)), '') IS NULL;
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [76/81]  migration_v675.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [76/81] migration_v675.sql';
GO

/* ============================================================================
   migration_v675 — v6.54: PHIẾU THU "CHUYỂN THẲNG" (không qua quỹ)
   ----------------------------------------------------------------------------
   Nghiệp vụ: khách trả tiền nhưng chuyển THẲNG cho nhà cung cấp, hoặc trả hộ
   một khoản chi phí. Tiền không hề đi qua quỹ của mình.

   Cách ghi (đã chốt với người dùng):
     1 phiếu thu  (giảm công nợ KHÁCH)
   + 1 phiếu chi  (giảm công nợ NCC, hoặc ghi vào loại chi phí) — TỰ SINH
   Hai phiếu liên kết với nhau, cùng ngày, cùng số tiền, cùng hình thức
   'Chuyển thẳng'. Sổ quỹ cộng phiếu thu rồi trừ phiếu chi -> SỐ DƯ KHÔNG ĐỔI,
   mà vẫn có đủ chứng từ hai đầu để đối chiếu.

   Vì sao KHÔNG chọn cách "1 phiếu thu, đánh dấu không qua quỹ":
   công nợ NCC đang tính từ phiếu chi (routes/congno.js: congNoNCC). Nếu khoản
   này chỉ nằm ở phiếu thu thì phải sửa thêm ở mọi chỗ đọc công nợ NCC, sổ quỹ,
   báo cáo tài chính — sót một chỗ là lệch mà không ai biết.

   CHẠY 1 LẦN. Chạy lại không sao (đã kiểm tra tồn tại cột).
   ============================================================================ */

SET NOCOUNT ON;

/* Khóa liên kết 2 chiều: từ phiếu thu tìm ra phiếu chi đi kèm và ngược lại.
   Có cả 2 chiều để khi HỦY/XÓA phiếu nào cũng tìm được phiếu kia ngay, không
   phải quét cả bảng. */
IF COL_LENGTH('PhieuThu', 'PhieuChiKemID') IS NULL
BEGIN
    ALTER TABLE PhieuThu ADD PhieuChiKemID INT NULL;
    PRINT N'[v675] Da them PhieuThu.PhieuChiKemID.';
END
ELSE PRINT N'[v675] PhieuThu.PhieuChiKemID da co - bo qua.';
GO

IF COL_LENGTH('PhieuChi', 'PhieuThuKemID') IS NULL
BEGIN
    ALTER TABLE PhieuChi ADD PhieuThuKemID INT NULL;
    PRINT N'[v675] Da them PhieuChi.PhieuThuKemID.';
END
ELSE PRINT N'[v675] PhieuChi.PhieuThuKemID da co - bo qua.';
GO

/* --- Kiem tra nhanh sau khi chay ------------------------------------------ */
SELECT N'Cap phieu thu-chi CHUYEN THANG' AS Loai, COUNT(*) AS SoLuong
FROM PhieuThu WHERE PhieuChiKemID IS NOT NULL
UNION ALL
SELECT N'Phieu chi MO COI (tro toi phieu thu khong con)', COUNT(*)
FROM PhieuChi c
WHERE c.PhieuThuKemID IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM PhieuThu t WHERE t.PhieuThuID = c.PhieuThuKemID);
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [77/81]  migration_v676.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [77/81] migration_v676.sql';
GO

/* ================================================================================================
   migration_v676.sql   (v6.66)
   1) PHIEU NHAP LAI  - nhap ve hang khach TRA LAI, GIAM cong no khach hang.
   2) TRA HANG NHA CUNG CAP - phieu XUAT kho vai / phu kien co the danh dau la tra ve NCC,
      GIAM cong no phai tra cho NCC do.

   VI SAO PHIEU NHAP LAI DUNG BANG RIENG (khong nhet vao PhieuBanHang voi so am):
     - So phieu rieng (NL26001) de nguoi dung khong nham voi phieu ban (PX26001).
     - Bao cao doanh thu dang SUM thang tren PhieuBanHang; nhet so am vao do se lam moi bao cao
       cu doi nghia im lang. Bang rieng thi bao cao cu giu nguyen ket qua, muon tru thi tru co y thuc.

   TON KHO: phieu nhap lai HOAN TON = TheKhoChiTietMau.XuatCai -= SoLuong(don vi chinh).
     KHONG cong vao NhapCai - NhapCai la so da nhap tu san xuat, cong vao do se lam sai bao cao nhap.

   CONG NO KHACH: TongThanhToan cua phieu nhap lai duoc TRU vao cong no. Phai sua DONG BO 3 cho
   (repo da tung bi lech vi co 2 ban tinh cong no song song):
     - congno.js  congNoKhachHang()   (bang tong hop)
     - congno.js  soChiTietKH()       (so chi tiet)
     - banhang.js phan "cong no truoc phieu" in cuoi phieu ban hang
   ================================================================================================ */

/* ---------------- 1. PHIEU NHAP LAI (hang khach tra) ---------------- */
IF OBJECT_ID('PhieuNhapLai', 'U') IS NULL
BEGIN
  CREATE TABLE PhieuNhapLai (
    PhieuNLID       INT IDENTITY(1,1) PRIMARY KEY,
    SoPhieu         NVARCHAR(30)  NOT NULL UNIQUE,      -- NL + yy + 3 so, vd NL26001
    NgayNhap        DATE          NOT NULL,
    KhachHangID     INT           NULL,
    TenKhach        NVARCHAR(150) NOT NULL,             -- nhom cong no theo TEN (giong PhieuBanHang)
    SDT             NVARCHAR(30)  NULL,
    DiaChi          NVARCHAR(255) NULL,
    -- Phieu XUAT goc. NULL = tu tim ma hang (backend van lay gia tu lan ban gan nhat cua khach do).
    PhieuBHID       INT           NULL,
    PhanTramCKNPP   DECIMAL(5,2)  NULL DEFAULT 0,
    PhanTramVAT     DECIMAL(5,2)  NULL DEFAULT 0,
    TongTienHang    DECIMAL(18,2) NULL DEFAULT 0,
    TienCKNPP       DECIMAL(18,2) NULL DEFAULT 0,
    TienTruocVAT    DECIMAL(18,2) NULL DEFAULT 0,
    TienVAT         DECIMAL(18,2) NULL DEFAULT 0,
    TongThanhToan   DECIMAL(18,2) NULL DEFAULT 0,       -- so TRU vao cong no khach
    TongSLCai       INT           NULL DEFAULT 0,
    LyDo            NVARCHAR(255) NULL,                 -- loi hang / sai mau / khach doi y...
    TrangThai       NVARCHAR(20)  NOT NULL DEFAULT N'Hoàn thành',   -- Hoàn thành / Đã hủy
    GhiChu          NVARCHAR(500) NULL,
    NguoiTaoID      INT           NULL,
    CreatedAt       DATETIME2     NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT FK_PhieuNhapLai_Khach  FOREIGN KEY (KhachHangID) REFERENCES KhachHang(KhachHangID),
    CONSTRAINT FK_PhieuNhapLai_PhieuBH FOREIGN KEY (PhieuBHID)  REFERENCES PhieuBanHang(PhieuBHID),
    CONSTRAINT FK_PhieuNhapLai_User   FOREIGN KEY (NguoiTaoID)  REFERENCES Users(UserID)
  );
  CREATE INDEX IX_PhieuNhapLai_Khach ON PhieuNhapLai(TenKhach);
  CREATE INDEX IX_PhieuNhapLai_Ngay  ON PhieuNhapLai(NgayNhap);
  PRINT '  + Da tao bang PhieuNhapLai';
END
ELSE PRINT '  = PhieuNhapLai da co, bo qua';
GO

IF OBJECT_ID('PhieuNhapLaiChiTiet', 'U') IS NULL
BEGIN
  CREATE TABLE PhieuNhapLaiChiTiet (
    ID              INT IDENTITY(1,1) PRIMARY KEY,
    PhieuNLID       INT           NOT NULL,
    MaHangID        INT           NOT NULL,
    MauSacID        INT           NULL,
    SoLuong         DECIMAL(14,2) NOT NULL,
    DonVi           NVARCHAR(20)  NULL,
    SoLuongCai      INT           NULL,                 -- quy ve CAI: dung cho TIEN va ban in
    SoLuongQuyDoi   DECIMAL(14,2) NULL,
    DonViQuyDoi     NVARCHAR(20)  NULL,
    -- Gia KHOA CUNG theo phieu xuat goc (yeu cau nguoi dung): tra lai dung so da ghi no.
    GiaBanLe        DECIMAL(14,2) NULL,
    PhanTramCKShop  DECIMAL(5,2)  NULL,
    GiaBan          DECIMAL(14,2) NULL,
    ThanhTien       DECIMAL(18,2) NULL,
    -- Dong goc tren phieu ban hang - de doi chieu va chan tra qua so da ban.
    PhieuBHChiTietID INT          NULL,
    GhiChu          NVARCHAR(255) NULL,
    CONSTRAINT FK_PNLCT_Phieu  FOREIGN KEY (PhieuNLID) REFERENCES PhieuNhapLai(PhieuNLID) ON DELETE CASCADE,
    CONSTRAINT FK_PNLCT_MaHang FOREIGN KEY (MaHangID)  REFERENCES TheKhoHangHoa(MaHangID),
    CONSTRAINT FK_PNLCT_Mau    FOREIGN KEY (MauSacID)  REFERENCES MauSac(MauSacID)
  );
  CREATE INDEX IX_PhieuNhapLaiChiTiet_Phieu ON PhieuNhapLaiChiTiet(PhieuNLID);
  PRINT '  + Da tao bang PhieuNhapLaiChiTiet';
END
ELSE PRINT '  = PhieuNhapLaiChiTiet da co, bo qua';
GO

/* ---------------- 2. TRA HANG NHA CUNG CAP ----------------
   PHU KIEN: bang PhieuPhuKien DA CO san NCC_ID (migration_v4) - chi can them co LaTraNCC.
   VAI:      bang PhieuXuatVai CHUA co NCC_ID - phieu xuat vai truoc gio chi xuat cho san xuat.
   Don gia de giam no:
     - Vai:      lay VaiCay.DonGiaNhap cua chinh cay do -> khong can nguoi dung go, khong lech.
     - Phu kien: PhieuPhuKienChiTiet.DonGia (cot da co, form Xuat truoc gio khong gui) -> khi tich
                 "Tra NCC" thi form mo cot don gia, dien san gia tu phieu NHAP gan nhat cua NCC do. */
IF COL_LENGTH('PhieuXuatVai', 'LaTraNCC') IS NULL
BEGIN
  ALTER TABLE PhieuXuatVai ADD LaTraNCC BIT NOT NULL DEFAULT 0;
  PRINT '  + PhieuXuatVai.LaTraNCC';
END
ELSE PRINT '  = PhieuXuatVai.LaTraNCC da co';
GO

IF COL_LENGTH('PhieuXuatVai', 'NCC_ID') IS NULL
BEGIN
  ALTER TABLE PhieuXuatVai ADD NCC_ID INT NULL;
  PRINT '  + PhieuXuatVai.NCC_ID';
END
ELSE PRINT '  = PhieuXuatVai.NCC_ID da co';
GO

IF COL_LENGTH('PhieuXuatVai', 'NCC_ID') IS NOT NULL
   AND OBJECT_ID('FK_PhieuXuatVai_NCC', 'F') IS NULL
   AND OBJECT_ID('NhaCungCap', 'U') IS NOT NULL
BEGIN
  ALTER TABLE PhieuXuatVai ADD CONSTRAINT FK_PhieuXuatVai_NCC
    FOREIGN KEY (NCC_ID) REFERENCES NhaCungCap(NCC_ID);
  PRINT '  + FK PhieuXuatVai.NCC_ID -> NhaCungCap';
END
GO

IF COL_LENGTH('PhieuPhuKien', 'LaTraNCC') IS NULL
BEGIN
  ALTER TABLE PhieuPhuKien ADD LaTraNCC BIT NOT NULL DEFAULT 0;
  PRINT '  + PhieuPhuKien.LaTraNCC';
END
ELSE PRINT '  = PhieuPhuKien.LaTraNCC da co';
GO

/* ---------------- 3. Chuc nang / phan quyen ----------------
   Key PHAI trung voi key tab o frontend getTabs() (module.khohang.js) - effectivePerm tra theo
   'KHOHANG:' + activeTab. Dat sai key = tab luon bi coi la khong co quyen. */
MERGE ChucNang AS t
USING (VALUES
    ('KHOHANG','nhaplai', N'Phiếu nhập lại (khách trả)', 6)
) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu)
ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
WHEN NOT MATCHED THEN INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu)
     VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu);
GO

PRINT '';
PRINT '=== migration_v676 XONG ===';
PRINT 'NHO: vao Phan quyen -> cap chuc nang KHOHANG/nhaplai cho cac nhom can dung,';
PRINT '     neu khong tab "Phieu nhap lai" se khong hien ra.';
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [78/81]  migration_v677.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [78/81] migration_v677.sql';
GO

/* ================================================================================================
   migration_v677.sql   (v6.67)
   DASHBOARD KINH DOANH - trang hien NGAY khi dang nhap cho nguoi duoc phan quyen.
   Noi dung: doanh thu + tinh hinh cong no cua NHUNG KHACH HANG DUOC CHON de theo doi.

   KHONG co bang du lieu moi: dashboard chi DOC lai PhieuBanHang / PhieuThu / PhieuNhapLai /
   CongNoDieuChinh - dung y het nguon ma man "Cong no khach hang" dang dung, nen hai man khong
   the ra hai con so khac nhau.
   Danh sach "khach theo doi" luu tren MAY NGUOI DUNG (localStorage), moi nguoi mot danh sach,
   nen cung khong can bang.

   Chi can THEM MODULE de co cho cap quyen.
   ================================================================================================ */

IF NOT EXISTS (SELECT 1 FROM Modules WHERE ModuleCode = N'DASHBOARD')
    INSERT INTO Modules (ModuleCode, TenModule, ThuTu) VALUES (N'DASHBOARD', N'Dashboard kinh doanh', 0);
GO

/* Seed DONG quyen (mac dinh TAT ca 0) cho moi nhom chua co - Admin bypass.
   => Sau khi chay migration, KHONG AI thay dashboard cho toi khi vao
      "Quan ly User -> Ma tran phan quyen" bat quyen Xem cho nhom can dung. */
INSERT INTO Permissions (GroupID, ModuleID, CanView, CanCreate, CanEdit, CanDelete)
SELECT g.GroupID, m.ModuleID, 0, 0, 0, 0
FROM Groups g CROSS JOIN Modules m
WHERE m.ModuleCode = N'DASHBOARD'
  AND NOT EXISTS (SELECT 1 FROM Permissions p WHERE p.GroupID = g.GroupID AND p.ModuleID = m.ModuleID);
GO

PRINT '';
PRINT '=== migration_v677 XONG ===';
PRINT 'NHO: Quan ly User -> Ma tran phan quyen -> bat CanView cho module DASHBOARD,';
PRINT '     khong thi dang nhap van vao trang chu cu (dung nhu thiet ke: khong co quyen thi khong doi gi).';
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [79/81]  migration_v678.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [79/81] migration_v678.sql';
GO

/* ================================================================================================
   migration_v678.sql   (v6.68)
   CAU HINH RIENG CUA TUNG NGUOI DUNG - dung dau tien cho "khach theo doi tren dashboard".

   VI SAO KHONG DE localStorage NUA (v6.67 dang de o do):
     localStorage gan voi TUNG TRINH DUYET TREN TUNG MAY. Doi may, doi trinh duyet, xoa cache hay
     dung che do an danh la danh sach bien mat -> nguoi dung phai chon lai. Yeu cau la "chi chon 1
     lan", nen phai luu theo TAI KHOAN o may chu.

   Bang dung CHUNG cho moi cau hinh ca nhan ve sau (khoa tu do), khong phai moi thu lai them 1 bang:
     Khoa = 'dashboard_khach_theo_doi'  ->  GiaTri = JSON mang ten khach
   ================================================================================================ */

IF OBJECT_ID('CauHinhNguoiDung', 'U') IS NULL
BEGIN
  CREATE TABLE CauHinhNguoiDung (
    UserID    INT           NOT NULL,
    Khoa      NVARCHAR(60)  NOT NULL,
    GiaTri    NVARCHAR(MAX) NULL,          -- luu JSON cho linh hoat
    UpdatedAt DATETIME2     NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT PK_CauHinhNguoiDung PRIMARY KEY (UserID, Khoa),
    CONSTRAINT FK_CauHinhNguoiDung_User FOREIGN KEY (UserID) REFERENCES Users(UserID) ON DELETE CASCADE
  );
  PRINT '  + Da tao bang CauHinhNguoiDung';
END
ELSE PRINT '  = CauHinhNguoiDung da co, bo qua';
GO

PRINT '';
PRINT '=== migration_v678 XONG ===';
PRINT 'Dashboard: danh sach khach theo doi nay luu theo TAI KHOAN, chon 1 lan la xong,';
PRINT 'dang nhap o may nao cung thay danh sach do.';
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [80/81]  migration_v679.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [80/81] migration_v679.sql';
GO

/* ================================================================================================
   migration_v679.sql   (v6.71)
   CONG KHAI TUNG MA HANG LEN CATALOGUE.

   TRUOC DAY: bat/tat cong khai chi lam duoc theo CA DANH MUC (TheKhoDanhMuc.CongKhai - v5.62).
   Ca danh muc bat len la MOI ma hang con ton deu hien ra cho khach xem. Muon giau 1 ma (hang mau,
   hang de rieng cho 1 khach, hang loi...) thi khong co cach nao ngoai viec chuyen no sang danh muc
   khac hoac cho ton ve 0.

   NAY: them cong tac RIENG cho tung ma hang. Ma hang hien tren catalogue khi VA CHI KHI:
        TheKhoDanhMuc.CongKhai = 1   VA   TheKhoHangHoa.CongKhai = 1
   Cong tac danh muc van la cong tac TONG - tat danh muc thi ca danh muc bien mat, khong ma nao lot.

   ⚠️ MAC DINH = 1 (HIEN), KHONG phai 0.
   Neu de 0 thi ngay sau khi chay migration, TOAN BO hang dang ban tren catalogue bien mat mot luc
   ma khong ai kip biet. De 1 thi khong co gi doi, roi ai muon giau ma nao thi tat ma do.
   Rieng ma TAO MOI tu v6.71 cung mac dinh HIEN (dung thoi quen cu), nguoi lap the tu tat neu can.
   ================================================================================================ */

IF COL_LENGTH('TheKhoHangHoa', 'CongKhai') IS NULL
BEGIN
  ALTER TABLE TheKhoHangHoa ADD CongKhai BIT NOT NULL CONSTRAINT DF_TheKhoHangHoa_CongKhai DEFAULT 1;
  PRINT '  + Da them TheKhoHangHoa.CongKhai (mac dinh 1 = HIEN tren catalogue)';
END
ELSE PRINT '  = TheKhoHangHoa.CongKhai da co, bo qua';
GO

PRINT '';
PRINT '=== migration_v679 XONG ===';
PRINT 'Khong co gi doi ngay: moi ma hang van HIEN nhu truoc.';
PRINT 'Vao The kho hang hoa -> Sua ma hang -> bo tich "Hien tren catalogue" de giau tung ma.';
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
/* [81/81]  migration_v680.sql  */
//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '>>> [81/81] migration_v680.sql';
GO

/* ================================================================================================
   migration_v680.sql   (v6.74)
   PHAN HE "DOI SOAT NGAN HANG" - khach chuyen khoan -> TU KHOP vao cong no -> TU SINH PHIEU THU.
   (Y tuong tham khao GPMPay: keo giao dich ngan hang ve, doi soat tu dong, canh bao lech.)

   VI SAO KHONG GOI THANG API NGAN HANG:
     Open Banking API cua ngan hang VN phai co HOP DONG rieng voi tung ngan hang, khong phai cu viet
     code la goi duoc. Nen phan he nay thiet ke 3 DUONG NAP giao dich, dung chung MOT bo may doi soat:
       1. NHAP SAO KE (Excel/CSV tai tu Internet Banking)  -> chay duoc NGAY, khong phu thuoc ai.
       2. WEBHOOK tu dich vu trung gian (SePay/Casso/GPMPay...) -> gan URL la co real-time.
       3. GO TAY 1 giao dich                                -> cho truong hop le.
     Doi bo may doi soat thi ca 3 duong cung doi theo - khong co chuyen moi duong mot kieu khop.

   MA DOI SOAT: moi phieu ban hang co mot ma de khach ghi vao NOI DUNG CHUYEN KHOAN (mac dinh chinh
   la SoPhieu, vd PX26001). Khop theo ma nay la chac chan nhat; khong co ma thi moi do sang ten + so tien.
   ================================================================================================ */

/* ---------------- 1. Tai khoan ngan hang cua cong ty ---------------- */
IF OBJECT_ID('BankTaiKhoan', 'U') IS NULL
BEGIN
  CREATE TABLE BankTaiKhoan (
    BankTKID     INT IDENTITY(1,1) PRIMARY KEY,
    MaNganHang   NVARCHAR(20)  NOT NULL,        -- ma VietQR: VCB, TCB, MB, BIDV, ICB, ACB...
    TenNganHang  NVARCHAR(100) NOT NULL,
    SoTaiKhoan   NVARCHAR(40)  NOT NULL,
    ChuTaiKhoan  NVARCHAR(150) NOT NULL,
    -- Tai khoan ke toan tuong ung trong DanhMucTaiKhoan -> phieu thu sinh ra ghi dung tai khoan.
    TaiKhoanID   INT           NULL,
    DangDung     BIT           NOT NULL DEFAULT 1,
    MacDinh      BIT           NOT NULL DEFAULT 0,   -- tai khoan hien QR mac dinh tren phieu ban hang
    GhiChu       NVARCHAR(255) NULL,
    CreatedAt    DATETIME2     NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT UQ_BankTaiKhoan UNIQUE (MaNganHang, SoTaiKhoan),
    CONSTRAINT FK_BankTaiKhoan_TK FOREIGN KEY (TaiKhoanID) REFERENCES DanhMucTaiKhoan(TaiKhoanID)
  );
  PRINT '  + Da tao bang BankTaiKhoan';
END
ELSE PRINT '  = BankTaiKhoan da co, bo qua';
GO

/* ---------------- 2. Giao dich ngan hang (sao ke) ---------------- */
IF OBJECT_ID('BankGiaoDich', 'U') IS NULL
BEGIN
  CREATE TABLE BankGiaoDich (
    BankGDID     INT IDENTITY(1,1) PRIMARY KEY,
    BankTKID     INT           NOT NULL,
    NgayGD       DATE          NOT NULL,
    ThoiGian     DATETIME2     NULL,
    SoTien       DECIMAL(18,2) NOT NULL,        -- DUONG = tien VAO; AM = tien RA
    NoiDung      NVARCHAR(500) NULL,            -- noi dung chuyen khoan (cho khop ma phieu)
    SoThamChieu  NVARCHAR(100) NULL,            -- ma GD cua ngan hang
    /* KHOA CHONG TRUNG: nhap lai cung mot file sao ke 2 lan KHONG duoc tao 2 giao dich.
       Ghep tu (tai khoan + ngay + so tien + noi dung + so tham chieu) roi bam SHA-256 o tang code. */
    KhoaTrung    NVARCHAR(80)  NOT NULL,
    -- Cho / Da khop / Bo qua  (Bo qua = giao dich khong lien quan cong no, vd phi ngan hang)
    TrangThai    NVARCHAR(20)  NOT NULL DEFAULT N'Chờ',
    PhieuThuID   INT           NULL,            -- phieu thu sinh ra khi khop
    TenKhachKhop NVARCHAR(150) NULL,            -- ten khach da khop (khoa nhom cong no)
    PhieuBHID    INT           NULL,            -- phieu ban hang khop duoc theo ma trong noi dung
    DoTinCay     INT           NULL,            -- 100 = khop ma phieu; 70 = ten+so tien; 40 = doan
    Nguon        NVARCHAR(20)  NOT NULL DEFAULT N'Sao kê',   -- Sao kê / Webhook / Nhập tay
    GhiChu       NVARCHAR(500) NULL,
    NguoiTaoID   INT           NULL,
    CreatedAt    DATETIME2     NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT UQ_BankGiaoDich_Khoa UNIQUE (KhoaTrung),
    CONSTRAINT FK_BankGD_TK    FOREIGN KEY (BankTKID)   REFERENCES BankTaiKhoan(BankTKID),
    CONSTRAINT FK_BankGD_Thu   FOREIGN KEY (PhieuThuID) REFERENCES PhieuThu(PhieuThuID),
    CONSTRAINT FK_BankGD_PhieuBH FOREIGN KEY (PhieuBHID) REFERENCES PhieuBanHang(PhieuBHID),
    CONSTRAINT FK_BankGD_User  FOREIGN KEY (NguoiTaoID) REFERENCES Users(UserID)
  );
  CREATE INDEX IX_BankGiaoDich_Ngay ON BankGiaoDich(NgayGD);
  CREATE INDEX IX_BankGiaoDich_TT   ON BankGiaoDich(TrangThai);
  PRINT '  + Da tao bang BankGiaoDich';
END
ELSE PRINT '  = BankGiaoDich da co, bo qua';
GO

/* ---------------- 3. Noi nguoc tu phieu thu ve giao dich ---------------- */
IF COL_LENGTH('PhieuThu', 'BankGDID') IS NULL
BEGIN
  ALTER TABLE PhieuThu ADD BankGDID INT NULL;
  PRINT '  + PhieuThu.BankGDID';
END
ELSE PRINT '  = PhieuThu.BankGDID da co';
GO

/* ---------------- 4. Module + chuc nang ---------------- */
IF NOT EXISTS (SELECT 1 FROM Modules WHERE ModuleCode = N'DOISOAT')
    INSERT INTO Modules (ModuleCode, TenModule, ThuTu) VALUES (N'DOISOAT', N'Đối soát ngân hàng', 13);
GO
INSERT INTO Permissions (GroupID, ModuleID, CanView, CanCreate, CanEdit, CanDelete)
SELECT g.GroupID, m.ModuleID, 0, 0, 0, 0
FROM Groups g CROSS JOIN Modules m
WHERE m.ModuleCode = N'DOISOAT'
  AND NOT EXISTS (SELECT 1 FROM Permissions p WHERE p.GroupID = g.GroupID AND p.ModuleID = m.ModuleID);
GO
MERGE ChucNang AS t
USING (VALUES
    ('DOISOAT','giaodich', N'Giao dịch & đối soát', 1),
    ('DOISOAT','taikhoan', N'Tài khoản ngân hàng', 2)
) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu)
ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
WHEN NOT MATCHED THEN INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu)
     VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu);
GO

/* ---------------- 5. Cau hinh ---------------- */
MERGE CauHinhHeThong AS t
USING (VALUES
    -- Chi TU DONG sinh phieu thu khi do tin cay >= muc nay. 100 = chi khop chac chan (co ma phieu).
    ('DOISOAT_TU_DONG_TU', N'100'),
    -- Khoa bi mat cho webhook. ĐỔI NGAY sau khi chay migration, va chi dua cho dich vu trung gian.
    ('DOISOAT_WEBHOOK_KEY', N'')
) AS s (ConfigKey, ConfigValue)
  ON t.ConfigKey = s.ConfigKey
WHEN NOT MATCHED THEN INSERT (ConfigKey, ConfigValue) VALUES (s.ConfigKey, s.ConfigValue);
GO

PRINT '';
PRINT '=== migration_v680 XONG ===';
PRINT '1) Quan ly User -> Ma tran phan quyen -> bat quyen cho module DOISOAT.';
PRINT '2) Doi soat ngan hang -> Tai khoan ngan hang -> khai so TK cua cong ty (co ma VietQR).';
PRINT '3) Muon nhan real-time: dat DOISOAT_WEBHOOK_KEY roi tro webhook cua SePay/Casso ve';
PRINT '   POST /api/doisoat/webhook/<key>';
GO




//////////////////////////////////////////////////////////////////////////////////////////////////
/* ================================================================================================
   PHAN BO SUNG v6.78 -> v7.22  (gop tu migration_v681 .. migration_v685)

   ⚠️ QUY TAC: co migration moi thi PHAI gop luon vao file nay. Truoc day file dung o v680 nen ai cai
   MOI bang CAI_DAT_DAY_DU.sql se THIEU HAN phan he "Phieu nhap kho hang hoa" (bang PhieuNhapKhoHang)
   va bo view ton kho moi -> chay backend la loi "Invalid object name" ngay man The kho.

   Tat ca cac khoi duoi day IDEMPOTENT (chay lai nhieu lan khong sao) va giu NGUYEN VAN noi dung cua
   file migration tuong ung, de con doi chieu duoc voi ban da chay tren may dang van hanh.
   ================================================================================================ */



/* ================== migration_v681.sql ================== */

/* ================================================================================================
   migration_v681.sql   (v6.78)
   PHIEU NHAP KHO HANG HOA - trong phan he "The kho hang hoa".

   TRUOC DAY ton kho THANH PHAM tang bang 2 duong, ca hai deu KHONG co chung tu:
     (a) Go thang so vao o "Nhap" luc tao/sua the kho  (khohang.js)
     (b) Ghi nhan cong doan cuoi o Quan ly san xuat     (qlsx.js -> NhapCai += ...)
   => Khong tra duoc "lo hang nay nhap ngay nao, cua ai, gia bao nhieu". Nhap sai chi biet sua tay
      lai con so, khong co gi de doi chieu.

   NAY: co PHIEU NHAP KHO dung nghia, 2 loai:
     - Nhap tu NHA CUNG CAP   : hang mua ngoai. Co don gia -> TANG CONG NO PHAI TRA cho NCC.
     - Nhap tu NHA SAN XUAT   : hang xuong minh lam ra, gan LENH SX. KHONG sinh cong no.
   Ma hang chua co trong danh muc thi tao luon khi lap phieu (khong bat sang man Danh muc roi quay lai).

   ⚠️ CONG NO NCC: them nguon nay PHAI sua DONG BO 2 ham trong congno.js (congNoNCC + soChiTietNCC).
      Repo da tung lech vi co 2 ban tinh cong no song song.
   ================================================================================================ */

/* ---------------- 1. Phieu nhap kho (dau phieu) ---------------- */
IF OBJECT_ID('PhieuNhapKhoHang', 'U') IS NULL
BEGIN
  CREATE TABLE PhieuNhapKhoHang (
    PhieuNKID   INT IDENTITY(1,1) PRIMARY KEY,
    SoPhieu     NVARCHAR(30)  NOT NULL UNIQUE,       -- NK + yy + 4 so, vd NK260001
    NgayNhap    DATE          NOT NULL,
    -- 'NhaCungCap' = mua ngoai (co cong no) | 'SanXuat' = xuong minh lam ra (khong cong no)
    LoaiNhap    NVARCHAR(20)  NOT NULL DEFAULT N'NhaCungCap',
    NCC_ID      INT           NULL,                  -- chi dung khi LoaiNhap = 'NhaCungCap'
    DonHangID   INT           NULL,                  -- lenh SX, chi dung khi LoaiNhap = 'SanXuat'
    SoHoaDon    NVARCHAR(50)  NULL,
    NgayHoaDon  DATE          NULL,
    TongSLCai   INT           NULL DEFAULT 0,
    TongTien    DECIMAL(18,2) NULL DEFAULT 0,        -- = SUM(SoLuong * DonGia); 0 khi nhap tu SX
    TrangThai   NVARCHAR(20)  NOT NULL DEFAULT N'Hoàn thành',   -- Hoàn thành / Đã hủy
    GhiChu      NVARCHAR(500) NULL,
    NguoiTaoID  INT           NULL,
    CreatedAt   DATETIME2     NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT FK_PhieuNKH_NCC  FOREIGN KEY (NCC_ID)     REFERENCES NhaCungCap(NCC_ID),
    CONSTRAINT FK_PhieuNKH_Don  FOREIGN KEY (DonHangID)  REFERENCES DonHangSanXuat(DonHangID),
    CONSTRAINT FK_PhieuNKH_User FOREIGN KEY (NguoiTaoID) REFERENCES Users(UserID)
  );
  CREATE INDEX IX_PhieuNhapKhoHang_Ngay ON PhieuNhapKhoHang(NgayNhap);
  PRINT '  + Da tao bang PhieuNhapKhoHang';
END
ELSE PRINT '  = PhieuNhapKhoHang da co, bo qua';
GO

/* ---------------- 2. Dong hang cua phieu ---------------- */
IF OBJECT_ID('PhieuNhapKhoHangChiTiet', 'U') IS NULL
BEGIN
  CREATE TABLE PhieuNhapKhoHangChiTiet (
    ID          INT IDENTITY(1,1) PRIMARY KEY,
    PhieuNKID   INT           NOT NULL,
    MaHangID    INT           NOT NULL,
    MauSacID    INT           NOT NULL,
    SoLuong     DECIMAL(14,2) NOT NULL,              -- so nguoi dung go, theo DonVi ben duoi
    DonVi       NVARCHAR(20)  NULL,
    /* SoLuongChinh = quy ve DON VI CHINH cua ma hang. TheKhoChiTietMau.NhapCai luu theo don vi
       chinh (co the la Ri), KHONG phai Cai - nham cho nay la ton kho sai gap LoaiRi lan. */
    SoLuongChinh INT          NOT NULL,
    DonGia      DECIMAL(14,2) NULL,                  -- chi nhap tu NCC moi co gia
    ThanhTien   DECIMAL(18,2) NULL,
    GhiChu      NVARCHAR(255) NULL,
    CONSTRAINT FK_PNKHCT_Phieu  FOREIGN KEY (PhieuNKID) REFERENCES PhieuNhapKhoHang(PhieuNKID) ON DELETE CASCADE,
    CONSTRAINT FK_PNKHCT_MaHang FOREIGN KEY (MaHangID)  REFERENCES TheKhoHangHoa(MaHangID),
    CONSTRAINT FK_PNKHCT_Mau    FOREIGN KEY (MauSacID)  REFERENCES MauSac(MauSacID)
  );
  CREATE INDEX IX_PhieuNhapKhoHangChiTiet_Phieu ON PhieuNhapKhoHangChiTiet(PhieuNKID);
  PRINT '  + Da tao bang PhieuNhapKhoHangChiTiet';
END
ELSE PRINT '  = PhieuNhapKhoHangChiTiet da co, bo qua';
GO

/* ---------------- 3. Chuc nang / phan quyen ----------------
   Key PHAI trung key tab o frontend getTabs() (module.khohang.js) - effectivePerm tra theo
   'KHOHANG:' + activeTab. Dat sai key = tab luon bi coi la khong co quyen. */
MERGE ChucNang AS t
USING (VALUES
    ('KHOHANG','nhapkho', N'Phiếu nhập kho', 7)
) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu)
ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
WHEN NOT MATCHED THEN INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu)
     VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu);
GO

PRINT '';
PRINT '=== migration_v681 XONG ===';
PRINT 'NHO: Quan ly User -> Ma tran phan quyen -> cap chuc nang KHOHANG/nhapkho,';
PRINT '     khong thi tab "Phieu nhap kho" se khong hien ra.';
GO



/* ================== migration_v682.sql ================== */

/* ================================================================================================
   migration_v682.sql   (v6.89)
   PHIEU NHAP KHO LA MOT NGUON TON KHO RIENG — KHONG GHI VAO O "NHAP" CUA THE KHO NUA.

   YEU CAU: luu phieu nhap kho thi chi (a) tao ma hang neu chua co, (b) cong cong no NCC,
   (c) len BAO CAO TON KHO. O "Nhap" cua the kho chi do nguoi dung khai khi tao/sua the kho.

   CACH LAM: ton kho hang hoa nay co HAI NGUON CONG LAI, khong chong nhau:
     Nguon 1 - THE KHO   : TheKhoChiTietMau.NhapCai  (nguoi dung khai tay, hoac QLSX cong doan KN)
     Nguon 2 - CHUNG TU  : PhieuNhapKhoHangChiTiet.SoLuongChinh (phieu chua huy)
     TON = (Nguon1 + Nguon2) - XuatCai

   ⚠️ VI SAO KHONG DUNG CO "DaVaoTheKho" ROI CHUYEN NGUON: chuyen nguon la lam hai buoc ghi cho cung
   mot so luong, va bat ky lan nao lech nhau la ton kho sai am tham. O day hai nguon RỜI NHAU HAN
   theo cau truc — phieu nhap khong bao gio ghi vao NhapCai — nen KHONG THE dem hai lan.

   ⚠️ HE QUA: huy/xoa phieu nhap thi ton TU DONG giam, vi view doc thang tu bang phieu. Backend
   KHONG con phai tru NhapCai khi huy phieu (da go trong nhapkho.js cung ban nay).

   ⚠️ BUOC GO MOT LAN: cac ban v6.78-v6.88 DA cong NhapCai tu phieu nhap. Neu khong go ra thi sau khi
   doi view se dem hai lan. Buoc 3 duoi day tru dung so da cong, co chot chong chay lai 2 lan.
   Phep tru nay BU TRU CHINH XAC voi phan view cong vao => ton kho KHONG doi mot don vi nao.
   ================================================================================================ */

/* ---------------- 0. Chan chay khi chua co bang cua migration_v681 ----------------
   ⚠️ RAISERROR mot minh KHONG dung script; phai SET NOEXEC ON thi cac batch sau moi bi bo qua.
   Khong chan la buoc 3 se tru NhapCai roi ghi chot ma view chua kip tao => ton tut. */
IF OBJECT_ID('PhieuNhapKhoHangChiTiet', 'U') IS NULL
BEGIN
  RAISERROR('DUNG: chua co bang PhieuNhapKhoHangChiTiet - phai chay migration_v681 truoc.', 16, 1);
  SET NOEXEC ON;
END
GO

/* ---------------- 1. Nguon 2: so luong tu PHIEU NHAP KHO ----------------
   ⚠️ CREATE VIEW PHAI LA CAU DAU TIEN CUA BATCH (SQL Server Msg 111). Khong duoc de PRINT hay bat cu
   cau nao khac dung truoc no trong cung mot batch — moi CREATE VIEW o day deu co GO ngay truoc. */
GO
CREATE OR ALTER VIEW vw_NhapKhoTuPhieu AS
SELECT ct.MaHangID, ct.MauSacID, SUM(ISNULL(ct.SoLuongChinh, 0)) AS NhapTuPhieu
FROM PhieuNhapKhoHangChiTiet ct
JOIN PhieuNhapKhoHang p ON p.PhieuNKID = ct.PhieuNKID
WHERE p.TrangThai <> N'Đã hủy'
GROUP BY ct.MaHangID, ct.MauSacID;
GO
PRINT '  + vw_NhapKhoTuPhieu';
GO

/* ---------------- 2. TON THEO TUNG MAU — MOT DINH NGHIA DUY NHAT ----------------
   Truoc day co 14 cho trong backend tu viet SUM(NhapCai - XuatCai). Them nguon thu hai ma de nguyen
   14 ban sao la chac chan se co cho bi bo sot. Nay MOI cho doc ton deu phai JOIN view nay.

   Khoa la UNION cua hai nguon: ma hang moi chi co phieu nhap thi CHUA co dong nao trong
   TheKhoChiTietMau (chua tao the kho) — neu chi LEFT JOIN tu TheKhoChiTietMau thi hang vua nhap se
   khong ton tai trong moi phep tinh ton. */
GO
CREATE OR ALTER VIEW vw_TonTheoMau AS
SELECT k.MaHangID, k.MauSacID,
       ISNULL(ct.SoCatCai, 0)      AS SoCatCai,
       ISNULL(ct.NhapCai, 0)       AS NhapCai,        -- nguon 1: khai tay o the kho / QLSX
       ISNULL(pk.NhapTuPhieu, 0)   AS NhapTuPhieu,    -- nguon 2: phieu nhap kho
       ISNULL(ct.NhapCai, 0) + ISNULL(pk.NhapTuPhieu, 0) AS TongNhapCai,
       ISNULL(ct.XuatCai, 0)       AS XuatCai,
       -- TonTheKho: CHI phan cua THE KHO. Man hinh "The kho hang hoa" hien cot nay - ma chua tao the
       -- kho thi phai la 0/trong, khong duoc muon so cua phieu nhap de trong nhu da co the kho.
       ISNULL(ct.NhapCai, 0) - ISNULL(ct.XuatCai, 0) AS TonTheKho,
       -- TonCai: TON THAT (gom chung tu). Dung cho bao cao ton kho, ban hang, catalogue, don khach.
       ISNULL(ct.NhapCai, 0) + ISNULL(pk.NhapTuPhieu, 0) - ISNULL(ct.XuatCai, 0) AS TonCai,
       ct.ID AS ChiTietID, ct.LinkAnh, ct.GhiChu
FROM (
  SELECT MaHangID, MauSacID FROM TheKhoChiTietMau
  UNION
  SELECT MaHangID, MauSacID FROM vw_NhapKhoTuPhieu
) k
LEFT JOIN TheKhoChiTietMau ct ON ct.MaHangID = k.MaHangID AND ct.MauSacID = k.MauSacID
LEFT JOIN vw_NhapKhoTuPhieu pk ON pk.MaHangID = k.MaHangID AND pk.MauSacID = k.MauSacID;
GO
PRINT '  + vw_TonTheoMau';
PRINT '  ! Luu y: cot vat ly TheKhoChiTietMau.TonCai (computed = NhapCai - XuatCai) TU NAY LA SO SAI';
PRINT '    - no khong gom nguon phieu nhap kho. Moi cho tinh ton phai doc vw_TonTheoMau.TonCai.';
GO

/* ---------------- 3. GO MOT LAN phan NhapCai ma phieu nhap da cong (v6.78-v6.88) ----------------
   Chot: CauHinhHeThong.ConfigKey = 'V682_GO_NHAPCAI_PHIEUNK'. Co chot roi thi BO QUA.
   Phep tru nay khong lam ton doi: so tru ra dung bang so view vua cong vao.

   ⚠️ HAI DIEU KIEN, thieu mot la KHONG duoc tru:
     (a) chua co chot   -> chua tru lan nao;
     (b) vw_TonTheoMau DA TON TAI -> chac chan co ai do cong lai phan vua tru.
   Thieu (b) thi khi buoc 2 loi ma buoc nay van chay, ton se TUT dung bang tong phieu nhap va chot da
   ghi nen chay lai cung khong tu sua. */
IF NOT EXISTS (SELECT 1 FROM CauHinhHeThong WHERE ConfigKey = 'V682_GO_NHAPCAI_PHIEUNK')
   AND OBJECT_ID('vw_TonTheoMau', 'V') IS NOT NULL
BEGIN
  DECLARE @soDong INT = 0, @soLuong INT = 0;

  SELECT @soDong = COUNT(*), @soLuong = ISNULL(SUM(NhapTuPhieu), 0) FROM vw_NhapKhoTuPhieu;

  UPDATE ct
     SET ct.NhapCai = ct.NhapCai - pk.NhapTuPhieu
    FROM TheKhoChiTietMau ct
    JOIN vw_NhapKhoTuPhieu pk ON pk.MaHangID = ct.MaHangID AND pk.MauSacID = ct.MauSacID;

  INSERT INTO CauHinhHeThong (ConfigKey, ConfigValue)
  VALUES ('V682_GO_NHAPCAI_PHIEUNK',
          CONVERT(NVARCHAR(30), SYSDATETIME(), 120) + N' | dong=' + CAST(@soDong AS NVARCHAR(20))
          + N' | soluong=' + CAST(@soLuong AS NVARCHAR(20)));

  PRINT '  + Da GO NhapCai do phieu nhap cong truoc day: ' + CAST(@soDong AS VARCHAR(20))
        + ' dong ma-mau, tong ' + CAST(@soLuong AS VARCHAR(20)) + ' (don vi chinh).';
  PRINT '    Ton kho KHONG doi - view vw_TonTheoMau cong lai dung so nay tu bang phieu.';
END
ELSE IF OBJECT_ID('vw_TonTheoMau', 'V') IS NULL
  PRINT '  ! BO QUA buoc go NhapCai: chua tao duoc vw_TonTheoMau (xem loi o tren). CHAY LAI file nay.';
ELSE PRINT '  = Da go NhapCai tu truoc (co chot V682_GO_NHAPCAI_PHIEUNK), bo qua';
GO

/* ---------------- 4. Dung lai vw_TonKhoHangHoa tren nguon moi ----------------
   Giu NGUYEN bo cot cua ban v642 (nhieu noi dang doc: khohang.js GET /items + export,
   public.js catalogue/danhmuc) va THEM TongNhapTuPhieu de man hinh phan biet duoc ton den tu dau.
   ⚠️ Khong doi ten cot TongNhap/TongXuat/TongTon - doi la vo cac route dang chay. */
/* QUY TAC HIEN THI CUA MAN "THE KHO HANG HOA":
     - Ma CHUA CO THE KHO (khong co dong nao trong TheKhoChiTietMau) -> TongNhap/TongTon = 0.
       Luu phieu nhap kho khong duoc lam ma do "tu nhien co ton" o man the kho.
     - Ma DA CO THE KHO -> hien TON THAT, gom ca so luong tu phieu nhap kho.
   => Dung the: bam "Tao the kho" xong thi so moi hien ra o day.
   Cac man khac (Bao cao ton kho, Ban hang, Catalogue, Don khach) LUON dung TongTonThuc.
   ⚠️ Phai boc qua mot bang dan xuat: khong the vua tinh MAX(...) lam co "co the kho" vua dung no
   trong CASE cua cung mot muc SELECT. */
GO
CREATE OR ALTER VIEW vw_TonKhoHangHoa AS
SELECT x.MaHangID, x.MaHang, x.TenHang, x.GiaBan, x.LoaiRi, x.AnhDaiDien,
       x.TheKhoDanhMucID, x.TenTheKho,
       x.LoaiHang, x.DonHangID, x.DonViCoBan, x.DonViQuyDoi, x.MaDH,
       x.GiaAloha, x.MaBarcode, x.NhomSanPhamID, x.TenNhom,
       x.TongSoCat, x.TongXuat, x.TongNhapTuPhieu, x.CoTheKho,
       CASE WHEN x.CoTheKho = 1 THEN x.TongNhapThuc ELSE 0 END AS TongNhap,
       CASE WHEN x.CoTheKho = 1 THEN x.TongTonThuc  ELSE 0 END AS TongTon,
       x.TongNhapThuc, x.TongTonThuc
FROM (
  SELECT
      h.MaHangID, h.MaHang, h.TenHang, h.GiaBan, h.LoaiRi, h.AnhDaiDien,
      h.TheKhoDanhMucID, tk.TenTheKho,
      h.LoaiHang, h.DonHangID, h.DonViCoBan, h.DonViQuyDoi, d.MaDH,
      h.GiaAloha, h.MaBarcode,
      h.NhomSanPhamID, nsp.TenNhom,
      ISNULL(SUM(t.SoCatCai), 0)     AS TongSoCat,
      ISNULL(SUM(t.XuatCai), 0)      AS TongXuat,
      ISNULL(SUM(t.NhapTuPhieu), 0)  AS TongNhapTuPhieu,   -- phan den tu phieu nhap kho
      ISNULL(SUM(t.TongNhapCai), 0)  AS TongNhapThuc,      -- the kho + phieu
      ISNULL(SUM(t.TonCai), 0)       AS TongTonThuc,       -- ton THAT = the kho + phieu - xuat
      MAX(CASE WHEN t.ChiTietID IS NOT NULL THEN 1 ELSE 0 END) AS CoTheKho
  FROM TheKhoHangHoa h
  LEFT JOIN TheKhoDanhMuc tk ON tk.TheKhoDanhMucID = h.TheKhoDanhMucID
  LEFT JOIN DanhMucNhomSanPham nsp ON nsp.NhomSanPhamID = h.NhomSanPhamID
  LEFT JOIN vw_TonTheoMau t ON t.MaHangID = h.MaHangID
  LEFT JOIN DonHangSanXuat d ON d.DonHangID = h.DonHangID
  GROUP BY
      h.MaHangID, h.MaHang, h.TenHang, h.GiaBan, h.LoaiRi, h.AnhDaiDien,
      h.TheKhoDanhMucID, tk.TenTheKho,
      h.LoaiHang, h.DonHangID, h.DonViCoBan, h.DonViQuyDoi, d.MaDH,
      h.GiaAloha, h.MaBarcode, h.NhomSanPhamID, nsp.TenNhom
) x;
GO
PRINT '  + vw_TonKhoHangHoa (dung lai tren vw_TonTheoMau)';

PRINT '';
PRINT '=== migration_v682 XONG ===';
PRINT 'PHAI pm2 restart qlnoibo (sua backend/routes: nhapkho, khohang, banhang, baocao, public).';
PRINT 'Kiem nhanh - hai so nay phai BANG NHAU:';
PRINT '  SELECT SUM(TongTon) FROM vw_TonKhoHangHoa;';
PRINT '  SELECT SUM(NhapCai) - SUM(XuatCai) FROM TheKhoChiTietMau';
PRINT '   + (SELECT SUM(NhapTuPhieu) FROM vw_NhapKhoTuPhieu);';
GO
SET NOEXEC OFF;
GO



/* ================== migration_v683.sql ================== */

/* ================================================================================================
   migration_v683.sql   (v6.94)
   DANH MUC HANG HOA (MA HANG) — them chuc nang de phan quyen duoc.

   ⚠️ KHONG tao bang moi. `TheKhoHangHoa` DA LA danh muc hang hoa; truoc gio chi THIEU MOT MAN HINH
   de sua Ma hang / Ten hang, nen go sai la khong sua duoc. Tao bang `DanhMucHangHoa` rieng se thanh
   HAI nguon su that cho cung mot thu — chac chan lech nhau.
   File nay vi vay CHI them 1 dong ChucNang.

   Khong chay file nay thi tab "Hàng hóa (mã hàng)" VAN hoat dong (effectivePerm: khong co dong cau
   hinh rieng thi khong han che them) — chi la khong hien trong Ma tran phan quyen de chan bot ai.
   ================================================================================================ */
MERGE ChucNang AS t
USING (VALUES
    ('DANHMUC','hanghoa', N'Hàng hóa (mã hàng)', 12)
) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu)
ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
WHEN NOT MATCHED THEN INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu)
     VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu);
GO

PRINT '';
PRINT '=== migration_v683 XONG ===';
PRINT 'Vao Quan ly User -> Ma tran phan quyen -> cap DANHMUC/hanghoa neu muon gioi han rieng tab nay.';
PRINT 'PHAI pm2 restart qlnoibo (sua backend/routes/danhmuc.js + utils/maHangThamChieu.js moi).';
GO



/* ================== migration_v684.sql ================== */

/* ================================================================================================
   migration_v684.sql   (v7.10)
   QUYEN "XEM TAT CA LENH SX" — tach PHAM VI XEM khoi QUYEN GHI TIEN DO

   VAN DE: tu truoc den nay "user nao thay lenh SX nao" bi quyet dinh boi bang UserCongDoan — chinh
   la bang dung de cap QUYEN GHI TIEN DO cong doan. Mot bang ganh HAI viec:
       - Khong tick cong doan nao  => thay TAT CA lenh SX (nhung khong ghi duoc tien do o dau)
       - Tick vai cong doan        => chi thay lenh dang o dung cong doan do
   Nen muon cho 1 nguoi XEM HET lenh SX ma VAN ghi tien do o 1 cong doan la KHONG THE LAM DUOC.

   CACH GIAI: them 1 CHUC NANG rieng 'QLSX/xemtatca' — tick o Ma tran phan quyen la thay het,
   khong lien quan gi den danh sach cong doan nua.

   ⚠️ VI SAO PHAI THEM COT `ChucNang.MacDinhCho`:
   Toan bo he thong chuc nang hien hanh chay theo quy uoc "KHONG co dong cau hinh = DUOC PHEP"
   (xem middleware/auth.js:requireChucNang va users.js: `ISNULL(cp.CanView, 1)`). Neu de
   'xemtatca' theo quy uoc do thi vua chay migration la MOI NGUOI thay het lenh SX — nguoc hoan
   toan y muon. Con te hon: o Ma tran phan quyen no se hien TICK SAN, ai mo ra bam Luu la vo tinh
   cap quyen cho ca nhom.
   Vi vay them cot `MacDinhCho` (mac dinh 1 = giu nguyen hanh vi cu cho MOI chuc nang dang co);
   rieng cac chuc nang kieu "NANG LUC MO RONG" (nhu xemtatca) dat 0 = PHAI TICK MOI CO.

   Chay lai file nay nhieu lan khong sao (idempotent).
   ================================================================================================ */
SET NOCOUNT ON;
GO

/* --- 1. Cot MacDinhCho tren ChucNang ------------------------------------------------------------ */
IF COL_LENGTH('ChucNang', 'MacDinhCho') IS NULL
BEGIN
    ALTER TABLE ChucNang ADD MacDinhCho BIT NOT NULL CONSTRAINT DF_ChucNang_MacDinhCho DEFAULT 1;
    PRINT '  + Da them cot ChucNang.MacDinhCho (mac dinh 1 = giu nguyen hanh vi cu).';
END
ELSE
    PRINT '  = Cot ChucNang.MacDinhCho da co.';
GO

/* --- 2. Chuc nang QLSX/xemtatca (MacDinhCho = 0: phai tick moi co) ------------------------------ */
MERGE ChucNang AS t
USING (VALUES
    ('QLSX', 'xemtatca', N'Xem tất cả lệnh SX (mọi công đoạn)', 90, CAST(0 AS BIT))
) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu, MacDinhCho)
ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
WHEN MATCHED THEN UPDATE SET TenChucNang = s.TenChucNang, MacDinhCho = s.MacDinhCho
WHEN NOT MATCHED THEN INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu, MacDinhCho)
     VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu, s.MacDinhCho);
GO

PRINT '';
PRINT '=== migration_v684 XONG ===';
PRINT 'PHAI pm2 restart qlnoibo (sua loadUserContext.js + middleware/auth.js + routes/qlsx.js + routes/users.js).';
PRINT 'Cach dung: Quan ly User -> Ma tran phan quyen -> nhom (hoac tab "Theo tung user") ->';
PRINT '           khoi QLSX -> tick o "Xem" cua dong "Xem tat ca lenh SX (moi cong doan)" -> Luu.';
PRINT 'Nguoi duoc cap PHAI dang xuat / dang nhap lai (quyen cache trong session).';
GO



/* ================== migration_v685.sql ================== */

/* ================================================================================================
   migration_v685.sql   (v7.22)
   LUONG DU LIEU HAI CHIEU: PHIEU BAN HANG  <->  CHI TIET DAT HANG

   YEU CAU: sua phieu ban hang (doi mau / xoa ma hang / them ma moi) thi CHI TIET DAT HANG cua ma
   hang do phai phan anh theo. Muon lam duoc phai PHAN BIET hai loai dong trong DonKhachDatHang:

     1. DON THAT cua khach  (khach dat trong app hoac tren web)
        -> Doi mau: don doi theo phieu. Bo khoi phieu: HOI nguoi dung (huy hay giu cho giao sau).
     2. DON PHAN CHIEU tu phieu ban hang  (`NguonDat = 'PhieuBH'`)
        Sinh tu dong khi mot dong phieu KHONG xuat phat tu don nao (ban thang, hoac them ma moi luc
        sua phieu). No chi la BAN GHI PHAN CHIEU cua dong phieu, khong phai yeu cau cua khach.
        -> Dong phieu mat thi XOA luon don nay (khong de treo, khong giu ton).

   Cot `NguonDat` da co tu migration_v657 (dung cho don dat qua Web). File nay chi DAM BAO cot ton
   tai o cac ban cai chua chay v657, va noi rong do dai neu cot dang qua ngan.
   KHONG sua mot dong du lieu nao dang co.
   ================================================================================================ */
SET NOCOUNT ON;
GO

IF COL_LENGTH('DonKhachDatHang', 'NguonDat') IS NULL
BEGIN
    ALTER TABLE DonKhachDatHang ADD NguonDat NVARCHAR(30) NULL;
    PRINT '  + Da them cot DonKhachDatHang.NguonDat.';
END
ELSE
    PRINT '  = Cot DonKhachDatHang.NguonDat da co.';
GO

/* Do dai phai chua duoc chuoi 'PhieuBH' (7 ky tu) - cac ban cu khai NVARCHAR(10) van du, nhung neu
   ai do khai ngan hon thi noi ra cho chac. */
IF COL_LENGTH('DonKhachDatHang', 'NguonDat') < 20
BEGIN
    ALTER TABLE DonKhachDatHang ALTER COLUMN NguonDat NVARCHAR(30) NULL;
    PRINT '  + Da noi rong NguonDat len NVARCHAR(30).';
END
GO

PRINT '';
PRINT '=== migration_v685 XONG ===';
PRINT 'PHAI pm2 restart qlnoibo (sua backend/routes/banhang.js).';
PRINT 'Tu day: moi dong phieu ban hang khong gan don se tu sinh 1 dong o Chi tiet dat hang';
PRINT '        (NguonDat = PhieuBH, trang thai "Đã xuất hàng", KHONG tru ton lan hai).';
PRINT 'Kiem nhanh sau khi dung mot thoi gian:';
PRINT '  SELECT NguonDat, COUNT(*) FROM DonKhachDatHang GROUP BY NguonDat;';
GO




/* ================== migration_v686.sql ================== */
/* ================================================================================================
   migration_v686.sql   (v7.23)
   PHAN HE MOI: DMS — DI TUYEN THI TRUONG  (shop ban le, gia tuyen, ghe tham GPS, doanh so NVKD)

   NGHIEP VU:
     - Nhan vien kinh doanh di thi truong, GHE THAM cac SHOP BAN LE. Moi shop thuoc mot NHA PHAN PHOI
       (lay tu danh muc Khach hang dang co - KHONG tao danh muc NPP thu hai).
     - Ghe tham co DINH VI GPS: so toa do luc check-in voi toa do shop; xa hon ban kinh cho phep thi
       VAN GHI NHAN nhung danh dau de quan ly biet. Bat buoc co ANH. Ngoai ra ghi nhan duoc ca
       GOI DIEN / ZALO (cham soc tu xa, khong can GPS).
     - Theo doi LO TRINH theo ngay/thang: di nhung shop nao, may gio, dung ke hoach hay khong.
     - Cuoi thang/quy/nam tinh DOANH SO cho tung nhan vien theo PHIEU BAN HANG (chung tu thuc xuat,
       co tien va cong no - khop ke toan; don khach dat chi la nhu cau, chua chac ra hang).

   QUYET DINH THIET KE (da chot voi nguoi dung):
     1. SHOP la BANG RIENG `ShopBanLe`, khong nhet vao KhachHang. NPP thi tro ve `KhachHang`.
        => Phieu ban hang co them `ShopID`: ban cho shop thi chon shop, ban cho NPP thi de trong.
     2. Ban do: Leaflet + OpenStreetMap (khong can API key) - chi la chuyen frontend, DB chi luu
        `Latitude`/`Longitude` dang DECIMAL(10,7)/(10,7) (~1cm do phan giai, du xa).
     3. Doanh so tinh theo `PhieuBanHang` (chua huy).
     4. Check-in: ban kinh mac dinh 200m (cau hinh duoc), bat buoc anh, co loai tiep xuc GoiDien/Zalo.

   ⚠️ `navigator.geolocation` CHI CHAY TREN HTTPS. He thong da co HTTPS noi bo tu v5.68 - neu nhan
      vien mo bang http:// thi trinh duyet cham dut quyen dinh vi, khong phai loi phan mem.
   ================================================================================================ */
IF DB_NAME() <> N'QLNoiBo'
BEGIN
    RAISERROR (N'!! DANG KHONG O DATABASE QLNoiBo. Chon dung database roi chay lai.', 20, 1) WITH LOG;
    SET NOEXEC ON;
END
GO

/* ================================================================================================
   1. SHOP BAN LE
   `NhaPhanPhoiID` -> KhachHang: shop nay thuoc NPP nao (NULL = ban le truc tiep, khong qua NPP).
   `NhanVienPhuTrachID` -> NhanVien: ai dang phu trach cham shop nay.
   ================================================================================================ */
IF OBJECT_ID('ShopBanLe', 'U') IS NULL
BEGIN
  CREATE TABLE ShopBanLe (
    ShopID              INT IDENTITY(1,1) PRIMARY KEY,
    MaShop              NVARCHAR(30)   NOT NULL UNIQUE,      -- SH + yy + 4 so, vd SH260001
    TenShop             NVARCHAR(150)  NOT NULL,
    NhaPhanPhoiID       INT            NULL,                 -- KhachHang (loai NPP)
    NguoiLienHe         NVARCHAR(100)  NULL,
    SDT                 NVARCHAR(30)   NULL,
    DiaChi              NVARCHAR(255)  NULL,
    TinhThanh           NVARCHAR(100)  NULL,
    QuanHuyen           NVARCHAR(100)  NULL,
    Latitude            DECIMAL(10, 7) NULL,                 -- vd 21.0278334
    Longitude           DECIMAL(10, 7) NULL,                 -- vd 105.8341598
    AnhMatTien          NVARCHAR(500)  NULL,                 -- duong dan /uploads/...
    NhanVienPhuTrachID  INT            NULL,
    -- 'Tiem nang' = moi tim thay chua ban | 'Dang ban' | 'Tam dung' | 'Ngung'
    TrangThai           NVARCHAR(20)   NOT NULL DEFAULT N'Tiềm năng',
    GhiChu              NVARCHAR(MAX)  NULL,                 -- thong tin cham soc: gu hang, ky tinh...
    NguoiTaoID          INT            NULL,
    CreatedAt           DATETIME2      NOT NULL DEFAULT SYSDATETIME(),
    UpdatedAt           DATETIME2      NULL,
    CONSTRAINT FK_ShopBanLe_NPP    FOREIGN KEY (NhaPhanPhoiID)      REFERENCES KhachHang(KhachHangID),
    CONSTRAINT FK_ShopBanLe_NVPT   FOREIGN KEY (NhanVienPhuTrachID) REFERENCES NhanVien(NhanVienID),
    CONSTRAINT FK_ShopBanLe_NguoiTao FOREIGN KEY (NguoiTaoID)       REFERENCES Users(UserID)
  );
  CREATE INDEX IX_ShopBanLe_NPP  ON ShopBanLe(NhaPhanPhoiID);
  CREATE INDEX IX_ShopBanLe_NVPT ON ShopBanLe(NhanVienPhuTrachID);
  PRINT '  + Bang ShopBanLe';
END
ELSE PRINT '  = Bang ShopBanLe da co';
GO

/* ================================================================================================
   2. TUYEN BAN HANG + SHOP TRONG TUYEN
   Tuyen = mot nhom shop di cung mot buoi/mot ngay. `ThuTrongTuan` cho phep khai lich CO DINH
   (vd tuyen A di thu 2 va thu 5) — lich cu the tung ngay nam o LichDiTuyen.
   ================================================================================================ */
IF OBJECT_ID('TuyenBanHang', 'U') IS NULL
BEGIN
  CREATE TABLE TuyenBanHang (
    TuyenID     INT IDENTITY(1,1) PRIMARY KEY,
    MaTuyen     NVARCHAR(30)  NOT NULL UNIQUE,
    TenTuyen    NVARCHAR(150) NOT NULL,
    NhanVienID  INT           NULL,               -- nhan vien phu trach chinh cua tuyen
    -- '1'..'7' ngan cach dau phay theo thu trong tuan (2=thu Hai ... 8=Chu nhat de trung SQL DATEPART)
    ThuTrongTuan NVARCHAR(30) NULL,
    MoTa        NVARCHAR(500) NULL,
    TrangThai   NVARCHAR(20)  NOT NULL DEFAULT N'Đang dùng',
    CreatedAt   DATETIME2     NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT FK_TuyenBanHang_NV FOREIGN KEY (NhanVienID) REFERENCES NhanVien(NhanVienID)
  );
  PRINT '  + Bang TuyenBanHang';
END
ELSE PRINT '  = Bang TuyenBanHang da co';
GO

IF OBJECT_ID('TuyenChiTiet', 'U') IS NULL
BEGIN
  CREATE TABLE TuyenChiTiet (
    ID        INT IDENTITY(1,1) PRIMARY KEY,
    TuyenID   INT NOT NULL,
    ShopID    INT NOT NULL,
    ThuTu     INT NOT NULL DEFAULT 1,             -- thu tu ghe trong tuyen
    CONSTRAINT FK_TuyenChiTiet_Tuyen FOREIGN KEY (TuyenID) REFERENCES TuyenBanHang(TuyenID) ON DELETE CASCADE,
    CONSTRAINT FK_TuyenChiTiet_Shop  FOREIGN KEY (ShopID)  REFERENCES ShopBanLe(ShopID),
    CONSTRAINT UQ_TuyenChiTiet UNIQUE (TuyenID, ShopID)
  );
  PRINT '  + Bang TuyenChiTiet';
END
ELSE PRINT '  = Bang TuyenChiTiet da co';
GO

/* ================================================================================================
   3. LICH DI TUYEN (ke hoach): nhan vien X ngay Y di tuyen Z
   Khoa (NhanVienID, Ngay) trung khoa cua ChamCongNgay -> join thang ra ngay cong thuc te duoc.
   ================================================================================================ */
IF OBJECT_ID('LichDiTuyen', 'U') IS NULL
BEGIN
  CREATE TABLE LichDiTuyen (
    LichID      INT IDENTITY(1,1) PRIMARY KEY,
    NhanVienID  INT  NOT NULL,
    Ngay        DATE NOT NULL,
    TuyenID     INT  NULL,                        -- NULL = di tu do, khong theo tuyen khai truoc
    GhiChu      NVARCHAR(500) NULL,
    NguoiTaoID  INT  NULL,
    CreatedAt   DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT FK_LichDiTuyen_NV    FOREIGN KEY (NhanVienID) REFERENCES NhanVien(NhanVienID),
    CONSTRAINT FK_LichDiTuyen_Tuyen FOREIGN KEY (TuyenID)    REFERENCES TuyenBanHang(TuyenID),
    CONSTRAINT UQ_LichDiTuyen UNIQUE (NhanVienID, Ngay, TuyenID)
  );
  CREATE INDEX IX_LichDiTuyen_Ngay ON LichDiTuyen(Ngay);
  PRINT '  + Bang LichDiTuyen';
END
ELSE PRINT '  = Bang LichDiTuyen da co';
GO

/* ================================================================================================
   4. GHE THAM (thuc te) — moi lan tiep xuc voi shop la MOT DONG
   `LoaiTiepXuc`: 'GheTham' (co GPS) | 'GoiDien' | 'Zalo'
   `KhoangCachM`: khoang cach tu cho check-in den toa do shop (met) — tinh o backend bang Haversine,
                  luu lai de sau nay doi chieu duoc, khong phai tinh lai.
   `NgoaiVung`  : 1 = xa hon ban kinh cho phep (van luu, chi danh dau).
   `DonID`/`PhieuBHID`: neu lan ghe do lay duoc don / xuat luon phieu -> gan vao day de biet lan ghe
                  nao ra doanh so.
   ================================================================================================ */
IF OBJECT_ID('GheTham', 'U') IS NULL
BEGIN
  CREATE TABLE GheTham (
    GheThamID    INT IDENTITY(1,1) PRIMARY KEY,
    ShopID       INT           NOT NULL,
    NhanVienID   INT           NOT NULL,
    LichID       INT           NULL,              -- gan voi ke hoach ngay do (neu co)
    LoaiTiepXuc  NVARCHAR(20)  NOT NULL DEFAULT N'GheTham',
    ThoiGianVao  DATETIME2     NOT NULL DEFAULT SYSDATETIME(),
    ThoiGianRa   DATETIME2     NULL,
    Latitude     DECIMAL(10,7) NULL,
    Longitude    DECIMAL(10,7) NULL,
    KhoangCachM  INT           NULL,
    NgoaiVung    BIT           NOT NULL DEFAULT 0,
    KetQua       NVARCHAR(30)  NULL,              -- 'Có đơn' | 'Không đơn' | 'Đóng cửa' | 'Chăm sóc'
    Anh          NVARCHAR(500) NULL,
    GhiChu       NVARCHAR(MAX) NULL,
    DonID        INT           NULL,
    PhieuBHID    INT           NULL,
    NguoiTaoID   INT           NULL,
    CreatedAt    DATETIME2     NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT FK_GheTham_Shop  FOREIGN KEY (ShopID)     REFERENCES ShopBanLe(ShopID),
    CONSTRAINT FK_GheTham_NV    FOREIGN KEY (NhanVienID) REFERENCES NhanVien(NhanVienID),
    CONSTRAINT FK_GheTham_Lich  FOREIGN KEY (LichID)     REFERENCES LichDiTuyen(LichID)
  );
  CREATE INDEX IX_GheTham_NV_TG  ON GheTham(NhanVienID, ThoiGianVao);
  CREATE INDEX IX_GheTham_Shop   ON GheTham(ShopID);
  PRINT '  + Bang GheTham';
END
ELSE PRINT '  = Bang GheTham da co';
GO

/* ================================================================================================
   5. GAN SHOP + NHAN VIEN KINH DOANH VAO PHIEU BAN HANG  (nen tang tinh doanh so)
   ⚠️ NhanVienID KHAC NguoiTaoID: nguoi NHAP phieu thuong la ke toan/thu kho, con doanh so phai ghi
      cho NHAN VIEN KINH DOANH mang don ve. Suy tu NguoiTaoID -> Users.NhanVienID la SAI trong da so
      truong hop, nen tach hai cot.
   ================================================================================================ */
IF COL_LENGTH('PhieuBanHang', 'ShopID') IS NULL
BEGIN
  ALTER TABLE PhieuBanHang ADD ShopID INT NULL;
  PRINT '  + PhieuBanHang.ShopID';
END
GO
IF COL_LENGTH('PhieuBanHang', 'NhanVienID') IS NULL
BEGIN
  ALTER TABLE PhieuBanHang ADD NhanVienID INT NULL;
  PRINT '  + PhieuBanHang.NhanVienID';
END
GO
IF OBJECT_ID('FK_PhieuBanHang_Shop', 'F') IS NULL AND COL_LENGTH('PhieuBanHang', 'ShopID') IS NOT NULL
    ALTER TABLE PhieuBanHang ADD CONSTRAINT FK_PhieuBanHang_Shop FOREIGN KEY (ShopID) REFERENCES ShopBanLe(ShopID);
GO
IF OBJECT_ID('FK_PhieuBanHang_NVKD', 'F') IS NULL AND COL_LENGTH('PhieuBanHang', 'NhanVienID') IS NOT NULL
    ALTER TABLE PhieuBanHang ADD CONSTRAINT FK_PhieuBanHang_NVKD FOREIGN KEY (NhanVienID) REFERENCES NhanVien(NhanVienID);
GO

/* ================================================================================================
   6. VIEW DOANH SO NHAN VIEN  (theo PHIEU BAN HANG chua huy)
   Tra ve tung phieu kem Nam/Thang/Quy de man hinh chi viec GROUP BY - khong nhan dinh san muc thoi
   gian nao, tranh phai sua view moi lan doi cach xem.
   ================================================================================================ */
GO
CREATE OR ALTER VIEW vw_DoanhSoNVKD AS
SELECT p.PhieuBHID, p.SoPhieu, p.NgayBan,
       YEAR(p.NgayBan)                AS Nam,
       MONTH(p.NgayBan)               AS Thang,
       DATEPART(QUARTER, p.NgayBan)   AS Quy,
       p.NhanVienID, nv.HoTen AS TenNhanVien, nv.MaNhanVien,
       p.ShopID, s.MaShop, s.TenShop,
       ISNULL(s.NhaPhanPhoiID, p.KhachHangID) AS KhachHangID,
       kh.TenKhachHang,
       p.TenKhach, p.TongTienHang, p.TienCKNPP, p.TienTruocVAT, p.TienVAT, p.TongThanhToan, p.TongSLCai
FROM PhieuBanHang p
LEFT JOIN NhanVien  nv ON nv.NhanVienID  = p.NhanVienID
LEFT JOIN ShopBanLe s  ON s.ShopID       = p.ShopID
LEFT JOIN KhachHang kh ON kh.KhachHangID = ISNULL(s.NhaPhanPhoiID, p.KhachHangID)
WHERE p.TrangThai <> N'Đã hủy';
GO
PRINT '  + View vw_DoanhSoNVKD';

/* ================================================================================================
   7. DANG KY PHAN HE + PHAN QUYEN
   ================================================================================================ */
MERGE Modules AS t
USING (VALUES (N'DMS', N'Đi tuyến thị trường', 13)) AS s (ModuleCode, TenModule, ThuTu)
ON t.ModuleCode = s.ModuleCode
WHEN NOT MATCHED THEN INSERT (ModuleCode, TenModule, ThuTu) VALUES (s.ModuleCode, s.TenModule, s.ThuTu);
GO

/* Seed quyen = 0 cho moi nhom (Admin bo qua vi isAdmin luon duoc phep) - giong migration_v672. */
INSERT INTO Permissions (GroupID, ModuleID, CanView, CanCreate, CanEdit, CanDelete)
SELECT g.GroupID, m.ModuleID, 0, 0, 0, 0
FROM Groups g CROSS JOIN Modules m
WHERE m.ModuleCode = N'DMS' AND g.IsAdmin = 0
  AND NOT EXISTS (SELECT 1 FROM Permissions p WHERE p.GroupID = g.GroupID AND p.ModuleID = m.ModuleID);
GO

/* Ma chuc nang PHAI trung `key` trong getTabs() cua frontend/js/module.dms.js */
MERGE ChucNang AS t
USING (VALUES
    ('DMS', 'shop',     N'Shop bán lẻ',        1),
    ('DMS', 'tuyen',    N'Tuyến & lịch đi',    2),
    ('DMS', 'ghetham',  N'Ghé thăm / check-in', 3),
    ('DMS', 'lotrinh',  N'Lộ trình nhân viên', 4),
    ('DMS', 'doanhso',  N'Doanh số nhân viên', 5)
) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu)
ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
WHEN NOT MATCHED THEN INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu)
     VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu);
GO

/* ================================================================================================
   8. CAU HINH
   ================================================================================================ */
MERGE CauHinhHeThong AS t
USING (VALUES
    -- Ban kinh coi la "dung tai shop" khi check-in (met). Ngoai ban kinh van luu, chi danh dau do.
    ('DMS_BAN_KINH_CHECKIN_M', N'200'),
    -- 1 = bat buoc co anh moi luu duoc lan ghe tham (loai 'GheTham'); goi dien/Zalo khong bat.
    ('DMS_BAT_BUOC_ANH', N'1')
) AS s (ConfigKey, ConfigValue)
  ON t.ConfigKey = s.ConfigKey
WHEN NOT MATCHED THEN INSERT (ConfigKey, ConfigValue) VALUES (s.ConfigKey, s.ConfigValue);
GO

PRINT '';
PRINT '=== migration_v686 XONG ===';
PRINT '1) Quan ly User -> Ma tran phan quyen -> bat quyen module DMS cho nhom kinh doanh.';
PRINT '2) Tai khoan nhan vien di tuyen PHAI duoc gan NhanVienID (Quan ly User -> Sua tai khoan),';
PRINT '   khong co thi khong biet ghi ghe tham/doanh so cho ai.';
PRINT '3) Nhan vien mo app bang HTTPS (https://<may-chu>:3443) - http:// se khong xin duoc dinh vi.';
PRINT '4) Ban do dung Leaflet + OpenStreetMap: may nhan vien can vao duoc cdnjs.cloudflare.com';
PRINT '   va tile.openstreetmap.org. Chan thi phan ban do trong, cac phan khac van chay.';
PRINT 'PHAI pm2 restart qlnoibo (them backend/routes/dms.js + sua server.js).';
GO


//////////////////////////////////////////////////////////////////////////////////////////////////
PRINT '';
PRINT '=== CAI DAT XONG. Buoc tiep: Quan ly User -> Ma tran phan quyen -> cap quyen. ===';
GO
