/* ==================================================================================================
   MÃ RẬP CỦA MỘT LỆNH SẢN XUẤT — BẢN CÔNG THỨC DUY NHẤT                                     v7.67
   --------------------------------------------------------------------------------------------------
   Mã rập nằm ở HAI nơi, và cả hai đều do bộ phận Kỹ thuật gõ vào:

     1. `DonHangChiTietSoDo.MaRap` — khai ở bảng Sơ đồ của lệnh SX (đường chính từ v5.13).
     2. `TienDoSanXuat.MaRap`      — khai lúc **GHI TIẾN ĐỘ** công đoạn Kỹ thuật.

   ⚠️ CHỈ ĐỌC MỘT NGUỒN LÀ SAI. qlsx.js đã vấp đúng lỗi này ở v6.06 ("đơn hiện TRỐNG mã rập dù Kỹ
   thuật đã cập nhật") và đã gộp 2 nguồn; nhưng routes/tailieukythuat.js vẫn giữ bản chỉ đọc bảng Sơ
   đồ, nên MỌI bản in trong Tài liệu may/đóng gói vẫn trắng mã rập — đúng lỗi Nguyen báo lại ở v7.67.
   Vì vậy công thức được tách ra ĐÂY và cả hai route đều gọi vào, để không còn "sửa một nơi quên nơi
   kia" lần thứ ba.

   Trả về CHUỖI đã gộp, ngăn cách bằng ", " (một lệnh SX có thể nhiều sơ đồ → nhiều mã rập).
   Không tìm được gì thì trả '' — KHÔNG ném lỗi, vì mã rập chỉ là thông tin hiển thị.
   ================================================================================================== */

/* pool: mssql ConnectionPool; sql: module mssql (truyền vào để util không tự require, tránh lệ thuộc
   thứ tự nạp module và để test cắm pool giả vào chạy được). */
async function maRapCuaDon(pool, sql, donHangId) {
  if (!donHangId) return '';
  try {
    const r = (await pool.request().input('id', sql.Int, donHangId).query(`
      SELECT DISTINCT LTRIM(RTRIM(x.MaRap)) AS MaRap FROM (
        SELECT MaRap FROM DonHangChiTietSoDo WHERE DonHangID = @id
        UNION ALL
        SELECT MaRap FROM TienDoSanXuat WHERE DonHangID = @id
      ) x
      WHERE x.MaRap IS NOT NULL AND LTRIM(RTRIM(x.MaRap)) <> ''`)).recordset;
    return r.map(x => x.MaRap).join(', ');
  } catch (e) {
    return '';
  }
}

/* Bản GỘP THEO LÔ cho các màn hình DANH SÁCH: gọi maRapCuaDon() cho từng dòng là N+1 truy vấn.
   Trả về object { [DonHangID]: 'MR01, MR02' }. Cũng gộp đủ 2 nguồn — danh sách lệnh SX ở Tài liệu
   may/đóng gói trước đây chỉ đọc bảng Sơ đồ nên cột Mã rập trắng y như bản in. */
async function maRapTheoDon(pool) {
  const map = {};
  try {
    const r = (await pool.request().query(`
      SELECT DISTINCT x.DonHangID, LTRIM(RTRIM(x.MaRap)) AS MaRap FROM (
        SELECT DonHangID, MaRap FROM DonHangChiTietSoDo
        UNION ALL
        SELECT DonHangID, MaRap FROM TienDoSanXuat
      ) x
      WHERE x.MaRap IS NOT NULL AND LTRIM(RTRIM(x.MaRap)) <> ''`)).recordset;
    for (const s of r) (map[s.DonHangID] = map[s.DonHangID] || []).push(s.MaRap);
  } catch (e) { /* thiếu bảng/cột thì danh sách vẫn chạy, chỉ trống mã rập */ }
  const out = {};
  Object.keys(map).forEach(k => { out[k] = [...new Set(map[k])].join(', '); });
  return out;
}

module.exports = { maRapCuaDon, maRapTheoDon };
