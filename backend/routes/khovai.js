const express = require('express');
const ExcelJS = require('exceljs'); // v5.19 (muc 4): xuat Excel cho Ton kho vai / The kho vai cay
const { sql, getPool } = require('../db');
const { requireAuth, requirePermission, requireChucNang } = require('../middleware/auth');
const { xuatKhoVai } = require('../utils/vaiXuatService');
/* v7.36: MOT dinh nghia "con hang" cho ca he thong (con KG HOAC con MET) — xem utils/tonVai.js.
   Truoc day 8 cho tu viet `KGCon > 0` nen vai nhap theo met/cay (KGNhap = 0) vo hinh o moi man xuat. */
const { conHangSQL, conHang, capNhatTrangThaiCay: capNhatTrangThaiCayDungChung } = require('../utils/tonVai');
/* v7.61: MOT ban cong thuc "tien cua mot cay vai" — dung CHUNG voi routes/congno.js. Tong tien tren
   phieu nhap PHAI bang dung so ma cong no NCC ghi no cho chinh phieu do. */
const { bieuThucTienCay, coCotDonViTinhGia, chuanDonViTinhGia } = require('../utils/tienVaiNhap');
const net = require('net'); // v5.45: gửi lệnh in tem tới máy in mạng qua socket raw (cổng 9100).
const fs = require('fs');   // v5.45.7: kiểm tra file font khi render tem thành ảnh.

// v5.19 (muc 4, yeu cau "Tất cả các phân hệ thẻ kho, Tồn kho có chức năng xuất file excel"): helper
// dung chung, don gian (KHONG lam template co dinh dang phuc tap nhu Bao gia Aloha - day la xuat THAM
// KHAO/doi chieu noi bo, khong phai file gui doi tac) - 1 hang tieu de in dam + do rong cot tu dong.
async function sendSimpleExcel(res, filename, sheetName, columns, rows) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  ws.columns = columns;
  ws.getRow(1).font = { bold: true };
  rows.forEach(r => ws.addRow(r));
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await wb.xlsx.write(res);
  res.end();
}

const router = express.Router();

// v5.0: nhap kho gio chon Loai vai + Mau (thay vi chon truc tiep 1 ma vai co san) - tu dong tim dung
// DanhMucVai da co ung voi cap Loai vai+Mau do, hoac tu tao moi (MaVai sinh tu MaLoai-MaMau, kem so
// thu tu neu trung) neu day la lan dau nhap loai+mau nay. Giu nguyen moi metadata (Kho vai/GSM/MaPM...)
// cua DanhMucVai da co - CHI tao moi khi thuc su chua ton tai cap Loai vai+Mau nay.
/* v6.58: TINH LAI TrangThai cua 1 cay vai (Nguyên cây / Cây lẻ / Hết).
   v7.36: cong thuc DA CHUYEN HAN sang utils/tonVai.js (xet ca MET, khong chi KG) va CA BON cho goi
   cung mot ban — truoc day v6.58 gom vao day nhung PUT /xuat/:id, DELETE /xuat/:id va
   utils/vaiXuatService.js VAN COPY cong thuc rieng. Ham nay chi con la lop bao de khong phai doi
   moi cho goi. */
async function capNhatTrangThaiCay(pool, cayId) {
  return capNhatTrangThaiCayDungChung(pool, sql, cayId);
}

async function resolveOrCreateVaiId(pool, loaiVaiId, mauSacId) {
  /* v6.59: TỪ CHỐI thay vì âm thầm tạo mã vải rác.
     Form có thể gửi rỗng (loại vải đã bị xóa khỏi danh mục nên select về option rỗng). Trước đây
     hàm này cứ thế đi tạo cặp Loại vải + Màu mới với id rỗng -> sinh mã vải vô nghĩa, dòng cây vải
     trỏ sang mã đó và không ai hiểu vì sao. Chặn ngay tại nguồn, không phụ thuộc vào form. */
  if (!loaiVaiId || !mauSacId) {
    throw new Error('Dòng cây vải thiếu Loại vải hoặc Màu. Loại vải/màu cũ có thể đã bị xóa khỏi danh mục — hãy chọn lại cho dòng đó rồi lưu.');
  }
  const existing = await pool.request().input('lv', sql.Int, loaiVaiId).input('ms', sql.Int, mauSacId)
    .query('SELECT VaiID, MaVai FROM DanhMucVai WHERE LoaiVaiID=@lv AND MauSacID=@ms');
  if (existing.recordset.length) return existing.recordset[0];

  const lvResult = await pool.request().input('id', sql.Int, loaiVaiId).query('SELECT MaLoai FROM LoaiVai WHERE LoaiVaiID=@id');
  const msResult = await pool.request().input('id', sql.Int, mauSacId).query('SELECT MaMau FROM MauSac WHERE MauSacID=@id');
  const maLoai = (lvResult.recordset[0] && lvResult.recordset[0].MaLoai) || 'VAI';
  const maMau = (msResult.recordset[0] && msResult.recordset[0].MaMau) || 'MAU';
  const baseCode = maLoai + '-' + maMau;
  let candidate = baseCode;
  let seq = 1;
  while (true) {
    const dup = await pool.request().input('m', sql.NVarChar, candidate).query('SELECT VaiID FROM DanhMucVai WHERE MaVai=@m');
    if (!dup.recordset.length) break;
    seq++;
    candidate = baseCode + '-' + seq;
  }
  const ins = await pool.request()
    .input('MaVai', sql.NVarChar, candidate).input('LoaiVaiID', sql.Int, loaiVaiId).input('MauSacID', sql.Int, mauSacId)
    .query('INSERT INTO DanhMucVai (MaVai, LoaiVaiID, MauSacID) OUTPUT INSERTED.VaiID, INSERTED.MaVai VALUES (@MaVai, @LoaiVaiID, @MauSacID)');
  return ins.recordset[0];
}

// ============ DANH MUC CHO FORM (loai vai, mau, ma vai, nha cung cap) ============
router.get('/danhmuc', requireAuth, requirePermission('KHOVAI', 'view'), async (req, res) => {
  const pool = await getPool();
  const [vai, ncc, loaiVai, mauSac] = await Promise.all([
    pool.request().query(`
      SELECT v.VaiID, v.MaVai, v.MaPM, v.KhoVai, v.GSM, v.ViTriKho, v.TonToiThieuKG, lv.TenLoaiVai, lv.MaLoai, ms.TenMau
      FROM DanhMucVai v
      LEFT JOIN LoaiVai lv ON lv.LoaiVaiID = v.LoaiVaiID
      LEFT JOIN MauSac ms ON ms.MauSacID = v.MauSacID
      ORDER BY v.MaVai`),
    pool.request().query('SELECT * FROM NhaCungCap ORDER BY TenNCC'),
    // v5.0: dung cho 2 select "Loai vai" + "Mau" o form Nhap kho (thay the chon truc tiep Ma vai)
    pool.request().query('SELECT * FROM LoaiVai ORDER BY TenLoaiVai'),
    pool.request().query('SELECT * FROM MauSac ORDER BY TenMau')
  ]);
  res.json({ success: true, data: { vai: vai.recordset, nhaCungCap: ncc.recordset, loaiVai: loaiVai.recordset, mauSac: mauSac.recordset } });
});

// ============ TON KHO THEO MA VAI (TONG HOP) ============
router.get('/dashboard', requireAuth, requirePermission('KHOVAI', 'view'), requireChucNang('KHOVAI', 'dashboard'), async (req, res) => {
  const pool = await getPool();
  const tonKho = await pool.request().query('SELECT * FROM vw_TonKhoVai ORDER BY MaVai');
  const rows = tonKho.recordset;
  const stats = {
    soMaVai: rows.length,
    tongTonKG: rows.reduce((s, r) => s + (Number(r.TonKG) || 0), 0),
    soMaCanhBao: rows.filter(r => r.TonToiThieuKG != null && Number(r.TonKG) < Number(r.TonToiThieuKG)).length,
    tongCayConTon: rows.reduce((s, r) => s + (Number(r.CayConTon) || 0), 0)
  };
  res.json({ success: true, data: { stats, tonKho: rows } });
});

// v5.19 (muc 4): xuat Excel "Tồn kho" (tong hop theo ma vai) - dung LAI dung 1 query voi /dashboard o
// tren de dam bao khop tuyet doi voi so lieu dang hien tren man hinh.
router.get('/dashboard/export', requireAuth, requirePermission('KHOVAI', 'view'), requireChucNang('KHOVAI', 'dashboard'), async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query('SELECT * FROM vw_TonKhoVai ORDER BY MaVai');
    await sendSimpleExcel(res, 'ton_kho_vai.xlsx', 'Tồn kho vải', [
      { header: 'Mã vải', key: 'MaVai', width: 16 },
      { header: 'Mã PM', key: 'MaPM', width: 14 },
      { header: 'Mã loại', key: 'MaLoai', width: 12 },
      { header: 'Loại vải', key: 'TenLoaiVai', width: 22 },
      { header: 'Màu', key: 'TenMau', width: 16 },
      { header: 'Tồn (KG)', key: 'TonKG', width: 12 },
      { header: 'Tồn tối thiểu (KG)', key: 'TonToiThieuKG', width: 16 },
      { header: 'Cây còn tồn', key: 'CayConTon', width: 12 },
      { header: 'Vị trí kho', key: 'ViTriKho', width: 16 }
    ], result.recordset);
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Lỗi khi xuất Excel: ' + err.message });
  }
});

// ============ DANH SACH CAY VAI (ton kho theo cay; dung cho man hinh xuat kho & in tem theo ngay nhap) ============
router.get('/rolls', requireAuth, requirePermission('KHOVAI', 'view'), async (req, res) => {
  const pool = await getPool();
  const onlyAvailable = req.query.available !== 'false';
  const result = await pool.request().query('SELECT * FROM vw_TonCayVai ORDER BY NgayNhap DESC');
  let rows = result.recordset;
  if (onlyAvailable) rows = rows.filter(conHang);   // v7.36: con KG HOAC con MET
  if (req.query.ngayNhap) {
    const target = new Date(req.query.ngayNhap).toDateString();
    rows = rows.filter(r => new Date(r.NgayNhap).toDateString() === target);
  }
  res.json({ success: true, data: rows });
});

/* ==================================================================================================
   v6.66.4 — TRẢ VẢI VỀ NHÀ CUNG CẤP: chọn NCC thì CHỈ ra phiếu nhập của chính NCC đó, chọn phiếu nhập
   thì CHỈ ra các cây vải thuộc phiếu đó và còn tồn.
   Vì sao phải khoanh vùng: trả hàng là trả đúng lô đã nhập của NCC đó. Cho chọn tự do trong toàn kho
   thì rất dễ trả nhầm cây của NCC khác — mà đơn giá giảm nợ lại lấy theo DonGiaNhap của cây, nên
   trả nhầm là công nợ sai ngay, không có gì chặn lại.
   `vw_TonCayVai` KHÔNG có cột PhieuNhapID nên join thẳng VaiCay để lấy, không sửa view (view đang
   được nhiều màn dùng chung).
   ================================================================================================== */
router.get('/ncc/:nccId/phieunhap', requireAuth, requirePermission('KHOVAI', 'view'), requireChucNang('KHOVAI', 'xuat'), async (req, res) => {
  const pool = await getPool();
  const rs = (await pool.request().input('ncc', sql.Int, req.params.nccId).query(`
    SELECT p.PhieuNhapID, p.NgayNhap, p.SoHoaDon, p.GhiChu,
           COUNT(vc.CayID) AS SoCay,
           ISNULL(SUM(vc.KGNhap), 0) AS TongKGNhap
    FROM PhieuNhapVai p LEFT JOIN VaiCay vc ON vc.PhieuNhapID = p.PhieuNhapID
    WHERE p.NCC_ID = @ncc
    GROUP BY p.PhieuNhapID, p.NgayNhap, p.SoHoaDon, p.GhiChu
    ORDER BY p.NgayNhap DESC, p.PhieuNhapID DESC`)).recordset;
  res.json({ success: true, data: rs });
});

/* ==================================================================================================
   v7.48 — CAY VAI CON TON CUA MOT NCC (moi phieu nhap cua NCC do).
   Vi sao can: mot lan tra hang co the gom cay cua NHIEU PHIEU NHAP khac nhau (nguoi dung bao). Bat
   chon dung MOT phieu nhap thi phai lap 2 phieu tra cho cung mot lan tra — sai thuc te.
   Van GIU khoanh vung theo NCC: don gia giam no lay theo VaiCay.DonGiaNhap cua tung cay, cho chon tu
   do toan kho la tra nham cay cua NCC khac -> cong no sai ngay ma khong co gi chan.
   `vw_TonCayVai` KHONG co PhieuNhapID/NCC nen join VaiCay + PhieuNhapVai de lay, khong sua view.
   ================================================================================================== */
router.get('/ncc/:nccId/cay', requireAuth, requirePermission('KHOVAI', 'view'), requireChucNang('KHOVAI', 'xuat'), async (req, res) => {
  const pool = await getPool();
  const rs = (await pool.request().input('ncc', sql.Int, req.params.nccId).query(`
    SELECT t.*, vc.DonGiaNhap, vc.PhieuNhapID
    FROM vw_TonCayVai t
    JOIN VaiCay vc ON vc.CayID = t.CayID
    JOIN PhieuNhapVai pn ON pn.PhieuNhapID = vc.PhieuNhapID
    WHERE pn.NCC_ID = @ncc AND ${conHangSQL('t')}
    ORDER BY t.MaCay`)).recordset;
  res.json({ success: true, data: rs });
});

router.get('/phieunhap/:id/cay', requireAuth, requirePermission('KHOVAI', 'view'), requireChucNang('KHOVAI', 'xuat'), async (req, res) => {
  const pool = await getPool();
  // Trả về ĐÚNG khuôn vw_TonCayVai để form xuất dùng lại nguyên bộ dòng, không phải đổi mẫu hiển thị.
  const rs = (await pool.request().input('id', sql.Int, req.params.id).query(`
    SELECT t.*, vc.DonGiaNhap
    FROM vw_TonCayVai t JOIN VaiCay vc ON vc.CayID = t.CayID
    WHERE vc.PhieuNhapID = @id AND ${conHangSQL('t')}
    ORDER BY t.MaCay`)).recordset;
  res.json({ success: true, data: rs });
});

/* ==================================================================================================
   v6.13 — LỊCH SỬ NHẬP / XUẤT CỦA 1 CÂY VẢI  (GET /api/khovai/cay/:cayId/lichsu)
   Yêu cầu: xem chi tiết cây vải ở bất cứ đâu cũng thấy phiếu nhập (PN) và các phiếu xuất (PX) gắn với
   cây đó, bấm vào là mở phiếu ra xem/sửa ngay.
   Trả về đủ MỌI nguồn làm thay đổi tồn của cây (nếu chỉ lấy 1 nguồn thì lịch sử cộng lại không khớp tồn):
     - Phiếu NHẬP: VaiCay.PhieuNhapID (1 cây thuộc đúng 1 phiếu nhập)
     - Phiếu XUẤT kho vải: PhieuXuatVaiChiTiet
     - Phiếu XUẤT VẬT TƯ phần vải: PhieuXuatVatTuVai (có từ v5.28 — CSDL chưa chạy migration đó thì bỏ qua)
   Kèm KIỂM KÊ và SỔ CẮT để biết vì sao cây bị khóa không xóa được (chỉ để xem, không bấm mở phiếu).
   Chỉ gate quyền XEM của phân hệ Kho vải — người xem được tồn kho thì xem được lịch sử của cây.
   ================================================================================================== */
router.get('/cay/:cayId/lichsu', requireAuth, requirePermission('KHOVAI', 'view'), async (req, res) => {
  try {
    const pool = await getPool();
    const id = Number(req.params.cayId);
    if (!Number.isFinite(id)) return res.status(400).json({ success: false, message: 'Mã cây không hợp lệ.' });
    const coBang = async (t) => ((await pool.request().query(`SELECT OBJECT_ID('dbo.${t}','U') AS id`)).recordset[0] || {}).id != null;

    const cay = (await pool.request().input('id', sql.Int, id).query(`
      SELECT vc.CayID, vc.MaCay, vc.KGNhap, vc.SoMet, vc.KhoVaiThucTe, vc.TrangThai, vc.PhieuNhapID,
             dv.MaVai, lv.TenLoaiVai, ms.TenMau, t.KGCon
      FROM VaiCay vc
      JOIN DanhMucVai dv ON dv.VaiID = vc.VaiID
      LEFT JOIN LoaiVai lv ON lv.LoaiVaiID = dv.LoaiVaiID
      LEFT JOIN MauSac ms ON ms.MauSacID = dv.MauSacID
      LEFT JOIN vw_TonCayVai t ON t.CayID = vc.CayID
      WHERE vc.CayID = @id`)).recordset[0];
    if (!cay) return res.status(404).json({ success: false, message: 'Không tìm thấy cây vải.' });

    const nhap = cay.PhieuNhapID ? (await pool.request().input('p', sql.Int, cay.PhieuNhapID).query(`
      SELECT p.PhieuNhapID, p.NgayNhap, p.SoHoaDon, p.GhiChu, ncc.TenNCC, u.HoTen AS NguoiTao
      FROM PhieuNhapVai p
      LEFT JOIN NhaCungCap ncc ON ncc.NCC_ID = p.NCC_ID
      LEFT JOIN Users u ON u.UserID = p.NguoiTaoID
      WHERE p.PhieuNhapID = @p`)).recordset[0] || null : null;

    const xuat = (await pool.request().input('id', sql.Int, id).query(`
      SELECT px.PhieuXuatID, px.NgayXuat, px.MaDon, px.NguoiNhan, px.GhiChu, d.MaDH,
             ct.KGXuat, ct.SoMet, ct.KieuVai, u.HoTen AS NguoiTao
      FROM PhieuXuatVaiChiTiet ct
      JOIN PhieuXuatVai px ON px.PhieuXuatID = ct.PhieuXuatID
      LEFT JOIN DonHangSanXuat d ON d.DonHangID = px.DonHangID
      LEFT JOIN Users u ON u.UserID = px.NguoiTaoID
      WHERE ct.CayID = @id
      ORDER BY px.NgayXuat, px.PhieuXuatID`)).recordset;

    /* v7.34.1 SUA LOI TIEM AN: bang PhieuXuatVatTuVai (migration_v528) KHONG co cot SoMet — chi co
       ID / PhieuVatTuID / CayID / KieuVai / KGXuat. Hien tai bang do khong ton tai nen coBang() chan
       lai, nhung he thong nao chay migration_v528 la man "chi tiet cay vai" nem ngay
       "Invalid column name 'SoMet'". Nay do cot bang COL_LENGTH truoc khi dua vao SELECT.
       Bat duoc bang utils/kiem_ten_bang_cot.js. */
    let coSoMetVT = false;
    if (await coBang('PhieuXuatVatTuVai')) {
      try {
        coSoMetVT = ((await pool.request().query(
          `SELECT COL_LENGTH('PhieuXuatVatTuVai','SoMet') AS a`)).recordset[0] || {}).a != null;
      } catch (e) { coSoMetVT = false; }
    }
    const xuatVatTu = (await coBang('PhieuXuatVatTuVai')) ? (await pool.request().input('id', sql.Int, id).query(`
      SELECT vt.PhieuVatTuID, vt.KGXuat,
             ${coSoMetVT ? 'vt.SoMet' : 'CAST(NULL AS DECIMAL(10,2)) AS SoMet'},
             p.NgayXuat, p.MaDon, p.GhiChu
      FROM PhieuXuatVatTuVai vt
      LEFT JOIN PhieuXuatVatTu p ON p.PhieuVatTuID = vt.PhieuVatTuID
      WHERE vt.CayID = @id ORDER BY p.NgayXuat`)).recordset : [];

    const kiemKe = (await pool.request().input('id', sql.Int, id).query(`
      SELECT kk.ID, kk.NgayKiem, kk.KGHeThong, kk.KGThucTe, kk.GhiChu FROM KiemKeVai kk
      WHERE kk.CayID = @id ORDER BY kk.NgayKiem`)).recordset;

    const soCat = (await coBang('TienDoCatChiTietCay')) ? (await pool.request().input('id', sql.Int, id).query(`
      SELECT cay.TienDoID, cay.SttCay, cay.SoLuongLop, cay.SoKgMetSuDung, td.NgayGhiNhan, d.MaDH
      FROM TienDoCatChiTietCay cay
      JOIN TienDoSanXuat td ON td.TienDoID = cay.TienDoID
      LEFT JOIN DonHangSanXuat d ON d.DonHangID = td.DonHangID
      WHERE cay.CayID = @id ORDER BY td.NgayGhiNhan`)).recordset : [];

    res.json({ success: true, data: { cay, nhap, xuat, xuatVatTu, kiemKe, soCat } });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Lỗi khi lấy lịch sử cây vải: ' + err.message });
  }
});

// v5.19 (muc 4): xuat Excel "Tồn theo cây" (The kho vai cay) - mac dinh CHI cay con KG > 0 (giong
// hanh vi mac dinh cua man hinh, available!==false) de tranh file qua dai voi cay da "Het".
router.get('/rolls/export', requireAuth, requirePermission('KHOVAI', 'view'), async (req, res) => {
  try {
    const pool = await getPool();
    const onlyAvailable = req.query.available !== 'false';
    const result = await pool.request().query('SELECT * FROM vw_TonCayVai ORDER BY NgayNhap DESC');
    let rows = result.recordset;
    if (onlyAvailable) rows = rows.filter(conHang);   // v7.36: con KG HOAC con MET
    await sendSimpleExcel(res, 'the_kho_vai_cay.xlsx', 'Thẻ kho vải cây', [
      { header: 'Mã cây', key: 'MaCay', width: 16 },
      { header: 'Mã vải', key: 'MaVai', width: 16 },
      { header: 'Mã PM', key: 'MaPM', width: 14 },
      { header: 'Mã loại', key: 'MaLoai', width: 12 },
      { header: 'Loại vải', key: 'TenLoaiVai', width: 22 },
      { header: 'Màu', key: 'TenMau', width: 16 },
      { header: 'KG nhập', key: 'KGNhap', width: 12 },
      { header: 'KG đã xuất', key: 'KGDaXuat', width: 12 },
      { header: 'KG còn', key: 'KGCon', width: 12 },
      { header: 'Trạng thái', key: 'TrangThai', width: 14 },
      { header: 'Ngày nhập', key: 'NgayNhap', width: 14, style: { numFmt: 'dd/mm/yyyy' } },
      { header: 'Vị trí kho', key: 'ViTriKho', width: 16 }
    ], rows);
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Lỗi khi xuất Excel: ' + err.message });
  }
});

// ============ DANH SACH DON HANG SAN XUAT (cho form xuat kho - gan don hang) ============
// v5.21 (yeu cau muc 6, "phải có Chỉ định vải SX mới hiển thị sang Tạo phiếu xuất kho cho đơn hàng đó"):
// SUA LAI quyet dinh cua v5.20 - truoc day CHO HIEN don hang CHUA khai Chi dinh vai SX (de tranh "an
// nham" don chi vi chua ai dien) nhung nguoi dung xac nhan muon NGUOC LAI: don hang PHAI co Chi dinh vai
// SX (bat ky dong DonHangChiTietVai nao co SoKGYeuCau > 0) truoc thi moi duoc chon de tao phieu xuat kho
// cho don hang do - dam bao luon co so lieu doi chieu KG chi dinh khi lap phieu (xem GET
// /orders/:donHangId/vaichophep + module.khovai.js applyOrderFilter). Don CHUA/khong con gi de xuat (da
// xuat DU/VUOT KG chi dinh) van bi an nhu truoc.
router.get('/orders', requireAuth, requirePermission('KHOVAI', 'view'), requireChucNang('KHOVAI', 'xuat'), async (req, res) => {
  const pool = await getPool();
  // v5.47: KHÔI PHỤC khóa xuất kho theo chỉ định — chỉ liệt kê đơn ĐÃ khai "Chỉ định vải SX"
  // mới được lập phiếu xuất kho vải.
  // v5.64 SỬA: điều kiện cũ là "SoKGYeuCau > 0" nên đơn chỉ khai theo SỐ MÉT (KG để 0 — hợp lệ từ
  // v5.51) KHÔNG hiện trong danh sách => không lập được phiếu xuất cho đơn đó. Nay tính ĐÃ CHỈ ĐỊNH
  // khi có BẤT KỲ dòng chỉ định nào, đồng bộ với cột "Đã chỉ định" ở màn Chỉ định vải SX (fix v5.54).
  /* v5.76: kèm MÃ RẬP (gộp các mã rập của sơ đồ trong đơn) để form Tạo phiếu xuất tự điền —
     cùng nguồn với cột Mã rập ở Danh sách lệnh SX (DonHangChiTietSoDo.MaRap, xem maRapOf ở qlsx.js). */
  const result = await pool.request().query(`
    SELECT d.DonHangID, d.MaDH, d.TenSanPham,
      STUFF((SELECT DISTINCT ', ' + sd.MaRap
             FROM DonHangChiTietSoDo sd
             WHERE sd.DonHangID = d.DonHangID AND sd.MaRap IS NOT NULL AND LTRIM(RTRIM(sd.MaRap)) <> ''
             FOR XML PATH('')), 1, 2, '') AS MaRap
    FROM DonHangSanXuat d
    WHERE EXISTS (SELECT 1 FROM ChiDinhVaiSX v WHERE v.DonHangID = d.DonHangID)
    ORDER BY d.DonHangID DESC`);
  res.json({ success: true, data: result.recordset });
});

// ============ CAY VAI DUOC PHEP XUAT CHO 1 DON HANG ============
// v5.20 (muc 4/4.1): thay THANG nguon "cay vai cho phep xuat" tu GiaoVaiSanXuat (co che "Giao vai" cu -
// da mo coi tu v5.18, khong con duong nao tao moi du lieu - xem ghi chu tren GET /orders) sang lay TRUC
// TIEP tu "Chi dinh vai SX": cay vai CUNG Loai vai + Mau voi bat ky dong Cau truc vai (DonHangChiTietVai)
// nao da khai bao cho don hang nay, con ton (KGCon > 0), la duoc phep chon. Khoi phuc tinh than cua mo
// hinh TRUOC v5.0 ("cung Loai vai voi don hang" - xem ghi chu cu, nay da xoa) nhung CHINH XAC hon (khop
// them ca Mau, khong chi Loai vai) nho co san DonHangChiTietVai.MauSacID tu Cau truc vai cua Ra lenh SX.
router.get('/orders/:donHangId/vaichophep', requireAuth, requirePermission('KHOVAI', 'view'), requireChucNang('KHOVAI', 'xuat'), async (req, res) => {
  const pool = await getPool();
  /* v5.47: lọc cây theo chỉ định — chỉ cây vải CÙNG Loại vải + Màu với 1 dòng "Chỉ định vải SX" của
     đơn, còn hàng. (Đơn khai Loại vải/Màu kiểu "gõ tự do" — không có LoaiVaiID/MauSacID — sẽ không
     khớp cây nào; cần chọn Loại vải/Màu từ danh mục.)

     v7.36 SỬA HAI LỖI ở đúng câu này:
     1) `t.KGCon > 0`  ->  còn KG HOẶC còn MÉT (conHangSQL). Vải nhập theo mét/cây có KGNhap = 0 nên
        KGCon = 0 ngay từ lúc nhập; điều kiện cũ coi như hết ⇒ có hàng thật mà không xuất được.
     2) `cd.SoKGYeuCau > 0`  ->  KG > 0 HOẶC SỐ MÉT > 0. v5.64 đã nới điều kiện này ở GET /orders
        (dòng 319) cho ca "chỉ khai theo SỐ MÉT" nhưng QUÊN sửa ở đây và ở perMauResult bên dưới ⇒ đơn
        VẪN HIỆN trong dropdown mà danh sách cây lại trống, người lập phiếu tưởng nút hỏng. */
  const cayResult = await pool.request().input('id', sql.Int, req.params.donHangId).query(`
    SELECT t.* FROM vw_TonCayVai t
    JOIN DanhMucVai dv ON dv.VaiID = t.VaiID
    WHERE ${conHangSQL('t')}
      AND EXISTS (SELECT 1 FROM ChiDinhVaiSX cd
                  WHERE cd.DonHangID = @id
                    AND (ISNULL(cd.SoKGYeuCau, 0) > 0 OR ISNULL(cd.SoMet, 0) > 0)
                    AND cd.LoaiVaiID = dv.LoaiVaiID AND cd.MauSacID = dv.MauSacID)
    ORDER BY t.NgayNhap DESC`);
  // v5.19 (muc 3.1, yeu cau "nếu theo đơn hàng thì hiển thị tổng số lượng theo chỉ định vải SX để tham
  // khảo xuất hàng"): tong KG yeu cau theo "Chi dinh vai SX" (DonHangChiTietVai.SoKGYeuCau, xem
  // routes/qlsx.js muc CHI DINH VAI SX + migration_v519.sql) - tach rieng Vai chinh/Vai phoi, kem tong
  // KG DA xuat thuc te cho don hang nay (PhieuXuatVaiChiTiet) de nguoi lap phieu xuat biet con thieu
  // bao nhieu. v5.20: KHONG con chi la THAM KHAO nua - day gio la CHINH nguon du lieu cayChoPhep o tren.
  const chiDinhResult = await pool.request().input('id', sql.Int, req.params.donHangId).query(`
    SELECT
      ISNULL((SELECT SUM(SoKGYeuCau) FROM ChiDinhVaiSX WHERE DonHangID = @id AND Kieu = N'Chính'), 0) AS TongKGYeuCauChinh,
      ISNULL((SELECT SUM(SoKGYeuCau) FROM ChiDinhVaiSX WHERE DonHangID = @id AND Kieu = N'Phối'), 0) AS TongKGYeuCauPhoi,
      ISNULL((SELECT SUM(SoMet) FROM ChiDinhVaiSX WHERE DonHangID = @id AND Kieu = N'Chính'), 0) AS TongMetChinh,
      ISNULL((SELECT SUM(SoMet) FROM ChiDinhVaiSX WHERE DonHangID = @id AND Kieu = N'Phối'), 0) AS TongMetPhoi,
      ISNULL((SELECT SUM(ct.KGXuat) FROM PhieuXuatVaiChiTiet ct JOIN PhieuXuatVai p ON p.PhieuXuatID = ct.PhieuXuatID WHERE p.DonHangID = @id), 0) AS TongKGDaXuat`);
  // v5.21 (yeu cau muc 6, "Hiển thị số lượng chỉ định từng mầu trong phần tạo phiếu xuất kho"): bo sung
  // chi tiet THEO TUNG MAU (truoc chi co tong Chinh/Phoi gop lai) - KG yeu cau + KG da xuat rieng cho
  // dung Loai vai+Mau cua dong Cau truc vai do, de nguoi lap phieu biet CHINH XAC mau nao con thieu bao
  // nhieu thay vi chi biet tong the ca don.
  const perMauResult = await pool.request().input('id', sql.Int, req.params.donHangId).query(`
    SELECT cd.LoaiVaiID, cd.MauSacID, cd.Kieu, lv.TenLoaiVai, ms.TenMau, cd.SoKGYeuCau, cd.SoMet, cd.DVTVaiYeuCau,
      ISNULL((SELECT SUM(pxt.KGXuat) FROM PhieuXuatVaiChiTiet pxt
              JOIN PhieuXuatVai px ON px.PhieuXuatID = pxt.PhieuXuatID
              JOIN VaiCay vc ON vc.CayID = pxt.CayID
              JOIN DanhMucVai dv ON dv.VaiID = vc.VaiID
              WHERE px.DonHangID = @id AND dv.LoaiVaiID = cd.LoaiVaiID AND dv.MauSacID = cd.MauSacID), 0) AS KGDaXuat
    FROM ChiDinhVaiSX cd
    LEFT JOIN LoaiVai lv ON lv.LoaiVaiID = cd.LoaiVaiID
    LEFT JOIN MauSac ms ON ms.MauSacID = cd.MauSacID
    ${/* v7.36: đồng bộ với câu lấy cây ở trên — dòng chỉ định khai theo SỐ MÉT (KG để trống) vẫn
         phải hiện trong bảng tham khảo, không thì người lập phiếu không biết còn thiếu bao nhiêu. */''}
    WHERE cd.DonHangID = @id AND (ISNULL(cd.SoKGYeuCau, 0) > 0 OR ISNULL(cd.SoMet, 0) > 0)
    ORDER BY cd.Kieu, lv.TenLoaiVai, ms.TenMau`);
  res.json({ success: true, data: { cayChoPhep: cayResult.recordset, chiDinhVaiSX: chiDinhResult.recordset[0], chiDinhTheoMau: perMauResult.recordset } });
});

// ============ NHAP KHO (NHIEU CAY 1 LAN) ============
// v5.0: chon Loai vai + Mau (tu tim/tao Ma vai tuong ung) thay vi chon truc tiep 1 Ma vai co san.
/* ================================================================================================
   v5.70 — TRA CỨU MÃ CÂY VỪA QUÉT (dùng ở form Tạo phiếu NHẬP kho vải).
   Trả về:
     daTonTai + cay : mã cây này ĐÃ có trong kho -> cảnh báo, không cho nhập trùng.
     goiY           : đoán Loại vải + Màu từ TIỀN TỐ mã cây (mã cây do hệ thống sinh có dạng
                      <MaVai><ddmmyy><seq>, nên khớp MaVai dài nhất là ra đúng loại vải + màu).
   Không đoán được thì trả goiY = null; người nhập tự chọn Loại vải/Màu như bình thường.
   ================================================================================================ */
router.get('/tracuu-macay', requireAuth, requirePermission('KHOVAI', 'view'), async (req, res) => {
  try {
    const maCay = String(req.query.maCay || '').trim();
    if (!maCay) return res.status(400).json({ success: false, message: 'Thiếu mã cây.' });
    const pool = await getPool();
    const cay = (await pool.request().input('m', sql.NVarChar, maCay).query(`
      SELECT TOP 1 v.MaCay, v.KGNhap, v.SoMet, v.KhoVaiThucTe, v.GSM, v.NgayNhap, v.ViTriKho,
             lv.LoaiVaiID, lv.TenLoaiVai, ms.MauSacID, ms.TenMau,
             ISNULL((SELECT SUM(KGXuat) FROM PhieuXuatVaiChiTiet WHERE CayID = v.CayID), 0) AS KGDaXuat,
             v.KGNhap - ISNULL((SELECT SUM(KGXuat) FROM PhieuXuatVaiChiTiet WHERE CayID = v.CayID), 0) AS KGCon
      FROM VaiCay v
      LEFT JOIN DanhMucVai va ON va.VaiID = v.VaiID
      LEFT JOIN LoaiVai lv ON lv.LoaiVaiID = va.LoaiVaiID
      LEFT JOIN MauSac ms ON ms.MauSacID = va.MauSacID
      WHERE v.MaCay = @m`)).recordset[0] || null;

    let goiY = null;
    if (!cay) {
      // Khớp MaVai DÀI NHẤT là tiền tố của mã cây vừa quét (mã cây = <MaVai><ddmmyy><seq>).
      goiY = (await pool.request().input('m', sql.NVarChar, maCay).query(`
        SELECT TOP 1 lv.LoaiVaiID, lv.TenLoaiVai, ms.MauSacID, ms.TenMau, va.MaVai
        FROM DanhMucVai va
        LEFT JOIN LoaiVai lv ON lv.LoaiVaiID = va.LoaiVaiID
        LEFT JOIN MauSac ms ON ms.MauSacID = va.MauSacID
        WHERE va.MaVai IS NOT NULL AND LEN(va.MaVai) > 0 AND @m LIKE va.MaVai + '%'
        ORDER BY LEN(va.MaVai) DESC`)).recordset[0] || null;
    }
    res.json({ success: true, data: { maCay, daTonTai: !!cay, cay, goiY } });
  } catch (err) {
    console.error('[khovai tracuu-macay] ', err);
    res.status(500).json({ success: false, message: 'Lỗi khi tra cứu mã cây: ' + err.message });
  }
});

router.post('/nhap', requireAuth, requirePermission('KHOVAI', 'create'), requireChucNang('KHOVAI', 'nhap'), async (req, res) => {
  try {
    const user = req.session.user;
    const { ngayNhap, nccId, soHoaDon, ngayHoaDon, ghiChu, rolls } = req.body;
    if (!ngayNhap || !Array.isArray(rolls) || !rolls.length) {
      return res.status(400).json({ success: false, message: 'Thiếu ngày nhập hoặc danh sách cây vải.' });
    }
    if (rolls.some(r => !r.loaiVaiId || !r.mauSacId)) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn Loại vải và Màu cho tất cả các dòng.' });
    }
    const pool = await getPool();
    const coDVTGia = await coCotDonViTinhGia(pool);   // v7.62 (migration_v694)

    // v5.4: them NgayHoaDon (khac Ngay nhap - khop yeu cau mau_phieu.docx "Ngay hoa don: nhap tay").
    const phieuResult = await pool.request()
      .input('NgayNhap', sql.Date, ngayNhap)
      .input('NCC_ID', sql.Int, nccId || null)
      .input('SoHoaDon', sql.NVarChar, soHoaDon || null)
      .input('NgayHoaDon', sql.Date, ngayHoaDon || null)
      .input('GhiChu', sql.NVarChar, ghiChu || null)
      .input('NguoiTaoID', sql.Int, user.userId)
      // v7.62: don gia tinh theo Kg hay Met — cua CA PHIEU. Do cot truoc (migration_v694).
      .input('DonViTinhGia', sql.NVarChar, coDVTGia ? chuanDonViTinhGia(req.body.donViTinhGia) : null)
      .query(`INSERT INTO PhieuNhapVai (NgayNhap, NCC_ID, SoHoaDon, NgayHoaDon, GhiChu, NguoiTaoID${coDVTGia ? ', DonViTinhGia' : ''})
              OUTPUT INSERTED.PhieuNhapID VALUES (@NgayNhap, @NCC_ID, @SoHoaDon, @NgayHoaDon, @GhiChu, @NguoiTaoID${coDVTGia ? ', @DonViTinhGia' : ''})`);
    const phieuNhapId = phieuResult.recordset[0].PhieuNhapID;

    const dateObj = new Date(ngayNhap);
    const dateCode = String(dateObj.getDate()).padStart(2, '0') + String(dateObj.getMonth() + 1).padStart(2, '0') + String(dateObj.getFullYear()).slice(-2);

    const created = [];
    for (const roll of rolls) {
      const vaiInfo = await resolveOrCreateVaiId(pool, roll.loaiVaiId, roll.mauSacId);
      const maVai = vaiInfo.MaVai;
      const prefix = maVai + dateCode;

      /* v5.70: NHẬP TỪ QUÉT QR — nếu client gửi kèm `maCay` (đọc từ mã QR trên cây vải/tem của nhà
         cung cấp) thì DÙNG ĐÚNG mã đó, KHÔNG sinh mã mới. Bắt buộc kiểm tra trùng: mã cây là khóa
         duy nhất, nhập trùng sẽ làm sai toàn bộ tồn/xuất của cây đó. */
      let maCay;
      const maCayQR = String(roll.maCay == null ? '' : roll.maCay).trim();
      if (maCayQR) {
        if (maCayQR.length > 50) return res.status(400).json({ success: false, message: `Mã cây "${maCayQR}" quá dài (tối đa 50 ký tự).` });
        const trung = await pool.request().input('m', sql.NVarChar, maCayQR)
          .query('SELECT TOP 1 MaCay FROM VaiCay WHERE MaCay = @m');
        if (trung.recordset.length) {
          return res.status(400).json({ success: false,
            message: `Mã cây "${maCayQR}" ĐÃ CÓ trong kho — không nhập trùng. Nếu cần sửa thông tin cây này, vào "Tồn theo cây" hoặc sửa phiếu nhập cũ.` });
        }
        maCay = maCayQR;
      } else {
        const existing = await pool.request().input('p', sql.NVarChar, prefix + '%').query('SELECT MaCay FROM VaiCay WHERE MaCay LIKE @p');
        const nums = existing.recordset.map(r => parseInt(String(r.MaCay).replace(prefix, ''), 10) || 0);
        const seq = (nums.length ? Math.max(...nums) : 0) + 1;
        maCay = prefix + String(seq).padStart(3, '0');
      }
      const qrUrl = 'https://quickchart.io/qr?text=' + encodeURIComponent(maCay);
      const kg = Number(roll.kgNhap) || 0;
      const soMet = (roll.soMet === '' || roll.soMet == null) ? null : Number(roll.soMet);   // v5.50

      await pool.request()
        .input('MaCay', sql.NVarChar, maCay)
        .input('PhieuNhapID', sql.Int, phieuNhapId)
        .input('VaiID', sql.Int, vaiInfo.VaiID)
        .input('KhoVaiThucTe', sql.Decimal(10, 2), roll.khoVaiThucTe || null)
        .input('GSM', sql.Decimal(10, 2), roll.gsm || null)
        .input('KGNhap', sql.Decimal(10, 2), kg)
        .input('SoMet', sql.Decimal(10, 2), soMet)
        .input('QRCode', sql.NVarChar, qrUrl)
        .input('ViTriKho', sql.NVarChar, roll.viTriKho || null)
        .input('NgayNhap', sql.Date, ngayNhap)
        .input('DonGiaNhap', sql.Decimal(14, 2), roll.donGiaNhap || null)
        .query(`INSERT INTO VaiCay (MaCay, PhieuNhapID, VaiID, KhoVaiThucTe, GSM, KGNhap, SoMet, QRCode, ViTriKho, NgayNhap, DonGiaNhap)
                VALUES (@MaCay, @PhieuNhapID, @VaiID, @KhoVaiThucTe, @GSM, @KGNhap, @SoMet, @QRCode, @ViTriKho, @NgayNhap, @DonGiaNhap)`);
      created.push({ maCay, maVai, kgNhap: kg, qrUrl });
    }
    res.json({ success: true, data: { phieuNhapId, rolls: created } });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Lỗi khi nhập kho: ' + err.message });
  }
});

// ============ DANH SACH PHIEU NHAP KHO (v5.0 - man hinh list, xem/in/sua/xoa) ============
router.get('/nhap', requireAuth, requirePermission('KHOVAI', 'view'), requireChucNang('KHOVAI', 'nhap'), async (req, res) => {
  const pool = await getPool();
  /* v7.62: cot DonViTinhGia do migration_v694 them — chua chay thi coi nhu moi phieu deu tinh theo
     KG (dung nhu truoc), khong duoc de ten cot lot vao cau SQL keo "Invalid column name". */
  const coDVT = await coCotDonViTinhGia(pool);
  const cotDVT = coDVT ? 'ISNULL(p.DonViTinhGia, N\'Kg\')' : 'CAST(N\'Kg\' AS NVARCHAR(10))';
  /* So luong DUNG DE TINH TIEN cua tung cay: theo met neu phieu chon Met, con lai theo KG. */
  const slTinhTien = coDVT
    ? `CASE WHEN p.DonViTinhGia = N'Met' THEN ISNULL(v.SoMet,0) ELSE ISNULL(v.KGNhap,0) END`
    : 'ISNULL(v.KGNhap,0)';
  // v5.4: them p.NgayHoaDon (can de dien san khi mo Sua phieu tu danh sach nay - openNhapEditModal).
  const result = await pool.request().query(`
    SELECT p.PhieuNhapID, p.NgayNhap, p.SoHoaDon, p.NgayHoaDon, p.GhiChu, p.NCC_ID, ncc.TenNCC, u.HoTen AS NguoiTao,
           ${cotDVT} AS DonViTinhGia,
           COUNT(v.CayID) AS SoLuongCay, ISNULL(SUM(v.KGNhap), 0) AS TongKGNhap, ISNULL(SUM(v.SoMet), 0) AS TongMet,
           ${/* v7.61: TONG TIEN cua phieu — cung bieu thuc voi cong no NCC (utils/tienVaiNhap.js). */''}
           ISNULL(SUM(${await bieuThucTienCay(pool, 'v', 'p')}), 0) AS TongTien,
           ${/* v7.62: dem cay "da khai don gia ma so luong tinh tien = 0, trong khi don vi KIA co so"
                -> thanh tien 0 mot cach dang ngo (nham don vi, hoac quen nhap). */''}
           SUM(CASE WHEN ISNULL(v.DonGiaNhap,0) > 0 AND (${slTinhTien}) <= 0
                     AND (ISNULL(v.KGNhap,0) > 0 OR ISNULL(v.SoMet,0) > 0)
                    THEN 1 ELSE 0 END) AS SoCayThieuSoLuong
    FROM PhieuNhapVai p
    LEFT JOIN NhaCungCap ncc ON ncc.NCC_ID = p.NCC_ID
    LEFT JOIN Users u ON u.UserID = p.NguoiTaoID
    LEFT JOIN VaiCay v ON v.PhieuNhapID = p.PhieuNhapID
    GROUP BY p.PhieuNhapID, p.NgayNhap, p.SoHoaDon, p.NgayHoaDon, p.GhiChu, p.NCC_ID, ncc.TenNCC, u.HoTen${coDVT ? ', p.DonViTinhGia' : ''}
    ORDER BY p.PhieuNhapID DESC`);
  res.json({ success: true, data: result.recordset });
});

router.get('/nhap/:id', requireAuth, requirePermission('KHOVAI', 'view'), requireChucNang('KHOVAI', 'nhap'), async (req, res) => {
  const pool = await getPool();
  const id = req.params.id;
  const headResult = await pool.request().input('id', sql.Int, id).query(`
    SELECT p.*, ncc.TenNCC, u.HoTen AS NguoiTao FROM PhieuNhapVai p
    LEFT JOIN NhaCungCap ncc ON ncc.NCC_ID = p.NCC_ID
    LEFT JOIN Users u ON u.UserID = p.NguoiTaoID
    WHERE p.PhieuNhapID = @id`);
  if (!headResult.recordset.length) return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu nhập.' });
  // v5.3 (muc 3): them LoaiVaiID/MauSacID (de dien san dropdown luc Sua) + CoPhatSinh (da xuat kho/
  // giao vai SX/kiem ke chua - de frontend khoa doi loai vai/mau, giong dieu kien backend PUT ap dung).
  const linesResult = await pool.request().input('id', sql.Int, id).query(`
    SELECT v.CayID, v.MaCay, v.KGNhap, v.SoMet, v.KhoVaiThucTe, ISNULL(v.KhoVaiThucTe, dv.KhoVai) AS KhoVai, v.GSM, v.DonGiaNhap, v.QRCode, v.TrangThai, v.ViTriKho,
           ${/* v7.61: THANH TIEN tinh o BACKEND bang dung bieu thuc cua cong no — de ban in / man
                xem / so cong no khong the ra ba con so khac nhau. */''}
           ${await bieuThucTienCay(pool, 'v', 'pnv')} AS ThanhTien,
           dv.MaVai, dv.LoaiVaiID, dv.MauSacID, lv.TenLoaiVai, ms.TenMau,
           ISNULL((SELECT SUM(KGXuat) FROM PhieuXuatVaiChiTiet WHERE CayID = v.CayID), 0) AS DaXuat,
           CASE WHEN EXISTS (SELECT 1 FROM PhieuXuatVaiChiTiet WHERE CayID = v.CayID)
             OR EXISTS (SELECT 1 FROM GiaoVaiSanXuat WHERE CayID = v.CayID)
             OR EXISTS (SELECT 1 FROM KiemKeVai WHERE CayID = v.CayID) THEN 1 ELSE 0 END AS CoPhatSinh
    FROM VaiCay v
    JOIN PhieuNhapVai pnv ON pnv.PhieuNhapID = v.PhieuNhapID
    JOIN DanhMucVai dv ON dv.VaiID = v.VaiID
    LEFT JOIN LoaiVai lv ON lv.LoaiVaiID = dv.LoaiVaiID
    LEFT JOIN MauSac ms ON ms.MauSacID = dv.MauSacID
    WHERE v.PhieuNhapID = @id ORDER BY v.CayID`);
  res.json({ success: true, data: { header: headResult.recordset[0], lines: linesResult.recordset } });
});

// v5.3 (muc 3): cho sua DAY DU cac truong trong phieu Nhap kho (truoc chi cho sua dau phieu - xem
// ghi chu cu ben duoi). Bo sung mang `lines` TUY CHON: khong gui `lines` = chi sua dau phieu nhu cu
// (tuong thich nguoc); co gui `lines` = dong bo TOAN BO danh sach cay (sua/them/xoa) theo nguyen tac:
//   - Dong co san (line.cayId) DA phat sinh giao dich khac (xuat kho/giao vai SX/kiem ke): CHI cho
//     sua KG nhap (khong duoc giam duoi so da xuat)/kho thuc te/GSM/vi tri/don gia - KHONG cho doi
//     loai vai/mau, vi cac giao dich do dang tham chieu dung loai/mau goc.
//   - Dong co san CHUA phat sinh gi: cho sua het, ke ca doi loai vai/mau.
//   - Dong bi bo khoi mang (nguoi dung xoa tren giao dien): xoa that su, nhung van phai kiem tra CHUA
//     phat sinh giao dich khac (giong dieu kien cua DELETE /nhap/:id).
//   - Dong moi (khong co cayId): sinh Ma cay + QR y het luc tao phieu (dung lai resolveOrCreateVaiId).
router.put('/nhap/:id', requireAuth, requirePermission('KHOVAI', 'edit'), requireChucNang('KHOVAI', 'nhap'), async (req, res) => {
  try {
    const { ngayNhap, nccId, soHoaDon, ngayHoaDon, ghiChu, lines } = req.body;
    if (!ngayNhap) return res.status(400).json({ success: false, message: 'Thiếu ngày nhập.' });
    const pool = await getPool();
    const id = req.params.id;
    const coDVTGiaSua = await coCotDonViTinhGia(pool);   // v7.62 (migration_v694)

    await pool.request()
      .input('id', sql.Int, id)
      .input('NgayNhap', sql.Date, ngayNhap).input('NCC_ID', sql.Int, nccId || null)
      .input('SoHoaDon', sql.NVarChar, soHoaDon || null).input('NgayHoaDon', sql.Date, ngayHoaDon || null)
      .input('GhiChu', sql.NVarChar, ghiChu || null)
      .input('DonViTinhGia', sql.NVarChar, coDVTGiaSua ? chuanDonViTinhGia(req.body.donViTinhGia) : null)
      .query(`UPDATE PhieuNhapVai SET NgayNhap=@NgayNhap, NCC_ID=@NCC_ID, SoHoaDon=@SoHoaDon, NgayHoaDon=@NgayHoaDon, GhiChu=@GhiChu
                ${coDVTGiaSua ? ', DonViTinhGia=@DonViTinhGia' : ''}
              WHERE PhieuNhapID=@id`);

    if (Array.isArray(lines)) {
      const existingResult = await pool.request().input('id', sql.Int, id).query('SELECT CayID, MaCay FROM VaiCay WHERE PhieuNhapID=@id');
      const existingCays = existingResult.recordset;
      const sentIds = new Set(lines.filter(l => l.cayId).map(l => Number(l.cayId)));

      // 1) Xoa cac dong bi bo khoi danh sach - kiem tra chua phat sinh giao dich khac truoc khi xoa.
      const toRemove = existingCays.filter(c => !sentIds.has(c.CayID));
      if (toRemove.length) {
        const idList = toRemove.map(c => c.CayID).join(',');
        const xuatCheck = await pool.request().query(`SELECT DISTINCT CayID FROM PhieuXuatVaiChiTiet WHERE CayID IN (${idList})`);
        const giaoCheck = await pool.request().query(`SELECT DISTINCT CayID FROM GiaoVaiSanXuat WHERE CayID IN (${idList})`);
        const kiemKeCheck = await pool.request().query(`SELECT DISTINCT CayID FROM KiemKeVai WHERE CayID IN (${idList})`);
        const blockedIds = new Set([...xuatCheck.recordset, ...giaoCheck.recordset, ...kiemKeCheck.recordset].map(r => r.CayID));
        const blocked = toRemove.filter(c => blockedIds.has(c.CayID));
        if (blocked.length) {
          return res.status(400).json({ success: false, message: 'Không thể xóa các cây vải sau khỏi phiếu (đã phát sinh giao dịch khác): ' + blocked.map(c => c.MaCay).join(', ') });
        }
        await pool.request().query(`DELETE FROM VaiCay WHERE CayID IN (${idList})`);
      }

      const dateObj = new Date(ngayNhap);
      const dateCode = String(dateObj.getDate()).padStart(2, '0') + String(dateObj.getMonth() + 1).padStart(2, '0') + String(dateObj.getFullYear()).slice(-2);

      // 2) Sua dong co san / them dong moi.
      for (const line of lines) {
        const lineMet = (line.soMet === '' || line.soMet == null) ? null : Number(line.soMet);   // v5.50
        if (line.cayId) {
          const cayId = Number(line.cayId);
          const xuatSum = await pool.request().input('id', sql.Int, cayId).query('SELECT ISNULL(SUM(KGXuat),0) AS Tong FROM PhieuXuatVaiChiTiet WHERE CayID=@id');
          const giaoCount = await pool.request().input('id', sql.Int, cayId).query('SELECT COUNT(*) AS C FROM GiaoVaiSanXuat WHERE CayID=@id');
          const kiemKeCount = await pool.request().input('id', sql.Int, cayId).query('SELECT COUNT(*) AS C FROM KiemKeVai WHERE CayID=@id');
          const daXuat = Number(xuatSum.recordset[0].Tong) || 0;
          const coPhatSinh = daXuat > 0 || giaoCount.recordset[0].C > 0 || kiemKeCount.recordset[0].C > 0;
          const newKg = Number(line.kgNhap) || 0;

          if (coPhatSinh && newKg < daXuat) {
            return res.status(400).json({ success: false, message: `Không thể giảm KG nhập của cây ${line.maCay || cayId} xuống dưới ${daXuat} KG (đã có giao dịch dựa trên số liệu gốc).` });
          }

          /* v6.58: CHI GHI DE COT MA FORM THUC SU GUI LEN.
             Truoc day moi cot deu ghi `line.x || null`, ma form Sua phieu nhap KHONG co o "Vi tri
             kho" -> line.viTriKho luon undefined -> chi can them 1 cay roi bam Luu la ViTriKho cua
             TAT CA cay trong phieu ve NULL. Du lieu nay do nhap ton dau ky tu Excel dua vao
             (utils/nhap_ton_vai_excel.js), mat la khong dung lai duoc.
             `ISNULL(@x, Cot)` = client khong gui thi giu nguyen gia tri cu. Muon XOA thi gui chuoi
             rong, khong phai bo trong. */
          const coGui = (k) => Object.prototype.hasOwnProperty.call(line, k) && line[k] !== undefined;
          const rqCay = pool.request()
            .input('id', sql.Int, cayId)
            .input('KhoVaiThucTe', sql.Decimal(10, 2), coGui('khoVaiThucTe') ? (line.khoVaiThucTe || null) : null)
            .input('GSM', sql.Decimal(10, 2), coGui('gsm') ? (line.gsm || null) : null)
            .input('KGNhap', sql.Decimal(10, 2), newKg)
            .input('ViTriKho', sql.NVarChar, coGui('viTriKho') ? (line.viTriKho || null) : null)
            .input('DonGiaNhap', sql.Decimal(14, 2), coGui('donGiaNhap') ? (line.donGiaNhap || null) : null)
            .input('SoMet', sql.Decimal(10, 2), lineMet);
          // Cot nao client KHONG gui thi giu nguyen; cot nao co gui thi ghi de (ke ca ghi ve NULL).
          const dat = (cot, key) => coGui(key) ? `${cot}=@${cot}` : `${cot}=ISNULL(@${cot}, ${cot})`;
          /* v6.59: đồng bộ NgayNhap của cây theo NGÀY Ở ĐẦU PHIẾU.
             Trước đây đổi ngày phiếu thì cây CŨ giữ ngày cũ, còn cây MỚI thêm vào lại lấy ngày mới —
             cùng một phiếu có 2 dải mã cây khác ngày, bản in tem và báo cáo theo ngày nhập lệch nhau. */
          rqCay.input('NgayNhapPhieu', sql.Date, ngayNhap || new Date());
          const phanChung = [dat('KhoVaiThucTe', 'khoVaiThucTe'), dat('GSM', 'gsm'),
            'KGNhap=@KGNhap', 'SoMet=@SoMet', dat('ViTriKho', 'viTriKho'), dat('DonGiaNhap', 'donGiaNhap'),
            'NgayNhap=@NgayNhapPhieu'];
          if (coPhatSinh) {
            await rqCay.query(`UPDATE VaiCay SET ${phanChung.join(', ')} WHERE CayID=@id`);
          } else {
            const vaiInfo = await resolveOrCreateVaiId(pool, line.loaiVaiId, line.mauSacId);
            await rqCay.input('VaiID', sql.Int, vaiInfo.VaiID)
              .query(`UPDATE VaiCay SET VaiID=@VaiID, ${phanChung.join(', ')} WHERE CayID=@id`);
          }
          /* v6.58: KGNhap doi -> phai tinh lai TrangThai. Truoc day khong tinh, nen cay dang 'Hết'
             ma tang KG nhap len van nam o 'Hết' (va nguoc lai) — moi man tồn/quét mã đọc theo cột
             nay nen sai theo. Dung dung cong thuc cua PUT /xuat/:id. */
          await capNhatTrangThaiCay(pool, cayId);
        } else {
          if (!line.loaiVaiId || !line.mauSacId) continue;
          const vaiInfo = await resolveOrCreateVaiId(pool, line.loaiVaiId, line.mauSacId);
          const prefix = vaiInfo.MaVai + dateCode;
          const existingMa = await pool.request().input('p', sql.NVarChar, prefix + '%').query('SELECT MaCay FROM VaiCay WHERE MaCay LIKE @p');
          const nums = existingMa.recordset.map(r => parseInt(String(r.MaCay).replace(prefix, ''), 10) || 0);
          const seq = (nums.length ? Math.max(...nums) : 0) + 1;
          const maCay = prefix + String(seq).padStart(3, '0');
          const qrUrl = 'https://quickchart.io/qr?text=' + encodeURIComponent(maCay);
          await pool.request()
            .input('MaCay', sql.NVarChar, maCay).input('PhieuNhapID', sql.Int, id).input('VaiID', sql.Int, vaiInfo.VaiID)
            .input('KhoVaiThucTe', sql.Decimal(10, 2), line.khoVaiThucTe || null).input('GSM', sql.Decimal(10, 2), line.gsm || null)
            .input('KGNhap', sql.Decimal(10, 2), Number(line.kgNhap) || 0).input('SoMet', sql.Decimal(10, 2), lineMet).input('QRCode', sql.NVarChar, qrUrl)
            .input('ViTriKho', sql.NVarChar, line.viTriKho || null).input('NgayNhap', sql.Date, ngayNhap)
            .input('DonGiaNhap', sql.Decimal(14, 2), line.donGiaNhap || null)
            .query(`INSERT INTO VaiCay (MaCay, PhieuNhapID, VaiID, KhoVaiThucTe, GSM, KGNhap, SoMet, QRCode, ViTriKho, NgayNhap, DonGiaNhap)
                    VALUES (@MaCay, @PhieuNhapID, @VaiID, @KhoVaiThucTe, @GSM, @KGNhap, @SoMet, @QRCode, @ViTriKho, @NgayNhap, @DonGiaNhap)`);
        }
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Lỗi khi cập nhật phiếu nhập: ' + err.message });
  }
});

router.delete('/nhap/:id', requireAuth, requirePermission('KHOVAI', 'delete'), requireChucNang('KHOVAI', 'nhap'), async (req, res) => {
  try {
    const pool = await getPool();
    const id = req.params.id;
    const caysResult = await pool.request().input('id', sql.Int, id).query('SELECT CayID, MaCay FROM VaiCay WHERE PhieuNhapID=@id');
    const cayIds = caysResult.recordset.map(r => r.CayID);
    if (!cayIds.length) {
      await pool.request().input('id', sql.Int, id).query('DELETE FROM PhieuNhapVai WHERE PhieuNhapID=@id');
      return res.json({ success: true });
    }
    const idList = cayIds.join(',');
    const xuatCheck = await pool.request().query(`SELECT DISTINCT CayID FROM PhieuXuatVaiChiTiet WHERE CayID IN (${idList})`);
    const giaoCheck = await pool.request().query(`SELECT DISTINCT CayID FROM GiaoVaiSanXuat WHERE CayID IN (${idList})`);
    const kiemKeCheck = await pool.request().query(`SELECT DISTINCT CayID FROM KiemKeVai WHERE CayID IN (${idList})`);
    if (xuatCheck.recordset.length || giaoCheck.recordset.length || kiemKeCheck.recordset.length) {
      const blockedIds = new Set([...xuatCheck.recordset, ...giaoCheck.recordset, ...kiemKeCheck.recordset].map(r => r.CayID));
      const blockedCodes = caysResult.recordset.filter(r => blockedIds.has(r.CayID)).map(r => r.MaCay);
      return res.status(400).json({
        success: false,
        message: 'Không thể xóa: các cây vải sau trong phiếu đã phát sinh giao dịch khác (xuất kho / giao vải sản xuất / kiểm kê), cần hủy các giao dịch đó trước: ' + blockedCodes.join(', ')
      });
    }
    await pool.request().input('id', sql.Int, id).query('DELETE FROM VaiCay WHERE PhieuNhapID=@id');
    await pool.request().input('id', sql.Int, id).query('DELETE FROM PhieuNhapVai WHERE PhieuNhapID=@id');
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Lỗi khi xóa phiếu nhập: ' + err.message });
  }
});

// ============ XUAT KHO (NHIEU CAY 1 LAN) ============
router.post('/xuat', requireAuth, requirePermission('KHOVAI', 'edit'), requireChucNang('KHOVAI', 'xuat'), async (req, res) => {
  try {
    const user = req.session.user;
    // v6.66: laTraNCC + nccId -> phiếu xuất là TRẢ HÀNG VỀ NCC, giảm công nợ phải trả.
    const { ngayXuat, maDon, donHangId, chuyen, nguoiNhan, mucDich, ghiChu, rolls, laTraNCC, nccId } = req.body;
    const pool = await getPool();

    // Neu co gan don hang san xuat, tu dong lay MaDH tuong ung de hien thi dung trong lich su xuat kho
    // (uu tien MaDH cua don hang hon gia tri maDon nguoi dung go tay, tranh sai lech khi da chon don hang).
    let maDonThucTe = maDon || null;
    if (donHangId) {
      const dhResult = await pool.request().input('id', sql.Int, donHangId).query('SELECT MaDH FROM DonHangSanXuat WHERE DonHangID=@id');
      if (dhResult.recordset.length) maDonThucTe = dhResult.recordset[0].MaDH;
    }

    const result = await xuatKhoVai(pool, {
      ngayXuat, maDon: maDonThucTe, donHangId: donHangId || null, chuyen, nguoiNhan, mucDich, ghiChu,
      nguoiTaoId: user.userId, rolls, laTraNCC, nccId
    });
    res.json({ success: true, data: result });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Lỗi khi xuất kho: ' + err.message });
  }
});

// ============ DANH SACH PHIEU XUAT KHO (v5.0 - man hinh list, xem/in/sua/xoa) ============
/* v6.66: co cot LaTraNCC/NCC_ID (migration_v676). Do truoc khi dua vao SELECT - he thong chua chay
   migration ma query thang cot chua co se lam TRANG ca man Phieu xuat kho vai. */
let __coCotTraNCCVai = null;
async function coCotTraNCCVai(pool) {
  if (__coCotTraNCCVai === null) {
    try {
      const r = (await pool.request().query(
        `SELECT COL_LENGTH('PhieuXuatVai','LaTraNCC') AS a, COL_LENGTH('PhieuXuatVai','NCC_ID') AS b`)).recordset[0] || {};
      __coCotTraNCCVai = r.a != null && r.b != null;
    } catch (e) { __coCotTraNCCVai = false; }
  }
  return __coCotTraNCCVai;
}
router.get('/xuat', requireAuth, requirePermission('KHOVAI', 'view'), requireChucNang('KHOVAI', 'xuat'), async (req, res) => {
  const pool = await getPool();
  const coTra = await coCotTraNCCVai(pool);
  const cotTra = coTra
    ? 'ISNULL(p.LaTraNCC, 0) AS LaTraNCC, p.NCC_ID, ncc.TenNCC'
    : "CAST(0 AS BIT) AS LaTraNCC, CAST(NULL AS INT) AS NCC_ID, CAST(NULL AS NVARCHAR(150)) AS TenNCC";
  const result = await pool.request().query(`
    SELECT p.PhieuXuatID, p.NgayXuat, p.MaDon, p.DonHangID, d.MaDH, p.Chuyen, p.NguoiNhan, p.MucDich, p.GhiChu,
           u.HoTen AS NguoiTao, COUNT(ct.ID) AS SoLuongCay, ISNULL(SUM(ct.KGXuat), 0) AS TongKGXuat, ISNULL(SUM(ct.SoMet), 0) AS TongMet,
           ${cotTra}
    FROM PhieuXuatVai p
    LEFT JOIN DonHangSanXuat d ON d.DonHangID = p.DonHangID
    LEFT JOIN Users u ON u.UserID = p.NguoiTaoID
    ${coTra ? 'LEFT JOIN NhaCungCap ncc ON ncc.NCC_ID = p.NCC_ID' : ''}
    LEFT JOIN PhieuXuatVaiChiTiet ct ON ct.PhieuXuatID = p.PhieuXuatID
    GROUP BY p.PhieuXuatID, p.NgayXuat, p.MaDon, p.DonHangID, d.MaDH, p.Chuyen, p.NguoiNhan, p.MucDich, p.GhiChu, u.HoTen
             ${coTra ? ', p.LaTraNCC, p.NCC_ID, ncc.TenNCC' : ''}
    ORDER BY p.PhieuXuatID DESC`);
  res.json({ success: true, data: result.recordset });
});

router.get('/xuat/:id', requireAuth, requirePermission('KHOVAI', 'view'), requireChucNang('KHOVAI', 'xuat'), async (req, res) => {
  const pool = await getPool();
  const id = req.params.id;
  // v5.7: them d.AnhSanPham - yeu cau v5.7 "thêm Ảnh sản phẩm vào các bản in" (xem printPhieuXuatFromData
  // trong module.khovai.js).
  // v5.94: + MaRap (gộp từ các sơ đồ của đơn hàng gắn kèm) để BẢN IN phiếu xuất vải có Mã rập.
  /* v7.49: TEN NHA CUNG CAP cho phieu TRA NCC — ban in phai ghi ro tra cho ai.
     NCC_ID den tu migration v6.66: DO COT truoc khi JOIN, chua chay migration thi route van chay
     (khong bao "Invalid column name"). LaTraNCC/NCC_ID da co san trong `p.*` khi cot ton tai.
     ⚠️ v7.49.1: DUNG `coCotTraNCCVai()` — ham do cot DA CO SAN trong chinh file nay (dong ~752, do
     ca LaTraNCC va NCC_ID, co cache). Ban v7.49 goi `coCot(pool, ...)` la ham KHONG TON TAI trong
     file nay (no o congno.js) -> ReferenceError -> KHONG MO/IN duoc phieu xuat kho vai. `node --check`
     khong bat duoc loi nay vi cu phap dung; chi chay that hoac grep ten ham moi thay. */
  const coNCCXuat = await coCotTraNCCVai(pool);
  const headResult = await pool.request().input('id', sql.Int, id).query(`
    SELECT p.*, d.MaDH, d.TenSanPham, d.AnhSanPham, u.HoTen AS NguoiTao,
      ${coNCCXuat ? 'ncc.TenNCC' : "CAST(NULL AS NVARCHAR(150)) AS TenNCC"},
      STUFF((SELECT DISTINCT ', ' + sd.MaRap FROM DonHangChiTietSoDo sd
             WHERE sd.DonHangID = p.DonHangID AND sd.MaRap IS NOT NULL AND LTRIM(RTRIM(sd.MaRap)) <> ''
             FOR XML PATH('')), 1, 2, '') AS MaRap
    FROM PhieuXuatVai p
    LEFT JOIN DonHangSanXuat d ON d.DonHangID = p.DonHangID
    LEFT JOIN Users u ON u.UserID = p.NguoiTaoID
    ${coNCCXuat ? 'LEFT JOIN NhaCungCap ncc ON ncc.NCC_ID = p.NCC_ID' : ''}
    WHERE p.PhieuXuatID = @id`);
  if (!headResult.recordset.length) return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu xuất.' });
  // v5.3 (muc 3): them KGNhap + OtherXuat (tong KG da xuat tu CAC PHIEU KHAC cho cung cay) de frontend
  // tinh duoc "con lai neu bo qua phieu nay" luc sua, dam bao khong cho sua vuot ton that.
  // v5.4: them SLTheoChiDinh - tong KG da CHI DINH cho don hang gan voi phieu nay, theo dung Loai
  // vai+Mau cua cay dang xuat (DonHangChiTietVai, cong ca 2 dong Chinh/Phoi neu co ca 2) - de in phieu
  // Xuat kho co cot doi chieu "SL theo chi dinh" ben canh SL thuc xuat. NULL neu phieu khong gan don
  // hang hoac don hang khong chi dinh loai vai+mau nay.
  // v5.21 (yeu cau muc 6, "In phiếu lấy số liệu từ chỉ định vải sx ở cột Kg chỉ định. Hiện tại đang hiện
  // số lượng chỉ định theo đvt từ ra lệnh sản xuất"): doi tu SUM(dhv.SoLuong) - SL khai o Ra lenh san
  // xuat, theo DON VI TUY CHON cua dong do (Cai/Bo/Met...) - sang SUM(dhv.SoKGYeuCau), CHINH la "Kg chỉ
  // định" khai o "Chỉ định vải SX" (v5.19, luon la KG, cung don vi voi KGXuat canh no) - truoc day sai vi
  // lay nham SL theo DVT cua Ra lenh SX (co the la "Cái"/"Bộ"...) dat canh cot KG xuat thuc te, khong
  // cung don vi nen doi chieu sai/vo nghia.
  // v5.7: them v.ViTriKho + v.NgayNhap - dung de nhan hien thi o go-tim ma cay luc SUA phieu xuat
  // (labelForRoll trong openXuatEditModal) hien DAY DU thong tin cay vai, khong chi ma/loai/mau/KG con.
  const linesResult = await pool.request().input('id', sql.Int, id).query(`
    SELECT ct.ID, ct.CayID, ct.KGXuat, ct.SoMet, ct.KieuVai, v.MaCay, v.KGNhap, v.KhoVaiThucTe, v.ViTriKho, v.NgayNhap, dv.MaVai, lv.TenLoaiVai, ms.TenMau,
           ${/* v7.49: PHIEU NHAP GOC cua tung cay — ban in phieu TRA NCC phai ghi "tra theo phieu nhap
                nao, ngay nao". Lay tu PhieuNhapVai chu khong dung `v.NgayNhap`: v.NgayNhap la ngay cua
                CAY (co the lech khi nhap bu), con doi chieu voi NCC thi phai theo NGAY CUA PHIEU.
                Tu v7.48 mot phieu tra gom cay cua NHIEU phieu nhap -> tra theo TUNG DONG, frontend gop
                lai thanh danh sach khong trung. */''}
           ${/* v7.51: + NgayHoaDon cua phieu nhap (cot co tu migration_v54) va DonGiaNhap cua cay —
                ban in phieu TRA NCC can Don gia + So HD + Ngay HD cua NCC. */''}
           v.PhieuNhapID, v.DonGiaNhap, pnv.NgayNhap AS NgayPhieuNhap,
           pnv.SoHoaDon AS SoHoaDonNhap, pnv.NgayHoaDon AS NgayHoaDonNhap,
           ISNULL((SELECT SUM(KGXuat) FROM PhieuXuatVaiChiTiet WHERE CayID = ct.CayID AND PhieuXuatID <> @id), 0) AS OtherXuat,
           (SELECT SUM(dhv.SoKGYeuCau) FROM DonHangChiTietVai dhv
            WHERE dhv.DonHangID = p.DonHangID AND dhv.LoaiVaiID = dv.LoaiVaiID AND dhv.MauSacID = dv.MauSacID) AS SLTheoChiDinh
    FROM PhieuXuatVaiChiTiet ct
    JOIN VaiCay v ON v.CayID = ct.CayID
    JOIN DanhMucVai dv ON dv.VaiID = v.VaiID
    JOIN PhieuXuatVai p ON p.PhieuXuatID = ct.PhieuXuatID
    LEFT JOIN PhieuNhapVai pnv ON pnv.PhieuNhapID = v.PhieuNhapID
    LEFT JOIN LoaiVai lv ON lv.LoaiVaiID = dv.LoaiVaiID
    LEFT JOIN MauSac ms ON ms.MauSacID = dv.MauSacID
    WHERE ct.PhieuXuatID = @id ORDER BY ct.ID`);
  res.json({ success: true, data: { header: headResult.recordset[0], lines: linesResult.recordset } });
});

// Sua: CHI cho sua thong tin dau phieu (ngay/chuyen/nguoi nhan/muc dich/ghi chu) - KHONG cho doi
// don hang gan kem hay danh sach cay/KG da xuat, vi cac bao cao hao hut/cap vai theo don hang (xem
// /haohut) va Giao vai san xuat da dua tren so lieu goc luc tao phieu.
// v5.3 (muc 3): cho sua DAY DU phieu Xuat kho (truoc chi sua dau phieu). Bo sung mang `lines` TUY
// CHON: [{ id? (PhieuXuatVaiChiTiet.ID - bo trong neu la dong moi), cayId, kgXuat }]. Kiem tra
// TRUOC KHI GHI: voi moi dong, KG xuat moi khong duoc vuot qua "KG con neu bo qua chinh dong nay"
// (KGNhap - tong KGXuat cua CAC PHIEU KHAC cho cung cay) - tranh am kho. Sau khi doi xong, TINH LAI
// TrangThai (Nguyen cay/Cay le/Het) cho MOI cay bi anh huong (ca truoc va sau thay doi), giong logic
// da co san o DELETE /xuat/:id (TrangThai la cot luu san, khong tu dong theo).
router.put('/xuat/:id', requireAuth, requirePermission('KHOVAI', 'edit'), requireChucNang('KHOVAI', 'xuat'), async (req, res) => {
  try {
    const { ngayXuat, chuyen, nguoiNhan, mucDich, ghiChu, lines } = req.body;
    if (!ngayXuat) return res.status(400).json({ success: false, message: 'Thiếu ngày xuất.' });
    const pool = await getPool();
    const id = req.params.id;

    /* v5.64: GÁN ĐƠN HÀNG CHO PHIẾU XUẤT TỰ DO.
       Trước đây route sửa KHÔNG nhận donHangId/maDon nên phiếu xuất tự do (không gắn đơn) đã lỡ tạo
       thì không bao giờ gán được đơn — phải xóa phiếu làm lại. Nay:
         - Gửi lên donHangId = số  -> gán/đổi sang đơn đó (MaDon lấy đúng theo MaDH trong CSDL).
         - Gửi lên donHangId = ''/null (VÀ có khóa 'donHangId' trong body) -> GỠ liên kết đơn (về xuất tự do).
         - KHÔNG gửi khóa 'donHangId' -> giữ nguyên như cũ (các nơi gọi cũ không bị ảnh hưởng).
       Lưu ý nghiệp vụ: gán đơn xong thì các cây vải của phiếu này sẽ hiện ở công đoạn Cắt của đơn đó. */
    const coGuiDon = Object.prototype.hasOwnProperty.call(req.body, 'donHangId');
    let donHangIdMoi = null;
    if (coGuiDon && req.body.donHangId !== null && String(req.body.donHangId).trim() !== '') {
      donHangIdMoi = parseInt(req.body.donHangId, 10);
      if (isNaN(donHangIdMoi)) return res.status(400).json({ success: false, message: 'Mã đơn hàng không hợp lệ.' });
      const dh = (await pool.request().input('d', sql.Int, donHangIdMoi)
        .query('SELECT MaDH FROM DonHangSanXuat WHERE DonHangID=@d')).recordset[0];
      if (!dh) return res.status(400).json({ success: false, message: 'Không tìm thấy lệnh sản xuất đã chọn.' });
      req.body.maDon = dh.MaDH;   // MaDon luôn khớp MaDH thật, tránh gõ tay sai lệch
    }

    const rqUp = pool.request()
      .input('id', sql.Int, id)
      .input('NgayXuat', sql.Date, ngayXuat).input('Chuyen', sql.NVarChar, chuyen || null)
      .input('NguoiNhan', sql.NVarChar, nguoiNhan || null).input('MucDich', sql.NVarChar, mucDich || null)
      .input('GhiChu', sql.NVarChar, ghiChu || null);
    let setDon = '';
    if (coGuiDon) {
      rqUp.input('DonHangID', sql.Int, donHangIdMoi)
        .input('MaDon', sql.NVarChar, donHangIdMoi ? (req.body.maDon || null) : null);
      setDon = ', DonHangID=@DonHangID, MaDon=@MaDon';
    }
    await rqUp.query(`UPDATE PhieuXuatVai SET NgayXuat=@NgayXuat, Chuyen=@Chuyen, NguoiNhan=@NguoiNhan,
                      MucDich=@MucDich, GhiChu=@GhiChu${setDon} WHERE PhieuXuatID=@id`);

    const affectedCayIds = new Set();

    if (Array.isArray(lines)) {
      const oldLinesResult = await pool.request().input('id', sql.Int, id).query('SELECT ID, CayID, KGXuat FROM PhieuXuatVaiChiTiet WHERE PhieuXuatID=@id');
      oldLinesResult.recordset.forEach(r => affectedCayIds.add(r.CayID));

      // 1) Kiem tra TRUOC KHI GHI GI CA: khong cho vuot ton doi voi bat ky dong nao.
      for (const line of lines) {
        const cayId = Number(line.cayId);
        const kgXuat = Number(line.kgXuat) || 0;
        if (!cayId || kgXuat <= 0) continue;
        const cayResult = await pool.request().input('id', sql.Int, cayId).query('SELECT MaCay, KGNhap FROM VaiCay WHERE CayID=@id');
        if (!cayResult.recordset.length) return res.status(400).json({ success: false, message: 'Không tìm thấy cây vải trong dòng sửa (CayID=' + cayId + ').' });
        const { MaCay, KGNhap } = cayResult.recordset[0];
        const otherSum = await pool.request().input('id', sql.Int, cayId).input('pid', sql.Int, id)
          .query('SELECT ISNULL(SUM(KGXuat),0) AS Tong FROM PhieuXuatVaiChiTiet WHERE CayID=@id AND PhieuXuatID<>@pid');
        const otherXuat = Number(otherSum.recordset[0].Tong) || 0;
        const conLai = Math.round((Number(KGNhap) - otherXuat) * 100) / 100;
        if (kgXuat > conLai) {
          return res.status(400).json({ success: false, message: `Cây ${MaCay} chỉ còn ${conLai} KG (chưa tính phiếu này) - không thể xuất ${kgXuat} KG.` });
        }
      }

      // 2) Xoa cac dong bi bo khoi danh sach.
      const sentIds = new Set(lines.filter(l => l.id).map(l => Number(l.id)));
      const toRemove = oldLinesResult.recordset.filter(r => !sentIds.has(r.ID));
      for (const r of toRemove) {
        await pool.request().input('id', sql.Int, r.ID).query('DELETE FROM PhieuXuatVaiChiTiet WHERE ID=@id');
      }

      // 3) Ghi de dong co san / them dong moi.
      for (const line of lines) {
        const cayId = Number(line.cayId);
        const kgXuat = Number(line.kgXuat) || 0;
        /* v5.89: KG KHÔNG còn bắt buộc — xuất theo KG hoặc theo MÉT hoặc cả hai. Dòng chỉ bị bỏ qua
           khi CẢ HAI đều trống/0 (trước đây kgXuat<=0 là bỏ luôn -> dòng khai theo mét biến mất im lặng). */
        const metXuat = Number(line.soMet) || 0;
        if (!cayId || (kgXuat <= 0 && metXuat <= 0)) continue;
        affectedCayIds.add(cayId);
        const kieuVai = line.kieuVai === 'Phối' ? 'Phối' : 'Chính';   // v5.31
        const lineMet = (line.soMet === '' || line.soMet == null) ? null : Number(line.soMet);   // v5.50
        if (line.id) {
          await pool.request().input('id', sql.Int, Number(line.id)).input('CayID', sql.Int, cayId).input('KGXuat', sql.Decimal(10, 2), kgXuat).input('SoMet', sql.Decimal(10, 2), lineMet).input('KieuVai', sql.NVarChar, kieuVai)
            .query('UPDATE PhieuXuatVaiChiTiet SET CayID=@CayID, KGXuat=@KGXuat, SoMet=@SoMet, KieuVai=@KieuVai WHERE ID=@id');
        } else {
          await pool.request().input('PhieuXuatID', sql.Int, id).input('CayID', sql.Int, cayId).input('KGXuat', sql.Decimal(10, 2), kgXuat).input('SoMet', sql.Decimal(10, 2), lineMet).input('KieuVai', sql.NVarChar, kieuVai)
            .query('INSERT INTO PhieuXuatVaiChiTiet (PhieuXuatID, CayID, KGXuat, SoMet, KieuVai) VALUES (@PhieuXuatID, @CayID, @KGXuat, @SoMet, @KieuVai)');
        }
      }
    }

    // v7.36: dung HAM CHUNG (xet ca met) thay vi copy cong thuc — xem utils/tonVai.js
    for (const cayId of affectedCayIds) await capNhatTrangThaiCay(pool, cayId);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Lỗi khi cập nhật phiếu xuất: ' + err.message });
  }
});

// Xoa: xoa phieu (cascade xoa het dong chi tiet - schema da khai bao ON DELETE CASCADE), sau do
// TINH LAI trang thai (Nguyen cay/Cay le/Het) cho tung cay bi anh huong, vi TrangThai la cot LUU
// SAN (khong phai tinh tu view) nen phai tu cap nhat lai, khong tu dong dung theo khi xoa chi tiet.
router.delete('/xuat/:id', requireAuth, requirePermission('KHOVAI', 'delete'), requireChucNang('KHOVAI', 'xuat'), async (req, res) => {
  try {
    const pool = await getPool();
    const id = req.params.id;
    const linesResult = await pool.request().input('id', sql.Int, id).query('SELECT CayID FROM PhieuXuatVaiChiTiet WHERE PhieuXuatID=@id');
    const cayIds = linesResult.recordset.map(r => r.CayID);
    await pool.request().input('id', sql.Int, id).query('DELETE FROM PhieuXuatVai WHERE PhieuXuatID=@id');
    // v7.36: dung HAM CHUNG (xet ca met) thay vi copy cong thuc — xem utils/tonVai.js
    for (const cayId of cayIds) await capNhatTrangThaiCay(pool, cayId);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Lỗi khi xóa phiếu xuất: ' + err.message });
  }
});

// ============ DINH MUC VAI & BAO CAO HAO HUT ============
router.get('/dinhmuc', requireAuth, requirePermission('KHOVAI', 'view'), requireChucNang('KHOVAI', 'dinhmuc'), async (req, res) => {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT dm.*, v.MaVai FROM DinhMucVai dm LEFT JOIN DanhMucVai v ON v.VaiID = dm.VaiID ORDER BY dm.ID DESC`);
  res.json({ success: true, data: result.recordset });
});

router.post('/dinhmuc', requireAuth, requirePermission('KHOVAI', 'create'), requireChucNang('KHOVAI', 'dinhmuc'), async (req, res) => {
  try {
    const pool = await getPool();
    const { mauHang, vaiId, dinhMucKgTrenSp, tyLeHaoHut, ghiChu } = req.body;
    if (!mauHang) return res.status(400).json({ success: false, message: 'Thiếu tên mẫu hàng.' });
    const result = await pool.request()
      .input('MauHang', sql.NVarChar, mauHang)
      .input('VaiID', sql.Int, vaiId || null)
      .input('DinhMucKGTrenSP', sql.Decimal(10, 4), dinhMucKgTrenSp || null)
      .input('TyLeHaoHut', sql.Decimal(5, 2), tyLeHaoHut || null)
      .input('GhiChu', sql.NVarChar, ghiChu || null)
      .query(`INSERT INTO DinhMucVai (MauHang, VaiID, DinhMucKGTrenSP, TyLeHaoHut, GhiChu)
              OUTPUT INSERTED.* VALUES (@MauHang, @VaiID, @DinhMucKGTrenSP, @TyLeHaoHut, @GhiChu)`);
    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Lỗi khi lưu định mức: ' + err.message });
  }
});

router.put('/dinhmuc/:id', requireAuth, requirePermission('KHOVAI', 'edit'), requireChucNang('KHOVAI', 'dinhmuc'), async (req, res) => {
  try {
    const pool = await getPool();
    const { mauHang, vaiId, dinhMucKgTrenSp, tyLeHaoHut, ghiChu } = req.body;
    const result = await pool.request()
      .input('id', sql.Int, req.params.id)
      .input('MauHang', sql.NVarChar, mauHang)
      .input('VaiID', sql.Int, vaiId || null)
      .input('DinhMucKGTrenSP', sql.Decimal(10, 4), dinhMucKgTrenSp || null)
      .input('TyLeHaoHut', sql.Decimal(5, 2), tyLeHaoHut || null)
      .input('GhiChu', sql.NVarChar, ghiChu || null)
      .query(`UPDATE DinhMucVai SET MauHang=@MauHang, VaiID=@VaiID, DinhMucKGTrenSP=@DinhMucKGTrenSP,
              TyLeHaoHut=@TyLeHaoHut, GhiChu=@GhiChu OUTPUT INSERTED.* WHERE ID=@id`);
    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Lỗi khi cập nhật định mức: ' + err.message });
  }
});

router.delete('/dinhmuc/:id', requireAuth, requirePermission('KHOVAI', 'delete'), requireChucNang('KHOVAI', 'dinhmuc'), async (req, res) => {
  const pool = await getPool();
  await pool.request().input('id', sql.Int, req.params.id).query('DELETE FROM DinhMucVai WHERE ID=@id');
  res.json({ success: true });
});

// Bao cao hao hut: so sanh KG vai da cap (xuat qua PhieuXuatVai co lien ket DonHangID) voi KG ly thuyet
// theo dinh muc (Dinh muc KG/SP x SL hoan thanh cua don hang), va so sanh % hao hut thuc te voi % cho phep.
router.get('/haohut', requireAuth, requirePermission('KHOVAI', 'view'), requireChucNang('KHOVAI', 'dinhmuc'), async (req, res) => {
  const pool = await getPool();

  const dinhMucResult = await pool.request().query('SELECT * FROM DinhMucVai');
  const dinhMucMap = {};
  dinhMucResult.recordset.forEach(d => {
    const key = String(d.MauHang || '').trim().toLowerCase();
    if (key) dinhMucMap[key] = d;
  });

  const ordersResult = await pool.request().query(
    'SELECT DonHangID, MaDH, TenSanPham, TongSoLuong, PhanTramHoanThanh FROM DonHangSanXuat'
  );

  const xuatResult = await pool.request().query(`
    SELECT px.DonHangID, ISNULL(SUM(ct.KGXuat), 0) AS TongKGCap
    FROM PhieuXuatVai px
    JOIN PhieuXuatVaiChiTiet ct ON ct.PhieuXuatID = px.PhieuXuatID
    WHERE px.DonHangID IS NOT NULL
    GROUP BY px.DonHangID`);
  const xuatMap = {};
  xuatResult.recordset.forEach(r => { xuatMap[r.DonHangID] = Number(r.TongKGCap) || 0; });

  const rows = [];
  ordersResult.recordset.forEach(o => {
    const dm = dinhMucMap[String(o.TenSanPham || '').trim().toLowerCase()];
    const kgCap = xuatMap[o.DonHangID] || 0;
    if (!dm && !kgCap) return;

    const slHoanThanh = Math.round((Number(o.TongSoLuong) || 0) * (Number(o.PhanTramHoanThanh) || 0) / 100);
    const dinhMucKG = dm ? Number(dm.DinhMucKGTrenSP) || 0 : null;
    const tyLeHaoHutChoPhep = dm ? Number(dm.TyLeHaoHut) || 0 : null;
    const kgLyThuyet = dinhMucKG != null ? Math.round(dinhMucKG * slHoanThanh * 100) / 100 : null;
    const haoHutKG = kgLyThuyet != null ? Math.round((kgCap - kgLyThuyet) * 100) / 100 : null;
    const haoHutPhanTram = (kgLyThuyet && kgLyThuyet > 0) ? Math.round((haoHutKG / kgLyThuyet) * 1000) / 10 : null;

    rows.push({
      maDH: o.MaDH, tenSanPham: o.TenSanPham, slHoanThanh, kgCap,
      dinhMucKG, tyLeHaoHutChoPhep, kgLyThuyet, haoHutKG, haoHutPhanTram,
      vuotDinhMuc: haoHutPhanTram != null && tyLeHaoHutChoPhep != null && haoHutPhanTram > tyLeHaoHutChoPhep
    });
  });
  res.json({ success: true, data: rows });
});

// ============ KIEM KE KHO VAI ============
router.get('/kiemke', requireAuth, requirePermission('KHOVAI', 'view'), requireChucNang('KHOVAI', 'kiemke'), async (req, res) => {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT kk.ID, kk.NgayKiem, kk.KGHeThong, kk.KGThucTe, (kk.KGThucTe - kk.KGHeThong) AS ChenhLech,
           kk.GhiChu, vc.MaCay, dv.MaVai, u.HoTen AS NguoiKiem
    FROM KiemKeVai kk
    JOIN VaiCay vc ON vc.CayID = kk.CayID
    JOIN DanhMucVai dv ON dv.VaiID = vc.VaiID
    LEFT JOIN Users u ON u.UserID = kk.NguoiKiemID
    ORDER BY kk.NgayKiem DESC, kk.ID DESC`);
  res.json({ success: true, data: result.recordset });
});

router.post('/kiemke', requireAuth, requirePermission('KHOVAI', 'create'), requireChucNang('KHOVAI', 'kiemke'), async (req, res) => {
  try {
    const user = req.session.user;
    const { ngayKiem, items } = req.body;
    if (!ngayKiem || !Array.isArray(items) || !items.length) {
      return res.status(400).json({ success: false, message: 'Thiếu ngày kiểm hoặc danh sách cây vải.' });
    }
    const pool = await getPool();
    const created = [];
    for (const item of items) {
      const tonResult = await pool.request().input('id', sql.Int, item.cayId).query('SELECT KGCon FROM vw_TonCayVai WHERE CayID=@id');
      const kgHeThong = tonResult.recordset.length ? Number(tonResult.recordset[0].KGCon) : 0;
      const kgThucTe = Number(item.kgThucTe) || 0;

      await pool.request()
        .input('NgayKiem', sql.Date, ngayKiem)
        .input('CayID', sql.Int, item.cayId)
        .input('KGHeThong', sql.Decimal(10, 2), kgHeThong)
        .input('KGThucTe', sql.Decimal(10, 2), kgThucTe)
        .input('NguoiKiemID', sql.Int, user.userId)
        .input('GhiChu', sql.NVarChar, item.ghiChu || null)
        .query(`INSERT INTO KiemKeVai (NgayKiem, CayID, KGHeThong, KGThucTe, NguoiKiemID, GhiChu)
                VALUES (@NgayKiem, @CayID, @KGHeThong, @KGThucTe, @NguoiKiemID, @GhiChu)`);
      created.push({ cayId: item.cayId, kgHeThong, kgThucTe, chenhLech: Math.round((kgThucTe - kgHeThong) * 100) / 100 });
    }
    res.json({ success: true, data: created });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Lỗi khi lưu kiểm kê: ' + err.message });
  }
});

// ============ MÁY IN TEM QUA MẠNG (v5.45) ============
// Cấu hình lưu 1 dòng JSON trong bảng CauHinh, khóa 'MAY_IN_TEM'. In = mở socket raw tới IP:cổng (9100),
// gửi lệnh TSPL (TSC/Godex/Xprinter) hoặc ZPL (Zebra). Chữ tem bỏ dấu tiếng Việt (máy in tem thường
// không có sẵn font Unicode) để in rõ; mã cây vốn không dấu nên QR/scan không ảnh hưởng.
const PRINTER_KEY = 'MAY_IN_TEM';
const PRINTER_DEFAULT = { ip: '', port: 9100, kho: 'doc', loaiLenh: 'TSPL', dpi: 203, enabled: false };

async function getPrinterConfig(pool) {
  const row = (await pool.request().input('k', sql.NVarChar, PRINTER_KEY).query('SELECT GiaTri FROM CauHinh WHERE Khoa=@k')).recordset[0];
  let cfg = Object.assign({}, PRINTER_DEFAULT);
  if (row && row.GiaTri) { try { cfg = Object.assign(cfg, JSON.parse(row.GiaTri)); } catch (e) { /* giữ mặc định */ } }
  return cfg;
}

function stripDiacritics(s) {
  return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
}
function ngayVN(d) { return d ? new Date(d).toLocaleDateString('en-GB') : ''; }
function temLines(r) {
  const l = [];
  l.push('Kho: ' + (r.KhoVai != null && r.KhoVai !== '' ? r.KhoVai + ' cm' : '-'));
  l.push('KG: ' + (r.KGNhap != null ? r.KGNhap : ''));
  l.push('Ngay: ' + ngayVN(r.NgayNhap));
  return l;
}
function mm2dots(mm, dpi) { return Math.round(mm * (dpi || 203) / 25.4); }
function tsplTxt(s) { return stripDiacritics(s).replace(/"/g, "'").replace(/[\r\n]+/g, ' ').trim(); }
function zplTxt(s) { return stripDiacritics(s).replace(/[\^~]/g, '-').replace(/[\r\n]+/g, ' ').trim(); }
// Ước lượng số ô/cạnh của QR (mode byte, ECC=H) theo độ dài chuỗi để canh QR ~kích thước mong muốn.
function qrModulesForBytes(len) {
  const capH = [7, 14, 24, 34, 44, 58, 64, 84, 98, 119, 137, 155, 177, 194, 220, 250, 280, 310, 338, 382];
  let v = capH.length;
  for (let i = 0; i < capH.length; i++) { if (len <= capH[i]) { v = i + 1; break; } }
  return 17 + 4 * v;   // số ô mỗi cạnh
}

// v5.45.4: bố cục tem GIỐNG bản trình duyệt (temdung) — QR TO, mã cây + thông tin chữ TO, tràn đầy khổ A6.
//   Dọc: QR căn giữa phía trên, chữ căn giữa xếp bên dưới. Ngang: QR bên trái, chữ bên phải.
//   Toạ độ tính theo dpi (mm→dots) để đúng kích thước; QR magnification lớn (không còn nhỏ xíu ở góc).
function buildTspl(rows, kho, dpi) {
  dpi = dpi || 203;
  const ngang = kho === 'ngang';
  const wmm = ngang ? 148 : 105, hmm = ngang ? 105 : 148;
  const W = mm2dots(wmm, dpi), H = mm2dots(hmm, dpi), m = mm2dots(4, dpi);
  // v5.45.5: DÙNG LỆNH TEXT (font in sẵn) thay cho BLOCK — BLOCK gây "font lỗi" trên máy in này.
  const xMa = Math.max(2, Math.round(2 * dpi / 203));      // hệ số phóng chữ mã cây (font "3")
  const xInfo = Math.max(1, Math.round(1 * dpi / 203));    // hệ số phóng chữ thông tin
  const chW = 16;                                          // bề rộng ~1 ký tự font "3" (dots) trước khi nhân
  const lhMa = mm2dots(8, dpi), lhInfo = mm2dots(6, dpi);
  const targetMm = Math.min(100, (ngang ? hmm : wmm) - 6); // QR ~100mm (chừa lề)
  let out = '';
  for (const r of rows) {
    const ma = tsplTxt(r.MaCay);
    const l2 = tsplTxt((r.TenLoaiVai || '') + ' - ' + (r.TenMau || ''));
    const info = temLines(r).map(tsplTxt);
    const modules = qrModulesForBytes(ma.length);
    const cell = Math.max(2, Math.round(mm2dots(targetMm, dpi) / modules));  // canh QR ~targetMm
    const qrPx = modules * cell;
    out += `SIZE ${wmm} mm,${hmm} mm\r\nGAP 2 mm,0 mm\r\nDIRECTION 1\r\nCLS\r\n`;
    if (!ngang) {
      const qrX = Math.max(m, Math.round((W - qrPx) / 2)), qrY = m;
      const cx = (txt, xm) => Math.max(m, Math.round((W - txt.length * chW * xm) / 2));  // canh giữa gần đúng
      let y = qrY + qrPx + mm2dots(3, dpi);
      out += `QRCODE ${qrX},${qrY},H,${cell},A,0,"${ma}"\r\n`;
      out += `TEXT ${cx(ma, xMa)},${y},"3",0,${xMa},${xMa},"${ma}"\r\n`; y += lhMa;
      out += `TEXT ${cx(l2, xInfo)},${y},"3",0,${xInfo},${xInfo},"${l2}"\r\n`; y += lhInfo;
      for (const line of info) { out += `TEXT ${cx(line, xInfo)},${y},"3",0,${xInfo},${xInfo},"${line}"\r\n`; y += lhInfo; }
    } else {
      const qrX = m, qrY = Math.max(m, Math.round((H - qrPx) / 2));
      const tx = qrX + qrPx + mm2dots(4, dpi);
      let y = qrY;
      out += `QRCODE ${qrX},${qrY},H,${cell},A,0,"${ma}"\r\n`;
      out += `TEXT ${tx},${y},"3",0,${xMa},${xMa},"${ma}"\r\n`; y += lhMa;
      out += `TEXT ${tx},${y},"3",0,${xInfo},${xInfo},"${l2}"\r\n`; y += lhInfo;
      for (const line of info) { out += `TEXT ${tx},${y},"3",0,${xInfo},${xInfo},"${line}"\r\n`; y += lhInfo; }
    }
    out += `PRINT 1,1\r\n`;
  }
  return out;
}
function buildZpl(rows, kho, dpi) {
  dpi = dpi || 203;
  const ngang = kho === 'ngang';
  const W = mm2dots(ngang ? 148 : 105, dpi), H = mm2dots(ngang ? 105 : 148, dpi), m = mm2dots(5, dpi);
  const mag = 10;                                          // ^BQ magnification tối đa = 10
  const qrPx = 29 * mag;
  const hMa = mm2dots(9, dpi), hInfo = mm2dots(6, dpi);
  let out = '';
  for (const r of rows) {
    const ma = zplTxt(r.MaCay);
    const l2 = zplTxt((r.TenLoaiVai || '') + ' - ' + (r.TenMau || ''));
    const info = temLines(r).map(zplTxt);
    out += `^XA\r\n^PW${W}\r\n^LL${H}\r\n`;
    if (!ngang) {
      const qrY = m, qrX = Math.max(m, Math.round((W - qrPx) / 2));
      let y = qrY + qrPx + mm2dots(5, dpi);
      out += `^FO${qrX},${qrY}^BQN,2,${mag}^FDLA,${ma}^FS\r\n`;
      out += `^FO${m},${y}^A0N,${hMa},${hMa}^FB${W - m * 2},1,0,C,0^FD${ma}^FS\r\n`; y += mm2dots(12, dpi);
      out += `^FO${m},${y}^A0N,${hInfo},${hInfo}^FB${W - m * 2},1,0,C,0^FD${l2}^FS\r\n`; y += mm2dots(8, dpi);
      for (const line of info) { out += `^FO${m},${y}^A0N,${hInfo},${hInfo}^FB${W - m * 2},1,0,C,0^FD${line}^FS\r\n`; y += mm2dots(7, dpi); }
    } else {
      const qrY = Math.max(m, Math.round((H - qrPx) / 2)), qrX = m;
      const tx = qrX + qrPx + mm2dots(5, dpi), tw = W - tx - m;
      let y = qrY;
      out += `^FO${qrX},${qrY}^BQN,2,${mag}^FDLA,${ma}^FS\r\n`;
      out += `^FO${tx},${y}^A0N,${hMa},${hMa}^FB${tw},1,0,L,0^FD${ma}^FS\r\n`; y += mm2dots(12, dpi);
      out += `^FO${tx},${y}^A0N,${hInfo},${hInfo}^FB${tw},1,0,L,0^FD${l2}^FS\r\n`; y += mm2dots(8, dpi);
      for (const line of info) { out += `^FO${tx},${y}^A0N,${hInfo},${hInfo}^FB${tw},1,0,L,0^FD${line}^FS\r\n`; y += mm2dots(7, dpi); }
    }
    out += `^XZ\r\n`;
  }
  return out;
}
function sendToPrinter(ip, port, data) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let settled = false;
    const done = (err) => { if (settled) return; settled = true; socket.removeAllListeners(); try { socket.destroy(); } catch (e) {} err ? reject(err) : resolve(); };
    socket.setTimeout(8000);
    socket.once('timeout', () => done(new Error(`Hết thời gian kết nối máy in ${ip}:${port}. Kiểm tra: máy in đã BẬT, đúng IP/cổng (thường 9100), và MÁY CHỦ (nơi chạy phần mềm) cùng mạng LAN với máy in.`)));
    socket.once('error', (e) => done(new Error(`Không kết nối được máy in ${ip}:${port}: ${e.code || e.message}.`)));
    socket.connect(port, ip, () => {
      socket.write(Buffer.from(data, 'binary'), (err) => {
        if (err) return done(err);
        setTimeout(() => done(null), 400);   // đã gửi xong lệnh; chờ chút cho máy in nhận rồi mới đóng
      });
    });
  });
}
// Chỉ THỬ KẾT NỐI (không in) để chẩn đoán mạng/IP/cổng.
function testPrinter(ip, port) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let settled = false;
    const done = (err) => { if (settled) return; settled = true; socket.removeAllListeners(); try { socket.destroy(); } catch (e) {} err ? reject(err) : resolve(); };
    socket.setTimeout(6000);
    socket.once('timeout', () => done(new Error(`Không phản hồi (timeout) từ ${ip}:${port}. Máy in có thể chưa bật, sai IP/cổng, hoặc khác mạng LAN với máy chủ.`)));
    socket.once('error', (e) => done(new Error(`Lỗi ${e.code || e.message} khi kết nối ${ip}:${port}.`)));
    socket.connect(port, ip, () => done(null));   // kết nối được TCP là OK
  });
}

// ============ v5.45.7: RENDER TEM THÀNH ẢNH (QR + chữ TIẾNG VIỆT CÓ DẤU) ============
// Máy in tem không có font tiếng Việt sẵn -> vẽ cả tem thành ảnh 1bpp rồi gửi máy in in đồ hoạ
// (TSPL BITMAP / ZPL ^GFA). Nhờ vậy TSPL và ZPL in RA GIỐNG HỆT, phông đẹp, đủ dấu, QR to.
// Cần: npm install qrcode pureimage; font .ttf có tiếng Việt (mặc định C:\Windows\Fonts\arial.ttf).
let _PImage = null, _QR = null, _fontReady = false;
const _FONT_FAMILY = 'TemVN';
function ensureImageLibs() {
  if (!_PImage || !_QR) {
    try { _PImage = require('pureimage'); _QR = require('qrcode'); }
    catch (e) { throw new Error('Chưa cài thư viện in tem ảnh. Vào thư mục backend chạy:  npm install qrcode pureimage  → rồi pm2 restart qlnoibo.'); }
  }
  if (!_fontReady) {
    const fp = process.env.TEM_FONT_PATH || 'C:\\Windows\\Fonts\\arial.ttf';
    if (!fs.existsSync(fp)) throw new Error('Không tìm thấy font "' + fp + '". Đặt biến môi trường TEM_FONT_PATH trỏ tới 1 file .ttf có tiếng Việt.');
    const f = _PImage.registerFont(fp, _FONT_FAMILY);
    if (typeof f.loadSync === 'function') f.loadSync(); else f.load(() => {});
    _fontReady = true;
  }
}
/* v5.75: KHỚP ĐÚNG với tem in từ trình duyệt (printTemHangLoat trong module.khovai.js):
   - BỎ HẲN dòng trống (trước in "Khổ vải: -", "Số mét: -" trong khi bản máy tính không in dòng đó).
   - Chữ "Ngày nhập:" (trước ghi "Ngày:").
   Thứ tự và nội dung 2 bản tem từ nay phải luôn giống nhau — sửa bên nào thì sửa cả bên kia. */
function temInfoVN(r) {
  const kho = (r.KhoVai != null && r.KhoVai !== '') ? r.KhoVai : r.KhoVaiThucTe;
  const ds = [];
  if (kho != null && kho !== '') ds.push('Khổ vải: ' + kho + ' cm');
  if (r.KGNhap != null && r.KGNhap !== '') ds.push('KG nhập: ' + r.KGNhap);
  if (r.SoMet != null && r.SoMet !== '') ds.push('Số mét: ' + r.SoMet);
  ds.push('Ngày nhập: ' + ngayVN(r.NgayNhap));
  return ds;
}
// Vẽ tem -> bitmap 1bpp (đen=1). Trả { W, H, rowBytes, bits(Buffer) }.
async function renderTemBitmap(r, kho, dpi) {
  ensureImageLibs();
  dpi = dpi || 203;
  const ngang = kho === 'ngang';
  const wmm = ngang ? 148 : 105, hmm = ngang ? 105 : 148, dpmm = dpi / 25.4;
  let W = Math.round(wmm * dpmm); W = Math.ceil(W / 8) * 8;   // byte-align chiều rộng
  const H = Math.round(hmm * dpmm);
  const img = _PImage.make(W, H);
  const ctx = img.getContext('2d');
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#000000';
  // QR (to, căn giữa phía trên)
  /* v5.73: QR mang thêm khổ vải / KG / số mét (dạng key=value ASCII) để quét vào phiếu NHẬP là điền
     được ngay. KHÔNG nhét Loại vải/Màu (có dấu tiếng Việt — máy quét cầm tay hay gõ sai dấu); hai
     trường đó máy chủ suy ra từ tiền tố mã cây, xem GET /api/khovai/tracuu-macay. */
  const _kho = (r.KhoVai != null && r.KhoVai !== '') ? r.KhoVai : r.KhoVaiThucTe;
  const _p = ['MaCay=' + String(r.MaCay || '')];
  if (_kho != null && _kho !== '') _p.push('Kho=' + _kho);
  if (r.KGNhap != null && r.KGNhap !== '') _p.push('KG=' + r.KGNhap);
  if (r.SoMet != null && r.SoMet !== '') _p.push('Met=' + r.SoMet);
  const qr = _QR.create(_p.join(';') || ' ', { errorCorrectionLevel: 'H' });
  const n = qr.modules.size, md = qr.modules.data;
  const targetPx = Math.round(37 * dpmm);   // v5.51: 74mm -> v5.74: GIẢM 50% còn 37mm (khớp tem in từ trình duyệt)
  const cell = Math.max(1, Math.floor(targetPx / n));
  const qrSize = cell * n;
  const qrX = Math.max(0, Math.round((W - qrSize) / 2)), qrY = Math.round(4 * dpmm);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (md[y * n + x]) ctx.fillRect(qrX + x * cell, qrY + y * cell, cell, cell);
  }
  /* Chữ (CÓ DẤU), căn giữa, xếp dưới QR.
     v5.75 — SỬA LỖI MẤT CHỮ (mã cây bị cắt mất ký tự cuối):
       (1) `ctx.measureText` của pureimage KHÔNG đáng tin — có lúc trả về nhỏ hơn bề rộng thật, có lúc
           ném lỗi (khi đó code cũ để tw = 0 → điều kiện `tw > 0` sai → BỎ QUA bước thu nhỏ, đồng thời
           căn giữa theo tw = 0 nên chữ chạy từ giữa tem ra ngoài lề). Nay lấy bề rộng = GIÁ TRỊ LỚN HƠN
           giữa measureText và ước lượng theo số ký tự (0.62 × cỡ chữ — chữ IN HOA + số của mã cây là
           rộng nhất), rồi thu nhỏ LẶP tới khi vừa khổ.
       (2) Cỡ chữ hạ cho khớp bản in trình duyệt: mã cây 7mm → 5.6mm (≈16pt), dòng phụ 4.6mm → 3.6mm
           (≈10pt). Trước đây bản in mạng chữ to hơn hẳn nên 2 tem trông khác nhau. */
  const lines = [{ t: String(r.MaCay || ''), mm: 5.6 },
    { t: (r.TenLoaiVai || '') + ' - ' + (r.TenMau || ''), mm: 3.6 }];
  for (const s of temInfoVN(r)) lines.push({ t: s, mm: 3.6 });
  const maxW = W - Math.round(6 * dpmm);            // chừa 3mm mỗi bên
  const beRong = (t, px) => {
    let d = 0;
    try { d = ctx.measureText(t).width || 0; } catch (e) { d = 0; }
    return Math.max(d, String(t).length * px * 0.62);   // luôn lấy mức RỘNG HƠN cho an toàn
  };
  let y = qrY + qrSize + Math.round(5 * dpmm);
  for (const ln of lines) {
    if (!String(ln.t || '').trim()) continue;
    let px = Math.max(9, Math.round(ln.mm * dpmm));
    ctx.font = `${px}px ${_FONT_FAMILY}`;
    let tw = beRong(ln.t, px);
    let vong = 0;
    while (tw > maxW && px > 9 && vong++ < 8) {      // thu nhỏ LẶP tới khi thật sự vừa khổ
      px = Math.max(9, Math.floor(px * maxW / tw));
      ctx.font = `${px}px ${_FONT_FAMILY}`;
      tw = beRong(ln.t, px);
    }
    y += px;
    if (y > H) break;
    ctx.fillText(ln.t, Math.max(2, Math.round((W - tw) / 2)), y);
    y += Math.round(px * 0.35);
  }
  // Đóng gói 1bpp, đen=1 (ngưỡng sáng < 128)
  const rowBytes = W / 8;
  const bits = Buffer.alloc(rowBytes * H, 0);
  const data = img.data;
  for (let yy = 0; yy < H; yy++) {
    const off = yy * rowBytes;
    for (let xx = 0; xx < W; xx++) {
      const i = (yy * W + xx) * 4;
      if ((data[i] + data[i + 1] + data[i + 2]) / 3 < 128) bits[off + (xx >> 3)] |= (0x80 >> (xx & 7));
    }
  }
  return { W, H, rowBytes, bits };
}
async function buildTsplImage(rows, kho, dpi) {
  const wmm = kho === 'ngang' ? 148 : 105, hmm = kho === 'ngang' ? 105 : 148;
  let out = '';
  for (const r of rows) {
    const b = await renderTemBitmap(r, kho, dpi);
    const inv = Buffer.alloc(b.bits.length);
    for (let i = 0; i < b.bits.length; i++) inv[i] = (~b.bits[i]) & 0xFF;   // TSPL BITMAP: bit 0 = đen
    out += `SIZE ${wmm} mm,${hmm} mm\r\nGAP 2 mm,0 mm\r\nDIRECTION 1\r\nCLS\r\n`;
    out += `BITMAP 0,0,${b.rowBytes},${b.H},0,` + inv.toString('binary') + '\r\n';
    out += 'PRINT 1,1\r\n';
  }
  return out;
}
function buildZplImage(rows, kho, dpi) {
  return (async () => {
    let out = '';
    for (const r of rows) {
      const b = await renderTemBitmap(r, kho, dpi);
      const total = b.rowBytes * b.H;
      let hex = '';
      for (let i = 0; i < b.bits.length; i++) hex += b.bits[i].toString(16).padStart(2, '0');   // ZPL ^GF: bit 1 = đen
      out += `^XA\r\n^FO0,0^GFA,${total},${total},${b.rowBytes},${hex}^FS\r\n^XZ\r\n`;
    }
    return out;
  })();
}

router.get('/printer-config', requireAuth, requirePermission('KHOVAI', 'view'), async (req, res) => {
  try { res.json({ success: true, data: await getPrinterConfig(await getPool()) }); }
  catch (err) { console.error(err); res.status(400).json({ success: false, message: err.message }); }
});
router.post('/printer-config', requireAuth, requirePermission('KHOVAI', 'edit'), async (req, res) => {
  try {
    const { ip, port, kho, loaiLenh, dpi, enabled } = req.body;
    const cfg = {
      ip: (ip || '').trim(), port: Number(port) || 9100,
      kho: kho === 'ngang' ? 'ngang' : 'doc',
      loaiLenh: ['TSPL', 'ZPL'].includes(loaiLenh) ? loaiLenh : 'TSPL',
      dpi: Number(dpi) === 300 ? 300 : 203,
      enabled: !!enabled
    };
    const pool = await getPool();
    const val = JSON.stringify(cfg);
    const exist = (await pool.request().input('k', sql.NVarChar, PRINTER_KEY).query('SELECT 1 AS x FROM CauHinh WHERE Khoa=@k')).recordset[0];
    if (exist) await pool.request().input('k', sql.NVarChar, PRINTER_KEY).input('v', sql.NVarChar, val).query('UPDATE CauHinh SET GiaTri=@v, UpdatedAt=SYSDATETIME() WHERE Khoa=@k');
    else await pool.request().input('k', sql.NVarChar, PRINTER_KEY).input('v', sql.NVarChar, val).query('INSERT INTO CauHinh (Khoa, GiaTri, UpdatedAt) VALUES (@k, @v, SYSDATETIME())');
    res.json({ success: true, data: cfg });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: err.message }); }
});
router.post('/print-tem', requireAuth, requirePermission('KHOVAI', 'edit'), async (req, res) => {
  try {
    const maCays = Array.isArray(req.body.maCays) ? req.body.maCays.filter(Boolean) : [];
    if (!maCays.length) return res.status(400).json({ success: false, message: 'Chưa chọn cây vải để in.' });
    const pool = await getPool();
    const cfg = await getPrinterConfig(pool);
    if (!cfg.enabled) return res.status(400).json({ success: false, message: 'Chưa bật in qua máy in mạng (vào "Cài đặt máy in mạng").' });
    if (!cfg.ip) return res.status(400).json({ success: false, message: 'Chưa cấu hình IP máy in (vào "Cài đặt máy in mạng").' });
    const rows = [];
    for (const ma of maCays) {
      const r = (await pool.request().input('m', sql.NVarChar, ma).query('SELECT TOP 1 * FROM vw_TonCayVai WHERE MaCay=@m')).recordset[0];
      if (r) rows.push(r);
    }
    if (!rows.length) return res.status(404).json({ success: false, message: 'Không tìm thấy cây vải để in.' });
    // v5.45.7: render tem thành ẢNH (có dấu, đẹp, TSPL=ZPL) rồi gửi máy in in đồ hoạ.
    const data = cfg.loaiLenh === 'ZPL' ? await buildZplImage(rows, cfg.kho, cfg.dpi) : await buildTsplImage(rows, cfg.kho, cfg.dpi);
    await sendToPrinter(cfg.ip, cfg.port, data);
    res.json({ success: true, data: { printed: rows.length } });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: err.message }); }
});
// v5.45.6: thử kết nối máy in (dùng IP/cổng người dùng đang nhập, nếu trống thì lấy cấu hình đã lưu).
router.post('/printer-test', requireAuth, requirePermission('KHOVAI', 'edit'), async (req, res) => {
  try {
    let ip = (req.body.ip || '').trim(), port = Number(req.body.port) || 9100;
    if (!ip) { const cfg = await getPrinterConfig(await getPool()); ip = cfg.ip; port = cfg.port; }
    if (!ip) return res.status(400).json({ success: false, message: 'Chưa nhập IP máy in.' });
    await testPrinter(ip, port);
    res.json({ success: true, message: `Kết nối được máy in ${ip}:${port}. Nếu vẫn không ra tem thì do LỆNH IN — thử đổi Loại lệnh (TSPL/ZPL).` });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

module.exports = router;
