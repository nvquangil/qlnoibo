/* ================================================================================================
   KIEM CHUNG v7.58 — SUA PHIEU BAN HANG bao loi KHOA NGOAI DonID
   ------------------------------------------------------------------------------------------------
   Loi that: "The INSERT statement conflicted with the FOREIGN KEY constraint FK__PhieuBanH__DonID__..,
   table dbo.DonKhachDatHang, column 'DonID'".
   Nguyen nhan: dong BAN THANG duoc v7.22 sinh DON PHAN CHIEU; man Sua phieu doc lai `DonIDs` roi gui
   nguoc len; PUT XOA don phan chieu (goChiTietPhieu) roi INSERT lai dong voi DUNG id vua xoa.

   Test nay KHONG chi grep. No:
     · CAT that ham `goChiTietPhieu` (+ `dsDonCuaDong`, `goRangBuocDonTrenChiTiet`) ra khoi
       routes/banhang.js va CHAY bang pool gia -> kiem tra danh sach don phan chieu tra ve.
     · CAT that doan loc cua PUT va doan bien doi cua GET /phieu/:id roi CHAY.
     · MO PHONG DUNG KHOA NGOAI: INSERT voi DonID khong con trong bang thi NEM loi y het SQL Server.
       Neu ban sua hong lai, test nay se do bang chinh cau loi ma nguoi dung gap.

   Chay:  node utils/kiem_sua_phieu_ban_hang_don_phan_chieu.js
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

const sBH = doc('routes/banhang.js');
const sFe = doc('../frontend/js/module.khohang.js');
const sIndex = doc('../frontend/index.html');

/* -------- cat khoi ma theo dau ngoac (bo qua ngoac nam trong chuoi) -------- */
function catTuNgoac(src, moc) {
  const i = src.indexOf(moc);
  if (i < 0) return null;
  const mo = src.indexOf('{', i);
  if (mo < 0) return null;
  let sau = 1, j = mo + 1, ch = null;
  for (; j < src.length && sau > 0; j++) {
    const c = src[j];
    if (ch) { if (c === ch && src[j - 1] !== '\\') ch = null; continue; }
    if (c === "'" || c === '"' || c === '`') { ch = c; continue; }
    if (c === '{') sau++; else if (c === '}') sau--;
  }
  if (sau !== 0) return null;
  /* Khoi dang `xxx.forEach(c => { ... })` : dau ngoac dong `}` chua het cau — thieu `)` la
     "SyntaxError: missing ) after argument list" ngay o new Function. Nuot not `)` va `;`. */
  while (j < src.length && (src[j] === ')' || src[j] === ';')) j++;
  return src.slice(i, j);
}

/* ================================================================================================
   1. CAT + CHAY THAT goChiTietPhieu()
   ================================================================================================ */
console.log('\n=== 1. CHAY THAT goChiTietPhieu() bang pool gia ===');
const mGo = catTuNgoac(sBH, 'async function goChiTietPhieu(');
const mDs = catTuNgoac(sBH, 'function dsDonCuaDong(');
const mGoRB = catTuNgoac(sBH, 'async function goRangBuocDonTrenChiTiet(');
kiem(!!mGo && !!mDs && !!mGoRB, 'cat duoc 3 ham tu routes/banhang.js');

/* CSDL gia: mot phieu #1 co 2 dong
     dong A: ma AAA, lay tu DON THAT #101
     dong B: ma BBB, BAN THANG -> v7.22 da sinh DON PHAN CHIEU #201                                */
function taoCSDL() {
  return {
    don: new Map([
      [101, { DonID: 101, NguonDat: null }],           // đơn thật của khách
      [201, { DonID: 201, NguonDat: 'PhieuBH' }]       // đơn phản chiếu do chính phiếu này sinh
    ]),
    chiTiet: [
      { MaHangID: 11, MauSacID: 1, SoLuong: 5, DonVi: 'Cái', DonID: 101, DonIDs: '101', LoaiRi: 1, DonViCoBan: 'Cái' },
      { MaHangID: 22, MauSacID: 2, SoLuong: 3, DonVi: 'Cái', DonID: 201, DonIDs: '201', LoaiRi: 1, DonViCoBan: 'Cái' }
    ],
    nhatKy: []
  };
}
function sqlGia(db) {
  class Request {
    constructor() { this.ts = {}; }
    input(t, k, v) { this.ts[t] = v; return this; }
    async query(q) {
      const s = String(q).replace(/\s+/g, ' ');
      if (/FROM PhieuBanHangChiTiet ct JOIN TheKhoHangHoa/.test(s)) return { recordset: db.chiTiet.slice() };
      if (/UPDATE PhieuBanHangChiTiet SET DonID = NULL/.test(s)) { db.nhatKy.push('go-fk'); return { rowsAffected: [db.chiTiet.length] }; }
      if (/DELETE FROM DonKhachDatHang WHERE DonID = @don AND NguonDat/.test(s)) {
        const d = db.don.get(Number(this.ts.don));
        if (d && d.NguonDat === 'PhieuBH') { db.don.delete(Number(this.ts.don)); db.nhatKy.push('xoa-don-' + this.ts.don); return { rowsAffected: [1] }; }
        return { rowsAffected: [0] };
      }
      if (/UPDATE DonKhachDatHang SET TrangThai = N'Chờ xử lý'/.test(s)) { db.nhatKy.push('tra-don-' + this.ts.don); return { rowsAffected: [1] }; }
      if (/DELETE FROM PhieuBanHangChiTiet WHERE PhieuBHID = @id/.test(s)) { db.chiTiet = []; return { rowsAffected: [2] }; }
      /* Cau kiem "don con ton tai" cua luoi an toan (v7.58) */
      const mIn = s.match(/SELECT DonID FROM DonKhachDatHang WHERE DonID IN \(([^)]*)\)/);
      if (mIn) {
        const ids = mIn[1].split(',').map(x => parseInt(x, 10)).filter(x => x > 0);
        return { recordset: ids.filter(id => db.don.has(id)).map(id => ({ DonID: id })) };
      }
      return { recordset: [], rowsAffected: [0] };
    }
  }
  return { Int: 'Int', NVarChar: 'NVarChar', Request };
}
function dungGo(db) {
  return new Function('sql', 'coCotNguonDat', 'slSangDonViChinh', 'ghiXuatKho', 'NGUON_PHIEU_BH', 'console', `
    ${mDs}\n${mGoRB}\n${mGo}
    return goChiTietPhieu;`)(
    sqlGia(db),
    async () => true,                                   // cot NguonDat da co (migration_v685)
    (sl) => Number(sl) || 0,
    async () => { db.nhatKy.push('hoan-ton'); },
    'PhieuBH',
    { warn() { }, log() { } }
  );
}

(async () => {
  let db = taoCSDL();
  let kqGo = await dungGo(db)({}, {}, 1, true);
  kiem(kqGo && typeof kqGo === 'object' && Array.isArray(kqGo.donTreo) && Array.isArray(kqGo.donPhanChieuDaXoa),
    'goChiTietPhieu tra ve { donTreo, donPhanChieuDaXoa } (khong con tra mang tran)');
  bang(kqGo.donPhanChieuDaXoa, [201], 'don PHAN CHIEU bi xoa duoc BAO CAO ra ngoai');
  bang(kqGo.donTreo, [101], 'don THAT chi ve "Chờ xử lý" -> nam o donTreo (bao cho nguoi dung)');
  kiem(db.nhatKy.indexOf('go-fk') < db.nhatKy.indexOf('xoa-don-201'),
    'van GO DonID ve NULL TRUOC khi xoa don (giu nguyen ban sua v7.42, khong lam vo lai)');
  kiem(!db.don.has(201) && db.don.has(101), 'CSDL sau khi go: don phan chieu bien mat, don that con');

  /* ============================================================================================
     2. CHAY THAT doan loc cua PUT — day la cho THAT SU sua loi
     ============================================================================================ */
  console.log('\n=== 2. CHAY THAT doan loc `donPhanChieuDaXoa` cua PUT ===');
  const mLoc = catTuNgoac(sBH, 'if (donPhanChieuDaXoa.length) {');
  kiem(!!mLoc, 'cat duoc doan loc trong PUT /phieu/:id');
  const chayLoc = (dong, daXoa) => {
    new Function('dong', 'donPhanChieuDaXoa', mLoc)(dong, daXoa);
    return dong;
  };
  /* `dong` do chuanBiPhieu dung ra, dung nhu frontend cu gui len (co ca id don phan chieu). */
  let dong = [
    { maHang: 'AAA', donIDs: [101] },
    { maHang: 'BBB', donIDs: [201] },          // đơn phản chiếu — id đã chết sau khi gỡ
    { maHang: 'CCC', donIDs: [] }              // mã vừa THÊM khi sửa
  ];
  chayLoc(dong, [201]);
  bang(dong.map(d => d.donIDs), [[101], [], []],
    'id don phan chieu bi loai, don that giu nguyen, dong moi van rong');

  /* MO PHONG KHOA NGOAI: chinh cau INSERT cua ghiChiTietPhieu se nem loi neu DonID khong con. */
  console.log('\n=== 2b. Mo phong KHOA NGOAI tren cau INSERT (cau loi y het nguoi dung gap) ===');
  const insert = (donID, conTon) => {
    if (donID != null && !conTon.has(Number(donID))) {
      throw new Error('The INSERT statement conflicted with the FOREIGN KEY constraint '
        + '"FK__PhieuBanH__DonID__02E7657A". The conflict occurred in database "QLNoiBo", '
        + "table \"dbo.DonKhachDatHang\", column 'DonID'.");
    }
    return true;
  };
  const conTon = new Set([101]);   // 201 vừa bị xóa ở bước gỡ
  /* (a) TRUOC khi sua — mo phong hanh vi cu: KHONG loc -> phai NEM DUNG loi nguoi dung bao. */
  let loiCu = null;
  try { [101, 201, null].forEach(id => insert(id, conTon)); } catch (e) { loiCu = e.message; }
  kiem(!!loiCu && /FK__PhieuBanH__DonID/.test(loiCu),
    'khong loc -> tai hien DUNG loi khoa ngoai ma nguoi dung bao (test co that su bat duoc loi)');
  /* (b) SAU khi sua — dung `dong` da loc o tren. */
  let loiMoi = null;
  try { dong.forEach(d => insert(d.donIDs[0] != null ? d.donIDs[0] : null, conTon)); } catch (e) { loiMoi = e.message; }
  kiem(loiMoi === null, 'sau khi loc -> INSERT khong con vi pham khoa ngoai', String(loiMoi));

  /* Dong mat het don -> phai duoc SINH LAI don phan chieu (khong mat lien ket Chi tiet dat hang). */
  console.log('\n=== 2c. Dong mat don phan chieu -> duoc sinh don phan chieu MOI ===');
  kiem(/if \(!d\.donIDs\.length && d\.mauSacId && thongTinPhieu\)/.test(sBH),
    'dieu kien sinh don phan chieu van la "dong khong con don nao"');
  kiem(dong[1].donIDs.length === 0 && dong[2].donIDs.length === 0,
    'ca dong ban thang cu VA dong vua them deu roi vao dieu kien do');

  /* ============================================================================================
     3. LUOI AN TOAN trong ghiChiTietPhieu: bao tieng Viet thay vi loi FK tho
     ============================================================================================ */
  console.log('\n=== 3. Luoi an toan: don khong ton tai -> bao tieng Viet, khong phai loi FK tho ===');
  const mGuard = catTuNgoac(sBH, "if ((d.donIDs || []).length) {");
  kiem(!!mGuard, 'cat duoc doan kiem trong ghiChiTietPhieu');
  const dbG = taoCSDL();
  const chayGuard = async (d) => new Function('sql', 'tran', 'd', `return (async () => { ${mGuard} })();`)(sqlGia(dbG), {}, d);
  let loiGuard = null;
  try { await chayGuard({ maHang: 'BBB', donIDs: [999] }); } catch (e) { loiGuard = e.message; }
  kiem(!!loiGuard && /không còn tồn tại/.test(loiGuard) && /#999/.test(loiGuard),
    'don khong co that -> nem loi TIENG VIET co so hieu don', String(loiGuard));
  kiem(!!loiGuard && !/FOREIGN KEY/.test(loiGuard), 'loi khong con la cau tho cua SQL Server');
  let loiOk = null;
  try { await chayGuard({ maHang: 'AAA', donIDs: [101, 201] }); } catch (e) { loiOk = e.message; }
  kiem(loiOk === null, 'don co that -> di qua binh thuong (khong chan oan)', String(loiOk));

  /* ============================================================================================
     4. GET /phieu/:id tach don that / don phan chieu
     ============================================================================================ */
  console.log('\n=== 4. GET /phieu/:id: DonIDsThat = CHI don that ===');
  const mBien = catTuNgoac(sBH, 'chiTiet.forEach(c => {');
  kiem(!!mBien, 'cat duoc doan bien doi chiTiet trong GET /phieu/:id');
  const ct = [
    { MaHang: 'AAA', DonID: 101, DonIDs: '101' },
    { MaHang: 'BBB', DonID: 201, DonIDs: '201' },          // phản chiếu
    { MaHang: 'CCC', DonID: null, DonIDs: null },          // chưa từng có đơn
    { MaHang: 'DDD', DonID: 102, DonIDs: '102,103' }       // gộp 2 đơn thật
  ];
  new Function('chiTiet', 'phanChieu', 'dsDonCuaDong', mBien)(ct, new Set([201]),
    new Function(`${mDs} return dsDonCuaDong;`)());
  bang(ct.map(c => c.DonIDsThat), ['101', '', '', '102,103'], 'DonIDsThat loai dung don phan chieu');
  bang(ct.map(c => c.LaBanThang), [0, 1, 1, 0], 'LaBanThang dung cho ca 4 canh');
  kiem(/SELECT DonID FROM DonKhachDatHang WHERE PhieuBHID = @id AND NguonDat = N'\$\{NGUON_PHIEU_BH\}'/.test(sBH),
    'tap don phan chieu lay dung theo PhieuBHID + NguonDat (khong doan)');
  kiem(/if \(await coCotNguonDat\(pool\)\)/.test(sBH),
    'do cot NguonDat truoc (chua chay migration_v685 van chay duoc, khong sap route)');

  /* ============================================================================================
     5. FRONTEND: form Sua doc DonIDsThat
     ============================================================================================ */
  console.log('\n=== 5. Frontend: form Sua phieu doc DonIDsThat ===');
  const mFe = (sFe.match(/const ids = String\(c\.DonIDsThat[\s\S]*?\.filter\(x => x > 0\);/) || [])[0];
  kiem(!!mFe, 'cat duoc dong doc ids trong form Sua phieu');
  const chayFe = (c) => new Function('c', `${mFe} return ids;`)(c);
  bang(chayFe({ DonIDsThat: '101', DonIDs: '101' }), [101], 'don that -> giu');
  bang(chayFe({ DonIDsThat: '', DonIDs: '201' }), [], 'don phan chieu -> form coi la BAN THANG (sua duoc ma hang)');
  bang(chayFe({ DonIDsThat: '102,103', DonIDs: '102,103' }), [102, 103], 'gop nhieu don that');
  bang(chayFe({ DonIDs: '201' }), [201], 'backend CU (khong co truong moi) -> lui ve cach cu, khong vo man hinh');
  kiem(/DonIDsThat != null/.test(mFe),
    'dung `!= null` chu khong phai `||` — chuoi rong la GIA TRI HOP LE (khong duoc lui ve DonIDs)');
  kiem(/const tuDon = !!\(r\.donIDs && r\.donIDs\.length\)/.test(sFe),
    'nhan "tu don" van dua tren r.donIDs -> nay chi con don that');

  /* ============================================================================================
     6. Khong pha thu khac
     ============================================================================================ */
  console.log('\n=== 6. Khong pha cho khac ===');
  kiem((bo(sBH).match(/goChiTietPhieu\(/g) || []).length === 2,
    'chi 1 noi GOI goChiTietPhieu (+1 dong dinh nghia) -> doi kieu tra ve khong sot cho nao',
    String((bo(sBH).match(/goChiTietPhieu\(/g) || []).length));
  kiem(/const \{ donTreo: dsDonGo, donPhanChieuDaXoa \} = await goChiTietPhieu\(/.test(sBH),
    'noi goi da nhan dung kieu moi');
  kiem(/const donTreo = \[\.\.\.new Set\(dsDonGo\)\]/.test(sBH),
    'phan tinh donTreo phia duoi van dung bien mang (khong bi vo vi doi kieu)');
  kiem(!/ALTER TABLE PhieuBanHangChiTiet[\s\S]{0,200}DROP CONSTRAINT/.test(sBH),
    'KHONG "sua" bang cach bo khoa ngoai (khoa ngoai la thu duy nhat dang chan du lieu rac)');
  kiem(/module\.khohang\.js\?v=([\d.]+)/.test(sIndex)
    && parseFloat(sIndex.match(/module\.khohang\.js\?v=([\d.]+)/)[1]) >= 7.58,
    'index.html da bump ?v= cua module.khohang.js (>= 7.58)');

  console.log('\n================================================================');
  console.log(`KET QUA: ${dat} dat / ${truot} truot`);
  process.exit(truot ? 1 : 0);
})();
