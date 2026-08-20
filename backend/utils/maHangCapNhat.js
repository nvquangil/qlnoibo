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

  return { doiMa: (ma && ma !== chuanMaHang(cu.MaHang)) ? { tu: cu.MaHang, den: ma } : null };
}

module.exports = { capNhatMaHang, chuanMaHang };
