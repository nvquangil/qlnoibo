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
