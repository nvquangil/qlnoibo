/* ================================================================================================
   KIEM CHUNG v7.59 — HANG MAU / CHO KHACH MUON
   ------------------------------------------------------------------------------------------------
   Loi hua cua ban nay: "van dung luong phieu ban hang binh thuong" — tuc TIEN va TON KHO KHONG DOI,
   chi them mot CO danh dau + cac man hinh doc ra. Test nay kiem DUNG hai thu do:

     (1) CONG THUC "con o khach" duoc CHAY THAT (require ham that, pool gia) tren 6 canh du lieu.
     (2) Co `LaHangMau` KHONG duoc dung vao bat ky phep tinh tien / tru ton nao.

   Test cung chan lai hai bay da tung lam vo viec truoc day:
     · Cache mo-dun (`__coCotHangMau`) song giua cac canh -> canh "chua chay migration" cho ket qua
       cua canh truoc. Moi canh phai NAP LAI mo-dun.
     · Ham co that nhung o FILE KHAC (bai hoc v7.49) -> quet ten ham dung trong tung file.

   Chay:  node utils/kiem_hang_mau_o_khach.js
   ================================================================================================ */
const fs = require('fs');
const path = require('path');
const G = path.join(__dirname, '..');
const doc = (p) => fs.readFileSync(path.join(G, p), 'utf8');

let dat = 0, truot = 0;
const OK = (m) => { dat++; console.log('  OK   ' + m); };
const NO = (m) => { truot++; console.log('  SAI  ' + m); };
const kiem = (dk, m, them) => (dk ? OK(m) : NO(m + (them ? '  -> ' + them : '')));
const bang = (thuc, mong, m) => kiem(JSON.stringify(thuc) === JSON.stringify(mong), `${m}  [duoc: ${JSON.stringify(thuc)}]`);
const bo = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const sUtil = doc('utils/dongDaBanChoKhach.js');
const sBH = doc('routes/banhang.js');
const sNL = doc('routes/nhaplai.js');
const sCongNo = doc('routes/congno.js');
const sFeKho = doc('../frontend/js/module.khohang.js');
const sFeCN = doc('../frontend/js/module.congno.js');
const sMig = doc('../database/migration_v693.sql');
const sCaiDat = doc('../database/CAI_DAT_DAY_DU.sql');
const sIndex = doc('../frontend/index.html');

/* ================================================================================================
   1. CHAY THAT cong thuc "con o khach"
   ================================================================================================ */
console.log('\n=== 1. CHAY THAT layDongDaBan / hangMauDangOKhach bang pool gia ===');

const DUONG_UTIL = require.resolve('./dongDaBanChoKhach');
/* Moi canh NAP LAI mo-dun: `__coCotHangMau` la bien cache o pham vi mo-dun, giu lai giua cac canh se
   lam canh "chua chay migration" an ket qua cua canh truoc (bay da mac o kiem_ton_vai.js). */
function napMoi() { delete require.cache[DUONG_UTIL]; return require('./dongDaBanChoKhach'); }

const sqlGia = { NVarChar: 'NVarChar', Int: 'Int' };
function poolGia(rows, { coCot = true } = {}) {
  const ghi = { cauSQL: '', thamSo: {} };
  const pool = {
    request() {
      const r = {
        input(t, k, v) { ghi.thamSo[t] = v; return r; },
        async query(q) {
          const s = String(q);
          if (/COL_LENGTH\('PhieuBanHang','LaHangMau'\)/.test(s)) return { recordset: [{ c: coCot ? 1 : null }] };
          ghi.cauSQL = s;
          return { recordset: rows.slice() };
        }
      };
      return r;
    }
  };
  return { pool, ghi };
}

/* Mot dong phieu ban hang gia. `SoLuongCai` = SL da giao, `DaTraCai` = SL da nhan lai (do chinh cau
   SQL that tinh bang cau con; o day ta cung cap san ket qua cua cau con do). */
const dong = (o) => ({
  PhieuBHChiTietID: o.ct, PhieuBHID: o.p, SoPhieu: o.sp || ('PBH' + o.p), NgayBan: o.ngay || '2026-08-01',
  TenKhach: o.khach || 'Shop A', LaHangMau: o.mau == null ? 1 : o.mau,
  MaHangID: o.mh || 11, MauSacID: o.ms || 1, SoLuong: o.gui, DonVi: 'Cái', SoLuongCai: o.gui,
  MaHang: o.ma || 'AAA', TenHang: 'Áo', LoaiRi: 1, DonViCoBan: 'Cái', TenMau: o.tenMau || 'Đen',
  DaTraCai: o.tra || 0
});

(async () => {
  /* --- canh a: gui 10, chua tra --- */
  let m = napMoi();
  let g = poolGia([dong({ ct: 1, p: 5, gui: 10, tra: 0 })]);
  let ra = await m.hangMauDangOKhach(g.pool, sqlGia, { tenKhach: 'Shop A', ngayMoc: '2026-08-11' });
  bang(ra.map(r => r.ConOKhachCai), [10], 'gui 10 chua tra -> con 10');
  bang(ra.map(r => r.SoNgayMuon), [10], 'so ngay muon = 01/08 -> 11/08 = 10 ngay');

  /* --- canh b: gui 10, tra 4 --- */
  m = napMoi();
  g = poolGia([dong({ ct: 1, p: 5, gui: 10, tra: 4 })]);
  ra = await m.hangMauDangOKhach(g.pool, sqlGia, { tenKhach: 'Shop A' });
  bang(ra.map(r => r.ConOKhachCai), [6], 'gui 10 tra 4 -> con 6');

  /* --- canh c: tra HET -> con 0, va `chiConGiu` phai loai han dong do --- */
  m = napMoi();
  g = poolGia([dong({ ct: 1, p: 5, gui: 10, tra: 10 })]);
  ra = await m.hangMauDangOKhach(g.pool, sqlGia, { tenKhach: 'Shop A' });
  bang(ra.map(r => r.ConOKhachCai), [0], 'tra het -> con 0 (khong ra so am)');
  m = napMoi();
  g = poolGia([dong({ ct: 1, p: 5, gui: 10, tra: 10 })]);
  ra = await m.hangMauDangOKhach(g.pool, sqlGia, { tenKhach: 'Shop A', chiConGiu: true });
  bang(ra.length, 0, 'chiConGiu -> dong da tra het bi loai khoi so');

  /* --- canh d: tra QUA so gui (du lieu loi) -> chan o 0, KHONG am --- */
  m = napMoi();
  g = poolGia([dong({ ct: 1, p: 5, gui: 10, tra: 14 })]);
  ra = await m.hangMauDangOKhach(g.pool, sqlGia, {});
  bang(ra.map(r => r.ConOKhachCai), [0], 'tra qua so gui -> ket o 0, khong ra so am lam sai tong');

  /* --- canh e: CHUA chay migration_v693 --- */
  m = napMoi();
  g = poolGia([dong({ ct: 1, p: 5, gui: 10, tra: 0 })], { coCot: false });
  ra = await m.hangMauDangOKhach(g.pool, sqlGia, {});
  bang(ra.length, 0, 'chua chay migration -> tra RONG (khong vo tinh coi hang BAN THAT la hang mau)');
  kiem(g.ghi.cauSQL === '', 'va khong chay cau SQL nao (khong ton cong doc bang)');

  /* --- canh f: nhieu lan gui cung ma+mau cho cung khach --- */
  m = napMoi();
  g = poolGia([
    dong({ ct: 1, p: 5, gui: 10, tra: 10, ngay: '2026-07-01' }),   // lần 1 đã trả hết
    dong({ ct: 2, p: 9, gui: 3, tra: 0, ngay: '2026-08-20' })      // lần 2 còn nguyên
  ]);
  ra = await m.hangMauDangOKhach(g.pool, sqlGia, { ngayMoc: '2026-08-30' });
  bang(ra.map(r => r.ConOKhachCai), [0, 3], 'hai lan gui rieng biet -> tinh RIENG tung dong');
  const gom = m.gomTheoKhachMa(ra);
  bang(gom.map(x => x.ConOKhachCai), [3], 'gom theo khach+ma+mau -> chi con 3 (bo dong da tra het)');
  bang(gom.map(x => x.SoPhieu), [['PBH9']], 'va CHI ke phieu con dang giu, khong ke phieu da tra xong');
  bang(gom.map(x => x.SoNgayMuon), [10], 'so ngay muon lay theo dong con dang giu');

  /* ============================================================================================
     2. Cau SQL: cac dieu kien BAT BUOC
     ============================================================================================ */
  console.log('\n=== 2. Cau SQL sinh ra co du cac dieu kien bat buoc ===');
  m = napMoi();
  g = poolGia([dong({ ct: 1, p: 5, gui: 1 })]);
  await m.hangMauDangOKhach(g.pool, sqlGia, { tenKhach: 'Shop A', maHangID: 11 });
  const q = g.ghi.cauSQL.replace(/\s+/g, ' ');
  kiem(/nl\.PhieuBHChiTietID = ct\.ID/.test(q),
    '"da tra" bam theo DUNG DONG phieu ban (PhieuBHChiTietID), khong phai theo ma hang + mau');
  kiem(/np\.TrangThai <> N'Đã hủy'/.test(q), 'phieu NHAP LAI da huy KHONG duoc tinh la da tra');
  kiem(/p\.TrangThai <> N'Đã hủy'/.test(q), 'phieu BAN da huy khong vao so hang mau');
  kiem(/AND ISNULL\(p\.LaHangMau, 0\) = 1/.test(q), 'chiHangMau -> loc dung cot co');
  kiem(/LTRIM\(RTRIM\(p\.TenKhach\)\) = @ten/.test(q), 'loc khach theo TEN da cat khoang trang (khoa nhom cong no)');
  kiem(/AND ct\.MaHangID = @mh/.test(q), 'loc theo ma hang dung tham so, khong noi chuoi');
  kiem(/SUM\(nl\.SoLuongCai\)/.test(q) && /ct\.SoLuongCai/.test(q),
    'CA HAI ve deu dung SoLuongCai (tron voi SoLuong theo Ri se lech LoaiRi lan)');
  /* Khong loc gi -> khong duoc sinh menh de rong lam hong cau. */
  m = napMoi();
  g = poolGia([]);
  await m.layDongDaBan(g.pool, sqlGia, {});
  kiem(!/= @ten/.test(g.ghi.cauSQL) && !/= @mh/.test(g.ghi.cauSQL) && !/= @pid/.test(g.ghi.cauSQL),
    'khong truyen loc -> cau SQL khong con tham so thua (chay duoc, lay tat ca)');

  /* ============================================================================================
     3. LOI HUA LON NHAT: tien va ton kho KHONG DOI
     ============================================================================================ */
  console.log('\n=== 3. Co LaHangMau KHONG duoc dung vao phep tinh tien / tru ton ===');
  const bhSach = bo(sBH);
  /* Liet ke moi dong co nhac toi LaHangMau/laHangMau trong banhang.js va soi tung dong. */
  const dongCoCo = bhSach.split('\n').filter(l => /LaHangMau|laHangMau|coMau/.test(l));
  const dongNguyHiem = dongCoCo.filter(l =>
    /ghiXuatKho|slChinh|soCai|thanhTien|ThanhTien|TongThanhToan|GiaBan|congNo|tien\(/.test(l));
  kiem(dongNguyHiem.length === 0,
    'khong dong nao vua nhac toi co vua dung toi tien/ton', dongNguyHiem.join(' || '));
  kiem(!/if\s*\([^)]*laHangMau[^)]*\)\s*\{[\s\S]{0,400}?ghiXuatKho/.test(bhSach),
    'khong co nhanh "neu la hang mau thi tru ton khac di"');
  kiem(!/LaHangMau[\s\S]{0,200}chuanBiPhieu|chuanBiPhieu[\s\S]{0,400}laHangMau/.test(bhSach),
    'chuanBiPhieu (noi tinh TIEN) khong he biet toi co hang mau');
  kiem(/\.input\('LaHangMau', sql\.Bit, coMau \? \(b\.laHangMau \? 1 : 0\) : null\)/.test(sBH),
    'co duoc ghi bang tham so, do cot truoc (chua chay migration van luu phieu duoc)');
  kiem((sBH.match(/coMau \? ', LaHangMau' : ''/g) || []).length === 1
    && (sBH.match(/coMau \? ', LaHangMau=@LaHangMau' : ''/g) || []).length === 1,
    'CA HAI duong luu (POST them moi + PUT sua) deu ghi co');

  /* ============================================================================================
     4. MOT ban cong thuc — nhaplai.js khong con ban sao
     ============================================================================================ */
  console.log('\n=== 4. Mot ban cong thuc duy nhat ===');
  kiem(/require\('\.\.\/utils\/dongDaBanChoKhach'\)/.test(sNL), 'nhaplai.js NHAP tu util');
  kiem(/require\('\.\.\/utils\/dongDaBanChoKhach'\)/.test(sBH), 'banhang.js NHAP tu util');
  /* Dem CHINH cau con tinh "da tra" — day moi la cong thuc, chu khong phai cai FROM chung chung.
     (banhang.js van co quyen doc PhieuBanHangChiTiet cho viec khac, vd xuat Excel danh sach dong
     hang; chan cai do la chan nham.)  Gop khoang trang truoc khi khop vi nguon co xuong dong. */
  const gon = (s) => s.replace(/\s+/g, ' ');
  const demSQL = (s) => (gon(s).match(/SUM\(nl\.SoLuongCai\) FROM PhieuNhapLaiChiTiet nl/g) || []).length;
  kiem(demSQL(sUtil) === 1, 'util giu DUNG MOT ban cong thuc "da tra"', String(demSQL(sUtil)));
  kiem(demSQL(sNL) === 0, 'nhaplai.js KHONG con ban sao cong thuc', String(demSQL(sNL)));
  kiem(demSQL(sBH) === 0, 'banhang.js KHONG viet cong thuc rieng', String(demSQL(sBH)));
  kiem(demSQL(sCongNo) === 0, 'congno.js cung khong tu tinh lai', String(demSQL(sCongNo)));
  kiem(/const layDongDaBan = \(pool, tenKhach, phieuBHID\) =>/.test(sNL),
    'nhaplai.js giu NGUYEN chu ky ham cu -> 3 cho goi ben duoi khong phai sua');
  kiem((sNL.match(/layDongDaBan\(/g) || []).length >= 4,
    'cac cho goi cu van con nguyen (khong bi bo sot)');

  /* ============================================================================================
     5. Route + quyen (co y khac nhau giua hai route)
     ============================================================================================ */
  console.log('\n=== 5. Route va quyen ===');
  const dongSo = (sBH.match(/router\.get\('\/hangmau'[^\n]*\n[^\n]*/) || [''])[0];
  const dongNhac = (sBH.match(/router\.get\('\/hangmau\/nhac'[^\n]*/) || [''])[0];
  kiem(/requireChucNang\('KHOHANG', 'hangmau'\)/.test(dongSo), 'so rieng gate theo ChucNang tab hangmau');
  kiem(!/requireChucNang/.test(dongNhac),
    'route CANH BAO co y KHONG gate theo tab — nguoi lap phieu chua duoc giao tab so van thay nhac');
  kiem(/requirePermission\('KHOHANG', 'view'\)/.test(dongNhac), 'nhung van doi quyen XEM cua module');
  kiem(/router\.get\('\/hangmau\/export'/.test(sBH), 'co route xuat Excel');
  kiem(/gom: '1'/.test(sBH), 'route nhac luon tra ban GOM theo ma + mau');

  /* ============================================================================================
     6. Migration + file cai moi
     ============================================================================================ */
  console.log('\n=== 6. Migration + CAI_DAT_DAY_DU ===');
  kiem(/ALTER TABLE PhieuBanHang ADD LaHangMau BIT NULL/.test(sMig), 'migration_v693 them cot');
  kiem(/IF COL_LENGTH\('PhieuBanHang', 'LaHangMau'\) IS NULL/.test(sMig), 'chay lai duoc');
  kiem(/'KHOHANG','hangmau'/.test(sMig), 'seed ChucNang KHOHANG/hangmau');
  kiem(/LaHangMau\s+BIT NULL/.test(sCaiDat), 'CAI_DAT_DAY_DU.sql: CREATE TABLE PhieuBanHang da co cot');
  kiem(/\('KHOHANG','hangmau'/.test(sCaiDat), 'CAI_DAT_DAY_DU.sql: seed chuc nang tab moi');
  kiem(!/UPDATE PhieuBanHang[\s\S]{0,120}LaHangMau\s*=\s*1/.test(sMig),
    'KHONG backfill — khong the doan phieu cu nao la gui mau');
  kiem(/PHAI cap quyen/.test(sMig), 'migration nhac phai cap quyen (khong cap thi tab bao khong co quyen)');

  /* ============================================================================================
     7. Frontend
     ============================================================================================ */
  console.log('\n=== 7. Frontend ===');
  kiem(/\{ key: 'hangmau', label: 'Hàng mẫu ở khách' \}/.test(sFeKho), 'co tab moi trong getTabs');
  kiem(/if \(activeTab === 'hangmau'\) return renderHangMau\(perm\);/.test(sFeKho), 'render() co nhanh cho tab moi');
  kiem(/async function renderHangMau\(perm\)/.test(sFeKho),
    'renderHangMau CO THAT (tab tro toi ham khong ton tai = trang trang, node --check khong bat duoc)');
  /* Key tab PHAI trung key ChucNang, khong thi tab luon bi coi la khong co quyen. */
  const keyTab = (sFeKho.match(/\{ key: '(hangmau)', label:/) || [])[1];
  const keyCN = (sMig.match(/\('KHOHANG','(hangmau)'/) || [])[1];
  kiem(keyTab && keyTab === keyCN, `key tab === key ChucNang ('${keyTab}' vs '${keyCN}')`);
  kiem(/name="laHangMau" id="bhLaHangMau"/.test(sFeKho), 'form phieu ban hang co o tich');
  kiem(/laHangMau: !!fd\.get\('laHangMau'\)/.test(sFeKho), 'payload gui co len backend');
  kiem(/Number\(phieuSua\.header\.LaHangMau\) === 1 \? 'checked' : ''/.test(sFeKho),
    'mo SUA phieu thi o tich hien dung trang thai da luu');
  kiem(/async function taiNhacMau\(\)/.test(sFeKho) && /catch \(err\) \{\s*dsNhacMau = \[\];/.test(sFeKho),
    'khoi nhac tu bat loi — API phu hong KHONG duoc chan viec lap phieu');
  kiem(/hangmau\/nhac\?tenKhach=/.test(sFeKho), 'nhac tra theo TEN khach');
  kiem(/hangmau\/nhac\?maHangID=/.test(sFeKho), 'popup The kho tra theo MA HANG');
  kiem(/try \{\s*mauOKhach = \(await apiGet\('\/api\/banhang\/hangmau\/nhac\?maHangID=/.test(sFeKho),
    'popup The kho cung bat loi (khong thi ca popup Lich su khong mo duoc)');
  kiem(/HÀNG GỬI MẪU \/ CHO MƯỢN/.test(sFeKho), 'ban IN ghi ro la hang gui mau');
  kiem(/taiFileXlsx\(bx, '\/api\/banhang\/hangmau\/export'/.test(sFeKho),
    'goi taiFileXlsx dung chu ky (btn, url, tenDuPhong, nhanLoi) — sai thu tu la tai ra file hong');
  kiem(/Number\(r\.LaHangMau\) === 1/.test(sFeCN), 'so chi tiet cong no danh dau dong gui mau');
  kiem(/ISNULL\(LaHangMau, 0\)/.test(sCongNo) && /coCot\(pool, 'PhieuBanHang', 'LaHangMau'\)/.test(sCongNo),
    'congno.js do cot truoc khi doc (chua chay migration van mo duoc so)');
  ['module.khohang.js', 'module.congno.js'].forEach(f => {
    const v = (sIndex.match(new RegExp(f.replace('.', '\\.') + '\\?v=([\\d.]+)')) || [])[1];
    kiem(v && parseFloat(v) >= 7.59, `index.html da bump ?v= cua ${f} (>= 7.59)`, String(v));
  });

  /* ============================================================================================
     8. Ham dung trong file nao phai khai/nhap trong CHINH file do (bai hoc v7.49)
     ============================================================================================ */
  console.log('\n=== 8. Ham co that trong CHINH file goi ===');
  [['routes/banhang.js', sBH], ['routes/nhaplai.js', sNL], ['utils/dongDaBanChoKhach.js', sUtil]].forEach(([ten, src]) => {
    const s2 = bo(src);
    const tenHam = ['hangMauDangOKhach', 'gomTheoKhachMa', 'coCotHangMau', 'layDongDaBan', '__layDongDaBan', 'docHangMau'];
    tenHam.filter(n => new RegExp('\\b' + n + '\\s*\\(').test(s2)).forEach(n => {
      const khai = new RegExp('(async\\s+)?function\\s+' + n + '\\b|const\\s+' + n + '\\b|\\b' + n + '\\s*:\\s*\\w+\\s*\\}|\\{[^}]*\\b' + n + '\\b[^}]*\\}\\s*=\\s*require').test(s2);
      kiem(khai, `${ten}: ${n} co khai/nhap trong chinh file`);
    });
  });

  console.log('\n================================================================');
  console.log(`KET QUA: ${dat} dat / ${truot} truot`);
  process.exit(truot ? 1 : 0);
})();
