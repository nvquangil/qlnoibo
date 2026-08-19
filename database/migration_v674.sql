/* ============================================================================
   migration_v674 — v6.43: Ra lệnh SX ghi TÊN KHÁCH HÀNG TỰ DO
   ----------------------------------------------------------------------------
   Yêu cầu: ô Khách hàng ở form Ra lệnh sản xuất cho GÕ TỰ DO, tên gõ vào
   KHÔNG được thêm vào Danh mục khách hàng — chỉ hiện ở chính lệnh đó và trên
   các bản in.

   Vì vậy thêm MỘT cột chữ riêng, tách hẳn khỏi khóa nối KhachHangID:
     - Gõ trùng tên một khách CÓ trong danh mục  -> vẫn lưu KhachHangID như cũ,
       cột chữ để trống. Công nợ / lọc theo khách không mất liên kết nào.
     - Gõ tên KHÔNG có trong danh mục            -> KhachHangID = NULL, tên nằm
       ở cột chữ này. Danh mục khách hàng không bị đẻ thêm bản ghi rác.

   Mọi câu đọc lệnh SX đổi sang lấy tên hiển thị theo thứ tự:
       tên tự do (nếu có)  ->  tên trong danh mục
   nên tất cả danh sách và bản in tự hiện đúng, không phải sửa từng nơi.

   CHẠY 1 LẦN. Chạy lại không sao (đã kiểm tra tồn tại cột).
   ============================================================================ */

SET NOCOUNT ON;

IF COL_LENGTH('DonHangSanXuat', 'TenKhachHangTuDo') IS NULL
BEGIN
    ALTER TABLE DonHangSanXuat ADD TenKhachHangTuDo NVARCHAR(200) NULL;
    PRINT N'[v674] Da them cot DonHangSanXuat.TenKhachHangTuDo.';
END
ELSE
    PRINT N'[v674] Cot DonHangSanXuat.TenKhachHangTuDo da co - bo qua.';
GO

/* --- Kiem tra nhanh sau khi chay -------------------------------------------
   So lenh dang dung ten tu do (sau khi nguoi dung bat dau go) va so lenh van
   noi voi danh muc. Chay xong lan dau thi cot tu do con trong het la dung. */
SELECT
    N'Lenh co ten khach TU DO'      AS Loai,
    COUNT(*)                        AS SoLuong
FROM DonHangSanXuat
WHERE NULLIF(LTRIM(RTRIM(TenKhachHangTuDo)), '') IS NOT NULL
UNION ALL
SELECT
    N'Lenh noi Danh muc khach hang',
    COUNT(*)
FROM DonHangSanXuat
WHERE KhachHangID IS NOT NULL
UNION ALL
SELECT
    N'Lenh CHUA co khach nao',
    COUNT(*)
FROM DonHangSanXuat
WHERE KhachHangID IS NULL
  AND NULLIF(LTRIM(RTRIM(TenKhachHangTuDo)), '') IS NULL;
GO
