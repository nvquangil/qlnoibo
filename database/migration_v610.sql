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
