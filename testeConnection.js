const sql = require('mssql');
require('dotenv').config();

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE_NAME,
    options: {
        encrypt: true,
        trustServerCertificate: true
    }
};

async function testConnection() {
    try {
        const pool = await sql.connect(config);
        console.log('Conexão bem-sucedida!');
        await sql.close();
        return true;
    } catch (err) {
        console.error('Erro ao conectar ao banco de dados:', err);
        return false;
    }
}

module.exports = { testConnection };
