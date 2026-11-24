/* ================================================================================================
   v9.75 — HÀNG KÝ GỬI ĐANG Ở KHÁCH (dùng chung)
   Nguyen 17/11/2026: ~30 khách ký gửi, mỗi khách nhiều mặt hàng; khách bán được mới trả tiền, trừ 12%.

   Hàng ký gửi VẪN LÀ TỒN KHO của công ty (VAS: hàng gửi bán — TK 157), nên phiếu ký gửi KHÔNG trừ
   XuatCai. Nó chỉ làm bớt KHẢ DỤNG: banhang.layHangDangGiu cộng thêm số này (cùng chỗ với đơn khách
   đặt đang giữ) ⇒ Thẻ kho / lên đơn / catalogue tự thấy "đang giữ" mà không sửa màn nào.

   MỘT công thức "còn ở khách" cho mọi màn (sổ ký gửi, báo bán, trả về, khả dụng):
       Còn = SoLuongCai − Σ báo bán (dòng PhieuBanHang chưa hủy có KyGuiCTID) − Σ trả (PhieuKyGuiTra chưa hủy)
   Viết SQL ở đây một lần; nơi khác gọi, không chép lại.
   ================================================================================================ */
const { slSangDonViChinh } = require('./banHangCommon');

let __coBang = null;
async function coBangKyGui(pool) {
  if (__coBang === null) {
    try { __coBang = (await pool.request().query("SELECT OBJECT_ID('PhieuKyGuiChiTiet') AS o")).recordset[0].o != null; }
    catch (e) { __coBang = false; }
  }
  return __coBang;
}
let __coCotKG = null;
async function coCotKyGuiCT(pool) {
  if (__coCotKG === null) {
    try { __coCotKG = (await pool.request().query("SELECT COL_LENGTH('PhieuBanHangChiTiet','KyGuiCTID') AS c")).recordset[0].c != null; }
    catch (e) { __coCotKG = false; }
  }
  return __coCotKG;
}

/* Biểu thức SQL cho 2 vế trừ, theo bí danh dòng ký gửi `kc` (PhieuKyGuiChiTiet). Subquery tương quan
   trong SELECT — KHÔNG đặt trong SUM/AVG (Msg 130). */
function SQL_DA_BAO_BAN(bd) {
  return `ISNULL((SELECT SUM(bh.SoLuongCai) FROM PhieuBanHangChiTiet bh JOIN PhieuBanHang pb ON pb.PhieuBHID = bh.PhieuBHID
                   WHERE bh.KyGuiCTID = ${bd}.ID AND pb.TrangThai <> N'Đã hủy'), 0)`;
}
function SQL_DA_TRA(bd) {
  return `ISNULL((SELECT SUM(tc.SoLuongCai) FROM PhieuKyGuiTraChiTiet tc JOIN PhieuKyGuiTra pt ON pt.PhieuKGTID = tc.PhieuKGTID
                   WHERE tc.KyGuiCTID = ${bd}.ID AND pt.TrangThai <> N'Đã hủy'), 0)`;
}

/* Dòng ký gửi còn ở khách (ConCai > 0 hoặc tatCa). Lọc theo tên khách (khóa công nợ) nếu có. */
async function dongKyGuiOKhach(pool, sql, opts) {
  const o = opts || {};
  if (!(await coBangKyGui(pool))) return [];
  const rq = pool.request();
  let dk = "WHERE p.TrangThai <> N'Đã hủy'";
  if (o.tenKhach) { rq.input('ten', sql.NVarChar, String(o.tenKhach).trim()); dk += ' AND LTRIM(RTRIM(p.TenKhach)) = @ten'; }
  if (o.phieuKGID) { rq.input('pid', sql.Int, Number(o.phieuKGID)); dk += ' AND p.PhieuKGID = @pid'; }
  const coKG = await coCotKyGuiCT(pool);
  const rows = (await rq.query(`
    SELECT kc.ID AS KyGuiCTID, p.PhieuKGID, p.SoPhieu, CONVERT(varchar(10), p.Ngay, 23) AS Ngay, p.TenKhach, p.KhachHangID, p.PhanTramCK,
           kc.MaHangID, h.MaHang, h.TenHang, h.LoaiRi, h.DonViCoBan, h.DonViQuyDoi, h.AnhDaiDien,
           kc.MauSacID, ms.TenMau, kc.SoLuongCai, kc.GiaBanLe, kc.GhiChu,
           ${coKG ? SQL_DA_BAO_BAN('kc') : '0'} AS DaBaoBanCai,
           ${SQL_DA_TRA('kc')} AS DaTraCai
    FROM PhieuKyGuiChiTiet kc
    JOIN PhieuKyGui p ON p.PhieuKGID = kc.PhieuKGID
    JOIN TheKhoHangHoa h ON h.MaHangID = kc.MaHangID
    LEFT JOIN MauSac ms ON ms.MauSacID = kc.MauSacID
    ${dk}
    ORDER BY p.TenKhach, p.Ngay, p.PhieuKGID, kc.ID`)).recordset;
  const so = (v) => Number(v) || 0;
  return rows
    .map(r => Object.assign(r, { ConCai: Math.max(0, so(r.SoLuongCai) - so(r.DaBaoBanCai) - so(r.DaTraCai)) }))
    .filter(r => o.tatCa || r.ConCai > 0);
}

/* Số đang ở khách gom theo mã|màu, ĐƠN VỊ CHÍNH (khớp layHangDangGiu). Không ném: lỗi ⇒ Map rỗng. */
async function kyGuiDangGiu(pool, sql) {
  const theoMau = new Map(), theoMaHang = new Map();
  try {
    const rows = await dongKyGuiOKhach(pool, sql, {});
    rows.forEach(r => {
      const sl = slSangDonViChinh(r.ConCai, 'Cái', r.DonViCoBan, r.LoaiRi, r);
      if (!sl) return;
      const k = r.MaHangID + '|' + r.MauSacID;
      theoMau.set(k, (theoMau.get(k) || 0) + sl);
      theoMaHang.set(r.MaHangID, (theoMaHang.get(r.MaHangID) || 0) + sl);
    });
  } catch (e) { console.error('[kyGuiDangGiu] ' + e.message); }
  return { theoMau, theoMaHang };
}

module.exports = { coBangKyGui, coCotKyGuiCT, dongKyGuiOKhach, kyGuiDangGiu, SQL_DA_BAO_BAN, SQL_DA_TRA };
