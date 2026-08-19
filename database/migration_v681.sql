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
