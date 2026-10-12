/* ================================================================================================
   migration_v877.sql   (v8.82)
   BO SUNG TRUONG DE IN HOP DONG / QUYET DINH THEO DUNG MAU CUA CONG TY
   ------------------------------------------------------------------------------------------------
   Nguyen gui 3 mau thuc te (HDLD chinh thuc, HDLD thu viec, QD tang luong) va yeu cau: "nhung cho
   ... dien theo truong o man nhap lieu, neu chua co bo sung truong nhap lieu cho khop".
   Doi chieu tung cho "..." voi du lieu dang co -> con THIEU 10 truong duoi day.

   KHONG dung den du lieu cu. Moi cot deu NULL -> hop dong / quyet dinh da nhap giu nguyen, chi la
   cac o moi de trong cho toi khi ai do dien.

   ⚠️ CAC PHU CAP MOI CHI DE IN HOP DONG — KHONG TU CHAY VAO BANG LUONG
   payroll.js tinh luong theo bo phu cap CU (PhuCapAnCa / PhuCapTrangPhuc / PhuCapXangXe /
   PhuCapDienThoai). Them PhuCapChuyenCan / PhuCapChucVu / QuyKPI vao hop dong KHONG lam payroll
   tinh them dong nao. Day la CO Y: sua payroll la dung vao cac ky luong DA CHOT.
   Muon dua vao tinh luong thi la mot viec rieng, phai tinh toi ky nao bat dau ap dung.

   ⚠️ PhuCapTrangPhuc / PhuCapDienThoai VAN GIU
   Mau cua cong ty khong in hai khoan nay, nhung chung da co du lieu va payroll.js dang dung.
   Khong xoa, khong doi — chi la mau in moi khong nhac toi.

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

PRINT '=== migration_v877: truong bo sung cho mau in HRM ===';
GO

/* ---------------- 1. NhanVien: Quoc tich ----------------
   Mau HDLD co dong "Quoc tich: ...". Phan lon la 'Việt Nam' nhung van phai la o nhap, khong ghi
   cung trong mau in — cong ty may co lao dong nuoc ngoai la sai ngay. */
IF COL_LENGTH('NhanVien', 'QuocTich') IS NULL
BEGIN
    ALTER TABLE NhanVien ADD QuocTich NVARCHAR(50) NULL;
    PRINT '  + NhanVien.QuocTich';
END
ELSE PRINT '  = NhanVien.QuocTich da co';
GO

/* ---------------- 2. HopDongLaoDong: 8 cot ---------------- */
IF COL_LENGTH('HopDongLaoDong', 'NgayKy') IS NULL
BEGIN
    ALTER TABLE HopDongLaoDong ADD NgayKy DATE NULL;
    PRINT '  + HopDongLaoDong.NgayKy (dong "Ha Noi, ngay ... thang ... nam ...")';
END
ELSE PRINT '  = HopDongLaoDong.NgayKy da co';
GO

IF COL_LENGTH('HopDongLaoDong', 'QuanLyTrucTiep') IS NULL
BEGIN
    ALTER TABLE HopDongLaoDong ADD QuanLyTrucTiep NVARCHAR(100) NULL;
    PRINT '  + HopDongLaoDong.QuanLyTrucTiep (HD thu viec muc 1.2)';
END
ELSE PRINT '  = HopDongLaoDong.QuanLyTrucTiep da co';
GO

IF COL_LENGTH('HopDongLaoDong', 'PhuCapChuyenCan') IS NULL
BEGIN
    ALTER TABLE HopDongLaoDong ADD PhuCapChuyenCan DECIMAL(14,2) NULL;
    PRINT '  + HopDongLaoDong.PhuCapChuyenCan (muc 3.3a)';
END
ELSE PRINT '  = HopDongLaoDong.PhuCapChuyenCan da co';
GO

IF COL_LENGTH('HopDongLaoDong', 'PhuCapChucVu') IS NULL
BEGIN
    ALTER TABLE HopDongLaoDong ADD PhuCapChucVu DECIMAL(14,2) NULL;
    PRINT '  + HopDongLaoDong.PhuCapChucVu (muc 3.3d)';
END
ELSE PRINT '  = HopDongLaoDong.PhuCapChucVu da co';
GO

IF COL_LENGTH('HopDongLaoDong', 'QuyKPI') IS NULL
BEGIN
    ALTER TABLE HopDongLaoDong ADD QuyKPI DECIMAL(14,2) NULL;
    PRINT '  + HopDongLaoDong.QuyKPI (muc 3.3e - quy KPI tham chieu toi da/thang)';
END
ELSE PRINT '  = HopDongLaoDong.QuyKPI da co';
GO

/* SoCongXangXe / SoCongAnTrua = SO CONG CHUAN de huong DU khoan do (Nguyen chot 2026-10-10).
   Di du so cong -> huong du so tien/thang; thieu cong -> tru theo ty le.
   DECIMAL(6,2) vi co the nua cong (26.5). */
IF COL_LENGTH('HopDongLaoDong', 'SoCongXangXe') IS NULL
BEGIN
    ALTER TABLE HopDongLaoDong ADD SoCongXangXe DECIMAL(6,2) NULL;
    PRINT '  + HopDongLaoDong.SoCongXangXe (so cong CHUAN de huong du)';
END
ELSE PRINT '  = HopDongLaoDong.SoCongXangXe da co';
GO

IF COL_LENGTH('HopDongLaoDong', 'SoCongAnTrua') IS NULL
BEGIN
    ALTER TABLE HopDongLaoDong ADD SoCongAnTrua DECIMAL(6,2) NULL;
    PRINT '  + HopDongLaoDong.SoCongAnTrua (so cong CHUAN de huong du)';
END
ELSE PRINT '  = HopDongLaoDong.SoCongAnTrua da co';
GO

/* TyLeThuViec: mau HD thu viec ghi "huong 85% muc luong". De thanh O NHAP thay vi ghi cung trong
   mau in — luat cho phep thoa thuan khac (toi thieu 85%), va cong ty co the doi ty le.
   CHI ap cho LUONG CO BAN; cac khoan phu cap tinh rieng, khong nhan 85% (mau ghi ro o muc 3.3e). */
IF COL_LENGTH('HopDongLaoDong', 'TyLeThuViec') IS NULL
BEGIN
    ALTER TABLE HopDongLaoDong ADD TyLeThuViec DECIMAL(5,2) NULL;
    PRINT '  + HopDongLaoDong.TyLeThuViec (mac dinh 85, chi ap cho luong co ban)';
END
ELSE PRINT '  = HopDongLaoDong.TyLeThuViec da co';
GO

/* ---------------- 3. QuyetDinhNhanSu: Ngay ky ----------------
   Bang chi co NgayHieuLuc. Mau QD co CA HAI: dong "Ha Noi, ngay ... thang ... nam ..." (ngay ky)
   va "Thoi diem ap dung: ke tu ngay ..." (ngay hieu luc). Hai ngay nay thuong KHAC nhau. */
IF COL_LENGTH('QuyetDinhNhanSu', 'NgayKy') IS NULL
BEGIN
    ALTER TABLE QuyetDinhNhanSu ADD NgayKy DATE NULL;
    PRINT '  + QuyetDinhNhanSu.NgayKy';
END
ELSE PRINT '  = QuyetDinhNhanSu.NgayKy da co';
GO

/* ---------------- 4. DOI CHIEU SAU KHI CHAY ----------------
   Tat ca phai = 0: migration chi THEM cot rong, khong dien gi vao. */
PRINT '';
PRINT '--- Doi chieu (deu phai = 0 ngay sau khi chay) ---';
SELECT COUNT(*) AS NV_CoQuocTich FROM NhanVien WHERE QuocTich IS NOT NULL;
SELECT COUNT(*) AS HD_CoNgayKy FROM HopDongLaoDong WHERE NgayKy IS NOT NULL;
SELECT COUNT(*) AS QD_CoNgayKy FROM QuyetDinhNhanSu WHERE NgayKy IS NOT NULL;
GO

-- ---------------- 5. GOI Y DIEN NHANH DU LIEU CU (TUY CHON - KHONG TU CHAY) ----------------
-- Hop dong cu khong co ngay ky; neu muon in lai cho dep thi co the lay tam TuNgay lam ngay ky.
-- ⚠️ DAY LA SUA DU LIEU. Bo dau gach dau dong roi chay THU cau COUNT truoc; thay so hop ly moi
--    chay cau UPDATE. KHONG tu dong chay trong migration: ngay ky va ngay bat dau lam viec KHONG
--    nhat thiet trung nhau, ghi bua vao la sai ho so phap ly.
--
-- ⚠️ Dung dong comment '--' chu KHONG dung khoi /* */ cho muc nay: ben trong co chua cac cau SQL
--    mau, ma viet cap dong comment NAM TRONG mot khoi comment se DONG SOM khoi do -> phan con lai
--    thanh SQL that va chay nham. Loi nay da lam vo tao_file_cai_dat.js o v8.61.
--
--   SELECT COUNT(*) FROM HopDongLaoDong WHERE NgayKy IS NULL AND TuNgay IS NOT NULL;
--   UPDATE HopDongLaoDong SET NgayKy = TuNgay WHERE NgayKy IS NULL AND TuNgay IS NOT NULL;
--
--   SELECT COUNT(*) FROM NhanVien WHERE QuocTich IS NULL;
--   UPDATE NhanVien SET QuocTich = N'Việt Nam' WHERE QuocTich IS NULL;

PRINT '';
PRINT '=== migration_v877 XONG ===';
PRINT 'Luu y: cac phu cap moi (chuyen can / chuc vu / KPI) CHI de IN hop dong,';
PRINT '       payroll.js KHONG tu cong chung vao bang luong.';
GO
