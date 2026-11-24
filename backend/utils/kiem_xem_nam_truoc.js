/* ================================================================================================
   kiem_xem_nam_truoc.js — bo tu kiem v9.65 (Nguyen 16/11/2026): "cac ky xem bao cao, cong no chua co xem nam truoc".
     1. Bien dich.
     2. routes/congno.js THAT (db/auth gia): /congnokh, /congnoncc, /congnogiacong nhan ?denNgay -> moi cau SQL co
        "<= @den" tren DUNG cot ngay cua tung nguon; khong truyen -> khong co @den; ngay sai dinh dang -> bo qua;
        gia cong loc dong theo Ngay (JS). /export?loai=kh&denNgay cung truyen xuong.
     3. Giao dien: Bao cao (Quy truoc / Nam truoc + phep tinh ngay), Dashboard (Thang truoc / Nam truoc), Hoa don
        (Nam nay / Nam truoc), Cong no (khoi "Tinh den ngay" o 3 bang tong hop, nhan "(nam truoc)" trong select),
        index.html ?v>=9.65.
   Chay: node backend\utils\kiem_xem_nam_truoc.js — KHONG dung CSDL.
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
['backend/routes/congno.js', 'frontend/js/module.congno.js', 'frontend/js/module.baocao.js', 'frontend/js/module.dashboard.js', 'frontend/js/module.hoadon.js'].forEach(f => {
  const s = doc(...f.split('/')); if (!s) { sai++; console.log('  ❌ ' + f + ' KHONG DOC DUOC'); return; }
  try { new vm.Script(s, { filename: f }); dat++; console.log('  ✓ ' + f); } catch (e) { sai++; console.log('  ❌ ' + f + ' VO CU PHAP: ' + e.message); }
});

/* ---------------------------------------------------------------- db + auth gia */
const sqlGia = new Proxy({}, { get(_, k) { const f = () => k; f.toString = () => String(k); return f; } });
const nhatKySql = [];
let traLoi = () => ({ recordset: [], rowsAffected: [0] });
const poolGia = { request: () => { const inputs = {}; const r = { input(t, k, v) { inputs[t] = arguments.length === 2 ? k : v; return r; }, async query(q) { const s = q.replace(/\s+/g, ' ').trim(); nhatKySql.push({ q: s, inputs: Object.assign({}, inputs) }); return traLoi(s, inputs); } }; return r; } };
const THAY = {
  '../db': { sql: sqlGia, getPool: async () => poolGia },
  '../middleware/auth': { requireAuth: (q, s, n) => n(), requirePermission: () => (q, s, n) => n(), requireChucNang: () => (q, s, n) => n(), requireChucNangAny: () => (q, s, n) => n(), canUpdateStage: () => (q, s, n) => n(), coQuyenChucNang: () => true },
  /* gia cong / in theu: tra dong co Ngay (DATE -> Date object nhu mssql) de kiem loc theo moc */
  '../utils/luongGiaCongInThe': {
    loadGiaCong: async () => [{ NhaGiaCongID: 1, TenNha: 'Nhà A', Ngay: new Date(2025, 11, 20), SoLuongNhan: 10, ThanhTien: 100000 }, { NhaGiaCongID: 1, TenNha: 'Nhà A', Ngay: new Date(2026, 0, 5), SoLuongNhan: 5, ThanhTien: 50000 }],
    loadInThe: async () => [{ NhaGiaCongID: 1, TenNha: 'Nhà A', Ngay: new Date(2026, 1, 1), SoLuongNhan: 2, ThanhTien: 20000 }]
  }
};
const gocLoad = Module._load;
Module._load = function (ten) { if (Object.prototype.hasOwnProperty.call(THAY, ten)) return THAY[ten]; return gocLoad.apply(this, arguments); };
const rs = (a) => ({ recordset: a, rowsAffected: [a.length] });
const layHandler = (router, method, p) => { const l = router.stack.find(x => x.route && x.route.path === p && x.route.methods[method]); return l && l.route.stack[l.route.stack.length - 1].handle; };
const goi = async (h, req) => { const res = { code: 200, body: null, status(c) { res.code = c; return res; }, json(o) { res.body = o; return res; }, setHeader() {}, end() {} }; await h(Object.assign({ body: {}, query: {}, params: {}, headers: {}, session: { user: { userId: 7, isAdmin: true } }, ip: '1.1.1.1' }, req), res, (e) => { res.loi = e; }); return res; };

(async () => {
  console.log('\n=== 2. routes/congno.js — bang tong hop theo ?denNgay ===');
  let rCN;
  try { rCN = require(path.join(GOC, 'backend', 'routes', 'congno.js')); } catch (e) { sai++; console.log('  ❌ require congno.js: ' + e.message); clearTimeout(canhGac); process.exit(1); }
  traLoi = (s) => {
    if (/COL_LENGTH\(/.test(s)) return rs([{ c: 1 }]);
    if (/OBJECT_ID\(/.test(s)) return rs([{ c: 1, o: 1 }]);
    if (/SELECT NCC_ID, TenNCC FROM NhaCungCap/.test(s)) return rs([{ NCC_ID: 1, TenNCC: 'NCC 1' }]);
    if (/SELECT NhaGiaCongID, TenNha FROM NhaGiaCong/.test(s)) return rs([{ NhaGiaCongID: 1, TenNha: 'Nhà A' }]);
    if (/FROM PhieuBanHang WHERE/.test(s)) return rs([{ Ten: 'Khách 1', PhaiThu: 1000, SoPhieu: 1, LanCuoi: '2025-12-31' }]);
    return rs([]);
  };
  // 2a. khach hang
  nhatKySql.length = 0;
  let r = await goi(layHandler(rCN, 'get', '/congnokh'), { query: { denNgay: '2025-12-31' } });
  kiem('/congnokh?denNgay=2025-12-31 -> 200, tra denNgay', r.code === 200 && r.body.success && r.body.denNgay === '2025-12-31', r.loi && r.loi.message);
  const qKH = nhatKySql.map(x => x.q);
  kiem('KH: 4 nguon deu loc <= @den dung cot: PhieuBanHang.NgayBan, PhieuThu.NgayThu, CongNoDieuChinh.Ngay, PhieuNhapLai.NgayNhap',
    qKH.some(q => /FROM PhieuBanHang WHERE TrangThai <> N'Đã hủy' AND NgayBan <= @den/.test(q)) && qKH.some(q => /FROM PhieuThu WHERE LoaiDoiTuong = N'KhachHang' AND NgayThu <= @den/.test(q))
    && qKH.some(q => /FROM CongNoDieuChinh WHERE LoaiDoiTuong = N'KhachHang' AND Ngay <= @den/.test(q)) && qKH.some(q => /FROM PhieuNhapLai WHERE TrangThai <> N'Đã hủy' AND NgayNhap <= @den/.test(q)), qKH);
  kiem('KH: tham so @den = 2025-12-31 (sql.Date) o moi cau', nhatKySql.filter(x => /@den/.test(x.q)).every(x => x.inputs.den === '2025-12-31'));
  nhatKySql.length = 0;
  r = await goi(layHandler(rCN, 'get', '/congnokh'), { query: {} });
  kiem('/congnokh KHONG denNgay -> khong cau nao co @den (luy ke nhu truoc), denNgay null', r.code === 200 && r.body.denNgay === null && !nhatKySql.some(x => /@den/.test(x.q)));
  nhatKySql.length = 0;
  r = await goi(layHandler(rCN, 'get', '/congnokh'), { query: { denNgay: '31/12/2025' } });
  kiem('denNgay sai dinh dang (31/12/2025) -> bo qua, khong @den, khong loi', r.code === 200 && r.body.denNgay === null && !nhatKySql.some(x => /@den/.test(x.q)));
  // 2b. NCC
  nhatKySql.length = 0;
  r = await goi(layHandler(rCN, 'get', '/congnoncc'), { query: { denNgay: '2025-12-31' } });
  kiem('/congnoncc?denNgay -> 200', r.code === 200 && r.body.success && r.body.denNgay === '2025-12-31', r.loi && r.loi.message);
  const qN = nhatKySql.map(x => x.q);
  const canNCC = [/FROM PhieuNhapVai pn JOIN VaiCay vc .* AND pn\.NgayNhap <= @den/, /FROM PhieuPhuKien p JOIN PhieuPhuKienChiTiet ct .*LoaiPhieu = N'Nhập' AND p\.NCC_ID IS NOT NULL AND p\.Ngay <= @den/, /FROM PhieuChi WHERE NCC_ID IS NOT NULL AND LoaiDoiTuong = N'NhaCungCap' AND NgayChi <= @den/,
    /FROM PhieuThu WHERE NCC_ID IS NOT NULL AND LoaiDoiTuong = N'NhaCungCap' AND NgayThu <= @den/, /FROM CongNoDieuChinh WHERE LoaiDoiTuong = N'NhaCungCap' AND NCC_ID IS NOT NULL AND Ngay <= @den/, /FROM PhieuXuatVai px .*LaTraNCC = 1 AND px\.NCC_ID IS NOT NULL AND px\.NgayXuat <= @den/,
    /LoaiPhieu = N'Xuất' AND p\.LaTraNCC = 1 AND p\.NCC_ID IS NOT NULL AND p\.Ngay <= @den/, /FROM PhieuNhapKhoHang p WHERE .*TrangThai <> N'Đã hủy' AND p\.NgayNhap <= @den/];
  kiem('NCC: 8 nguon deu loc <= @den dung cot (NgayNhap, Ngay, NgayChi, NgayThu, Ngay, NgayXuat, Ngay, NgayNhap)', canNCC.every(re => qN.some(q => re.test(q))), canNCC.filter(re => !qN.some(q => re.test(q))).map(String));
  // 2c. gia cong: loc dong theo Ngay (JS) + SQL phieu chi / dieu chinh
  nhatKySql.length = 0;
  r = await goi(layHandler(rCN, 'get', '/congnogiacong'), { query: { denNgay: '2025-12-31' } });
  const gcRows = (r.body && r.body.data) || [];
  kiem('/congnogiacong?denNgay=2025-12-31: chi dong gia cong 20/12/2025 (100.000) duoc tinh; dong 05/01/2026 va in theu 01/02/2026 bi loai', r.code === 200 && gcRows.length === 1 && gcRows[0].TienGiaCong === 100000 && gcRows[0].TienInThe === 0 && gcRows[0].PhaiTra === 100000, gcRows);
  kiem('GC: phieu chi NgayChi <= @den, dieu chinh Ngay <= @den', nhatKySql.some(x => /FROM PhieuChi WHERE LoaiDoiTuong = N'NhaGiaCong' AND NhaGiaCongID IS NOT NULL AND NgayChi <= @den/.test(x.q)) && nhatKySql.some(x => /FROM CongNoDieuChinh WHERE LoaiDoiTuong = N'NhaGiaCong' AND NhaGiaCongID IS NOT NULL AND Ngay <= @den/.test(x.q)));
  r = await goi(layHandler(rCN, 'get', '/congnogiacong'), { query: {} });
  kiem('/congnogiacong khong moc: ca 3 dong tinh (170.000)', r.code === 200 && r.body.data.length === 1 && r.body.data[0].PhaiTra === 170000, r.body && r.body.data);
  const fCN = boComment(doc('backend', 'routes', 'congno.js'));
  kiem('congno.js /export: bang tong hop + so chi tiet (tat ca) cung nhan denNgay; tieu de ghi "Số dư tính đến ngày"', /congNoKhachHang\(pool, denNgay\)/.test(fCN) && /congNoNCC\(pool, denNgay\)/.test(fCN) && /congNoNhaGiaCong\(pool, denNgay\)/.test(fCN) && /soChiTietKH\(pool, k\.TenKhach, '', denNgay\)/.test(fCN) && /Số dư tính đến ngày/.test(fCN));

  console.log('\n=== 3. giao dien ===');
  const html = doc('frontend', 'index.html');
  const vCua = (f) => { const m = new RegExp(f.replace(/[.]/g, '\\.') + '\\?v=([\\d.]+)').exec(html); return m ? parseFloat(m[1]) : 0; };
  kiem('index.html: module.congno/baocao/dashboard/hoadon ?v>=9.65', ['/js/module.congno.js', '/js/module.baocao.js', '/js/module.dashboard.js', '/js/module.hoadon.js'].every(f => vCua(f) >= 9.65), ['/js/module.congno.js', '/js/module.baocao.js', '/js/module.dashboard.js', '/js/module.hoadon.js'].map(f => f + '=' + vCua(f)));
  const mBC = boComment(doc('frontend', 'js', 'module.baocao.js'));
  kiem('bao cao: nut Quý trước + Năm trước, phep tinh: quy truoc = (q-3, 1) -> (q, 0); nam truoc = 01/01 -> 31/12 y-1',
    /data-loai="quytruoc">Quý trước</.test(mBC) && /data-loai="namtruoc"[^>]*>Năm trước</.test(mBC) && /l === 'quytruoc'.*new Date\(h\.getFullYear\(\), q - 3, 1\).*new Date\(h\.getFullYear\(\), q, 0\)/.test(mBC) && /l === 'namtruoc'.*new Date\(h\.getFullYear\(\) - 1, 0, 1\).*new Date\(h\.getFullYear\(\) - 1, 11, 31\)/.test(mBC));
  // kiem phep tinh ngay bang ca that: lay DUNG 2 bieu thuc trong file ra chay
  (() => {
    const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const h = new Date(2026, 0, 15);   // 15/01/2026: quy truoc = Q4/2025, nam truoc = 2025
    const q = Math.floor(h.getMonth() / 3) * 3;
    const qt = { tuNgay: iso(new Date(h.getFullYear(), q - 3, 1)), denNgay: iso(new Date(h.getFullYear(), q, 0)) };
    const nt = { tuNgay: iso(new Date(h.getFullYear() - 1, 0, 1)), denNgay: iso(new Date(h.getFullYear() - 1, 11, 31)) };
    kiem('phep tinh (ca 15/01/2026): quy truoc = 2025-10-01 -> 2025-12-31 (lui nam dung), nam truoc = 2025-01-01 -> 2025-12-31', qt.tuNgay === '2025-10-01' && qt.denNgay === '2025-12-31' && nt.tuNgay === '2025-01-01' && nt.denNgay === '2025-12-31', { qt, nt });
    const h2 = new Date(2026, 4, 10), q2 = Math.floor(h2.getMonth() / 3) * 3;
    kiem('phep tinh (ca 10/05/2026): quy truoc = 2026-01-01 -> 2026-03-31', iso(new Date(h2.getFullYear(), q2 - 3, 1)) === '2026-01-01' && iso(new Date(h2.getFullYear(), q2, 0)) === '2026-03-31');
  })();
  const mDB = boComment(doc('frontend', 'js', 'module.dashboard.js'));
  kiem('dashboard: nut Tháng trước + Năm trước co handler', /id="dbKyThangTruoc">Tháng trước</.test(mDB) && /id="dbKyNamTruoc"[^>]*>Năm trước</.test(mDB) && /getElementById\('dbKyThangTruoc'\)\.onclick/.test(mDB) && /getElementById\('dbKyNamTruoc'\)\.onclick/.test(mDB) && /dat\(`\$\{y\}-01-01`, `\$\{y\}-12-31`\)/.test(mDB));
  const mHD = boComment(doc('frontend', 'js', 'module.hoadon.js'));
  kiem('hoa don: nut Năm nay + Năm trước, handler l === nam / namtruoc', /data-loai="nam"[^>]*>Năm nay</.test(mHD) && /data-loai="namtruoc"[^>]*>Năm trước</.test(mHD) && /l === 'nam'/.test(mHD) && /l === 'namtruoc'/.test(mHD));
  const mCN = boComment(doc('frontend', 'js', 'module.congno.js'));
  kiem('cong no: khoi "Tính đến ngày" (khoiDenNgayHtml + ganDenNgay) o 3 bang tong hop KH/NCC/GC, API ?denNgay, export &denNgay, so chi tiet cat den cung moc',
    /khoiDenNgayHtml\('kh', den\)/.test(mCN) && /khoiDenNgayHtml\('ncc', den\)/.test(mCN) && /khoiDenNgayHtml\('gc', den\)/.test(mCN) && (mCN.match(/ganDenNgay\(body, '(kh|ncc|gc)'/g) || []).length === 3
    && /\/api\/congno\/congnokh' \+ \(den \? '\?denNgay=' \+ den : ''\)/.test(mCN) && /\/api\/congno\/congnoncc' \+ \(den \? '\?denNgay=' \+ den : ''\)/.test(mCN) && /\/api\/congno\/congnogiacong' \+ \(den \? '\?denNgay=' \+ den : ''\)/.test(mCN)
    && (mCN.match(/&denNgay=' \+ den/g) || []).length >= 3 && /soChiTietKH\(a\.dataset\.khach, den \? \{ tu: '', den \} : undefined\)/.test(mCN));
  kiem('cong no: select ky nhanh ghi "(năm nay)" / "(năm trước)"', /\(năm nay\)/.test(mCN) && /\(năm trước\)/.test(mCN));
  kiem('cong no: ganKyNhanh voi tuId=null chi dien DEN ngay (lay den cua ky)', /ganKyNhanh\(body, pre \+ 'DenKyNhanh', null, pre \+ 'DenNgay', \(tu, den\) => apDung\(den\)\)/.test(mCN));

  Module._load = gocLoad;
  clearTimeout(canhGac);
  console.log(`\n=== KET QUA: ${dat} dat, ${sai} sai ===`);
  process.exit(sai ? 1 : 0);
})().catch(e => { console.error('VO: ' + (e && e.stack || e)); process.exit(1); });
