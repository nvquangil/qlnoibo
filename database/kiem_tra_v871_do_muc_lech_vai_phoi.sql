/* ================================================================================================
   KIEM TRA v8.71 - DO MUC LECH DO CONG NHAM VAI PHOI VAO SAN LUONG
   ⚠️ CHI DOC. Khong UPDATE / DELETE / INSERT. Chay lai bao nhieu lan cung duoc.

   Chay SAU khi da deploy v8.71 (hoac truoc cung duoc - file nay khong phu thuoc code).

   MUC DICH: v8.71 doi cach tinh "SL tu Cat theo mau" (loc vai phoi o muc CAY). Con so tren MAN HINH
   se doi ngay. Nhung nhung thu DA GHI XUONG CSDL theo con so cu thi KHONG tu doi:
     - TheKhoHangHoa (ton thanh pham) - duoc cong DELTA tu "SL tu Cat theo mau"
     - Du lieu May/QC/Dong goi cua nhung mau PHOI tung lot vao danh sach mau

   File nay DEM, khong sua. Doc xong moi quyet dinh co sua du lieu hay khong.
   ================================================================================================ */

/* ================================================================================================
   1. CAC LENH BI ANH HUONG - so cu vs so moi, lech bao nhieu
   `SL_Cu`   = cong MOI cay (cach tinh truoc v8.71)
   `SL_Moi`  = chi cay 'Chính' hoac cay khong co dong xuat nao (cach tinh v8.71)
   `Lech`    = phan dang bi cong du. Lech = 0 -> lenh do khong anh huong gi.
   ================================================================================================ */
WITH CayCat AS (
    SELECT td.DonHangID, cc.CayID, cc.TienDoID,
           cc.SoLuongLop * cc.HeSoQuyDoi AS SoCai
    FROM TienDoCatChiTietCay cc
    JOIN TienDoSanXuat td ON td.TienDoID = cc.TienDoID
    JOIN CongDoanSanXuat cd ON cd.StageID = td.StageID
    WHERE cd.MaCongDoan = 'CAT'
), Danh AS (
    SELECT c.DonHangID, c.CayID, c.SoCai,
           CASE WHEN EXISTS (SELECT 1 FROM PhieuXuatVaiChiTiet px
                             JOIN PhieuXuatVai p ON p.PhieuXuatID = px.PhieuXuatID
                             WHERE px.CayID = c.CayID AND p.DonHangID = c.DonHangID
                               AND px.KieuVai = N'Chính') THEN 1 ELSE 0 END AS LaChinh,
           CASE WHEN EXISTS (SELECT 1 FROM PhieuXuatVaiChiTiet px
                             JOIN PhieuXuatVai p ON p.PhieuXuatID = px.PhieuXuatID
                             WHERE px.CayID = c.CayID AND p.DonHangID = c.DonHangID)
                THEN 1 ELSE 0 END AS CoDongXuat,
           CASE WHEN EXISTS (SELECT 1 FROM PhieuXuatVaiChiTiet px
                             JOIN PhieuXuatVai p ON p.PhieuXuatID = px.PhieuXuatID
                             WHERE p.DonHangID = c.DonHangID AND px.KieuVai IS NOT NULL)
                THEN 1 ELSE 0 END AS DonCoKhaiKieu
    FROM CayCat c
)
SELECT d.MaDH, d.TrangThai,
       SUM(x.SoCai) AS SL_Cu,
       SUM(CASE WHEN x.DonCoKhaiKieu = 0 OR x.LaChinh = 1 OR x.CoDongXuat = 0
                THEN x.SoCai ELSE 0 END) AS SL_Moi,
       SUM(CASE WHEN x.DonCoKhaiKieu = 1 AND x.LaChinh = 0 AND x.CoDongXuat = 1
                THEN x.SoCai ELSE 0 END) AS Lech,
       SUM(CASE WHEN x.DonCoKhaiKieu = 1 AND x.CoDongXuat = 0 THEN 1 ELSE 0 END) AS SoCayChuaRo
FROM Danh x
JOIN DonHangSanXuat d ON d.DonHangID = x.DonHangID
GROUP BY d.MaDH, d.TrangThai
HAVING SUM(CASE WHEN x.DonCoKhaiKieu = 1 AND x.LaChinh = 0 AND x.CoDongXuat = 1 THEN x.SoCai ELSE 0 END) > 0
    OR SUM(CASE WHEN x.DonCoKhaiKieu = 1 AND x.CoDongXuat = 0 THEN 1 ELSE 0 END) > 0
ORDER BY Lech DESC;

/* ================================================================================================
   2. TONG HOP MOT DONG - quy mo van de
   ================================================================================================ */
WITH CayCat AS (
    SELECT td.DonHangID, cc.CayID, cc.SoLuongLop * cc.HeSoQuyDoi AS SoCai
    FROM TienDoCatChiTietCay cc
    JOIN TienDoSanXuat td ON td.TienDoID = cc.TienDoID
    JOIN CongDoanSanXuat cd ON cd.StageID = td.StageID
    WHERE cd.MaCongDoan = 'CAT'
)
SELECT COUNT(DISTINCT c.DonHangID) AS SoLenhCoCayPhoi,
       SUM(c.SoCai) AS TongCaiBiCongDu
FROM CayCat c
WHERE EXISTS (SELECT 1 FROM PhieuXuatVaiChiTiet px
              JOIN PhieuXuatVai p ON p.PhieuXuatID = px.PhieuXuatID
              WHERE px.CayID = c.CayID AND p.DonHangID = c.DonHangID AND px.KieuVai = N'Phối')
  AND NOT EXISTS (SELECT 1 FROM PhieuXuatVaiChiTiet px
                  JOIN PhieuXuatVai p ON p.PhieuXuatID = px.PhieuXuatID
                  WHERE px.CayID = c.CayID AND p.DonHangID = c.DonHangID AND px.KieuVai = N'Chính');

/* ================================================================================================
   3. ⚠️ MAU PHOI DA LOT VAO CAC CONG DOAN SAU?
   Danh sach mau o form May/QC/Dong goi lay tu getCatMauList - von dang de lot mau phoi. Neu nguoi
   dung DA GO SO cho mau do thi du lieu May/QC/DG that su ban, va sau v8.71 nhung dong do se BIEN MAT
   khoi man hinh trong khi so VAN NAM trong CSDL.

   Dong nao hien ra o day = mot mau chi co cay PHOI nhung da co so lieu o cong doan sau.
   ================================================================================================ */
WITH MauChiCoPhoi AS (
    SELECT DISTINCT td.DonHangID, dv.MauSacID
    FROM TienDoCatChiTietCay cc
    JOIN TienDoSanXuat td ON td.TienDoID = cc.TienDoID
    JOIN CongDoanSanXuat cd ON cd.StageID = td.StageID
    JOIN VaiCay vc ON vc.CayID = cc.CayID
    JOIN DanhMucVai dv ON dv.VaiID = vc.VaiID
    WHERE cd.MaCongDoan = 'CAT'
      AND NOT EXISTS (
            SELECT 1
            FROM TienDoCatChiTietCay cc2
            JOIN TienDoSanXuat td2 ON td2.TienDoID = cc2.TienDoID
            JOIN CongDoanSanXuat cd2 ON cd2.StageID = td2.StageID
            JOIN VaiCay vc2 ON vc2.CayID = cc2.CayID
            JOIN DanhMucVai dv2 ON dv2.VaiID = vc2.VaiID
            WHERE cd2.MaCongDoan = 'CAT' AND td2.DonHangID = td.DonHangID
              AND dv2.MauSacID = dv.MauSacID
              AND EXISTS (SELECT 1 FROM PhieuXuatVaiChiTiet px
                          JOIN PhieuXuatVai p ON p.PhieuXuatID = px.PhieuXuatID
                          WHERE px.CayID = cc2.CayID AND p.DonHangID = td2.DonHangID
                            AND px.KieuVai = N'Chính'))
)
SELECT d.MaDH, ms.TenMau, cd.MaCongDoan, cd.TenCongDoan,
       SUM(tc.SoLuongLuyKe) AS SL_Da_Ghi
FROM MauChiCoPhoi m
JOIN TienDoSanXuat td ON td.DonHangID = m.DonHangID
JOIN TienDoChiTietMau tc ON tc.TienDoID = td.TienDoID AND tc.MauSacID = m.MauSacID
JOIN CongDoanSanXuat cd ON cd.StageID = td.StageID
JOIN DonHangSanXuat d ON d.DonHangID = m.DonHangID
LEFT JOIN MauSac ms ON ms.MauSacID = m.MauSacID
WHERE cd.MaCongDoan <> 'CAT'
GROUP BY d.MaDH, ms.TenMau, cd.MaCongDoan, cd.TenCongDoan
HAVING SUM(tc.SoLuongLuyKe) > 0
ORDER BY d.MaDH, ms.TenMau, cd.MaCongDoan;

/* ================================================================================================
   4. CAY CHUA RO KIEU - nhung cay se gay canh bao mau cam tren form
   Khai KieuVai cho cac cay nay la het canh bao.
   ================================================================================================ */
SELECT d.MaDH, vc.MaCay, dv.MaVai, ms.TenMau, cc.SoLuongLop,
       cc.SoLuongLop * cc.HeSoQuyDoi AS SoCaiDangCong
FROM TienDoCatChiTietCay cc
JOIN TienDoSanXuat td ON td.TienDoID = cc.TienDoID
JOIN CongDoanSanXuat cd ON cd.StageID = td.StageID
JOIN DonHangSanXuat d ON d.DonHangID = td.DonHangID
JOIN VaiCay vc ON vc.CayID = cc.CayID
JOIN DanhMucVai dv ON dv.VaiID = vc.VaiID
LEFT JOIN MauSac ms ON ms.MauSacID = dv.MauSacID
WHERE cd.MaCongDoan = 'CAT'
  AND EXISTS (SELECT 1 FROM PhieuXuatVaiChiTiet px
              JOIN PhieuXuatVai p ON p.PhieuXuatID = px.PhieuXuatID
              WHERE p.DonHangID = td.DonHangID AND px.KieuVai IS NOT NULL)
  AND NOT EXISTS (SELECT 1 FROM PhieuXuatVaiChiTiet px
                  JOIN PhieuXuatVai p ON p.PhieuXuatID = px.PhieuXuatID
                  WHERE px.CayID = cc.CayID AND p.DonHangID = td.DonHangID)
ORDER BY d.MaDH, vc.MaCay;

/* ================================================================================================
   5. DOI CHIEU RIENG LENH DH2608064 - phai ra dung 600
   ================================================================================================ */
DECLARE @id INT = (SELECT TOP 1 DonHangID FROM DonHangSanXuat WHERE MaDH = N'DH2608064');
SELECT ms.TenMau, dv.MauSacID,
       SUM(cc.SoLuongLop * cc.HeSoQuyDoi) AS SL_Moi
FROM TienDoCatChiTietCay cc
JOIN TienDoSanXuat td ON td.TienDoID = cc.TienDoID
JOIN CongDoanSanXuat cd ON cd.StageID = td.StageID
JOIN VaiCay vc ON vc.CayID = cc.CayID
JOIN DanhMucVai dv ON dv.VaiID = vc.VaiID
LEFT JOIN MauSac ms ON ms.MauSacID = dv.MauSacID
WHERE cd.MaCongDoan = 'CAT' AND td.DonHangID = @id
  AND (EXISTS (SELECT 1 FROM PhieuXuatVaiChiTiet px
               JOIN PhieuXuatVai p ON p.PhieuXuatID = px.PhieuXuatID
               WHERE px.CayID = cc.CayID AND p.DonHangID = @id AND px.KieuVai = N'Chính')
       OR NOT EXISTS (SELECT 1 FROM PhieuXuatVaiChiTiet px2
                      JOIN PhieuXuatVai p2 ON p2.PhieuXuatID = px2.PhieuXuatID
                      WHERE px2.CayID = cc.CayID AND p2.DonHangID = @id))
GROUP BY ms.TenMau, dv.MauSacID
ORDER BY ms.TenMau;
/* Ky vong: Nau 34 = 210, Reu 165 = 180, Tim Than 135 = 210. TONG = 600. Khong co Kem / Kem 11 /
   Thien thanh / Xanh 142 (toan cay phoi). */
