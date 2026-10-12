/* ================================================================================================
   migration_v878.sql   (v8.85)
   MAU VAN BAN NHAN SU — cho phep tu sua noi dung mau in
   ------------------------------------------------------------------------------------------------
   Nguyen: "cac mau lien quan den nhan su them chuc nang sua file mau de chu dong".
   Truoc day 6 mau in (HDLD chinh thuc / HD thu viec / QD tang luong / QD chung / Phu luc / Thanh ly)
   deu GHI CUNG trong module.hrm.js — doi mot cau chu cung phai sua code, copy file, restart.

   Them 2 bang:
     1. MauVanBanHRM         — noi dung mau dang dung
     2. MauVanBanHRM_LichSu  — cac ban truoc do, de quay lai khi sua hong

   ⚠️ CO Y KHONG SEED NOI DUNG MAU VAO DAY
   Ban goc cua 6 mau nam trong module.hrm.js va DUOC GIU LAI lam luoi an toan:
     - Bang trong / chua chay migration  -> in bang mau goc trong code, moi thu chay y nhu cu.
     - Nguoi dung sua hong               -> nut "Khoi phuc mau goc" ghi de lai bang ban trong code.
   Seed vao CSDL se tao ra BAN SAO THU HAI cua cung mot noi dung: sua code thi CSDL khong doi theo,
   sua CSDL thi code khong doi theo — som muon hai ban troi khoi nhau va khong ai biet ban nao dung.

   ⚠️ DAY LA CHO DUY NHAT trong he thong nguoi dung nhap NOI DUNG roi he thong dem HIEN THI NGUYEN
   TRANG. Backend PHAI loc the nguy hiem (script / iframe / on* / javascript:) truoc khi luu —
   xem routes/hrm.js, ham locMauAnToan().

   Chay:  SSMS tren database QLNoiBo
   Sau do: pm2 restart qlnoibo + Ctrl+F5
   ================================================================================================ */

USE QLNoiBo;
GO

IF DB_NAME() <> N'QLNoiBo'
BEGIN
    RAISERROR (N'!! DANG KHONG O DATABASE QLNoiBo. Chon dung database roi chay lai.', 20, 1) WITH LOG;
    SET NOEXEC ON;
END
GO

PRINT '=== migration_v878: mau van ban nhan su ===';
GO

/* ---------------- 1. Mau dang dung ----------------
   MaMau khop voi khoa trong MAU_GOC o module.hrm.js — doi ben nay phai doi ben kia.
   NoiDung: NVARCHAR(MAX) vi mau hop dong chinh thuc dai hon 8000 ky tu. */
IF OBJECT_ID('MauVanBanHRM') IS NULL
BEGIN
    CREATE TABLE MauVanBanHRM (
        MaMau       NVARCHAR(50) NOT NULL PRIMARY KEY,
        TenMau      NVARCHAR(150) NULL,
        NoiDung     NVARCHAR(MAX) NOT NULL,
        PhienBan    INT NOT NULL DEFAULT 1,
        NguoiSuaID  INT NULL FOREIGN KEY REFERENCES Users(UserID),
        CapNhatLuc  DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    PRINT '  + Bang MauVanBanHRM';
END
ELSE PRINT '  = Bang MauVanBanHRM da co';
GO

/* ---------------- 2. Lich su cac ban truoc ----------------
   Moi lan luu mot ban moi, ban CU duoc day vao day. Backend giu 10 ban gan nhat moi mau
   (xem routes/hrm.js, hang GIU_LICH_SU) — khong gioi han thi bang nay phinh theo so lan sua. */
IF OBJECT_ID('MauVanBanHRM_LichSu') IS NULL
BEGIN
    CREATE TABLE MauVanBanHRM_LichSu (
        LichSuID    INT IDENTITY(1,1) PRIMARY KEY,
        MaMau       NVARCHAR(50) NOT NULL,
        NoiDung     NVARCHAR(MAX) NOT NULL,
        PhienBan    INT NOT NULL,
        NguoiSuaID  INT NULL FOREIGN KEY REFERENCES Users(UserID),
        CapNhatLuc  DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    CREATE INDEX IX_MauVanBanHRM_LichSu_Ma ON MauVanBanHRM_LichSu(MaMau, LichSuID DESC);
    PRINT '  + Bang MauVanBanHRM_LichSu';
END
ELSE PRINT '  = Bang MauVanBanHRM_LichSu da co';
GO

/* ---------------- 3. DANG KY CHUC NANG 'mauvanban' VAO MA TRAN PHAN QUYEN ----------------
   Tab moi trong getTabs() ma khong them mot dong o day la khong ai tick/bo tick duoc trong man
   "Ma tran phan quyen" — danh sach chuc nang o man do doc tu BANG ChucNang, khong doc tu frontend.
   (Bai hoc v8.70: deploy xong Nguyen bao "phan quyen khong co khuyen mai".)

   MaChucNang PHAI khop TUNG KY TU voi key cua tab trong frontend/js/module.hrm.js: 'mauvanban'.
   MacDinhCho khong truyen -> DEFAULT 1, giong moi tab khac cua HRM. Muon chan thi vao bo tick.
   Idempotent: chay lai nhieu lan deu an toan. */
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ChucNang')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM ChucNang WHERE ModuleCode = N'HRM' AND MaChucNang = N'mauvanban')
    BEGIN
        DECLARE @tt INT = (SELECT ISNULL(MAX(ThuTu), 0) + 1 FROM ChucNang WHERE ModuleCode = N'HRM');
        INSERT INTO ChucNang (ModuleCode, MaChucNang, TenChucNang, ThuTu)
        VALUES (N'HRM', N'mauvanban', N'Mau van ban', @tt);
        PRINT '  + ChucNang HRM/mauvanban';
    END
    ELSE PRINT '  = ChucNang HRM/mauvanban da co';
END
ELSE PRINT '  = Chua co bang ChucNang, bo qua phan quyen theo chuc nang';
GO

/* ---------------- 4. DOI CHIEU SAU KHI CHAY ----------------
   Ca hai = 0 la dung: chua ai sua mau nao, moi ban in van dung mau goc trong code. */
PRINT '';
PRINT '--- Doi chieu (ca hai phai = 0 ngay sau khi chay) ---';
SELECT COUNT(*) AS SoMauDaSua FROM MauVanBanHRM;
SELECT COUNT(*) AS SoBanLichSu FROM MauVanBanHRM_LichSu;
GO

PRINT '';
PRINT '=== migration_v878 XONG ===';
PRINT 'Mau goc van nam trong module.hrm.js. Bang nay chi giu BAN DA SUA.';
PRINT 'Nut "Khoi phuc mau goc" o man Mau van ban se xoa dong tuong ung -> quay ve ban trong code.';
GO
