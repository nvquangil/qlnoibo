/* ================================================================================================
   CONG NO TRUOC MOT CHUNG TU — MOT ban cong thuc duy nhat                                  v7.41
   ------------------------------------------------------------------------------------------------
   Dung cho ca PHIEU BAN HANG va PHIEU NHAP LAI (hang khach tra), de hai phieu in ra khong bao gio
   noi hai con so khac nhau cho cung mot khach. Truoc v7.41 cong thuc nay chi nam trong banhang.js;
   viet ban thu hai cho phieu nhap lai la chac chan se troi khoi nhau (dung bai hoc v6.47: "hai ban
   tinh rieng se troi khoi nhau").

   CONG THUC (gom theo TEN KHACH — khoa giong man hinh Cong no khach hang, routes/congno.js):
       CongNoTruoc = (ban hang truoc) + (dieu chinh truoc) - (da thu truoc) - (khach tra lai truoc)

   MOC "TRUOC CHUNG TU NAY":
     · Cac bang KHAC bang cua chung tu dang xem : ngay < ngay chung tu
     · CHINH bang cua chung tu dang xem         : ngay < ngay, HOAC cung ngay ma ID nho hon
   Vi sao khong so ID cheo bang: PhieuBHID va PhieuNLID la hai chuoi so doc lap, so voi nhau vo nghia.
   Hau qua da biet va CO Y GIU: mot phieu ban va mot phieu nhap lai CUNG NGAY thi khong phieu nao thay
   phieu kia trong "cong no truoc". Day la hanh vi cua banhang.js tu v6.24.3 — giu nguyen de hai phieu
   nhat quan, doi thi phai doi CA HAI cung luc.

   ⚠️ `tien()` va `so()` do BEN GOI truyen vao (moi route co ban lam tron rieng) — khong tu import de
   khong lam doi cach lam tron cua route dang chay that.
   ================================================================================================ */

/* @param loai  'PBH' = dang xem phieu ban hang · 'PNL' = dang xem phieu nhap lai
   @param id    PhieuBHID hoac PhieuNLID tuong ung
   Tra ve SO (chua lam tron) — ben goi tu goi tien()/lam tron theo quy uoc cua minh. */
async function congNoTruocChungTu(pool, sql, { tenKhach, ngay, loai, id }) {
  const ten = String(tenKhach || '').trim();
  const laPBH = loai === 'PBH';

  /* Mot cau cho 3 nguon co san tu dau (khong phu thuoc migration). */
  const rq = pool.request()
    .input('ten', sql.NVarChar, ten)
    .input('ngay', sql.Date, ngay)
    .input('id', sql.Int, id || 0);
  const r = (await rq.query(`
    SELECT
      ISNULL((SELECT SUM(TongThanhToan) FROM PhieuBanHang
              WHERE LTRIM(RTRIM(TenKhach)) = @ten AND TrangThai <> N'Đã hủy'
                AND (NgayBan < @ngay
                     ${laPBH ? 'OR (NgayBan = @ngay AND PhieuBHID < @id)' : ''})), 0) AS BanTruoc,
      ISNULL((SELECT SUM(SoTien) FROM CongNoDieuChinh
              WHERE LoaiDoiTuong = N'KhachHang' AND LTRIM(RTRIM(ISNULL(TenDoiTuong,''))) = @ten
                AND Ngay < @ngay), 0) AS DieuChinhTruoc,
      ISNULL((SELECT SUM(SoTien) FROM PhieuThu
              WHERE LoaiDoiTuong = N'KhachHang' AND LTRIM(RTRIM(ISNULL(TenDoiTuong,''))) = @ten
                AND NgayThu < @ngay), 0) AS ThuTruoc`)).recordset[0];

  /* Bang PhieuNhapLai do migration_v676 tao — do rieng va bat loi, he thong chua chay migration thi
     coi nhu chua co hang tra lai chu KHONG lam trang ca phieu in. */
  let traLaiTruoc = 0;
  try {
    const rq2 = pool.request()
      .input('ten', sql.NVarChar, ten)
      .input('ngay', sql.Date, ngay)
      .input('id', sql.Int, id || 0);
    traLaiTruoc = Number((await rq2.query(`
      SELECT ISNULL(SUM(TongThanhToan), 0) AS S FROM PhieuNhapLai
      WHERE LTRIM(RTRIM(TenKhach)) = @ten AND TrangThai <> N'Đã hủy'
        AND (NgayNhap < @ngay
             ${laPBH ? '' : 'OR (NgayNhap = @ngay AND PhieuNLID < @id)'})`)).recordset[0].S) || 0;
  } catch (err) {
    console.warn('[congNoTruocChungTu] chua co bang PhieuNhapLai (migration_v676):', err.message);
  }

  const banTruoc = Number(r.BanTruoc) || 0;
  const dieuChinhTruoc = Number(r.DieuChinhTruoc) || 0;
  const thuTruoc = Number(r.ThuTruoc) || 0;
  return {
    congNoTruoc: banTruoc + dieuChinhTruoc - thuTruoc - traLaiTruoc,
    /* Tra ve tung thanh phan de utils/soi_cong_no_phieu.js va man hinh doi chieu duoc khi lech. */
    banTruoc, dieuChinhTruoc, thuTruoc, traLaiTruoc
  };
}

module.exports = { congNoTruocChungTu };
