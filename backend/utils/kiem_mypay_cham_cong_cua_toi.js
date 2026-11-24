/* ================================================================================================
   kiem_mypay_cham_cong_cua_toi.js — bo tu kiem v9.69, CAP NHAT v9.99.
   v9.69 (Nguyen 16/11/2026): "Bang luong cua toi them bang cham cong cua nhan vien do ben canh."
   v9.99 (Nguyen 23/11/2026): "Bang luong cua toi dang hien bang cham cong tren 1 trang. Sua thanh
   1 chuc nang bang cham cong trong bang luong cua toi. Van auto co khi tao user."
   + "Tach luon cong doan may thanh chuc nang rieng trong bang luong cua toi."
     1. Bien dich payroll.js + module.mypay.js.
     2. Route GET /chamcong/cuatoi: requireAuth + requireChucNang('MYPAY','chamcongcuatoi'), loc theo
        Users.NhanVienID cua phien, dung TRUOC /chamcong/:nhanVienId (literal truoc :param — bai hoc
        /nhanvien/template v5.38), ngay/gio tra CHUOI (CONVERT) — khong Date (useUTC +7).
     3. Chay THAT handler voi req/pool gia: chua lien ket -> linked:false; co -> rows + tongCong/tongGioTangCa.
     4. module.mypay: phanChamCong() chay that trong ngu canh gia — thu tu ngay, CN to mau, gio nguyen chuoi.
     5. drawChamCong() chay that: goi DUNG 1 route, co tieu de + bang; chua lien ket thi NOI LY DO (khong de trang).
     6. drawCongDoanMay() chay that: goi DUNG 1 route, dat than muc + noi day; chua lien ket thi NOI LY DO.
     7. Da TACH thanh chuc nang: getTabs 3 tab, render dinh tuyen theo tabKey, draw() KHONG con goi
        /chamcong/cuatoi lan /congdoanmay/cuatoi; luong cong doan may dung veLai() chu khong draw();
        migration_v908 khai CA HAI dong voi MacDinhCho = 1 ("auto co khi tao user"); loadUserContext
        (luat v9.59) mo lai ca ba chuc nang tu phuc vu cho nguoi da gan ho so nhan vien.
   Chay: node backend\utils\kiem_mypay_cham_cong_cua_toi.js — KHONG dung CSDL.
   ================================================================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const GOC = path.join(__dirname, '..', '..');
const doc = (...p) => fs.existsSync(path.join(GOC, ...p)) ? fs.readFileSync(path.join(GOC, ...p), 'utf8').replace(/\r\n/g, '\n') : '';
let sai = 0, dat = 0;
function kiem(ten, dung, td) {
  if (dung) { dat++; console.log('  ✓ ' + ten); }
  else { sai++; console.log('  ❌ ' + ten + (td ? ' — ' + (typeof td === 'string' ? td : JSON.stringify(td)) : '')); }
}
const boComment = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const canhGac = setTimeout(() => { console.log('\n  ❌ BO KIEM TREO qua 20 s'); process.exit(1); }, 20000);

console.log('\n=== 1. BIEN DICH ===');
['backend/routes/payroll.js', 'backend/utils/loadUserContext.js', 'frontend/js/module.mypay.js'].forEach(f => {
  const s = doc(...f.split('/')); if (!s) { sai++; console.log('  ❌ ' + f + ' KHONG DOC DUOC'); return; }
  try { new vm.Script(s, { filename: f }); dat++; console.log('  ✓ ' + f); } catch (e) { sai++; console.log('  ❌ ' + f + ' VO CU PHAP: ' + e.message); }
});

(async () => {
  console.log('\n=== 2. routes/payroll.js — GET /chamcong/cuatoi ===');
  const p = boComment(doc('backend', 'routes', 'payroll.js'));
  const iCuaToi = p.indexOf("router.get('/chamcong/cuatoi', requireAuth,"), iParam = p.indexOf("router.get('/chamcong/:nhanVienId',");
  kiem('route co, dung TRUOC /chamcong/:nhanVienId', iCuaToi > 0 && iParam > iCuaToi);
  const than = p.slice(iCuaToi, iParam);
  /* v9.99: gac them chuc nang cho khop voi menu. KHONG dung coQuyenChucNang (chuc nang nay MacDinhCho = 1,
     thieu dong cau hinh = CHO QUA) — dung coQuyenChucNang la khoa sach moi nguoi khi chua chay migration. */
  kiem('v9.99: gac requireChucNang(MYPAY/chamcongcuatoi) chu khong phai coQuyenChucNang',
    /requireChucNang\('MYPAY', ?'chamcongcuatoi', ?'view'\)/.test(than.slice(0, 200)) && !/coQuyenChucNang\([^)]*chamcongcuatoi/.test(than));
  kiem('loc theo Users.NhanVienID cua phien, khong doc nhanVienId tu client', /SELECT NhanVienID FROM Users WHERE UserID=@uid/.test(than) && !/req\.(query|params|body)\.nhanVienId/.test(than));
  kiem('ngay + gio tra CHUOI: CONVERT(varchar(10), Ngay, 23), CONVERT(varchar(5), GioVao, 108), GioRa', /CONVERT\(varchar\(10\), Ngay, 23\) AS Ngay/.test(than) && /CONVERT\(varchar\(5\), GioVao, 108\) AS GioVao/.test(than) && /CONVERT\(varchar\(5\), GioRa, 108\) AS GioRa/.test(than));

  console.log('\n=== 3. chay that handler ===');
  const Module = require('module');
  const gocLoad = Module._load;
  const sqlGia = new Proxy({}, { get(_, k) { const f = () => k; f.toString = () => String(k); return f; } });
  const handlers = [];
  const routerGia = new Proxy({}, { get(_, m) { return (duong, ...mw) => { handlers.push({ m, duong, h: mw[mw.length - 1] }); }; } });
  let traLoi = () => [];
  const poolGia = { request: () => { const inp = {}; const rq = { input(k, t, v) { inp[k] = v; return rq; }, async query(q) { return { recordset: traLoi(String(q).replace(/\s+/g, ' '), inp) }; } }; return rq; } };
  Module._load = function (ten) {
    if (ten === 'express') { const ex = () => ({}); ex.Router = () => routerGia; return ex; }
    if (ten === '../db') return { sql: sqlGia, getPool: async () => poolGia };
    if (ten === '../middleware/auth') return new Proxy({}, { get: () => () => (req, res, next) => next() });
    if (/^\.\.?\//.test(ten) && !/\/db$/.test(ten)) {
      try { return gocLoad.apply(this, arguments); } catch (e) { return new Proxy({}, { get: () => () => {} }); }
    }
    return gocLoad.apply(this, arguments);
  };
  let okNap = true;
  try { require(path.join(GOC, 'backend', 'routes', 'payroll.js')); } catch (e) { okNap = false; console.log('  (khong nap duoc payroll.js voi stub: ' + e.message + ' — bo qua phan chay that)'); }
  Module._load = gocLoad;
  const h = handlers.find(x => x.m === 'get' && x.duong === '/chamcong/cuatoi');
  if (okNap && h) {
    const goi = async (query) => { let kq; const res = { json: (o) => { kq = o; }, status() { return res; } }; await h.h({ session: { user: { userId: 5 } }, query }, res); return kq; };
    traLoi = (q) => (/FROM Users WHERE UserID/.test(q) ? [{ NhanVienID: null }] : []);
    const a = await goi({ nam: 2026, thang: 10 });
    kiem('chua lien ket nhan vien -> linked:false, rows rong', a && a.data.linked === false && a.data.rows.length === 0, a);
    traLoi = (q, inp) => {
      if (/FROM Users WHERE UserID/.test(q)) return [{ NhanVienID: 61 }];
      if (/FROM ChamCongNgay WHERE NhanVienID=@id/.test(q)) return inp.id === 61 ? [
        { Ngay: '2026-10-01', MaCham: 'X', SoCong: 1, GioVao: '07:55', GioRa: '17:02', GioTangCaThuong: 1.5, GioTangCaChuNhat: 0, GioTangCaLeTet: 0 },
        { Ngay: '2026-10-02', MaCham: 'X', SoCong: 0.5, GioVao: '08:10', GioRa: '12:00', GioTangCaThuong: 0, GioTangCaChuNhat: 0, GioTangCaLeTet: 0 }] : [];
      return [];
    };
    const b = await goi({ nam: 2026, thang: 10 });
    kiem('co lien ket -> 2 dong, tongCong 1.5, tongGioTangCa 1.5, gio nguyen chuoi "07:55"', b && b.data.linked === true && b.data.rows.length === 2 && b.data.tongCong === 1.5 && b.data.tongGioTangCa === 1.5 && b.data.rows[0].GioVao === '07:55', b && b.data);
  } else kiem('tim thay handler /chamcong/cuatoi', !!h);

  console.log('\n=== 4. module.mypay.js — phanChamCong chay that ===');
  const fm = doc('frontend', 'js', 'module.mypay.js');
  const i0 = fm.indexOf('  function phanChamCong(cc) {');
  const iVeCC = fm.indexOf('  async function drawChamCong() {');
  const iVeMay = fm.indexOf('  async function drawCongDoanMay() {');
  const i1 = fm.indexOf('  async function draw() {');
  kiem('cat duoc phanChamCong / drawChamCong / drawCongDoanMay / draw (dung thu tu)',
    i0 > 0 && iVeCC > i0 && iVeMay > iVeCC && i1 > iVeMay, { i0, iVeCC, iVeMay, i1 });
  const ctx = { escapeHtml: (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])), num: (v) => Number(v) || 0 };
  vm.createContext(ctx);
  vm.runInContext(fm.slice(i0, iVeCC) + '\nthis.phanChamCong = phanChamCong;', ctx, { filename: 'mypay_cham_cong_gia.js' });
  const html = ctx.phanChamCong({ linked: true, tongCong: 1.5, tongGioTangCa: 1.5, rows: [
    { Ngay: '2026-10-04', MaCham: 'X', SoCong: 1, GioVao: '07:55', GioRa: '17:02', GioTangCaThuong: 1.5, GioTangCaChuNhat: 0, GioTangCaLeTet: 0, GhiChu: '' },
    { Ngay: '2026-10-05', MaCham: 'CN', SoCong: 0, GioVao: '', GioRa: '', GioTangCaThuong: 0, GioTangCaChuNhat: 0, GioTangCaLeTet: 0, GhiChu: 'nghỉ' }] });
  /* 01/01/2026 la thu Nam => 04/10/2026 la CHU NHAT, 05/10 la thu Hai (dem tay: 276 ngay sau 1/1, 276 mod 7 = 3). */
  kiem('hien "2 ngày · 1.5 công · 1.5 giờ tăng ca", 05/10 thu T2, gio 07:55 / 17:02 nguyen chuoi', /2 ngày · 1\.5 công · 1\.5 giờ tăng ca/.test(html) && /<td>05\/10<\/td><td>T2<\/td>/.test(html) && /07:55<\/td><td style="text-align:center;">17:02/.test(html), html.slice(0, 400));
  kiem('04/10/2026 la Chu nhat -> CN + to mau', /<tr style="background:#fff8e1;"><td>04\/10<\/td><td>CN<\/td>/.test(html));
  kiem('chua lien ket / loi / rong', ctx.phanChamCong({ linked: false }) === '' && /Không tải được chấm công/.test(ctx.phanChamCong({ loi: 'x' })) && /Chưa có ngày chấm công/.test(ctx.phanChamCong({ linked: true, rows: [] })));

  console.log('\n=== 5. drawChamCong() chay that (chuc nang rieng v9.99) ===');
  let duongDaGoi = [], duLieuTra = null, soLanWire = 0;
  const ctx2 = {
    escapeHtml: ctx.escapeHtml, num: ctx.num,
    selNam: 2026, selThang: 10,
    container: { innerHTML: '' },
    periodBar: () => '<!--o-chon-ky-->',
    wirePeriod: () => { soLanWire++; },
    apiGet: async (u) => { duongDaGoi.push(u); return { data: duLieuTra }; }
  };
  vm.createContext(ctx2);
  vm.runInContext(fm.slice(i0, iVeMay) + '\nthis.drawChamCong = drawChamCong;', ctx2, { filename: 'mypay_tab_cham_cong_gia.js' });
  duLieuTra = { linked: true, tongCong: 1.5, tongGioTangCa: 0, rows: [
    { Ngay: '2026-10-01', MaCham: 'X', SoCong: 1, GioVao: '07:55', GioRa: '17:02', GioTangCaThuong: 0, GioTangCaChuNhat: 0, GioTangCaLeTet: 0, GhiChu: '' }] };
  await ctx2.drawChamCong();
  const htmlTab = ctx2.container.innerHTML;
  kiem('goi DUNG MOT route /chamcong/cuatoi, co nam + thang dang xem',
    duongDaGoi.length === 1 && /^\/api\/payroll\/chamcong\/cuatoi\?nam=2026&thang=10$/.test(duongDaGoi[0]), duongDaGoi);
  kiem('co o chon ky + tieu de thang + bang cham cong + goi lai wirePeriod',
    /<!--o-chon-ky-->/.test(htmlTab) && /Chấm công của tôi — Tháng 10\/2026/.test(htmlTab) && /<td>01\/10<\/td>/.test(htmlTab) && soLanWire === 1, htmlTab.slice(0, 200));
  /* Chua gan ho so nhan vien: phanChamCong tra RONG. O trang rieng ma de trang la "an khong noi ly do"
     (bai hoc v9.90) — phai hien dung cau huong dan nhu trang phieu luong. */
  duongDaGoi = []; duLieuTra = { linked: false, rows: [] };
  await ctx2.drawChamCong();
  kiem('chua lien ket nhan vien -> NOI RO ly do + cach xu ly, khong de trang',
    /chưa được liên kết/.test(ctx2.container.innerHTML) && /Liên kết nhân viên/.test(ctx2.container.innerHTML), ctx2.container.innerHTML.slice(0, 200));
  duLieuTra = { loi: 'may chu loi' };
  await ctx2.drawChamCong();
  kiem('loi may chu -> noi loi, khong nuot', /Không tải được chấm công/.test(ctx2.container.innerHTML));

  console.log('\n=== 6. drawCongDoanMay() chay that (chuc nang rieng v9.99) ===');
  let duongMay = [], duLieuMay = null, soLanWireMay = 0, soLanWireKy = 0;
  const ctx3 = {
    selNam: 2026, selThang: 10,
    container: { innerHTML: '' },
    periodBar: () => '<!--o-chon-ky-->',
    wirePeriod: () => { soLanWireKy++; },
    /* Than muc do phanCongDoanMayCuaToi dung (da kiem rieng o kiem_cong_doan_may_cua_toi.js) — o day
       chi kiem PHAN DINH TUYEN: goi dung route, dat than vao DOM, noi day, va khong de trang. */
    phanCongDoanMayCuaToi: (cm) => (cm && cm.linked === false ? '' : '<h3>Công đoạn may</h3>'),
    wireCongDoanMayCuaToi: () => { soLanWireMay++; },
    apiGet: async (u) => { duongMay.push(u); return { data: duLieuMay }; }
  };
  vm.createContext(ctx3);
  vm.runInContext(fm.slice(iVeMay, i1) + '\nthis.drawCongDoanMay = drawCongDoanMay;', ctx3, { filename: 'mypay_tab_cong_doan_may_gia.js' });
  duLieuMay = { linked: true, laBoPhanMay: true, rows: [] };
  await ctx3.drawCongDoanMay();
  kiem('goi DUNG MOT route /api/qlsx/congdoanmay/cuatoi co nam + thang dang xem',
    duongMay.length === 1 && /^\/api\/qlsx\/congdoanmay\/cuatoi\?nam=2026&thang=10$/.test(duongMay[0]), duongMay);
  kiem('co o chon ky + than muc, goi lai wirePeriod va wireCongDoanMayCuaToi',
    /<!--o-chon-ky-->/.test(ctx3.container.innerHTML) && /Công đoạn may/.test(ctx3.container.innerHTML) && soLanWireKy === 1 && soLanWireMay === 1,
    ctx3.container.innerHTML.slice(0, 200));
  duLieuMay = { linked: false };
  await ctx3.drawCongDoanMay();
  kiem('chua lien ket nhan vien -> NOI RO ly do, khong de trang',
    /chưa được liên kết/.test(ctx3.container.innerHTML), ctx3.container.innerHTML.slice(0, 200));

  console.log('\n=== 7. v9.99 — da TACH thanh cac chuc nang rieng ===');
  const fmSach = boComment(fm);
  kiem('getTabs tra 3 chuc nang: luongcuatoi + chamcongcuatoi + congdoanmaycuatoi',
    /key: 'luongcuatoi'/.test(fmSach) && /key: 'chamcongcuatoi'/.test(fmSach) && /key: 'congdoanmaycuatoi'/.test(fmSach));
  kiem('render(el, user, tabKey) dinh tuyen theo tabKey (khong bo qua tham so thu 3)',
    /async function render\(el, user, tabKey\)/.test(fmSach) && /VE_THEO_TAB\[tabHienTai\] \|\| draw/.test(fmSach));
  kiem('bang dinh tuyen co du hai chuc nang moi',
    /chamcongcuatoi: \(\) => drawChamCong\(\)/.test(fmSach) && /congdoanmaycuatoi: \(\) => drawCongDoanMay\(\)/.test(fmSach));
  kiem('doi thang van ve lai DUNG trang dang xem (wirePeriod goi veLai, khong goi thang draw)',
    /selNam = parseInt\(e\.target\.value, 10\); veLai\(\);/.test(fmSach) && /selThang = parseInt\(e\.target\.value, 10\); veLai\(\);/.test(fmSach));
  /* Trang phieu luong KHONG duoc goi lai route cham cong, va khong con cot phai. Da LOC COMMENT
     (fmSach) truoc khi khang dinh "KHONG chua X" — bai hoc da vap 3 lan. */
  const iDrawSach = fmSach.indexOf('  async function draw() {');
  kiem('cat duoc than draw()', iDrawSach > 0);
  const thanDraw = iDrawSach > 0 ? fmSach.slice(iDrawSach) : '';
  kiem('draw() KHONG con goi /chamcong/cuatoi', !!thanDraw && !/chamcong\/cuatoi/.test(thanDraw));
  kiem('draw() KHONG con cot phai phanChamCong(cc)', !/phanChamCong\(cc\)/.test(thanDraw) && !/flex:1 1 420px/.test(fmSach));
  kiem('draw() KHONG con goi /congdoanmay/cuatoi', !!thanDraw && !/congdoanmay\/cuatoi/.test(thanDraw));
  kiem('draw() KHONG con nhung muc cong doan may', !/\$\{phanCongDoanMayCuaToi\(cm\)\}/.test(thanDraw));
  /* Sửa / xóa / ghi xong trong luồng công đoạn may phải veLai(), không draw() — nếu không là nhảy
     về trang phiếu lương ngay giữa chừng công việc. */
  kiem('luong cong doan may dung veLai(), khong goi thang draw()', !/closeModal\(\); draw\(\);/.test(fmSach));

  /* v9.59 trong loadUserContext.js tu MO LAI tab MYPAY cho nguoi da gan ho so nhan vien (vi nhom nao
     tung bam Luu o Ma tran phan quyen la bi MERGE CanView=0 hang loat). Chuc nang cham cong moi phai
     NAM TRONG danh sach do, khong thi hai muc cung tinh chat lai xu su khac nhau. */
  const sCtx = boComment(doc('backend', 'utils', 'loadUserContext.js'));
  kiem('loadUserContext: luat v9.59 mo ca chamcongcuatoi + congdoanmaycuatoi, khong chi luongcuatoi',
    /'MYPAY:luongcuatoi', ?'MYPAY:chamcongcuatoi', ?'MYPAY:congdoanmaycuatoi'/.test(sCtx));
  kiem('KHONG tu mo cac nang luc opt-in MacDinhCho = 0 (sanluongcuatoi / congdoanmaytatca)',
    !/MYPAY:sanluongcuatoi|MYPAY:congdoanmaytatca/.test(sCtx));

  const sSql = doc('database', 'migration_v908.sql');
  /* Chi xet KHOI KHAI (truoc muc kiem tra chi-doc) — tranh dinh cac cau SELECT doi chieu ben duoi. */
  const sqlKhai = sSql.split('---- 2.')[0].replace(/\s+/g, ' ');
  kiem('co migration_v908.sql khai CA HAI chuc nang moi',
    /'MYPAY', ?'chamcongcuatoi'/.test(sqlKhai) && /'MYPAY', ?'congdoanmaycuatoi'/.test(sqlKhai));
  /* 🔴 Day la diem CHOT cua yeu cau "van auto co khi tao user": MacDinhCho = 1 (tick san), KHAC hai
     dong MYPAY truoc do (sanluongcuatoi, congdoanmaytatca) deu la 0. Dat nham 0 = user moi KHONG co. */
  ['chamcongcuatoi', 'congdoanmaycuatoi'].forEach(ma => {
    kiem(`${ma}: MacDinhCho = 1 (tick san — "van auto co khi tao user"), KHONG phai 0`,
      new RegExp(ma + "'[^)]*, ?1\\)").test(sqlKhai) && !new RegExp(ma + "'[^)]*, ?0\\)").test(sqlKhai), sqlKhai.slice(-500));
  });
  kiem('dung MERGE ⇒ chay lai nhieu lan vo hai', /MERGE ChucNang/.test(sqlKhai));
  kiem('migration KHONG tao bang/cot moi', !/CREATE TABLE|ALTER TABLE/i.test(boComment(sSql).replace(/--.*$/gm, '')));
  const v = /module\.mypay\.js\?v=([\d.]+)/.exec(doc('frontend', 'index.html'));
  kiem('index.html module.mypay.js ?v>=10.00', !!v && parseFloat(v[1]) >= 10, v && v[1]);

  clearTimeout(canhGac);
  console.log(`\n=== KET QUA: ${dat} dat, ${sai} sai ===`);
  process.exit(sai ? 1 : 0);
})().catch(e => { console.error('VO: ' + (e && e.stack || e)); process.exit(1); });
