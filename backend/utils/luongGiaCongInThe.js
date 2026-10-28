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

   ------------------------------------------------------------------------------------------------
   ⚠️ v8.61 — MOC KY = THANG GHI TIEN DO QC. Nguyen chot 2026-10-01:
     "Lenh qua QC. QC ghi nhan o thang nao thi tinh tien thang do. Vi du hang giao thang 8 nhung
      QC ghi tien do T9 thi luong tinh vao thang 9." + "Dieu kien QC ap cho ca GC/in theu."

   TRUOC v8.61 loc theo ct.CreatedAt / it.CreatedAt (ngay TAO dong GIAO) — vua sai moc (tien phat
   sinh luc NHAN hang chu khong phai luc giao), vua lam bang luong thang DA CHOT tu doi khi ai do
   nhap SoLuongNhan muon.

   HAI THAY DOI, deu CO Y:
     1. Loc ky theo qc.NgayQC thay vi CreatedAt.
     2. CROSS APPLY + HAVING COUNT(*) > 0 (v9.02) -> lenh CHUA qua QC bi loai khoi KET QUA, KE CA
        khi khong truyen ky. Tuc SO CONG NO NHA GIA CONG cung chi tinh lenh da qua QC.
        ⚠️ Tu v8.61 toi truoc v9.02 dieu nay KHONG DUNG voi nhanh cong no (xem ghi chu o
        APPLY_NGAY_QC): cong no van cong lenh chua QC. v9.02 moi that su loai — so cong no giam dung
        phan do. Neu cong no can tinh ca lenh chua qua QC thi them co rieng cho nhanh cong no (OUTER
        APPLY), dung sua mot cau roi quen cau kia.

   MIN(NgayGhiNhan) = lan ghi QC DAU TIEN, CO Y khong dung MAX (xem ly do o payroll.js v8.61).
   Khop CA MaCongDoan LAN TenCongDoan vi MaCongDoan la DU LIEU nguoi dung go duoc (bai hoc 'nhatchi'
   o v8.50, lam v8.30/v8.33 khong bao gio chay).
   ================================================================================================ */

/* Khoi CROSS APPLY lay ngay QC cua don, dung CHUNG cho moi bang luong theo lenh. `bd` la alias cua
   bang co cot DonHangID (ct gia cong, it in theu, td tien do cho la/dong goi + so cat + khoan may).

   🔴 v9.02 — HAVING COUNT(*) > 0 LA CAI LAM NEN CONG "CHUA QC THI LOAI". Ra soat chéo 2026-10-24 chi ra:
   MIN() khong GROUP BY LUON tra ve DUNG MOT dong (NULL khi khong co QC), nen CROSS APPLY mot minh
   KHONG loai dong nao — ghi chu v8.61 "CROSS APPLY -> lenh chua QC bi loai" la SAI. Tu v8.61 toi
   v9.02 cac bang luong chi thoat nho WHERE YEAR(qc.NgayQC)=@n (NULL -> false); con SO CONG NO NHA GIA
   CONG goi khong truyen ky thi KHONG co WHERE do -> van cong ca lenh chua QC (Ngay = NULL).
   HAVING COUNT(*) > 0 tren mot nhom duy nhat: khong co dong QC -> khong co nhom -> CROSS APPLY loai
   dong ngoai. Ap cho MOI noi goi — ke ca cong no nha gia cong (so cong no se GIAM dung phan lenh
   chua QC; da noi ro voi Nguyen trong PRD_v902). */
const APPLY_NGAY_QC = (bd) => `
    CROSS APPLY (SELECT MIN(q.NgayGhiNhan) AS NgayQC
                   FROM TienDoSanXuat q
                   JOIN CongDoanSanXuat c2 ON c2.StageID = q.StageID
                  WHERE q.DonHangID = ${bd}.DonHangID
                    AND (UPPER(LTRIM(RTRIM(ISNULL(c2.MaCongDoan, N'')))) = N'QC'
                         OR UPPER(LTRIM(RTRIM(ISNULL(c2.TenCongDoan, N'')))) = N'QC')
                 HAVING COUNT(*) > 0) qc`;

/* v9.02 — NGAY KY cua mot dong ghi cong doan = ngay MUON HON giua ngay ghi cong doan va ngay QC dau.
   Nguyen chot 2026-10-24 (ra soat "tat ca cac lenh SX khi QC ghi nhan moi tinh luong"):
   "Thang muon hon giua ngay ghi va ngay QC dau". Ly do: tien KHONG BAO GIO roi vao thang da chot —
     · cong doan TRUOC QC (cat, may, gia cong): ngay QC muon hon -> ky = thang QC (y het v8.61);
     · cong doan SAU QC (dong goi): ngay ghi muon hon -> ky = thang ghi (dong goi T11 cua lenh QC T10
       tinh T11, khong bi day nguoc ve T10 da tra).
   Dung cho Khoan may, La/Dong goi, Trai vai cat (payroll.js). Gia cong/in theu van loc thang theo
   qc.NgayQC (dieuKienKy): dong giao/nhan KHONG co cot ngay nhan rieng (SoLuongNhan ghi de), nen khong
   co "ngay ghi" de so — thang QC la moc duy nhat co that. `cot` = cot ngay ghi cong doan (vd
   'td.NgayGhiNhan'), phai co qc da APPLY. */
const bieuThucNgayKy = (cot) => `CASE WHEN qc.NgayQC > ${cot} THEN qc.NgayQC ELSE ${cot} END`;

/* Dieu kien loc ky dung chung cho ca hai cau — nay luon theo qc.NgayQC. */
function dieuKienKy(_cotCu, ky) {
  const nam = ky && ky.nam ? parseInt(ky.nam, 10) : null;
  const thang = ky && ky.thang ? parseInt(ky.thang, 10) : null;
  if (!nam || !thang) return '';
  return ` AND YEAR(qc.NgayQC)=@n AND MONTH(qc.NgayQC)=@t`;
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
           ds.TenDai,                      -- v8.59: NULL khi lenh khong tach dai
           qc.NgayQC AS Ngay,              -- v8.61: NGAY QC, khong con la ct.CreatedAt
           ISNULL(ct.SoLuongNhan,0) AS SoLuongNhan,
           ISNULL(dhg.DonGia, hm.DonGiaMacDinh) AS DonGia,
           ISNULL(ct.SoLuongNhan,0) * ISNULL(ISNULL(dhg.DonGia, hm.DonGiaMacDinh),0) AS ThanhTien
    FROM DonHangChiTietNhaGiaCong ct
    JOIN NhaGiaCong ncc ON ncc.NhaGiaCongID = ct.NhaGiaCongID
    JOIN DonHangSanXuat d ON d.DonHangID = ct.DonHangID
    LEFT JOIN HangMucGiaCong hm ON hm.HangMucGiaCongID = ct.HangMucGiaCongID
    LEFT JOIN DonHangDaiSize ds ON ds.ID = ct.DaiSizeID
    /* ⚠️ v8.60 — DON GIA THEO DAI SIZE. Nguyen xac nhan don gia KHAC nhau giua cac dai.
       Thu tu uu tien, DUNG 3 BUOC, khong duoc doi:
         1. dong don gia khop DUNG dai cua dong giao  (x.DaiSizeID = ct.DaiSizeID)
         2. khong co -> dong don gia DaiSizeID IS NULL, nghia la "ap cho moi dai"
         3. khong co nua -> khong co gia (NULL) -> rot xuong hm.DonGiaMacDinh nhu cu
       ORDER BY dat dong khop dai LEN TRUOC (CASE ... THEN 0 ELSE 1). Bo mot chu trong ORDER BY nay
       la TOP 1 lay nham gia cua dai khac — tien sai ma khong co dau hieu gi.
       ⚠️ TUYET DOI khong lay gia cua MOT dai khac de thay the (cung tinh than voi khoi in theu
       ben duoi: "CO Y khong lay tong thay the"). */
    OUTER APPLY (SELECT TOP 1 x.DonGia FROM DonHangHangMucGiaCong x
                 WHERE x.HangMucGiaCongID = ct.HangMucGiaCongID AND x.DonHangID = ct.DonHangID
                   AND (x.DaiSizeID = ct.DaiSizeID OR x.DaiSizeID IS NULL)
                 ORDER BY CASE WHEN x.DaiSizeID IS NOT NULL THEN 0 ELSE 1 END,
                          ISNULL(x.TenPhieu, N''), x.ID) dhg
    ${APPLY_NGAY_QC('ct')}
    WHERE ISNULL(ct.SoLuongNhan,0) > 0${dieuKienKy(null, ky)}
    ORDER BY ncc.TenNha, d.MaDH`)).recordset;
}

async function loadInThe(pool, sql, ky) {
  const coHM = (await pool.request().query("SELECT COL_LENGTH('DonHangNhaInTheu','HangMucInThe') AS c")).recordset[0].c != null;
  const hmCol = coHM ? 'it.HangMucInThe' : "CAST(NULL AS NVARCHAR(200))";
  const rq = themThamSoKy(pool.request(), sql, ky);
  return (await rq.query(`
    SELECT ncc.NhaGiaCongID, ncc.TenNha, d.MaDH, d.TenSanPham,
           qc.NgayQC AS Ngay,              -- v8.61: NGAY QC, khong con la it.CreatedAt
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
    ${APPLY_NGAY_QC('it')}
    WHERE ISNULL(it.SoLuongNhan,0) > 0${dieuKienKy(null, ky)}
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

// v9.02: export APPLY_NGAY_QC + bieuThucNgayKy de payroll.js (la/dong goi, trai vai cat) dung CHUNG
// mot cach tim ngay QC — khong chep tay khoi CROSS APPLY lan thu ba.
module.exports = { loadGiaCong, loadInThe, tongHopTheoNha, APPLY_NGAY_QC, bieuThucNgayKy };
