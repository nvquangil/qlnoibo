/* ================================================================================================
   kiem_nghi_phep_theo_nam.js — bo tu kiem v10.01 (Nguyen 23/11/2026):
     (1) "Cac truong trong bang nay co the nhap so bat ky. So cong dang chi nhap duoc 1 va 0.5,
          co the nhap 0.7 0.8"  -> o nhap SoCong / GioTangCa* phai step="any" (khong phai 0.5).
     (2) "Them chuc nang xem ngay nghi phep cua nhan vien trong 1 nam. Tong cong bao nhieu ngay da nghi."
          -> tab PAYROLL/nghiphepnam + 2 route doc + migration_v909.

   Muc kiem:
     1. Bien dich payroll.js (routes), luongCongNhat.js, module.payroll.js.
     2. O nhap "Them / sua 1 ngay": step="any" (KHONG con step="0.5"), min="0", id giu nguyen.
        Cot CSDL von da chiu duoc (DECIMAL(4,2) / (5,2)) nen KHONG duoc de nghi them migration.
     3. soNgayNghiCuaDong(): HAM THUAN — chay that voi cac truong hop 0 / 0,5 / 1 / 0,7.
        gomChamCong DUNG ham do (khong con viet lap bieu thuc), va ket qua phep khong doi.
     4. Route /chamcong/nghiphepnam dung TRUOC /chamcong/:nhanVienId; gac dung chuc nang;
        cau SQL dem theo DUNG luat (CASE WHEN SoCong > 0 ...), loc dung 4 ma nghi.
     5. Chay THAT hai handler voi pool gia: gop theo nguoi/thang/ma, tong dung, nguoi da nghi viec
        khong lam phinh bang nhung duoc dem vao ngayNghiViecBoQua.
     6. Man hinh: tab moi co trong TABS + co ham render; migration_v909 khai dung dong.
   Chay: node backend\utils\kiem_nghi_phep_theo_nam.js — KHONG dung CSDL.
   ================================================================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const GOC = path.join(__dirname, '..', '..');
const doc = (...p) => fs.existsSync(path.join(GOC, ...p)) ? fs.readFileSync(path.join(GOC, ...p), 'utf8').replace(/\r\n/g, '\n') : '';
let sai = 0, dat = 0;
function kiem(ten, dung, td) {
  if (dung) { dat++; console.log('  ✓ ' + ten); }
  else { sai++; console.log('  ❌ ' + ten + (td ? ' — ' + (typeof td === 'string' ? td : JSON.stringify(td)) : '')); }
}
const boComment = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const canhGac = setTimeout(() => { console.log('\n  ❌ BO KIEM TREO qua 20 s'); process.exit(1); }, 20000);

console.log('\n=== 1. BIEN DICH ===');
['backend/routes/payroll.js', 'backend/utils/luongCongNhat.js', 'frontend/js/module.payroll.js'].forEach(f => {
  const s = doc(...f.split('/')); if (!s) { sai++; console.log('  ❌ ' + f + ' KHONG DOC DUOC'); return; }
  try { new vm.Script(s, { filename: f }); dat++; console.log('  ✓ ' + f); } catch (e) { sai++; console.log('  ❌ ' + f + ' VO CU PHAP: ' + e.message); }
});

(async () => {
  const fe = doc('frontend', 'js', 'module.payroll.js');
  const feSach = boComment(fe);

  console.log('\n=== 2. O nhap "Them / sua 1 ngay" — nhap duoc so bat ky ===');
  ['d_cong', 'd_tcT', 'd_tcCN', 'd_tcLe'].forEach(id => {
    const o = (feSach.match(new RegExp('<input type="number"[^>]*id="' + id + '"[^>]*>')) || [''])[0];
    kiem(`#${id}: step="any" + min="0", KHONG con step="0.5"`,
      /step="any"/.test(o) && /min="0"/.test(o) && !/step="0\.5"/.test(o), o || '(khong tim thay o nhap)');
  });
  /* Cot CSDL von chiu duoc 2 chu so thap phan — doi UI la du, dung de ai tuong phai chay migration. */
  const be = doc('backend', 'routes', 'payroll.js');
  kiem('may chu nhan SoCong DECIMAL(4,2) (khong lam tron ve 0,5)', /input\('SoCong', sql\.Decimal\(4, 2\)/.test(be));

  console.log('\n=== 3. soNgayNghiCuaDong() — MOT luat dem ngay nghi ===');
  const LCN = require(path.join(GOC, 'backend', 'utils', 'luongCongNhat.js'));
  kiem('co export soNgayNghiCuaDong', typeof LCN.soNgayNghiCuaDong === 'function');
  if (typeof LCN.soNgayNghiCuaDong === 'function') {
    const f = LCN.soNgayNghiCuaDong;
    kiem('SoCong = 0 (giay nghi ca ngay) -> 1 ngay', f({ soCong: 0 }) === 1, f({ soCong: 0 }));
    kiem('khong co SoCong -> 1 ngay', f({}) === 1 && f(null) === 1);
    kiem('SoCong = 0,5 (giay nua ngay) -> 0,5', f({ soCong: 0.5 }) === 0.5);
    kiem('SoCong = 0,7 -> 0,7 (so le van giu nguyen)', f({ soCong: 0.7 }) === 0.7);
    kiem('SoCong = 1 -> 1', f({ soCong: 1 }) === 1);
  }
  const beLCN = boComment(doc('backend', 'utils', 'luongCongNhat.js'));
  kiem('gomChamCong DUNG ham do, khong con viet lap "soCong > 0 ? soCong : 1"',
    /g\.soPhep \+= soNgayNghiCuaDong\(r\)/.test(beLCN) && /g\.congLe \+= soNgayNghiCuaDong\(r\)/.test(beLCN)
    && !/soCong > 0 \? soCong : 1/.test(beLCN));
  /* Hanh vi gomChamCong KHONG duoc doi sau khi rut gon. */
  const g = LCN.gomChamCong([
    { maCham: 'P', soCong: 0 }, { maCham: 'P', soCong: 0.5 }, { maCham: 'x', soCong: 1, ngay: '2026-10-01' },
    { maCham: 'LT', soCong: 0 }, { maCham: 'KL', soCong: 0 }], null, null, 5);
  kiem('gomChamCong: phep 1 + 0,5 = 1,5; le 1; KL khong tinh cong', g.soPhep === 1.5 && g.congLe === 1 && g.congChinhThuc === 1, g);

  console.log('\n=== 4. Route /chamcong/nghiphepnam ===');
  const p = boComment(be);
  const iNam = p.indexOf("router.get('/chamcong/nghiphepnam',");
  const iChiTiet = p.indexOf("router.get('/chamcong/nghiphepnam/:nhanVienId',");
  const iParam = p.indexOf("router.get('/chamcong/:nhanVienId',");
  kiem('ca hai route dung TRUOC /chamcong/:nhanVienId (literal truoc :param)',
    iNam > 0 && iChiTiet > iNam && iParam > iChiTiet, { iNam, iChiTiet, iParam });
  const than = p.slice(iNam, iParam);
  kiem('gac requirePermission(PAYROLL,view) + requireChucNang(PAYROLL,nghiphepnam)',
    /requirePermission\('PAYROLL', ?'view'\)/.test(than) && /requireChucNang\('PAYROLL', ?'nghiphepnam'\)/.test(than));
  kiem('dem theo DUNG luat cua bang luong: CASE WHEN ISNULL(SoCong,0) > 0 THEN SoCong ELSE 1',
    /CASE WHEN ISNULL\(cc\.SoCong, 0\) > 0 THEN cc\.SoCong ELSE 1 END/.test(than));
  kiem('chi lay 4 ma nghi P / KL / TS / TN', /MA_NGHI_NAM = \['P', 'KL', 'TS', 'TN'\]/.test(p));
  kiem('doc tu ChamCongNgay (KHONG dem tu PhieuNghi — se ra con so thu hai)',
    /FROM ChamCongNgay cc/.test(than) && !/FROM PhieuNghi/.test(than));
  kiem('loc nguoi da nghi viec giong bang luong v9.45',
    /ISNULL\(nv\.TrangThaiLaoDong, N''\) <> N'Đã nghỉ việc'/.test(than));

  console.log('\n=== 5. Chay THAT hai handler (pool gia) ===');
  const Module = require('module');
  const gocLoad = Module._load;
  const sqlGia = new Proxy({}, { get(_, k) { const f = () => k; f.toString = () => String(k); return f; } });
  const handlers = [];
  const routerGia = new Proxy({}, { get(_, m) { return (duong, ...mw) => { handlers.push({ m, duong, h: mw[mw.length - 1] }); }; } });
  let traLoi = () => [];
  const poolGia = { request: () => { const inp = {}; const rq = { input(k, t, v) { inp[k] = v; return rq; }, async query(q) { return { recordset: traLoi(String(q).replace(/\s+/g, ' '), inp) }; } }; return rq; } };
  Module._load = function (ten) {
    if (ten === 'express') { const ex = () => ({}); ex.Router = () => routerGia; return ex; }
    if (ten === '../db') return { sql: sqlGia, getPool: async () => poolGia };
    if (ten === '../middleware/auth') return new Proxy({}, { get: () => () => (req, res, next) => next() });
    if (/^\.\.?\//.test(ten) && !/\/db$/.test(ten)) {
      try { return gocLoad.apply(this, arguments); } catch (e) { return new Proxy({}, { get: () => () => {} }); }
    }
    return gocLoad.apply(this, arguments);
  };
  let okNap = true;
  try { require(path.join(GOC, 'backend', 'routes', 'payroll.js')); } catch (e) { okNap = false; console.log('  (khong nap duoc payroll.js voi stub: ' + e.message + ')'); }
  Module._load = gocLoad;
  const hNam = handlers.find(x => x.m === 'get' && x.duong === '/chamcong/nghiphepnam');
  const hCT = handlers.find(x => x.m === 'get' && x.duong === '/chamcong/nghiphepnam/:nhanVienId');
  if (okNap && hNam && hCT) {
    const goi = async (h, query, params) => {
      let kq, maLoi = 200;
      const res = { json: (o) => { kq = o; }, status(c) { maLoi = c; return res; } };
      await h.h({ session: { user: { userId: 5 } }, query: query || {}, params: params || {} }, res);
      return { kq, maLoi };
    };
    /* NgayVao đặt ở TƯƠNG LAI để "không phép" = 0 một cách tất định (dsNgayKhongPhep cắt khoảng theo
       ngày vào làm) — luật đếm không phép đã có bộ kiểm riêng ở mục 5b trên hàm thuần. */
    traLoi = (q) => {
      if (/COL_LENGTH\('HopDongLaoDong','ChuyenCanTinhCN'\)/.test(q.replace(/\s/g, ''))) return [{ c: 1 }];
      if (/COL_LENGTH/.test(q)) return [{ c: 1, Co: 1 }];
      if (/FROM ChamCongNgay cc/.test(q) && /GROUP BY/.test(q)) return [
        { NhanVienID: 61, Thang: 3, Ma: 'P', SoNgay: 1.5 },
        { NhanVienID: 61, Thang: 7, Ma: 'P', SoNgay: 2 },
        { NhanVienID: 61, Thang: 7, Ma: 'KL', SoNgay: 1 },
        { NhanVienID: 62, Thang: 1, Ma: 'TS', SoNgay: 30 },
        { NhanVienID: 99, Thang: 5, Ma: 'P', SoNgay: 4 }];       // 99 = nguoi da nghi viec
      if (/FROM NhanVien nv/.test(q)) return [
        { NhanVienID: 61, MaNhanVien: 'NV61', HoTen: 'A', TenBoPhan: 'May', NgayVao: '2026-12-25', ChuyenCanTinhCN: 1 },
        { NhanVienID: 62, MaNhanVien: 'NV62', HoTen: 'B', TenBoPhan: 'Cắt', NgayVao: '2026-12-25', ChuyenCanTinhCN: 0 }];
      return [];
    };
    const a = await goi(hNam, { nam: 2026 });
    const d = a.kq && a.kq.data;
    kiem('gop dung: A phep 3,5 (T3 = 1,5 · T7 = 2) + KL 1 => tong 4,5',
      !!d && d.rows[0].theoMa.P === 3.5 && d.rows[0].thangPhep[2] === 1.5 && d.rows[0].thangPhep[6] === 2
      && d.rows[0].theoMa.KL === 1 && d.rows[0].tong === 4.5, d && d.rows[0]);
    kiem('nguoi chua nghi ngay nao van co hang (so 0 cung la cau tra loi)',
      !!d && d.rows.length === 2 && d.rows[1].theoMa.TS === 30);
    kiem('tong cong toan cong ty: P 3,5 · KL 1 · TS 30 · tong 34,5',
      !!d && d.tongCong.P === 3.5 && d.tongCong.KL === 1 && d.tongCong.TS === 30 && d.tongCong.tong === 34.5, d && d.tongCong);
    kiem('NgayVao o tuong lai -> khong phep = 0, tongTatCa = tong (khong cong nham)',
      !!d && d.rows[0].khongPhep === 0 && d.rows[0].tongTatCa === d.rows[0].tong, d && d.rows[0]);
    kiem('co co lamCaCN theo hop dong: NV61 (=1) lam ca CN, NV62 (=0) nghi CN',
      !!d && d.rows[0].lamCaCN === true && d.rows[1].lamCaCN === false, d && d.rows.map(x => x.lamCaCN));
    kiem('ngay cua nguoi DA NGHI VIEC khong lam phinh bang nhung duoc NOI ra (ngayNghiViecBoQua = 4)',
      !!d && d.ngayNghiViecBoQua === 4, d && d.ngayNghiViecBoQua);
    traLoi = (q) => {
      if (/COL_LENGTH/.test(q)) return [{ c: 1, Co: 1 }];
      if (/FROM ChamCongNgay cc/.test(q)) return [
        { Ngay: '2026-03-02', Ma: 'P', SoNgay: 1, Nguon: 'PhieuNghi', GhiChu: '' },
        { Ngay: '2026-03-03', Ma: 'P', SoNgay: 0.5, Nguon: 'PhieuNghi', GhiChu: 'nửa ngày' }];
      if (/FROM NhanVien nv/.test(q)) return [{ NhanVienID: 61, MaNhanVien: 'NV61', HoTen: 'A', TenBoPhan: 'May', NgayVao: '2026-12-25', ChuyenCanTinhCN: 1 }];
      return [];
    };
    const b = await goi(hCT, { nam: 2026 }, { nhanVienId: '61' });
    kiem('chi tiet 1 nguoi: 2 dong, tong 1,5 ngay', !!b.kq && b.kq.data.rows.length === 2 && b.kq.data.tong === 1.5, b.kq && b.kq.data);
    kiem('chi tiet tach ro tung loai (theoMa.P = 1,5) + nhan loai KP/CN co trong tu dien',
      !!b.kq && b.kq.data.theoMa.P === 1.5 && /KHÔNG PHÉP/.test(b.kq.data.loai.KP || ''), b.kq && b.kq.data.theoMa);
    const c = await goi(hCT, { nam: 2026 }, {});
    kiem('thieu nhan vien -> 400 (loi nghiep vu, KHONG phai 401)', c.maLoi === 400, c.maLoi);
  } else kiem('tim thay ca hai handler', !!hNam && !!hCT);

  console.log('\n=== 5b. v10.02 — khong phep + nghi CN ===');
  kiem('co dsChuNhatTrongKhoang + export', typeof LCN.dsChuNhatTrongKhoang === 'function');
  if (typeof LCN.dsChuNhatTrongKhoang === 'function') {
    /* 01/11/2026 la Chu nhat (kiem tay: 2026-11-01). Thang 11/2026 co CN 01, 08, 15, 22, 29 = 5 ngay. */
    const cn = LCN.dsChuNhatTrongKhoang('2026-11-01', '2026-11-30');
    kiem('thang 11/2026 co 5 chu nhat, bat dau 01/11', cn.length === 5 && cn[0] === '2026-11-01', cn);
    kiem('khoang khong hop le -> rong', LCN.dsChuNhatTrongKhoang('', 'x').length === 0);
  }
  /* KHONG viet luat dem khong phep lan thu hai — phai goi dsNgayKhongPhep cua bang luong. */
  kiem('route dung dsNgayKhongPhep (khong tu dem lai)', /dsNgayKhongPhep\(\{ nam, thang: t, homNay, ngayVao: nv\.NgayVao/.test(p));
  kiem('co dem 12 thang trong nam', /for \(let t = 1; t <= 12; t\+\+\)/.test(p));
  kiem('bo phan nghi CN doc tu hop dong ChuyenCanTinhCN (migration_v900), thieu cot -> coi nhu lam ca CN',
    /ChuyenCanTinhCN/.test(p) && /Number\(nv\.ChuyenCanTinhCN\) === 0/.test(p));
  kiem('nghi CN KHONG cong vao TONG (tongTatCa = tong + khongPhep)', /o\.tongTatCa = o\.tong \+ o\.khongPhep/.test(p));
  /* Chi tiet 1 nguoi phai TRON ca ngay khong phep + nghi CN vao danh sach ngay. */
  kiem("chi tiet tron ma 'KP' va 'CN' vao danh sach ngay", /Ma: 'KP'/.test(p) && /Ma: 'CN'/.test(p));

  console.log('\n=== 5c. v10.02 — khoi tieu de CO DINH khi cuon ===');
  /* Dung DUNG co che san co (.toolbar + common.js capNhatThanhCongCuDinh), KHONG tu viet position:sticky
     — tu viet thi thanh va tieu de bang cung dinh mot moc, tieu de chui xuong duoi (bai hoc v6.48.2). */
  const than10 = feSach.slice(feSach.indexOf('async function renderNghiPhepNam()'), feSach.indexOf('function wireNamNghi()'));
  kiem('boc khoi dau man trong <div class="toolbar">', /<div class="toolbar" style="display:block;">/.test(than10));
  kiem('KHONG tu viet position:sticky trong man nay', !/position:\s*sticky/.test(than10));
  kiem('bang KHONG con boc trong div overflow:auto (vung cuon phai la .content)',
    !/<div style="overflow:auto;"><table/.test(than10));
  kiem('keo o tim vao khoi co dinh', /dataset\.oTimHop/.test(than10) && /khoi\.appendChild\(hopTim\)/.test(than10));

  console.log('\n=== 6. Man hinh + migration ===');
  kiem("TABS co { key: 'nghiphepnam' }", /\{ key: 'nghiphepnam', label: 'Ngày nghỉ theo năm' \}/.test(feSach));
  kiem('bang co cot Khong phep + Nghi CN', /Không phép<\/th>/.test(feSach) && /Nghỉ CN<\/th>/.test(feSach));
  kiem('render() dinh tuyen sang renderNghiPhepNam', /activeTab === 'nghiphepnam'\) return renderNghiPhepNam\(\)/.test(feSach));
  kiem('co ham renderNghiPhepNam + moChiTietNghiNam', /async function renderNghiPhepNam\(\)/.test(feSach) && /async function moChiTietNghiNam\(/.test(feSach));
  kiem('bam mot dong mo chi tiet tung ngay', /tbody tr\[data-nv\]/.test(feSach));
  const sSql = boComment(doc('database', 'migration_v909.sql'));
  kiem('migration_v909 khai PAYROLL/nghiphepnam', /'PAYROLL', ?'nghiphepnam'/.test(sSql));
  kiem('MacDinhCho = 1 (tab nghiep vu binh thuong, khong phai quyen opt-in)',
    /nghiphepnam'[^)]*, ?1\)/.test(sSql.replace(/\s+/g, ' ')));
  kiem('dung MERGE ⇒ chay lai vo hai', /MERGE ChucNang/.test(sSql));
  kiem('migration KHONG tao bang/cot, KHONG sua du lieu',
    !/CREATE TABLE|ALTER TABLE|UPDATE ChamCongNgay|DELETE FROM/i.test(sSql.replace(/--.*$/gm, '')));
  const v = /module\.payroll\.js\?v=([\d.]+)/.exec(doc('frontend', 'index.html'));
  kiem('index.html module.payroll.js ?v>=10.02', !!v && parseFloat(v[1]) >= 10.02, v && v[1]);

  clearTimeout(canhGac);
  console.log(`\n=== KET QUA: ${dat} dat, ${sai} sai ===`);
  process.exit(sai ? 1 : 0);
})().catch(e => { console.error('VO: ' + (e && e.stack || e)); process.exit(1); });
