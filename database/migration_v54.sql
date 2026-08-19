/* ================================================================
   MIGRATION v5.4 — Danh muc "Loai hang" (nhom san pham, vd Quan be trai/gai)
   cho The kho hang hoa; tach doc lap voi cot TheKhoHangHoa.LoaiHang da co tu
   truoc (NhaSanXuat/DatNgoai - phan biet NGUON hang, khong phai NHOM san pham).
   Additive - KHONG xoa/doi cot cu. Idempotent - chay lai an toan, khong mat du lieu.
   ================================================================ */

USE QLNoiBo;
GO

/* ---- 1. Danh muc Nhom san pham (vd: Quan be trai, Quan be gai, Ao thun...) ----
   LUU Y DAT TEN: yeu cau goi la "Loai hang" nhung TheKhoHangHoa.LoaiHang da dung cho
   2 gia tri NhaSanXuat/DatNgoai (phan biet NGUON goc: tu san xuat hay dat mua ngoai).
   De tranh trung ten cot/bang gay nham lan khi doc code sau nay, dat ten BANG/COT noi
   bo la "NhomSanPham" - giao dien nguoi dung van hien dung nhan "Loai hang" nhu yeu cau. */
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'DanhMucNhomSanPham')
BEGIN
    CREATE TABLE DanhMucNhomSanPham (
        NhomSanPhamID  INT IDENTITY(1,1) PRIMARY KEY,
        TenNhom        NVARCHAR(100) NOT NULL UNIQUE
    );
    PRINT 'Da tao bang DanhMucNhomSanPham.';
END ELSE PRINT 'Bang DanhMucNhomSanPham da ton tai, bo qua.';
GO

/* ---- 2. Gan Nhom san pham (tuy chon) cho tung the kho ---- */
IF COL_LENGTH('TheKhoHangHoa', 'NhomSanPhamID') IS NULL
BEGIN
    ALTER TABLE TheKhoHangHoa ADD NhomSanPhamID INT NULL FOREIGN KEY REFERENCES DanhMucNhomSanPham(NhomSanPhamID);
    PRINT 'Da them cot TheKhoHangHoa.NhomSanPhamID.';
END ELSE PRINT 'Cot TheKhoHangHoa.NhomSanPhamID da ton tai, bo qua.';
GO

/* ---- 3. Cap nhat view vw_TonKhoHangHoa: them TenNhom (dung cho loc Catalogue + hien thi Kho hang) ----
   CREATE OR ALTER de idempotent - chay lai nhieu lan an toan, khong mat du lieu (view khong luu du lieu). */
CREATE OR ALTER VIEW vw_TonKhoHangHoa AS
SELECT
    h.MaHangID, h.MaHang, h.TenHang, h.GiaBan, h.LoaiRi, h.AnhDaiDien, tk.TenTheKho,
    h.LoaiHang, h.DonHangID, h.DonViCoBan, h.DonViQuyDoi, d.MaDH,
    h.NhomSanPhamID, nsp.TenNhom,
    ISNULL(SUM(ct.SoCatCai), 0) AS TongSoCat,
    ISNULL(SUM(ct.NhapCai), 0) AS TongNhap,
    ISNULL(SUM(ct.XuatCai), 0) AS TongXuat,
    ISNULL(SUM(ct.NhapCai - ct.XuatCai), 0) AS TongTon
FROM TheKhoHangHoa h
LEFT JOIN TheKhoDanhMuc tk ON tk.TheKhoDanhMucID = h.TheKhoDanhMucID
LEFT JOIN DanhMucNhomSanPham nsp ON nsp.NhomSanPhamID = h.NhomSanPhamID
LEFT JOIN TheKhoChiTietMau ct ON ct.MaHangID = h.MaHangID
LEFT JOIN DonHangSanXuat d ON d.DonHangID = h.DonHangID
GROUP BY h.MaHangID, h.MaHang, h.TenHang, h.GiaBan, h.LoaiRi, h.AnhDaiDien, tk.TenTheKho,
         h.LoaiHang, h.DonHangID, h.DonViCoBan, h.DonViQuyDoi, d.MaDH, h.NhomSanPhamID, nsp.TenNhom;
GO
PRINT 'Da cap nhat view vw_TonKhoHangHoa (them TenNhom).';
GO

/* ---- 4. Khop mau in mau_phieu.docx: cac phieu Nhap co dong "Ngay hoa don" rieng (nhap tay,
   khac Ngay nhap/Ngay cua phieu) - bo sung cho ca Nhap kho vai va Nhap kho phu kien. Additive,
   NULL duoc, khong anh huong du lieu cu (cac phieu da tao truoc se co gia tri NULL). ---- */
IF COL_LENGTH('PhieuNhapVai', 'NgayHoaDon') IS NULL
BEGIN
    ALTER TABLE PhieuNhapVai ADD NgayHoaDon DATE NULL;
    PRINT 'Da them cot PhieuNhapVai.NgayHoaDon.';
END ELSE PRINT 'Cot PhieuNhapVai.NgayHoaDon da ton tai, bo qua.';
GO

IF COL_LENGTH('PhieuPhuKien', 'NgayHoaDon') IS NULL
BEGIN
    ALTER TABLE PhieuPhuKien ADD NgayHoaDon DATE NULL;
    PRINT 'Da them cot PhieuPhuKien.NgayHoaDon.';
END ELSE PRINT 'Cot PhieuPhuKien.NgayHoaDon da ton tai, bo qua.';
GO

/* ---- 5. Khop mau in: Phieu Nhap kho phu kien co cot "Don gia" tren tung dong (mau_phieu.docx) -
   dat o PhieuPhuKienChiTiet (theo dung dong, gia co the khac nhau giua cac lan nhap - giong cach
   VaiCay.DonGiaNhap luu theo tung cay thay vi mot gia co dinh tren DanhMucVai). ---- */
IF COL_LENGTH('PhieuPhuKienChiTiet', 'DonGia') IS NULL
BEGIN
    ALTER TABLE PhieuPhuKienChiTiet ADD DonGia DECIMAL(14,2) NULL;
    PRINT 'Da them cot PhieuPhuKienChiTiet.DonGia.';
END ELSE PRINT 'Cot PhieuPhuKienChiTiet.DonGia da ton tai, bo qua.';
GO
PRINT 'Hoan tat migration v5.4.';
GO
