/* ================================================================================================
   CHAY TAT CA MIGRATION THEO DUNG THU TU   (v6.77)

   VI SAO CAN FILE NAY:
   Du an co hon 80 file migration_v*.sql, ten dat khong dong nhat (v2, v5_chucnang, v52_qlsx, v513,
   v534b, v600...) va KHONG co bang nao ghi lai file nao da chay. Cai lai may la phai mo tung file
   chay tay theo tri nho - chac chan sot hoac chay sai thu tu.
   Nay: 1 lenh chay het, co bang MigrationDaChay ghi lai, chay lai lan 2 thi TU BO QUA file da chay.

   CACH DUNG (mo cmd trong thu muc database):
     node chay_migration.js --danh-sach     Chi IN thu tu se chay, khong dong vao CSDL
     node chay_migration.js --schema        CSDL TRONG: tao bang goc (schema.sql) roi chay het migration
     node chay_migration.js                 CSDL DA CO: chay cac migration chua chay
     node chay_migration.js --danh-dau      Danh dau TAT CA la "da chay" ma KHONG chay
                                            (dung cho CSDL dang chay san - xem canh bao ben duoi)

   ⚠️ MAY DANG CHAY THAT (D:\QLSX) da chay het migration bang tay tu truoc. Lan dau dung file nay
      tren may do phai chay `--danh-dau` TRUOC, neu khong no se chay lai ca 80 file. Cac migration
      deu viet kieu "IF ... IS NULL THEN ALTER" nen chay lai gan nhu vo hai, nhung "gan nhu" khong
      phai la "chac chan" - dung thu van may voi CSDL dang chay.
   ================================================================================================ */
const fs = require('fs');
const path = require('path');
const { sql, getPool } = require('../backend/db');

const argv = process.argv.slice(2);
const co = (k) => argv.includes(k);
const CHI_LIET_KE = co('--danh-sach');
const CHAY_SCHEMA = co('--schema');
const DANH_DAU = co('--danh-dau');

const THU_MUC = __dirname;

/* ------------------------------------------------------------------------------------------------
   THU TU CHAY - suy ra TU TEN FILE, khong chep tay danh sach.
   Chep tay thi moi lan them migration moi lai phai nho sua o day, va som muon cung quen.

   Quy tac doc so trong ten (theo dung cach du an nay danh so phien ban):
     migration_v2      -> 2.x   (nhung ban dau tien, truoc he thong v5.x)
     migration_v53     -> 5.3
     migration_v513    -> 5.13
     migration_v600    -> 6.00
   Tuc la: CHU SO DAU = phien ban lon, PHAN CON LAI = phien ban nho.
   Duoi 2 chu so (v2, v3, v4) coi nhu phien ban nho = -1 de luon dung truoc v2x.
   Hau to chu cai (v534b, v534c) chay sau ban goc, theo dung thu tu chu cai.
   Hau to _<chu> (v5_chucnang, v52_qlsx) sap theo alphabet - cac file nay cung mot dot nen khong
   phu thuoc nhau.
------------------------------------------------------------------------------------------------ */
function khoaThuTu(ten) {
  const m = /^migration_v(\d+)([a-z]*)(?:_(.+))?\.sql$/i.exec(ten);
  if (!m) return [9999, 9999, 9999, '', ten];
  const num = m[1], hau = (m[2] || '').toLowerCase(), duoi = m[3] || '';
  const lon = num.length <= 1 ? Number(num) : Number(num[0]);
  const nho = num.length <= 1 ? -1 : Number(num.slice(1));
  return [lon, nho, hau ? hau.charCodeAt(0) - 96 : 0, duoi, ten];
}

function danhSachMigration() {
  return fs.readdirSync(THU_MUC)
    .filter(f => /^migration_v.*\.sql$/i.test(f))
    // File *_rollback.sql la de HOAN TAC, chay chung trong luot cai dat la pha hong migration vua chay.
    .filter(f => !/rollback/i.test(f))
    .map(khoaThuTu)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2] || String(a[3]).localeCompare(String(b[3])))
    .map(k => k[4]);
}

/* SQL Server khong hieu 'GO' - do la lenh cua cong cu (SSMS/sqlcmd), khong phai cua may chu.
   Phai TU TACH file thanh tung khoi roi gui rieng. Tach theo DONG chi co moi chu GO (cho phep
   khoang trang va chu thich phia sau), KHONG dung split('GO') - se cat nham chu GO nam trong ten
   bang hay trong chuoi. */
function tachTheoGO(sqlText) {
  const dong = sqlText.split(/\r?\n/);
  const khoi = [];
  let hienTai = [];
  dong.forEach(d => {
    if (/^\s*GO\s*(--.*)?$/i.test(d)) {
      khoi.push(hienTai.join('\n'));
      hienTai = [];
    } else hienTai.push(d);
  });
  khoi.push(hienTai.join('\n'));
  return khoi.map(x => x.trim()).filter(Boolean);
}

async function bangTheoDoi(pool) {
  await pool.request().query(`
    IF OBJECT_ID('MigrationDaChay', 'U') IS NULL
    CREATE TABLE MigrationDaChay (
      TenFile  NVARCHAR(200) NOT NULL PRIMARY KEY,
      ChayLuc  DATETIME2     NOT NULL DEFAULT SYSDATETIME(),
      SoLenh   INT           NULL,
      GhiChu   NVARCHAR(500) NULL
    )`);
}

async function daChay(pool) {
  const rs = (await pool.request().query('SELECT TenFile FROM MigrationDaChay')).recordset;
  return new Set(rs.map(r => r.TenFile));
}

async function chayFile(pool, ten, duong) {
  const noiDung = fs.readFileSync(duong, 'utf8');
  const khoi = tachTheoGO(noiDung);
  let i = 0;
  for (const lenh of khoi) {
    i++;
    try {
      await pool.request().batch(lenh);
    } catch (err) {
      throw new Error(`khoi lenh #${i}/${khoi.length}: ${err.message}`);
    }
  }
  await pool.request()
    .input('t', sql.NVarChar, ten)
    .input('n', sql.Int, khoi.length)
    .query(`MERGE MigrationDaChay AS t USING (SELECT @t AS TenFile) AS s ON t.TenFile = s.TenFile
            WHEN MATCHED THEN UPDATE SET ChayLuc = SYSDATETIME(), SoLenh = @n
            WHEN NOT MATCHED THEN INSERT (TenFile, SoLenh) VALUES (@t, @n);`);
  return khoi.length;
}

(async () => {
  const ds = danhSachMigration();

  if (CHI_LIET_KE) {
    console.log(`=== ${ds.length} FILE MIGRATION, THU TU CHAY ===`);
    ds.forEach((f, i) => console.log(`${String(i + 1).padStart(3)}. ${f}`));
    console.log('');
    console.log('(File *_rollback.sql da duoc bo qua - do la file hoan tac, khong phai buoc cai dat.)');
    process.exit(0);
  }

  const pool = await getPool();
  await bangTheoDoi(pool);

  if (DANH_DAU) {
    let n = 0;
    for (const f of ds) {
      const r = await pool.request().input('t', sql.NVarChar, f)
        .query(`IF NOT EXISTS (SELECT 1 FROM MigrationDaChay WHERE TenFile=@t)
                INSERT INTO MigrationDaChay (TenFile, GhiChu) VALUES (@t, N'Đánh dấu thủ công - đã chạy tay từ trước')`);
      n += r.rowsAffected[0] || 0;
    }
    console.log(`Da danh dau ${n} file la "da chay" (khong chay lenh nao).`);
    console.log('Tu gio chay `node chay_migration.js` chi con chay nhung file MOI them sau nay.');
    process.exit(0);
  }

  if (CHAY_SCHEMA) {
    const duongSchema = path.join(THU_MUC, 'schema.sql');
    if (!fs.existsSync(duongSchema)) {
      console.error('Khong thay schema.sql - CSDL trong thi bat buoc phai co file nay.');
      process.exit(1);
    }
    console.log('>> schema.sql (tao bang goc)');
    try {
      await chayFile(pool, 'schema.sql', duongSchema);
      console.log('   OK');
    } catch (err) {
      console.error('   LOI: ' + err.message);
      console.error('   DUNG LAI. Sua xong chay lai - cac file da chay se tu bo qua.');
      process.exit(1);
    }
  }

  const xong = await daChay(pool);
  const canChay = ds.filter(f => !xong.has(f));
  console.log(`=== ${ds.length} file migration | da chay ${ds.length - canChay.length} | can chay ${canChay.length} ===`);
  if (!canChay.length) { console.log('Khong co gi phai chay. CSDL da o ban moi nhat.'); process.exit(0); }

  let ok = 0;
  for (const f of canChay) {
    process.stdout.write(`>> ${f} ... `);
    try {
      const n = await chayFile(pool, f, path.join(THU_MUC, f));
      console.log(`OK (${n} khoi lenh)`);
      ok++;
    } catch (err) {
      console.log('LOI');
      console.error(`   ${err.message}`);
      console.error('');
      console.error(`DUNG LAI o file: ${f}`);
      console.error(`Da chay xong ${ok}/${canChay.length} file. Cac file do DA GHI vao MigrationDaChay,`);
      console.error('nen sau khi sua loi, chay lai lenh nay se tiep tu dung cho dang do - khong chay lai tu dau.');
      process.exit(1);
    }
  }
  console.log('');
  console.log(`=== XONG. Da chay ${ok} file. ===`);
  console.log('Buoc tiep theo: Quan ly User -> Ma tran phan quyen -> cap quyen cho cac phan he moi.');
  process.exit(0);
})().catch(e => { console.error('LOI: ' + e.message); process.exit(1); });
