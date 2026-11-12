/* ================================================================================================
   kiem_phi_van_chuyen_vai.js — bo tu kiem cho v9.36
   "Phi van chuyen vai VAO GIA THANH, KHONG VAO CONG NO NCC"

   Nguyen 2026-11-09: "vai nhap ve chua co gia van chuyen. moi NCC gia van chuyen khac nhau. lam the
   nao de dua vao gia thanh tung cay vai ma khong anh huong den cong no NCC" + "gia van chuyen de
   tinh gia thanh san pham".

   🔴 PHEP QUAN TRONG NHAT (muc 2): bieuThucTienCay() va bieuThucTienTraVai() TUYET DOI khong duoc
   nhac toi PhiVanChuyenDonGia. Hai ham do la thuoc do CONG NO NCC; lot phi vao la he thong bao ta
   no nha cung cap ca tien cuoc da tra nha xe. Kiem bang cach CHAY THAT, khong so chuoi.

   Chay:  node backend\utils\kiem_phi_van_chuyen_vai.js
   KHONG copy file nay sang D:\QLSX.
   ================================================================================================ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const GOC = path.join(__dirname, '..', '..');
const doc = (...p) => fs.existsSync(path.join(GOC, ...p)) ? fs.readFileSync(path.join(GOC, ...p), 'utf8') : '';
const tvn = doc('backend', 'utils', 'tienVaiNhap.js');
const khovai = doc('backend', 'routes', 'khovai.js');
const qlsx = doc('backend', 'routes', 'qlsx.js');
const congno = doc('backend', 'routes', 'congno.js');
const baocao = doc('backend', 'routes', 'baocao.js');
const dm = doc('backend', 'routes', 'danhmuc.js');
const feKho = doc('frontend', 'js', 'module.khovai.js');
const feDm = doc('frontend', 'js', 'module.danhmuc.js');
const feQlsx = doc('frontend', 'js', 'module.qlsx.js');
const html = doc('frontend', 'index.html');
const sqlMig = doc('database', 'migration_v888.sql');
const sqlDayDu = doc('database', 'CAI_DAT_DAY_DU.sql');

let sai = 0, dat = 0;
function kiem(ten, dung, td) {
  if (dung) { dat++; console.log('  ✓ ' + ten); }
  else { sai++; console.log('  ❌ ' + ten + (td ? ' — ' + td : '')); }
}

console.log('\n=== 1. BIEN DICH (thay cho node --check) ===');
[['backend/utils/tienVaiNhap.js', tvn], ['backend/routes/khovai.js', khovai],
 ['backend/routes/qlsx.js', qlsx], ['backend/routes/baocao.js', baocao],
 ['backend/routes/danhmuc.js', dm], ['frontend/js/module.khovai.js', feKho],
 ['frontend/js/module.danhmuc.js', feDm], ['frontend/js/module.qlsx.js', feQlsx]
].forEach(([f, s]) => {
  if (!s) { sai++; console.log('  ❌ ' + f + ' KHONG DOC DUOC'); return; }
  try { new vm.Script(s, { filename: f }); dat++; console.log('  ✓ ' + f); }
  catch (e) { sai++; console.log('  ❌ ' + f + ' VO CU PHAP: ' + e.message); }
});

/* require thang module that + pool gia tra ve "co cot" -> bieu thuc sinh ra la ban DAY DU.
   So chuoi tren file nguon thi khong chung minh duoc gi: phai nhin CHINH chuoi SQL sinh ra. */
const T = require('../utils/tienVaiNhap');
const poolCoCot = { request: () => ({ query: async () => ({ recordset: [{ c: 10, a: 10, b: 10 }] }) }) };
const poolKhongCot = { request: () => ({ query: async () => ({ recordset: [{ c: null, a: null, b: null }] }) }) };

/* 🔴 Muc nay CHAY BAT DONG BO (cac bieu thuc la async) nen duoc GOI O CUOI FILE — khong thi ket qua
   cua no in lan vao giua cac muc dong bo, bao cao lon xon thi khong ai tin no nua. */
async function mucRanhGioiTien() {
  console.log('\n=== 8. 🔴 RANH GIOI TIEN: CHAY THAT CAC BIEU THUC ===');
  const tienCay = await T.bieuThucTienCay(poolCoCot, 'vc', 'pn');
  const tienTra = await T.bieuThucTienTraVai(poolCoCot, 'ct', 'vc');
  const phiCay = await T.bieuThucPhiVCCay(poolCoCot, 'vc', 'pn');
  const dgCoPhi = await T.bieuThucDonGiaCoPhiVC(poolCoCot, 'vc');

  kiem('🔴 bieuThucTienCay (CONG NO NCC) KHONG nhac toi PhiVanChuyenDonGia',
       tienCay.indexOf('PhiVanChuyen') < 0,
       'lot phi vao day = he thong bao ta no NCC ca tien cuoc tra nha xe. SQL: ' + tienCay);
  kiem('🔴 bieuThucTienTraVai (TRA VAI VE NCC) KHONG nhac toi PhiVanChuyenDonGia',
       tienTra.indexOf('PhiVanChuyen') < 0,
       'tra hang giam no theo GIA NCC; cuoc da tra nha xe khong doi lai duoc. SQL: ' + tienTra);
  kiem('bieuThucPhiVCCay CO nhac toi PhiVanChuyenDonGia (khong thi phi bang 0 im lang)',
       phiCay.indexOf('PhiVanChuyenDonGia') >= 0, phiCay);
  kiem('bieuThucDonGiaCoPhiVC CO cong ca DonGiaNhap lan PhiVanChuyenDonGia',
       dgCoPhi.indexOf('DonGiaNhap') >= 0 && dgCoPhi.indexOf('PhiVanChuyenDonGia') >= 0, dgCoPhi);

  /* Chua chay migration -> phai LUI VE ban cu, KHONG duoc nem loi va KHONG duoc dua ten cot moi
     vao cau SQL ("Invalid column name" lam trang ca man hinh — bai hoc o dau tienVaiNhap.js). */
  const phiKhong = await T.bieuThucPhiVCCay(poolKhongCot, 'vc', 'pn');
  const dgKhong = await T.bieuThucDonGiaCoPhiVC(poolKhongCot, 'vc');
  kiem('🔴 chua co cot -> bieuThucPhiVCCay tra "0", khong co ten cot moi',
       phiKhong === '0', phiKhong);
  kiem('🔴 chua co cot -> bieuThucDonGiaCoPhiVC lui ve chi DonGiaNhap',
       dgKhong.indexOf('PhiVanChuyen') < 0 && dgKhong.indexOf('DonGiaNhap') >= 0, dgKhong);

  console.log('\n=== 2b. 🔴 KHONG CACHE ket qua do cot ===');
  /* Cache song qua migration = man nhap phieu va gia thanh doc hai trang thai khac nhau. Kiem bang
     HANH VI: goi lan 1 voi pool "khong co cot", lan 2 voi pool "co cot" — ket qua PHAI doi. */
  const lan1 = await T.coCotPhiVanChuyen(poolKhongCot);
  const lan2 = await T.coCotPhiVanChuyen(poolCoCot);
  kiem('🔴 coCotPhiVanChuyen KHONG cache (doi pool thi ket qua doi theo)',
       lan1 === false && lan2 === true, `lan1=${lan1} lan2=${lan2}`);

  console.log('\n=== 2c. DON GIA PHI CUA NCC chi ap khi DON VI KHOP ===');
  const khop = T.phiVCTheoNCC({ PhiVanChuyenDonGia: 2000, PhiVanChuyenDVT: 'Kg' }, 'Kg');
  kiem('don vi KHOP -> ap dung don gia', khop.donGia === 2000 && !khop.lyDo, JSON.stringify(khop));
  const lech = T.phiVCTheoNCC({ PhiVanChuyenDonGia: 2000, PhiVanChuyenDVT: 'Kg' }, 'Met');
  kiem('🔴 don vi LECH (NCC khai d/kg, phieu tinh theo met) -> KHONG ap, co noi ly do',
       lech.donGia === 0 && /kg|met|mét/i.test(lech.lyDo),
       'nhan 2.000d/kg voi so MET la sai lang le. ' + JSON.stringify(lech));
  const chuaKhai = T.phiVCTheoNCC({ PhiVanChuyenDonGia: null, PhiVanChuyenDVT: null }, 'Kg');
  kiem('NCC chua khai -> 0, co ly do', chuaKhai.donGia === 0 && !!chuaKhai.lyDo, JSON.stringify(chuaKhai));
  kiem('NCC = null (phieu khong chon NCC) -> khong vo',
       T.phiVCTheoNCC(null, 'Kg').donGia === 0);

  console.log('\n=== 2d. donGiaCoPhiVC (ban JS, dung o tinhGiaThanh) ===');
  kiem('cong dung hai thanh phan',
       T.donGiaCoPhiVC({ DonGiaNhap: 80000, PhiVanChuyenDonGia: 2000 }) === 82000);
  kiem('thieu phi -> bang dung don gia hang',
       T.donGiaCoPhiVC({ DonGiaNhap: 80000 }) === 80000);
  kiem('thieu ca hai -> 0, khong NaN', T.donGiaCoPhiVC({}) === 0 && T.donGiaCoPhiVC(null) === 0);
}

console.log('\n=== 2e. CAC DIEM RA SOAT CHEO BAT DUOC (v9.36) ===');
kiem('🔴 co co do cot RIENG cho bang NhaCungCap (migration chay do khong lam chet duong nhap phieu)',
     /async function coCotPhiVCNhaCungCap\(pool\)/.test(tvn)
       && /COL_LENGTH\('NhaCungCap','PhiVanChuyenDonGia'\)/.test(tvn),
     'dung chung co cua VaiCay: VaiCay co cot ma NhaCungCap chua => SELECT nem Invalid column name '
       + '=> catch cua route => KHONG lap duoc phieu nhap kho vai nao');
kiem('ca hai duong ghi deu gac bang co rieng do',
     (khovai.match(/await coCotPhiVCNhaCungCap\(pool\)/g) || []).length === 2,
     'dem duoc ' + (khovai.match(/await coCotPhiVCNhaCungCap\(pool\)/g) || []).length);
kiem('🔴 chan doi DonViTinhGia khi phieu da khai phi (phi la ban chup theo don vi cu)',
     /SoCayCoPhi/.test(khovai) && /res\.status\(409\)/.test(khovai),
     'doi Kg sang Met la phi 2.000d\\/kg bi nhan voi so MET — sai gia thanh 2-4 lan, lang le');
kiem('🔴 lyDo cua phiVCTheoNCC duoc TRA RA cho nguoi dung, khong nuot im lang',
     /phiVCLyDo: phiNCC\.lyDo/.test(khovai) && /phiVCLyDo: phiNCCSua\.lyDo/.test(khovai)
       && (feKho.match(/phiVCLyDo/g) || []).length >= 2,
     'nuot = nguoi dung khai phi o NCC, nhap hang, tuong da co phi ma cay that ra = 0');
kiem('CA BA duong ghi dung CHUNG chuanPhiVC (khong moi cho mot luat)',
     /chuanPhiVC\(roll && roll\.phiVanChuyenDonGia\)/.test(khovai)
       && /chuanPhiVC\(line && line\.phiVanChuyenDonGia\)/.test(khovai)
       && /coGui\('phiVanChuyenDonGia'\) \? phiCuaDongSua\(line\)/.test(khovai),
     'nhanh sua cay co san tung nhan ca SO AM (phi am lam GIAM gia thanh)');
kiem('chuanPhiVC: tra undefined khi de trong, 0 khi go 0, null khi am/rac',
     T.chuanPhiVC('') === undefined && T.chuanPhiVC(null) === undefined
       && T.chuanPhiVC('0') === 0 && T.chuanPhiVC('-5') === null && T.chuanPhiVC('abc') === null
       && T.chuanPhiVC('2000') === 2000);
kiem('🔴 danh muc NCC: hai cot co khongGuiThiGiu (form cu trong cache khong xoa trang phi)',
     /name: 'PhiVanChuyenDonGia'[^}]*khongGuiThiGiu: true/.test(dm)
       && /name: 'PhiVanChuyenDVT'[^}]*khongGuiThiGiu: true/.test(dm),
     'thieu = may nao con ban cu sua ten NCC la xoa sach don gia van chuyen, im lang (bai hoc AnhMau v8.94)');
kiem('🔴 cot DVT co rongThanhNull (chuoi rong vi pham CHECK => chet ca man danh muc NCC)',
     /name: 'PhiVanChuyenDVT'[^}]*rongThanhNull: true/.test(dm)
       && /c\.rongThanhNull && typeof v === 'string'/.test(doc('backend', 'utils', 'crudFactory.js')));
/* Dem <col> vs <th> cua hai bang nhap lieu — phep re ma bat duoc ngay chuyen lech cot. */
['COLS_SUA', 'COLS_NHAP'].forEach((ten, i) => {
  const headTen = i === 0 ? 'HEAD_SUA' : 'HEAD_NHAP';
  const kCol = feKho.slice(feKho.indexOf('const ' + ten), feKho.indexOf('const ' + headTen));
  const kHead = feKho.slice(feKho.indexOf('const ' + headTen));
  const soCol = (kCol.match(/<col /g) || []).length;
  const soTh = ((kHead.slice(0, kHead.indexOf('</tr></thead>')).match(/<th[ >]/g)) || []).length;
  kiem(`🔴 ${ten}: so <col> (${soCol}) == so <th> cua ${headTen} (${soTh})`, soCol === soTh,
       'lech la cot cuoi an nham width cua nut X (42px) — o nhap phi bi bop con 42px');
});

console.log('\n=== 3. CONG NO NCC: khong mot dong nao doc cot phi ===');
/* Loc comment truoc khi kiem "KHONG chua X" — chinh cau ghi chu giai thich luat lai lam phep do
   (feedback_qlnoibo_bo_tu_kiem_phai_loc_comment, da vap 4 lan). */
const boComment = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
kiem('🔴 routes/congno.js KHONG he nhac PhiVanChuyen',
     boComment(congno).indexOf('PhiVanChuyen') < 0,
     'cong no NCC ma doc cot phi la sai dung yeu cau cua Nguyen');
kiem('🔴 muc B "Phai tra NCC" cua baocao.js dung bieuThucTienCay (khong cong phi)',
     /SUM\(\$\{await bieuThucTienCay\(pool, 'vc', 'pn'\)\}\)/.test(baocao));

console.log('\n=== 4. GIA THANH: co cong phi, co do cot, co GROUP BY ===');
kiem('qlsx.js nap coCotPhiVanChuyen', /coCotPhiVanChuyen \} = require\('\.\.\/utils\/tienVaiNhap'\)/.test(qlsx));
kiem('tinhGiaThanh cong phi vao don gia', /const dg = dgHang \+ dgPhi;/.test(qlsx));
kiem('🔴 chua co cot -> SELECT tra 0, KHONG dua ten cot moi vao cau SQL',
     /CAST\(0 AS DECIMAL\(14,2\)\) AS PhiVanChuyenDonGia/.test(qlsx));
kiem('🔴 co cot thi PHAI them vao GROUP BY (khong thi SQL loi "not contained in aggregate")',
     /GROUP BY[^`]*\$\{coPhiVCGT \? ', vc\.PhiVanChuyenDonGia' : ''\}/.test(qlsx));
kiem('tra ve DonGiaHang/DonGiaPhiVC de man hinh noi duoc phi nam o dau',
     /DonGiaHang: dgHang, DonGiaPhiVC: dgPhi/.test(qlsx));
kiem('bang gia thanh hien dong "gom phi VC"', /gồm phí VC/.test(feQlsx));

console.log('\n=== 5. GHI PHI: ca TAO lan SUA phieu nhap ===');
kiem('POST /nhap do cot + chan khi chua chay migration',
     /const coPhiVC = await coCotPhiVanChuyen\(pool\);/.test(khovai)
       && /Chưa chạy migration_v888/.test(khovai));
kiem('PUT /nhap cung do cot', /const coPhiVCSua = await coCotPhiVanChuyen\(pool\);/.test(khovai));
kiem('🔴 CA BA duong ghi deu ghep cot (tao moi / sua dong co san / them dong vao phieu dang sua)',
     (khovai.match(/PhiVanChuyenDonGia/g) || []).length >= 8,
     'dem duoc ' + (khovai.match(/PhiVanChuyenDonGia/g) || []).length);
kiem('🔴 nhanh SUA dung luat `coGui` (form cu khong gui thi GIU NGUYEN phi)',
     /dat\('PhiVanChuyenDonGia', 'phiVanChuyenDonGia'\)/.test(khovai),
     'ghi de mu = moi lan sua phieu bang ban cu la xoa sach phi ca phieu (dung loi v6.58 voi ViTriKho)');
kiem('GET /nhap/:id tra ve cot phi de form Sua dien san',
     /coPhiVCDoc \? 'v\.PhiVanChuyenDonGia'/.test(khovai));
kiem('🔴 frontend gui NGUYEN gia tri o, khong `|| null` (so 0 = co y khong co cuoc)',
     !/phiVanChuyenDonGia: r\.querySelector\('\.r-phivc'\)\.value \|\| null/.test(feKho)
       && (feKho.match(/phiVanChuyenDonGia: r\.querySelector\('\.r-phivc'\)\.value/g) || []).length >= 3,
     'dem duoc ' + (feKho.match(/phiVanChuyenDonGia: r\.querySelector\('\.r-phivc'\)\.value/g) || []).length);
kiem('form SUA dien san phi cu (khong thi moi lan sua la phi bi ghi de theo NCC)',
     /value="\$\{line && line\.PhiVanChuyenDonGia != null \? line\.PhiVanChuyenDonGia : ''\}"/.test(feKho));
kiem('ban nhap (draft) khoi phuc duoc o phi', /\.r-phivc'\)\.value = d\.phiVanChuyenDonGia/.test(feKho));

console.log('\n=== 6. DANH MUC NCC ===');
kiem('backend khai 2 cot tuy chon (do cot san co, khong tu viet)',
     /name: 'PhiVanChuyenDonGia', sqlType: sql\.Decimal\(14, 2\), tuyChon: true/.test(dm)
       && /name: 'PhiVanChuyenDVT', sqlType: sql\.NVarChar\(10\), tuyChon: true/.test(dm));
kiem('frontend co 2 o, o DVT dung dang mang {value,label} cua bo dung o chung',
     /name: 'PhiVanChuyenDonGia'/.test(feDm)
       && /\{ value: 'Met', label: 'Mét' \}/.test(feDm));
/* 🔴 Bay da lam SAP production o v8.06: cu phap comment-trong-template chi hop le BEN TRONG mot
   template literal. Mang `fields` cua module.danhmuc.js la JS THUAN, dat cu phap do vao la
   SyntaxError. Muc 1 cung bat loi nay (vm.Script ca file), nhung phep duoi chi dich danh mang
   fields nen bao loi NOI RO CHO, khoi phai do lai tu thong bao cua trinh bien dich.
   (Co y KHONG viet lai nguyen van cu phap do o day: viet cap dau dong comment trong comment la
   vo chinh file nay — bai hoc v8.61.) */
const khoiFields = feDm.slice(feDm.indexOf("key: 'nhacungcap'"), feDm.indexOf("key: 'khachhang'"));
kiem('🔴 khoi fields cua NCC KHONG co `${...}` (JS thuan, khong phai template literal)',
     khoiFields.indexOf('${') < 0,
     'dat ${/* */\'\'} ngoai template literal = SyntaxError, da sap production o v8.06');

console.log('\n=== 7. MIGRATION + BUMP ===');
kiem('co database/migration_v888.sql', !!sqlMig);
kiem('them du 3 cot',
     /ALTER TABLE NhaCungCap ADD PhiVanChuyenDonGia DECIMAL\(14,2\) NULL;/.test(sqlMig)
       && /ALTER TABLE NhaCungCap ADD PhiVanChuyenDVT NVARCHAR\(10\) NULL;/.test(sqlMig)
       && /ALTER TABLE VaiCay ADD PhiVanChuyenDonGia DECIMAL\(14,2\) NULL;/.test(sqlMig));
kiem('co rang buoc CHECK chi nhan Kg/Met/NULL',
     /CHECK \(PhiVanChuyenDVT IS NULL OR PhiVanChuyenDVT IN \(N'Kg', N'Met'\)\)/.test(sqlMig));
kiem('chay lai nhieu lan khong hong', (sqlMig.match(/IF COL_LENGTH\(/g) || []).length >= 3);
kiem('KHONG xoa/sua du lieu nghiep vu nao',
     !/DELETE FROM/i.test(sqlMig) && !/DROP TABLE/i.test(sqlMig) && !/UPDATE VaiCay/i.test(sqlMig));
kiem('🔴 DA GOP vao CAI_DAT_DAY_DU.sql',
     /PhiVanChuyenDonGia/.test(sqlDayDu) && /migration_v888\.sql/.test(sqlDayDu));
['khovai', 'danhmuc', 'qlsx'].forEach(m => {
  const mm = html.match(new RegExp('module\\.' + m + '\\.js\\?v=([\\d.]+)'));
  kiem(`index.html bump module.${m}.js?v >= 9.36`, !!mm && parseFloat(mm[1]) >= 9.36,
       mm ? mm[1] : '(khong thay)');
});

function ketLuan() {
  console.log('\n' + '='.repeat(70));
  console.log(sai === 0 ? `✅ ${dat} phep DAT, 0 sai` : `❌ ${sai} SAI / ${dat + sai} phep`);
  console.log('='.repeat(70) + '\n');
  process.exit(sai === 0 ? 0 : 1);
}

/* Muc 8 chay sau cung, roi moi ket luan. */
mucRanhGioiTien()
  .then(ketLuan)
  .catch(e => { kiem('chay duoc cac bieu thuc o muc 8', false, e.message); ketLuan(); });
