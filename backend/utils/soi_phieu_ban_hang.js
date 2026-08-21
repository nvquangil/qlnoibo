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
/* v7.18.1: soi theo MA HANG — tra loi cau "The kho ma X van con mau Y xuat cho khach Z" bang cach
   liet ke MOI don khach + MOI dong phieu ban hang cua ma do, kem trang thai va phieu dang gan. */
const argMa = (argv.find(a => a.startsWith('--ma=')) || '').split('=')[1];

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
    if (!argSo && !argNgay && !argMa) {
      console.log('Thieu tham so. Vi du:  node utils/soi_phieu_ban_hang.js --so=PBH260015');
      console.log('                        node utils/soi_phieu_ban_hang.js --ngay=2026-08-15');
      console.log('                        node utils/soi_phieu_ban_hang.js --ma=BD26C042');
      process.exit(0);
    }

    /* ---------- CHE DO --ma: soi 1 MA HANG ---------- */
    if (argMa) {
      const coDonIDs0 = (await pool.request().query(`SELECT COL_LENGTH('PhieuBanHangChiTiet','DonIDs') AS c`)).recordset[0].c != null;
      const coDaTru0 = (await pool.request().query(`SELECT COL_LENGTH('DonKhachDatHang','DaTruTon') AS c`)).recordset[0].c != null;
      const h = (await pool.request().input('m', sql.NVarChar, argMa).query(`
        SELECT MaHangID, MaHang, TenHang, LoaiRi, DonViCoBan, DonViQuyDoi
        FROM TheKhoHangHoa WHERE MaHang = @m`)).recordset[0];
      if (!h) { console.log('Khong tim thay ma hang ' + argMa); process.exit(0); }
      console.log('');
      console.log(`=== MA ${h.MaHang} — ${h.TenHang} | DVT chinh: ${h.DonViCoBan} | DVT quy doi: ${h.DonViQuyDoi || '-'} | 1 ${h.DonViQuyDoi || 'Ri'} = ${h.LoaiRi} ===`);

      const ton = (await pool.request().input('id', sql.Int, h.MaHangID).query(`
        SELECT t.MauSacID, ms.TenMau, t.NhapCai, t.NhapTuPhieu, t.XuatCai, t.TonCai
        FROM vw_TonTheoMau t LEFT JOIN MauSac ms ON ms.MauSacID = t.MauSacID
        WHERE t.MaHangID = @id ORDER BY ms.TenMau`)).recordset;
      console.log('');
      console.log('--- TON THEO MAU ---');
      ton.forEach(t => console.log(`  ${t.TenMau || '(khong mau)'}: nhap ${soDep(t.NhapCai)} + phieu ${soDep(t.NhapTuPhieu)} - xuat ${soDep(t.XuatCai)} = TON ${soDep(t.TonCai)} ${h.DonViCoBan}`));

      const dsDon = (await pool.request().input('id', sql.Int, h.MaHangID).query(`
        SELECT o.DonID, o.ThoiGian, o.TenKhach, ms.TenMau, o.SoLuongDat, o.DonVi, o.TrangThai,
               o.PhieuBHID, p.SoPhieu, p.TrangThai AS TrangThaiPhieu
               ${coDaTru0 ? ', ISNULL(o.DaTruTon,0) AS DaTruTon' : ''}
        FROM DonKhachDatHang o
        LEFT JOIN MauSac ms ON ms.MauSacID = o.MauSacID
        LEFT JOIN PhieuBanHang p ON p.PhieuBHID = o.PhieuBHID
        WHERE o.MaHangID = @id ORDER BY o.DonID DESC`)).recordset;
      console.log('');
      console.log('--- DON KHACH DAT CUA MA NAY ---');
      if (!dsDon.length) console.log('  (khong co don nao)');
      dsDon.forEach(o => {
        /* CANH BAO cac to hop MAU THUAN da tung gap:
           - 'Đã xuất hàng' ma KHONG gan phieu (hoac phieu da huy) = noi da xuat nhung khong co chung tu
           - 'Chờ xử lý' ma DaTruTon = 1                          = dang tru ton kieu cu, giu hang oan */
        const canh = [];
        if (String(o.TrangThai) === 'Đã xuất hàng' && (!o.PhieuBHID || String(o.TrangThaiPhieu) === 'Đã hủy')) canh.push('!! da xuat hang nhung KHONG co phieu hop le');
        if (coDaTru0 && Number(o.DaTruTon) === 1 && ['Chờ xử lý', 'Chờ xác nhận'].indexOf(String(o.TrangThai)) !== -1) canh.push('!! dang TRU TON kieu cu (DaTruTon=1)');
        if (coDaTru0 && Number(o.DaTruTon) === 1 && o.PhieuBHID) canh.push('!! TRU HAI LAN (co phieu + DaTruTon=1)');
        console.log(`  #${o.DonID} ${new Date(o.ThoiGian).toLocaleDateString('vi-VN')} ${o.TenKhach} · ${o.TenMau || '-'} · ${soDep(o.SoLuongDat)} ${o.DonVi} · ${o.TrangThai}`
          + ` · phieu ${o.SoPhieu || '-'}${canh.length ? '  ' + canh.join(' ') : ''}`);
      });

      const dsCT = (await pool.request().input('id', sql.Int, h.MaHangID).query(`
        SELECT p.SoPhieu, p.NgayBan, p.TenKhach, p.TrangThai, ms.TenMau, ct.SoLuong, ct.DonVi, ct.SoLuongCai,
               ct.DonID ${coDonIDs0 ? ', ct.DonIDs' : ''}
        FROM PhieuBanHangChiTiet ct
        JOIN PhieuBanHang p ON p.PhieuBHID = ct.PhieuBHID
        LEFT JOIN MauSac ms ON ms.MauSacID = ct.MauSacID
        WHERE ct.MaHangID = @id ORDER BY p.NgayBan DESC, p.PhieuBHID DESC`)).recordset;
      console.log('');
      console.log('--- DONG PHIEU BAN HANG CUA MA NAY ---');
      if (!dsCT.length) console.log('  (khong co dong nao)');
      dsCT.forEach(c => console.log(`  ${c.SoPhieu} ${new Date(c.NgayBan).toLocaleDateString('vi-VN')} ${c.TenKhach} · ${c.TenMau || '-'} · ${soDep(c.SoLuong)} ${c.DonVi} (=${soDep(c.SoLuongCai)} Cai) · ${c.TrangThai} · don ${c.DonIDs || c.DonID || '-'}`));
      console.log('');
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
        /* v7.18.1 — TACH RIENG "don cu HOP LE" va "don cu TRU HAI LAN".
           Don DaTruTon = 1 mà DA co phieu ban hang (PhieuBHID) thi phan tru cua no la TRU OAN: lo hang
           do da duoc dem o nhanh "ban hang" o tren. Ban dau file nay gop chung nen no bao ✔ KHOP cho ca
           truong hop dang hong — dung kieu cong cu chan doan ru ngu nguoi dung. */
        let donCu = 0, donTruHaiLan = 0;
        if (coDaTru) {
          const dk = (await pool.request().input('mh', sql.Int, d.MaHangID).input('ms', sql.Int, d.MauSacID).query(`
            SELECT o.SoLuongDat, o.DonVi, o.DonID, o.TrangThai,
                   CASE WHEN ${coDonIDs ? 'o.PhieuBHID IS NOT NULL' : '1 = 0'} THEN 1 ELSE 0 END AS CoPhieu
            FROM DonKhachDatHang o
            WHERE o.MaHangID=@mh AND o.MauSacID=@ms AND ISNULL(o.DaTruTon,0) = 1 AND o.TrangThai <> N'Đã hủy'`)).recordset;
          dk.forEach(x => {
            const sl = slSangDonViChinh(x.SoLuongDat, x.DonVi, d);
            if (Number(x.CoPhieu) === 1) donTruHaiLan += sl; else donCu += sl;
          });
        }
        const xuatPhaiLa = xuatDung - nhapLai + donCu;   // KHONG cong donTruHaiLan: phan do la tru OAN
        const lech = Number(t.XuatCai) - xuatPhaiLa;
        const dv = d.DonViCoBan || 'Cái';
        console.log(`  ${d.MaHang} · ${d.TenMau}:`);
        console.log(`      Nhap the kho ${soDep(t.NhapCai)} + tu phieu nhap ${soDep(t.NhapTuPhieu)} - Xuat ${soDep(t.XuatCai)} = TON ${soDep(t.TonCai)} ${dv}`);
        console.log(`      Xuat DUNG theo chung tu = ${soDep(xuatDung)} (ban hang) - ${soDep(nhapLai)} (nhap lai) + ${soDep(donCu)} (don cu chua len phieu) = ${soDep(xuatPhaiLa)}`);
        if (donTruHaiLan) console.log(`      ⚠️ ${soDep(donTruHaiLan)} ${dv} den tu don DA CO PHIEU ma con DaTruTon=1 -> TRU HAI LAN (chay: node utils/nan_ton_don_da_tru.js --ma=${d.MaHang})`);
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
