/* ================================================================================================
   TIỀN CỦA MỘT CÂY VẢI NHẬP — MỘT BẢN CÔNG THỨC DUY NHẤT                            v7.62
   ------------------------------------------------------------------------------------------------
        Tiền = (KG nhập HOẶC Số mét) × Đơn giá nhập
   Chọn KG hay mét là theo **PhieuNhapVai.DonViTinhGia** của chính phiếu chứa cây đó:
        NULL hoặc 'Kg'  -> nhân với KGNhap   (mặc định, và là toàn bộ dữ liệu cũ)
        'Met'           -> nhân với SoMet

   ⚠️ VÌ SAO PHẢI DÙNG CHUNG: công nợ nhà cung cấp GHI NỢ bằng chính biểu thức này (congno.js dùng ở
   4 chỗ: bảng tổng hợp, sổ chi tiết NCC, bảng chứng từ, sheet Excel), còn khovai.js dùng cho tổng
   tiền trên phiếu. Hai bên tự tính riêng thì tổng trên phiếu và số ghi nợ của CÙNG phiếu đó lệch
   nhau, người dùng không có cách nào biết bên nào đúng.

   ⚠️ v7.62 ĐỔI GÌ SO VỚI v7.61: trước đây CHỈ có `KGNhap * DonGiaNhap`. Vải mua theo mét (khai mét,
   bỏ trống KG) vì thế ra tiền 0 — nghĩa là công nợ NCC đang THIẾU đúng phần vải đó, không phải chỉ
   sai chỗ hiển thị. Nay thêm cờ ở ĐẦU PHIẾU.
   Cờ để NULL cho toàn bộ phiếu cũ (migration_v694 CỐ Ý không backfill) nên mọi con số cũ giữ nguyên
   tuyệt đối — quyết định của người dùng: "để nguyên, chỉ áp dụng từ nay".

   ⚠️ CỘT `DonViTinhGia` do migration_v694 thêm. Chưa chạy migration mà đưa tên cột vào câu SQL là
   "Invalid column name" -> gãy CẢ màn công nợ. Nên `bieuThucTienCay()` là hàm ASYNC: nó dò cột trước,
   chưa có thì trả về đúng biểu thức cũ (thuần KG).
   ================================================================================================ */
const so = (v) => { const n = Number(v); return isFinite(n) ? n : 0; };

const MET = 'Met';
const KG = 'Kg';

let __coCotDVT = null;
async function coCotDonViTinhGia(pool) {
  if (__coCotDVT === null) {
    try {
      const r = (await pool.request()
        .query(`SELECT COL_LENGTH('PhieuNhapVai','DonViTinhGia') AS c`)).recordset[0] || {};
      __coCotDVT = r.c != null;
    } catch (e) { __coCotDVT = false; }
  }
  return __coCotDVT;
}

/* ================================================================================================
   ⚠️ v7.62.1 — SỬA LỖI TÔI VỪA GÂY RA. Bản v7.62 dựng biểu thức bằng TRUY VẤN CON tương quan
   (`(SELECT DonViTinhGia FROM PhieuNhapVai WHERE PhieuNhapID = vc.PhieuNhapID)`) để bên gọi khỏi
   phải JOIN thêm bảng phiếu. SQL Server **CẤM truy vấn con nằm trong hàm tổng hợp**:
       Msg 130: Cannot perform an aggregate function on an expression containing an aggregate
                or a subquery.
   Mà 3 trong 6 chỗ gọi lại đặt biểu thức này trong `SUM(...)` — danh sách phiếu nhập kho vải VÀ
   công nợ nhà cung cấp (bảng tổng hợp + sổ chi tiết) đều ném lỗi ⇒ màn hình trắng.

   Nay BẮT BUỘC truyền bí danh bảng phiếu (`biDanhPhieu`) và chỉ sinh CASE thuần — dùng được trong
   SUM. Chỗ nào chưa JOIN PhieuNhapVai thì phải JOIN (khóa ngoại NOT NULL nên JOIN không làm mất
   dòng nào). Thiếu tham số thì NÉM LỖI NGAY lúc dựng câu, thay vì đẻ ra một câu SQL sai âm thầm.
   ================================================================================================ */
async function bieuThucSoLuongTinhTien(pool, biDanhCay, biDanhPhieu) {
  const b = biDanhCay || 'vc';
  if (!biDanhPhieu) {
    throw new Error('bieuThucTienCay/bieuThucSoLuongTinhTien: THIẾU bí danh bảng PhieuNhapVai. '
      + 'Câu truy vấn phải JOIN PhieuNhapVai rồi truyền bí danh của nó — KHÔNG dùng truy vấn con, '
      + 'vì biểu thức này hay nằm trong SUM() và SQL Server cấm subquery trong hàm tổng hợp.');
  }
  return (await coCotDonViTinhGia(pool))
    ? `CASE WHEN ${biDanhPhieu}.DonViTinhGia = N'${MET}'
            THEN ISNULL(${b}.SoMet, 0) ELSE ISNULL(${b}.KGNhap, 0) END`
    : `ISNULL(${b}.KGNhap, 0)`;
}

/* Biểu thức SQL tính TIỀN của MỘT cây. Dùng được cả trong SUM(). */
async function bieuThucTienCay(pool, biDanhCay, biDanhPhieu) {
  const b = biDanhCay || 'vc';
  const sl = await bieuThucSoLuongTinhTien(pool, b, biDanhPhieu);
  return `((${sl}) * ISNULL(${b}.DonGiaNhap, 0))`;
}

/* Nhãn đơn vị của số lượng dùng để tính tiền — cho các bảng chứng từ hiện "SL / ĐVT / Đơn giá". */
async function bieuThucDonViSQL(pool, biDanhPhieu) {
  return (await coCotDonViTinhGia(pool)) && biDanhPhieu
    ? `CASE WHEN ${biDanhPhieu}.DonViTinhGia = N'${MET}' THEN N'm' ELSE N'Kg' END`
    : `N'Kg'`;
}

/* Bản JS của CÙNG công thức — cho CLI và cho chỗ đã có sẵn dữ liệu trong bộ nhớ.
   `donViTinhGia` là của PHIẾU chứa cây đó. */
function laTinhTheoMet(donViTinhGia) {
  return String(donViTinhGia || '').trim().toLowerCase() === MET.toLowerCase();
}
function soLuongTinhTien(row, donViTinhGia) {
  return laTinhTheoMet(donViTinhGia) ? so(row && row.SoMet) : so(row && row.KGNhap);
}
function tienCay(row, donViTinhGia) {
  return soLuongTinhTien(row, donViTinhGia) * so(row && row.DonGiaNhap);
}
function tongTien(lines, donViTinhGia) {
  return (lines || []).reduce((s, r) => s + tienCay(r, donViTinhGia), 0);
}

/* Cây ĐÃ KHAI ĐƠN GIÁ nhưng số lượng dùng để tính tiền lại = 0 -> thành tiền 0 một cách đáng ngờ:
     · phiếu tính theo Kg mà cây chỉ khai mét  -> quên nhập KG, hoặc quên đổi cờ phiếu sang Mét
     · phiếu tính theo Mét mà cây không có mét -> quên nhập số mét
   Trả về true để màn hình/bản in NÊU RA, thay vì hiện số 0 trơ trọi. */
function laTienNghiNgo(row, donViTinhGia) {
  if (!row || so(row.DonGiaNhap) <= 0) return false;
  if (soLuongTinhTien(row, donViTinhGia) > 0) return false;
  // Có số ở ĐƠN VỊ KIA -> gần như chắc chắn là khai nhầm đơn vị, không phải hàng cho không.
  return laTinhTheoMet(donViTinhGia) ? so(row.KGNhap) > 0 : so(row.SoMet) > 0;
}

/* Nhãn đơn vị để hiện cạnh đơn giá trên phiếu / bản in ("80.000 đ/m"). */
function nhanDonVi(donViTinhGia) { return laTinhTheoMet(donViTinhGia) ? 'm' : 'kg'; }

/* Chuẩn hóa giá trị nhận từ form về ĐÚNG một trong hai chuỗi hợp lệ.
   KHÔNG trả về null: phiếu mới nên ghi rõ ý định. Ràng buộc CK_PhieuNhapVai_DonViTinhGia của
   migration_v694 chỉ nhận Kg / Met / NULL — gửi chuỗi lạ là câu INSERT gãy, nên chặn ngay ở đây. */
function chuanDonViTinhGia(v) { return laTinhTheoMet(v) ? MET : KG; }

module.exports = {
  bieuThucTienCay, bieuThucSoLuongTinhTien, bieuThucDonViSQL,
  coCotDonViTinhGia, chuanDonViTinhGia,
  tienCay, tongTien, laTienNghiNgo, laTinhTheoMet, soLuongTinhTien, nhanDonVi,
  MET, KG
};
