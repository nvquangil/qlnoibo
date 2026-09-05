/* ================================================================================================
   KIEM CHUNG v7.66 — FORM "THEM MOI" PHAI MO RA TRANG
   ------------------------------------------------------------------------------------------------
   QUY TAC (Nguyen neu 2026-09-05, ap cho MOI form nhap lieu):
     · Mo form de THEM MOI  -> form TRANG. Khong duoc dien san du lieu ban truoc roi bat nguoi dung
       ngoi xoa.
     · NGOAI LE duy nhat: ban dang nhap do CHUA LUU (draft) thi dien lai luon.
   ⚠️ VA KHONG DUOC "sua" bang cach them nut "Xoa trang" — bat nguoi dung don thu le ra khong nen
   hien ra van la bat ho don. Phai sua o CHO MO FORM.

   LOI DA CO THAT: cac man "nhieu ban co ten" (openDocBanList / openBtpBanList) co nut "+ Them" goi
   thang `openOne('')`, ma editor doc ban theo `ISNULL(TenPhieu,'') = ''`. Nen khi da ton tai mot ban
   "(khong ten)", bam "+ Them" MO LAI CHINH BAN CU DO. Nguy hiem hon la chi can quen xoa mot dong roi
   bam Luu la GHI DE mat ban cu.

   Chay:  node utils/kiem_form_them_moi_trang.js
   ================================================================================================ */
const fs = require('fs');
const path = require('path');
const G = path.join(__dirname, '..');
const doc = (p) => fs.readFileSync(path.join(G, p), 'utf8');

let dat = 0, truot = 0;
const OK = (m) => { dat++; console.log('  OK   ' + m); };
const NO = (m) => { truot++; console.log('  SAI  ' + m); };
const kiem = (dk, m, them) => (dk ? OK(m) : NO(m + (them ? '  -> ' + them : '')));
const bang = (thuc, mong, m) => kiem(JSON.stringify(thuc) === JSON.stringify(mong), `${m}  [duoc: ${JSON.stringify(thuc)}]`);
/* `accept="image/*"` chua "/*" -> vo hieu truoc khi bo chu thich, keo nuot mat doan sau. */
const bo = (s) => String(s).replace(/image\/\*/g, 'image_ALL')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const sTlkt = doc('../frontend/js/module.tailieukythuat.js');
const sBtp = doc('../frontend/js/module.bangkebtp.js');
const sIndex = doc('../frontend/index.html');

console.log('\n=== 1. Nut "+ Them" KHONG con goi thang openOne(\'\') ===');
[['module.tailieukythuat.js', sTlkt], ['module.bangkebtp.js', sBtp]].forEach(([ten, src]) => {
  const sach = bo(src);
  kiem(!/addEventListener\('click', \(\) => openOne\(''\)\)/.test(sach),
    `${ten}: khong con "+ Them" mo thang ban ten rong`);
  kiem(/const tra = prompt\(/.test(sach), `${ten}: hoi TEN BAN truoc khi mo form`);
  kiem(/if \(tra === null\) return;/.test(sach), `${ten}: bam Huy o o hoi ten -> khong mo gi`);
  kiem(/daCo\.indexOf\(ten\) !== -1/.test(sach), `${ten}: ten DA CO -> chan, khong mo de ghi de`);
  kiem(/openOne\(ten\)/.test(sach), `${ten}: mo form voi ten VUA DAT (ten moi -> khong tim thay ban -> form trang)`);
  kiem(/KHÔNG TÊN/.test(src), `${ten}: co cau bao rieng cho truong hop da co ban khong ten`);
});

console.log('\n=== 2. CHAY THAT phan quyet dinh (mo hay chan) ===');
/* Cat dung doan xu ly cua nut "+ Them" trong openDocBanList ra chay, voi prompt/toast gia. */
function catNut(src, moc) {
  const i = src.indexOf(moc);
  if (i < 0) return null;
  const mo = src.indexOf('{', i);
  let sau = 1, j = mo + 1, ch = null;
  for (; j < src.length && sau > 0; j++) {
    const c = src[j];
    if (ch) { if (c === ch && src[j - 1] !== '\\') ch = null; continue; }
    if (c === "'" || c === '"' || c === '`') { ch = c; continue; }
    if (c === '{') sau++; else if (c === '}') sau--;
  }
  return sau === 0 ? src.slice(i, j) : null;
}
const than = catNut(sTlkt, "if (addBtn) addBtn.addEventListener('click', () => {");
kiem(!!than, 'cat duoc phan xu ly cua nut "+ Them"');
if (than) {
  const chay = (danhSachBan, goVao) => {
    const daMo = [];
    const daBao = [];
    const f = new Function('phieu', 'title', 'prompt', 'toast', 'openOne', 'addBtn', `
      ${than.replace("if (addBtn) addBtn.addEventListener('click', () => {", 'const chayNut = () => {')
        .replace(/\}\);\s*$/, '};')}
      return chayNut;`)(
      danhSachBan, 'Thống kê chi tiết',
      () => goVao, (m) => daBao.push(m), (t) => daMo.push(t), {}
    );
    f();
    return { daMo, daBao };
  };
  /* a) Chua co ban nao, de trong ten -> MO form trang voi ten rong. */
  bang(chay([], '').daMo, [''], 'chua co ban nao + de trong ten -> mo form (trang)');
  /* b) DA co ban "(khong ten)", lai de trong -> CHAN, khong mo lai ban cu. */
  let r = chay([{ TenPhieu: '' }], '');
  bang(r.daMo, [], 'DA co ban khong ten + de trong -> KHONG mo (khong mo lai ban cu)');
  kiem(/KHÔNG TÊN/.test(r.daBao.join(' ')), 'va bao ro ly do', r.daBao.join(' | '));
  /* c) Ten trung mot ban da co -> CHAN. */
  r = chay([{ TenPhieu: 'Áo' }], 'Áo');
  bang(r.daMo, [], 'ten trung ban da co -> KHONG mo de ghi de');
  kiem(/Đã có bản tên/.test(r.daBao.join(' ')), 'va chi cho nguoi dung mo ban cu', r.daBao.join(' | '));
  /* d) Ten MOI -> mo form voi ten do (editor se khong tim thay ban nao -> TRANG). */
  bang(chay([{ TenPhieu: 'Áo' }], 'Quần').daMo, ['Quần'], 'ten moi -> mo form trang voi ten do');
  /* e) Ten co khoang trang thua -> cat truoc khi so, khong tao ban trung. */
  bang(chay([{ TenPhieu: 'Áo' }], '  Áo  ').daMo, [], 'ten thua khoang trang van nhan ra la trung');
  /* f) Bam Huy o o hoi ten -> khong mo gi. */
  bang(chay([], null).daMo, [], 'bam Huy -> khong mo form nao');
}

console.log('\n=== 3. Ngoai le: ban nhap do CHUA LUU van duoc dien lai ===');
const sKhoVai = doc('../frontend/js/module.khovai.js');
kiem(/loadDraft\(DRAFT_KEY\)/.test(sKhoVai) && /saveDraft\(DRAFT_KEY/.test(sKhoVai),
  'phieu nhap kho vai VAN giu co che khoi phuc ban nhap do (dung ngoai le cua quy tac)');
kiem(/Đã khôi phục dữ liệu nhập kho đang dở/.test(sKhoVai),
  'va bao ro cho nguoi dung biet la du lieu dang do, khong phai ban cu');

console.log('\n=== 4. Bump ?v= ===');
[['module.tailieukythuat.js', 7.66], ['module.bangkebtp.js', 7.66]].forEach(([f, min]) => {
  const v = (sIndex.match(new RegExp(f.replace(/\./g, '\\.') + '\\?v=([\\d.]+)')) || [])[1];
  kiem(v && parseFloat(v) >= min, `index.html: ${f}?v= >= ${min}`, String(v));
});

console.log('\n================================================================');
console.log(`KET QUA: ${dat} dat / ${truot} truot`);
process.exit(truot ? 1 : 0);
