/* ================================================================================================
   kiem_tach_mau_cung_dai.js  —  bo tu kiem cho v9.23
   "Tach theo MAU (bien the) ma van CHUNG mot dai size"
   (Nguyen 2026-11-05: "lenh ra ao coc size 2-7, ghi chu mau 1 in cho, mau 2 in tho").

   🔴 Phep quan trong nhat (muc 2): luat he so co HAI BAN — backend (PUT /daisize) va frontend
   (dungLuat trong modal). Lech nhau la nguoi dung bam Luu duoc ma server tu choi, hoac nguoc lai
   form khoa nut ma luat that lai cho. Bo kiem chay CA HAI tren CUNG bo du lieu, doi ket qua giong
   het — dung cach da dung cho heSoHieuLuc (kiem_he_so_hieu_luc.js).

   Chay:  node backend\utils\kiem_tach_mau_cung_dai.js
   KHONG copy file nay sang D:\QLSX.
   ================================================================================================ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const GOC = path.join(__dirname, '..', '..');
const be = fs.readFileSync(path.join(GOC, 'backend', 'routes', 'qlsx.js'), 'utf8');
const fe = fs.readFileSync(path.join(GOC, 'frontend', 'js', 'module.qlsx.js'), 'utf8');
const html = fs.readFileSync(path.join(GOC, 'frontend', 'index.html'), 'utf8');
const docNeuCo = (...p) => fs.existsSync(path.join(GOC, ...p)) ? fs.readFileSync(path.join(GOC, ...p), 'utf8') : '';
const sqlMig = docNeuCo('database', 'migration_v885.sql');
const sqlDayDu = docNeuCo('database', 'CAI_DAT_DAY_DU.sql');
let sai = 0, dat = 0;
function kiem(ten, dung, td) {
  if (dung) { dat++; console.log('  ✓ ' + ten); }
  else { sai++; console.log('  ❌ ' + ten + (td ? ' — ' + td : '')); }
}

console.log('\n=== 1. BIEN DICH (thay cho node --check) ===');
[['backend/routes/qlsx.js', be], ['frontend/js/module.qlsx.js', fe]].forEach(([f, s]) => {
  try { new vm.Script(s, { filename: f }); dat++; console.log('  ✓ ' + f); }
  catch (e) { sai++; console.log('  ❌ ' + f + ' VO CU PHAP: ' + e.message); }
});

console.log('\n=== 2. HAI BAN LUAT HE SO PHAI RA CUNG KET QUA ===');
/* Ban BACKEND dung lai nguyen van hai phep trong PUT /daisize; ban FRONTEND la ham dungLuat() trich
   thang tu file. Neu ai do sua mot ben, ca test se do. */
function trichKhoi(nguon, moc) {
  const i = nguon.indexOf(moc);
  if (i < 0) return null;
  let mo = 0, j = nguon.indexOf('{', i);
  if (j < 0) return null;
  for (; j < nguon.length; j++) {
    if (nguon[j] === '{') mo++;
    else if (nguon[j] === '}') { mo--; if (mo === 0) return nguon.slice(i, j + 1); }
  }
  return null;
}
const thanFe = trichKhoi(fe, 'function dungLuat()');
kiem('tim thay dungLuat() o frontend', !!thanFe);

/* Ban backend viet lai TU CHINH van ban cua route (doc bang regex de khong "cheat"): */
const coPhepMau = /const lech = rows\.filter\(r => !\(Math\.abs\(r\.heSo - hl\.heSo\) <= 1e-9\)\);/.test(be);
const coPhepDai = /if \(!\(Math\.abs\(tong - hl\.heSo\) <= 1e-9\)\)/.test(be);
kiem('backend co DU hai nhanh luat (MAU: tung dong = he so; DAI: tong = he so)', coPhepMau && coPhepDai);

if (thanFe && coPhepMau && coPhepDai) {
  const CA = [
    // [ten, rows, heSoDoiChieu, loaiTach, mong doi]
    ['DAI: 6 + 5 = 11 -> HOP LE', [{ tenDai: '2-7', heSo: 6 }, { tenDai: '8-12', heSo: 5 }], 11, 'DAI', true],
    ['DAI: 6 + 6 = 12 != 11 -> CHAN', [{ tenDai: '2-7', heSo: 6 }, { tenDai: '8-12', heSo: 6 }], 11, 'DAI', false],
    ['🔴 MAU: 6 va 6 voi he so 6 -> HOP LE (khong cong don)',
      [{ tenDai: 'Mẫu 1 in chó', heSo: 6 }, { tenDai: 'Mẫu 2 in thỏ', heSo: 6 }], 6, 'MAU', true],
    ['🔴 MAU: 3 + 3 = 6 -> CHAN (moi mau phai du he so, khong phai chia doi)',
      [{ tenDai: 'Mẫu 1', heSo: 3 }, { tenDai: 'Mẫu 2', heSo: 3 }], 6, 'MAU', false],
    ['MAU: mot mau lech (6 va 5) -> CHAN', [{ tenDai: 'A', heSo: 6 }, { tenDai: 'B', heSo: 5 }], 6, 'MAU', false],
    ['MAU: ba mau cung 11 -> HOP LE', [{ tenDai: 'A', heSo: 11 }, { tenDai: 'B', heSo: 11 }, { tenDai: 'C', heSo: 11 }], 11, 'MAU', true],
    ['he so 0 o mot dong -> CHAN (ca hai kieu)', [{ tenDai: 'A', heSo: 0 }, { tenDai: 'B', heSo: 6 }], 6, 'MAU', false],
    /* 🔴 He so LE: DonHangDaiSize.HeSo la INT va backend chan so le (v9.12). Kieu MAU chi co MOT gia
       tri hop le (= he so hieu luc) nen he so le khoa chet tinh nang — form PHAI chan truoc, khong
       de nut Luu sang xanh roi server tra 400 ma khong co duong nao go khac di. */
    ['🔴 MAU: he so le 5.5 -> CHAN ca hai ben', [{ tenDai: 'Mẫu 1', heSo: 5.5 }], 5.5, 'MAU', false],
    ['DAI: 5.5 + 5.5 = 11 nhung LE -> CHAN', [{ tenDai: 'A', heSo: 5.5 }, { tenDai: 'B', heSo: 5.5 }], 11, 'DAI', false],
    ['bo trong het -> cho qua (la BO TACH, nut Luu hoi lai)', [], 11, 'DAI', true],
    ['chua co he so doi chieu (0) -> CHAN', [{ tenDai: 'A', heSo: 6 }], 0, 'MAU', false]
  ];
  /* Ban BACKEND: mo phong DUNG THU TU cac phep trong route (rows truoc, he so doi chieu sau) —
     khong phai thu tu cua form. HAI ca lech CHU DICH, khong dua vao bo ca duoi day (ghi ra de lan
     sau khoi tuong la bo sot):
       (a) "bo trong het + CHUA co he so doi chieu": BE cho qua (khong co dong nao de kiem), form
           khoa nut. Vo hai — xoa het van xoa duoc bang nut X roi Luu.
       (b) HAI DONG TRUNG TEN: BE chan bang cau ro rang, form khong biet. De form khoa nut im lang
           voi cau nhac SAI ("tong he so...") con te hon la de server tra loi dung viec. */
  const luatBE = (rows, heSo, loai) => {
    const ds = rows.filter(r => String(r.tenDai || '').trim() !== '');
    if (!ds.length) return true;
    if (ds.some(r => !(r.heSo > 0))) return false;
    if (ds.some(r => !Number.isInteger(r.heSo))) return false;        // qlsx.js: HeSo la INT (v9.12)
    if (!(Number.isFinite(heSo) && heSo > 0)) return false;
    return loai === 'MAU'
      ? !ds.filter(r => !(Math.abs(r.heSo - heSo) <= 1e-9)).length
      : Math.abs(ds.reduce((s, r) => s + r.heSo, 0) - heSo) <= 1e-9;
  };
  CA.forEach(([ten, rows, heSo, loai, mong]) => {
    let rBE = null, rFE = null;
    try { rBE = luatBE(rows, heSo, loai); } catch (e) { rBE = '(lỗi)'; }
    try {
      /* dungLuat() doc bien ngoai: rows, heSoDoiChieu, laMau(). Cap dung ba thu do roi chay. */
      const s = {};
      vm.runInNewContext(
        `const rows = ${JSON.stringify(rows)}; const heSoDoiChieu = ${heSo};`
        + ` const laMau = () => ${loai === 'MAU'}; ${thanFe}; __r = dungLuat();`, s);
      rFE = s.__r;
    } catch (e) { rFE = '(lỗi: ' + e.message + ')'; }
    kiem(`${ten}: BE=${rBE}`, rBE === mong, `mong ${mong}`);
    kiem(`${ten}: FE khop BE`, rFE === rBE, `FE=${rFE} vs BE=${rBE}`);
  });
}

console.log('\n=== 3. BACKEND: cot LoaiTach + do cot + fail-safe ===');
kiem('getDaiSizeList tra LoaiTach, do cot de may chua chay migration van chay',
     /coCotQLSX\(pool, 'DonHangDaiSize', 'LoaiTach'\)/.test(be)
       && /ISNULL\(NULLIF\(LTRIM\(RTRIM\(LoaiTach\)\), N''\), N'DAI'\)/.test(be));
kiem('🔴 gia tri la -> DAI (fail-safe ve hanh vi cu, khong bao gio noi long rang buoc)',
     /coGuiLoai[\s\S]{0,80}String\(req\.body\.loaiTach\)\.toUpperCase\(\) === 'MAU' \? 'MAU' : 'DAI'/.test(be));
kiem('🔴 KHONG gui loaiTach (may con cache JS cu) -> GIU kieu dang co, khong tu lat MAU thanh DAI',
     /const coGuiLoai = req\.body\.loaiTach != null && String\(req\.body\.loaiTach\)\.trim\(\) !== '';/.test(be)
       && /: loaiTachCuaList\(dsCu\);/.test(be),
     'lat ve DAI la lenh dang tach MAU (6 va 6) bi so tong 12 != 6 roi chan bang cau kho hieu');
kiem('loaiTachCuaList khong con la ma chet (co dinh nghia VA co dung)',
     (be.match(/loaiTachCuaList/g) || []).length >= 2);
kiem('chi doc danh sach cu MOT lan roi dung lai (dsCu)', /const cu = dsCu\.map\(r => Number\(r\.ID\)\);/.test(be));
kiem('chua chay migration ma chon MAU -> bao ro, khong luu im lang',
     /chưa chạy migration_v885\.sql nên chưa tách theo MẪU được/.test(be));
kiem('…nhung BO TACH (rows rong) thi van cho, khong chan bang cau noi sai viec',
     /if \(loaiTach === 'MAU' && !coCotLoai && rows\.length\)/.test(be));
kiem('INSERT/UPDATE co ghi LoaiTach khi cot ton tai',
     /if \(coCotLoai\) rq\.input\('LoaiTach', sql\.NVarChar\(10\), loaiTach\);/.test(be)
       && /\$\{coCotLoai \? ', LoaiTach=@LoaiTach' : ''\}/.test(be)
       && /\$\{coCotLoai \? ', LoaiTach' : ''\}/.test(be));

console.log('\n=== 4. FRONTEND ===');
kiem('modal co o chon KIEU TACH (radio DAI/MAU)',
     /name="dsLoai" value="DAI"/.test(fe) && /name="dsLoai" value="MAU"/.test(fe));
kiem('gui loaiTach len server khi luu', /\{ rows, loaiTach \}/.test(fe));
kiem('doi kieu -> dien san he so = he so hieu luc (gia tri DUY NHAT hop le cua kieu MAU)',
     /if \(laMau\(\) && heSoDoiChieu > 0\) rows\.forEach\(x => \{ x\.heSo = heSoDoiChieu; \}\);/.test(fe));
kiem('🔴 form ghi tien do NOI RO "SL tu Cat" la so CHUNG ca may mau (vai cat chung)',
     /const laTachMau = daiList\.some\(d => String\(d\.LoaiTach \|\| ''\)\.toUpperCase\(\) === 'MAU'\);/.test(fe)
       && /\(chung cả \$\{daiList\.length\} mẫu\)/.test(fe),
     'thieu nhan nay la nguoi ghi tien do tuong moi mau cat duoc tung ay => nhan doi san luong tren giay');
/* v9.38: khung nay nay o cong doan KY THUAT (truoc la Cat) — phep duoi chi kiem NHAN DOI THEO KIEU,
   khong phu thuoc cho dat, nen van dung. */
kiem('khung tach doi nhan theo kieu (Mẫu của lệnh / Dải size của lệnh)',
     /laTachMau \? 'Mẫu của lệnh \(cùng dải size\)' : 'Dải size của lệnh'/.test(fe));
kiem('nhan bang + placeholder trong modal doi theo kieu',
     /laMau\(\) \? 'Tên mẫu' : 'Tên dải'/.test(fe) && /VD: Mẫu 1 in chó/.test(fe));

console.log('\n=== 4b. 🔴 TRAN DOI CHIEU GOM THEO MAU (ra soat cheo bat duoc, v9.23) ===');
/* Vai cat CHUNG: "SL tu Cat" cua moi mau = so chung ca MAU (108). Cong thang moi dong la 216 trong
   khi backend do bang getTongSLCatForOrder (cong theo MAU, = 108) => man hinh noi "con thieu 108"
   con backend da cho lenh CHUYEN TIEP. Bon phep duoi ghim dung bon cho tung cong sai. */
kiem('co ham gom theo MAU (slCatCuaMau / daGhiCuaMau / conLaiCuaDong)',
     /function slCatCuaMau\(ct\)/.test(fe) && /function daGhiCuaMau\(maCongDoan, ct\)/.test(fe)
       && /function conLaiCuaDong\(maCongDoan, ct, dai\)/.test(fe));
kiem('slCatCuaMau: kieu MAU lay MOT lan (khong cong don), kieu DAI van cong cac phan',
     /if \(laTachMau\) return Math\.max\.apply\(null, daiList\.map\(d => slCatCuaDong\(ct, d\)\)\);/.test(fe)
       && /return daiList\.reduce\(\(s, d\) => s \+ slCatCuaDong\(ct, d\), 0\);/.test(fe),
     'kieu MAU dung max chu khong phai [0]: du lieu le nhau thi tran chi rong ra, khong hut');
kiem('🔴 dong goi y ket thuc (QC\/DG va KN) dung tongCatCuaLenh, KHONG cong thang dongNhapList',
     (fe.match(/const tongCat = tongCatCuaLenh\(\);/g) || []).length >= 2
       && !/reduce\(\(a, \{ ct, dai \}\) => a \+ slCatCuaDong\(ct, dai\), 0\)/.test(fe),
     'con sot mot cho la man hinh va backend doi bang hai thuoc khac nhau');
kiem('🔴 o "Con lai" (QC\/DG va KN) deu qua conLaiCuaDong',
     /const con = conLaiCuaDong\(stageCode, ct, dai\);/.test(fe)
       && /const conLaiCua = \(ct, dai\) => conLaiCuaDong\('KN', ct, dai\);/.test(fe));
kiem('🔴 canh bao vuot so cat GOM THEO MAU khi tach mau (QC/Dong goi)',
     /const gom = laTachMau;/.test(fe)
       && /gom \? String\(ct\.MauSacID\) : `\$\{ct\.MauSacID\}\|\$\{dai \? dai\.ID : ''\}`/.test(fe),
     'so tung mau voi tran chung thi ghi 108+108 = 216 van im lang');
kiem('🔴 KHO NHAP co khoi canh bao RIENG tu v7.56 — khoi do cung phai gom theo mau',
     /const gomKN = laTachMau;/.test(fe)
       && /gomKN \? String\(m\.mauSacId\) : `\$\{m\.mauSacId\}\|\$\{m\.daiSizeId \|\| ''\}`/.test(fe)
       && !/payload\.chiTietMau\.map\(m => \{[\s\S]{0,200}dataset\.conlai/.test(fe),
     'day la TON KHO that: bo sot la nhap 216 cai cho mot ban 108 cai ma khong canh bao gi');
kiem('ba o canh nhau o Kho nhap phai tru ra nhau (Da nhap cung gom theo mau)',
     /const tong = laTachMau \? daGhiCuaMau\('KN', ct\) : daNhapCai\(ct, dai\);/.test(fe));
kiem('🔴 nhanHeSo KHONG con doi chieu TONG he so khi tach mau',
     /if \(laTachMau\) \{[\s\S]{0,400}các mẫu dùng chung một dải size nên phải bằng đúng hệ số Cắt/.test(fe),
     'cau do cu bao nguoi dung di sua mot thu ma ca form lan backend deu tu choi cho sua');
kiem('nhan "(chung cả N mẫu)" dung chung MOT bien cho moi o',
     /const nhanChungMau = laTachMau \?/.test(fe)
       && (fe.match(/\$\{nhanChungMau\}/g) || []).length >= 4,
     'viet tay tung cho la sua mot cho quen ba cho');
kiem('he so le: form chan truoc, khong de server tu choi sau',
     /if \(ds\.some\(r => !Number\.isInteger\(Number\(r\.heSo\)\)\)\) return false;/.test(fe)
       && /Lệnh này chưa tách MẪU được/.test(fe),
     'kieu MAU chi co MOT gia tri hop le nen he so le la khoa chet tinh nang ma nut Luu van sang');
kiem('doi KIEU tren lenh da luu dong -> hoi lai truoc khi doi he so',
     /const daLuuDong = \(dsBanDau \|\| \[\]\)\.filter\(d => Number\(d\.ID\) > 0\)\.length;/.test(fe)
       && /Đổi kiểu sẽ đổi HỆ SỐ của chính các dòng đó/.test(fe));
kiem('cau chu "dai"\/"mau" theo kieu o ca FE lan BE',
     /const tuDaiHoa = laTachMau \? 'Mẫu' : 'Dải size';/.test(fe)
       && /const tuDai = loaiTach === 'MAU' \? 'mẫu' : 'dải';/.test(be)
       && /loaiTachCuaList\(dsDaiGC\) === 'MAU'/.test(be));

console.log('\n=== 5. MIGRATION + BUMP ===');
kiem('INSERT co DU ca ten cot lan placeholder @LoaiTach',
     /\$\{coCotLoai \? ', LoaiTach' : ''\}/.test(be) && /\$\{coCotLoai \? ', @LoaiTach' : ''\}/.test(be),
     'thieu placeholder la loi SQL luc chay, khong phai luc kiem');
kiem('co database/migration_v885.sql', !!sqlMig);
kiem('🔴 DA GOP vao CAI_DAT_DAY_DU.sql (may cai moi khong co cot thi tinh nang cam tiet)',
     /LoaiTach/.test(sqlDayDu) && /migration_v885\.sql/.test(sqlDayDu),
     'quy tac da ghi trong memory: migration moi phai gop vao file cai dat day du');
kiem('migration them cot co DEFAULT DAI + CHECK chi nhan DAI/MAU',
     /ADD LoaiTach NVARCHAR\(10\) NOT NULL[\s\S]{0,120}DEFAULT N'DAI'/.test(sqlMig)
       && /CHECK \(LoaiTach IN \(N'DAI', N'MAU'\)\)/.test(sqlMig));
kiem('migration KHONG xoa/sua du lieu nghiep vu nao khac',
     !/DELETE FROM/i.test(sqlMig) && !/DROP TABLE/i.test(sqlMig));
/* So SO, khong ghim chuoi — ban sau (v9.24…) cung phai xanh. */
kiem('index.html bump module.qlsx.js?v >= 9.23', (() => {
  const m = html.match(/module\.qlsx\.js\?v=([\d.]+)/);
  return !!m && parseFloat(m[1]) >= 9.23;
})());

console.log('\n' + '='.repeat(70));
console.log(sai === 0 ? `✅ ${dat} phep DAT, 0 sai` : `❌ ${sai} SAI / ${dat + sai} phep`);
console.log('='.repeat(70) + '\n');
process.exit(sai === 0 ? 0 : 1);
