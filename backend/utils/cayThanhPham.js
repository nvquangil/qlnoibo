/* ================================================================================================
   CÂY NÀO TRONG SỔ CẮT ĐƯỢC TÍNH VÀO THÀNH PHẨM — MỘT LUẬT, MỌI NƠI DÙNG CHUNG          v8.93
   ------------------------------------------------------------------------------------------------
   Dùng ở: routes/qlsx.js (slCatTheoMauTuCay, getCatMauList, slKhoNhapTheoDon), routes/khohang.js
   (gợi ý thẻ kho), routes/bangke.js (bảng kê BTP). Trước v8.93 mỗi nơi chép tay một bản của luật
   L1/L2/L3 — và cả bốn bản đều thiếu cùng một thứ.

   🔴 VÌ SAO CÓ FILE NÀY — DH2608073, 2026-10-19
   Sổ cắt giấy ĐEN02: 30 lớp × 5 = 150. QC hiện 250. Tái hiện được: cây 2DA-DEN02190926002 được
   XUẤT HAI LẦN cho cùng lệnh — PXV-13205 khai 'Chính' (cắt thân, sơ đồ 6251, 11 lớp) và PXV-14204
   khai 'Phối' (cắt bo, sơ đồ 6252, 20 lớp). Luật v8.71 gắn Kiểu cho CÂY: "có ít nhất một dòng Chính
   → tính ở mọi nơi", nên 20 lớp cắt bo cũng vào thành phẩm. 150 + 100 = 250.

   Thiếu một thông tin: LẦN CẮT này là thân hay phối. Nơi đặt tự nhiên nhất là SƠ ĐỒ — tổ cắt đã
   chọn sơ đồ khi ghi sổ; một sơ đồ cắt thân hoặc cắt phối, không lẫn. migration_v880 thêm
   DonHangChiTietSoDo.Kieu (N'Chính' / N'Phối' / NULL).

   LUẬT (ưu tiên từ trên xuống, cho MỘT dòng sổ cắt `cc`):
     S1  sơ đồ của bản ghi chứa dòng đó khai Kieu = 'Phối'   → KHÔNG tính
     S2  sơ đồ khai Kieu = 'Chính'                            → TÍNH (bất kể Kiểu trên phiếu xuất)
     S0  sơ đồ chưa khai (NULL) hoặc dòng không gắn sơ đồ      → suy từ PHIẾU XUẤT:
         L3  lệnh chưa khai KieuVai ở bất kỳ dòng phiếu xuất nào → tính hết (không lọc)
         B   🔴 LUẬT THEO BẢN GHI (Nguyen 2026-10-19: "cộng vào theo mã cây đã xuất ở phiếu xuất"):
             bản ghi Cắt chứa dòng đó là MỘT LẦN CẮT PHỐI khi
                 MỌI cây của bản ghi đều có dòng phiếu xuất 'Phối' của lệnh
                 VÀ ít nhất một cây của bản ghi KHÔNG có dòng 'Chính' nào của lệnh
             → KHÔNG tính dòng nào của bản ghi đó, kể cả cây dùng chung thân/bo.
             Vì sao đúng: tổ cắt ghi một bản sổ cắt cho một lần trải — các cây trong đó cùng đi
             một phiếu. DH2608073: bản 14580 = {…003 P, …002 C+P, Kem11 P, Tàn43 C+P} → mọi cây ∈ P,
             …003 ∉ C → phối. Bản 14579 có …006 ∉ P → không phải phối → đi tiếp xuống L1/L2.
             Lệnh cũ được sửa NGAY, không phải khai lại gì.
         L1  cây có dòng phiếu xuất của lệnh khai 'Chính'        → tính
         L2  cây KHÔNG có dòng phiếu xuất nào của lệnh           → tính (cấp tay; có cảnh báo riêng)
             còn lại (chỉ có dòng 'Phối')                        → không tính
   Sơ đồ Kieu là nút GHI ĐÈ cho ca luật B không suy được (bản ghi toàn cây dùng chung). Mọi sơ đồ
   hiện có đều NULL cho tới khi người dùng khai.

   ⚠️ Biểu thức sinh ra nằm trong WHERE (EXISTS / subquery vô hướng), KHÔNG nằm trong SUM() —
   không dính Msg 130 (bài học v7.62).
   ⚠️ Không cache kết quả dò cột (bài học v8.91: cache sống qua migration ⇒ hai nơi lệch nhau).
   ================================================================================================ */
const { sql } = require('../db');

async function coKieuSoDo(pool) {
  try {
    const r = (await pool.request().query(`SELECT COL_LENGTH('DonHangChiTietSoDo','Kieu') AS a`)).recordset[0] || {};
    return r.a != null;
  } catch (e) { return false; }
}

/* Lệnh đã khai KieuVai ở ít nhất một dòng phiếu xuất vải chưa? (quyết định L3) */
async function donCoKhaiKieuVai(pool, donHangId) {
  const r = await pool.request().input('id', sql.Int, donHangId).query(`
    SELECT TOP 1 1 AS c FROM PhieuXuatVaiChiTiet px
    JOIN PhieuXuatVai p ON p.PhieuXuatID = px.PhieuXuatID
    WHERE p.DonHangID = @id AND px.KieuVai IS NOT NULL`);
  return r.recordset.length > 0;
}

/* `bieuThucDon` = cách câu SQL gọi nhắc tới DonHangID của lệnh: số nguyên đọc từ CSDL (qlsx.js nối
   thẳng) HOẶC tên tham số như '@id' (khohang.js / bangke.js). Không nhận gì khác — đây là mảnh SQL
   nối chuỗi, một ký tự lạ lọt vào là một đường tiêm. */
function chuanBieuThucDon(bieuThucDon) {
  if (typeof bieuThucDon === 'number' && Number.isInteger(bieuThucDon)) return String(bieuThucDon);
  if (typeof bieuThucDon === 'string' && /^@[A-Za-z_]\w*$/.test(bieuThucDon)) return bieuThucDon;
  if (typeof bieuThucDon === 'string' && /^\d+$/.test(bieuThucDon)) return bieuThucDon;
  throw new Error('cayThanhPham: bieuThucDon phải là số nguyên hoặc tên tham số @xxx, nhận: ' + String(bieuThucDon));
}

/* Luật B — BẢN GHI Cắt chứa dòng `aliasCay` là một lần cắt PHỐI? (biểu thức boolean, true = phối)
   `bieuThucDon` ở đây có thể là số, '@ten', HOẶC một cột tương quan như 't.DonHangID' (bản mọi lệnh). */
function bieuThucBanGhiLaPhoi(aliasCay, donSql) {
  const c = aliasCay;
  return `(
            /* mọi cây của bản ghi đều có dòng xuất 'Phối' của lệnh */
            NOT EXISTS (SELECT 1 FROM TienDoCatChiTietCay cb
                        WHERE cb.TienDoID = ${c}.TienDoID
                          AND NOT EXISTS (SELECT 1 FROM PhieuXuatVaiChiTiet pxb
                                          JOIN PhieuXuatVai pb ON pb.PhieuXuatID = pxb.PhieuXuatID
                                          WHERE pxb.CayID = cb.CayID AND pb.DonHangID = ${donSql}
                                            AND pxb.KieuVai = N'Phối'))
            /* và ít nhất một cây của bản ghi KHÔNG có dòng xuất 'Chính' nào của lệnh */
            AND EXISTS (SELECT 1 FROM TienDoCatChiTietCay cb2
                        WHERE cb2.TienDoID = ${c}.TienDoID
                          AND NOT EXISTS (SELECT 1 FROM PhieuXuatVaiChiTiet pxc
                                          JOIN PhieuXuatVai pc ON pc.PhieuXuatID = pxc.PhieuXuatID
                                          WHERE pxc.CayID = cb2.CayID AND pc.DonHangID = ${donSql}
                                            AND pxc.KieuVai = N'Chính'))
          )`;
}

/* Luật theo CÂY (L1/L2) — y nguyên dieuKienCayChinh() cũ của qlsx.js. */
function bieuThucCayLaChinh(aliasCay, donSql) {
  return `(
            EXISTS (SELECT 1 FROM PhieuXuatVaiChiTiet px
                    JOIN PhieuXuatVai p ON p.PhieuXuatID = px.PhieuXuatID
                    WHERE px.CayID = ${aliasCay}.CayID AND p.DonHangID = ${donSql}
                      AND px.KieuVai = N'Chính')
            OR NOT EXISTS (SELECT 1 FROM PhieuXuatVaiChiTiet px2
                           JOIN PhieuXuatVai p2 ON p2.PhieuXuatID = px2.PhieuXuatID
                           WHERE px2.CayID = ${aliasCay}.CayID AND p2.DonHangID = ${donSql})
          )`;
}

/* L3 → '' ; còn lại → "(KHÔNG phải bản ghi phối) AND (cây là chính)". */
function dieuKienTheoCay(aliasCay, bieuThucDon, coKhaiKieu) {
  if (!coKhaiKieu) return '';   // L3
  const d = chuanBieuThucDon(bieuThucDon);
  return `(NOT ${bieuThucBanGhiLaPhoi(aliasCay, d)} AND ${bieuThucCayLaChinh(aliasCay, d)})`;
}

/* Kiểu của SƠ ĐỒ chứa dòng sổ cắt `aliasCay` — subquery vô hướng, NULL khi không gắn sơ đồ. */
function bieuThucKieuSoDo(aliasCay) {
  return `(SELECT sd.Kieu FROM TienDoSanXuat tsd
           JOIN DonHangChiTietSoDo sd ON sd.ID = tsd.SoDoID
           WHERE tsd.TienDoID = ${aliasCay}.TienDoID)`;
}

/* ============================================================================================
   MẢNH WHERE HOÀN CHỈNH, bắt đầu bằng "AND " (hoặc rỗng khi không có gì để lọc).
   aliasCay     bí danh của TienDoCatChiTietCay trong câu gọi (thường 'cc')
   bieuThucDon  DonHangID của lệnh: số nguyên hoặc '@ten'
   coKhaiKieu   kết quả donCoKhaiKieuVai()
   coKieuSoDo   kết quả coKieuSoDo() — chưa chạy migration_v880 thì chỉ còn luật theo cây
   ============================================================================================ */
function dieuKienCayThanhPham(aliasCay, bieuThucDon, coKhaiKieu, coKieuSoDo) {
  const theoCay = dieuKienTheoCay(aliasCay, bieuThucDon, coKhaiKieu);
  if (!coKieuSoDo) return theoCay ? `AND ${theoCay}` : '';
  const kieuSD = bieuThucKieuSoDo(aliasCay);
  if (!theoCay) {
    // L3: chỉ còn sơ đồ để phân biệt — gạt sơ đồ Phối, giữ mọi thứ khác.
    return `AND ISNULL(${kieuSD}, N'') <> N'Phối'`;
  }
  return `AND (
            ${kieuSD} = N'Chính'
            OR (${kieuSD} IS NULL AND ${theoCay})
          )`;
}

/* Cùng luật, nhưng cho câu CHẠY TRÊN MỌI LỆNH (không có DonHangID cụ thể) — ví dụ CTE heCat của
   danh sách lệnh SX. `aliasTienDo` là bí danh TienDoSanXuat đã JOIN sẵn (có DonHangID + SoDoID);
   L3 được tính bằng NOT EXISTS tương quan theo lệnh. */
function dieuKienCayThanhPhamMoiLenh(aliasCay, aliasTienDo, coKieuSoDo) {
  const t = aliasTienDo, c = aliasCay;
  if (!/^[A-Za-z_]\w*$/.test(t) || !/^[A-Za-z_]\w*$/.test(c)) throw new Error('cayThanhPham: bí danh không hợp lệ');
  const don = `${t}.DonHangID`;
  const lenhChuaKhaiKieu = `NOT EXISTS (SELECT 1 FROM PhieuXuatVaiChiTiet px3
                            JOIN PhieuXuatVai p3 ON p3.PhieuXuatID = px3.PhieuXuatID
                            WHERE p3.DonHangID = ${don} AND px3.KieuVai IS NOT NULL)`;
  // L3 cho lệnh chưa khai; còn lại = (không phải bản ghi phối) AND (cây là chính) — cùng mảnh với bản một lệnh.
  const theoCay = `(${lenhChuaKhaiKieu}
             OR (NOT ${bieuThucBanGhiLaPhoi(c, don)} AND ${bieuThucCayLaChinh(c, don)}))`;
  if (!coKieuSoDo) return `AND ${theoCay}`;
  const kieuSD = `(SELECT sd.Kieu FROM DonHangChiTietSoDo sd WHERE sd.ID = ${t}.SoDoID)`;
  return `AND (
            ${kieuSD} = N'Chính'
            OR (${kieuSD} IS NULL AND ${theoCay})
          )`;
}

module.exports = {
  coKieuSoDo, donCoKhaiKieuVai,
  dieuKienCayThanhPham, dieuKienCayThanhPhamMoiLenh,
  bieuThucKieuSoDo, bieuThucBanGhiLaPhoi, bieuThucCayLaChinh
};
