/* ==================================================================================================
   XÓA CÂY VẢI THEO MÃ VẢI  (v6.11)  —  CÔNG CỤ NGUY HIỂM, ĐỌC KỸ TRƯỚC KHI CHẠY
   --------------------------------------------------------------------------------------------------
   Xóa các CÂY VẢI (bảng VaiCay) thuộc một hoặc nhiều MÃ VẢI (DanhMucVai.MaVai).
   Tồn kho vải là số TÍNH RA từ cây vải (KGNhap − đã xuất) nên xóa cây là tồn của mã đó biến mất theo.
   Danh mục MÃ VẢI được GIỮ NGUYÊN (chỉ xóa cây), trừ khi thêm --xoa-ma.

   CÓ 5 BẢNG tham chiếu tới cây vải — cây nào đang bị 1 trong 5 bảng này dùng thì KHÔNG xóa thẳng được:
     1. PhieuXuatVaiChiTiet   (đã xuất kho)
     2. TienDoCatChiTietCay   (đã đưa vào SỔ CẮT)      <-- chỗ hay quên nhất
     3. KiemKeVai             (đã kiểm kê)
     4. GiaoVaiSanXuat        (giao vải SX - dữ liệu cũ)
     5. PhieuXuatVatTuVai     (xuất vật tư, có từ v5.28 - CSDL chưa chạy migration đó thì bỏ qua)

   CÁCH DÙNG (mở CMD tại thư mục backend):
     node utils/xoa_cay_vai.js --mavai=V001,V002
         -> CHỈ BÁO CÁO: mỗi mã có bao nhiêu cây, tồn bao nhiêu, bao nhiêu cây đang vướng giao dịch.

     node utils/xoa_cay_vai.js --mavai=V001 --ghi
         -> Xóa các cây SẠCH (không vướng bảng nào). Cây đang vướng thì BỎ QUA và liệt kê ra.

     node utils/xoa_cay_vai.js --mavai=V001 --ghi --ke-ca-giao-dich
         -> XÓA CẢ dòng giao dịch liên quan (dòng phiếu xuất, dòng sổ cắt, kiểm kê, giao vải SX...)
            rồi mới xóa cây. RẤT NẶNG: sổ cắt / phiếu xuất cũ sẽ mất dòng tương ứng, số liệu lịch sử
            và bảng lương liên quan đổi theo. Phải xác nhận LẦN THỨ HAI.

   Tùy chọn thêm:
     --tatca              làm với TẤT CẢ mã vải (thay cho --mavai)
     --chua-xuat          chỉ lấy cây CHƯA phát sinh giao dịch nào (an toàn nhất, dùng để dọn nhập nhầm)
     --xoa-ma             xóa luôn dòng mã vải trong danh mục (chỉ xóa được mã không còn cây nào)
     --khong-hoi          bỏ bước gõ xác nhận
     --khong-backup       không ghi file sao lưu (KHÔNG khuyến khích)

   AN TOÀN: mặc định KHÔNG sửa gì; phải gõ đúng chữ XOA; dữ liệu bị xóa được ghi ra
   backend/backup/cayvai_<thời điểm>.json. VẪN NÊN backup database bằng SSMS trước khi chạy.
   ================================================================================================== */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { sql, getPool } = require('../db');

const args = process.argv.slice(2);
const co = (t) => args.indexOf(t) !== -1;
const layChuoi = (t) => { const a = args.find(x => x.indexOf(t + '=') === 0); return a ? a.split('=').slice(1).join('=') : ''; };

const GHI = co('--ghi');
const TAT_CA = co('--tatca');
const KE_CA_GD = co('--ke-ca-giao-dich');
const CHUA_XUAT = co('--chua-xuat');
const XOA_MA = co('--xoa-ma');
const KHONG_HOI = co('--khong-hoi');
const KHONG_BACKUP = co('--khong-backup');
const DS_MA = layChuoi('--mavai').split(',').map(s => s.trim()).filter(Boolean);

const backupDir = path.join(__dirname, '..', 'backup');

// Mỗi máy chạy tới migration khác nhau -> DÒ bảng trước khi đụng vào (xem lỗi 'Invalid object name' ở v6.09.1).
async function coBang(pool, ten) {
  const r = (await pool.request().query(`SELECT OBJECT_ID('dbo.${ten}', 'U') AS id`)).recordset[0];
  return r && r.id != null;
}
function hoi(cauHoi) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(cauHoi, (tl) => { rl.close(); resolve(String(tl || '').trim()); });
  });
}

async function main() {
  if (!DS_MA.length && !TAT_CA) {
    console.log('Thieu tham so. Vi du:  node utils/xoa_cay_vai.js --mavai=V001,V002');
    console.log('Hoac lam voi tat ca ma:  node utils/xoa_cay_vai.js --tatca');
    process.exit(1);
  }
  const pool = await getPool();

  // Danh sách bảng tham chiếu tới cây vải, chỉ giữ bảng CÓ THẬT trong CSDL này.
  const bangGD = [];
  for (const b of [
    { bang: 'PhieuXuatVaiChiTiet', nhan: 'da xuat kho' },
    { bang: 'TienDoCatChiTietCay', nhan: 'da vao so cat' },
    { bang: 'KiemKeVai', nhan: 'da kiem ke' },
    { bang: 'GiaoVaiSanXuat', nhan: 'giao vai SX (du lieu cu)' },
    { bang: 'PhieuXuatVatTuVai', nhan: 'xuat vat tu' }
  ]) { if (await coBang(pool, b.bang)) bangGD.push(b); else console.log(`(CSDL nay chua co bang ${b.bang} - bo qua.)`); }

  const dieuKienMa = DS_MA.length ? ` AND dv.MaVai IN (${DS_MA.map((_, i) => '@ma' + i).join(',')})` : '';
  const ganMa = (rq) => { DS_MA.forEach((m, i) => rq.input('ma' + i, sql.NVarChar, m)); return rq; };
  const vuongExpr = bangGD.map(b => `EXISTS (SELECT 1 FROM ${b.bang} t WHERE t.CayID = vc.CayID)`).join(' OR ') || '0=1';

  const cays = (await ganMa(pool.request()).query(`
    SELECT vc.CayID, vc.MaCay, vc.KGNhap, dv.MaVai, lv.TenLoaiVai, ms.TenMau,
           CASE WHEN ${vuongExpr} THEN 1 ELSE 0 END AS Vuong
    FROM VaiCay vc
    JOIN DanhMucVai dv ON dv.VaiID = vc.VaiID
    LEFT JOIN LoaiVai lv ON lv.LoaiVaiID = dv.LoaiVaiID
    LEFT JOIN MauSac ms ON ms.MauSacID = dv.MauSacID
    WHERE 1=1${dieuKienMa}
    ORDER BY dv.MaVai, vc.MaCay`)).recordset;

  if (!cays.length) { console.log('Khong tim thay cay vai nao khop dieu kien.'); process.exit(0); }

  // Gom theo mã vải để báo cáo cho dễ đọc.
  const theoMa = {};
  cays.forEach(c => {
    const k = c.MaVai || '(khong ma)';
    if (!theoMa[k]) theoMa[k] = { soCay: 0, kg: 0, vuong: 0, ten: `${c.TenLoaiVai || ''} ${c.TenMau || ''}`.trim() };
    theoMa[k].soCay++; theoMa[k].kg += Number(c.KGNhap) || 0;
    if (c.Vuong) theoMa[k].vuong++;
  });

  const sach = cays.filter(c => !c.Vuong);
  const vuong = cays.filter(c => c.Vuong);
  const muc = CHUA_XUAT ? sach : (KE_CA_GD ? cays : sach);

  console.log('='.repeat(84));
  console.log('CAY VAI THEO MA VAI' + (DS_MA.length ? ` (${DS_MA.length} ma)` : ' (TAT CA ma)'));
  console.log('='.repeat(84));
  Object.keys(theoMa).sort().forEach(k => {
    const t = theoMa[k];
    console.log(`  ${k.padEnd(16)} ${t.ten.slice(0, 26).padEnd(28)} ${String(t.soCay).padStart(5)} cay  ${t.kg.toFixed(2).padStart(11)} kg nhap  ${t.vuong ? `(${t.vuong} cay VUONG giao dich)` : ''}`);
  });
  console.log('');
  console.log(`Tong: ${cays.length} cay | Sach (xoa duoc ngay): ${sach.length} | Vuong giao dich: ${vuong.length}`);
  if (vuong.length) {
    console.log('Cay VUONG (vi du 15 cay dau):');
    vuong.slice(0, 15).forEach(c => console.log(`   - ${c.MaCay} (${c.MaVai})`));
    if (vuong.length > 15) console.log(`   ... va ${vuong.length - 15} cay nua`);
  }
  console.log('');
  console.log(`>> SE XOA ${muc.length} cay  ${KE_CA_GD ? '(--ke-ca-giao-dich: xoa CA dong giao dich lien quan)' : '(chi cay SACH; cay vuong duoc GIU LAI)'}`);
  console.log('');

  if (!GHI) {
    console.log('>>> DANG O CHE DO CHI XEM. Khong sua gi ca.');
    console.log('    Xoa cay sach            :  node utils/xoa_cay_vai.js ' + (DS_MA.length ? '--mavai=' + DS_MA.join(',') : '--tatca') + ' --ghi');
    console.log('    Xoa ca dong giao dich   :  ... --ghi --ke-ca-giao-dich   (RAT NANG, mat lich su)');
    process.exit(0);
  }
  if (!muc.length) { console.log('Khong co cay nao de xoa.'); process.exit(0); }

  console.log('!!! CANH BAO: KHONG HOAN TAC duoc. Hay chac chan da backup database bang SSMS.');
  if (!KHONG_HOI) {
    const tl = await hoi(`    Go dung chu  XOA  de xoa ${muc.length} cay vai (chu khac = huy): `);
    if (tl !== 'XOA') { console.log('Da HUY, khong sua gi.'); process.exit(0); }
    if (KE_CA_GD && vuong.length) {
      const tl2 = await hoi(`    XAC NHAN LAN 2: se xoa CA dong giao dich cua ${vuong.length} cay (so cat / phieu xuat / kiem ke). Go  DONG Y  : `);
      if (tl2 !== 'DONG Y') { console.log('Da HUY, khong sua gi.'); process.exit(0); }
    }
  }

  const ids = muc.map(c => Number(c.CayID)).filter(Number.isFinite);
  const inID = `(${ids.join(',')})`;   // ID số nguyên đọc từ CSDL -> ghép thẳng an toàn

  // ---- Sao lưu ----
  if (!KHONG_BACKUP) {
    const duLieu = { thoiDiem: new Date().toISOString(), locTheoMa: DS_MA, keCaGiaoDich: KE_CA_GD, soCay: ids.length, cay: muc };
    for (const b of bangGD) {
      duLieu[b.bang] = (await pool.request().query(`SELECT * FROM ${b.bang} WHERE CayID IN ${inID}`)).recordset;
    }
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const f = path.join(backupDir, `cayvai_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(f, JSON.stringify(duLieu, null, 1), 'utf8');
    console.log('Da ghi file sao luu: ' + f);
  }

  // ---- Xóa dòng giao dịch trước (nếu được phép) ----
  if (KE_CA_GD) {
    for (const b of bangGD) {
      const r = await pool.request().query(`DELETE FROM ${b.bang} WHERE CayID IN ${inID}`);
      console.log(`Da xoa ${r.rowsAffected[0]} dong ${b.bang} (${b.nhan}).`);
    }
  }

  // ---- Xóa cây vải ----
  const rCay = await pool.request().query(`DELETE FROM VaiCay WHERE CayID IN ${inID}`);
  console.log(`Da xoa ${rCay.rowsAffected[0]} cay vai.`);

  // ---- Xóa phiếu nhập không còn cây nào (phiếu rỗng giữ lại vô nghĩa) ----
  const rPhieu = await pool.request().query(`
    DELETE p FROM PhieuNhapVai p
    WHERE NOT EXISTS (SELECT 1 FROM VaiCay vc WHERE vc.PhieuNhapID = p.PhieuNhapID)`);
  console.log(`Da xoa ${rPhieu.rowsAffected[0]} phieu nhap vai rong.`);

  // ---- (tùy chọn) Xóa mã vải không còn cây nào ----
  if (XOA_MA) {
    const rMa = await ganMa(pool.request()).query(`
      DELETE dv FROM DanhMucVai dv
      WHERE NOT EXISTS (SELECT 1 FROM VaiCay vc WHERE vc.VaiID = dv.VaiID)${dieuKienMa}`);
    console.log(`Da xoa ${rMa.rowsAffected[0]} ma vai khoi danh muc (ma con cay thi giu nguyen).`);
  }

  const conLai = (await ganMa(pool.request()).query(`
    SELECT COUNT(*) AS c FROM VaiCay vc JOIN DanhMucVai dv ON dv.VaiID = vc.VaiID WHERE 1=1${dieuKienMa}`)).recordset[0].c;
  console.log('');
  console.log('='.repeat(84));
  console.log(`XONG. Cac ma vai vua xu ly con lai ${conLai} cay.`);
  console.log('Kiem tra tren phan mem: Quan ly kho vai > Ton kho / Ton theo cay (bam F5).');
  process.exit(0);
}

main().catch(err => { console.error('\nLOI:', err.message); console.error(err); process.exit(1); });
