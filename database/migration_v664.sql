/* ================================================================
   MIGRATION v6.04 — Định mức & Hao hụt: chuyển sang Quản lý sản xuất, khai THEO LỆNH SX + THEO LOẠI VẢI
   ----------------------------------------------------------------
   Yeu cau:
     - Dua chuc nang "Dinh muc / Hao hut" tu phan he Kho vai sang phan he Quan ly san xuat.
     - Chon lenh SX tu DANH SACH lenh (khong con go tay "Ten mau hang" phai khop chu voi Ten san pham -
       cach cu rat de sai chinh ta/khoang trang -> khong khop -> bao cao hao hut trong tron).
     - Dinh muc khai theo LOAI VAI (LoaiVai) chu khong theo tung MA VAI/ma cay, va CHON DUOC don vi tinh
       (Kg hoac Met) vi vai co the quan ly theo kg hoac theo met.
     - "SL hoan thanh" lay tu SO LUONG NHAP KHO (tien do cong doan 'KN') thay vi TongSoLuong x % hoan thanh.

   Cach lam: GIU bang DinhMucVai da co (khong mat du lieu cu), THEM 3 cot:
     - DonHangID  -> khai theo dung 1 lenh SX (NULL = dong cu khai theo MauHang, van doc duoc)
     - LoaiVaiID  -> loai vai (thay cho VaiID = ma vai cu the; cot VaiID GIU LAI cho du lieu cu)
     - DonViTinh  -> N'Kg' / N'Mét' (mac dinh Kg cho du lieu cu -> giu nguyen y nghia cot DinhMucKGTrenSP)
   + seed ChucNang('QLSX','dinhmuc') de tab moi hien theo phan quyen.
   ChucNang('KHOVAI','dinhmuc') GIU NGUYEN (mo coi) - khong xoa de khong lam hong ma tran phan quyen cu.

   Chay 1 lan. IDEMPOTENT. YEU CAU: schema.sql (bang DinhMucVai, LoaiVai, ChucNang).
   ================================================================ */
USE QLNoiBo;
GO
IF DB_NAME() <> 'QLNoiBo'
BEGIN
    RAISERROR('KHONG ket noi duoc database QLNoiBo - dung migration.', 16, 1);
    SET NOEXEC ON;
END
GO

/* ---------------- 1. 3 cot moi tren DinhMucVai ---------------- */
IF COL_LENGTH('DinhMucVai', 'DonHangID') IS NULL
BEGIN
    ALTER TABLE DinhMucVai ADD DonHangID INT NULL;
    PRINT 'Da them DinhMucVai.DonHangID.';
END ELSE PRINT 'DinhMucVai.DonHangID da co, bo qua.';
GO
IF COL_LENGTH('DinhMucVai', 'LoaiVaiID') IS NULL
BEGIN
    ALTER TABLE DinhMucVai ADD LoaiVaiID INT NULL;
    PRINT 'Da them DinhMucVai.LoaiVaiID.';
END ELSE PRINT 'DinhMucVai.LoaiVaiID da co, bo qua.';
GO
IF COL_LENGTH('DinhMucVai', 'DonViTinh') IS NULL
BEGIN
    ALTER TABLE DinhMucVai ADD DonViTinh NVARCHAR(20) NULL;
    PRINT 'Da them DinhMucVai.DonViTinh.';
END ELSE PRINT 'DinhMucVai.DonViTinh da co, bo qua.';
GO

-- Du lieu cu: dinh muc von la KG/SP -> gan don vi Kg de bao cao hieu dung.
UPDATE DinhMucVai SET DonViTinh = N'Kg' WHERE DonViTinh IS NULL OR LTRIM(RTRIM(DonViTinh)) = N'';
GO

-- Du lieu cu tro toi VaiID (ma vai): suy ra LoaiVaiID tuong ung de van hien dung o ban moi.
UPDATE dm SET dm.LoaiVaiID = dv.LoaiVaiID
FROM DinhMucVai dm JOIN DanhMucVai dv ON dv.VaiID = dm.VaiID
WHERE dm.LoaiVaiID IS NULL AND dm.VaiID IS NOT NULL;
GO

-- Du lieu cu khop theo TEN san pham: gan luon DonHangID neu ten khop DUY NHAT 1 lenh SX
-- (khop nhieu lenh thi de NULL, dong do van doc duoc theo MauHang nhu truoc).
UPDATE dm SET dm.DonHangID = x.DonHangID
FROM DinhMucVai dm
CROSS APPLY (
    SELECT MIN(d.DonHangID) AS DonHangID, COUNT(*) AS SoLenh
    FROM DonHangSanXuat d
    WHERE LTRIM(RTRIM(LOWER(d.TenSanPham))) = LTRIM(RTRIM(LOWER(dm.MauHang)))
) x
WHERE dm.DonHangID IS NULL AND x.SoLenh = 1;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_DinhMucVai_Don')
    CREATE INDEX IX_DinhMucVai_Don ON DinhMucVai(DonHangID);
GO

/* ---------------- 2. ChucNang cho tab moi trong QLSX ---------------- */
IF OBJECT_ID('dbo.ChucNang', 'U') IS NULL
    PRINT '!! Chua co bang ChucNang - bo qua phan seed phan quyen.';
ELSE
BEGIN
    MERGE ChucNang AS t
    USING (VALUES ('QLSX', 'dinhmuc', N'Định mức & Hao hụt', 13)) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu)
      ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
    WHEN NOT MATCHED THEN
      INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu)
      VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu);
    PRINT 'Da seed ChucNang QLSX/dinhmuc (nho CAP QUYEN cho nhom/nguoi dung trong Ma tran phan quyen).';
END
GO

PRINT '';
PRINT '=== MIGRATION v664 HOAN TAT ===';
SELECT COUNT(*) AS SoDongDinhMuc,
       SUM(CASE WHEN DonHangID IS NOT NULL THEN 1 ELSE 0 END) AS DaGanLenhSX,
       SUM(CASE WHEN LoaiVaiID IS NOT NULL THEN 1 ELSE 0 END) AS DaGanLoaiVai
FROM DinhMucVai;
GO
SET NOEXEC OFF;
GO
