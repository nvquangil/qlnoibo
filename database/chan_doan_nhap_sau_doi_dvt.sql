/* Mã hàng đã chuyển ĐVT chính sang Cái/Bộ: đối chiếu Nhập trên thẻ kho với
   SỐ LIỆU GỐC ở công đoạn "Kho nhập" của lệnh SX (nguồn duy nhất có chứng từ). */
SELECT h.MaHang, h.TenHang, h.DonViCoBan AS [DVT chinh], h.DonViQuyDoi AS [DVT quy doi], h.LoaiRi AS [Ty le],
       ISNULL(SUM(ct.NhapCai), 0) AS [Nhap tren the kho],
       kn.LuyKeCai                AS [Luy ke Kho nhap (quy ra cai)],
       ISNULL(SUM(ct.NhapCai), 0) - kn.LuyKeCai AS [Chenh lech],
       CASE WHEN kn.LuyKeCai > 0 AND ISNULL(SUM(ct.NhapCai),0) = kn.LuyKeCai * h.LoaiRi
            THEN N'>> NGHI BI NHAN THUA ' + CAST(h.LoaiRi AS NVARCHAR(10)) + N' LAN'
            WHEN kn.LuyKeCai > 0 AND ISNULL(SUM(ct.NhapCai),0) <> kn.LuyKeCai THEN N'lech - kiem tay'
            ELSE N'' END AS [Nhan xet]
FROM TheKhoHangHoa h
LEFT JOIN TheKhoChiTietMau ct ON ct.MaHangID = h.MaHangID
OUTER APPLY (
    SELECT TOP 1 SUM(m.SoLuongLuyKe) AS LuyKeCai
    FROM TienDoSanXuat td
    JOIN CongDoanSanXuat c ON c.StageID = td.StageID AND c.MaCongDoan = 'KN'
    JOIN TienDoChiTietMau m ON m.TienDoID = td.TienDoID
    WHERE td.DonHangID = h.DonHangID
    GROUP BY ISNULL(td.NhomTienDoID, td.TienDoID)
    ORDER BY MAX(td.TienDoID) DESC
) kn
WHERE h.DonHangID IS NOT NULL AND h.LoaiRi > 1
GROUP BY h.MaHang, h.TenHang, h.DonViCoBan, h.DonViQuyDoi, h.LoaiRi, kn.LuyKeCai
HAVING ISNULL(SUM(ct.NhapCai), 0) <> ISNULL(kn.LuyKeCai, ISNULL(SUM(ct.NhapCai), 0))
ORDER BY h.MaHang;
