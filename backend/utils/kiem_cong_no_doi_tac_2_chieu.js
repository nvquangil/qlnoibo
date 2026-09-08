/* ================================================================================================
   KIEM CHUNG v7.81 — KHACH HANG DONG THOI LA NHA CUNG CAP: CONG NO 2 CHIEU
   ------------------------------------------------------------------------------------------------
   Nguyen: "Khach hang dong thoi la nha cung cap, cong no theo doi chung" -> chot:
     · ghep bang cach KHAI TAY mot lan (Danh muc NCC -> o "Dong thoi la khach hang");
     · hien CA 3 so: phai thu, phai tra, chenh lech;
     · gom phieu ban hang / phieu nhap kho / phieu thu / phieu chi vao CUNG MOT BANG.

   ⚠️⚠️ CHO DE SAI NHAT — DAU CUA HAI SO NGUOC NGHIA NHAU:
       so KHACH : PhatSinh = ban hang -> tang PHAI THU ; ThanhToan = minh THU tien -> giam phai thu
       so NCC   : PhatSinh = mua hang -> tang PHAI TRA ; ThanhToan = minh CHI tien -> giam phai tra
   Cong thang hai cot vao MOT cot luy ke la lay tien ban tru tien mua — sai hoan toan. Test CHAY THAT
   soDoiTac2Chieu() voi pool gia de so tung con so.

   Chay:  NODE_PATH=/tmp/tsd/node_modules node utils/kiem_cong_no_doi_tac_2_chieu.js
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
const bo = (s) => String(s).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const sCongNo = doc('routes/congno.js');
const sDanhMuc = doc('routes/danhmuc.js');
const sCrud = doc('utils/crudFactory.js');
const sFeCongNo = doc('../frontend/js/module.congno.js');
const sFeDanhMuc = doc('../frontend/js/module.danhmuc.js');
const sMig = doc('../database/migration_v696.sql');
const sCaiDat = doc('../database/CAI_DAT_DAY_DU.sql');
const sIndex = doc('../frontend/index.html');

/* ================================================================================================
   1. CHAY THAT soDoiTac2Chieu(): cat ham ra chay voi soChiTietKH/NCC gia
   ================================================================================================ */
console.log('\n=== 1. CHAY THAT cong thuc 2 chieu ===');
function catHam(s, moc) {
  const i = s.indexOf(moc);
  if (i < 0) return '';
  let d = 0;
  for (let k = s.indexOf('{', i); k < s.length; k++) {
    if (s[k] === '{') d++;
    else if (s[k] === '}') { d--; if (!d) return s.slice(i, k + 1); }
  }
  return '';
}
const than = catHam(sCongNo, 'async function soDoiTac2Chieu(pool, khachHangId, capBiet) {');
kiem(!!than, 'cat duoc soDoiTac2Chieu');

const so = (v) => { const n = Number(v); return isFinite(n) ? n : 0; };
const lam2 = (v) => Math.round(so(v) * 100) / 100;

/* Hai so gia — tra ve MOI NHAT TRUOC, dung nhu soChiTietKH/NCC that. */
const soKHGia = {
  rows: [
    { Ngay: '2026-09-06', Loai: 'Phiếu thu', SoPhieu: 'PT01', PhatSinh: 0, ThanhToan: 300, CtLoai: 'PT', CtID: 9 },
    { Ngay: '2026-09-02', Loai: 'Phiếu bán hàng', SoPhieu: 'BH01', PhatSinh: 1000, ThanhToan: 0, CtLoai: 'PBH', CtID: 1 }
  ]
};
const soNCCGia = {
  rows: [
    { Ngay: '2026-09-05', Loai: 'Phiếu chi', SoPhieu: 'PC01', PhatSinh: 0, ThanhToan: 200, CtLoai: 'PC', CtID: 7 },
    { Ngay: '2026-09-03', Loai: 'Nhập vải', SoPhieu: 'PN01', PhatSinh: 600, ThanhToan: 0, CtLoai: 'PNV', CtID: 3 }
  ]
};
const F = new Function('so', 'lam2', 'soChiTietKH', 'soChiTietNCC', 'sql',
  than + '\nreturn soDoiTac2Chieu;')(
    so, lam2, async () => soKHGia, async () => soNCCGia, { Int: 'Int' });

(async () => {
  const CAP = { NCC_ID: 5, TenNCC: 'Cty ABC', KhachHangID: 2, TenKhachHang: 'Cty ABC' };
  const d = await F(null, 2, CAP);

  bang(d.rows.map(r => r.SoPhieu), ['PT01', 'PC01', 'PN01', 'BH01'],
    'gom du 4 chung tu, NGAY MOI NHAT LEN DAU (06/09 -> 02/09)');
  bang(d.rows.map(r => r.Ben), ['ThuVe', 'TraDi', 'TraDi', 'ThuVe'], 'danh dau dung chieu tung dong');

  console.log('\n  --- Dau tien: ban/thu vao PHAI THU, mua/chi vao PHAI TRA ---');
  const theoPhieu = {}; d.rows.forEach(r => { theoPhieu[r.SoPhieu] = r; });
  bang([theoPhieu.BH01.PhaiThu, theoPhieu.BH01.PhaiTra], [1000, 0], 'ban hang 1000 -> PHAI THU +1000');
  bang([theoPhieu.PT01.PhaiThu, theoPhieu.PT01.PhaiTra], [-300, 0], 'thu 300 -> PHAI THU −300 (khong dung sang phai tra)');
  bang([theoPhieu.PN01.PhaiThu, theoPhieu.PN01.PhaiTra], [0, 600], 'nhap vai 600 -> PHAI TRA +600');
  bang([theoPhieu.PC01.PhaiThu, theoPhieu.PC01.PhaiTra], [0, -200], 'chi 200 -> PHAI TRA −200');

  console.log('\n  --- Ba so tong ---');
  bang(d.phaiThu, 700, 'phai thu = 1000 − 300 = 700');
  bang(d.phaiTra, 400, 'phai tra = 600 − 200 = 400');
  bang(d.chenhLech, 300, 'chenh lech = 700 − 400 = 300 (ho con no minh)');
  kiem(d.phaiThu !== d.chenhLech && d.phaiTra !== d.chenhLech,
    'ba so KHAC nhau — khong bi gop nham thanh mot cot luy ke');

  console.log('\n  --- Luy ke tung dong (tinh theo chieu TANG roi dao) ---');
  /* Theo thoi gian: BH01(+1000 thu) PN01(+600 tra) PC01(−200 tra) PT01(−300 thu). */
  bang(theoPhieu.BH01.ChenhLech, 1000, 'sau BH01: 1000 − 0');
  bang(theoPhieu.PN01.ChenhLech, 400, 'sau PN01: 1000 − 600');
  bang(theoPhieu.PC01.ChenhLech, 600, 'sau PC01: 1000 − 400');
  bang(theoPhieu.PT01.ChenhLech, 300, 'sau PT01: 700 − 400 = chenh lech cuoi');
  bang(d.rows[0].ChenhLech, d.chenhLech, 'dong TREN CUNG = chenh lech hien tai');

  console.log('\n  --- Truong hop bien ---');
  bang((await F(null, 2, { ...CAP, NCC_ID: null })).phaiTra, 0,
    'khach CHUA ghep NCC -> phai tra = 0, khong noi vao so NCC');
  bang(d.tenKhachHang, 'Cty ABC', 'tra ve ten khach');
  bang(d.nccId, 5, 'tra ve ma NCC da ghep');
  kiem(d.rows.every(r => r.CtLoai && r.CtID), 'moi dong giu CtLoai/CtID -> bam so phieu mo duoc chung tu');

  /* Chenh lech AM = minh no ho. */
  const F2 = new Function('so', 'lam2', 'soChiTietKH', 'soChiTietNCC', 'sql', than + '\nreturn soDoiTac2Chieu;')(
    so, lam2, async () => ({ rows: [{ Ngay: '2026-09-02', Loai: 'Phiếu bán hàng', SoPhieu: 'BH', PhatSinh: 100, ThanhToan: 0 }] }),
    async () => ({ rows: [{ Ngay: '2026-09-03', Loai: 'Nhập vải', SoPhieu: 'PN', PhatSinh: 900, ThanhToan: 0 }] }), { Int: 'Int' });
  const d2 = await F2(null, 2, CAP);
  bang([d2.phaiThu, d2.phaiTra, d2.chenhLech], [100, 900, -800],
    'mua nhieu hon ban -> chenh lech AM (minh no ho)');

  /* Khong co phat sinh nao. */
  const F3 = new Function('so', 'lam2', 'soChiTietKH', 'soChiTietNCC', 'sql', than + '\nreturn soDoiTac2Chieu;')(
    so, lam2, async () => ({ rows: [] }), async () => ({ rows: [] }), { Int: 'Int' });
  const d3 = await F3(null, 2, CAP);
  bang([d3.rows.length, d3.phaiThu, d3.phaiTra, d3.chenhLech], [0, 0, 0, 0], 'chua co phat sinh -> tat ca bang 0');

  /* ============================================================================================
     2. KHONG viet lai SQL — dung lai 2 so goc
     ============================================================================================ */
  console.log('\n=== 2. Dung lai 2 so goc, khong viet lai cau SQL ===');
  kiem(/await soChiTietKH\(pool, String\(cap\.TenKhachHang \|\| ''\)\.trim\(\)\)/.test(sCongNo),
    'goi lai soChiTietKH (khong tu truy van phieu ban hang)');
  kiem(/await soChiTietNCC\(pool, cap\.NCC_ID\)/.test(sCongNo),
    'goi lai soChiTietNCC (khong tu truy van phieu nhap)');
  kiem(!/FROM PhieuBanHang/.test(bo(sCongNo).slice(bo(sCongNo).indexOf('async function soDoiTac2Chieu'),
    bo(sCongNo).indexOf('async function soDoiTac2Chieu') + 2500)),
    'trong ham 2 chieu KHONG co cau SQL nao doc thang bang chung tu');
  /* Hai so goc phai GIU NGUYEN — khong bi sua de phuc vu ban 2 chieu. */
  kiem(/return \{ khach: ten, rows: rows\.slice\(\)\.reverse\(\), conNo:/.test(sCongNo),
    'so cong no KHACH giu nguyen hop dong tra ve');
  kiem(/return \{ nccId: id, tenNCC: ten\.TenNCC \|\| '', rows: rows\.slice\(\)\.reverse\(\), conNo:/.test(sCongNo),
    'so cong no NCC giu nguyen hop dong tra ve');

  console.log('\n=== 3. Route + quyen ===');
  kiem(/router\.get\('\/doitac',[^\n]*requireChucNang\('CONGNO', 'congnokh'\)/.test(sCongNo),
    'route danh sach doi tac gate quyen CONG NO + chuc nang congnokh');
  kiem(/router\.get\('\/doitac\/chitiet',[^\n]*requireChucNang\('CONGNO', 'congnokh'\)/.test(sCongNo),
    'route so chi tiet cung gate quyen');
  kiem(/async function coCotKhachHangIDcuaNCC\(pool\)/.test(sCongNo),
    'co do cot KhachHangID -> chua chay migration van khong sap route');
  kiem(/chuaChayMigration/.test(sCongNo) && /migration_v696/.test(sCongNo),
    'chua chay migration thi bao ro ten file can chay');

  console.log('\n=== 4. Khai ghep o Danh muc NCC ===');
  kiem(/\{ name: 'KhachHangID', sqlType: sql\.Int, tuyChon: true \}/.test(sDanhMuc),
    'backend danh muc NCC khai cot KhachHangID la TUY CHON');
  kiem(/if \(c\.tuyChon && !\(await coCot\(pool, c\.name\)\)\) continue;/.test(sCrud),
    'crudFactory bo qua cot tuy chon khi CSDL chua co (khong lam vo nut Luu)');
  kiem(/optionsApi: '\/api\/danhmuc\/khachhang'/.test(sFeDanhMuc),
    'form NCC co o CHON tu danh muc khach (khong go tay ten)');
  kiem(/async function napOptions\(fields\)/.test(sFeDanhMuc), 'co bo nap danh sach cho o chon');
  kiem(/catch \(e\) \{ f\.options = \[\{ value: '', label: f\.optionsRong \|\| '— không —' \}\]; \}/.test(sFeDanhMuc),
    'nap danh sach loi -> van mo duoc form (khong chan sua cac o khac)');
  kiem(/type: 'number'/.test(sFeDanhMuc.slice(sFeDanhMuc.indexOf("name: 'KhachHangID'") - 200, sFeDanhMuc.indexOf("name: 'KhachHangID'") + 400)),
    'o chon khai type number -> de trong luu thanh NULL, khong phai chuoi rong');

  console.log('\n=== 5. Bang cong no chung o frontend ===');
  const sachFe = bo(sFeCongNo);
  kiem(/async function soDoiTac2Chieu\(khachHangId, quayLai\)/.test(sachFe), 'co popup so 2 chieu');
  ['Họ nợ mình (phải thu)', 'Mình nợ họ (phải trả)', 'Chênh lệch'].forEach(t =>
    kiem(sFeCongNo.indexOf(t) > 0, `hien so "${t}"`));
  kiem(/<th class="num">Phải thu<\/th><th class="num">Phải trả<\/th>/.test(sFeCongNo),
    'bang co HAI cot tien rieng (khong gop lam mot)');
  kiem(/oSoPhieu\(r\)/.test(sachFe.slice(sachFe.indexOf('async function soDoiTac2Chieu'),
    sachFe.indexOf('async function soDoiTac2Chieu') + 3000)),
    'bam so phieu mo duoc chung tu (dung chung oSoPhieu)');
  kiem(/act-2c/.test(sachFe) && /soDoiTac2Chieu\(b\.dataset\.kh\)/.test(sachFe),
    'bang Cong no khach co nut "2 chieu" cho doi tac da ghep');
  kiem(/e\.stopPropagation\(\)/.test(sachFe.slice(sachFe.indexOf(".act-2c'"), sachFe.indexOf(".act-2c'") + 300)),
    'bam nut khong kich hoat luon link ten khach ben canh');
  kiem(/catch \(e\) \{ return new Map\(\); \}/.test(sachFe),
    'chua chay migration / khong co quyen -> bang cong no van chay nhu cu');
  kiem(/không tự sinh chứng từ bù trừ/.test(sFeCongNo),
    'ghi RO day chi la bang de XEM (bu tru that phai lap phieu thu/chi)');

  console.log('\n=== 6. Migration ===');
  kiem(/ALTER TABLE NhaCungCap ADD KhachHangID INT NULL/.test(sMig), 'migration them cot');
  kiem(/FK_NhaCungCap_KhachHang/.test(sMig), 'co khoa ngoai');
  kiem(/CREATE UNIQUE INDEX UQ_NhaCungCap_KhachHangID/.test(sMig),
    'co chi so DUY NHAT: 1 khach <-> toi da 1 NCC (chong dem tien phai tra hai lan)');
  kiem(/CO KHACH HANG DANG BI GHEP VOI NHIEU HON MOT NHA CUNG CAP/.test(sMig),
    'du lieu dang trung thi LIET KE ra thay vi loi kho hieu');
  kiem(/IF DB_NAME\(\) <> N'QLNoiBo'/.test(sMig), 'chan chay nham database');
  kiem(sCaiDat.indexOf('migration_v696') > 0 || /UQ_NhaCungCap_KhachHangID/.test(sCaiDat),
    'CAI_DAT_DAY_DU.sql da gom migration_v696 (cai moi khong bi thieu)');

  console.log('\n=== 7. Bump ?v= ===');
  [['module.congno.js', 7.81], ['module.danhmuc.js', 7.81]].forEach(([f, min]) => {
    const v = (sIndex.match(new RegExp(f.replace(/\./g, '\\.') + '\\?v=([\\d.]+)')) || [])[1];
    kiem(v && parseFloat(v) >= min, `index.html: ${f}?v= >= ${min}`, String(v));
  });

  console.log('\n================================================================');
  console.log(`KET QUA: ${dat} dat / ${truot} truot`);
  process.exit(truot ? 1 : 0);
})().catch(e => { console.error('LOI TEST: ' + e.stack); process.exit(1); });
