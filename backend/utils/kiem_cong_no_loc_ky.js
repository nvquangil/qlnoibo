/* ================================================================================================
   kiem_cong_no_loc_ky.js  —  bo tu kiem cho v9.17
   "Phan he Cong no: loc tu ngay - den ngay + chon Thang/Quy/Nam o MOI chuc nang; so TONG cua
    danh sach tinh tu dung cac dong dang loc."

   Chay:  node backend\utils\kiem_cong_no_loc_ky.js
   KHONG copy file nay sang D:\QLSX.
   ================================================================================================ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const GOC = path.join(__dirname, '..', '..');
const fe = fs.readFileSync(path.join(GOC, 'frontend', 'js', 'module.congno.js'), 'utf8');
const html = fs.readFileSync(path.join(GOC, 'frontend', 'index.html'), 'utf8');
let sai = 0, dat = 0;
function kiem(ten, dung, td) {
  if (dung) { dat++; console.log('  ✓ ' + ten); }
  else { sai++; console.log('  ❌ ' + ten + (td ? ' — ' + td : '')); }
}

console.log('\n=== 1. BIEN DICH (thay cho node --check) ===');
try { new vm.Script(fe, { filename: 'module.congno.js' }); dat++; console.log('  ✓ module.congno.js'); }
catch (e) { sai++; console.log('  ❌ module.congno.js VO CU PHAP: ' + e.message); }

console.log('\n=== 2. KIEM HANH VI dsKyNhanh / trongKy (trich ham, chay that) ===');
function trichHam(nguon, ten) {
  const i = nguon.indexOf('function ' + ten + '(');
  if (i < 0) return null;
  let mo = 0, j = nguon.indexOf('{', i);
  if (j < 0) return null;
  for (; j < nguon.length; j++) {
    if (nguon[j] === '{') mo++;
    else if (nguon[j] === '}') { mo--; if (mo === 0) return nguon.slice(i, j + 1); }
  }
  return null;
}
const thanKy = trichHam(fe, 'dsKyNhanh');
const thanTK = trichHam(fe, 'trongKy');
kiem('tim thay dsKyNhanh + trongKy', !!thanKy && !!thanTK);
if (thanKy && thanTK) {
  let dsKyNhanh = null, trongKy = null;
  try {
    const s = {};
    vm.runInNewContext(thanKy + ';' + thanTK + '; __k = dsKyNhanh; __t = trongKy;', s);
    dsKyNhanh = s.__k; trongKy = s.__t;
  } catch (e) { sai++; console.log('  ❌ khong nap duoc ham: ' + e.message); }
  if (dsKyNhanh && trongKy) {
    const ky = dsKyNhanh(new Date(2026, 10, 4));   // 04/11/2026 (thang 11)
    const CA = [
      ['thang[0] = Thang 11/2026, 01 -> 30 (thang 30 ngay)',
        () => ky.thang[0].nhan === 'Tháng 11/2026' && ky.thang[0].tu === '2026-11-01' && ky.thang[0].den === '2026-11-30'],
      ['thang[1] = Thang 10/2026, den 31 (thang 31 ngay)',
        () => ky.thang[1].den === '2026-10-31'],
      ['vong NAM: thang[11] = Thang 12/2025',
        () => ky.thang[11].nhan === 'Tháng 12/2025' && ky.thang[11].tu === '2025-12-01' && ky.thang[11].den === '2025-12-31'],
      ['quy[0] = Quy 4/2026 (01/10 -> 31/12)',
        () => ky.quy[0].nhan === 'Quý 4/2026' && ky.quy[0].tu === '2026-10-01' && ky.quy[0].den === '2026-12-31'],
      ['vong nam cua QUY: quy[4] = Quy 4/2025',
        () => ky.quy[4].nhan === 'Quý 4/2025' && ky.quy[4].tu === '2025-10-01'],
      ['quy 1 ket thuc 31/03 (thang 3 co 31 ngay)',
        () => ky.quy[3].nhan === 'Quý 1/2026' && ky.quy[3].tu === '2026-01-01' && ky.quy[3].den === '2026-03-31'],
      ['nam[0] = Nam 2026 tron nam',
        () => ky.nam[0].tu === '2026-01-01' && ky.nam[0].den === '2026-12-31' && ky.nam.length === 4],
      ['NAM NHUAN: thang 2/2028 den 29/02',
        () => { const k2 = dsKyNhanh(new Date(2028, 2, 15)); return k2.thang[1].nhan === 'Tháng 2/2028' && k2.thang[1].den === '2028-02-29'; }],
      ['du 12 thang + 8 quy', () => ky.thang.length === 12 && ky.quy.length === 8],
      ['trongKy: khong loc -> moi dong qua', () => trongKy('2020-01-01', { tu: '', den: '' }) && trongKy(null, null)],
      ['trongKy: ISO datetime cat 10 ky tu dau (quy uoc san co cua file)',
        () => trongKy('2026-10-15T00:00:00.000Z', { tu: '2026-10-01', den: '2026-10-31' })],
      ['trongKy: bien KY — dung ngay dau/cuoi deu TRONG ky',
        () => trongKy('2026-10-01', { tu: '2026-10-01', den: '2026-10-31' }) && trongKy('2026-10-31', { tu: '2026-10-01', den: '2026-10-31' })],
      ['trongKy: ngoai ky -> loai', () => !trongKy('2026-11-01', { tu: '2026-10-01', den: '2026-10-31' })],
      ['trongKy: chi co TU -> moi ngay >= tu', () => trongKy('2027-01-01', { tu: '2026-10-01', den: '' }) && !trongKy('2026-09-30', { tu: '2026-10-01', den: '' })],
      ['trongKy: dong KHONG co ngay khi dang loc -> loai (khong cong vao tong)',
        () => !trongKy('', { tu: '2026-10-01', den: '' }) && !trongKy(null, { tu: '', den: '2026-10-31' })]
    ];
    CA.forEach(([ten, phep]) => { let ok = false; try { ok = phep(); } catch (e) { ok = false; } kiem(ten, ok); });
    kiem('dsKyNhanh KHONG dung toISOString (lech 1 ngay voi gio VN)', !thanKy.includes('toISOString'));
  }
}

console.log('\n=== 3. BA DANH SACH: bang + TONG tinh tu dong dang loc ===');
kiem('ca ba bang ve tu rowsLoc.map (phieu thu / phieu chi / dieu chinh)',
     (fe.match(/<tbody>\$\{rowsLoc\.map\(r => `<tr>/g) || []).length === 3,
     'con bang nao ve tu rows.map la bang do khong theo loc');
kiem('TONG phieu thu + phieu chi + CPKD + dieu chinh deu reduce tren rowsLoc',
     (fe.match(/rowsLoc\.reduce\(\(s, r\) => s \+ \(Number\(r\.SoTien\) \|\| 0\), 0\)/g) || []).length === 3
       && /rowsLoc\.filter\(r => r\.TinhChiPhiKD\)\.reduce/.test(fe));
kiem('ba danh sach noi day ganLocNgay voi dung khoa kyLocDS',
     /ganLocNgay\(body, 'pt', 'thu', \(\) => renderPhieuThu\(perm\)\)/.test(fe)
       && /ganLocNgay\(body, 'pc', 'chi', \(\) => renderPhieuChi\(perm\)\)/.test(fe)
       && /ganLocNgay\(body, 'dc', 'dc', \(\) => renderDieuChinh\(perm\)\)/.test(fe));
kiem('loc theo DUNG cot ngay tung man: NgayThu / NgayChi / Ngay',
     /rows\.filter\(r => trongKy\(r\.NgayThu, kyThu\)\)/.test(fe)
       && /rows\.filter\(r => trongKy\(r\.NgayChi, kyChi\)\)/.test(fe)
       && /rows\.filter\(r => trongKy\(r\.Ngay, kyDC\)\)/.test(fe));
kiem('nhan TONG noi ro "(đang lọc ngày)" + dem X/Y phieu khi loc',
     (fe.match(/\(đang lọc ngày\)/g) || []).length >= 3);
kiem('nut xuat Excel noi ro KHONG ap loc (route /export chua nhan ky)',
     (fe.match(/KHÔNG áp lọc ngày đang chọn/g) || []).length === 2);

console.log('\n=== 4. KY NHANH gan vao 5 khoi ky co san + 3 danh sach ===');
kiem('5 khoi so chi tiet co o ky nhanh (ct x2, gc, q, so)',
     (fe.match(/oKyNhanhHtml\('ctKyNhanh'\)/g) || []).length === 2
       && /oKyNhanhHtml\('gcKyNhanh'\)/.test(fe) && /oKyNhanhHtml\('qKyNhanh'\)/.test(fe)
       && /oKyNhanhHtml\('soKyNhanh'\)/.test(fe));
kiem('noi day du 5 khoi: KH + NCC (bam ho Loc), GC + Quy (xem lai so), So chi tiet (chi dien o)',
     (fe.match(/ganKyNhanh\(modal, 'ctKyNhanh', 'ctTuNgay', 'ctDenNgay', locKy\)/g) || []).length === 2
       && /ganKyNhanh\(modal, 'gcKyNhanh', 'gcTuNgay', 'gcDenNgay'/.test(fe)
       && /ganKyNhanh\(modal, 'qKyNhanh', 'qTuNgay', 'qDenNgay'/.test(fe)
       && /ganKyNhanh\(modal, 'soKyNhanh', 'soTuNgay', 'soDenNgay', null\)/.test(fe));
kiem('khoiLocNgayHtml co du: ky nhanh + 2 o ngay + nut bo loc khi dang loc',
     /oKyNhanhHtml\(pre \+ 'KyNhanh'\)/.test(fe) && /id="\$\{pre\}Tu"/.test(fe)
       && /id="\$\{pre\}BoLoc"/.test(fe));
kiem('doi tay o ngay cung di qua apDung (chan tu > den bang toast)',
     /if \(tu && den && tu > den\) \{ toast\('Từ ngày phải nhỏ hơn hoặc bằng đến ngày\.', 'error'\); return; \}[\s\S]{0,80}?kyLocDS\[khoa\] = \{ tu: tu \|\| '', den: den \|\| '' \};/.test(fe));

console.log('\n=== 5. BUMP ===');
kiem('index.html bump module.congno.js?v=9.17', html.includes('module.congno.js?v=9.17'));

console.log('\n' + '='.repeat(70));
console.log(sai === 0 ? `✅ ${dat} phep DAT, 0 sai` : `❌ ${sai} SAI / ${dat + sai} phep`);
console.log('='.repeat(70) + '\n');
process.exit(sai === 0 ? 0 : 1);
