/* ================================================================================================
   ĐỌC FILE EXCEL "THỐNG KÊ CHI TIẾT"  ->  các dòng chi tiết + hình rập               v7.65
   ------------------------------------------------------------------------------------------------
   File mẫu khách gửi (thong ke chi tiet.xlsx):

     (trống) | Piece Name | Material | Quantity | Pair | Opposite | Piece Image     <- tiêu đề DÒNG 3
     1       | bo co      | VC       | 1        | 0    | None     | (hình vẽ)
     2       | A TT-X1    | VC       | 1        | 0    | None     | (hình vẽ)

   ⚠️ CỘT "Piece Image" KHÔNG CHỨA ẢNH. File không có `xl/media/` nào cả — nó chứa các hình
   **Freeform** của Excel (đường rập vẽ bằng đường gấp khúc), neo vào từng dòng. `exceljs.getImages()`
   chỉ trả về `<xdr:pic>` nên với file này nó ra RỖNG. Việc đổi hình vẽ sang SVG nằm ở
   utils/docHinhVeExcel.js; ở đây chỉ ghép chúng vào đúng dòng.

   Tiêu đề hiển thị trên form/bản in là TIẾNG VIỆT, nhưng bộ đọc nhận CẢ tên tiếng Anh trong file
   lẫn tên tiếng Việt — file của khách nước ngoài và file nội bộ đều nhập được.
   ================================================================================================ */
const ExcelJS = require('exceljs');
const { chuan, oChuoi } = require('./docThongSoDoExcel');
const { docHinhVeTheoDong } = require('./docHinhVeExcel');

/* Tên cột: mỗi trường nhận nhiều cách viết. `khoa` = tên trường trong dữ liệu của form. */
const COT = [
  { khoa: 'pieceName', nhan: 'Tên chi tiết', ten: ['piece name', 'piece', 'ten chi tiet', 'chi tiet', 'ten piece'] },
  { khoa: 'material', nhan: 'Vật liệu', ten: ['material', 'vat lieu', 'nguyen lieu', 'chat lieu'] },
  { khoa: 'quantity', nhan: 'Số lượng', ten: ['quantity', 'qty', 'so luong'] },
  { khoa: 'pair', nhan: 'Cặp', ten: ['pair', 'cap', 'doi'] },
  { khoa: 'opposite', nhan: 'Chiều đối xứng', ten: ['opposite', 'chieu doi xung', 'doi xung', 'chieu'] },
  { khoa: 'anhChiTiet', nhan: 'Hình chi tiết', ten: ['piece image', 'image', 'hinh chi tiet', 'hinh anh', 'hinh'] },
  { khoa: 'tongSoLuong', nhan: 'Tổng số lượng', ten: ['tong so luong', 'total', 'total qty', 'tong'] }
];
/* Cột BẮT BUỘC phải tìm ra thì mới coi là đã thấy bảng. */
const COT_MOC = COT[0];

/* ================================================================================================
   v7.71 — BỎ CÁC DÒNG NHÃN, KHÔNG ĐỔ VÀO BẢNG.
   File gốc của khách (TKCT BD26C12.xlsx) KHÔNG chỉ có một bảng — nó có NHIỀU KHỐI, mỗi khối là một
   loại vải, và mỗi khối lại có dòng nhãn + dòng tiêu đề RIÊNG:

        Style Set: | BD26C12 VCQ                      <- dòng nhãn
        Piece Name | Code | Description | Material ... <- tiêu đề
        BO GAU     |      |             | VCQ      ...
        ...
        Style Set: | BD26C12 VCA                      <- nhãn của khối 2
        Piece Name | Code | ...                        <- tiêu đề LẶP LẠI
        TSA X1     | ...  | VCA ...

   Bộ đọc dò tiêu đề của khối ĐẦU rồi lấy mọi dòng bên dưới, nên "Style Set:" và "Piece Name" của
   các khối sau bị lấy thành DÒNG DỮ LIỆU rác (tên chi tiết = "Style Set:"). Trước đây Nguyen phải
   tự xóa các dòng đó trong Excel.

   Vẫn ĐỌC HẾT các khối vào một bảng — mỗi khối chỉ khác nhau ở cột Material (VCQ / VCA / MEX), và
   dòng "Tổng số lượng theo vật liệu" của v7.68 sẽ tự tách ra theo đúng từng loại vải.

   Nhận diện theo ô TÊN CHI TIẾT, hai đường riêng biệt:
     · Dòng TIÊU ĐỀ lặp lại  -> ô đó ghi đúng tên của CỘT MỐC ("Piece Name" / "Tên chi tiết"...).
     · Dòng NHÃN ("Style Set:") -> khớp danh sách nhãn VÀ ô Vật liệu TRỐNG.
   Cắt dấu hai chấm cuối trước khi so — file ghi "Style Set:".

   ⚠️ ĐÃ BỎ OAN MỘT LẦN: bản đầu tôi so với TÊN CỦA MỌI CỘT, mà 'cap' là tên tiếng Việt (bỏ dấu) của
   cột "Cặp" — nên chi tiết THẬT tên "cap" trong file của khách bị xóa mất. Vì vậy:
     - dòng tiêu đề chỉ so với CỘT MỐC, không so cả 7 cột;
     - nhãn phải kèm điều kiện "Vật liệu trống", vì dòng dữ liệu thật luôn có vật liệu.
   ================================================================================================ */
const NHAN_BO_DONG = ['style set', 'style', 'style file', 'chart', 'date', 'working units',
  'measurement chart', 'measurement charts', 'set name', 'bo mau'];
/* kTen / kVatLieu: giá trị 2 ô của dòng, ĐÃ qua chuan(). */
function laDongNhan(kTen, kVatLieu) {
  const t = String(kTen || '').replace(/[:：]+\s*$/, '').trim();
  if (!t) return false;
  if (COT_MOC.ten.indexOf(t) !== -1) return true;                       // tiêu đề của khối tiếp theo
  return NHAN_BO_DONG.indexOf(t) !== -1 && !String(kVatLieu || '').trim();
}

async function docThongKeChiTietExcel(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const daThu = [];

  for (let i = 0; i < wb.worksheets.length; i++) {
    const ws = wb.worksheets[i];
    daThu.push(ws.name);
    const soCot = Math.min(ws.columnCount || 0, 60);
    const soDong = ws.rowCount || 0;
    const o = (r, c) => oChuoi(ws.getRow(r).getCell(c).value).trim();

    /* --- 1. Dò dòng tiêu đề = dòng đầu tiên có ô khớp tên cột MỐC --- */
    let dongTieuDe = 0;
    for (let r = 1; r <= Math.min(soDong, 30) && !dongTieuDe; r++) {
      for (let c = 1; c <= soCot; c++) {
        if (COT_MOC.ten.indexOf(chuan(o(r, c))) !== -1) { dongTieuDe = r; break; }
      }
    }
    if (!dongTieuDe) continue;

    /* --- 2. Ghép từng cột của file vào đúng trường --- */
    const viTri = {};                 // khoa -> chỉ số cột
    for (let c = 1; c <= soCot; c++) {
      const k = chuan(o(dongTieuDe, c));
      if (!k) continue;
      const cot = COT.find(x => x.ten.indexOf(k) !== -1);
      if (cot && !viTri[cot.khoa]) viTri[cot.khoa] = c;
    }
    if (!viTri.pieceName) continue;

    /* --- 3. Hình vẽ trong cột "Piece Image", theo từng dòng --- */
    let hinh = { theoDong: new Map(), lenhLa: [] };
    try { hinh = docHinhVeTheoDong(buffer, `xl/worksheets/sheet${i + 1}.xml`); }
    catch (e) { hinh = { theoDong: new Map(), lenhLa: [], loi: e.message }; }

    /* --- 4. Các dòng dữ liệu --- */
    const rows = [];
    const boQuaDong = [];            // v7.71: các dòng nhãn đã bỏ — để báo lại cho người dùng
    for (let r = dongTieuDe + 1; r <= soDong; r++) {
      const ten = o(r, viTri.pieceName);
      /* Dòng KHÔNG có tên chi tiết nhưng CÓ hình -> vẫn giữ: rập có thể chưa kịp đặt tên, bỏ đi là
         mất hình mà người dùng không biết. Dòng trống hẳn thì mới bỏ. */
      const svg = hinh.theoDong.get(r - 1) || '';
      if (!ten && !svg) continue;
      const lay = (k) => (viTri[k] ? o(r, viTri[k]) : '');
      /* v7.71: dòng nhãn ("Style Set:") và dòng tiêu đề lặp lại của khối sau -> BỎ. */
      if (ten && laDongNhan(chuan(ten), lay('material'))) { boQuaDong.push(ten); continue; }
      rows.push({
        pieceName: ten,
        material: lay('material'),
        quantity: lay('quantity'),
        pair: lay('pair'),
        opposite: lay('opposite'),
        /* Ô chữ trong cột hình (nếu có) giữ làm ghi chú — không đè lên hình vẽ. */
        ghiChu: lay('anhChiTiet'),
        tongSoLuong: lay('tongSoLuong'),
        anhSvg: svg          // data URL SVG; route sẽ ghi ra file rồi thay bằng đường dẫn
      });
    }
    if (!rows.length) continue;
    return { rows, dongTieuDe, tenSheet: ws.name, soHinh: hinh.theoDong.size, lenhLa: hinh.lenhLa || [], boQuaDong };
  }

  const err = new Error(
    'Không tìm thấy bảng thống kê chi tiết trong file. Cần một dòng tiêu đề có ô tên là '
    + COT_MOC.ten.map(x => `"${x}"`).join(' / ')
    + '. Đã dò các sheet: ' + (daThu.join(', ') || '(không có sheet nào)') + '.');
  err.khongDoRa = true;
  throw err;
}

module.exports = { docThongKeChiTietExcel, COT, laDongNhan, NHAN_BO_DONG };
