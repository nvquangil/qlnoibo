/* ================================================================================================
   kiem_tra_sl_cat_theo_mau.sql — VÌ SAO "SL từ Cắt" CỦA MỘT MÀU KHÔNG KHỚP SỔ CẮT GIẤY?
   ------------------------------------------------------------------------------------------------
   CHỈ ĐỌC, không sửa gì. Tên file cố ý không có tiền tố migration_v (tao_file_cai_dat.js quét
   migration_v*.sql — đây là truy vấn chẩn đoán, không phải schema).

   DÙNG KHI NÀO: form Ghi tiến độ (May / QC / Đóng gói / Kho nhập) hiện cột "Cắt" của một màu khác
   với sổ cắt giấy. Ví dụ DH2608073 (2026-10-19): sổ giấy ĐEN02 30 lớp × 5 = 150, QC hiện 250.

   CÁCH DÙNG: sửa một dòng @MaDH bên dưới → Execute → đọc 4 bảng kết quả TỪ TRÊN XUỐNG.
   Bảng 1 trả lời "lệch bao nhiêu, màu nào". Bảng 2 trả lời "vì sao". Bảng 3–4 là bằng chứng chi tiết.

   ------------------------------------------------------------------------------------------------
   HỆ THỐNG TÍNH "SL từ Cắt" THẾ NÀO (qlsx.js · slCatTheoMauTuCay, v8.71):
       SL màu M = Σ (SoLuongLop × HeSoQuyDoi + SoCaiGiatCap) của từng CÂY thuộc màu M
       trong các bản ghi Cắt "HIỆU LỰC", chỉ lấy CÂY CHÍNH.
   · Bản ghi Cắt hiệu lực (effectiveTienDoIds):  MỌI bản có SoDoID NULL
                                                + bản MỚI NHẤT của mỗi SoDoID.
     ⇒ Ghi sổ cắt 2 lần mà không gắn sơ đồ là CẢ HAI cùng được cộng.
   · Cây chính (utils/cayThanhPham.js, v8.93) — ưu tiên từ trên xuống:
       S1/S2  sơ đồ của bản ghi khai Kieu = 'Phối' → loại hết; = 'Chính' → tính hết
       L3     lệnh chưa khai KieuVai ở bất kỳ dòng phiếu xuất nào → KHÔNG lọc gì
       B      BẢN GHI là lần cắt PHỐI (mọi cây đều có dòng xuất 'Phối' VÀ có cây không có dòng
              'Chính') → loại cả bản ghi, kể cả cây dùng chung thân/bo
       L1     cây có dòng phiếu xuất của lệnh khai 'Chính' → tính
       L2     cây KHÔNG có dòng phiếu xuất nào của lệnh → vẫn tính
     ⇒ Cây bo/phối CÙNG MauSacID với vải thân (quy tắc "MauSacID không định danh loại vải") lọt
        vào nếu phiếu xuất chưa khai Kiểu, hoặc cây được cấp tay không qua phiếu.
   ================================================================================================ */
USE QLNoiBo;
GO

DECLARE @MaDH NVARCHAR(50) = N'DH2608073';   -- <<< ĐỔI MÃ LỆNH Ở ĐÂY

DECLARE @cat INT = (SELECT TOP 1 StageID FROM CongDoanSanXuat WHERE MaCongDoan = 'CAT');
DECLARE @dh  INT = (SELECT DonHangID FROM DonHangSanXuat WHERE MaDH = @MaDH);
IF @dh IS NULL BEGIN PRINT N'Không tìm thấy lệnh ' + @MaDH; RETURN; END

/* Lệnh có khai KieuVai ở phiếu xuất nào chưa? (quyết định L3) */
DECLARE @coKhaiKieu BIT = CASE WHEN EXISTS (
  SELECT 1 FROM PhieuXuatVaiChiTiet px JOIN PhieuXuatVai p ON p.PhieuXuatID = px.PhieuXuatID
  WHERE p.DonHangID = @dh AND px.KieuVai IS NOT NULL) THEN 1 ELSE 0 END;
PRINT N'Lệnh ' + @MaDH + N' — đã khai Kiểu trên phiếu xuất vải: ' + CASE @coKhaiKieu WHEN 1 THEN N'CÓ (lọc L1/L2)' ELSE N'CHƯA (L3: KHÔNG lọc cây phối!)' END;

/* Kiểu của sơ đồ (cột có từ migration_v880). Đổ qua bảng tạm bằng EXEC vì SQL Server ràng buộc tên
   CỘT lúc biên dịch batch — viết thẳng `sd.Kieu` là CSDL chưa migration báo "Invalid column name"
   cho cả batch dù nhánh đó không bao giờ chạy. */
IF OBJECT_ID('tempdb..#kieuSD') IS NOT NULL DROP TABLE #kieuSD;
CREATE TABLE #kieuSD (SoDoID INT PRIMARY KEY, Kieu NVARCHAR(10));
IF COL_LENGTH('DonHangChiTietSoDo', 'Kieu') IS NOT NULL
  EXEC('INSERT #kieuSD SELECT ID, Kieu FROM DonHangChiTietSoDo WHERE Kieu IS NOT NULL');

/* Một bảng tạm: từng cây trong từng bản ghi Cắt, kèm mọi cờ hệ thống dùng để quyết định cộng hay không. */
IF OBJECT_ID('tempdb..#cay') IS NOT NULL DROP TABLE #cay;
SELECT t.TienDoID, t.NgayGhiNhan, t.SoDoID,
       CASE WHEN t.SoDoID IS NULL
              OR t.TienDoID = (SELECT MAX(t2.TienDoID) FROM TienDoSanXuat t2
                               WHERE t2.DonHangID = t.DonHangID AND t2.StageID = t.StageID AND t2.SoDoID = t.SoDoID)
            THEN 1 ELSE 0 END AS HieuLuc,
       cc.CayID, vc.MaCay, dv.MaVai, lv.TenLoaiVai, dv.MauSacID, ms.TenMau,
       cc.SoLuongLop, cc.HeSoQuyDoi, ISNULL(cc.SoCaiGiatCap, 0) AS GiatCap,
       cc.SoLuongLop * cc.HeSoQuyDoi + ISNULL(cc.SoCaiGiatCap, 0) AS Cai,
       /* Kiểu khai trên phiếu xuất vải CỦA LỆNH NÀY cho cây này (gộp nếu nhiều dòng) */
       STUFF((SELECT ',' + ISNULL(px.KieuVai, 'NULL')
              FROM PhieuXuatVaiChiTiet px JOIN PhieuXuatVai p ON p.PhieuXuatID = px.PhieuXuatID
              WHERE px.CayID = cc.CayID AND p.DonHangID = @dh
              FOR XML PATH(''), TYPE).value('.', 'NVARCHAR(MAX)'), 1, 1, '') AS KieuTrenPhieuXuat,
       CASE
         /* S1/S2: sơ đồ đã khai Kiểu (qua #kieuSD — rỗng khi CSDL chưa chạy migration_v880) */
         WHEN k.Kieu = N'Phối' THEN N'Phối (sơ đồ khai) → KHÔNG tính'
         WHEN k.Kieu = N'Chính' THEN N'L0 sơ đồ khai Chính → tính'
         WHEN @coKhaiKieu = 0 THEN N'L3 lệnh chưa khai Kiểu → tính'
         /* B: cả BẢN GHI là lần cắt phối — mọi cây đều có dòng Phối, và có cây không có dòng Chính */
         WHEN NOT EXISTS (SELECT 1 FROM TienDoCatChiTietCay cb WHERE cb.TienDoID = cc.TienDoID
                          AND NOT EXISTS (SELECT 1 FROM PhieuXuatVaiChiTiet pxb JOIN PhieuXuatVai pb ON pb.PhieuXuatID = pxb.PhieuXuatID
                                          WHERE pxb.CayID = cb.CayID AND pb.DonHangID = @dh AND pxb.KieuVai = N'Phối'))
              AND EXISTS (SELECT 1 FROM TienDoCatChiTietCay cb2 WHERE cb2.TienDoID = cc.TienDoID
                          AND NOT EXISTS (SELECT 1 FROM PhieuXuatVaiChiTiet pxc JOIN PhieuXuatVai pc ON pc.PhieuXuatID = pxc.PhieuXuatID
                                          WHERE pxc.CayID = cb2.CayID AND pc.DonHangID = @dh AND pxc.KieuVai = N'Chính'))
              THEN N'Phối (bản ghi cắt phối, luật B) → KHÔNG tính'
         WHEN EXISTS (SELECT 1 FROM PhieuXuatVaiChiTiet px JOIN PhieuXuatVai p ON p.PhieuXuatID = px.PhieuXuatID
                      WHERE px.CayID = cc.CayID AND p.DonHangID = @dh AND px.KieuVai = N'Chính') THEN N'L1 Chính → tính'
         WHEN NOT EXISTS (SELECT 1 FROM PhieuXuatVaiChiTiet px2 JOIN PhieuXuatVai p2 ON p2.PhieuXuatID = px2.PhieuXuatID
                          WHERE px2.CayID = cc.CayID AND p2.DonHangID = @dh) THEN N'L2 không có phiếu xuất → tính (⚠️ chưa rõ kiểu)'
         ELSE N'Phối → KHÔNG tính'
       END AS LuatCayChinh
INTO #cay
FROM TienDoSanXuat t
JOIN TienDoCatChiTietCay cc ON cc.TienDoID = t.TienDoID
JOIN VaiCay vc ON vc.CayID = cc.CayID
JOIN DanhMucVai dv ON dv.VaiID = vc.VaiID
LEFT JOIN LoaiVai lv ON lv.LoaiVaiID = dv.LoaiVaiID
LEFT JOIN MauSac ms ON ms.MauSacID = dv.MauSacID
LEFT JOIN #kieuSD k ON k.SoDoID = t.SoDoID
WHERE t.DonHangID = @dh AND t.StageID = @cat;

/* ============ BẢNG 1 — TỔNG THEO MÀU: hệ thống đang cộng ra bao nhiêu, từ đâu ============
   SL_HeThong   = đúng con số form đang hiện ở cột "Cắt" (cây hiệu lực + cây chính)
   Trong đó: ChiCayL1 = phần chắc chắn là vải thân; CayL2_ChuaRo = cây không có phiếu xuất (⚠️);
             CayL3 = phần chỉ được cộng vì lệnh chưa khai Kiểu (⚠️⚠️)
   BiLoai_Phoi  = số cái của cây phối đã bị loại (đúng)
   BiLoai_BanCu = số cái nằm ở bản ghi Cắt KHÔNG hiệu lực (đã bị thay bởi bản mới cùng sơ đồ) */
SELECT TenMau, MauSacID,
       SUM(CASE WHEN HieuLuc = 1 AND LuatCayChinh NOT LIKE N'Phối%' THEN Cai ELSE 0 END) AS SL_HeThong,
       SUM(CASE WHEN HieuLuc = 1 AND LuatCayChinh LIKE 'L0%' THEN Cai ELSE 0 END) AS SoDoKhaiChinh,
       SUM(CASE WHEN HieuLuc = 1 AND LuatCayChinh LIKE 'L1%' THEN Cai ELSE 0 END) AS ChiCayL1,
       SUM(CASE WHEN HieuLuc = 1 AND LuatCayChinh LIKE 'L2%' THEN Cai ELSE 0 END) AS CayL2_ChuaRo,
       SUM(CASE WHEN HieuLuc = 1 AND LuatCayChinh LIKE 'L3%' THEN Cai ELSE 0 END) AS CayL3_ChuaLocPhoi,
       SUM(CASE WHEN HieuLuc = 1 AND LuatCayChinh LIKE N'Phối%' THEN Cai ELSE 0 END) AS BiLoai_Phoi,
       SUM(CASE WHEN HieuLuc = 0 THEN Cai ELSE 0 END) AS BiLoai_BanCu,
       COUNT(DISTINCT CASE WHEN HieuLuc = 1 THEN TienDoID END) AS SoBanGhiCatHieuLuc,
       SUM(CASE WHEN HieuLuc = 1 AND LuatCayChinh NOT LIKE N'Phối%' THEN SoLuongLop ELSE 0 END) AS TongLop_HeThong,
       SUM(CASE WHEN HieuLuc = 1 AND LuatCayChinh NOT LIKE N'Phối%' THEN GiatCap ELSE 0 END) AS TongGiatCap
FROM #cay
GROUP BY TenMau, MauSacID
ORDER BY TenMau;

/* ============ BẢNG 2 — CHẨN ĐOÁN TỰ ĐỘNG: nguyên nhân khả dĩ cho từng màu ============ */
SELECT TenMau,
       CASE WHEN COUNT(DISTINCT CASE WHEN HieuLuc = 1 AND SoDoID IS NULL THEN TienDoID END) > 1
            THEN N'🔴 Sổ cắt ghi ' + CAST(COUNT(DISTINCT CASE WHEN HieuLuc = 1 AND SoDoID IS NULL THEN TienDoID END) AS NVARCHAR)
                 + N' lần KHÔNG gắn sơ đồ → CỘNG CẢ các lần. Xem Bảng 3, xóa bản thừa ở form Sửa sổ cắt.'
            ELSE N'' END AS NguyenNhan_1_GhiTrung,
       CASE WHEN SUM(CASE WHEN HieuLuc = 1 AND LuatCayChinh LIKE 'L3%' THEN 1 ELSE 0 END) > 0
            THEN N'🔴 Lệnh CHƯA khai Kiểu trên phiếu xuất vải → cây phối cùng màu (nếu có) đang bị cộng. Khai Kiểu ở Kho vải > Phiếu xuất.'
            WHEN SUM(CASE WHEN HieuLuc = 1 AND LuatCayChinh LIKE 'L2%' THEN 1 ELSE 0 END) > 0
            THEN N'🟠 Có ' + CAST(SUM(CASE WHEN HieuLuc = 1 AND LuatCayChinh LIKE 'L2%' THEN 1 ELSE 0 END) AS NVARCHAR)
                 + N' cây không có phiếu xuất của lệnh (cấp tay?) → vẫn cộng, chưa rõ chính/phối. Xem Bảng 4.'
            ELSE N'' END AS NguyenNhan_2_PhoiLotVao,
       CASE WHEN SUM(CASE WHEN HieuLuc = 1 AND LuatCayChinh NOT LIKE N'Phối%' THEN GiatCap ELSE 0 END) > 0
            THEN N'🟡 Có ' + CAST(SUM(CASE WHEN HieuLuc = 1 AND LuatCayChinh NOT LIKE N'Phối%' THEN GiatCap ELSE 0 END) AS NVARCHAR)
                 + N' cái giật cấp được cộng thêm — sổ giấy có tính phần này không?'
            ELSE N'' END AS NguyenNhan_3_GiatCap,
       CASE WHEN MIN(CASE WHEN HieuLuc = 1 AND LuatCayChinh NOT LIKE N'Phối%' THEN HeSoQuyDoi END)
              <> MAX(CASE WHEN HieuLuc = 1 AND LuatCayChinh NOT LIKE N'Phối%' THEN HeSoQuyDoi END)
            THEN N'🟡 Các cây dùng hệ số KHÁC NHAU ('
                 + CAST(MIN(CASE WHEN HieuLuc = 1 THEN HeSoQuyDoi END) AS NVARCHAR) + N'–'
                 + CAST(MAX(CASE WHEN HieuLuc = 1 THEN HeSoQuyDoi END) AS NVARCHAR) + N') — có cây gõ nhầm hệ số?'
            ELSE N'' END AS NguyenNhan_4_HeSoLech,
       CASE WHEN COUNT(DISTINCT CASE WHEN HieuLuc = 1 THEN TenLoaiVai END) > 1
            THEN N'🟠 Màu này có ' + CAST(COUNT(DISTINCT CASE WHEN HieuLuc = 1 THEN TenLoaiVai END) AS NVARCHAR)
                 + N' loại vải khác nhau cùng MauSacID (thân + bo?) — nhìn cột MaVai/TenLoaiVai ở Bảng 4.'
            ELSE N'' END AS NguyenNhan_5_NhieuLoaiVaiCungMau
FROM #cay
GROUP BY TenMau
ORDER BY TenMau;

/* ============ BẢNG 3 — TỪNG BẢN GHI CẮT của lệnh ============
   Nhiều dòng HieuLuc = 1 với SoDoID NULL = ghi trùng. */
SELECT TienDoID, NgayGhiNhan, SoDoID, HieuLuc,
       COUNT(*) AS SoCay, SUM(SoLuongLop) AS TongLop, SUM(Cai) AS TongCai,
       STUFF((SELECT DISTINCT ', ' + c2.TenMau FROM #cay c2 WHERE c2.TienDoID = c.TienDoID
              FOR XML PATH(''), TYPE).value('.', 'NVARCHAR(MAX)'), 1, 2, '') AS CacMau
FROM #cay c
GROUP BY TienDoID, NgayGhiNhan, SoDoID, HieuLuc
ORDER BY TienDoID;

/* ============ BẢNG 4 — TỪNG CÂY (bằng chứng) ============
   Đọc cột LuatCayChinh + KieuTrenPhieuXuat để biết vì sao cây đó được / không được cộng. */
SELECT TenMau, TienDoID, HieuLuc, CayID, MaCay, MaVai, TenLoaiVai,
       SoLuongLop, HeSoQuyDoi, GiatCap, Cai,
       KieuTrenPhieuXuat, LuatCayChinh
FROM #cay
ORDER BY TenMau, TienDoID, CayID;

DROP TABLE #cay;
DROP TABLE #kieuSD;
GO
