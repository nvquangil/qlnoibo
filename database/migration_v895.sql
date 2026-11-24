/* ==================================================================================================
   migration_v895.sql — v9.67: SAN LUONG THEO LENH SAN XUAT -> THUONG THEO SAN PHAM TU DONG (Nguyen 16/11/2026)
   --------------------------------------------------------------------------------------------------
   Nguyen 16/11: "Ky hop dong co nhan vien tra thuong theo kieu san pham. Phan chi dinh san xuat them truong
   nhan vien may mau, chon trong list nhan vien. Phan tinh luong se cap nhat tu day." · "Them chuc nang cap
   nhat anh video gan theo lenh san xuat — so luong anh, video theo danh muc trong ky hop dong KPI theo san
   pham (SL x don gia), phan tinh luong se cap nhat tu day, khong phai cap nhat tay."

   Cach lam:
     1. DonHangSanXuat.NhanVienMayMauID — nguoi MAY MAU cua lenh (FK NhanVien). Luu o lenh (Chi dinh SX / Sua lenh).
     2. Bang SanLuongTheoLenh — MOI dong = mot nguoi lam mot loai san pham cho mot lenh (SL, ngay).
        Nguon = 'MayMau' (tu dong tu cot tren, 1 dong / lenh, SL = 1, Ngay = NgayDat cua lenh) hoac 'Tay'
        (tab "San luong theo lenh": anh, video, ... go SL). TenSanPham phai KHOP ten trong HopDongSanPham cua
        hop dong hieu luc thi moi co don gia — don gia KHONG luu o day, bo tinh luong tra tu hop dong luc tinh
        (sua don gia o hop dong la thang sau tu dung; dong khong khop ten = 0 dong + canh bao o tab KPI).
     3. ChucNang QLSX/sanluong — tab moi.

   🔴 Moi lenh gac IF — chay lai nhieu lan an toan. Sau khi chay: pm2 restart qlnoibo.
   ================================================================================================== */
PRINT '=== migration_v895: san luong theo lenh SX -> thuong san pham tu dong (v9.67) ===';
GO

/* ---------- 1. DonHangSanXuat.NhanVienMayMauID ---------- */
IF COL_LENGTH('DonHangSanXuat', 'NhanVienMayMauID') IS NULL
BEGIN
    ALTER TABLE DonHangSanXuat ADD NhanVienMayMauID INT NULL;
    PRINT '  + DonHangSanXuat.NhanVienMayMauID';
END ELSE PRINT '  = DonHangSanXuat.NhanVienMayMauID da co';
GO
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_DonHangSanXuat_NhanVienMayMau')
BEGIN
    ALTER TABLE DonHangSanXuat WITH CHECK ADD CONSTRAINT FK_DonHangSanXuat_NhanVienMayMau
        FOREIGN KEY (NhanVienMayMauID) REFERENCES NhanVien(NhanVienID);
    PRINT '  + FK_DonHangSanXuat_NhanVienMayMau';
END ELSE PRINT '  = FK_DonHangSanXuat_NhanVienMayMau da co';
GO

/* ---------- 2. SanLuongTheoLenh ----------
   FK DonHangID ON DELETE CASCADE: xoa lenh thi dong san luong di theo (routes/qlsx.js DELETE /orders do FK luc chay,
   bang CASCADE xep vao nhom "xoa kem"). FK NhanVienID NO ACTION: nhan vien co san luong thi khong xoa duoc ho so. */
IF OBJECT_ID('SanLuongTheoLenh') IS NULL
BEGIN
    CREATE TABLE SanLuongTheoLenh (
        ID          INT IDENTITY(1,1) PRIMARY KEY,
        DonHangID   INT NOT NULL FOREIGN KEY REFERENCES DonHangSanXuat(DonHangID) ON DELETE CASCADE,
        NhanVienID  INT NOT NULL FOREIGN KEY REFERENCES NhanVien(NhanVienID),
        TenSanPham  NVARCHAR(150) NOT NULL,        -- khop HopDongSanPham.TenSanPham (khong phan biet hoa/thuong)
        SoLuong     DECIMAL(12,2) NOT NULL DEFAULT 0,
        Ngay        DATE NOT NULL,                 -- quyet dinh THANG tinh luong
        Nguon       NVARCHAR(10) NOT NULL DEFAULT N'Tay',   -- 'MayMau' | 'Tay'
        GhiChu      NVARCHAR(255) NULL,
        NguoiTaoID  INT NULL,
        CreatedAt   DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        UpdatedAt   DATETIME2 NULL
    );
    CREATE INDEX IX_SanLuongTheoLenh_DH ON SanLuongTheoLenh(DonHangID);
    CREATE INDEX IX_SanLuongTheoLenh_NV_Ngay ON SanLuongTheoLenh(NhanVienID, Ngay);
    PRINT '  + bang SanLuongTheoLenh';
END ELSE PRINT '  = bang SanLuongTheoLenh da co';
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_SanLuongTheoLenh_Nguon')
BEGIN
    ALTER TABLE SanLuongTheoLenh WITH CHECK ADD CONSTRAINT CK_SanLuongTheoLenh_Nguon CHECK (Nguon IN (N'MayMau', N'Tay'));
    PRINT '  + CK_SanLuongTheoLenh_Nguon';
END ELSE PRINT '  = CK_SanLuongTheoLenh_Nguon da co';
GO

/* ---------- 3. ChucNang: QLSX/sanluong (quan ly ghi ho / ra soat) + MYPAY/sanluongcuatoi (nhan vien TU ghi cho minh
   trong "Bang luong cua toi"; chi hien khi hop dong kieu SanPham).
   Nguyen 16/11: "Ghi san luong MAC DINH KHONG CO, phan quyen ai co quyen moi hien thi" => CA HAI MacDinhCho = 0 (nang luc
   phai TICK moi co, nhu QLSX/xemtatca, HOPDONG/kyso): loadUserContext tu dien canView=false khi chua co dong cau hinh
   -> tab/muc an + API 403; Quan tri -> Phan quyen tick cho nhom (hoac ghi de rieng cho nguoi) moi hien. Admin thay san. */
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ChucNang') AND COL_LENGTH('ChucNang', 'MacDinhCho') IS NOT NULL
BEGIN
    MERGE ChucNang AS t
    USING (VALUES ('QLSX', 'sanluong', N'Sản lượng theo lệnh (ảnh, video, may mẫu) — phải tick mới có', 15, 0),
                  ('MYPAY', 'sanluongcuatoi', N'Sản lượng theo lệnh của tôi (tự ghi ảnh / video) — phải tick mới có', 2, 0)) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu, MacDinhCho)
    ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
    WHEN MATCHED THEN UPDATE SET MacDinhCho = 0, TenChucNang = s.TenChucNang
    WHEN NOT MATCHED THEN INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu, MacDinhCho) VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu, s.MacDinhCho);
    PRINT '  + ChucNang QLSX/sanluong, MYPAY/sanluongcuatoi (MacDinhCho = 0: phai tick)';
END
ELSE IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ChucNang')
BEGIN
    PRINT '  ! ChucNang chua co cot MacDinhCho (migration_v684) — chay v684 truoc, roi chay lai file nay';
END
GO
PRINT '=== migration_v895 xong. pm2 restart qlnoibo ===';
GO
