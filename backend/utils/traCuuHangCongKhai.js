/* ================================================================================================
   traCuuHangCongKhai.js  —  v9.25 (Zalo OA, Giai đoạn 1)

   TRA MỘT MÃ → TRẢ ĐÚNG NHỮNG GÌ CATALOGUE ĐANG CHO KHÁCH XEM.

   Nguyen 2026-11-05: *"khi chát có mã hàng hoặc hình ảnh thì có thể check được tồn kho được luôn"*,
   và *"hiển thị giá bán và mầu tồn như catalogue"*.

   🔴 LUẬT HIỂN THỊ — ĐỌC TRƯỚC KHI SỬA FILE NÀY:
   Catalogue hiện tại (frontend/js/catalogue.js:471) chỉ hiện TÊN CÁC MÀU CÒN HÀNG + GIÁ BÁN.
   KHÔNG hiện số lượng tồn. Đây là chính sách có chủ ý từ khi mở tài khoản khách
   (xem khối ghi chú của migration TaiKhoanKhach trong CAI_DAT_DAY_DU.sql).
   => Hàm này KHÔNG BAO GIỜ trả `tonCai`, `tongTon`, giá vốn, giá Aloha, MaBarcode hay ID nội bộ.
   Bot trả lời qua Zalo là kênh AI NHẮN CŨNG HỎI ĐƯỢC — rộng hơn trang web nhiều. Nói nhiều hơn web
   một chữ là lộ năng lực kho cho cả người không phải khách.

   🔴 ĐIỀU KIỆN CÔNG KHAI: lấy đúng BA điều kiện của catalogue, không tự viết lại:
       v.TongTonThuc > 0  +  ISNULL(h.CongKhai,1)=1  +  ISNULL(dm.CongKhai,1)=1
   và trừ tiếp HÀNG ĐANG GIỮ cho đơn chưa xuất (layHangDangGiu — v6.23). Màu đã có người đặt hết thì
   KHÔNG còn là "còn hàng".

   Hai mã người dùng có thể gửi (Nguyen chốt 2026-11-06):
     · MÃ HÀNG   = TheKhoHangHoa.MaHang     (cột "Mã hàng" ở Thẻ kho hàng hóa)
     · MÃ VẠCH   = TheKhoHangHoa.MaBarcode  (số riêng, tự đặt, in trên tem)
   Cả hai đều tra được; mã vạch chỉ dùng để TÌM, không bao giờ hiện ra cho khách.
   ================================================================================================ */
const { sql } = require('../db');

/* Chuẩn hóa để so khớp: bỏ dấu tiếng Việt, hoa hết, bỏ mọi ký tự không phải chữ/số.
   Lý do: khách gõ "ab-123", "AB 123", "ab123" đều là một mã. KHÔNG dùng bản chuẩn hóa này để hiển
   thị — hiện ra phải là MaHang gốc trong cơ sở dữ liệu. */
/* Dấu tiếng Việt sau NFD là các ký tự TỔ HỢP U+0300..U+036F. Viết bằng RegExp('\\u0300-\\u036f')
   chứ KHÔNG gõ thẳng ký tự tổ hợp vào file nguồn — ký tự không nhìn thấy được trong mã nguồn là thứ
   sau này không ai sửa nổi (cùng bài học với "không viết ký tự điều khiển vào file nguồn", v8.85). */
const DAU_TO_HOP = new RegExp('[\\u0300-\\u036f]', 'g');
function chuanHoa(s) {
  return String(s == null ? '' : s)
    .normalize('NFD').replace(DAU_TO_HOP, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')   // đ / Đ — NFD không tách được hai chữ này
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

/* ------------------------------------------------------------------------------------------------
   CHỈ MỤC MÃ (MaHangID, MaHang, MaBarcode) — nạp một lần, giữ 60 giây.
   Vì sao giữ trong bộ nhớ: mỗi tin nhắn của khách phải thử MỌI TỪ trong câu ("còn mã AB123 không
   shop" → 5 từ). Bắn 5 câu SQL cho một tin nhắn, nhân với số khách nhắn cùng lúc, trên một máy
   Windows ở xưởng là tự hại mình. Bảng mã nhỏ và gần như không đổi trong ngày.
   ------------------------------------------------------------------------------------------------ */
let __chiMuc = null;
let __chiMucLuc = 0;
const HAN_CHI_MUC_MS = 60 * 1000;

function xoaChiMuc() { __chiMuc = null; __chiMucLuc = 0; }   // gọi khi sửa/thêm mã hàng, nếu muốn tức thì

async function layChiMuc(pool) {
  const bayGio = Date.now();
  if (__chiMuc && (bayGio - __chiMucLuc) < HAN_CHI_MUC_MS) return __chiMuc;
  const rows = (await pool.request().query(`
    SELECT MaHangID, MaHang, MaBarcode FROM TheKhoHangHoa`)).recordset;
  const theoMa = new Map();      // mã hàng chuẩn hóa -> [MaHangID]
  const theoBarcode = new Map(); // mã vạch chuẩn hóa -> [MaHangID]
  const dsPhang = [];            // để dò "chứa" khi không khớp chính xác
  rows.forEach(r => {
    const m = chuanHoa(r.MaHang);
    const b = chuanHoa(r.MaBarcode);
    if (m) { if (!theoMa.has(m)) theoMa.set(m, []); theoMa.get(m).push(r.MaHangID); }
    if (b) { if (!theoBarcode.has(b)) theoBarcode.set(b, []); theoBarcode.get(b).push(r.MaHangID); }
    dsPhang.push({ id: r.MaHangID, ma: m, barcode: b });
  });
  __chiMuc = { theoMa, theoBarcode, dsPhang };
  __chiMucLuc = bayGio;
  return __chiMuc;
}

/* Tách tin nhắn thành các ứng viên mã: từng từ, VÀ các cặp hai từ liền nhau (mã hay bị gõ rời
   "AB 123"). Bỏ từ quá ngắn — "có", "ạ", "ơi" mà đem đi dò thì chỉ tốn công. */
const DAI_TOI_THIEU = 3;
function tachUngVien(cau) {
  const tho = String(cau || '').split(/[\s,.;:!?()\[\]{}"'“”‘’]+/).filter(Boolean);
  const ra = [];
  const them = (x) => { const c = chuanHoa(x); if (c.length >= DAI_TOI_THIEU && ra.indexOf(c) === -1) ra.push(c); };
  tho.forEach(them);
  for (let i = 0; i + 1 < tho.length; i++) them(tho[i] + tho[i + 1]);
  them(cau);                      // cả câu, phòng khi khách gửi đúng mỗi mã
  /* Mã dài tìm trước: "AB123" đúng hơn "AB" khi cả hai cùng khớp một thứ gì đó. */
  return ra.sort((a, b) => b.length - a.length);
}

/* ------------------------------------------------------------------------------------------------
   TÌM: trả { kieu, ids }
     kieu = 'chinh-xac'  -> đúng MỘT mã hàng, tin được, trả lời thẳng
     kieu = 'nhieu'      -> nhiều ứng viên, PHẢI hỏi lại kèm ảnh, CẤM đoán
     kieu = 'khong'      -> không ra gì

   🔴 Vì sao cấm đoán: trả nhầm mã thì khách đặt nhầm hàng. Hỏi lại một câu rẻ hơn nhiều so với một
   đơn sai. Mã trùng barcode (có thể có, vì MaBarcode nhập tay) cũng rơi vào 'nhieu' — không chọn bừa.
   ------------------------------------------------------------------------------------------------ */
const TOI_DA_UNG_VIEN = 3;
async function timUngVien(pool, cau) {
  const ci = await layChiMuc(pool);
  const ungVien = tachUngVien(cau);

  // Bước 1 + 2: khớp CHÍNH XÁC mã hàng, rồi tới mã vạch.
  for (const u of ungVien) {
    const theoMa = ci.theoMa.get(u);
    if (theoMa && theoMa.length) {
      return { kieu: theoMa.length === 1 ? 'chinh-xac' : 'nhieu', ids: theoMa.slice(0, TOI_DA_UNG_VIEN), khop: u, nguon: 'ma-hang' };
    }
  }
  for (const u of ungVien) {
    const theoBc = ci.theoBarcode.get(u);
    if (theoBc && theoBc.length) {
      return { kieu: theoBc.length === 1 ? 'chinh-xac' : 'nhieu', ids: theoBc.slice(0, TOI_DA_UNG_VIEN), khop: u, nguon: 'ma-vach' };
    }
  }

  /* Bước 3: CHỨA — chỉ để GỢI Ý, không bao giờ tự nhận là chính xác dù chỉ ra một kết quả.
     "AB12" chứa trong "AB123" và "AB124"; ra đúng một cái cũng có thể là do mã kia chưa nhập. */
  const gan = [];
  for (const u of ungVien) {
    if (u.length < 4) continue;                       // 3 ký tự mà đem đi dò "chứa" thì ra cả kho
    ci.dsPhang.forEach(r => {
      if (gan.indexOf(r.id) !== -1) return;
      if ((r.ma && r.ma.indexOf(u) !== -1) || (r.barcode && r.barcode.indexOf(u) !== -1)) gan.push(r.id);
    });
    if (gan.length) break;
  }
  if (gan.length) return { kieu: 'nhieu', ids: gan.slice(0, TOI_DA_UNG_VIEN), khop: null, nguon: 'gan-dung' };
  return { kieu: 'khong', ids: [], khop: null, nguon: null };
}

/* ------------------------------------------------------------------------------------------------
   LẤY THÔNG TIN CÔNG KHAI của các mã hàng đã tìm ra.
   Dùng ĐÚNG bộ lọc của catalogue (xem khối đầu file). Mã không đạt điều kiện công khai thì BIẾN MẤT
   khỏi kết quả — không báo "có nhưng không được xem", vì nói vậy là đã tiết lộ nó tồn tại.
   ------------------------------------------------------------------------------------------------ */
async function layThongTinCongKhai(pool, ids, phuThuoc) {
  const dsId = (ids || []).map(n => Number(n)).filter(n => Number.isInteger(n) && n > 0);
  if (!dsId.length) return [];
  const { dieuKienCongKhaiMH, dieuKienCongKhaiDM, layHangDangGiu } = phuThuoc;

  const rq = pool.request();
  dsId.forEach((id, i) => rq.input('id' + i, sql.Int, id));
  const thamSo = dsId.map((_, i) => '@id' + i).join(',');

  const items = (await rq.query(`
    SELECT v.MaHangID, v.MaHang, v.TenHang, v.GiaBan, v.AnhDaiDien, v.TenTheKho,
           h.DonViCoBan, h.DonViQuyDoi, h.LoaiRi
    FROM vw_TonKhoHangHoa v
    JOIN TheKhoHangHoa h ON h.MaHangID = v.MaHangID
    LEFT JOIN TheKhoDanhMuc dm ON dm.TheKhoDanhMucID = v.TheKhoDanhMucID
    WHERE v.MaHangID IN (${thamSo}) AND v.TongTonThuc > 0${await dieuKienCongKhaiMH(pool, 'h')}${dieuKienCongKhaiDM('dm')}
    ORDER BY v.TenHang`)).recordset;
  if (!items.length) return [];

  const giu = await layHangDangGiu(pool);
  const rqM = pool.request();
  items.forEach((it, i) => rqM.input('m' + i, sql.Int, it.MaHangID));
  const mau = (await rqM.query(`
    SELECT ct.MaHangID, ct.MauSacID, ms.TenMau, ct.LinkAnh, ct.TonCai
    FROM vw_TonTheoMau ct
    JOIN MauSac ms ON ms.MauSacID = ct.MauSacID
    WHERE ct.MaHangID IN (${items.map((_, i) => '@m' + i).join(',')}) AND ct.TonCai > 0
    ORDER BY ms.TenMau`)).recordset;

  const theoMaHang = {};
  mau.forEach(c => {
    /* v6.23: trừ hàng đang giữ cho đơn chưa xuất — màu đã có người đặt hết thì không còn là "còn". */
    const conLai = Number(c.TonCai) - (giu.theoMau.get(c.MaHangID + '|' + c.MauSacID) || 0);
    if (conLai <= 0) return;
    if (!theoMaHang[c.MaHangID]) theoMaHang[c.MaHangID] = [];
    // 🔴 CHỈ tên màu + ảnh. Không kèm số lượng — xem luật hiển thị ở đầu file.
    theoMaHang[c.MaHangID].push({ tenMau: c.TenMau, anh: c.LinkAnh });
  });

  return items
    .map(i => ({
      maHang: i.MaHang, tenHang: i.TenHang, giaBan: i.GiaBan, anhDaiDien: i.AnhDaiDien,
      danhMuc: i.TenTheKho,
      donViCoBan: i.DonViCoBan || 'Cái', donViQuyDoi: i.DonViQuyDoi || '', loaiRi: Number(i.LoaiRi) || 1,
      mauConLai: theoMaHang[i.MaHangID] || []
    }))
    .filter(x => x.mauConLai.length);   // hết sạch màu = hết hàng, đừng trả về một thẻ rỗng
}

/* ------------------------------------------------------------------------------------------------
   HÀM CHÍNH cho bot: nhận nguyên câu khách nhắn, trả về thứ đủ để soạn câu trả lời.
     { trangThai: 'thay' | 'nhieu' | 'khong', items: [...] }
   'thay'  -> đúng một mã, trả lời luôn
   'nhieu' -> đưa ứng viên cho khách bấm chọn
   'khong' -> xin mã hàng / gửi link catalogue
   ------------------------------------------------------------------------------------------------ */
async function traCuuTheoChuoi(pool, cau, phuThuoc) {
  const tim = await timUngVien(pool, cau);
  if (tim.kieu === 'khong') return { trangThai: 'khong', items: [], nguon: null };
  const items = await layThongTinCongKhai(pool, tim.ids, phuThuoc);
  if (!items.length) return { trangThai: 'khong', items: [], nguon: tim.nguon };
  /* Khớp chính xác nhưng sau khi lọc công khai chỉ còn đúng 1 -> vẫn là 'thay'.
     Khớp chính xác mà lọc xong còn nhiều (mã trùng) -> để khách chọn. */
  const trangThai = (tim.kieu === 'chinh-xac' && items.length === 1) ? 'thay'
    : (items.length === 1 && tim.nguon !== 'gan-dung') ? 'thay' : 'nhieu';
  return { trangThai, items, nguon: tim.nguon };
}

module.exports = {
  chuanHoa, tachUngVien, timUngVien, layThongTinCongKhai, traCuuTheoChuoi,
  xoaChiMuc, HAN_CHI_MUC_MS, TOI_DA_UNG_VIEN
};
