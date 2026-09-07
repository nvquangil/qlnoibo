/* ==================================================================================================
   LỊCH SỬ NHẬP / XUẤT CỦA MỘT MÃ PHỤ KIỆN — BẢN CÔNG THỨC DUY NHẤT                          v7.69
   --------------------------------------------------------------------------------------------------
   Nhận các dòng chi tiết phiếu (đã sắp theo NGÀY TĂNG DẦN) và trả về danh sách để hiển thị, với
   cột "Tồn cuối" là số dư LŨY KẾ tại thời điểm từng phiếu.

   ⚠️ HAI CHIỀU KHÁC NHAU, ĐỪNG GỘP LÀM MỘT:
     · CHIỀU CỘNG DỒN phải là ngày TĂNG — tồn cuối của một phiếu = tổng nhập trừ tổng xuất của mọi
       phiếu TRƯỚC nó. Cộng ngược là mỗi dòng ra một con số vô nghĩa.
     · CHIỀU HIỂN THỊ là ngày GIẢM (mới nhất lên đầu — yêu cầu Nguyen ở v7.69), để mở ra là thấy
       ngay phát sinh gần nhất, và dòng trên cùng có tồn = TỒN HIỆN TẠI.
   Vì vậy: cộng theo chiều tăng rồi ĐẢO MẢNG. Sửa `ORDER BY` của câu SQL thành DESC là làm sai cột
   "Tồn cuối" — đó chính là cái bẫy của việc "chỉ đổi thứ tự sắp xếp".

   Ba màn hình dùng chung dữ liệu này (tab Thẻ kho lọc theo 1 mã, bấm mã ở bảng tổng hợp, popup
   "Lịch sử" ở tab Danh mục) nên chỉ được có MỘT bản công thức.

   VÌ SAO CHỈ PHỤ KIỆN LÀM VIỆC NÀY, VẢI THÌ KHÔNG (Nguyen giải thích 2026-09-05):
     · Vải quản lý theo TỪNG CÂY — hết cây thì sang cây khác, nên lịch sử một cây không cần số dư
       lũy kế và cũng không cần đảo chiều. Đừng "làm cho đồng bộ" ở màn lịch sử cây vải.
     · Phụ kiện thì số lượng nhiều, dùng chung cho nhiều đơn, nên cái người dùng cần thấy NGAY khi
       mở lịch sử là CÒN BAO NHIÊU — tức tồn cuối của phát sinh gần nhất. Đó là lý do phải đưa dòng
       mới nhất lên đầu, không phải chỉ vì "cho dễ nhìn".
   ================================================================================================== */

/* rs: recordset của câu SQL, mỗi dòng có { PhieuID, Ngay, LoaiPhieu, MaDon, MaDonHang, SoLuong,
   DonVi, AnhDaiDien }, ĐÃ sắp theo (Ngay, PhieuID) TĂNG DẦN. */
function dongLichSuPhuKien(rs) {
  let tonCuoi = 0;
  const rows = (rs || []).map(r => {
    const nhap = r.LoaiPhieu === 'Nhập' ? (Number(r.SoLuong) || 0) : 0;
    const xuat = r.LoaiPhieu === 'Xuất' ? (Number(r.SoLuong) || 0) : 0;
    tonCuoi += nhap - xuat;
    return {
      loaiBaoCao: 'chitiet', phieuId: r.PhieuID, ngay: r.Ngay, loaiPhieu: r.LoaiPhieu,   // v6.13: + phieuId
      donHang: r.MaDonHang || r.MaDon || '', nhap, xuat, ton: tonCuoi, dvt: r.DonVi,
      AnhDaiDien: r.AnhDaiDien || null   // v7.52: mọi dòng cùng 1 mã nên ảnh giống nhau — hiện 1 lần ở đầu bảng
    };
  });
  rows.reverse();   // v7.69: MỚI NHẤT LÊN ĐẦU (đã cộng dồn xong nên không ảnh hưởng cột Tồn cuối)
  return rows;
}

module.exports = { dongLichSuPhuKien };
