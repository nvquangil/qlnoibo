/* ================================================================================================
   KIEM TRA v9.02 — TAC DONG CUA "CHI TINH LUONG KHI LENH DA GHI QC" LEN DU LIEU THAT
   ------------------------------------------------------------------------------------------------
   Chay trong SSMS, CHI DOC (khong sua gi). Ten file co tien to kiem_tra_ CO Y — tao_file_cai_dat.js
   chi gop migration_v*.sql.

   Quy tac v9.02 (Nguyen chot 2026-10-24):
     - Lenh CHUA ghi tien do QC: khong vao bang luong nao (khoan may, gia cong/in theu, la/dong goi,
       trai vai cat) va KHONG vao so cong no nha gia cong.
     - Ky luong cua mot dong = thang MUON HON giua ngay ghi cong doan va ngay QC DAU TIEN cua lenh
       (khoan may, la/dong goi, trai vai cat). Gia cong/in theu: thang QC dau (khong co ngay nhan rieng).

   BANG 1: dong Dong goi / So cat / May ma ky luong KHAC thang ghi -> tien DICH THANG so voi truoc.
   BANG 2: lenh co ghi Dong goi / So cat / May nhung CHUA co QC -> bi LOAI khoi bang luong (se tu vao
           bang luong o thang QC khi QC ghi).
   BANG 3: quy cat theo thang: TRUOC (theo thang cat) va SAU (theo ky QC) — doi chieu bang luong da tra.
   BANG 4: cong no / luong gia cong + in theu cua lenh CHUA QC (SoLuongNhan > 0) — day la phan SO CONG
           NO NHA GIA CONG se GIAM sau v9.02 (truoc do ghi chu v8.61 noi da loai nhung thuc te chua).
   ================================================================================================ */
SET NOCOUNT ON;

/* Don gia cat: CauHinh.LUONG_CAT luu {"donGia":1100} (JSON.stringify). Khong dung JSON_VALUE de khong
   doi compat level >= 130; boc chuoi bang REPLACE. Khong co cau hinh -> 1100 (mac dinh cua payroll.js). */
DECLARE @donGiaCat DECIMAL(18,4) = 1100;
SELECT @donGiaCat = ISNULL(TRY_CAST(REPLACE(REPLACE(REPLACE(REPLACE(GiaTri, '{', ''), '}', ''), '"donGia":', ''), ' ', '') AS DECIMAL(18,4)), 1100)
FROM CauHinh WHERE Khoa = 'LUONG_CAT';
PRINT 'Don gia cat dang dung: ' + CAST(@donGiaCat AS varchar(20));

;WITH qc AS (
  SELECT q.DonHangID, MIN(q.NgayGhiNhan) AS NgayQC
  FROM TienDoSanXuat q
  JOIN CongDoanSanXuat c ON c.StageID = q.StageID
  WHERE UPPER(LTRIM(RTRIM(ISNULL(c.MaCongDoan, N'')))) = N'QC'
     OR UPPER(LTRIM(RTRIM(ISNULL(c.TenCongDoan, N'')))) = N'QC'
  GROUP BY q.DonHangID
),
dong AS (
  /* La / Dong goi: tung dong giao viec (PhanCongLaDongGoi) */
  SELECT CASE WHEN c.MaCongDoan = 'LA' THEN N'La' ELSE N'Dong goi' END AS Loai,
         d.DonHangID, d.MaDH, td.TienDoID, td.NgayGhiNhan,
         pc.SoLuong * ISNULL(dg.DonGia, 0) AS ThanhTien
  FROM PhanCongLaDongGoi pc
  JOIN TienDoSanXuat td ON td.TienDoID = pc.TienDoID
  JOIN CongDoanSanXuat c ON c.StageID = td.StageID
  JOIN DonHangSanXuat d ON d.DonHangID = td.DonHangID
  OUTER APPLY (SELECT TOP 1 x.DonGia FROM DonHangDonGiaLaDongGoi x
               WHERE x.DonHangID = d.DonHangID AND x.Loai = c.MaCongDoan
               ORDER BY ISNULL(x.TenPhieu, N''), x.ID) dg
  WHERE c.MaCongDoan IN ('LA','DG')
  UNION ALL
  /* So cat: tien 1 so do = met x kho x tong lop x don gia */
  SELECT N'So cat', d.DonHangID, d.MaDH, td.TienDoID, td.NgayGhiNhan,
         ISNULL(td.MetSoDoDai, sd.MetSoDoDai) * ISNULL(td.KhoVaiSoDo, sd.KhoVaiSoDo)
           * ISNULL((SELECT SUM(cay.SoLuongLop) FROM TienDoCatChiTietCay cay WHERE cay.TienDoID = td.TienDoID), 0)
           * @donGiaCat
  FROM TienDoSanXuat td
  JOIN CongDoanSanXuat c ON c.StageID = td.StageID
  JOIN DonHangSanXuat d ON d.DonHangID = td.DonHangID
  LEFT JOIN DonHangChiTietSoDo sd ON sd.ID = td.SoDoID
  WHERE c.MaCongDoan = 'CAT'
    AND EXISTS (SELECT 1 FROM TienDoCatChiTietCay cay WHERE cay.TienDoID = td.TienDoID)
  UNION ALL
  /* Khoan may: tung dong giao viec (PhanCongMay) — thanh tien nhu loadLuongKhoanMay */
  SELECT N'May', d.DonHangID, d.MaDH, td.TienDoID, td.NgayGhiNhan,
         pc.SoLuong * ISNULL(dm.ThanhTien, ISNULL(ISNULL(dhg.DonGia, g.DonGia), 0) * ISNULL(ISNULL(dhg.HeSo, g.HeSo), 1))
  FROM PhanCongMay pc
  JOIN TienDoSanXuat td ON td.TienDoID = pc.TienDoID
  JOIN DonHangSanXuat d ON d.DonHangID = td.DonHangID
  LEFT JOIN DonHangDonGiaCongDoanMay dm ON dm.ID = pc.DonGiaCongDoanMayID
  LEFT JOIN DonHangCongDoanMay dhg ON dhg.DonHangID = d.DonHangID AND dhg.CongDoanMayID = pc.CongDoanMayID
  LEFT JOIN DonGiaCongDoanMay g ON g.CongDoanMayID = pc.CongDoanMayID
),
tinh AS (
  SELECT x.Loai, x.DonHangID, x.MaDH, x.TienDoID, x.NgayGhiNhan, q.NgayQC, x.ThanhTien,
         CASE WHEN q.NgayQC > x.NgayGhiNhan THEN q.NgayQC ELSE x.NgayGhiNhan END AS NgayKy
  FROM dong x
  LEFT JOIN qc q ON q.DonHangID = x.DonHangID
)
SELECT N'BANG 1 — dich thang' AS Bang, Loai, MaDH, TienDoID,
       CONVERT(varchar(10), NgayGhiNhan, 103) AS NgayGhi,
       CONVERT(varchar(10), NgayQC, 103) AS NgayQC,
       FORMAT(NgayGhiNhan, 'yyyy-MM') AS ThangGhi_TRUOC,
       FORMAT(NgayKy, 'yyyy-MM') AS ThangKy_SAU,
       ThanhTien
FROM tinh
WHERE NgayQC IS NOT NULL
  AND FORMAT(NgayGhiNhan, 'yyyy-MM') <> FORMAT(NgayKy, 'yyyy-MM')
ORDER BY Loai, NgayKy, MaDH;

;WITH qc AS (
  SELECT q.DonHangID, MIN(q.NgayGhiNhan) AS NgayQC
  FROM TienDoSanXuat q
  JOIN CongDoanSanXuat c ON c.StageID = q.StageID
  WHERE UPPER(LTRIM(RTRIM(ISNULL(c.MaCongDoan, N'')))) = N'QC'
     OR UPPER(LTRIM(RTRIM(ISNULL(c.TenCongDoan, N'')))) = N'QC'
  GROUP BY q.DonHangID
)
SELECT N'BANG 2 — chua QC, bi loai' AS Bang, d.MaDH, d.TrangThai, cd.TenCongDoan AS CongDoanHienTai,
       (SELECT COUNT(*) FROM TienDoSanXuat t JOIN CongDoanSanXuat c ON c.StageID = t.StageID
         WHERE t.DonHangID = d.DonHangID AND c.MaCongDoan IN ('LA','DG')) AS SoDotDongGoi,
       (SELECT COUNT(*) FROM TienDoSanXuat t JOIN CongDoanSanXuat c ON c.StageID = t.StageID
         WHERE t.DonHangID = d.DonHangID AND c.MaCongDoan = 'CAT'
           AND EXISTS (SELECT 1 FROM TienDoCatChiTietCay cay WHERE cay.TienDoID = t.TienDoID)) AS SoSoCat,
       (SELECT COUNT(*) FROM PhanCongMay pc JOIN TienDoSanXuat t ON t.TienDoID = pc.TienDoID
         WHERE t.DonHangID = d.DonHangID) AS SoDongMay,
       (SELECT MIN(t.NgayGhiNhan) FROM TienDoSanXuat t WHERE t.DonHangID = d.DonHangID) AS GhiTienDoDauTien
FROM DonHangSanXuat d
LEFT JOIN CongDoanSanXuat cd ON cd.StageID = d.CongDoanHienTaiID
LEFT JOIN qc q ON q.DonHangID = d.DonHangID
WHERE q.DonHangID IS NULL
  AND (EXISTS (SELECT 1 FROM TienDoSanXuat t JOIN CongDoanSanXuat c ON c.StageID = t.StageID
               WHERE t.DonHangID = d.DonHangID AND c.MaCongDoan IN ('LA','DG','CAT'))
       OR EXISTS (SELECT 1 FROM PhanCongMay pc JOIN TienDoSanXuat t ON t.TienDoID = pc.TienDoID WHERE t.DonHangID = d.DonHangID))
ORDER BY d.MaDH;

;WITH qc AS (
  SELECT q.DonHangID, MIN(q.NgayGhiNhan) AS NgayQC
  FROM TienDoSanXuat q
  JOIN CongDoanSanXuat c ON c.StageID = q.StageID
  WHERE UPPER(LTRIM(RTRIM(ISNULL(c.MaCongDoan, N'')))) = N'QC'
     OR UPPER(LTRIM(RTRIM(ISNULL(c.TenCongDoan, N'')))) = N'QC'
  GROUP BY q.DonHangID
),
socat AS (
  SELECT td.DonHangID, td.NgayGhiNhan,
         ISNULL(td.MetSoDoDai, sd.MetSoDoDai) * ISNULL(td.KhoVaiSoDo, sd.KhoVaiSoDo)
           * ISNULL((SELECT SUM(cay.SoLuongLop) FROM TienDoCatChiTietCay cay WHERE cay.TienDoID = td.TienDoID), 0)
           * @donGiaCat AS ThanhTien
  FROM TienDoSanXuat td
  JOIN CongDoanSanXuat c ON c.StageID = td.StageID
  LEFT JOIN DonHangChiTietSoDo sd ON sd.ID = td.SoDoID
  WHERE c.MaCongDoan = 'CAT'
    AND EXISTS (SELECT 1 FROM TienDoCatChiTietCay cay WHERE cay.TienDoID = td.TienDoID)
),
thang AS (
  SELECT FORMAT(s.NgayGhiNhan, 'yyyy-MM') AS Thang, SUM(s.ThanhTien) AS QuyCat_TRUOC, CAST(0 AS DECIMAL(18,2)) AS QuyCat_SAU
  FROM socat s GROUP BY FORMAT(s.NgayGhiNhan, 'yyyy-MM')
  UNION ALL
  SELECT FORMAT(CASE WHEN q.NgayQC > s.NgayGhiNhan THEN q.NgayQC ELSE s.NgayGhiNhan END, 'yyyy-MM'), 0, SUM(s.ThanhTien)
  FROM socat s JOIN qc q ON q.DonHangID = s.DonHangID
  GROUP BY FORMAT(CASE WHEN q.NgayQC > s.NgayGhiNhan THEN q.NgayQC ELSE s.NgayGhiNhan END, 'yyyy-MM')
)
SELECT N'BANG 3 — quy cat theo thang' AS Bang, Thang,
       SUM(QuyCat_TRUOC) AS QuyCat_TRUOC_theoThangCat,
       SUM(QuyCat_SAU)   AS QuyCat_SAU_theoKyQC,
       SUM(QuyCat_SAU) - SUM(QuyCat_TRUOC) AS ChenhLech
FROM thang
GROUP BY Thang
ORDER BY Thang;

/* BANG 4 — tien gia cong / in theu cua lenh CHUA QC ma da ghi SL nhan: so cong no nha gia cong se GIAM
   dung bang nay sau v9.02 (truoc v9.02 nhanh cong no khong co WHERE ky nen van cong). Don gia tinh
   gan dung theo dong gia dau tien cua don (cung cach TOP 1 cua util, chua xet dai size) — de biet DO LON,
   so chinh xac xem o tab Cong no nha gia cong truoc/sau deploy. */
;WITH qc AS (
  SELECT q.DonHangID, MIN(q.NgayGhiNhan) AS NgayQC
  FROM TienDoSanXuat q
  JOIN CongDoanSanXuat c ON c.StageID = q.StageID
  WHERE UPPER(LTRIM(RTRIM(ISNULL(c.MaCongDoan, N'')))) = N'QC'
     OR UPPER(LTRIM(RTRIM(ISNULL(c.TenCongDoan, N'')))) = N'QC'
  GROUP BY q.DonHangID
)
SELECT N'BANG 4 — gia cong chua QC' AS Bang, ncc.TenNha, d.MaDH, hm.TenHangMuc,
       ISNULL(ct.SoLuongNhan, 0) AS SoLuongNhan,
       ISNULL(dhg.DonGia, hm.DonGiaMacDinh) AS DonGia,
       ISNULL(ct.SoLuongNhan, 0) * ISNULL(ISNULL(dhg.DonGia, hm.DonGiaMacDinh), 0) AS ThanhTien
FROM DonHangChiTietNhaGiaCong ct
JOIN NhaGiaCong ncc ON ncc.NhaGiaCongID = ct.NhaGiaCongID
JOIN DonHangSanXuat d ON d.DonHangID = ct.DonHangID
LEFT JOIN HangMucGiaCong hm ON hm.HangMucGiaCongID = ct.HangMucGiaCongID
OUTER APPLY (SELECT TOP 1 x.DonGia FROM DonHangHangMucGiaCong x
             WHERE x.HangMucGiaCongID = ct.HangMucGiaCongID AND x.DonHangID = ct.DonHangID
               AND (x.DaiSizeID = ct.DaiSizeID OR x.DaiSizeID IS NULL)
             ORDER BY CASE WHEN x.DaiSizeID IS NOT NULL THEN 0 ELSE 1 END, ISNULL(x.TenPhieu, N''), x.ID) dhg
LEFT JOIN qc q ON q.DonHangID = ct.DonHangID
WHERE ISNULL(ct.SoLuongNhan, 0) > 0 AND q.DonHangID IS NULL
ORDER BY ncc.TenNha, d.MaDH;

;WITH qc AS (
  SELECT q.DonHangID, MIN(q.NgayGhiNhan) AS NgayQC
  FROM TienDoSanXuat q
  JOIN CongDoanSanXuat c ON c.StageID = q.StageID
  WHERE UPPER(LTRIM(RTRIM(ISNULL(c.MaCongDoan, N'')))) = N'QC'
     OR UPPER(LTRIM(RTRIM(ISNULL(c.TenCongDoan, N'')))) = N'QC'
  GROUP BY q.DonHangID
)
SELECT N'BANG 4b — in theu chua QC' AS Bang, ncc.TenNha, d.MaDH,
       ISNULL(it.SoLuongNhan, 0) AS SoLuongNhan
FROM DonHangNhaInTheu it
JOIN NhaGiaCong ncc ON ncc.NhaGiaCongID = it.NhaInID
JOIN DonHangSanXuat d ON d.DonHangID = it.DonHangID
LEFT JOIN qc q ON q.DonHangID = it.DonHangID
WHERE ISNULL(it.SoLuongNhan, 0) > 0 AND q.DonHangID IS NULL
ORDER BY ncc.TenNha, d.MaDH;
