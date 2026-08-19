/* ================================================================
   MIGRATION v6.42 — Sửa mất dữ liệu khi SỬA thẻ kho hàng hóa
   ----------------------------------------------------------------
   Nguyên nhân: form "Sửa thẻ kho" lấy dữ liệu từ view vw_TonKhoHangHoa để điền sẵn.
   Qua các lần sửa view (migration_v54 thêm NhomSanPhamID/TenNhom; migration_v517
   thêm GiaAloha/MaBarcode nhưng LỠ BỎ NhomSanPhamID/TenNhom), view KHÔNG bao giờ
   trả về TheKhoDanhMucID (chỉ có TenTheKho) và có bản còn thiếu GiaAloha/NhomSanPhamID.
   => Khi Sửa, các ô "Danh mục thẻ kho" (TheKhoDanhMucID), "Loại hàng" (NhomSanPhamID),
   "Giá Aloha" không điền lại được -> lưu xuống NULL -> mất dữ liệu dù không sửa.

   Bản này DỰNG LẠI view với ĐẦY ĐỦ mọi cột frontend cần (hợp nhất v54 + v517 + thêm
   TheKhoDanhMucID). CREATE OR ALTER — idempotent, không đổi dữ liệu (view không lưu data).
   Chạy 1 lần.
   ================================================================ */
USE QLNoiBo;
GO

CREATE OR ALTER VIEW vw_TonKhoHangHoa AS
SELECT
    h.MaHangID, h.MaHang, h.TenHang, h.GiaBan, h.LoaiRi, h.AnhDaiDien,
    h.TheKhoDanhMucID, tk.TenTheKho,
    h.LoaiHang, h.DonHangID, h.DonViCoBan, h.DonViQuyDoi, d.MaDH,
    h.GiaAloha, h.MaBarcode,
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
GROUP BY h.MaHangID, h.MaHang, h.TenHang, h.GiaBan, h.LoaiRi, h.AnhDaiDien,
         h.TheKhoDanhMucID, tk.TenTheKho, h.LoaiHang, h.DonHangID, h.DonViCoBan, h.DonViQuyDoi, d.MaDH,
         h.GiaAloha, h.MaBarcode, h.NhomSanPhamID, nsp.TenNhom;
GO

PRINT '=== migration_v642.sql: vw_TonKhoHangHoa da co du TheKhoDanhMucID + NhomSanPhamID/TenNhom + GiaAloha/MaBarcode ===';
GO
