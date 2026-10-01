/* ================================================================================================
   migration_v852.sql — RÀ SOÁT HẬU QUẢ CỦA VIỆC DÙNG SAI HỆ SỐ QUY ĐỔI RI → CÁI

   ⚠️ FILE NÀY CHỈ CÓ LỆNH ĐỌC. KHÔNG CÓ LỆNH NÀO SỬA DỮ LIỆU.
   Mục đích: đo xem sai lệch tới đâu, để Nguyen quyết có sửa hay không. Sửa dữ liệu là việc riêng,
   chỉ làm sau khi đã xem con số thật và đã backup.

   ------------------------------------------------------------------------------------------------
   NGUYÊN NHÂN
   ------------------------------------------------------------------------------------------------
   Nguyen xác nhận 2026-09-26: **SỐ RI CHÍNH LÀ SỐ LỚP** ở công đoạn Cắt.

       số ri = số lớp                 (mỗi lớp cắt ra một bộ size = một ri)
       1 ri  = HeSoQuyDoi cái         (số sản phẩm trên một sơ đồ)
       cái   = ri × HeSoQuyDoi

   Khớp đúng công thức đang chạy ở Cắt: SL cái = số lớp × hệ số.
   Ví dụ: cắt 18 lớp, hệ số 5  ->  18 ri, 90 cái, mỗi ri 5 cái.

   Từ v8.31 đến v8.51, công thức ghi của công đoạn **Đóng gói** lấy nhầm TongSoLop (số lớp) làm hệ
   số, tức: cái = ri × số_lớp thay vì ri × hệ_số. Với ví dụ trên, nhập 10 ri lẽ ra 50 cái thì hệ
   thống đã lưu 180 cái.

       Tỉ lệ sai = TongSoLop / HeSoQuyDoi

   Lệnh nào tình cờ có số lớp = hệ số thì không sai. Lệnh nào TongSoLop = 0 (chưa ghi sổ cắt chi
   tiết từng cây) thì hồi đó rơi vào nhánh "nhập thẳng số cái" — KHÔNG sai.

   Công đoạn **Kho nhập** lưu TỔNG CÁI (trước v8.49 nhập thẳng cái; từ v8.49 form tự quy đổi
   Ri × hệ số + lẻ rồi mới gửi). Khi hiển thị thì tách ngược: ri = tổng ÷ hệ số, lẻ = phần dư.
   Nếu hệ số quy đổi của lệnh bị khai sai thì phép tách ngược đó lệch theo — TRUY VẤN 2 để soi.

   ------------------------------------------------------------------------------------------------
   CHẠY GÌ
   ------------------------------------------------------------------------------------------------
   Chạy TRUY VẤN 1 trước để biết quy mô. Nếu ra 0 dòng thì không có gì phải làm.
   Gửi kết quả TRUY VẤN 1 và 2 để cùng quyết bước sửa.
   ================================================================================================ */

USE QLNoiBo;
GO

/* ------------------------------------------------------------------------------------------------
   TRUY VẤN 1 — TỔNG QUAN: những lệnh SX có đợt Đóng gói bị lưu sai, và sai bao nhiêu.

   `TiLeSai` = số đang lưu gấp mấy lần số đúng. Bằng 1 nghĩa là không sai.
   ------------------------------------------------------------------------------------------------ */
WITH catTd AS (
  /* Bản ghi Cắt "có hiệu lực" — GIỐNG effectiveTienDoIds() nhánh CAT (v5.48): mỗi sơ đồ lấy bản
     ghi mới nhất của chính sơ đồ đó; bản ghi không gắn sơ đồ giữ hết. */
  SELECT t.DonHangID, t.TienDoID
  FROM TienDoSanXuat t
  JOIN CongDoanSanXuat c ON c.StageID = t.StageID
                        AND UPPER(LTRIM(RTRIM(ISNULL(c.MaCongDoan, N'')))) = N'CAT'
  WHERE t.SoDoID IS NULL
     OR t.TienDoID = (SELECT MAX(t2.TienDoID) FROM TienDoSanXuat t2
                       WHERE t2.DonHangID = t.DonHangID AND t2.StageID = t.StageID
                         AND t2.SoDoID = t.SoDoID)
),
lop AS (
  SELECT catTd.DonHangID, dv.MauSacID, SUM(cc.SoLuongLop) AS TongSoLop
  FROM catTd
  JOIN TienDoCatChiTietCay cc ON cc.TienDoID = catTd.TienDoID
  JOIN VaiCay vc              ON vc.CayID = cc.CayID
  JOIN DanhMucVai dv          ON dv.VaiID = vc.VaiID
  GROUP BY catTd.DonHangID, dv.MauSacID
),
dgMau AS (
  SELECT t.DonHangID, ct.MauSacID, SUM(ct.SoLuongLuyKe) AS DangLuu
  FROM TienDoSanXuat t
  JOIN CongDoanSanXuat c   ON c.StageID = t.StageID
                          AND UPPER(LTRIM(RTRIM(ISNULL(c.MaCongDoan, N'')))) = N'DG'
  JOIN TienDoChiTietMau ct ON ct.TienDoID = t.TienDoID
  GROUP BY t.DonHangID, ct.MauSacID
)
SELECT d.MaDH, d.TenSanPham, d.TrangThai,
       ms.TenMau,
       lop.TongSoLop              AS SoLop_tuc_SoRi,
       d.HeSoQuyDoi               AS HeSo_1Ri_bang_may_Cai,
       dgMau.DangLuu              AS DongGoi_DangLuu,
       CAST(ROUND(1.0 * dgMau.DangLuu * d.HeSoQuyDoi / NULLIF(lop.TongSoLop, 0), 0) AS INT)
                                  AS DongGoi_SoDung_UocTinh,
       CAST(ROUND(1.0 * lop.TongSoLop / NULLIF(d.HeSoQuyDoi, 0), 2) AS DECIMAL(10, 2))
                                  AS TiLeSai
FROM dgMau
JOIN DonHangSanXuat d ON d.DonHangID = dgMau.DonHangID
LEFT JOIN lop         ON lop.DonHangID = dgMau.DonHangID AND lop.MauSacID = dgMau.MauSacID
LEFT JOIN MauSac ms   ON ms.MauSacID = dgMau.MauSacID
WHERE ISNULL(lop.TongSoLop, 0) > 0            -- màu chưa có số lớp thì hồi đó nhập thẳng cái, không sai
  AND ISNULL(d.HeSoQuyDoi, 0) > 0
  AND lop.TongSoLop <> d.HeSoQuyDoi           -- số lớp = hệ số thì tình cờ đúng, bỏ qua
ORDER BY d.MaDH, ms.TenMau;
GO

/* ------------------------------------------------------------------------------------------------
   TRUY VẤN 2 — ĐỐI CHỨNG: Đóng gói so với Cắt và Kho nhập, theo từng lệnh.

   Dùng để kiểm tra lại cách hiểu bằng dữ liệu thật, trước khi tin vào TRUY VẤN 1:
     - `Cat_Cai`  = SL cái ở Cắt (đã là cái, công thức lớp × hệ số — KHÔNG dính lỗi).
     - `DG_NeuDung` phải XẤP XỈ `Cat_Cai` với lệnh đã đóng gói xong. Nếu nó vọt lên gấp nhiều lần
       Cat_Cai thì cách hiểu ở trên SAI — dừng lại, báo trước khi sửa bất cứ thứ gì.
     - `KN_Cai` = tổng thô công đoạn Kho nhập (đã là CÁI). `KN_Ri` / `KN_Le` là phép tách ngược
       (chia nguyên / phần dư cho hệ số) — đúng những con số màn hình đang hiện.
   ------------------------------------------------------------------------------------------------ */
SELECT d.MaDH, d.TenSanPham, d.HeSoQuyDoi,
       (SELECT ISNULL(SUM(ct.SoLuongLuyKe), 0)
          FROM TienDoSanXuat t JOIN TienDoChiTietMau ct ON ct.TienDoID = t.TienDoID
          JOIN CongDoanSanXuat c ON c.StageID = t.StageID
          WHERE t.DonHangID = d.DonHangID
            AND UPPER(LTRIM(RTRIM(ISNULL(c.MaCongDoan, N'')))) = N'CAT')            AS Cat_Cai,
       (SELECT ISNULL(SUM(ct.SoLuongLuyKe), 0)
          FROM TienDoSanXuat t JOIN TienDoChiTietMau ct ON ct.TienDoID = t.TienDoID
          JOIN CongDoanSanXuat c ON c.StageID = t.StageID
          WHERE t.DonHangID = d.DonHangID
            AND UPPER(LTRIM(RTRIM(ISNULL(c.MaCongDoan, N'')))) = N'DG')             AS DG_DangLuu,
       (SELECT ISNULL(SUM(ct.SoLuongLuyKe), 0)
          FROM TienDoSanXuat t JOIN TienDoChiTietMau ct ON ct.TienDoID = t.TienDoID
          JOIN CongDoanSanXuat c ON c.StageID = t.StageID
          WHERE t.DonHangID = d.DonHangID
            AND UPPER(LTRIM(RTRIM(ISNULL(c.MaCongDoan, N'')))) = N'KN')             AS KN_Cai,
       (SELECT ISNULL(SUM(ct.SoLuongLuyKe), 0) / NULLIF(ISNULL(d.HeSoQuyDoi, 0), 0)
          FROM TienDoSanXuat t JOIN TienDoChiTietMau ct ON ct.TienDoID = t.TienDoID
          JOIN CongDoanSanXuat c ON c.StageID = t.StageID
          WHERE t.DonHangID = d.DonHangID
            AND UPPER(LTRIM(RTRIM(ISNULL(c.MaCongDoan, N'')))) = N'KN')             AS KN_Ri,
       (SELECT ISNULL(SUM(ct.SoLuongLuyKe), 0) % NULLIF(ISNULL(d.HeSoQuyDoi, 0), 0)
          FROM TienDoSanXuat t JOIN TienDoChiTietMau ct ON ct.TienDoID = t.TienDoID
          JOIN CongDoanSanXuat c ON c.StageID = t.StageID
          WHERE t.DonHangID = d.DonHangID
            AND UPPER(LTRIM(RTRIM(ISNULL(c.MaCongDoan, N'')))) = N'KN')             AS KN_Le,
       d.TongSoLuong
FROM DonHangSanXuat d
WHERE EXISTS (SELECT 1 FROM TienDoSanXuat t
              JOIN CongDoanSanXuat c ON c.StageID = t.StageID
              WHERE t.DonHangID = d.DonHangID
                AND UPPER(LTRIM(RTRIM(ISNULL(c.MaCongDoan, N'')))) = N'DG')
ORDER BY d.DonHangID DESC;
GO

/* ================================================================================================
   GHI CHÚ v8.53 — KHÔNG CÒN VIỆC "QUY ĐỔI DỮ LIỆU KHO NHẬP"

   Bản v8.52 từng giả định công đoạn Kho nhập lưu theo RI và đã nhân hệ số một lần khi đọc. SAI:
   số lưu ĐÃ là tổng CÁI. v8.53 bỏ hết các phép nhân đó, thay bằng TÁCH NGƯỢC khi hiển thị
   (ri = tổng ÷ hệ số, lẻ = phần dư). Không có dữ liệu Kho nhập nào cần sửa.

   Phần còn phải quyết vẫn là DỮ LIỆU ĐÓNG GÓI ghi từ v8.31 (TRUY VẤN 1 + 2 ở trên).
   ================================================================================================ */
