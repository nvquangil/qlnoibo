/* ================================================================================================
   PHIEU NHAP LAI  (v6.66)  - nhap ve hang KHACH TRA LAI.
   La ban ghi NGUOC cua phieu ban hang:
     - TON KHO : HOAN ton  (TheKhoChiTietMau.XuatCai -= SL don-vi-chinh). KHONG cong vao NhapCai,
                 NhapCai la so nhap tu san xuat - cong vao do se lam sai bao cao nhap.
     - CONG NO : TongThanhToan cua phieu nhap lai duoc TRU vao cong no khach hang.

   GIA KHOA CUNG THEO PHIEU XUAT (yeu cau nguoi dung):
     Server KHONG bao gio tin gia client gui len. Moi dong deu phai truy ra DUNG DONG DA BAN
     (PhieuBanHangChiTiet) roi lay nguyen GiaBanLe / %CKShop cua dong do; %CKNPP va %VAT lay nguyen
     cua PHIEU BAN goc. Nho vay so tien tra lai luon khop dung so tien da ghi no truoc do.
     Neu khach chua tung mua ma hang + mau do -> CHAN, khong doan gia.

   CHAN TRA VUOT: moi dong chi tra duoc toi da (da ban - da tra o cac phieu nhap lai truoc).

   ⚠️ SUA CONG NO PHAI SUA DONG BO 3 CHO (repo da tung lech vi co 2 ban tinh song song):
        congno.js congNoKhachHang()  |  congno.js soChiTietKH()  |  banhang.js "cong no truoc phieu"
   ================================================================================================ */
const express = require('express');
const ExcelJS = require('exceljs');
const { sql, getPool } = require('../db');
const { requireAuth, requirePermission, requireChucNang } = require('../middleware/auth');
/* v7.41: MOT ban cong thuc "cong no truoc chung tu" — dung chung voi routes/banhang.js. */
const { congNoTruocChungTu } = require('../utils/congNoTruocChungTu');
const { so, lam2, tien, laDonViGop, donViChinhLaGop, slSangCai, slSangDonViChinh,
        sinhSoPhieu, ghiXuatKho } = require('../utils/banHangCommon');

const router = express.Router();

// Luoi an toan cho handler async (Express 4 khong tu bat loi trong async - nut "im lang" la do day)
['get', 'post', 'put', 'delete'].forEach(method => {
  const goc = router[method].bind(router);
  router[method] = (path, ...handlers) => goc(path, ...handlers.map(h => (
    h.length >= 4 ? h : (req, res, next) => Promise.resolve(h(req, res, next)).catch(next)
  )));
});

const CN = 'nhaplai';   // ChucNang KHOHANG/nhaplai - PHAI trung key tab o frontend getTabs()

/* ================================================================================================
   TRUY GIA GOC: tra ve cac dong DA BAN cho khach, kem so DA TRA -> con tra duoc bao nhieu.
   Dung chung boi: man chon phieu xuat, o tu tim ma hang, VA khau kiem tra khi luu phieu.
   Dung chung nghia la man hinh hien bao nhieu thi luu duoc bay nhieu - khong the lech.
   `phieuBHID` = null  -> lay tat ca phieu ban cua khach (dung cho o tu tim ma hang).
   ================================================================================================ */
async function layDongDaBan(pool, tenKhach, phieuBHID) {
  const rq = pool.request().input('ten', sql.NVarChar, String(tenKhach || '').trim());
  if (phieuBHID) rq.input('pid', sql.Int, phieuBHID);
  const rs = (await rq.query(`
    SELECT ct.ID AS PhieuBHChiTietID, ct.PhieuBHID, p.SoPhieu, p.NgayBan,
           p.PhanTramCKNPP, p.PhanTramVAT,
           ct.MaHangID, ct.MauSacID, ct.SoLuong, ct.DonVi, ct.SoLuongCai,
           ct.GiaBanLe, ct.PhanTramCKShop, ct.GiaBan, ct.ThanhTien,
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
      AND LTRIM(RTRIM(p.TenKhach)) = @ten
      ${phieuBHID ? 'AND p.PhieuBHID = @pid' : ''}
    ORDER BY p.NgayBan DESC, p.PhieuBHID DESC, ct.ID`)).recordset;
  return rs.map(r => ({ ...r, ConTraCai: Math.max(0, so(r.SoLuongCai) - so(r.DaTraCai)) }));
}

/* ---------- danh sach khach da tung mua (de chon o form) ---------- */
router.get('/khach', requireAuth, requirePermission('KHOHANG', 'view'), requireChucNang('KHOHANG', CN), async (req, res) => {
  const pool = await getPool();
  const rs = (await pool.request().query(`
    SELECT LTRIM(RTRIM(TenKhach)) AS TenKhach, MAX(SDT) AS SDT, MAX(DiaChi) AS DiaChi,
           COUNT(*) AS SoPhieu, MAX(NgayBan) AS LanCuoi
    FROM PhieuBanHang WHERE TrangThai <> N'Đã hủy' AND NULLIF(LTRIM(RTRIM(TenKhach)), '') IS NOT NULL
    GROUP BY LTRIM(RTRIM(TenKhach)) ORDER BY MAX(NgayBan) DESC`)).recordset;
  res.json({ success: true, data: rs });
});

/* ---------- phieu xuat DA XUAT cho khach do (de chon) ---------- */
router.get('/phieuxuat', requireAuth, requirePermission('KHOHANG', 'view'), requireChucNang('KHOHANG', CN), async (req, res) => {
  const pool = await getPool();
  const rs = (await pool.request().input('ten', sql.NVarChar, String(req.query.tenKhach || '').trim()).query(`
    SELECT p.PhieuBHID, p.SoPhieu, p.NgayBan, p.TongSLCai, p.TongThanhToan,
           p.PhanTramCKNPP, p.PhanTramVAT
    FROM PhieuBanHang p
    WHERE p.TrangThai <> N'Đã hủy' AND LTRIM(RTRIM(p.TenKhach)) = @ten
    ORDER BY p.NgayBan DESC, p.PhieuBHID DESC`)).recordset;
  res.json({ success: true, data: rs });
});

/* ---------- cac dong cua 1 phieu xuat, kem SL con tra duoc ---------- */
router.get('/phieuxuat/:id/dong', requireAuth, requirePermission('KHOHANG', 'view'), requireChucNang('KHOHANG', CN), async (req, res) => {
  const pool = await getPool();
  const p = (await pool.request().input('id', sql.Int, req.params.id)
    .query('SELECT TenKhach FROM PhieuBanHang WHERE PhieuBHID=@id')).recordset[0];
  if (!p) return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu xuất.' });
  res.json({ success: true, data: await layDongDaBan(pool, p.TenKhach, Number(req.params.id)) });
});

/* ---------- TU TIM MA HANG trong pham vi da ban cho khach do ----------
   Van la "khoa cung theo phieu xuat": khong go duoc ma khach chua mua, gia lay tu chinh dong ban do. */
router.get('/timmahang', requireAuth, requirePermission('KHOHANG', 'view'), requireChucNang('KHOHANG', CN), async (req, res) => {
  const pool = await getPool();
  const ds = await layDongDaBan(pool, req.query.tenKhach, null);
  const q = String(req.query.q || '').trim().toLowerCase();
  const loc = q ? ds.filter(r => (String(r.MaHang || '') + ' ' + String(r.TenHang || '') + ' ' + String(r.TenMau || ''))
    .toLowerCase().includes(q)) : ds;
  res.json({ success: true, data: loc.filter(r => r.ConTraCai > 0).slice(0, 200) });
});

router.get('/next-sophieu', requireAuth, requirePermission('KHOHANG', 'view'), requireChucNang('KHOHANG', CN), async (req, res) => {
  const pool = await getPool();
  res.json({ success: true, data: await sinhSoPhieu(pool, 'PhieuNhapLai', 'SoPhieu', 'NL', null, 3) });
});

/* ================================================================================================
   DANH SACH PHIEU NHAP LAI
   ================================================================================================ */
function dieuKienLoc(rq, q) {
  const dk = [];
  if (q.tuNgay) { rq.input('tu', sql.Date, q.tuNgay); dk.push('p.NgayNhap >= @tu'); }
  if (q.denNgay) { rq.input('den', sql.Date, q.denNgay); dk.push('p.NgayNhap <= @den'); }
  if (q.khach) { rq.input('kh', sql.NVarChar, '%' + String(q.khach).trim() + '%'); dk.push('p.TenKhach LIKE @kh'); }
  if (q.soPhieu) { rq.input('sp', sql.NVarChar, '%' + String(q.soPhieu).trim() + '%'); dk.push('p.SoPhieu LIKE @sp'); }
  return dk.length ? 'WHERE ' + dk.join(' AND ') : '';
}
async function danhSachPhieu(pool, q) {
  const rq = pool.request();
  const where = dieuKienLoc(rq, q || {});
  return (await rq.query(`
    SELECT p.PhieuNLID, p.SoPhieu, p.NgayNhap, p.TenKhach, p.SDT, p.LyDo,
           p.TongSLCai, p.TongThanhToan, p.TrangThai, p.GhiChu, p.CreatedAt,
           pb.SoPhieu AS SoPhieuXuat, u.HoTen AS NguoiTao
    FROM PhieuNhapLai p
    LEFT JOIN PhieuBanHang pb ON pb.PhieuBHID = p.PhieuBHID
    LEFT JOIN Users u ON u.UserID = p.NguoiTaoID
    ${where}
    ORDER BY p.NgayNhap DESC, p.PhieuNLID DESC`)).recordset;
}
router.get('/phieu', requireAuth, requirePermission('KHOHANG', 'view'), requireChucNang('KHOHANG', CN), async (req, res) => {
  const pool = await getPool();
  res.json({ success: true, data: await danhSachPhieu(pool, req.query) });
});

/* ---------- Excel: DANH SACH phieu ----------
   ⚠️ Route chu (/phieu/export) PHAI dat TRUOC /phieu/:id, khong thi Express hieu "export" la :id. */
function boDauTiengViet(s) {
  const boDau = new RegExp('[\\u0300-\\u036f]', 'g');
  return String(s || '').normalize('NFD').replace(boDau, '')
    .replace(new RegExp('đ', 'g'), 'd').replace(new RegExp('Đ', 'g'), 'D')
    .replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}
function keBang(ws, tuDong, denDong, tuCot, denCot) {
  for (let r = tuDong; r <= denDong; r++) {
    for (let c = tuCot; c <= denCot; c++) {
      ws.getCell(r, c).border = {
        top: { style: 'thin' }, left: { style: 'thin' },
        bottom: { style: 'thin' }, right: { style: 'thin' }
      };
    }
  }
}
async function guiFile(res, wb, tenFile) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${tenFile}"`);
  await wb.xlsx.write(res);
  res.end();
}
router.get('/phieu/export', requireAuth, requirePermission('KHOHANG', 'view'), requireChucNang('KHOHANG', CN), async (req, res) => {
  const pool = await getPool();
  const ds = await danhSachPhieu(pool, req.query);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Phiếu nhập lại');
  ws.mergeCells('A1:I1');
  ws.getCell('A1').value = 'DANH SÁCH PHIẾU NHẬP LẠI (HÀNG KHÁCH TRẢ)';
  ws.getCell('A1').font = { bold: true, size: 14 };
  ws.getCell('A1').alignment = { horizontal: 'center' };
  ws.mergeCells('A2:I2');
  ws.getCell('A2').value = 'Từ ngày: ' + (req.query.tuNgay || '...') + '   Đến ngày: ' + (req.query.denNgay || '...');
  ws.getCell('A2').alignment = { horizontal: 'center' };
  ws.addRow([]);
  ws.columns = [
    { key: 'stt', width: 6 }, { key: 'sp', width: 14 }, { key: 'ngay', width: 12 },
    { key: 'khach', width: 28 }, { key: 'spx', width: 14 }, { key: 'lydo', width: 24 },
    { key: 'sl', width: 10 }, { key: 'tien', width: 16 }, { key: 'tt', width: 14 }
  ];
  const hdr = ws.addRow(['STT', 'Số phiếu', 'Ngày', 'Khách hàng', 'Phiếu xuất gốc', 'Lý do', 'SL (Cái)', 'Tiền trả lại', 'Trạng thái']);
  hdr.font = { bold: true };
  hdr.alignment = { horizontal: 'center', vertical: 'middle' };
  const dongDau = hdr.number + 1;
  ds.forEach((r, i) => {
    ws.addRow([i + 1, r.SoPhieu, r.NgayNhap ? new Date(r.NgayNhap) : null, r.TenKhach,
      r.SoPhieuXuat || '', r.LyDo || '', so(r.TongSLCai), so(r.TongThanhToan), r.TrangThai]);
  });
  const dongCuoi = ws.rowCount;
  if (ds.length) {
    const cotTien = ws.getColumn('tien').letter, cotSL = ws.getColumn('sl').letter;
    const tong = ws.addRow(['', '', '', 'TỔNG CỘNG', '', '',
      { formula: `SUM(${cotSL}${dongDau}:${cotSL}${dongCuoi})` },
      { formula: `SUM(${cotTien}${dongDau}:${cotTien}${dongCuoi})` }, '']);
    tong.font = { bold: true };
  }
  ws.getColumn('ngay').numFmt = 'dd/mm/yyyy';
  ws.getColumn('sl').numFmt = '#,##0';
  ws.getColumn('tien').numFmt = '#,##0';
  keBang(ws, hdr.number, ws.rowCount, 1, 9);
  await guiFile(res, wb, 'PhieuNhapLai_DanhSach.xlsx');
});

/* ---------- Excel: 1 PHIEU ---------- */
router.get('/phieu/:id/export', requireAuth, requirePermission('KHOHANG', 'view'), requireChucNang('KHOHANG', CN), async (req, res) => {
  const pool = await getPool();
  const { h, ct } = await docPhieu(pool, req.params.id);
  if (!h) return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu nhập lại.' });
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Phiếu nhập lại');
  ws.columns = [
    { key: 'stt', width: 6 }, { key: 'ma', width: 16 }, { key: 'ten', width: 30 },
    { key: 'mau', width: 14 }, { key: 'sl', width: 10 }, { key: 'dv', width: 10 },
    { key: 'cai', width: 10 }, { key: 'gia', width: 14 }, { key: 'ck', width: 10 },
    { key: 'gb', width: 14 }, { key: 'tt', width: 16 }
  ];
  ws.mergeCells('A1:K1');
  ws.getCell('A1').value = 'PHIẾU NHẬP LẠI HÀNG (KHÁCH TRẢ)';
  ws.getCell('A1').font = { bold: true, size: 14 };
  ws.getCell('A1').alignment = { horizontal: 'center' };
  ws.mergeCells('A2:K2');
  ws.getCell('A2').value = `Số phiếu: ${h.SoPhieu}     Ngày: ${h.NgayNhap ? new Date(h.NgayNhap).toLocaleDateString('vi-VN') : ''}`;
  ws.getCell('A2').alignment = { horizontal: 'center' };
  ws.addRow([]);
  ws.addRow(['Khách hàng:', h.TenKhach]);
  ws.addRow(['Điện thoại:', h.SDT || '']);
  ws.addRow(['Địa chỉ:', h.DiaChi || '']);
  ws.addRow(['Phiếu xuất gốc:', h.SoPhieuXuat || '(tự chọn mã hàng)']);
  ws.addRow(['Lý do trả:', h.LyDo || '']);
  ws.addRow([]);
  const hdr = ws.addRow(['STT', 'Mã hàng', 'Tên hàng', 'Màu', 'SL', 'ĐVT', 'SL (Cái)',
    'Giá bán lẻ', '%CK Shop', 'Giá bán', 'Thành tiền']);
  hdr.font = { bold: true };
  hdr.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  const dongDau = hdr.number + 1;
  ct.forEach((r, i) => ws.addRow([i + 1, r.MaHang, r.TenHang, r.TenMau || '', so(r.SoLuong), r.DonVi || '',
    so(r.SoLuongCai), so(r.GiaBanLe), so(r.PhanTramCKShop), so(r.GiaBan), so(r.ThanhTien)]));
  const dongCuoi = ws.rowCount;
  const cotTT = ws.getColumn('tt').letter;
  ws.addRow([]);
  const them = (nhan, gt) => {
    const r = ws.addRow(['', '', '', '', '', '', '', '', '', nhan, gt]);
    r.getCell(10).font = { bold: true };
    r.getCell(11).numFmt = '#,##0';
    return r;
  };
  them('Tổng tiền hàng', ct.length ? { formula: `SUM(${cotTT}${dongDau}:${cotTT}${dongCuoi})` } : 0);
  them(`Chiết khấu NPP (${so(h.PhanTramCKNPP)}%)`, so(h.TienCKNPP));
  them('Tổng tiền thanh toán', so(h.TienTruocVAT));
  them(`Thuế GTGT (${so(h.PhanTramVAT)}%)`, so(h.TienVAT));
  const cuoi = them('TỔNG TRỪ CÔNG NỢ', so(h.TongThanhToan));
  cuoi.font = { bold: true };
  ['sl', 'cai'].forEach(k => { ws.getColumn(k).numFmt = '#,##0'; });
  ['gia', 'gb', 'tt'].forEach(k => { ws.getColumn(k).numFmt = '#,##0'; });
  keBang(ws, hdr.number, dongCuoi, 1, 11);
  const ten = [boDauTiengViet(h.SoPhieu || h.PhieuNLID), boDauTiengViet(h.TenKhach)].filter(Boolean).join('_') || 'phieu';
  await guiFile(res, wb, `PhieuNhapLai_${ten}.xlsx`);
});

/* ---------- CHI TIET 1 PHIEU ---------- */
async function docPhieu(pool, id) {
  const h = (await pool.request().input('id', sql.Int, id).query(`
    SELECT p.*, pb.SoPhieu AS SoPhieuXuat, pb.NgayBan AS NgayXuatGoc, u.HoTen AS NguoiTao
    FROM PhieuNhapLai p
    LEFT JOIN PhieuBanHang pb ON pb.PhieuBHID = p.PhieuBHID
    LEFT JOIN Users u ON u.UserID = p.NguoiTaoID
    WHERE p.PhieuNLID = @id`)).recordset[0];
  if (!h) return { h: null, ct: [] };
  const ct = (await pool.request().input('id', sql.Int, id).query(`
    SELECT ct.*, h.MaHang, h.TenHang, h.DonViCoBan, h.DonViQuyDoi, h.LoaiRi, ms.TenMau,
           pb.SoPhieu AS SoPhieuBanGoc
    FROM PhieuNhapLaiChiTiet ct
    JOIN TheKhoHangHoa h ON h.MaHangID = ct.MaHangID
    LEFT JOIN MauSac ms ON ms.MauSacID = ct.MauSacID
    LEFT JOIN PhieuBanHangChiTiet bct ON bct.ID = ct.PhieuBHChiTietID
    LEFT JOIN PhieuBanHang pb ON pb.PhieuBHID = bct.PhieuBHID
    WHERE ct.PhieuNLID = @id ORDER BY ct.ID`)).recordset;
  return { h, ct };
}
router.get('/phieu/:id', requireAuth, requirePermission('KHOHANG', 'view'), requireChucNang('KHOHANG', CN), async (req, res) => {
  const pool = await getPool();
  const { h, ct } = await docPhieu(pool, req.params.id);
  if (!h) return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu nhập lại.' });
  /* ============================================================================================
     v7.41: CONG NO TRUOC PHIEU + CONG NO HIEN TAI, giong phieu ban hang (v6.24.3) de khach doi
     chieu ngay tren phieu tra hang.
     Dung CHUNG ham voi banhang.js (utils/congNoTruocChungTu.js) — hai phieu khong the noi hai con
     so khac nhau cho cung mot khach.
     ⚠️ KHAC DAU: phieu ban hang lam TANG no (CongNoTruoc + TongThanhToan), phieu nhap lai lam GIAM
     no (CongNoTruoc - TongThanhToan). Nham dau la in ra so gap doi thuc te.
     Boc try/catch: khoi cong no chi de DOI CHIEU, loi o day khong duoc lam mat ca phieu.
     ============================================================================================ */
  try {
    const kqNo = await congNoTruocChungTu(pool, sql, {
      tenKhach: h.TenKhach, ngay: h.NgayNhap, loai: 'PNL', id: h.PhieuNLID
    });
    h.CongNoTruoc = lam2(kqNo.congNoTruoc);
    h.TongCongNo = lam2(kqNo.congNoTruoc - so(h.TongThanhToan));   // TRA HANG -> GIAM no
  } catch (err) {
    console.warn('[nhaplai GET /phieu/:id] khong tinh duoc cong no truoc phieu:', err.message);
    h.CongNoTruoc = null;   // frontend hien dong do "(không lấy được)" thay vi im lang ra 0
    h.TongCongNo = null;
  }
  res.json({ success: true, data: { header: h, chiTiet: ct } });
});

/* ================================================================================================
   CHUAN BI PHIEU: tinh lai TOAN BO tien tu DONG DA BAN. Gia client gui len bi BO QUA hoan toan.
   Client chi can gui: { tenKhach, phieuBHID?, dong: [{ phieuBHChiTietID, soLuongCai }] }
   ================================================================================================ */
async function chuanBiPhieu(pool, b) {
  const tenKhach = String(b.tenKhach || '').trim();
  if (!tenKhach) return { loi: 'Chưa chọn khách hàng.' };
  const dongVao = Array.isArray(b.dong) ? b.dong.filter(d => d && d.phieuBHChiTietID) : [];
  if (!dongVao.length) return { loi: 'Phiếu chưa có dòng hàng nào. Chọn phiếu xuất rồi tích các mã cần nhập lại.' };

  // Nguon su that duy nhat cho gia + so con tra duoc
  const daBan = await layDongDaBan(pool, tenKhach, null);
  const banTheoID = new Map(daBan.map(r => [Number(r.PhieuBHChiTietID), r]));

  const dong = [];
  const gopTheoDong = new Map();   // chan tich 2 lan cung 1 dong ban trong cung 1 phieu
  for (const d of dongVao) {
    const g = banTheoID.get(Number(d.phieuBHChiTietID));
    if (!g) return { loi: `Dòng đã bán #${d.phieuBHChiTietID} không thuộc về khách "${tenKhach}" (hoặc phiếu bán đã hủy). Tải lại danh sách phiếu xuất.` };
    const soCai = Math.round(so(d.soLuongCai));
    if (soCai <= 0) return { loi: `Dòng ${g.MaHang}: số lượng nhập lại phải lớn hơn 0.` };
    const daGop = gopTheoDong.get(g.PhieuBHChiTietID) || 0;
    if (soCai + daGop > g.ConTraCai) {
      return { loi: `Dòng ${g.MaHang}${g.TenMau ? ' - ' + g.TenMau : ''} (phiếu ${g.SoPhieu}): đã bán ${so(g.SoLuongCai)} Cái, đã trả ${so(g.DaTraCai)} Cái, chỉ còn trả được ${g.ConTraCai} Cái — bạn đang nhập lại ${soCai + daGop} Cái.` };
    }
    gopTheoDong.set(g.PhieuBHChiTietID, daGop + soCai);

    /* SL theo DON VI CHINH de HOAN ton. Ma quan kho theo Ri chi hoan duoc boi so cua he so,
       neu khong se lam tron sai am tham - chan thang giong luc ban. */
    const heSo = so(g.LoaiRi) || 1;
    if (donViChinhLaGop(g) && heSo > 1 && soCai % heSo !== 0) {
      return { loi: `Mã ${g.MaHang} quản kho theo Ri (1 Ri = ${heSo} Cái) nên chỉ nhập lại được bội số của ${heSo} Cái — bạn đang nhập lại ${soCai} Cái.` };
    }
    const slChinh = donViChinhLaGop(g) ? Math.round(soCai / heSo) : soCai;
    if (slChinh <= 0) return { loi: `Dòng ${g.MaHang}: số lượng quy về đơn vị chính (${g.DonViCoBan || 'Cái'}) = 0.` };

    // Hien thi theo DUNG don vi da ban cho de doi chieu voi phieu xuat
    const banTheoDonViGop = laDonViGop(g.DonVi, g);
    const soLuongHT = banTheoDonViGop && heSo > 1 ? lam2(soCai / heSo) : soCai;

    // GIA: nguyen si tu dong da ban. KHONG lam tron lai, khong tinh lai tu %CK -> khong lech 1 dong.
    const giaBan = so(g.GiaBan);
    dong.push({
      phieuBHChiTietID: Number(g.PhieuBHChiTietID),
      maHangId: Number(g.MaHangID), mauSacId: g.MauSacID ? Number(g.MauSacID) : null,
      maHang: g.MaHang, donViCoBan: g.DonViCoBan,
      soLuong: soLuongHT, donVi: g.DonVi, soCai, slChinh,
      soLuongQuyDoi: heSo > 1 ? (banTheoDonViGop ? soCai : lam2(soCai / heSo)) : null,
      donViQuyDoi: heSo > 1 ? (banTheoDonViGop ? (g.DonViCoBan || 'Cái') : (g.DonViQuyDoi || 'Ri')) : null,
      giaBanLe: so(g.GiaBanLe), ckShop: so(g.PhanTramCKShop), giaBan,
      thanhTien: tien(giaBan * soCai),
      ghiChu: d.ghiChu || null,
      ckNPPGoc: so(g.PhanTramCKNPP), vatGoc: so(g.PhanTramVAT), phieuBHIDGoc: Number(g.PhieuBHID)
    });
  }

  /* %CKNPP va %VAT: lay cua PHIEU BAN GOC. Neu tich dong tu NHIEU phieu ban co ty le khac nhau thi
     tong tra lai se khong con khop tung phieu -> chan, bat lap rieng tung phieu.
     Tha bat lap 2 phieu con hon de cong no lech ngam. */
  const boTyLe = [...new Set(dong.map(d => d.ckNPPGoc + '|' + d.vatGoc))];
  if (boTyLe.length > 1) {
    return { loi: 'Các dòng đang chọn thuộc những phiếu xuất có %CK NPP hoặc %VAT khác nhau — số tiền trả lại sẽ không khớp với số đã ghi nợ. Hãy lập riêng mỗi phiếu xuất một phiếu nhập lại.' };
  }
  const ckNPP = dong[0].ckNPPGoc, vat = dong[0].vatGoc;
  const tongTienHang = tien(dong.reduce((s, d) => s + d.thanhTien, 0));
  const tienCKNPP = tien(tongTienHang * ckNPP / 100);
  const tienTruocVAT = tien(tongTienHang - tienCKNPP);
  const tienVAT = tien(tienTruocVAT * vat / 100);
  const tongThanhToan = tien(tienTruocVAT + tienVAT);
  // Neu moi dong tu 1 phieu ban -> ghi lien ket phieu goc cho de doi chieu
  const boPhieuGoc = [...new Set(dong.map(d => d.phieuBHIDGoc))];
  return {
    dong,
    tong: {
      ckNPP, vat, tongTienHang, tienCKNPP, tienTruocVAT, tienVAT, tongThanhToan,
      tongSLCai: dong.reduce((s, d) => s + d.soCai, 0),
      phieuBHID: boPhieuGoc.length === 1 ? boPhieuGoc[0] : (b.phieuBHID ? Number(b.phieuBHID) : null)
    }
  };
}

/* ---------- XEM TRUOC so tien (form goi de hien tong truoc khi luu) ---------- */
router.post('/tinhthu', requireAuth, requirePermission('KHOHANG', 'view'), requireChucNang('KHOHANG', CN), async (req, res) => {
  const pool = await getPool();
  const kq = await chuanBiPhieu(pool, req.body || {});
  if (kq.loi) return res.status(400).json({ success: false, message: kq.loi });
  res.json({ success: true, data: kq });
});

/* ================================================================================================
   LUU PHIEU
   ================================================================================================ */
router.post('/phieu', requireAuth, requirePermission('KHOHANG', 'create'), requireChucNang('KHOHANG', CN), async (req, res) => {
  const pool = await getPool();
  const user = req.session.user;
  const b = req.body || {};
  const kq = await chuanBiPhieu(pool, b);
  if (kq.loi) return res.status(400).json({ success: false, message: kq.loi });
  const { dong, tong } = kq;

  const tran = new sql.Transaction(pool);
  await tran.begin();
  try {
    // Sinh so phieu TRONG transaction: 2 nguoi luu cung luc thi nguoi sau loi UNIQUE va quay lui sach.
    const soPhieu = await sinhSoPhieu(new sql.Request(tran), 'PhieuNhapLai', 'SoPhieu', 'NL', null, 3);
    const phieuNLID = (await new sql.Request(tran)
      .input('SoPhieu', sql.NVarChar, soPhieu)
      .input('NgayNhap', sql.Date, b.ngayNhap || new Date())
      .input('KhachHangID', sql.Int, b.khachHangId || null)
      .input('TenKhach', sql.NVarChar, String(b.tenKhach).trim())
      .input('SDT', sql.NVarChar, b.sdt || null)
      .input('DiaChi', sql.NVarChar, b.diaChi || null)
      .input('PhieuBHID', sql.Int, tong.phieuBHID || null)
      .input('CKNPP', sql.Decimal(5, 2), tong.ckNPP)
      .input('VAT', sql.Decimal(5, 2), tong.vat)
      .input('TongTienHang', sql.Decimal(18, 2), tong.tongTienHang)
      .input('TienCKNPP', sql.Decimal(18, 2), tong.tienCKNPP)
      .input('TienTruocVAT', sql.Decimal(18, 2), tong.tienTruocVAT)
      .input('TienVAT', sql.Decimal(18, 2), tong.tienVAT)
      .input('TongThanhToan', sql.Decimal(18, 2), tong.tongThanhToan)
      .input('TongSLCai', sql.Int, tong.tongSLCai)
      .input('LyDo', sql.NVarChar, b.lyDo || null)
      .input('GhiChu', sql.NVarChar, b.ghiChu || null)
      .input('NguoiTaoID', sql.Int, user.userId)
      .query(`INSERT INTO PhieuNhapLai (SoPhieu, NgayNhap, KhachHangID, TenKhach, SDT, DiaChi, PhieuBHID,
                PhanTramCKNPP, PhanTramVAT, TongTienHang, TienCKNPP, TienTruocVAT, TienVAT, TongThanhToan,
                TongSLCai, LyDo, GhiChu, NguoiTaoID)
              OUTPUT INSERTED.PhieuNLID
              VALUES (@SoPhieu, @NgayNhap, @KhachHangID, @TenKhach, @SDT, @DiaChi, @PhieuBHID,
                @CKNPP, @VAT, @TongTienHang, @TienCKNPP, @TienTruocVAT, @TienVAT, @TongThanhToan,
                @TongSLCai, @LyDo, @GhiChu, @NguoiTaoID)`)).recordset[0].PhieuNLID;

    for (const d of dong) {
      await new sql.Request(tran)
        .input('PhieuNLID', sql.Int, phieuNLID)
        .input('MaHangID', sql.Int, d.maHangId)
        .input('MauSacID', sql.Int, d.mauSacId)
        .input('SoLuong', sql.Decimal(14, 2), d.soLuong)
        .input('DonVi', sql.NVarChar, d.donVi)
        .input('SoLuongCai', sql.Int, d.soCai)
        .input('SoLuongQuyDoi', sql.Decimal(14, 2), d.soLuongQuyDoi)
        .input('DonViQuyDoi', sql.NVarChar, d.donViQuyDoi)
        .input('GiaBanLe', sql.Decimal(14, 2), d.giaBanLe)
        .input('CKShop', sql.Decimal(5, 2), d.ckShop)
        .input('GiaBan', sql.Decimal(14, 2), d.giaBan)
        .input('ThanhTien', sql.Decimal(18, 2), d.thanhTien)
        .input('BCT', sql.Int, d.phieuBHChiTietID)
        .input('GhiChu', sql.NVarChar, d.ghiChu)
        .query(`INSERT INTO PhieuNhapLaiChiTiet (PhieuNLID, MaHangID, MauSacID, SoLuong, DonVi, SoLuongCai,
                  SoLuongQuyDoi, DonViQuyDoi, GiaBanLe, PhanTramCKShop, GiaBan, ThanhTien, PhieuBHChiTietID, GhiChu)
                VALUES (@PhieuNLID, @MaHangID, @MauSacID, @SoLuong, @DonVi, @SoLuongCai,
                  @SoLuongQuyDoi, @DonViQuyDoi, @GiaBanLe, @CKShop, @GiaBan, @ThanhTien, @BCT, @GhiChu)`);
      // HOAN ton: XuatCai -= slChinh  (sl am = hoan)
      if (d.mauSacId) await ghiXuatKho(pool, tran, d.maHangId, d.mauSacId, -d.slChinh, null, 'nhaplai');
    }
    await tran.commit();
    res.json({ success: true, data: { phieuNLID, soPhieu, tongThanhToan: tong.tongThanhToan } });
  } catch (err) {
    try { await tran.rollback(); } catch (e) { /* transaction co the da ket thuc */ }
    console.error('[nhaplai POST /phieu] ', err);
    res.status(400).json({ success: false, message: 'Lỗi khi lưu phiếu nhập lại (đã quay lui, dữ liệu giữ nguyên): ' + err.message });
  }
});

/* ---------- HUY phieu: TRU lai ton da hoan + khong con tru cong no ----------
   Khong cho SUA phieu nhap lai: gia da khoa cung theo phieu xuat nen "sua" thuc chat chi la doi so
   luong -> huy roi lap lai vua ro rang vua khong sinh duong sua ton thu hai. */
router.put('/phieu/:id/huy', requireAuth, requirePermission('KHOHANG', 'edit'), requireChucNang('KHOHANG', CN), async (req, res) => {
  const pool = await getPool();
  const h = (await pool.request().input('id', sql.Int, req.params.id)
    .query('SELECT * FROM PhieuNhapLai WHERE PhieuNLID=@id')).recordset[0];
  if (!h) return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu nhập lại.' });
  if (h.TrangThai === 'Đã hủy') return res.status(400).json({ success: false, message: 'Phiếu này đã hủy rồi.' });
  const tran = new sql.Transaction(pool);
  await tran.begin();
  try {
    await truLaiTon(pool, tran, req.params.id);
    await new sql.Request(tran).input('id', sql.Int, req.params.id)
      .query(`UPDATE PhieuNhapLai SET TrangThai = N'Đã hủy' WHERE PhieuNLID=@id`);
    await tran.commit();
    res.json({ success: true, message: 'Đã hủy phiếu nhập lại — tồn kho và công nợ đã trả về như trước.' });
  } catch (err) {
    try { await tran.rollback(); } catch (e) { /* da ket thuc */ }
    console.error('[nhaplai PUT /phieu/:id/huy] ', err);
    res.status(400).json({ success: false, message: 'Lỗi khi hủy phiếu (đã quay lui): ' + err.message });
  }
});

/* TRU lai so da hoan khi huy/xoa. Dung chung boi Huy va Xoa nen 2 duong khong the lech nhau. */
async function truLaiTon(pool, tran, id) {
  const ct = (await new sql.Request(tran).input('id', sql.Int, id).query(`
    SELECT ct.MaHangID, ct.MauSacID, ct.SoLuongCai, h.LoaiRi, h.DonViCoBan, h.DonViQuyDoi, h.MaHang
    FROM PhieuNhapLaiChiTiet ct JOIN TheKhoHangHoa h ON h.MaHangID = ct.MaHangID
    WHERE ct.PhieuNLID = @id`)).recordset;
  for (const d of ct) {
    if (!d.MauSacID) continue;
    const heSo = so(d.LoaiRi) || 1;
    const slChinh = donViChinhLaGop(d) ? Math.round(so(d.SoLuongCai) / heSo) : Math.round(so(d.SoLuongCai));
    if (slChinh > 0) await ghiXuatKho(pool, tran, d.MaHangID, d.MauSacID, slChinh,
      `${d.MaHang} trả lại ${slChinh} ${d.DonViCoBan || 'Cái'}`, 'nhaplai');
  }
}

router.delete('/phieu/:id', requireAuth, requirePermission('KHOHANG', 'delete'), requireChucNang('KHOHANG', CN), async (req, res) => {
  const pool = await getPool();
  const h = (await pool.request().input('id', sql.Int, req.params.id)
    .query('SELECT * FROM PhieuNhapLai WHERE PhieuNLID=@id')).recordset[0];
  if (!h) return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu nhập lại.' });
  const tran = new sql.Transaction(pool);
  await tran.begin();
  try {
    // Phieu da huy thi ton da tra lai roi - tru them lan nua se am kho.
    if (h.TrangThai !== 'Đã hủy') await truLaiTon(pool, tran, req.params.id);
    await new sql.Request(tran).input('id', sql.Int, req.params.id)
      .query('DELETE FROM PhieuNhapLai WHERE PhieuNLID=@id');   // chi tiet xoa theo CASCADE
    await tran.commit();
    res.json({ success: true, message: 'Đã xóa phiếu nhập lại.' });
  } catch (err) {
    try { await tran.rollback(); } catch (e) { /* da ket thuc */ }
    console.error('[nhaplai DELETE /phieu/:id] ', err);
    res.status(400).json({ success: false, message: 'Lỗi khi xóa phiếu (đã quay lui): ' + err.message });
  }
});

module.exports = router;
