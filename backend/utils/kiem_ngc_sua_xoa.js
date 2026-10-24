/* ================================================================================================
   KIEM CHUNG v9.00 — NHAN GIA CONG: SUA / XOA TUNG DONG GIAO NGAY TAI CONG DOAN NGC
   ------------------------------------------------------------------------------------------------
   Nguyen 2026-10-24: "ghi tiến độ: ở user admin có thể sửa, xóa ở các công đoạn" -> hoi lai: thieu o
   NHAN GIA CONG; ap theo quyen Sua/Xoa chuc nang Ghi tien do (khong khoa cung isAdmin).

   BA CHO DE SAI:
     1. Gate giao dien bang coQuyenSuaTienDo()/coQuyenXoaTienDo() (v6.18), KHONG phai isAdmin.
     2. Goi DUNG hai route da co cua GC: PUT/DELETE /orders/:maDH/nhagiacongchitiet/:id — khong tu che
        route moi, khong goi /nhan cho viec sua nha/SL giao.
     3. Xoa phai co confirm noi ro mat SL nhan (cong no nha gia cong doc SL nhan x don gia).

   Chay:  node backend\utils\kiem_ngc_sua_xoa.js   (tu thu muc goc QLNoiBo)
   ================================================================================================ */
const fs = require('fs');
const path = require('path');
const G = path.join(__dirname, '..');
const doc = (p) => fs.readFileSync(path.join(G, p), 'utf8');

let dat = 0, truot = 0;
const OK = (m) => { dat++; console.log('  OK   ' + m); };
const NO = (m) => { truot++; console.log('  SAI  ' + m); };
const kiem = (dk, m) => (dk ? OK(m) : NO(m));

const sFe = doc('../frontend/js/module.qlsx.js');
const sBE = doc('routes/qlsx.js');
const sIndex = doc('../frontend/index.html');

/* Khoi NGC = tu "stageCode === 'NGC')" (nhanh render) toi "stageCode === 'DG')" ke tiep. */
const iNgc = sFe.indexOf("} else if (stageCode === 'NGC') {");
const iDg = sFe.indexOf("} else if (stageCode === 'DG') {", iNgc);
const khoi = iNgc >= 0 && iDg > iNgc ? sFe.slice(iNgc, iDg) : '';

console.log('\n=== 1. FRONTEND — nhanh NGC ===');
kiem(khoi.length > 0, 'trich duoc nhanh NGC');
kiem(/function renderNgcNhanBox\(\)/.test(khoi) && /renderNgcNhanBox\(\);\s*$/.test(khoi.trim()), 'bang NGC ve bang ham renderNgcNhanBox() va duoc goi ngay');
kiem(/const coSua = coQuyenSuaTienDo\(\), coXoa = coQuyenXoaTienDo\(\);/.test(khoi), 'gate theo quyen chuc nang Ghi tien do (coQuyenSuaTienDo/coQuyenXoaTienDo)');
kiem(!/isAdmin/.test(khoi), 'KHONG khoa cung isAdmin trong nhanh NGC');
kiem(/\$\{coSua \? `<button type="button" class="btn small secondary ngcn-edit"/.test(khoi), 'nut Sua chi ve khi coSua');
kiem(/\$\{coXoa \? `<button type="button" class="btn small danger ngcn-del"/.test(khoi), 'nut Xoa chi ve khi coXoa');
kiem(/const soCot = 5 \+ \(ngcNhanCoDai \? 1 : 0\) \+ \(\(coSua \|\| coXoa\) \? 1 : 0\);/.test(khoi) && /colspan="\$\{soCot\}"/.test(khoi),
  'colspan dong rong tinh theo so cot thuc (co/khong dai, co/khong cot thao tac)');
kiem(/apiDelete\(`\/api\/qlsx\/orders\/\$\{maDH\}\/nhagiacongchitiet\/\$\{row\.ID\}`\)/.test(khoi), 'Xoa goi DELETE /nhagiacongchitiet/:id (route co san cua GC)');
kiem(/if \(!confirm\(/.test(khoi) && /Mất cả số lượng nhận đã ghi của dòng này/.test(khoi), 'Xoa co confirm, noi ro mat SL nhan');
kiem(/apiPut\(`\/api\/qlsx\/orders\/\$\{maDH\}\/nhagiacongchitiet\/\$\{row\.ID\}`, \{ nhaGiaCongId, hangMucGiaCongId: row\.HangMucGiaCongID, soLuong, ghiChu \}\)/.test(khoi),
  'Sua goi PUT /nhagiacongchitiet/:id voi dung body cua GC (giu hang muc, KHONG dung SL nhan)');
kiem(/\/nhagiacongchitiet\/\$\{i\.dataset\.id\}\/nhan`, \{ soLuongNhan: i\.value \|\| null \}/.test(khoi), 'nut "Luu so luong nhan" van goi PUT /nhan nhu v5.30');
kiem(/wireSearchableSelect\('ngcnEdit_' \+ row\.ID/.test(khoi) && /getSearchableValue\('ngcnEdit_' \+ row\.ID\)/.test(khoi), 'o chon nha gia cong khi sua dung searchable select nhu GC');
kiem(!/\.ngc-edit\b|\.ngc-del\b/.test(khoi), 'class nut rieng (ngcn-*) — khong trung .ngc-edit/.ngc-del cua cong doan GC');

console.log('\n=== 2. BACKEND — hai route dung lai phai con ===');
kiem(/router\.put\('\/orders\/:maDH\/nhagiacongchitiet\/:id', requireAuth, requirePermission\('QLSX', 'edit'\)/.test(sBE), 'PUT /nhagiacongchitiet/:id con, gate QLSX edit');
kiem(/router\.delete\('\/orders\/:maDH\/nhagiacongchitiet\/:id', requireAuth, requirePermission\('QLSX', 'edit'\)/.test(sBE), 'DELETE /nhagiacongchitiet/:id con, gate QLSX edit');
kiem(/UPDATE DonHangChiTietNhaGiaCong SET NhaGiaCongID=@NhaGiaCongID, HangMucGiaCongID=@HangMucGiaCongID, GhiChu=@GhiChu, DonGia=@DonGia, SoLuong=@SoLuong WHERE ID=@id AND DonHangID=@donHangId/.test(sBE),
  'PUT khong dong toi SoLuongNhan (sua nha/SL giao thi SL nhan da ghi giu nguyen)');

console.log('\n=== 3. index.html ===');
const vQlsx = Number(((sIndex.match(/module\.qlsx\.js\?v=([\d.]+)/) || [])[1]) || 0);
kiem(vQlsx >= 9, `module.qlsx.js?v= >= 9.00  [duoc: ${vQlsx}]`);

console.log('\n=== 4. Rao chan template literal trong nhanh NGC ===');
// Cac comment khoi trong nhanh nay nam NGOAI template literal (comment JS that) — nhung van kiem khong
// co backtick trong comment de khong ai sau nay "doi cho" ma thanh bay v7.98/v8.73.
const cmts = khoi.match(/\/\*[\s\S]*?\*\//g) || [];
kiem(cmts.every(c => c.indexOf('`') === -1), `khong co backtick trong ${cmts.length} comment khoi cua nhanh NGC`);

console.log(`\n=== KET QUA: ${dat} dat, ${truot} sai ===`);
process.exit(truot ? 1 : 0);
