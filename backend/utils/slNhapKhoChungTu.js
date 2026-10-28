/* ================================================================================================
   backend/utils/slNhapKhoChungTu.js   —   v9.09
   PHIEU NHAP KHO DA LAP cua tung lenh SX: so lan nhap, so phieu gan nhat, va TONG SL QUY VE CAI.

   Dung o: nhapkho.js GET /danhmuc — quyet dinh mot lenh SX con hien trong o chon hay da nhap xong.

   🔴 VI SAO PHAI CO HAM NAY (dung xoa roi tu viet SUM o cho khac):
     PhieuNhapKhoHangChiTiet.SoLuongChinh quy ve DON VI CHINH CUA MA HANG (TheKhoHangHoa.DonViCoBan),
     ma don vi chinh CO THE LA RI. Cong tho SoLuongChinh ra mot con so khong cung don vi voi luy ke
     cong doan Kho nhap (TienDoChiTietMau.SoLuongLuyKe luon la CAI — xem qlsx.js slKhoNhapTheoDon).
     So hai con so khac don vi => lenh quan theo Ri bao "da nhap du" trong khi moi nhap duoc 1/<he so>.

   ⚠️ BAN SAO CO Y: bieu thuc QUY_VE_CAI la ban sao tung chu cua mau so trong tinhGiaThanh()
     (routes/qlsx.js, nhanh "SL nhap kho thuc te (phieu nhap kho)"). KHONG gop lam mot vi tinhGiaThanh
     la duong TIEN (gia von) — sua chung mot ham la mot lan sua cham tay vao gia thanh. Doi cong thuc
     thi phai doi CA HAI; bo tu kiem kiem_lenh_sx_o_phieu_nhap.js co phep so khop hai noi nay.

   ⚠️ v9.09 — HAM NAY THAY LUON hai subquery tuong quan (SoPhieuDaNhap / SoPhieuGanNhat) truoc day
     nam trong cau SELECT cua /danhmuc. Ly do: bo cai TOP 300 di thi cau do quet toan bo lenh SX, moi
     dong lai do bang phieu hai lan trong khi PhieuNhapKhoHang KHONG co index tren DonHangID. Gop lai
     thanh hai cau GROUP BY quet mot lan.
   ================================================================================================ */

/* Quy SoLuongChinh -> CAI. Quy tac: ma hang co DonViCoBan == DonViQuyDoi (tuc don vi chinh CHINH LA
   don vi gop, vd ca hai deu 'Ri') thi SoLuongChinh dang la so RI => nhan them LoaiRi. Nguoc lai
   SoLuongChinh da la cai => nhan 1. DonViQuyDoi rong thi coi nhu 'ri' (mac dinh cu cua he thong). */
const QUY_VE_CAI = `ct.SoLuongChinh * CASE
             WHEN LOWER(LTRIM(RTRIM(h.DonViCoBan))) =
                  LOWER(LTRIM(RTRIM(ISNULL(NULLIF(LTRIM(RTRIM(h.DonViQuyDoi)), N''), N'ri'))))
                  AND ISNULL(h.LoaiRi, 1) > 0
             THEN ISNULL(h.LoaiRi, 1) ELSE 1 END`;

/* Tra ve map { DonHangID: { SoLanNhap, SLCai, SoPhieuGanNhat } } cho MOI lenh da co phieu chua huy.
   Lenh khong co trong map = chua lap phieu nao.

   HAI cau, moi cau quet bang phieu dung MOT lan — khong hoi theo tung lenh (o /danhmuc co hang nghin
   lenh, hoi tung cai la N+1 truy van ngay trong duong mo form).

   ⚠️ LEFT JOIN chu khong JOIN: phieu KHONG co dong chi tiet nao van phai duoc DEM (SoLanNhap), chi la
     khong gop them cai nao. Dung JOIN thi phieu rong bien mat => "chua co phieu nao" => luat an lenh
     tinh sai. COUNT(DISTINCT p.PhieuNKID) dem DAU PHIEU, khong dem dong chi tiet.
   ⚠️ LEFT JOIN TheKhoHangHoa: dong tro toi ma hang khong con se cho SLCai = NULL -> SUM bo qua. Dung
     y het tinhGiaThanh(). Lech ve phia "thieu" => lenh KHONG bi an => an toan. */
async function slPhieuNhapTheoDon(pool) {
  const map = {};
  const tong = (await pool.request().query(`
    IF OBJECT_ID('PhieuNhapKhoHangChiTiet', 'U') IS NULL
      SELECT CAST(NULL AS INT) AS DonHangID, CAST(0 AS INT) AS SoLanNhap,
             CAST(0 AS DECIMAL(18,4)) AS SLCai WHERE 1 = 0
    ELSE
      SELECT p.DonHangID,
             COUNT(DISTINCT p.PhieuNKID)  AS SoLanNhap,
             ISNULL(SUM(${QUY_VE_CAI}), 0) AS SLCai
      FROM PhieuNhapKhoHang p
      LEFT JOIN PhieuNhapKhoHangChiTiet ct ON ct.PhieuNKID = p.PhieuNKID
      LEFT JOIN TheKhoHangHoa h            ON h.MaHangID  = ct.MaHangID
      WHERE p.DonHangID IS NOT NULL AND p.TrangThai <> N'Đã hủy'
      GROUP BY p.DonHangID`)).recordset;
  tong.forEach(r => {
    if (r.DonHangID == null) return;
    map[Number(r.DonHangID)] = {
      SoLanNhap: Number(r.SoLanNhap) || 0,
      SLCai: Number(r.SLCai) || 0,
      SoPhieuGanNhat: null
    };
  });
  /* So phieu gan nhat: ROW_NUMBER thay cho subquery TOP 1 tuong quan. Thu tu phai GIONG HET ban cu
     (NgayNhap DESC, PhieuNKID DESC) — doi thu tu la nguoi dung thay "so phieu gan nhat" khac di ma
     khong hieu vi sao. */
  const gan = (await pool.request().query(`
    IF OBJECT_ID('PhieuNhapKhoHang', 'U') IS NULL
      SELECT CAST(NULL AS INT) AS DonHangID, CAST(NULL AS NVARCHAR(50)) AS SoPhieu WHERE 1 = 0
    ELSE
      SELECT DonHangID, SoPhieu FROM (
        SELECT p.DonHangID, p.SoPhieu,
               ROW_NUMBER() OVER (PARTITION BY p.DonHangID
                                  ORDER BY p.NgayNhap DESC, p.PhieuNKID DESC) AS rn
        FROM PhieuNhapKhoHang p
        WHERE p.DonHangID IS NOT NULL AND p.TrangThai <> N'Đã hủy'
      ) t WHERE t.rn = 1`)).recordset;
  gan.forEach(r => {
    const id = r.DonHangID == null ? 0 : Number(r.DonHangID);
    if (map[id]) map[id].SoPhieuGanNhat = r.SoPhieu || null;
  });
  return map;
}

module.exports = { slPhieuNhapTheoDon, QUY_VE_CAI };
