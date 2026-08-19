// Trang Catalogue cong khai - KHONG dang nhap, KHONG dung common.js (de khong dinh vao logic redirect /login.html
// khi gap 401 cua app chinh). Chi goi GET /api/public/catalogue (khong qua requireAuth, xem backend/routes/public.js).

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]));
}
function fmtNumber(n) {
  if (n === null || n === undefined || n === '') return '';
  return Number(n).toLocaleString('vi-VN');
}
/* v6.07 — ẢNH XEM TRƯỚC CỠ NHỎ: '/uploads/x.jpg' -> '/anh/320/x.jpg' (máy chủ tạo + ghi đệm, xem
   backend/routes/anh.js). GỐC của "vào catalogue load ảnh rất lâu": mỗi thẻ tải ĐÚNG file gốc (có ảnh
   24 MB) cho ô ~300px, 30 sản phẩm là vài trăm MB. Bản copy của anhNho() trong common.js — trang này CỐ Ý
   không dùng common.js (xem ghi chú đầu file). Xem ảnh to (lightbox) vẫn dùng ảnh GỐC. */
const ANH_CANH_CHO_PHEP = [80, 160, 320, 640, 800, 1200];
function anhNho(url, canh) {
  const s = String(url == null ? '' : url).trim();
  if (!s || s.indexOf('/uploads/') !== 0) return s;
  const ten = s.slice('/uploads/'.length);
  if (!ten || ten.indexOf('/') !== -1) return s;
  let c = Number(canh) || 320;
  if (ANH_CANH_CHO_PHEP.indexOf(c) === -1) c = ANH_CANH_CHO_PHEP.reduce((a, b) => (Math.abs(b - c) < Math.abs(a - c) ? b : a));
  return `/anh/${c}/${ten}`;
}

/* v5.65.3: KHÔNG BAO GIỜ ĐỂ TRANG TREO Ở "Đang tải...".
   Trang này không dùng common.js nên không có timeout của apiFetch — nếu máy chủ nhận request rồi
   không trả lời (backend chết giữa chừng, mất kết nối SQL...) thì fetch treo VÔ HẠN và khách chỉ
   thấy chữ "Đang tải" mãi. Mọi lệnh gọi API ở trang này đi qua layJSON() có hạn 20 giây. */
const CAT_TIMEOUT_MS = 20000;
async function layJSON(url, opt) {
  const ctl = new AbortController();
  const hen = setTimeout(() => ctl.abort(), CAT_TIMEOUT_MS);
  try {
    const res = await fetch(url, Object.assign({ signal: ctl.signal }, opt || {}));
    return await res.json();
  } catch (e) {
    if (e && e.name === 'AbortError') throw new Error('Máy chủ không phản hồi sau 20 giây (' + url + ').');
    throw e;
  } finally { clearTimeout(hen); }
}

let __allItems = [];
/* ================================================================================================
   v5.63: KHÁCH ĐĂNG NHẬP ĐẶT HÀNG NGAY TRÊN TRANG NÀY.
   - Tài khoản do nhân viên tạo (không có đăng ký tự do) — xem Thẻ kho hàng hóa → Tài khoản khách.
   - Chưa đăng nhập: chỉ xem, không thấy ô đặt hàng.
   - Đặt xong: đơn vào phần mềm ở trạng thái "Chờ xác nhận" (CHƯA trừ tồn), nhân viên xác nhận sau.
   ================================================================================================ */
let __khach = null;      // { id, tenDangNhap, tenKhach, sdt }
let __gio = [];          // giỏ hàng: [{maHang, tenHang, tenMau, soLuong, donVi}]

async function taiPhienKhach() {
  try {
    const d = await layJSON('/api/public/khach/toi');
    __khach = (d && d.success) ? d.data : null;
  } catch (e) { __khach = null; }     // chưa đăng nhập (401) hoặc máy chủ lỗi -> vẫn xem được hàng
  veThanhKhach();
}
function veThanhKhach() {
  const box = document.getElementById('catKhachBar');
  if (!box) return;
  if (__khach) {
    box.innerHTML = `<span>Xin chào <b>${escapeHtml(__khach.tenKhach)}</b></span>
      <button type="button" id="btnXemGio">🛒 Giỏ hàng (<span id="gioCount">0</span>)</button>
      <button type="button" id="btnDonToi">Đơn của tôi</button>
      <button type="button" id="btnDangXuatKhach">Đăng xuất</button>`;
    document.getElementById('btnXemGio').addEventListener('click', moGioHang);
    document.getElementById('btnDonToi').addEventListener('click', moDonCuaToi);
    document.getElementById('btnDangXuatKhach').addEventListener('click', async () => {
      await fetch('/api/public/khach/dangxuat', { method: 'POST' });
      __khach = null; __gio = []; veThanhKhach(); renderGrid(__allItems);
    });
    capNhatSoGio();
  } else {
    box.innerHTML = `<span>Đã có tài khoản đặt hàng?</span><button type="button" id="btnDangNhapKhach">Đăng nhập để đặt hàng</button>`;
    document.getElementById('btnDangNhapKhach').addEventListener('click', moDangNhapKhach);
  }
}
function capNhatSoGio() {
  const el = document.getElementById('gioCount');
  if (el) el.textContent = String(__gio.length);
}
function moDangNhapKhach() {
  const ov = document.createElement('div');
  ov.className = 'cat-modal-overlay';
  ov.innerHTML = `<div class="cat-modal">
      <h3>Đăng nhập đặt hàng</h3>
      <p style="font-size:13px;color:#5f6368;">Tài khoản do nhân viên bán hàng cấp. Chưa có tài khoản, vui lòng liên hệ nhân viên.</p>
      <input id="kTen" placeholder="Tên đăng nhập" autocomplete="username">
      <input id="kMk" type="password" placeholder="Mật khẩu" autocomplete="current-password">
      <div id="kLoi" style="color:#cc4125;font-size:13px;min-height:18px;"></div>
      <div class="cat-modal-actions"><button type="button" id="kHuy">Đóng</button><button type="button" id="kOk" class="primary">Đăng nhập</button></div>
    </div>`;
  document.body.appendChild(ov);
  const dong = () => ov.remove();
  ov.querySelector('#kHuy').addEventListener('click', dong);
  ov.addEventListener('click', e => { if (e.target === ov) dong(); });
  const dangNhap = async () => {
    const loi = ov.querySelector('#kLoi');
    loi.textContent = '';
    try {
      const res = await fetch('/api/public/khach/dangnhap', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenDangNhap: ov.querySelector('#kTen').value, matKhau: ov.querySelector('#kMk').value })
      });
      const d = await res.json();
      if (!d.success) { loi.textContent = d.message || 'Đăng nhập không thành công.'; return; }
      __khach = d.data; dong(); veThanhKhach(); renderGrid(__allItems);
    } catch (e) { loi.textContent = 'Không kết nối được máy chủ.'; }
  };
  ov.querySelector('#kOk').addEventListener('click', dangNhap);
  ov.querySelector('#kMk').addEventListener('keydown', e => { if (e.key === 'Enter') dangNhap(); });
  ov.querySelector('#kTen').focus();
}
// v5.65: thêm 1 dòng vào giỏ nhưng KHÔNG tự mở giỏ (vì 1 lần bấm có thể thêm NHIỀU màu —
// mở giỏ trong vòng lặp sẽ bung ra nhiều hộp thoại chồng lên nhau).
function themVaoGio(dong) {
  const cu = __gio.find(x => x.maHang === dong.maHang && x.tenMau === dong.tenMau && x.donVi === dong.donVi);
  if (cu) cu.soLuong += dong.soLuong; else __gio.push(dong);
  capNhatSoGio();
}
function moGioHang() {
  const ov = document.createElement('div');
  ov.className = 'cat-modal-overlay';
  ov.innerHTML = `<div class="cat-modal" style="max-width:640px;">
      <h3>🛒 Giỏ hàng</h3>
      <div id="gioBody"></div>
      <textarea id="gioGhiChu" rows="2" placeholder="Ghi chú cho đơn (tùy chọn)"></textarea>
      <div class="cat-modal-actions"><button type="button" id="gHuy">Đóng</button><button type="button" id="gGui" class="primary">Gửi đơn đặt hàng</button></div>
    </div>`;
  document.body.appendChild(ov);
  const dong = () => ov.remove();
  const ve = () => {
    ov.querySelector('#gioBody').innerHTML = __gio.length
      ? `<table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead><tr><th style="width:34px;">STT</th><th align="left">Sản phẩm</th><th align="left">Màu</th><th>SL</th><th>ĐV</th><th></th></tr></thead>
          <tbody>${__gio.map((d, i) => `<tr>
            <td align="center">${i + 1}</td>
            <td>${escapeHtml(d.tenHang)}<div style="color:#5f6368;font-size:11px;">${escapeHtml(d.maHang)}</div></td>
            <td>${escapeHtml(d.tenMau)}</td><td align="center">${d.soLuong}</td><td align="center">${escapeHtml(d.donVi)}</td>
            <td align="center"><button type="button" class="gio-xoa" data-i="${i}">Xóa</button></td></tr>`).join('')}</tbody></table>`
      : '<p style="color:#5f6368;">Giỏ hàng đang trống. Bấm "+ Chọn" ở sản phẩm để thêm.</p>';
    ov.querySelectorAll('.gio-xoa').forEach(b => b.addEventListener('click', () => {
      __gio.splice(Number(b.dataset.i), 1); capNhatSoGio(); ve();
    }));
  };
  ve();
  ov.querySelector('#gHuy').addEventListener('click', dong);
  ov.addEventListener('click', e => { if (e.target === ov) dong(); });
  /* v5.65.1/.2: gửi đơn theo kiểu "được đến đâu ghi đến đó":
       - Màu còn đủ  -> backend đặt xong luôn, ta bỏ khỏi giỏ.
       - Màu THIẾU   -> backend trả về `toiDa` (số còn đặt được). HỎI KHÁCH:
                        OK  -> hạ số lượng xuống `toiDa` rồi GỬI TIẾP lượt nữa;
                        Bỏ  -> xóa màu đó khỏi giỏ.
       - Màu hết sạch (toiDa = 0) hoặc không còn bán -> xóa khỏi giỏ, kể tên ở thông báo cuối.
     Tối đa 3 lượt gửi để không lặp vô hạn khi có người khác mua song song. */
  const khoaDong = (x) => (x.maHang || '') + '||' + (x.tenMau || '');
  ov.querySelector('#gGui').addEventListener('click', async () => {
    if (!__gio.length) { alert('Giỏ hàng đang trống.'); return; }
    const btn = ov.querySelector('#gGui');
    btn.disabled = true; btn.textContent = 'Đang gửi...';
    try {
      let tongDaDat = 0;
      const hetHang = [];      // tên các màu hết sạch / không còn bán -> báo ở cuối
      for (let luot = 0; luot < 3; luot++) {
        const res = await fetch('/api/public/khach/datdon', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dm: layMaDanhMuc(), ghiChu: ov.querySelector('#gioGhiChu').value, items: __gio })
        });
        const d = await res.json();
        const data = d.data || {};
        const thieu = data.thieu || [];
        const khongHopLe = data.khongHopLe || [];
        if (!d.success && !thieu.length && !khongHopLe.length) throw new Error(d.message || 'Không gửi được đơn.');
        tongDaDat += Number(data.soDong) || 0;

        // Giữ lại trong giỏ ĐÚNG những dòng chưa đặt được.
        const conLai = new Set([...thieu, ...khongHopLe].map(khoaDong));
        __gio = __gio.filter(x => conLai.has(khoaDong(x)));

        // Dòng không còn được bán -> bỏ hẳn.
        khongHopLe.forEach(t => {
          hetHang.push(`${t.maHang} — màu ${t.tenMau} (không còn bán)`);
          __gio = __gio.filter(x => khoaDong(x) !== khoaDong(t));
        });

        if (!thieu.length) { capNhatSoGio(); break; }

        // HỎI KHÁCH từng màu thiếu.
        let coHaSo = false;
        thieu.forEach(t => {
          const dong = __gio.find(x => khoaDong(x) === khoaDong(t));
          if (!dong) return;
          const toiDa = Number(t.toiDa) || 0;
          if (toiDa <= 0) {
            hetHang.push(`${t.tenHang} — màu ${t.tenMau} (đã hết hàng)`);
            __gio = __gio.filter(x => x !== dong);
            return;
          }
          const dongY = confirm(`${t.tenHang} — màu ${t.tenMau}\n\n` +
            `Bạn đặt ${t.daDat} ${t.donVi}, kho chỉ còn ${toiDa} ${t.donVi}.\n\n` +
            `Bấm OK để đặt ${toiDa} ${t.donVi}.\nBấm Cancel để bỏ màu này khỏi giỏ.`);
          if (dongY) { dong.soLuong = toiDa; dong.donVi = t.donVi; coHaSo = true; }
          else __gio = __gio.filter(x => x !== dong);
        });
        capNhatSoGio();
        if (!coHaSo || !__gio.length) break;      // không còn gì để gửi tiếp
      }

      let tb = tongDaDat
        ? `Đã đặt ${tongDaDat} dòng hàng. Đơn đang ở trạng thái "Chờ xử lý" — bạn có thể sửa số lượng hoặc hủy trong mục "Đơn của tôi".`
        : 'Chưa đặt được dòng nào.';
      if (hetHang.length) tb += '\n\nĐã bỏ khỏi giỏ:\n• ' + hetHang.join('\n• ');
      if (__gio.length) tb += `\n\nCòn ${__gio.length} dòng chưa đặt được (vẫn trong giỏ) — bạn sửa số lượng rồi gửi lại.`;
      alert(tb);

      // Tồn kho đã đổi -> tải lại danh sách hàng cho khớp thực tế.
      if (__gio.length) { ve(); btn.disabled = false; btn.textContent = 'Gửi đơn đặt hàng'; }
      else dong();
      loadCatalogue();
    } catch (e) {
      alert(e.message);
      btn.disabled = false; btn.textContent = 'Gửi đơn đặt hàng';
    }
  });
}
/* v5.65: "Đơn của tôi" — khách SỬA SỐ LƯỢNG / HỦY ĐƠN của chính mình.
   Chỉ đơn còn ở trạng thái "Chờ xử lý" mới sửa/hủy được (backend cũng chặn lần nữa — không tin
   giao diện). Mọi thay đổi được backend cập nhật ngay vào tồn kho thẻ kho hàng hóa. */
const TRANG_THAI_KHACH_SUA = ['Chờ xử lý', 'Chờ xác nhận'];
async function moDonCuaToi() {
  const ov = document.createElement('div');
  ov.className = 'cat-modal-overlay';
  ov.innerHTML = `<div class="cat-modal" style="max-width:760px;"><h3>Đơn của tôi</h3>
      <div id="donBody"><p style="color:#5f6368;">Đang tải...</p></div>
      <div class="cat-modal-actions"><button type="button" id="dDong">Đóng</button></div></div>`;
  document.body.appendChild(ov);
  const dong = () => ov.remove();
  ov.querySelector('#dDong').addEventListener('click', dong);
  ov.addEventListener('click', e => { if (e.target === ov) dong(); });

  let rows = [];
  let dangSua = null;      // DonID đang ở chế độ sửa

  async function tai() {
    try {
      const res = await fetch('/api/public/khach/donhang');
      const d = await res.json();
      rows = (d && d.success) ? (d.data || []) : [];
    } catch (e) { rows = []; }
    ve();
  }

  function ve() {
    const body = ov.querySelector('#donBody');
    if (!rows.length) { body.innerHTML = '<p style="color:#5f6368;">Bạn chưa có đơn nào.</p>'; return; }
    body.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead><tr><th style="width:34px;">STT</th><th align="left">Ngày</th><th align="left">Sản phẩm</th><th align="left">Màu</th><th>SL</th>
        <th align="left">Trạng thái</th><th></th></tr></thead>
      <tbody>${rows.map((r, __i) => {
        const suaDuoc = TRANG_THAI_KHACH_SUA.includes(String(r.TrangThai || ''));
        const dangSuaDong = String(dangSua) === String(r.DonID);
        const oSL = dangSuaDong
          ? `<input type="number" class="d-sl" min="1" value="${Number(r.SoLuongDat) || 1}" style="width:70px;margin:0;">
             <select class="d-dv" style="width:auto;padding:6px;">${
               [...new Set([r.DonViQuyDoi, r.DonViCoBan || 'Cái', r.DonVi].filter(Boolean))]
                 .map(dv => `<option value="${escapeHtml(dv)}"${String(r.DonVi) === String(dv) ? ' selected' : ''}>${escapeHtml(dv)}</option>`).join('')
             }</select>`
          : `${r.SoLuongDat} ${escapeHtml(r.DonVi || '')}`;
        const nut = dangSuaDong
          ? `<button type="button" class="d-luu" data-id="${r.DonID}">Lưu</button>
             <button type="button" class="d-bo">Bỏ</button>`
          : (suaDuoc
              ? `<button type="button" class="d-sua-btn" data-id="${r.DonID}">Sửa</button>
                 <button type="button" class="d-huy-btn" data-id="${r.DonID}">Hủy đơn</button>`
              : '<span style="color:#9aa0a6;font-size:12px;">—</span>');
        return `<tr>
          <td align="center">${__i + 1}</td>
          <td>${escapeHtml(String(r.ThoiGian || '').replace('T', ' ').slice(0, 16))}</td>
          <td>${escapeHtml(r.TenHang || '')}<div style="color:#5f6368;font-size:11px;">${escapeHtml(r.MaHang || '')}</div></td>
          <td>${escapeHtml(r.TenMau || '')}</td>
          <td align="center">${oSL}</td>
          <td>${escapeHtml(r.TrangThai || '')}</td>
          <td align="right" style="white-space:nowrap;">${nut}</td></tr>`;
      }).join('')}</tbody></table>
      <p style="color:#5f6368;font-size:12px;margin:10px 0 0;">Chỉ sửa/hủy được đơn đang "Chờ xử lý".
      Muốn đổi màu hoặc mã hàng, bạn hãy hủy đơn rồi đặt lại.</p>`;

    body.querySelectorAll('.d-sua-btn').forEach(b => b.addEventListener('click', () => { dangSua = b.dataset.id; ve(); }));
    body.querySelectorAll('.d-bo').forEach(b => b.addEventListener('click', () => { dangSua = null; ve(); }));
    body.querySelectorAll('.d-luu').forEach(b => b.addEventListener('click', async () => {
      const tr = b.closest('tr');
      const soLuong = Math.floor(Number(tr.querySelector('.d-sl').value) || 0);
      const donVi = tr.querySelector('.d-dv').value;
      if (soLuong <= 0) { alert('Số lượng phải lớn hơn 0.'); return; }
      b.disabled = true;
      try {
        const res = await fetch('/api/public/khach/donhang/' + b.dataset.id, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ soLuong, donVi })
        });
        const d = await res.json();
        if (!d.success) throw new Error(d.message || 'Không sửa được đơn.');
        dangSua = null; await tai(); loadCatalogue();     // tồn kho đã đổi -> làm mới danh sách hàng
      } catch (e) { alert(e.message); b.disabled = false; }
    }));
    body.querySelectorAll('.d-huy-btn').forEach(b => b.addEventListener('click', async () => {
      if (!confirm('Hủy đơn này? Hàng sẽ được trả lại kho và bạn không nhận được đơn nữa.')) return;
      b.disabled = true;
      try {
        const res = await fetch('/api/public/khach/donhang/' + b.dataset.id, { method: 'DELETE' });
        const d = await res.json();
        if (!d.success) throw new Error(d.message || 'Không hủy được đơn.');
        await tai(); loadCatalogue();
      } catch (e) { alert(e.message); b.disabled = false; }
    }));
  }

  tai();
}

/* v5.62: CÔNG KHAI THEO TỪNG DANH MỤC.
   Mở link kèm ?dm=<mã danh mục>  -> chỉ hiện hàng của ĐÚNG danh mục đó, tiêu đề trang đổi theo
   danh mục (do người quản lý đặt). Mở link trần (không có ?dm=) -> giữ nguyên như cũ: hiện tất cả.
   Danh mục chưa được BẬT công khai -> báo "không tồn tại hoặc chưa được chia sẻ" (không hé tên). */
function layMaDanhMuc() {
  try { return (new URLSearchParams(window.location.search).get('dm') || '').trim(); }
  catch (e) { return ''; }
}
async function loadCatalogue() {
  const grid = document.getElementById('catGrid');
  const maDM = layMaDanhMuc();
  try {
    const url = maDM ? ('/api/public/catalogue-danhmuc?dm=' + encodeURIComponent(maDM)) : '/api/public/catalogue';
    const data = await layJSON(url);
    if (!data.success) throw new Error(data.message || 'Lỗi tải dữ liệu.');
    if (maDM && data.danhMuc) {   // đổi tiêu đề trang theo danh mục
      const t = document.getElementById('catTitle'), s = document.getElementById('catSubtitle');
      if (t) t.textContent = '🏭 ' + data.danhMuc.tieuDe;
      if (s) s.textContent = data.danhMuc.moTa || 'Danh sách hàng còn trong kho — cập nhật trực tiếp từ hệ thống';
      document.title = data.danhMuc.tieuDe;
    }
    __allItems = data.data || [];
    // v5.44.1: TỰ SẮP XẾP hàng mới lên TRÊN CÙNG — theo ngày tạo thẻ kho (ngayTao) giảm dần.
    __allItems.sort((a, b) => (new Date(b.ngayTao || 0)).getTime() - (new Date(a.ngayTao || 0)).getTime());
    fillLoaiHangFilter(__allItems);
    renderGrid(__allItems);
  } catch (err) {
    // v5.62: link danh mục sai / chưa được bật công khai -> nói rõ cho khách, không hiện lỗi kỹ thuật.
    const loi = String(err.message || '');
    if (maDM && /không tồn tại|chưa được chia sẻ/i.test(loi)) {
      grid.innerHTML = `<div class="cat-empty">Đường link này không còn hiệu lực hoặc chưa được chia sẻ.<br>Vui lòng liên hệ người gửi link để nhận link mới.</div>`;
    } else {
      grid.innerHTML = `<div class="cat-empty">Không tải được danh sách sản phẩm (${escapeHtml(loi)}).</div>`;
    }
  }
}

// v5.44: ĐÃ BỎ lọc "Danh mục thẻ kho" khỏi catalogue (theo yêu cầu). Thêm phân loại "Hàng mới":
// hàng có ngày TẠO thẻ kho trong vòng 3 ngày (backend trả ngayTao = CreatedAt).
function isNewItem(i) {
  if (!i.ngayTao) return false;
  const t = new Date(i.ngayTao).getTime();
  return !isNaN(t) && (Date.now() - t) <= 3 * 24 * 60 * 60 * 1000;
}

// v5.4 (muc 1): loc theo "Loai hang" moi (nhom san pham, vd Quan be trai/gai) - cung pattern voi
// fillTheKhoFilter, danh sach lay tu chinh du lieu da tai (khong goi them API).
function fillLoaiHangFilter(items) {
  const sel = document.getElementById('catFilterLoaiHang');
  const names = Array.from(new Set(items.map(i => i.loaiHang).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'vi'));
  sel.innerHTML = '<option value="">-- Tất cả loại hàng --</option>' + names.map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('');
}

// v5.4 (muc 1): lightbox TU THAN (khong dung common.js/openModal - trang nay doc lap de tranh dinh
// vao logic redirect /login.html cua app chinh khi gap 401, xem ghi chu dau file). Bam anh dai dien
// HOAC anh tung mau deu mo duoc, dong bang nut X / phim Esc / bam ra ngoai anh.
// v5.44: lightbox có GALLERY — nhận mảng ảnh {src,title} + vị trí bắt đầu; chuyển ‹ › (nút hoặc phím
// mũi tên) qua lại mà KHÔNG đóng. Vẫn tự thân (không dùng common.js/openModal).
let __catGallery = [];
let __catIdx = 0;
function openCatLightbox(gallery, startIdx) {
  closeCatLightbox();
  __catGallery = Array.isArray(gallery) ? gallery.filter(g => g && g.src) : (gallery ? [{ src: gallery, title: startIdx }] : []);
  __catIdx = Number.isInteger(startIdx) ? startIdx : 0;
  if (__catIdx < 0 || __catIdx >= __catGallery.length) __catIdx = 0;
  if (!__catGallery.length) return;
  const multi = __catGallery.length > 1;
  const overlay = document.createElement('div');
  overlay.className = 'cat-lightbox-overlay';
  overlay.innerHTML = `
    <div class="cat-lightbox-box">
      <img src="" alt="">
      <button type="button" class="cat-lightbox-close" aria-label="Đóng">✕</button>
      ${multi ? '<button type="button" class="cat-lightbox-nav cat-lightbox-prev" aria-label="Ảnh trước">‹</button><button type="button" class="cat-lightbox-nav cat-lightbox-next" aria-label="Ảnh sau">›</button><div class="cat-lightbox-cap"></div>' : ''}
    </div>`;
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeCatLightbox(); });
  overlay.querySelector('.cat-lightbox-close').addEventListener('click', closeCatLightbox);
  if (multi) {
    overlay.querySelector('.cat-lightbox-prev').addEventListener('click', (e) => { e.stopPropagation(); catLightboxStep(-1); });
    overlay.querySelector('.cat-lightbox-next').addEventListener('click', (e) => { e.stopPropagation(); catLightboxStep(1); });
  }
  document.addEventListener('keydown', catLightboxKey);
  catLightboxShow();
}
function catLightboxShow() {
  const overlay = document.querySelector('.cat-lightbox-overlay');
  if (!overlay) return;
  const cur = __catGallery[__catIdx] || {};
  const img = overlay.querySelector('img');
  img.src = cur.src || '';
  img.alt = cur.title || '';
  const cap = overlay.querySelector('.cat-lightbox-cap');
  if (cap) cap.textContent = `${cur.title || ''} (${__catIdx + 1}/${__catGallery.length})`;
}
function catLightboxStep(delta) {
  if (!__catGallery.length) return;
  __catIdx = (__catIdx + delta + __catGallery.length) % __catGallery.length;
  catLightboxShow();
}
function catLightboxKey(e) {
  if (e.key === 'Escape') closeCatLightbox();
  else if (e.key === 'ArrowLeft') catLightboxStep(-1);
  else if (e.key === 'ArrowRight') catLightboxStep(1);
}
function closeCatLightbox() {
  const overlay = document.querySelector('.cat-lightbox-overlay');
  if (overlay) overlay.remove();
  document.body.style.overflow = '';
  document.removeEventListener('keydown', catLightboxKey);
}

/* v5.65.1: MỖI SẢN PHẨM HIỆN ĐỦ MỌI ẢNH.
   Trước đây thẻ sản phẩm chỉ hiện 1 ảnh đại diện (lại còn bị CẮT vì object-fit:cover), ảnh của từng
   màu chỉ là chấm tròn 22px nên không xem được. Nay:
     - Ảnh lớn để object-fit:contain -> nhìn TRỌN sản phẩm, không cắt.
     - Dưới ảnh lớn có DẢI ẢNH NHỎ gồm ẢNH ĐẠI DIỆN + ẢNH TỪNG MÀU; bấm để đổi ảnh lớn.
     - Góc ảnh lớn có bộ đếm "2/5" cho biết tổng số ảnh; bấm ảnh lớn mở xem toàn màn hình (‹ ›).
   Bộ ảnh của từng thẻ giữ trong __theAnh[chỉ số thẻ] để lightbox lấy đúng thứ tự, không quét DOM. */
let __theAnh = [];
function renderGrid(items) {
  const grid = document.getElementById('catGrid');
  if (!items.length) { grid.innerHTML = '<div class="cat-empty">Hiện chưa có sản phẩm nào còn hàng trong kho.</div>'; return; }
  __theAnh = items.map(i => {
    const g = [];
    if (i.anhDaiDien) g.push({ src: i.anhDaiDien, title: i.tenHang });
    (i.mauConLai || []).forEach(c => { if (c.anh) g.push({ src: c.anh, title: (i.tenHang || '') + ' · ' + c.tenMau }); });
    return g;
  });
  grid.innerHTML = items.map((i, idx) => {
    const anh = __theAnh[idx];
    return `
    <div class="cat-card" data-card="${idx}">
      ${isNewItem(i) ? '<span class="cat-new-badge">MỚI</span>' : ''}
      <div class="cat-img-wrap">
        ${/* v6.07: ảnh lớn của thẻ dùng bản 640px, ô thumb dùng 160px, + loading="lazy" để chỉ tải ảnh
             khi cuộn tới. Ảnh gốc chỉ tải khi khách bấm xem ảnh lớn (lightbox). */''}
        ${anh.length ? `<img class="cat-main-img act-cat-open" data-i="0" loading="lazy" decoding="async" src="${anhNho(anh[0].src, 640)}" alt="${escapeHtml(i.tenHang)}" title="Bấm để xem ảnh lớn">` : `<div class="cat-main-img"></div>`}
        ${anh.length > 1 ? `<span class="cat-img-count">1/${anh.length}</span>` : ''}
      </div>
      ${anh.length > 1 ? `<div class="cat-thumbs">${anh.map((a, j) =>
        `<img class="cat-thumb${j === 0 ? ' active' : ''}" data-i="${j}" loading="lazy" decoding="async" src="${anhNho(a.src, 160)}" alt="${escapeHtml(a.title)}" title="${escapeHtml(a.title)}">`).join('')}</div>` : ''}
      <div class="cat-body">
        <h3>${escapeHtml(i.tenHang)}</h3>
        <div class="cat-price">${i.giaBan ? fmtNumber(i.giaBan) + ' đ' : 'Liên hệ để biết giá'}</div>
        <div class="cat-colors">${(i.mauConLai || []).map(c => `
          <div class="cat-color-chip">${c.anh ? `<img class="act-cat-zoom" loading="lazy" decoding="async" data-src="${escapeHtml(c.anh)}" data-title="${escapeHtml(i.tenHang)} · ${escapeHtml(c.tenMau)}" src="${anhNho(c.anh, 80)}" alt="${escapeHtml(c.tenMau)}">` : '<span class="dot"></span>'} ${escapeHtml(c.tenMau)}</div>
        `).join('') || '<span style="color:#5f6368;font-size:12px;">Chưa khai báo màu</span>'}</div>
        ${/* v5.65: MỖI MÀU MỘT Ô SỐ LƯỢNG — chọn nhiều màu rồi bấm "+ Chọn" MỘT LẦN.
              Đơn vị mặc định là "Ri" (khách chủ yếu lấy theo ri). */''}
        ${__khach && (i.mauConLai || []).length ? `
        <div class="cat-order-box">
          <div class="cat-mau-list">
            ${(i.mauConLai || []).map(c => `<label class="cat-mau-row">
                <span class="cat-mau-ten" title="${escapeHtml(c.tenMau)}">${escapeHtml(c.tenMau)}</span>
                <input type="number" class="cat-sl-mau" data-mau="${escapeHtml(c.tenMau)}" min="0" step="1" value="" placeholder="0">
              </label>`).join('')}
          </div>
          <div class="cat-order-foot">
            ${/* v6.31: 2 lựa chọn = ĐVT quy đổi + ĐVT chính CỦA CHÍNH mã hàng (không gõ cứng Ri/Cái).
                 Mã không khai ĐVT quy đổi thì chỉ còn 1 lựa chọn — đúng bản chất, khỏi chọn nhầm. */''}
            <select class="cat-dv" title="Đơn vị tính">${
              [...new Set([i.donViQuyDoi, i.donViCoBan || 'Cái'].filter(Boolean))]
                .map((dv, k) => `<option value="${escapeHtml(dv)}"${k === 0 ? ' selected' : ''}>${escapeHtml(dv)}</option>`).join('')
            }</select>
            <button type="button" class="cat-add" data-mahang="${escapeHtml(i.maHang)}" data-ten="${escapeHtml(i.tenHang)}">+ Chọn</button>
          </div>
        </div>` : ''}
      </div>
    </div>`;
  }).join('');
  // v5.63/v5.65: nút "+ Chọn" -> gom TẤT CẢ màu đã nhập số lượng của sản phẩm này vào giỏ 1 lần.
  grid.querySelectorAll('.cat-add').forEach(btn => btn.addEventListener('click', () => {
    const box = btn.closest('.cat-order-box');
    const donVi = box.querySelector('.cat-dv').value;
    const oSoLuong = Array.from(box.querySelectorAll('.cat-sl-mau'));
    let daThem = 0;
    oSoLuong.forEach(o => {
      const sl = Math.floor(Number(o.value) || 0);
      if (sl <= 0) return;
      themVaoGio({ maHang: btn.dataset.mahang, tenHang: btn.dataset.ten, tenMau: o.dataset.mau, soLuong: sl, donVi });
      o.value = '';          // xóa ô sau khi đã cho vào giỏ, tránh bấm 2 lần thành gấp đôi
      daThem++;
    });
    if (!daThem) { alert('Hãy nhập số lượng (lớn hơn 0) cho ít nhất một màu.'); return; }
    moGioHang();
  }));
  // Helper: bộ ảnh của thẻ chứa phần tử này.
  const boAnhCua = (el) => {
    const card = el.closest('.cat-card');
    return { card, anh: (card && __theAnh[Number(card.dataset.card)]) || [] };
  };
  // Bấm ẢNH NHỎ -> đổi ảnh lớn (không mở lightbox, để xem nhanh từng ảnh ngay trên thẻ).
  grid.querySelectorAll('.cat-thumb').forEach(t => t.addEventListener('click', (e) => {
    e.stopPropagation();
    const { card, anh } = boAnhCua(t);
    const j = Number(t.dataset.i) || 0;
    const chinh = card.querySelector('.cat-main-img');
    if (chinh && anh[j]) { chinh.src = anh[j].src; chinh.alt = anh[j].title; chinh.dataset.i = String(j); }
    const dem = card.querySelector('.cat-img-count');
    if (dem) dem.textContent = `${j + 1}/${anh.length}`;
    card.querySelectorAll('.cat-thumb').forEach(x => x.classList.toggle('active', x === t));
  }));
  // Bấm ẢNH LỚN hoặc ảnh trong chip màu -> mở xem toàn màn hình, chuyển ‹ › qua hết bộ ảnh.
  grid.querySelectorAll('.act-cat-open').forEach(img => img.addEventListener('click', (e) => {
    e.stopPropagation();
    const { anh } = boAnhCua(img);
    openCatLightbox(anh, Number(img.dataset.i) || 0);
  }));
  grid.querySelectorAll('.cat-color-chip img.act-cat-zoom').forEach(img => img.addEventListener('click', (e) => {
    e.stopPropagation();
    const { anh } = boAnhCua(img);
    const vt = anh.findIndex(a => a.src === img.dataset.src);
    openCatLightbox(anh, vt >= 0 ? vt : 0);
  }));
}

// v5.3 (muc 1): ket hop CA 2 dieu kien - go ky tu bat ky (tim trong ten/ma hang, khong phan biet
// hoa/thuong, khop bat ky vi tri nao trong chuoi) VA loc theo the kho da chon (neu co).
// v5.4 (muc 1): them dieu kien thu 3 - loc theo Loai hang (nhom san pham) da chon (neu co).
function applyFilters() {
  const q = document.getElementById('catSearch').value.trim().toLowerCase();
  const loaiHang = document.getElementById('catFilterLoaiHang').value;
  // __allItems đã sắp xếp hàng mới trên cùng (loadCatalogue) → filter giữ nguyên thứ tự đó.
  const filtered = __allItems.filter(i => {
    const matchQ = !q || (i.tenHang || '').toLowerCase().includes(q) || (i.maHang || '').toLowerCase().includes(q);
    const matchLoaiHang = !loaiHang || i.loaiHang === loaiHang;
    return matchQ && matchLoaiHang;
  });
  renderGrid(filtered);
}
document.getElementById('catSearch').addEventListener('input', applyFilters);
document.getElementById('catFilterLoaiHang').addEventListener('change', applyFilters);

// v5.65: cuộn xuống thì THU GỌN phần tiêu đề đang dính trên đầu (đỡ chiếm chỗ trên điện thoại).
window.addEventListener('scroll', () => {
  const el = document.getElementById('catSticky');
  if (el) el.classList.toggle('cat-compact', (window.scrollY || document.documentElement.scrollTop || 0) > 40);
}, { passive: true });

// v5.63: kiểm tra khách đã đăng nhập chưa TRƯỚC khi vẽ lưới (để hiện/ẩn ô đặt hàng cho đúng).
taiPhienKhach().then(loadCatalogue);
