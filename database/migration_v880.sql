/* ================================================================================================
   migration_v880.sql   (v8.93)  —  SƠ ĐỒ CẮT KHAI KIỂU: THÂN (Chính) HAY PHỐI
   ------------------------------------------------------------------------------------------------
   Nguyen 2026-10-19, lệnh DH2608073: sổ cắt giấy ĐEN02 30 lớp × 5 = 150, QC hiện 250.

   Nguyên nhân (tái hiện được đúng 250 bằng kiem_tra_sl_cat_theo_mau.sql):
     Cây 2DA-DEN02190926002 được XUẤT HAI LẦN cho cùng lệnh — một phiếu khai 'Chính' (cắt thân,
     sơ đồ 6251, 11 lớp) và một phiếu khai 'Phối' (cắt bo, sơ đồ 6252, 20 lớp). Luật v8.71 gắn
     Kiểu cho CÂY ("có ít nhất một dòng Chính → tính ở mọi nơi") nên 20 lớp cắt bo cũng bị cộng
     vào thành phẩm: 150 + 100 = 250. Tàn 43 cùng lệnh bị y hệt (30 thay vì 180... ngược lại).

   Thiếu một thông tin: LẦN CẮT này là thân hay phối. Nơi đặt tự nhiên nhất là SƠ ĐỒ — tổ cắt
   đã chọn sơ đồ khi ghi sổ cắt; một sơ đồ cắt thân hoặc cắt phối, không lẫn.

   Cột mới:  DonHangChiTietSoDo.Kieu  NVARCHAR(10) NULL   — N'Chính' / N'Phối' / NULL
     NULL  = chưa khai = hệ thống dùng luật cũ theo cây (mọi sơ đồ hiện có đều NULL → KHÔNG đổi
             bất kỳ con số nào đã hiện cho tới khi người dùng tự khai).
     Chính = MỌI dòng sổ cắt của sơ đồ này tính vào thành phẩm, bất kể Kiểu trên phiếu xuất.
     Phối  = KHÔNG dòng nào của sơ đồ này tính vào thành phẩm.

   Đây là cột `Kieu` THỨ TƯ trong hệ (ChiDinhVaiSX.Kieu, DonHangChiTietVai.Kieu,
   PhieuXuatVaiChiTiet.KieuVai, và nay DonHangChiTietSoDo.Kieu) — cùng hai giá trị.

   Chạy:  SSMS trên database QLNoiBo. Có guard, chạy lại vô hại. Sau đó pm2 restart + Ctrl+F5.
   KHÔNG backfill: hệ thống không thể biết sơ đồ nào là phối — người dùng khai ở Ra lệnh SX >
   Sơ đồ > Sửa. Với DH2608073: sơ đồ 6251 = Chính, 6252 = Phối.
   ================================================================================================ */
USE QLNoiBo;
GO
PRINT '=== migration_v880: DonHangChiTietSoDo.Kieu (so do cat than / phoi) ===';
GO

IF COL_LENGTH('DonHangChiTietSoDo', 'Kieu') IS NULL
BEGIN
    ALTER TABLE DonHangChiTietSoDo ADD Kieu NVARCHAR(10) NULL;
    PRINT '  + Cot DonHangChiTietSoDo.Kieu';
END
ELSE PRINT '  = Cot DonHangChiTietSoDo.Kieu da co';
GO

/* Chi nhan dung hai gia tri (hoac NULL) — cung tap voi PhieuXuatVaiChiTiet.KieuVai. */
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_DonHangChiTietSoDo_Kieu')
BEGIN
    ALTER TABLE DonHangChiTietSoDo WITH CHECK
      ADD CONSTRAINT CK_DonHangChiTietSoDo_Kieu CHECK (Kieu IS NULL OR Kieu IN (N'Chính', N'Phối'));
    PRINT '  + Rang buoc CK_DonHangChiTietSoDo_Kieu';
END
ELSE PRINT '  = Rang buoc CK_DonHangChiTietSoDo_Kieu da co';
GO

/* ---------- 2. INDEX cho luật B ----------
   Luật B (utils/cayThanhPham.js) là hai NOT EXISTS lồng nhau, tương quan theo từng dòng sổ cắt, và
   ở Danh sách lệnh SX nó chạy cho MỌI lệnh mỗi lần mở trang. Các cột nó dò (PhieuXuatVaiChiTiet.CayID,
   PhieuXuatVai.DonHangID, TienDoCatChiTietCay.TienDoID, TienDoSanXuat StageID+DonHangID) đều là khóa
   ngoại KHÔNG có index — SQL Server không tự tạo index cho FK. Không có 4 index này thì trang danh
   sách lệnh SX sẽ chậm dần theo số dòng sổ cắt lịch sử. Index chỉ đọc nhanh hơn, không đổi dữ liệu. */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PXVCT_CayID' AND object_id = OBJECT_ID('PhieuXuatVaiChiTiet'))
BEGIN
    CREATE INDEX IX_PXVCT_CayID ON PhieuXuatVaiChiTiet (CayID) INCLUDE (PhieuXuatID, KieuVai);
    PRINT '  + Index IX_PXVCT_CayID';
END ELSE PRINT '  = Index IX_PXVCT_CayID da co';
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PXV_DonHangID' AND object_id = OBJECT_ID('PhieuXuatVai'))
BEGIN
    CREATE INDEX IX_PXV_DonHangID ON PhieuXuatVai (DonHangID);
    PRINT '  + Index IX_PXV_DonHangID';
END ELSE PRINT '  = Index IX_PXV_DonHangID da co';
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_TDCCTC_TienDoID' AND object_id = OBJECT_ID('TienDoCatChiTietCay'))
BEGIN
    CREATE INDEX IX_TDCCTC_TienDoID ON TienDoCatChiTietCay (TienDoID) INCLUDE (CayID, SoLuongLop, HeSoQuyDoi);
    PRINT '  + Index IX_TDCCTC_TienDoID';
END ELSE PRINT '  = Index IX_TDCCTC_TienDoID da co';
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_TDSX_Stage_Don' AND object_id = OBJECT_ID('TienDoSanXuat'))
BEGIN
    CREATE INDEX IX_TDSX_Stage_Don ON TienDoSanXuat (StageID, DonHangID) INCLUDE (SoDoID);
    PRINT '  + Index IX_TDSX_Stage_Don';
END ELSE PRINT '  = Index IX_TDSX_Stage_Don da co';
GO

/* ---------- Đối chiếu: sơ đồ nào đang có cây bị xuất CẢ Chính lẫn Phối cho cùng lệnh ----------
   Đây là đúng dấu hiệu của DH2608073. Lệnh nào có mặt ở đây thì nên khai Kiểu cho các sơ đồ của nó. */
SELECT d.MaDH, sd.ID AS SoDoID, sd.MaRap, sd.Kieu AS KieuSoDo,
       COUNT(DISTINCT cc.CayID) AS SoCayHaiKieu
FROM DonHangChiTietSoDo sd
JOIN DonHangSanXuat d ON d.DonHangID = sd.DonHangID
JOIN TienDoSanXuat t ON t.SoDoID = sd.ID
JOIN TienDoCatChiTietCay cc ON cc.TienDoID = t.TienDoID
WHERE EXISTS (SELECT 1 FROM PhieuXuatVaiChiTiet px JOIN PhieuXuatVai p ON p.PhieuXuatID = px.PhieuXuatID
              WHERE px.CayID = cc.CayID AND p.DonHangID = d.DonHangID AND px.KieuVai = N'Chính')
  AND EXISTS (SELECT 1 FROM PhieuXuatVaiChiTiet px JOIN PhieuXuatVai p ON p.PhieuXuatID = px.PhieuXuatID
              WHERE px.CayID = cc.CayID AND p.DonHangID = d.DonHangID AND px.KieuVai = N'Phối')
GROUP BY d.MaDH, sd.ID, sd.MaRap, sd.Kieu
ORDER BY d.MaDH, sd.ID;
GO
