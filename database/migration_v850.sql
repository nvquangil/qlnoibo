/* ================================================================================================
   migration_v850.sql — SỬA GỐC LỖI "VẪN CHUYỂN SANG CÔNG ĐOẠN NHẶT CHỈ"

   NGUYÊN NHÂN THẬT (Nguyen xác nhận bằng dữ liệu thật 2026-09-26):
     Dòng "Nhặt chỉ" trong CongDoanSanXuat có MaCongDoan = 'nhatchi', KHÔNG phải 'NCH'.
     Toàn bộ code (backend `MA_CONG_DOAN_BO_QUA`, frontend bộ lọc ô chọn Công đoạn) so chuỗi CHÍNH
     XÁC với 'NCH' nên không bao giờ khớp. Tức là v8.30 và v8.33 **chưa bao giờ có tác dụng** với
     công đoạn này — không phải lỗi deploy (đã kiểm tra D:\QLSX có đúng dòng code mới).

   FILE NÀY LÀM 2 VIỆC, THEO ĐÚNG THỨ TỰ:
     BƯỚC 1 (chỉ đọc)  — xem toàn bộ bảng công đoạn, để biết còn mã nào khác cũng lệch chuẩn.
     BƯỚC 2 (sửa)      — đổi MaCongDoan của dòng "Nhặt chỉ" thành 'NCH'.
     BƯỚC 3 (sửa)      — dời các lệnh SX đang kẹt ở Nhặt chỉ sang công đoạn kế tiếp thật (QC).

   ⚠️ BƯỚC 2 VÀ 3 SỬA DỮ LIỆU, KHÔNG HOÀN LẠI ĐƯỢC. Trước khi chạy:
     1. BACKUP DATABASE (SSMS -> chuột phải QLNoiBo -> Tasks -> Back Up...). Bắt buộc.
     2. Chạy BƯỚC 1 trước, gửi kết quả để đối chiếu. Đồng ý rồi mới chạy BƯỚC 2 và 3.

   VÌ SAO SỬA DỮ LIỆU CHỨ KHÔNG CHỈ SỬA CODE:
     `MaCongDoan` là MÃ ỔN ĐỊNH mà hàng chục chỗ trong hệ thống đang dựa vào ('CAT', 'MAY', 'KN',
     'DG', 'QC', 'GC'...). Một dòng lệch chuẩn là một quả mìn: mọi tính năng sau này gắn vào mã đó
     sẽ im lặng không chạy. Code ở v8.50 đã được vá thêm lớp so theo TÊN để không tái diễn, nhưng
     đó là lưới an toàn — khôi phục đúng mã mới là sửa gốc.

   KHÔNG đụng tới: TienDoSanXuat (lịch sử tham chiếu StageID, không phải MaCongDoan — đổi mã KHÔNG
   ảnh hưởng), dòng CongDoanSanXuat (không xóa), PhanTramHoanThanh (tính lại ở lần ghi tiến độ sau).

   KHÔNG áp dụng cho 'LA' (Là). Công đoạn Là cũng bị bỏ khỏi luồng ở v8.33 và RẤT CÓ THỂ dính đúng
   lỗi mã lệch này — BƯỚC 1 sẽ cho thấy. Nguyen mới chỉ yêu cầu Nhặt chỉ; muốn làm nốt thì nói.

   Chạy bằng SSMS trên database QLNoiBo. Idempotent: chạy lại lần 2 không đổi gì thêm.
   ================================================================================================ */

USE QLNoiBo;
GO

/* ------------------------------------------------------------------------------------------------
   BƯỚC 1 — XEM TRƯỚC (chỉ đọc). CHẠY RIÊNG BƯỚC NÀY TRƯỚC, GỬI KẾT QUẢ.

   Cột `LechChuan` đánh dấu những dòng có mã KHÔNG nằm trong bộ mã chuẩn mà code đang dùng.
   Mỗi dòng bị đánh dấu là một chỗ có thể đang hỏng âm thầm y như Nhặt chỉ.
   ------------------------------------------------------------------------------------------------ */
SELECT StageID, ThuTu,
       '[' + ISNULL(MaCongDoan, N'<NULL>') + ']' AS MaCongDoan_TrongNgoac,
       LEN(ISNULL(MaCongDoan, N''))              AS DoDaiMa,
       TenCongDoan, LaHeThong,
       CASE WHEN UPPER(LTRIM(RTRIM(ISNULL(MaCongDoan, N'')))) IN
              (N'CAT', N'MAY', N'QC', N'DG', N'KN', N'GC', N'NGC', N'GIT', N'NIT',
               N'KT', N'TLKT', N'CDV', N'XV', N'CPK', N'XPK',
               N'GV', N'PK', N'HT', N'NCH', N'LA', N'GNGC', N'NNGC', N'GNIT', N'NNIT')
            THEN N'' ELSE N'<<< LỆCH CHUẨN' END  AS LechChuan
FROM CongDoanSanXuat
ORDER BY ThuTu;

/* Các lệnh SX đang kẹt ở Nhặt chỉ (BƯỚC 3 sẽ dời chúng đi). Ra 0 dòng = không có lệnh nào kẹt.

   Cột `CacCongDoanDaGhiTienDo` là BẰNG CHỨNG để quyết đích đến, không phải phỏng đoán:
     - đã có "Kho nhập" hoặc "Đóng gói" trong danh sách  -> lệnh THỰC SỰ đã đi tới đó, dời sang
       Kho nhập là đúng;
     - mới chỉ có tới "May"                              -> lệnh thật sự mới ở giữa, dời thẳng sang
       Kho nhập là NHẢY CÓC, bỏ qua QC/Đóng gói mà không ai ghi nhận.
   Xem cột này rồi hẵng chạy BƯỚC 3. Nếu hai nhóm trên cùng tồn tại thì đừng chạy BƯỚC 3 hàng loạt —
   báo lại, sẽ tách làm hai lệnh riêng. */
SELECT d.MaDH, d.TenSanPham, d.TrangThai, d.PhanTramHoanThanh,
       STUFF((SELECT N', ' + c2.TenCongDoan
              FROM CongDoanSanXuat c2
              WHERE EXISTS (SELECT 1 FROM TienDoSanXuat td
                            WHERE td.DonHangID = d.DonHangID AND td.StageID = c2.StageID)
              ORDER BY c2.ThuTu
              FOR XML PATH('')), 1, 2, '') AS CacCongDoanDaGhiTienDo
FROM DonHangSanXuat d
JOIN CongDoanSanXuat cd ON cd.StageID = d.CongDoanHienTaiID
WHERE LOWER(LTRIM(RTRIM(ISNULL(cd.TenCongDoan, N'')))) = N'nhặt chỉ'
ORDER BY d.MaDH;
GO

/* ------------------------------------------------------------------------------------------------
   BƯỚC 2 — CHUẨN HÓA MÃ CÔNG ĐOẠN. Chỉ chạy sau khi đã xem BƯỚC 1 và đã backup.

   Tìm theo TÊN (vì mã đang sai, không thể tìm theo mã). Chỉ đổi khi mã hiện tại KHÁC 'NCH' —
   chạy lại lần 2 sẽ không làm gì.
   ------------------------------------------------------------------------------------------------ */
BEGIN TRANSACTION;

UPDATE CongDoanSanXuat
SET MaCongDoan = N'NCH'
WHERE LOWER(LTRIM(RTRIM(ISNULL(TenCongDoan, N'')))) = N'nhặt chỉ'
  AND UPPER(LTRIM(RTRIM(ISNULL(MaCongDoan, N'')))) <> N'NCH';

PRINT N'BUOC 2 - so dong cong doan da chuan hoa ma: ' + CAST(@@ROWCOUNT AS NVARCHAR(10));

/* Kiểm tra ngay: phải thấy đúng 1 dòng Nhặt chỉ với mã NCH. */
SELECT StageID, ThuTu, MaCongDoan, TenCongDoan
FROM CongDoanSanXuat
WHERE UPPER(LTRIM(RTRIM(ISNULL(MaCongDoan, N'')))) = N'NCH';

COMMIT TRANSACTION;
-- ROLLBACK TRANSACTION;   -- dùng dòng này thay COMMIT nếu kết quả kiểm tra không như mong đợi
GO

/* ------------------------------------------------------------------------------------------------
   BƯỚC 3 — DỜI CÁC LỆNH ĐANG KẸT Ở NHẶT CHỈ SANG **KHO NHẬP**.

   ⚠️ ĐÍCH ĐẾN LÀ KHO NHẬP, KHÔNG PHẢI QC.
   Bản đầu của file này dời sang QC (công đoạn kế tiếp ngay sau Nhặt chỉ theo ThuTu) — SAI.
   Nguyen xác nhận 2026-09-26: các lệnh đang kẹt đó **thực tế đang ở Kho nhập**, con trỏ chỉ chưa
   theo kịp vì Nhặt chỉ nằm chắn giữa đường suốt thời gian lỗi mã `nhatchi` chưa được phát hiện.
   Dời sang QC là đẩy chúng lùi lại hai bước so với thực tế.

   ⚠️ ĐÂY LÀ LỜI KHAI CỦA NGƯỜI DÙNG, KHÔNG PHẢI DỮ LIỆU TỰ CHỨNG MINH.
   Chạy BƯỚC 1 và nhìn cột `CacCongDoanDaGhiTienDo` TRƯỚC:
     - lệnh nào đã có tiến độ ở Đóng gói / Kho nhập  -> đúng, dời sang Kho nhập là khớp thực tế;
     - lệnh nào mới có tiến độ tới May               -> KHÔNG thuộc diện này, dời sang Kho nhập là
       nhảy cóc qua QC và Đóng gói. Báo lại để tách thành 2 lệnh UPDATE riêng.

   Chạy SAU BƯỚC 2 (lúc này mã đã là 'NCH' nên tìm theo mã được).
   Lệnh đã "Hoàn thành"/"Đã hủy" KHÔNG đụng tới: con trỏ của chúng không còn dẫn đường đi nữa.
   Con trỏ dời tới đâu thì % hoàn thành cũng phải đi theo, nếu không danh sách hiện "Kho nhập" mà
   % vẫn đứng ở mức của Nhặt chỉ — hai con số cùng một dòng nói hai chuyện khác nhau.
   ------------------------------------------------------------------------------------------------ */
BEGIN TRANSACTION;

/* Đổi ĐÚNG MỘT DÒNG NÀY nếu muốn đích đến khác (vd N'QC'). Mọi chỗ dưới đều dùng lại biến này. */
DECLARE @MaDichDen NVARCHAR(20) = N'KN';

DECLARE @StageDichDen INT, @ThuTuDichDen INT, @TongSoCongDoan INT, @ViTri INT, @Percent INT;
SELECT @StageDichDen = StageID, @ThuTuDichDen = ThuTu
FROM CongDoanSanXuat
WHERE UPPER(LTRIM(RTRIM(ISNULL(MaCongDoan, N'')))) = @MaDichDen;
SELECT @TongSoCongDoan = COUNT(*) FROM CongDoanSanXuat;
SELECT @ViTri = COUNT(*) FROM CongDoanSanXuat WHERE ThuTu <= @ThuTuDichDen;
/* Tính SẴN ra biến, KHÔNG nhét subquery vào giữa biểu thức trong câu UPDATE — vừa dễ đọc,
   vừa tránh hẳn họ hàng của lỗi "subquery trong hàm tổng hợp" (SQL Server Msg 130). */
SET @Percent = CASE WHEN @TongSoCongDoan > 0
                    THEN CAST(ROUND(100.0 * @ViTri / @TongSoCongDoan, 0) AS INT) END;

IF @StageDichDen IS NULL
BEGIN
  /* Không tìm thấy công đoạn đích -> DỪNG, không sửa gì. Mã Kho nhập cũng có thể lệch chuẩn
     y như 'nhatchi' — BƯỚC 1 cho biết. */
  PRINT N'DUNG: khong tim thay cong doan co ma ' + @MaDichDen + N'. Xem lai ket qua BUOC 1.';
  ROLLBACK TRANSACTION;
END
ELSE
BEGIN
  UPDATE d
  SET d.CongDoanHienTaiID = @StageDichDen,
      /* % tính theo đúng công thức của backend: (vị trí công đoạn / tổng số công đoạn) × 100.
         Xem `finalPercent` trong POST /orders/:maDH/tiendo — giữ khớp để không lệch cách tính. */
      d.PhanTramHoanThanh = ISNULL(@Percent, d.PhanTramHoanThanh),
      d.TrangThai = N'Đang sản xuất',
      d.UpdatedAt = SYSDATETIME()
  FROM DonHangSanXuat d
  JOIN CongDoanSanXuat cd ON cd.StageID = d.CongDoanHienTaiID
                         AND UPPER(LTRIM(RTRIM(ISNULL(cd.MaCongDoan, N'')))) = N'NCH'
  WHERE d.TrangThai NOT IN (N'Hoàn thành', N'Đã hủy');

  PRINT N'BUOC 3 - so lenh SX da doi tu Nhat chi sang ' + @MaDichDen + N': '
        + CAST(@@ROWCOUNT AS NVARCHAR(10));

  /* Kiểm tra lại NGAY trong transaction: phải ra 0. Khác 0 thì ROLLBACK và báo lại. */
  SELECT COUNT(*) AS ConLaiODungNhatChi
  FROM DonHangSanXuat d
  JOIN CongDoanSanXuat cd ON cd.StageID = d.CongDoanHienTaiID
                         AND UPPER(LTRIM(RTRIM(ISNULL(cd.MaCongDoan, N'')))) = N'NCH'
  WHERE d.TrangThai NOT IN (N'Hoàn thành', N'Đã hủy');

  COMMIT TRANSACTION;
  -- ROLLBACK TRANSACTION;   -- dùng dòng này thay COMMIT nếu số kiểm tra khác 0
END
GO
