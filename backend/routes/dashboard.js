/* ================================================================================================
   DASHBOARD KINH DOANH  (v6.67)
   Tra ve doanh thu + cong no cua NHUNG KHACH DUOC CHON theo doi (client gui len danh sach ten).

   ⚠️ NGUON SO LIEU PHAI TRUNG VOI MAN "CONG NO KHACH HANG" (routes/congno.js):
       Con no = Ban hang (TongThanhToan) + Dieu chinh - Da thu - Hang tra lai
   Neu o day tu nghi ra cong thuc khac thi 2 man hinh se ra 2 con so, va nguoi dung se tin con so
   TREN DASHBOARD vi no hien ngay khi dang nhap. Sua cong thuc o congno.js PHAI sua ca file nay.

   Doanh thu tinh theo KY (tuNgay..denNgay) con Con no la SO LUY KE DEN HIEN TAI - hai thu khac ban
   chat, dung tron: loc ngay ma van tru het tien da thu tu truoc ky se ra no am vo nghia.

   v9.63 (Nguyen 16/11: "doanh thu thuan lech giua dashboard va bao cao"): DOANH THU / HANG TRA / DOANH THU
   THUAN tinh tren TienTruocVAT (CHUA gom thue GTGT) — cung dinh nghia VAS voi routes/baocao.js
   baoCaoKinhDoanh(): doanh thu thuan = doanh thu chua VAT − hang tra lai chua VAT. Truoc v9.63 o day
   tinh tren TongThanhToan (GOM VAT) nen hai man hinh ra hai so khac nhau (lech dung bang tien VAT).
   TongThanhToan (gom VAT) VAN tra ve o DoanhThuGomVAT / TraLaiGomVAT vi do la so TRU/CONG vao cong no —
   DA THU va CON NO van la tien that (gom VAT), khong doi.
   ================================================================================================ */
const express = require('express');
const { sql, getPool } = require('../db');
const { requireAuth, requirePermission } = require('../middleware/auth');

const router = express.Router();

['get', 'post'].forEach(method => {
  const goc = router[method].bind(router);
  router[method] = (path, ...handlers) => goc(path, ...handlers.map(h => (
    h.length >= 4 ? h : (req, res, next) => Promise.resolve(h(req, res, next)).catch(next)
  )));
});

function so(v) { const n = Number(v); return isFinite(n) ? n : 0; }
// Bang PhieuNhapLai do migration_v676 tao - do truoc, chua co thi coi nhu chua tra lai gi.
let __coNhapLai = null;
async function coBangNhapLai(pool) {
  if (__coNhapLai === null) {
    try {
      const r = (await pool.request().query(`SELECT OBJECT_ID('PhieuNhapLai') AS c`)).recordset[0] || {};
      __coNhapLai = r.c != null;
    } catch (e) { __coNhapLai = false; }
  }
  return __coNhapLai;
}

/* ================================================================================================
   v6.68: CAU HINH RIENG CUA NGUOI DANG DANG NHAP (bang CauHinhNguoiDung - migration_v678).
   Dung cho "khach theo doi": chon 1 lan, dang nhap o may nao cung thay - khac localStorage cu chi
   nam tren 1 trinh duyet cua 1 may.
   Chua chay migration thi 2 route nay tra ve rong / bao loi ro rang, KHONG lam vo dashboard.
   ================================================================================================ */
let __coBangCauHinh = null;
async function coBangCauHinh(pool) {
  if (__coBangCauHinh === null) {
    try {
      const r = (await pool.request().query(`SELECT OBJECT_ID('CauHinhNguoiDung') AS c`)).recordset[0] || {};
      __coBangCauHinh = r.c != null;
    } catch (e) { __coBangCauHinh = false; }
  }
  return __coBangCauHinh;
}
router.get('/cauhinh/:khoa', requireAuth, requirePermission('DASHBOARD', 'view'), async (req, res) => {
  const pool = await getPool();
  if (!await coBangCauHinh(pool)) return res.json({ success: true, data: null, chuaCoBang: true });
  const r = (await pool.request()
    .input('u', sql.Int, req.session.user.userId)
    .input('k', sql.NVarChar, req.params.khoa)
    .query('SELECT GiaTri FROM CauHinhNguoiDung WHERE UserID=@u AND Khoa=@k')).recordset[0];
  let giaTri = null;
  try { giaTri = r && r.GiaTri ? JSON.parse(r.GiaTri) : null; } catch (e) { giaTri = null; }
  res.json({ success: true, data: giaTri });
});
router.post('/cauhinh/:khoa', requireAuth, requirePermission('DASHBOARD', 'view'), async (req, res) => {
  const pool = await getPool();
  if (!await coBangCauHinh(pool)) {
    return res.status(400).json({ success: false, message: 'Chưa chạy migration_v678 nên chưa lưu được lựa chọn theo tài khoản.' });
  }
  // MERGE: 1 dong duy nhat cho moi (UserID, Khoa) - luu lai la ghi de, khong sinh ban trung.
  await pool.request()
    .input('u', sql.Int, req.session.user.userId)
    .input('k', sql.NVarChar, req.params.khoa)
    .input('v', sql.NVarChar(sql.MAX), JSON.stringify(req.body && req.body.giaTri !== undefined ? req.body.giaTri : null))
    .query(`MERGE CauHinhNguoiDung AS t
            USING (SELECT @u AS UserID, @k AS Khoa) AS s ON t.UserID=s.UserID AND t.Khoa=s.Khoa
            WHEN MATCHED THEN UPDATE SET GiaTri=@v, UpdatedAt=SYSDATETIME()
            WHEN NOT MATCHED THEN INSERT (UserID, Khoa, GiaTri) VALUES (@u, @k, @v);`);
  res.json({ success: true });
});

/* ================================================================================================
   v9.77 — NHÓM KHÁCH HÀNG trên dashboard (migration_v903).
   Nguyen 19/11: "Dashboard kinh doanh thêm theo nhóm khách hàng."

   🔴 Dashboard gom phiếu theo TÊN khách (PhieuBanHang.TenKhach là khóa công nợ — xem congno.js), còn nhóm
   gắn ở bảng KhachHang. Nên bản đồ ghép theo TÊN đã chuẩn hóa (LTRIM/RTRIM), cùng khóa với danhmuc.js
   BANG_TEN_KHACH. Tên trùng nhau trong danh mục (hai dòng cùng tên) ⇒ lấy MIN(NhomKhachHangID) — một tên
   một nhóm, không nhân dòng. Tên chưa có trong danh mục ⇒ nhóm 0 "Chưa gán nhóm".
   Bảng/cột chưa có (chưa chạy v903) ⇒ Map rỗng, mọi thứ chạy như trước.
   ================================================================================================ */
const KHONG_NHOM = { id: 0, ten: 'Chưa gán nhóm' };
async function banDoNhomKhach(pool) {
  const ra = { theoTen: new Map(), nhom: [], coNhom: false };
  try {
    const co = (await pool.request().query("SELECT COL_LENGTH('KhachHang','NhomKhachHangID') AS c")).recordset[0].c != null;
    if (!co) return ra;
    ra.coNhom = true;
    ra.nhom = (await pool.request().query('SELECT NhomKhachHangID, TenNhom FROM NhomKhachHang ORDER BY ThuTu, TenNhom')).recordset
      .map(r => ({ id: r.NhomKhachHangID, ten: r.TenNhom }));
    const tenNhom = new Map(ra.nhom.map(n => [n.id, n.ten]));
    (await pool.request().query(`
      SELECT LTRIM(RTRIM(TenKhachHang)) AS Ten, MIN(NhomKhachHangID) AS NhomID
      FROM KhachHang WHERE NULLIF(LTRIM(RTRIM(TenKhachHang)), '') IS NOT NULL
      GROUP BY LTRIM(RTRIM(TenKhachHang))`)).recordset
      .forEach(r => { if (r.NhomID != null) ra.theoTen.set(r.Ten, { id: r.NhomID, ten: tenNhom.get(r.NhomID) || ('Nhóm #' + r.NhomID) }); });
  } catch (e) { console.error('[dashboard banDoNhomKhach] ' + e.message); }
  return ra;
}
const nhomCuaTen = (bd, ten) => bd.theoTen.get(String(ten || '').trim()) || KHONG_NHOM;

/* Danh sach khach de nguoi dung chon theo doi (gom moi khach tung phat sinh ban hang). */
router.get('/khach', requireAuth, requirePermission('DASHBOARD', 'view'), async (req, res) => {
  const pool = await getPool();
  const rs = (await pool.request().query(`
    SELECT LTRIM(RTRIM(TenKhach)) AS TenKhach, COUNT(*) AS SoPhieu,
           SUM(TongThanhToan) AS TongMua, MAX(NgayBan) AS LanCuoi
    FROM PhieuBanHang
    WHERE TrangThai <> N'Đã hủy' AND NULLIF(LTRIM(RTRIM(TenKhach)), '') IS NOT NULL
    GROUP BY LTRIM(RTRIM(TenKhach))
    ORDER BY SUM(TongThanhToan) DESC`)).recordset;
  const bd = await banDoNhomKhach(pool);   // v9.77
  rs.forEach(r => { const n = nhomCuaTen(bd, r.TenKhach); r.NhomID = n.id; r.TenNhom = n.ten; });
  res.json({ success: true, data: rs, nhom: bd.nhom, coNhom: bd.coNhom });
});

/* Số liệu dashboard.
   Query: tuNgay, denNgay, khach = danh sach ten ngan cach bang '|' (rong = TAT CA khach). */
router.get('/kinhdoanh', requireAuth, requirePermission('DASHBOARD', 'view'), async (req, res) => {
  const pool = await getPool();
  const dsKhach = String(req.query.khach || '').split('|').map(s => s.trim()).filter(Boolean);
  const tuNgay = req.query.tuNgay || null;
  const denNgay = req.query.denNgay || null;
  const coNL = await coBangNhapLai(pool);

  /* ================================================================================================
     v6.69.2 - SUA LOI "DANH SACH NHAN DOI/NHAN BA MOI LAN AP DUNG".
     Ban truoc loc khach bang BANG TAM #kh + INNER JOIN. HAI cai bay cung luc:
       1. Bang tam #kh song theo KET NOI, ma mssql dung POOL ket noi dung lai. Lan sau roi trung
          dung ket noi cu thi #kh VAN CON -> `create: true` loi -> ta lai `.catch(() => {})` NUOT
          LUON loi do -> du lieu cu nam lai, du lieu moi do them vao.
       2. #kh co 1 ten 2-3 lan thi INNER JOIN NHAN ban ghi len 2-3 lan. Dung y nhu hien tuong:
          moi lan bam Ap dung, danh sach lai day len mot muc.
     Loc trung o phia client (v6.69.1) khong cuu duoc, vi nhan doi xay ra o TRONG CAU SQL.

     Nay bo han bang tam: sinh tham so @k0,@k1,... roi dung `IN (@k0,@k1,...)`. Van an toan truoc
     SQL injection y het bang tam (ten khach di vao tham so, khong noi vao chuoi lenh), ma khong de
     lai gi tren ket noi -> khong the tich luy qua cac lan goi.
     ================================================================================================ */
  const rq = pool.request();
  let loc = '';
  if (dsKhach.length) {
    const ten = [...new Set(dsKhach)];              // loc trung ngay tai day, them mot lop chan
    ten.forEach((t, i) => rq.input('k' + i, sql.NVarChar(150), t));
    loc = ' AND T.Ten IN (' + ten.map((_, i) => '@k' + i).join(',') + ')';
  }
  if (tuNgay) rq.input('tu', sql.Date, tuNgay);
  if (denNgay) rq.input('den', sql.Date, denNgay);
  const dkNgayBan = [tuNgay ? 'NgayBan >= @tu' : null, denNgay ? 'NgayBan <= @den' : null].filter(Boolean);
  const dkNgayNL = [tuNgay ? 'NgayNhap >= @tu' : null, denNgay ? 'NgayNhap <= @den' : null].filter(Boolean);
  const dkNgayThu = [tuNgay ? 'NgayThu >= @tu' : null, denNgay ? 'NgayThu <= @den' : null].filter(Boolean);
  const them = (ds) => ds.length ? ' AND ' + ds.join(' AND ') : '';

  const sqlText = `
    WITH
    /* --- TRONG KY: doanh thu, hang tra lai, tien da thu --- */
    ban AS (SELECT LTRIM(RTRIM(TenKhach)) AS Ten, SUM(TienTruocVAT) AS DoanhThu, SUM(TongThanhToan) AS DoanhThuGomVAT, COUNT(*) AS SoPhieu
            FROM PhieuBanHang WHERE TrangThai <> N'Đã hủy'${them(dkNgayBan)}
            GROUP BY LTRIM(RTRIM(TenKhach))),
    tra AS (${coNL ? `SELECT LTRIM(RTRIM(TenKhach)) AS Ten, SUM(ISNULL(TienTruocVAT, 0)) AS TraLai, SUM(TongThanhToan) AS TraLaiGomVAT
            FROM PhieuNhapLai WHERE TrangThai <> N'Đã hủy'${them(dkNgayNL)}
            GROUP BY LTRIM(RTRIM(TenKhach))`
    : `SELECT CAST(NULL AS NVARCHAR(150)) AS Ten, CAST(0 AS DECIMAL(18,2)) AS TraLai, CAST(0 AS DECIMAL(18,2)) AS TraLaiGomVAT WHERE 1=0`}),
    thu AS (SELECT LTRIM(RTRIM(ISNULL(TenDoiTuong,''))) AS Ten, SUM(SoTien) AS DaThuKy
            FROM PhieuThu WHERE LoaiDoiTuong = N'KhachHang'${them(dkNgayThu)}
            GROUP BY LTRIM(RTRIM(ISNULL(TenDoiTuong,'')))),
    /* --- LUY KE DEN HIEN TAI (khong loc ngay): dung de ra CON NO thuc te --- */
    lkBan AS (SELECT LTRIM(RTRIM(TenKhach)) AS Ten, SUM(TongThanhToan) AS S
              FROM PhieuBanHang WHERE TrangThai <> N'Đã hủy' GROUP BY LTRIM(RTRIM(TenKhach))),
    lkTra AS (${coNL ? `SELECT LTRIM(RTRIM(TenKhach)) AS Ten, SUM(TongThanhToan) AS S
              FROM PhieuNhapLai WHERE TrangThai <> N'Đã hủy' GROUP BY LTRIM(RTRIM(TenKhach))`
    : `SELECT CAST(NULL AS NVARCHAR(150)) AS Ten, CAST(0 AS DECIMAL(18,2)) AS S WHERE 1=0`}),
    lkThu AS (SELECT LTRIM(RTRIM(ISNULL(TenDoiTuong,''))) AS Ten, SUM(SoTien) AS S
              FROM PhieuThu WHERE LoaiDoiTuong = N'KhachHang' GROUP BY LTRIM(RTRIM(ISNULL(TenDoiTuong,'')))),
    lkDC AS (SELECT LTRIM(RTRIM(ISNULL(TenDoiTuong,''))) AS Ten, SUM(SoTien) AS S
             FROM CongNoDieuChinh WHERE LoaiDoiTuong = N'KhachHang' GROUP BY LTRIM(RTRIM(ISNULL(TenDoiTuong,'')))),
    T AS (SELECT Ten FROM lkBan UNION SELECT Ten FROM lkThu UNION SELECT Ten FROM lkDC UNION SELECT Ten FROM lkTra)
    SELECT T.Ten AS TenKhach,
           ISNULL(ban.DoanhThu,0) AS DoanhThu, ISNULL(ban.DoanhThuGomVAT,0) AS DoanhThuGomVAT, ISNULL(ban.SoPhieu,0) AS SoPhieu,
           ISNULL(tra.TraLai,0) AS TraLai, ISNULL(tra.TraLaiGomVAT,0) AS TraLaiGomVAT, ISNULL(thu.DaThuKy,0) AS DaThuKy,
           ISNULL(ban.DoanhThu,0) - ISNULL(tra.TraLai,0) AS DoanhThuThuan,
           ISNULL(lkBan.S,0) + ISNULL(lkDC.S,0) - ISNULL(lkThu.S,0) - ISNULL(lkTra.S,0) AS ConNo
    FROM T
    LEFT JOIN ban ON ban.Ten = T.Ten
    LEFT JOIN tra ON tra.Ten = T.Ten
    LEFT JOIN thu ON thu.Ten = T.Ten
    LEFT JOIN lkBan ON lkBan.Ten = T.Ten
    LEFT JOIN lkTra ON lkTra.Ten = T.Ten
    LEFT JOIN lkThu ON lkThu.Ten = T.Ten
    LEFT JOIN lkDC ON lkDC.Ten = T.Ten
    WHERE NULLIF(T.Ten, '') IS NOT NULL${loc}
    ORDER BY DoanhThuThuan DESC`;   /* v9.63: theo TEN cot — truoc la "ORDER BY 6", them cot la sai thu tu ngay */
  let rows = (await rq.query(sqlText)).recordset.map(r => ({
    TenKhach: r.TenKhach,
    DoanhThu: so(r.DoanhThu), DoanhThuGomVAT: so(r.DoanhThuGomVAT), SoPhieu: so(r.SoPhieu),
    TraLai: so(r.TraLai), TraLaiGomVAT: so(r.TraLaiGomVAT),
    DoanhThuThuan: so(r.DoanhThuThuan), DaThuKy: so(r.DaThuKy), ConNo: so(r.ConNo)
  }));

  /* ================================================================================================
     v9.77 — NHÓM KHÁCH HÀNG: gắn nhóm vào từng dòng, lọc theo nhóm, tổng hợp theo nhóm.
     Làm ở JS SAU truy vấn, KHÔNG mổ câu SQL công nợ ở trên: câu đó là nơi ra con số "Còn nợ" mà cả
     dashboard dựa vào — thêm JOIN vào đó là rủi ro nhân dòng (tên khách trùng trong danh mục) đúng
     kiểu lỗi #kh v6.69.2. Bản đồ tên → nhóm đã gom MỘT dòng/tên nên gắn ở đây là an toàn.
     `nhom` = danh sách NhomKhachHangID ngăn bằng '|', 0 = "Chưa gán nhóm"; rỗng = tất cả.
     ================================================================================================ */
  /* v9.87: TỔNG số khách có phát sinh công nợ, ĐẾM TRƯỚC mọi bộ lọc — để màn hình nói được
     "142 / 174 khách". Đếm riêng, KHÔNG dùng rows (rows đã qua `loc` ở câu SQL trên). */
  const tongKhach = (await pool.request().query(`
    SELECT COUNT(*) AS n FROM (
      SELECT LTRIM(RTRIM(TenKhach)) AS Ten FROM PhieuBanHang WHERE TrangThai <> N'Đã hủy'
      ${coNL ? "UNION SELECT LTRIM(RTRIM(TenKhach)) FROM PhieuNhapLai WHERE TrangThai <> N'Đã hủy'" : ''}
      UNION SELECT LTRIM(RTRIM(ISNULL(TenDoiTuong,''))) FROM PhieuThu        WHERE LoaiDoiTuong = N'KhachHang'
      UNION SELECT LTRIM(RTRIM(ISNULL(TenDoiTuong,''))) FROM CongNoDieuChinh WHERE LoaiDoiTuong = N'KhachHang'
    ) z WHERE NULLIF(z.Ten,'') IS NOT NULL`)).recordset[0].n;

  const bd = await banDoNhomKhach(pool);
  rows.forEach(r => { const n = nhomCuaTen(bd, r.TenKhach); r.NhomID = n.id; r.TenNhom = n.ten; });
  const dsNhom = String(req.query.nhom || '').split('|').map(s => s.trim()).filter(s => s !== '')
    .map(s => parseInt(s, 10)).filter(x => !isNaN(x));
  if (dsNhom.length) {
    const chon = new Set(dsNhom);
    rows = rows.filter(r => chon.has(r.NhomID));
  }
  /* Tổng hợp theo nhóm — cộng từ CHÍNH rows đã lọc, không truy vấn lần hai (hai phép tính là hai số lệch nhau). */
  const gomNhom = new Map();
  rows.forEach(r => {
    if (!gomNhom.has(r.NhomID)) gomNhom.set(r.NhomID, { NhomID: r.NhomID, TenNhom: r.TenNhom, SoKhach: 0, SoPhieu: 0, DoanhThu: 0, DoanhThuGomVAT: 0, TraLai: 0, DoanhThuThuan: 0, DaThuKy: 0, ConNo: 0 });
    const o = gomNhom.get(r.NhomID);
    o.SoKhach++; o.SoPhieu += r.SoPhieu; o.DoanhThu += r.DoanhThu; o.DoanhThuGomVAT += r.DoanhThuGomVAT;
    o.TraLai += r.TraLai; o.DoanhThuThuan += r.DoanhThuThuan; o.DaThuKy += r.DaThuKy; o.ConNo += r.ConNo;
  });
  const theoNhom = [...gomNhom.values()].sort((a, b) => b.DoanhThuThuan - a.DoanhThuThuan);

  /* Doanh thu thuan theo THANG (12 thang gan nhat) de ve bieu do - cung bo loc khach. v9.63: chua VAT. */
  const rq2 = pool.request();
  let loc2 = '';
  /* v9.77: lọc theo NHÓM thì biểu đồ tháng phải theo đúng tập khách còn lại — truyền danh sách TÊN của
     `rows` đã lọc vào cùng cơ chế IN (@k...) sẵn có. Quá 1.500 tên thì bỏ lọc (SQL Server tối đa 2.100
     tham số) và nói rõ ở `canhBao` thay vì cắt bớt im lặng. */
  const tenLoc = dsNhom.length ? rows.map(r => r.TenKhach) : dsKhach;
  let chartLechLoc = false;
  if (tenLoc.length && tenLoc.length <= 1500) {
    const ten = [...new Set(tenLoc)];
    ten.forEach((t, i) => rq2.input('k' + i, sql.NVarChar(150), t));
    loc2 = ' AND M.Ten IN (' + ten.map((_, i) => '@k' + i).join(',') + ')';
  } else if (tenLoc.length > 1500) chartLechLoc = true;
  const theoThang = (await rq2.query(`
    WITH M AS (
      SELECT LTRIM(RTRIM(TenKhach)) AS Ten, YEAR(NgayBan) AS Nam, MONTH(NgayBan) AS Thang,
             TienTruocVAT AS Tien
      FROM PhieuBanHang WHERE TrangThai <> N'Đã hủy'
      ${coNL ? `UNION ALL
      SELECT LTRIM(RTRIM(TenKhach)), YEAR(NgayNhap), MONTH(NgayNhap), -ISNULL(TienTruocVAT, 0)
      FROM PhieuNhapLai WHERE TrangThai <> N'Đã hủy'` : ''}
    )
    SELECT M.Nam, M.Thang, SUM(M.Tien) AS DoanhThuThuan
    FROM M
    WHERE M.Nam >= YEAR(DATEADD(MONTH, -11, GETDATE()))${loc2}
    GROUP BY M.Nam, M.Thang
    ORDER BY M.Nam, M.Thang`)).recordset.map(r => ({
      Nam: r.Nam, Thang: r.Thang, DoanhThuThuan: so(r.DoanhThuThuan)
    }));

  res.json({
    success: true,
    data: {
      rows, theoThang, theoNhom, nhom: bd.nhom, coNhom: bd.coNhom,   // v9.77
      tong: {
        doanhThu: rows.reduce((s, r) => s + r.DoanhThu, 0),
        doanhThuGomVAT: rows.reduce((s, r) => s + r.DoanhThuGomVAT, 0),   // v9.63: so gom VAT = so vao cong no
        traLai: rows.reduce((s, r) => s + r.TraLai, 0),
        traLaiGomVAT: rows.reduce((s, r) => s + r.TraLaiGomVAT, 0),
        doanhThuThuan: rows.reduce((s, r) => s + r.DoanhThuThuan, 0),
        daThuKy: rows.reduce((s, r) => s + r.DaThuKy, 0),
        conNo: rows.reduce((s, r) => s + r.ConNo, 0),
        soKhach: rows.length,
        /* 🔴 v9.87 (Nguyen 19–20/11): thẻ "CÒN NỢ (lũy kế)" CHỊU bộ lọc khách theo dõi / nhóm, nhưng
           phụ đề chỉ ghi "tính đến hiện tại, không theo kỳ" — không nói nó chỉ là MỘT PHẦN. Hậu quả
           thật: Nguyen đối chiếu với Báo cáo KD, thấy lệch 416.320.577, mất hai vòng truy nguyên mới
           ra là Dashboard đang lọc 142/174 khách. Nay trả về số khách TOÀN BỘ + cờ đang lọc để màn
           hình NÓI RA. Cùng bài học với [[feedback_qlnoibo_an_nut_khong_noi_ly_do]]. */
        soKhachTatCa: Number(tongKhach) || rows.length,
        dangLocKhach: dsKhach.length,
        dangLocNhom: !!(req.query.nhom || '').trim()
      },
      canhBao: [
        coNL ? null : 'Chưa chạy migration_v676 nên chưa trừ hàng khách trả vào doanh thu/công nợ.',
        chartLechLoc ? 'Hơn 1.500 khách trong nhóm đã chọn — biểu đồ 12 tháng đang vẽ cho TẤT CẢ khách (bảng bên dưới vẫn đúng nhóm).' : null,
        bd.coNhom ? null : 'Chưa chạy migration_v903.sql nên chưa có nhóm khách hàng — mọi khách xếp vào "Chưa gán nhóm".'
      ].filter(Boolean).join(' ') || null
    }
  });
});

module.exports = router;
