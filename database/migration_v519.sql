/* ================================================================
   migration_v519.sql - Nang cap tu v5.18 len v5.19

   Yeu cau (dot lon nhieu muc - xem HUONG_DAN_CAI_DAT.md Buoc 2.25 de biet
   chi tiet tung muc va ly do chon giai phap):

   1.1.1 - Nha gia cong chi tiet (Ky thuat): them don gia rieng cho tung nha
           gia cong (khi khac "Nha Lam") - dung de tinh luong sau nay.
   1.1.2 - "Giao/nhan nha gia cong": tach thanh 2 chuc nang con MOI trong
           Quan ly san xuat - "Giao nha gia cong" / "Nhan nha gia cong".
           MOI chuc nang la 1 SO GHI CHEP (ledger) rieng, gan voi TUNG dong
           trong DonHangChiTietNhaGiaCong (nha gia cong chi tiet cua don) -
           KHONG dung/doi DonHangSanXuat.NhaGiaCongID/NgayGiaoGC/NgayNhanGC
           (van la nguon DUY NHAT quyet dinh bo qua cong doan May, xem
           tinhNextStage() trong qlsx.js va ghi chu tai migration_v513.sql
           dong 22-29) - man hinh "Giao/nhan nha gia cong" cu (openVendorForm,
           nut trong Danh sach lenh san xuat) VAN GIU NGUYEN de khong pha vo
           logic do; 2 chuc nang MOI la BO SUNG, phuc vu rieng viec theo doi
           SL/don gia/ghi chu THEO TUNG nha gia cong (khi 1 don co nhieu nha
           gia cong chi tiet) de tinh luong - dung SoLuong/DonGia rieng cho
           TUNG lan giao/nhan (co the giao/nhan nhieu dot).
   1.4   - "Chi dinh vai SX" (chuc nang con MOI): tai su dung CHINH DonHang
           ChiTietVai (loai vai/mau/kieu Chinh-Phoi da khai bao o Ra lenh san
           xuat) - THEM 2 cot moi (DVTVaiYeuCau/SoKGYeuCau) thay vi tao bang
           rieng, vi day la "chi dinh THEM" cho CUNG cac dong Loai vai/Mau da
           co, khong phai danh muc doc lap. KHONG dung lai cot DonViTinh co
           san (dang dung cho don vi SO LUONG SAN PHAM vd "Cai" o Ra lenh SX -
           neu dung chung se xung dot 2 y nghia tren CUNG 1 dong).

   Bang moi: GiaoNhaGiaCongChiTiet, NhanNhaGiaCongChiTiet.
   Cot moi: DonHangChiTietNhaGiaCong.DonGia; DonHangChiTietVai.DVTVaiYeuCau,
   DonHangChiTietVai.SoKGYeuCau.
   ChucNang moi (QLSX): giaonhagiacong, nhannhagiacong, chidinhvaisx.

   YEU CAU TIEN QUYET: da chay migration_v513.sql (tao DonHangChiTietNhaGiaCong)
   va migration_v5_chucnang.sql (tao bang ChucNang/ChucNangPermissions) tu
   truoc - neu chua, script se bao loi va dung lai.

   An toan chay lai nhieu lan (idempotent) - dung IF COL_LENGTH/OBJECT_ID/
   MERGE giong cac migration truoc.
   ================================================================ */

USE QLNoiBo;
GO

IF OBJECT_ID('DonHangChiTietNhaGiaCong') IS NULL
BEGIN
    RAISERROR(N'Khong tim thay bang DonHangChiTietNhaGiaCong - can chay migration_v513.sql truoc khi chay migration nay.', 16, 1);
    RETURN;
END
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ChucNang')
BEGIN
    RAISERROR(N'Khong tim thay bang ChucNang - can chay migration_v5_chucnang.sql truoc khi chay migration nay.', 16, 1);
    RETURN;
END
GO

/* ---------- 1.1.1: Don gia tren Nha gia cong chi tiet ---------- */
IF COL_LENGTH('DonHangChiTietNhaGiaCong', 'DonGia') IS NULL
BEGIN
    ALTER TABLE DonHangChiTietNhaGiaCong ADD DonGia DECIMAL(14,2) NULL;
    PRINT N'Da them cot DonHangChiTietNhaGiaCong.DonGia.';
END ELSE PRINT N'Cot DonHangChiTietNhaGiaCong.DonGia da ton tai, bo qua.';
GO

/* ---------- 1.1.2: So ghi chep Giao / Nhan nha gia cong (theo tung dong chi tiet) ---------- */
IF OBJECT_ID('GiaoNhaGiaCongChiTiet') IS NULL
BEGIN
    CREATE TABLE GiaoNhaGiaCongChiTiet (
        ID                    INT IDENTITY(1,1) PRIMARY KEY,
        ChiTietNhaGiaCongID   INT NOT NULL FOREIGN KEY REFERENCES DonHangChiTietNhaGiaCong(ID) ON DELETE CASCADE,
        NgayGiao              DATE NOT NULL,
        SoLuong               INT NOT NULL DEFAULT 0,
        DonGia                DECIMAL(14,2) NULL,
        GhiChu                NVARCHAR(255) NULL,
        NguoiTaoID            INT NULL FOREIGN KEY REFERENCES Users(UserID),
        CreatedAt             DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    PRINT N'Da tao bang GiaoNhaGiaCongChiTiet.';
END ELSE PRINT N'Bang GiaoNhaGiaCongChiTiet da ton tai, bo qua.';
GO

IF OBJECT_ID('NhanNhaGiaCongChiTiet') IS NULL
BEGIN
    CREATE TABLE NhanNhaGiaCongChiTiet (
        ID                    INT IDENTITY(1,1) PRIMARY KEY,
        ChiTietNhaGiaCongID   INT NOT NULL FOREIGN KEY REFERENCES DonHangChiTietNhaGiaCong(ID) ON DELETE CASCADE,
        NgayNhan              DATE NOT NULL,
        SoLuong               INT NOT NULL DEFAULT 0,
        DonGia                DECIMAL(14,2) NULL,
        GhiChu                NVARCHAR(255) NULL,
        NguoiTaoID            INT NULL FOREIGN KEY REFERENCES Users(UserID),
        CreatedAt             DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    PRINT N'Da tao bang NhanNhaGiaCongChiTiet.';
END ELSE PRINT N'Bang NhanNhaGiaCongChiTiet da ton tai, bo qua.';
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_GiaoNhaGiaCongChiTiet_ChiTiet')
    CREATE INDEX IX_GiaoNhaGiaCongChiTiet_ChiTiet ON GiaoNhaGiaCongChiTiet(ChiTietNhaGiaCongID);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_NhanNhaGiaCongChiTiet_ChiTiet')
    CREATE INDEX IX_NhanNhaGiaCongChiTiet_ChiTiet ON NhanNhaGiaCongChiTiet(ChiTietNhaGiaCongID);
GO

/* ---------- 1.4: Chi dinh vai SX (tai su dung DonHangChiTietVai) ---------- */
IF COL_LENGTH('DonHangChiTietVai', 'DVTVaiYeuCau') IS NULL
BEGIN
    ALTER TABLE DonHangChiTietVai ADD DVTVaiYeuCau NVARCHAR(30) NULL DEFAULT N'Kg';
    PRINT N'Da them cot DonHangChiTietVai.DVTVaiYeuCau.';
END ELSE PRINT N'Cot DonHangChiTietVai.DVTVaiYeuCau da ton tai, bo qua.';
GO

IF COL_LENGTH('DonHangChiTietVai', 'SoKGYeuCau') IS NULL
BEGIN
    ALTER TABLE DonHangChiTietVai ADD SoKGYeuCau DECIMAL(10,2) NULL;
    PRINT N'Da them cot DonHangChiTietVai.SoKGYeuCau.';
END ELSE PRINT N'Cot DonHangChiTietVai.SoKGYeuCau da ton tai, bo qua.';
GO

/* ---------- ChucNang moi (QLSX): giaonhagiacong / nhannhagiacong / chidinhvaisx ---------- */
MERGE ChucNang AS t
USING (VALUES
    ('QLSX','giaonhagiacong',N'Giao nhà gia công',5),
    ('QLSX','nhannhagiacong',N'Nhận nhà gia công',6),
    ('QLSX','chidinhvaisx',N'Chỉ định vải SX',7)
) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu)
ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
WHEN NOT MATCHED THEN
    INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu) VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu);
GO
PRINT N'Da seed ChucNang moi cho QLSX (giaonhagiacong/nhannhagiacong/chidinhvaisx).';
GO
