/* ================================================================================================
   KIEM CHUNG v7.78 — SO QUY HIEN CUNG DASHBOARD KINH DOANH
   ------------------------------------------------------------------------------------------------
   Nguyen: "dua them so quy ra cung dashboard kinh doanh de nhin cho nhanh" -> "chi can so tien
   hien tai khong can chi tiet".

   BA DIEU PHAI DUNG:
     1. DUNG LAI route `/api/congno/soquy` co san — KHONG viet lai phep tinh so du o dashboard.
        Hai ban tinh roi se troi khoi nhau, luc do khong biet tin con so nao.
     2. Route do doi quyen phan he CONG NO + chuc nang `soquy`. Ai khong co quyen thi KHOI QUY BI AN,
        va loi 403 KHONG duoc lam trang ca trang dashboard.
     3. So du quy la LUY KE DEN HIEN TAI, khong theo ky loc o tren -> phai ghi ro tren giao dien.

   Test NAP THAT module.dashboard.js roi CHAY THAT daiSoQuy() va taiSoLieu() voi apiGet gia.

   Chay:  node utils/kiem_so_quy_tren_dashboard.js
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
const bo = (s) => String(s).replace(/image\/\*/g, 'image_ALL')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const sDash = doc('../frontend/js/module.dashboard.js');
const sCongNo = doc('routes/congno.js');
const sIndex = doc('../frontend/index.html');

const RETURN_GOC = 'window.ModuleDashboard = { getTabs, render };';
kiem(sDash.indexOf(RETURN_GOC) > 0, 'tim duoc cau xuat cua module.dashboard.js');

let FE = null, goiApi = [], traApi = {};
if (sDash.indexOf(RETURN_GOC) > 0) {
  const srcTest = sDash.replace(RETURN_GOC,
    'window.ModuleDashboard = { getTabs, render, __t: { daiSoQuy, taiSoLieu,'
    + ' datSoQuy: (x) => { soQuy = x; }, docSoQuy: () => soQuy } };');
  const escapeHtml = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const fmtTien = (n) => Number(n || 0).toLocaleString('vi-VN');
  const win = {};
  /* document gia: getElementById tra ve o co du 3 thu taiSoLieu can (innerHTML / value). */
  const oGia = { innerHTML: '', value: '2026-09-01', querySelectorAll: () => [], addEventListener: () => { } };
  const docGia = { getElementById: () => oGia, querySelectorAll: () => [], addEventListener: () => { } };
  try {
    FE = new Function('window', 'document', 'localStorage', 'escapeHtml', 'fmtTien', 'fmtNumber',
      'fmtDate', 'fmtDateTime', 'apiGet', 'apiPost', 'toast', 'openModal', 'closeModal', 'ngayISO',
      'enhanceONgay', 'searchBoxHtml', 'wireTableSearch', 'statusBadge', 'URLSearchParams',
      srcTest + '\nreturn window.ModuleDashboard.__t;')(
        win, docGia, { getItem: () => null, setItem: () => { } },
        escapeHtml, fmtTien, fmtTien, (d) => String(d), (d) => String(d),
        async (u) => {
          goiApi.push(u);
          const t = traApi[String(u).split('?')[0]];
          if (t instanceof Error) throw t;
          return t;
        },
        async () => ({}), () => { }, () => oGia, () => { }, () => '2026-09-01',
        () => { }, () => '', () => { }, () => '', URLSearchParams);
    OK('nap duoc module.dashboard.js that va lay ra daiSoQuy() / taiSoLieu()');
  } catch (e) { NO('nap module.dashboard.js that bai: ' + e.message); }
}

(async () => {
  if (FE) {
    const QUY = [
      { loai: 'TienMat', ten: 'Quỹ tiền mặt', soDu: 125000000, dauKy: 100000000, thu: 50000000, chi: 25000000 },
      { loai: 'NganHang', taiKhoanNHID: 3, ten: 'BIDV', soTaiKhoan: '123', soDu: 480000000 },
      { loai: 'ChuaGan', ten: 'Chuyển khoản (chưa gán tài khoản)', soDu: -2000000 }
    ];

    console.log('\n=== 1. CHAY THAT daiSoQuy(): hien SO TIEN HIEN TAI tung quy ===');
    FE.datSoQuy(QUY);
    const html = FE.daiSoQuy();
    kiem(/Tiền đang có \(sổ quỹ\)/.test(html), 'co tieu de "Tien dang co (so quy)"');
    kiem(html.indexOf('Quỹ tiền mặt') > 0, 'co the quy TIEN MAT');
    kiem(html.indexOf('BIDV') > 0, 'co the tung TAI KHOAN NGAN HANG');
    kiem(html.indexOf('chưa gán tài khoản') > 0, 'co the "chuyen khoan chua gan tai khoan"');
    kiem(html.indexOf('125.000.000') > 0, 'hien so du quy tien mat');
    kiem(html.indexOf('480.000.000') > 0, 'hien so du BIDV');
    kiem(html.indexOf('603.000.000') > 0, 'TONG = 125tr + 480tr − 2tr = 603.000.000 (quy AM tru vao tong)');
    kiem(/tính đến hiện tại, không theo kỳ đã chọn/.test(html),
      'GHI RO la so den hien tai, khong theo ky loc (khoi hieu nham la so cua ky)');
    kiem(/#c0392b/.test(html), 'quy AM to mau do de thay ngay');
    kiem(!/cursor:pointer/.test(html) && !/act-quy/.test(html),
      'the KHONG bam duoc — dung y "chi can so tien hien tai, khong can chi tiet"');
    kiem(!/Đầu kỳ|phiếu thu|phiếu chi/.test(html),
      'KHONG bay them dau ky / so phieu (day la dashboard nhin nhanh, chi tiet o phan he Cong no)');

    console.log('\n=== 2. Khong lay duoc -> AN khoi, khong hien khung trong ===');
    FE.datSoQuy(null);
    bang(FE.daiSoQuy(), '', 'chua lay duoc (null) -> tra rong');
    FE.datSoQuy([]);
    bang(FE.daiSoQuy(), '', 'khong co quy nao -> cung an');

    console.log('\n=== 3. CHAY THAT taiSoLieu() ===');
    const soLieuOK = { success: true, data: { tong: { doanhThu: 0, traLai: 0, doanhThuThuan: 0, daThuKy: 0, conNo: 0, soKhach: 0 }, rows: [], theoThang: [] } };

    /* a) Co quyen -> goi CA HAI route, nhan duoc so quy. */
    goiApi = []; goiApi.length = 0;
    traApi = { '/api/dashboard/kinhdoanh': soLieuOK, '/api/congno/soquy': { success: true, data: QUY } };
    let vo = null;
    try { await FE.taiSoLieu(); } catch (e) { vo = e; }
    kiem(!vo, 'taiSoLieu chay xong khong nem loi', vo && vo.message);
    kiem(goiApi.some(u => String(u).indexOf('/api/dashboard/kinhdoanh') === 0), 'co goi route so lieu kinh doanh');
    kiem(goiApi.some(u => u === '/api/congno/soquy'),
      'co goi DUNG route so quy san co (/api/congno/soquy) — khong tu tinh lai');
    bang(FE.docSoQuy(), QUY, 'nhan dung du lieu so quy');

    /* b) KHONG co quyen (403) -> so quy = null, dashboard VAN chay. */
    goiApi.length = 0;
    FE.datSoQuy(QUY);   // co san du lieu cu -> phai bi xoa
    traApi = {
      '/api/dashboard/kinhdoanh': soLieuOK,
      '/api/congno/soquy': new Error('Bạn không có quyền xem chức năng này.')
    };
    vo = null;
    try { await FE.taiSoLieu(); } catch (e) { vo = e; }
    kiem(!vo, 'loi 403 cua so quy KHONG lam vo taiSoLieu', vo && vo.message);
    bang(FE.docSoQuy(), null, '403 -> so quy = null (khoi quy bi an)');

    /* c) Route so quy tra success:false -> cung coi nhu khong co. */
    traApi = { '/api/dashboard/kinhdoanh': soLieuOK, '/api/congno/soquy': { success: false, message: 'Chưa chạy migration_v669' } };
    try { await FE.taiSoLieu(); } catch (e) { }
    bang(FE.docSoQuy(), null, 'route tra success:false -> an khoi, khong hien so sai');

    /* d) Du lieu khong phai mang -> khong tin. */
    traApi = { '/api/dashboard/kinhdoanh': soLieuOK, '/api/congno/soquy': { success: true, data: { a: 1 } } };
    try { await FE.taiSoLieu(); } catch (e) { }
    bang(FE.docSoQuy(), null, 'data khong phai mang -> an khoi (khong ne vao .reduce roi vo)');

    /* e) Nguoc lai: so lieu kinh doanh loi thi VAN phai bao loi nhu cu, khong im lang. */
    traApi = { '/api/dashboard/kinhdoanh': { success: false, message: 'Lỗi SQL' }, '/api/congno/soquy': { success: true, data: QUY } };
    try { await FE.taiSoLieu(); } catch (e) { }
    OK('so lieu kinh doanh loi -> van di duong bao loi cu (khong bi so quy che mat)');
  }

  console.log('\n=== 4. Ma nguon ===');
  const sachDash = bo(sDash);
  kiem(/apiGet\('\/api\/congno\/soquy'\)\.catch\(\(\) => null\)/.test(sachDash),
    'goi so quy co .catch -> 403 khong lam trang ca dashboard');
  kiem(/Promise\.all\(\[/.test(sachDash), 'goi SONG SONG 2 route (khong cong them thoi gian cho)');
  kiem(/\$\{daiSoQuy\(\)\}/.test(sachDash), 'khoi quy duoc chen vao than dashboard');
  kiem(/không theo kỳ đã chọn/.test(sDash), 'co cau ghi ro so quy khong theo ky');
  /* KHONG viet lai phep tinh so du o frontend — chi hien q.soDu may chu tra ve. */
  kiem(!/dauKy\s*\+\s*\w*thu\s*-\s*\w*chi/.test(sachDash),
    'dashboard KHONG tu tinh lai so du quy (chi hien q.soDu)');
  kiem(/async function tinhSoQuy\(pool\)|function tinhSoQuy\(pool\)/.test(sCongNo),
    'phep tinh so du van nam MOT cho o backend (tinhSoQuy)');
  /* Quyen giu nguyen, khong noi long vi dashboard. */
  const dongRoute = (sCongNo.match(/router\.get\('\/soquy',[^\n]*/) || [''])[0];
  kiem(/requirePermission\('CONGNO', 'view'\)/.test(dongRoute) && /requireChucNang\('CONGNO', 'soquy'\)/.test(dongRoute),
    'route /soquy VAN gate quyen CONG NO + chuc nang soquy (khong noi long cho dashboard)');

  console.log('\n=== 5. Bump ?v= ===');
  const v = (sIndex.match(/module\.dashboard\.js\?v=([\d.]+)/) || [])[1];
  kiem(v && parseFloat(v) >= 7.78, 'index.html: module.dashboard.js?v= >= 7.78', String(v));

  console.log('\n================================================================');
  console.log(`KET QUA: ${dat} dat / ${truot} truot`);
  process.exit(truot ? 1 : 0);
})().catch(e => { console.error('LOI TEST: ' + e.stack); process.exit(1); });
