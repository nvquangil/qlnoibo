const express = require('express');
const bcrypt = require('bcryptjs');
const { sql, getPool } = require('../db');
const chongDo = require('../utils/chongDoMatKhau');   // v5.66.1: chặn bot dò mật khẩu khách
// v6.23: TỒN KHẢ DỤNG = tồn kho − hàng đang giữ cho đơn chưa xuất. Định nghĩa DUY NHẤT ở routes/banhang.js.
const { layHangDangGiu } = require('./banhang');

const router = express.Router();

/* v5.62: KHÔNG để lỗi trong route công khai làm sập tiến trình (Express 4 + Node >= 15).
   Xem thêm ghi chú cùng loại ở backend/routes/tailieukythuat.js. */
['get', 'post', 'put', 'delete'].forEach(method => {   // v5.65: khách sửa/hủy đơn -> có thêm PUT/DELETE
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

// ============ CATALOGUE CONG KHAI (KHONG CAN DANG NHAP) ============
// Chi hien hang con ton kho > 0 (tong hop), kem anh dai dien + tung mau con anh rieng.
// Dung cho trang frontend/catalogue.html - xem duoc tren dien thoai/may tinh, gui link cho khach xem,
// khong lo lo du lieu noi bo khac vi chi tra ve: ten hang, anh, mau con, gia ban.
router.get('/catalogue', async (req, res) => {
  try {
    const pool = await getPool();
    // v5.4: them TenNhom (nhom san pham / "Loai hang" moi) de Catalogue loc duoc theo truong nay.
    const itemsResult = await pool.request().query(`
      SELECT v.MaHangID, v.MaHang, v.TenHang, v.GiaBan, v.AnhDaiDien, v.TenTheKho, v.TongTon, v.TenNhom, h.CreatedAt,
             h.DonViCoBan, h.DonViQuyDoi, h.LoaiRi   -- v6.31
      FROM vw_TonKhoHangHoa v
      JOIN TheKhoHangHoa h ON h.MaHangID = v.MaHangID
      WHERE v.TongTon > 0${await dieuKienCongKhaiMH(pool, 'h')}
      ORDER BY v.TenHang`);
    const items = itemsResult.recordset;
    if (!items.length) return res.json({ success: true, data: [] });

    /* v6.23: SỐ CÒN LẠI hiện cho khách = TỒN KHẢ DỤNG (đã trừ hàng đang giữ cho các đơn Chờ xác
       nhận/Chờ xử lý chưa xuất phiếu bán hàng). Trước v6.23 đơn đặt trừ tồn ngay nên tồn thô đã là
       số khả dụng; nay tồn chỉ giảm khi xuất phiếu bán hàng, phải tự trừ phần đang giữ ở đây kẻo
       khách thấy còn hàng mà thực tế đã có người đặt. */
    const giu = await layHangDangGiu(pool);
    const idList = items.map(i => i.MaHangID).join(',');
    const colorsResult = await pool.request().query(`
      SELECT ct.MaHangID, ct.MauSacID, ms.TenMau, ct.LinkAnh, (ct.NhapCai - ct.XuatCai) AS TonCai
      FROM TheKhoChiTietMau ct
      JOIN MauSac ms ON ms.MauSacID = ct.MauSacID
      WHERE ct.MaHangID IN (${idList}) AND (ct.NhapCai - ct.XuatCai) > 0
      ORDER BY ms.TenMau`);
    const colorsByItem = {};
    const khaDungTheoMaHang = {};
    colorsResult.recordset.forEach(c => {
      const conLai = Number(c.TonCai) - (giu.theoMau.get(c.MaHangID + '|' + c.MauSacID) || 0);
      if (conLai <= 0) return;   // màu đã có người đặt hết -> không hiện cho khách nữa
      if (!colorsByItem[c.MaHangID]) colorsByItem[c.MaHangID] = [];
      colorsByItem[c.MaHangID].push({ tenMau: c.TenMau, anh: c.LinkAnh, tonCai: conLai });
      khaDungTheoMaHang[c.MaHangID] = (khaDungTheoMaHang[c.MaHangID] || 0) + conLai;
    });

    const data = items.map(i => ({
      maHang: i.MaHang, tenHang: i.TenHang, giaBan: i.GiaBan, anhDaiDien: i.AnhDaiDien,
      // v6.31: gửi kèm đơn vị của CHÍNH mã hàng để trang công khai khỏi gõ cứng "Cái"/"Ri".
      donViCoBan: i.DonViCoBan || 'Cái', donViQuyDoi: i.DonViQuyDoi || '', loaiRi: Number(i.LoaiRi) || 1,
      danhMuc: i.TenTheKho, tongTon: khaDungTheoMaHang[i.MaHangID] || 0,
      mauConLai: colorsByItem[i.MaHangID] || [],
      loaiHang: i.TenNhom, ngayTao: i.CreatedAt
    })).filter(x => x.tongTon > 0);
    res.json({ success: true, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Lỗi khi tải catalogue.' });
  }
});

/* ================================================================================================
   v5.62: CÔNG KHAI THẺ KHO THEO TỪNG DANH MỤC — mỗi danh mục 1 đường link riêng.
     GET /api/public/danhmuc                 -> danh sách danh mục ĐÃ BẬT công khai (cho trang chọn)
     GET /api/public/catalogue?dm=<slug>     -> hàng của ĐÚNG danh mục đó
   NGUYÊN TẮC AN TOÀN (giữ như catalogue cũ):
     - Chỉ danh mục có CongKhai = 1 mới trả dữ liệu; sai/chưa bật -> 404, KHÔNG hé tên danh mục.
     - Chỉ trả: tên hàng, mã hàng, ảnh, màu còn hàng, giá bán. KHÔNG trả số tồn, giá Aloha,
       barcode, ghi chú, đơn hàng sản xuất liên kết, ID nội bộ.
     - Dùng .input() tham số hoá (slug do người ngoài gửi) — tuyệt đối không nối chuỗi vào SQL.
   ================================================================================================ */
/* v5.66.2: địa chỉ CÔNG KHAI mà khách dùng (đặt PUBLIC_BASE_URL trong .env, ví dụ
   https://catalogue.congty.com hoặc http://14.160.x.x). Dùng cho nút "Copy link" ở Danh mục thẻ kho:
   nhân viên có thể đang làm việc qua tên miền nội bộ / Cloudflare Tunnel, nhưng link gửi khách phải
   là địa chỉ công khai. Bỏ trống -> frontend tự suy ra từ địa chỉ đang mở (bỏ cổng). */
router.get('/thongtin', (req, res) => {
  res.json({ success: true, data: { baseUrl: String(process.env.PUBLIC_BASE_URL || '').trim().replace(/\/+$/, '') } });
});

/* ================================================================================================
   v6.71 — CÔNG KHAI TỪNG MÃ HÀNG (TheKhoHangHoa.CongKhai — migration_v679).
   Mã hàng hiện trên catalogue khi VÀ CHỈ KHI: danh mục CongKhai = 1 VÀ mã hàng CongKhai = 1.
   Dò cột trước khi đưa vào SELECT: hệ thống chưa chạy migration mà query thẳng cột chưa có sẽ làm
   TRẮNG CẢ TRANG CATALOGUE của khách — hỏng nặng hơn nhiều so với việc tạm thời chưa lọc được.
   Chưa có cột -> điều kiện rỗng -> chạy y như trước v6.71.
   ================================================================================================ */
let __coCongKhaiMH = null;
async function dieuKienCongKhaiMH(pool, biDanh) {
  if (__coCongKhaiMH === null) {
    try {
      const r = (await pool.request().query(`SELECT COL_LENGTH('TheKhoHangHoa','CongKhai') AS c`)).recordset[0] || {};
      __coCongKhaiMH = r.c != null;
    } catch (e) { __coCongKhaiMH = false; }
  }
  // ISNULL(...,1): dòng dữ liệu cũ chưa kịp có giá trị thì vẫn coi là HIỆN, không tự dưng biến mất.
  return __coCongKhaiMH ? ` AND ISNULL(${biDanh}.CongKhai, 1) = 1` : '';
}

router.get('/danhmuc', async (req, res) => {
  try {
    const pool = await getPool();
    const rows = (await pool.request().query(`
      SELECT d.Slug, ISNULL(NULLIF(LTRIM(RTRIM(d.TieuDeCongKhai)), N''), d.TenTheKho) AS TieuDe, d.MoTaCongKhai,
             (SELECT COUNT(*) FROM vw_TonKhoHangHoa v
                JOIN TheKhoHangHoa hh ON hh.MaHangID = v.MaHangID
                WHERE v.TheKhoDanhMucID = d.TheKhoDanhMucID AND v.TongTon > 0${await dieuKienCongKhaiMH(pool, 'hh')}) AS SoMatHang
      FROM TheKhoDanhMuc d
      WHERE d.CongKhai = 1 AND d.Slug IS NOT NULL AND LTRIM(RTRIM(d.Slug)) <> N''
      ORDER BY TieuDe`)).recordset;
    res.json({ success: true, data: rows.map(r => ({ slug: r.Slug, tieuDe: r.TieuDe, moTa: r.MoTaCongKhai, soMatHang: r.SoMatHang })) });
  } catch (err) {
    console.error('[public danhmuc] ', err);
    res.status(500).json({ success: false, message: 'Lỗi khi tải danh mục.' });
  }
});

router.get('/catalogue-danhmuc', async (req, res) => {
  try {
    const slug = String(req.query.dm || '').trim().toLowerCase();
    if (!slug) return res.status(400).json({ success: false, message: 'Thiếu mã danh mục.' });
    const pool = await getPool();
    const dm = (await pool.request().input('slug', sql.NVarChar, slug).query(`
      SELECT TheKhoDanhMucID, TenTheKho,
             ISNULL(NULLIF(LTRIM(RTRIM(TieuDeCongKhai)), N''), TenTheKho) AS TieuDe, MoTaCongKhai
      FROM TheKhoDanhMuc
      WHERE LOWER(LTRIM(RTRIM(Slug))) = @slug AND CongKhai = 1`)).recordset[0];
    // Không phân biệt "không có" với "chưa bật công khai" -> không hé thông tin nào.
    if (!dm) return res.status(404).json({ success: false, message: 'Danh mục không tồn tại hoặc chưa được chia sẻ.' });

    const items = (await pool.request().input('id', sql.Int, dm.TheKhoDanhMucID).query(`
      SELECT v.MaHangID, v.MaHang, v.TenHang, v.GiaBan, v.AnhDaiDien, v.TenNhom, h.CreatedAt,
             h.DonViCoBan, h.DonViQuyDoi, h.LoaiRi   -- v6.31
      FROM vw_TonKhoHangHoa v
      JOIN TheKhoHangHoa h ON h.MaHangID = v.MaHangID
      WHERE v.TongTon > 0 AND v.TheKhoDanhMucID = @id${await dieuKienCongKhaiMH(pool, 'h')}
      ORDER BY v.TenHang`)).recordset;

    const thongTin = { tieuDe: dm.TieuDe, moTa: dm.MoTaCongKhai || '' };
    if (!items.length) return res.json({ success: true, danhMuc: thongTin, data: [] });

    // Lấy màu còn hàng cho các mặt hàng này (tham số hoá theo từng ID, không nối chuỗi).
    const rq = pool.request();
    const thamSo = items.map((it, i) => { rq.input('id' + i, sql.Int, it.MaHangID); return '@id' + i; }).join(',');
    const colors = (await rq.query(`
      SELECT ct.MaHangID, ct.MauSacID, ms.TenMau, ct.LinkAnh, (ct.NhapCai - ct.XuatCai) AS TonCai
      FROM TheKhoChiTietMau ct
      JOIN MauSac ms ON ms.MauSacID = ct.MauSacID
      WHERE ct.MaHangID IN (${thamSo}) AND (ct.NhapCai - ct.XuatCai) > 0
      ORDER BY ms.TenMau`)).recordset;
    // v6.23: bỏ màu đã có người đặt hết (tồn khả dụng <= 0) — xem ghi chú ở GET /catalogue.
    const giu = await layHangDangGiu(pool);
    const theoMatHang = {};
    const conLaiTheoMatHang = {};
    colors.forEach(c => {
      const conLai = Number(c.TonCai) - (giu.theoMau.get(c.MaHangID + '|' + c.MauSacID) || 0);
      if (conLai <= 0) return;
      (theoMatHang[c.MaHangID] = theoMatHang[c.MaHangID] || []).push({ tenMau: c.TenMau, anh: c.LinkAnh, tonCai: conLai });
      conLaiTheoMatHang[c.MaHangID] = (conLaiTheoMatHang[c.MaHangID] || 0) + conLai;
    });

    const data = items.map(i => ({
      maHang: i.MaHang, tenHang: i.TenHang, giaBan: i.GiaBan, anhDaiDien: i.AnhDaiDien,
      // v6.31: xem ghi chú ở /catalogue.
      donViCoBan: i.DonViCoBan || 'Cái', donViQuyDoi: i.DonViQuyDoi || '', loaiRi: Number(i.LoaiRi) || 1,
      loaiHang: i.TenNhom, ngayTao: i.CreatedAt,
      tongTon: conLaiTheoMatHang[i.MaHangID] || 0,   // v6.23: số CÒN LẠI (khả dụng) để hiện lên catalogue
      mauConLai: theoMatHang[i.MaHangID] || []
    })).filter(x => x.tongTon > 0);
    res.json({ success: true, danhMuc: thongTin, data });
  } catch (err) {
    console.error('[public catalogue-danhmuc] ', err);
    res.status(500).json({ success: false, message: 'Lỗi khi tải danh mục.' });
  }
});

/* ================================================================================================
   v5.63: KHÁCH ĐĂNG NHẬP ĐẶT HÀNG NGAY TRÊN TRANG CÔNG KHAI
   Quy tắc đã chốt:
     - Tài khoản khách do NHÂN VIÊN tạo (bảng TaiKhoanKhach) — KHÔNG có đăng ký tự do.
     - Khách chỉ đặt được hàng thuộc danh mục ĐÃ BẬT công khai; KHÔNG thấy số tồn.
     - Đơn vào Danh sách đơn đặt hàng với trạng thái 'Chờ xác nhận' và CHƯA TRỪ TỒN (DaTruTon=0);
       nhân viên bấm Xác nhận mới trừ tồn (xem PUT /api/khohang/orders/:id/xacnhan).
     - Thông báo cho mọi người có quyền Thẻ kho hàng hóa (+ Admin).
   PHIÊN LÀM VIỆC: khách lưu ở req.session.khach — TÁCH BIỆT hoàn toàn với req.session.user của
   nhân viên, nên không ảnh hưởng đăng nhập nội bộ (requireAuth chỉ đọc req.session.user).
   ================================================================================================ */
function khachDangNhap(req) { return (req.session && req.session.khach) ? req.session.khach : null; }
function requireKhach(req, res, next) {
  if (!khachDangNhap(req)) return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập để đặt hàng.' });
  next();
}

router.post('/khach/dangnhap', async (req, res) => {
  try {
    const tenDangNhap = String((req.body && req.body.tenDangNhap) || '').trim();
    const matKhau = String((req.body && req.body.matKhau) || '');
    if (!tenDangNhap || !matKhau) return res.status(400).json({ success: false, message: 'Nhập tên đăng nhập và mật khẩu.' });
    /* v5.66.1: trang này CÔNG KHAI ra internet -> khoá tạm sau nhiều lần sai (chống bot dò). */
    const keys = chongDo.kiemTraTruocKhiDangNhap(req, tenDangNhap);
    if (keys.biKhoa) {
      console.warn(`[khach dangnhap] KHOA TAM ${keys.ip} - con ${keys.phut} phut (thu tai khoan "${tenDangNhap}")`);
      return res.status(429).json({ success: false, message: `Sai quá nhiều lần. Vui lòng thử lại sau ${keys.phut} phút.` });
    }
    const pool = await getPool();
    // v5.63.1: so khớp tên đăng nhập có LTRIM/RTRIM ở CẢ 2 phía — phòng trường hợp dữ liệu lưu lỡ
    // dính khoảng trắng đầu/cuối (dán từ Excel/Zalo) thì khách vẫn đăng nhập được.
    const row = (await pool.request().input('u', sql.NVarChar, tenDangNhap)
      .query('SELECT * FROM TaiKhoanKhach WHERE LTRIM(RTRIM(TenDangNhap)) = LTRIM(RTRIM(@u))')).recordset[0];
    // Sai tên hoặc sai mật khẩu -> CÙNG một thông báo cho KHÁCH (không cho dò tên đăng nhập nào tồn tại),
    // nhưng GHI LOG rõ nhánh nào sai để người quản trị chẩn đoán được bằng: pm2 logs qlnoibo
    if (!row) {
      chongDo.ghiNhanDangNhapSai(keys);
      console.warn(`[khach dangnhap] KHONG TIM THAY tai khoan "${tenDangNhap}" tu ${keys.ip} (kiem tra chinh ta / khoang trang khi tao tai khoan).`);
      return res.status(401).json({ success: false, message: 'Sai tên đăng nhập hoặc mật khẩu.' });
    }
    if (String(row.TrangThai || '') === 'Tạm dừng') {
      return res.status(403).json({ success: false, message: 'Tài khoản đang tạm dừng. Vui lòng liên hệ nhân viên bán hàng.' });
    }
    const hash = row.MatKhauHash || '';
    if (!/^\$2[aby]\$/.test(hash)) {
      // Hash không đúng định dạng bcrypt -> tài khoản tạo lỗi / mật khẩu chưa được lưu.
      console.error(`[khach dangnhap] Tai khoan "${tenDangNhap}" co MatKhauHash KHONG hop le (dai ${hash.length} ky tu). Hay vao Tai khoan khach -> Sua -> dat lai mat khau.`);
      return res.status(401).json({ success: false, message: 'Tài khoản chưa đặt được mật khẩu. Vui lòng báo nhân viên đặt lại mật khẩu giúp bạn.' });
    }
    const ok = await bcrypt.compare(matKhau, hash);
    if (!ok) {
      chongDo.ghiNhanDangNhapSai(keys);
      console.warn(`[khach dangnhap] SAI MAT KHAU cho tai khoan "${tenDangNhap}" tu ${keys.ip}.`);
      return res.status(401).json({ success: false, message: 'Sai tên đăng nhập hoặc mật khẩu.' });
    }
    chongDo.ghiNhanDangNhapDung(keys);

    req.session.khach = { id: row.TaiKhoanKhachID, tenDangNhap: row.TenDangNhap, tenKhach: row.TenKhach, sdt: row.SDT || '' };
    await pool.request().input('id', sql.Int, row.TaiKhoanKhachID)
      .query('UPDATE TaiKhoanKhach SET LanDangNhapCuoi=SYSDATETIME() WHERE TaiKhoanKhachID=@id');
    res.json({ success: true, data: req.session.khach });
  } catch (err) {
    console.error('[public khach dangnhap] ', err);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi đăng nhập.' });
  }
});

router.post('/khach/dangxuat', (req, res) => {
  if (req.session) delete req.session.khach;   // KHÔNG destroy cả session (tránh làm mất phiên nhân viên nếu trùng máy)
  res.json({ success: true });
});

router.get('/khach/toi', (req, res) => {
  const k = khachDangNhap(req);
  if (!k) return res.status(401).json({ success: false, message: 'Chưa đăng nhập.' });
  res.json({ success: true, data: k });
});

/* v5.65: QUY SỐ LƯỢNG KHÁCH ĐẶT VỀ ĐƠN VỊ CHÍNH của mã hàng.
   BẢN SAO CÓ CHỦ Ý của orderQtyToBase() trong backend/routes/khohang.js — hai file không import lẫn
   nhau (mỗi file chỉ export router). SỬA CÔNG THỨC Ở ĐÂY THÌ PHẢI SỬA CẢ BÊN KIA, nếu không tồn kho
   trừ ở web công khai sẽ lệch với trừ ở phần mềm nội bộ. */
/* v6.31: BO CHUOI 'Ri' — xem giai thich day du o backend/routes/banhang.js.
   ⚠️ Ban sao: banhang.js, khohang.js, frontend/js/common.js — SUA PHAI SUA DONG BO CA 4 CHO. */
function chuanDV(v) { return String(v == null ? '' : v).trim().toLowerCase(); }
function laDonViGop(donVi, mh) {
  const dv = chuanDV(donVi), qd = chuanDV(mh && mh.DonViQuyDoi);
  return qd ? dv === qd : dv === 'ri';
}
function donViChinhLaGop(mh) {
  const cb = chuanDV(mh && mh.DonViCoBan), qd = chuanDV(mh && mh.DonViQuyDoi);
  return qd ? cb === qd : cb === 'ri';
}
function quyVeDonViChinh(soLuong, donViDat, donViCoBan, loaiRi, donViQuyDoi) {
  const n = Number(soLuong) || 0, he = Number(loaiRi) || 1;
  const mh = { DonViCoBan: donViCoBan, DonViQuyDoi: donViQuyDoi };
  const cai = laDonViGop(donViDat, mh) ? n * he : n;
  const base = donViChinhLaGop(mh) ? cai / he : cai;
  return Math.round(base);
}

/* v5.65.2: CHIỀU NGƯỢC LẠI — từ tồn kho (đơn vị chính) ra SỐ TỐI ĐA khách đặt được theo ĐÚNG đơn vị
   khách đang chọn. Dùng để hỏi khách "kho còn 6 Ri, đặt 6 không?" thay vì chỉ báo hết hàng.
   Làm TRÒN XUỐNG (Math.floor) để không bao giờ gợi ý mức vượt tồn: tồn 6 Cái, hệ số ri = 5
   -> tối đa 1 Ri (không phải 2). */
function quyTuDonViChinh(slChinh, donViDat, donViCoBan, loaiRi, donViQuyDoi) {
  const n = Number(slChinh) || 0, he = Number(loaiRi) || 1;
  const mh = { DonViCoBan: donViCoBan, DonViQuyDoi: donViQuyDoi };
  const cai = donViChinhLaGop(mh) ? n * he : n;
  const ra = laDonViGop(donViDat, mh) ? cai / he : cai;
  return Math.max(0, Math.floor(ra));
}

/* Gửi thông báo cho nhân viên có quyền Thẻ kho hàng hóa (+ Admin).
   LỖI GỬI THÔNG BÁO KHÔNG ĐƯỢC làm hỏng nghiệp vụ chính -> luôn nuốt lỗi tại đây.
   ThongBao.DonHangID là FK tới DonHangSanXuat nên BẮT BUỘC để NULL cho đơn khách. */
async function thongBaoNhanVienKho(pool, noiDung) {
  try {
    /* v5.67: lấy trước danh sách người nhận để còn ĐẨY thông báo ra màn hình (Web Push),
       rồi mới ghi vào bảng ThongBao. Cùng một điều kiện quyền như câu INSERT bên dưới. */
    const nguoiNhan = (await pool.request().query(`
      SELECT DISTINCT u.UserID
      FROM Users u
      LEFT JOIN UserGroups ug ON ug.UserID = u.UserID
      LEFT JOIN Groups g ON g.GroupID = ug.GroupID
      LEFT JOIN Permissions p ON p.GroupID = g.GroupID
      LEFT JOIN Modules m ON m.ModuleID = p.ModuleID AND m.ModuleCode = 'KHOHANG'
      LEFT JOIN UserPermissions up ON up.UserID = u.UserID
      LEFT JOIN Modules m2 ON m2.ModuleID = up.ModuleID AND m2.ModuleCode = 'KHOHANG'
      WHERE ISNULL(u.IsActive, 1) = 1
        AND ( ISNULL(g.IsAdmin, 0) = 1
           OR (m.ModuleID IS NOT NULL AND ISNULL(p.CanView, 0) = 1)
           OR (m2.ModuleID IS NOT NULL AND ISNULL(up.CanView, 0) = 1) )`)).recordset.map(r => r.UserID);
    await require('../utils/webpush').guiPush(pool, nguoiNhan, {
      title: 'Đơn khách đặt trên web', body: noiDung, url: '/#KHOHANG/orders', tag: 'don-khach'
    });

    await pool.request().input('nd', sql.NVarChar, noiDung).query(`
      INSERT INTO ThongBao (UserID, DonHangID, NoiDung)
      SELECT DISTINCT u.UserID, NULL, @nd
      FROM Users u
      LEFT JOIN UserGroups ug ON ug.UserID = u.UserID
      LEFT JOIN Groups g ON g.GroupID = ug.GroupID
      LEFT JOIN Permissions p ON p.GroupID = g.GroupID
      LEFT JOIN Modules m ON m.ModuleID = p.ModuleID AND m.ModuleCode = 'KHOHANG'
      LEFT JOIN UserPermissions up ON up.UserID = u.UserID
      LEFT JOIN Modules m2 ON m2.ModuleID = up.ModuleID AND m2.ModuleCode = 'KHOHANG'
      WHERE ISNULL(u.IsActive, 1) = 1
        AND ( ISNULL(g.IsAdmin, 0) = 1
           OR (m.ModuleID IS NOT NULL AND ISNULL(p.CanView, 0) = 1)
           OR (m2.ModuleID IS NOT NULL AND ISNULL(up.CanView, 0) = 1) )`);
  } catch (e) { console.error('[public thongBaoNhanVienKho] bo qua loi:', e.message); }
}

/* ĐẶT HÀNG. body: { dm: '<slug danh mục>', ghiChu, items: [{ maHang, tenMau, soLuong, donVi }] }
   - Kiểm tra TỪNG dòng: mã hàng phải thuộc danh mục đang công khai + màu phải có trong thẻ kho.
   - v5.65 (ĐỔI SO VỚI v5.63): TRỪ TỒN NGAY khi khách bấm gửi, đơn vào thẳng 'Chờ xử lý'
     (DaTruTon = 1) — KHÔNG còn bước nhân viên "Xác nhận". Vì vậy phải kiểm tra ĐỦ TỒN cho TẤT CẢ
     dòng TRƯỚC khi ghi bất cứ dòng nào (không ghi một phần đơn), giống POST /api/khohang/orders.
   - Vẫn KHÔNG trả số tồn về cho khách (chỉ báo "không còn đủ"). */
router.post('/khach/datdon', requireKhach, async (req, res) => {
  try {
    const k = khachDangNhap(req);
    const b = req.body || {};
    const slug = String(b.dm || '').trim().toLowerCase();
    const ghiChu = b.ghiChu != null ? String(b.ghiChu).slice(0, 500) : null;
    const items = Array.isArray(b.items) ? b.items : [];
    if (!items.length) return res.status(400).json({ success: false, message: 'Chưa chọn sản phẩm nào.' });
    if (items.length > 100) return res.status(400).json({ success: false, message: 'Mỗi lần đặt tối đa 100 dòng.' });

    const pool = await getPool();
    // Danh mục phải đang công khai (nếu khách gửi kèm) — chặn đặt hàng ngoài phạm vi được chia sẻ.
    let dmId = null;
    if (slug) {
      const dm = (await pool.request().input('slug', sql.NVarChar, slug).query(
        `SELECT TheKhoDanhMucID FROM TheKhoDanhMuc WHERE LOWER(LTRIM(RTRIM(Slug)))=@slug AND CongKhai=1`)).recordset[0];
      if (!dm) return res.status(400).json({ success: false, message: 'Danh mục không còn được chia sẻ. Vui lòng mở lại link mới nhất.' });
      dmId = dm.TheKhoDanhMucID;
    }

    // Chuẩn hoá + tra cứu từng dòng.
    const dongHopLe = [];
    const khongHopLe = [];      // dòng không tra được (hàng đã ngừng chia sẻ / đổi màu / xóa)
    for (const it of items) {
      const maHang = String(it.maHang || '').trim();
      const tenMau = String(it.tenMau || '').trim();
      const soLuong = Math.floor(Number(it.soLuong));
      const dvGo = String(it.donVi || '').trim();
      if (!maHang || !tenMau || !soLuong || soLuong <= 0 || soLuong > 1000000) continue;
      const rq = pool.request().input('mh', sql.NVarChar, maHang).input('mau', sql.NVarChar, tenMau);
      if (dmId) rq.input('dm', sql.Int, dmId);
      const row = (await rq.query(`
        SELECT TOP 1 h.MaHangID, ct.MauSacID, h.TenHang, h.LoaiRi, h.DonViCoBan, h.DonViQuyDoi
        FROM TheKhoHangHoa h
        JOIN TheKhoChiTietMau ct ON ct.MaHangID = h.MaHangID
        JOIN MauSac ms ON ms.MauSacID = ct.MauSacID
        JOIN TheKhoDanhMuc d ON d.TheKhoDanhMucID = h.TheKhoDanhMucID
        WHERE h.MaHang = @mh AND ms.TenMau = @mau AND d.CongKhai = 1${await dieuKienCongKhaiMH(pool, 'h')}
          ${dmId ? 'AND h.TheKhoDanhMucID = @dm' : ''}`)).recordset[0];
      if (!row) { khongHopLe.push({ maHang, tenMau }); continue; }
      /* v6.31: KHONG ep cung ve 'Ri'/'Cái' nua (truoc day moi don vi khac bi nuot thanh 'Cái').
         Chi nhan don vi HOP LE cua CHINH ma hang do; gui sai thi lui ve DVT chinh.
         Phai tra cuu ma hang XONG moi biet don vi nao hop le -> dat sau truy van. */
      const donVi = (dvGo && (dvGo === String(row.DonViCoBan || '').trim()
                           || dvGo === String(row.DonViQuyDoi || '').trim()))
        ? dvGo : (row.DonViCoBan || 'Cái');
      dongHopLe.push({
        maHang, maHangID: row.MaHangID, mauSacID: row.MauSacID, soLuong, donVi,
        tenHang: row.TenHang, tenMau, donViCoBan: row.DonViCoBan, donViQuyDoi: row.DonViQuyDoi, loaiRi: row.LoaiRi,
        slChinh: quyVeDonViChinh(soLuong, donVi, row.DonViCoBan, row.LoaiRi, row.DonViQuyDoi)
      });
    }

    /* v5.65.1 (theo yêu cầu): KHÔNG bỏ cả đơn khi một màu hết hàng.
       - Màu nào CÒN ĐỦ -> ghi đơn + trừ tồn ngay.
       - Màu nào HẾT/thiếu -> KHÔNG ghi, trả tên màu về để báo khách và GIỮ LẠI trong giỏ hàng.
       Gộp theo (mã hàng + màu) vì giỏ có thể có nhiều dòng cùng mã/màu; cả nhóm đủ thì mới ghi
       nhóm đó (không cắt bớt số lượng khách đặt — khách tự sửa lại số cho vừa tồn). */
    const nhom = new Map();     // "maHangID:mauSacID" -> { slChinh, maHang, tenHang, tenMau, dong: [] }
    for (const d of dongHopLe) {
      const key = d.maHangID + ':' + d.mauSacID;
      const cu = nhom.get(key);
      if (cu) { cu.slChinh += d.slChinh; cu.dong.push(d); }
      else nhom.set(key, {
        slChinh: d.slChinh, maHang: d.maHang, tenHang: d.tenHang, tenMau: d.tenMau,
        donViCoBan: d.donViCoBan, donViQuyDoi: d.donViQuyDoi, loaiRi: d.loaiRi, dong: [d]
      });
    }

    // [{ maHang, tenHang, tenMau, donVi, daDat, toiDa }] -> hỏi khách có hạ xuống `toiDa` không
    // v6.23: so với TỒN KHẢ DỤNG (tồn kho − hàng đang giữ cho các đơn chưa xuất) vì từ v6.23 đơn đặt
    // KHÔNG trừ tồn nữa — nếu vẫn so với tồn thô thì 1 lô hàng sẽ nhận được nhiều đơn hơn số có thật.
    const giu = await layHangDangGiu(pool);
    const thieu = [];
    const nhomDu = [];
    for (const [key, c] of nhom.entries()) {
      const [mh, ms] = key.split(':');
      const ct = (await pool.request().input('mh', sql.Int, mh).input('ms', sql.Int, ms)
        .query('SELECT (NhapCai - XuatCai) AS TonCon FROM TheKhoChiTietMau WHERE MaHangID=@mh AND MauSacID=@ms')).recordset[0];
      const ton = (ct ? Number(ct.TonCon) : 0) - (giu.theoMau.get(mh + '|' + ms) || 0);
      if (c.slChinh > ton) {
        /* v5.65.2 (yêu cầu của người dùng): thay vì chỉ báo "hết hàng", trả về SỐ TỐI ĐA còn đặt được
           theo đơn vị khách đang chọn để trang web hỏi lại "kho còn 6, đặt 6 không?".
           Việc này CÓ hé số tồn của đúng mã/màu khách đang đặt — đã được người dùng yêu cầu, khác
           với nguyên tắc "không hiện tồn" của các phiên bản trước. */
        const dv = c.dong[0].donVi;
        thieu.push({
          maHang: c.maHang, tenHang: c.tenHang, tenMau: c.tenMau, donVi: dv,
          daDat: c.dong.reduce((s, d) => s + d.soLuong, 0),
          toiDa: quyTuDonViChinh(ton, dv, c.donViCoBan, c.loaiRi, c.donViQuyDoi)
        });
      } else nhomDu.push([key, c]);
    }

    /* v6.23: đơn web vào 'Chờ xử lý' và **KHÔNG trừ tồn** (DaTruTon = 0) — chỉ GIỮ HÀNG.
       Tồn chỉ giảm khi nhân viên xuất PHIẾU BÁN HÀNG (routes/banhang.js). Catalogue hiển thị
       "còn lại" theo TỒN KHẢ DỤNG nên khách vẫn không đặt vượt số hàng có thật. */
    let soDong = 0;
    for (const [key, c] of nhomDu) {
      for (const d of c.dong) {
        await pool.request()
          .input('TenKhach', sql.NVarChar, k.tenKhach)
          .input('MaHangID', sql.Int, d.maHangID)
          .input('MauSacID', sql.Int, d.mauSacID)
          .input('SoLuongDat', sql.Int, d.soLuong)
          .input('DonVi', sql.NVarChar, d.donVi)
          .input('TaiKhoanKhachID', sql.Int, k.id)
          .input('GhiChuKhach', sql.NVarChar, ghiChu)
          .query(`INSERT INTO DonKhachDatHang (TenKhach, MaHangID, MauSacID, SoLuongDat, DonVi, TrangThai, NguoiTaoID, TaiKhoanKhachID, NguonDat, GhiChuKhach, DaTruTon)
                  VALUES (@TenKhach, @MaHangID, @MauSacID, @SoLuongDat, @DonVi, N'Chờ xử lý', NULL, @TaiKhoanKhachID, N'Web', @GhiChuKhach, 0)`);
        soDong++;
      }
      // v6.23: ĐÃ BỎ câu UPDATE XuatCai ở đây (v5.65 trừ tồn ngay). Chỉ phiếu bán hàng mới trừ tồn.
    }

    // Soạn lời nhắn cho khách: phần đã đặt được + phần thiếu hàng + phần không còn bán.
    const canhBao = [];
    if (thieu.length) canhBao.push('Các màu sau không đủ số lượng bạn đặt:\n• ' +
      thieu.map(t => `${t.tenHang} — màu ${t.tenMau}: đặt ${t.daDat} ${t.donVi}, ` +
        (t.toiDa > 0 ? `kho chỉ còn ${t.toiDa} ${t.donVi}` : 'đã hết hàng')).join('\n• '));
    if (khongHopLe.length) canhBao.push('Các dòng sau không còn được bán trên trang này:\n• ' +
      khongHopLe.map(t => `${t.maHang} — màu ${t.tenMau}`).join('\n• '));

    if (!soDong) {
      return res.status(400).json({
        success: false,
        message: (canhBao.join('\n\n') || 'Không có dòng nào hợp lệ. Vui lòng tải lại trang.') +
                 '\n\nBạn hãy giảm số lượng hoặc chọn màu khác.',
        data: { soDong: 0, thieu, khongHopLe }
      });
    }

    await thongBaoNhanVienKho(pool,
      `🛒 Đơn mới từ khách "${k.tenKhach}" (${soDong} dòng) — GIỮ HÀNG, trạng thái "Chờ xử lý" (CHƯA trừ tồn). Vào Thẻ kho hàng hóa → Đơn đặt hàng, chuyển sang PHIẾU BÁN HÀNG khi giao hàng.`);

    res.json({
      success: true,
      message: `Đã đặt ${soDong} dòng hàng.` + (canhBao.length ? '\n\n' + canhBao.join('\n\n') : ''),
      data: { soDong, thieu, khongHopLe }
    });
  } catch (err) {
    console.error('[public khach datdon] ', err);
    res.status(400).json({ success: false, message: 'Không đặt được đơn: ' + err.message });
  }
});

/* Khách xem lại đơn của CHÍNH MÌNH (chỉ đơn do tài khoản này đặt). */
router.get('/khach/donhang', requireKhach, async (req, res) => {
  try {
    const k = khachDangNhap(req);
    const pool = await getPool();
    const rows = (await pool.request().input('id', sql.Int, k.id).query(`
      SELECT TOP 200 o.DonID, o.ThoiGian, h.MaHang, h.TenHang, h.AnhDaiDien, ms.TenMau,
             o.SoLuongDat, o.DonVi, o.TrangThai, o.GhiChuKhach,
             h.DonViCoBan, h.DonViQuyDoi, h.LoaiRi   -- v6.31: ô đơn vị khi khách sửa đơn
      FROM DonKhachDatHang o
      JOIN TheKhoHangHoa h ON h.MaHangID = o.MaHangID
      JOIN MauSac ms ON ms.MauSacID = o.MauSacID
      WHERE o.TaiKhoanKhachID = @id
      ORDER BY o.ThoiGian DESC`)).recordset;
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[public khach donhang] ', err);
    res.status(500).json({ success: false, message: 'Lỗi khi tải đơn của bạn.' });
  }
});

/* ================================================================================================
   v5.65: KHÁCH TỰ SỬA SỐ LƯỢNG / HỦY ĐƠN CỦA MÌNH — TỒN KHO ĐỔI THEO NGAY.
   QUY TẮC AN TOÀN (không thương lượng):
     - CHỈ đụng được đơn có TaiKhoanKhachID = chính khách đang đăng nhập (kiểm tra trong WHERE).
     - CHỈ sửa/hủy khi đơn còn ở trạng thái 'Chờ xử lý' (hoặc 'Chờ xác nhận' của dữ liệu cũ).
       Đơn đã 'Đã giao'/'Đã hủy' thì khóa — hàng đã ra khỏi kho, khách phải gọi nhân viên.
     - Khách KHÔNG đổi được mã hàng / màu (muốn đổi thì hủy rồi đặt lại) — tránh biến API công khai
       thành đường ghi tuỳ ý vào thẻ kho.
     - Chỉ hoàn/trừ tồn khi DaTruTon = 1, đúng nguyên tắc đã dùng ở khohang.js.
   ================================================================================================ */
const TRANG_THAI_KHACH_SUA_DUOC = ['Chờ xử lý', 'Chờ xác nhận'];

async function layDonCuaKhach(pool, donId, khachId) {
  return (await pool.request().input('id', sql.Int, donId).input('k', sql.Int, khachId)
    .query('SELECT * FROM DonKhachDatHang WHERE DonID=@id AND TaiKhoanKhachID=@k')).recordset[0];
}

router.put('/khach/donhang/:id', requireKhach, async (req, res) => {
  try {
    const k = khachDangNhap(req);
    const pool = await getPool();
    const don = await layDonCuaKhach(pool, parseInt(req.params.id, 10), k.id);
    if (!don) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn này trong tài khoản của bạn.' });
    if (!TRANG_THAI_KHACH_SUA_DUOC.includes(String(don.TrangThai))) {
      return res.status(400).json({ success: false, message: `Đơn đang ở trạng thái "${don.TrangThai}" nên không sửa được. Vui lòng liên hệ nhân viên bán hàng.` });
    }
    const soLuong = Math.floor(Number((req.body || {}).soLuong));
    if (!soLuong || soLuong <= 0 || soLuong > 1000000) return res.status(400).json({ success: false, message: 'Số lượng không hợp lệ.' });

    const h = (await pool.request().input('id', sql.Int, don.MaHangID)
      .query('SELECT TenHang, LoaiRi, DonViCoBan, DonViQuyDoi FROM TheKhoHangHoa WHERE MaHangID=@id')).recordset[0] || {};
    /* v6.31: chi nhan don vi HOP LE cua chinh ma hang (DVT chinh hoac DVT quy doi) — truoc day
       ep cung ve 'Ri'/'Cái' nen moi don vi khac bi nuot. Phai doc ma hang xong moi kiem duoc. */
    const dvGo2 = String((req.body || {}).donVi || don.DonVi || '').trim();
    const donVi = (dvGo2 && (dvGo2 === String(h.DonViCoBan || '').trim()
                          || dvGo2 === String(h.DonViQuyDoi || '').trim()))
      ? dvGo2 : (h.DonViCoBan || 'Cái');
    const cuChinh = quyVeDonViChinh(don.SoLuongDat, don.DonVi, h.DonViCoBan, h.LoaiRi, h.DonViQuyDoi);
    const moiChinh = quyVeDonViChinh(soLuong, donVi, h.DonViCoBan, h.LoaiRi, h.DonViQuyDoi);
    const daTru = don.DaTruTon === undefined || don.DaTruTon === null ? true : !!don.DaTruTon;

    /* v6.23: PHẢI kiểm "còn đủ hàng không" cho CẢ 2 mô hình — trước đây cả khối kiểm nằm trong
       `if (daTru)`, nên đơn mới (DaTruTon=0) khách sửa 1 → 999999 vẫn lưu và khóa hết tồn của
       khách khác (vì đơn đang chờ được tính là "đang giữ"). */
    const ct = (await pool.request().input('mh', sql.Int, don.MaHangID).input('ms', sql.Int, don.MauSacID)
      .query('SELECT (NhapCai - XuatCai) AS TonCon FROM TheKhoChiTietMau WHERE MaHangID=@mh AND MauSacID=@ms')).recordset[0];
    const tonKho = ct ? Number(ct.TonCon) : 0;
    if (daTru) {
      const conLai = tonKho + cuChinh;      // đơn cũ: hoàn số cũ rồi mới trừ số mới
      if (moiChinh > conLai) {
        return res.status(400).json({ success: false, message: `Rất tiếc, ${h.TenHang || 'mặt hàng này'} không còn đủ để tăng lên ${soLuong} ${donVi}. Vui lòng chọn số nhỏ hơn.` });
      }
      const chenhLech = moiChinh - cuChinh;   // >0: trừ thêm; <0: hoàn lại
      if (chenhLech !== 0) {
        await pool.request().input('mh', sql.Int, don.MaHangID).input('ms', sql.Int, don.MauSacID).input('sl', sql.Int, chenhLech)
          .query('UPDATE TheKhoChiTietMau SET XuatCai = XuatCai + @sl WHERE MaHangID=@mh AND MauSacID=@ms');
      }
    } else {
      // Đơn chỉ GIỮ hàng: so với tồn khả dụng, bỏ phần chính đơn này đang giữ ra.
      const giu = await layHangDangGiu(pool);
      const giuKhac = Math.max(0, (giu.theoMau.get(don.MaHangID + '|' + don.MauSacID) || 0) - cuChinh);
      const khaDung = tonKho - giuKhac;
      if (moiChinh > khaDung) {
        return res.status(400).json({ success: false, message: `Rất tiếc, ${h.TenHang || 'mặt hàng này'} chỉ còn đủ cho ${khaDung > 0 ? khaDung + ' (đơn vị chính)' : '0'} — không tăng lên ${soLuong} ${donVi} được. Vui lòng chọn số nhỏ hơn.` });
      }
    }
    await pool.request().input('id', sql.Int, don.DonID).input('sl', sql.Int, soLuong).input('dv', sql.NVarChar, donVi)
      .query('UPDATE DonKhachDatHang SET SoLuongDat=@sl, DonVi=@dv WHERE DonID=@id');

    await thongBaoNhanVienKho(pool,
      `✏️ Khách "${k.tenKhach}" đã SỬA đơn #${don.DonID}: ${don.SoLuongDat} ${don.DonVi} → ${soLuong} ${donVi}.`);
    res.json({ success: true });
  } catch (err) {
    console.error('[public khach sua don] ', err);
    res.status(400).json({ success: false, message: 'Không sửa được đơn: ' + err.message });
  }
});

/* HỦY đơn (không xóa hẳn — giữ lịch sử cho nhân viên đối chiếu). Hoàn tồn nếu đơn đang trừ tồn. */
router.delete('/khach/donhang/:id', requireKhach, async (req, res) => {
  try {
    const k = khachDangNhap(req);
    const pool = await getPool();
    const don = await layDonCuaKhach(pool, parseInt(req.params.id, 10), k.id);
    if (!don) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn này trong tài khoản của bạn.' });
    if (!TRANG_THAI_KHACH_SUA_DUOC.includes(String(don.TrangThai))) {
      return res.status(400).json({ success: false, message: `Đơn đang ở trạng thái "${don.TrangThai}" nên không hủy được. Vui lòng liên hệ nhân viên bán hàng.` });
    }
    const daTru = don.DaTruTon === undefined || don.DaTruTon === null ? true : !!don.DaTruTon;
    if (daTru) {
      const h = (await pool.request().input('id', sql.Int, don.MaHangID)
        .query('SELECT LoaiRi, DonViCoBan, DonViQuyDoi FROM TheKhoHangHoa WHERE MaHangID=@id')).recordset[0] || {};
      const slChinh = quyVeDonViChinh(don.SoLuongDat, don.DonVi, h.DonViCoBan, h.LoaiRi, h.DonViQuyDoi);
      await pool.request().input('mh', sql.Int, don.MaHangID).input('ms', sql.Int, don.MauSacID).input('sl', sql.Int, slChinh)
        .query('UPDATE TheKhoChiTietMau SET XuatCai = XuatCai - @sl WHERE MaHangID=@mh AND MauSacID=@ms');
    }
    // Chỉ ghi DaTruTon khi CSDL thật sự có cột đó (chưa chạy migration_v657 thì bỏ qua, không lỗi).
    const coCotDaTruTon = Object.prototype.hasOwnProperty.call(don, 'DaTruTon');
    await pool.request().input('id', sql.Int, don.DonID)
      .query(`UPDATE DonKhachDatHang SET TrangThai=N'Đã hủy'${daTru && coCotDaTruTon ? ', DaTruTon=0' : ''} WHERE DonID=@id`);

    await thongBaoNhanVienKho(pool, `❌ Khách "${k.tenKhach}" đã HỦY đơn #${don.DonID}${daTru ? ' — tồn kho đã được hoàn lại.' : '.'}`);
    res.json({ success: true });
  } catch (err) {
    console.error('[public khach huy don] ', err);
    res.status(400).json({ success: false, message: 'Không hủy được đơn: ' + err.message });
  }
});

module.exports = router;
