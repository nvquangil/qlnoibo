/* ================================================================================================
   KIEM TRA v8.70.3 - CHI DOC, KHONG SUA GI.

   Muc dich: tra loi dung mot cau - "phieu da lap co ghi duoc ChuongTrinhID hay khong?"

   Vi sao phai hoi: trong banhang.js co bien cache `__coCotCTKM` (do mot lan roi nho mai).
   Neu pm2 da chay TRUOC khi chay migration_v870.sql thi cache = false, va MOI PHIEU lap trong
   khoang thoi gian do se ghi ChuongTrinhID = NULL VINH VIEN - sua route doc khong cuu duoc.
   pm2 restart xong thi cac phieu lap SAU do moi ghi dung.

   Cach doc ket qua:
     - Truy van 2 ra dong co ChuongTrinhID khac NULL  => ghi DUNG, chi la loi hien thi (da sua).
     - Truy van 2 rong hoan toan ma truy van 3 co chuong trinh dang chay, %CK tren phieu khop
       %CK chuong trinh => dung la bi cache: phai pm2 restart va LAP LAI phieu (hoac vao Sua phieu
       cua phieu do, bam Luu lai - luc luu se tinh lai ChuongTrinhID).
   ================================================================================================ */

/* ---------- 1. Cot da ton tai chua? ---------- */
SELECT CASE WHEN COL_LENGTH('PhieuBanHangChiTiet','ChuongTrinhID') IS NULL
            THEN 'CHUA CO COT - phai chay migration_v870.sql'
            ELSE 'OK - cot ChuongTrinhID da co' END AS KiemCot;
GO

/* ---------- 2. 30 dong phieu gan nhat: dong nao da gan chuong trinh? ---------- */
SELECT TOP 30
       p.SoPhieu, p.NgayBan, h.MaHang,
       ct.PhanTramCKShop        AS CK_Tren_Phieu,
       ct.ChuongTrinhID,
       km.TenChuongTrinh,
       km.PhanTramCK            AS CK_Chuong_Trinh,
       CASE WHEN ct.ChuongTrinhID IS NOT NULL THEN 'Da gan chuong trinh'
            ELSE 'Ban theo CK dung chung (hoac bi cache)' END AS TrangThai
FROM PhieuBanHangChiTiet ct
JOIN PhieuBanHang p ON p.PhieuBHID = ct.PhieuBHID
JOIN TheKhoHangHoa h ON h.MaHangID = ct.MaHangID
LEFT JOIN ChuongTrinhKhuyenMai km ON km.ID = ct.ChuongTrinhID
ORDER BY p.PhieuBHID DESC, ct.ID;
GO

/* ---------- 3. Chuong trinh dang chay hom nay + so ma tham gia ---------- */
SELECT km.ID, km.TenChuongTrinh, km.TuNgay, km.DenNgay, km.PhanTramCK, km.TrangThai,
       (SELECT COUNT(*) FROM ChuongTrinhKhuyenMaiChiTiet x WHERE x.ChuongTrinhID = km.ID) AS SoMaHang
FROM ChuongTrinhKhuyenMai km
WHERE km.TrangThai = N'Hoạt động'
  AND CAST(GETDATE() AS DATE) BETWEEN km.TuNgay AND km.DenNgay;
GO

/* ---------- 4. Chuc nang phan quyen da dang ky chua? (v8.70.2) ---------- */
SELECT CASE WHEN EXISTS (SELECT 1 FROM ChucNang WHERE ModuleCode=N'KHOHANG' AND MaChucNang=N'khuyenmai')
            THEN 'OK - ChucNang KHOHANG/khuyenmai da co'
            ELSE 'THIEU - chay lai migration_v870.sql (buoc 4)' END AS KiemChucNang;
GO
