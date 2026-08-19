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
