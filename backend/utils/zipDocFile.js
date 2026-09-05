/* ================================================================================================
   ĐỌC FILE BÊN TRONG MỘT FILE .ZIP / .XLSX  —  chỉ dùng `zlib` có sẵn của Node        v7.65
   ------------------------------------------------------------------------------------------------
   Vì sao tự viết thay vì cài thư viện: file .xlsx là một file ZIP thường. `exceljs` đọc được các ô
   nhưng KHÔNG cho chạm vào `xl/drawings/*.xml` — nơi chứa các hình vẽ (đường rập) của cột "Piece
   Image". Cần đúng một việc là lấy nguyên văn vài file XML bên trong, nên thêm hẳn một thư viện nén
   vào dự án là không đáng; còn đi mượn thư viện nằm sâu trong `node_modules/exceljs/...` thì bản
   exceljs sau đổi cấu trúc là gãy mà không ai biết.

   Chỉ hỗ trợ hai kiểu nén mà Excel dùng: 0 = để nguyên, 8 = deflate. Kiểu khác thì báo rõ.
   ================================================================================================ */
const zlib = require('zlib');

const EOCD = 0x06054b50;        // End of central directory
const CEN = 0x02014b50;         // Central directory file header
const LOC = 0x04034b50;         // Local file header

/* Tìm bản ghi kết thúc (EOCD) từ CUỐI file trở lên. Phần chú thích cuối file dài tối đa 65535 byte
   nên chỉ cần dò trong chừng đó. */
function timEOCD(buf) {
    const min = Math.max(0, buf.length - 65535 - 22);
    for (let i = buf.length - 22; i >= min; i--) {
        if (buf.readUInt32LE(i) === EOCD) return i;
    }
    return -1;
}

/* Trả về Map: tên file bên trong -> Buffer nội dung. `locGiu(ten)` để chỉ giải nén những file cần,
   khỏi bung cả workbook (ảnh nhúng có thể vài chục MB). */
function docZip(buf, locGiu) {
    const iE = timEOCD(buf);
    if (iE < 0) throw new Error('File không phải định dạng ZIP/XLSX hợp lệ (không thấy bản ghi kết thúc).');
    const soMuc = buf.readUInt16LE(iE + 10);
    let p = buf.readUInt32LE(iE + 16);       // vị trí đầu central directory
    const ra = new Map();
    for (let i = 0; i < soMuc; i++) {
        if (buf.readUInt32LE(p) !== CEN) break;
        const nen = buf.readUInt16LE(p + 10);
        const cSize = buf.readUInt32LE(p + 20);
        const nLen = buf.readUInt16LE(p + 28);
        const eLen = buf.readUInt16LE(p + 30);
        const cLen = buf.readUInt16LE(p + 32);
        const off = buf.readUInt32LE(p + 42);
        const ten = buf.toString('utf8', p + 46, p + 46 + nLen);
        p += 46 + nLen + eLen + cLen;
        if (locGiu && !locGiu(ten)) continue;
        if (buf.readUInt32LE(off) !== LOC) continue;
        /* Độ dài tên/extra ở LOCAL header có thể KHÁC ở central directory — phải đọc lại từ local,
           lấy theo bản central là trỏ lệch vào giữa dữ liệu. */
        const nLen2 = buf.readUInt16LE(off + 26);
        const eLen2 = buf.readUInt16LE(off + 28);
        const dau = off + 30 + nLen2 + eLen2;
        const raw = buf.subarray(dau, dau + cSize);
        if (nen === 0) ra.set(ten, Buffer.from(raw));
        else if (nen === 8) ra.set(ten, zlib.inflateRawSync(raw));
        else throw new Error(`File "${ten}" nén bằng kiểu ${nen} — không đọc được (chỉ hỗ trợ 0 và 8).`);
    }
    return ra;
}

module.exports = { docZip };
