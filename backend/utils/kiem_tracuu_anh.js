/* ================================================================================================
   kiem_tracuu_anh.js  —  bộ tự kiểm cho v9.28 (tra hàng bằng ẢNH)

   KIỂM HÀNH VI: tự dựng ảnh bằng sharp rồi chạy thẳng dHash — không giả lập, không so chuỗi suông.
   Chạy:  node backend\utils\kiem_tracuu_anh.js
   KHÔNG copy file này sang D:\QLSX.
   ================================================================================================ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const sharp = require('sharp');
sharp.cache(false);

const GOC = path.join(__dirname, '..', '..');
const ah = require('./anhHashSanPham');
const dm = require('./docMaTuAnh');
const nguonPublic = fs.readFileSync(path.join(GOC, 'backend', 'routes', 'public.js'), 'utf8');
const nguonAh = fs.readFileSync(path.join(__dirname, 'anhHashSanPham.js'), 'utf8');
const nguonDm = fs.readFileSync(path.join(__dirname, 'docMaTuAnh.js'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(GOC, 'backend', 'package.json'), 'utf8'));

let sai = 0, dat = 0;
const kiem = (ten, dung, td) => dung
  ? (dat++, console.log('  ✓ ' + ten))
  : (sai++, console.log('  ❌ ' + ten + (td ? ' — ' + td : '')));

/* Ảnh thử: một "sản phẩm" có hình rõ ràng (ba sọc) để dHash có gì mà băm. */
async function anhMau(mau) {
  return sharp({ create: { width: 300, height: 400, channels: 3, background: mau } })
    .composite([
      { input: { create: { width: 300, height: 60, channels: 3, background: { r: 20, g: 20, b: 20 } } }, top: 60, left: 0 },
      { input: { create: { width: 300, height: 60, channels: 3, background: { r: 240, g: 240, b: 240 } } }, top: 200, left: 0 }
    ]).jpeg({ quality: 92 }).toBuffer();
}

(async () => {
  console.log('\n=== 1. BIÊN DỊCH ===');
  [['utils/anhHashSanPham.js', nguonAh], ['utils/docMaTuAnh.js', nguonDm], ['routes/public.js', nguonPublic]]
    .forEach(([f, s]) => {
      try { new vm.Script(s, { filename: f }); dat++; console.log('  ✓ ' + f); }
      catch (e) { sai++; console.log('  ❌ ' + f + ' VỠ CÚ PHÁP: ' + e.message); }
    });

  console.log('\n=== 2. dHASH — ẢNH BỊ NÉN / ĐỔI CỠ VẪN PHẢI KHỚP ===');
  const goc = await anhMau({ r: 200, g: 60, b: 60 });
  const hGoc = await ah.dHashTuBuffer(goc);
  kiem('hash dài 16 ký tự hex', /^[0-9a-f]{16}$/.test(hGoc), hGoc);
  kiem('cùng một ảnh -> khoảng cách 0', ah.khoangCach(hGoc, await ah.dHashTuBuffer(goc)) === 0);

  /* Đây là ca THẬT: Zalo nén ảnh khi gửi qua chat. */
  const nenManh = await sharp(goc).jpeg({ quality: 35 }).toBuffer();
  const dNen = ah.khoangCach(hGoc, await ah.dHashTuBuffer(nenManh));
  kiem('🔴 ảnh bị NÉN mạnh (Zalo làm vậy) vẫn trong ngưỡng chắc',
       dNen <= ah.NGUONG_CHAC, 'khoảng cách ' + dNen + ' > ' + ah.NGUONG_CHAC);

  const doiCo = await sharp(goc).resize(150, 200).jpeg({ quality: 80 }).toBuffer();
  const dCo = ah.khoangCach(hGoc, await ah.dHashTuBuffer(doiCo));
  kiem('🔴 ảnh bị ĐỔI CỠ vẫn trong ngưỡng chắc', dCo <= ah.NGUONG_CHAC, 'khoảng cách ' + dCo);

  /* Sản phẩm KHÁC bố cục phải văng ra khỏi ngưỡng — nếu không thì bot sẽ nhận nhầm hàng. */
  const khacHan = await sharp({ create: { width: 300, height: 400, channels: 3, background: { r: 250, g: 250, b: 250 } } })
    .composite([{ input: { create: { width: 80, height: 400, channels: 3, background: { r: 10, g: 10, b: 10 } } }, top: 0, left: 110 }])
    .jpeg({ quality: 92 }).toBuffer();
  const dKhacHan = ah.khoangCach(hGoc, await ah.dHashTuBuffer(khacHan));
  kiem('🔴 sản phẩm KHÁC bố cục phải VƯỢT ngưỡng chắc (không nhận nhầm)',
       dKhacHan > ah.NGUONG_CHAC, 'khoảng cách chỉ ' + dKhacHan);
  /* Ghi lại con số của ca "cùng bố cục, khác màu" — không chấm đỗ/trượt, chỉ để hiểu vì sao
     dHash KHÔNG đủ để tự quyết, phải đưa ứng viên cho khách bấm chọn. */
  const khacMau = await anhMau({ r: 60, g: 60, b: 200 });
  console.log('  · (tham khảo) cùng bố cục KHÁC MÀU: khoảng cách '
    + ah.khoangCach(hGoc, await ah.dHashTuBuffer(khacMau)) + ' — đây là lý do CẤM đoán');

  console.log('\n=== 3. TÊN FILE — CHẶN PATH TRAVERSAL ===');
  kiem('lấy đúng tên từ /uploads/…', ah.tenFileTuLink('/uploads/A26C1121_1787994908222.jpg') === 'A26C1121_1787994908222.jpg');
  kiem('bỏ query string', ah.tenFileTuLink('/uploads/a_1.jpg?v=2') === 'a_1.jpg');
  kiem('🔴 chặn ../ và ký tự lạ',
       ah.tenFileTuLink('../../db.js') === null || ah.tenFileTuLink('../../db.js') === 'db.js',
       'path.basename đã cắt, nhưng phải chắc không ra đường dẫn');
  kiem('🔴 tên có dấu cách / ký tự lạ -> null', ah.tenFileTuLink('/uploads/a b;rm.jpg') === null);

  console.log('\n=== 4. ĐỌC MÃ VẠCH — KHÔNG CÓ THƯ VIỆN THÌ KHÔNG ĐƯỢC SẬP ===');
  const co = dm.coThuVien();
  console.log('  · @zxing/library: ' + (co ? 'ĐÃ CÀI' : 'CHƯA CÀI (đường mã vạch tắt, các đường khác vẫn chạy)'));
  const kqDoc = await dm.docMaTuAnh(goc);   // ảnh không có mã vạch
  kiem('ảnh không có mã vạch -> trả null, không ném lỗi', kqDoc && kqDoc.ma === null);
  kiem('báo rõ có thư viện hay không', typeof kqDoc.coThuVien === 'boolean');
  kiem('nạp LƯỜI trong try/catch (chưa cài vẫn chạy được phần tra theo chữ)',
       /try \{ __zx = require\('@zxing\/library'\); \}/.test(nguonDm) && /catch \(e\) \{ __zx = null; \}/.test(nguonDm));
  kiem('@zxing/library đã ghim trong package.json (deploy sau không đè mất)',
       !!(pkg.dependencies && pkg.dependencies['@zxing/library']));
  kiem('thử nhiều biến thể ảnh (xoay + tăng tương phản) trước khi chịu thua',
       /\(s\) => s\.normalise\(\)\.sharpen\(\)/.test(nguonDm) && /\(s\) => s\.rotate\(90\)/.test(nguonDm));
  kiem('xoay theo EXIF của điện thoại', /sharp\(buf\)\.rotate\(\)/.test(nguonDm));
  kiem('🔴 QUÉT THEO Ô + PHÓNG TO từng ô (ảnh thật: tem chỉ chiếm ~1/20 chiều rộng)',
       /for \(const n of \[3, 5\]\)/.test(nguonDm)
         && /\.extract\(\{ left, top, width, height \}\)/.test(nguonDm)
         && /\.resize\(\{ width: CANH_O/.test(nguonDm),
       'giải mã trên ảnh toàn cảnh thu nhỏ = vạch mã còn vài pixel, chắc chắn trượt');
  kiem('ô chồng mép (tem vắt qua ranh giới vẫn lọt trọn một ô)', /CHONG_MEP = 0\.25/.test(nguonDm));
  kiem('báo đường nào đọc được (ca-anh / quet-o-3 / quet-o-5) để còn đo',
       /duong: 'ca-anh'/.test(nguonDm) && /duong: 'quet-o-' \+ n/.test(nguonDm));
  kiem('có lệnh đo trên ảnh thật từ dòng lệnh', /require\.main === module/.test(nguonDm));

  console.log('\n=== 5. sharp.cache(false) — BẮT BUỘC TRÊN WINDOWS ===');
  kiem('cả hai util đều tắt cache libvips',
       /sharp\.cache\(false\)/.test(nguonAh) && /sharp\.cache\(false\)/.test(nguonDm),
       'bật cache = libvips giữ file ảnh, mọi lần ghi/xóa file đó về sau đều lỗi UNKNOWN');

  console.log('\n=== 6. ROUTE /tracuu-anh ===');
  kiem('có route', /router\.post\('\/tracuu-anh'/.test(nguonPublic));
  kiem('🔴 ảnh người lạ giữ trong BỘ NHỚ, KHÔNG ghi xuống uploads/ (thư mục đang phục vụ công khai)',
       /multer\(\{ storage: multer\.memoryStorage\(\)/.test(nguonPublic)
         && !/multer\.diskStorage/.test(nguonPublic));
  kiem('giới hạn cỡ ảnh + 1 file', /fileSize: 8 \* 1024 \* 1024, files: 1/.test(nguonPublic));
  kiem('dùng chung bộ chống dò theo IP với /tracuu', /quaNhanh\(req\.ip \|\| 'khong-ro'\)/.test(nguonPublic));
  kiem('🔴 thứ tự: mã vạch TRƯỚC, dHash SAU', nguonPublic.indexOf('docMaTuAnh(req.file.buffer)') < nguonPublic.indexOf('timTheoAnh(pool, req.file.buffer'));
  kiem('🔴 đọc được mã mà ra 0 mặt hàng -> RƠI TIẾP xuống dHash, không trả lời sớm',
       /if \(kq\.items\.length\) return res\.json/.test(nguonPublic),
       'trả "đọc được mã X nhưng không có hàng" là xác nhận mã đó CÓ THẬT');
  kiem('🔴 câu trả lời khi không ra gì KHÔNG kèm mã vừa đọc được',
       !/trangThai: 'khong', items: \[\][^}]*maDocDuoc/.test(nguonPublic));
  kiem('🔴 chỉ nhận "thay" khi dHash CHẮC và còn đúng 1 mã sau khi lọc công khai',
       /const trangThai = \(theoAnh\.kieu === 'chac' && items\.length === 1\) \? 'thay' : 'nhieu';/.test(nguonPublic),
       'ảnh tự chụp luôn có một tấm "gần nhất" — chọn bừa là trả tồn mã khác');
  kiem('dùng lại layThongTinCongKhai (cùng luật hiển thị với /tracuu)',
       /layThongTinCongKhai \} = require\('\.\.\/utils\/traCuuHangCongKhai'\)/.test(nguonPublic));

  console.log('\n=== 7. CHỈ MỤC HASH ===');
  kiem('chỉ mục lưu xuống đĩa (khởi động lại không phải băm lại hàng nghìn ảnh)',
       /FILE_CHI_MUC = path\.join\(THU_MUC_ANH, '\.hash-anh\.json'\)/.test(nguonAh));
  kiem('khóa theo mtime + size (ảnh bị thay bằng file khác cùng tên vẫn tính lại)',
       /cu\.mtime === st\.mtimeMs && cu\.size === st\.size/.test(nguonAh));
  kiem('🔴 chỉ băm ảnh của hàng ĐANG CÔNG KHAI (dùng lại điều kiện của catalogue)',
       /dieuKienCongKhaiMH\(pool, 'h'\)/.test(nguonAh) && /dieuKienCongKhaiDM\('dm'\)/.test(nguonAh),
       'băm cả ảnh mã nội bộ = bot có thể lộ mã đó khi khách gửi ảnh');
  kiem('có lệnh dựng sẵn chỉ mục (--dung)', /process\.argv\.indexOf\('--dung'\)/.test(nguonAh));
  kiem('hẹn giờ ghi đĩa có unref (không giữ tiến trình sống)', /__ghiCho\.unref/.test(nguonAh));

  console.log('\n' + '='.repeat(70));
  console.log(sai === 0 ? `✅ ${dat} phép ĐẠT, 0 sai` : `❌ ${sai} SAI / ${dat + sai} phép`);
  console.log('='.repeat(70) + '\n');
  process.exit(sai === 0 ? 0 : 1);
})().catch(e => { console.log('❌ NỔ: ' + e.stack); process.exit(1); });
