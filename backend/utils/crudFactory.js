const express = require('express');
const { sql, getPool } = require('../db');
const { requireAuth, requirePermission } = require('../middleware/auth');

/* ================================================================================================
   v7.36 — CHUAN HOA + CHONG TRUNG TEN TRONG DANH MUC
   ------------------------------------------------------------------------------------------------
   VI SAO: `LoaiVai.TenLoaiVai` CO rang buoc UNIQUE, nhung SQL Server BO QUA KHOANG TRANG CUOI khi so
   sanh chuoi — con khoang trang DAU va khoang trang DOI o giua thi KHONG bi chan. Nen "Tho karo
   Thang Lien 6111" va "Tho karo  Thang Lien 6111" (hai khoang trang) la HAI ban ghi hop le, hai ID
   khac nhau, nhin tren man hinh y het nhau.

   Da xay ra that: LoaiVaiID 2144 va 2153 cung ten "Tho karo Thang Lien 6111". Cay vai nhap vao 2144,
   Chi dinh vai SX tro 2153 => phep loc cay vai cho phep xuat (ghep bang LoaiVaiID) truot sach =>
   "co ton dung loai dung mau ma khong xuat duoc". 3 mau Lami cung dang bi nhu vay.

   CACH CHAN: truoc khi ghi, TRIM + gop moi day khoang trang thanh MOT khoang trang; roi kiem trung
   theo ten DA CHUAN HOA (bo dau cach hoan toan de bat ca truong hop go dinh lien). Trung thi bao ro
   ID dang giu ten do — de nguoi dung dung ban co san thay vi tao ban thu hai.
   ================================================================================================ */
function chuanTen(v) {
  return String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
}
/* Khoa so trung: bo HET khoang trang + khong phan biet hoa thuong. Bat duoc ca "AB" vs "A B". */
const SQL_KHOA_TEN = c => `REPLACE(LOWER(LTRIM(RTRIM(ISNULL(${c}, N'')))), N' ', N'')`;

/**
 * Tao 1 router CRUD chuan cho 1 bang danh muc don gian.
 * config:
 *   table:      ten bang trong SQL Server
 *   idCol:      ten cot khoa chinh
 *   columns:    [{ name, sqlType, required, trim, duyNhat }]
 *                 trim    = chuan hoa khoang trang truoc khi ghi
 *                 duyNhat = chan trung theo ten DA CHUAN HOA (tu bat trim)
 *   moduleCode: ma module de kiem tra quyen (vd 'DANHMUC')
 *   orderBy:    cot de sap xep khi liet ke (mac dinh idCol)
 */
function buildCrudRouter(config) {
  const router = express.Router();
  const { table, idCol, columns, moduleCode, orderBy } = config;

  /* Doc gia tri mot cot tu req.body, co chuan hoa neu cot khai trim/duyNhat. */
  const layGiaTri = (c, body) => {
    const v = body[c.name];
    if ((c.trim || c.duyNhat) && typeof v === 'string') return chuanTen(v);
    return v;
  };
  /* Kiem trung cho moi cot khai duyNhat. `boId` = ID dang sua (PUT) de khong tu bao trung voi chinh no. */
  const kiemTrung = async (pool, body, boId) => {
    for (const c of columns.filter(x => x.duyNhat)) {
      const val = layGiaTri(c, body);
      if (val === undefined || val === null || val === '') continue;
      const rq = pool.request().input('__v', c.sqlType, val);
      if (boId) rq.input('__boId', sql.Int, boId);
      const trung = (await rq.query(`
        SELECT TOP 3 ${idCol} AS Id, ${c.name} AS Ten FROM ${table}
        WHERE ${SQL_KHOA_TEN(c.name)} = ${SQL_KHOA_TEN('@__v')}
          ${boId ? `AND ${idCol} <> @__boId` : ''}
        ORDER BY ${idCol}`)).recordset;
      if (trung.length) {
        const ds = trung.map(t => `#${t.Id} "${t.Ten}"`).join(', ');
        throw new Error(`Đã có bản ghi mang tên này: ${ds}. `
          + 'Hãy dùng bản ghi đó thay vì tạo bản thứ hai — hai bản trùng tên khác ID sẽ làm '
          + '"chỉ định trỏ bản này, hàng trong kho trỏ bản kia" và không xuất kho được.');
      }
    }
  };

  router.get('/', requireAuth, requirePermission(moduleCode, 'view'), async (req, res) => {
    try {
      const pool = await getPool();
      const result = await pool.request().query(`SELECT * FROM ${table} ORDER BY ${orderBy || idCol}`);
      res.json({ success: true, data: result.recordset });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Lỗi khi tải danh sách ' + table });
    }
  });

  router.post('/', requireAuth, requirePermission(moduleCode, 'create'), async (req, res) => {
    try {
      const pool = await getPool();
      await kiemTrung(pool, req.body, null);   // v7.36: chan tao ban thu hai cung ten
      const request = pool.request();
      const cols = [], params = [];
      columns.forEach(c => {
        const val = layGiaTri(c, req.body);    // v7.36: chuan hoa khoang trang truoc khi ghi
        if (c.required && (val === undefined || val === null || val === '')) {
          throw new Error(`Thiếu trường bắt buộc: ${c.name}`);
        }
        request.input(c.name, c.sqlType, val === undefined ? null : val);
        cols.push(c.name); params.push('@' + c.name);
      });
      const result = await request.query(
        `INSERT INTO ${table} (${cols.join(',')}) OUTPUT INSERTED.* VALUES (${params.join(',')})`
      );
      res.json({ success: true, data: result.recordset[0] });
    } catch (err) {
      console.error(err);
      res.status(400).json({ success: false, message: err.message || ('Lỗi khi tạo mới ' + table) });
    }
  });

  router.put('/:id', requireAuth, requirePermission(moduleCode, 'edit'), async (req, res) => {
    try {
      const pool = await getPool();
      /* v7.36: sua ten thanh ten cua ban ghi khac cung bi chan — neu khong thi doi ten cung tao ra
         canh "hai ban trung ten khac ID" y nhu luc tao moi. */
      await kiemTrung(pool, req.body, parseInt(req.params.id, 10) || 0);
      const request = pool.request().input('__id', sql.Int, req.params.id);
      const sets = [];
      columns.forEach(c => {
        const val = layGiaTri(c, req.body);   // v7.36: chuan hoa khoang trang truoc khi ghi
        request.input(c.name, c.sqlType, val === undefined ? null : val);
        sets.push(`${c.name} = @${c.name}`);
      });
      const result = await request.query(
        `UPDATE ${table} SET ${sets.join(', ')} OUTPUT INSERTED.* WHERE ${idCol} = @__id`
      );
      if (!result.recordset.length) return res.status(404).json({ success: false, message: 'Không tìm thấy bản ghi.' });
      res.json({ success: true, data: result.recordset[0] });
    } catch (err) {
      console.error(err);
      res.status(400).json({ success: false, message: err.message || ('Lỗi khi cập nhật ' + table) });
    }
  });

  router.delete('/:id', requireAuth, requirePermission(moduleCode, 'delete'), async (req, res) => {
    try {
      const pool = await getPool();
      await pool.request().input('__id', sql.Int, req.params.id).query(`DELETE FROM ${table} WHERE ${idCol} = @__id`);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(400).json({ success: false, message: 'Không thể xóa (có thể đang được tham chiếu ở nơi khác).' });
    }
  });

  return router;
}

module.exports = { buildCrudRouter };
