/* ================================================================
   migration_v658.sql  (QLNoiBo v5.65)

   MỤC ĐÍCH: Thẻ kho hàng hóa sắp xếp theo YÊU CẦU MỚI
     - Mã hàng HẾT HÀNG (tồn <= 0) tụt xuống DƯỚI CÙNG.
     - Mã hàng vừa tạo / vừa lưu gần nhất nằm TRÊN CÙNG.

   Để biết "lần lưu cuối cùng" thì bảng TheKhoHangHoa cần cột UpdatedAt
   (trước đây chỉ có CreatedAt). Bản này:
     1. Thêm cột UpdatedAt DATETIME2 NULL (nếu chưa có).
     2. Điền UpdatedAt = CreatedAt cho toàn bộ dòng cũ (để thứ tự ban đầu
        vẫn hợp lý: hàng tạo sau nằm trên).
   Từ v5.65 backend tự cập nhật UpdatedAt mỗi lần bấm Lưu ở form Sửa thẻ kho.

   AN TOÀN: chỉ THÊM cột, KHÔNG sửa/xóa dữ liệu. Chạy nhiều lần vô hại.
   Nếu CHƯA chạy file này, phần mềm vẫn chạy bình thường (backend tự dò cột,
   thiếu thì xếp theo ngày tạo) — nhưng thứ tự sẽ không đổi khi Sửa thẻ kho.
   ================================================================ */
USE QLNoiBo;
GO

-- Chặn chạy nhầm database (SSMS hay mở New Query ở master).
IF DB_NAME() <> 'QLNoiBo'
BEGIN
    PRINT '*** SAI DATABASE: dang o [' + DB_NAME() + ']. Hay chon QLNoiBo roi chay lai. ***';
    SET NOEXEC ON;
END
GO

IF OBJECT_ID('dbo.TheKhoHangHoa', 'U') IS NULL
    PRINT '!! Khong tim thay bang TheKhoHangHoa - bo qua.';
ELSE IF COL_LENGTH('dbo.TheKhoHangHoa', 'UpdatedAt') IS NULL
BEGIN
    ALTER TABLE dbo.TheKhoHangHoa ADD UpdatedAt DATETIME2 NULL;
    PRINT '   + TheKhoHangHoa.UpdatedAt da them.';
END
ELSE
    PRINT '   = TheKhoHangHoa.UpdatedAt da co tu truoc.';
GO

-- Dòng cũ chưa có UpdatedAt -> lấy theo CreatedAt.
IF COL_LENGTH('dbo.TheKhoHangHoa', 'UpdatedAt') IS NOT NULL
BEGIN
    UPDATE dbo.TheKhoHangHoa SET UpdatedAt = CreatedAt WHERE UpdatedAt IS NULL;
    PRINT '   + Da dien UpdatedAt = CreatedAt cho cac dong cu.';
END
GO

PRINT '';
PRINT '=== migration_v658.sql HOAN TAT ===';
SELECT COL_LENGTH('dbo.TheKhoHangHoa', 'UpdatedAt') AS UpdatedAt_DoDai,
       (SELECT COUNT(*) FROM dbo.TheKhoHangHoa WHERE UpdatedAt IS NULL) AS SoDongConThieu;
GO

SET NOEXEC OFF;
GO
