-- ================================================================
-- migration_v657.sql  (v5.63) — KHÁCH ĐĂNG NHẬP ĐẶT HÀNG TRÊN WEB CÔNG KHAI
--
-- Luồng đã chốt với người dùng:
--   1. NHÂN VIÊN tạo sẵn tài khoản cho từng khách (khách KHÔNG tự đăng ký) -> bảng TaiKhoanKhach.
--   2. Khách đăng nhập ở trang công khai, chỉ đặt được hàng thuộc danh mục ĐÃ BẬT công khai,
--      KHÔNG thấy số tồn kho.
--   3. Đơn khách đặt vào Danh sách đơn đặt hàng với trạng thái N'Chờ xác nhận' và
--      *** CHƯA TRỪ TỒN KHO ***. Nhân viên bấm Xác nhận thì mới trừ tồn.
--   4. Thông báo cho mọi người có quyền Thẻ kho hàng hóa (+ Admin).
--
-- Vì sao cần cột DaTruTon: bảng DonKhachDatHang hiện TRỪ TỒN NGAY khi tạo đơn, và khi chuyển
-- trạng thái sang N'Đã hủy' thì CỘNG TRẢ tồn. Nếu đơn 'Chờ xác nhận' (chưa trừ) mà bị hủy thì
-- code cũ sẽ cộng trả một lượng CHƯA TỪNG TRỪ => tồn kho bị thừa. DaTruTon là cờ đánh dấu
-- "đơn này đã trừ tồn hay chưa" để cộng/trừ luôn khớp.
--
-- An toàn chạy lại nhiều lần. >>> NHỚ CHỌN ĐÚNG DATABASE QLNoiBo <<<
-- ================================================================

PRINT N'--- migration_v657: database hien tai = ' + DB_NAME() + N' ---';
GO

IF OBJECT_ID(N'DonHangSanXuat', N'U') IS NULL
BEGIN
    PRINT N'*** DUNG LAI: khong thay bang DonHangSanXuat => SAI DATABASE (thuong la [master]).';
    SET NOEXEC ON;
END
GO

-- 1) TÀI KHOẢN KHÁCH (nhân viên tạo, gửi khách đăng nhập)
IF OBJECT_ID(N'TaiKhoanKhach', N'U') IS NULL
BEGIN
    CREATE TABLE TaiKhoanKhach (
        TaiKhoanKhachID INT IDENTITY(1,1) PRIMARY KEY,
        TenDangNhap     NVARCHAR(80)  NOT NULL UNIQUE,
        MatKhauHash     NVARCHAR(200) NOT NULL,
        TenKhach        NVARCHAR(150) NOT NULL,          -- tên hiển thị + ghi vào đơn (DonKhachDatHang.TenKhach)
        SDT             NVARCHAR(30)  NULL,
        Email           NVARCHAR(100) NULL,
        DiaChi          NVARCHAR(255) NULL,
        KhachHangID     INT NULL FOREIGN KEY REFERENCES KhachHang(KhachHangID),   -- gắn với danh mục Khách hàng (tùy chọn)
        TrangThai       NVARCHAR(20)  NOT NULL DEFAULT N'Hoạt động',              -- Hoạt động / Tạm dừng
        GhiChu          NVARCHAR(255) NULL,
        LanDangNhapCuoi DATETIME2     NULL,
        CreatedAt       DATETIME2     NOT NULL DEFAULT SYSDATETIME()
    );
    PRINT N'OK: da tao bang TaiKhoanKhach.';
END
ELSE PRINT N'DA CO: bang TaiKhoanKhach.';
GO

-- 2) DonKhachDatHang: nguồn đơn + tài khoản khách + ghi chú của khách + cờ đã trừ tồn
IF OBJECT_ID(N'DonKhachDatHang', N'U') IS NULL
    PRINT N'BO QUA: chua co bang DonKhachDatHang.';
ELSE
BEGIN
    IF COL_LENGTH(N'DonKhachDatHang', N'TaiKhoanKhachID') IS NULL
    BEGIN
        ALTER TABLE DonKhachDatHang ADD TaiKhoanKhachID INT NULL;
        PRINT N'OK: them cot TaiKhoanKhachID vao DonKhachDatHang.';
    END
    IF COL_LENGTH(N'DonKhachDatHang', N'NguonDat') IS NULL
    BEGIN
        ALTER TABLE DonKhachDatHang ADD NguonDat NVARCHAR(20) NOT NULL CONSTRAINT DF_DKDH_NguonDat DEFAULT N'NoiBo';
        PRINT N'OK: them cot NguonDat vao DonKhachDatHang (NoiBo = nhan vien nhap, Web = khach tu dat).';
    END
    IF COL_LENGTH(N'DonKhachDatHang', N'GhiChuKhach') IS NULL
    BEGIN
        ALTER TABLE DonKhachDatHang ADD GhiChuKhach NVARCHAR(500) NULL;
        PRINT N'OK: them cot GhiChuKhach vao DonKhachDatHang.';
    END
    IF COL_LENGTH(N'DonKhachDatHang', N'DaTruTon') IS NULL
    BEGIN
        ALTER TABLE DonKhachDatHang ADD DaTruTon BIT NOT NULL CONSTRAINT DF_DKDH_DaTruTon DEFAULT 1;
        PRINT N'*** OK: them cot DaTruTon (mac dinh 1). Xem giai thich o dau file.';
    END
    IF COL_LENGTH(N'DonKhachDatHang', N'NguoiXacNhanID') IS NULL
    BEGIN
        ALTER TABLE DonKhachDatHang ADD NguoiXacNhanID INT NULL;
        PRINT N'OK: them cot NguoiXacNhanID vao DonKhachDatHang.';
    END
    IF COL_LENGTH(N'DonKhachDatHang', N'ThoiGianXacNhan') IS NULL
    BEGIN
        ALTER TABLE DonKhachDatHang ADD ThoiGianXacNhan DATETIME2 NULL;
        PRINT N'OK: them cot ThoiGianXacNhan vao DonKhachDatHang.';
    END
END
GO

-- Dữ liệu CŨ: mọi đơn đã tạo trước bản này đều ĐÃ trừ tồn lúc tạo, TRỪ đơn đã hủy (đã được cộng trả).
IF OBJECT_ID(N'DonKhachDatHang', N'U') IS NOT NULL AND COL_LENGTH(N'DonKhachDatHang', N'DaTruTon') IS NOT NULL
BEGIN
    UPDATE DonKhachDatHang SET DaTruTon = 0 WHERE TrangThai = N'Đã hủy';
    PRINT N'OK: da danh dau DaTruTon=0 cho cac don DA HUY (ton da duoc cong tra tu truoc).';
END
GO

-- 3) Quyền: thêm chức năng "Tài khoản khách" trong phân hệ Thẻ kho hàng hóa (KHOHANG)
IF OBJECT_ID(N'ChucNang', N'U') IS NOT NULL
BEGIN
    MERGE ChucNang AS t
    USING (VALUES ('KHOHANG', 'taikhoankhach', N'Tài khoản khách (đặt hàng web)', 90)) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu)
    ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
    WHEN NOT MATCHED THEN
        INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu) VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu);
    PRINT N'OK: da them ChucNang KHOHANG/taikhoankhach vao ma tran phan quyen.';
END
GO

SELECT 'TaiKhoanKhach' AS Bang, COUNT(*) AS SoDong FROM TaiKhoanKhach
UNION ALL
SELECT 'DonKhachDatHang (Cho xac nhan)', COUNT(*) FROM DonKhachDatHang WHERE TrangThai = N'Chờ xác nhận';
GO

SET NOEXEC OFF;
PRINT N'--- migration_v657: ket thuc. Sau do: pm2 restart qlnoibo + Ctrl+F5 ---';
PRINT N'Buoc tiep: Tho kho hang hoa -> tab "Tai khoan khach" -> tao tai khoan cho khach, roi gui link danh muc + tai khoan.';
GO
