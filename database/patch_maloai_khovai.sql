/* ================================================================
   PATCH — them cot MaLoai (Ma loai vai) vao 2 view Kho vai
   Ap dung cho database DA CHAY schema.sql/migration_v4.sql truoc do (cot LoaiVai.MaLoai da co san
   tu ban dau, patch nay chi lo la CHUA duoc SELECT ra trong vw_TonKhoVai/vw_TonCayVai).
   Dung CREATE OR ALTER VIEW nen an toan chay lai nhieu lan (idempotent), khong dung/xoa du lieu.
   ================================================================ */

USE QLNoiBo;
GO

CREATE OR ALTER VIEW vw_TonKhoVai AS
SELECT
    v.VaiID, v.MaVai, lv.TenLoaiVai, lv.MaLoai, ms.TenMau,
    v.KhoVai, v.GSM, v.ViTriKho, v.TonToiThieuKG,
    ISNULL(SUM(c.KGNhap), 0) AS TongKGNhap,
    ISNULL(SUM(x.KGXuatTong), 0) AS TongKGXuat,
    ISNULL(SUM(c.KGNhap), 0) - ISNULL(SUM(x.KGXuatTong), 0) AS TonKG,
    COUNT(DISTINCT c.CayID) AS TongCayNhap,
    SUM(CASE WHEN c.TrangThai <> N'Hết' THEN 1 ELSE 0 END) AS CayConTon
FROM DanhMucVai v
LEFT JOIN LoaiVai lv ON lv.LoaiVaiID = v.LoaiVaiID
LEFT JOIN MauSac ms ON ms.MauSacID = v.MauSacID
LEFT JOIN VaiCay c ON c.VaiID = v.VaiID
LEFT JOIN (
    SELECT CayID, SUM(KGXuat) AS KGXuatTong FROM PhieuXuatVaiChiTiet GROUP BY CayID
) x ON x.CayID = c.CayID
GROUP BY v.VaiID, v.MaVai, lv.TenLoaiVai, lv.MaLoai, ms.TenMau, v.KhoVai, v.GSM, v.ViTriKho, v.TonToiThieuKG;
GO
PRINT 'Da cap nhat view vw_TonKhoVai (them cot MaLoai).';
GO

CREATE OR ALTER VIEW vw_TonCayVai AS
SELECT
    c.CayID, c.MaCay, c.VaiID, v.MaVai, lv.TenLoaiVai, lv.MaLoai, ms.TenMau,
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
PRINT 'Da cap nhat view vw_TonCayVai (them cot MaLoai).';
GO
