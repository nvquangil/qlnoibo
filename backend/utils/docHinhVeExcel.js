/* ================================================================================================
   LẤY HÌNH VẼ (đường rập) TRONG FILE EXCEL RA THÀNH SVG, THEO TỪNG DÒNG               v7.65
   ------------------------------------------------------------------------------------------------
   Cột "Piece Image" của file thống kê chi tiết KHÔNG chứa ảnh dán vào: file không có `xl/media/`
   nào cả. Nó chứa các hình **Freeform** của Excel — đường rập vẽ bằng đường gấp khúc, neo vào từng
   dòng. Mọi thư viện đọc Excel thông thường (kể cả `exceljs`) đều bỏ qua chúng: `getImages()` chỉ
   trả về `<xdr:pic>`, còn đây là `<xdr:sp>`.

   May là hình chỉ gồm `moveTo` / `lnTo` / `close` — KHÔNG có đường cong (`cubicBezTo`, `arcTo`).
   Nên chuyển sang SVG là phép đổi thẳng: `M x,y L x,y … Z`.
   ⚠️ Gặp lệnh vẽ ngoài ba lệnh trên thì BÁO RA (`lenhLa`) chứ không vẽ bừa — vẽ thiếu một đoạn cong
   thì hình vẫn "trông có vẻ đúng", người dùng không cách nào biết là đã mất nét.

   TỌA ĐỘ: mỗi hình có `a:off` (vị trí) + `a:ext` (kích thước) trong hệ EMU của trang tính, còn
   `a:custGeom/a:path` có hệ tọa độ riêng `w`,`h`. Nhiều hình cùng một dòng phải ghép vào CHUNG một
   khung nhìn để giữ đúng vị trí tương đối của chúng — nên quy hết về hệ EMU của trang.
   ================================================================================================ */
const { docZip } = require('./zipDocFile');

const so = (v) => { const n = Number(v); return isFinite(n) ? n : 0; };

/* Lấy tất cả đoạn `<the ...>…</the>` (kể cả thẻ tự đóng) — đủ cho DrawingML, khỏi cần bộ phân tích XML. */
function catThe(xml, the) {
    const ra = [];
    const re = new RegExp(`<${the}(\\s[^>]*)?(/>|>)`, 'g');
    let m;
    while ((m = re.exec(xml))) {
        if (m[2] === '/>') { ra.push(m[0]); continue; }
        const dong = `</${the}>`;
        const het = xml.indexOf(dong, re.lastIndex);
        if (het < 0) break;
        ra.push(xml.slice(m.index, het + dong.length));
        re.lastIndex = het + dong.length;
    }
    return ra;
}
const layThuoc = (s, ten) => { const m = new RegExp(`${ten}="([^"]*)"`).exec(s || ''); return m ? m[1] : ''; };
const laySo = (s, the) => { const m = new RegExp(`<${the}>(-?\\d+)</${the}>`).exec(s || ''); return m ? Number(m[1]) : 0; };

/* Một <xdr:sp> -> { dong, d, off, ext, lenhLa } . `dong` = chỉ số dòng (0-based) mà hình neo vào. */
function docMotHinh(anchor) {
    const tu = (/<xdr:from>([\s\S]*?)<\/xdr:from>/.exec(anchor) || [])[1] || '';
    const dong = laySo(tu, 'xdr:row');
    const off = (/<a:off[^>]*\/>/.exec(anchor) || [''])[0];
    const ext = (/<a:ext[^>]*\/>/.exec(anchor) || [''])[0];
    const oX = so(layThuoc(off, 'x')), oY = so(layThuoc(off, 'y'));
    const cX = so(layThuoc(ext, 'cx')), cY = so(layThuoc(ext, 'cy'));

    const path = (/<a:path[^>]*>[\s\S]*?<\/a:path>/.exec(anchor) || [''])[0];
    if (!path) return null;
    const pW = so(layThuoc(path, 'w')) || 1, pH = so(layThuoc(path, 'h')) || 1;
    /* Hệ tọa độ của path -> hệ EMU của trang: nhân tỷ lệ rồi cộng vị trí hình. */
    const qx = (x) => oX + (x / pW) * cX;
    const qy = (y) => oY + (y / pH) * cY;

    let d = '', lenhLa = [];
    const re = /<a:(moveTo|lnTo|close)(?:\s[^>]*)?(?:>([\s\S]*?)<\/a:\1>|\/>)/g;
    let m;
    while ((m = re.exec(path))) {
        const lenh = m[1], than = m[2] || '';
        if (lenh === 'close') { d += 'Z '; continue; }
        const pt = /<a:pt[^>]*\/>/.exec(than);
        if (!pt) continue;
        const x = qx(so(layThuoc(pt[0], 'x'))), y = qy(so(layThuoc(pt[0], 'y')));
        d += (lenh === 'moveTo' ? 'M' : 'L') + Math.round(x) + ',' + Math.round(y) + ' ';
    }
    /* Lệnh vẽ KHÁC ba lệnh trên -> ghi nhận để báo ra, không im lặng bỏ nét. */
    ['cubicBezTo', 'quadBezTo', 'arcTo'].forEach(l => { if (path.indexOf('<a:' + l) !== -1) lenhLa.push(l); });
    if (!d.trim()) return null;
    return { dong, d: d.trim(), x1: oX, y1: oY, x2: oX + cX, y2: oY + cY, lenhLa };
}

/* Gộp các hình CÙNG MỘT DÒNG thành một SVG (data URL). Giữ đúng vị trí tương đối giữa chúng. */
function ghepSvg(dsHinh) {
    const x1 = Math.min(...dsHinh.map(h => h.x1)), y1 = Math.min(...dsHinh.map(h => h.y1));
    const x2 = Math.max(...dsHinh.map(h => h.x2)), y2 = Math.max(...dsHinh.map(h => h.y2));
    const w = Math.max(1, x2 - x1), h = Math.max(1, y2 - y1);
    const dem = 0.02 * Math.max(w, h);   // chừa lề để nét không dính mép
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${Math.round(x1 - dem)} ${Math.round(y1 - dem)} ${Math.round(w + dem * 2)} ${Math.round(h + dem * 2)}">`
        + `<g fill="none" stroke="#000" stroke-width="${Math.max(1, Math.round(Math.max(w, h) / 220))}" stroke-linejoin="round">`
        + dsHinh.map(h2 => `<path d="${h2.d}"/>`).join('')
        + '</g></svg>';
    return 'data:image/svg+xml;base64,' + Buffer.from(svg, 'utf8').toString('base64');
}

/* buffer .xlsx -> Map(chỉ số dòng 0-based -> data URL SVG).
   `tenSheetXml` ví dụ 'xl/worksheets/sheet1.xml' — để lấy đúng bản vẽ của sheet đang đọc. */
function docHinhVeTheoDong(buffer, tenSheetXml) {
    const cacFile = docZip(buffer, (t) => t.indexOf('xl/drawings/drawing') === 0
        || t.indexOf('xl/worksheets/_rels/') === 0);
    const ten = tenSheetXml || 'xl/worksheets/sheet1.xml';
    const relPath = ten.replace('xl/worksheets/', 'xl/worksheets/_rels/') + '.rels';
    let duongVe = null;
    const rel = cacFile.get(relPath);
    if (rel) {
        const m = /Target="([^"]*drawings\/drawing\d+\.xml)"/.exec(rel.toString('utf8'));
        if (m) duongVe = 'xl/' + m[1].replace(/^\.\.\//, '');
    }
    if (!duongVe) {
        const dau = [...cacFile.keys()].filter(k => /^xl\/drawings\/drawing\d+\.xml$/.test(k)).sort()[0];
        duongVe = dau || null;
    }
    if (!duongVe || !cacFile.get(duongVe)) return { theoDong: new Map(), lenhLa: [] };

    const xml = cacFile.get(duongVe).toString('utf8');
    const anchors = [...catThe(xml, 'xdr:twoCellAnchor'), ...catThe(xml, 'xdr:oneCellAnchor')];
    const theoDong = new Map();
    const lenhLa = new Set();
    anchors.forEach(a => {
        if (a.indexOf('<xdr:sp') === -1) return;      // bỏ qua ảnh thật (<xdr:pic>) và biểu đồ
        const h = docMotHinh(a);
        if (!h) return;
        (h.lenhLa || []).forEach(l => lenhLa.add(l));
        if (!theoDong.has(h.dong)) theoDong.set(h.dong, []);
        theoDong.get(h.dong).push(h);
    });
    const ra = new Map();
    theoDong.forEach((ds, dong) => ra.set(dong, ghepSvg(ds)));
    return { theoDong: ra, lenhLa: [...lenhLa] };
}

module.exports = { docHinhVeTheoDong, catThe, docMotHinh, ghepSvg };
