/* ================================================================================================
   kiem_nghi_phep_le_chuyen_can.js — bo tu kiem cho v9.55 (Nguyen 14/11/2026):
     · hop dong: kieu thuong CHUYEN CAN bac thang (chi nhan bac cao nhat, moi bac la so tong; thay the phu cap
       chuyen can co dinh)
     · phieu nghi phep (P, KHONG luong) + lich nghi ca nhan KL/TS/TN -> ghi vao ChamCongNgay (Nguon='PhieuNghi'),
       may thang phieu, ap lai sau tong hop
     · lich nghi le chung (NgayLeChung, KHONG cong) — chep mot lan tu o cu cua Cai dat cham cong
     · cot KHONG PHEP o bang luong cong nhat (ngay lam viec khong co dong cham cong)

   KIEM HANH VI: ham thuan cua utils/luongCongNhat.js chay that; utils/nghiPhep.js + routes/payroll.js +
   routes/hrm.js chay THAT voi CSDL gia (Module._load thay '../db'); utils/bangLuongTuDong GIA ghi nhat ky
   (v9.53 da co bo kiem rieng). Chuoi so sau cung.

   Chay:  node backend\utils\kiem_nghi_phep_le_chuyen_can.js      KHONG dung toi CSDL.
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
  else { sai++; console.log('  ❌ ' + ten + (td ? ' — ' + td : '')); }
}
const canhGac = setTimeout(() => { console.log('\n  ❌ BO KIEM TREO qua 20 s — khong toi duoc dong KET QUA'); process.exit(1); }, 20000);

const fLCN = doc('backend', 'utils', 'luongCongNhat.js'), fNP = doc('backend', 'utils', 'nghiPhep.js');
const fPR = doc('backend', 'routes', 'payroll.js'), fHRM = doc('backend', 'routes', 'hrm.js');
const fFE = doc('frontend', 'js', 'module.payroll.js'), fHrmFE = doc('frontend', 'js', 'module.hrm.js'), fMy = doc('frontend', 'js', 'module.mypay.js');
const html = doc('frontend', 'index.html'), mig = doc('database', 'migration_v892.sql');
const mig899 = doc('database', 'migration_v899.sql'), fNP = doc('backend', 'utils', 'nghiPhep.js');   // v9.73

console.log('\n=== 1. BIEN DICH ===');
[['backend/utils/luongCongNhat.js', fLCN], ['backend/utils/nghiPhep.js', fNP], ['backend/routes/payroll.js', fPR], ['backend/routes/hrm.js', fHRM],
 ['frontend/js/module.payroll.js', fFE], ['frontend/js/module.hrm.js', fHrmFE], ['frontend/js/module.mypay.js', fMy]].forEach(([f, s]) => {
  if (!s) { sai++; console.log('  ❌ ' + f + ' KHONG DOC DUOC'); return; }
  try { new vm.Script(s, { filename: f }); dat++; console.log('  ✓ ' + f); }
  catch (e) { sai++; console.log('  ❌ ' + f + ' VO CU PHAP: ' + e.message); }
});
kiem('co database/migration_v892.sql', mig.length > 500);

/* ------------------------------------------------------------------------------------------------
   CSDL GIA: bang NgayLeChung / PhieuNghi / HopDongChuyenCan trong bo nho; ChamCongNgay chi ghi NHAT KY MERGE/DELETE.
   ------------------------------------------------------------------------------------------------ */
const GIA = {
  bang: new Set(['NgayLeChung', 'PhieuNghi', 'HopDongChuyenCan', 'HopDongSanPham', 'DanhGiaKPI', 'ThuongSanPhamThang', 'NhomChamCong']),
  cauHinh: new Map(), ngayLe: [], phieu: [], bac: [], nv: { 3: { NhanVienID: 3, HoTen: 'Trần C' } }, qltt: 'Lê Trưởng',
  agg: [], emps: [], cc: [], header: null, chiTiet: [], hopDongRows: [], idTiep: 100
};
const nhatKy = [];
function taoRequest() {
  const inputs = {};
  const r = {
    input(ten, kieu, gt) { inputs[ten] = arguments.length === 2 ? kieu : gt; return r; },
    async query(q) {
      nhatKy.push({ q, inputs: Object.assign({}, inputs) });
      const rs = (recordset, rowsAffected) => ({ recordset, rowsAffected: rowsAffected || [recordset.length ? 1 : 0] });
      const ngayTu = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v || '').slice(0, 10));
      if (/SELECT OBJECT_ID\(@t\) AS o/.test(q)) return rs([{ o: GIA.bang.has(inputs.t) ? 9 : null }]);
      if (/SELECT OBJECT_ID\('(\w+)'\) AS o/.test(q)) { const t = /OBJECT_ID\('(\w+)'\)/.exec(q)[1]; return rs([{ o: GIA.bang.has(t) ? 9 : null }]); }
      if (/FROM CauHinh WHERE Khoa=@k/.test(q)) { const v = GIA.cauHinh.get(inputs.k); return rs(v === undefined ? [] : [{ GiaTri: v }]); }
      if (/UPDATE CauHinh SET GiaTri=@v/.test(q)) { if (!GIA.cauHinh.has(inputs.k)) return rs([], [0]); GIA.cauHinh.set(inputs.k, inputs.v); return rs([], [1]); }
      if (/INSERT INTO CauHinh/.test(q)) { GIA.cauHinh.set(inputs.k, inputs.v); return rs([], [1]); }
      /* --- NgayLeChung --- */
      if (/SELECT COUNT\(\*\) AS n FROM NgayLeChung/.test(q)) return rs([{ n: GIA.ngayLe.length }]);
      if (/IF NOT EXISTS \(SELECT 1 FROM NgayLeChung WHERE Ngay=@d\) INSERT INTO NgayLeChung/.test(q)) {
        const d = ngayTu(inputs.d); if (GIA.ngayLe.some(x => x.Ngay === d)) return rs([], [0]);
        GIA.ngayLe.push({ ID: GIA.idTiep++, Ngay: d, TenLe: inputs.t, GhiChu: null }); return rs([], [1]);
      }
      if (/FROM NgayLeChung WHERE ID=@id/.test(q)) { const x = GIA.ngayLe.find(y => y.ID === inputs.id); return rs(x ? [{ Ngay: x.Ngay }] : []); }   // truoc regex docNgayLe
      const leTheoNam = () => (inputs.n ? GIA.ngayLe.filter(x => x.Ngay.startsWith(String(inputs.n) + '-')) : GIA.ngayLe).slice().sort((a, b) => a.Ngay.localeCompare(b.Ngay));
      if (/SELECT CONVERT\(varchar\(10\), Ngay, 23\) AS Ngay FROM NgayLeChung/.test(q)) return rs(leTheoNam().map(x => ({ Ngay: x.Ngay })));
      if (/SELECT ID, CONVERT\(varchar\(10\), Ngay, 23\) AS Ngay, TenLe, GhiChu FROM NgayLeChung/.test(q)) return rs(leTheoNam().map(x => Object.assign({}, x)));
      if (/SELECT ID FROM NgayLeChung WHERE Ngay=@d/.test(q)) { const d = ngayTu(inputs.d); const x = GIA.ngayLe.find(y => y.Ngay === d); return rs(x ? [{ ID: x.ID }] : []); }
      if (/INSERT INTO NgayLeChung \(Ngay, TenLe, GhiChu\) OUTPUT INSERTED\.ID/.test(q)) { const x = { ID: GIA.idTiep++, Ngay: ngayTu(inputs.d), TenLe: inputs.t, GhiChu: inputs.g }; GIA.ngayLe.push(x); return rs([{ ID: x.ID }]); }
      if (/DELETE FROM NgayLeChung WHERE ID=@id/.test(q)) { const n = GIA.ngayLe.length; GIA.ngayLe = GIA.ngayLe.filter(y => y.ID !== inputs.id); return rs([], [n - GIA.ngayLe.length]); }
      /* --- PhieuNghi --- */
      if (/SELECT SoPhieu AS S FROM PhieuNghi WHERE SoPhieu LIKE @p/.test(q)) return rs(GIA.phieu.map(p => ({ S: p.SoPhieu })));
      if (/INSERT INTO PhieuNghi/.test(q)) {
        const p = { PhieuNghiID: GIA.idTiep++, SoPhieu: inputs.so, NhanVienID: inputs.nv, Loai: inputs.loai, TuNgay: ngayTu(inputs.tu), DenNgay: ngayTu(inputs.den),
          SoNgay: inputs.sn, LyDo: inputs.ly, NguoiDuyet: inputs.nd, GhiChu: inputs.gc, NguoiTaoID: inputs.u, CreatedAt: '2026-11-14 09:00' };
        GIA.phieu.push(p); return rs([{ PhieuNghiID: p.PhieuNghiID }]);
      }
      if (/UPDATE PhieuNghi SET/.test(q)) {
        const p = GIA.phieu.find(x => x.PhieuNghiID === inputs.id); if (!p) return rs([], [0]);
        Object.assign(p, { NhanVienID: inputs.nv, Loai: inputs.loai, TuNgay: ngayTu(inputs.tu), DenNgay: ngayTu(inputs.den), SoNgay: inputs.sn, LyDo: inputs.ly, NguoiDuyet: inputs.nd, GhiChu: inputs.gc });
        return rs([], [1]);
      }
      if (/DELETE FROM PhieuNghi WHERE PhieuNghiID=@id/.test(q)) { const n = GIA.phieu.length; GIA.phieu = GIA.phieu.filter(x => x.PhieuNghiID !== inputs.id); return rs([], [n - GIA.phieu.length]); }
      if (/FROM PhieuNghi WHERE TuNgay <= @cuoi AND DenNgay >= @dau/.test(q)) {
        const dau = ngayTu(inputs.dau), cuoi = ngayTu(inputs.cuoi);
        return rs(GIA.phieu.filter(p => p.TuNgay <= cuoi && p.DenNgay >= dau).map(p => Object.assign({}, p)));
      }
      if (/FROM PhieuNghi p\s+JOIN NhanVien nv ON nv\.NhanVienID = p\.NhanVienID WHERE p\.PhieuNghiID=@id/.test(q) || /FROM PhieuNghi WHERE PhieuNghiID=@id/.test(q)) {
        const p = GIA.phieu.find(x => x.PhieuNghiID === inputs.id);
        return rs(p ? [Object.assign({ HoTen: (GIA.nv[p.NhanVienID] || {}).HoTen }, p)] : []);
      }
      if (/FROM PhieuNghi p/.test(q)) {   // danh sach (SELECT_PHIEU_NGHI)
        let ds = GIA.phieu;
        if (inputs.dau) { const dau = ngayTu(inputs.dau), cuoi = ngayTu(inputs.cuoi); ds = ds.filter(p => p.TuNgay <= cuoi && p.DenNgay >= dau); }
        if (inputs.nv) ds = ds.filter(p => p.NhanVienID === inputs.nv);
        return rs(ds.map(p => Object.assign({ HoTen: (GIA.nv[p.NhanVienID] || {}).HoTen, MaNhanVien: 'NV00' + p.NhanVienID, TenBoPhan: 'May' }, p)));
      }
      if (/SELECT NhanVienID, HoTen FROM NhanVien WHERE NhanVienID=@id/.test(q)) { const n = GIA.nv[inputs.id]; return rs(n ? [Object.assign({}, n)] : []); }
      if (/SELECT TOP 1 QuanLyTrucTiep FROM HopDongLaoDong/.test(q)) return rs(GIA.qltt ? [{ QuanLyTrucTiep: GIA.qltt }] : []);
      /* --- ChamCongNgay: chi ghi nhat ky --- */
      if (/MERGE ChamCongNgay AS t/.test(q)) return rs([], [1]);
      if (/DELETE FROM ChamCongNgay WHERE NhanVienID=@nv AND Ngay BETWEEN @tu AND @den AND Nguon = N'PhieuNghi'/.test(q)) return rs([], [2]);
      if (/FROM ChamCongRaw/.test(q) && /GROUP BY NhanVienID, CAST\(ThoiGian AS DATE\)/.test(q)) return rs(GIA.agg.map(a => Object.assign({}, a)));
      /* --- tinh luong --- */
      if (/FROM BangLuong WHERE Nam=@n AND Thang=@t AND Loai=N'CongNhat'/.test(q)) return rs(GIA.header ? [Object.assign({}, GIA.header)] : []);
      if (/MERGE BangLuong AS t/.test(q)) { if (!GIA.header) GIA.header = { BangLuongID: 7, TrangThai: 'Nháp' }; return rs([], [1]); }
      if (/SELECT NhanVienID, DieuChinh, LyDoDieuChinh FROM BangLuongChiTiet/.test(q)) return rs([]);
      if (/COL_LENGTH\('PhieuChi','NhanVienID'\)/.test(q)) return rs([{ a: 4, b: 4, c: 4 }]);
      if (/COL_LENGTH|OBJECT_ID/.test(q)) return rs([{ a: 4, b: 4, c: 4, t: 4, o: 4 }]);
      if (/SELECT \* FROM CauHinhLuong WHERE ID=1/.test(q)) return rs([{ GioChuanNgay: 8, HsTangCaThuong: 1.5, LamTronThucLinh: 1000, TruThueTNCN: 0, DiMuonChamChuocPhut: 5, BhxhNld: 8, BhytNld: 1.5, BhtnNld: 1 }]);
      if (/SELECT SoNgayCong FROM CongChuanThang/.test(q)) return rs([{ SoNgayCong: 26 }]);
      if (/FROM BacThueTNCN/.test(q)) return rs([]);
      if (/OUTER APPLY \(SELECT TOP 1 \* FROM HopDongLaoDong h/.test(q) && /FROM NhanVien nv/.test(q)) return rs(GIA.emps.map(e => Object.assign({}, e)));
      if (/FROM ChamCongNgay WHERE YEAR\(Ngay\)=@n AND MONTH\(Ngay\)=@t/.test(q)) return rs(GIA.cc.map(x => Object.assign({}, x)));
      if (/SELECT pc\.NhanVienID, SUM\(pc\.SoTien\)/.test(q)) return rs([]);
      if (/SELECT HopDongID, SoCong, TienThuong(, SoNgayNghiToiDa)? FROM HopDongChuyenCan WHERE HopDongID IN/.test(q)) return rs(GIA.bac.map(b => Object.assign({}, b)));   // v9.72: + SoNgayNghiToiDa
      /* --- hrm --- */
      if (/INSERT INTO HopDongLaoDong/.test(q)) return rs([{ HopDongID: 55 }]);
      if (/DELETE FROM HopDongChuyenCan WHERE HopDongID=@id/.test(q)) { GIA.bac = GIA.bac.filter(b => b.HopDongID !== inputs.id); return rs([], [1]); }
      if (/INSERT INTO HopDongChuyenCan/.test(q)) { GIA.bac.push({ ID: GIA.idTiep++, HopDongID: inputs.id, SoCong: inputs.sc, TienThuong: inputs.tien, ThuTu: inputs.tt }); return rs([], [1]); }
      if (/FROM HopDongChuyenCan\s+WHERE HopDongID IN/.test(q)) return rs(GIA.bac.map(b => Object.assign({}, b)));
      if (/FROM HopDongSanPham/.test(q)) return rs([]);
      if (/FROM HopDongLaoDong hd\s+JOIN NhanVien nv/.test(q)) return rs(GIA.hopDongRows.map(h => Object.assign({}, h)));
      if (/SELECT SoHopDong, CONVERT\(varchar\(10\), TuNgay, 23\) AS TuNgay FROM HopDongLaoDong/.test(q)) return rs([]);
      return rs([], [1]);
    }
  };
  return r;
}
const poolGia = { request: () => taoRequest() };
class TranGia { async begin() {} async commit() {} async rollback() {} }
const sqlGia = new Proxy({}, {
  get(_, k) {
    if (k === 'Transaction') return TranGia;
    if (k === 'Request') return class { constructor() { return taoRequest(); } };
    const f = () => k; f.toString = () => String(k); return f;
  }
});
const dbGia = { sql: sqlGia, getPool: async () => poolGia };
const mw = () => (req, res, next) => next();
const authGia = { requireAuth: mw(), requirePermission: mw, requireChucNang: mw, requireChucNangAny: mw, canUpdateStage: mw, coQuyenChucNang: async () => true };
const nhatKyDau = [];
const utilGia = {
  danhDau: async (p, nam, thang, lyDo) => { nhatKyDau.push({ loai: 'danhDau', nam, thang, lyDo }); return true; },
  danhDauNhieu: async (p, ds, lyDo) => { nhatKyDau.push({ loai: 'danhDauNhieu', ds, lyDo }); return true; },
  danhDauTheoNgay: async (p, ngay, lyDo) => { nhatKyDau.push({ loai: 'danhDauTheoNgay', ngay, lyDo }); return true; },
  danhDauGanDay: async (p, lyDo) => { nhatKyDau.push({ loai: 'danhDauGanDay', lyDo }); return true; },
  danhDauTuNgay: async (p, ngay, lyDo) => { nhatKyDau.push({ loai: 'danhDauTuNgay', ngay, lyDo }); return true; },
  docMoc: async () => ({ can: false, lan: 0, lyDo: [] }), ghiNhanDaTinh: async () => ({ cach: 'tay' }), tinhLaiNeuCan: async () => ({ daTinhLai: false }),
  ddmmyyyy: (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? `${m[3]}/${m[2]}/${m[1]}` : String(s || ''); },
  bayGio: () => '2026-11-14 09:00', thangTuNgay: () => null, thangTruLuong: () => ({ nam: 2026, thang: 11 }), thangHienTai: () => ({ nam: 2026, thang: 11 }), thangTruoc: (t) => t
};
const THAY = { '../db': dbGia, '../middleware/auth': authGia, '../utils/bangLuongTuDong': utilGia };
const gocLoad = Module._load;
Module._load = function (ten) { if (Object.prototype.hasOwnProperty.call(THAY, ten)) return THAY[ten]; return gocLoad.apply(this, arguments); };
const napMoi = (duong) => { delete require.cache[duong]; return require(duong); };
const layHandler = (router, method, duong) => { const l = (router.stack || []).find(x => x.route && x.route.path === duong && x.route.methods[method]); return l && l.route.stack[l.route.stack.length - 1].handle; };
const goi = async (h, req) => {
  const res = { code: 200, body: null, status(c) { res.code = c; return res; }, json(o) { res.body = o; return res; } };
  let loiNext = null;
  await h(Object.assign({ body: {}, query: {}, params: {}, session: { user: { userId: 7, hoTen: 'Kế toán A' } } }, req), res, (e) => { loiNext = e; });
  return { code: res.code, body: res.body, loiNext };
};
const imLang = async (fn) => { const ce = console.error, cw = console.warn, cl = console.log; console.error = () => {}; console.warn = () => {}; console.log = () => {}; try { return await fn(); } finally { console.error = ce; console.warn = cw; console.log = cl; } };
const merges = () => nhatKy.filter(x => /MERGE ChamCongNgay AS t/.test(x.q));

(async () => {
  /* ============================================================================================ */
  console.log('\n=== 2. utils/luongCongNhat.js — ham thuan v9.55 ===');
  const L = napMoi(path.join(GOC, 'backend', 'utils', 'luongCongNhat.js'));
  const BAC = [{ SoCong: 30, TienThuong: 50000 }, { SoCong: 28, TienThuong: 300000 }];   // thu tu bat ky, vi du cua Nguyen
  kiem('bac cao nhat, moi bac la so TONG (anh chot): 27 cong -> 0; 28 -> 300.000; 29,5 -> 300.000; 30 -> 50.000 (so cua bac 30)',
    L.thuongChuyenCanBac(BAC, 27) === 0 && L.thuongChuyenCanBac(BAC, 28) === 300000 && L.thuongChuyenCanBac(BAC, 29.5) === 300000 && L.thuongChuyenCanBac(BAC, 30) === 50000 && L.thuongChuyenCanBac(BAC, 31) === 50000);
  kiem('khoa thuong (soCong/tienThuong), dong rac (cong 0 / null), rong -> 0, 28 cong dung mep (28 >= 28)',
    L.thuongChuyenCanBac([{ soCong: 26, tienThuong: 100000 }, { soCong: 0, tienThuong: 999 }, null], 26) === 100000 && L.thuongChuyenCanBac([], 30) === 0 && L.thuongChuyenCanBac(null, 30) === 0
    && L.thuongChuyenCanBac([{ SoCong: 28, TienThuong: 300000 }], 27.999) === 0);
  const ds = L.dsNgayLamViec('2026-11-09', '2026-11-15', ['2026-11-11']);
  kiem('dsNgayLamViec T2 09/11 -> CN 15/11, le 11/11 -> 5 ngay (bo CN + le)', JSON.stringify(ds) === JSON.stringify(['2026-11-09', '2026-11-10', '2026-11-12', '2026-11-13', '2026-11-14']), JSON.stringify(ds));
  kiem('Set le cung duoc; ngay rac -> []; mot ngay -> 1; qua 400 ngay bi chan', L.dsNgayLamViec('2026-11-14', '2026-11-14', new Set()).length === 1 && L.dsNgayLamViec('rac', '2026-11-14').length === 0 && L.dsNgayLamViec('2020-01-01', '2026-01-01', []).length <= 400);
  const coDong = ['2026-11-03', '2026-11-04', '2026-11-06', '2026-11-07', '2026-11-09', '2026-11-10', '2026-11-12', '2026-11-13'];
  kiem('demKhongPhep T11/2026, hom nay 14/11, vao lam 03/11, le 11/11, thieu 05 va 14 -> 2',
    L.demKhongPhep({ nam: 2026, thang: 11, homNay: '2026-11-14', ngayVao: '2026-11-03', ngayLe: new Set(['2026-11-11']), dsNgayCoDong: coDong }) === 2);
  kiem('v9.58 dsNgayKhongPhep liet ke DUNG hai ngay 05/11 + 14/11 (khong co CN 08/11, khong co le 11/11)',
    JSON.stringify(L.dsNgayKhongPhep({ nam: 2026, thang: 11, homNay: '2026-11-14', ngayVao: '2026-11-03', ngayLe: new Set(['2026-11-11']), dsNgayCoDong: coDong })) === '["2026-11-05","2026-11-14"]');
  kiem('🔴 CHU NHAT khong bao gio bi dem: nguoi KHONG co dong nao ca thang 11 (toi 14/11) -> 12 ngay, khong ngay nao la CN',
    (() => { const ds = L.dsNgayKhongPhep({ nam: 2026, thang: 11, homNay: '2026-11-14', dsNgayCoDong: [] }); return ds.length === 12 && ds.every(s => new Date(s + 'T00:00:00Z').getUTCDay() !== 0) && !ds.includes('2026-11-01') && !ds.includes('2026-11-08'); })());
  kiem('khong co ngay vao -> tinh tu dau thang (them 02/11 T2 -> 3); 01/11 la CN khong tinh',
    L.demKhongPhep({ nam: 2026, thang: 11, homNay: '2026-11-14', ngayVao: null, ngayLe: new Set(['2026-11-11']), dsNgayCoDong: coDong }) === 3);
  kiem('thang tuong lai (hom nay truoc dau thang) -> 0; thang cu (hom nay sau cuoi thang) -> dem het thang',
    L.demKhongPhep({ nam: 2026, thang: 12, homNay: '2026-11-14', dsNgayCoDong: [] }) === 0
    && L.demKhongPhep({ nam: 2026, thang: 10, homNay: '2026-11-14', dsNgayCoDong: [] }) === 27);   // T10/2026: 31 ngay - 4 CN = 27
  kiem('dong P / KL / TS / TN / LT deu la "co dong" (khong phai khong phep); thang sai -> 0',
    L.demKhongPhep({ nam: 2026, thang: 11, homNay: '2026-11-04', ngayVao: '2026-11-02', dsNgayCoDong: ['2026-11-02', '2026-11-03', '2026-11-04'] }) === 0 && L.demKhongPhep({ nam: 0, thang: 11 }) === 0);
  const g = L.gomChamCong([{ ngay: '2026-11-03', maCham: 'TN', soCong: 0 }, { ngay: '2026-11-04', maCham: 'x', soCong: 1 }, { ngay: '2026-11-05', maCham: 'P', soCong: 0 }], null, '08:00', 5);
  kiem('gomChamCong: TN (tai nan) = khong cong, khong phep; x = 1 cong; P = 1 phep', g.congChinhThuc === 1 && g.soPhep === 1 && g.congThuViec === 0);
  const CFG = { GioChuanNgay: 8, HsTangCaThuong: 1.5, LamTronThucLinh: 1000 };
  const nguoi = { KieuLuong: 'Ngay', DonGiaNgay: 300000, KieuThuong: 'ChuyenCan', PhuCapChuyenCan: 500000, bacChuyenCan: BAC, congChinhThuc: 28, soKhongPhep: 2 };
  const c1 = L.tinhLuongV945(nguoi, CFG, 26, []);
  kiem("tinhLuongV945 kieu 'ChuyenCan': 28 cong -> thuong 300.000; phu cap chuyen can CO DINH bi BO QUA (du du cong, khong phep, khong muon); soKhongPhep chep ra",
    c1.thuong === 300000 && c1.chuyenCan === 0 && c1.kieuThuong === 'ChuyenCan' && c1.soKhongPhep === 2 && c1.thucLinh === 300000 * 28 + 300000, JSON.stringify({ thuong: c1.thuong, cc: c1.chuyenCan, tl: c1.thucLinh }));
  const c2 = L.tinhLuongV945(Object.assign({}, nguoi, { congChinhThuc: 27, soPhep: 1 }), CFG, 26, []);
  kiem('…27 cong + 1 phep -> khong dat bac 28 -> thuong 0 (phep KHONG tinh vao cong xet bac)', c2.thuong === 0 && c2.chuyenCan === 0);
  const c3 = L.tinhLuongV945(Object.assign({}, nguoi, { KieuThuong: null, soNgayMuon: 0 }), CFG, 26, []);
  kiem('kieu thuong Khong -> phu cap chuyen can co dinh VAN tinh nhu v9.45 (28 >= 26, khong phep, khong muon) = 500.000', c3.chuyenCan === 500000 && c3.thuong === 0);
  const c4 = L.tinhLuongV945(Object.assign({}, nguoi, { congChinhThuc: 29, soNgayMuon: 3 }), CFG, 26, []);
  kiem('bac thang KHONG xet di muon: 29 cong, muon 3 ngay -> van 300.000', c4.thuong === 300000);

  /* ============================================================================================ */
  console.log('\n=== 3. utils/nghiPhep.js THAT — CSDL gia ===');
  const NP = napMoi(path.join(GOC, 'backend', 'utils', 'nghiPhep.js'));
  kiem("dsThangCua('2026-11-28','2027-01-03') = 11/2026, 12/2026, 1/2027", JSON.stringify(NP.dsThangCua('2026-11-28', '2027-01-03')) === JSON.stringify([{ nam: 2026, thang: 11 }, { nam: 2026, thang: 12 }, { nam: 2027, thang: 1 }]));
  kiem("cuoiThangCua(2026, 2) = '2026-02-28'; (2028, 2) = '2028-02-29'", NP.cuoiThangCua(2026, 2) === '2026-02-28' && NP.cuoiThangCua(2028, 2) === '2028-02-29');
  GIA.bang.delete('NgayLeChung');
  let kq = await NP.dongBoNgayLe(poolGia, ['2026-09-02', 'rac', '2026-09-02']);
  kiem('chua co bang NgayLeChung (chua migration) -> dung o cu (loc rac, khong trung), coBang=false', JSON.stringify(kq.ds) === '["2026-09-02"]' && kq.coBang === false && (await NP.docNgayLe(poolGia)).size === 0);
  GIA.bang.add('NgayLeChung'); GIA.ngayLe = []; nhatKy.length = 0;
  kq = await NP.dongBoNgayLe(poolGia, ['2026-09-02', '2027-01-01']);
  kiem('bang TRONG + o cu co 2 ngay -> chep 2 ngay sang bang (mot lan), tra danh sach cua BANG', kq.daChep === 2 && GIA.ngayLe.length === 2 && JSON.stringify(kq.ds) === '["2026-09-02","2027-01-01"]');
  kq = await NP.dongBoNgayLe(poolGia, ['2026-09-02', '2027-01-01', '2026-04-30']);
  kiem('bang DA co -> KHONG chep nua, o cu khong "tra lai" ngay (30/04 trong o cu khong vao danh sach)', kq.daChep === 0 && !kq.ds.includes('2026-04-30') && GIA.ngayLe.length === 2);
  kiem('docNgayLe(nam) loc theo nam', (await NP.docNgayLe(poolGia, 2027)).has('2027-01-01') && !(await NP.docNgayLe(poolGia, 2027)).has('2026-09-02'));
  nhatKy.length = 0;
  let n = await NP.apDungPhieuNghi(poolGia, { PhieuNghiID: 1, SoPhieu: 'NP260001', NhanVienID: 3, Loai: 'P', TuNgay: '2026-11-09', DenNgay: '2026-11-15' }, new Set(['2026-11-11']));
  let m = merges();
  kiem('apDungPhieuNghi: 5 ngay lam viec (bo CN 15/11 + le 11/11), ma P, so cong 0, nguon PhieuNghi; MAY/ThuCong khong bi ghi de',
    n === 5 && m.length === 5 && m.every(x => x.inputs.ma === 'P' && x.inputs.nv === 3 && /WHEN MATCHED AND t\.Nguon = N'PhieuNghi'/.test(x.q) && /SoCong=0/.test(x.q) && /N'PhieuNghi'\);/.test(x.q))
    && m.map(x => x.inputs.ngay).join(',') === '2026-11-09,2026-11-10,2026-11-12,2026-11-13,2026-11-14', JSON.stringify(m.map(x => x.inputs.ngay)));
  kiem('ghi chu dong = "Phiếu NP260001: Nghỉ phép"', m[0].inputs.gc === 'Phiếu NP260001: Nghỉ phép');
  nhatKy.length = 0;
  n = await NP.apDungPhieuNghi(poolGia, { PhieuNghiID: 2, NhanVienID: 3, Loai: 'TS', TuNgay: '2026-10-20', DenNgay: '2027-01-20' }, new Set(), '2026-11-01', '2026-11-30');
  kiem('phieu dai nhieu thang, chan trong thang 11 -> 25 ngay lam viec T11/2026, ma TS', n === 25 && merges().every(x => x.inputs.ma === 'TS' && x.inputs.ngay.startsWith('2026-11')));
  kiem('loai la / ngay sai -> 0, khong MERGE', (await NP.apDungPhieuNghi(poolGia, { NhanVienID: 3, Loai: 'XX', TuNgay: '2026-11-01', DenNgay: '2026-11-02' }, new Set())) === 0
    && (await NP.apDungPhieuNghi(poolGia, { NhanVienID: 3, Loai: 'P', TuNgay: '2026-11-05', DenNgay: '2026-11-01' }, new Set())) === 0);
  nhatKy.length = 0;
  await NP.goDongPhieuNghi(poolGia, 3, '2026-11-09', '2026-11-15');
  kiem('goDongPhieuNghi: DELETE chi dong Nguon=PhieuNghi cua nguoi do trong khoang', nhatKy.some(x => /DELETE FROM ChamCongNgay WHERE NhanVienID=@nv AND Ngay BETWEEN @tu AND @den AND Nguon = N'PhieuNghi'/.test(x.q) && x.inputs.nv === 3));
  GIA.phieu = [{ PhieuNghiID: 1, SoPhieu: 'NP260001', NhanVienID: 3, Loai: 'P', TuNgay: '2026-11-09', DenNgay: '2026-11-10' }, { PhieuNghiID: 2, SoPhieu: 'NP260002', NhanVienID: 4, Loai: 'KL', TuNgay: '2026-10-29', DenNgay: '2026-11-03' }, { PhieuNghiID: 3, SoPhieu: 'NP260003', NhanVienID: 5, Loai: 'TN', TuNgay: '2026-12-01', DenNgay: '2026-12-02' }];
  nhatKy.length = 0;
  kq = await NP.apDungPhieuNghiThang(poolGia, 2026, 11);
  kiem('apDungPhieuNghiThang T11: 2 phieu cham thang (bo phieu T12); phieu KL 29/10-03/11 chi ghi 02/11 + 03/11 (02/11 T2)',
    kq.phieu === 2 && kq.ngay === 4 && merges().filter(x => x.inputs.nv === 4).map(x => x.inputs.ngay).join(',') === '2026-11-02,2026-11-03', JSON.stringify(kq));
  GIA.bang.delete('PhieuNghi');
  kiem('chua co bang PhieuNghi -> {0,0}, khong no', JSON.stringify(await NP.apDungPhieuNghiThang(poolGia, 2026, 11)) === '{"phieu":0,"ngay":0}');
  GIA.bang.add('PhieuNghi');
  GIA.phieu = [{ SoPhieu: 'NP260007' }, { SoPhieu: 'NP250099' }, { SoPhieu: 'rac' }];
  const soMoi = await NP.sinhSoPhieuNghi(poolGia);
  const yy = String(new Date().getFullYear()).slice(-2);
  kiem('sinhSoPhieuNghi: NP<yy><4 so>, lay max cua nam hien tai + 1', new RegExp('^NP' + yy + '\\d{4}$').test(soMoi) && (yy === '26' ? soMoi === 'NP260008' : true), soMoi);

  /* ============================================================================================ */
  console.log('\n=== 4. routes/payroll.js THAT — ngay le, phieu nghi, tong hop, tinh luong ===');
  let payroll = null;
  try { payroll = napMoi(path.join(GOC, 'backend', 'routes', 'payroll.js')); } catch (e) { sai++; console.log('  ❌ khong nap duoc routes/payroll.js: ' + e.message); }
  const nghiPhepThat = require(path.join(GOC, 'backend', 'utils', 'nghiPhep.js'));
  nghiPhepThat.homNayVN = () => '2026-11-14';   // payroll goi qua doi tuong module -> ghim "hom nay" de dem khong phep on dinh
  if (payroll) {
    const hLeGet = layHandler(payroll, 'get', '/chamcong/ngayle'), hLePost = layHandler(payroll, 'post', '/chamcong/ngayle'), hLeDel = layHandler(payroll, 'delete', '/chamcong/ngayle/:id');
    const hPNGet = layHandler(payroll, 'get', '/chamcong/phieunghi'), hPNPost = layHandler(payroll, 'post', '/chamcong/phieunghi'), hPNPut = layHandler(payroll, 'put', '/chamcong/phieunghi/:id'), hPNDel = layHandler(payroll, 'delete', '/chamcong/phieunghi/:id');
    kiem('co 7 route moi', [hLeGet, hLePost, hLeDel, hPNGet, hPNPost, hPNPut, hPNDel].every(h => typeof h === 'function'));
    /* v9.74: ngayChuyenCanThang thuan — van phong nghi CN. T11/2026: 30 ngay, 5 CN (1, 8, 15, 22, 29). */
    {
      const N = payroll.ngayChuyenCanThang;
      kiem('v9.74 payroll.ngayChuyenCanThang duoc export', typeof N === 'function');
      if (typeof N === 'function') {
        const cc = []; for (let d = 2; d <= 30; d++) { const s = '2026-11-' + String(d).padStart(2, '0'); if (![1, 8, 15, 22, 29].includes(d)) cc.push({ ngay: s, soCong: 1 }); }   // di du moi ngay thuong
        const sx = N(2026, 11, new Set(), cc, true), vp = N(2026, 11, new Set(), cc, false);
        kiem('v9.74 khoi san xuat (tinhCN): 30 ngay, co mat 25 => nghi 5 (5 CN bi tinh la nghi)', sx.soNgayThang === 30 && sx.soNgayCoMat === 25 && sx.soNgayThang - sx.soNgayLeThang - sx.soNgayCoMat === 5, JSON.stringify(sx));
        kiem('v9.74 van phong (khong CN): 25 ngay, co mat 25 => nghi 0 => dat bac 500k', vp.soNgayThang === 25 && vp.soNgayCoMat === 25 && vp.soNgayThang - vp.soNgayLeThang - vp.soNgayCoMat === 0, JSON.stringify(vp));
        const vp2 = N(2026, 11, new Set(), cc.concat([{ ngay: '2026-11-08', soCong: 1 }]).filter(r => r.ngay !== '2026-11-10'), false);
        kiem('v9.74 van phong: nghi thu Ba 10/11, di lam CN 8/11 => CN KHONG bu => nghi 1', vp2.soNgayThang - vp2.soNgayLeThang - vp2.soNgayCoMat === 1, JSON.stringify(vp2));
        const le = N(2026, 11, new Set(['2026-11-08', '2026-11-10']), cc.filter(r => r.ngay !== '2026-11-10'), false);
        kiem('v9.74 van phong: le roi vao CN (8/11) KHONG tru hai lan; le thu Ba (10/11) tru => nghi 0', le.soNgayLeThang === 1 && le.soNgayThang - le.soNgayLeThang - le.soNgayCoMat === 0, JSON.stringify(le));
        const leSX = N(2026, 11, new Set(['2026-11-08', '2026-11-10']), cc.filter(r => r.ngay !== '2026-11-10'), true);
        kiem('v9.74 san xuat: ca 2 le deu tru (giu luat v9.72) => 30 - 2 - 24 = 4', leSX.soNgayLeThang === 2 && leSX.soNgayCoMat === 24 && leSX.soNgayThang - leSX.soNgayLeThang - leSX.soNgayCoMat === 4, JSON.stringify(leSX));
      }
    }
    const viTri = (p) => (payroll.stack || []).findIndex(x => x.route && x.route.path === p);
    kiem('🔴 route chu /chamcong/ngayle + /chamcong/phieunghi dung TRUOC /chamcong/:nhanVienId (khong thi bi nuot)', viTri('/chamcong/ngayle') < viTri('/chamcong/:nhanVienId') && viTri('/chamcong/phieunghi') < viTri('/chamcong/:nhanVienId'));

    GIA.ngayLe = []; GIA.cauHinh.set('CHAM_CONG', JSON.stringify({ gioVao: '08:00', ngayLe: ['2026-09-02', '2026-04-30'] }));
    let g = await goi(hLeGet, { query: { nam: '2026' } });
    kiem('GET /chamcong/ngayle lan dau: chep 2 ngay o cu sang bang, tra theo nam', g.code === 200 && g.body.data.rows.length === 2 && g.body.data.rows[0].Ngay === '2026-04-30' && GIA.ngayLe.length === 2, JSON.stringify(g.body));
    nhatKyDau.length = 0;
    g = await goi(hLePost, { body: { ngay: '2026-09-02', tenLe: 'Quốc khánh' } });
    kiem('POST ngay le trung -> 409', g.code === 409);
    g = await goi(hLePost, { body: { ngay: '30/04/2026' } });
    kiem('POST ngay sai dang -> 400', g.code === 400);
    g = await goi(hLePost, { body: { ngay: '2027-01-01', tenLe: 'Tết Dương lịch' } });
    kiem('POST ngay le moi -> them vao bang, danh dau bang luong thang do (v9.53)', g.code === 200 && GIA.ngayLe.some(x => x.Ngay === '2027-01-01' && x.TenLe === 'Tết Dương lịch')
      && nhatKyDau.some(x => x.loai === 'danhDauTheoNgay' && x.ngay === '2027-01-01' && /Thêm ngày lễ 01\/01\/2027/.test(x.lyDo)), JSON.stringify(nhatKyDau));
    const idXoa = GIA.ngayLe.find(x => x.Ngay === '2027-01-01').ID; nhatKyDau.length = 0;
    g = await goi(hLeDel, { params: { id: String(idXoa) } });
    kiem('DELETE ngay le -> bo khoi bang + danh dau; id la -> 404', g.code === 200 && !GIA.ngayLe.some(x => x.Ngay === '2027-01-01') && nhatKyDau.some(x => x.loai === 'danhDauTheoNgay' && x.ngay === '2027-01-01')
      && (await goi(hLeDel, { params: { id: '99999' } })).code === 404);
    GIA.bang.delete('NgayLeChung');
    g = await goi(hLeGet, { query: {} });
    kiem('chua migration -> GET tra chuaMigration, POST 400 noi ro', g.body.data.chuaMigration === true && (await goi(hLePost, { body: { ngay: '2027-01-01' } })).code === 400);
    GIA.bang.add('NgayLeChung');

    /* phieu nghi */
    GIA.phieu = []; nhatKy.length = 0; nhatKyDau.length = 0;
    const than = { nhanVienId: 3, loai: 'P', tuNgay: '2026-11-09', denNgay: '2026-11-15', lyDo: 'Việc gia đình' };
    g = await goi(hPNPost, { body: Object.assign({}, than, { nhanVienId: '' }) });
    kiem('POST phieu: thieu nhan vien -> 400', g.code === 400);
    kiem('loai la -> 400; den < tu -> 400; nhan vien khong co -> 400; toan CN -> 400', (await goi(hPNPost, { body: Object.assign({}, than, { loai: 'XX' }) })).code === 400
      && (await goi(hPNPost, { body: Object.assign({}, than, { denNgay: '2026-11-01' }) })).code === 400
      && (await goi(hPNPost, { body: Object.assign({}, than, { nhanVienId: 99 }) })).code === 400
      && (await goi(hPNPost, { body: Object.assign({}, than, { tuNgay: '2026-11-15', denNgay: '2026-11-15' }) })).code === 400);
    nhatKy.length = 0; nhatKyDau.length = 0;
    g = await goi(hPNPost, { body: than });
    const p1 = GIA.phieu[0];
    kiem('POST phieu P 09-15/11 (le 02/09 khong lien quan): luu SoNgay 6 ngay lam viec, so phieu NP, nguoi duyet lay tu hop dong (Quản lý trực tiếp)',
      g.code === 200 && p1 && p1.SoNgay === 6 && /^NP\d{6}$/.test(p1.SoPhieu) && p1.NguoiDuyet === 'Lê Trưởng' && p1.Loai === 'P' && g.body.data.SoNgay === 6, JSON.stringify({ g: g.body, p1 }));
    kiem('…roi ghi 6 ngay vao ChamCongNgay (MERGE, ma P) + danh dau bang luong T11 voi ly do co so phieu + ten',
      merges().length === 6 && merges().every(x => x.inputs.ma === 'P' && x.inputs.nv === 3)
      && nhatKyDau.some(x => x.loai === 'danhDauNhieu' && x.ds.length === 1 && x.ds[0].thang === 11 && /Nghỉ phép NP\d+ — Trần C/.test(x.lyDo)), JSON.stringify(nhatKyDau));
    nhatKy.length = 0;
    g = await goi(hPNPost, { body: { nhanVienId: 3, loai: 'TS', tuNgay: '2026-11-25', denNgay: '2027-02-10', nguoiDuyet: 'Chị Hoa' } });
    const p2 = GIA.phieu[1];
    kiem('POST thai san 25/11 -> 10/02 (nhieu thang): nguoi duyet go tay giu nguyen; ap lai 3 thang; danh dau 3 thang',
      g.code === 200 && p2.NguoiDuyet === 'Chị Hoa' && p2.Loai === 'TS' && nhatKyDau.some(x => x.loai === 'danhDauNhieu' && x.ds.length === 3));
    g = await goi(hPNGet, { query: { nam: '2026', thang: '11' } });
    kiem('GET phieu thang 11 -> 2 phieu (ca phieu TS dai); thang 1/2027 -> chi phieu TS; theo nhanVienId', g.body.data.rows.length === 2
      && (await goi(hPNGet, { query: { nam: '2027', thang: '1' } })).body.data.rows.length === 1 && (await goi(hPNGet, { query: { nhanVienId: '3' } })).body.data.rows.length === 2 && g.body.data.loai.TN === 'Nghỉ tai nạn');
    nhatKy.length = 0; nhatKyDau.length = 0;
    g = await goi(hPNPut, { params: { id: String(p1.PhieuNghiID) }, body: { nhanVienId: 3, loai: 'KL', tuNgay: '2026-12-01', denNgay: '2026-12-02', lyDo: 'đổi' } });
    kiem('PUT doi phieu P T11 -> KL T12: go dong PhieuNghi khoang CU, ap lai T11 + T12, danh dau ca hai thang', g.code === 200 && p1.Loai === 'KL' && p1.TuNgay === '2026-12-01' && p1.SoNgay === 2
      && nhatKy.some(x => /DELETE FROM ChamCongNgay WHERE NhanVienID=@nv AND Ngay BETWEEN @tu AND @den AND Nguon = N'PhieuNghi'/.test(x.q) && x.inputs.nv === 3)
      && nhatKyDau.some(x => x.loai === 'danhDauNhieu' && x.ds.some(t => t.thang === 11) && x.ds.some(t => t.thang === 12)), JSON.stringify(nhatKyDau));
    kiem('PUT id la -> 404', (await goi(hPNPut, { params: { id: '99999' }, body: than })).code === 404);
    nhatKy.length = 0; nhatKyDau.length = 0;
    g = await goi(hPNDel, { params: { id: String(p1.PhieuNghiID) } });
    kiem('DELETE phieu -> bo khoi bang, go dong, ap lai thang, danh dau voi ten nguoi', g.code === 200 && !GIA.phieu.some(x => x.PhieuNghiID === p1.PhieuNghiID)
      && nhatKy.some(x => /Nguon = N'PhieuNghi'/.test(x.q) && /DELETE FROM ChamCongNgay/.test(x.q)) && nhatKyDau.some(x => /Xóa nghỉ không lương NP\d+ — Trần C/.test(x.lyDo)), JSON.stringify(nhatKyDau));

    /* tong hop tu may: MAY thang PhieuNghi, ap lai phieu */
    GIA.phieu = [{ PhieuNghiID: 9, SoPhieu: 'NP260009', NhanVienID: 3, Loai: 'P', TuNgay: '2026-11-16', DenNgay: '2026-11-17' }];
    GIA.agg = [{ NhanVienID: 3, Ngay: new Date(Date.UTC(2026, 10, 16)), GioVao: '08:00', GioRa: '17:30', SoLan: 2 }];
    nhatKy.length = 0; nhatKyDau.length = 0;
    const th = await payroll.tongHopChamCongThang(poolGia, 2026, 11);
    const mMay = merges().filter(x => /Nguon = N'May'/.test(x.q)), mPhieu = merges().filter(x => /N'PhieuNghi'\);/.test(x.q));
    kiem('tong hop: MERGE may ghi de ca dong PhieuNghi (t.Nguon IN (May, PhieuNghi)) va dat Nguon = May', mMay.length === 1 && /t\.Nguon IN \(N'May', N'PhieuNghi'\)/.test(mMay[0].q));
    kiem('…roi ap lai phieu T11 (2 ngay 16-17/11, ma P) va danh dau bang luong; ket qua co phieuNghi', mPhieu.length === 2 && th.phieuNghi.phieu === 1 && th.phieuNghi.ngay === 2 && th.affected === 1
      && nhatKyDau.some(x => x.loai === 'danhDau' && x.thang === 11), JSON.stringify(th));
    kiem('thu tu: MERGE may TRUOC, MERGE phieu SAU (may thang)', nhatKy.findIndex(x => /Nguon = N'May'/.test(x.q)) < nhatKy.findIndex(x => /N'PhieuNghi'\);/.test(x.q)));

    /* tinh luong: chuyen can bac thang + khong phep */
    GIA.header = { BangLuongID: 7, TrangThai: 'Nháp' };
    GIA.emps = [{ NhanVienID: 3, MaNhanVien: 'NV003', HoTen: 'Trần C', SoNguoiPhuThuoc: 0, NgayVao: '2026-11-03', HopDongID: 11, LuongCoBan: 0, DonGiaNgay: 300000, KieuLuong: 'Ngay', MucDongBH: 0, KieuThuong: 'ChuyenCan', PhuCapChuyenCan: 500000, DenNgay: null, NgayHetThuViec: null }];
    /* Bac 20 / 22 cong (T11/2026 toi da 25 ngay lam viec, 28 cong khong toi duoc voi 1 cong/ngay). */
    GIA.bac = [{ HopDongID: 11, SoCong: 22, TienThuong: 350000 }, { HopDongID: 11, SoCong: 20, TienThuong: 300000 }];
    GIA.cc = [];
    for (let d = 3; d <= 30; d++) { const s = '2026-11-' + String(d).padStart(2, '0'); if (new Date(s + 'T00:00:00Z').getUTCDay() === 0) continue; GIA.cc.push({ NhanVienID: 3, ngay: s, maCham: 'x', soCong: 1, gioVao: '08:00', gioOT: 0 }); }
    GIA.cc = GIA.cc.filter(x => x.ngay !== '2026-11-05' && x.ngay !== '2026-11-12' && x.ngay !== '2026-11-11');   // 05 + 12: khong phep; 11: le
    GIA.cc.push({ NhanVienID: 3, ngay: '2026-11-19', maCham: 'TN', soCong: 0, gioVao: null, gioOT: 0 });   // tai nan: co dong, khong cong
    GIA.ngayLe = [{ ID: 1, Ngay: '2026-11-11', TenLe: 'Thử' }]; GIA.cauHinh.set('CHAM_CONG', JSON.stringify({ gioVao: '08:00', ngayLe: [] }));
    nhatKy.length = 0;
    const kqTinh = await payroll.tinhBangLuongThang(poolGia, 2026, 11, 7);
    const ins = nhatKy.find(x => /INSERT INTO BangLuongChiTiet/.test(x.q));
    const congX = GIA.cc.filter(x => x.maCham === 'x').length;   // 3..30 = 28 ngay - 4 CN - 3 ngay bo = 21
    kiem(`tinh luong kieu ChuyenCan: ${congX} cong -> dat bac 20 (300.000), chua toi bac 22; ChuyenCan co dinh = 0 du khai 500.000; KieuThuong luu 'ChuyenCan'`,
      congX === 21 && ins && ins.inputs.Thuong === 300000 && ins.inputs.ChuyenCan === 0 && ins.inputs.KieuThuong === 'ChuyenCan', JSON.stringify({ congX, thuong: ins && ins.inputs.Thuong, cc: ins && ins.inputs.ChuyenCan }));
    kiem('cot SoKhongPhep = 2 (05/11 + 12/11; 11/11 la le, 19/11 TN co dong, tu ngay vao 03/11 toi hom nay 14/11)', ins && ins.inputs.SoKhongPhep === 2, JSON.stringify(ins && ins.inputs.SoKhongPhep));
    kiem('canh bao: khai phu cap chuyen can co dinh + bac thang -> noi ro chi tinh bac thang', kqTinh.canhBao.some(x => /chỉ tính BẬC THANG/.test(x)));
    GIA.cc.push({ NhanVienID: 3, ngay: '2026-11-05', maCham: 'x', soCong: 1, gioVao: '08:00', gioOT: 0 });   // 22 cong -> bac 22
    nhatKy.length = 0;
    await payroll.tinhBangLuongThang(poolGia, 2026, 11, 7);
    const ins22 = nhatKy.find(x => /INSERT INTO BangLuongChiTiet/.test(x.q));
    kiem('22 cong -> bac 22 = 350.000 (chi bac cao nhat, khong cong don); khong phep con 1', ins22.inputs.Thuong === 350000 && ins22.inputs.SoKhongPhep === 1);
    GIA.bac = []; nhatKy.length = 0;
    const kq2 = await payroll.tinhBangLuongThang(poolGia, 2026, 11, 7);
    kiem('chua khai bac nao -> thuong 0 + canh bao', nhatKy.find(x => /INSERT INTO BangLuongChiTiet/.test(x.q)).inputs.Thuong === 0 && kq2.canhBao.some(x => /chưa khai bậc nào/.test(x)));
  }

  /* ============================================================================================ */
  console.log('\n=== 5. routes/hrm.js THAT — bac chuyen can tren hop dong ===');
  let hrm = null;
  try { hrm = await imLang(async () => napMoi(path.join(GOC, 'backend', 'routes', 'hrm.js'))); } catch (e) { sai++; console.log('  ❌ khong nap duoc routes/hrm.js: ' + e.message); }
  if (hrm) {
    const hPost = layHandler(hrm, 'post', '/hopdong'), hGet = layHandler(hrm, 'get', '/hopdong');
    GIA.bac = []; nhatKy.length = 0;
    let g = await goi(hPost, { body: { nhanVienId: 3, soHopDong: '01/2026', tuNgay: '2026-11-01', kieuLuong: 'Ngay', kieuThuong: 'ChuyenCan', bacChuyenCan: [{ soCong: 30, tienThuong: 350000 }, { soCong: 28, tienThuong: 300000 }, { soCong: 28, tienThuong: 999 }, { soCong: 0, tienThuong: 5 }] } });
    const insHD = nhatKy.find(x => /INSERT INTO HopDongLaoDong/.test(x.q));
    kiem("POST hop dong kieu ChuyenCan: KieuThuong binh 'ChuyenCan'; luu bac sap theo cong, bo trung (28 giu dong dau) va dong rac -> 2 bac",
      g.code === 200 && insHD && insHD.inputs.KieuThuong === 'ChuyenCan' && GIA.bac.length === 2 && GIA.bac[0].SoCong === 28 && GIA.bac[0].TienThuong === 300000 && GIA.bac[1].SoCong === 30 && GIA.bac[1].ThuTu === 1, JSON.stringify(GIA.bac));
    nhatKy.length = 0;
    g = await goi(hPost, { body: { nhanVienId: 3, kieuLuong: 'Ngay', kieuThuong: 'KPI' } });
    kiem('POST khong gui bacChuyenCan -> khong dong vao bang bac (giu nguyen)', g.code === 200 && !nhatKy.some(x => /DELETE FROM HopDongChuyenCan/.test(x.q)));
    GIA.hopDongRows = [{ HopDongID: 55, NhanVienID: 3, HoTen: 'Trần C', KieuThuong: 'ChuyenCan' }];
    g = await goi(hGet, { query: {} });
    kiem('GET /hopdong gan bacChuyenCan cho tung hop dong', g.code === 200 && Array.isArray(g.body.data[0].bacChuyenCan) && g.body.data[0].bacChuyenCan.length === 2 && Array.isArray(g.body.data[0].sanPham));
  }

  /* ============================================================================================ */
  console.log('\n=== 6. module.hrm.js — dieu khoan thuong ChuyenCan (vm, nhu bo kiem v9.48) ===');
  const catTheoMoc = (s, tu, den) => { const i = s.indexOf(tu); if (i < 0) return ''; const j = s.indexOf(den, i); return j < 0 ? '' : s.slice(i, j); };
  const dong = (s, bat) => { const mm = new RegExp('^' + bat + '.*$', 'm').exec(s); return mm ? mm[0] : ''; };
  const common = doc('frontend', 'js', 'common.js');
  /* v9.73: khối bắt đầu từ THU_TU_KIEU / tachKieu (đứng TRƯỚC kieuThuongCua) — cắt từ đó mới đủ hàm. */
  const kHam = catTheoMoc(fHrmFE, "  const THU_TU_KIEU = ['KPI', 'SanPham', 'ChuyenCan'];", '\n  function bienChoHopDong(');
  const kCh = [dong(fHrmFE, '  const ch = '), dong(fHrmFE, '  const chTien = '), dong(fHrmFE, '  const money = ')].join('\n');
  const kCommon = catTheoMoc(common, 'function escapeHtml(str) {', '\n\n') + '\n' + catTheoMoc(common, 'function fmtNumber(n) {', '\n\n');
  let F = null;
  try { const ctx = {}; vm.createContext(ctx); vm.runInContext(kCommon + '\n' + kCh + '\n' + kHam, ctx, { filename: 'dk_gia.js' }); F = { kieu: ctx.kieuThuongCua, dk: ctx.dieuKhoanThuong, nhan: ctx.nhanKieuThuong }; }
  catch (e) { sai++; console.log('  ❌ khong chay duoc khoi dieu khoan: ' + e.message); }
  if (F) {
    kiem("kieuThuongCua('ChuyenCan') = ChuyenCan; 'XYZ' van Khong", F.kieu({ KieuThuong: 'ChuyenCan' }) === 'ChuyenCan' && F.kieu({ KieuThuong: 'XYZ' }) === 'Khong');
    const cCC = F.dk({ KieuThuong: 'ChuyenCan', bacChuyenCan: [{ SoCong: 30, TienThuong: 350000 }, { SoCong: 28, TienThuong: 300000 }] });
    kiem('dieu khoan ChuyenCan: liet ke bac tang dan, noi "khong tinh ngay nghi phep" + "bac cao nhat", ket thuc dau cham',
      /đạt từ <b>28<\/b> công trở lên: <b>300\.000<\/b> đồng; đạt từ <b>30<\/b> công trở lên: <b>350\.000<\/b> đồng/.test(cCC) && /không tính ngày nghỉ phép/.test(cCC) && /bậc cao nhất/.test(cCC) && /\.$/.test(cCC), cCC);
    kiem('chua khai bac -> dau cham; khong in "undefined"', /theo bậc: \.{10,}\./.test(F.dk({ KieuThuong: 'ChuyenCan' })) && !/undefined/.test(F.dk({ KieuThuong: 'ChuyenCan', bacChuyenCan: [] })));
    kiem('nhanKieuThuong ChuyenCan + co phu cap co dinh -> canh bao bo qua', /^Chuyên cần bậc thang — từ 28 công: 300\.000 đ; từ 30 công: 350\.000 đ ⚠️ phụ cấp chuyên cần cố định 500\.000 đ bị bỏ qua$/.test(F.nhan({ KieuThuong: 'ChuyenCan', PhuCapChuyenCan: 500000, bacChuyenCan: [{ SoCong: 28, TienThuong: 300000 }, { SoCong: 30, TienThuong: 350000 }] })));
    kiem('cau KPI / SanPham / Khong KHONG doi (bo kiem v9.48 van xanh)', /Quỹ KPI tham chiếu tối đa là 8\.000\.000 đồng\/tháng tương ứng 100 điểm/.test(F.dk({ KieuThuong: 'KPI', QuyKPI: 8000000 })) && /Không áp dụng thưởng KPI hay thưởng theo sản phẩm cố định/.test(F.dk({})));
  }

  /* ============================================================================================ */
  console.log('\n=== 7. SO CHUOI (viet sau cung) ===');
  const boComment = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  kiem('migration_v892: 3 bang + cot SoKhongPhep + noi CHECK KieuThuong them ChuyenCan + CHECK Loai phieu', ['HopDongChuyenCan', 'NgayLeChung', 'PhieuNghi', 'SoKhongPhep', "N'ChuyenCan'", 'CK_PhieuNghi_Loai', 'DROP CONSTRAINT CK_HopDongLaoDong_KieuThuong'].every(k => mig.indexOf(k) > -1));
  kiem('payroll.js: require nghiPhep + demKhongPhep; MERGE tong hop ghi de PhieuNghi; ap lai phieu sau tong hop; SoKhongPhep do cot rieng', /const nghiPhep = require\('\.\.\/utils\/nghiPhep'\);/.test(fPR) && /demKhongPhep, dsNgayLamViec/.test(fPR)
    && /WHEN MATCHED AND t\.Nguon IN \(N'May', N'PhieuNghi'\) THEN UPDATE SET/.test(fPR) && /apDungPhieuNghiThang\(pool, nam, thang\)/.test(fPR) && /COL_LENGTH\('BangLuongChiTiet','SoKhongPhep'\)/.test(fPR));
  kiem('payroll.js: KPI tab chi KPI/SanPham; cau hinh cham cong GIU ngay le khi client khong gui; Excel co cot Khong phep theo ten', /hd\.KieuThuong LIKE N'%KPI%' OR hd\.KieuThuong LIKE N'%SanPham%'/.test(fPR) && /\(await getCauHinhChamCong\(pool\)\)\.ngayLe/.test(fPR) && /'Muộn', 'Không phép', 'Lương CB \/ Đơn giá ngày'/.test(fPR) && /trRow\[viTri\('Thực lĩnh'\)\] = tong/.test(fPR));
  kiem('hrm.js: luuBacChuyenCan + docBacChuyenCan, goi o POST/PUT/GET + ho so', /async function luuBacChuyenCan\(pool, hopDongId, ds\)/.test(fHRM) && (fHRM.match(/await luuBacChuyenCan\(/g) || []).length === 2 && (fHRM.match(/docBacChuyenCan\(pool, /g) || []).length >= 2);
  const codeFE = boComment(fFE);
  kiem('module.payroll.js: nut Lich nghi le o tab Cham cong + TAB RIENG nghiphep (v9.57) + ban in 2 chu ky + nut chuyen tab tu chi tiet nguoi',
    /id="btnNgayLe"/.test(codeFE) && !/id="btnPhieuNghi"/.test(codeFE) && /async function openLichNghiLe\(\)/.test(codeFE) && /key: 'nghiphep', label: 'Tạo giấy nghỉ phép \/ Nghỉ cá nhân'/.test(fFE)
    && /if \(activeTab === 'nghiphep'\) return renderNghiPhep\(\);/.test(codeFE) && /async function veNghiPhep\(host, opts\)/.test(codeFE)
    && /function buildPhieuNghiBody\(r\)/.test(codeFE) && /TRƯỞNG BỘ PHẬN/.test(codeFE) && /NGƯỜI XIN NGHỈ/.test(codeFE) && /GIẤY NGHỈ PHÉP/.test(fFE)
    && /id="btnPNcuaNV"/.test(codeFE) && /switchModule\('PAYROLL', 'nghiphep'\)/.test(codeFE) && /ModuleHRM\.congTy\(\)/.test(codeFE));
  kiem('v9.58: GET /bangluong gan ngayKhongPhep (ganNgayKhongPhep), man hinh liet ke ngay o tooltip + phieu luong; in giay nghi khong dau trang chung',
    /async function ganNgayKhongPhep\(pool, nam, thang, rows\)/.test(fPR) && /await ganNgayKhongPhep\(pool, nam, thang, data\.rows\)/.test(fPR)
    && /r\.ngayKhongPhep\.map\(ddmm\)/.test(fFE) && /buildPhieuNghiBody\(r\), \{ noLetterhead: true \}/.test(fFE));
  kiem('v9.57 payroll.js: 4 route phieu nghi gac chuc nang nghiphep; /nhanvien nhan chamcong HOAC nghiphep; migration co dong ChucNang',
    (fPR.match(/requireChucNang\('PAYROLL', 'nghiphep'\)/g) || []).length === 4 && /requireChucNangAny\('PAYROLL', \['chamcong', 'nghiphep'\], 'view'\)/.test(fPR)
    && /'PAYROLL', 'nghiphep', N'Tạo giấy nghỉ phép \/ Nghỉ cá nhân'/.test(mig));
  kiem('module.payroll.js: bang luong cot Khong phep (header + o + colspan 22 / tfoot 18), ban in nCot 18, phieu luong dong Khong phep, o cai dat khong con textarea ngay le',
    /<th title="v9\.55[^"]*">Không phép<\/th>/.test(fFE) && /r\.SoKhongPhep != null \? num\(r\.SoKhongPhep\) : ''/.test(fFE) && /colspan="22" class="empty-hint"/.test(fFE) && /<td colspan="18" style="text-align:right;">TỔNG<\/td>/.test(fFE)
    && /const nCot = 18 \+ \(coThue \? 1 : 0\)/.test(fFE) && /dong\('Ngày nghỉ không phép'/.test(fFE) && !/id="cc_ngayLe"/.test(codeFE) && /TN tai nạn/.test(fFE));
  /* v9.73: Kiểu thưởng = ô tích .f-kt (không còn <option>), payload theo coKT('…'). */
  kiem('module.hrm.js: o tich ChuyenCan + khung bac + payload bacChuyenCan + canh bao phu cap co dinh + congTy()', /class="f-kt" value="ChuyenCan"/.test(fHrmFE) && /id="ccKhung"/.test(fHrmFE) && /bacChuyenCan: coKT\('ChuyenCan'\) \? bacChuyenCan : \[\]/.test(fHrmFE)
    && /sẽ KHÔNG tính nữa — chỉ tính bậc thang/.test(fHrmFE) && /congTy: \(\) => Object\.assign\(\{\}, COMPANY\)/.test(fHrmFE) && /sanPham: coKT\('SanPham'\) \? sanPham : \[\]/.test(fHrmFE));
  if (F) {
    kiem('v9.73 kieuThuongCua: nhieu kieu -> chuoi chuan "KPI,SanPham" (thu tu co dinh, bo rac/trung); nhanKieuThuong noi " + "; dieuKhoanThuong noi 2 cau',
      F.kieu({ KieuThuong: 'SanPham, KPI,KPI,XYZ' }) === 'KPI,SanPham' && /^Theo KPI — .* \+ Theo sản phẩm — /.test(F.nhan({ KieuThuong: 'KPI,SanPham', QuyKPI: 1000000 }))
      && /Quỹ KPI tham chiếu/.test(F.dk({ KieuThuong: 'KPI,ChuyenCan', QuyKPI: 1000000 })) && /Thưởng chuyên cần theo số ngày/.test(F.dk({ KieuThuong: 'KPI,ChuyenCan', QuyKPI: 1000000 })));
  }
  kiem('v9.74 chuyen can khong tinh CN: migration_v900 cot ChuyenCanTinhCN; payroll SELECT cot (gac) + goi ngayChuyenCanThang; hrm luuChuyenCanTinhCN o POST+PUT; form #f_cc_tinhcn + payload chuyenCanTinhCN; dieu khoan "khong ke chu nhat"',
    /ADD ChuyenCanTinhCN BIT NOT NULL/.test(doc('database', 'migration_v900.sql')) && /ISNULL\(hd\.ChuyenCanTinhCN, 1\) AS ChuyenCanTinhCN/.test(fPR) && /\.\.\.ngayChuyenCanThang\(nam, thang, ngayLeSet/.test(fPR)
    && (fHRM.match(/await luuChuyenCanTinhCN\(pool, /g) || []).length === 2 && /id="f_cc_tinhcn"/.test(fHrmFE) && /chuyenCanTinhCN: !!\(modal\.querySelector\('#f_cc_tinhcn'\)/.test(fHrmFE) && /không kể chủ nhật và/.test(fHrmFE));
  kiem('v9.73 nua ngay: migration_v899 (NuaNgay + KieuThuong 50), payroll.js chuanHoaPhieuNghi nuaNgay 0,5 cong, nghiPhep.js ghi SoCong 0,5, form #pnNuaNgay',
    /PhieuNghi ADD NuaNgay BIT/.test(mig899) && /ALTER COLUMN KieuThuong NVARCHAR\(50\)/.test(mig899) && /DROP CONSTRAINT CK_HopDongLaoDong_KieuThuong/.test(mig899)
    && /nuaNgay/.test(fPR) && /soNgay: nuaNgay \? 0\.5/.test(fPR) && /NuaNgay \? 0\.5 : 0/.test(fNP) && /id="pnNuaNgay"/.test(fFE) && /nuaNgay:/.test(fFE));
  kiem('module.mypay.js: dong Khong phep + nhan thuong chuyen can', /Ngày nghỉ không phép/.test(fMy) && /Thưởng chuyên cần \(bậc thang\)/.test(fMy));
  const v = (f) => { const mm = new RegExp('/js/' + f + '\\.js\\?v=([0-9.]+)').exec(html); return mm ? parseFloat(mm[1]) : 0; };
  kiem('index.html: payroll / hrm / mypay >= 9.55', v('module\\.payroll') >= 9.55 && v('module\\.hrm') >= 9.55 && v('module\\.mypay') >= 9.55);
  kiem('TRIEN_KHAI co muc v9.55', /v9\.55/.test(doc('docs', 'TRIEN_KHAI_v936_v940.md')));

  Module._load = gocLoad;
  clearTimeout(canhGac);
  console.log(`\n=== KET QUA: ${dat} dat, ${sai} sai ===`);
  process.exit(sai ? 1 : 0);
})().catch(e => { console.log('\n  ❌ BO KIEM VO: ' + (e && e.stack || e)); clearTimeout(canhGac); process.exit(1); });
