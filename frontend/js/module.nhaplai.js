/* ================================================================================================
   PHIEU NHAP LAI (hang khach tra)   (v6.66)
   Tab nam TRONG phan he "The kho hang hoa", quyen KHOHANG/nhaplai.

   LUONG LAM PHIEU (dung yeu cau nguoi dung):
     1. Chon KHACH HANG
     2. Chon PHIEU BAN HANG da xuat cho khach do
     3. Tich cac MA HANG trong phieu do roi danh SO LUONG tra lai
     (hoac) o "Tu tim ma hang" - van chi tim trong pham vi khach do da mua, vi gia KHOA CUNG theo
     phieu xuat: ma khach chua tung mua thi khong co gia nao de tra ma khong phai doan.

   GIA: form KHONG cho sua gia. Server cung khong doc gia client gui len - no tu truy ve dung dong
   da ban de lay gia. Nho vay so tra lai luon khop dung so da ghi no.
   ================================================================================================ */
(function () {
  let container = null, perm = {}, dsPhieu = [];

  const soCai = (r) => Number(r.SoLuongCai) || 0;

  async function render(el, user, tabKey) {
    container = el;
    perm = user.isAdmin ? { canView: 1, canCreate: 1, canEdit: 1, canDelete: 1 }
      : effectivePerm(user, 'KHOHANG', 'nhaplai', user.permissions.KHOHANG || {});
    await veDanhSach();
  }

  function boLocHtml() {
    return `
      <div class="toolbar" style="gap:8px;flex-wrap:wrap;align-items:flex-end;">
        <div><label>Từ ngày</label><input type="date" id="nlTuNgay"></div>
        <div><label>Đến ngày</label><input type="date" id="nlDenNgay"></div>
        <div><label>Khách hàng</label><input type="text" id="nlKhach" placeholder="Gõ một phần tên..."></div>
        <div><label>Số phiếu</label><input type="text" id="nlSoPhieu" placeholder="NL26..."></div>
        <button class="btn secondary" id="nlLoc">Lọc</button>
        <div style="flex:1"></div>
        ${perm.canCreate ? '<button class="btn" id="nlThem">+ Lập phiếu nhập lại</button>' : ''}
        <button class="btn secondary" id="nlExcel">Xuất Excel</button>
      </div>`;
  }

  function thamSoLoc() {
    const g = (id) => (document.getElementById(id) || {}).value || '';
    const p = new URLSearchParams();
    if (g('nlTuNgay')) p.set('tuNgay', g('nlTuNgay'));
    if (g('nlDenNgay')) p.set('denNgay', g('nlDenNgay'));
    if (g('nlKhach')) p.set('khach', g('nlKhach'));
    if (g('nlSoPhieu')) p.set('soPhieu', g('nlSoPhieu'));
    return p;
  }

  async function veDanhSach() {
    const body = document.getElementById('khBody') || container;
    body.innerHTML = boLocHtml() + '<div id="nlBang"><div class="empty-hint">Đang tải...</div></div>';
    ganSuKienLoc();
    await taiBang();
  }

  function ganSuKienLoc() {
    const n = (id, fn) => { const e = document.getElementById(id); if (e) e.onclick = fn; };
    n('nlLoc', taiBang);
    n('nlThem', () => openForm());
    n('nlExcel', () => {
      const p = thamSoLoc();
      taiFile('/api/nhaplai/phieu/export?' + p.toString(), 'PhieuNhapLai_DanhSach.xlsx');
    });
  }

  /* Tai file theo ten SERVER dat (Content-Disposition) - dung 1 kieu voi phieu ban hang v6.64.
     Tu dat a.download o client se de bay ten server da tinh cong tinh dat. */
  async function taiFile(url, tenDuPhong) {
    const r = await fetch(url, { credentials: 'include' });
    if (!r.ok) { toast('Không tải được file: ' + r.status, 'error'); return; }
    const cd = r.headers.get('content-disposition') || '';
    const khop = cd.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
    const blob = await r.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = khop ? decodeURIComponent(khop[1]) : tenDuPhong;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  async function taiBang() {
    const hop = document.getElementById('nlBang');
    if (!hop) return;
    hop.innerHTML = '<div class="empty-hint">Đang tải...</div>';
    const kq = await apiGet('/api/nhaplai/phieu?' + thamSoLoc().toString());
    dsPhieu = kq.data || [];
    if (!dsPhieu.length) {
      hop.innerHTML = '<div class="empty-hint">Chưa có phiếu nhập lại nào.</div>';
      return;
    }
    const tongTien = dsPhieu.filter(r => r.TrangThai !== 'Đã hủy').reduce((s, r) => s + (Number(r.TongThanhToan) || 0), 0);
    const tongSL = dsPhieu.filter(r => r.TrangThai !== 'Đã hủy').reduce((s, r) => s + (Number(r.TongSLCai) || 0), 0);
    hop.innerHTML = `
      <div class="table-wrap">
      <table class="data-table">
        <thead><tr>
          <th style="width:50px;">STT</th><th>Số phiếu</th><th>Ngày</th><th>Khách hàng</th>
          <th>Phiếu xuất gốc</th><th>Lý do</th><th class="num">SL (Cái)</th>
          <th class="num">Tiền trả lại</th><th>Trạng thái</th><th style="width:150px;">Thao tác</th>
        </tr></thead>
        <tbody>
          ${dsPhieu.map((r, i) => `
            <tr data-id="${r.PhieuNLID}" ${r.TrangThai === 'Đã hủy' ? 'style="opacity:.55;"' : ''}>
              <td>${i + 1}</td>
              <td><a href="#" class="nl-xem" data-id="${r.PhieuNLID}"><b>${escapeHtml(r.SoPhieu)}</b></a></td>
              <td>${fmtDate(r.NgayNhap)}</td>
              <td>${escapeHtml(r.TenKhach || '')}</td>
              <td>${escapeHtml(r.SoPhieuXuat || '')}</td>
              <td>${escapeHtml(r.LyDo || '')}</td>
              <td class="num">${fmtNumber(r.TongSLCai)}</td>
              <td class="num">${fmtTien(r.TongThanhToan)}</td>
              <td>${r.TrangThai === 'Đã hủy' ? '<span class="badge red">Đã hủy</span>' : '<span class="badge green">Hoàn thành</span>'}</td>
              <td>
                <button class="btn small secondary nl-xem" data-id="${r.PhieuNLID}">Xem</button>
                <button class="btn small secondary nl-xls" data-id="${r.PhieuNLID}">Excel</button>
                ${perm.canEdit && r.TrangThai !== 'Đã hủy' ? `<button class="btn small warn nl-huy" data-id="${r.PhieuNLID}">Hủy</button>` : ''}
                ${perm.canDelete ? `<button class="btn small danger nl-xoa" data-id="${r.PhieuNLID}">Xóa</button>` : ''}
              </td>
            </tr>`).join('')}
        </tbody>
        <tfoot><tr style="font-weight:700;background:#f4f6f8;">
          <td colspan="6">TỔNG CỘNG (không tính phiếu đã hủy)</td>
          <td class="num">${fmtNumber(tongSL)}</td>
          <td class="num">${fmtTien(tongTien)}</td>
          <td colspan="2"></td>
        </tr></tfoot>
      </table></div>`;
    hop.querySelectorAll('.nl-xem').forEach(b => b.onclick = (e) => { e.preventDefault(); xemPhieu(b.dataset.id); });
    hop.querySelectorAll('.nl-xls').forEach(b => b.onclick = () => taiFile(`/api/nhaplai/phieu/${b.dataset.id}/export`, 'PhieuNhapLai.xlsx'));
    hop.querySelectorAll('.nl-huy').forEach(b => b.onclick = async () => {
      if (!confirm('Hủy phiếu nhập lại này? Tồn kho và công nợ sẽ trả về như trước khi lập phiếu.')) return;
      const kq = await apiPut(`/api/nhaplai/phieu/${b.dataset.id}/huy`, {});
      toast(kq.message || 'Đã hủy phiếu.', kq.success ? 'success' : 'error');
      if (kq.success) taiBang();
    });
    hop.querySelectorAll('.nl-xoa').forEach(b => b.onclick = async () => {
      if (!confirm('XÓA HẲN phiếu nhập lại này? Không khôi phục được.')) return;
      const kq = await apiDelete(`/api/nhaplai/phieu/${b.dataset.id}`);
      toast(kq.message || 'Đã xóa phiếu.', kq.success ? 'success' : 'error');
      if (kq.success) taiBang();
    });
  }

  /* ================================================================================================
     FORM LAP PHIEU
     ================================================================================================ */
  async function openForm() {
    const dsKhach = (await apiGet('/api/nhaplai/khach')).data || [];
    if (!dsKhach.length) {
      toast('Chưa có phiếu bán hàng nào nên chưa có gì để nhập lại.', 'error');
      return;
    }
    const soPhieu = (await apiGet('/api/nhaplai/next-sophieu')).data || '';
    const homNay = new Date().toISOString().slice(0, 10);

    openModal(`
      <div class="modal-head"><h3>Lập phiếu nhập lại — hàng khách trả</h3></div>
      <div class="modal-body">
        <!-- v6.66.1: DAU PHIEU DUNG BANG KE 2 COT nhan/gia tri thay vi cac khoi div roi - nhin
             giong to phieu giay, doc theo hang de doi chieu, khong bi troi cot khi man hep. -->
        <table class="phieu-form">
          <tr>
            <th>Số phiếu</th>
            <td><input type="text" value="${escapeHtml(soPhieu)}" readonly style="width:100%;font-weight:700;"></td>
            <th>Ngày nhập lại <span class="bat-buoc">*</span></th>
            <td><input type="date" id="nlfNgay" value="${homNay}" style="width:100%;"></td>
          </tr>
          <tr>
            <th>Khách hàng <span class="bat-buoc">*</span></th>
            <td><select id="nlfKhach" style="width:100%;"><option value="">-- Chọn khách --</option>
              ${dsKhach.map(k => `<option value="${escapeHtml(k.TenKhach)}">${escapeHtml(k.TenKhach)} (${k.SoPhieu} phiếu)</option>`).join('')}
            </select></td>
            <th>Phiếu xuất (phiếu bán hàng) <span class="bat-buoc">*</span></th>
            <td><select id="nlfPhieu" style="width:100%;"><option value="">-- Chọn khách trước --</option></select></td>
          </tr>
          <tr>
            <th>Lý do trả</th>
            <td><input type="text" id="nlfLyDo" placeholder="Lỗi hàng / sai màu / khách đổi ý..." style="width:100%;"></td>
            <th>Ghi chú</th>
            <td><input type="text" id="nlfGhiChu" style="width:100%;"></td>
          </tr>
        </table>

        <div class="phieu-thanh-muc">
          <b>Chọn mã hàng cần nhập lại</b>
          <input type="text" id="nlfTim" placeholder="Lọc mã hàng / tên / màu trong bảng dưới..." style="flex:1;min-width:200px;">
          <label style="display:flex;gap:6px;align-items:center;font-weight:400;white-space:nowrap;">
            <input type="checkbox" id="nlfMoiPhieu"> Lấy tất cả mã đã mua (mọi phiếu)
          </label>
        </div>
        <div class="empty-hint" id="nlfGoiY" style="margin:0 0 6px;">
          Giá lấy nguyên từ phiếu xuất, không sửa được — để số tiền trả lại khớp đúng số đã ghi nợ.
        </div>
        <div id="nlfBang" class="table-wrap" style="max-height:340px;overflow:auto;">
          <div class="empty-hint">Chọn khách và phiếu xuất để hiện danh sách mã hàng.</div>
        </div>

        <div id="nlfTong" style="margin-top:10px;text-align:right;font-weight:700;"></div>
      </div>
      <div class="modal-foot">
        <button class="btn secondary" id="nlfHuy">Hủy</button>
        <button class="btn" id="nlfLuu">Lưu phiếu nhập lại</button>
      </div>`, { rong: true });

    const $ = (id) => document.getElementById(id);
    const dongHienTai = () => Array.from(document.querySelectorAll('#nlfBang tr[data-bct]'));

    $('nlfHuy').onclick = () => closeModal();
    $('nlfKhach').onchange = async () => {
      const ten = $('nlfKhach').value;
      const sel = $('nlfPhieu');
      $('nlfBang').innerHTML = '<div class="empty-hint">Chọn phiếu xuất...</div>';
      $('nlfTong').innerHTML = '';
      if (!ten) { sel.innerHTML = '<option value="">-- Chọn khách trước --</option>'; return; }
      const kh = dsKhach.find(k => k.TenKhach === ten) || {};
      sel.dataset.sdt = kh.SDT || ''; sel.dataset.diachi = kh.DiaChi || '';
      const ds = (await apiGet('/api/nhaplai/phieuxuat?tenKhach=' + encodeURIComponent(ten))).data || [];
      sel.innerHTML = '<option value="">-- Chọn phiếu xuất --</option>' + ds.map(p =>
        `<option value="${p.PhieuBHID}">${escapeHtml(p.SoPhieu)} — ${fmtDate(p.NgayBan)} — ${fmtTien(p.TongThanhToan)} đ</option>`).join('');
      if ($('nlfMoiPhieu').checked) taiDong();
    };
    $('nlfPhieu').onchange = taiDong;
    $('nlfMoiPhieu').onchange = taiDong;
    $('nlfTim').oninput = () => {
      const q = $('nlfTim').value.trim().toLowerCase();
      dongHienTai().forEach(tr => {
        tr.style.display = !q || tr.dataset.tim.includes(q) ? '' : 'none';
      });
    };

    async function taiDong() {
      const ten = $('nlfKhach').value;
      const pid = $('nlfPhieu').value;
      const moiPhieu = $('nlfMoiPhieu').checked;
      if (!ten) return;
      if (!moiPhieu && !pid) {
        $('nlfBang').innerHTML = '<div class="empty-hint">Chọn phiếu xuất để hiện các mã hàng trong phiếu đó.</div>';
        return;
      }
      $('nlfBang').innerHTML = '<div class="empty-hint">Đang tải...</div>';
      const kq = moiPhieu
        ? await apiGet('/api/nhaplai/timmahang?tenKhach=' + encodeURIComponent(ten))
        : await apiGet(`/api/nhaplai/phieuxuat/${pid}/dong`);
      const ds = (kq.data || []).filter(r => Number(r.ConTraCai) > 0);
      if (!ds.length) {
        $('nlfBang').innerHTML = '<div class="empty-hint">Không còn mã nào trả lại được (đã trả hết hoặc phiếu không có dòng nào).</div>';
        $('nlfTong').innerHTML = '';
        return;
      }
      $('nlfBang').innerHTML = `
        <table class="data-table">
          <thead><tr>
            <th style="width:40px;"></th><th style="width:50px;">STT</th>
            ${moiPhieu ? '<th>Phiếu xuất</th>' : ''}
            <th>Mã hàng</th><th>Tên hàng</th><th>Màu</th>
            <th class="num">Đã bán</th><th class="num">Đã trả</th><th class="num">Còn trả được</th>
            <th class="num">Giá bán</th><th style="width:110px;">SL trả (Cái)</th>
          </tr></thead>
          <tbody>
            ${ds.map((r, i) => `
              <tr data-bct="${r.PhieuBHChiTietID}" data-con="${r.ConTraCai}" data-gia="${Number(r.GiaBan) || 0}"
                  data-tim="${escapeHtml(((r.MaHang || '') + ' ' + (r.TenHang || '') + ' ' + (r.TenMau || '')).toLowerCase())}">
                <td><input type="checkbox" class="nl-tick"></td>
                <td>${i + 1}</td>
                ${moiPhieu ? `<td>${escapeHtml(r.SoPhieu || '')}</td>` : ''}
                <td><b>${escapeHtml(r.MaHang || '')}</b></td>
                <td>${escapeHtml(r.TenHang || '')}</td>
                <td>${escapeHtml(r.TenMau || '')}</td>
                <td class="num">${fmtNumber(soCai(r))}</td>
                <td class="num">${fmtNumber(r.DaTraCai)}</td>
                <td class="num"><b>${fmtNumber(r.ConTraCai)}</b></td>
                <td class="num">${fmtTien(r.GiaBan)}</td>
                <td><input type="number" class="nl-sl" min="0" step="1" max="${r.ConTraCai}" value="" style="width:95px;"></td>
              </tr>`).join('')}
          </tbody>
        </table>`;
      /* Tich o = mac dinh tra HET so con lai. Nguoi dung go de lai so it hon.
         Bo tich thi xoa so - de o lai se bi tinh vao phieu du da bo tich (bug rat de gap). */
      $('nlfBang').querySelectorAll('.nl-tick').forEach(cb => cb.onchange = () => {
        const tr = cb.closest('tr'), o = tr.querySelector('.nl-sl');
        o.value = cb.checked ? tr.dataset.con : '';
        tinhTong();
      });
      $('nlfBang').querySelectorAll('.nl-sl').forEach(o => o.oninput = () => {
        const tr = o.closest('tr');
        tr.querySelector('.nl-tick').checked = Number(o.value) > 0;
        tinhTong();
      });
      tinhTong();
    }

    /* Tong tinh o SERVER (POST /tinhthu) chu khong tu nhan o client: neu client tu tinh thi cong thuc
       se troi khoi backend luc nao khong biet - dung mot ban tinh duy nhat. */
    let hen = null;
    function tinhTong() {
      clearTimeout(hen);
      hen = setTimeout(async () => {
        const dong = layDong();
        if (!dong.length) { $('nlfTong').innerHTML = ''; return; }
        const kq = await apiPost('/api/nhaplai/tinhthu', { tenKhach: $('nlfKhach').value, dong });
        if (!kq.success) { $('nlfTong').innerHTML = `<span style="color:#c62828;">${escapeHtml(kq.message || 'Lỗi')}</span>`; return; }
        const t = kq.data.tong;
        $('nlfTong').innerHTML = `
          Tổng tiền hàng: ${fmtTien(t.tongTienHang)} &nbsp;|&nbsp;
          CK NPP (${t.ckNPP}%): ${fmtTien(t.tienCKNPP)} &nbsp;|&nbsp;
          VAT (${t.vat}%): ${fmtTien(t.tienVAT)} <br>
          <span style="font-size:16px;color:#1565c0;">TỔNG TRỪ CÔNG NỢ: ${fmtTien(t.tongThanhToan)} đ</span>`;
      }, 250);
    }
    function layDong() {
      return dongHienTai().map(tr => {
        const sl = Math.round(Number(tr.querySelector('.nl-sl').value) || 0);
        return sl > 0 ? { phieuBHChiTietID: Number(tr.dataset.bct), soLuongCai: sl } : null;
      }).filter(Boolean);
    }

    $('nlfLuu').onclick = async () => {
      const dong = layDong();
      if (!$('nlfKhach').value) return toast('Chưa chọn khách hàng.', 'error');
      if (!dong.length) return toast('Chưa tích mã hàng nào hoặc chưa nhập số lượng trả.', 'error');
      const sel = $('nlfPhieu');
      $('nlfLuu').disabled = true;
      const kq = await apiPost('/api/nhaplai/phieu', {
        ngayNhap: $('nlfNgay').value,
        tenKhach: $('nlfKhach').value,
        sdt: sel.dataset.sdt || null,
        diaChi: sel.dataset.diachi || null,
        phieuBHID: sel.value || null,
        lyDo: $('nlfLyDo').value || null,
        ghiChu: $('nlfGhiChu').value || null,
        dong
      });
      $('nlfLuu').disabled = false;
      if (!kq.success) return toast(kq.message || 'Lỗi khi lưu phiếu.', 'error');
      toast('Đã lưu phiếu ' + kq.data.soPhieu + ' — trừ công nợ ' + fmtTien(kq.data.tongThanhToan) + ' đ', 'success');
      closeModal();
      await taiBang();
      xemPhieu(kq.data.phieuNLID);
    };
  }

  /* ================================================================================================
     XEM CHI TIET + IN
     ================================================================================================ */
  /* DAU PHIEU dang BANG KE - dung chung boi man Xem va ban IN nen hai cho khong the lech nhau. */
  function dauPhieuHtml(h) {
    return `
      <table class="phieu-form phieu-xem">
        <tr><th>Số phiếu</th><td><b>${escapeHtml(h.SoPhieu || '')}</b></td>
            <th>Ngày nhập lại</th><td>${fmtDate(h.NgayNhap)}</td></tr>
        <tr><th>Khách hàng</th><td><b>${escapeHtml(h.TenKhach || '')}</b></td>
            <th>Điện thoại</th><td>${escapeHtml(h.SDT || '')}</td></tr>
        <tr><th>Địa chỉ</th><td colspan="3">${escapeHtml(h.DiaChi || '')}</td></tr>
        <tr><th>Phiếu xuất gốc</th><td>${escapeHtml(h.SoPhieuXuat || '(nhiều phiếu / tự chọn mã)')}</td>
            <th>Lý do trả</th><td>${escapeHtml(h.LyDo || '')}</td></tr>
        <tr><th>Ghi chú</th><td>${escapeHtml(h.GhiChu || '')}</td>
            <th>Người lập</th><td>${escapeHtml(h.NguoiTao || '')}</td></tr>
      </table>`;
  }

  /* ĐVT gốc của mã hàng (đơn vị lẻ, không phải đơn vị gộp) — dùng cho cột ĐVT như phiếu bán hàng. */
  function dvGoc(donViCoBan, donViQuyDoi) {
    return donViChinhLaGop({ DonViCoBan: donViCoBan, DonViQuyDoi: donViQuyDoi }) ? 'Cái' : (donViCoBan || 'Cái');
  }
  // ĐVT dùng chung của cả phiếu (mọi dòng cùng ĐVT thì mới ghi ở dòng tổng — cộng Cái với Bộ là vô nghĩa)
  function dvChungCuaPhieu(ct) {
    const bo = [...new Set(ct.map(r => dvGoc(r.DonViCoBan, r.DonViQuyDoi)))];
    return bo.length === 1 ? bo[0] : '';
  }

  /* ================================================================================================
     v6.66.2: BẢNG CHI TIẾT + KHỐI TỔNG IN THEO ĐÚNG KHUÔN PHIẾU BÁN HÀNG.
     Trước đây khối tổng là MỘT BẢNG RIÊNG đặt bên dưới -> cột tiền của nó không thẳng hàng với cột
     THÀNH TIỀN của bảng trên (2 bảng, 2 hệ chia cột). Nay các dòng tổng nằm NGAY TRONG bảng chi tiết,
     nhãn gộp `colspan=9` và số tiền rơi đúng vào ô cột 10 -> thẳng hàng tuyệt đối, không phụ thuộc
     bề rộng màn hình hay khổ giấy.
     Thứ tự dòng tổng GIỮ ĐÚNG mẫu Word của phiếu bán hàng, đổi chỗ là hai phiếu đọc lệch nhau.
     ================================================================================================ */
  function bangChiTietHtml(ct, h, choIn) {
    const dvChung = dvChungCuaPhieu(ct);
    /* Căn giữa/phải phải đặt INLINE trên TỪNG ô: bản in có CSS "th,td{text-align:left}" nên đặt ở
       <tr> hay class sẽ bị đè (kế thừa thua chọn theo thẻ) — bài học từ phiếu bán hàng v6.24. */
    const P = 'text-align:right;', G = 'text-align:center;';
    return `<table style="width:100%;border-collapse:collapse;table-layout:fixed;" border="1" cellpadding="4">
      <thead><tr style="background:#f1f3f4;">
        <th style="width:4%;${G}">STT</th><th style="width:12%;${G}">MÃ HÀNG</th>
        <th style="width:26%;${G}">TÊN HÀNG</th><th style="width:6%;${G}">ĐVT</th>
        <th style="width:8%;${G}">SỐ LƯỢNG</th><th style="width:11%;${G}">ĐVT QUY ĐỔI</th>
        <th style="width:10%;${G}">GIÁ BÁN LẺ<div style="font-weight:400;font-size:10px;">(đ/${escapeHtml(dvChung || 'ĐVT')})</div></th>
        <th style="width:6%;${G}">CK SHOP</th><th style="width:9%;${G}">GIÁ BÁN</th>
        <th style="width:13%;${G}">THÀNH TIỀN</th></tr></thead>
      <tbody>
        ${ct.map((r, i) => `<tr>
          <td style="${G}">${i + 1}</td>
          <td>${escapeHtml(r.MaHang || '')}</td>
          <td>${escapeHtml(r.TenHang || '')}${r.TenMau ? '<br><span style="font-style:italic;font-weight:bold;">Màu: ' + escapeHtml(r.TenMau) + '</span>' : ''}</td>
          <td style="${G}">${escapeHtml(dvGoc(r.DonViCoBan, r.DonViQuyDoi))}</td>
          <td style="${P}">${fmtNumber(r.SoLuongCai)}</td>
          <td style="${P}">${(() => {
            const he = Number(r.LoaiRi) || 1, cai = Number(r.SoLuongCai) || 0;
            if (he <= 1 || !cai) return '';
            const ri = Math.floor(cai / he), du = cai - ri * he;
            return `${fmtNumber(ri)} Ri${he}${du ? ` dư ${fmtNumber(du)}` : ''}`;
          })()}</td>
          <td style="${P}">${fmtTien(r.GiaBanLe)}</td>
          <td style="${G}">${fmtNumber(r.PhanTramCKShop)}%</td>
          <td style="${P}">${fmtTien(r.GiaBan)}</td>
          <td style="${P}"><b>${fmtTien(r.ThanhTien)}</b></td></tr>`).join('')}
        <tr style="font-weight:bold;background:#f1f3f4;">
          <td colspan="4" style="${G}">TỔNG CỘNG</td>
          <td style="${P}">${fmtNumber(h.TongSLCai)}${dvChung ? ' ' + escapeHtml(dvChung) : ''}</td>
          <td style="${P}">${(() => {
            const tong = ct.reduce((s, r) => {
              const he = Number(r.LoaiRi) || 1;
              return s + (he > 1 ? Math.floor((Number(r.SoLuongCai) || 0) / he) : 0);
            }, 0);
            return tong ? fmtNumber(tong) + ' Ri' : '';
          })()}</td>
          <td colspan="3"></td>
          <td style="${P}">${fmtTien(h.TongTienHang)}</td></tr>
        <tr><td colspan="9" style="${P}"><b>CK NPP</b> (${fmtNumber(h.PhanTramCKNPP)}% × tổng cộng)</td>
          <td style="${P}">${fmtTien(h.TienCKNPP)}</td></tr>
        <tr><td colspan="9" style="${P}"><b>TỔNG TIỀN HÀNG</b></td>
          <td style="${P}">${fmtTien(h.TienTruocVAT)}</td></tr>
        <tr><td colspan="9" style="${P}"><b>THUẾ GTGT</b> (${fmtNumber(h.PhanTramVAT)}%)</td>
          <td style="${P}">${fmtTien(h.TienVAT)}</td></tr>
        <tr style="font-weight:bold;background:#e8f0fe;"><td colspan="9" style="${P}">TỔNG TRỪ CÔNG NỢ KHÁCH HÀNG</td>
          <td style="${P}font-size:15px;">${fmtTien(h.TongThanhToan)}</td></tr>
      </tbody></table>`;
  }

  /* ================================================================================================
     v7.41 — KHOI CONG NO cuoi phieu nhap lai, giong phieu ban hang (module.khohang.js v7.29/v7.30):
         Công nợ trước phiếu <số>      (in cả khi = 0, ghi rõ "chưa phát sinh")
         Hàng trả lại (trừ công nợ)    (in số ÂM — nhìn ra ngay đây là khoản GIẢM nợ)
         CÔNG NỢ HIỆN TẠI
     ⚠️ KHÁC DẤU với phiếu bán hàng: bán hàng thì TỔNG CÔNG NỢ = trước + tiền phiếu; trả hàng thì
     CÔNG NỢ HIỆN TẠI = trước − tiền phiếu. Backend đã tính sẵn `TongCongNo` đúng dấu — ở đây KHÔNG
     tính lại, chỉ in ra, để hai nơi không thể lệch nhau.
     Thiếu dữ liệu thì IN DÒNG ĐỎ báo rõ chứ không bỏ mất khối — bài học v7.29: một dòng báo thiếu
     còn hơn một phiếu sai im lặng (vụ PX26093 mất dòng công nợ mà không ai biết).
     ================================================================================================ */
  function khoiCongNoNhapLaiHtml(h) {
    if (h.CongNoTruoc == null) {
      console.warn('[phieu nhap lai] THIEU CongNoTruoc khi in phieu', h.SoPhieu,
        '- goi /api/nhaplai/phieu/:id de lay du header.');
      return `<table style="width:56%;margin-left:auto;margin-top:6px;">
        <tr><td style="text-align:right;color:#a00;">Công nợ trước phiếu ${escapeHtml(h.SoPhieu || '')}</td>
          <td style="text-align:right;width:38%;color:#a00;">(không lấy được)</td></tr></table>`;
    }
    const khong = Number(h.CongNoTruoc) === 0;
    return `<table style="width:56%;margin-left:auto;margin-top:6px;">
      <tr><td style="text-align:right;">Công nợ trước phiếu ${escapeHtml(h.SoPhieu || '')}${khong ? ' <span style="font-weight:normal;">(chưa phát sinh)</span>' : ''}</td>
        <td style="text-align:right;width:38%;">${fmtTien(h.CongNoTruoc)}</td></tr>
      <tr><td style="text-align:right;">Hàng trả lại (trừ công nợ)</td>
        <td style="text-align:right;color:#c0392b;">−${fmtTien(h.TongThanhToan)}</td></tr>
      <tr style="font-weight:bold;background:#fff3e0;"><td style="text-align:right;">CÔNG NỢ HIỆN TẠI</td>
        <td style="text-align:right;font-size:15px;">${fmtTien(h.TongCongNo)}</td></tr></table>`;
  }

  async function xemPhieu(id) {
    const kq = await apiGet('/api/nhaplai/phieu/' + id);
    if (!kq.success) return toast(kq.message || 'Không mở được phiếu.', 'error');
    const h = kq.data.header, ct = kq.data.chiTiet || [];
    openModal(`
      <div class="modal-head"><h3>Phiếu nhập lại ${escapeHtml(h.SoPhieu)}
        ${h.TrangThai === 'Đã hủy' ? '<span class="badge red">Đã hủy</span>' : ''}</h3></div>
      <div class="modal-body">
        ${dauPhieuHtml(h)}
        ${bangChiTietHtml(ct, h, false)}
        ${khoiCongNoNhapLaiHtml(h) /* v7.41 */}
      </div>
      <div class="modal-foot">
        <button class="btn secondary" id="nlvDong">Đóng</button>
        <button class="btn secondary" id="nlvXls">Xuất Excel</button>
        <button class="btn" id="nlvIn">In phiếu</button>
      </div>`, { rong: true });
    document.getElementById('nlvDong').onclick = () => closeModal();
    document.getElementById('nlvXls').onclick = () => taiFile(`/api/nhaplai/phieu/${id}/export`, 'PhieuNhapLai.xlsx');
    document.getElementById('nlvIn').onclick = () => inPhieu(h, ct);
  }

  function inPhieu(h, ct) {
    /* Ten file PDF: Chrome lay TITLE cua trang chinh lam ten mac dinh khi "Luu thanh PDF"
       (printHtml v6.65 da doi title trang chinh trong luc in). Bo ky tu Windows cam trong ten file. */
    const tieuDe = `PhieuNhapLai ${h.SoPhieu || ''}${h.TenKhach ? ' - ' + String(h.TenKhach).replace(/[\\/:*?"<>|]/g, '-') : ''}`;
    printHtml(tieuDe, `
      ${phieuHeaderHtml('PHIẾU NHẬP LẠI HÀNG (KHÁCH TRẢ)', h.NgayNhap, h.SoPhieu)}
      ${dauPhieuHtml(h)}
      ${bangChiTietHtml(ct, h, true)}
      ${khoiCongNoNhapLaiHtml(h) /* v7.41 */}
      <p style="margin-top:6px;"><i>Bằng chữ: ${escapeHtml(docSoTienBangChu(h.TongThanhToan))}</i></p>
      <table style="width:100%;margin-top:28px;text-align:center;">
        <tr><td><b>NGƯỜI TRẢ HÀNG</b><br><i>(Ký, ghi rõ họ tên)</i></td>
            <td><b>THỦ KHO</b><br><i>(Ký, ghi rõ họ tên)</i></td>
            <td><b>NGƯỜI LẬP PHIẾU</b><br><i>(Ký, ghi rõ họ tên)</i></td></tr>
      </table>`);
  }

  window.ModuleNhapLai = { render, xemPhieu };
})();
