const fs = require('fs');
const sql = require('mssql');
const path = require('path');

require('dotenv').config(); 

// Configurações de conexão com o banco de dados SQL Server
const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE_NAME,
    options: {
        encrypt: true, // Se você estiver usando Azure SQL, defina como true
        trustServerCertificate: true // Se você estiver usando Azure SQL, defina como true
    }
};

// Função para inserir os membros do arquivo JSON no banco de dados
async function insertMembersFromJson(jsonFilePath, pool) {
    try {
        // Ler o arquivo JSON
        const rawData = fs.readFileSync(jsonFilePath);
        const members = JSON.parse(rawData);

        // Iterar sobre os membros e inseri-los no banco de dados
        for (const member of members) {
            const {
                id,
                fullName,
                username
            } = member;

            // Construir o email
            const email = `${username}@trello.com`;

            const result = await pool.request()
                .input('trelloId', sql.VarChar, id)
                .query('SELECT COUNT(*) AS count FROM [User] WHERE trelloIdUser = @trelloId');

            if (result.recordset[0].count <= 0) {

                // Inserir o membro na tabela Member
                await pool.request().query(`
                INSERT INTO [User] (trelloIdUser, pwd, username, email, profileUrl, lastLoggedIn, createdAt, updatedAt)
                VALUES ('${id}', 'e10adc3949ba59abbe56e057f20f883e', '${username}', '${email}', '', GETDATE(), GETDATE(), GETDATE())
            `);
                console.log(`User '${fullName}' inserido com sucesso.`);
            } else {
                console.log(`User '${fullName}' ja existe`);

            }
        }
    } catch (error) {
        console.error(`Ocorreu um erro ao inserir User do arquivo ${jsonFilePath}:`, error);
    }
}

// Função principal para processar os diretórios e inserir membros no banco de dados
async function processDirectories(rootDirectory, pool) {
    try {
        // Lê o conteúdo do diretório
        const items = fs.readdirSync(rootDirectory);

        for (const item of items) {
            const itemPath = path.join(rootDirectory, item);
            const stats = fs.statSync(itemPath);

            if (stats.isDirectory()) {
                // Se for um diretório, chama recursivamente a função para processar subdiretórios
                await processDirectories(itemPath, pool);
            } else if (path.extname(itemPath) === '.json' && item === 'undefined.json') {
                // Se for um arquivo JSON, processa os dados
                await insertMembersFromJson(itemPath, pool);
            }
        }
    } catch (error) {
        console.error(`Ocorreu um erro ao processar os diretórios em ${rootDirectory}:`, error);
    }
}

// Função principal para conectar ao banco de dados e processar os diretórios
async function main() {
    try {
        // Conecta ao banco de dados
        const pool = await sql.connect(config);

        // Processa os diretórios principais
        await processDirectories('C:\\Users\\luizf\\OneDrive\\Desktop\\backUpTrello\\trelloRestoreMember', pool);

        // Fecha a conexão com o banco de dados
        await pool.close();
    } catch (error) {
        console.error(`Ocorreu um erro durante o processamento:`, error);
    }
}

// Executa a função principal
main();