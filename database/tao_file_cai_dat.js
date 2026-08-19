/* ================================================================================================
   TAO FILE CAI DAT GOP  ->  CAI_DAT_DAY_DU.sql        (v6.77)

   Gop schema.sql + toan bo migration_v*.sql (dung thu tu) thanh MOT file SQL duy nhat, de cai may
   moi chi can mo SSMS chay 1 file, khong phai chay Node hay mo 80 file.

   ⚠️ FILE GOP LA SINH RA, KHONG SUA TAY.
   Them migration moi (vd migration_v681.sql) thi chay lai lenh nay de sinh lai:
       node tao_file_cai_dat.js
   Sua tay vao CAI_DAT_DAY_DU.sql thi lan sinh sau se mat sach.

   VI SAO VAN GIU 80 FILE RIENG:
     - May DANG CHAY chi can chay nhung migration MOI, khong the chay lai ca file gop.
     - Xem lich su "phien ban nao doi cai gi" phai nhin tung file.
   Tuc la: file gop dung cho CAI MOI, cac file rieng dung cho NANG CAP.
   ================================================================================================ */
const fs = require('fs');
const path = require('path');

const THU_MUC = __dirname;
const DAU_RA = path.join(THU_MUC, 'CAI_DAT_DAY_DU.sql');

// Cung quy tac thu tu voi chay_migration.js - xem giai thich chi tiet o file do.
function khoaThuTu(ten) {
  const m = /^migration_v(\d+)([a-z]*)(?:_(.+))?\.sql$/i.exec(ten);
  if (!m) return [9999, 9999, 9999, '', ten];
  const num = m[1], hau = (m[2] || '').toLowerCase(), duoi = m[3] || '';
  const lon = num.length <= 1 ? Number(num) : Number(num[0]);
  const nho = num.length <= 1 ? -1 : Number(num.slice(1));
  return [lon, nho, hau ? hau.charCodeAt(0) - 96 : 0, duoi, ten];
}

const dsMigration = fs.readdirSync(THU_MUC)
  .filter(f => /^migration_v.*\.sql$/i.test(f))
  .filter(f => !/rollback/i.test(f))
  .map(khoaThuTu)
  .sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2] || String(a[3]).localeCompare(String(b[3])))
  .map(k => k[4]);

const dsFile = ['schema.sql', ...dsMigration];

const dau = `/* ================================================================================================
   QLNoiBo - FILE CAI DAT DAY DU
   Sinh tu dong luc ${new Date().toISOString().slice(0, 19).replace('T', ' ')} boi: node tao_file_cai_dat.js
   Gom: schema.sql + ${dsMigration.length} file migration, theo dung thu tu chay.

   ⚠️ KHONG SUA TAY FILE NAY. Sua thi lan sinh sau se mat. Sua o file goc roi sinh lai.

   CACH DUNG - MAY MOI:
     1. Trong SSMS chay truoc:   CREATE DATABASE QLNoiBo;
     2. Mo file nay, chon dung database QLNoiBo o thanh cong cu, bam Execute (F5).
     3. Doc ket qua o tab Messages - moi buoc deu in ra da tao gi / da co san gi.

   ⚠️ TUYET DOI KHONG chay file nay len CSDL DANG CHAY THAT.
      Cac lenh deu viet kieu "IF chua co THI tao" nen phan lon vo hai, nhung "phan lon" khong phai
      "chac chan". May dang chay muon nang cap thi dung:  node chay_migration.js
   ================================================================================================ */

`;

let ra = dau;
let tong = 0;
dsFile.forEach((f, i) => {
  const duong = path.join(THU_MUC, f);
  if (!fs.existsSync(duong)) { console.log(`  (bo qua, khong thay) ${f}`); return; }
  const noiDung = fs.readFileSync(duong, 'utf8');
  ra += `\n${'/'.repeat(98)}\n`;
  ra += `/* [${String(i + 1).padStart(2)}/${dsFile.length}]  ${f}  */\n`;
  ra += `${'/'.repeat(98)}\n`;
  ra += `PRINT '';\nPRINT '>>> [${i + 1}/${dsFile.length}] ${f}';\nGO\n\n`;
  ra += noiDung.replace(/﻿/g, '');   // bo BOM giua file, khong SSMS bao loi cu phap la
  if (!/\n\s*GO\s*$/i.test(noiDung)) ra += '\nGO\n';
  ra += '\n';
  tong++;
});

ra += `\n${'/'.repeat(98)}\nPRINT '';\nPRINT '=== CAI DAT XONG. Buoc tiep: Quan ly User -> Ma tran phan quyen -> cap quyen. ===';\nGO\n`;

fs.writeFileSync(DAU_RA, ra, 'utf8');
console.log(`Da gop ${tong} file -> ${DAU_RA}`);
console.log(`Dung luong: ${(Buffer.byteLength(ra, 'utf8') / 1024).toFixed(0)} KB`);
console.log('');
console.log('File dau : ' + dsFile[0]);
console.log('File cuoi: ' + dsFile[dsFile.length - 1]);
