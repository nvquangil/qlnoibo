/* ================================================================================================
   kiem_tat_ca.js — CHAY MOI BO TU KIEM kiem_*.js trong thu muc nay, in bang tong ket.

   Vi sao co file nay (12/11/2026): v9.45 doi payroll.js nhung danh sach "buoc 2" trong tai lieu
   trien khai chi liet ke bo kiem cua DOT DO — 4 phep cua kiem_ho_so_nhan_su.js do suot mot ngay ma
   khong ai chay. Tu nay chay MOT lenh:

       node backend\utils\kiem_tat_ca.js            (chay tren thu muc C:\ — ban sua, KHONG phai D:\)
       node backend\utils\kiem_tat_ca.js --nhanh    bo qua 3 bo can CSDL that

   Bo nao can CSDL that (co getPool) thi tu no noi khi khong ket noi duoc — day la bo kiem DU LIEU,
   khong phai bo kiem MA; --nhanh de khi chi muon kiem ma truoc deploy.
   Ma thoat: 0 neu moi bo deu 0; 1 neu co bo do. Khong chay chinh no.
   ================================================================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const THU_MUC = __dirname;
const CAN_CSDL = ['kiem_cot_migration.js', 'kiem_ten_bang_cot.js', 'kiem_ton_am.js'];
const nhanh = process.argv.includes('--nhanh');
const chiTiet = process.argv.includes('--chi-tiet');   // in nguyen output cua tung bo, ke ca bo xanh

const ds = fs.readdirSync(THU_MUC)
  .filter(f => /^kiem_.*\.js$/i.test(f) && f !== path.basename(__filename))
  .filter(f => !(nhanh && CAN_CSDL.includes(f)))
  .sort();

console.log(`Chay ${ds.length} bo tu kiem trong ${THU_MUC}${nhanh ? ' (--nhanh: bo ' + CAN_CSDL.join(', ') + ')' : ''}\n`);
const kq = [];
for (const f of ds) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [path.join(THU_MUC, f)], { cwd: THU_MUC, encoding: 'utf8', timeout: 120000 });
  const ms = Date.now() - t0;
  const out = (r.stdout || '') + (r.stderr || '');
  const ma = r.status == null ? -1 : r.status;        // null = bi giet (timeout / tin hieu)
  /* Dem dong ket qua: cac bo in "  ❌ " / "  SAI  " cho phep do — dem de bao cao, khong thay cho ma thoat. */
  const soDo = (out.match(/^\s*(❌|SAI)\s/gm) || []).length;
  /* 14/11: 9 bo can jsdom (DOM that) — may khong cai thi la BO QUA (thieu moi truong), KHONG phai do.
     Cai mot lan: cd backend && npm install --no-save jsdom   (khong ghi vao package.json, may chu khong can). */
  const thieuJsdom = /Cannot find module 'jsdom'/.test(out);
  kq.push({ f, ma, ms, soDo, out, thieuJsdom });
  /* Bo cu co the in phep SAI ma van thoat 0 (khong goi process.exit(1)) — dem ca hai, de khong lot. */
  const do1 = !thieuJsdom && (ma !== 0 || soDo > 0);
  const nhan = thieuJsdom ? 'BOQUA' : (!do1 ? 'XANH ' : (ma === -1 ? 'KET  ' : 'DO   '));
  console.log(`${nhan} ${f.padEnd(44)} ${thieuJsdom ? 'can jsdom' : 'ma=' + ma}${soDo && !thieuJsdom ? '  phep do=' + soDo : ''}  ${(ms / 1000).toFixed(1)}s`);
  if (chiTiet || do1) {
    /* Bo do: in 40 dong cuoi (ket qua + dong tong) de khoi phai chay lai tung bo. */
    const dong = out.split(/\r?\n/).filter(Boolean);
    const in_ = chiTiet ? dong : dong.filter(d => /❌|SAI|KET QUA|phep|sai|Error|error/.test(d)).slice(-40);
    in_.forEach(d => console.log('      ' + d));
  }
}
const boQua = kq.filter(x => x.thieuJsdom);
const do_ = kq.filter(x => !x.thieuJsdom && (x.ma !== 0 || x.soDo > 0));
console.log('\n' + '='.repeat(78));
console.log(do_.length === 0
  ? `✅ ${kq.length - boQua.length}/${kq.length - boQua.length} bo XANH`
  : `❌ ${do_.length}/${kq.length - boQua.length} bo DO: ${do_.map(x => x.f).join(', ')}`);
if (boQua.length) console.log(`⏭ ${boQua.length} bo BO QUA vi thieu jsdom (${boQua.map(x => x.f).join(', ')}) — cai mot lan: cd backend && npm install --no-save jsdom`);
console.log('='.repeat(78));
process.exit(do_.length ? 1 : 0);
