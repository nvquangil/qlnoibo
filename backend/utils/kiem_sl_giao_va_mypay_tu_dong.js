/* ================================================================================================
   kiem_sl_giao_va_mypay_tu_dong.js — bo tu kiem cho v9.52 (Nguyen 14/11/2026):
     (1) "Chi tiết gia công thêm cột sl giao"  — tab Luong gia cong / in theu
     (2) "Khi thêm user mới gắn với mã nhân viên auto có chức năng bảng lương của tôi"

   Chay:  node backend\utils\kiem_sl_giao_va_mypay_tu_dong.js
   KHONG copy sang D:\QLSX. KHONG dung toi CSDL (pool gia). Hanh vi truoc, so chuoi sau.
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
const canhGac = setTimeout(() => { console.log('\n  ❌ BO KIEM TREO qua 20 s'); process.exit(1); }, 20000);

const fUsers = doc('backend', 'routes', 'users.js');
const fUtil = doc('backend', 'utils', 'luongGiaCongInThe.js');
const fPR = doc('frontend', 'js', 'module.payroll.js');
const fUS = doc('frontend', 'js', 'module.users.js');
const html = doc('frontend', 'index.html');

console.log('\n=== 1. BIEN DICH (vm.Script) ===');
[['backend/routes/users.js', fUsers], ['backend/utils/luongGiaCongInThe.js', fUtil], ['frontend/js/module.payroll.js', fPR], ['frontend/js/module.users.js', fUS], ['frontend/js/module.congno.js', doc('frontend', 'js', 'module.congno.js')]].forEach(([f, s]) => {
  if (!s) { sai++; console.log('  ❌ ' + f + ' KHONG DOC DUOC'); return; }
  try { new vm.Script(s, { filename: f }); dat++; console.log('  ✓ ' + f); }
  catch (e) { sai++; console.log('  ❌ ' + f + ' VO CU PHAP: ' + e.message); }
});

(async () => {
  /* ---------------------------------------------------------------------------------------------
     2. SL GIAO — util that (khong require gi), pool gia tra dong co SoLuongGiao
     --------------------------------------------------------------------------------------------- */
  console.log('\n=== 2. HANH VI: luongGiaCongInThe tra SoLuongGiao, tongHopTheoNha cong ca SL giao ===');
  const util = require('./luongGiaCongInThe');
  const nhatKy = [];
  const poolGia = {
    request() {
      const r = { input() { return r; }, async query(q) { nhatKy.push(q); const s = q.replace(/\s+/g, ' ');
        if (/COL_LENGTH\('DonHangNhaInTheu','HangMucInThe'\)/.test(s)) return { recordset: [{ c: 1 }] };
        if (/FROM DonHangChiTietNhaGiaCong ct/.test(s)) return { recordset: [{ NhaGiaCongID: 1, TenNha: 'A', SoLuongGiao: 100, SoLuongNhan: 95, ThanhTien: 950 }, { NhaGiaCongID: 1, TenNha: 'A', SoLuongGiao: 50, SoLuongNhan: 50, ThanhTien: 500 }] };
        if (/FROM DonHangNhaInTheu it/.test(s)) return { recordset: [{ NhaGiaCongID: 1, TenNha: 'A', SoLuongGiao: 30, SoLuongNhan: 30, ThanhTien: 300 }] };
        return { recordset: [] }; } };
      return r;
    }
  };
  const gc = await util.loadGiaCong(poolGia, { Int: 'Int' }, {});
  const it = await util.loadInThe(poolGia, { Int: 'Int' }, {});
  const sqlGC = nhatKy.find(q => /FROM DonHangChiTietNhaGiaCong ct/.test(q)) || '';
  const sqlIT = nhatKy.find(q => /FROM DonHangNhaInTheu it/.test(q)) || '';
  kiem('SQL gia cong SELECT ISNULL(ct.SoLuong,0) AS SoLuongGiao (SL GIAO ghi o cong doan GC)', /ISNULL\(ct\.SoLuong,0\) AS SoLuongGiao/.test(sqlGC));
  kiem('SQL in theu SELECT ISNULL(it.SoLuongGiao,0) AS SoLuongGiao', /ISNULL\(it\.SoLuongGiao,0\) AS SoLuongGiao/.test(sqlIT));
  kiem('TIEN van = SL NHAN x don gia (SoLuongGiao KHONG vao ThanhTien)', /ISNULL\(ct\.SoLuongNhan,0\) \* ISNULL\(ISNULL\(dhg\.DonGia, hm\.DonGiaMacDinh\),0\) AS ThanhTien/.test(sqlGC) && !/SoLuongGiao\s*\*/.test(sqlGC) && !/SoLuongGiao\s*\*/.test(sqlIT));
  kiem('van chi lay dong DA NHAN (WHERE SoLuongNhan > 0) — dong giao chua nhan khong vao bang luong', /WHERE ISNULL\(ct\.SoLuongNhan,0\) > 0/.test(sqlGC) && /WHERE ISNULL\(it\.SoLuongNhan,0\) > 0/.test(sqlIT));
  const th = util.tongHopTheoNha([...gc, ...it]);
  kiem('tongHopTheoNha: SoLuongGiao = 100+50+30 = 180, SoLuongNhan = 175, ThanhTien = 1750 (khong doi)', th.length === 1 && th[0].SoLuongGiao === 180 && th[0].SoLuongNhan === 175 && th[0].ThanhTien === 1750, th);
  kiem('dong khong co SoLuongGiao (du lieu cu/kiem cu) -> cong 0, khong NaN', (() => { const t = util.tongHopTheoNha([{ NhaGiaCongID: 2, TenNha: 'B', SoLuongNhan: 1, ThanhTien: 1 }]); return t[0].SoLuongGiao === 0 && t[0].SoLuongNhan === 1; })());

  /* ---------------------------------------------------------------------------------------------
     3. MYPAY TU DONG — cat moBangLuongCuaToi theo dau moc, chay voi pool gia
     --------------------------------------------------------------------------------------------- */
  console.log('\n=== 3. HANH VI: moBangLuongCuaToi(pool, userId) ===');
  const iBat = fUsers.indexOf('/* === v9.52 MYPAY TU DONG — BAT DAU === */');
  const iKet = fUsers.indexOf('/* === v9.52 MYPAY TU DONG — KET THUC === */');
  kiem('tim thay hai dau moc v9.52 trong users.js', iBat > -1 && iKet > iBat);
  if (iBat > -1 && iKet > iBat) {
    const mo = new Function('sql', 'console', fUsers.slice(iBat, iKet) + '\nreturn moBangLuongCuaToi;')({ Int: 'Int' }, { warn: () => {} });
    function taoPool(cfg) {
      const nk = [];
      const pool = { request() { const inputs = {}; const r = { input(t, k, v) { inputs[t] = v; return r; }, async query(q) {
        const s = q.replace(/\s+/g, ' '); nk.push({ q: s, inputs: { ...inputs } });
        if (cfg.nem) throw new Error(cfg.nem);
        if (/FROM Modules WHERE ModuleCode = N'MYPAY'/.test(s)) return { recordset: cfg.coModule === false ? [] : [{ ModuleID: 9 }] };
        if (/FROM ChucNang WHERE ModuleCode = N'MYPAY' AND MaChucNang = N'luongcuatoi'/.test(s)) return { recordset: cfg.coChucNang === false ? [] : [{ ChucNangID: 77 }] };
        if (/^MERGE/.test(s)) return { rowsAffected: [1] };
        throw new Error('query la: ' + s); } }; return r; } };
      return { pool, nk };
    }
    let { pool, nk } = taoPool({});
    let ok = await mo(pool, 5);
    const mergeUP = nk.find(x => /MERGE UserPermissions/.test(x.q));
    const mergeCN = nk.find(x => /MERGE UserChucNangPermissions/.test(x.q));
    kiem('binh thuong -> true, MERGE UserPermissions (module MYPAY) cho dung user: CanView=1, 3 co kia 0, da co dong thi bat CanView', ok === true && !!mergeUP
      && mergeUP.inputs.uid === 5 && mergeUP.inputs.mid === 9 && /WHEN MATCHED THEN UPDATE SET CanView = 1/.test(mergeUP.q) && /VALUES \(@uid, @mid, 1, 0, 0, 0\)/.test(mergeUP.q), mergeUP);
    kiem('MERGE UserChucNangPermissions cho MYPAY/luongcuatoi: CanView=1 (ke ca nhom dang an tab)', !!mergeCN && mergeCN.inputs.uid === 5 && mergeCN.inputs.cnid === 77
      && /WHEN MATCHED THEN UPDATE SET CanView = 1/.test(mergeCN.q) && /VALUES \(@uid, @cnid, 1, 0, 0\)/.test(mergeCN.q), mergeCN);
    kiem('KHONG dung toi Permissions theo NHOM (khong sua quyen cua ca nhom)', !nk.some(x => /MERGE Permissions |UPDATE Permissions|INSERT INTO Permissions/.test(x.q)));
    ({ pool, nk } = taoPool({ coModule: false }));
    ok = await mo(pool, 5);
    kiem('chua co module MYPAY (chua chay migration_v620) -> false, khong MERGE gi', ok === false && !nk.some(x => /^MERGE/.test(x.q)));
    ({ pool, nk } = taoPool({ coChucNang: false }));
    ok = await mo(pool, 5);
    kiem('khong co dong ChucNang MYPAY/luongcuatoi -> van MERGE UserPermissions, bo qua phan chuc nang, true', ok === true && nk.some(x => /MERGE UserPermissions/.test(x.q)) && !nk.some(x => /MERGE UserChucNangPermissions/.test(x.q)));
    ({ pool, nk } = taoPool({ nem: 'Invalid object name UserPermissions' }));
    ok = await mo(pool, 5);
    kiem('thieu bang (chua chay migration_v5_userperm) -> false, KHONG nem (khong lam hong tao/sua user)', ok === false);
  }

  /* ---------------------------------------------------------------------------------------------
     4. NOI VAO ROUTE + GIAO DIEN (so chuoi tren ban da bo comment)
     --------------------------------------------------------------------------------------------- */
  console.log('\n=== 4. ROUTE users.js + GIAO DIEN ===');
  const us = boComment(fUsers);
  kiem('POST /users: co nhanVienId thi goi moBangLuongCuaToi, tra daMoMyPay', /const daMoMyPay = nhanVienId \? await moBangLuongCuaToi\(pool, userId\) : false;/.test(us) && /data: \{ userId, daMoMyPay \}/.test(us));
  kiem('PUT /users/:id: doc NhanVienID TRUOC khi sua, chi mo khi LIEN KET MOI (null -> co, hoac doi nguoi)', /SELECT NhanVienID FROM Users WHERE UserID=@id/.test(us)
    && /const lienKetMoi = !!nhanVienId && String\(nhanVienId\) !== String\(truoc\.NhanVienID \|\| ''\);/.test(us) && /const daMoMyPay = lienKetMoi \? await moBangLuongCuaToi\(pool, id\) : false;/.test(us));
  kiem('PUT: go lien ket (nhanVienId null) KHONG goi mo (khong tu thu hoi, khong cap them)', /lienKetMoi = !!nhanVienId/.test(us));
  const usFE = boComment(fUS);
  kiem('module.users.js: luu xong doc r.data.daMoMyPay -> toast "da tu bat Bang luong cua toi", nhac dang nhap lai', /const r = isEdit \? await apiPut\('\/api\/users\/' \+ row\.UserID, body\) : await apiPost\('\/api\/users', body\);/.test(usFE)
    && /if \(r && r\.data && r\.data\.daMoMyPay\) toast\(/.test(usFE) && /đăng nhập lại/.test(usFE));
  const pr = boComment(fPR);
  kiem('tab Luong GC/in theu: 2 bang tong hop theo nha co cot "Tổng SL giao" truoc "Tổng SL nhận" (man + ban in)', (pr.match(/<th>Tổng SL giao<\/th><th>Tổng SL nhận<\/th>/g) || []).length === 2 && (pr.match(/\$\{num\(r\.SoLuongGiao\)\}/g) || []).length >= 6);
  kiem('2 bang chi tiet tren man: cot SL giao truoc SL nhan, colspan dong trong = 8', (pr.match(/<th>SL giao<\/th><th>SL nhận<\/th>/g) || []).length >= 2 && /colspan="8" class="empty-hint">Không có dữ liệu gia công/.test(pr) && /colspan="8" class="empty-hint">Không có dữ liệu in thêu/.test(pr));
  kiem('modal + ban in "Chi tiết gia công / in thêu — nhà": head co SL giao, span = 6, dong TONG 8 o', /<th>Hạng mục<\/th><th>SL giao<\/th><th>SL nhận<\/th>/.test(pr) && /<th>Hạng mục in thêu<\/th><th>SL giao<\/th><th>SL nhận<\/th>/.test(pr) && /const span = 6;/.test(pr) && /colspan="\$\{span \+ 2\}"/.test(pr));
  kiem('ghi chu duoi bang: SL giao chi de doi chieu, tien theo SL nhan, loc theo thang QC (het cau "CreatedAt" sai tu v8.61)', /<b>SL giao<\/b> \(ghi ở Giao gia công \/ Giao in thêu\) chỉ để đối chiếu/.test(pr) && /Lọc theo tháng QC/.test(pr) && !/Lọc theo tháng tạo dòng giao \(CreatedAt\)/.test(pr));
  /* ---------------------------------------------------------------------------------------------
     5. PHIEU CHI TAM UNG — ban in ghi ro "TAM UNG — TRU VAO LUONG THANG m/yyyy" (Nguyen 14/11)
     --------------------------------------------------------------------------------------------- */
  console.log('\n=== 5. HANH VI: dongTamUngTruLuong(r) (module.congno.js) ===');
  const fCN = doc('frontend', 'js', 'module.congno.js');
  {
    const i = fCN.indexOf('function dongTamUngTruLuong(r) {');
    const j = fCN.indexOf('\n  }', i);
    kiem('cat duoc dongTamUngTruLuong', i > -1 && j > i);
    if (i > -1 && j > i) {
      const f = new Function(fCN.slice(i, j + 4) + '\nreturn dongTamUngTruLuong;')();
      kiem("tam ung co khai thang/nam -> 'TẠM ỨNG — TRỪ VÀO LƯƠNG THÁNG 12/2026'", f({ LoaiChiNV: 'TamUng', TruLuongThang: 12, TruLuongNam: 2026, NgayChi: '2026-11-28' }) === 'TẠM ỨNG — TRỪ VÀO LƯƠNG THÁNG 12/2026');
      kiem('phieu cu chua khai thang -> thang cua NGAY CHI (dung luat tamUngNhanVien.js)', f({ LoaiChiNV: 'TamUng', NgayChi: '2026-11-05' }) === 'TẠM ỨNG — TRỪ VÀO LƯƠNG THÁNG 11/2026');
      kiem('NgayChi dang Date cung dung', f({ LoaiChiNV: 'TamUng', NgayChi: new Date(2026, 9, 15) }) === 'TẠM ỨNG — TRỪ VÀO LƯƠNG THÁNG 10/2026');
      kiem("khong phai tam ung (Khac / CongTacPhi / null) -> '' (khong in gi)", f({ LoaiChiNV: 'Khac', TruLuongThang: 11, NgayChi: '2026-11-05' }) === '' && f({ LoaiChiNV: 'CongTacPhi' }) === '' && f({}) === '' && f(null) === '');
      kiem('tam ung ma khong co ngay/thang gi -> van ghi TẠM ỨNG — TRỪ VÀO LƯƠNG, khong NaN', f({ LoaiChiNV: 'TamUng', NgayChi: 'abc' }) === 'TẠM ỨNG — TRỪ VÀO LƯƠNG');
    }
  }
  const cn = boComment(fCN);
  kiem('ban in phieu CHI: cau tam ung in dam trong khung, ngay duoi "Lý do chi"; phieu THU khong co', /const tamUng = laThu \? '' : dongTamUngTruLuong\(r\);/.test(cn) && /\$\{dong\(laThu \? 'Lý do nộp' : 'Lý do chi', r\.DienGiai\)\}\s*\$\{tamUng \? `<p style="margin:6px 0;"><span style="display:inline-block;border:1\.5px solid #000;/.test(cn));
  kiem('danh sach phieu chi + popup chung tu cung hien cau do (cung mot ham, khong hai cach viet)', /dongTamUngTruLuong\(r\) \? `<div style="font-size:11px;color:#b06000;font-weight:600;">/.test(cn) && /loai === 'PC' && dongTamUngTruLuong\(h\) \?/.test(cn));
  kiem('GET /phieuchi va utils/chungTu.js PC deu SELECT c.* (co LoaiChiNV/TruLuongThang/TruLuongNam cho ban in)', /SELECT c\.\*, tk\.MaTK, tk\.TenTK, l\.TenLoai AS TenLoaiTK/.test(doc('backend', 'routes', 'congno.js')) && /SELECT c\.\*, tk\.MaTK, tk\.TenTK, ncc\.TenNCC, u\.HoTen AS NguoiTao\s+FROM PhieuChi c/.test(doc('backend', 'utils', 'chungTu.js')));

  const v = (f) => { const x = new RegExp(f.replace(/\./g, '\\.') + '\\?v=([\\d.]+)').exec(html); return x ? parseFloat(x[1]) : 0; };
  kiem('index.html bump module.payroll.js / module.users.js / module.congno.js >= 9.52', v('module.payroll.js') >= 9.52 && v('module.users.js') >= 9.52 && v('module.congno.js') >= 9.52, { payroll: v('module.payroll.js'), users: v('module.users.js'), congno: v('module.congno.js') });

  clearTimeout(canhGac);
  console.log(`\n=== KET QUA: ${dat} dat, ${sai} sai ===`);
  process.exit(sai ? 1 : 0);
})().catch(e => { console.error('VO: ' + (e && e.stack || e)); process.exit(1); });
