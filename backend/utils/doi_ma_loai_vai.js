/* ==================================================================================================
   ĐỔI MÃ LOẠI VẢI / GỘP 2 LOẠI VẢI — kéo theo MÃ VẢI và MÃ CÂY  (v6.14.1)
   --------------------------------------------------------------------------------------------------
   Cách hệ thống sinh mã (backend/routes/khovai.js):
        MaVai = <MaLoai>-<MaMau>            (trùng thì thêm "-2", "-3"...)
        MaCay = <MaVai><ddmmyy><số thứ tự>  (vd CT4CM-XANH010825001)
        QRCode = https://quickchart.io/qr?text=<MaCay>   (chỉ là link nên đổi mã là sinh lại được)
   Nên đổi mã loại là phải đổi dây chuyền: LoaiVai.MaLoai -> DanhMucVai.MaVai -> VaiCay.MaCay (+QRCode).

   3 VIỆC LÀM ĐƯỢC:
     1) XEM danh sách loại vải (mã, tên, số mã vải, số cây):
          node utils/doi_ma_loai_vai.js --liet-ke
     2) ĐỔI MÃ (mã mới CHƯA ai dùng):
          node utils/doi_ma_loai_vai.js --tu=CT4CM --den=CTM            (xem trước)
          node utils/doi_ma_loai_vai.js --tu=CT4CM --den=CTM --ghi
          Thêm --giu-ma-cay nếu KHÔNG muốn đổi mã cây (giữ tem đã in).
     3) GỘP vào loại đang giữ mã đó (mã mới ĐÃ có loại khác dùng):
          node utils/doi_ma_loai_vai.js --tu=CT4CM --den=CTK --gop          (xem trước)
          node utils/doi_ma_loai_vai.js --tu=CT4CM --den=CTK --gop --ghi
        Gộp = chuyển toàn bộ mã vải + cây vải của loại CŨ sang loại ĐANG GIỮ mã mới, đổi mã theo,
        chuyển luôn các tham chiếu (Ra lệnh SX / Chỉ định vải SX / Định mức), rồi XÓA loại cũ.
        Mã vải nào TRÙNG MÀU với loại đích thì gộp vào đúng mã vải đó (cây chuyển sang, mã vải cũ bị xóa).

   ⚠️ TEM ĐÃ IN DÁN TRÊN CÂY VẢI mang mã CŨ. Đổi/gộp có đổi mã cây thì tem cũ quét/tra cứu KHÔNG ra nữa
      ⇒ phải IN LẠI TEM (Kho vải > In tem theo ngày nhập, hoặc mở phiếu nhập > In tem).

   AN TOÀN: mặc định chỉ xem; kiểm TRÙNG trước khi ghi; ghi trong 1 GIAO DỊCH (lỗi giữa chừng quay lui
   hết); sao lưu ra backend/backup/. Vẫn nên backup DB bằng SSMS trước khi chạy.
   ================================================================================================== */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { sql, getPool } = require('../db');

const args = process.argv.slice(2);
const co = (t) => args.indexOf(t) !== -1;
const layChuoi = (t) => { const a = args.find(x => x.indexOf(t + '=') === 0); return a ? a.split('=').slice(1).join('=').trim() : ''; };

const LIET_KE = co('--liet-ke');
const DOI_MA_VAI = co('--ma-vai');   // v6.14.4: đổi thẳng MÃ VẢI theo tiền tố (không đụng bảng LoaiVai)
const TU_TEN = layChuoi('--tu-ten');   // v6.14.5: chỉ định loại vải bằng TÊN (khi không nhớ mã / mã rỗng)
const DEN_TEN = layChuoi('--den-ten');
const TU_ID = layChuoi('--tu-id');     // v6.14.6: chỉ định bằng LoaiVaiID — CHẮC CHẮN NHẤT, không lo dấu
const DEN_ID = layChuoi('--den-id');
const XOA_LOAI = co('--xoa-loai');    // v6.14.7: xóa hẳn 1 loại vải (kèm mã vải của nó) nếu chưa dùng ở đâu
const XOA_ID = layChuoi('--id') || TU_ID;

/* v6.14.6 — SO KHỚP TÊN KHÔNG PHỤ THUỘC DẤU TIẾNG VIỆT.
   Vì sao: gõ/dán tên có dấu vào CMD Windows, ký tự nào bảng mã của console không biểu diễn được sẽ bị
   biến thành "?" TRƯỚC KHI Node nhận (vd "ZIP511B MẦU" -> "ZIP511B M?U") ⇒ so khớp chính xác luôn trượt.
   Cách xử lý: bỏ dấu + hoa hết + gộp khoảng trắng ở CẢ 2 phía, và coi "?" trong tham số là "1 ký tự bất
   kỳ". Vẫn không ra thì liệt kê các loại GẦN GIỐNG kèm ID để dùng --tu-id (chắc ăn 100%). */
function bỏDấu(s) {
  return Array.from(String(s == null ? '' : s).normalize('NFD'))
    .filter(c => { const m = c.codePointAt(0); return m < 0x300 || m > 0x36f; })
    .join('').replace(/đ/g, 'd').replace(/Đ/g, 'D');
}
function chuanTen(s) { return bỏDấu(s).toUpperCase().replace(/\s+/g, ' ').trim(); }
function khopTen(tenDB, thamSo) {
  const a = chuanTen(tenDB), b = chuanTen(thamSo);
  if (a === b) return true;
  if (b.indexOf('?') !== -1) {   // "?" = ký tự bị CMD làm hỏng -> coi như ký tự bất kỳ
    const re = new RegExp('^' + b.split('').map(c => (c === '?' ? '.' : c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('') + '$');
    if (re.test(a)) return true;
  }
  return false;
}
const TU = layChuoi('--tu');
const DEN = layChuoi('--den');
const GHI = co('--ghi');
const GOP = co('--gop');
const GIU_MA_CAY = co('--giu-ma-cay');
const KHONG_HOI = co('--khong-hoi');
const KHONG_BACKUP = co('--khong-backup');
const backupDir = path.join(__dirname, '..', 'backup');

function hoi(q) {
  return new Promise(r => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(q, (a) => { rl.close(); r(String(a || '').trim()); });
  });
}
const qr = (maCay) => 'https://quickchart.io/qr?text=' + encodeURIComponent(maCay);
async function coCot(pool, bang, cot) {
  return ((await pool.request().query(`SELECT COL_LENGTH('${bang}','${cot}') AS c`)).recordset[0] || {}).c != null;
}
function luuBackup(ten, duLieu) {
  if (KHONG_BACKUP) return;
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const f = path.join(backupDir, `${ten}_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(f, JSON.stringify(duLieu, null, 1), 'utf8');
  console.log('Da ghi file sao luu: ' + f);
}

// Thông tin 1 loại vải + số mã vải + số cây (dùng cho --liet-ke và cho báo cáo khi trùng mã).
async function thongTinLoai(pool, loai) {
  const r = (await pool.request().input('id', sql.Int, loai.LoaiVaiID).query(`
    SELECT (SELECT COUNT(*) FROM DanhMucVai WHERE LoaiVaiID=@id) AS SoMaVai,
           (SELECT COUNT(*) FROM VaiCay vc JOIN DanhMucVai dv ON dv.VaiID=vc.VaiID WHERE dv.LoaiVaiID=@id) AS SoCay`)).recordset[0];
  return { ...loai, SoMaVai: r.SoMaVai, SoCay: r.SoCay };
}

/* ==================================================================================================
   v6.14.4 — ĐỔI MÃ VẢI THEO TIỀN TỐ  (--ma-vai)
   Khác với đổi MÃ LOẠI ở trên: chỗ này KHÔNG đụng tới bảng LoaiVai, chỉ đổi chính chuỗi MaVai (và mã cây
   theo sau). Dùng khi mã vải được nhập tay / nhập từ Excel nên không theo công thức <MaLoai>-<MaMau>,
   vd đổi tiền tố "CTTAU_" -> "CTT4C_".
   LƯU Ý KỸ THUẬT: KHÔNG dùng SQL LIKE để lọc tiền tố — ký tự "_" trong LIKE là KÝ TỰ ĐẠI DIỆN (khớp 1
   ký tự bất kỳ), "CTTAU_%" sẽ khớp nhầm cả "CTTAUX...". Lấy hết mã vải về rồi lọc bằng startsWith().
   ================================================================================================== */
async function doiMaVaiTheoTienTo(pool) {
  const tatCaVai = (await pool.request().query('SELECT VaiID, MaVai FROM DanhMucVai ORDER BY MaVai')).recordset;
  const khop = tatCaVai.filter(v => String(v.MaVai || '').indexOf(TU) === 0);
  if (!khop.length) {
    console.log(`Khong co MA VAI nao bat dau bang "${TU}".`);
    const gan = tatCaVai.filter(v => String(v.MaVai || '').toUpperCase().indexOf(TU.toUpperCase().slice(0, 4)) === 0).slice(0, 10);
    if (gan.length) console.log('Cac ma gan giong: ' + gan.map(v => v.MaVai).join(', '));
    process.exit(1);
  }
  const doiVai = khop.map(v => ({ VaiID: v.VaiID, cu: String(v.MaVai), moi: DEN + String(v.MaVai).slice(TU.length) }));

  const doiCay = [];
  const boQuaCay = [];
  if (!GIU_MA_CAY) {
    for (const v of doiVai) {
      const cays = (await pool.request().input('id', sql.Int, v.VaiID)
        .query('SELECT CayID, MaCay FROM VaiCay WHERE VaiID=@id ORDER BY MaCay')).recordset;
      for (const c of cays) {
        const ma = String(c.MaCay || '');
        if (ma.indexOf(v.cu) === 0) doiCay.push({ CayID: c.CayID, cu: ma, moi: v.moi + ma.slice(v.cu.length) });
        else boQuaCay.push(ma);
      }
    }
  }
  // Tự tránh trùng mã cây (giống v6.14.2).
  const themHauTo = [];
  if (doiCay.length) {
    const tatCa = new Set((await pool.request().query('SELECT MaCay FROM VaiCay')).recordset.map(r => String(r.MaCay)));
    doiCay.forEach(c => tatCa.delete(c.cu));
    for (const c of doiCay) {
      if (!tatCa.has(c.moi)) { tatCa.add(c.moi); continue; }
      let i = 2, u;
      do { u = c.moi + '-' + i; i++; } while (tatCa.has(u));
      themHauTo.push({ cu: c.cu, dinh: c.moi, thanh: u });
      c.moi = u; tatCa.add(u);
    }
  }
  const trung = [];
  for (const v of doiVai) {
    const r = (await pool.request().input('m', sql.NVarChar, v.moi).input('id', sql.Int, v.VaiID)
      .query('SELECT VaiID FROM DanhMucVai WHERE MaVai=@m AND VaiID<>@id')).recordset;
    if (r.length) trung.push(`Ma vai moi "${v.moi}" da ton tai (VaiID ${r[0].VaiID})`);
  }

  console.log('='.repeat(84));
  console.log(`DOI MA VAI THEO TIEN TO:  ${TU}...  ->  ${DEN}...`);
  console.log('='.repeat(84));
  console.log(`Ma vai se doi : ${doiVai.length}`);
  console.log(`Ma cay se doi : ${GIU_MA_CAY ? 'KHONG (--giu-ma-cay)' : doiCay.length}${boQuaCay.length ? ` (bo qua ${boQuaCay.length} ma cay khong bat dau bang ma vai cu)` : ''}`);
  console.log('');
  doiVai.slice(0, 20).forEach(v => console.log(`   MA VAI  ${v.cu.padEnd(26)} ->  ${v.moi}`));
  if (doiVai.length > 20) console.log(`   ... va ${doiVai.length - 20} ma vai nua`);
  doiCay.slice(0, 8).forEach(c => console.log(`   MA CAY  ${c.cu.padEnd(26)} ->  ${c.moi}`));
  if (doiCay.length > 8) console.log(`   ... va ${doiCay.length - 8} ma cay nua`);
  if (themHauTo.length) {
    console.log(`   (${themHauTo.length} cay bi trung ma -> tu them hau to:)`);
    themHauTo.slice(0, 10).forEach(x => console.log(`      ${x.dinh} DA CO => dung ${x.thanh}`));
  }
  console.log('');
  if (trung.length) {
    console.log('!! DUNG LAI - ma vai moi BI TRUNG, khong ghi gi ca:');
    trung.slice(0, 20).forEach(t => console.log('   - ' + t));
    process.exit(1);
  }
  if (!GHI) {
    console.log('>>> DANG O CHE DO CHI XEM. Khong sua gi ca.');
    console.log(`    Lam that:  node utils/doi_ma_loai_vai.js --ma-vai --tu=${TU} --den=${DEN} --ghi`);
    process.exit(0);
  }
  if (doiCay.length) console.log(`!!! ${doiCay.length} CAY VAI doi ma => TEM DA IN mang ma cu phai IN LAI.`);
  if (!KHONG_HOI) {
    const tl = await hoi('    Go dung chu  DOI  roi Enter de thuc hien (chu khac = huy): ');
    if (tl !== 'DOI') { console.log('Da HUY, khong sua gi.'); process.exit(0); }
  }
  luuBackup('doimavai', { thoiDiem: new Date().toISOString(), tu: TU, den: DEN, doiVai, doiCay, themHauTo });

  const tran = new sql.Transaction(pool);
  await tran.begin();
  try {
    for (const c of doiCay) {
      await new sql.Request(tran).input('id', sql.Int, c.CayID).input('m', sql.NVarChar, c.moi).input('q', sql.NVarChar, qr(c.moi))
        .query('UPDATE VaiCay SET MaCay=@m, QRCode=@q WHERE CayID=@id');
    }
    for (const v of doiVai) {
      await new sql.Request(tran).input('id', sql.Int, v.VaiID).input('m', sql.NVarChar, v.moi)
        .query('UPDATE DanhMucVai SET MaVai=@m WHERE VaiID=@id');
    }
    await tran.commit();
  } catch (err) {
    await tran.rollback();
    console.error('LOI khi ghi - da QUAY LUI toan bo, du lieu giu nguyen:', err.message);
    process.exit(1);
  }
  console.log('');
  console.log('='.repeat(84));
  console.log(`XONG. Da doi ${doiVai.length} ma vai (${TU}... -> ${DEN}...)${doiCay.length ? ` va ${doiCay.length} ma cay` : ', GIU NGUYEN toan bo ma cay'}.`);
  if (doiCay.length) {
    console.log('NHO IN LAI TEM cho cac cay vua doi ma.');
  } else {
    console.log('TEM DA IN VAN DUNG (ma cay khong doi).');
    console.log('Luu y: ma cay cu khong con cung tien to voi ma vai moi. Cay cu van tra cuu/xuat kho binh thuong');
    console.log('(he thong noi bang CayID), chi rieng man NHAP KHO khi quet tem CU de tu dien loai vai/mau se');
    console.log('khong doan ra duoc nua - luc do cu chon tay loai vai + mau nhu binh thuong.');
  }
  console.log('Kiem tra: Kho vai > Ton kho / Ton theo cay (bam F5).');
  process.exit(0);
}

/* ==================================================================================================
   v6.14.7 — XÓA HẲN 1 LOẠI VẢI (kèm các mã vải của nó)   --xoa-loai --id=<LoaiVaiID>
   Chỉ xóa khi THỰC SỰ SẠCH. Có 4 thứ có thể "giữ" loại vải lại, kiểm hết trước khi xóa:
     1. VaiCay        - còn cây vải  -> xóa là mất tồn kho thật, KHÔNG cho xóa ở đây
     2. DonHangChiTietVai (Cấu trúc vải ở Ra lệnh SX)
     3. ChiDinhVaiSX      (Chỉ định vải SX)
     4. DinhMucVai        (định mức, theo LoaiVaiID và/hoặc VaiID)
   Vướng cái nào thì DỪNG và chỉ ra cách xử lý, không tự ý xóa dữ liệu của người khác.
   ================================================================================================== */
async function xoaLoaiVai(pool) {
  const id = Number(XOA_ID);
  if (!Number.isFinite(id)) { console.log('Thieu --id=<LoaiVaiID>. Chay --liet-ke de xem ID.'); process.exit(1); }
  const loai = (await pool.request().input('id', sql.Int, id)
    .query('SELECT LoaiVaiID, MaLoai, TenLoaiVai FROM LoaiVai WHERE LoaiVaiID=@id')).recordset[0];
  if (!loai) { console.log(`Khong co loai vai nao co LoaiVaiID = ${id}. Chay --liet-ke de xem danh sach.`); process.exit(1); }

  const dsVai = (await pool.request().input('id', sql.Int, id)
    .query('SELECT VaiID, MaVai FROM DanhMucVai WHERE LoaiVaiID=@id ORDER BY MaVai')).recordset;
  const inIdVai = dsVai.length ? `(${dsVai.map(v => Number(v.VaiID)).join(',')})` : '(NULL)';

  const cay = (await pool.request().query(`SELECT CayID, MaCay FROM VaiCay WHERE VaiID IN ${inIdVai}`)).recordset;
  const dem = async (bang, cot, gt) => {
    const c = (await pool.request().query(`SELECT COL_LENGTH('${bang}','${cot}') AS c`)).recordset[0].c;
    if (c == null) return 0;
    return Number((await pool.request().query(`SELECT COUNT(*) AS n FROM ${bang} WHERE ${cot} ${gt}`)).recordset[0].n) || 0;
  };
  const soRaLenh = await dem('DonHangChiTietVai', 'LoaiVaiID', '= ' + id);
  const soChiDinh = await dem('ChiDinhVaiSX', 'LoaiVaiID', '= ' + id);
  const soDinhMucLoai = await dem('DinhMucVai', 'LoaiVaiID', '= ' + id);
  const soDinhMucVai = dsVai.length ? await dem('DinhMucVai', 'VaiID', 'IN ' + inIdVai) : 0;

  console.log('='.repeat(84));
  console.log(`XOA LOAI VAI #${loai.LoaiVaiID}:  ma "${loai.MaLoai || '(chua co)'}"  |  ten "${loai.TenLoaiVai}"`);
  console.log('='.repeat(84));
  console.log(`Ma vai thuoc loai nay      : ${dsVai.length}${dsVai.length ? ' -> ' + dsVai.map(v => v.MaVai).slice(0, 8).join(', ') + (dsVai.length > 8 ? '...' : '') : ''}`);
  console.log(`Cay vai dang co            : ${cay.length}${cay.length ? ' -> ' + cay.map(c => c.MaCay).slice(0, 5).join(', ') + (cay.length > 5 ? '...' : '') : ''}`);
  console.log(`Dung o Ra lenh SX          : ${soRaLenh} dong`);
  console.log(`Dung o Chi dinh vai SX     : ${soChiDinh} dong`);
  console.log(`Dung o Dinh muc            : ${soDinhMucLoai + soDinhMucVai} dong`);
  console.log('');

  const vuong = [];
  if (cay.length) vuong.push(`con ${cay.length} CAY VAI (ton kho that)`);
  if (soRaLenh) vuong.push(`${soRaLenh} dong Cau truc vai o Ra lenh SX`);
  if (soChiDinh) vuong.push(`${soChiDinh} dong Chi dinh vai SX`);
  if (soDinhMucLoai + soDinhMucVai) vuong.push(`${soDinhMucLoai + soDinhMucVai} dong Dinh muc`);
  if (vuong.length) {
    console.log('KHONG XOA DUOC vi loai nay dang duoc dung: ' + vuong.join(' | '));
    console.log('');
    console.log('CACH XU LY:');
    if (cay.length) {
      console.log(`  - Con cay vai: CHUYEN sang loai khac roi xoa:`);
      console.log(`        node utils/doi_ma_loai_vai.js --liet-ke        (lay ID loai dich)`);
      console.log(`        node utils/doi_ma_loai_vai.js --gop --tu-id=${id} --den-id=<ID dich> --giu-ma-cay --ghi`);
      console.log(`    Hoac xoa han cay vai truoc (mat ton kho):  node utils/xoa_cay_vai.js --mavai=<ma vai> --ghi`);
    }
    if (soRaLenh || soChiDinh || soDinhMucLoai + soDinhMucVai) {
      console.log('  - Con duoc dung o Ra lenh SX / Chi dinh vai SX / Dinh muc: dung --gop de CHUYEN het');
      console.log(`        node utils/doi_ma_loai_vai.js --gop --tu-id=${id} --den-id=<ID dich> --giu-ma-cay --ghi`);
      console.log('    (gop se chuyen ca cac tham chieu do sang loai dich roi xoa loai nay - an toan hon xoa tay)');
    }
    process.exit(1);
  }

  console.log(`Loai nay SACH (khong con cay vai, khong noi dung o dau) -> xoa duoc ${dsVai.length} ma vai + 1 dong loai vai.`);
  if (!GHI) {
    console.log('>>> DANG O CHE DO CHI XEM. Khong sua gi ca.');
    console.log(`    Xoa that:  node utils/doi_ma_loai_vai.js --xoa-loai --id=${id} --ghi`);
    process.exit(0);
  }
  if (!KHONG_HOI) {
    const tl = await hoi(`    Go dung chu  XOA  de xoa loai "${loai.TenLoaiVai}" (chu khac = huy): `);
    if (tl !== 'XOA') { console.log('Da HUY, khong sua gi.'); process.exit(0); }
  }
  luuBackup('xoaloaivai', { thoiDiem: new Date().toISOString(), loai, dsVai });

  const tran = new sql.Transaction(pool);
  await tran.begin();
  try {
    for (const v of dsVai) {
      await new sql.Request(tran).input('id', sql.Int, v.VaiID).query('DELETE FROM DanhMucVai WHERE VaiID=@id');
    }
    await new sql.Request(tran).input('id', sql.Int, id).query('DELETE FROM LoaiVai WHERE LoaiVaiID=@id');
    await tran.commit();
  } catch (err) {
    await tran.rollback();
    console.error('LOI khi ghi - da QUAY LUI toan bo, du lieu giu nguyen:', err.message);
    process.exit(1);
  }
  console.log('');
  console.log('='.repeat(84));
  console.log(`XONG. Da xoa loai vai "${loai.TenLoaiVai}" (${loai.MaLoai || 'chua co ma'}) va ${dsVai.length} ma vai cua no.`);
  console.log('Kiem tra: Danh muc > Loai vai / Kho vai > Ton kho (bam F5).');
  process.exit(0);
}

async function main() {
  const pool = await getPool();

  if (XOA_LOAI) return xoaLoaiVai(pool);   // v6.14.7

  if (LIET_KE) {
    const ds = (await pool.request().query('SELECT LoaiVaiID, MaLoai, TenLoaiVai FROM LoaiVai ORDER BY MaLoai, TenLoaiVai')).recordset;
    console.log('='.repeat(84));
    console.log(`DANH SACH LOAI VAI (${ds.length})`);
    console.log('='.repeat(84));
    // v6.14.6: in kèm LoaiVaiID để copy vào --tu-id / --den-id (khong lo dau tieng Viet bi CMD lam hong).
    console.log('  ID     MA LOAI        TEN LOAI VAI                          MA VAI    CAY');
    for (const l of ds) {
      const t = await thongTinLoai(pool, l);
      console.log(`  ${String(t.LoaiVaiID).padEnd(6)} ${String(t.MaLoai || '(chua co ma)').padEnd(14)} ${String(t.TenLoaiVai).slice(0, 36).padEnd(38)} ${String(t.SoMaVai).padStart(4)}   ${String(t.SoCay).padStart(5)}`);
    }
    console.log('');
    console.log('Vi du dung ID (chac an nhat):  node utils/doi_ma_loai_vai.js --gop --tu-id=12 --den-id=7 --giu-ma-cay');
    process.exit(0);
  }

  const theoTen = !!(TU_TEN || DEN_TEN || TU_ID || DEN_ID);
  if (!theoTen && (!TU || !DEN)) {
    console.log('Thieu tham so. Vi du:');
    console.log('  node utils/doi_ma_loai_vai.js --liet-ke');
    console.log('  node utils/doi_ma_loai_vai.js --tu=CT4CM --den=CTM                 (doi MA LOAI VAI)');
    console.log('  node utils/doi_ma_loai_vai.js --tu=CT4CM --den=CTK --gop           (GOP 2 loai vai theo MA)');
    console.log('  node utils/doi_ma_loai_vai.js --ma-vai --tu=CTTAU_ --den=CTT4C_    (doi MA VAI theo tien to)');
    console.log('  node utils/doi_ma_loai_vai.js --gop --tu-id=12 --den-id=7 --giu-ma-cay');
    console.log('        (GOP loai #12 vao loai #7 roi xoa loai #12 - lay ID o --liet-ke)');
    console.log('  node utils/doi_ma_loai_vai.js --xoa-loai --id=130                   (XOA HAN 1 loai vai)');
    process.exit(1);
  }
  if (!theoTen && TU === DEN) { console.log('Ma cu va ma moi giong nhau - khong co gi de doi.'); process.exit(0); }
  if (DEN && DEN.length > 50) { console.log('Ma moi qua dai (toi da 50 ky tu).'); process.exit(1); }

  if (DOI_MA_VAI) return doiMaVaiTheoTienTo(pool);   // v6.14.4: nhánh riêng, không đụng bảng LoaiVai

  /* v6.14.5 — TÌM LOẠI VẢI THEO TÊN (--tu-ten / --den-ten) ngoài cách theo mã.
     Dùng khi chỉ nhớ TÊN loại vải, hoặc loại đó CHƯA CÓ MÃ (MaLoai NULL) nên không tra theo mã được.
     So tên: bỏ khoảng trắng 2 đầu, KHÔNG phân biệt chữ hoa/thường (SQL Server mặc định collation
     không phân biệt hoa/thường, nhưng LTRIM/RTRIM thì phải tự làm). */
  /* v6.14.6: tìm loại vải theo ID / TÊN (không phụ thuộc dấu) / MÃ. Lấy hết bảng LoaiVai về rồi so khớp
     trong JS — bảng này chỉ vài chục dòng, mà làm vậy mới bỏ dấu + xử lý "?" được. */
  const tatCaLoai = (await pool.request().query('SELECT LoaiVaiID, TenLoaiVai, MaLoai FROM LoaiVai ORDER BY TenLoaiVai')).recordset;
  function inGoiY(nhan, thamSo) {
    const b = chuanTen(thamSo).replace(/\?/g, '');
    const goc = b.split(' ')[0] || b;
    const gan = tatCaLoai.filter(l => chuanTen(l.TenLoaiVai).indexOf(goc.slice(0, Math.max(3, Math.floor(goc.length / 2)))) !== -1);
    console.log((gan.length ? `Cac loai vai GAN GIONG (dung --${nhan}-id de chi dinh cho chac):` : 'Danh sach loai vai (dung --' + nhan + '-id):'));
    (gan.length ? gan : tatCaLoai).slice(0, 25).forEach(l =>
      console.log(`   --${nhan}-id=${String(l.LoaiVaiID).padEnd(5)} ma=${String(l.MaLoai || '(chua co)').padEnd(14)} ten="${l.TenLoaiVai}"`));
  }
  function timLoai(nhan, ma, ten, id) {
    if (id) {
      const r = tatCaLoai.find(l => String(l.LoaiVaiID) === String(id));
      if (!r) { console.log(`Khong co loai vai nao co LoaiVaiID = ${id}. Chay --liet-ke de xem danh sach.`); process.exit(1); }
      return r;
    }
    let r = ten ? tatCaLoai.filter(l => khopTen(l.TenLoaiVai, ten))
      : tatCaLoai.filter(l => chuanTen(l.MaLoai) === chuanTen(ma));
    if (!r.length && ten) {   // thử tiếp kiểu "chứa" (tên trong CSDL có thêm chữ)
      const b = chuanTen(ten).replace(/\?/g, '');
      r = tatCaLoai.filter(l => chuanTen(l.TenLoaiVai).indexOf(b) !== -1);
    }
    if (!r.length) {
      console.log(`Khong tim thay LOAI VAI ${nhan.toUpperCase()} ${ten ? `co TEN ~ "${ten}"` : `co MA "${ma}"`}.`);
      console.log('(Luu y: go dau tieng Viet trong CMD hay bi bien thanh "?" - nen dung --' + nhan + '-id cho chac.)');
      inGoiY(nhan, ten || ma);
      process.exit(1);
    }
    if (r.length > 1) {
      console.log(`Co ${r.length} loai vai khop ${nhan.toUpperCase()} - chi dinh ro bang --${nhan}-id:`);
      r.slice(0, 25).forEach(l => console.log(`   --${nhan}-id=${String(l.LoaiVaiID).padEnd(5)} ma=${String(l.MaLoai || '(chua co)').padEnd(14)} ten="${l.TenLoaiVai}"`));
      process.exit(1);
    }
    return r[0];
  }
  const nguon = await thongTinLoai(pool, timLoai('tu', TU, TU_TEN, TU_ID));

  let dsDich = [];
  if (DEN_TEN || DEN_ID) {
    const d = timLoai('den', null, DEN_TEN, DEN_ID);
    if (d.LoaiVaiID === nguon.LoaiVaiID) { console.log('Loai nguon va loai dich la CUNG MOT dong - khong co gi de lam.'); process.exit(0); }
    dsDich = [d];
  } else {
    dsDich = (await pool.request().input('m', sql.NVarChar, DEN).input('id', sql.Int, nguon.LoaiVaiID)
      .query('SELECT LoaiVaiID, TenLoaiVai, MaLoai FROM LoaiVai WHERE MaLoai = @m AND LoaiVaiID <> @id')).recordset;
  }
  if ((DEN_TEN || DEN_ID) && !GOP) {
    console.log(`Loai dich "${dsDich[0].TenLoaiVai}" DA TON TAI => day la viec GOP. Them --gop vao lenh.`);
    process.exit(1);
  }

  /* ---------- TRƯỜNG HỢP 1: mã mới đã có loại khác dùng ---------- */
  if (dsDich.length && !GOP) {
    const dich = await thongTinLoai(pool, dsDich[0]);
    console.log('='.repeat(84));
    console.log(`KHONG DOI DUOC: ma "${DEN}" DA co loai vai khac dung.`);
    console.log('='.repeat(84));
    console.log(`  Loai dang doi (--tu) : ${nguon.MaLoai}  |  ${nguon.TenLoaiVai}  |  ${nguon.SoMaVai} ma vai, ${nguon.SoCay} cay`);
    console.log(`  Loai dang giu ma moi : ${dich.MaLoai}  |  ${dich.TenLoaiVai}  |  ${dich.SoMaVai} ma vai, ${dich.SoCay} cay`);
    console.log('');
    console.log('CHON 1 TRONG 3 CACH:');
    console.log(`  1) Neu 2 loai nay THUC RA LA MOT (chi khac ten/ma) -> GOP:`);
    console.log(`        node utils/doi_ma_loai_vai.js --tu=${TU} --den=${DEN} --gop          (xem truoc)`);
    console.log(`        node utils/doi_ma_loai_vai.js --tu=${TU} --den=${DEN} --gop --ghi`);
    console.log(`  2) Neu la 2 loai KHAC NHAU -> dat ma khac cho "${nguon.TenLoaiVai}", vd:`);
    console.log(`        node utils/doi_ma_loai_vai.js --tu=${TU} --den=${DEN}2`);
    console.log(`  3) Doi ma cua loai "${dich.TenLoaiVai}" sang ma khac truoc, roi quay lai lenh cu.`);
    process.exit(1);
  }
  if (GOP && !dsDich.length) {
    console.log(`--gop nhung khong co loai vai nao dang giu ma "${DEN}" -> khong co gi de gop.`);
    console.log(`Bo --gop di la doi ten binh thuong: node utils/doi_ma_loai_vai.js --tu=${TU} --den=${DEN}`);
    process.exit(1);
  }
  const dich = dsDich.length ? await thongTinLoai(pool, dsDich[0]) : null;

  /* ---------- Tính TOÀN BỘ thay đổi trước, không ghi gì ---------- */
  const dsVaiNguon = (await pool.request().input('id', sql.Int, nguon.LoaiVaiID)
    .query('SELECT VaiID, MaVai, MauSacID FROM DanhMucVai WHERE LoaiVaiID = @id ORDER BY MaVai')).recordset;

  const doiVai = [];      // { VaiID, cu, moi }            - đổi mã vải (khi GỘP thì chuyển luôn sang loại đích)
  const gopVai = [];      // { VaiID, cu, VaiIDDich, maDich } - gộp vào mã vải đã có của loại đích
  const giuTenVai = [];   // GỘP: mã vải KHÔNG bắt đầu bằng mã cũ -> giữ NGUYÊN tên nhưng VẪN phải chuyển loại
  const boQuaVai = [];    // Đổi tên (không gộp): mã vải không khớp tiền tố -> để nguyên, không đụng
  /* v6.14.5: tiền tố dùng để đổi tên MÃ VẢI lấy từ MÃ LOẠI của 2 dòng đã tìm được (khi chỉ định bằng
     TÊN thì --tu/--den rỗng). Loại nào chưa có mã thì KHÔNG đổi tên mã vải, chỉ chuyển sang loại đích. */
  const TU_MA = String(nguon.MaLoai || '').trim();
  const DEN_MA = String((dich && dich.MaLoai) || DEN || '').trim();
  const doiTenMaVai = !!(TU_MA && DEN_MA && TU_MA !== DEN_MA);
  for (const v of dsVaiNguon) {
    const ma = String(v.MaVai || '');
    const khopTienTo = doiTenMaVai && ma.indexOf(TU_MA) === 0;
    if (!khopTienTo && !GOP) { boQuaVai.push(ma); continue; }
    if (GOP) {
      /* v6.14.3 — SỬA LỖI "The DELETE statement conflicted with the REFERENCE constraint ... DanhMucVai":
         khi GỘP thì MỌI mã vải của loại cũ đều phải rời khỏi loại cũ, kể cả mã KHÔNG bắt đầu bằng mã cũ
         (mã nhập tay / mã từ hệ thống cũ). Bản trước bỏ qua hẳn những mã đó nên chúng vẫn trỏ vào loại
         cũ ⇒ xóa loại cũ là vướng khóa ngoại, cả giao dịch bị quay lui. */
      const trungMau = (await pool.request().input('lv', sql.Int, dich.LoaiVaiID).input('ms', sql.Int, v.MauSacID)
        .query('SELECT TOP 1 VaiID, MaVai FROM DanhMucVai WHERE LoaiVaiID=@lv AND MauSacID=@ms')).recordset[0];
      if (trungMau) { gopVai.push({ VaiID: v.VaiID, cu: ma, VaiIDDich: trungMau.VaiID, maDich: trungMau.MaVai }); continue; }
      if (!khopTienTo) giuTenVai.push(ma);
    }
    doiVai.push({ VaiID: v.VaiID, cu: ma, moi: khopTienTo ? DEN_MA + ma.slice(TU_MA.length) : ma });
  }

  // Mã cây: đổi theo mã vải mới (hoặc theo mã vải ĐÍCH nếu dòng đó bị gộp).
  const doiCay = [];
  const boQuaCay = [];
  if (!GIU_MA_CAY) {
    const nguonDich = doiVai.map(v => ({ VaiID: v.VaiID, cuPrefix: v.cu, moiPrefix: v.moi, VaiIDMoi: null }))
      .concat(gopVai.map(v => ({ VaiID: v.VaiID, cuPrefix: v.cu, moiPrefix: v.maDich, VaiIDMoi: v.VaiIDDich })));
    for (const v of nguonDich) {
      const cays = (await pool.request().input('id', sql.Int, v.VaiID)
        .query('SELECT CayID, MaCay FROM VaiCay WHERE VaiID = @id ORDER BY MaCay')).recordset;
      for (const c of cays) {
        const ma = String(c.MaCay || '');
        if (ma.indexOf(v.cuPrefix) === 0) doiCay.push({ CayID: c.CayID, cu: ma, moi: v.moiPrefix + ma.slice(v.cuPrefix.length), VaiIDMoi: v.VaiIDMoi });
        else { boQuaCay.push(ma); if (v.VaiIDMoi) doiCay.push({ CayID: c.CayID, cu: ma, moi: ma, VaiIDMoi: v.VaiIDMoi }); }
      }
    }
  } else if (GOP) {
    // Giữ mã cây nhưng vẫn phải chuyển cây sang mã vải đích khi gộp.
    for (const v of gopVai) {
      const cays = (await pool.request().input('id', sql.Int, v.VaiID).query('SELECT CayID, MaCay FROM VaiCay WHERE VaiID=@id')).recordset;
      cays.forEach(c => doiCay.push({ CayID: c.CayID, cu: c.MaCay, moi: c.MaCay, VaiIDMoi: v.VaiIDDich }));
    }
  }

  /* v6.14.2 — TỰ TRÁNH TRÙNG MÃ CÂY khi gộp: 2 loại vải có thể cùng nhập 1 ngày, cùng màu ⇒ đổi mã xong
     ra đúng 1 mã cây đã có bên loại đích (vd CTK-XANH010825001). Trước đây gặp vậy là DỪNG toàn bộ, rất
     khó xử vì phải sửa tay từng cây. Nay tự thêm hậu tố -2, -3... cho mã bị đụng (tem sẽ in lại nên
     không ảnh hưởng gì thực tế), và IN RA danh sách để biết cây nào bị thêm hậu tố. */
  const themHauTo = [];
  if (doiCay.some(c => c.cu !== c.moi)) {
    const tatCa = new Set((await pool.request().query('SELECT MaCay FROM VaiCay')).recordset.map(r => String(r.MaCay)));
    doiCay.forEach(c => { if (c.cu !== c.moi) tatCa.delete(c.cu); });   // mã cũ sẽ được giải phóng
    for (const c of doiCay) {
      if (c.cu === c.moi) continue;
      if (!tatCa.has(c.moi)) { tatCa.add(c.moi); continue; }
      let i = 2, ungVien;
      do { ungVien = c.moi + '-' + i; i++; } while (tatCa.has(ungVien));
      themHauTo.push({ cu: c.cu, dinh: c.moi, thanh: ungVien });
      c.moi = ungVien;
      tatCa.add(ungVien);
    }
  }

  // Kiểm TRÙNG mã mới (MaVai / MaCay đều là khóa duy nhất).
  const trung = [];
  for (const v of doiVai) {
    const r = (await pool.request().input('m', sql.NVarChar, v.moi).input('id', sql.Int, v.VaiID)
      .query('SELECT VaiID FROM DanhMucVai WHERE MaVai=@m AND VaiID<>@id')).recordset;
    if (r.length) trung.push(`Ma vai moi "${v.moi}" da ton tai (VaiID ${r[0].VaiID})`);
  }
  for (const c of doiCay) {
    if (c.cu === c.moi) continue;
    const r = (await pool.request().input('m', sql.NVarChar, c.moi).input('id', sql.Int, c.CayID)
      .query('SELECT CayID FROM VaiCay WHERE MaCay=@m AND CayID<>@id')).recordset;
    if (r.length) trung.push(`Ma cay moi "${c.moi}" da ton tai (CayID ${r[0].CayID})`);
  }

  console.log('='.repeat(84));
  console.log(GOP ? `GOP LOAI VAI:  "${nguon.TenLoaiVai}" (ma ${TU_MA || '(chua co)'})  ->  "${dich.TenLoaiVai}" (ma ${DEN_MA || '(chua co)'})`
    : `DOI MA LOAI VAI:  ${TU}  ->  ${DEN}   [${nguon.TenLoaiVai}]`);
  if (GOP && !doiTenMaVai) console.log('(2 loai chua co ma hoac ma giong nhau -> GIU NGUYEN ten ma vai, chi chuyen sang loai dich.)');
  console.log('='.repeat(84));
  console.log(`Ma vai doi ma tai cho : ${doiVai.length}`);
  if (GOP) console.log(`Ma vai GOP vao ma san : ${gopVai.length}  (cay chuyen sang ma vai dich, ma vai cu bi XOA)`);
  console.log(`Ma cay bi anh huong   : ${GIU_MA_CAY && !GOP ? 'KHONG (--giu-ma-cay)' : doiCay.length}`);
  if (boQuaVai.length) console.log(`Bo qua ${boQuaVai.length} ma vai khong bat dau bang "${TU_MA}": ${boQuaVai.slice(0, 5).join(', ')}${boQuaVai.length > 5 ? '...' : ''}`);
  if (giuTenVai.length) console.log(`Giu NGUYEN TEN ${giuTenVai.length} ma vai nhung VAN chuyen sang loai dich: ${giuTenVai.slice(0, 5).join(', ')}${giuTenVai.length > 5 ? '...' : ''}`);
  if (boQuaCay.length) console.log(`Bo qua ${boQuaCay.length} ma cay tu go (giu nguyen ten): ${boQuaCay.slice(0, 5).join(', ')}${boQuaCay.length > 5 ? '...' : ''}`);
  console.log('');
  doiVai.slice(0, 12).forEach(v => console.log(`   MA VAI  ${v.cu.padEnd(24)} ->  ${v.moi}`));
  if (doiVai.length > 12) console.log(`   ... va ${doiVai.length - 12} ma vai nua`);
  gopVai.slice(0, 12).forEach(v => console.log(`   GOP     ${v.cu.padEnd(24)} ->  ${v.maDich}  (xoa ma vai cu)`));
  if (gopVai.length > 12) console.log(`   ... va ${gopVai.length - 12} ma vai gop nua`);
  doiCay.filter(c => c.cu !== c.moi).slice(0, 8).forEach(c => console.log(`   MA CAY  ${c.cu.padEnd(24)} ->  ${c.moi}`));
  if (themHauTo.length) {
    console.log('');
    console.log(`   (${themHauTo.length} cay bi trung ma voi ben loai dich -> tu them hau to cho khong trung:)`);
    themHauTo.slice(0, 10).forEach(x => console.log(`      ${x.cu} -> ${x.dinh} DA CO => dung ${x.thanh}`));
    if (themHauTo.length > 10) console.log(`      ... va ${themHauTo.length - 10} cay nua`);
  }
  console.log('');

  if (trung.length) {
    console.log('!! DUNG LAI - ma moi BI TRUNG, khong ghi gi ca:');
    trung.slice(0, 20).forEach(t => console.log('   - ' + t));
    process.exit(1);
  }

  if (!GHI) {
    console.log('>>> DANG O CHE DO CHI XEM. Khong sua gi ca. Them --ghi de lam that.');
    process.exit(0);
  }

  const soCayDoiMa = doiCay.filter(c => c.cu !== c.moi).length;
  if (soCayDoiMa) {
    console.log(`!!! ${soCayDoiMa} CAY VAI doi ma => TEM DA IN mang ma cu se KHONG quet/tra cuu duoc nua.`);
    console.log('    Sau khi chay PHAI IN LAI TEM cho cac cay do.');
  }
  if (GOP) console.log(`!!! GOP se XOA loai vai "${nguon.TenLoaiVai}" (ma ${TU_MA || '(chua co)'}) sau khi chuyen het du lieu sang "${dich.TenLoaiVai}".`);
  if (!KHONG_HOI) {
    const tl = await hoi(`    Go dung chu  ${GOP ? 'GOP' : 'DOI'}  roi Enter de thuc hien (chu khac = huy): `);
    if (tl !== (GOP ? 'GOP' : 'DOI')) { console.log('Da HUY, khong sua gi.'); process.exit(0); }
  }

  luuBackup(GOP ? 'gopmaloaivai' : 'doimaloaivai',
    { thoiDiem: new Date().toISOString(), tu: TU, den: DEN, gop: GOP, nguon, dich, doiVai, gopVai, doiCay });

  const coDinhMucLoai = await coCot(pool, 'DinhMucVai', 'LoaiVaiID');
  // Lọc TRƯỚC khi mở giao dịch: bảng nào thực sự có trong CSDL này thì mới đụng tới (mỗi máy chạy tới
  // migration khác nhau) — trong giao dịch mà gặp lỗi "Invalid object name" là hỏng cả giao dịch.
  const bangThamChieuLoai = [];
  for (const b of ['DonHangChiTietVai', 'ChiDinhVaiSX']) {
    const cot = (await pool.request().query(`SELECT COL_LENGTH('${b}','LoaiVaiID') AS c`)).recordset[0].c;
    if (cot != null) bangThamChieuLoai.push(b);
  }
  const tran = new sql.Transaction(pool);
  await tran.begin();
  try {
    // 1) Cây vải: đổi mã (+QR) và/hoặc chuyển sang mã vải đích khi gộp.
    for (const c of doiCay) {
      const rq = new sql.Request(tran).input('id', sql.Int, c.CayID);
      const dat = [];
      if (c.cu !== c.moi) { rq.input('m', sql.NVarChar, c.moi).input('q', sql.NVarChar, qr(c.moi)); dat.push('MaCay=@m', 'QRCode=@q'); }
      if (c.VaiIDMoi) { rq.input('v', sql.Int, c.VaiIDMoi); dat.push('VaiID=@v'); }
      if (dat.length) await rq.query(`UPDATE VaiCay SET ${dat.join(', ')} WHERE CayID=@id`);
    }
    // 2) Mã vải gộp: chuyển định mức theo VaiID rồi XÓA dòng mã vải cũ.
    for (const v of gopVai) {
      await new sql.Request(tran).input('cu', sql.Int, v.VaiID).input('moi', sql.Int, v.VaiIDDich)
        .query('UPDATE DinhMucVai SET VaiID=@moi WHERE VaiID=@cu');
      await new sql.Request(tran).input('id', sql.Int, v.VaiID).query('DELETE FROM DanhMucVai WHERE VaiID=@id');
    }
    // 3) Mã vải còn lại: đổi mã (+ chuyển sang loại đích nếu gộp).
    for (const v of doiVai) {
      const rq = new sql.Request(tran).input('id', sql.Int, v.VaiID).input('m', sql.NVarChar, v.moi);
      let cauLenh = 'UPDATE DanhMucVai SET MaVai=@m';
      if (GOP) { rq.input('lv', sql.Int, dich.LoaiVaiID); cauLenh += ', LoaiVaiID=@lv'; }
      await rq.query(cauLenh + ' WHERE VaiID=@id');
    }
    if (GOP) {
      /* 4) Chuyển mọi tham chiếu tới LOẠI VẢI cũ sang loại đích, rồi xóa loại cũ.
         KHÔNG bọc try/catch quanh các UPDATE này: lỗi bên trong giao dịch mà nuốt đi thì giao dịch đã
         "hỏng" nhưng code vẫn chạy tiếp -> báo lỗi khó hiểu ở tận bước sau. Bảng nào không có thì đã
         được lọc ra từ TRƯỚC khi mở giao dịch (bangThamChieuLoai). */
      for (const b of bangThamChieuLoai) {
        await new sql.Request(tran).input('cu', sql.Int, nguon.LoaiVaiID).input('moi', sql.Int, dich.LoaiVaiID)
          .query(`UPDATE ${b} SET LoaiVaiID=@moi WHERE LoaiVaiID=@cu`);
      }
      if (coDinhMucLoai) {
        await new sql.Request(tran).input('cu', sql.Int, nguon.LoaiVaiID).input('moi', sql.Int, dich.LoaiVaiID)
          .query('UPDATE DinhMucVai SET LoaiVaiID=@moi WHERE LoaiVaiID=@cu');
      }
      // Chốt chặn: còn mã vải nào trỏ vào loại cũ thì báo RÕ ràng thay vì để SQL ném lỗi khóa ngoại khó đọc.
      const conLai = (await new sql.Request(tran).input('id', sql.Int, nguon.LoaiVaiID)
        .query('SELECT TOP 10 MaVai FROM DanhMucVai WHERE LoaiVaiID=@id')).recordset;
      if (conLai.length) throw new Error(`Van con ${conLai.length}+ ma vai thuoc loai cu (${conLai.map(x => x.MaVai).join(', ')}) - khong xoa duoc loai cu.`);
      await new sql.Request(tran).input('id', sql.Int, nguon.LoaiVaiID).query('DELETE FROM LoaiVai WHERE LoaiVaiID=@id');
    } else {
      await new sql.Request(tran).input('id', sql.Int, nguon.LoaiVaiID).input('m', sql.NVarChar, DEN)
        .query('UPDATE LoaiVai SET MaLoai=@m WHERE LoaiVaiID=@id');
    }
    await tran.commit();
  } catch (err) {
    await tran.rollback();
    console.error('LOI khi ghi - da QUAY LUI toan bo, du lieu giu nguyen:', err.message);
    process.exit(1);
  }

  console.log('');
  console.log('='.repeat(84));
  if (GOP) console.log(`XONG. Da gop + XOA loai "${nguon.TenLoaiVai}" (${TU_MA || 'chua co ma'}); du lieu nay gio thuoc "${dich.TenLoaiVai}" (${DEN_MA || 'chua co ma'}).`);
  else console.log(`XONG. Da doi ma loai vai "${nguon.TenLoaiVai}": ${TU} -> ${DEN}.`);
  console.log(`   Ma vai doi: ${doiVai.length}${GOP ? ` | ma vai gop+xoa: ${gopVai.length}` : ''} | ma cay doi: ${soCayDoiMa}`);
  if (soCayDoiMa) console.log('   NHO IN LAI TEM cho cac cay vua doi ma.');
  console.log('Kiem tra: Kho vai > Ton kho / Ton theo cay (bam F5).');
  process.exit(0);
}

main().catch(err => { console.error('\nLOI:', err.message); console.error(err); process.exit(1); });
