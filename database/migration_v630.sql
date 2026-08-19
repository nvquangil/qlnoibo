/* ================================================================
   MIGRATION v6.3 (Payroll Phase 4) — LUONG/CHI PHI GIA CONG NGOAI + IN THEU
   ----------------------------------------------------------------
   - Them ChucNang PAYROLL 'luonggcinthe' (tong hop tu QLSX, KHONG doi schema - chi doc):
       Gia cong: SUM(DonHangChiTietNhaGiaCong.SoLuongNhan x don gia hang muc) theo tung Nha gia cong.
       In theu:  DonHangNhaInTheu.SoLuongNhan x (tong DonHangDonGiaInThe.DonGia cua don) theo tung Nha in.
   - Loc theo thang tao dong giao (CreatedAt) vi SL nhan khong co cot ngay rieng.
   Chay 1 lan. IDEMPOTENT. YEU CAU: migration_v600/v610/v620 (+ nhanh QLSX v5.30/v5.32/v5.34c da co
   cac cot SoLuongNhan / bang DonHangNhaInTheu / DonHangDonGiaInThe).
   ================================================================ */
USE QLNoiBo;
GO

MERGE ChucNang AS t
USING (VALUES ('PAYROLL','luonggcinthe', N'Lương gia công / In thêu', 5)) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu)
ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
WHEN NOT MATCHED THEN INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu) VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu);
GO

PRINT '=== migration_v630.sql (Payroll Phase 4 - luong gia cong/in theu) hoan tat ===';
GO
