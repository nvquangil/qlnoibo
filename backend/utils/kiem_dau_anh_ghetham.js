/* ================================================================================================
   KIEM CHUNG v7.73 — DAU THOI GIAN / DIA DIEM TREN ANH CHECK-IN GHE THAM SHOP (kieu TimeMark)
   ------------------------------------------------------------------------------------------------
   Nguyen: "di tuyen thi truong, phan chup anh khi ghe tham shop co thong tin dia diem thoi gian
   tren anh nhu khi chup timemark".
   Chot (v7.73): dia chi TRA THAT TU TOA DO GPS; dong len anh 4 nhom: ngay+gio, ten shop, dia chi,
   toa do + ten nhan vien.

   Test CHAY THAT:
     · bo tra dia chi (utils/diaChiTuToaDo.js) voi `fetch` GIA — du cac canh mang loi/HTTP loi/toa do
       xau, va kiem GHI DEM + GIAN CACH 1 luot/giay (rang buoc cua Nominatim, vi pham la chan IP);
     · ham dong dau anh o frontend — NAP THAT module.dms.js roi ve len CANVAS GIA, doc lai tung
       dong chu da ve. Khong grep chuoi.

   Chay:  TZ=Asia/Ho_Chi_Minh node utils/kiem_dau_anh_ghetham.js
   ================================================================================================ */
process.env.TZ = process.env.TZ || 'Asia/Ho_Chi_Minh';

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

const sDms = doc('routes/dms.js');
const sFe = doc('../frontend/js/module.dms.js');
const sIndex = doc('../frontend/index.html');

(async () => {
  /* ============================================================================================
     1. GHEP DIA CHI theo loi Viet Nam
     ============================================================================================ */
  console.log('\n=== 1. Ghep dia chi tu tra loi cua Nominatim ===');
  const { ghepDiaChi, khoaDem } = require('./diaChiTuToaDo');
  bang(ghepDiaChi({ house_number: '25', road: 'Phố Huế', quarter: 'Phường Ngô Thì Nhậm', city_district: 'Quận Hai Bà Trưng', city: 'Hà Nội' }),
    '25 Phố Huế, Phường Ngô Thì Nhậm, Quận Hai Bà Trưng, Hà Nội', 'du truong -> so nha + duong, phuong, quan, tinh');
  bang(ghepDiaChi({ road: 'Lê Lợi', city_district: 'Hà Nội', city: 'Hà Nội' }), 'Lê Lợi, Hà Nội',
    'TRUNG ten (city = district) -> bo trung, khong ghi "Ha Noi, Ha Noi"');
  bang(ghepDiaChi({ road: 'Quốc lộ 1A', village: 'Xã Tân Phú', county: 'Huyện Châu Thành', state: 'Tiền Giang' }),
    'Quốc lộ 1A, Xã Tân Phú, Huyện Châu Thành, Tiền Giang', 'nong thon: village/county/state cung nhan');
  bang(ghepDiaChi({ pedestrian: 'Phố đi bộ' }), 'Phố đi bộ', 'chi co ten duong di bo van ra ket qua');
  bang(ghepDiaChi(null), '', 'khong co address -> ""');
  bang(ghepDiaChi({}), '', 'address rong -> ""');
  bang(ghepDiaChi({ road: '  Lê Duẩn  ', city: '' }), 'Lê Duẩn', 'cat khoang trang, bo o rong');

  console.log('\n=== 2. Khoa ghi dem: lam tron 4 chu so (~11 m) ===');
  bang(khoaDem(21.0285119, 105.8048170), '21.0285,105.8048', 'lam tron 4 chu so thap phan');
  bang(khoaDem(21.0285119, 105.8048170), khoaDem(21.0285419, 105.8048170),
    'lech vai met -> CUNG khoa (dung lai ket qua, khong goi lai Nominatim)');
  kiem(khoaDem(21.0285, 105.8048) !== khoaDem(21.0385, 105.8048),
    'lech ~1 km -> KHAC khoa (khong dung lan dia chi cua shop khac)');

  /* ============================================================================================
     3. CHAY THAT diaChiTuToaDo voi `fetch` GIA
     Nap lai module moi lan de bo dem cu (dem nam trong bien module).
     ============================================================================================ */
  console.log('\n=== 3. CHAY THAT bo tra dia chi (fetch gia) ===');
  const duongModule = require.resolve('./diaChiTuToaDo');
  function napMoi() { delete require.cache[duongModule]; return require('./diaChiTuToaDo'); }

  let goi = [];
  const datFetch = (xuLy) => { goi = []; global.fetch = async (url, opt) => { goi.push({ url, opt }); return xuLy(url, opt); }; };
  const traJson = (obj) => ({ ok: true, json: async () => obj });

  let M = napMoi();
  datFetch(() => traJson({ address: { road: 'Nguyễn Trãi', quarter: 'Phường 7', city: 'TP HCM' } }));
  let r = await M.diaChiTuToaDo(10.762622, 106.660172);
  bang([r.diaChi, r.tuDem], ['Nguyễn Trãi, Phường 7, TP HCM', false], 'tra duoc -> tra dia chi da ghep');
  bang(goi.length, 1, 'goi Nominatim dung 1 lan');
  kiem(/nominatim\.openstreetmap\.org\/reverse/.test(goi[0].url), 'goi dung dich vu reverse cua OSM');
  kiem(/format=jsonv2/.test(goi[0].url) && /addressdetails=1/.test(goi[0].url),
    'co tham so jsonv2 + addressdetails (khong co thi khong ghep duoc dia chi)');
  kiem(!!(goi[0].opt && goi[0].opt.headers && goi[0].opt.headers['User-Agent']),
    'CO khai User-Agent — Nominatim chan cac loi goi khong khai');
  bang((goi[0].opt.headers['Accept-Language'] || ''), 'vi', 'xin tra loi TIENG VIET');

  /* GHI DEM: goi lai CUNG toa do -> KHONG goi ra ngoai lan nua. */
  r = await M.diaChiTuToaDo(10.762622, 106.660172);
  bang([r.diaChi, r.tuDem], ['Nguyễn Trãi, Phường 7, TP HCM', true], 'lan 2 cung toa do -> lay tu DEM');
  bang(goi.length, 1, 'va KHONG goi Nominatim lan nua (dung gioi han 1 luot/giay)');
  r = await M.diaChiTuToaDo(10.7626259, 106.6601755);   // lech vai met
  bang([r.diaChi, r.tuDem], ['Nguyễn Trãi, Phường 7, TP HCM', true], 'lech vai met van lay tu DEM');
  bang(goi.length, 1, 'nhan vien chup nhieu tam trong 1 shop -> chi ton 1 luot goi');

  console.log('\n  --- 3b. Loi thi TRA RONG, khong nem ra route ---');
  M = napMoi();
  datFetch(() => { throw new Error('getaddrinfo ENOTFOUND'); });
  r = await M.diaChiTuToaDo(21.03, 105.85);
  bang([r.diaChi, r.tuDem], ['', false], 'mang loi -> "" (anh van dong dau duoc)');

  M = napMoi();
  datFetch(() => ({ ok: false, status: 429, json: async () => ({}) }));
  r = await M.diaChiTuToaDo(21.03, 105.85);
  bang(r.diaChi, '', 'HTTP loi (429 qua nhieu luot) -> ""');

  M = napMoi();
  datFetch(() => traJson({ address: {} }));
  r = await M.diaChiTuToaDo(21.03, 105.85);
  bang(r.diaChi, '', 'tra loi khong co dia chi -> ""');
  r = await M.diaChiTuToaDo(21.03, 105.85);
  bang(goi.length, 2, 'KHONG ghi dem chuoi rong -> lan sau van thu lai (mang tot len thi ra dia chi)');

  M = napMoi();
  datFetch(() => traJson({ display_name: 'Somewhere, Việt Nam' }));
  r = await M.diaChiTuToaDo(21.03, 105.85);
  bang(r.diaChi, 'Somewhere, Việt Nam', 'khong ghep duoc thi lui ve display_name');

  console.log('\n  --- 3c. Toa do xau: khong goi ra ngoai ---');
  M = napMoi();
  datFetch(() => traJson({ address: { road: 'X' } }));
  for (const [la, lo, ten] of [[0, 0, 'toa do 0,0 (chua co dinh vi)'], [null, null, 'null'],
    ['abc', 'xyz', 'chuoi khong phai so'], [undefined, undefined, 'undefined']]) {
    bang((await M.diaChiTuToaDo(la, lo)).diaChi, '', `${ten} -> "" `);
  }
  bang(goi.length, 0, 'va KHONG goi Nominatim lan nao (khoi ton luot vo ich)');

  console.log('\n  --- 3d. Gian cach giua 2 luot goi khac toa do (>= 1 giay) ---');
  M = napMoi();
  datFetch(() => traJson({ address: { road: 'A' } }));
  const t0 = Date.now();
  await M.diaChiTuToaDo(1.1, 1.1);
  await M.diaChiTuToaDo(2.2, 2.2);
  const dt = Date.now() - t0;
  kiem(dt >= 1000, 'hai luot goi cach nhau >= 1 giay (Nominatim: ~1 luot/giay)', dt + ' ms');
  bang(goi.length, 2, 'ca hai luot deu goi that (khac toa do nen khong dung dem)');
  delete global.fetch;

  /* ============================================================================================
     4. CHAY THAT ham dong dau anh o frontend — VE LEN CANVAS GIA roi doc lai
     ============================================================================================ */
  console.log('\n=== 4. CHAY THAT dongDauAnh() tren canvas gia ===');
  const RETURN_GOC = 'return { render, getTabs };';
  kiem(sFe.indexOf(RETURN_GOC) > 0, 'tim thay cau return cua IIFE module.dms.js');

  let FE = null, veDuoc = null;
  if (sFe.indexOf(RETURN_GOC) > 0) {
    const srcTest = sFe.replace(RETURN_GOC,
      'return { render, getTabs, __t: { dongDauAnh, xepDong, docAnhDungChieu, CANH_TOI_DA_ANH } };');
    /* Canvas gia: ghi lai moi lenh ve + moi dong chu, do chu = 9px/ky tu. */
    const daVe = { fillText: [], strokeText: [], anh: null, kichCo: null, gradient: [] };
    veDuoc = daVe;
    const ctxGia = {
      font: '', fillStyle: '', strokeStyle: '', lineWidth: 0, textBaseline: '',
      drawImage: (im, x, y, w, h) => { daVe.anh = { w, h }; },
      /* Do chu phai TI LE THEO CO CHU dang dat, khong gan cung px/ky tu: ban dau toi de 9px/ky tu
         nen dia chi 62 ky tu "vua 1 dong" o moi kho anh -> ket luan ve ngat dong thanh vo nghia.
         Arial: be rong trung binh mot ky tu ~0.52 x co chu. */
      measureText: (s) => {
        const co = Number((String(ctxGia.font).match(/(\d+)px/) || [0, 16])[1]) || 16;
        return { width: String(s).length * co * 0.52 };
      },
      createLinearGradient: (x1, y1, x2, y2) => ({ addColorStop: (v, c) => daVe.gradient.push([v, c]), _g: [x1, y1, x2, y2] }),
      fillRect: (x, y, w, h) => { daVe.nen = { x, y, w, h }; },
      fillText: (s, x, y) => daVe.fillText.push({ s, x, y }),
      strokeText: (s, x, y) => daVe.strokeText.push({ s, x, y })
    };
    const docGia = {
      createElement: () => ({
        set width(v) { (daVe.kichCo = daVe.kichCo || {}).w = v; }, get width() { return (daVe.kichCo || {}).w; },
        set height(v) { (daVe.kichCo = daVe.kichCo || {}).h = v; }, get height() { return (daVe.kichCo || {}).h; },
        getContext: () => ctxGia,
        toBlob: (cb) => cb(new Blob([Buffer.from('anhgia')], { type: 'image/jpeg' }))
      })
    };
    /* Anh vao: bitmap gia 4000x3000 (co anh dien thoai) — de kiem viec thu nho ve 1600. */
    const winGia = {
      createImageBitmap: async () => ({ width: 4000, height: 3000, close() { } }),
      isSecureContext: true
    };
    try {
      FE = new Function('window', 'document', 'File', 'Blob', 'escapeHtml', 'fmtDate', 'fmtDateTime',
        'fmtNumber', 'fmtTien', 'apiGet', 'apiPost', 'apiDelete', 'openModal', 'closeModal', 'toast',
        'uploadFile', 'anhNho', 'statusBadge', 'searchBoxHtml', 'effectivePerm', 'wireTableSearch',
        'createImageBitmap', 'URL', 'Image',
        srcTest + '\nreturn window.ModuleDMS.__t;')(
          winGia, docGia, File, Blob, (s) => String(s), (d) => String(d),
          (d) => '07/09/2026 14:32', (n) => String(n), (n) => String(n),
          async () => ({ data: {} }), async () => ({}), async () => ({}),
          () => ({ querySelector: () => null, querySelectorAll: () => [], addEventListener: () => { } }),
          () => { }, () => { }, async () => '/uploads/x.jpg', (u) => u, () => '', () => '',
          () => ({}), () => { }, winGia.createImageBitmap, { createObjectURL: () => '', revokeObjectURL: () => { } }, function () { });
      OK('nap duoc module.dms.js that va lay ra ham dongDauAnh');
    } catch (e) { NO('nap module.dms.js that bai: ' + e.message); }
  }

  if (FE) {
    const kq = await FE.dongDauAnh(new File([Buffer.from('x')], 'a.jpg', { type: 'image/jpeg' }), {
      thoiDiem: '07/09/2026 14:32',
      tenShop: 'SP001 · Shop Hương Lan',
      diaChi: '25 Phố Huế, Phường Ngô Thì Nhậm, Quận Hai Bà Trưng, Hà Nội',
      lat: '21.0285119', lon: '105.8048170',
      tenNhanVien: 'Nguyễn Văn A'
    });
    kiem(kq instanceof File && kq.type === 'image/jpeg', 'tra ve File JPEG (de uploadFile dung nhu file thuong)');
    bang(veDuoc.anh, { w: 1600, h: 1200 },
      'anh 4000x3000 -> thu nho ve canh dai 1600 (cung muc nen anh chung cua he thong)');
    bang(veDuoc.kichCo, { w: 1600, h: 1200 }, 'canvas dung dung kich co da thu nho');

    const chu = veDuoc.fillText.map(x => x.s).join(' | ');
    kiem(/07\/09\/2026 14:32/.test(chu), 'co NGAY + GIO tren anh');
    kiem(/Shop Hương Lan/.test(chu), 'co TEN SHOP tren anh');
    kiem(/Phố Huế/.test(chu) && /Hai Bà Trưng/.test(chu), 'co DIA CHI tren anh');
    kiem(/21\.028512/.test(chu) && /105\.804817/.test(chu), 'co TOA DO (6 chu so thap phan)');
    kiem(/Nguyễn Văn A/.test(chu), 'co TEN NHAN VIEN');
    kiem(veDuoc.strokeText.length === veDuoc.fillText.length,
      'moi dong chu deu co vien -> nen anh sang van doc duoc chu trang');
    kiem(!!veDuoc.nen && veDuoc.nen.y > 0 && (veDuoc.nen.y + veDuoc.nen.h) === 1200,
      'dai nen nam SAT DAY anh (khong che phan giua anh)', JSON.stringify(veDuoc.nen));
    kiem(veDuoc.gradient.length >= 3, 'dai nen la gradient (mo dan, khong che thang mot khoi den)');
    bang(veDuoc.fillText.length, 4, 'dia chi vua kho -> dung 4 dong (gio / shop / dia chi / toa do+NV)');

    /* Dia chi RAT DAI (nong thon ghi day du xa/huyen/tinh) -> phai XEP XUONG DONG, khong bi cat mat.
       Do chieu cao dai nen phai tang theo so dong, khong thi chu tran ra ngoai anh. */
    const nenCu = veDuoc.nen.h;
    veDuoc.fillText.length = 0; veDuoc.strokeText.length = 0;
    await FE.dongDauAnh(new File([Buffer.from('x')], 'a.jpg', { type: 'image/jpeg' }), {
      thoiDiem: '07/09/2026 14:32', tenShop: 'SP002 · Shop Bà Tư',
      diaChi: 'Số 145 Ấp Tân Thuận Đông, Xã Tân Phú Trung, Huyện Châu Thành, Tỉnh Đồng Tháp, khu vực gần cầu Cái Tàu Hạ',
      lat: '10.2', lon: '105.9', tenNhanVien: 'Trần Thị B'
    });
    kiem(veDuoc.fillText.length > 4, 'dia chi RAT DAI -> xep xuong dong tiep (khong bi cat mat)',
      veDuoc.fillText.length + ' dong');
    kiem(veDuoc.nen.h > nenCu, 'dai nen CAO THEO so dong -> chu khong tran ra ngoai anh',
      `${nenCu} -> ${veDuoc.nen.h}`);
    kiem(veDuoc.fillText.every(d => d.y + 0 < 1200), 'moi dong chu deu nam TRONG anh');
    const chuDai = veDuoc.fillText.map(x => x.s).join(' ');
    kiem(/Đồng Tháp/.test(chuDai) || /…/.test(chuDai),
      'phan duoi cua dia chi hoac duoc hien, hoac danh dau "…" — khong am tham mat chu');

    console.log('\n  --- 4b. Thieu du lieu thi noi RO, khong de trong ---');
    const daVeCu = veDuoc.fillText.length;
    veDuoc.fillText.length = 0; veDuoc.strokeText.length = 0;
    await FE.dongDauAnh(new File([Buffer.from('x')], 'a.jpg', { type: 'image/jpeg' }), {
      thoiDiem: '07/09/2026 14:32', tenShop: '', diaChi: '', lat: null, lon: null, tenNhanVien: ''
    });
    const chu2 = veDuoc.fillText.map(x => x.s).join(' | ');
    kiem(/không tra được địa chỉ/.test(chu2), 'khong tra duoc dia chi -> GHI RO tren anh, khong bo trong');
    kiem(/chưa có toạ độ/.test(chu2), 'chua co dinh vi -> ghi ro "chua co toa do"');
    kiem(/07\/09\/2026 14:32/.test(chu2), 'van con ngay gio (dong quan trong nhat)');
    kiem(daVeCu > 0, 'lan ve day du truoc do co ghi nhan duoc');

    console.log('\n  --- 4c. xepDong: cat dong dai ---');
    const ctxD = { measureText: (s) => ({ width: String(s).length * 10 }), font: '' };
    bang(FE.xepDong(ctxD, 'mot hai ba', 1000, 2), ['mot hai ba'], 'du cho -> mot dong');
    bang(FE.xepDong(ctxD, 'mot hai ba bon nam sau', 100, 2).length, 2, 'dai -> cat thanh 2 dong');
    kiem(/…$/.test(FE.xepDong(ctxD, 'a'.repeat(30) + ' ' + 'b'.repeat(30) + ' ' + 'c'.repeat(30), 100, 2)[1] || ''),
      'con chu ma het dong cho phep -> them "…" (khong gia vo la da hien du)');
    bang(FE.xepDong(ctxD, '', 100, 2), [], 'chuoi rong -> khong dong nao');
    bang(FE.xepDong(ctxD, 'tumotchuratdaikhongcatduoc', 50, 2), ['tumotchuratdaikhongcatduoc'],
      'mot tu dai hon ca dong -> van giu (khong lam mat chu)');
  }

  /* ============================================================================================
     5. Ma nguon: dung dung cho, khong pha viec chinh
     ============================================================================================ */
  console.log('\n=== 5. Ma nguon ===');
  const sachFe = bo(sFe);
  kiem(/router\.get\('\/diachi'/.test(sDms), 'backend co route tra dia chi tu toa do');
  kiem(/\.\.\.CN\('ghetham'\)/.test(sDms.slice(sDms.indexOf("router.get('/diachi'"), sDms.indexOf("router.get('/diachi'") + 200)),
    'route /diachi gate cung quyen voi check-in (ghetham)');
  kiem(/require\(['"]\.\.\/utils\/diaChiTuToaDo['"]\)/.test(sDms), 'route nap util tra dia chi');
  kiem(/const anhDaDong = await dongDauAnh\(f, \{/.test(sachFe),
    'frontend dong dau TRUOC khi tai len (anh luu tren may chu da co dau)');
  kiem(/uploadFile\(anhDaDong, 'ghetham'\)/.test(sachFe), 'tai len ANH DA DONG DAU, khong phai file goc');
  kiem(!/uploadFile\(f, 'ghetham'\)/.test(sachFe), 'khong con duong tai len file goc chua dong dau');
  kiem(/catch \(err\) \{ diaChi = ''; \}/.test(sachFe),
    'tra dia chi loi thi bo qua — KHONG chan viec chup anh');
  kiem(/oFile\.disabled = false;/.test(sachFe),
    'luon mo lai o chon file (ke ca khi loi) — khong de nhan vien bi ket');
  kiem(/imageOrientation: 'from-image'/.test(sachFe),
    'ap dung chieu EXIF — anh dien thoai khong bi quay ngang, dau khong nam sai canh');
  kiem(/fmtDateTime\(new Date\(\)\)/.test(sachFe),
    'gio dong len anh lay theo GIO MAY (dung quy tac v7.72, khong qua UTC)');
  kiem(!/toISOString/.test(sachFe), 'khong dung toISOString cho dau thoi gian');
  const v = (sIndex.match(/module\.dms\.js\?v=([\d.]+)/) || [])[1];
  kiem(v && parseFloat(v) >= 7.73, 'index.html: module.dms.js?v= >= 7.73', String(v));

  console.log('\n================================================================');
  console.log(`KET QUA: ${dat} dat / ${truot} truot`);
  process.exit(truot ? 1 : 0);
})().catch(e => { console.error('LOI TEST: ' + e.stack); process.exit(1); });
