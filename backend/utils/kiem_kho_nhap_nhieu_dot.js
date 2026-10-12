/* ================================================================================================
   KIEM CHUNG v7.56/v7.57 — KHO NHAP: ghi NHIEU DOT + chua du so cat thi GIU LAI o Kho nhap
   ------------------------------------------------------------------------------------------------
   Loi goc: `effectiveTienDoIds()` voi cong doan khac 'CAT' chi lay LAN GHI GAN NHAT, nen o Kho nhap
   ghi lan 2 la THAY THE lan 1 -> khong nhap nhieu dot duoc.

   ⚠️ RUI RO LON NHAT khi sua: doi thang sang cong don se lam MOI LENH CU tung "ghi lai de sua" bi
   CONG GAP LEN — doi "SL hoan thanh", gia thanh, bao cao nang suat ma khong ai biet. Nguoi dung chon
   "CHI LENH MOI CONG DON", nen phai co CO `CongDonKN` va quy tac doc:
        ids = [lan CU gan nhat, neu co] + [TAT CA cac lan co CongDonKN = 1]
   Test nay CHAY THAT quy tac do bang pool gia cho 5 canh du lieu — day la phan quan trong nhat.

   Chay:  node utils/kiem_kho_nhap_nhieu_dot.js
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

const sQlsx = doc('routes/qlsx.js');
const sFe = doc('../frontend/js/module.qlsx.js');
const sMig = doc('../database/migration_v692.sql');
const sCaiDat = doc('../database/CAI_DAT_DAY_DU.sql');
const sIndex = doc('../frontend/index.html');
const sSoi = doc('utils/soi_kho_nhap_nhieu_dot.js');

console.log('\n=== 1. Migration + file cai moi ===');
kiem(/ALTER TABLE TienDoSanXuat ADD CongDonKN BIT NULL/.test(sMig), 'migration_v692 them cot CongDonKN');
kiem(/IF COL_LENGTH\('TienDoSanXuat', 'CongDonKN'\) IS NULL/.test(sMig), 'chay lai duoc');
kiem(/KHONG backfill/i.test(sMig),
  'ghi ro CO TINH khong backfill (backfill = dung cai ma nguoi dung yeu cau tranh)');
kiem(!/UPDATE TienDoSanXuat[\s\S]{0,120}CongDonKN\s*=\s*1/.test(sMig),
  'migration THAT SU khong co lenh backfill nao');
kiem(/ALTER TABLE TienDoSanXuat ADD CongDonKN BIT NULL/.test(sCaiDat),
  'CAI_DAT_DAY_DU.sql da co cot CongDonKN (cai moi khong thieu)');
/* v8.74: cot cho QC/DG. CAI_DAT_DAY_DU.sql duoc SINH TU DONG — thieu thi chay:
       node database\tao_file_cai_dat.js
   Thieu cot nay thi may cai MOI se am tham quay ve che do cu cho QC/Dong goi (chi tinh lan gan
   nhat, khong giu lenh lai o cong doan) ma khong bao gi. */
kiem(/ALTER TABLE TienDoSanXuat ADD CongDonQCDG BIT NULL/.test(sCaiDat),
  'CAI_DAT_DAY_DU.sql da co cot CongDonQCDG — neu do, chay: node database\\tao_file_cai_dat.js');

console.log('\n=== 2. CHAY THAT quy tac doc (phan quan trong nhat) ===');
/* Cat nhanh KN cua effectiveTienDoIds ra khoi file that? Cau SQL nam trong template string nen khong
   chay truc tiep duoc. Thay vao do MO PHONG bang pool gia: cho SQL that chay qua pool gia, pool tra
   ve dung tap dong theo dieu kien -> kiem chinh KET QUA cua ham that. */
const { sql: sqlThat } = (() => { try { return require('../db'); } catch (e) { return { sql: null }; } })();

/* Pool gia: hieu 4 cau truy van ma effectiveTienDoIds dung. `dsDot` = [{TienDoID, CongDonKN}]. */
function poolGia(dsDot, { coCot = true, knStageId = 9 } = {}) {
  const req = () => {
    const ts = {};
    const r = {
      input(t, k, v) { ts[t] = v; return r; },
      async query(q) {
        const s = String(q).replace(/\s+/g, ' ');
        if (/MaCongDoan = 'KN'/.test(s)) return { recordset: [{ StageID: knStageId }] };
        if (/MaCongDoan=N'CAT'|MaCongDoan = 'CAT'/.test(s)) return { recordset: [{ StageID: 1 }] };
        if (/COL_LENGTH\('TienDoSanXuat','CongDonKN'\)/.test(s)) return { recordset: [{ c: coCot ? 1 : null }] };
        /* ⚠️ v8.74: cau SQL doi tu `ISNULL(CongDonKN, 0)` sang `ISNULL(t.CongDonKN, 0)` (them alias
           bang) va bo UNION, dung subquery MAX(TienDoID). Regex phai nhan ca hai dang — khong thi
           pool gia roi xuong nhanh mac dinh tra recordset rong va MOI ca a-e deu fail mot cach
           kho hieu. */
        if (/ISNULL\((?:t\.)?CongDon\w*, 0\) = 1/.test(s)) {
          /* Quy tac: TAT CA dot da danh co + DUNG MOT dot cu moi nhat (lam diem bat dau). */
          const moi = dsDot.filter(d => Number(d.CongDonKN) === 1);
          const cu = dsDot.filter(d => !Number(d.CongDonKN));
          const cuCuoi = cu.length ? [cu[cu.length - 1]] : [];
          return { recordset: [...moi, ...cuCuoi].map(d => ({ TienDoID: d.TienDoID })) };
        }
        if (/SELECT TOP 1 TienDoID, NhomTienDoID/.test(s)) {
          if (!dsDot.length) return { recordset: [] };
          const cuoi = dsDot[dsDot.length - 1];
          return { recordset: [{ TienDoID: cuoi.TienDoID, NhomTienDoID: null }] };
        }
        if (/WHERE TienDoID=@b OR NhomTienDoID=@b/.test(s)) return { recordset: [{ TienDoID: ts.b }] };
        return { recordset: [] };
      }
    };
    return r;
  };
  return { request: req };
}

/* Cat ham effectiveTienDoIds + coCotCongDonKN + getKhoNhapStageId + getCatStageId tu file that. */
function catHam(src, ten) {
  const moc = src.search(new RegExp('(?:async\\s+)?function\\s+' + ten + '\\s*\\('));
  if (moc < 0) return null;
  const mo = src.indexOf('{', moc);
  let sau = 1, i = mo + 1, ch = null;
  for (; i < src.length && sau > 0; i++) {
    const c = src[i];
    if (ch) { if (c === ch && src[i - 1] !== '\\') ch = null; continue; }
    if (c === "'" || c === '"' || c === '`') { ch = c; continue; }
    if (c === '{') sau++; else if (c === '}') sau--;
  }
  return sau === 0 ? src.slice(moc, i) : null;
}
const mEff = catHam(sQlsx, 'effectiveTienDoIds');
const mCoCot = catHam(sQlsx, 'coCotCongDonKN');
const mKn = catHam(sQlsx, 'getKhoNhapStageId');
const mCat = catHam(sQlsx, 'getCatStageId');
kiem(!!mEff && !!mCoCot && !!mKn && !!mCat, 'cat duoc 4 ham tu routes/qlsx.js');

(async () => {
  if (mEff && mCoCot && mKn && mCat) {
    /* Cac ham that dung 2 bien cache o pham vi module (`__coCongDonKN`, `__catStageIdCache`) — phai
       khai lai trong hop kin, keo ReferenceError. Moi lan `tao()` la mot hop MOI nen cache khong
       dinh giua cac canh (bay da mac o kiem_ton_vai.js: cache module song giua 2 pool gia).

       ⚠️ v8.74: `effectiveTienDoIds` nay goi `coCheDoCongDon(pool, stageId)` — ham do quyet dinh
       cong doan nao o che do CONG DON (KN/QC/DG) va dung cot co nao. Khong cap vao hop kin thi moi
       ca duoi deu nem ReferenceError. O day cap BAN GIA: chi KN moi cong don, cot `CongDonKN`, va
       ton tai khi `coCotCongDonKN()` tra true — dung bang hanh vi ma cac ca a–e dang kiem. */
    const tao = () => new Function('sql', `
      let __coCongDonKN = null;
      let __catStageIdCache = null;
      ${mEff}\n${mCoCot}\n${mKn}\n${mCat}
      async function coCheDoCongDon(pool, stageId) {
        const kn = await getKhoNhapStageId(pool);
        if (!kn || Number(stageId) !== Number(kn)) return null;
        return (await coCotCongDonKN(pool)) ? { ma: 'KN', cot: 'CongDonKN' } : null;
      }
      return effectiveTienDoIds;`)({ Int: 'Int' });

    const KN = 9;
    /* a) Lenh CU co 2 dot cu (tung ghi lai de SUA) -> CHI dot cuoi duoc tinh (SO KHONG DOI). */
    let f = tao();
    bang(await f(poolGia([{ TienDoID: 11, CongDonKN: 0 }, { TienDoID: 12, CongDonKN: 0 }]), 5, KN),
      [12], '2 dot CU -> chi dot cuoi (so cua lenh cu KHONG doi)');
    /* b) 1 dot cu + 2 dot moi -> cong ca 3 (so cu duoc giu lam diem bat dau). */
    f = tao();
    bang((await f(poolGia([{ TienDoID: 11, CongDonKN: 0 }, { TienDoID: 20, CongDonKN: 1 }, { TienDoID: 21, CongDonKN: 1 }]), 5, KN)).sort((a, b) => a - b),
      [11, 20, 21], '1 dot cu + 2 dot moi -> cong CA BA (khong mat phan da nhap)');
    /* c) Lenh moi hoan toan -> cong tat ca. */
    f = tao();
    bang((await f(poolGia([{ TienDoID: 30, CongDonKN: 1 }, { TienDoID: 31, CongDonKN: 1 }, { TienDoID: 32, CongDonKN: 1 }]), 5, KN)).sort((a, b) => a - b),
      [30, 31, 32], 'lenh moi 3 dot -> cong tat ca');
    /* d) CHUA chay migration -> quay ve cach cu (chi lan gan nhat). */
    f = tao();
    bang(await f(poolGia([{ TienDoID: 40, CongDonKN: 0 }, { TienDoID: 41, CongDonKN: 0 }], { coCot: false }), 5, KN),
      [41], 'chua chay migration -> y nhu truoc (lan gan nhat)');
    /* e) Cong doan KHAC Kho nhap -> KHONG bi doi hanh vi. */
    f = tao();
    bang(await f(poolGia([{ TienDoID: 50, CongDonKN: 1 }, { TienDoID: 51, CongDonKN: 1 }]), 5, 7),
      [51], 'cong doan khac KN -> van chi lan gan nhat (khong lam anh huong May/LA/DG...)');
  }

  console.log('\n=== 3. Ghi co khi tao lan ghi (KN / QC / DG) ===');
  /* v8.74: khong con so sanh MaCongDoan bang tay o cho ghi — mot bang CHE_DO_CONG_DON quyet dinh. */
  kiem(/\.input\('CoCongDon', sql\.Bit, cheDoCongDon \? 1 : null\)/.test(sQlsx),
    'chi dat = 1 cho cong doan thuoc che do cong don, cong doan khac de NULL');
  kiem(/cheDoCongDon \? ', ' \+ cheDoCongDon\.cot : ''/.test(sQlsx),
    'chua co cot thi KHONG ghi (khong sap route)');
  kiem(/const cheDoCongDon = await coCheDoCongDon\(pool, stage\.StageID\)/.test(sQlsx),
    'do che do mot lan trong route');
  kiem((bo(sQlsx).match(/const CHE_DO_CONG_DON = \[/g) || []).length === 1,
    'chi MOT bang CHE_DO_CONG_DON trong file (mot noi duy nhat quyet dinh cong doan nao cong don)');
  ['KN', 'QC', 'DG'].forEach(m => kiem(
    new RegExp(`\\{ ma: '${m}', cot: 'CongDon\\w+' \\}`).test(sQlsx), `${m} nam trong che do cong don`));

  console.log('\n=== 4. Route xem / sua / xoa TUNG DOT ===');
  ['get', 'put', 'delete'].forEach(m => kiem(
    new RegExp(`router\\.${m}\\('\\/orders\\/:maDH\\/ghinhandot`).test(sQlsx), `co ${m.toUpperCase()} ghinhandot (duong moi)`));
  ['get', 'put', 'delete'].forEach(m => kiem(
    new RegExp(`router\\.${m}\\('\\/orders\\/:maDH\\/ghinhankhonhap`).test(sQlsx),
    `van giu ${m.toUpperCase()} ghinhankhonhap (ban JS cu trong cache trinh duyet khong gay 404)`));
  kiem(/async function timTienDoDot/.test(sQlsx), 'co ham xac thuc ban ghi thuoc dung don + dung cong doan');
  kiem(/!== maChoPhep/.test(sQlsx), 'chan sua ban ghi cua cong doan KHAC qua duong nay');
  const rGet = sQlsx.slice(sQlsx.indexOf('async function docCacDot'),
    sQlsx.indexOf("router.get('/orders/:maDH/ghinhandot"));
  kiem(/const dangTinh = await effectiveTienDoIds\(pool, order\.DonHangID, stageId\)/.test(rGet),
    'tra kem `dangTinh` tu CHINH ham quy tac (khong tu doan lai o frontend)');
  const rDel = sQlsx.slice(sQlsx.indexOf('async function xoaMotDot'));
  kiem(/DELETE FROM TienDoChiTietMau WHERE TienDoID=@id/.test(rDel), 'xoa dong mau truoc khi xoa ban ghi');
  kiem(/KHÔNG kéo lùi công đoạn/.test(rDel), 'ghi ro khong keo lui cong doan cua don (giong xoa so cat)');

  /* 🔴 v8.74 — CHAN XOA DOT QC DANG GIU NGAY SOM NHAT.
     Luong doc MIN(NgayGhiNhan) cua QC lam moc ky (payroll.js / luongGiaCongInThe.js). Xoa dot giu
     moc do la day ca cuc tien sang thang khac, ke ca thang DA CHOT va DA TRA.
     ⚠️ Phai chan theo NGAY, khong theo MIN(TienDoID): dot ghi sau hoan toan co the mang ngay lui ve
     truoc dot dau. */
  kiem(/MinHienTai/.test(rDel) && /MinConLai/.test(rDel),
    'chan xoa dot QC theo MIN(NgayGhiNhan) — so moc TRUOC va SAU khi bo ban ghi');
  kiem(!/MIN\(TienDoID\)/.test(rDel),
    'KHONG chan theo MIN(TienDoID) (dot ghi sau co the co ngay som hon)');
  kiem(/ma === 'QC'/.test(rDel), 'chi chan o QC — Dong goi va Kho nhap khong lien quan toi ky luong');

  console.log('\n=== 5. Form Kho nhap: da nhap / con lai + khoi da ghi ===');
  kiem(/const knStageIdForm = await getKhoNhapStageId\(pool\)/.test(sQlsx), 'GET /orders/:maDH tra SL da nhap theo mau');
  kiem(/slKhoNhapTheoMau/.test(sQlsx) && /slKhoNhapTheoMau/.test(sFe), 'backend tra va frontend dung');
  kiem(/getStageActualQtyByColor\(pool, order\.DonHangID, knStageIdForm\)/.test(sQlsx),
    'dung CHINH getStageActualQtyByColor (cung ham voi con so he thong dang tinh)');
  kiem(/Đã nhập \(lũy kế\)/.test(sFe) && /Còn lại/.test(sFe), 'form hien "Da nhap (luy ke)" va "Con lai"');
  kiem(/SL nhập đợt này/.test(sFe), 'o nhap doi nhan thanh "SL nhap dot nay" (khong phai tong)');
  kiem(/chỉ điền phần <b>nhập thêm lần này<\/b>/.test(sFe), 'noi ro chi dien phan nhap them');
  kiem(/renderKhoNhapDaGhi\(box\.querySelector\('#knDaGhi'\), maDH, perm\)/.test(sFe), 'goi khoi "Kho nhap da ghi"');
  ['renderKhoNhapDaGhi', 'openSuaDotKhoNhapModal'].forEach(h =>
    kiem(new RegExp(`(?:async )?function ${h}\\s*\\(`).test(sFe), `co khai ${h}() trong chinh file`));
  kiem(/KHÔNG<\/b> được cộng vào tổng/.test(sFe),
    'danh dau ro dot CU khong duoc tinh (khong thi nguoi dung cong tay lai khong khop)');

  console.log('\n=== 6. Canh bao vuot "con lai" — va NHAN HE SO dung don vi ===');
  kiem(/nhập VƯỢT phần còn lại so với sổ cắt/.test(sFe), 'co canh bao khi vuot');
  kiem(/!confirm\(/.test(sFe.slice(sFe.indexOf('nhập VƯỢT phần còn lại') - 400, sFe.indexOf('nhập VƯỢT phần còn lại') + 400)),
    'la CANH BAO (confirm) chu khong chan cung — nhap bu la co that');
  /* ⚠️ HAI ASSERTION CU DA BO (khong phai do v8.74 — chung muc tu truoc):
       · `const nhanHeSo = dvQuyDoi && dv === dvQuyDoi ? heSo : 1`
         v8.49 BO han o "Don vi" o form Kho nhap: nay nhap Ri + SL le va payload da la so CAI that
         (soLuongRiLe), khong con phep nhan he so nao o cho so sanh nua.
       · `data-conlai="${conLaiCua(ct)}"`
         v8.59 them DAI SIZE: chu ky thanh conLaiCua(ct, dai).
     Thay bang hai assertion dung voi ban hien tai. */
  kiem(/data-conlai="\$\{conLaiCua\(ct, dai\)\}"/.test(sFe),
    'moi o mang theo "con lai" cua chinh DONG do (mau × dai), khong phai tong ca mau');
  kiem(/soLuongRiLe\(modal, 'kn', ct, dai\)/.test(sFe),
    'payload Kho nhap la so CAI that tu soLuongRiLe() — so thang voi "con lai", khong nhan them he so');
  // v8.74: canh bao vuot dung chung cho QC/DG qua canhBaoVuotSoCat().
  kiem(/function canhBaoVuotSoCat\(/.test(sFe), 'co ham canh bao vuot dung chung cho QC/DG');
  kiem(/ghi VƯỢT phần còn lại so với sổ cắt/.test(sFe), 'QC/DG cung canh bao khi vuot so cat');

  console.log('\n=== 7. CLI soi lenh cu nhieu dot ===');
  kiem(/CHI DOC, khong sua gi/.test(sSoi), 'CLI chi doc');
  kiem(/const cuCuoi = cu\.length \? cu\[cu\.length - 1\] : null/.test(sSoi),
    'CLI ap dung DUNG quy tac doc (dot cu gan nhat + cac dot moi)');
  kiem(/NEU CONG HET/.test(sSoi), 'CLI hien ca "dang tinh" va "neu cong het" de so sanh');
  kiem(/soi_kho_nhap_nhieu_dot/.test(sMig), 'migration co tro den CLI nay');
  /* v8.74: migration moi cho QC/DG. Doc tu dia thay vi them bien o dau file (giu thay doi gon). */
  const sMig874 = (() => {
    try { return require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'database', 'migration_v874.sql'), 'utf8'); }
    catch (e) { return ''; }
  })();
  kiem(/ALTER TABLE TienDoSanXuat ADD CongDonQCDG BIT NULL/.test(sMig874), 'migration_v874 them cot CongDonQCDG');
  kiem(!/UPDATE TienDoSanXuat SET CongDonQCDG/.test(sMig874),
    'migration_v874 KHONG backfill (backfill = lenh cu tung ghi lai bi cong gap len)');
  kiem(/MIN\(NgayGhiNhan\)/.test(sMig874),
    'migration_v874 ghi ro vi sao khong duoc xoa dot QC giu moc ngay (lien quan ky luong)');

  console.log('\n=== 8. Bump ?v= ===');
  const v = parseFloat((sIndex.match(/module\.qlsx\.js\?v=([\d.]+)/) || [])[1] || 0);
  kiem(v >= 7.56, 'index.html: module.qlsx.js da bump >= 7.56', 'dang la ' + v);

  console.log('\n=== 9. v7.57: chua du so cat -> GIU LAI o Kho nhap; co lua chon "Da hoan thanh" ===');
  kiem(/ketThucKhoNhap,/.test(sQlsx), 'route doc `ketThucKhoNhap` tu body');
  const khoiChuyen = sQlsx.slice(sQlsx.indexOf('const nextIndex = curIndex === -1'),
    sQlsx.indexOf('// Bao cho cac user phu trach cong doan KE TIEP'));
  kiem(/if \(coGateGiuLai\) \{/.test(khoiChuyen),
    'tinh knChuaDu CA KHI isLast (Kho nhap thuong LA cong doan cuoi — chinh la truong hop nguoi dung bao)');
  // v8.74: gate mo cho ca QC/DG, quyet dinh bang cheDoCongDon chu khong so ma cong doan bang tay.
  kiem(/const coGateGiuLai = !!cheDoCongDon/.test(khoiChuyen),
    'gate "giu lai" dung CHUNG bang CHE_DO_CONG_DON (KN/QC/DG), khong so ma cong doan bang tay');
  kiem(/knChuaDu = knSoCat > 0 && knDaNhap < knSoCat/.test(khoiChuyen),
    'so cat = 0 thi KHONG coi la chua du (khong co moc de so)');
  kiem(/await getStageActualQty\(pool, order\.DonHangID, stage\.StageID\)/.test(khoiChuyen)
    && /await getTongSLCatForOrder\(pool, order\.DonHangID\)/.test(khoiChuyen),
    'dung CHINH 2 ham cua he thong (khong tinh lai kieu khac)');
  /* ⚠️ Bay da mac khi viet ban nay: ep `isLast = false` -> Kho nhap la cong doan cuoi thi nextIndex = -1
     va dong `stages[nextIndex].StageID` doc stages[-1] -> TypeError moi lan ghi Kho nhap. */
  kiem(/const isLast = curIndex === -1 \|\| nextIndex === -1;/.test(khoiChuyen),
    'isLast van la const — KHONG bi ep lai (ep la stages[-1] -> TypeError)');
  kiem(!/isLast = false/.test(bo(khoiChuyen)), 'khong co cho nao dat lai isLast');
  kiem(/const giuLaiOCongDoan = coGateGiuLai && knChuaDu && !ketThucKhoNhap/.test(khoiChuyen),
    'dieu kien giu lai: cong doan co gate + chua du + KHONG tich hoan thanh');
  kiem(/const advanced = !giuLaiOCongDoan && wouldBeIdx > curPointerIdx/.test(khoiChuyen),
    'giu lai thi KHONG tien con tro');
  kiem(/\} else if \(giuLaiOCongDoan\) \{[\s\S]{0,400}finalStageId = stage\.StageID;/.test(khoiChuyen),
    'con tro tro vao CHINH cong doan vua ghi (giu con tro cu la lenh khong hien o cong doan do)');
  kiem(/finalTrangThai = 'Đang sản xuất';/.test(khoiChuyen.slice(khoiChuyen.indexOf('} else if (giuLaiOCongDoan)'))),
    'trang thai la "Dang san xuat", khong phai "Hoan thanh"');
  kiem(/res\.json\(\{ success: true, data: \{ khoNhap: ketQuaKhoNhap \} \}\)/.test(sQlsx),
    'tra ket qua ve cho frontend (giu lai / ket thuc / da nhap / so cat)');

  console.log('\n=== 9b. Frontend: o tich + thong bao noi ro ket qua ===');
  kiem(/id="knKetThuc"/.test(sFe), 'form Kho nhap co o tich "Da hoan thanh"');
  kiem(/kết thúc lệnh dù chưa nhập đủ số sổ cắt/.test(sFe), 'nhan o tich noi ro y nghia');
  kiem(/payload\.ketThucKhoNhap = !!\(modal\.querySelector\('#knKetThuc'\) \|\| \{\}\)\.checked/.test(sFe),
    'gui co len backend');
  kiem(/id="knKetThucGoiY"/.test(sFe) && /còn <b style="color:#c0392b;">/.test(sFe),
    'dong goi y hien da nhap / so cat / con lai (nguoi dung khong phai tu cong)');
  kiem(/Lệnh chưa ghi tiến độ Cắt nên không có mốc để đối chiếu/.test(sFe),
    'noi ro truong hop chua ghi Cat (khong co moc) -> hanh vi nhu cu');
  kiem(/lệnh VẪN Ở công đoạn Kho nhập để nhập tiếp/.test(sFe),
    'sau khi Gui: bao RO la con o Kho nhap (khong chi "Da ghi nhan tien do")');
  kiem(/Đã kết thúc lệnh với/.test(sFe), 'truong hop ket thuc du chua du cung bao ro');
  kiem(/const kq = await apiPost\(`\/api\/qlsx\/orders\/\$\{maDH\}\/tiendo`/.test(sFe),
    'frontend NHAN ket qua tra ve (truoc day bo qua)');

  console.log('\n=== 10. v8.74: QC + Dong goi ghi nhieu dot (cong don) ===');
  kiem(/const CONG_DOAN_CONG_DON = \['KN', 'QC', 'DG'\]/.test(sFe),
    'frontend khai dung 3 cong doan cong don — PHAI khop CHE_DO_CONG_DON o backend');
  kiem(/else if \(stageCode === 'QC'\)/.test(sFe), 'QC co nhanh render RIENG (khong con roi vao else)');
  /* Bay: nhanh QC phai dung TRUOC `} else {` cuoi, neu khong no khong bao gio chay. */
  const viTriQC = sFe.indexOf("else if (stageCode === 'QC')");
  const viTriElseCuoi = sFe.indexOf('      } else {', sFe.indexOf("else if (stageCode === 'DG')"));
  kiem(viTriQC > 0 && viTriQC < viTriElseCuoi, 'nhanh QC dung TRUOC else cuoi (neu sau thi khong bao gio chay)');
  kiem(/khoiKetThucDotHtml\('QC'\)/.test(sFe) && /khoiKetThucDotHtml\('DG'\)/.test(sFe),
    'ca QC lan DG deu co o tich "Da hoan thanh"');
  kiem(/ganKhoiKetThucDot\(box, 'QC', maDH, perm\)/.test(sFe) && /ganKhoiKetThucDot\(box, 'DG', maDH, perm\)/.test(sFe),
    'ca QC lan DG deu co khoi "cac dot da ghi"');
  kiem(/name="ketThucKhoNhap"/.test(sFe),
    'o tich dung CHUNG ten truong ketThucKhoNhap cho ca 3 cong doan (backend doc dung 1 ten)');
  kiem(/renderKhoNhapDaGhi\(box\.querySelector\('#dotDaGhi'\), maDH, perm, ma\)/.test(sFe),
    'khoi "da ghi" nhan tham so `ma` de goi dung route /ghinhandot/:ma');
  kiem(/MỐC NGÀY QC SỚM NHẤT/.test(sFe),
    'frontend bao truoc khi chan xoa dot QC giu moc ngay (backend van la noi chan that)');
  kiem(/data: \{ records: recs, mau, dangTinh, maCongDoan: ma \}/.test(sQlsx),
    'route tra kem maCongDoan de frontend noi dung ten cong doan');

  console.log(`\n================ KET QUA: ${dat} dat / ${truot} sai ================`);
  process.exit(truot ? 1 : 0);
})().catch(err => { console.error('LOI KIEM CHUNG: ' + err.stack); process.exit(1); });
