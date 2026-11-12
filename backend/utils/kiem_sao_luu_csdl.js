/* ================================================================================================
   kiem_sao_luu_csdl.js — bo tu kiem cho v9.37 (sao luu CSDL tu dong)

   🔴 HAI PHEP QUAN TRONG NHAT, deu CHAY THAT tren thu muc tam:
     Muc 2 — don ban cu KHONG BAO GIO duoc xoa het. Sao luu hong 40 ngay ma van don deu thi den
             ngay 41 khong con ban nao de khoi phuc. Day la loi khong the sua duoc sau khi xay ra.
     Muc 3 — chan dat thu muc sao luu vao uploads/ (phuc vu cong khai ra internet qua cong 80) hoac
             vao chinh thu muc cai phan mem (o hong la mat ca hai).

   Chay:  node backend\utils\kiem_sao_luu_csdl.js
   KHONG copy file nay sang D:\QLSX. KHONG dung toi CSDL that.
   ================================================================================================ */
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');

const GOC = path.join(__dirname, '..', '..');
const doc = (...p) => fs.existsSync(path.join(GOC, ...p)) ? fs.readFileSync(path.join(GOC, ...p), 'utf8') : '';
let sai = 0, dat = 0;
function kiem(ten, dung, td) {
  if (dung) { dat++; console.log('  ✓ ' + ten); }
  else { sai++; console.log('  ❌ ' + ten + (td ? ' — ' + td : '')); }
}

const fSaoLuu = doc('backend', 'utils', 'saoLuuCSDL.js');
const fCanhBao = doc('backend', 'utils', 'canhBaoSaoLuu.js');
const fRoute = doc('backend', 'routes', 'saoluu.js');
const fLich = doc('backend', 'utils', 'lichSaoLuu.js');
const fServer = doc('backend', 'server.js');
const fDb = doc('backend', 'db.js');
/* 🔴 v9.40: man hinh Sao luu da CHUYEN sang phan he rieng `module.saoluu.js` (v9.39). Bo kiem van
   soi `module.users.js` thi:
     · 2 phep ve giao dien DO OAN (tab da go khoi module.users.js) => exit 1 du code dung;
     · 3 phep khac DAU GIA vi khop voi khoi CHET `__CU_renderSaoLuu_KHONG_DUNG` con nam lai trong
       module.users.js — bo kiem bao xanh cho mot man hinh khong ai dung, con man hinh THAT thi
       chua he duoc kiem. Dau gia nguy hiem hon do oan.
   Giu `fUsers` CHI de khang dinh tab da duoc go that su. */
const fUsers = doc('frontend', 'js', 'module.users.js');
const fMan = doc('frontend', 'js', 'module.saoluu.js');
const fApp = doc('frontend', 'js', 'app.js');
const fEnv = doc('backend', '.env.example');
const html = doc('frontend', 'index.html');

console.log('\n=== 1. BIEN DICH ===');
[['utils/saoLuuCSDL.js', fSaoLuu], ['utils/canhBaoSaoLuu.js', fCanhBao], ['routes/saoluu.js', fRoute],
 ['utils/lichSaoLuu.js', fLich], ['server.js', fServer], ['db.js', fDb],
 ['frontend/js/module.users.js', fUsers],
 /* 🔴 Hai file nay la file DUY NHAT doi o v9.39-v9.40 — thieu chung thi muc "bien dich" khong kiem
    gi ca. module.saoluu.js co nhieu khoi chu thich nhung trong template literal: dung cu phap da
    SAP production o v8.06, nen bat buoc phai duoc bien dich thu. */
 ['frontend/js/module.saoluu.js', fMan], ['frontend/js/app.js', fApp]
].forEach(([f, s]) => {
  if (!s) { sai++; console.log('  ❌ ' + f + ' KHONG DOC DUOC'); return; }
  try { new vm.Script(s, { filename: f }); dat++; console.log('  ✓ ' + f); }
  catch (e) { sai++; console.log('  ❌ ' + f + ' VO CU PHAP: ' + e.message); }
});

/* Nap module voi THU_MUC tro vao mot thu muc TAM — module doc env luc require nen phai dat env TRUOC
   va xoa cache de lan nap sau an env moi. */
function napModule(thuMuc, soNgayGiu, soBanLuonGiu) {
  process.env.BACKUP_THU_MUC = thuMuc;
  process.env.BACKUP_SO_NGAY_GIU = String(soNgayGiu);
  process.env.BACKUP_SO_BAN_LUON_GIU = String(soBanLuonGiu);
  process.env.DB_NAME = process.env.DB_NAME || 'QLNoiBo';
  delete require.cache[require.resolve('./saoLuuCSDL')];
  delete require.cache[require.resolve('../db')];
  return require('./saoLuuCSDL');
}
function taoBan(tm, ten, soNgayTruoc) {
  const p = path.join(tm, ten);
  fs.writeFileSync(p, 'x');
  const t = new Date(Date.now() - soNgayTruoc * 24 * 3600 * 1000);
  fs.utimesSync(p, t, t);
}

console.log('\n=== 2. 🔴 DON BAN CU KHONG BAO GIO XOA HET ===');
const tam = fs.mkdtempSync(path.join(os.tmpdir(), 'kiemsaoluu-'));
try {
  const S = napModule(tam, 30, 3);
  const ten = (n) => `${S.TEN_CSDL}_2026010${n}_0100.bak`;
  /* Nam ban, TAT CA deu qua han 30 ngay — tinh huong "sao luu hong 40 ngay". */
  [[1, 100], [2, 90], [3, 80], [4, 70], [5, 60]].forEach(([i, ngay]) => taoBan(tam, ten(i), ngay));
  kiem('dung 5 ban truoc khi don', S.docDanhSachBan().length === 5);

  /* donBanCu khong duoc xuat ra ngoai — goi gian tiep qua chayMotLan thi dung toi CSDL that.
     Nen kiem bang cach doc lai danh sach sau khi tu goi ham noi bo qua require cache... khong duoc.
     Thay vao do: kiem bang HANH VI cua chinh cong thuc, trich ham ra chay. */
  const i = fSaoLuu.indexOf('function donBanCu()');
  let than = null;
  if (i >= 0) {
    let mo = 0, j = fSaoLuu.indexOf('{', i);
    for (; j < fSaoLuu.length; j++) {
      if (fSaoLuu[j] === '{') mo++;
      else if (fSaoLuu[j] === '}') { mo--; if (mo === 0) { than = fSaoLuu.slice(i, j + 1); break; } }
    }
  }
  kiem('trich duoc donBanCu()', !!than);
  if (than) {
    const ctx = vm.createContext({
      docDanhSachBan: S.docDanhSachBan, fs, console, Date,
      __ch: { soNgayGiu: 30, soBanLuonGiu: 3 }
    });
    vm.runInContext(`${than}; __xoa = donBanCu();`, ctx);
    const conLai = S.docDanhSachBan();
    kiem('🔴 TAT CA deu qua han nhung VAN GIU lai dung 3 ban moi nhat',
         conLai.length === 3, 'con ' + conLai.length + ' ban');
    kiem('🔴 ba ban giu lai la ba ban MOI NHAT (khong phai cu nhat)',
         conLai.map(b => b.ten).join(',') === [ten(5), ten(4), ten(3)].join(','),
         conLai.map(b => b.ten).join(','));
    kiem('da xoa dung 2 ban cu nhat', (ctx.__xoa || []).length === 2, JSON.stringify(ctx.__xoa));
  }

  /* Ban CON HAN thi khong duoc dong vao. */
  fs.readdirSync(tam).forEach(f => fs.unlinkSync(path.join(tam, f)));
  [[1, 1], [2, 2], [3, 3], [4, 4], [5, 5]].forEach(([i2, ngay]) => taoBan(tam, ten(i2), ngay));
  if (than) {
    const ctx2 = vm.createContext({
      docDanhSachBan: S.docDanhSachBan, fs, console, Date,
      __ch: { soNgayGiu: 30, soBanLuonGiu: 3 }
    });
    vm.runInContext(`${than}; __xoa = donBanCu();`, ctx2);
    kiem('ban con han -> KHONG xoa cai nao', S.docDanhSachBan().length === 5 && (ctx2.__xoa || []).length === 0);
  }

  console.log('\n=== 3. 🔴 CHAN THU MUC NGUY HIEM ===');
  const uploads = path.join(GOC, 'backend', 'uploads');
  kiem('🔴 chan dat trong uploads/ (phuc vu CONG KHAI ra internet qua cong 80)',
       /uploads/i.test(S.kiemThuMucAnToan(uploads) || ''), S.kiemThuMucAnToan(uploads));
  kiem('🔴 chan dat trong chinh thu muc cai phan mem (o hong = mat ca hai)',
       !!S.kiemThuMucAnToan(path.join(GOC, 'backup')), S.kiemThuMucAnToan(path.join(GOC, 'backup')));
  kiem('chan duong dan tuong doi', /tuyệt đối/i.test(S.kiemThuMucAnToan('backup') || ''));
  kiem('chua khai thu muc -> noi ro, khong im lang', /BACKUP_THU_MUC/.test(S.kiemThuMucAnToan('') || ''));
  kiem('thu muc o o khac -> CHAP NHAN', S.kiemThuMucAnToan(path.join(tam, 'ok')) === '');
} finally {
  try { fs.rmSync(tam, { recursive: true, force: true }); } catch (e) { /* thu muc tam */ }
}

console.log('\n=== 4. 🔴 KHONG LAM SAP PHAN MEM / KHONG LO DU LIEU ===');
kiem('chayMotLan KHONG bao gio nem (moi loi deu qua ghiKetQua)',
     /catch \(e\) \{\s*return ghiKetQua\(false, 'Lỗi ngoài dự kiến/.test(fSaoLuu),
     'promise vang khoi cron = Node giet tien trinh = sap ca phan mem xuong');
kiem('lich trong server.js co try/catch bao ngoai', /catch \(e\) \{\s*console\.error\('\[saoluu\] KHÔNG bật được lịch/.test(fServer));
kiem('gui email hong KHONG lam hong viec sao luu (nuot loi tai cho)',
     /catch \(e\) \{[\s\S]{0,160}không gửi được email báo/.test(fCanhBao));
kiem('🔴 route doi ADMIN, dung truong isAdmin THAT (khong do theo TEN nhom)',
     /u\.isAdmin !== true/.test(fRoute) && !/TenNhom|tên nhóm/i.test(fRoute.replace(/\/\*[\s\S]*?\*\//g, '')),
     'ten nhom doi duoc trong Danh muc — do theo ten la quyen mo toang ma khong ai biet');
/* 🔴 KHONG ghim mot con so cu the (bo kiem viet luc moi co 3 route, nay da 6 => do oan). Dieu CAN
   khang dinh la "MOI route deu duoc gac", nen dem hai ve roi so BANG NHAU: them route moi ma quen
   gac thi phep nay do dung luc, khong phai do vi dem lech. */
{
  const soRoute = (fRoute.match(/^router\.(get|post|put|delete)\(/gm) || []).length;
  const soGac = (fRoute.match(/requireAuth, chiAdmin/g) || []).length;
  kiem('🔴 MOI route cua phan he sao luu deu gac requireAuth + chiAdmin',
       soRoute > 0 && soGac === soRoute,
       soGac + '/' + soRoute + ' route duoc gac — file .bak chua TOAN BO du lieu cong ty');
}
kiem('🔴 /tai/:ten chan di nguoc thu muc (2 lop: khuon ten + kiem lai duong dan)',
     /saoLuu\.khuonTenBan\(\)\.test\(ten\)/.test(fRoute) && /indexOf\(goc \+ path\.sep\) !== 0/.test(fRoute),
     'khong chan = tai duoc bat cu file nao tren may chu');
kiem('KHONG dinh kem file .bak vao email', !/attachments/.test(fCanhBao));

console.log('\n=== 5. 🔴 TIMEOUT: ket noi RIENG, khong sua pool chung ===');
kiem('db.js xuat config de dung lai', /module\.exports = \{ sql, getPool, config \};/.test(fDb));
kiem('🔴 KHONG them requestTimeout vao pool CHUNG (15s dang la tam chan cho moi truy van khac)',
     !/requestTimeout/.test(fDb.replace(/\/\*[\s\S]*?\*\//g, '')));
kiem('sao luu dung ket noi rieng voi requestTimeout dai',
     /requestTimeout: TIMEOUT_SAO_LUU_MS/.test(fSaoLuu) && /new sql\.ConnectionPool\(cfg\)\.connect\(\)/.test(fSaoLuu),
     'dung pool chung = cat o giay thu 15, bao that bai trong khi SQL VAN DANG GHI');
kiem('dong ket noi rieng o finally', /poolSL\.close\(\)/.test(fSaoLuu));

console.log('\n=== 6. XAC MINH + CANH BAO ===');
kiem('🔴 co RESTORE VERIFYONLY sau khi backup (file chua doc lai duoc thi khong phai ban sao luu)',
     /RESTORE VERIFYONLY FROM DISK = @d WITH CHECKSUM/.test(fSaoLuu));
kiem('backup co CHECKSUM + INIT', /WITH INIT, CHECKSUM/.test(fSaoLuu));
kiem('do phien ban truoc khi dung COMPRESSION (Express/Web khong co)',
     /nenDuoc: !\/express\|web\/i\.test\(ed\)/.test(fSaoLuu));
kiem('kiem CHO TRONG truoc khi chay (dung lam day o may chu ca xuong)',
     /choTrongMB\(THU_MUC\)/.test(fSaoLuu) && /KHÔNG sao lưu để tránh làm đầy ổ/.test(fSaoLuu));
kiem('dich loi "Operating system error 5" ra viec phai lam',
     /operating system error 5\|access is denied/i.test(fSaoLuu) && /NT Service/.test(fSaoLuu));
kiem('canh bao khi ban gan nhat qua 36 gio', /gioQua > 36/.test(fSaoLuu));
kiem('canh bao FULL recovery + log phinh (nguyen nhan that cua "SQL hay loi")',
     /FULL recovery/.test(fSaoLuu) && /may\.logMB > may\.dataMB/.test(fSaoLuu));
/* 🔴 "KHONG duoc chua X" phai LOC COMMENT TRUOC. File co comment "KHÔNG dùng toISOString (lệch 7
   tiếng…)" — chinh loi nhac nho cua minh lam phep nay do. Vap lan thu NAM; xem
   feedback_qlnoibo_bo_tu_kiem_phai_loc_comment. Loc ca /* * / lan // roi moi so.
   (kiemThuMucPhu CO dung toISOString trong noi dung file tam — khong lien quan ten ban sao luu,
   nen chi soi doan sinh TEN FILE.) */
{
  const maThuc = fSaoLuu.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const doanTen = (maThuc.match(/const tenFile = [\s\S]{0,300}?;/) || [''])[0];
  kiem('ten file theo GIO VN, KHONG toISOString',
       !!doanTen && !/toISOString/.test(doanTen) && /getFullYear\(\)/.test(doanTen),
       'toISOString lech 7 tieng — ban cua dem 10/11 se mang ten 09/11');
}
kiem('chay BU khi pm2 restart dung gio hen', /daCoBanHomNay/.test(fLich) && /chạy bù/.test(fLich));

console.log('\n=== 6b. 🔴 CHON THU MUC TRONG PHAN MEM (v9.37, Nguyen 10/11) ===');
kiem('cau hinh luu o bang CauHinh key-value DA CO SAN (khong tao bang moi, khong migration)',
     /const KHOA_CH = 'SAO_LUU'/.test(fSaoLuu) && /FROM CauHinh WHERE Khoa = @k/.test(fSaoLuu));
kiem('ban trong CSDL THANG .env (sua tren man hinh xong restart khong bi quay ve cu)',
     /__ch = chuanCauHinh\(JSON\.parse\(r\.GiaTri\)\)/.test(fSaoLuu));
kiem('.env chi la gia tri MAC DINH lan dau', /const MAC_DINH = \{/.test(fSaoLuu));
kiem('🔴 soBanLuonGiu bi chan san 1, KHONG cho 0 (0 = duoc phep xoa sach)',
     /Math\.min\(100, Math\.max\(1, Number\(o\.soBanLuonGiu\)/.test(fSaoLuu));
kiem('luu cau hinh co kiem thu muc an toan TRUOC khi ghi',
     /const loi = kiemThuMucAnToan\(ch\.thuMuc\);\s*\n\s*if \(loi\) throw new Error\(loi\);/.test(fSaoLuu));
kiem('🔴 kiemThuMuc BAT SQL SERVER ghi that (Node ghi duoc KHONG co nghia SQL ghi duoc)',
     /BACKUP DATABASE \[master\] TO DISK = @d/.test(fSaoLuu),
     'fs.accessSync chi chung minh quyen cua Node — dung bay nay la toi dem moi biet backup hong');
kiem('liet ke o dia may chu + danh dau o dang chua CSDL',
     /async function danhSachODia\(\)/.test(fSaoLuu) && /coCSDL: oCuaCSDL\.has\(ky\)/.test(fSaoLuu));
kiem('🔴 doi gio xong DAT LAI LICH ngay (khong doi toi lan restart sau)',
     /require\('\.\.\/utils\/lichSaoLuu'\)\.datLaiLich\(\)/.test(fRoute));
kiem('🔴 datLaiLich HUY task cu truoc khi tao task moi (khong thi hai task cung chay)',
     /function huyLich\(\)/.test(fLich) && /huyLich\(\);/.test(fLich));
kiem('man hinh co o chon thu muc + nut Kiem tra + nut Luu',
     /id="slThuMuc"/.test(fMan) && /btnKiemThuMuc/.test(fMan) && /btnLuuCauHinh/.test(fMan));
kiem('o gio RONG thi KHONG gui gioChay (khong am tham doi lich cua nguoi ta)',
     /if \(g\) o\.gioChay = g;/.test(fMan));
kiem('email hong toi da 1 lan/ngay + bao khi binh thuong lai',
     /CACH_NHAU_MS/.test(fCanhBao) && /đã chạy lại bình thường/.test(fCanhBao));
kiem('🔴 email canh bao doc dia chi tren MAN HINH truoc, .env chi la du phong',
     /saoLuu\.cauHinh\(\)\.emailBao/.test(fCanhBao),
     'chi doc process.env = o "Email bao" luu duoc, hien duoc, va KHONG AI DOC');
kiem('email bao hong NOI DUOC thu muc (khong in "(chua khai)")',
     /thuMucHienTai\(\)/.test(fCanhBao) && !/saoLuu\.THU_MUC/.test(fCanhBao),
     'saoLuu.THU_MUC khong ton tai — email cuu hoa ma khong noi duoc thu muc nao thi vo dung');

console.log('\n=== 6c. 🔴 LICH CO THAT SU DANG CHAY KHONG (v9.40) ===');
kiem('lichSaoLuu xuat trangThaiLich()', /function trangThaiLich\(\)/.test(fLich) && /trangThaiLich/.test(fLich.split('module.exports')[1] || ''));
kiem('🔴 trangThai() DAY trang thai lich vao danh sach canh bao',
     /trangThaiLich\(\)/.test(fSaoLuu) && /LỊCH TỰ ĐỘNG KHÔNG CHẠY/.test(fSaoLuu),
     'o tick "Chay tu dong" chi la Y MUON da luu — datLaiLich co 3 duong tu choi ma chi console.warn');
kiem('canh bao khi CHUA cau hinh SMTP (dung de nguoi dung tuong da co email)',
     /SMTP_HOST/.test(fSaoLuu) && /KHÔNG có email nào được gửi/.test(fSaoLuu));

console.log('\n=== 6d. 🔴 BAN SAO NGOAI MAY + O SQL KHONG THAY (v9.40) ===');
/* Nguyen 10/11/2026 chon G:\\BackupQLNoiBo (Google Drive) va nhan "BACKUP DATABASE is terminating
   abnormally" — cau cuoi cung SQL tra ve, khong phai ly do. Hai viec phai dung: gom DU loi, va noi
   duoc rang SQL khong nhin thay o do. */
kiem('🔴 gom CA precedingErrors, khong chi lay e.message',
     /function moTaLoiSQL/.test(fSaoLuu) && /precedingErrors/.test(fSaoLuu),
     'mssql nem loi CUOI (Msg 3013 "terminating abnormally"); ly do that (Msg 3201) nam o precedingErrors');
kiem('bo cau tong ket vo nghia KHI con cau khac', /terminating abnormally/i.test(fSaoLuu));
kiem('hoi SQL xem no thay nhung o nao (xp_fixeddrives), khong doan theo ten thu muc',
     /xp_fixeddrives/.test(fSaoLuu) && /function oSQLThayDuoc/.test(fSaoLuu));
kiem('🔴 chan NGAY o buoc Kiem tra thu muc khi SQL khong thay o do',
     /Dịch vụ SQL Server KHÔNG NHÌN THẤY ổ/.test(fSaoLuu));
kiem('noi ro DAY KHONG PHAI loi phan quyen (cap quyen bao nhieu cung vo ich)',
     /KHÔNG PHẢI LỖI PHÂN QUYỀN/.test(fSaoLuu));
kiem('hoi ten tai khoan dich vu SQL that thay vi doan',
     /dm_server_services/.test(fSaoLuu) && /service_account/.test(fSaoLuu));
kiem('chep sang thu muc phu SAU khi da RESTORE VERIFYONLY (khong nhan ban mot file hong)', (() => {
  const iVer = fSaoLuu.indexOf('RESTORE VERIFYONLY');
  const iChep = fSaoLuu.indexOf('chepSangThuMucPhu(duongDan');
  return iVer > 0 && iChep > iVer;
})());
kiem('🔴 chep ra ten TAM roi doi ten (Drive dong bo ngay, thay file dang chep do la day ban cut len may)',
     /~dangchep_/.test(fSaoLuu) && /fs\.renameSync\(tam, cuoi\)/.test(fSaoLuu));
kiem('doi chieu KICH THUOC sau khi chep', /cvGoc !== cvTam/.test(fSaoLuu));
kiem('🔴 chep hong KHONG ha thanhCong xuong false (ban trong may van tot — noi that bai la noi doi)',
     /ghiKetQua\(true, tin, tenFile, batDau, cl, loiPhu\)/.test(fSaoLuu));
kiem('nhung chep hong CO kenh bao rieng, moc chong spam RIENG',
     /__lanBaoPhuCuoi/.test(fCanhBao) && /bản sao lưu NGOÀI MÁY không chép được/.test(fCanhBao));
kiem('kiem thu muc phu bang NODE ghi thu (khong doi SQL thay o do — ca muc dich la SQL khong thay)',
     /function kiemThuMucPhu/.test(fSaoLuu) && /_kiemtra_chepduoc\.tmp/.test(fSaoLuu));
kiem('chan thu muc phu TRUNG thu muc chinh', /phải KHÁC thư mục sao lưu chính/.test(fSaoLuu));
kiem('man hinh co o nhap thu muc phu + so ngay giu',
     /id="slThuMucPhu"/.test(fMan) && /id="slNgayPhu"/.test(fMan)
       && /thuMucPhu: body\.querySelector\('#slThuMucPhu'\)/.test(fMan));
kiem('🔴 bam vao o SQL KHONG thay thi dien vao o BAN SAO THU HAI, khong dien vao thu muc chinh',
     /a\.dataset\.sql === '0' \? '#slThuMucPhu' : '#slThuMuc'/.test(fMan),
     'dien vao thu muc chinh = dat nguoi dung vao dung cai loi ho vua mat buoi sang de go');
kiem('noiDay NHAN tham so d (nut Sao luu ngay can d.moiNhat lam moc)',
     /function noiDay\(d\)/.test(fMan));
kiem('🔴 het gio cho o trinh duyet thi HOI LAI may chu, khong ket luan that bai',
     /Trình duyệt hết giờ chờ/.test(fMan) && /api\/saoluu\/trangthai/.test(fMan),
     'BACKUP van chay tiep sau khi trinh duyet bo cuoc — bao that bai la day nguoi dung bo qua canh bao');

console.log('\n=== 6e. 🔴 DON BAN CU KHONG XOA NHAM FILE NGUOI TA DAT TAY ===');
/* 🔴 KHONG so chuoi regex cua chinh no — regex trong regex la cho de do oan nhat (xem phep
   .env.example da do oan vi dem nham so dau gach cheo). Kiem bang HANH VI: cho khuon chay that. */
kiem('dung MOT khuon ten chat cho ca liet ke/don/tai ve', (() => {
  try {
    const m = require('./saoLuuCSDL');
    if (typeof m.khuonTenBan !== 'function') return false;
    const k = m.khuonTenBan();
    return k.test(m.TEN_CSDL + '_20261110_0115.bak')
        && !k.test(m.TEN_CSDL + '_truoc_khi_nang_cap.bak')
        && !k.test(m.TEN_CSDL + '_20261110_0115.bak.tmp')
        && !k.test('KhacHan_20261110_0115.bak');
  } catch (e) { return false; }
})(), 'bo loc "bat dau bang QLNoiBo va .bak" se xoa ca ban nguoi ta co y giu');
{
  /* Chay THAT: dat mot file nguoi dung tu tao vao thu muc roi goi don — no phai con nguyen. */
  const tm = fs.mkdtempSync(path.join(os.tmpdir(), 'kiemdon-'));
  const m = napModule(tm, 1, 1);
  taoBan(tm, 'QLNoiBo_20200101_0100.bak', 900);          // ban that, rat cu
  taoBan(tm, 'QLNoiBo_truoc_khi_nang_cap_v9.bak', 900);  // NGUOI DUNG dat tay
  taoBan(tm, 'QLNoiBo_20991231_2359.bak', 0);            // moi nhat (giu lai theo soBanLuonGiu)
  let con = [];
  try { m.docDanhSachBan(tm); } catch (e) { /* bo qua */ }
  try {
    const ds = m.docDanhSachBan(tm);
    kiem('🔴 file nguoi dung dat tay KHONG duoc coi la ban cua he thong',
         ds.every(b => b.ten !== 'QLNoiBo_truoc_khi_nang_cap_v9.bak'),
         'vao danh sach = du dieu kien bi xoa sau khi qua han');
    con = fs.readdirSync(tm);
    kiem('file do van con nguyen trong thu muc', con.indexOf('QLNoiBo_truoc_khi_nang_cap_v9.bak') !== -1);
  } catch (e) { kiem('chay duoc phep don ban cu', false, e.message); }
  try { fs.rmSync(tm, { recursive: true, force: true }); } catch (e) { /* bo qua */ }
}

console.log('\n=== 6f. 🔴 SAO LUU TRANSACTION LOG (v9.41) ===');
kiem('co ham chayLogMotLan + khuon ten rieng .trn',
     /async function chayLogMotLan/.test(fSaoLuu) && /function khuonTenLog/.test(fSaoLuu));
/* 🔴 "KHONG duoc chua X" phai LOC COMMENT TRUOC — chinh loi nhac nho cua minh ("Cung KHONG dung
   WITH TRUNCATE_ONLY...") lam phep nay do. Vap lan thu SAU; khuon `maThuc` da co san o muc 6. */
{
  const maSL = fSaoLuu.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  kiem('🔴 KHONG dung COPY_ONLY cho BACKUP LOG (COPY_ONLY khong cat log va khong nam trong chuoi)',
       /BACKUP LOG \[\$\{TEN_CSDL\}\]/.test(maSL) && !/BACKUP LOG[\s\S]{0,200}COPY_ONLY/.test(maSL));
  kiem('🔴 KHONG dung TRUNCATE_ONLY (da bo tu SQL 2008, va no PHA chuoi log)',
       !/TRUNCATE_ONLY/.test(maSL));
  kiem('🔴 KHONG dung NO_TRUNCATE / NORECOVERY (deu lam BACKUP LOG khong cat log)',
       !/NO_TRUNCATE/.test(maSL) && !/BACKUP LOG[\s\S]{0,200}NORECOVERY/.test(maSL));
}
kiem('chan truoc khi chay: recovery model phai FULL/BULK',
     /\!\/FULL\|BULK\/i\.test\(tt\.recoveryModel\)/.test(fSaoLuu));
/* `coFullTruocDo === false` xuat hien HAI lan: guard that trong chayLogMotLan, va canh bao trong
   trangThai(). Khong cat lat than ham thi xoa han guard di phep nay VAN xanh — dau gia. */
kiem('chan truoc khi chay: phai co ban FULL truoc do (Msg 4214 khong ai hieu)', (() => {
  const i = fSaoLuu.indexOf('async function chayLogMotLan');
  const j = fSaoLuu.indexOf('BACKUP LOG', i);
  return i > 0 && j > i && /coFullTruocDo === false/.test(fSaoLuu.slice(i, j))
         && /msdb\.dbo\.backupset/.test(fSaoLuu);
})());
kiem('giaiThichLoi dich duoc Msg 4214 / 4208 (tai khoan chi co db_backupoperator khong doc duoc msdb)',
     /no current database backup/.test(fSaoLuu) && /SIMPLE recovery model/.test(fSaoLuu));
kiem('🔴 chan GHI DE file log trung ten (ghi de mot ban log = dut chuoi tu do tro di)',
     /Đã có file trùng tên/.test(fSaoLuu));
kiem('donLogCu DUOC GOI tu chayLogMotLan (phep hanh vi o duoi goi thang, khong chung minh duoc dieu nay)', (() => {
  const i = fSaoLuu.indexOf('async function chayLogMotLan');
  const j = fSaoLuu.indexOf('const sau = await thongTinMayChu', i);
  return i > 0 && j > i && /donLogCu\(\)/.test(fSaoLuu.slice(i, j));
})());
kiem('ten file log co GIAY (moi gio 1 lan van co the bam tay trung phut => WITH INIT ghi de mat 1 mat xich)',
     /_LOG_\$\{nhan\.getFullYear\(\)\}/.test(fSaoLuu) && /hai\(nhan\.getSeconds\(\)\)/.test(fSaoLuu));
kiem('chayLogMotLan co RESTORE VERIFYONLY', (() => {
  const i = fSaoLuu.indexOf('async function chayLogMotLan');
  const j = fSaoLuu.indexOf('chepSangThuMucPhu(duongDan, tenFile)', i);
  return i > 0 && j > i && fSaoLuu.slice(i, j).indexOf('RESTORE VERIFYONLY') > 0;
})());
kiem('doc log va doc ban FULL la HAI khuon tach bach (khong ho nhau)', (() => {
  try {
    const m = require('./saoLuuCSDL');
    const kb = m.khuonTenBan(), kl = m.khuonTenLog();
    const tenBan = m.TEN_CSDL + '_20261110_0115.bak';
    const tenLog = m.TEN_CSDL + '_LOG_20261110_011500.trn';
    return kb.test(tenBan) && !kb.test(tenLog) && kl.test(tenLog) && !kl.test(tenBan);
  } catch (e) { return false; }
})(), 'lan nhau = don ban FULL se xoa file log giua chuoi');

/* 🔴 PHEP QUAN TRONG NHAT CUA v9.41 — chay THAT tren thu muc tam.
   Cac ban log la mot CHUOI: xoa mot file o giua lam MOI moc sau no khong khoi phuc duoc nua, va
   khong co dau hieu nao nhin thay duoc cho toi dung luc can dung. Luat phai la "chi xoa ban log
   CU HON ban FULL CU NHAT con giu", KHONG phai "qua N ngay thi xoa". */
{
  const m = napModule(os.tmpdir(), 30, 3);
  const D = m.TEN_CSDL;
  /* `donLogCu` co luoi "luon giu N ban log moi nhat" (SO_LOG_LUON_GIU = 48) nen bo du lieu thu
     phai NHIEU hon 48, khong thi phep nao cung ra "khong xoa gi" va khong chung minh duoc gi. */
  const hai = (n) => String(n).padStart(2, '0');
  const tenLog = (nam, thang, ngay, gio) => `${D}_LOG_${nam}${hai(thang)}${hai(ngay)}_${hai(gio)}0000.trn`;
  const dungBo = (tm) => {
    taoBan(tm, D + '_20261101_0115.bak', 9);   // FULL CU NHAT con giu
    taoBan(tm, D + '_20261110_0115.bak', 0);   // FULL moi nhat
    /* 60 ban log CU HON ban FULL cu nhat -> vuot luoi 48, phan du phai bi xoa */
    for (let i = 0; i < 60; i++) taoBan(tm, tenLog(2026, 10, 1 + Math.floor(i / 24), i % 24), 40);
    taoBan(tm, tenLog(2026, 11, 3, 12), 7);    // nam GIUA hai ban FULL -> PHAI GIU
    taoBan(tm, tenLog(2026, 11, 10, 9), 0);    // moi nhat -> PHAI GIU
  };

  const tm = fs.mkdtempSync(path.join(os.tmpdir(), 'kiemlog-'));
  dungBo(tm);
  try {
    const daXoa = m.donLogCu(tm);
    const con = fs.readdirSync(tm);
    kiem('🔴 ban log NAM GIUA hai ban FULL KHONG bi xoa (xoa = dut chuoi, mat khoi phuc moi moc sau no)',
         con.indexOf(tenLog(2026, 11, 3, 12)) !== -1,
         'day la loi khong ai thay cho toi dung luc can khoi phuc');
    kiem('ban log moi nhat khong bi xoa', con.indexOf(tenLog(2026, 11, 10, 9)) !== -1);
    kiem('ban log CU HON ban FULL cu nhat THI duoc xoa (khong thi thu muc phinh vo han)',
         daXoa.length > 0 && daXoa.every(t => /_LOG_202610/.test(t)));
    kiem('🔴 LUOI "luon giu 48 ban log moi nhat" co hieu luc (ban sao cua LUAT 1 cho ho file .trn)',
         con.filter(f => /\.trn$/i.test(f)).length >= 48,
         'thieu luoi nay thi mot su co ve moc thoi gian xoa sach ca chuoi trong mot luot');
    kiem('donLogCu KHONG dung toi file .bak', con.filter(f => /\.bak$/i.test(f)).length === 2);
  } catch (e) { kiem('chay duoc donLogCu', false, e.message); }
  try { fs.rmSync(tm, { recursive: true, force: true }); } catch (e) { /* bo qua */ }

  /* 🔴 BAY `mtime`: mo phong dung chuyen da xay ra tren thuc te — ai do chep ca thu muc, hoac
     Google Drive tai lai, lam MOI mtime cua MOI file. Neu moc lay tu mtime thi moc so sanh thanh
     "bay gio" => TOAN BO .trn bi coi la cu hon => xoa sach trong mot luot, im lang. */
  const tm3 = fs.mkdtempSync(path.join(os.tmpdir(), 'kiemlog3-'));
  dungBo(tm3);
  const nay = new Date();
  fs.readdirSync(tm3).forEach(f => { try { fs.utimesSync(path.join(tm3, f), nay, nay); } catch (e) { /* bo qua */ } });
  try {
    m.donLogCu(tm3);
    const con3 = fs.readdirSync(tm3).filter(f => /\.trn$/i.test(f));
    kiem('🔴 mtime cua MOI file bi lam moi (chep thu muc / Drive tai lai) VAN KHONG xoa sach chuoi log',
         con3.length >= 48,
         'con ' + con3.length + ' ban — moc phai lay tu TEN FILE, mtime khong bat bien');
    kiem('ban log nam GIUA hai ban FULL van con du mtime da bi lam moi',
         con3.indexOf(tenLog(2026, 11, 3, 12)) !== -1);
  } catch (e) { kiem('chay duoc donLogCu (bay mtime)', false, e.message); }
  try { fs.rmSync(tm3, { recursive: true, force: true }); } catch (e) { /* bo qua */ }

  /* Chua co ban FULL nao => KHONG duoc xoa gi. Nghi ngo thi GIU. */
  const tm2 = fs.mkdtempSync(path.join(os.tmpdir(), 'kiemlog2-'));
  for (let i = 0; i < 60; i++) taoBan(tm2, tenLog(2020, 1, 1 + Math.floor(i / 24), i % 24), 2000);
  try {
    const daXoa2 = m.donLogCu(tm2);
    kiem('🔴 CHUA co ban FULL nao => khong xoa log nao, du rat cu',
         daXoa2.length === 0 && fs.readdirSync(tm2).length === 60);
  } catch (e) { kiem('chay duoc donLogCu (khong co FULL)', false, e.message); }
  try { fs.rmSync(tm2, { recursive: true, force: true }); } catch (e) { /* bo qua */ }
}

/* 🔴 Lat cat phai neo vao MA, khong neo vao chu "BACKUP LOG" tran — chu do xuat hien trong COMMENT
   truoc cho goi (vap lan thu BAY bay "quen loc comment"). Neo vao `.query(` + BACKUP LOG. */
kiem('🔴 chayLogMotLan CO kiem cho trong truoc khi ghi (o day day = .ldf phinh = CSDL ngung nhan ghi)', (() => {
  const i = fSaoLuu.indexOf('async function chayLogMotLan');
  const j = fSaoLuu.indexOf('.query(`BACKUP LOG', i);
  return i > 0 && j > i && /donDeDuCho\(THU_MUC, [^)]*'log'\)/.test(fSaoLuu.slice(i, j));
})(), 'thu muc sao luu nam tren D:, ma FILE CSDL cung nam tren D:');

console.log('\n=== 6g. 🔴 DON BAN CU NHAT DE LAY CHO (v9.44, Nguyen 11/11) ===');
/* Nguyen: "check dung luong o cung khi con 5Gb thi xoa file cu nhat de luu file moi".
   Goi THANG `donDeDuCho` THAT cua module (xuat tu v9.44), thay phep do cho trong bang so gia qua
   `__datChoTrongGia`. Khong cat lat than ham bang dem ngoac nua — cat lat vo im lang khi ai them mot
   dau ngoac trong chuoi, va mocTuTen gia khong kiem duoc bay mtime. */
{
  const m = napModule(os.tmpdir(), 30, 3);
  const D = m.TEN_CSDL;
  kiem('module xuat donDeDuCho / uocKichThuocMB / mocTuTen / __datChoTrongGia',
       typeof m.donDeDuCho === 'function' && typeof m.__datChoTrongGia === 'function'
         && typeof m.mocTuTen === 'function' && m.TOI_DA_XOA_MOT_LAN === 3);
  const ten = (i) => `${D}_202611${String(i).padStart(2, '0')}_0115.bak`;
  const MB = 1048576;
  /* 🔴 File gia phai > 1 MB: guard "cho trong khong tang" cua donDeDuCho la `trong <= truoc + 1`
     (don vi MB). File dung 1 MB thi xoa xong tang dung 1 MB = trung nguong => guard dung OAN. */
  const CO_BAK = 4 * MB;
  /* Mo phong o dia: chong trong = base + (tong dung luong luc dat − dung luong hien con), do bang readdir. */
  let base = 0;
  const taoBanCo = (tm, name, ngayTruoc, byteSize) => {
    const p = path.join(tm, name);
    fs.writeFileSync(p, Buffer.alloc(byteSize));
    const t = new Date(Date.now() - ngayTruoc * 86400000);
    fs.utimesSync(p, t, t);
  };
  const datODia = (tm) => {
    const daCo = () => fs.readdirSync(tm).reduce((s, f) => { try { return s + fs.statSync(path.join(tm, f)).size; } catch (e) { return s; } }, 0);
    const tong = daCo();                // tu do, khong tin con so go tay
    base = null;
    m.__datChoTrongGia(() => base == null ? null : base + (tong - daCo()) / MB);
    return (trongMB) => { base = trongMB; };
  };

  /* --- CA 1: duoi nguong, 6 ban FULL 1 MB + 50 log, nguong 5 GB, can 0.5 MB cho ban moi ---
     Ky vong: xoa toi da 3 ban cu nhat, dung o 3 ban (luoi), VAN DU cho ban moi (du=true), duoiNguong. */
  {
    const tm = fs.mkdtempSync(path.join(os.tmpdir(), 'kiemdon3-'));
    for (let i = 1; i <= 6; i++) taoBanCo(tm, ten(i), 30 - i, CO_BAK);
    for (let k = 0; k < 50; k++) taoBanCo(tm, `${D}_LOG_20261101_00${String(k).padStart(2, '0')}00.trn`, 29, 1024);
    const dat = datODia(tm);
    dat(100);                                          // 100 MB trong, nguong 5120 MB
    try {
      const r = m.donDeDuCho(tm, 5120, 0.5, 'full');
      const con = fs.readdirSync(tm).filter(f => /\.bak$/i.test(f));
      kiem('🔴 xoa ban CU NHAT truoc, ban moi nhat con nguyen',
           r.daXoa.indexOf(ten(1)) !== -1 && con.indexOf(ten(6)) !== -1, 'da xoa: ' + r.daXoa.join(', '));
      kiem('🔴 toi da ' + m.TOI_DA_XOA_MOT_LAN + ' ban .bak moi lan — lich su mon dan, KHONG boc hoi mot dem',
           r.daXoaBak === 3 && con.length === 3, 'daXoaBak=' + r.daXoaBak + ' con=' + con.length);
      kiem('🔴 van DUOI nguong nhung DU cho ban moi => du=true, duoiNguong=true (ghi, co canh bao; KHONG tu choi)',
           r.du === true && r.duoiNguong === true, 'du=' + r.du + ' duoiNguong=' + r.duoiNguong);
      kiem('ly do noi ro: thu chiem o nhieu kha nang KHONG phai ban sao luu',
           /KHÔNG phải bản sao lưu/.test(r.lyDo || ''), r.lyDo);
      kiem('log cu hon ban FULL cu nhat con lai bi don theo (qua luoi 48)', r.daXoaTrn > 0, 'daXoaTrn=' + r.daXoaTrn);
    } catch (e) { kiem('chay duoc donDeDuCho (ca 1)', false, e.message); }
    try { fs.rmSync(tm, { recursive: true, force: true }); } catch (e) { /* bo qua */ }
  }

  /* --- CA 2: 6 ban × 4 MB, nguong 5120, CHI thieu 6 MB de len nguong => xoa DUNG 2 ban (8 MB) roi dung. */
  {
    const tm = fs.mkdtempSync(path.join(os.tmpdir(), 'kiemdon4-'));
    for (let i = 1; i <= 6; i++) taoBanCo(tm, ten(i), 30 - i, CO_BAK);
    const dat = datODia(tm);
    dat(5120 - 6);
    try {
      const r = m.donDeDuCho(tm, 5120, 0.5, 'full');
      kiem('🔴 len toi nguong la DUNG, khong xoa them (2 ban × 4 MB du 6 MB thieu)',
           r.daXoaBak === 2 && r.du === true && r.duoiNguong === false, 'daXoaBak=' + r.daXoaBak + ' du=' + r.du);
    } catch (e) { kiem('chay duoc donDeDuCho (ca 2)', false, e.message); }
    try { fs.rmSync(tm, { recursive: true, force: true }); } catch (e) { /* bo qua */ }
  }

  /* --- CA 3: chi con 3 ban (= luoi) va duoi nguong va KHONG du cho ban moi => tu choi, khong xoa. */
  {
    const tm = fs.mkdtempSync(path.join(os.tmpdir(), 'kiemdon5-'));
    for (let i = 1; i <= 3; i++) taoBanCo(tm, ten(i), 30 - i, CO_BAK);
    const dat = datODia(tm);
    dat(0.2);
    try {
      const r = m.donDeDuCho(tm, 5120, 0.5, 'full');
      kiem('🔴 cham luoi "luon giu it nhat" => KHONG xoa not ban cuoi, du=false',
           r.daXoaBak === 0 && r.du === false && fs.readdirSync(tm).length === 3,
           'daXoaBak=' + r.daXoaBak + ' du=' + r.du);
    } catch (e) { kiem('chay duoc donDeDuCho (ca 3)', false, e.message); }
    try { fs.rmSync(tm, { recursive: true, force: true }); } catch (e) { /* bo qua */ }
  }

  /* --- CA 4: che do 'log' KHONG BAO GIO xoa .bak, ke ca khi duoi nguong. */
  {
    const tm = fs.mkdtempSync(path.join(os.tmpdir(), 'kiemdon6-'));
    for (let i = 1; i <= 6; i++) taoBanCo(tm, ten(i), 30 - i, CO_BAK);
    const dat = datODia(tm);
    dat(100);
    try {
      const r = m.donDeDuCho(tm, 5120, 0.5, 'log');
      kiem('🔴 che do LOG khong dong vao .bak (lich log chay moi gio — de no xoa ban day du la vai gio mat het)',
           r.daXoaBak === 0 && fs.readdirSync(tm).filter(f => /\.bak$/i.test(f)).length === 6
             && r.du === true, 'daXoaBak=' + r.daXoaBak + ' du=' + r.du);
    } catch (e) { kiem('chay duoc donDeDuCho (ca 4)', false, e.message); }
    try { fs.rmSync(tm, { recursive: true, force: true }); } catch (e) { /* bo qua */ }
  }

  /* --- CA 5: xoa roi ma cho trong KHONG tang (shadow copy / tien trinh giu file) => dung ngay. */
  {
    const tm = fs.mkdtempSync(path.join(os.tmpdir(), 'kiemdon7-'));
    for (let i = 1; i <= 6; i++) taoBanCo(tm, ten(i), 30 - i, CO_BAK);
    m.__datChoTrongGia(() => 100);                     // khong bao gio nhich
    try {
      const r = m.donDeDuCho(tm, 5120, 0.5, 'full');
      kiem('🔴 cho trong khong tang sau khi xoa => DUNG sau 1 ban, khong xoa mu toi han muc',
           r.daXoaBak === 1 && /không tăng/.test(r.lyDo || ''), 'daXoaBak=' + r.daXoaBak + ' lyDo=' + r.lyDo);
    } catch (e) { kiem('chay duoc donDeDuCho (ca 5)', false, e.message); }
    try { fs.rmSync(tm, { recursive: true, force: true }); } catch (e) { /* bo qua */ }
  }

  /* --- CA 6: khong do duoc (null) => KHONG xoa gi, coi nhu du. */
  {
    const tm = fs.mkdtempSync(path.join(os.tmpdir(), 'kiemdon8-'));
    for (let i = 1; i <= 6; i++) taoBanCo(tm, ten(i), 30 - i, CO_BAK);
    m.__datChoTrongGia(() => null);
    try {
      const r = m.donDeDuCho(tm, 5120, 0.5, 'full');
      kiem('🔴 KHONG do duoc cho trong => KHONG xoa mu, du=true',
           r.daXoa.length === 0 && r.du === true && fs.readdirSync(tm).length === 6);
    } catch (e) { kiem('chay duoc donDeDuCho (ca 6)', false, e.message); }
    try { fs.rmSync(tm, { recursive: true, force: true }); } catch (e) { /* bo qua */ }
  }

  /* --- CA 7: du cho + tren nguong => khong dong gi. */
  {
    const tm = fs.mkdtempSync(path.join(os.tmpdir(), 'kiemdon9-'));
    for (let i = 1; i <= 6; i++) taoBanCo(tm, ten(i), 30 - i, CO_BAK);
    m.__datChoTrongGia(() => 999999);
    try {
      const r = m.donDeDuCho(tm, 5120, 0.5, 'full');
      kiem('tren nguong => khong xoa gi, du=true, duoiNguong=false',
           r.daXoa.length === 0 && r.du === true && r.duoiNguong === false && fs.readdirSync(tm).length === 6);
    } catch (e) { kiem('chay duoc donDeDuCho (ca 7)', false, e.message); }
    try { fs.rmSync(tm, { recursive: true, force: true }); } catch (e) { /* bo qua */ }
  }

  /* --- CA 8: .HONG bi xoa TRUOC TIEN, khong tinh vao han muc 3. */
  {
    const tm = fs.mkdtempSync(path.join(os.tmpdir(), 'kiemdon10-'));
    for (let i = 1; i <= 6; i++) taoBanCo(tm, ten(i), 30 - i, CO_BAK);
    taoBanCo(tm, ten(9) + '.HONG', 1, CO_BAK);
    const dat = datODia(tm);
    dat(5120 - 2);                                     // thieu 2 MB: xoa .HONG (4 MB) la du, KHONG dong .bak
    try {
      const r = m.donDeDuCho(tm, 5120, 0.5, 'full');
      kiem('file .HONG (da biet hong) bi xoa truoc, va du roi thi KHONG dong vao ban tot nao',
           r.daXoaHong === 1 && r.daXoaBak === 0 && r.du === true,
           'daXoaHong=' + r.daXoaHong + ' daXoaBak=' + r.daXoaBak);
    } catch (e) { kiem('chay duoc donDeDuCho (ca 8)', false, e.message); }
    try { fs.rmSync(tm, { recursive: true, force: true }); } catch (e) { /* bo qua */ }
  }

  /* 🔴 BAY mtime: mtime cua MOI file bi lam moi (Google Drive tai lai / robocopy), mocTuTen THAT phai
     van chon dung ban CU NHAT THEO TEN. (Phep nay chi kiem duoc vi goi mocTuTen THAT, khong phai ban gia.) */
  {
    const tm = fs.mkdtempSync(path.join(os.tmpdir(), 'kiemdon11-'));
    for (let i = 1; i <= 6; i++) taoBanCo(tm, ten(i), 0, CO_BAK);   // mtime deu = bay gio
    const dat = datODia(tm);
    dat(100);
    try {
      const r = m.donDeDuCho(tm, 5120, 0.5, 'full');
      kiem('🔴 mtime bi lam moi het => VAN xoa dung 3 ban cu nhat THEO TEN (01, 02, 03), giu 04-06',
           r.daXoaBak === 3 && [1, 2, 3].every(i => r.daXoa.indexOf(ten(i)) !== -1)
             && [4, 5, 6].every(i => fs.existsSync(path.join(tm, ten(i)))),
           'da xoa: ' + r.daXoa.join(', '));
    } catch (e) { kiem('chay duoc donDeDuCho (bay mtime)', false, e.message); }
    try { fs.rmSync(tm, { recursive: true, force: true }); } catch (e) { /* bo qua */ }
  }
  m.__datChoTrongGia(null);                            // tra lai phep do that
}
kiem('nguong khai tren man hinh; 0/trong => ve MAC DINH 5, so le nho => san 1',
     /nguongTrongGB: Math\.min\(1000, Math\.max\(1, Number\(o\.nguongTrongGB\)/.test(fSaoLuu)
       && /id="slNguongTrong"/.test(fMan) && /nguongTrongGB: Number\(body\.querySelector\('#slNguongTrong'\)/.test(fMan));
kiem('ca HAI loai sao luu deu di qua donDeDuCho, moi loai dung che do cua minh',
     /donDeDuCho\(THU_MUC, __ch\.nguongTrongGB \* 1024, canMoiMB, 'full'\)/.test(fSaoLuu)
       && /donDeDuCho\(THU_MUC, __ch\.nguongTrongGB \* 1024, canMoiMB, 'log'\)/.test(fSaoLuu));
kiem('🔴 thong diep tu choi KHONG xui "giam luon giu it nhat" (do la day nguoi dang hoang di go luoi cuoi)',
     !/giảm "luôn giữ ít nhất"/.test(fSaoLuu.replace(/\/\*[\s\S]*?\*\//g, '')));
kiem('xoa ban de lay cho CO email rieng (thao tac khong dao nguoc ma im lang la sai)',
     /__lanBaoXoaCuoi/.test(fCanhBao) && /đã xóa .* bản sao lưu cũ để lấy chỗ/.test(fCanhBao)
       && /kqOut\.daXoaLayCho = don\.daXoaBak/.test(fSaoLuu));
kiem('uoc kich thuoc LOG lay MAX(lich su, phan log DANG DUNG) — khong lay moi lich su',
     /Math\.max\(theoLichSu, Number\(tt\.logDungMB\)/.test(fSaoLuu));
kiem('hang SAN_CHO_TRONG_MB cu da go (hang chet + comment noi sai)', !/const SAN_CHO_TRONG_MB/.test(fSaoLuu));
kiem('file truot RESTORE VERIFYONLY bi GAT khoi danh sach (khong thi no thanh "ban dung duoc gan nhat")',
     /function gatFileHong/.test(fSaoLuu) && (fSaoLuu.match(/gatFileHong\(duongDan\)/g) || []).length === 2);

kiem('man hinh KHONG co o "so ngay giu log" (han cua log buoc vao ban FULL, khong de nguoi dung go)',
     !/slNgayLog/.test(fMan) && /id="slBatLog"/.test(fMan) && /id="slGioLog"/.test(fMan));
kiem('man hinh noi ro BACKUP LOG khong lam file .ldf nho lai',
     /không làm file \.ldf nhỏ lại|SHRINKFILE/.test(fMan));
kiem('canh bao "da bat log nhung CSDL khong o FULL"',
     /Đã bật "Sao lưu log" nhưng CSDL đang ở chế độ/.test(fSaoLuu));
kiem('email bao hong log la KENH RIENG, moc chong spam RIENG (lich log chay MOI GIO)',
     /__lanBaoLogCuoi/.test(fCanhBao) && /chayLogVaBao/.test(fCanhBao));
kiem('"hoan vi dang chay sao luu day du" KHONG bi coi la loi (bao dong cho no = day nguoi ta bo qua email)',
     /laHoan/.test(fCanhBao));
kiem('lich log la task THU HAI, doc lap', /__taskLog/.test(fLich) && /trangThaiLichLog/.test(fLich));
/* 🔴 `trangThaiLichLog` co mat trong lichSaoLuu.js chua du — bao dau v9.41 khai no roi KHONG AI GOI,
   tuc lich log van chet cam y nhu loi v9.40 da sua cho lich chinh. Phep nay doi no toi duoc man hinh. */
kiem('🔴 trang thai lich LOG duoc day vao danh sach canh bao (khong thi o tick xanh ma lich chet cam)',
     /trangThaiLichLog\(\)/.test(fSaoLuu) && /LỊCH SAO LƯU LOG KHÔNG CHẠY/.test(fSaoLuu));
kiem('tat "Sao luu log" ma con file .trn cu thi NOI RA (dsLog giau chung khoi man hinh)',
     /Sao lưu log đang TẮT nhưng còn/.test(fSaoLuu));
kiem('🔴 man hinh KHONG bao "mat nhieu nhat X gio" khi CHUA co ban .bak nao (co .trn ma khong .bak = khoi phuc duoc ZERO)',
     /KHÔNG KHÔI PHỤC ĐƯỢC/.test(fMan) && /const mocFull = m \? new Date\(m\.luc\)\.getTime\(\) : null;/.test(fMan),
     'noi lac quan hon su that = kieu sai te nhat mot man hinh sao luu co the mac');
kiem('nguong "qua han" theo CHU KY THAT, khong ghim cung 6 gio', /chuKy \* 3/.test(fMan));
kiem('🔴 tat lich chinh thi tat luon TRANG THAI lich log (khong thi man hinh noi doi)',
     /__ttLog = \{ chay: false, lyDo: 'Lịch sao lưu đầy đủ không chạy/.test(fLich));
kiem('route /chaylog co gac chiAdmin + try\\/catch', /\/chaylog', requireAuth, chiAdmin/.test(fRoute));
kiem('/tai/:ten nhan CA .trn, bang khuon RIENG (khong noi mot khuon cho khop ca hai)',
     /khuonTenBan\(\)\.test\(ten\) && !saoLuu\.khuonTenLog\(\)\.test\(ten\)/.test(fRoute));

console.log('\n=== 7. GIAO DIEN + CAU HINH ===');
/* v9.39: man Sao luu la PHAN HE RIENG, khong con la tab cua Quan ly User. */
kiem('🔴 tab sao luu DA DUOC GO khoi module.users.js (hai man song song la sua ben chet)',
     !/activeTab === 'saoluu'\) return renderSaoLuu\(\)/.test(fUsers),
     'con nhanh nay = ton tai hai man hinh, sua ben nay tuong da xong');
kiem('app.js co phan he SAOLUU tro vao window.ModuleSaoLuu',
     /code: 'SAOLUU'/.test(fApp) && /window\.ModuleSaoLuu/.test(fApp));
kiem('🔴 index.html nap module.saoluu.js TRUOC app.js (khong thi MODULES dung undefined)', (() => {
  const a = html.indexOf('module.saoluu.js');
  const b = html.indexOf('/js/app.js');
  return a > 0 && b > 0 && a < b;
})());
kiem('man sao luu CHI cho Admin', /isAdmin/.test(fMan));
kiem('nut bi KHOA ngay khi bam (chong bam hai lan)', /nut\.disabled = true;/.test(fMan));
/* Phep cu `!/btnKhoiPhuc|RESTORE DATABASE/` SUYT do oan o v9.41: van ban huong dan moi co chu
   "(Restore Database)" va "WITH NORECOVERY". Ghim dung ID cua nut, dung ghim van ban giai thich. */
kiem('man hinh CO Y khong co nut khoi phuc', !/id="btnKhoiPhuc"/.test(fMan));
kiem('.env.example co day du 5 bien', ['BACKUP_THU_MUC', 'BACKUP_GIO_CHAY', 'BACKUP_SO_NGAY_GIU',
  'BACKUP_SO_BAN_LUON_GIU', 'BACKUP_EMAIL_BAO'].every(k => fEnv.indexOf(k) >= 0));
/* Trong .env.example chuoi la `NT Service\MSSQL$...` — MOT dau \. Regex cu doi HAI => do oan. */
kiem('.env.example NOI RO phai cap quyen cho tai khoan DICH VU SQL', /NT Service\\MSSQL/.test(fEnv));
kiem('index.html bump module.saoluu.js >= 9.44', (() => {
  const m = html.match(/module\.saoluu\.js\?v=([\d.]+)/);
  return !!m && parseFloat(m[1]) >= 9.44;
})());
kiem('server.js da gan route', /app\.use\('\/api\/saoluu', saoLuuRoutes\)/.test(fServer));

console.log('\n' + '='.repeat(70));
console.log(sai === 0 ? `✅ ${dat} phep DAT, 0 sai` : `❌ ${sai} SAI / ${dat + sai} phep`);
console.log('='.repeat(70) + '\n');
process.exit(sai === 0 ? 0 : 1);
