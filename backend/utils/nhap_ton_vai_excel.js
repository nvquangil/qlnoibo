// v5.86 — NHAP TON KHO VAI (theo cay) TU FILE EXCEL
//
// Chay TRONG thu muc backend (may chu, khong qua trinh duyet):
//
//   node utils/nhap_ton_vai_excel.js "D:\the_kho_vai_cay.xlsx"
//        -> XEM TRUOC: doc file, do cot, kiem tra tung dong. KHONG ghi gi vao database.
//
//   node utils/nhap_ton_vai_excel.js "D:\the_kho_vai_cay.xlsx" --ghi
//        -> GHI THAT: tao 1 PHIEU NHAP KHO VAI + toan bo cay vai trong file.
//
// Tuy chon:
//   --ghi                 ghi that (mac dinh chi xem truoc)
//   --sheet "Ten sheet"   chon sheet (mac dinh: sheet dau tien)
//   --ngay 2026-07-01     ngay nhap cho phieu + cho dong thieu cot "Ngay nhap" (mac dinh: hom nay)
//   --ghichu "Ton dau ky" ghi chu dau phieu
//   --dung-kg-nhap        lay so luong tu cot "KG nhap" (mac dinh: uu tien cot "KG con" neu co)
//   --tao-danhmuc         TU TAO Loai vai / Mau chua co trong danh muc (mac dinh: bao loi, khong tao)
//   --bo-macay            BO qua ma cay trong file, de he thong tu sinh ma moi
//   --taomau "D:\mau.xlsx"  chi tao 1 FILE MAU trong (dung header dung chuan) roi thoat
//
// NGUYEN TAC AN TOAN
//   - Chay khong co --ghi thi TUYET DOI khong dong vao database.
//   - Ma cay da co trong kho -> BO QUA dong do (khong bao gio ghi de tren cay dang co ton/da xuat).
//   - Toan bo cay vao CUNG 1 phieu nhap -> nhap sai chi can vao "Kho vai > Nhap kho" xoa dung phieu do.
//   - Dung lai y het logic cua man hinh Nhap kho: tu tim/tao Ma vai (LoaiVai + Mau), sinh Ma cay theo
//     quy tac <MaVai><ddmmyy><seq>, sinh QR - nen du lieu nhap tu Excel giong het du lieu nhap tay.

const path = require('path');
const XLSX = require('xlsx');
const { sql, getPool } = require('../db');

// ---------------------------------------------------------------- tien ich
function boDau(s) {
  return String(s == null ? '' : s)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

// Chuoi so kieu Viet ("1.234,5") lan kieu Anh ("1,234.5") deu doc duoc.
function soThuc(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  let t = String(v).replace(/[^\d.,-]/g, '').trim();
  if (!t) return null;
  const cham = t.lastIndexOf('.'), phay = t.lastIndexOf(',');
  if (cham >= 0 && phay >= 0) {
    if (phay > cham) t = t.replace(/\./g, '').replace(',', '.');   // 1.234,5
    else t = t.replace(/,/g, '');                                   // 1,234.5
  } else if (phay >= 0) {
    t = t.replace(',', '.');
  }
  const n = parseFloat(t);
  return isFinite(n) ? n : null;
}

// Ngay: nhan Date (cellDates) hoac chuoi dd/mm/yyyy, yyyy-mm-dd.
function ngayISO(v) {
  if (!v) return null;
  if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10);
  const t = String(v).trim();
  let m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m) return `${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
  m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
  const d = new Date(t);
  return isNaN(d) ? null : d.toISOString().slice(0, 10);
}

// Doc tham so dong lenh: co-gia-tri (--sheet X) va co-hay-khong (--ghi). Duong dan file la tham so
// TU DO dau tien (khong bat dau bang --, va khong phai gia tri cua mot tuy chon co-gia-tri).
function docThamSo() {
  const args = process.argv.slice(2);
  const COGIATRI = ['--sheet', '--ngay', '--ghichu', '--taomau'];
  const ts = { file: null, ghi: false, sheet: null, ngay: null, ghiChu: null, dungKgNhap: false, taoDanhMuc: false, boMaCay: false, taoMau: null };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (COGIATRI.includes(a)) {
      const v = args[++i];
      if (a === '--sheet') ts.sheet = v;
      else if (a === '--ngay') ts.ngay = v;
      else if (a === '--ghichu') ts.ghiChu = v;
      else if (a === '--taomau') ts.taoMau = v;
    } else if (a === '--ghi') ts.ghi = true;
    else if (a === '--dung-kg-nhap') ts.dungKgNhap = true;
    else if (a === '--tao-danhmuc') ts.taoDanhMuc = true;
    else if (a === '--bo-macay') ts.boMaCay = true;
    else if (a.startsWith('--')) console.log('Bo qua tuy chon la: ' + a);
    else if (!ts.file) ts.file = a;
  }
  return ts;
}

// ---------------------------------------------------- do cot theo TEN TIEU DE
// Moi truong nhan nhieu cach viet khac nhau (khong dau, hoa/thuong, thua khoang trang deu khop).
const TU_DIEN_COT = {
  maCay: ['ma cay', 'macay', 'ma cuon', 'ma cay vai'],
  maVai: ['ma vai', 'mavai'],
  maLoai: ['ma loai', 'maloai'],
  maPM: ['ma pm', 'mapm', 'ma nha cung cap'],
  loaiVai: ['loai vai', 'ten loai vai', 'chat lieu', 'ten vai'],
  mau: ['mau', 'ten mau', 'mau sac', 'mau vai'],
  kgNhap: ['kg nhap', 'so kg nhap', 'kg', 'so kg', 'khoi luong', 'trong luong'],
  kgCon: ['kg con', 'kg con lai', 'ton kg', 'so kg con'],
  khoVai: ['kho vai', 'kho', 'kho thuc te'],
  gsm: ['gsm', 'dinh luong'],
  soMet: ['so met', 'met', 'so m', 'chieu dai'],
  donGia: ['don gia', 'gia', 'don gia nhap'],
  viTriKho: ['vi tri kho', 'vi tri', 'ke', 'khu vuc'],
  ngayNhap: ['ngay nhap', 'ngay']
};

// KHONG BAO GIO tu dong gan cac cot nay vao bat ky truong nao. Quan trong nhat la "KG da xuat":
// o vong khop-chua ben duoi, "kg da xuat" bat dau bang "kg" nen neu file THIEU cot "KG nhap" thi no
// se bi hieu nham thanh so luong nhap -> nhap sai toan bo ton kho.
const COT_CAM = ['kg da xuat', 'so kg da xuat', 'trang thai', 'tinh trang', 'ghi chu', 'stt'];

function doCot(headers) {
  const map = {};
  const dung = new Set();   // 1 cot chi gan cho 1 truong
  const duyet = (khopChua) => headers.forEach((h) => {
    const k = boDau(h);
    if (!k || dung.has(h) || COT_CAM.includes(k)) return;
    for (const [truong, ds] of Object.entries(TU_DIEN_COT)) {
      if (map[truong]) continue;
      const khop = khopChua ? ds.some(t => k.startsWith(t) || k.includes(t)) : ds.includes(k);
      if (khop) { map[truong] = h; dung.add(h); return; }
    }
  });
  duyet(false);   // vong 1: khop CHINH XAC ten cot
  duyet(true);    // vong 2: khop "chua" (vd "KG nhập (kg)") cho nhung truong con thieu
  return map;
}

// ------------------------------------------------------------- danh muc
// maLoaiFile: neu file co cot "Ma loai" (vd CTT4C) thi UU TIEN tra cuu theo ma - chinh xac tuyet doi,
// khong phu thuoc cach go ten; va khi TAO MOI thi giu dung ma do thay vi tu bia ma khac.
async function timLoaiVai(pool, ten, taoMoi, maLoaiFile) {
  if (maLoaiFile) {
    const rm = await pool.request().input('m', sql.NVarChar, maLoaiFile)
      .query('SELECT LoaiVaiID, TenLoaiVai, MaLoai FROM LoaiVai WHERE LOWER(LTRIM(RTRIM(MaLoai))) = LOWER(LTRIM(RTRIM(@m)))');
    if (rm.recordset.length) return rm.recordset[0];
  }
  const r = await pool.request().input('t', sql.NVarChar, ten)
    .query('SELECT LoaiVaiID, TenLoaiVai, MaLoai FROM LoaiVai WHERE LOWER(LTRIM(RTRIM(TenLoaiVai))) = LOWER(LTRIM(RTRIM(@t)))');
  if (r.recordset.length) return r.recordset[0];
  if (!taoMoi) return null;
  // Ma loai: dung ma trong file neu co va chua bi dung; neu khong thi lay chu cai dau cua tung tu.
  const goc = maLoaiFile || ((boDau(ten).split(' ').map(w => w[0] || '').join('') || 'LV').toUpperCase().slice(0, 6));
  let ma = goc, i = 1;
  while (true) {
    const d = await pool.request().input('m', sql.NVarChar, ma).query('SELECT LoaiVaiID FROM LoaiVai WHERE MaLoai=@m');
    if (!d.recordset.length) break;
    ma = goc + (++i);
  }
  const ins = await pool.request().input('t', sql.NVarChar, ten).input('m', sql.NVarChar, ma)
    .query('INSERT INTO LoaiVai (TenLoaiVai, MaLoai) OUTPUT INSERTED.LoaiVaiID, INSERTED.TenLoaiVai, INSERTED.MaLoai VALUES (@t, @m)');
  return ins.recordset[0];
}

async function timMauSac(pool, ten, taoMoi) {
  const r = await pool.request().input('t', sql.NVarChar, ten)
    .query('SELECT MauSacID, TenMau, MaMau FROM MauSac WHERE LOWER(LTRIM(RTRIM(TenMau))) = LOWER(LTRIM(RTRIM(@t)))');
  if (r.recordset.length) return r.recordset[0];
  if (!taoMoi) return null;
  const goc = (boDau(ten).split(' ').map(w => w[0] || '').join('') || 'M').toUpperCase().slice(0, 6);
  let ma = goc, i = 1;
  while (true) {
    const d = await pool.request().input('m', sql.NVarChar, ma).query('SELECT MauSacID FROM MauSac WHERE MaMau=@m');
    if (!d.recordset.length) break;
    ma = goc + (++i);
  }
  const ins = await pool.request().input('t', sql.NVarChar, ten).input('m', sql.NVarChar, ma)
    .query('INSERT INTO MauSac (MaMau, TenMau) OUTPUT INSERTED.MauSacID, INSERTED.TenMau, INSERTED.MaMau VALUES (@m, @t)');
  return ins.recordset[0];
}

// Ban sao Y HET resolveOrCreateVaiId() trong routes/khovai.js — de ma vai sinh ra tu Excel giong
// het ma vai sinh ra khi nhap tay. SUA 1 CHO THI PHAI SUA CA 2.
// maVaiFile: neu file co san cot "Ma vai" (vd CTT4C-DOTUOI178) va ma do CHUA co trong danh muc thi
// TAO DUNG MA DO — nho vay "Ma cay" san trong file (von = <MaVai><ddmmyy><seq>) van khop voi ma vai,
// dac biet quan trong khi nhap ton vao mot database moi/trong.
async function timHoacTaoMaVai(pool, loaiVaiId, mauSacId, maVaiFile) {
  const existing = await pool.request().input('lv', sql.Int, loaiVaiId).input('ms', sql.Int, mauSacId)
    .query('SELECT VaiID, MaVai FROM DanhMucVai WHERE LoaiVaiID=@lv AND MauSacID=@ms');
  if (existing.recordset.length) return existing.recordset[0];
  const lv = await pool.request().input('id', sql.Int, loaiVaiId).query('SELECT MaLoai FROM LoaiVai WHERE LoaiVaiID=@id');
  const ms = await pool.request().input('id', sql.Int, mauSacId).query('SELECT MaMau FROM MauSac WHERE MauSacID=@id');
  const baseCode = maVaiFile
    || (((lv.recordset[0] && lv.recordset[0].MaLoai) || 'VAI') + '-' + ((ms.recordset[0] && ms.recordset[0].MaMau) || 'MAU'));
  let candidate = baseCode, seq = 1;
  while (true) {
    const dup = await pool.request().input('m', sql.NVarChar, candidate).query('SELECT VaiID FROM DanhMucVai WHERE MaVai=@m');
    if (!dup.recordset.length) break;
    seq++;
    candidate = baseCode + '-' + seq;
  }
  const ins = await pool.request().input('MaVai', sql.NVarChar, candidate).input('LoaiVaiID', sql.Int, loaiVaiId).input('MauSacID', sql.Int, mauSacId)
    .query('INSERT INTO DanhMucVai (MaVai, LoaiVaiID, MauSacID) OUTPUT INSERTED.VaiID, INSERTED.MaVai VALUES (@MaVai, @LoaiVaiID, @MauSacID)');
  return ins.recordset[0];
}

// -------------------------------------------------------------- file mau
async function taoFileMau(duongDan) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ['Mã cây', 'Loại vải', 'Màu', 'KG nhập', 'Khổ vải', 'GSM', 'Số mét', 'Đơn giá', 'Vị trí kho', 'Ngày nhập'],
    ['', 'Thun cotton 4 chiều', 'Đen', 25.5, 1.6, 220, 40, 85000, 'Kệ A1', '01/07/2026'],
    ['', 'Thun cotton 4 chiều', 'Trắng', 30, 1.6, 220, 47, 85000, 'Kệ A1', '01/07/2026']
  ]);
  ws['!cols'] = [{ wch: 16 }, { wch: 26 }, { wch: 16 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Ton vai cay');
  XLSX.writeFile(wb, duongDan);
  console.log('Da tao file mau: ' + duongDan);
  console.log('Cot "Mã cây" de TRONG thi he thong tu sinh ma; dien san thi dung dung ma do (khong duoc trung).');
}

// ------------------------------------------------------------------ main
async function main() {
  const ts = docThamSo();

  if (ts.taoMau) { await taoFileMau(ts.taoMau); process.exit(0); }

  if (!ts.file) {
    console.log('Thieu duong dan file Excel.\n');
    console.log('  node utils/nhap_ton_vai_excel.js "D:\\the_kho_vai_cay.xlsx"        (xem truoc)');
    console.log('  node utils/nhap_ton_vai_excel.js "D:\\the_kho_vai_cay.xlsx" --ghi  (ghi that)');
    console.log('  node utils/nhap_ton_vai_excel.js --taomau "D:\\mau_ton_vai.xlsx"   (tao file mau)');
    process.exit(1);
  }

  const duongDan = path.resolve(ts.file);
  const wb = XLSX.readFile(duongDan, { cellDates: true });
  const tenSheet = ts.sheet || wb.SheetNames[0];
  const ws = wb.Sheets[tenSheet];
  if (!ws) { console.log(`Khong thay sheet "${tenSheet}". Cac sheet co trong file: ${wb.SheetNames.join(', ')}`); process.exit(1); }

  const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false, dateNF: 'dd/mm/yyyy' });
  if (!rows.length) { console.log('Sheet khong co dong du lieu nao.'); process.exit(1); }

  const headers = Object.keys(rows[0]);
  const cot = doCot(headers);

  console.log('='.repeat(78));
  console.log('FILE   : ' + duongDan);
  console.log('SHEET  : ' + tenSheet + `  (${rows.length} dong)`);
  console.log('CHE DO : ' + (ts.ghi ? '*** GHI THAT VAO DATABASE ***' : 'XEM TRUOC (khong ghi gi)'));
  console.log('-'.repeat(78));
  console.log('DO COT (tieu de trong file -> truong trong phan mem):');
  ['maCay', 'maVai', 'loaiVai', 'mau', 'kgNhap', 'kgCon', 'khoVai', 'gsm', 'soMet', 'donGia', 'viTriKho', 'ngayNhap', 'maPM']
    .forEach(k => console.log(`   ${k.padEnd(10)} <- ${cot[k] ? '"' + cot[k] + '"' : '(khong co trong file)'}`));

  // Cot so luong: mac dinh uu tien "KG con" vi day la NHAP TON KHO (so con lai thuc te).
  const cotSL = ts.dungKgNhap ? (cot.kgNhap || cot.kgCon) : (cot.kgCon || cot.kgNhap);
  // File xuat tu phan mem co CA "KG nhap" lan "KG con". Neu nguoi dung chi go so vao 1 trong 2 cot thi
  // cot con lai se rong -> lay cot du phong THEO TUNG DONG thay vi bo qua ca dong (loi hay gap nhat).
  const cotSLPhu = (cotSL === cot.kgCon) ? cot.kgNhap : cot.kgCon;
  if (!cotSL) { console.log('\nKHONG THAY cot so luong (KG nhap / KG con). Dung --taomau de xem file mau chuan.'); process.exit(1); }
  console.log(`\nSO LUONG lay tu cot: "${cotSL}"` + (ts.dungKgNhap ? '  (do co --dung-kg-nhap)' : '  (uu tien KG con; them --dung-kg-nhap de doi)'));
  if (cotSLPhu) console.log(`   (dong nao cot do TRONG thi lay tam tu cot "${cotSLPhu}")`);
  if (!cot.loaiVai || !cot.mau) {
    if (!cot.maVai) { console.log('\nTHIEU cot "Loai vai" + "Mau" (hoac cot "Ma vai"). Khong the xac dinh vai cua tung cay.'); process.exit(1); }
  }

  const pool = await getPool();
  const ngayMacDinh = ngayISO(ts.ngay) || new Date().toISOString().slice(0, 10);

  // ---- Kiem tra tung dong (chay ca o che do xem truoc) ----
  const hopLe = [], boQua = [];
  const maCayTrongFile = new Set();
  const cacheVai = new Map();       // 'loai||mau' hoac 'mavai:X' -> {VaiID, MaVai}
  const thieuDanhMuc = new Set();
  let soDongDungCotPhu = 0;         // so dong phai lay so luong tu cot du phong

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const dong = i + 2;   // +2: dong 1 la tieu de, Excel dem tu 1
    // Chi lay cot du phong khi o CHINH BO TRONG. Neu o chinh ghi ro so 0 (vd "KG con = 0" cua cay da
    // dung het) thi PHAI giu 0 -> dong do bi bo qua, KHONG duoc nhay sang "KG nhap" ma nhap lai ca cay.
    const oChinh = r[cotSL];
    const oChinhTrong = (oChinh == null || String(oChinh).trim() === '');
    let kg = soThuc(oChinh);
    let cotDaDung = cotSL;
    if (oChinhTrong && cotSLPhu) {
      const k2 = soThuc(r[cotSLPhu]);
      if (k2 > 0) { kg = k2; cotDaDung = cotSLPhu; soDongDungCotPhu++; }
    }
    const maCay = ts.boMaCay ? '' : String(cot.maCay ? (r[cot.maCay] || '') : '').trim();
    const tenLoai = String(cot.loaiVai ? (r[cot.loaiVai] || '') : '').trim();
    const tenMau = String(cot.mau ? (r[cot.mau] || '') : '').trim();
    const maVaiFile = String(cot.maVai ? (r[cot.maVai] || '') : '').trim();
    const maLoaiFile = String(cot.maLoai ? (r[cot.maLoai] || '') : '').trim();

    if (!kg || kg <= 0) { boQua.push({ dong, lyDo: `so luong trong/bang 0 (cot "${cotSL}"${cotSLPhu ? ' va "' + cotSLPhu + '"' : ''})` }); continue; }

    // 1) Xac dinh ma vai: uu tien cot "Ma vai" (chinh xac tuyet doi), sau do (Loai vai + Mau).
    let vai = null;
    if (maVaiFile) {
      const key = 'mavai:' + maVaiFile.toLowerCase();
      if (cacheVai.has(key)) vai = cacheVai.get(key);
      else {
        const q = await pool.request().input('m', sql.NVarChar, maVaiFile)
          .query('SELECT VaiID, MaVai FROM DanhMucVai WHERE LOWER(LTRIM(RTRIM(MaVai))) = LOWER(LTRIM(RTRIM(@m)))');
        if (q.recordset.length) { vai = q.recordset[0]; cacheVai.set(key, vai); }
      }
    }
    if (!vai) {
      if (!tenLoai || !tenMau) { boQua.push({ dong, lyDo: 'thieu Loai vai hoac Mau (va Ma vai khong tra cuu duoc)' }); continue; }
      const key = boDau(tenLoai) + '||' + boDau(tenMau);
      if (cacheVai.has(key)) vai = cacheVai.get(key);
      else {
        // O che do XEM TRUOC khong tao gi ca; chi khi co --ghi VA --tao-danhmuc moi thuc su tao.
        const lv = await timLoaiVai(pool, tenLoai, ts.ghi && ts.taoDanhMuc, maLoaiFile);
        const ms = await timMauSac(pool, tenMau, ts.ghi && ts.taoDanhMuc);
        if (!lv) thieuDanhMuc.add('Loai vai: ' + tenLoai);
        if (!ms) thieuDanhMuc.add('Mau: ' + tenMau);
        if ((!lv || !ms) && !ts.taoDanhMuc) {
          boQua.push({ dong, lyDo: 'chua co trong danh muc: ' + (!lv ? `loai vai "${tenLoai}" ` : '') + (!ms ? `mau "${tenMau}"` : '') });
          continue;
        }
        if (!lv || !ms) {
          // Dang xem truoc + co --tao-danhmuc: coi nhu hop le, se tao khi chay that.
          vai = { VaiID: null, MaVai: maVaiFile || '(se tu tao)', tenLoaiMoi: tenLoai, tenMauMoi: tenMau, maLoaiMoi: maLoaiFile };
        } else {
          vai = ts.ghi ? await timHoacTaoMaVai(pool, lv.LoaiVaiID, ms.MauSacID, maVaiFile)
                       : { VaiID: null, MaVai: maVaiFile || '(se tu tao neu chua co)', LoaiVaiID: lv.LoaiVaiID, MauSacID: ms.MauSacID };
        }
        cacheVai.set(key, vai);
      }
    }

    // 2) Ma cay: khong duoc trung trong file lan trong kho.
    if (maCay) {
      if (maCay.length > 50) { boQua.push({ dong, lyDo: `ma cay "${maCay}" dai qua 50 ky tu` }); continue; }
      if (maCayTrongFile.has(maCay.toLowerCase())) { boQua.push({ dong, lyDo: `ma cay "${maCay}" bi TRUNG ngay trong file` }); continue; }
      const trung = await pool.request().input('m', sql.NVarChar, maCay).query('SELECT TOP 1 MaCay FROM VaiCay WHERE MaCay=@m');
      if (trung.recordset.length) { boQua.push({ dong, lyDo: `ma cay "${maCay}" DA CO trong kho` }); continue; }
      maCayTrongFile.add(maCay.toLowerCase());
    }

    hopLe.push({
      dong, maCay, vai, tenLoai, tenMau, kg, cotDaDung, maVaiFile, maLoaiFile,
      khoVai: cot.khoVai ? soThuc(r[cot.khoVai]) : null,
      gsm: cot.gsm ? soThuc(r[cot.gsm]) : null,
      soMet: cot.soMet ? soThuc(r[cot.soMet]) : null,
      donGia: cot.donGia ? soThuc(r[cot.donGia]) : null,
      viTriKho: cot.viTriKho ? String(r[cot.viTriKho] || '').trim() : '',
      ngayNhap: (cot.ngayNhap ? ngayISO(r[cot.ngayNhap]) : null) || ngayMacDinh
    });
  }

  console.log('-'.repeat(78));
  console.log(`KET QUA KIEM TRA: ${hopLe.length} dong hop le / ${rows.length} dong trong file`);
  if (soDongDungCotPhu) console.log(`   (${soDongDungCotPhu} dong lay so luong tu cot du phong "${cotSLPhu}" vi cot "${cotSL}" de trong)`);
  if (thieuDanhMuc.size) {
    console.log('\nCHUA CO TRONG DANH MUC (' + thieuDanhMuc.size + '):');
    [...thieuDanhMuc].slice(0, 40).forEach(t => console.log('   - ' + t));
    console.log('   => Khai truoc o phan he Danh muc, HOAC chay lai kem --tao-danhmuc de he thong tu tao.');
  }
  if (boQua.length) {
    console.log(`\nBO QUA ${boQua.length} dong:`);
    boQua.slice(0, 40).forEach(b => console.log(`   - dong ${b.dong}: ${b.lyDo}`));
    if (boQua.length > 40) console.log(`   ... va ${boQua.length - 40} dong nua`);
  }
  if (hopLe.length) {
    console.log('\n5 dong dau se nhap:');
    hopLe.slice(0, 5).forEach(h => console.log(
      `   dong ${String(h.dong).padEnd(4)} | ${(h.maCay || '(tu sinh)').padEnd(18)} | ${(h.tenLoai || h.vai.MaVai).slice(0, 24).padEnd(24)} | ${(h.tenMau || '').slice(0, 12).padEnd(12)} | ${h.kg} kg` +
      (h.soMet ? ` | ${h.soMet} m` : '') + (h.viTriKho ? ` | ${h.viTriKho}` : '')));
    const tongKg = hopLe.reduce((s, h) => s + h.kg, 0);
    console.log(`\n   TONG: ${hopLe.length} cay, ${tongKg.toFixed(2)} kg`);
  }

  if (!ts.ghi) {
    console.log('\n' + '='.repeat(78));
    console.log('DAY CHI LA XEM TRUOC — CHUA GHI GI VAO DATABASE.');
    console.log('Kiem tra ky bang tren, thay dung roi thi chay lai kem  --ghi');
    process.exit(0);
  }
  if (!hopLe.length) { console.log('\nKhong co dong nao hop le de ghi.'); process.exit(1); }

  // ---- GHI THAT: 1 phieu nhap + N cay vai ----
  const ghiChu = ts.ghiChu || ('Nhap ton dau ky tu Excel: ' + path.basename(duongDan));
  // Cot dang nhap cua bang Users la "Username" (KHONG phai TenDangNhap - do la bang TaiKhoanKhach).
  const nguoiTao = (await pool.request().query("SELECT TOP 1 UserID FROM Users WHERE Username='admin' ORDER BY UserID")).recordset[0]
    || (await pool.request().query('SELECT TOP 1 UserID FROM Users ORDER BY UserID')).recordset[0];

  const phieu = await pool.request()
    .input('NgayNhap', sql.Date, ngayMacDinh)
    .input('GhiChu', sql.NVarChar, ghiChu)
    .input('NguoiTaoID', sql.Int, nguoiTao ? nguoiTao.UserID : null)
    .query(`INSERT INTO PhieuNhapVai (NgayNhap, GhiChu, NguoiTaoID)
            OUTPUT INSERTED.PhieuNhapID VALUES (@NgayNhap, @GhiChu, @NguoiTaoID)`);
  const phieuNhapId = phieu.recordset[0].PhieuNhapID;
  console.log('\nDa tao PHIEU NHAP #' + phieuNhapId + ' (ngay ' + ngayMacDinh + ')');

  let daGhi = 0;
  for (const h of hopLe) {
    // Bao dam co VaiID (dong duoc danh dau "se tu tao" o vong kiem tra thi tao that o day).
    if (!h.vai.VaiID) {
      let lvId = h.vai.LoaiVaiID, msId = h.vai.MauSacID;
      if (!lvId || !msId) {
        const lv = await timLoaiVai(pool, h.vai.tenLoaiMoi || h.tenLoai, ts.taoDanhMuc, h.maLoaiFile);
        const ms = await timMauSac(pool, h.vai.tenMauMoi || h.tenMau, ts.taoDanhMuc);
        if (!lv || !ms) { console.log(`   BO QUA dong ${h.dong}: chua co loai vai/mau trong danh muc.`); continue; }
        lvId = lv.LoaiVaiID; msId = ms.MauSacID;
      }
      h.vai = await timHoacTaoMaVai(pool, lvId, msId, h.maVaiFile);
    }

    let maCay = h.maCay;
    if (!maCay) {
      // Sinh ma theo dung quy tac cua man hinh Nhap kho: <MaVai><ddmmyy><so thu tu 3 chu so>
      const d = new Date(h.ngayNhap);
      const dateCode = String(d.getDate()).padStart(2, '0') + String(d.getMonth() + 1).padStart(2, '0') + String(d.getFullYear()).slice(-2);
      const prefix = h.vai.MaVai + dateCode;
      const daCo = await pool.request().input('p', sql.NVarChar, prefix + '%').query('SELECT MaCay FROM VaiCay WHERE MaCay LIKE @p');
      const nums = daCo.recordset.map(x => parseInt(String(x.MaCay).replace(prefix, ''), 10) || 0);
      maCay = prefix + String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, '0');
    }

    await pool.request()
      .input('MaCay', sql.NVarChar, maCay)
      .input('PhieuNhapID', sql.Int, phieuNhapId)
      .input('VaiID', sql.Int, h.vai.VaiID)
      .input('KhoVaiThucTe', sql.Decimal(10, 2), h.khoVai)
      .input('GSM', sql.Decimal(10, 2), h.gsm)
      .input('KGNhap', sql.Decimal(10, 2), h.kg)
      .input('SoMet', sql.Decimal(10, 2), h.soMet)
      .input('QRCode', sql.NVarChar, 'https://quickchart.io/qr?text=' + encodeURIComponent(maCay))
      .input('ViTriKho', sql.NVarChar, h.viTriKho || null)
      .input('NgayNhap', sql.Date, h.ngayNhap)
      .input('DonGiaNhap', sql.Decimal(14, 2), h.donGia)
      .query(`INSERT INTO VaiCay (MaCay, PhieuNhapID, VaiID, KhoVaiThucTe, GSM, KGNhap, SoMet, QRCode, ViTriKho, NgayNhap, DonGiaNhap)
              VALUES (@MaCay, @PhieuNhapID, @VaiID, @KhoVaiThucTe, @GSM, @KGNhap, @SoMet, @QRCode, @ViTriKho, @NgayNhap, @DonGiaNhap)`);
    daGhi++;
    if (daGhi % 50 === 0) console.log('   ... da ghi ' + daGhi + ' cay');
  }

  console.log('\n' + '='.repeat(78));
  console.log(`XONG. Da nhap ${daGhi} cay vai vao PHIEU NHAP #${phieuNhapId}.`);
  console.log('Kiem tra o: Quan ly kho vai > Nhap kho (phieu #' + phieuNhapId + ') va tab "Ton theo cay".');
  console.log('NEU NHAP SAI: vao dung phieu #' + phieuNhapId + ' bam Xoa — se xoa het cay cua phieu nay');
  console.log('(chi xoa duoc khi cac cay do CHUA bi xuat kho).');
  process.exit(0);
}

main().catch(err => { console.error('\nLOI:', err.message); console.error(err); process.exit(1); });
