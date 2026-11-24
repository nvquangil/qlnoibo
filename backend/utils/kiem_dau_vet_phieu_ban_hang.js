/* ================================================================================================
   kiem_dau_vet_phieu_ban_hang.js — bo tu kiem cho v9.46 (phieu ban hang: nguoi lap + luc lap, nguoi
   sua + luc sua cuoi — Nguyen 11/11/2026)

   Chay:  node backend\utils\kiem_dau_vet_phieu_ban_hang.js
   KHONG copy sang D:\QLSX. KHONG dung toi CSDL.
   ================================================================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const GOC = path.join(__dirname, '..', '..');
const doc = (...p) => fs.existsSync(path.join(GOC, ...p)) ? fs.readFileSync(path.join(GOC, ...p), 'utf8') : '';
let sai = 0, dat = 0;
function kiem(ten, dung, td) {
  if (dung) { dat++; console.log('  ✓ ' + ten); }
  else { sai++; console.log('  ❌ ' + ten + (td ? ' — ' + td : '')); }
}
const boComment = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const fBE = doc('backend', 'routes', 'banhang.js');
const fFE = doc('frontend', 'js', 'module.khohang.js');
const mig = doc('database', 'migration_v891.sql');
const full = doc('database', 'CAI_DAT_DAY_DU.sql');
const html = doc('frontend', 'index.html');

console.log('\n=== 1. BIEN DICH (vm.Script) ===');
[['backend/routes/banhang.js', fBE], ['frontend/js/module.khohang.js', fFE]].forEach(([f, s]) => {
  if (!s) { sai++; console.log('  ❌ ' + f + ' KHONG DOC DUOC'); return; }
  try { new vm.Script(s, { filename: f }); dat++; console.log('  ✓ ' + f); }
  catch (e) { sai++; console.log('  ❌ ' + f + ' VO CU PHAP: ' + e.message); }
});

console.log('\n=== 2. HANH VI: fmtLucPhieu (ham thuan, lay nguyen van tu module.khohang.js) ===');
{
  /* Ham 4 dong, khong co ngoac lồng — bat bang regex chat, KHONG dem ngoac. Doi ham thi sua ca day. */
  const m = /function fmtLucPhieu\(s\) \{\r?\n\s*const m = [^\r\n]+\r?\n\s*return [^\r\n]+\r?\n\s*\}/.exec(fFE);
  kiem('tim thay fmtLucPhieu trong module.khohang.js', !!m);
  if (m) {
    const fmt = new Function(m[0] + '; return fmtLucPhieu;')();
    kiem("'2026-11-11 14:05' -> '14:05 ngày 11/11/2026'", fmt('2026-11-11 14:05') === '14:05 ngày 11/11/2026', fmt('2026-11-11 14:05'));
    kiem("dang ISO '2026-01-02T08:09:10' cung doc duoc", fmt('2026-01-02T08:09:10') === '08:09 ngày 02/01/2026', fmt('2026-01-02T08:09:10'));
    kiem('null / rong -> chuoi rong, khong no', fmt(null) === '' && fmt('') === '');
    kiem('chuoi la -> tra nguyen, khong bia so', fmt('hom qua') === 'hom qua');
  }
}

console.log('\n=== 3. MAY CHU (banhang.js) ===');
const codeBE = boComment(fBE);
kiem('do cot NguoiSuaID + UpdatedAt moi lan, khong cache', /async function coCotSuaPhieuBH\(pool\) \{\s*const r = \(await pool\.request\(\)\.query\("SELECT COL_LENGTH\('PhieuBanHang','NguoiSuaID'\) AS a, COL_LENGTH\('PhieuBanHang','UpdatedAt'\) AS b"\)\)/.test(codeBE)
  && !/let __coCotSuaPhieuBH/.test(codeBE));
kiem('GET /phieu/:id tra TaoLuc = CONVERT(varchar(16), CreatedAt, 120) — CHUOI, khong qua Date (useUTC)', /CONVERT\(varchar\(16\), p\.CreatedAt, 120\) AS TaoLuc/.test(codeBE));
kiem('GET /phieu/:id tra NguoiSua + SuaLuc khi co cot, CAST NULL khi chua', /us\.HoTen AS NguoiSua, CONVERT\(varchar\(16\), p\.UpdatedAt, 120\) AS SuaLuc/.test(codeBE) && /CAST\(NULL AS NVARCHAR\(100\)\) AS NguoiSua, CAST\(NULL AS varchar\(16\)\) AS SuaLuc/.test(codeBE)
  && /LEFT JOIN Users us ON us\.UserID = p\.NguoiSuaID/.test(codeBE));
kiem('ghiDauVetSuaPhieuBH ghi NguoiSuaID + UpdatedAt=SYSDATETIME() trong GIAO DICH (new sql.Request(tran))', /async function ghiDauVetSuaPhieuBH\(pool, tran, phieuBHID, userId\)/.test(codeBE)
  && /new sql\.Request\(tran\)\.input\('p', sql\.Int, phieuBHID\)\.input\('u', sql\.Int, userId \|\| null\)\s*\.query\('UPDATE PhieuBanHang SET NguoiSuaID = @u, UpdatedAt = SYSDATETIME\(\) WHERE PhieuBHID = @p'\)/.test(codeBE));
kiem('PUT /phieu/:id (sua) VA PUT /phieu/:id/huy deu ghi dau vet — dung 2 cho goi', (codeBE.match(/await ghiDauVetSuaPhieuBH\(pool, tran, /g) || []).length === 2);
{
  /* Dau vet SUA phai nam TRUOC tran.commit() cua route sua, va o route huy nam SAU dong UPDATE TrangThai. */
  const iPut = codeBE.indexOf("router.put('/phieu/:id', requireAuth");
  const iHuy = codeBE.indexOf("router.put('/phieu/:id/huy'");
  const iGoiSua = codeBE.indexOf('await ghiDauVetSuaPhieuBH(pool, tran, p.PhieuBHID', iPut);
  const iCommitSua = codeBE.indexOf('await tran.commit()', iPut);
  const iGoiHuy = codeBE.indexOf('await ghiDauVetSuaPhieuBH(pool, tran, parseInt(req.params.id, 10)', iHuy);
  const iUpdHuy = codeBE.indexOf("SET TrangThai = N'Đã hủy' WHERE PhieuBHID = @id", iHuy);
  const iCommitHuy = codeBE.indexOf('await tran.commit()', iHuy);
  kiem('route sua: goi dau vet TRUOC commit', iPut > -1 && iGoiSua > iPut && iCommitSua > iGoiSua);
  kiem('route huy: goi dau vet SAU khi doi trang thai, TRUOC commit', iHuy > -1 && iUpdHuy > iHuy && iGoiHuy > iUpdHuy && iCommitHuy > iGoiHuy);
}
kiem('POST /phieu van ghi NguoiTaoID = user dang nhap (nguoi lap = ten user)', /\.input\('NguoiTaoID', sql\.Int, user\.userId\)/.test(codeBE));

console.log('\n=== 4. GIAO DIEN (module.khohang.js) ===');
const codeFE = boComment(fFE);
// Sau boComment, khoi chu thich-trong-template giua nhan va ten con lai "${''}" — cho phep no o giua.
kiem('ban in: duoi o "Người làm phiếu" co ten nguoi lap + "Lập lúc"', /<div class="line">Người làm phiếu<\/div>\s*(\$\{''\}\s*)?\$\{h\.NguoiTao \|\| h\.TaoLuc \? `[^`]*\$\{escapeHtml\(h\.NguoiTao \|\| ''\)\}[\s\S]{0,160}?Lập lúc \$\{escapeHtml\(fmtLucPhieu\(h\.TaoLuc\)\)\}/.test(codeFE));
kiem('ban in: phieu da sua co dong "Sửa lần cuối: ai — lúc nào"', /Sửa lần cuối: \$\{escapeHtml\(h\.NguoiSua \|\| ''\)\} — \$\{escapeHtml\(fmtLucPhieu\(h\.SuaLuc\)\)\}/.test(codeFE));
kiem('man xem phieu: Nguoi lap kem luc lap + dong Sua lan cuoi', /<b>Người lập:<\/b> \$\{escapeHtml\(h\.NguoiTao \|\| ''\)\}\$\{h\.TaoLuc \?/.test(codeFE) && /<b>Sửa lần cuối:<\/b> \$\{escapeHtml\(h\.NguoiSua \|\| ''\)\} \(\$\{fmtLucPhieu\(h\.SuaLuc\)\}\)/.test(codeFE));
kiem('index.html bump module.khohang.js >= 9.46', (() => { const x = /module\.khohang\.js\?v=([\d.]+)/.exec(html); return !!x && parseFloat(x[1]) >= 9.46; })());

console.log('\n=== 5. MIGRATION ===');
kiem('migration_v891: them NguoiSuaID + UpdatedAt, co IF COL_LENGTH (chay lai duoc)', /IF COL_LENGTH\('PhieuBanHang', 'NguoiSuaID'\) IS NULL/.test(mig) && /ADD NguoiSuaID INT NULL/.test(mig)
  && /IF COL_LENGTH\('PhieuBanHang', 'UpdatedAt'\) IS NULL/.test(mig) && /ADD UpdatedAt DATETIME2 NULL/.test(mig));
kiem('migration_v891 KHONG xoa/sua du lieu', !/DELETE FROM|DROP (TABLE|COLUMN)|UPDATE PhieuBanHang SET/i.test(mig));
kiem('CAI_DAT_DAY_DU.sql da gop migration_v891 (dong [i/N], truoc dong CAI DAT XONG)', (() => {
  // [i/N] do tao_file_cai_dat.js sinh — khong khoa cung so, them migration sau la lech.
  const m = /\[\d+\/\d+\]\s+migration_v891\.sql/.exec(full);
  const i = m ? m.index : -1, j = full.indexOf('=== CAI DAT XONG');
  return i > -1 && j > i && /ADD NguoiSuaID INT NULL/.test(full.slice(i, j)) && /ADD UpdatedAt DATETIME2 NULL/.test(full.slice(i, j));
})());

console.log(`\n=== KET QUA: ${dat} dat, ${sai} sai ===`);
process.exit(sai ? 1 : 0);
