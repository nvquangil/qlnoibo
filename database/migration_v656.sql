-- ================================================================
-- migration_v656.sql  (v5.62) — CÔNG KHAI THẺ KHO THEO TỪNG DANH MỤC
--
-- Mục tiêu: mỗi "Danh mục thẻ kho" có 1 ĐƯỜNG LINK RIÊNG để gửi khách xem, và chỉ danh mục
-- được BẬT công khai mới xem được (danh mục chưa bật -> mở link báo không tồn tại).
--
-- Thêm vào TheKhoDanhMuc:
--   CongKhai BIT      : công tắc Bật/Tắt chia sẻ (mặc định 0 = TẮT -> an toàn, không lộ gì sau khi cập nhật)
--   Slug     NVARCHAR : mã đường link không dấu (vd 'hang-he-2026'); dùng trong URL thay cho ID nội bộ
--   TieuDeCongKhai    : tiêu đề hiện trên trang khách xem (để trống = dùng tên danh mục)
--   MoTaCongKhai      : dòng mô tả ngắn dưới tiêu đề (tùy chọn)
--
-- An toàn chạy lại nhiều lần. >>> NHỚ CHỌN ĐÚNG DATABASE QLNoiBo <<<
-- ================================================================

PRINT N'--- migration_v656: database hien tai = ' + DB_NAME() + N' ---';
GO

IF OBJECT_ID(N'DonHangSanXuat', N'U') IS NULL
BEGIN
    PRINT N'*** DUNG LAI: khong thay bang DonHangSanXuat => SAI DATABASE (thuong la [master]).';
    SET NOEXEC ON;
END
GO

IF OBJECT_ID(N'TheKhoDanhMuc', N'U') IS NULL
    PRINT N'BO QUA: chua co bang TheKhoDanhMuc.';
ELSE
BEGIN
    IF COL_LENGTH(N'TheKhoDanhMuc', N'CongKhai') IS NULL
    BEGIN
        ALTER TABLE TheKhoDanhMuc ADD CongKhai BIT NOT NULL CONSTRAINT DF_TKDM_CongKhai DEFAULT 0;
        PRINT N'OK: them cot CongKhai vao TheKhoDanhMuc (mac dinh 0 = TAT).';
    END
    ELSE PRINT N'DA CO: TheKhoDanhMuc.CongKhai.';

    IF COL_LENGTH(N'TheKhoDanhMuc', N'Slug') IS NULL
    BEGIN
        ALTER TABLE TheKhoDanhMuc ADD Slug NVARCHAR(120) NULL;
        PRINT N'OK: them cot Slug vao TheKhoDanhMuc.';
    END
    ELSE PRINT N'DA CO: TheKhoDanhMuc.Slug.';

    IF COL_LENGTH(N'TheKhoDanhMuc', N'TieuDeCongKhai') IS NULL
    BEGIN
        ALTER TABLE TheKhoDanhMuc ADD TieuDeCongKhai NVARCHAR(200) NULL;
        PRINT N'OK: them cot TieuDeCongKhai vao TheKhoDanhMuc.';
    END

    IF COL_LENGTH(N'TheKhoDanhMuc', N'MoTaCongKhai') IS NULL
    BEGIN
        ALTER TABLE TheKhoDanhMuc ADD MoTaCongKhai NVARCHAR(500) NULL;
        PRINT N'OK: them cot MoTaCongKhai vao TheKhoDanhMuc.';
    END
END
GO

-- Sinh Slug cho các danh mục đang có (bỏ dấu, thay khoảng trắng bằng '-', chữ thường).
-- Chỉ điền cho dòng CHƯA có Slug; không ghi đè slug người dùng tự đặt.
IF OBJECT_ID(N'TheKhoDanhMuc', N'U') IS NOT NULL AND COL_LENGTH(N'TheKhoDanhMuc', N'Slug') IS NOT NULL
BEGIN
    UPDATE TheKhoDanhMuc
    SET Slug = LOWER(
        REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
        REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
        REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
            LTRIM(RTRIM(TenTheKho)) COLLATE Vietnamese_CI_AI,
            N' ', N'-'), N'/', N'-'), N'\', N'-'), N'.', N''), N',', N''),
            N'(', N''), N')', N''), N'''', N''), N'"', N''), N'&', N'-'),
            N'+', N'-'), N'#', N''), N'%', N''), N'?', N''), N'=', N''),
            N':', N''), N';', N''), N'!', N''), N'*', N''), N'@', N''),
            N'[', N''), N']', N''), N'{', N''), N'}', N''), N'|', N'-'),
            N'<', N''), N'>', N''), N'~', N''), N'`', N''), N'^', N'')
    )
    WHERE Slug IS NULL OR LTRIM(RTRIM(Slug)) = N'';
    PRINT N'OK: da sinh Slug cho cac danh muc chua co (dung COLLATE Vietnamese_CI_AI de bo dau).';

    -- Gộp dấu '-' liên tiếp (chạy vài lượt cho chắc)
    UPDATE TheKhoDanhMuc SET Slug = REPLACE(Slug, N'--', N'-') WHERE Slug LIKE N'%--%';
    UPDATE TheKhoDanhMuc SET Slug = REPLACE(Slug, N'--', N'-') WHERE Slug LIKE N'%--%';
    UPDATE TheKhoDanhMuc SET Slug = REPLACE(Slug, N'--', N'-') WHERE Slug LIKE N'%--%';

    -- Nếu trùng slug: thêm ID vào sau cho khác nhau.
    UPDATE d SET Slug = d.Slug + N'-' + CAST(d.TheKhoDanhMucID AS NVARCHAR(10))
    FROM TheKhoDanhMuc d
    WHERE EXISTS (SELECT 1 FROM TheKhoDanhMuc x WHERE x.Slug = d.Slug AND x.TheKhoDanhMucID < d.TheKhoDanhMucID);
END
GO

-- Chỉ mục duy nhất trên Slug (bỏ qua NULL) — chặn 2 danh mục cùng đường link.
IF OBJECT_ID(N'TheKhoDanhMuc', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_TheKhoDanhMuc_Slug' AND object_id = OBJECT_ID(N'TheKhoDanhMuc'))
BEGIN
    BEGIN TRY
        CREATE UNIQUE INDEX UX_TheKhoDanhMuc_Slug ON TheKhoDanhMuc(Slug) WHERE Slug IS NOT NULL;
        PRINT N'OK: da tao chi muc duy nhat UX_TheKhoDanhMuc_Slug.';
    END TRY
    BEGIN CATCH
        PRINT N'CANH BAO: khong tao duoc chi muc duy nhat tren Slug (co the con slug trung): ' + ERROR_MESSAGE();
    END CATCH
END
GO

SELECT TheKhoDanhMucID, TenTheKho, CongKhai, Slug, TieuDeCongKhai FROM TheKhoDanhMuc ORDER BY TenTheKho;
GO

SET NOEXEC OFF;
PRINT N'--- migration_v656: ket thuc. Sau do: pm2 restart qlnoibo + Ctrl+F5 ---';
PRINT N'Luu y: TAT CA danh muc mac dinh TAT cong khai. Vao Danh muc the kho -> bat "Cong khai" cho danh muc muon chia se.';
GO
