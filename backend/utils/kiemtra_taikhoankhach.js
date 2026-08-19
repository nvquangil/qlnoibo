// v5.63.1 — CHAN DOAN + DAT LAI MAT KHAU TAI KHOAN KHACH (dat hang tren web cong khai)
//
// Cach chay (dung trong thu muc backend):
//   node utils/kiemtra_taikhoankhach.js                      -> liet ke tat ca tai khoan khach
//   node utils/kiemtra_taikhoankhach.js <ten> <matkhau>      -> kiem tra dang nhap co dung khong
//   node utils/kiemtra_taikhoankhach.js <ten> <matkhau> --datlai  -> DAT LAI mat khau thanh <matkhau>
//
// Cong cu nay chay ngay tren may chu, KHONG qua trinh duyet -> loai bo moi nghi ngo
// ve cache, ban .js cu, hay go nham ban phim tieng Viet.

const bcrypt = require('bcryptjs');
const { sql, getPool } = require('../db');

// Hien thi ro khoang trang / ky tu la trong chuoi.
function soi(s) {
  const t = String(s === null || s === undefined ? '' : s);
  const ma = Array.from(t).map(c => {
    const code = c.codePointAt(0);
    return (code < 32 || code === 160) ? `<U+${code.toString(16).toUpperCase()}>` : c;
  }).join('');
  return `[${ma}] (dai ${t.length})`;
}

async function main() {
  const [, , ten, matKhau, ...co] = process.argv;
  const datLai = co.includes('--datlai');
  const pool = await getPool();

  if (!ten) {
    const rows = (await pool.request().query(
      `SELECT TaiKhoanKhachID, TenDangNhap, TenKhach, TrangThai,
              LEFT(ISNULL(MatKhauHash,''), 7) AS DauHash, LEN(ISNULL(MatKhauHash,'')) AS DoDaiHash
       FROM TaiKhoanKhach ORDER BY TaiKhoanKhachID`)).recordset;
    if (!rows.length) { console.log('CHUA CO tai khoan khach nao. Tao o: The kho hang hoa -> Tai khoan khach.'); process.exit(0); }
    console.log(`Co ${rows.length} tai khoan khach:\n`);
    rows.forEach(r => {
      const hashOk = /^\$2[aby]\$/.test(r.DauHash) && r.DoDaiHash === 60;
      console.log(`  #${r.TaiKhoanKhachID}  TenDangNhap=${soi(r.TenDangNhap)}  Khach="${r.TenKhach}"  ` +
                  `TrangThai="${r.TrangThai}"  Hash=${r.DauHash}... (${r.DoDaiHash}) ${hashOk ? 'OK' : '*** SAI DINH DANG ***'}`);
    });
    console.log('\nKiem tra mat khau:  node utils/kiemtra_taikhoankhach.js <ten> <matkhau>');
    process.exit(0);
  }

  if (!matKhau) {
    console.log('Thieu mat khau. Cach dung: node utils/kiemtra_taikhoankhach.js <ten> <matkhau> [--datlai]');
    process.exit(1);
  }

  const row = (await pool.request().input('u', sql.NVarChar, ten)
    .query('SELECT * FROM TaiKhoanKhach WHERE LTRIM(RTRIM(TenDangNhap)) = LTRIM(RTRIM(@u))')).recordset[0];

  console.log(`\nTen dang nhap ban go : ${soi(ten)}`);
  if (!row) {
    console.log('KET QUA: *** KHONG TIM THAY TAI KHOAN NAY ***');
    const all = (await pool.request().query('SELECT TenDangNhap FROM TaiKhoanKhach')).recordset;
    console.log('Cac ten dang nhap dang co trong CSDL:');
    all.forEach(r => console.log('   ' + soi(r.TenDangNhap)));
    console.log('\n=> Go dung 1 trong cac ten tren (phan biet HOA/thuong o SQL thi khong, nhung sai chinh ta thi co).');
    process.exit(2);
  }

  console.log(`Ten trong CSDL       : ${soi(row.TenDangNhap)}`);
  console.log(`Khach                : ${row.TenKhach}`);
  console.log(`Trang thai           : ${row.TrangThai}${String(row.TrangThai || '') === 'Tạm dừng' ? '  *** DANG TAM DUNG -> KHONG DANG NHAP DUOC ***' : ''}`);

  const hash = row.MatKhauHash || '';
  const hashOk = /^\$2[aby]\$/.test(hash) && hash.length === 60;
  console.log(`MatKhauHash          : ${hash.slice(0, 7)}... (dai ${hash.length}) ${hashOk ? 'dung dinh dang bcrypt' : '*** SAI DINH DANG ***'}`);

  if (datLai) {
    const moi = await bcrypt.hash(matKhau, 10);
    await pool.request().input('id', sql.Int, row.TaiKhoanKhachID).input('h', sql.NVarChar, moi)
      .query('UPDATE TaiKhoanKhach SET MatKhauHash=@h WHERE TaiKhoanKhachID=@id');
    console.log(`\n>>> DA DAT LAI mat khau cho "${row.TenDangNhap}" thanh: ${matKhau}`);
    console.log('>>> Bao khach dang nhap lai bang dung chuoi tren (phan biet HOA/thuong).');
    process.exit(0);
  }

  if (!hashOk) {
    console.log('\nKET QUA: mat khau chua duoc luu dung. Chay lai lenh nay kem --datlai de dat lai.');
    process.exit(3);
  }

  console.log(`Mat khau ban go      : ${soi(matKhau)}`);
  const ok = await bcrypt.compare(matKhau, hash);
  console.log(`\nKET QUA: ${ok ? '*** DUNG MAT KHAU — dang nhap duoc ***' : '*** SAI MAT KHAU ***'}`);
  if (!ok) console.log('=> Dat lai bang: node utils/kiemtra_taikhoankhach.js ' + ten + ' <matkhau_moi> --datlai');
  process.exit(ok ? 0 : 4);
}

main().catch(err => { console.error(err); process.exit(1); });
