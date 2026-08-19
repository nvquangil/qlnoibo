/* ================================================================
   MIGRATION v6.2 (Payroll Phase 3) — LUONG KHOAN MAY + SELF-SERVICE "Bang luong cua toi"
   ----------------------------------------------------------------
   - Them ChucNang PAYROLL 'luongmay' (bang luong khoan may - tinh tu PhanCongMay x don gia
     cong doan may cua don hang, KHONG doi schema QLSX - chi doc).
   - Them phan he MOI 'MYPAY' (Bang luong cua toi) - HIEN cho MOI nhan vien dang nhap (khong
     phai quyen quan tri): seed Permissions CanView=1 cho tat ca cac nhom (tru Admin da bypass).
     Nhan vien chi thay luong CUA CHINH MINH (backend loc theo Users.NhanVienID - da them o v600).
   - (Cot Users.NhanVienID da co tu migration_v600.sql; Phase 3 bat dau DUNG no: form Tai khoan
     them lien ket nhan vien, loadUserContext tra ve nhanVienId.)

   Chay 1 lan. IDEMPOTENT. YEU CAU TIEN QUYET: migration_v600.sql + migration_v610.sql.
   ================================================================ */

USE QLNoiBo;
GO

-- 1. ChucNang moi cho PAYROLL: 'luongmay'
MERGE ChucNang AS t
USING (VALUES ('PAYROLL','luongmay', N'Lương khoán may', 4)) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu)
ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
WHEN NOT MATCHED THEN INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu) VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu);
GO

-- 2. Module MYPAY (Bang luong cua toi) - hien cho moi nguoi
IF NOT EXISTS (SELECT 1 FROM Modules WHERE ModuleCode = N'MYPAY')
    INSERT INTO Modules (ModuleCode, TenModule, ThuTu) VALUES (N'MYPAY', N'Bảng lương của tôi', 9);
GO
-- Cap quyen XEM cho TAT CA cac nhom (tru Admin - da bypass). Nhan vien thuong van thay module nay.
INSERT INTO Permissions (GroupID, ModuleID, CanView, CanCreate, CanEdit, CanDelete)
SELECT g.GroupID, m.ModuleID, 1, 0, 0, 0
FROM Groups g CROSS JOIN Modules m
WHERE m.ModuleCode = N'MYPAY' AND g.TenNhom <> N'Admin'
  AND NOT EXISTS (SELECT 1 FROM Permissions p WHERE p.GroupID = g.GroupID AND p.ModuleID = m.ModuleID);
GO
-- Neu module MYPAY da ton tai tu lan chay truoc nhung 1 so nhom dang CanView=0, dam bao bat len 1.
UPDATE p SET CanView = 1
FROM Permissions p JOIN Modules m ON m.ModuleID = p.ModuleID
WHERE m.ModuleCode = N'MYPAY';
GO
MERGE ChucNang AS t
USING (VALUES ('MYPAY','luongcuatoi', N'Bảng lương của tôi', 1)) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu)
ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
WHEN NOT MATCHED THEN INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu) VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu);
GO

PRINT '=== migration_v620.sql (Payroll Phase 3) hoan tat ===';
GO
