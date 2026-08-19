/* ================================================================================================
   SUA CO "DaTruTon" CHO CAC DON LEN SAU v6.23 BI DANH DAU NHAM  (chay 1 lan, v6.23.2)
   ------------------------------------------------------------------------------------------------
   LOI: cot DonKhachDatHang.DaTruTon co DEFAULT = 1 (tu migration_v657, thoi con tru ton ngay khi len
   don). Tu v6.23 don chi GIU HANG, nhung route "Lên đơn đặt hàng" NOI BO khong ghi ro cot nay nen
   don moi bi nhan DaTruTon = 1 => (a) cot "Kha dung" KHONG tru cac don dang cho, (b) huy/xoa don se
   HOAN TON mot luong chua tung tru -> ton kho PHONG len.

   Script nay dat lai DaTruTon = 0 cho cac don:
     - dang o 'Chờ xác nhận' / 'Chờ xử lý'  (dang giu hang, chua xuat phieu ban hang)
     - VA tao SAU thoi diem chay v6.23 (mac dinh: tu ngay ban dua --tu-ngay=YYYY-MM-DD)
   KHONG dung den don cu that su da tru ton (dung utils/hoan_ton_don_cho_xu_ly.js cho nhung don do).

   CACH DUNG (trong thu muc backend):
     node utils/sua_datruton_don_moi.js --tu-ngay=2026-08-07               (chay thu)
     node utils/sua_datruton_don_moi.js --tu-ngay=2026-08-07 --ghi         (ghi that)
     node utils/sua_datruton_don_moi.js --tu-ngay=2026-08-07 --khong-co-phieu-xuat --ghi
        (chi nhung don CHUA he xuat kho - an toan hon neu khong nho ngay)
   ================================================================================================ */
const fs = require('fs');
const path = require('path');
const { sql, getPool } = require('../db');

const args = process.argv.slice(2);
const GHI = args.includes('--ghi');
const TU_NGAY = (args.find(a => a.startsWith('--tu-ngay=')) || '').split('=')[1] || null;
const soDep = n => (Number(n) || 0).toLocaleString('vi-VN');

(async () => {
  let pool;
  try { pool = await getPool(); }
  catch (err) { console.error('KHONG ket noi duoc CSDL: ' + err.message); process.exit(1); }

  try {
    const coCot = (await pool.request().query(`SELECT COL_LENGTH('DonKhachDatHang','DaTruTon') AS c`)).recordset[0].c;
    if (coCot == null) { console.log('CSDL chua co cot DaTruTon => khong can chay.'); process.exit(0); }
    if (!TU_NGAY) {
      console.error('Thieu --tu-ngay=YYYY-MM-DD (ngay bat dau chay v6.23 tren may chu).');
      console.error('VD: node utils/sua_datruton_don_moi.js --tu-ngay=2026-08-07');
      process.exit(1);
    }

    const rows = (await pool.request().input('tu', sql.Date, TU_NGAY).query(`
      SELECT o.DonID, o.ThoiGian, o.TenKhach, o.MaHangID, o.MauSacID, o.SoLuongDat, o.DonVi, o.TrangThai,
             h.MaHang, ms.TenMau
      FROM DonKhachDatHang o
      JOIN TheKhoHangHoa h ON h.MaHangID = o.MaHangID
      LEFT JOIN MauSac ms ON ms.MauSacID = o.MauSacID
      WHERE o.TrangThai IN (N'Chờ xác nhận', N'Chờ xử lý')
        AND ISNULL(o.DaTruTon, 0) = 1
        AND CAST(o.ThoiGian AS DATE) >= @tu
      ORDER BY o.DonID`)).recordset;

    if (!rows.length) {
      console.log(`Khong co don nao dang cho, DaTruTon=1, tao tu ${TU_NGAY} tro di => khong can lam gi.`);
      process.exit(0);
    }

    console.log(`=== ${rows.length} don se duoc dat lai DaTruTon = 0 (dang GIU hang, KHONG tru ton) ===`);
    rows.forEach(r => console.log(`  #${r.DonID} ${String(r.ThoiGian).slice(0, 10)} | ${r.TenKhach}`
      + ` | ${r.MaHang} ${r.TenMau || ''} | ${soDep(r.SoLuongDat)} ${r.DonVi} | ${r.TrangThai}`));
    console.log('');
    console.log('LUU Y: script nay KHONG dung den ton kho - chi sua CO danh dau. Vi cac don nay thuc te');
    console.log('       CHUA HE tru ton (v6.23 khong tru khi len don), nen sau khi sua: cot "Kha dung"');
    console.log('       se tru dung cac don dang cho, va huy don se khong con lam phong ton.');

    if (!GHI) { console.log(''); console.log('=> CHAY THU, chua ghi gi. Them --ghi de thuc hien.'); process.exit(0); }

    const dir = path.join(__dirname, '..', 'backup');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `sua_datruton_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(file, JSON.stringify({ ngay: new Date().toISOString(), tuNgay: TU_NGAY, don: rows }, null, 2), 'utf8');
    console.log('Da ghi file sao luu: ' + file);

    const ids = rows.map(r => r.DonID);
    const tran = new sql.Transaction(pool);
    await tran.begin();
    try {
      for (let i = 0; i < ids.length; i += 500) {
        await new sql.Request(tran).query(`UPDATE DonKhachDatHang SET DaTruTon = 0 WHERE DonID IN (${ids.slice(i, i + 500).join(',')})`);
      }
      await tran.commit();
      console.log(`XONG. Da sua ${ids.length} don. Mo lai The kho / Ton kho (Ctrl+F5) de xem cot Kha dung.`);
    } catch (err) {
      try { await tran.rollback(); } catch (e) { /* transaction co the da ket thuc */ }
      console.error('LOI khi ghi - da QUAY LUI toan bo: ' + err.message);
      process.exit(1);
    }
    process.exit(0);
  } catch (err) {
    console.error('LOI: ' + err.message);
    process.exit(1);
  }
})();
