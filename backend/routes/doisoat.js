/* ================================================================================================
   DOI SOAT NGAN HANG  (v6.74)   — module DOISOAT, migration_v680.

   Khach chuyen khoan -> giao dich vao he thong -> TU KHOP vao cong no -> sinh PHIEU THU.
   3 duong nap giao dich, CUNG MOT bo may khop (utils/doiSoatEngine.js):
     1. POST /giaodich/import   nhap file sao ke Excel/CSV tai tu Internet Banking  (chay duoc ngay)
     2. POST /webhook/:key      dich vu trung gian (SePay/Casso/GPMPay) ban ve       (real-time)
     3. POST /giaodich          go tay 1 giao dich                                   (truong hop le)

   ⚠️ NGUYEN TAC: KHONG tu dong ghi so khoan doan mo ho.
   Chi tu sinh phieu thu khi do tin cay >= CauHinhHeThong.DOISOAT_TU_DONG_TU (mac dinh 100 = phai co
   ma phieu trong noi dung chuyen khoan). Cac muc thap hon chi hien GOI Y cho ke toan bam duyet.
   Ghi so sai mot khoan thu la sai ca cong no lan bao cao, go ra rat met — tha de ke toan bam 1 nut.
   ================================================================================================ */
const express = require('express');
const ExcelJS = require('exceljs');
const { sql, getPool } = require('../db');
const { requireAuth, requirePermission, requireChucNang } = require('../middleware/auth');
const { so, khongDau, khoaTrung, khopGiaoDich } = require('../utils/doiSoatEngine');

const router = express.Router();

['get', 'post', 'put', 'delete'].forEach(method => {
  const goc = router[method].bind(router);
  router[method] = (path, ...handlers) => goc(path, ...handlers.map(h => (
    h.length >= 4 ? h : (req, res, next) => Promise.resolve(h(req, res, next)).catch(next)
  )));
});

async function layCauHinh(pool, khoa, macDinh) {
  try {
    const r = (await pool.request().input('k', sql.NVarChar, khoa)
      .query('SELECT ConfigValue FROM CauHinhHeThong WHERE ConfigKey=@k')).recordset[0];
    return r && r.ConfigValue != null && r.ConfigValue !== '' ? r.ConfigValue : macDinh;
  } catch (e) { return macDinh; }
}

/* ================================================================================================
   1. TAI KHOAN NGAN HANG CUA CONG TY
   ================================================================================================ */
router.get('/taikhoan', requireAuth, requirePermission('DOISOAT', 'view'), requireChucNang('DOISOAT', 'taikhoan'), async (req, res) => {
  const pool = await getPool();
  const rs = (await pool.request().query(`
    SELECT b.*, tk.TenTaiKhoan,
           (SELECT COUNT(*) FROM BankGiaoDich g WHERE g.BankTKID = b.BankTKID) AS SoGiaoDich
    FROM BankTaiKhoan b
    LEFT JOIN DanhMucTaiKhoan tk ON tk.TaiKhoanID = b.TaiKhoanID
    ORDER BY b.MacDinh DESC, b.TenNganHang`)).recordset;
  res.json({ success: true, data: rs });
});

router.post('/taikhoan', requireAuth, requirePermission('DOISOAT', 'create'), requireChucNang('DOISOAT', 'taikhoan'), async (req, res) => {
  const pool = await getPool();
  const b = req.body || {};
  if (!b.maNganHang || !b.soTaiKhoan || !b.chuTaiKhoan) {
    return res.status(400).json({ success: false, message: 'Thiếu mã ngân hàng, số tài khoản hoặc chủ tài khoản.' });
  }
  // Chi duoc 1 tai khoan MAC DINH: bat cai moi thi tat het cai cu, khong thi QR lay nham tai khoan.
  if (b.macDinh) await pool.request().query('UPDATE BankTaiKhoan SET MacDinh = 0');
  const id = (await pool.request()
    .input('ma', sql.NVarChar, String(b.maNganHang).trim().toUpperCase())
    .input('ten', sql.NVarChar, b.tenNganHang || b.maNganHang)
    .input('stk', sql.NVarChar, String(b.soTaiKhoan).trim())
    .input('chu', sql.NVarChar, String(b.chuTaiKhoan).trim().toUpperCase())
    .input('tk', sql.Int, b.taiKhoanId || null)
    .input('md', sql.Bit, b.macDinh ? 1 : 0)
    .input('gc', sql.NVarChar, b.ghiChu || null)
    .query(`INSERT INTO BankTaiKhoan (MaNganHang, TenNganHang, SoTaiKhoan, ChuTaiKhoan, TaiKhoanID, MacDinh, GhiChu)
            OUTPUT INSERTED.BankTKID
            VALUES (@ma, @ten, @stk, @chu, @tk, @md, @gc)`)).recordset[0].BankTKID;
  res.json({ success: true, data: { BankTKID: id } });
});

router.put('/taikhoan/:id', requireAuth, requirePermission('DOISOAT', 'edit'), requireChucNang('DOISOAT', 'taikhoan'), async (req, res) => {
  const pool = await getPool();
  const b = req.body || {};
  if (b.macDinh) await pool.request().query('UPDATE BankTaiKhoan SET MacDinh = 0');
  /* ISNULL(@x, Cot): không gửi trường nào thì GIỮ NGUYÊN trường đó — bài học từ PUT /items/:id của
     thẻ kho, ở đó gán thẳng nên gửi thiếu là xoá trắng dữ liệu. */
  await pool.request()
    .input('id', sql.Int, req.params.id)
    .input('ma', sql.NVarChar, b.maNganHang ? String(b.maNganHang).trim().toUpperCase() : null)
    .input('ten', sql.NVarChar, b.tenNganHang || null)
    .input('stk', sql.NVarChar, b.soTaiKhoan ? String(b.soTaiKhoan).trim() : null)
    .input('chu', sql.NVarChar, b.chuTaiKhoan ? String(b.chuTaiKhoan).trim().toUpperCase() : null)
    .input('tk', sql.Int, b.taiKhoanId === undefined ? null : (b.taiKhoanId || null))
    .input('md', sql.Bit, b.macDinh === undefined ? null : (b.macDinh ? 1 : 0))
    .input('dd', sql.Bit, b.dangDung === undefined ? null : (b.dangDung ? 1 : 0))
    .input('gc', sql.NVarChar, b.ghiChu === undefined ? null : (b.ghiChu || null))
    .query(`UPDATE BankTaiKhoan SET
              MaNganHang=ISNULL(@ma, MaNganHang), TenNganHang=ISNULL(@ten, TenNganHang),
              SoTaiKhoan=ISNULL(@stk, SoTaiKhoan), ChuTaiKhoan=ISNULL(@chu, ChuTaiKhoan),
              TaiKhoanID=@tk, MacDinh=ISNULL(@md, MacDinh), DangDung=ISNULL(@dd, DangDung),
              GhiChu=ISNULL(@gc, GhiChu)
            WHERE BankTKID=@id`);
  res.json({ success: true });
});

router.delete('/taikhoan/:id', requireAuth, requirePermission('DOISOAT', 'delete'), requireChucNang('DOISOAT', 'taikhoan'), async (req, res) => {
  const pool = await getPool();
  const n = (await pool.request().input('id', sql.Int, req.params.id)
    .query('SELECT COUNT(*) AS c FROM BankGiaoDich WHERE BankTKID=@id')).recordset[0].c;
  if (n) return res.status(400).json({ success: false, message: `Tài khoản này đã có ${n} giao dịch — không xóa được. Hãy tắt "Đang dùng" thay vì xóa.` });
  await pool.request().input('id', sql.Int, req.params.id).query('DELETE FROM BankTaiKhoan WHERE BankTKID=@id');
  res.json({ success: true });
});

/* ================================================================================================
   2. MA QR CHUYEN KHOAN CHO 1 PHIEU BAN HANG
   Dung anh QR cua vietqr.io (khong can dang ky, khong can khoa API — chi la ANH, khong gui du lieu
   nhay cam nao ngoai so TK cong ty vốn đã in trên phiếu).
   NOI DUNG chuyen khoan = SO PHIEU -> luc doi soat khop duoc o muc chac chan (100).
   ================================================================================================ */
router.get('/qr/:phieuBHID', requireAuth, requirePermission('DOISOAT', 'view'), async (req, res) => {
  const pool = await getPool();
  const p = (await pool.request().input('id', sql.Int, req.params.phieuBHID)
    .query(`SELECT SoPhieu, TenKhach, TongThanhToan FROM PhieuBanHang WHERE PhieuBHID=@id`)).recordset[0];
  if (!p) return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu bán hàng.' });
  const tk = (await pool.request().query(`
    SELECT TOP 1 * FROM BankTaiKhoan WHERE DangDung = 1 ORDER BY MacDinh DESC, BankTKID`)).recordset[0];
  if (!tk) return res.status(400).json({ success: false, message: 'Chưa khai tài khoản ngân hàng nào — vào Đối soát ngân hàng → Tài khoản ngân hàng.' });
  const tien = Math.round(so(p.TongThanhToan));
  const url = `https://img.vietqr.io/image/${encodeURIComponent(tk.MaNganHang)}-${encodeURIComponent(tk.SoTaiKhoan)}-compact2.png`
    + `?amount=${tien}&addInfo=${encodeURIComponent(p.SoPhieu)}&accountName=${encodeURIComponent(tk.ChuTaiKhoan)}`;
  res.json({
    success: true,
    data: {
      anhQR: url, soPhieu: p.SoPhieu, soTien: tien,
      nganHang: tk.TenNganHang, soTaiKhoan: tk.SoTaiKhoan, chuTaiKhoan: tk.ChuTaiKhoan,
      noiDung: p.SoPhieu
    }
  });
});

/* ================================================================================================
   3. GHI 1 GIAO DICH + TU KHOP  (dung chung cho ca 3 duong nap)
   Tra ve { trung: true } neu giao dich da co (khoa chong trung) — KHONG coi la loi.
   ================================================================================================ */
async function ghiGiaoDich(pool, gd, nguon, userId) {
  const khoa = khoaTrung(gd.bankTKID, gd.ngayGD, gd.soTien, gd.noiDung, gd.soThamChieu);
  const daCo = (await pool.request().input('k', sql.NVarChar, khoa)
    .query('SELECT BankGDID FROM BankGiaoDich WHERE KhoaTrung=@k')).recordset[0];
  if (daCo) return { trung: true, bankGDID: daCo.BankGDID };

  const kq = await khopGiaoDich(pool, { SoTien: gd.soTien, NoiDung: gd.noiDung });
  const id = (await pool.request()
    .input('tk', sql.Int, gd.bankTKID)
    .input('ngay', sql.Date, gd.ngayGD)
    .input('tg', sql.DateTime2, gd.thoiGian || null)
    .input('tien', sql.Decimal(18, 2), so(gd.soTien))
    .input('nd', sql.NVarChar, gd.noiDung || null)
    .input('tc', sql.NVarChar, gd.soThamChieu || null)
    .input('khoa', sql.NVarChar, khoa)
    .input('ten', sql.NVarChar, kq.tenKhach || null)
    .input('pbh', sql.Int, kq.phieuBHID || null)
    .input('dtc', sql.Int, kq.doTinCay || 0)
    .input('nguon', sql.NVarChar, nguon)
    .input('gc', sql.NVarChar, kq.lyDo || null)
    .input('u', sql.Int, userId || null)
    .query(`INSERT INTO BankGiaoDich (BankTKID, NgayGD, ThoiGian, SoTien, NoiDung, SoThamChieu, KhoaTrung,
              TenKhachKhop, PhieuBHID, DoTinCay, Nguon, GhiChu, NguoiTaoID)
            OUTPUT INSERTED.BankGDID
            VALUES (@tk, @ngay, @tg, @tien, @nd, @tc, @khoa, @ten, @pbh, @dtc, @nguon, @gc, @u)`)).recordset[0].BankGDID;
  return { trung: false, bankGDID: id, doTinCay: kq.doTinCay || 0 };
}

/* Sinh PHIEU THU tu 1 giao dich da khop. Dung chung boi "tu dong" va "ke toan bam duyet" nen hai
   duong khong the ra hai ket qua khac nhau. */
async function sinhPhieuThu(pool, bankGDID, userId) {
  const g = (await pool.request().input('id', sql.Int, bankGDID).query(`
    SELECT g.*, b.TaiKhoanID FROM BankGiaoDich g
    JOIN BankTaiKhoan b ON b.BankTKID = g.BankTKID WHERE g.BankGDID = @id`)).recordset[0];
  if (!g) throw new Error('Không tìm thấy giao dịch.');
  if (g.TrangThai === 'Đã khớp') throw new Error('Giao dịch này đã khớp rồi.');
  if (!g.TenKhachKhop) throw new Error('Chưa xác định được khách hàng cho giao dịch này.');

  const tran = new sql.Transaction(pool);
  await tran.begin();
  try {
    // So phieu thu: PT + yy + 4 so, quet trong transaction de 2 nguoi bam cung luc khong trung.
    const yy = String(new Date().getFullYear()).slice(-2);
    const rs = (await new sql.Request(tran).input('p', sql.NVarChar, 'PT' + yy + '%')
      .query('SELECT SoPhieu FROM PhieuThu WHERE SoPhieu LIKE @p')).recordset;
    const max = rs.reduce((m, r) => {
      const x = new RegExp('^PT' + yy + '(\\d+)$').exec(String(r.SoPhieu).trim());
      return x ? Math.max(m, parseInt(x[1], 10) || 0) : m;
    }, 0);
    const soPhieu = 'PT' + yy + String(max + 1).padStart(4, '0');

    const ptID = (await new sql.Request(tran)
      .input('sp', sql.NVarChar, soPhieu)
      .input('ngay', sql.Date, g.NgayGD)
      .input('ten', sql.NVarChar, g.TenKhachKhop)
      .input('tk', sql.Int, g.TaiKhoanID || null)
      .input('pbh', sql.Int, g.PhieuBHID || null)
      .input('tien', sql.Decimal(18, 2), so(g.SoTien))
      .input('dg', sql.NVarChar, `Đối soát ngân hàng: ${g.NoiDung || ''}`.slice(0, 500))
      .input('bg', sql.Int, bankGDID)
      .input('u', sql.Int, userId || null)
      .query(`INSERT INTO PhieuThu (SoPhieu, NgayThu, LoaiDoiTuong, TenDoiTuong, TaiKhoanID, PhieuBHID,
                SoTien, HinhThuc, DienGiai, BankGDID, NguoiTaoID)
              OUTPUT INSERTED.PhieuThuID
              VALUES (@sp, @ngay, N'KhachHang', @ten, @tk, @pbh, @tien, N'Chuyển khoản', @dg, @bg, @u)`)).recordset[0].PhieuThuID;

    await new sql.Request(tran).input('id', sql.Int, bankGDID).input('pt', sql.Int, ptID)
      .query(`UPDATE BankGiaoDich SET TrangThai = N'Đã khớp', PhieuThuID = @pt WHERE BankGDID = @id`);
    await tran.commit();
    return { phieuThuID: ptID, soPhieu };
  } catch (err) {
    try { await tran.rollback(); } catch (e) { /* da ket thuc */ }
    throw err;
  }
}

/* ================================================================================================
   4. DANH SACH GIAO DICH
   ================================================================================================ */
router.get('/giaodich', requireAuth, requirePermission('DOISOAT', 'view'), requireChucNang('DOISOAT', 'giaodich'), async (req, res) => {
  const pool = await getPool();
  const rq = pool.request();
  const dk = [];
  if (req.query.tuNgay) { rq.input('tu', sql.Date, req.query.tuNgay); dk.push('g.NgayGD >= @tu'); }
  if (req.query.denNgay) { rq.input('den', sql.Date, req.query.denNgay); dk.push('g.NgayGD <= @den'); }
  if (req.query.trangThai) { rq.input('tt', sql.NVarChar, req.query.trangThai); dk.push('g.TrangThai = @tt'); }
  if (req.query.bankTKID) { rq.input('tk', sql.Int, req.query.bankTKID); dk.push('g.BankTKID = @tk'); }
  if (req.query.tim) { rq.input('q', sql.NVarChar, '%' + String(req.query.tim).trim() + '%'); dk.push('(g.NoiDung LIKE @q OR g.TenKhachKhop LIKE @q)'); }
  const rs = (await rq.query(`
    SELECT g.*, b.TenNganHang, b.SoTaiKhoan, pb.SoPhieu AS SoPhieuBH, pt.SoPhieu AS SoPhieuThu
    FROM BankGiaoDich g
    JOIN BankTaiKhoan b ON b.BankTKID = g.BankTKID
    LEFT JOIN PhieuBanHang pb ON pb.PhieuBHID = g.PhieuBHID
    LEFT JOIN PhieuThu pt ON pt.PhieuThuID = g.PhieuThuID
    ${dk.length ? 'WHERE ' + dk.join(' AND ') : ''}
    ORDER BY g.NgayGD DESC, g.BankGDID DESC`)).recordset;
  const tong = {
    soGD: rs.length,
    tienVao: rs.filter(r => so(r.SoTien) > 0).reduce((s, r) => s + so(r.SoTien), 0),
    cho: rs.filter(r => r.TrangThai === 'Chờ').length,
    daKhop: rs.filter(r => r.TrangThai === 'Đã khớp').length
  };
  res.json({ success: true, data: rs, tong });
});

/* ---------------- NHAP SAO KE Excel/CSV ----------------
   Khong ep dinh dang cua ngan hang nao: nguoi dung CHI RA cot nao la ngay/so tien/noi dung.
   Ep cung mot mau la moi ngan hang doi mau lai phai sua code. */
router.post('/giaodich/import', requireAuth, requirePermission('DOISOAT', 'create'), requireChucNang('DOISOAT', 'giaodich'), async (req, res) => {
  const pool = await getPool();
  const b = req.body || {};
  const dong = Array.isArray(b.dong) ? b.dong : [];
  if (!b.bankTKID) return res.status(400).json({ success: false, message: 'Chưa chọn tài khoản ngân hàng.' });
  if (!dong.length) return res.status(400).json({ success: false, message: 'Không có dòng giao dịch nào.' });

  const nguong = parseInt(await layCauHinh(pool, 'DOISOAT_TU_DONG_TU', '100'), 10) || 100;
  const kq = { them: 0, trung: 0, tuKhop: 0, loi: [] };
  for (const d of dong) {
    try {
      if (!d.ngayGD || !so(d.soTien)) { kq.loi.push(`Bỏ qua dòng thiếu ngày hoặc số tiền: ${JSON.stringify(d).slice(0, 80)}`); continue; }
      const r = await ghiGiaoDich(pool, {
        bankTKID: Number(b.bankTKID), ngayGD: d.ngayGD, thoiGian: d.thoiGian || null,
        soTien: d.soTien, noiDung: d.noiDung, soThamChieu: d.soThamChieu
      }, 'Sao kê', req.session.user.userId);
      if (r.trung) { kq.trung++; continue; }
      kq.them++;
      if (r.doTinCay >= nguong) {
        try { await sinhPhieuThu(pool, r.bankGDID, req.session.user.userId); kq.tuKhop++; }
        catch (e) { kq.loi.push('Không tự sinh được phiếu thu: ' + e.message); }
      }
    } catch (e) { kq.loi.push(e.message); }
  }
  res.json({
    success: true, data: kq,
    message: `Đã nhập ${kq.them} giao dịch mới, bỏ qua ${kq.trung} giao dịch trùng, tự khớp ${kq.tuKhop} phiếu thu.`
  });
});

/* ---------------- GO TAY 1 GIAO DICH ---------------- */
router.post('/giaodich', requireAuth, requirePermission('DOISOAT', 'create'), requireChucNang('DOISOAT', 'giaodich'), async (req, res) => {
  const pool = await getPool();
  const b = req.body || {};
  if (!b.bankTKID || !b.ngayGD || !so(b.soTien)) {
    return res.status(400).json({ success: false, message: 'Thiếu tài khoản, ngày hoặc số tiền.' });
  }
  const r = await ghiGiaoDich(pool, b, 'Nhập tay', req.session.user.userId);
  if (r.trung) return res.status(400).json({ success: false, message: 'Giao dịch này đã có trong hệ thống (trùng ngày + số tiền + nội dung).' });
  res.json({ success: true, data: r });
});

/* ---------------- KE TOAN BAM DUYET: chot khop + sinh phieu thu ----------------
   Cho phep sua lai TEN KHACH / PHIEU BAN HANG truoc khi chot — bo may chi GOI Y, nguoi quyet dinh. */
router.post('/giaodich/:id/khop', requireAuth, requirePermission('DOISOAT', 'edit'), requireChucNang('DOISOAT', 'giaodich'), async (req, res) => {
  const pool = await getPool();
  const b = req.body || {};
  if (b.tenKhach || b.phieuBHID !== undefined) {
    await pool.request()
      .input('id', sql.Int, req.params.id)
      .input('ten', sql.NVarChar, b.tenKhach ? String(b.tenKhach).trim() : null)
      .input('pbh', sql.Int, b.phieuBHID || null)
      .query(`UPDATE BankGiaoDich SET TenKhachKhop = ISNULL(@ten, TenKhachKhop), PhieuBHID = @pbh
              WHERE BankGDID = @id`);
  }
  const kq = await sinhPhieuThu(pool, req.params.id, req.session.user.userId);
  res.json({ success: true, data: kq, message: `Đã tạo phiếu thu ${kq.soPhieu}.` });
});

/* ---------------- BO QUA / HOAN TAC ---------------- */
router.put('/giaodich/:id/boqua', requireAuth, requirePermission('DOISOAT', 'edit'), requireChucNang('DOISOAT', 'giaodich'), async (req, res) => {
  const pool = await getPool();
  const g = (await pool.request().input('id', sql.Int, req.params.id)
    .query('SELECT TrangThai FROM BankGiaoDich WHERE BankGDID=@id')).recordset[0];
  if (!g) return res.status(404).json({ success: false, message: 'Không tìm thấy giao dịch.' });
  if (g.TrangThai === 'Đã khớp') return res.status(400).json({ success: false, message: 'Giao dịch đã khớp — hãy xóa phiếu thu trước nếu muốn bỏ qua.' });
  await pool.request().input('id', sql.Int, req.params.id).input('gc', sql.NVarChar, (req.body || {}).ghiChu || null)
    .query(`UPDATE BankGiaoDich SET TrangThai = N'Bỏ qua', GhiChu = ISNULL(@gc, GhiChu) WHERE BankGDID=@id`);
  res.json({ success: true, message: 'Đã đánh dấu bỏ qua.' });
});

router.put('/giaodich/:id/mokhop', requireAuth, requirePermission('DOISOAT', 'edit'), requireChucNang('DOISOAT', 'giaodich'), async (req, res) => {
  const pool = await getPool();
  const g = (await pool.request().input('id', sql.Int, req.params.id)
    .query('SELECT PhieuThuID FROM BankGiaoDich WHERE BankGDID=@id')).recordset[0];
  if (!g) return res.status(404).json({ success: false, message: 'Không tìm thấy giao dịch.' });
  /* KHONG tu xoa phieu thu o day: phieu thu co the da doi chieu/bao cao roi. Bat nguoi dung xoa
     ben man Phieu thu cho co chu dich, roi moi mo khop lai. */
  if (g.PhieuThuID) {
    return res.status(400).json({ success: false, message: 'Giao dịch này đang gắn phiếu thu — xóa phiếu thu đó ở màn Phiếu thu trước, rồi mở khớp lại.' });
  }
  await pool.request().input('id', sql.Int, req.params.id)
    .query(`UPDATE BankGiaoDich SET TrangThai = N'Chờ' WHERE BankGDID=@id`);
  res.json({ success: true, message: 'Đã đưa về trạng thái Chờ.' });
});

/* ================================================================================================
   5. WEBHOOK — dich vu trung gian ban giao dich ve (real-time)
   KHONG requireAuth (may chu ben kia goi), chan bang KHOA BI MAT tren duong dan + so sanh AN TOAN.
   Khoa rong = TAT hoan toan, khong phai "cho qua het" — mac dinh phai la dong, khong phai mo.
   ================================================================================================ */
router.post('/webhook/:key', async (req, res) => {
  const pool = await getPool();
  const khoa = String(await layCauHinh(pool, 'DOISOAT_WEBHOOK_KEY', '') || '').trim();
  if (!khoa) return res.status(403).json({ success: false, message: 'Webhook chưa được bật.' });
  const gui = String(req.params.key || '');
  // So sanh do dai truoc roi so tung ky tu -> khong lo lot thong tin qua thoi gian phan hoi.
  if (gui.length !== khoa.length) return res.status(403).json({ success: false, message: 'Sai khóa.' });
  let lech = 0;
  for (let i = 0; i < khoa.length; i++) lech |= (khoa.charCodeAt(i) ^ gui.charCodeAt(i));
  if (lech !== 0) return res.status(403).json({ success: false, message: 'Sai khóa.' });

  const b = req.body || {};
  /* Nhan nhieu ten truong khac nhau: moi dich vu goi mot kieu (SePay: transferAmount/content;
     Casso: amount/description). Nhan het thay vi ep 1 dich vu — doi nha cung cap khoi sua code. */
  const soTien = so(b.soTien != null ? b.soTien : (b.transferAmount != null ? b.transferAmount : b.amount));
  const noiDung = b.noiDung || b.content || b.description || '';
  const ngay = b.ngayGD || b.transactionDate || b.when || new Date();
  const stk = String(b.soTaiKhoan || b.accountNumber || b.subAccId || '').trim();
  if (!soTien) return res.status(400).json({ success: false, message: 'Thiếu số tiền.' });

  const tk = (await pool.request().input('stk', sql.NVarChar, stk).query(`
    SELECT TOP 1 BankTKID FROM BankTaiKhoan
    WHERE (@stk <> '' AND SoTaiKhoan = @stk) OR (@stk = '' AND MacDinh = 1)
    ORDER BY MacDinh DESC`)).recordset[0];
  if (!tk) return res.status(400).json({ success: false, message: 'Không khớp tài khoản ngân hàng nào đã khai.' });

  const r = await ghiGiaoDich(pool, {
    bankTKID: tk.BankTKID, ngayGD: new Date(ngay), thoiGian: new Date(ngay),
    soTien, noiDung, soThamChieu: b.soThamChieu || b.referenceCode || b.tid || null
  }, 'Webhook', null);
  if (r.trung) return res.json({ success: true, trung: true, message: 'Giao dịch đã có, bỏ qua.' });

  const nguong = parseInt(await layCauHinh(pool, 'DOISOAT_TU_DONG_TU', '100'), 10) || 100;
  let phieuThu = null;
  if (r.doTinCay >= nguong) {
    try { phieuThu = (await sinhPhieuThu(pool, r.bankGDID, null)).soPhieu; }
    catch (e) { console.error('[doisoat webhook] khong sinh duoc phieu thu:', e.message); }
  }
  res.json({ success: true, data: { bankGDID: r.bankGDID, doTinCay: r.doTinCay, phieuThu } });
});

/* ================================================================================================
   6. XUAT EXCEL SO DOI SOAT
   ================================================================================================ */
router.get('/giaodich/export', requireAuth, requirePermission('DOISOAT', 'view'), requireChucNang('DOISOAT', 'giaodich'), async (req, res) => {
  const pool = await getPool();
  const rs = (await pool.request().query(`
    SELECT g.NgayGD, b.TenNganHang, b.SoTaiKhoan, g.SoTien, g.NoiDung, g.TenKhachKhop,
           g.DoTinCay, g.TrangThai, pt.SoPhieu AS SoPhieuThu, pb.SoPhieu AS SoPhieuBH
    FROM BankGiaoDich g
    JOIN BankTaiKhoan b ON b.BankTKID = g.BankTKID
    LEFT JOIN PhieuThu pt ON pt.PhieuThuID = g.PhieuThuID
    LEFT JOIN PhieuBanHang pb ON pb.PhieuBHID = g.PhieuBHID
    ORDER BY g.NgayGD DESC, g.BankGDID DESC`)).recordset;

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Đối soát');
  ws.mergeCells('A1:J1');
  ws.getCell('A1').value = 'SỔ ĐỐI SOÁT NGÂN HÀNG';
  ws.getCell('A1').font = { bold: true, size: 14 };
  ws.getCell('A1').alignment = { horizontal: 'center' };
  ws.addRow([]);
  ws.columns = [
    { key: 'stt', width: 6 }, { key: 'ngay', width: 12 }, { key: 'nh', width: 18 },
    { key: 'stk', width: 18 }, { key: 'tien', width: 16 }, { key: 'nd', width: 40 },
    { key: 'khach', width: 24 }, { key: 'dtc', width: 10 }, { key: 'tt', width: 12 }, { key: 'pt', width: 14 }
  ];
  const hdr = ws.addRow(['STT', 'Ngày', 'Ngân hàng', 'Số TK', 'Số tiền', 'Nội dung', 'Khách khớp', 'Độ tin cậy', 'Trạng thái', 'Phiếu thu']);
  hdr.font = { bold: true };
  hdr.alignment = { horizontal: 'center', vertical: 'middle' };
  const dongDau = hdr.number + 1;
  rs.forEach((r, i) => ws.addRow([i + 1, r.NgayGD ? new Date(r.NgayGD) : null, r.TenNganHang, r.SoTaiKhoan,
    so(r.SoTien), r.NoiDung || '', r.TenKhachKhop || '', r.DoTinCay || 0, r.TrangThai, r.SoPhieuThu || '']));
  const dongCuoi = ws.rowCount;
  if (rs.length) {
    const c = ws.getColumn('tien').letter;
    const t = ws.addRow(['', '', '', 'TỔNG CỘNG', { formula: `SUM(${c}${dongDau}:${c}${dongCuoi})` }, '', '', '', '', '']);
    t.font = { bold: true };
  }
  ws.getColumn('ngay').numFmt = 'dd/mm/yyyy';
  ws.getColumn('tien').numFmt = '#,##0';
  for (let r = hdr.number; r <= ws.rowCount; r++) {
    for (let c = 1; c <= 10; c++) {
      ws.getCell(r, c).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    }
  }
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="SoDoiSoatNganHang.xlsx"');
  await wb.xlsx.write(res);
  res.end();
});

module.exports = router;
