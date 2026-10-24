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
/* 2026-10-20: TÁCH THÂN / PHỐI. Lần chạy đầu ra 60 lệnh, 35 lệnh "⚠️ nhiều hệ số" — nhưng gần hết là
   cây BO cắt hệ số gấp đôi cây thân (5/10, 6/12). Code (v8.93, utils/cayThanhPham.js) chỉ lấy hệ số
   của cây THÂN, nên cảnh báo gộp cả bo là cảnh báo giả. Nay chia hai cột: Than_* (cây có dòng phiếu
   xuất 'Chính' hoặc không có phiếu xuất) và Phoi_* (cây chỉ có dòng 'Phối'). Chỉ Than_Min ≠ Than_Max
   mới là "nhiều hệ số" thật. (Không áp luật B ở đây cho gọn — câu này chỉ để khoanh vùng.) */
WITH cay AS (
  SELECT t.DonHangID, cc.CayID, cc.HeSoQuyDoi,
         CASE WHEN EXISTS (SELECT 1 FROM PhieuXuatVaiChiTiet px JOIN PhieuXuatVai p ON p.PhieuXuatID = px.PhieuXuatID
                           WHERE px.CayID = cc.CayID AND p.DonHangID = t.DonHangID AND px.KieuVai = N'Chính') THEN 1
              WHEN NOT EXISTS (SELECT 1 FROM PhieuXuatVaiChiTiet px JOIN PhieuXuatVai p ON p.PhieuXuatID = px.PhieuXuatID
                               WHERE px.CayID = cc.CayID AND p.DonHangID = t.DonHangID) THEN 1
              ELSE 0 END AS LaThan
  FROM TienDoSanXuat t
  JOIN TienDoCatChiTietCay cc ON cc.TienDoID = t.TienDoID
  WHERE t.StageID = @cat AND ISNULL(cc.HeSoQuyDoi, 0) > 0
),
heCat AS (
  SELECT DonHangID,
         MIN(CASE WHEN LaThan = 1 THEN HeSoQuyDoi END) AS Than_Min,
         MAX(CASE WHEN LaThan = 1 THEN HeSoQuyDoi END) AS Than_Max,
         SUM(CASE WHEN LaThan = 1 THEN 1 ELSE 0 END)   AS Than_SoCay,
         MIN(CASE WHEN LaThan = 0 THEN HeSoQuyDoi END) AS Phoi_Min,
         MAX(CASE WHEN LaThan = 0 THEN HeSoQuyDoi END) AS Phoi_Max,
         SUM(CASE WHEN LaThan = 0 THEN 1 ELSE 0 END)   AS Phoi_SoCay
  FROM cay GROUP BY DonHangID
)
SELECT d.MaDH, d.TrangThai,
       cd.TenCongDoan AS CongDoanHienTai,
       d.HeSoQuyDoi   AS HeSoLenh,
       h.Than_Min, h.Than_Max, h.Than_SoCay,
       h.Phoi_Min, h.Phoi_Max, h.Phoi_SoCay,
       CASE WHEN h.Than_Min <> h.Than_Max THEN N'🔴 THÂN nhiều hệ số — mở sổ cắt xem'
            WHEN h.Than_Min IS NULL THEN N'⚠️ không có cây thân (chưa khai Kiểu phiếu xuất?)'
            WHEN ABS(ISNULL(d.HeSoQuyDoi, 0) - h.Than_Max) > 0.0005 THEN N'lệnh ≠ Cắt — v8.92 đã lấy theo Cắt'
            ELSE N'' END AS GhiChu
FROM heCat h
JOIN DonHangSanXuat d ON d.DonHangID = h.DonHangID
LEFT JOIN CongDoanSanXuat cd ON cd.StageID = d.CongDoanHienTaiID
WHERE ABS(ISNULL(d.HeSoQuyDoi, 0) - ISNULL(h.Than_Max, 0)) > 0.0005
   OR h.Than_Min <> h.Than_Max
   OR h.Than_Min IS NULL
ORDER BY CASE WHEN h.Than_Min <> h.Than_Max THEN 0 WHEN h.Than_Min IS NULL THEN 1 ELSE 2 END, d.DonHangID DESC;

/* ---------- TRUY VẤN 2: trong số lệnh lệch, lệnh nào ĐÃ GHI Đóng gói / Kho nhập ----------
   Đây là số đã lưu SAI (nếu người nhập gõ theo ri). Cột `NeuTheoCat` = số sẽ là bao nhiêu nếu phần
   "ri" được nhân lại bằng hệ số Cắt — CHỈ ĐÚNG KHI toàn bộ số đã ghi là ri chẵn (lẻ = 0). Có phần lẻ
   thì không tách lại được từ tổng cái, phải hỏi người đã nhập.
   So `DaGhi` với `Cat_Cai`: nếu DaGhi nhỏ hơn Cat_Cai đúng ~ (HeSoCat / HeSoLenh) lần thì gần như
   chắc chắn là gõ theo ri với hệ số sai. */
/* 2026-10-20: chỉ xét cây THÂN (cùng cách tách như truy vấn 1), và CHỈ các đợt ghi từ 26/09/2026 —
   trước ngày đó form ĐG/KN nhập thẳng CÁI (chưa có ô Ri, v8.49), số ghi không đi qua hệ số nào. */
DECLARE @tuNgayNhapRi DATE = '2026-09-26';
WITH cay AS (
  SELECT t.DonHangID, cc.SoLuongLop, cc.HeSoQuyDoi,
         CASE WHEN EXISTS (SELECT 1 FROM PhieuXuatVaiChiTiet px JOIN PhieuXuatVai p ON p.PhieuXuatID = px.PhieuXuatID
                           WHERE px.CayID = cc.CayID AND p.DonHangID = t.DonHangID AND px.KieuVai = N'Chính') THEN 1
              WHEN NOT EXISTS (SELECT 1 FROM PhieuXuatVaiChiTiet px JOIN PhieuXuatVai p ON p.PhieuXuatID = px.PhieuXuatID
                               WHERE px.CayID = cc.CayID AND p.DonHangID = t.DonHangID) THEN 1
              ELSE 0 END AS LaThan
  FROM TienDoSanXuat t
  JOIN TienDoCatChiTietCay cc ON cc.TienDoID = t.TienDoID
  WHERE t.StageID = @cat AND ISNULL(cc.HeSoQuyDoi, 0) > 0
),
heCat AS (
  SELECT DonHangID,
         MAX(HeSoQuyDoi) AS HeSoCat, MIN(HeSoQuyDoi) AS HeSoCatMin,
         SUM(SoLuongLop * HeSoQuyDoi) AS Cat_Cai_Than
  FROM cay WHERE LaThan = 1
  GROUP BY DonHangID
),
daGhi AS (
  SELECT t.DonHangID, t.StageID,
         SUM(ct.SoLuongLuyKe) AS DaGhi, COUNT(DISTINCT t.TienDoID) AS SoDot,
         MIN(t.NgayGhiNhan) AS DotDau, MAX(t.NgayGhiNhan) AS DotCuoi
  FROM TienDoSanXuat t
  JOIN TienDoChiTietMau ct ON ct.TienDoID = t.TienDoID
  WHERE t.StageID IN (@dg, @kn) AND t.NgayGhiNhan >= @tuNgayNhapRi
  GROUP BY t.DonHangID, t.StageID
)
SELECT d.MaDH, d.TrangThai,
       CASE g.StageID WHEN @dg THEN N'Đóng gói' WHEN @kn THEN N'Kho nhập' END AS CongDoan,
       d.HeSoQuyDoi AS HeSoLenh, h.HeSoCat,
       h.Cat_Cai_Than,
       g.DaGhi, g.SoDot, g.DotDau, g.DotCuoi,
       CASE WHEN ISNULL(d.HeSoQuyDoi, 0) > 0
            THEN g.DaGhi / d.HeSoQuyDoi * h.HeSoCat END AS NeuTheoCat,
       CASE WHEN h.HeSoCat <> h.HeSoCatMin THEN N'thân nhiều hệ số — xem tay'
            WHEN ISNULL(d.HeSoQuyDoi, 0) > 0 AND g.DaGhi % d.HeSoQuyDoi <> 0
            THEN N'có lẻ — không tự suy ngược được'
            WHEN g.DaGhi > h.Cat_Cai_Than THEN N'đã ghi > Cắt?? (nhập cái, không phải ri)'
            ELSE N'' END AS GhiChu
FROM daGhi g
JOIN DonHangSanXuat d ON d.DonHangID = g.DonHangID
JOIN heCat h ON h.DonHangID = g.DonHangID
WHERE ABS(ISNULL(d.HeSoQuyDoi, 0) - h.HeSoCat) > 0.0005
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
