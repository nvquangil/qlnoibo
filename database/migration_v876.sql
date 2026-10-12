/* ================================================================================================
   migration_v876.sql   (v8.80)
   HO SO NHAN SU: anh nhan vien + file dinh kem (PDF/anh) + danh sach NGUOI PHU THUOC
   ------------------------------------------------------------------------------------------------
   Them:
     1. NhanVien.AnhDaiDien NVARCHAR(500) NULL      -- duong dan anh chan dung
     2. Bang HoSoDinhKemNhanVien                    -- NHIEU file / 1 nhan vien, giu TEN GOC + LOAI
     3. Bang NguoiPhuThuoc                          -- giam tru gia canh, chi tiet tung nguoi
     4. Dang ky 1 ChucNang moi cho tab Nguoi phu thuoc

   KHONG dung den du lieu da co. Moi nhan vien cu: AnhDaiDien = NULL, chua co dinh kem, chua co
   nguoi phu thuoc -> man hinh va bang luong giu nguyen y het truoc khi chay file nay.

   ⚠️ VI SAO KHONG NHOI NHIEU DUONG DAN VAO 1 COT (kieu DonHangSanXuat.AnhHinhIn noi bang \n)
   Cach do dang dung cho ANH HINH IN va chay tot, nhung o day la HO SO PHAP LY: phai giu TEN GOC cua
   file (de nguoi dung biet "HDLD_NV001.pdf" khac "Phu luc HDLD.pdf"), LOAI GIAY TO, NGAY TAI va AI
   TAI. Mot cot chuoi khong cho duoc nhung thu do, va xoa 1 file giua chuoi rat de hong ca chuoi.

   ⚠️ VI SAO KHONG DOI payroll.js
   payroll.js tinh giam tru gia canh bang NhanVien.SoNguoiPhuThuoc (mot CON SO). Neu doi sang dem
   truc tiep tu bang NguoiPhuThuoc thi nguoi phu thuoc khai HOM NAY se hoi to vao BANG LUONG DA CHOT
   cua cac ky truoc. Nen: GIU cot SoNguoiPhuThuoc lam nguon tinh luong, backend tu cap nhat lai con
   so do moi khi them/sua/xoa nguoi phu thuoc. payroll.js khong phai sua mot dong nao.

   🔴 FILE HO SO LUU O THU MUC RIENG `backend/uploads_hr/`, KHONG PHAI `backend/uploads/`
   Vi /uploads duoc express.static phuc vu KHONG qua dang nhap (server.js) VA nam trong whitelist
   cong khai cua cong 80 (duocPhepCongKhai) — dat CCCD / hop dong lao dong / quyet dinh luong vao do
   la cong khai ra internet cho ai biet duong dan. uploads_hr chi doc duoc qua route co kiem quyen
   HRM (xem routes/hrm.js). CSDL chi luu TEN FILE, khong luu duong dan /uploads/...

   ⚠️ SAO LUU: thu muc backend/uploads_hr/ nam NGOAI git va KHONG di theo khi copy code C -> D.
   Sao luu no CUNG LUC voi database. Mat thu muc nay la mat hop dong / CCCD, CSDL khong phuc hoi duoc.

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

PRINT '=== migration_v876: ho so nhan su (anh / file dinh kem / nguoi phu thuoc) ===';
GO

/* ---------------- 1. Anh chan dung nhan vien ---------------- */
IF COL_LENGTH('NhanVien', 'AnhDaiDien') IS NULL
BEGIN
    ALTER TABLE NhanVien ADD AnhDaiDien NVARCHAR(500) NULL;
    PRINT '  + NhanVien.AnhDaiDien';
END
ELSE PRINT '  = NhanVien.AnhDaiDien da co';
GO

/* ---------------- 2. File dinh kem cua nhan vien ----------------
   TenFile  = ten NGUOI DUNG thay (giu nguyen ten goc khi tai len)
   TenLuu   = ten THAT tren o dia trong backend/uploads_hr/ (sinh theo moc thoi gian, khong doan duoc)
   Hai cot tach nhau de: (a) nguoi dung thay ten quen thuoc, (b) ten tren dia khong lo thong tin va
   khong trung nhau khi hai nguoi tai cung mot ten. */
IF OBJECT_ID('HoSoDinhKemNhanVien') IS NULL
BEGIN
    CREATE TABLE HoSoDinhKemNhanVien (
        DinhKemID    INT IDENTITY(1,1) PRIMARY KEY,
        NhanVienID   INT NOT NULL FOREIGN KEY REFERENCES NhanVien(NhanVienID) ON DELETE CASCADE,
        LoaiGiayTo   NVARCHAR(100) NULL,        -- CCCD / HDLD / Phu luc / Quyet dinh / Bang cap ...
        TenFile      NVARCHAR(255) NOT NULL,    -- ten goc nguoi dung tai len
        TenLuu       NVARCHAR(255) NOT NULL,    -- ten that trong backend/uploads_hr/
        KichThuoc    BIGINT NULL,               -- byte
        NgayVanBan   DATE NULL,                 -- ngay tren giay to (khong phai ngay tai len)
        GhiChu       NVARCHAR(255) NULL,
        NguoiTaiID   INT NULL FOREIGN KEY REFERENCES Users(UserID),
        CreatedAt    DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    CREATE INDEX IX_HoSoDinhKemNhanVien_NV ON HoSoDinhKemNhanVien(NhanVienID);
    PRINT '  + Bang HoSoDinhKemNhanVien';
END
ELSE PRINT '  = Bang HoSoDinhKemNhanVien da co';
GO

/* ---------------- 3. Nguoi phu thuoc ----------------
   TuThang / DenThang: ky duoc tinh giam tru (theo dang ky thue). Hien CHUA dung de tinh luong
   (xem ghi chu dau file) nhung van luu de sau nay doi chieu voi co quan thue. */
IF OBJECT_ID('NguoiPhuThuoc') IS NULL
BEGIN
    CREATE TABLE NguoiPhuThuoc (
        NPTID        INT IDENTITY(1,1) PRIMARY KEY,
        NhanVienID   INT NOT NULL FOREIGN KEY REFERENCES NhanVien(NhanVienID) ON DELETE CASCADE,
        HoTen        NVARCHAR(100) NOT NULL,
        NgaySinh     DATE NULL,
        QuanHe       NVARCHAR(50) NULL,         -- Con / Vo / Chong / Cha / Me ...
        SoGiayTo     NVARCHAR(50) NULL,         -- CCCD hoac so giay khai sinh
        MaSoThue     NVARCHAR(30) NULL,         -- MST nguoi phu thuoc
        TuThang      DATE NULL,                 -- bat dau duoc giam tru
        DenThang     DATE NULL,                 -- ket thuc (NULL = con hieu luc)
        DuHoSo       BIT NOT NULL DEFAULT 0,    -- da nop du giay to chua
        GhiChu       NVARCHAR(255) NULL,
        CreatedAt    DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    CREATE INDEX IX_NguoiPhuThuoc_NV ON NguoiPhuThuoc(NhanVienID);
    PRINT '  + Bang NguoiPhuThuoc';
END
ELSE PRINT '  = Bang NguoiPhuThuoc da co';
GO

/* ---------------- 4. KHONG dang ky ChucNang moi — CO Y ----------------
   Ban dau file nay co mot buoc INSERT vao bang ChucNang cho 'nguoiphuthuoc'. Da BO, vi hai le:

   (a) SAI TEN COT: bang ChucNang dung cot `MaChucNang`, khong phai `ChucNangCode` (xem
       CAI_DAT_DAY_DU.sql: CREATE TABLE ChucNang). Khuon chuan cua repo la MERGE ... WHEN NOT MATCHED.

   (b) THUA NGAY TU DAU — day moi la ly do chinh. ChucNang chi co nghia khi co mot TAB tuong ung do
       getTabs() tra ve o frontend va mot requireChucNang() tuong ung o backend. Nguoi phu thuoc
       KHONG phai tab rieng: no la mot khoi nam trong man Ho so nhan vien (da thuoc ChucNang 'hoso'),
       va cac route cua no gate bang requirePermission('HRM','view'/'create'/'edit'/'delete') chu
       khong co requireChucNang. Them mot dong ChucNang chi lam man Phan quyen hien ra mot muc bat/tat
       KHONG dieu khien gi — gay hieu nham cho nguoi phan quyen.

   Neu ve sau tach Nguoi phu thuoc thanh TAB RIENG thi moi can dang ky, va phai dung khuon:
       MERGE ChucNang AS t
       USING (VALUES ('HRM','nguoiphuthuoc',N'Người phụ thuộc',6)) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu)
       ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
       WHEN NOT MATCHED THEN INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu)
            VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu);
   ...kem viec them tab vao getTabs() cua module.hrm.js va requireChucNang o routes/hrm.js. */
PRINT '  = Khong dang ky ChucNang moi (Nguoi phu thuoc nam trong man Ho so, da thuoc ChucNang hoso)';
GO

/* ---------------- 5. DOI CHIEU SAU KHI CHAY ----------------
   Ca ba con so phai = 0 ngay sau khi chay (chua ai tai file / khai nguoi phu thuoc nao). */
PRINT '';
PRINT '--- Doi chieu (ca ba phai = 0 ngay sau khi chay) ---';
SELECT COUNT(*) AS SoFileDinhKem FROM HoSoDinhKemNhanVien;
SELECT COUNT(*) AS SoNguoiPhuThuoc FROM NguoiPhuThuoc;
SELECT COUNT(*) AS SoNhanVienCoAnh FROM NhanVien WHERE AnhDaiDien IS NOT NULL;
GO

/* ---------------- 6. CAU KIEM TRA DUNG VE SAU ----------------
   Dong nao hien ra o day la LECH giua bang NguoiPhuThuoc va cot SoNguoiPhuThuoc (cot dung tinh
   giam tru thue TNCN). Backend tu dong bo moi khi them/sua/xoa — co dong o day nghia la co ai do
   sua thang vao CSDL, hoac dong bo bi loi. Binh thuong phai TRONG. */
SELECT nv.NhanVienID, nv.MaNhanVien, nv.HoTen,
       ISNULL(nv.SoNguoiPhuThuoc, 0) AS SoGhiTrenHoSo,
       (SELECT COUNT(*) FROM NguoiPhuThuoc p WHERE p.NhanVienID = nv.NhanVienID) AS SoDongThucTe
FROM NhanVien nv
WHERE ISNULL(nv.SoNguoiPhuThuoc, 0)
      <> (SELECT COUNT(*) FROM NguoiPhuThuoc p WHERE p.NhanVienID = nv.NhanVienID);
GO

PRINT '';
PRINT '=== migration_v876 XONG ===';
PRINT 'Tiep theo: copy code moi -> pm2 restart qlnoibo -> Ctrl+F5.';
PRINT 'LUU Y SAO LUU: backend\uploads_hr\ chua file goc (CCCD, hop dong) — sao luu CUNG LUC voi database.';
GO
