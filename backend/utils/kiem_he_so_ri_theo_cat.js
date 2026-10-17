/* ================================================================================================
   kiem_he_so_ri_theo_cat.js — v8.92: hệ số Ri → cái ở Đóng gói / Kho nhập lấy theo SỔ CẮT
   ------------------------------------------------------------------------------------------------
   Chạy:  node backend\utils\kiem_he_so_ri_theo_cat.js        (không cần CSDL)

   Nguyen 2026-10-17: lệnh DH2609111 Cắt hệ số 11, Đóng gói / Kho nhập lại quy 1 ri = 1 cái.
   Kiểm: (1) hàm heSoCuaDong THẬT (cắt từ module.qlsx.js) ưu tiên đúng thứ tự dải → Cắt → lệnh;
         (2) mọi chỗ gọi đều truyền `ct`; (3) backend trả HeSoCat và danh sách lệnh SX dùng cùng luật.
   Hàm THẬT, không viết lại: viết lại là tự tay bỏ đi đúng cái mình định kiểm.
   ================================================================================================ */
const fs = require('fs');
const path = require('path');
const doc = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
let dat = 0, truot = 0;
const kiem = (ok, ten, them) => { if (ok) { dat++; console.log('   ✓ ' + ten); } else { truot++; console.log('   ✗ ' + ten + (them ? '  → ' + them : '')); } };

const sFe = doc('../frontend/js/module.qlsx.js');
const sBe = doc('routes/qlsx.js');
const sIndex = doc('../frontend/index.html');
const boComment = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

console.log('=== 1. heSoCuaDong THẬT: dải → Cắt → lệnh ===');
const mHe = sFe.match(/function heSoCuaDong\(dai, ct\) \{[\s\S]*?\n    \}/);
kiem(!!mHe, 'cắt được heSoCuaDong(dai, ct) từ module.qlsx.js');
if (mHe) {
  const lam = (heSoLenh) => new Function('heSoQuyDoiDonHang', 'return (' + mHe[0] + ')')(heSoLenh);
  const f = lam(1);   // lệnh khai 1 — đúng tình huống DH2609111
  kiem(f(null, { HeSoCat: 11 }) === 11, 'lệnh 1, Cắt 11, không dải → 11 (theo Cắt)', String(f(null, { HeSoCat: 11 })));
  kiem(f({ HeSo: 6 }, { HeSoCat: 11 }) === 6, 'có dải hệ số 6 → 6 (dải thắng Cắt)', String(f({ HeSo: 6 }, { HeSoCat: 11 })));
  kiem(f(null, { HeSoCat: null, HeSoCatLech: 1 }) === 1, 'Cắt nhiều hệ số (HeSoCat null) → lùi về lệnh', String(f(null, { HeSoCat: null, HeSoCatLech: 1 })));
  kiem(f(null, {}) === 1, 'Cắt chưa ghi → lệnh');
  kiem(f(null, null) === 1, 'không có ct → lệnh, không ném lỗi');
  kiem(lam(5)(null, { HeSoCat: 5 }) === 5, 'Cắt = lệnh = 5 → 5');
  kiem(lam(0)(null, {}) === 0, 'lệnh 0, Cắt chưa ghi → 0 (form chuyển sang nhập thẳng cái)');
}

console.log('\n=== 2. Mọi chỗ gọi truyền ct ===');
const goi = boComment(sFe).match(/heSoCuaDong\([^)]*\)/g) || [];
const goiThieu = goi.filter(x => x !== 'heSoCuaDong(dai, ct)');
kiem(goi.length >= 5, `có ≥ 5 chỗ gọi heSoCuaDong (đang ${goi.length}: khai báo + 4 nơi dùng)`);
kiem(goiThieu.length === 0, 'KHÔNG còn chỗ nào gọi heSoCuaDong(dai) thiếu ct', goiThieu.join(' | '));
kiem(/function nhanHeSo\(dai, ct\)/.test(sFe), 'có nhanHeSo() — ghi chú nói rõ hệ số lấy từ đâu');
kiem((sFe.match(/nhanHeSo\(dai, ct\)/g) || []).length >= 2, 'ghi chú dưới dòng Đóng gói VÀ Kho nhập đều dùng nhanHeSo');
// Phép "KHÔNG được chứa" chạy trên bản ĐÃ LỌC COMMENT — bài học vấp 3 lần ở kiem_ho_so_nhan_su.js.
kiem(!/\(hệ số \$\{dai \? 'của dải '/.test(boComment(sFe)), 'không còn chuỗi ghi chú cũ "hệ số quy đổi của lệnh" viết cứng');
kiem(/tổng hệ số các dải = \$\{fmtNumber\(tongDai\)\} nhưng sổ cắt dùng/.test(sFe),
  'lệnh tách dải mà tổng hệ số dải ≠ Cắt thì cảnh báo đỏ (lỗ có sẵn từ v8.59, nay ít nhất phải nói ra)');
kiem(/lệnh khai \$\{fmtNumber\(lenh\)\}, Cắt dùng \$\{fmtNumber\(cat\)\}; lấy theo Cắt/.test(sFe),
  'lệnh ≠ Cắt thì nói thẳng trên form');

console.log('\n=== 3. Backend ===');
kiem(/HeSoCat: \(!lech && hMax > 0\) \? hMax : null/.test(sBe), 'getCatMauList trả HeSoCat (null khi các cây lệch nhau)');
kiem(/HeSoCatLech: lech \? 1 : 0/.test(sBe), 'getCatMauList trả cờ HeSoCatLech');
kiem(/MIN\(CASE WHEN ISNULL\(cc\.HeSoQuyDoi, 0\) > 0 THEN cc\.HeSoQuyDoi END\) AS HeSoMin/.test(sBe),
  'bỏ qua cây có hệ số NULL/0 khi tính MIN/MAX');
kiem(/TongSoLop: Number\(r\.TongSoLop\) \|\| 0/.test(sBe), 'TongSoLop vẫn trả như cũ (số ri cắt được)');
/* Danh sách lệnh SX ("Đã nhập 43 Ri") phải cùng luật với form — khác luật là hai màn ra hai số. */
kiem(/CASE WHEN hc\.HMin IS NOT NULL AND hc\.HMin = hc\.HMax THEN hc\.HMax/.test(sBe),
  'slKhoNhapTheoDon: ưu tiên hệ số Cắt khi duy nhất');
kiem(/WHEN ISNULL\(d\.HeSoQuyDoi, 0\) > 0 THEN d\.HeSoQuyDoi/.test(sBe), 'slKhoNhapTheoDon: lùi về lệnh');
kiem(/FLOOR\(SLCai \/ HeSo\)\s+AS SoRi/.test(sBe), 'SoRi dùng FLOOR (HeSo là DECIMAL, không có chia nguyên ngầm)');
kiem(/\.input\('cat', sql\.Int, catStage \|\| 0\)/.test(sBe), 'tham số @cat được khai (không thì câu SQL lỗi "Must declare")');
kiem(/\$\{cteHeCat\}\s*\n\s*tongCai AS/.test(sBe), 'CTE heCat chèn ngay trước tongCai');
/* Danh sách phải LỌC CÂY CHÍNH như form, không thì cây phối (hệ số mặc định 1) làm HMin ≠ HMax
   → lùi về lệnh → danh sách "55 Ri", form "5 Ri". Ba luật L1/L2/L3 phải có đủ. */
const heCatSql = (sBe.match(/heCat AS \(\s*SELECT t\.DonHangID,[\s\S]*?GROUP BY t\.DonHangID/) || [''])[0];
kiem(/px\.KieuVai = N'Chính'/.test(heCatSql), 'heCat L1: cây có dòng xuất khai Chính');
kiem(/NOT EXISTS \(SELECT 1 FROM PhieuXuatVaiChiTiet px2[\s\S]*?p2\.DonHangID = t\.DonHangID\)/.test(heCatSql), 'heCat L2: cây không có dòng xuất nào của lệnh');
kiem(/px3\.KieuVai IS NOT NULL/.test(heCatSql), 'heCat L3: lệnh chưa khai Kiểu thì không lọc');
kiem(/heCat AS \([\s\S]*?\),`\s*\n\s*: `heCat AS \(SELECT CAST\(NULL AS INT\)/.test(sBe),
  'cả hai nhánh cteHeCat đều kết thúc bằng dấu phẩy');

console.log('\n=== 4. File chẩn đoán + bump ===');
const sKt = doc('../database/kiem_tra_v892_he_so_ri_lech_cat.sql');
kiem(!/\b(UPDATE|DELETE|INSERT|ALTER|DROP)\b/i.test(boComment(sKt).replace(/--.*$/gm, '')), 'kiem_tra_v892: CHỈ ĐỌC, không có lệnh sửa');
kiem(/DH2609111/.test(sKt), 'kiem_tra_v892: có truy vấn riêng cho DH2609111');
const v = (sIndex.match(/module\.qlsx\.js\?v=([\d.]+)/) || [])[1] || '';
kiem(parseFloat(v) >= 8.92, 'index.html: module.qlsx.js bump ≥ 8.92', 'đang ' + v);

console.log('\n=== 5. Cú pháp: backtick trong comment nằm trong template literal ===');
/* Khối ghi chú v8.92 của tôi có backtick (`.cat-heso`, `heSoCuaDong`) — PHẢI là comment JS trần ở
   cấp code, không được nằm trong template literal (bài học v7.98 / v8.73 sập máy thật). */
const viTri = sFe.indexOf('v8.92 — HỆ SỐ RI → CÁI LẤY THEO SỔ CẮT');
const truoc = sFe.slice(0, viTri);
const soBacktickTruoc = (truoc.match(/`/g) || []).length;
kiem(viTri > 0 && soBacktickTruoc % 2 === 0, 'khối ghi chú v8.92 nằm NGOÀI template literal (số backtick trước nó chẵn)', 'backtick trước: ' + soBacktickTruoc);

console.log(`\n================ KẾT QUẢ: ${dat} đạt / ${truot} sai ================`);
process.exit(truot ? 1 : 0);
