/* ==================================================================================================
   ĐÁNH DẤU PHIẾU BÁN HÀNG CŨ LÀ "HÀNG GỬI MẪU / CHO KHÁCH MƯỢN"            (v7.59)
   --------------------------------------------------------------------------------------------------
   migration_v693 CỐ Ý không backfill: không có cách nào suy ra phiếu cũ nào là gửi mẫu. Công cụ này
   để đánh dấu ngược các phiếu đã lập TRƯỚC khi nâng cấp.

   ⚠️ VÌ SAO KHÔNG DÙNG "SỬA PHIẾU" TRÊN GIAO DIỆN:
     · Phiếu ĐÃ CÓ PHIẾU THU thì màn Sửa phiếu CHẶN thẳng ("xóa phiếu thu đó trước khi sửa").
     · Sửa phiếu chạy lại CẢ cỗ máy: hoàn tồn theo phiếu cũ -> trừ lại theo số mới, XÓA rồi TẠO LẠI
       đơn phản chiếu. Về số là bằng 0, nhưng chạy ngần ấy thứ chỉ để bật một cái cờ là rủi ro thừa.
   Công cụ này chỉ chạy đúng MỘT câu:
        UPDATE PhieuBanHang SET LaHangMau = 0/1 WHERE PhieuBHID = @id
   KHÔNG đụng tồn kho, KHÔNG đụng tiền, KHÔNG đụng công nợ, KHÔNG đụng đơn khách đặt.

   CÁC CHẾ ĐỘ (mặc định KHÔNG sửa gì — luôn xem trước rồi mới thêm --ghi):

     node utils/danh_dau_hang_mau.js
         -> BÁO CÁO: liệt kê các phiếu ĐANG được đánh dấu hàng mẫu + số còn ở khách. Không sửa gì.

     node utils/danh_dau_hang_mau.js --sophieu=PBH26041,PBH26055
         -> XEM TRƯỚC: các phiếu đó gồm dòng hàng gì, đã trả bao nhiêu, đánh dấu xong sổ sẽ hiện gì.

     node utils/danh_dau_hang_mau.js --sophieu=PBH26041,PBH26055 --ghi
         -> ĐÁNH DẤU thật.

     node utils/danh_dau_hang_mau.js --sophieu=PBH26041 --bo --ghi
         -> GỠ dấu (đánh nhầm thì gỡ ra).

   PHIẾU CŨ ĐANG GHI "hàng gửi mẫu" Ở Ô GHI CHÚ thì dùng --ghichu, khỏi phải gõ từng số phiếu:

     node utils/danh_dau_hang_mau.js --ghichu="gửi mẫu"          << XEM TRƯỚC
     node utils/danh_dau_hang_mau.js --ghichu="gửi mẫu" --ghi

   Chạy không kèm điều kiện nào thì công cụ TỰ RÀ ô Ghi chú (các chữ "mẫu", "mượn") và liệt kê những
   phiếu NGHI LÀ hàng mẫu mà chưa được đánh dấu — cứ chạy trước để xem có bao nhiêu.

   Cách chọn phiếu (dùng được đồng thời, các điều kiện CỘNG DỒN):
     --sophieu=PBH26041,PBH26055   theo số phiếu (không phân biệt hoa thường)
     --ghichu="gửi mẫu"            Ghi chú của phiếu CÓ CHỨA chuỗi này (không phân biệt hoa thường)
     --khach="Shop A"              theo TÊN khách (đúng nguyên văn, đã cắt khoảng trắng 2 đầu)
     --mahang=AAA,BBB              phiếu có chứa các mã hàng này
     --tu=2026-06-01 --den=2026-08-31   theo ngày bán

   Tùy chọn thêm:
     --bo                gỡ dấu thay vì đánh dấu
     --ghi               THỰC SỰ ghi (không có thì chỉ xem trước)
     --khong-hoi         bỏ bước gõ xác nhận
     --khong-backup      không ghi file sao lưu (KHÔNG khuyến khích)
     --ca-phieu-huy      làm cả phiếu ĐÃ HỦY (mặc định BỎ QUA — sổ hàng mẫu vốn không đếm phiếu hủy
                         nên đánh dấu chúng không có tác dụng gì)

   AN TOÀN: trước khi ghi, trạng thái cờ cũ của từng phiếu được lưu ra
   backend/backup/hangmau_<thời điểm>.json — gỡ ngược lại được bằng tay nếu cần.
   ================================================================================================== */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { sql, getPool } = require('../db');
const { layDongDaBan, coCotHangMau } = require('./dongDaBanChoKhach');

const args = process.argv.slice(2);
const co = (t) => args.indexOf(t) !== -1;
const layChuoi = (t) => { const a = args.find(x => x.indexOf(t + '=') === 0); return a ? a.split('=').slice(1).join('=') : ''; };
const dsChuoi = (t) => layChuoi(t).split(',').map(s => s.trim()).filter(Boolean);

const GHI = co('--ghi');
const BO_DAU = co('--bo');
const KHONG_HOI = co('--khong-hoi');
const KHONG_BACKUP = co('--khong-backup');
const CA_PHIEU_HUY = co('--ca-phieu-huy');
const DS_SO_PHIEU = dsChuoi('--sophieu');
const DS_MA_HANG = dsChuoi('--mahang');
const KHACH = layChuoi('--khach').trim();
const GHI_CHU = layChuoi('--ghichu').trim();
const TU = layChuoi('--tu').trim();
const DEN = layChuoi('--den').trim();

const GIA_TRI_MOI = BO_DAU ? 0 : 1;
const COL_LOC = DS_SO_PHIEU.length || DS_MA_HANG.length || KHACH || GHI_CHU || TU || DEN;

/* Từ khóa dùng khi TỰ RÀ ô Ghi chú (chế độ báo cáo). Để nguyên dấu vì người dùng gõ có dấu; nếu
   collation của database là accent-insensitive thì bản không dấu cũng khớp — nhưng KHÔNG thêm "mau"
   không dấu vào đây, vì khi đó nó sẽ khớp luôn chữ "màu" (màu sắc) vốn có mặt ở rất nhiều ghi chú. */
const TU_KHOA_NGHI = ['mẫu', 'mượn'];

/* LIKE: ký tự % _ [ trong chuỗi người dùng gõ phải được thoát, kẻo gõ "50%" thành ký tự đại diện. */
const thoatLike = (s) => String(s).replace(/([%_\[])/g, '[$1]');

const so = (v) => Number(v || 0);
const tienVN = (v) => so(v).toLocaleString('vi-VN');
const hai = (n) => String(n).padStart(2, '0');
const ngayVN = (d) => { const x = new Date(d); return isNaN(x) ? '' : `${hai(x.getDate())}/${hai(x.getMonth() + 1)}/${x.getFullYear()}`; };

function hoiXacNhan(cauHoi) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(cauHoi, (tl) => { rl.close(); resolve(String(tl || '').trim()); });
  });
}

(async () => {
  const pool = await getPool();

  /* ---------- 0. Chưa chạy migration thì dừng ngay, nói rõ phải làm gì ---------- */
  if (!await coCotHangMau(pool)) {
    console.log('');
    console.log('DUNG: chua co cot PhieuBanHang.LaHangMau.');
    console.log('Chay database/migration_v693.sql trong SSMS truoc, roi chay lai cong cu nay.');
    process.exit(1);
  }

  /* ---------- 1. Không truyền điều kiện lọc nào -> chỉ BÁO CÁO ---------- */
  if (!COL_LOC) {
    const dsMau = await layDongDaBan(pool, sql, { chiHangMau: true });
    console.log('');
    console.log('=== CAC PHIEU DANG DUOC DANH DAU LA HANG MAU ===');
    if (!dsMau.length) {
      console.log('  (chua co phieu nao)');
    } else {
      const theoPhieu = new Map();
      dsMau.forEach(r => {
        if (!theoPhieu.has(r.SoPhieu)) theoPhieu.set(r.SoPhieu, { ngay: r.NgayBan, khach: r.TenKhach, dong: [] });
        theoPhieu.get(r.SoPhieu).dong.push(r);
      });
      theoPhieu.forEach((v, sp) => {
        const con = v.dong.reduce((a, r) => a + so(r.ConTraCai), 0);
        console.log(`  ${sp} · ${ngayVN(v.ngay)} · ${v.khach} · ${v.dong.length} dong · con o khach ${tienVN(con)}`);
      });
      console.log(`  --- Tong ${theoPhieu.size} phieu.`);
    }

    /* ---- TU RA O GHI CHU: phieu cu thuong duoc ghi tay "hang gui mau" o o Ghi chu ---- */
    const rqNghi = pool.request();
    TU_KHOA_NGHI.forEach((k, i) => rqNghi.input('k' + i, sql.NVarChar, '%' + thoatLike(k) + '%'));
    const nghi = (await rqNghi.query(`
      SELECT p.PhieuBHID, p.SoPhieu, p.NgayBan, p.TenKhach, p.GhiChu, p.TongThanhToan, p.TrangThai,
             ISNULL((SELECT SUM(t.SoTien) FROM PhieuThu t WHERE t.PhieuBHID = p.PhieuBHID), 0) AS DaThu
      FROM PhieuBanHang p
      WHERE p.TrangThai <> N'Đã hủy' AND ISNULL(p.LaHangMau, 0) = 0
        AND (${TU_KHOA_NGHI.map((k, i) => `p.GhiChu LIKE @k${i}`).join(' OR ')})
      ORDER BY p.NgayBan, p.PhieuBHID`)).recordset;

    console.log('');
    console.log('=== NGHI LA HANG MAU (Ghi chu co chu "' + TU_KHOA_NGHI.join('" hoac "') + '") MA CHUA DUOC DANH DAU ===');
    if (!nghi.length) {
      console.log('  (khong co)');
    } else {
      nghi.forEach(p => console.log(`  ${p.SoPhieu} · ${ngayVN(p.NgayBan)} · ${p.TenKhach}`
        + ` · ${tienVN(p.TongThanhToan)} d${so(p.DaThu) > 0 ? ' · da thu ' + tienVN(p.DaThu) : ''}`
        + `\n        ghi chu: ${String(p.GhiChu || '').replace(/\s+/g, ' ').slice(0, 120)}`));
      console.log(`  --- ${nghi.length} phieu. DOC KY roi hay danh dau: cong cu chi DO CHU, khong hieu y.`);
      console.log('');
      console.log('  Danh dau tat ca chung (xem truoc truoc, bo --ghi):');
      console.log('      node utils/danh_dau_hang_mau.js --ghichu="mẫu"');
      console.log('  Hoac chon rieng vai phieu:');
      console.log('      node utils/danh_dau_hang_mau.js --sophieu=' + nghi.slice(0, 3).map(p => p.SoPhieu).join(','));
    }

    console.log('');
    console.log('Xem day du tuy chon: mo dau file nay.');
    process.exit(0);
  }

  /* ---------- 2. Tìm các phiếu khớp điều kiện ---------- */
  const rq = pool.request();
  const dieuKien = ["1 = 1"];
  if (!CA_PHIEU_HUY) dieuKien.push("p.TrangThai <> N'Đã hủy'");
  if (DS_SO_PHIEU.length) {
    /* Ghép tham số riêng cho từng số phiếu — KHÔNG nối chuỗi vào câu SQL. */
    const ten = DS_SO_PHIEU.map((v, i) => { rq.input('sp' + i, sql.NVarChar, v); return '@sp' + i; });
    dieuKien.push(`UPPER(LTRIM(RTRIM(p.SoPhieu))) IN (${ten.map((t, i) => `UPPER(${t})`).join(', ')})`);
  }
  if (KHACH) { rq.input('kh', sql.NVarChar, KHACH); dieuKien.push('LTRIM(RTRIM(p.TenKhach)) = @kh'); }
  if (GHI_CHU) { rq.input('gc', sql.NVarChar, '%' + thoatLike(GHI_CHU) + '%'); dieuKien.push('p.GhiChu LIKE @gc'); }
  if (TU) { rq.input('tu', sql.Date, TU); dieuKien.push('p.NgayBan >= @tu'); }
  if (DEN) { rq.input('den', sql.Date, DEN); dieuKien.push('p.NgayBan <= @den'); }
  if (DS_MA_HANG.length) {
    const ten = DS_MA_HANG.map((v, i) => { rq.input('mh' + i, sql.NVarChar, v); return '@mh' + i; });
    dieuKien.push(`EXISTS (SELECT 1 FROM PhieuBanHangChiTiet ct2 JOIN TheKhoHangHoa h2 ON h2.MaHangID = ct2.MaHangID
                            WHERE ct2.PhieuBHID = p.PhieuBHID
                              AND UPPER(LTRIM(RTRIM(h2.MaHang))) IN (${ten.map(t => `UPPER(${t})`).join(', ')}))`);
  }

  const phieu = (await rq.query(`
    SELECT p.PhieuBHID, p.SoPhieu, p.NgayBan, p.TenKhach, p.TongSLCai, p.TongThanhToan, p.TrangThai,
           p.GhiChu, ISNULL(p.LaHangMau, 0) AS LaHangMau,
           ISNULL((SELECT SUM(t.SoTien) FROM PhieuThu t WHERE t.PhieuBHID = p.PhieuBHID), 0) AS DaThu
    FROM PhieuBanHang p
    WHERE ${dieuKien.join(' AND ')}
    ORDER BY p.NgayBan, p.PhieuBHID`)).recordset;

  if (!phieu.length) {
    console.log('');
    console.log('Khong tim thay phieu nao khop dieu kien.');
    if (DS_SO_PHIEU.length) console.log('So phieu da tim: ' + DS_SO_PHIEU.join(', '));
    if (!CA_PHIEU_HUY) console.log('(Dang BO QUA phieu da huy — them --ca-phieu-huy neu muon tinh ca chung.)');
    process.exit(1);
  }
  /* Số phiếu gõ vào mà không tìm thấy -> nói rõ, kẻo gõ sai một mã rồi tưởng đã đánh dấu hết. */
  if (DS_SO_PHIEU.length) {
    const thay = new Set(phieu.map(p => String(p.SoPhieu).trim().toUpperCase()));
    const thieu = DS_SO_PHIEU.filter(s => !thay.has(s.toUpperCase()));
    if (thieu.length) {
      console.log('');
      console.log('!! KHONG TIM THAY cac so phieu sau (go sai? hoac phieu da huy?): ' + thieu.join(', '));
    }
  }

  /* ---------- 3. Xem trước: từng phiếu gồm dòng gì, đã trả bao nhiêu ---------- */
  console.log('');
  console.log(`=== ${BO_DAU ? 'GO DAU' : 'DANH DAU'} HANG MAU — ${GHI ? 'CHE DO GHI THAT' : 'XEM TRUOC (chua sua gi)'} ===`);
  console.log('');

  const canSua = [], khongDoi = [];
  for (const p of phieu) {
    const dangCo = Number(p.LaHangMau) === 1;
    const doi = (GIA_TRI_MOI === 1) !== dangCo;
    (doi ? canSua : khongDoi).push(p);

    /* Dùng CHÍNH công thức của hệ thống (utils/dongDaBanChoKhach.js) để xem đánh dấu xong sổ sẽ ra
       số gì — không tự tính lại ở đây, kẻo công cụ và màn hình nói hai con số khác nhau. */
    const dong = await layDongDaBan(pool, sql, { phieuBHID: p.PhieuBHID });
    const conTong = dong.reduce((a, r) => a + so(r.ConTraCai), 0);

    console.log(`${doi ? '>>' : '  '} ${p.SoPhieu} · ${ngayVN(p.NgayBan)} · ${p.TenKhach}`
      + ` · ${tienVN(p.TongThanhToan)} d · ${p.TrangThai}`
      + `  [co hien tai: ${dangCo ? 'HANG MAU' : 'ban thuong'}${doi ? ' -> ' + (GIA_TRI_MOI ? 'HANG MAU' : 'ban thuong') : ' (khong doi)'}]`);
    /* In nguyen Ghi chu de doi chieu bang mat — phieu cu duoc phan biet bang chinh o nay. */
    if (p.GhiChu) console.log(`     ghi chu: ${String(p.GhiChu).replace(/\s+/g, ' ')}`);
    if (so(p.DaThu) > 0) {
      console.log(`     (phieu nay da thu ${tienVN(p.DaThu)} d — man Sua phieu se chan, nhung cong cu nay van danh dau duoc`);
      console.log(`      vi chi ghi mot cai co, khong dung toi tien.)`);
    }
    dong.forEach(r => {
      console.log(`     - ${r.MaHang}${r.TenMau ? ' · ' + r.TenMau : ''}`
        + ` : gui ${tienVN(r.SoLuongCai)} ${r.DonViCoBan || 'Cái'}`
        + ` · da tra ${tienVN(r.DaTraCai)}`
        + ` · CON O KHACH ${tienVN(r.ConTraCai)}`);
    });
    if (GIA_TRI_MOI === 1) {
      console.log(`     => sau khi danh dau, so "Hang mau o khach" se hien tong ${tienVN(conTong)} con o khach.`);
    }
    console.log('');
  }

  console.log('----------------------------------------------------------------');
  console.log(`Tong: ${phieu.length} phieu khop · ${canSua.length} phieu SE DOI · ${khongDoi.length} phieu giu nguyen.`);

  if (!canSua.length) {
    console.log('Khong co gi de sua.');
    process.exit(0);
  }
  if (!GHI) {
    console.log('');
    console.log('Day moi la XEM TRUOC — chua sua gi. Chay lai kem --ghi de thuc su ' + (BO_DAU ? 'go dau:' : 'danh dau:'));
    console.log('    node utils/danh_dau_hang_mau.js ' + args.join(' ') + ' --ghi');
    process.exit(0);
  }

  /* ---------- 4. Sao lưu trạng thái cũ ---------- */
  if (!KHONG_BACKUP) {
    const backupDir = path.join(__dirname, '..', 'backup');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const f = path.join(backupDir, `hangmau_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(f, JSON.stringify({
      thoiDiem: new Date().toISOString(),
      lenh: 'node utils/danh_dau_hang_mau.js ' + args.join(' '),
      truocKhiSua: canSua.map(p => ({ PhieuBHID: p.PhieuBHID, SoPhieu: p.SoPhieu, LaHangMau: Number(p.LaHangMau) }))
    }, null, 1), 'utf8');
    console.log('Da luu trang thai cu vao: ' + f);
  }

  /* ---------- 5. Xác nhận ---------- */
  if (!KHONG_HOI) {
    const tl = await hoiXacNhan(`Go "OK" de ${BO_DAU ? 'GO DAU' : 'DANH DAU'} ${canSua.length} phieu: `);
    if (tl.toUpperCase() !== 'OK') { console.log('Da huy, khong sua gi.'); process.exit(0); }
  }

  /* ---------- 6. Ghi — MỘT câu UPDATE duy nhất cho từng phiếu, trong một transaction ---------- */
  const tran = new sql.Transaction(pool);
  await tran.begin();
  try {
    for (const p of canSua) {
      await new sql.Request(tran)
        .input('id', sql.Int, p.PhieuBHID)
        .input('v', sql.Bit, GIA_TRI_MOI)
        .query('UPDATE PhieuBanHang SET LaHangMau = @v WHERE PhieuBHID = @id');
    }
    await tran.commit();
  } catch (err) {
    try { await tran.rollback(); } catch (e) { /* transaction co the da ket thuc */ }
    console.error('LOI, da quay lui toan bo: ' + err.message);
    process.exit(1);
  }

  console.log('');
  console.log(`XONG. Da ${BO_DAU ? 'go dau' : 'danh dau'} ${canSua.length} phieu.`);
  console.log('Vao Kho hang -> tab "Hang mau o khach" (Ctrl+F5) de doi chieu.');
  console.log('Khach tra mau: lap PHIEU NHAP LAI (hoan ton + tru cong no), KHONG phai phieu nhap kho.');
  process.exit(0);
})().catch(err => { console.error('LOI: ' + err.message); process.exit(1); });
