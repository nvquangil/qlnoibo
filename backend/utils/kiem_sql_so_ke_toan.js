/* ================================================================================================
   KIEM CHUNG CAC CAU SQL CUA SO CHI TIET CONG NO (mau ke toan)                             v7.34
   ------------------------------------------------------------------------------------------------
   KHONG CAN CSDL. Thay pool bang mot POOL GIA: no tra ve DANH SACH COT do minh khai o duoi (giong
   sys.columns) va GHI LAI moi cau SQL ma code sinh ra. Nho vay kiem duoc:

       1. Chay het khong nem loi voi ca 3 canh: du cot / thieu cot / thieu ca bang
       2. Danh sach IN (...) chi gom SO NGUYEN (chong chen SQL va chong 'IN ()' rong)
       3. Cot thieu duoc thay bang CAST(NULL AS ...) AS <ten> -> KHONG con 'Invalid column name'
       4. Khong cau nao con chuoi 'undefined' / 'null.' / 'IN ()' - dau hieu ghep chuoi loi
       5. In ra toan bo SQL de doc lai bang mat

   Day la lop chan cho DUNG loai loi da xay ra hai lan lien tiep (Invalid object name 'TaiKhoan',
   Invalid column name 'LoaiPhieu'): node --check khong bat duoc vi SQL chi la chuoi ky tu.

   CACH DUNG (trong thu muc backend):
       node utils/kiem_sql_so_ke_toan.js          -> chay 3 canh
       node utils/kiem_sql_so_ke_toan.js --sql    -> in kem toan bo cau SQL
   ================================================================================================ */
const { __kiemThu } = require('../routes/congno');
const { dongHangTheoChungTu, xoaCacheCot } = __kiemThu;
const inSQL = process.argv.includes('--sql');

let dat = 0, truot = 0;
function ok(dieuKien, nhan, chiTiet) {
  if (dieuKien) { dat++; console.log('  OK   ' + nhan); }
  else { truot++; console.log('  TRUOT ' + nhan + (chiTiet ? '  -> ' + chiTiet : '')); }
}

/* Cot THAT theo CAI_DAT_DAY_DU.sql — canh "du cot". */
const COT_DAY_DU = {
  PhieuBanHangChiTiet: ['ID', 'PhieuBHID', 'MaHangID', 'MauSacID', 'SoLuong', 'DonVi', 'SoLuongCai',
    'SoLuongQuyDoi', 'DonViQuyDoi', 'GiaBanLe', 'PhanTramCKShop', 'GiaBan', 'ThanhTien', 'DonID', 'GhiChu'],
  PhieuNhapLaiChiTiet: ['ID', 'PhieuNLID', 'MaHangID', 'MauSacID', 'SoLuong', 'DonVi', 'SoLuongCai',
    'GiaBanLe', 'PhanTramCKShop', 'GiaBan', 'ThanhTien', 'PhieuBHChiTietID', 'GhiChu'],
  VaiCay: ['CayID', 'MaCay', 'PhieuNhapID', 'VaiID', 'KhoVaiThucTe', 'GSM', 'KGNhap', 'QRCode',
    'ViTriKho', 'NgayNhap', 'TrangThai', 'DonGiaNhap'],
  PhieuPhuKienChiTiet: ['ID', 'PhieuID', 'PhuKienID', 'SoLuong', 'DonVi', 'DonGia', 'GhiChu'],
  PhieuNhapKhoHangChiTiet: ['ID', 'PhieuNKID', 'MaHangID', 'MauSacID', 'SoLuong', 'DonVi',
    'SoLuongChinh', 'DonGia', 'ThanhTien', 'GhiChu']
};
/* Canh "he thong cu": chua chay cac migration them cot / them bang. */
const COT_THIEU = {
  PhieuBanHangChiTiet: ['ID', 'PhieuBHID', 'MaHangID', 'SoLuong', 'DonVi'],   // thieu SoLuongCai, GiaBan, ThanhTien, MauSacID
  PhieuNhapLaiChiTiet: ['ID', 'PhieuNLID', 'MaHangID', 'SoLuong'],
  VaiCay: ['CayID', 'MaCay', 'PhieuNhapID', 'VaiID', 'KGNhap'],               // thieu DonGiaNhap
  PhieuPhuKienChiTiet: ['ID', 'PhieuID', 'PhuKienID', 'SoLuong'],             // thieu DonGia
  PhieuNhapKhoHangChiTiet: ['ID', 'PhieuNKID', 'MaHangID', 'SoLuong']
};

/* Pool gia: tra cot theo bang do, tra [] cho moi truy van du lieu, va ghi lai cau SQL. */
function poolGia(banDoCot, dsBangCo) {
  const daChay = [];
  const req = () => {
    const thamSo = {};
    const r = {
      input(ten, kieu, gt) { thamSo[ten] = gt; return r; },
      async query(text) {
        daChay.push(text);
        const t = String(text);
        /* Gia lap SELECT ... FROM sys.columns WHERE object_id = OBJECT_ID(@b)  (ham tapCot) */
        if (/sys\.columns/.test(t)) {
          const b = thamSo.b;
          return { recordset: (banDoCot[b] || []).map(n => ({ n })) };
        }
        /* Gia lap SELECT OBJECT_ID(@b)  (ham coBang) */
        if (/OBJECT_ID\(@b\)/.test(t)) {
          return { recordset: [{ c: dsBangCo.indexOf(thamSo.b) !== -1 ? 1 : null }] };
        }
        return { recordset: [] };
      }
    };
    return r;
  };
  return { request: req, daChay };
}

/* Cac dong so dau vao: co du cac loai chung tu de moi nhanh SQL deu duoc chay. */
const DONG_SO = [
  { CtLoai: 'PBH', CtID: 10 }, { CtLoai: 'PBH', CtID: 99 },
  { CtLoai: 'PNL', CtID: 12 },
  { CtLoai: 'PNV', CtID: 7 },
  { CtLoai: 'PNPK', CtID: 21 }, { CtLoai: 'PXPK', CtID: 22 },
  { CtLoai: 'PNKH', CtID: 33 },
  { CtLoai: 'PC', CtID: 1 },                    // phieu chi: khong co dong hang -> khong sinh SQL
  { CtLoai: null, CtID: null },                 // dieu chinh
  { CtLoai: 'PBH', CtID: 'khong-phai-so' },     // du lieu rac -> phai bi loai, khong duoc chen vao IN
  { CtLoai: 'PBH', CtID: '77' }                 // chuoi so -> phai duoc nhan
];

function raSoat(ten, dsSQL) {
  const goi = dsSQL.filter(s => !/sys\.columns|OBJECT_ID\(@b\)/.test(s));
  ok(goi.length > 0, ten + ': có sinh câu SQL lấy dòng hàng', 'so cau=' + goi.length);
  const xau = [];
  goi.forEach(s => {
    if (/undefined/.test(s)) xau.push('có chữ "undefined"');
    if (/IN \(\s*\)/.test(s)) xau.push('có "IN ()" rỗng');
    if (/=\s*NULL\b/.test(s) && !/CAST\(NULL/.test(s)) xau.push('so sánh "= NULL"');
    if (/\bnull\./.test(s)) xau.push('có "null." (alias rỗng)');
    if (/khong-phai-so/.test(s)) xau.push('có ID rác trong câu SQL');
    const mo = (s.match(/\(/g) || []).length, dong = (s.match(/\)/g) || []).length;
    if (mo !== dong) xau.push(`lệch ngoặc (${mo} mở / ${dong} đóng)`);
  });
  ok(xau.length === 0, ten + ': không câu nào có dấu hiệu ghép chuỗi lỗi', [...new Set(xau)].join('; '));
  /* Danh sach IN phai chi gom so nguyen */
  const dsIn = [...goi.join('\n').matchAll(/IN \(([^)]*)\)/g)].map(m => m[1]);
  const inXau = dsIn.filter(x => !/^\s*\d+(\s*,\s*\d+)*\s*$/.test(x));
  ok(inXau.length === 0, ten + ': mọi danh sách IN (...) chỉ gồm số nguyên', inXau.join(' | '));
  if (inSQL) goi.forEach((s, i) => console.log('\n----- SQL #' + (i + 1) + ' -----\n' + s.trim()));
  return goi;
}

(async () => {
  console.log('');
  console.log('=== 1. CANH DU COT (he thong da chay het migration) ===');
  const p1 = poolGia(COT_DAY_DU, Object.keys(COT_DAY_DU));
  const kq1 = await dongHangTheoChungTu(p1, DONG_SO);
  ok(kq1 instanceof Map, 'Trả về Map (không ném lỗi)');
  const goi1 = raSoat('Đủ cột', p1.daChay);
  ok(goi1.some(s => /ct\.SoLuongCai AS SoLuong/.test(s)),
    'Phiếu bán hàng: lấy SL theo CÁI (SoLuongCai) vì ThanhTien = GiaBan × SoLuongCai');
  ok(goi1.some(s => /ct\.GiaBan AS DonGia/.test(s)), 'Đơn giá lấy từ GiaBan (giá sau chiết khấu)');
  ok(goi1.filter(s => /PhieuPhuKienChiTiet/.test(s)).length === 1,
    'Phụ kiện nhập + trả NCC gộp vào MỘT câu (cùng bảng chi tiết), không chạy hai lần');
  ok(goi1.some(s => /IN \(10,99,77\)/.test(s)),
    'ID kiểu chuỗi "77" được nhận, ID rác bị loại khỏi IN', (goi1.find(s => /PhieuBanHangChiTiet/.test(s)) || '').match(/IN \([^)]*\)/));

  console.log('');
  console.log('=== 2. CANH THIEU COT (he thong cu, chua chay migration) ===');
  xoaCacheCot();   // xem ghi chu o congno.js: cache tap cot theo ten bang
  const p2 = poolGia(COT_THIEU, Object.keys(COT_THIEU));
  const kq2 = await dongHangTheoChungTu(p2, DONG_SO);
  ok(kq2 instanceof Map, 'Thiếu cột vẫn KHÔNG ném lỗi (đây là lỗi đã xảy ra 2 lần trước)');
  const goi2 = raSoat('Thiếu cột', p2.daChay);
  ok(goi2.some(s => /CAST\(NULL AS DECIMAL\(14,2\)\) AS DonGia/.test(s)),
    'Cột GiaBan thiếu -> trả CAST(NULL ...) AS DonGia, không ghi tên cột không có');
  ok(goi2.some(s => /ct\.SoLuong AS SoLuong/.test(s)),
    'Thiếu SoLuongCai thì lùi về SoLuong, không sinh cột không tồn tại');
  ok(!goi2.some(s => /PhieuPhuKienChiTiet/.test(s)),
    'Phụ kiện thiếu cột DonGia -> BỎ HẲN câu đó (không có giá thì không có tiền để in)');
  ok(!goi2.some(s => /VaiCay/.test(s)),
    'Vải thiếu DonGiaNhap -> bỏ hẳn câu đó');
  ok(goi2.some(s => /LEFT JOIN MauSac ms ON ms\.MauSacID = NULL/.test(s)),
    'Thiếu cột MauSacID -> JOIN màu thành "= NULL" (không có màu, không vỡ câu)');

  console.log('');
  console.log('=== 3. CANH THIEU CA BANG (chua chay migration tao bang) ===');
  xoaCacheCot();
  const p3 = poolGia({}, []);                     // khong bang nao, khong cot nao
  const kq3 = await dongHangTheoChungTu(p3, DONG_SO);
  ok(kq3 instanceof Map && kq3.size === 0, 'Không bảng nào -> Map rỗng, không ném lỗi');
  const goi3 = p3.daChay.filter(s => !/sys\.columns|OBJECT_ID\(@b\)/.test(s));
  ok(!goi3.some(s => /PhieuNhapLaiChiTiet|PhieuNhapKhoHangChiTiet/.test(s)),
    'Hai bảng do migration tạo được dò bằng OBJECT_ID trước khi truy vấn');

  console.log('');
  console.log(`KET QUA: ${dat} dat / ${truot} truot`);
  console.log(truot ? '>> CO MUC KHONG DAT - phai sua truoc khi giao.'
    : '>> DAT TAT CA. Chay them `node utils/kiem_ten_bang_cot.js congno.js` tren may co CSDL de doi chieu ten bang/cot thuc te.');
  process.exit(truot ? 1 : 0);
})().catch(err => { console.error('LOI KIEM CHUNG: ' + err.stack); process.exit(1); });
