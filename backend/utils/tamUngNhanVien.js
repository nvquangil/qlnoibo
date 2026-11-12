/* ================================================================================================
   tamUngNhanVien.js  —  v9.32

   TẠM ỨNG CỦA NHÂN VIÊN = TỔNG PHIẾU CHI, KHÔNG PHẢI SỐ GÕ TAY VÀO BẢNG LƯƠNG.

   🔴 LÝ DO (đọc trước khi đổi): `POST /bangluong/tinh` trong routes/payroll.js làm
       DELETE FROM BangLuongChiTiet WHERE BangLuongID=@id
       ... INSERT ... TamUng = <giá trị>
   tức MỖI LẦN TÍNH LẠI là viết đè toàn bộ. Nếu tạm ứng được ghi vào bảng lương lúc lập phiếu chi
   thì một lần bấm "Tính lương" là mất sạch, ThucLinh tăng đúng bằng số đã ứng ⇒ **trả thừa tiền,
   im lặng**. Cùng họ với lỗi `DaTraCai` về 0 khi sửa phiếu bán hàng (v7.59, vá ở v9.08).

   Nên nguồn sự thật là PHIẾU CHI; bảng lương CỘNG LẠI từ đây mỗi lần tính. Tính bao nhiêu lần
   cũng ra đúng một con số.

   Điều kiện một phiếu chi được tính là tạm ứng của tháng (nam, thang):
     · LoaiDoiTuong = N'NhanVien'  VÀ  NhanVienID IS NOT NULL
     · LoaiChiNV    = N'TamUng'          (các loại khác: hoàn ứng, công tác phí… KHÔNG trừ lương)
     · Tháng trừ   = TruLuongNam/TruLuongThang nếu có khai, KHÔNG có thì lùi về tháng của NgayChi
       (phiếu lập trước khi có ô "trừ vào lương tháng" vẫn vào đúng kỳ, không rơi mất).
   ================================================================================================ */
const { sql } = require('../db');

const LOAI_TAM_UNG = 'TamUng';

/* Dò cột một lần — máy chưa chạy migration_v886 thì mọi hàm ở đây trả rỗng/0, KHÔNG nổ và
   KHÔNG làm sai bảng lương (coi như chưa có tạm ứng nào). */
let __coCot = null;
async function coCotTamUng(pool) {
  if (__coCot === null) {
    try {
      const r = (await pool.request().query(
        `SELECT COL_LENGTH('PhieuChi','NhanVienID') AS a, COL_LENGTH('PhieuChi','LoaiChiNV') AS b,
                COL_LENGTH('PhieuChi','TruLuongThang') AS c`)).recordset[0] || {};
      __coCot = r.a != null && r.b != null && r.c != null;
    } catch (e) { __coCot = false; }
  }
  return __coCot;
}
function xoaCacheCot() { __coCot = null; }   // sau khi chạy migration mà chưa restart

/* Mệnh đề dùng chung — viết MỘT lần để tổng ở bảng lương và danh sách chi tiết không bao giờ lệch. */
const DIEU_KIEN = `
      pc.LoaiDoiTuong = N'NhanVien' AND pc.NhanVienID IS NOT NULL
  AND pc.LoaiChiNV = N'${LOAI_TAM_UNG}'
  AND ISNULL(pc.TruLuongNam,   YEAR(pc.NgayChi))  = @nam
  AND ISNULL(pc.TruLuongThang, MONTH(pc.NgayChi)) = @thang`;

/* Map NhanVienID -> tổng tạm ứng của tháng. Dùng khi TÍNH bảng lương. */
async function tongTamUngTheoThang(pool, nam, thang) {
  const m = new Map();
  if (!(await coCotTamUng(pool))) return m;
  const rows = (await pool.request().input('nam', sql.Int, nam).input('thang', sql.Int, thang).query(`
    SELECT pc.NhanVienID, SUM(pc.SoTien) AS Tong
    FROM PhieuChi pc
    WHERE ${DIEU_KIEN}
    GROUP BY pc.NhanVienID`)).recordset;
  rows.forEach(r => m.set(Number(r.NhanVienID), Number(r.Tong) || 0));
  return m;
}

/* Danh sách TỪNG PHIẾU của một nhân viên trong tháng — để kế toán bấm vào con số mà soi, thay vì
   phải tin. Không có cái này thì "tự tính" biến thành hộp đen. */
async function chiTietTamUng(pool, nhanVienId, nam, thang) {
  if (!(await coCotTamUng(pool))) return [];
  return (await pool.request()
    .input('nv', sql.Int, nhanVienId).input('nam', sql.Int, nam).input('thang', sql.Int, thang).query(`
    SELECT pc.PhieuChiID, pc.SoPhieu, pc.NgayChi, pc.SoTien, pc.HinhThuc, pc.DienGiai
    FROM PhieuChi pc
    WHERE pc.NhanVienID = @nv AND ${DIEU_KIEN}
    ORDER BY pc.NgayChi, pc.PhieuChiID`)).recordset;
}

module.exports = { tongTamUngTheoThang, chiTietTamUng, coCotTamUng, xoaCacheCot, LOAI_TAM_UNG, DIEU_KIEN };
