/* ================================================================================================
   GOP TEN KHACH HANG BI VIET LECH NHAU   (v6.63)
   ------------------------------------------------------------------------------------------------
   Truoc day o Don khach dat hang, ten khach GO TU DO -> cung mot khach bi go thanh nhieu kieu
   ("Cty An Binh", "cty an binh", "An Bình", "An Binh "...). Cong no khach hang nhom theo TEN
   (routes/congno.js: congNoKhachHang) nen mot khach bi tach thanh nhieu dong no rieng.

   Lenh nay doi ten o TAT CA nhung noi cong no doc toi, khong chi rieng don dat hang:
     - DonKhachDatHang.TenKhach
     - PhieuBanHang.TenKhach
     - PhieuThu.TenDoiTuong        (chi dong LoaiDoiTuong = 'KhachHang')
     - CongNoDieuChinh.TenDoiTuong (chi dong LoaiDoiTuong = 'KhachHang')
   Bo sot mot bang la cong no lech ngay: doi ten don hang ma khong doi ten phieu thu thi phan da thu
   nam lai o ten cu.

   CACH DUNG (trong thu muc backend):
     1) XEM CO NHUNG TEN NAO, may don, nhom nao NGHI LA MOT
        node utils/gop_ten_khach.js --liet-ke

     2) GOP (chay thu truoc, khong ghi gi)
        node utils/gop_ten_khach.js --tu="cty an binh|An Bình|An Binh" --thanh="Công ty An Bình"
        node utils/gop_ten_khach.js --tu="..." --thanh="..." --ghi      <- ghi that

     3) GOP TU DONG theo nhom gan giong (bo dau, bo khoang trang, khong phan biet hoa/thuong).
        Ten DAI DIEN = ten xuat hien NHIEU DON NHAT trong nhom.
        node utils/gop_ten_khach.js --tu-dong
        node utils/gop_ten_khach.js --tu-dong --ghi

   AN TOAN:
     - Mac dinh CHAY THU, phai them --ghi moi ghi.
     - Truoc khi ghi luon luu file JSON trong backend/backup/ (ten cu -> ten moi + so dong tung bang).
     - Ghi trong 1 transaction: hong giua chung thi khong doi gi ca.
   !! LUU Y: doi ten la KHONG QUAY LAI DUOC bang lenh nay (ten cu da bien mat). File sao luu la
      duong lui duy nhat - dung xoa.
   ================================================================================================ */
const { sql, getPool } = require('../db');

const argv = process.argv.slice(2).map(a => (/^-[a-zA-Z]/.test(a) && !a.startsWith('--')) ? '-' + a : a);
const co = (k) => argv.includes(k);
const lay = (k) => {
  const p = argv.find(a => a.startsWith(k + '='));
  return p ? p.slice(k.length + 1) : null;
};
const LIET_KE = co('--liet-ke');
const TU_DONG = co('--tu-dong');
const GHI = co('--ghi');
const TU = lay('--tu');
/* v6.74.5: --tu-file=<duong dan .json> - danh sach nhom gop nam trong file UTF-8.
   Vi sao can: goi lenh co ten tieng Viet tren cmd.exe rat de vo bang ma (file .bat truoc do bao
   "'HIEN' is not recognized..."). Node doc JSON bang UTF-8 that su nen khong dinh van de do,
   va danh sach nam trong file thi sua/them nhom cung de theo doi hon la 12 dong lenh. */
const TU_FILE = lay('--tu-file');
/* v6.74.6: --chuan-hoa  ->  dua MOI ten ve dang NFC (mot ky tu co dau).
   Tieng Viet co HAI cach luu cung mot chu: "ắ" = 1 ky tu U+1EAF (NFC), hoac "a" + dau roi U+0306
   U+0301 (NFD). HAI CHUOI NAY HIEN LEN Y HET NHAU nhung may coi la KHAC NHAU -> danh sach hien 2
   dong trung, cong no tach lam 2. Excel/Word/macOS hay sinh ra NFD khi copy-dan.
   Khong cong cu nao truoc day bat duoc kieu trung nay vi nhin bang mat khong thay gi. */
const CHUAN_HOA = co('--chuan-hoa');
/* v6.74.7: --soi="<ten>"  ->  IN RA MA TUNG KY TU cua moi ban ten gan giong ten do.
   Dung khi man hinh hien 2 dong NHIN GIONG HET NHAU: doan mo la mat thoi gian, cu doc thang ma
   ky tu la biet ngay khac nhau o dau (dau cach thuong vs dau cach cung, ky tu rong, dau roi...). */
const SOI = lay('--soi');
/* v6.74.8: --danh-muc  ->  soi DUNG BANG "KhachHang" (Danh muc khach hang).
   Vi sao phai them: cac che do trước chi quet 4 BANG PHIEU (DonKhachDatHang, PhieuBanHang, PhieuThu,
   CongNoDieuChinh). Bang danh muc KhachHang KHONG he duoc dong toi. Nen neu danh muc co HAI DONG
   cung ten (2 KhachHangID khac nhau), moi o chon khach tren giao dien deu hien 2 dong NHIN GIONG
   HET NHAU - dung hien tuong dang gap - trong khi du lieu phieu hoan toan sach.
   --gop-danh-muc: giu dong CU NHAT, tro moi tham chieu ve no roi xoa dong thua. */
const DANH_MUC = co('--danh-muc');
const GOP_DANH_MUC = co('--gop-danh-muc');
const THANH = lay('--thanh');

// Khoa gom nhom: bo dau tieng Viet, bo moi ky tu khong phai chu/so -> "Cty An Bình" == "cty  an binh"
function khoa(s) {
  const boDau = new RegExp('[\\u0300-\\u036f]', 'g');
  return String(s || '').normalize('NFD').replace(boDau, '')
    .replace(new RegExp('đ', 'g'), 'd').replace(new RegExp('Đ', 'g'), 'D')
    .toLowerCase().replace(/[^a-z0-9]+/g, '');
}

const BANG = [
  { ten: 'DonKhachDatHang', cot: 'TenKhach', dieuKien: '' },
  { ten: 'PhieuBanHang', cot: 'TenKhach', dieuKien: '' },
  { ten: 'PhieuThu', cot: 'TenDoiTuong', dieuKien: " AND LoaiDoiTuong = N'KhachHang'" },
  { ten: 'CongNoDieuChinh', cot: 'TenDoiTuong', dieuKien: " AND LoaiDoiTuong = N'KhachHang'" }
];

async function demTheoTen(pool) {
  // Gom so dong cua TUNG ten o TUNG bang -> biet doi ten se dung toi bao nhieu ban ghi.
  const map = new Map();   // ten goc -> { ten, tong, theoBang: {} }
  for (const b of BANG) {
    const r = await pool.request().query(`
      SELECT LTRIM(RTRIM(${b.cot})) AS Ten, COUNT(*) AS SoDong
      FROM ${b.ten}
      WHERE NULLIF(LTRIM(RTRIM(ISNULL(${b.cot}, ''))), '') IS NOT NULL${b.dieuKien}
      GROUP BY LTRIM(RTRIM(${b.cot}))`);
    r.recordset.forEach(x => {
      if (!map.has(x.Ten)) map.set(x.Ten, { ten: x.Ten, tong: 0, theoBang: {} });
      const g = map.get(x.Ten);
      g.theoBang[b.ten] = x.SoDong;
      g.tong += x.SoDong;
    });
  }
  return [...map.values()].sort((a, b) => b.tong - a.tong);
}

function gomNhom(ds) {
  const nhom = new Map();
  ds.forEach(x => {
    const k = khoa(x.ten);
    if (!k) return;
    if (!nhom.has(k)) nhom.set(k, []);
    nhom.get(k).push(x);
  });
  return [...nhom.values()].filter(g => g.length > 1);
}

/* ================================================================================================
   v6.74.3 - BAT THEM KIEU TRUNG "DAO VE".
   Thuc te du lieu: "NPP Luong - Hung Yen" va "NPP Hung Yen - Luong" la CUNG MOT khach, nhung khoa()
   noi lien chuoi nen ra 2 chuoi khac han -> khong bat duoc. Ma day moi la kieu trung PHO BIEN NHAT
   (nguoi nhap luc ghi "ten - tinh", luc ghi "tinh - ten").
   Cach bat: tach thanh TAP TU, sap xep roi ghep lai -> thu tu tu khong con anh huong.
   VAN KHONG bo dau: "An Binh" va "An Binh" co dau khac nhau la 2 khach that su khac.
   ================================================================================================ */
function khoaTapTu(s) {
  const boDau = new RegExp('[\\u0300-\\u036f]', 'g');
  // Giu dau tieng Viet (chi tach tu), vi bo dau la gop nham 2 khach khac nhau.
  const chuan = String(s || '').normalize('NFC').toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  if (!chuan) return '';
  const tu = chuan.split(' ').filter(Boolean).sort();
  return tu.join(' ');
}

function gomNhomDaoVe(ds, daBat) {
  const nhom = new Map();
  ds.forEach(x => {
    const k = khoaTapTu(x.ten);
    if (!k) return;
    if (!nhom.has(k)) nhom.set(k, []);
    nhom.get(k).push(x);
  });
  // Bo cac nhom da bat o vong truoc (trung y het sau khi bo ky tu) de khong in 2 lan.
  return [...nhom.values()].filter(g => g.length > 1 && !g.every(x => daBat.has(x.ten)));
}

(async () => {
  const pool = await getPool();
  const ds = await demTheoTen(pool);

  if (DANH_MUC || GOP_DANH_MUC) {
    const dsDM = (await pool.request().query(`
      SELECT KhachHangID, TenKhachHang, DiaChi, SDT FROM KhachHang ORDER BY KhachHangID`)).recordset;
    const long = (x) => String(x || '').normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
    const nhomDM = new Map();
    dsDM.forEach(r => {
      const k = long(r.TenKhachHang);
      if (!k) return;
      if (!nhomDM.has(k)) nhomDM.set(k, []);
      nhomDM.get(k).push(r);
    });
    const trung = [...nhomDM.values()].filter(g => g.length > 1);
    console.log(`=== DANH MUC KHACH HANG: ${dsDM.length} dong, ${nhomDM.size} ten khac nhau ===`);
    if (!trung.length) { console.log('Khong co ten nao bi trung trong danh muc.'); process.exit(0); }

    console.log(`!! ${trung.length} TEN BI TRUNG TRONG DANH MUC (moi o chon khach se hien ${trung.length}+ dong giong nhau)`);
    trung.forEach((g, i) => {
      console.log(`  [${i + 1}] "${g[0].TenKhachHang}"  -  ${g.length} dong:`);
      g.forEach(r => console.log(`        ID ${r.KhachHangID}  |  SDT: ${r.SDT || '(trong)'}  |  DC: ${r.DiaChi || '(trong)'}`));
    });

    if (!GOP_DANH_MUC) {
      console.log('');
      console.log('GOP LAI:  node utils/gop_ten_khach.js --gop-danh-muc          (chay thu)');
      console.log('          node utils/gop_ten_khach.js --gop-danh-muc --ghi    (ghi that)');
      process.exit(0);
    }

    /* Tim MOI cot dang tro toi KhachHang.KhachHangID bang sys.foreign_keys, thay vi liet ke tay.
       Liet ke tay la chac chan bo sot khi sau nay co bang moi tro toi (vd PhieuNhapLai vua them o
       v6.66) -> xoa dong thua se loi khoa ngoai, hoac te hon la mat lien ket im lang. */
    const fk = (await pool.request().query(`
      SELECT OBJECT_NAME(fk.parent_object_id) AS Bang, COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS Cot
      FROM sys.foreign_keys fk
      JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
      WHERE fk.referenced_object_id = OBJECT_ID('KhachHang')`)).recordset;
    console.log('');
    console.log(`Cac cot dang tro toi KhachHang: ${fk.map(x => x.Bang + '.' + x.Cot).join(', ') || '(khong co)'}`);

    const viecDM = [];
    trung.forEach(g => {
      const giu = g.slice().sort((a2, b2) => a2.KhachHangID - b2.KhachHangID)[0];   // giu dong CU NHAT
      g.filter(r => r.KhachHangID !== giu.KhachHangID)
       .forEach(r => viecDM.push({ giu: giu.KhachHangID, xoa: r.KhachHangID, ten: giu.TenKhachHang }));
    });
    console.log('');
    viecDM.forEach(v => console.log(`  "${v.ten}": giu ID ${v.giu}, chuyen tham chieu tu ID ${v.xoa} roi xoa ID ${v.xoa}`));
    if (!GHI) {
      console.log('');
      console.log('=> CHAY THU, chua ghi gi. Them --ghi de thuc hien.');
      process.exit(0);
    }

    const fsD = require('fs'), pathD = require('path');
    const dirD = pathD.join(__dirname, '..', 'backup');
    if (!fsD.existsSync(dirD)) fsD.mkdirSync(dirD, { recursive: true });
    const fileD = pathD.join(dirD, `gop_danh_muc_khach_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fsD.writeFileSync(fileD, JSON.stringify({ ngay: new Date().toISOString(), trung, viec: viecDM }, null, 2), 'utf8');
    console.log('Da ghi file sao luu: ' + fileD);

    const tranD = new sql.Transaction(pool);
    await tranD.begin();
    try {
      let doiTC = 0;
      for (const v of viecDM) {
        for (const c2 of fk) {
          const r = await new sql.Request(tranD).input('giu', sql.Int, v.giu).input('xoa', sql.Int, v.xoa)
            .query(`UPDATE [${c2.Bang}] SET [${c2.Cot}] = @giu WHERE [${c2.Cot}] = @xoa`);
          doiTC += r.rowsAffected[0] || 0;
        }
        await new sql.Request(tranD).input('xoa', sql.Int, v.xoa)
          .query('DELETE FROM KhachHang WHERE KhachHangID = @xoa');
      }
      await tranD.commit();
      console.log(`XONG. Da chuyen ${doiTC} tham chieu va xoa ${viecDM.length} dong danh muc thua.`);
    } catch (e) {
      await tranD.rollback();
      console.error('LOI - da hoan tac, khong doi gi ca:', e.message);
      process.exit(1);
    }
    process.exit(0);
  }

  if (SOI) {
    /* So long: bo dau cach hai dau + gom dau cach + khong phan biet hoa thuong + NFC.
       Long de VET DUOC ca nhung ban khac nhau o ky tu vo hinh. */
    const long = (x) => String(x || '').normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
    const dich = long(SOI);
    const khop = ds.filter(x => long(x.ten) === dich);
    if (!khop.length) {
      console.log(`Khong tim thay ten nao giong "${SOI}".`);
      console.log('Go dung mot phan ten cung duoc, vd: --soi="NPP Bac Ninh - C Dung"');
      process.exit(0);
    }
    console.log(`=== ${khop.length} BAN TEN KHOP "${SOI}" ===`);
    if (khop.length === 1) console.log('(chi co 1 ban - trong CSDL khong bi trung ten nay)');
    khop.forEach((x, i) => {
      const t = String(x.ten);
      console.log('');
      console.log(`[${i + 1}] "${t}"   -   ${t.length} ky tu, ${x.tong} dong`);
      console.log(`    ${BANG.map(b => `${b.ten}:${x.theoBang[b.ten] || 0}`).join('  ')}`);
      // In ma tung ky tu; danh dau ro nhung ky tu KHONG PHAI chu/so/dau cach thuong.
      const ma = [...t].map(c => {
        const cp = c.codePointAt(0);
        const hex = 'U+' + cp.toString(16).toUpperCase().padStart(4, '0');
        const la = c === ' ' ? '[dau cach]' : (cp < 32 || cp === 0xA0 || cp === 0x200B || cp === 0xFEFF ? `[!! ${hex}]` : c);
        return cp === 32 || (cp > 32 && cp !== 0xA0 && cp !== 0x200B && cp !== 0xFEFF) ? la : `[!! ${hex}]`;
      });
      console.log('    ' + ma.join(' '));
    });
    if (khop.length > 1) {
      // Chi ra vi tri ky tu dau tien khac nhau giua ban 1 va cac ban con lai.
      const g = String(khop[0].ten);
      khop.slice(1).forEach((x, i) => {
        const t = String(x.ten);
        let v = 0;
        while (v < g.length && v < t.length && g[v] === t[v]) v++;
        console.log('');
        console.log(`Ban [1] va ban [${i + 2}] khac nhau tu KY TU THU ${v + 1}:`);
        console.log(`   [1] ${v < g.length ? 'U+' + g.codePointAt(v).toString(16).toUpperCase().padStart(4, '0') : '(het chuoi)'}`);
        console.log(`   [${i + 2}] ${v < t.length ? 'U+' + t.codePointAt(v).toString(16).toUpperCase().padStart(4, '0') : '(het chuoi)'}`);
      });
      console.log('');
      console.log('GOP LAM MOT (chon ban muon giu lam --thanh):');
      console.log(`   node utils/gop_ten_khach.js --tu="${khop.map(x => x.ten).join('|')}" --thanh="${khop[0].ten}"`);
    }
    process.exit(0);
  }

  if (LIET_KE || (!TU && !TU_DONG && !TU_FILE && !CHUAN_HOA && !SOI && !DANH_MUC && !GOP_DANH_MUC)) {
    console.log('=== TEN KHACH DANG CO (theo tong so dong o 4 bang) ===');
    ds.forEach(x => {
      const chiTiet = BANG.map(b => `${b.ten}:${x.theoBang[b.ten] || 0}`).join('  ');
      console.log(`  ${String(x.tong).padStart(5)}  ${x.ten}`);
      console.log(`         ${chiTiet}`);
    });
    const nhom = gomNhom(ds);
    console.log('');
    if (!nhom.length) {
      console.log('Khong thay nhom ten nao NGHI LA MOT (sau khi bo dau + bo khoang trang).');
    } else {
      console.log(`=== ${nhom.length} NHOM NGHI LA CUNG MOT KHACH ===`);
      nhom.forEach((g, i) => {
        const dai = g.slice().sort((a, b) => b.tong - a.tong)[0];
        console.log(`  [${i + 1}] dai dien: "${dai.ten}"  (${dai.tong} dong)`);
        g.forEach(x => console.log(`        - "${x.ten}"  ${x.tong} dong`));
        console.log(`      => node utils/gop_ten_khach.js --tu="${g.map(x => x.ten).join('|')}" --thanh="${dai.ten}"`);
      });
      console.log('');
      console.log('Gop het cac nhom tren trong 1 lan:  node utils/gop_ten_khach.js --tu-dong');
    }

    /* --- Trung UNICODE: nhin y het nhau nhung khac cach luu dau (NFC/NFD) --- */
    const theoNFC = new Map();
    ds.forEach(x => {
      const k = String(x.ten).normalize('NFC');
      if (!theoNFC.has(k)) theoNFC.set(k, []);
      theoNFC.get(k).push(x);
    });
    const trungNFC = [...theoNFC.values()].filter(g => g.length > 1);
    if (trungNFC.length) {
      console.log('');
      console.log(`!! ${trungNFC.length} TEN BI TRUNG DO CACH LUU DAU TIENG VIET (NFC/NFD) !!`);
      console.log('   Cac ten duoi day HIEN LEN Y HET NHAU tren man hinh nhung may coi la khac nhau,');
      console.log('   nen danh sach ra 2 dong va cong no bi tach doi. Nhin bang mat KHONG the phat hien.');
      trungNFC.forEach(g => {
        console.log(`   - "${String(g[0].ten).normalize('NFC')}"  (${g.length} ban, ${g.reduce((s2, x) => s2 + x.tong, 0)} dong)`);
        g.forEach(x => console.log(`        do dai ${String(x.ten).length} ky tu, ${x.tong} dong`));
      });
      console.log('');
      console.log('   SUA:  node utils/gop_ten_khach.js --chuan-hoa          (chay thu)');
      console.log('         node utils/gop_ten_khach.js --chuan-hoa --ghi    (ghi that)');
    }

    /* --- Nhom DAO VE: cung tap tu, khac thu tu --- */
    const daBat = new Set();
    nhom.forEach(g => g.forEach(x => daBat.add(x.ten)));
    const nhomDao = gomNhomDaoVe(ds, daBat);
    console.log('');
    if (!nhomDao.length) {
      console.log('Khong thay nhom nao DAO VE (cung tap tu, khac thu tu).');
    } else {
      console.log(`=== ${nhomDao.length} NHOM DAO VE (cung nhung tu do, chi khac thu tu) ===`);
      console.log('Vi du: "NPP Luong - Hung Yen"  vs  "NPP Hung Yen - Luong".');
      nhomDao.forEach((g, i) => {
        const dai = g.slice().sort((a, b) => b.tong - a.tong)[0];
        console.log(`  [${i + 1}] dai dien: "${dai.ten}"  (${dai.tong} dong)`);
        g.forEach(x => console.log(`        - "${x.ten}"  ${x.tong} dong`));
        console.log(`      => node utils/gop_ten_khach.js --tu="${g.map(x => x.ten).join('|')}" --thanh="${dai.ten}"`);
      });
      console.log('');
      console.log('!! DOC KY tung nhom truoc khi gop - cung tap tu VAN CO THE la 2 khach khac nhau.');
      console.log('   Gop het cac nhom DAO VE trong 1 lan:  node utils/gop_ten_khach.js --tu-dong --dao-ve');
    }
    process.exit(0);
  }

  // --- Dung danh sach viec can doi ---
  let viec = [];   // { tuTen, thanhTen }
  if (TU_DONG) {
    const nhomChinh = gomNhom(ds);
    // --dao-ve: gop CA nhom dao ve. Mac dinh KHONG bat, vi dao ve rui ro hon - phai co y.
    const themDao = co('--dao-ve');
    if (themDao) {
      const daBat = new Set();
      nhomChinh.forEach(g => g.forEach(x => daBat.add(x.ten)));
      gomNhomDaoVe(ds, daBat).forEach(g => nhomChinh.push(g));
    }
    nhomChinh.forEach(g => {
      const dai = g.slice().sort((a, b) => b.tong - a.tong)[0];
      g.forEach(x => { if (x.ten !== dai.ten) viec.push({ tuTen: x.ten, thanhTen: dai.ten }); });
    });
  } else if (CHUAN_HOA) {
    /* Doi MOI ten dang o dang NFD ve NFC. Ten da o NFC thi bo qua (khong ghi thua).
       Sau buoc nay, cac ban "nhin giong nhau" se tro thanh CUNG MOT chuoi -> tu gop lam mot. */
    ds.forEach(x => {
      const nfc = String(x.ten).normalize('NFC');
      if (nfc !== String(x.ten)) {
        viec.push({ tuTen: String(x.ten).trim(), thanhTen: nfc.trim(), thoTu: x.ten, thoThanh: nfc, unicode: true });
      }
    });
    if (!viec.length) console.log('Moi ten deu da o dang NFC - khong co gi phai chuan hoa.');
  } else if (TU_FILE) {
    const fsJ = require('fs'), pathJ = require('path');
    const duong = pathJ.isAbsolute(TU_FILE) ? TU_FILE : pathJ.join(process.cwd(), TU_FILE);
    let cauHinh;
    try {
      cauHinh = JSON.parse(fsJ.readFileSync(duong, 'utf8'));
    } catch (e) {
      console.error('Khong doc duoc file danh sach: ' + duong);
      console.error('  ' + e.message);
      process.exit(1);
    }
    const dsNhom = Array.isArray(cauHinh) ? cauHinh : (cauHinh.nhom || []);
    if (!dsNhom.length) { console.error('File khong co nhom nao (khoa "nhom").'); process.exit(1); }
    console.log(`Doc ${dsNhom.length} nhom tu: ${duong}`);
    dsNhom.forEach((n, i) => {
      const thanh = String(n.thanh || '').trim();
      const tu = Array.isArray(n.tu) ? n.tu : [];
      if (!thanh || !tu.length) { console.log(`  (bo qua) nhom #${i + 1} thieu "tu" hoac "thanh"`); return; }
      tu.forEach(t => {
        if (String(t) === String(n.thanh)) return;      // giong het ca dau cach -> khong co gi de doi
        viec.push({ tuTen: String(t).trim(), thanhTen: thanh, thoTu: String(t), thoThanh: String(n.thanh) });
      });
    });
  } else {
    if (!THANH || !String(THANH).trim()) {
      console.error('Thieu --thanh="Ten chuan". Xem huong dan o dau file.');
      process.exit(1);
    }
    /* v6.74.4 - SO SANH TREN CHUOI THO, KHONG PHAI CHUOI DA CAT KHOANG TRANG.
       Ban cu: `.map(s => s.trim())` roi so `t !== THANH.trim()`. Hai ve deu bi cat nen
           --tu=" NPP Ha Tay - C Huong Chuong My"  --thanh="NPP Ha Tay - C Huong Chuong My"
       bi coi la GIONG NHAU -> "Khong co ten nao can doi" -> KHONG CHUAN HOA DUOC KHOANG TRANG THUA.
       Nay so chuoi tho: chi khac dau cach cung van tao viec. Cau UPDATE van khop theo ten DA CAT
       (LTRIM/RTRIM) nen no gom HET moi bien the khoang trang ve dung ten chuan mot lan.
       Muon don rieng khoang trang thua thi go --tu va --thanh CUNG MOT TEN, khac moi dau cach. */
    const dsTu = String(TU).split('|').filter(x => String(x).trim());
    const thanhTho = String(THANH);
    dsTu.forEach(t => {
      if (t === thanhTho) return;                       // giong y het ca dau cach -> khong co gi de lam
      viec.push({ tuTen: String(t).trim(), thanhTen: thanhTho.trim(), thoTu: t, thoThanh: thanhTho });
    });
    if (!viec.length && dsTu.length) {
      console.log('Ten trong --tu va --thanh GIONG HET NHAU (ke ca dau cach) nen khong co gi de doi.');
      console.log('Neu dinh don khoang trang thua, hay go --tu co dau cach va --thanh khong co, vi du:');
      console.log('   --tu=" Ten khach"  --thanh="Ten khach"');
    }
  }

  if (!viec.length) { console.log('Khong co ten nao can doi.'); process.exit(0); }

  console.log(`=== ${viec.length} TEN SE DOI ===`);
  const banDau = [];
  for (const v of viec) {
    const g = ds.find(x => x.ten === v.tuTen);
    if (!g) { console.log(`  (bo qua) "${v.tuTen}" - khong tim thay ten nay trong du lieu`); continue; }
    const chiDauCach = v.thoTu !== undefined && String(v.thoTu).trim() === String(v.thoThanh).trim();
    console.log(`  "${v.tuTen}"  ->  "${v.thanhTen}"   (${g.tong} dong: ${BANG.map(b => `${b.ten}:${g.theoBang[b.ten] || 0}`).join(', ')})`
      + (chiDauCach ? '   [chi don khoang trang thua]' : ''));
    banDau.push({ ...v, theoBang: g.theoBang, tong: g.tong });
  }
  if (!banDau.length) { console.log('Khong co gi de doi.'); process.exit(0); }

  console.log('');
  console.log(`Tong cong ${banDau.reduce((s, x) => s + x.tong, 0)} dong se doi ten.`);
  if (!GHI) {
    console.log('');
    console.log('=> CHAY THU, chua ghi gi. Them --ghi de thuc hien.');
    console.log('   Kiem lai danh sach tren cho ky: doi ten la KHONG QUAY LAI DUOC bang lenh nay.');
    process.exit(0);
  }

  const fs = require('fs'), path = require('path');
  const dir = path.join(__dirname, '..', 'backup');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `gop_ten_khach_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(file, JSON.stringify({ ngay: new Date().toISOString(), doi: banDau }, null, 2), 'utf8');
  console.log('Da ghi file sao luu: ' + file);

  // 1 transaction cho TAT CA: hong giua chung thi khong doi gi ca, tranh canh nua bang ten moi
  // nua bang ten cu (luc do cong no con lech hon truoc khi chay).
  const tran = new sql.Transaction(pool);
  await tran.begin();
  try {
    let tongDong = 0;
    for (const v of banDau) {
      for (const b of BANG) {
        /* Voi --chuan-hoa phai khop DUNG chuoi goc (dang NFD): dung ten da chuan hoa thi SQL
           khong tim thay dong nao, lenh chay xong bao 0 dong ma nguoi dung tuong da sua. */
        const r = await new sql.Request(tran)
          .input('cu', sql.NVarChar, v.unicode ? String(v.thoTu).trim() : v.tuTen)
          .input('moi', sql.NVarChar, v.thanhTen)
          .query(`UPDATE ${b.ten} SET ${b.cot} = @moi
                  WHERE LTRIM(RTRIM(${b.cot})) = @cu${b.dieuKien}`);
        tongDong += r.rowsAffected[0] || 0;
      }
    }
    await tran.commit();
    console.log(`XONG. Da doi ${tongDong} dong.`);
    console.log('Mo lai man Cong no khach hang de kiem tra cac dong da gop dung chua.');
  } catch (e) {
    await tran.rollback();
    console.error('LOI - da hoan tac, khong doi gi ca:', e.message);
    process.exit(1);
  }
  process.exit(0);
})().catch(e => { console.error('LOI:', e.message); process.exit(1); });
