/* ============================================================================
   migration_v675 — v6.54: PHIẾU THU "CHUYỂN THẲNG" (không qua quỹ)
   ----------------------------------------------------------------------------
   Nghiệp vụ: khách trả tiền nhưng chuyển THẲNG cho nhà cung cấp, hoặc trả hộ
   một khoản chi phí. Tiền không hề đi qua quỹ của mình.

   Cách ghi (đã chốt với người dùng):
     1 phiếu thu  (giảm công nợ KHÁCH)
   + 1 phiếu chi  (giảm công nợ NCC, hoặc ghi vào loại chi phí) — TỰ SINH
   Hai phiếu liên kết với nhau, cùng ngày, cùng số tiền, cùng hình thức
   'Chuyển thẳng'. Sổ quỹ cộng phiếu thu rồi trừ phiếu chi -> SỐ DƯ KHÔNG ĐỔI,
   mà vẫn có đủ chứng từ hai đầu để đối chiếu.

   Vì sao KHÔNG chọn cách "1 phiếu thu, đánh dấu không qua quỹ":
   công nợ NCC đang tính từ phiếu chi (routes/congno.js: congNoNCC). Nếu khoản
   này chỉ nằm ở phiếu thu thì phải sửa thêm ở mọi chỗ đọc công nợ NCC, sổ quỹ,
   báo cáo tài chính — sót một chỗ là lệch mà không ai biết.

   CHẠY 1 LẦN. Chạy lại không sao (đã kiểm tra tồn tại cột).
   ============================================================================ */

SET NOCOUNT ON;

/* Khóa liên kết 2 chiều: từ phiếu thu tìm ra phiếu chi đi kèm và ngược lại.
   Có cả 2 chiều để khi HỦY/XÓA phiếu nào cũng tìm được phiếu kia ngay, không
   phải quét cả bảng. */
IF COL_LENGTH('PhieuThu', 'PhieuChiKemID') IS NULL
BEGIN
    ALTER TABLE PhieuThu ADD PhieuChiKemID INT NULL;
    PRINT N'[v675] Da them PhieuThu.PhieuChiKemID.';
END
ELSE PRINT N'[v675] PhieuThu.PhieuChiKemID da co - bo qua.';
GO

IF COL_LENGTH('PhieuChi', 'PhieuThuKemID') IS NULL
BEGIN
    ALTER TABLE PhieuChi ADD PhieuThuKemID INT NULL;
    PRINT N'[v675] Da them PhieuChi.PhieuThuKemID.';
END
ELSE PRINT N'[v675] PhieuChi.PhieuThuKemID da co - bo qua.';
GO

/* --- Kiem tra nhanh sau khi chay ------------------------------------------ */
SELECT N'Cap phieu thu-chi CHUYEN THANG' AS Loai, COUNT(*) AS SoLuong
FROM PhieuThu WHERE PhieuChiKemID IS NOT NULL
UNION ALL
SELECT N'Phieu chi MO COI (tro toi phieu thu khong con)', COUNT(*)
FROM PhieuChi c
WHERE c.PhieuThuKemID IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM PhieuThu t WHERE t.PhieuThuID = c.PhieuThuKemID);
GO
