/* ================================================================================================
   SOI "CHI DINH VAI SX" vs TON CAY VAI — vi sao khong xuat duoc?   (chi DOC)            v7.35.1
   ------------------------------------------------------------------------------------------------
   Dung khi: "co vai ton dung loai dung mau, da chi dinh, ma lap phieu xuat khong ra cay nao"
   (dac biet khi CUNG LENH SX do, loai vai KHAC lai xuat duoc binh thuong).

   ⚠️ BAN v7.35 DAU TIEN KET LUAN SAI: no bao "DA XUAT HET (KGCon <= 0) — khong phai loi". Nhung
   `KGCon = KGNhap - KG da xuat`, va vai nhap theo MET/CAY thi `KGNhap = 0` (form nhap kho cho phep:
   khovai.js `const kg = Number(roll.kgNhap) || 0`). Cay nhu vay co KGCon = 0 du CON NGUYEN MET —
   "het KG" va "chua bao gio co KG" bi tron thanh mot. Ban nay tach ro.

   BON LY DO mot dong chi dinh khong ra cay nao:
       1. Thieu LoaiVaiID / MauSacID   -> dong go tu do, chua chon tu danh muc
       2. LECH ID nhung TRUNG TEN      -> danh muc co 2 ban ghi cung ten khac ID (MauSac.TenMau
                                          KHONG UNIQUE) nen chi dinh tro ID nay, cay vai tro ID kia
       3. Con MET nhung KGNhap = 0     -> cay co that, con hang, nhung moi cho loc "con ton" trong
                                          he thong dung `KGCon > 0` nen cay VO HINH  <= nghi nhieu
       4. Het that (KG va MET deu <= 0)-> khong phai loi

   CACH DUNG (trong thu muc backend):
     node utils/soi_chi_dinh_vai.js --madh=DH2608058
     node utils/soi_chi_dinh_vai.js --madh=DH2608058 --cay    (in TUNG CAY, ke ca cay het ton)
     node utils/soi_chi_dinh_vai.js --don=5076
     node utils/soi_chi_dinh_vai.js --trung-ten               (danh muc trung ten khac ID)
     node utils/soi_chi_dinh_vai.js --met                     (MOI cay KGNhap=0 ma con met — dien
                                                               vai bi "vo hinh" tren toan he thong)
   ================================================================================================ */
const { sql, getPool } = require('../db');

const argv = process.argv.slice(2);
const lay = k => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.split('=').slice(1).join('=') : ''; };
const argMaDH = lay('madh');
const argDon = parseInt(lay('don'), 10) || 0;
const IN_CAY = argv.includes('--cay');
const CHI_TRUNG_TEN = argv.includes('--trung-ten');
const CHI_MET = argv.includes('--met');
/* --macay=A,B,C : tra THANG tung ma cay -> nhap vao LoaiVaiID / MauSacID nao. Cau hoi truc tiep nhat
   khi da biet ma cay: "cay nay dang tro ID loai vai nao, co trung voi ID ma chi dinh tro khong?" */
const dsMaCay = (lay('macay') || '').split(',').map(s => s.trim()).filter(Boolean);
const so = n => (Number(n) || 0).toLocaleString('vi-VN');
/* Chuan hoa ten de so khop "gan giong": bo khoang trang (ke ca khoang trang doi nhu "Lami  Trang 2")
   va khong phan biet hoa thuong. KHONG bo dau tieng Viet — bo dau se lam "kẻ" = "ke" = "kê". */
const CHUAN = t => `REPLACE(LOWER(LTRIM(RTRIM(ISNULL(${t}, N'@@KHONGCO@@')))), N' ', N'')`;
/* CON HANG = con KG *hoac* con MET. Day la dinh nghia DUNG, khac voi `KGCon > 0` ma he thong dang dung. */
const CON_HANG = '(t.KGCon > 0 OR t.MetCon > 0)';

(async () => {
  let pool;
  try { pool = await getPool(); }
  catch (err) { console.error('KHONG ket noi duoc CSDL: ' + err.message); process.exit(1); }

  try {
    /* ============================================================================================
       PHAN A — DANH MUC BI TRUNG TEN KHAC ID
       `MauSac.TenMau` khong co rang buoc UNIQUE (chi `MaMau` UNIQUE), va form Chi dinh vai SX cho GO
       TU DO: go ten khong khop tuyet doi thi backend TAO BAN GHI MOI (qlsx.js resolveMauSacIdQ).
       ============================================================================================ */
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
    console.log('=== A. DANH MUC TRUNG TEN KHAC ID ===');
    if (!trungTenMau.length && !trungTenLoai.length) console.log('  Khong co. Danh muc sach.');
    else {
      trungTenLoai.forEach(r => console.log(`  LOAI VAI "${r.Ten}": ${r.SoBan} ban ghi -> ID ${r.DsID}`));
      trungTenMau.forEach(r => console.log(`  MAU     "${r.Ten}": ${r.SoBan} ban ghi -> ID ${r.DsID}`));
      console.log('  >> Chi dinh tro mot ID, cay vai trong kho tro ID khac => phep loc ghep bang ID truot sach.');
    }
    if (CHI_TRUNG_TEN) { console.log(''); process.exit(0); }

    /* ============================================================================================
       PHAN B — CAY "VO HINH": KGNhap = 0 (nhap theo MET/CAY) nhung con MET
       He thong loc "con ton" bang `KGCon > 0` o 8 cho (khovai.js 141/177/339, qlsx.js 2358/2375,
       module.khovai.js 187/209/251) nen nhung cay nay khong hien o BAT KY man xuat kho nao.
       ============================================================================================ */
    const voHinh = (await pool.request().query(`
      SELECT t.MaCay, t.MaVai, t.TenLoaiVai, t.TenMau, t.KGNhap, t.KGCon, t.SoMet, t.MetCon, t.TrangThai
      FROM vw_TonCayVai t
      WHERE ISNULL(t.KGNhap, 0) <= 0 AND t.MetCon > 0
      ORDER BY t.TenLoaiVai, t.TenMau, t.MaCay`)).recordset;
    console.log('');
    console.log('=== B. CAY "VO HINH" (KGNhap = 0 nhung con MET) ===');
    if (!voHinh.length) console.log('  Khong co cay nao. (Moi cay con hang deu co KG.)');
    else {
      console.log(`  CO ${voHinh.length} cay con met ma KGNhap = 0 => KGCon = 0 => bi moi phep loc`);
      console.log('  "con ton" trong he thong (dung KGCon > 0) COI NHU HET. Day la LOI THAT.');
      voHinh.slice(0, 30).forEach(c => console.log(`    ${c.MaCay} (${c.MaVai}) ${c.TenLoaiVai}/${c.TenMau}`
        + `  KG ${so(c.KGNhap)}->${so(c.KGCon)}  MET ${so(c.SoMet)}->${so(c.MetCon)}  ${c.TrangThai}`));
      if (voHinh.length > 30) console.log(`    ... va ${voHinh.length - 30} cay nua`);
    }
    if (CHI_MET) { console.log(''); process.exit(0); }

    /* ============================================================================================
       PHAN B2 — TRA THEO MA CAY (--macay=A,B,C)
       Tra loi truc tiep: cay nay nhap vao LoaiVaiID / MauSacID nao. So sanh cot LoaiVaiID o day voi
       cot "Loai vai" cua dong chi dinh (phan C) — khac nhau la LECH ID.
       ============================================================================================ */
    if (dsMaCay.length) {
      const rq = pool.request();
      dsMaCay.forEach((m, i) => rq.input('m' + i, sql.NVarChar, m));
      const oCay = (await rq.query(`
        SELECT t.MaCay, t.MaVai, t.VaiID, dv.LoaiVaiID, t.TenLoaiVai, dv.MauSacID, t.TenMau,
               t.KGNhap, t.KGCon, t.SoMet, t.MetCon, t.TrangThai, t.NgayNhap
        FROM vw_TonCayVai t
        JOIN DanhMucVai dv ON dv.VaiID = t.VaiID
        WHERE t.MaCay IN (${dsMaCay.map((_, i) => '@m' + i).join(',')})
        ORDER BY t.TenLoaiVai, t.TenMau, t.MaCay`)).recordset;
      console.log('');
      console.log('=== B2. TRA THEO MA CAY ===');
      dsMaCay.forEach(m => {
        if (!oCay.some(c => String(c.MaCay) === m)) console.log(`  !! KHONG TIM THAY ma cay "${m}"`);
      });
      oCay.forEach(c => {
        const conHang = Number(c.KGCon) > 0 || Number(c.MetCon) > 0;
        console.log('');
        console.log(`  ${c.MaCay}`);
        console.log(`     Ma vai   : ${c.MaVai}  (VaiID=${c.VaiID})`);
        console.log(`     LoaiVaiID: ${c.LoaiVaiID}   "${c.TenLoaiVai}"`);
        console.log(`     MauSacID : ${c.MauSacID}   "${c.TenMau}"`);
        console.log(`     KG  : nhap ${so(c.KGNhap)} -> con ${so(c.KGCon)}`);
        console.log(`     MET : nhap ${so(c.SoMet)} -> con ${so(c.MetCon)}`);
        console.log(`     Trang thai: ${c.TrangThai}   Ngay nhap: ${new Date(c.NgayNhap).toLocaleDateString('vi-VN')}`);
        if (Number(c.KGCon) > 0) console.log('     => Form phieu xuat THAY duoc cay nay (KGCon > 0).');
        else if (conHang) console.log('     => ⚠️ CON HANG (con met) nhung KGCon <= 0 => form phieu xuat KHONG THAY. LOI HE THONG.');
        else console.log('     => Het ca KG va MET.');
      });
      /* Gom theo LoaiVaiID de thay ngay neu cac cay "cung mot loai vai" lai nam o 2 ID khac nhau. */
      const nhomLoai = [...new Set(oCay.map(c => c.LoaiVaiID + '|' + c.TenLoaiVai))];
      if (nhomLoai.length > 1) {
        console.log('');
        console.log('  Cac cay tren nam o ' + nhomLoai.length + ' LoaiVaiID khac nhau:');
        nhomLoai.forEach(x => {
          const [id, ten] = x.split('|');
          console.log(`     ${id}  "${ten}"  (${oCay.filter(c => String(c.LoaiVaiID) === id).map(c => c.MaCay).join(', ')})`);
        });
      }
    }

    if (!argMaDH && !argDon) {
      console.log('');
      console.log('Thieu tham so. Vi du:  node utils/soi_chi_dinh_vai.js --madh=DH2608058 --cay');
      process.exit(0);
    }

    /* ============================================================================================
       PHAN C — TUNG DONG CHI DINH CUA LENH SX
       ============================================================================================ */
    const don = (await pool.request()
      .input('ma', sql.NVarChar, argMaDH || '')
      .input('id', sql.Int, argDon || 0).query(`
        SELECT DonHangID, MaDH, TenSanPham FROM DonHangSanXuat
        WHERE (@id > 0 AND DonHangID = @id) OR (@id = 0 AND MaDH = @ma)`)).recordset[0];
    if (!don) { console.log(`\n!! Khong tim thay lenh SX (${argMaDH || argDon}).`); process.exit(1); }
    console.log('');
    console.log('==============================================================');
    console.log(`C. LENH SX ${don.MaDH}  (DonHangID=${don.DonHangID})  ${don.TenSanPham || ''}`);

    const dong = (await pool.request().input('id', sql.Int, don.DonHangID).query(`
      SELECT cd.Id, cd.TenPhieu, cd.Kieu, cd.LoaiVaiID, cd.MauSacID,
             lv.TenLoaiVai, ms.TenMau, cd.SoKGYeuCau, cd.SoMet, cd.DVTVaiYeuCau,

        /* (1) Khop ID loai + ID mau, CON KG  -> dung cai form dang dung (KGCon > 0) */
        (SELECT COUNT(*) FROM vw_TonCayVai t JOIN DanhMucVai dv ON dv.VaiID = t.VaiID
         WHERE t.KGCon > 0 AND dv.LoaiVaiID = cd.LoaiVaiID AND dv.MauSacID = cd.MauSacID) AS KhopID_ConKG,

        /* (2) Khop ID, KG het NHUNG CON MET -> "vo hinh": co hang that ma form khong thay */
        (SELECT COUNT(*) FROM vw_TonCayVai t JOIN DanhMucVai dv ON dv.VaiID = t.VaiID
         WHERE t.KGCon <= 0 AND t.MetCon > 0 AND dv.LoaiVaiID = cd.LoaiVaiID AND dv.MauSacID = cd.MauSacID) AS KhopID_ChiConMet,

        /* (3) Khop ID nhung KG va MET deu het -> het that */
        (SELECT COUNT(*) FROM vw_TonCayVai t JOIN DanhMucVai dv ON dv.VaiID = t.VaiID
         WHERE t.KGCon <= 0 AND t.MetCon <= 0 AND dv.LoaiVaiID = cd.LoaiVaiID AND dv.MauSacID = cd.MauSacID) AS KhopID_HetHan,

        /* (4) Khop CA HAI TEN (loai + mau) va CON HANG, nhung co the khac ID -> lech ID trung ten */
        (SELECT COUNT(*) FROM vw_TonCayVai t
         WHERE ${CON_HANG}
           AND ${CHUAN('t.TenLoaiVai')} = ${CHUAN('lv.TenLoaiVai')}
           AND ${CHUAN('t.TenMau')} = ${CHUAN('ms.TenMau')}) AS KhopTen_ConHang,

        /* (5) Chi khop TEN LOAI (bat ke mau) va con hang -> de biet mau trong kho ten la gi */
        (SELECT COUNT(*) FROM vw_TonCayVai t
         WHERE ${CON_HANG} AND ${CHUAN('t.TenLoaiVai')} = ${CHUAN('lv.TenLoaiVai')}) AS KhopTenLoai_ConHang,

        /* (6) Chi khop TEN MAU (bat ke loai) va con hang */
        (SELECT COUNT(*) FROM vw_TonCayVai t
         WHERE ${CON_HANG} AND ${CHUAN('t.TenMau')} = ${CHUAN('ms.TenMau')}) AS KhopTenMau_ConHang
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
    const tomTat = [];
    for (const d of dong) {
      const banGhi = d.TenPhieu ? `[ban "${d.TenPhieu}"]` : '[ban KHONG TEN = ban tinh luong]';
      console.log(`--- #${d.Id} ${banGhi} ${d.Kieu}`);
      console.log(`    Loai vai : ${d.LoaiVaiID == null ? 'NULL (!!)' : d.LoaiVaiID}  "${d.TenLoaiVai || '(khong co trong danh muc)'}"`);
      console.log(`    Mau      : ${d.MauSacID == null ? 'NULL (!!)' : d.MauSacID}  "${d.TenMau || '(khong co trong danh muc)'}"`);
      console.log(`    Yeu cau  : ${so(d.SoKGYeuCau)} Kg / ${so(d.SoMet)} met  (DVT khai: ${(d.DVTVaiYeuCau || '-').trim()})`);
      console.log(`    Khop ID: con KG = ${d.KhopID_ConKG} | CHI CON MET = ${d.KhopID_ChiConMet} | het han = ${d.KhopID_HetHan}`);
      console.log(`    Khop TEN (loai+mau) con hang = ${d.KhopTen_ConHang}`
        + ` | chi ten LOAI = ${d.KhopTenLoai_ConHang} | chi ten MAU = ${d.KhopTenMau_ConHang}`);

      const lyDo = [];
      let nhan = '';
      if (d.LoaiVaiID == null) lyDo.push('THIEU LoaiVaiID — dong nay go tu do, chua chon Loai vai tu danh muc.');
      if (d.MauSacID == null) lyDo.push('THIEU MauSacID — dong nay go tu do, chua chon Mau tu danh muc.');
      if (!(Number(d.SoKGYeuCau) > 0) && !(Number(d.SoMet) > 0)) {
        lyDo.push('CA KG VA SO MET DEU TRONG — bi dieu kien `cd.SoKGYeuCau > 0` o /vaichophep chan.');
        nhan = nhan || 'KG+MET-TRONG';
      }
      if (d.KhopID_ConKG === 0 && d.KhopID_ChiConMet > 0) {
        lyDo.push(`⚠️ LOI THAT: co ${d.KhopID_ChiConMet} cay KHOP DUNG danh muc, CON MET nhung KG = 0 `
          + '(nhap theo met/cay). He thong loc "con ton" bang `KGCon > 0` nen coi nhu HET. '
          + 'Day la vai co that trong kho ma form khong thay.');
        nhan = 'CON-MET-KG-0';
      }
      if (d.KhopID_ConKG === 0 && d.KhopID_ChiConMet === 0 && d.KhopTen_ConHang > 0) {
        lyDo.push(`LECH ID NHUNG TRUNG TEN — co ${d.KhopTen_ConHang} cay con hang dung TEN loai+mau nay `
          + 'nhung ID danh muc khac. Xem phan A.');
        nhan = nhan || 'LECH-ID';
      }
      if (d.KhopID_ConKG === 0 && d.KhopID_ChiConMet === 0 && d.KhopTen_ConHang === 0 && d.KhopID_HetHan > 0) {
        lyDo.push(`Khop dung danh muc nhung ${d.KhopID_HetHan} cay da HET CA KG VA MET — het that, khong phai loi.`);
        nhan = nhan || 'HET-THAT';
      }
      if (d.KhopID_ConKG === 0 && d.KhopID_ChiConMet === 0 && d.KhopTen_ConHang === 0 && d.KhopID_HetHan === 0) {
        if (d.KhopTenLoai_ConHang > 0) {
          lyDo.push(`Kho co ${d.KhopTenLoai_ConHang} cay CUNG TEN LOAI VAI nhung khac mau — kiem tra lai `
            + 'ten mau da chon (chay lai voi --cay de xem ten mau thuc te trong kho).');
          nhan = nhan || 'LECH-MAU';
        } else if (d.KhopTenMau_ConHang > 0) {
          lyDo.push(`Kho co ${d.KhopTenMau_ConHang} cay CUNG TEN MAU nhung khac loai vai — kiem tra lai ten loai vai.`);
          nhan = nhan || 'LECH-LOAI';
        } else {
          lyDo.push('Kho KHONG co cay vai nao dung loai+mau nay (ke ca het) — can nhap kho truoc.');
          nhan = nhan || 'CHUA-NHAP';
        }
      }
      if (d.KhopID_ConKG > 0) { console.log('    => XUAT DUOC.'); tomTat.push(`#${d.Id} OK`); }
      else {
        soTruot++;
        console.log('    => KHONG XUAT DUOC. Ly do:');
        lyDo.forEach(x => console.log('       - ' + x));
        tomTat.push(`#${d.Id} ${nhan || 'KHONG-RO'}`);
      }

      /* --cay: in TUNG CAY lien quan, KE CA cay het ton, de doc duoc bang mat KG/MET thuc te. */
      if (IN_CAY) {
        const cay = (await pool.request()
          .input('lv', sql.Int, d.LoaiVaiID).input('ms', sql.Int, d.MauSacID)
          .input('tlv', sql.NVarChar, d.TenLoaiVai || '@@KHONGCO@@')
          .input('tms', sql.NVarChar, d.TenMau || '@@KHONGCO@@').query(`
            SELECT t.MaCay, t.MaVai, t.TenLoaiVai, t.TenMau, t.KGNhap, t.KGCon, t.SoMet, t.MetCon,
                   t.TrangThai, dv.LoaiVaiID, dv.MauSacID,
                   CASE WHEN dv.LoaiVaiID = @lv AND dv.MauSacID = @ms THEN 'KHOP-ID'
                        WHEN ${CHUAN('t.TenLoaiVai')} = ${CHUAN('@tlv')}
                             AND ${CHUAN('t.TenMau')} = ${CHUAN('@tms')} THEN 'chi-trung-TEN'
                        WHEN ${CHUAN('t.TenLoaiVai')} = ${CHUAN('@tlv')} THEN 'cung-LOAI-khac-mau'
                        ELSE 'cung-MAU-khac-loai' END AS Kieu
            FROM vw_TonCayVai t JOIN DanhMucVai dv ON dv.VaiID = t.VaiID
            WHERE (dv.LoaiVaiID = @lv AND dv.MauSacID = @ms)
               OR ${CHUAN('t.TenLoaiVai')} = ${CHUAN('@tlv')}
               OR ${CHUAN('t.TenMau')} = ${CHUAN('@tms')}
            ORDER BY Kieu, t.MaCay`)).recordset;
        if (!cay.length) console.log('       (khong co cay nao lien quan)');
        cay.slice(0, 40).forEach(c => {
          const conHang = Number(c.KGCon) > 0 || Number(c.MetCon) > 0;
          const daubat = Number(c.KGCon) > 0 ? '[v]' : (conHang ? '[MET]' : '[het]');
          console.log(`       ${daubat} ${c.Kieu.padEnd(18)} ${c.MaCay} (${c.MaVai})`
            + ` ${c.TenLoaiVai}/${c.TenMau} loai=${c.LoaiVaiID} mau=${c.MauSacID}`
            + `  KG ${so(c.KGNhap)}->${so(c.KGCon)}  MET ${so(c.SoMet)}->${so(c.MetCon)}  ${c.TrangThai}`);
        });
        if (cay.length > 40) console.log(`       ... va ${cay.length - 40} cay nua`);
      }
      console.log('');
    }

    console.log('==============================================================');
    console.log(`${dong.length - soTruot} dong xuat duoc / ${soTruot} dong KHONG xuat duoc.`);
    console.log('Tom tat: ' + tomTat.join(' | '));
    console.log('');
    console.log('Y NGHIA NHAN:');
    console.log('  CON-MET-KG-0  = LOI HE THONG, toi phai sua code (loc "con ton" phai tinh ca MET).');
    console.log('  KG+MET-TRONG  = LOI HE THONG, dieu kien SoKGYeuCau > 0 o /vaichophep can noi.');
    console.log('  LECH-ID       = du lieu danh muc trung ten -> chon lai Loai vai/Mau tu goi y.');
    console.log('  LECH-MAU / LECH-LOAI = khai sai ten -> sua o QLSX > Chi dinh vai SX.');
    console.log('  HET-THAT / CHUA-NHAP = khong phai loi, phai nhap kho.');
    console.log('');
    process.exit(0);
  } catch (err) {
    console.error('LOI: ' + err.message);
    process.exit(1);
  }
})();
