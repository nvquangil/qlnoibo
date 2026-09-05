/* ================================================================================================
   KIEM CHUNG v7.67 — ANH SAN PHAM + MA RAP TREN **MOI** BAN IN CUA "Tai lieu may / dong goi"
   ------------------------------------------------------------------------------------------------
   Hai lan truoc toi bao "da them anh" ma Nguyen in ra van trang. Nen test nay KHONG chi grep chuoi:
   no NAP THAT file module.tailieukythuat.js, LAY THAT cac ham dung ban in ra, CHAY THAT voi du lieu
   gia, roi DEM so the <img> trong ket qua. Ban in nao khong co anh la truot ngay.

   Kiem 6 nhom:
     1. Chay that 7 bo dung ban in -> BAN NAO CUNG phai co <img> anh san pham.
     2. Chay that ham ma rap (pool gia): phai GOP ca DonHangChiTietSoDo LAN TienDoSanXuat.
     3. Khong con ban sao "chi doc 1 nguon" nao trong repo (tailieukythuat.js / bangke.js).
     4. Moi route GET tra `order` cua module deu tra kem `anhMacDinh`.
     5. printHtml CHO ANH TAI XONG roi moi do trang va in.
     6. Nhan cot "Ma hang" da doi thanh "Ma rap"; ?v= da bump.

   Chay:  node utils/kiem_anh_va_marap_ban_in.js
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
/* `accept="image/*"` chua "/*" -> vo hieu truoc khi bo chu thich, keo nuot mat doan sau. */
const bo = (s) => String(s).replace(/image\/\*/g, 'image_ALL')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const sTlkt = doc('../frontend/js/module.tailieukythuat.js');
const sBtp = doc('../frontend/js/module.bangkebtp.js');
const sCommon = doc('../frontend/js/common.js');
const sRoute = doc('routes/tailieukythuat.js');
const sBangKe = doc('routes/bangke.js');
const sQlsx = doc('routes/qlsx.js');
const sIndex = doc('../frontend/index.html');

const ANH = '/uploads/sp_test.jpg';

/* ================================================================================================
   1. NAP THAT module frontend roi CHAY THAT cac ham dung ban in.
   Cach lay ham ra: noi them cac ham can test vao object `return` cuoi IIFE — KHONG cat/dan lai code,
   nen thu duoc DUNG ham dang chay tren trinh duyet.
   ================================================================================================ */
console.log('\n=== 1. CHAY THAT cac ham dung ban in — ban nao cung phai co anh san pham ===');

const RETURN_GOC = 'return { render, openChiDinhNPL, printOrderDocs };';
kiem(sTlkt.indexOf(RETURN_GOC) >= 0, 'tim thay cau return cua IIFE de gan moc test');

let B = null;
if (sTlkt.indexOf(RETURN_GOC) >= 0) {
  const srcTest = sTlkt.replace(RETURN_GOC, `return { render, openChiDinhNPL, printOrderDocs, __t: {
    khoiDauPhieuHtml, docInfoRowsHtml, buildTaiLieuChungBodyHtml, buildThongSoDoBodyHtml,
    buildThongKeChiTietBodyHtml, buildMoTaSanPhamBodyHtml, buildChiDinhNplBodyHtml, donGiaHeaderHtml
  } };`);
  const win = {};
  const escapeHtml = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const fmtDate = (d) => (d ? String(d).slice(0, 10) : '');
  const fmtNumber = (n) => String(n == null || n === '' ? '' : n);
  try {
    B = new Function('window', 'escapeHtml', 'fmtDate', 'fmtNumber',
      srcTest + '\nreturn window.ModuleTaiLieuKyThuat.__t;')(win, escapeHtml, fmtDate, fmtNumber);
    OK('nap duoc module that va lay ra 8 ham dung ban in');
  } catch (e) { NO('nap module that that bai: ' + e.message); }
}

function demAnh(html, src) {
  return (String(html).match(new RegExp('<img[^>]+src="' + src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"', 'g')) || []).length;
}

if (B) {
  const chung = { maHang: '', maRap: 'RAP-77', tenSanPham: 'Áo thun', ngayCapNhat: '2026-09-05', nguoiLap: 'Nguyen', anhIn: ANH };

  /* Moi phan tu: [ten ban in, html dung ra] */
  const banIn = [
    ['Tài liệu kỹ thuật chung', B.buildTaiLieuChungBodyHtml({ ...chung, muc: [{ tieuDe: 'Mục 1', dong: [{ noiDung: 'abc' }] }] })],
    ['Thông số kỹ thuật', B.buildThongSoDoBodyHtml({ ...chung, cols: [{ tenCot: 'S' }], rows: [{ tenDong: 'Dài áo', values: ['60'] }] })],
    ['Thống kê chi tiết', B.buildThongKeChiTietBodyHtml({ ...chung, ten: 'Áo', rows: [{ pieceName: 'Thân trước' }], order: { MaRap: 'RAP-77', TenSanPham: 'Áo thun' } })],
    ['Mô tả đường may', B.buildMoTaSanPhamBodyHtml({ ...chung, oGrid: [{ dong: 0, cot: 0, anhUrl: '/uploads/x.png', chuThich: 'a' }] }, 'MÔ TẢ ĐƯỜNG MAY')],
    ['Quy cách đóng gói', B.buildMoTaSanPhamBodyHtml({ ...chung, oGrid: [] }, 'QUY CÁCH ĐÓNG GÓI')],
    ['Hình ảnh in/thêu', B.buildMoTaSanPhamBodyHtml({ ...chung, oGrid: [] }, 'HÌNH ẢNH MÔ TẢ IN/THÊU')],
    ['Chỉ định NPL', B.buildChiDinhNplBodyHtml([{ MaPhuKien: 'PK1', TenPhuKien: 'Cúc', SoLuong: 10 }], 'DH2609001', { AnhSanPham: ANH, MaRap: 'RAP-77', TenSanPham: 'Áo thun' })],
    ['Đơn giá (4 loại)', B.donGiaHeaderHtml('ĐƠN GIÁ CÔNG ĐOẠN MAY', 'DH2609001', { TenSanPham: 'Áo thun', MaRap: 'RAP-77' }, 'Áo', ANH)]
  ];
  banIn.forEach(([ten, html]) => {
    kiem(demAnh(html, ANH) === 1, `${ten}: CO dung 1 anh san pham tren ban in`,
      'dem duoc ' + demAnh(html, ANH) + ' anh');
  });

  console.log('\n--- 1b. Ma rap phai hien tren ban in (day la thu Nguyen bao "khong hien") ---');
  banIn.forEach(([ten, html]) => {
    kiem(/Mã rập:/.test(html) && html.indexOf('RAP-77') >= 0, `${ten}: co dong "Ma rap:" va DUNG gia tri`);
  });
  banIn.forEach(([ten, html]) => {
    kiem(!/<b>Mã hàng:<\/b>/.test(html), `${ten}: KHONG con nhan "Ma hang" (da doi thanh Ma rap)`);
  });

  console.log('\n--- 1c. Thong ke chi tiet: ma rap lay bu tu lenh SX khi o nhap de trong ---');
  const tkctTrong = B.buildThongKeChiTietBodyHtml({ maHang: '', rows: [{ pieceName: 'A' }], order: { MaRap: 'RAP-99' }, anhIn: ANH });
  kiem(tkctTrong.indexOf('RAP-99') >= 0,
    'o Ma rap de trong -> ban in van hien ma rap cua lenh SX (khong con trang tron)');
  const tkctGoTay = B.buildThongKeChiTietBodyHtml({ maHang: 'TAY-01', rows: [{ pieceName: 'A' }], order: { MaRap: 'RAP-99' }, anhIn: ANH });
  kiem(tkctGoTay.indexOf('TAY-01') >= 0 && tkctGoTay.indexOf('RAP-99') < 0,
    'go tay thi UU TIEN cai go tay, khong de lenh SX de len');

  console.log('\n--- 1d. Khong co anh thi KHONG de lai o trong lech bo cuc ---');
  const khongAnh = B.buildThongSoDoBodyHtml({ ...chung, anhIn: '', cols: [], rows: [] });
  kiem(!/<img/.test(khongAnh), 'khong co anh -> khong sinh the <img> rong');
  kiem(/<table>/.test(khongAnh) && !/display:flex/.test(khongAnh.split('<table>')[0].slice(-200)),
    'khong co anh -> khoi thong tin chiem het be ngang nhu cu');

  console.log('\n--- 1e. khoiDauPhieuHtml: hop dong dung ---');
  bang(B.khoiDauPhieuHtml('', '<i>X</i>'), '<i>X</i>', 'anh rong -> tra nguyen noi dung');
  bang(B.khoiDauPhieuHtml('   ', '<i>X</i>'), '<i>X</i>', 'anh chi co khoang trang -> coi nhu rong');
  kiem(demAnh(B.khoiDauPhieuHtml(ANH, '<i>X</i>'), ANH) === 1 && /<i>X<\/i>/.test(B.khoiDauPhieuHtml(ANH, '<i>X</i>')),
    'co anh -> vua co anh vua giu nguyen noi dung');
}

/* ================================================================================================
   2. CHAY THAT ham ma rap voi POOL GIA — day la loi goc: chi doc 1 nguon.
   ================================================================================================ */
console.log('\n=== 2. CHAY THAT util ma rap (pool gia) ===');
const { maRapCuaDon, maRapTheoDon } = require('./maRapCuaDon');
const sqlGia = { Int: 'Int', NVarChar: 'NVarChar' };

function poolGia(traVe, ghiCau) {
  return {
    request() {
      const r = { input() { return r; }, query(q) { if (ghiCau) ghiCau.push(q); return Promise.resolve({ recordset: traVe }); } };
      return r;
    }
  };
}

(async () => {
  const cau = [];
  /* Mot ma khai o bang So do, mot ma khai luc GHI TIEN DO -> phai ra ca hai. */
  let kq = await maRapCuaDon(poolGia([{ MaRap: 'RAP-A' }, { MaRap: 'RAP-B' }], cau), sqlGia, 7);
  bang(kq, 'RAP-A, RAP-B', 'gop nhieu ma rap thanh 1 chuoi');
  kiem(/DonHangChiTietSoDo/.test(cau[0]) && /TienDoSanXuat/.test(cau[0]),
    'cau SQL doc CA HAI nguon (So do + Ghi tien do)', cau[0].replace(/\s+/g, ' ').slice(0, 120));
  kiem(/UNION ALL/.test(cau[0]), 'gop bang UNION ALL roi DISTINCT (khong loc mat ma trung ten khac don)');

  bang(await maRapCuaDon(poolGia([], []), sqlGia, 7), '', 'khong co ma nao -> chuoi rong');
  bang(await maRapCuaDon(poolGia([], []), sqlGia, null), '', 'khong co donHangId -> chuoi rong, khong hoi CSDL');

  /* Loi CSDL (vd thieu bang TienDoSanXuat o ban cai cu) KHONG duoc lam gay ca route. */
  const poolLoi = { request() { return { input() { return this; }, query() { return Promise.reject(new Error('Invalid object name')); } }; } };
  bang(await maRapCuaDon(poolLoi, sqlGia, 7), '', 'loi SQL -> tra rong, KHONG nem loi ra route');

  /* Ban gop theo lo cho man hinh danh sach. */
  const map = await maRapTheoDon(poolGia([
    { DonHangID: 1, MaRap: 'R1' }, { DonHangID: 1, MaRap: 'R2' }, { DonHangID: 1, MaRap: 'R1' }, { DonHangID: 2, MaRap: 'R9' }
  ], []));
  bang(map, { 1: 'R1, R2', 2: 'R9' }, 'ban theo lo: gom theo don va BO TRUNG');
  bang(await maRapTheoDon(poolLoi), {}, 'ban theo lo: loi SQL -> map rong, danh sach van chay');

  /* ============================================================================================
     3. KHONG con ban sao "chi doc 1 nguon" nao.
     ============================================================================================ */
  console.log('\n=== 3. Khong con ban sao chi doc 1 nguon ===');
  /* ⚠️ PHAI SOI THEO CA CAU SQL, khong soi theo doan khop cua regex.
     Lan dau toi viet /SELECT[^;`]*MaRap[^;`]*FROM DonHangChiTietSoDo/ roi loc `!TienDoSanXuat` tren
     DOAN KHOP — bao SAI oan, vi doan khop dung ngay tai "FROM DonHangChiTietSoDo" nen khong the chua
     UNION ALL nam SAU do. Nay tach nguyen cac khoi template literal (cau SQL) ra ma soi. */
  const cacCauSql = (src) => {
    const phan = String(src).split('`');
    return phan.filter((_, i) => i % 2 === 1);   // vi tri le = ben trong dau `
  };
  [['routes/tailieukythuat.js', sRoute], ['routes/bangke.js', sBangKe], ['routes/qlsx.js', sQlsx]].forEach(([ten, src]) => {
    const nghi = cacCauSql(bo(src))
      /* Chi soi cau ĐỌC. INSERT/UPDATE/DELETE vao bang So do la dung — do la cho KHAI ma rap. */
      .filter(q => !/^\s*(INSERT|UPDATE|DELETE)\b/i.test(q.trim()))
      .filter(q => /MaRap/.test(q) && /DonHangChiTietSoDo/.test(q) && !/TienDoSanXuat/.test(q));
    kiem(nghi.length === 0, `${ten}: khong con cau SQL ma rap chi doc bang So do`,
      nghi.map(x => x.replace(/\s+/g, ' ').slice(0, 110)).join(' | '));
  });
  /* Va chinh util phai doc 2 nguon — keo "khong con ban sao" thanh dung mot cach vo nghia. */
  kiem(cacCauSql(doc('utils/maRapCuaDon.js')).filter(q => /DonHangChiTietSoDo/.test(q) && /TienDoSanXuat/.test(q)).length === 2,
    'utils/maRapCuaDon.js: ca 2 cau (mot don + theo lo) deu doc 2 nguon');
  [['routes/tailieukythuat.js', sRoute], ['routes/bangke.js', sBangKe], ['routes/qlsx.js', sQlsx]].forEach(([ten, src]) => {
    kiem(/require\(['"]\.\.\/utils\/maRapCuaDon['"]\)/.test(src), `${ten}: dung util ma rap dung chung`);
  });

  /* ============================================================================================
     4. Moi route GET tra `order` phai tra kem `anhMacDinh`.
     Doc THEO TUNG res.json(...) nen khong the "co anhMacDinh o cho khac trong file" ma van dat.
     ============================================================================================ */
  console.log('\n=== 4. Route GET nao tra `order` cung tra `anhMacDinh` ===');
  const sachRoute = bo(sRoute);
  const cacJson = sachRoute.match(/res\.json\(\{[^;]*?\}\);/g) || [];
  const traOrder = cacJson.filter(j => /(^|[\s{,])order[,:}\s]/.test(j));
  kiem(traOrder.length >= 14, 'tim thay du cac cau res.json tra `order`', 'dem duoc ' + traOrder.length);
  const thieu = traOrder.filter(j => !/anhMacDinh/.test(j));
  kiem(thieu.length === 0, 'KHONG cau res.json nao tra `order` ma quen `anhMacDinh`',
    thieu.map(x => x.replace(/\s+/g, ' ').slice(0, 100)).join(' || '));

  kiem(/async function orderChoBanIn\(pool, maDH\)/.test(sRoute),
    'co ham dung chung orderChoBanIn() de moi route lay dau phieu mot loi');
  kiem(/SELECT DonHangID, MaDH, MaSanPham, TenSanPham, AnhSanPham FROM DonHangSanXuat/.test(sRoute),
    'getOrderBasic lay LUON AnhSanPham cua lenh SX');
  kiem(/SELECT d\.DonHangID, d\.MaDH, d\.MaSanPham, d\.TenSanPham, d\.AnhSanPham,/.test(sRoute),
    'danh sach don (/orders) cung lay AnhSanPham — de ban in Chi dinh NPL co anh');

  /* ============================================================================================
     5. printHtml CHO ANH TAI XONG roi moi do trang va in.
     ============================================================================================ */
  console.log('\n=== 5. printHtml cho anh tai xong roi moi in ===');
  const sachCommon = bo(sCommon);
  kiem(/function choAnhTai\(win, xong\)/.test(sachCommon), 'co ham cho anh tai');
  kiem(/iframe\.onload = \(\) => \{\s*choAnhTai\(iframe\.contentWindow/.test(sachCommon),
    'onload GOI choAnhTai TRUOC, khong in thang nhu truoc');
  kiem(/chenSoTrang\(\)/.test(sachCommon.split('choAnhTai(iframe.contentWindow')[1] || ''),
    'do so trang nam BEN TRONG callback (do khi anh da co chieu cao that)');
  kiem(/addEventListener\('error', mot/.test(sachCommon), 'anh HONG cung goi tiep, khong treo lenh in');
  kiem(/setTimeout\(goi, 5000\)/.test(sachCommon), 'co tran thoi gian 5s -> khong bao gio treo vinh vien');
  kiem(/if \(daGoi\) return; daGoi = true;/.test(sachCommon), 'chi in DUNG MOT lan (chong goi hai lan)');

  /* CHAY THAT choAnhTai bang DOM gia. */
  const thanCho = (() => {
    const i = sCommon.indexOf('function choAnhTai(win, xong) {');
    if (i < 0) return null;
    let d = 0, j = sCommon.indexOf('{', i);
    for (let k = j; k < sCommon.length; k++) {
      if (sCommon[k] === '{') d++;
      else if (sCommon[k] === '}') { d--; if (!d) return sCommon.slice(i, k + 1); }
    }
    return null;
  })();
  kiem(!!thanCho, 'cat duoc than ham choAnhTai de chay that');
  if (thanCho) {
    const f = new Function(thanCho + '\nreturn choAnhTai;')();
    const anhGia = (complete) => {
      const h = {};
      return { complete, addEventListener(t, cb) { h[t] = cb; }, ban(t) { if (h[t]) h[t](); } };
    };
    /* a) Anh da tai xong het -> in NGAY. */
    let daIn = false;
    f({ document: { images: [anhGia(true), anhGia(true)] } }, () => { daIn = true; });
    kiem(daIn, 'anh da tai xong het -> in ngay, khong cho vo ich');
    /* b) Con anh dang tai -> CHUA in; tai xong het moi in. */
    daIn = false;
    const a1 = anhGia(false), a2 = anhGia(false);
    f({ document: { images: [a1, a2] } }, () => { daIn = true; });
    kiem(!daIn, 'con anh dang tai -> CHUA in (day la loi cu: in khi anh chua co)');
    a1.ban('load');
    kiem(!daIn, 'moi 1/2 anh xong -> van chua in');
    a2.ban('load');
    kiem(daIn, 'tai xong het -> in');
    /* c) Anh hong (error) van tinh la xong. */
    daIn = false;
    const a3 = anhGia(false);
    f({ document: { images: [a3] } }, () => { daIn = true; });
    a3.ban('error');
    kiem(daIn, 'anh hong -> van in phan con lai, khong treo');
    /* d) Khong co anh nao -> in ngay. */
    daIn = false;
    f({ document: { images: [] } }, () => { daIn = true; });
    kiem(daIn, 'phieu khong co anh -> in ngay nhu cu');
  }

  /* ============================================================================================
     6. Nhan form + bump ?v=
     ============================================================================================ */
  console.log('\n=== 6. Nhan o nhap lieu + bump ?v= ===');
  const sachTlkt = bo(sTlkt);
  kiem(/<label>Mã rập<\/label><input name="maHang"/.test(sachTlkt),
    'form tai lieu: o "Ma hang" da doi nhan thanh "Ma rap"');
  kiem((sachTlkt.match(/<label>Mã rập<\/label><input name="maHang"/g) || []).length === 2,
    'ca 2 form (tai lieu chung/thong so + thong ke chi tiet) deu doi nhan',
    String((sachTlkt.match(/<label>Mã rập<\/label><input name="maHang"/g) || []).length));
  kiem(!/<label>Mã hàng<\/label>/.test(sachTlkt), 'khong con nhan "Ma hang" nao trong module tai lieu');
  kiem(/value="\$\{escapeHtml\(\(data && data\.maHang\) \|\| \(order && order\.MaRap\)/.test(sachTlkt),
    'gia tri mac dinh cua o Ma rap lay TU LENH SX (khong con lay MaSanPham)');
  kiem(!/<b>Mã hàng:<\/b>/.test(bo(sBtp)), 'ban in Bang ke BTP cung doi "Ma hang" thanh "Ma rap"');

  [['common.js', 7.67], ['module.tailieukythuat.js', 7.67], ['module.bangkebtp.js', 7.67]].forEach(([f, min]) => {
    const v = (sIndex.match(new RegExp(f.replace(/\./g, '\\.') + '\\?v=([\\d.]+)')) || [])[1];
    kiem(v && parseFloat(v) >= min, `index.html: ${f}?v= >= ${min}`, String(v));
  });

  console.log('\n================================================================');
  console.log(`KET QUA: ${dat} dat / ${truot} truot`);
  process.exit(truot ? 1 : 0);
})().catch(e => { console.error('LOI TEST: ' + e.stack); process.exit(1); });
