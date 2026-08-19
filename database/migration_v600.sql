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
