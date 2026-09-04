/* ================================================================================================
   SOI CAC LENH SX CO NHIEU DOT GHI KHO NHAP                                              v7.56
   ------------------------------------------------------------------------------------------------
   Tu v7.56 cong doan Kho nhap CONG DON cac dot — nhung CHI voi cac lan ghi co `CongDonKN = 1`
   (ghi tu ban nay tro di). Cac lan ghi CU van chi tinh LAN GAN NHAT, vi truoc day "ghi lai" nghia la
   GHI LAI DE SUA (nguoi dung da chot: khong doi so cua du lieu cu).

   Cong cu nay liet ke cac lenh co TU 2 LAN GHI Kho nhap tro len, chi ro:
     · tung dot: ngay, tong SL, co duoc TINH khong
     · SO DANG TINH  = tong cac dot dang duoc cong (nhu he thong dang hien)
     · SO NEU CONG HET = tong TAT CA cac dot
   Neu hai so nay khac nhau -> lenh do co dot cu bi bo. Do la du lieu cu ghi lai de SUA (dung, khong
   phai lam gi), HOAC that su la nhap nhieu dot tu truoc (muon tinh ca thi vao form Kho nhap, khoi
   "Kho nhap da ghi": xoa dot cu roi ghi lai thanh dot moi).

   CHI DOC, khong sua gi.
   Chay:  node utils/soi_kho_nhap_nhieu_dot.js
          node utils/soi_kho_nhap_nhieu_dot.js --madh=DH2608058
   ================================================================================================ */
const { sql, getPool } = require('../db');

const thamSo = (ten) => {
  const t = process.argv.find(x => x.startsWith('--' + ten + '='));
  return t ? t.slice(ten.length + 3).replace(/^<|>$/g, '') : null;
};
const so = (n) => Number(n || 0).toLocaleString('vi-VN');

(async () => {
  const pool = await getPool();
  const maDH = thamSo('madh');

  const kn = (await pool.request().query("SELECT StageID FROM CongDoanSanXuat WHERE MaCongDoan = 'KN'")).recordset[0];
  if (!kn) { console.log('Khong tim thay cong doan Kho nhap (MaCongDoan = KN).'); process.exit(1); }

  const coCo = (await pool.request()
    .query("SELECT COL_LENGTH('TienDoSanXuat','CongDonKN') AS c")).recordset[0].c != null;
  console.log('');
  console.log('Cot TienDoSanXuat.CongDonKN: ' + (coCo ? 'DA CO (da chay migration_v692)' : 'CHUA CO -> he thong dang chay cach cu (chi lan gan nhat)'));

  const rq = pool.request().input('s', sql.Int, kn.StageID);
  if (maDH) rq.input('m', sql.NVarChar, maDH);
  const rows = (await rq.query(`
    SELECT d.MaDH, d.TenSanPham, td.TienDoID, td.NgayGhiNhan,
           ${coCo ? 'ISNULL(td.CongDonKN, 0)' : 'CAST(0 AS BIT)'} AS CongDonKN,
           ISNULL((SELECT SUM(ct.SoLuongLuyKe) FROM TienDoChiTietMau ct WHERE ct.TienDoID = td.TienDoID), 0) AS TongSL
    FROM TienDoSanXuat td
    JOIN DonHangSanXuat d ON d.DonHangID = td.DonHangID
    WHERE td.StageID = @s${maDH ? ' AND d.MaDH = @m' : ''}
    ORDER BY d.MaDH, td.TienDoID`)).recordset;

  /* Gom theo lenh roi AP DUNG DUNG quy tac doc cua effectiveTienDoIds:
       ids = [lan CU gan nhat] + [tat ca cac lan co CongDonKN = 1] */
  const theoLenh = new Map();
  rows.forEach(r => {
    if (!theoLenh.has(r.MaDH)) theoLenh.set(r.MaDH, { ten: r.TenSanPham || '', dot: [] });
    theoLenh.get(r.MaDH).dot.push(r);
  });

  let soLenhLech = 0, soLenhNhieuDot = 0;
  theoLenh.forEach((v, maDHx) => {
    if (v.dot.length < 2) return;
    soLenhNhieuDot++;
    const cu = v.dot.filter(d => !Number(d.CongDonKN));
    const moi = v.dot.filter(d => Number(d.CongDonKN));
    const cuCuoi = cu.length ? cu[cu.length - 1] : null;   // da ORDER BY TienDoID nen phan tu cuoi la moi nhat
    const dangTinh = new Set([...(cuCuoi ? [cuCuoi.TienDoID] : []), ...moi.map(d => d.TienDoID)].map(String));
    const tongDangTinh = v.dot.filter(d => dangTinh.has(String(d.TienDoID))).reduce((s, d) => s + Number(d.TongSL || 0), 0);
    const tongTatCa = v.dot.reduce((s, d) => s + Number(d.TongSL || 0), 0);
    const lech = tongDangTinh !== tongTatCa;
    if (lech) soLenhLech++;

    console.log('');
    console.log(`=== ${maDHx}${v.ten ? ' — ' + v.ten : ''} · ${v.dot.length} dot`
      + ` · DANG TINH ${so(tongDangTinh)}` + (lech ? ` · NEU CONG HET ${so(tongTatCa)}  <-- CO DOT BI BO` : ' (cong het cac dot)'));
    v.dot.forEach((d, i) => {
      const ngay = d.NgayGhiNhan ? new Date(d.NgayGhiNhan).toLocaleDateString('vi-VN') : '';
      console.log(`    dot ${i + 1}: TienDoID=${d.TienDoID} · ${ngay} · SL ${so(d.TongSL)}`
        + ` · ${Number(d.CongDonKN) ? 'moi (cong don)' : 'CU'}`
        + ` · ${dangTinh.has(String(d.TienDoID)) ? 'DUOC TINH' : 'khong duoc tinh'}`);
    });
  });

  console.log('');
  console.log('================================================================');
  console.log(`Tong: ${theoLenh.size} lenh co ghi Kho nhap · ${soLenhNhieuDot} lenh co >= 2 dot`
    + ` · ${soLenhLech} lenh dang co dot BI BO.`);
  if (soLenhLech) {
    console.log('Voi cac lenh "CO DOT BI BO": neu truoc day ghi lai de SUA thi so DANG TINH la DUNG,');
    console.log('khong phai lam gi. Neu thuc su la nhap nhieu dot thi vao form Kho nhap cua lenh do,');
    console.log('khoi "Kho nhap da ghi": xoa dot cu roi ghi lai thanh dot moi de duoc cong don.');
  } else {
    console.log('Khong lenh nao bi bo dot -> doi sang cong don khong lam doi so cua lenh nao.');
  }
  process.exit(0);
})().catch(err => { console.error('LOI: ' + err.message); process.exit(1); });
