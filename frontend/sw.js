// Service worker toi thieu - dieu kien BAT BUOC de trinh duyet (Chrome/Edge Android) cho phep
// "Them vao man hinh chinh" hien nhu 1 app thuc. Khong lam cache phuc tap de tranh hien du lieu cu
// (ton kho/don hang thay doi lien tuc) - moi request van luon di thang ra network nhu binh thuong.
// v5.67: THEM Web Push - nhan thong bao day va hien len man hinh ke ca khi khong mo trang web.
const CACHE_NAME = 'qlnoibo-shell-v2';
const SHELL_FILES = ['/index.html', '/css/style.css', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// Chi phuc vu tu cache khi mat mang HOAN TOAN (fallback), uu tien network-first cho moi request de
// khong bao gio hien du lieu ton kho/don hang cu.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

/* ================================================================================================
   v5.67 — NHAN THONG BAO DAY (Web Push)
   requireInteraction: true  ->  tren WINDOWS/macOS popup NAM YEN tren man hinh cho toi khi nguoi
   dung bam vao hoac dong (khong tu bien mat sau vai giay). Tren Android/iOS thuoc tinh nay bi
   TRINH DUYET BO QUA theo dung chuan - thong bao van nam trong khay thong bao cho toi khi vuot bo.
   ================================================================================================ */
self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; }
  catch (e) { d = { body: (event.data && event.data.text()) || '' }; }

  const tieuDe = d.title || 'QLNoiBo';
  const tuyChon = {
    body: d.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: d.tag || 'qlnoibo',      // cung tag -> thay the nhau, khong xep chong hang chuc popup
    renotify: true,               // van rung/keu khi thay the thong bao cu cung tag
    requireInteraction: true,     // <<< NAM YEN tren Desktop cho toi khi nguoi dung bam
    vibrate: [200, 100, 200],
    timestamp: Date.now(),
    data: { url: d.url || '/' },
    actions: [{ action: 'mo', title: 'Mở phần mềm' }]
  };
  event.waitUntil(self.registration.showNotification(tieuDe, tuyChon));
});

// Bam vao thong bao -> dua ve dung man hinh; neu da mo san 1 tab thi focus tab do thay vi mo tab moi.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil((async () => {
    const dsTab = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const tab of dsTab) {
      if ('focus' in tab) {
        try { if ('navigate' in tab) await tab.navigate(url); } catch (e) { /* khac origin thi bo qua */ }
        return tab.focus();
      }
    }
    if (clients.openWindow) return clients.openWindow(url);
  })());
});
