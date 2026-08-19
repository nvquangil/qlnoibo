/* MIGRATION v5.8 — QLSX: them NhaGiaCong.LaNoiBo (BIT) de xac dinh CHINH XAC dong "Nha Lam" trong danh
   muc Nha gia cong, thay cho so sanh CHUOI TenNha = N'Nhà Làm' mong manh (doi ten/thua khoang trang o
   Danh muc se lam sai logic bo qua cong doan May / hien khoi "Giao viec noi bo"). Additive, idempotent -
   an toan chay lai nhieu lan va khong anh huong du lieu hien co. */
USE QLNoiBo;
GO

IF COL_LENGTH('NhaGiaCong', 'LaNoiBo') IS NULL
BEGIN
    ALTER TABLE NhaGiaCong ADD LaNoiBo BIT NOT NULL DEFAULT 0;
END
GO

-- Danh dau dong "Nha Lam" hien co (seed tu schema.sql) la LaNoiBo = 1. Idempotent: chi set lai neu
-- dang la 0, khong gay loi/thay doi gi neu chay lai lan nua.
UPDATE NhaGiaCong SET LaNoiBo = 1 WHERE TenNha = N'Nhà Làm' AND LaNoiBo = 0;
GO

PRINT 'Hoan tat migration v5.8.';
GO
