/* ================================================================================================
   kiem_quet_ma_vach_phieu_ban_hang.js — bo tu kiem cho v9.50 (quet ma vach bang camera may tinh bang
   de them hang vao phieu ban hang theo so Ri + tu khop don khach dat — Nguyen 13/11/2026)

   Chay:  node backend\utils\kiem_quet_ma_vach_phieu_ban_hang.js
   KHONG copy sang D:\QLSX. KHONG dung toi CSDL. KHONG can trinh duyet: DOM/Html5Qrcode duoc gia lap.

   Kiem HANH VI (chay that cac ham, cat theo DAU MOC chu khong dem ngoac) truoc, so chuoi sau cung.
   ================================================================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const GOC = path.join(__dirname, '..', '..');
/* Doc file va quy ve LF: cac dau moc cat ben duoi viet bang '\n', file tren Windows co the la CRLF. */
const doc = (...p) => fs.existsSync(path.join(GOC, ...p)) ? fs.readFileSync(path.join(GOC, ...p), 'utf8').replace(/\r\n/g, '\n') : '';
let sai = 0, dat = 0;
function kiem(ten, dung, td) {
  if (dung) { dat++; console.log('  ✓ ' + ten); }
  else { sai++; console.log('  ❌ ' + ten + (td ? ' — ' + (typeof td === 'string' ? td : JSON.stringify(td)) : '')); }
}
// accept="image/*" trong module.khohang.js bi coi la MO comment -> nuot ma toi dau DONG comment gan nhat.
// Doi no truoc khi bo comment (ra cheo lan 2 chi ra; hien 3 cho deu truoc form nhung dung de lai bay).
const boComment = (s) => s.replace(/image\/\*/g, 'image_ALL').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const fCommon = doc('frontend', 'js', 'common.js');
const fKho = doc('frontend', 'js', 'module.khohang.js');
const fBE = doc('backend', 'routes', 'banhang.js');
const html = doc('frontend', 'index.html');

console.log('\n=== 1. BIEN DICH (vm.Script) ===');
[['frontend/js/common.js', fCommon], ['frontend/js/module.khohang.js', fKho]].forEach(([f, s]) => {
  if (!s) { sai++; console.log('  ❌ ' + f + ' KHONG DOC DUOC'); return; }
  try { new vm.Script(s, { filename: f }); dat++; console.log('  ✓ ' + f); }
  catch (e) { sai++; console.log('  ❌ ' + f + ' VO CU PHAP: ' + e.message); }
});

/* ------------------------------------------------------------------------------------------------
   2. HAM THUAN trong module.khohang.js — cat theo dau moc, chay that.
   ------------------------------------------------------------------------------------------------ */
console.log('\n=== 2. HANH VI: cac ham thuan v9.50 (module.khohang.js) ===');
let H = null;
{
  const iTen = fKho.indexOf('const chuanTenKhach = (x) =>');
  const jTen = fKho.indexOf('.toLowerCase();', iTen);
  const iBat = fKho.indexOf('/* === v9.50 QUET MA VACH — BAT DAU === */');
  const iKet = fKho.indexOf('/* === v9.50 QUET MA VACH — KET THUC === */');
  kiem('tim thay chuanTenKhach + hai dau moc v9.50', iTen > -1 && jTen > iTen && iBat > -1 && iKet > iBat);
  if (iTen > -1 && jTen > iTen && iBat > -1 && iKet > iBat) {
    const src = fKho.slice(iTen, jTen + '.toLowerCase();'.length) + '\n' + fKho.slice(iBat, iKet)
      + '\n; return { chuanMaQuet, timHangTheoMaQuet, heSoRiQuet, donKhopDongQuet, mauChoDongQuet, mauKhachDat, chuanTenKhach };';
    try { H = new Function(src)(); kiem('khoi ham thuan chay duoc (new Function)', !!H); }
    catch (e) { kiem('khoi ham thuan chay duoc (new Function)', false, e.message); }
  }
}
if (H) {
  // 2a. chuan hoa ma quet
  kiem("chuanMaQuet: 'ab-123 ' -> 'AB123'", H.chuanMaQuet('ab-123 ') === 'AB123', H.chuanMaQuet('ab-123 '));
  kiem("chuanMaQuet: bo dau + Đ->D: 'Đỏ 01' -> 'DO01'", H.chuanMaQuet('Đỏ 01') === 'DO01', H.chuanMaQuet('Đỏ 01'));
  kiem('chuanMaQuet: null/undefined -> rong, khong no', H.chuanMaQuet(null) === '' && H.chuanMaQuet(undefined) === '');

  // 2b. tim hang theo ma quet
  const items = [
    { MaHangID: 1, MaHang: 'AB-123', MaBarcode: '8938000111', LoaiRi: 12 },
    { MaHangID: 2, MaHang: 'AB124', MaBarcode: '8938000222', LoaiRi: 6 },
    { MaHangID: 3, MaHang: 'NOIBO01', MaBarcode: null, LoaiRi: null },
    { MaHangID: 4, MaHang: 'TRUNG', MaBarcode: '8938000222', LoaiRi: 6 }
  ];
  let k = H.timHangTheoMaQuet(items, '8938000111');
  kiem("ma vach dung 1 ma -> 'mot', theo ma-vach", k.kieu === 'mot' && k.ds[0].MaHangID === 1 && k.theo === 'ma-vach', k);
  k = H.timHangTheoMaQuet(items, 'ab 123');
  kiem("tem in MA HANG ('ab 123') -> khop MaHang, theo ma-hang", k.kieu === 'mot' && k.ds[0].MaHangID === 1 && k.theo === 'ma-hang', k);
  k = H.timHangTheoMaQuet(items, '8938000222');
  kiem("ma vach TRUNG 2 ma hang -> 'nhieu' (khong chon bua), tra ca 2", k.kieu === 'nhieu' && k.ds.length === 2, k);
  k = H.timHangTheoMaQuet(items, '08938000111');
  kiem("EAN-13 co so 0 dau (UPC-A) -> bo 0 dau, khop ma vach", k.kieu === 'mot' && k.ds[0].MaHangID === 1, k);
  k = H.timHangTheoMaQuet(items, 'noibo01');
  kiem('ma KHONG co barcode van tim duoc theo MaHang (null barcode khong no)', k.kieu === 'mot' && k.ds[0].MaHangID === 3, k);
  kiem("khong khop gi -> 'khong', ds rong", H.timHangTheoMaQuet(items, 'XYZ999').kieu === 'khong' && H.timHangTheoMaQuet(items, 'XYZ999').ds.length === 0);
  kiem("chuoi rong / items rong -> 'khong', khong no", H.timHangTheoMaQuet(items, '').kieu === 'khong' && H.timHangTheoMaQuet([], '8938000111').kieu === 'khong' && H.timHangTheoMaQuet(null, 'x').kieu === 'khong');

  // 2c. he so Ri
  kiem('heSoRiQuet LoaiRi=12 -> +12/lan, co Ri', JSON.stringify(H.heSoRiQuet({ LoaiRi: 12 })) === JSON.stringify({ he: 12, khongCoRi: false }));
  kiem("heSoRiQuet LoaiRi='6' (chuoi) -> 6", H.heSoRiQuet({ LoaiRi: '6' }).he === 6);
  kiem('heSoRiQuet LoaiRi null/1/0 -> +1/lan, co khongCoRi', [null, 1, 0, undefined].every(v => { const r = H.heSoRiQuet({ LoaiRi: v }); return r.he === 1 && r.khongCoRi === true; }) && H.heSoRiQuet(null).he === 1);

  // 2d. khop don khach dat
  const don = [
    { DonID: 11, TenKhach: 'Cty An Bình ', MaHangID: 1, MauSacID: 5, TenMau: 'Đen', SoLuongDat: 3, DonVi: 'Ri', LoaiRi: 12, TrangThai: 'Chờ xử lý', PhieuBHID: null },
    { DonID: 12, TenKhach: 'CTY  AN BÌNH', MaHangID: 1, MauSacID: 7, TenMau: 'Trắng', SoLuongDat: 24, DonVi: 'Cái', LoaiRi: 12, TrangThai: 'Chờ xác nhận', PhieuBHID: null },
    { DonID: 13, TenKhach: 'Cty An Bình', MaHangID: 2, MauSacID: 5, SoLuongDat: 1, DonVi: 'Ri', LoaiRi: 6, TrangThai: 'Chờ xử lý', PhieuBHID: null },
    { DonID: 14, TenKhach: 'Cty An Bình', MaHangID: 1, MauSacID: 5, SoLuongDat: 1, DonVi: 'Ri', LoaiRi: 12, TrangThai: 'Đã hủy', PhieuBHID: null },
    { DonID: 15, TenKhach: 'Cty An Bình', MaHangID: 1, MauSacID: 5, SoLuongDat: 1, DonVi: 'Ri', LoaiRi: 12, TrangThai: 'Chờ xử lý', PhieuBHID: 900 },
    { DonID: 16, TenKhach: 'Shop Hoa', ShopID: 3, NhaPhanPhoiID: 8, TenNPP: 'Cty An Bình', MaHangID: 1, MauSacID: 5, SoLuongDat: 1, DonVi: 'Ri', LoaiRi: 12, TrangThai: 'Chờ xử lý', PhieuBHID: null },
    { DonID: 17, TenKhach: 'tk_web_anbinh', TenKhachDanhMuc: 'Cty An Bình', KhachHangIDLienKet: 44, MaHangID: 1, MauSacID: 5, SoLuongDat: 2, DonVi: 'Ri', LoaiRi: 12, TrangThai: 'Chờ xử lý', PhieuBHID: null },
    { DonID: 18, TenKhach: 'Cty Khác', MaHangID: 1, MauSacID: 5, SoLuongDat: 2, DonVi: 'Ri', LoaiRi: 12, TrangThai: 'Chờ xử lý', PhieuBHID: null }
  ];
  const ids = (ds) => ds.map(d => d.DonID).sort((a, b) => a - b).join(',');
  let r = H.donKhopDongQuet(don, { tenKhach: 'cty an bình', khachHangId: '', maHangId: 1, mauSacId: '' });
  kiem('khop theo TEN chuan hoa (hoa/thuong, khoang trang) + MA HANG, moi mau: #11,#12,#17 — loai Đã hủy, da co phieu, Đi tuyến, khach khac, ma khac', ids(r) === '11,12,17', ids(r));
  r = H.donKhopDongQuet(don, { tenKhach: 'Cty An Bình', khachHangId: '', maHangId: 1, mauSacId: 5 });
  kiem('co MAU -> chi don cung mau: #11,#17', ids(r) === '11,17', ids(r));
  r = H.donKhopDongQuet(don, { tenKhach: 'Tên khác hẳn', khachHangId: '44', maHangId: 1, mauSacId: '' });
  kiem('khop theo ID khach danh muc lien ket (don web) du ten khac: #17', ids(r) === '17', ids(r));
  r = H.donKhopDongQuet(don, { tenKhach: '', khachHangId: '', maHangId: 1, mauSacId: '' });
  kiem('chua chon khach (ten + id rong) -> KHONG khop don nao', r.length === 0, ids(r));
  r = H.donKhopDongQuet(don, { tenKhach: 'Cty An Bình', khachHangId: '', maHangId: 99, mauSacId: '' });
  kiem('ma hang khong co don -> rong', r.length === 0);
  kiem('dsDon null / phan tu null khong no', H.donKhopDongQuet(null, { tenKhach: 'x', maHangId: 1 }).length === 0 && H.donKhopDongQuet([null], { tenKhach: 'x', maHangId: 1 }).length === 0);
  kiem('don Đi tuyến (ShopID) KHONG tu khop du TenNPP trung ten khach', !H.donKhopDongQuet(don, { tenKhach: 'Cty An Bình', khachHangId: '', maHangId: 1, mauSacId: '' }).some(d => d.ShopID));

  // 2e. chon mau cho dong quet
  const mau1 = [{ MauSacID: 5, TonCai: 0, DangGiu: 0 }];
  const mau2 = [{ MauSacID: 5, TonCai: 10, DangGiu: 0 }, { MauSacID: 7, TonCai: 0, DangGiu: 0 }];
  const mau3 = [{ MauSacID: 5, TonCai: 10, DangGiu: 0 }, { MauSacID: 7, TonCai: 8, DangGiu: 0 }];
  const mau4 = [{ MauSacID: 5, TonCai: 10, DangGiu: 10 }, { MauSacID: 7, TonCai: 8, DangGiu: 2 }];
  kiem("ma chi co 1 mau -> tu chon mau do (ke ca ton 0)", H.mauChoDongQuet(mau1) === '5');
  kiem("2 mau, chi 1 mau con kha dung -> '' (KHONG tu chon: 'dang giu' gom chinh don cua khach nay, doan la sai im lang)", H.mauChoDongQuet(mau2) === '' && H.mauChoDongQuet(mau4) === '');
  kiem("2 mau deu ton -> '' (hien nut mau cho nguoi quet bam)", H.mauChoDongQuet(mau3) === '');
  kiem('dsMau rong / null -> rong, khong no', H.mauChoDongQuet([]) === '' && H.mauChoDongQuet(null) === '');
  kiem("mauKhachDat: don khop chi dat 1 mau -> mau do (chi de danh dau ★)", H.mauKhachDat([{ MauSacID: 7 }, { MauSacID: 7 }]) === '7');
  kiem("mauKhachDat: don dat 2 mau / khong don / null -> ''", H.mauKhachDat([{ MauSacID: 5 }, { MauSacID: 7 }]) === '' && H.mauKhachDat([]) === '' && H.mauKhachDat(null) === '' && H.mauKhachDat([null, { MauSacID: null }]) === '');
}

/* ------------------------------------------------------------------------------------------------
   3. openQrScanner (common.js) — gia lap DOM + Html5Qrcode + dong ho, chay that.
   ------------------------------------------------------------------------------------------------ */
console.log('\n=== 3. HANH VI: openQrScanner (common.js) — quetLai / maVach / ctx ===');
function taoMoiTruong() {
  let gio = 1000000;
  const taoNode = () => ({
    innerHTML: '', style: {}, listeners: {}, removed: false,
    addEventListener(ev, fn) { (this.listeners[ev] = this.listeners[ev] || []).push(fn); },
    remove() { this.removed = true; }
  });
  const mt = { gio: () => gio, datGio: (v) => { gio = v; }, backdrops: [], qrs: [], toasts: [] };
  const document = {
    body: { appendChild(n) { n.gan = true; } },
    createElement() {
      const b = taoNode();
      b.con = { '#qrTrangThai': taoNode(), '#qrKhuChon': taoNode(), '#qrTomTat': taoNode(), '#btnCancelQr': taoNode() };
      b.querySelector = (sel) => b.con[sel] || null;
      mt.backdrops.push(b);
      return b;
    },
    addEventListener() {}, removeEventListener() {}
  };
  function Html5Qrcode(id, cfg) { this.id = id; this.cfg = cfg; this.daDung = false; mt.qrs.push(this); }
  Html5Qrcode.prototype.start = function (cam, cfg, onOk, onErr) { this.cam = cam; this.cauHinh = cfg; this.onOk = onOk; this.onErr = onErr; return Promise.resolve(); };
  Html5Qrcode.prototype.stop = function () { this.daDung = true; return Promise.resolve(); };
  const ctx = {
    window: { isSecureContext: true }, navigator: {}, document, Html5Qrcode,
    Html5QrcodeSupportedFormats: { QR_CODE: 0, CODE_128: 1, CODE_39: 2, EAN_13: 3, EAN_8: 4, UPC_A: 5, UPC_E: 6, ITF: 7, CODABAR: 8 },
    toast: (m, t) => mt.toasts.push({ m, t }), escapeHtml: (s) => String(s == null ? '' : s),
    Date: { now: () => gio }, console, Promise
  };
  mt.ctx = ctx;
  return mt;
}
const nghi = () => new Promise(res => setImmediate(res));
async function kiemOpenQrScanner() {
  const iBat = fCommon.indexOf('function openQrScanner(onDecode, opts) {');
  const dauKet = "\n  backdrop.querySelector('#btnCancelQr').addEventListener('click', stopAndClose);\n}";
  const iKet = fCommon.indexOf(dauKet, iBat);
  kiem('tim thay openQrScanner + dau ket (nut Dong)', iBat > -1 && iKet > iBat);
  if (!(iBat > -1 && iKet > iBat)) return;
  const src = fCommon.slice(iBat, iKet + dauKet.length);

  // 3a. CHO GOI CU: khong opts -> tieu de cu, quet 1 lan la dong, onDecode nhan text
  {
    const mt = taoMoiTruong();
    vm.runInNewContext(src, mt.ctx);
    const nhan = [];
    mt.ctx.openQrScanner((t) => nhan.push(t));
    await nghi();
    const qr = mt.qrs[0];
    kiem('cho goi cu: tieu de "Quét mã QR", khung quet VUONG, khong formatsToSupport', mt.backdrops[0].innerHTML.includes('<h3>Quét mã QR</h3>') && qr.cfg === undefined
      && (() => { const b = qr.cauHinh.qrbox(640, 480); return b.width === b.height; })());
    kiem('cho goi cu: KHONG chen hai div trang thai (khong them khoang trang duoi camera cua man quet QR cu)', !mt.backdrops[0].innerHTML.includes('id="qrTrangThai"') && !mt.backdrops[0].innerHTML.includes('id="qrTomTat"'));
    qr.onOk('CAY001');
    await nghi();
    kiem('cho goi cu: giai ma 1 lan -> onDecode(text) + dong camera + go overlay', nhan.length === 1 && nhan[0] === 'CAY001' && qr.daDung && mt.backdrops[0].removed);
  }
  // 3b. continuous KHONG quetLai: hanh vi cu — cung ma lien tiep chi nhan 1 lan, ke ca sau khoang nghi dai
  {
    const mt = taoMoiTruong();
    vm.runInNewContext(src, mt.ctx);
    const nhan = [];
    mt.ctx.openQrScanner((t) => nhan.push(t), { continuous: true });
    await nghi();
    const qr = mt.qrs[0];
    qr.onOk('A'); qr.onOk('A'); qr.onOk('B'); qr.onOk('A');
    kiem('continuous (cu): A,A,B,A -> 3 lan (chi bo trung LIEN TIEP)', nhan.join('') === 'ABA', nhan.join(''));
    mt.datGio(mt.gio() + 5000); qr.onErr('no code'); qr.onOk('A');
    kiem('continuous (cu): sau 5s khong thay ma, cung ma A van KHONG dem lai (giu nguyen hanh vi cu)', nhan.join('') === 'ABA', nhan.join(''));
    kiem('continuous (cu): camera van mo', !qr.daDung);
  }
  // 3c. continuous + quetLai: cung ma dem lai SAU KHI roi khung >= nghiMs
  {
    const mt = taoMoiTruong();
    vm.runInNewContext(src, mt.ctx);
    const nhan = [];
    mt.ctx.openQrScanner((t) => nhan.push(t), { continuous: true, quetLai: true, nghiMs: 800 });
    await nghi();
    const qr = mt.qrs[0];
    qr.onOk('A'); qr.onOk('A'); qr.onOk('A');
    kiem('quetLai: tem con trong khung (A,A,A lien tiep) -> 1 lan', nhan.length === 1);
    // Khung trong dau tien chi DAT MOC; 300 ms sau van trong nhung < 800 -> chua reset; thay lai A -> van 1.
    qr.onErr('no code'); mt.datGio(mt.gio() + 300); qr.onErr('no code'); qr.onOk('A');
    kiem('quetLai: khung trong 300ms (< 800) roi thay lai -> van 1 lan (nhap nhay / mat net khong tinh)', nhan.length === 1, nhan.length);
    // Thay A xong -> chuoi trong bi cat. Trong lai: moc moi, 900 ms sau van trong -> reset -> A dem lan 2.
    qr.onErr('no code'); mt.datGio(mt.gio() + 900); qr.onErr('no code'); qr.onOk('A');
    kiem('quetLai: khung trong LIEN TUC >= 800ms roi dua tem CUNG MA vao -> dem lan 2', nhan.length === 2, nhan.length);
    qr.onOk('A');
    kiem('quetLai: ngay sau do van chan doc lai 10 lan/giay', nhan.length === 2);
    qr.onOk('B'); qr.onOk('A');
    kiem('quetLai: ma KHAC xen giua -> dem binh thuong (B, roi A)', nhan.join('') === 'AABA', nhan.join(''));
    qr.onErr('x'); mt.datGio(mt.gio() + 100); qr.onErr('x');
    kiem('quetLai: khung trong moi 100ms -> chua reset', (() => { qr.onOk('A'); return nhan.join('') === 'AABA'; })());
    // MOT khung trong roi nhay ngay 5 s (khong co khung trong thu hai) -> moc da dat nhung chua ai do -> A van bi chan
    qr.onErr('x'); mt.datGio(mt.gio() + 5000); qr.onOk('A');
    kiem('quetLai: can >= 2 khung trong de do khoang trong (1 khung + thay lai ngay -> khong reset)', nhan.join('') === 'AABA', nhan.join(''));
  }
  // 3f. onDecode CHAN LUONG lau (hop confirm cua phieu ban hang) -> khong duoc sinh lan dem ma
  {
    const mt = taoMoiTruong();
    vm.runInNewContext(src, mt.ctx);
    const nhan = [];
    mt.ctx.openQrScanner((t) => { nhan.push(t); mt.datGio(mt.gio() + 3000); /* confirm() chan 3 giay */ }, { continuous: true, quetLai: true, nghiMs: 800 });
    await nghi();
    const qr = mt.qrs[0];
    qr.onOk('A');                 // dem lan 1, trong luc do "confirm" chan 3 s
    qr.onErr('mo');               // khung dau sau hop thoai: mo -> chi dat moc
    qr.onOk('A');                 // tem van trong tay
    kiem('quetLai: confirm chan 3s roi 1 khung mo + thay lai tem -> KHONG dem ma (do khoang trong lien tuc, khong do "ke tu lan thay cuoi")', nhan.length === 1, nhan.length);
    mt.datGio(mt.gio() + 200); qr.onErr('mo'); mt.datGio(mt.gio() + 200); qr.onErr('mo'); qr.onOk('A');
    kiem('quetLai: hai khung trong cach nhau 200ms (< 800) -> van chua reset', nhan.length === 1, nhan.length);
  }
  // 3g. mac dinh nghiMs: 800 ms cho QR, 1200 ms cho ma vach (ZXing 1D hay hong vai khung lien tiep)
  for (const [maVach, mongDoi] of [[false, 800], [true, 1200]]) {
    const mt = taoMoiTruong();
    vm.runInNewContext(src, mt.ctx);
    const nhan = [];
    mt.ctx.openQrScanner((t) => nhan.push(t), { continuous: true, quetLai: true, maVach });
    await nghi();
    const qr = mt.qrs[0];
    qr.onOk('A'); qr.onErr('x'); mt.datGio(mt.gio() + (mongDoi - 50)); qr.onErr('x'); qr.onOk('A');
    const chuaReset = nhan.length === 1;
    qr.onErr('x'); mt.datGio(mt.gio() + mongDoi); qr.onErr('x'); qr.onOk('A');
    kiem(`mac dinh nghiMs ${maVach ? 'ma vach' : 'QR'} = ${mongDoi} ms (${mongDoi - 50} chua reset, ${mongDoi} reset)`, chuaReset && nhan.length === 2, nhan.length);
  }
  // 3d. maVach: bo giai ma 1D + khung NGANG; ctx.baoCao / datTomTat / keu; tieuDe / huongDan
  {
    const mt = taoMoiTruong();
    vm.runInNewContext(src, mt.ctx);
    let ctxNhan = null;
    mt.ctx.openQrScanner((t, c) => { ctxNhan = c; }, { continuous: true, quetLai: true, maVach: true, amThanh: true, tieuDe: 'Tiêu đề thử', huongDan: 'Hướng dẫn <b>thử</b>' });
    await nghi();
    const qr = mt.qrs[0];
    kiem('maVach: formatsToSupport co CODE_128 + EAN_13 + QR', !!qr.cfg && Array.isArray(qr.cfg.formatsToSupport) && [0, 1, 3].every(x => qr.cfg.formatsToSupport.includes(x)), qr.cfg);
    const box = qr.cauHinh.qrbox(640, 480);
    kiem('maVach: khung quet NGANG (rong > cao) va nam trong khung hinh', box.width > box.height && box.width <= 640 && box.height <= 480, box);
    const boxNho = qr.cauHinh.qrbox(240, 320);
    kiem('maVach: khung hinh nho (240x320) -> khung quet khong vuot khung hinh', boxNho.width <= 240 && boxNho.height <= 320, boxNho);
    const b = mt.backdrops[0];
    kiem('tieuDe + huongDan tuy chinh hien ra', b.innerHTML.includes('<h3>Tiêu đề thử</h3>') && b.innerHTML.includes('Hướng dẫn <b>thử</b>'));
    qr.onOk('8938000111');
    kiem('onDecode nhan ctx (tham so thu hai)', !!ctxNhan && typeof ctxNhan.baoCao === 'function' && typeof ctxNhan.datTomTat === 'function' && typeof ctxNhan.keu === 'function' && typeof ctxNhan.dong === 'function');
    if (ctxNhan) {
      ctxNhan.baoCao('✓ ok', 'ok');
      kiem("ctx.baoCao ghi vao #qrTrangThai, mau xanh khi 'ok'", b.con['#qrTrangThai'].innerHTML === '✓ ok' && b.con['#qrTrangThai'].style.color === '#137333');
      ctxNhan.baoCao('✕ loi', 'loi');
      kiem("ctx.baoCao mau do khi 'loi'", b.con['#qrTrangThai'].style.color === '#c0392b');
      ctxNhan.datTomTat('tom tat');
      kiem('ctx.datTomTat ghi vao #qrTomTat', b.con['#qrTomTat'].innerHTML === 'tom tat');
      const khu = ctxNhan.datKhuChon('<button>Đen</button>');
      kiem('ctx.datKhuChon ghi vao #qrKhuChon va TRA VE phan tu (de ben goi noi su kien nut mau)', khu === b.con['#qrKhuChon'] && b.con['#qrKhuChon'].innerHTML === '<button>Đen</button>');
      kiem('maVach: co du 3 khu qrTrangThai / qrKhuChon / qrTomTat trong overlay', ['id="qrTrangThai"', 'id="qrKhuChon"', 'id="qrTomTat"'].every(s => b.innerHTML.includes(s)));
      let no = false;
      try { ctxNhan.keu(true); ctxNhan.keu(false); } catch (e) { no = true; }
      kiem('ctx.keu khong no khi trinh duyet KHONG co AudioContext/vibrate', !no);
      ctxNhan.dong();
      await nghi();
      kiem('ctx.dong() dung camera + go overlay', qr.daDung && b.removed);
    }
  }
  // 3h. truocKhiDong: tra false -> KHONG dong (nut Dong / Esc / ctx.dong); tra true -> dong
  {
    const mt = taoMoiTruong();
    vm.runInNewContext(src, mt.ctx);
    let choPhep = false, ctxNhan = null;
    mt.ctx.openQrScanner((t, c) => { ctxNhan = c; }, { continuous: true, maVach: true, truocKhiDong: () => choPhep });
    await nghi();
    const qr = mt.qrs[0];
    const b = mt.backdrops[0];
    qr.onOk('X');
    ctxNhan.dong(); await nghi();
    kiem('truocKhiDong tra false -> ctx.dong() KHONG dong camera', !qr.daDung && !b.removed);
    b.con['#btnCancelQr'].listeners.click[0](); await nghi();
    kiem('truocKhiDong tra false -> nut Dong cung KHONG dong', !qr.daDung && !b.removed);
    choPhep = true;
    ctxNhan.dong(); await nghi();
    kiem('truocKhiDong tra true -> dong binh thuong', qr.daDung && b.removed);
  }
  // 3e. khong secure context -> bao loi, khong mo camera
  {
    const mt = taoMoiTruong();
    mt.ctx.window.isSecureContext = false;
    vm.runInNewContext(src, mt.ctx);
    mt.ctx.openQrScanner(() => {}, { continuous: true, maVach: true });
    kiem('http thuong (khong secure context) -> toast loi, KHONG tao camera', mt.qrs.length === 0 && mt.toasts.length === 1 && /https/.test(mt.toasts[0].m));
  }
}

/* ------------------------------------------------------------------------------------------------
   4. NOI VOI FORM phieu ban hang (so chuoi tren ban da bo comment) + may chu + index.html
   ------------------------------------------------------------------------------------------------ */
function kiemChuoi() {
  console.log('\n=== 4. FORM PHIEU BAN HANG (module.khohang.js, da bo comment) ===');
  const code = boComment(fKho);
  const iForm = code.indexOf('async function openPhieuBanHangForm(perm, donChon, phieuSua)');
  kiem('tim thay openPhieuBanHangForm', iForm > -1);
  const form = iForm > -1 ? code.slice(iForm) : '';
  kiem('nut "Quét mã vạch" nam trong hang nut "+ Thêm dòng hàng" (ve lai moi lan veDong)', /id="bhThem">\+ Thêm dòng hàng<\/button>\s*(\$\{''\}\s*)?<button type="button" class="btn small secondary" id="bhQuet"/.test(form));
  kiem('bam nut -> quetMaVachThemHang(), loi hien toast (khong "bam ma khong co gi xay ra")', /#bhQuet'\)\.addEventListener\('click', \(\) => \{ quetMaVachThemHang\(\)\.catch\(err => toast\(err\.message, 'error'\)\); \}\)/.test(form));
  kiem('mo camera: continuous + quetLai + maVach + amThanh (dem nhieu ri cung ma)', /continuous: true, quetLai: true, maVach: true, amThanh: true,/.test(form));
  kiem('nap don cho xuat KHONG loc ?khach= o SQL (loc phia nay bang chuanTenKhach + ID)', /apiGet\('\/api\/banhang\/donchoxuat'\)\)\.data \|\| \[\]/.test(form) && !/donchoxuat\?khach=' \+ encodeURIComponent\(ten\)/.test(form));
  kiem('loi tai don -> [] + console.warn, khong chan viec quet', /catch \(err\) \{ dsDonCho = \[\]; console\.warn\(/.test(form));
  kiem('mau cua tem: mau da bam trong luot (mauDangQuet) -> mau khong the nham (mauChoDongQuet) -> con lai GIU TEM, hien nut mau', /const mau = mauDangQuet\.get\(id\) \|\| mauChoDongQuet\(dsMau\);/.test(form) && /if \(!mau && dsMau\.length >= 2\) \{/.test(form) && /choChonMau = \{ it, id, soTem: 1 \};/.test(form) && /veNutMau\(it, '', mauKhachDat\(donKhop\)\);/.test(form));
  kiem('quet N tem cung ma khi chua bam mau -> giu N tem, bam mau cong ca N Ri; cong loi thi tra lai tem', /if \(choChonMau\) choChonMau\.soTem\+\+;/.test(form) && /const giu = choChonMau;\s*choChonMau = null;\s*try \{ congRiVaoDong\(it, m, giu\.soTem, ''\); \}\s*catch \(err\) \{ choChonMau = giu; throw err; \}/.test(form));
  kiem('quet sang MA KHAC khi dang giu tem chua bam mau -> bo tem do, bao NGAY TRONG cau bao cua lan quet nay (tienTo), khong bi cau ✓ de len', /if \(choChonMau && choChonMau\.id !== id\) \{\s*tienTo = `⚠ Bỏ \$\{choChonMau\.soTem\} tem/.test(form) && /congRiVaoDong\(it, mau, 1, tienTo\);/.test(form) && /baoCao\(\(tienTo \|\| ''\) \+ `✓ /.test(form) && /baoCao\(tienTo \+ `<b>/.test(form));
  kiem('tom tat luon nhac tem dang giu chua bam mau; dong camera khi con tem -> truocKhiDong hoi truoc', /ctxQuet\.datTomTat\(\(choChonMau \? `<b style="color:#c0392b;">⚠ Đang giữ/.test(form) && /truocKhiDong: \(\) => !choChonMau \|\| confirm\(/.test(form));
  kiem('bam nut mau khi KHONG giu tem = doi mau cho cac lan quet sau (mauDangQuet.set), khong cong gi', /mauDangQuet\.set\(String\(it\.MaHangID\), m\);\s*if \(choChonMau && choChonMau\.id === String\(it\.MaHangID\)\)/.test(form) && /\} else \{\s*veNutMau\(it, m, mauGoiY\);/.test(form));
  kiem('dong quet khoa theo (ma, mau): dongQuetTheoKhoa "MaHangID|MauSacID", dong moi mauSacId = mau', /const khoa = id \+ '\|' \+ \(mau \|\| ''\);/.test(form) && /dongQuetTheoKhoa\.set\(khoa, r\.idx\);/.test(form) && /idx: \+\+idx, maHangId: it\.MaHangID, mauSacId: mau \|\| '', maHang: it\.MaHang/.test(form) && /donIDs: \[\], quet: true/.test(form) && /dong\.push\(r\);\s*ganDonChoDongQuet\(r\);/.test(form));
  kiem('moi lan cong = +he x soRi vao SL, ghi thang vao o .bh-sl, nho lanCuoi (ke ca SL truoc) de hoan lai', /const cai = he \* soRi;\s*r\.soLuong = \(Number\(r\.soLuong\) \|\| 0\) \+ cai;\s*lanCuoi = \{ r, cai, soRi, slTruoc \};/.test(form) && /oSL\.value = r\.soLuong/.test(form) && /slTruoc = slCu;/.test(form) && /if \(r\) slTruoc = Number\(r\.soLuong\) \|\| 0;/.test(form));
  kiem('nut "↶ Hoàn lại": SL ve dung so TRUOC lan quet (ke ca sau "dem lai"), nut mau giu theo ma DANG GIU tem, boc anToan', /r\.soLuong = slTruoc;/.test(form) && /data-tru="1"/.test(form) && /bTru\.addEventListener\('click', \(\) => anToan\(hoanLaiLanCuoi\)\)/.test(form) && /if \(choChonMau\) veNutMau\(choChonMau\.it, '', ''\);/.test(form));
  kiem('ganDonChoDongQuet khong gan lai don DA nam o dong khac cua phieu (2 dong cung DonID = backend nem loi sai nghia)', /dong\.forEach\(x => \{ if \(x !== r\) \(x\.donIDs \|\| \[\]\)\.forEach\(id => daGan\.add\(Number\(id\)\)\); \}\);/.test(form) && /\.filter\(d => !daGan\.has\(Number\(d\.DonID\)\)\);/.test(form));
  kiem('dong co san cung ma + cung mau: hoi 1 lan dem lai / cong them (bo hoi khi dong dang 0), roi thanh dong quet; dong nhap tay chua mau nhan mau vua bam', /const coSan = cungMa\.find\(x => String\(x\.mauSacId \|\| ''\) === String\(mau \|\| ''\)\)\s*\|\| \(mau \? cungMa\.find\(x => !x\.mauSacId\) : null\) \|\| null;/.test(form) && /const demLai = slCu > 0 && confirm\(/.test(form) && /if \(demLai\) coSan\.soLuong = 0;\s*coSan\.quet = true;/.test(form) && /if \(!coSan\.mauSacId && mau\) \{ coSan\.mauSacId = mau; nhanMauMoi = true; \}/.test(form) && /if \(el && \(nhanMauMoi \|\| coDon !== dangVeKieuDon\)\) veLaiDong\(r\); else tinhTong\(\);/.test(form));
  kiem('doi MAU dong quet (don TU KHOP) -> khop lai don + ve lai dong', /if \(r\.quet && !r\.donChonTay\) \{ ganDonChoDongQuet\(r\); veLaiDong\(r\); return; \}/.test(form));
  kiem('doi KHACH (chon lai / khach moi) + sau khi nap xong don -> khopLaiDongQuetTheoKhach() 3 cho', (form.match(/khopLaiDongQuetTheoKhach\(\);/g) || []).length === 3, (form.match(/khopLaiDongQuetTheoKhach\(\);/g) || []).length);
  kiem('dong co don NGUOI DUNG TU TICH (Chon don) -> donChonTay, khong bi khop lai tu dong ghi de; dong quet luot truoc giu nguyen', /if \(!daLaDongQuet\) \{ if \(r\.donIDs && r\.donIDs\.length\) r\.donChonTay = true; else ganDonChoDongQuet\(r\); \}/.test(form) && /dong\.filter\(r => r\.quet && !r\.donChonTay\)/.test(form));
  kiem('mo camera NGAY trong cu bam (ham khong async, khong await truoc openQrScanner), don nap song song', /function quetMaVachThemHang\(\) \{/.test(form) && !/async function quetMaVachThemHang/.test(form) && /const taiXong = taiDonChoXuat\(\)\.then\(/.test(form) && /return taiXong;/.test(form));
  kiem('moi luot mo camera: dat lai mau da chon / dong da cong / tem dang giu / lan cuoi', /mauDangQuet\.clear\(\); dongQuetTheoKhoa\.clear\(\); choChonMau = null; lanCuoi = null;/.test(form));
  kiem('moi duong vao (callback camera, nut mau, nut hoan lai) boc anToan -> loi hien dong do thay vi "khong co gi xay ra"', /const anToan = \(fn\) => \{\s*try \{ fn\(\); \}\s*catch \(err\) \{ console\.error\('\[quét mã vạch\]', err\); keu\(false\); baoCao\(/.test(form) && /anToan\(\(\) => xuLyMaQuet\(text\)\);/.test(form) && /b\.addEventListener\('click', \(\) => anToan\(\(\) => \{/.test(form));
  kiem('khong con hoi so thu tu dong bang prompt (da thay bang nut mau)', !/prompt\(/.test(form.slice(form.indexOf('function quetMaVachThemHang'))));
  kiem('moc "khach dat" (slDatCai) cong NGAY LUC GOP DON (khong suy tu SL dang hien, SL co the da sua tay)', /slDatCai: 0/.test(form) && /g\.soLuong \+= cai;\s*g\.slDatCai \+= cai;/.test(form) && !/coSan\.slDatCai = slCu/.test(form));
  kiem('luoi "giao thieu": SL phieu < SL dat cua don tu khop -> confirm truoc khi luu', /const giaoThieu = \[\];/.test(form) && /if \(cai < r\.slDatCai\)/.test(form) && /if \(giaoThieu\.length && !confirm\(/.test(form));
  kiem('payload van gui donIDs cua dong (duong cu v6.25.4) — khong co duong ghi moi', /donIDs: r\.donIDs \|\| \[\]/.test(form));
  kiem('"nhieu" (ma vach trung) va "khong" deu bao loi + keu(false), KHONG them dong', /kq\.kieu === 'khong'\) \{\s*keu\(false\);/.test(form) && /kq\.kieu === 'nhieu'\) \{\s*keu\(false\);/.test(form));

  console.log('\n=== 5. MAY CHU khong doi + index.html ===');
  const be = boComment(fBE);
  kiem("banhang.js: ghiChiTietPhieu van chuyen don gan vao dong sang 'Đã xuất hàng' (duong ma v9.50 dua vao)", /UPDATE DonKhachDatHang SET TrangThai = N'Đã xuất hàng', PhieuBHID = @p\s*WHERE DonID = @don AND PhieuBHID IS NULL AND TrangThai IN \(N'Chờ xác nhận', N'Chờ xử lý'\)/.test(be));
  kiem('GET /donchoxuat van tra MaHangID, MauSacID, TrangThai, SoLuongDat, DonVi, LoaiRi (ham thuan dung cac cot nay)', /SELECT o\.DonID, o\.ThoiGian, o\.TenKhach, o\.MaHangID, o\.MauSacID, o\.SoLuongDat, o\.DonVi, o\.TrangThai,/.test(be) && /h\.MaHang, h\.TenHang, h\.GiaBan, h\.LoaiRi, h\.DonViCoBan, h\.DonViQuyDoi/.test(be));
  kiem('GET /khohang/items tra MaBarcode qua vw_TonKhoHangHoa (form tra ma vach ngay tren items da nap)', /x\.GiaAloha, x\.MaBarcode, x\.NhomSanPhamID/.test(doc('database', 'CAI_DAT_DAY_DU.sql')));
  const v = (f) => { const x = new RegExp(f.replace('.', '\\.') + '\\?v=([\\d.]+)').exec(html); return x ? parseFloat(x[1]) : 0; };
  kiem('index.html bump common.js >= 9.50', v('common.js') >= 9.5, v('common.js'));
  kiem('index.html bump module.khohang.js >= 9.50', v('module.khohang.js') >= 9.5, v('module.khohang.js'));
  kiem('index.html van nap html5-qrcode 2.3.8 (co Html5QrcodeSupportedFormats)', /html5-qrcode\/2\.3\.8\/html5-qrcode\.min\.js/.test(html));
}

(async () => {
  try { await kiemOpenQrScanner(); } catch (e) { sai++; console.log('  ❌ muc 3 NO: ' + (e && e.stack || e)); }
  kiemChuoi();
  console.log(`\n=== KET QUA: ${dat} dat, ${sai} sai ===`);
  process.exit(sai ? 1 : 0);
})();
