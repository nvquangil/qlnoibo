/* ================================================================================================
   v9.67 — SẢN LƯỢNG THEO LỆNH SẢN XUẤT ⇒ THƯỞNG THEO SẢN PHẨM TỰ ĐỘNG (migration_v895)

   Nguyen 16/11/2026: "Ký hợp đồng có nhân viên trả thưởng theo kiểu sản phẩm. Phần chỉ định sản xuất thêm
   trường nhân viên may mẫu, chọn trong list nhân viên. Phần tính lương sẽ cập nhật từ đây." · "Thêm chức
   năng cập nhật ảnh, video gán theo lệnh sản xuất — số lượng ảnh, video theo danh mục trong ký hợp đồng
   KPI theo sản phẩm (SL × đơn giá), phần tính lương sẽ cập nhật từ đây không phải cập nhật tay."

   MỘT bảng `SanLuongTheoLenh` cho mọi loại sản phẩm (may mẫu, ảnh, video, ... — bất kỳ tên nào khai ở
   Danh mục sản phẩm của hợp đồng). Mỗi dòng: lệnh + người + tên SP + SL + ngày. Hai nguồn:
     · 'MayMau' — tự sinh từ ô "Nhân viên may mẫu" của lệnh (1 dòng/lệnh, SL = 1, Ngay = NgayDat của lệnh).
     · 'Tay'    — tab QLSX › "Sản lượng theo lệnh" (ảnh, video...): chọn lệnh, người, SP theo hợp đồng, gõ SL.
   ĐƠN GIÁ KHÔNG LƯU Ở ĐÂY — bộ tính lương tra từ `HopDongSanPham` của hợp đồng hiệu lực tháng đó, khớp
   theo TÊN (không phân biệt hoa/thường, gộp khoảng trắng). Sửa đơn giá ở hợp đồng ⇒ tháng chưa chốt tự
   đúng. Tên không khớp ⇒ 0 đồng + cảnh báo ở tab Đánh giá KPI / sản phẩm (không ném lỗi, không đoán).
   Thưởng tháng = Σ(SL × đơn giá) các dòng có Ngay trong tháng + bảng nhập tay `ThuongSanPhamThang` (v890,
   giữ cho sản phẩm ngoài lệnh). Cùng tên ở hai nguồn thì CỘNG — nhập tay là phần phát sinh thêm.
   ================================================================================================ */
const { sql } = require('../db');
const bangLuongTuDong = require('./bangLuongTuDong');

const khoaTen = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
const ngayHopLe = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : null;

async function coBang(pool) {
  try { return (await pool.request().query("SELECT OBJECT_ID('SanLuongTheoLenh', 'U') AS c")).recordset[0].c != null; }
  catch (e) { return false; }
}
async function coCotMayMau(pool) {
  try { return (await pool.request().query("SELECT COL_LENGTH('DonHangSanXuat', 'NhanVienMayMauID') AS c")).recordset[0].c != null; }
  catch (e) { return false; }
}
/* v9.81 (migration_v905): dòng "Làm lại mã cũ" — không gắn lệnh SX nào, gõ tay mã hàng. Dò CỘT MỖI LẦN,
   không nhớ: máy chạy migration giữa chừng vẫn phải nhận ra ngay (bài học chung của mọi cột mới). */
async function coCotMaHangCu(pool) {
  try { return (await pool.request().query("SELECT COL_LENGTH('SanLuongTheoLenh', 'MaHangCu') AS c")).recordset[0].c != null; }
  catch (e) { return false; }
}

/* Hợp đồng hiệu lực của một người tại một ngày (cùng luật với payroll.js tinhBangLuongThang: Hiệu lực,
   TuNgay ≤ mốc, mới nhất) + danh mục sản phẩm của hợp đồng đó. Không có ⇒ { hopDongId: null, kieuThuong: null, sanPham: [] }. */
async function hopDongTaiNgay(pool, nhanVienId, ngay) {
  const moc = ngayHopLe(ngay) || new Date().toISOString().slice(0, 10);
  const hd = (await pool.request().input('nv', sql.Int, nhanVienId).input('moc', sql.VarChar(10), moc).query(`
    SELECT TOP 1 h.HopDongID, h.KieuThuong FROM HopDongLaoDong h
    WHERE h.NhanVienID = @nv AND h.TrangThai = N'Hiệu lực' AND (h.TuNgay IS NULL OR h.TuNgay <= @moc)
    ORDER BY h.TuNgay DESC, h.HopDongID DESC`)).recordset[0];
  if (!hd) return { hopDongId: null, kieuThuong: null, sanPham: [] };
  const sp = (await pool.request().input('id', sql.Int, hd.HopDongID)
    .query('SELECT TenSanPham, DonGia FROM HopDongSanPham WHERE HopDongID = @id ORDER BY ThuTu, ID')).recordset
    .map(r => ({ TenSanPham: r.TenSanPham, DonGia: Number(r.DonGia) || 0 }));
  return { hopDongId: hd.HopDongID, kieuThuong: hd.KieuThuong || null, sanPham: sp };
}

/* Tên sản phẩm "may mẫu" trong danh mục hợp đồng: dòng có chữ "mẫu"/"mau" (không dấu). Không có ⇒ 'May mẫu'
   (sẽ không khớp ⇒ 0 đồng, tab KPI báo đỏ — người khai hợp đồng thêm SP "May mẫu" là thông). */
function tenMayMauTrong(sanPham) {
  const hit = (sanPham || []).find(x => /m[aẫ]u/i.test(khoaTen(x.TenSanPham)));
  return hit ? hit.TenSanPham : 'May mẫu';
}

/* Đồng bộ dòng Nguon='MayMau' của MỘT lệnh với cột DonHangSanXuat.NhanVienMayMauID.
   Gọi SAU khi đã UPDATE/INSERT lệnh. nhanVienId null ⇒ chỉ xóa. Trả về { ten, donGia, kieuThuong } để màn hình cảnh báo.
   v9.76 (Nguyen 17/11: "nhân viên may mẫu thêm lựa chọn theo danh mục sản phẩm trong ký hợp đồng"): `tenSP` — tên sản phẩm
   người lập lệnh CHỌN từ danh mục hợp đồng của người may mẫu (DonHangSanXuat.MayMauTenSP). Có ⇒ dùng đúng tên đó
   (vd "May mẫu áo" 150k vs "May mẫu quần" 200k); trống ⇒ luật cũ tenMayMauTrong (dòng có chữ "mẫu"). */
async function dongBoMayMau(pool, donHangId, nhanVienId, ngayDat, userId, tenSP) {
  if (!(await coBang(pool))) return null;
  const cu = (await pool.request().input('dh', sql.Int, donHangId)
    .query("SELECT TOP 1 NhanVienID, CONVERT(varchar(10), Ngay, 23) AS Ngay FROM SanLuongTheoLenh WHERE DonHangID = @dh AND Nguon = N'MayMau'")).recordset[0];
  await pool.request().input('dh', sql.Int, donHangId).query("DELETE FROM SanLuongTheoLenh WHERE DonHangID = @dh AND Nguon = N'MayMau'");
  const ngay = ngayHopLe(ngayDat) || new Date().toISOString().slice(0, 10);
  let kq = null;
  const nv = parseInt(nhanVienId, 10) || 0;
  if (nv > 0) {
    const hd = await hopDongTaiNgay(pool, nv, ngay);
    const tenChon = String(tenSP || '').trim().slice(0, 150);
    const ten = tenChon || tenMayMauTrong(hd.sanPham);
    const sp = hd.sanPham.find(x => khoaTen(x.TenSanPham) === khoaTen(ten));
    await pool.request().input('dh', sql.Int, donHangId).input('nv', sql.Int, nv).input('ten', sql.NVarChar(150), ten)
      .input('ngay', sql.VarChar(10), ngay).input('u', sql.Int, userId || null)
      .query(`INSERT INTO SanLuongTheoLenh (DonHangID, NhanVienID, TenSanPham, SoLuong, Ngay, Nguon, GhiChu, NguoiTaoID)
              VALUES (@dh, @nv, @ten, 1, CONVERT(date, @ngay, 23), N'MayMau', N'Tự động từ ô Nhân viên may mẫu của lệnh', @u)`);
    kq = { ten, donGia: sp ? sp.DonGia : 0, khop: !!sp, kieuThuong: hd.kieuThuong };
  }
  /* Tháng cũ (nếu đổi ngày/đổi người) lẫn tháng mới đều phải tính lại. */
  if (cu && cu.Ngay) await bangLuongTuDong.danhDauTheoNgay(pool, cu.Ngay, 'Đổi nhân viên may mẫu của lệnh SX');
  if (nv > 0 || cu) await bangLuongTuDong.danhDauTheoNgay(pool, ngay, 'Chỉ định nhân viên may mẫu (lệnh SX)');
  return kq;
}

/* THƯỞNG THEO SẢN PHẨM TỪ LỆNH của MỘT THÁNG, cho mọi nhân viên có dòng.
   Trả Map<NhanVienID, { tien, dong: [{ TenSanPham, SoLuong, SoLenh, DonGia, ThanhTien, khop }] }>.
   Đơn giá tra từ hợp đồng hiệu lực tại CUỐI THÁNG (cùng mốc với bảng lương). Bảng chưa có ⇒ Map rỗng. */
async function thuongTheoThang(pool, nam, thang) {
  const kq = new Map();
  if (!(await coBang(pool))) return kq;
  const n = parseInt(nam, 10), t = parseInt(thang, 10);
  if (!n || !t) return kq;
  const cuoi = `${n}-${String(t).padStart(2, '0')}-${new Date(n, t, 0).getDate()}`;
  const rows = (await pool.request().input('n', sql.Int, n).input('t', sql.Int, t).query(`
    SELECT NhanVienID, TenSanPham, SUM(SoLuong) AS SoLuong, COUNT(DISTINCT DonHangID) AS SoLenh
    FROM SanLuongTheoLenh WHERE YEAR(Ngay) = @n AND MONTH(Ngay) = @t
    GROUP BY NhanVienID, TenSanPham`)).recordset;
  if (!rows.length) return kq;
  const nvIds = [...new Set(rows.map(r => r.NhanVienID))];
  const hdRows = (await pool.request().input('cuoi', sql.VarChar(10), cuoi).query(`
    SELECT nv.NhanVienID, hd.HopDongID
    FROM NhanVien nv
    OUTER APPLY (SELECT TOP 1 h.HopDongID FROM HopDongLaoDong h WHERE h.NhanVienID = nv.NhanVienID AND h.TrangThai = N'Hiệu lực'
                 AND (h.TuNgay IS NULL OR h.TuNgay <= @cuoi) ORDER BY h.TuNgay DESC, h.HopDongID DESC) hd
    WHERE nv.NhanVienID IN (${nvIds.join(',')})`)).recordset;
  const hdCua = new Map(hdRows.map(r => [r.NhanVienID, r.HopDongID]));
  const hdIds = [...new Set(hdRows.map(r => r.HopDongID).filter(x => x != null))];
  const giaCua = new Map();   // HopDongID -> Map(khoaTen -> DonGia)
  if (hdIds.length) {
    (await pool.request().query(`SELECT HopDongID, TenSanPham, DonGia FROM HopDongSanPham WHERE HopDongID IN (${hdIds.join(',')})`)).recordset
      .forEach(r => { if (!giaCua.has(r.HopDongID)) giaCua.set(r.HopDongID, new Map()); giaCua.get(r.HopDongID).set(khoaTen(r.TenSanPham), Number(r.DonGia) || 0); });
  }
  rows.forEach(r => {
    const bang = giaCua.get(hdCua.get(r.NhanVienID)) || new Map();
    const k = khoaTen(r.TenSanPham);
    const khop = bang.has(k);
    const donGia = khop ? bang.get(k) : 0;
    const sl = Number(r.SoLuong) || 0;
    const tien = Math.round(sl * donGia);
    if (!kq.has(r.NhanVienID)) kq.set(r.NhanVienID, { tien: 0, dong: [] });
    const o = kq.get(r.NhanVienID);
    o.tien += tien;
    o.dong.push({ TenSanPham: r.TenSanPham, SoLuong: sl, SoLenh: Number(r.SoLenh) || 0, DonGia: donGia, ThanhTien: tien, khop });
  });
  return kq;
}

module.exports = { khoaTen, ngayHopLe, coBang, coCotMayMau, coCotMaHangCu, hopDongTaiNgay, tenMayMauTrong, dongBoMayMau, thuongTheoThang };
