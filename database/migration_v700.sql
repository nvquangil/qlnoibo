/* ================================================================================================
   migration_v700.sql   (v8.00)
   NHOM CHAM CONG  ->  bang NhomChamCong + NhanVien.NhomChamCongID

   Nguyen: "Cai dat cham cong: them gop theo nhom. moi nhom cai gio ra gio vao khac nhau. cai dat
   gio xong ap dung cho tung nhom. moi nhom tu gan nhan vien vao."

   BOI CANH. Cau hinh cham cong hien la MOT BAN DUY NHAT toan cong ty: bang CauHinh, khoa
   'CHAM_CONG', gia tri la JSON (xem CC_DEFAULT trong routes/payroll.js). Xuong co nhieu ca gio khac
   nhau => ai lech ca thi SO CONG tinh sai, phai sua tay tung ngay.

   VI SAO BANG RIENG chu khong dung Bo phan (NhanVien.BoPhanID) san co.
   Nhom CA LAM khac Bo phan: mot bo phan co the chay 2 ca, hai bo phan co the chung 1 ca. Ngoai ra
   Bo phan dang duoc payroll dung cho viec khac (loc bp.TenBoPhan = N'Cat' de tinh nang suat cat) —
   nhoi them y nghia ca lam vao do la buoc hai viec khong lien quan phai doi cung nhau.
   Nguyen da chot: gan nhan vien RIENG theo nhom.

   THU TU UU TIEN khi tinh cong (gop trong getCfgChamCongTheoNhom, routes/payroll.js):

       CC_DEFAULT  <-  cau hinh CHUNG (CauHinh khoa 'CHAM_CONG')  <-  cau hinh NHOM

   Nhom chi can khai nhung gi KHAC (thuong la gioVao/gioRa); o nao de trong thi roi ve cau hinh
   chung. Nhan vien CHUA gan nhom -> dung y nguyen cau hinh chung => du lieu dang chay KHONG doi
   hanh vi, khong phai gan lai 200 nguoi truoc khi dung duoc.

   ⚠️ ngayLe (ngay le/tet) GIU O CAP CONG TY, nhom KHONG duoc ghi de — le la le chung. Ham gop cau
   hinh co y lay ngayLe tu cau hinh chung bat ke nhom khai gi.

   ⚠️ DOI GIO CUA NHOM KHONG TU TINH LAI THANG DA CHOT. ChamCongNgay la du lieu DA LUU. Muon ap gio
   moi phai bam lai "Tong hop tu may -> bang cong", va lenh do chi ghi de dong Nguon='May', GIU
   NGUYEN dong da sua tay (Nguon='ThuCong').

   CauHinh cua nhom luu JSON CUNG SHAPE voi CC_DEFAULT -> dung lai nguyen duong chuan hoa dang chay,
   khong sinh shape thu hai.

   Idempotent — chay lai nhieu lan khong loi.
   ================================================================================================ */
IF DB_NAME() <> N'QLNoiBo'
BEGIN
    RAISERROR (N'!! DANG KHONG O DATABASE QLNoiBo. Chon dung database roi chay lai.', 20, 1) WITH LOG;
    SET NOEXEC ON;
END
GO

IF OBJECT_ID('NhomChamCong', 'U') IS NULL
BEGIN
    CREATE TABLE NhomChamCong (
        NhomID     INT IDENTITY(1,1) PRIMARY KEY,
        TenNhom    NVARCHAR(100) NOT NULL,
        CauHinh    NVARCHAR(MAX) NULL,      -- JSON, cung shape CC_DEFAULT; NULL = theo cau hinh chung
        GhiChu     NVARCHAR(255) NULL,
        CreatedAt  DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    PRINT '  + Bang NhomChamCong';
END
ELSE PRINT '  = Bang NhomChamCong da co';
GO

IF COL_LENGTH('NhanVien', 'NhomChamCongID') IS NULL
BEGIN
    ALTER TABLE NhanVien ADD NhomChamCongID INT NULL
        FOREIGN KEY REFERENCES NhomChamCong(NhomID);
    PRINT '  + NhanVien.NhomChamCongID (NULL = chua gan nhom -> theo cau hinh chung)';
END
ELSE PRINT '  = NhanVien.NhomChamCongID da co';
GO

/* Xoa nhom thi nhan vien phai ve NULL (khong xoa nguoi). FK o tren khong dat ON DELETE SET NULL vi
   SQL Server can cot nullable + khong duoc dinh vao chuoi cascade khac; route DELETE
   /chamcong/nhom/:id da tu UPDATE NhanVien SET NhomChamCongID = NULL truoc khi xoa. */

PRINT '';
PRINT '=== migration_v700 XONG ===';
PRINT 'Cach dung: Tinh luong -> Cham cong -> nut "Nhom cham cong":';
PRINT '  1) Them nhom (vd "Ca ngay", "Ca dem")';
PRINT '  2) Bam "Cai gio" tren dong nhom do -> khai gio vao/gio ra rieng';
PRINT '  3) Bam "Gan nhan vien" -> tich nhung nguoi thuoc nhom';
PRINT '  4) Bam "Tong hop tu may -> bang cong" de tinh lai theo gio moi';
PRINT 'Nguoi chua gan nhom van tinh theo "Cai dat cham cong" chung nhu truoc.';
PRINT 'PHAI chay migration TRUOC roi moi pm2 restart qlnoibo (ham do cot co CACHE theo tien trinh).';
PRINT '';
