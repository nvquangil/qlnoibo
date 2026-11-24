/* ================================================================================================
   kiem_ma_vach_the_kho.js — bo tu kiem cho v9.51 (cot MA VACH o danh sach The kho hang hoa: sua ngay tai
   dong + quet tem bang camera, route PUT /items/:id/mavach — Nguyen 13/11/2026 "danh muc hang hoa chua
   co cot ma vach")

   Chay:  node backend\utils\kiem_ma_vach_the_kho.js
   KHONG copy sang D:\QLSX. KHONG dung toi CSDL (pool gia). Route duoc CAT THEO DAU MOC va chay that voi
   req/res gia; chuanHoa() lay NGUYEN VAN tu utils/traCuuHangCongKhai.js.
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
const boComment = (s) => s.replace(/image\/\*/g, 'image_ALL').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const fBE = doc('backend', 'routes', 'khohang.js');
const fFE = doc('frontend', 'js', 'module.khohang.js');
const fTC = doc('backend', 'utils', 'traCuuHangCongKhai.js');
const html = doc('frontend', 'index.html');

console.log('\n=== 1. BIEN DICH (vm.Script) ===');
[['backend/routes/khohang.js', fBE], ['frontend/js/module.khohang.js', fFE]].forEach(([f, s]) => {
  if (!s) { sai++; console.log('  ❌ ' + f + ' KHONG DOC DUOC'); return; }
  try { new vm.Script(s, { filename: f }); dat++; console.log('  ✓ ' + f); }
  catch (e) { sai++; console.log('  ❌ ' + f + ' VO CU PHAP: ' + e.message); }
});

/* ------------------------------------------------------------------------------------------------
   2. HANH VI route PUT /items/:id/mavach — cat theo dau moc, chay voi pool/req/res gia
   ------------------------------------------------------------------------------------------------ */
console.log('\n=== 2. HANH VI: PUT /items/:id/mavach ===');
/* chuanHoa that: const DAU_TO_HOP + function chuanHoa(s) { ... } (ham 6 dong, ket thuc o "\n}") */
let chuanHoa = null;
{
  const i = fTC.indexOf('const DAU_TO_HOP = new RegExp(');
  const j = fTC.indexOf('function chuanHoa(s) {', i);
  const k = fTC.indexOf('\n}', j);
  kiem('cat duoc chuanHoa() tu traCuuHangCongKhai.js', i > -1 && j > i && k > j);
  if (i > -1 && j > i && k > j) {
    try { chuanHoa = new Function(fTC.slice(i, k + 2) + '\nreturn chuanHoa;')(); } catch (e) { kiem('chuanHoa chay duoc', false, e.message); }
  }
}
let handler = null;
{
  const iBat = fBE.indexOf('/* === v9.51 MA VACH THE KHO — BAT DAU === */');
  const iKet = fBE.indexOf('/* === v9.51 MA VACH THE KHO — KET THUC === */');
  kiem('tim thay hai dau moc v9.51 trong khohang.js', iBat > -1 && iKet > iBat);
  if (iBat > -1 && iKet > iBat && chuanHoa) {
    const src = fBE.slice(iBat, iKet);
    const dangKy = {};
    const router = { put: (p, ...mw) => { dangKy[p] = mw; } };
    const mw = (ten) => Object.assign(function () {}, { __ten: ten });
    try {
      new Function('router', 'requireAuth', 'requirePermission', 'requireChucNang', 'getPool', 'sql', 'require', src)(
        router, mw('auth'), (m, q) => mw('perm:' + m + ':' + q), (m, c) => mw('cn:' + m + ':' + c),
        () => Promise.resolve(global.__poolGia), { Int: 'Int', NVarChar: 'NVarChar' },
        (p) => { if (/traCuuHangCongKhai$/.test(p)) return global.__traCuuGia; throw new Error('require la: ' + p); });
      const d = dangKy['/items/:id/mavach'];
      kiem('dang ky PUT /items/:id/mavach voi auth + KHOHANG/edit + chuc nang items (giong /congkhai)', !!d && d.length === 4
        && d[0].__ten === 'auth' && d[1].__ten === 'perm:KHOHANG:edit' && d[2].__ten === 'cn:KHOHANG:items', d && d.map(x => x.__ten));
      handler = d && d[3];
    } catch (e) { kiem('khoi route chay duoc (new Function)', false, e.message); }
  }
}
/* Pool gia: ghi lai moi cau query + input; SELECT tra danh sach ma khac, UPDATE tra rowsAffected. */
function taoPool(ds, rowsAffected, nem) {
  const nhatKy = [];
  const pool = {
    request() {
      const inputs = {};
      const rq = {
        input(t, kieu, gt) { inputs[t] = gt; return rq; },
        async query(q) {
          nhatKy.push({ q, inputs: { ...inputs } });
          if (nem) throw new Error(nem);
          if (/^SELECT/i.test(q.trim())) return { recordset: ds };
          if (/^UPDATE/i.test(q.trim())) return { rowsAffected: [rowsAffected] };
          throw new Error('query la: ' + q);
        }
      };
      return rq;
    }
  };
  return { pool, nhatKy };
}
async function goi(id, body, ds, rowsAffected, nem) {
  const { pool, nhatKy } = taoPool(ds || [], rowsAffected == null ? 1 : rowsAffected, nem);
  global.__poolGia = pool;
  let soXoa = 0;
  global.__traCuuGia = { chuanHoa, xoaChiMuc: () => { soXoa++; } };
  const res = { code: 200, body: null, status(c) { this.code = c; return this; }, json(o) { this.body = o; } };
  await handler({ params: { id }, body }, res);
  return { res, nhatKy, soXoa };
}
if (handler) (async () => {
  const khac = [{ MaHangID: 2, MaHang: 'AB124', MaBarcode: '8938-000111' }, { MaHangID: 3, MaHang: 'CD9', MaBarcode: '12345' }];
  let r = await goi('abc', { maBarcode: '1' }, khac);
  kiem('id khong hop le -> 400, khong cham CSDL', r.res.code === 400 && r.nhatKy.length === 0, r.res);
  r = await goi('5', { maBarcode: 'x'.repeat(51) }, khac);
  kiem('qua 50 ky tu -> 400', r.res.code === 400 && /50/.test(r.res.body.message));
  r = await goi('5', { maBarcode: '--- ---' }, khac);
  kiem("ma vach khong co chu/so ('--- ---') -> 400", r.res.code === 400 && r.nhatKy.length === 0, r.res);
  r = await goi('5', { maBarcode: '8938000111' }, khac);
  kiem("TRUNG theo chuan hoa ('8938000111' vs '8938-000111' cua AB124) -> 409 neu ten ma dang giu, KHONG UPDATE", r.res.code === 409 && /AB124/.test(r.res.body.message)
    && !r.nhatKy.some(x => /^UPDATE/i.test(x.q.trim())) && r.soXoa === 0, r.res);
  r = await goi('2', { maBarcode: '8938000111' }, khac.filter(x => x.MaHangID !== 2));
  kiem('cung ma hang ghi lai chinh ma vach cua no -> khong tu coi la trung (SELECT loai MaHangID <> @id)', r.res.code === 200
    && r.nhatKy.some(x => /MaHangID <> @id/.test(x.q) && x.inputs.id === 2), r.res);
  r = await goi('5', { maBarcode: '  8938000222 ' }, khac);
  const upd = r.nhatKy.find(x => /^UPDATE/i.test(x.q.trim()));
  kiem('hop le -> trim, UPDATE dung 1 cot MaBarcode WHERE MaHangID, tra data.MaBarcode, xoa chi muc Zalo 1 lan', r.res.code === 200
    && !!upd && /UPDATE TheKhoHangHoa SET MaBarcode = @b WHERE MaHangID = @id/.test(upd.q) && upd.inputs.b === '8938000222' && upd.inputs.id === 5
    && r.res.body.data.MaBarcode === '8938000222' && r.soXoa === 1, { res: r.res, upd });
  kiem('cau UPDATE KHONG dung toi cot nao khac (khong AnhDaiDien/TenHang/LoaiRi...)', !!upd && !/AnhDaiDien|TenHang|LoaiRi|GiaBan|CongKhai/.test(upd.q));
  r = await goi('5', { maBarcode: '' }, khac);
  const upd2 = r.nhatKy.find(x => /^UPDATE/i.test(x.q.trim()));
  kiem("gui rong -> XOA ma vach (b = null), khong SELECT kiem trung, tra MaBarcode null", r.res.code === 200 && !!upd2 && upd2.inputs.b === null
    && !r.nhatKy.some(x => /^SELECT/i.test(x.q.trim())) && r.res.body.data.MaBarcode === null, r.res);
  r = await goi('5', {}, khac);
  kiem('khong gui maBarcode -> coi nhu rong (xoa), khong no', r.res.code === 200 && r.res.body.data.MaBarcode === null, r.res);
  r = await goi('999', { maBarcode: '777' }, khac, 0);
  kiem('UPDATE 0 dong -> 404', r.res.code === 404, r.res);
  /* Route console.error(err) truoc khi tra 400 — tat tam console.error de dong "Error: mat ket noi" (co y)
     khong bi kiem_tat_ca in ra nhu mot loi that. */
  const errGoc = console.error; console.error = () => {};
  try { r = await goi('5', { maBarcode: '777' }, khac, 1, 'mat ket noi'); } finally { console.error = errGoc; }
  kiem('CSDL nem loi -> 400 "Lỗi khi ghi mã vạch" (khong treo request)', r.res.code === 400 && /Lỗi khi ghi mã vạch/.test(r.res.body.message) && /mat ket noi/.test(r.res.body.message), r.res);
  kiemChuoi();
})().catch(e => { sai++; console.log('  ❌ muc 2 NO: ' + (e && e.stack || e)); kiemChuoi(); });
else kiemChuoi();

/* ------------------------------------------------------------------------------------------------
   3. GIAO DIEN danh sach The kho + index.html (so chuoi tren ban da bo comment)
   ------------------------------------------------------------------------------------------------ */
function kiemChuoi() {
  console.log('\n=== 3. GIAO DIEN (module.khohang.js, da bo comment) ===');
  const code = boComment(fFE);
  const iR = code.indexOf('async function renderItems(perm) {');
  const iSau = code.indexOf('function openChuyenDanhMucModal(', iR);
  kiem('tim thay renderItems', iR > -1 && iSau > iR);
  const r = iR > -1 ? code.slice(iR, iSau > iR ? iSau : undefined) : '';
  kiem('cot "Mã vạch" trong thead, ngay sau Tên hàng', /<th>Tên hàng<\/th><th style="width:150px;">Mã vạch/.test(r));
  kiem('o ma vach moi dong: td.kh-mavach co data-id / data-mahang / data-mavach, nut ✎ chi khi canEdit', /<td class="kh-mavach" data-id="\$\{r\.MaHangID\}" data-mahang="\$\{escapeHtml\(r\.MaHang\)\}" data-mavach="\$\{escapeHtml\(r\.MaBarcode \|\| ''\)\}">/.test(r)
    && /\$\{perm\.canEdit \? `<button type="button" class="btn small secondary act-mavach"/.test(r));
  kiem('data-search cua dong co ca MaBarcode (tim/quet theo ma vach)', /data-search="\$\{escapeHtml\(\(\(r\.MaHang \|\| ''\) \+ ' ' \+ \(r\.TenHang \|\| ''\) \+ ' ' \+ \(r\.MaBarcode \|\| ''\) \+ ' ' \+ chuoiLenh\)\.toLowerCase\(\)\)\}"/.test(r));
  kiem('colspan dong trong tang len 17/16 (them 1 cot)', /colspan="\$\{perm\.canEdit \? 17 : 16\}"/.test(r));
  kiem('✎ -> moSuaMaVach: o nhap + 📷 + 💾 + ✕; luu qua PUT /items/:id/mavach, KHONG qua PUT /items/:id', /function moSuaMaVach\(td\) \{/.test(r)
    && /apiPut\('\/api\/khohang\/items\/' \+ td\.dataset\.id \+ '\/mavach', \{ maBarcode: moi \}\)/.test(r)
    && /kh-mavach-quet"/.test(r) && /kh-mavach-luu"/.test(r) && /kh-mavach-huy"/.test(r)
    && !/apiPut\('\/api\/khohang\/items\/' \+ td\.dataset\.id, /.test(r));
  kiem('📷 trong o sua: openQrScanner maVach, quet 1 lan la dien vao o nhap (khong continuous)', /openQrScanner\(\(text\) => \{ inp\.value = String\(text \|\| ''\)\.trim\(\); inp\.focus\(\); \}, \{\s*maVach: true,/.test(r)
    && !/kh-mavach-quet[\s\S]{0,400}continuous: true/.test(r));
  kiem('luu xong: doi chu + data-mavach + data-search + tongHop cua DUNG dong, noi lai nut ✎, KHONG ve lai ca bang', /td\.dataset\.mavach = daLuu;/.test(r) && /tr\.dataset\.search = /.test(r)
    && /if \(it\) it\.MaBarcode = daLuu \|\| null;/.test(r) && /noiNutMaVach\(td\);\s*toast\(/.test(r) && !/moSuaMaVach[\s\S]*?renderItems\(perm\)[\s\S]*?function noiNutMaVach/.test(r));
  kiem('luu loi (409 trung) -> giu o nhap, mo lai nut Luu, toast loi', /catch \(err\) \{ nutLuu\.disabled = false; toast\(err\.message, 'error'\); inp\.focus\(\); \}/.test(r));
  kiem('Enter = luu, Esc = bo', /if \(e\.key === 'Enter'\) \{ e\.preventDefault\(\); luu\(\); \} else if \(e\.key === 'Escape'\) \{ e\.preventDefault\(\); dong\(\); \}/.test(r));
  kiem('nut 📷 canh o tim: quet tem -> dien vao #khSearch -> applyKhFilter, bao so dong', /id="khQuetTim"/.test(r) && /btnQuetTim\.addEventListener\('click', \(\) => \{\s*openQrScanner\(\(text\) => \{/.test(r) && /o\.value = String\(text \|\| ''\)\.trim\(\);\s*applyKhFilter\(\);/.test(r));

  console.log('\n=== 4. MAY CHU: vi tri route + index.html ===');
  const be = boComment(fBE);
  const iMV = be.indexOf("router.put('/items/:id/mavach'");
  const iCK = be.indexOf("router.put('/items/:id/congkhai'");
  const iID = be.indexOf("router.put('/items/:id',");
  kiem('route /items/:id/mavach nam SAU /congkhai va TRUOC PUT /items/:id (cung khuon)', iMV > iCK && iCK > -1 && iID > iMV);
  kiem('route chi UPDATE 1 cot, co try/catch, dung chuanHoa() cua traCuuHangCongKhai de so trung', /UPDATE TheKhoHangHoa SET MaBarcode = @b WHERE MaHangID = @id/.test(be) && /traCuu\.chuanHoa\(r\.MaBarcode\) === chuan/.test(be));
  kiem('index.html bump module.khohang.js >= 9.51', (() => { const x = /module\.khohang\.js\?v=([\d.]+)/.exec(html); return !!x && parseFloat(x[1]) >= 9.51; })());

  console.log(`\n=== KET QUA: ${dat} dat, ${sai} sai ===`);
  process.exit(sai ? 1 : 0);
}
