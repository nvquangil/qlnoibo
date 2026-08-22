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
