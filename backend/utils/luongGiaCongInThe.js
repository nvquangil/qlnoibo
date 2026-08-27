/* ================================================================================================
   LUONG / CHI PHI GIA CONG NGOAI + IN THEU  —  MOT BAN CONG THUC DUY NHAT              v7.53
   ------------------------------------------------------------------------------------------------
   Truoc v7.53 hai cau SQL nay nam trong routes/payroll.js. Nay CONG NO NHA GIA CONG (routes/congno.js)
   cung phai dung dung con so do: neu viet ban thu hai thi Bang luong va So cong no se ra HAI CON SO
   cho CUNG MOT viec, va khong ai biet ben nao dung (bai hoc v6.47).

   ⚠️ MOC GHI NHAN = SO LUONG NHAN (SoLuongNhan), nguoi dung da chot: tien chi phat sinh khi hang DA
   NHAN VE. Phan da giao ma chua nhan KHONG tinh tien.

   GIA CONG : SoLuongNhan x don gia HANG MUC
              (DonHangHangMucGiaCong.DonGia cua don, fallback HangMucGiaCong.DonGiaMacDinh)
   IN THEU  : SoLuongNhan x don gia in theu
              · dong DA chon hang muc  -> don gia CUA dung hang muc do (khop theo TEN)
              · dong de TRONG (du lieu cu) -> TONG don gia in theu cua don
              · chon hang muc nhung hang muc bi xoa/doi ten -> don gia 0 + co ThieuDonGia = 1
                (CO Y khong lay tong thay the: lay tong luc do se ra mot so SAI ma khong ai biet)

   ⚠️ OUTER APPLY ... TOP 1 / MIN(TenPhieu) la de xu ly "NHIEU BAN CO TEN" (v5.56): mot don co the co
   nhieu ban don gia; LEFT JOIN thang se nhan moi ban thanh mot dong luong => TIEN GAP N LAN.

   LOC KY: truyen { nam, thang } thi loc theo CreatedAt cua dong giao (SL nhan khong co cot ngay
   rieng). KHONG truyen gi = LAY TAT CA — so cong no cong luy ke tu dau, khong theo thang.
   ================================================================================================ */

/* Dieu kien loc ky dung chung cho ca hai cau. `cot` la cot CreatedAt cua bang tuong ung. */
function dieuKienKy(cot, ky) {
  const nam = ky && ky.nam ? parseInt(ky.nam, 10) : null;
  const thang = ky && ky.thang ? parseInt(ky.thang, 10) : null;
  if (!nam || !thang) return '';
  return ` AND YEAR(${cot})=@n AND MONTH(${cot})=@t`;
}
function themThamSoKy(rq, sql, ky) {
  if (ky && ky.nam && ky.thang) {
    rq.input('n', sql.Int, parseInt(ky.nam, 10)).input('t', sql.Int, parseInt(ky.thang, 10));
  }
  return rq;
}

async function loadGiaCong(pool, sql, ky) {
  const rq = themThamSoKy(pool.request(), sql, ky);
  return (await rq.query(`
    SELECT ncc.NhaGiaCongID, ncc.TenNha, d.MaDH, d.TenSanPham, hm.TenHangMuc,
           ct.CreatedAt AS Ngay,
           ISNULL(ct.SoLuongNhan,0) AS SoLuongNhan,
           ISNULL(dhg.DonGia, hm.DonGiaMacDinh) AS DonGia,
           ISNULL(ct.SoLuongNhan,0) * ISNULL(ISNULL(dhg.DonGia, hm.DonGiaMacDinh),0) AS ThanhTien
    FROM DonHangChiTietNhaGiaCong ct
    JOIN NhaGiaCong ncc ON ncc.NhaGiaCongID = ct.NhaGiaCongID
    JOIN DonHangSanXuat d ON d.DonHangID = ct.DonHangID
    LEFT JOIN HangMucGiaCong hm ON hm.HangMucGiaCongID = ct.HangMucGiaCongID
    OUTER APPLY (SELECT TOP 1 x.DonGia FROM DonHangHangMucGiaCong x
                 WHERE x.HangMucGiaCongID = ct.HangMucGiaCongID AND x.DonHangID = ct.DonHangID
                 ORDER BY ISNULL(x.TenPhieu, N''), x.ID) dhg
    WHERE ISNULL(ct.SoLuongNhan,0) > 0${dieuKienKy('ct.CreatedAt', ky)}
    ORDER BY ncc.TenNha, d.MaDH`)).recordset;
}

async function loadInThe(pool, sql, ky) {
  const coHM = (await pool.request().query("SELECT COL_LENGTH('DonHangNhaInTheu','HangMucInThe') AS c")).recordset[0].c != null;
  const hmCol = coHM ? 'it.HangMucInThe' : "CAST(NULL AS NVARCHAR(200))";
  const rq = themThamSoKy(pool.request(), sql, ky);
  return (await rq.query(`
    SELECT ncc.NhaGiaCongID, ncc.TenNha, d.MaDH, d.TenSanPham,
           it.CreatedAt AS Ngay,
           ${hmCol} AS HangMucInThe,
           ISNULL(it.SoLuongNhan,0) AS SoLuongNhan,
           CASE WHEN LTRIM(RTRIM(ISNULL(${hmCol}, N''))) <> N'' THEN ISNULL(hm.DonGia, 0)
                ELSE ISNULL(dg.TongDonGia, 0) END AS DonGia,
           ISNULL(it.SoLuongNhan,0) *
             CASE WHEN LTRIM(RTRIM(ISNULL(${hmCol}, N''))) <> N'' THEN ISNULL(hm.DonGia, 0)
                  ELSE ISNULL(dg.TongDonGia, 0) END AS ThanhTien,
           CASE WHEN LTRIM(RTRIM(ISNULL(${hmCol}, N''))) <> N'' AND hm.DonGia IS NULL THEN 1 ELSE 0 END AS ThieuDonGia
    FROM DonHangNhaInTheu it
    JOIN NhaGiaCong ncc ON ncc.NhaGiaCongID = it.NhaInID
    JOIN DonHangSanXuat d ON d.DonHangID = it.DonHangID
    OUTER APPLY (SELECT SUM(x.DonGia) AS TongDonGia FROM DonHangDonGiaInThe x
                 WHERE x.DonHangID = it.DonHangID
                   AND ISNULL(x.TenPhieu, N'') = (SELECT MIN(ISNULL(y.TenPhieu, N'')) FROM DonHangDonGiaInThe y WHERE y.DonHangID = it.DonHangID)) dg
    OUTER APPLY (SELECT TOP 1 x.DonGia FROM DonHangDonGiaInThe x
                 WHERE x.DonHangID = it.DonHangID
                   AND LTRIM(RTRIM(ISNULL(x.Ten, N''))) = LTRIM(RTRIM(ISNULL(${hmCol}, N'')))
                 ORDER BY ISNULL(x.TenPhieu, N''), x.ID) hm
    WHERE ISNULL(it.SoLuongNhan,0) > 0${dieuKienKy('it.CreatedAt', ky)}
    ORDER BY ncc.TenNha, d.MaDH`)).recordset;
}

/* Gom theo NHA (mot nha co the lam ca gia cong va in theu — cung bang danh muc NhaGiaCong). */
function tongHopTheoNha(rows) {
  const m = {};
  (rows || []).forEach(r => {
    const k = r.NhaGiaCongID;
    if (!m[k]) m[k] = { NhaGiaCongID: k, TenNha: r.TenNha, SoLuongNhan: 0, ThanhTien: 0 };
    m[k].SoLuongNhan += Number(r.SoLuongNhan) || 0;
    m[k].ThanhTien += Number(r.ThanhTien) || 0;
  });
  return Object.values(m);
}

module.exports = { loadGiaCong, loadInThe, tongHopTheoNha };
