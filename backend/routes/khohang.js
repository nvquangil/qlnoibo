const express = require('express');
const ExcelJS = require('exceljs'); // v5.17 (muc 1.2): xuat Excel "Báo giá Aloha" co dinh dang (font/border/merge) - xem migration_v517.sql
const sharp = require('sharp'); // v5.18 (muc 2.1.2): chuan hoa MOI dinh dang anh dai dien ve PNG truoc khi nhung vao Excel
const path = require('path'); // v5.18.1: doc file anh dai dien tu dia (xem anhToPngBuffer/UPLOAD_DIR ben duoi)
const fs = require('fs');
const bcrypt = require('bcryptjs');   // v5.63: băm mật khẩu TÀI KHOẢN KHÁCH (đặt hàng trên web công khai)
const { sql, getPool } = require('../db');
const { requireAuth, requirePermission, requireChucNang } = require('../middleware/auth');
// v6.23: TỒN KHẢ DỤNG = tồn kho − hàng đang giữ cho đơn khách đặt. Định nghĩa nằm ở routes/banhang.js
// (nơi giữ luồng bán hàng) để CHỈ CÓ 1 chỗ tính — đừng viết lại công thức này ở file khác.
const { layHangDangGiu } = require('./banhang');

const router = express.Router();

/* ================================================================================================
   v5.64.1 — LƯỚI AN TOÀN CHO HANDLER ASYNC (bắt buộc, đừng gỡ).
   Express 4 KHÔNG bắt lỗi handler `async`: 1 câu SQL lỗi mà route không try/catch thì KHÔNG có phản
   hồi nào -> request treo -> giao diện trắng + "Máy chủ không phản hồi sau 30 giây".
   Đây đúng là lỗi vừa xảy ra ở GET /api/khohang/orders. Đoạn dưới bọc MỌI route trong file này để
   lỗi luôn được trả về dạng JSON kèm nguyên văn thông báo SQL (dễ chẩn đoán ngay trên màn hình).
   Xem thêm ghi chú cùng loại ở backend/routes/tailieukythuat.js.
   ================================================================================================ */
['get', 'post', 'put', 'delete'].forEach(method => {
  const original = router[method].bind(router);
  router[method] = function (path, ...handlers) {
    return original(path, ...handlers.map(h => {
      if (typeof h !== 'function' || h.length > 3) return h;
      return function (req, res, next) {
        try {
          const out = h(req, res, next);
          if (out && typeof out.catch === 'function') out.catch(next);
          return out;
        } catch (e) { next(e); }
      };
    }));
  };
});

// ============ DANH MUC CHO FORM ============
router.get('/danhmuc', requireAuth, requirePermission('KHOHANG', 'view'), async (req, res) => {
  const pool = await getPool();
  const [theKho, mauSac, nhomSanPham] = await Promise.all([
    pool.request().query('SELECT * FROM TheKhoDanhMuc ORDER BY TenTheKho'),
    pool.request().query('SELECT * FROM MauSac ORDER BY TenMau'),
    // v5.4: danh muc "Loai hang" (nhom san pham) - dung cho dropdown moi trong form The kho hang hoa.
    pool.request().query('SELECT * FROM DanhMucNhomSanPham ORDER BY TenNhom')
  ]);
  res.json({ success: true, data: { theKhoDanhMuc: theKho.recordset, mauSac: mauSac.recordset, nhomSanPham: nhomSanPham.recordset } });
});

// ============ DON HANG SAN XUAT (goi y khi tao The kho loai Nha san xuat) ============
// v5.4: chi liet ke don hang DA CO tien do o cong doan "Kho nhập" (moi co du lieu de goi y so nhap -
// xem getSoNhapTheoMau) VA CHUA duoc gan voi the kho nao (danh sach nay dung de chon khi TAO MOI - don
// da co the kho roi thi khong con can/duoc tao them, tranh tao trung). Di kem voi viec bo tu dong tao
// The kho o qlsx.js (xem comment tai POST /orders/:maDH/tiendo) - tao the kho gio la thao tac tuong minh.
router.get('/donhang', requireAuth, requirePermission('KHOHANG', 'view'), requireChucNang('KHOHANG', 'items'), async (req, res) => {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT d.DonHangID, d.MaDH, d.TenSanPham
    FROM DonHangSanXuat d
    WHERE EXISTS (
      SELECT 1 FROM TienDoSanXuat td
      JOIN CongDoanSanXuat cd ON cd.StageID = td.StageID
      WHERE td.DonHangID = d.DonHangID AND cd.MaCongDoan = N'KN'
    )
    AND NOT EXISTS (SELECT 1 FROM TheKhoHangHoa h WHERE h.DonHangID = d.DonHangID)
    ORDER BY d.DonHangID DESC`);
  res.json({ success: true, data: result.recordset });
});

// Sinh ma hang duy nhat tu 1 ma goc: neu ma goc da ton tai trong TheKhoHangHoa.MaHang thi them dan
// hau to -2, -3... cho toi khi khong trung. Dung khi goi y ma hang cho The kho loai Nha san xuat.
async function generateUniqueMaHang(pool, baseCode) {
  const base = String(baseCode || '').trim();
  let candidate = base;
  let suffix = 2;
  while (true) {
    const check = await pool.request().input('m', sql.NVarChar, candidate).query('SELECT MaHangID FROM TheKhoHangHoa WHERE MaHang=@m');
    if (!check.recordset.length) return candidate;
    candidate = base + '-' + suffix;
    suffix++;
  }
}

// v5.0: so luong da ghi nhan o cong doan "Cat" (so cat), theo TUNG mau - dung de dien san, KHONG cho
// sua, truong "So cat" khi tao The kho loai Nha san xuat (xem yeu cau muc 4a). Giong het logic
// getStageActualQtyByColor() ben qlsx.js nhung khai bao rieng o day de khong phai sua module.exports
// cua qlsx.js (tranh anh huong cac cho khac dang dung file do).
async function getSoCatTheoMau(pool, donHangId) {
  // v5.9: doi tu TenCongDoan=N'Cắt' sang MaCongDoan=N'CAT' (ma on dinh, xem migration_v59.sql) - doi ten
  // "Cắt" trong Danh muc tu sau khi nang cap nay se khong con lam ham nay tra ve rong nua.
  const stageResult = await pool.request().query("SELECT TOP 1 StageID FROM CongDoanSanXuat WHERE MaCongDoan=N'CAT'");
  if (!stageResult.recordset.length) return {};
  const stageId = stageResult.recordset[0].StageID;
  const latest = await pool.request().input('id', sql.Int, donHangId).input('stage', sql.Int, stageId)
    .query('SELECT TOP 1 TienDoID FROM TienDoSanXuat WHERE DonHangID=@id AND StageID=@stage ORDER BY TienDoID DESC');
  if (!latest.recordset.length) return {};
  const result = await pool.request().input('td', sql.Int, latest.recordset[0].TienDoID)
    .query('SELECT MauSacID, SoLuongLuyKe FROM TienDoChiTietMau WHERE TienDoID=@td');
  const map = {};
  result.recordset.forEach(r => { map[r.MauSacID] = Number(r.SoLuongLuyKe) || 0; });
  return map;
}

// v5.4: tuong tu ham tren nhung lay so luong da ghi nhan o cong doan "Kho nhập" (so nhap), theo TUNG
// mau - dung de dien san, KHONG cho sua, truong "So nhap" khi tao The kho moi (muc 1 yeu cau v5.4:
// "Hiển thị số lượng sổ cắt, số lượng nhập, không được sửa các trường này").
async function getSoNhapTheoMau(pool, donHangId) {
  // v5.9: doi tu TenCongDoan=N'Kho nhập' sang MaCongDoan=N'KN' (ma on dinh, xem migration_v59.sql).
  const stageResult = await pool.request().query("SELECT TOP 1 StageID FROM CongDoanSanXuat WHERE MaCongDoan=N'KN'");
  if (!stageResult.recordset.length) return {};
  const stageId = stageResult.recordset[0].StageID;
  const latest = await pool.request().input('id', sql.Int, donHangId).input('stage', sql.Int, stageId)
    .query('SELECT TOP 1 TienDoID FROM TienDoSanXuat WHERE DonHangID=@id AND StageID=@stage ORDER BY TienDoID DESC');
  if (!latest.recordset.length) return {};
  const result = await pool.request().input('td', sql.Int, latest.recordset[0].TienDoID)
    .query('SELECT MauSacID, SoLuongLuyKe FROM TienDoChiTietMau WHERE TienDoID=@td');
  const map = {};
  result.recordset.forEach(r => { map[r.MauSacID] = Number(r.SoLuongLuyKe) || 0; });
  return map;
}

// Goi y tao The kho tu 1 don hang san xuat: ten hang = TenSanPham, ma hang = tu MaRap moi nhat cua
// don hang (hoac MaDH neu chua co MaRap) sinh duy nhat, mau chinh = cac mau Kieu='Chinh' trong don hang.
router.get('/donhang/:donHangId/goiy', requireAuth, requirePermission('KHOHANG', 'view'), requireChucNang('KHOHANG', 'items'), async (req, res) => {
  try {
    const pool = await getPool();
    const donHangId = req.params.donHangId;

    const dhResult = await pool.request().input('id', sql.Int, donHangId)
      .query('SELECT DonHangID, MaDH, TenSanPham FROM DonHangSanXuat WHERE DonHangID=@id');
    if (!dhResult.recordset.length) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng sản xuất.' });
    const donHang = dhResult.recordset[0];

    const rapResult = await pool.request().input('id', sql.Int, donHangId).query(`
      SELECT TOP 1 MaRap FROM TienDoSanXuat WHERE DonHangID=@id AND MaRap IS NOT NULL ORDER BY TienDoID DESC`);
    const baseCode = (rapResult.recordset.length && rapResult.recordset[0].MaRap) ? rapResult.recordset[0].MaRap : donHang.MaDH;
    const maHangGoiY = await generateUniqueMaHang(pool, baseCode);

    const mauChinhResult = await pool.request().input('id', sql.Int, donHangId).query(`
      SELECT DISTINCT ms.MauSacID, ms.TenMau FROM DonHangChiTietVai ct
      JOIN MauSac ms ON ms.MauSacID = ct.MauSacID
      WHERE ct.DonHangID=@id AND ct.Kieu=N'Chính'`);
    const soCatTheoMau = await getSoCatTheoMau(pool, donHangId);
    const soNhapTheoMau = await getSoNhapTheoMau(pool, donHangId);

    res.json({
      success: true,
      data: { tenHangGoiY: donHang.TenSanPham, maHangGoiY, mauChinh: mauChinhResult.recordset, soCatTheoMau, soNhapTheoMau }
    });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Lỗi khi lấy gợi ý từ đơn hàng: ' + err.message });
  }
});

// ============ DANH SACH THE KHO (TONG HOP + CHI TIET MAU) ============
/* v5.65: THỨ TỰ HIỂN THỊ theo yêu cầu:
     1) Mã HẾT HÀNG (tồn <= 0) xuống DƯỚI CÙNG.
     2) Trong nhóm còn hàng: mã có LẦN LƯU CUỐI mới nhất lên TRÊN CÙNG
        (UpdatedAt do migration_v658 thêm; chưa chạy migration thì dùng CreatedAt).
   Cột UpdatedAt được dò bằng COL_LENGTH nên màn hình vẫn mở được khi chưa chạy migration. */
// v6.23: bảng phiếu bán hàng do migration_v668 tạo — dò trước để bản chưa chạy migration không lỗi.
let __coBangPBH = null;
async function coBangPBH(pool) {
  if (__coBangPBH === null) {
    try {
      const r = (await pool.request().query(`SELECT OBJECT_ID('dbo.PhieuBanHangChiTiet') AS o`)).recordset[0] || {};
      __coBangPBH = r.o != null;
    } catch (e) { __coBangPBH = false; }
  }
  return __coBangPBH;
}
/* v6.71: cot TheKhoHangHoa.CongKhai (migration_v679) — cong tac HIEN/AN tung ma hang tren catalogue.
   Do truoc khi dua vao SQL: chua chay migration ma ghi thang cot chua co la HONG CA duong luu the kho. */
let __coCongKhaiTheKho = null;
async function coCotCongKhaiTheKho(pool) {
  if (__coCongKhaiTheKho === null) {
    try {
      const r = (await pool.request().query(`SELECT COL_LENGTH('TheKhoHangHoa','CongKhai') AS c`)).recordset[0] || {};
      __coCongKhaiTheKho = r.c != null;
    } catch (e) { __coCongKhaiTheKho = false; }
  }
  return __coCongKhaiTheKho;
}

async function coCotUpdatedAtTheKho(pool) {
  const r = (await pool.request().query(`SELECT COL_LENGTH('TheKhoHangHoa','UpdatedAt') AS c`)).recordset[0] || {};
  return r.c != null;
}
/* ===== v6.21: TY LE CHIET KHAU SHOP / NPP - DUNG CHUNG 1 TY LE CHO MOI MA HANG =====
   v6.20 tung luu % theo TUNG ma hang (TheKhoHangHoa.PhanTramCKShop/PhanTramCKNPP, migration_v666);
   nguoi dung yeu cau "danh chung ty le chu khong tung ma hang" => nay luu o CauHinhHeThong:
     CK_SHOP = 33   (CK cho shop, % tren GIA BAN)
     CK_NPP  = 17   (CK cho NPP,  % tren GIA SAU CK CUA SHOP - chiet khau CHONG, khong phai tren gia ban)
   Gia SHOP = GiaBan x (1 - CK_SHOP/100)
   Gia NPP  = Gia SHOP x (1 - CK_NPP/100)          <-- vd 100.000 -> shop 67.000 -> NPP 55.610
   2 cot PhanTramCKShop/PhanTramCKNPP cua v666 KHONG con duoc doc/ghi (giu lai trong CSDL cho ban da
   chay v666, khong xoa de khong pha DB). Xem migration_v667.sql. */
const CK_KEY_SHOP = 'CK_SHOP', CK_KEY_NPP = 'CK_NPP';
const CK_MAC_DINH = { shop: 33, npp: 17 };
function soCK(v, macDinh) {
  if (v == null || String(v).trim() === '') return macDinh;
  const n = Number(v);
  return isFinite(n) ? n : macDinh;
}
/* Chua chay migration_v667 (chua co 2 dong cau hinh) van chay duoc: lay mac dinh 33/17.
   v6.21.1: BOC try/catch - ty le CK chi la thu PHU, khong duoc phep lam sap ca man hinh The kho /
   danh sach don / xuat Excel neu bang CauHinhHeThong thieu hoac khong doc duoc. */
async function layTyLeCK(pool) {
  try {
    const rs = (await pool.request()
      .input('a', sql.NVarChar, CK_KEY_SHOP).input('b', sql.NVarChar, CK_KEY_NPP)
      .query('SELECT ConfigKey, ConfigValue FROM CauHinhHeThong WHERE ConfigKey IN (@a, @b)')).recordset;
    const m = {};
    rs.forEach(r => { m[r.ConfigKey] = r.ConfigValue; });
    return { shop: soCK(m[CK_KEY_SHOP], CK_MAC_DINH.shop), npp: soCK(m[CK_KEY_NPP], CK_MAC_DINH.npp) };
  } catch (err) {
    console.error('[khohang layTyLeCK] khong doc duoc CauHinhHeThong, dung mac dinh: ', err.message);
    return { shop: CK_MAC_DINH.shop, npp: CK_MAC_DINH.npp };
  }
}
/* v6.21.1: "hien thi o ban in va xuat Excel GIA THEO CAI" - GiaBan la gia CUA 1 CAI, nen SL phai quy
   ve CAI truoc khi nhan ra thanh tien (don dat theo Ri ma nhan thang se thieu <LoaiRi> lan).
   KHAC orderQtyToBase(): ham do quy ve DON VI CHINH cua ma hang, day quy ve CAI. */
/* ================================================================================================
   v6.31: BO CHUOI 'Ri' KHOI PHEP TINH — xem giai thich day du o backend/routes/banhang.js.
   `mh` = ban ghi ma hang { DonViCoBan, DonViQuyDoi }. Thieu mh -> lui ve quy tac cu ('Ri').
   ⚠️ Ban sao: banhang.js, public.js, frontend/js/common.js — SUA PHAI SUA DONG BO CA 4 CHO.
   ================================================================================================ */
function chuanDV(v) { return String(v == null ? '' : v).trim().toLowerCase(); }
function laDonViGop(donVi, mh) {
  const dv = chuanDV(donVi), qd = chuanDV(mh && mh.DonViQuyDoi);
  return qd ? dv === qd : dv === 'ri';
}
function donViChinhLaGop(mh) {
  const cb = chuanDV(mh && mh.DonViCoBan), qd = chuanDV(mh && mh.DonViQuyDoi);
  return qd ? cb === qd : cb === 'ri';
}
function slSangCai(soLuong, donVi, loaiRi, mh) {
  const n = Number(soLuong) || 0, he = Number(loaiRi) || 1;
  return Math.round(laDonViGop(donVi, mh) ? n * he : n);
}
// Gia KHONG luu trong CSDL - luon tinh o duong DOC tu GiaBan + ty le (sua gia ban la moi cho tu dung theo).
function giaShopSauCK(giaBan, ck) {
  return Math.round((Number(giaBan) || 0) * (1 - (Number(ck.shop) || 0) / 100) * 100) / 100;
}
function giaNPPSauCK(giaBan, ck) {
  return Math.round(giaShopSauCK(giaBan, ck) * (1 - (Number(ck.npp) || 0) / 100) * 100) / 100;
}

// v6.21: doc/ghi ty le CK ngay tren tab The kho (khong bat vao Danh muc -> Cau hinh vi nguoi dung
// thao tac gia ban o day). Ghi bang MERGE nen KHONG can migration - lan luu dau tu tao dong.
router.get('/cauhinh-ck', requireAuth, requirePermission('KHOHANG', 'view'), requireChucNang('KHOHANG', 'items'), async (req, res) => {
  const pool = await getPool();
  res.json({ success: true, data: await layTyLeCK(pool) });
});
router.put('/cauhinh-ck', requireAuth, requirePermission('KHOHANG', 'edit'), requireChucNang('KHOHANG', 'items'), async (req, res) => {
  try {
    const shop = Number(req.body.shop), npp = Number(req.body.npp);
    if (!isFinite(shop) || !isFinite(npp)) return res.status(400).json({ success: false, message: 'Tỷ lệ CK phải là số.' });
    if (shop < 0 || shop > 100 || npp < 0 || npp > 100) return res.status(400).json({ success: false, message: 'Tỷ lệ CK phải trong khoảng 0 - 100%.' });
    const pool = await getPool();
    for (const [k, v] of [[CK_KEY_SHOP, shop], [CK_KEY_NPP, npp]]) {
      await pool.request().input('k', sql.NVarChar, k).input('v', sql.NVarChar, String(v))
        .query(`MERGE CauHinhHeThong AS t USING (SELECT @k AS ConfigKey) AS s ON t.ConfigKey = s.ConfigKey
                WHEN MATCHED THEN UPDATE SET ConfigValue = @v
                WHEN NOT MATCHED THEN INSERT (ConfigKey, ConfigValue) VALUES (@k, @v);`);
    }
    res.json({ success: true, data: { shop, npp } });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Lỗi khi lưu tỷ lệ chiết khấu: ' + err.message });
  }
});
router.get('/items', requireAuth, requirePermission('KHOHANG', 'view'), requireChucNang('KHOHANG', 'items'), async (req, res) => {
  const pool = await getPool();
  const coUpdatedAt = await coCotUpdatedAtTheKho(pool);
  const lanLuu = coUpdatedAt ? 'ISNULL(h.UpdatedAt, h.CreatedAt)' : 'h.CreatedAt';
  // v6.71: cột CongKhai (migration_v679) — chưa chạy migration thì trả 1 (hiện) để giao diện chạy như cũ.
  const cotCongKhai = (await coCotCongKhaiTheKho(pool)) ? 'ISNULL(h.CongKhai, 1)' : 'CAST(1 AS BIT)';
  const tongHop = await pool.request().query(`
    SELECT v.*, h.CreatedAt, ${lanLuu} AS LanLuuCuoi, ${cotCongKhai} AS CongKhai
    FROM vw_TonKhoHangHoa v
    JOIN TheKhoHangHoa h ON h.MaHangID = v.MaHangID
    ORDER BY CASE WHEN ISNULL(v.TongTon, 0) <= 0 THEN 1 ELSE 0 END,
             ${lanLuu} DESC, v.MaHang`);
  const chiTiet = await pool.request().query(`
    SELECT ct.*, ms.TenMau, h.MaHang FROM TheKhoChiTietMau ct
    JOIN MauSac ms ON ms.MauSacID = ct.MauSacID
    JOIN TheKhoHangHoa h ON h.MaHangID = ct.MaHangID`);
  /* v6.21: tỷ lệ CK dùng chung để frontend tính 2 cột giá (KHÔNG lưu giá trong CSDL).
     v6.23: kèm SL ĐANG GIỮ cho đơn khách đặt (Chờ xác nhận/Chờ xử lý) để bảng hiện thêm cột
     "Khả dụng" = tồn − đang giữ, đúng yêu cầu "ghi chú thẻ kho còn bao nhiêu đã trừ các đơn chờ xử lý". */
  const giu = await layHangDangGiu(pool);
  const tongHopRows = tongHop.recordset.map(r => {
    const dangGiu = giu.theoMaHang.get(r.MaHangID) || 0;
    return { ...r, DangGiu: dangGiu, TonKhaDung: (Number(r.TongTon) || 0) - dangGiu };
  });
  const chiTietRows = chiTiet.recordset.map(c => {
    const dangGiu = giu.theoMau.get(c.MaHangID + '|' + c.MauSacID) || 0;
    return { ...c, DangGiu: dangGiu };
  });
  res.json({ success: true, data: { tongHop: tongHopRows, chiTiet: chiTietRows, tyLeCK: await layTyLeCK(pool) } });
});

// v5.19 (muc 4, yeu cau "Tất cả các phân hệ thẻ kho, Tồn kho có chức năng xuất file excel"): xuat Excel
// don gian (khong phai template co dinh dang nhu Bao gia Aloha) cho man hinh "Thẻ kho / Tồn kho".
router.get('/items/export', requireAuth, requirePermission('KHOHANG', 'view'), requireChucNang('KHOHANG', 'items'), async (req, res) => {
  try {
    const pool = await getPool();
    const ck = await layTyLeCK(pool);   // v6.21: ty le CK dung chung
    const result = await pool.request().query('SELECT * FROM vw_TonKhoHangHoa ORDER BY MaHang');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Thẻ kho hàng hóa');
    ws.columns = [
      { header: 'Mã hàng', key: 'MaHang', width: 16 },
      { header: 'Tên hàng', key: 'TenHang', width: 30 },
      { header: 'Danh mục thẻ kho', key: 'TenTheKho', width: 20 },
      { header: 'Loại hàng', key: 'LoaiHang', width: 14 },
      { header: 'Mã đơn hàng SX', key: 'MaDH', width: 16 },
      { header: 'Đơn vị cơ bản', key: 'DonViCoBan', width: 12 },
      { header: 'Đơn vị quy đổi', key: 'DonViQuyDoi', width: 12 },
      { header: 'Tổng nhập', key: 'TongNhap', width: 12 },
      { header: 'Tổng xuất', key: 'TongXuat', width: 12 },
      { header: 'Tổng tồn', key: 'TongTon', width: 12 },
      { header: 'Giá bán (đ/Cái)', key: 'GiaBan', width: 15 },
      // v6.21: gia sau CK tinh tu GiaBan + ty le dung chung (ghi ty le vao tieu de cho ro dang dung %ao)
      { header: `Giá sau CK shop (đ/Cái, CK ${ck.shop}%)`, key: 'GiaSauCKShop', width: 22 },
      { header: `Giá sau CK NPP (đ/Cái, CK ${ck.npp}% trên giá shop)`, key: 'GiaSauCKNPP', width: 28 },
      // v6.61: bỏ cột "Giá Aloha" — trường này không còn nhập nữa, Báo giá Aloha lấy thẳng Giá bán.
      { header: 'Mã Barcode', key: 'MaBarcode', width: 16 }
    ];
    ws.getRow(1).font = { bold: true };
    result.recordset.forEach(r => ws.addRow(Object.assign({}, r, {
      GiaSauCKShop: giaShopSauCK(r.GiaBan, ck),
      GiaSauCKNPP: giaNPPSauCK(r.GiaBan, ck)
    })));
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="the_kho_hang_hoa.xlsx"');
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Lỗi khi xuất Excel: ' + err.message });
  }
});

// ============ TAO / CAP NHAT THE KHO ============
// v5.46: giải mã màu cho 1 dòng chi tiết — ưu tiên mauSacId; nếu chỉ có tenMau (người dùng gõ tự do)
// thì tìm theo tên, chưa có thì TẠO màu mới trong MauSac (sinh MaMau duy nhất từ tên, bỏ dấu + hoa).
function slugMaMau(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 26) || 'MAU';
}
async function resolveMauSacId(pool, c) {
  if (c.mauSacId != null && String(c.mauSacId).trim() !== '' && !isNaN(Number(c.mauSacId))) return Number(c.mauSacId);
  const ten = (c.tenMau || '').trim();
  if (!ten) return null;
  const found = (await pool.request().input('t', sql.NVarChar, ten).query('SELECT MauSacID FROM MauSac WHERE TenMau=@t')).recordset[0];
  if (found) return found.MauSacID;
  let base = slugMaMau(ten), code = base, i = 1;
  while ((await pool.request().input('m', sql.NVarChar, code).query('SELECT 1 AS x FROM MauSac WHERE MaMau=@m')).recordset[0]) {
    i++; code = (base + i).slice(0, 30);
  }
  const ins = await pool.request().input('MaMau', sql.NVarChar, code).input('TenMau', sql.NVarChar, ten)
    .query('INSERT INTO MauSac (MaMau, TenMau) OUTPUT INSERTED.MauSacID VALUES (@MaMau, @TenMau)');
  return ins.recordset[0].MauSacID;
}

router.post('/items', requireAuth, requirePermission('KHOHANG', 'create'), requireChucNang('KHOHANG', 'items'), async (req, res) => {
  try {
    const {
      maHang, tenHang, giaBan, loaiRi, theKhoDanhMucId, anhDaiDien, ghiChu, colors,
      loaiHang, donHangId, donViCoBan, donViQuyDoi, nhomSanPhamId,
      // v5.17 (muc 1.1): 2 truong moi phuc vu chuc nang "Báo giá Aloha" - xem migration_v517.sql.
      giaAloha, maBarcode,
      // v6.71: cong tac HIEN ma hang nay tren catalogue cong khai. Khong gui = HIEN (giu thoi quen cu).
      congKhai
      // v6.21: KHONG con nhan % CK theo tung ma hang (v6.20) - ty le CK nay dung chung, o CauHinhHeThong.
    } = req.body;
    if (!maHang || !tenHang) return res.status(400).json({ success: false, message: 'Thiếu mã hàng hoặc tên hàng.' });
    const pool = await getPool();

    const exists = await pool.request().input('m', sql.NVarChar, maHang).query('SELECT MaHangID FROM TheKhoHangHoa WHERE MaHang=@m');
    if (exists.recordset.length) return res.status(400).json({ success: false, message: 'Mã hàng đã tồn tại, dùng chức năng Sửa.' });

    // LoaiHang chi nhan 2 gia tri hop le; DonHangID chi luu khi la Nha san xuat (theo dung schema v4.0)
    const loaiHangVal = loaiHang === 'NhaSanXuat' ? 'NhaSanXuat' : 'DatNgoai';
    const coCongKhai = await coCotCongKhaiTheKho(pool);   // v6.71

    const result = await pool.request()
      .input('MaHang', sql.NVarChar, maHang.trim().toUpperCase())
      .input('TenHang', sql.NVarChar, tenHang)
      .input('GiaBan', sql.Decimal(14, 2), giaBan || 0)
      .input('LoaiRi', sql.Int, loaiRi || 1)
      .input('TheKhoDanhMucID', sql.Int, theKhoDanhMucId || null)
      .input('AnhDaiDien', sql.NVarChar, anhDaiDien || null)
      .input('GhiChu', sql.NVarChar, ghiChu || null)
      .input('LoaiHang', sql.NVarChar, loaiHangVal)
      .input('DonHangID', sql.Int, loaiHangVal === 'NhaSanXuat' ? (donHangId || null) : null)
      .input('DonViCoBan', sql.NVarChar, donViCoBan || 'Cái')
      .input('DonViQuyDoi', sql.NVarChar, donViQuyDoi || 'Ri')
      .input('NhomSanPhamID', sql.Int, nhomSanPhamId || null)
      .input('GiaAloha', sql.Decimal(14, 2), giaAloha || null)
      .input('MaBarcode', sql.NVarChar, maBarcode || null)
      .input('CongKhai', sql.Bit, congKhai === undefined || congKhai === null ? 1 : (congKhai ? 1 : 0))
      .query(`INSERT INTO TheKhoHangHoa (MaHang, TenHang, GiaBan, LoaiRi, TheKhoDanhMucID, AnhDaiDien, GhiChu, LoaiHang, DonHangID, DonViCoBan, DonViQuyDoi, NhomSanPhamID, GiaAloha, MaBarcode${coCongKhai ? ', CongKhai' : ''})
              OUTPUT INSERTED.MaHangID
              VALUES (@MaHang, @TenHang, @GiaBan, @LoaiRi, @TheKhoDanhMucID, @AnhDaiDien, @GhiChu, @LoaiHang, @DonHangID, @DonViCoBan, @DonViQuyDoi, @NhomSanPhamID, @GiaAloha, @MaBarcode${coCongKhai ? ', @CongKhai' : ''})`);
    const maHangId = result.recordset[0].MaHangID;

    // v5.9.1: DA XOA phep nhan "* (loaiRi || 1)" o day - BUG, khong phai thiet ke. schema.sql tu ghi ro
    // ngay tai cot LoaiRi: "cong thuc SoCatCai/NhapCai/XuatCai KHONG doi, chi doi nhan hien thi" - nghia
    // la SoCatCai/NhapCai LUON la so dem theo don vi CO BAN (Cai), LoaiRi CHI dung de hien thi quy doi
    // (xem fmtDualUnit() o module.khohang.js, da lam dung tu truoc). Nhan them loaiRi o day lam sai lech
    // ngay tu luc TAO MOI (vd nguoi dung go "Số cắt: 100" cho 1 hang LoaiRi=5 se bi luu thanh 500).
    if (Array.isArray(colors)) {
      for (const c of colors) {
        const mid = await resolveMauSacId(pool, c);   // v5.46: màu tự do -> tự tạo MauSac nếu chưa có
        if (!mid) continue;
        await pool.request()
          .input('MaHangID', sql.Int, maHangId)
          .input('MauSacID', sql.Int, mid)
          .input('LinkAnh', sql.NVarChar, c.linkAnh || null)
          .input('SoCatCai', sql.Int, Number(c.soCat || 0))
          .input('NhapCai', sql.Int, Number(c.nhap || 0))
          .input('GhiChu', sql.NVarChar, c.ghiChu || null)
          .query(`INSERT INTO TheKhoChiTietMau (MaHangID, MauSacID, LinkAnh, SoCatCai, NhapCai, XuatCai, GhiChu)
                  VALUES (@MaHangID, @MauSacID, @LinkAnh, @SoCatCai, @NhapCai, 0, @GhiChu)`);
      }
    }
    res.json({ success: true, data: { maHangId, maHang } });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Lỗi khi lưu thẻ kho: ' + err.message });
  }
});

/* ================================================================================================
   v6.71 — BẬT/TẮT CÔNG KHAI 1 MÃ HÀNG (route RIÊNG, chỉ đụng đúng 1 cột).

   ⚠️ TUYỆT ĐỐI KHÔNG dùng PUT /items/:id để làm việc này. Câu UPDATE ở đó đặt thẳng
   `TenHang=@TenHang, GiaBan=@GiaBan, LoaiRi=@LoaiRi, LoaiHang=..., DonViCoBan=...` KHÔNG bọc ISNULL,
   nên gửi thiếu trường nào là XÓA TRẮNG trường đó. Nút bật/tắt ở danh sách chỉ có mỗi cờ công khai
   trong tay -> gọi PUT chung là mất tên hàng, mất giá, mất đơn vị tính của mã đó.
   Route này chỉ chạm đúng cột CongKhai nên không thể làm hỏng gì khác.
   ⚠️ Phải khai TRƯỚC PUT /items/:id — Express khớp route theo thứ tự khai báo.
   ================================================================================================ */
router.put('/items/:id/congkhai', requireAuth, requirePermission('KHOHANG', 'edit'), requireChucNang('KHOHANG', 'items'), async (req, res) => {
  const pool = await getPool();
  if (!await coCotCongKhaiTheKho(pool)) {
    return res.status(400).json({ success: false, message: 'Chưa chạy migration_v679 nên chưa bật/tắt công khai theo mã hàng được.' });
  }
  const bat = !!(req.body || {}).congKhai;
  const kq = await pool.request()
    .input('id', sql.Int, req.params.id)
    .input('ck', sql.Bit, bat ? 1 : 0)
    .query('UPDATE TheKhoHangHoa SET CongKhai=@ck WHERE MaHangID=@id');
  if (!kq.rowsAffected[0]) return res.status(404).json({ success: false, message: 'Không tìm thấy mã hàng.' });
  res.json({ success: true, data: { MaHangID: Number(req.params.id), CongKhai: bat ? 1 : 0 } });
});

router.put('/items/:id', requireAuth, requirePermission('KHOHANG', 'edit'), requireChucNang('KHOHANG', 'items'), async (req, res) => {
  try {
    const maHangId = req.params.id;
    const {
      maHang, tenHang, giaBan, loaiRi, theKhoDanhMucId, anhDaiDien, ghiChu, colors,
      loaiHang, donHangId, donViCoBan, donViQuyDoi, nhomSanPhamId,
      // v5.17 (muc 1.1): xem migration_v517.sql
      giaAloha, maBarcode,
      congKhai   // v6.71: không gửi = giữ nguyên trạng thái hiện/ẩn trên catalogue
      // v6.21: bo % CK theo tung ma hang - xem ghi chu o dau file (CauHinhHeThong CK_SHOP/CK_NPP).
    } = req.body;
    const pool = await getPool();

    // LoaiHang chi nhan 2 gia tri hop le; DonHangID chi luu khi la Nha san xuat (theo dung schema v4.0)
    const loaiHangVal = loaiHang === 'NhaSanXuat' ? 'NhaSanXuat' : 'DatNgoai';

    // v5.52: cho phép SỬA cả Mã hàng — kiểm tra không trùng thẻ kho khác trước khi lưu.
    if (maHang) {
      const dup = await pool.request().input('m', sql.NVarChar, maHang.trim().toUpperCase()).input('id', sql.Int, maHangId)
        .query('SELECT MaHangID FROM TheKhoHangHoa WHERE MaHang=@m AND MaHangID<>@id');
      if (dup.recordset.length) return res.status(400).json({ success: false, message: 'Mã hàng đã tồn tại ở thẻ kho khác.' });
    }

    // v5.65: đánh dấu LẦN LƯU CUỐI để danh sách xếp mã vừa sửa lên đầu (migration_v658).
    // Chưa chạy migration -> bỏ qua, không làm hỏng thao tác lưu.
    const capNhatLanLuu = (await coCotUpdatedAtTheKho(pool)) ? ', UpdatedAt=SYSDATETIME()' : '';
    const coCongKhai = await coCotCongKhaiTheKho(pool);   // v6.71

    await pool.request()
      /* Không gửi `congKhai` = GIỮ NGUYÊN giá trị cũ (ISNULL trong câu UPDATE), không mặc định bật lại.
         Các màn khác cũng gọi PUT này mà không biết đến cờ công khai — mặc định bật là chúng vô tình
         bỏ ẩn những mã người dùng đã cố ý giấu. */
      .input('CongKhai', sql.Bit, congKhai === undefined || congKhai === null ? null : (congKhai ? 1 : 0))
      .input('id', sql.Int, maHangId)
      .input('MaHang', sql.NVarChar, maHang ? maHang.trim().toUpperCase() : null)
      .input('TenHang', sql.NVarChar, tenHang)
      .input('GiaBan', sql.Decimal(14, 2), giaBan || 0)
      .input('LoaiRi', sql.Int, loaiRi || 1)
      .input('TheKhoDanhMucID', sql.Int, theKhoDanhMucId || null)
      .input('AnhDaiDien', sql.NVarChar, anhDaiDien || null)
      .input('GhiChu', sql.NVarChar, ghiChu || null)
      .input('LoaiHang', sql.NVarChar, loaiHangVal)
      .input('DonHangID', sql.Int, loaiHangVal === 'NhaSanXuat' ? (donHangId || null) : null)
      .input('DonViCoBan', sql.NVarChar, donViCoBan || 'Cái')
      .input('DonViQuyDoi', sql.NVarChar, donViQuyDoi || 'Ri')
      .input('NhomSanPhamID', sql.Int, nhomSanPhamId || null)
      .input('GiaAloha', sql.Decimal(14, 2), giaAloha || null)
      .input('MaBarcode', sql.NVarChar, maBarcode || null)
      .query(`UPDATE TheKhoHangHoa SET MaHang=ISNULL(@MaHang, MaHang), TenHang=@TenHang, GiaBan=@GiaBan, LoaiRi=@LoaiRi,
              TheKhoDanhMucID=ISNULL(@TheKhoDanhMucID, TheKhoDanhMucID), AnhDaiDien=ISNULL(@AnhDaiDien, AnhDaiDien), GhiChu=ISNULL(@GhiChu, GhiChu),
              LoaiHang=@LoaiHang, DonHangID=@DonHangID, DonViCoBan=@DonViCoBan, DonViQuyDoi=@DonViQuyDoi,
              NhomSanPhamID=ISNULL(@NhomSanPhamID, NhomSanPhamID), GiaAloha=ISNULL(@GiaAloha, GiaAloha), MaBarcode=ISNULL(@MaBarcode, MaBarcode)
              ${coCongKhai ? ', CongKhai=ISNULL(@CongKhai, CongKhai)' : ''}
              ${capNhatLanLuu}
              WHERE MaHangID=@id`);

    // v5.9.1: DA XOA phep nhan "* (loaiRi || 1)" o day - day chinh la nguyen nhan bug "sua thẻ kho la
    // so luong nhan len": form Sua dien san SoCatCai/NhapCai HIEN CO (dung don vi Cai) vao o nhap, nhung
    // luc luu lai NHAN THEM loaiRi mot lan nua - moi lan mo Sua roi bam Luu (ke ca khong doi gi) se lam
    // so luong tang gap loaiRi lan. Xac nhan qua chinh comment goc trong schema.sql (cot LoaiRi): "cong
    // thuc SoCatCai/NhapCai/XuatCai KHONG doi, chi doi nhan hien thi" - dung y la KHONG nhan/chia gi ca.
    if (Array.isArray(colors)) {
      const keepIds = [];
      for (const c of colors) {
        const mid = await resolveMauSacId(pool, c);   // v5.46: màu tự do -> tự tạo MauSac nếu chưa có
        if (!mid) continue;
        const existing = await pool.request()
          .input('id', sql.Int, maHangId).input('ms', sql.Int, mid)
          .query('SELECT ID, XuatCai FROM TheKhoChiTietMau WHERE MaHangID=@id AND MauSacID=@ms');
        const soCatCai = Number(c.soCat || 0);
        const nhapCai = Number(c.nhap || 0);
        if (existing.recordset.length) {
          await pool.request()
            .input('rowId', sql.Int, existing.recordset[0].ID)
            .input('SoCatCai', sql.Int, soCatCai).input('NhapCai', sql.Int, nhapCai)
            .input('LinkAnh', sql.NVarChar, c.linkAnh || null)
            .input('GhiChu', sql.NVarChar, c.ghiChu || null)
            .query(`UPDATE TheKhoChiTietMau SET SoCatCai=@SoCatCai, NhapCai=@NhapCai,
                    LinkAnh = ISNULL(@LinkAnh, LinkAnh), GhiChu=@GhiChu WHERE ID=@rowId`);
          keepIds.push(existing.recordset[0].ID);
        } else {
          const ins = await pool.request()
            .input('MaHangID', sql.Int, maHangId).input('MauSacID', sql.Int, mid)
            .input('LinkAnh', sql.NVarChar, c.linkAnh || null)
            .input('SoCatCai', sql.Int, soCatCai).input('NhapCai', sql.Int, nhapCai)
            .input('GhiChu', sql.NVarChar, c.ghiChu || null)
            .query(`INSERT INTO TheKhoChiTietMau (MaHangID, MauSacID, LinkAnh, SoCatCai, NhapCai, XuatCai, GhiChu)
                    OUTPUT INSERTED.ID VALUES (@MaHangID, @MauSacID, @LinkAnh, @SoCatCai, @NhapCai, 0, @GhiChu)`);
          keepIds.push(ins.recordset[0].ID);
        }
      }
      if (keepIds.length) {
        await pool.request().input('id', sql.Int, maHangId)
          .query(`DELETE FROM TheKhoChiTietMau WHERE MaHangID=@id AND ID NOT IN (${keepIds.join(',')})`);
      }
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Lỗi khi cập nhật thẻ kho: ' + err.message });
  }
});

// v5.3 (muc 2): xoa the kho theo phan quyen (requirePermission 'delete' cap phan he + requireChucNang
// 'items' cap chuc nang - ca 2 deu phai cho phep). TheKhoChiTietMau tu xoa theo (ON DELETE CASCADE),
// nhung DonKhachDatHang.MaHangID KHONG cascade - kiem tra truoc de bao loi de hieu thay vi de SQL Server
// nem loi rang buoc FK kho hieu, giong dung cach lam voi Xoa lenh SX / Xoa phieu kho vai.
router.delete('/items/:id', requireAuth, requirePermission('KHOHANG', 'delete'), requireChucNang('KHOHANG', 'items'), async (req, res) => {
  try {
    const pool = await getPool();
    const id = req.params.id;
    const donCheck = await pool.request().input('id', sql.Int, id).query('SELECT COUNT(*) AS C FROM DonKhachDatHang WHERE MaHangID=@id');
    if (donCheck.recordset[0].C > 0) {
      return res.status(400).json({ success: false, message: 'Không thể xóa: mã hàng này đã có đơn khách đặt hàng liên kết. Hủy/xóa các đơn đó trước.' });
    }
    const result = await pool.request().input('id', sql.Int, id).query('DELETE FROM TheKhoHangHoa WHERE MaHangID=@id');
    if (!result.rowsAffected[0]) return res.status(404).json({ success: false, message: 'Không tìm thấy thẻ kho.' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Lỗi khi xóa thẻ kho: ' + err.message });
  }
});

// ============ DAT HANG (KHACH DAT HANG) ============
// v5.0 (Phase 4): truoc day route nay tang XuatCai vo dieu kien, khong doi chieu ton hien co
// (NhapCai-XuatCai) -> co the len don vuot ton thuc te, lam TongTon o vw_TonKhoHangHoa am, sai lech
// voi kho thuc. Nay kiem tra TRUOC (khong ghi gi) cho TAT CA dong trong don, neu co bat ky dong nao
// khong du ton thi tra loi 400 kem chi tiet, KHONG ghi don nao - tranh ghi mot phan don.
// v5.46.1: quy số lượng đơn (theo đơn vị người đặt) về ĐƠN VỊ CHÍNH của mã hàng.
// Nhập/Xuất/Tồn (TheKhoChiTietMau) lưu theo ĐƠN VỊ CHÍNH — nên trừ tồn phải theo đơn vị chính,
// KHÔNG nhân hệ số thành Cái (bug cũ làm hàng đơn vị chính = Ri bị trừ gấp hệ số).
function orderQtyToBase(soLuong, orderDonVi, donViCoBan, loaiRi, donViQuyDoi) {
  const n = Number(soLuong) || 0, he = Number(loaiRi) || 1;
  /* v6.31: dùng ĐVT quy đổi CỦA CHÍNH MÃ HÀNG thay cho chuỗi 'Ri' — xem ghi chú ở đầu file. */
  const mh = { DonViCoBan: donViCoBan, DonViQuyDoi: donViQuyDoi };
  const cai = laDonViGop(orderDonVi, mh) ? n * he : n;        // -> đơn vị GỐC
  const base = donViChinhLaGop(mh) ? cai / he : cai;          // -> ĐƠN VỊ CHÍNH (đơn vị lưu tồn)
  return Math.round(base);
}

router.post('/orders', requireAuth, requirePermission('KHOHANG', 'create'), requireChucNang('KHOHANG', 'orders'), async (req, res) => {
  try {
    const user = req.session.user;
    const { tenKhach, items } = req.body;
    if (!tenKhach || !Array.isArray(items) || !items.length) {
      return res.status(400).json({ success: false, message: 'Thiếu tên khách hoặc danh sách sản phẩm đặt.' });
    }
    const pool = await getPool();

    // Buoc 1: quy ve DON VI CHINH cua tung ma hang (KHONG phai luon Cai) + doi chieu ton hien co cho
    // TUNG dong, gop theo MaHangID+MauSacID (1 don co the co nhieu dong cung 1 ma hang+mau).
    const need = new Map();          // key "maHangId:mauSacId" -> SL theo ĐƠN VỊ CHÍNH
    const baseByMaHang = new Map();  // maHangId -> DonViCoBan (để báo lỗi đúng đơn vị)
    const lineInfo = [];
    for (const item of items) {
      const infoResult = await pool.request().input('id', sql.Int, item.maHangId)
        .query(`SELECT h.LoaiRi, h.DonViCoBan, h.DonViQuyDoi, h.MaHang, h.TenHang FROM TheKhoHangHoa h WHERE h.MaHangID=@id`);
      if (!infoResult.recordset.length) return res.status(400).json({ success: false, message: 'Mã hàng không tồn tại.' });
      const rowH = infoResult.recordset[0];
      const donViCoBan = rowH.DonViCoBan || 'Cái';
      baseByMaHang.set(String(item.maHangId), donViCoBan);
      const slGoc = Number(item.soLuong) || 0;
      const slChinh = orderQtyToBase(slGoc, item.donVi, donViCoBan, rowH.LoaiRi, rowH.DonViQuyDoi);
      /* v6.24.1: mã QUẢN KHO THEO RI thì tồn chỉ lưu được số Ri nguyên — đặt lẻ vài cái sẽ bị LÀM TRÒN
         (1 Cái → 0 Ri: giữ hàng = 0; 7 Cái → 1 Ri: thiếu 1 cái). Chặn ngay từ lúc lên đơn cho khỏi
         lệch tồn về sau. Xem thông báo tương tự ở routes/banhang.js. */
      const heSoH = Number(rowH.LoaiRi) || 1;
      const soCaiH = laDonViGop(item.donVi, rowH) ? slGoc * heSoH : slGoc;
      if (donViChinhLaGop(rowH) && heSoH > 1 && soCaiH % heSoH !== 0) {
        return res.status(400).json({ success: false, message:
          `Mã ${rowH.MaHang} đang QUẢN KHO THEO RI (1 Ri = ${heSoH} Cái) nên chỉ đặt được bội số của ${heSoH} Cái — đang đặt ${soCaiH} Cái (= ${(soCaiH / heSoH).toFixed(2)} Ri).\n`
          + `Muốn bán lẻ theo cái: chuyển mã này sang quản kho theo CÁI bằng công cụ utils/sua_don_vi_the_kho.js (--den=Cai --quy-doi).` });
      }
      const key = item.maHangId + ':' + item.mauSacId;
      need.set(key, (need.get(key) || 0) + slChinh);
      lineInfo.push({ item, slGoc, maHang: rowH.MaHang, tenHang: rowH.TenHang });
    }

    /* v6.23: đối chiếu với TỒN KHẢ DỤNG = tồn kho − SL các đơn ĐANG GIỮ (Chờ xác nhận/Chờ xử lý,
       chưa xuất phiếu bán hàng). Từ v6.23 đơn đặt KHÔNG trừ tồn nữa (chỉ phiếu bán hàng mới trừ),
       nên nếu vẫn so với tồn kho thô thì cùng một lô hàng sẽ nhận được nhiều đơn hơn số có thật. */
    const giu = await layHangDangGiu(pool);
    const thieu = [];
    for (const [key, slCan] of need.entries()) {
      const [maHangId, mauSacId] = key.split(':');
      const tonResult = await pool.request().input('mh', sql.Int, maHangId).input('ms', sql.Int, mauSacId)
        .query('SELECT NhapCai, XuatCai FROM TheKhoChiTietMau WHERE MaHangID=@mh AND MauSacID=@ms');
      const tonKho = tonResult.recordset.length ? Number(tonResult.recordset[0].NhapCai) - Number(tonResult.recordset[0].XuatCai) : 0;
      const ton = tonKho - (giu.theoMau.get(maHangId + '|' + mauSacId) || 0);
      if (slCan > ton) {
        const line = lineInfo.find(l => String(l.item.maHangId) === maHangId && String(l.item.mauSacId) === mauSacId);
        const dv = baseByMaHang.get(maHangId) || 'ĐVT';
        thieu.push(`${line ? line.maHang + ' - ' + line.tenHang : 'Mã hàng #' + maHangId} (màu #${mauSacId}): cần ${slCan} ${dv}, khả dụng ${ton} ${dv} (tồn kho ${tonKho}, đang giữ cho đơn khác ${tonKho - ton})`);
      }
    }
    if (thieu.length) {
      return res.status(400).json({ success: false, message: 'Không đủ tồn khả dụng để lên đơn:\n' + thieu.join('\n') });
    }

    /* Buoc 2: da chac chan du ton cho tat ca dong, tien hanh ghi don.
       ⚠️ v6.23.2 (SUA LOI): cot DaTruTon co DEFAULT = 1 (migration_v657, thoi con tru ton ngay khi
       len don). Tu v6.23 don CHI GIU HANG nen phai ghi RO DaTruTon = 0, neu de mac dinh 1 thi:
         - don khong duoc tinh la "dang giu"  -> cot Kha dung KHONG tru don dang cho (loi da bao),
         - huy/xoa don lai HOAN TON mot luong chua tung tru -> ton kho PHONG len.
       Do bang COL_LENGTH de ban CSDL chua chay migration_v657 van chay duoc. */
    const coCotDaTruTon = (await pool.request().query(
      `SELECT COL_LENGTH('DonKhachDatHang','DaTruTon') AS c`)).recordset[0].c != null;
    for (const { item, slGoc } of lineInfo) {
      await pool.request()
        .input('TenKhach', sql.NVarChar, tenKhach)
        .input('MaHangID', sql.Int, item.maHangId)
        .input('MauSacID', sql.Int, item.mauSacId)
        .input('SoLuongDat', sql.Int, slGoc)
        .input('DonVi', sql.NVarChar, item.donVi || 'Cái')
        .input('NguoiTaoID', sql.Int, user.userId)
        .query(`INSERT INTO DonKhachDatHang (TenKhach, MaHangID, MauSacID, SoLuongDat, DonVi, NguoiTaoID${coCotDaTruTon ? ', DaTruTon' : ''})
                VALUES (@TenKhach, @MaHangID, @MauSacID, @SoLuongDat, @DonVi, @NguoiTaoID${coCotDaTruTon ? ', 0' : ''})`);
    }
    /* v6.23: ĐÃ BỎ đoạn trừ tồn ở đây (trước là XuatCai += SL ngay khi lên đơn, v5.65).
       Nay đơn chỉ GIỮ hàng; tồn kho chỉ giảm khi xuất PHIẾU BÁN HÀNG (routes/banhang.js) — chỗ trừ
       tồn DUY NHẤT của hệ thống. Vì vậy DaTruTon để 0 (mặc định của cột) và các đường hủy/xóa đơn
       vẫn chạy đúng vì chúng chỉ hoàn tồn khi DaTruTon = 1 (đơn cũ trước v6.23). */
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Lỗi khi lên đơn: ' + err.message });
  }
});

router.get('/orders', requireAuth, requirePermission('KHOHANG', 'view'), requireChucNang('KHOHANG', 'orders'), async (req, res) => {
  try {
    const pool = await getPool();
    /* v5.64.1: các cột NguonDat/GhiChuKhach/DaTruTon/TaiKhoanKhachID/ThoiGianXacNhan do
       migration_v657 thêm. Nếu máy chủ đã cập nhật code mà CHƯA chạy (hoặc chạy chưa xong)
       migration đó thì câu SELECT sẽ lỗi "Invalid column name" -> TRẮNG MÀN HÌNH.
       Nay: kiểm tra cột có tồn tại không rồi mới chọn -> màn hình LUÔN mở được, kèm cảnh báo
       nhắc chạy migration (thay vì chết cả tab). */
    const coCotMoi = (await pool.request().query(
      `SELECT COL_LENGTH('DonKhachDatHang','DaTruTon') AS DaTruTon,
              COL_LENGTH('DonKhachDatHang','NguonDat') AS NguonDat`)).recordset[0] || {};
    const duCot = coCotMoi.DaTruTon != null && coCotMoi.NguonDat != null;
    // v6.23: kèm PhieuBHID (frontend dùng để biết đơn đã lên phiếu bán hàng chưa) — dò cột như các cột mới khác.
    const coPhieuBH = (await pool.request().query(`SELECT COL_LENGTH('DonKhachDatHang','PhieuBHID') AS c`)).recordset[0].c != null;
    const cotPBH = coPhieuBH ? ', o.PhieuBHID' : ', CAST(NULL AS INT) AS PhieuBHID';
    const cotMoi = (duCot
      ? `, o.NguonDat, o.GhiChuKhach, o.DaTruTon, o.TaiKhoanKhachID, o.ThoiGianXacNhan`
      : `, CAST(N'NoiBo' AS NVARCHAR(20)) AS NguonDat, CAST(NULL AS NVARCHAR(500)) AS GhiChuKhach,
          CAST(1 AS BIT) AS DaTruTon, CAST(NULL AS INT) AS TaiKhoanKhachID, CAST(NULL AS DATETIME2) AS ThoiGianXacNhan`) + cotPBH;
    const result = await pool.request().query(`
      SELECT o.DonID, o.ThoiGian, o.TenKhach, o.MaHangID, o.MauSacID, h.MaHang, h.TenHang, ms.TenMau, o.SoLuongDat, o.DonVi, o.TrangThai,
             h.AnhDaiDien,   /* v5.65: cột Ảnh (ảnh đại diện chung của mã hàng) */
             h.GiaBan, h.LoaiRi, h.DonViCoBan, h.DonViQuyDoi   /* v6.21: bảng kê in cần giá + quy đổi SL ra Cái */
             ${cotMoi}
      FROM DonKhachDatHang o
      JOIN TheKhoHangHoa h ON h.MaHangID = o.MaHangID
      JOIN MauSac ms ON ms.MauSacID = o.MauSacID
      /* v6.76: cùng thứ tự ưu tiên với frontend (nhomDon) — đơn CHƯA XỬ LÝ XONG lên trên cùng.
         Để backend trả một kiểu, frontend sắp một kiểu thì lúc phân trang/xuất Excel sẽ ra thứ tự khác
         với thứ tự người dùng đang nhìn trên màn hình. */
      ORDER BY CASE o.TrangThai WHEN N'Chờ xác nhận' THEN 0 WHEN N'Chờ xử lý' THEN 1 ELSE 2 END,
               o.ThoiGian DESC`);
    res.json({
      success: true, data: result.recordset,
      tyLeCK: await layTyLeCK(pool),   // v6.21: để bảng kê in tính giá sau CK shop/NPP
      canhBao: duCot ? null : 'Chưa chạy database/migration_v657.sql — chức năng khách tự đặt hàng trên web chưa dùng được (đang hiển thị theo dữ liệu cũ).'
    });
  } catch (err) {
    console.error('[khohang GET /orders] ', err);
    res.status(500).json({ success: false, message: 'Lỗi khi tải danh sách đơn đặt hàng: ' + err.message });
  }
});

/* v6.21: XUẤT EXCEL danh sách đơn khách đặt hàng.
   - GỘP theo (Khách + Mã hàng + Màu + Đơn vị + NGÀY): 1 mã hàng cùng màu khách đặt nhiều lần trong
     cùng 1 ngày -> 1 dòng, SL cộng dồn. Gộp thêm theo ĐƠN VỊ vì "10 Cái" và "10 Ri" KHÔNG được cộng.
   - Kèm Giá bán / Giá sau CK shop / Giá sau CK NPP + Thành tiền theo từng mức giá.
   - Nhận đúng 5 bộ lọc của màn hình (khach/maHang/mau/trangThai/tg) để file khớp những gì đang thấy;
     `tg` khớp KIỂU CHUỖI trên "dd/MM/yyyy" nên nhận cả tháng "MM/yyyy" y như ô lọc trên giao diện. */
router.get('/orders/export', requireAuth, requirePermission('KHOHANG', 'view'), requireChucNang('KHOHANG', 'orders'), async (req, res) => {
  try {
    const pool = await getPool();
    const ck = await layTyLeCK(pool);
    const rows = (await pool.request().query(`
      SELECT o.DonID, o.ThoiGian, o.TenKhach, o.MaHangID, o.MauSacID, h.MaHang, h.TenHang, ms.TenMau,
             o.SoLuongDat, o.DonVi, o.TrangThai, h.GiaBan, h.LoaiRi, h.DonViCoBan, h.DonViQuyDoi
      FROM DonKhachDatHang o
      JOIN TheKhoHangHoa h ON h.MaHangID = o.MaHangID
      JOIN MauSac ms ON ms.MauSacID = o.MauSacID
      ORDER BY o.ThoiGian DESC`)).recordset;

    const hai = n => String(n).padStart(2, '0');
    const ngayVN = d => { const x = new Date(d); return isNaN(x) ? '' : `${hai(x.getDate())}/${hai(x.getMonth() + 1)}/${x.getFullYear()}`; };
    const loc = { khach: req.query.khach || '', maHang: req.query.maHang || '', mau: req.query.mau || '', trangThai: req.query.trangThai || '', tg: (req.query.tg || '').trim().toLowerCase() };
    const daLoc = rows.filter(o => (!loc.khach || o.TenKhach === loc.khach)
      && (!loc.maHang || o.MaHang === loc.maHang)
      && (!loc.mau || o.TenMau === loc.mau)
      && (!loc.trangThai || o.TrangThai === loc.trangThai)
      && (!loc.tg || ngayVN(o.ThoiGian).toLowerCase().includes(loc.tg)));

    const nhom = new Map();
    daLoc.forEach(o => {
      const ngay = ngayVN(o.ThoiGian);
      const key = [ngay, o.TenKhach || '', o.MaHangID, o.MauSacID, o.DonVi || ''].join('|');
      if (!nhom.has(key)) nhom.set(key, { Ngay: ngay, TenKhach: o.TenKhach, MaHang: o.MaHang, TenHang: o.TenHang, TenMau: o.TenMau, DonVi: o.DonVi, GiaBan: o.GiaBan, LoaiRi: o.LoaiRi,
        DonViCoBan: o.DonViCoBan, DonViQuyDoi: o.DonViQuyDoi,   /* v6.31: để slSangCai nhận diện đơn vị gộp */
        SoLuongDat: 0, SoDon: 0, TrangThai: new Set(), ts: new Date(o.ThoiGian).getTime() || 0 });
      const g = nhom.get(key);
      g.SoLuongDat += Number(o.SoLuongDat) || 0;
      g.SoDon += 1;
      g.TrangThai.add(o.TrangThai);
    });
    const dsNhom = [...nhom.values()].sort((a, b) => b.ts - a.ts || String(a.TenKhach).localeCompare(String(b.TenKhach), 'vi'));

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Đơn khách đặt hàng');
    ws.columns = [
      { header: 'Ngày', key: 'Ngay', width: 12 },
      { header: 'Khách', key: 'TenKhach', width: 22 },
      { header: 'Mã hàng', key: 'MaHang', width: 16 },
      { header: 'Tên hàng', key: 'TenHang', width: 28 },
      { header: 'Màu', key: 'TenMau', width: 14 },
      { header: 'SL (đã gộp)', key: 'SoLuongDat', width: 12 },
      { header: 'Đơn vị', key: 'DonVi', width: 9 },
      // v6.21.1: giá là giá 1 CÁI -> phải có SL quy về Cái, thành tiền tính trên cột này.
      { header: 'SL quy đổi (Cái)', key: 'SoLuongCai', width: 15 },
      { header: 'Số đơn gộp', key: 'SoDon', width: 11 },
      { header: 'Trạng thái', key: 'TrangThai', width: 16 },
      { header: 'Giá bán (đ/Cái)', key: 'GiaBan', width: 15 },
      { header: `Giá sau CK shop (đ/Cái, CK ${ck.shop}%)`, key: 'GiaShop', width: 22 },
      { header: `Giá sau CK NPP (đ/Cái, CK ${ck.npp}% trên giá shop)`, key: 'GiaNPP', width: 28 },
      { header: 'Thành tiền (giá bán)', key: 'TTBan', width: 18 },
      { header: 'Thành tiền (giá shop)', key: 'TTShop', width: 18 },
      { header: 'Thành tiền (giá NPP)', key: 'TTNPP', width: 18 }
    ];
    ws.getRow(1).font = { bold: true };
    dsNhom.forEach(g => {
      const gShop = giaShopSauCK(g.GiaBan, ck), gNPP = giaNPPSauCK(g.GiaBan, ck);
      const slCai = slSangCai(g.SoLuongDat, g.DonVi, g.LoaiRi, g);
      ws.addRow({
        Ngay: g.Ngay, TenKhach: g.TenKhach, MaHang: g.MaHang, TenHang: g.TenHang, TenMau: g.TenMau,
        SoLuongDat: Number(g.SoLuongDat) || 0, DonVi: g.DonVi, SoLuongCai: slCai,
        SoDon: g.SoDon, TrangThai: [...g.TrangThai].join(', '),
        GiaBan: g.GiaBan, GiaShop: gShop, GiaNPP: gNPP,
        TTBan: Math.round((Number(g.GiaBan) || 0) * slCai), TTShop: Math.round(gShop * slCai), TTNPP: Math.round(gNPP * slCai)
      });
    });
    /* Dòng TỔNG: cộng SL quy đổi (Cái) — cộng được vì đã cùng đơn vị — và 3 cột tiền.
       Lấy chữ cái cột bằng ws.getColumn(key).letter, KHÔNG viết cứng 'M2:M...': thêm/bớt 1 cột là
       công thức viết cứng lệch ngay mà không báo lỗi gì. */
    if (dsNhom.length) {
      const dongCuoi = ws.rowCount;
      const cot = key => ws.getColumn(key).letter;
      const tong = key => ({ formula: `SUM(${cot(key)}2:${cot(key)}${dongCuoi})` });
      const r = ws.addRow({ TenKhach: 'TỔNG', SoLuongCai: tong('SoLuongCai'), TTBan: tong('TTBan'), TTShop: tong('TTShop'), TTNPP: tong('TTNPP') });
      r.font = { bold: true };
    }
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="don_khach_dat_hang.xlsx"');
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('[khohang GET /orders/export] ', err);
    res.status(400).json({ success: false, message: 'Lỗi khi xuất Excel: ' + err.message });
  }
});

router.put('/orders/:id/status', requireAuth, requirePermission('KHOHANG', 'edit'), requireChucNang('KHOHANG', 'orders'), async (req, res) => {
  try {
    const pool = await getPool();
    const { newStatus } = req.body;
    const current = await pool.request().input('id', sql.Int, req.params.id).query('SELECT * FROM DonKhachDatHang WHERE DonID=@id');
    if (!current.recordset.length) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn.' });
    const row = current.recordset[0];
    if (row.TrangThai === newStatus || row.TrangThai === 'Đã hủy') {
      return res.status(400).json({ success: false, message: 'Không thể thay đổi trạng thái.' });
    }
    /* v6.23 (CHẶN LỖ HỔNG TỒN KHO): 'Đã giao' là quy trình CŨ (in phiếu giao hàng → Đã giao) và nó
       KHÔNG trừ tồn. Từ v6.23 đơn chỉ giữ hàng, nên nếu cho chuyển sang 'Đã giao' thì hàng vừa không
       bị trừ khỏi kho, vừa thôi được tính là "đang giữ" ⇒ lô hàng đó bán được LẦN THỨ HAI.
       Vì vậy: chỉ cho 'Đã giao' khi tồn ĐÃ ra khỏi kho thật (đơn cũ DaTruTon=1, hoặc đã có phiếu bán hàng). */
    const tonDaRa = (row.DaTruTon === undefined || row.DaTruTon === null) ? true : !!row.DaTruTon;
    if (newStatus === 'Đã giao' && !tonDaRa && !row.PhieuBHID) {
      return res.status(400).json({ success: false,
        message: 'Đơn này chưa xuất hàng khỏi kho. Hãy dùng "🧾 Chuyển sang phiếu bán hàng" — phiếu bán hàng mới là chứng từ trừ tồn kho và ghi công nợ (từ v6.23).' });
    }
    if (row.TrangThai === 'Đã xuất hàng') {
      return res.status(400).json({ success: false, message: 'Đơn đã có phiếu bán hàng — muốn đổi thì hủy phiếu bán hàng đó (hệ thống sẽ hoàn tồn đúng).' });
    }

    await pool.request().input('id', sql.Int, req.params.id).input('s', sql.NVarChar, newStatus)
      .query('UPDATE DonKhachDatHang SET TrangThai=@s WHERE DonID=@id');

    if (newStatus === 'Đã hủy') {
      /* v5.63 QUAN TRỌNG: chỉ HOÀN TỒN khi đơn này THỰC SỰ đã trừ tồn (DaTruTon=1).
         Đơn khách đặt trên web ở trạng thái 'Chờ xác nhận' CHƯA trừ tồn — nếu vẫn cộng trả như
         trước thì tồn kho sẽ bị THỪA lên (cộng một lượng chưa từng trừ). Cột DaTruTon do
         migration_v657 thêm; đơn cũ mặc định = 1 nên hành vi với dữ liệu cũ KHÔNG đổi. */
      const daTru = row.DaTruTon === undefined || row.DaTruTon === null ? true : !!row.DaTruTon;
      if (daTru) {
        const itemInfo = await pool.request().input('id', sql.Int, row.MaHangID).query('SELECT LoaiRi, DonViCoBan, DonViQuyDoi FROM TheKhoHangHoa WHERE MaHangID=@id');
        const li = itemInfo.recordset[0] || {};
        const slChinh = orderQtyToBase(row.SoLuongDat, row.DonVi, li.DonViCoBan, li.LoaiRi, li.DonViQuyDoi);
        await pool.request().input('mh', sql.Int, row.MaHangID).input('ms', sql.Int, row.MauSacID).input('sl', sql.Int, slChinh)
          .query('UPDATE TheKhoChiTietMau SET XuatCai = XuatCai - @sl WHERE MaHangID=@mh AND MauSacID=@ms');
        await pool.request().input('id', sql.Int, req.params.id)
          .query('UPDATE DonKhachDatHang SET DaTruTon=0 WHERE DonID=@id');
      }
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Lỗi khi cập nhật trạng thái đơn.' });
  }
});

/* v5.63: XÁC NHẬN đơn khách đặt trên web ('Chờ xác nhận' -> 'Chờ xử lý').
   v6.23: KHÔNG còn trừ tồn ở đây. Cả 2 trạng thái 'Chờ xác nhận' và 'Chờ xử lý' đều là GIỮ HÀNG;
   tồn chỉ giảm khi xuất PHIẾU BÁN HÀNG. Xác nhận nay chỉ để nhân viên nhận đơn web vào luồng xử lý.
   Vẫn kiểm tra TỒN KHẢ DỤNG (đã trừ hàng đang giữ cho các đơn khác) để không nhận đơn không có hàng. */
router.put('/orders/:id/xacnhan', requireAuth, requirePermission('KHOHANG', 'edit'), requireChucNang('KHOHANG', 'orders'), async (req, res) => {
  try {
    const pool = await getPool();
    const row = (await pool.request().input('id', sql.Int, req.params.id)
      .query('SELECT * FROM DonKhachDatHang WHERE DonID=@id')).recordset[0];
    if (!row) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn.' });
    if (String(row.TrangThai) === 'Đã hủy') return res.status(400).json({ success: false, message: 'Đơn đã hủy, không xác nhận được.' });
    if (String(row.TrangThai) !== 'Chờ xác nhận') return res.status(400).json({ success: false, message: 'Đơn này đã được xác nhận trước đó.' });

    const h = (await pool.request().input('id', sql.Int, row.MaHangID)
      .query('SELECT MaHang, TenHang, LoaiRi, DonViCoBan, DonViQuyDoi FROM TheKhoHangHoa WHERE MaHangID=@id')).recordset[0] || {};
    const slChinh = orderQtyToBase(row.SoLuongDat, row.DonVi, h.DonViCoBan, h.LoaiRi, h.DonViQuyDoi);

    const ct = (await pool.request().input('mh', sql.Int, row.MaHangID).input('ms', sql.Int, row.MauSacID)
      .query('SELECT ID, (NhapCai - XuatCai) AS TonCon FROM TheKhoChiTietMau WHERE MaHangID=@mh AND MauSacID=@ms')).recordset[0];
    if (!ct) return res.status(400).json({ success: false, message: 'Mã hàng/màu này không còn trong thẻ kho.' });
    // Hàng đang giữ cho các đơn KHÁC (trừ chính đơn này ra, vì nó cũng đang nằm trong danh sách giữ).
    const giu = await layHangDangGiu(pool);
    const giuKhac = (giu.theoMau.get(row.MaHangID + '|' + row.MauSacID) || 0) - slChinh;
    const khaDung = Number(ct.TonCon) - Math.max(0, giuKhac);
    if (khaDung < slChinh) {
      return res.status(400).json({ success: false,
        message: `Không đủ tồn khả dụng để xác nhận: ${h.MaHang || ''} cần ${slChinh} ${h.DonViCoBan || 'Cái'}, khả dụng ${khaDung} (tồn kho ${ct.TonCon}, đang giữ cho đơn khác ${Math.max(0, giuKhac)}).` });
    }
    await pool.request().input('id', sql.Int, req.params.id).input('u', sql.Int, req.session.user.userId)
      .query(`UPDATE DonKhachDatHang SET TrangThai=N'Chờ xử lý', NguoiXacNhanID=@u, ThoiGianXacNhan=SYSDATETIME() WHERE DonID=@id`);
    res.json({ success: true });
  } catch (err) {
    console.error('[orders xacnhan] ', err);
    res.status(400).json({ success: false, message: 'Lỗi khi xác nhận đơn: ' + err.message });
  }
});

/* ================================================================================================
   v5.63: TÀI KHOẢN KHÁCH (nhân viên tạo, gửi khách để đăng nhập đặt hàng trên trang công khai).
   KHÔNG có đăng ký tự do. Mật khẩu băm bằng bcrypt như tài khoản nội bộ; API KHÔNG bao giờ trả hash.
   ================================================================================================ */
router.get('/taikhoankhach', requireAuth, requirePermission('KHOHANG', 'view'), requireChucNang('KHOHANG', 'taikhoankhach'), async (req, res) => {
  try {
    const pool = await getPool();
    const rows = (await pool.request().query(`
      SELECT k.TaiKhoanKhachID, k.TenDangNhap, k.TenKhach, k.SDT, k.Email, k.DiaChi, k.TrangThai, k.GhiChu,
             k.LanDangNhapCuoi, k.CreatedAt,
             (SELECT COUNT(*) FROM DonKhachDatHang d WHERE d.TaiKhoanKhachID = k.TaiKhoanKhachID) AS SoDon
      FROM TaiKhoanKhach k ORDER BY k.TenKhach`)).recordset;
    res.json({ success: true, data: rows });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: err.message }); }
});
router.post('/taikhoankhach', requireAuth, requirePermission('KHOHANG', 'create'), requireChucNang('KHOHANG', 'taikhoankhach'), async (req, res) => {
  try {
    const b = req.body || {};
    const tenDangNhap = String(b.tenDangNhap || '').trim();
    const matKhau = String(b.matKhau || '');
    const tenKhach = String(b.tenKhach || '').trim();
    if (!tenDangNhap || !tenKhach) return res.status(400).json({ success: false, message: 'Thiếu tên đăng nhập hoặc tên khách.' });
    if (matKhau.length < 4) return res.status(400).json({ success: false, message: 'Mật khẩu tối thiểu 4 ký tự.' });
    const pool = await getPool();
    const hash = await bcrypt.hash(matKhau, 10);
    const r = await pool.request()
      .input('u', sql.NVarChar, tenDangNhap).input('h', sql.NVarChar, hash).input('t', sql.NVarChar, tenKhach)
      .input('sdt', sql.NVarChar, b.sdt || null).input('em', sql.NVarChar, b.email || null)
      .input('dc', sql.NVarChar, b.diaChi || null).input('tt', sql.NVarChar, b.trangThai || 'Hoạt động')
      .input('gc', sql.NVarChar, b.ghiChu || null)
      .query(`INSERT INTO TaiKhoanKhach (TenDangNhap, MatKhauHash, TenKhach, SDT, Email, DiaChi, TrangThai, GhiChu)
              OUTPUT INSERTED.TaiKhoanKhachID VALUES (@u,@h,@t,@sdt,@em,@dc,@tt,@gc)`);
    res.json({ success: true, data: { TaiKhoanKhachID: r.recordset[0].TaiKhoanKhachID } });
  } catch (err) {
    console.error(err);
    if (err.number === 2627 || err.number === 2601) return res.status(400).json({ success: false, message: 'Tên đăng nhập này đã có người dùng.' });
    res.status(400).json({ success: false, message: err.message });
  }
});
router.put('/taikhoankhach/:id', requireAuth, requirePermission('KHOHANG', 'edit'), requireChucNang('KHOHANG', 'taikhoankhach'), async (req, res) => {
  try {
    const b = req.body || {};
    const pool = await getPool();
    const rq = pool.request().input('id', sql.Int, parseInt(req.params.id, 10))
      .input('t', sql.NVarChar, String(b.tenKhach || '').trim() || null)
      .input('sdt', sql.NVarChar, b.sdt || null).input('em', sql.NVarChar, b.email || null)
      .input('dc', sql.NVarChar, b.diaChi || null).input('tt', sql.NVarChar, b.trangThai || 'Hoạt động')
      .input('gc', sql.NVarChar, b.ghiChu || null);
    // Mật khẩu để TRỐNG khi sửa = giữ nguyên mật khẩu cũ (giống cách sửa máy chấm công).
    const matKhau = String(b.matKhau || '');
    rq.input('h', sql.NVarChar, matKhau ? await bcrypt.hash(matKhau, 10) : null);
    await rq.query(`UPDATE TaiKhoanKhach SET TenKhach=ISNULL(@t,TenKhach), SDT=@sdt, Email=@em, DiaChi=@dc,
                    TrangThai=@tt, GhiChu=@gc, MatKhauHash=ISNULL(@h, MatKhauHash) WHERE TaiKhoanKhachID=@id`);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: err.message }); }
});
router.delete('/taikhoankhach/:id', requireAuth, requirePermission('KHOHANG', 'delete'), requireChucNang('KHOHANG', 'taikhoankhach'), async (req, res) => {
  try {
    const pool = await getPool();
    // Giữ lịch sử đơn: gỡ liên kết trước rồi mới xóa tài khoản (đơn vẫn còn tên khách).
    await pool.request().input('id', sql.Int, req.params.id)
      .query('UPDATE DonKhachDatHang SET TaiKhoanKhachID=NULL WHERE TaiKhoanKhachID=@id');
    await pool.request().input('id', sql.Int, req.params.id)
      .query('DELETE FROM TaiKhoanKhach WHERE TaiKhoanKhachID=@id');
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: err.message }); }
});

// v5.46: XÓA HẲN 1 đơn đặt hàng. Nếu đơn CHƯA "Đã hủy" (tức vẫn đang trừ tồn) thì HOÀN tồn trước khi xóa.
router.delete('/orders/:id', requireAuth, requirePermission('KHOHANG', 'delete'), requireChucNang('KHOHANG', 'orders'), async (req, res) => {
  try {
    const pool = await getPool();
    const cur = (await pool.request().input('id', sql.Int, req.params.id).query('SELECT * FROM DonKhachDatHang WHERE DonID=@id')).recordset[0];
    if (!cur) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn.' });
    /* v6.23: đơn đã lên PHIẾU BÁN HÀNG thì chặn trước, báo câu dễ hiểu — nếu để SQL tự nổ FK
       (PhieuBanHangChiTiet.DonID) người dùng chỉ thấy nguyên văn lỗi "REFERENCE constraint". */
    if (await coBangPBH(pool)) {
      const gan = (await pool.request().input('id', sql.Int, req.params.id).query(`
        SELECT TOP 1 p.SoPhieu FROM PhieuBanHangChiTiet ct
        JOIN PhieuBanHang p ON p.PhieuBHID = ct.PhieuBHID WHERE ct.DonID = @id`)).recordset[0];
      if (gan) {
        return res.status(400).json({ success: false, message: `Không xóa được: đơn này nằm trong phiếu bán hàng ${gan.SoPhieu}. Hãy xóa/hủy phiếu bán hàng đó trước.` });
      }
    }
    // v5.63: chỉ hoàn tồn khi đơn ĐÃ TRỪ TỒN (đơn khách 'Chờ xác nhận' chưa trừ -> không cộng trả).
    const daTruTon = cur.DaTruTon === undefined || cur.DaTruTon === null ? (cur.TrangThai !== 'Đã hủy') : !!cur.DaTruTon;
    if (daTruTon) {
      const info = (await pool.request().input('id', sql.Int, cur.MaHangID).query('SELECT LoaiRi, DonViCoBan, DonViQuyDoi FROM TheKhoHangHoa WHERE MaHangID=@id')).recordset[0] || {};
      const slChinh = orderQtyToBase(cur.SoLuongDat, cur.DonVi, info.DonViCoBan, info.LoaiRi, info.DonViQuyDoi);
      await pool.request().input('mh', sql.Int, cur.MaHangID).input('ms', sql.Int, cur.MauSacID).input('sl', sql.Int, slChinh)
        .query('UPDATE TheKhoChiTietMau SET XuatCai = XuatCai - @sl WHERE MaHangID=@mh AND MauSacID=@ms');
    }
    await pool.request().input('id', sql.Int, req.params.id).query('DELETE FROM DonKhachDatHang WHERE DonID=@id');
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Lỗi khi xóa đơn: ' + err.message });
  }
});

// v5.49: SỬA 1 đơn đặt hàng (tên khách / mã hàng / màu / SL / đơn vị). Tính lại tồn: hoàn số cũ + trừ số
// mới (theo đơn vị chính), validate đủ tồn TRƯỚC khi ghi. Đơn "Đã hủy" chỉ sửa thông tin, không đụng tồn.
router.put('/orders/:id', requireAuth, requirePermission('KHOHANG', 'edit'), requireChucNang('KHOHANG', 'orders'), async (req, res) => {
  try {
    const pool = await getPool();
    const cur = (await pool.request().input('id', sql.Int, req.params.id).query('SELECT * FROM DonKhachDatHang WHERE DonID=@id')).recordset[0];
    if (!cur) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn.' });
    const { tenKhach, maHangId, mauSacId, soLuong, donVi } = req.body;
    if (!tenKhach || !maHangId || !mauSacId) return res.status(400).json({ success: false, message: 'Thiếu tên khách / mã hàng / màu.' });
    const newSL = Number(soLuong) || 0;
    if (newSL <= 0) return res.status(400).json({ success: false, message: 'Số lượng phải lớn hơn 0.' });
    /* v6.31: TRUOC day ep cung 2 gia tri -> moi don vi khac (Bộ, Tá...) bi NUOT thanh 'Cái'.
       Nay chi nhan don vi HOP LE cua chinh ma hang do (DVT chinh hoac DVT quy doi). */
    const itemDV = (await pool.request().input('id', sql.Int, maHangId)
      .query('SELECT DonViCoBan, DonViQuyDoi FROM TheKhoHangHoa WHERE MaHangID=@id')).recordset[0] || {};
    const dvGo = String(donVi || '').trim();
    const newDonVi = (dvGo && (dvGo === String(itemDV.DonViCoBan || '').trim()
                            || dvGo === String(itemDV.DonViQuyDoi || '').trim()))
      ? dvGo : (itemDV.DonViCoBan || 'Cái');
    const newItem = (await pool.request().input('id', sql.Int, maHangId).query('SELECT LoaiRi, DonViCoBan, DonViQuyDoi FROM TheKhoHangHoa WHERE MaHangID=@id')).recordset[0];
    if (!newItem) return res.status(400).json({ success: false, message: 'Mã hàng không tồn tại.' });
    /* v6.23: đơn ĐÃ XUẤT HÀNG (có phiếu bán hàng) thì KHÔNG sửa ở đây — sửa số lượng mà tồn đã trừ theo
       phiếu sẽ làm lệch cả tồn lẫn công nợ. Muốn sửa: hủy phiếu bán hàng để hệ thống hoàn tồn đúng. */
    if (String(cur.TrangThai) === 'Đã xuất hàng' || cur.PhieuBHID) {
      return res.status(400).json({ success: false, message: 'Đơn này đã có PHIẾU BÁN HÀNG (đã xuất hàng). Hãy hủy phiếu bán hàng đó trước rồi mới sửa đơn.' });
    }
    /* v6.23 (SỬA LỖI NẶNG): điều kiện cũ là `TrangThai !== 'Đã hủy'` — sai từ v6.23 vì đơn mới KHÔNG
       trừ tồn nữa. Với đơn DaTruTon = 0, "hoàn số cũ" là hoàn một lượng chưa bao giờ bị trừ ⇒ tồn PHỒNG.
       Nay chỉ đụng tồn khi đơn THỰC SỰ đã trừ (dữ liệu cũ trước v6.23); đơn mới chỉ kiểm TỒN KHẢ DỤNG. */
    const daTruTonCu = cur.DaTruTon === undefined || cur.DaTruTon === null
      ? (cur.TrangThai !== 'Đã hủy')     // CSDL chưa có cột (trước migration_v657): giữ hành vi cũ
      : !!cur.DaTruTon;
    const deducting = daTruTonCu;
    const newChinh = orderQtyToBase(newSL, newDonVi, newItem.DonViCoBan, newItem.LoaiRi, newItem.DonViQuyDoi);

    if (!deducting && cur.TrangThai !== 'Đã hủy') {
      // Đơn chỉ đang GIỮ hàng: kiểm tồn khả dụng, trừ phần chính đơn này đang giữ ra.
      const giu = await layHangDangGiu(pool);
      const rowNew = (await pool.request().input('mh', sql.Int, maHangId).input('ms', sql.Int, mauSacId)
        .query('SELECT NhapCai, XuatCai FROM TheKhoChiTietMau WHERE MaHangID=@mh AND MauSacID=@ms')).recordset[0];
      const tonNew = rowNew ? Number(rowNew.NhapCai) - Number(rowNew.XuatCai) : 0;
      const oldItem = (await pool.request().input('id', sql.Int, cur.MaHangID).query('SELECT LoaiRi, DonViCoBan, DonViQuyDoi FROM TheKhoHangHoa WHERE MaHangID=@id')).recordset[0] || {};
      const oldChinh = orderQtyToBase(cur.SoLuongDat, cur.DonVi, oldItem.DonViCoBan, oldItem.LoaiRi, oldItem.DonViQuyDoi);
      const sameMau = String(cur.MaHangID) === String(maHangId) && String(cur.MauSacID) === String(mauSacId);
      const giuKhac = Math.max(0, (giu.theoMau.get(maHangId + '|' + mauSacId) || 0) - (sameMau ? oldChinh : 0));
      const khaDung = tonNew - giuKhac;
      if (newChinh > khaDung) {
        return res.status(400).json({ success: false, message: `Không đủ tồn khả dụng cho mã/màu mới: cần ${newChinh}, khả dụng ${khaDung} (tồn kho ${tonNew}, đang giữ cho đơn khác ${giuKhac}) — theo đơn vị chính.` });
      }
    }

    if (deducting) {
      const oldItem = (await pool.request().input('id', sql.Int, cur.MaHangID).query('SELECT LoaiRi, DonViCoBan, DonViQuyDoi FROM TheKhoHangHoa WHERE MaHangID=@id')).recordset[0] || {};
      const oldChinh = orderQtyToBase(cur.SoLuongDat, cur.DonVi, oldItem.DonViCoBan, oldItem.LoaiRi, oldItem.DonViQuyDoi);
      const sameMau = String(cur.MaHangID) === String(maHangId) && String(cur.MauSacID) === String(mauSacId);
      const rowNew = (await pool.request().input('mh', sql.Int, maHangId).input('ms', sql.Int, mauSacId)
        .query('SELECT NhapCai, XuatCai FROM TheKhoChiTietMau WHERE MaHangID=@mh AND MauSacID=@ms')).recordset[0];
      const tonNew = rowNew ? Number(rowNew.NhapCai) - Number(rowNew.XuatCai) : 0;
      const available = tonNew + (sameMau ? oldChinh : 0);   // nếu cùng màu: hoàn số cũ sẽ trả lại phần này
      if (newChinh > available) return res.status(400).json({ success: false, message: `Không đủ tồn kho cho mã/màu mới: cần ${newChinh}, còn ${available} (đơn vị chính).` });
      // Hoàn số cũ rồi trừ số mới (đã validate ở trên nên không cần rollback).
      await pool.request().input('mh', sql.Int, cur.MaHangID).input('ms', sql.Int, cur.MauSacID).input('sl', sql.Int, oldChinh)
        .query('UPDATE TheKhoChiTietMau SET XuatCai = XuatCai - @sl WHERE MaHangID=@mh AND MauSacID=@ms');
      const existNew = (await pool.request().input('mh', sql.Int, maHangId).input('ms', sql.Int, mauSacId)
        .query('SELECT ID FROM TheKhoChiTietMau WHERE MaHangID=@mh AND MauSacID=@ms')).recordset[0];
      if (existNew) await pool.request().input('id', sql.Int, existNew.ID).input('sl', sql.Int, newChinh).query('UPDATE TheKhoChiTietMau SET XuatCai = XuatCai + @sl WHERE ID=@id');
      else await pool.request().input('mh', sql.Int, maHangId).input('ms', sql.Int, mauSacId).input('sl', sql.Int, newChinh).query('INSERT INTO TheKhoChiTietMau (MaHangID, MauSacID, SoCatCai, NhapCai, XuatCai) VALUES (@mh, @ms, 0, 0, @sl)');
    }
    await pool.request().input('id', sql.Int, req.params.id)
      .input('tk', sql.NVarChar, tenKhach).input('mh', sql.Int, maHangId).input('ms', sql.Int, mauSacId)
      .input('sl', sql.Int, newSL).input('dv', sql.NVarChar, newDonVi)
      .query('UPDATE DonKhachDatHang SET TenKhach=@tk, MaHangID=@mh, MauSacID=@ms, SoLuongDat=@sl, DonVi=@dv WHERE DonID=@id');
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(400).json({ success: false, message: 'Lỗi khi sửa đơn: ' + err.message }); }
});

// Tra ve: thong tin the kho (de biet LoaiRi/DonViCoBan/DonViQuyDoi ma frontend dung quy doi nhan hien thi),
// chi tiet theo mau (Nhap/Xuat/Ton tung mau) va lich su don khach dat hang (giu nguyen nhu truoc).
router.get('/items/:maHang/history', requireAuth, requirePermission('KHOHANG', 'view'), requireChucNang('KHOHANG', 'items'), async (req, res) => {
  try {
    const pool = await getPool();
    const maHang = req.params.maHang;

    // v5.4 (muc 1): them AnhDaiDien de "chi tiet ma hang" hien duoc anh dai dien + cho phong to.
    const hangInfoResult = await pool.request().input('mh', sql.NVarChar, maHang)
      .query('SELECT MaHangID, MaHang, TenHang, LoaiRi, DonViCoBan, DonViQuyDoi, AnhDaiDien FROM TheKhoHangHoa WHERE MaHang=@mh');
    if (!hangInfoResult.recordset.length) return res.status(404).json({ success: false, message: 'Không tìm thấy mã hàng.' });
    const hangInfo = hangInfoResult.recordset[0];

    // v5.0: bo sung MauSacID (de goi "Dat hang nhanh" dung dung mau) + LinkAnh (de hien cot Anh theo
      // tung mau, xem yeu cau muc 4b) - truoc day query nay khong lay 2 cot nay.
    const colorDetailResult = await pool.request().input('mh', sql.NVarChar, maHang).query(`
      SELECT ct.MauSacID, ms.TenMau, ct.LinkAnh, ct.GhiChu, ct.NhapCai, ct.XuatCai, (ct.NhapCai - ct.XuatCai) AS TonCai
      FROM TheKhoChiTietMau ct
      JOIN MauSac ms ON ms.MauSacID = ct.MauSacID
      JOIN TheKhoHangHoa h ON h.MaHangID = ct.MaHangID
      WHERE h.MaHang = @mh ORDER BY ms.TenMau`);

    const ordersResult = await pool.request().input('mh', sql.NVarChar, maHang).query(`
      SELECT o.DonID, o.MaHangID, o.MauSacID, h.MaHang, o.ThoiGian, o.TenKhach, ms.TenMau, o.SoLuongDat, o.DonVi, o.TrangThai,
             h.GiaBan, h.LoaiRi, h.DonViCoBan, h.DonViQuyDoi   /* v6.21.1: từ đây cũng in được bảng kê (giá + SL quy ra Cái) */
      FROM DonKhachDatHang o
      JOIN TheKhoHangHoa h ON h.MaHangID = o.MaHangID
      JOIN MauSac ms ON ms.MauSacID = o.MauSacID
      WHERE h.MaHang = @mh ORDER BY o.ThoiGian DESC`);

    res.json({ success: true, data: { hangInfo, colorDetail: colorDetailResult.recordset, orders: ordersResult.recordset } });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Lỗi khi lấy lịch sử: ' + err.message });
  }
});

// ============ BAO GIA ALOHA (v5.17, muc 1.2) ============
// 12 cot "de trong" dung theo dung chu thich trong file mau nguoi dung cung cap (filebaogia.xlsx):
// Gia ban de xuat, Ty le tren gia von, Ty le tren gia ban, Ty le lai tham chieu (J-M) + 11 cot chi
// nhanh/huyen + Tong cong (Q-AB) - khong co nguon du lieu tuong ung trong QLNoiBo.
const BAOGIA_DISTRICT_COLS = [
  'Cẩm Khê', 'Thanh Sơn', 'Đoan Hùng', 'Phú Thọ', 'Hạ hòa', 'Lâm Thao',
  'Yên Lập', 'Đồng Bẩm', 'Sông Công', 'Đầm Hà', 'Đông Triều'
];

// Ma hang DA tung xuat hien trong BAT KY bao gia nao (khong chi bao gia gan nhat) se KHONG con trong
// danh sach nay - dung UNIQUE tren BaoGiaAlohaChiTiet.MaHangID, xem migration_v517.sql ve ly do chon
// "loai tru vinh vien trong toan bo lich su" thay vi "chi loai tru khoi bao gia gan nhat".
// v5.19 (muc 2.1, yeu cau "Sửa" báo giá): them query param excludeBaoGiaId TUY CHON - khi dang SUA 1
// bao gia co san, cac ma hang DA thuoc CHINH bao gia dang sua van phai hien ra trong danh sach chon
// (khong thi nguoi dung se "mat" nhung dong da chon tu truoc, tuong nhu bi loai bo trong khi thuc ra
// chi dang duoc sua). Tao moi (khong truyen excludeBaoGiaId) giu nguyen hanh vi cu.
router.get('/baogia/candidates', requireAuth, requirePermission('KHOHANG', 'view'), requireChucNang('KHOHANG', 'baogiaaloha'), async (req, res) => {
  try {
    const pool = await getPool();
    const excludeBaoGiaId = req.query.excludeBaoGiaId ? Number(req.query.excludeBaoGiaId) : null;
    const result = await pool.request().input('excludeBaoGiaId', sql.Int, excludeBaoGiaId).query(`
      /* v6.61: Bao gia Aloha lay thang GIA BAN cua the kho, bo han truong "Gia Aloha" rieng.
         Hai o gia song song luon lech nhau: sua gia ban ma quen sua gia Aloha la bao gia gui khach
         sai gia, khong co gi bao. Giu ALIAS GiaAloha de moi cho doc phia sau (frontend, Excel,
         ban in) khong phai sua theo. Cot TheKhoHangHoa.GiaAloha van con trong CSDL, khong xoa -
         du lieu cu giu nguyen, chi la khong dung va khong cho nhap nua.
         LUU Y: chu thich nay nam BEN TRONG chuoi template cua cau SQL -> TUYET DOI khong duoc go
         dau backtick vao day, no se ket thuc chuoi va lam sap ca file. */
      SELECT h.MaHangID, h.MaHang, h.TenHang, h.GiaBan AS GiaAloha, h.MaBarcode, h.AnhDaiDien, h.LoaiRi,
        (SELECT COUNT(*) FROM TheKhoChiTietMau ct WHERE ct.MaHangID = h.MaHangID) AS SoMau
      FROM TheKhoHangHoa h
      WHERE NOT EXISTS (
        SELECT 1 FROM BaoGiaAlohaChiTiet bc WHERE bc.MaHangID = h.MaHangID
          AND (@excludeBaoGiaId IS NULL OR bc.BaoGiaAlohaID <> @excludeBaoGiaId)
      )
      ORDER BY h.MaHang`);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Lỗi khi lấy danh sách mã hàng chưa báo giá: ' + err.message });
  }
});

router.get('/baogia', requireAuth, requirePermission('KHOHANG', 'view'), requireChucNang('KHOHANG', 'baogiaaloha'), async (req, res) => {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT b.*, u.HoTen AS NguoiTao,
      (SELECT COUNT(*) FROM BaoGiaAlohaChiTiet WHERE BaoGiaAlohaID = b.ID) AS SoLuongMaHang
    FROM BaoGiaAloha b
    LEFT JOIN Users u ON u.UserID = b.NguoiTaoID
    ORDER BY b.CreatedAt DESC`);
  res.json({ success: true, data: result.recordset });
});

router.get('/baogia/:id', requireAuth, requirePermission('KHOHANG', 'view'), requireChucNang('KHOHANG', 'baogiaaloha'), async (req, res) => {
  try {
    const pool = await getPool();
    const headerResult = await pool.request().input('id', sql.Int, req.params.id).query(`
      SELECT b.*, u.HoTen AS NguoiTao FROM BaoGiaAloha b
      LEFT JOIN Users u ON u.UserID = b.NguoiTaoID WHERE b.ID = @id`);
    if (!headerResult.recordset.length) return res.status(404).json({ success: false, message: 'Không tìm thấy báo giá.' });
    const itemsResult = await pool.request().input('id', sql.Int, req.params.id).query(`
      SELECT ct.ID, ct.MaHangID, ct.PhanTramVAT, ct.ThuTu, h.MaHang, h.TenHang, h.GiaBan AS GiaAloha, h.MaBarcode, h.AnhDaiDien, h.LoaiRi,
        (SELECT COUNT(*) FROM TheKhoChiTietMau c2 WHERE c2.MaHangID = h.MaHangID) AS SoMau
      FROM BaoGiaAlohaChiTiet ct
      JOIN TheKhoHangHoa h ON h.MaHangID = ct.MaHangID
      WHERE ct.BaoGiaAlohaID = @id ORDER BY ct.ThuTu, ct.ID`);
    res.json({ success: true, data: { header: headerResult.recordset[0], items: itemsResult.recordset } });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Lỗi khi lấy chi tiết báo giá: ' + err.message });
  }
});

router.post('/baogia', requireAuth, requirePermission('KHOHANG', 'create'), requireChucNang('KHOHANG', 'baogiaaloha'), async (req, res) => {
  const { tenBaoGia, tenCongTySanXuatNhapKhau, maNCC, tenNCC, ghiChu, items } = req.body;
  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ success: false, message: 'Chưa chọn mã hàng nào cho báo giá.' });
  }
  const ids = items.map(i => Number(i.maHangId)).filter(Boolean);
  if (!ids.length) return res.status(400).json({ success: false, message: 'Danh sách mã hàng không hợp lệ.' });

  let transaction;
  try {
    const pool = await getPool();

    // Kiem tra TRUOC (khong ghi gi): ma hang nao trong danh sach chon da tung xuat hien o bao gia
    // khac - tra loi 400 kem ten ma hang cu the, tranh de SQL Server nem loi UNIQUE constraint kho
    // hieu (giong dung cach lam voi POST /orders o tren cho ton kho).
    const dupCheck = await pool.request().query(`
      SELECT h.MaHang FROM BaoGiaAlohaChiTiet bc JOIN TheKhoHangHoa h ON h.MaHangID = bc.MaHangID
      WHERE bc.MaHangID IN (${ids.join(',')})`);
    if (dupCheck.recordset.length) {
      return res.status(400).json({
        success: false,
        message: 'Các mã hàng sau đã có trong báo giá khác, không thể chọn lại: ' + dupCheck.recordset.map(r => r.MaHang).join(', ')
      });
    }

    transaction = new sql.Transaction(pool);
    await transaction.begin();
    const user = req.session.user;
    const headerIns = await new sql.Request(transaction)
      .input('TenBaoGia', sql.NVarChar, tenBaoGia || null)
      .input('TenCTy', sql.NVarChar, tenCongTySanXuatNhapKhau || null)
      .input('MaNCC', sql.NVarChar, maNCC || null)
      .input('TenNCC', sql.NVarChar, tenNCC || null)
      .input('GhiChu', sql.NVarChar, ghiChu || null)
      .input('NguoiTaoID', sql.Int, user.userId)
      .query(`INSERT INTO BaoGiaAloha (TenBaoGia, TenCongTySanXuatNhapKhau, MaNCC, TenNCC, GhiChu, NguoiTaoID)
              OUTPUT INSERTED.ID VALUES (@TenBaoGia, @TenCTy, @MaNCC, @TenNCC, @GhiChu, @NguoiTaoID)`);
    const baoGiaId = headerIns.recordset[0].ID;

    let thuTu = 0;
    for (const it of items) {
      const maHangId = Number(it.maHangId);
      if (!maHangId) continue;
      const vat = it.phanTramVAT !== undefined && it.phanTramVAT !== null && it.phanTramVAT !== '' ? Number(it.phanTramVAT) : 0.08;
      await new sql.Request(transaction)
        .input('BaoGiaAlohaID', sql.Int, baoGiaId)
        .input('MaHangID', sql.Int, maHangId)
        .input('PhanTramVAT', sql.Decimal(5, 4), vat)
        .input('ThuTu', sql.Int, thuTu++)
        .query(`INSERT INTO BaoGiaAlohaChiTiet (BaoGiaAlohaID, MaHangID, PhanTramVAT, ThuTu)
                VALUES (@BaoGiaAlohaID, @MaHangID, @PhanTramVAT, @ThuTu)`);
    }
    await transaction.commit();
    res.json({ success: true, data: { id: baoGiaId } });
  } catch (err) {
    if (transaction) { try { await transaction.rollback(); } catch (_) { /* transaction co the chua begin hoac da roi lack - bo qua loi rollback kep */ } }
    console.error(err);
    // Bay du phong cho truong hop dua (2 nguoi cung luu gan nhu dong thoi, trung 1 ma hang) - UNIQUE
    // constraint tren BaoGiaAlohaChiTiet.MaHangID se chan o tang DB du da kiem tra truoc o tren.
    const msg = /UNIQUE|duplicate/i.test(err.message)
      ? 'Một hoặc nhiều mã hàng vừa được báo giá bởi người khác, vui lòng tải lại danh sách và chọn lại.'
      : 'Lỗi khi lưu báo giá: ' + err.message;
    res.status(400).json({ success: false, message: msg });
  }
});

// v5.19 (muc 2.1, yeu cau "Tạo báo giá Aloha: thêm chức năng sửa"): thay THE header + XOA HET/ghi lai
// toan bo chi tiet (giong cach POST tao moi lam, don gian hon "diff" tung dong) - van trong 1
// transaction. Kiem tra trung LOAI TRU chinh bao gia dang sua (id nay) truoc khi ghi, giong dupCheck
// cua POST nhung co them "AND bc.BaoGiaAlohaID <> @id".
router.put('/baogia/:id', requireAuth, requirePermission('KHOHANG', 'edit'), requireChucNang('KHOHANG', 'baogiaaloha'), async (req, res) => {
  const { tenBaoGia, tenCongTySanXuatNhapKhau, maNCC, tenNCC, ghiChu, items } = req.body;
  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ success: false, message: 'Chưa chọn mã hàng nào cho báo giá.' });
  }
  const ids = items.map(i => Number(i.maHangId)).filter(Boolean);
  if (!ids.length) return res.status(400).json({ success: false, message: 'Danh sách mã hàng không hợp lệ.' });

  let transaction;
  try {
    const pool = await getPool();
    const baoGiaId = Number(req.params.id);
    const existing = await pool.request().input('id', sql.Int, baoGiaId).query('SELECT ID FROM BaoGiaAloha WHERE ID=@id');
    if (!existing.recordset.length) return res.status(404).json({ success: false, message: 'Không tìm thấy báo giá.' });

    const dupCheck = await pool.request().input('id', sql.Int, baoGiaId).query(`
      SELECT h.MaHang FROM BaoGiaAlohaChiTiet bc JOIN TheKhoHangHoa h ON h.MaHangID = bc.MaHangID
      WHERE bc.MaHangID IN (${ids.join(',')}) AND bc.BaoGiaAlohaID <> @id`);
    if (dupCheck.recordset.length) {
      return res.status(400).json({
        success: false,
        message: 'Các mã hàng sau đã có trong báo giá khác, không thể chọn lại: ' + dupCheck.recordset.map(r => r.MaHang).join(', ')
      });
    }

    transaction = new sql.Transaction(pool);
    await transaction.begin();
    await new sql.Request(transaction)
      .input('id', sql.Int, baoGiaId)
      .input('TenBaoGia', sql.NVarChar, tenBaoGia || null)
      .input('TenCTy', sql.NVarChar, tenCongTySanXuatNhapKhau || null)
      .input('MaNCC', sql.NVarChar, maNCC || null)
      .input('TenNCC', sql.NVarChar, tenNCC || null)
      .input('GhiChu', sql.NVarChar, ghiChu || null)
      .query(`UPDATE BaoGiaAloha SET TenBaoGia=@TenBaoGia, TenCongTySanXuatNhapKhau=@TenCTy, MaNCC=@MaNCC, TenNCC=@TenNCC, GhiChu=@GhiChu WHERE ID=@id`);

    await new sql.Request(transaction).input('id', sql.Int, baoGiaId).query('DELETE FROM BaoGiaAlohaChiTiet WHERE BaoGiaAlohaID=@id');

    let thuTu = 0;
    for (const it of items) {
      const maHangId = Number(it.maHangId);
      if (!maHangId) continue;
      const vat = it.phanTramVAT !== undefined && it.phanTramVAT !== null && it.phanTramVAT !== '' ? Number(it.phanTramVAT) : 0.08;
      await new sql.Request(transaction)
        .input('BaoGiaAlohaID', sql.Int, baoGiaId)
        .input('MaHangID', sql.Int, maHangId)
        .input('PhanTramVAT', sql.Decimal(5, 4), vat)
        .input('ThuTu', sql.Int, thuTu++)
        .query(`INSERT INTO BaoGiaAlohaChiTiet (BaoGiaAlohaID, MaHangID, PhanTramVAT, ThuTu)
                VALUES (@BaoGiaAlohaID, @MaHangID, @PhanTramVAT, @ThuTu)`);
    }
    await transaction.commit();
    res.json({ success: true });
  } catch (err) {
    if (transaction) { try { await transaction.rollback(); } catch (_) { /* transaction co the chua begin hoac da roi lack - bo qua loi rollback kep */ } }
    console.error(err);
    const msg = /UNIQUE|duplicate/i.test(err.message)
      ? 'Một hoặc nhiều mã hàng vừa được báo giá bởi người khác, vui lòng tải lại danh sách và chọn lại.'
      : 'Lỗi khi cập nhật báo giá: ' + err.message;
    res.status(400).json({ success: false, message: msg });
  }
});

router.delete('/baogia/:id', requireAuth, requirePermission('KHOHANG', 'delete'), requireChucNang('KHOHANG', 'baogiaaloha'), async (req, res) => {
  try {
    const pool = await getPool();
    // ON DELETE CASCADE tren BaoGiaAlohaChiTiet.BaoGiaAlohaID (migration_v517.sql) tu xoa cac dong
    // chi tiet - vua xoa header vua "tra lai" cac ma hang do cho lan bao gia sau (dung y muc dich).
    const result = await pool.request().input('id', sql.Int, req.params.id).query('DELETE FROM BaoGiaAloha WHERE ID=@id');
    if (!result.rowsAffected[0]) return res.status(404).json({ success: false, message: 'Không tìm thấy báo giá.' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Lỗi khi xóa báo giá: ' + err.message });
  }
});

// Xuat Excel 1 bao gia, dung lai bo cuc file mau nguoi dung cung cap (filebaogia.xlsx), doi chieu qua
// Python/openpyxl truoc khi code: dong 1-2 tieu de cong ty, dong 3 ten bao cao, dong 5 header 28 cot
// (A..AB), tu dong 6 la du lieu (1 dong/1 ma hang). Cot B/C/D (Tên Công ty SX/NK, Mã NCC, Tên NCC) gop
// o (merge) xuyen suot cac dong du lieu vi la thong tin CHUNG cho ca bao gia, khong doi tung dong -
// bang chung la file mau da merge san B6:B11/D6:D11 (gop C them cho dong bo, file mau chi gop B/D).
// Cot Sau VAT dung cong thuc chuan "giá trước VAT × (1 + %VAT)" (file mau ghi tat la "giá trước VAT x
// % VAT"). Cac cot KHONG co nguon du lieu tuong ung trong QLNoiBo (J-M, 11 cot chi nhanh, Tong cong)
// duoc de TRONG dung theo chinh chu thich "bỏ trống" trong file mau.
// v5.18 (muc 2.1.2): cot "Hình ảnh sp" gio NHUNG anh dai dien that (TheKhoHangHoa.AnhDaiDien) vao file
// xuat - truoc day (v5.17) de trong vi chua dieu tra ky dinh dang luu tru.
// v5.18.1 (SUA LOI THUC TE - anh KHONG nhung duoc, nguoi dung bao lai sau khi da deploy dung v5.18):
// gia dinh ban dau "AnhDaiDien la chuoi data URL (data:image/...;base64,...)" LA SAI - da suy ra tu
// cach doc (frontend hien <img src="${AnhDaiDien}">, ca 2 dang data-URL VA duong dan tuong doi deu hien
// dung nhu nhau qua <img src>, nen khong phan biet duoc chi bang cach do). Truy lai DUNG luong GHI (nguon
// su that) moi phat hien: module.khohang.js goi `anhDaiDien = await uploadFile(file, ...)`, va
// uploadFile() (common.js) POST multipart toi /api/upload (backend/routes/upload.js, dung multer luu
// FILE THAT xuong dia tai backend/uploads/<ten file>) roi CHI tra ve `data.url` = "/uploads/<ten file>"
// - 1 DUONG DAN TUONG DOI, khong phai chuoi anh nhung san. Voi gia dinh cu, regex data-URL khong khop,
// code roi vao nhanh "coi nhu chuoi base64 thuan" va base64-decode NGUYEN VAN chuoi "/uploads/xxx.jpg"
// -> ra du lieu rac -> sharp() luon throw -> catch() o duoi lam ROI VAO IM LANG cho MOI anh, khong 1
// anh nao nhung duoc - dung 100% trieu chung nguoi dung bao ("đã kiểm tra... file excel chưa có hình
// ảnh"), khong phai loi deploy/thieu du lieu. anhToPngBuffer() ben duoi da sua de doc THANG tu dia khi
// gap dung dang "/uploads/..." (nhanh chinh, THAT SU dung trong ung dung nay), van giu nhanh data-URL
// lam du phong (phong khi co nguon du lieu khac trong tuong lai).
//
// CHUAN HOA qua sharp (xem anhToPngBuffer() ben duoi) truoc khi giao cho exceljs - exceljs Workbook#
// addImage() ban than CHI thuc su ho tro 3 dinh dang (png/jpeg/gif); anh dai dien co the o dinh dang
// khac (webp, heif...) tuy nguoi dung tai len, va sharp.png() lam viec nay dang tin cay hon la tu gioi
// han danh sach dinh dang - decode ANH BAT KY sharp doc duoc roi ma hoa lai thanh PNG (KHONG resize/nen
// mat chi tiet - PNG von la dinh dang khong mat du lieu, chi doi "vo" dinh dang, giu nguyen chat luong
// anh goc). Van boc try/catch RIENG cho TUNG anh (file khong doc duoc/duong dan hong) - chi lam dong DO
// thieu anh, khong lam hong ca file xuat.
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads'); // khop dung backend/routes/upload.js

// v5.18 (muc 2.1.2, yeu cau "hàm bổ trợ... tự động nén/chuyển đổi bất kỳ ảnh nào thành PNG... nhưng
// chất lượng ảnh không được thay đổi"): chuan hoa 1 anh dai dien (BAT KY dinh dang sharp doc duoc - jpeg/
// png/webp/gif/tiff/svg/heif...) thanh 1 Buffer PNG de dua cho exceljs Workbook#addImage({buffer,...}).
// Nhan vao Buffer, duong dan tuong doi kieu "/uploads/xxx" (DANG THAT SU dung trong ung dung nay - xem
// ghi chu v5.18.1 o tren), hoac chuoi data URL day du (du phong, khong dung trong thuc te hien tai).
// KHONG tu fetch tu 1 URL http(s) ben ngoai - neu sau nay co nguon du lieu kieu do, can fetch() rieng
// truoc roi truyen Buffer vao day.
//
// "Không được thay đổi chất lượng": PNG la dinh dang KHONG MAT DU LIEU (lossless) - sharp() giai ma anh
// goc thanh pixel roi ma hoa lai nguyen ven sang PNG, KHONG resize/crop/giam do phan giai. compressionLevel
// CHI anh huong toc do nen/dung luong file, KHONG anh huong chat luong hien thi (van la cung 1 mang pixel,
// chi khac cach nen lossless o muc byte) - dat cao nhat (9) de file .xlsx sinh ra nho gon hon khi co nhieu anh.
async function anhToPngBuffer(input) {
  let buf;
  if (Buffer.isBuffer(input)) {
    buf = input;
  } else if (typeof input === 'string' && input.startsWith('/uploads/')) {
    // path.basename() chan path traversal (vd "/uploads/../../server.js") - luon chi doc dung trong
    // UPLOAD_DIR, khong cho phep chuoi du lieu (tu du lieu cu/bi sua tay trong DB) doc file ngoai y muon.
    buf = fs.readFileSync(path.join(UPLOAD_DIR, path.basename(input)));
  } else if (typeof input === 'string') {
    const m = /^data:image\/[a-z0-9.+-]+;base64,(.+)$/i.exec(input);
    if (!m) throw new Error('Không nhận diện được định dạng dữ liệu ảnh (không phải đường dẫn /uploads/... hay chuỗi data URL).');
    buf = Buffer.from(m[1], 'base64');
  } else {
    throw new Error('Định dạng dữ liệu ảnh không hợp lệ (không phải Buffer, đường dẫn hay chuỗi data URL).');
  }
  return sharp(buf).png({ compressionLevel: 9 }).toBuffer();
}

router.get('/baogia/:id/export', requireAuth, requirePermission('KHOHANG', 'view'), requireChucNang('KHOHANG', 'baogiaaloha'), async (req, res) => {
  try {
    const pool = await getPool();
    const headerResult = await pool.request().input('id', sql.Int, req.params.id).query('SELECT * FROM BaoGiaAloha WHERE ID=@id');
    if (!headerResult.recordset.length) return res.status(404).json({ success: false, message: 'Không tìm thấy báo giá.' });
    const header = headerResult.recordset[0];
    const itemsResult = await pool.request().input('id', sql.Int, req.params.id).query(`
      SELECT ct.PhanTramVAT, ct.ThuTu, h.MaHang, h.TenHang, h.GiaBan AS GiaAloha, h.MaBarcode, h.LoaiRi, h.AnhDaiDien,
        (SELECT COUNT(*) FROM TheKhoChiTietMau c2 WHERE c2.MaHangID = h.MaHangID) AS SoMau
      FROM BaoGiaAlohaChiTiet ct
      JOIN TheKhoHangHoa h ON h.MaHangID = ct.MaHangID
      WHERE ct.BaoGiaAlohaID = @id ORDER BY ct.ThuTu, ct.ID`);
    const items = itemsResult.recordset;

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('BaoGia');
    ws.pageSetup.orientation = 'landscape';
    ws.pageSetup.paperSize = 9;
    ws.pageSetup.fitToPage = true;
    ws.pageSetup.fitToWidth = 1;
    ws.pageSetup.fitToHeight = 0;

    const HEADERS = [
      'STT', 'Tên Công ty Sản Xuất/ Nhập Khẩu', 'MÃ NCC', 'Tên NCC',
      'Tên sản phẩm (trên hóa đơn VAT)', 'Mã Barcode', 'Giá trước VAT', '% VAT',
      'Sau VAT ( áp dụng thuế suất 8%...10%)', 'Giá bán đề xuất', 'Tỷ lệ trên giá vốn',
      'Tỷ lệ trên giá bán', 'Tỷ lệ lãi tham chiếu', 'Hình ảnh sp', 'Số mầu', 'Số cái/ 1 ri',
      ...BAOGIA_DISTRICT_COLS, 'Tổng cộng'
    ];
    const COL_COUNT = HEADERS.length; // 28 cot (A..AB)
    const THIN = { style: 'thin' };
    const BORDER_ALL = { top: THIN, bottom: THIN, left: THIN, right: THIN };
    const FONT_NAME = 'Times New Roman';

    ws.mergeCells(1, 1, 1, COL_COUNT);
    ws.getCell(1, 1).value = 'Phòng mua hàng';
    ws.getCell(1, 1).font = { name: FONT_NAME, size: 12, bold: true, italic: true };
    ws.getCell(1, 1).alignment = { horizontal: 'left', vertical: 'center' };

    ws.mergeCells(2, 1, 2, COL_COUNT);
    ws.getCell(2, 1).value = 'CÔNG TY TNHH THÁI HƯNG';
    ws.getCell(2, 1).font = { name: FONT_NAME, size: 12, bold: true };
    ws.getCell(2, 1).alignment = { horizontal: 'left', vertical: 'center' };

    ws.mergeCells(3, 1, 3, COL_COUNT);
    ws.getCell(3, 1).value = 'DANH SÁCH CÁC MẶT HÀNG MỞ MÃ MỚI';
    ws.getCell(3, 1).font = { name: FONT_NAME, size: 16, bold: true };
    ws.getCell(3, 1).alignment = { horizontal: 'center', vertical: 'center' };

    const HEADER_ROW = 5;
    HEADERS.forEach((h, idx) => {
      const cell = ws.getCell(HEADER_ROW, idx + 1);
      cell.value = h;
      cell.font = { name: FONT_NAME, size: 12, bold: true };
      cell.alignment = { horizontal: 'center', vertical: 'center', wrapText: true };
      cell.border = BORDER_ALL;
    });
    ws.getRow(HEADER_ROW).height = 46.5;

    const DATA_START = HEADER_ROW + 1;
    // v5.18: doi tu items.forEach(...) sang for-of THUONG - can await anhToPngBuffer() (sharp, bat dong
    // bo) o TRONG vong lap truoc khi ghi file (writeBuffer() ben duoi) - forEach() KHONG cho phep dung
    // await de "cho" callback bat dong bo hoan tat (forEach khong doi Promise callback tra ve), du co
    // dung tu khoa async truoc callback cung vay - se chay callback SONG SONG khong dong bo va co the
    // ghi file TRUOC khi anh kip nhung vao, gay mat/thieu anh ngau nhien (loi thuc te da tranh duoc nho
    // kiem tra ky truoc khi hoan thanh, khong phai da xay ra roi moi sua).
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const r = DATA_START + i;
      const vat = Number(it.PhanTramVAT) || 0;
      /* v6.62: GiaAloha nay la GIA BAN cua the kho, va gia ban DA GOM THUE -> chieu tinh DAO lai:
           Sau VAT   = chinh gia ban
           Truoc VAT = gia ban / (1 + %VAT)
         Truoc day nhan len -> file Excel gui khach bi cong thue HAI LAN. */
      const giaGomVat = it.GiaAloha != null ? Number(it.GiaAloha) : null;
      const giaTruocVat = giaGomVat != null ? giaGomVat / (1 + vat) : null;
      const sauVat = giaGomVat;
      const rowVals = { 1: i + 1, 5: it.TenHang, 6: it.MaBarcode || null, 7: giaTruocVat, 8: vat, 9: sauVat, 15: it.SoMau, 16: it.LoaiRi };
      for (let c = 1; c <= COL_COUNT; c++) {
        const cell = ws.getCell(r, c);
        if (rowVals[c] !== undefined) cell.value = rowVals[c];
        cell.font = { name: FONT_NAME, size: 12 };
        cell.alignment = { horizontal: 'center', vertical: 'center', wrapText: true };
        cell.border = BORDER_ALL;
      }
      ws.getCell(r, 7).numFmt = '#,##0';
      ws.getCell(r, 8).numFmt = '0%';
      ws.getCell(r, 9).numFmt = '#,##0';
      ws.getCell(r, 15).numFmt = '#,##0';
      ws.getCell(r, 16).numFmt = '#,##0';
      ws.getCell(r, 5).alignment = { horizontal: 'left', vertical: 'center', wrapText: true };
      ws.getRow(r).height = 30;

      // v5.18 (muc 2.1.2): nhung anh dai dien vao dung o "Hình ảnh sp" (cot 14) cua dong nay - xem ghi
      // chu chi tiet o dau route. anhToPngBuffer() lo phan chuan hoa dinh dang (sharp); o day chi lo
      // phan dat anh vao dung vi tri. Boc try/catch RIENG cho TUNG anh - 1 anh loi (du lieu AnhDaiDien
      // hong/sharp khong doc duoc) chi lam dong DO thieu anh, khong lam hong ca file xuat.
      if (it.AnhDaiDien) {
        try {
          const pngBuffer = await anhToPngBuffer(it.AnhDaiDien);
          const imageId = wb.addImage({ buffer: pngBuffer, extension: 'png' });
          // Cot 14 = "Hình ảnh sp" (1-based) -> tl/br cua exceljs dung chi so 0-based, hang cung 0-based.
          // v5.19 (muc 2.2, yeu cau "nếu thay đổi kích thước ô ảnh có thể thay đổi theo"): BAT BUOC truyen
          // editAs:'twoCell' tuong minh - da doi chieu source exceljs 4.4.0 (lib/xlsx/xform/drawing/
          // two-cell-anchor-xform.js): neu KHONG truyen editAs, thu vien tu gan mac dinh 'oneCell' (anh
          // di chuyen theo o nhung KHONG doi kich thuoc khi keo dan cot/hang - README cua chinh exceljs
          // ghi 'oneCell' la "mac dinh" nhung do la mac dinh cua PHIEN BAN NAY, khac mac dinh 'twoCell'
          // cua chuan OOXML). 'twoCell' la gia tri hop le theo chuan ST_EditAs (Microsoft OOXML) dù
          // khong duoc liet ke trong bang README cua exceljs - truyen thang se ghi dung "editAs=twoCell"
          // vao XML, cho anh vua di chuyen VUA co gian theo o dung yeu cau.
          ws.addImage(imageId, { tl: { col: 13, row: r - 1 }, br: { col: 14, row: r }, editAs: 'twoCell' });
        } catch (imgErr) {
          console.error(`Lỗi khi chèn ảnh đại diện vào Excel báo giá (mã hàng ${it.MaHang}):`, imgErr.message);
        }
      }
    }
    const DATA_END = items.length ? DATA_START + items.length - 1 : DATA_START;

    if (items.length > 1) {
      ws.mergeCells(DATA_START, 2, DATA_END, 2);
      ws.mergeCells(DATA_START, 3, DATA_END, 3);
      ws.mergeCells(DATA_START, 4, DATA_END, 4);
    }
    ws.getCell(DATA_START, 2).value = header.TenCongTySanXuatNhapKhau || null;
    ws.getCell(DATA_START, 3).value = header.MaNCC || null;
    ws.getCell(DATA_START, 4).value = header.TenNCC || null;

    const footerRow1 = DATA_END + 2;
    const footerRow2 = footerRow1 + 1;
    const d = new Date(header.NgayTao || header.CreatedAt || Date.now());
    ws.getCell(footerRow1, 14).value = `Việt Trì, ngày ${d.getDate()} tháng ${d.getMonth() + 1} năm ${d.getFullYear()}`;
    ws.getCell(footerRow1, 14).font = { name: FONT_NAME, size: 12, bold: true };
    ws.getCell(footerRow1, 14).alignment = { horizontal: 'center' };
    ws.getCell(footerRow2, 14).value = 'Người đề nghị';
    ws.getCell(footerRow2, 14).font = { name: FONT_NAME, size: 12, bold: true };
    ws.getCell(footerRow2, 14).alignment = { horizontal: 'center' };

    const WIDTHS = [5.4, 21.4, 9.9, 20.1, 20.4, 15, 11.9, 9.6, 17.1, 11.4, 10, 10, 10, 17.4, 16.4, 12.6];
    WIDTHS.forEach((w, idx) => { ws.getColumn(idx + 1).width = w; });
    for (let c = 17; c <= COL_COUNT; c++) ws.getColumn(c).width = 10;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const safeName = (header.TenBaoGia || ('BaoGia_' + header.ID)).replace(/[^\p{L}\p{N}_\-]/gu, '_');
    res.setHeader('Content-Disposition', `attachment; filename="BaoGiaAloha_${safeName}.xlsx"`);
    const buf = await wb.xlsx.writeBuffer();
    res.send(Buffer.from(buf));
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'Lỗi khi xuất Excel báo giá: ' + err.message });
  }
});

module.exports = router;
