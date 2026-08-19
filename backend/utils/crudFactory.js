const express = require('express');
const { sql, getPool } = require('../db');
const { requireAuth, requirePermission } = require('../middleware/auth');

/**
 * Tao 1 router CRUD chuan cho 1 bang danh muc don gian.
 * config:
 *   table:      ten bang trong SQL Server
 *   idCol:      ten cot khoa chinh
 *   columns:    [{ name, sqlType, required }]  - cac cot cho phep ghi (khong bao gom idCol)
 *   moduleCode: ma module de kiem tra quyen (vd 'DANHMUC')
 *   orderBy:    cot de sap xep khi liet ke (mac dinh idCol)
 */
function buildCrudRouter(config) {
  const router = express.Router();
  const { table, idCol, columns, moduleCode, orderBy } = config;

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
      const request = pool.request();
      const cols = [], params = [];
      columns.forEach(c => {
        const val = req.body[c.name];
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
      const request = pool.request().input('__id', sql.Int, req.params.id);
      const sets = [];
      columns.forEach(c => {
        const val = req.body[c.name];
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
