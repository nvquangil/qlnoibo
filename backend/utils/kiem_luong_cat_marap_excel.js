/* ================================================================================================
   kiem_luong_cat_marap_excel.js  —  bo tu kiem cho v9.19
   "Luong trai vai cat / bang Ban cat theo lenh SX:
      (1) cot Ngay QC  -> NGAY CAT (theo ngay ghi tien do, nhieu so do thi hien khoang dau–cuoi)
      (2) cot Ma hang  -> MA RAP (nguon cong doan Ky thuat, dung chung utils/maRapCuaDon.js)
      (3) them nut XUAT EXCEL (3 sheet, cung bo so voi man hinh)"

   Chay:  node backend\utils\kiem_luong_cat_marap_excel.js
   KHONG copy file nay sang D:\QLSX.
   ================================================================================================ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const GOC = path.join(__dirname, '..', '..');
const be = fs.readFileSync(path.join(GOC, 'backend', 'routes', 'payroll.js'), 'utf8');
const fe = fs.readFileSync(path.join(GOC, 'frontend', 'js', 'module.payroll.js'), 'utf8');
const html = fs.readFileSync(path.join(GOC, 'frontend', 'index.html'), 'utf8');
let sai = 0, dat = 0;
function kiem(ten, dung, td) {
  if (dung) { dat++; console.log('  ✓ ' + ten); }
  else { sai++; console.log('  ❌ ' + ten + (td ? ' — ' + td : '')); }
}

console.log('\n=== 1. BIEN DICH (thay cho node --check) ===');
[['backend/routes/payroll.js', be], ['frontend/js/module.payroll.js', fe]].forEach(([f, s]) => {
  try { new vm.Script(s, { filename: f }); dat++; console.log('  ✓ ' + f); }
  catch (e) { sai++; console.log('  ❌ ' + f + ' VO CU PHAP: ' + e.message); }
});

/* Cat mot khoi bat dau tu `moc`, can ngoac nhon tu dau `{` dau tien. Dung duoc cho ca
   `function X(...) {...}` lan `const X = (...) => {...}`. */
function trichKhoi(nguon, moc) {
  const i = nguon.indexOf(moc);
  if (i < 0) return null;
  let mo = 0, j = nguon.indexOf('{', i);
  if (j < 0) return null;
  for (; j < nguon.length; j++) {
    if (nguon[j] === '{') mo++;
    else if (nguon[j] === '}') { mo--; if (mo === 0) return nguon.slice(i, j + 1); }
  }
  return null;
}

console.log('\n=== 2. NGAY CAT: HAI BAN (backend chuoiNgayCat / frontend khoangNgayCat) PHAI RA CUNG KET QUA ===');
const thanDd = trichKhoi(be, 'const ddmmyyyy =');
const thanBe = trichKhoi(be, 'function chuoiNgayCat(');
const thanFe = trichKhoi(fe, 'function khoangNgayCat(');
kiem('tim thay ddmmyyyy + chuoiNgayCat (BE) + khoangNgayCat (FE)', !!thanDd && !!thanBe && !!thanFe);
if (thanDd && thanBe && thanFe) {
  let fBe = null, fFe = null;
  try {
    const s1 = {};
    vm.runInNewContext(thanDd + ';' + thanBe + '; __r = chuoiNgayCat;', s1);
    fBe = s1.__r;
    /* FE goi fmtDate() cua common.js — cap dung ddmmyyyy cua BACKEND lam fmtDate gia. Nho vay hai
       ban chay tren CUNG mot bo dinh dang, phep so duoi day chi con so SAI KHAC VE QUY TAC GOP. */
    const s2 = {};
    vm.runInNewContext(thanDd + '; const fmtDate = ddmmyyyy;' + thanFe + '; __r = khoangNgayCat;', s2);
    fFe = s2.__r;
  } catch (e) { sai++; console.log('  ❌ khong nap duoc ham: ' + e.message); }
  if (fBe && fFe) {
    const N = (y, m, d) => new Date(y, m - 1, d);
    const CA = [
      ['cung mot ngay -> hien MOT ngay', { NgayCatDau: N(2026, 10, 15), NgayCatCuoi: N(2026, 10, 15) }, '15/10/2026'],
      ['nhieu ngay -> KHOANG dau – cuoi', { NgayCatDau: N(2026, 10, 15), NgayCatCuoi: N(2026, 10, 18) }, '15/10/2026 – 18/10/2026'],
      ['vat thang', { NgayCatDau: N(2026, 9, 28), NgayCatCuoi: N(2026, 10, 2) }, '28/09/2026 – 02/10/2026'],
      ['chi co ngay dau', { NgayCatDau: N(2026, 10, 15), NgayCatCuoi: null }, '15/10/2026'],
      ['khong co ngay nao -> rong', { NgayCatDau: null, NgayCatCuoi: null }, ''],
      ['doi tuong rong -> rong (khong no)', {}, '']
    ];
    CA.forEach(([ten, o, mong]) => {
      let rBe = '(loi)', rFe = '(loi)';
      try { rBe = fBe(o); } catch (e) { /* giu '(loi)' */ }
      try { rFe = fFe(o); } catch (e) { /* giu '(loi)' */ }
      kiem(`${ten}: BE="${rBe}"`, rBe === mong, `mong "${mong}"`);
      kiem(`${ten}: FE khop BE`, rFe === rBe, `FE="${rFe}" vs BE="${rBe}"`);
    });
    kiem('KHONG dung toISOString (lech 1 ngay voi gio VN)', !thanDd.includes('toISOString'));
  }
}

console.log('\n=== 3. KIEM HANH VI tongHopLuongCat: MIN/MAX ngay cat + gop MA RAP distinct ===');
const thanTH = trichKhoi(be, 'function tongHopLuongCat(');
kiem('tim thay tongHopLuongCat', !!thanTH);
if (thanTH) {
  let fTH = null;
  try { const s = {}; vm.runInNewContext(thanTH + '; __r = tongHopLuongCat;', s); fTH = s.__r; }
  catch (e) { sai++; console.log('  ❌ khong nap duoc tongHopLuongCat: ' + e.message); }
  if (fTH) {
    const N = (y, m, d) => new Date(y, m - 1, d);
    const soDo = [
      { DonHangID: 1, MaDH: 'DH01', MaSanPham: 'SP1', TenSanPham: 'Quan', NgayGhiNhan: N(2026, 10, 18), MaRap: 'MR1', TongLop: 10, ThanhTien: 100 },
      { DonHangID: 1, MaDH: 'DH01', MaSanPham: 'SP1', TenSanPham: 'Quan', NgayGhiNhan: N(2026, 10, 15), MaRap: ' MR2 ', TongLop: 5, ThanhTien: 50 },
      { DonHangID: 1, MaDH: 'DH01', MaSanPham: 'SP1', TenSanPham: 'Quan', NgayGhiNhan: N(2026, 10, 16), MaRap: 'MR1', TongLop: 5, ThanhTien: 50 },
      { DonHangID: 2, MaDH: 'DH02', MaSanPham: 'SP2', TenSanPham: 'Ao', NgayGhiNhan: N(2026, 10, 20), MaRap: null, TongLop: 7, ThanhTien: 70 }
    ];
    const nv = [{ NhanVienID: 9, HoTen: 'A', TongGioLam: 10, HeSoLuong: 1 }];
    let th = null;
    try { th = fTH(soDo, nv); } catch (e) { sai++; console.log('  ❌ chay tongHopLuongCat loi: ' + e.message); }
    if (th) {
      const d1 = (th.theoDon || []).find(x => x.DonHangID === 1) || {};
      const d2 = (th.theoDon || []).find(x => x.DonHangID === 2) || {};
      const iso = (d) => (d ? new Date(d).getDate() : 0);
      kiem('lenh nhieu so do: NgayCatDau = ngay SOM nhat (15/10)', iso(d1.NgayCatDau) === 15);
      kiem('lenh nhieu so do: NgayCatCuoi = ngay MUON nhat (18/10)', iso(d1.NgayCatCuoi) === 18);
      kiem('mot so do: dau = cuoi (20/10)', iso(d2.NgayCatDau) === 20 && iso(d2.NgayCatCuoi) === 20);
      kiem('MaRap gop DISTINCT + trim, giu thu tu gap', d1.MaRap === 'MR1, MR2', `duoc "${d1.MaRap}"`);
      kiem('MaRap trong -> chuoi rong (khong "null")', d2.MaRap === '', `duoc "${d2.MaRap}"`);
      kiem('so do / tong lop / tien van cong dung nhu cu', d1.SoSoDo === 3 && d1.TongLop === 20 && d1.ThanhTien === 200 && th.quy === 270);
    }
  }
}

console.log('\n=== 4. MA RAP lay tu cong doan KY THUAT (dung chung util, khong chep SQL) ===');
kiem('payroll.js nhap maRapTheoDon tu utils/maRapCuaDon',
     /const \{ maRapTheoDon \} = require\('\.\.\/utils\/maRapCuaDon'\);/.test(be));
kiem('KHONG chep tay cau SQL ma rap vao payroll.js (bai hoc v6.06 + v7.67)',
     !/SELECT MaRap FROM DonHangChiTietSoDo/.test(be) && !/UNION ALL\s*\n\s*SELECT MaRap FROM TienDoSanXuat/.test(be));
kiem('route /luongtraivaicat co gan ma rap cho tung lenh',
     /await ganMaRapChoLenh\(pool, th\.theoDon\);/.test(be));
/* Thu tu nay la KET LUAN cua ra soat cheo v9.19: ma rap cua SO DO TRONG KY di TRUOC, lui ve ma rap
   CA LENH khi trong. Dao thu tu la lenh cat do nhieu thang hien du ma rap cua ca lenh canh "So so do"
   cua rieng ky — nguoi doi chieu tuong thieu so do. */
kiem('ganMaRapChoLenh: ma rap trong KY truoc, lui ve ca lenh khi trong',
     /o\.MaRap = o\.MaRap \|\| mr\[o\.DonHangID\] \|\| '';/.test(be));
kiem('man chi tiet lenh + sheet Excel cung lui ve ma rap ca lenh (khong noi khac nhau)',
     /\$\{escapeHtml\(String\(s\.MaRap \|\| ''\)\.trim\(\) \|\| o\.MaRap \|\| ''\)\}/.test(fe)
       && /String\(s\.MaRap \|\| ''\)\.trim\(\) \|\| maRapTheoLenh\[s\.DonHangID\] \|\| ''/.test(be));

console.log('\n=== 5. XUAT EXCEL ===');
kiem('co route GET /luongtraivaicat/excel, gac dung quyen cua chinh man',
     /router\.get\('\/luongtraivaicat\/excel', requireAuth, requirePermission\('PAYROLL', 'view'\), requireChucNang\('PAYROLL', 'luongtraivaicat'\)/.test(be));
const fnEx = trichKhoi(be, "router.get('/luongtraivaicat/excel'");
kiem('Excel goi LAI chinh loader cua man (khong viet cau SQL thu hai)',
     !!fnEx && /loadSoDoCat\(pool, nam, thang, cfg\.donGia\)/.test(fnEx) && /loadGioCongCat\(pool, nam, thang\)/.test(fnEx)
       && /tongHopLuongCat\(soDo, nvRaw\)/.test(fnEx) && /ganMaRapChoLenh\(pool, th\.theoDon\)/.test(fnEx),
     'hai nguon so lieu khac nhau la file Excel va man hinh lech nhau');
kiem('du BA sheet: luong NV cat / ban cat theo lenh / chi tiet so do',
     !!fnEx && /addWorksheet\(`Luong NV cat T\$\{thang\}-\$\{nam\}`\)/.test(fnEx)
       && /addWorksheet\(`Ban cat theo lenh`\)/.test(fnEx) && /addWorksheet\(`Chi tiet so do`\)/.test(fnEx));
kiem('sheet "Ban cat theo lenh" dung dung cot cua man: Ma rap + Ngay cat',
     !!fnEx && /\['Mã ĐH', 'Mã rập', 'Tên sản phẩm', 'Ngày cắt', 'Số sơ đồ', 'Tổng lớp', 'Thành tiền'\]/.test(fnEx));
kiem('Excel dung chuoiNgayCat (cung quy tac voi man hinh)', !!fnEx && /chuoiNgayCat\(o\)/.test(fnEx));
kiem('dat ten file + content-type xlsx',
     !!fnEx && /filename="LuongTraiVaiCat_T\$\{thang\}_\$\{nam\}\.xlsx"/.test(fnEx)
       && /spreadsheetml\.sheet/.test(fnEx));
kiem('frontend: co nut Xuat Excel + noi day bang downloadFile dung duong dan',
     /id="btnExCat">📊 Xuất Excel<\/button>/.test(fe)
       && /downloadFile\(\s*`\/api\/payroll\/luongtraivaicat\/excel\?nam=\$\{selNam\}&thang=\$\{selThang\}`/.test(fe));

console.log('\n=== 6. v9.20: PHIEU LUONG 1 NV chi hien BAN CAT NGUOI DO THAM GIA ===');
const thanLoc = trichKhoi(fe, 'function laBanCuaNV(');
kiem('tim thay laBanCuaNV', !!thanLoc);
if (thanLoc) {
  let fLoc = null;
  try { const s = {}; vm.runInNewContext(thanLoc + '; __r = laBanCuaNV;', s); fLoc = s.__r; }
  catch (e) { sai++; console.log('  ❌ khong nap duoc laBanCuaNV: ' + e.message); }
  if (fLoc) {
    const CA = [
      ['nguoi CAT ban do -> nhan', () => fLoc({ NhanVienCatID: 7, NhanVienTraiVaiIDs: '3,9' }, 7)],
      ['nguoi TRAI VAI (nhieu nguoi) -> nhan', () => fLoc({ NhanVienCatID: 7, NhanVienTraiVaiIDs: '3,9' }, 9)],
      ['mot nguoi trai vai duy nhat -> nhan', () => fLoc({ NhanVienCatID: null, NhanVienTraiVaiIDs: '5' }, 5)],
      ['khong tham gia -> loai', () => !fLoc({ NhanVienCatID: 7, NhanVienTraiVaiIDs: '3,9' }, 4)],
      ['id la CHUOI vs SO deu khop (du lieu tu API)', () => fLoc({ NhanVienCatID: '7', NhanVienTraiVaiIDs: '3,9' }, 7) && fLoc({ NhanVienCatID: 7, NhanVienTraiVaiIDs: ' 9 ' }, '9')],
      ['KHONG khop nham theo tien to: id 9 khong an id 19', () => !fLoc({ NhanVienCatID: 19, NhanVienTraiVaiIDs: '19,29' }, 9),
        'tung co bug kieu includes(chuoi) an ca "19"'],
      ['ban khong co ai -> loai', () => !fLoc({ NhanVienCatID: null, NhanVienTraiVaiIDs: null }, 7)],
      ['khong truyen nvId -> nhan HET (nhanh ca quy)', () => fLoc({ NhanVienCatID: 7, NhanVienTraiVaiIDs: '3' }, null)]
    ];
    CA.forEach(([ten, phep, td]) => { let ok = false; try { ok = phep(); } catch (e) { ok = false; } kiem(ten, ok, td); });
  }
}
kiem('backend tra NhanVienCatID + NhanVienTraiVaiIDs (loc theo ID, khong theo ten)',
     /td\.NhanVienCatID,/.test(be) && /\) AS NhanVienTraiVaiIDs/.test(be)
       && /CAST\(tv\.NhanVienID AS NVARCHAR\(20\)\)/.test(be),
     'loc theo ten la hai nguoi trung ho ten hien nham ban cua nhau');
kiem('phieu luong NV goi buildLuongCatQuyBody CO tham so nv (loc)',
     /\$\{buildLuongCatQuyBody\(d, nv\)\}/.test(fe));
kiem('ban QUY (ca bo phan) van goi KHONG tham so — khong bi loc nham',
     /buildLuongCatQuyBody\(d\)\)/.test(fe));
const fnQuyBody = trichKhoi(fe, 'function buildLuongCatQuyBody(');
kiem('tong cua lenh tinh lai tu cac so do DANG HIEN (khong lay o.ThanhTien cua ca lenh)',
     !!fnQuyBody && /const tienLenh = soDoCuaDon\.reduce/.test(fnQuyBody) && /money\(tienLenh\)/.test(fnQuyBody)
       && !/money\(o\.ThanhTien\)/.test(fnQuyBody),
     'khong tinh lai thi loc con 1 so do ma dong lenh van hien tien ca lenh');
kiem('noi RO luong khong bang tong tien cac ban nay (chia theo gio cong)',
     /KHÔNG<\/b> bằng tổng tiền các bàn dưới đây/.test(fe));
/* 🔴 HAI PHEP DUOI = LO TIEN BAC (ra soat cheo v9.20 chi ra): neu ai do lo truyen `nv` vao hai cho
   nay thi BAN IN CA BO PHAN bi loc im lang, hoac bang tom tat cua phieu luong lay so DA LOC lam
   "Quy luong cat thang" — luong sai ma moi phep kiem khac van xanh. */
kiem('ban in CA BO PHAN (In quy + In bang luong) goi buildLuongCatQuyBody KHONG tham so',
     (fe.match(/buildLuongCatQuyBody\(d\)[\)\}]/g) || []).length === 2,
     'dung 2 cho: nut In quy + buildLuongCatBangBody');
const fnNVBody = trichKhoi(fe, 'function buildLuongCatNVBody(');
kiem('bang tom tat phieu luong NV van lay so TOAN BO PHAN (d.quy / d.tongGio / d.donGiaGio)',
     !!fnNVBody && /money\(d\.quy\)/.test(fnNVBody) && /num\(d\.tongGio\)/.test(fnNVBody)
       && /money\(d\.donGiaGio\)/.test(fnNVBody),
     'thay bang so da loc la luong 1 gio sai => luong sai');
kiem('ban loc ghi ro "tham gia / cả lệnh" de khong tuong thieu so do',
     /sơ đồ \(tham gia \/ cả lệnh\)/.test(fe));

console.log('\n=== 7. BUMP ===');
kiem('index.html bump module.payroll.js?v >= 9.20', (() => { const m = /module\.payroll\.js\?v=([\d.]+)/.exec(html); return !!m && parseFloat(m[1]) >= 9.20; })());

console.log('\n' + '='.repeat(70));
console.log(sai === 0 ? `✅ ${dat} phep DAT, 0 sai` : `❌ ${sai} SAI / ${dat + sai} phep`);
console.log('='.repeat(70) + '\n');
process.exit(sai === 0 ? 0 : 1);
