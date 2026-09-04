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
  'CAI_DAT_DAY_DU.sql da co cot (cai moi khong thieu)');

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
        if (/ISNULL\(CongDonKN, 0\) = 1/.test(s)) {
          /* Cau UNION: nhanh 1 = moi (co co), nhanh 2 = TOP 1 dot CU moi nhat. */
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
       dinh giua cac canh (bay da mac o kiem_ton_vai.js: cache module song giua 2 pool gia). */
    const tao = () => new Function('sql', `
      let __coCongDonKN = null;
      let __catStageIdCache = null;
      ${mEff}\n${mCoCot}\n${mKn}\n${mCat}
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

  console.log('\n=== 3. Ghi co khi tao lan ghi Kho nhap ===');
  kiem(/\.input\('CongDonKN', sql\.Bit, isKhoNhap \? 1 : null\)/.test(sQlsx),
    'chi dat = 1 cho dung cong doan KN, cong doan khac de NULL');
  kiem(/coCongDon \? ', CongDonKN' : ''/.test(sQlsx), 'chua co cot thi KHONG ghi (khong sap route)');
  kiem(/const coCongDon = await coCotCongDonKN\(pool\)/.test(sQlsx), 'do cot mot lan trong route');
  kiem((bo(sQlsx).match(/function coCotCongDonKN/g) || []).length === 1,
    'chi MOT ham do cot CongDonKN trong file');

  console.log('\n=== 4. Route xem / sua / xoa TUNG DOT ===');
  ['get', 'put', 'delete'].forEach(m => kiem(
    new RegExp(`router\\.${m}\\('\\/orders\\/:maDH\\/ghinhankhonhap`).test(sQlsx), `co ${m.toUpperCase()} ghinhankhonhap`));
  kiem(/async function timTienDoKhoNhap/.test(sQlsx), 'co ham xac thuc ban ghi thuoc dung don + dung cong doan');
  kiem(/MaCongDoan !== 'KN'/.test(sQlsx), 'chan sua ban ghi cua cong doan KHAC qua duong nay');
  const rGet = sQlsx.slice(sQlsx.indexOf("router.get('/orders/:maDH/ghinhankhonhap'"),
    sQlsx.indexOf("router.put('/orders/:maDH/ghinhankhonhap"));
  kiem(/const dangTinh = await effectiveTienDoIds\(pool, order\.DonHangID, knId\)/.test(rGet),
    'tra kem `dangTinh` tu CHINH ham quy tac (khong tu doan lai o frontend)');
  const rDel = sQlsx.slice(sQlsx.indexOf("router.delete('/orders/:maDH/ghinhankhonhap"));
  kiem(/DELETE FROM TienDoChiTietMau WHERE TienDoID=@id/.test(rDel), 'xoa dong mau truoc khi xoa ban ghi');
  kiem(/KHÔNG kéo lùi công đoạn/.test(rDel), 'ghi ro khong keo lui cong doan cua don (giong xoa so cat)');

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
  /* Bay: o nhap co the theo DVT quy doi (Ri) -> 1 = nhieu cai. Khong nhan he so truoc khi so voi
     "con lai" (tinh theo don vi chinh) la canh bao sai het. */
  kiem(/const nhanHeSo = dvQuyDoi && dv === dvQuyDoi \? heSo : 1/.test(sFe),
    'NHAN he so khi o nhap dang theo DVT quy doi truoc khi so voi con lai');
  kiem(/data-conlai="\$\{conLaiCua\(ct\)\}"/.test(sFe), 'moi o mang theo "con lai" cua chinh mau do');

  console.log('\n=== 7. CLI soi lenh cu nhieu dot ===');
  kiem(/CHI DOC, khong sua gi/.test(sSoi), 'CLI chi doc');
  kiem(/const cuCuoi = cu\.length \? cu\[cu\.length - 1\] : null/.test(sSoi),
    'CLI ap dung DUNG quy tac doc (dot cu gan nhat + cac dot moi)');
  kiem(/NEU CONG HET/.test(sSoi), 'CLI hien ca "dang tinh" va "neu cong het" de so sanh');
  kiem(/soi_kho_nhap_nhieu_dot/.test(sMig), 'migration co tro den CLI nay');

  console.log('\n=== 8. Bump ?v= ===');
  const v = parseFloat((sIndex.match(/module\.qlsx\.js\?v=([\d.]+)/) || [])[1] || 0);
  kiem(v >= 7.56, 'index.html: module.qlsx.js da bump >= 7.56', 'dang la ' + v);

  console.log('\n=== 9. v7.57: chua du so cat -> GIU LAI o Kho nhap; co lua chon "Da hoan thanh" ===');
  kiem(/ketThucKhoNhap,/.test(sQlsx), 'route doc `ketThucKhoNhap` tu body');
  const khoiChuyen = sQlsx.slice(sQlsx.indexOf('const nextIndex = curIndex === -1'),
    sQlsx.indexOf('// Bao cho cac user phu trach cong doan KE TIEP'));
  kiem(/if \(isKhoNhap\) \{/.test(khoiChuyen),
    'tinh knChuaDu CA KHI isLast (Kho nhap thuong LA cong doan cuoi — chinh la truong hop nguoi dung bao)');
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
  kiem(/const giuLaiOKhoNhap = isKhoNhap && knChuaDu && !ketThucKhoNhap/.test(khoiChuyen),
    'dieu kien giu lai: dung cong doan KN + chua du + KHONG tich hoan thanh');
  kiem(/const advanced = !giuLaiOKhoNhap && wouldBeIdx > curPointerIdx/.test(khoiChuyen),
    'giu lai thi KHONG tien con tro');
  kiem(/\} else if \(giuLaiOKhoNhap\) \{[\s\S]{0,400}finalStageId = stage\.StageID;/.test(khoiChuyen),
    'con tro tro vao CHINH cong doan Kho nhap (khong giu con tro cu — giu cu la don khong hien o Kho nhap)');
  kiem(/finalTrangThai = 'Đang sản xuất';/.test(khoiChuyen.slice(khoiChuyen.indexOf('} else if (giuLaiOKhoNhap)'))),
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

  console.log(`\n================ KET QUA: ${dat} dat / ${truot} sai ================`);
  process.exit(truot ? 1 : 0);
})().catch(err => { console.error('LOI KIEM CHUNG: ' + err.stack); process.exit(1); });
