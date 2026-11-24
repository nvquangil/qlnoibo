/* ================================================================================================
   v9.67d / v9.72 — ẢNH ĐẠI DIỆN CỦA MỘT LỆNH SX cho các bảng danh sách (sản lượng theo lệnh, lương CTV) — MỘT công thức.
   Nguyen 16/11: "ảnh sản phẩm lấy từ ảnh hàng hóa, tự cập nhật khi có ảnh hàng hóa".
   Ưu tiên ẢNH ĐẠI DIỆN HÀNG HÓA (TheKhoHangHoa.AnhDaiDien) của mã hàng thuộc lệnh — HỢP HAI NGUỒN như
   utils/giaVonLenhSX.maHangCuaLenh (TheKhoHangHoa.DonHangID ∪ PhieuNhapKhoHang.DonHangID không hủy) — chưa có thì lùi về
   DonHangSanXuat.AnhSanPham. Tính lúc ĐỌC (subquery ở cột SELECT, KHÔNG nằm trong aggregate — Msg 130).
   bd = bí danh bảng DonHangSanXuat trong câu gọi. Cột trả tên `Anh`.
   ================================================================================================ */
const COT_ANH_LENH = (bd) => `
      ISNULL((SELECT TOP 1 h.AnhDaiDien FROM TheKhoHangHoa h
               WHERE h.AnhDaiDien IS NOT NULL AND LTRIM(RTRIM(h.AnhDaiDien)) <> ''
                 AND (h.DonHangID = ${bd}.DonHangID
                      OR h.MaHangID IN (SELECT ct.MaHangID FROM PhieuNhapKhoHangChiTiet ct
                                        JOIN PhieuNhapKhoHang p ON p.PhieuNKID = ct.PhieuNKID AND p.TrangThai <> N'Đã hủy'
                                        WHERE p.DonHangID = ${bd}.DonHangID))
               ORDER BY h.MaHangID DESC), ${bd}.AnhSanPham) AS Anh`;

module.exports = { COT_ANH_LENH };
