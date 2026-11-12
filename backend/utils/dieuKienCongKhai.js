/* ================================================================================================
   dieuKienCongKhai.js  —  v9.31

   ĐIỀU KIỆN "HÀNG NÀY ĐƯỢC CHO NGƯỜI NGOÀI XEM" — MỘT BẢN DUY NHẤT.

   🔴 Vì sao tách ra: luật này quyết định dữ liệu nào ra khỏi công ty. Trước v9.31 nó bị chép ở BA
   nơi (routes/public.js, routes/zalo.js, utils/anhHashSanPham.js nhánh CLI). Sửa một nơi quên hai
   nơi kia thì hậu quả không phải "hiển thị sai" mà là **RÒ DỮ LIỆU** — đúng loại lỗi v7.54 từng
   mắc (tắt công khai danh mục mà catalogue vẫn hiện hàng của danh mục đó).

   Hàng hiện ra ngoài khi VÀ CHỈ KHI: danh mục CongKhai = 1 VÀ mã hàng CongKhai = 1.
   `ISNULL(..., 1)`: dòng dữ liệu cũ chưa có giá trị thì vẫn coi là HIỆN — không tự dưng biến mất.
   Dò cột trước khi đưa vào SELECT: máy chưa chạy migration mà query thẳng cột chưa có sẽ làm
   TRẮNG CẢ TRANG CATALOGUE, hỏng nặng hơn nhiều so với việc tạm thời chưa lọc được.
   ================================================================================================ */
let __coCotCongKhaiMH = null;

async function dieuKienCongKhaiMH(pool, biDanh) {
  if (__coCotCongKhaiMH === null) {
    try {
      const r = (await pool.request().query(`SELECT COL_LENGTH('TheKhoHangHoa','CongKhai') AS c`)).recordset[0] || {};
      __coCotCongKhaiMH = r.c != null;
    } catch (e) { __coCotCongKhaiMH = false; }
  }
  return __coCotCongKhaiMH ? ` AND ISNULL(${biDanh}.CongKhai, 1) = 1` : '';
}

/* Mã hàng KHÔNG thuộc danh mục nào (TheKhoDanhMucID NULL) thì không bị danh mục nào tắt -> vẫn hiện.
   Đòi `dm.CongKhai = 1` sẽ làm mọi mã chưa gán danh mục biến mất mà không ai hiểu vì sao. */
function dieuKienCongKhaiDM(biDanh) {
  return ` AND ISNULL(${biDanh}.CongKhai, 1) = 1`;
}

function xoaCacheCot() { __coCotCongKhaiMH = null; }   // dùng sau khi chạy migration mà không restart

module.exports = { dieuKienCongKhaiMH, dieuKienCongKhaiDM, xoaCacheCot };
