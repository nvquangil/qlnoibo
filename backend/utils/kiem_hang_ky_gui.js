/* ================================================================================================
   kiem_hang_ky_gui.js — bộ tự kiểm v9.75 (Nguyen 17/11/2026): HÀNG KÝ GỬI.
     1. Biên dịch 6 file.
     2. utils/kyGuiDangGiu chạy THẬT với pool giả: ConCai = gửi − báo bán − trả; kyGuiDangGiu quy về ĐƠN VỊ CHÍNH (bẫy Ri).
     3. routes/kygui.js chạy THẬT (db / auth / banhang giả): POST /baoban chặn vượt còn, gọi banhang.taoPhieuBanHang với
        kyGuiCTID + CK NPP = % ký gửi + CK shop 0; POST /tra chặn vượt còn; POST /phieu chặn thiếu màu / thiếu khả dụng.
     4. So chuỗi (sau cùng): banhang.js cộng ký gửi vào layHangDangGiu, ghi KyGuiCTID, chặn sửa phiếu báo bán, POST /phieu
        thường từ chối kyGuiCTID, export taoPhieuBanHang; server mount; khohang tab + ủy quyền; migration_v901; danhmuc; index.html.
   Chạy: node backend\utils\kiem_hang_ky_gui.js — KHÔNG dùng CSDL.
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
['backend/routes/kygui.js', 'backend/utils/kyGuiDangGiu.js', 'backend/routes/banhang.js', 'backend/routes/danhmuc.js', 'frontend/js/module.kygui.js', 'frontend/js/module.khohang.js'].forEach(f => {
  const s = doc(...f.split('/')); if (!s) { sai++; console.log('  ❌ ' + f + ' KHONG DOC DUOC'); return; }
  try { new vm.Script(s, { filename: f }); dat++; console.log('  ✓ ' + f); } catch (e) { sai++; console.log('  ❌ ' + f + ' VO CU PHAP: ' + e.message); }
});

(async () => {
  const Module = require('module');
  const gocLoad = Module._load;
  const sqlGia = new Proxy({}, { get(_, k) { if (k === 'Transaction') return function () { return { begin: async () => {}, commit: async () => {}, rollback: async () => {} }; }; if (k === 'Request') return function () { return poolGia.request(); }; const f = () => k; f.toString = () => String(k); return f; } });
  let traLoi = () => [];
  const nhatKy = [];
  const poolGia = { request: () => { const inp = {}; const rq = { input(k, t, v) { inp[k] = v; return rq; }, async query(q) { const s = String(q).replace(/\s+/g, ' '); nhatKy.push({ q: s, inp }); return { recordset: traLoi(s, inp), rowsAffected: [1] }; } }; return rq; } };

  /* ---------- dữ liệu giả: 2 dòng ký gửi của khách "Shop A"; mã M1 quản theo CÁI, mã M2 quản theo RI (1 Ri = 6 cái) ---------- */
  const dongKG = [
    { KyGuiCTID: 11, PhieuKGID: 1, SoPhieu: 'KG260001', Ngay: '2026-11-10', TenKhach: 'Shop A', KhachHangID: 7, PhanTramCK: 12, MaHangID: 1, MaHang: 'M1', TenHang: 'Áo', LoaiRi: 1, DonViCoBan: 'Cái', DonViQuyDoi: null, MauSacID: 3, TenMau: 'Đen', SoLuongCai: 10, GiaBanLe: 100000, DaBaoBanCai: 3, DaTraCai: 2 },
    { KyGuiCTID: 12, PhieuKGID: 1, SoPhieu: 'KG260001', Ngay: '2026-11-10', TenKhach: 'Shop A', KhachHangID: 7, PhanTramCK: 12, MaHangID: 2, MaHang: 'M2', TenHang: 'Quần', LoaiRi: 6, DonViCoBan: 'Ri', DonViQuyDoi: null, MauSacID: 4, TenMau: 'Xanh', SoLuongCai: 12, GiaBanLe: 50000, DaBaoBanCai: 0, DaTraCai: 0 }
  ];
  const traLoiMacDinh = (q, inp) => {
    if (/OBJECT_ID\('PhieuKyGuiChiTiet'\)/.test(q)) return [{ o: 1 }];
    if (/COL_LENGTH\('PhieuBanHangChiTiet','KyGuiCTID'\)/.test(q)) return [{ c: 4 }];
    if (/COL_LENGTH\('KhachHang','PhanTramCKKyGui'\)/.test(q)) return [{ c: 5 }];
    if (/FROM PhieuKyGuiChiTiet kc JOIN PhieuKyGui p/.test(q)) return dongKG.filter(r => (!inp.ten || r.TenKhach === inp.ten) && (!inp.pid || r.PhieuKGID === inp.pid)).map(r => Object.assign({}, r));
    if (/SELECT MaHangID, MaHang, GiaBan FROM TheKhoHangHoa/.test(q)) return [{ MaHangID: 1, MaHang: 'M1', GiaBan: 100000 }, { MaHangID: 2, MaHang: 'M2', GiaBan: 50000 }];
    if (/SELECT MaHangID, LoaiRi, DonViCoBan, DonViQuyDoi FROM TheKhoHangHoa/.test(q)) return [{ MaHangID: 1, LoaiRi: 1, DonViCoBan: 'Cái', DonViQuyDoi: null }, { MaHangID: 2, LoaiRi: 6, DonViCoBan: 'Ri', DonViQuyDoi: null }];
    if (/FROM vw_TonTheoMau WHERE MaHangID IN/.test(q)) return [{ MaHangID: 1, MauSacID: 3, TonCai: 20 }, { MaHangID: 2, MauSacID: 4, TonCai: 5 }];
    if (/SELECT SoPhieu AS S FROM PhieuKyGui /.test(q) || /FROM PhieuKyGuiTra WHERE/.test(q)) return [];
    if (/INSERT INTO PhieuKyGui /.test(q)) return [{ PhieuKGID: 9 }];
    if (/INSERT INTO PhieuKyGuiTra /.test(q)) return [{ PhieuKGTID: 5 }];
    return [];
  };
  traLoi = traLoiMacDinh;

  console.log('\n=== 2. utils/kyGuiDangGiu chay that ===');
  Module._load = function (ten) { if (ten === '../db') return { sql: sqlGia, getPool: async () => poolGia }; return gocLoad.apply(this, arguments); };
  let kg = null;
  try { kg = require(path.join(GOC, 'backend', 'utils', 'kyGuiDangGiu.js')); } catch (e) { sai++; console.log('  ❌ khong nap duoc kyGuiDangGiu: ' + e.message); }
  Module._load = gocLoad;
  if (kg) {
    const rows = await kg.dongKyGuiOKhach(poolGia, sqlGia, { tenKhach: 'Shop A', tatCa: true });
    kiem('ConCai = gui − bao ban − tra: M1 10−3−2 = 5; M2 12', rows.length === 2 && rows[0].ConCai === 5 && rows[1].ConCai === 12, rows.map(r => r.ConCai));
    kiem('SQL dung subquery tuong quan trong SELECT (khong trong SUM) + loc phieu chua huy ca 3 bang', /pb\.TrangThai <> N'Đã hủy'/.test(kg.SQL_DA_BAO_BAN('kc')) && /pt\.TrangThai <> N'Đã hủy'/.test(kg.SQL_DA_TRA('kc')) && !/SUM\(\s*\(SELECT/.test(kg.SQL_DA_BAO_BAN('kc')));
    const giu = await kg.kyGuiDangGiu(poolGia, sqlGia);
    kiem('kyGuiDangGiu quy ve DON VI CHINH: M1|3 = 5 (cai); M2|4 = 2 Ri (12 cai / 6) — bay Ri', giu.theoMau.get('1|3') === 5 && giu.theoMau.get('2|4') === 2 && giu.theoMaHang.get(2) === 2, [...giu.theoMau.entries()]);
    const chiCon = await kg.dongKyGuiOKhach(poolGia, sqlGia, { tenKhach: 'Shop A' });
    kiem('khong tatCa -> chi dong ConCai > 0', chiCon.length === 2);
  }

  console.log('\n=== 3. routes/kygui.js chay that ===');
  const handlers = [];
  const routerGia = new Proxy({}, { get(_, m) { return (duong, ...mw) => { handlers.push({ m, duong, h: mw[mw.length - 1] }); }; } });
  let goiBanHang = null, dangGiuGia = { theoMau: new Map([['1|3', 5], ['2|4', 2]]), theoMaHang: new Map() };
  Module._load = function (ten) {
    if (ten === 'express') { const ex = () => ({}); ex.Router = () => routerGia; return ex; }
    if (ten === '../db') return { sql: sqlGia, getPool: async () => poolGia };
    if (ten === '../middleware/auth') return new Proxy({}, { get: () => () => (req, res, next) => next() });
    if (ten === './banhang') return { layHangDangGiu: async () => dangGiuGia, taoPhieuBanHang: async (pool, user, body) => { goiBanHang = body; return { phieuBHID: 77, soPhieu: 'PX260077', tongThanhToan: 264000 }; } };
    return gocLoad.apply(this, arguments);
  };
  let okNap = true;
  try { require(path.join(GOC, 'backend', 'routes', 'kygui.js')); } catch (e) { okNap = false; sai++; console.log('  ❌ khong nap duoc kygui.js: ' + e.message); }
  Module._load = gocLoad;
  const tim = (m, d) => handlers.find(x => x.m === m && x.duong === d);
  const goi = async (h, body, query) => { let kq, ma = 200; const res = { json: (o) => { kq = o; }, status(c) { ma = c; return res; } }; await h.h({ session: { user: { userId: 5 } }, body: body || {}, query: query || {}, params: {} }, res); return { ma, kq }; };
  if (okNap) {
    kiem('du route: danhmuc, mau, okhach, phieu GET/POST/PUT/huy, baoban, tra GET/POST/huy', ['/danhmuc', '/mau', '/okhach', '/phieu', '/phieu/:id', '/baoban', '/tra', '/tra/:id'].every(d => handlers.some(x => x.duong === d)) && tim('put', '/phieu/:id/huy') && tim('put', '/tra/:id/huy'));
    /* báo bán */
    let r = await goi(tim('post', '/baoban'), { tenKhach: 'Shop A', khachHangId: 7, dong: [{ kyGuiCTID: 11, soCai: 6 }] });
    kiem('bao ban VUOT con (6 > 5) -> 400, khong goi banhang', r.ma === 400 && goiBanHang === null, r.kq);
    r = await goi(tim('post', '/baoban'), { tenKhach: 'Shop A', khachHangId: 7, ngayBan: '2026-11-30', dong: [{ kyGuiCTID: 11, soCai: 3 }, { kyGuiCTID: 99, soCai: 0 }] });
    kiem('bao ban 3 cai -> 200, phieu PX260077, cong no 264.000', r.ma === 200 && r.kq.data.soPhieu === 'PX260077' && r.kq.data.tongThanhToan === 264000, r.kq);
    kiem('body gui banhang: dong co kyGuiCTID 11, maHang/mau/gia cua dong ky gui, donVi Cai, CK shop 0; CK NPP = 12 (tu phieu ky gui); ghi chu "Báo bán hàng ký gửi"',
      goiBanHang && goiBanHang.dong.length === 1 && goiBanHang.dong[0].kyGuiCTID === 11 && goiBanHang.dong[0].maHangId === 1 && goiBanHang.dong[0].mauSacId === 3 && goiBanHang.dong[0].giaBanLe === 100000 && goiBanHang.dong[0].soLuong === 3 && goiBanHang.dong[0].donVi === 'Cái' && goiBanHang.dong[0].phanTramCKShop === 0
      && goiBanHang.phanTramCKNPP === 12 && goiBanHang.tenKhach === 'Shop A' && /Báo bán hàng ký gửi/.test(goiBanHang.ghiChu), goiBanHang);
    goiBanHang = null;
    r = await goi(tim('post', '/baoban'), { tenKhach: 'Shop A', phanTramCKNPP: 15, dong: [{ kyGuiCTID: 11, soCai: 1 }] });
    kiem('CK NPP go tay tren form thang % phieu ky gui (15)', r.ma === 200 && goiBanHang.phanTramCKNPP === 15);
    r = await goi(tim('post', '/baoban'), { tenKhach: 'Shop B', dong: [{ kyGuiCTID: 11, soCai: 1 }] });
    kiem('dong ky gui cua khach khac -> 400', r.ma === 400);
    r = await goi(tim('post', '/baoban'), { tenKhach: 'Shop A', dong: [{ kyGuiCTID: 11, soCai: 1.5 }] });
    kiem('so ban le (1.5) -> 400', r.ma === 400);
    /* trả về */
    nhatKy.length = 0;
    r = await goi(tim('post', '/tra'), { tenKhach: 'Shop A', dong: [{ kyGuiCTID: 12, soCai: 13 }] });
    kiem('tra VUOT con (13 > 12) -> 400', r.ma === 400);
    r = await goi(tim('post', '/tra'), { tenKhach: 'Shop A', ngay: '2026-11-30', dong: [{ kyGuiCTID: 12, soCai: 4 }] });
    kiem('tra 4 cai -> 200, INSERT PhieuKyGuiTra + 1 dong chi tiet, KHONG dong vao XuatCai / PhieuNhapLai', r.ma === 200 && nhatKy.some(x => /INSERT INTO PhieuKyGuiTra /.test(x.q)) && nhatKy.filter(x => /INSERT INTO PhieuKyGuiTraChiTiet/.test(x.q)).length === 1 && !nhatKy.some(x => /XuatCai|PhieuNhapLai/.test(x.q)), r.kq);
    /* xuất ký gửi */
    r = await goi(tim('post', '/phieu'), { tenKhach: 'Shop A', khachHangId: 7, dong: [{ maHangId: 1, soCai: 2 }] });
    kiem('xuat ky gui thieu MAU -> 400', r.ma === 400 && /MÀU/.test(r.kq.message));
    r = await goi(tim('post', '/phieu'), { tenKhach: 'Shop A', khachHangId: 7, dong: [{ maHangId: 1, mauSacId: 3, soCai: 16 }] });
    kiem('xuat ky gui VUOT kha dung (ton 20 − giu 5 = 15 < 16) -> 400', r.ma === 400 && /khả dụng/.test(r.kq.message), r.kq);
    r = await goi(tim('post', '/phieu'), { tenKhach: 'Shop A', khachHangId: 7, dong: [{ maHangId: 2, mauSacId: 4, soCai: 19 }] });
    kiem('ma quan theo RI: 19 cai = 3 Ri (lam tron) <= ton 5 − giu 2 = 3 -> 200 (bay Ri: so theo don vi chinh)', r.ma === 200, r.kq);
    nhatKy.length = 0;
    r = await goi(tim('post', '/phieu'), { tenKhach: 'Shop A', khachHangId: 7, phanTramCK: 12, dong: [{ maHangId: 1, mauSacId: 3, soCai: 5, giaBanLe: '' }] });
    kiem('xuat ky gui 5 cai -> 200, so phieu KG26xxxx, gia mac dinh = GiaBan 100.000, KHONG dong vao XuatCai / PhieuBanHang', r.ma === 200 && /^KG26\d{4}$/.test(r.kq.data.soPhieu) && nhatKy.some(x => /INSERT INTO PhieuKyGuiChiTiet/.test(x.q) && x.inp.gia === 100000) && !nhatKy.some(x => /XuatCai|INSERT INTO PhieuBanHang/.test(x.q)), r.kq);
    /* okhach */
    r = await goi(tim('get', '/okhach'), {}, {});
    kiem('GET /okhach tong hop theo khach: Shop A gui 22, ban 3, tra 2, con 17, gia tri con 5×100k + 12×50k', r.ma === 200 && r.kq.data.tongHop.length === 1 && r.kq.data.tongHop[0].GuiCai === 22 && r.kq.data.tongHop[0].ConCai === 17 && r.kq.data.tongHop[0].GiaTriCon === 1100000, r.kq && r.kq.data.tongHop);
  }

  console.log('\n=== 4. SO CHUOI (viet sau cung) ===');
  const fBH = boComment(doc('backend', 'routes', 'banhang.js')), fKG = doc('backend', 'routes', 'kygui.js'), fSV = doc('backend', 'server.js');
  const fKH = doc('frontend', 'js', 'module.khohang.js'), fFE = doc('frontend', 'js', 'module.kygui.js'), html = doc('frontend', 'index.html'), mig = doc('database', 'migration_v901.sql');
  kiem('banhang.js: require kyGuiDangGiu; layHangDangGiu cong them ky gui (theoMau + theoMaHang)', /require\('\.\.\/utils\/kyGuiDangGiu'\)/.test(fBH) && /const kg = await kyGuiDangGiu\(pool, sql\);/.test(fBH) && /kg\.theoMau\.forEach/.test(fBH) && /kg\.theoMaHang\.forEach/.test(fBH));
  kiem('banhang.js: chuanBiPhieu mang kyGuiCTID; ghiChiTietPhieu ghi cot KyGuiCTID (gac coKG) + nem loi ro khi thieu migration', /kyGuiCTID: parseInt\(d\.kyGuiCTID, 10\)/.test(fBH) && /\.input\('KyGuiCTID', sql\.Int, coKG \? \(d\.kyGuiCTID \|\| null\) : null\)/.test(fBH) && /coKG \? ', KyGuiCTID' : ''/.test(fBH) && /Chưa chạy database\/migration_v901\.sql/.test(fBH));
  kiem('banhang.js: taoPhieuBanHang tach ra + export; POST /phieu thuong TU CHOI dong co kyGuiCTID; GET /phieu/:id + PUT chan sua phieu bao ban', /async function taoPhieuBanHang\(pool, user, bodyVao\)/.test(fBH) && /module\.exports\.taoPhieuBanHang = taoPhieuBanHang/.test(fBH) && /req\.body\.dong\.some\(d => d && d\.kyGuiCTID\)/.test(fBH) && /header\.LaBaoBanKyGui/.test(fBH) && /AS SoDongKyGui/.test(fBH) && /so\(vuong\.SoDongKyGui\) > 0/.test(fBH));
  kiem('kygui.js: 3 nguon tien/ton KHONG bi dung: khong ghiXuatKho, khong INSERT PhieuBanHang, khong CongNoDieuChinh; bao ban qua banhang.taoPhieuBanHang', !/ghiXuatKho|INSERT INTO PhieuBanHang|CongNoDieuChinh/.test(boComment(fKG)) && /banhang\.taoPhieuBanHang\(pool, req\.session\.user, body\)/.test(fKG));
  kiem('server.js mount /api/kygui', /app\.use\('\/api\/kygui', require\('\.\/routes\/kygui'\)\)/.test(fSV));
  kiem('module.khohang.js: tab kygui + uy quyen window.ModuleKyGui', /\{ key: 'kygui', label: 'Hàng ký gửi' \}/.test(fKH) && /window\.ModuleKyGui\.render\(container, user, activeTab\)/.test(fKH));
  kiem('module.kygui.js: 3 man (so/phieu/tra), bao ban POST /api/kygui/baoban, tra POST /api/kygui/tra, in phieu ky gui, window.ModuleKyGui', /\/api\/kygui\/baoban/.test(fFE) && /\/api\/kygui\/tra'/.test(fFE) && /PHIẾU XUẤT HÀNG KÝ GỬI/.test(fFE) && /window\.ModuleKyGui = \{ render \}/.test(fFE) && /effectivePerm\(user, 'KHOHANG', 'kygui'/.test(fFE));
  kiem('migration_v901: 4 bang + KyGuiCTID + KhachHang.PhanTramCKKyGui + ChucNang KHOHANG/kygui, gac IF', ['CREATE TABLE PhieuKyGui (', 'CREATE TABLE PhieuKyGuiChiTiet (', 'CREATE TABLE PhieuKyGuiTra (', 'CREATE TABLE PhieuKyGuiTraChiTiet (', "COL_LENGTH('PhieuBanHangChiTiet', 'KyGuiCTID')", "COL_LENGTH('KhachHang', 'PhanTramCKKyGui')", "('KHOHANG', 'kygui'"].every(k => mig.indexOf(k) > -1));
  kiem('danhmuc.js + module.danhmuc.js: cot PhanTramCKKyGui', /name: 'PhanTramCKKyGui', sqlType: sql\.Decimal\(5, 2\)/.test(doc('backend', 'routes', 'danhmuc.js')) && /name: 'PhanTramCKKyGui'/.test(doc('frontend', 'js', 'module.danhmuc.js')));
  const v = (f) => { const mm = new RegExp('/js/' + f + '\\.js\\?v=([0-9.]+)').exec(html); return mm ? parseFloat(mm[1]) : 0; };
  kiem('index.html: module.kygui.js nap SAU module.khohang.js; khohang >= 9.75; danhmuc >= 9.75', html.indexOf('module.kygui.js') > html.indexOf('module.khohang.js') && v('module\\.khohang') >= 9.75 && v('module\\.danhmuc') >= 9.75 && v('module\\.kygui') >= 9.75);
  kiem('TRIEN_KHAI co muc v9.75', /v9\.75/.test(doc('docs', 'TRIEN_KHAI_v936_v940.md')));

  clearTimeout(canhGac);
  console.log(`\n=== KET QUA: ${dat} dat, ${sai} sai ===`);
  process.exit(sai ? 1 : 0);
})().catch(e => { console.log('\n  ❌ BO KIEM VO: ' + (e && e.stack || e)); clearTimeout(canhGac); process.exit(1); });
