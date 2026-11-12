/* ================================================================================================
   anhHashSanPham.js  —  v9.28 (Zalo OA, Giai đoạn 1 — phần ẢNH)

   KHÁCH GỬI ẢNH → TÌM RA MÃ HÀNG.

   Nguyen 2026-11-05: *"khi chát có mã hàng hoặc hình ảnh thì có thể check được tồn kho được luôn"*,
   và 2026-11-06: khách gửi **cả ba kiểu** ảnh — lấy lại từ catalogue/Zalo, tự chụp sản phẩm, và
   **chụp tem có mã + mã vạch**.

   File này lo kiểu "ảnh lấy lại từ catalogue/Zalo" bằng **dHash** (difference hash):
     thu nhỏ còn 9×8, xám hóa, so mỗi điểm với điểm bên phải nó → 64 bit.
   Ảnh bị NÉN LẠI / ĐỔI CỠ / đổi chất lượng vẫn ra hash gần như y hệt — đúng thứ Zalo làm với ảnh
   gửi qua chat. Ảnh CHỤP LẠI NGOÀI ĐỜI thì KHÔNG (nền khác, sáng khác, góc khác) — xem NGUONG_* và
   khối ghi chú ở `timTheoAnh`: kiểu đó phải để khách tự chọn trong danh sách ứng viên, CẤM đoán.

   Dùng `sharp` — ĐÃ CÓ trong package.json từ v5.18, không phải cài thêm.
   Mã vạch/QR trên tem do `docMaTuAnh.js` lo (cần @zxing/library).

   Chạy dựng sẵn chỉ mục (nên làm 1 lần sau khi deploy, kẻo khách đầu tiên phải chờ):
       node backend\utils\anhHashSanPham.js --dung
   ================================================================================================ */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
/* v6.07.1 — BẮT BUỘC trên Windows: libvips giữ file ảnh đang mở sau khi đọc, mọi thao tác
   ghi/xóa/đổi tên file đó về sau đều lỗi "UNKNOWN: unknown error, open ...". routes/anh.js và
   routes/upload.js đều đã phải tắt; file này đọc hàng nghìn ảnh nên càng phải tắt. */
sharp.cache(false);

const THU_MUC_ANH = path.join(__dirname, '..', 'uploads');
const FILE_CHI_MUC = path.join(THU_MUC_ANH, '.hash-anh.json');

/* Ngưỡng khoảng cách Hamming trên 64 bit:
     ≤ 8   — gần như chắc chắn cùng một tấm ảnh (chỉ khác mức nén/cỡ)
     ≤ 16  — đáng đưa vào danh sách ứng viên cho khách bấm chọn
     > 16  — bỏ, đừng làm phiền
   Số này lấy theo kinh nghiệm chung của dHash; 🔴 PHẢI đo lại bằng ảnh thật gửi qua Zalo rồi chỉnh. */
const NGUONG_CHAC = 8;
const NGUONG_UNG_VIEN = 16;

/* ---------------------------------------------------------------------------------------------- */
async function dHashTuBuffer(buf) {
  /* 9 cột × 8 hàng, xám, bỏ alpha. So cột i với cột i+1 trên từng hàng ⇒ 8×8 = 64 bit. */
  const raw = await sharp(buf).removeAlpha().greyscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer();
  let bit = '';
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      bit += raw[y * 9 + x] > raw[y * 9 + x + 1] ? '1' : '0';
    }
  }
  /* Gói thành 16 ký tự hex cho gọn khi lưu xuống đĩa. */
  let hex = '';
  for (let i = 0; i < 64; i += 4) hex += parseInt(bit.slice(i, i + 4), 2).toString(16);
  return hex;
}

const SO_BIT_1 = (() => { const b = []; for (let i = 0; i < 16; i++) b.push(i.toString(2).replace(/0/g, '').length); return b; })();
function khoangCach(hexA, hexB) {
  if (!hexA || !hexB || hexA.length !== hexB.length) return 64;
  let d = 0;
  for (let i = 0; i < hexA.length; i++) d += SO_BIT_1[parseInt(hexA[i], 16) ^ parseInt(hexB[i], 16)];
  return d;
}

/* `/uploads/anh_123.jpg` hoặc `anh_123.jpg` → tên file phẳng, chặn path traversal (giống anh.js). */
function tenFileTuLink(link) {
  const t = path.basename(String(link || '').split('?')[0]);
  return /^[A-Za-z0-9._-]+$/.test(t) ? t : null;
}

/* ------------------------------------------------------------------------------------------------
   CHỈ MỤC: { "<tên file>": { hash, mtime, size } } — lưu xuống đĩa để khởi động lại KHÔNG phải tính
   lại. Vài nghìn ảnh × sharp là vài phút; làm lại mỗi lần restart pm2 thì khách đầu tiên luôn phải
   chờ. Khóa theo mtime+size: ảnh bị thay bằng file khác cùng tên vẫn được tính lại.
   ------------------------------------------------------------------------------------------------ */
let __chiMuc = null;
function docChiMucTuDia() {
  if (__chiMuc) return __chiMuc;
  try { __chiMuc = JSON.parse(fs.readFileSync(FILE_CHI_MUC, 'utf8')) || {}; }
  catch (e) { __chiMuc = {}; }
  return __chiMuc;
}
let __ghiCho = null;
function ghiChiMucXuongDia() {
  /* Gộp nhiều lần ghi trong vài giây thành một — mỗi ảnh một lần ghi đĩa là phí. */
  if (__ghiCho) return;
  __ghiCho = setTimeout(() => {
    __ghiCho = null;
    try { fs.writeFileSync(FILE_CHI_MUC, JSON.stringify(__chiMuc)); } catch (e) { /* đệm hỏng thì thôi */ }
  }, 2000);
  if (__ghiCho.unref) __ghiCho.unref();   // đừng giữ tiến trình sống chỉ vì cái hẹn giờ này
}

async function hashCuaFile(ten) {
  const duong = path.join(THU_MUC_ANH, ten);
  let st;
  try { st = fs.statSync(duong); } catch (e) { return null; }          // ảnh đã bị xóa
  const ci = docChiMucTuDia();
  const cu = ci[ten];
  if (cu && cu.mtime === st.mtimeMs && cu.size === st.size) return cu.hash;
  let hash = null;
  try { hash = await dHashTuBuffer(fs.readFileSync(duong)); }
  catch (e) { return null; }                                            // file hỏng / không phải ảnh
  ci[ten] = { hash, mtime: st.mtimeMs, size: st.size };
  ghiChiMucXuongDia();
  return hash;
}

/* Danh sách ảnh của hàng ĐANG CÔNG KHAI: ảnh đại diện của mã + ảnh từng màu.
   🔴 Chỉ lấy hàng công khai — ảnh của mã nội bộ mà khớp thì bot sẽ lộ mã đó ra ngoài. Điều kiện
   công khai truyền từ ngoài vào (cùng hàm với catalogue), KHÔNG viết lại ở đây. */
async function danhSachAnh(pool, phuThuoc) {
  const { dieuKienCongKhaiMH, dieuKienCongKhaiDM } = phuThuoc;
  const rows = (await pool.request().query(`
    SELECT v.MaHangID, h.AnhDaiDien AS Anh
    FROM vw_TonKhoHangHoa v
    JOIN TheKhoHangHoa h ON h.MaHangID = v.MaHangID
    LEFT JOIN TheKhoDanhMuc dm ON dm.TheKhoDanhMucID = v.TheKhoDanhMucID
    WHERE v.TongTonThuc > 0 AND h.AnhDaiDien IS NOT NULL${await dieuKienCongKhaiMH(pool, 'h')}${dieuKienCongKhaiDM('dm')}
    UNION ALL
    SELECT v.MaHangID, ct.LinkAnh AS Anh
    FROM vw_TonTheoMau ct
    JOIN vw_TonKhoHangHoa v ON v.MaHangID = ct.MaHangID
    JOIN TheKhoHangHoa h ON h.MaHangID = v.MaHangID
    LEFT JOIN TheKhoDanhMuc dm ON dm.TheKhoDanhMucID = v.TheKhoDanhMucID
    WHERE ct.TonCai > 0 AND ct.LinkAnh IS NOT NULL${await dieuKienCongKhaiMH(pool, 'h')}${dieuKienCongKhaiDM('dm')}`)).recordset;
  const ra = [];
  const daCo = new Set();
  rows.forEach(r => {
    const ten = tenFileTuLink(r.Anh);
    if (!ten) return;
    const khoa = r.MaHangID + '|' + ten;
    if (daCo.has(khoa)) return;
    daCo.add(khoa);
    ra.push({ maHangID: r.MaHangID, ten });
  });
  return ra;
}

/* ------------------------------------------------------------------------------------------------
   TÌM THEO ẢNH. Trả { kieu, dsUngVien } — KHÔNG trả thẳng một mã:
     kieu 'chac'  — đúng một mã trong ngưỡng chắc
     kieu 'nhieu' — có ứng viên nhưng không chắc ⇒ bot đưa ảnh cho khách BẤM CHỌN
     kieu 'khong' — không có gì gần

   🔴 Vì sao không bao giờ tự chọn khi chỉ "gần": ảnh khách tự chụp ngoài đời luôn cho khoảng cách
   lớn, mà trong kho thì luôn có một tấm "gần nhất". Chọn bừa tấm gần nhất = trả tồn của mã KHÁC,
   khách đặt nhầm hàng. Thà hỏi lại.
   ------------------------------------------------------------------------------------------------ */
async function timTheoAnh(pool, buf, phuThuoc) {
  let hashKhach;
  try { hashKhach = await dHashTuBuffer(buf); }
  catch (e) { return { kieu: 'khong', dsUngVien: [], loi: 'Không đọc được ảnh.' }; }

  const ds = await danhSachAnh(pool, phuThuoc);
  const theoMa = new Map();        // MaHangID -> khoảng cách NHỎ NHẤT trong các ảnh của mã đó
  for (const a of ds) {
    const h = await hashCuaFile(a.ten);
    if (!h) continue;
    const d = khoangCach(hashKhach, h);
    const cu = theoMa.get(a.maHangID);
    if (cu == null || d < cu) theoMa.set(a.maHangID, d);
  }
  const sapXep = Array.from(theoMa.entries())
    .map(([maHangID, d]) => ({ maHangID, khoangCach: d }))
    .sort((x, y) => x.khoangCach - y.khoangCach);

  const chac = sapXep.filter(x => x.khoangCach <= NGUONG_CHAC);
  if (chac.length === 1) return { kieu: 'chac', dsUngVien: chac };
  const ungVien = sapXep.filter(x => x.khoangCach <= NGUONG_UNG_VIEN).slice(0, 3);
  if (ungVien.length) return { kieu: 'nhieu', dsUngVien: ungVien };
  return { kieu: 'khong', dsUngVien: [] };
}

/* Dựng sẵn toàn bộ chỉ mục — chạy sau khi deploy để khách đầu tiên không phải chờ. */
async function dungChiMuc(pool, phuThuoc, log) {
  const ds = await danhSachAnh(pool, phuThuoc);
  let moi = 0, hong = 0;
  for (const a of ds) {
    const truoc = (docChiMucTuDia()[a.ten] || {}).hash;
    const h = await hashCuaFile(a.ten);
    if (!h) hong++; else if (h !== truoc) moi++;
  }
  try { fs.writeFileSync(FILE_CHI_MUC, JSON.stringify(__chiMuc || {})); } catch (e) { /* bỏ qua */ }
  if (log) log(`Đã duyệt ${ds.length} ảnh — tính mới ${moi}, bỏ qua (thiếu file/ảnh hỏng) ${hong}.`);
  return { tong: ds.length, moi, hong };
}

module.exports = {
  dHashTuBuffer, khoangCach, tenFileTuLink, hashCuaFile,
  danhSachAnh, timTheoAnh, dungChiMuc,
  NGUONG_CHAC, NGUONG_UNG_VIEN, FILE_CHI_MUC, THU_MUC_ANH
};

/* ---- chạy thẳng từ dòng lệnh: node backend\utils\anhHashSanPham.js --dung ---------------------- */
if (require.main === module && process.argv.indexOf('--dung') !== -1) {
  (async () => {
    const { getPool } = require('../db');
    const pool = await getPool();
    /* v9.31: dùng CHUNG một bản điều kiện công khai với catalogue và bot Zalo. */
    const phuThuoc = require('./dieuKienCongKhai');
    const kq = await dungChiMuc(pool, phuThuoc, (s) => console.log(s));
    console.log('Chỉ mục nằm ở: ' + FILE_CHI_MUC);
    process.exit(kq.hong > 0 ? 0 : 0);
  })().catch(e => { console.error('Lỗi dựng chỉ mục: ' + e.message); process.exit(1); });
}
