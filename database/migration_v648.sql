-- ================================================================
-- migration_v648.sql  (v5.53)
-- Dựng lại view vw_TonCayVai: thêm MetDaXuat (tổng SoMet đã xuất) + MetCon (SoMet nhập - MetDaXuat).
-- Giữ nguyên KhoVai + SoMet + các cột KG* của v646/v647.
-- An toàn chạy lại nhiều lần.
-- ================================================================
IF OBJECT_ID('vw_TonCayVai', 'V') IS NOT NULL DROP VIEW vw_TonCayVai;
GO
CREATE VIEW vw_TonCayVai AS
SELECT
    c.CayID, c.MaCay, c.VaiID, v.MaVai, v.MaPM, lv.TenLoaiVai, lv.MaLoai, ms.TenMau,
    c.KGNhap, c.SoMet, ISNULL(x.KGXuatTong, 0) AS KGDaXuat,
    c.KGNhap - ISNULL(x.KGXuatTong, 0) AS KGCon,
    ISNULL(x.MetXuatTong, 0) AS MetDaXuat,
    ISNULL(c.SoMet, 0) - ISNULL(x.MetXuatTong, 0) AS MetCon,
    c.TrangThai, c.NgayNhap, c.ViTriKho, c.QRCode,
    ISNULL(c.KhoVaiThucTe, v.KhoVai) AS KhoVai
FROM VaiCay c
JOIN DanhMucVai v ON v.VaiID = c.VaiID
LEFT JOIN LoaiVai lv ON lv.LoaiVaiID = v.LoaiVaiID
LEFT JOIN MauSac ms ON ms.MauSacID = v.MauSacID
LEFT JOIN (
    SELECT CayID, SUM(KGXuat) AS KGXuatTong, SUM(SoMet) AS MetXuatTong
    FROM PhieuXuatVaiChiTiet GROUP BY CayID
) x ON x.CayID = c.CayID;
GO
