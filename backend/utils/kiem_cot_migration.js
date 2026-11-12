/* ================================================================================================
   kiem_cot_migration.js — KIỂM CÁC CỘT DO MIGRATION THÊM VÀO ĐÃ CÓ THẬT TRÊN CSDL CHƯA

   Vì sao cần: `coCotQLSX()` (và các hàm dò cột khác) **cache kết quả vĩnh viễn trong tiến trình**.
   Chạy migration SAU `pm2 restart` ⇒ cột có trong CSDL nhưng phần mềm vẫn nhớ là "không có" ⇒
   tính năng chết CÂM, không báo lỗi gì. Đây là cái bẫy đã ghi trong
   feedback_qlnoibo_chay_migration_sau_pm2_phai_restart.

   Dùng CHÍNH cấu hình CSDL của phần mềm (backend/db.js + backend/.env) nên không thể sai chuỗi kết
   nối như gõ tay `sqlcmd -S .`.

   Chạy:  cd D:\QLSX\backend  &&  node utils\kiem_cot_migration.js
   Chỉ ĐỌC, không sửa gì. KHÔNG cần copy sang D:\ — nhưng copy cũng vô hại.
   ================================================================================================ */
const path = require('path');
/* 🔴 Nạp .env bằng ĐƯỜNG DẪN TUYỆT ĐỐI TRƯỚC khi require('../db'): db.js đọc biến môi trường ngay
   lúc nạp module, và nó gọi dotenv.config() KHÔNG kèm path ⇒ phụ thuộc thư mục đang đứng. Chạy từ
   D:\QLSX thay vì D:\QLSX\backend là nó đọc nhầm file khác (hoặc không có file nào). */
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { getPool } = require('../db');

/* Mỗi dòng: [bản, bảng, cột, mô tả ngắn để biết hỏng thì MẤT TÍNH NĂNG GÌ]

   🔴 TÊN BẢNG PHẢI TRA TỪ FILE MIGRATION, ĐỪNG NHỚ THEO TRÍ NHỚ. Bản đầu của chính file này ghi
   `TheKhoHangHoa.TenSanPhamTem` và `PhieuBanHang.MauDaChotCai` — cả hai bảng đều CÓ THẬT nên công cụ
   báo "THIẾU CỘT" nghe rất thuyết phục, suýt đẩy Nguyen đi chạy migration trên CSDL thật (2026-11-09).
   Đúng phải là `DonHangSanXuat` và `PhieuBanHangChiTiet`.
   Thêm dòng mới thì mở `database\migration_vNNN.sql` ra chép đúng tên trong câu `ALTER TABLE`. */
const CAN_CO = [
  ['v885 (v9.23)', 'DonHangDaiSize', 'LoaiTach', 'tách theo MẪU cùng dải size — thiếu thì chỉ tách được theo DẢI'],
  ['v886 (v9.32)', 'PhieuChi', 'NhanVienID', 'phiếu chi cho nhân viên — thiếu thì không chọn được người'],
  ['v886 (v9.32)', 'PhieuChi', 'LoaiChiNV', 'phân biệt Tạm ứng / Khác'],
  ['v886 (v9.32)', 'PhieuChi', 'TruLuongNam', 'tháng-năm trừ lương của khoản tạm ứng'],
  ['v886 (v9.32)', 'PhieuChi', 'TruLuongThang', 'tháng-năm trừ lương của khoản tạm ứng'],
  ['v835', 'DonHangSanXuat', 'TenSanPhamTem', 'tên sản phẩm in lên tem'],
  ['v884', 'PhieuBanHangChiTiet', 'MauDaChotCai', 'hàng mẫu khách mua luôn']
];

(async () => {
  let pool;
  try { pool = await getPool(); }
  catch (e) {
    console.error('❌ Không kết nối được CSDL: ' + e.message);
    console.error('   Kiểm DB_SERVER / DB_USER / DB_PASSWORD trong backend\\.env.');
    process.exit(1);
  }

  /* Hỏi MỘT lần cho tất cả — mỗi cột một truy vấn là 7 vòng mạng không cần thiết.
     COL_LENGTH trả NULL khi bảng hoặc cột không tồn tại, nên phải tách hai ca đó ra:
     bảng không có là chuyện khác hẳn với cột chưa thêm. */
  const chon = CAN_CO.map((c, i) =>
    `COL_LENGTH('${c[1]}','${c[2]}') AS c${i}, OBJECT_ID('${c[1]}') AS t${i}`).join(', ');
  const r = (await pool.request().query('SELECT ' + chon)).recordset[0];

  let thieu = 0, khongCoBang = 0;
  console.log('');
  CAN_CO.forEach((c, i) => {
    const coBang = r['t' + i] != null;
    const coCot = r['c' + i] != null;
    if (!coBang) {
      khongCoBang++;
      console.log(`  ⚠️  ${c[0]}  ${c[1]}.${c[2]}  — KHÔNG CÓ BẢNG ${c[1]} (cài thiếu hẳn, không phải thiếu cột)`);
    } else if (!coCot) {
      thieu++;
      console.log(`  ❌ ${c[0]}  ${c[1]}.${c[2]}  — THIẾU CỘT. Mất: ${c[3]}`);
    } else {
      console.log(`  ✓  ${c[0]}  ${c[1]}.${c[2]}`);
    }
  });

  console.log('\n' + '='.repeat(78));
  if (thieu || khongCoBang) {
    console.log(`❌ THIẾU ${thieu} cột${khongCoBang ? ` và ${khongCoBang} bảng` : ''}.`);
    console.log('   Chạy file migration tương ứng trong database\\, RỒI `pm2 restart qlnoibo`.');
  } else {
    console.log('✅ Đủ cột. NHƯNG nhớ: nếu migration vừa chạy XONG SAU lần restart gần nhất thì');
    console.log('   tiến trình vẫn đang nhớ "không có cột" — phải `pm2 restart qlnoibo` một lần nữa.');
    console.log('   Không chắc thứ tự thì cứ restart, mất 2 giây và vô hại.');
  }
  console.log('='.repeat(78) + '\n');
  process.exit(thieu || khongCoBang ? 1 : 0);
})().catch(e => { console.error('❌ ' + e.message); process.exit(1); });
