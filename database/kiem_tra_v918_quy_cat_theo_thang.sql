/* ================================================================================================
   kiem_tra_v918_quy_cat_theo_thang.sql — ĐỐI CHIẾU QUỸ LƯƠNG TRẢI VẢI CẮT: luật v9.02 vs v9.18
   ------------------------------------------------------------------------------------------------
   v9.02: chỉ lệnh đã QC; kỳ = tháng MUỘN HƠN giữa ngày ghi sổ cắt và ngày QC đầu.
   v9.18: KHÔNG chờ QC; kỳ = tháng GHI sổ cắt (Nguyen 2026-11-04).
   Chạy trong SSMS trên CSDL QLNoiBo. CHỈ ĐỌC, không sửa gì.
   Tên file cố ý KHÔNG có tiền tố migration_v — tao_file_cai_dat.js không được gộp file này.

   @g = đơn giá quỹ cắt. Để 1 thì cột tiền là "ĐIỂM quỹ" (mét × khổ × lớp) — đủ để so tỷ lệ;
   muốn ra TIỀN thật thì thay bằng đơn giá đang cấu hình ở tab Lương trải vải cắt.
   ================================================================================================ */
DECLARE @g DECIMAL(18, 4) = 1;

/* CTE chỉ sống cho MỘT câu lệnh — hai bảng dưới cùng cần dữ liệu nên đổ vào bảng tạm. */
IF OBJECT_ID('tempdb..#soCat') IS NOT NULL DROP TABLE #soCat;
SELECT td.TienDoID, td.DonHangID, td.NgayGhiNhan, qc.NgayQC,
       ISNULL(td.MetSoDoDai, sd.MetSoDoDai) * ISNULL(td.KhoVaiSoDo, sd.KhoVaiSoDo)
         * ISNULL((SELECT SUM(cay.SoLuongLop) FROM TienDoCatChiTietCay cay WHERE cay.TienDoID = td.TienDoID), 0)
         * @g AS ThanhTien
INTO #soCat
FROM TienDoSanXuat td
JOIN CongDoanSanXuat c ON c.StageID = td.StageID
LEFT JOIN DonHangChiTietSoDo sd ON sd.ID = td.SoDoID
OUTER APPLY (SELECT MIN(q.NgayGhiNhan) AS NgayQC
               FROM TienDoSanXuat q
               JOIN CongDoanSanXuat c2 ON c2.StageID = q.StageID
              WHERE q.DonHangID = td.DonHangID
                AND (UPPER(LTRIM(RTRIM(ISNULL(c2.MaCongDoan, N'')))) = N'QC'
                     OR UPPER(LTRIM(RTRIM(ISNULL(c2.TenCongDoan, N'')))) = N'QC')) qc
WHERE c.MaCongDoan = 'CAT'
  AND EXISTS (SELECT 1 FROM TienDoCatChiTietCay cay WHERE cay.TienDoID = td.TienDoID);

/* ---- Bảng 1: quỹ từng tháng theo HAI luật, đặt cạnh nhau ---- */
SELECT ISNULL(moi.Ky, cu.Ky) AS Ky,
       ISNULL(cu.QuyV902, 0)  AS QuyV902_choQC,
       ISNULL(moi.QuyV918, 0) AS QuyV918_theoThangGhi,
       ISNULL(moi.QuyV918, 0) - ISNULL(cu.QuyV902, 0) AS ChenhLech
FROM (
  SELECT FORMAT(NgayGhiNhan, 'yyyy-MM') AS Ky, SUM(ThanhTien) AS QuyV918
  FROM #soCat GROUP BY FORMAT(NgayGhiNhan, 'yyyy-MM')
) moi
FULL JOIN (
  SELECT FORMAT(CASE WHEN NgayQC > NgayGhiNhan THEN NgayQC ELSE NgayGhiNhan END, 'yyyy-MM') AS Ky,
         SUM(ThanhTien) AS QuyV902
  FROM #soCat WHERE NgayQC IS NOT NULL
  GROUP BY FORMAT(CASE WHEN NgayQC > NgayGhiNhan THEN NgayQC ELSE NgayGhiNhan END, 'yyyy-MM')
) cu ON cu.Ky = moi.Ky
ORDER BY 1;

/* ---- Bảng 2: phần TRƯỚC ĐÂY TREO (lệnh chưa QC) nay vào quỹ — soi những dòng mới xuất hiện ---- */
SELECT FORMAT(s.NgayGhiNhan, 'yyyy-MM') AS Ky, d.MaDH, d.TenSanPham,
       COUNT(*) AS SoSoDo, SUM(s.ThanhTien) AS TienVaoQuy
FROM #soCat s
JOIN DonHangSanXuat d ON d.DonHangID = s.DonHangID
WHERE s.NgayQC IS NULL
GROUP BY FORMAT(s.NgayGhiNhan, 'yyyy-MM'), d.MaDH, d.TenSanPham
ORDER BY 1, d.MaDH;

DROP TABLE #soCat;
