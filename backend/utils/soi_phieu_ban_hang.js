/* ================================================================================================
   SOI 1 PHIEU BAN HANG vs TON KHO THUC TE   (chi DOC, khong ghi gi)      v7.18
   ------------------------------------------------------------------------------------------------
   Dung khi: "sua phieu roi ma The kho khong thay doi". In ra DU 3 lop de biet lech o dau:
     1. HEADER + CHI TIET phieu dang luu trong CSDL (ma hang, MAU, SL, don khach gan vao)
     2. TON hien tai cua tung (ma hang, mau) trong phieu — NhapCai / NhapTuPhieu / XuatCai / Ton
     3. XuatCai DUNG = tong cua MOI chung tu xuat cua chinh (ma, mau) do:
          + phieu ban hang chua huy
          - phieu nhap lai chua huy
          + don khach dat con DaTruTon = 1 (du lieu cu truoc v6.23)
        -> lech giua XuatCai dang luu va so nay = cho hong.

   CACH DUNG (trong thu muc backend):
     node utils/soi_phieu_ban_hang.js --so=PBH260015
     node utils/soi_phieu_ban_hang.js --ngay=2026-08-15      (moi phieu trong ngay do)
   ================================================================================================ */
const { sql, getPool } = require('../db');

const argv = process.argv.slice(2);
const argSo = (argv.find(a => a.startsWith('--so=')) || '').split('=')[1];
const argNgay = (argv.find(a => a.startsWith('--ngay=')) || '').split('=')[1];

function chuanDV(v) { return String(v == null ? '' : v).trim().toLowerCase(); }
function laDonViGop(dv, mh) { const q = chuanDV(mh && mh.DonViQuyDoi); return q ? chuanDV(dv) === q : chuanDV(dv) === 'ri'; }
function donViChinhLaGop(mh) { const c = chuanDV(mh && mh.DonViCoBan), q = chuanDV(mh && mh.DonViQuyDoi); return q ? c === q : c === 'ri'; }
function caiSangChinh(cai, mh) { const he = Number(mh.LoaiRi) || 1; const n = Number(cai) || 0; return donViChinhLaGop(mh) && he > 0 ? Math.round(n / he) : n; }
function slSangDonViChinh(sl, dv, mh) { const he = Number(mh.LoaiRi) || 1; const cai = laDonViGop(dv, mh) ? (Number(sl) || 0) * he : (Number(sl) || 0); return caiSangChinh(cai, mh); }
const soDep = n => (Number(n) || 0).toLocaleString('vi-VN');

(async () => {
  let pool;
  try { pool = await getPool(); }
  catch (err) { console.error('KHONG ket noi duoc CSDL: ' + err.message); process.exit(1); }

  try {
    if (!argSo && !argNgay) {
      console.log('Thieu tham so. Vi du:  node utils/soi_phieu_ban_hang.js --so=PBH260015');
      console.log('                        node utils/soi_phieu_ban_hang.js --ngay=2026-08-15');
      process.exit(0);
    }
    const rq = pool.request();
    let loc = '';
    if (argSo) { rq.input('so', sql.NVarChar, argSo); loc = 'p.SoPhieu = @so'; }
    else { rq.input('ngay', sql.Date, argNgay); loc = 'p.NgayBan = @ngay'; }

    const phieu = (await rq.query(`
      SELECT p.PhieuBHID, p.SoPhieu, p.NgayBan, p.TenKhach, p.TrangThai, p.TongSLCai, p.TongThanhToan
      FROM PhieuBanHang p WHERE ${loc} ORDER BY p.PhieuBHID`)).recordset;
    if (!phieu.length) { console.log('Khong tim thay phieu nao.'); process.exit(0); }

    const coDonIDs = (await pool.request().query(`SELECT COL_LENGTH('PhieuBanHangChiTiet','DonIDs') AS c`)).recordset[0].c != null;
    const coDaTru = (await pool.request().query(`SELECT COL_LENGTH('DonKhachDatHang','DaTruTon') AS c`)).recordset[0].c != null;

    for (const p of phieu) {
      console.log('');
      console.log('==============================================================');
      console.log(`PHIEU ${p.SoPhieu} | ngay ${new Date(p.NgayBan).toLocaleDateString('vi-VN')} | ${p.TenKhach} | ${p.TrangThai}`);
      console.log(`Tong SL (cai): ${soDep(p.TongSLCai)} | Tong tien: ${soDep(p.TongThanhToan)}`);

      const ct = (await pool.request().input('id', sql.Int, p.PhieuBHID).query(`
        SELECT ct.ID, ct.MaHangID, ct.MauSacID, ct.SoLuong, ct.DonVi, ct.SoLuongCai, ct.DonID,
               ${coDonIDs ? 'ct.DonIDs' : "CAST(NULL AS NVARCHAR(200)) AS DonIDs"},
               h.MaHang, h.TenHang, h.LoaiRi, h.DonViCoBan, h.DonViQuyDoi, ms.TenMau
        FROM PhieuBanHangChiTiet ct
        JOIN TheKhoHangHoa h ON h.MaHangID = ct.MaHangID
        LEFT JOIN MauSac ms ON ms.MauSacID = ct.MauSacID
        WHERE ct.PhieuBHID = @id ORDER BY ct.ID`)).recordset;

      console.log('');
      console.log('--- CHI TIET PHIEU (dang luu trong CSDL) ---');
      if (!ct.length) console.log('  (phieu KHONG co dong nao!)');
      ct.forEach((d, i) => {
        console.log(`  ${i + 1}. ${d.MaHang} · mau ${d.TenMau || '(KHONG CO MAU - se KHONG tru ton!)'} `
          + `| ${soDep(d.SoLuong)} ${d.DonVi} (= ${soDep(d.SoLuongCai)} Cai) `
          + `| don khach: ${d.DonIDs || d.DonID || '-'}`);
      });

      console.log('');
      console.log('--- TON HIEN TAI cua tung (ma, mau) trong phieu + DOI CHIEU CHUNG TU ---');
      for (const d of ct) {
        if (!d.MauSacID) { console.log(`  ${d.MaHang}: dong khong co mau -> bo qua (khong tru ton).`); continue; }
        const t = (await pool.request().input('mh', sql.Int, d.MaHangID).input('ms', sql.Int, d.MauSacID).query(`
          SELECT NhapCai, NhapTuPhieu, TongNhapCai, XuatCai, TonCai, ChiTietID
          FROM vw_TonTheoMau WHERE MaHangID = @mh AND MauSacID = @ms`)).recordset[0];
        if (!t) { console.log(`  ${d.MaHang} · ${d.TenMau}: KHONG co dong nao trong vw_TonTheoMau (chua co the kho, chua co phieu nhap).`); continue; }

        // Xuat DUNG theo chung tu
        const bh = (await pool.request().input('mh', sql.Int, d.MaHangID).input('ms', sql.Int, d.MauSacID).query(`
          SELECT ct.SoLuong, ct.DonVi FROM PhieuBanHangChiTiet ct
          JOIN PhieuBanHang p ON p.PhieuBHID = ct.PhieuBHID
          WHERE ct.MaHangID=@mh AND ct.MauSacID=@ms AND p.TrangThai <> N'Đã hủy'`)).recordset;
        let xuatDung = 0;
        bh.forEach(x => { xuatDung += slSangDonViChinh(x.SoLuong, x.DonVi, d); });

        const coNL = (await pool.request().query(`SELECT OBJECT_ID('PhieuNhapLaiChiTiet') AS o`)).recordset[0].o != null;
        let nhapLai = 0;
        if (coNL) {
          const nl = (await pool.request().input('mh', sql.Int, d.MaHangID).input('ms', sql.Int, d.MauSacID).query(`
            SELECT ct.SoLuongCai FROM PhieuNhapLaiChiTiet ct
            JOIN PhieuNhapLai p ON p.PhieuNLID = ct.PhieuNLID
            WHERE ct.MaHangID=@mh AND ct.MauSacID=@ms AND p.TrangThai <> N'Đã hủy'`)).recordset;
          nl.forEach(x => { nhapLai += caiSangChinh(x.SoLuongCai, d); });
        }
        let donCu = 0;
        if (coDaTru) {
          const dk = (await pool.request().input('mh', sql.Int, d.MaHangID).input('ms', sql.Int, d.MauSacID).query(`
            SELECT SoLuongDat, DonVi FROM DonKhachDatHang
            WHERE MaHangID=@mh AND MauSacID=@ms AND ISNULL(DaTruTon,0) = 1 AND TrangThai <> N'Đã hủy'`)).recordset;
          dk.forEach(x => { donCu += slSangDonViChinh(x.SoLuongDat, x.DonVi, d); });
        }
        const xuatPhaiLa = xuatDung - nhapLai + donCu;
        const lech = Number(t.XuatCai) - xuatPhaiLa;
        const dv = d.DonViCoBan || 'Cái';
        console.log(`  ${d.MaHang} · ${d.TenMau}:`);
        console.log(`      Nhap the kho ${soDep(t.NhapCai)} + tu phieu nhap ${soDep(t.NhapTuPhieu)} - Xuat ${soDep(t.XuatCai)} = TON ${soDep(t.TonCai)} ${dv}`);
        console.log(`      Xuat DUNG theo chung tu = ${soDep(xuatDung)} (ban hang) - ${soDep(nhapLai)} (nhap lai) + ${soDep(donCu)} (don cu DaTruTon=1) = ${soDep(xuatPhaiLa)}`);
        console.log(`      ${lech === 0 ? '✔ KHOP' : '✘ LECH ' + soDep(lech) + ' -> ton dang ' + (lech > 0 ? 'THIEU' : 'THUA') + ' ' + soDep(Math.abs(lech)) + ' ' + dv}`);
      }

      // Don khach lien quan (ke ca don da bi bo ra khoi phieu)
      const don = (await pool.request().input('id', sql.Int, p.PhieuBHID).query(`
        SELECT o.DonID, o.TenKhach, o.MaHangID, o.MauSacID, ms.TenMau, o.SoLuongDat, o.DonVi, o.TrangThai,
               o.PhieuBHID ${coDaTru ? ', ISNULL(o.DaTruTon,0) AS DaTruTon' : ''}
        FROM DonKhachDatHang o LEFT JOIN MauSac ms ON ms.MauSacID = o.MauSacID
        WHERE o.PhieuBHID = @id ORDER BY o.DonID`)).recordset;
      console.log('');
      console.log('--- DON KHACH DANG GAN PHIEU NAY ---');
      if (!don.length) console.log('  (khong co don nao gan phieu nay)');
      don.forEach(o => console.log(`  #${o.DonID} ${o.TenKhach} · mau ${o.TenMau || '-'} · ${soDep(o.SoLuongDat)} ${o.DonVi} · ${o.TrangThai}`
        + (coDaTru ? ` · DaTruTon=${o.DaTruTon}` : '')));
    }
    console.log('');
    process.exit(0);
  } catch (err) {
    console.error('LOI: ' + err.message);
    process.exit(1);
  }
})();
