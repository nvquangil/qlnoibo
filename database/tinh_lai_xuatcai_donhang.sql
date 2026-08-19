/* ================================================================
   TÍNH LẠI XuatCai (Thẻ kho hàng hóa) THEO ĐƠN VỊ CHÍNH
   ----------------------------------------------------------------
   Dùng SAU khi đã deploy bản sửa v5.46.1 (đơn hàng trừ tồn theo đơn vị chính).
   Sửa lại cột "Xuất" của chi tiết theo màu bị SAI do các đơn tạo TRƯỚC bản sửa
   (hàng đơn vị chính = Ri bị trừ gấp hệ số).

   Quy ước: XuatCai = TỔNG số lượng các đơn CHƯA "Đã hủy", quy về ĐƠN VỊ CHÍNH của mã hàng:
     - đưa về Cái:  DonVi='Ri'      -> SoLuongDat * LoaiRi ; ngược lại giữ nguyên
     - về đơn vị chính: DonViCoBan='Ri' -> (Cái / LoaiRi) ; ngược lại giữ nguyên (làm tròn)
   (XuatCai chỉ do đơn đặt hàng tác động; SoCatCai/NhapCai KHÔNG đụng tới.)

   ⚠ SAO LƯU DB trước. Chạy BƯỚC 1 xem trước; thấy đúng thì chạy BƯỚC 2.
   ================================================================ */
USE QLNoiBo;
GO

-- Số lượng 1 đơn quy về đơn vị chính (dùng chung cho cả 2 bước)
-- base = ROUND( (DonVi='Ri'? SL*LoaiRi : SL) / (DonViCoBan='Ri'? LoaiRi : 1) )

-------------------------------------------------------------
-- BƯỚC 1 — XEM TRƯỚC: chỉ các màu có XuatCai LỆCH so với tính lại.
-------------------------------------------------------------
;WITH q AS (
  SELECT o.MaHangID, o.MauSacID,
    ROUND(
      (CASE WHEN o.DonVi = N'Ri' THEN CAST(o.SoLuongDat AS DECIMAL(18,4)) * ISNULL(h.LoaiRi,1) ELSE o.SoLuongDat END)
      / (CASE WHEN h.DonViCoBan = N'Ri' THEN NULLIF(ISNULL(h.LoaiRi,1),0) ELSE 1 END), 0) AS slChinh
  FROM DonKhachDatHang o
  JOIN TheKhoHangHoa h ON h.MaHangID = o.MaHangID
  WHERE o.TrangThai <> N'Đã hủy'
), agg AS (
  SELECT MaHangID, MauSacID, SUM(slChinh) AS XuatMoi FROM q GROUP BY MaHangID, MauSacID
)
SELECT h.MaHang, ms.TenMau, h.DonViCoBan, h.LoaiRi,
       ct.XuatCai AS XuatCai_HienTai,
       CAST(ISNULL(agg.XuatMoi,0) AS INT) AS XuatCai_TinhLai,
       ct.XuatCai - CAST(ISNULL(agg.XuatMoi,0) AS INT) AS ChenhLech
FROM TheKhoChiTietMau ct
JOIN TheKhoHangHoa h ON h.MaHangID = ct.MaHangID
JOIN MauSac ms ON ms.MauSacID = ct.MauSacID
LEFT JOIN agg ON agg.MaHangID = ct.MaHangID AND agg.MauSacID = ct.MauSacID
WHERE ct.XuatCai <> CAST(ISNULL(agg.XuatMoi,0) AS INT)
ORDER BY h.MaHang, ms.TenMau;
GO

-------------------------------------------------------------
-- BƯỚC 2 — CẬP NHẬT (1 câu, tự commit — không để treo transaction).
-------------------------------------------------------------
SET XACT_ABORT ON;
;WITH q AS (
  SELECT o.MaHangID, o.MauSacID,
    ROUND(
      (CASE WHEN o.DonVi = N'Ri' THEN CAST(o.SoLuongDat AS DECIMAL(18,4)) * ISNULL(h.LoaiRi,1) ELSE o.SoLuongDat END)
      / (CASE WHEN h.DonViCoBan = N'Ri' THEN NULLIF(ISNULL(h.LoaiRi,1),0) ELSE 1 END), 0) AS slChinh
  FROM DonKhachDatHang o
  JOIN TheKhoHangHoa h ON h.MaHangID = o.MaHangID
  WHERE o.TrangThai <> N'Đã hủy'
), agg AS (
  SELECT MaHangID, MauSacID, SUM(slChinh) AS XuatMoi FROM q GROUP BY MaHangID, MauSacID
)
UPDATE ct SET ct.XuatCai = CAST(ISNULL(agg.XuatMoi,0) AS INT)
FROM TheKhoChiTietMau ct
LEFT JOIN agg ON agg.MaHangID = ct.MaHangID AND agg.MauSacID = ct.MauSacID;
PRINT N'Đã tính lại XuatCai theo đơn vị chính. Số dòng cập nhật: ' + CAST(@@ROWCOUNT AS NVARCHAR(10));
GO
