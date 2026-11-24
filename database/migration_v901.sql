/* ==================================================================================================
   migration_v901.sql — v9.75: HANG KY GUI (Nguyen 17/11/2026: "xuat hang ky gui cho khach theo gia ban nguyen gia,
   hop dong chiet khau 12% cho so luong khach ban duoc; khach thanh toan tu tru 12%; ~30 khach, moi khach nhieu mat hang").

   NGHIEP VU (VAS: hang gui ban = TK 157, VAN LA TON KHO cua minh):
     Xuat ky gui   -> PhieuKyGui: KHONG doanh thu, KHONG cong no, KHONG tru XuatCai (hang van la ton kho, chi bot KHA DUNG
                      — cam vao layHangDangGiu nhu don khach dat dang giu).
     Khach bao ban -> PHIEU BAN HANG THAT (PhieuBanHang, CK NPP = % ky gui cua khach): tru ton + cong no + doanh thu nhu moi
                      phieu ban; moi dong ghi KyGuiCTID tro ve dong ky gui -> "da bao ban".
     Khach tra lai -> PhieuKyGuiTra: chi giam "con o khach"; khong chung tu kho nao (hang chua bao gio roi so ton).
     Con o khach   = SoLuongCai − SUM(bao ban, phieu ban chua huy) − SUM(tra, phieu tra chua huy).
   => Moi bao cao tien/doanh thu/lai/cong no DUNG THEO CAU TRUC (khong doc bang moi), khong phai nho loc o dau ca.

   Bang moi: PhieuKyGui, PhieuKyGuiChiTiet, PhieuKyGuiTra, PhieuKyGuiTraChiTiet.
   Cot moi : PhieuBanHangChiTiet.KyGuiCTID (lien ket bao ban), KhachHang.PhanTramCKKyGui (% CK ky gui mac dinh cua khach).
   ChucNang: KHOHANG/kygui (tab "Hàng ký gửi", mac dinh co).
   🔴 KhachHang.PhanTramCKKyGui duoc crudFactory ghi KHONG do cot -> PHAI chay file nay TRUOC pm2 restart, khong thi
      them/sua khach hang loi "Invalid column name".
   🔴 Gac IF — chay lai an toan. Sau khi chay: pm2 restart qlnoibo.
   ================================================================================================== */
PRINT '=== migration_v901: hang ky gui (v9.75) ===';
GO

/* ---------- 1. PhieuKyGui ---------- */
IF OBJECT_ID('PhieuKyGui') IS NULL
BEGIN
    CREATE TABLE PhieuKyGui (
        PhieuKGID    INT IDENTITY(1,1) PRIMARY KEY,
        SoPhieu      NVARCHAR(30)  NOT NULL UNIQUE,        -- KG + yy + 4 so
        Ngay         DATE          NOT NULL,
        KhachHangID  INT           NULL FOREIGN KEY REFERENCES KhachHang(KhachHangID),
        TenKhach     NVARCHAR(150) NOT NULL,               -- cung khoa voi PhieuBanHang.TenKhach (cong no gom theo TEN)
        PhanTramCK   DECIMAL(5,2)  NOT NULL DEFAULT 0,     -- % CK ky gui (chup luc lap; bao ban lay tu day)
        GhiChu       NVARCHAR(500) NULL,
        TrangThai    NVARCHAR(20)  NOT NULL DEFAULT N'Hoàn thành',   -- 'Hoàn thành' | 'Đã hủy'
        NguoiTaoID   INT           NULL FOREIGN KEY REFERENCES Users(UserID),
        CreatedAt    DATETIME2     NOT NULL DEFAULT SYSDATETIME(),
        NguoiSuaID   INT           NULL,
        UpdatedAt    DATETIME2     NULL
    );
    CREATE INDEX IX_PhieuKyGui_Khach ON PhieuKyGui(TenKhach, Ngay);
    PRINT '  + PhieuKyGui';
END ELSE PRINT '  = PhieuKyGui da co';
GO

/* ---------- 2. PhieuKyGuiChiTiet ---------- */
IF OBJECT_ID('PhieuKyGuiChiTiet') IS NULL
BEGIN
    CREATE TABLE PhieuKyGuiChiTiet (
        ID           INT IDENTITY(1,1) PRIMARY KEY,
        PhieuKGID    INT NOT NULL FOREIGN KEY REFERENCES PhieuKyGui(PhieuKGID) ON DELETE CASCADE,
        MaHangID     INT NOT NULL FOREIGN KEY REFERENCES TheKhoHangHoa(MaHangID),
        MauSacID     INT NOT NULL FOREIGN KEY REFERENCES MauSac(MauSacID),   -- bat buoc mau: kho quan theo mau
        SoLuongCai   INT NOT NULL,
        GiaBanLe     DECIMAL(14,2) NOT NULL DEFAULT 0,     -- nguyen gia 1 cai luc gui (bao ban dung gia nay)
        GhiChu       NVARCHAR(255) NULL
    );
    CREATE INDEX IX_PhieuKyGuiChiTiet_Phieu ON PhieuKyGuiChiTiet(PhieuKGID);
    CREATE INDEX IX_PhieuKyGuiChiTiet_Hang ON PhieuKyGuiChiTiet(MaHangID, MauSacID);
    PRINT '  + PhieuKyGuiChiTiet';
END ELSE PRINT '  = PhieuKyGuiChiTiet da co';
GO

/* ---------- 3. PhieuKyGuiTra (khach tra hang chua ban) ---------- */
IF OBJECT_ID('PhieuKyGuiTra') IS NULL
BEGIN
    CREATE TABLE PhieuKyGuiTra (
        PhieuKGTID   INT IDENTITY(1,1) PRIMARY KEY,
        SoPhieu      NVARCHAR(30)  NOT NULL UNIQUE,        -- KT + yy + 4 so
        Ngay         DATE          NOT NULL,
        KhachHangID  INT           NULL FOREIGN KEY REFERENCES KhachHang(KhachHangID),
        TenKhach     NVARCHAR(150) NOT NULL,
        GhiChu       NVARCHAR(500) NULL,
        TrangThai    NVARCHAR(20)  NOT NULL DEFAULT N'Hoàn thành',
        NguoiTaoID   INT           NULL FOREIGN KEY REFERENCES Users(UserID),
        CreatedAt    DATETIME2     NOT NULL DEFAULT SYSDATETIME()
    );
    PRINT '  + PhieuKyGuiTra';
END ELSE PRINT '  = PhieuKyGuiTra da co';
GO
IF OBJECT_ID('PhieuKyGuiTraChiTiet') IS NULL
BEGIN
    CREATE TABLE PhieuKyGuiTraChiTiet (
        ID           INT IDENTITY(1,1) PRIMARY KEY,
        PhieuKGTID   INT NOT NULL FOREIGN KEY REFERENCES PhieuKyGuiTra(PhieuKGTID) ON DELETE CASCADE,
        KyGuiCTID    INT NOT NULL FOREIGN KEY REFERENCES PhieuKyGuiChiTiet(ID),
        SoLuongCai   INT NOT NULL
    );
    CREATE INDEX IX_PhieuKyGuiTraChiTiet_CT ON PhieuKyGuiTraChiTiet(KyGuiCTID);
    PRINT '  + PhieuKyGuiTraChiTiet';
END ELSE PRINT '  = PhieuKyGuiTraChiTiet da co';
GO

/* ---------- 4. PhieuBanHangChiTiet.KyGuiCTID — dong phieu ban hang sinh tu BAO BAN ky gui ---------- */
IF COL_LENGTH('PhieuBanHangChiTiet', 'KyGuiCTID') IS NULL
BEGIN
    ALTER TABLE PhieuBanHangChiTiet ADD KyGuiCTID INT NULL;
    PRINT '  + PhieuBanHangChiTiet.KyGuiCTID';
END ELSE PRINT '  = PhieuBanHangChiTiet.KyGuiCTID da co';
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PhieuBanHangChiTiet_KyGui')
BEGIN
    CREATE INDEX IX_PhieuBanHangChiTiet_KyGui ON PhieuBanHangChiTiet(KyGuiCTID) WHERE KyGuiCTID IS NOT NULL;
    PRINT '  + IX_PhieuBanHangChiTiet_KyGui';
END
GO

/* ---------- 5. KhachHang.PhanTramCKKyGui ---------- */
IF COL_LENGTH('KhachHang', 'PhanTramCKKyGui') IS NULL
BEGIN
    ALTER TABLE KhachHang ADD PhanTramCKKyGui DECIMAL(5,2) NULL;
    PRINT '  + KhachHang.PhanTramCKKyGui';
END ELSE PRINT '  = KhachHang.PhanTramCKKyGui da co';
GO

/* ---------- 6. ChucNang KHOHANG/kygui (key PHAI trung key tab o module.khohang.js getTabs) ---------- */
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ChucNang')
BEGIN
    MERGE ChucNang AS t
    USING (VALUES ('KHOHANG', 'kygui', N'Hàng ký gửi (xuất ký gửi, báo bán, trả về)', 9)) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu)
    ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
    WHEN NOT MATCHED THEN INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu) VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu);
    PRINT '  + ChucNang KHOHANG/kygui';
END
GO

PRINT '=== migration_v901 xong. pm2 restart qlnoibo ===';
GO
