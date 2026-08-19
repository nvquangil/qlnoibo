/* ================================================================
   PATCH — them cot MaPM (Ma phan mem: ma tham chieu noi bo/he thong khac) vao DanhMucVai
   + cap nhat 2 view Kho vai de tra ve cot nay.
   Ap dung cho database DA CHAY schema.sql/migration_v4.sql truoc do. Idempotent - chay lai
   nhieu lan khong loi, khong dung/xoa du lieu.
   Neu ban cai moi hoan toan tu schema.sql (ban da duoc cap nhat sau patch nay) thi KHONG can
   chay file nay.
   ================================================================ */

USE QLNoiBo;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('DanhMucVai') AND name = 'MaPM')
BEGIN
    ALTER TABLE DanhMucVai ADD MaPM NVARCHAR(50) NULL;
    PRINT 'Da them cot DanhMucVai.MaPM.';
END ELSE PRINT 'Cot DanhMucVai.MaPM da ton tai, bo qua.';
GO

CREATE OR ALTER VIEW vw_TonKhoVai AS
SELECT
    v.VaiID, v.MaVai, v.MaPM, lv.TenLoaiVai, lv.MaLoai, ms.TenMau,
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
GROUP BY v.VaiID, v.MaVai, v.MaPM, lv.TenLoaiVai, lv.MaLoai, ms.TenMau, v.KhoVai, v.GSM, v.ViTriKho, v.TonToiThieuKG;
GO
PRINT 'Da cap nhat view vw_TonKhoVai (them cot MaPM).';
GO

CREATE OR ALTER VIEW vw_TonCayVai AS
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
PRINT 'Da cap nhat view vw_TonCayVai (them cot MaPM).';
GO
