/* ================================================================================================
   PHIEU NHAP KHO HANG HOA  (v6.78)  - module KHOHANG, chuc nang 'nhapkho', migration_v681.

   HAI LOAI NHAP:
     - NhaCungCap : hang mua ngoai, CO don gia -> TANG CONG NO PHAI TRA cho NCC.
     - SanXuat    : hang xuong minh lam ra, gan LENH SX, KHONG sinh cong no.

   TON KHO: NhapCai += SoLuongChinh (theo DON VI CHINH cua ma hang, khong phai Cai).
   Huy/xoa phieu thi tru lai dung so do.

   ⚠️ TRUOC DAY co 2 duong lam tang NhapCai ma khong co chung tu (go tay o the kho, ghi nhan cong
   doan cuoi o QLSX). File nay THEM duong thu 3 nhung CO chung tu - khong go bo 2 duong cu vi chung
   dang chay that; nguoi dung tu chon dung duong nao.

   ⚠️ v6.87 - PHIEU NHAP KHO KHONG TAO MA HANG NUA (migration_v682).
   Truoc day luu phieu la tu tao luon ma hang trong TheKhoHangHoa. Sai o hai cho: mot chung tu nhap
   kho khong duoc phep tao ngam danh muc (go sai chinh ta = rac danh muc), va nut "Tao the kho" o
   phieu nhap luon bao "ma da ton tai" vi chinh no vua tao ra ma do.
   NAY:
     - Dong hang mang ma DA CO   -> MaHangID co gia tri, CONG TON ngay.
     - Dong hang mang ma CHUA CO -> MaHangID = NULL, luu vao cot MaHangCho/TenHangCho/... ,
       KHONG tao ma hang, KHONG cong ton. Dong do "CHO TAO THE KHO".
     - Luc nguoi dung thuc su tao the kho -> POST /gan-mahang gan MaHangID vao cac dong dang cho VA
       cong ton o dung thoi diem do.
   => Moi dong chi cong ton DUNG MOT LAN, hoac luc luu phieu, hoac luc tao the kho. Khong bao gio ca hai.
   ================================================================================================ */
const express = require('express');
const ExcelJS = require('exceljs');
const { sql, getPool } = require('../db');
const { requireAuth, requirePermission, requireChucNang } = require('../middleware/auth');
const { so, tien, laDonViGop, donViChinhLaGop, slSangCai, sinhSoPhieu } = require('../utils/banHangCommon');

const router = express.Router();

['get', 'post', 'put', 'delete'].forEach(method => {
  const goc = router[method].bind(router);
  router[method] = (path, ...handlers) => goc(path, ...handlers.map(h => (
    h.length >= 4 ? h : (req, res, next) => Promise.resolve(h(req, res, next)).catch(next)
  )));
});

const CN = 'nhapkho';

/* Quy SL nguoi dung go ve DON VI CHINH cua ma hang (giong slSangDonViChinh ben banHangCommon,
   nhung o day nhan san doi tuong ma hang da doc tu CSDL). */
function veDonViChinh(soLuong, donVi, mh) {
  const he = so(mh.LoaiRi) || 1;
  const cai = slSangCai(soLuong, donVi, mh.LoaiRi, mh);
  return Math.round(donViChinhLaGop(mh) ? cai / he : cai);
}

/* ---------- TANG / TRU TON: ham DUY NHAT duoc phep dong vao NhapCai tu phan he nay ----------
   sl > 0 = nhap them;  sl < 0 = tru lai (huy/xoa phieu).
   Khi TRU co dieu kien NhapCai >= sl: huy phieu ma hang da ban het roi thi phai bao loi, khong
   duoc de NhapCai am -> ton kho am ngam. */
async function ghiNhapKho(pool, tran, maHangId, mauSacId, sl, nhan) {
  const rq = () => (tran ? new sql.Request(tran) : pool.request());
  if (sl > 0) {
    const kq = await rq().input('mh', sql.Int, maHangId).input('ms', sql.Int, mauSacId).input('sl', sql.Int, sl)
      .query(`UPDATE TheKhoChiTietMau SET NhapCai = NhapCai + @sl WHERE MaHangID=@mh AND MauSacID=@ms`);
    if (!kq.rowsAffected[0]) {
      // Chua co dong mau nay trong the kho -> tao. Khac voi luc TRU ton (ben banhang.js) la
      // khong duoc tao dong moi; o day tao la dung, vi nhap kho chinh la luc dong mau ra doi.
      await rq().input('mh', sql.Int, maHangId).input('ms', sql.Int, mauSacId).input('sl', sql.Int, sl)
        .query(`INSERT INTO TheKhoChiTietMau (MaHangID, MauSacID, SoCatCai, NhapCai, XuatCai)
                VALUES (@mh, @ms, 0, @sl, 0)`);
    }
    return;
  }
  const kq = await rq().input('mh', sql.Int, maHangId).input('ms', sql.Int, mauSacId).input('sl', sql.Int, -sl)
    .query(`UPDATE TheKhoChiTietMau SET NhapCai = NhapCai - @sl
            WHERE MaHangID=@mh AND MauSacID=@ms AND (NhapCai - @sl) >= XuatCai`);
  if (!kq.rowsAffected[0]) {
    throw new Error(`Không trừ lại được tồn${nhan ? ' (' + nhan + ')' : ''} — hàng đã xuất đi mất rồi. Phải hủy các phiếu bán/xuất liên quan trước.`);
  }
}

/* ================================================================================================
   DANH MUC PHUC VU FORM
   ================================================================================================ */
router.get('/danhmuc', requireAuth, requirePermission('KHOHANG', 'view'), requireChucNang('KHOHANG', CN), async (req, res) => {
  const pool = await getPool();
  const q = (t) => pool.request().query(t).then(r => r.recordset);
  const [ncc, donHang, theKho, nhom, mauSac, donVi] = await Promise.all([
    q('SELECT NCC_ID, TenNCC FROM NhaCungCap ORDER BY TenNCC'),
    /* v6.80: CHI lay lenh SX DA HOAN THANH. Lenh dang san xuat ma cho nhap kho thanh pham thi so
       "da hoan thanh" cua lenh do va ton kho se lech nhau, khong ai doi chieu duoc. */
    q(`SELECT TOP 300 DonHangID, MaDH, TenSanPham FROM DonHangSanXuat
       WHERE TrangThai = N'Hoàn thành' ORDER BY DonHangID DESC`),
    q('SELECT TheKhoDanhMucID, TenTheKho FROM TheKhoDanhMuc ORDER BY TenTheKho'),
    q('SELECT NhomSanPhamID, TenNhom FROM NhomSanPham ORDER BY TenNhom').catch(() => []),
    q('SELECT MauSacID, TenMau FROM MauSac ORDER BY TenMau'),
    q('SELECT TenDonVi FROM DanhMucDonViTinh ORDER BY TenDonVi').catch(() => [])
  ]);
  const hang = await q(`
    SELECT MaHangID, MaHang, TenHang, LoaiRi, DonViCoBan, DonViQuyDoi, GiaBan
    FROM TheKhoHangHoa ORDER BY MaHang`);
  res.json({ success: true, data: { ncc, donHang, theKho, nhom, mauSac, donVi, hang } });
});

/* ================================================================================================
   v6.83: CAC PHIEU NHAP KHO CUA MOT MA HANG.
   Dung o form The kho hang hoa: chon "Nguon hang = Nha san xuat" thi hien danh sach phieu nhap da
   nhap ma hang do, bam sang xem duoc.
   CHI DE XEM - khong dien nguoc gi vao the kho. Phieu nhap luu xong LA DA CONG TON roi; dien them
   so luong vao the kho nua la ton bi dem hai lan.
   ================================================================================================ */
router.get('/theo-mahang/:maHangId', requireAuth, requirePermission('KHOHANG', 'view'), requireChucNang('KHOHANG', CN), async (req, res) => {
  const pool = await getPool();
  const rs = (await pool.request().input('mh', sql.Int, req.params.maHangId).query(`
    SELECT p.PhieuNKID, p.SoPhieu, p.NgayNhap, p.LoaiNhap, p.TrangThai,
           ncc.TenNCC, d.MaDH,
           SUM(ct.SoLuong) AS SoLuong, MAX(ct.DonVi) AS DonVi,
           SUM(ISNULL(ct.ThanhTien, 0)) AS ThanhTien
    FROM PhieuNhapKhoHangChiTiet ct
    JOIN PhieuNhapKhoHang p ON p.PhieuNKID = ct.PhieuNKID
    LEFT JOIN NhaCungCap ncc ON ncc.NCC_ID = p.NCC_ID
    LEFT JOIN DonHangSanXuat d ON d.DonHangID = p.DonHangID
    WHERE ct.MaHangID = @mh
    GROUP BY p.PhieuNKID, p.SoPhieu, p.NgayNhap, p.LoaiNhap, p.TrangThai, ncc.TenNCC, d.MaDH
    ORDER BY p.NgayNhap DESC, p.PhieuNKID DESC`)).recordset;
  res.json({ success: true, data: rs });
});

/* ================================================================================================
   DANH SACH PHIEU
   ================================================================================================ */
async function danhSach(pool, q) {
  const rq = pool.request();
  const dk = [];
  if (q.tuNgay) { rq.input('tu', sql.Date, q.tuNgay); dk.push('p.NgayNhap >= @tu'); }
  if (q.denNgay) { rq.input('den', sql.Date, q.denNgay); dk.push('p.NgayNhap <= @den'); }
  if (q.loaiNhap) { rq.input('ln', sql.NVarChar, q.loaiNhap); dk.push('p.LoaiNhap = @ln'); }
  if (q.soPhieu) { rq.input('sp', sql.NVarChar, '%' + String(q.soPhieu).trim() + '%'); dk.push('p.SoPhieu LIKE @sp'); }
  return (await rq.query(`
    SELECT p.*, ncc.TenNCC, d.MaDH, u.HoTen AS NguoiTao,
           (SELECT COUNT(*) FROM PhieuNhapKhoHangChiTiet ct WHERE ct.PhieuNKID = p.PhieuNKID) AS SoDong,
           -- v6.87: so dong con CHO TAO THE KHO (ma chua co trong danh muc -> chua cong ton)
           (SELECT COUNT(*) FROM PhieuNhapKhoHangChiTiet ct
             WHERE ct.PhieuNKID = p.PhieuNKID AND ct.MaHangID IS NULL) AS SoDongCho
    FROM PhieuNhapKhoHang p
    LEFT JOIN NhaCungCap ncc ON ncc.NCC_ID = p.NCC_ID
    LEFT JOIN DonHangSanXuat d ON d.DonHangID = p.DonHangID
    LEFT JOIN Users u ON u.UserID = p.NguoiTaoID
    ${dk.length ? 'WHERE ' + dk.join(' AND ') : ''}
    ORDER BY p.NgayNhap DESC, p.PhieuNKID DESC`)).recordset;
}
router.get('/phieu', requireAuth, requirePermission('KHOHANG', 'view'), requireChucNang('KHOHANG', CN), async (req, res) => {
  const pool = await getPool();
  res.json({ success: true, data: await danhSach(pool, req.query) });
});

router.get('/next-sophieu', requireAuth, requirePermission('KHOHANG', 'view'), requireChucNang('KHOHANG', CN), async (req, res) => {
  const pool = await getPool();
  res.json({ success: true, data: await sinhSoPhieu(pool, 'PhieuNhapKhoHang', 'SoPhieu', 'NK', null, 4) });
});

/* ---------- Excel: DANH SACH (dat TRUOC /phieu/:id keo Express hieu "export" la :id) ---------- */
function boDau(s) {
  const d = new RegExp('[\\u0300-\\u036f]', 'g');
  return String(s || '').normalize('NFD').replace(d, '')
    .replace(new RegExp('đ', 'g'), 'd').replace(new RegExp('Đ', 'g'), 'D')
    .replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}
function keBang(ws, r1, r2, c1, c2) {
  for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) {
    ws.getCell(r, c).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
  }
}
router.get('/phieu/export', requireAuth, requirePermission('KHOHANG', 'view'), requireChucNang('KHOHANG', CN), async (req, res) => {
  const pool = await getPool();
  const ds = await danhSach(pool, req.query);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Phiếu nhập kho');
  ws.mergeCells('A1:I1');
  ws.getCell('A1').value = 'DANH SÁCH PHIẾU NHẬP KHO HÀNG HÓA';
  ws.getCell('A1').font = { bold: true, size: 14 };
  ws.getCell('A1').alignment = { horizontal: 'center' };
  ws.addRow([]);
  ws.columns = [{ key: 'stt', width: 6 }, { key: 'sp', width: 14 }, { key: 'ngay', width: 12 },
    { key: 'loai', width: 16 }, { key: 'nguon', width: 28 }, { key: 'hd', width: 14 },
    { key: 'sl', width: 10 }, { key: 'tien', width: 16 }, { key: 'tt', width: 14 }];
  const hdr = ws.addRow(['STT', 'Số phiếu', 'Ngày', 'Loại nhập', 'Nhà cung cấp / Lệnh SX', 'Số HĐ', 'SL', 'Tổng tiền', 'Trạng thái']);
  hdr.font = { bold: true };
  hdr.alignment = { horizontal: 'center', vertical: 'middle' };
  const d1 = hdr.number + 1;
  ds.forEach((r, i) => ws.addRow([i + 1, r.SoPhieu, r.NgayNhap ? new Date(r.NgayNhap) : null,
    r.LoaiNhap === 'SanXuat' ? 'Từ sản xuất' : 'Từ nhà cung cấp',
    r.LoaiNhap === 'SanXuat' ? (r.MaDH || '') : (r.TenNCC || ''),
    r.SoHoaDon || '', so(r.TongSLCai), so(r.TongTien), r.TrangThai]));
  const d2 = ws.rowCount;
  if (ds.length) {
    const cSL = ws.getColumn('sl').letter, cT = ws.getColumn('tien').letter;
    const t = ws.addRow(['', '', '', '', 'TỔNG CỘNG', '',
      { formula: `SUM(${cSL}${d1}:${cSL}${d2})` }, { formula: `SUM(${cT}${d1}:${cT}${d2})` }, '']);
    t.font = { bold: true };
  }
  ws.getColumn('ngay').numFmt = 'dd/mm/yyyy';
  ws.getColumn('sl').numFmt = '#,##0';
  ws.getColumn('tien').numFmt = '#,##0';
  keBang(ws, hdr.number, ws.rowCount, 1, 9);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="PhieuNhapKho_DanhSach.xlsx"');
  await wb.xlsx.write(res);
  res.end();
});

/* ---------- Excel: 1 PHIEU ---------- */
router.get('/phieu/:id/export', requireAuth, requirePermission('KHOHANG', 'view'), requireChucNang('KHOHANG', CN), async (req, res) => {
  const pool = await getPool();
  const { h, ct } = await docPhieu(pool, req.params.id);
  if (!h) return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu nhập kho.' });
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Phiếu nhập kho');
  ws.columns = [{ key: 'stt', width: 6 }, { key: 'ma', width: 16 }, { key: 'ten', width: 32 },
    { key: 'mau', width: 14 }, { key: 'sl', width: 10 }, { key: 'dv', width: 10 },
    { key: 'gia', width: 14 }, { key: 'tt', width: 16 }, { key: 'gc', width: 20 }];
  ws.mergeCells('A1:I1');
  ws.getCell('A1').value = 'PHIẾU NHẬP KHO HÀNG HÓA';
  ws.getCell('A1').font = { bold: true, size: 14 };
  ws.getCell('A1').alignment = { horizontal: 'center' };
  ws.mergeCells('A2:I2');
  ws.getCell('A2').value = `Số phiếu: ${h.SoPhieu}     Ngày: ${h.NgayNhap ? new Date(h.NgayNhap).toLocaleDateString('vi-VN') : ''}`;
  ws.getCell('A2').alignment = { horizontal: 'center' };
  ws.addRow([]);
  ws.addRow(['Loại nhập:', h.LoaiNhap === 'SanXuat' ? 'Từ sản xuất' : 'Từ nhà cung cấp']);
  ws.addRow([h.LoaiNhap === 'SanXuat' ? 'Lệnh sản xuất:' : 'Nhà cung cấp:', h.LoaiNhap === 'SanXuat' ? (h.MaDH || '') : (h.TenNCC || '')]);
  ws.addRow(['Số hóa đơn:', h.SoHoaDon || '']);
  ws.addRow(['Ghi chú:', h.GhiChu || '']);
  ws.addRow([]);
  const hdr = ws.addRow(['STT', 'Mã hàng', 'Tên hàng', 'Màu', 'Số lượng', 'ĐVT', 'Đơn giá', 'Thành tiền', 'Ghi chú']);
  hdr.font = { bold: true };
  hdr.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  const d1 = hdr.number + 1;
  ct.forEach((r, i) => ws.addRow([i + 1, r.MaHang, r.TenHang, r.TenMau || '', so(r.SoLuong),
    r.DonVi || '', so(r.DonGia), so(r.ThanhTien), r.GhiChu || '']));
  const d2 = ws.rowCount;
  if (ct.length) {
    const cT = ws.getColumn('tt').letter;
    const t = ws.addRow(['', '', '', '', '', '', 'TỔNG CỘNG', { formula: `SUM(${cT}${d1}:${cT}${d2})` }, '']);
    t.font = { bold: true };
  }
  ws.getColumn('sl').numFmt = '#,##0.##';
  ['gia', 'tt'].forEach(k => { ws.getColumn(k).numFmt = '#,##0'; });
  keBang(ws, hdr.number, ws.rowCount, 1, 9);
  const ten = [boDau(h.SoPhieu), boDau(h.LoaiNhap === 'SanXuat' ? h.MaDH : h.TenNCC)].filter(Boolean).join('_') || 'phieu';
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="PhieuNhapKho_${ten}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
});

/* ---------- CHI TIET ---------- */
async function docPhieu(pool, id) {
  const h = (await pool.request().input('id', sql.Int, id).query(`
    SELECT p.*, ncc.TenNCC, ncc.DiaChi AS DiaChiNCC, ncc.SDT AS SdtNCC, d.MaDH, d.TenSanPham, u.HoTen AS NguoiTao
    FROM PhieuNhapKhoHang p
    LEFT JOIN NhaCungCap ncc ON ncc.NCC_ID = p.NCC_ID
    LEFT JOIN DonHangSanXuat d ON d.DonHangID = p.DonHangID
    LEFT JOIN Users u ON u.UserID = p.NguoiTaoID
    WHERE p.PhieuNKID = @id`)).recordset[0];
  if (!h) return { h: null, ct: [] };
  /* v6.87: LEFT JOIN — dong "cho tao the kho" chua co MaHangID. Ma/ten/DVT lay tu cot *Cho.
     ⚠️ TRUOC LA INNER JOIN: doi sang LEFT la bat buoc, khong thi moi dong dang cho BIEN MAT khoi
     man xem phieu va khoi ban in — phieu in ra thieu hang ma khong ai biet. */
  const ct = (await pool.request().input('id', sql.Int, id).query(`
    SELECT ct.*,
           COALESCE(hh.MaHang,  ct.MaHangCho)       AS MaHang,
           COALESCE(hh.TenHang, ct.TenHangCho)      AS TenHang,
           COALESCE(hh.LoaiRi,  ct.LoaiRiCho)       AS LoaiRi,
           COALESCE(hh.DonViCoBan,  ct.DonViCoBanCho)  AS DonViCoBan,
           COALESCE(hh.DonViQuyDoi, ct.DonViQuyDoiCho) AS DonViQuyDoi,
           ms.TenMau,
           CAST(CASE WHEN ct.MaHangID IS NULL THEN 1 ELSE 0 END AS BIT) AS ChoTaoTheKho
    FROM PhieuNhapKhoHangChiTiet ct
    LEFT JOIN TheKhoHangHoa hh ON hh.MaHangID = ct.MaHangID
    LEFT JOIN MauSac ms ON ms.MauSacID = ct.MauSacID
    WHERE ct.PhieuNKID = @id ORDER BY ct.ID`)).recordset;
  return { h, ct };
}
router.get('/phieu/:id', requireAuth, requirePermission('KHOHANG', 'view'), requireChucNang('KHOHANG', CN), async (req, res) => {
  const pool = await getPool();
  const { h, ct } = await docPhieu(pool, req.params.id);
  if (!h) return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu nhập kho.' });
  res.json({ success: true, data: { header: h, chiTiet: ct } });
});

/* ================================================================================================
   TRA MA HANG + MAU KY THUAT CHO DONG HANG CUA PHIEU
   ⚠️ v6.87: KHONG con tao ma hang o day. Ma chua co trong danh muc thi dong do luu dang
   "cho tao the kho" (xem ghi chu dau file).
   ================================================================================================ */
function slugMa(s) {
  const d = new RegExp('[\\u0300-\\u036f]', 'g');
  return String(s || '').normalize('NFD').replace(d, '')
    .replace(new RegExp('đ', 'g'), 'd').replace(new RegExp('Đ', 'g'), 'D')
    .toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 30) || 'MAU';
}
/* v6.80: PHIEU NHAP KHO KHONG CHON MAU NUA (yeu cau nguoi dung).
   Nhung TheKhoChiTietMau bat buoc co MauSacID (khoa duy nhat la MaHangID + MauSacID), nen khong
   the de trong. Cach xu ly: dong nao khong khai mau thi don vao mot mau ky thuat dung chung
   "(Không phân màu)". Nho vay ton kho van co cho de cong, ma nguoi dung khong phai go gi.
   KHONG dung MauSacID = 0 hay NULL - se vo khoa ngoai va lam hong moi phep dem ton theo mau. */
const MAU_MAC_DINH = '(Không phân màu)';
async function timHoacTaoMau(pool, tran, d) {
  if (d.mauSacId) return Number(d.mauSacId);
  const ten = String(d.tenMau || '').trim() || MAU_MAC_DINH;
  const rq = () => (tran ? new sql.Request(tran) : pool.request());
  const co = (await rq().input('t', sql.NVarChar, ten).query('SELECT MauSacID FROM MauSac WHERE TenMau=@t')).recordset[0];
  if (co) return co.MauSacID;
  let base = slugMa(ten), ma = base, i = 1;
  while ((await rq().input('m', sql.NVarChar, ma).query('SELECT 1 AS x FROM MauSac WHERE MaMau=@m')).recordset[0]) {
    i++; ma = (base + i).slice(0, 30);
  }
  return (await rq().input('MaMau', sql.NVarChar, ma).input('TenMau', sql.NVarChar, ten)
    .query('INSERT INTO MauSac (MaMau, TenMau) OUTPUT INSERTED.MauSacID VALUES (@MaMau, @TenMau)')).recordset[0].MauSacID;
}
/* v6.87: CHI TRA, KHONG TAO. Tra ve ma hang thuc neu tim thay, nguoc lai tra ve null - dong do se
   duoc luu dang "cho tao the kho".
   ⚠️ KHONG them lai duong tao ma hang o day. Chuc nang tao ma hang/the kho nam duy nhat o
   POST /api/khohang/items (tab The kho hang hoa). Hai duong tao ma song song la cach chac chan nhat
   de danh muc lech nhau. */
async function doMaHang(pool, tran, d) {
  const rq = () => (tran ? new sql.Request(tran) : pool.request());
  if (d.maHangId) {
    const h = (await rq().input('id', sql.Int, d.maHangId)
      .query('SELECT MaHangID, MaHang, LoaiRi, DonViCoBan, DonViQuyDoi FROM TheKhoHangHoa WHERE MaHangID=@id')).recordset[0];
    if (h) return h;
  }
  const ma = String(d.maHang || '').trim().toUpperCase();
  if (!ma) throw new Error('Dòng hàng chưa có mã hàng.');
  const co = (await rq().input('m', sql.NVarChar, ma)
    .query('SELECT MaHangID, MaHang, LoaiRi, DonViCoBan, DonViQuyDoi FROM TheKhoHangHoa WHERE MaHang=@m')).recordset[0];
  return co || null;
}

/* Chuan hoa 1 dong hang cua phieu -> ban ghi san sang INSERT.
   Hai nhanh: DA CO ma hang (cong ton luon) va CHUA CO (cho tao the kho). */
async function chuanDong(pool, tran, d, loai) {
  const mh = await doMaHang(pool, tran, d);
  const donGia = loai === 'NhaCungCap' ? so(d.donGia) : 0;
  const chung = {
    soLuong: so(d.soLuong), donGia, thanhTien: tien(donGia * so(d.soLuong)),
    ghiChu: d.ghiChu || null
  };

  if (!mh) {
    // CHUA CO trong danh muc -> luu cho, khong cong ton, khong tao gi.
    const ma = String(d.maHang || '').trim().toUpperCase();
    if (!String(d.tenHang || '').trim()) {
      throw new Error(`Mã "${ma}" chưa có trong danh mục — phải khai Tên hàng để sau này tạo thẻ kho.`);
    }
    return Object.assign(chung, {
      maHangId: null, maHang: ma, mauSacId: null, donVi: d.donVi || 'Cái',
      slChinh: 0, soCai: 0, cho: true,
      maHangCho: ma, tenHangCho: String(d.tenHang).trim(),
      loaiRiCho: Math.max(1, parseInt(d.loaiRi, 10) || 1),
      donViCoBanCho: d.donViCoBan || null, donViQuyDoiCho: d.donViQuyDoi || null
    });
  }

  const msId = await timHoacTaoMau(pool, tran, d);
  const donVi = d.donVi || mh.DonViCoBan || 'Cái';
  const slChinh = veDonViChinh(d.soLuong, donVi, mh);
  if (slChinh <= 0) throw new Error(`Dòng ${mh.MaHang}: số lượng quy về đơn vị chính (${mh.DonViCoBan || 'Cái'}) = 0.`);
  /* Ma quan kho theo Ri chi nhap duoc boi so cua he so - giong luc ban (banhang.js). Khong chan
     thi 7 Cai cua ma Ri6 se lam tron thanh 1 Ri = mat 1 cai, sai am tham. */
  const he = so(mh.LoaiRi) || 1;
  const soCai = slSangCai(d.soLuong, donVi, mh.LoaiRi, mh);
  if (donViChinhLaGop(mh) && he > 1 && soCai % he !== 0) {
    throw new Error(`Mã ${mh.MaHang} quản kho theo Ri (1 Ri = ${he} Cái) nên chỉ nhập được bội số của ${he} Cái — đang nhập ${soCai} Cái.`);
  }
  return Object.assign(chung, {
    maHangId: mh.MaHangID, maHang: mh.MaHang, mauSacId: msId, donVi, slChinh, soCai, cho: false,
    maHangCho: null, tenHangCho: null, loaiRiCho: null, donViCoBanCho: null, donViQuyDoiCho: null
  });
}

/* INSERT mot dong + cong ton NEU dong do da co ma hang. Dung CHUNG cho POST va PUT — hai ban sao
   khac nhau la duong chac chan de ton kho lech (da tung xay ra o repo nay). */
async function ghiDong(pool, tran, phieuId, d) {
  await new sql.Request(tran)
    .input('P', sql.Int, phieuId).input('MH', sql.Int, d.maHangId).input('MS', sql.Int, d.mauSacId)
    .input('SL', sql.Decimal(14, 2), d.soLuong).input('DV', sql.NVarChar, d.donVi)
    .input('SLC', sql.Int, d.slChinh).input('DG', sql.Decimal(14, 2), d.donGia || null)
    .input('TT', sql.Decimal(18, 2), d.thanhTien).input('GC', sql.NVarChar, d.ghiChu)
    .input('MHC', sql.NVarChar, d.maHangCho).input('THC', sql.NVarChar, d.tenHangCho)
    .input('LRC', sql.Int, d.loaiRiCho).input('DVC', sql.NVarChar, d.donViCoBanCho)
    .input('DVQ', sql.NVarChar, d.donViQuyDoiCho)
    .query(`INSERT INTO PhieuNhapKhoHangChiTiet (PhieuNKID, MaHangID, MauSacID, SoLuong, DonVi,
              SoLuongChinh, DonGia, ThanhTien, GhiChu,
              MaHangCho, TenHangCho, LoaiRiCho, DonViCoBanCho, DonViQuyDoiCho)
            VALUES (@P, @MH, @MS, @SL, @DV, @SLC, @DG, @TT, @GC,
              @MHC, @THC, @LRC, @DVC, @DVQ)`);
  if (!d.cho) await ghiNhapKho(pool, tran, d.maHangId, d.mauSacId, d.slChinh, d.maHang);
}

/* ================================================================================================
   LUU PHIEU
   ================================================================================================ */
router.post('/phieu', requireAuth, requirePermission('KHOHANG', 'create'), requireChucNang('KHOHANG', CN), async (req, res) => {
  const pool = await getPool();
  const b = req.body || {};
  const loai = b.loaiNhap === 'SanXuat' ? 'SanXuat' : 'NhaCungCap';
  const dong = Array.isArray(b.dong) ? b.dong.filter(d => d && so(d.soLuong) > 0) : [];
  if (!dong.length) return res.status(400).json({ success: false, message: 'Phiếu chưa có dòng hàng nào có số lượng > 0.' });
  if (loai === 'NhaCungCap' && !b.nccId) {
    return res.status(400).json({ success: false, message: 'Nhập từ nhà cung cấp thì phải chọn nhà cung cấp — số tiền này sẽ vào công nợ phải trả.' });
  }

  const tran = new sql.Transaction(pool);
  await tran.begin();
  try {
    const soPhieu = await sinhSoPhieu(new sql.Request(tran), 'PhieuNhapKhoHang', 'SoPhieu', 'NK', null, 4);

    // Chuan hoa tung dong TRUOC khi ghi dau phieu, de con tinh duoc tong
    const dsGhi = [];
    for (const d of dong) dsGhi.push(await chuanDong(pool, tran, d, loai));

    const tongSLCai = dsGhi.reduce((s, d) => s + d.soCai, 0);
    const tongTien = tien(dsGhi.reduce((s, d) => s + d.thanhTien, 0));

    const phieuId = (await new sql.Request(tran)
      .input('SoPhieu', sql.NVarChar, soPhieu)
      .input('NgayNhap', sql.Date, b.ngayNhap || new Date())
      .input('LoaiNhap', sql.NVarChar, loai)
      .input('NCC_ID', sql.Int, loai === 'NhaCungCap' ? (b.nccId || null) : null)
      .input('DonHangID', sql.Int, loai === 'SanXuat' ? (b.donHangId || null) : null)
      .input('SoHoaDon', sql.NVarChar, b.soHoaDon || null)
      .input('NgayHoaDon', sql.Date, b.ngayHoaDon || null)
      .input('TongSLCai', sql.Int, tongSLCai)
      .input('TongTien', sql.Decimal(18, 2), tongTien)
      .input('GhiChu', sql.NVarChar, b.ghiChu || null)
      .input('NguoiTaoID', sql.Int, req.session.user.userId)
      .query(`INSERT INTO PhieuNhapKhoHang (SoPhieu, NgayNhap, LoaiNhap, NCC_ID, DonHangID, SoHoaDon,
                NgayHoaDon, TongSLCai, TongTien, GhiChu, NguoiTaoID)
              OUTPUT INSERTED.PhieuNKID
              VALUES (@SoPhieu, @NgayNhap, @LoaiNhap, @NCC_ID, @DonHangID, @SoHoaDon,
                @NgayHoaDon, @TongSLCai, @TongTien, @GhiChu, @NguoiTaoID)`)).recordset[0].PhieuNKID;

    for (const d of dsGhi) await ghiDong(pool, tran, phieuId, d);

    await tran.commit();
    const maCho = dsGhi.filter(d => d.cho).map(d => d.maHang);
    res.json({
      success: true,
      data: { phieuNKID: phieuId, soPhieu, tongTien, maCho },
      message: `Đã lưu phiếu ${soPhieu}.` + (maCho.length
        ? ` ${maCho.length} mã chưa có trong danh mục (${maCho.join(', ')}) — bấm "Tạo thẻ kho" để tạo, tồn kho sẽ cộng lúc đó.`
        : '')
    });
  } catch (err) {
    try { await tran.rollback(); } catch (e) { /* transaction co the da ket thuc */ }
    console.error('[nhapkho POST /phieu] ', err);
    res.status(400).json({ success: false, message: 'Lỗi khi lưu phiếu nhập kho (đã quay lui, dữ liệu giữ nguyên): ' + err.message });
  }
});

/* ================================================================================================
   SUA PHIEU - GO phieu cu (tru lai ton) roi GHI LAI theo du lieu moi, TAT CA trong 1 transaction.
   Giu nguyen SoPhieu va PhieuNKID. Cung cach lam voi phieu ban hang (banhang.js PUT /phieu/:id) —
   hai duong "sua" ma lam khac nhau thi som muon ton kho se lech.
   ================================================================================================ */
router.put('/phieu/:id', requireAuth, requirePermission('KHOHANG', 'edit'), requireChucNang('KHOHANG', CN), async (req, res) => {
  const pool = await getPool();
  const b = req.body || {};
  const cu = (await pool.request().input('id', sql.Int, req.params.id)
    .query('SELECT * FROM PhieuNhapKhoHang WHERE PhieuNKID=@id')).recordset[0];
  if (!cu) return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu nhập kho.' });
  if (cu.TrangThai === 'Đã hủy') return res.status(400).json({ success: false, message: 'Phiếu đã hủy — không sửa được. Hãy lập phiếu mới.' });

  const loai = b.loaiNhap === 'SanXuat' ? 'SanXuat' : 'NhaCungCap';
  const dong = Array.isArray(b.dong) ? b.dong.filter(d => d && so(d.soLuong) > 0) : [];
  if (!dong.length) return res.status(400).json({ success: false, message: 'Phiếu chưa có dòng hàng nào có số lượng > 0.' });
  if (loai === 'NhaCungCap' && !b.nccId) {
    return res.status(400).json({ success: false, message: 'Nhập từ nhà cung cấp thì phải chọn nhà cung cấp.' });
  }

  const tran = new sql.Transaction(pool);
  await tran.begin();
  try {
    // 1. GO: tru lai ton cua ban cu roi xoa dong cu
    await truLaiTon(pool, tran, req.params.id);
    await new sql.Request(tran).input('id', sql.Int, req.params.id)
      .query('DELETE FROM PhieuNhapKhoHangChiTiet WHERE PhieuNKID=@id');

    // 2. GHI LAI theo du lieu moi
    const dsGhi = [];
    for (const d of dong) dsGhi.push(await chuanDong(pool, tran, d, loai));
    for (const d of dsGhi) await ghiDong(pool, tran, req.params.id, d);

    await new sql.Request(tran)
      .input('id', sql.Int, req.params.id)
      .input('NgayNhap', sql.Date, b.ngayNhap || cu.NgayNhap)
      .input('LoaiNhap', sql.NVarChar, loai)
      .input('NCC_ID', sql.Int, loai === 'NhaCungCap' ? (b.nccId || null) : null)
      .input('DonHangID', sql.Int, loai === 'SanXuat' ? (b.donHangId || null) : null)
      .input('SoHoaDon', sql.NVarChar, b.soHoaDon || null)
      .input('NgayHoaDon', sql.Date, b.ngayHoaDon || null)
      .input('TongSLCai', sql.Int, dsGhi.reduce((s2, d) => s2 + d.soCai, 0))
      .input('TongTien', sql.Decimal(18, 2), tien(dsGhi.reduce((s2, d) => s2 + d.thanhTien, 0)))
      .input('GhiChu', sql.NVarChar, b.ghiChu || null)
      .query(`UPDATE PhieuNhapKhoHang SET NgayNhap=@NgayNhap, LoaiNhap=@LoaiNhap, NCC_ID=@NCC_ID,
                DonHangID=@DonHangID, SoHoaDon=@SoHoaDon, NgayHoaDon=@NgayHoaDon,
                TongSLCai=@TongSLCai, TongTien=@TongTien, GhiChu=@GhiChu
              WHERE PhieuNKID=@id`);
    await tran.commit();
    const maCho2 = dsGhi.filter(d => d.cho).map(d => d.maHang);
    res.json({
      success: true,
      message: 'Đã lưu thay đổi và tính lại tồn kho.' + (maCho2.length
        ? ` ${maCho2.length} mã chưa có trong danh mục (${maCho2.join(', ')}) — bấm "Tạo thẻ kho" để tạo.` : '')
    });
  } catch (err) {
    try { await tran.rollback(); } catch (e) { /* da ket thuc */ }
    console.error('[nhapkho PUT /phieu/:id] ', err);
    res.status(400).json({ success: false, message: 'Lỗi khi sửa phiếu (đã quay lui, dữ liệu giữ nguyên): ' + err.message });
  }
});

/* ---------- HUY / XOA: tru lai ton da nhap ---------- */
async function truLaiTon(pool, tran, id) {
  /* v6.87: CHI tru nhung dong DA co ma hang. Dong "cho tao the kho" chua bao gio cong ton nen khong
     co gi de tru — INNER JOIN o day chinh la cai loc chung ra, nhung viet ro dieu kien IS NOT NULL
     de nguoi doc sau khong phai suy luan. */
  const ct = (await new sql.Request(tran).input('id', sql.Int, id).query(`
    SELECT ct.MaHangID, ct.MauSacID, ct.SoLuongChinh, h.MaHang
    FROM PhieuNhapKhoHangChiTiet ct JOIN TheKhoHangHoa h ON h.MaHangID = ct.MaHangID
    WHERE ct.PhieuNKID = @id AND ct.MaHangID IS NOT NULL AND ct.MauSacID IS NOT NULL`)).recordset;
  for (const d of ct) {
    if (so(d.SoLuongChinh) > 0) await ghiNhapKho(pool, tran, d.MaHangID, d.MauSacID, -so(d.SoLuongChinh), d.MaHang);
  }
}

router.put('/phieu/:id/huy', requireAuth, requirePermission('KHOHANG', 'edit'), requireChucNang('KHOHANG', CN), async (req, res) => {
  const pool = await getPool();
  const h = (await pool.request().input('id', sql.Int, req.params.id)
    .query('SELECT TrangThai FROM PhieuNhapKhoHang WHERE PhieuNKID=@id')).recordset[0];
  if (!h) return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu nhập kho.' });
  if (h.TrangThai === 'Đã hủy') return res.status(400).json({ success: false, message: 'Phiếu này đã hủy rồi.' });
  const tran = new sql.Transaction(pool);
  await tran.begin();
  try {
    await truLaiTon(pool, tran, req.params.id);
    await new sql.Request(tran).input('id', sql.Int, req.params.id)
      .query(`UPDATE PhieuNhapKhoHang SET TrangThai = N'Đã hủy' WHERE PhieuNKID=@id`);
    await tran.commit();
    res.json({ success: true, message: 'Đã hủy phiếu — tồn kho và công nợ trả về như trước.' });
  } catch (err) {
    try { await tran.rollback(); } catch (e) { /* da ket thuc */ }
    res.status(400).json({ success: false, message: 'Lỗi khi hủy phiếu (đã quay lui): ' + err.message });
  }
});

router.delete('/phieu/:id', requireAuth, requirePermission('KHOHANG', 'delete'), requireChucNang('KHOHANG', CN), async (req, res) => {
  const pool = await getPool();
  const h = (await pool.request().input('id', sql.Int, req.params.id)
    .query('SELECT TrangThai FROM PhieuNhapKhoHang WHERE PhieuNKID=@id')).recordset[0];
  if (!h) return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu nhập kho.' });
  const tran = new sql.Transaction(pool);
  await tran.begin();
  try {
    // Phieu da huy thi ton da tru roi - tru them lan nua se am kho.
    if (h.TrangThai !== 'Đã hủy') await truLaiTon(pool, tran, req.params.id);
    await new sql.Request(tran).input('id', sql.Int, req.params.id)
      .query('DELETE FROM PhieuNhapKhoHang WHERE PhieuNKID=@id');   // chi tiet xoa theo CASCADE
    await tran.commit();
    res.json({ success: true, message: 'Đã xóa phiếu nhập kho.' });
  } catch (err) {
    try { await tran.rollback(); } catch (e) { /* da ket thuc */ }
    res.status(400).json({ success: false, message: 'Lỗi khi xóa phiếu (đã quay lui): ' + err.message });
  }
});

/* ================================================================================================
   v6.87: GAN MA HANG VUA TAO VAO CAC DONG DANG CHO — VA CONG TON O DUNG THOI DIEM NAY.

   Goi TU DONG ngay sau khi nguoi dung tao thanh cong mot the kho moi (frontend module.khohang.js,
   #iForm submit, nhanh !isEdit). Khong can truyen PhieuNKID: quet TOAN BO cac dong dang cho mang
   dung ma nay, o moi phieu. Nho vay ke ca khi nguoi dung tao the kho bang tay tu tab The kho (khong
   di qua nut "Tao the kho" cua phieu) thi cac phieu nhap dang cho van tu dong duoc hoan tat.

   BO QUA phieu DA HUY: phieu huy thi khong con hieu luc, cong ton cho no la tao ton kho tu khong khi.

   IDEMPOTENT: sau khi gan, MaHangID khong con NULL nen lan goi thu hai khong tim thay dong nao ->
   khong cong ton lan hai. Day la ly do dieu kien loc phai la `MaHangID IS NULL`, khong phai
   `MaHangCho = @ma` mot minh.
   ================================================================================================ */
router.post('/gan-mahang', requireAuth, requirePermission('KHOHANG', 'create'), async (req, res) => {
  const pool = await getPool();
  const ma = String((req.body || {}).maHang || '').trim().toUpperCase();
  if (!ma) return res.status(400).json({ success: false, message: 'Thiếu mã hàng.' });

  const mh = (await pool.request().input('m', sql.NVarChar, ma).query(`
    SELECT MaHangID, MaHang, LoaiRi, DonViCoBan, DonViQuyDoi FROM TheKhoHangHoa WHERE MaHang=@m`)).recordset[0];
  if (!mh) return res.status(404).json({ success: false, message: `Mã hàng "${ma}" chưa có trong danh mục.` });

  const cho = (await pool.request().input('m', sql.NVarChar, ma).query(`
    SELECT ct.ID, ct.PhieuNKID, ct.SoLuong, ct.DonVi, p.SoPhieu
    FROM PhieuNhapKhoHangChiTiet ct
    JOIN PhieuNhapKhoHang p ON p.PhieuNKID = ct.PhieuNKID
    WHERE ct.MaHangID IS NULL AND UPPER(LTRIM(RTRIM(ct.MaHangCho))) = @m
      AND p.TrangThai <> N'Đã hủy'
    ORDER BY ct.ID`)).recordset;
  if (!cho.length) return res.json({ success: true, data: { soDong: 0, phieu: [] }, message: '' });

  const tran = new sql.Transaction(pool);
  await tran.begin();
  try {
    const msId = await timHoacTaoMau(pool, tran, {});   // dong nhap kho khong phan mau -> mau ky thuat
    for (const d of cho) {
      const donVi = d.DonVi || mh.DonViCoBan || 'Cái';
      const slChinh = veDonViChinh(d.SoLuong, donVi, mh);
      if (slChinh <= 0) {
        throw new Error(`Phiếu ${d.SoPhieu}: ${so(d.SoLuong)} ${donVi} của mã ${ma} quy về ${mh.DonViCoBan || 'Cái'} = 0. Sửa lại tỷ lệ quy đổi của thẻ kho hoặc sửa dòng trên phiếu.`);
      }
      const soCai = slSangCai(d.SoLuong, donVi, mh.LoaiRi, mh);
      /* ⚠️ Kiem tra boi so Y NHU luc luu phieu (chuanDong). Luc lap phieu chua co ma hang nen chua
         biet ty le quy doi -> khong the kiem tra; day la lan DAU TIEN kiem duoc. Thieu cho nay thi
         the kho khai "1 Ri = 6 Cai" ma phieu ghi 7 Cai se lam tron thanh 1 Ri = MAT 1 Cai am tham. */
      const he = so(mh.LoaiRi) || 1;
      if (donViChinhLaGop(mh) && he > 1 && soCai % he !== 0) {
        throw new Error(`Phiếu ${d.SoPhieu}: thẻ kho khai 1 ${mh.DonViQuyDoi || 'Ri'} = ${he} ${'Cái'}, nhưng phiếu ghi ${soCai} Cái — không chia hết. Sửa tỷ lệ quy đổi ở thẻ kho hoặc sửa số lượng trên phiếu.`);
      }
      await new sql.Request(tran)
        .input('id', sql.Int, d.ID).input('MH', sql.Int, mh.MaHangID)
        .input('MS', sql.Int, msId).input('SLC', sql.Int, slChinh)
        .query(`UPDATE PhieuNhapKhoHangChiTiet SET MaHangID=@MH, MauSacID=@MS, SoLuongChinh=@SLC
                WHERE ID=@id AND MaHangID IS NULL`);
      await ghiNhapKho(pool, tran, mh.MaHangID, msId, slChinh, ma);
      d.soCai = soCai;
    }
    /* TongSLCai (theo CAI) cua dau phieu luc luu bo qua dong dang cho — chua co ma hang thi chua biet
       ty le quy doi. Nay bu them dung phan vua gan.
       ⚠️ CONG DON chu KHONG tinh lai tu dau: tinh lai doi hoi quy doi lai TUNG dong theo LoaiRi cua
       tung ma hang, viet bang SQL thuan se sai ngay khi cac ma co ty le khac nhau. */
    const buTheoPhieu = new Map();
    cho.forEach(d => buTheoPhieu.set(d.PhieuNKID, (buTheoPhieu.get(d.PhieuNKID) || 0) + (d.soCai || 0)));
    for (const [pid, bu] of buTheoPhieu) {
      await new sql.Request(tran).input('id', sql.Int, pid).input('bu', sql.Int, bu)
        .query('UPDATE PhieuNhapKhoHang SET TongSLCai = ISNULL(TongSLCai, 0) + @bu WHERE PhieuNKID=@id');
    }
    await tran.commit();
    const dsSo = [...new Set(cho.map(d => d.SoPhieu))];
    res.json({
      success: true,
      data: { soDong: cho.length, phieu: dsSo },
      message: `Đã cộng tồn cho ${cho.length} dòng của phiếu nhập ${dsSo.join(', ')}.`
    });
  } catch (err) {
    try { await tran.rollback(); } catch (e) { /* da ket thuc */ }
    console.error('[nhapkho POST /gan-mahang] ', err);
    res.status(400).json({ success: false, message: 'Đã tạo thẻ kho nhưng CHƯA cộng được tồn từ phiếu nhập (đã quay lui): ' + err.message });
  }
});

module.exports = router;
