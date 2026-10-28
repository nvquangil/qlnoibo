/* ================================================================================================
   KIEM CHUNG v9.05 — O TIM KY TU BAT KY CHO MOI DANH SACH
   ------------------------------------------------------------------------------------------------
   Nguyen 2026-10-26: "ra soat het cac danh sach chuc nang chua co tim kiem, bo sung tim kiem ky tu
   bat ky". Kiem ke ra 102 man danh sach, 66 man chua co o tim.

   CACH LAM (quan trong, doc truoc khi sua bat ky phep kiem nao ben duoi):
   KHONG sua ben trong chuoi HTML cua 15 file module. Thay vao do common.js co hai ham dung chung
   tu DUNG o tim roi chen ngay tren bang, nen moi man chi them MOT dong goi sau khi ve xong. Ly do:
   sua 66 cho ben trong template literal la gan nhu chac chan co mot lan dat nham dau nhay nguoc,
   loi do da lam SAP may chay that hai lan (v7.98, v8.73).

   BA CHO DE SAI, moi cho mot nhom phep kiem:
     1. chuoiTimCuaDong phai BO nut/o nhap nhung GIU the a (so phieu, ma hang la link).
     2. Man da co o tim rieng (tu che) KHONG duoc goi them themOTimTuDong => hai o tim chong nhau.
     3. Bang ve lai tbody ma giu nguyen the table phai GAN LAI o tim, khong thi o cu giu danh sach
        dong cu va loc truot het (hong im lang).

   Chay:  node backend\utils\kiem_o_tim_moi_danh_sach.js   (tu thu muc goc QLNoiBo)
   ================================================================================================ */
const fs = require('fs');
const path = require('path');
const G = path.join(__dirname, '..');
const JS = (f) => path.join(G, '../frontend/js/', f);
const doc = (p) => fs.readFileSync(p, 'utf8');

let dat = 0, truot = 0;
const OK = (m) => { dat++; console.log('  OK   ' + m); };
const NO = (m) => { truot++; console.log('  SAI  ' + m); };
const kiem = (dk, m) => (dk ? OK(m) : NO(m));

// Bo comment truoc khi kiem "KHONG duoc chua X". Dau mo comment chi tinh khi dung sau ky tu mo
// hop le, khong thi chuoi accept="image/ *" (viet lien) bi coi la mo comment va nuot mat code that.
const boComment = (s) => s
  .replace(/(^|[\s{(:;,=])\/\*[\s\S]*?\*\//g, '$1 ')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

const sCommon = doc(JS('common.js'));
const mCommon = boComment(sCommon);
const sIndex = doc(path.join(G, '../frontend/index.html'));

console.log('\n=== 1. common.js: ba ham dung chung ===');
kiem(/^function chuoiTimCuaDong\(tr\) \{/m.test(mCommon), 'co chuoiTimCuaDong(tr)');
kiem(/^function themOTim\(goc, opts\) \{/m.test(mCommon), 'co themOTim(goc, opts)');
kiem(/^function themOTimTuDong\(goc, opts\) \{/m.test(mCommon), 'co themOTimTuDong(goc, opts)');

console.log('\n=== 2. chuoiTimCuaDong: bo nut, GIU the a ===');
const iCT = mCommon.indexOf('function chuoiTimCuaDong');
const fCT = iCT >= 0 ? mCommon.slice(iCT, mCommon.indexOf('\n}', iCT) + 2) : '';
kiem(/button/.test(fCT) && /select/.test(fCT) && /input/.test(fCT) && /textarea/.test(fCT),
  'bo button + select + input + textarea khoi chuoi tim');
kiem(/\[data-notim\]/.test(fCT), 'van ton trong data-notim nhu cu (khong pha man da gan)');
/* 🔴 The a PHAI duoc giu: so phieu / ma hang / ma don hau het la link mo chi tiet — bo chung la
   tim khong ra chinh thu nguoi ta tim nhieu nhat. Kiem bang cach soi danh sach the bi bo. */
const dsBo = (fCT.match(/const BO = '([^']+)'/) || [])[1] || '';
kiem(dsBo.length > 0, 'doc duoc danh sach the bi bo  [' + dsBo + ']');
kiem(!/(^|[\s,])a([\s,]|$)/.test(dsBo), 'KHONG bo the a — so phieu / ma hang la link, phai tim duoc');
kiem(/cloneNode\(true\)/.test(fCT), 'nhan ban o roi moi go nut (khong pha DOM that)');
kiem(/if \(!td\.querySelector\(BO\)\) return/.test(fCT),
  'chi nhan ban khi o DO co nut — bang vai tram dong moi khong khung');

console.log('\n=== 3. wireTableSearch dung chung mot luat ===');
kiem(/tr\.dataset\.tim = chuoiTimCuaDong\(tr\);/.test(mCommon),
  'wireTableSearch dung chuoiTimCuaDong (khong con ban ghep chuoi rieng)');
kiem(/table\.dataset\.coOTim = '1';/.test(mCommon), 'danh dau coOTim de khong sinh o tim thu hai');
/* Phai danh dau TRUOC nhanh thoat som "bang rong", khong thi bang rong bi gan them o thu hai. */
const iWTS = mCommon.indexOf('function wireTableSearch');
const dauCoOTim = mCommon.indexOf("table.dataset.coOTim = '1';", iWTS);
const dauThoatRong = mCommon.indexOf('input.disabled = true; return;', iWTS);
kiem(dauCoOTim > iWTS && dauThoatRong > dauCoOTim,
  'danh dau coOTim TRUOC nhanh thoat som khi bang rong');

console.log('\n=== 4. themOTim: gan lai khi bang da ve lai dong ===');
const iTO = mCommon.indexOf('function themOTim(goc');
const fTO = iTO >= 0 ? mCommon.slice(iTO, mCommon.indexOf('\nfunction themOTimTuDong', iTO)) : '';
kiem(/dongDau\.dataset\.tim/.test(fTO), 'nhan ra dong moi chua co data-tim => phai gan lai o tim');
kiem(/table\.dataset\.oTimHop/.test(fTO) && /removeChild\(hopCu\)/.test(fTO),
  'go dung o tim cu truoc khi gan o moi (khong chong o)');
kiem(/data-khongtim/.test(fTO), 'ton trong co data-khongtim de man nao muon tu loai');
kiem(/querySelectorAll\('table'\)\.length === 1/.test(fTO),
  'treo len khoi lop boc cuon ngang, nhung dung lai khi lop boc co nhieu bang');
const iTTD = mCommon.indexOf('function themOTimTuDong');
/* Cat ĐÚNG tới ham ke tiep. Cat toi cuoi file thi hai phep kiem duoi day luon DAT du
   themOTimTuDong khong con chu nao trong do — vo dung (ra cheo v9.05 bat duoc). */
const jTTD = mCommon.indexOf('\nfunction ', iTTD + 10);
const fTTD = iTTD < 0 ? '' : mCommon.slice(iTTD, jTTD > iTTD ? jTTD : mCommon.length);
kiem(iTTD >= 0 && jTTD > iTTD, 'cat duoc dung pham vi themOTimTuDong');
kiem(!/coOTim/.test(fTTD.slice(0, fTTD.indexOf('themOTim(goc'))),
  'themOTimTuDong KHONG tu loai bang theo coOTim (de themOTim quyet dinh gan lai)');
kiem(/data-tong/.test(fTTD) && /laDongThongBao/.test(fTTD),
  'dem so dong KHONG tinh dong TONG va dong thong bao');

console.log('\n=== 4b. .empty-hint KHONG duoc dung lam dau hieu "dong thong bao" (bai hoc v8.07) ===');
/* .empty-hint con la KIEU CHU MO cho MOT O trong dong du lieu that ("chua ghe", "chua len phieu",
   "chua co toa do"...). querySelector('.empty-hint') do moi hau due nen bat nham ca dong do. */
kiem(/^function laDongThongBao\(tr\) \{/m.test(mCommon), 'co laDongThongBao(tr)');
const fLD = mCommon.slice(mCommon.indexOf('function laDongThongBao'));
kiem(/o\.length === 1/.test(fLD.slice(0, 300)), 'laDongThongBao doi NGUYEN DONG chi co MOT o');
const vungOTim = mCommon.slice(mCommon.indexOf('function chuoiTimCuaDong'));
kiem(!/querySelector\('\.empty-hint'\)/.test(vungOTim),
  'khong con cho nao dung querySelector(.empty-hint) de loai dong trong khoi o tim');
kiem(/hasAttribute\('data-tim'\)/.test(mCommon),
  'kiem data-tim bang hasAttribute (data-tim="" van la DA GAN)');

console.log('\n=== 5. Cac man da goi ham moi ===');
const GOI = [
  ['module.payroll.js', 6], ['module.hrm.js', 4], ['module.users.js', 2], ['module.mypay.js', 1],
  ['module.qlsx.js', 4], ['module.khohang.js', 3], ['module.khovai.js', 2], ['module.phukien.js', 3],
  ['module.congno.js', 1], ['module.baocao.js', 2], ['module.dms.js', 7], ['module.nhaplai.js', 1],
  ['module.hoadon.js', 1], ['module.dashboard.js', 1]
];
let tongGoi = 0;
GOI.forEach(([f, n]) => {
  const s = boComment(doc(JS(f)));
  const c = (s.match(/themOTimTuDong\(/g) || []).length;
  tongGoi += c;
  kiem(c === n, `${f}: ${n} cho goi themOTimTuDong  [dem duoc: ${c}]`);
});
kiem(tongGoi >= 38, `tong so cho goi >= 38  [dem duoc: ${tongGoi}]`);

console.log('\n=== 6. Man co o tim TU CHE khong duoc goi them (tranh hai o chong nhau) ===');
/* Moi cap: [file, id o tim tu che, ten ham render cua chinh man do].
   Luat: trong PHAM VI ham do khong duoc co themOTimTuDong. Rieng payroll co BA bang trong mot ham
   nen VAN goi, nhung phai danh dau lai bang cua #ccTim — kiem rieng ben duoi. */
const TUCHE = [
  ['module.khohang.js', 'khSearch', 'async function renderItems'],
  ['module.qlsx.js', 'qTim', 'async function renderOrders'],
  ['module.khovai.js', 'fSearch', 'async function renderRolls'],
  ['module.baocao.js', 'bcTim', 'async function renderTonKho'],
  ['module.baocao.js', 'gvTim', 'async function renderGiaVon']
];
TUCHE.forEach(([f, id, moc]) => {
  const s = boComment(doc(JS(f)));
  const i = s.indexOf(moc);
  if (i < 0) { NO(`${f}: khong tim thay ${moc} (doi ten ham? phai kiem lai tay)`); return; }
  // Cat toi ham ke tiep cung cap (dong bat dau bang 2 dau cach roi 'async function' / 'function').
  const j = s.slice(i + 10).search(/\n  (async )?function /);
  const than = j < 0 ? s.slice(i) : s.slice(i, i + 10 + j);
  kiem(than.indexOf(id) >= 0, `${f} :: ${moc} van co o tim tu che #${id}`);
  kiem(!/themOTimTuDong\(/.test(than),
    `${f} :: ${moc} KHONG goi themOTimTuDong (da co o tim rieng, goi them la hai o)`);
});
const sPay = boComment(doc(JS('module.payroll.js')));
kiem(/tbody tr\[data-tim\]'\)[\s\S]{0,200}coOTim = '1'/.test(sPay),
  'payroll: bang cong thang (#ccTim) duoc danh dau coOTim truoc khi goi themOTimTuDong');

console.log('\n=== 7. Hang muc sua kem ===');
const sKH = boComment(doc(JS('module.khohang.js')));
const iHM = sKH.indexOf("wireTableSearch(body, 'hmMa')");
kiem(iHM >= 0, 'Hang mau o khach: wireTableSearch tro dung o #hmMa (truoc day goi khong tham so => chet tu dau)');
/* ⚠️ KHONG duoc kiem "ca file khong chua wireTableSearch(body);" — renderBanHang goi dung nhu vay
   va HOP LE (man do co searchBoxHtml() nen dung o mac dinh #dmSearchBox). Chi soi vung Hang mau. */
kiem(iHM < 0 || !/wireTableSearch\(body\);/.test(sKH.slice(Math.max(0, iHM - 4000), iHM)),
  'Hang mau: khong con loi goi wireTableSearch(body) khong tham so');
kiem(!/const loMa = String\(hmLoc\.maHang/.test(sKH),
  'Hang mau: da bo TIEN LOC o phia du lieu (hai luat loc khac nhau tren cung mot o)');
/* Don khach dat hang CO Y khong gan o tim chung: applyOrderFilters cung ghi tr.style.display,
   dong don con tr[data-sub] mac dinh an, va #ordDemDong / dong TONG do capNhatDem/capNhatTong
   tinh rieng. Gan them bo loc thu hai la ba thu danh nhau. Kiem: giua hai moc cua ham do khong
   duoc co loi goi nao. */
const iDK = sKH.indexOf('async function renderOrders');
const iDKHet = iDK >= 0 ? sKH.indexOf('\n  async function ', iDK + 20) : -1;
kiem(iDK >= 0 && iDKHet > iDK, 'cat duoc pham vi renderOrders cua khohang');
kiem(iDK < 0 || !/themOTimTuDong\(/.test(sKH.slice(iDK, iDKHet > iDK ? iDKHet : sKH.length)),
  'Don khach dat hang: KHONG gan o tim chung (da co 5 o loc + dem + tong rieng)');
const sHRM = boComment(doc(JS('module.hrm.js')));
kiem(/const chuoiNV = nv => boDau\(/.test(sHRM),
  'Ho so nhan su: o tim da bo dau (truoc day toLowerCase nen go "ky thuat" khong ra gi)');
kiem(/nv\.TenBoPhan/.test(sHRM) && /nv\.TrangThaiLaoDong/.test(sHRM),
  'Ho so nhan su: dung DUNG ten truong dang ve (TenBoPhan / TrangThaiLaoDong)');
kiem(/tu\.every\(t =>/.test(sHRM), 'Ho so nhan su: tach tu, khop het — cung luat voi wireTableSearch');

console.log('\n=== 7b. Bang CHI TIEU phai tu loai bang data-khongtim ===');
const sBC = doc(JS('module.baocao.js'));
kiem((sBC.match(/data-nostt data-khongtim/g) || []).length >= 2,
  'baocao: 2 bang chi tieu (Tai chinh + Ket qua kinh doanh) gan data-khongtim');

console.log('\n=== 8. index.html ===');
const CAN_BUMP = ['common.js', 'module.users.js', 'module.qlsx.js', 'module.khovai.js',
  'module.khohang.js', 'module.nhaplai.js', 'module.phukien.js', 'module.congno.js',
  'module.hoadon.js', 'module.baocao.js', 'module.dms.js', 'module.dashboard.js',
  'module.hrm.js', 'module.payroll.js', 'module.mypay.js'];
CAN_BUMP.forEach(f => {
  const v = parseFloat((sIndex.match(new RegExp(f.replace(/\./g, '\\.') + '\\?v=([\\d.]+)')) || [])[1] || 0);
  kiem(v >= 9.05, `${f}?v= >= 9.05  [duoc: ${v}]`);
});
/* common.js phai nap TRUOC moi module — khong thi themOTimTuDong chua ton tai luc module chay. */
const iCommon = sIndex.indexOf('/js/common.js?v=');
const iModuleDau = sIndex.indexOf('/js/module.');
kiem(iCommon >= 0 && iModuleDau > iCommon, 'common.js nap TRUOC cac module');

console.log(`\n=== KET QUA: ${dat} dat, ${truot} sai ===`);
process.exit(truot ? 1 : 0);
