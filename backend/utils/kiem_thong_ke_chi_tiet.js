/* ================================================================================================
   KIEM CHUNG v7.65 — THONG KE CHI TIET (Tai lieu may / Dong goi)
   ------------------------------------------------------------------------------------------------
   ⚠️ PHAT HIEN QUAN TRONG cua ban nay: cot "Piece Image" trong file khach gui KHONG CHUA ANH.
   File khong co `xl/media/` nao — no chua 16 hinh **Freeform** cua Excel (duong rap ve bang duong
   gap khuc), neo vao tung dong. `exceljs.getImages()` chi tra ve `<xdr:pic>` nen voi file nay no ra
   RONG. Neu tin vao thu vien thi cot anh se trong tron ma khong ai hieu tai sao.
   Test nay CHAY THAT bo trich hinh tren CHINH FILE KHACH GUI va tren file tu tao.

   Chay:  node utils/kiem_thong_ke_chi_tiet.js
   ================================================================================================ */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const G = path.join(__dirname, '..');
const doc = (p) => fs.readFileSync(path.join(G, p), 'utf8');

let dat = 0, truot = 0;
const OK = (m) => { dat++; console.log('  OK   ' + m); };
const NO = (m) => { truot++; console.log('  SAI  ' + m); };
const kiem = (dk, m, them) => (dk ? OK(m) : NO(m + (them ? '  -> ' + them : '')));
const bang = (thuc, mong, m) => kiem(JSON.stringify(thuc) === JSON.stringify(mong), `${m}  [duoc: ${JSON.stringify(thuc)}]`);
/* ⚠️ `accept="image/*"` co chua "/*" — bo chu thich kieu ngay tho se NUOT ca doan sau no va bao
   "ham khong ton tai" oan (da mac dung bay nay khi lam ban nay). Vo hieu no TRUOC. */
const bo = (s) => String(s).replace(/image\/\*/g, 'image_ALL')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const sUtilTk = doc('utils/docThongKeChiTietExcel.js');
const sUtilHinh = doc('utils/docHinhVeExcel.js');
const sZip = doc('utils/zipDocFile.js');
const sRoute = doc('routes/tailieukythuat.js');
const sFe = doc('../frontend/js/module.tailieukythuat.js');
const sMig = doc('../database/migration_v695.sql');
const sCaiDat = doc('../database/CAI_DAT_DAY_DU.sql');
const sIndex = doc('../frontend/index.html');

let ExcelJS = null;
try { ExcelJS = require('exceljs'); } catch (e) { /* sandbox */ }
const { docZip } = require('./zipDocFile');
const { docHinhVeTheoDong } = require('./docHinhVeExcel');
const { docThongKeChiTietExcel } = require('./docThongKeChiTietExcel');

const FILE_KHACH = '/sessions/friendly-relaxed-ramanujan/mnt/uploads/thong ke chi tiet.xlsx';

(async () => {
  console.log('\n=== 1. Bo doc ZIP tu viet (chi dung zlib) ===');
  /* Tu dung mot file ZIP nho de kiem, khong phu thuoc file ben ngoai. */
  const noiDung = Buffer.from('<xml>xin chao</xml>', 'utf8');
  const nen = zlib.deflateRawSync(noiDung);
  const ten = Buffer.from('a/b.xml', 'utf8');
  const crc = 0;
  const loc = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x03, 0x04, 20, 0, 0, 0, 8, 0, 0, 0, 0, 0]),
    (() => { const b = Buffer.alloc(12); b.writeUInt32LE(crc, 0); b.writeUInt32LE(nen.length, 4); b.writeUInt32LE(noiDung.length, 8); return b; })(),
    (() => { const b = Buffer.alloc(4); b.writeUInt16LE(ten.length, 0); b.writeUInt16LE(0, 2); return b; })(),
    ten, nen
  ]);
  const cen = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x01, 0x02, 20, 0, 20, 0, 0, 0, 8, 0, 0, 0, 0, 0]),
    (() => { const b = Buffer.alloc(12); b.writeUInt32LE(crc, 0); b.writeUInt32LE(nen.length, 4); b.writeUInt32LE(noiDung.length, 8); return b; })(),
    (() => { const b = Buffer.alloc(14); b.writeUInt16LE(ten.length, 0); return b; })(),
    (() => { const b = Buffer.alloc(4); b.writeUInt32LE(0, 0); return b; })(),
    ten
  ]);
  const eocd = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x05, 0x06, 0, 0, 0, 0]),
    (() => { const b = Buffer.alloc(12); b.writeUInt16LE(1, 0); b.writeUInt16LE(1, 2); b.writeUInt32LE(cen.length, 4); b.writeUInt32LE(loc.length, 8); return b; })(),
    Buffer.from([0, 0])
  ]);
  const zipThu = Buffer.concat([loc, cen, eocd]);
  const cacFile = docZip(zipThu);
  bang(cacFile.get('a/b.xml') ? cacFile.get('a/b.xml').toString('utf8') : null, '<xml>xin chao</xml>',
    'giai nen dung noi dung file ben trong ZIP');
  bang(docZip(zipThu, (t) => t === 'khong-co').size, 0, 'bo loc hoat dong (chi giai nen file can)');
  let loiZip = null;
  try { docZip(Buffer.from('khong phai zip')); } catch (e) { loiZip = e.message; }
  kiem(!!loiZip && /ZIP\/XLSX/.test(loiZip), 'khong phai ZIP -> bao ro', String(loiZip));

  console.log('\n=== 2. CHAY THAT tren FILE KHACH GUI ===');
  if (!fs.existsSync(FILE_KHACH)) {
    console.log('  (bo qua: khong con file trong thu muc uploads)');
  } else {
    const buf = fs.readFileSync(FILE_KHACH);
    /* 2a. Khang dinh dieu quan trong nhat: file KHONG co anh nhung CO hinh ve. */
    const tepTrong = docZip(buf, () => true);
    const coMedia = [...tepTrong.keys()].some(k => k.indexOf('xl/media/') === 0);
    const coDrawing = [...tepTrong.keys()].some(k => /^xl\/drawings\/drawing\d+\.xml$/.test(k));
    kiem(!coMedia, 'file KHONG co xl/media/ -> khong phai anh dan vao (thu vien doc anh se ra rong)');
    kiem(coDrawing, 'nhung CO xl/drawings/ -> hinh ve Freeform, phai tu trich');

    const hinh = docHinhVeTheoDong(buf, 'xl/worksheets/sheet1.xml');
    bang(hinh.theoDong.size, 8, 'trich duoc hinh cho DU 8 dong');
    bang(hinh.lenhLa, [], 'khong co net cong -> doi sang SVG khong mat net');
    /* Moi diem phai nam trong khung nhin, khong thi hinh bi cat mat mot phan. */
    let ngoaiKhung = 0;
    hinh.theoDong.forEach(url => {
      const svg = Buffer.from(url.split(',')[1], 'base64').toString('utf8');
      const vb = /viewBox="([-\d ]+)"/.exec(svg)[1].split(' ').map(Number);
      const pts = [...svg.matchAll(/[ML](-?\d+),(-?\d+)/g)].map(m => [+m[1], +m[2]]);
      if (pts.some(p => p[0] < vb[0] || p[0] > vb[0] + vb[2] || p[1] < vb[1] || p[1] > vb[1] + vb[3])) ngoaiKhung++;
    });
    bang(ngoaiKhung, 0, 'moi diem cua moi hinh deu nam trong khung nhin (khong bi cat)');

    if (ExcelJS) {
      const kq = await docThongKeChiTietExcel(buf);
      bang([kq.dongTieuDe, kq.rows.length, kq.soHinh], [3, 8, 8],
        'FILE KHACH: tieu de dong 3, 8 chi tiet, 8 hinh');
      bang(kq.rows[0].pieceName, 'bo co', 'dong 1 dung ten');
      bang([kq.rows[3].pieceName, kq.rows[3].pair, kq.rows[3].opposite], ['TAY', '1', 'Up/Down'],
        'dong 4 dung ca Cap va Chieu doi xung');
      bang(kq.rows[7].pieceName, 'BO CHAN-x2', 'doc den dong cuoi');
      kiem(kq.rows.every(r => r.anhSvg && r.anhSvg.indexOf('data:image/svg+xml;base64,') === 0),
        'moi dong deu co hinh dang data URL SVG');
      kiem(kq.rows.every(r => r.tongSoLuong === ''),
        'cot Tong so luong de TRONG — file khong co, va he thong KHONG tu tinh (nguoi dung go tay)');
    } else console.log('  (bo qua phan doc o: sandbox chua cai exceljs)');
  }

  console.log('\n=== 3. Cac canh khac ===');
  if (!ExcelJS) console.log('  (bo qua: sandbox chua cai exceljs)');
  else {
    /* File chi co chu, khong co hinh -> van doc duoc cac dong. */
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('S');
    ws.getRow(1).values = [null, 'Piece Name', 'Material', 'Quantity', 'Pair', 'Opposite'];
    ws.getRow(2).values = [1, 'Thân trước', 'Vải chính', '2', '1', 'Up/Down'];
    let kq = await docThongKeChiTietExcel(await wb.xlsx.writeBuffer());
    bang([kq.rows.length, kq.soHinh], [1, 0], 'file khong co hinh -> van doc duoc dong, soHinh = 0');
    bang(kq.rows[0].pieceName, 'Thân trước', 'ten tieng Viet doc dung');

    /* Tieu de TIENG VIET cung nhan. */
    const wb2 = new ExcelJS.Workbook();
    const ws2 = wb2.addWorksheet('S');
    ws2.getRow(4).values = ['TT', 'Tên chi tiết', 'Vật liệu', 'Số lượng', 'Tổng số lượng'];
    ws2.getRow(5).values = [1, 'Cổ', 'Bo', '1', '500'];
    kq = await docThongKeChiTietExcel(await wb2.xlsx.writeBuffer());
    bang([kq.dongTieuDe, kq.rows[0].tongSoLuong], [4, '500'],
      'tieu de TIENG VIET + cot Tong so luong co san trong file thi lay luon');

    /* File khong co bang -> nem loi noi ro. */
    const wb3 = new ExcelJS.Workbook();
    wb3.addWorksheet('X').getRow(1).values = ['abc', 'def'];
    let loi = null;
    try { await docThongKeChiTietExcel(await wb3.xlsx.writeBuffer()); } catch (e) { loi = e.message; }
    kiem(!!loi && /piece name/i.test(loi) && /sheet/i.test(loi),
      'file khong co bang -> nem loi noi ro can o ten gi', String(loi));
  }

  console.log('\n=== 4. Bo trich hinh: khong ve bua ===');
  kiem(/\['cubicBezTo', 'quadBezTo', 'arcTo'\]/.test(sUtilHinh),
    'CO phat hien net cong va bao ra (khong im lang ve thieu net)');
  kiem(/if \(a\.indexOf\('<xdr:sp'\) === -1\) return;/.test(sUtilHinh),
    'bo qua <xdr:pic> va bieu do — chi lay hinh ve');
  kiem(/const qx = \(x\) => oX \+ \(x \/ pW\) \* cX;/.test(sUtilHinh),
    'quy toa do path ve he EMU cua trang -> nhieu hinh cung dong ghep dung vi tri tuong doi');
  kiem(/const nLen2 = buf\.readUInt16LE\(off \+ 26\);/.test(sZip),
    'doc lai do dai ten o LOCAL header (khac central) — lay theo central la tro lech vao giua du lieu');

  console.log('\n=== 5. Route ===');
  const iExcel = sRoute.indexOf("router.post('/thongkechitiet/doc-excel'");
  const iMaDH = sRoute.indexOf("router.get('/thongkechitiet/:maDH/phieu'");
  kiem(iExcel > 0 && iExcel < iMaDH, 'route CHU doc-excel dat TRUOC route :maDH');
  kiem(/router\.get\('\/thongkechitiet\/:maDH\/phieu'/.test(sRoute), 'co route liet ke cac ban');
  kiem(/router\.post\('\/thongkechitiet\/:maDH'/.test(sRoute), 'co route luu');
  kiem(/router\.delete\('\/thongkechitiet\/:maDH'/.test(sRoute), 'co route xoa ban');
  kiem(/fs\.writeFileSync\(path\.join\(uploadDir, ten\)/.test(sRoute),
    'hinh rap duoc GHI RA FILE trong uploads (khong nhet ca anh vao CSDL)');
  kiem(/delete r\.anhSvg;/.test(sRoute), 'khong tra data URL ve trinh duyet (chi tra duong dan)');
  kiem(/const anhMacDinh = await anhDaiDienCuaDon\(pool, order\);/.test(sRoute),
    'anh dai dien mac dinh lay qua ham dung chung anhDaiDienCuaDon()');
  /* Kiem HANH VI chu khong kiem NGUYEN VAN dong chu thich: viec tra anh phai nam trong try/catch,
     de ma chua co the kho khong lam gay ca route. Tu v7.65.3 phan nay nam trong ham dung chung. */
  const thanAnh = sRoute.slice(sRoute.indexOf('async function anhDaiDienCuaDon'),
    sRoute.indexOf('// ============ DANH SACH DON HANG'));
  kiem(/try \{[\s\S]*TheKhoHangHoa[\s\S]*\} catch \(e\) \{ return ''; \}/.test(thanAnh),
    'cau lui ve the kho nam trong try/catch -> khong lam gay route',
    thanAnh.replace(/\s+/g, ' ').slice(0, 120));
  kiem(/lenhLa && kq\.lenhLa\.length/.test(sRoute), 'file co net cong -> CANH BAO cho nguoi dung');

  console.log('\n=== 6. Form + ban in ===');
  const feSach = bo(sFe);
  kiem(/\{ key: 'thongkechitiet', label: 'Thống kê chi tiết' \}/.test(sFe), 'co muc con moi trong Tai lieu may/Dong goi');
  kiem(/activeChild === 'thongkechitiet'\) return openDocBanList/.test(sFe), 'mo danh sach BAN (nhieu ban co ten)');
  kiem(/function openThongKeChiTietEditor\(maDH, tenPhieu, onDone\)/.test(sFe),
    'ham mo editor CO THAT (tab tro toi ham khong ton tai = trang trang)');
  /* Tieu de cot phai la TIENG VIET. */
  ['Tên chi tiết', 'Vật liệu', 'Số lượng', 'Cặp', 'Chiều đối xứng', 'Tổng số lượng', 'Hình chi tiết']
    .forEach(n => kiem(sFe.indexOf(`'${n}'`) > 0 || sFe.indexOf(`>${n}<`) > 0, `tieu de tieng Viet: ${n}`));
  kiem(!/Piece Name<\/th>|>Material<\/th>|>Opposite<\/th>/.test(sFe), 'khong con tieu de tieng Anh tren giao dien');
  /* v7.67: anh khong con dung tay o tung builder nua — moi ban in di qua khoiDauPhieuHtml().
     Kiem CHAY THAT (dung ra HTML roi dem the <img>) nam o utils/kiem_anh_va_marap_ban_in.js. */
  kiem(/khoiDauPhieuHtml\(d\.anhIn,/.test(sFe), 'ban in Thong ke chi tiet dung khoi dau phieu co anh');
  kiem(/anhState\.rieng \|\| anhMacDinh/.test(sFe), 'anh: uu tien anh rieng, khong co thi dung anh ma hang');
  kiem(/tkctAnhVeMacDinh/.test(sFe), 'co nut quay ve dung lai anh cua ma hang');
  kiem(/thongkechitiet\/doc-excel/.test(sFe), 'form goi dung route doc Excel');
  kiem(/coDL && !confirm\('Bảng đang có dữ liệu/.test(sFe), 'bang dang co du lieu -> hoi truoc khi thay');
  /* Hai bay da tung mac: goi ham cua module khac, va o file khong xoa gia tri truoc khi mo. */
  kiem(!/\bopenImageLightbox\s*\(|\bmoAnhTo\s*\(/.test(feSach),
    'KHONG goi ham nam trong module khac (openImageLightbox o module.khohang.js)');
  kiem(/oFile\.value = ''/.test(sFe), 'xoa gia tri o file truoc khi mo (chon lai dung file cu van chay)');
  kiem(/target="_blank"/.test(sFe), 'xem anh to bang tab moi — cung cach voi cac o anh khac trong file nay');

  /* ================================================================================================
     6b. ⚠️ BAY DA MAC THAT (v7.65 -> phai sua o v7.65.1): them mot LOAI tai lieu moi thi phai noi
     day o TAT CA cac bang phan nhanh theo `loai`, khong chi cho editor. Bo sot hai cho:
       · printOneOrderDoc()          -> bam "In" KHONG LAM GI CA (roi het if/else, khong bao loi)
       · getOrdersWithDocStatus()    -> roi xuong nhanh mac dinh (chi dinh NPL) nen cot "Da co" bao
                                        theo bang phu kien => luu xong van hien "chua co"
     Muc nay ep MOI cho re nhanh theo 'thongsodo' thi cung phai co 'thongkechitiet'.
     ================================================================================================ */
  console.log('\n=== 6b. Them loai tai lieu moi: KHONG bo sot bang phan nhanh nao ===');
  const moc = [
    [sRoute, "cnTaiLieuOf", 'backend: nhom quyen (cnTaiLieuOf)'],
    [sRoute, "seg.startsWith('thongkechitiet')", 'backend: suy loai tu duong dan'],
    [sRoute, "loai === 'thongkechitiet'", 'backend: cot "Da co" cua danh sach lenh SX'],
    [sFe, "loai === 'thongkechitiet'", 'frontend: nhanh IN trong printOneOrderDoc'],
    [sFe, "thongkechitiet: 'Thống kê chi tiết'", 'frontend: nhan loai (LOAI_LABEL)']
  ];
  moc.forEach(([src, chuoi, ten]) => kiem(src.indexOf(chuoi) > 0, ten));
  kiem(/'thongsodo', 'thongkechitiet', 'motasp'/.test(sRoute),
    'backend: thongkechitiet nam trong danh sach ?loai hop le cua /orders');
  kiem(/CASE WHEN EXISTS \(SELECT 1 FROM TaiLieuThongKeChiTiet tl WHERE tl\.DonHangID = d\.DonHangID/.test(sRoute),
    'cot "Da co" doc DUNG bang TaiLieuThongKeChiTiet (khong phai bang phu kien)');
  kiem(/printThongKeChiTiet\(\{[\s\S]{0,200}anhIn: res\.data\.anhDaiDien \|\| res\.anhMacDinh/.test(sFe),
    'nhanh IN lay anh: uu tien anh rieng cua ban, khong co thi anh ma hang');

  console.log('\n=== 6c. Dan anh (Ctrl+V) vao o Hinh chi tiet ===');
  kiem(/class="tkct-o-anh" tabindex="0"/.test(sFe),
    'o hinh co tabindex -> moi nhan duoc su kien paste (thieu tabindex la Ctrl+V khong vao)');
  kiem(/o\.addEventListener\('paste'/.test(sFe), 'co bat su kien paste');
  kiem(/querySelectorAll\('\.tkct-o-anh'\)\.forEach/.test(sFe),
    'bat tren TUNG O — bat o ca bang thi dan chu vao o ten cung roi vao day');
  kiem(/items\[i\]\.kind === 'file' && \/\^image/.test(sFe), 'chi nhan muc la ANH trong bo nho tam');
  kiem(/Bộ nhớ tạm không có ảnh/.test(sFe), 'dan thu khong phai anh -> bao ro, khong im lang');
  kiem(/state\.rows\[ri\]\.anhChiTiet = await uploadFile\(f, 'tkct'\)/.test(sFe),
    'anh dan dung CHUNG duong uploadFile voi nut chon file (mot duong ghi anh duy nhat)');
  kiem((sFe.match(/uploadFile\(f, 'tkct'\)/g) || []).length === 2,
    'dung o CA HAI cho: chon file va dan anh',
    String((sFe.match(/uploadFile\(f, 'tkct'\)/g) || []).length));

  console.log('\n=== 6d. Anh dai dien hang tren CA HAI ban in ===');
  kiem((sRoute.match(/const anhMacDinh = await anhDaiDienCuaDon\(pool, order\);/g) || []).length === 2,
    'CA HAI route (thongsodo + thongkechitiet) deu tra anh dai dien mac dinh',
    String((sRoute.match(/const anhMacDinh = await anhDaiDienCuaDon\(pool, order\);/g) || []).length));
  /* v7.67: yeu cau da mo rong ra HET cac ban in cua man hinh (khong chi 2 ban nay). Bay gio moi
     builder goi khoiDauPhieuHtml(), va bai kiem CHAY THAT tung ban in nam o
     utils/kiem_anh_va_marap_ban_in.js — o day chi giu moc chong sut. */
  kiem((sFe.match(/khoiDauPhieuHtml\(/g) || []).length >= 7,
    'anh dau phieu dung CHUNG mot ham cho moi ban in (>= 7 cho goi)',
    String((sFe.match(/khoiDauPhieuHtml\(/g) || []).length));
  /* Ba duong in cung mot tai lieu (nut In trong form / nut In o danh sach ban / In tat ca) phai ra
     GIONG NHAU — thieu mot cho la "in cho nay co anh, cho kia khong". */
  kiem((sFe.match(/anhIn: res\.anhMacDinh \|\| ''/g) || []).length >= 2,
    'cac nut In trong form deu truyen anh',
    String((sFe.match(/anhIn: res\.anhMacDinh \|\| ''/g) || []).length));
  kiem(/anhIn: \(res && res\.anhMacDinh\) \|\| ''/.test(sFe),
    'nut In o danh sach ban: anh gan san trong withInfo() nen moi loai deu co');
  kiem(/const kemAnh = \(r\) =>/.test(sFe) && /buildThongSoDoBodyHtml\(kemAnh\(tsd\)\)/.test(sFe),
    '"In tat ca tai lieu" cung truyen anh (khong de hai duong in ra hai ban khac nhau)');
  kiem(/flex:none;/.test(sFe), 'anh khong bi bop meo khi khoi thong tin dai');
  /* ⚠️ SAI NGUON ANH (v7.65.2 -> sua o v7.65.3): ban dau toi do `TheKhoHangHoa` theo ma san pham,
     nen hau het don KHONG ra anh nao — ma tren lenh SX chua chac co the kho, va the kho chua chac
     da co anh. Anh dai dien that su cua don nam ngay tren lenh SX: `DonHangSanXuat.AnhSanPham`. */
  kiem(/SELECT DonHangID, MaDH, MaSanPham, TenSanPham, AnhSanPham FROM DonHangSanXuat/.test(sRoute),
    'getOrderBasic lay LUON AnhSanPham cua lenh SX');
  kiem(/async function anhDaiDienCuaDon\(pool, order\)/.test(sRoute),
    'co MOT ham dung chung tim anh cho ca hai loai tai lieu');
  kiem(/if \(order\.AnhSanPham\) return order\.AnhSanPham;/.test(sRoute),
    'UU TIEN anh cua chinh lenh SX');
  kiem(/LTRIM\(RTRIM\(MaHang\)\) = @ms/.test(sRoute),
    'lui ve the kho thi so ma DA CAT KHOANG TRANG hai dau (lech mot dau cach la khong ra dong nao)');
  kiem(/NULLIF\(LTRIM\(RTRIM\(ISNULL\(AnhDaiDien, ''\)\)\), ''\) IS NOT NULL/.test(sRoute),
    'chi lay dong the kho THAT SU co anh (khong tra ve chuoi rong roi tuong la co)');
  /* v7.67: khong con "hai route", MOI route GET tra `order` deu phai kem anh -> so loi goi tang.
     Rang buoc chat (khong cau res.json nao tra order ma thieu anhMacDinh) o kiem_anh_va_marap_ban_in.js. */
  kiem((sRoute.match(/anhDaiDienCuaDon\(pool, order\)/g) || []).length >= 3,
    'moi route deu goi ham dung chung (khong con ban tu tra anh)',
    String((sRoute.match(/anhDaiDienCuaDon\(pool, order\)/g) || []).length));
  kiem(!/SELECT TOP 1 AnhDaiDien FROM TheKhoHangHoa WHERE MaHang = @ms/.test(sRoute),
    'khong con ban tra anh viet tay (chi con trong ham dung chung)');

  console.log('\n=== 6e. Nut xoa trang bang ===');
  kiem(/id="btnTkctXoaTrang"/.test(sFe), 'co nut Xoa trang bang');
  kiem(/state\.rows = \[tkctDongMoi\(\)\];/.test(sFe), 'xoa trang -> ve dung MOT dong rong');
  kiem(/Xóa TRẮNG toàn bộ bảng/.test(sFe), 'hoi truoc khi xoa (khi bang dang co du lieu)');
  kiem(/chưa bấm Lưu thì bản đã lưu vẫn còn nguyên/.test(sFe),
    'noi ro chi xoa tren man hinh — chua Luu thi ban da luu con nguyen');

  console.log('\n=== 7. Migration + file cai moi ===');
  kiem(/CREATE TABLE TaiLieuThongKeChiTiet\b/.test(sMig), 'migration_v695 tao bang chinh');
  kiem(/CREATE TABLE TaiLieuThongKeChiTietDong\b/.test(sMig), 'va bang dong');
  kiem(/IF OBJECT_ID\('TaiLieuThongKeChiTiet'\) IS NULL/.test(sMig), 'chay lai duoc');
  kiem(/AnhChiTiet\s+NVARCHAR\(500\)/.test(sMig), 'cot duong dan anh du dai (500) — cat ngan la mat anh');
  kiem(/TongSoLuong\s+NVARCHAR\(50\)\s+NULL,\s*--\s*CO NGUOI GO TAY/.test(sMig)
    || /TongSoLuong/.test(sMig), 'co cot Tong so luong');
  kiem(/\[\d+\/\d+\]\s+migration_v695\.sql/.test(sCaiDat),
    'CAI_DAT_DAY_DU.sql da gop khoi v695 (sinh lai bang tao_file_cai_dat.js)');

  console.log('\n=== 8. Bump ?v= ===');
  const v = (sIndex.match(/module\.tailieukythuat\.js\?v=([\d.]+)/) || [])[1];
  kiem(v && parseFloat(v) >= 7.65, 'index.html: module.tailieukythuat.js?v= >= 7.65', String(v));

  console.log('\n================================================================');
  console.log(`KET QUA: ${dat} dat / ${truot} truot`);
  process.exit(truot ? 1 : 0);
})();
