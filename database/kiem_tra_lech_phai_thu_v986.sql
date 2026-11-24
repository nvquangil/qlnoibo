/* ==================================================================================================
   kiem_tra_lech_phai_thu_v986.sql — CHI DOC (SELECT), KHONG SUA GI. Chay bao nhieu lan cung duoc.
   --------------------------------------------------------------------------------------------------
   Muc dich: sau khi v9.86 vá vế "hàng khách trả", Bao cao KD va Dashboard VAN lech:
       Bao cao KD  (Phai thu khach)   = 5.942.167.454
       Dashboard   (CON NO luy ke)    = 5.525.846.877
       LECH                           =   416.320.577
   File nay che khoan lech do thanh TUNG PHAN co ten, de biet sua o dau.

   HAI cong thuc khac nhau o DUNG 3 diem (da doc code, khong doan):
     1. NGAY  : Bao cao co can tren `<= @den`; Dashboard KHONG loc ngay (luy ke den hien tai).
     2. TEN   : Dashboard vut MOI chung tu co ten khach RONG (NULLIF(Ten,'') IS NOT NULL);
                Bao cao cong tat. (congno.js thi gom vao dong "(không tên)" — ba man ba kieu.)
     3. LOC   : Dashboard chiu bo loc "Chọn khách theo dõi" + loc Nhom khach; Bao cao khong co.
   => Neu [TONG_GIAI_THICH_DUOC] ra dung 416.320.577 thi nguyen nhan nam tron trong 1+2.
      Neu KHONG ra du, phan thieu la do diem 3 -> kiem nut "Chọn khách theo dõi" tren Dashboard.

   🔴 DOI @den cho khop o "Đến ngày" dang chon tren man Bao cao kinh doanh.
   ================================================================================================== */
DECLARE @den DATE = '2026-11-19';

/* ---------- PHAN 1: dung lai ca hai con so + khoan lech ---------- */
;WITH bc AS (   -- kieu BAO CAO: co can ngay, KHONG loai ten rong
  SELECT
    (SELECT ISNULL(SUM(TongThanhToan),0) FROM PhieuBanHang    WHERE TrangThai <> N'Đã hủy'      AND NgayBan  <= @den) AS Ban,
    (SELECT ISNULL(SUM(SoTien),0)        FROM PhieuThu        WHERE LoaiDoiTuong = N'KhachHang' AND NgayThu  <= @den) AS Thu,
    (SELECT ISNULL(SUM(SoTien),0)        FROM CongNoDieuChinh WHERE LoaiDoiTuong = N'KhachHang' AND Ngay     <= @den) AS DC,
    (SELECT ISNULL(SUM(TongThanhToan),0) FROM PhieuNhapLai    WHERE TrangThai <> N'Đã hủy'      AND NgayNhap <= @den) AS Tra
), db AS (      -- kieu DASHBOARD: KHONG can ngay, LOAI ten rong
  SELECT
    (SELECT ISNULL(SUM(TongThanhToan),0) FROM PhieuBanHang    WHERE TrangThai <> N'Đã hủy'      AND NULLIF(LTRIM(RTRIM(TenKhach)),'') IS NOT NULL) AS Ban,
    (SELECT ISNULL(SUM(SoTien),0)        FROM PhieuThu        WHERE LoaiDoiTuong = N'KhachHang' AND NULLIF(LTRIM(RTRIM(ISNULL(TenDoiTuong,''))),'') IS NOT NULL) AS Thu,
    (SELECT ISNULL(SUM(SoTien),0)        FROM CongNoDieuChinh WHERE LoaiDoiTuong = N'KhachHang' AND NULLIF(LTRIM(RTRIM(ISNULL(TenDoiTuong,''))),'') IS NOT NULL) AS DC,
    (SELECT ISNULL(SUM(TongThanhToan),0) FROM PhieuNhapLai    WHERE TrangThai <> N'Đã hủy'      AND NULLIF(LTRIM(RTRIM(TenKhach)),'') IS NOT NULL) AS Tra
)
SELECT
  bc.Ban + bc.DC - bc.Thu - bc.Tra                        AS [1_BaoCao_PhaiThu____mong_5942167454],
  db.Ban + db.DC - db.Thu - db.Tra                        AS [2_Dashboard_ConNo___mong_5525846877],
  (bc.Ban + bc.DC - bc.Thu - bc.Tra)
    - (db.Ban + db.DC - db.Thu - db.Tra)                  AS [3_LECH______________mong_416320577]
FROM bc CROSS JOIN db;

/* ---------- PHAN 2: che khoan lech thanh tung phan co ten ----------
   Cot [AnhHuongLech] = phan dong gop vao (BaoCao - Dashboard). Cong het lai phai ra khoan lech o Phan 1.
   Dau DUONG  = lam Bao cao CAO hon Dashboard.
   Dau AM     = lam Bao cao THAP hon Dashboard.                                                      */
SELECT N'A1. Phiếu bán hàng TÊN RỖNG (Dashboard vứt)'                 AS KhoanMuc,
       COUNT(*) AS SoChungTu, ISNULL(SUM(TongThanhToan),0) AS SoTien,
       ISNULL(SUM(TongThanhToan),0) AS AnhHuongLech
FROM PhieuBanHang WHERE TrangThai <> N'Đã hủy' AND NgayBan <= @den
  AND NULLIF(LTRIM(RTRIM(TenKhach)),'') IS NULL
UNION ALL
SELECT N'A2. Điều chỉnh công nợ TÊN RỖNG (Dashboard vứt)',
       COUNT(*), ISNULL(SUM(SoTien),0), ISNULL(SUM(SoTien),0)
FROM CongNoDieuChinh WHERE LoaiDoiTuong = N'KhachHang' AND Ngay <= @den
  AND NULLIF(LTRIM(RTRIM(ISNULL(TenDoiTuong,''))),'') IS NULL
UNION ALL
SELECT N'A3. Phiếu thu TÊN RỖNG (Dashboard vứt) — kéo lệch xuống',
       COUNT(*), ISNULL(SUM(SoTien),0), -ISNULL(SUM(SoTien),0)
FROM PhieuThu WHERE LoaiDoiTuong = N'KhachHang' AND NgayThu <= @den
  AND NULLIF(LTRIM(RTRIM(ISNULL(TenDoiTuong,''))),'') IS NULL
UNION ALL
SELECT N'A4. Nhập lại TÊN RỖNG (Dashboard vứt) — kéo lệch xuống',
       COUNT(*), ISNULL(SUM(TongThanhToan),0), -ISNULL(SUM(TongThanhToan),0)
FROM PhieuNhapLai WHERE TrangThai <> N'Đã hủy' AND NgayNhap <= @den
  AND NULLIF(LTRIM(RTRIM(TenKhach)),'') IS NULL
UNION ALL
SELECT N'B1. Phiếu bán hàng NGÀY SAU ' + CONVERT(varchar(10), @den, 103) + N' (chỉ Dashboard tính)',
       COUNT(*), ISNULL(SUM(TongThanhToan),0), -ISNULL(SUM(TongThanhToan),0)
FROM PhieuBanHang WHERE TrangThai <> N'Đã hủy' AND NgayBan > @den
  AND NULLIF(LTRIM(RTRIM(TenKhach)),'') IS NOT NULL
UNION ALL
SELECT N'B2. Điều chỉnh NGÀY SAU (chỉ Dashboard tính)',
       COUNT(*), ISNULL(SUM(SoTien),0), -ISNULL(SUM(SoTien),0)
FROM CongNoDieuChinh WHERE LoaiDoiTuong = N'KhachHang' AND Ngay > @den
  AND NULLIF(LTRIM(RTRIM(ISNULL(TenDoiTuong,''))),'') IS NOT NULL
UNION ALL
SELECT N'B3. Phiếu thu NGÀY SAU (chỉ Dashboard trừ) — kéo lệch LÊN',
       COUNT(*), ISNULL(SUM(SoTien),0), ISNULL(SUM(SoTien),0)
FROM PhieuThu WHERE LoaiDoiTuong = N'KhachHang' AND NgayThu > @den
  AND NULLIF(LTRIM(RTRIM(ISNULL(TenDoiTuong,''))),'') IS NOT NULL
UNION ALL
SELECT N'B4. Nhập lại NGÀY SAU (chỉ Dashboard trừ) — kéo lệch LÊN',
       COUNT(*), ISNULL(SUM(TongThanhToan),0), ISNULL(SUM(TongThanhToan),0)
FROM PhieuNhapLai WHERE TrangThai <> N'Đã hủy' AND NgayNhap > @den
  AND NULLIF(LTRIM(RTRIM(TenKhach)),'') IS NOT NULL
ORDER BY KhoanMuc;

/* ---------- PHAN 3: so khach, de biet Dashboard co dang bi LOC khong ----------
   So nay phai bang dung o "Số khách" tren Dashboard (dang hien 142).
   Ra NHIEU HON 142  => Dashboard dang bat "Chọn khách theo dõi" hoac loc Nhom
                        => phan lech con lai la do no chi cong mot tap con.                           */
SELECT COUNT(*) AS [SoKhach_Dashboard_phai_ra___dang_hien_142]
FROM (
  SELECT LTRIM(RTRIM(TenKhach)) AS Ten FROM PhieuBanHang WHERE TrangThai <> N'Đã hủy'
  UNION SELECT LTRIM(RTRIM(TenKhach))  FROM PhieuNhapLai WHERE TrangThai <> N'Đã hủy'
  UNION SELECT LTRIM(RTRIM(ISNULL(TenDoiTuong,''))) FROM PhieuThu        WHERE LoaiDoiTuong = N'KhachHang'
  UNION SELECT LTRIM(RTRIM(ISNULL(TenDoiTuong,''))) FROM CongNoDieuChinh WHERE LoaiDoiTuong = N'KhachHang'
) z WHERE NULLIF(z.Ten,'') IS NOT NULL;

/* ---------- PHAN 4: liet ke CHUNG TU TEN RONG de nhin tan mat ----------
   Neu Phan 2 cho thay A1/A2 co tien, chay tiep doan nay de biet chinh xac phieu nao.               */
SELECT TOP 100 N'Bán hàng' AS Loai, SoPhieu AS SoChungTu, NgayBan AS Ngay,
       N'[' + ISNULL(TenKhach, N'<NULL>') + N']' AS TenKhach_trong_ngoac, TongThanhToan AS SoTien
FROM PhieuBanHang WHERE TrangThai <> N'Đã hủy' AND NgayBan <= @den
  AND NULLIF(LTRIM(RTRIM(TenKhach)),'') IS NULL
ORDER BY NgayBan DESC;
