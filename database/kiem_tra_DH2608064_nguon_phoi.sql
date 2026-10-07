/* ================================================================================================
   CHAN DOAN VONG 2 - DH2608064: "Nau 34 lay dau ra 210 cai tu vai PHOI?"
   ⚠️ CHI DOC.

   Nguyen phan bac (dung): trong phieu PXV-11147, CA HAI cay Nau 34 deu xuat vao vai CHINH.
   Nhung bang tom tat vong 1 lai cho Nau 34 = 210 Chinh + 210 Phoi.

   HAI KHA NANG, phai tach bach:
     (a) Co PHIEU XUAT VAI THU HAI cho don nay (ngay ~15/09) khai cac cay do la 'Phối'.
         -> PXV-11147 khong phai phieu duy nhat; Nguyen moi nhin mot phieu.
     (b) LOI TRONG TRUY VAN VONG 1 CUA TOI: toi dung
                (SELECT TOP 1 px.KieuVai ... ORDER BY px.ID DESC)
         Mot cay xuat NHIEU LAN cho cung don voi Kieu khac nhau thi TOP 1 chi lay dong MOI NHAT
         -> bao 'Phối' trong khi thuc te cay do da xuat 'Chính' truoc do. Con so Tu_Phoi khi do
         la DO TRUY VAN, khong phai do du lieu.

   Cac truy van duoi liet ke TAT CA, KHONG dung TOP 1, nen phan biet duoc (a) voi (b).
   ================================================================================================ */

DECLARE @MaDH NVARCHAR(50) = N'DH2608064';
DECLARE @DonHangID INT = (SELECT TOP 1 DonHangID FROM DonHangSanXuat WHERE MaDH = @MaDH);

/* ---------- 1. CO BAO NHIEU PHIEU XUAT VAI CHO DON NAY? ----------
   Neu ra NHIEU HON MOT dong => kha nang (a). Doi chieu PhieuXuatID voi so phieu tren man hinh
   (man hien 'PXV-<PhieuXuatID>', vd PXV-11147 => PhieuXuatID = 11147). */
SELECT p.PhieuXuatID, p.NgayXuat, p.MaDon, p.Chuyen, p.NguoiNhan, p.MucDich, p.GhiChu,
       (SELECT COUNT(*) FROM PhieuXuatVaiChiTiet x WHERE x.PhieuXuatID = p.PhieuXuatID) AS SoDongCay
FROM PhieuXuatVai p
WHERE p.DonHangID = @DonHangID
ORDER BY p.PhieuXuatID;

/* ---------- 2. MOI DONG XUAT CUA MOI PHIEU, KEM KIEU ----------
   Doc cot KieuVai: tim xem cay mau Nau 34 / Reu 165 / Tim Than co dong nao khai 'Phối' khong,
   va dong do nam o PhieuXuatID nao. */
SELECT p.PhieuXuatID, p.NgayXuat, px.ID AS DongID, px.KieuVai,
       vc.MaCay, dv.MaVai, ms.TenMau, px.KGXuat
FROM PhieuXuatVaiChiTiet px
JOIN PhieuXuatVai p ON p.PhieuXuatID = px.PhieuXuatID
JOIN VaiCay vc ON vc.CayID = px.CayID
JOIN DanhMucVai dv ON dv.VaiID = vc.VaiID
LEFT JOIN MauSac ms ON ms.MauSacID = dv.MauSacID
WHERE p.DonHangID = @DonHangID
ORDER BY ms.TenMau, p.PhieuXuatID, px.ID;

/* ---------- 3. CAY NAO XUAT NHIEU HON MOT LAN CHO CUNG DON? ----------
   Co dong nao o day => kha nang (b) la that: TOP 1 cua toi da chon nham.
   Cot `CacKieu` cho thay cung mot cay duoc khai may kieu khac nhau. */
SELECT vc.MaCay, ms.TenMau, COUNT(*) AS SoLanXuat,
       STRING_AGG(ISNULL(px.KieuVai, N'(trong)'), ' | ') AS CacKieu
FROM PhieuXuatVaiChiTiet px
JOIN PhieuXuatVai p ON p.PhieuXuatID = px.PhieuXuatID
JOIN VaiCay vc ON vc.CayID = px.CayID
JOIN DanhMucVai dv ON dv.VaiID = vc.VaiID
LEFT JOIN MauSac ms ON ms.MauSacID = dv.MauSacID
WHERE p.DonHangID = @DonHangID
GROUP BY vc.MaCay, ms.TenMau
HAVING COUNT(*) > 1;

/* ---------- 4. *** BANG QUYET DINH *** ----------
   Tung cay TRONG SO CAT, doi chieu voi MOI dong phieu xuat cua no (khong TOP 1).
   Cot `SoPhieuXuatCuaCay` = 0  => cay khong co phieu xuat nao cho don nay (KieuVai khong xac dinh).
   Cot `CoDongChinh` / `CoDongPhoi` = 1 ca hai => cung mot cay vua khai Chinh vua khai Phoi
                                                 (du lieu mau thuan, phai sua phieu xuat). */
SELECT td.TienDoID, td.SoDoID, tcc.CayID, vc.MaCay, tcc.SttCay,
       tcc.SoLuongLop, tcc.HeSoQuyDoi,
       tcc.SoLuongLop * tcc.HeSoQuyDoi AS SoCaiCongVao,
       ms.TenMau, dv.MaVai,
       (SELECT COUNT(*) FROM PhieuXuatVaiChiTiet px JOIN PhieuXuatVai p ON p.PhieuXuatID = px.PhieuXuatID
         WHERE px.CayID = tcc.CayID AND p.DonHangID = @DonHangID) AS SoPhieuXuatCuaCay,
       (SELECT COUNT(*) FROM PhieuXuatVaiChiTiet px JOIN PhieuXuatVai p ON p.PhieuXuatID = px.PhieuXuatID
         WHERE px.CayID = tcc.CayID AND p.DonHangID = @DonHangID AND px.KieuVai = N'Chính') AS CoDongChinh,
       (SELECT COUNT(*) FROM PhieuXuatVaiChiTiet px JOIN PhieuXuatVai p ON p.PhieuXuatID = px.PhieuXuatID
         WHERE px.CayID = tcc.CayID AND p.DonHangID = @DonHangID AND px.KieuVai = N'Phối') AS CoDongPhoi,
       (SELECT STRING_AGG(CAST(p.PhieuXuatID AS NVARCHAR(20)) + N':' + ISNULL(px.KieuVai, N'(trong)'), ' | ')
          FROM PhieuXuatVaiChiTiet px JOIN PhieuXuatVai p ON p.PhieuXuatID = px.PhieuXuatID
         WHERE px.CayID = tcc.CayID AND p.DonHangID = @DonHangID) AS ChiTietPhieu
FROM TienDoCatChiTietCay tcc
JOIN TienDoSanXuat td ON td.TienDoID = tcc.TienDoID
JOIN CongDoanSanXuat cc ON cc.StageID = td.StageID
LEFT JOIN VaiCay vc ON vc.CayID = tcc.CayID
LEFT JOIN DanhMucVai dv ON dv.VaiID = vc.VaiID
LEFT JOIN MauSac ms ON ms.MauSacID = dv.MauSacID
WHERE td.DonHangID = @DonHangID AND cc.MaCongDoan = 'CAT'
ORDER BY ms.TenMau, td.TienDoID, tcc.CayID;

/* ---------- 5. BA CAY CUA BAN CAT NGAY 15/09 (TienDoID 9887) ----------
   Day la ba cay dang bi nghi. Xem chung la cay NAO, xuat o phieu nao, khai gi. */
SELECT tcc.CayID, vc.MaCay, dv.MaVai, ms.TenMau, tcc.SoLuongLop,
       vc.NgayNhap, vc.TrangThai,
       (SELECT STRING_AGG(CAST(p.PhieuXuatID AS NVARCHAR(20)) + N' (' + CONVERT(NVARCHAR(10), p.NgayXuat, 103)
                          + N') ' + ISNULL(px.KieuVai, N'(trong)'), '  |  ')
          FROM PhieuXuatVaiChiTiet px JOIN PhieuXuatVai p ON p.PhieuXuatID = px.PhieuXuatID
         WHERE px.CayID = tcc.CayID) AS MoiPhieuXuatCuaCay_MoiDon
FROM TienDoCatChiTietCay tcc
JOIN VaiCay vc ON vc.CayID = tcc.CayID
JOIN DanhMucVai dv ON dv.VaiID = vc.VaiID
LEFT JOIN MauSac ms ON ms.MauSacID = dv.MauSacID
WHERE tcc.TienDoID IN (9887, 9888)
ORDER BY tcc.TienDoID, tcc.CayID;
