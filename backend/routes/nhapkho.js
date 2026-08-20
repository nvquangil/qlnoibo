/* ================================================================================================
   PHIEU NHAP KHO HANG HOA  (v6.89)  - module KHOHANG, chuc nang 'nhapkho', migration_v681 + v682.

   HAI LOAI NHAP:
     - NhaCungCap : hang mua ngoai, CO don gia -> TANG CONG NO PHAI TRA cho NCC.
     - SanXuat    : hang xuong minh lam ra, gan LENH SX, KHONG sinh cong no.

   LUU PHIEU LAM DUNG 3 VIEC — khong hon:
     1. Tao MA HANG trong danh muc neu chua co (de xuat/ban duoc ngay).
     2. Cong CONG NO phai tra NCC (chi loai NhaCungCap).
     3. Len BAO CAO TON KHO hang hoa.
   Phieu KHONG ghi vao o "Nhap" cua the kho. THE KHO chi duoc tao khi nguoi dung bam "Tao the kho".

   TON KHO co HAI NGUON RỜI NHAU (migration_v682, view vw_TonTheoMau):
     Nguon 1 - THE KHO  : TheKhoChiTietMau.NhapCai (khai tay o the kho / QLSX cong doan KN)
     Nguon 2 - CHUNG TU : PhieuNhapKhoHangChiTiet.SoLuongChinh cua phieu chua huy  <- file nay
   TON = Nguon1 + Nguon2 - XuatCai. Hai nguon khong the dem hai lan vi phieu KHONG ghi vao NhapCai.

   MA HANG CHUA CO -> SINH MA LUON, nhung PHAI khai du Ten hang + 2 DVT + ty le quy doi. Ban v6.78
   mac dinh ngam 'Cái'/'Ri'/1 — ma quan kho theo Ri ma bi gan LoaiRi=1 thi moi phep quy doi ton ve
   sau sai gap LoaiRi lan va khong co gi bao loi.

   ⚠️ Lich su de khong lap lai: v6.78-v6.86 phieu vua sinh ma vua ghi NhapCai, con nut "Tao the kho"
   lai mo form TAO MOI ⇒ luon bao "ma da ton tai". v6.87 thu bo han viec sinh ma ⇒ khong xuat duoc
   hang. v6.89 tach dung ranh: phieu lo ma hang + cong no + ton; the kho lo mau/anh/gia ban.
   ================================================================================================ */
const express = require('express');
const ExcelJS = require('exceljs');
const { sql, getPool } = require('../db');
const { requireAuth, requirePermission, requireChucNang } = require('../middleware/auth');
const { so, tien, laDonViGop, donViChinhLaGop, slSangCai, sinhSoPhieu } = require('../utils/banHangCommon');
const { noiDangDungMaHang } = require('../utils/maHangThamChieu');
const { damBaoDongMau, capNhatAnhDaiDien } = require('../utils/theKhoMau');

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

/* ================================================================================================
   ⚠️ v6.89 — PHAN HE NAY KHONG CON GHI VAO TheKhoChiTietMau.NhapCai.

   Ham ghiNhapKho() da bi GO BO. Ton kho hang hoa nay co HAI NGUON RỜI NHAU (migration_v682):
     Nguon 1 - THE KHO  : TheKhoChiTietMau.NhapCai  (nguoi dung khai tay o the kho, hoac QLSX cong doan KN)
     Nguon 2 - CHUNG TU : PhieuNhapKhoHangChiTiet.SoLuongChinh cua phieu CHUA HUY  <- chinh la file nay
   View vw_TonTheoMau / vw_TonKhoHangHoa cong hai nguon lai. Vi phieu nhap KHONG BAO GIO ghi vao
   NhapCai, hai nguon khong the dem hai lan — bat bien nay do CAU TRUC bao dam, khong phai do co/flag.

   HE QUA phai nho:
     - Huy / xoa / sua phieu thi ton TU DONG dung theo, KHONG con phai tru NhapCai bang tay.
     - Cung vi the KHONG con the "chan huy phieu khi hang da ban het": truoc day phep tru NhapCai
       lam viec do. Nay huy phieu co the lam ton am — dung utils/kiem_ton_am.js de soi.
   ⚠️ KHONG them lai duong ghi NhapCai o day. Them lai la dem hai lan ngay lap tuc.
   ================================================================================================ */

/* ================================================================================================
   DANH MUC PHUC VU FORM
   ================================================================================================ */
router.get('/danhmuc', requireAuth, requirePermission('KHOHANG', 'view'), requireChucNang('KHOHANG', CN), async (req, res) => {
  const pool = await getPool();
  const q = (t) => pool.request().query(t).then(r => r.recordset);
  const [ncc, donHang, theKho, nhom, mauSac, donVi] = await Promise.all([
    q('SELECT NCC_ID, TenNCC FROM NhaCungCap ORDER BY TenNCC'),
    /* v6.80: CHI lay lenh SX DA HOAN THANH. Lenh dang san xuat ma cho nhap kho thanh pham thi so
       "da hoan thanh" cua lenh do va ton kho se lech nhau, khong ai doi chieu duoc.
       v6.89: BO cac lenh DA GAN vao mot phieu nhap khac (phieu chua huy) — mot lenh SX chi nhap kho
       mot lan, de lai trong danh sach la mo duong nhap trung ca lenh.
       ⚠️ Phai GIU LAI lenh cua CHINH phieu dang sua (?phieuNKID=), khong thi mo form Sua se thay o
       lenh SX rong roi bam Luu la mat lien ket - dung kieu loi am tham. */
    q(`SELECT TOP 300 d.DonHangID, d.MaDH, d.TenSanPham FROM DonHangSanXuat d
       WHERE d.TrangThai = N'Hoàn thành'
         AND NOT EXISTS (SELECT 1 FROM PhieuNhapKhoHang p
                         WHERE p.DonHangID = d.DonHangID
                           AND p.TrangThai <> N'Đã hủy'
                           AND (${req.query.phieuNKID ? 'p.PhieuNKID <> ' + (parseInt(req.query.phieuNKID, 10) || 0) : '1=1'}))
       ORDER BY d.DonHangID DESC`),
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
           (SELECT COUNT(*) FROM PhieuNhapKhoHangChiTiet ct WHERE ct.PhieuNKID = p.PhieuNKID) AS SoDong
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
  /* LEFT JOIN chu khong INNER: neu vi ly do nao do ma hang bi xoa khoi danh muc thi dong phieu van
     phai hien ra (voi ma trong) chu khong duoc BIEN MAT khoi man xem va ban in — phieu in thieu hang
     ma khong ai biet la kieu loi te nhat. */
  const ct = (await pool.request().input('id', sql.Int, id).query(`
    SELECT ct.*, hh.MaHang, hh.TenHang, hh.LoaiRi, hh.DonViCoBan, hh.DonViQuyDoi, ms.TenMau
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
/* ================================================================================================
   TIM MA HANG, CHUA CO THI TAO LUON (v6.88).

   ⚠️ v6.87 da thu bo duong tao ma o day (de dong "cho tao the kho") — SAI YEU CAU: hang nhap ve la
   phai xuat/ban duoc NGAY, ma phieu xuat/ban hang chi chon duoc ma DA CO trong danh muc. Bat nguoi
   dung tao the kho truoc moi xuat duoc la chan luong nghiep vu that.
   => Giu nguyen: nhap kho ma chua co ma thi SINH MA LUON.

   Cai thuc su sai o v6.78-v6.86 khong phai cho nay, ma la nut "Tao the kho" o phieu nhap: no mo form
   TAO MOI trong khi ma da duoc sinh ra ⇒ luon bao "ma da ton tai". Da sua o frontend (mo form SUA).

   KHAC v6.78 mot diem QUAN TRONG: ĐVT + ty le quy doi khong con mac dinh ngam 'Cái'/'Ri'/1.
   Ma quan kho theo Ri ma bi gan LoaiRi = 1 thi MOI phep quy doi ton kho ve sau deu sai gap LoaiRi
   lan, va khong co gi bao loi. Nay bat khai ro tren dong phieu.
   ================================================================================================ */
async function timHoacTaoMaHang(pool, tran, d) {
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
  if (co) return co;

  // ---- Ma moi: bat khai du thong tin TOI THIEU de ton kho quy doi dung ----
  const tenHang = String(d.tenHang || '').trim();
  if (!tenHang) throw new Error(`Mã mới "${ma}" phải có Tên hàng.`);
  const dvChinh = String(d.donViCoBan || '').trim();
  const dvQuyDoi = String(d.donViQuyDoi || '').trim();
  if (!dvChinh || !dvQuyDoi) {
    throw new Error(`Mã mới "${ma}" phải khai ĐVT chính và ĐVT quy đổi — thiếu thì tồn kho không quy đổi được.`);
  }
  const heSo = parseInt(d.loaiRi, 10);
  if (!(heSo >= 1)) {
    throw new Error(`Mã mới "${ma}" phải khai tỷ lệ quy đổi (1 ${dvQuyDoi} = ? ${dvChinh}).`);
  }
  const id = (await rq()
    .input('MaHang', sql.NVarChar, ma)
    .input('TenHang', sql.NVarChar, tenHang)
    .input('GiaBan', sql.Decimal(14, 2), so(d.giaBan) || 0)
    .input('LoaiRi', sql.Int, heSo)
    .input('TheKhoDanhMucID', sql.Int, d.theKhoDanhMucId || null)
    .input('NhomSanPhamID', sql.Int, d.nhomSanPhamId || null)
    .input('DonViCoBan', sql.NVarChar, dvChinh)
    .input('DonViQuyDoi', sql.NVarChar, dvQuyDoi)
    .input('LoaiHang', sql.NVarChar, d.loaiHang === 'NhaSanXuat' ? 'NhaSanXuat' : 'DatNgoai')
    .query(`INSERT INTO TheKhoHangHoa (MaHang, TenHang, GiaBan, LoaiRi, TheKhoDanhMucID, NhomSanPhamID,
              DonViCoBan, DonViQuyDoi, LoaiHang)
            OUTPUT INSERTED.MaHangID
            VALUES (@MaHang, @TenHang, @GiaBan, @LoaiRi, @TheKhoDanhMucID, @NhomSanPhamID,
              @DonViCoBan, @DonViQuyDoi, @LoaiHang)`)).recordset[0].MaHangID;
  return { MaHangID: id, MaHang: ma, LoaiRi: heSo, DonViCoBan: dvChinh, DonViQuyDoi: dvQuyDoi, laMoi: true };
}

/* Chuan hoa 1 dong hang cua phieu -> ban ghi san sang INSERT. */
async function chuanDong(pool, tran, d, loai) {
  const mh = await timHoacTaoMaHang(pool, tran, d);
  const donGia = loai === 'NhaCungCap' ? so(d.donGia) : 0;
  const chung = {
    soLuong: so(d.soLuong), donGia, thanhTien: tien(donGia * so(d.soLuong)),
    ghiChu: d.ghiChu || null, laMaMoi: !!mh.laMoi
  };

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
    maHangId: mh.MaHangID, maHang: mh.MaHang, mauSacId: msId, donVi, slChinh, soCai,
    // v6.96: anh di kem de tao luon the kho (neu phieu tich "Tao the kho")
    anhMau: d.anhMau || null, anhDaiDien: d.anhDaiDien || null
  });
}

/* ================================================================================================
   v6.96 — LUU PHIEU LA TAO LUON THE KHO (khi nguoi dung tich chon).

   Phieu nhap kho da khai du mo(i thu the kho can biet ve MAU: ma hang + mau + anh mau + anh dai dien.
   Bat nguoi dung bam thêm "Tao the kho" roi khai lai mau la lam hai lan cung mot viec.

   ⚠️ CHI tao dong mau + ghi anh. KHONG ghi so luong vao NhapCai — ton den tu chinh bang phieu
   (vw_TonTheoMau). Ghi vao NhapCai la dem hai lan. Xem utils/theKhoMau.js.
   ================================================================================================ */
async function taoTheKhoTuDong(pool, tran, dsGhi) {
  let soMau = 0, soAnh = 0;
  const daAnhDaiDien = new Set();
  for (const d of dsGhi) {
    if (!d.maHangId || !d.mauSacId) continue;
    if (await damBaoDongMau(pool, tran, d.maHangId, d.mauSacId, d.anhMau, null)) soMau++;
    // Anh dai dien la cua MA HANG: mot ma xuat hien nhieu dong (nhieu mau) thi chi ghi mot lan.
    if (d.anhDaiDien && !daAnhDaiDien.has(d.maHangId)) {
      daAnhDaiDien.add(d.maHangId);
      if (await capNhatAnhDaiDien(pool, tran, d.maHangId, d.anhDaiDien)) soAnh++;
    }
  }
  return { soMau, soAnh };
}

/* INSERT mot dong + cong ton. Dung CHUNG cho POST va PUT — hai ban sao khac nhau la duong chac chan
   de ton kho lech (da tung xay ra o repo nay).
   v6.89: CHI insert dong phieu. Ton kho khong ghi o day nua — view doc thang tu bang nay. */
async function ghiDong(pool, tran, phieuId, d) {
  await new sql.Request(tran)
    .input('P', sql.Int, phieuId).input('MH', sql.Int, d.maHangId).input('MS', sql.Int, d.mauSacId)
    .input('SL', sql.Decimal(14, 2), d.soLuong).input('DV', sql.NVarChar, d.donVi)
    .input('SLC', sql.Int, d.slChinh).input('DG', sql.Decimal(14, 2), d.donGia || null)
    .input('TT', sql.Decimal(18, 2), d.thanhTien).input('GC', sql.NVarChar, d.ghiChu)
    .query(`INSERT INTO PhieuNhapKhoHangChiTiet (PhieuNKID, MaHangID, MauSacID, SoLuong, DonVi,
              SoLuongChinh, DonGia, ThanhTien, GhiChu)
            VALUES (@P, @MH, @MS, @SL, @DV, @SLC, @DG, @TT, @GC)`);
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

    // v6.96: tich "Tao the kho" -> tao luon dong mau + ghi anh (khong ghi so luong)
    const tk = (b.taoTheKho === false) ? { soMau: 0, soAnh: 0 } : await taoTheKhoTuDong(pool, tran, dsGhi);

    await tran.commit();
    const maMoi = dsGhi.filter(d => d.laMaMoi).map(d => d.maHang);
    res.json({
      success: true,
      data: { phieuNKID: phieuId, soPhieu, tongTien, maMoi },
      message: `Đã lưu phiếu ${soPhieu}.`
        + (maMoi.length ? ` Đã sinh ${maMoi.length} mã hàng mới (${maMoi.join(', ')}).` : '')
        + (tk.soMau ? ` Đã tạo ${tk.soMau} dòng màu trong thẻ kho.` : '')
        + (tk.soAnh ? ` Đã cập nhật ảnh đại diện cho ${tk.soAnh} mã.` : '')
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
    /* 1. GO ban cu: chi can XOA dong cu. v6.89 khong con phai tru NhapCai — ton doc thang tu bang
       nay nen xoa dong la ton tu giam dung phan cua ban cu. */
    await new sql.Request(tran).input('id', sql.Int, req.params.id)
      .query('DELETE FROM PhieuNhapKhoHangChiTiet WHERE PhieuNKID=@id');

    // 2. GHI LAI theo du lieu moi
    const dsGhi = [];
    for (const d of dong) dsGhi.push(await chuanDong(pool, tran, d, loai));
    for (const d of dsGhi) await ghiDong(pool, tran, req.params.id, d);
    // v6.96: sua phieu cung dong bo lai the kho (them mau moi / doi anh); khong dung den so luong.
    const tk2 = (b.taoTheKho === false) ? { soMau: 0, soAnh: 0 } : await taoTheKhoTuDong(pool, tran, dsGhi);

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
    const maMoi2 = dsGhi.filter(d => d.laMaMoi).map(d => d.maHang);
    res.json({
      success: true,
      message: 'Đã lưu thay đổi và tính lại tồn kho.'
        + (maMoi2.length ? ` Đã sinh ${maMoi2.length} mã hàng mới: ${maMoi2.join(', ')}.` : '')
        + (tk2.soMau ? ` Đã tạo thêm ${tk2.soMau} dòng màu trong thẻ kho.` : '')
    });
  } catch (err) {
    try { await tran.rollback(); } catch (e) { /* da ket thuc */ }
    console.error('[nhapkho PUT /phieu/:id] ', err);
    res.status(400).json({ success: false, message: 'Lỗi khi sửa phiếu (đã quay lui, dữ liệu giữ nguyên): ' + err.message });
  }
});

/* ---------- HUY / XOA ----------
   v6.89: KHONG con ham truLaiTon(). Doi TrangThai sang 'Đã hủy' la view vw_NhapKhoTuPhieu tu loai
   phieu do ra khoi ton (dieu kien TrangThai <> N'Đã hủy'); xoa phieu thi chi tiet mat theo CASCADE.
   ⚠️ Doi lai: khong con chan duoc "huy phieu khi hang da ban het" (truoc day phep tru NhapCai lam
   viec do). Huy phieu ma hang da xuat di co the lam ton am — chay utils/kiem_ton_am.js de soi. */

router.put('/phieu/:id/huy', requireAuth, requirePermission('KHOHANG', 'edit'), requireChucNang('KHOHANG', CN), async (req, res) => {
  const pool = await getPool();
  const h = (await pool.request().input('id', sql.Int, req.params.id)
    .query('SELECT TrangThai FROM PhieuNhapKhoHang WHERE PhieuNKID=@id')).recordset[0];
  if (!h) return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu nhập kho.' });
  if (h.TrangThai === 'Đã hủy') return res.status(400).json({ success: false, message: 'Phiếu này đã hủy rồi.' });
  const tran = new sql.Transaction(pool);
  await tran.begin();
  try {
    await new sql.Request(tran).input('id', sql.Int, req.params.id)
      .query(`UPDATE PhieuNhapKhoHang SET TrangThai = N'Đã hủy' WHERE PhieuNKID=@id`);
    await tran.commit();
    res.json({ success: true, message: 'Đã hủy phiếu — tồn kho và công nợ trả về như trước.' });
  } catch (err) {
    try { await tran.rollback(); } catch (e) { /* da ket thuc */ }
    res.status(400).json({ success: false, message: 'Lỗi khi hủy phiếu (đã quay lui): ' + err.message });
  }
});

/* v6.94: da chuyen phan "ma hang dang duoc dung o dau" sang backend/utils/maHangThamChieu.js —
   dung CHUNG voi Danh muc hang hoa (routes/danhmuc.js). Mot ban duy nhat, khong sao chep. */

/* ================================================================================================
   XOA PHIEU NHAP KHO — XOA LUON MA HANG NEU CHUA XUAT BAN (v6.92)

   Quy tac (nguoi dung chot):
     - Ma hang CHUA co phieu xuat  -> xoa phieu VA xoa luon ma hang khoi danh muc.
     - Ma hang DA co phieu xuat    -> KHONG cho xoa; phai huy phieu xuat truoc.

   ⚠️ CHAN TRUOC, XOA SAU: kiem tra het roi moi mo transaction. Neu xoa phieu truoc roi moi phat hien
   con phieu ban hang thi phai quay lui — ma quay lui giua chuoi DELETE nhieu bang la cho de sinh loi
   nhat. Chan truoc thi truong hop that bai khong he dong vao du lieu.

   ⚠️ Ma hang duoc GIU LAI (khong xoa) khi con bat ky rang buoc nao khac, ke ca phieu nhap kho KHAC:
   xoa mot trong hai phieu nhap cua cung mot ma khong duoc keo mat ca ma hang.
   ================================================================================================ */
router.delete('/phieu/:id', requireAuth, requirePermission('KHOHANG', 'delete'), requireChucNang('KHOHANG', CN), async (req, res) => {
  const pool = await getPool();
  const phieuId = parseInt(req.params.id, 10);
  const h = (await pool.request().input('id', sql.Int, phieuId)
    .query('SELECT PhieuNKID, SoPhieu, TrangThai FROM PhieuNhapKhoHang WHERE PhieuNKID=@id')).recordset[0];
  if (!h) return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu nhập kho.' });

  // Cac ma hang co tren phieu nay
  const maTrenPhieu = (await pool.request().input('id', sql.Int, phieuId).query(`
    SELECT DISTINCT ct.MaHangID, hh.MaHang, hh.TenHang
    FROM PhieuNhapKhoHangChiTiet ct
    JOIN TheKhoHangHoa hh ON hh.MaHangID = ct.MaHangID
    WHERE ct.PhieuNKID = @id`)).recordset;

  /* ---- BUOC 1: CHAN neu ma hang da co PHIEU XUAT (phieu ban hang) chua huy ---- */
  const vuongXuat = [];
  for (const m of maTrenPhieu) {
    const bh = (await pool.request().input('mh', sql.Int, m.MaHangID).query(`
      SELECT DISTINCT p.SoPhieu
      FROM PhieuBanHangChiTiet ct
      JOIN PhieuBanHang p ON p.PhieuBHID = ct.PhieuBHID
      WHERE ct.MaHangID = @mh AND p.TrangThai <> N'Đã hủy'`)).recordset.map(x => x.SoPhieu);
    if (bh.length) vuongXuat.push({ ma: m.MaHang, phieu: bh });
  }
  if (vuongXuat.length) {
    return res.status(400).json({
      success: false,
      message: 'KHÔNG xóa được phiếu ' + h.SoPhieu + ' — hàng đã xuất bán. Phải HỦY phiếu bán hàng trước:\n'
        + vuongXuat.map(v => '• ' + v.ma + ': ' + v.phieu.join(', ')).join('\n')
    });
  }

  /* ---- BUOC 2: xoa phieu, roi xoa nhung ma hang khong con rang buoc nao ---- */
  const tran = new sql.Transaction(pool);
  await tran.begin();
  try {
    await new sql.Request(tran).input('id', sql.Int, phieuId)
      .query('DELETE FROM PhieuNhapKhoHang WHERE PhieuNKID=@id');   // chi tiet xoa theo CASCADE

    const daXoaMa = [], giuLaiMa = [];
    for (const m of maTrenPhieu) {
      const vuong = await noiDangDungMaHang(pool, m.MaHangID, tran);
      if (vuong.length) {
        giuLaiMa.push(m.MaHang + ' (còn: ' + vuong.join(', ') + ')');
        continue;
      }
      // Khong con gi tham chieu -> xoa ma hang. TheKhoChiTietMau / GiaVonHangHoa mat theo CASCADE.
      await new sql.Request(tran).input('mh', sql.Int, m.MaHangID)
        .query('DELETE FROM TheKhoHangHoa WHERE MaHangID = @mh');
      daXoaMa.push(m.MaHang);
    }

    await tran.commit();
    let msg = 'Đã xóa phiếu nhập kho ' + h.SoPhieu + '.';
    if (daXoaMa.length) msg += ' Đã xóa luôn ' + daXoaMa.length + ' mã hàng khỏi danh mục: ' + daXoaMa.join(', ') + '.';
    if (giuLaiMa.length) msg += ' GIỮ LẠI ' + giuLaiMa.length + ' mã vì còn dữ liệu liên quan: ' + giuLaiMa.join('; ') + '.';
    res.json({ success: true, data: { daXoaMa, giuLaiMa }, message: msg });
  } catch (err) {
    try { await tran.rollback(); } catch (e) { /* da ket thuc */ }
    console.error('[nhapkho DELETE /phieu/:id] ', err);
    res.status(400).json({ success: false, message: 'Lỗi khi xóa phiếu (đã quay lui, dữ liệu giữ nguyên): ' + err.message });
  }
});


module.exports = router;
