/* ================================================================================================
   BO MAY DOI SOAT NGAN HANG   (v6.74)
   Dung CHUNG cho ca 3 duong nap giao dich (nhap sao ke / webhook / go tay). Chi co MOT ban logic
   khop o day — neu moi duong tu khop mot kieu thi cung mot giao dich vao bang 2 duong se ra 2 ket
   qua khac nhau, va khong ai giai thich noi vi sao.
   ================================================================================================ */
const crypto = require('crypto');
const { sql } = require('../db');

function so(v) { const n = Number(v); return isFinite(n) ? n : 0; }

/* Bo dau tieng Viet + gom khoang trang -> so khop ten khach trong noi dung chuyen khoan.
   Khach go "CTY AN BINH CK" hay "Cty An Bình chuyển khoản" deu phai ra cung mot chuoi de so. */
function khongDau(s) {
  const boDau = new RegExp('[\\u0300-\\u036f]', 'g');
  return String(s || '').normalize('NFD').replace(boDau, '')
    .replace(new RegExp('đ', 'g'), 'd').replace(new RegExp('Đ', 'g'), 'D')
    .toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
}

/* KHOA CHONG TRUNG: nhap lai cung file sao ke 2 lan KHONG duoc sinh 2 giao dich.
   Bam SHA-256 tu (tai khoan + ngay + so tien + noi dung + so tham chieu). Dung so tham chieu KHONG
   DU: nhieu ngan hang xuat sao ke Excel khong co cot do. */
function khoaTrung(bankTKID, ngay, soTien, noiDung, soThamChieu) {
  const chuoi = [
    bankTKID,
    String(ngay || '').slice(0, 10),
    Math.round(so(soTien) * 100),
    khongDau(noiDung),
    khongDau(soThamChieu)
  ].join('|');
  return crypto.createHash('sha256').update(chuoi, 'utf8').digest('hex').slice(0, 64);
}

/* ================================================================================================
   TIM MA PHIEU TRONG NOI DUNG CHUYEN KHOAN
   So phieu ban hang: PX + 2 so nam + 3 so  (vd PX26001); tien to cu PBH van con du lieu that.
   Ngan hang thuong VIET LIEN hoac chen dau cach lung tung ("CK PX 26001", "px26001 thanh toan"),
   nen do tren chuoi DA BO HET ky tu khong phai chu/so.
   ================================================================================================ */
function timMaPhieu(noiDung) {
  const s = khongDau(noiDung).replace(/ /g, '');
  const m = s.match(/(PX|PBH)(\d{2})(\d{3,})/);
  return m ? (m[1] + m[2] + m[3]) : null;
}

/* ================================================================================================
   KHOP 1 GIAO DICH.
   Tra ve { tenKhach, phieuBHID, doTinCay, lyDo }.
   THANG DO TIN CAY — co y de THUA HAI MUC, khong phai 0/1:
     100  co ma phieu trong noi dung VA phieu do co that      -> chac chan, cho phep tu sinh phieu thu
      70  khong co ma, nhung TEN KHACH xuat hien trong noi dung va so tien KHOP dung mot phieu con no
      40  chi doan duoc ten khach (so tien khong khop phieu nao)
       0  khong doan duoc gi
   Chi tu dong ghi so khi >= muc cau hinh (mac dinh 100). Muc 70/40 chi GOI Y cho ke toan bam duyet —
   tu dong ghi so mot khoan doan sai la sai ca cong no lan bao cao, sua rat met.
   ================================================================================================ */
async function khopGiaoDich(pool, gd) {
  const noiDung = gd.NoiDung || gd.noiDung || '';
  const soTien = so(gd.SoTien != null ? gd.SoTien : gd.soTien);
  if (soTien <= 0) return { doTinCay: 0, lyDo: 'Giao dịch tiền ra — không đối soát công nợ khách.' };

  // (1) Khop theo MA PHIEU trong noi dung
  const ma = timMaPhieu(noiDung);
  if (ma) {
    const p = (await pool.request().input('sp', sql.NVarChar, ma).query(`
      SELECT PhieuBHID, SoPhieu, TenKhach, TongThanhToan
      FROM PhieuBanHang WHERE SoPhieu = @sp AND TrangThai <> N'Đã hủy'`)).recordset[0];
    if (p) {
      return {
        tenKhach: String(p.TenKhach || '').trim(),
        phieuBHID: p.PhieuBHID,
        doTinCay: 100,
        lyDo: `Nội dung có mã phiếu ${p.SoPhieu} của khách "${p.TenKhach}".`
      };
    }
  }

  // (2) Do TEN KHACH trong noi dung. Lay ten dai truoc -> "An Binh" khong nuot mat "An Binh 2".
  const dsKhach = (await pool.request().query(`
    SELECT LTRIM(RTRIM(TenKhach)) AS Ten FROM PhieuBanHang
    WHERE TrangThai <> N'Đã hủy' AND NULLIF(LTRIM(RTRIM(TenKhach)), '') IS NOT NULL
    GROUP BY LTRIM(RTRIM(TenKhach))`)).recordset.map(r => r.Ten);
  const nd = khongDau(noiDung).replace(/ /g, '');
  const khop = dsKhach
    .map(t => ({ ten: t, k: khongDau(t).replace(/ /g, '') }))
    .filter(x => x.k.length >= 4 && nd.includes(x.k))
    .sort((a, b) => b.k.length - a.k.length);
  if (!khop.length) return { doTinCay: 0, lyDo: 'Không tìm thấy mã phiếu hay tên khách nào trong nội dung.' };

  const tenKhach = khop[0].ten;
  // (3) So tien co trung dung mot phieu chua thu het cua khach do khong?
  const pTien = (await pool.request()
    .input('ten', sql.NVarChar, tenKhach)
    .input('tien', sql.Decimal(18, 2), soTien).query(`
      SELECT TOP 2 p.PhieuBHID, p.SoPhieu
      FROM PhieuBanHang p
      WHERE p.TrangThai <> N'Đã hủy' AND LTRIM(RTRIM(p.TenKhach)) = @ten
        AND ABS(p.TongThanhToan - @tien) < 1
        AND ISNULL((SELECT SUM(t.SoTien) FROM PhieuThu t WHERE t.PhieuBHID = p.PhieuBHID), 0) = 0
      ORDER BY p.NgayBan DESC`)).recordset;
  if (pTien.length === 1) {
    return {
      tenKhach, phieuBHID: pTien[0].PhieuBHID, doTinCay: 70,
      lyDo: `Nội dung có tên khách "${tenKhach}" và số tiền khớp đúng phiếu ${pTien[0].SoPhieu} chưa thu.`
    };
  }
  return {
    tenKhach, phieuBHID: null, doTinCay: 40,
    lyDo: pTien.length > 1
      ? `Nội dung có tên khách "${tenKhach}" nhưng có ${pTien.length}+ phiếu cùng số tiền — cần chọn tay.`
      : `Đoán được khách "${tenKhach}" theo nội dung, nhưng số tiền không khớp phiếu nào.`
  };
}

module.exports = { so, khongDau, khoaTrung, timMaPhieu, khopGiaoDich };
