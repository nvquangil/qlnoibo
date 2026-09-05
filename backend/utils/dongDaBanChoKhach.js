/* ================================================================================================
   DONG DA BAN CHO KHACH  —  MOT BAN CONG THUC DUY NHAT                                   v7.59
   ------------------------------------------------------------------------------------------------
   Cau hoi ma file nay tra loi:  "dong phieu ban hang nay da duoc TRA VE bao nhieu, con lai bao nhieu"

   Truoc v7.59 cong thuc nay nam trong routes/nhaplai.js (`layDongDaBan`) va chi phuc vu man Phieu
   nhap lai. Tu v7.59 co them 4 man hinh can DUNG CON SO DO:
       · canh bao ngay tren form Phieu ban hang  ("khach nay dang giu 2 Cai mau ma AAA")
       · so rieng "Hang mau o khach"
       · popup The kho cua ma hang
       · so chi tiet cong no khach
   Viet lai cau SQL o tung noi la chac chan troi khoi nhau (bai hoc v6.47 va payroll/cong no gia
   cong). Nen chuyen han ra day, nhaplai.js NHAP tu day.

   ⚠️ DIEM DE SAI NHAT — "DA TRA" phai bam theo `PhieuNhapLaiChiTiet.PhieuBHChiTietID`, tuc DUNG DONG
   cua phieu ban goc, KHONG phai theo (ma hang + mau). Mot khach co the mua cung ma+mau nhieu lan;
   khop theo ma+mau se lam mot lan tra "tru" nham vao lan ban khac -> so con lai am hoac thua.

   ⚠️ DON VI: ca hai ve deu dung `SoLuongCai` (dong phieu ban va dong phieu nhap lai). KHONG duoc tron
   `SoLuong` (theo don vi go tren phieu: Cai hay Ri) vao phep tru — ma quan theo Ri se lech LoaiRi lan.
   ================================================================================================ */
const so = (v) => Number(v || 0);

/* Cot PhieuBanHang.LaHangMau do migration_v693 them — do truoc de chua chay migration van chay. */
let __coCotHangMau = null;
async function coCotHangMau(pool) {
  if (__coCotHangMau === null) {
    try {
      const r = (await pool.request().query(`SELECT COL_LENGTH('PhieuBanHang','LaHangMau') AS c`)).recordset[0] || {};
      __coCotHangMau = r.c != null;
    } catch (e) { __coCotHangMau = false; }
  }
  return __coCotHangMau;
}

/* ================================================================================================
   layDongDaBan(pool, sql, opts)
     opts.tenKhach   : loc theo TEN khach (khoa nhom cong no). Bo trong = TAT CA khach.
     opts.phieuBHID  : loc theo 1 phieu ban.
     opts.maHangID   : loc theo 1 ma hang.
     opts.chiHangMau : true  -> CHI cac phieu co LaHangMau = 1 (chua chay migration thi tra rong,
                                dung hon la tra ca dong hang ban that ra so "hang mau").
     opts.chiConGiu  : true  -> bo cac dong da tra HET (ConTraCai = 0). Loc SAU khi tinh, o JS.
   ================================================================================================ */
async function layDongDaBan(pool, sql, opts) {
  const o = opts || {};
  const tenKhach = String(o.tenKhach || '').trim();
  const coCoMau = await coCotHangMau(pool);
  if (o.chiHangMau && !coCoMau) return [];   // chua chay migration_v693 -> chua co phieu mau nao

  const rq = pool.request();
  if (tenKhach) rq.input('ten', sql.NVarChar, tenKhach);
  if (o.phieuBHID) rq.input('pid', sql.Int, Number(o.phieuBHID));
  if (o.maHangID) rq.input('mh', sql.Int, Number(o.maHangID));

  const rs = (await rq.query(`
    SELECT ct.ID AS PhieuBHChiTietID, ct.PhieuBHID, p.SoPhieu, p.NgayBan, p.TenKhach,
           p.PhanTramCKNPP, p.PhanTramVAT,
           ${coCoMau ? 'ISNULL(p.LaHangMau, 0)' : 'CAST(0 AS BIT)'} AS LaHangMau,
           ct.MaHangID, ct.MauSacID, ct.SoLuong, ct.DonVi, ct.SoLuongCai,
           ct.GiaBanLe, ct.PhanTramCKShop, ct.GiaBan, ct.ThanhTien, ct.GhiChu,
           h.MaHang, h.TenHang, h.LoaiRi, h.DonViCoBan, h.DonViQuyDoi,
           ms.TenMau,
           ISNULL((SELECT SUM(nl.SoLuongCai) FROM PhieuNhapLaiChiTiet nl
                   JOIN PhieuNhapLai np ON np.PhieuNLID = nl.PhieuNLID
                   WHERE nl.PhieuBHChiTietID = ct.ID AND np.TrangThai <> N'Đã hủy'), 0) AS DaTraCai
    FROM PhieuBanHangChiTiet ct
    JOIN PhieuBanHang p ON p.PhieuBHID = ct.PhieuBHID
    JOIN TheKhoHangHoa h ON h.MaHangID = ct.MaHangID
    LEFT JOIN MauSac ms ON ms.MauSacID = ct.MauSacID
    WHERE p.TrangThai <> N'Đã hủy'
      ${tenKhach ? 'AND LTRIM(RTRIM(p.TenKhach)) = @ten' : ''}
      ${o.phieuBHID ? 'AND p.PhieuBHID = @pid' : ''}
      ${o.maHangID ? 'AND ct.MaHangID = @mh' : ''}
      ${o.chiHangMau ? 'AND ISNULL(p.LaHangMau, 0) = 1' : ''}
    ORDER BY p.NgayBan DESC, p.PhieuBHID DESC, ct.ID`)).recordset;

  const ra = rs.map(r => ({ ...r, ConTraCai: Math.max(0, so(r.SoLuongCai) - so(r.DaTraCai)) }));
  return o.chiConGiu ? ra.filter(r => r.ConTraCai > 0) : ra;
}

/* ================================================================================================
   hangMauDangOKhach() — chinh la layDongDaBan lay rieng phan hang mau, kem SO NGAY DA MUON.
   ConTraCai o day doc la "CON O KHACH" (chua tra ve). Cung mot phep tru, chi khac ten goi theo
   nghiep vu — KHONG tinh lai lan hai.
   `ngayMoc` cho phep test chot ngay; that thi de trong (lay hom nay).
   ================================================================================================ */
async function hangMauDangOKhach(pool, sql, opts) {
  const o = opts || {};
  const ds = await layDongDaBan(pool, sql, { ...o, chiHangMau: true });
  const moc = o.ngayMoc ? new Date(o.ngayMoc) : new Date();
  return ds.map(r => {
    const d = r.NgayBan ? new Date(r.NgayBan) : null;
    /* Tinh bang JS tren moc 00:00 cua ca hai ngay: DATEDIFF cua SQL Server dem theo MUI GIO cua
       may chu, con NgayBan la DATE thuan -> tru thang de bi lech 1 ngay. */
    const soNgay = d ? Math.max(0, Math.round(
      (Date.UTC(moc.getFullYear(), moc.getMonth(), moc.getDate())
        - Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000)) : null;
    return { ...r, ConOKhachCai: r.ConTraCai, SoNgayMuon: soNgay };
  });
}

/* Gom theo KHACH + MA HANG + MAU (bo cac dong da tra het) — dung cho canh bao tai form va popup
   The kho: chi can mot dong tom tat, khong can liet ke tung phieu. */
function gomTheoKhachMa(ds) {
  const m = new Map();
  (ds || []).forEach(r => {
    if (so(r.ConTraCai) <= 0) return;
    const k = String(r.TenKhach || '').trim() + '|' + r.MaHangID + '|' + (r.MauSacID == null ? '' : r.MauSacID);
    if (!m.has(k)) {
      m.set(k, {
        TenKhach: String(r.TenKhach || '').trim(), MaHangID: r.MaHangID, MauSacID: r.MauSacID,
        MaHang: r.MaHang, TenHang: r.TenHang, TenMau: r.TenMau,
        LoaiRi: r.LoaiRi, DonViCoBan: r.DonViCoBan, DonViQuyDoi: r.DonViQuyDoi,
        ConOKhachCai: 0, SoPhieu: [], NgaySom: null, SoNgayMuon: 0
      });
    }
    const g = m.get(k);
    g.ConOKhachCai += so(r.ConTraCai);
    if (g.SoPhieu.indexOf(r.SoPhieu) === -1) g.SoPhieu.push(r.SoPhieu);
    const d = r.NgayBan ? new Date(r.NgayBan) : null;
    if (d && (!g.NgaySom || d < g.NgaySom)) g.NgaySom = d;
    if (r.SoNgayMuon != null) g.SoNgayMuon = Math.max(g.SoNgayMuon, r.SoNgayMuon);
  });
  return [...m.values()].sort((a, b) => b.SoNgayMuon - a.SoNgayMuon);
}

module.exports = { layDongDaBan, hangMauDangOKhach, gomTheoKhachMa, coCotHangMau };
