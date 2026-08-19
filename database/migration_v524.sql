/* ================================================================
   migration_v524.sql - Nang cap tu v5.23 len v5.24

   Dot sua tiep theo tren cong doan "Giao gia cong", theo phan hoi truc tiep
   cua nguoi dung ve viec v5.21-v5.23 tao ra NHIEU noi trung nhau cho CUNG 1
   nghiep vu (chon kenh san xuat, giao nha gia cong):

   1.1.1 - Ky thuat: them "Don gia Giao gia cong" (nhieu dong, giong het co
           che "Don gia cong doan may" - danh muc HangMucGiaCong + bang
           DonHangHangMucGiaCong luu rieng cho tung don hang).
   1.3   - Cong doan "Giao gia cong": tu RADIO (chon 1 trong 2) doi thanh 2
           CHECKBOX doc lap "Giao nha lam"/"Giao gia cong" - co the tick CA
           HAI (don hang chia mot phan lam noi bo, mot phan thue ngoai) hoac
           chi 1 trong 2.
         - Neu tick "Giao gia cong": BO o "Nha gia cong (dai dien)" (chi con
           1 co che DUY NHAT - "Nha gia cong chi tiet", them cot So luong
           (dung tinh luong sau nay) - KHONG con o "Don gia gia cong" rieng
           (moi dong nha gia cong da co don gia rieng).
         - Bo tab "Giao nha gia cong" (chuc nang con rieng trong Quan ly san
           xuat) - viec giao nha gia cong gio HOAN TOAN lam ngay tai cong
           doan "Giao gia cong" trong Ghi nhan tien do, khong con 2 noi song
           song lam CUNG 1 viec nua.
         - Neu tick "Giao nha lam": hien bang cong doan may DA nhap o Ky
           thuat de THAM KHAO (ten/don gia/he so) - viec chon NHAN VIEN + SL
           van CHI lam o cong doan May nhu tu truoc (KHONG doi - xac nhan
           qua cau hoi lam ro voi nguoi dung, tranh trung lap them 1 lan
           nua o ca 2 noi).
         - "Nhan nha gia cong": con lai CHI la man hinh XEM (khong con nut
           "Ghi nhan" rieng, khong con cot "Tong da nhan" o danh sach) - hien
           dung nha gia cong + so luong da duoc gan o "Giao gia cong".

   Doi mo hinh du lieu: DonHangSanXuat.KenhSanXuat (chuoi don, 'NhaLam'/
   'GiaCong', them o migration_v521.sql) THAY BANG 2 cot BIT doc lap
   DaGiaoNhaLam/DaGiaoGiaCong (ho tro tick CA HAI). KenhSanXuat GIU NGUYEN
   (khong xoa cot - "mo coi", dung backfill 1 lan cho du lieu cu, khong con
   noi nao ghi/doc nua tu sau migration nay).

   Bang moi: HangMucGiaCong (danh muc), DonHangHangMucGiaCong (rieng tung
   don hang - mirror dung cap CongDoanMay/DonHangCongDoanMay da co san).
   Cot moi: DonHangSanXuat.DaGiaoNhaLam, DonHangSanXuat.DaGiaoGiaCong;
   DonHangChiTietNhaGiaCong.SoLuong.

   SUA LAI o v5.25 (CHUA TUNG deploy nen sua truc tiep file nay, khong tao
   file moi): BO ChucNang 'dongiagiacong' - man hinh danh muc rieng "Đơn giá
   gia công" bi xoa theo phan hoi nguoi dung ("không cần thêm chức năng đơn
   giá gia công"), hang muc gia cong MOI them truc tiep qua nut "+ Mới" ngay
   tai Ky thuat, gate lai theo ChucNang 'tiendo' co san (xem qlsx.js).

   YEU CAU TIEN QUYET: da chay migration_v513.sql (DonHangChiTietNhaGiaCong),
   migration_v521.sql (KenhSanXuat), migration_v523.sql (cong doan GC) tu
   truoc.

   An toan chay lai nhieu lan (idempotent).
   ================================================================ */

USE QLNoiBo;
GO

IF OBJECT_ID('DonHangChiTietNhaGiaCong') IS NULL
BEGIN
    RAISERROR(N'Khong tim thay bang DonHangChiTietNhaGiaCong - can chay migration_v513.sql truoc khi chay migration nay.', 16, 1);
    RETURN;
END
IF COL_LENGTH('DonHangSanXuat', 'KenhSanXuat') IS NULL
BEGIN
    RAISERROR(N'Khong tim thay cot DonHangSanXuat.KenhSanXuat - can chay migration_v521.sql truoc khi chay migration nay.', 16, 1);
    RETURN;
END
GO

/* ---------- 1: DaGiaoNhaLam / DaGiaoGiaCong - thay the KenhSanXuat (don gia tri) bang 2 co doc lap ---------- */
IF COL_LENGTH('DonHangSanXuat', 'DaGiaoNhaLam') IS NULL
BEGIN
    ALTER TABLE DonHangSanXuat ADD DaGiaoNhaLam BIT NOT NULL DEFAULT 0;
    PRINT N'Da them cot DonHangSanXuat.DaGiaoNhaLam.';
END ELSE PRINT N'Cot DonHangSanXuat.DaGiaoNhaLam da ton tai, bo qua.';
GO
IF COL_LENGTH('DonHangSanXuat', 'DaGiaoGiaCong') IS NULL
BEGIN
    ALTER TABLE DonHangSanXuat ADD DaGiaoGiaCong BIT NOT NULL DEFAULT 0;
    PRINT N'Da them cot DonHangSanXuat.DaGiaoGiaCong.';
END ELSE PRINT N'Cot DonHangSanXuat.DaGiaoGiaCong da ton tai, bo qua.';
GO

-- Backfill 1 lan tu KenhSanXuat (don da tung mo "Giao gia cong"/'KT' truoc day) va tu suy luan
-- NhaGiaCongID/LaNoiBoNhaGiaCong cho don CU HON nua (truoc ca v5.21, KenhSanXuat con NULL). Mac dinh
-- "chua ro" -> DaGiaoNhaLam=1 (giu dung quy uoc cu "chua giao ai thi coi nhu Nha Lam" tu v5.0).
UPDATE DonHangSanXuat SET DaGiaoNhaLam = 1
WHERE DaGiaoNhaLam = 0 AND DaGiaoGiaCong = 0
  AND (KenhSanXuat = N'NhaLam' OR (KenhSanXuat IS NULL AND NOT (NhaGiaCongID IS NOT NULL AND LaNoiBoNhaGiaCong = 0)));
UPDATE DonHangSanXuat SET DaGiaoGiaCong = 1
WHERE KenhSanXuat = N'GiaCong' OR (KenhSanXuat IS NULL AND NhaGiaCongID IS NOT NULL AND LaNoiBoNhaGiaCong = 0);
PRINT N'Da backfill DaGiaoNhaLam/DaGiaoGiaCong tu KenhSanXuat (cot nay tu nay khong con noi nao ghi/doc nua - "mo coi", khong xoa).';
GO

/* ---------- 2: So luong tren Nha gia cong chi tiet (dung tinh luong, nhap ngay tai Giao gia cong) ---------- */
IF COL_LENGTH('DonHangChiTietNhaGiaCong', 'SoLuong') IS NULL
BEGIN
    ALTER TABLE DonHangChiTietNhaGiaCong ADD SoLuong INT NULL;
    PRINT N'Da them cot DonHangChiTietNhaGiaCong.SoLuong.';
END ELSE PRINT N'Cot DonHangChiTietNhaGiaCong.SoLuong da ton tai, bo qua.';
GO

/* ---------- 3: Danh muc "Hang muc gia cong" + bang rieng tung don hang - mirror dung cap
   CongDoanMay/DonHangCongDoanMay da co san cho "cong doan may" ---------- */
IF OBJECT_ID('HangMucGiaCong') IS NULL
BEGIN
    CREATE TABLE HangMucGiaCong (
        HangMucGiaCongID INT IDENTITY(1,1) PRIMARY KEY,
        TenHangMuc       NVARCHAR(200) NOT NULL,
        DonGiaMacDinh     DECIMAL(14,2) NULL,
        HeSoMacDinh       DECIMAL(10,4) NOT NULL DEFAULT 1,
        GhiChu            NVARCHAR(255) NULL,
        CreatedAt         DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT UQ_HangMucGiaCong_Ten UNIQUE (TenHangMuc)
    );
    PRINT N'Da tao bang HangMucGiaCong.';
END ELSE PRINT N'Bang HangMucGiaCong da ton tai, bo qua.';
GO

IF OBJECT_ID('DonHangHangMucGiaCong') IS NULL
BEGIN
    CREATE TABLE DonHangHangMucGiaCong (
        ID                INT IDENTITY(1,1) PRIMARY KEY,
        DonHangID         INT NOT NULL FOREIGN KEY REFERENCES DonHangSanXuat(DonHangID) ON DELETE CASCADE,
        HangMucGiaCongID  INT NOT NULL FOREIGN KEY REFERENCES HangMucGiaCong(HangMucGiaCongID),
        DonGia            DECIMAL(14,2) NULL,
        HeSo              DECIMAL(10,4) NOT NULL DEFAULT 1,
        CreatedAt         DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT UQ_DonHangHangMucGiaCong UNIQUE (DonHangID, HangMucGiaCongID)
    );
    PRINT N'Da tao bang DonHangHangMucGiaCong.';
END ELSE PRINT N'Bang DonHangHangMucGiaCong da ton tai, bo qua.';
GO

/* ---------- 4: (v5.25 - da BO, xem ghi chu dau file) ChucNang 'dongiagiacong' KHONG con can nua - man
   hinh danh muc rieng "Đơn giá gia công" bi xoa (chua bao gio co ham render, tab se loi ReferenceError
   neu bam vao) theo phan hoi nguoi dung "không cần thêm chức năng đơn giá gia công". Hang muc gia cong
   MOI gio them truc tiep qua nut "+ Mới" ngay tai Ky thuat (POST /hangmucgiacong, gate lai theo ChucNang
   'tiendo' co san - xem qlsx.js), khong can ChucNang rieng nao ca. ---------- */

PRINT N'migration_v524.sql hoan tat.';
GO
