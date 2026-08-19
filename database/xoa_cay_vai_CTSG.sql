/* ================================================================
   XÓA CÂY VẢI TỒN KHO — Loại vải "Cotton sài gòn" (MaLoai = 'CTSG')
   ----------------------------------------------------------------
   ⚠ SAO LƯU (BACKUP) DATABASE TRƯỚC KHI CHẠY. Không thể hoàn tác sau khi COMMIT.
   ⚠ Chạy TỪNG BƯỚC. Đọc kết quả BƯỚC 1 trước rồi mới chọn BƯỚC 2A hoặc 2B.

   Cây vải (VaiCay) đang bị các bảng sau tham chiếu (khóa ngoại, KHÔNG cascade):
     - PhieuXuatVaiChiTiet   (xuất kho vải)
     - GiaoVaiSanXuat        (giao vải cho sản xuất)
     - TienDoCatChiTietCay   (đã dùng để cắt / cập nhật sơ đồ)
     - KiemKeVai             (kiểm kê)
     - PhieuXuatVatTuVai     (bảng cũ v5.28 — thường đã bỏ ở v5.29; script có phòng thủ)
   => KHÔNG xóa được cây đã phát sinh giao dịch nếu chưa xóa các dòng tham chiếu.

   Điều kiện lọc: VaiCay -> DanhMucVai(VaiID) -> LoaiVai(LoaiVaiID) WHERE MaLoai = 'CTSG'.
   (Chỉ xóa CÂY VẢI; KHÔNG xóa danh mục vải/loại vải "Cotton sài gòn".)
   ================================================================ */
USE QLNoiBo;
GO

/* ===========================================================================
   BƯỚC 1 — XEM TRƯỚC (không xóa gì). Kiểm tra đúng loại + cây nào đã có giao dịch.
   =========================================================================== */
SELECT
    c.CayID, c.MaCay, lv.TenLoaiVai, lv.MaLoai, v.MaVai, ms.TenMau,
    c.KGNhap, c.TrangThai, c.NgayNhap,
    (SELECT COUNT(*) FROM PhieuXuatVaiChiTiet x  WHERE x.CayID  = c.CayID) AS SoLanXuat,
    (SELECT COUNT(*) FROM GiaoVaiSanXuat       g WHERE g.CayID  = c.CayID) AS SoLanGiaoSX,
    (SELECT COUNT(*) FROM TienDoCatChiTietCay tc WHERE tc.CayID = c.CayID) AS SoLanCat,
    (SELECT COUNT(*) FROM KiemKeVai            k WHERE k.CayID  = c.CayID) AS SoLanKiemKe
FROM VaiCay c
JOIN DanhMucVai v ON v.VaiID = c.VaiID
JOIN LoaiVai   lv ON lv.LoaiVaiID = v.LoaiVaiID
LEFT JOIN MauSac ms ON ms.MauSacID = v.MauSacID
WHERE LTRIM(RTRIM(lv.MaLoai)) = 'CTSG'          -- hoặc: lv.TenLoaiVai = N'Cotton sài gòn'
ORDER BY c.MaCay;
GO

/* ===========================================================================
   BƯỚC 2A — XÓA AN TOÀN (KHUYẾN NGHỊ)
   Chỉ xóa các cây CHƯA phát sinh bất kỳ giao dịch nào (xuất/giao SX/cắt/kiểm kê).
   Giữ nguyên mọi lịch sử. Cây đã dùng sẽ KHÔNG bị xóa (và sẽ hiện lại ở BƯỚC 1).
   =========================================================================== */
BEGIN TRAN;

    SELECT c.CayID
    INTO #cay_ctsg
    FROM VaiCay c
    JOIN DanhMucVai v ON v.VaiID = c.VaiID
    JOIN LoaiVai   lv ON lv.LoaiVaiID = v.LoaiVaiID
    WHERE LTRIM(RTRIM(lv.MaLoai)) = 'CTSG';

    -- Loại khỏi danh sách xóa những cây ĐÃ có giao dịch (để không vỡ khóa ngoại / mất lịch sử)
    DELETE FROM #cay_ctsg WHERE CayID IN (SELECT CayID FROM PhieuXuatVaiChiTiet);
    DELETE FROM #cay_ctsg WHERE CayID IN (SELECT CayID FROM GiaoVaiSanXuat);
    DELETE FROM #cay_ctsg WHERE CayID IN (SELECT CayID FROM TienDoCatChiTietCay);
    DELETE FROM #cay_ctsg WHERE CayID IN (SELECT CayID FROM KiemKeVai);
    IF OBJECT_ID('dbo.PhieuXuatVatTuVai', 'U') IS NOT NULL
        DELETE FROM #cay_ctsg WHERE CayID IN (SELECT CayID FROM PhieuXuatVatTuVai);

    DELETE FROM VaiCay WHERE CayID IN (SELECT CayID FROM #cay_ctsg);
    PRINT N'Đã xóa (an toàn) ' + CAST(@@ROWCOUNT AS NVARCHAR(10)) + N' cây vải CTSG chưa phát sinh giao dịch.';

    DROP TABLE #cay_ctsg;

-- KIỂM TRA lại BƯỚC 1 trong cùng cửa sổ, rồi bỏ chú thích 1 trong 2 dòng dưới:
-- COMMIT;      -- ✅ XÁC NHẬN xóa thật
-- ROLLBACK;    -- ↩️ HỦY, không xóa gì
GO

/* ===========================================================================
   BƯỚC 2B — (TÙY CHỌN, NGUY HIỂM) XÓA SẠCH mọi cây CTSG + TOÀN BỘ lịch sử liên quan
   Chỉ dùng khi đây là dữ liệu NHẬP NHẦM / TEST và chấp nhận MẤT lịch sử
   xuất kho / giao SX / cắt / kiểm kê của các cây này. Bỏ /* */ để chạy.
   =========================================================================== */
/*
BEGIN TRAN;

    SELECT c.CayID
    INTO #cay_ctsg_all
    FROM VaiCay c
    JOIN DanhMucVai v ON v.VaiID = c.VaiID
    JOIN LoaiVai   lv ON lv.LoaiVaiID = v.LoaiVaiID
    WHERE LTRIM(RTRIM(lv.MaLoai)) = 'CTSG';

    IF OBJECT_ID('dbo.PhieuXuatVatTuVai', 'U') IS NOT NULL
        DELETE FROM PhieuXuatVatTuVai WHERE CayID IN (SELECT CayID FROM #cay_ctsg_all);
    DELETE FROM PhieuXuatVaiChiTiet  WHERE CayID IN (SELECT CayID FROM #cay_ctsg_all);
    DELETE FROM GiaoVaiSanXuat       WHERE CayID IN (SELECT CayID FROM #cay_ctsg_all);
    DELETE FROM TienDoCatChiTietCay  WHERE CayID IN (SELECT CayID FROM #cay_ctsg_all);
    DELETE FROM KiemKeVai            WHERE CayID IN (SELECT CayID FROM #cay_ctsg_all);
    DELETE FROM VaiCay               WHERE CayID IN (SELECT CayID FROM #cay_ctsg_all);
    PRINT N'Đã xóa SẠCH ' + CAST(@@ROWCOUNT AS NVARCHAR(10)) + N' cây vải CTSG + lịch sử liên quan.';

    DROP TABLE #cay_ctsg_all;

-- COMMIT;      -- ✅ XÁC NHẬN
-- ROLLBACK;    -- ↩️ HỦY
GO
*/
