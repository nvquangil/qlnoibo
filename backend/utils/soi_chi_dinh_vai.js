/* ================================================================================================
   SOI "CHI DINH VAI SX" vs TON CAY VAI — vi sao khong xuat duoc?   (chi DOC)              v7.35
   ------------------------------------------------------------------------------------------------
   Dung khi: "co vai ton dung loai dung mau, da chi dinh, ma lap phieu xuat khong ra cay nao"
   (dac biet khi CUNG LENH SX do, loai vai KHAC lai xuat duoc binh thuong).

   Chay DUNG cau loc ma form phieu xuat dung (routes/khovai.js, GET /orders/:id/vaichophep) roi
   BOC TACH tung dieu kien de chi ro dong chi dinh nao truot, truot vi cai gi:

       1. Thieu LoaiVaiID / MauSacID  -> dong chi dinh go tu do, chua chon tu danh muc
       2. LECH ID nhung TRUNG TEN     -> danh muc co 2 ban ghi cung ten khac ID (MauSac.TenMau
                                         KHONG UNIQUE) nen chi dinh tro ID khac voi ID ma cay vai
                                         dang dung  <= NGUYEN NHAN PHO BIEN NHAT
       3. Ca KG va SO MET deu trong   -> bi dieu kien SoKGYeuCau > 0 chan (loi v5.64 sua /orders ma
                                         quen /vaichophep; da sua o v7.35)
       4. Khop ID nhung KHONG CON TON -> het that, khong phai loi

   CACH DUNG (trong thu muc backend):
     node utils/soi_chi_dinh_vai.js --madh=DH2608001
     node utils/soi_chi_dinh_vai.js --don=123            (theo DonHangID)
     node utils/soi_chi_dinh_vai.js --madh=DH2608001 --cay   (in kem tung cay ton khop/gan khop)
     node utils/soi_chi_dinh_vai.js --trung-ten          (liet ke MOI ten mau/loai vai bi trung ten
                                                          khac ID trong danh muc - viec can don dep)
   ================================================================================================ */
const { sql, getPool } = require('../db');

const argv = process.argv.slice(2);
const lay = k => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.split('=').slice(1).join('=') : ''; };
const argMaDH = lay('madh');
const argDon = parseInt(lay('don'), 10) || 0;
const IN_CAY = argv.includes('--cay');
const CHI_TRUNG_TEN = argv.includes('--trung-ten');
const so = n => (Number(n) || 0).toLocaleString('vi-VN');

(async () => {
  let pool;
  try { pool = await getPool(); }
  catch (err) { console.error('KHONG ket noi duoc CSDL: ' + err.message); process.exit(1); }

  try {
    /* ------------------------------------------------------------------------------------------
       PHAN A — DANH MUC BI TRUNG TEN KHAC ID.
       `MauSac.TenMau` khong co rang buoc UNIQUE (chi `MaMau` UNIQUE), va form Chi dinh vai SX cho
       GO TU DO: go ten khong khop tuyet doi thi backend TAO BAN GHI MOI. Nen rat de co hai dong
       cung ten khac ID -> chi dinh tro ID nay, cay vai tro ID kia, va phep loc ghep bang ID truot.
       ------------------------------------------------------------------------------------------ */
    const trungTenMau = (await pool.request().query(`
      SELECT LTRIM(RTRIM(TenMau)) AS Ten, COUNT(*) AS SoBan,
             STUFF((SELECT ', ' + CAST(m2.MauSacID AS VARCHAR(10)) + '(' + ISNULL(m2.MaMau,'?') + ')'
                    FROM MauSac m2 WHERE LTRIM(RTRIM(m2.TenMau)) = LTRIM(RTRIM(m.TenMau))
                    FOR XML PATH('')), 1, 2, '') AS DsID
      FROM MauSac m
      GROUP BY LTRIM(RTRIM(TenMau)) HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC, LTRIM(RTRIM(TenMau))`)).recordset;
    const trungTenLoai = (await pool.request().query(`
      SELECT LTRIM(RTRIM(TenLoaiVai)) AS Ten, COUNT(*) AS SoBan,
             STUFF((SELECT ', ' + CAST(l2.LoaiVaiID AS VARCHAR(10))
                    FROM LoaiVai l2 WHERE LTRIM(RTRIM(l2.TenLoaiVai)) = LTRIM(RTRIM(l.TenLoaiVai))
                    FOR XML PATH('')), 1, 2, '') AS DsID
      FROM LoaiVai l
      GROUP BY LTRIM(RTRIM(TenLoaiVai)) HAVING COUNT(*) > 1`)).recordset;

    console.log('');
    console.log('=== DANH MUC TRUNG TEN KHAC ID (nguon goc chinh cua loi khong khop) ===');
    if (!trungTenMau.length && !trungTenLoai.length) {
      console.log('  Khong co. Danh muc sach.');
    } else {
      trungTenLoai.forEach(r => console.log(`  LOAI VAI "${r.Ten}": ${r.SoBan} ban ghi -> ID ${r.DsID}`));
      trungTenMau.forEach(r => console.log(`  MAU     "${r.Ten}": ${r.SoBan} ban ghi -> ID ${r.DsID}`));
      console.log('  >> Chi dinh tro mot ID, cay vai trong kho tro ID khac => phep loc ghep bang ID truot sach.');
    }
    if (CHI_TRUNG_TEN) { console.log(''); process.exit(0); }

    if (!argMaDH && !argDon) {
      console.log('');
      console.log('Thieu tham so. Vi du:  node utils/soi_chi_dinh_vai.js --madh=DH2608001');
      process.exit(0);
    }

    /* ------------------------------------------------------------------------------------------
       PHAN B — LENH SX
       ------------------------------------------------------------------------------------------ */
    const don = (await pool.request()
      .input('ma', sql.NVarChar, argMaDH || '')
      .input('id', sql.Int, argDon || 0).query(`
        SELECT DonHangID, MaDH, TenSanPham FROM DonHangSanXuat
        WHERE (@id > 0 AND DonHangID = @id) OR (@id = 0 AND MaDH = @ma)`)).recordset[0];
    if (!don) { console.log(`\n!! Khong tim thay lenh SX (${argMaDH || argDon}).`); process.exit(1); }
    console.log('');
    console.log('==============================================================');
    console.log(`LENH SX ${don.MaDH}  (DonHangID=${don.DonHangID})  ${don.TenSanPham || ''}`);

    /* Tung dong chi dinh + so cay khop theo DUNG cau loc cua form phieu xuat. */
    const dong = (await pool.request().input('id', sql.Int, don.DonHangID).query(`
      SELECT cd.Id, cd.TenPhieu, cd.Kieu, cd.LoaiVaiID, cd.MauSacID,
             lv.TenLoaiVai, ms.TenMau, cd.SoKGYeuCau, cd.SoMet, cd.DVTVaiYeuCau,
             /* (1) So cay khop DAY DU (ID loai + ID mau) va CON TON  -> dung cai form dang dung */
             (SELECT COUNT(*) FROM vw_TonCayVai t JOIN DanhMucVai dv ON dv.VaiID = t.VaiID
              WHERE t.KGCon > 0 AND dv.LoaiVaiID = cd.LoaiVaiID AND dv.MauSacID = cd.MauSacID) AS CayKhopConTon,
             /* (2) Khop ID nhung HET TON -> phan biet "loi ghep" voi "het that" */
             (SELECT COUNT(*) FROM vw_TonCayVai t JOIN DanhMucVai dv ON dv.VaiID = t.VaiID
              WHERE t.KGCon <= 0 AND dv.LoaiVaiID = cd.LoaiVaiID AND dv.MauSacID = cd.MauSacID) AS CayKhopHetTon,
             /* (3) Khop theo TEN (bo dau cach, khong phan biet hoa thuong) va con ton.
                    Lon hon (1) => dung la LECH ID NHUNG TRUNG TEN. */
             (SELECT COUNT(*) FROM vw_TonCayVai t
              WHERE t.KGCon > 0
                AND REPLACE(LOWER(LTRIM(RTRIM(ISNULL(t.TenLoaiVai,'')))), ' ', '')
                    = REPLACE(LOWER(LTRIM(RTRIM(ISNULL(lv.TenLoaiVai,'@@')))), ' ', '')
                AND REPLACE(LOWER(LTRIM(RTRIM(ISNULL(t.TenMau,'')))), ' ', '')
                    = REPLACE(LOWER(LTRIM(RTRIM(ISNULL(ms.TenMau,'@@')))), ' ', '')) AS CayKhopTenConTon
      FROM ChiDinhVaiSX cd
      LEFT JOIN LoaiVai lv ON lv.LoaiVaiID = cd.LoaiVaiID
      LEFT JOIN MauSac ms ON ms.MauSacID = cd.MauSacID
      WHERE cd.DonHangID = @id
      ORDER BY ISNULL(cd.TenPhieu, N''), cd.Kieu, cd.Id`)).recordset;

    if (!dong.length) {
      console.log('\n!! Lenh SX nay KHONG co dong "Chi dinh vai SX" nao. Vao QLSX -> Chi dinh vai SX de khai.');
      process.exit(0);
    }

    console.log(`\nCo ${dong.length} dong chi dinh:\n`);
    let soTruot = 0;
    for (const d of dong) {
      const banGhi = d.TenPhieu ? `[ban "${d.TenPhieu}"]` : '[ban KHONG TEN = ban tinh luong]';
      console.log(`--- #${d.Id} ${banGhi} ${d.Kieu}`);
      console.log(`    Loai vai : ${d.LoaiVaiID == null ? 'NULL (!!)' : d.LoaiVaiID}  "${d.TenLoaiVai || '(khong co trong danh muc)'}"`);
      console.log(`    Mau      : ${d.MauSacID == null ? 'NULL (!!)' : d.MauSacID}  "${d.TenMau || '(khong co trong danh muc)'}"`);
      console.log(`    Yeu cau  : ${so(d.SoKGYeuCau)} Kg / ${so(d.SoMet)} met  (DVT khai: ${d.DVTVaiYeuCau || '-'})`);
      console.log(`    Cay khop ID & con ton : ${d.CayKhopConTon}`);
      console.log(`    Cay khop ID nhung het: ${d.CayKhopHetTon}`);
      console.log(`    Cay khop TEN & con ton: ${d.CayKhopTenConTon}`);

      const lyDo = [];
      if (d.LoaiVaiID == null) lyDo.push('THIEU LoaiVaiID — dong nay go tu do, chua chon Loai vai tu danh muc.');
      if (d.MauSacID == null) lyDo.push('THIEU MauSacID — dong nay go tu do, chua chon Mau tu danh muc.');
      if (!(Number(d.SoKGYeuCau) > 0) && !(Number(d.SoMet) > 0)) {
        lyDo.push('CA KG VA SO MET DEU TRONG — dong nay bi bo qua khi loc cay (da noi dieu kien o v7.35, '
          + 'nhung van nen khai so luong de biet con thieu bao nhieu).');
      }
      if (d.CayKhopConTon === 0 && d.CayKhopTenConTon > 0) {
        lyDo.push(`LECH ID NHUNG TRUNG TEN — co ${d.CayKhopTenConTon} cay ton dung TEN loai+mau nay nhung `
          + 'ID danh muc khac. Day la nguyen nhan "co ton ma khong xuat duoc". Xem phan DANH MUC TRUNG TEN o tren.');
      }
      if (d.CayKhopConTon === 0 && d.CayKhopTenConTon === 0 && d.CayKhopHetTon > 0) {
        lyDo.push('Khop dung danh muc nhung DA XUAT HET (KGCon <= 0) — khong phai loi.');
      }
      if (d.CayKhopConTon === 0 && d.CayKhopTenConTon === 0 && d.CayKhopHetTon === 0
          && d.LoaiVaiID != null && d.MauSacID != null) {
        lyDo.push('Kho KHONG co cay vai nao dung loai+mau nay (ke ca het ton) — can nhap kho truoc.');
      }
      if (d.CayKhopConTon > 0) console.log('    => XUAT DUOC.');
      else {
        soTruot++;
        console.log('    => KHONG XUAT DUOC. Ly do:');
        lyDo.forEach(x => console.log('       - ' + x));
      }

      if (IN_CAY && (d.CayKhopConTon > 0 || d.CayKhopTenConTon > 0)) {
        const cay = (await pool.request()
          .input('lv', sql.Int, d.LoaiVaiID).input('ms', sql.Int, d.MauSacID)
          .input('tlv', sql.NVarChar, d.TenLoaiVai || '@@').input('tms', sql.NVarChar, d.TenMau || '@@').query(`
            SELECT t.MaCay, t.MaVai, t.TenLoaiVai, t.TenMau, t.KGCon, t.MetCon, t.TrangThai,
                   dv.LoaiVaiID, dv.MauSacID,
                   CASE WHEN dv.LoaiVaiID = @lv AND dv.MauSacID = @ms THEN 'KHOP-ID' ELSE 'chi-trung-TEN' END AS Kieu
            FROM vw_TonCayVai t JOIN DanhMucVai dv ON dv.VaiID = t.VaiID
            WHERE t.KGCon > 0
              AND ((dv.LoaiVaiID = @lv AND dv.MauSacID = @ms)
                   OR (REPLACE(LOWER(LTRIM(RTRIM(ISNULL(t.TenLoaiVai,'')))), ' ', '') = REPLACE(LOWER(LTRIM(RTRIM(@tlv))), ' ', '')
                       AND REPLACE(LOWER(LTRIM(RTRIM(ISNULL(t.TenMau,'')))), ' ', '') = REPLACE(LOWER(LTRIM(RTRIM(@tms))), ' ', '')))
            ORDER BY Kieu, t.MaCay`)).recordset;
        cay.forEach(c => console.log(`       ${c.Kieu === 'KHOP-ID' ? '[v]' : '[x]'} ${c.MaCay} (${c.MaVai})`
          + ` ${c.TenLoaiVai}/${c.TenMau} loai=${c.LoaiVaiID} mau=${c.MauSacID}`
          + ` con ${so(c.KGCon)}kg ${so(c.MetCon)}m ${c.TrangThai}`));
      }
      console.log('');
    }

    console.log('==============================================================');
    console.log(`${dong.length - soTruot} dong xuat duoc / ${soTruot} dong KHONG xuat duoc.`);
    if (soTruot) {
      console.log('');
      console.log('CACH SUA (theo thu tu nen lam):');
      console.log('  1. Neu ly do la LECH ID NHUNG TRUNG TEN: gop ban ghi danh muc trung ten, hoac vao');
      console.log('     QLSX -> Chi dinh vai SX, xoa o Loai vai/Mau roi CHON LAI TU GOI Y (khong go moi).');
      console.log('  2. Neu THIEU LoaiVaiID/MauSacID: cung lam nhu tren - phai chon tu danh muc.');
      console.log('  3. Xem cay nao dang co: node utils/soi_chi_dinh_vai.js --madh=' + (argMaDH || don.MaDH) + ' --cay');
      console.log('  4. Xem toan bo danh muc trung ten: node utils/soi_chi_dinh_vai.js --trung-ten');
    }
    console.log('');
    process.exit(0);
  } catch (err) {
    console.error('LOI: ' + err.message);
    process.exit(1);
  }
})();
