/* ================================================================================================
   tao_file_cai_dat.js — GỘP CÁC MIGRATION MỚI VÀO `CAI_DAT_DAY_DU.sql`
   ------------------------------------------------------------------------------------------------
   Nguyen 24/11/2026: *"Viết file cài đặt đầy đủ các migration mới."*

   🔴 VÌ SAO LÀ SCRIPT CHỨ KHÔNG PHẢI CHÉP TAY:
   `CAI_DAT_DAY_DU.sql` là file DUY NHẤT dùng để dựng hệ thống trên máy mới. Nó đang dừng ở
   migration_v891 — thiếu 17 file (v892…v909). Chép tay ~2.500 dòng SQL vào một file 11.900 dòng mà
   KHÔNG có cách biên dịch lại để đối chiếu là cách chắc chắn nhất để gài một lỗi âm thầm vào đúng
   cái file cứu hộ. Script đọc THẲNG BYTE của từng file migration nên không có rủi ro sai chính tả,
   và lần sau thêm migration mới chỉ việc chạy lại.

   CÁCH LÀM — CỐ Ý "CHỈ NỐI THÊM", KHÔNG DỰNG LẠI TỪ ĐẦU:
     · Đọc danh sách file đang có trong CAI_DAT_DAY_DU.sql từ chính các dòng tiêu đề `[n/N] ten.sql`
       ⇒ giữ NGUYÊN thứ tự đã được duyệt, không phải đoán lại thứ tự chạy.
     · Nối phần còn thiếu vào CUỐI, theo đúng khuôn tiêu đề cũ.
     · Đánh số lại `[n/N]` trên toàn file (chỉ đổi con số, không đụng một dòng SQL nào khác).
     · Sao lưu bản cũ ra `CAI_DAT_DAY_DU.truoc_khi_gop.sql` trước khi ghi đè.
     · Tự kiểm sau khi ghi: đủ file, số thứ tự liền mạch 1..N, nội dung từng migration có mặt
       NGUYÊN VĂN. Sai một điều là báo đỏ và KHÔNG coi là xong.

   CHẠY:
     node database\tao_file_cai_dat.js --thu     ← xem trước, KHÔNG ghi gì
     node database\tao_file_cai_dat.js           ← ghi thật
   ================================================================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

const THU_MUC = __dirname;
const DICH = path.join(THU_MUC, 'CAI_DAT_DAY_DU.sql');
const SAO_LUU = path.join(THU_MUC, 'CAI_DAT_DAY_DU.truoc_khi_gop.sql');
const CHI_THU = process.argv.includes('--thu');

/* ------------------------------------------------------------------------------------------------
   DANH SÁCH BỔ SUNG — CÓ CHỦ Ý, KHÔNG QUÉT BỪA CẢ THƯ MỤC.
   Thư mục `database/` có 171 file .sql, phần lớn là SQL SỬA DỮ LIỆU một lần (sua_*, xoa_*, tinh_lai_*,
   chan_doan_*, import_*) — đưa vào file cài đặt là chạy nhầm lên máy mới.
   ⛔ migration_v906 CỐ Ý BỊ LOẠI: luật "số size của Ri" đã bỏ ngay trong ngày (v9.82→v9.88 chốt lại
      dùng `DonHangSanXuat.HeSoQuyDoi`), chạy nó trên máy mới là dựng lại cột đã chết.
   ------------------------------------------------------------------------------------------------ */
const BO_SUNG = [
  'migration_v892.sql', 'migration_v893.sql', 'migration_v894.sql', 'migration_v895.sql',
  'migration_v896.sql', 'migration_v897.sql', 'migration_v898.sql', 'migration_v899.sql',
  'migration_v900.sql', 'migration_v901.sql', 'migration_v902.sql', 'migration_v903.sql',
  'migration_v904.sql', 'migration_v905.sql',
  /* v906 — BỎ, xem ghi chú trên */
  'migration_v907.sql', 'migration_v908.sql', 'migration_v909.sql'
];
const LOAI_BO_CO_Y = { 'migration_v906.sql': 'luật số size của Ri đã bỏ trong ngày (v9.82→v9.88 chốt lại HeSoQuyDoi)' };

const RE_TIEU_DE = /^\/\* \[\s*(\d+)\/(\d+)\]\s+(\S+)\s+\*\/$/gm;
const RE_PRINT = /^PRINT '>>> \[(\d+)\/(\d+)\] (\S+)';$/gm;
/* Độ dài vạch ngang ĐỌC TỪ CHÍNH FILE (đừng đoán 98 rồi khối mới lệch dài ngắn so với 124 khối cũ). */
let VACH_FILE = '-'.repeat(98);

function docFile(p) { return fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n'); }

function danhSachDangCo(noiDung) {
  const ds = [];
  let m;
  RE_TIEU_DE.lastIndex = 0;
  while ((m = RE_TIEU_DE.exec(noiDung)) !== null) ds.push(m[3]);
  return ds;
}

function khoiNoiThem(tenFile, i, tong) {
  const than = docFile(path.join(THU_MUC, tenFile));
  const w = String(tong).length;
  return `\n\n${VACH_FILE}\n/* [${String(i).padStart(w, ' ')}/${tong}]  ${tenFile}  */\n${VACH_FILE}\n`
    + `PRINT '';\nPRINT '>>> [${i}/${tong}] ${tenFile}';\nGO\n\n${than.replace(/\s+$/, '')}\n`;
}

function danhSoLai(noiDung, tong) {
  const w = String(tong).length;
  let i = 0, j = 0;
  return noiDung
    .replace(RE_TIEU_DE, (_, __, ___, ten) => { i++; return `/* [${String(i).padStart(w, ' ')}/${tong}]  ${ten}  */`; })
    .replace(RE_PRINT, (_, __, ___, ten) => { j++; return `PRINT '>>> [${j}/${tong}] ${ten}';`; });
}

/* ---------------------------------------------------------------------------------------------- */
let sai = 0;
const bao = (ok, ten, td) => {
  console.log((ok ? '  ✓ ' : '  ❌ ') + ten + (!ok && td ? ' — ' + td : ''));
  if (!ok) sai++;
};

console.log('=== GỘP MIGRATION VÀO CAI_DAT_DAY_DU.sql' + (CHI_THU ? ' (CHẠY THỬ — không ghi gì)' : '') + ' ===\n');

if (!fs.existsSync(DICH)) { console.log('❌ Không thấy ' + DICH); process.exit(1); }
const goc = docFile(DICH);
const vachDo = (goc.match(/^-{20,}$/m) || [])[0];
if (vachDo) VACH_FILE = vachDo;
const dangCo = danhSachDangCo(goc);
console.log(`File hiện tại: ${dangCo.length} mục, mục cuối = ${dangCo[dangCo.length - 1]}\n`);

/* 1) File nào thật sự còn thiếu (chạy lại script nhiều lần phải vô hại). */
const conThieu = BO_SUNG.filter(t => dangCo.indexOf(t) === -1);
const daCo = BO_SUNG.filter(t => dangCo.indexOf(t) !== -1);
daCo.forEach(t => console.log('  = đã có sẵn, bỏ qua: ' + t));
Object.keys(LOAI_BO_CO_Y).forEach(t => console.log('  ⛔ CỐ Ý KHÔNG GỘP: ' + t + ' — ' + LOAI_BO_CO_Y[t]));
if (daCo.length || Object.keys(LOAI_BO_CO_Y).length) console.log('');

/* 2) Thiếu file nguồn thì DỪNG — thà không làm gì còn hơn sinh ra file cài đặt thiếu mảnh. */
const matFile = conThieu.filter(t => !fs.existsSync(path.join(THU_MUC, t)));
if (matFile.length) { console.log('❌ Không thấy file nguồn: ' + matFile.join(', ')); process.exit(1); }

if (!conThieu.length) { console.log('Không có gì để gộp — file cài đặt đã đầy đủ.'); process.exit(0); }
console.log('Sẽ nối thêm ' + conThieu.length + ' file:\n  ' + conThieu.join('\n  ') + '\n');

/* 3) Dựng nội dung mới.
   🔴 File KẾT THÚC bằng khối "=== CAI DAT XONG. Buoc tiep: ... ===" — phần nối thêm phải nằm TRƯỚC
   khối đó, không thì câu "cài đặt xong" in ra giữa chừng rồi còn 17 migration chạy phía sau. */
const MOC_CUOI = "PRINT '=== CAI DAT XONG.";
const iMoc = goc.lastIndexOf(MOC_CUOI);
if (iMoc === -1) { console.log('❌ Không tìm thấy khối kết thúc "=== CAI DAT XONG" — dừng để khỏi nối nhầm chỗ.'); process.exit(1); }
/* Lùi về đầu dòng gạch ngang đứng ngay trước khối đó (không giả định độ dài vạch). */
let iCuoi = goc.lastIndexOf('\n' + VACH_FILE + '\n', iMoc);
iCuoi = iCuoi === -1 ? goc.lastIndexOf('\n', goc.lastIndexOf('\n', iMoc - 1) - 1) + 1 : iCuoi + 1;
const phanDau = goc.slice(0, iCuoi).replace(/\s+$/, '');
const phanCuoi = goc.slice(iCuoi).replace(/\s+$/, '');

const tong = dangCo.length + conThieu.length;
let moi = danhSoLai(phanDau, tong);
conThieu.forEach((t, k) => { moi += khoiNoiThem(t, dangCo.length + k + 1, tong); });
moi += '\n\n' + phanCuoi + '\n';
/* Dòng "Gom: ..." ở đầu file phải nói đúng số lượng, không thì lần sau đọc lại là hiểu sai. */
moi = moi.replace(/^   Gom: schema\.sql \+ \d+ file migration, theo dung thu tu chay\.$/m,
  `   Gom: schema.sql + ${tong - 1} file migration, theo dung thu tu chay.`);
moi = moi.replace(/^   Sinh tu dong luc .*$/m,
  `   Sinh tu dong luc ${new Date().toISOString().slice(0, 19).replace('T', ' ')} boi: node database\\tao_file_cai_dat.js`);

if (CHI_THU) {
  console.log(`(chạy thử) Sẽ ghi ${moi.length.toLocaleString('vi-VN')} ký tự, ${tong} mục. Bỏ --thu để ghi thật.`);
  process.exit(0);
}

/* 4) Sao lưu rồi ghi. */
fs.writeFileSync(SAO_LUU, goc, 'utf8');
console.log('Đã sao lưu bản cũ: ' + path.basename(SAO_LUU));
fs.writeFileSync(DICH, moi, 'utf8');
console.log('Đã ghi: ' + path.basename(DICH) + '\n');

/* 5) TỰ KIỂM trên file VỪA GHI — đọc lại từ đĩa, không tin biến trong bộ nhớ. */
console.log('=== TỰ KIỂM ===');
const lai = docFile(DICH);
const dsLai = danhSachDangCo(lai);
bao(dsLai.length === tong, `đủ ${tong} mục`, 'đang có ' + dsLai.length);
bao(new Set(dsLai).size === dsLai.length, 'không mục nào bị lặp',
  dsLai.filter((t, i) => dsLai.indexOf(t) !== i).join(', '));
let lienMach = true;
RE_TIEU_DE.lastIndex = 0;
let m2, dem = 0;
while ((m2 = RE_TIEU_DE.exec(lai)) !== null) { dem++; if (Number(m2[1]) !== dem || Number(m2[2]) !== tong) lienMach = false; }
bao(lienMach, 'số thứ tự [n/N] liền mạch 1..' + tong);
const soPrint = (lai.match(/^PRINT '>>> \[\d+\/\d+\] \S+';$/gm) || []).length;
bao(soPrint === tong, 'đủ ' + tong + ' dòng PRINT mốc', 'đang có ' + soPrint);
/* Nội dung từng migration mới phải có mặt NGUYÊN VĂN — bắt lỗi cắt mất đoạn. */
conThieu.forEach(t => {
  const than = docFile(path.join(THU_MUC, t)).replace(/\s+$/, '');
  bao(lai.indexOf(than) !== -1, 'nội dung ' + t + ' có mặt nguyên văn');
});
/* Không được lọt SQL sửa dữ liệu vào file cài đặt. */
bao(!/sua_phieu_ton_dau_ky|sua_phu_cap_xang_xe|xoa_du_lieu_lenh_san_xuat/.test(dsLai.join(' ')),
  'không lẫn SQL sửa / xóa dữ liệu một lần');
bao(dsLai.indexOf('migration_v906.sql') === -1, 'migration_v906 KHÔNG bị gộp (cột đã chết)');

console.log(`\n=== ${sai ? '❌ CÓ ' + sai + ' LỖI — KHÔI PHỤC BẰNG: copy ' + path.basename(SAO_LUU) + ' đè lên ' + path.basename(DICH) : '✅ XONG, ' + tong + ' mục'} ===`);
process.exit(sai ? 1 : 0);
