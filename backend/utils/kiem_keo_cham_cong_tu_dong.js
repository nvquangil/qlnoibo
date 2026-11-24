/* ================================================================================================
   kiem_keo_cham_cong_tu_dong.js — bo tu kiem cho v9.49 (keo cham cong tu dong theo gio cai dat)

   CHAY THAT utils/lichChamCong.js voi db + routes/payroll gia (require cache) de kiem HANH VI:
   dat lich dung gio, tat/bat, chay mot lan keo moi may dang Hoat dong + tong hop, may loi khong
   chan may khac, khong chay chong, 3 ngay dau thang tong hop ca thang truoc.

   Chay:  node backend\utils\kiem_keo_cham_cong_tu_dong.js
   KHONG copy sang D:\QLSX. KHONG dung toi CSDL.
   ================================================================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Module = require('module');

const GOC = path.join(__dirname, '..', '..');
const doc = (...p) => fs.existsSync(path.join(GOC, ...p)) ? fs.readFileSync(path.join(GOC, ...p), 'utf8') : '';
let sai = 0, dat = 0;
function kiem(ten, dung, td) {
  if (dung) { dat++; console.log('  ✓ ' + ten); }
  else { sai++; console.log('  ❌ ' + ten + (td ? ' — ' + td : '')); }
}
const fPR = doc('backend', 'routes', 'payroll.js'), fLich = doc('backend', 'utils', 'lichChamCong.js');
const fFE = doc('frontend', 'js', 'module.payroll.js'), fServer = doc('backend', 'server.js'), html = doc('frontend', 'index.html');

console.log('\n=== 1. BIEN DICH ===');
[['backend/routes/payroll.js', fPR], ['backend/utils/lichChamCong.js', fLich], ['frontend/js/module.payroll.js', fFE], ['backend/server.js', fServer]].forEach(([f, s]) => {
  if (!s) { sai++; console.log('  ❌ ' + f + ' KHONG DOC DUOC'); return; }
  try { new vm.Script(s, { filename: f }); dat++; console.log('  ✓ ' + f); }
  catch (e) { sai++; console.log('  ❌ ' + f + ' VO CU PHAP: ' + e.message); }
});

/* ---- Stub: ../db va ../routes/payroll (bo vao require cache TRUOC khi nap lichChamCong) ---- */
const nhatKy = [];
const GIA = {
  mays: [{ MayChamCongID: 1, TenMay: 'May A', TrangThai: 'Hoạt động' }, { MayChamCongID: 2, TenMay: 'May B', TrangThai: 'Hoạt động' }],
  cfg: { bat: true, gioChay: '23:30', soNgayLui: 3, tongHop: true },
  loiMay: {},          // id -> message
  loiTongHop: null
};
const poolGia = { request: () => ({ query: async (q) => ({ recordset: /FROM MayChamCong/.test(q) ? GIA.mays.filter(m => m.TrangThai !== 'Tạm dừng') : [] }) }) };
const dbGia = { getPool: async () => poolGia, sql: {} };
const payrollGia = {
  getCauHinhChamCongTuDong: async () => Object.assign({}, GIA.cfg),
  keoDuLieuMay: async (pool, may, opt) => {
    nhatKy.push(['keo', may.MayChamCongID, opt]);
    if (GIA.loiMay[may.MayChamCongID]) throw new Error(GIA.loiMay[may.MayChamCongID]);
    return { total: 10, filtered: 8, inserted: 5, matched: 7, unmatched: 1 };
  },
  tongHopChamCongThang: async (pool, nam, thang) => {
    nhatKy.push(['tonghop', nam, thang]);
    if (GIA.loiTongHop) throw new Error(GIA.loiTongHop);
    return { affected: 20, ngay: 22, thieuQuet: 1 };
  }
};
const cronGia = { lich: [], validate: (s) => /^\d+ \d+ \* \* \*$/.test(s), schedule(bieuThuc, fn) { const t = { bieuThuc, fn, stopped: false, stop() { this.stopped = true; } }; cronGia.lich.push(t); return t; } };
const duongDb = path.join(GOC, 'backend', 'db.js'), duongPR = path.join(GOC, 'backend', 'routes', 'payroll.js');
const cay = (p, exp) => { const m = new Module(p); m.filename = p; m.loaded = true; m.exports = exp; require.cache[p] = m; };
cay(duongDb, dbGia); cay(duongPR, payrollGia);
const duongCron = require.resolve('node-cron', { paths: [path.join(GOC, 'backend')] });
cay(duongCron, cronGia);
const lich = require(path.join(GOC, 'backend', 'utils', 'lichChamCong.js'));

/* CANH GAC: mot await treo (promise khong bao gio xong) thi event loop can, Node thoat ma=0 ma khong in
   KET QUA — kiem_tat_ca coi la xanh. Giu mot timer song: qua 20 s chua toi dong KET QUA la DO. */
const canhGac = setTimeout(() => { console.log('\n  ❌ BO KIEM TREO qua 20 s (co await khong bao gio xong) — khong toi duoc dong KET QUA'); process.exit(1); }, 20000);

console.log('\n=== 2. cronTuGio ===');
kiem("'23:30' -> '30 23 * * *'", lich.cronTuGio('23:30') === '30 23 * * *');
kiem("'6:05' -> '5 6 * * *'", lich.cronTuGio('6:05') === '5 6 * * *');
kiem("'24:00' / '12:60' / 'abc' / '' -> null", lich.cronTuGio('24:00') === null && lich.cronTuGio('12:60') === null && lich.cronTuGio('abc') === null && lich.cronTuGio('') === null);

(async () => {
  console.log('\n=== 3. datLaiLich ===');
  let tt = await lich.datLaiLich();
  kiem('bat + gio hop le -> chay, dung bieu thuc', tt.chay === true && cronGia.lich.length === 1 && cronGia.lich[0].bieuThuc === '30 23 * * *', JSON.stringify(tt));
  kiem('trangThai() phan anh dung', lich.trangThai().chay === true && lich.trangThai().gioChay === '23:30');
  GIA.cfg.gioChay = '06:00';
  tt = await lich.datLaiLich();
  kiem('doi gio: task cu bi STOP, task moi dung gio (khong hai task cung chay)', cronGia.lich.length === 2 && cronGia.lich[0].stopped === true && cronGia.lich[1].bieuThuc === '0 6 * * *');
  GIA.cfg.bat = false;
  tt = await lich.datLaiLich();
  kiem('tat -> khong chay, noi ly do, task cu stop', tt.chay === false && /TẮT/.test(tt.lyDo) && cronGia.lich[1].stopped === true);
  GIA.cfg.bat = true; GIA.cfg.gioChay = '99:99';
  tt = await lich.datLaiLich();
  kiem('gio sai -> khong chay, noi ro gio', tt.chay === false && /99:99/.test(tt.lyDo));
  GIA.cfg.gioChay = '23:30';

  console.log('\n=== 4. chayMotLan: keo moi may dang Hoat dong + tong hop ===');
  nhatKy.length = 0;
  let kq = await lich.chayMotLan('tay');
  kiem('keo 2 may, moi may mot lan', nhatKy.filter(x => x[0] === 'keo').length === 2 && kq.ketQua.length === 2 && kq.ketQua.every(x => x.ok));
  kiem('ket qua ghi inserted/unmatched tung may', kq.ketQua[0].inserted === 5 && kq.ketQua[0].unmatched === 1 && kq.ketQua[0].may === 'May A');
  const opt = nhatKy.find(x => x[0] === 'keo')[2];
  /* So NGAY LICH giua hai moc (00:00 ngay dau -> 00:00 ngay cuoi). Ban dau tinh (denNgay - tuNgay) roi
     Math.round: 2 ngay 23h59 lam tron thanh 3 -> do oan (14/11 Nguyen chay thay "chenh 3"). Ma dung. */
  const dauNgay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const ngayChenh = Math.round((dauNgay(opt.denNgay) - dauNgay(opt.tuNgay)) / 86400000);
  kiem('khoang keo = soNgayLui ngay (tu 00:00 ngay -2 den 23:59 hom nay), khong loc ma', ngayChenh === 2 && opt.tuNgay.getHours() === 0 && opt.tuNgay.getMinutes() === 0
    && opt.denNgay.getHours() === 23 && opt.denNgay.getMinutes() === 59 && opt.loMa === null, 'chenh ' + ngayChenh + ' ngay lich');
  const hom = new Date();
  const thDung = nhatKy.filter(x => x[0] === 'tonghop');
  kiem('tong hop thang hien tai', thDung.some(x => x[1] === hom.getFullYear() && x[2] === hom.getMonth() + 1));
  kiem('tong hop thang truoc CHI trong 3 ngay dau thang', (hom.getDate() <= 3) === (thDung.length === 2));
  kiem('kq.tongHop co affected/thieuQuet', kq.tongHop[0].ok && kq.tongHop[0].affected === 20 && kq.tongHop[0].thieuQuet === 1);
  kiem('luc = gio dia phuong "yyyy-mm-dd hh:mi"', /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(kq.luc) && kq.nguon === 'tay');
  kiem('trangThai().lanCuoi = ket qua vua chay', lich.trangThai().lanCuoi === kq && lich.trangThai().dangChay === false);

  console.log('\n=== 5. loi mot may KHONG chan may khac; moi may deu loi -> KHONG tong hop ===');
  nhatKy.length = 0; GIA.loiMay = { 1: 'Hết thời gian chờ 192.168.1.50' };
  kq = await lich.chayMotLan('lich');
  kiem('may A loi, may B van keo', kq.ketQua[0].ok === false && /192\.168\.1\.50/.test(kq.ketQua[0].thongBao) && kq.ketQua[1].ok === true);
  kiem('van tong hop vi co may keo duoc', nhatKy.some(x => x[0] === 'tonghop'));
  nhatKy.length = 0; GIA.loiMay = { 1: 'x', 2: 'y' };
  kq = await lich.chayMotLan('lich');
  kiem('ca hai may loi -> khong tong hop (khong ghi de vo ich)', !nhatKy.some(x => x[0] === 'tonghop') && kq.tongHop.length === 0);
  GIA.loiMay = {};
  nhatKy.length = 0; GIA.loiTongHop = 'Msg 8152';
  kq = await lich.chayMotLan('lich');
  kiem('tong hop loi -> ghi vao kq.tongHop, khong nem', kq.tongHop[0].ok === false && /8152/.test(kq.tongHop[0].thongBao));
  GIA.loiTongHop = null;

  console.log('\n=== 6. may Tam dung bi bo qua; tongHop=false; khong co may ===');
  nhatKy.length = 0; GIA.mays[1].TrangThai = 'Tạm dừng';
  kq = await lich.chayMotLan('lich');
  kiem('may Tam dung khong duoc keo', nhatKy.filter(x => x[0] === 'keo').length === 1 && kq.ketQua.length === 1);
  GIA.mays[1].TrangThai = 'Hoạt động';
  nhatKy.length = 0; GIA.cfg.tongHop = false;
  kq = await lich.chayMotLan('lich');
  kiem('tongHop=false -> keo nhung khong tong hop', nhatKy.filter(x => x[0] === 'keo').length === 2 && !nhatKy.some(x => x[0] === 'tonghop'));
  GIA.cfg.tongHop = true;
  const mayCu = GIA.mays; GIA.mays = [];
  kq = await lich.chayMotLan('lich');
  kiem('khong co may -> kq.loi noi ro, khong nem', /Không có máy/.test(kq.loi) && kq.ketQua.length === 0);
  GIA.mays = mayCu;

  console.log('\n=== 7. khong chay chong ===');
  /* CHI may DAU TIEN bi giu lai (tha bang thaKeo); cac may sau tra ngay. Ban dau moi lan goi deu tao
     promise treo moi va thaKeo bi ghi de -> may thu 2 treo vinh vien -> event loop can -> Node thoat
     ma=0 KHONG in "KET QUA" (bo kiem "xanh" gia suot 13/11). Nay co them canh gac 20 s o cuoi file. */
  let thaKeo = null;
  payrollGia.keoDuLieuMay = () => new Promise(r => {
    const xong = () => r({ inserted: 0, filtered: 0, unmatched: 0 });
    if (!thaKeo) thaKeo = xong; else xong();
  });
  const p1 = lich.chayMotLan('lich');
  await new Promise(r => setTimeout(r, 10));
  const kq2 = await lich.chayMotLan('tay');
  kiem('dang chay -> lan 2 bo qua, noi ly do', kq2.boQua === true && /chưa xong/.test(kq2.lyDo) && lich.trangThai().dangChay === true);
  kiem('may dau tien dang bi giu (stub da nhan cuoc goi)', typeof thaKeo === 'function');
  if (thaKeo) thaKeo();
  await p1;
  kiem('xong -> dangChay = false', lich.trangThai().dangChay === false);

  console.log('\n=== 8. KHOP NOI ===');
  const boComment = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const cPR = boComment(fPR), cFE = boComment(fFE);
  kiem('payroll.js tach keoDuLieuMay + tongHopChamCongThang, route cu goi lai chung', /async function keoDuLieuMay\(pool, may/.test(cPR) && /async function tongHopChamCongThang\(pool, nam, thang\)/.test(cPR)
    && /const data = await keoDuLieuMay\(pool, may, \{ tuNgay, denNgay, loMa \}\);/.test(cPR) && /const data = await tongHopChamCongThang\(pool, nam, thang\);/.test(cPR));
  kiem('payroll.js gan 3 ham len router cho lich dung', /router\.keoDuLieuMay = keoDuLieuMay;/.test(cPR) && /router\.tongHopChamCongThang = tongHopChamCongThang;/.test(cPR) && /router\.getCauHinhChamCongTuDong = getCauHinhChamCongTuDong;/.test(cPR));
  kiem('3 route /chamcong/tudong (GET, POST, POST chayngay) co gate PAYROLL + chamcong', (cPR.match(/router\.(get|post)\('\/chamcong\/tudong(\/chayngay)?', requireAuth, requirePermission\('PAYROLL', '(view|edit)'\), requireChucNang\('PAYROLL', 'chamcong'\)/g) || []).length === 3);
  kiem('POST /chamcong/tudong dat lai lich NGAY sau khi luu', /const tt = await lich\.datLaiLich\(\);/.test(cPR));
  kiem('tong hop: MERGE van chi ghi de dong Nguon=May (khong dung dong sua tay)', /WHEN MATCHED AND t\.Nguon = N'May' THEN UPDATE SET/.test(cPR));
  kiem('server.js khoi dong lichChamCong, boc try/catch', /try \{ require\('\.\/utils\/lichChamCong'\)\.khoiDong\(\); \}/.test(boComment(fServer)));
  kiem('module.payroll.js co veKeoTuDong + goi khi ve tab Cham cong + 4 o + nut Chay ngay', /async function veKeoTuDong\(o\)/.test(cFE) && /veKeoTuDong\(container\.querySelector\('#ccTuDong'\)\)/.test(cFE)
    && ['tdBat', 'tdGio', 'tdNgay', 'tdTongHop', 'tdLuu', 'tdChay'].every(id => cFE.indexOf('id="' + id + '"') > -1));
  kiem('man hinh hien trang thai THAT cua lich (l.chay / l.lyDo), khong suy tu o tick', /l\.chay\s*\?/.test(cFE) && /l\.lyDo/.test(cFE));
  kiem('index.html bump module.payroll.js >= 9.49', (() => { const m = /module\.payroll\.js\?v=([\d.]+)/.exec(html); return !!m && parseFloat(m[1]) >= 9.49; })());

  clearTimeout(canhGac);
  console.log(`\n=== KET QUA: ${dat} dat, ${sai} sai ===`);
  process.exit(sai ? 1 : 0);
})().catch(e => { console.error('VO: ' + (e && e.stack || e)); process.exit(1); });
