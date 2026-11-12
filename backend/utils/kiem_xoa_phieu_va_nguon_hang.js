/* ================================================================================================
   kiem_xoa_phieu_va_nguon_hang.js  —  bo tu kiem cho v9.15 (2 viec, cung backend/routes/nhapkho.js)

   (1) XOA PHIEU NHAP KHO doi luat chan: tu "ma co phieu ban la khoa" sang "chi chan khi xoa xong
       thi DA BAN > NHAP CON LAI (ca hai quy ve CAI)".
   (2) NGUON HANG theo loai phieu: phieu TU SAN XUAT => ma moi mang LoaiHang 'NhaSanXuat'; ma da co
       dang 'DatNgoai' duoc NANG len (mot chieu, trong transaction cua phieu).

   Logic nam trong SQL cua route (khong co ham thuan de trich chay) nen cac phep duoi la KIEM CAU
   TRUC — viet SAU CUNG tren ban ma da dung yen, moi regex da doi chieu voi van ban that cua file.
   Chay:  node backend\utils\kiem_xoa_phieu_va_nguon_hang.js
   KHONG copy file nay sang D:\QLSX.
   ================================================================================================ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const FILE = path.join(__dirname, '..', 'routes', 'nhapkho.js');
let sai = 0, dat = 0;
function kiem(ten, dung, td) {
  if (dung) { dat++; console.log('  ✓ ' + ten); }
  else { sai++; console.log('  ❌ ' + ten + (td ? ' — ' + td : '')); }
}
const src = fs.readFileSync(FILE, 'utf8');

console.log('\n=== 1. BIEN DICH (thay cho node --check) ===');
try { new vm.Script(src, { filename: 'nhapkho.js' }); dat++; console.log('  ✓ backend/routes/nhapkho.js'); }
catch (e) { sai++; console.log('  ❌ nhapkho.js VO CU PHAP: ' + e.message); }

console.log('\n=== 2. GUARD XOA PHIEU: chan theo TON SAU XOA, khong theo ma hang ===');
kiem('🔴 DON VI: hai ve cung DON VI CHINH — gop = SUM(SoLuongChinh) THO, khop voi TonCai cua view',
     src.includes('SUM(ct.SoLuongChinh) AS GopSL'),
     'vw_TonTheoMau.TonCai TEN la Cai nhung LUU theo don vi chinh (vw_NhapKhoTuPhieu cong tho ' +
     'SoLuongChinh; banhang.js tru ton bang slChinh) — quy mot ve ve cai la ma Ri chan oan gap he so lan');
kiem('KHONG dung QUY_VE_CAI trong guard (bai hoc ra soat cheo v9.15)',
     !src.includes('SUM(${QUY_VE_CAI})') && !/,\s*QUY_VE_CAI\s*\}\s*=\s*require/.test(src));
kiem('so voi TON THAT cua view (vw_TonTheoMau.TonCai) — khong tu cong lai cong thuc ton',
     /LEFT JOIN vw_TonTheoMau t ON t\.MaHangID = gop\.MaHangID AND t\.MauSacID = gop\.MauSacID/.test(src),
     'tu cong "nhap tu phieu - da ban" la bo sot the kho tay + nhap lai => chan oan kieu moi');
kiem('dieu kien chan: ton sau xoa AM, va chi xet dong phieu co gop that (GopSL > 0)',
     /WHERE gop\.GopSL > 0 AND ISNULL\(t\.TonCai, 0\) - gop\.GopSL < 0/.test(src));
kiem('phieu DA HUY xoa thang — khong kiem (gop cua no da ngoai ton, kiem la tru hai lan)',
     /if \(h\.TrangThai !== 'Đã hủy'\) \{/.test(src));
kiem('cau tu choi noi RO CON SO + DON VI THAT cua ma (khong ghi cung "cái")',
     src.includes('TỒN BỊ ÂM') && /tồn hiện ' \+ \(Number\(v\.TonCai\) \|\| 0\)/.test(src)
       && /phiếu này góp ' \+ \(Number\(v\.GopSL\) \|\| 0\)/.test(src)
       && /String\(v\.DonViCoBan \|\| ''\)\.trim\(\) \|\| 'cái'/.test(src));
kiem('chi duong thoat: huy phieu thay vi xoa',
     /dùng HỦY phiếu \(giữ lại phiếu, tồn tự trừ\) thay vì XÓA/.test(src));
kiem('luat cu da go: khong con cau "hàng đã xuất bán" (chan theo ton tai phieu ban)',
     !src.includes('hàng đã xuất bán'));
kiem('guard chi o DELETE — route /huy giu nguyen khong guard (v6.91)',
     (src.match(/TỒN BỊ ÂM/g) || []).length === 1);

console.log('\n=== 2b. FRONTEND: cau confirm nut Xoa theo luat moi + bump ===');
const feNK = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'js', 'module.nhapkho.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'index.html'), 'utf8');
try { new vm.Script(feNK, { filename: 'module.nhapkho.js' }); dat++; console.log('  ✓ module.nhapkho.js bien dich'); }
catch (e) { sai++; console.log('  ❌ module.nhapkho.js VO CU PHAP: ' + e.message); }
kiem('cau confirm noi luat MOI (ton am), khong con "phải hủy phiếu bán hàng trước"',
     feNK.includes('bị ÂM (đã bán/xuất vượt phần nhập còn lại) thì máy sẽ chặn')
       && !feNK.includes('phải hủy phiếu bán hàng trước'),
     'cau cu lam nguoi dung tuong van luat cu, mau thuan voi thong bao backend moi');
kiem('index.html bump module.nhapkho.js?v=9.15', html.includes('module.nhapkho.js?v=9.15'));

console.log('\n=== 3. NGUON HANG theo loai phieu ===');
kiem('chuanDong truyen loai xuong timHoacTaoMaHang',
     /timHoacTaoMaHang\(pool, tran, d, loai\);/.test(src),
     'khong truyen thi loai = undefined, ca fix chet im lang');
kiem('chu ky ham nhan loai',
     /async function timHoacTaoMaHang\(pool, tran, d, loai\)/.test(src));
kiem('MA MOI: loai phieu SanXuat => NhaSanXuat',
     /\(loai === 'SanXuat' \|\| d\.loaiHang === 'NhaSanXuat'\) \? 'NhaSanXuat' : 'DatNgoai'/.test(src));
kiem('MA DA CO: nang mot chieu len NhaSanXuat (co dieu kien <> de idempotent)',
     /UPDATE TheKhoHangHoa SET LoaiHang = N'NhaSanXuat'/.test(src)
       && /ISNULL\(LoaiHang, N''\) <> N'NhaSanXuat'/.test(src));
kiem('nang o CA HAI nhanh ma-da-co (chon tu danh sach lan go tay)',
     (src.match(/await nangLenNhaSX\(/g) || []).length >= 2);
kiem('chi nang khi phieu SanXuat (phieu NCC khong ha nguoc)',
     /if \(loai !== 'SanXuat'\) return;/.test(src));

console.log('\n' + '='.repeat(70));
console.log(sai === 0 ? `✅ ${dat} phep DAT, 0 sai` : `❌ ${sai} SAI / ${dat + sai} phep`);
console.log('='.repeat(70) + '\n');
process.exit(sai === 0 ? 0 : 1);
