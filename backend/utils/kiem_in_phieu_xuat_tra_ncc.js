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
  /* `giaTraCuaDong` thi KHONG lam ham gia: cat HAM THAT tu module.khovai.js ra chay. No la cong
     thuc TIEN (DonGiaTra neu co, khong thi DonGiaNhap) — viet lai mot ban cho test la tu tay bo di
     dung cai minh dinh kiem. */
  const mGia = sFe.match(/function giaTraCuaDong\(r\) \{[\s\S]*?\n  \}/);
  if (!mGia) { console.log('   ✗ khong cat duoc giaTraCuaDong() tu module.khovai.js'); process.exitCode = 1; }
  const giaTraCuaDongThat = mGia ? new Function('return (' + mGia[0] + ')')() : (r => 0);

  /* 🔴 HAM GIA NAY PHAI GIONG HAM THAT (module.khovai.js · dongTongKgMet), ke ca thuoc tinh style.
     Ban dau toi viet thieu tham so thu 6 `coCotMet` va in o tong bang `<td>kg</td>` tran — the la
     kiemBatBien() ben duoi dem duoc 0 o tong (no dem chuoi `<td style="text-align:right;">`) va
     BAO SAI 4 phep kiem trong khi code that dung. Test bao sai con te hon test bao dung nham:
     lan sau co loi that thi khong ai tin mau do nua. */
  const dongTongKgMet = (ls, fKg, fMet, truoc, sau, coCotMet) =>
    `<tr data-tong><td colspan="${truoc}" style="text-align:right;">TỔNG CỘNG</td>`
    + `<td style="text-align:right;">kg</td>`
    + (coCotMet !== false ? `<td style="text-align:right;">met</td>` : '')
    + (sau > 0 ? `<td colspan="${sau}"></td>` : '') + '</tr>';
  const veBang = (header, lines) => new Function(
    'header', 'lines', 'laTraNCC', 'nhanPhieuNhapCuaDong', 'dongTongKgMet', 'giaTraCuaDong',
    'escapeHtml', 'fmtNumber', 'fmtTien', 'fmtDate', thanBang
  )(header, lines, laTra, nhan, dongTongKgMet, giaTraCuaDongThat, escapeHtml,
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
  /* v8.91 (Nguyen 2026-10-15: "tra nha cung cap: bo cot Kieu, chi can Ma cay va So kg"):
     phieu TRA NCC bo them "Kieu" va "So met" => 13 - 2 = 11 cot. Phieu xuat SX GIU NGUYEN 11. */
  kiem(demTh(bangTra) === 11, 'phieu TRA NCC: 11 cot (bo Kg chi dinh + Kieu + So met, them Don gia/So HD/Ngay HD)', String(demTh(bangTra)));
  kiem(demTh(bangSX) === 11, 'phieu xuat SX: 11 cot nhu cu (VAN co Kieu, Kg chi dinh, So met)', String(demTh(bangSX)));
  kiem(demO(bangTra) === 11, 'so O du lieu = so cot (tra NCC) — khong lech cot', String(demO(bangTra)));
  kiem(demO(bangSX) === 11, 'so O du lieu = so cot (xuat SX)', String(demO(bangSX)));
  kiem(!/Kg chỉ định/.test(bangTra), 'tra NCC: KHONG con cot "Kg chi dinh"');
  kiem(/Kg chỉ định/.test(bangSX), 'xuat SX: VAN giu cot "Kg chi dinh"');
  // v8.91 — hai cot vua bo. Kiem CA HAI chieu: bo o phieu tra, nhung PHAI con o phieu xuat SX.
  kiem(!/<th[\s>][^<]*Kiểu/.test(bangTra), 'tra NCC: KHONG con cot "Kieu"');
  kiem(/<th[\s>][^<]*Kiểu/.test(bangSX), 'xuat SX: VAN giu cot "Kieu" (bo la vai Phoi thanh Chinh)');
  kiem(!/<th[\s>][^<]*Số mét/.test(bangTra), 'tra NCC: KHONG con cot "So met"');
  kiem(/<th[\s>][^<]*Số mét/.test(bangSX), 'xuat SX: VAN giu cot "So met"');
  ['Đơn giá', 'Số HĐ NCC', 'Ngày HĐ'].forEach(t =>
    kiem(bangTra.includes(t) && !bangSX.includes(t), `"${t}" chi co o phieu tra NCC`));
  kiem(/T85000/.test(bangTra), 'don gia lay tu VaiCay.DonGiaNhap khi KHONG go tay (qua fmtTien)');
  /* v8.91: go don gia tay thi ban in phai in DUNG gia do — in mot gia ma cong no ghi gia khac la
     nguon cai nhau voi nha cung cap. */
  const bangTraGo = veBang({ LaTraNCC: 1, TenNCC: 'A' },
    [Object.assign({}, dongDayDu, { DonGiaTra: 70000 })]);
  kiem(/T70000/.test(bangTraGo) && !/T85000/.test(bangTraGo),
    'go DonGiaTra thi ban in dung gia go, KHONG dung DonGiaNhap');
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
  // v8.91: tra NCC bo cot "Kieu" => 7 - 1 = 6 cot dau. Xuat SX giu nguyen 8.
  /* `[^>]*` giua colspan va `>`: o TONG CONG co ca `style="text-align:right;"`. Regex cu dinh
     `colspan="6">` nen vua them style vao ham gia la 4 phep kiem bao do oan. */
  kiem(/colspan="6"[^>]*>TỔNG CỘNG/.test(tongTra), 'tra NCC: TONG CONG chiem 6 cot dau (den "Kho vai", khong con "Kieu")', tongTra);
  kiem(/colspan="8"[^>]*>TỔNG CỘNG/.test(tongSX), 'xuat SX: TONG CONG chiem 8 cot dau (co Kg chi dinh)', tongSX);
  kiem(/colspan="4"><\/td>/.test(tongTra), 'tra NCC: duoi dong tong chiem 4 cot (Don gia/So HD/Ngay HD/Ghi chu)');
  kiem(/colspan="1"><\/td>/.test(tongSX), 'xuat SX: duoi dong tong chiem 1 cot (Ghi chu)');
  /* 🔴 BAT BIEN THAT SU: colspanTruoc + (so O TONG) + colspanSau === so cot cua tieu de.
     v8.91: so O TONG khong con co dinh la 2 — phieu TRA NCC bo cot "So met" nen chi con 1 o.
     Dem thang tu HTML thay vi hard-code: hard-code 2 la lan sau bo them mot cot thi phep kiem
     van xanh trong khi dong TONG da roi nham cot (bai hoc v8.12 tfoot lech cot). */
  const kiemBatBien = (bang, tong, ten, soOTongMong) => {
    const t = (tong.match(/colspan="(\d+)"[^>]*>TỔNG/) || [])[1];
    const s = (tong.match(/colspan="(\d+)"><\/td>/) || [])[1] || '0';
    const soOTong = ((tong.match(/<td style="text-align:right;">/g) || []).length);
    kiem(soOTong === soOTongMong, `${ten}: dong TONG co ${soOTongMong} o so`, 'dang co ' + soOTong);
    kiem(Number(t) + soOTong + Number(s) === demTh(bang),
      `${ten}: dong TONG CONG phu dung so cot cua tieu de (${t}+${soOTong}+${s} = ${demTh(bang)})`);
  };
  kiemBatBien(bangTra, tongTra, 'tra NCC', 1);   // khong con cot So met
  kiemBatBien(bangSX, tongSX, 'xuat SX', 2);
}

console.log('\n=== 6c. Backend tra du 3 truong moi ===');
kiem(/v\.DonGiaNhap/.test(routeXem), 'lines co DonGiaNhap (don gia nhap cua chinh cay)');
kiem(/pnv\.NgayHoaDon AS NgayHoaDonNhap/.test(routeXem), 'lines co NgayHoaDon cua phieu nhap');
const schemaPNV = doc('../database/CAI_DAT_DAY_DU.sql');
kiem(/ALTER TABLE PhieuNhapVai ADD NgayHoaDon DATE NULL/.test(schemaPNV),
  'PhieuNhapVai.NgayHoaDon co that trong schema (migration_v54)');
kiem(/ALTER TABLE VaiCay ADD DonGiaNhap DECIMAL\(14,2\) NULL/.test(schemaPNV),
  'VaiCay.DonGiaNhap co that trong schema');

/* ================================================================================================
   8. v8.91 — DON GIA TRA GO TAY
   ------------------------------------------------------------------------------------------------
   🔴 DAY LA TIEN. Cong no NCC khi tra hang = KG xuat x don gia. Truoc v8.91 don gia luon la
   VaiCay.DonGiaNhap ("khong ai phai go, khong the lech voi luc nhap"). Nay cho go, nen phai khoa
   lai BA dieu:
     (a) De trong = NULL = dung gia nhap nhu cu  -> du lieu cu KHONG doi so.
     (b) Bang tong va so chi tiet dung CUNG mot bieu thuc -> hai man hinh khong the ra hai so.
     (c) Khong quy gia trong ve 0 -> khong co phieu tra nao giam no 0 dong.
   ================================================================================================ */
console.log('\n=== 8a. Mot bieu thuc dung chung cho CA HAI man cong no ===');
const sTien = doc('utils/tienVaiNhap.js');
const sCongNo = doc('routes/congno.js');
kiem(/async function bieuThucTienTraVai\(pool, biDanhCT, biDanhCay\)/.test(sTien),
  'co ham dung chung bieuThucTienTraVai()');
/* Truoc v8.91 cong thuc nay bi CHEP RIENG o congNoNCC() va soChiTietNCC(). Hai ban chep la som muon
   sua mot quen mot, roi bang tong va so chi tiet ra hai con so khac nhau. */
kiem((sCongNo.match(/bieuThucTienTraVai\(pool\)/g) || []).length >= 2,
  'CA HAI noi (bang tong + so chi tiet) deu goi bieuThucTienTraVai');
kiem(!/SUM\(ISNULL\(ct\.KGXuat,0\) \* ISNULL\(vc\.DonGiaNhap,0\)\)/.test(sCongNo),
  'KHONG con ban chep cong thuc trong congno.js');

console.log('\n=== 8b. De trong = dung gia nhap (du lieu cu khong doi so) ===');
kiem(/COALESCE\(\$\{ct\}\.DonGiaTra, \$\{vc\}\.DonGiaNhap, 0\)/.test(sTien),
  'COALESCE: uu tien DonGiaTra, khong co thi DonGiaNhap');
kiem(/ISNULL\(\$\{vc\}\.DonGiaNhap, 0\)/.test(sTien),
  'chua chay migration_v879 thi lui ve cong thuc cu');
const sMig = doc('../database/migration_v879.sql');
kiem(/ALTER TABLE PhieuXuatVaiChiTiet ADD DonGiaTra DECIMAL\(18,2\) NULL/.test(sMig),
  'cot DonGiaTra la NULL (KHONG DEFAULT 0 — default 0 la moi phieu tra cu bong dung giam no 0 dong)');
kiem(/IF COL_LENGTH\('PhieuXuatVaiChiTiet', 'DonGiaTra'\) IS NULL/.test(sMig), 'migration co guard, chay lai duoc');
kiem(!/UPDATE PhieuXuatVaiChiTiet/.test(sMig.replace(/\/\*[\s\S]*?\*\//g, '')),
  'migration KHONG dung den du lieu cu');

console.log('\n=== 8c. Khong quy gia trong ve 0 (CHAY ham that, khong do chuoi) ===');
const sDichVu = doc('utils/vaiXuatService.js');
const sKhoVai = doc('routes/khovai.js');
/* Truoc day muc nay do CHUOI `isNaN(Number(x.donGiaTra))) ? null`. Do chuoi chi chung minh "co cau
   do trong file", KHONG chung minh no XU LY DUNG — va dung la no SAI: `Number('0')` la 0, `isNaN(0)`
   la false, nen so 0 lot qua va duoc ghi thang xuong CSDL. `COALESCE(0, ...)` tra 0 => phieu tra
   500 kg giam no DUNG 0 DONG, cong no phai tra phinh len nguyen gia tri lo hang, im lang.
   Nay goi HAM THAT voi tung gia tri bien. */
const { chuanDonGiaTra } = require('./tienVaiNhap');
[['de trong', '', null], ['null', null, null], ['undefined', undefined, null],
 ['chu', 'abc', null], ['so 0', '0', null], ['so 0 dang number', 0, null],
 ['so am', '-5', null], ['gia that', '70000', 70000], ['gia that dang number', 70000, 70000]
].forEach(([ten, vao, ra]) => {
  kiem(chuanDonGiaTra(vao) === ra, `chuanDonGiaTra(${ten}) -> ${ra === null ? 'NULL (dung gia nhap)' : ra}`,
    String(chuanDonGiaTra(vao)));
});
[['vaiXuatService.js', sDichVu], ['khovai.js (sua phieu)', sKhoVai]].forEach(([ten, s]) => {
  kiem(/chuanDonGiaTra\(/.test(s), `${ten}: dung ham chuan hoa dung chung`);
  kiem(!/isNaN\(Number\((roll|line)\.donGiaTra\)\)/.test(s),
    `${ten}: KHONG con ban chep phep kiem cu (ban cu khong bat duoc so 0)`);
});
kiem(/chua chay migration_v879/i.test(sDichVu),
  'go gia ma CSDL chua co cot thi BAO LOI (khong de gia go roi mat sach)');

console.log('\n=== 8d. Form: doi bo cot theo che do, KHONG lam mat kieuVai ===');
const sFeKV = doc('../frontend/js/module.khovai.js');
/* Mat o Kieu thi dong xuat SX gui len thieu kieuVai -> backend mac dinh 'Chinh' -> cay PHOI thanh
   CHINH -> san luong cat cong du. Dung con bug DH2608064 ma v8.71 vua sua.
   Form TAO: an bang CSS, o van nam trong DOM. Form SUA: che do co dinh luc mo nen dung thang bo cot
   dung, nhung o che do tra NCC phai giu input ẩn mang dung gia tri cu — bo han la luu xong KieuVai
   ve 'Chinh' va SoMet ve NULL du nguoi dung chi sua ngay xuat. */
kiem(/<select class="x-kieu">/.test(sFeKV), 'form TAO: o Kieu VAN con trong DOM (chi an bang CSS)');
kiem(/classList\.toggle\('tra-ncc', b\)/.test(sFeKV), 'form TAO: doi bo cot bang class tren bang, khong xoa o');
kiem(/table\.bang-xuat\.tra-ncc \.c-kieu/.test(sFeKV), 'form TAO: CSS an cot Kieu khi tra NCC');
kiem(/<input type="hidden" class="xe-kieu"/.test(sFeKV) && /<input type="hidden" class="xe-met"/.test(sFeKV),
  'form SUA (tra NCC): giu kieuVai + soMet bang input an, khong de mat du lieu');
/* `display:none` KHONG bo duoc mot <col> khoi bang — trinh duyet van dem du so <col> roi gan lan
   luot cho cac o con nhin thay, nen bang meo. Be rong phai dat thang len <th>. */
kiem(!/colgroup .c-dg/.test(sFeKV) && !/display:table-column/.test(sFeKV),
  'KHONG co gang an/hien <col> bang display (khong hop le, lam lech be rong cot)');
kiem(/table\.bang-xuat\.tra-ncc \.c-met/.test(sFeKV), 'CSS an cot So met khi tra NCC');
kiem(/class="x-dg"/.test(sFeKV) && /class="x-tt"/.test(sFeKV), 'co o Don gia va o Thanh tien');
kiem(/donGiaTra: \(r\.querySelector\('\.x-dg'\) \|\| \{\}\)\.value \|\| null/.test(sFeKV),
  'form gui donGiaTra len backend');
// Nhap dang do: truoc v8.91 KHONG luu kieuVai -> khoi phuc nhap la "Phoi" lang le ve "Chinh".
kiem(/kieuVai: \(r\.querySelector\('\.x-kieu'\) \|\| \{\}\)\.value \|\| 'Chính'/.test(sFeKV),
  'nhap dang do co luu ca kieuVai (va khoi phuc lai)');
kiem(/r\.querySelector\('\.x-kieu'\)\.value = d\.kieuVai/.test(sFeKV), 'khoi phuc nhap co set lai o Kieu');

/* ================================================================================================
   8e. v8.91 — SUA PHIEU KHONG DUOC XOA TRANG DON GIA DA GO
   ------------------------------------------------------------------------------------------------
   🔴 DAY LA LOI MAT TIEN, bat duoc khi ra soat cheo. Form Sua phieu khong co o Don gia (ban nhap
   dau) nen gui len `donGiaTra = undefined`; backend cu ghi thang => NULL => GHI DE len gia da go,
   cho MOI dong. Chi can mo phieu ra sua NGAY XUAT roi Luu la cong no nhay tu KG×50.000 sang
   KG×85.000 — 500 kg la lech 17,5 trieu, khong log, khong ai thay.
   Chot hai dau: form PHAI gui, va backend PHAI bo qua khi ben goi khong gui.
   ================================================================================================ */
console.log('\n=== 8e. Sua phieu: khong xoa trang don gia da go ===');
kiem(/Object\.prototype\.hasOwnProperty\.call\(line, 'donGiaTra'\)/.test(sKhoVai),
  'backend CHI ghi DonGiaTra khi ben goi co gui khoa do');
kiem(/const ghiDgTra = coDgTraSua && coGuiDgTra/.test(sKhoVai),
  'co cot + co gui thi moi dua DonGiaTra vao cau UPDATE/INSERT');
kiem(/if \(laTraSua\) l\.donGiaTra = oDg \? oDg\.value : ''/.test(sFeKV),
  'form SUA phieu tra NCC CO gui donGiaTra len');
kiem(/class="xe-dg"/.test(sFeKV), 'form SUA (tra NCC) co o Don gia');

/* ================================================================================================
   8f. v8.91 — MOT CONG THUC, KHONG BAN CHEP NAO SOT
   ------------------------------------------------------------------------------------------------
   Ban dau chi sua 2 trong 3 ban chep: `utils/chungTu.js` (bam so phieu de XEM CHUNG TU) van doc
   DonGiaNhap. Hau qua: so chi tiet NCC ghi giam no 50.000×kg, bam vao chinh dong do xem chung tu
   lai thay 85.000×kg. Quet CA backend thay vi dem >= 2.
   ================================================================================================ */
console.log('\n=== 8f. Quet toan backend: khong con ban chep cong thuc ===');
const sChungTu = doc('utils/chungTu.js');
kiem(/bieuThucTienTraVai\(pool, 'ct', 'vc'\)/.test(sChungTu),
  'chungTu.js (xem chung tu PXV) dung ham chung, khong tu nhan DonGiaNhap');
[['congno.js', sCongNo], ['chungTu.js', sChungTu]].forEach(([ten, s]) => {
  const khongComment = s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  kiem(!/ISNULL\(ct\.KGXuat\s*,\s*0\)\s*\*\s*ISNULL\(vc\.DonGiaNhap/.test(khongComment),
    `${ten}: KHONG con ban chep "KGXuat * DonGiaNhap" viet tay`);
});
/* Cache ket qua do cot la cach de nhat de hai ben lech nhau: chay migration ma quen pm2 restart thi
   ben co cache van tuong chua co cot, ben do truc tiep thi thay co => ban in mot gia, cong no mot
   gia. Doi lai mot cau COL_LENGTH moi lan goi. */
kiem(!/__coCotDonGiaTra/.test(sTien), 'coCotDonGiaTra KHONG cache (tranh lech sau migration)');
kiem(!/COL_LENGTH\('PhieuXuatVaiChiTiet'\s*,\s*'DonGiaTra'\)/.test(sKhoVai.replace(/\/\*[\s\S]*?\*\//g, '')),
  'khovai.js khong tu do cot, goi ham chung');
kiem(!/COL_LENGTH\('PhieuXuatVaiChiTiet'\s*,\s*'DonGiaTra'\)/.test(sDichVu.replace(/\/\*[\s\S]*?\*\//g, '')),
  'vaiXuatService.js khong tu do cot, goi ham chung');

console.log('\n=== 7. Bump ?v= ===');
/* Khong ghim dung mot so: ban sau sua tiep file nay se bump len 7.51, 7.52... — ghim so la test cu
   do oan mot thay doi hoan toan dung (da sua cung loi o kiem_chungtu_congno_ncc.js). */
const vKhoVai = (sIndex.match(/module\.khovai\.js\?v=([\d.]+)/) || [])[1] || '';
kiem(parseFloat(vKhoVai) >= 7.50, 'index.html: module.khovai.js da bump >= 7.50', 'dang la ' + vKhoVai);

console.log(`\n================ KET QUA: ${dat} dat / ${truot} sai ================`);
process.exit(truot ? 1 : 0);
