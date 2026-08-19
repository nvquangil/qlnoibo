/* ==================================================================================================
   NÉN HÀNG LOẠT ẢNH ĐÃ CÓ TRONG backend/uploads  (v6.07)
   --------------------------------------------------------------------------------------------------
   Vì sao cần: từ v6.07 ảnh MỚI tải lên đã được thu nhỏ + nén ngay (xem routes/upload.js). Nhưng ảnh CŨ
   vẫn nằm nguyên cỡ máy ảnh (có ảnh 24 MB) — mỗi lần ai bấm xem ảnh to là tải lại đúng file đó.
   Công cụ này thu nhỏ ảnh cũ về cạnh dài tối đa 1600px + nén JPEG, GIỮ NGUYÊN TÊN FILE nên mọi đường
   dẫn đã lưu trong CSDL vẫn đúng, KHÔNG phải sửa dữ liệu.

   CÁCH DÙNG (mở CMD tại thư mục backend):
     node utils/nen_anh_uploads.js                 -> CHỈ XEM danh sách sẽ nén (không sửa gì)
     node utils/nen_anh_uploads.js --ghi           -> nén thật (ảnh gốc được chuyển vào uploads/_goc)
     node utils/nen_anh_uploads.js --ghi --canh=1200 --chatluong=80
     node utils/nen_anh_uploads.js --ghi --toithieu=300     -> chỉ nén file lớn hơn 300 KB
     node utils/nen_anh_uploads.js --ghi --khong-backup     -> KHÔNG giữ ảnh gốc (tiết kiệm ổ đĩa)

   AN TOÀN: mặc định là chạy thử (dry-run). Khi --ghi, ảnh gốc được DI CHUYỂN vào uploads/_goc/ trước
   khi ghi bản đã nén — muốn quay lại chỉ cần copy ngược từ _goc. Ảnh nào sharp không đọc được thì BỎ QUA
   (không bao giờ ghi ra file rỗng). Ảnh nền trong suốt (PNG có alpha) được giữ định dạng PNG.
   Chạy lại nhiều lần vô hại: ảnh đã nhỏ/đã đúng cỡ sẽ bị bỏ qua.
   ================================================================================================== */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

/* v6.07.1 — SỬA LỖI "UNKNOWN: unknown error, open '...jpg'" khi ghi file (chỉ gặp trên Windows).
   Nguyên nhân: nén xong rồi mới lỗi, tức là lỗi ở bước GHI. Nếu đưa ĐƯỜNG DẪN cho sharp thì libvips
   còn GIỮ file đang mở (và nhớ đệm nó) — Windows không cho ghi/copy đè lên file đang bị giữ, nên báo
   UNKNOWN. 2 việc phải làm:
     1) sharp.cache(false) — không cho libvips giữ file trong bộ nhớ đệm.
     2) Đọc file vào BỘ NHỚ trước (fs.readFileSync) rồi mới đưa buffer cho sharp — sharp không mở file
        nào cả nên không còn ai giữ file lúc ghi.
   Kèm theo: ghi ra file .tmp rồi ĐỔI TÊN đè lên (rename) — nếu có lỗi giữa đường thì ảnh cũ vẫn nguyên,
   không bao giờ để lại file ghi dở. */
sharp.cache(false);

const uploadDir = path.join(__dirname, '..', 'uploads');
const backupDir = path.join(uploadDir, '_goc');

const args = process.argv.slice(2);
const co = (ten) => args.indexOf(ten) !== -1;
const soCua = (ten, macDinh) => {
  const t = args.find(a => a.indexOf(ten + '=') === 0);
  const n = t ? Number(t.split('=')[1]) : NaN;
  return Number.isFinite(n) && n > 0 ? n : macDinh;
};

const GHI = co('--ghi');
const CANH = soCua('--canh', 1600);
const CHAT_LUONG = soCua('--chatluong', 82);
const TOI_THIEU_KB = soCua('--toithieu', 250);   // file nhỏ hơn mức này thì không cần nén
const KHONG_BACKUP = co('--khong-backup');

const LA_ANH = /\.(jpg|jpeg|png|webp|bmp|tif|tiff)$/i;
const kb = (n) => Math.round(n / 1024);

async function main() {
  if (!fs.existsSync(uploadDir)) {
    console.error('Khong tim thay thu muc:', uploadDir);
    process.exit(1);
  }
  const files = fs.readdirSync(uploadDir).filter(f => {
    const p = path.join(uploadDir, f);
    return LA_ANH.test(f) && fs.statSync(p).isFile();
  });
  console.log(`Thu muc: ${uploadDir}`);
  console.log(`Tim thay ${files.length} anh. Cach lam: canh dai toi da ${CANH}px, JPEG q${CHAT_LUONG}, chi nen file > ${TOI_THIEU_KB} KB.`);
  console.log(GHI ? '>>> CHE DO GHI THAT.' : '>>> CHAY THU (khong sua gi). Them --ghi de nen that.');
  console.log('');

  let soNen = 0, soBoQua = 0, soLoi = 0, tongTruoc = 0, tongSau = 0;
  for (const f of files) {
    const p = path.join(uploadDir, f);
    const cuByte = fs.statSync(p).size;
    const cuKB = kb(cuByte);
    try {
      // ĐỌC VÀO BỘ NHỚ rồi mới đưa cho sharp -> không file nào bị giữ khi ghi (xem ghi chú đầu file).
      const goc = fs.readFileSync(p);
      const meta = await sharp(goc, { failOn: 'none' }).metadata();
      const canhDai = Math.max(meta.width || 0, meta.height || 0);
      if (cuKB <= TOI_THIEU_KB && canhDai <= CANH) { soBoQua++; continue; }

      let xuLy = sharp(goc, { failOn: 'none' }).rotate()
        .resize({ width: CANH, height: CANH, fit: 'inside', withoutEnlargement: true });
      xuLy = meta.hasAlpha ? xuLy.png({ compressionLevel: 9 }) : xuLy.jpeg({ quality: CHAT_LUONG, mozjpeg: true });
      const buf = await xuLy.toBuffer();

      // Nén ra lớn hơn bản cũ (ảnh đã tối ưu sẵn) -> giữ nguyên, không làm xấu đi.
      if (buf.length >= cuByte) { soBoQua++; continue; }

      if (GHI) {
        if (!KHONG_BACKUP) {
          if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
          const dich = path.join(backupDir, f);
          if (!fs.existsSync(dich)) fs.writeFileSync(dich, goc);   // giữ ảnh gốc (ghi từ buffer đã đọc)
        }
        // Ghi file tạm rồi đổi tên đè lên: lỗi giữa đường thì ảnh cũ vẫn còn nguyên.
        const tmp = p + '.tmp';
        fs.writeFileSync(tmp, buf);
        fs.renameSync(tmp, p);   // GIỮ NGUYÊN TÊN FILE -> đường dẫn trong CSDL không đổi
      }
      tongTruoc += cuKB; tongSau += kb(buf.length); soNen++;
      console.log(`${GHI ? 'DA NEN ' : 'SE NEN '} ${f}  ${cuKB} KB -> ${kb(buf.length)} KB  (${canhDai}px -> toi da ${CANH}px)`);
    } catch (err) {
      soLoi++;
      console.log(`LOI  ${f}: ${err.message} (bo qua, khong sua file)`);
      try { if (fs.existsSync(p + '.tmp')) fs.unlinkSync(p + '.tmp'); } catch (e) { }
    }
  }

  console.log('');
  console.log(`Xong. Nen: ${soNen} anh | Bo qua: ${soBoQua} | Loi: ${soLoi}`);
  if (soNen) console.log(`Dung luong: ${tongTruoc} KB -> ${tongSau} KB (giam ${Math.max(0, tongTruoc - tongSau)} KB)`);
  if (GHI && !KHONG_BACKUP && soNen) console.log(`Anh goc da luu tai: ${backupDir} (kiem tra xong co the xoa tay de tiet kiem o dia)`);
  if (GHI && soNen) console.log('LUU Y: xoa thu muc uploads/.thumb (anh xem truoc dem) de he thong tao lai theo anh moi.');
}

main().catch(err => { console.error(err); process.exit(1); });
