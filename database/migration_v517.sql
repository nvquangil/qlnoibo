/* ================================================================
   migration_v517.sql - Nang cap tu v5.16 len v5.17

   Yeu cau: phan he "Thẻ kho hàng hóa" bo sung:
     1.1 - 2 truong moi trong Tao/Sua the kho: Gia Aloha, Ma Barcode.
     1.2 - chuc nang moi "Báo giá Aloha" (thiet ke theo file mau nguoi dung
           cung cap - "Danh sách các mặt hàng mở mã mới" cua CTY TNHH Thai
           Hung, phong mua hang) - 2 chuc nang con:
       1.2.1 Tao bao gia: chon nhieu ma hang tu The kho hang hoa (CHI hien
             ma hang CHUA tung xuat hien o bat ky bao gia nao truoc do - moi
             ma hang chi duoc bao gia DUNG 1 LAN trong toan he thong, ep bang
             UNIQUE tren BaoGiaAlohaChiTiet.MaHangID ben duoi), luu + xuat
             Excel.
       1.2.2 Danh sach bao gia: liet ke cac bao gia da tao, xuat Excel tung
             bao gia rieng.

   Gia Aloha (TheKhoHangHoa.GiaAloha) anh xa vao cot "Giá trước VAT" cua file
   xuat; Ma Barcode (TheKhoHangHoa.MaBarcode) anh xa vao cot "Mã Barcode" -
   dung theo dung chu thich trong file mau nguoi dung gui ("lấy từ trường giá
   Aloha trong Tạo thẻ kho hàng hóa" / "lấy từ trường Mã Bardcode trong tạo
   thẻ kho mới").

   An toan chay lai nhieu lan (idempotent) - dung COL_LENGTH/OBJECT_ID/
   sys.indexes giong cac migration truoc.
   ================================================================ */

-- ============ 1.1. TheKhoHangHoa.GiaAloha + MaBarcode ============
IF COL_LENGTH('TheKhoHangHoa', 'GiaAloha') IS NULL
BEGIN
    ALTER TABLE TheKhoHangHoa ADD GiaAloha DECIMAL(14,2) NULL;
    PRINT 'Da them cot TheKhoHangHoa.GiaAloha.';
END ELSE PRINT 'Cot TheKhoHangHoa.GiaAloha da ton tai, bo qua.';
GO

IF COL_LENGTH('TheKhoHangHoa', 'MaBarcode') IS NULL
BEGIN
    ALTER TABLE TheKhoHangHoa ADD MaBarcode NVARCHAR(50) NULL;
    PRINT 'Da them cot TheKhoHangHoa.MaBarcode.';
END ELSE PRINT 'Cot TheKhoHangHoa.MaBarcode da ton tai, bo qua.';
GO

-- vw_TonKhoHangHoa liet ke cot tuong minh (khong SELECT *) nen phai cap nhat lai
-- de GiaAloha/MaBarcode duoc tra ve cho man hinh Danh sach/Sua the kho. Dung
-- CREATE OR ALTER VIEW theo dung tien le migration_v54.sql (an toan chay lai).
CREATE OR ALTER VIEW vw_TonKhoHangHoa AS
SELECT
    h.MaHangID, h.MaHang, h.TenHang, h.GiaBan, h.LoaiRi, h.AnhDaiDien, tk.TenTheKho,
    h.LoaiHang, h.DonHangID, h.DonViCoBan, h.DonViQuyDoi, d.MaDH,
    h.GiaAloha, h.MaBarcode,
    ISNULL(SUM(ct.SoCatCai), 0) AS TongSoCat,
    ISNULL(SUM(ct.NhapCai), 0) AS TongNhap,
    ISNULL(SUM(ct.XuatCai), 0) AS TongXuat,
    ISNULL(SUM(ct.NhapCai - ct.XuatCai), 0) AS TongTon
FROM TheKhoHangHoa h
LEFT JOIN TheKhoDanhMuc tk ON tk.TheKhoDanhMucID = h.TheKhoDanhMucID
LEFT JOIN TheKhoChiTietMau ct ON ct.MaHangID = h.MaHangID
LEFT JOIN DonHangSanXuat d ON d.DonHangID = h.DonHangID
GROUP BY h.MaHangID, h.MaHang, h.TenHang, h.GiaBan, h.LoaiRi, h.AnhDaiDien, tk.TenTheKho,
         h.LoaiHang, h.DonHangID, h.DonViCoBan, h.DonViQuyDoi, d.MaDH, h.GiaAloha, h.MaBarcode;
PRINT 'Da cap nhat view vw_TonKhoHangHoa (them GiaAloha, MaBarcode).';
GO

-- ============ 1.2. BAO GIA ALOHA ============
-- Header - 1 dong = 1 lan tao bao gia. TenCongTySanXuatNhapKhau/MaNCC/TenNCC
-- khai bao 1 LAN cho ca bao gia (khop voi file mau: o "Tên Công ty Sản Xuất/
-- Nhập Khẩu" va "Tên NCC" gop o (merge) xuyen suot moi dong hang trong CUNG
-- 1 bao gia - nghia la 1 gia tri DUY NHAT ap dung cho ca lo hang dang de nghi
-- mo ma, khong doi tung dong).
IF OBJECT_ID('BaoGiaAloha') IS NULL
BEGIN
    CREATE TABLE BaoGiaAloha (
        ID                          INT IDENTITY(1,1) PRIMARY KEY,
        TenBaoGia                  NVARCHAR(255) NULL,
        NgayTao                    DATE NOT NULL DEFAULT CAST(SYSDATETIME() AS DATE),
        TenCongTySanXuatNhapKhau   NVARCHAR(255) NULL,
        MaNCC                      NVARCHAR(50) NULL,
        TenNCC                     NVARCHAR(255) NULL,
        GhiChu                     NVARCHAR(255) NULL,
        NguoiTaoID                 INT NULL FOREIGN KEY REFERENCES Users(UserID),
        CreatedAt                  DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    PRINT 'Da tao bang BaoGiaAloha.';
END ELSE PRINT 'Bang BaoGiaAloha da ton tai, bo qua.';
GO

-- Chi tiet (dong hang) - UNIQUE tren MaHangID (KHONG phai UNIQUE(BaoGiaAlohaID,
-- MaHangID)) la co y: yeu cau nguoi dung "mã hàng đã chọn ở báo giá trước thì
-- không hiện ra nữa" khi tao bao gia MOI - nghia la 1 ma hang chi duoc xuat
-- hien o DUNG 1 bao gia trong toan bo lich su, khong phai chi loai tru khoi
-- bao gia GAN NHAT. Rang buoc nay ep dung ngay o tang du lieu (khong chi loc
-- o frontend), tranh truong hop 2 nguoi cung tao bao gia dong thoi chon trung
-- 1 ma hang.
IF OBJECT_ID('BaoGiaAlohaChiTiet') IS NULL
BEGIN
    CREATE TABLE BaoGiaAlohaChiTiet (
        ID              INT IDENTITY(1,1) PRIMARY KEY,
        BaoGiaAlohaID   INT NOT NULL FOREIGN KEY REFERENCES BaoGiaAloha(ID) ON DELETE CASCADE,
        MaHangID        INT NOT NULL UNIQUE FOREIGN KEY REFERENCES TheKhoHangHoa(MaHangID),
        PhanTramVAT     DECIMAL(5,4) NOT NULL DEFAULT 0.08,
        ThuTu           INT NOT NULL DEFAULT 0,
        CreatedAt       DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    PRINT 'Da tao bang BaoGiaAlohaChiTiet.';
END ELSE PRINT 'Bang BaoGiaAlohaChiTiet da ton tai, bo qua.';
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_BaoGiaAlohaChiTiet_BaoGiaAlohaID')
    CREATE INDEX IX_BaoGiaAlohaChiTiet_BaoGiaAlohaID ON BaoGiaAlohaChiTiet(BaoGiaAlohaID);
GO

-- ============ CHUC NANG (phan quyen) ============
IF NOT EXISTS (SELECT 1 FROM ChucNang WHERE ModuleCode = 'KHOHANG' AND MaChucNang = 'baogiaaloha')
BEGIN
    INSERT INTO ChucNang (ModuleCode, MaChucNang, TenChucNang, ThuTu)
    SELECT 'KHOHANG', 'baogiaaloha', N'Báo giá Aloha', ISNULL(MAX(ThuTu), 0) + 1
    FROM ChucNang WHERE ModuleCode = 'KHOHANG';
    PRINT 'Da them chuc nang KHOHANG/baogiaaloha.';
END ELSE PRINT 'Chuc nang KHOHANG/baogiaaloha da ton tai, bo qua.';
GO
