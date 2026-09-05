/* ================================================================================================
   TIỀN CỦA MỘT CÂY VẢI NHẬP — MỘT BẢN CÔNG THỨC DUY NHẤT                                  v7.61
   ------------------------------------------------------------------------------------------------
        Tiền = KG nhập × Đơn giá nhập
   Đây KHÔNG phải lựa chọn mới: đó chính là công thức mà công nợ nhà cung cấp đang dùng để GHI NỢ
   (congno.js: bảng tổng hợp, sổ chi tiết NCC, và bảng chứng từ). Phiếu nhập kho vải mà tự tính kiểu
   khác thì tổng trên phiếu và số ghi nợ của cùng phiếu đó sẽ lệch nhau — người dùng không có cách nào
   biết bên nào đúng.

   ⚠️ VẢI NHẬP THEO MÉT: `SoMet` KHÔNG tham gia phép nhân. Cây chỉ có mét (KGNhap = 0) thì thành tiền
   ra 0 dù đã khai đơn giá — và công nợ NCC cũng đang ghi 0 cho cây đó. Đây là hành vi HIỆN TẠI của hệ
   thống, giữ nguyên để hai bên khớp nhau; nhưng KHÔNG được để nó im lặng: `laTienNghiNgo()` chỉ ra
   đúng các cây đó để màn hình cảnh báo. Muốn tính tiền theo mét thì phải đổi ở CẢ hai nơi cùng lúc
   (và phải sửa cả dữ liệu nợ cũ) — không phải việc sửa lẻ ở một màn hình.
   ================================================================================================ */
const so = (v) => { const n = Number(v); return isFinite(n) ? n : 0; };

/* Biểu thức SQL tính tiền của một cây. `biDanh` = bí danh của bảng VaiCay trong câu truy vấn.
   Dùng hàm thay vì hằng chuỗi để mỗi câu truy vấn truyền đúng bí danh của nó (vc / v / ...). */
function bieuThucTienCay(biDanh) {
  const b = biDanh || 'vc';
  return `(ISNULL(${b}.KGNhap, 0) * ISNULL(${b}.DonGiaNhap, 0))`;
}

/* Bản JS của CÙNG công thức — cho CLI và cho chỗ đã có sẵn dữ liệu dòng trong bộ nhớ. */
function tienCay(row) {
  return so(row && row.KGNhap) * so(row && row.DonGiaNhap);
}

function tongTien(lines) {
  return (lines || []).reduce((s, r) => s + tienCay(r), 0);
}

/* Cây ĐÃ KHAI ĐƠN GIÁ, CÓ SỐ MÉT, nhưng KG = 0 -> thành tiền 0. Gần như chắc chắn là thiếu KG chứ
   không phải hàng cho không. Trả về true để màn hình/bản in nêu rõ thay vì hiện số 0 trơ trọi. */
function laTienNghiNgo(row) {
  if (!row) return false;
  return so(row.DonGiaNhap) > 0 && so(row.KGNhap) <= 0 && so(row.SoMet) > 0;
}

module.exports = { bieuThucTienCay, tienCay, tongTien, laTienNghiNgo };
