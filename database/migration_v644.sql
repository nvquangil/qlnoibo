-- ================================================================
-- migration_v644.sql  (v5.45)
-- (1) Thêm cột KhoVai vào view vw_TonCayVai để IN LÊN TEM cây vải.
--     KhoVai = ISNULL(VaiCay.KhoVaiThucTe, DanhMucVai.KhoVai) (ưu tiên khổ thực tế của cây).
-- (2) Bảng CauHinh (key-value) lưu cấu hình chung — dùng cho "Máy in tem qua mạng" (khóa 'MAY_IN_TEM').
-- An toàn chạy lại nhiều lần.
-- ================================================================

IF OBJECT_ID('vw_TonCayVai', 'V') IS NOT NULL DROP VIEW vw_TonCayVai;
GO
CREATE VIEW vw_TonCayVai AS
SELECT
    c.CayID, c.MaCay, c.VaiID, v.MaVai, v.MaPM, lv.TenLoaiVai, lv.MaLoai, ms.TenMau,
    c.KGNhap, ISNULL(x.KGXuatTong, 0) AS KGDaXuat,
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

IF OBJECT_ID('CauHinh', 'U') IS NULL
CREATE TABLE CauHinh (
    Khoa       NVARCHAR(80)  NOT NULL PRIMARY KEY,
    GiaTri     NVARCHAR(MAX) NULL,
    UpdatedAt  DATETIME2     NULL
);
GO
