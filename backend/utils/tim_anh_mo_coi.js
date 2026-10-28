/* ================================================================================================
   v9.03 — TIM ANH MO COI TRONG /uploads VA GAN LAI VAO THE KHO
   ------------------------------------------------------------------------------------------------
   Nguyen 2026-10-25: "mot so ma hang hoa khi lam phieu nhap tai anh len nhung o the kho hang hoa
   khong co anh tung mau" + "xem trong thu muc upload cua server CO anh tung mau, nhung khong the hien
   tren the kho hay catalogue".

   => File da len /uploads nhung TheKhoChiTietMau.LinkAnh van NULL. Script nay:
     1. Doc TOAN BO duong dan anh dang duoc dung trong CSDL (5 nguon, xem DS_COT_ANH).
     2. Quet thu muc backend/uploads, lay file KHONG duoc dung o dau ca = MO COI.
     3. Doan chu nhan tu TEN FILE: frontend dat ten theo `<maHang>_mau<mauSacId|tenMau>_<timestamp>`
        (anh mau) va `<maHang>_dd_<timestamp>` (anh dai dien) — xem module.nhapkho.js + routes/upload.js.
        ⚠️ routes/upload.js XOA moi ky tu ngoai [A-Za-z0-9_-] khoi tien to, nen ten mau TIENG VIET bi
        xoa sach: `AT01_mau_1761...jpg` khong biet la mau nao -> chi bao cao, KHONG tu gan.
     4. In bang de nguoi dung doi chieu. CHAY LAI voi `--ganlai` thi moi ghi vao CSDL.

   🔴 CHAY MAC DINH LA CHI DOC. `--ganlai` chi ghi vao dong co LinkAnh DANG NULL (khong bao gio de len
   anh dang co), va chi khi doan duoc CHAC CHAN (ten file co mauSacId dang SO + ma hang khop duy nhat).

   🔴 PHAI CHAY TU THU MUC backend: db.js goi dotenv.config() doc file .env theo THU MUC HIEN TAI,
   ma .env nam o backend\. Chay tu goc repo la khong ket noi duoc CSDL.
   Chay:
     cd C:\Users\QUAN\Claude\Projects\Quan\QLNoiBo\backend
     node utils\tim_anh_mo_coi.js              <- bao cao, khong ghi gi
     node utils\tim_anh_mo_coi.js --chitiet    <- + liet ke tung file mo coi (rat dai)
     node utils\tim_anh_mo_coi.js --ganlai     <- ghi LinkAnh cho cac dong dang trong

   ⚠️ FILE MO COI ≠ ANH BI MAT. Tai len lai nhieu lan thi ban truoc thanh mo coi — do la rac BINH
   THUONG (va chinh la trieu chung cua nguyen nhan #4: truoc v9.03 form Sua phieu khong hien anh dang
   luu nen nguoi dung tai lai). Bang "DONG MAU DANG THIEU ANH" moi la cau tra loi cho "ma nao mat anh".
   ================================================================================================ */
const fs = require('fs');
const path = require('path');
const { sql, getPool } = require('../db');

const THU_MUC = path.join(__dirname, '..', 'uploads');
const GAN_LAI = process.argv.includes('--ganlai');

/* Moi cot CSDL dang luu duong dan /uploads/... — THIEU MOT COT la file dang dung bi bao nham la
   "mo coi", bao cao day nhieu va nguoi doc het tin. Danh sach nay ra soat 2026-10-25 tren
   CAI_DAT_DAY_DU.sql; them man hinh nao co tai anh thi PHAI them cot vao day.
   (NhanVien.AnhDaiDien nam o /uploads_hr — thu muc khac, khong lien quan.) */
const DS_COT_ANH = [
  { bang: 'TheKhoChiTietMau', cot: 'LinkAnh' },
  { bang: 'TheKhoHangHoa', cot: 'AnhDaiDien' },
  { bang: 'DonHangSanXuat', cot: 'AnhSanPham' },
  { bang: 'DonHangSanXuat', cot: 'AnhHinhIn' },        // NVARCHAR(MAX), co the chua NHIEU duong dan
  { bang: 'DonHangChiTietVai', cot: 'AnhMau' },
  { bang: 'DonHangDonGiaInThe', cot: 'AnhMinhHoa' },
  { bang: 'MauSac', cot: 'AnhMau' },
  { bang: 'VaiCay', cot: 'AnhCay' },
  { bang: 'TienDoCatChiTietCay', cot: 'AnhCay' },
  { bang: 'DanhMucPhuKien', cot: 'AnhDaiDien' },
  { bang: 'TaiLieuMoTaSanPhamO', cot: 'AnhUrl' },
  { bang: 'TaiLieuThongKeChiTiet', cot: 'AnhDaiDien' },
  { bang: 'TaiLieuThongKeChiTietDong', cot: 'AnhChiTiet' },
  { bang: 'TaiLieuThongSoDo', cot: 'AnhGhiChu' },
  { bang: 'ShopBanLe', cot: 'AnhMatTien' },
  { bang: 'GheTham', cot: 'Anh' }
];

async function coCot(pool, bang, cot) {
  try {
    const r = (await pool.request().query(`SELECT COL_LENGTH('${bang}','${cot}') AS c`)).recordset[0] || {};
    return r.c != null;
  } catch (e) { return false; }
}

/* Lay MOI ten file /uploads/... trong mot gia tri. Khong cat theo dau '/' cuoi cung: co cot chua
   NHIEU duong dan trong mot o (DonHangSanXuat.AnhHinhIn la NVARCHAR(MAX), luu nhieu anh). */
function dsTenFileTrong(u) {
  const s = String(u || '');
  const ra = [];
  const re = /\/uploads\/([A-Za-z0-9_\-.]+)/g;
  let m;
  while ((m = re.exec(s)) !== null) ra.push(m[1]);
  return ra;
}

(async () => {
  let pool;
  try { pool = await getPool(); }
  catch (e) { console.error('Khong ket noi duoc CSDL: ' + e.message); process.exit(1); }

  if (!fs.existsSync(THU_MUC)) { console.error('Khong thay thu muc ' + THU_MUC); process.exit(1); }

  /* ---------- 1. Moi file dang duoc dung ---------- */
  const dangDung = new Set();
  for (const c of DS_COT_ANH) {
    if (!await coCot(pool, c.bang, c.cot)) { console.log(`  (bo qua) ${c.bang}.${c.cot} chua co trong CSDL`); continue; }
    const rs = (await pool.request().query(
      `SELECT ${c.cot} AS U FROM ${c.bang} WHERE ${c.cot} IS NOT NULL AND LTRIM(RTRIM(${c.cot})) <> ''`)).recordset;
    let n = 0;
    rs.forEach(r => dsTenFileTrong(r.U).forEach(t => { dangDung.add(t); n++; }));
    console.log(`  ${c.bang}.${c.cot}: ${rs.length} o, ${n} duong dan`);
  }

  /* ---------- 2. File mo coi ---------- */
  const tatCa = fs.readdirSync(THU_MUC).filter(f => /\.(jpg|jpeg|png|webp|gif)$/i.test(f));
  const moCoi = tatCa.filter(f => !dangDung.has(f));
  console.log(`\n=== /uploads: ${tatCa.length} file anh, ${dangDung.size} dang duoc dung, ${moCoi.length} MO COI ===`);
  if (!moCoi.length) { console.log('Khong co file mo coi. Van de nam o cho khac — bao lai de tim tiep.'); process.exit(0); }

  /* ---------- 3. Doan chu nhan tu ten file ---------- */
  const maHangs = (await pool.request().query('SELECT MaHangID, MaHang FROM TheKhoHangHoa')).recordset;
  /* Ten file da bi loc con [A-Za-z0-9_-], nen phai so khop MA HANG theo DUNG cach do. */
  const sach = (s) => String(s || '').replace(/[^a-zA-Z0-9_\-]/g, '');
  const theoMaSach = new Map();
  maHangs.forEach(m => {
    const k = sach(m.MaHang);
    if (!k) return;
    if (!theoMaSach.has(k)) theoMaSach.set(k, []);
    theoMaSach.get(k).push(m);
  });

  const mauSacs = (await pool.request().query('SELECT MauSacID, TenMau FROM MauSac')).recordset;
  const tenMauTheoId = new Map(mauSacs.map(m => [String(m.MauSacID), m.TenMau]));

  /* ================================================================================================
     v9.03b — SO KHOP MAU THEO TEN DA LOC (du lieu that 2026-10-25 cho thay day moi la truong hop chinh).
     Frontend dat ten file: maHang + '_mau' + (mauSacId || tenMau). Luc TAI ANH ma mau chua co trong
     danh muc (nguoi dung dang GO TAY ten mau) thi mauSacId = null -> dung TEN. routes/upload.js loc
     con [A-Za-z0-9_-] nen "Đen"->"en", "Tím Than"->"TmThan", "Lông Chuột"->"LngChut", "Nâu"->"Nu".
     Van gan lai duoc: loc TEN MAU trong CSDL bang DUNG cach do roi so khop — NHUNG chi trong pham vi
     CAC MAU CUA CHINH MA HANG DO va chi khi khop DUY NHAT. Khop nhieu hon mot -> khong gan, bao ra.
     ================================================================================================ */
  const mauTheoTenSach = new Map();   // sach(TenMau).toLowerCase() -> [MauSacID]
  mauSacs.forEach(m => {
    const k = sach(m.TenMau).toLowerCase();
    if (!k) return;
    if (!mauTheoTenSach.has(k)) mauTheoTenSach.set(k, []);
    mauTheoTenSach.get(k).push(m.MauSacID);
  });
  /* Mau NAO thuoc ma hang nao: doc vw_TonTheoMau de co CA mau chi ton tai tren phieu nhap. */
  const mauCuaMa = new Map();   // MaHangID -> Set(MauSacID)
  (await pool.request().query('SELECT DISTINCT MaHangID, MauSacID FROM vw_TonTheoMau')).recordset
    .forEach(r => {
      if (!mauCuaMa.has(r.MaHangID)) mauCuaMa.set(r.MaHangID, new Set());
      mauCuaMa.get(r.MaHangID).add(r.MauSacID);
    });

  const dong = [];
  for (const f of moCoi) {
    /* <tienTo>_<timestamp>.<ext> — timestamp la Date.now() (13 chu so). */
    const m = f.match(/^(.*)_(\d{10,})\.[A-Za-z0-9]+$/);
    const tienTo = m ? m[1] : '';
    const ngay = m ? new Date(Number(m[2])) : null;
    let loai = 'khong ro', maHang = '', mauSacId = '', ghiChu = '', duoiTen = '';
    /* `(.*)` tham lam -> lui ve dau `_mau` / `_dd` CUOI CUNG, nen ma hang co chua '_' hoac chu 'mau'
       van tach dung. Duoi `_mau` co the la SO (MauSacID) hoac TEN mau ASCII (vd "Navy") — ten tieng
       Viet bi routes/upload.js xoa sach nen ra rong. */
    const mMau = tienTo.match(/^(.*)_mau(.*)$/);
    const mDd = tienTo.match(/^(.*)_dd$/);
    if (mMau) {
      loai = 'anh mau'; maHang = mMau[1];
      duoiTen = mMau[2] || '';
      if (/^\d+$/.test(duoiTen)) mauSacId = duoiTen;
      else if (!duoiTen) ghiChu = 'ten mau bi xoa sach khoi ten file -> khong biet mau nao';
      // duoi la CHU -> doi chieu theo ten da loc, lam sau khi biet ma hang (xem duoi)
    } else if (mDd) { loai = 'anh dai dien'; maHang = mDd[1]; }
    else if (theoMaSach.has(tienTo)) {
      /* module.khohang.js tai anh dai dien voi tien to = CHINH ma hang (khong co '_dd'). */
      loai = 'anh dai dien'; maHang = tienTo;
    } else ghiChu = 'ten file khong theo khuon cua phieu nhap kho';

    const ds = theoMaSach.get(maHang) || [];
    if (maHang && ds.length === 0) ghiChu = ghiChu || ('khong tim thay ma hang "' + maHang + '"');
    if (ds.length > 1) ghiChu = ghiChu || ('ten file khop ' + ds.length + ' ma hang -> khong tu gan duoc');
    /* Duoi ten file la CHU -> tim MauSacID theo ten da loc, CHI trong cac mau cua chinh ma hang nay. */
    if (loai === 'anh mau' && !mauSacId && duoiTen && ds.length === 1) {
      const ungVien = (mauTheoTenSach.get(duoiTen.toLowerCase()) || [])
        .filter(id => (mauCuaMa.get(ds[0].MaHangID) || new Set()).has(id));
      if (ungVien.length === 1) mauSacId = String(ungVien[0]);
      else if (ungVien.length > 1) ghiChu = `ten "${duoiTen}" khop ${ungVien.length} mau cua ma nay -> khong tu gan`;
      else ghiChu = `khong tim ra mau nao cua ma nay co ten loc = "${duoiTen}" -> doi chieu tay`;
    }
    dong.push({
      file: f, loai, maHang, maHangID: ds.length === 1 ? ds[0].MaHangID : null,
      maHangThat: ds.length === 1 ? ds[0].MaHang : '',
      mauSacId, tenMau: tenMauTheoId.get(String(mauSacId)) || '', duoiTen,
      moc: m ? Number(m[2]) : 0,   // timestamp de so "file moi nhat" bang SO, khong so chuoi
      ngay: ngay && !isNaN(ngay) ? ngay.toLocaleString('vi-VN') : '', ghiChu
    });
  }

  const ganDuoc = dong.filter(d => d.loai === 'anh mau' && d.maHangID && d.mauSacId && d.tenMau);
  const ganDuocDD = dong.filter(d => d.loai === 'anh dai dien' && d.maHangID);

  /* ================================================================================================
     CAU HOI THAT SU CAN TRA LOI: "MA/MAU NAO DANG THIEU ANH?"
     File mo coi KHONG dong nghia voi mat anh — tai len lai nhieu lan thi lan truoc thanh mo coi, do la
     rac BINH THUONG (va chinh la trieu chung cua nguyen nhan #4: form Sua phieu truoc v9.03 khong hien
     anh dang luu nen nguoi dung tai lai). Nen bang duoi day moi la cau tra loi.
     Doc vw_TonTheoMau de co CA mau chi ton tai tren phieu nhap (chua co dong TheKhoChiTietMau).
     ================================================================================================ */
  const thieu = (await pool.request().query(`
    SELECT h.MaHang, ms.TenMau, t.MaHangID, t.MauSacID, t.ChiTietID, t.TonCai
    FROM vw_TonTheoMau t
    JOIN TheKhoHangHoa h ON h.MaHangID = t.MaHangID
    LEFT JOIN MauSac ms ON ms.MauSacID = t.MauSacID
    WHERE ISNULL(t.LinkAnh, N'') = N''
    ORDER BY h.MaHang, ms.TenMau`)).recordset;
  console.log(`\n=== DONG MAU DANG THIEU ANH: ${thieu.length} ===`);
  if (!thieu.length) {
    console.log('  Khong co dong nao thieu anh. Cac file mo coi chi la ban tai len CU (tai lai nhieu lan),');
    console.log('  khong phai anh bi mat — v9.03 da chan nguyen nhan sinh ra chung.');
  } else {
    const theoMa = new Map();
    thieu.forEach(t => {
      if (!theoMa.has(t.MaHang)) theoMa.set(t.MaHang, []);
      theoMa.get(t.MaHang).push((t.TenMau || '?') + (t.ChiTietID == null ? ' (chua co dong the kho)' : ''));
    });
    const ds = [...theoMa.entries()];
    ds.slice(0, 40).forEach(([ma, c]) => console.log(`  ${ma}: ${c.join(', ')}`));
    if (ds.length > 40) console.log(`  ... va ${ds.length - 40} ma nua (them --chitiet de xem het)`);
    if (process.argv.includes('--chitiet')) ds.slice(40).forEach(([ma, c]) => console.log(`  ${ma}: ${c.join(', ')}`));
  }

  /* Chi tiet tung file mo coi: RAT DAI (ca tram dong) nen chi in khi go --chitiet. */
  if (process.argv.includes('--chitiet')) {
    console.log('\n--- CHI TIET TUNG FILE MO COI ---');
    dong.forEach(d => console.log(
      `  ${d.file}\n      ${d.loai} · ma hang: ${d.maHangThat || d.maHang || '?'}`
      + (d.loai === 'anh mau' ? ` · mau: ${d.tenMau || (d.mauSacId ? '#' + d.mauSacId : (d.duoiTen ? '"' + d.duoiTen + '"' : '?'))}` : '')
      + (d.ngay ? ` · tai len: ${d.ngay}` : '') + (d.ghiChu ? `\n      ⚠️ ${d.ghiChu}` : '')));
  } else {
    console.log('\n(Bo qua danh sach chi tiet tung file — them --chitiet neu muon xem)');
  }

  /* ---------- 4. Dong nao con TRONG anh de gan vao ---------- */
  const se = [];
  for (const d of ganDuoc) {
    const r = (await pool.request().input('mh', sql.Int, d.maHangID).input('ms', sql.Int, Number(d.mauSacId))
      .query('SELECT LinkAnh FROM TheKhoChiTietMau WHERE MaHangID=@mh AND MauSacID=@ms')).recordset[0];
    if (r && r.LinkAnh) { d.ghiChu = 'dong mau DA CO anh khac -> khong de len'; continue; }
    /* Chua co dong the kho: VAN gan duoc — tao dong voi SoCat/Nhap/Xuat = 0 (giong damBaoDongMau,
       khong tao ton). Chi lam khi mau do THAT SU thuoc ma hang nay (co trong vw_TonTheoMau). */
    d.taoDongMoi = !r;
    if (!r && !(mauCuaMa.get(d.maHangID) || new Set()).has(Number(d.mauSacId))) {
      d.ghiChu = 'mau nay khong thuoc ma hang do (khong co trong vw_TonTheoMau) -> khong gan';
      continue;
    }
    se.push(d);
  }
  const seDD = [];
  for (const d of ganDuocDD) {
    const r = (await pool.request().input('mh', sql.Int, d.maHangID)
      .query('SELECT AnhDaiDien FROM TheKhoHangHoa WHERE MaHangID=@mh')).recordset[0];
    if (r && !r.AnhDaiDien) seDD.push(d);
  }
  /* Mot ma/mau co the co NHIEU file mo coi (tai len nhieu lan) -> lay file MOI NHAT. */
  const giuMoiNhat = (ds, khoa) => {
    const m = new Map();
    ds.forEach(d => { const k = khoa(d); if (!m.has(k) || d.moc > m.get(k).moc) m.set(k, d); });
    return [...m.values()];
  };
  const seGan = giuMoiNhat(se, d => d.maHangID + '|' + d.mauSacId);
  const seGanDD = giuMoiNhat(seDD, d => String(d.maHangID));

  console.log(`\n=== CO THE GAN LAI: ${seGan.length} anh mau, ${seGanDD.length} anh dai dien ===`);
  seGan.forEach(d => console.log(`  ${d.maHangThat} · ${d.tenMau}${d.taoDongMoi ? ' (se TAO dong the kho moi)' : ''}  <-  ${d.file}`));
  seGanDD.forEach(d => console.log(`  ${d.maHangThat} (anh dai dien)  <-  ${d.file}`));
  /* Nhung dong thieu anh ma KHONG co file mo coi nao khop -> phai tai len lai bang tay. */
  const daCoNguon = new Set(seGan.map(d => d.maHangID + '|' + d.mauSacId));
  const phaiTaiTay = thieu.filter(t => !daCoNguon.has(t.MaHangID + '|' + t.MauSacID));
  if (phaiTaiTay.length) {
    console.log(`\n=== PHAI TAI LEN LAI BANG TAY: ${phaiTaiTay.length} dong (khong co file mo coi nao khop) ===`);
    const g = new Map();
    phaiTaiTay.forEach(t => { if (!g.has(t.MaHang)) g.set(t.MaHang, []); g.get(t.MaHang).push(t.TenMau || '?'); });
    [...g.entries()].slice(0, 40).forEach(([ma, ds]) => console.log(`  ${ma}: ${ds.join(', ')}`));
    if (g.size > 40) console.log(`  ... va ${g.size - 40} ma nua`);
  }

  if (!GAN_LAI) {
    console.log('\n🔴 DANG O CHE DO CHI DOC — chua ghi gi vao CSDL.');
    console.log('   Doi chieu xong, chay lai voi:  node backend\\utils\\tim_anh_mo_coi.js --ganlai');
    console.log('   (chi ghi vao dong dang TRONG anh; khong bao gio de len anh da co)');
    process.exit(0);
  }

  let n1 = 0, n2 = 0;
  for (const d of seGan) {
    const rq = pool.request().input('mh', sql.Int, d.maHangID).input('ms', sql.Int, Number(d.mauSacId))
      .input('a', sql.NVarChar(500), '/uploads/' + d.file);
    /* Dong chua co -> INSERT voi SoCat/Nhap/Xuat = 0 (ton van den tu phieu, xem utils/theKhoMau.js).
       Dong da co -> chi ghi khi dang TRONG anh. Ca hai deu khong bao gio de len anh dang co. */
    await rq.query(`
      IF NOT EXISTS (SELECT 1 FROM TheKhoChiTietMau WHERE MaHangID=@mh AND MauSacID=@ms)
        INSERT INTO TheKhoChiTietMau (MaHangID, MauSacID, LinkAnh, SoCatCai, NhapCai, XuatCai, GhiChu)
        VALUES (@mh, @ms, @a, 0, 0, 0, NULL);
      ELSE
        UPDATE TheKhoChiTietMau SET LinkAnh=@a
         WHERE MaHangID=@mh AND MauSacID=@ms AND ISNULL(LinkAnh, N'') = N'';`);
    n1++;
  }
  for (const d of seGanDD) {
    await pool.request().input('mh', sql.Int, d.maHangID)
      .input('a', sql.NVarChar(500), '/uploads/' + d.file)
      .query('UPDATE TheKhoHangHoa SET AnhDaiDien=@a WHERE MaHangID=@mh AND (AnhDaiDien IS NULL OR AnhDaiDien = N\'\')');
    n2++;
  }
  console.log(`\n✅ Da gan ${n1} anh mau + ${n2} anh dai dien. Ctrl+F5 o The kho hang hoa / catalogue de xem.`);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
