/* ================================================================================================
   KIEM CHUNG v7.53
     (A) Ghi tien do Ky thuat — So do da khai bao: them chuc nang SUA
     (B) Cong no NHA GIA CONG / IN THEU (tab moi), phai tra lay tu BANG LUONG
   ------------------------------------------------------------------------------------------------
   Diem nguy hiem nhat cua (B): viet lai cau SQL tinh tien -> Bang luong va So cong no ra HAI CON SO
   cho CUNG MOT viec ma khong ai biet ben nao dung. Nen test MO PHONG bang pool gia va doi chieu:
   TONG so tien tren so cong no PHAI bang tong `ThanhTien` cua chinh 2 ham luong.

   Chay:  node utils/kiem_congno_giacong_inthe.js
   ================================================================================================ */
const fs = require('fs');
const path = require('path');

const G = path.join(__dirname, '..');
const doc = (p) => fs.readFileSync(path.join(G, p), 'utf8');

let dat = 0, truot = 0;
const OK = (m) => { dat++; console.log('  OK   ' + m); };
const NO = (m) => { truot++; console.log('  SAI  ' + m); };
const kiem = (dk, m, them) => (dk ? OK(m) : NO(m + (them ? '  -> ' + them : '')));

const sUtil = doc('utils/luongGiaCongInThe.js');
const sPayroll = doc('routes/payroll.js');
const sCongNo = doc('routes/congno.js');
const sQlsx = doc('routes/qlsx.js');
const sFeCongNo = doc('../frontend/js/module.congno.js');
const sFeQlsx = doc('../frontend/js/module.qlsx.js');
const sMig = doc('../database/migration_v691.sql');
const sCaiDat = doc('../database/CAI_DAT_DAY_DU.sql');
const sIndex = doc('../frontend/index.html');
const bo = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

/* ================================ (A) SUA SO DO ================================ */
console.log('\n=== A1. Backend: co PUT sua so do + dem so lan da cat ===');
kiem(/router\.put\('\/orders\/:maDH\/sodo\/:id'/.test(sQlsx), 'co PUT /orders/:maDH/sodo/:id');
const putSoDo = sQlsx.slice(sQlsx.indexOf("router.put('/orders/:maDH/sodo/:id'"),
  sQlsx.indexOf("router.get('/orders/:maDH/sodo/:id/soluongcat'"));
kiem(/SET MetSoDoDai=@MetSoDoDai, KhoVaiSoDo=@KhoVaiSoDo, MaRap=@MaRap, GhiChu=@GhiChu/.test(putSoDo),
  'UPDATE du 4 truong cua so do');
kiem(/WHERE ID=@id AND DonHangID=@donHangId/.test(putSoDo),
  'chan sua so do cua DON KHAC (WHERE co ca DonHangID)');
kiem(!/ISNULL\(@MetSoDoDai/.test(putSoDo),
  'KHONG boc ISNULL — form gui du 4 o nen bo trong la CO Y xoa');
kiem(/rowsAffected\[0\]/.test(putSoDo), 'khong tim thay dong -> bao 404, khong bao "da luu" gia');

console.log('\n=== A2. Dem so lan cat: dung DUNG bang/cot co that ===');
const demCat = sQlsx.slice(sQlsx.indexOf("router.get('/orders/:maDH/sodo/:id/soluongcat'"),
  sQlsx.indexOf("router.delete('/orders/:maDH/sodo/:id'"));
kiem(/FROM TienDoSanXuat WHERE SoDoID = @id/.test(demCat),
  'dem tren TienDoSanXuat.SoDoID (KHONG phai TienDoCatChiTietCay — bang do khong giu so do)');
kiem(/ALTER TABLE TienDoSanXuat ADD SoDoID INT NULL/.test(sCaiDat),
  'cot TienDoSanXuat.SoDoID co that trong schema');
kiem(!/TienDoCatChiTietCay[^\n]*SoDoID/.test(bo(demCat)),
  'KHONG con tham chieu TienDoCatChiTietCay.SoDoID (cot khong ton tai)');
kiem(/COL_LENGTH\('TienDoSanXuat','SoDoID'\)/.test(demCat), 'do cot truoc khi dem -> khong sap route');

console.log('\n=== A3. Frontend: nut Sua + canh bao khi so do DA duoc cat ===');
kiem(/class="btn small secondary sd-edit"/.test(sFeQlsx), 'bang "So do da khai bao" co nut Sua');
kiem(/\.sd-edit'\)\.forEach/.test(sFeQlsx), 'co gan su kien cho nut Sua');
kiem(/sd-e-met|sd-e-kho|sd-e-marap|sd-e-ghichu/.test(sFeQlsx), 'sua TAI DONG (4 o nhap)');
kiem(/sodo\/\$\{row\.ID\}\/soluongcat/.test(sFeQlsx), 'goi endpoint dem so lan cat');
kiem(/confirm\(`Sơ đồ này đã được dùng ở \$\{n\} lần Ghi tiến độ Cắt/.test(sFeQlsx),
  'CANH BAO truoc khi luu khi so do da duoc cat');
kiem(/const doiSo =/.test(sFeQlsx),
  'chi canh bao khi so lieu VAO PHEP TINH doi (met/kho vai) — sua ma rap/ghi chu thi khong hoi');
kiem(/apiPut\(`\/api\/qlsx\/orders\/\$\{maDH\}\/sodo\/\$\{row\.ID\}`/.test(sFeQlsx), 'goi PUT dung duong');

/* ================================ (B) CONG NO GIA CONG ================================ */
console.log('\n=== B1. MOT ban cong thuc luong (khong hai ban) ===');
kiem(/module\.exports = \{ loadGiaCong, loadInThe, tongHopTheoNha \}/.test(sUtil),
  'utils/luongGiaCongInThe.js export 3 ham');
kiem(/require\('\.\.\/utils\/luongGiaCongInThe'\)/.test(sPayroll), 'payroll.js NHAP tu util');
kiem(/require\('\.\.\/utils\/luongGiaCongInThe'\)/.test(sCongNo), 'congno.js NHAP tu util');
/* Cau SQL tinh tien chi duoc xuat hien o DUNG MOT file. */
const demSQL = (s) => (s.match(/FROM DonHangChiTietNhaGiaCong ct/g) || []).length
  + (s.match(/FROM DonHangNhaInTheu it/g) || []).length;
kiem(demSQL(sUtil) === 2, 'util giu ca 2 cau SQL', String(demSQL(sUtil)));
kiem(demSQL(sPayroll) === 0, 'payroll.js KHONG con ban sao cau SQL', String(demSQL(sPayroll)));
kiem(demSQL(sCongNo) === 0, 'congno.js KHONG viet cau SQL rieng', String(demSQL(sCongNo)));
kiem(/OUTER APPLY \(SELECT TOP 1 x\.DonGia/.test(sUtil),
  'giu bay "nhieu ban don gia" (TOP 1) — LEFT JOIN thang la tien GAP N LAN');
kiem(/SoLuongNhan/.test(sUtil) && !/SoLuongGiao\s*\*/.test(sUtil),
  'MOC = SL NHAN (khong tinh tien phan da giao chua nhan)');

console.log('\n=== B2. Ky loc: co ky thi loc, KHONG ky thi lay tat ca (cong no luy ke) ===');
kiem(/function dieuKienKy\(cot, ky\)/.test(sUtil), 'co ham dung dieu kien ky');
kiem(/if \(!nam \|\| !thang\) return '';/.test(sUtil), 'khong truyen ky -> KHONG loc (lay tat ca)');
kiem(/__loadGiaCong\(pool, sql, \{ nam, thang \}\)/.test(sPayroll),
  'payroll VAN loc theo nam/thang (hanh vi bang luong khong doi)');
kiem(/loadGiaCong\(pool, sql\)\s*;?/.test(sCongNo) || /loadGiaCong\(pool, sql\)/.test(sCongNo),
  'congno goi KHONG kem ky -> so du luy ke tu dau');

console.log('\n=== B3. Migration + file cai moi ===');
kiem(/ALTER TABLE CongNoDieuChinh ADD NhaGiaCongID INT NULL/.test(sMig), 'migration_v691 them cot');
kiem(/IF COL_LENGTH\('CongNoDieuChinh', 'NhaGiaCongID'\) IS NULL/.test(sMig), 'chay lai duoc');
kiem(/FK_CongNoDieuChinh_NhaGiaCong/.test(sMig), 'co khoa ngoai toi NhaGiaCong');
kiem(/'congnogiacong'/.test(sMig), 'seed ChucNang CONGNO/congnogiacong');
const khoiDC = sCaiDat.slice(sCaiDat.indexOf('CREATE TABLE CongNoDieuChinh'),
  sCaiDat.indexOf('CREATE TABLE CongNoDieuChinh') + 1200);
kiem(/NhaGiaCongID INT NULL FOREIGN KEY REFERENCES NhaGiaCong/.test(khoiDC),
  'CAI_DAT_DAY_DU.sql: CongNoDieuChinh da co NhaGiaCongID (cai moi khong thieu cot)');
kiem(/\('CONGNO','congnogiacong'/.test(sCaiDat), 'CAI_DAT_DAY_DU.sql: seed chuc nang tab moi');

console.log('\n=== B4. Route + do cot (chua chay migration van chay) ===');
kiem(/router\.get\('\/congnogiacong'/.test(sCongNo), 'co GET /congno/congnogiacong');
kiem(/router\.get\('\/congnogiacong\/chitiet'/.test(sCongNo), 'co GET /congno/congnogiacong/chitiet');
kiem(/requireChucNang\('CONGNO', 'congnogiacong'\)/.test(sCongNo), 'gate quyen theo chuc nang tab');
kiem((sCongNo.match(/coCot\(pool, 'CongNoDieuChinh', 'NhaGiaCongID'\)/g) || []).length >= 3,
  'do cot NhaGiaCongID o moi cho doc/ghi (danh sach, so chi tiet, dieu chinh)');
kiem(/LoaiDoiTuong = N'NhaGiaCong' AND NhaGiaCongID IS NOT NULL/.test(sCongNo),
  'da tra lay tu PhieuChi loai NhaGiaCong');

console.log('\n=== B5. Dieu chinh cong no: BA loai, mot ham chuan hoa ===');
kiem(/const LOAI_DC = \['KhachHang', 'NhaCungCap', 'NhaGiaCong'\]/.test(sCongNo), 'khai 3 loai');
kiem(/async function dungLoaiDieuChinh\(pool, b\)/.test(sCongNo), 'co ham chuan hoa dung chung');
kiem((sCongNo.match(/dungLoaiDieuChinh\(pool, b\)/g) || []).length === 3,
  'POST + PUT + dinh nghia = 3 lan xuat hien (ca hai duong dung chung)',
  String((sCongNo.match(/dungLoaiDieuChinh\(pool, b\)/g) || []).length));
kiem(!/b\.loaiDoiTuong === 'KhachHang' \? 'KhachHang' : 'NhaCungCap'/.test(sCongNo),
  'KHONG con doan hard-code 2 loai (them loai thu 3 ma quen mot ben la ghi sai loai)');
kiem(/nhaGiaCongId: loai === 'NhaGiaCong'/.test(sCongNo),
  'khoa noi cua loai khong duoc chon ve NULL');
kiem(/option value="NhaGiaCong"/.test(sFeCongNo), 'form Dieu chinh co loai Nha gia cong');
kiem(/name="nhaGiaCongId" id="dcNGC"/.test(sFeCongNo), 'form co o chon nha gia cong');
kiem(/if \(l !== 'NhaGiaCong'\) oNGC\.querySelector\('select'\)\.value = ''/.test(sFeCongNo),
  'doi loai thi don o chon nha gia cong');

console.log('\n=== B6. Frontend tab moi ===');
kiem(/key: 'congnogiacong', label: 'Công nợ nhà gia công \/ in thêu'/.test(sFeCongNo), 'co tab moi');
kiem(/if \(activeTab === 'congnogiacong'\) return renderCongNoGiaCong\(perm\)/.test(sFeCongNo), 'co nhanh render');
['renderCongNoGiaCong', 'soChiTietGiaCong'].forEach(h =>
  kiem(new RegExp(`async function ${h}\\s*\\(`).test(sFeCongNo), `co khai ${h}()`));
kiem(/Tiền gia công<\/th><th>Tiền in thêu/.test(sFeCongNo), 'bang tach 2 cot tien (gia cong / in theu)');
/* Khong ghim dung mot so: ban sau sua tiep 2 file nay se bump len 7.54, 7.55... — ghim so la test
   cu do oan mot thay doi hoan toan dung (da mac 3 lan, xem kiem_chungtu_congno_ncc muc 8). */
const vCongNo = parseFloat((sIndex.match(/module\.congno\.js\?v=([\d.]+)/) || [])[1] || 0);
const vQlsx = parseFloat((sIndex.match(/module\.qlsx\.js\?v=([\d.]+)/) || [])[1] || 0);
kiem(vCongNo >= 7.53 && vQlsx >= 7.53,
  'index.html bump congno + qlsx (>= 7.53)', `congno=${vCongNo} qlsx=${vQlsx}`);

/* ================================ B7: MO PHONG SO TIEN ================================ */
console.log('\n=== B7. MO PHONG: tong tren so cong no = tong cua chinh 2 ham luong ===');
const { loadGiaCong, loadInThe, tongHopTheoNha } = require('./luongGiaCongInThe');
function poolGia(gc, it) {
  return {
    request() {
      const ts = {};
      const r = {
        input(t, k, v) { ts[t] = v; return r; },
        async query(q) {
          const s = String(q).replace(/\s+/g, ' ');
          if (/COL_LENGTH\('DonHangNhaInTheu','HangMucInThe'\)/.test(s)) return { recordset: [{ c: 1 }] };
          if (/FROM DonHangChiTietNhaGiaCong ct/.test(s)) return { recordset: gc };
          if (/FROM DonHangNhaInTheu it/.test(s)) return { recordset: it };
          return { recordset: [] };
        }
      };
      return r;
    }
  };
}
const sqlGia = { Int: 'Int' };
(async () => {
  const gcRows = [
    { NhaGiaCongID: 1, TenNha: 'Nhà A', ThanhTien: 1200000, SoLuongNhan: 100, Ngay: '2026-08-01' },
    { NhaGiaCongID: 1, TenNha: 'Nhà A', ThanhTien: 300000, SoLuongNhan: 25, Ngay: '2026-08-05' },
    { NhaGiaCongID: 2, TenNha: 'Nhà B', ThanhTien: 500000, SoLuongNhan: 50, Ngay: '2026-08-03' }
  ];
  const itRows = [
    { NhaGiaCongID: 1, TenNha: 'Nhà A', ThanhTien: 700000, SoLuongNhan: 70, Ngay: '2026-08-02' }
  ];
  const pool = poolGia(gcRows, itRows);
  const gc = await loadGiaCong(pool, sqlGia);
  const it = await loadInThe(pool, sqlGia);
  kiem(gc.length === 3 && it.length === 1, 'pool gia tra dung so dong');
  const th = tongHopTheoNha([...gc, ...it]);
  const nhaA = th.find(x => x.NhaGiaCongID === 1);
  kiem(nhaA && nhaA.ThanhTien === 2200000,
    'gop theo nha: Nha A = 1.200.000 + 300.000 (gia cong) + 700.000 (in theu) = 2.200.000',
    nhaA && String(nhaA.ThanhTien));
  kiem(th.length === 2, 'hai nha -> hai dong', String(th.length));
  const tongTatCa = [...gc, ...it].reduce((s, r) => s + Number(r.ThanhTien), 0);
  kiem(th.reduce((s, x) => s + x.ThanhTien, 0) === tongTatCa,
    'tong sau khi gop = tong truoc khi gop (khong mat/khong nhan doi dong nao)');
  /* Dong ThieuDonGia phai giu duoc co de bang luong/so cong no hien canh bao. */
  kiem(/ThieuDonGia/.test(sUtil) && /THIẾU ĐƠN GIÁ/.test(sCongNo),
    'co ThieuDonGia duoc chuyen thanh canh bao tren so cong no');

  console.log(`\n================ KET QUA: ${dat} dat / ${truot} sai ================`);
  process.exit(truot ? 1 : 0);
})().catch(err => { console.error('LOI KIEM CHUNG: ' + err.stack); process.exit(1); });
