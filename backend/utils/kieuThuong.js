/* ================================================================================================
   v9.73 — KIỂU THƯỞNG NHIỀU LOẠI (Nguyen 17/11/2026: "kiểu thưởng có thể chọn 2 hoặc 3 kiểu, áp dụng cả các kiểu đã
   chọn trong tính lương").
   Lưu ở HopDongLaoDong.KieuThuong dạng chuỗi "KPI,SanPham,ChuyenCan" (thứ tự chuẩn, không khoảng trắng; migration_v899
   nới cột NVARCHAR(50), bỏ CHECK). Giá trị cũ một kiểu ('KPI') vẫn là chuỗi hợp lệ — mọi nơi đọc qua tachKieuThuong(),
   KHÔNG so sánh === với cột nữa. Thuần, không CSDL — dùng chung backend (và sao chép luật sang module.hrm.js tachKieu()).
   ================================================================================================ */
const THU_TU = ['KPI', 'SanPham', 'ChuyenCan'];
/* 'KPI,SanPham' | ['SanPham','KPI'] | 'kpi' (sai hoa thường ⇒ bỏ) ⇒ ['KPI','SanPham'] theo THU_TU, không trùng. */
function tachKieuThuong(v) {
  const ds = Array.isArray(v) ? v : String(v == null ? '' : v).split(/[,;|\s]+/);
  const co = new Set(ds.map(s => String(s || '').trim()).filter(s => THU_TU.includes(s)));
  return THU_TU.filter(k => co.has(k));
}
/* Mảng ⇒ chuỗi lưu CSDL; rỗng ⇒ null (= Không). */
function ghepKieuThuong(v) { const ds = tachKieuThuong(v); return ds.length ? ds.join(',') : null; }
function coKieu(v, kieu) { return tachKieuThuong(v).includes(kieu); }
const TEN_KIEU = { KPI: 'KPI', SanPham: 'Sản phẩm', ChuyenCan: 'Chuyên cần bậc thang' };
function nhanKieu(v) { const ds = tachKieuThuong(v); return ds.length ? ds.map(k => TEN_KIEU[k]).join(' + ') : 'Không'; }

module.exports = { THU_TU, TEN_KIEU, tachKieuThuong, ghepKieuThuong, coKieu, nhanKieu };
