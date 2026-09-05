/* ================================================================================================
   KIEM CHUNG v7.60 — "TAI ANH O PHIEU NHAP KHO MA SANG THE KHO KHONG THAY ANH"
   ------------------------------------------------------------------------------------------------
   Ba lo hong tim ra (moi cai deu cho ra DUNG mot trieu chung, nen phai bit ca ba):

   (1) BACKEND — taoTheKhoTuDong() bo qua ca ANH DAI DIEN khi dong thieu mau.
       Ban cu: `if (!d.maHangId || !d.mauSacId) continue;` ngay dau vong lap. Anh dai dien la cua
       MA HANG, khong lien quan mau -> dong thieu mau lam mat luon anh cua ca ma do, am tham.

   (2) GIAO DIEN PHIEU NHAP — ma DA CO trong danh muc thi KHONG CO O NAO de tai anh dai dien.
       O do nam trong "dong khai", ma dong khai chi hien voi ma MOI (v6.99). Nguoi dung tai duoc moi
       anh mau roi ket luan "anh khong len the kho" — dung, vi khong he co duong tai len.

   (3) MO THE KHO TU PHIEU — moTheKhoTheoMa() truyen `null` = form TAO MOI cho ma DA CO. Form tao moi
       khong co `row` nen khong doc duoc AnhDaiDien dang luu -> o anh hien TRONG du CSDL co anh.
       Chinh ghi chu v6.86 ngay tren do da noi phai mo form SUA.

   Chay:  node utils/kiem_anh_nhap_kho_the_kho.js
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

const sNK = doc('routes/nhapkho.js');
const sTKM = doc('utils/theKhoMau.js');
const sFeNK = doc('../frontend/js/module.nhapkho.js');
const sFeKH = doc('../frontend/js/module.khohang.js');
const sSoi = doc('utils/soi_anh_the_kho.js');
const sIndex = doc('../frontend/index.html');
const sCaiDat = doc('../database/CAI_DAT_DAY_DU.sql');

function catTuNgoac(src, moc) {
  const i = src.indexOf(moc);
  if (i < 0) return null;
  const mo = src.indexOf('{', i);
  if (mo < 0) return null;
  let sau = 1, j = mo + 1, ch = null;
  for (; j < src.length && sau > 0; j++) {
    const c = src[j];
    if (ch) { if (c === ch && src[j - 1] !== '\\') ch = null; continue; }
    if (c === "'" || c === '"' || c === '`') { ch = c; continue; }
    if (c === '{') sau++; else if (c === '}') sau--;
  }
  if (sau !== 0) return null;
  while (j < src.length && (src[j] === ')' || src[j] === ';')) j++;
  return src.slice(i, j);
}

/* ================================================================================================
   1. CHAY THAT taoTheKhoTuDong() — anh dai dien khong duoc mat vi dong thieu mau
   ================================================================================================ */
console.log('\n=== 1. CHAY THAT taoTheKhoTuDong() ===');
const mHam = catTuNgoac(sNK, 'async function taoTheKhoTuDong(');
kiem(!!mHam, 'cat duoc taoTheKhoTuDong tu routes/nhapkho.js');

async function chay(dsGhi) {
  const ghi = { anhDaiDien: [], dongMau: [] };
  const f = new Function('damBaoDongMau', 'capNhatAnhDaiDien', `
    ${mHam}
    return taoTheKhoTuDong;`)(
    async (pool, tran, mh, ms, anh) => { ghi.dongMau.push({ mh, ms, anh: anh || null }); return true; },
    async (pool, tran, mh, anh) => { ghi.anhDaiDien.push({ mh, anh }); return true; }
  );
  const kq = await f({}, {}, dsGhi);
  return { ghi, kq };
}

(async () => {
  if (mHam) {
    /* a) Dong binh thuong: ghi ca anh mau lan anh dai dien. */
    let r = await chay([{ maHangId: 5, mauSacId: 2, anhMau: '/uploads/a.jpg', anhDaiDien: '/uploads/dd.jpg' }]);
    bang(r.ghi.anhDaiDien, [{ mh: 5, anh: '/uploads/dd.jpg' }], 'dong du mau -> ghi anh dai dien');
    bang(r.ghi.dongMau, [{ mh: 5, ms: 2, anh: '/uploads/a.jpg' }], 'va ghi anh mau');

    /* b) BAY CHINH: dong THIEU MAU van phai ghi anh dai dien cua ma. */
    r = await chay([{ maHangId: 5, mauSacId: null, anhDaiDien: '/uploads/dd.jpg' }]);
    bang(r.ghi.anhDaiDien, [{ mh: 5, anh: '/uploads/dd.jpg' }],
      'dong THIEU MAU -> VAN ghi anh dai dien (anh la cua MA HANG, khong phai cua mau)');
    bang(r.ghi.dongMau, [], 'nhung khong tao dong mau (dung, vi khong biet mau nao)');

    /* c) Mot ma nhieu mau: anh dai dien chi ghi MOT lan. */
    r = await chay([
      { maHangId: 7, mauSacId: 1, anhMau: '/uploads/m1.jpg', anhDaiDien: '/uploads/dd7.jpg' },
      { maHangId: 7, mauSacId: 2, anhMau: '/uploads/m2.jpg', anhDaiDien: '/uploads/dd7.jpg' }
    ]);
    bang(r.ghi.anhDaiDien.length, 1, 'mot ma nhieu mau -> anh dai dien chi ghi mot lan');
    bang(r.ghi.dongMau.map(x => x.anh), ['/uploads/m1.jpg', '/uploads/m2.jpg'], 'moi mau giu anh rieng');

    /* d) Dong dau khong co anh dai dien, dong sau co -> van phai ghi. */
    r = await chay([
      { maHangId: 9, mauSacId: 1, anhDaiDien: null },
      { maHangId: 9, mauSacId: 2, anhDaiDien: '/uploads/dd9.jpg' }
    ]);
    bang(r.ghi.anhDaiDien, [{ mh: 9, anh: '/uploads/dd9.jpg' }],
      'dong dau khong co anh -> KHONG chan dong sau ghi anh');

    /* e) Khong co maHangId -> bo qua han. */
    r = await chay([{ maHangId: null, mauSacId: 3, anhDaiDien: '/uploads/x.jpg' }]);
    bang([r.ghi.anhDaiDien.length, r.ghi.dongMau.length], [0, 0], 'khong co ma hang -> bo qua');

    /* f) Dem tra ve dung (thong bao cho nguoi dung). */
    r = await chay([{ maHangId: 5, mauSacId: 2, anhMau: '/uploads/a.jpg', anhDaiDien: '/uploads/dd.jpg' }]);
    bang([r.kq.soMau, r.kq.soAnh, r.kq.soAnhMau], [1, 1, 1], 'so dem tra ve dung');
  }

  console.log('\n=== 1b. Thu tu trong ham (doc lai nguon) ===');
  const than = bo(mHam || '');
  const viTriAnhDD = than.indexOf('capNhatAnhDaiDien');
  const viTriBoQuaMau = than.indexOf('if (!d.mauSacId) continue');
  kiem(viTriAnhDD > 0 && viTriBoQuaMau > viTriAnhDD,
    'xu ly anh dai dien TRUOC cau bo qua vi thieu mau');
  kiem(!/if \(!d\.maHangId \|\| !d\.mauSacId\) continue/.test(than),
    'khong con cau bo qua gop hai dieu kien (chinh la loi cu)');

  /* ============================================================================================
     2. utils/theKhoMau.js — ghi anh dung cach
     ============================================================================================ */
  console.log('\n=== 2. theKhoMau.js ghi anh ===');
  kiem(/SET LinkAnh = ISNULL\(@anh, LinkAnh\)/.test(sTKM),
    'dong mau DA CO: bo trong khong xoa mat anh cu');
  kiem(/INSERT INTO TheKhoChiTietMau[^)]*LinkAnh/.test(sTKM), 'dong mau MOI: ghi anh ngay luc tao');
  kiem(/if \(!anh\) return false;/.test(sTKM), 'khong co anh moi thi khong dung toi anh dai dien dang luu');
  kiem(/UPDATE TheKhoHangHoa SET AnhDaiDien = ISNULL\(@anh, AnhDaiDien\)/.test(sTKM),
    'anh dai dien cung ghi kieu ISNULL');
  kiem(!/NhapCai\s*=\s*[^0]/.test(bo(sTKM)),
    'theKhoMau.js KHONG ghi so luong vao NhapCai (ghi la ton dem hai lan)');

  /* ============================================================================================
     3. FE phieu nhap kho — ma DA CO cung tai duoc anh dai dien
     ============================================================================================ */
  console.log('\n=== 3. Phieu nhap kho: o anh dai dien cho ma DA CO ===');
  kiem(/const dongDauCuaMa = !moi && d\.maHangId/.test(sFeNK), 'co moc "dong dau tien cua ma da co"');
  kiem(/\(!laDongKhai && dongDauCuaMa\) \?/.test(sFeNK), 've dai anh rieng cho ma da co');
  const soOAnhDD = (sFeNK.match(/class="nk-anhdd"/g) || []).length;
  bang(soOAnhDD, 2, 'co DUNG 2 o anh dai dien: mot cho ma moi (dong khai), mot cho ma da co');
  kiem(/class="nk-dong-moi"/.test(sFeNK.slice(sFeNK.indexOf('!laDongKhai && dongDauCuaMa'))),
    'dai moi dung CHUNG class .nk-dong-moi -> ganDong() tu gan su kien, khong noi day lan hai');
  /* ganDong gan .nk-anhdd trong vong lap tr.nk-dong-moi -> dai moi phai nam trong vong lap do. */
  kiem(/querySelectorAll\('tr\.nk-dong-moi'\)/.test(sFeNK) && /tr\.querySelector\('\.nk-anhdd'\)/.test(sFeNK),
    'su kien tai anh gan theo tr.nk-dong-moi + querySelector(.nk-anhdd)');
  /* Cac o cap ma hang KHAC tuyet doi khong duoc mo cho ma da co (bai hoc v6.99). */
  const daiMoi = sFeNK.slice(sFeNK.indexOf('!laDongKhai && dongDauCuaMa'), sFeNK.indexOf('!laDongKhai && dongDauCuaMa') + 1400);
  ['nk-dvcb', 'nk-dvqd', 'nk-ri', 'nk-giaban'].forEach(c =>
    kiem(daiMoi.indexOf('class="' + c + '"') === -1,
      `dai moi KHONG chua o ${c} (v6.99: ma da co khong duoc sua cap ma hang)`));
  kiem(/anhDaiDien: d\.anhDaiDien \|\| null/.test(sFeNK), 'payload van gui anh dai dien len backend');
  kiem(/taoTheKho: !!\(\$\('#nkfTaoThe'\)/.test(sFeNK) && /id="nkfTaoThe" checked/.test(sFeNK),
    'o tich "Tao the kho luon khi luu" van mac dinh BAT');

  /* ============================================================================================
     4. Mo the kho tu phieu -> form SUA cho ma da co
     ============================================================================================ */
  console.log('\n=== 4. moTheKhoTheoMa: ma da co -> form SUA ===');
  kiem(/await openItemForm\(rowMa \|\| null, p,/.test(sFeKH),
    'truyen rowMa (mo form SUA) thay vi null (form tao moi)');
  kiem(/rowMa \? undefined : \{ PhieuNKID: phieuNKID, maHang \}/.test(sFeKH),
    'chi truyen "tao tu phieu nhap" khi THAT SU tao moi');
  kiem(/const rowMa = \(\(res\.data \|\| \{\}\)\.tongHop \|\| \[\]\)\.find/.test(sFeKH),
    'rowMa lay tu CUNG nguon tongHop ma nut Sua o tab The kho dang dung');
  kiem(/const isEdit = !!row;/.test(sFeKH), 'openItemForm van phan biet Sua/Tao theo tham so dau');
  /* O "Nhap" cua form Sua PHAI doc NhapCai tho — doc so da gop la ton dem hai lan. */
  kiem(/opts\.nhap != null \? opts\.nhap : \(c \? c\.NhapCai : 0\)/.test(sFeKH),
    'o "Nhap" cua form the kho doc NhapCai THO (khong phai TongNhapCai)');
  kiem(/ISNULL\(ct\.NhapCai, 0\)\s*AS NhapCai/.test(sCaiDat),
    'vw_TonTheoMau.NhapCai dung la so THO cua the kho (khong gop nguon phieu)');

  /* ============================================================================================
     5. Cong cu soi
     ============================================================================================ */
  console.log('\n=== 5. CLI soi_anh_the_kho.js ===');
  kiem(!/\b(UPDATE|DELETE\s+FROM|INSERT\s+INTO)\b/i.test(bo(sSoi)), 'CLI CHI DOC, khong co cau ghi nao');
  kiem(/fs\.statSync/.test(sSoi), 'co kiem file that su ton tai tren o dia');
  kiem(/vw_TonTheoMau/.test(sSoi), 'doc ton qua view dung chung, khong tu tinh lai');
  kiem(/NhapCai phải = 0|DEM HAI LAN|ĐẾM HAI LẦN/.test(sSoi), 'canh bao dem hai lan khi NhapCai > 0');
  kiem(/uploads/.test(sSoi) && /file mới nhất|file moi nhat|8 file/i.test(sSoi),
    'liet ke file moi nhat trong uploads de biet viec TAI LEN co chay khong');

  /* CHAY THAT bo phan tich doi so. Bay that da gap: go `--ma= BD26C124` (thua dau cach) thi `--ma=`
     RONG, ban dau bo qua bo loc AM THAM va in 20 ma gan nhat — nguoi dung tuong dang xem ma minh hoi. */
  console.log('\n=== 5b. CHAY THAT bo phan tich doi so cua CLI ===');
  const thanLay = sSoi.slice(sSoi.indexOf('function layChuoi(t)'), sSoi.indexOf('const DS_MA'));
  kiem(!!thanLay, 'cat duoc ham layChuoi');
  const layVoi = (argv) => new Function('args', thanLay + ' return layChuoi;')(argv)('--ma');
  bang(layVoi(['--ma=BD26C124']), 'BD26C124', 'kieu --ma=GIATRI');
  bang(layVoi(['--ma=', 'BD26C124']), 'BD26C124', 'kieu --ma= GIATRI (THUA DAU CACH) van doc duoc');
  bang(layVoi(['--ma', 'BD26C124']), 'BD26C124', 'kieu --ma GIATRI');
  bang(layVoi(['--ma', '--thieu-anh']), '', '--ma dung truoc mot co khac -> KHONG nuot co do');
  bang(layVoi(['--thieu-anh']), '', 'khong go --ma -> rong');
  bang(layVoi(['--ma=A,B']), 'A,B', 'nhieu ma ngan cach dau phay');
  kiem(/const DINH_LOC = args\.some/.test(sSoi) && /khong doc ra gia tri|KHONG CO BO LOC/.test(sSoi),
    'go --ma ma khong ra gia tri thi CANH BAO, khong im lang in thu khac');
  kiem(/DANG LOC theo ma|DANG LOC theo phieu/.test(sSoi), 'in ro dang loc theo gi');
  kiem(/KHÔNG PHẢI ĐƯỜNG DẪN ẢNH — đang lưu/.test(sSoi),
    'gia tri la in NGUYEN VAN (ban dau cat cut thanh "/…", khong chan doan duoc)');

  console.log('\n=== 6. Bump ?v= ===');
  [['module.nhapkho.js', 7.60], ['module.khohang.js', 7.60]].forEach(([f, min]) => {
    const v = (sIndex.match(new RegExp(f.replace(/\./g, '\\.') + '\\?v=([\\d.]+)')) || [])[1];
    kiem(v && parseFloat(v) >= min, `index.html: ${f}?v= >= ${min}`, String(v));
  });

  console.log('\n================================================================');
  console.log(`KET QUA: ${dat} dat / ${truot} truot`);
  process.exit(truot ? 1 : 0);
})();
