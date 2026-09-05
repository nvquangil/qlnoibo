/* ================================================================================================
   migration_v695.sql   (v7.65)
   TAI LIEU MAY / DONG GOI  ->  them loai tai lieu "THONG KE CHI TIET"

   Bang ke cac CHI TIET (piece) cua san pham, lay tu file Excel cua khach:
        Piece Name | Material | Quantity | Pair | Opposite | Piece Image | Tong so luong
   · Nhieu ban co ten tren cung mot lenh SX — y het "Thong so ky thuat" (cot TenPhieu), va cung co
     ban MAU dung chung (LaMau = 1, DonHangID NULL).
   · `AnhDaiDien`: anh cua ma hang, MAC DINH lay theo lenh SX luc IN; cot nay chi luu khi nguoi dung
     TAI ANH KHAC de len (de trong = dung anh cua ma hang).
   · `AnhChiTiet` cua tung dong = duong dan file (/uploads/...). Anh trong cot "Piece Image" cua file
     Excel khach gui KHONG phai anh dan vao ma la HINH VE FREEFORM cua Excel; luc nhap file, he thong
     doi chung sang SVG roi GHI THANH FILE trong backend/uploads — xem utils/docHinhVeExcel.js.
     Vi vay cot nay chi la duong dan ngan, KHONG nhet ca anh vao CSDL.

   ⚠️ Dat NVARCHAR(500) cho AnhChiTiet chu khong phai NVARCHAR(50) nhu vai cot duong dan cu: ten file
   sinh tu ma hang + moc thoi gian de dai het 60-80 ky tu, cat ngan la mat anh am tham.
   ================================================================================================ */
IF DB_NAME() <> N'QLNoiBo'
BEGIN
    RAISERROR (N'!! DANG KHONG O DATABASE QLNoiBo. Chon dung database roi chay lai.', 20, 1) WITH LOG;
    SET NOEXEC ON;
END
GO

IF OBJECT_ID('TaiLieuThongKeChiTiet') IS NULL
BEGIN
    CREATE TABLE TaiLieuThongKeChiTiet (
        ID           INT IDENTITY(1,1) PRIMARY KEY,
        DonHangID    INT NULL FOREIGN KEY REFERENCES DonHangSanXuat(DonHangID) ON DELETE CASCADE,
        TenPhieu     NVARCHAR(150) NULL,          -- nhieu ban tren 1 lenh SX (vd: Ao / Quan / Dot 1)
        LaMau        BIT NOT NULL DEFAULT 0,      -- 1 = ban MAU dung chung (DonHangID = NULL)
        TenMau       NVARCHAR(150) NULL,
        MaHang       NVARCHAR(50) NULL,
        DienGiai     NVARCHAR(255) NULL,
        NgayCapNhat  DATE NULL,
        AnhDaiDien   NVARCHAR(500) NULL,          -- de trong = dung anh cua ma hang tren lenh SX
        GhiChu       NVARCHAR(MAX) NULL,
        NguoiLapID   INT NULL FOREIGN KEY REFERENCES Users(UserID),
        CreatedAt    DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        UpdatedAt    DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    CREATE INDEX IX_TLTKCT_DonHang ON TaiLieuThongKeChiTiet(DonHangID);
    PRINT '  + Da tao bang TaiLieuThongKeChiTiet';
END
ELSE PRINT '  = TaiLieuThongKeChiTiet da co, bo qua';
GO

IF OBJECT_ID('TaiLieuThongKeChiTietDong') IS NULL
BEGIN
    CREATE TABLE TaiLieuThongKeChiTietDong (
        ID          INT IDENTITY(1,1) PRIMARY KEY,
        TaiLieuID   INT NOT NULL FOREIGN KEY REFERENCES TaiLieuThongKeChiTiet(ID) ON DELETE CASCADE,
        ThuTu       INT NOT NULL DEFAULT 0,
        PieceName   NVARCHAR(255) NULL,           -- sua duoc cho de nhin, khong bat theo nguyen van file
        Material    NVARCHAR(100) NULL,
        Quantity    NVARCHAR(50)  NULL,           -- de chuoi: file khach co the ghi "1", "2 (x2)"...
        Pair        NVARCHAR(50)  NULL,
        Opposite    NVARCHAR(100) NULL,
        AnhChiTiet  NVARCHAR(500) NULL,           -- duong dan /uploads/... (SVG duong rap hoac anh)
        TongSoLuong NVARCHAR(50)  NULL,           -- CO NGUOI GO TAY, khong tinh tu cot nao khac
        GhiChu      NVARCHAR(500) NULL
    );
    CREATE INDEX IX_TLTKCTD_TaiLieu ON TaiLieuThongKeChiTietDong(TaiLieuID);
    PRINT '  + Da tao bang TaiLieuThongKeChiTietDong';
END
ELSE PRINT '  = TaiLieuThongKeChiTietDong da co, bo qua';
GO

PRINT '';
PRINT '=== migration_v695 XONG ===';
PRINT 'PHAI pm2 restart qlnoibo + Ctrl+F5.';
PRINT '';
PRINT 'Tu day: Tai lieu may/Dong goi co them muc "Thong ke chi tiet".';
PRINT '  · Tai file Excel len: cot Piece Name / Material / Quantity / Pair / Opposite doc tu o;';
PRINT '    cot Piece Image la HINH VE cua Excel -> tu doi sang SVG va tai len thanh file.';
PRINT '  · Cot "Tong so luong" go tay, khong phu thuoc so nao khac.';
PRINT '  · Ban in co anh dai dien hang (lay theo ma hang cua lenh SX, tai anh khac de len duoc).';
GO
