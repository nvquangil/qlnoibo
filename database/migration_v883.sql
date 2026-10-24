/* ================================================================================================
   migration_v883.sql   (v8.96)  —  ẢNH TỪNG CÂY VẢI  (VaiCay.AnhCay)
   ------------------------------------------------------------------------------------------------
   Nguyen 2026-10-22: "tồn kho cây vải bổ sung hình ảnh cây vải vào mã cây có sẵn. phiếu nhập kho vải
   thêm cột tải ảnh lên thay vì ảnh ở danh mục màu sắc. cột ảnh ở tồn cây và phiếu xuất lấy theo ảnh
   ở phiếu nhập"

   Ảnh gắn với CÂY (mỗi cây một ảnh, chụp lúc nhập kho hoặc bổ sung ở Tồn theo cây), không phải với
   màu. MauSac.AnhMau (v8.94) GIỮ làm ảnh lùi: cây chưa có ảnh riêng thì hiện ảnh màu; cây có ảnh thì
   ảnh cây thắng. Tab "Tồn kho vải" (theo mã) không có cây để gắn nên vẫn hiện ảnh màu.

   Cột mới: VaiCay.AnhCay NVARCHAR(500) NULL — đường dẫn /uploads/<file>. Không backfill.
   Chạy: SSMS trên database QLNoiBo. Có guard. Sau đó pm2 restart + Ctrl+F5.
   ================================================================================================ */
USE QLNoiBo;
GO
PRINT '=== migration_v883: VaiCay.AnhCay ===';
GO
IF COL_LENGTH('VaiCay', 'AnhCay') IS NULL
BEGIN
    ALTER TABLE VaiCay ADD AnhCay NVARCHAR(500) NULL;
    PRINT '  + Cot VaiCay.AnhCay';
END
ELSE PRINT '  = Cot VaiCay.AnhCay da co';
GO
