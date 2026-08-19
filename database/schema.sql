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
