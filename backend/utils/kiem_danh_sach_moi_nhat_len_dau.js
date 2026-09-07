/* ================================================================================================
   KIEM CHUNG v7.79 — DANH SACH DE NGAY MOI NHAT LEN TREN CUNG
   ------------------------------------------------------------------------------------------------
   Nguyen: "ra soat lai het cac danh sach deu de ngay moi nhat len tren cung".

   Ra 297 cau ORDER BY, trong do 17 cau con sap theo NGAY TANG. KHONG dao het duoc — phai phan loai:

   ĐÃ ĐẢO (mới nhất lên đầu):
     · 3 SO CHI TIET o baocao.js (the kho hang hoa / vai / phu kien) — co cot `TonLuyKe` nen phai
       CONG THEO CHIEU TANG ROI DAO MANG, tuyet doi khong doi `rows.sort` hay `ORDER BY` sang giam.
     · dms.js — Lich di tuyen theo thang, va "Da ghi nhan hom nay".

   CO Y GIU TANG (dao la SAI, muc 3 duoi khoa lai):
     · khovai.js ×4 — lich su 1 cay vai. Nguyen da noi 2026-09-05: vai quan theo TUNG CAY, het cay
       la sang cay khac, khong can ton luy ke ⇒ "khong can" dao.
     · dms.js lo trinh — la CHUOI HANH TRINH de ve duong di tren ban do, dao la duong di lon nguoc.
     · qlsx.js tien do san xuat — chuoi cong doan theo thoi gian.
     · qlsx.js chi tiet vai da xuat cho 1 don — du lieu NOI BO dung cho ban in Lenh SX.
     · payroll.js cham cong — bang nhap tay theo lich ngay 1→31 cua thang.
     · phukien.js — da dao o TANG JS tu v7.69 (khong dao SQL, vi cung co ton luy ke).

   Chay:  node utils/kiem_danh_sach_moi_nhat_len_dau.js
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

const sBaoCao = doc('routes/baocao.js');
const sDms = doc('routes/dms.js');
const sKhoVai = doc('routes/khovai.js');
const sQlsx = doc('routes/qlsx.js');
const sPayroll = doc('routes/payroll.js');
const sPhuKien = doc('routes/phukien.js');

/* Tach cac cau SQL (khoi template literal) de soi tung cau, khong soi ca file. */
const cacCauSql = (src) => String(src).split('`').filter((_, i) => i % 2 === 1);

/* ================================================================================================
   1. CHAY THAT phan "cong luy ke roi dao" cua 3 so chi tiet
   Cat doan tu `let luy =` den `rows.reverse();` ra chay voi du lieu gia.
   ================================================================================================ */
console.log('\n=== 1. CHAY THAT: 3 so chi tiet — cong luy ke theo chieu TANG roi DAO ===');
function catDoanLuyKe(src, tuViTri) {
  const i = src.indexOf('let luy =', tuViTri);
  if (i < 0) return null;
  const j = src.indexOf('rows.reverse();', i);
  if (j < 0) return null;
  return { doan: src.slice(i, j + 'rows.reverse();'.length), ketThuc: j };
}
const lam2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const so = (n) => Number(n) || 0;

/* rows DA sap theo ngay TANG (dung nhu luc route chay tiep sau `rows.sort`). */
const duLieu = () => ([
  { Ngay: '2026-09-01', Nhap: 100, Xuat: 0 },
  { Ngay: '2026-09-03', Nhap: 0, Xuat: 30 },
  { Ngay: '2026-09-05', Nhap: 50, Xuat: 0 },
  { Ngay: '2026-09-07', Nhap: 0, Xuat: 20 }
]);

let viTri = 0, soSo = 0;
for (let k = 0; k < 5; k++) {
  const c = catDoanLuyKe(sBaoCao, viTri);
  if (!c) break;
  viTri = c.ketThuc + 1;
  soSo++;
  const rows = duLieu();
  const f = new Function('rows', 'lam2', 'so', 'dongTong', 'dau', c.doan + '\nreturn rows;');
  const ra = f(rows, lam2, so, { TonDau: 200 }, { TonDau: 200 });
  bang(ra.map(r => r.Ngay), ['2026-09-07', '2026-09-05', '2026-09-03', '2026-09-01'],
    `so #${soSo}: ngay MOI NHAT lên dau`);
  /* Ton luy ke: 200 -> 300 -> 270 -> 320 -> 300. Hien thi nguoc lai. */
  bang(ra.map(r => r.TonLuyKe), [300, 320, 270, 300],
    `so #${soSo}: TonLuyKe van dung tung dong (khong bi cong nguoc)`);
  bang(ra[0].TonLuyKe, 300, `so #${soSo}: dong TREN CUNG = ton cuoi ky (200+100-30+50-20)`);
  bang(ra[ra.length - 1].TonLuyKe, 300, `so #${soSo}: dong CUOI = ton sau phat sinh dau tien`);
  /* Tinh lai doc lap theo chieu tang. */
  const theoTG = ra.slice().reverse();
  let l = 200;
  bang(theoTG.map(r => r.TonLuyKe), theoTG.map(r => (l = lam2(l + so(r.Nhap) - so(r.Xuat)))),
    `so #${soSo}: tinh lai doc lap theo chieu tang -> khop tung dong`);
}
bang(soSo, 3, 'co DUNG 3 so chi tiet duoc dao (the kho hang hoa / vai / phu kien)');

console.log('\n=== 2. Ma nguon 3 so: KHONG duoc doi chieu sap xep ===');
kiem((sBaoCao.match(/rows\.reverse\(\)/g) || []).length === 3, '3 so deu co rows.reverse()',
  String((sBaoCao.match(/rows\.reverse\(\)/g) || []).length));
/* `rows.sort` phai con TANG (a - b). Dao o day la cot luy ke sai. */
/* ⚠️ Mau phai chap nhan ca dang co dieu kien phu (`|| String(a.SoPhieu)...`) — ban dau toi doi dong
   `.sort(...)` ket thuc ngay bang `)` nen chi thay 2/3 cho, bao SAI oan so phu kien. */
const cacSort = sBaoCao.match(/\.sort\(\(a, b\) => new Date\([ab]\.Ngay\) - new Date\([ab]\.Ngay\)/g) || [];
kiem(cacSort.length === 3 && cacSort.every(s => /new Date\(a\.Ngay\) - new Date\(b\.Ngay\)/.test(s)),
  'ca 3 cho sort van TANG (a - b) — khong doi thanh (b - a)', cacSort.join(' | '));
/* Va reverse phai dung SAU khi tinh luy ke. */
[/r\.TonLuyKe = luy; \}\);\s*(?:\/\*[\s\S]*?\*\/\s*)?rows\.reverse\(\)/].forEach(re =>
  kiem((sBaoCao.match(new RegExp(re.source, 'g')) || []).length === 3,
    'reverse() dung NGAY SAU vong tinh TonLuyKe o ca 3 so',
    String((sBaoCao.match(new RegExp(re.source, 'g')) || []).length)));
/* Cac cau SQL cua 3 so van khong DESC theo ngay. */
const cauSoBC = cacCauSql(bo(sBaoCao)).filter(q => /ORDER BY/.test(q) && /(NgayNhap|NgayBan|NgayXuat|ThoiGian|p\.Ngay)/.test(q));
kiem(cauSoBC.length >= 6, 'tim duoc cac cau SQL cua 3 so', String(cauSoBC.length));
kiem(!cauSoBC.some(q => /ORDER BY[^)]*(NgayNhap|NgayBan|NgayXuat|ThoiGian|Ngay)[^)]*DESC/.test(q)),
  'KHONG cau nao doi ORDER BY sang DESC (giu chieu cong luy ke)');

console.log('\n=== 3. DA DAO: 2 danh sach cua DMS ===');
const sachDms = bo(sDms);
kiem(/ORDER BY l\.Ngay DESC, nv\.HoTen/.test(sachDms), 'Lich di tuyen theo thang: ngay moi nhat len dau');
kiem(/ORDER BY g\.ThoiGianVao DESC/.test(sachDms), '"Da ghi nhan hom nay": lan ghe moi nhat len dau');

console.log('\n=== 4. CO Y GIU TANG — dao la SAI (khoa lai keo lan sau "lam cho dong bo") ===');
/* Lich su 1 cay vai: Nguyen da noi khong can dao (vai quan theo tung cay). */
[['ORDER BY px.NgayXuat, px.PhieuXuatID', 'khovai: phieu xuat cua 1 cay'],
  ['ORDER BY p.NgayXuat', 'khovai: xuat vat tu cua 1 cay'],
  ['ORDER BY kk.NgayKiem', 'khovai: kiem ke cua 1 cay'],
  ['ORDER BY td.NgayGhiNhan', 'khovai: so cat cua 1 cay']
].forEach(([ch, ten]) => kiem(bo(sKhoVai).indexOf(ch) > 0, `${ten} — GIU tang`));
kiem(/ORDER BY g\.NhanVienID, g\.ThoiGianVao/.test(sachDms),
  'DMS lo trinh — GIU tang (dao la duong di tren ban do lon nguoc)');
kiem(/ORDER BY td\.NgayGhiNhan, td\.ThoiGianNhap/.test(bo(sQlsx)),
  'QLSX tien do san xuat — GIU tang (chuoi cong doan theo thoi gian)');
kiem(/ORDER BY px\.NgayXuat, ct\.ID/.test(bo(sQlsx)),
  'QLSX chi tiet vai da xuat 1 don — GIU tang (du lieu noi bo cho ban in)');
kiem(/ORDER BY Ngay`/.test(bo(sPayroll)) || /MONTH\(Ngay\)=@t ORDER BY Ngay/.test(bo(sPayroll)),
  'Cham cong — GIU tang (bang nhap tay theo lich ngay 1→31)');
/* Phu kien: dao o TANG JS tu v7.69, SQL van tang. */
kiem(/ORDER BY p\.Ngay, p\.PhieuID/.test(bo(sPhuKien)), 'Phu kien: SQL van tang');
kiem(/rows\.reverse\(\)/.test(doc('utils/lichSuPhuKien.js')), 'Phu kien: dao o tang JS (v7.69)');

console.log('\n=== 5. Khong con danh sach nao bi bo sot ===');
/* Dem lai: cau ORDER BY co cot ngay ma khong DESC -> phai nam trong danh sach CO Y GIU o tren. */
const CHO_PHEP_TANG = [
  'ORDER BY px.NgayXuat, px.PhieuXuatID', 'ORDER BY p.NgayXuat', 'ORDER BY kk.NgayKiem',
  'ORDER BY td.NgayGhiNhan', 'ORDER BY g.NhanVienID, g.ThoiGianVao',
  'ORDER BY td.NgayGhiNhan, td.ThoiGianNhap', 'ORDER BY px.NgayXuat, ct.ID',
  'ORDER BY Ngay', 'ORDER BY p.Ngay, p.PhieuID',
  /* 3 so chi tiet cua baocao.js: co y tang vi cong luy ke, da dao o tang JS (muc 1). */
  'ORDER BY p.NgayNhap, p.SoPhieu', 'ORDER BY p.NgayBan, p.PhieuBHID', 'ORDER BY d.ThoiGian',
  'ORDER BY c.NgayNhap, c.CayID'
];
const conTang = [];
[['baocao.js', sBaoCao], ['dms.js', sDms], ['khovai.js', sKhoVai], ['qlsx.js', sQlsx],
  ['payroll.js', sPayroll], ['phukien.js', sPhuKien]].forEach(([ten, src]) => {
    cacCauSql(bo(src)).forEach(q => {
      /* ⚠️ KHONG cat bang [^)]: `ORDER BY CAST(r.ThoiGian AS DATE) DESC` se bi cat ngay o dau ")"
         dau tien, mat luon chu DESC -> bao SAI oan (da vap). Cat den HET DONG. */
      const m = q.match(/ORDER BY [^\n]{0,120}/);
      if (!m) return;
      const ob = m[0].replace(/\s+/g, ' ').trim().replace(/`.*$/, '');
      if (!/ngay|thoigian|createdat|capnhat/i.test(ob)) return;
      if (/DESC/i.test(ob)) return;
      if (CHO_PHEP_TANG.some(x => ob.indexOf(x) === 0)) return;
      conTang.push(`${ten}: ${ob}`);
    });
  });
kiem(conTang.length === 0,
  'khong con cau ORDER BY theo ngay TANG nao ngoai danh sach CO Y GIU',
  conTang.join(' | '));

/* ================================================================================================
   5b. v7.80 — BIT LO HONG CUA BO QUET: co SO sap bang JS, KHONG qua ORDER BY.
   ⚠️ Muc 5 o tren chi soi cac cau `ORDER BY`, nen SO QUY (congno.js) bi BO SOT: no lay phieu thu/chi
   bang 2 cau khong co ORDER BY roi `.sort()` o tang JS. Nguyen phai bao lai moi phat hien.
   Nay quet CA hai duong: moi cho `.sort((a, b) => new Date(...))` TANG trong backend deu phai co
   `reverse()` ngay sau vong tinh luy ke — tru cac cho co y giu tang.
   ================================================================================================ */
console.log('\n=== 5b. Cac SO sap bang JS (lo hong da lam bo sot so quy) ===');
const SO_SAP_JS = [
  ['routes/congno.js', 'so chi tiet cong no KHACH'],
  ['routes/congno.js', 'so chi tiet cong no NCC'],
  ['routes/congno.js', 'SO QUY chi tiet'],
  ['routes/congno.js', 'so cong no NHA GIA CONG'],
  ['routes/baocao.js', 'the kho hang hoa'],
  ['routes/baocao.js', 'the kho vai'],
  ['routes/baocao.js', 'the kho phu kien']
];
const sCongNo2 = doc('routes/congno.js');
/* Dem: moi cho sap TANG theo ngay phai di kem mot lan dao chieu. */
const demSapTang = (src) => (src.match(/\.sort\(\(a, b\) => new Date\(a\./g) || []).length;
const demDao = (src) => (src.match(/rows\.slice\(\)\.reverse\(\)|rows\.reverse\(\)/g) || []).length;
bang(demSapTang(bo(sCongNo2)), 4, 'congno.js: co 4 so sap tang theo ngay');
bang(demDao(bo(sCongNo2)), 4, 'congno.js: CA 4 so deu co dao chieu (truoc v7.80 chi co 3 — sot so quy)');
bang(demSapTang(bo(sBaoCao)), 3, 'baocao.js: co 3 so sap tang theo ngay');
bang(demDao(bo(sBaoCao)), 3, 'baocao.js: ca 3 so deu co dao chieu');
kiem(SO_SAP_JS.length === 7, 'tong 7 so co so du luy ke — tat ca da mo i nhat len dau');

/* Rieng SO QUY: kiem tan goc cau tra ve. */
kiem(/data: \{ ten, dauKy, rows: rows\.slice\(\)\.reverse\(\), soDu:/.test(sCongNo2),
  'SO QUY tra ve rows DA DAO (moi nhat len dau)');
kiem(/rows\.forEach\(r => \{ luy \+= so\(r\.Thu\) - so\(r\.Chi\); r\.SoDu = /.test(sCongNo2),
  'SO QUY van cong SoDu theo chieu TANG truoc khi dao (khong doi .sort sang giam)');
kiem(/new Date\(a\.Ngay\) - new Date\(b\.Ngay\) \|\| String\(a\.SoPhieu\)/.test(sCongNo2),
  'SO QUY: .sort van (a - b) — cung ngay thi theo so phieu, giu on dinh thu tu');
/* Ban in SO KE TOAN doc tu tren xuong nen phai lat lai — va viec lat chi lam o MOT cho. */
kiem(/const tatCa = \(opt\.rows \|\| \[\]\)\.slice\(\)\.reverse\(\);/.test(sCongNo2),
  'ban in So ke toan tu lat lai CU->MOI (khong bi anh huong boi viec dao o man hinh xem)');

console.log('\n=== 6. Frontend khong sap lai lam mat tac dung ===');
/* So quy chi tiet o frontend chi map ra bang, khong tu sap lai. */
const sFeCongNo = bo(doc('../frontend/js/module.congno.js'));
const thanQuy = sFeCongNo.slice(sFeCongNo.indexOf('async function soChiTietQuy'),
  sFeCongNo.indexOf('async function soChiTietQuy') + 1800);
kiem(!/\.sort\(|\.reverse\(/.test(thanQuy),
  'FE so quy chi tiet KHONG tu sap/dao lai (giu dung thu tu backend tra ve)');
['module.baocao.js', 'module.dms.js'].forEach(f => {
  const s = bo(doc('../frontend/js/' + f));
  const sapNgay = (s.match(/\.sort\([^)]*[Nn]gay[^)]*\)/g) || [])
    .filter(x => /new Date\(a\./.test(x));   // (a - b) = tang -> se lam mat tac dung
  kiem(sapNgay.length === 0, `${f}: khong tu sap lai theo ngay tang`, sapNgay.join(' | '));
});

console.log('\n================================================================');
console.log(`KET QUA: ${dat} dat / ${truot} truot`);
process.exit(truot ? 1 : 0);
