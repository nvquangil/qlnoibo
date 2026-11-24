/* ================================================================================================
   kiem_ton_dau_ky_khong_cong_no.js — bo tu kiem v9.66 (Nguyen 16/11/2026):
   "Trong cong no NCC co Nhap ton kho hang hoa dau ky — cai nay khong tinh vao cong no tra NCC".
   Loai nhap thu ba 'TonDauKy': co don gia (gia von), KHONG NCC, KHONG cong no.
     1. Bien dich.
     2. routes/nhapkho.js: docLoaiNhap nhan TonDauKy; POST/PUT khong bat NCC khi TonDauKy; NCC_ID ghi NULL; chuanDong giu
        don gia cho TonDauKy (chi SanXuat = 0); gia von nap lai cho TonDauKy (POST/PUT/huy/xoa); nhan xuat Excel.
     3. routes/congno.js: cong no NCC (bang tong + so chi tiet) CHI cong LoaiNhap = 'NhaCungCap' -> TonDauKy tu dong ra ngoai.
     4. utils/giaNhapHangHoa.js: BQGQ gom NhaCungCap + TonDauKy, khong SanXuat (chay that voi pool gia).
     5. module.nhapkho.js: option + nhan + payload loaiNhap/nccId; index.html ?v>=9.66; baocao.js nhan chi tiet ton.
   Chay: node backend\utils\kiem_ton_dau_ky_khong_cong_no.js — KHONG dung CSDL.
   ================================================================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const GOC = path.join(__dirname, '..', '..');
const doc = (...p) => fs.existsSync(path.join(GOC, ...p)) ? fs.readFileSync(path.join(GOC, ...p), 'utf8').replace(/\r\n/g, '\n') : '';
let sai = 0, dat = 0;
function kiem(ten, dung, td) {
  if (dung) { dat++; console.log('  ✓ ' + ten); }
  else { sai++; console.log('  ❌ ' + ten + (td ? ' — ' + (typeof td === 'string' ? td : JSON.stringify(td)) : '')); }
}
const boComment = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const canhGac = setTimeout(() => { console.log('\n  ❌ BO KIEM TREO qua 20 s'); process.exit(1); }, 20000);

console.log('\n=== 1. BIEN DICH ===');
['backend/routes/nhapkho.js', 'backend/routes/congno.js', 'backend/utils/giaNhapHangHoa.js', 'frontend/js/module.nhapkho.js'].forEach(f => {
  const s = doc(...f.split('/')); if (!s) { sai++; console.log('  ❌ ' + f + ' KHONG DOC DUOC'); return; }
  try { new vm.Script(s, { filename: f }); dat++; console.log('  ✓ ' + f); } catch (e) { sai++; console.log('  ❌ ' + f + ' VO CU PHAP: ' + e.message); }
});

(async () => {
  console.log('\n=== 2. routes/nhapkho.js — loai TonDauKy ===');
  const nk = boComment(doc('backend', 'routes', 'nhapkho.js'));
  // docLoaiNhap: trich ham ra chay that
  const m = /const docLoaiNhap = \(v\) => (.+?);\n/.exec(nk);
  kiem('co docLoaiNhap', !!m);
  if (m) {
    const docLoaiNhap = (v) => vm.runInNewContext('((v) => ' + m[1].trim() + ')(v)', { v });
    kiem('docLoaiNhap: TonDauKy -> TonDauKy, SanXuat -> SanXuat, rac/undefined -> NhaCungCap', docLoaiNhap('TonDauKy') === 'TonDauKy' && docLoaiNhap('SanXuat') === 'SanXuat' && docLoaiNhap('xyz') === 'NhaCungCap' && docLoaiNhap(undefined) === 'NhaCungCap');
  }
  kiem('POST + PUT dung docLoaiNhap (khong con tam phan 2 loai)', (nk.match(/const loai = docLoaiNhap\(b\.loaiNhap\);/g) || []).length === 2 && !/b\.loaiNhap === 'SanXuat' \? 'SanXuat' : 'NhaCungCap'/.test(nk));
  kiem('chi bat chon NCC khi loai === NhaCungCap (TonDauKy di qua)', (nk.match(/if \(loai === 'NhaCungCap' && !b\.nccId\)/g) || []).length === 2);
  kiem('NCC_ID ghi NULL khi khong phai NhaCungCap (ca INSERT lan UPDATE)', (nk.match(/\.input\('NCC_ID', sql\.Int, loai === 'NhaCungCap' \? \(b\.nccId \|\| null\) : null\)/g) || []).length === 2);
  kiem('chuanDong: don gia = 0 CHI khi SanXuat (TonDauKy giu don gia = gia von)', /const donGia = loai === 'SanXuat' \? 0 : so\(d\.donGia\);/.test(nk));
  kiem('gia von nap lai cho TonDauKy o POST, PUT, huy, xoa (4 cho)', (nk.match(/loai === 'NhaCungCap' \|\| loai === 'TonDauKy'/g) || []).length === 2 && (nk.match(/h\.LoaiNhap === 'NhaCungCap' \|\| h\.LoaiNhap === 'TonDauKy'/g) || []).length === 2);
  kiem('TEN_LOAI_NHAP co 3 loai, Excel danh sach + 1 phieu dung bang nay', /TonDauKy: 'Tồn đầu kỳ \/ nhập khác'/.test(nk) && (nk.match(/TEN_LOAI_NHAP\[(r|h)\.LoaiNhap\]/g) || []).length === 2);

  console.log('\n=== 3. routes/congno.js — cong no NCC chi lay NhaCungCap ===');
  const cn = boComment(doc('backend', 'routes', 'congno.js'));
  const khoiTong = cn.slice(cn.indexOf('async function congNoNCC(pool'), cn.indexOf("router.get('/congnoncc'"));
  const khoiCT = cn.slice(cn.indexOf('async function soChiTietNCC'), cn.indexOf("router.get('/congnoncc/chitiet'"));
  kiem('congNoNCC(): PhieuNhapKhoHang loc p.LoaiNhap = N\'NhaCungCap\' (TonDauKy KHONG vao phai tra)', /FROM PhieuNhapKhoHang p\s+WHERE p\.LoaiNhap = N'NhaCungCap' AND p\.NCC_ID IS NOT NULL/.test(khoiTong));
  kiem('soChiTietNCC(): cung dieu kien (bang tong = so chi tiet)', /FROM PhieuNhapKhoHang p\s+WHERE p\.LoaiNhap = N'NhaCungCap' AND p\.NCC_ID = @id/.test(khoiCT));

  console.log('\n=== 4. utils/giaNhapHangHoa.js — BQGQ gom TonDauKy, khong SanXuat (chay that) ===');
  const Module = require('module');
  const gocLoad = Module._load;
  const sqlGia = new Proxy({}, { get(_, k) { const f = () => k; f.toString = () => String(k); return f; } });
  Module._load = function (ten) { if (ten === '../db') return { sql: sqlGia, getPool: async () => null }; return gocLoad.apply(this, arguments); };
  const { mapGiaNhap } = require(path.join(GOC, 'backend', 'utils', 'giaNhapHangHoa.js'));
  const daChay = [];
  const pool = { request: () => ({ async query(q) { const s = String(q).replace(/\s+/g, ' ').trim(); daChay.push(s); if (/OBJECT_ID\(/.test(s)) return { recordset: [{ t: 1 }] }; return { recordset: [{ MaHangID: 1, SLMua: 10, TienMua: 100000, GiaVon: null, NguonGia: null, MaDHNguon: null }] }; } }) };
  const mp = await mapGiaNhap(pool);
  const cau = daChay.find(x => /OUTER APPLY/.test(x)) || '';
  kiem('cau BQGQ: p.LoaiNhap IN (N\'NhaCungCap\', N\'TonDauKy\'), KHONG co SanXuat, van bo phieu huy + dong tien 0', /p\.LoaiNhap IN \(N'NhaCungCap', N'TonDauKy'\)/.test(cau) && !/SanXuat/.test(cau) && /p\.TrangThai <> N'Đã hủy'/.test(cau) && /ISNULL\(ct\.ThanhTien, 0\) > 0/.test(cau), cau.slice(0, 300));
  kiem('mapGiaNhap van chay: 100.000/10 = 10.000', mp.get(1) && mp.get(1).gia === 10000, mp.get(1));
  Module._load = gocLoad;

  console.log('\n=== 5. giao dien ===');
  const fe = boComment(doc('frontend', 'js', 'module.nhapkho.js'));
  kiem('form: option TonDauKy; apLoai an o NCC/lenh SX, ghi ro "không vào công nợ"; payload loaiNhap = gia tri select, nccId null khi khong phai NhaCungCap',
    /<option value="TonDauKy"/.test(fe) && /const tdk = \$\('#nkfLoai'\)\.value === 'TonDauKy'/.test(fe) && /không vào công nợ/.test(fe) && /loaiNhap: loaiChon,/.test(fe) && /nccId: loaiChon === 'NhaCungCap' \? \(\$\('#nkfNcc'\)\.value \|\| null\) : null/.test(fe) && /loaiChon === 'NhaCungCap' && !\(\$\('#nkfNcc'\) && \$\('#nkfNcc'\)\.value\)/.test(fe));
  kiem('nhanLoai + bo loc danh sach + dau phieu xem/in biet TonDauKy', /l === 'TonDauKy' \? 'Tồn đầu kỳ \/ khác'/.test(fe) && /<option value="TonDauKy">Tồn đầu kỳ \/ khác<\/option>/.test(fe) && /tdk = h\.LoaiNhap === 'TonDauKy'/.test(fe) && /Không gắn NCC — không vào công nợ/.test(fe));
  const html = doc('frontend', 'index.html');
  const v = /module\.nhapkho\.js\?v=([\d.]+)/.exec(html);
  kiem('index.html module.nhapkho.js ?v>=9.66', !!v && parseFloat(v[1]) >= 9.66, v && v[1]);
  kiem('baocao.js chi tiet ton hang hoa ghi nhan "Nhập kho (tồn đầu kỳ / khác)"', /Nhập kho \(tồn đầu kỳ \/ khác\)/.test(doc('backend', 'routes', 'baocao.js')));

  clearTimeout(canhGac);
  console.log(`\n=== KET QUA: ${dat} dat, ${sai} sai ===`);
  process.exit(sai ? 1 : 0);
})().catch(e => { console.error('VO: ' + (e && e.stack || e)); process.exit(1); });
