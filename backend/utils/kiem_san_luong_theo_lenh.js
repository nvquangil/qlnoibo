/* ================================================================================================
   kiem_san_luong_theo_lenh.js — bo tu kiem v9.67 (Nguyen 16/11/2026):
   "Chi dinh san xuat them truong nhan vien may mau... Cap nhat anh, video gan theo lenh san xuat — SL x don gia
    theo danh muc hop dong, phan tinh luong cap nhat tu day, khong cap nhat tay."
     1. Bien dich 6 file + migration_v895 co du 3 muc.
     2. utils/sanLuongTheoLenh.js chay THAT voi pool gia: thuongTheoThang (khop ten khong phan biet hoa/thuong,
        khong khop = 0, nhieu nguoi), tenMayMauTrong, dongBoMayMau (xoa roi chen 1 dong MayMau, danh dau luong 2 thang).
     3. routes/qlsx.js: POST + PUT goi ghiNhanVienMayMau; 5 route /sanluong; dong MayMau khong sua/xoa tay.
     4. routes/payroll.js: spMap CONG them thuongTheoThang; GET /kpi tra sanPhamTuLenh + tienTuLenh.
     5. Giao dien: o chon o 2 form lenh + payload; tab sanluong + render; module.payroll hien phan tu lenh; ?v>=9.67.
   Chay: node backend\utils\kiem_san_luong_theo_lenh.js — KHONG dung CSDL.
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

console.log('\n=== 1. BIEN DICH + MIGRATION ===');
['backend/routes/qlsx.js', 'backend/routes/payroll.js', 'backend/utils/sanLuongTheoLenh.js', 'frontend/js/module.qlsx.js', 'frontend/js/module.payroll.js', 'frontend/js/module.hrm.js', 'frontend/js/module.mypay.js'].forEach(f => {
  const s = doc(...f.split('/')); if (!s) { sai++; console.log('  ❌ ' + f + ' KHONG DOC DUOC'); return; }
  try { new vm.Script(s, { filename: f }); dat++; console.log('  ✓ ' + f); } catch (e) { sai++; console.log('  ❌ ' + f + ' VO CU PHAP: ' + e.message); }
});
const mg = doc('database', 'migration_v895.sql');
kiem('migration_v895: cot NhanVienMayMauID + bang SanLuongTheoLenh (FK DonHang CASCADE) + CHECK Nguon + ChucNang QLSX/sanluong',
  /ALTER TABLE DonHangSanXuat ADD NhanVienMayMauID INT NULL/.test(mg) && /CREATE TABLE SanLuongTheoLenh/.test(mg)
  && /REFERENCES DonHangSanXuat\(DonHangID\) ON DELETE CASCADE/.test(mg) && /CHECK \(Nguon IN \(N'MayMau', N'Tay'\)\)/.test(mg)
  && /\('QLSX', 'sanluong'/.test(mg) && /IF COL_LENGTH\('DonHangSanXuat', 'NhanVienMayMauID'\) IS NULL/.test(mg));

(async () => {
  console.log('\n=== 2. utils/sanLuongTheoLenh.js — chay that voi pool gia ===');
  const Module = require('module');
  const gocLoad = Module._load;
  const sqlGia = new Proxy({}, { get(_, k) { const f = () => k; f.toString = () => String(k); return f; } });
  const danhDau = [];
  Module._load = function (ten) {
    if (ten === '../db') return { sql: sqlGia, getPool: async () => null };
    if (ten === './bangLuongTuDong') return { danhDauTheoNgay: async (p, ngay, ly) => { danhDau.push({ ngay, ly }); return true; }, danhDau: async () => true };
    return gocLoad.apply(this, arguments);
  };
  const sl = require(path.join(GOC, 'backend', 'utils', 'sanLuongTheoLenh.js'));
  const daChay = [];
  const poolGia = (tra) => ({ request: () => { const inp = {}; const rq = { input(k, t, v) { inp[k] = v; return rq; }, async query(q) { const s = String(q).replace(/\s+/g, ' ').trim(); daChay.push({ s, inp: { ...inp } }); return { recordset: tra(s, inp) }; } }; return rq; } });

  kiem('khoaTen: hoa/thuong + khoang trang', sl.khoaTen('  Ảnh  Sản phẩm ') === 'ảnh sản phẩm' && sl.khoaTen('VIDEO') === 'video');
  kiem('tenMayMauTrong: lay dong co chu "mẫu"/"mau", khong co -> "May mẫu"',
    sl.tenMayMauTrong([{ TenSanPham: 'Ảnh' }, { TenSanPham: 'May MẪU áo' }]) === 'May MẪU áo' && sl.tenMayMauTrong([{ TenSanPham: 'Anh' }, { TenSanPham: 'May mau' }]) === 'May mau'
    && sl.tenMayMauTrong([{ TenSanPham: 'Ảnh' }]) === 'May mẫu' && sl.tenMayMauTrong([]) === 'May mẫu');

  /* thuongTheoThang: NV1 co HD 10 (Ảnh 50.000, Video 200.000); NV2 khong co HD. */
  const pool1 = poolGia((s) => {
    if (/OBJECT_ID\('SanLuongTheoLenh'/.test(s)) return [{ c: 1 }];
    if (/FROM SanLuongTheoLenh WHERE YEAR/.test(s)) return [{ NhanVienID: 1, TenSanPham: 'Ảnh', SoLuong: 12, SoLenh: 3 }, { NhanVienID: 1, TenSanPham: 'video', SoLuong: 2, SoLenh: 2 }, { NhanVienID: 1, TenSanPham: 'Clip', SoLuong: 5, SoLenh: 1 }, { NhanVienID: 2, TenSanPham: 'May mẫu', SoLuong: 1, SoLenh: 1 }];
    if (/OUTER APPLY/.test(s)) return [{ NhanVienID: 1, HopDongID: 10 }, { NhanVienID: 2, HopDongID: null }];
    if (/FROM HopDongSanPham WHERE HopDongID IN/.test(s)) return [{ HopDongID: 10, TenSanPham: 'Ảnh', DonGia: 50000 }, { HopDongID: 10, TenSanPham: 'Video', DonGia: 200000 }];
    return [];
  });
  const kq = await sl.thuongTheoThang(pool1, 2026, 11);
  const nv1 = kq.get(1), nv2 = kq.get(2);
  kiem('NV1: 12 x 50.000 + 2 x 200.000 ("video" khop "Video") = 1.000.000; "Clip" khong khop = 0 + co khop=false', nv1 && nv1.tien === 1000000 && nv1.dong.length === 3 && nv1.dong.find(d => d.TenSanPham === 'Clip').khop === false && nv1.dong.find(d => d.TenSanPham === 'video').DonGia === 200000, nv1);
  kiem('NV2 khong co hop dong: 0 dong, dong khop=false (van liet ke de canh bao)', nv2 && nv2.tien === 0 && nv2.dong[0].khop === false, nv2);
  kiem('moc hop dong = CUOI THANG (2026-11-30), cung luat payroll', daChay.some(x => /OUTER APPLY/.test(x.s) && x.inp.cuoi === '2026-11-30'));
  const poolKhongBang = poolGia((s) => /OBJECT_ID/.test(s) ? [{ c: null }] : []);
  kiem('bang chua co (chua migration) -> Map rong, khong nem', (await sl.thuongTheoThang(poolKhongBang, 2026, 11)).size === 0);

  /* dongBoMayMau: lenh 7, NV 1 (HD co "May mẫu" 150.000), dong cu thang 10 -> xoa, chen moi ngay 2026-11-05, danh dau 2 thang. */
  daChay.length = 0; danhDau.length = 0;
  const pool2 = poolGia((s) => {
    if (/OBJECT_ID\('SanLuongTheoLenh'/.test(s)) return [{ c: 1 }];
    if (/SELECT TOP 1 NhanVienID, CONVERT\(varchar\(10\), Ngay, 23\) AS Ngay FROM SanLuongTheoLenh/.test(s)) return [{ NhanVienID: 9, Ngay: '2026-10-20' }];
    if (/SELECT TOP 1 h\.HopDongID, h\.KieuThuong FROM HopDongLaoDong/.test(s)) return [{ HopDongID: 10, KieuThuong: 'SanPham' }];
    if (/FROM HopDongSanPham WHERE HopDongID = @id/.test(s)) return [{ TenSanPham: 'Ảnh', DonGia: 50000 }, { TenSanPham: 'May mẫu', DonGia: 150000 }];
    return [];
  });
  const mm = await sl.dongBoMayMau(pool2, 7, 1, '2026-11-05', 3);
  const xoa = daChay.findIndex(x => /DELETE FROM SanLuongTheoLenh WHERE DonHangID = @dh AND Nguon = N'MayMau'/.test(x.s));
  const chen = daChay.findIndex(x => /INSERT INTO SanLuongTheoLenh/.test(x.s));
  kiem('dongBoMayMau: XOA dong MayMau cu roi CHEN 1 dong (SL 1, Nguon MayMau, ten tu hop dong "May mẫu", ngay = NgayDat)',
    xoa >= 0 && chen > xoa && daChay[chen].inp.ten === 'May mẫu' && daChay[chen].inp.ngay === '2026-11-05' && daChay[chen].inp.nv === 1 && daChay[chen].inp.dh === 7 && /, 1, CONVERT\(date, @ngay, 23\), N'MayMau'/.test(daChay[chen].s), daChay[chen]);
  kiem('tra ve { ten, donGia 150.000, khop true, kieuThuong SanPham }', mm && mm.ten === 'May mẫu' && mm.donGia === 150000 && mm.khop === true && mm.kieuThuong === 'SanPham', mm);
  kiem('danh dau tinh lai luong CA thang cu (10/2026) lan thang moi (11/2026)', danhDau.some(d => d.ngay === '2026-10-20') && danhDau.some(d => d.ngay === '2026-11-05'), danhDau);
  daChay.length = 0; danhDau.length = 0;
  const mm0 = await sl.dongBoMayMau(pool2, 7, null, '2026-11-05', 3);
  kiem('bo chi dinh (nv null): chi XOA, khong chen, tra null', mm0 === null && daChay.some(x => /DELETE FROM SanLuongTheoLenh/.test(x.s)) && !daChay.some(x => /INSERT INTO SanLuongTheoLenh/.test(x.s)));
  /* v9.76: nguoi lap lenh CHON san pham tu danh muc hop dong ("Ảnh" 50k) -> ghi dung ten do, khong lay dong "mẫu" nua. */
  daChay.length = 0;
  const mmSP = await sl.dongBoMayMau(pool2, 7, 1, '2026-11-05', 3, 'Ảnh');
  const chenSP = daChay.find(x => /INSERT INTO SanLuongTheoLenh/.test(x.s));
  kiem('v9.76 dongBoMayMau(..., tenSP "Ảnh"): chen dong ten "Ảnh", donGia 50.000, khop', chenSP && chenSP.inp.ten === 'Ảnh' && mmSP.ten === 'Ảnh' && mmSP.donGia === 50000 && mmSP.khop === true, mmSP);
  const mmLa = await sl.dongBoMayMau(pool2, 7, 1, '2026-11-05', 3, 'Video');
  kiem('v9.76 ten chon KHONG co trong hop dong -> van ghi ten do, khop=false, donGia 0 (bao do o KPI, khong doan)', mmLa.ten === 'Video' && mmLa.khop === false && mmLa.donGia === 0, mmLa);
  Module._load = gocLoad;

  console.log('\n=== 3. routes/qlsx.js ===');
  const q = boComment(doc('backend', 'routes', 'qlsx.js'));
  const postOrders = q.slice(q.indexOf("router.post('/orders',"), q.indexOf('async function ghiNhanVienMayMau'));
  const putOrders = q.slice(q.indexOf("router.put('/orders/:maDH',"), q.indexOf("router.delete('/orders/:maDH',"));
  /* v9.76: + tham so mayMauTenSP (ten san pham chon tu danh muc hop dong). */
  kiem('POST /orders goi ghiNhanVienMayMau(... req.body.nhanVienMayMauId, ngayDat, userId, req.body.mayMauTenSP) SAU khi co donHangId, tra mayMau', /const mayMau = await ghiNhanVienMayMau\(pool, donHangId, req\.body\.nhanVienMayMauId, ngayDat, req\.session\.user\.userId, req\.body\.mayMauTenSP\);/.test(postOrders) && /data: \{ maDH, donHangId, mayMau \}/.test(postOrders));
  kiem('PUT /orders/:maDH goi ghiNhanVienMayMau voi order.DonHangID + mayMauTenSP, tra mayMau', /await ghiNhanVienMayMau\(pool, order\.DonHangID, req\.body\.nhanVienMayMauId, ngayDat, req\.session\.user\.userId, req\.body\.mayMauTenSP\);/.test(putOrders) && /data: \{ mayMau \}/.test(putOrders));
  const hamMM = q.slice(q.indexOf('async function ghiNhanVienMayMau'), q.indexOf("router.put('/orders/:maDH',"));
  kiem('ghiNhanVienMayMau: undefined -> khong dung; do cot truoc; UPDATE cot (+ MayMauTenSP gac cot v902); doc NgayDat that tu CSDL roi dongBoMayMau(..., tenSP)', /if \(nhanVienMayMauId === undefined\) return undefined;/.test(hamMM) && /coCotMayMau\(pool\)/.test(hamMM) && /UPDATE DonHangSanXuat SET NhanVienMayMauID = @nv\$\{coTenSP \? ', MayMauTenSP = @sp' : ''\} WHERE DonHangID = @id/.test(hamMM) && /sanLuongLenh\.dongBoMayMau\(pool, donHangId, nv, \(ngay && ngay\.NgayDat\) \|\| ngayDat, userId, coTenSP \? tenSP : null\)/.test(hamMM));
  kiem("v9.76 route GET /maymau/sanpham gac QLSX/orders view (KHONG phai sanluong — MacDinhCho 0), tra theoSanPham", /router\.get\('\/maymau\/sanpham', requireAuth, requirePermission\('QLSX', 'view'\), requireChucNang\('QLSX', 'orders', 'view'\)/.test(q) && /theoSanPham: coKieu\(hd\.kieuThuong, 'SanPham'\)/.test(hamMM));
  kiem('getOrderByMaDH tra TenNhanVienMayMau (join dieu kien theo cot)', /nvmm\.HoTen AS TenNhanVienMayMau/.test(q) && /LEFT JOIN NhanVien nvmm ON nvmm\.NhanVienID = d\.NhanVienMayMauID/.test(q));
  ['get /sanluong/lenh', 'get /sanluong/hopdong', 'get /sanluong', 'post /sanluong', 'put /sanluong/:id', 'delete /sanluong/:id'].forEach(r => {
    const [pp, duong] = r.split(' ');
    kiem('route ' + r + " gac requireChucNang('QLSX', 'sanluong')", new RegExp("router\\." + pp + "\\('" + duong.replace(/[/:]/g, m => '\\' + m) + "', requireAuth, requirePermission\\('QLSX', '(view|create|edit|delete)'\\), requireChucNang\\('QLSX', 'sanluong'\\)").test(q));
  });
  kiem('PUT/DELETE tu choi dong Nguon=MayMau (409) — sua o lenh, khong sua tay', (q.match(/if \(cu\.Nguon === 'MayMau'\) return res\.status\(409\)/g) || []).length === 2);
  kiem('moi lan ghi/sua/xoa deu danh dau tinh lai luong theo ngay', (q.match(/bangLuongTuDong\.danhDauTheoNgay\(pool, (d\.ngay|cu\.Ngay), '(Ghi|Sửa|Xóa) sản lượng theo lệnh SX'\)/g) || []).length >= 4);
  /* v9.67b tu phuc vu: nguoi = Users.NhanVienID cua phien, client KHONG chon duoc nguoi khac. */
  ['get /sanluong/cuatoi', 'get /sanluong/cuatoi/lenh', 'post /sanluong/cuatoi', 'put /sanluong/cuatoi/:id', 'delete /sanluong/cuatoi/:id'].forEach(r => {
    const [pp, duong] = r.split(' ');
    kiem('route tu phuc vu ' + r + " = requireAuth + requireChucNang('MYPAY','sanluongcuatoi') (KHONG requirePermission)", new RegExp("router\\." + pp + "\\('" + duong.replace(/[/:]/g, m => '\\' + m) + "', requireAuth, requireChucNang\\('MYPAY', 'sanluongcuatoi'(, 'view')?\\), async").test(q));
  });
  kiem('migration_v895 co ChucNang MYPAY/sanluongcuatoi', /\('MYPAY', 'sanluongcuatoi'/.test(mg));
  /* v9.67d: "mac dinh KHONG co" — MacDinhCho = 0 cho ca hai; tab QLSX + muc MYPAY tu hoi chucNangPerm (hiddenChucNang khong chua opt-in). */
  kiem('v9.67d: ca hai ChucNang MacDinhCho = 0 (phai tick), MERGE co MATCHED -> UPDATE MacDinhCho = 0', /'sanluong', N'[^']+', 15, 0\)/.test(mg) && /'sanluongcuatoi', N'[^']+', 2, 0\)/.test(mg) && /WHEN MATCHED THEN UPDATE SET MacDinhCho = 0/.test(mg));
  kiem('v9.67d: danh sach tra Anh (hang hoa uu tien, lui ve AnhSanPham; subquery o cot SELECT, hai nguon ma hang) + MaRap (maRapTheoDon) o ca 2 GET',
    (() => { const a = doc('backend', 'utils', 'anhLenhSX.js'); return /ISNULL\(\(SELECT TOP 1 h\.AnhDaiDien FROM TheKhoHangHoa h/.test(a) && /h\.DonHangID = \$\{bd\}\.DonHangID/.test(a) && /JOIN PhieuNhapKhoHang p ON p\.PhieuNKID = ct\.PhieuNKID AND p\.TrangThai <> N'Đã hủy'/.test(a); })()
    && /require\('\.\.\/utils\/anhLenhSX'\)\.COT_ANH_LENH/.test(q) && (q.match(/\$\{COT_ANH_SAN_LUONG\('d'\)\}/g) || []).length === 2 && (q.match(/await ganMaRapSanLuong\(pool, rows\);/g) || []).length === 2 && /const mr = await maRapTheoDon\(pool\);/.test(q));
  /* v9.67c nhieu dong: docCacDongSanLuong doc b.rows (khong co -> chinh b), chan SP lap; ca POST /sanluong lan /sanluong/cuatoi dung. */
  kiem('POST /sanluong + /sanluong/cuatoi ghi NHIEU dong qua docCacDongSanLuong + chenCacDongSanLuong', (q.match(/await docCacDongSanLuong\(pool, /g) || []).length === 2 && (q.match(/await chenCacDongSanLuong\(pool, ds, /g) || []).length === 2 && /const ds = Array\.isArray\(b\.rows\) && b\.rows\.length \? b\.rows : \[b\];/.test(q) && /bị lặp hai dòng/.test(q));
  kiem('cuatoi: nhanVienId bi GHI DE bang NhanVienID cua phien o POST + PUT', (q.match(/\{ nhanVienId: (nv|x\.nv) \}\), req\.session\.user\.userId\)/g) || []).length === 2 && /async function nhanVienCuaPhien\(pool, req\)/.test(q));
  kiem('cuatoi: POST chan khi hop dong khong phai SanPham (409); sua/xoa chi dong cua minh, MayMau 409', /!coKieu\(hd\.kieuThuong, 'SanPham'\)\) return res\.status\(409\)/.test(q) && /Number\(cu\.NhanVienID\) !== nv\) \{ res\.status\(404\)/.test(q));

  console.log('\n=== 4. routes/payroll.js ===');
  const p = boComment(doc('backend', 'routes', 'payroll.js'));
  kiem('tinhBangLuongThang: spMap = nhap tay + thuongTheoThang (CONG, khong ghi de)', /\(await sanLuongTheoLenh\.thuongTheoThang\(pool, nam, thang\)\)\s*\.forEach\(\(o, nvId\) => spMap\.set\(nvId, \(spMap\.get\(nvId\) \|\| 0\) \+ \(Number\(o\.tien\) \|\| 0\)\)\);/.test(p));
  kiem('GET /kpi gan r.sanPhamTuLenh + r.tienTuLenh', /r\.sanPhamTuLenh = o \? o\.dong : \[\]; r\.tienTuLenh = o \? o\.tien : 0;/.test(p));
  kiem('PUT /kpi/sanpham van chi ghi ThuongSanPhamThang (khong dung bang moi)', /DELETE FROM ThuongSanPhamThang WHERE NhanVienID=@nv AND Nam=@n AND Thang=@t/.test(p));

  console.log('\n=== 5. giao dien ===');
  const fq = boComment(doc('frontend', 'js', 'module.qlsx.js'));
  kiem('form Chi dinh SX + form Sua: o chon #inpNhanVienMayMau / #inpNhanVienMayMauEdit (FK, chon trong danh sach NV) + o SP (v9.76)', /oNhanVienMayMauHtml\('inpNhanVienMayMau', null\)/.test(fq) && /oNhanVienMayMauHtml\('inpNhanVienMayMauEdit', detail\.NhanVienMayMauID, detail\.MayMauTenSP\)/.test(fq) && /<option value="">-- Không chỉ định --<\/option>/.test(fq) && /<select id="\$\{id\}SP" data-chon=/.test(fq));
  kiem('payload tao + sua gui nhanVienMayMauId + mayMauTenSP (rong = null); wireMayMauSP nap /api/qlsx/maymau/sanpham theo NV + ngay dat', /nhanVienMayMauId: document\.getElementById\('inpNhanVienMayMau'\)\.value \|\| null/.test(fq) && /nhanVienMayMauId: modal\.querySelector\('#inpNhanVienMayMauEdit'\)\.value \|\| null/.test(fq)
    && /mayMauTenSP: document\.getElementById\('inpNhanVienMayMauSP'\)\.value \|\| null/.test(fq) && /mayMauTenSP: modal\.querySelector\('#inpNhanVienMayMauEditSP'\)\.value \|\| null/.test(fq)
    && /wireMayMauSP\(modal, 'inpNhanVienMayMauEdit', modal\.querySelector\('input\[name="ngayDat"\]'\)\)/.test(fq) && /wireMayMauSP\(area, 'inpNhanVienMayMau', area\.querySelector\('input\[name="ngayDat"\]'\)\)/.test(fq) && /\/api\/qlsx\/maymau\/sanpham\?nhanVienId=/.test(fq)
    && /ADD MayMauTenSP NVARCHAR\(150\) NULL/.test(doc('database', 'migration_v902.sql')));
  kiem('sau luu bao ro thuong may mau (khong khop HD / sai kieu thuong / OK)', /function baoMayMau\(kq\)/.test(fq) && (fq.match(/baoMayMau\((res|kqSua)\)/g) || []).length === 2);
  kiem('tab sanluong + render + form ghi (lenh, NV, SP theo HD, SL, ngay)', /key: 'sanluong', label: 'Sản lượng theo lệnh'/.test(fq) && /if \(activeTab === 'sanluong'\) return renderSanLuongTheoLenh\(perm\);/.test(fq) && /async function renderSanLuongTheoLenh\(perm\)/.test(fq) && /function moFormSanLuong\(r, sauKhiLuu\)/.test(fq) && /\/api\/qlsx\/sanluong\/hopdong\?nhanVienId=/.test(fq) && /\/api\/qlsx\/sanluong\/lenh\?q=/.test(fq));
  kiem('ban in lenh co dong "May mẫu" (2 bo cuc)', (fq.match(/<b>May mẫu:<\/b> \$\{escapeHtml\(o\.TenNhanVienMayMau\)\}/g) || []).length === 2);
  const fp = boComment(doc('frontend', 'js', 'module.payroll.js'));
  kiem('module.payroll: tongSP cong tienTuLenh; bang + modal hien phan tu lenh (chi xem); tinhLai cong san', /\+ num\(r\.tienTuLenh\)/.test(fp) && /const tuLenhHtml = \(r\) =>/.test(fp) && /Tự động từ lệnh sản xuất/.test(fp) && /let tong = tienTuLenh;/.test(fp));
  kiem('module.hrm: goi y ten SP khop san luong theo lenh', /Sản lượng theo lệnh/.test(doc('frontend', 'js', 'module.hrm.js')));
  const fm = boComment(doc('frontend', 'js', 'module.mypay.js'));
  kiem('module.mypay: muc "Sản lượng theo lệnh của tôi" chi ve khi theoSanPham; form chon SP theo hop dong; goi route cuatoi', /if \(!sl\.theoSanPham\) return '';/.test(fm) && /function moFormSanLuongCuaToi\(r, sl\)/.test(fm) && /\/api\/qlsx\/sanluong\/cuatoi\?nam=/.test(fm) && /apiPost\('\/api\/qlsx\/sanluong\/cuatoi', payload\)/.test(fm) && /\/api\/qlsx\/sanluong\/cuatoi\/lenh\?q=/.test(fm));
  kiem('v9.67c: ca hai form ghi NHIEU dong (rows[]) + nut them dong; mypay an muc khi hiddenChucNang co MYPAY:sanluongcuatoi',
    /id="slfThemDong"/.test(fq) && /rows, tenSanPham: rows\[0\]\.tenSanPham/.test(fq) && /id="mslThemDong"/.test(fm) && /rows, tenSanPham: rows\[0\]\.tenSanPham/.test(fm)
    && /indexOf\('MYPAY:sanluongcuatoi'\) !== -1/.test(fm) && /if \(!bimatSanLuong\(\)\)/.test(fm) && /async function render\(el, user\)/.test(fm));
  kiem('v9.67d: tab QLSX sanluong chi push khi chucNangPerm[QLSX:sanluong].canView !== false; mypay hoi chucNangPerm[MYPAY:sanluongcuatoi]',
    /user\.chucNangPerm\['QLSX:sanluong'\]/.test(fq) && /if \(!cnSL \|\| cnSL\.canView !== false\) tabs\.push\(\{ key: 'sanluong'/.test(fq) && /chucNangPerm\['MYPAY:sanluongcuatoi'\]/.test(fm) && /cn\.canView === false/.test(fm));
  kiem('v9.67d: 2 bang hien cot Anh (thumb anhNho) + Ma rap', /<th>Mã rập<\/th>/.test(fq) && /function anhSanLuongHtml\(url\)/.test(fq) && /<th>Mã rập<\/th>/.test(fm) && /anhNho\(x\.Anh, 160\)/.test(fm));
  /* v9.81 (Nguyen 19/11: "truong lenh SX them dau tich LAM LAI MA CU — nhap ma hang"): dong khong gan lenh nao.
     Diem chet nguoi: hai cau SELECT phai LEFT JOIN, JOIN thuong se NUOT MAT dong "lam lai" (mat thuong im lang). */
  console.log('\n=== 6. v9.81 — lam lai ma cu (khong co lenh SX) ===');
  const mg905 = doc('database', 'migration_v905.sql');
  kiem('migration_v905: DonHangID -> NULL duoc + cot MaHangCu + CHECK "phai co lenh HOAC ma cu"',
    /ALTER TABLE SanLuongTheoLenh ALTER COLUMN DonHangID INT NULL/.test(mg905)
    && /ADD MaHangCu NVARCHAR\(100\) NULL/.test(mg905)
    && /CHECK \(DonHangID IS NOT NULL OR MaHangCu IS NOT NULL\)/.test(mg905)
    && /is_nullable = 0/.test(mg905));   // gac: chi ALTER khi cot dang NOT NULL
  kiem('v9.81: CA HAI cau danh sach dung LEFT JOIN DonHangSanXuat (JOIN thuong = nuot mat dong lam lai)',
    (q.match(/LEFT JOIN DonHangSanXuat d ON d\.DonHangID = s\.DonHangID/g) || []).length === 2
    && !/\sJOIN DonHangSanXuat d ON d\.DonHangID = s\.DonHangID/.test(q.replace(/LEFT JOIN DonHangSanXuat/g, 'X')));
  kiem('v9.81: doc cot MaHangCu co gac coCotMaHangCu (may chua chay v905 van chay duoc)',
    /async function coCotMaHangCu\(pool\)/.test(boComment(doc('backend', 'utils', 'sanLuongTheoLenh.js')))
    && /coCotMaHangCu/.test(doc('backend', 'utils', 'sanLuongTheoLenh.js').match(/module\.exports[^\n]*/)[0])
    && (q.match(/await sanLuongLenh\.coCotMaHangCu\(pool\)/g) || []).length >= 4);
  kiem('v9.81: tich lam lai -> bo lenh (donHangId null) + bat buoc ma hang; chua chay v905 thi bao ro ten file',
    /if \(lamLai\) \{/.test(q) && /donHangId = 0;/.test(q)
    && /Đã tích "Làm lại mã cũ" thì phải nhập mã hàng\./.test(q) && /migration_v905\.sql/.test(q)
    && /donHangId: lamLai \? null : donHangId, maHangCu: lamLai \? maHangCu : null/.test(q));
  kiem('v9.81: PUT giu nguyen trang thai khi client cu khong gui co (lamLaiMaCu: !cu.DonHangID)',
    /lamLaiMaCu: !cu\.DonHangID, maHangCu: cu\.MaHangCu/.test(q));
  kiem('v9.81: CA HAI man hinh co dau tich + o ma hang + gui lamLaiMaCu/maHangCu',
    /id="slfLamLai"/.test(fq) && /id="slfMaCu"/.test(fq) && /lamLaiMaCu: lamLai, maHangCu: lamLai \? oMaCu\.value\.trim\(\) : null/.test(fq)
    && /id="mslLamLai"/.test(fm) && /id="mslMaCu"/.test(fm) && /lamLaiMaCu: lamLai, maHangCu: lamLai \? oMaCu\.value\.trim\(\) : null/.test(fm));
  kiem('v9.81: bang hai man deu hien "Làm lại mã cũ" + ma hang thay cho o lenh trong',
    /function oLenhSanLuongHtml\(r\)/.test(fq) && (fq.match(/Làm lại mã cũ/g) || []).length >= 2 && /Làm lại mã cũ/.test(fm));

  /* ============================================================================================
     v9.82 (Nguyen 19/11) — TÁCH HAI CON SỐ TỪNG BỊ GỘP LÀM MỘT:
         CÁI / LỚP = hệ số TỪNG BÀN cắt (TienDoCatChiTietCay.HeSoQuyDoi)
         CÁI / RI  = số size (DonHangDaiSize.HeSo, hoặc DonHangSanXuat.SoSizeRi — migration_v906)
     Gộp lại = bàn hệ số 10 dải 5 size sẽ ra GẤP ĐÔI số cái. Khoá bằng mấy phép dưới đây.
     ============================================================================================ */
  console.log('\n=== 7. v9.82/v9.85 — cai/lop (tung ban) ≠ cai/ri (so size) ===');
  /* v9.85 (Nguyen chot): KHONG them cot moi — o "He so quy doi" san co CHINH LA so cai trong 1 ri.
     migration_v906 (SoSizeRi) HET HIEU LUC; moi dau moi `SoSizeRi` phai bien khoi code chay. */
  kiem('v9.85: migration_v906 danh dau KHONG CAN CHAY (cot SoSizeRi da bo)',
    /KHONG CAN CHAY/.test(doc('database', 'migration_v906.sql')));
  kiem('v9.85: KHONG con dau vet SoSizeRi trong code chay (backend lan frontend)',
    !/SoSizeRi/.test(q) && !/SoSizeRi|soSizeRi/.test(fq));
  kiem('v9.82: getCatMauList tra CHI TIET TUNG BAN (GROUP BY ca TienDoID), kem SttSoCat + so lop + so cai',
    /GROUP BY dv\.MauSacID, cc\.TienDoID, t\.SttSoCat, cc\.HeSoQuyDoi/.test(q)
    && /SUM\(cc\.SoLuongLop \* cc\.HeSoQuyDoi\) AS SoCai/.test(q) && /BanCat: ban,/.test(q) && /TongCaiTuBan:/.test(q));
  /* 🔴 Phep QUAN TRONG NHAT: man Ghi tien do KHONG duoc dung he so CAT (cai/LOP) lam he so RI nua. */
  kiem('v9.85: Dong goi / Kho nhap quy doi Ri bang caiMotRi = dai.HeSo hoac lenh.HeSoQuyDoi; bo ham heSoCuaDong',
    /function caiMotRi\(dai\)/.test(fq) && /Number\(detail && detail\.HeSoQuyDoi\) \|\| 0/.test(fq)
    && !/heSoCuaDong/.test(fq) && (fq.match(/caiMotRi\(dai\)/g) || []).length >= 4);
  kiem('v9.85: thieu he so quy doi thi o Ri HIEN NHUNG KHOA (disabled) + noi ly do, khong an di',
    (fq.match(/class="(dg|kn)-ri-qty" \$\{dk\} placeholder="—" disabled/g) || []).length === 2
    && /chưa khai .Hệ số quy đổi./.test(fq));
  kiem('v9.85: danh sach lenh tach Ri cung mot thuoc voi form — dung d.HeSoQuyDoi, KHONG uu tien he so Cat',
    /MAX\(CASE WHEN ISNULL\(d\.HeSoQuyDoi, 0\) > 0 THEN d\.HeSoQuyDoi ELSE 1 END\) AS HeSo/.test(q)
    && !/WHEN hc\.HMin IS NOT NULL AND hc\.HMin = hc\.HMax THEN hc\.HMax/.test(q));
  kiem('v9.82: bang TUNG BAN hien duoi o nhap cua mau (ca Dong goi lan Kho nhap), chi khi >= 2 ban',
    /function bangBanCat\(ct, dai\)/.test(fq) && /if \(ban\.length < 2\) return '';/.test(fq)
    && (fq.match(/\$\{bangBanCat\(ct, dai\)\}/g) || []).length === 2);
  /* v9.85 (Nguyen 19/11): "Ra lenh san xuat bo truong he so quy doi va don vi quy doi" -> chot lai:
     GIU "He so quy doi" (doi nhan = so cai trong 1 ri), BO o "Don vi quy doi" + o "So size" cua v9.82. */
  kiem('v9.85: form lenh SX (tao + sua) BO o "Don vi quy doi" va listener tu dien he so',
    !/id="inpDonViQuyDoi"/.test(fq) && !/id="inpDonViQuyDoiEdit"/.test(fq)
    && !/dm\.donViQuyDoi\.find\(/.test(fq));
  kiem('v9.85: o He so quy doi doi nhan thanh "so cai trong 1 ri" o CA HAI form',
    (fq.match(/Hệ số quy đổi \(số cái trong 1 ri\)/g) || []).length === 2
    && /id="inpHeSoQuyDoi"/.test(fq) && /id="inpHeSoQuyDoiEdit"/.test(fq));
  /* 🔴 Form Sua KHONG duoc gui donViQuyDoiId = null: lam the la moi lan sua lenh lai xoa mat don vi
     quy doi cua lenh cu (ban in mat phan "x 5 = 1.200 Cai"). Phai chep lai gia tri dang co. */
  kiem('v9.85: form Sua CHEP LAI DonViQuyDoiID cu (khong xoa), form Ra lenh gui null',
    /donViQuyDoiId: detail\.DonViQuyDoiID \|\| null/.test(fq) && /donViQuyDoiId: null,/.test(fq));

  const html = doc('frontend', 'index.html');
  ['module.qlsx.js', 'module.payroll.js', 'module.hrm.js', 'module.mypay.js'].forEach(f => {
    const v = new RegExp(f.replace('.', '\\.') + '\\?v=([\\d.]+)').exec(html);
    kiem('index.html ' + f + ' ?v>=9.67', !!v && parseFloat(v[1]) >= 9.67, v && v[1]);
  });

  clearTimeout(canhGac);
  console.log(`\n=== KET QUA: ${dat} dat, ${sai} sai ===`);
  process.exit(sai ? 1 : 0);
})().catch(e => { console.error('VO: ' + (e && e.stack || e)); process.exit(1); });
