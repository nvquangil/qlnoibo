/* ================================================================================================
   KIEM TEN BANG / TEN COT TRONG CODE SO VOI CSDL THAT   (chi DOC)                        v7.33
   ------------------------------------------------------------------------------------------------
   VI SAO CO FILE NAY: hai lan lien tiep bam "Xuat Excel" ra loi
        Invalid object name 'TaiKhoan'
        Invalid column name 'LoaiPhieu'
   deu cung mot nguyen nhan: DOAN ten bang/cot roi viet thang vao SQL, den luc nguoi dung bam nut moi
   phat hien. `node --check` KHONG bat duoc loai loi nay (SQL chi la chuoi ky tu).

   File nay quet cac file .js trong backend/routes + backend/utils, trich ra:
       - moi ten bang sau FROM / JOIN / INSERT INTO / UPDATE / DELETE FROM
       - moi cap  <alias>.<Cot>  kem bang ma alias do tro tra
   roi doi chieu voi sys.objects / sys.columns CUA CHINH CSDL DANG CHAY.

   CACH DUNG (trong thu muc backend):
     node utils/kiem_ten_bang_cot.js                 -> quet toan bo routes + utils
     node utils/kiem_ten_bang_cot.js congno.js       -> chi mot file
     node utils/kiem_ten_bang_cot.js --bang          -> chi kiem ten BANG (nhanh)

   ⚠️ Cong cu doc TINH (khong chay SQL) nen co the bao "khong biet" voi cac cau dung ten bang dong
   (`FROM ${bang}`) — cac cho do in ra de nguoi doc tu xem, KHONG coi la loi.
   ================================================================================================ */
const fs = require('fs');
const path = require('path');
const { sql, getPool } = require('../db');

const argv = process.argv.slice(2);
const CHI_BANG = argv.includes('--bang');
const chiFile = argv.filter(a => !a.startsWith('--'));

/* Bang/view he thong + ten dong -> bo qua, khong bao loi oan. */
const BO_QUA = new Set(['sys.columns', 'sys.objects', 'sys.foreign_keys', 'sys.foreign_key_columns',
  'sys.indexes', 'INFORMATION_SCHEMA.COLUMNS', 'INFORMATION_SCHEMA.TABLES']);

function docFile(f) {
  const s = fs.readFileSync(f, 'utf8');
  /* Ten bang: FROM/JOIN/INSERT INTO/UPDATE/DELETE FROM <Ten>. Bo cac ten bat dau bang $ (ten dong). */
  const bang = new Set();
  const reBang = /(?:FROM|JOIN|INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+([A-Za-z_][A-Za-z0-9_.]*)/gi;
  let m;
  while ((m = reBang.exec(s))) {
    const t = m[1];
    if (!/^(SELECT|VALUES|SET|WHERE|OUTPUT)$/i.test(t) && !BO_QUA.has(t)) bang.add(t);
  }
  /* Cap alias -> bang, doc tu chinh cau SQL: "FROM PhieuThu t", "JOIN DanhMucTaiKhoan tk ON ..." */
  const aliasBang = new Map();
  const reAlias = /(?:FROM|JOIN)\s+([A-Za-z_][A-Za-z0-9_]*)\s+(?:AS\s+)?([a-z][a-z0-9_]{0,4})\b/gi;
  while ((m = reAlias.exec(s))) {
    if (!/^(on|where|group|order|set|as|left|inner|outer|cross)$/i.test(m[2])) aliasBang.set(m[2], m[1]);
  }
  /* Cot: <alias>.<Cot> — chi lay khi alias co trong ban do o tren. Bo cot nam trong cotAT(...)/has('..')
     (da co bao ve dong) va bo cac truy cap JavaScript kieu `t.font`, `r.data`. */
  const cot = [];
  const reCot = /\b([a-z][a-z0-9_]{0,4})\.([A-Z][A-Za-z0-9_]*)/g;
  const baoVe = new Set([...s.matchAll(/cotAT\([^,]+,\s*'[a-z0-9_]+',\s*'(\w+)'/g)].map(x => x[1])
    .concat([...s.matchAll(/has\('(\w+)'\)/g)].map(x => x[1]))
    .concat([...s.matchAll(/COL_LENGTH\('[^']+','(\w+)'\)/g)].map(x => x[1])));
  while ((m = reCot.exec(s))) {
    const [, al, c] = m;
    if (!aliasBang.has(al) || baoVe.has(c)) continue;
    cot.push({ bang: aliasBang.get(al), cot: c, alias: al });
  }
  return { bang: [...bang], cot, aliasBang };
}

(async () => {
  let pool;
  try { pool = await getPool(); }
  catch (err) { console.error('KHONG ket noi duoc CSDL: ' + err.message); process.exit(1); }

  try {
    const dsBangThat = new Set((await pool.request().query(
      `SELECT name FROM sys.objects WHERE type IN ('U','V')`)).recordset.map(r => r.name));
    const capCot = new Map();
    const cotCua = async (bang) => {
      if (capCot.has(bang)) return capCot.get(bang);
      const r = (await pool.request().input('b', sql.NVarChar, bang)
        .query('SELECT c.name AS n FROM sys.columns c WHERE c.object_id = OBJECT_ID(@b)')).recordset;
      const set = new Set(r.map(x => x.n));
      capCot.set(bang, set);
      return set;
    };

    const thuMuc = [path.join(__dirname, '..', 'routes'), __dirname];
    let files = [];
    thuMuc.forEach(d => {
      if (!fs.existsSync(d)) return;
      files = files.concat(fs.readdirSync(d).filter(f => f.endsWith('.js')).map(f => path.join(d, f)));
    });
    if (chiFile.length) files = files.filter(f => chiFile.some(c => f.endsWith(c)));

    let loiBang = 0, loiCot = 0, dong = 0;
    for (const f of files) {
      const ten = path.basename(f);
      const { bang, cot } = docFile(f);
      const sai = [];
      bang.forEach(b => {
        const bare = b.replace(/^dbo\./i, '');
        if (bare.includes('.') || /^[a-z]/.test(bare)) return;      // ten dong / bien
        if (!dsBangThat.has(bare)) { sai.push('BANG khong ton tai: ' + b); loiBang++; }
      });
      if (!CHI_BANG) {
        for (const c of cot) {
          const bare = c.bang.replace(/^dbo\./i, '');
          if (!dsBangThat.has(bare)) continue;                      // bang sai da bao o tren
          const set = await cotCua(bare);
          if (set.size && !set.has(c.cot)) {
            sai.push(`COT khong ton tai: ${bare}.${c.cot}  (viet la ${c.alias}.${c.cot})`);
            loiCot++;
          }
        }
      }
      dong += bang.length + cot.length;
      if (sai.length) {
        console.log('');
        console.log('=== ' + ten);
        [...new Set(sai)].forEach(x => console.log('   !! ' + x));
      }
    }
    console.log('');
    console.log(`Da quet ${files.length} file, ${dong} tham chieu bang/cot.`);
    console.log(loiBang || loiCot
      ? `>> CO LOI: ${loiBang} ten bang sai, ${loiCot} ten cot sai. Sua truoc khi giao cho nguoi dung.`
      : '>> TAT CA TEN BANG / TEN COT DEU DUNG voi CSDL dang chay.');
    process.exit(loiBang || loiCot ? 1 : 0);
  } catch (err) {
    console.error('LOI: ' + err.message);
    process.exit(1);
  }
})();
