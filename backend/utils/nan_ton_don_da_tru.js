/* ================================================================================================
   NAN LAI TON BI TRU OAN BOI CO `DonKhachDatHang.DaTruTon`      (v7.13)
   ------------------------------------------------------------------------------------------------
   Dung khi: cot TON cua The kho hang hoa THAP HON THUC TE ma khong tim ra chung tu nao giai thich.

   Truoc v6.23, don khach dat TRU TON NGAY luc len don (`XuatCai += SL`, cot `DaTruTon = 1`).
   Tu v6.23, PHIEU BAN HANG la duong tru ton duy nhat. Hai the he du lieu song song sinh ra 2 kieu
   TON BI TRU OAN — ca hai deu lam ton THAP hon thuc te:

     (A) DON DA HUY ma `DaTruTon` van = 1
         Duong huy don co hoan ton (XuatCai -= SL) roi dat DaTruTon = 0, nhung don huy o thoi diem
         CSDL chua co cot DaTruTon / huy bang duong khac / du lieu nhap tay thi con sot lai.
         ⇒ Hang da tra ve kho tu doi nao ma so Xuat van dang giu phan cua don do.

     (B) DON DA LEN PHIEU BAN HANG ma `DaTruTon` van = 1   ← thuong gap nhat
         Don cu (da tru ton) duoc bam "Chuyen sang phieu ban hang": phieu tru ton LAN THU HAI, ma
         phan tru cua don thi khong ai go. Don sang 'Đã xuất hàng' nen cung thoi duoc tinh la
         "dang giu" ⇒ khong con duong nao hoan lai.
         (Tu v7.13 routes/banhang.js da tu go phan nay khi len phieu — file nay de VET du lieu CU.)

   Cach nan: voi moi don thuoc (A)/(B): `XuatCai -= SL don (quy ve DON VI CHINH)` + dat `DaTruTon = 0`.
   KHONG tao dong the kho moi (dong mau co the da bi xoa — tao moi se sinh XuatCai am = ton ao).

   CACH DUNG (trong thu muc backend):
     node utils/nan_ton_don_da_tru.js                     -> chay thu TOAN BO, chi in, khong ghi
     node utils/nan_ton_don_da_tru.js --ma=QC260091       -> chay thu 1 ma hang
     node utils/nan_ton_don_da_tru.js --ma=QC260091 --ghi -> GHI THAT (co backup JSON)
     node utils/nan_ton_don_da_tru.js --ghi               -> GHI THAT toan bo

   Chi doc + 2 cau UPDATE co dieu kien; chay lai nhieu lan khong cong don (sau lan dau DaTruTon = 0
   nen khong con dong nao vao dien).
   ================================================================================================ */
const fs = require('fs');
const path = require('path');
const { sql, getPool } = require('../db');

const argv = process.argv.slice(2);
const GHI = argv.includes('--ghi');
const argMa = (argv.find(a => a.startsWith('--ma=')) || '').split('=')[1];

/* PHAI GIONG laDonViGop/donViChinhLaGop trong routes/khohang.js, banhang.js, public.js, common.js. */
function chuanDV(v) { return String(v == null ? '' : v).trim().toLowerCase(); }
function laDonViGop(donVi, mh) {
  const dv = chuanDV(donVi), qd = chuanDV(mh && mh.DonViQuyDoi);
  return qd ? dv === qd : dv === 'ri';
}
function donViChinhLaGop(mh) {
  const cb = chuanDV(mh && mh.DonViCoBan), qd = chuanDV(mh && mh.DonViQuyDoi);
  return qd ? cb === qd : cb === 'ri';
}
function veDonViChinh(soLuong, donVi, mh) {
  const n = Number(soLuong) || 0, he = Number(mh.LoaiRi) || 1;
  const cai = laDonViGop(donVi, mh) ? n * he : n;
  return Math.round(donViChinhLaGop(mh) ? cai / he : cai);
}
const soDep = n => (Number(n) || 0).toLocaleString('vi-VN');

(async () => {
  let pool;
  try { pool = await getPool(); }
  catch (err) { console.error('KHONG ket noi duoc CSDL: ' + err.message); process.exit(1); }

  try {
    const coDaTruTon = (await pool.request().query(`SELECT COL_LENGTH('DonKhachDatHang','DaTruTon') AS c`)).recordset[0].c != null;
    if (!coDaTruTon) {
      console.log('CSDL chua co cot DonKhachDatHang.DaTruTon (chua chay migration_v657) - khong co gi de nan.');
      process.exit(0);
    }
    const coPhieuBHID = (await pool.request().query(`SELECT COL_LENGTH('DonKhachDatHang','PhieuBHID') AS c`)).recordset[0].c != null;

    const rq = pool.request();
    let loc = '';
    if (argMa) { rq.input('ma', sql.NVarChar, argMa); loc = 'AND h.MaHang = @ma'; }

    /* Dien nan = don DaTruTon = 1 VA (da huy HOAC da len phieu ban hang chua huy).
       Don DaTruTon = 1 dang o 'Chờ xử lý'/'Chờ xác nhận' KHONG thuoc dien nay: hang van chua ra khoi
       kho that, phan tru cua no chinh la cach ban cu "giu hang" — go bang utils/hoan_ton_don_cho_xu_ly.js. */
    const dong = (await rq.query(`
      SELECT o.DonID, o.ThoiGian, o.TenKhach, o.TrangThai, o.SoLuongDat, o.DonVi,
             ${coPhieuBHID ? 'o.PhieuBHID' : 'CAST(NULL AS INT) AS PhieuBHID'},
             h.MaHangID, h.MaHang, h.TenHang, h.LoaiRi, h.DonViCoBan, h.DonViQuyDoi,
             o.MauSacID, ms.TenMau,
             pbh.SoPhieu AS SoPhieuBH,
             ct.XuatCai AS XuatCaiHienTai, v.TonCai AS TonHienTai
      FROM DonKhachDatHang o
      JOIN TheKhoHangHoa h ON h.MaHangID = o.MaHangID
      LEFT JOIN MauSac ms ON ms.MauSacID = o.MauSacID
      LEFT JOIN TheKhoChiTietMau ct ON ct.MaHangID = o.MaHangID AND ct.MauSacID = o.MauSacID
      LEFT JOIN vw_TonTheoMau v ON v.MaHangID = o.MaHangID AND v.MauSacID = o.MauSacID
      ${coPhieuBHID ? 'LEFT JOIN PhieuBanHang pbh ON pbh.PhieuBHID = o.PhieuBHID' : 'LEFT JOIN PhieuBanHang pbh ON 1 = 0'}
      WHERE ISNULL(o.DaTruTon, 0) = 1 ${loc}
        AND ( o.TrangThai = N'Đã hủy'
              ${coPhieuBHID ? "OR (o.PhieuBHID IS NOT NULL AND ISNULL(pbh.TrangThai, N'') <> N'Đã hủy')" : ''}
              OR EXISTS (SELECT 1 FROM PhieuBanHangChiTiet c2
                         JOIN PhieuBanHang p2 ON p2.PhieuBHID = c2.PhieuBHID
                         WHERE c2.DonID = o.DonID AND p2.TrangThai <> N'Đã hủy') )
      ORDER BY h.MaHang, ms.TenMau, o.ThoiGian`)).recordset;

    if (!dong.length) {
      console.log('=== KHONG co don nao thuoc dien tru ton oan' + (argMa ? ` (ma ${argMa})` : '') + '. Ton dang dung theo chung tu. ===');
      process.exit(0);
    }

    console.log('=== DON DANG TRU TON OAN (DaTruTon = 1 nhung hang khong con do don nay giu) ===');
    console.log(GHI ? '>>> CHE DO GHI THAT <<<' : '>>> CHAY THU (khong ghi gi) - them --ghi de ghi that <<<');
    console.log('');

    const theoMau = new Map();   // "MaHangID|MauSacID" -> tong se hoan
    for (const d of dong) {
      const sl = veDonViChinh(d.SoLuongDat, d.DonVi, d);
      const ly = d.TrangThai === 'Đã hủy' ? 'don DA HUY'
        : ('da len phieu ban hang' + (d.SoPhieuBH ? ' ' + d.SoPhieuBH : '') + ' (tru 2 lan)');
      console.log(`  ${d.MaHang} · ${d.TenMau || '(khong mau)'} · don #${d.DonID} ${d.TenKhach || ''}`);
      console.log(`      ${soDep(d.SoLuongDat)} ${d.DonVi || ''} = ${soDep(sl)} ${d.DonViCoBan || 'Cái'} | ly do: ${ly}`);
      if (d.XuatCaiHienTai == null) {
        console.log('      ⚠️ KHONG co dong the kho cho ma/mau nay -> khong hoan duoc (bo qua, khong tao dong moi).');
        continue;
      }
      const k = d.MaHangID + '|' + d.MauSacID;
      const g = theoMau.get(k) || { MaHangID: d.MaHangID, MauSacID: d.MauSacID, MaHang: d.MaHang, TenMau: d.TenMau, XuatCu: Number(d.XuatCaiHienTai) || 0, TonCu: Number(d.TonHienTai) || 0, hoan: 0, dons: [] };
      g.hoan += sl;
      g.dons.push(d.DonID);
      theoMau.set(k, g);
    }

    console.log('');
    console.log('=== TONG HOP THEO MA/MAU ===');
    for (const g of theoMau.values()) {
      console.log(`  ${g.MaHang} · ${g.TenMau || '(khong mau)'}: Xuat ${soDep(g.XuatCu)} -> ${soDep(g.XuatCu - g.hoan)}`
        + ` | Ton ${soDep(g.TonCu)} -> ${soDep(g.TonCu + g.hoan)}  (hoan ${soDep(g.hoan)}, ${g.dons.length} don)`);
      if (g.XuatCu - g.hoan < 0) {
        console.log('      ⚠️ Xuat se thanh AM -> co the phan nay da tung duoc hoan bang tay. KIEM TRA truoc khi --ghi.');
      }
    }

    if (!GHI) {
      console.log('');
      console.log('Chay lai voi --ghi de ghi that (se tao backup JSON truoc khi ghi).');
      process.exit(0);
    }

    const file = path.join(__dirname, `backup_nan_ton_don_da_tru_${Date.now()}.json`);
    fs.writeFileSync(file, JSON.stringify({ chay: new Date().toISOString(), ma: argMa || '(tat ca)', dong, tongHop: [...theoMau.values()] }, null, 2), 'utf8');
    console.log('');
    console.log('Backup: ' + file);

    const tran = new sql.Transaction(pool);
    await tran.begin();
    try {
      for (const g of theoMau.values()) {
        await new sql.Request(tran).input('mh', sql.Int, g.MaHangID).input('ms', sql.Int, g.MauSacID).input('sl', sql.Int, g.hoan)
          .query('UPDATE TheKhoChiTietMau SET XuatCai = XuatCai - @sl WHERE MaHangID=@mh AND MauSacID=@ms');
        for (const donId of g.dons) {
          await new sql.Request(tran).input('id', sql.Int, donId)
            .query('UPDATE DonKhachDatHang SET DaTruTon = 0 WHERE DonID = @id');
        }
      }
      await tran.commit();
      console.log('=== DA GHI XONG. Mo lai The kho hang hoa (Ctrl+F5) de xem ton moi. ===');
    } catch (e) {
      await tran.rollback();
      console.error('LOI khi ghi, da quay lui toan bo: ' + e.message);
      process.exit(1);
    }
    process.exit(0);
  } catch (err) {
    console.error('LOI: ' + err.message);
    process.exit(1);
  }
})();
