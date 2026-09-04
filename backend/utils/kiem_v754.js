/* ================================================================================================
   KIEM CHUNG v7.54/v7.55 — bon viec
     1. Xuat Excel cho tab Cong no NHA GIA CONG / IN THEU (?loai=gc)
     2. SUA LOI RO DU LIEU: tat cong khai DANH MUC the kho ma catalogue van hien ma hang cua no
     3. Bao gia Aloha: chi ma CON TON, hien so ton canh ma, ten lay theo TEN VIET HOA DON
   Chay:  node utils/kiem_v754.js
   ================================================================================================ */
const fs = require('fs');
const path = require('path');
const G = path.join(__dirname, '..');
const doc = (p) => fs.readFileSync(path.join(G, p), 'utf8');

let dat = 0, truot = 0;
const OK = (m) => { dat++; console.log('  OK   ' + m); };
const NO = (m) => { truot++; console.log('  SAI  ' + m); };
const kiem = (dk, m, them) => (dk ? OK(m) : NO(m + (them ? '  -> ' + them : '')));
const bo = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const sCongNo = doc('routes/congno.js');
const sPublic = doc('routes/public.js');
const sKhoHang = doc('routes/khohang.js');
const sFeCongNo = doc('../frontend/js/module.congno.js');
const sFeKhoHang = doc('../frontend/js/module.khohang.js');
const sMigV682 = doc('../database/migration_v682.sql');

/* ================================ 1. EXCEL CONG NO GIA CONG ================================ */
console.log('\n=== 1. Xuat Excel cong no gia cong / in theu ===');
kiem(/\['ncc', 'gc', 'phieuthu', 'phieuchi'\]\.indexOf\(req\.query\.loai\)/.test(sCongNo),
  "'gc' nam trong danh sach nhan dien loai (khong bi coi la 'kh')");
const routeExp = sCongNo.slice(sCongNo.indexOf("router.get('/export'"));
kiem(/if \(loai === 'gc' && nhaMot\)/.test(routeExp), 'co nhanh xuat so chi tiet 1 nha');
kiem(/if \(loai === 'gc'\) \{/.test(routeExp), 'co nhanh xuat bang tong hop');
kiem(/await soChiTietNhaGiaCong\(pool, nhaMot\)/.test(routeExp),
  'so chi tiet dung CHUNG ham voi man hinh xem (so lieu khong the lech)');
kiem(/await congNoNhaGiaCong\(pool\)/.test(routeExp), 'bang tong hop dung CHUNG ham voi man hinh');
/* Moc dong tieu de PHAI la bien cua CHINH nhanh nay — dung bay v7.34 (dongTD chi ton tai trong nhanh
   'kh' -> nhanh ncc ReferenceError, moi lan bam Xuat Excel deu loi ma node --check khong bat duoc). */
kiem(/const dongTDgc = dongTieuDeCot\(ws, cot\)\.number/.test(routeExp)
  && /ketBang\(ws, cot\.length, dongTDgc\)/.test(routeExp),
  'nhanh gc co MOC dong tieu de RIENG (dongTDgc) — khong dung bien cua nhanh khac');
kiem(/const dongTD2gc = dongTieuDeCot\(ws2gc, cot2gc\)\.number/.test(routeExp),
  'sheet so chi tiet tat ca cung co moc rieng');
const soReturnGc = (routeExp.match(/return await guiFile\(res, wb, `?'?cong_no_gia_cong/g) || []).length;
kiem(soReturnGc === 2, 'ca hai nhanh gc deu RETURN (khong roi xuong nhanh kh/ncc)', String(soReturnGc));

console.log('\n=== 1b. sheetPhieuChi loc duoc theo nha gia cong (mot ham, hai loai doi tuong) ===');
kiem(/async function sheetPhieuChi\(pool, wb, tienIch, nccId, nhaGiaCongId\)/.test(sCongNo),
  'sheetPhieuChi nhan them nhaGiaCongId');
kiem(/const locNGC = nhaGiaCongId && cC\.has\('NhaGiaCongID'\)/.test(sCongNo), 'do cot truoc khi loc');
kiem(/WHERE c\.NhaGiaCongID = @ngc/.test(sCongNo), 'loc dung cot NhaGiaCongID');
kiem(/r\.TenNCC \|\| r\.TenNhaGiaCong/.test(sCongNo), 'cot Doi tuong gom ca NCC va nha gia cong');
kiem((sCongNo.match(/wb\.addWorksheet\('Phiếu chi'\)/g) || []).length === 1,
  'CHI MOT ham dung sheet Phieu chi (khong viet ban thu hai)');

console.log('\n=== 1c. Frontend: 2 nut xuat ===');
kiem(/id="btnXuatGC"/.test(sFeCongNo) && /loai=gc'/.test(sFeCongNo), 'nut Xuat tong hop o tab moi');
kiem(/id="btnXuatCTGC"/.test(sFeCongNo) && /loai=gc&nhaGiaCongId=/.test(sFeCongNo),
  'nut Xuat Excel so nay trong popup so chi tiet');

/* ================================ 2. CATALOGUE RO DU LIEU ================================ */
console.log('\n=== 2. Tat cong khai DANH MUC -> catalogue KHONG con hien ma hang cua danh muc do ===');
kiem(/function dieuKienCongKhaiDM\(biDanh\)/.test(sPublic), 'co ham dung dieu kien cong khai DANH MUC');
const routeCat = sPublic.slice(sPublic.indexOf("router.get('/catalogue'"),
  sPublic.indexOf("router.get('/danhmuc'"));
kiem(/LEFT JOIN TheKhoDanhMuc dm ON dm\.TheKhoDanhMucID = v\.TheKhoDanhMucID/.test(routeCat),
  'catalogue CHUNG da join danh muc the kho');
kiem(/\$\{dieuKienCongKhaiDM\('dm'\)\}/.test(routeCat), 'va da loc theo cong khai cua danh muc');
kiem(/ISNULL\(\$\{biDanh\}\.CongKhai, 1\) = 1/.test(sPublic),
  'ma CHUA gan danh muc (NULL) van hien — khong lam bien mat hang chua phan loai');
/* Nua con lai cua cung quy tac: duong DAT HANG phai dung CUNG dieu kien, keo khach thay ma hang ma
   dat khong duoc (hoac nguoc lai, dat duoc ma khong duoc thay). */
const soDungDM = (bo(sPublic).match(/dieuKienCongKhaiDM\(/g) || []).length - 1;   // tru dong dinh nghia
kiem(soDungDM === 2, 'dieu kien dung o CA catalogue VA duong dat hang', String(soDungDM));
kiem(!/JOIN TheKhoDanhMuc d ON d\.TheKhoDanhMucID = h\.TheKhoDanhMucID\s*\n\s*WHERE h\.MaHang = @mh AND ms\.TenMau = @mau AND d\.CongKhai = 1/.test(sPublic),
  'duong dat hang KHONG con INNER JOIN + d.CongKhai = 1 (ma chua gan danh muc dat duoc)');

/* ================================ 3. BAO GIA ALOHA ================================ */
console.log('\n=== 3. Bao gia Aloha: chi ma con ton + hien ton + ten viet hoa don ===');
const routeCand = sKhoHang.slice(sKhoHang.indexOf("router.get('/baogia/candidates'"),
  sKhoHang.indexOf("router.get('/baogia'", sKhoHang.indexOf("router.get('/baogia/candidates'") + 10));
kiem(/LEFT JOIN vw_TonKhoHangHoa v ON v\.MaHangID = h\.MaHangID/.test(routeCand), 'join view ton kho');
kiem(/AND ISNULL\(v\.TongTonThuc, 0\) > 0/.test(routeCand), 'CHI lay ma CON TON');
kiem(/ISNULL\(v\.TongTonThuc, 0\) AS TongTon/.test(routeCand), 'tra ve so ton de hien canh ma');
/* Cot TongTon cua view = 0 voi ma chua co the kho -> dung cot do la ma vua nhap kho bi coi nhu het. */
kiem(!/ISNULL\(v\.TongTon,\s*0\)/.test(routeCand),
  'KHONG dung cot TongTon (bang 0 voi ma chua co the kho) — phai la TongTonThuc');
kiem(/Cac man khac[\s\S]{0,120}LUON dung TongTonThuc/.test(sMigV682),
  'migration_v682 that su noi cac man khac dung TongTonThuc (khong phai toi tu dat ra)');
kiem(/\$\{cotTenHDBG\} AS TenHoaDon/.test(routeCand), 'tra ve TenHoaDon cho danh sach chon ma');
kiem((sKhoHang.match(/\$\{cotTenHDCT\} AS TenHoaDon/g) || []).length === 2,
  'ca 2 duong doc chi tiet bao gia (xem + xuat Excel) deu tra TenHoaDon',
  String((sKhoHang.match(/\$\{cotTenHDCT\} AS TenHoaDon/g) || []).length));
kiem((sKhoHang.match(/const cotTenHDCT =/g) || []).length === 2, 'moi duong khai bien do cot cua no');
kiem(/coCotTenHoaDon\(pool\)/.test(routeCand),
  'dung coCotTenHoaDon DA CO SAN (khong tu viet ham do cot -> bai hoc v7.49.1)');
kiem(/\{[^}]*coCotTenHoaDon[^}]*\} = require\('\.\.\/utils\/maHangCapNhat'\)/.test(sKhoHang),
  'coCotTenHoaDon duoc NHAP trong chinh khohang.js');

console.log('\n=== 3b. Frontend bao gia: MOT ham ten dung chung 3 cho ===');
kiem(/function tenBaoGia\(c\)/.test(sFeKhoHang), 'co ham tenBaoGia()');
kiem(/c\.TenHoaDon \|\| c\.TenHang/.test(sFeKhoHang), 'uu tien TenHoaDon, lui ve TenHang');
const soDungTen = (bo(sFeKhoHang).match(/tenBaoGia\(/g) || []).length - 1;   // tru dong dinh nghia
kiem(soDungTen === 3, 'dung o 3 cho: form chon ma + popup xem + ban in', String(soDungTen));
kiem(/it\.TenHoaDon \|\| it\.TenHang/.test(sKhoHang), 'Excel bao gia cung dung quy tac do');
kiem(/tồn \$\{fmtNumber\(c\.TongTon\)\}/.test(sFeKhoHang), 'hien so ton canh ma trong form chon');
kiem(/escapeHtml\(c\.DonViCoBan \|\| 'Cái'\)/.test(sFeKhoHang), 'ton kem DVT cua chinh ma hang');
kiem(/data-search="\$\{escapeHtml\(\(c\.MaHang \+ ' ' \+ ten \+ ' ' \+ \(c\.TenHang \|\| ''\)\)/.test(sFeKhoHang),
  'o tim kiem tim duoc theo CA hai ten (hoa don + noi bo)');

/* ================================ 4. v7.55 LOC DANH MUC / LOAI HANG ================================ */
console.log('\n=== 4. Bao gia Aloha: loc theo Danh muc the kho + Loai hang (v7.55) ===');
const routeCand2 = sKhoHang.slice(sKhoHang.indexOf("router.get('/baogia/candidates'"),
  sKhoHang.indexOf("router.get('/baogia'", sKhoHang.indexOf("router.get('/baogia/candidates'") + 10));
kiem(/tk\.TenTheKho, nsp\.TenNhom/.test(routeCand2), 'backend tra TenTheKho + TenNhom');
kiem(/LEFT JOIN TheKhoDanhMuc tk ON tk\.TheKhoDanhMucID = h\.TheKhoDanhMucID/.test(routeCand2),
  'LEFT JOIN danh muc the kho (ca hai truong deu co the de trong)');
kiem(/LEFT JOIN DanhMucNhomSanPham nsp ON nsp\.NhomSanPhamID = h\.NhomSanPhamID/.test(routeCand2),
  'LEFT JOIN loai hang');
kiem(/data-dm="\$\{escapeHtml\(c\.TenTheKho \|\| ''\)\}"/.test(sFeKhoHang), 'dong mang data-dm');
kiem(/data-loai="\$\{escapeHtml\(c\.TenNhom \|\| ''\)\}"/.test(sFeKhoHang), 'dong mang data-loai');
kiem(/id="bgLocDM"/.test(sFeKhoHang) && /id="bgLocLoai"/.test(sFeKhoHang), 'form co 2 o loc');
kiem(/function apDungLoc\(\)/.test(sFeKhoHang), 'co MOT ham loc dung chung');
/* Ba bo loc PHAI cung mot ham: ba handler rieng thi moi handler tu dat display cua MOI dong -> chon
   danh muc xong go tim la mat luon bo loc danh muc. */
kiem(/\(!q \|\| row\.dataset\.search\.includes\(q\)\)[\s\S]{0,120}&&[\s\S]{0,60}row\.dataset\.dm === dm[\s\S]{0,80}row\.dataset\.loai === loai/.test(sFeKhoHang),
  'ba dieu kien AND trong CUNG mot bieu thuc (khong ghi de nhau)');
/* 4 cho gan: o tim (input) + 2 o loc (change) + checkbox (change, de dem lai so dong bi an).
   Dem CA checkbox vi mau `addEventListener('change', apDungLoc)` khop luon dong do — ghi 3 la con so
   dung nhung nhan sai, lan sau doc lai se tuong thieu mot cho. */
const soGanLoc = (bo(sFeKhoHang).match(/addEventListener\('(?:input|change)', apDungLoc\)/g) || []).length;
kiem(soGanLoc === 4, 'gan apDungLoc o 4 cho: o tim + 2 o loc + checkbox', String(soGanLoc));
kiem(/chk\.addEventListener\('change', apDungLoc\)/.test(sFeKhoHang),
  'tich/bo tich cung goi lai de dem lai so dong');
kiem(/apDungLoc\(\);/.test(sFeKhoHang), 'goi mot lan luc mo form (dem so dong ban dau)');
kiem(/mã đã tích đang bị ẩn bởi bộ lọc — vẫn được lưu/.test(sFeKhoHang),
  'CANH BAO: dong bi an van duoc luu neu dang tich (submit doc .bg-chk:checked tren ca bang)');
kiem(/\.bg-chk:checked/.test(sFeKhoHang), 'submit that su doc :checked tren ca bang (nen canh bao la dung)');

console.log('\n=== 4b. CHAY THAT optLoc(): dung tu chinh danh sach ma, bo trung/rong ===');
const mOpt = (() => {
  const i = sFeKhoHang.indexOf('function optLoc(ds, truong) {');
  if (i < 0) return null;
  const mo = sFeKhoHang.indexOf('{', i);
  let sau = 1, j = mo + 1, ch = null;
  for (; j < sFeKhoHang.length && sau > 0; j++) {
    const c = sFeKhoHang[j];
    if (ch) { if (c === ch && sFeKhoHang[j - 1] !== '\\') ch = null; continue; }
    if (c === "'" || c === '"' || c === '`') { ch = c; continue; }
    if (c === '{') sau++; else if (c === '}') sau--;
  }
  return sau === 0 ? sFeKhoHang.slice(i, j) : null;
})();
kiem(!!mOpt, 'cat duoc optLoc() tu file that');
if (mOpt) {
  const escapeHtml = (x) => (x == null ? '' : String(x).replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  const optLoc = new Function('escapeHtml', `${mOpt}\nreturn optLoc;`)(escapeHtml);
  const ds = [{ TenTheKho: 'Hàng hè 2026' }, { TenTheKho: 'Áo khoác' }, { TenTheKho: 'Hàng hè 2026' },
              { TenTheKho: '' }, { TenTheKho: null }, { TenTheKho: '  Áo khoác  ' }];
  const html = optLoc(ds, 'TenTheKho');
  const n = (html.match(/<option/g) || []).length;
  kiem(n === 2, '6 dong -> 2 option (bo trung + bo rong + trim)', String(n));
  kiem(html.indexOf('Áo khoác') < html.indexOf('Hàng hè 2026'), 'xep theo tieng Viet (A truoc H)');
  kiem(!/<option value=""/.test(html), 'khong sinh option rong');
  kiem(/&lt;b&gt;/.test(optLoc([{ X: '<b>' }], 'X')), 'gia tri duoc escape');
  kiem(optLoc(null, 'X') === '' && optLoc([], 'X') === '', 'ds rong/null -> chuoi rong');
}

console.log(`\n================ KET QUA: ${dat} dat / ${truot} sai ================`);
process.exit(truot ? 1 : 0);
