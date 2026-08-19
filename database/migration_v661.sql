/* ================================================================
   migration_v661.sql  (QLNoiBo v5.91)

   MỤC ĐÍCH: thêm chức năng "LƯƠNG TRẢI VẢI CẮT" trong phân hệ Tính lương.

     1. Bảng CauHinhLuongCat — HỆ SỐ LƯƠNG của từng nhân viên bộ phận Cắt
        (mặc định 1.0 nếu chưa khai).
     2. Seed khoá cấu hình 'LUONG_CAT' trong bảng CauHinh — chứa ĐƠN GIÁ
        (mặc định 1100 đ) dùng cho công thức:
            mét sơ đồ × tổng số lớp × khổ vải × đơn giá = tiền 1 sơ đồ
        Sửa đơn giá ngay trong phần mềm, KHÔNG cần sửa code.
     3. Seed ChucNang 'luongtraivaicat' để phân quyền tab mới như các tab lương khác.

   AN TOÀN: chỉ THÊM, không sửa/xóa dữ liệu cũ. Chạy nhiều lần vô hại.
   ================================================================ */
USE QLNoiBo;
GO

IF DB_NAME() <> 'QLNoiBo'
BEGIN
    PRINT '*** SAI DATABASE: dang o [' + DB_NAME() + ']. Hay chon QLNoiBo roi chay lai. ***';
    SET NOEXEC ON;
END
GO

-- 1) Hệ số lương từng nhân viên cắt.
IF OBJECT_ID('dbo.CauHinhLuongCat', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.CauHinhLuongCat (
        NhanVienID  INT NOT NULL PRIMARY KEY FOREIGN KEY REFERENCES NhanVien(NhanVienID),
        HeSoLuong   DECIMAL(10,3) NOT NULL DEFAULT 1,
        GhiChu      NVARCHAR(255) NULL,
        UpdatedAt   DATETIME2 NULL
    );
    PRINT '   + Da tao bang CauHinhLuongCat.';
END
ELSE
    PRINT '   = Bang CauHinhLuongCat da co tu truoc.';
GO

-- 2) Đơn giá cắt (JSON trong CauHinh). Bảng CauHinh do migration_v655 tạo.
IF OBJECT_ID('dbo.CauHinh', 'U') IS NULL
    PRINT '!! Chua co bang CauHinh - hay chay migration_v655.sql truoc.';
ELSE IF NOT EXISTS (SELECT 1 FROM dbo.CauHinh WHERE Khoa = N'LUONG_CAT')
BEGIN
    INSERT INTO dbo.CauHinh (Khoa, GiaTri, UpdatedAt)
    VALUES (N'LUONG_CAT', N'{"donGia":1100}', SYSDATETIME());
    PRINT '   + Da seed CauHinh[LUONG_CAT] = don gia 1100.';
END
ELSE
    PRINT '   = CauHinh[LUONG_CAT] da co tu truoc (khong ghi de don gia dang dung).';
GO

-- 3) Chức năng phân quyền cho tab mới (giống luongmay / luongladonggoi).
IF OBJECT_ID('dbo.ChucNang', 'U') IS NULL
    PRINT '!! Chua co bang ChucNang - bo qua phan seed phan quyen.';
ELSE
BEGIN
    MERGE ChucNang AS t
    USING (VALUES ('PAYROLL', 'luongtraivaicat', N'Lương trải vải cắt', 7)) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu)
      ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
    WHEN NOT MATCHED THEN
      INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu)
      VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu);
    PRINT '   + Da seed ChucNang PAYROLL/luongtraivaicat.';
END
GO

PRINT '';
PRINT '=== migration_v661.sql HOAN TAT ===';
SELECT (SELECT COUNT(*) FROM dbo.CauHinhLuongCat) AS SoNhanVienDaKhaiHeSo,
       (SELECT GiaTri FROM dbo.CauHinh WHERE Khoa = N'LUONG_CAT') AS CauHinh_LuongCat;
GO

SET NOEXEC OFF;
GO
