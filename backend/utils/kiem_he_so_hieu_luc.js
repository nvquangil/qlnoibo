/* ================================================================================================
   kiem_he_so_hieu_luc.js  —  bo tu kiem cho v9.12
   "Bang DAI SIZE phai doi chieu voi HE SO HIEU LUC (uu tien so cat), khong phai he so cua LENH."

   Chay:  node backend\utils\kiem_he_so_hieu_luc.js
   KHONG copy file nay sang D:\QLSX.

   🔴 Bai hoc v9.10/v9.11: KHONG so chuoi de kiem logic. O day ban FRONTEND la ban sao co chu dich
   cua ban BACKEND, nen phep chinh la: trich ca hai ham ra, cho chay tren CUNG mot bo du lieu, va
   doi hoi chung tra GIONG HET nhau. Doi cach viet mot ben ma quen ben kia thi phep nay do.
   ================================================================================================ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const GOC = path.join(__dirname, '..', '..');
const F = {
  be: 'backend/routes/qlsx.js',
  fe: 'frontend/js/module.qlsx.js',
  html: 'frontend/index.html'
};
let sai = 0, dat = 0;
const src = {};
function kiem(ten, dung, td) {
  if (dung) { dat++; console.log('  ✓ ' + ten); }
  else { sai++; console.log('  ❌ ' + ten + (td ? ' — ' + td : '')); }
}

console.log('\n=== 1. BIEN DICH (thay cho node --check) ===');
['be', 'fe'].forEach(k => {
  src[k] = fs.readFileSync(path.join(GOC, F[k]), 'utf8');
  try { new vm.Script(src[k], { filename: F[k] }); dat++; console.log('  ✓ ' + F[k]); }
  catch (e) { sai++; console.log('  ❌ ' + F[k] + ' VO CU PHAP: ' + e.message); }
});
src.html = fs.readFileSync(path.join(GOC, F.html), 'utf8');

console.log('\n=== 2. HAI BAN (backend / frontend) PHAI CHO RA CUNG MOT KET QUA ===');
/* Trich than ham ra khoi file roi chay trong sandbox — khong nap ca file (qlsx.js can DB). */
/* ⚠️ Dem ngoac MU — ngoac nhon trong CHUOI/COMMENT ben trong ham se lam lech. Hai ham dich hien
   khong co ngoac nao trong literal, nhung de khong chet bang stack trace khi dieu do doi:
   (1) dem khong can => tra null (bao ❌ doc duoc, khong crash), (2) vm.runInNewContext boc try. */
function trichHam(nguon, ten) {
  const i = nguon.indexOf('function ' + ten + '(');
  if (i < 0) return null;
  let mo = 0, j = nguon.indexOf('{', i), batDau = j;
  if (batDau < 0) return null;
  for (; j < nguon.length; j++) {
    if (nguon[j] === '{') mo++;
    else if (nguon[j] === '}') { mo--; if (mo === 0) return nguon.slice(i, j + 1); }
  }
  return null;   // dem khong can — ham co ngoac trong chuoi/comment, phai sua trichHam truoc
}
function napHam(than, ten) {
  try { const s = { r: null }; vm.runInNewContext(than + '; r = ' + ten + ';', s); return s.r; }
  catch (e) { console.log('  ❌ khong nap duoc ' + ten + ': ' + e.message); sai++; return null; }
}
const hamBE = trichHam(src.be, 'heSoHieuLuc');
const hamFE = trichHam(src.fe, 'heSoHieuLucLenh');
kiem('tim thay heSoHieuLuc() o backend', !!hamBE);
kiem('tim thay heSoHieuLucLenh() o frontend', !!hamFE);

const beFn = hamBE ? napHam(hamBE, 'heSoHieuLuc') : null;
const feFn = hamFE ? napHam(hamFE, 'heSoHieuLucLenh') : null;
if (beFn && feFn) {
  const sb = { r: beFn }, sf = { r: feFn };
  /* Backend nhan (catMauList, order); frontend nhan (detail) co .catMauList va .HeSoQuyDoi. */
  const CA = [
    ['chua cat gi', [], 11],
    ['moi mau cung he so 11 o So cat', [{ TongSoLop: 10, HeSoCat: 11, HeSoCatLech: 0 }], 1],
    ['CA MAU CUA NGUYEN: cat 11, lenh van 1', [{ TongSoLop: 10, HeSoCat: 11, HeSoCatLech: 0 }], 1],
    ['hai mau cung 11', [{ TongSoLop: 5, HeSoCat: 11, HeSoCatLech: 0 }, { TongSoLop: 7, HeSoCat: 11, HeSoCatLech: 0 }], 1],
    ['hai mau LECH nhau', [{ TongSoLop: 5, HeSoCat: 11, HeSoCatLech: 0 }, { TongSoLop: 7, HeSoCat: 6, HeSoCatLech: 0 }], 9],
    ['mot mau co cay lech he so', [{ TongSoLop: 5, HeSoCat: null, HeSoCatLech: 1 }], 9],
    ['mau chua ghi he so', [{ TongSoLop: 5, HeSoCat: 0, HeSoCatLech: 0 }], 9],
    ['dong 0 lop bi bo qua', [{ TongSoLop: 0, HeSoCat: 3, HeSoCatLech: 0 }, { TongSoLop: 8, HeSoCat: 11, HeSoCatLech: 0 }], 1],
    ['chua cat VA lenh cung chua khai', [], 0]
  ];
  let lech = 0;
  CA.forEach(([ten, list, lenh]) => {
    const a = sb.r(list, { HeSoQuyDoi: lenh });
    const b = sf.r({ catMauList: list, HeSoQuyDoi: lenh });
    const khop = a.heSo === b.heSo && a.nguon === b.nguon && a.lyDo === b.lyDo;
    if (!khop) { lech++; console.log('  ❌ LECH [' + ten + '] BE=' + JSON.stringify(a) + ' FE=' + JSON.stringify(b)); }
  });
  kiem('ca ' + CA.length + ' tinh huong: hai ban tra GIONG HET nhau', lech === 0,
       'ban sao co chu dich da lech — doi mot ben phai doi ca hai');

  // Hanh vi phai dung, khong chi giong nhau
  const caNguyen = sb.r([{ TongSoLop: 10, HeSoCat: 11, HeSoCatLech: 0 }], { HeSoQuyDoi: 1 });
  kiem('CA MAU: cat he so 11 / lenh khai 1  =>  lay 11 theo SO CAT',
       caNguyen.heSo === 11 && caNguyen.nguon === 'cat',
       'day la chinh ca Nguyen bao — sai phep nay la ban va vo nghia');
  const caLech = sb.r([{ TongSoLop: 5, HeSoCat: null, HeSoCatLech: 1 }], { HeSoQuyDoi: 9 });
  kiem('cay lech he so => LUI VE lenh (khong tu doan)', caLech.heSo === 9 && caLech.nguon === 'lenh');
  kiem('lui ve lenh thi PHAI noi ly do', !!caLech.lyDo,
       'khong noi ly do la nguoi dung lai khong hieu vi sao con so do');
}

console.log('\n=== 3. BACKEND dung he so hieu luc o cho CHAN THAT ===');
kiem('PUT /daisize goi heSoHieuLuc', /const hl = heSoHieuLuc\(catMauDai, order\)/.test(src.be));
kiem('bat bien so voi hl.heSo theo CHIEU THUAN (fail-closed), KHONG con so voi heSoLenh',
     /!\(Math\.abs\(tong - hl\.heSo\) <= 1e-9\)/.test(src.be)
       && /Number\.isFinite\(hl\.heSo\)/.test(src.be)
       && !/tong !== heSoLenh/.test(src.be),
     'hl.heSo thanh NaN ma viet chieu nghich thi bat bien IM LANG cho qua het');
kiem('chan he so dai KHONG NGUYEN (cot HeSo la INT, sql.Int parseInt im lang)',
     /rows\.some\(r => !Number\.isInteger\(r\.heSo\)\)/.test(src.be),
     'go 5.5 se luu thanh 5 khong bao gi => quy doi ri sai o Dong goi/Kho nhap');
kiem('lay catMauList qua getCatMauList (khong viet lai bo loc cay chinh)',
     /getCatMauList\(pool, order\.DonHangID, catStageIdDai\)/.test(src.be),
     'chep lai bo loc cay chinh da sai 3 lan: v8.31, v8.48, v8.52');
kiem('cau tu choi noi ro dang lay he so o DAU', /SỔ CẮT.*:.*LỆNH|nguon === 'cat' \? 'ở SỔ CẮT' : 'của LỆNH'/.test(src.be));

console.log('\n=== 4. FRONTEND ===');
kiem('renderDaiSizeBar dung heSoHieuLucLenh', /const hl = heSoHieuLucLenh\(detail\)/.test(src.fe));
/* ⚠️ KHONG ghim so tham so cua loi goi — v9.13 them tham so thu 5 (hl.nguon) va phep cu doi dung
   `perm)` nen DO OAN (lan thu 5 cua mau loi nay). Chi can thay dung THAM SO THU HAI la heSoDoiChieu. */
kiem('modal nhan he so DOI CHIEU (khong phai he so lenh tho)',
     /openTachDaiSizeModal\(maDH, heSoDoiChieu, ds, perm/.test(src.fe)
       && /const heSoDoiChieu = hl\.heSo/.test(src.fe));
/* v9.12 doi ten heSoLenh -> heSoDoiChieu trong vung dai size. Con sot MOT tham chieu heSoLenh la
   ReferenceError luc ve form Cat (node --check KHONG bat duoc loi nay — no khong phai loi cu phap). */
kiem('khong con tham chieu heSoLenh nao sot lai trong module.qlsx.js',
     !/\bheSoLenh\b/.test(src.fe),
     'bien da doi ten — con sot la ReferenceError luc mo cong doan Cat');
/* v9.23 noi: dungLuat() viet lai thanh `Math.abs(ds.reduce(...) - heSoDoiChieu)` nen phep ghim
   nguyen van chuoi cu thanh DO OAN. Chi doi: con so sanh bang SAI SO quanh heSoDoiChieu, khong dung
   === tran (he so o so cat la DECIMAL(10,3)). */
kiem('modal so theo sai so, khong dung === tran',
     /- heSoDoiChieu\) <= 1e-9/.test(src.fe) && !/===\s*heSoDoiChieu/.test(src.fe),
     'he so o so cat la DECIMAL(10,3)');
/* Chi doi KHAI BAO const bien mat — chu "NGUONG_TACH_DAI" van con trong COMMENT giai thich lich su,
   bat ca comment la do oan (bai hoc kiem_ho_so_nhan_su.js vap 3 lan). */
kiem('nut Tach dai LUON hien dam o Cat (Nguyen 2026-10-31)',
     /const noiBat = true;/.test(src.fe) && !/const NGUONG_TACH_DAI/.test(src.fe),
     'nut mo theo nguong he so chinh la ly do "tuong tinh nang bien mat"');
kiem('thanh dai size NOI RO nguon he so', /theo SỔ CẮT/.test(src.fe));

console.log('\n=== 5. v9.13 — KHUNG DAI SIZE KHONG BI ASYNC XOA MAT ===');
/* 🔴 Loi "tach dai size bien mat" (Nguyen 2026-10-31): renderCatMultiSoDo la ASYNC va ghi de
   box.innerHTML SAU await => khung dai do renderStageFields chen DONG BO bi xoa sach. Co tu v8.79
   (10/10) khi moi lenh co so do bi day vao nhanh async. Phep nay doi: SAU MOI cho ghi de innerHTML
   trong renderCatMultiSoDo phai co mot loi goi renderDaiSizeBar ve lai khung. */
/* Dem TOAN CUC, khong cat cua so theo so ky tu (cat cua so la doan mo — de vo nhu cac phep da do
   oan truoc). 3 loi goi = 1 o cuoi nhanh CAT cua renderStageFields + 2 cho VE LAI ngay sau hai lan
   `box.innerHTML = ...` ben trong renderCatMultiSoDo. */
/* Dem LOI GOI (co dau ; sau ngoac dong) — regex khong co ; se khop ca DONG DINH NGHIA ham, lam
   nguong dem sai mot don vi: xoa mot cho ve lai van du 3 => OK oan (ra soat cheo bat duoc). */
/* 🔴 v9.26 LAT NGUOC BAT BIEN NAY. Truoc: ve khung o TUNG nhanh (>=3 loi goi) de chong innerHTML
   async xoa mat. Nay: ve DUNG MOT LAN vao #daiSizeHost nam NGOAI #pStageFields — renderStageFields
   ve lai bao nhieu lan cung khong dung toi. Doi lai khung hien o MOI cong doan, khong chi o Cat
   (Nguyen 2026-11-06: cat xong lenh chuyen sang May thi khong con thay nut tach mau).

   🔴 v9.26 -> v9.33 (CUNG NGAY 2026-11-06, Nguyen doi y): "chuc nang tach dai size tach mau CHI
   hien thi o cong doan cat ... de tach TRUOC khi trai vi he so da biet roi". Cach ve KHONG doi
   (van dung MOT loi goi, van vao host ngoai #pStageFields — khong quay lai ho loi v8.79->v9.13),
   chi them cong tac `capNhatKhungDaiSize`: dung cong doan thi do noi dung, con lai thi don sach.
   🔴 v9.38 -> v9.39: khung nay TACH LAM HAI. DAI SIZE ve o KY THUAT ('KT'), con MAU van o CAT
   ('CAT') — Nguyen 2026-11-10: "chi tach dai size o cong doan ky thuat, con tach mau van o cong
   doan cat vi tach mau thi ty le size giong nhau chi la tach 50% cho mau 1 50% cho mau 2".
   Vi the nay CO HAI loi goi, moi loi goi them tham so thu NAM ('DAI' / 'MAU'), nen nguong dem la 3
   (1 dinh nghia + 2 loi goi) chu khong con 2. Xem muc 4 cua kiem_bang_rieng_theo_dai.js de biet ca
   bon moc doi cho (v9.26 -> v9.33 -> v9.38 -> v9.39).
   Loi goi nhan bien `hostDai` thay vi modal.querySelector(...) viet thang — phep cu ghim nguyen van
   chuoi do nen DO OAN. Noi dung v9.33+ kiem o kiem_bang_rieng_theo_dai.js. */
kiem('khung dai size ve vao host RIENG ngoai #pStageFields (KT: DAI, CAT: MAU)',
     (src.fe.match(/renderDaiSizeBar\(/g) || []).length === 3    // 1 dinh nghia + 2 loi goi
       && /<div id="daiSizeHost"><\/div>/.test(src.fe)
       && /const hostDai = modal\.querySelector\('#daiSizeHost'\);/.test(src.fe)
       && /renderDaiSizeBar\(hostDai, maDH, perm, detail, 'DAI'\)/.test(src.fe)
       && /renderDaiSizeBar\(hostDai, maDH, perm, detail, 'MAU'\)/.test(src.fe),
     've nhieu lan vao #pStageFields = quay lai kieu cu, va them mot nhanh async la sot mot cho');
kiem('host nam TRUOC #pStageFields trong form (khong bi renderStageFields ghi de)',
     src.fe.indexOf('<div id="daiSizeHost"></div>') < src.fe.indexOf('<div id="pStageFields"></div>'));
kiem('tim thay renderCatMultiSoDo (async)', /async function renderCatMultiSoDo/.test(src.fe));

console.log('\n=== 6. v9.13 — GIAO/NHAN IN THEU co cot DAI SIZE ===');
kiem('row builder giao in theu co o chon .it-dai khi coTachDai',
     /class="it-dai"/.test(src.fe) && /inTheAddRowHtml/.test(src.fe));
kiem('luu giao in theu doc daiSizeId + chan thieu dai khi lenh da tach',
     /daiSizeId: \(r\.querySelector\('\.it-dai'\) \|\| \{\}\)\.value \|\| null/.test(src.fe)
       && /coTachDai && rows\.some\(r => !r\.daiSizeId\)/.test(src.fe));
/* v9.23 doi nhan cot theo kieu tach (Dai size / Mau) nen khong ghim nguyen van chu "Dải size" nua. */
kiem('bang GIAO va bang NHAN deu co cot dai/mau',
     (src.fe.match(/coTachDai \? `<th>\$\{tuDaiHoa\}<\/th>` : ''/g) || []).length >= 2);
kiem('nut "moi hang muc mot dong" no theo HANG MUC x DAI',
     /dsDaiNo = coTachDai \? daiList : \[null\]/.test(src.fe));
kiem('backend getInTheList tra DaiSizeID + TenDai (do cot)',
     /coCotQLSX\(pool, 'DonHangNhaInTheu', 'DaiSizeID'\)/.test(src.be)
       && /LEFT JOIN DonHangDaiSize ds ON ds\.ID = it\.DaiSizeID/.test(src.be));
kiem('backend POST /inthe ghi DaiSizeID va CHAN dai la/thieu o server',
     /hopLe\.has\(String\(r\.daiSizeId\)\)/.test(src.be)
       && /rq\.input\('DaiSizeID', sql\.Int, Number\(r\.daiSizeId\) \|\| null\)/.test(src.be),
     'chi chan o form la nguoi goi API thang van ghi dong khong dai');

console.log('\n=== 6b. v9.27 — QUYEN O MAN HINH PHAI KHOP QUYEN O MAY CHU ===');
/* 🔴 Nguyen 2026-11-06: "nhan vien to cat khong thay chuc nang tach dai size/mau, chi admin thay".
   Nguyen nhan: man hinh gac bang `perm` cua TAB dang mo, con backend gac bang
   requirePermission('QLSX','edit') + requireChucNang('QLSX','tiendo'). Man khoa chat hon may chu =
   nguoi du quyen van khong lam duoc viec ma khong ai bao gi. */
kiem('backend PUT /daisize van gac bang cap edit + chuc nang tiendo',
     /router\.put\('\/orders\/:maDH\/daisize', requireAuth, requirePermission\('QLSX', 'edit'\), requireChucNang\('QLSX', 'tiendo'\)/.test(src.be),
     'doi gac o backend thi phai doi ca phep duoi va ham permTienDo o frontend');
kiem('🔴 nut Tach dai size/mau gac bang coQuyenSuaTienDo(), KHONG phai perm.canEdit cua tab',
     /const tachDuoc = coQuyenSuaTienDo\(\);/.test(src.fe)
       && !/\$\{perm && perm\.canEdit[\s\S]{0,80}btnTachDai/.test(src.fe));
kiem('🔴 nut Sua / Xoa so cat cung gac theo quyen chuc nang tien do',
     /const suaDuoc = coQuyenSuaTienDo\(\);/.test(src.fe)
       && /const xoaDuoc = coQuyenXoaTienDo\(\);/.test(src.fe)
       && !/const suaDuoc = !perm \|\| perm\.canEdit;/.test(src.fe),
     'to cat ghi duoc so cat thi PHAI sua duoc so cat — backend cho, man hinh thi chan');
kiem('khong co quyen -> VAN thay khung (chi doc) + noi RO ly do, khong am tham an sach',
     /Bạn không có quyền ghi tiến độ nên chỉ xem được/.test(src.fe));
kiem('🔴 chua tach -> HAI nut rieng (dai size / mau), khong bat doan trong hop thoai',
     /id="btnTachDai">📏 Tách dải size<\/button>/.test(src.fe)
       && /id="btnTachMau">🧩 Tách mẫu<\/button>/.test(src.fe),
     'Nguyen: "dang bi lan lon o cho tach size va mau"');
kiem('bam nut nao mo thang kieu do; lenh DA tach thi giu nguyen kieu dang co',
     /const moModal = \(kieu\) => openTachDaiSizeModal\(maDH, heSoDoiChieu, ds, perm, hl\.nguon, kieu\);/.test(src.fe)
       && /moModal\(ds\.length \? null : 'DAI'\)/.test(src.fe)
       && /let loaiTach = \(dsBanDau \|\| \[\]\)\.length \? kieuDangCo/.test(src.fe));
kiem('tieu de hop thoai noi RO dang tach gi', /\$\{laMau\(\) \? 'Tách MẪU' : 'Tách DẢI SIZE'\}/.test(src.fe));

console.log('\n=== 7. index.html ===');
/* Dung so sanh >= thay vi ghim mot con so — ghim la moi ban sau deu do oan (da vap o
   kiem_lenh_sx_the_kho.js v9.16). */
kiem('module.qlsx.js da bump ?v >= 9.13', (() => {
  const m = src.html.match(/module\.qlsx\.js\?v=([\d.]+)/);
  return !!m && parseFloat(m[1]) >= 9.13;
})());

console.log('\n' + '='.repeat(70));
console.log(sai === 0 ? `✅ ${dat} phep DAT, 0 sai` : `❌ ${sai} SAI / ${dat + sai} phep`);
console.log('='.repeat(70) + '\n');
process.exit(sai === 0 ? 0 : 1);
