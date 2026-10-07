/* ================================================================================================
   CHUONG TRINH KHUYEN MAI - MOT BAN CONG THUC DUY NHAT                                      v8.70
   ------------------------------------------------------------------------------------------------
   Nguyen chot 2026-10-06: chuong trinh khuyen mai KHONG phai mot % cong them. No THAY THE %CKShop
   cho cac ma hang duoc gan, trong khoang thoi gian cua chuong trinh.
       CK dung chung 33%  ->  ma trong chuong trinh: 35%  ->  het han: ve lai 33%

   ⚠️ CONG THUC TINH TIEN KHONG DOI. Phieu ban hang van:
          GiaBan = GiaBanLe - GiaBanLe * %CKShop/100
      File nay chi tra loi DUY NHAT mot cau: "%CKShop cua ma X vao ngay Y la bao nhieu?"

   ⚠️ VIET O DAY, KHONG CHEP RA NHIEU CHO. Ba man hinh se hoi cung cau nay (lap phieu ban hang,
   don khach dat hang, man khai chuong trinh). Viet ban thu hai la som muon hai noi tra ve hai con
   so khac nhau cho cung mot ma hang — dung bai hoc v6.47 / v7.53 (luongGiaCongInThe.js).

   QUY TAC DA CHOT:
     - Chi tinh chuong trinh co TrangThai = 'Hoạt động' VA ngay nam trong [TuNgay, DenNgay].
     - Mot ma nam trong NHIEU chuong trinh con hieu luc -> lay %CK CAO NHAT (co loi cho khach).
       Man khai co canh bao rieng luc nguoi dung them ma bi chong (xem kiemTrungChuongTrinh).
     - %CK cua dong chi tiet (ChuongTrinhKhuyenMaiChiTiet.PhanTramCK) de NULL thi lay % cua
       chuong trinh.
     - Khong co chuong trinh nao -> tra ve null, NOI GOI tu lay CK dung chung tu CauHinhHeThong.
       ⚠️ TUYET DOI khong tra ve 0 trong truong hop nay: 0 nghia la "chiet khau 0%", khac han
       "khong co khuyen mai" — tra nham la ban dung gia niem yet, mat tien that.
   ================================================================================================ */

/* Ngay dung de xet hieu luc. Phieu ban hang phai truyen NGAY CUA PHIEU (NgayBan), KHONG phai ngay
   he thong — lap phieu lui ngay phai ra dung gia cua ngay do. */
function chuanNgay(ngay) {
  if (!ngay) return new Date();
  const d = new Date(ngay);
  return isNaN(d.getTime()) ? new Date() : d;
}

/* Tra ve map: MaHangID -> { PhanTramCK, ChuongTrinhID, TenChuongTrinh }
   maHangIds rong/khong truyen = lay HET ma dang co khuyen mai vao ngay do. */
async function layKhuyenMaiTheoNgay(pool, sql, ngay, maHangIds) {
  const loc = Array.isArray(maHangIds) && maHangIds.length
    ? ` AND ct.MaHangID IN (${maHangIds.map(n => parseInt(n, 10)).filter(Number.isInteger).join(',') || '0'})`
    : '';
  const rows = (await pool.request()
    .input('ngay', sql.Date, chuanNgay(ngay))
    .query(`
      SELECT ct.MaHangID,
             ISNULL(ct.PhanTramCK, km.PhanTramCK) AS PhanTramCK,
             km.ID AS ChuongTrinhID, km.TenChuongTrinh
      FROM ChuongTrinhKhuyenMaiChiTiet ct
      JOIN ChuongTrinhKhuyenMai km ON km.ID = ct.ChuongTrinhID
      WHERE km.TrangThai = N'Hoạt động'
        AND @ngay BETWEEN km.TuNgay AND km.DenNgay
        AND ISNULL(ct.PhanTramCK, km.PhanTramCK) IS NOT NULL${loc}`)).recordset;

  const map = {};
  rows.forEach(r => {
    const pt = Number(r.PhanTramCK);
    if (!isFinite(pt)) return;
    const cu = map[r.MaHangID];
    /* Nhieu chuong trinh cung hieu luc -> giu cai co %CK CAO NHAT. */
    if (!cu || pt > cu.PhanTramCK) {
      map[r.MaHangID] = { PhanTramCK: pt, ChuongTrinhID: r.ChuongTrinhID, TenChuongTrinh: r.TenChuongTrinh };
    }
  });
  return map;
}

/* Canh bao (KHONG chan) luc khai chuong trinh: nhung ma nao dang nam trong mot chuong trinh KHAC
   co thoi gian CHONG LAN. Tra ve mang mo ta de hien len man hinh.
   `boQuaID` = chuong trinh dang sua (khong tu canh bao chinh no). */
async function kiemTrungChuongTrinh(pool, sql, { tuNgay, denNgay, maHangIds, boQuaID }) {
  const ids = (maHangIds || []).map(n => parseInt(n, 10)).filter(Number.isInteger);
  if (!ids.length) return [];
  return (await pool.request()
    .input('tu', sql.Date, tuNgay).input('den', sql.Date, denNgay)
    .input('bo', sql.Int, boQuaID || 0)
    .query(`
      SELECT h.MaHang, h.TenHang, km.TenChuongTrinh,
             ISNULL(ct.PhanTramCK, km.PhanTramCK) AS PhanTramCK,
             km.TuNgay, km.DenNgay
      FROM ChuongTrinhKhuyenMaiChiTiet ct
      JOIN ChuongTrinhKhuyenMai km ON km.ID = ct.ChuongTrinhID
      JOIN TheKhoHangHoa h ON h.MaHangID = ct.MaHangID
      WHERE ct.MaHangID IN (${ids.join(',')})
        AND km.ID <> @bo
        AND km.TrangThai = N'Hoạt động'
        -- hai khoang thoi gian chong lan khi: batDau1 <= ketThuc2 VA ketThuc1 >= batDau2
        AND km.TuNgay <= @den AND km.DenNgay >= @tu
      ORDER BY h.MaHang`)).recordset;
}

module.exports = { layKhuyenMaiTheoNgay, kiemTrungChuongTrinh };
