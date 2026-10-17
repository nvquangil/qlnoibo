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

/* ================================================================================================
   v8.91 — TIỀN CỦA MỘT DÒNG TRẢ VẢI VỀ NCC

   Trước v8.91 công thức này được CHÉP RIÊNG ở hai chỗ trong routes/congno.js: congNoNCC() (bảng
   tổng) và soChiTietNCC() (sổ chi tiết). Hai bản chép là sớm muộn sửa một quên một, rồi bảng tổng
   và sổ chi tiết ra hai con số khác nhau cho cùng một nhà cung cấp — chính ghi chú ở congno.js đã
   cảnh báo điều đó. Nay MỘT biểu thức, hai nơi gọi.

   ⚠️ `DonGiaTra` (migration_v879) là đơn gia GÕ TAY lúc lập phiếu trả. ĐỂ TRỐNG = NULL = dùng
   `VaiCay.DonGiaNhap` như trước — nhờ vậy mọi phiếu trả đã lập trước v8.91 giữ nguyên số tiền.
   Chưa chạy migration thì không có cột, biểu thức tự lùi về bản cũ.

   `biDanhCT` = bí danh của PhieuXuatVaiChiTiet (thường 'ct'), `biDanhCay` = của VaiCay (thường 'vc').
   ================================================================================================ */
/* ⚠️ CỐ Ý KHÔNG CACHE kết quả dò cột này (khác `coCotDonViTinhGia` ở trên).
   Bản nháp đầu của v8.91 có cache, và có cache là đẻ ra tình huống này: chạy migration_v879 xong
   mà QUÊN pm2 restart thì tiến trình đang chạy giữ `false`, trong khi routes/khovai.js dò trực tiếp
   nên thấy `true`. Kết quả: bản in phiếu ra ĐƠN GIÁ GÕ TAY, còn công nợ NCC lại ghi nợ theo
   DonGiaNhap — hai con số cho cùng một phiếu, không ai biết bên nào đúng. Đó đúng là thứ mà cả file
   này sinh ra để chặn.
   Giá phải trả: thêm một COL_LENGTH mỗi lần dựng câu (một lần cho mỗi lần mở màn công nợ) —
   không đáng kể so với rủi ro trên. MỌI nơi cần biết có cột hay không phải gọi hàm NÀY. */
async function coCotDonGiaTra(pool) {
  try {
    const r = (await pool.request().query(
      `SELECT COL_LENGTH('PhieuXuatVaiChiTiet','DonGiaTra') AS a`)).recordset[0] || {};
    return r.a != null;
  } catch (e) { return false; }
}

/* Chuẩn hóa ô "Đơn giá" người dùng gõ trên phiếu trả NCC về giá trị ghi vào CSDL.
   Trả về `null` = KHÔNG khai giá = công nợ dùng `VaiCay.DonGiaNhap` như trước v8.91.

   ⚠️ SỐ 0 CŨNG TRẢ VỀ null, CÓ CHỦ ĐÍCH. `Number('0')` là 0 và `isNaN(0)` là false, nên phép kiểm
   "rỗng hoặc không phải số" KHÔNG bắt được số 0 — ghi thẳng 0 xuống là `COALESCE(0, ...)` trả 0, tức
   phiếu trả 500 kg giảm nợ ĐÚNG 0 ĐỒNG và công nợ phải trả phình lên nguyên giá trị lô hàng, im
   lặng. Trả hàng cho không thì không lập phiếu trả, nên 0 gần như luôn là gõ nhầm (hoặc xóa chữ số
   còn trơ lại "0"). Coi như để trống là lựa chọn ÍT GÂY HẠI NHẤT.
   Giá âm cũng về null vì lý do tương tự — phiếu trả làm TĂNG nợ là vô nghĩa. */
function chuanDonGiaTra(v) {
  if (v === '' || v == null) return null;
  const n = Number(v);
  if (!isFinite(n) || n <= 0) return null;
  return n;
}

async function bieuThucTienTraVai(pool, biDanhCT, biDanhCay) {
  const ct = biDanhCT || 'ct';
  const vc = biDanhCay || 'vc';
  const gia = (await coCotDonGiaTra(pool))
    ? `COALESCE(${ct}.DonGiaTra, ${vc}.DonGiaNhap, 0)`
    : `ISNULL(${vc}.DonGiaNhap, 0)`;
  return `(ISNULL(${ct}.KGXuat, 0) * ${gia})`;
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
  bieuThucTienTraVai, coCotDonGiaTra, chuanDonGiaTra,   // v8.91
  coCotDonViTinhGia, chuanDonViTinhGia,
  tienCay, tongTien, laTienNghiNgo, laTinhTheoMet, soLuongTinhTien, nhanDonVi,
  MET, KG
};
