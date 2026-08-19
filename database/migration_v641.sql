/* ================================================================
   MIGRATION v6.41 — Phân quyền cho 2 tab "Tài liệu may/Đóng gói" + "Tài liệu in thêu"
   ----------------------------------------------------------------
   2 tab này (thêm ở v5.34) trước đây gate CHUNG ChucNang 'tailieukythuat' nên KHÔNG hiện
   trong màn Phân quyền. Thêm 2 ChucNang QLSX riêng để admin cấp/ẩn từng tab (ma trận phân quyền
   đọc động bảng ChucNang nên chỉ cần seed là hiện). Backend đã đổi sang gate theo loai.
   Chạy 1 lần. IDEMPOTENT.
   ================================================================ */
USE QLNoiBo;
GO

MERGE ChucNang AS t
USING (VALUES
    ('QLSX','tailieumay',   N'Tài liệu may/Đóng gói', 10),
    ('QLSX','tailieuinthe', N'Tài liệu in thêu',      11)
) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu)
ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
WHEN NOT MATCHED THEN INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu) VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu);
GO

PRINT '=== migration_v641.sql (ChucNang tailieumay + tailieuinthe) hoan tat ===';
GO
