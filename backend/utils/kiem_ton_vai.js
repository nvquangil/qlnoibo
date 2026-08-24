/* ================================================================================================
   KIEM CHUNG "CON HANG" CUA CAY VAI + CHONG TRUNG TEN DANH MUC                             v7.36
   ------------------------------------------------------------------------------------------------
   KHONG CAN CSDL. Goi DUNG cac ham that (utils/tonVai.js, utils/crudFactory.js) voi pool GIA.

   Chan hai loi da lam "co vai ton dung loai dung mau ma phieu xuat khong ra cay nao":
     A. Vai nhap theo MET/CAY co KGNhap = 0 => KGCon = 0 ngay tu luc nhap. Dieu kien cu `KGCon > 0`
        coi nhu HET o moi man xuat kho.
     B. Danh muc co HAI ban ghi cung ten khac ID (LoaiVaiID 2144 va 2153 cung ten
        "Thô karo Thắng Liên 6111") => chi dinh tro ban nay, cay vai tro ban kia, phep loc ghep
        bang ID truot sach.

   CACH DUNG (trong thu muc backend):
       node utils/kiem_ton_vai.js
   Thoat 0 = dat, 1 = co muc khong dat.
   ================================================================================================ */
const { conHangSQL, conHang, chiConMet, capNhatTrangThaiCay } = require('./tonVai');

let dat = 0, truot = 0;
function ok(dieuKien, nhan, chiTiet) {
  if (dieuKien) { dat++; console.log('  OK   ' + nhan); }
  else { truot++; console.log('  TRUOT ' + nhan + (chiTiet ? '  -> ' + chiTiet : '')); }
}

/* Pool gia: tra ket qua theo kich ban, va GHI LAI moi cau SQL + moi UPDATE de kiem lai. */
function poolGia(traLoi) {
  const daChay = [];
  const req = () => {
    const thamSo = {};
    const r = {
      input(ten, kieu, gt) { thamSo[ten] = gt; return r; },
      async query(text) {
        daChay.push({ sql: String(text).replace(/\s+/g, ' ').trim(), thamSo: { ...thamSo } });
        return { recordset: traLoi(String(text), thamSo) };
      }
    };
    return r;
  };
  return { request: req, daChay };
}
const sqlGia = { Int: 'Int', NVarChar: 'NVarChar', Decimal: () => 'Decimal' };

(async () => {
  console.log('');
  console.log('=== 1. conHang(): dinh nghia "con hang" = con KG HOAC con MET ===');
  ok(conHang({ KGCon: 5, MetCon: 0 }) === true, 'Con KG, khong con met -> con hang');
  ok(conHang({ KGCon: 0, MetCon: 30 }) === true,
    'KG = 0 nhung con 30 MET -> CON HANG (day la ca bi bo sot truoc day)');
  ok(conHang({ KGCon: 0, MetCon: 0 }) === false, 'Het ca hai -> het');
  ok(conHang({ KGCon: -2, MetCon: -1 }) === false, 'Am ca hai -> het');
  ok(conHang(null) === false, 'Dong rong -> het (khong nem loi)');
  ok(conHang({ KGCon: null, MetCon: 12 }) === true, 'KGCon NULL nhung con met -> con hang');
  ok(chiConMet({ KGCon: 0, MetCon: 30 }) === true, 'chiConMet() nhan dien cay "vo hinh"');
  ok(chiConMet({ KGCon: 5, MetCon: 30 }) === false, 'Con KG thi khong goi la "vo hinh"');

  console.log('');
  console.log('=== 2. conHangSQL(): sinh dieu kien SQL dung alias ===');
  const dk = conHangSQL('t');
  ok(dk === '(t.KGCon > 0 OR t.MetCon > 0)', 'Dieu kien dung 2 cot, dung OR, co ngoac bao', dk);
  ok(/\(/.test(dk) && (dk.match(/\(/g).length === dk.match(/\)/g).length), 'Ngoac can bang');
  ok(conHangSQL('vc').indexOf('vc.MetCon') !== -1, 'Doi alias thi doi theo', conHangSQL('vc'));
  /* Ngoac bao la BAT BUOC: khong co ngoac thi `WHERE A AND B OR C` doc sai thanh `(A AND B) OR C`. */
  ok(dk.charAt(0) === '(' && dk.charAt(dk.length - 1) === ')',
    'Co ngoac bao ngoai -> ghep vao AND khong bi doc sai uu tien');

  console.log('');
  console.log('=== 3. capNhatTrangThaiCay(): 5 canh ===');
  const canh = [
    { ten: 'Chua xuat gi (KG)', cay: { KGNhap: 100, SoMet: 0 }, xuat: { Tong: 0, TongMet: 0 }, mong: 'Nguyên cây' },
    { ten: 'Xuat mot phan KG', cay: { KGNhap: 100, SoMet: 0 }, xuat: { Tong: 40, TongMet: 0 }, mong: 'Cây lẻ' },
    { ten: 'Xuat het KG', cay: { KGNhap: 100, SoMet: 0 }, xuat: { Tong: 100, TongMet: 0 }, mong: 'Hết' },
    /* Ca QUAN TRONG NHAT: cay nhap theo MET, KGNhap = 0. Cong thuc cu (chi xet KG) se ra 'Hết'
       ngay lan xuat dau tien du con 40/50 met. */
    { ten: 'Nhap theo MET (KG=0), xuat 10/50 met', cay: { KGNhap: 0, SoMet: 50 }, xuat: { Tong: 0, TongMet: 10 }, mong: 'Cây lẻ' },
    { ten: 'Nhap theo MET, xuat het 50 met', cay: { KGNhap: 0, SoMet: 50 }, xuat: { Tong: 0, TongMet: 50 }, mong: 'Hết' },
    { ten: 'Nhap theo MET, chua xuat gi', cay: { KGNhap: 0, SoMet: 50 }, xuat: { Tong: 0, TongMet: 0 }, mong: 'Nguyên cây' }
  ];
  for (const c of canh) {
    const p = poolGia(text => {
      if (/FROM VaiCay/.test(text)) return [c.cay];
      if (/PhieuXuatVaiChiTiet/.test(text)) return [c.xuat];
      return [];
    });
    const kq = await capNhatTrangThaiCay(p, sqlGia, 1);
    ok(kq && kq.trangThai === c.mong, `${c.ten} -> "${c.mong}"`, kq ? `ra "${kq.trangThai}"` : 'khong tra ve gi');
    /* Phai co dung MOT cau UPDATE VaiCay, va ghi dung trang thai vua tinh. */
    const upd = p.daChay.filter(x => /UPDATE VaiCay SET TrangThai/.test(x.sql));
    ok(upd.length === 1 && upd[0].thamSo.TrangThai === c.mong,
      `   ghi UPDATE dung 1 lan voi TrangThai = "${c.mong}"`,
      upd.length ? String(upd[0].thamSo.TrangThai) : 'khong co UPDATE');
    /* Phai doc CA SoMet, khong chi KGNhap — thieu la quay ve loi cu. */
    const doc = p.daChay.find(x => /FROM VaiCay/.test(x.sql));
    ok(doc && /SoMet/.test(doc.sql), '   cau doc cay co lay ca cot SoMet', doc ? doc.sql : '');
    const tong = p.daChay.find(x => /PhieuXuatVaiChiTiet/.test(x.sql));
    ok(tong && /SUM\(SoMet\)/.test(tong.sql), '   cau tong da xuat co SUM(SoMet)', tong ? tong.sql : '');
  }

  console.log('');
  console.log('=== 4. capNhatTrangThaiCay(): cay khong ton tai ===');
  const pRong = poolGia(text => (/FROM VaiCay/.test(text) ? [] : []));
  const kqRong = await capNhatTrangThaiCay(pRong, sqlGia, 999);
  ok(kqRong === null, 'Cay khong co -> tra null, KHONG nem loi');
  ok(!pRong.daChay.some(x => /UPDATE/.test(x.sql)), 'Khong ghi UPDATE nao khi cay khong ton tai');

  /* ============================================================================================
     5. crudFactory: chan trung ten sau chuan hoa. Goi that router qua stub express.
     ============================================================================================ */
  console.log('');
  console.log('=== 5. Danh muc: chan trung ten sau chuan hoa khoang trang ===');
  const dsCauTrung = [];
  const poolDanhMuc = poolGia(text => {
    if (/SELECT TOP 3/.test(text)) {
      dsCauTrung.push(text);
      /* Gia lap: trong bang da co #2144 "Thô karo Thắng Liên 6111". Khoa so sanh bo het khoang trang
         nen moi bien the khoang trang cua ten do deu bi coi la TRUNG. */
      return [{ Id: 2144, Ten: 'Thô karo Thắng Liên 6111' }];
    }
    return [{ LoaiVaiID: 1 }];
  });
  /* Nap crudFactory voi db gia (khong the require '../db' that vi khong co CSDL). */
  const Module = require('module');
  const gocLoad = Module._load;
  Module._load = function (ten, cha, isMain) {
    if (ten === '../db') return { sql: sqlGia, getPool: async () => poolDanhMuc };
    if (ten === '../middleware/auth') {
      const mw = () => (req, res, next) => next();
      return { requireAuth: mw(), requirePermission: mw, requireChucNang: mw };
    }
    return gocLoad.apply(this, arguments);
  };
  delete require.cache[require.resolve('./crudFactory')];
  const { buildCrudRouter } = require('./crudFactory');
  Module._load = gocLoad;

  /* Bat tay POST handler ra khoi router stub. */
  let handlerPost = null;
  const expressGoc = require.cache[require.resolve('express')];
  const router = buildCrudRouter({
    table: 'LoaiVai', idCol: 'LoaiVaiID', moduleCode: 'DANHMUC',
    columns: [
      { name: 'TenLoaiVai', sqlType: sqlGia.NVarChar, required: true, duyNhat: true },
      { name: 'MaLoai', sqlType: sqlGia.NVarChar, trim: true }
    ]
  });
  /* Router that cua express luu handler trong router.stack — lay handler cuoi cua route POST '/'. */
  const layer = (router.stack || []).find(l => l.route && l.route.path === '/' && l.route.methods.post);
  handlerPost = layer && layer.route.stack[layer.route.stack.length - 1].handle;
  ok(typeof handlerPost === 'function', 'Lay duoc handler POST tu router (moi kiem tiep duoc)');

  if (typeof handlerPost === 'function') {
    const goi = async (body) => {
      let mã = 200, kq = null;
      const res = { status(c) { mã = c; return res; }, json(o) { kq = o; return res; } };
      await handlerPost({ body }, res, () => {});
      return { mã, kq };
    };
    /* Ten y het -> phai bi chan */
    let r = await goi({ TenLoaiVai: 'Thô karo Thắng Liên 6111' });
    ok(r.mã === 400 && /Đã có bản ghi mang tên này/.test(r.kq.message),
      'Ten y het ban da co -> chan, bao ro ID dang giu ten', JSON.stringify(r));
    ok(/#2144/.test(r.kq.message), '   thong bao neu ID cu the (#2144) de nguoi dung dung ban do');
    /* KHOANG TRANG DOI o giua -> UNIQUE cua SQL Server KHONG chan, nhung ta phai chan */
    r = await goi({ TenLoaiVai: 'Thô karo  Thắng Liên 6111' });
    ok(r.mã === 400, 'Khoang trang DOI o giua -> van bi chan (day la cach 2144/2153 sinh ra)', JSON.stringify(r.mã));
    /* KHOANG TRANG DAU/CUOI -> chan */
    r = await goi({ TenLoaiVai: '  Thô karo Thắng Liên 6111  ' });
    ok(r.mã === 400, 'Khoang trang dau/cuoi -> van bi chan');
    /* Ten khac han -> cho qua, va gia tri ghi vao phai DA CHUAN HOA khoang trang */
    const poolMoi = poolGia(text => (/SELECT TOP 3/.test(text) ? [] : [{ LoaiVaiID: 9 }]));
    Module._load = function (ten) {
      if (ten === '../db') return { sql: sqlGia, getPool: async () => poolMoi };
      if (ten === '../middleware/auth') { const mw = () => (q, s, n) => n(); return { requireAuth: mw(), requirePermission: mw, requireChucNang: mw }; }
      return gocLoad.apply(this, arguments);
    };
    delete require.cache[require.resolve('./crudFactory')];
    const cf2 = require('./crudFactory');
    Module._load = gocLoad;
    const r2 = cf2.buildCrudRouter({
      table: 'LoaiVai', idCol: 'LoaiVaiID', moduleCode: 'DANHMUC',
      columns: [{ name: 'TenLoaiVai', sqlType: sqlGia.NVarChar, required: true, duyNhat: true }]
    });
    const l2 = (r2.stack || []).find(l => l.route && l.route.path === '/' && l.route.methods.post);
    const h2 = l2 && l2.route.stack[l2.route.stack.length - 1].handle;
    let mã2 = 200;
    await h2({ body: { TenLoaiVai: '  Cotton   giấy  HX8805  ' } },
      { status(c) { mã2 = c; return this; }, json() { return this; } }, () => {});
    ok(mã2 === 200, 'Ten chua trung -> cho tao', 'ma=' + mã2);
    const cauInsert = poolMoi.daChay.find(x => /INSERT INTO LoaiVai/.test(x.sql));
    ok(cauInsert && cauInsert.thamSo.TenLoaiVai === 'Cotton giấy HX8805',
      'Gia tri ghi vao DA CHUAN HOA khoang trang (gop day khoang trang, TRIM)',
      cauInsert ? JSON.stringify(cauInsert.thamSo.TenLoaiVai) : 'khong co INSERT');
  }
  void expressGoc;

  console.log('');
  console.log(`KET QUA: ${dat} dat / ${truot} truot`);
  console.log(truot ? '>> CO MUC KHONG DAT - phai sua truoc khi giao.' : '>> DAT TAT CA.');
  process.exit(truot ? 1 : 0);
})().catch(err => { console.error('LOI KIEM CHUNG: ' + err.stack); process.exit(1); });
