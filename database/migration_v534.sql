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
