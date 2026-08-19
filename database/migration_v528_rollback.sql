/* ================================================================
   MIGRATION v5.28 ROLLBACK (v5.29) — HOAN TAC "Phieu xuat Vat tu"
   ----------------------------------------------------------------
   Nguoi dung yeu cau tra lai 2 man hinh Xuat vai + Xuat NPL RIENG nhu cu (xuat TU DO, khong rang buoc
   lenh san xuat). Bo hoan toan ban gop "Phieu xuat Vat tu" (da lam o migration_v528.sql).

   Thu tu QUAN TRONG:
     1. Tao lai 2 view ton kho ve DINH NGHIA GOC (chi tru phieu cu) -> KHONG con phu thuoc 3 bang moi.
     2. Drop 3 bang PhieuXuatVatTu* (con -> cha theo FK).
     3. Xoa Module VATTU + ChucNang + Permissions.

   CANH BAO: neu da tao phieu xuat vat tu thu nghiem, du lieu do se MAT va ton kho tra ve truoc khi xuat
   (dung, vi cac phieu do khong con ton tai). Chay 1 lan. IDEMPOTENT.
   YEU CAU: da chay migration_v528.sql truoc do.
   ================================================================ */
USE QLNoiBo;
GO

/* ---------------- 1. Tao lai vw_TonCayVai GOC (chi tru PhieuXuatVaiChiTiet) ---------------- */
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
    SELECT CayID, SUM(KGXuat) AS KGXuatTong FROM PhieuXuatVaiChiTiet GROUP BY CayID
) x ON x.CayID = c.CayID;
GO

/* ---------------- 2. Tao lai vw_TonKhoPhuKien GOC (chi PhieuPhuKien) ---------------- */
IF OBJECT_ID('dbo.vw_TonKhoPhuKien', 'V') IS NOT NULL DROP VIEW dbo.vw_TonKhoPhuKien;
GO
CREATE VIEW vw_TonKhoPhuKien AS
SELECT
    dm.PhuKienID, dm.MaPhuKien, dm.TenPhuKien, lpk.TenLoai, dm.Size, dm.DonViCoBan,
    ISNULL(SUM(CASE WHEN p.LoaiPhieu = N'Nhập' THEN ct.SoLuong ELSE 0 END), 0) AS TongNhap,
    ISNULL(SUM(CASE WHEN p.LoaiPhieu = N'Xuất' THEN ct.SoLuong ELSE 0 END), 0) AS TongXuat,
    ISNULL(SUM(CASE WHEN p.LoaiPhieu = N'Nhập' THEN ct.SoLuong ELSE -ct.SoLuong END), 0) AS TonKho
FROM DanhMucPhuKien dm
LEFT JOIN LoaiPhuKien lpk ON lpk.LoaiPhuKienID = dm.LoaiPhuKienID
LEFT JOIN PhieuPhuKienChiTiet ct ON ct.PhuKienID = dm.PhuKienID
LEFT JOIN PhieuPhuKien p ON p.PhieuID = ct.PhieuID
GROUP BY dm.PhuKienID, dm.MaPhuKien, dm.TenPhuKien, lpk.TenLoai, dm.Size, dm.DonViCoBan;
GO

/* ---------------- 3. Drop 3 bang moi (con -> cha theo FK) ---------------- */
IF OBJECT_ID('dbo.PhieuXuatVatTuPhuKien', 'U') IS NOT NULL DROP TABLE dbo.PhieuXuatVatTuPhuKien;
IF OBJECT_ID('dbo.PhieuXuatVatTuVai', 'U') IS NOT NULL DROP TABLE dbo.PhieuXuatVatTuVai;
IF OBJECT_ID('dbo.PhieuXuatVatTu', 'U') IS NOT NULL DROP TABLE dbo.PhieuXuatVatTu;
GO

/* ---------------- 4. Xoa Module VATTU + ChucNang + Permissions ---------------- */
DELETE FROM Permissions WHERE ModuleID IN (SELECT ModuleID FROM Modules WHERE ModuleCode = N'VATTU');
DELETE FROM ChucNang WHERE ModuleCode = N'VATTU';
DELETE FROM Modules WHERE ModuleCode = N'VATTU';
GO

PRINT '=== migration_v528_rollback.sql hoan tat — da bo Phieu xuat Vat tu, tra ve 2 phieu xuat rieng ===';
GO
