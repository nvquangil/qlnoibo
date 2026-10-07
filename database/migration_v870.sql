/* ================================================================================================
   MIGRATION v8.70 - CHUONG TRINH KHUYEN MAI (thay the %CK Shop theo thoi gian)

   Nguyen chot 2026-10-06:
     "hien tai dang co Ty le chiet khau dung chung: CK shop (%). Trong tao chuong trinh khuyen mai
      thi danh TONG PHAN TRAM CK cho tung ma hang. Vi du dang CK shop la 33% thi khi tao c.trinh
      khuyen mai danh 35%, vay trong phieu ban hang se the hien 35% voi nhung ma hang duoc gan.
      Het thoi gian khuyen mai tro ve ty le chiet khau dung chung."

   ------------------------------------------------------------------------------------------------
   ⚠️ BAN CHAT: chuong trinh THAY THE %CKShop cho ma duoc gan, KHONG phai mot % cong them.
   => CONG THUC TINH TIEN GIU NGUYEN 100%, khong sua mot dong nao:
          GiaBan = GiaBanLe - GiaBanLe * %CKShop/100
      Chuong trinh chi quyet dinh %CKShop cua dong do la 33 hay 35.

   => "Het thoi gian tro ve ty le dung chung" KHONG PHAI VIET THEM GI: het han thi khong tra ra
      chuong trinh nao, %CKShop lay tu CauHinhHeThong nhu cu.

   ⚠️ TEN COT LA PhanTramCK, KHONG PHAI PhanTramKM. Day la TONG %CK THAY THE. Dat ten "KM" la
   nguoi sua sau de cong nham no vao %CKShop.
   ------------------------------------------------------------------------------------------------

   ⚠️ KHONG DUNG LAI TheKhoHangHoa.PhanTramCKShop / PhanTramCKNPP (co san tu v6.20):
   Hai cot do la mot lan thu TRUOC DAY cho %CK theo TUNG MA HANG va DA BI BO (xem ghi chu trong
   migration_v667: "Cach do DA BO. 2 cot nay KHONG con duoc doc/ghi"). Khai niem cung khac han:
   do la %CK VINH VIEN theo ma hang, con day la %CK CO THOI HAN theo chuong trinh. Dung lai 2 cot
   do la lam song lai mot thiet ke da bi loai bo, va khong luu duoc thoi gian hieu luc.

   ------------------------------------------------------------------------------------------------
   AN TOAN: cot moi tren PhieuBanHangChiTiet la NULL, khong DEFAULT, khong backfill.
   ChuongTrinhID = NULL nghia la dong ban theo CK dung chung -> MOI PHIEU CU KHONG DOI MOT SO NAO.
   Con so %CK that VAN nam o PhieuBanHangChiTiet.PhanTramCKShop nhu truoc - cot do von duoc luu
   theo TUNG DONG, nen phieu da lap giu nguyen % du chuong trinh bi sua/tam dung/xoa ve sau.

   Khoa ngoai de NO ACTION (mac dinh): xoa chuong trinh da co phieu dung se bi DB chan. Tang ung
   dung phai kiem TRUOC va bao bang tieng nguoi (bai hoc v8.55).

   CHAY 1 LAN. Chay xong PHAI pm2 restart qlnoibo.
   ================================================================================================ */

/* ---------- 1. Chuong trinh khuyen mai ---------- */
IF OBJECT_ID('ChuongTrinhKhuyenMai') IS NULL
BEGIN
    CREATE TABLE ChuongTrinhKhuyenMai (
        ID              INT IDENTITY(1,1) PRIMARY KEY,
        TenChuongTrinh  NVARCHAR(200) NOT NULL,
        TuNgay          DATE NOT NULL,
        DenNgay         DATE NOT NULL,
        PhanTramCK      DECIMAL(5,2) NOT NULL,   -- TONG %CK thay the (35 = 35%, KHONG phai 0.35)
        TrangThai       NVARCHAR(20) NOT NULL DEFAULT N'Hoạt động',  -- 'Hoạt động' / 'Tạm dừng'
        GhiChu          NVARCHAR(500) NULL,
        NguoiTaoID      INT NULL FOREIGN KEY REFERENCES Users(UserID),
        CreatedAt       DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        UpdatedAt       DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    CREATE INDEX IX_CTKM_ThoiGian ON ChuongTrinhKhuyenMai (TuNgay, DenNgay);
    PRINT N'Da tao bang ChuongTrinhKhuyenMai.';
END ELSE PRINT N'Bang ChuongTrinhKhuyenMai da ton tai, bo qua.';
GO

/* ---------- 2. Ma hang tham gia chuong trinh ----------
   PhanTramCK de NULL = dung % cua chuong trinh. Co o ca hai cap de khai mot lan cho ca chuong
   trinh, ma nao dac biet thi de rieng - khong co no thi moi muc % phai tao mot chuong trinh. */
IF OBJECT_ID('ChuongTrinhKhuyenMaiChiTiet') IS NULL
BEGIN
    CREATE TABLE ChuongTrinhKhuyenMaiChiTiet (
        ID             INT IDENTITY(1,1) PRIMARY KEY,
        ChuongTrinhID  INT NOT NULL FOREIGN KEY REFERENCES ChuongTrinhKhuyenMai(ID) ON DELETE CASCADE,
        MaHangID       INT NOT NULL FOREIGN KEY REFERENCES TheKhoHangHoa(MaHangID),
        PhanTramCK     DECIMAL(5,2) NULL,
        CONSTRAINT UQ_CTKMChiTiet UNIQUE (ChuongTrinhID, MaHangID)
    );
    CREATE INDEX IX_CTKMChiTiet_MaHang ON ChuongTrinhKhuyenMaiChiTiet (MaHangID);
    PRINT N'Da tao bang ChuongTrinhKhuyenMaiChiTiet.';
END ELSE PRINT N'Bang ChuongTrinhKhuyenMaiChiTiet da ton tai, bo qua.';
GO

/* ---------- 3. Dong phieu ban hang: ghi lai dong do ban theo chuong trinh nao ----------
   CHI DE HIEN THI TEN CHUONG TRINH. Con so %CK that van o PhanTramCKShop nhu truoc. */
IF COL_LENGTH('PhieuBanHangChiTiet', 'ChuongTrinhID') IS NULL
BEGIN
    ALTER TABLE PhieuBanHangChiTiet ADD ChuongTrinhID INT NULL
        FOREIGN KEY REFERENCES ChuongTrinhKhuyenMai(ID);
    PRINT N'Da them cot PhieuBanHangChiTiet.ChuongTrinhID.';
END ELSE PRINT N'Cot PhieuBanHangChiTiet.ChuongTrinhID da ton tai, bo qua.';
GO

/* ---------- 4. DANG KY CHUC NANG 'khuyenmai' VAO MA TRAN PHAN QUYEN ----------
   ⚠️ THIEU BUOC NAY THI TAB KHONG BAO GIO HIEN TRONG "Ma tran phan quyen" (Nguyen bao 2026-10-06:
   "da deploy nhung phan quyen khong co khuyen mai"). Danh sach chuc nang o man phan quyen KHONG
   doc tu code frontend - no doc tu BANG ChucNang. Tab moi trong getTabs() ma khong them mot dong
   o day la khong ai tick/bo tick duoc, du middleware requireChucNang da chay.
   => Tu nay: THEM TAB MOI = THEM MOT DONG ChucNang trong CUNG migration.

   MaChucNang PHAI khop TUNG KY TU voi `key` cua tab trong frontend/js/module.khohang.js
   (key: 'khuyenmai') va voi hang CN trong backend/routes/khuyenmai.js (CN = 'khuyenmai').

   MacDinhCho khong truyen -> lay DEFAULT 1 (ai co quyen xem phan he Kho hang thi co tab nay,
   giong moi tab khac cua KHOHANG). Muon chan bot thi vao Ma tran phan quyen bo tick.

   Idempotent: chay lai ca file nay nhieu lan deu an toan. */
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ChucNang')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM ChucNang WHERE ModuleCode = N'KHOHANG' AND MaChucNang = N'khuyenmai')
    BEGIN
        DECLARE @tt INT = (SELECT ISNULL(MAX(ThuTu), 0) + 1 FROM ChucNang WHERE ModuleCode = N'KHOHANG');
        INSERT INTO ChucNang (ModuleCode, MaChucNang, TenChucNang, ThuTu)
        VALUES (N'KHOHANG', N'khuyenmai', N'Chương trình khuyến mãi', @tt);
        PRINT N'  + ChucNang KHOHANG/khuyenmai.';
    END
    ELSE PRINT N'  = ChucNang KHOHANG/khuyenmai da co.';
END
ELSE PRINT N'  = Chua co bang ChucNang, bo qua phan quyen theo chuc nang.';
GO

PRINT N'migration_v870.sql hoan tat. NHO: pm2 restart qlnoibo.';
GO

/* ================================================================================================
   KIEM TRA - chay file database/kiem_tra_v870.sql (file rieng, thuan ASCII).
   ================================================================================================ */
