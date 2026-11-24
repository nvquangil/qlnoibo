/* ================================================================================================
   kiem_bang_luong_tu_tinh_lai.js — bo tu kiem cho v9.53 (bang luong cong nhat TU TINH LAI khi co bien dong)

   Nguyen 14/11/2026: "Luong cong nhat – tinh luong khi co bien dong ngay cong, phieu thu chi hay ky
   hop dong tu dong tinh luong luon khong can bam tinh luong".

   KIEM HANH VI, khong so chuoi (tru muc 6 viet sau cung):
     2. utils/bangLuongTuDong.js THAT voi db gia + routes/payroll GIA: co ban, ly do, 12 thang, tinh lai
        luc xem, da chot khong tinh, loi giu co, hai nguoi mo cung luc = mot lan tinh, bien dong den
        TRONG LUC tinh thi co van con.
     3. routes/payroll.js THAT (db + auth gia): tinhBangLuongThang tach ra dung — da chot nem co daChot,
        0 nhan vien, 1 nhan vien ra dung tien, NguoiLapID giu khi userId null; GET /bangluong tu tinh roi
        moi doc; GET /bangluong/cuatoi KHONG tra ly do; POST /bangluong/tinh tra no co.
     4. hooks THAT o routes/congno.js + routes/hrm.js (util gia ghi nhat ky): dung thang, ca thang CU
        lan thang MOI khi sua, khong danh dau khi khong phai tam ung.
     5. module.payroll.js: dongTuTinh (cat theo dau moc, chay trong new Function).
     6. so chuoi: hook co mat, bump ?v=.

   Chay:  node backend\utils\kiem_bang_luong_tu_tinh_lai.js
   KHONG copy sang D:\QLSX. KHONG dung toi CSDL.
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
/* CANH GAC: await treo thi Node thoat ma 0 khong in KET QUA — kiem_tat_ca coi la xanh (bai hoc 14/11). */
const canhGac = setTimeout(() => { console.log('\n  ❌ BO KIEM TREO qua 20 s (co await khong bao gio xong) — khong toi duoc dong KET QUA'); process.exit(1); }, 20000);

const fUtil = doc('backend', 'utils', 'bangLuongTuDong.js'), fPR = doc('backend', 'routes', 'payroll.js');
const fHRM = doc('backend', 'routes', 'hrm.js'), fCN = doc('backend', 'routes', 'congno.js');
const fFE = doc('frontend', 'js', 'module.payroll.js'), fMy = doc('frontend', 'js', 'module.mypay.js'), html = doc('frontend', 'index.html');

console.log('\n=== 1. BIEN DICH ===');
[['backend/utils/bangLuongTuDong.js', fUtil], ['backend/routes/payroll.js', fPR], ['backend/routes/hrm.js', fHRM],
 ['backend/routes/congno.js', fCN], ['frontend/js/module.payroll.js', fFE], ['frontend/js/module.mypay.js', fMy]].forEach(([f, s]) => {
  if (!s) { sai++; console.log('  ❌ ' + f + ' KHONG DOC DUOC'); return; }
  try { new vm.Script(s, { filename: f }); dat++; console.log('  ✓ ' + f); }
  catch (e) { sai++; console.log('  ❌ ' + f + ' VO CU PHAP: ' + e.message); }
});

/* ------------------------------------------------------------------------------------------------
   DB GIA dung chung: bang CauHinh trong bo nho (Map), header BangLuong, nhan vien, cham cong, phieu chi,
   hop dong. Tra loi theo regex cau SQL + tham so da .input(). Ghi nhat ky moi cau.
   ------------------------------------------------------------------------------------------------ */
const GIA = {
  cauHinh: new Map(),          // Khoa -> GiaTri (JSON)
  header: null,                // { BangLuongID, TrangThai } | null
  emps: [], cc: [],            // nhan vien (da JOIN hop dong) + cham cong thang
  phieuChi: null,              // dong PhieuChi doc truoc khi sua/xoa
  hopDong: null,               // dong HopDongLaoDong doc truoc khi sua/xoa
  ttLaoDong: undefined,        // TrangThaiLaoDong cu cua nhan vien
  coNV: true,                  // co cot v886 tren PhieuChi?
  loiCauHinh: false            // moi cau cham CauHinh deu nem
};
const nhatKy = [];
function taoRequest() {
  const inputs = {};
  const r = {
    input(ten, kieu, gt) { inputs[ten] = arguments.length === 2 ? kieu : gt; return r; },
    async query(q) {
      nhatKy.push({ q, inputs: Object.assign({}, inputs) });
      const rs = (recordset, rowsAffected) => ({ recordset, rowsAffected: rowsAffected || [recordset.length ? 1 : 0] });
      if (/FROM CauHinh WHERE Khoa=@k/.test(q)) {
        if (GIA.loiCauHinh) throw new Error('CauHinh hong (gia)');
        const v = GIA.cauHinh.get(inputs.k);
        return rs(v === undefined ? [] : [{ GiaTri: v }]);
      }
      if (/UPDATE CauHinh SET GiaTri=@v/.test(q)) {
        if (GIA.loiCauHinh) throw new Error('CauHinh hong (gia)');
        if (!GIA.cauHinh.has(inputs.k)) return rs([], [0]);
        GIA.cauHinh.set(inputs.k, inputs.v); return rs([], [1]);
      }
      if (/INSERT INTO CauHinh/.test(q)) { GIA.cauHinh.set(inputs.k, inputs.v); return rs([], [1]); }
      if (/FROM BangLuong WHERE Nam=@n AND Thang=@t AND Loai=N'CongNhat'/.test(q)) return rs(GIA.header ? [Object.assign({}, GIA.header)] : []);
      if (/MERGE BangLuong AS t/.test(q)) { if (!GIA.header) GIA.header = { BangLuongID: 7, TrangThai: 'Nháp' }; return rs([], [1]); }
      /* v9.54 bo chot */
      if (/SELECT BangLuongID, Nam, Thang, TrangThai, GhiChu FROM BangLuong WHERE BangLuongID=@id/.test(q)) return rs(GIA.header && GIA.header.BangLuongID === inputs.id ? [Object.assign({ Nam: 2026, Thang: 11, GhiChu: null }, GIA.header)] : []);
      if (/UPDATE BangLuong SET TrangThai=N'Nháp', GhiChu=@gc WHERE BangLuongID=@id AND TrangThai=N'Đã chốt'/.test(q)) {
        if (!GIA.header || GIA.header.BangLuongID !== inputs.id || GIA.header.TrangThai !== 'Đã chốt') return rs([], [0]);
        GIA.header.TrangThai = 'Nháp'; GIA.header.GhiChu = inputs.gc; return rs([], [1]);
      }
      if (/SELECT NhanVienID, DieuChinh, LyDoDieuChinh FROM BangLuongChiTiet/.test(q)) return rs([]);
      if (/FROM BangLuongChiTiet ct JOIN NhanVien nv/.test(q)) return rs(GIA.chiTiet || []);
      if (/FROM BangLuongChiTiet ct\s+JOIN BangLuong bl/.test(q)) return rs(GIA.chiTiet || []);
      if (/COL_LENGTH\('PhieuChi','NhanVienID'\)/.test(q)) return rs([GIA.coNV ? { a: 4, b: 4, c: 4 } : { a: null, b: null, c: null }]);
      if (/COL_LENGTH|OBJECT_ID/.test(q)) return rs([{ a: 4, b: 4, c: 4, t: 4, o: 4 }]);
      if (/SELECT \* FROM CauHinhLuong WHERE ID=1/.test(q)) return rs([{ GioChuanNgay: 8, HsTangCaThuong: 1.5, LamTronThucLinh: 1000, TruThueTNCN: 0, DiMuonChamChuocPhut: 5, BhxhNld: 8, BhytNld: 1.5, BhtnNld: 1 }]);
      if (/SELECT SoNgayCong FROM CongChuanThang/.test(q)) return rs([{ SoNgayCong: 26 }]);
      if (/FROM BacThueTNCN/.test(q)) return rs([]);
      if (/OUTER APPLY \(SELECT TOP 1 \* FROM HopDongLaoDong h/.test(q) && /FROM NhanVien nv/.test(q)) return rs(GIA.emps.map(e => Object.assign({}, e)));
      if (/FROM ChamCongNgay WHERE YEAR\(Ngay\)=@n AND MONTH\(Ngay\)=@t/.test(q)) return rs(GIA.cc.map(x => Object.assign({}, x)));
      if (/SELECT pc\.NhanVienID, SUM\(pc\.SoTien\)/.test(q)) return rs([]);
      if (/SELECT NhanVienID FROM Users WHERE UserID=@uid/.test(q)) return rs([{ NhanVienID: 1 }]);
      if (/FROM PhieuChi WHERE PhieuChiID=@id/.test(q) && /CONVERT\(varchar\(10\), NgayChi, 23\)/.test(q)) return rs(GIA.phieuChi ? [Object.assign({}, GIA.phieuChi)] : []);
      if (/SELECT PhieuThuKemID FROM PhieuChi/.test(q)) return rs([{ PhieuThuKemID: null }]);
      if (/SELECT SoHopDong, CONVERT\(varchar\(10\), TuNgay, 23\) AS TuNgay FROM HopDongLaoDong/.test(q)) return rs(GIA.hopDong ? [Object.assign({}, GIA.hopDong)] : []);
      if (/SELECT TrangThaiLaoDong FROM NhanVien WHERE NhanVienID=@id/.test(q)) return rs(GIA.ttLaoDong === undefined ? [] : [{ TrangThaiLaoDong: GIA.ttLaoDong }]);
      if (/INSERT INTO HopDongLaoDong/.test(q)) return rs([{ HopDongID: 55 }]);
      if (/INSERT INTO ThanhLyHopDong/.test(q)) return rs([{ ThanhLyID: 9 }]);
      if (/LIKE @p/.test(q)) return rs([]);          // sinhSoPhieu
      return rs([], [1]);
    }
  };
  return r;
}
const poolGia = { request: () => taoRequest() };
class TranGia { constructor() { this.daBegin = false; this.daCommit = false; this.daRollback = false; } async begin() { this.daBegin = true; } async commit() { this.daCommit = true; } async rollback() { this.daRollback = true; } }
let tranCuoi = null;
const sqlGia = new Proxy({}, {
  get(_, k) {
    if (k === 'Transaction') return class extends TranGia { constructor() { super(); tranCuoi = this; } };
    if (k === 'Request') return class { constructor() { return taoRequest(); } };
    const f = () => k; f.toString = () => String(k); return f;   // sql.Int, sql.NVarChar(sql.MAX), sql.Decimal(14,2)...
  }
});
const dbGia = { sql: sqlGia, getPool: async () => poolGia };
const mw = () => (req, res, next) => next();
const authGia = { requireAuth: mw(), requirePermission: mw, requireChucNang: mw, requireChucNangAny: mw, canUpdateStage: mw, coQuyenChucNang: async () => true };

/* Chen module gia theo TEN YEU CAU ('../db', '../routes/payroll'...) — cach cua kiem_ton_vai.js. */
const THAY = {};
const gocLoad = Module._load;
Module._load = function (ten) {
  if (Object.prototype.hasOwnProperty.call(THAY, ten)) return THAY[ten];
  return gocLoad.apply(this, arguments);
};
THAY['../db'] = dbGia; THAY['../middleware/auth'] = authGia;
const DUONG_UTIL = path.join(GOC, 'backend', 'utils', 'bangLuongTuDong.js');
const DUONG_PR = path.join(GOC, 'backend', 'routes', 'payroll.js');
const napMoi = (duong) => { delete require.cache[duong]; return require(duong); };
const thangCua = (lech) => { const d = new Date(); const i = d.getFullYear() * 12 + d.getMonth() + lech; return { nam: Math.floor(i / 12), thang: (i % 12) + 1 }; };
const k2 = (t) => `${t.nam}-${String(t.thang).padStart(2, '0')}`;
const banDo = () => { const v = GIA.cauHinh.get('BANG_LUONG_TU_DONG'); return v ? JSON.parse(v) : {}; };
const imLang = async (fn) => { const ce = console.error, cw = console.warn; console.error = () => {}; console.warn = () => {}; try { return await fn(); } finally { console.error = ce; console.warn = cw; } };
const layHandler = (router, method, duong) => {
  const l = (router.stack || []).find(x => x.route && x.route.path === duong && x.route.methods[method]);
  return l && l.route.stack[l.route.stack.length - 1].handle;
};
const goi = async (h, req) => {
  const res = { code: 200, body: null, status(c) { res.code = c; return res; }, json(o) { res.body = o; return res; } };
  let loiNext = null;
  await h(Object.assign({ body: {}, query: {}, params: {}, session: { user: { userId: 7 } } }, req), res, (e) => { loiNext = e; });
  return { code: res.code, body: res.body, loiNext };
};

(async () => {
  /* ============================================================================================ */
  console.log('\n=== 2. utils/bangLuongTuDong.js THAT — db gia, routes/payroll GIA ===');
  const nhatKyTinh = [];
  let utilDangKiem = null;
  const payrollGia = {
    tinhBangLuongThang: async (pool, nam, thang, userId) => {
      nhatKyTinh.push([nam, thang, userId]);
      if (GIA.loiTinh) throw GIA.loiTinh;
      if (GIA.danhDauTrongLucTinh) await utilDangKiem.danhDau(pool, nam, thang, 'đến trong lúc tính');
      await new Promise(r => setTimeout(r, 5));
      return { bangLuongID: 7, soNhanVien: 3, thieuHopDong: [{ NhanVienID: 9 }], canhBao: ['a', 'b'], truThue: false };
    }
  };
  THAY['../routes/payroll'] = payrollGia;
  const u = utilDangKiem = napMoi(DUONG_UTIL);
  const HT = thangCua(0), TRUOC = thangCua(-1), CU = thangCua(-3);

  // --- thang ---
  kiem("thangTuNgay('2026-10-05') = 10/2026; 'yyyy-mm-ddThh:mm' cung duoc; 'dd/mm/yyyy' -> null; Date -> theo UTC",
    JSON.stringify(u.thangTuNgay('2026-10-05')) === '{"nam":2026,"thang":10}' && u.thangTuNgay('2026-01-31T23:59').thang === 1
    && u.thangTuNgay('05/10/2026') === null && u.thangTuNgay('') === null && u.thangTuNgay(new Date(Date.UTC(2026, 11, 1))).thang === 12);
  kiem('thangTruLuong: co TruLuong -> dung no; khong -> thang NgayChi; khong ca hai -> thang hien tai (cung luat ISNULL cua tamUngNhanVien)',
    u.thangTruLuong(2026, 12, '2026-10-30').thang === 12 && u.thangTruLuong(null, null, '2026-10-30').thang === 10
    && u.thangTruLuong('', '', null).thang === HT.thang && u.thangTruLuong(2026, 13, '2026-10-30').thang === 10);
  kiem("ddmmyyyy('2026-11-03') = '03/11/2026'", u.ddmmyyyy('2026-11-03') === '03/11/2026');

  // --- danhDau ---
  GIA.cauHinh.clear(); nhatKy.length = 0;
  let ok = await u.danhDau(poolGia, 2026, 11, 'Sửa tay chấm công ngày 03/11/2026');
  let bd = banDo();
  kiem('danhDau lan dau: chua co dong CauHinh -> UPDATE 0 dong roi INSERT; can=true, lan=1, lyDo, luc', ok === true
    && nhatKy.some(x => /UPDATE CauHinh/.test(x.q)) && nhatKy.some(x => /INSERT INTO CauHinh/.test(x.q))
    && bd['2026-11'] && bd['2026-11'].can === true && bd['2026-11'].lan === 1 && bd['2026-11'].lyDo[0] === 'Sửa tay chấm công ngày 03/11/2026'
    && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(bd['2026-11'].luc), JSON.stringify(bd));
  await u.danhDau(poolGia, 2026, 11, 'Sửa tay chấm công ngày 03/11/2026');
  await u.danhDau(poolGia, 2026, 11, 'Phiếu chi tạm ứng PC260012');
  bd = banDo();
  kiem('cung ly do lap lai -> MOT muc (dung cuoi), lan tang; ly do khac -> them', bd['2026-11'].lan === 3 && bd['2026-11'].lyDo.length === 2
    && bd['2026-11'].lyDo[1] === 'Phiếu chi tạm ứng PC260012', JSON.stringify(bd['2026-11'].lyDo));
  for (let i = 0; i < 12; i++) await u.danhDau(poolGia, 2026, 11, 'ly do ' + i);
  kiem('giu toi da 8 ly do gan nhat', banDo()['2026-11'].lyDo.length === 8 && banDo()['2026-11'].lyDo[7] === 'ly do 11');
  kiem('thang sai (13, 0, NaN) -> false, khong ghi', (await u.danhDau(poolGia, 2026, 13, 'x')) === false && (await u.danhDau(poolGia, 'abc', 1, 'x')) === false && !banDo()['2026-13']);

  GIA.cauHinh.clear();
  await u.danhDauTheoNgay(poolGia, '2026-10-05', 'a');
  await u.danhDauTheoNgay(poolGia, 'rac', 'b');
  bd = banDo();
  kiem('danhDauTheoNgay: dung thang cua ngay; ngay rac -> thang hien tai', bd['2026-10'] && bd['2026-10'].can && bd[k2(HT)] && bd[k2(HT)].lyDo.includes('b'));

  GIA.cauHinh.clear();
  await u.danhDauGanDay(poolGia, 'Đổi cấu hình lương');
  bd = banDo();
  kiem('danhDauGanDay = thang hien tai + thang truoc, MOT lan doc-ghi', Object.keys(bd).length === 2 && bd[k2(HT)].can && bd[k2(TRUOC)].can);

  GIA.cauHinh.clear();
  await u.danhDauTuNgay(poolGia, `${CU.nam}-${String(CU.thang).padStart(2, '0')}-15`, 'Thêm hợp đồng');
  bd = banDo();
  kiem('danhDauTuNgay 3 thang truoc -> 4 thang (3 truoc + hien tai)', Object.keys(bd).length === 4 && bd[k2(CU)] && bd[k2(HT)], Object.keys(bd).join(','));
  GIA.cauHinh.clear();
  const XA = thangCua(-20);
  await u.danhDauTuNgay(poolGia, `${XA.nam}-${String(XA.thang).padStart(2, '0')}-01`, 'Hợp đồng lùi 20 tháng');
  bd = banDo();
  kiem('lui 20 thang -> chi 12 thang gan nhat (co hien tai, khong co thang -12)', Object.keys(bd).length === 12 && bd[k2(HT)] && bd[k2(thangCua(-11))] && !bd[k2(thangCua(-12))], Object.keys(bd).join(','));
  GIA.cauHinh.clear();
  const TL = thangCua(2);
  await u.danhDauTuNgay(poolGia, `${TL.nam}-${String(TL.thang).padStart(2, '0')}-01`, 'Hợp đồng tương lai');
  bd = banDo();
  kiem('ngay tuong lai -> chi danh dau thang do', Object.keys(bd).length === 1 && bd[k2(TL)]);
  GIA.cauHinh.clear();
  await u.danhDauTuNgay(poolGia, null, 'Hợp đồng không ngày');
  kiem('khong co ngay -> thang hien tai', Object.keys(banDo()).length === 1 && banDo()[k2(HT)]);

  GIA.cauHinh.clear(); GIA.loiCauHinh = true;
  ok = await imLang(() => u.danhDau(poolGia, 2026, 11, 'x'));
  GIA.loiCauHinh = false;
  kiem('🔴 CauHinh hong -> danhDau tra false, KHONG nem (route phieu chi / lich cham cong khong duoc vo vi co)', ok === false);

  GIA.cauHinh.clear();
  for (let i = 0; i < 16; i++) await u.danhDau(poolGia, 2020 + Math.floor(i / 12), (i % 12) + 1, 'x');
  kiem('tia JSON: giu 14 thang gan nhat', Object.keys(banDo()).length === 14 && !banDo()['2020-01'] && banDo()['2021-04']);

  // --- tinhLaiNeuCan ---
  const dat1 = (th, co, header) => { GIA.cauHinh.clear(); if (co) GIA.cauHinh.set('BANG_LUONG_TU_DONG', JSON.stringify({ [k2(th)]: { can: true, lan: 2, luc: '2026-11-14 09:00', lyDo: ['Sửa tay chấm công ngày 03/11/2026', 'Chấm KPI'] } })); GIA.header = header; nhatKyTinh.length = 0; };
  dat1(HT, true, { BangLuongID: 7, TrangThai: 'Nháp' });
  let kq = await u.tinhLaiNeuCan(poolGia, HT.nam, HT.thang, 5);
  kiem('co co + bang Nhap -> goi tinhBangLuongThang(pool, nam, thang, 5) dung 1 lan; tra daTinhLai + lyDo + luc + ketQua',
    nhatKyTinh.length === 1 && nhatKyTinh[0][0] === HT.nam && nhatKyTinh[0][1] === HT.thang && nhatKyTinh[0][2] === 5
    && kq.daTinhLai === true && kq.lyDo.length === 2 && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(kq.luc) && kq.ketQua.soNhanVien === 3, JSON.stringify(kq));
  bd = banDo()[k2(HT)];
  kiem('…co XOA (can=false, lyDo rong), lanCuoi ghi { luc, cach: tuDong, lyDo, soNhanVien 3, soThieuHopDong 1, soCanhBao 2 }',
    bd.can === false && bd.lyDo.length === 0 && bd.lanCuoi && bd.lanCuoi.cach === 'tuDong' && bd.lanCuoi.soNhanVien === 3
    && bd.lanCuoi.soThieuHopDong === 1 && bd.lanCuoi.soCanhBao === 2 && bd.lanCuoi.lyDo[0] === 'Sửa tay chấm công ngày 03/11/2026', JSON.stringify(bd));
  nhatKyTinh.length = 0;
  kq = await u.tinhLaiNeuCan(poolGia, HT.nam, HT.thang, 5);
  kiem('khong co + co bang -> KHONG tinh, tra lanCuoi de man hinh noi "tinh lan cuoi luc"', nhatKyTinh.length === 0 && kq.daTinhLai === false && kq.lanCuoi && kq.lanCuoi.cach === 'tuDong');

  dat1(HT, false, null);
  kq = await u.tinhLaiNeuCan(poolGia, HT.nam, HT.thang, 5);
  kiem('khong co + CHUA co bang + thang hien tai -> tao lan dau (khong bat bam nut), ly do noi ro', nhatKyTinh.length === 1 && kq.daTinhLai === true && /tạo lần đầu/.test(kq.lyDo[0]));
  dat1(TRUOC, false, null);
  kq = await u.tinhLaiNeuCan(poolGia, TRUOC.nam, TRUOC.thang, 5);
  kiem('…thang truoc cung tao lan dau', nhatKyTinh.length === 1 && kq.daTinhLai === true);
  dat1(CU, false, null);
  kq = await u.tinhLaiNeuCan(poolGia, CU.nam, CU.thang, 5);
  kiem('khong co + chua co bang + 3 thang truoc -> KHONG tu tao bang', nhatKyTinh.length === 0 && kq.daTinhLai === false);
  dat1(CU, true, null);
  kq = await u.tinhLaiNeuCan(poolGia, CU.nam, CU.thang, 5);
  kiem('co co + chua co bang + thang cu -> chuaCoBang, khong tinh, co GIU', nhatKyTinh.length === 0 && kq.chuaCoBang === true && banDo()[k2(CU)].can === true);
  dat1(CU, true, { BangLuongID: 3, TrangThai: 'Nháp' });
  kq = await u.tinhLaiNeuCan(poolGia, CU.nam, CU.thang, null);
  kiem('co co + bang cu Nhap (da tung tinh) -> van tinh lai, userId null truyen null', nhatKyTinh.length === 1 && nhatKyTinh[0][2] === null && kq.daTinhLai === true);

  dat1(HT, true, { BangLuongID: 7, TrangThai: 'Đã chốt' });
  kq = await u.tinhLaiNeuCan(poolGia, HT.nam, HT.thang, 5);
  kiem('🔴 co co + DA CHOT -> KHONG tinh, tra daChot + lyDo + luc, co GIU nguyen (ke toan tu quyet)',
    nhatKyTinh.length === 0 && kq.daChot === true && kq.daTinhLai === false && kq.lyDo.length === 2 && kq.luc === '2026-11-14 09:00' && banDo()[k2(HT)].can === true);
  dat1(HT, true, { BangLuongID: 7, TrangThai: 'Nháp' });
  const eChot = new Error('ĐÃ CHỐT'); eChot.daChot = true; GIA.loiTinh = eChot;
  kq = await u.tinhLaiNeuCan(poolGia, HT.nam, HT.thang, 5);
  GIA.loiTinh = null;
  kiem('chot xay ra giua chung (ham tinh nem daChot) -> daChot, co giu', kq.daChot === true && banDo()[k2(HT)].can === true);
  dat1(HT, true, { BangLuongID: 7, TrangThai: 'Nháp' });
  GIA.loiTinh = new Error('Msg 8152 tran cot');
  kq = await imLang(() => u.tinhLaiNeuCan(poolGia, HT.nam, HT.thang, 5));
  GIA.loiTinh = null;
  kiem('🔴 tinh loi -> KHONG nem (GET /bangluong van tra bang cu), tra loi + lyDo, co GIU de lan sau tinh lai',
    kq.daTinhLai === false && /8152/.test(kq.loi) && kq.lyDo.length === 2 && banDo()[k2(HT)].can === true);

  dat1(HT, true, { BangLuongID: 7, TrangThai: 'Nháp' });
  const [a1, a2, a3] = await Promise.all([u.tinhLaiNeuCan(poolGia, HT.nam, HT.thang, 5), u.tinhLaiNeuCan(poolGia, HT.nam, HT.thang, 6), u.tinhLaiNeuCan(poolGia, HT.nam, HT.thang, 7)]);
  kiem('ba nguoi mo cung luc -> MOT lan tinh, ca ba nhan cung ket qua', nhatKyTinh.length === 1 && a1 === a2 && a2 === a3 && a1.daTinhLai === true);
  kq = await u.tinhLaiNeuCan(poolGia, HT.nam, HT.thang, 5);
  kiem('…xong roi goi lai -> khong con khoa "dang tinh", khong tinh them', nhatKyTinh.length === 1 && kq.daTinhLai === false);

  dat1(HT, true, { BangLuongID: 7, TrangThai: 'Nháp' });
  GIA.danhDauTrongLucTinh = true;
  kq = await u.tinhLaiNeuCan(poolGia, HT.nam, HT.thang, 5);
  GIA.danhDauTrongLucTinh = false;
  bd = banDo()[k2(HT)];
  kiem('🔴 bien dong den TRONG LUC dang tinh -> sau khi tinh xong co VAN CON (lan lech), ly do moi giu lai, lanCuoi van ghi',
    kq.daTinhLai === true && bd.can === true && bd.lyDo.includes('đến trong lúc tính') && bd.lanCuoi && bd.lanCuoi.cach === 'tuDong', JSON.stringify(bd));
  kiem('thang sai -> { daTinhLai:false } khong cham CSDL', (await u.tinhLaiNeuCan(poolGia, 2026, 0, 5)).daTinhLai === false);

  // --- docMoc / ghiNhanDaTinh (nut bam tay) ---
  dat1(HT, true, { BangLuongID: 7, TrangThai: 'Nháp' });
  const moc = await u.docMoc(poolGia, HT.nam, HT.thang);
  const lc = await u.ghiNhanDaTinh(poolGia, HT.nam, HT.thang, { soNhanVien: 40, thieuHopDong: [], canhBao: ['x'] }, moc, 'tay');
  bd = banDo()[k2(HT)];
  kiem('bam tay: docMoc (can, lan 2, 2 ly do) roi ghiNhanDaTinh tay -> co xoa, lanCuoi.cach = tay, soNhanVien 40',
    moc.can === true && moc.lan === 2 && moc.lyDo.length === 2 && bd.can === false && bd.lanCuoi.cach === 'tay' && bd.lanCuoi.soNhanVien === 40 && lc.cach === 'tay');
  GIA.loiCauHinh = true;
  const moc2 = await u.docMoc(poolGia, HT.nam, HT.thang);
  const lc2 = await imLang(() => u.ghiNhanDaTinh(poolGia, HT.nam, HT.thang, { soNhanVien: 1 }, moc2, 'tay'));
  GIA.loiCauHinh = false;
  kiem('CauHinh hong -> docMoc tra "khong co co", ghiNhanDaTinh khong nem', moc2.can === false && moc2.lan === 0 && lc2 && lc2.cach === 'tay');

  /* ============================================================================================ */
  console.log('\n=== 3. routes/payroll.js THAT — tinhBangLuongThang tach ra + GET /bangluong tu tinh ===');
  delete THAY['../routes/payroll'];
  delete require.cache[DUONG_UTIL];
  let payroll = null;
  try { payroll = napMoi(DUONG_PR); } catch (e) { sai++; console.log('  ❌ khong nap duoc routes/payroll.js voi db gia: ' + e.message); }
  if (payroll) {
    kiem('router.tinhBangLuongThang duoc gan len router (util goi duoc)', typeof payroll.tinhBangLuongThang === 'function');
    GIA.cauHinh.clear(); GIA.header = { BangLuongID: 7, TrangThai: 'Đã chốt' }; nhatKy.length = 0;
    let loi = null;
    try { await payroll.tinhBangLuongThang(poolGia, 2026, 11, 7); } catch (e) { loi = e; }
    kiem('🔴 da chot -> NEM Error co daChot=true, cau bao nhu cu, KHONG dong vao CSDL', loi && loi.daChot === true && /ĐÃ CHỐT nên không tính lại được/.test(loi.message)
      && !nhatKy.some(x => /MERGE BangLuong|DELETE FROM BangLuongChiTiet/.test(x.q)));

    GIA.header = { BangLuongID: 7, TrangThai: 'Nháp' }; GIA.emps = []; GIA.cc = []; nhatKy.length = 0; tranCuoi = null;
    let r = await payroll.tinhBangLuongThang(poolGia, 2026, 11, null);
    const merge = nhatKy.find(x => /MERGE BangLuong AS t/.test(x.q));
    kiem('0 nhan vien: tra { bangLuongID 7, soNhanVien 0, thieuHopDong [], canhBao, truThue false }', r && r.bangLuongID === 7 && r.soNhanVien === 0 && Array.isArray(r.thieuHopDong) && r.thieuHopDong.length === 0 && Array.isArray(r.canhBao) && r.truThue === false, JSON.stringify(r));
    kiem('🔴 userId null -> @u NULL va MERGE giu NguoiLapID cu (ISNULL(@u, t.NguoiLapID))', merge && merge.inputs.u === null && /NguoiLapID=ISNULL\(@u, t\.NguoiLapID\)/.test(merge.q));
    kiem('giao dich: begin + DELETE chi tiet + commit, khong rollback', tranCuoi && tranCuoi.daBegin && tranCuoi.daCommit && !tranCuoi.daRollback && nhatKy.some(x => /DELETE FROM BangLuongChiTiet WHERE BangLuongID=@id/.test(x.q)));

    GIA.emps = [{ NhanVienID: 1, MaNhanVien: 'NV001', HoTen: 'A', SoNguoiPhuThuoc: 0, HopDongID: 11, LuongCoBan: 10400000, KieuLuong: 'Thang', MucDongBH: 0, KieuThuong: null, DenNgay: null, NgayHetThuViec: null },
      { NhanVienID: 2, MaNhanVien: 'NV002', HoTen: 'B', SoNguoiPhuThuoc: 0, HopDongID: null }];
    GIA.cc = [{ NhanVienID: 1, ngay: '2026-11-03', maCham: null, soCong: 1, gioVao: '08:00', gioOT: 0 }, { NhanVienID: 1, ngay: '2026-11-04', maCham: null, soCong: 1, gioVao: '08:00', gioOT: 0 }];
    nhatKy.length = 0;
    r = await payroll.tinhBangLuongThang(poolGia, 2026, 11, 7);
    const ins = nhatKy.filter(x => /INSERT INTO BangLuongChiTiet/.test(x.q));
    const merge2 = nhatKy.find(x => /MERGE BangLuong AS t/.test(x.q));
    kiem('1 nguoi co hop dong (luong thang 10,4tr, 2 cong / 26) -> 1 dong INSERT, ThucLinh 800.000; nguoi khong hop dong vao thieuHopDong',
      ins.length === 1 && ins[0].inputs.NhanVienID === 1 && ins[0].inputs.ThucLinh === 800000 && r.soNhanVien === 1 && r.thieuHopDong.length === 1 && r.thieuHopDong[0].HoTen === 'B',
      JSON.stringify({ ins: ins.map(x => x.inputs.ThucLinh), r }));
    kiem('userId 7 -> @u = 7 (bam tay ghi nguoi lap)', merge2 && merge2.inputs.u === 7);

    /* GET /bangluong: util THAT -> payroll THAT (tich hop). */
    const hGet = layHandler(payroll, 'get', '/bangluong');
    kiem('lay duoc handler GET /bangluong', typeof hGet === 'function');
    if (hGet) {
      GIA.cauHinh.clear(); GIA.cauHinh.set('BANG_LUONG_TU_DONG', JSON.stringify({ '2026-11': { can: true, lan: 1, luc: '2026-11-14 09:00', lyDo: ['Phiếu chi tạm ứng PC260012'] } }));
      GIA.header = { BangLuongID: 7, TrangThai: 'Nháp' }; GIA.chiTiet = [{ ID: 1, NhanVienID: 1, HoTen: 'A', ThucLinh: 800000 }]; nhatKy.length = 0;
      let g = await goi(hGet, { query: { nam: '2026', thang: '11' } });
      const td = g.body && g.body.data && g.body.data.tuDong;
      kiem('co co -> TINH LAI TRUOC roi moi doc: data.tuDong.daTinhLai, lyDo, ketQua; rows van tra', g.code === 200 && td && td.daTinhLai === true && td.lyDo[0] === 'Phiếu chi tạm ứng PC260012'
        && td.ketQua && td.ketQua.soNhanVien === 1 && g.body.data.rows.length === 1, JSON.stringify(g.body));
      const iDel = nhatKy.findIndex(x => /DELETE FROM BangLuongChiTiet/.test(x.q)), iDoc = nhatKy.findIndex(x => /FROM BangLuongChiTiet ct JOIN NhanVien nv/.test(x.q));
      kiem('…thu tu: DELETE+INSERT chi tiet XONG roi moi SELECT tra ve (khong tra bang cu)', iDel >= 0 && iDoc > iDel);
      nhatKy.length = 0;
      g = await goi(hGet, { query: { nam: '2026', thang: '11' } });
      kiem('mo lai -> khong tinh nua, tuDong.lanCuoi.cach = tuDong', g.body.data.tuDong.daTinhLai === false && g.body.data.tuDong.lanCuoi.cach === 'tuDong' && !nhatKy.some(x => /DELETE FROM BangLuongChiTiet/.test(x.q)));
      GIA.loiCauHinh = true; nhatKy.length = 0;
      g = await imLang(() => goi(hGet, { query: { nam: '2026', thang: '11' } }));
      GIA.loiCauHinh = false;
      kiem('🔴 CauHinh hong -> GET /bangluong VAN tra 200 + rows (tu tinh chi la phan them, khong duoc lam mat bang)', g.code === 200 && g.body.data.rows.length === 1);
    }
    const hCuaToi = layHandler(payroll, 'get', '/bangluong/cuatoi');
    kiem('lay duoc handler GET /bangluong/cuatoi', typeof hCuaToi === 'function');
    if (hCuaToi) {
      GIA.cauHinh.clear(); GIA.cauHinh.set('BANG_LUONG_TU_DONG', JSON.stringify({ '2026-11': { can: true, lan: 1, luc: '2026-11-14 09:00', lyDo: ['Phiếu chi tạm ứng PC260012 (người khác)'] } }));
      GIA.header = { BangLuongID: 7, TrangThai: 'Nháp' }; nhatKy.length = 0;
      const g = await goi(hCuaToi, { query: { nam: '2026', thang: '11' } });
      const td = g.body.data.tuDong, merge3 = nhatKy.find(x => /MERGE BangLuong AS t/.test(x.q));
      kiem('nhan vien mo "Luong cua toi" -> cung tu tinh; tuDong CHI co daTinhLai/luc/daChot, KHONG co lyDo (ly do nhac phieu cua nguoi khac)',
        g.code === 200 && td && td.daTinhLai === true && td.luc && td.lyDo === undefined && td.ketQua === undefined && g.body.data.linked === true, JSON.stringify(td));
      kiem('…va KHONG ghi nhan vien do la nguoi lap (@u NULL)', merge3 && merge3.inputs.u === null);
    }
    const hTinh = layHandler(payroll, 'post', '/bangluong/tinh');
    if (hTinh) {
      GIA.cauHinh.clear(); GIA.cauHinh.set('BANG_LUONG_TU_DONG', JSON.stringify({ '2026-11': { can: true, lan: 4, lyDo: ['Chấm KPI'] } }));
      GIA.header = { BangLuongID: 7, TrangThai: 'Nháp' };
      const g = await goi(hTinh, { body: { nam: 2026, thang: 11 } });
      const m = banDo()['2026-11'];
      kiem('POST /bangluong/tinh (bam tay) -> tra data nhu cu + lanCuoi.cach tay; co duoc tra no (can=false)', g.code === 200 && g.body.data.soNhanVien === 1 && g.body.data.lanCuoi.cach === 'tay' && m.can === false && m.lanCuoi.cach === 'tay', JSON.stringify(g.body));
      GIA.header = { BangLuongID: 7, TrangThai: 'Đã chốt' };
      const g2 = await imLang(() => goi(hTinh, { body: { nam: 2026, thang: 11 } }));
      kiem('…da chot -> 400 cung cau bao cu (route dich loi daChot ra 400, khong 500)', g2.code === 400 && /ĐÃ CHỐT/.test(g2.body.message));
    }

    /* v9.54 — bo chot */
    const hBoChot = layHandler(payroll, 'put', '/bangluong/:id/bochot');
    kiem('v9.54: co route PUT /bangluong/:id/bochot', typeof hBoChot === 'function');
    if (hBoChot) {
      const cl = console.log; console.log = () => {};
      try {
        GIA.header = { BangLuongID: 7, TrangThai: 'Đã chốt', GhiChu: 'cũ' };
        let g = await goi(hBoChot, { params: { id: '7' }, body: { lyDo: '' } });
        kiem('khong ly do -> 400, bang van chot', g.code === 400 && /lý do/.test(g.body.message) && GIA.header.TrangThai === 'Đã chốt');
        g = await goi(hBoChot, { params: { id: '7' }, body: { lyDo: 'Sửa chấm công 12/11' }, session: { user: { userId: 7, hoTen: 'Kế toán A' } } });
        kiem('co ly do -> 200, TrangThai = Nhap, GhiChu = "[luc] Bỏ chốt — Kế toán A: ly do" + dau vet cu', g.code === 200 && GIA.header.TrangThai === 'Nháp'
          && /^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}\] Bỏ chốt — Kế toán A: Sửa chấm công 12\/11\ncũ$/.test(GIA.header.GhiChu), JSON.stringify(GIA.header));
        g = await goi(hBoChot, { params: { id: '7' }, body: { lyDo: 'x' } });
        kiem('bang dang Nhap -> 400 "không có gì để bỏ chốt"', g.code === 400 && /không có gì để bỏ chốt/.test(g.body.message));
        g = await goi(hBoChot, { params: { id: '99' }, body: { lyDo: 'x' } });
        kiem('khong co bang -> 404', g.code === 404);
      } finally { console.log = cl; }
    }
  }

  /* ============================================================================================ */
  console.log('\n=== 4. hooks THAT: routes/congno.js + routes/hrm.js (util GIA ghi nhat ky) ===');
  const nhatKyDau = [];
  const utilGia = {
    danhDau: async (pool, nam, thang, lyDo) => { nhatKyDau.push({ loai: 'danhDau', nam, thang, lyDo }); return true; },
    danhDauNhieu: async (pool, ds, lyDo) => { nhatKyDau.push({ loai: 'danhDauNhieu', ds, lyDo }); return true; },
    danhDauTheoNgay: async (pool, ngay, lyDo) => { nhatKyDau.push({ loai: 'danhDauTheoNgay', ngay, lyDo }); return true; },
    danhDauGanDay: async (pool, lyDo) => { nhatKyDau.push({ loai: 'danhDauGanDay', lyDo }); return true; },
    danhDauTuNgay: async (pool, ngay, lyDo) => { nhatKyDau.push({ loai: 'danhDauTuNgay', ngay, lyDo }); return true; },
    thangTruLuong: u.thangTruLuong, thangTuNgay: u.thangTuNgay, ddmmyyyy: u.ddmmyyyy,
    docMoc: async () => ({ can: false, lan: 0, lyDo: [] }), ghiNhanDaTinh: async () => ({}), tinhLaiNeuCan: async () => ({ daTinhLai: false })
  };
  THAY['../utils/bangLuongTuDong'] = utilGia;
  let congno = null, hrm = null;
  try { congno = napMoi(path.join(GOC, 'backend', 'routes', 'congno.js')); } catch (e) { sai++; console.log('  ❌ khong nap duoc routes/congno.js: ' + e.message); }
  try { hrm = napMoi(path.join(GOC, 'backend', 'routes', 'hrm.js')); } catch (e) { sai++; console.log('  ❌ khong nap duoc routes/hrm.js: ' + e.message); }
  const tamUngNV = require(path.join(GOC, 'backend', 'utils', 'tamUngNhanVien.js'));
  if (congno) {
    const hPost = layHandler(congno, 'post', '/phieuchi'), hPut = layHandler(congno, 'put', '/phieuchi/:id'), hDel = layHandler(congno, 'delete', '/phieuchi/:id');
    kiem('lay duoc 3 handler phieu chi', typeof hPost === 'function' && typeof hPut === 'function' && typeof hDel === 'function');
    const thanNV = { loaiDoiTuong: 'NhanVien', nhanVienId: 3, soTien: 500000, hinhThuc: 'Tiền mặt', tenDoiTuong: 'C' };
    GIA.coNV = true; tamUngNV.xoaCacheCot();
    nhatKyDau.length = 0;
    let g = await goi(hPost, { body: Object.assign({}, thanNV, { loaiChiNV: 'TamUng', truLuongNam: 2026, truLuongThang: 12, ngay: '2026-11-14' }) });
    kiem('POST tam ung "trừ vào lương tháng 12/2026" -> danhDau(2026, 12), ly do co so phieu', g.code === 200 && !g.loiNext && nhatKyDau.length === 1 && nhatKyDau[0].nam === 2026 && nhatKyDau[0].thang === 12 && /Phiếu chi tạm ứng PC\d+/.test(nhatKyDau[0].lyDo), JSON.stringify({ g, nhatKyDau }));
    nhatKyDau.length = 0;
    g = await goi(hPost, { body: Object.assign({}, thanNV, { loaiChiNV: 'TamUng', ngay: '2026-10-30' }) });
    kiem('POST tam ung KHONG khai thang -> thang cua NgayChi (10/2026) — cung luat ISNULL(TruLuongThang, MONTH(NgayChi))', nhatKyDau.length === 1 && nhatKyDau[0].thang === 10 && nhatKyDau[0].nam === 2026);
    nhatKyDau.length = 0;
    g = await goi(hPost, { body: Object.assign({}, thanNV, { loaiChiNV: 'CongTacPhi', ngay: '2026-10-30' }) });
    const g3 = await goi(hPost, { body: { loaiDoiTuong: 'NhaCungCap', nccId: 1, soTien: 500000, hinhThuc: 'Tiền mặt', ngay: '2026-10-30' } });
    kiem('POST cong tac phi / chi NCC -> KHONG danh dau (chi tam ung moi tru luong)', g.code === 200 && g3.code === 200 && nhatKyDau.length === 0);

    GIA.phieuChi = { SoPhieu: 'PC260009', LoaiDoiTuong: 'NhanVien', NhanVienID: 3, LoaiChiNV: 'TamUng', TruLuongNam: 2026, TruLuongThang: 10, NgayChi: '2026-10-05' };
    nhatKyDau.length = 0;
    g = await goi(hPut, { params: { id: '9' }, body: Object.assign({}, thanNV, { loaiChiNV: 'TamUng', truLuongNam: 2026, truLuongThang: 11, ngay: '2026-10-05' }) });
    kiem('🔴 PUT doi thang tru tu 10 sang 11 -> danh dau CA 10/2026 (thang cu) LAN 11/2026 (thang moi)', g.code === 200 && nhatKyDau.length === 2
      && nhatKyDau.some(x => x.thang === 10) && nhatKyDau.some(x => x.thang === 11) && nhatKyDau.every(x => /Sửa phiếu chi tạm ứng PC260009/.test(x.lyDo)), JSON.stringify(nhatKyDau));
    nhatKyDau.length = 0;
    g = await goi(hPut, { params: { id: '9' }, body: Object.assign({}, thanNV, { loaiChiNV: 'HoanUng', ngay: '2026-10-05' }) });
    kiem('PUT doi tam ung -> hoan ung: chi danh dau thang CU (tien khong con tru nua)', nhatKyDau.length === 1 && nhatKyDau[0].thang === 10);
    GIA.phieuChi = { SoPhieu: 'PC260010', LoaiDoiTuong: 'NhaCungCap', NhanVienID: null, LoaiChiNV: null, TruLuongNam: null, TruLuongThang: null, NgayChi: '2026-10-05' };
    nhatKyDau.length = 0;
    g = await goi(hPut, { params: { id: '10' }, body: Object.assign({}, thanNV, { loaiChiNV: 'TamUng', truLuongNam: 2026, truLuongThang: 11, ngay: '2026-10-05' }) });
    kiem('PUT phieu NCC thanh tam ung: chi danh dau thang MOI', nhatKyDau.length === 1 && nhatKyDau[0].thang === 11);
    nhatKyDau.length = 0;
    g = await goi(hPut, { params: { id: '10' }, body: { loaiDoiTuong: 'NhaCungCap', nccId: 1, soTien: 500000, hinhThuc: 'Tiền mặt', ngay: '2026-10-05' } });
    kiem('PUT phieu NCC van NCC -> khong danh dau', g.code === 200 && nhatKyDau.length === 0);

    GIA.phieuChi = { SoPhieu: 'PC260009', LoaiDoiTuong: 'NhanVien', NhanVienID: 3, LoaiChiNV: 'TamUng', TruLuongNam: null, TruLuongThang: null, NgayChi: '2026-10-05' };
    nhatKyDau.length = 0;
    g = await goi(hDel, { params: { id: '9' } });
    kiem('DELETE phieu tam ung (khong khai thang) -> danh dau thang NgayChi 10/2026, ly do "Xóa phiếu chi tạm ứng PC260009"', g.code === 200 && nhatKyDau.length === 1 && nhatKyDau[0].thang === 10 && /Xóa phiếu chi tạm ứng PC260009/.test(nhatKyDau[0].lyDo), JSON.stringify(nhatKyDau));
    GIA.coNV = false; tamUngNV.xoaCacheCot();
    nhatKyDau.length = 0;
    g = await goi(hDel, { params: { id: '9' } });
    kiem('may CHUA chay migration_v886 -> xoa binh thuong, khong doc cot tam ung, khong danh dau, khong no', g.code === 200 && !g.loiNext && nhatKyDau.length === 0);
    GIA.coNV = true; tamUngNV.xoaCacheCot();
  }
  if (hrm) {
    const hPost = layHandler(hrm, 'post', '/hopdong'), hPut = layHandler(hrm, 'put', '/hopdong/:id'), hDel = layHandler(hrm, 'delete', '/hopdong/:id');
    const hNV = layHandler(hrm, 'put', '/nhanvien/:id'), hTL = layHandler(hrm, 'post', '/thanhly');
    kiem('lay duoc 5 handler hrm', [hPost, hPut, hDel, hNV, hTL].every(h => typeof h === 'function'));
    nhatKyDau.length = 0;
    let g = await goi(hPost, { body: { nhanVienId: 3, soHopDong: '12/2026/HĐLĐ', tuNgay: '2026-09-01', kieuLuong: 'Ngay' } });
    kiem("POST hop dong tuNgay 01/09 -> danhDauTuNgay('2026-09-01'), ly do co so hop dong", g.code === 200 && nhatKyDau.length === 1 && nhatKyDau[0].loai === 'danhDauTuNgay' && nhatKyDau[0].ngay === '2026-09-01' && /Thêm hợp đồng số 12\/2026\/HĐLĐ/.test(nhatKyDau[0].lyDo), JSON.stringify({ g, nhatKyDau }));
    nhatKyDau.length = 0;
    g = await goi(hPost, { body: { nhanVienId: 3 } });
    kiem('POST hop dong khong ngay -> danhDauTuNgay(null) (util lui ve thang hien tai), ly do #id', nhatKyDau.length === 1 && nhatKyDau[0].ngay === null && /#55/.test(nhatKyDau[0].lyDo));

    GIA.hopDong = { SoHopDong: '07/2026/HĐLĐ', TuNgay: '2026-08-01' };
    nhatKyDau.length = 0;
    g = await goi(hPut, { params: { id: '55' }, body: { nhanVienId: 3, tuNgay: '2026-10-01' } });
    kiem('🔴 PUT doi tuNgay 01/08 -> 01/10: danh dau TU THANG SOM HON (08/2026) — thang 8, 9 mat thong so cu', g.code === 200 && nhatKyDau.length === 1 && nhatKyDau[0].ngay === '2026-08-01' && /Sửa hợp đồng số 07\/2026\/HĐLĐ/.test(nhatKyDau[0].lyDo), JSON.stringify(nhatKyDau));
    nhatKyDau.length = 0;
    g = await goi(hPut, { params: { id: '55' }, body: { nhanVienId: 3, tuNgay: '2026-06-15' } });
    kiem('PUT lui tuNgay ve 15/06 -> danh dau tu 06/2026 (ngay moi som hon)', nhatKyDau.length === 1 && nhatKyDau[0].ngay === '2026-06-15');
    GIA.hopDong = null; nhatKyDau.length = 0;
    g = await goi(hPut, { params: { id: '55' }, body: { nhanVienId: 3 } });
    kiem('PUT khong doc duoc dong cu, khong ngay moi -> danhDauTuNgay(null), khong no', g.code === 200 && nhatKyDau.length === 1 && nhatKyDau[0].ngay === null);
    GIA.hopDong = { SoHopDong: '07/2026/HĐLĐ', TuNgay: '2026-08-01' };
    nhatKyDau.length = 0;
    g = await goi(hDel, { params: { id: '55' } });
    kiem("DELETE -> doc TuNgay TRUOC khi xoa, danhDauTuNgay('2026-08-01'), ly do 'Xóa hợp đồng số …'", g.code === 200 && nhatKyDau.length === 1 && nhatKyDau[0].ngay === '2026-08-01' && /Xóa hợp đồng số 07/.test(nhatKyDau[0].lyDo));

    GIA.ttLaoDong = 'Chính thức'; nhatKyDau.length = 0;
    g = await goi(hNV, { params: { id: '3' }, body: { hoTen: 'Nguyễn C', trangThaiLaoDong: 'Đã nghỉ việc' } });
    kiem("PUT nhan vien Chinh thuc -> Da nghi viec: danhDauGanDay, ly do co ten", g.code === 200 && nhatKyDau.length === 1 && nhatKyDau[0].loai === 'danhDauGanDay' && /Nguyễn C/.test(nhatKyDau[0].lyDo), JSON.stringify({ g, nhatKyDau }));
    GIA.ttLaoDong = null; nhatKyDau.length = 0;
    g = await goi(hNV, { params: { id: '3' }, body: { hoTen: 'Nguyễn C', trangThaiLaoDong: 'Đã nghỉ việc' } });
    kiem('cot cu NULL (bang luong coi la dang lam) -> Da nghi viec: VAN danh dau', nhatKyDau.length === 1);
    GIA.ttLaoDong = 'Thử việc'; nhatKyDau.length = 0;
    g = await goi(hNV, { params: { id: '3' }, body: { hoTen: 'Nguyễn C', trangThaiLaoDong: 'Chính thức' } });
    kiem('Thu viec -> Chinh thuc: KHONG danh dau (van trong bang)', g.code === 200 && nhatKyDau.length === 0);
    GIA.ttLaoDong = 'Đã nghỉ việc'; nhatKyDau.length = 0;
    g = await goi(hNV, { params: { id: '3' }, body: { hoTen: 'Nguyễn C', trangThaiLaoDong: 'Chính thức' } });
    kiem('Da nghi viec -> Chinh thuc (di lam lai): danh dau', nhatKyDau.length === 1);
    GIA.ttLaoDong = undefined; nhatKyDau.length = 0;
    g = await goi(hNV, { params: { id: '3' }, body: { hoTen: 'Nguyễn C', trangThaiLaoDong: 'Đã nghỉ việc' } });
    kiem('khong doc duoc trang thai cu -> khong danh dau, PUT van 200', g.code === 200 && nhatKyDau.length === 0);
    nhatKyDau.length = 0;
    g = await goi(hTL, { body: { nhanVienId: 3, ngayNghiViec: '2026-11-30' } });
    kiem('POST thanh ly -> danhDauGanDay', g.code === 200 && nhatKyDau.length === 1 && nhatKyDau[0].loai === 'danhDauGanDay', JSON.stringify({ g, nhatKyDau }));
  }
  delete THAY['../utils/bangLuongTuDong'];

  /* ============================================================================================ */
  console.log('\n=== 5. module.payroll.js: dongTuTinh (cat theo dau moc) ===');
  const iA = fFE.indexOf('/* === v9.53 TU TINH LAI — BAT DAU === */'), iB = fFE.indexOf('/* === v9.53 TU TINH LAI — KET THUC === */');
  kiem('co cap dau moc v9.53 TU TINH LAI', iA >= 0 && iB > iA);
  if (iA >= 0 && iB > iA) {
    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    let fe = null;
    try { fe = new Function('escapeHtml', fFE.slice(iA, iB) + '\nreturn { dongTuTinh, fmtLucTuDong };')(esc); }
    catch (e) { sai++; console.log('  ❌ doan dongTuTinh khong chay duoc: ' + e.message); }
    if (fe) {
      kiem("fmtLucTuDong('2026-11-14 09:12') = '09:12 14/11'; chuoi la -> escape", fe.fmtLucTuDong('2026-11-14 09:12') === '09:12 14/11' && fe.fmtLucTuDong('<x>') === '&lt;x&gt;');
      const h1 = fe.dongTuTinh({ daTinhLai: true, luc: '2026-11-14 09:12', lyDo: ['Sửa tay chấm công ngày 03/11/2026', 'Phiếu chi <b>'], ketQua: { thieuHopDong: [{}, {}], canhBao: ['a'] } });
      kiem('daTinhLai -> xanh, "tự tính lại", gio, hai ly do (escape), link xem "2 người chưa có hợp đồng, 1 cảnh báo"',
        /tự tính lại/.test(h1) && /09:12 14\/11/.test(h1) && /Sửa tay chấm công ngày 03\/11\/2026; Phiếu chi &lt;b&gt;/.test(h1) && /id="blXemKq"/.test(h1) && /2 người chưa có hợp đồng, 1 cảnh báo/.test(h1) && /#137333/.test(h1), h1);
      const h1b = fe.dongTuTinh({ daTinhLai: true, luc: '2026-11-14 09:12', lyDo: [], ketQua: { thieuHopDong: [], canhBao: [] } });
      kiem('daTinhLai khong co gi dang xem -> khong co link xem, ly do rong -> "có biến động"', !/blXemKq/.test(h1b) && /có biến động/.test(h1b));
      const h2 = fe.dongTuTinh({ daChot: true, luc: '2026-11-14 09:12', lyDo: ['Chấm KPI tháng 11/2026'] });
      kiem('daChot -> cam, "đã chốt", "không" tu tinh, ly do', /đã chốt/.test(h2) && /không<\/b> tự tính lại/.test(h2) && /Chấm KPI tháng 11\/2026/.test(h2) && /#b06000/.test(h2), h2);
      const h3 = fe.dongTuTinh({ loi: 'Msg 8152', lyDo: ['x'] });
      kiem('loi -> do, "thất bại", cau loi, nhac bam Tinh luong', /thất bại/.test(h3) && /Msg 8152/.test(h3) && /Tính lương/.test(h3) && /#c0392b/.test(h3));
      const h4 = fe.dongTuTinh({ chuaCoBang: true, lyDo: ['x'] });
      kiem('chuaCoBang -> xam, noi thang cu khong tu tao', /không tự tạo/.test(h4));
      const h5 = fe.dongTuTinh({ daTinhLai: false, lanCuoi: { luc: '2026-11-13 23:31', cach: 'tay', lyDo: [] } });
      const h6 = fe.dongTuTinh({ daTinhLai: false, lanCuoi: { luc: '2026-11-13 23:31', cach: 'tuDong', lyDo: ['Tổng hợp chấm công 11/2026'] } });
      kiem('lanCuoi tay -> "bấm Tính lương"; tuDong -> "tự động: ly do"', /23:31 13\/11/.test(h5) && /bấm Tính lương/.test(h5) && /tự động: Tổng hợp chấm công 11\/2026/.test(h6));
      kiem('khong co gi -> chuoi rong (khong ve khung trong)', fe.dongTuTinh(null) === '' && fe.dongTuTinh({}) === '' && fe.dongTuTinh({ daTinhLai: false }) === '');
    }
  }

  /* ============================================================================================ */
  console.log('\n=== 6. SO CHUOI (viet sau cung) ===');
  kiem('payroll.js require utils/bangLuongTuDong', /const bangLuongTuDong = require\('\.\.\/utils\/bangLuongTuDong'\);/.test(fPR));
  kiem('hook: tongHopChamCongThang (nut Tong hop + lich 23:30; v9.55 ca khi ap lai phieu nghi)', /if \(agg\.length( \|\| phieuNghi\.ngay)?\) await bangLuongTuDong\.danhDau\(pool, nam, thang, `Tổng hợp chấm công/.test(fPR));
  kiem('hook: POST /chamcong/ngay (sua tay) theo ngay', /await bangLuongTuDong\.danhDauTheoNgay\(pool, b\.ngay, 'Sửa tay chấm công ngày '/.test(fPR));
  kiem('hook: DELETE /chamcong/ngay-thang', /if \(r\.rowsAffected\[0\]\) await bangLuongTuDong\.danhDau\(pool, nam, thang, `Xóa bảng chấm công/.test(fPR));
  kiem('hook: PUT /kpi/diem + PUT /kpi/sanpham', /`Chấm KPI tháng \$\{thang\}\/\$\{nam\}`/.test(fPR) && /`Ghi thưởng sản phẩm \$\{thang\}\/\$\{nam\}`/.test(fPR));
  kiem('hook: PUT /config + /config/bacthue (gan day) + /config/congchuan (thang do)', /danhDauGanDay\(pool, 'Đổi cấu hình lương'\)/.test(fPR) && /danhDauGanDay\(pool, 'Đổi biểu thuế TNCN'\)/.test(fPR) && /danhDau\(pool, b\.nam, b\.thang, 'Đổi công chuẩn tháng'\)/.test(fPR));
  kiem('GET /bangluong goi tinhLaiNeuCan voi userId va tra tuDong', /const tuDong = await bangLuongTuDong\.tinhLaiNeuCan\(pool, nam, thang, req\.session\.user\.userId\);/.test(fPR) && /rows: data \? data\.rows : \[\], tuDong \}/.test(fPR));
  kiem('GET /bangluong/cuatoi goi tinhLaiNeuCan(…, null) va KHONG tra lyDo', /await bangLuongTuDong\.tinhLaiNeuCan\(pool, nam, thang, null\);/.test(fPR) && /const tuDong = \{ daTinhLai: !!tdDay\.daTinhLai, luc: [^}]*daChot: !!tdDay\.daChot \};/.test(fPR));
  kiem('POST /bangluong/tinh: docMoc truoc, ghiNhanDaTinh tay sau', /const moc = await bangLuongTuDong\.docMoc\(pool, nam, thang\);/.test(fPR) && /kq\.lanCuoi = await bangLuongTuDong\.ghiNhanDaTinh\(pool, nam, thang, kq, moc, 'tay'\);/.test(fPR));
  kiem('cap dau moc TINH BANG LUONG THANG + export', /\/\* === v9\.53 TINH BANG LUONG THANG — BAT DAU === \*\//.test(fPR) && /\/\* === v9\.53 TINH BANG LUONG THANG — KET THUC === \*\//.test(fPR) && /router\.tinhBangLuongThang = tinhBangLuongThang;/.test(fPR));
  kiem('🔴 ruot tinh luong KHONG con req/res (ham thuan, goi duoc tu util)', !/req\.session|res\.status|res\.json/.test(fPR.slice(fPR.indexOf('/* === v9.53 TINH BANG LUONG THANG — BAT DAU === */'), fPR.indexOf('/* === v9.53 TINH BANG LUONG THANG — KET THUC === */')).replace(/\/\*[\s\S]*?\*\//g, '')));
  kiem('hrm.js: require util + hook POST/PUT/DELETE hop dong + nhan vien + thanh ly', /require\('\.\.\/utils\/bangLuongTuDong'\)/.test(fHRM)
    && (fHRM.match(/bangLuongTuDong\.danhDauTuNgay\(/g) || []).length >= 3 && (fHRM.match(/bangLuongTuDong\.danhDauGanDay\(/g) || []).length >= 2
    && /async function docHopDongChoLyDo\(pool, hopDongId\)/.test(fHRM));
  kiem('congno.js: require util + helper doc phieu truoc khi sua/xoa + 3 hook', /require\('\.\.\/utils\/bangLuongTuDong'\)/.test(fCN) && /async function docPhieuChiTamUng\(pool, phieuChiId\)/.test(fCN)
    && (fCN.match(/danhDauThangTamUng\(pool, /g) || []).length >= 4 && /CONVERT\(varchar\(10\), NgayChi, 23\) AS NgayChi/.test(fCN));
  kiem('module.payroll.js: renderLuong ve dongTuTinh(d.tuDong), noi #blXemKq -> hienKetQuaTinh, nut Tinh luong van con', /periodBar\(null, actions\) \+ dongTuTinh\(d\.tuDong\)/.test(fFE) && /querySelector\('#blXemKq'\)/.test(fFE) && /function hienKetQuaTinh\(r, tieuDe\)/.test(fFE) && /id="btnTinh"/.test(fFE));
  kiem('module.payroll.js: khong con cau "bấm Tính lương lại" (nay tu tinh)', !/bấm <b>Tính lương<\/b> lại|bấm Tính lương lại/.test(fFE));
  kiem('v9.54 module.payroll.js: nut Bo chot chi khi da chot + modal ly do + goi PUT /bochot; dong cam v9.53 chi sang Bo chot',
    /perm\.canEdit && daChot \? `<button class="btn small secondary" id="btnBoChot"/.test(fFE) && /function boChotLuong\(header\)/.test(fFE)
    && /apiPut\('\/api\/payroll\/bangluong\/' \+ header\.BangLuongID \+ '\/bochot', \{ lyDo \}\)/.test(fFE) && /bấm <b>🔓 Bỏ chốt<\/b>/.test(fFE));
  kiem('v9.54 payroll.js: route bochot gac edit + luongcongnhat, UPDATE co dieu kien TrangThai=Đã chốt, export bayGio',
    /router\.put\('\/bangluong\/:id\/bochot', requireAuth, requirePermission\('PAYROLL', 'edit'\), requireChucNang\('PAYROLL', 'luongcongnhat'\)/.test(fPR)
    && /WHERE BangLuongID=@id AND TrangThai=N'Đã chốt'/.test(fPR) && /bayGio, docBanDo/.test(fUtil));
  kiem('module.mypay.js: doc cn.tuDong, khong dung lyDo', /const td = cn\.tuDong \|\| \{\};/.test(fMy) && !/tuDong\.lyDo|td\.lyDo/.test(fMy));
  const v = (f) => { const m = new RegExp('/js/' + f + '\\.js\\?v=([0-9.]+)').exec(html); return m ? parseFloat(m[1]) : 0; };
  kiem('index.html: module.payroll.js ?v= >= 9.53, module.mypay.js >= 9.53', v('module\\.payroll') >= 9.53 && v('module\\.mypay') >= 9.53, `payroll ${v('module\\.payroll')} mypay ${v('module\\.mypay')}`);

  Module._load = gocLoad;
  clearTimeout(canhGac);
  console.log(`\n=== KET QUA: ${dat} dat, ${sai} sai ===`);
  process.exit(sai ? 1 : 0);
})().catch(e => { console.log('\n  ❌ BO KIEM VO: ' + (e && e.stack || e)); clearTimeout(canhGac); process.exit(1); });
