/* ================================================================
   import_tonkhovai.sql — Nhập tồn kho vải (cây vải) hàng loạt từ Excel
   Dùng kèm file mẫu: Mau_Import_TonKhoVai.xlsx (cột: Mã cây, Mã vải, Số kg tồn)

   CÁCH DÙNG:
   1. Điền dữ liệu vào file Excel (xóa dòng ví dụ màu vàng), lưu lại.
   2. File > Save As > "CSV UTF-8 (Comma delimited)" — đặt tên VD tonkhovai_import.csv.
      LƯU Ý: nếu máy bạn cấu hình tiếng Việt (dùng dấu PHẨY làm dấu thập phân, VD "25,5"),
      Excel sẽ tự đổi ký tự phân cách cột CSV từ dấu phẩy (,) sang dấu chấm phẩy (;) —
      nếu vậy, đổi FIELDTERMINATOR bên dưới (BƯỚC 2) từ ',' thành ';'. Mở thử file CSV bằng
      Notepad để biết chắc máy bạn đang dùng dấu gì.
   3. Copy file CSV vào ổ đĩa mà máy chủ SQL Server đọc được, sửa đường dẫn ở BƯỚC 2.
   4. Chạy TOÀN BỘ script này trong SSMS (F5). Script tự kiểm tra dữ liệu TRƯỚC, nếu có bất kỳ
      dòng nào lỗi sẽ liệt kê ra và DỪNG LẠI — KHÔNG ghi gì vào database cho tới khi sửa hết lỗi
      và chạy lại (tránh nhập một phần dữ liệu dở dang).

   QUY TẮC NHẬP:
   - Mã vải không khớp bất kỳ mã nào trong Danh mục vải (DanhMucVai.MaVai) → báo lỗi, dừng lại.
   - Mã cây CHƯA có trong hệ thống → tạo mới (gắn vào 1 "phiếu nhập" đại diện cho đợt import này).
   - Mã cây ĐÃ có trong hệ thống → cập nhật lại theo Số kg tồn mới trong file (không tạo trùng).
   ================================================================ */

USE QLNoiBo;
GO

-- ============ BƯỚC 1: bảng tạm nhận dữ liệu thô ============
-- Nhận toàn bộ 3 cột dưới dạng NVARCHAR (không ép kiểu số ngay) để tránh BULK INSERT tự làm rơi
-- dòng khi gặp định dạng số kiểu Việt Nam (dấu phẩy thập phân) — tự chuyển đổi ở Bước 3 bên dưới.
IF OBJECT_ID('tempdb..#TonKhoVaiImport') IS NOT NULL DROP TABLE #TonKhoVaiImport;
CREATE TABLE #TonKhoVaiImport (
    MaCay    NVARCHAR(50)  NULL,
    MaVai    NVARCHAR(50)  NULL,
    SoKgTon  NVARCHAR(50)  NULL
);
GO

-- ============ BƯỚC 2: đọc file CSV vào bảng tạm ============
-- SỬA đường dẫn 'D:\import\tonkhovai_import.csv' cho đúng máy của bạn trước khi chạy.
BULK INSERT #TonKhoVaiImport
FROM 'D:\import\tonkhovai_import.csv'
WITH (
    FIRSTROW = 2,             -- bỏ qua dòng tiêu đề
    FIELDTERMINATOR = ',',    -- đổi thành ';' nếu file CSV của bạn dùng dấu chấm phẩy (xem ghi chú ở trên)
    ROWTERMINATOR = '0x0a',
    CODEPAGE = '65001',       -- UTF-8, giữ đúng dấu tiếng Việt
    TABLOCK
);
GO

-- ============ BƯỚC 3 trở đi: MỘT BATCH DUY NHẤT (không GO xen giữa) ============
-- Lý do gộp 1 batch: RAISERROR + RETURN chỉ chặn được các câu lệnh CÙNG BATCH phía sau nó — nếu
-- tách GO ở giữa, các bước sau vẫn chạy dù bước kiểm tra phía trên đã báo lỗi.

-- Dọn khoảng trắng thừa (copy/paste từ Excel hay dính khoảng trắng đầu/cuối)
UPDATE #TonKhoVaiImport SET MaCay = LTRIM(RTRIM(MaCay)), MaVai = LTRIM(RTRIM(MaVai)), SoKgTon = LTRIM(RTRIM(SoKgTon));

-- Kiểm tra 1: thiếu dữ liệu (Mã cây / Mã vải / Số kg tồn trống)
IF EXISTS (SELECT 1 FROM #TonKhoVaiImport WHERE NULLIF(MaCay,'') IS NULL OR NULLIF(MaVai,'') IS NULL OR NULLIF(SoKgTon,'') IS NULL)
BEGIN
    SELECT *, N'Thiếu Mã cây / Mã vải / Số kg tồn' AS LoiKiemTra FROM #TonKhoVaiImport
    WHERE NULLIF(MaCay,'') IS NULL OR NULLIF(MaVai,'') IS NULL OR NULLIF(SoKgTon,'') IS NULL;
    RAISERROR(N'Import THẤT BẠI: có dòng thiếu dữ liệu (xem danh sách kết quả ở trên). Sửa file rồi chạy lại toàn bộ script.', 16, 1);
    RETURN;
END

-- Kiểm tra 2: Số kg tồn không phải số hợp lệ (VD lỡ gõ chữ, hoặc dùng dấu phẩy thập phân kiểu VN
-- mà không đổi lại thành dấu chấm) — tự động chấp nhận cả 2 kiểu "25.5" và "25,5".
IF EXISTS (SELECT 1 FROM #TonKhoVaiImport WHERE TRY_CAST(REPLACE(SoKgTon, ',', '.') AS DECIMAL(10,2)) IS NULL)
BEGIN
    SELECT *, N'Số kg tồn không phải số hợp lệ' AS LoiKiemTra FROM #TonKhoVaiImport
    WHERE TRY_CAST(REPLACE(SoKgTon, ',', '.') AS DECIMAL(10,2)) IS NULL;
    RAISERROR(N'Import THẤT BẠI: có dòng "Số kg tồn" không đọc được thành số (xem danh sách ở trên). Sửa file rồi chạy lại toàn bộ script.', 16, 1);
    RETURN;
END

-- Kiểm tra 3 (YÊU CẦU CHÍNH): Mã vải KHÔNG TỒN TẠI trong Danh mục vải
IF EXISTS (
    SELECT 1 FROM #TonKhoVaiImport t
    WHERE NOT EXISTS (SELECT 1 FROM DanhMucVai d WHERE d.MaVai = t.MaVai)
)
BEGIN
    SELECT t.MaCay, t.MaVai, t.SoKgTon, N'Không tìm thấy Mã vải trong Danh mục vải' AS LoiKiemTra
    FROM #TonKhoVaiImport t
    WHERE NOT EXISTS (SELECT 1 FROM DanhMucVai d WHERE d.MaVai = t.MaVai);

    RAISERROR(N'Import THẤT BẠI: có Mã vải không tồn tại trong Danh mục vải (xem danh sách kết quả ở trên). Kiểm tra lại Danh mục → Loại vải/Vải trong ứng dụng, hoặc sửa lại Mã vải trong file rồi chạy lại TOÀN BỘ script.', 16, 1);
    RETURN;
END

-- Kiểm tra 4: Mã cây bị lặp lại nhiều dòng NGAY TRONG cùng 1 file import (2 dòng cùng Mã cây sẽ
-- vi phạm ràng buộc UNIQUE của VaiCay.MaCay nếu cả 2 đều là dòng mới)
IF EXISTS (SELECT MaCay FROM #TonKhoVaiImport GROUP BY MaCay HAVING COUNT(*) > 1)
BEGIN
    SELECT MaCay, COUNT(*) AS SoLanLap FROM #TonKhoVaiImport GROUP BY MaCay HAVING COUNT(*) > 1;
    RAISERROR(N'Import THẤT BẠI: có Mã cây bị lặp lại nhiều dòng trong cùng file import (xem danh sách ở trên). Mỗi Mã cây chỉ được xuất hiện đúng 1 dòng.', 16, 1);
    RETURN;
END

PRINT N'Kiểm tra dữ liệu OK (không có lỗi) — bắt đầu import...';

BEGIN TRY
    BEGIN TRANSACTION;

    -- VaiCay.PhieuNhapID là bắt buộc (NOT NULL) — tạo 1 "phiếu nhập" đại diện cho cả đợt import
    -- này (không có nhà cung cấp/hóa đơn thật vì đây là nhập tồn có sẵn, không phải nhập mới).
    DECLARE @PhieuNhapID INT;
    INSERT INTO PhieuNhapVai (NgayNhap, GhiChu)
    VALUES (CAST(SYSDATETIME() AS DATE), N'Nhập tồn kho vải qua import Excel — ' + CONVERT(NVARCHAR(30), SYSDATETIME(), 120));
    SET @PhieuNhapID = SCOPE_IDENTITY();

    -- Mã cây ĐÃ CÓ → cập nhật lại KGNhap theo Số kg tồn mới (dùng khi chạy lại import để đối chiếu
    -- theo kiểm kê thực tế). Mã cây CHƯA CÓ → tạo mới, gắn vào phiếu nhập đại diện ở trên.
    MERGE VaiCay AS target
    USING (
        SELECT t.MaCay, d.VaiID, TRY_CAST(REPLACE(t.SoKgTon, ',', '.') AS DECIMAL(10,2)) AS SoKgTon
        FROM #TonKhoVaiImport t
        JOIN DanhMucVai d ON d.MaVai = t.MaVai
    ) AS src
    ON target.MaCay = src.MaCay
    WHEN MATCHED THEN
        UPDATE SET KGNhap = src.SoKgTon, VaiID = src.VaiID
    WHEN NOT MATCHED THEN
        INSERT (MaCay, PhieuNhapID, VaiID, KGNhap, NgayNhap, TrangThai)
        VALUES (src.MaCay, @PhieuNhapID, src.VaiID, src.SoKgTon, CAST(SYSDATETIME() AS DATE), N'Nguyên cây');

    DECLARE @SoDong INT = @@ROWCOUNT;
    COMMIT TRANSACTION;
    PRINT N'Import THÀNH CÔNG: ' + CAST(@SoDong AS NVARCHAR(20)) + N' dòng đã được ghi/cập nhật vào VaiCay.';
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    PRINT N'Import THẤT BẠI, đã rollback toàn bộ (không có gì bị ghi vào database): ' + ERROR_MESSAGE();
    THROW;
END CATCH
GO
