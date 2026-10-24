/* ================================================================================================
   KIEM CHUNG v9.01 — O TIM KY TU BAT KY o 5 danh sach phieu
   ------------------------------------------------------------------------------------------------
   Nguyen 2026-10-24: "thẻ kho hàng hóa: phiếu nhập thêm tìm kiếm ký tự bất kỳ. thẻ kho vải, thẻ kho
   phụ kiện: phiếu nhập kho, phiếu xuất kho thêm tìm kiếm ký tự bất kỳ".

   Dung CHUNG searchBoxHtml() + wireTableSearch() cua common.js (tach tu, khop het, dong TONG khong
   an). HAI CHO DE SAI:
     1. id o searchBoxHtml va wireTableSearch phai KHOP nhau, va infoId phai co <span id=...>.
     2. Cot Thao tac phai gan data-notim — khong thi go "Xem" / "Sua" ra nguyen bang.

   Chay:  node backend\utils\kiem_tim_kiem_phieu.js   (tu thu muc goc QLNoiBo)
   ================================================================================================ */
const fs = require('fs');
const path = require('path');
const G = path.join(__dirname, '..');
const doc = (p) => fs.readFileSync(path.join(G, p), 'utf8');

let dat = 0, truot = 0;
const OK = (m) => { dat++; console.log('  OK   ' + m); };
const NO = (m) => { truot++; console.log('  SAI  ' + m); };
const kiem = (dk, m) => (dk ? OK(m) : NO(m));

function catKhoi(s, moc, mo, dong) {
  const i = s.indexOf(moc);
  if (i < 0) return '';
  let d = 0;
  for (let k = s.indexOf(mo, i); k < s.length; k++) {
    if (s[k] === mo) d++;
    else if (s[k] === dong) { d--; if (!d) return s.slice(i, k + 1); }
  }
  return '';
}

const sCommon = doc('../frontend/js/common.js');
const sIndex = doc('../frontend/index.html');
kiem(/^function searchBoxHtml\(id, goiY\)/m.test(sCommon) && /^function wireTableSearch\(body, id, opts\)/m.test(sCommon),
  'common.js: searchBoxHtml(id, goiY) + wireTableSearch(body, id, opts) con nguyen chu ky');
kiem(/hasAttribute\('data-notim'\)/.test(sCommon), 'common.js: wireTableSearch bo qua o data-notim');

const DS = [
  { file: '../frontend/js/module.nhapkho.js', ham: 'async function taiBang', id: 'nkTim', nhan: 'Thẻ kho hàng hóa → Phiếu nhập kho' },
  { file: '../frontend/js/module.khovai.js', ham: 'async function renderNhap', id: 'kvNhapTim', nhan: 'Kho vải → Phiếu nhập kho' },
  { file: '../frontend/js/module.khovai.js', ham: 'async function renderXuat', id: 'kvXuatTim', nhan: 'Kho vải → Phiếu xuất kho' },
  { file: '../frontend/js/module.phukien.js', ham: 'async function renderPhieuNhap', id: 'pkNhapTim', nhan: 'Kho phụ kiện → Phiếu nhập kho' },
  { file: '../frontend/js/module.phukien.js', ham: 'async function renderPhieuXuat', id: 'pkXuatTim', nhan: 'Kho phụ kiện → Phiếu xuất kho' }
];
DS.forEach(d => {
  console.log(`\n=== ${d.nhan} (${path.basename(d.file)} :: ${d.ham}) ===`);
  const s = doc(d.file);
  const fn = catKhoi(s, d.ham, '{', '}');
  kiem(fn.length > 0, 'trich duoc ham');
  kiem(new RegExp("searchBoxHtml\\('" + d.id + "', '").test(fn), `o tim: searchBoxHtml('${d.id}', goi y)`);
  kiem(new RegExp('<span id="' + d.id + 'Info" class="empty-hint"').test(fn), `co <span id="${d.id}Info"> de bao "Hien x/y dong"`);
  kiem(new RegExp("wireTableSearch\\([a-zA-Z]+, '" + d.id + "', \\{ infoId: '" + d.id + "Info' \\}\\)").test(fn), `wireTableSearch(..., '${d.id}', { infoId: '${d.id}Info' })`);
  /* wireTableSearch phai chay SAU khi innerHTML da dung (bang da co trong DOM). */
  const iHtml = fn.indexOf('innerHTML = `'), iWire = fn.indexOf("wireTableSearch(");
  kiem(iHtml >= 0 && iWire > iHtml, 'wireTableSearch goi SAU khi ve bang');
  kiem(/<td data-notim>/.test(fn), 'cot Thao tac gan data-notim (chu tren nut khong vao chuoi tim)');
  /* Khong duoc co hai o cung id trong mot ham (vd copy nham). */
  kiem((fn.match(new RegExp("searchBoxHtml\\('" + d.id + "'", 'g')) || []).length === 1, 'dung MOT o tim trong ham');
});

console.log('\n=== index.html ===');
['module.nhapkho.js', 'module.khovai.js', 'module.phukien.js'].forEach(f => {
  const v = parseFloat((sIndex.match(new RegExp(f.replace(/\./g, '\\.') + '\\?v=([\\d.]+)')) || [])[1] || 0);
  kiem(v >= 9.01, `${f}?v= >= 9.01  [duoc: ${v}]`);
});

console.log(`\n=== KET QUA: ${dat} dat, ${truot} sai ===`);
process.exit(truot ? 1 : 0);
