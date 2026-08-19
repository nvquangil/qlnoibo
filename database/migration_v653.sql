-- ================================================================
-- migration_v653.sql  (v5.58) — BIỂU MẪU THÔNG SỐ ĐO MỚI (theo file thongsodo.xls)
--
-- Mẫu mới:  DÒNG = THÔNG SỐ (Dài áo, Rộng ngang ngực, Chéo nách...) + VỊ TRÍ ĐO + dung sai (+/-)
--           CỘT  = SIZE (80, 90, 100, 110, 120, 130, 140...)
--           Bên phải là khối "Ghi chú / YÊU CẦU KỸ THUẬT" dùng chung + ảnh sản phẩm.
-- (Trước đây: DÒNG = size, CỘT = vị trí đo — tức HOÁN VỊ so với mẫu mới.)
--
-- Thêm:
--   TaiLieuThongSoDoDong : ViTriDo (cách đo) + DungSai (+/-)
--   TaiLieuThongSoDo     : YeuCauKyThuat (khối Ghi chú) + AnhGhiChu (JSON danh sách ảnh)
-- An toàn chạy lại nhiều lần. >>> NHỚ CHỌN ĐÚNG DATABASE QLNoiBo <<<
-- ================================================================

PRINT N'--- migration_v653: database hien tai = ' + DB_NAME() + N' ---';
GO

IF OBJECT_ID(N'DonHangSanXuat', N'U') IS NULL
BEGIN
    PRINT N'*** DUNG LAI: khong thay bang DonHangSanXuat => SAI DATABASE (thuong la [master]).';
    SET NOEXEC ON;
END
GO

-- 1) Dòng thông số: thêm VỊ TRÍ ĐO + DUNG SAI
IF OBJECT_ID(N'TaiLieuThongSoDoDong', N'U') IS NULL
    PRINT N'BO QUA: chua co bang TaiLieuThongSoDoDong.';
ELSE
BEGIN
    IF COL_LENGTH(N'TaiLieuThongSoDoDong', N'ViTriDo') IS NULL
    BEGIN
        ALTER TABLE TaiLieuThongSoDoDong ADD ViTriDo NVARCHAR(400) NULL;
        PRINT N'OK: them cot ViTriDo vao TaiLieuThongSoDoDong.';
    END
    ELSE PRINT N'DA CO: TaiLieuThongSoDoDong.ViTriDo.';

    IF COL_LENGTH(N'TaiLieuThongSoDoDong', N'DungSai') IS NULL
    BEGIN
        ALTER TABLE TaiLieuThongSoDoDong ADD DungSai NVARCHAR(50) NULL;
        PRINT N'OK: them cot DungSai vao TaiLieuThongSoDoDong.';
    END
    ELSE PRINT N'DA CO: TaiLieuThongSoDoDong.DungSai.';
END
GO

-- 2) Header: khối Ghi chú "YÊU CẦU KỸ THUẬT" + ảnh minh hoạ (JSON mảng URL)
IF OBJECT_ID(N'TaiLieuThongSoDo', N'U') IS NULL
    PRINT N'BO QUA: chua co bang TaiLieuThongSoDo.';
ELSE
BEGIN
    IF COL_LENGTH(N'TaiLieuThongSoDo', N'YeuCauKyThuat') IS NULL
    BEGIN
        ALTER TABLE TaiLieuThongSoDo ADD YeuCauKyThuat NVARCHAR(MAX) NULL;
        PRINT N'OK: them cot YeuCauKyThuat vao TaiLieuThongSoDo.';
    END
    ELSE PRINT N'DA CO: TaiLieuThongSoDo.YeuCauKyThuat.';

    IF COL_LENGTH(N'TaiLieuThongSoDo', N'AnhGhiChu') IS NULL
    BEGIN
        ALTER TABLE TaiLieuThongSoDo ADD AnhGhiChu NVARCHAR(MAX) NULL;
        PRINT N'OK: them cot AnhGhiChu vao TaiLieuThongSoDo (JSON danh sach anh).';
    END
    ELSE PRINT N'DA CO: TaiLieuThongSoDo.AnhGhiChu.';

    -- Cột LaMau/TenMau (migration_v534e) — bổ sung luôn nếu thiếu (xem migration_v652).
    IF COL_LENGTH(N'TaiLieuThongSoDo', N'LaMau') IS NULL
    BEGIN
        ALTER TABLE TaiLieuThongSoDo ADD LaMau BIT NOT NULL CONSTRAINT DF_TLTSD_LaMau_653 DEFAULT 0;
        PRINT N'OK: them cot LaMau vao TaiLieuThongSoDo.';
    END
    IF COL_LENGTH(N'TaiLieuThongSoDo', N'TenMau') IS NULL
    BEGIN
        ALTER TABLE TaiLieuThongSoDo ADD TenMau NVARCHAR(255) NULL;
        PRINT N'OK: them cot TenMau vao TaiLieuThongSoDo.';
    END
END
GO

-- 3) BAO CAO
SELECT 'TaiLieuThongSoDoDong' AS Bang,
       CASE WHEN COL_LENGTH('TaiLieuThongSoDoDong','ViTriDo') IS NULL THEN N'THIEU' ELSE N'OK' END AS ViTriDo,
       CASE WHEN COL_LENGTH('TaiLieuThongSoDoDong','DungSai') IS NULL THEN N'THIEU' ELSE N'OK' END AS DungSai
UNION ALL
SELECT 'TaiLieuThongSoDo',
       CASE WHEN COL_LENGTH('TaiLieuThongSoDo','YeuCauKyThuat') IS NULL THEN N'THIEU' ELSE N'OK' END,
       CASE WHEN COL_LENGTH('TaiLieuThongSoDo','AnhGhiChu') IS NULL THEN N'THIEU' ELSE N'OK' END;
GO

SET NOEXEC OFF;
PRINT N'--- migration_v653: ket thuc. Sau do: pm2 restart qlnoibo + Ctrl+F5 ---';
GO
