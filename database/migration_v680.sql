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
