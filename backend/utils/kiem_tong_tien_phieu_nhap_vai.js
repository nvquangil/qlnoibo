/* ================================================================================================
   KIEM CHUNG v7.61 — TONG TIEN PHIEU NHAP KHO VAI
     · Danh sach phieu: them cot Tong tien (+ dong tong cuoi bang)
     · Popup xem phieu : them cot Thanh tien + dong TONG TIEN
     · Ban in          : them cot Thanh tien + dong TONG TIEN + tien bang chu

   HAI RUI RO CHINH, test nay canh ca hai:

   (A) HAI CON SO CHO CUNG MOT PHIEU. Cong no nha cung cap ghi no bang KGNhap * DonGiaNhap. Phieu
       nhap ma tu tinh kieu khac (vd cong them met * gia) thi tong tren phieu va so ghi no cua chinh
       phieu do lech nhau, nguoi dung khong biet ben nao dung. => MOT bieu thuc duy nhat o
       utils/tienVaiNhap.js, congno.js va khovai.js cung goi.

   (B) LECH COT BANG. `dongTongKgMet(lines, fKg, fMet, truoc, sau)` dat 2 o tong ngay sau `truoc`,
       nen rang buoc la: truoc + 2 + sau === so cot tieu de. `khoiTongTienHtml(lines, truoc, sau)`
       dat 1 o tien: truoc + 1 + sau === so cot tieu de. Sai la bang vo ma trinh duyet khong bao gi.
       Test DEM THAT so <th> cua tung bang roi doi chieu voi cac so trong loi goi.

   Chay:  node utils/kiem_tong_tien_phieu_nhap_vai.js
   ================================================================================================ */
const fs = require('fs');
const path = require('path');
const G = path.join(__dirname, '..');
const doc = (p) => fs.readFileSync(path.join(G, p), 'utf8');

let dat = 0, truot = 0;
const OK = (m) => { dat++; console.log('  OK   ' + m); };
const NO = (m) => { truot++; console.log('  SAI  ' + m); };
const kiem = (dk, m, them) => (dk ? OK(m) : NO(m + (them ? '  -> ' + them : '')));
const bang = (thuc, mong, m) => kiem(JSON.stringify(thuc) === JSON.stringify(mong), `${m}  [duoc: ${JSON.stringify(thuc)}]`);
const bo = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const sUtil = doc('utils/tienVaiNhap.js');
const sKV = doc('routes/khovai.js');
const sCN = doc('routes/congno.js');
const sFe = doc('../frontend/js/module.khovai.js');
const sIndex = doc('../frontend/index.html');

/* ================================================================================================
   1. MOT bieu thuc duy nhat
   ================================================================================================ */
console.log('\n=== 1. Mot ban cong thuc tien vai (CHAY THAT) ===');
const util = require('./tienVaiNhap');
/* Pool gia de dieu khien "da chay migration_v694 hay chua". Cache __coCotDVT nam o pham vi mo-dun
   nen moi canh phai NAP LAI mo-dun — bay da mac o kiem_ton_vai.js. */
const DUONG = require.resolve('./tienVaiNhap');
const napMoi = () => { delete require.cache[DUONG]; return require('./tienVaiNhap'); };
const poolGia = (coCot) => ({ request: () => ({ query: async () => ({ recordset: [{ c: coCot ? 1 : null }] }) }) });

(async () => {
  let u = napMoi();
  const btMoi = await u.bieuThucTienCay(poolGia(true), 'vc');
  kiem(/CASE WHEN[\s\S]*DonViTinhGia[\s\S]*N'Met'[\s\S]*SoMet[\s\S]*ELSE[\s\S]*KGNhap/.test(btMoi.replace(/\s+/g, ' ')),
    'da chay migration -> bieu thuc re nhanh theo DonViTinhGia cua PHIEU');
  kiem(btMoi.indexOf('vc.PhieuNhapID') > 0, 'truy van con noi dung cay voi phieu cua no');
  kiem(btMoi.indexOf('ISNULL(vc.DonGiaNhap, 0)') > 0, 'van nhan voi don gia cua chinh cay');
  u = napMoi();
  const btCu = await u.bieuThucTienCay(poolGia(false), 'vc');
  bang(btCu, '((ISNULL(vc.KGNhap, 0)) * ISNULL(vc.DonGiaNhap, 0))',
    'CHUA chay migration -> quay ve dung bieu thuc cu (thuan KG), khong nhac ten cot chua co');
  kiem(btCu.indexOf('DonViTinhGia') === -1,
    'va TUYET DOI khong de ten cot moi lot vao cau SQL (keo "Invalid column name" gay ca man cong no)');
  u = napMoi();
  const btV = await u.bieuThucTienCay(poolGia(true), 'v');
  kiem(btV.indexOf('v.KGNhap') > 0 && btV.indexOf('vc.') === -1, 'doi duoc bi danh bang');

  /* Ban JS — cung phep tinh. */
  bang(util.tienCay({ KGNhap: 12.5, DonGiaNhap: 80000 }, 'Kg'), 1000000, 'theo Kg: 12,5 x 80.000');
  bang(util.tienCay({ KGNhap: 12.5, SoMet: 300, DonGiaNhap: 80000 }), 1000000, 'khong truyen don vi -> mac dinh Kg');
  bang(util.tienCay({ KGNhap: 0, SoMet: 300, DonGiaNhap: 50000 }, 'Met'), 15000000, 'theo Met: 300 x 50.000');
  bang(util.tienCay({ KGNhap: 0, SoMet: 300, DonGiaNhap: 50000 }, 'Kg'), 0,
    'phieu de Kg ma cay chi co met -> 0 (dung nhu cong no dang ghi cho du lieu cu)');
  bang(util.tienCay({}, 'Met'), 0, 'dong rong -> 0, khong ra NaN');
  bang(util.tongTien([{ SoMet: 10, DonGiaNhap: 1000 }, { SoMet: 5, DonGiaNhap: 2000 }], 'Met'), 20000, 'tongTien theo met');
  bang(util.laTienNghiNgo({ KGNhap: 0, SoMet: 300, DonGiaNhap: 50000 }, 'Kg'), true,
    'phieu Kg + cay chi co met -> DANG NGO (nhieu kha nang chon nham don vi)');
  bang(util.laTienNghiNgo({ KGNhap: 200, SoMet: 0, DonGiaNhap: 50000 }, 'Met'), true, 'nguoc lai cung dang ngo');
  bang(util.laTienNghiNgo({ KGNhap: 0, SoMet: 300, DonGiaNhap: 50000 }, 'Met'), false, 'chon dung don vi -> khong canh bao');
  bang(util.laTienNghiNgo({ KGNhap: 0, SoMet: 0, DonGiaNhap: 50000 }, 'Kg'), false, 'khong co so nao -> khong doan bua');
  bang(util.laTienNghiNgo({ KGNhap: 0, SoMet: 300, DonGiaNhap: 0 }, 'Kg'), false, 'chua khai gia -> khong canh bao');
  bang([util.chuanDonViTinhGia('Met'), util.chuanDonViTinhGia('met'), util.chuanDonViTinhGia('Kg'),
        util.chuanDonViTinhGia(''), util.chuanDonViTinhGia('linh tinh')],
    ['Met', 'Met', 'Kg', 'Kg', 'Kg'],
    'chuanDonViTinhGia chi tra Kg/Met (rang buoc CHECK cua v694 khong nhan chuoi khac)');
  bang([util.nhanDonVi('Met'), util.nhanDonVi('Kg'), util.nhanDonVi(null)], ['m', 'kg', 'kg'], 'nhan don vi');

  console.log('\n=== 1b. Khong con ban sao viet tay ===');
const demTay = (s) => (bo(s).replace(/\s+/g, ' ')
  .match(/ISNULL\(\w+\.KGNhap\s*,\s*0\)\s*\*\s*ISNULL\(\w+\.DonGiaNhap\s*,\s*0\)/g) || []).length;
kiem(demTay(sCN) === 0, 'congno.js KHONG con bieu thuc viet tay', String(demTay(sCN)));
kiem(demTay(sKV) === 0, 'khovai.js KHONG viet bieu thuc rieng', String(demTay(sKV)));
/* congno.js co 4 cho can tien vai: bang tong hop, so chi tiet NCC, bang chung tu, va sheet Excel.
   Ban dau toi chi sua 3 — cho thu 4 (xuat Excel) van con viet tay, chinh test nay bat duoc.
   Dem `bieuThucTienCay(` = so LOI GOI; dong require la `{ bieuThucTienCay }` nen khong dinh. */
kiem((sCN.match(/bieuThucTienCay\(/g) || []).length === 4,
  'congno.js goi util o DU 4 cho', String((sCN.match(/bieuThucTienCay\(/g) || []).length));
kiem(/require\('\.\.\/utils\/tienVaiNhap'\)/.test(sCN) && /require\('\.\.\/utils\/tienVaiNhap'\)/.test(sKV),
  'ca hai route deu NHAP tu util (khong phai ham o file khac)');

/* ================================================================================================
   2. Backend tra ve TongTien / ThanhTien
   ================================================================================================ */
console.log('\n=== 2. Backend khovai.js ===');
kiem(/ISNULL\(SUM\(\$\{await bieuThucTienCay\(pool, 'v'\)\}\), 0\) AS TongTien/.test(sKV),
  'danh sach phieu tra TongTien');
kiem(/\$\{await bieuThucTienCay\(pool, 'v'\)\} AS ThanhTien/.test(sKV), 'chi tiet phieu tra ThanhTien tung cay');
kiem(/AS SoCayThieuSoLuong/.test(sKV), 'dem so cay co gia ma KG = 0 (de canh bao)');
kiem(/GROUP BY p\.PhieuNhapID/.test(sKV), 'van GROUP BY theo phieu (tong khong bi nhan ban)');

/* ================================================================================================
   3. CHAY THAT cac ham tien o frontend
   ================================================================================================ */
console.log('\n=== 3. CHAY THAT tienCuaCay / khoiTongTienHtml ===');
function catHam(src, ten) {
  const moc = src.search(new RegExp('function\\s+' + ten + '\\s*\\('));
  if (moc < 0) return null;
  const mo = src.indexOf('{', moc);
  let sau = 1, i = mo + 1, ch = null;
  for (; i < src.length && sau > 0; i++) {
    const c = src[i];
    if (ch) { if (c === ch && src[i - 1] !== '\\') ch = null; continue; }
    if (c === "'" || c === '"' || c === '`') { ch = c; continue; }
    if (c === '{') sau++; else if (c === '}') sau--;
  }
  return sau === 0 ? src.slice(moc, i) : null;
}
const tenHam = ['tienCuaCay', 'laTienNghiNgoVai', 'tongTienCay', 'khoiTongTienHtml',
  'laTinhTheoMet', 'nhanDonViGia', 'soLuongTinhTien'];
const than = tenHam.map(n => catHam(sFe, n));
kiem(than.every(Boolean), 'cat duoc ' + tenHam.length + ' ham tien tu module.khovai.js',
  tenHam.filter((n, i) => !than[i]).join(', '));
const hop = new Function('fmtTien', 'escapeHtml', `
  ${than.join('\n')}
  return { ${tenHam.join(', ')} };`)(
  (n) => String(Math.round(Number(n) || 0)), (x) => String(x == null ? '' : x));

bang(hop.tienCuaCay({ ThanhTien: 999, KGNhap: 1, DonGiaNhap: 1 }, 'Kg'), 999,
  'UU TIEN ThanhTien cua backend (cung so voi cong no), khong tu nhan lai');
bang(hop.tienCuaCay({ KGNhap: 12.5, DonGiaNhap: 80000 }, 'Kg'), 1000000, 'phieu Kg -> nhan KG');
bang(hop.tienCuaCay({ KGNhap: 0, SoMet: 300, DonGiaNhap: 50000 }, 'Met'), 15000000, 'phieu Met -> nhan SO MET');
bang(hop.tienCuaCay({ KGNhap: 0, SoMet: 300, DonGiaNhap: 50000 }, 'Kg'), 0, 'phieu Kg ma cay chi co met -> 0');
bang(hop.tienCuaCay({ KGNhap: 12.5, SoMet: 300, DonGiaNhap: 80000 }), 1000000, 'khong truyen don vi -> Kg');
bang(hop.laTienNghiNgoVai({ KGNhap: 0, SoMet: 300, DonGiaNhap: 50000 }, 'Kg'), true, 'danh dau cay dang ngo');
bang(hop.laTienNghiNgoVai({ KGNhap: 0, SoMet: 300, DonGiaNhap: 50000 }, 'Met'), false, 'dung don vi -> khong canh bao');
bang([hop.nhanDonViGia('Met'), hop.nhanDonViGia('Kg'), hop.nhanDonViGia(null)], ['m', 'kg', 'kg'], 'nhan don vi');
/* Ban JS o frontend PHAI ra DUNG so cua ban backend — hai ban lech nhau la loi kho thay nhat. */
const canh = [{ KGNhap: 12.5, DonGiaNhap: 80000 }, { KGNhap: 0, SoMet: 300, DonGiaNhap: 50000 },
  { KGNhap: 7, DonGiaNhap: 0 }, { KGNhap: 3, SoMet: 40, DonGiaNhap: 1000 }, {}];
['Kg', 'Met', undefined].forEach(dvt => {
  bang(canh.map(r => hop.tienCuaCay(r, dvt)), canh.map(r => util.tienCay(r, dvt)),
    `ban JS frontend == ban backend tren 5 canh, don vi = ${dvt || '(mac dinh)'}`);
});

const htmlKg = hop.khoiTongTienHtml([{ KGNhap: 0, SoMet: 5, DonGiaNhap: 100 }, { KGNhap: 2, DonGiaNhap: 100 }], 8, 1, 'Kg');
kiem(/TỔNG TIỀN/.test(htmlKg), 'khoi tong co nhan TONG TIEN');
kiem(/>200 đ</.test(htmlKg), 'phieu Kg: tong = 0 + 200', htmlKg.replace(/\s+/g, ' ').slice(0, 160));
kiem(/1 cây có đơn giá nhưng KG = 0/.test(htmlKg), 'neu ro so cay dang ngo thay vi hien 0 tro troi');
kiem(/đơn giá theo kg/.test(htmlKg), 'ghi ro dang tinh theo don vi nao');
const htmlMet = hop.khoiTongTienHtml([{ KGNhap: 0, SoMet: 5, DonGiaNhap: 100 }, { KGNhap: 2, DonGiaNhap: 100 }], 8, 1, 'Met');
kiem(/>500 đ</.test(htmlMet), 'CUNG du lieu, phieu Met: tong = 500 + 0', htmlMet.replace(/\s+/g, ' ').slice(0, 160));
kiem(/1 cây có đơn giá nhưng số mét = 0/.test(htmlMet), 'canh bao doi theo don vi cua phieu');

/* ================================================================================================
   4. DEM THAT SO COT — chan lech bang
   ================================================================================================ */
console.log('\n=== 4. So cot cua ba bang (dem that) ===');
/* Dem <th> nhung KHONG dinh <thead> — bay da mac o kiem_in_phieu_xuat_tra_ncc. */
const demTh = (s) => (s.match(/<th[\s>]/g) || []).length;
function soiBang(ten, moc) {
  const i = sFe.indexOf(moc);
  if (i < 0) { NO(`${ten}: khong tim thay bang`); return null; }
  const het = sFe.indexOf('</table>', i);
  const khoi = sFe.slice(i, het);
  const thead = khoi.slice(0, khoi.indexOf('</thead>'));
  const cot = demTh(thead);
  const kgMet = /dongTongKgMet\(lines,\s*'KGNhap',\s*'SoMet',\s*(\d+),\s*(\d+)\)/.exec(khoi);
  const tien = /khoiTongTienHtml\(lines,\s*(\d+),\s*(\d+)\s*(?:,[^)]*)?\)/.exec(khoi);
  console.log(`  · ${ten}: ${cot} cot tieu de`);
  if (kgMet) {
    const t = Number(kgMet[1]), s2 = Number(kgMet[2]);
    kiem(t + 2 + s2 === cot, `${ten}: dongTongKgMet(${t}, ${s2}) -> ${t}+2+${s2} = ${t + 2 + s2} phai bang ${cot}`);
  }
  if (tien) {
    const t = Number(tien[1]), s2 = Number(tien[2]);
    kiem(t + 1 + s2 === cot, `${ten}: khoiTongTienHtml(${t}, ${s2}) -> ${t}+1+${s2} = ${t + 1 + s2} phai bang ${cot}`);
  }
  return { khoi, cot };
}
const bIn = soiBang('BAN IN', '<th style="width:38px;">STT</th><th>Mã vải</th>');
const bXem = soiBang('POPUP XEM', '<th style="width:38px;">STT</th><th>Mã cây</th>');

/* Danh sach phieu: dem <th> va doi chieu voi colspan cua dong tong o tfoot + so <td> cua dong du lieu. */
const iDs = sFe.indexOf('<th>Số phiếu</th>');
const khoiDs = sFe.slice(iDs, sFe.indexOf('</table>', iDs));
const cotDs = demTh(khoiDs.slice(0, khoiDs.indexOf('</thead>')));
console.log(`  · DANH SACH PHIEU: ${cotDs} cot tieu de`);
kiem(/<th>Tổng tiền<\/th>/.test(khoiDs), 'danh sach phieu DA co cot Tong tien');
const tfoot = khoiDs.slice(khoiDs.indexOf('<tfoot>'));
const spans = [...tfoot.matchAll(/colspan="(\d+)"/g)].map(m => Number(m[1]));
const soOThuong = (tfoot.match(/<td(?![^>]*colspan)/g) || []).length;
kiem(spans.reduce((a, b) => a + b, 0) + soOThuong === cotDs,
  `dong TONG CONG cua danh sach: ${spans.join('+')}+${soOThuong} = ${spans.reduce((a, b) => a + b, 0) + soOThuong} phai bang ${cotDs}`);
kiem(/colspan="11" class="empty-hint"/.test(khoiDs) || new RegExp(`colspan="${cotDs}" class="empty-hint"`).test(khoiDs),
  `dong "chua co phieu nao" dung colspan = ${cotDs}`);

console.log('\n=== 5. Ban in ===');
kiem(!!bIn && /<th>Thành tiền<\/th>/.test(bIn.khoi), 'ban in co cot Thanh tien');
kiem(!!bIn && /<th>Giá nhập \(đ\//.test(bIn.khoi), 'ban in co cot Gia nhap KEM don vi (d/kg hay d/m)');
kiem(/Tổng tiền bằng chữ/.test(sFe), 'ban in co dong tien bang chu');
kiem(/docSoTienBangChu\(tongTienCay\(lines, header\.DonViTinhGia\)\)/.test(sFe),
  'tien bang chu lay TU CHINH tong vua tinh, dung don vi cua phieu');
kiem(!!bXem && /<th>Thành tiền<\/th>/.test(bXem.khoi), 'popup xem co cot Thanh tien');

console.log('\n=== 6. Bump ?v= ===');
const v = (sIndex.match(/module\.khovai\.js\?v=([\d.]+)/) || [])[1];
kiem(v && parseFloat(v) >= 7.62, 'index.html: module.khovai.js?v= >= 7.62', String(v));

  console.log('\n=== 7. Form nhap: o "Don gia tinh theo" ===');
  kiem(/function oDonViTinhGiaHtml\(dvtHienTai\)/.test(sFe), 'co ham dung o chon');
  kiem((sFe.match(/oDonViTinhGiaHtml\(/g) || []).length === 3,
    'dung o CA form Tao VA form Sua (+1 dong dinh nghia)',
    String((sFe.match(/oDonViTinhGiaHtml\(/g) || []).length));
  kiem(/donViTinhGia: fd\.get\('donViTinhGia'\) \|\| 'Kg'/.test(sFe), 'gui len backend, mac dinh Kg');
  kiem((sFe.match(/donViTinhGia: fd\.get\('donViTinhGia'\)/g) || []).length === 3,
    'ca 3 duong deu gui: Tao, Sua, va ban nhap do (draft)',
    String((sFe.match(/donViTinhGia: fd\.get\('donViTinhGia'\)/g) || []).length));
  kiem(/oDvt\.value = draft\.donViTinhGia \|\| 'Kg'/.test(sFe),
    'khoi phuc ban nhap do co lay lai o don vi (bo sot la phieu mua theo met mo lai thanh Kg)');
  kiem(/chuanDonViTinhGia\(req\.body\.donViTinhGia\)/.test(sKV), 'backend chuan hoa truoc khi ghi');
  kiem((sKV.match(/chuanDonViTinhGia\(req\.body\.donViTinhGia\)/g) || []).length === 2,
    'ca POST va PUT deu ghi co', String((sKV.match(/chuanDonViTinhGia\(req\.body\.donViTinhGia\)/g) || []).length));
  kiem(/coDVTGia \? ', DonViTinhGia' : ''/.test(sKV) && /coDVTGiaSua \? ', DonViTinhGia=@DonViTinhGia' : ''/.test(sKV),
    'do cot truoc khi ghi (chua chay migration_v694 van luu phieu duoc)');

  console.log('\n=== 8. Migration + CLI soi ===');
  const sMig = doc('../database/migration_v694.sql');
  kiem(/ALTER TABLE PhieuNhapVai ADD DonViTinhGia NVARCHAR\(10\) NULL/.test(sMig), 'migration_v694 them cot');
  kiem(/IF COL_LENGTH\('PhieuNhapVai', 'DonViTinhGia'\) IS NULL/.test(sMig), 'chay lai duoc');
  kiem(/CK_PhieuNhapVai_DonViTinhGia/.test(sMig), 'co rang buoc chi nhan Kg / Met');
  kiem(!/UPDATE PhieuNhapVai[\s\S]{0,160}DonViTinhGia\s*=/.test(sMig),
    'CO Y khong backfill — nguoi dung chot "de nguyen, chi ap dung tu nay"');
  const sCaiDat = doc('../database/CAI_DAT_DAY_DU.sql');
  kiem(/\[\d+\/\d+\]\s+migration_v694\.sql/.test(sCaiDat),
    'CAI_DAT_DAY_DU.sql da gop khoi migration_v694 (sinh lai bang tao_file_cai_dat.js)');
  const sSoi = doc('utils/soi_tien_vai_theo_met.js');
  kiem(!/\b(UPDATE|DELETE\s+FROM|INSERT\s+INTO)\b/i.test(bo(sSoi)), 'CLI soi CHI DOC');
  kiem(/ISNULL\(vc\.KGNhap, 0\) <= 0[\s\S]{0,80}ISNULL\(vc\.SoMet, 0\) > 0/.test(sSoi),
    'CLI loc dung tap: co gia, KG = 0, co met');
  kiem(/cong no phai tra se TANG/.test(sSoi), 'CLI noi ro hau qua: cong no se TANG');

  console.log('\n================================================================');
  console.log(`KET QUA: ${dat} dat / ${truot} truot`);
  process.exit(truot ? 1 : 0);
})();
