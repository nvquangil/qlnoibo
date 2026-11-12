/* ==================================================================================================
   migration_v890.sql — v9.45: LUONG CONG NHAT THEO BANG THUC TE (Nguyen 11/11/2026)
   --------------------------------------------------------------------------------------------------
   Bo tinh cong nhat v6.1 (viet tu luong.xlsm thang 7) SAI MO HINH so voi bang luong thuc te T10/2026:
   thuc te co HAI mo hinh (luong NGAY cho cong nhan, luong THANG co thu viec x0.85 cho van phong),
   KHONG tinh thue TNCN, BH tren MUC DONG RIENG, OT = luong co ban / gio mot ngay x 1.5, co KPI /
   thuong theo san pham / chuc vu / chuyen can. Xem docs/PRD_v945_luong_cong_nhat_theo_bang_thuc_te.md.

   Thong so luong nam tren HOP DONG (Nguyen: "ky hop dong co lua chon theo KPI hay theo SP").
   Cac cot v8.82 (PhuCapChuyenCan, PhuCapChucVu, QuyKPI, SoCongXangXe, TyLeThuViec) truoc day CHI DE
   IN — tu v9.45 bang luong DOC chung. Them 6 cot thieu + 3 bang moi + cot snapshot o BangLuongChiTiet.

   🔴 Moi ALTER duoc gac COL_LENGTH — chay lai nhieu lan an toan.
   🔴 CHECK constraint nam o BATCH RIENG sau GO (bai hoc v9.36: CHECK cung batch voi ALTER ADD => huy
      ca batch vi cot chua ton tai luc bien dich).
   🔴 Sau khi chay: pm2 restart. hrm.js / payroll.js do cot rieng tung lan (khong cache) nen chua
      restart cung khong vo, nhung restart cho sach.
   ================================================================================================== */
PRINT '=== migration_v890: luong cong nhat theo bang thuc te (v9.45) ===';
GO

/* ---------- 1. HopDongLaoDong: 6 cot thong so luong con thieu ---------- */
IF COL_LENGTH('HopDongLaoDong', 'KieuLuong') IS NULL
BEGIN
    -- 'Thang' (luong thang chia cong chuan) | 'Ngay' (don gia ngay x so ngay). NULL = 'Thang' (tuong thich nguoc).
    ALTER TABLE HopDongLaoDong ADD KieuLuong NVARCHAR(10) NULL;
    PRINT '  + HopDongLaoDong.KieuLuong';
END ELSE PRINT '  = HopDongLaoDong.KieuLuong da co';
GO
IF COL_LENGTH('HopDongLaoDong', 'DonGiaNgay') IS NULL
BEGIN
    ALTER TABLE HopDongLaoDong ADD DonGiaNgay DECIMAL(14,2) NULL;     -- dung khi KieuLuong = 'Ngay'
    PRINT '  + HopDongLaoDong.DonGiaNgay';
END ELSE PRINT '  = HopDongLaoDong.DonGiaNgay da co';
GO
IF COL_LENGTH('HopDongLaoDong', 'MucDongBH') IS NULL
BEGIN
    -- 🔴 BH 10,5% tinh tren cot NAY, KHONG tren LuongCoBan: bang thuc te dong tren 5,56tr/6tr/8tr/5,31tr
    -- bat ke luong. NULL hoac 0 = KHONG dong BH (36 nguoi luong ngay phan lon khong dong).
    ALTER TABLE HopDongLaoDong ADD MucDongBH DECIMAL(14,2) NULL;
    PRINT '  + HopDongLaoDong.MucDongBH';
END ELSE PRINT '  = HopDongLaoDong.MucDongBH da co';
GO
IF COL_LENGTH('HopDongLaoDong', 'LuongCoDinhThang') IS NULL
BEGIN
    -- Co gia tri = GHI DE luong thang bat ke so cong (O Tam: 10tr/thang du 31 ngay). Hiem, nhung co that.
    ALTER TABLE HopDongLaoDong ADD LuongCoDinhThang DECIMAL(14,2) NULL;
    PRINT '  + HopDongLaoDong.LuongCoDinhThang';
END ELSE PRINT '  = HopDongLaoDong.LuongCoDinhThang da co';
GO
IF COL_LENGTH('HopDongLaoDong', 'NgayHetThuViec') IS NULL
BEGIN
    -- Ngay <= NgayHetThuViec huong TyLeThuViec (85%). NULL = khong co thu viec. Cung mot thang co the
    -- co ca ngay thu viec lan chinh thuc (Lan KTT T10: 16 TV + 9,5 CT).
    ALTER TABLE HopDongLaoDong ADD NgayHetThuViec DATE NULL;
    PRINT '  + HopDongLaoDong.NgayHetThuViec';
END ELSE PRINT '  = HopDongLaoDong.NgayHetThuViec da co';
GO
IF COL_LENGTH('HopDongLaoDong', 'KieuThuong') IS NULL
BEGIN
    -- 'KPI' (QuyKPI x diem/100 x cong/CC, diem tu bang DanhGiaKPI) | 'SanPham' (tong SL x don gia
    -- tu ThuongSanPhamThang) | NULL = khong co thuong.
    ALTER TABLE HopDongLaoDong ADD KieuThuong NVARCHAR(10) NULL;
    PRINT '  + HopDongLaoDong.KieuThuong';
END ELSE PRINT '  = HopDongLaoDong.KieuThuong da co';
GO
-- CHECK o batch rieng (cot phai ton tai luc bien dich).
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_HopDongLaoDong_KieuLuong')
BEGIN
    ALTER TABLE HopDongLaoDong WITH CHECK
      ADD CONSTRAINT CK_HopDongLaoDong_KieuLuong CHECK (KieuLuong IS NULL OR KieuLuong IN (N'Thang', N'Ngay'));
    PRINT '  + CK_HopDongLaoDong_KieuLuong';
END ELSE PRINT '  = CK_HopDongLaoDong_KieuLuong da co';
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_HopDongLaoDong_KieuThuong')
BEGIN
    ALTER TABLE HopDongLaoDong WITH CHECK
      ADD CONSTRAINT CK_HopDongLaoDong_KieuThuong CHECK (KieuThuong IS NULL OR KieuThuong IN (N'KPI', N'SanPham'));
    PRINT '  + CK_HopDongLaoDong_KieuThuong';
END ELSE PRINT '  = CK_HopDongLaoDong_KieuThuong da co';
GO

/* ---------- 2. HopDongSanPham: danh muc san pham + don gia cua MOT hop dong (KieuThuong='SanPham') ----------
   Nguyen: "nguoi co the nhieu sp, moi san pham 1 don gia". Vi du Huong Media: anh 20.000 / video 50.000. */
IF OBJECT_ID('HopDongSanPham') IS NULL
BEGIN
    CREATE TABLE HopDongSanPham (
        ID          INT IDENTITY(1,1) PRIMARY KEY,
        HopDongID   INT NOT NULL FOREIGN KEY REFERENCES HopDongLaoDong(HopDongID) ON DELETE CASCADE,
        TenSanPham  NVARCHAR(150) NOT NULL,
        DonGia      DECIMAL(14,2) NOT NULL DEFAULT 0,
        ThuTu       INT NOT NULL DEFAULT 0
    );
    CREATE INDEX IX_HopDongSanPham_HD ON HopDongSanPham(HopDongID);
    PRINT '  + bang HopDongSanPham';
END ELSE PRINT '  = bang HopDongSanPham da co';
GO

/* ---------- 3. DanhGiaKPI: diem KPI thang cua tung nguoi (0..100, Nguyen: "100 diem toi da") ---------- */
IF OBJECT_ID('DanhGiaKPI') IS NULL
BEGIN
    CREATE TABLE DanhGiaKPI (
        ID             INT IDENTITY(1,1) PRIMARY KEY,
        NhanVienID     INT NOT NULL FOREIGN KEY REFERENCES NhanVien(NhanVienID) ON DELETE CASCADE,
        Nam            INT NOT NULL,
        Thang          INT NOT NULL,
        DiemKPI        DECIMAL(5,2) NOT NULL DEFAULT 0,
        -- Co gia tri = GHI DE so tien thuong KPI thang do (Lan KTT T10: 26,5 cong ma van huong tron 8tr —
        -- quyet dinh cua chu, khong phai cong thuc). NULL = tinh theo cong thuc.
        TienGhiDe      DECIMAL(14,2) NULL,
        NhanXet        NVARCHAR(500) NULL,
        NguoiDanhGiaID INT NULL FOREIGN KEY REFERENCES Users(UserID),
        UpdatedAt      DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT UQ_DanhGiaKPI UNIQUE (NhanVienID, Nam, Thang)
    );
    PRINT '  + bang DanhGiaKPI';
END ELSE PRINT '  = bang DanhGiaKPI da co';
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_DanhGiaKPI_Diem')
BEGIN
    ALTER TABLE DanhGiaKPI WITH CHECK ADD CONSTRAINT CK_DanhGiaKPI_Diem CHECK (DiemKPI >= 0 AND DiemKPI <= 100);
    PRINT '  + CK_DanhGiaKPI_Diem';
END ELSE PRINT '  = CK_DanhGiaKPI_Diem da co';
GO

/* ---------- 4. ThuongSanPhamThang: so luong tung san pham trong thang (KieuThuong='SanPham') ----------
   TenSanPham + DonGia la BAN CHUP tai thoi diem nhap (doi don gia tren hop dong khong hoi to thang cu). */
IF OBJECT_ID('ThuongSanPhamThang') IS NULL
BEGIN
    CREATE TABLE ThuongSanPhamThang (
        ID          INT IDENTITY(1,1) PRIMARY KEY,
        NhanVienID  INT NOT NULL FOREIGN KEY REFERENCES NhanVien(NhanVienID) ON DELETE CASCADE,
        Nam         INT NOT NULL,
        Thang       INT NOT NULL,
        TenSanPham  NVARCHAR(150) NOT NULL,
        DonGia      DECIMAL(14,2) NOT NULL DEFAULT 0,
        SoLuong     DECIMAL(12,2) NOT NULL DEFAULT 0,
        GhiChu      NVARCHAR(255) NULL,
        UpdatedAt   DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    ALTER TABLE ThuongSanPhamThang ADD ThanhTien AS (SoLuong * DonGia) PERSISTED;
    CREATE INDEX IX_ThuongSanPhamThang_NV ON ThuongSanPhamThang(NhanVienID, Nam, Thang);
    PRINT '  + bang ThuongSanPhamThang';
END ELSE PRINT '  = bang ThuongSanPhamThang da co';
GO

/* ---------- 5. CauHinhLuong: 4 cong tac moi ---------- */
IF COL_LENGTH('CauHinhLuong', 'TruThueTNCN') IS NULL
BEGIN
    -- 🔴 Mac dinh 0: ca hai bang thuc te KHONG tru thue. Thue van duoc TINH va HIEN (Nguyen: "de san"),
    -- bat cong tac nay moi tru vao thuc linh.
    ALTER TABLE CauHinhLuong ADD TruThueTNCN BIT NOT NULL DEFAULT 0;
    PRINT '  + CauHinhLuong.TruThueTNCN';
END ELSE PRINT '  = CauHinhLuong.TruThueTNCN da co';
GO
IF COL_LENGTH('CauHinhLuong', 'TyLeThuViec') IS NULL
BEGIN
    ALTER TABLE CauHinhLuong ADD TyLeThuViec DECIMAL(5,2) NOT NULL DEFAULT 85;   -- %, dung khi hop dong khong khai
    PRINT '  + CauHinhLuong.TyLeThuViec';
END ELSE PRINT '  = CauHinhLuong.TyLeThuViec da co';
GO
IF COL_LENGTH('CauHinhLuong', 'LamTronThucLinh') IS NULL
BEGIN
    ALTER TABLE CauHinhLuong ADD LamTronThucLinh INT NOT NULL DEFAULT 1000;      -- bang thuc te lam tron NGHIN
    PRINT '  + CauHinhLuong.LamTronThucLinh';
END ELSE PRINT '  = CauHinhLuong.LamTronThucLinh da co';
GO
IF COL_LENGTH('CauHinhLuong', 'DiMuonChamChuocPhut') IS NULL
BEGIN
    -- Di muon = gio vao > gio vao cau hinh cham cong + so phut nay. Mot ngay muon la mat chuyen can.
    ALTER TABLE CauHinhLuong ADD DiMuonChamChuocPhut INT NOT NULL DEFAULT 5;
    PRINT '  + CauHinhLuong.DiMuonChamChuocPhut';
END ELSE PRINT '  = CauHinhLuong.DiMuonChamChuocPhut da co';
GO

/* ---------- 6. BangLuongChiTiet: cot snapshot moi (TangCa = tien OT, Thuong = tien KPI/san pham da co san) ---------- */
IF COL_LENGTH('BangLuongChiTiet', 'KieuLuong') IS NULL         BEGIN ALTER TABLE BangLuongChiTiet ADD KieuLuong NVARCHAR(10) NULL;          PRINT '  + BLCT.KieuLuong'; END
GO
IF COL_LENGTH('BangLuongChiTiet', 'DonGiaNgay') IS NULL        BEGIN ALTER TABLE BangLuongChiTiet ADD DonGiaNgay DECIMAL(14,2) NULL;        PRINT '  + BLCT.DonGiaNgay'; END
GO
IF COL_LENGTH('BangLuongChiTiet', 'CongThuViec') IS NULL       BEGIN ALTER TABLE BangLuongChiTiet ADD CongThuViec DECIMAL(6,2) NULL;        PRINT '  + BLCT.CongThuViec'; END
GO
IF COL_LENGTH('BangLuongChiTiet', 'CongChinhThuc') IS NULL     BEGIN ALTER TABLE BangLuongChiTiet ADD CongChinhThuc DECIMAL(6,2) NULL;      PRINT '  + BLCT.CongChinhThuc'; END
GO
IF COL_LENGTH('BangLuongChiTiet', 'SoPhep') IS NULL            BEGIN ALTER TABLE BangLuongChiTiet ADD SoPhep DECIMAL(6,2) NULL;             PRINT '  + BLCT.SoPhep'; END
GO
IF COL_LENGTH('BangLuongChiTiet', 'SoNgayMuon') IS NULL        BEGIN ALTER TABLE BangLuongChiTiet ADD SoNgayMuon INT NULL;                  PRINT '  + BLCT.SoNgayMuon'; END
GO
IF COL_LENGTH('BangLuongChiTiet', 'GioOT') IS NULL             BEGIN ALTER TABLE BangLuongChiTiet ADD GioOT DECIMAL(7,2) NULL;              PRINT '  + BLCT.GioOT'; END
GO
IF COL_LENGTH('BangLuongChiTiet', 'DonGiaGioOT') IS NULL       BEGIN ALTER TABLE BangLuongChiTiet ADD DonGiaGioOT DECIMAL(14,2) NULL;       PRINT '  + BLCT.DonGiaGioOT'; END
GO
IF COL_LENGTH('BangLuongChiTiet', 'PcChucVu') IS NULL          BEGIN ALTER TABLE BangLuongChiTiet ADD PcChucVu DECIMAL(14,2) NULL;          PRINT '  + BLCT.PcChucVu'; END
GO
IF COL_LENGTH('BangLuongChiTiet', 'ChuyenCan') IS NULL         BEGIN ALTER TABLE BangLuongChiTiet ADD ChuyenCan DECIMAL(14,2) NULL;         PRINT '  + BLCT.ChuyenCan'; END
GO
IF COL_LENGTH('BangLuongChiTiet', 'DieuChinh') IS NULL         BEGIN ALTER TABLE BangLuongChiTiet ADD DieuChinh DECIMAL(14,2) NULL;         PRINT '  + BLCT.DieuChinh'; END
GO
IF COL_LENGTH('BangLuongChiTiet', 'LyDoDieuChinh') IS NULL     BEGIN ALTER TABLE BangLuongChiTiet ADD LyDoDieuChinh NVARCHAR(255) NULL;     PRINT '  + BLCT.LyDoDieuChinh'; END
GO
IF COL_LENGTH('BangLuongChiTiet', 'MucDongBH') IS NULL         BEGIN ALTER TABLE BangLuongChiTiet ADD MucDongBH DECIMAL(14,2) NULL;         PRINT '  + BLCT.MucDongBH'; END
GO
IF COL_LENGTH('BangLuongChiTiet', 'DiemKPI') IS NULL           BEGIN ALTER TABLE BangLuongChiTiet ADD DiemKPI DECIMAL(5,2) NULL;            PRINT '  + BLCT.DiemKPI'; END
GO
IF COL_LENGTH('BangLuongChiTiet', 'KieuThuong') IS NULL        BEGIN ALTER TABLE BangLuongChiTiet ADD KieuThuong NVARCHAR(10) NULL;         PRINT '  + BLCT.KieuThuong'; END
GO
IF COL_LENGTH('BangLuongChiTiet', 'ThueDaTru') IS NULL         BEGIN ALTER TABLE BangLuongChiTiet ADD ThueDaTru BIT NOT NULL DEFAULT 0;     PRINT '  + BLCT.ThueDaTru'; END
GO

/* ---------- 7. ChucNang: tab Danh gia KPI / san pham ---------- */
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ChucNang')
BEGIN
    MERGE ChucNang AS t
    USING (VALUES ('PAYROLL', 'kpi', N'Đánh giá KPI / sản phẩm', 8)) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu)
    ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
    WHEN NOT MATCHED THEN INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu) VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu);
    PRINT '  + ChucNang PAYROLL/kpi';
END
GO
PRINT '=== migration_v890 xong. pm2 restart qlnoibo ===';
GO
