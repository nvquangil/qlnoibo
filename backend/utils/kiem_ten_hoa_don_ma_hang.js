/* ================================================================================================
   KIEM CHUNG v7.46 — TheKhoHangHoa.TenHoaDon phai duoc XU LY O DU CAC DUONG, khong thieu duong nao
   ------------------------------------------------------------------------------------------------
   Them mot cot vao TheKhoHangHoa la phai sua NHIEU CHO: 3 duong GHI (tao the kho, tao o Danh muc,
   sua o Danh muc), 3 duong DOC (danh sach the kho de dien form Sua, danh sach Danh muc, cau lay dong
   hang cua hoa don), va 2 form o frontend. Thieu mot cho thi loi im lang: khai xong khong thay dau,
   hoac mo form Sua bam Luu la XOA TRANG o vua khai.

   Test nay KHONG can CSDL: doc chinh cac file .js va doi chieu tung diem. Kem mot phan MO PHONG
   `capNhatMaHang` bang pool gia de kiem quy tac "gui rong = xoa, khong gui = giu nguyen" — quy tac
   nay khac han cac truong con lai (chung deu boc ISNULL) nen rat de bi sua nham ve ISNULL.

   Chay:  node utils/kiem_ten_hoa_don_ma_hang.js
   ================================================================================================ */
const fs = require('fs');
const path = require('path');

const G = path.join(__dirname, '..');
const doc = (p) => fs.readFileSync(path.join(G, p), 'utf8');

let dat = 0, truot = 0;
const OK = (m) => { dat++; console.log('  OK   ' + m); };
const NO = (m) => { truot++; console.log('  SAI  ' + m); };
const kiem = (dk, m, them) => (dk ? OK(m) : NO(m + (them ? '  -> ' + them : '')));

const sMaHangCapNhat = doc('utils/maHangCapNhat.js');
const sKhoHang = doc('routes/khohang.js');
const sDanhMuc = doc('routes/danhmuc.js');
const sBanHang = doc('routes/banhang.js');
const sHoaDon = doc('utils/hoaDonVietInvoice.js');
const sNhapKho = doc('routes/nhapkho.js');
const sFeNk = doc('../frontend/js/module.nhapkho.js');
const sFeKho = doc('../frontend/js/module.khohang.js');
const sFeDm = doc('../frontend/js/module.danhmuc.js');
const sMigration = doc('../database/migration_v690.sql');
const sCaiDat = doc('../database/CAI_DAT_DAY_DU.sql');
const sIndex = doc('../frontend/index.html');

console.log('\n=== 1. MIGRATION + FILE CAI MOI ===');
kiem(/ALTER TABLE TheKhoHangHoa ADD TenHoaDon NVARCHAR\(255\) NULL/.test(sMigration),
  'migration_v690 them cot TenHoaDon');
kiem(/IF COL_LENGTH\('TheKhoHangHoa', 'TenHoaDon'\) IS NULL/.test(sMigration),
  'migration chay lai duoc (co IF COL_LENGTH)');
/* Bai hoc feedback: migration moi PHAI gop luon vao CAI_DAT_DAY_DU.sql, keo cai moi thieu cot. */
const khoiTKHH = sCaiDat.slice(sCaiDat.indexOf('CREATE TABLE TheKhoHangHoa'),
  sCaiDat.indexOf('CREATE TABLE TheKhoChiTietMau'));
kiem(/TenHoaDon\s+NVARCHAR\(255\) NULL/.test(khoiTKHH),
  'CAI_DAT_DAY_DU.sql: TheKhoHangHoa da co TenHoaDon (cai moi khong thieu cot)');

console.log('\n=== 2. MOT ban do cot duy nhat (khong moi file tu viet mot ham) ===');
kiem(/async function coCotTenHoaDon\(pool\)/.test(sMaHangCapNhat),
  'maHangCapNhat.js dinh nghia coCotTenHoaDon');
kiem(/module\.exports = \{[^}]*coCotTenHoaDon/.test(sMaHangCapNhat), 'coCotTenHoaDon duoc export');
[['khohang.js', sKhoHang], ['danhmuc.js', sDanhMuc], ['banhang.js', sBanHang],
 ['nhapkho.js', sNhapKho]].forEach(([ten, src]) => {
  /* Phai NHAP ham tu maHangCapNhat (khong tu dinh nghia). Kiem chinh dong require co ten ham trong
     ngoac {} — khong dung vi tri dong, vi danhmuc.js require ngay tren khoi route cua no (dong 417)
     chu khong o dau file. */
  kiem(/const \{[^}]*coCotTenHoaDon[^}]*\} = require\('\.\.\/utils\/maHangCapNhat'\)/.test(src),
    `${ten} dung CHUNG coCotTenHoaDon (khong tu viet ham do cot)`);
  kiem(!/function coCotTenHoaDon/.test(src), `${ten} khong tu dinh nghia lai ham do cot`);
});
kiem(!/COL_LENGTH\('TheKhoHangHoa', 'TenHoaDon'\)/.test(sKhoHang)
  && !/COL_LENGTH\('TheKhoHangHoa', 'TenHoaDon'\)/.test(sBanHang),
  'khohang.js / banhang.js KHONG tu viet lai cau do COL_LENGTH');

console.log('\n=== 3. BA duong GHI deu co TenHoaDon ===');
/* a) Tao the kho (POST /khohang/items) */
const dtTao = sKhoHang.slice(sKhoHang.indexOf("router.post('/items'"), sKhoHang.indexOf("router.put('/items/:id'"));
kiem(/INSERT INTO TheKhoHangHoa[\s\S]{0,400}coTenHD \? ', TenHoaDon'/.test(dtTao),
  'POST /khohang/items: INSERT co TenHoaDon (co dieu kien theo cot)');
kiem(/\.input\('TenHoaDon'/.test(dtTao), 'POST /khohang/items: co .input(TenHoaDon)');
/* b) Sua the kho (PUT /khohang/items/:id) */
const dtSua = sKhoHang.slice(sKhoHang.indexOf("router.put('/items/:id'"));
kiem(/coTenHD \? ', TenHoaDon=@TenHoaDon'/.test(dtSua), 'PUT /khohang/items/:id: UPDATE co TenHoaDon');
kiem(!/TenHoaDon=ISNULL\(@TenHoaDon/.test(dtSua),
  'PUT /khohang/items/:id KHONG boc ISNULL cho TenHoaDon (phai XOA duoc)');
kiem(/hasOwnProperty\.call\(req\.body, 'tenHoaDon'\)/.test(dtSua),
  'PUT /khohang/items/:id phan biet "khong gui" voi "gui rong"');
/* c) Danh muc: tao + sua */
kiem(/coTenHD \? ', TenHoaDon' : ''/.test(sDanhMuc), 'POST /danhmuc/hanghoa: INSERT co TenHoaDon');
/* d) POST /khohang/items khi MA DA CO -> boSungTheKhoChoMaDaCo (nut "Tao the kho" o phieu nhap kho).
   Duong nay rat de bo sot vi no khong phai INSERT cung khong phai PUT. */
const dtBoSung = sKhoHang.slice(sKhoHang.indexOf('async function boSungTheKhoChoMaDaCo'),
  sKhoHang.indexOf("router.post('/items'"));
kiem(/coTenHD \? ', TenHoaDon = @TenHoaDon' : ''/.test(dtBoSung),
  'boSungTheKhoChoMaDaCo (ma da co): UPDATE co TenHoaDon');
kiem(/hasOwnProperty\.call\(b, 'tenHoaDon'\)/.test(dtBoSung),
  'boSungTheKhoChoMaDaCo: phan biet "khong gui" voi "gui rong"');
kiem(/hasOwnProperty\.call\(b, 'TenHoaDon'\)[\s\S]{0,80}tenHoaDon: b\.TenHoaDon/.test(sDanhMuc),
  'PUT /danhmuc/hanghoa/:id truyen tenHoaDon qua capNhatMaHang (chi khi form co gui)');
kiem(/coTenHD \? ', TenHoaDon = @TenHoaDon' : ''/.test(sMaHangCapNhat),
  'capNhatMaHang: UPDATE co TenHoaDon');
kiem(!/TenHoaDon\s*=\s*ISNULL/.test(sMaHangCapNhat),
  'capNhatMaHang KHONG boc ISNULL cho TenHoaDon');

console.log('\n=== 3b. DONG KHAI NHANH tren PHIEU NHAP KHO (v7.46) ===');
const dtTimTao = sNhapKho.slice(sNhapKho.indexOf('async function timHoacTaoMaHang'),
  sNhapKho.indexOf('async function chuanDong'));
kiem(/coTenHD \? ', TenHoaDon' : ''/.test(dtTimTao),
  'Ma MOI tao tu dong khai: INSERT co TenHoaDon');
kiem(/\.input\('TenHoaDon', sql\.NVarChar, String\(d\.tenHoaDon \|\| ''\)\.trim\(\) \|\| null\)/.test(dtTimTao),
  'Ma moi: gui rong -> NULL');
kiem(/UPDATE TheKhoHangHoa SET TenHoaDon = @TenHoaDon WHERE MaHangID = @id/.test(dtTimTao),
  'Ma DA CO ma go tay: van ghi duoc ten hoa don (khoi sang Danh muc sua)');
/* ⚠️ Bay mat du lieu: tren phieu nhap KHONG duoc coi "trong = xoa". Go tay ma da co thi form khong
   biet ten dang luu la gi (o de trong), coi trong la xoa thi moi lan nhap kho lai xoa mat ten. */
const khoiMaDaCo = dtTimTao.slice(dtTimTao.indexOf('if (co) {'), dtTimTao.indexOf('// ---- Ma moi'));
kiem(/const tenHD = String\(d\.tenHoaDon \|\| ''\)\.trim\(\);[\s\S]{0,120}if \(tenHD &&/.test(khoiMaDaCo),
  'Ma da co: CHI ghi khi CO gia tri (khong coi trong = xoa)');
kiem(!/hasOwnProperty[\s\S]{0,200}UPDATE TheKhoHangHoa SET TenHoaDon/.test(khoiMaDaCo),
  'Ma da co: KHONG dung hasOwnProperty (se cho phep xoa trang bang o rong)');
kiem(!/UPDATE TheKhoHangHoa SET [^@]*TenHang|UPDATE TheKhoHangHoa SET [^@]*LoaiRi/.test(khoiMaDaCo),
  'Ma da co: KHONG ghi de truong nao khac cua danh muc');
kiem(/class="nk-tenhd"/.test(sFeNk), 'FE phieu nhap: dong khai co o "Ten viet hoa don"');
kiem(/\.nk-tenhd'\)\.oninput = \(e\) => \{ d\.tenHoaDon = e\.target\.value; \}/.test(sFeNk),
  'FE phieu nhap: co handler luu gia tri o do');
kiem(/d\.tenHoaDon = g\.tenHoaDon/.test(sFeNk),
  'FE phieu nhap: dong bo sang moi dong CUNG MA (ten hoa don la cua ma hang, khong phai cua mau)');
kiem(/tenHoaDon: d\.tenHoaDon \|\| ''/.test(sFeNk), 'FE phieu nhap: gui len trong payload');
kiem(/tenHoaDon: r\.TenHoaDon \|\| ''/.test(sFeNk), 'FE phieu nhap: mo Sua phieu -> dien san');
kiem(/if \(mh\.TenHoaDon !== undefined\) d\.tenHoaDon = mh\.TenHoaDon \|\| ''/.test(sFeNk),
  'FE phieu nhap: go trung ma co san -> dien lai ten da khai (khong xoa trang)');
kiem(/module\.nhapkho\.js\?v=7\.46/.test(sIndex), 'index.html bump module.nhapkho.js?v=7.46');

console.log('\n=== 4. CAC duong DOC deu tra TenHoaDon ===');
kiem(/\$\{cotTenHDdm\}/.test(sNhapKho), 'GET /nhapkho/danhmuc tra TenHoaDon (de dien lai khi go trung ma)');
kiem(/hh\.MaBarcode, \$\{cotTenHD\}/.test(sNhapKho), 'docPhieu() tra TenHoaDon (form Sua phieu dien san)');
kiem(/\$\{cotTenHD\} AS TenHoaDon/.test(sKhoHang),
  'GET /khohang/items tra TenHoaDon (form Sua the kho dien lai duoc)');
kiem(/\$\{cotTenHD\}, h\.DonViCoBan/.test(sDanhMuc) || /cotTenHD\}/.test(sDanhMuc),
  'GET /danhmuc/hanghoa tra TenHoaDon (bang danh muc hien duoc cot)');
kiem(/\$\{cotTenHDHang\} AS TenHoaDon/.test(sBanHang),
  'GET /banhang/phieu/:id/hoadon lay TenHoaDon cua tung dong hang');
kiem(/CAST\(NULL AS NVARCHAR\(255\)\)/.test(sKhoHang)
  && /CAST\(NULL AS NVARCHAR\(255\)\)/.test(sDanhMuc)
  && /CAST\(NULL AS NVARCHAR\(255\)\)/.test(sBanHang),
  'Ca 3 duong doc deu lui ve NULL khi CHUA chay migration (khong sap route)');

console.log('\n=== 5. HOA DON dung TenHoaDon, khong dung ten noi bo ===');
kiem(/String\(d\.TenHoaDon \|\| ''\)\.trim\(\) \|\| d\.TenHang/.test(sHoaDon),
  'hoaDonVietInvoice: ten dong = TenHoaDon, lui ve TenHang');
kiem(/khoa = \(ma \|\| ten\) \+ '\|\|' \+ dvt/.test(sHoaDon),
  'Khoa gop van theo MA HANG + DVT (khong gop theo ten -> 2 ma trung ten van 2 dong)');

console.log('\n=== 6. HAI form o frontend ===');
kiem(/name="tenHoaDon" id="inpTenHoaDon"/.test(sFeKho), 'Form the kho hang hoa co o "Ten viet hoa don"');
kiem(/tenHoaDon: fd\.get\('tenHoaDon'\) \|\| ''/.test(sFeKho),
  'Form the kho GUI CA KHI RONG (de xoa duoc)');
kiem(/dat\('#inpTenHoaDon', d2\.TenHoaDon\)/.test(sFeKho) && /dat\('#inpTenHoaDon', mh\.TenHoaDon\)/.test(sFeKho),
  'Chon ma co san -> tu dien lai ten hoa don da khai (2 loi vao)');
kiem(/row && row\.TenHoaDon \? row\.TenHoaDon : ''/.test(sFeKho),
  'Mo form Sua -> o dien san gia tri cu (khong bam Luu la xoa trang)');
kiem(/name: 'TenHoaDon', label: 'Tên viết hóa đơn/.test(sFeDm),
  'Danh muc -> Hang hoa (ma hang) co truong TenHoaDon');
/* Khong ghim dung so — xem ghi chu cung loai o kiem_chungtu_congno_ncc muc 8. */
const vKho = parseFloat((sIndex.match(/module\.khohang\.js\?v=([\d.]+)/) || [])[1] || 0);
const vDm = parseFloat((sIndex.match(/module\.danhmuc\.js\?v=([\d.]+)/) || [])[1] || 0);
kiem(vKho >= 7.46 && vDm >= 7.46,
  'index.html da bump ?v= cho 2 file frontend (>= 7.46)', `khohang=${vKho} danhmuc=${vDm}`);

console.log('\n=== 7. MO PHONG capNhatMaHang: gui rong = xoa, khong gui = giu nguyen ===');
/* Pool gia: ghi lai cau SQL + tham so, tra ve du du lieu cho cac cau SELECT ma util can. */
function poolGia(coCot = true) {
  const nhatKy = [];
  const req = () => {
    const ts = {};
    const r = {
      input(t, k, v) { ts[t] = v; return r; },
      async query(q) {
        nhatKy.push({ q: String(q).replace(/\s+/g, ' ').trim(), ts: { ...ts } });
        if (/COL_LENGTH\('TheKhoHangHoa', 'TenHoaDon'\)/.test(q)) return { recordset: [{ co: coCot ? 1 : 0 }] };
        if (/SELECT MaHangID, MaHang FROM TheKhoHangHoa/.test(q)) return { recordset: [{ MaHangID: 7, MaHang: 'AT26C012' }] };
        if (/SELECT LoaiRi, DonViCoBan, DonViQuyDoi/.test(q)) return { recordset: [{ LoaiRi: 1, DonViCoBan: 'Cái', DonViQuyDoi: 'Ri' }] };
        if (/SELECT MaHangID FROM TheKhoHangHoa WHERE MaHang = @m/.test(q)) return { recordset: [] };
        return { recordset: [], rowsAffected: [1] };
      }
    };
    return r;
  };
  return { pool: { request: req }, nhatKy };
}
const { capNhatMaHang } = require('./maHangCapNhat');
const cauUpdate = nk => (nk.find(x => /^UPDATE TheKhoHangHoa SET/.test(x.q)) || { q: '', ts: {} });

(async () => {
  /* a) GUI ten -> ghi ten */
  let g = poolGia();
  await capNhatMaHang(g.pool, null, 7, { tenHang: 'Áo thu', tenHoaDon: 'Bộ quần áo trẻ em' });
  let u = cauUpdate(g.nhatKy);
  kiem(/TenHoaDon = @TenHoaDon/.test(u.q), 'Gui ten -> UPDATE co TenHoaDon');
  kiem(u.ts.TenHoaDon === 'Bộ quần áo trẻ em', 'Gia tri truyen dung', String(u.ts.TenHoaDon));

  /* b) GUI RONG -> XOA (NULL), khong duoc giu ten cu */
  g = poolGia();
  await capNhatMaHang(g.pool, null, 7, { tenHang: 'Áo thu', tenHoaDon: '' });
  u = cauUpdate(g.nhatKy);
  kiem(/TenHoaDon = @TenHoaDon/.test(u.q), 'Gui rong -> VAN ghi (de xoa duoc)');
  kiem(u.ts.TenHoaDon === null, 'Gui rong -> ghi NULL', String(u.ts.TenHoaDon));

  /* c) KHONG GUI -> khong duoc dung den cot nay */
  g = poolGia();
  await capNhatMaHang(g.pool, null, 7, { tenHang: 'Áo thu' });
  u = cauUpdate(g.nhatKy);
  kiem(!/TenHoaDon/.test(u.q), 'KHONG gui -> UPDATE khong nhac den TenHoaDon (giu nguyen)', u.q.slice(0, 120));

  /* d) CHUA chay migration -> khong duoc nhac den cot, keo "Invalid column name" */
  g = poolGia(false);
  await capNhatMaHang(g.pool, null, 7, { tenHang: 'Áo thu', tenHoaDon: 'Bộ quần áo trẻ em' });
  u = cauUpdate(g.nhatKy);
  kiem(!/TenHoaDon/.test(u.q),
    'Chua chay migration_v690 -> UPDATE bo qua cot, khong sap', u.q.slice(0, 120));
  /* Cac truong con lai VAN phai duoc ghi trong ca 4 canh tren. */
  kiem(/TenHang\s*=\s*ISNULL\(@TenHang, TenHang\)/.test(u.q), 'Cac truong cu van boc ISNULL nhu truoc');

  console.log(`\n================ KET QUA: ${dat} dat / ${truot} sai ================`);
  process.exit(truot ? 1 : 0);
})().catch(err => { console.error('LOI KIEM CHUNG: ' + err.stack); process.exit(1); });
