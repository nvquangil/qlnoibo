/* ================================================================================================
   kiem_tra_v892 — LỆNH NÀO ĐANG CÓ HỆ SỐ RI Ở CẮT KHÁC HỆ SỐ CỦA LỆNH  (CHỈ ĐỌC, KHÔNG SỬA GÌ)
   ------------------------------------------------------------------------------------------------
   Tên file CỐ Ý không có tiền tố migration_v: tao_file_cai_dat.js quét migration_v*.sql, mà đây
   là truy vấn chẩn đoán, không phải schema.

   Nguyen 2026-10-17: *"Ghi tiến độ, công đoạn đóng gói và kho nhập 1 ri = 1 cái (hệ số quy đổi của
   lệnh) đang bị sai. Ví dụ lệnh DH2609111 ở công đoạn cắt đang hệ số 11 nhưng ra đóng gói và kho
   nhập là 1."*

   Cơ chế: Cắt dùng TienDoCatChiTietCay.HeSoQuyDoi (từng cây, v6.08); Đóng gói / Kho nhập (v8.52)
   quy đổi Ri bằng DonHangSanXuat.HeSoQuyDoi (ô ở Ra lệnh SX, mặc định 1). v8.92 đổi Đóng gói /
   Kho nhập sang dùng hệ số của Cắt — từ nay trở đi. Số ĐÃ GHI trước đó thì vẫn sai.

   Mục đích file này: đo xem có BAO NHIÊU lệnh dính, và dính nặng tới đâu, TRƯỚC KHI bàn chuyện
   sửa dữ liệu. Không sửa gì ở đây; sửa dữ liệu là việc không đảo ngược, phải nhìn số rồi quyết.

   Chạy: SSMS trên database QLNoiBo. Ba truy vấn, đọc từ trên xuống.
   ================================================================================================ */
USE QLNoiBo;
GO

DECLARE @cat INT = (SELECT TOP 1 StageID FROM CongDoanSanXuat WHERE MaCongDoan = 'CAT');
DECLARE @dg  INT = (SELECT TOP 1 StageID FROM CongDoanSanXuat WHERE MaCongDoan = 'DG');
DECLARE @kn  INT = (SELECT TOP 1 StageID FROM CongDoanSanXuat WHERE MaCongDoan = 'KN');

/* ---------- TRUY VẤN 1: hệ số ở Cắt so với hệ số của lệnh, từng lệnh ----------
   HeSoCatMin = HeSoCatMax  -> Cắt dùng MỘT hệ số duy nhất cho cả lệnh (trường hợp thường)
   khác nhau                -> các cây của lệnh mang hệ số khác nhau; v8.92 LÙI VỀ hệ số lệnh và
                               cảnh báo đỏ trên form — lệnh đó phải xem tay.
   Chỉ liệt kê lệnh LỆCH (Cắt ≠ lệnh). DH2609111 phải có mặt ở đây với HeSoLenh = 1, HeSoCat = 11. */
WITH heCat AS (
  SELECT t.DonHangID,
         MIN(cc.HeSoQuyDoi) AS HeSoCatMin, MAX(cc.HeSoQuyDoi) AS HeSoCatMax,
         COUNT(*) AS SoCay
  FROM TienDoSanXuat t
  JOIN TienDoCatChiTietCay cc ON cc.TienDoID = t.TienDoID
  WHERE t.StageID = @cat AND ISNULL(cc.HeSoQuyDoi, 0) > 0
  GROUP BY t.DonHangID
)
SELECT d.MaDH, d.TrangThai,
       cd.TenCongDoan AS CongDoanHienTai,
       d.HeSoQuyDoi   AS HeSoLenh,
       h.HeSoCatMin, h.HeSoCatMax, h.SoCay,
       CASE WHEN h.HeSoCatMin <> h.HeSoCatMax THEN N'⚠️ Cắt nhiều hệ số' ELSE N'' END AS GhiChu
FROM heCat h
JOIN DonHangSanXuat d ON d.DonHangID = h.DonHangID
LEFT JOIN CongDoanSanXuat cd ON cd.StageID = d.CongDoanHienTaiID
WHERE ABS(ISNULL(d.HeSoQuyDoi, 0) - h.HeSoCatMax) > 0.0005
   OR h.HeSoCatMin <> h.HeSoCatMax
ORDER BY d.DonHangID DESC;

/* ---------- TRUY VẤN 2: trong số lệnh lệch, lệnh nào ĐÃ GHI Đóng gói / Kho nhập ----------
   Đây là số đã lưu SAI (nếu người nhập gõ theo ri). Cột `NeuTheoCat` = số sẽ là bao nhiêu nếu phần
   "ri" được nhân lại bằng hệ số Cắt — CHỈ ĐÚNG KHI toàn bộ số đã ghi là ri chẵn (lẻ = 0). Có phần lẻ
   thì không tách lại được từ tổng cái, phải hỏi người đã nhập.
   So `DaGhi` với `Cat_Cai`: nếu DaGhi nhỏ hơn Cat_Cai đúng ~ (HeSoCat / HeSoLenh) lần thì gần như
   chắc chắn là gõ theo ri với hệ số sai. */
WITH heCat AS (
  SELECT t.DonHangID, MAX(cc.HeSoQuyDoi) AS HeSoCat, MIN(cc.HeSoQuyDoi) AS HeSoCatMin
  FROM TienDoSanXuat t
  JOIN TienDoCatChiTietCay cc ON cc.TienDoID = t.TienDoID
  WHERE t.StageID = @cat AND ISNULL(cc.HeSoQuyDoi, 0) > 0
  GROUP BY t.DonHangID
),
catCai AS (
  SELECT t.DonHangID, SUM(cc.SoLuongLop * cc.HeSoQuyDoi) AS Cat_Cai
  FROM TienDoSanXuat t
  JOIN TienDoCatChiTietCay cc ON cc.TienDoID = t.TienDoID
  WHERE t.StageID = @cat
  GROUP BY t.DonHangID
),
daGhi AS (
  SELECT t.DonHangID, t.StageID, SUM(ct.SoLuongLuyKe) AS DaGhi, COUNT(DISTINCT t.TienDoID) AS SoDot
  FROM TienDoSanXuat t
  JOIN TienDoChiTietMau ct ON ct.TienDoID = t.TienDoID
  WHERE t.StageID IN (@dg, @kn)
  GROUP BY t.DonHangID, t.StageID
)
SELECT d.MaDH,
       CASE g.StageID WHEN @dg THEN N'Đóng gói' WHEN @kn THEN N'Kho nhập' END AS CongDoan,
       d.HeSoQuyDoi AS HeSoLenh, h.HeSoCat,
       c.Cat_Cai,
       g.DaGhi, g.SoDot,
       CASE WHEN ISNULL(d.HeSoQuyDoi, 0) > 0
            THEN g.DaGhi / d.HeSoQuyDoi * h.HeSoCat END AS NeuTheoCat,
       CASE WHEN ISNULL(d.HeSoQuyDoi, 0) > 0 AND g.DaGhi % d.HeSoQuyDoi <> 0
            THEN N'có lẻ — không tự suy ngược được' ELSE N'' END AS GhiChu
FROM daGhi g
JOIN DonHangSanXuat d ON d.DonHangID = g.DonHangID
JOIN heCat h ON h.DonHangID = g.DonHangID
LEFT JOIN catCai c ON c.DonHangID = g.DonHangID
WHERE ABS(ISNULL(d.HeSoQuyDoi, 0) - h.HeSoCat) > 0.0005
  AND h.HeSoCat = h.HeSoCatMin
ORDER BY d.DonHangID DESC, g.StageID;

/* ---------- TRUY VẤN 3: riêng DH2609111, từng dòng đã ghi ở Đóng gói / Kho nhập ----------
   Để đối chiếu tay với sổ giấy của tổ: mỗi đợt ghi bao nhiêu, màu nào. */
SELECT d.MaDH,
       CASE t.StageID WHEN @dg THEN N'Đóng gói' WHEN @kn THEN N'Kho nhập' END AS CongDoan,
       t.TienDoID, t.NgayGhiNhan, ms.TenMau, ct.SoLuongLuyKe AS DaGhi_Cai,
       d.HeSoQuyDoi AS HeSoLenh
FROM TienDoSanXuat t
JOIN DonHangSanXuat d ON d.DonHangID = t.DonHangID
JOIN TienDoChiTietMau ct ON ct.TienDoID = t.TienDoID
LEFT JOIN MauSac ms ON ms.MauSacID = ct.MauSacID
WHERE d.MaDH = 'DH2609111' AND t.StageID IN (@dg, @kn)
ORDER BY t.StageID, t.TienDoID, ms.TenMau;
GO
