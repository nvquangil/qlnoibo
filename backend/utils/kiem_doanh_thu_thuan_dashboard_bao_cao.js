/* ================================================================================================
   kiem_doanh_thu_thuan_dashboard_bao_cao.js — bo tu kiem v9.63 (Nguyen 16/11/2026):
   "Doanh thu thuan lech giua Dashboard kinh doanh va Bao cao kinh doanh".
     Truoc v9.63: dashboard = SUM(TongThanhToan) GOM VAT − hang tra (gom VAT); bao cao = SUM(TienTruocVAT)
     KHONG tru hang tra. Nay ca hai = TienTruocVAT(ban) − TienTruocVAT(tra lai, theo NgayNhap).
     1. Bien dich (vm.Script).
     2. routes/baocao.js THAT (db/auth gia): route /kinhdoanh — tru hang tra lai vao doanh thu, gia von theo
        SL thuan, dong ma hang chi co tra lai (SL am), ty le CK NPP tren so thuan, tong = tong dong, Excel.
     3. routes/dashboard.js THAT: SQL dung TienTruocVAT o CA PhieuBanHang lan PhieuNhapLai, ORDER BY theo ten
        cot, tong JS; bieu do thang cung chua VAT.
     4. Giao dien: index.html ?v>=9.63, nhan "chua VAT", dong "Hang ban bi tra lai".
   Chay: node backend\utils\kiem_doanh_thu_thuan_dashboard_bao_cao.js — KHONG dung CSDL.
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
['backend/routes/baocao.js', 'backend/routes/dashboard.js', 'frontend/js/module.baocao.js', 'frontend/js/module.dashboard.js'].forEach(f => {
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
  '../middleware/auth': { requireAuth: (q, s, n) => n(), requirePermission: () => (q, s, n) => n(), requireChucNang: () => (q, s, n) => n(), requireChucNangAny: () => (q, s, n) => n(), canUpdateStage: () => (q, s, n) => n(), coQuyenChucNang: () => true }
};
const gocLoad = Module._load;
Module._load = function (ten) { if (Object.prototype.hasOwnProperty.call(THAY, ten)) return THAY[ten]; return gocLoad.apply(this, arguments); };
const rs = (a) => ({ recordset: a, rowsAffected: [a.length] });
const layHandler = (router, method, p) => { const l = router.stack.find(x => x.route && x.route.path === p && x.route.methods[method]); return l && l.route.stack[l.route.stack.length - 1].handle; };
const goi = async (h, req) => { const res = { code: 200, body: null, headers: {}, status(c) { res.code = c; return res; }, json(o) { res.body = o; return res; }, setHeader(k, v) { res.headers[k] = v; }, end(b) { res.raw = b; } }; await h(Object.assign({ body: {}, query: {}, params: {}, headers: {}, session: { user: { userId: 7, isAdmin: true } }, ip: '1.1.1.1' }, req), res, (e) => { res.loi = e; }); return res; };

(async () => {
  /* ---------------------------------------------------------------- 2 */
  console.log('\n=== 2. routes/baocao.js /kinhdoanh — tru hang tra lai ===');
  const rBC = require(path.join(GOC, 'backend', 'routes', 'baocao.js'));
  /* Kich ban: ban A 100 cai 1.000.000 tren phieu CK NPP 10% (thuc thu 900.000), B 50 cai 600.000 tren phieu CK 5%
     (thuc thu 570.000; B chua khai gia von); khach tra A 10 cai 100.000 (phieu tra CK 10% -> 90.000) va C 2 cai 40.000
     (-> 36.000; C KHONG ban trong ky). Tong phieu ban: tien hang 1.600.000, CK NPP 130.000, truoc VAT 1.470.000, VAT 117.600.
     Phieu tra: tien hang 140.000, CK 14.000, truoc VAT 126.000. => thuan 1.344.000. v9.64: doanh thu tung ma = TienSauCK
     cua CHINH phieu (A 90%, B 95%) — ty le chung ca ky (1.344/1.460 = 0,9205) se ra so KHAC, bo kiem bat duoc. */
  traLoi = (s) => {
    if (/OBJECT_ID\('dbo\.GiaVonHangHoa'/.test(s) || /OBJECT_ID\('dbo\.PhieuNhapLai'/.test(s) || /OBJECT_ID\('dbo\.PhieuBanHang'/.test(s)) return rs([{ o: 1 }]);
    if (/COL_LENGTH\(/.test(s)) return rs([{ c: 1 }]);
    if (/FROM PhieuBanHangChiTiet ct/.test(s) && /BETWEEN @tu AND @den/.test(s)) return rs([{ MaHangID: 1, MaHang: 'A', TenHang: 'Áo', SLCai: 100, TienHang: 1000000, TienSauCK: 900000, GiaVon: 5000, NguonGia: 'tay' }, { MaHangID: 2, MaHang: 'B', TenHang: 'Quần', SLCai: 50, TienHang: 600000, TienSauCK: 570000, GiaVon: null, NguonGia: null }]);
    if (/FROM PhieuNhapLaiChiTiet ct/.test(s)) return rs([{ MaHangID: 1, MaHang: 'A', TenHang: 'Áo', SLCai: 10, TienHang: 100000, TienSauCK: 90000, GiaVon: 5000, NguonGia: 'tay' }, { MaHangID: 3, MaHang: 'C', TenHang: 'Váy', SLCai: 2, TienHang: 40000, TienSauCK: 36000, GiaVon: 8000, NguonGia: 'tay' }]);
    if (/FROM PhieuBanHang WHERE TrangThai <> N'Đã hủy' AND NgayBan BETWEEN/.test(s)) return rs([{ TongTienHang: 1600000, TienCKNPP: 130000, TienTruocVAT: 1470000, TienVAT: 117600, TongThanhToan: 1587600, SoPhieu: 3, TongSLCai: 150 }]);
    if (/FROM PhieuNhapLai WHERE TrangThai <> N'Đã hủy' AND NgayNhap BETWEEN/.test(s)) return rs([{ TongTienHang: 140000, TienCKNPP: 14000, TienTruocVAT: 126000, TienVAT: 10080, TongThanhToan: 136080, SoPhieu: 1, TongSLCai: 12 }]);
    if (/lt\.TinhChiPhiKD = 1 WHERE pc\.NgayChi/.test(s)) return rs([{ TenLoai: 'Chi phí bán hàng', TenTK: 'Xăng xe', SoTien: 200000, SoPhieu: 2 }]);
    if (/ISNULL\(lt\.TinhChiPhiKD, 0\) = 0/.test(s)) return rs([{ SoTien: 0, SoPhieu: 0 }]);
    if (/SELECT TenLoai FROM DanhMucLoaiTaiKhoan WHERE TinhChiPhiKD = 1/.test(s)) return rs([{ TenLoai: 'Chi phí bán hàng' }]);
    return rs([]);
  };
  let r = await goi(layHandler(rBC, 'get', '/kinhdoanh'), { query: { tuNgay: '2026-01-01', denNgay: '2026-11-16' } });
  kiem('route tra 200, khong nem', r.code === 200 && !r.loi && r.body && r.body.success, r.loi && r.loi.message);
  const t = (r.body && r.body.data && r.body.data.tong) || {}, ct = (r.body && r.body.data && r.body.data.chiTiet) || [];
  kiem('tong: DoanhThuBan 1.470.000 (TienTruocVAT), HangTraLai 126.000, DOANH THU THUAN 1.344.000', t.DoanhThuBan === 1470000 && t.HangTraLai === 126000 && t.DoanhThuThuan === 1344000, t);
  kiem('tong: SoPhieuTra 1, TongSLCaiTra 12, TongThanhToanTra 136.080; SoPhieu ban 3 van nguyen', t.SoPhieuTra === 1 && t.TongSLCaiTra === 12 && t.TongThanhToanTra === 136080 && t.SoPhieu === 3);
  const A = ct.find(x => x.MaHang === 'A'), B = ct.find(x => x.MaHang === 'B'), C = ct.find(x => x.MaHang === 'C');
  kiem('ma A: SL thuan 90 (ban 100 − tra 10), tien hang 900.000, doanh thu 810.000 (CK 10% cua CHINH phieu: 900.000 − 90.000), gia von 450.000, lai gop 360.000', A && A.SLCai === 90 && A.SLCaiBan === 100 && A.SLCaiTra === 10 && A.TienHang === 900000 && A.DoanhThu === 810000 && A.GiaVon === 450000 && A.LaiGop === 360000, A);
  kiem('ma B: phieu CK 5% -> doanh thu 570.000 (KHONG phai 600.000 × ty le chung); chua khai gia von -> ThieuGiaVon, gia von 0', B && B.SLCai === 50 && B.ThieuGiaVon === true && B.GiaVon === 0 && B.DoanhThu === 570000, B);
  kiem('ma C: CHI co tra lai (ban ky truoc) -> dong rieng SL −2, doanh thu −36.000, gia von −16.000, ty le lai null', C && C.SLCai === -2 && C.DoanhThu === -36000 && C.GiaVon === -16000 && C.LaiGop === -20000 && C.TyLeLai === null, C);
  kiem('TONG cac dong doanh thu = DOANH THU THUAN (1.344.000) — CK theo tung phieu cong lai dung bang TienTruocVAT thuan', ct.reduce((s, x) => s + x.DoanhThu, 0) === t.DoanhThuThuan);
  kiem('gia von tong 434.000 (450.000 + 0 − 16.000), lai gop 910.000, chi phi 200.000, loi nhuan 710.000, ty le lai gop 67,71%', t.GiaVon === 434000 && t.LaiGop === 910000 && t.ChiPhiKD === 200000 && t.LoiNhuan === 710000 && t.TyLeLaiGop === 67.71, t);
  kiem('thieuGiaVon = [B]; sap xep theo tien hang thuan giam dan A, B, C', JSON.stringify(r.body.data.thieuGiaVon) === '["B"]' && ct.map(x => x.MaHang).join() === 'A,B,C');
  kiem('ghiChu noi ro tru hang tra lai + cung cach tinh voi Dashboard + CK NPP cua CHINH phieu', /trừ hàng khách trả lại/i.test(r.body.data.ghiChu) && /Dashboard/.test(r.body.data.ghiChu) && /CHÍNH phiếu/.test(r.body.data.ghiChu));
  kiem('SQL tra lai loc TrangThai <> Đã hủy + NgayNhap trong ky (khong phai NgayBan cua phieu goc)', nhatKySql.some(x => /FROM PhieuNhapLaiChiTiet ct JOIN PhieuNhapLai p ON p\.PhieuNLID = ct\.PhieuNLID .*p\.TrangThai <> N'Đã hủy' AND p\.NgayNhap BETWEEN @tu AND @den/.test(x.q)));
  kiem('SQL ban + tra: TienSauCK = ThanhTien × TienTruocVAT/TongTienHang cua phieu (FLOAT, NULLIF chia 0, ISNULL -> 1)', nhatKySql.filter(x => /ct\.ThanhTien \* ISNULL\(CAST\(p\.TienTruocVAT AS FLOAT\) \/ NULLIF\(CAST\(p\.TongTienHang AS FLOAT\), 0\), 1\)\) AS TienSauCK/.test(x.q)).length >= 2);
  // v9.64: tab Gia von hang hoa — lai 1 cai theo GIA THUC THU (sau CK shop + CK NPP), khong phai gia niem yet
  nhatKySql.length = 0;
  const traLoiCu = traLoi;
  traLoi = (s) => {
    if (/FROM TheKhoHangHoa h LEFT JOIN GiaVonHangHoa gv/.test(s)) return rs([
      { MaHangID: 1, MaHang: 'A', TenHang: 'Áo', LoaiHang: 'NhaSanXuat', GiaBan: 12000, DonViCoBan: 'Cái', MaDH: 'DH1', GiaVon: 5000, NguonGia: 'tay', SLBan: 100, TienSauCK: 900000, LanBanCuoi: '2026-11-10' },
      { MaHangID: 9, MaHang: 'M', TenHang: 'Mới', LoaiHang: 'DatNgoai', GiaBan: 20000, DonViCoBan: 'Cái', MaDH: null, GiaVon: 15000, NguonGia: 'tay', SLBan: null, TienSauCK: null, LanBanCuoi: null }]);
    return traLoiCu(s);
  };
  r = await goi(layHandler(rBC, 'get', '/giavon'), {});
  kiem('/giavon tra 200', r.code === 200 && !r.loi && r.body.success, r.loi && r.loi.message);
  const gA = (r.body.data || []).find(x => x.MaHang === 'A'), gM = (r.body.data || []).find(x => x.MaHang === 'M');
  kiem('ma A: gia niem yet 12.000 nhung GIA THUC THU 9.000 (900.000/100) -> lai 1 cai 4.000 (44,44%), TheoNiemYet=false', gA && gA.GiaBan === 12000 && gA.GiaBanTT === 9000 && gA.LaiGop1 === 4000 && gA.TyLeLai1 === 44.44 && gA.TheoNiemYet === false && gA.SLBan === 100, gA);
  kiem('ma M chua ban: GiaBanTT null, lai tam theo niem yet 20.000 − 15.000 = 5.000, TheoNiemYet=true', gM && gM.GiaBanTT === null && gM.LaiGop1 === 5000 && gM.TheoNiemYet === true, gM);
  kiem('SQL /giavon: join phieu ban chua huy (khong loc ky), TienSauCK theo CK cua tung phieu', nhatKySql.some(x => /FROM PhieuBanHangChiTiet ct JOIN PhieuBanHang p ON p\.PhieuBHID = ct\.PhieuBHID WHERE p\.TrangThai <> N'Đã hủy' GROUP BY ct\.MaHangID\) b ON b\.MaHangID = h\.MaHangID/.test(x.q) && /AS TienSauCK/.test(x.q)));
  traLoi = traLoiCu;
  /* Chua migration_v676 (khong co bang PhieuNhapLai): coBang() dem theo ten bang trong tien trinh nen khong goi lai duoc
     voi ket qua khac — kiem bang chuoi: moi cau SQL PhieuNhapLai deu gac sau coNhapLai. */
  const fBC = boComment(doc('backend', 'routes', 'baocao.js'));
  kiem('baocao.js: coNhapLai gac moi cau SQL PhieuNhapLai (chua migration_v676 thi tra lai = 0, khong nem)', /const coNhapLai = await coBang\(pool, 'PhieuNhapLai'\)/.test(fBC) && /const rowsTra = coNhapLai \?/.test(fBC) && /const tongTra = coNhapLai \?/.test(fBC) && /coBangNhapLai: coNhapLai/.test(fBC));
  kiem('baocao.js Excel: dong "Hàng bán bị trả lại" am, "DOANH THU THUẦN" sau no, sheet ma hang co SL ban / SL tra / SL thuan', /Hàng bán bị trả lại \(\$\{t\.SoPhieuTra \|\| 0\} phiếu nhập lại, chưa VAT\)`, V: -t\.HangTraLai/.test(fBC) && fBC.indexOf('Hàng bán bị trả lại') < fBC.indexOf("'DOANH THU THUẦN (chưa gồm thuế GTGT, đã trừ hàng trả lại)'") && /key: 'SLCaiBan'/.test(fBC) && /key: 'SLCaiTra'/.test(fBC));

  /* ---------------------------------------------------------------- 3 */
  console.log('\n=== 3. routes/dashboard.js /kinhdoanh — chua VAT, cung dinh nghia ===');
  const rDB = require(path.join(GOC, 'backend', 'routes', 'dashboard.js'));
  nhatKySql.length = 0;
  traLoi = (s) => {
    if (/OBJECT_ID\('PhieuNhapLai'\)/.test(s)) return rs([{ c: 1 }]);
    if (/WITH M AS/.test(s)) return rs([{ Nam: 2026, Thang: 10, DoanhThuThuan: 500000 }, { Nam: 2026, Thang: 11, DoanhThuThuan: 814000 }]);
    if (/SELECT T\.Ten AS TenKhach/.test(s)) return rs([
      { TenKhach: 'Khách 1', DoanhThu: 1470000, DoanhThuGomVAT: 1587600, SoPhieu: 3, TraLai: 126000, TraLaiGomVAT: 136080, DaThuKy: 1000000, DoanhThuThuan: 1344000, ConNo: 587600 },
      { TenKhach: 'Khách 2', DoanhThu: 200000, DoanhThuGomVAT: 200000, SoPhieu: 1, TraLai: 0, TraLaiGomVAT: 0, DaThuKy: 0, DoanhThuThuan: 200000, ConNo: 200000 }]);
    return rs([]);
  };
  r = await goi(layHandler(rDB, 'get', '/kinhdoanh'), { query: { tuNgay: '2026-01-01', denNgay: '2026-11-16' } });
  kiem('route tra 200', r.code === 200 && !r.loi && r.body.success, r.loi && r.loi.message);
  const tg = r.body.data.tong;
  kiem('tong: doanhThu 1.670.000 (chua VAT), doanhThuGomVAT 1.787.600, traLai 126.000, traLaiGomVAT 136.080, doanhThuThuan 1.544.000, soKhach 2', tg.doanhThu === 1670000 && tg.doanhThuGomVAT === 1787600 && tg.traLai === 126000 && tg.traLaiGomVAT === 136080 && tg.doanhThuThuan === 1544000 && tg.soKhach === 2, tg);
  kiem('rows mang DoanhThuGomVAT / TraLaiGomVAT (de tooltip), DoanhThuThuan khach 1 = 1.344.000 = bao cao kinh doanh cung kich ban', r.body.data.rows[0].DoanhThuGomVAT === 1587600 && r.body.data.rows[0].TraLaiGomVAT === 136080 && r.body.data.rows[0].DoanhThuThuan === 1344000 && r.body.data.rows[0].DoanhThuThuan === t.DoanhThuThuan);
  const qChinh = (nhatKySql.find(x => /SELECT T\.Ten AS TenKhach/.test(x.q)) || {}).q || '';
  kiem('SQL chinh: ban = SUM(TienTruocVAT) AS DoanhThu + SUM(TongThanhToan) AS DoanhThuGomVAT; tra = SUM(ISNULL(TienTruocVAT, 0)) AS TraLai; thuan = DoanhThu − TraLai', /SUM\(TienTruocVAT\) AS DoanhThu, SUM\(TongThanhToan\) AS DoanhThuGomVAT/.test(qChinh) && /SUM\(ISNULL\(TienTruocVAT, 0\)\) AS TraLai, SUM\(TongThanhToan\) AS TraLaiGomVAT/.test(qChinh) && /ISNULL\(ban\.DoanhThu,0\) - ISNULL\(tra\.TraLai,0\) AS DoanhThuThuan/.test(qChinh));
  kiem('SQL chinh: CON NO van tinh tren TongThanhToan luy ke (gom VAT) — khong doi', /lkBan AS \(SELECT LTRIM\(RTRIM\(TenKhach\)\) AS Ten, SUM\(TongThanhToan\) AS S FROM PhieuBanHang/.test(qChinh) && /ISNULL\(lkBan\.S,0\) \+ ISNULL\(lkDC\.S,0\) - ISNULL\(lkThu\.S,0\) - ISNULL\(lkTra\.S,0\) AS ConNo/.test(qChinh));
  kiem('SQL chinh: ORDER BY theo TEN cot DoanhThuThuan (khong con "ORDER BY 6" — them cot la sai)', /ORDER BY DoanhThuThuan DESC$/.test(qChinh) && !/ORDER BY \d/.test(qChinh));
  const qThang = (nhatKySql.find(x => /WITH M AS/.test(x.q)) || {}).q || '';
  kiem('bieu do thang: TienTruocVAT (ban) va -ISNULL(TienTruocVAT, 0) (tra), khong con TongThanhToan', /TienTruocVAT AS Tien FROM PhieuBanHang/.test(qThang) && /-ISNULL\(TienTruocVAT, 0\) FROM PhieuNhapLai/.test(qThang) && !/TongThanhToan/.test(qThang));
  const fDB = boComment(doc('backend', 'routes', 'dashboard.js'));
  kiem('dashboard.js: hai nguon (ban/tra) deu TienTruocVAT; TongThanhToan chi con o *GomVAT va cong no', (fDB.match(/SUM\(TienTruocVAT\)/g) || []).length >= 1 && (fDB.match(/ISNULL\(TienTruocVAT, 0\)/g) || []).length >= 2);

  /* ---------------------------------------------------------------- 4 */
  console.log('\n=== 4. giao dien ===');
  const html = doc('frontend', 'index.html');
  const vCua = (f) => { const m = new RegExp(f.replace(/[.]/g, '\\.') + '\\?v=([\\d.]+)').exec(html); return m ? parseFloat(m[1]) : 0; };
  kiem('index.html: module.dashboard.js + module.baocao.js ?v>=9.63', vCua('/js/module.dashboard.js') >= 9.63 && vCua('/js/module.baocao.js') >= 9.63, { db: vCua('/js/module.dashboard.js'), bc: vCua('/js/module.baocao.js') });
  const mDB = boComment(doc('frontend', 'js', 'module.dashboard.js'));
  kiem('module.dashboard.js: the Doanh thu / Hang tra ghi "(chưa VAT)", dong phu "gồm VAT" tu doanhThuGomVAT, the thuan ghi "khớp Báo cáo kinh doanh"', /Doanh thu trong kỳ <span[^>]*>\(chưa VAT\)/.test(mDB) && /gồm VAT \$\{fmtTien\(t\.doanhThuGomVAT == null \? t\.doanhThu : t\.doanhThuGomVAT\)\}/.test(mDB) && /khớp Báo cáo kinh doanh/.test(mDB) && /title="Gồm VAT: \$\{fmtTien\(r\.DoanhThuGomVAT/.test(mDB));
  const mBC = boComment(doc('frontend', 'js', 'module.baocao.js'));
  kiem('module.baocao.js: muc A co "Doanh thu bán hàng" -> "Hàng bán bị trả lại" (am) -> "DOANH THU THUẦN … bằng Dashboard"; the dau ghi so phieu tra; bang B hien "(−x trả)"', /Doanh thu bán hàng <span/.test(mBC) && /Hàng bán bị trả lại <span/.test(mBC) && /đã trừ hàng trả lại — bằng Dashboard kinh doanh/.test(mBC) && /phiếu trả lại \(/.test(mBC) && /trả\)<\/span>/.test(mBC) && mBC.indexOf('Hàng bán bị trả lại <span') < mBC.indexOf('DOANH THU THUẦN <span'));
  kiem('module.baocao.js: dong "Hàng bán bị trả lại" dung dongCT voi amTinh=true (hien dau tru)', /t\.HangTraLai \|\| 0, false, true, true\)/.test(mBC));
  kiem('v9.64 tab Gia von: cot "Giá thực thu (1 cái)" + "Giá niêm yết", lai 1 cai tu LaiGop1/TyLeLai1, nhan "niêm yết" khi TheoNiemYet, soCot 11/10; index.html ?v>=9.64', /Giá thực thu \(1 cái\)/.test(mBC) && /Giá niêm yết<\/th>/.test(mBC) && /r\.GiaBanTT != null/.test(mBC) && /r\.TyLeLai1/.test(mBC) && /r\.TheoNiemYet \?/.test(mBC) && /perm\.canEdit \? 11 : 10/.test(mBC) && vCua('/js/module.baocao.js') >= 9.64);

  /* ============================================================================================
     v9.86 (Nguyen 19/11: "số phải thu của khách ở dashboard và báo cáo kinh doanh đang lệch")
     CONG THUC PHAI THU KHACH = Ban + DieuChinh − DaThu − TraLai(PhieuNhapLai).
     Ba man chep tay ba cau SQL: congno.js (chuan, v6.66), dashboard.js (dung), baocao.js muc B
     (THIEU `− TraLai` cho toi v9.86). Khoa ca ba o day — lech lan nua la do bo kiem nay khong bat.
     ============================================================================================ */
  console.log('\n=== v9.86 — phai thu khach: BA man phai cung mot cong thuc ===');
  const fBC = boComment(doc('backend', 'routes', 'baocao.js'));
  const fCN = boComment(doc('backend', 'routes', 'congno.js'));
  const fDB = boComment(doc('backend', 'routes', 'dashboard.js'));
  kiem('baocao.js muc B: CO doc PhieuNhapLai (gac bang OBJECT_ID) va TRU TraLai khoi phai thu',
    /OBJECT_ID\('PhieuNhapLai', 'U'\)/.test(fBC)
    && /FROM PhieuNhapLai WHERE TrangThai <> N'Đã hủy' AND NgayNhap <= @den/.test(fBC)
    && /- so\(phaiThu\.DaThu\) - so\(phaiThu\.TraLai\)/.test(fBC));
  kiem('congno.js + dashboard.js van tru tra lai (khong ai lam hong lai)',
    /x\.PhaiThu \+ x\.DieuChinh - x\.DaThu - x\.TraLai/.test(fCN)
    && /ISNULL\(lkBan\.S,0\) \+ ISNULL\(lkDC\.S,0\) - ISNULL\(lkThu\.S,0\) - ISNULL\(lkTra\.S,0\) AS ConNo/.test(fDB));
  kiem('baocao.js tra PhaiThu_TraLai ra ngoai + Excel co dong "Hàng khách trả lại"',
    /PhaiThu_TraLai: tien\(phaiThu\.TraLai\)/.test(fBC) && /Hàng khách trả lại/.test(fBC));
  kiem('module.baocao.js: the phai thu in DU 4 ve (co dieu chinh + khach tra), bang B co dong "Hàng khách trả lại"',
    /\+ điều chỉnh \$\{fmtNumber\(cn\.PhaiThu_DieuChinh\)\}/.test(mBC)
    && /− khách trả hàng \$\{fmtNumber\(cn\.PhaiThu_TraLai\)\}/.test(mBC)
    && /Hàng khách trả lại<\/td>/.test(mBC) && vCua('/js/module.baocao.js') >= 9.86);

  Module._load = gocLoad;
  clearTimeout(canhGac);
  console.log(`\n=== KET QUA: ${dat} dat, ${sai} sai ===`);
  process.exit(sai ? 1 : 0);
})().catch(e => { console.error('VO: ' + (e && e.stack || e)); process.exit(1); });
