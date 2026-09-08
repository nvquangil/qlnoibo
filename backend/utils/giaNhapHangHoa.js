/* ================================================================================================
   GIA NHAP CUA MA HANG  (v7.88)

   Nguyen: "danh muc hang hoa (ma hang) them cot gia nhap" -> chot: TU TINH tu phieu nhap kho, theo
   DVT CHINH (cung don vi voi cot Gia ban); rieng "nhap tu san xuat lay tu gia thanh 1 cai".

   ⚠️ BAN CONG THUC NAY DA CO TU v6.91 trong routes/baocao.js (bao cao Ton kho hang hoa). Tach ra
   day de DANH MUC HANG HOA dung LAI dung con so do. Viet ban thu hai la hai man hinh cung goi
   "gia nhap" ma ra hai so khac nhau — nguoi dung khong biet tin cai nao, va do ra thi phai doc ca
   hai cau SQL moi hieu vi sao lech.

   HAI NGUON, UU TIEN A TRUOC:
     A) HANG MUA NGOAI — BINH QUAN GIA QUYEN tu phieu nhap cua NHA CUNG CAP:
            gia = SUM(ThanhTien) / SUM(SoLuongChinh)
        Chia cho SoLuongChinh (KHONG phai SoLuong) de ra dung DON VI CHINH.
        Chi tinh dong CO TIEN (ThanhTien > 0): dong gia 0 keo binh quan tut xuong sai.
        ⚠️ KHONG lay "lan nhap gan nhat": mot lo mua le gia cao la ca ma nhin nhu dat len, trong khi
        tien that da bo ra la binh quan. Bao cao ton kho dang dung BQGQ — hai cho phai giong nhau.
     B) HANG TU SAN XUAT — phieu loai 'SanXuat' LUON co DonGia = 0 (nhapkho.js khong sinh cong no
        ao), nen khong the lay gia tu phieu. Lay GIA THANH 1 CAI da chot trong bang GiaVonHangHoa
        (nut "Nạp từ lệnh SX" o Bao cao -> Gia von).
     Ma vua mua ngoai vua tu san xuat -> uu tien A: tien THAT da bo ra nam o phieu NCC.

   ⚠️ DON VI CUA HAI NGUON KHAC NHAU:
        A da la gia 1 DON VI CHINH      -> giu nguyen
        B la gia 1 DON VI GOC (1 Cai)   -> ma nao co DON VI CHINH LA DON VI GOP thi phai NHAN he so
   Bo qua cho nay la ma quan theo Ri hien gia nhap be gap <he so> lan so voi gia ban.
   ================================================================================================ */
const { so } = require('./banHangCommon');

async function coBang(pool, ten) {
  try {
    const r = (await pool.request().query(`SELECT OBJECT_ID('dbo.${ten}', 'U') AS t`)).recordset[0] || {};
    return r.t != null;
  } catch (e) { return false; }
}

/* Tra ve Map(MaHangID -> { gia, goc, nguon }).
     gia   : con so
     goc   : true = gia theo DON VI GOC, phai nhan he so neu don vi chinh la gop (xem giaTheoDvChinh)
     nguon : chuoi de hien cho nguoi dung biet so nay o dau ra */
async function mapGiaNhap(pool) {
  const map = new Map();
  if (!await coBang(pool, 'PhieuNhapKhoHangChiTiet')) return map;
  const coGiaVon = await coBang(pool, 'GiaVonHangHoa');
  const rs = (await pool.request().query(`
    SELECT h.MaHangID,
           bq.SoLuong AS SLMua, bq.SoTien AS TienMua,
           ${coGiaVon ? 'gv.GiaVon, gv.NguonGia, gv.MaDHNguon' : 'NULL AS GiaVon, NULL AS NguonGia, NULL AS MaDHNguon'}
    FROM TheKhoHangHoa h
    OUTER APPLY (
      SELECT ISNULL(SUM(ct.SoLuongChinh), 0) AS SoLuong, ISNULL(SUM(ct.ThanhTien), 0) AS SoTien
      FROM PhieuNhapKhoHangChiTiet ct
      JOIN PhieuNhapKhoHang p ON p.PhieuNKID = ct.PhieuNKID
      WHERE ct.MaHangID = h.MaHangID AND p.TrangThai <> N'Đã hủy'
        AND p.LoaiNhap = N'NhaCungCap' AND ISNULL(ct.ThanhTien, 0) > 0
    ) bq
    ${coGiaVon ? 'LEFT JOIN GiaVonHangHoa gv ON gv.MaHangID = h.MaHangID' : ''}`)).recordset;
  rs.forEach(r => {
    const slMua = so(r.SLMua), tienMua = so(r.TienMua);
    if (slMua > 0 && tienMua > 0) {
      map.set(r.MaHangID, { gia: tienMua / slMua, goc: false, nguon: 'Phiếu nhập (BQGQ)' });
    } else if (so(r.GiaVon) > 0) {
      map.set(r.MaHangID, {
        gia: so(r.GiaVon), goc: true,
        nguon: r.NguonGia === 'Lệnh SX' ? (r.MaDHNguon ? 'Lệnh SX ' + r.MaDHNguon : 'Lệnh SX') : (r.NguonGia || 'Khai tay')
      });
    }
  });
  return map;
}

/* Quy gia ve DUNG DON VI CHINH cua ma hang. `mh` can co DonViCoBan / DonViQuyDoi / LoaiRi.
   `laGop` truyen vao la ham donViChinhLaGop cua chinh noi goi — de khong nhan ban them mot ban
   dinh nghia "don vi chinh la don vi gop" thu N trong repo nay. */
function giaTheoDvChinh(gn, mh, laGop) {
  if (!gn) return null;
  const heSo = laGop(mh) ? (so(mh.LoaiRi) || 1) : 1;
  return gn.goc ? gn.gia * heSo : gn.gia;
}

module.exports = { mapGiaNhap, giaTheoDvChinh };
