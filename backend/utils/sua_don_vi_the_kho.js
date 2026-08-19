/* ================================================================================================
   SUA DON VI CHINH CUA THE KHO HANG HOA  (v6.23.1)
   ------------------------------------------------------------------------------------------------
   VAN DE: The kho luu Nhap/Xuat/Ton theo DON VI CHINH cua ma hang (TheKhoHangHoa.DonViCoBan).
   Neu DonViCoBan khai la "Ri" nhung so lieu thuc te dang la SO CAI (hoac nguoc lai) thi:
     - cot "Ton quy ra Cai" bi NHAN them LoaiRi lan (nhin thay so gap 5, 10... lan thuc te)
     - don khach dat / phieu ban hang quy doi sai theo
   Co 2 cach chua, chon dung cach:

   A) SO LIEU TRONG CSDL DA DUNG, chi khai SAI don vi  ->  chi doi nhan don vi, GIU NGUYEN so lieu:
        node utils/sua_don_vi_the_kho.js --ma=ABC123 --den=Cái
        node utils/sua_don_vi_the_kho.js --ma=ABC123 --den=Cái --ghi

   B) DOI don vi VA quy doi lai TOAN BO so lieu (dang 100 Cai, chuyen sang quan theo Ri = 20 Ri):
        node utils/sua_don_vi_the_kho.js --ma=ABC123 --den=Ri --quy-doi --ghi
      (Ri -> Cai: NHAN LoaiRi;  Cai -> Ri: CHIA LoaiRi. Chia khong het se BAO LOI, khong ghi.)

   C) CHI 1 COT bi sai don vi - HAY GAP NHAT: kho quan theo RI, Nhap da dung theo Ri, nhung cot XUAT
      lai dang la SO CAI (do cac don khach dat cu ghi don vi Cai) => ton bi AM:
        node utils/sua_don_vi_the_kho.js --ma=ABC123 --cot=xuat --chia            (chay thu)
        node utils/sua_don_vi_the_kho.js --ma=ABC123 --cot=xuat --chia --ghi
      Doi ca nhan don vi lan quy doi 1 cot trong 1 lan (vd tra lai nhan Ri + chia cot Xuat):
        node utils/sua_don_vi_the_kho.js --ma=ABC123 --den=Ri --cot=xuat --chia --ghi
      --cot = nhap | xuat | socat | tatca ;  --chia = so dang CAI dua ve RI ;  --nhan = nguoc lai.
      Cuoi ban chay thu co dong TONG bao ro con AM hay khong -> biet ngay quy doi dung huong chua.

   ---- KHI NAO PHAI DE DON VI CHINH = CAI ? (quan trong) ----
   Ton kho luu SO NGUYEN theo don vi chinh. Ma quan theo RI thi KHONG ban le vai cai duoc:
        1 Cai = 0,17 Ri -> lam tron 0  => ban ma kho khong giam
        7 Cai = 1,17 Ri -> lam tron 1  => tru thieu 1 cai (sai am tham)
   => Ma nao CO BAN LE THEO CAI thi don vi chinh phai la CAI. Van xem duoc theo ri: man hinh co san cot
      "Ton quy ra Ri" (vd 23 Ri6 du 2 Cai). Chuyen sang quan theo Cai KHONG mat thong tin gi:
        node utils/sua_don_vi_the_kho.js --ma=ABC123 --den=Cai --quy-doi          (chay thu, nhan he so)
        node utils/sua_don_vi_the_kho.js --ma=ABC123 --den=Cai --quy-doi --ghi
      (Don khach dat / phieu ban hang cu ghi "Ri" van quy doi dung, khong phai sua tay.)

   F) SUA HANG LOAT khi HAU HET ma deu bi "nhan da doi, so lieu chua doi"  (v6.39):
      HAY GAP: chi cot XUAT lech (Nhap da dung) -> CHI nhan cot xuat, dung nhan ca 3:
        node utils/sua_don_vi_the_kho.js --nhan-tat-ca --cot=xuat            (chay thu)
        node utils/sua_don_vi_the_kho.js --nhan-tat-ca --cot=xuat --ghi
      Lech ca 3 cot:
        node utils/sua_don_vi_the_kho.js --nhan-tat-ca                 (chay thu - xem truoc TUNG ma)
        node utils/sua_don_vi_the_kho.js --nhan-tat-ca --ghi
        node utils/sua_don_vi_the_kho.js --nhan-tat-ca --cot=xuat --tru=MA1,MA2 --ghi    (bo qua ma da dung)
      Chon: MOI ma co LoaiRi > 1 va DVT chinh KHAC DVT quy doi (tuc dang mang nhan don vi GOC).
      Viec lam: NHAN ca 3 cot (So cat / Nhap / Xuat) voi LoaiRi. Nhan nen KHONG BAO GIO chia le.
      DVT chinh GIU NGUYEN (chi sua so lieu cho khop cai nhan da doi truoc do).

   E) SO LIEU CON LA "RI" TRONG KHI NHAN DA LA "Cái"/"Bộ"  (v6.36) - hay gap nhat:
      Doi o "Don vi tinh chinh" NGAY TREN FORM The kho chi doi CAI NHAN, KHONG nhan so lieu.
      Ket qua: ma co LoaiRi = 6, nhap 45 ri (= 270 bo) nhung kho van luu 45 va nhan ghi "Bộ"
      -> man hinh doc thanh "45 Bộ = 7 Ri6 du 3". Xuat/ton sai theo.
        node utils/sua_don_vi_the_kho.js --soat-ri-con-sot            (liet ke cac ma nghi bi)
        node utils/sua_don_vi_the_kho.js --ma=BD26C042 --cot=tatca --nhan          (chay thu 1 ma)
        node utils/sua_don_vi_the_kho.js --ma=BD26C042 --cot=tatca --nhan --ghi
      (--nhan = so dang la RI, nhan he so de dua ve don vi chinh; KHONG dung --den nen nhan giu nguyen.)

   D) CHUYEN HET ma dang quan theo RI sang CAI (v6.26) - 1 lenh cho toan bo kho:
        node utils/sua_don_vi_the_kho.js --tat-ca-ri            (chay thu, xem truoc tung ma)
        node utils/sua_don_vi_the_kho.js --tat-ca-ri --ghi
      Tu dong chon dung cach cho tung ma:
        LoaiRi > 1  -> doi nhan + NHAN so lieu voi LoaiRi (Ri -> Cai)
        LoaiRi <= 1 -> chi doi nhan (1 Ri = 1 Cai nen so lieu khong doi)
      KHONG BAO GIO chia le vi Ri -> Cai luon la phep NHAN.
      Sau khi chay: het loi lam tron khi ban le vai cai, va het canh bao lech don vi o phan he Bao cao.

   Xem truoc khong doi gi:
        node utils/sua_don_vi_the_kho.js --liet-ke            (moi ma + don vi + so lieu)
        node utils/sua_don_vi_the_kho.js --liet-ke --nghi-ngo (chi cac ma NGHI khai sai don vi)

   Luon: chay thu truoc (khong co --ghi), co backup JSON trong backend/backup/, 1 transaction duy nhat.
   ================================================================================================ */
const fs = require('fs');
const path = require('path');
const { sql, getPool } = require('../db');

/* Tach tham so bi DINH LIEN nhau do quen dau cach, vd:
     --ma=QD26C0091--den=Cái   ->   --ma=QD26C0091   --den=Cái
   (loi rat de mac khi go tay tren CMD; truoc day chi bao "Thieu tham so" rat kho hieu) */
const args = [];
/* Nhan ca tham so 1 GACH (-ghi, -chia...) - go thieu 1 dau gach la loi rat hay gap tren CMD. */
process.argv.slice(2).map(a => (/^-[a-zA-Z]/.test(a) && !a.startsWith('--')) ? '-' + a : a).forEach(a => {
  const m = /^(--[a-zA-Z-]+=)(.*)$/.exec(a);
  if (m && m[2].indexOf('--') > 0) {
    const i = m[2].indexOf('--');
    args.push(m[1] + m[2].slice(0, i));
    args.push(m[2].slice(i));
    console.log(`(Da tach tham so dinh lien nhau: "${a}"  ->  "${m[1] + m[2].slice(0, i)}"  +  "${m[2].slice(i)}")`);
  } else args.push(a);
});
const co = t => args.includes(t);
const lay = t => (args.find(a => a.startsWith(t + '=')) || '').split('=').slice(1).join('=') || null;

const GHI = co('--ghi');
const LIET_KE = co('--liet-ke');
const NGHI_NGO = co('--nghi-ngo');
const TAT_CA_RI = co('--tat-ca-ri');   // v6.26: chuyen HET ma dang quan theo Ri sang Cai
const SOAT_SOT = co('--soat-ri-con-sot');   // v6.36: tim ma DA doi nhan sang Cai/Bo nhung SO LIEU van la Ri
const NHAN_TAT_CA = co('--nhan-tat-ca');    // v6.39: NHAN he so cho TAT CA ma dang mang nhan Cai/Bo
const TRU = lay('--tru');                   // v6.39: bo qua cac ma nay (da dung san), vd --tru=A,B,C
const QUY_DOI = co('--quy-doi');
const MA = lay('--ma');
const DEN_RAW = lay('--den');
// v6.23.2: quy doi RIENG 1 COT (hay gap: Nhap dung theo Ri nhung Xuat lai dang la so Cai)
const COT = lay('--cot');
const CHIA = co('--chia');   // so dang la CAI -> dua ve RI  (chia he so)
const NHAN = co('--nhan');   // so dang la RI  -> dua ve CAI  (nhan he so)
const TEN_COT = { NhapCai: 'Nhap', XuatCai: 'Xuat', SoCatCai: 'SoCat' };
function chuanCot(v) {
  const s = String(v || '').trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/\s|\?/g, '');
  if (s === 'nhap') return 'nhap';
  if (s === 'xuat') return 'xuat';
  if (s === 'socat' || s === 'cat') return 'socat';
  if (s === 'tatca' || s === 'all') return 'tatca';
  return null;
}

const soDep = n => (Number(n) || 0).toLocaleString('vi-VN');
/* Nhan don vi go kieu gi cung hieu: Cái / cai / CAI / C?i (CMD hay bien dau thanh '?') / c ; Ri / ri / r.
   Bai hoc cu (doi_ma_loai_vai.js): CMD Windows bien ky tu co dau thanh '?' nen phai bo dau khi so sanh. */
function chuanDonVi(v) {
  const s = String(v || '').trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
    .replace(/\?/g, '');            // 'C?i' -> 'ci'
  if (s === 'ri' || s === 'r') return 'Ri';
  if (s === 'cai' || s === 'ci' || s === 'c') return 'Cái';
  return null;
}

(async () => {
  let pool;
  try { pool = await getPool(); }
  catch (err) { console.error('KHONG ket noi duoc CSDL: ' + err.message); process.exit(1); }

  try {
    const rows = (await pool.request().query(`
      SELECT h.MaHangID, h.MaHang, h.TenHang, h.DonViCoBan, h.DonViQuyDoi, h.LoaiRi,
             ISNULL(SUM(ct.NhapCai), 0) AS TongNhap, ISNULL(SUM(ct.XuatCai), 0) AS TongXuat,
             ISNULL(SUM(ct.NhapCai - ct.XuatCai), 0) AS Ton, COUNT(ct.ID) AS SoMau
      FROM TheKhoHangHoa h
      LEFT JOIN TheKhoChiTietMau ct ON ct.MaHangID = h.MaHangID
      GROUP BY h.MaHangID, h.MaHang, h.TenHang, h.DonViCoBan, h.DonViQuyDoi, h.LoaiRi
      ORDER BY h.MaHang`)).recordset;

    /* Don vi ghi tren DON KHACH DAT cua tung ma - dau hieu phu de doan ma nao khai sai don vi chinh. */
    const donVi = (await pool.request().query(`
      SELECT MaHangID, DonVi, COUNT(*) AS SoDon, SUM(SoLuongDat) AS TongSL
      FROM DonKhachDatHang GROUP BY MaHangID, DonVi`)).recordset;

    /* --------- LIET KE --------- */
    if (LIET_KE || (!MA && !DEN_RAW && !TAT_CA_RI && !SOAT_SOT && !NHAN_TAT_CA)) {
      console.log('=== THE KHO HANG HOA: DON VI CHINH & SO LIEU ===');
      console.log('(Nhap/Xuat/Ton duoi day deu theo DON VI CHINH cua chinh ma do)');
      console.log('');
      let dem = 0, demNghi = 0;
      rows.forEach(r => {
        const he = Number(r.LoaiRi) || 1;
        const laRi = chuanDonVi(r.DonViCoBan) === 'Ri';
        const dsDon = donVi.filter(d => d.MaHangID === r.MaHangID);
        const donCai = dsDon.filter(d => chuanDonVi(d.DonVi) === 'Cái').reduce((s, d) => s + d.SoDon, 0);
        const donRi = dsDon.filter(d => chuanDonVi(d.DonVi) === 'Ri').reduce((s, d) => s + d.SoDon, 0);
        /* 2 DAU HIEU nghi khai sai don vi (chi ap dung cho ma khai Ri, he so > 1):
           (1) So lieu kho KHONG chia het cho he so  -> rat co the do la SO CAI bi khai nham la Ri.
           (2) Don khach dat cua chinh ma do phan lon ghi "Cai" -> thuc te dang ban/quan theo Cai. */
        const nghi1 = laRi && he > 1 && ((Number(r.TongNhap) % he !== 0) || (Number(r.TongXuat) % he !== 0));
        const nghi2 = laRi && he > 1 && donCai > 0 && donCai >= donRi;
        /* (3) DON DAT LAN LON DON VI: cung 1 ma hang, don nay ghi "Cai", don kia ghi "Ri".
           Truong hop nay KHONG chia/nhan ca cot duoc - phai nan theo tung chung tu. */
        const nghi3 = donCai > 0 && donRi > 0;
        const nghi = nghi1 || nghi2 || nghi3;
        if (NGHI_NGO && !nghi) return;
        dem++; if (nghi) demNghi++;
        console.log(`${nghi ? '?? ' : '   '}${r.MaHang} - ${r.TenHang}`);
        console.log(`      don vi chinh: ${r.DonViCoBan || '(trong)'} | quy doi: ${r.DonViQuyDoi || '-'} | LoaiRi = ${he} | ${r.SoMau} mau`);
        console.log(`      Nhap ${soDep(r.TongNhap)} | Xuat ${soDep(r.TongXuat)} | Ton ${soDep(r.Ton)}  (${r.DonViCoBan || 'Cái'})`);
        if (laRi && he > 1) console.log(`      -> man hinh dang hien "Ton quy ra Cai" = ${soDep(Number(r.Ton) * he)}`);
        if (dsDon.length) console.log(`      don khach dat: ${donCai} don ghi "Cái", ${donRi} don ghi "Ri"`);
        if (nghi1) console.log(`      >> NGHI (1): so lieu khong chia het cho he so ${he} => co ve dang la SO CAI.`);
        if (nghi2) console.log(`      >> NGHI (2): don khach dat phan lon ghi "Cái" trong khi don vi chinh khai "Ri".`);
        if (nghi3) {
          console.log(`      >> NGHI (3): don dat LAN LON don vi (${donCai} don "Cái" + ${donRi} don "Ri").`);
          console.log(`         => KHONG chia/nhan ca cot duoc. Nan theo chung tu:  node utils/kiem_ton_am.js --ma=${r.MaHang} --nan`);
        }
      });
      console.log('');
      console.log(`Tong: ${dem} ma hang${NGHI_NGO ? ' nghi ngo' : ` (trong do ${demNghi} nghi khai sai don vi)`}.`);
      console.log('Loc nhanh:  node utils/sua_don_vi_the_kho.js --liet-ke --nghi-ngo');
      console.log('Sua 1 hay nhieu ma (so lieu DA DUNG, chi doi nhan):');
      console.log('            node utils/sua_don_vi_the_kho.js --ma=ABC,XYZ --den=Cái --ghi');
      console.log('Sua kem quy doi lai so lieu:');
      console.log('            node utils/sua_don_vi_the_kho.js --ma=ABC --den=Ri --quy-doi --ghi');
      console.log('SUA HANG LOAT khi da doi nhan sang Cai/Bo nhung so lieu van la Ri (v6.39):');
      console.log('            node utils/sua_don_vi_the_kho.js --nhan-tat-ca          (chay thu)');
      console.log('            node utils/sua_don_vi_the_kho.js --nhan-tat-ca --ghi');
      console.log('CHUYEN HET ma dang quan theo Ri sang Cai (1 lenh, v6.26):');
      console.log('            node utils/sua_don_vi_the_kho.js --tat-ca-ri          (chay thu)');
      console.log('            node utils/sua_don_vi_the_kho.js --tat-ca-ri --ghi');
      process.exit(0);
    }

    /* ================================================================================================
       NHAN HE SO CHO TAT CA MA DANG MANG NHAN DON VI GOC   (--nhan-tat-ca, v6.39)
       ------------------------------------------------------------------------------------------------
       Dung khi: da doi "Don vi tinh chinh" tu Ri sang Cai/Bo NGAY TREN FORM (chi doi CAI NHAN),
       nen so lieu trong kho van la so RI. Vi du BD26C042: luu 45 nhung nhan la "Bộ" -> phai thanh 270.
       Ri -> Cai/Bo LUON la phep NHAN nen khong bao gio vuong loi "khong chia het".
       ================================================================================================ */
    if (NHAN_TAT_CA) {
      if (DEN_RAW || QUY_DOI || MA) {
        console.error('--nhan-tat-ca KHONG dung kem --ma / --den / --quy-doi.');
        console.error('Muon bo qua vai ma thi dung  --tru=MA1,MA2 ;  chi sua 1 cot thi dung  --cot=xuat');
        process.exit(1);
      }
      /* v6.39.1: CHON COT. Thuong chi cot XUAT lech (Nhap da dung) — nhan ca 3 cot se hong luon
         cot Nhap dang dung. Mac dinh 'tatca' de giu tuong thich, nhung nen chi ro --cot=xuat. */
      const cotNhan = COT ? chuanCot(COT) : 'tatca';
      if (!cotNhan) {
        console.error(`--cot doc duoc "${COT}" - phai la nhap / xuat / socat / tatca.`);
        process.exit(1);
      }
      const TEN_COT_NHAN = { nhap: 'NHAP', xuat: 'XUAT', socat: 'SO CAT', tatca: 'SO CAT + NHAP + XUAT' }[cotNhan];
      const boQua = new Set(String(TRU || '').split(',').map(x => x.trim().toUpperCase()).filter(Boolean));
      const ds = rows.filter(r => {
        const he = Number(r.LoaiRi) || 1;
        if (he <= 1) return false;                                  // khong co quy doi -> khong lam gi
        const cb = chuanDonVi(r.DonViCoBan) || 'Cái';
        const qd = chuanDonVi(r.DonViQuyDoi) || 'Ri';
        if (cb === qd) return false;                                // dang quan theo don vi GOP -> khong thuoc dien
        if (boQua.has(String(r.MaHang).trim().toUpperCase())) return false;
        return true;
      });
      if (!ds.length) {
        console.log('Khong co ma nao thuoc dien (LoaiRi > 1 va DVT chinh khac DVT quy doi).');
        process.exit(0);
      }
      console.log('=== NHAN HE SO CHO TAT CA MA DANG MANG NHAN DON VI GOC ===');
      console.log('Dieu kien chon: LoaiRi > 1  VA  DVT chinh KHAC DVT quy doi.');
      console.log(`Viec lam: NHAN cot ${TEN_COT_NHAN} voi LoaiRi. DVT chinh GIU NGUYEN.`);
      if (cotNhan === 'tatca') {
        console.log('!! Dang nhan CA 3 COT. Neu chi cot XUAT lech (Nhap da dung) thi phai dung  --cot=xuat');
      }
      if (boQua.size) console.log('Bo qua theo --tru: ' + [...boQua].join(', '));
      console.log('');
      console.log('  ' + 'MA HANG'.padEnd(18) + 'DVT'.padEnd(7) + 'He so'.padStart(6)
        + 'NHAP'.padStart(12) + ' ->' + 'NHAP moi'.padStart(12)
        + 'XUAT'.padStart(11) + ' ->' + 'XUAT moi'.padStart(12)
        + 'TON moi'.padStart(12));
      let tNhap = 0, tXuat = 0;
      const suaNhap = cotNhan === 'tatca' || cotNhan === 'nhap';
      const suaXuat = cotNhan === 'tatca' || cotNhan === 'xuat';
      ds.forEach(r => {
        const he = Number(r.LoaiRi) || 1;
        const n = Number(r.TongNhap) || 0, x = Number(r.TongXuat) || 0;
        const n2 = suaNhap ? n * he : n, x2 = suaXuat ? x * he : x;
        tNhap += n2; tXuat += x2;
        console.log('  ' + String(r.MaHang).padEnd(18) + String(r.DonViCoBan || '').padEnd(7) + String(he).padStart(6)
          + soDep(n).padStart(12) + ' ->' + soDep(n2).padStart(12)
          + soDep(x).padStart(11) + ' ->' + soDep(x2).padStart(12)
          + soDep(n2 - x2).padStart(12)
          + ((n2 - x2) < 0 ? '  <-- AM KHO!' : ''));
      });
      console.log('  ' + '-'.repeat(90));
      console.log(`  ${ds.length} ma. TONG sau khi sua: Nhap ${soDep(tNhap)} | Xuat ${soDep(tXuat)} | Ton ${soDep(tNhap - tXuat)}`);
      console.log('');
      console.log('  LUU Y: don khach dat / phieu ban hang CU van giu don vi da ghi tren tung don,');
      console.log('         he thong tu quy doi khi doc nen KHONG phai sua tay tung don.');
      /* v6.40: CHAN GHI khi co ma bi AM KHO sau khi sua. Am kho = gia thiet "so lieu dang la ri"
         SAI voi ma do (thuc te no da dung don vi roi). Nhan bua se pha du lieu dang dung. */
      const maAm = ds.filter(r => {
        const he = Number(r.LoaiRi) || 1;
        const n2 = suaNhap ? (Number(r.TongNhap) || 0) * he : (Number(r.TongNhap) || 0);
        const x2 = suaXuat ? (Number(r.TongXuat) || 0) * he : (Number(r.TongXuat) || 0);
        return (n2 - x2) < 0;
      }).map(r => r.MaHang);
      if (maAm.length) {
        console.log('');
        console.log(`!! DUNG LAI: ${maAm.length}/${ds.length} ma se AM KHO sau khi sua.`);
        console.log('   Nghia la voi nhung ma do, so lieu KHONG PHAI dang la ri - nhan them la pha du lieu dang dung.');
        console.log('');
        console.log('   NEN DUNG CACH KHAC: tinh lai cot Xuat TU CHUNG TU (moi phieu quy doi theo don vi cua chinh no):');
        console.log('      node utils/kiem_ton_am.js --nan --tat-ca            (chay thu)');
        console.log('      node utils/kiem_ton_am.js --nan --tat-ca --ghi');
        console.log('');
        console.log('   Neu van muon nhan he so cho RIENG cac ma da kiem tay:');
        console.log(`      node utils/sua_don_vi_the_kho.js --ma=MA1,MA2 --cot=${cotNhan} --nhan --ghi`);
        process.exit(1);
      }
      if (!GHI) {
        console.log('');
        console.log('=> Day la CHAY THU, chua ghi gi. Kiem ky cot "NHAP moi" roi them  --ghi  de thuc hien.');
        console.log('   Ma nao DA DUNG san thi loai ra:  --nhan-tat-ca --tru=MA1,MA2 --ghi');
        process.exit(0);
      }
      console.log('');
      console.log('Bat dau ghi. Moi ma chay rieng (backup JSON + transaction rieng) - ma nao loi thi cac ma khac van chay tiep.');
      const { execFileSync } = require('child_process');
      let ok = 0; const hong = [];
      for (const r of ds) {
        console.log('----------------------------------------------------------------');
        try {
          execFileSync(process.execPath, [__filename, '--ma=' + r.MaHang, '--cot=' + cotNhan, '--nhan', '--ghi'], { stdio: 'inherit' });
          ok++;
        } catch (e) { hong.push(r.MaHang); console.error(`(ma ${r.MaHang} dung lai vi loi o tren)`); }
      }
      console.log('================================================================');
      console.log(`XONG: ${ok}/${ds.length} ma da nhan he so.`);
      if (hong.length) console.log('CHUA sua duoc: ' + hong.join(', '));
      console.log('Kiem lai:  node utils/sua_don_vi_the_kho.js --liet-ke');
      console.log('           node utils/kiem_ton_am.js');
      process.exit(hong.length ? 1 : 0);
    }

    /* ================================================================================================
       SOAT MA "DA DOI NHAN NHUNG CHUA NHAN SO LIEU"   (--soat-ri-con-sot, v6.36)
       ------------------------------------------------------------------------------------------------
       Bang chung dung de doi chieu: LUY KE cong doan "Kho nhập" cua lenh SX (co chung tu, don vi CAI).
       Neu  Nhap(the kho) x LoaiRi  ==  luy ke Kho nhap  => so lieu the kho dang la RI, phai NHAN.
       ================================================================================================ */
    if (SOAT_SOT) {
      const ds = (await pool.request().query(`
        SELECT h.MaHangID, h.MaHang, h.TenHang, h.DonViCoBan, h.DonViQuyDoi, h.LoaiRi,
               ISNULL((SELECT SUM(ct.NhapCai) FROM TheKhoChiTietMau ct WHERE ct.MaHangID = h.MaHangID), 0) AS Nhap,
               kn.LuyKeCai
        FROM TheKhoHangHoa h
        OUTER APPLY (
          SELECT TOP 1 SUM(m.SoLuongLuyKe) AS LuyKeCai
          FROM TienDoSanXuat td
          JOIN CongDoanSanXuat c ON c.StageID = td.StageID AND c.MaCongDoan = 'KN'
          JOIN TienDoChiTietMau m ON m.TienDoID = td.TienDoID
          WHERE td.DonHangID = h.DonHangID
          GROUP BY ISNULL(td.NhomTienDoID, td.TienDoID)
          ORDER BY MAX(td.TienDoID) DESC
        ) kn
        WHERE h.LoaiRi > 1 AND LOWER(LTRIM(RTRIM(h.DonViCoBan))) <> N'ri'
        ORDER BY h.MaHang`)).recordset;
      console.log('=== SOAT: ma DA doi nhan sang Cai/Bo nhung SO LIEU co the van la RI ===');
      console.log('(Doi chieu voi luy ke cong doan "Kho nhap" cua lenh SX - nguon duy nhat co chung tu)');
      console.log('');
      let nghi = [];
      ds.forEach(r => {
        const he = Number(r.LoaiRi) || 1, nhap = Number(r.Nhap) || 0, lk = Number(r.LuyKeCai) || 0;
        if (!lk) return;                       // khong co chung tu Kho nhap -> khong ket luan duoc
        if (nhap === lk) return;               // dang dung
        const khop = nhap * he === lk;
        console.log(`${khop ? '!! ' : '   '}${r.MaHang} - ${r.TenHang}`);
        console.log(`      DVT chinh: ${r.DonViCoBan} | quy doi: ${r.DonViQuyDoi || '-'} | LoaiRi = ${he}`);
        console.log(`      Nhap tren the kho = ${soDep(nhap)} | Luy ke Kho nhap (cai) = ${soDep(lk)}`);
        if (khop) {
          nghi.push(r.MaHang);
          console.log(`      >> SO LIEU DANG LA RI (${soDep(nhap)} x ${he} = ${soDep(lk)}). Sua bang:`);
          console.log(`         node utils/sua_don_vi_the_kho.js --ma=${r.MaHang} --cot=tatca --nhan --ghi`);
        } else {
          console.log(`      >> lech nhung KHONG dung ty le ${he} - phai kiem tay (co the nhap/sua tay).`);
        }
      });
      console.log('');
      console.log(`Tim thay ${nghi.length} ma NGHI dang de so lieu theo Ri.`);
      if (nghi.length) {
        console.log('Sua HET 1 lan (chay thu truoc, bo --ghi):');
        console.log(`   node utils/sua_don_vi_the_kho.js --ma=${nghi.join(',')} --cot=tatca --nhan --ghi`);
      }
      console.log('Ma khong co chung tu "Kho nhap" thi khong ket luan duoc - phai doi chieu tay.');
      process.exit(0);
    }

    /* ================================================================================================
       CHUYEN HET MA HANG DANG QUAN THEO "Ri" SANG "Cái"   (--tat-ca-ri, v6.26)
       ------------------------------------------------------------------------------------------------
       Ri -> Cai LUON la phep NHAN nen khong bao gio vuong loi "khong chia het" — an toan chay hang loat.
       Chia 2 nhom vi 2 cach lam khac nhau:
         LoaiRi > 1  : doi nhan + NHAN ca 3 cot (SoCat/Nhap/Xuat) voi LoaiRi
         LoaiRi <= 1 : CHI doi nhan (1 Ri = 1 Cai, so lieu giu nguyen). --quy-doi se BAO LOI voi nhom nay.
       ================================================================================================ */
    if (TAT_CA_RI) {
      const dsRi = rows.filter(r => chuanDonVi(r.DonViCoBan) === 'Ri');
      if (!dsRi.length) {
        console.log('Khong co ma hang nao dang quan theo "Ri" — khong co gi de chuyen.');
        process.exit(0);
      }
      if (DEN_RAW || COT || QUY_DOI || MA) {
        console.error('--tat-ca-ri da tu quyet dinh cach lam, KHONG dung kem --ma / --den / --cot / --quy-doi.');
        process.exit(1);
      }
      console.log('=== CHUYEN TAT CA MA HANG CO DVT CHINH "Ri" SANG "Cái" ===');
      console.log(`Tim thay ${dsRi.length} ma hang dang quan theo Ri.`);
      console.log('');
      console.log('  ' + 'MA HANG'.padEnd(18) + 'LoaiRi'.padStart(7) + 'TON (Ri)'.padStart(12)
        + 'TON (Cái)'.padStart(13) + '   CACH LAM');
      let tonRi = 0, tonCai = 0, soNhan = 0, soNhan1 = 0;
      dsRi.forEach(r => {
        const he = Number(r.LoaiRi) || 1;
        const ton = Number(r.Ton) || 0;
        const tonMoi = he > 1 ? ton * he : ton;
        tonRi += ton; tonCai += tonMoi;
        if (he > 1) soNhan++; else soNhan1++;
        console.log('  ' + String(r.MaHang).padEnd(18) + String(he).padStart(7)
          + soDep(ton).padStart(12) + soDep(tonMoi).padStart(13)
          + (he > 1 ? `   doi nhan + NHAN so lieu voi ${he}` : '   chi doi nhan (1 Ri = 1 Cái)'));
      });
      console.log('  ' + '-'.repeat(72));
      console.log('  ' + 'TONG'.padEnd(18) + ''.padStart(7) + soDep(tonRi).padStart(12) + soDep(tonCai).padStart(13));
      console.log('');
      console.log(`  ${soNhan} ma phai nhan he so, ${soNhan1} ma chi doi nhan.`);
      console.log('  LUU Y:');
      console.log('   - Gia ban (TheKhoHangHoa.GiaBan) VON DA la gia 1 CAI nen KHONG doi — kiem lai vai ma cho chac.');
      console.log('   - Don khach dat / phieu ban hang CU ghi "Ri" van dung: he thong tu quy doi khi doc.');
      console.log('   - DonViQuyDoi cua cac ma nay se thanh "Ri" (van xem duoc ton quy ra Ri tren man hinh).');
      if (!GHI) {
        console.log('');
        console.log('=> Day la CHAY THU, chua ghi gi. Them  --ghi  de thuc hien.');
        process.exit(0);
      }
      console.log('');
      console.log('Bat dau ghi. Moi ma chay rieng (co backup JSON + transaction rieng) — ma nao loi thi cac ma khac van chay tiep.');
      const { execFileSync } = require('child_process');
      let ok = 0; const hong = [];
      for (const r of dsRi) {
        const he = Number(r.LoaiRi) || 1;
        const tv = ['--ma=' + r.MaHang, '--den=Cai', '--ghi'];
        if (he > 1) tv.push('--quy-doi');   // LoaiRi <= 1 thi --quy-doi se bao loi, phai bo di
        console.log('----------------------------------------------------------------');
        try { execFileSync(process.execPath, [__filename].concat(tv), { stdio: 'inherit' }); ok++; }
        catch (e) { hong.push(r.MaHang); console.error(`(ma ${r.MaHang} dung lai vi loi o tren)`); }
      }
      console.log('================================================================');
      console.log(`XONG: ${ok}/${dsRi.length} ma da chuyen sang "Cái".`);
      if (hong.length) console.log('CHUA chuyen duoc: ' + hong.join(', ') + '  -> xem loi o tren, xu ly tung ma.');
      console.log('Kiem lai:  node utils/sua_don_vi_the_kho.js --liet-ke');
      console.log('           node utils/kiem_ton_am.js            (soat ton am sau khi doi)');
      process.exit(hong.length ? 1 : 0);
    }

    /* --------- SUA 1 HAY NHIEU MA (--ma=A,B,C) --------- */
    const den = DEN_RAW ? chuanDonVi(DEN_RAW) : null;
    const cot = COT ? chuanCot(COT) : null;
    const coViecLam = den || cot;
    if (!MA || !coViecLam || (DEN_RAW && !den) || (COT && !cot)) {
      console.error('');
      console.error('THIEU/SAI THAM SO.');
      console.error(`  --ma  doc duoc: ${MA ? '"' + MA + '"' : '(khong co)'}`);
      console.error(`  --den doc duoc: ${DEN_RAW ? '"' + DEN_RAW + '"' + (den ? '' : '  <- khong hieu la don vi nao') : '(khong co)'}`);
      console.error(`  --cot doc duoc: ${COT ? '"' + COT + '"' + (cot ? '' : '  <- phai la nhap / xuat / socat / tatca') : '(khong co)'}`);
      console.error('');
      console.error('3 viec lam duoc (NHO DAU CACH giua cac tham so):');
      console.error('  1) Doi NHAN don vi chinh, giu nguyen so lieu:');
      console.error('       node utils/sua_don_vi_the_kho.js --ma=ABC --den=Cai --ghi');
      console.error('  2) Quy doi RIENG 1 COT (vd Xuat dang la so CAI trong khi kho quan theo RI):');
      console.error('       node utils/sua_don_vi_the_kho.js --ma=ABC --cot=xuat --chia --ghi     (Cai -> Ri: chia he so)');
      console.error('       node utils/sua_don_vi_the_kho.js --ma=ABC --cot=nhap --nhan --ghi     (Ri -> Cai: nhan he so)');
      console.error('  3) Lam ca 2 trong 1 lan (doi nhan + quy doi 1 cot):');
      console.error('       node utils/sua_don_vi_the_kho.js --ma=ABC --den=Ri --cot=xuat --chia --ghi');
      console.error('Xem danh sach ma:  node utils/sua_don_vi_the_kho.js --liet-ke --nghi-ngo');
      process.exit(1);
    }
    if (cot && !CHIA && !NHAN) {
      console.error('Co --cot thi phai kem --chia (Cai -> Ri) hoac --nhan (Ri -> Cai).');
      process.exit(1);
    }
    if (CHIA && NHAN) { console.error('Chi duoc chon 1: --chia HOAC --nhan.'); process.exit(1); }

    const dsMa = String(MA).split(',').map(x => x.trim()).filter(Boolean);
    const dsRow = [];
    for (const m of dsMa) {
      const found = rows.find(x => String(x.MaHang).trim().toUpperCase() === m.toUpperCase());
      if (!found) { console.error(`Khong tim thay ma hang "${m}". Dung --liet-ke de xem danh sach.`); process.exit(1); }
      dsRow.push(found);
    }
    if (dsRow.length > 1) {
      /* Nhieu ma: chay lai chinh script nay cho tung ma (giu nguyen moi kiem tra an toan cua 1 ma). */
      console.log(`Se xu ly ${dsRow.length} ma: ${dsRow.map(x => x.MaHang).join(', ')}`);
      console.log('');
      const { execFileSync } = require('child_process');
      for (const x of dsRow) {
        const tv = ['--ma=' + x.MaHang];
        if (den) tv.push('--den=' + den);
        if (cot) tv.push('--cot=' + cot);
        if (CHIA) tv.push('--chia');
        if (NHAN) tv.push('--nhan');
        if (QUY_DOI) tv.push('--quy-doi');
        if (GHI) tv.push('--ghi');
        console.log('----------------------------------------------------------------');
        try { execFileSync(process.execPath, [__filename].concat(tv), { stdio: 'inherit' }); }
        catch (e) { console.error(`(ma ${x.MaHang} dung lai vi loi o tren - cac ma khac van chay tiep)`); }
      }
      process.exit(0);
    }
    const r = dsRow[0];

    const he = Number(r.LoaiRi) || 1;
    const cu = chuanDonVi(r.DonViCoBan) || 'Cái';
    const denThat = den || cu;                       // khong doi nhan thi giu nguyen don vi cu
    console.log(`Ma hang: ${r.MaHang} - ${r.TenHang}`);
    console.log(`  Don vi chinh hien tai: ${cu} | LoaiRi = ${he}`);
    console.log(`  So lieu hien tai: Nhap ${soDep(r.TongNhap)} | Xuat ${soDep(r.TongXuat)} | Ton ${soDep(r.Ton)} (${cu})`);
    if (den && cu === den && !cot && !QUY_DOI) { console.log('=> Don vi chinh da dung roi, khong co gi de sua.'); process.exit(0); }

    const chiTiet = (await pool.request().input('id', sql.Int, r.MaHangID).query(`
      SELECT ct.ID, ct.MauSacID, ms.TenMau, ct.SoCatCai, ct.NhapCai, ct.XuatCai
      FROM TheKhoChiTietMau ct LEFT JOIN MauSac ms ON ms.MauSacID = ct.MauSacID
      WHERE ct.MaHangID = @id ORDER BY ms.TenMau`)).recordset;

    /* Cac cot se bi quy doi + huong quy doi:
         --quy-doi        : ca 3 cot, huong theo chieu doi nhan (Ri->Cai = nhan, Cai->Ri = chia)
         --cot=X --chia   : rieng cot X, CHIA he so  (so dang la CAI, dua ve RI)
         --cot=X --nhan   : rieng cot X, NHAN he so  (so dang la RI, dua ve CAI) */
    let cacCot = [], nhan = false;
    if (QUY_DOI) {
      if (he <= 1) { console.error('LoaiRi <= 1 nen khong quy doi duoc (1 Ri = 1 Cai).'); process.exit(1); }
      if (!den || cu === den) { console.error('--quy-doi phai di kem --den= khac don vi hien tai.'); process.exit(1); }
      cacCot = ['SoCatCai', 'NhapCai', 'XuatCai'];
      nhan = (cu === 'Ri' && den === 'Cái');
    } else if (cot) {
      if (he <= 1) { console.error('LoaiRi <= 1 nen khong quy doi duoc (1 Ri = 1 Cai).'); process.exit(1); }
      cacCot = cot === 'tatca' ? ['SoCatCai', 'NhapCai', 'XuatCai'] : [{ nhap: 'NhapCai', xuat: 'XuatCai', socat: 'SoCatCai' }[cot]];
      nhan = NHAN;
    }
    if (cacCot.length) {
      const loi = [];
      chiTiet.forEach(c => cacCot.forEach(k => {
        const v = Number(c[k]) || 0;
        if (!nhan && v % he !== 0) loi.push(`  ${c.TenMau || '(khong mau)'}: ${TEN_COT[k]} = ${v} khong chia het cho ${he}`);
      }));
      if (loi.length) {
        console.error(`KHONG chia duoc cho he so ${he} (chia le se lam sai so hang):`);
        loi.forEach(x => console.error(x));
        console.error('');
        console.error('NGUYEN NHAN THUONG GAP: cot nay LAN LON DON VI - mot phan don khach dat ghi "Ri",');
        console.error('mot phan ghi "Cai" - nen ca cot khong cung 1 don vi de chia.');
        console.error('=> DUNG LENH NAY. Hay NAN THEO CHUNG TU (quy doi RIENG tung don theo don vi cua chinh don do):');
        console.error(`     node utils/kiem_ton_am.js --ma=${r.MaHang} --nan`);
        console.error(`     node utils/kiem_ton_am.js --ma=${r.MaHang} --nan --ghi`);
        process.exit(1);
      }
      console.log(`  Se ${nhan ? 'NHAN' : 'CHIA'} ${cacCot.map(k => TEN_COT[k]).join(' + ')} cua ${chiTiet.length} dong mau ${nhan ? 'voi' : 'cho'} ${he}.`);
    } else {
      console.log('  GIU NGUYEN so lieu, chi doi nhan don vi (dung khi so lieu trong CSDL da dung).');
    }

    const q = (k, v) => cacCot.includes(k) ? (nhan ? Number(v) * he : Number(v) / he) : Number(v);
    console.log('');
    console.log('Sau khi sua:');
    let tNhap = 0, tXuat = 0;
    chiTiet.forEach(c => {
      const n2 = q('NhapCai', c.NhapCai), x2 = q('XuatCai', c.XuatCai);
      tNhap += n2; tXuat += x2;
      console.log(`  ${(c.TenMau || '(khong mau)').padEnd(20)} Nhap ${soDep(c.NhapCai)} -> ${soDep(n2)}`
        + ` | Xuat ${soDep(c.XuatCai)} -> ${soDep(x2)}`
        + ` | Ton ${soDep(Number(c.NhapCai) - Number(c.XuatCai))} -> ${soDep(n2 - x2)} ${denThat}`);
    });
    console.log(`  ${'TONG'.padEnd(20)} Nhap ${soDep(tNhap)} | Xuat ${soDep(tXuat)} | TON = ${soDep(tNhap - tXuat)} ${denThat}`
      + ((tNhap - tXuat) < 0 ? '   <-- VAN CON AM, kiem tra lai huong quy doi!' : '   <-- OK, khong con am'));

    const donViQuyDoiMoi = denThat === 'Ri' ? 'Cái' : 'Ri';
    console.log('');
    if (den) console.log(`  DonViCoBan: ${cu} -> ${den} | DonViQuyDoi: ${r.DonViQuyDoi || '-'} -> ${donViQuyDoiMoi}`);
    else console.log(`  DonViCoBan GIU NGUYEN: ${cu}`);
    console.log('  LUU Y: don khach dat / phieu ban hang CU van giu don vi da ghi tren tung don;');
    console.log('         he thong tu quy doi khi tru ton nen khong can sua tay tung don.');

    if (!GHI) { console.log(''); console.log('=> Day la CHAY THU, chua ghi gi. Them  --ghi  de thuc hien.'); process.exit(0); }

    const dir = path.join(__dirname, '..', 'backup');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `doi_donvi_thekho_${r.MaHang}_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(file, JSON.stringify({ ngay: new Date().toISOString(), maHang: r.MaHang, truoc: { header: r, chiTiet }, doi: { den, cot: cacCot, nhan } }, null, 2), 'utf8');
    console.log('Da ghi file sao luu: ' + file);

    const tran = new sql.Transaction(pool);
    await tran.begin();
    try {
      if (cacCot.length) {
        const phep = nhan ? '*' : '/';
        const setStr = cacCot.map(k => `${k} = ${k} ${phep} @he`).join(', ');
        await new sql.Request(tran).input('id', sql.Int, r.MaHangID).input('he', sql.Int, he)
          .query(`UPDATE TheKhoChiTietMau SET ${setStr} WHERE MaHangID = @id`);
      }
      if (den) {
        await new sql.Request(tran).input('id', sql.Int, r.MaHangID)
          .input('dv', sql.NVarChar, den).input('qd', sql.NVarChar, donViQuyDoiMoi)
          .query('UPDATE TheKhoHangHoa SET DonViCoBan = @dv, DonViQuyDoi = @qd WHERE MaHangID = @id');
      }
      await tran.commit();
      console.log('XONG. Mo lai The kho / Ton kho (Ctrl+F5) de kiem tra.');
    } catch (err) {
      try { await tran.rollback(); } catch (e) { /* transaction co the da ket thuc */ }
      console.error('LOI khi ghi - da QUAY LUI toan bo, du lieu giu nguyen: ' + err.message);
      process.exit(1);
    }
    process.exit(0);
  } catch (err) {
    console.error('LOI: ' + err.message);
    process.exit(1);
  }
})();
