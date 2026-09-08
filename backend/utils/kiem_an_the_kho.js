/* ================================================================================================
   KIEM CHUNG v7.85 — BO TICH "TAO THE KHO" = AN MA KHOI DANH SACH THE KHO
   ------------------------------------------------------------------------------------------------
   Nguyen: "sua phieu bo dau tich tao the kho di la se khong co trong danh sach the kho. ma hang,
   ton kho van con nguyen chi la khong hien o ben the kho."

   Nguyen chot them: BO TICH THI CHI AN, GIU NGUYEN DU LIEU (khong xoa dong mau / anh); tim lai qua
   tab Phieu nhap kho. Da giu nguyen du lieu thi khong suy ra duoc => phai co co rieng
   (migration_v697: TheKhoHangHoa.AnTheKho).

   ⚠️ BA DIEU KIEN SONG CON, moi cai co assert rieng:
     1. BAN HANG / DON KHACH KHONG DUOC MAT HANG. `/api/khohang/items` dang nuoi 8 man hinh; loc o
        backend la hang vua nhap bien mat khoi man Ban hang. Loc phai nam DUNG MOT CHO: renderItems.
     2. KHONG AN NHAM MA DANG DUNG. Mot ma nam tren nhieu phieu nhap; ma da co so lieu the kho khai
        tay (So cat / Nhap / Xuat khac 0) thi bo tich o mot phieu KHONG duoc lam ca ma bien mat.
     3. MO FORM SUA PHAI TICH DUNG TRANG THAI. O tich von `checked` cung — mo lai phieu dang bi an
        roi bam Luu la ma hien lai am tham.

   Chay:  NODE_PATH=/tmp/tsd/node_modules node utils/kiem_an_the_kho.js
   ================================================================================================ */
const fs = require('fs');
const path = require('path');
const G = path.join(__dirname, '..');
const doc = (p) => fs.readFileSync(path.join(G, p), 'utf8');

let dat = 0, truot = 0;
const OK = (m) => { dat++; console.log('  OK   ' + m); };
const NO = (m) => { truot++; console.log('  SAI  ' + m); };
const kiem = (dk, m, them) => (dk ? OK(m) : NO(m + (them ? '  -> ' + them : '')));
const bang = (thuc, mong, m) => kiem(JSON.stringify(thuc) === JSON.stringify(mong),
  `${m}  [duoc: ${JSON.stringify(thuc)}]`);

const sMig = doc('../database/migration_v697.sql');
const sCaiDat = doc('../database/CAI_DAT_DAY_DU.sql');
const sTKM = doc('utils/theKhoMau.js');
const sNK = doc('routes/nhapkho.js');
const sKH = doc('routes/khohang.js');
const sFeNK = doc('../frontend/js/module.nhapkho.js');
const sFeKH = doc('../frontend/js/module.khohang.js');
const sIndex = doc('../frontend/index.html');

/* ================================================================================================
   1. MIGRATION
   ================================================================================================ */
console.log('\n=== 1. Migration ===');
kiem(/ALTER TABLE TheKhoHangHoa ADD AnTheKho BIT NULL/.test(sMig), 'migration_v697 them cot AnTheKho');
kiem(/IF COL_LENGTH\('TheKhoHangHoa', 'AnTheKho'\) IS NULL/.test(sMig), 'chay lai duoc (co IF COL_LENGTH)');
kiem(/IF DB_NAME\(\) <> N'QLNoiBo'/.test(sMig), 'chan chay nham database');
kiem(/ALTER TABLE TheKhoHangHoa ADD AnTheKho BIT NULL/.test(sCaiDat),
  'CAI_DAT_DAY_DU.sql da gop migration_v697 (cai moi khong thieu cot)');
/* NULL = hien: du lieu dang co khong doi hanh vi. */
kiem(!/AnTheKho BIT NOT NULL/.test(sMig) && !/DEFAULT 1/.test(sMig),
  'cot de NULL (= hien) — khong bat dau bang trang thai AN cho toan bo du lieu cu');

/* ================================================================================================
   2. CHAY THAT datAnTheKho() bang pool gia
   ================================================================================================ */
console.log('\n=== 2. Chay that datAnTheKho() ===');
function catKhoi(s, moc, mo, dong) {
  const i = s.indexOf(moc);
  if (i < 0) return '';
  let d = 0;
  for (let k = s.indexOf(mo, i); k < s.length; k++) {
    if (s[k] === mo) d++;
    else if (s[k] === dong) { d--; if (!d) return s.slice(i, k + 1); }
  }
  return '';
}
const thanDat = catKhoi(sTKM, 'async function datAnTheKho(', '{', '}');
const thanCo = catKhoi(sTKM, 'async function coCotAnTheKho(', '{', '}');
kiem(!!thanDat && !!thanCo, 'cat duoc datAnTheKho + coCotAnTheKho');

/* Pool gia: ghi lai MOI cau SQL de doi chieu, va tra so lieu the kho theo kich ban. */
function taoPool(maCoSoLieu, coCot) {
  const daChay = [];
  const rq = () => {
    const r = {
      _in: {},
      input(k, t, v) { this._in[k] = v; return this; },
      async query(q) {
        daChay.push({ q: String(q).replace(/\s+/g, ' ').trim(), tham: { ...this._in } });
        if (/COL_LENGTH\('TheKhoHangHoa','AnTheKho'\)/.test(q)) return { recordset: [{ t: coCot ? 1 : null }] };
        if (/FROM TheKhoChiTietMau/.test(q)) return { recordset: maCoSoLieu.map(id => ({ MaHangID: id })) };
        return { recordset: [] };
      }
    };
    return r;
  };
  return { pool: { request: rq }, daChay };
}
const sqlGia = { Bit: 'Bit', Int: 'Int' };

async function chay(ids, an, maCoSoLieu, coCot = true) {
  const { pool, daChay } = taoPool(maCoSoLieu, coCot);
  /* `__coCotAn` la bien NHO KET QUA DO o pham vi module. Phai khai lai MOI LAN chay, khong thi canh
     "chua chay migration" bi dinh ket qua do cua canh truoc (da mac dung bay nay o crudFactory). */
  const F = new Function('sql', `let __coCotAn = null;\n${thanCo}\n${thanDat}\nreturn { datAnTheKho };`)(sqlGia);
  const kq = await F.datAnTheKho(pool, null, ids, an);
  return { kq, daChay };
}

(async () => {
  console.log('\n  --- Bo tich: an cac ma cua phieu ---');
  let r = await chay([10, 11, 12], true, []);
  bang(r.kq.daDoi, [10, 11, 12], 'khong ma nao co so lieu the kho -> an ca 3');
  bang(r.kq.boQua, [], 'khong bo qua ma nao');
  const cauUpdate = r.daChay.find(x => /UPDATE TheKhoHangHoa SET AnTheKho/.test(x.q));
  kiem(!!cauUpdate, 'co cau UPDATE dat co');
  bang(cauUpdate && cauUpdate.tham.an, 1, 'dat AnTheKho = 1');
  kiem(/WHERE MaHangID IN \(10,11,12\)/.test(cauUpdate.q), 'UPDATE dung 3 ma cua phieu', cauUpdate.q);
  /* ⚠️ KHONG duoc dung den bat ky bang so lieu nao khac. */
  kiem(!r.daChay.some(x => /DELETE|INSERT|vw_Ton|PhieuNhapKhoHang/i.test(x.q)),
    '⚠️ KHONG xoa gi, KHONG dung den ton kho / phieu nhap — chi UPDATE mot cot co');

  console.log('\n  --- ⚠️ Chan an ma DA CO so lieu the kho khai tay ---');
  r = await chay([10, 11, 12], true, [11]);
  bang(r.kq.daDoi, [10, 12], 'ma 11 co So cat/Nhap/Xuat khac 0 -> KHONG an');
  bang(r.kq.boQua, [11], 'bao lai ma bi bo qua de nguoi dung biet');
  kiem(/WHERE MaHangID IN \(10,12\)/.test(r.daChay.find(x => /UPDATE/.test(x.q)).q),
    'UPDATE chi cho 2 ma con lai');
  const cauDo = r.daChay.find(x => /FROM TheKhoChiTietMau/.test(x.q));
  kiem(!!cauDo && /SoCatCai.*NhapCai.*XuatCai/.test(cauDo.q), 'do ca 3 cot so lieu khai tay');
  /* Bai hoc: doc vw_TonTheoMau la sai — view do gom ca so tu PHIEU NHAP nen ma nao cung "co so lieu". */
  kiem(!/vw_TonTheoMau/.test(cauDo.q),
    '⚠️ doc TheKhoChiTietMau chu KHONG doc vw_TonTheoMau (view gom ca so tu phieu nhap -> khong ma nao an duoc)');

  console.log('\n  --- Tich lai: hien lai, KHONG can kiem so lieu ---');
  r = await chay([10, 11], false, [11]);
  bang(r.kq.daDoi, [10, 11], 'tich lai -> hien lai het, ke ca ma co so lieu');
  bang(r.kq.boQua, [], 'bo hien thi thi khong chan gi');
  bang(r.daChay.find(x => /UPDATE/.test(x.q)).tham.an, 0, 'dat AnTheKho = 0');

  console.log('\n  --- Truong hop bien ---');
  r = await chay([], true, []);
  bang([r.kq.daDoi, r.daChay.filter(x => /UPDATE/.test(x.q)).length], [[], 0],
    'phieu khong co ma nao -> khong chay cau nao');
  r = await chay([10, 10, null, 0, '11'], true, []);
  bang(r.kq.daDoi, [10, 11], 'loc trung + bo id rong/0, nhan ca id dang chuoi');
  r = await chay([10], true, [], false);
  bang([r.kq.daDoi, r.daChay.filter(x => /UPDATE/.test(x.q)).length], [[], 0],
    'CHUA CHAY MIGRATION -> khong lam gi, khong nem loi (phieu nhap van luu duoc)');

  /* ============================================================================================
     3. BAN HANG KHONG DUOC MAT HANG — loc dung MOT cho
     ============================================================================================ */
  console.log('\n=== 3. Chi an o tab The kho, khong dung ban hang ===');
  kiem(/AS AnTheKho/.test(sKH), 'GET /items TRA VE co AnTheKho');
  const rtItems = catKhoi(sKH, "router.get('/items', requireAuth", '{', '}');
  kiem(!/WHERE[^`]*AnTheKho/.test(rtItems) && !/AnTheKho\s*=\s*0/.test(rtItems),
    '⚠️ backend KHONG loc theo AnTheKho (8 man hinh dung chung endpoint nay)');
  /* Dem so cho loc trong ca frontend: phai dung 1. */
  const soChoLoc = (sFeKH.match(/AnTheKho/g) || []).length;
  const trongRenderItems = catKhoi(sFeKH, 'async function renderItems(perm) {', '{', '}');
  kiem(/filter\(r => !Number\(r\.AnTheKho\)\)/.test(trongRenderItems),
    'renderItems loc bo ma da an');
  kiem(soChoLoc <= 3, 'chi renderItems dung den AnTheKho, khong rai ra nhieu cho', 'so lan = ' + soChoLoc);
  /* Cac man khac phai KHONG loc. */
  ['renderBanHang', 'renderHangMau', 'renderBaoGiaAloha'].forEach(fn => {
    const than = catKhoi(sFeKH, 'async function ' + fn + '(', '{', '}');
    if (!than) return;
    kiem(!/AnTheKho/.test(than), `${fn} KHONG loc theo AnTheKho (hang vua nhap van ban duoc)`);
  });
  kiem(/Muốn hiện lại/.test(sFeKH) && /Phiếu nhập kho/.test(trongRenderItems),
    'tab The kho bao ro dang an bao nhieu ma + chi duong lay lai');

  /* ============================================================================================
     4. NOI VAO PHIEU NHAP KHO — ca POST lan PUT
     ============================================================================================ */
  console.log('\n=== 4. Phieu nhap kho ===');
  kiem(/async function dongBoCoAnTheKho\(pool, tran, dsGhi, taoTheKho\)/.test(sNK),
    'co mot ham dong bo co dung chung');
  const rtPost = catKhoi(sNK, "router.post('/phieu', requireAuth", '{', '}');
  const rtPut = catKhoi(sNK, "router.put('/phieu/:id', requireAuth", '{', '}');
  kiem(/dongBoCoAnTheKho\(pool, tran, dsGhi, b\.taoTheKho\)/.test(rtPost), 'POST goi dong bo co');
  kiem(/dongBoCoAnTheKho\(pool, tran, dsGhi, b\.taoTheKho\)/.test(rtPut), 'PUT goi dong bo co');
  /* Cung mot o tich => cung mot hanh vi o ca hai duong luu (mot nghiep vu = mot luong). */
  kiem(/loiNhanCoAn\(co\)/.test(rtPost) && /loiNhanCoAn\(co2\)/.test(rtPut),
    'ca hai duong deu bao lai ket qua bang CUNG mot cau chu');
  /* Goi TRUOC commit thi moi nam trong cung giao dich. */
  const iCo = rtPost.indexOf('dongBoCoAnTheKho'), iCommit = rtPost.indexOf('tran.commit()');
  kiem(iCo > 0 && iCommit > 0 && iCo < iCommit,
    'dat co NAM TRONG giao dich (truoc commit) — hong nua chung thi khong de lai co lung lo');
  kiem(/taoTheKho === false/.test(sNK), 'chi coi la BO TICH khi client gui ro false (khong gui = giu nguyen)');

  console.log('\n=== 5. Form Sua phieu tich dung trang thai ===');
  kiem(/AS AnTheKho/.test(sNK), 'GET /phieu/:id tra ve AnTheKho tung dong');
  kiem(/const dangAnTheKho = !!\(dsAn\.length && dsAn\.every\(x => Number\(x\.AnTheKho\) === 1\)\)/.test(sFeNK),
    'MOI dong deu an thi moi coi la phieu da bo tich');
  kiem(/id="nkfTaoThe" \$\{dangAnTheKho \? '' : 'checked'\}/.test(sFeNK),
    'o tich theo dung trang thai (khong con `checked` cung)');
  kiem(!/id="nkfTaoThe" checked/.test(sFeNK), 'khong con cho nao tich cung');

  console.log('\n=== 6. Bump ?v= ===');
  [['module.khohang.js', 7.85], ['module.nhapkho.js', 7.85]].forEach(([f, min]) => {
    const v = (sIndex.match(new RegExp(f.replace(/\./g, '\\.') + '\\?v=([\\d.]+)')) || [])[1];
    kiem(v && parseFloat(v) >= min, `index.html: ${f}?v= >= ${min}`, String(v));
  });

  console.log('\n================================================================');
  console.log(`KET QUA: ${dat} dat / ${truot} truot`);
  process.exit(truot ? 1 : 0);
})().catch(e => { console.error('LOI TEST: ' + e.stack); process.exit(1); });
