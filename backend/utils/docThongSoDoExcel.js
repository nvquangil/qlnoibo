/* ================================================================================================
   ĐỌC FILE EXCEL THÔNG SỐ KỸ THUẬT  ->  lưới { cols, rows } của form "Thêm thông số đo"   v7.64
   ------------------------------------------------------------------------------------------------
   File mẫu khách gửi (thong so ky thuat.xlsx):

        (trống) | Measure     | SIZE 4 | SIZE 6 | SIZE 8 | ...      <- dòng tiêu đề, KHÔNG ở dòng 1
        1       | DAI AO      | 39.45  | 41.87  | 46.27  | ...
        2       | RONG NGUC   | 32.76  | 36.02  | 38.62  | ...

   Yêu cầu: cột `Measure` -> cột THÔNG SỐ; các cột còn lại -> các size. Số dòng và số cột size
   LINH ĐỘNG, không cố định.

   ⚠️ KHÔNG gán cứng "tiêu đề ở dòng 1, thông số ở cột B". File thật có dòng trống ở trên, có cột
   STT ở trước, và mỗi khách đặt tên cột một kiểu. Nên:
     1. DÒ dòng tiêu đề = dòng đầu tiên có ô khớp một trong các tên đã biết của cột thông số.
     2. Cột thông số = chính ô đó. Các cột BÊN PHẢI có tiêu đề khác rỗng = các size, TRỪ những cột
        nhận ra được là "vị trí đo" / "dung sai" (khớp luôn vào đúng ô của form, khỏi phải gõ lại).
     3. Dòng dữ liệu = mọi dòng bên dưới có tên thông số khác rỗng.
   Không dò ra thì NÉM LỖI NÓI RÕ đã tìm những tên nào — im lặng trả lưới rỗng là người dùng tưởng
   file hỏng.
   ================================================================================================ */
const ExcelJS = require('exceljs');

/* Bỏ dấu + gộp khoảng trắng để so tên cột không phụ thuộc hoa/thường, dấu tiếng Việt. */
function chuan(v) {
  return String(v == null ? '' : v)
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd')
    .replace(/\s+/g, ' ').trim().toLowerCase();
}

const TEN_THONG_SO = ['measure', 'measurement', 'thong so', 'ten thong so', 'chi tiet do', 'vi tri do va thong so', 'point of measure', 'pom'];
const TEN_VI_TRI = ['vi tri do', 'cach do', 'how to measure', 'huong dan do'];
const TEN_DUNG_SAI = ['dung sai', 'tolerance', 'tol', '+/-', 'dung sai (+/-)'];

/* Ô Excel có thể là số, chuỗi, công thức {formula, result}, hoặc richText. Lấy ra chuỗi hiển thị.
   Số: bỏ đuôi .00 thừa (39.45 giữ nguyên, 5.0 -> "5") để lưới không đầy số lẻ vô nghĩa. */
function oChuoi(v) {
  if (v == null) return '';
  if (typeof v === 'number') return String(Math.round(v * 1e6) / 1e6);
  if (typeof v === 'object') {
    if (v.result != null) return oChuoi(v.result);
    if (Array.isArray(v.richText)) return v.richText.map(t => t.text).join('');
    if (v.text != null) return String(v.text);
    return '';
  }
  return String(v).trim();
}

function docSheet(ws, gioiHanCot) {
  const soCot = Math.min(ws.columnCount || 0, gioiHanCot || 60);
  const soDong = ws.rowCount || 0;
  const o = (r, c) => oChuoi(ws.getRow(r).getCell(c).value).trim();

  /* --- 1. Dò dòng tiêu đề --- */
  let dongTieuDe = 0, cotThongSo = 0;
  for (let r = 1; r <= Math.min(soDong, 30) && !dongTieuDe; r++) {
    for (let c = 1; c <= soCot; c++) {
      if (TEN_THONG_SO.indexOf(chuan(o(r, c))) !== -1) { dongTieuDe = r; cotThongSo = c; break; }
    }
  }
  if (!dongTieuDe) return null;

  /* --- 2. Phân loại các cột bên phải cột thông số --- */
  const cols = [];             // các size
  let cotViTri = 0, cotDungSai = 0;
  for (let c = cotThongSo + 1; c <= soCot; c++) {
    const ten = o(dongTieuDe, c);
    if (!ten) continue;
    const k = chuan(ten);
    if (!cotViTri && TEN_VI_TRI.indexOf(k) !== -1) { cotViTri = c; continue; }
    if (!cotDungSai && TEN_DUNG_SAI.indexOf(k) !== -1) { cotDungSai = c; continue; }
    cols.push({ tenCot: ten, _c: c });
  }

  /* --- 3. Dòng dữ liệu --- */
  const rows = [];
  for (let r = dongTieuDe + 1; r <= soDong; r++) {
    const ten = o(r, cotThongSo);
    if (!ten) continue;
    rows.push({
      tenDong: ten,
      viTriDo: cotViTri ? o(r, cotViTri) : '',
      dungSai: cotDungSai ? o(r, cotDungSai) : '',
      values: cols.map(c => o(r, c._c))
    });
  }
  return { cols: cols.map(c => ({ tenCot: c.tenCot })), rows, dongTieuDe, tenSheet: ws.name };
}

/* Đọc buffer .xlsx -> { cols, rows, tenSheet, dongTieuDe }. Duyệt TỪNG sheet cho tới khi thấy sheet
   có dòng tiêu đề hợp lệ — file khách hay có sheet trống hoặc sheet hướng dẫn ở trước. */
async function docThongSoDoExcel(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const daThu = [];
  for (const ws of wb.worksheets) {
    daThu.push(ws.name);
    const kq = docSheet(ws);
    if (kq && kq.rows.length) return kq;
  }
  const err = new Error(
    'Không tìm thấy bảng thông số trong file. Cần một dòng tiêu đề có ô tên là '
    + TEN_THONG_SO.map(x => `"${x}"`).join(' / ')
    + ', bên phải nó là các cột size. Đã dò các sheet: ' + (daThu.join(', ') || '(không có sheet nào)') + '.');
  err.khongDoRa = true;
  throw err;
}

module.exports = { docThongSoDoExcel, chuan, oChuoi, TEN_THONG_SO, TEN_VI_TRI, TEN_DUNG_SAI };
