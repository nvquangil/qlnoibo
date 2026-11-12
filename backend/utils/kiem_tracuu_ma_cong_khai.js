/* ================================================================================================
   kiem_tracuu_ma_cong_khai.js  —  bộ tự kiểm cho v9.25 (Zalo OA, Giai đoạn 1)

   KIỂM HÀNH VI, không so chuỗi: nạp thẳng utils/traCuuHangCongKhai.js, cắm POOL GIẢ, chạy đúng các
   ca một khách sẽ gõ. Phép so chuỗi chỉ dùng cho mấy bất biến không chạy được (giới hạn tần suất).

   Chạy:  node backend\utils\kiem_tracuu_ma_cong_khai.js
   KHÔNG copy file này sang D:\QLSX.
   ================================================================================================ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const GOC = path.join(__dirname, '..', '..');
const tc = require('./traCuuHangCongKhai');
const nguonPublic = fs.readFileSync(path.join(GOC, 'backend', 'routes', 'public.js'), 'utf8');
const nguonUtil = fs.readFileSync(path.join(__dirname, 'traCuuHangCongKhai.js'), 'utf8');

let sai = 0, dat = 0;
const kiem = (ten, dung, td) => dung
  ? (dat++, console.log('  ✓ ' + ten))
  : (sai++, console.log('  ❌ ' + ten + (td ? ' — ' + td : '')));

/* ------------------------------------------------------------------------------------------------
   POOL GIẢ: trả dữ liệu theo nội dung câu SQL. Ba mã hàng:
     1  AB-123   barcode 8938000111  — công khai, còn 2 màu
     2  AB124    barcode 8938000222  — công khai, còn 1 màu
     3  NOIBO01  barcode (trống)     — KHÔNG công khai (bị lọc ở câu chi tiết)
   ------------------------------------------------------------------------------------------------ */
const MA_HANG = [
  { MaHangID: 1, MaHang: 'AB-123', MaBarcode: '8938000111' },
  { MaHangID: 2, MaHang: 'AB124', MaBarcode: '8938000222' },
  { MaHangID: 3, MaHang: 'NOIBO01', MaBarcode: null }
];
const CHI_TIET = {
  1: { MaHangID: 1, MaHang: 'AB-123', TenHang: 'Áo cộc tay', GiaBan: 185000, AnhDaiDien: '/a1.jpg', TenTheKho: 'Áo', DonViCoBan: 'Cái', DonViQuyDoi: 'Ri', LoaiRi: 6 },
  2: { MaHangID: 2, MaHang: 'AB124', TenHang: 'Áo dài tay', GiaBan: 215000, AnhDaiDien: '/a2.jpg', TenTheKho: 'Áo', DonViCoBan: 'Cái', DonViQuyDoi: 'Ri', LoaiRi: 6 }
  // 3 cố tình KHÔNG có -> giả lập bị điều kiện công khai loại bỏ
};
const MAU = [
  { MaHangID: 1, MauSacID: 10, TenMau: 'Trắng', LinkAnh: '/t.jpg', TonCai: 50 },
  { MaHangID: 1, MauSacID: 11, TenMau: 'Đen', LinkAnh: '/d.jpg', TonCai: 30 },
  { MaHangID: 1, MauSacID: 12, TenMau: 'Be', LinkAnh: null, TonCai: 5 },     // sẽ bị "đang giữ" ăn hết
  { MaHangID: 2, MauSacID: 10, TenMau: 'Trắng', LinkAnh: '/t2.jpg', TonCai: 8 }
];
function poolGia() {
  const daNhan = [];
  return {
    __daNhan: daNhan,
    request() {
      const ctx = { ids: [] };
      const r = {
        input(ten, kieu, gt) { ctx.ids.push(gt); return r; },
        async query(q) {
          daNhan.push(q);
          if (/FROM TheKhoHangHoa\s*$/m.test(q.trim()) || /SELECT MaHangID, MaHang, MaBarcode/.test(q))
            return { recordset: MA_HANG.map(x => Object.assign({}, x)) };
          if (/vw_TonKhoHangHoa/.test(q)) {
            return { recordset: ctx.ids.map(id => CHI_TIET[id]).filter(Boolean) };
          }
          if (/vw_TonTheoMau/.test(q)) {
            return { recordset: MAU.filter(m => ctx.ids.indexOf(m.MaHangID) !== -1).map(x => Object.assign({}, x)) };
          }
          return { recordset: [] };
        }
      };
      return r;
    }
  };
}
/* Màu "Be" của mã 1 đã có người đặt hết 5 cái -> KHÔNG được hiện là còn hàng (luật v6.23). */
const PHU_THUOC = {
  dieuKienCongKhaiMH: async () => " AND ISNULL(h.CongKhai, 1) = 1",
  dieuKienCongKhaiDM: () => " AND ISNULL(dm.CongKhai, 1) = 1",
  layHangDangGiu: async () => ({ theoMau: new Map([['1|12', 5]]) })
};

console.log('\n=== 1. BIÊN DỊCH ===');
[['backend/utils/traCuuHangCongKhai.js', nguonUtil], ['backend/routes/public.js', nguonPublic]].forEach(([f, s]) => {
  try { new vm.Script(s, { filename: f }); dat++; console.log('  ✓ ' + f); }
  catch (e) { sai++; console.log('  ❌ ' + f + ' VỠ CÚ PHÁP: ' + e.message); }
});

console.log('\n=== 2. CHUẨN HÓA MÃ (khách gõ kiểu gì cũng ra một mã) ===');
kiem('bỏ gạch/khoảng trắng/chữ thường: "ab-123" = "AB 123" = "AB123"',
     tc.chuanHoa('ab-123') === 'AB123' && tc.chuanHoa('AB 123') === 'AB123' && tc.chuanHoa('AB123') === 'AB123');
kiem('bỏ dấu tiếng Việt: "áo" -> "AO", "Đ" -> "D"',
     tc.chuanHoa('áo') === 'AO' && tc.chuanHoa('Đen') === 'DEN' && tc.chuanHoa('đen') === 'DEN');
kiem('null/undefined/số -> không nổ', tc.chuanHoa(null) === '' && tc.chuanHoa(undefined) === '' && tc.chuanHoa(8938) === '8938');
kiem('🔴 KHÔNG gõ thẳng ký tự tổ hợp vào file nguồn (dùng RegExp mã \\u)',
     /new RegExp\('\[\\\\u0300-\\\\u036f\]', 'g'\)/.test(nguonUtil)
       && !/[\u0300-\u036f]/.test(nguonUtil),
     'ký tự không nhìn thấy trong mã nguồn là thứ sau này không ai sửa nổi');

console.log('\n=== 3. TÁCH ỨNG VIÊN TỪ CÂU KHÁCH NHẮN ===');
const uv = tc.tachUngVien('còn mã AB-123 không shop ơi');
kiem('bắt được mã nằm giữa câu', uv.indexOf('AB123') !== -1, JSON.stringify(uv));
kiem('bỏ từ quá ngắn (dưới 3 ký tự)', uv.every(x => x.length >= 3));
kiem('ghép được mã bị gõ RỜI "AB 123"', tc.tachUngVien('cho hỏi AB 123').indexOf('AB123') !== -1);
kiem('mã DÀI được thử trước mã ngắn', (() => {
  const a = tc.tachUngVien('AB 123'); return a[0].length >= a[a.length - 1].length;
})());

console.log('\n=== 4. TÌM MÃ — và 🔴 KHÔNG BAO GIỜ ĐOÁN ===');
(async () => {
  tc.xoaChiMuc();
  const p = poolGia();

  let r = await tc.timUngVien(p, 'còn mã AB-123 không shop');
  kiem('khớp CHÍNH XÁC mã hàng -> chinh-xac', r.kieu === 'chinh-xac' && r.ids[0] === 1 && r.nguon === 'ma-hang', JSON.stringify(r));

  r = await tc.timUngVien(p, '8938000222');
  kiem('khớp CHÍNH XÁC mã vạch -> chinh-xac', r.kieu === 'chinh-xac' && r.ids[0] === 2 && r.nguon === 'ma-vach', JSON.stringify(r));

  r = await tc.timUngVien(p, 'AB12');
  kiem('🔴 "AB12" CHỨA trong AB123 lẫn AB124 -> nhieu, KHÔNG tự nhận chính xác',
       r.kieu === 'nhieu' && r.nguon === 'gan-dung' && r.ids.length === 2,
       'đoán bừa một trong hai = khách đặt nhầm hàng: ' + JSON.stringify(r));

  r = await tc.timUngVien(p, 'ZZZ999');
  kiem('không có gì -> khong', r.kieu === 'khong' && !r.ids.length);

  r = await tc.timUngVien(p, 'ok');
  kiem('câu không chứa mã -> khong (không quét cả kho)', r.kieu === 'khong');

  console.log('\n=== 5. 🔴 LUẬT HIỂN THỊ: KHÔNG LỘ SỐ TỒN ===');
  const ct = await tc.layThongTinCongKhai(p, [1], PHU_THUOC);
  const j = JSON.stringify(ct);
  kiem('trả về tên hàng + giá bán + tên màu', ct.length === 1 && ct[0].giaBan === 185000 && ct[0].mauConLai.length >= 1);
  kiem('🔴 KHÔNG có tonCai / tongTon / TonCai ở bất kỳ đâu trong kết quả',
       !/tonCai|tongTon|TonCai|SoLuong/i.test(j),
       'catalogue chỉ hiện MÀU CÒN, không hiện số — bot nói nhiều hơn web là lộ năng lực kho: ' + j);
  kiem('🔴 KHÔNG có mã vạch / ID nội bộ trong kết quả',
       !/MaBarcode|maBarcode|MaHangID|8938/.test(j), j);
  kiem('🔴 màu đã có người đặt HẾT thì không còn là "còn hàng" (trừ hàng đang giữ, v6.23)',
       ct[0].mauConLai.every(m => m.tenMau !== 'Be'),
       'màu Be tồn 5, đang giữ 5 => phải biến mất: ' + j);
  kiem('màu còn thật thì vẫn hiện đủ', ct[0].mauConLai.map(m => m.tenMau).sort().join(',') === 'Trắng,Đen'.split(',').sort().join(','));

  const ctKhongCongKhai = await tc.layThongTinCongKhai(p, [3], PHU_THUOC);
  kiem('🔴 mã KHÔNG công khai -> trả rỗng, không hé lộ là nó tồn tại', ctKhongCongKhai.length === 0);

  console.log('\n=== 6. CHẠY TRỌN MỘT TIN NHẮN ===');
  let k = await tc.traCuuTheoChuoi(p, 'shop ơi còn AB-123 không', PHU_THUOC);
  kiem('đúng một mã -> trangThai "thay"', k.trangThai === 'thay' && k.items.length === 1 && k.items[0].maHang === 'AB-123', JSON.stringify(k));

  k = await tc.traCuuTheoChuoi(p, '8938000111', PHU_THUOC);
  kiem('gửi mã vạch trên tem -> ra đúng mã hàng đó', k.trangThai === 'thay' && k.items[0].maHang === 'AB-123');

  k = await tc.traCuuTheoChuoi(p, 'AB12', PHU_THUOC);
  kiem('🔴 mã gần đúng -> "nhieu" để hỏi lại, kèm tối đa 3 ứng viên',
       k.trangThai === 'nhieu' && k.items.length >= 2 && k.items.length <= tc.TOI_DA_UNG_VIEN, JSON.stringify(k));

  k = await tc.traCuuTheoChuoi(p, 'NOIBO01', PHU_THUOC);
  kiem('🔴 mã nội bộ (không công khai) -> trả "khong" y như mã không tồn tại',
       k.trangThai === 'khong' && !k.items.length,
       'nói "có nhưng không được xem" là đã tiết lộ nó tồn tại');

  k = await tc.traCuuTheoChuoi(p, 'ZZZ999', PHU_THUOC);
  kiem('mã không có -> "khong"', k.trangThai === 'khong');

  console.log('\n=== 7. KHÔNG BẮN SQL THỪA (máy chủ là 1 máy Windows ở xưởng) ===');
  const p2 = poolGia();
  tc.xoaChiMuc();
  await tc.traCuuTheoChuoi(p2, 'còn mã AB-123 không shop ơi bạn', PHU_THUOC);
  const soLanNapChiMuc = p2.__daNhan.filter(q => /SELECT MaHangID, MaHang, MaBarcode/.test(q)).length;
  kiem('một tin nhắn nhiều từ chỉ nạp chỉ mục MỘT lần (không mỗi từ một câu SQL)',
       soLanNapChiMuc === 1, 'nạp ' + soLanNapChiMuc + ' lần');
  const truoc = p2.__daNhan.length;
  await tc.traCuuTheoChuoi(p2, 'AB124', PHU_THUOC);
  const lanHai = p2.__daNhan.slice(truoc).filter(q => /SELECT MaHangID, MaHang, MaBarcode/.test(q)).length;
  kiem('tin nhắn thứ hai dùng lại chỉ mục trong bộ nhớ (hạn 60 giây)', lanHai === 0);

  console.log('\n=== 8. ROUTE /api/public/tracuu ===');
  kiem('có route tracuu', /router\.get\('\/tracuu'/.test(nguonPublic));
  kiem('🔴 có chống dò mã hàng loạt (giới hạn theo IP) + trả 429 chứ không im lặng',
       /function quaNhanh\(ip\)/.test(nguonPublic) && /status\(429\)/.test(nguonPublic));
  kiem('chặn chuỗi quá dài', /q\.length > 200/.test(nguonPublic));
  kiem('Map đếm IP không phình vô hạn', /__traCuuDem\.size > 5000/.test(nguonPublic));
  kiem('route truyền đủ 3 phụ thuộc cho hàm tra cứu',
       /\{ dieuKienCongKhaiMH, dieuKienCongKhaiDM, layHangDangGiu \}/.test(nguonPublic));
  kiem('🔴 route KHÔNG tự viết lại điều kiện công khai (dùng lại đúng hàm của catalogue)',
       (nguonPublic.match(/function dieuKienCongKhaiMH/g) || []).length === 1);

  console.log('\n' + '='.repeat(70));
  console.log(sai === 0 ? `✅ ${dat} phép ĐẠT, 0 sai` : `❌ ${sai} SAI / ${dat + sai} phép`);
  console.log('='.repeat(70) + '\n');
  process.exit(sai === 0 ? 0 : 1);
})().catch(e => { console.log('❌ NỔ: ' + e.stack); process.exit(1); });
