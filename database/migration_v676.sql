/* ================================================================================================
   migration_v676.sql   (v6.66)
   1) PHIEU NHAP LAI  - nhap ve hang khach TRA LAI, GIAM cong no khach hang.
   2) TRA HANG NHA CUNG CAP - phieu XUAT kho vai / phu kien co the danh dau la tra ve NCC,
      GIAM cong no phai tra cho NCC do.

   VI SAO PHIEU NHAP LAI DUNG BANG RIENG (khong nhet vao PhieuBanHang voi so am):
     - So phieu rieng (NL26001) de nguoi dung khong nham voi phieu ban (PX26001).
     - Bao cao doanh thu dang SUM thang tren PhieuBanHang; nhet so am vao do se lam moi bao cao
       cu doi nghia im lang. Bang rieng thi bao cao cu giu nguyen ket qua, muon tru thi tru co y thuc.

   TON KHO: phieu nhap lai HOAN TON = TheKhoChiTietMau.XuatCai -= SoLuong(don vi chinh).
     KHONG cong vao NhapCai - NhapCai la so da nhap tu san xuat, cong vao do se lam sai bao cao nhap.

   CONG NO KHACH: TongThanhToan cua phieu nhap lai duoc TRU vao cong no. Phai sua DONG BO 3 cho
   (repo da tung bi lech vi co 2 ban tinh cong no song song):
     - congno.js  congNoKhachHang()   (bang tong hop)
     - congno.js  soChiTietKH()       (so chi tiet)
     - banhang.js phan "cong no truoc phieu" in cuoi phieu ban hang
   ================================================================================================ */

/* ---------------- 1. PHIEU NHAP LAI (hang khach tra) ---------------- */
IF OBJECT_ID('PhieuNhapLai', 'U') IS NULL
BEGIN
  CREATE TABLE PhieuNhapLai (
    PhieuNLID       INT IDENTITY(1,1) PRIMARY KEY,
    SoPhieu         NVARCHAR(30)  NOT NULL UNIQUE,      -- NL + yy + 3 so, vd NL26001
    NgayNhap        DATE          NOT NULL,
    KhachHangID     INT           NULL,
    TenKhach        NVARCHAR(150) NOT NULL,             -- nhom cong no theo TEN (giong PhieuBanHang)
    SDT             NVARCHAR(30)  NULL,
    DiaChi          NVARCHAR(255) NULL,
    -- Phieu XUAT goc. NULL = tu tim ma hang (backend van lay gia tu lan ban gan nhat cua khach do).
    PhieuBHID       INT           NULL,
    PhanTramCKNPP   DECIMAL(5,2)  NULL DEFAULT 0,
    PhanTramVAT     DECIMAL(5,2)  NULL DEFAULT 0,
    TongTienHang    DECIMAL(18,2) NULL DEFAULT 0,
    TienCKNPP       DECIMAL(18,2) NULL DEFAULT 0,
    TienTruocVAT    DECIMAL(18,2) NULL DEFAULT 0,
    TienVAT         DECIMAL(18,2) NULL DEFAULT 0,
    TongThanhToan   DECIMAL(18,2) NULL DEFAULT 0,       -- so TRU vao cong no khach
    TongSLCai       INT           NULL DEFAULT 0,
    LyDo            NVARCHAR(255) NULL,                 -- loi hang / sai mau / khach doi y...
    TrangThai       NVARCHAR(20)  NOT NULL DEFAULT N'Hoàn thành',   -- Hoàn thành / Đã hủy
    GhiChu          NVARCHAR(500) NULL,
    NguoiTaoID      INT           NULL,
    CreatedAt       DATETIME2     NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT FK_PhieuNhapLai_Khach  FOREIGN KEY (KhachHangID) REFERENCES KhachHang(KhachHangID),
    CONSTRAINT FK_PhieuNhapLai_PhieuBH FOREIGN KEY (PhieuBHID)  REFERENCES PhieuBanHang(PhieuBHID),
    CONSTRAINT FK_PhieuNhapLai_User   FOREIGN KEY (NguoiTaoID)  REFERENCES Users(UserID)
  );
  CREATE INDEX IX_PhieuNhapLai_Khach ON PhieuNhapLai(TenKhach);
  CREATE INDEX IX_PhieuNhapLai_Ngay  ON PhieuNhapLai(NgayNhap);
  PRINT '  + Da tao bang PhieuNhapLai';
END
ELSE PRINT '  = PhieuNhapLai da co, bo qua';
GO

IF OBJECT_ID('PhieuNhapLaiChiTiet', 'U') IS NULL
BEGIN
  CREATE TABLE PhieuNhapLaiChiTiet (
    ID              INT IDENTITY(1,1) PRIMARY KEY,
    PhieuNLID       INT           NOT NULL,
    MaHangID        INT           NOT NULL,
    MauSacID        INT           NULL,
    SoLuong         DECIMAL(14,2) NOT NULL,
    DonVi           NVARCHAR(20)  NULL,
    SoLuongCai      INT           NULL,                 -- quy ve CAI: dung cho TIEN va ban in
    SoLuongQuyDoi   DECIMAL(14,2) NULL,
    DonViQuyDoi     NVARCHAR(20)  NULL,
    -- Gia KHOA CUNG theo phieu xuat goc (yeu cau nguoi dung): tra lai dung so da ghi no.
    GiaBanLe        DECIMAL(14,2) NULL,
    PhanTramCKShop  DECIMAL(5,2)  NULL,
    GiaBan          DECIMAL(14,2) NULL,
    ThanhTien       DECIMAL(18,2) NULL,
    -- Dong goc tren phieu ban hang - de doi chieu va chan tra qua so da ban.
    PhieuBHChiTietID INT          NULL,
    GhiChu          NVARCHAR(255) NULL,
    CONSTRAINT FK_PNLCT_Phieu  FOREIGN KEY (PhieuNLID) REFERENCES PhieuNhapLai(PhieuNLID) ON DELETE CASCADE,
    CONSTRAINT FK_PNLCT_MaHang FOREIGN KEY (MaHangID)  REFERENCES TheKhoHangHoa(MaHangID),
    CONSTRAINT FK_PNLCT_Mau    FOREIGN KEY (MauSacID)  REFERENCES MauSac(MauSacID)
  );
  CREATE INDEX IX_PhieuNhapLaiChiTiet_Phieu ON PhieuNhapLaiChiTiet(PhieuNLID);
  PRINT '  + Da tao bang PhieuNhapLaiChiTiet';
END
ELSE PRINT '  = PhieuNhapLaiChiTiet da co, bo qua';
GO

/* ---------------- 2. TRA HANG NHA CUNG CAP ----------------
   PHU KIEN: bang PhieuPhuKien DA CO san NCC_ID (migration_v4) - chi can them co LaTraNCC.
   VAI:      bang PhieuXuatVai CHUA co NCC_ID - phieu xuat vai truoc gio chi xuat cho san xuat.
   Don gia de giam no:
     - Vai:      lay VaiCay.DonGiaNhap cua chinh cay do -> khong can nguoi dung go, khong lech.
     - Phu kien: PhieuPhuKienChiTiet.DonGia (cot da co, form Xuat truoc gio khong gui) -> khi tich
                 "Tra NCC" thi form mo cot don gia, dien san gia tu phieu NHAP gan nhat cua NCC do. */
IF COL_LENGTH('PhieuXuatVai', 'LaTraNCC') IS NULL
BEGIN
  ALTER TABLE PhieuXuatVai ADD LaTraNCC BIT NOT NULL DEFAULT 0;
  PRINT '  + PhieuXuatVai.LaTraNCC';
END
ELSE PRINT '  = PhieuXuatVai.LaTraNCC da co';
GO

IF COL_LENGTH('PhieuXuatVai', 'NCC_ID') IS NULL
BEGIN
  ALTER TABLE PhieuXuatVai ADD NCC_ID INT NULL;
  PRINT '  + PhieuXuatVai.NCC_ID';
END
ELSE PRINT '  = PhieuXuatVai.NCC_ID da co';
GO

IF COL_LENGTH('PhieuXuatVai', 'NCC_ID') IS NOT NULL
   AND OBJECT_ID('FK_PhieuXuatVai_NCC', 'F') IS NULL
   AND OBJECT_ID('NhaCungCap', 'U') IS NOT NULL
BEGIN
  ALTER TABLE PhieuXuatVai ADD CONSTRAINT FK_PhieuXuatVai_NCC
    FOREIGN KEY (NCC_ID) REFERENCES NhaCungCap(NCC_ID);
  PRINT '  + FK PhieuXuatVai.NCC_ID -> NhaCungCap';
END
GO

IF COL_LENGTH('PhieuPhuKien', 'LaTraNCC') IS NULL
BEGIN
  ALTER TABLE PhieuPhuKien ADD LaTraNCC BIT NOT NULL DEFAULT 0;
  PRINT '  + PhieuPhuKien.LaTraNCC';
END
ELSE PRINT '  = PhieuPhuKien.LaTraNCC da co';
GO

/* ---------------- 3. Chuc nang / phan quyen ----------------
   Key PHAI trung voi key tab o frontend getTabs() (module.khohang.js) - effectivePerm tra theo
   'KHOHANG:' + activeTab. Dat sai key = tab luon bi coi la khong co quyen. */
MERGE ChucNang AS t
USING (VALUES
    ('KHOHANG','nhaplai', N'Phiếu nhập lại (khách trả)', 6)
) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu)
ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
WHEN NOT MATCHED THEN INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu)
     VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu);
GO

PRINT '';
PRINT '=== migration_v676 XONG ===';
PRINT 'NHO: vao Phan quyen -> cap chuc nang KHOHANG/nhaplai cho cac nhom can dung,';
PRINT '     neu khong tab "Phieu nhap lai" se khong hien ra.';
GO
