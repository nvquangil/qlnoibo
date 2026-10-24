/* ================================================================================================
   migration_v881.sql   (v8.94)  —  ẢNH CHO DANH MỤC MÀU SẮC
   ------------------------------------------------------------------------------------------------
   Nguyen 2026-10-21: "danh mục màu sắc thêm trường tải ảnh lên. khi xuất kho cũng thể hiện thêm cột
   hình ảnh, thẻ kho vải cũng thêm cột hình ảnh"

   Cột mới:  MauSac.AnhMau NVARCHAR(500) NULL  — đường dẫn ảnh dạng /uploads/<file>, cùng cơ chế với
   AnhSanPham / AnhCay / DonHangChiTietVai.AnhMau (upload qua /api/upload, thu nhỏ qua /anh/<cạnh>/).
   NULL = chưa có ảnh, mọi màn hiện ô trống. Không backfill.

   ⚠️ /uploads/ là thư mục CÔNG KHAI (catalogue dùng) — ảnh màu vải không nhạy cảm, để đó được.

   Chạy: SSMS trên database QLNoiBo. Có guard. Sau đó pm2 restart + Ctrl+F5.
   ================================================================================================ */
USE QLNoiBo;
GO
PRINT '=== migration_v881: MauSac.AnhMau ===';
GO
IF COL_LENGTH('MauSac', 'AnhMau') IS NULL
BEGIN
    ALTER TABLE MauSac ADD AnhMau NVARCHAR(500) NULL;
    PRINT '  + Cot MauSac.AnhMau';
END
ELSE PRINT '  = Cot MauSac.AnhMau da co';
GO
