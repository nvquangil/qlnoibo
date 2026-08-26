/* ================================================================================================
   KIEM CHUNG v7.49/v7.50 — Ban in phieu XUAT KHO VAI: phieu TRA NCC phai ghi ro NCC + phieu nhap/ngay
   ------------------------------------------------------------------------------------------------
   Yeu cau: "in phieu xuat kho vai, neu tra nha cung cap thi them dong nha cung cap, phieu nhap ngay".

   Diem de sai NHAT: tu v7.48 mot phieu tra GOP DUOC cay cua NHIEU phieu nhap. Ghi mot phieu nhap
   (vd lay dong dau) la BAN IN NOI SAI — nen phai liet ke DU, gop trung. Test nay CHAY THAT ham
   `dsPhieuNhapCuaPhieuXuat()` va `khoiTraNCCHtml()` cat ra tu file frontend that (khong copy code,
   copy thi code doi ma test van xanh) voi 8 canh du lieu.

   Chay:  node utils/kiem_in_phieu_xuat_tra_ncc.js
   ================================================================================================ */
const fs = require('fs');
const path = require('path');

const G = path.join(__dirname, '..');
const doc = (p) => fs.readFileSync(path.join(G, p), 'utf8');

let dat = 0, truot = 0;
const OK = (m) => { dat++; console.log('  OK   ' + m); };
const NO = (m) => { truot++; console.log('  SAI  ' + m); };
const kiem = (dk, m, them) => (dk ? OK(m) : NO(m + (them ? '  -> ' + them : '')));

const sFe = doc('../frontend/js/module.khovai.js');
const sBe = doc('routes/khovai.js');
const sIndex = doc('../frontend/index.html');

/* ------------------------------------------------------------------------------------------------
   CAT 2 ham ra khoi file that roi CHAY. Cac ham phu (escapeHtml/fmtDate) nap ban gia.
   ------------------------------------------------------------------------------------------------ */
function catHam(src, ten) {
  const moc = src.indexOf('function ' + ten + '(');
  if (moc < 0) return null;
  const mo = src.indexOf('{', moc);
  let sau = 1, i = mo + 1, chuoi = null;
  for (; i < src.length && sau > 0; i++) {
    const c = src[i];
    if (chuoi) { if (c === chuoi && src[i - 1] !== '\\') chuoi = null; continue; }
    if (c === "'" || c === '"' || c === '`') { chuoi = c; continue; }
    if (c === '{') sau++;
    else if (c === '}') sau--;
  }
  return sau === 0 ? src.slice(moc, i) : null;
}
const mNhan = catHam(sFe, 'nhanPhieuNhapCuaDong');
const mDs = catHam(sFe, 'dsPhieuNhapCuaPhieuXuat');
const mLa = catHam(sFe, 'laTraNCC');
const mKhoi = catHam(sFe, 'khoiTraNCCHtml');

console.log('\n=== 1. Cat duoc cac ham tu file that ===');
kiem(!!mNhan, 'cat duoc nhanPhieuNhapCuaDong()');
kiem(!!mDs, 'cat duoc dsPhieuNhapCuaPhieuXuat()');
kiem(!!mLa, 'cat duoc laTraNCC()');
kiem(!!mKhoi, 'cat duoc khoiTraNCCHtml()');
if (!mNhan || !mDs || !mLa || !mKhoi) { console.log('\nDUNG: khong cat duoc ham.'); process.exit(1); }

const escapeHtml = (s) => (s == null ? '' : String(s).replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
const fmtDate = (d) => {
  const x = new Date(d);
  if (isNaN(x)) return '';
  const h = n => String(n).padStart(2, '0');
  return `${h(x.getDate())}/${h(x.getMonth() + 1)}/${x.getFullYear()}`;
};
const moi = new Function('escapeHtml', 'fmtDate',
  `${mNhan}\n${mDs}\n${mLa}\n${mKhoi}
   return { nhanPhieuNhapCuaDong, dsPhieuNhapCuaPhieuXuat, laTraNCC, khoiTraNCCHtml };`)(escapeHtml, fmtDate);
const { nhanPhieuNhapCuaDong: nhan, dsPhieuNhapCuaPhieuXuat: dsPN,
        laTraNCC: laTra, khoiTraNCCHtml: khoi } = moi;

const dong = (id, ngay, hd) => ({ PhieuNhapID: id, NgayPhieuNhap: ngay, SoHoaDonNhap: hd || null });

console.log('\n=== 2. NHIEU phieu nhap trong mot phieu tra -> liet ke DU (loi de mac nhat) ===');
const lines2 = [dong(12, '2026-08-12'), dong(15, '2026-08-20'), dong(12, '2026-08-12')];
const ds2 = dsPN(lines2);
kiem(ds2.length === 2, '3 dong thuoc 2 phieu nhap -> 2 nhan (gop trung)', String(ds2.length));
kiem(ds2[0] === 'NKV-00012 (12/08/2026)', 'nhan 1 dung dinh dang NKV-##### (dd/mm/yyyy)', ds2[0]);
kiem(ds2[1] === 'NKV-00015 (20/08/2026)', 'nhan 2 dung', ds2[1]);
const html2 = khoi({ LaTraNCC: 1, TenNCC: 'Cty Dệt Phong Phú' }, lines2, true);
kiem(/Trả nhà cung cấp:<\/b> Cty Dệt Phong Phú/.test(html2), 'co dong "Tra nha cung cap"');
kiem(/Theo phiếu nhập:<\/b> NKV-00012 \(12\/08\/2026\) · NKV-00015 \(20\/08\/2026\)/.test(html2),
  'dong tom tat liet ke DU CA HAI phieu nhap', html2.replace(/\s+/g, ' '));

console.log('\n=== 2b. v7.50: cot GHI CHU tung cay + bo dong tom tat tren BAN IN ===');
kiem(nhan(dong(9136, '2026-08-17')) === 'NKV-09136 (17/08/2026)',
  'nhan cua MOT dong dung dinh dang', nhan(dong(9136, '2026-08-17')));
kiem(nhan({ PhieuNhapID: null }) === '' && nhan(null) === '',
  'dong khong biet phieu nhap -> nhan rong (o Ghi chu de trong)');
/* Ban in truyen keDanhSach = false: KHONG in lai danh sach gop o dau phieu (moi dong da co). */
const htmlIn = khoi({ LaTraNCC: 1, TenNCC: 'Cty A' }, lines2, false);
kiem(/Trả nhà cung cấp/.test(htmlIn), 'ban in VAN co dong nha cung cap');
kiem(!/Theo phiếu nhập/.test(htmlIn), 'ban in KHONG con dong tom tat (tranh noi hai lan)');
/* Popup xem truyen true (bang tren man hinh khong co cot Ghi chu). */
kiem(/Theo phiếu nhập/.test(khoi({ LaTraNCC: 1, TenNCC: 'Cty A' }, lines2, true)),
  'popup xem VAN co dong tom tat');
/* Doc chinh file: o Ghi chu tung dong phai dien nhan, va CHI khi la phieu tra NCC. */
/* Muc 6b da CHAY THAT doan dung bang nen kiem duoc hanh vi; o day chi can chac o Ghi chu co goi
   nhanPhieuNhapCuaDong va CO dieu kien theo phieu tra NCC (khong ghim nguyen van cau lenh — ghim la
   moi lan tinh chinh cu phap lai do oan mot thay doi dung). */
kiem(/laTra \?[^]*?nhanPhieuNhapCuaDong\(r,\s*false\)/.test(sFe),
  'cot Ghi chu tung dong = nhan phieu nhap cua CHINH cay do, chi khi la phieu tra NCC');
kiem(/khoiTraNCCHtml\(header, lines, false\)/.test(sFe), 'ban in goi voi keDanhSach = false');
kiem(/khoiTraNCCHtml\(header, lines, true\)/.test(sFe), 'popup xem goi voi keDanhSach = true');
kiem(laTra({ LaTraNCC: 1 }) && laTra({ LaTraNCC: true }) && !laTra({}) && !laTra(null),
  'laTraNCC() nhan ca Bit 1 va boolean true, phieu cu -> false');

console.log('\n=== 3. KHONG phai phieu tra NCC -> KHONG hien gi ===');
kiem(khoi({ LaTraNCC: 0, TenNCC: 'X' }, lines2, true) === '', 'LaTraNCC = 0 -> chuoi rong');
kiem(khoi({}, lines2, true) === '', 'phieu cu / chua chay migration (khong co cot) -> chuoi rong');
kiem(khoi(null, lines2, true) === '', 'header null -> khong vang');
kiem(khoi({ LaTraNCC: true }, lines2, true) !== '', 'LaTraNCC = true (kieu Bit tra ve boolean) van hien');

console.log('\n=== 4. Cac canh du lieu thieu ===');
kiem(/chưa khai nhà cung cấp/.test(khoi({ LaTraNCC: 1 }, lines2, true)),
  'thieu TenNCC -> ghi ro "(chua khai nha cung cap)" chu khong de trang');
const htmlKhongPN = khoi({ LaTraNCC: 1, TenNCC: 'A' }, [{ PhieuNhapID: null }], true);
kiem(!/Theo phiếu nhập/.test(htmlKhongPN), 'khong biet phieu nhap -> BO dong do, khong in dong rong');
const dsKhongNgay = dsPN([dong(7, null)]);
kiem(dsKhongNgay[0] === 'NKV-00007', 'thieu ngay -> chi ghi so phieu', dsKhongNgay[0]);
const dsHD = dsPN([dong(7, '2026-08-01', 'HD123')]);
kiem(dsHD[0] === 'NKV-00007 (01/08/2026 HĐ HD123)', 'co so hoa don thi ghi kem', dsHD[0]);
kiem(dsPN([]).length === 0 && dsPN(null).length === 0, 'lines rong / null -> mang rong');
kiem(/&lt;script&gt;/.test(khoi({ LaTraNCC: 1, TenNCC: '<script>x</script>' }, [], true)),
  'ten NCC duoc escape (khong nhung HTML tho vao ban in)');

console.log('\n=== 5. Dung CHUNG cho ban in va popup xem (khong hai ban) ===');
/* TRU dong DINH NGHIA: `function khoiTraNCCHtml(header, lines)` cung khop mau goi ham. Dem ca dong
   dinh nghia la con so lech 1 ma van "xanh" o lan sau — dung bay da mac o kiem_cong_no_truoc.js. */
const soGoi = (sFe.match(/khoiTraNCCHtml\(header, lines,\s*(?:true|false)\)/g) || []).length;
kiem(soGoi === 2,
  'khoiTraNCCHtml() duoc goi o DUNG 2 cho: printPhieuXuatFromData + openXuatDetailModal',
  String(soGoi));
kiem((sFe.match(/Trả nhà cung cấp:<\/b>/g) || []).length === 1,
  'chuoi nhan chi xuat hien MOT lan trong code (khong copy sang cho thu hai)');

console.log('\n=== 6. Backend cap du du lieu ===');
const routeXem = sBe.slice(sBe.indexOf("router.get('/xuat/:id'"), sBe.indexOf("router.put('/xuat/:id'"));
kiem(/coCotTraNCCVai\(pool\)/.test(routeXem),
  'DO COT truoc khi JOIN (migration v6.66 co the chua chay)');
/* ⚠️ v7.49.1 — BAI HOC: ban v7.49 goi `coCot(pool, ...)`, ham do CO THAT nhung o congno.js, con trong
   khovai.js thi KHONG TON TAI -> ReferenceError -> khong mo/in duoc phieu. `node --check` khong bat
   duoc (cu phap dung), va assertion cu chi grep chuoi "coCot(pool, 'PhieuXuatVai', 'NCC_ID')" nen
   thay co -> bao OK. Nen tu day: HAM NAO DUOC GOI THI PHAI KIEM NO CO KHAI TRONG FILE. */
/* BO COMMENT truoc khi quet: chinh ghi chu cua ban sua nay co nhac ten `coCot(pool, ...)` de giai
   thich loi cu -> khong bo comment la test tu bao oan chinh ghi chu cua no. */
const routeXemSach = routeXem.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const HAM_DUNG = [...new Set((routeXemSach.match(/(?:^|[^\w$.])(co[A-Z][\w$]*|conHang[\w$]*)\s*\(/g) || [])
  .map(s => s.replace(/[^\w$]/g, '')))];
console.log('     ham do cot dung trong route: ' + (HAM_DUNG.join(', ') || '(khong co)'));
HAM_DUNG.forEach(h => {
  const khai = new RegExp(`(?:async\\s+)?function\\s+${h}\\s*\\(`).test(sBe)
    || new RegExp(`(?:const|let|var)\\s+${h}\\s*=`).test(sBe)
    || new RegExp(`\\{[^}]*\\b${h}\\b[^}]*\\}\\s*=\\s*require\\(`).test(sBe);
  kiem(khai, `${h}() CO khai/nhap trong khovai.js (khong goi ham cua file khac)`);
});
kiem(/LEFT JOIN NhaCungCap ncc ON ncc\.NCC_ID = p\.NCC_ID/.test(routeXem), 'join lay TenNCC');
kiem(/CAST\(NULL AS NVARCHAR\(150\)\) AS TenNCC/.test(routeXem),
  'chua co cot -> tra NULL, route khong sap');
kiem(/v\.PhieuNhapID/.test(routeXem) && /pnv\.NgayNhap AS NgayPhieuNhap/.test(routeXem)
  && /pnv\.SoHoaDon AS SoHoaDonNhap/.test(routeXem),
  'moi DONG mang theo phieu nhap goc + ngay cua PHIEU (khong dung v.NgayNhap cua cay)');
kiem(/LEFT JOIN PhieuNhapVai pnv ON pnv\.PhieuNhapID = v\.PhieuNhapID/.test(routeXem),
  'join PhieuNhapVai (LEFT: cay mat phieu nhap thi dong van hien)');

/* ------------------------------------------------------------------------------------------------
   6b. v7.51 — BANG CO HAI DANG. Cat NGUYEN doan dung bang (IIFE trong printPhieuXuatFromData) tu file
   that roi CHAY voi ca hai loai phieu, dem tung o. Loi im lang o day la "dong TONG CONG roi lech cot"
   khi doi thu tu/so cot ma quen 2 tham so dem cot cua dongTongKgMet.
   ------------------------------------------------------------------------------------------------ */
console.log('\n=== 6b. Bang co HAI DANG (tra NCC / xuat SX) ===');
const mocBang = sFe.indexOf('const laTra = laTraNCC(header);');
const dauIIFE = sFe.lastIndexOf('${(() => {', mocBang);
let sauNgoac = 0, j = sFe.indexOf('{', dauIIFE + 4), batDau = j, chuoiJ = null;
for (sauNgoac = 1, j = batDau + 1; j < sFe.length && sauNgoac > 0; j++) {
  const c = sFe[j];
  if (chuoiJ) { if (c === chuoiJ && sFe[j - 1] !== '\\') chuoiJ = null; continue; }
  if (c === "'" || c === '"' || c === '`') { chuoiJ = c; continue; }
  if (c === '{') sauNgoac++; else if (c === '}') sauNgoac--;
}
const thanBang = dauIIFE >= 0 && sauNgoac === 0 ? sFe.slice(batDau + 1, j - 1) : null;
kiem(!!thanBang, 'cat duoc doan dung bang tu printPhieuXuatFromData()');
if (thanBang) {
  const dongTongKgMet = (ls, fKg, fMet, truoc, sau) =>
    `<tr data-tong><td colspan="${truoc}">TỔNG CỘNG</td><td>kg</td><td>met</td>`
    + (sau > 0 ? `<td colspan="${sau}"></td>` : '') + '</tr>';
  const veBang = (header, lines) => new Function(
    'header', 'lines', 'laTraNCC', 'nhanPhieuNhapCuaDong', 'dongTongKgMet',
    'escapeHtml', 'fmtNumber', 'fmtTien', 'fmtDate', thanBang
  )(header, lines, laTra, nhan, dongTongKgMet, escapeHtml,
    v => String(v == null ? '' : v), v => 'T' + String(v), fmtDate);

  const dongDayDu = {
    MaVai: 'V01', TenLoaiVai: 'Cotton', TenMau: 'Đen', KieuVai: 'Chính', MaCay: 'TK-A01',
    KhoVaiThucTe: 1.5, SLTheoChiDinh: 40, KGXuat: 30, SoMet: 120,
    DonGiaNhap: 85000, PhieuNhapID: 9136, NgayPhieuNhap: '2026-08-17',
    SoHoaDonNhap: 'HD-771', NgayHoaDonNhap: '2026-08-16'
  };
  /* `<th[\s>]` chu KHONG phai `<th` — `<thead>` cung chua "<th", dem la lech 1 (da mac dung bay nay
     ngay khi viet test). O du lieu: chi dem trong phan TRUOC dong TONG CONG. */
  const demTh = (html) => (html.match(/<th[\s>]/g) || []).length;
  const demO = (html) => ((html.split('<tr data-tong>')[0] || '').match(/<td/g) || []).length;

  const bangTra = veBang({ LaTraNCC: 1, TenNCC: 'A' }, [dongDayDu]);
  const bangSX = veBang({ LaTraNCC: 0 }, [dongDayDu]);
  kiem(demTh(bangTra) === 13, 'phieu TRA NCC: 13 cot (bo Kg chi dinh, them Don gia/So HD/Ngay HD)', String(demTh(bangTra)));
  kiem(demTh(bangSX) === 11, 'phieu xuat SX: 11 cot nhu cu (VAN co Kg chi dinh)', String(demTh(bangSX)));
  kiem(demO(bangTra) === 13, 'so O du lieu = so cot (tra NCC) — khong lech cot', String(demO(bangTra)));
  kiem(demO(bangSX) === 11, 'so O du lieu = so cot (xuat SX)', String(demO(bangSX)));
  kiem(!/Kg chỉ định/.test(bangTra), 'tra NCC: KHONG con cot "Kg chi dinh"');
  kiem(/Kg chỉ định/.test(bangSX), 'xuat SX: VAN giu cot "Kg chi dinh"');
  ['Đơn giá', 'Số HĐ NCC', 'Ngày HĐ'].forEach(t =>
    kiem(bangTra.includes(t) && !bangSX.includes(t), `"${t}" chi co o phieu tra NCC`));
  kiem(/T85000/.test(bangTra), 'don gia lay tu VaiCay.DonGiaNhap (qua fmtTien)');
  kiem(/HD-771/.test(bangTra), 'so hoa don NCC lay tu phieu nhap');
  kiem(/16\/08\/2026/.test(bangTra), 'ngay hoa don NCC lay tu phieu nhap (khong phai ngay nhap)');
  kiem(/NKV-09136 \(17\/08\/2026\)/.test(bangTra), 'cot Ghi chu van co phieu nhap cua chinh cay do');
  kiem(!/17\/08\/2026 HĐ/.test(bangTra),
    'o Ghi chu KHONG nhac lai so HD (da co cot "So HD NCC" rieng)');
  kiem(/NKV-00012 \(12\/08\/2026 HĐ/.test(khoi({ LaTraNCC: 1, TenNCC: 'A' },
    [dong(12, '2026-08-12', 'HD-1')], true)),
    'dong tom tat o popup VAN kem so HD (bang o day khong co cot nao)');
  /* Dong TONG CONG: 2 o tong phai roi DUNG vao cot "SL xuat thuc te" va "So met". */
  const tongTra = (bangTra.match(/<tr data-tong>.*?<\/tr>/s) || [''])[0];
  const tongSX = (bangSX.match(/<tr data-tong>.*?<\/tr>/s) || [''])[0];
  kiem(/colspan="7">TỔNG CỘNG/.test(tongTra), 'tra NCC: TONG CONG chiem 7 cot dau (den "Kho vai")', tongTra);
  kiem(/colspan="8">TỔNG CỘNG/.test(tongSX), 'xuat SX: TONG CONG chiem 8 cot dau (co Kg chi dinh)', tongSX);
  kiem(/colspan="4"><\/td>/.test(tongTra), 'tra NCC: duoi dong tong chiem 4 cot (Don gia/So HD/Ngay HD/Ghi chu)');
  kiem(/colspan="1"><\/td>/.test(tongSX), 'xuat SX: duoi dong tong chiem 1 cot (Ghi chu)');
  /* Bat bien that su: colspanTruoc + 2 + colspanSau === so cot cua tieu de. */
  const kiemBatBien = (bang, tong, ten) => {
    const t = (tong.match(/colspan="(\d+)">TỔNG/) || [])[1];
    const s = (tong.match(/colspan="(\d+)"><\/td>/) || [])[1] || '0';
    kiem(Number(t) + 2 + Number(s) === demTh(bang),
      `${ten}: dong TONG CONG phu dung so cot cua tieu de (${t}+2+${s} = ${demTh(bang)})`);
  };
  kiemBatBien(bangTra, tongTra, 'tra NCC');
  kiemBatBien(bangSX, tongSX, 'xuat SX');
}

console.log('\n=== 6c. Backend tra du 3 truong moi ===');
kiem(/v\.DonGiaNhap/.test(routeXem), 'lines co DonGiaNhap (don gia nhap cua chinh cay)');
kiem(/pnv\.NgayHoaDon AS NgayHoaDonNhap/.test(routeXem), 'lines co NgayHoaDon cua phieu nhap');
const schemaPNV = doc('../database/CAI_DAT_DAY_DU.sql');
kiem(/ALTER TABLE PhieuNhapVai ADD NgayHoaDon DATE NULL/.test(schemaPNV),
  'PhieuNhapVai.NgayHoaDon co that trong schema (migration_v54)');
kiem(/ALTER TABLE VaiCay ADD DonGiaNhap DECIMAL\(14,2\) NULL/.test(schemaPNV),
  'VaiCay.DonGiaNhap co that trong schema');

console.log('\n=== 7. Bump ?v= ===');
/* Khong ghim dung mot so: ban sau sua tiep file nay se bump len 7.51, 7.52... — ghim so la test cu
   do oan mot thay doi hoan toan dung (da sua cung loi o kiem_chungtu_congno_ncc.js). */
const vKhoVai = (sIndex.match(/module\.khovai\.js\?v=([\d.]+)/) || [])[1] || '';
kiem(parseFloat(vKhoVai) >= 7.50, 'index.html: module.khovai.js da bump >= 7.50', 'dang la ' + vKhoVai);

console.log(`\n================ KET QUA: ${dat} dat / ${truot} sai ================`);
process.exit(truot ? 1 : 0);
