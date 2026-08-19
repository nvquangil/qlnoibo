/* ================================================================
   migration_v660.sql  (QLNoiBo v5.87)

   MỤC ĐÍCH: thêm 3 cột ẢNH (chỉ lưu ĐƯỜNG DẪN /uploads/..., giống mọi ảnh
   khác trong phần mềm — KHÔNG nhồi ảnh vào database):

     1. DonHangDonGiaInThe.AnhMinhHoa  — ảnh cho TỪNG DÒNG đơn giá in thêu.
     2. DanhMucPhuKien.AnhDaiDien      — ảnh của từng phụ kiện (danh mục).
     3. TienDoCatChiTietCay.AnhCay     — ảnh chụp TỪNG CÂY VẢI ở công đoạn Cắt
                                          (chụp bằng camera điện thoại hoặc tải file).

   AN TOÀN: chỉ THÊM cột, KHÔNG sửa/xóa dữ liệu. Chạy nhiều lần vô hại.
   Nếu CHƯA chạy file này: các màn hình vẫn mở bình thường (backend dò cột
   bằng COL_LENGTH, thiếu cột thì bỏ qua phần ảnh) — chỉ là chưa lưu được ảnh.
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

-- 1) Đơn giá in thêu: ảnh minh họa cho từng dòng hạng mục.
IF OBJECT_ID('dbo.DonHangDonGiaInThe', 'U') IS NULL
    PRINT '!! Khong tim thay bang DonHangDonGiaInThe - bo qua.';
ELSE IF COL_LENGTH('dbo.DonHangDonGiaInThe', 'AnhMinhHoa') IS NULL
BEGIN
    ALTER TABLE dbo.DonHangDonGiaInThe ADD AnhMinhHoa NVARCHAR(500) NULL;
    PRINT '   + DonHangDonGiaInThe.AnhMinhHoa da them.';
END
ELSE
    PRINT '   = DonHangDonGiaInThe.AnhMinhHoa da co tu truoc.';
GO

-- 2) Danh mục phụ kiện: ảnh của phụ kiện.
IF OBJECT_ID('dbo.DanhMucPhuKien', 'U') IS NULL
    PRINT '!! Khong tim thay bang DanhMucPhuKien - bo qua.';
ELSE IF COL_LENGTH('dbo.DanhMucPhuKien', 'AnhDaiDien') IS NULL
BEGIN
    ALTER TABLE dbo.DanhMucPhuKien ADD AnhDaiDien NVARCHAR(500) NULL;
    PRINT '   + DanhMucPhuKien.AnhDaiDien da them.';
END
ELSE
    PRINT '   = DanhMucPhuKien.AnhDaiDien da co tu truoc.';
GO

-- 3) Công đoạn Cắt: ảnh chụp từng cây vải trong 1 lần ghi tiến độ.
IF OBJECT_ID('dbo.TienDoCatChiTietCay', 'U') IS NULL
    PRINT '!! Khong tim thay bang TienDoCatChiTietCay - bo qua.';
ELSE IF COL_LENGTH('dbo.TienDoCatChiTietCay', 'AnhCay') IS NULL
BEGIN
    ALTER TABLE dbo.TienDoCatChiTietCay ADD AnhCay NVARCHAR(500) NULL;
    PRINT '   + TienDoCatChiTietCay.AnhCay da them.';
END
ELSE
    PRINT '   = TienDoCatChiTietCay.AnhCay da co tu truoc.';
GO

PRINT '';
PRINT '=== migration_v660.sql HOAN TAT ===';
SELECT COL_LENGTH('dbo.DonHangDonGiaInThe', 'AnhMinhHoa') AS DonGiaInThe_AnhMinhHoa,
       COL_LENGTH('dbo.DanhMucPhuKien',     'AnhDaiDien') AS PhuKien_AnhDaiDien,
       COL_LENGTH('dbo.TienDoCatChiTietCay','AnhCay')     AS Cat_AnhCay;
GO

SET NOEXEC OFF;
GO
