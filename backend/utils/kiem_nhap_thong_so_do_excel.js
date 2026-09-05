/* ================================================================================================
   KIEM CHUNG v7.64 — TAI FILE EXCEL THONG SO KY THUAT VAO FORM "Them thong so do"
   ------------------------------------------------------------------------------------------------
   Yeu cau: cot `Measure` -> cot THONG SO; cac cot con lai -> cac size; SO DONG va SO COT SIZE
   linh dong theo file.

   ⚠️ CAI DE SAI NHAT la GAN CUNG VI TRI O. File that cua khach:
       · dong tieu de o DONG 3 (khong phai dong 1)
       · co mot cot STT o TRUOC cot Measure
   Nen bo doc phai DO ra dong tieu de va cot thong so, khong duoc dem cung "dong 1, cot B".
   Test nay TAO FILE EXCEL THAT (exceljs) cho 7 canh roi CHAY THAT bo doc.

   Chay:  node utils/kiem_nhap_thong_so_do_excel.js
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

const sUtil = doc('utils/docThongSoDoExcel.js');
const sRoute = doc('routes/tailieukythuat.js');
const sFe = doc('../frontend/js/module.tailieukythuat.js');
const sIndex = doc('../frontend/index.html');

let ExcelJS = null;
try { ExcelJS = require('exceljs'); } catch (e) { /* sandbox khong co */ }
const { docThongSoDoExcel } = require('./docThongSoDoExcel');

/* Dung mot file .xlsx that trong bo nho tu mang 2 chieu (null = o trong). */
async function taoFile(luoi, tenSheet) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(tenSheet || 'Sheet1');
  luoi.forEach((hang, i) => {
    const r = ws.getRow(i + 1);
    (hang || []).forEach((v, j) => { if (v !== null && v !== undefined) r.getCell(j + 1).value = v; });
    r.commit();
  });
  return await wb.xlsx.writeBuffer();
}

(async () => {
  console.log('\n=== 1. CHAY THAT bo doc tren cac canh ===');
  if (!ExcelJS) {
    console.log('  (bo qua: sandbox chua cai exceljs — cac muc doc file khong chay duoc)');
  } else {
    /* --- a) DUNG BO CUC FILE KHACH GUI: tieu de o dong 3, co cot STT o truoc --- */
    let buf = await taoFile([
      [], [],
      [null, 'Measure', 'SIZE 4', 'SIZE 6', 'SIZE 8'],
      [1, 'DAI AO', 39.45, 41.87, 46.27],
      [2, 'RONG NGUC', 32.76, 36.02, 38.62],
      [3, 'CAO BO CO', 1.57, 1.57, 1.57]
    ]);
    let kq = await docThongSoDoExcel(buf);
    bang(kq.dongTieuDe, 3, 'DO ra dong tieu de o dong 3 (khong gan cung dong 1)');
    bang(kq.cols.map(c => c.tenCot), ['SIZE 4', 'SIZE 6', 'SIZE 8'], 'lay dung 3 cot size');
    bang(kq.rows.length, 3, 'lay dung 3 dong thong so');
    bang(kq.rows[0], { tenDong: 'DAI AO', viTriDo: '', dungSai: '', values: ['39.45', '41.87', '46.27'] },
      'dong dau dung ca ten lan gia tri (cot STT bi bo qua)');
    bang(kq.rows[2].values, ['1.57', '1.57', '1.57'], 'so lap lai van doc dung');

    /* --- b) SO COT SIZE KHAC (linh dong) --- */
    buf = await taoFile([
      ['Measure', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL'],
      ['DAI AO', 60, 62, 64, 66, 68, 70, 72]
    ]);
    kq = await docThongSoDoExcel(buf);
    bang(kq.cols.length, 7, '7 cot size -> lay du 7 (khong cat bot)');
    bang(kq.rows[0].values.length, 7, 'so o gia tri khop so cot');
    bang(kq.dongTieuDe, 1, 'tieu de o dong 1 cung doc duoc');

    /* --- c) TEN COT THONG SO KIEU TIENG VIET --- */
    for (const ten of ['THÔNG SỐ', 'Thong so', 'Chi tiết đo', 'POM']) {
      buf = await taoFile([[ten, '80', '90'], ['Dài áo', 10, 11]]);
      kq = await docThongSoDoExcel(buf);
      bang([kq.rows.length, kq.cols.length], [1, 2], `nhan cot thong so ten "${ten}"`);
    }

    /* --- d) CO THEM cot "Vi tri do" va "Dung sai" -> vao DUNG o cua form, khong bi coi la size --- */
    buf = await taoFile([
      ['Measure', 'Vị trí đo', '80', '90', 'Dung sai'],
      ['Dài áo', 'Đo từ cạnh cổ đến gấu', 39, 41, '±1']
    ]);
    kq = await docThongSoDoExcel(buf);
    bang(kq.cols.map(c => c.tenCot), ['80', '90'],
      'cot "Vi tri do" va "Dung sai" KHONG bi coi la size');
    bang([kq.rows[0].viTriDo, kq.rows[0].dungSai], ['Đo từ cạnh cổ đến gấu', '±1'],
      'hai cot do vao dung o cua form (khoi go lai)');

    /* --- e) DONG TRONG XEN GIUA: bo qua, khong cat ngang bang --- */
    buf = await taoFile([
      ['Measure', '80', '90'],
      ['Dài áo', 39, 41],
      [],
      ['Rộng ngực', 32, 36]
    ]);
    kq = await docThongSoDoExcel(buf);
    bang(kq.rows.map(r => r.tenDong), ['Dài áo', 'Rộng ngực'],
      'dong trong xen giua khong lam mat cac dong ben duoi');

    /* --- f) SHEET DAU KHONG CO BANG -> tu sang sheet sau --- */
    const wb = new ExcelJS.Workbook();
    const ws1 = wb.addWorksheet('Huong dan');
    ws1.getCell('A1').value = 'File nay dung de khai thong so';
    const ws2 = wb.addWorksheet('Data');
    ws2.getRow(1).values = [null, 'Measure', '80', '90'];
    ws2.getRow(2).values = [1, 'Dài áo', 39, 41];
    kq = await docThongSoDoExcel(await wb.xlsx.writeBuffer());
    bang([kq.tenSheet, kq.rows.length], ['Data', 1], 'sheet dau khong co bang -> tu doc sheet sau');

    /* --- g) FILE KHONG CO BANG -> NEM LOI NOI RO, khong tra luoi rong am tham --- */
    let loi = null;
    try { await docThongSoDoExcel(await taoFile([['Ten', 'Gia'], ['abc', 1]])); }
    catch (e) { loi = e.message; }
    kiem(!!loi && /measure/i.test(loi) && /sheet/i.test(loi),
      'file khong co bang -> nem loi NOI RO can o ten gi va da do sheet nao', String(loi));

    /* --- h) FILE THAT cua khach (neu con trong thu muc uploads) --- */
    const duongThat = '/sessions/friendly-relaxed-ramanujan/mnt/uploads/thong so ky thuat.xlsx';
    if (fs.existsSync(duongThat)) {
      kq = await docThongSoDoExcel(fs.readFileSync(duongThat));
      bang([kq.dongTieuDe, kq.cols.length, kq.rows.length], [3, 6, 10],
        'FILE THAT khach gui: tieu de dong 3, 6 size, 10 dong thong so');
      bang(kq.cols.map(c => c.tenCot),
        ['SIZE 4', 'SIZE 6', 'SIZE 8', 'SIZE 10', 'SIZE 12', 'SIZE 14'], 'FILE THAT: dung ten 6 size');
      bang(kq.rows[0], { tenDong: 'DAI AO', viTriDo: '', dungSai: '', values: ['39.45', '41.87', '46.27', '50.17', '53.07', '55.97'] },
        'FILE THAT: dong DAI AO dung tung o');
      bang(kq.rows[9].tenDong, 'DUNG SAU', 'FILE THAT: doc den dong cuoi cung');
    } else {
      console.log('  (bo qua muc file that: khong con file trong thu muc uploads)');
    }
  }

  console.log('\n=== 2. Bo doc: khong gan cung vi tri o ===');
  kiem(/for \(let r = 1; r <= Math\.min\(soDong, 30\) && !dongTieuDe; r\+\+\)/.test(sUtil),
    'DO dong tieu de trong 30 dong dau, khong gan cung dong 1');
  kiem(/for \(let c = cotThongSo \+ 1; c <= soCot; c\+\+\)/.test(sUtil),
    'cot size lay TU BEN PHAI cot thong so, khong gan cung cot B');
  kiem(/TEN_THONG_SO = \[/.test(sUtil) && /'measure'/.test(sUtil) && /'thong so'/.test(sUtil),
    'nhan nhieu ten cot thong so (Measure / Thong so / ...)');
  kiem(/normalize\('NFD'\)/.test(sUtil), 'so ten cot khong phu thuoc dau tieng Viet / hoa thuong');
  kiem(/if \(!ten\) continue;/.test(sUtil), 'dong khong co ten thong so thi bo qua (khong cat ngang bang)');
  kiem(/err\.khongDoRa = true/.test(sUtil) || /throw err/.test(sUtil),
    'khong do ra bang -> NEM LOI, khong tra luoi rong am tham');
  kiem(/typeof v === 'number'/.test(sUtil) && /richText/.test(sUtil) && /v\.result/.test(sUtil),
    'doc duoc o kieu so, cong thuc, va chu co dinh dang');

  console.log('\n=== 3. Route ===');
  kiem(/router\.post\('\/thongsodo\/doc-excel'/.test(sRoute), 'co route doc-excel');
  const viTriDocExcel = sRoute.indexOf("router.post('/thongsodo/doc-excel'");
  const viTriMaDH = sRoute.indexOf("router.post('/thongsodo/:maDH'");
  kiem(viTriDocExcel > 0 && viTriDocExcel < viTriMaDH,
    'route CHU (doc-excel) dat TRUOC route :maDH — dat sau la bi nuot (bai hoc v5.60)');
  /* ⚠️ Phai CAT TRUOC roi moi bo chu thich: bo chu thich lam doi do dai chuoi nen cac chi so
     viTri* tinh tren ban GOC se tro sai cho o ban da bo. */
  kiem(!/INSERT INTO|UPDATE |DELETE FROM/.test(bo(sRoute.slice(viTriDocExcel, viTriMaDH))),
    'route doc-excel CHI DOC file, khong ghi gi vao CSDL');
  kiem(/memoryStorage\(\)/.test(sRoute), 'nhan file vao bo nho, khong ghi rac ra o dia');
  kiem(/\.xls\$\/i\.test\(ten\)/.test(sRoute) && /Save As/.test(sRoute),
    'file .xls (Excel 97-2003) -> bao ro cach xu ly thay vi de thu vien nem cau kho hieu');
  kiem(/requirePermission\('QLSX', 'edit'\)/.test(sRoute.slice(viTriDocExcel, viTriDocExcel + 200)),
    'doi quyen sua QLSX');
  kiem(/LIMIT_FILE_SIZE/.test(sRoute), 'file qua lon -> bao tieng Viet');

  console.log('\n=== 4. Form ===');
  kiem(/id="btnTsdNhapExcel"/.test(sFe) && /id="fileTsdExcel"/.test(sFe), 'co nut + o chon file');
  kiem(/accept="\.xlsx,\.xlsm"/.test(sFe), 'chi cho chon dinh dang doc duoc');
  kiem(/dangCoDuLieu && !confirm\('Lưới đang có dữ liệu/.test(sFe),
    'luoi dang co du lieu -> HOI truoc khi thay (nguoi dung co the da go tay mot nua)');
  kiem(/values: state\.cols\.map\(\(c, i\) =>/.test(sFe),
    'ep so o gia tri = so cot -> file thieu o cuoi khong lam LECH COT luoi');
  kiem(/oFile\.value = ''/.test(sFe),
    'xoa gia tri o file truoc khi mo -> chon LAI DUNG file vua roi van chay (su kien change van ban)');
  kiem(/catch \(err\) \{\s*toast\('Không đọc được file/.test(sFe), 'loi doc file -> bao toast, khong vo form');
  kiem(/btnExcel\.disabled = false; btnExcel\.textContent = nhanCu;/.test(sFe),
    'doc xong (ke ca loi) deu tra nut ve binh thuong — khong ket nut');
  kiem(/Kiểm tra lại rồi bấm Lưu/.test(sFe),
    'nhac ro: doc xong VAN PHAI bam Luu (backend chua ghi gi)');

  console.log('\n=== 5. Bump ?v= ===');
  const v = (sIndex.match(/module\.tailieukythuat\.js\?v=([\d.]+)/) || [])[1];
  kiem(v && parseFloat(v) >= 7.64, 'index.html: module.tailieukythuat.js?v= >= 7.64', String(v));

  console.log('\n================================================================');
  console.log(`KET QUA: ${dat} dat / ${truot} truot`);
  process.exit(truot ? 1 : 0);
})();
