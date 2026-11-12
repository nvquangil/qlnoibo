/* ================================================================================================
   kiem_bang_rieng_theo_dai.js  —  bo tu kiem cho v9.33

   Hai viec cua v9.33 (Nguyen 2026-11-06):
     A. "chuc nang tach dai size tach mau CHI hien thi o cong doan cat. hien tai cac cong doan deu co"
        -> khung #daiSizeHost chi co NOI DUNG khi cong doan dang chon la CAT, con lai don sach.
     B. "sau cong doan cat ma co tach size/mau thi cac cong doan sau se hien thi cac bang cac mau
        chinh RIENG theo tach nen lam bang rieng, vi du size 2-7 mau do mau xanh, size 8-12"
        -> khoiTheoDai(): moi dai/mau mot khoi co tieu de, ben trong du cac mau.

   🔴 Luat cua bo kiem nay (feedback_qlnoibo_bo_kiem_dung_regex_bat_bay_cu_phap):
   KIEM HANH VI. Hai ham tren duoc TRICH tu file that roi CHAY trong vm voi du lieu gia —
   khong so chuoi. Phep quan trong nhat la muc 2.3: khoi gom lai KHONG DUOC mat hay nhan doi
   mot cap (mau, dai) nao so voi dongNhapList() — vi chinh dongNhapList() la cai dung de dung
   payload luc Gui. Lech nhau = man hinh thieu o nhap ma backend van cho luu.

   Chay:  node backend\utils\kiem_bang_rieng_theo_dai.js
   KHONG copy file nay sang D:\QLSX.
   ================================================================================================ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const GOC = path.join(__dirname, '..', '..');
const fe = fs.readFileSync(path.join(GOC, 'frontend', 'js', 'module.qlsx.js'), 'utf8');
const be = fs.readFileSync(path.join(GOC, 'backend', 'routes', 'qlsx.js'), 'utf8');   // v9.38
const html = fs.readFileSync(path.join(GOC, 'frontend', 'index.html'), 'utf8');
let sai = 0, dat = 0;
function kiem(ten, dung, td) {
  if (dung) { dat++; console.log('  ✓ ' + ten); }
  else { sai++; console.log('  ❌ ' + ten + (td ? ' — ' + td : '')); }
}
/* Cat lay nguyen van mot khai bao `function ten(` ke ca cac dau ngoac long nhau ben trong. */
function trichHam(nguon, moc) {
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

console.log('\n=== 1. BIEN DICH (thay cho node --check) ===');
try { new vm.Script(fe, { filename: 'frontend/js/module.qlsx.js' }); dat++; console.log('  ✓ module.qlsx.js'); }
catch (e) { sai++; console.log('  ❌ module.qlsx.js VO CU PHAP: ' + e.message); }

console.log('\n=== 2. B. khoiTheoDai() — CHAY THAT, KHONG SO CHUOI ===');
const thanDong = trichHam(fe, 'function dongNhapList()');
const thanKhoi = trichHam(fe, 'function khoiTheoDai(');
kiem('trich duoc dongNhapList() va khoiTheoDai()', !!thanDong && !!thanKhoi);

if (thanDong && thanKhoi) {
  /* Moi dong duoc ve thanh mot dau "<mau>|<dai>" de dem duoc, khong phu thuoc HTML that. */
  const VE_DONG = `(({ ct, dai }) => '<r>' + ct.MauSacID + '|' + (dai ? dai.ID : '') + '</r>')`;
  const RONG = "'<<rong>>'";
  function chay(catMauList, daiList, coTachDai) {
    const laTachMau = daiList.some(d => d.LoaiTach === 'MAU');
    const moi = {
      coTachDai, catMauList, daiList, laTachMau,
      tuDaiHoa: laTachMau ? 'Mẫu' : 'Dải size',
      fmtNumber: n => String(n),
      escapeHtml: s => String(s == null ? '' : s)
    };
    const ctx = vm.createContext(moi);
    vm.runInContext(`${thanDong}; ${thanKhoi};
      __phang = dongNhapList().map(${VE_DONG});
      __gom   = khoiTheoDai(${VE_DONG}, ${RONG});`, ctx);
    const dauGom = (moi.__gom.match(/<r>[^<]*<\/r>/g) || []);
    return {
      phang: moi.__phang,
      gom: moi.__gom,
      dauGom,
      soKhoi: (moi.__gom.match(/class="khoi-dai"/g) || []).length
    };
  }
  const sapXep = a => a.slice().sort();

  const MAU3 = [
    { MauSacID: 11, TenMau: 'Đỏ', TongSoLop: 18, SoLuong: 108 },
    { MauSacID: 12, TenMau: 'Xanh', TongSoLop: 18, SoLuong: 108 },
    { MauSacID: 13, TenMau: 'Vàng', TongSoLop: 10, SoLuong: 60 }
  ];
  const DAI2 = [{ ID: 1, TenDai: '2-7', HeSo: 6, LoaiTach: 'DAI' }, { ID: 2, TenDai: '8-12', HeSo: 5, LoaiTach: 'DAI' }];
  const MAU2 = [{ ID: 7, TenDai: 'Mẫu 1 in chó', HeSo: 6, LoaiTach: 'MAU' }, { ID: 8, TenDai: 'Mẫu 2 in thỏ', HeSo: 6, LoaiTach: 'MAU' }];

  console.log('\n  --- 2.1 lenh KHONG tach: phai y HET ban cu (khong khoi, khong vien) ---');
  const r0 = chay(MAU3, [], false);
  kiem('khong tach -> KHONG sinh khoi nao', r0.soKhoi === 0, 'soKhoi=' + r0.soKhoi);
  kiem('khong tach -> dung 3 dong, moi mau mot dong, dai rong',
       r0.dauGom.length === 3 && r0.dauGom.join('') === '<r>11|</r><r>12|</r><r>13|</r>',
       r0.dauGom.join(''));
  kiem('khong tach -> khoiTheoDai tra DUNG BANG dongNhapList().map().join()',
       r0.gom === r0.phang.join(''));

  console.log('\n  --- 2.2 tach DAI: moi dai MOT khoi, ben trong du ca 3 mau ---');
  const r1 = chay(MAU3, DAI2, true);
  kiem('2 dai -> dung 2 khoi', r1.soKhoi === 2, 'soKhoi=' + r1.soKhoi);
  kiem('moi khoi co du 3 mau (3+3 = 6 dong)', r1.dauGom.length === 6, 'co ' + r1.dauGom.length);
  kiem('🔴 thu tu la DAI NGOAI, MAU TRONG (khoi 1 het roi moi sang khoi 2)',
       r1.dauGom.join('') === '<r>11|1</r><r>12|1</r><r>13|1</r><r>11|2</r><r>12|2</r><r>13|2</r>',
       r1.dauGom.join(''));
  kiem('tieu de khoi mang TEN DAI va chu "Dải size"',
       r1.gom.indexOf('Dải size: 2-7') >= 0 && r1.gom.indexOf('Dải size: 8-12') >= 0);
  kiem('tieu de khoi noi he so cua dai (6 va 5, khong phai he so cua lenh)',
       /2-7[\s\S]{0,120}hệ số 6 cái\/lớp/.test(r1.gom) && /8-12[\s\S]{0,120}hệ số 5 cái\/lớp/.test(r1.gom));

  console.log('\n  --- 2.3 🔴 KHONG MAT, KHONG NHAN DOI mot cap (mau, dai) nao ---');
  /* Day la phep quan trong nhat: payload luc Gui duyet dongNhapList(), man hinh duyet khoiTheoDai().
     Lech nhau la o nhap bi thieu (nguoi dung khong nhap duoc) hoac bi lap (go vao o nay, o kia trong). */
  kiem('tach DAI: tap cap cua khoi == tap cap cua dongNhapList()',
       JSON.stringify(sapXep(r1.dauGom)) === JSON.stringify(sapXep(r1.phang)),
       'khoi=' + sapXep(r1.dauGom).join(',') + ' | phang=' + sapXep(r1.phang).join(','));
  kiem('tach DAI: khong co cap nao lap lai',
       new Set(r1.dauGom).size === r1.dauGom.length);

  const r2 = chay(MAU3, MAU2, true);
  kiem('tach MAU: tap cap cua khoi == tap cap cua dongNhapList()',
       JSON.stringify(sapXep(r2.dauGom)) === JSON.stringify(sapXep(r2.phang)));
  kiem('tach MAU: 2 mau -> 2 khoi, tieu de dung chu "Mẫu" chu khong phai "Dải size"',
       r2.soKhoi === 2 && r2.gom.indexOf('Mẫu: Mẫu 1 in chó') >= 0 && r2.gom.indexOf('Dải size:') < 0,
       'soKhoi=' + r2.soKhoi);
  /* 🔴 Vai cat CHUNG mot ban: hai khoi mau cung ghi "he so 6" va cung mot con "Con lai" 108.
     Truoc v9.33 hai dong nam sat nhau nen nhin ra ngay la MOT so; nay cach nhau ca man hinh. */
  kiem('🔴 tach MAU: MOI khoi co cau nhac "CHUNG cua ca N mau — khong cong sang khoi kia"',
       (r2.gom.match(/CHUNG của cả 2 mẫu/g) || []).length === 2,
       'dem duoc ' + (r2.gom.match(/CHUNG của cả 2 mẫu/g) || []).length);
  kiem('tach DAI (khong phai MAU): KHONG co cau nhac do (dai thi cong don that)',
       r1.gom.indexOf('CHUNG của cả') < 0);

  console.log('\n  --- 2.4 cac the "rong" ---');
  const r3 = chay([], DAI2, true);
  kiem('chua ghi Cat (khong co mau) -> tra cau "rong", KHONG ve khoi trong lo lung',
       r3.gom === '<<rong>>', JSON.stringify(r3.gom));
  const r4 = chay(MAU3, [], true);
  kiem('coTachDai bat nhung daiList rong (du lieu le) -> cung tra cau "rong", khong vo',
       r4.gom === '<<rong>>', JSON.stringify(r4.gom));
  const r5 = chay([], [], false);
  kiem('khong tach + khong co mau -> van la cau "rong" nhu ban cu',
       r5.gom === '<<rong>>', JSON.stringify(r5.gom));
}

console.log('\n=== 3. B. BA MAN NHAP DEU DI QUA khoiTheoDai (khong con map phang) ===');
/* Day la phep SO CHUOI co y: ba cho goi la ba cho, khong chay duoc rieng le. Viet SAU CUNG,
   tren ban da dung yen (dung luat cua feedback_qlnoibo_bo_kiem_dung_regex_bat_bay_cu_phap). */
const soGoi = (fe.match(/khoiTheoDai\(/g) || []).length;
kiem('co 1 dinh nghia + 3 noi goi (May/QC/..., Dong goi, Kho nhap) = 4 lan xuat hien',
     soGoi === 4, 'dem duoc ' + soGoi);
/* Kiem theo CAU TRUC chu khong theo mot cach viet: moi `<div class="row-repeater">${...}` dung de
   do o nhap PHAI goi qua mot trong ba ham da di qua khoiTheoDai. Ai viet lai nhanh phang bang
   arrow than-khoi hay doi ten bien cung khong lot (phep phu dinh hep thi lot). */
const doVaoRepeater = (fe.match(/row-repeater">\$\{\s*([A-Za-z_$][\w$]*)\(/g) || [])
  .map(s => (s.match(/\$\{\s*([A-Za-z_$][\w$]*)\(/) || [])[1]);
const HOP_LE = ['mauQtyRowsHtml', 'dgQtyRowsHtml', 'khoiTheoDai'];
kiem('🔴 moi .row-repeater do o nhap deu qua mauQtyRowsHtml / dgQtyRowsHtml / khoiTheoDai',
     doVaoRepeater.length >= 4 && doVaoRepeater.every(t => HOP_LE.indexOf(t) >= 0),
     'thay: ' + doVaoRepeater.join(', '));
kiem('🔴 KHONG con noi nao do thang dongNhapList().map(...) ra man hinh',
     doVaoRepeater.indexOf('dongNhapList') < 0
       && !/dongNhapList\(\)\.map\(\(\{ ct, dai \}\) => `/.test(fe),
     'con sot mot cho la cong doan do van tron lan hai dai nhu cu');
kiem('payload luc Gui VAN duyet dongNhapList() (khoiTheoDai chi la cach bay)',
     (fe.match(/payload\.chiTietMau = dongNhapList\(\)\.map/g) || []).length >= 2,
     'doi cho nay sang khoiTheoDai la tron HTML vao payload');

console.log('\n=== 4. A. KHUNG DAI SIZE CHI O CONG DOAN CAT ===');
const thanCapNhat = trichHam(fe, 'function capNhatKhungDaiSize(');
kiem('trich duoc capNhatKhungDaiSize()', !!thanCapNhat);
if (thanCapNhat) {
  function thu(maCongDoan, coHost) {
    const host = coHost ? { innerHTML: '(con rac cua cong doan truoc)' } : null;
    let daVe = 0, cheDo = null;
    const ctx = vm.createContext({
      hostDai: host,
      // maCongDoan = null: stage KHONG co trong map (don hang da "Hoan thanh", select tu chon option la)
      stageById: maCongDoan == null ? new Map() : new Map([['5', { StageID: 5, MaCongDoan: maCongDoan }]]),
      renderDaiSizeBar: (b, m2, p, d, cd) => { daVe++; cheDo = cd; },
      maDH: 'DH2611151', perm: {}, detail: { daiSizeList: [] }
    });
    vm.runInContext(`${thanCapNhat}; capNhatKhungDaiSize('5');`, ctx);
    return { daVe, cheDo, con: host ? host.innerHTML : null };
  }
  /* 🔴 v9.39 — KHUNG TACH NAY O HAI CONG DOAN, MOI NOI MOT VIEC. Lich su di chuyen:
       v9.26 moi cong doan -> v9.33 chi CAT -> v9.38 chi KT -> v9.39 TACH DOI:
         KT  = tach DAI SIZE (quyet luc lam so do, can khai ty le vai)
         CAT = tach MAU     (chia mot ban cat cho hai bien the, ty le vai nhu nhau)
     Nguyen 2026-11-10: "chi tach dai size o cong doan ky thuat, con tach mau van o cong doan cat".
     Dung "sua cho gon" ve mot cho. */
  const tKT = thu('KT', true);
  kiem('🔴 KY THUAT -> ve khung, che do DAI', tKT.daVe === 1 && tKT.cheDo === 'DAI',
       `ve=${tKT.daVe} cheDo=${tKT.cheDo}`);
  const tCat2 = thu('CAT', true);
  kiem('🔴 CAT -> ve khung, che do MAU', tCat2.daVe === 1 && tCat2.cheDo === 'MAU',
       `ve=${tCat2.daVe} cheDo=${tCat2.cheDo}`);
  ['MAY', 'QC', 'DG', 'KN', 'GIT'].forEach(ma => {
    const t = thu(ma, true);
    kiem(`cong doan ${ma} -> KHONG ve, va DON SACH rac cua lan truoc`,
         t.daVe === 0 && t.con === '', `ve=${t.daVe} con=${JSON.stringify(t.con)}`);
  });
  const tLa = thu(null, true);
  kiem('stage la (khong co trong map) -> khong ve, don sach (fail-safe ve KHONG hien)',
       tLa.daVe === 0 && tLa.con === '', `ve=${tLa.daVe} con=${JSON.stringify(tLa.con)}`);
  let vo = false;
  try { thu('CAT', false); } catch (e) { vo = true; }
  kiem('🔴 thieu #daiSizeHost -> KHONG nem loi (ca form ghi tien do khong chet theo)', !vo);
}
/* Ba noi PHAI di qua veTheoCongDoan: mo form, doi o chon, va nhay thang (jumpStageCode).
   Thieu bat ky cai nao la khung khong theo kip cong doan dang chon. */
kiem('o chon cong doan goi veTheoCongDoan (mo form / doi / nhay thang) — du 3 noi',
     (fe.match(/veTheoCongDoan\(/g) || []).length >= 3,
     'dem duoc ' + (fe.match(/veTheoCongDoan\(/g) || []).length);
kiem('🔴 renderStageFields KHONG con duoc goi thang o ba noi do (phai qua veTheoCongDoan)',
     !/addEventListener\('change', \(e\) => renderStageFields\(/.test(fe)
       && !/sel\.value = String\(js\.StageID\); renderStageFields\(/.test(fe),
     'goi thang la doi cong doan ma khung dai size van giu noi dung cua cong doan truoc');
/* `function renderDaiSizeBar(box, …)` la DINH NGHIA — dem LOI GOI phai tru no ra, khong thi do oan. */
const goiVeKhung = (fe.match(/renderDaiSizeBar\(/g) || []).length - 1;
const viTriHost = fe.indexOf('<div id="daiSizeHost"></div>');
const viTriStage = fe.indexOf('<div id="pStageFields"></div>');
kiem('host #daiSizeHost VAN nam NGOAI (va TRUOC) #pStageFields, chi ve tu capNhatKhungDaiSize',
     viTriHost > 0 && viTriStage > 0 && viTriHost < viTriStage
       /* v9.39: HAI loi goi — KT ve che do 'DAI', CAT ve che do 'MAU'. Ca hai deu trong
          capNhatKhungDaiSize, van KHONG ve vao `box` cua renderStageFields. */
       && goiVeKhung === 2
       && /renderDaiSizeBar\(hostDai, maDH, perm, detail, 'DAI'\)/.test(fe)
       && /renderDaiSizeBar\(hostDai, maDH, perm, detail, 'MAU'\)/.test(fe),
     've lai ben trong box la lai bi cac duong async ghi de innerHTML nuot mat (ho loi v8.79->v9.13); dem duoc ' + goiVeKhung + ' loi goi');

console.log('\n=== 4b. 🔴 TY LE CHIA VAI GIUA CAC DAI (v9.39) ===');
/* Nguyen 2026-11-10: "Chi can ghi ty le size nay bao nhieu ty le size kia bao nhieu".
   🔴 KHONG phai "met so do tung size": mot so do chay CHUNG, chi tiet moi size nam LAN LON tren
   cung mot la vai nen khong do duoc met rieng cho tung size (ban nhap dau cua toi, Nguyen bac bo).
   Chay THAT ham tyLeTheoMet(), khong so chuoi. */
const thanTyLe = trichHam(fe, 'function tyLeTheoMet()');
kiem('trich duoc tyLeTheoMet()', !!thanTyLe);
if (thanTyLe) {
  const chay = (rows, laMau) => {
    const s = { rows, laMau: () => !!laMau };
    vm.runInNewContext(`${thanTyLe}; __r = tyLeTheoMet();`, s);
    return s.__r;
  };
  const r1 = chay([{ tenDai: '2-7', heSo: 6, tyLeVai: 1.2 }, { tenDai: '8-12', heSo: 5, tyLeVai: 1.8 }]);
  kiem('du so -> tra ty le', !!r1 && Math.abs(r1.tong - 3) < 1e-9, JSON.stringify(r1 && r1.tong));
  if (r1) {
    const v = [...r1.map.values()];
    kiem('🔴 ty le theo SO DA KHAI, KHONG theo he so (1.2/3 = 40%, khong phai 6/11 = 54.5%)',
         Math.abs(v[0] - 0.4) < 1e-9 && Math.abs(v[1] - 0.6) < 1e-9,
         v.map(x => (x * 100).toFixed(1) + '%').join(' / '));
  }
  /* DON VI TU DO: 40/60 phai ra y het 0.8/1.2 — he thong chi lay TY LE. */
  const r2 = chay([{ tenDai: 'A', heSo: 1, tyLeVai: 40 }, { tenDai: 'B', heSo: 1, tyLeVai: 60 }]);
  kiem('🔴 don vi TU DO: 40/60 cho cung ket qua voi 0.8/1.2',
       !!r2 && Math.abs([...r2.map.values()][0] - 0.4) < 1e-9);
  kiem('🔴 KHUYET mot dai -> tra null (lui ve chia theo he so, KHONG tu bia ty le nua voi)',
       chay([{ tenDai: '2-7', heSo: 6, tyLeVai: 1.2 }, { tenDai: '8-12', heSo: 5, tyLeVai: '' }]) === null);
  kiem('so = 0 cung coi la chua khai', chay([{ tenDai: 'A', heSo: 1, tyLeVai: 0 }]) === null);
  kiem('chua co dai nao -> null, khong vo', chay([]) === null);
  kiem('bo qua dong chua dat ten (dong trong cua form)',
       (() => { const r = chay([{ tenDai: '2-7', heSo: 6, tyLeVai: 2 }, { tenDai: '', heSo: '', tyLeVai: '' }]);
                return !!r && Math.abs(r.tong - 2) < 1e-9; })());
  kiem('🔴 kieu MAU -> LUON null (cac mau chung mot dai size nen ty le vai bang nhau)',
       chay([{ tenDai: 'Mau 1', heSo: 6, tyLeVai: 1 }, { tenDai: 'Mau 2', heSo: 6, tyLeVai: 9 }], true) === null,
       'hoi mot con so ma cau tra loi da biet truoc = moi nguoi dung go bua roi lay so bua di tinh gia thanh');
}
kiem('hop thoai tach co o nhap ty le + cot %',
     /class="ds-met"/.test(fe) && /class="ds-tyle"/.test(fe));
kiem('o ty le duoc dong bo khi go (khong mat so luc Luu)', /if \(om\) r\.tyLeVai = om\.value;/.test(fe));
kiem('cot % cap nhat TUNG DONG, khong ve lai bang (ve lai = mat con tro dang go)',
     /box\.querySelectorAll\('\[data-dsrow\]'\)\.forEach\(el => \{[\s\S]{0,300}ds-tyle/.test(fe));
kiem('🔴 backend ghi TyLeVai kieu DECIMAL, KHONG phai Int (1.25 bi parseInt im lang thanh 1)',
     /input\('TyLeVai', sql\.Decimal\(10, 4\)/.test(be));
kiem('backend do cot truoc khi ghi (chua chay migration_v889 van luu duoc dai size)',
     /coCotQLSX\(pool, 'DonHangDaiSize', 'TyLeVai'\)/.test(be)
       && /\$\{coCotMet \? ', TyLeVai=@TyLeVai' : ''\}/.test(be));
kiem('🔴 getDaiSizeList TRA RA TyLeVai (khong thi mo lai hop thoai la o trang, luu de len NULL)',
     /coMet \? 'TyLeVai' : 'CAST\(NULL AS DECIMAL\(10,4\)\) AS TyLeVai'/.test(be));

console.log('\n=== 5. BUMP ===');
kiem('index.html bump module.qlsx.js?v >= 9.42', (() => {
  const m = html.match(/module\.qlsx\.js\?v=([\d.]+)/);
  return !!m && parseFloat(m[1]) >= 9.42;
})());
kiem('co database/migration_v889.sql (cot TyLeVai)',
     fs.existsSync(path.join(GOC, 'database', 'migration_v889.sql')));
kiem('🔴 DA GOP migration_v889 vao CAI_DAT_DAY_DU.sql', (() => {
  /* 🔴 v9.39: cot doi ten MetSoDo -> TyLeVai va doi do chinh xac (10,2) -> (10,4). Phep nay ghim
     NGUYEN VAN cau ALTER nen doi ten cot ma quen sua day = DO OAN, exit 1. */
  const s = fs.readFileSync(path.join(GOC, 'database', 'CAI_DAT_DAY_DU.sql'), 'utf8');
  return /migration_v889\.sql/.test(s) && /DonHangDaiSize ADD TyLeVai DECIMAL\(10,4\) NULL/.test(s);
})());

console.log('\n=== 4d. 🔴 PUT /daisize GIU DUOC tyLeVai TU CLIENT (v9.39) ===');
/* 🔴 Day la phep HANH VI, khong phai so chuoi — vi chinh cho nay da lot luoi mot lan: dong
   `rq.input('TyLeVai', sql.Decimal(10,4), metCuaDong(r.tyLeVai))` CO THAT trong file (nen moi phep
   so chuoi deu XANH), nhung object dung o tren lai khong mang `tyLeVai` sang => luon ghi NULL, va
   cau UPDATE con DE NULL len so da khai. Tinh nang chet ma bo kiem bao dat.
   Chay THAT doan .map() tren du lieu gia. */
{
  const than = (be.match(/const rows = \(Array\.isArray\(req\.body\.rows\)[\s\S]{0,400}?\.filter\(r => r\.tenDai !== ''\);/) || [])[0];
  kiem('trich duoc doan dung `rows` cua PUT /daisize', !!than);
  if (than) {
    const s = { req: { body: { rows: [{ id: '3', tenDai: ' 2-7 ', heSo: '6', tyLeVai: '1.25' }] } } };
    vm.runInNewContext(than + '; __r = rows;', s);
    const r0 = s.__r && s.__r[0];
    kiem('🔴 tyLeVai KHONG bi .map() vut mat', !!r0 && r0.tyLeVai !== undefined,
         'undefined o day = metCuaDong() tra null = ghi NULL de len so nguoi dung vua go');
    kiem('tyLeVai giu nguyen GIA TRI (1.25 chu khong phai 1)', !!r0 && Number(r0.tyLeVai) === 1.25);
    kiem('tenDai van duoc trim, heSo van thanh so', !!r0 && r0.tenDai === '2-7' && r0.heSo === 6);
  }
}

console.log('\n=== 4e. 🔴 HE SO MAC DINH CUA CAY O SO CAT LAY TU TACH DAI (v9.42) ===');
/* Nguyen 2026-11-10: *"hoac se tu lay tong he so tu tach dai size o ky thuat sang, cong doan cat
   khong phai dien"*. Lam NUA do — dien san — nhung KHONG khoa o: tach dai la KE HOACH, so cat la
   CAI DA XAY RA (luat "he so that nam o so cat", tra gia 3 lan v8.31/48/52).
   🔴 Phep quan trong nhat o day: HAI noi cung quyet mot gia tri (frontend dien san, backend lui ve
   khi client gui rong) PHAI ra CUNG mot so. Lech nhau = dong co o he so rong duoc GHI bang mot con
   so khac con so nguoi dung vua nhin thay => sai thang vao SL cat, tuc vao luong cat va gia thanh. */
{
  /* --- Frontend: chay THAT bieu thuc tinh heSoTuTachDai --- */
  const than = (fe.match(/const heSoTuTachDai = \(\(\) => \{[\s\S]{0,600}?\}\)\(\);/) || [])[0];
  kiem('trich duoc heSoTuTachDai o frontend', !!than);

  /* --- Backend: chay THAT than ham heSoMacDinhCayCat --- */
  const thanBE = trichHam(be, 'async function heSoMacDinhCayCat(');
  kiem('trich duoc heSoMacDinhCayCat o backend', !!thanBE);

  if (than && thanBE) {
    const chayFE = (ds) => {
      const s = { dsDaiCuaLenh: ds, Number, String,
                  laTachMauLenh: ds.some(d => String(d.LoaiTach || '').toUpperCase() === 'MAU') };
      vm.runInNewContext(than + '; __r = heSoTuTachDai;', s);
      return s.__r;
    };
    /* Backend la ham async. 🔴 KHONG duoc kiem no trong mot IIFE async: ket qua se in SAU dong tong
       ket va KHONG cong vao bien `sai` — bo kiem bao "0 sai" roi moi xo ra may dong do, dung kieu
       cong cu tu lam minh mat tin. Phan logic cua ham von dong bo (chi co mot `await getDaiSizeList`),
       nen bo `async`/`await` di roi cho ban gia tra THANG mang: chay dung THAN HAM THAT, dong bo. */
    const thanBESync = thanBE.replace(/^async\s+/, '').replace(/await\s+getDaiSizeList/, 'getDaiSizeList');
    kiem('than heSoMacDinhCayCat chi co DUNG MOT cho await (neu khac, phep duoi dang kiem ban da bi cat xen)',
         (thanBE.match(/await /g) || []).length === 1);
    const chayBE = (ds, heSoLenh) => {
      const s = { getDaiSizeList: () => ds, Number, String, console, __order: { HeSoQuyDoi: heSoLenh } };
      vm.runInNewContext(thanBESync + '; __r = heSoMacDinhCayCat(null, 1, __order);', s);
      return s.__r;
    };

    const dsDai = [{ TenDai: '2-7', HeSo: 6, LoaiTach: 'DAI' }, { TenDai: '8-12', HeSo: 5, LoaiTach: 'DAI' }];
    const dsMau = [{ TenDai: 'Mau 1', HeSo: 6, LoaiTach: 'MAU' }, { TenDai: 'Mau 2', HeSo: 6, LoaiTach: 'MAU' }];
    const dsKhuyet = [{ TenDai: '2-7', HeSo: 6, LoaiTach: 'DAI' }, { TenDai: '8-12', HeSo: 0, LoaiTach: 'DAI' }];

    kiem('🔴 tach DAI SIZE -> CONG DON (6 + 5 = 11): mot lop cat ra ca ri gom moi dai',
         chayFE(dsDai) === 11);
    kiem('🔴 tach MAU -> KHONG cong don, lay he so cua MOT mau (6, khong phai 12)',
         chayFE(dsMau) === 6,
         'cac mau dung CHUNG mot dai size nen he so cua chung bang nhau');
    kiem('khuyet he so mot dai -> 0 (lui ve he so cua lenh, KHONG doan)', chayFE(dsKhuyet) === 0);
    kiem('lenh khong tach -> 0 (lui ve he so cua lenh)', chayFE([]) === 0);

    /* 🔴 Phep so khop HAI PHIA. Doi mot ben ma quen ben kia la phep nay do dung luc. */
    [['tach DAI', dsDai, 3, 11],
     ['tach MAU', dsMau, 3, 6],
     ['khuyet he so', dsKhuyet, 3, 3],
     ['khong tach', [], 3, 3]
    ].forEach(([ten, ds, heSoLenh, mong]) => {
      const tu = chayFE(ds);
      const feV = tu > 0 ? tu : heSoLenh;   // heSoMacDinhCay = heSoTuTachDai > 0 ? heSoTuTachDai : heSoLenh
      let beV = null;
      try { beV = chayBE(ds, heSoLenh); } catch (e) { beV = 'LOI: ' + e.message; }
      kiem(`🔴 frontend va backend RA CUNG MOT SO — ${ten}`,
           feV === mong && beV === mong,
           `frontend=${feV} backend=${beV} mong doi=${mong}`);
    });
  }
}
kiem('o he so o so cat van SUA DUOC (khoa cung = bit duong khai su that khi ri thuc te khac)',
     /class="cat-heso"/.test(fe) && !/class="cat-heso"[^>]*readonly/.test(fe)
       && !/class="cat-heso"[^>]*disabled/.test(fe));
kiem('o he so dien san tu heSoMacDinhCay, KHONG con tu heSoQuyDoiDonHang',
     /class="cat-heso" value="\$\{p\.heSoQuyDoi \|\| heSoMacDinhCay\}"/.test(fe));
kiem('🔴 CANH BAO ngay tai dong khi he so lech voi tach dai (truoc v9.42 rang buoc chi co MOT chieu)',
     /cat-heso-canhbao/.test(fe) && /Lệch với/.test(fe),
     'backend chi chan khi luu TACH DAI; sua so cat lech thi khong gi bao, hai so nam lech im lang');
kiem('canh bao noi dung ban chat: GO NHAM, vi Nguyen xac nhan ri o xuong LUON du theo ke hoach',
     /nhiều khả năng gõ nhầm/.test(fe));
kiem('backend lui ve CUNG mot mac dinh (3 cho goi heSoCuaDong deu dung heSoMacDinhCayCat)',
     (be.match(/await heSoMacDinhCayCat\(pool, order\.DonHangID, order\)/g) || []).length === 3,
     'dem duoc ' + (be.match(/await heSoMacDinhCayCat\(pool, order\.DonHangID, order\)/g) || []).length
       + '/3 — sot mot cho la cho do ghi bang he so cua LENH, lech voi man hinh');
kiem('KHONG con cho nao lui ve Number(order.HeSoQuyDoi) || 1 trong luong ghi so cat',
     !/const heSoDonHang = Number\(order\.HeSoQuyDoi\) \|\| 1;/.test(be));

/* 🔴 CO HAI MAN cung ghi TienDoCatChiTietCay: openProgressForm (Ghi tien do Cat) va openSuaSoCatModal
   (Sua so cat). Ban dau v9.42 chi sua man thu nhat — ra soat cheo bat duoc. Sot man thu hai thi dung
   MOI lenh ma v9.42 co tac dung, hai man se dien san hai so khac nhau (1 vs 11) vao CUNG mot bang,
   sai 11 lan o cot di vao luong cat; va so cat mang hai he so => HeSoCatLech = 1 => heSoHieuLuc lui ve
   he so LENH => Dong goi/Kho nhap quy doi ri bang 1 => sap ca chuoi v8.92.
   Man do LUON gui he so tuong minh nen heSoMacDinhCayCat o may chu KHONG cuu duoc. */
{
  const thanSS = (fe.match(/const heSoTuTachDaiSS = \(\(\) => \{[\s\S]{0,600}?\}\)\(\);/) || [])[0];
  kiem('man SUA SO CAT cung tinh he so mac dinh tu tach dai', !!thanSS);
  if (thanSS) {
    const chaySS = (ds) => {
      const s = { dsDaiSS: ds, Number, String,
                  laTachMauSS: ds.some(d => String(d.LoaiTach || '').toUpperCase() === 'MAU') };
      vm.runInNewContext(thanSS + '; __r = heSoTuTachDaiSS;', s);
      return s.__r;
    };
    kiem('🔴 Sua so cat: tach DAI -> CONG DON (6+5=11), giong het man Ghi tien do',
         chaySS([{ HeSo: 6, LoaiTach: 'DAI' }, { HeSo: 5, LoaiTach: 'DAI' }]) === 11);
    kiem('🔴 Sua so cat: tach MAU -> KHONG cong don (6)',
         chaySS([{ HeSo: 6, LoaiTach: 'MAU' }, { HeSo: 6, LoaiTach: 'MAU' }]) === 6);
    kiem('Sua so cat: khuyet / khong tach -> 0 (lui ve he so lenh)',
         chaySS([{ HeSo: 6, LoaiTach: 'DAI' }, { HeSo: 0, LoaiTach: 'DAI' }]) === 0 && chaySS([]) === 0);
  }
}
kiem('🔴 Sua so cat KHONG dien de len he so cua dong DA LUU (so da xay ra)',
     /value="\$\{p\.HeSoQuyDoi != null \? p\.HeSoQuyDoi : heSo\}"/.test(fe),
     'dien de = sua mot o khac roi Luu la ghi lai lich su bang so moi');
kiem('Sua so cat CO canh bao lech ngay tai dong', /ss-heso-canhbao/.test(fe));
kiem('KHONG con lay mac dinh thang tu det.HeSoQuyDoi cho dong moi o Sua so cat',
     !/const heSo = Number\(det\.HeSoQuyDoi\) \|\| 1;/.test(fe),
     'day la dong da gay ra ca ĐO 1 — doi ten bien thi phep nay phai doi theo');

console.log('\n' + '='.repeat(70));
console.log(sai === 0 ? `✅ ${dat} phep DAT, 0 sai` : `❌ ${sai} SAI / ${dat + sai} phep`);
console.log('='.repeat(70) + '\n');
process.exit(sai === 0 ? 0 : 1);
