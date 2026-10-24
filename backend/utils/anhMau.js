/* ================================================================================================
   ẢNH CỦA CÂY VẢI / MÀU VẢI — gắn vào các dòng đọc từ view                        v8.94 → v8.96
   ------------------------------------------------------------------------------------------------
   Hai nguồn ảnh, ưu tiên từ trên xuống:
     1. VaiCay.AnhCay   (migration_v883, v8.96) — ảnh của CHÍNH cây, chụp lúc nhập kho / bổ sung sau
     2. MauSac.AnhMau   (migration_v881, v8.94) — ảnh của màu, dùng khi cây chưa có ảnh riêng
   Nguyen 2026-10-22: "cột ảnh ở tồn cây và phiếu xuất lấy theo ảnh ở phiếu nhập" — tức theo CÂY.

   vw_TonCayVai / vw_TonKhoVai không lộ MauSacID nhưng có VaiID (và CayID ở view cây). Không sửa view
   (nhiều màn dùng chung; CSDL chưa migration mà view tham chiếu cột chưa có là vỡ) — đọc bản đồ rồi
   gắn vào từng dòng. Chưa chạy migration nào: mọi dòng AnhMau = null, không lỗi.
   Không cache kết quả dò cột (bài học v8.91).

   Trường gắn vào dòng vẫn tên `AnhMau` (frontend v8.94 đã đọc tên này ở 5 chỗ; đổi tên là bản JS cũ
   trong cache mất ảnh). `AnhMau` giờ nghĩa là "ảnh hiện cho dòng này", không chỉ ảnh màu.
   ================================================================================================ */
async function coCotAnhMau(pool) {
  try {
    const r = (await pool.request().query(`SELECT COL_LENGTH('MauSac','AnhMau') AS a`)).recordset[0] || {};
    return r.a != null;
  } catch (e) { return false; }
}
async function coCotAnhCay(pool) {
  try {
    const r = (await pool.request().query(`SELECT COL_LENGTH('VaiCay','AnhCay') AS a`)).recordset[0] || {};
    return r.a != null;
  } catch (e) { return false; }
}

/* Biểu thức SQL "ảnh hiện cho một cây" — cho câu nào đã JOIN sẵn VaiCay (bí danh `vc`) và MauSac (`ms`).
   Dò cột trước; thiếu cột nào thì bỏ vế đó. Trả về chuỗi luôn hợp lệ, kể cả khi cả hai đều chưa có. */
async function bieuThucAnhCay(pool, biDanhCay, biDanhMau) {
  const vc = biDanhCay || 'vc', ms = biDanhMau || 'ms';
  const [cay, mau] = await Promise.all([coCotAnhCay(pool), coCotAnhMau(pool)]);
  if (cay && mau) return `COALESCE(NULLIF(${vc}.AnhCay, N''), ${ms}.AnhMau)`;
  if (cay) return `${vc}.AnhCay`;
  if (mau) return `${ms}.AnhMau`;
  return `CAST(NULL AS NVARCHAR(500))`;
}

/* Gắn `AnhMau` (= ảnh hiện) vào từng dòng theo VaiID — cho bảng THEO MÃ VẢI (vw_TonKhoVai): chỉ có
   ảnh màu, vì một mã có nhiều cây. */
async function ganAnhMauTheoVai(pool, rows, khoa) {
  const k = khoa || 'VaiID';
  if (!Array.isArray(rows) || !rows.length) return rows;
  if (!(await coCotAnhMau(pool))) { rows.forEach(r => { if (r && r.AnhMau === undefined) r.AnhMau = null; }); return rows; }
  const rs = (await pool.request().query(`
    SELECT v.VaiID, ms.AnhMau
    FROM DanhMucVai v JOIN MauSac ms ON ms.MauSacID = v.MauSacID
    WHERE ms.AnhMau IS NOT NULL AND ms.AnhMau <> ''`)).recordset;
  const map = new Map(rs.map(x => [String(x.VaiID), x.AnhMau]));
  rows.forEach(r => { if (r) r.AnhMau = map.get(String(r[k])) || null; });
  return rows;
}

/* v8.96: Gắn `AnhMau` (= ảnh hiện) vào từng dòng theo CayID — cho mọi bảng THEO CÂY (vw_TonCayVai,
   form xuất, cây của NCC/phiếu nhập). Ảnh cây thắng, không có thì ảnh màu. */
async function ganAnhTheoCay(pool, rows, khoa) {
  const k = khoa || 'CayID';
  if (!Array.isArray(rows) || !rows.length) return rows;
  const bt = await bieuThucAnhCay(pool, 'vc', 'ms');
  if (/CAST\(NULL/.test(bt)) { rows.forEach(r => { if (r && r.AnhMau === undefined) r.AnhMau = null; }); return rows; }
  const ids = [...new Set(rows.map(r => Number(r && r[k])).filter(Number.isInteger))];
  if (!ids.length) return rows;
  const map = new Map();
  /* IN (...) theo lô 500 — danh sách tồn theo cây có thể vài nghìn dòng; một câu IN quá dài là chậm
     và có nguy cơ chạm giới hạn tham số. ids là số nguyên đọc từ CSDL, không phải input người dùng. */
  for (let i = 0; i < ids.length; i += 500) {
    const lo = ids.slice(i, i + 500);
    const rs = (await pool.request().query(`
      SELECT vc.CayID, ${bt} AS Anh
      FROM VaiCay vc
      JOIN DanhMucVai dv ON dv.VaiID = vc.VaiID
      LEFT JOIN MauSac ms ON ms.MauSacID = dv.MauSacID
      WHERE vc.CayID IN (${lo.join(',')})`)).recordset;
    rs.forEach(x => { if (x.Anh) map.set(String(x.CayID), x.Anh); });
  }
  rows.forEach(r => { if (r) r.AnhMau = map.get(String(r[k])) || null; });
  return rows;
}

module.exports = { coCotAnhMau, coCotAnhCay, bieuThucAnhCay, ganAnhMauTheoVai, ganAnhTheoCay };
