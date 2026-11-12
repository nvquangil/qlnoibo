/* ================================================================================================
   BÁO HỎNG SAO LƯU QUA EMAIL                                                               v9.37
   ------------------------------------------------------------------------------------------------
   Nguyen 2026-11-10 chọn: "Hiện trên màn hình phần mềm + email".

   Dùng LẠI cấu hình SMTP đã có của utils/checkOverdue.js (`SMTP_HOST/PORT/USER/PASS`) — không khai
   bộ biến môi trường thứ hai cho cùng một hộp thư, hai bộ là sớm muộn lệch nhau rồi email im lặng.

   🔴 BA LUẬT:
   1. **Gửi email hỏng TUYỆT ĐỐI không được làm hỏng việc sao lưu.** Mọi lỗi gửi mail đều nuốt tại
      chỗ, chỉ ghi log. Sao lưu đã xong là xong, không có chuyện SMTP sai mật khẩu mà báo "thất bại".
   2. **Không spam.** Sao lưu hỏng liên tiếp 10 ngày thì gửi tối đa 1 email/ngày, không 10 cái/ngày.
      Chuyển từ HỎNG sang CHẠY LẠI ĐƯỢC thì gửi MỘT email báo đã bình thường — người nhận cần biết
      là hết lo, không thì họ cứ nơm nớp.
   3. **KHÔNG đính kèm file .bak.** Nó là toàn bộ dữ liệu công ty; gửi qua email là phát tán.
   ================================================================================================ */
const saoLuu = require('./saoLuuCSDL');

let __lanBaoHongCuoi = 0;     // mốc thời gian email hỏng gần nhất
let __dangHong = false;       // lần chạy trước có hỏng không (để biết lúc nào "đã bình thường lại")
const CACH_NHAU_MS = 20 * 60 * 60 * 1000;   // tối đa 1 email hỏng mỗi ~20 giờ
/* v9.40: mốc RIÊNG cho bản sao ngoài máy — dùng chung mốc với lỗi chính thì một loại lỗi sẽ bịt
   miệng loại kia, và loại bị bịt luôn là loại ít gây chú ý hơn. */
let __lanBaoPhuCuoi = 0;
let __dangHongPhu = false;
let __lanBaoXoaCuoi = 0;   // v9.44 — đã xóa bản sao lưu để lấy chỗ

/* 🔴 ĐỌC CẤU HÌNH TRÊN MÀN HÌNH TRƯỚC, .env chỉ là dự phòng.
   Bản đầu chỉ đọc `process.env` — nên ô "Email nhận cảnh báo" trên màn hình lưu được, hiện được,
   báo "Đã lưu" màu xanh, và KHÔNG AI ĐỌC. Người dùng gõ email vào rồi tin rằng mình đã được bảo vệ;
   tới hôm sao lưu hỏng thì không có email nào. Đây đúng loại hỏng tệ nhất của một tính năng sao lưu:
   nó không gây lỗi, nó chỉ làm người ta yên tâm nhầm. */
function nguoiNhan() {
  let tuManHinh = '';
  try { tuManHinh = String(saoLuu.cauHinh().emailBao || ''); } catch (e) { /* chưa nạp được */ }
  return String(tuManHinh || process.env.BACKUP_EMAIL_BAO || '')
    .split(/[;,]/).map(s => s.trim()).filter(Boolean);
}

function thuMucHienTai() {
  try { return saoLuu.cauHinh().thuMuc || ''; } catch (e) { return ''; }
}

async function guiMail(tieuDe, than) {
  const to = nguoiNhan();
  if (!to.length || !process.env.SMTP_HOST) return false;
  try {
    const nodemailer = require('nodemailer');
    const tr = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 465,
      secure: String(process.env.SMTP_SECURE || 'true') !== 'false',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
    await tr.sendMail({ from: process.env.SMTP_USER, to: to.join(','), subject: tieuDe, text: than });
    return true;
  } catch (e) {
    /* LUẬT 1 — nuốt tại chỗ. */
    console.error('[saoluu] không gửi được email báo: ' + (e && e.message));
    return false;
  }
}

/* Chạy một lần sao lưu rồi báo nếu cần. `nguon` = 'lich' | 'bu' | 'tay'. */
async function chayVaBao(nguon) {
  const kq = await saoLuu.chayMotLan(nguon);

  if (!kq.thanhCong) {
    /* "Đang có một lần sao lưu chạy dở — bỏ qua lần này" KHÔNG phải lỗi: đó là hành vi đúng (chống
       chạy chồng giữa cron và nút bấm tay). Gửi email 🔴 THẤT BẠI cho nó là dạy người nhận bỏ qua
       email của màn sao lưu — và email bị bỏ qua thì lần hỏng THẬT cũng không ai đọc. */
    const laHoan = /bỏ qua lần này|hoãn lần/.test(kq.thongDiep || '');
    if (laHoan) return kq;
    const nay = Date.now();
    if (nay - __lanBaoHongCuoi >= CACH_NHAU_MS) {      // LUẬT 2 — không spam
      __lanBaoHongCuoi = nay;
      let tt = null;
      try { tt = await saoLuu.trangThai(); } catch (e) { /* CSDL đang lỗi thì thôi */ }
      const banGanNhat = tt && tt.moiNhat
        ? `${tt.moiNhat.ten} lúc ${new Date(tt.moiNhat.luc).toLocaleString('vi-VN')}`
        : 'CHƯA CÓ BẢN NÀO';
      await guiMail('🔴 QLNoiBo: SAO LƯU CSDL THẤT BẠI',
        'Lần sao lưu lúc ' + new Date().toLocaleString('vi-VN') + ' KHÔNG thành công.\n\n'
        + 'Lý do: ' + kq.thongDiep + '\n\n'
        + 'Bản sao lưu còn dùng được gần nhất: ' + banGanNhat + '\n'
        /* `saoLuu.THU_MUC` KHÔNG tồn tại (thư mục nay nằm trong cấu hình, không còn là hằng số xuất
           ra) ⇒ email luôn in "(chưa khai)". Mà lỗi hay gặp nhất lại đúng là lỗi thư mục — email
           cứu hỏa mà không nói được thư mục nào thì vô dụng. */
        + 'Thư mục: ' + (thuMucHienTai() || '(chưa khai)') + '\n\n'
        + 'Vào phần mềm, phân hệ "💾 Sao lưu dữ liệu" để xem chi tiết và bấm "Sao lưu ngay" sau khi xử lý.\n'
        + '(Email này tối đa 1 lần/ngày dù lỗi lặp lại.)');
    }
    __dangHong = true;
    return kq;
  }

  if (__dangHong) {       // LUẬT 2 — báo đã bình thường trở lại
    __dangHong = false;
    __lanBaoHongCuoi = 0;
    await guiMail('✅ QLNoiBo: sao lưu CSDL đã chạy lại bình thường',
      'Lần sao lưu lúc ' + new Date().toLocaleString('vi-VN') + ' đã thành công.\n'
      + kq.thongDiep + '\n\nKhông cần làm gì thêm.');
  }

  /* v9.44 — ĐÃ XÓA BẢN SAO LƯU ĐỂ LẤY CHỖ. Lần sao lưu THÀNH CÔNG nên không đi qua nhánh lỗi, nhưng
     xóa bản sao lưu là thao tác KHÔNG ĐẢO NGƯỢC — thành công mà im lặng là sai. Email mỗi lần có
     xóa (mốc chống spam riêng ~20h), kèm cảnh báo nếu vẫn dưới ngưỡng: lúc đó thứ ăn ổ không phải bản
     sao lưu, và người nhận phải đi tìm nó trước khi lịch sử mòn hết. */
  if (kq.daXoaLayCho > 0 || kq.duoiNguong) {
    const nay = Date.now();
    if (nay - __lanBaoXoaCuoi >= CACH_NHAU_MS) {
      __lanBaoXoaCuoi = nay;
      await guiMail((kq.duoiNguong ? '🔴' : '⚠️') + ' QLNoiBo: đã xóa ' + (kq.daXoaLayCho || 0) + ' bản sao lưu cũ để lấy chỗ',
        'Lần sao lưu lúc ' + new Date().toLocaleString('vi-VN') + ' THÀNH CÔNG, nhưng ổ đích dưới ngưỡng '
        + 'giữ trống nên phần mềm đã XÓA ' + (kq.daXoaLayCho || 0) + ' bản sao lưu đầy đủ cũ nhất '
        + '(kèm các bản log cũ hơn chúng).\n\n' + kq.thongDiep + '\n\n'
        + (kq.duoiNguong
            ? '🔴 Sau khi xóa VẪN dưới ngưỡng. Phần mềm chỉ xóa tối đa 3 bản mỗi lần, nên nếu không xử lý '
              + 'thì mỗi đêm mất thêm 3 bản cho tới khi chỉ còn "luôn giữ ít nhất". Thứ đang chiếm ổ gần như '
              + 'chắc chắn KHÔNG phải bản sao lưu — kiểm file .ldf của CSDL (chế độ FULL recovery mà chưa '
              + 'sao lưu log thì nó phình vô hạn).\n'
            : 'Ổ đã trở lại trên ngưỡng. Đây là hành vi bình thường: mỗi đêm một bản mới vào, một bản cũ nhất ra.\n')
        + '(Email này tối đa 1 lần/ngày.)');
    }
  }

  /* v9.40 — BẢN SAO NGOÀI MÁY HỎNG. Sao lưu trong máy ĐÃ thành công nên không gọi nó là thất bại.
     Nhưng cũng không được để nó chìm vào dòng chữ "Sao lưu xong": mất bản ngoài máy là mất đúng
     tuyến phòng thủ cho trường hợp tệ nhất (hỏng ổ, mã độc tống tiền), và người ta chỉ phát hiện
     đúng vào lúc cần tới nó. Kênh báo RIÊNG, mốc chống spam RIÊNG. */
  if (kq.loiPhu) {
    const nay = Date.now();
    if (nay - __lanBaoPhuCuoi >= CACH_NHAU_MS) {
      __lanBaoPhuCuoi = nay;
      await guiMail('⚠️ QLNoiBo: bản sao lưu NGOÀI MÁY không chép được',
        'Sao lưu vào máy chủ THÀNH CÔNG (' + (kq.tenFile || '') + ').\n'
        + 'Nhưng bước chép sang thư mục thứ hai đã HỎNG:\n\n' + kq.loiPhu + '\n\n'
        + 'Hệ quả: hiện chỉ còn MỘT bản, nằm trên chính máy chủ. Hỏng ổ hoặc dính mã độc tống tiền '
        + 'là mất cả dữ liệu lẫn bản sao lưu.\n'
        + '(Email này tối đa 1 lần/ngày dù lỗi lặp lại.)');
    }
  } else if (__dangHongPhu) {
    __dangHongPhu = false;
    __lanBaoPhuCuoi = 0;
  }
  __dangHongPhu = !!kq.loiPhu;
  return kq;
}

/* ================================================================================================
   v9.41 — SAO LƯU LOG: kênh báo RIÊNG
   ------------------------------------------------------------------------------------------------
   🔴 Lịch log chạy MỖI GIỜ. Dùng chung mốc chống spam với sao lưu đầy đủ thì một lỗi log lặp lại sẽ
   nuốt mất email của một lỗi sao lưu đầy đủ xảy ra cùng ngày — và lỗi bị nuốt luôn là lỗi nghiêm
   trọng hơn. Mốc riêng, và vẫn tối đa 1 email/~20 giờ.
   ================================================================================================ */
let __lanBaoLogCuoi = 0;
let __dangHongLog = false;

async function chayLogVaBao(nguon) {
  const kq = await saoLuu.chayLogMotLan(nguon);

  if (!kq.thanhCong) {
    /* "Đang chạy sao lưu đầy đủ — hoãn lần này" KHÔNG phải lỗi: đó là hành vi đúng, mỗi ngày đúng
       một lần. Báo động cho nó là dạy người nhận bỏ qua email. */
    const laHoan = /bỏ qua lần này|hoãn lần sao lưu log này/.test(kq.thongDiep || '');
    const nay = Date.now();
    if (!laHoan && nay - __lanBaoLogCuoi >= CACH_NHAU_MS) {
      __lanBaoLogCuoi = nay;
      await guiMail('🔴 QLNoiBo: SAO LƯU TRANSACTION LOG THẤT BẠI',
        'Lần sao lưu log lúc ' + new Date().toLocaleString('vi-VN') + ' KHÔNG thành công.\n\n'
        + 'Lý do: ' + kq.thongDiep + '\n\n'
        /* 🔴 KHÔNG được viết "chuỗi log đứt". `BACKUP LOG` nối tiếp từ lần THÀNH CÔNG gần nhất, không
           phải từ lần CHẠY gần nhất: bỏ lỡ 5 lượt rồi lượt thứ 6 chạy được thì bản .trn đó chứa
           TOÀN BỘ log của 6 giờ, và khôi phục về bất kỳ điểm nào trong 6 giờ đó vẫn được. Chuỗi chỉ
           đứt khi chuyển sang SIMPLE, dùng TRUNCATE_ONLY/NO_LOG, hoặc đã restore CSDL.
           Nói sai theo chiều bi quan vẫn có hại: người đọc tin "đằng nào cũng đứt rồi" có thể đi xóa
           tay file .trn hoặc chuyển sang SIMPLE — tức tự gây ra đúng cái mất mát mà email cảnh báo. */
        + 'Hệ quả nếu không xử lý:\n'
        + '  1. Log KHÔNG được cắt ⇒ file .ldf tiếp tục phình cho tới khi đầy ổ đĩa. Đây là hệ quả\n'
        + '     nghiêm trọng và nó TÍCH LŨY theo thời gian.\n'
        + '  2. Khả năng khôi phục về thời điểm KHÔNG mất: lần sao lưu log thành công kế tiếp sẽ\n'
        + '     gom lại toàn bộ khoảng thời gian này.\n'
        + '  (Bản sao lưu đầy đủ hằng ngày vẫn chạy bình thường và vẫn khôi phục được.)\n\n'
        + 'Thư mục: ' + (thuMucHienTai() || '(chưa khai)') + '\n'
        + '(Email này tối đa 1 lần/ngày dù lỗi lặp lại mỗi giờ.)');
    }
    if (!laHoan) __dangHongLog = true;
    return kq;
  }

  if (__dangHongLog) {
    __dangHongLog = false;
    __lanBaoLogCuoi = 0;
    await guiMail('✅ QLNoiBo: sao lưu transaction log đã chạy lại bình thường',
      'Lần sao lưu log lúc ' + new Date().toLocaleString('vi-VN') + ' đã thành công.\n'
      + kq.thongDiep + '\n\nBản log này gom cả khoảng thời gian bị lỗi vừa rồi, nên khả năng khôi '
      + 'phục về thời điểm KHÔNG bị mất. Không cần làm gì thêm.');
  }
  return kq;
}

module.exports = { chayVaBao, chayLogVaBao, guiMail, nguoiNhan };
