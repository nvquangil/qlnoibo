/* ================================================================
   MIGRATION v5.31 — Fix cot DonHangChiTietVai (loi tao don hang) + Kieu vai o Phieu xuat kho + bo GNGC/NNGC
   ----------------------------------------------------------------
   1. FIX LOI "Invalid column name 'GhiChu'" khi tao/luu lenh san xuat: dam bao DonHangChiTietVai co du
      cac cot v5.27.1 (TenLoaiVaiTuDo / TenMauTuDo / GhiChu, MauSacID nullable). Loi xay ra khi da deploy
      code v5.27.1 nhung DB moi chi chay migration_v527 ban CU (chi co TenLoaiVaiTuDo). Doan nay lap lai
      y het migration_v527 (idempotent) - chay v531 la du de het loi, khong can tim lai v527.
   2. Phieu xuat kho vai: them cot KieuVai (Chính/Phối) cho tung cay tren phieu xuat.
   3. (Cong doan GNGC/NNGC cu - neu con trong CongDoanSanXuat cua DB - se duoc AN o tang code, khong xoa
      dong DB de tranh loi khoa ngoai/lich su; xem MA_CONG_DOAN_BO_QUA trong qlsx.js + loc dropdown.)

   Chay 1 lan. IDEMPOTENT.
   ================================================================ */
USE QLNoiBo;
GO

/* ---------------- 1. FIX cot DonHangChiTietVai (v5.27.1) ---------------- */
IF COL_LENGTH('dbo.DonHangChiTietVai','TenLoaiVaiTuDo') IS NULL
    ALTER TABLE DonHangChiTietVai ADD TenLoaiVaiTuDo NVARCHAR(150) NULL;
IF COL_LENGTH('dbo.DonHangChiTietVai','TenMauTuDo') IS NULL
    ALTER TABLE DonHangChiTietVai ADD TenMauTuDo NVARCHAR(100) NULL;
IF COL_LENGTH('dbo.DonHangChiTietVai','GhiChu') IS NULL
    ALTER TABLE DonHangChiTietVai ADD GhiChu NVARCHAR(255) NULL;
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.DonHangChiTietVai') AND name = 'MauSacID' AND is_nullable = 0)
    ALTER TABLE DonHangChiTietVai ALTER COLUMN MauSacID INT NULL;
GO

/* ---------------- 2. Phieu xuat kho vai: cot KieuVai (Chính/Phối) ---------------- */
IF COL_LENGTH('dbo.PhieuXuatVaiChiTiet','KieuVai') IS NULL
    ALTER TABLE PhieuXuatVaiChiTiet ADD KieuVai NVARCHAR(10) NULL;   -- Chính / Phối (NULL = coi nhu Chính)
GO

PRINT '=== migration_v531.sql hoan tat (fix DonHangChiTietVai + KieuVai phieu xuat kho) ===';
GO
