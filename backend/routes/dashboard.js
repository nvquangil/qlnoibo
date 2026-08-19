/* ================================================================================================
   DASHBOARD KINH DOANH  (v6.67)
   Tra ve doanh thu + cong no cua NHUNG KHACH DUOC CHON theo doi (client gui len danh sach ten).

   ⚠️ NGUON SO LIEU PHAI TRUNG VOI MAN "CONG NO KHACH HANG" (routes/congno.js):
       Con no = Ban hang (TongThanhToan) + Dieu chinh - Da thu - Hang tra lai
   Neu o day tu nghi ra cong thuc khac thi 2 man hinh se ra 2 con so, va nguoi dung se tin con so
   TREN DASHBOARD vi no hien ngay khi dang nhap. Sua cong thuc o congno.js PHAI sua ca file nay.

   Doanh thu tinh theo KY (tuNgay..denNgay) con Con no la SO LUY KE DEN HIEN TAI - hai thu khac ban
   chat, dung tron: loc ngay ma van tru het tien da thu tu truoc ky se ra no am vo nghia.
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
  res.json({ success: true, data: rs });
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
    ban AS (SELECT LTRIM(RTRIM(TenKhach)) AS Ten, SUM(TongThanhToan) AS DoanhThu, COUNT(*) AS SoPhieu
            FROM PhieuBanHang WHERE TrangThai <> N'Đã hủy'${them(dkNgayBan)}
            GROUP BY LTRIM(RTRIM(TenKhach))),
    tra AS (${coNL ? `SELECT LTRIM(RTRIM(TenKhach)) AS Ten, SUM(TongThanhToan) AS TraLai
            FROM PhieuNhapLai WHERE TrangThai <> N'Đã hủy'${them(dkNgayNL)}
            GROUP BY LTRIM(RTRIM(TenKhach))`
    : `SELECT CAST(NULL AS NVARCHAR(150)) AS Ten, CAST(0 AS DECIMAL(18,2)) AS TraLai WHERE 1=0`}),
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
           ISNULL(ban.DoanhThu,0) AS DoanhThu, ISNULL(ban.SoPhieu,0) AS SoPhieu,
           ISNULL(tra.TraLai,0) AS TraLai, ISNULL(thu.DaThuKy,0) AS DaThuKy,
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
    ORDER BY 6 DESC`;
  const rows = (await rq.query(sqlText)).recordset.map(r => ({
    TenKhach: r.TenKhach,
    DoanhThu: so(r.DoanhThu), SoPhieu: so(r.SoPhieu), TraLai: so(r.TraLai),
    DoanhThuThuan: so(r.DoanhThuThuan), DaThuKy: so(r.DaThuKy), ConNo: so(r.ConNo)
  }));

  /* Doanh thu thuan theo THANG (12 thang gan nhat) de ve bieu do - cung bo loc khach. */
  const rq2 = pool.request();
  let loc2 = '';
  if (dsKhach.length) {
    const ten = [...new Set(dsKhach)];
    ten.forEach((t, i) => rq2.input('k' + i, sql.NVarChar(150), t));
    loc2 = ' AND M.Ten IN (' + ten.map((_, i) => '@k' + i).join(',') + ')';
  }
  const theoThang = (await rq2.query(`
    WITH M AS (
      SELECT LTRIM(RTRIM(TenKhach)) AS Ten, YEAR(NgayBan) AS Nam, MONTH(NgayBan) AS Thang,
             TongThanhToan AS Tien
      FROM PhieuBanHang WHERE TrangThai <> N'Đã hủy'
      ${coNL ? `UNION ALL
      SELECT LTRIM(RTRIM(TenKhach)), YEAR(NgayNhap), MONTH(NgayNhap), -TongThanhToan
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
      rows, theoThang,
      tong: {
        doanhThu: rows.reduce((s, r) => s + r.DoanhThu, 0),
        traLai: rows.reduce((s, r) => s + r.TraLai, 0),
        doanhThuThuan: rows.reduce((s, r) => s + r.DoanhThuThuan, 0),
        daThuKy: rows.reduce((s, r) => s + r.DaThuKy, 0),
        conNo: rows.reduce((s, r) => s + r.ConNo, 0),
        soKhach: rows.length
      },
      canhBao: coNL ? null : 'Chưa chạy migration_v676 nên chưa trừ hàng khách trả vào doanh thu/công nợ.'
    }
  });
});

module.exports = router;
