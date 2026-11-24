/* ================================================================================================
   kiem_nhom_khach_hang.js — bộ tự kiểm v9.77 (Nguyen 19/11/2026):
   "Thêm chức năng danh mục nhóm khách hàng, tự thêm khách hàng vào nhóm hoặc khi tạo danh mục khách hàng thì chọn nhóm.
    Dashboard kinh doanh thêm theo nhóm khách hàng."
     1. Biên dịch 4 file.
     2. routes/dashboard.js chạy THẬT (db giả): gắn nhóm theo TÊN, tên TRÙNG trong danh mục KHÔNG nhân dòng,
        tên ngoài danh mục ⇒ "Chưa gán nhóm", lọc theo nhóm, tổng hợp theo nhóm = cộng từ chính rows,
        chưa chạy migration ⇒ chạy như cũ + cảnh báo.
     3. routes/danhmuc.js chạy THẬT: route con /nhomkhachhang/:id/khachhang đứng TRƯỚC router.use; gán hàng loạt
        = gỡ cả nhóm rồi gán danh sách mới (một giao dịch); thiếu cột ⇒ 400 nói rõ migration.
     4. So chuỗi (sau cùng): migration_v903, cột tuyChon ở danh mục khách, tab + renderer + ô lọc, bump ?v=.
   Chạy: node backend\utils\kiem_nhom_khach_hang.js — KHÔNG dùng CSDL.
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
const boComment = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const canhGac = setTimeout(() => { console.log('\n  ❌ BO KIEM TREO qua 20 s'); process.exit(1); }, 20000);

console.log('\n=== 1. BIEN DICH ===');
['backend/routes/dashboard.js', 'backend/routes/danhmuc.js', 'frontend/js/module.dashboard.js', 'frontend/js/module.danhmuc.js'].forEach(f => {
  const s = doc(...f.split('/')); if (!s) { sai++; console.log('  ❌ ' + f + ' KHONG DOC DUOC'); return; }
  try { new vm.Script(s, { filename: f }); dat++; console.log('  ✓ ' + f); } catch (e) { sai++; console.log('  ❌ ' + f + ' VO CU PHAP: ' + e.message); }
});

(async () => {
  const gocLoad = Module._load;
  const sqlGia = new Proxy({}, {
    get(_, k) {
      if (k === 'Transaction') return function () { return { begin: async () => {}, commit: async () => { nhatKy.push({ q: 'COMMIT', inp: {} }); }, rollback: async () => { nhatKy.push({ q: 'ROLLBACK', inp: {} }); } }; };
      if (k === 'Request') return function () { return poolGia.request(); };
      const f = () => k; f.toString = () => String(k); return f;
    }
  });
  const nhatKy = [];
  let traLoi = () => [];
  const poolGia = { request: () => { const inp = {}; const rq = { input(k, t, v) { inp[k] = v; return rq; }, async query(q) { const s = String(q).replace(/\s+/g, ' '); nhatKy.push({ q: s, inp }); return { recordset: traLoi(s, inp), rowsAffected: [1] }; } }; return rq; } };

  /* ---------------- dữ liệu giả ----------------
     Khách trên phiếu: "Shop A" (nhóm 1), " Shop B " (nhóm 2 — tên có khoảng trắng), "Khách lẻ" (ngoài danh mục).
     Danh mục khách có HAI dòng "Shop A" (một dòng chưa gán nhóm) — bẫy nhân dòng. */
  const rowsPBH = [
    { TenKhach: 'Shop A', DoanhThu: 1000, DoanhThuGomVAT: 1080, SoPhieu: 2, TraLai: 0, TraLaiGomVAT: 0, DoanhThuThuan: 1000, DaThuKy: 500, ConNo: 580 },
    { TenKhach: 'Shop B', DoanhThu: 2000, DoanhThuGomVAT: 2160, SoPhieu: 3, TraLai: 100, TraLaiGomVAT: 108, DoanhThuThuan: 1900, DaThuKy: 0, ConNo: 2052 },
    { TenKhach: 'Khách lẻ', DoanhThu: 300, DoanhThuGomVAT: 324, SoPhieu: 1, TraLai: 0, TraLaiGomVAT: 0, DoanhThuThuan: 300, DaThuKy: 300, ConNo: 0 }
  ];
  let coCotNhom = true;
  const traLoiDash = (s) => {
    if (/COL_LENGTH\('KhachHang','NhomKhachHangID'\)/.test(s)) return [{ c: coCotNhom ? 4 : null }];
    if (/OBJECT_ID\('PhieuNhapLai'/.test(s) || /COL_LENGTH\('PhieuNhapLai'/.test(s)) return [{ c: 1 }];
    if (/FROM NhomKhachHang ORDER BY/.test(s)) return [{ NhomKhachHangID: 1, TenNhom: 'Nhà phân phối' }, { NhomKhachHangID: 2, TenNhom: 'Shop lẻ' }];
    if (/MIN\(NhomKhachHangID\) AS NhomID/.test(s)) return [{ Ten: 'Shop A', NhomID: 1 }, { Ten: 'Shop B', NhomID: 2 }];
    if (/WITH M AS/.test(s)) return [{ Nam: 2026, Thang: 11, DoanhThuThuan: 3200 }];
    if (/WITH ban AS|ban AS \(SELECT/.test(s)) return rowsPBH;
    return [];
  };

  console.log('\n=== 2. routes/dashboard.js chay that ===');
  const handlers = [];
  const routerGia = new Proxy({}, { get(_, m) { return (duong, ...mw) => { handlers.push({ m, duong, h: mw[mw.length - 1] }); }; } });
  Module._load = function (ten) {
    if (ten === 'express') { const ex = () => ({}); ex.Router = () => routerGia; return ex; }
    if (ten === '../db') return { sql: sqlGia, getPool: async () => poolGia };
    if (ten === '../middleware/auth') return new Proxy({}, { get: () => () => (req, res, next) => next() });
    return gocLoad.apply(this, arguments);
  };
  let okNap = true;
  try { require(path.join(GOC, 'backend', 'routes', 'dashboard.js')); } catch (e) { okNap = false; sai++; console.log('  ❌ khong nap duoc dashboard.js: ' + e.message); }
  Module._load = gocLoad;
  const tim = (m, d) => handlers.find(x => x.m === m && x.duong === d);
  const goi = async (h, query) => { let kq, ma = 200; const res = { json: (o) => { kq = o; }, status(c) { ma = c; return res; } }; await h.h({ session: { user: { userId: 1 } }, query: query || {}, params: {}, body: {} }, res); return { ma, kq }; };
  if (okNap && tim('get', '/kinhdoanh')) {
    traLoi = traLoiDash;
    let r = await goi(tim('get', '/kinhdoanh'), { tuNgay: '2026-11-01', denNgay: '2026-11-30' });
    const d = r.kq && r.kq.data;
    kiem('gan nhom theo TEN: Shop A -> Nhà phân phối, Shop B -> Shop lẻ, Khách lẻ -> Chưa gán nhóm (id 0)',
      d && d.rows.length === 3 && d.rows[0].TenNhom === 'Nhà phân phối' && d.rows[1].NhomID === 2 && d.rows[2].NhomID === 0 && d.rows[2].TenNhom === 'Chưa gán nhóm', d && d.rows);
    kiem('KHONG nhan dong du danh muc co hai dong trung ten (3 dong vao, 3 dong ra)', d && d.rows.length === rowsPBH.length);
    kiem('theoNhom = cong tu chinh rows: 3 nhom, DT thuan 1000 / 1900 / 300, sap giam dan; tong khop',
      d && d.theoNhom.length === 3 && d.theoNhom[0].DoanhThuThuan === 1900 && d.theoNhom.reduce((s, n) => s + n.DoanhThuThuan, 0) === d.tong.doanhThuThuan
      && d.theoNhom.find(n => n.NhomID === 1).SoKhach === 1 && d.theoNhom.find(n => n.NhomID === 0).ConNo === 0, d && d.theoNhom);
    kiem('tra ve danh sach nhom cho o loc (coNhom = true)', d && d.coNhom === true && d.nhom.length === 2);
    r = await goi(tim('get', '/kinhdoanh'), { nhom: '2' });
    kiem('loc nhom 2: chi con Shop B; TONG tinh lai theo dong da loc (DT thuan 1900, con no 2052)',
      r.kq.data.rows.length === 1 && r.kq.data.rows[0].TenKhach === 'Shop B' && r.kq.data.tong.doanhThuThuan === 1900 && r.kq.data.tong.conNo === 2052 && r.kq.data.tong.soKhach === 1, r.kq.data.tong);
    r = await goi(tim('get', '/kinhdoanh'), { nhom: '0' });
    kiem('loc "0" = CHUA GAN NHOM: chi con Khách lẻ', r.kq.data.rows.length === 1 && r.kq.data.rows[0].TenKhach === 'Khách lẻ');
    const nkTruoc = nhatKy.length; nhatKy.length = 0;
    r = await goi(tim('get', '/kinhdoanh'), { nhom: '1' });
    kiem('loc theo nhom thi bieu do 12 thang cung loc theo dung tap khach (IN @k0...)', nhatKy.some(x => /WITH M AS/.test(x.q) && /M\.Ten IN \(@k0\)/.test(x.q) && x.inp.k0 === 'Shop A'), nkTruoc);
    coCotNhom = false;
    r = await goi(tim('get', '/kinhdoanh'), {});
    kiem('chua chay migration_v903: van ra du 3 dong, tat ca "Chưa gán nhóm", canhBao noi ro',
      r.kq.data.rows.length === 3 && r.kq.data.rows.every(x => x.NhomID === 0) && /migration_v903/.test(r.kq.data.canhBao || ''), r.kq.data.canhBao);
    coCotNhom = true;
    r = await goi(tim('get', '/khach'), {});
    kiem('GET /khach kem nhom + danh sach nhom (cho o loc tren dashboard)', r.kq.success === true && Array.isArray(r.kq.nhom) && r.kq.nhom.length === 2);
  } else kiem('tim thay handler /kinhdoanh', !!tim('get', '/kinhdoanh'));

  console.log('\n=== 3. routes/danhmuc.js chay that — gan khach vao nhom ===');
  handlers.length = 0;
  Module._load = function (ten) {
    if (ten === 'express') { const ex = () => ({}); ex.Router = () => routerGia; return ex; }
    if (ten === '../db') return { sql: sqlGia, getPool: async () => poolGia };
    if (ten === '../middleware/auth') return new Proxy({}, { get: () => () => (req, res, next) => next() });
    if (ten === '../utils/crudFactory') return { buildCrudRouter: () => { handlers.push({ m: 'use', duong: '(crud)' }); return {}; } };
    return gocLoad.apply(this, arguments);
  };
  let okDM = true;
  try { require(path.join(GOC, 'backend', 'routes', 'danhmuc.js')); } catch (e) { okDM = false; sai++; console.log('  ❌ khong nap duoc danhmuc.js: ' + e.message); }
  Module._load = gocLoad;
  if (okDM) {
    const hGet = handlers.find(x => x.m === 'get' && x.duong === '/nhomkhachhang/:id/khachhang');
    const hPut = handlers.find(x => x.m === 'put' && x.duong === '/nhomkhachhang/:id/khachhang');
    kiem('co 2 route con cua nhom khach hang', !!hGet && !!hPut);
    const fDM = boComment(doc('backend', 'routes', 'danhmuc.js'));
    kiem("🔴 2 route con dung TRUOC router.use('/nhomkhachhang', ...) — khong thi bi router.use nuot",
      fDM.indexOf("router.get('/nhomkhachhang/:id/khachhang'") < fDM.indexOf("router.use('/nhomkhachhang'") && fDM.indexOf("router.put('/nhomkhachhang/:id/khachhang'") < fDM.indexOf("router.use('/nhomkhachhang'"));
    if (hPut) {
      const goiPut = async (id, body) => { let kq, ma = 200; const res = { json: (o) => { kq = o; }, status(c) { ma = c; return res; } }; await hPut.h({ session: { user: { userId: 1 } }, params: { id }, body, query: {} }, res); return { ma, kq }; };
      traLoi = (s) => (/COL_LENGTH\('KhachHang','NhomKhachHangID'\)/.test(s) ? [{ c: 4 }] : []);
      nhatKy.length = 0;
      let r = await goiPut('3', { khachHangIds: [10, 11, 11, 0, -5] });
      const iGo = nhatKy.findIndex(x => /UPDATE KhachHang SET NhomKhachHangID = NULL WHERE NhomKhachHangID = @id/.test(x.q));
      const iGan = nhatKy.findIndex(x => /UPDATE KhachHang SET NhomKhachHangID = @id WHERE KhachHangID IN \(10,11\)/.test(x.q));
      kiem('gan hang loat: GO ca nhom truoc roi GAN danh sach moi (loc trung + bo id <= 0), trong MOT giao dich, tra soKhach = 2',
        r.ma === 200 && r.kq.data.soKhach === 2 && iGo >= 0 && iGan > iGo && nhatKy.some(x => x.q === 'COMMIT'), nhatKy.map(x => x.q));
      nhatKy.length = 0;
      r = await goiPut('3', { khachHangIds: [] });
      kiem('gui danh sach RONG = go het khach khoi nhom (chi cau UPDATE ... NULL, khong co cau IN)',
        r.ma === 200 && nhatKy.some(x => /= NULL WHERE NhomKhachHangID/.test(x.q)) && !nhatKy.some(x => /KhachHangID IN/.test(x.q)));
      traLoi = () => [{ c: null }];
      r = await goiPut('3', { khachHangIds: [1] });
      kiem('chua chay migration_v903 -> 400 noi ro ten file, KHONG ghi gi', r.ma === 400 && /migration_v903/.test(r.kq.message));
      r = await goiPut('0', { khachHangIds: [1] });
      kiem('thieu nhom -> 400', r.ma === 400);
    }
  }

  console.log('\n=== 4. SO CHUOI (viet sau cung) ===');
  const mig = doc('database', 'migration_v903.sql');
  const fDM = doc('backend', 'routes', 'danhmuc.js'), fDash = boComment(doc('backend', 'routes', 'dashboard.js'));
  const feDM = doc('frontend', 'js', 'module.danhmuc.js'), feDash = doc('frontend', 'js', 'module.dashboard.js'), html = doc('frontend', 'index.html');
  kiem('migration_v903: bang NhomKhachHang + KhachHang.NhomKhachHangID + FK + ChucNang DANHMUC/nhomkhachhang, gac IF',
    ['CREATE TABLE NhomKhachHang', "COL_LENGTH('KhachHang', 'NhomKhachHangID')", 'FK_KhachHang_NhomKhachHang', "('DANHMUC', 'nhomkhachhang'"].every(k => mig.indexOf(k) > -1));
  kiem('danhmuc.js: cot NhomKhachHangID + PhanTramCKKyGui deu `tuyChon` (chua migration van luu duoc khach hang)',
    /name: 'NhomKhachHangID', sqlType: sql\.Int, tuyChon: true/.test(fDM) && /name: 'PhanTramCKKyGui', sqlType: sql\.Decimal\(5, 2\), tuyChon: true/.test(fDM));
  kiem('danhmuc.js: CRUD NhomKhachHang (TenNhom duyNhat + trim)', /table: 'NhomKhachHang', idCol: 'NhomKhachHangID'/.test(fDM) && /name: 'TenNhom', sqlType: sql\.NVarChar, required: true, trim: true, duyNhat: true/.test(fDM));
  kiem('dashboard.js: ban do ten -> nhom gom MOT dong/ten (MIN + GROUP BY), gan/loc/tong hop o JS — KHONG them JOIN vao cau cong no',
    /MIN\(NhomKhachHangID\) AS NhomID/.test(fDash) && /GROUP BY LTRIM\(RTRIM\(TenKhachHang\)\)/.test(fDash) && /const theoNhom = \[\.\.\.gomNhom\.values\(\)\]/.test(fDash) && !/JOIN NhomKhachHang/.test(fDash.slice(fDash.indexOf('WITH'), fDash.indexOf('ORDER BY DoanhThuThuan DESC'))));
  kiem('module.danhmuc.js: tab nhomkhachhang + renderer + nut gan khach + o chon nhom o form khach hang',
    /\{ key: 'nhomkhachhang', label: 'Nhóm khách hàng'/.test(feDM) && /async function renderNhomKhachHang\(/.test(feDM) && /async function moGanKhach\(/.test(feDM)
    && /name: 'NhomKhachHangID', label: 'Nhóm khách hàng'/.test(feDM) && /optionsApi: '\/api\/danhmuc\/nhomkhachhang'/.test(feDM));
  kiem('module.danhmuc.js: luu gan khach doc TAT CA o tich (khong chi dong dang hien sau khi go tim)', /\[\.\.\.modal\.querySelectorAll\('\.gk-ck'\)\]\.filter\(c => c\.checked\)/.test(feDM));
  kiem('module.dashboard.js: o loc nhom (+ "Chưa gán nhóm"), gui nhom=, bang theo nhom, cot Nhom + colspan tfoot 4',
    /id="dbNhom"/.test(feDash) && /p\.set\('nhom', nhomChon\)/.test(feDash) && /function bangNhom\(\)/.test(feDash) && /\$\{bangNhom\(\)\}/.test(feDash)
    && /<th style="width:150px;">Nhóm<\/th>/.test(feDash) && /<td colspan="4">TỔNG CỘNG<\/td>/.test(feDash) && /— Chưa gán nhóm —/.test(feDash));
  kiem('v9.78 module.dashboard.js: HAI vong tron theo NHOM hien luon (khong phai chon), bieuDoTron nhan donVi + khong gop duoi khi la nhom',
    /bieuDoTron\(soLieu\.theoNhom \|\| \[\], 'DoanhThuThuan', 'Tỷ lệ doanh thu thuần theo NHÓM khách', 'nhóm'\)/.test(feDash)
    && /bieuDoTron\(soLieu\.theoNhom \|\| \[\], 'ConNo', 'Tỷ lệ công nợ theo NHÓM khách', 'nhóm'\)/.test(feDash)
    && /function bieuDoTron\(rows, cot, tieuDe, dv\)/.test(feDash) && /if \(!laNhom && !dangChonKhach && duong\.length > TOI_DA\)/.test(feDash)
    && /\$\{mieng\.length\} \$\{donVi\}/.test(feDash));
  /* v9.83 (Nguyen 19/11): "mỗi khách chỉ gán vào 1 nhóm; gán rồi thì ở nhóm khác KHÔNG hiện ra nữa;
     click vào nhóm hiện list khách thuộc nhóm đó". Một khách một nhóm vốn đã đúng do cột đơn
     KhachHang.NhomKhachHangID — phần mới là LỌC ở màn thêm + màn XEM riêng. */
  kiem('v9.83: man THEM khach loai hang khach dang thuoc nhom KHAC (chi giu TrongNhom=1 hoac chua gan)',
    /tatCa\.filter\(k => Number\(k\.TrongNhom\) === 1 \|\| k\.NhomKhachHangID == null\)/.test(feDM)
    && /const soNhomKhac = tatCa\.length - ds\.length;/.test(feDM));
  kiem('v9.83: bam TEN NHOM mo man XEM khach thuoc nhom (chi doc + go tung nguoi), tach khoi man them',
    /async function moXemKhachNhom\(nhom, perm\)/.test(feDM) && /class="act-xem-kh"/.test(feDM)
    && /\.filter\(k => Number\(k\.TrongNhom\) === 1\)/.test(feDM) && /Thêm khách vào nhóm/.test(feDM));
  kiem('v9.83: go mot khach = gui lai DANH SACH DAY DU tru nguoi do (route gan hang loat, khong co route go le)',
    /const conLai = ds\.map\(x => Number\(x\.KhachHangID\)\)\.filter\(id => String\(id\) !== String\(tr\.dataset\.id\)\)/.test(feDM)
    && /apiPut\(`\/api\/danhmuc\/nhomkhachhang\/\$\{nhom\.NhomKhachHangID\}\/khachhang`, \{ khachHangIds: conLai \}\)/.test(feDM)
    && /render\(container, currentUser\)/.test(feDM));
  /* v9.87 (Nguyen 19–20/11): Dashboard LỌC khách theo dõi / nhóm nhưng thẻ "CÒN NỢ (lũy kế)" không
     nói ra ⇒ đối chiếu với Báo cáo KD lệch 416.320.577, mất hai vòng mới tìm ra (142/174 khách).
     Khoá: backend phải trả soKhachTatCa + cờ đang lọc; màn hình phải BÁO khi đang lọc. */
  kiem('v9.87: dashboard.js dem TONG so khach TRUOC moi bo loc + tra co dangLocKhach/dangLocNhom',
    /soKhachTatCa: Number\(tongKhach\) \|\| rows\.length/.test(fDash)
    && /dangLocKhach: dsKhach\.length/.test(fDash) && /dangLocNhom: !!\(req\.query\.nhom \|\| ''\)\.trim\(\)/.test(fDash)
    && /const tongKhach = \(await pool\.request\(\)\.query\(/.test(fDash));
  kiem('v9.87: man hinh BAO khi dang loc (bang canh bao + nut bo loc + the doi phu de)',
    /Đang LỌC — mọi số dưới đây chỉ của phần đang xem/.test(feDash) && /id="dbBoLoc"/.test(feDash)
    && /const dangLoc = Number\(t\.dangLocKhach\) > 0 \|\| t\.dangLocNhom;/.test(feDash)
    && /CHỈ của phần đang lọc — không phải toàn bộ/.test(feDash)
    && /await luuKhachTheoDoi\(\[\]\)/.test(feDash));
  const v = (f) => { const mm = new RegExp('/js/' + f + '\\.js\\?v=([0-9.]+)').exec(html); return mm ? parseFloat(mm[1]) : 0; };
  kiem('index.html: module.danhmuc >= 9.83, module.dashboard >= 9.87', v('module\\.danhmuc') >= 9.83 && v('module\\.dashboard') >= 9.87);
  kiem('TRIEN_KHAI co muc v9.77', /v9\.77/.test(doc('docs', 'TRIEN_KHAI_v936_v940.md')));

  clearTimeout(canhGac);
  console.log(`\n=== KET QUA: ${dat} dat, ${sai} sai ===`);
  process.exit(sai ? 1 : 0);
})().catch(e => { console.log('\n  ❌ BO KIEM VO: ' + (e && e.stack || e)); clearTimeout(canhGac); process.exit(1); });
