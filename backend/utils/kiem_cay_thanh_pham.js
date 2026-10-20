/* ================================================================================================
   kiem_cay_thanh_pham.js — v8.93: luật "cây nào trong sổ cắt vào thành phẩm" (utils/cayThanhPham.js)
   ------------------------------------------------------------------------------------------------
   Chạy:  node backend\utils\kiem_cay_thanh_pham.js        (không cần CSDL)

   DH2608073 (2026-10-19): sổ cắt giấy ĐEN02 150, QC 250 — cây 2DA-DEN02190926002 xuất hai lần
   (Chính + Phối), bản ghi Cắt 14580 là lần cắt bo nhưng bị cộng. Bộ kiểm này:
     1. Hàm thật sinh SQL đúng cấu trúc cho từng tổ hợp (coKhaiKieu × coKieuSoDo), cả bản một lệnh
        lẫn bản mọi lệnh.
     2. MÔ PHỎNG luật trên dữ liệu thật của DH2608073 (chép từ SSMS) bằng JS cùng thứ tự ưu tiên
        → Đen 02 phải ra 150, Tàn 43 ra 30. Nếu ai sửa thứ tự luật mà quên, test này đỏ.
     3. Mọi nơi gọi (qlsx / khohang / bangke) đều đi qua util, không còn bản chép tay.
     4. Form sơ đồ gửi `kieu`; backend chỉ ghi khi body có khóa; migration có guard + CHECK.
   ================================================================================================ */
const fs = require('fs');
const path = require('path');
const doc = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const boComment = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
let dat = 0, truot = 0;
const kiem = (ok, ten, them) => { if (ok) { dat++; console.log('   ✓ ' + ten); } else { truot++; console.log('   ✗ ' + ten + (them ? '  → ' + them : '')); } };

const ctp = require('./cayThanhPham');

console.log('=== 1. SQL sinh ra đúng cấu trúc ===');
const a = ctp.dieuKienCayThanhPham('cc', 123, true, true);
kiem(/^AND \(/.test(a.trim()), 'bản một lệnh: bắt đầu bằng AND (');
kiem(/sd\.Kieu[\s\S]*= N'Chính'/.test(a) && /IS NULL AND/.test(a), 'S2 sơ đồ Chính → tính; NULL → lùi về phiếu xuất');
kiem(/NOT \(\s*\/\* mọi cây/.test(a) || /NOT \(\s*NOT EXISTS/.test(boComment(a)), 'luật B đứng trước L1/L2 (NOT (bản ghi phối) AND ...)');
kiem(/pxb\.KieuVai = N'Phối'/.test(a) && /pxc\.KieuVai = N'Chính'/.test(a), 'luật B có đủ hai vế: mọi cây ∈ Phối, có cây ∉ Chính');
kiem(/p\.DonHangID = 123/.test(a) && /pb\.DonHangID = 123/.test(a) && /pc\.DonHangID = 123/.test(a), 'DonHangID nối đúng vào CẢ luật B lẫn L1/L2');
kiem((a.match(/\(SELECT sd\.Kieu/g) || []).length === 2, 'subquery sơ đồ xuất hiện đúng 2 lần (so Chính, so NULL)');
const b = ctp.dieuKienCayThanhPham('cc', '@id', true, false);
kiem(!/sd\.Kieu/.test(b) && /p\.DonHangID = @id/.test(b), 'chưa có cột Kieu: không đụng DonHangChiTietSoDo, dùng @id');
const c = ctp.dieuKienCayThanhPham('cc', 5, false, true);
kiem(/<> N'Phối'/.test(c) && !/px\.KieuVai/.test(c), 'L3 + có cột: chỉ gạt sơ đồ Phối, không lọc theo cây');
kiem(ctp.dieuKienCayThanhPham('cc', 5, false, false) === '', 'L3 + chưa có cột: không lọc gì (chuỗi rỗng)');
let nem = false; try { ctp.dieuKienCayThanhPham('cc', "1 OR 1=1", true, true); } catch (e) { nem = true; }
kiem(nem, 'bieuThucDon lạ → ném lỗi (không nối chuỗi người dùng vào SQL)');
const m = ctp.dieuKienCayThanhPhamMoiLenh('cc', 't', true);
kiem(/px3\.KieuVai IS NOT NULL/.test(m) && /pxb\.KieuVai = N'Phối'/.test(m) && /sd\.ID = t\.SoDoID/.test(m), 'bản mọi lệnh: L3 tương quan + luật B + sơ đồ');
kiem(/p\.DonHangID = t\.DonHangID/.test(m) && /pb\.DonHangID = t\.DonHangID/.test(m), 'bản mọi lệnh: DonHangID tương quan theo t');
/* Msg 130: biểu thức không được nằm trong SUM/COUNT — kiểm là các nơi gọi đặt nó ở WHERE. */
const sQ = doc('routes/qlsx.js');
[['slCatTheoMauTuCay', /WHERE cc\.TienDoID IN \(\$\{ids\.join\(','\)\}\)\s*\n\s*\$\{dkCay\}/],
 ['getCatMauList (TongSoLop/HeSo)', /WHERE cc\.TienDoID IN \(\$\{ids\.join\(','\)\}\)\s*\n\s*\$\{dkCayLop\}/],
 ['slKhoNhapTheoDon (heCat)', /ISNULL\(cc\.HeSoQuyDoi, 0\) > 0\s*\n\s*\$\{dkHeCat\}/]
].forEach(([ten, re]) => kiem(re.test(sQ), `${ten}: mảnh luật nằm trong WHERE, sau điều kiện TienDoID`));

console.log('\n=== 2. Mô phỏng luật trên dữ liệu thật DH2608073 ===');
/* Chép từ SSMS 2026-10-19 (cột HieuLuc đều = 1). Kiểu trên phiếu xuất: C = Chính, P = Phối. */
const dong = [
  { td: 14019, cay: 13195, mau: 'Đen',    lop: 15, he: 10, kieu: ['P'] },
  { td: 14018, cay: 14550, mau: 'Đen 02', lop: 30, he: 5,  kieu: ['P'] },
  { td: 14579, cay: 14551, mau: 'Đen 02', lop: 2,  he: 5,  kieu: ['C'] },
  { td: 14579, cay: 14556, mau: 'Đen 02', lop: 17, he: 5,  kieu: ['C'] },
  { td: 14579, cay: 14565, mau: 'Đen 02', lop: 11, he: 5,  kieu: ['C', 'P'] },
  { td: 14580, cay: 13645, mau: 'Đen 02', lop: 10, he: 5,  kieu: ['P'] },
  { td: 14580, cay: 14565, mau: 'Đen 02', lop: 20, he: 5,  kieu: ['C', 'P'] },
  { td: 14579, cay: 13565, mau: 'Đô 50',  lop: 11, he: 5,  kieu: ['C'] },
  { td: 14579, cay: 13566, mau: 'Đô 50',  lop: 19, he: 5,  kieu: ['C'] },
  { td: 14018, cay: 13557, mau: 'Ghi 43', lop: 30, he: 5,  kieu: ['P'] },
  { td: 14579, cay: 13562, mau: 'Ghi 43', lop: 18, he: 5,  kieu: ['C'] },
  { td: 14579, cay: 13569, mau: 'Ghi 43', lop: 4,  he: 5,  kieu: ['C'] },
  { td: 14579, cay: 13570, mau: 'Ghi 43', lop: 2,  he: 5,  kieu: ['C'] },
  { td: 14018, cay: 13641, mau: 'Kem 11', lop: 30, he: 5,  kieu: ['P'] },
  { td: 14580, cay: 13652, mau: 'Kem 11', lop: 30, he: 5,  kieu: ['P'] },
  { td: 14579, cay: 13463, mau: 'Tàn 43', lop: 6,  he: 5,  kieu: ['C', 'P'] },
  { td: 14580, cay: 13463, mau: 'Tàn 43', lop: 30, he: 5,  kieu: ['C', 'P'] },
  { td: 14019, cay: 13189, mau: 'Trắng',  lop: 30, he: 10, kieu: ['P'] }
];
/* Cùng thứ tự ưu tiên với SQL: S1/S2 (sơ đồ) → L3 → B → L1/L2. Ở đây không sơ đồ nào khai, lệnh đã khai Kiểu. */
function tinh(ds, kieuSoDoCua) {
  const coC = (d) => d.kieu.includes('C'), coP = (d) => d.kieu.includes('P');
  const banGhiLaPhoi = (td) => { const cs = ds.filter(x => x.td === td); return cs.every(coP) && cs.some(x => !coC(x)); };
  const tong = {};
  ds.forEach(d => {
    const sd = kieuSoDoCua ? kieuSoDoCua(d.td) : null;
    let tinhVao;
    if (sd === 'Phối') tinhVao = false;
    else if (sd === 'Chính') tinhVao = true;
    else if (banGhiLaPhoi(d.td)) tinhVao = false;
    else tinhVao = coC(d) || d.kieu.length === 0;   // L1 hoặc L2
    if (tinhVao) tong[d.mau] = (tong[d.mau] || 0) + d.lop * d.he;
  });
  return tong;
}
const kq = tinh(dong, null);
kiem(kq['Đen 02'] === 150, 'Đen 02 = 150 (sổ cắt giấy 30 lớp × 5)', 'ra ' + kq['Đen 02']);
kiem(kq['Tàn 43'] === 30, 'Tàn 43 = 30 (chỉ 6 lớp ở bản thân; 30 lớp ở bản bo bị loại)', 'ra ' + kq['Tàn 43']);
kiem(kq['Ghi 43'] === 120, 'Ghi 43 = 120 (18+4+2 lớp)', 'ra ' + kq['Ghi 43']);
kiem(kq['Đô 50'] === 150, 'Đô 50 = 150', 'ra ' + kq['Đô 50']);
kiem(kq['Kem 11'] == null && kq['Trắng'] == null && kq['Đen'] == null, 'Kem 11 / Trắng / Đen (toàn phối) không có dòng thành phẩm');
/* Luật CŨ (chỉ L1) ra 250 — chứng minh test này bắt đúng bug chứ không phải trùng hợp. */
const cu = {}; dong.forEach(d => { if (d.kieu.includes('C')) cu[d.mau] = (cu[d.mau] || 0) + d.lop * d.he; });
kiem(cu['Đen 02'] === 250, 'đối chứng: luật cũ theo cây ra đúng con số sai 250', 'ra ' + cu['Đen 02']);
/* Sơ đồ ghi đè: khai 14580 là Chính thì MỌI dòng của nó vào thành phẩm — kể cả cây …003 chỉ có dòng
   Phối (50 cái) — đúng định nghĩa S2 "tính hết, bất kể phiếu xuất": 150 + 100 + 50 = 300.
   (Bản đầu tôi ghi kỳ vọng 250 — đó là số của luật CŨ theo cây, vốn loại …003. Sai ở test, không ở luật.) */
kiem(tinh(dong, td => td === 14580 ? 'Chính' : null)['Đen 02'] === 300, 'sơ đồ khai Chính ghi đè luật B (tính hết cả bản ghi)',
  'ra ' + tinh(dong, td => td === 14580 ? 'Chính' : null)['Đen 02']);
kiem(tinh(dong, td => td === 14579 ? 'Phối' : null)['Đen 02'] === undefined, 'sơ đồ khai Phối loại cả bản ghi');

console.log('\n=== 3. Không còn bản chép tay ===');
const sK = doc('routes/khohang.js'), sB = doc('routes/bangke.js');
kiem((boComment(sQ).match(/KieuVai = N'Chính'/g) || []).length === 0, 'qlsx.js: không còn EXISTS KieuVai=Chính viết tay');
kiem(/cayThanhPham\.dieuKienCayThanhPham\('cc', '@id'/.test(sK), 'khohang.js: dùng util với @id');
kiem((boComment(sK).match(/KieuVai = N'Chính'/g) || []).length === 0, 'khohang.js: không còn bản chép tay');
kiem(/bieuThucBanGhiLaPhoi\('cc', '@donId'\)/.test(sB), 'bangke.js: có luật B');
kiem(/bieuThucKieuSoDo\('cc'\)/.test(sB), 'bangke.js: có luật sơ đồ');
kiem(!/__coKieuSoDo|let __co/.test(doc('utils/cayThanhPham.js')), 'util không cache kết quả dò cột');

console.log('\n=== 4. Sơ đồ: form + route + migration ===');
const sFe = doc('../frontend/js/module.qlsx.js');
kiem(/kieu: r\.querySelector\('\.sd-kieu'\)\.value \|\| null/.test(sFe), 'form THÊM sơ đồ gửi kieu');
kiem(/kieu: tr\.querySelector\('\.sd-e-kieu'\)\.value \|\| null/.test(sFe), 'form SỬA sơ đồ gửi kieu');
kiem(/colspan="6" class="empty-hint">Chưa khai báo sơ đồ nào/.test(sFe), 'bảng sơ đồ 6 cột (thêm Kiểu) — dòng trống colspan khớp');
kiem(/Object\.prototype\.hasOwnProperty\.call\(b, 'kieu'\)/.test(sQ), 'PUT sodo: chỉ ghi Kieu khi body có khóa');
kiem(/function chuanKieuSoDo\(v\)/.test(sQ) && /if \(s === 'Chính' \|\| s === 'Phối'\) return s;/.test(sQ), 'chuanKieuSoDo chỉ nhận 2 giá trị');
kiem(/Chưa chạy migration_v880/.test(sQ), 'chưa migration mà gửi Kiểu → báo lỗi, không nuốt');
const sMig = doc('../database/migration_v880.sql');
kiem(/IF COL_LENGTH\('DonHangChiTietSoDo', 'Kieu'\) IS NULL/.test(sMig), 'migration có guard');
kiem(/CHECK \(Kieu IS NULL OR Kieu IN \(N'Chính', N'Phối'\)\)/.test(sMig), 'migration có CHECK 2 giá trị');
kiem(!/UPDATE DonHangChiTietSoDo|UPDATE TienDo/.test(boComment(sMig).replace(/--.*$/gm, '')), 'migration KHÔNG backfill');
const v = (doc('../frontend/index.html').match(/module\.qlsx\.js\?v=([\d.]+)/) || [])[1] || '';
kiem(parseFloat(v) >= 8.93, 'index.html bump ≥ 8.93', 'đang ' + v);

console.log(`\n================ KẾT QUẢ: ${dat} đạt / ${truot} sai ================`);
process.exit(truot ? 1 : 0);
