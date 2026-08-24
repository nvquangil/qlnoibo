/* ================================================================================================
   SOI CONG NO TRUOC PHIEU CUA MOT PHIEU BAN HANG   (chi DOC)                        v7.29
   ------------------------------------------------------------------------------------------------
   Dung khi: phieu in ra THIEU dong "Công nợ trước phiếu ..." trong khi phieu khac co.

   Chay DUNG cong thuc ma backend dung (routes/banhang.js, GET /phieu/:id) roi in ra TUNG THANH PHAN,
   de biet ngay lech o dau:
       Cong no truoc = (ban hang truoc) + (dieu chinh truoc) - (thu truoc) - (nhap lai truoc)
   Tat ca gom theo TEN KHACH (LTRIM/RTRIM) — dung khoa voi man hinh Cong no khach hang.

   CACH DUNG (trong thu muc backend):
     node utils/soi_cong_no_phieu.js --so=PX26093
     node utils/soi_cong_no_phieu.js --so=PX26093 --so=PX26098      (so sanh 2 phieu)
     node utils/soi_cong_no_phieu.js --khach="Minh Thành - Hà Nội"  (moi phieu cua khach do)

   DOC KET QUA:
   - Ra mot con so (ke ca 0)  => BACKEND TRA DU DU LIEU. Phieu in thieu dong la do BAN IN CU tren
     trinh duyet (Ctrl+F5) hoac in bang duong khong lay du header — v7.29 da bit duong do.
   - Bao loi SQL             => thieu bang/cot (vd PhieuNhapLai cua migration_v676) -> chay migration.
   ================================================================================================ */
const { sql, getPool } = require('../db');

const argv = process.argv.slice(2);
const dsSo = argv.filter(a => a.startsWith('--so=')).map(a => a.split('=').slice(1).join('='));
const argKhach = (argv.find(a => a.startsWith('--khach=')) || '').split('=').slice(1).join('=');
const soDep = n => (Number(n) || 0).toLocaleString('vi-VN');

(async () => {
  let pool;
  try { pool = await getPool(); }
  catch (err) { console.error('KHONG ket noi duoc CSDL: ' + err.message); process.exit(1); }

  try {
    if (!dsSo.length && !argKhach) {
      console.log('Thieu tham so. Vi du:  node utils/soi_cong_no_phieu.js --so=PX26093');
      process.exit(0);
    }
    let phieu = [];
    if (dsSo.length) {
      for (const s of dsSo) {
        const r = (await pool.request().input('s', sql.NVarChar, s).query(`
          SELECT PhieuBHID, SoPhieu, NgayBan, TenKhach, KhachHangID, TongThanhToan, TrangThai
          FROM PhieuBanHang WHERE SoPhieu = @s`)).recordset;
        if (!r.length) console.log('!! Khong tim thay phieu ' + s);
        phieu = phieu.concat(r);
      }
    } else {
      phieu = (await pool.request().input('k', sql.NVarChar, argKhach.trim()).query(`
        SELECT PhieuBHID, SoPhieu, NgayBan, TenKhach, KhachHangID, TongThanhToan, TrangThai
        FROM PhieuBanHang WHERE LTRIM(RTRIM(TenKhach)) = @k ORDER BY NgayBan, PhieuBHID`)).recordset;
    }
    if (!phieu.length) { console.log('Khong co phieu nao de soi.'); process.exit(0); }

    for (const p of phieu) {
      const ten = String(p.TenKhach || '').trim();
      console.log('');
      console.log('==============================================================');
      console.log(`PHIEU ${p.SoPhieu} | ${new Date(p.NgayBan).toLocaleDateString('vi-VN')} | ${p.TrangThai}`);
      console.log(`Khach (TenKhach) : "${p.TenKhach}"   -> sau LTRIM/RTRIM: "${ten}" (${ten.length} ky tu)`);
      console.log(`KhachHangID      : ${p.KhachHangID == null ? 'NULL (khong gan danh muc)' : p.KhachHangID}`);
      console.log(`Tong thanh toan  : ${soDep(p.TongThanhToan)}`);
      if (!ten) {
        console.log('!! TEN KHACH TRONG -> moi phep gom cong no theo ten se ra 0.');
      }

      const rq = pool.request()
        .input('ten', sql.NVarChar, ten)
        .input('ngay', sql.Date, p.NgayBan)
        .input('id', sql.Int, p.PhieuBHID);
      const no = (await rq.query(`
        SELECT
          ISNULL((SELECT SUM(TongThanhToan) FROM PhieuBanHang
                  WHERE LTRIM(RTRIM(TenKhach)) = @ten AND TrangThai <> N'Đã hủy'
                    AND (NgayBan < @ngay OR (NgayBan = @ngay AND PhieuBHID < @id))), 0) AS BanTruoc,
          ISNULL((SELECT COUNT(*) FROM PhieuBanHang
                  WHERE LTRIM(RTRIM(TenKhach)) = @ten AND TrangThai <> N'Đã hủy'
                    AND (NgayBan < @ngay OR (NgayBan = @ngay AND PhieuBHID < @id))), 0) AS SoPhieuTruoc,
          ISNULL((SELECT SUM(SoTien) FROM CongNoDieuChinh
                  WHERE LoaiDoiTuong = N'KhachHang' AND LTRIM(RTRIM(ISNULL(TenDoiTuong,''))) = @ten
                    AND Ngay < @ngay), 0) AS DieuChinhTruoc,
          ISNULL((SELECT SUM(SoTien) FROM PhieuThu
                  WHERE LoaiDoiTuong = N'KhachHang' AND LTRIM(RTRIM(ISNULL(TenDoiTuong,''))) = @ten
                    AND NgayThu < @ngay), 0) AS ThuTruoc`)).recordset[0];

      let traLai = 0, loiTraLai = null;
      try {
        traLai = Number((await pool.request().input('ten', sql.NVarChar, ten).input('ngay', sql.Date, p.NgayBan)
          .query(`SELECT ISNULL(SUM(TongThanhToan), 0) AS S FROM PhieuNhapLai
                  WHERE LTRIM(RTRIM(TenKhach)) = @ten AND TrangThai <> N'Đã hủy' AND NgayNhap < @ngay`))
          .recordset[0].S) || 0;
      } catch (e) { loiTraLai = e.message; }

      const congNoTruoc = Math.round(Number(no.BanTruoc) + Number(no.DieuChinhTruoc) - Number(no.ThuTruoc) - traLai);
      console.log('');
      console.log('--- CONG NO TRUOC PHIEU (dung cong thuc cua backend) ---');
      console.log(`  + Ban hang truoc  : ${soDep(no.BanTruoc)}   (${no.SoPhieuTruoc} phieu)`);
      console.log(`  + Dieu chinh truoc: ${soDep(no.DieuChinhTruoc)}`);
      console.log(`  - Da thu truoc    : ${soDep(no.ThuTruoc)}`);
      console.log(`  - Khach tra lai   : ${soDep(traLai)}${loiTraLai ? '   !! LOI: ' + loiTraLai : ''}`);
      console.log(`  = CONG NO TRUOC   : ${soDep(congNoTruoc)}`);
      console.log(`  = TONG CONG NO    : ${soDep(congNoTruoc + Number(p.TongThanhToan))}`);
      console.log('');
      console.log(loiTraLai
        ? '  >> CO LOI SQL o buoc "khach tra lai" -> chay database/migration_v676.sql.'
        : '  >> Backend TRA DU du lieu. Phieu in thieu dong cong no la do BAN IN CU tren may in phieu:'
          + '\n     Ctrl+F5 tren may do (hoac copy lai frontend/js/module.khohang.js + doi ?v=), roi in lai.');

      /* ================================================================================================
         v7.30 — SOI THEO `KhachHangID`: day la cach duy nhat thay duoc "cung mot khach nhung ten tren
         phieu viet khac nhau". Cong no dang gom theo TEN KHACH (chuoi), nen chi can mot phieu ghi
         "Minh Thành" va mot phieu ghi "Minh Thành - Hà Nội" la thanh HAI khach -> cong no truoc = 0
         du khach da mua nhieu lan. Truong hop nay KHONG bi cau canh bao ben duoi bat (no chi so cac
         ten chi khac khoang trang / hoa-thuong).
         ================================================================================================ */
      if (p.KhachHangID) {
        const cungID = (await pool.request().input('kh', sql.Int, p.KhachHangID).query(`
          SELECT TenKhach, COUNT(*) AS SoPhieu, SUM(TongThanhToan) AS Tong,
                 MIN(NgayBan) AS TuNgay, MAX(NgayBan) AS DenNgay
          FROM PhieuBanHang WHERE KhachHangID = @kh AND TrangThai <> N'Đã hủy'
          GROUP BY TenKhach ORDER BY COUNT(*) DESC`)).recordset;
        const tenDM = (await pool.request().input('kh', sql.Int, p.KhachHangID).query(
          'SELECT TenKhachHang FROM KhachHang WHERE KhachHangID = @kh')).recordset[0];
        console.log('');
        console.log(`--- MOI PHIEU CUA KHACH #${p.KhachHangID} (danh muc: "${tenDM ? tenDM.TenKhachHang : '?'}") ---`);
        cungID.forEach(g => console.log(`   "${g.TenKhach}": ${g.SoPhieu} phieu, ${soDep(g.Tong)}`
          + `  (${new Date(g.TuNgay).toLocaleDateString('vi-VN')} - ${new Date(g.DenNgay).toLocaleDateString('vi-VN')})`));
        if (cungID.length > 1) {
          console.log('   ⚠️ CUNG MOT KHACH MA CO ' + cungID.length + ' CACH VIET TEN -> cong no bi TACH RA lam '
            + cungID.length + ' khoi. Day chinh la ly do "cong no truoc phieu = 0" du khach da mua truoc do.');
          console.log('   >> Gop ten: cd D:\\QLSX\\backend && node utils/gop_ten_khach.js --liet-ke');
        }
      } else {
        console.log('');
        console.log('--- Phieu nay KHONG gan KhachHangID -> khong doi chieu duoc theo ma khach.');
      }

      /* Ten khach viet lech nhau la nguyen nhan pho bien lam cong no "bien mat": phieu nay ghi
         "Minh Thành - Hà Nội", phieu truoc ghi "Minh Thanh - Ha Noi" -> hai khach khac nhau. */
      const gan = (await pool.request().input('ten', sql.NVarChar, ten).query(`
        SELECT TenKhach, COUNT(*) AS SoPhieu, SUM(TongThanhToan) AS Tong
        FROM PhieuBanHang
        WHERE TrangThai <> N'Đã hủy' AND LTRIM(RTRIM(TenKhach)) <> @ten
          AND REPLACE(LOWER(LTRIM(RTRIM(TenKhach))), ' ', '') = REPLACE(LOWER(@ten), ' ', '')
        GROUP BY TenKhach`)).recordset;
      if (gan.length) {
        console.log('');
        console.log('  ⚠️ CO TEN KHACH VIET LECH (chi khac khoang trang/hoa-thuong) -> cong no bi tach:');
        gan.forEach(g => console.log(`     "${g.TenKhach}": ${g.SoPhieu} phieu, ${soDep(g.Tong)}`));
        console.log('     Gop lai: cd D:\\QLSX\\backend && node utils/gop_ten_khach.js --liet-ke');
      }
    }
    console.log('');
    process.exit(0);
  } catch (err) {
    console.error('LOI: ' + err.message);
    process.exit(1);
  }
})();
