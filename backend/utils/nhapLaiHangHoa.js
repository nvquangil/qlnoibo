/* ================================================================================================
   NGUON "NHAP LAI" (hang khach tra) CHO KHO HANG HOA — MOT ban dung chung             v7.38
   ------------------------------------------------------------------------------------------------
   VI SAO CO FILE NAY: nhap lai KHONG tao ban ghi "nhap" nao. Nó GIAM `TheKhoChiTietMau.XuatCai`
   (routes/nhaplai.js -> utils/banHangCommon.js: `UPDATE TheKhoChiTietMau SET XuatCai = XuatCai - @sl`).
   Day la CO Y — ghi chu dau nhaplai.js noi ro: "KHONG cong vao NhapCai, NhapCai la so nhap tu san
   xuat, cong vao do se lam sai bao cao nhap".

   Hau qua: TON dung, nhung khong man nao HIEN duoc so nhap lai:
     - cot "Nhap" cua popup the kho khong doi mot don vi nao
     - cot "Xuat" tu giam ma khong dong nao giai thich
     - bang chung tu o Bao cao ton kho khong co dong nao cho nhap lai

   ⚠️ FILE NAY CHI DE DOC / HIEN THI. TUYET DOI KHONG dung de cong vao bat ky phep tinh TON nao —
   ton da tinh qua XuatCai giam roi, cong them la DEM HAI LAN. Do dung la cai bay ma migration_v682
   phai viet ca mot buoc "go mot lan" co chot de xu ly.

   ⚠️ CUNG KHONG cong vao `NhapKy`/`NhapSauKy` cua baoCaoTonHangHoa. Da thu o ban nhap v7.38 va nguoi
   dung bac: so lieu bang tong hop (Ton dau ky / Nhap / Xuat / Ton cuoi) DANG DUNG HET, yeu cau chi la
   HIEN dong nhap lai o bang chi tiet. Cong vao do se lam Ton dau ky lech di.
   ================================================================================================ */

/* Bang PhieuNhapLai do migration_v676 tao — he thong chua chay migration thi khong duoc lam vo
   ca man bao cao, chi coi nhu khong co nhap lai. */
async function coBangNhapLai(pool) {
  try {
    const r = (await pool.request().query(
      `SELECT OBJECT_ID('PhieuNhapLai') AS a, OBJECT_ID('PhieuNhapLaiChiTiet') AS b`)).recordset[0] || {};
    return r.a != null && r.b != null;
  } catch (e) { return false; }
}

/* Quy SoLuongCai -> DON VI CHINH cua ma hang. Bieu thuc COPY DUNG khuon cua sqlXuatBH trong
   baocao.js (dong 218-221) de hai con so khong the lech nhau: neu DonViCoBan trung DonViQuyDoi
   (tuc don vi chinh la don vi GOP) va LoaiRi > 0 thi chia he so. */
const SL_VE_DON_VI_CHINH = `
  CASE WHEN LOWER(LTRIM(RTRIM(h.DonViCoBan))) =
            LOWER(LTRIM(RTRIM(ISNULL(NULLIF(LTRIM(RTRIM(h.DonViQuyDoi)), N''), N'ri'))))
        AND h.LoaiRi > 0
       THEN CAST(ct.SoLuongCai AS DECIMAL(18,4)) / h.LoaiRi
       ELSE ct.SoLuongCai END`;

/* (1) TONG nhap lai theo MA HANG + MAU (khong gioi han ngay) — dung cho popup "Chi tiet theo mau"
   o the kho hang hoa. Tra ve { MaHangID, MauSacID, NhapLai }. */
const SQL_TONG_THEO_MAU = `
  SELECT ct.MaHangID, ct.MauSacID, SUM(${SL_VE_DON_VI_CHINH}) AS NhapLai
  FROM PhieuNhapLaiChiTiet ct
  JOIN PhieuNhapLai p ON p.PhieuNLID = ct.PhieuNLID
  JOIN TheKhoHangHoa h ON h.MaHangID = ct.MaHangID
  WHERE p.TrangThai <> N'Đã hủy' AND ct.MaHangID = @id
  GROUP BY ct.MaHangID, ct.MauSacID`;

/* (2) TUNG CHUNG TU nhap lai cua 1 ma hang trong ky — dung cho bang chi tiet o Bao cao ton kho.
   Gom theo PHIEU (mot phieu co the co nhieu mau cua cung ma hang). */
const SQL_CHUNG_TU = `
  SELECT p.NgayNhap AS Ngay, p.SoPhieu, p.TenKhach,
         ISNULL(p.LyDo, p.GhiChu) AS DienGiai,
         SUM(${SL_VE_DON_VI_CHINH}) AS PhatSinh
  FROM PhieuNhapLaiChiTiet ct
  JOIN PhieuNhapLai p ON p.PhieuNLID = ct.PhieuNLID
  JOIN TheKhoHangHoa h ON h.MaHangID = ct.MaHangID
  WHERE ct.MaHangID = @id AND p.TrangThai <> N'Đã hủy' AND p.NgayNhap BETWEEN @tu AND @den
  GROUP BY p.PhieuNLID, p.NgayNhap, p.SoPhieu, p.TenKhach, p.LyDo, p.GhiChu
  ORDER BY p.NgayNhap, p.SoPhieu`;

/* (3) TUNG DONG nhap lai cua 1 ma hang (khong gioi han ngay) — dung cho bang "Lich su dat hang"
   o popup the kho. Moi dong tra ve mot ban ghi de xen vao danh sach don, SL de o dang DUONG; ben
   goi tu doi dau (SoLuongDat = -SL) de nhin ra ngay day la hang di NGUOC chieu voi don ban.
   KHONG gom nhom: mot phieu tra nhieu mau thi phai thay tung mau. */
const SQL_DONG_THEO_MA = `
  SELECT p.PhieuNLID, p.SoPhieu, p.NgayNhap, p.TenKhach,
         ISNULL(p.LyDo, p.GhiChu) AS LyDo,
         p.TrangThai,
         ct.MauSacID, ms.TenMau,
         ${SL_VE_DON_VI_CHINH} AS SL,
         h.DonViCoBan
  FROM PhieuNhapLaiChiTiet ct
  JOIN PhieuNhapLai p ON p.PhieuNLID = ct.PhieuNLID
  JOIN TheKhoHangHoa h ON h.MaHangID = ct.MaHangID
  LEFT JOIN MauSac ms ON ms.MauSacID = ct.MauSacID
  WHERE ct.MaHangID = @id AND p.TrangThai <> N'Đã hủy'
  ORDER BY p.NgayNhap DESC, p.PhieuNLID DESC`;

module.exports = {
  coBangNhapLai, SL_VE_DON_VI_CHINH,
  SQL_TONG_THEO_MAU, SQL_CHUNG_TU, SQL_DONG_THEO_MA
};
