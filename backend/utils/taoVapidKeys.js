/* Sinh cap khoa VAPID cho Web Push. CHAY 1 LAN duy nhat.
   Cach chay (trong thu muc backend):
       npm install web-push
       node utils/taoVapidKeys.js
   Roi COPY 3 dong in ra vao file backend/.env va `pm2 restart qlnoibo`.

   LUU Y: doi khoa = MOI THIET BI DA DANG KY DEU PHAI BAT LAI THONG BAO. Sinh 1 lan roi giu nguyen.
   Khoa PRIVATE khong duoc chia se / dua len GitHub. */

let webpush;
try {
  webpush = require('web-push');
} catch (e) {
  console.error('Chua cai thu vien. Chay truoc:  npm install web-push');
  process.exit(1);
}

const k = webpush.generateVAPIDKeys();
console.log('');
console.log('Dan 3 dong duoi day vao backend/.env:');
console.log('-------------------------------------------------------------');
console.log('VAPID_PUBLIC_KEY=' + k.publicKey);
console.log('VAPID_PRIVATE_KEY=' + k.privateKey);
console.log('VAPID_SUBJECT=mailto:nguyendlp@fpt.com');
console.log('-------------------------------------------------------------');
console.log('Xong thi: pm2 restart qlnoibo');
console.log('');
