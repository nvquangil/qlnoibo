/* ================================================================
   MIGRATION v5.28 (item 2) — PHIEU XUAT VAT TU (gop Phieu xuat Vai + Phieu xuat NPL)
   ----------------------------------------------------------------
   Nguoi dung chon Option 1 (gop THAT bang bang moi). 1 "Phieu xuat Vat tu" xuat CHUNG:
     - Vai CHINH + vai PHOI (theo tung CAY vai, KG) - rut ton VaiCay (qua vw_TonCayVai).
     - Phu kien / NPL (theo So luong) - rut ton phu kien (qua vw_TonKhoPhuKien).
   Mau cua vai CHINH tren phieu nay la mau THAT (tu DanhMucVai qua cay vai) -> chinh la khoa
   theo doi tien do Cat/May/Kho nhap theo mau (yeu cau nguoi dung: "MauSacID theo doi tien do se
   phu thuoc mau vai chinh theo phieu xuat vat tu"). Cong doan Cat lay cay vai da xuat cho don tu
   CA 2 nguon: PhieuXuatVaiChiTiet (cu) + PhieuXuatVatTuVai (moi) - se sua getVaiCayDaXuatChoDon()
   trong qlsx.js o buoc backend.

   Cach gop (Option 1) KHONG pha du lieu cu: 2 view ton kho (vw_TonCayVai, vw_TonKhoPhuKien) duoc
   TAO LAI de UNION them nguon xuat moi -> phieu cu (PhieuXuatVai/PhieuPhuKien) VAN tru ton nhu
   truoc, phieu moi cung tru ton. Cac man hinh "Phieu xuat kho vai" + "Phieu xuat phu kien" cu se
   duoc AN o buoc frontend (khong xoa route/bang - de doi soat lich su).

   Chay 1 lan. IDEMPOTENT. YEU CAU TIEN QUYET: schema.sql goc (co VaiCay/PhieuXuatVaiChiTiet/
   DanhMucPhuKien/PhieuPhuKien + 2 view tren) + migration_v5_chucnang.sql.
   ================================================================ */

USE QLNoiBo;
GO

/* ---------------- 1. PHIEU XUAT VAT TU (header + 2 bang chi tiet) ---------------- */
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'PhieuXuatVatTu')
BEGIN
    CREATE TABLE PhieuXuatVatTu (
        PhieuVatTuID INT IDENTITY(1,1) PRIMARY KEY,
        NgayXuat     DATE NOT NULL,
        MaDon        NVARCHAR(30) NULL,                                   -- so tham chieu tu do (tuy chon)
        DonHangID    INT NULL FOREIGN KEY REFERENCES DonHangSanXuat(DonHangID),  -- gan don (tuy chon)
        NguoiNhan    NVARCHAR(100) NULL,
        MucDich      NVARCHAR(150) NULL,
        GhiChu       NVARCHAR(255) NULL,
        NguoiTaoID   INT NULL FOREIGN KEY REFERENCES Users(UserID),
        CreatedAt    DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    PRINT 'Da tao PhieuXuatVatTu.';
END ELSE PRINT 'PhieuXuatVatTu da ton tai, bo qua.';
GO

-- Chi tiet VAI: moi dong = 1 cay vai (VaiCay) xuat, KieuVai = Chính/Phối, KGXuat.
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'PhieuXuatVatTuVai')
BEGIN
    CREATE TABLE PhieuXuatVatTuVai (
        ID           INT IDENTITY(1,1) PRIMARY KEY,
        PhieuVatTuID INT NOT NULL FOREIGN KEY REFERENCES PhieuXuatVatTu(PhieuVatTuID) ON DELETE CASCADE,
        CayID        INT NOT NULL FOREIGN KEY REFERENCES VaiCay(CayID),
        KieuVai      NVARCHAR(10) NOT NULL DEFAULT N'Chính',  -- Chính / Phối
        KGXuat       DECIMAL(10,2) NOT NULL
    );
    CREATE INDEX IX_PXVTVai_Phieu ON PhieuXuatVatTuVai(PhieuVatTuID);
    CREATE INDEX IX_PXVTVai_Cay ON PhieuXuatVatTuVai(CayID);
    PRINT 'Da tao PhieuXuatVatTuVai.';
END ELSE PRINT 'PhieuXuatVatTuVai da ton tai, bo qua.';
GO

-- Chi tiet PHU KIEN / NPL: moi dong = 1 phu kien, SoLuong + DonVi.
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'PhieuXuatVatTuPhuKien')
BEGIN
    CREATE TABLE PhieuXuatVatTuPhuKien (
        ID           INT IDENTITY(1,1) PRIMARY KEY,
        PhieuVatTuID INT NOT NULL FOREIGN KEY REFERENCES PhieuXuatVatTu(PhieuVatTuID) ON DELETE CASCADE,
        PhuKienID    INT NOT NULL FOREIGN KEY REFERENCES DanhMucPhuKien(PhuKienID),
        SoLuong      DECIMAL(14,2) NOT NULL,
        DonVi        NVARCHAR(30) NULL,
        GhiChu       NVARCHAR(255) NULL
    );
    CREATE INDEX IX_PXVTPk_Phieu ON PhieuXuatVatTuPhuKien(PhieuVatTuID);
    PRINT 'Da tao PhieuXuatVatTuPhuKien.';
END ELSE PRINT 'PhieuXuatVatTuPhuKien da ton tai, bo qua.';
GO

/* ---------------- 2. TAO LAI vw_TonCayVai - UNION them PhieuXuatVatTuVai ---------------- */
-- Ton cay vai = KGNhap - TONG KG da xuat qua CA 2 loai phieu (cu + moi). Phieu cu van tru ton nhu truoc.
IF OBJECT_ID('dbo.vw_TonCayVai', 'V') IS NOT NULL DROP VIEW dbo.vw_TonCayVai;
GO
CREATE VIEW vw_TonCayVai AS
SELECT
    c.CayID, c.MaCay, c.VaiID, v.MaVai, v.MaPM, lv.TenLoaiVai, lv.MaLoai, ms.TenMau,
    c.KGNhap, ISNULL(x.KGXuatTong, 0) AS KGDaXuat,
    c.KGNhap - ISNULL(x.KGXuatTong, 0) AS KGCon,
    c.TrangThai, c.NgayNhap, c.ViTriKho, c.QRCode
FROM VaiCay c
JOIN DanhMucVai v ON v.VaiID = c.VaiID
LEFT JOIN LoaiVai lv ON lv.LoaiVaiID = v.LoaiVaiID
LEFT JOIN MauSac ms ON ms.MauSacID = v.MauSacID
LEFT JOIN (
    SELECT CayID, SUM(KGXuat) AS KGXuatTong FROM (
        SELECT CayID, KGXuat FROM PhieuXuatVaiChiTiet
        UNION ALL
        SELECT CayID, KGXuat FROM PhieuXuatVatTuVai
    ) z GROUP BY CayID
) x ON x.CayID = c.CayID;
GO

/* ---------------- 3. TAO LAI vw_TonKhoPhuKien - UNION them PhieuXuatVatTuPhuKien (luon la Xuat) ---------------- */
IF OBJECT_ID('dbo.vw_TonKhoPhuKien', 'V') IS NOT NULL DROP VIEW dbo.vw_TonKhoPhuKien;
GO
CREATE VIEW vw_TonKhoPhuKien AS
SELECT
    dm.PhuKienID, dm.MaPhuKien, dm.TenPhuKien, lpk.TenLoai, dm.Size, dm.DonViCoBan,
    ISNULL(SUM(CASE WHEN m.Loai = N'Nhập' THEN m.SoLuong ELSE 0 END), 0) AS TongNhap,
    ISNULL(SUM(CASE WHEN m.Loai = N'Xuất' THEN m.SoLuong ELSE 0 END), 0) AS TongXuat,
    ISNULL(SUM(CASE WHEN m.Loai = N'Nhập' THEN m.SoLuong ELSE -m.SoLuong END), 0) AS TonKho
FROM DanhMucPhuKien dm
LEFT JOIN LoaiPhuKien lpk ON lpk.LoaiPhuKienID = dm.LoaiPhuKienID
LEFT JOIN (
    -- Nguon cu: phieu phu kien (Nhap/Xuat)
    SELECT ct.PhuKienID, p.LoaiPhieu AS Loai, ct.SoLuong
    FROM PhieuPhuKienChiTiet ct JOIN PhieuPhuKien p ON p.PhieuID = ct.PhieuID
    UNION ALL
    -- Nguon moi: phieu xuat vat tu (luon la Xuat)
    SELECT PhuKienID, N'Xuất' AS Loai, SoLuong FROM PhieuXuatVatTuPhuKien
) m ON m.PhuKienID = dm.PhuKienID
GROUP BY dm.PhuKienID, dm.MaPhuKien, dm.TenPhuKien, lpk.TenLoai, dm.Size, dm.DonViCoBan;
GO

/* ---------------- 4. Module VATTU + ChucNang + Permissions ---------------- */
IF NOT EXISTS (SELECT 1 FROM Modules WHERE ModuleCode = N'VATTU')
    INSERT INTO Modules (ModuleCode, TenModule, ThuTu) VALUES (N'VATTU', N'Xuất vật tư', 10);
GO
-- Cap quyen day du cho nhom 'Kho' (von quan ly xuat vai + phu kien); nhom khac = 0 (Admin bypass).
INSERT INTO Permissions (GroupID, ModuleID, CanView, CanCreate, CanEdit, CanDelete)
SELECT g.GroupID, m.ModuleID,
       CASE WHEN g.TenNhom = N'Kho' THEN 1 ELSE 0 END,
       CASE WHEN g.TenNhom = N'Kho' THEN 1 ELSE 0 END,
       CASE WHEN g.TenNhom = N'Kho' THEN 1 ELSE 0 END,
       CASE WHEN g.TenNhom = N'Kho' THEN 1 ELSE 0 END
FROM Groups g CROSS JOIN Modules m
WHERE m.ModuleCode = N'VATTU' AND g.TenNhom <> N'Admin'
  AND NOT EXISTS (SELECT 1 FROM Permissions p WHERE p.GroupID = g.GroupID AND p.ModuleID = m.ModuleID);
GO
MERGE ChucNang AS t
USING (VALUES ('VATTU','xuatvattu', N'Phiếu xuất vật tư', 1)) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu)
ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
WHEN NOT MATCHED THEN INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu) VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu);
GO

PRINT '=== migration_v528.sql (Phieu xuat Vat tu) hoan tat ===';
GO
