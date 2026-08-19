-- ================================================================
-- migration_v646.sql  (v5.50)
-- (1) ChucNang QLSX 'chidinhnpl' — tách "Chỉ định NPL" ra tab riêng
--     trong Quản lý sản xuất (trước đây là 1 mục con của "Tài liệu may/Đóng gói").
-- (2) Thêm cột SoMet (số mét) cho:
--       - VaiCay               (phiếu NHẬP kho vải — số mét mỗi cây)
--       - PhieuXuatVaiChiTiet  (phiếu XUẤT kho vải — số mét mỗi dòng)
--       - ChiDinhVaiSX         (Chỉ định vải SX — số mét yêu cầu)
-- (3) Dựng lại view vw_TonCayVai để trả thêm SoMet (tồn theo cây + bản in tem).
-- An toàn chạy lại nhiều lần.
-- ================================================================

/* ---------- (1) ChucNang: Chỉ định NPL (tab riêng của QLSX) ---------- */
MERGE ChucNang AS t
USING (VALUES ('QLSX', 'chidinhnpl', N'Chỉ định NPL', 8)) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu)
ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
WHEN NOT MATCHED THEN
    INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu) VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu);
GO

/* ---------- (2) Cột SoMet ---------- */
IF COL_LENGTH('VaiCay', 'SoMet') IS NULL
    ALTER TABLE VaiCay ADD SoMet DECIMAL(10, 2) NULL;
GO
IF COL_LENGTH('PhieuXuatVaiChiTiet', 'SoMet') IS NULL
    ALTER TABLE PhieuXuatVaiChiTiet ADD SoMet DECIMAL(10, 2) NULL;
GO
IF COL_LENGTH('ChiDinhVaiSX', 'SoMet') IS NULL
    ALTER TABLE ChiDinhVaiSX ADD SoMet DECIMAL(10, 2) NULL;
GO

/* ---------- (3) view vw_TonCayVai + SoMet (giữ nguyên KhoVai của v644) ---------- */
IF OBJECT_ID('vw_TonCayVai', 'V') IS NOT NULL DROP VIEW vw_TonCayVai;
GO
CREATE VIEW vw_TonCayVai AS
SELECT
    c.CayID, c.MaCay, c.VaiID, v.MaVai, v.MaPM, lv.TenLoaiVai, lv.MaLoai, ms.TenMau,
    c.KGNhap, c.SoMet, ISNULL(x.KGXuatTong, 0) AS KGDaXuat,
    c.KGNhap - ISNULL(x.KGXuatTong, 0) AS KGCon,
    c.TrangThai, c.NgayNhap, c.ViTriKho, c.QRCode,
    ISNULL(c.KhoVaiThucTe, v.KhoVai) AS KhoVai
FROM VaiCay c
JOIN DanhMucVai v ON v.VaiID = c.VaiID
LEFT JOIN LoaiVai lv ON lv.LoaiVaiID = v.LoaiVaiID
LEFT JOIN MauSac ms ON ms.MauSacID = v.MauSacID
LEFT JOIN (
    SELECT CayID, SUM(KGXuat) AS KGXuatTong FROM PhieuXuatVaiChiTiet GROUP BY CayID
) x ON x.CayID = c.CayID;
GO
