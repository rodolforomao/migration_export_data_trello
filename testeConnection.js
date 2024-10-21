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
        // Conecta ao banco de dados
        let pool = await sql.connect(config);
        console.log('Conexão bem-sucedida!');

        // Executa uma consulta de teste
        const result = await pool.request().query('SELECT 1 AS number');
        console.log('Resultado da consulta:', result.recordset);

        // Fecha a conexão
        await sql.close();
    } catch (err) {
        console.error('Erro ao conectar ao banco de dados:', err);
    }
}

testConnection();
