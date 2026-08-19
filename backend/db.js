const sql = require('mssql');
require('dotenv').config();

// Ho tro ca 2 kieu khai bao DB_SERVER:
//  - "localhost"              -> instance mac dinh, dung DB_PORT (thuong la 1433)
//  - "localhost\\SQLEXPRESS"  -> named instance, PHAI tach rieng ten server va ten instance
//    (mssql/tedious se tu tim cong dong qua dich vu "SQL Server Browser" - port UDP 1434 -
//    KHONG dung chung DB_PORT trong truong hop nay, dua port vao se gay loi ket noi).
const rawServer = process.env.DB_SERVER || 'localhost';
const [serverHost, instanceName] = rawServer.split('\\');

const config = {
  server: serverHost,
  database: process.env.DB_NAME || 'QLNoiBo',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_CERT !== 'false',
    ...(instanceName ? { instanceName } : {})
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 }
};

// Chi gan port khi KHONG dung named instance - named instance dung SQL Server Browser
// de tu do tim dung cong, khai bao ca instanceName lan port cung luc se gay xung dot.
if (!instanceName) {
  config.port = Number(process.env.DB_PORT) || 1433;
}

let poolPromise = null;

function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config)
      .connect()
      .then(pool => {
        console.log('[DB] Da ket noi SQL Server:', rawServer + '/' + config.database);
        return pool;
      })
      .catch(err => {
        poolPromise = null;
        console.error('[DB] Loi ket noi SQL Server:', err.message);
        throw err;
      });
  }
  return poolPromise;
}

module.exports = { sql, getPool };
