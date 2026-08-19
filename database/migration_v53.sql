/* ================================================================
   MIGRATION v5.3 — Dot refinement da phan he: phan quyen Sua/Xoa RIENG theo
   tung CHUC NANG (khong chi An/Hien nhu truoc), tach "Tao the kho moi" thanh
   1 chuc nang rieng trong KHOHANG.
   Additive - KHONG xoa/doi cot cu. Idempotent (COL_LENGTH / MERGE) - chay lai an toan.
   Chay SAU migration_v5_chucnang.sql (bang ChucNang/ChucNangPermissions phai da ton tai)
   va migration_v5_userperm.sql (bang UserChucNangPermissions phai da ton tai).
   ================================================================ */

USE QLNoiBo;
GO

/* ---- 1. Them CanEdit/CanDelete vao ChucNangPermissions (theo NHOM) ----
   Truoc day bang nay chi co CanView (An/Hien tab). Gio them 2 co Sua/Xoa RIENG
   cho tung chuc nang - vd 1 nhom co the duoc XEM tab "Xuat kho" nhung khong
   duoc SUA/XOA phieu trong do, du van co quyen Sua/Xoa o cap PHAN HE (Permissions).
   Nguyen tac AND: phai duoc ca 2 cap (Phan he VA Chuc nang) moi thuc su lam duoc.
   Mac dinh = 1 (duoc phep) de KHONG lam mat quyen cua ai dang dung truoc khi chay
   migration nay - giong dung tinh than CanView mac dinh 1 da co. */
IF COL_LENGTH('ChucNangPermissions', 'CanEdit') IS NULL
BEGIN
    ALTER TABLE ChucNangPermissions ADD CanEdit BIT NOT NULL DEFAULT 1;
    PRINT 'Da them cot ChucNangPermissions.CanEdit.';
END ELSE PRINT 'Cot ChucNangPermissions.CanEdit da ton tai, bo qua.';
GO

IF COL_LENGTH('ChucNangPermissions', 'CanDelete') IS NULL
BEGIN
    ALTER TABLE ChucNangPermissions ADD CanDelete BIT NOT NULL DEFAULT 1;
    PRINT 'Da them cot ChucNangPermissions.CanDelete.';
END ELSE PRINT 'Cot ChucNangPermissions.CanDelete da ton tai, bo qua.';
GO

/* ---- 2. Them CanEdit/CanDelete vao UserChucNangPermissions (rieng TUNG USER) ---- */
IF COL_LENGTH('UserChucNangPermissions', 'CanEdit') IS NULL
BEGIN
    ALTER TABLE UserChucNangPermissions ADD CanEdit BIT NOT NULL DEFAULT 1;
    PRINT 'Da them cot UserChucNangPermissions.CanEdit.';
END ELSE PRINT 'Cot UserChucNangPermissions.CanEdit da ton tai, bo qua.';
GO

IF COL_LENGTH('UserChucNangPermissions', 'CanDelete') IS NULL
BEGIN
    ALTER TABLE UserChucNangPermissions ADD CanDelete BIT NOT NULL DEFAULT 1;
    PRINT 'Da them cot UserChucNangPermissions.CanDelete.';
END ELSE PRINT 'Cot UserChucNangPermissions.CanDelete da ton tai, bo qua.';
GO

/* ---- 3. Chuc nang moi: "Tao the kho moi" tach rieng khoi list "The kho hang hoa" ---- */
MERGE ChucNang AS t
USING (VALUES
    ('KHOHANG','taomoi',N'Tạo thẻ kho mới',3)
) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu)
ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
WHEN NOT MATCHED THEN
    INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu) VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu);
GO
PRINT 'Da seed chuc nang KHOHANG:taomoi (idempotent).';
GO
