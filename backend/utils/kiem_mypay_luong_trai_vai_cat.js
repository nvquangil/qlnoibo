/* ================================================================================================
   kiem_mypay_luong_trai_vai_cat.js — bo tu kiem cho v9.60 (Nguyen 14/11/2026):
     (1) "Bảng lương của tôi, nhân viên bộ phận cắt thể hiện bảng lương cắt trải vải. Chỉ thể hiện
          bảng lương của nhân viên được gắn vào."
     (2) "Lương khoán may chỉ những người thuộc bộ phận may mới hiện ra"

   Chay:  node backend\utils\kiem_mypay_luong_trai_vai_cat.js
   KHONG copy sang D:\QLSX. KHONG dung toi CSDL: require THAT routes/payroll.js voi '../db' va
   '../middleware/auth' thay bang ban gia (Module._load), goi thang handler cua route. Hanh vi truoc,
   so chuoi sau.
   ================================================================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Module = require('module');

const GOC = path.join(__dirname, '..', '..');
const doc = (...p) => fs.existsSync(path.join(GOC, ...p)) ? fs.readFileSync(path.join(GOC, ...p), 'utf8').replace(/\r\n/g, '\n') : '';
let sai = 0, dat = 0;
function kiem(ten, dung, td) {
  if (dung) { dat++; console.log('  ✓ ' + ten); }
  else { sai++; console.log('  ❌ ' + ten + (td ? ' — ' + (typeof td === 'string' ? td : JSON.stringify(td)) : '')); }
}
const boComment = (s) => s.replace(/image\/\*/g, 'image_ALL').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const canhGac = setTimeout(() => { console.log('\n  ❌ BO KIEM TREO qua 20 s'); process.exit(1); }, 20000);

const fPR = doc('backend', 'routes', 'payroll.js');
const fFE = doc('frontend', 'js', 'module.payroll.js');
const fMy = doc('frontend', 'js', 'module.mypay.js');
const html = doc('frontend', 'index.html');

console.log('\n=== 1. BIEN DICH (vm.Script) ===');
[['backend/routes/payroll.js', fPR], ['frontend/js/module.payroll.js', fFE], ['frontend/js/module.mypay.js', fMy]].forEach(([f, s]) => {
  if (!s) { sai++; console.log('  ❌ ' + f + ' KHONG DOC DUOC'); return; }
  try { new vm.Script(s, { filename: f }); dat++; console.log('  ✓ ' + f); }
  catch (e) { sai++; console.log('  ❌ ' + f + ' VO CU PHAP: ' + e.message); }
});

/* ---------------------------------------------------------------------------------------------
   DB GIA: 3 nhan vien bo phan Cat (61: 10 gio hs 1 · 62: 30 gio hs 1,5 · 63: 0 gio), 3 so do.
   Quy = 4000 + 6000 + 10000 = 20000; tong gio = 40 => luong 1 gio = 500.
   61: cat s1, trai vai s2 => ban cua 61 = s1 + s2 (lenh 1), KHONG co s3 (lenh 2). Luong 61 = 10 x 1 x 500 = 5000.
   --------------------------------------------------------------------------------------------- */
const GIA = { nvId: 61, boPhan: 'Cắt', nemCauHinh: false };
const EMPS = () => [
  { NhanVienID: 61, MaNhanVien: 'NV61', HoTen: 'An Thu Thủy', TenBoPhan: 'Cắt', TongGioLam: 10, TongCong: 1.25, SoNgay: 2, HeSoLuong: 1 },
  { NhanVienID: 62, MaNhanVien: 'NV62', HoTen: 'Bùi Văn B', TenBoPhan: 'Cắt', TongGioLam: 30, TongCong: 3.75, SoNgay: 4, HeSoLuong: 1.5 },
  { NhanVienID: 63, MaNhanVien: 'NV63', HoTen: 'Cao Thị C', TenBoPhan: 'Cắt', TongGioLam: 0, TongCong: 0, SoNgay: 0, HeSoLuong: 1 }
];
const SODO = () => [
  { TienDoID: 1, NgayGhiNhan: '2026-10-03', SttSoCat: 1, SoDoID: 11, NgayQC: null, DonHangID: 1, MaDH: 'DH2610001', TenSanPham: 'Áo A', MaSanPham: 'A1', MetSoDoDai: 2, KhoVaiSoDo: 1, MaRap: '', TongLop: 2000, ThanhTien: 4000, NhanVienCat: 'An Thu Thủy', NhanVienTraiVai: 'Cao Thị C', NhanVienCatID: 61, NhanVienTraiVaiIDs: '63' },
  { TienDoID: 2, NgayGhiNhan: '2026-10-05', SttSoCat: 2, SoDoID: 12, NgayQC: null, DonHangID: 1, MaDH: 'DH2610001', TenSanPham: 'Áo A', MaSanPham: 'A1', MetSoDoDai: 3, KhoVaiSoDo: 1, MaRap: '', TongLop: 2000, ThanhTien: 6000, NhanVienCat: 'Bùi Văn B', NhanVienTraiVai: 'An Thu Thủy, Cao Thị C', NhanVienCatID: 62, NhanVienTraiVaiIDs: '61,63' },
  { TienDoID: 3, NgayGhiNhan: '2026-10-09', SttSoCat: 1, SoDoID: 21, NgayQC: null, DonHangID: 2, MaDH: 'DH2610002', TenSanPham: 'Quần B', MaSanPham: 'B1', MetSoDoDai: 5, KhoVaiSoDo: 1, MaRap: 'R-02', TongLop: 2000, ThanhTien: 10000, NhanVienCat: 'Bùi Văn B', NhanVienTraiVai: 'Cao Thị C', NhanVienCatID: 62, NhanVienTraiVaiIDs: '63' }
];
const nhatKy = [];
function taoRequest() {
  const inputs = {};
  const r = {
    input(ten, kieu, gt) { inputs[ten] = arguments.length === 2 ? kieu : gt; return r; },
    async query(q) {
      const s = q.replace(/\s+/g, ' ');
      nhatKy.push({ q: s, inputs: Object.assign({}, inputs) });
      const rs = (recordset) => ({ recordset, rowsAffected: [recordset.length] });
      if (/SELECT NhanVienID FROM Users WHERE UserID=@uid/.test(s)) return rs([{ NhanVienID: GIA.nvId }]);
      if (/WHERE bp\.TenBoPhan = N'Cắt'/.test(s)) return rs(EMPS());
      if (/FROM CauHinh WHERE Khoa=@k/.test(s)) { if (GIA.nemCauHinh) throw new Error('CauHinh hong (gia)'); return rs(inputs.k === 'LUONG_CAT' ? [{ GiaTri: JSON.stringify({ donGia: 1000 }) }] : []); }
      if (/WHERE c\.MaCongDoan = 'CAT'/.test(s)) return rs(SODO());
      if (/FROM DonHangChiTietSoDo UNION ALL SELECT DonHangID, MaRap FROM TienDoSanXuat/.test(s)) return rs([{ DonHangID: 1, MaRap: 'R-01' }]);
      if (/SELECT bp\.TenBoPhan FROM NhanVien nv LEFT JOIN BoPhan bp/.test(s)) return rs([{ TenBoPhan: GIA.boPhan }]);
      if (/FROM PhanCongMay pc/.test(s)) return rs(GIA.khoanMay || []);
      return rs([]);
    }
  };
  return r;
}
const poolGia = { request: () => taoRequest() };
const sqlGia = new Proxy({}, { get(_, k) { const f = () => k; f.toString = () => String(k); return f; } });
const mw = () => (req, res, next) => next();
const THAY = {
  '../db': { sql: sqlGia, getPool: async () => poolGia },
  '../middleware/auth': { requireAuth: mw(), requirePermission: mw, requireChucNang: mw, requireChucNangAny: mw, canUpdateStage: mw, coQuyenChucNang: async () => true }
};
const gocLoad = Module._load;
Module._load = function (ten) {
  if (Object.prototype.hasOwnProperty.call(THAY, ten)) return THAY[ten];
  return gocLoad.apply(this, arguments);
};
const layHandler = (router, method, duong) => {
  const l = (router.stack || []).find(x => x.route && x.route.path === duong && x.route.methods[method]);
  return l && l.route.stack[l.route.stack.length - 1].handle;
};
const goi = async (h, req) => {
  const res = { code: 200, body: null, status(c) { res.code = c; return res; }, json(o) { res.body = o; return res; } };
  await h(Object.assign({ body: {}, query: { nam: '2026', thang: '10' }, params: {}, session: { user: { userId: 7 } } }, req), res, () => {});
  return { code: res.code, body: res.body };
};

(async () => {
  console.log('\n=== 2. HANH VI: GET /luongtraivaicat/cuatoi (routes/payroll.js THAT, db gia) ===');
  const router = require(path.join(GOC, 'backend', 'routes', 'payroll.js'));
  const hCat = layHandler(router, 'get', '/luongtraivaicat/cuatoi');
  const hMay = layHandler(router, 'get', '/luongmay/cuatoi');
  kiem('co route GET /luongtraivaicat/cuatoi va GET /luongmay/cuatoi', typeof hCat === 'function' && typeof hMay === 'function');
  const lop = (router.stack || []).find(x => x.route && x.route.path === '/luongtraivaicat/cuatoi');
  kiem('route cuatoi CHI requireAuth (1 middleware truoc handler) — khong gac PAYROLL/luongtraivaicat (nhan vien khong co tab do)', !!lop && lop.route.stack.length === 2);

  let r, d;
  nhatKy.length = 0; GIA.nvId = 61;
  r = await goi(hCat); d = r.body && r.body.data;
  kiem('NV61 (cat s1, trai vai s2): 200, linked + boPhanCat, nam/thang vong lai 2026/10, donGia 1000', r.code === 200 && d && d.linked === true && d.boPhanCat === true && d.nam === 2026 && d.thang === 10 && d.donGia === 1000, r.body);
  kiem('quy = 20000 (ca bo phan), tongGio = 40, luong 1 gio = 500 — so cua CA BO PHAN giu de phieu noi cach chia', d && d.quy === 20000 && d.tongGio === 40 && d.donGiaGio === 500, d && { quy: d.quy, tongGio: d.tongGio, donGiaGio: d.donGiaGio });
  kiem('nhanVien = MOT dong cua chinh 61 (khong phai mang ca bo phan): ThanhTien 5000 = 10 x 1 x 500, HeSoLuong 1', d && !Array.isArray(d.nhanVien) && d.nhanVien && d.nhanVien.NhanVienID === 61 && d.nhanVien.ThanhTien === 5000 && d.nhanVien.HeSoLuong === 1 && d.nhanVien.TongGioLam === 10, d && d.nhanVien);
  kiem('KHONG lo so cua nguoi khac: khong co TongGioLam 30 (62) trong body, khong gui tongLuong / chenhLech bo phan', d && JSON.stringify(d).indexOf('"TongGioLam":30') === -1 && d.tongLuong === undefined && d.chenhLech === undefined);
  kiem('soDo = chi ban 61 tham gia: s1 (cat) + s2 (trai vai), KHONG co s3 (lenh 2 — nguoi khac)', d && Array.isArray(d.soDo) && d.soDo.map(x => x.TienDoID).join() === '1,2', d && d.soDo && d.soDo.map(x => x.TienDoID));
  kiem('theoDon = chi lenh co ban 61 tham gia (lenh 1), SoSoDo = 2 (ca lenh), ThanhTien lenh 10000, ma rap R-01 tu Ky thuat (ganMaRapChoLenh)', d && Array.isArray(d.theoDon) && d.theoDon.length === 1 && d.theoDon[0].DonHangID === 1 && d.theoDon[0].SoSoDo === 2 && d.theoDon[0].ThanhTien === 10000 && d.theoDon[0].MaRap === 'R-01', d && d.theoDon);

  nhatKy.length = 0; GIA.nvId = 63;
  r = await goi(hCat); d = r.body && r.body.data;
  kiem('NV63 (0 gio, trai vai ca 3 ban): ThanhTien 0, soDo = 3 ban, theoDon = 2 lenh — khong NaN', d && d.nhanVien && d.nhanVien.NhanVienID === 63 && d.nhanVien.ThanhTien === 0 && d.soDo.length === 3 && d.theoDon.length === 2, d && d.nhanVien);

  nhatKy.length = 0; GIA.nvId = 62;
  r = await goi(hCat); d = r.body && r.body.data;
  kiem('NV62: ThanhTien 22500 = 30 x 1,5 x 500; soDo = s2 + s3', d && d.nhanVien && d.nhanVien.ThanhTien === 22500 && d.soDo.map(x => x.TienDoID).join() === '2,3', d && d.nhanVien);

  nhatKy.length = 0; GIA.nvId = 99;
  r = await goi(hCat); d = r.body && r.body.data;
  kiem('NV99 khong thuoc bo phan Cat -> linked:true, boPhanCat:false, KHONG co soDo/nhanVien, va KHONG tai so cat (khong chay cau MaCongDoan = CAT)',
    r.code === 200 && d && d.linked === true && d.boPhanCat === false && d.soDo === undefined && d.nhanVien === undefined && !nhatKy.some(x => /MaCongDoan = 'CAT'/.test(x.q)), r.body);

  nhatKy.length = 0; GIA.nvId = null;
  r = await goi(hCat); d = r.body && r.body.data;
  kiem('tai khoan chua gan nhan vien -> linked:false, khong truy van gi them', d && d.linked === false && nhatKy.length === 1);

  nhatKy.length = 0; GIA.nvId = 61; GIA.nemCauHinh = true;
  r = await goi(hCat); d = r.body && r.body.data; GIA.nemCauHinh = false;
  kiem('CauHinh hong -> getCauHinhLuongCat lui ve don gia mac dinh 1100, route van 200', r.code === 200 && d && d.donGia === 1100);

  /* ---------------------------------------------------------------------------------------------
     3. GET /luongmay/cuatoi: + boPhan / boPhanMay
     --------------------------------------------------------------------------------------------- */
  console.log('\n=== 3. HANH VI: GET /luongmay/cuatoi tra boPhanMay ===');
  nhatKy.length = 0; GIA.nvId = 61; GIA.boPhan = 'Cắt'; GIA.khoanMay = [];
  r = await goi(hMay); d = r.body && r.body.data;
  kiem('nhan vien bo phan Cat -> linked, rows [], boPhan "Cắt", boPhanMay false', d && d.linked === true && Array.isArray(d.rows) && d.rows.length === 0 && d.boPhan === 'Cắt' && d.boPhanMay === false, d);
  GIA.boPhan = 'May';
  r = await goi(hMay); d = r.body && r.body.data;
  kiem('bo phan "May" -> boPhanMay true', d && d.boPhanMay === true);
  GIA.boPhan = ' may ';
  r = await goi(hMay); d = r.body && r.body.data;
  kiem('ten bo phan " may " (khoang trang / hoa thuong) -> van true', d && d.boPhanMay === true);
  GIA.boPhan = null;
  r = await goi(hMay); d = r.body && r.body.data;
  kiem('nhan vien chua co bo phan -> boPhan null, boPhanMay false, khong nem', d && d.boPhan === null && d.boPhanMay === false);
  GIA.nvId = null;
  r = await goi(hMay); d = r.body && r.body.data;
  kiem('chua gan nhan vien -> linked:false, rows [] (nhu cu)', d && d.linked === false && Array.isArray(d.rows));
  GIA.nvId = 61; GIA.boPhan = 'Cắt';

  /* ---------------------------------------------------------------------------------------------
     4. HAI BAN laBanCuaNV (backend payroll.js / frontend module.payroll.js) phai cung luat
     --------------------------------------------------------------------------------------------- */
  console.log('\n=== 4. laBanCuaNV: backend va man hinh cung luat loc theo ID ===');
  const iB = fPR.indexOf('function laBanCuaNV(s, nvId) {'), jB = fPR.indexOf("\nrouter.get('/luongtraivaicat/cuatoi'", iB);
  // jF: cat toi dau ham ke tiep (khoi comment o giua chi la comment, new Function nuot duoc) — khong neo vao cau co dau.
  const iF = fFE.indexOf('  function laBanCuaNV(s, nvId) {'), jF = fFE.indexOf('\n  function buildLuongCatQuyBody(d, nv) {', iF);
  kiem('cat duoc ca hai ban', iB > -1 && jB > iB && iF > -1 && jF > iF, { iB, jB, iF, jF });
  if (iB > -1 && jB > iB && iF > -1 && jF > iF) {
    const laBE = new Function(fPR.slice(iB, jB) + '\nreturn laBanCuaNV;')();
    const laFE = new Function(fFE.slice(iF, jF) + '\nreturn laBanCuaNV;')();
    const cases = [
      [{ NhanVienCatID: 61, NhanVienTraiVaiIDs: '63' }, 61, true], [{ NhanVienCatID: 62, NhanVienTraiVaiIDs: '61,63' }, 61, true],
      [{ NhanVienCatID: 62, NhanVienTraiVaiIDs: '63' }, 61, false], [{ NhanVienCatID: 62, NhanVienTraiVaiIDs: '161' }, 61, false],
      [{ NhanVienCatID: null, NhanVienTraiVaiIDs: ' 61 , 7' }, '61', true], [{ NhanVienCatID: 6, NhanVienTraiVaiIDs: null }, 61, false]
    ];
    kiem('6 truong hop co ID: hai ban tra cung ket qua (cat / trai vai / khong tham gia / 161 khong phai 61 / khoang trang)', cases.every(([s, id, kq]) => laBE(s, id) === kq && laFE(s, id) === kq));
    kiem('ID trong: backend tra FALSE (khong tra gi), man hinh tra TRUE (= khong loc) — khac nhau CO CHU DICH', laBE({ NhanVienCatID: 61 }, null) === false && laFE({ NhanVienCatID: 61 }, null) === true);
  }

  /* ---------------------------------------------------------------------------------------------
     5. buildLuongCatNVBody (module.payroll.js) chay voi du lieu route cuatoi tra ve
     --------------------------------------------------------------------------------------------- */
  console.log('\n=== 5. HANH VI: buildLuongCatNVBody(nv, d) voi d cua route cuatoi — ky in theo d.thang/d.nam ===');
  const iK = fFE.indexOf('  const kyCua = (d) =>'), jK = fFE.indexOf('\n  function openLuongCatNVDetail(nvid, d) {', iK);
  const iN = fFE.indexOf('  function khoangNgayCat(o) {'), jN = fFE.indexOf('\n  function openCauHinhLuongCat(d) {', iN);
  kiem('cat duoc khoi kyCua..buildLuongCatNVBody va khoangNgayCat', iK > -1 && jK > iK && iN > -1 && jN > iN, { iK, jK, iN, jN });
  if (iK > -1 && jK > iK && iN > -1 && jN > iN) {
    const money = (v) => (v == null || v === '' ? '0' : String(Number(v)));
    const num = (v) => Number(v) || 0;
    const escapeHtml = (s) => String(s == null ? '' : s);
    const fmtDate = (v) => (v ? String(v).slice(0, 10) : '');
    const bo = new Function('money', 'num', 'selThang', 'selNam', 'escapeHtml', 'fmtDate',
      fFE.slice(iK, jK) + '\n' + fFE.slice(iN, jN) + '\nreturn { kyCua, buildLuongCatQuyBody, buildLuongCatNVBody };')(money, num, 11, 2026, escapeHtml, fmtDate);
    nhatKy.length = 0; GIA.nvId = 61;
    r = await goi(hCat); d = r.body.data;
    const h = bo.buildLuongCatNVBody(d.nhanVien, d);
    kiem('tieu de in "Tháng 10/2026" theo DU LIEU (d.thang/d.nam), KHONG phai 11/2026 cua tab ke toan', h.indexOf('PHIẾU LƯƠNG TRẢI VẢI CẮT — Tháng 10/2026') > -1 && h.indexOf('THAM GIA — Tháng 10/2026') > -1 && h.indexOf('11/2026') === -1);
    kiem('phieu: LUONG KHOAN THANG 5000 = 10 giờ × 1 × 500; quy 20000; tong gio bo phan 40', /LƯƠNG KHOÁN THÁNG<\/b><\/td><td style="font-weight:700;">5000 /.test(h) && /10 giờ × 1 × 500/.test(h) && h.indexOf('>20000<') > -1 && h.indexOf('>40 giờ<') > -1);
    kiem('ban cat: chi lenh DH2610001 "2/2 sơ đồ (tham gia / cả lệnh)" · rập R-01; KHONG co DH2610002', h.indexOf('Lệnh SX DH2610001 · rập R-01 — Áo A · 2/2 sơ đồ (tham gia / cả lệnh)') > -1 && h.indexOf('DH2610002') === -1);
    kiem('dong tong "TỔNG BÀN CÓ THAM GIA: 2 sơ đồ / 1 lệnh SX" = 10000 (tien cac ban, KHONG phai luong)', h.indexOf('TỔNG BÀN CÓ THAM GIA: 2 sơ đồ / 1 lệnh SX') > -1 && /<td style="text-align:right;">10000<\/td><\/tr>\s*<\/tbody>/.test(h));
    kiem('co cau "Lương khoán tháng KHÔNG bằng tổng tiền các bàn" (ke khong cong cot roi hoi)', /Lương khoán tháng <b>KHÔNG<\/b> bằng tổng tiền các bàn/.test(h));
    kiem('kyCua: thieu d -> ky dang chon 11/2026; d co thang/nam -> theo d', bo.kyCua(null) === '11/2026' && bo.kyCua({}) === '11/2026' && bo.kyCua({ thang: 3, nam: 2025 }) === '3/2025');
  }

  /* ---------------------------------------------------------------------------------------------
     6. module.mypay.js: ve muc cat / an muc khoan may (so chuoi tren ban da bo comment)
     --------------------------------------------------------------------------------------------- */
  console.log('\n=== 6. module.mypay.js + index.html ===');
  const my = boComment(fMy), fe = boComment(fFE);
  kiem('mypay goi /api/payroll/luongtraivaicat/cuatoi trong try/catch RIENG (loi khong lam mat luong cong nhat / khoan may)', /try \{ cat = \(await apiGet\(`\/api\/payroll\/luongtraivaicat\/cuatoi\?nam=\$\{selNam\}&thang=\$\{selThang\}`\)\)\.data; \}\s*catch \(e\) \{ cat = \{ loi: e\.message \}; \}/.test(my));
  kiem('phanLuongCat: khong thuoc bo phan Cat / chua gan -> "" (khong ve muc trong); loi -> noi ly do; dung ModulePayroll.buildLuongCatNVBody', /function phanLuongCat\(cat\) \{/.test(my)
    && /if \(!cat \|\| cat\.linked === false \|\| cat\.boPhanCat === false\) return '';/.test(my) && /Không tải được lương trải vải cắt: \$\{escapeHtml\(cat\.loi\)\}/.test(my)
    && /PR\.buildLuongCatNVBody\(cat\.nhanVien, cat\)/.test(my) && /\$\{phanLuongCat\(cat\)\}`;/.test(my));
  kiem('muc Luong khoan may chi ve khi hienMay = boPhanMay (may chu cu: undefined -> van hien) HOAC co dong that', /const hienMay = may\.boPhanMay === undefined \|\| !!may\.boPhanMay \|\| \(may\.rows \|\| \[\]\)\.length > 0;/.test(my)
    && /\$\{hienMay \? `<h3 style="margin-top:18px;">Lương khoán may — Tháng/.test(my) && /Không có lương khoán may tháng này\.<\/div>`\}` : ''\}/.test(my));
  kiem('module.payroll.js xuat buildLuongCatNVBody; hai tieu de phieu dung kyCua(d)', /return \{ render, getTabs, buildLuongCatNVBody \};/.test(fe) && (fe.match(/Tháng \$\{kyCua\(d\)\}<\/h2>/g) || []).length === 2);
  kiem('route /luongmay/cuatoi: doc TenBoPhan qua NhanVien JOIN BoPhan, tra boPhan + boPhanMay (laBoPhanMay: trim + thuong)', /const laBoPhanMay = \(ten\) => String\(ten \|\| ''\)\.trim\(\)\.toLowerCase\(\) === 'may';/.test(fPR)
    && /data: \{ linked: true, rows, boPhan: bp\.TenBoPhan \|\| null, boPhanMay: laBoPhanMay\(bp\.TenBoPhan\) \}/.test(fPR));
  const v = (f) => { const x = new RegExp(f.replace(/\./g, '\\.') + '\\?v=([\\d.]+)').exec(html); return x ? parseFloat(x[1]) : 0; };
  kiem('index.html bump module.payroll.js / module.mypay.js >= 9.60', v('module.payroll.js') >= 9.6 && v('module.mypay.js') >= 9.6, { payroll: v('module.payroll.js'), mypay: v('module.mypay.js') });

  Module._load = gocLoad;
  clearTimeout(canhGac);
  console.log(`\n=== KET QUA: ${dat} dat, ${sai} sai ===`);
  process.exit(sai ? 1 : 0);
})().catch(e => { console.error('VO: ' + (e && e.stack || e)); process.exit(1); });
