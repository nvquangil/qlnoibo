/* ================================================================================================
   KIEM TEN BANG / TEN COT TRONG CODE SO VOI CSDL THAT   (chi DOC)                      v7.34.1
   ------------------------------------------------------------------------------------------------
   VI SAO CO FILE NAY: hai lan lien tiep bam "Xuat Excel" ra loi
        Invalid object name 'TaiKhoan'
        Invalid column name 'LoaiPhieu'
   deu cung mot nguyen nhan: DOAN ten bang/cot roi viet thang vao SQL, den luc nguoi dung bam nut moi
   phat hien. `node --check` KHONG bat duoc loai loi nay (SQL chi la chuoi ky tu).

   ⚠️ BAN v7.34 DAU TIEN CUA FILE NAY BAO OAN 717 COT. Ly do: no gom alias theo CA FILE, nen alias
   `t` bi gan cho `PhieuThu` o cau nay roi mang di doi chieu cho cau khac - noi ma `t` la
   `vw_TonTheoMau`. Ban nay sua goc:
       - Tach code thanh TUNG CHUOI SQL (moi template literal la mot pham vi rieng).
       - Trong mot chuoi, alias nao xuat hien >1 lan voi >1 bang thi BO QUA (khong doan).
       - Bo ten CTE (WITH x AS ...), bang tam #x, bien bang @x, va cac alias dung lam dich UPDATE/MERGE.
       - Thay moi ${...} bang @@DYN@@ de manh SQL dong khong sinh ra ten bang/cot gia.
   Cong cu nay CO Y THUC THAN TRONG: thay bao it hon con hon bao oan hang tram dong.

   CACH DUNG (trong thu muc backend):
     node utils/kiem_ten_bang_cot.js                 -> quet toan bo routes + utils
     node utils/kiem_ten_bang_cot.js congno.js       -> chi mot file
     node utils/kiem_ten_bang_cot.js --bang          -> chi kiem ten BANG (nhanh)
     node utils/kiem_ten_bang_cot.js --chi-tiet      -> in kem doan SQL chua cho sai
   ================================================================================================ */
const fs = require('fs');
const path = require('path');

/* Bang/view he thong -> bo qua. */
const BO_QUA_BANG = new Set(['sys.columns', 'sys.objects', 'sys.foreign_keys', 'sys.foreign_key_columns',
  'sys.indexes', 'sys.types', 'sys.tables', 'INFORMATION_SCHEMA.COLUMNS', 'INFORMATION_SCHEMA.TABLES',
  'STRING_SPLIT', 'OPENJSON']);
const TU_KHOA = new Set(['SELECT', 'VALUES', 'SET', 'WHERE', 'OUTPUT', 'INTO', 'AS', 'ON', 'AND', 'OR',
  'GROUP', 'ORDER', 'HAVING', 'UNION', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'CROSS', 'APPLY', 'JOIN',
  'TOP', 'DISTINCT', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'NOT', 'MATCHED', 'BY', 'USING', 'TABLE']);

/* ------------------------------------------------------------------------------------------------
   1. Boc moi TEMPLATE LITERAL (chuoi trong dau nguoc `) ra khoi file JS.
   Quet tung ky tu de khong lay nham backtick nam trong chuoi thuong hoac trong comment.
   ------------------------------------------------------------------------------------------------ */
function bocChuoiNguoc(src) {
  const ds = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i], c2 = src[i + 1];
    if (c === '/' && c2 === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && c2 === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue; }
    if (c === "'" || c === '"') {
      const q = c; i++;
      while (i < n && src[i] !== q) { if (src[i] === '\\') i++; i++; }
      i++; continue;
    }
    if (c === '`') {
      i++;
      let batDau = i, sau = 0;
      while (i < n) {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === '$' && src[i + 1] === '{') { sau++; i += 2; continue; }
        if (sau > 0 && src[i] === '}') { sau--; i++; continue; }
        if (sau === 0 && src[i] === '`') break;
        i++;
      }
      ds.push(src.slice(batDau, i));
      i++; continue;
    }
    i++;
  }
  return ds;
}

/* Thay ${...} bang @@DYN@@ (khong bat dau bang chu/gach duoi nen khong bi nhan la ten bang/cot),
   roi bo comment SQL. */
function lamSachSQL(s) {
  let t = s;
  // thay ${...} ke ca long mot cap
  let truoc;
  do { truoc = t; t = t.replace(/\$\{[^{}]*\}/g, '@@DYN@@'); } while (t !== truoc);
  t = t.replace(/\$\{[\s\S]*?\}/g, '@@DYN@@');
  t = t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ');
  return t;
}
const laSQL = s => /\b(SELECT|INSERT|UPDATE|DELETE|MERGE|ALTER|CREATE)\b/i.test(s);

/* ------------------------------------------------------------------------------------------------
   2. Phan tich MOT chuoi SQL: tra ve {bang:Set, alias:Map, cot:[{bang,cot,alias}]}
   ------------------------------------------------------------------------------------------------ */
function phanTichSQL(sqlText) {
  const s = lamSachSQL(sqlText);
  /* Ten CTE: WITH x AS ( ... ), y AS ( ... )  -> khong phai bang that */
  const cte = new Set();
  const mWith = s.match(/\bWITH\b([\s\S]*)/i);
  if (mWith) {
    [...s.matchAll(/(?:\bWITH\b|,)\s*([A-Za-z_][A-Za-z0-9_]*)\s+AS\s*\(/gi)].forEach(m => cte.add(m[1]));
  }
  /* alias -> bang, chi trong pham vi cau nay. `AS` la tuy chon. */
  const dem = new Map();                       // alias -> Set(bang)
  const reAlias = /\b(?:FROM|JOIN)\s+((?:dbo\.)?[A-Za-z_][A-Za-z0-9_]*)\s+(?:AS\s+)?([A-Za-z_][A-Za-z0-9_]{0,5})\b/gi;
  let m;
  while ((m = reAlias.exec(s))) {
    const bang = m[1].replace(/^dbo\./i, ''), al = m[2];
    if (TU_KHOA.has(al.toUpperCase())) continue;
    if (!dem.has(al)) dem.set(al, new Set());
    dem.get(al).add(bang);
  }
  /* Alias mo ho (mot alias tro 2 bang trong cung cau) -> khong doan. */
  const alias = new Map();
  dem.forEach((tap, al) => { if (tap.size === 1) alias.set(al, [...tap][0]); });

  /* Ten bang: sau FROM / JOIN / INSERT INTO / UPDATE / DELETE FROM / MERGE */
  const bang = new Set();
  const reBang = /\b(?:FROM|JOIN|INSERT\s+INTO|UPDATE|DELETE\s+FROM|MERGE(?:\s+INTO)?)\s+((?:dbo\.)?[A-Za-z_#@][A-Za-z0-9_#@.]*)/gi;
  while ((m = reBang.exec(s))) {
    const t = m[1];
    const bare = t.replace(/^dbo\./i, '');
    if (TU_KHOA.has(bare.toUpperCase())) continue;
    if (/^[#@]/.test(bare)) continue;                 // bang tam / bien bang
    if (bare.includes('@@DYN@@')) continue;           // ten bang dong
    if (cte.has(bare)) continue;                      // CTE
    if (alias.has(bare)) continue;                    // la ALIAS (vd `UPDATE C SET` trong MERGE)
    if (BO_QUA_BANG.has(t) || BO_QUA_BANG.has(bare)) continue;
    if (bare.includes('.')) continue;                 // schema khac -> khong doan
    if (!/^[A-Z]/.test(bare)) continue;               // ten bang trong du an nay luon Hoa dau
    if (bare.length <= 2) continue;                   // 'C', 'T', 'M' -> gan chac la alias/CTE
    bang.add(bare);
  }
  /* Cot: <alias>.<Cot> - chi khi alias duoc rang buoc RO RANG trong CHINH cau nay. */
  const cot = [];
  const reCot = /\b([A-Za-z_][A-Za-z0-9_]{0,5})\.([A-Z][A-Za-z0-9_]*)\b/g;
  while ((m = reCot.exec(s))) {
    const [, al, c] = m;
    if (!alias.has(al)) continue;
    cot.push({ bang: alias.get(al), cot: c, alias: al });
  }
  return { bang, alias, cot, sql: s };
}

/* Cot da co BAO VE DONG trong file (cotAT / .has('x') / COL_LENGTH / tapCot) -> khong bao. */
function cotDuocBaoVe(src) {
  const t = new Set();
  [...src.matchAll(/cotAT\([^,]+,\s*'[A-Za-z0-9_]+',\s*'(\w+)'/g)].forEach(m => t.add(m[1]));
  [...src.matchAll(/cotNhu\([^,]+,\s*'[A-Za-z0-9_]+',\s*'(\w+)'/g)].forEach(m => t.add(m[1]));
  [...src.matchAll(/\.has\('(\w+)'\)/g)].forEach(m => t.add(m[1]));
  [...src.matchAll(/COL_LENGTH\('[^']+'\s*,\s*'(\w+)'\)/g)].forEach(m => t.add(m[1]));
  [...src.matchAll(/coCot\(\s*pool\s*,\s*'[A-Za-z0-9_]+'\s*,\s*'(\w+)'/g)].forEach(m => t.add(m[1]));
  return t;
}

function docFile(duong) {
  const src = fs.readFileSync(duong, 'utf8');
  const baoVe = cotDuocBaoVe(src);
  const cauSQL = bocChuoiNguoc(src).filter(laSQL);
  return { cauSQL: cauSQL.map(phanTichSQL), baoVe, soCau: cauSQL.length };
}

module.exports = { bocChuoiNguoc, lamSachSQL, phanTichSQL, cotDuocBaoVe, docFile };

/* ------------------------------------------------------------------------------------------------ */
if (require.main === module) {
  const { sql, getPool } = require('../db');
  const argv = process.argv.slice(2);
  const CHI_BANG = argv.includes('--bang');
  const CHI_TIET = argv.includes('--chi-tiet');
  const chiFile = argv.filter(a => !a.startsWith('--'));

  (async () => {
    let pool;
    try { pool = await getPool(); }
    catch (err) { console.error('KHONG ket noi duoc CSDL: ' + err.message); process.exit(1); }
    try {
      const dsBangThat = new Set((await pool.request().query(
        `SELECT name FROM sys.objects WHERE type IN ('U','V','TF','IF')`)).recordset.map(r => r.name));
      const capCot = new Map();
      const cotCua = async (b) => {
        if (capCot.has(b)) return capCot.get(b);
        const r = (await pool.request().input('b', sql.NVarChar, b)
          .query('SELECT c.name AS n FROM sys.columns c WHERE c.object_id = OBJECT_ID(@b)')).recordset;
        const set = new Set(r.map(x => x.n));
        capCot.set(b, set);
        return set;
      };

      const thuMuc = [path.join(__dirname, '..', 'routes'), __dirname];
      let files = [];
      thuMuc.forEach(d => {
        if (!fs.existsSync(d)) return;
        files = files.concat(fs.readdirSync(d).filter(f => f.endsWith('.js') && f !== path.basename(__filename))
          .map(f => path.join(d, f)));
      });
      if (chiFile.length) files = files.filter(f => chiFile.some(c => f.endsWith(c)));

      let loiBang = 0, loiCot = 0, demBang = 0, demCot = 0, demCau = 0, boQuaAlias = 0;
      for (const f of files) {
        const { cauSQL, baoVe } = docFile(f);
        demCau += cauSQL.length;
        const sai = new Map();                      // thong bao -> doan SQL dau tien
        for (const q of cauSQL) {
          q.bang.forEach(b => {
            demBang++;
            if (!dsBangThat.has(b)) {
              loiBang++;
              sai.set('BANG khong ton tai: ' + b, q.sql);
            }
          });
          if (CHI_BANG) continue;
          for (const c of q.cot) {
            if (!dsBangThat.has(c.bang)) continue;   // bang sai da bao o tren
            if (baoVe.has(c.cot)) continue;          // da co bao ve dong
            demCot++;
            const set = await cotCua(c.bang);
            if (set.size && !set.has(c.cot)) {
              loiCot++;
              sai.set(`COT khong ton tai: ${c.bang}.${c.cot}   (viet la ${c.alias}.${c.cot})`, q.sql);
            }
          }
          q.alias.forEach(() => {});
        }
        if (sai.size) {
          console.log('');
          console.log('=== ' + path.basename(f));
          for (const [nhan, doan] of sai) {
            console.log('   !! ' + nhan);
            if (CHI_TIET) console.log('      ' + doan.replace(/\s+/g, ' ').trim().slice(0, 300));
          }
        }
      }
      console.log('');
      console.log(`Da quet ${files.length} file, ${demCau} cau SQL, ${demBang} tham chieu bang, ${demCot} tham chieu cot.`);
      console.log(loiBang || loiCot
        ? `>> CO ${loiBang} ten bang sai, ${loiCot} ten cot sai. Chay lai voi --chi-tiet de xem cau SQL.`
        : '>> TAT CA TEN BANG / TEN COT (ma cong cu doc chac chan duoc) DEU DUNG.');
      process.exit(loiBang || loiCot ? 1 : 0);
    } catch (err) {
      console.error('LOI: ' + err.message);
      process.exit(1);
    }
  })();
}
