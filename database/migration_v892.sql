/* ==================================================================================================
   migration_v892.sql — v9.55: NGHI PHEP / LICH NGHI LE CHUNG / LICH NGHI CA NHAN / KHONG PHEP /
                        THUONG CHUYEN CAN BAC THANG (Nguyen 14/11/2026)
   --------------------------------------------------------------------------------------------------
   Nguyen 14/11: "Ky hop dong: kieu thuong them phan chuyen can — tu tao danh sach chuyen can (28 cong
   300k, 30 cong 50k)" · "Tao phieu nghi phep chon nhan vien, chon ngay nghi -> dua vao bang luong, chu ky
   nguoi xin nghi + truong bo phan" · "Luong cong nhat them cot Khong phep" · "Cham cong: lich nghi le
   chung ca cong ty; lich nghi khong luong / thai san / tai nan tung ca nhan".
   Anh chot (14/11): bac chuyen can = CHI NHAN BAC CAO NHAT dat duoc (moi bac la so tong), thay the phu cap
   chuyen can co dinh; phep (P) van KHONG luong; ngay le chung KHONG cong (chi la ngay nghi).

   🔴 Moi lenh gac IF — chay lai nhieu lan an toan. CHECK sua o batch rieng sau GO (bai hoc v9.36).
   🔴 Sau khi chay: pm2 restart (payroll.js / hrm.js do bang/cot tung lan, nhung restart cho sach).
   ================================================================================================== */
PRINT '=== migration_v892: nghi phep / le chung / khong phep / chuyen can bac thang (v9.55) ===';
GO

/* ---------- 1. HopDongChuyenCan: bac thang thuong chuyen can cua MOT hop dong (KieuThuong='ChuyenCan') ----------
   Moi dong: dat >= SoCong thi huong DUNG TienThuong cua bac do. Bo tinh lay BAC CAO NHAT co SoCong <= cong di lam
   (TV + CT + le huong luong, KHONG tinh phep), KHONG cong don. Nguyen chot: dat 28 cong thuong 300.000, dat 30 cong
   thuong 500.000 (nguoi 30 cong nhan 500.000, khong phai 800.000). */
IF OBJECT_ID('HopDongChuyenCan') IS NULL
BEGIN
    CREATE TABLE HopDongChuyenCan (
        ID          INT IDENTITY(1,1) PRIMARY KEY,
        HopDongID   INT NOT NULL FOREIGN KEY REFERENCES HopDongLaoDong(HopDongID) ON DELETE CASCADE,
        SoCong      DECIMAL(5,1) NOT NULL,
        TienThuong  DECIMAL(14,2) NOT NULL DEFAULT 0,
        ThuTu       INT NOT NULL DEFAULT 0
    );
    CREATE INDEX IX_HopDongChuyenCan_HD ON HopDongChuyenCan(HopDongID);
    PRINT '  + bang HopDongChuyenCan';
END ELSE PRINT '  = bang HopDongChuyenCan da co';
GO

/* ---------- 2. KieuThuong nhan them 'ChuyenCan' (CHECK v890 chi cho KPI / SanPham) ---------- */
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_HopDongLaoDong_KieuThuong')
BEGIN
    ALTER TABLE HopDongLaoDong DROP CONSTRAINT CK_HopDongLaoDong_KieuThuong;
    PRINT '  - CK_HopDongLaoDong_KieuThuong (cu: KPI/SanPham)';
END
GO
ALTER TABLE HopDongLaoDong WITH CHECK
  ADD CONSTRAINT CK_HopDongLaoDong_KieuThuong CHECK (KieuThuong IS NULL OR KieuThuong IN (N'KPI', N'SanPham', N'ChuyenCan'));
PRINT '  + CK_HopDongLaoDong_KieuThuong (KPI/SanPham/ChuyenCan)';
GO

/* ---------- 3. NgayLeChung: lich nghi le chung ca cong ty ----------
   Thay cho o "Ngay le / Tet" go tay trong Cai dat cham cong (CauHinh.CHAM_CONG.ngayLe). Lan dau mo lich,
   payroll.js tu chep cac ngay da go o cau hinh cu sang bang nay (code, khong SQL — JSON trong CauHinh).
   Nguyen chot: le chung KHONG cong (chi la ngay nghi: khong tinh "khong phep", OT ngay do van vao cot Le/Tet). */
IF OBJECT_ID('NgayLeChung') IS NULL
BEGIN
    CREATE TABLE NgayLeChung (
        ID        INT IDENTITY(1,1) PRIMARY KEY,
        Ngay      DATE NOT NULL UNIQUE,
        TenLe     NVARCHAR(100) NULL,
        GhiChu    NVARCHAR(255) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    PRINT '  + bang NgayLeChung';
END ELSE PRINT '  = bang NgayLeChung da co';
GO

/* ---------- 4. PhieuNghi: phieu nghi phep (P) + lich nghi ca nhan (KL khong luong / TS thai san / TN tai nan) ----------
   Mot bang cho ca hai: cung du lieu (ai, tu ngay, den ngay, loai, ly do). Luu xong, payroll.js GHI tung ngay
   lam viec trong khoang (bo CN + le chung) vao ChamCongNgay voi MaCham = Loai, SoCong = 0, Nguon = N'PhieuNghi'
   — bang luong doc ChamCongNgay nhu cu (P -> cot Phep; KL/TS/TN -> khong cong khong luong).
   Ngay co quet may (Nguon='May') thi MAY thang (nguoi di lam som hon phieu). Dong sua tay (ThuCong) cung thang.
   SoNgay = so ngay lam viec trong khoang (de in phieu), NguoiDuyet = ten truong bo phan ky phieu. */
IF OBJECT_ID('PhieuNghi') IS NULL
BEGIN
    CREATE TABLE PhieuNghi (
        PhieuNghiID INT IDENTITY(1,1) PRIMARY KEY,
        SoPhieu     NVARCHAR(20) NULL,
        NhanVienID  INT NOT NULL FOREIGN KEY REFERENCES NhanVien(NhanVienID),
        Loai        NVARCHAR(5) NOT NULL,              -- P | KL | TS | TN
        TuNgay      DATE NOT NULL,
        DenNgay     DATE NOT NULL,
        SoNgay      DECIMAL(5,1) NOT NULL DEFAULT 0,
        LyDo        NVARCHAR(255) NULL,
        NguoiDuyet  NVARCHAR(100) NULL,
        GhiChu      NVARCHAR(255) NULL,
        NguoiTaoID  INT NULL FOREIGN KEY REFERENCES Users(UserID),
        CreatedAt   DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        UpdatedAt   DATETIME2 NULL
    );
    CREATE INDEX IX_PhieuNghi_NV ON PhieuNghi(NhanVienID, TuNgay);
    CREATE INDEX IX_PhieuNghi_Ngay ON PhieuNghi(TuNgay, DenNgay);
    PRINT '  + bang PhieuNghi';
END ELSE PRINT '  = bang PhieuNghi da co';
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_PhieuNghi_Loai')
BEGIN
    ALTER TABLE PhieuNghi WITH CHECK ADD CONSTRAINT CK_PhieuNghi_Loai CHECK (Loai IN (N'P', N'KL', N'TS', N'TN'));
    PRINT '  + CK_PhieuNghi_Loai';
END ELSE PRINT '  = CK_PhieuNghi_Loai da co';
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_PhieuNghi_Ngay')
BEGIN
    ALTER TABLE PhieuNghi WITH CHECK ADD CONSTRAINT CK_PhieuNghi_Ngay CHECK (DenNgay >= TuNgay);
    PRINT '  + CK_PhieuNghi_Ngay';
END ELSE PRINT '  = CK_PhieuNghi_Ngay da co';
GO

/* ---------- 5. BangLuongChiTiet.SoKhongPhep: so ngay lam viec khong co cham cong, khong phep, khong nghi co ly do ----------
   Ngay lam viec = T2..T7, tru CN, tru le chung, tu ngay vao lam, toi hom nay (thang hien tai). Chi de xem/doi chieu,
   KHONG tru tien (chuyen can da mat vi thieu cong). */
IF COL_LENGTH('BangLuongChiTiet', 'SoKhongPhep') IS NULL
BEGIN
    ALTER TABLE BangLuongChiTiet ADD SoKhongPhep DECIMAL(6,2) NULL;
    PRINT '  + BLCT.SoKhongPhep';
END ELSE PRINT '  = BLCT.SoKhongPhep da co';
GO

/* ---------- 6. ChucNang: tab "Tạo giấy nghỉ phép / Nghỉ cá nhân" (v9.57 — Nguyen 14/11: tach thanh chuc nang rieng
   duoi Tinh luong). Khong co dong cau hinh = duoc phep (auth.js requireChucNang); dong nay de Quan tri -> Phan quyen
   co the CAM rieng tab nay cho mot nhom. ---------- */
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ChucNang')
BEGIN
    MERGE ChucNang AS t
    USING (VALUES ('PAYROLL', 'nghiphep', N'Tạo giấy nghỉ phép / Nghỉ cá nhân', 9)) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu)
    ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
    WHEN NOT MATCHED THEN INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu) VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu);
    PRINT '  + ChucNang PAYROLL/nghiphep';
END
GO
PRINT '=== migration_v892 xong. pm2 restart qlnoibo ===';
GO
