/* ================================================================================================
   CAP NHAT CAC TRUONG "CAP MA HANG" CUA TheKhoHangHoa  (v6.98)

   Dung chung boi:
     - routes/danhmuc.js  : PUT /danhmuc/hanghoa/:id  (man Danh muc -> Hang hoa)
     - routes/nhapkho.js  : dong khai tren phieu nhap kho (Gia ban, Loai hang, Danh muc the kho,
                            Barcode, 2 DVT, ty le) — de khong phai sang man khac sua
   MOT ban duy nhat: hai cho sua cung mot bo truong ma viet hai doan SQL rieng thi som muon lech
   (vd mot ben boc ISNULL, mot ben khong -> ben khong boc se xoa trang du lieu).

   ⚠️ ISNULL o MOI truong: form nao cung chi gui nhung o no co. Khong boc ISNULL thi gui thieu mot
   truong la XOA TRANG truong do — dung loi da co o PUT /khohang/items/:id.
   ⚠️ KHONG dung den NhapCai / XuatCai / ton kho o day. Day chi la thong tin danh muc.
   ================================================================================================ */
const { sql } = require('../db');

const chuanMaHang = (x) => String(x == null ? '' : x).trim().toUpperCase();

/* `f` = { maHang, tenHang, donViCoBan, donViQuyDoi, loaiRi, giaBan, nhomSanPhamId,
           theKhoDanhMucId, maBarcode }  — truong nao khong gui / rong thi GIU NGUYEN gia tri cu.
   Tra ve { doiMa: <ma moi neu co doi> } de ben goi bao lai cho nguoi dung. */
async function capNhatMaHang(pool, tran, maHangId, f) {
  const rq = () => (tran ? new sql.Request(tran) : pool.request());
  const cu = (await rq().input('id', sql.Int, maHangId)
    .query('SELECT MaHangID, MaHang FROM TheKhoHangHoa WHERE MaHangID = @id')).recordset[0];
  if (!cu) throw new Error('Không tìm thấy mã hàng #' + maHangId);

  const ma = chuanMaHang(f.maHang);
  if (ma && ma !== chuanMaHang(cu.MaHang)) {
    const trung = (await rq().input('m', sql.NVarChar, ma).input('id', sql.Int, maHangId)
      .query('SELECT MaHangID FROM TheKhoHangHoa WHERE MaHang = @m AND MaHangID <> @id')).recordset[0];
    if (trung) throw new Error(`Mã hàng "${ma}" đã có ở dòng khác.`);
  }

  /* ⚠️ ĐỔI ĐVT / TỶ LỆ CỦA MÃ ĐANG CÓ TỒN LÀ DIỄN GIẢI LẠI TOÀN BỘ SỐ CŨ.
     Con số trong kho (NhapCai, SoLuongChinh trên phiếu) KHÔNG đổi, nhưng ý nghĩa của nó đổi: 30 với
     tỷ lệ 5 là 150 cái, còn tỷ lệ 1 là 30 cái. Nên phải báo ra, không được đổi im lặng.
     (Đây chính là gốc lỗi "phiếu bán hàng mất 2 Ri5, chỉ còn đỏ 5": một đường ghi ở v6.98 đã ghi đè
      LoaiRi của mã đang có tồn xuống 1.) */
  const doiDonVi = [];
  const cuDayDu = (await rq().input('id', sql.Int, maHangId)
    .query('SELECT LoaiRi, DonViCoBan, DonViQuyDoi FROM TheKhoHangHoa WHERE MaHangID=@id')).recordset[0] || {};
  const khac = (a, b) => String(a == null ? '' : a).trim().toLowerCase() !== String(b == null ? '' : b).trim().toLowerCase();
  if (f.loaiRi != null && f.loaiRi !== '' && Number(f.loaiRi) !== Number(cuDayDu.LoaiRi)) {
    doiDonVi.push(`tỷ lệ ${cuDayDu.LoaiRi} → ${f.loaiRi}`);
  }
  if (f.donViCoBan && khac(f.donViCoBan, cuDayDu.DonViCoBan)) doiDonVi.push(`ĐVT chính ${cuDayDu.DonViCoBan} → ${f.donViCoBan}`);
  if (f.donViQuyDoi && khac(f.donViQuyDoi, cuDayDu.DonViQuyDoi)) doiDonVi.push(`ĐVT quy đổi ${cuDayDu.DonViQuyDoi} → ${f.donViQuyDoi}`);

  const soHay = (v) => (v === '' || v === null || v === undefined) ? null : v;
  await rq()
    .input('id', sql.Int, maHangId)
    .input('MaHang', sql.NVarChar, ma || null)
    .input('TenHang', sql.NVarChar, String(f.tenHang || '').trim() || null)
    .input('DonViCoBan', sql.NVarChar, String(f.donViCoBan || '').trim() || null)
    .input('DonViQuyDoi', sql.NVarChar, String(f.donViQuyDoi || '').trim() || null)
    .input('LoaiRi', sql.Int, soHay(f.loaiRi) == null ? null : Math.max(1, parseInt(f.loaiRi, 10) || 1))
    .input('GiaBan', sql.Decimal(14, 2), soHay(f.giaBan))
    .input('NhomSanPhamID', sql.Int, soHay(f.nhomSanPhamId))
    .input('TheKhoDanhMucID', sql.Int, soHay(f.theKhoDanhMucId))
    .input('MaBarcode', sql.NVarChar, String(f.maBarcode || '').trim() || null)
    .query(`UPDATE TheKhoHangHoa SET
              MaHang          = ISNULL(@MaHang, MaHang),
              TenHang         = ISNULL(@TenHang, TenHang),
              DonViCoBan      = ISNULL(@DonViCoBan, DonViCoBan),
              DonViQuyDoi     = ISNULL(@DonViQuyDoi, DonViQuyDoi),
              LoaiRi          = ISNULL(@LoaiRi, LoaiRi),
              GiaBan          = ISNULL(@GiaBan, GiaBan),
              NhomSanPhamID   = ISNULL(@NhomSanPhamID, NhomSanPhamID),
              TheKhoDanhMucID = ISNULL(@TheKhoDanhMucID, TheKhoDanhMucID),
              MaBarcode       = ISNULL(@MaBarcode, MaBarcode)
            WHERE MaHangID = @id`);

  return {
    doiMa: (ma && ma !== chuanMaHang(cu.MaHang)) ? { tu: cu.MaHang, den: ma } : null,
    doiDonVi   // rong = khong doi gi ve don vi/ty le
  };
}

module.exports = { capNhatMaHang, chuanMaHang };
