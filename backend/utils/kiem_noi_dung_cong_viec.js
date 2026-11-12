/* ================================================================================================
   kiem_noi_dung_cong_viec.js — bo tu kiem cho v9.35
   "Noi dung cong viec nhap tay, in vao MUC 1.5 cua hop dong"

   Nguyen 2026-11-09: "ky hop dong them truong noi dung cong viec de nhap tay va gan vao muc 1.5
   cua mau hop dong, vi moi nguoi 1 noi dung cu the khac nhau".

   🔴 Phep quan trong nhat (muc 2): BO TRONG o nhap thi muc 1.5 phai in NGUYEN VAN dieu khoan cu.
   1.5 la mot dieu khoan phap ly hoan chinh — in ra cho trong la lam hop dong THIEU DIEU KHOAN, ma
   khong ai phat hien duoc khi nhin man hinh. Hai mau co cau 1.5 KHAC NHAU nen fallback phai khac.

   Chay:  node backend\utils\kiem_noi_dung_cong_viec.js
   KHONG copy file nay sang D:\QLSX.
   ================================================================================================ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const GOC = path.join(__dirname, '..', '..');
const fe = fs.readFileSync(path.join(GOC, 'frontend', 'js', 'module.hrm.js'), 'utf8');
const be = fs.readFileSync(path.join(GOC, 'backend', 'routes', 'hrm.js'), 'utf8');
const html = fs.readFileSync(path.join(GOC, 'frontend', 'index.html'), 'utf8');
const docNeuCo = (...p) => fs.existsSync(path.join(GOC, ...p)) ? fs.readFileSync(path.join(GOC, ...p), 'utf8') : '';
const sqlMig = docNeuCo('database', 'migration_v887.sql');
const sqlDayDu = docNeuCo('database', 'CAI_DAT_DAY_DU.sql');
const kiemCu = docNeuCo('backend', 'utils', 'kiem_ho_so_nhan_su.js');

let sai = 0, dat = 0;
function kiem(ten, dung, td) {
  if (dung) { dat++; console.log('  ✓ ' + ten); }
  else { sai++; console.log('  ❌ ' + ten + (td ? ' — ' + td : '')); }
}
function trich(nguon, moc, mo, dong) {
  const i = nguon.indexOf(moc);
  if (i < 0) return null;
  let sau = 0, j = nguon.indexOf(mo, i);
  if (j < 0) return null;
  for (; j < nguon.length; j++) {
    if (nguon[j] === mo) sau++;
    else if (nguon[j] === dong) { sau--; if (sau === 0) return nguon.slice(i, j + 1); }
  }
  return null;
}

console.log('\n=== 1. BIEN DICH (thay cho node --check) ===');
[['frontend/js/module.hrm.js', fe], ['backend/routes/hrm.js', be]].forEach(([f, s]) => {
  try { new vm.Script(s, { filename: f }); dat++; console.log('  ✓ ' + f); }
  catch (e) { sai++; console.log('  ❌ ' + f + ' VO CU PHAP: ' + e.message); }
});

console.log('\n=== 2. 🔴 BO TRONG -> MUC 1.5 VAN IN NGUYEN VAN DIEU KHOAN CU ===');
/* Chay THAT: trich NDCV_MAC_DINH + thayBien tu file roi dung chinh chung de dung lai cau 1.5. */
const khoiMacDinh = trich(fe, 'const NDCV_MAC_DINH = {', '{', '}');
const thanThayBien = trich(fe, 'function thayBien(', '{', '}');
kiem('trich duoc NDCV_MAC_DINH va thayBien()', !!khoiMacDinh && !!thanThayBien);

let MD = null, thayBien = null;
if (khoiMacDinh && thanThayBien) {
  const s = {};
  try {
    vm.runInNewContext(`${khoiMacDinh}; ${thanThayBien}; __md = NDCV_MAC_DINH; __tb = thayBien;`, s);
    MD = s.__md; thayBien = s.__tb;
  } catch (e) { kiem('chay duoc NDCV_MAC_DINH/thayBien', false, e.message); }
}

if (MD && thayBien) {
  kiem('co cau mac dinh cho CA HAI mau',
       typeof MD.HDLD_CHINHTHUC === 'string' && MD.HDLD_CHINHTHUC.length > 40
         && typeof MD.HDLD_THUVIEC === 'string' && MD.HDLD_THUVIEC.length > 40,
       JSON.stringify(Object.keys(MD)));
  kiem('🔴 hai cau mac dinh KHAC NHAU (hop dong thu viec co dieu khoan rieng)',
       MD.HDLD_CHINHTHUC !== MD.HDLD_THUVIEC,
       'dung chung mot cau = hop dong thu viec cu in ra khac ban da ky');
  kiem('cau mac dinh KHONG rong, KHONG chi la dau cham',
       !/^[\s.]*$/.test(MD.HDLD_CHINHTHUC) && !/^[\s.]*$/.test(MD.HDLD_THUVIEC));

  /* Dung lai dung canh "bo trong": thay {{NoiDungCongViec}} bang cau mac dinh. */
  const mau15 = '<p style="margin:0 0 10px;">1.5. Nội dung công việc: {{NoiDungCongViec}}</p>';
  ['HDLD_CHINHTHUC', 'HDLD_THUVIEC'].forEach(ma => {
    const ra = thayBien(mau15, { NoiDungCongViec: MD[ma] });
    kiem(`${ma}: bo trong -> cau 1.5 in ra DU dieu khoan`,
         ra.indexOf('{{') < 0 && ra.indexOf(MD[ma]) > 0 && ra.length > mau15.length,
         ra.slice(0, 80));
  });

  /* Co noi dung rieng thi phai thay dung cai do, khong con dau vet cua cau mac dinh. */
  const rieng = 'Vận hành máy may 1 kim; kiểm tra đường may.';
  const ra = thayBien(mau15, { NoiDungCongViec: rieng });
  kiem('co noi dung rieng -> in dung noi dung do, khong kem cau mac dinh',
       ra.indexOf(rieng) > 0 && ra.indexOf(MD.HDLD_CHINHTHUC) < 0);

  /* 🔴 thayBien KHONG he escape — chung minh bang hanh vi, de biet vi sao escapeHtml PHAI nam o
     bienChoHopDong. Noi dung cong viec la chu nguoi dung go, chen thang vao trang in. */
  const doc = thayBien(mau15, { NoiDungCongViec: '<script>x</script>' });
  kiem('🔴 thayBien() KHONG tu escape -> escapeHtml BAT BUOC o bienChoHopDong',
       doc.indexOf('<script>') > 0,
       'neu phep nay doi chieu nguoc lai thi da co ai do them escape vao thayBien - ra soat lai');

  /* Bien go sai ten phai GIU NGUYEN {{X}} (quy uoc da chot v8.85) — khong bien thanh chuoi rong. */
  kiem('bien la giu nguyen {{X}} (quy uoc v8.85, khong nuot im lang)',
       thayBien('a {{KhongCoThat}} b', { NoiDungCongViec: 'x' }) === 'a {{KhongCoThat}} b');
}

console.log('\n=== 3. MAU GOC: 1.5 da thanh placeholder o CA HAI mau ===');
/* 🔴 LOC COMMENT TRUOC MOI PHEP DEM. Chinh cau ghi chu cua v9.35 co nhac "{{NoiDungCongViec}}"
   (module.hrm.js ~1423, giai thich nut chen bien o man sua mau) nen dem tren ban THO ra 3, phep
   "dung 2" do oan va exit 1 — ra soat cheo bat duoc, va day la lan thu TU vap dung bay nay
   (feedback_qlnoibo_bo_tu_kiem_phai_loc_comment). */
const feMa = fe.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const soCho = (feMa.match(/\{\{NoiDungCongViec\}\}/g) || []).length;
kiem('MAU_GOC co DUNG 2 cho {{NoiDungCongViec}} (chinh thuc + thu viec)',
     soCho === 2, 'dem duoc ' + soCho + ' (da loc comment)');
kiem('ca hai cho deu nam o muc "1.5. Nội dung công việc:"',
     (feMa.match(/1\.5\. Nội dung công việc: \{\{NoiDungCongViec\}\}/g) || []).length === 2);
/* Cau cung cu phai BIEN MAT khoi MAU_GOC — con sot la mau do khong nhan noi dung nhap tay. */
kiem('🔴 cau 1.5 CUNG da bi go khoi MAU_GOC (khong con ban nao bo qua o nhap)',
     feMa.indexOf('1.5. Nội dung công việc: thực hiện công việc theo chức danh') < 0
       && feMa.indexOf('1.5. Nội dung công việc: theo chức danh nêu trên') < 0);

console.log('\n=== 4. FORM + PAYLOAD + MAN XEM ===');
kiem('form co o nhap textarea #f_ndcv', /id="f_ndcv"/.test(fe) && /<textarea id="f_ndcv"/.test(fe));
kiem('payload gui noiDungCongViec', /noiDungCongViec: val\(modal, 'f_ndcv'\)/.test(fe));
kiem('o nhap do san gia tri cu khi SUA hop dong (khong trang bang)',
     /escapeHtml\(h\.NoiDungCongViec \|\| ''\)/.test(fe),
     'quen cho = moi lan sua hop dong la mat noi dung da khai');
kiem('man XEM hop dong hien noi dung cong viec', /\['Nội dung công việc \(mục 1\.5\)', h\.NoiDungCongViec\]/.test(fe));
kiem('printHopDong truyen MA MAU vao bienChoHopDong (de lui ve dung cau cua mau do)',
     /bienChoHopDong\(h, nv, maMau\)/.test(fe));
kiem('bienChoHopDong nhan tham so maMau', /function bienChoHopDong\(h, nv, maMau\)/.test(fe));

console.log('\n=== 5. BACKEND: co do cot RIENG, khong gop vao COT_HD_V882 ===');
kiem('co ham do cot rieng coCotNoiDungCongViec', /async function coCotNoiDungCongViec\(pool\)/.test(be));
kiem('🔴 KHONG gop NoiDungCongViec vao COT_HD_V882',
     !/COT_HD_V882 = \[[^\]]*NoiDungCongViec/.test(be),
     'gop vao la may da chay v877 nhung chua chay v887 bi Invalid column name => VO ca them lan sua');
/* Kiem theo CAU TRUC than ham chu khong theo TEN BIEN: cam dung 2 cai ten thi ai cache bang
   `let __ndcv = null` la lot (ra soat cheo chi ra). Than ham phai LUON goi pool.request(), khong
   duoc nam trong nhanh if, va khong duoc gan ra bien ngoai. */
const thanDoCot = (() => {
  const i = be.indexOf('async function coCotNoiDungCongViec(pool)');
  if (i < 0) return null;
  let mo = 0, j = be.indexOf('{', i);
  for (; j < be.length; j++) {
    if (be[j] === '{') mo++;
    else if (be[j] === '}') { mo--; if (mo === 0) return be.slice(i, j + 1); }
  }
  return null;
})();
kiem('🔴 KHONG cache ket qua do cot (cache song qua migration = go xong mat trang)',
     !!thanDoCot && /pool\.request\(\)/.test(thanDoCot) && !/if\s*\(/.test(thanDoCot)
       && !/===\s*null/.test(thanDoCot),
     'xem feedback_qlnoibo_chay_migration_sau_pm2_phai_restart; than ham: '
       + JSON.stringify(String(thanDoCot).slice(0, 120)));
kiem('🔴 khai sql.MAX cho tham so (NVarChar tran cat cut o 4000 ky tu, KHONG bao loi)',
     /input\('NoiDungCongViec', sql\.NVarChar\(sql\.MAX\)/.test(be));
kiem('CA INSERT lan UPDATE deu ghep manh NDCV',
     /\$\{cotNDCV\(coNDCV\)\}/.test(be) && /\$\{thamSoNDCV\(coNDCV\)\}/.test(be)
       && /\$\{ganNDCV\(coNDCV\)\}/.test(be),
     'thieu mot ve la luu duoc khi THEM nhung mat khi SUA (hoac nguoc lai)');
kiem('ba manh ghep SQL deu tra chuoi RONG khi chua co cot',
     /const cotNDCV = \(co\) => \(co \? ', NoiDungCongViec' : ''\);/.test(be)
       && /const thamSoNDCV = \(co\) => \(co \? ', @NoiDungCongViec' : ''\);/.test(be)
       && /const ganNDCV = \(co\) => \(co \? ', NoiDungCongViec=@NoiDungCongViec' : ''\);/.test(be));

console.log('\n=== 6. BO KIEM CU PHAI BIET BIEN MOI (keo khong do oan) ===');
kiem("kiem_ho_so_nhan_su.js da them 'NoiDungCongViec' vao BIEN_RIENG",
     /'NoiDungCongViec'/.test(kiemCu),
     'thieu = bo kiem cu bao "bien khong co that: NoiDungCongViec" cho CA HAI mau, exit 1');

console.log('\n=== 7. MIGRATION + BUMP ===');
kiem('co database/migration_v887.sql', !!sqlMig);
kiem('them cot NVARCHAR(MAX) NULL vao DUNG bang HopDongLaoDong',
     /ALTER TABLE HopDongLaoDong ADD NoiDungCongViec NVARCHAR\(MAX\) NULL;/.test(sqlMig));
kiem('chay lai nhieu lan khong hong (co guard COL_LENGTH)',
     /IF COL_LENGTH\('HopDongLaoDong', 'NoiDungCongViec'\) IS NULL/.test(sqlMig));
kiem('KHONG xoa/sua du lieu nghiep vu nao',
     !/DELETE FROM/i.test(sqlMig) && !/DROP TABLE/i.test(sqlMig) && !/UPDATE HopDongLaoDong/i.test(sqlMig));
kiem('🔴 DA GOP vao CAI_DAT_DAY_DU.sql (may cai moi khong co cot thi o nhap cam tiet)',
     /NoiDungCongViec/.test(sqlDayDu) && /migration_v887\.sql/.test(sqlDayDu),
     'quy tac da ghi trong memory: migration moi phai gop vao file cai dat day du');
/* So SO, khong ghim chuoi — ban sau cung phai xanh. */
kiem('index.html bump module.hrm.js?v >= 9.35', (() => {
  const m = html.match(/module\.hrm\.js\?v=([\d.]+)/);
  return !!m && parseFloat(m[1]) >= 9.35;
})());

/* ================================================================================================
   MUC 8 CHAY BAT DONG BO (inVanBan la async) nen phai nam CUOI CUNG, neu khong ket qua cua no in
   lan vao giua cac muc khac — bao cao lon xon thi khong ai tin no nua.
   ================================================================================================ */
function ketLuan() {
  console.log('\n' + '='.repeat(70));
  console.log(sai === 0 ? `✅ ${dat} phep DAT, 0 sai` : `❌ ${sai} SAI / ${dat + sai} phep`);
  console.log('='.repeat(70) + '\n');
  process.exit(sai === 0 ? 0 : 1);
}

console.log('\n=== 8. 🔴 MAU DA SUA MA THIEU CHO CAM -> PHAI BAO, dung in roi im ===');
/* Ra soat cheo bat duoc lo nay. `layMau()` uu tien ban nguoi dung da sua trong CSDL hon MAU_GOC. Ai
   sua mau HDLD TRUOC v9.35 thi ban cua ho con cau 1.5 CUNG => nhan su go noi dung, luu duoc (CSDL co
   that), man Xem hien dung, ma BAN IN RA VAN CAU CU. Hong im lang tren van ban phap ly dem di ky.
   Kiem bang HANH VI: chay THAT ham inVanBan voi mau thieu cho cam, xem no co toast loi khong. */
const thanInVanBan = trich(fe, 'async function inVanBan(', '{', '}');
kiem('trich duoc inVanBan()', !!thanInVanBan);
if (!thanInVanBan) { ketLuan(); } else {
  const thuIn = async (mauGia, bienGia, canCo) => {
    const moi = {
      napMauDaSua: async () => {},
      layMau: () => mauGia,
      thayBien: (m, b) => String(m).replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g,
        (ca, t) => Object.prototype.hasOwnProperty.call(b, t) ? b[t] : ca),
      wrapA4: (x) => x,
      printHtml: () => { moi.__daIn = true; },
      toast: (tin, kieu) => { moi.__loi.push({ tin, kieu }); },
      IN_VAN_BAN: {}, __daIn: false, __loi: []
    };
    const ctx = vm.createContext(moi);
    vm.runInContext(`${thanInVanBan}; __p = inVanBan('HDLD_CHINHTHUC', ${JSON.stringify(bienGia)},`
      + ` 'x', ${canCo ? JSON.stringify(canCo) : 'undefined'});`, ctx);
    await moi.__p;
    return { loi: moi.__loi, daIn: moi.__daIn };
  };
  const CO_CHO = '<p>1.5. Nội dung công việc: {{NoiDungCongViec}}</p>';
  const THIEU_CHO = '<p>1.5. Nội dung công việc: theo chức danh nêu trên.</p>';
  (async () => {
    let r = await thuIn(THIEU_CHO, { NoiDungCongViec: 'Vận hành máy may' }, ['NoiDungCongViec']);
    kiem('🔴 mau THIEU cho cam + co noi dung -> CO bao loi',
         r.loi.length === 1 && r.loi[0].kieu === 'error', JSON.stringify(r.loi));
    kiem('…va VAN IN (cau 1.5 cu la dieu khoan hoan chinh; chan in thi khong ky duoc hop dong nao)',
         r.daIn === true);
    kiem('cau bao noi RO ten bien va chi duong sua',
         r.loi.length === 1 && r.loi[0].tin.indexOf('{{NoiDungCongViec}}') >= 0
           && /Mẫu văn bản/.test(r.loi[0].tin), JSON.stringify(r.loi));

    r = await thuIn(THIEU_CHO, { NoiDungCongViec: '   ' }, ['NoiDungCongViec']);
    kiem('mau thieu cho cam nhung hop dong DE TRONG -> IM, dung lam phien',
         r.loi.length === 0 && r.daIn === true, JSON.stringify(r.loi));

    r = await thuIn(CO_CHO, { NoiDungCongViec: 'Vận hành máy may' }, ['NoiDungCongViec']);
    kiem('mau CO cho cam -> im, in binh thuong', r.loi.length === 0 && r.daIn === true);

    r = await thuIn(THIEU_CHO, { NoiDungCongViec: 'x' }, null);
    kiem('KHONG truyen canCoBien -> khong vo (5 man in khac van goi 3 tham so nhu cu)',
         r.daIn === true && r.loi.length === 0, JSON.stringify(r.loi));
    ketLuan();
  })().catch(e => { kiem('chay duoc inVanBan trong vm', false, e.message); ketLuan(); });
}
