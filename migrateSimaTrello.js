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

// Função para verificar se o trelloIdProject já existe no banco de dados
async function checkIfTrelloIdExists(trelloId, pool) {
    try {
        const result = await pool.request()
            .input('trelloId', sql.VarChar, trelloId)
            .query('SELECT COUNT(*) AS count FROM Desktop WHERE trelloIdProject = @trelloId');
        return result.recordset[0].count > 0;
    } catch (error) {
        console.log('Ocorreu um erro ao verificar se o trelloIdProject existe:');
        return false;
    }
}

// Função para verificar se o trelloIdCard já existe no banco de dados
async function checkIfTrelloIdCardExists(trelloId, pool) {
    try {
        const result = await pool.request()
            .input('trelloId', sql.VarChar, trelloId)
            .query('SELECT COUNT(*) AS count FROM Project WHERE trelloIdCard = @trelloId');
        return result.recordset[0].count > 0;
    } catch (error) {
        console.log('Ocorreu um erro ao verificar se o trelloIdCard existe:');
        return false;
    }
}

// Função para ler e inserir os dados do arquivo organization.json no banco de dados
async function insertOrganizationData(directoryPath, pool) {
    try {
        const filePath = path.join(directoryPath, 'organization.json');

        // Verifica se o caminho é um arquivo
        if (fs.statSync(filePath).isFile()) {
            // Lê o arquivo JSON
            const rawData = fs.readFileSync(filePath);
            const data = JSON.parse(rawData);

            // Verifica se o trelloIdProject já existe no banco de dados
            const trelloIdExists = await checkIfTrelloIdExists(data.id, pool);
            if (trelloIdExists) {
                console.log(`O Desktop ${data.id} já existe no banco de dados. Continuando o processo.`);
            } else {
                // Insere os dados na tabela Desktop
                await pool.request().query(`
                    INSERT INTO Desktop (nameDesktop, trelloIdProject, createdAt, userId) 
                    VALUES ('${data.displayName}', '${data.id}', GETDATE(), 1);
                `);

                console.log(`Dados do arquivo ${filePath} inseridos com sucesso.`);
            }

            // Executa o processo para a tabela Project
            await insertProjectData(directoryPath, data.id, pool);
        } else {
            console.log(`O caminho ${filePath} não aponta para um arquivo. Pulando para o próximo.`);
        }
    } catch (error) {
        console.log(`Ocorreu um erro ao inserir dados do arquivo organization.json:`);
    }
}


// Função para ler e inserir os dados do arquivo board.json no banco de dados
async function insertProjectData(directoryPath, pool) {
    try {
        const filePath = path.join(directoryPath, 'board.json');

        // Verifica se o arquivo existe
        if (!fs.existsSync(filePath)) {
           console.log(`O arquivo ${filePath} não foi encontrado.`);
        }

        // Lê o arquivo JSON
        const rawData = fs.readFileSync(filePath);
        const data = JSON.parse(rawData);
        const trelloIdOrganization = data.idOrganization;

        // Verifica se o trelloIdCard já existe no banco de dados
        const trelloIdCardExists = await checkIfTrelloIdCardExists(data.id, pool);
        if (trelloIdCardExists) {
            console.log(`O Project ${data.id} já existe no banco de dados. Continuando o processo.`);

            // Executa a função para inserir dados da lista
            await insertListData(directoryPath, data.id, pool);
        } else {
            // Insere os dados na tabela Project
            await pool.request().query(`
                INSERT INTO Project (name, createdAt, updatedAt, userId, desktopId, trelloIdCard) 
                VALUES ('${data.name}', GETDATE(), GETDATE(), 1, (
                    SELECT id FROM Desktop WHERE trelloIdProject = '${trelloIdOrganization}'
                ), '${data.id}')
            `);

            console.log(`Dados do arquivo ${filePath} inseridos com sucesso.`);

        }
    } catch (error) {
        console.log(`Ocorreu um erro ao inserir dados do arquivo board.json:`);
    }
}

// Função para ler e inserir os dados do arquivo list.json no banco de dados
async function insertListData(directoryPath, pool) {
    try {
        const filePath = path.join(directoryPath, 'list.json');

        // Verifica se o arquivo existe
        if (!fs.existsSync(filePath)) {
            console.log(`O arquivo ${filePath} não foi encontrado.`);
        }

        // Lê o arquivo JSON
        const rawData = fs.readFileSync(filePath);
        const data = JSON.parse(rawData);

        // Insere os dados na tabela List
        const request = pool.request();
        request.input('name', sql.NVarChar, data.name);
        request.input('projectId', sql.NVarChar, data.idBoard);
        request.input('trelloIdList', sql.NVarChar, data.id);

        const result = await pool.request()
            .input('trelloId', sql.VarChar, data.id)
            .query('SELECT COUNT(*) AS count FROM List WHERE trelloIdList = @trelloId');

        if (result.recordset[0].count <= 0) {

            const query = `
        INSERT INTO List (name, [order], createdAt, updatedAt, projectId, trelloIdList)
        VALUES (
            @name, 
            (SELECT ISNULL(MAX([order]), 0) + 1 FROM List WHERE projectId = (SELECT id FROM Project WHERE trelloIdCard = @projectId)),
            GETDATE(), 
            GETDATE(), 
            (SELECT id FROM Project WHERE trelloIdCard = @projectId), 
            @trelloIdList
        )
        
        `;

            await request.query(query);
            console.log(`A List ${filePath}  já existe no banco de dados. Continuando o processo.`);
        } else {
            console.log(`Dados do arquivo ${filePath} ja existe.`);

        }

    } catch (error) {
        console.log(`Ocorreu um erro ao inserir dados do arquivo list.json:`);
    }
}

// Função para ler e inserir os dados do arquivo card.json no banco de dados
async function processCardFile(cardFilePath, pool) {
    try {

        const filePath = path.join(cardFilePath, 'card.json');

        // Verifica se o arquivo existe
        if (!fs.existsSync(filePath)) {
           console.log(`O arquivo ${filePath} não foi encontrado.`);
        }

        // Lê o arquivo JSON
        const rawData = fs.readFileSync(filePath);
        const data = JSON.parse(rawData);

        // Substitui as aspas simples por duplas nos valores de 'name' e 'desc'
        data.name = replaceQuotes(data.name);
        data.desc = replaceQuotes(data.desc);

        // Insere os dados na tabela Issue
        const request = pool.request();
        request.input('name', sql.NVarChar, data.name);
        request.input('desc', sql.NVarChar, data.desc);
        request.input('idList', sql.NVarChar, data.idList);
        request.input('idMembers', sql.NVarChar, (data.idMembers[0]));
        request.input('trelloIdIssue', sql.NVarChar, data.id);

        const result = await pool.request()
            .input('trelloId', sql.VarChar, data.id)
            .query('SELECT COUNT(*) AS count FROM Issue WHERE trelloIdIssue = @trelloId');

        if (result.recordset[0].count <= 0) {
            const query = `
        INSERT INTO Issue ([order], priority, type, summary, descr, createdAt, updatedAt, listId, reporterId, codigoSei, dataPrazo, trelloIdIssue, listBadge)
        VALUES (
            (SELECT ISNULL(MAX([order]), 0) + 1 FROM Issue WHERE listId = (SELECT id FROM List WHERE trelloIdList = @idList)),
            0,
            0,
            @name,
            @desc,
            GETDATE(),
            GETDATE(),
            (SELECT id FROM List WHERE trelloIdList = @idList),
            iif((SELECT id FROM [User] WHERE trelloIdUser = @idMembers) is null, 1, (SELECT id FROM [User] WHERE trelloIdUser = @idMembers)),
            NULL,
            NULL,
            @trelloIdIssue,
            NULL
        )
    `;
            await request.query(query);
            console.log(`O Issue ${filePath}  já existe no banco de dados. Continuando o processo.`);

        } else {
            console.log(`Os dados do arquivo ${filePath} já existem.`);
        }
    } catch (error) {
        console.log(`Ocorreu um erro ao inserir dados do arquivo card.json:`);
    }
}


function replaceQuotes(text) {
    if (typeof text === 'string') {
        return text.replace(/'/g, '"');
    }
    return text;
}


// Função para ler e inserir os dados do arquivo actions.json no banco de dados
async function processActionsFile(actionsFilePath, pool) {
    try {

        const filePath = path.join(actionsFilePath, 'actions.json');

        // Verifica se o arquivo existe
        if (!fs.existsSync(filePath)) {
            console.log(`O arquivo ${filePath} não foi encontrado.`);
        }

        // Lê o arquivo JSON
        const rawData = fs.readFileSync(filePath);
        const actions = JSON.parse(rawData);

        // Itera sobre cada ação no arquivo
        for (const action of actions) {
            // Verifica se a ação é do tipo "commentCard"
            if (action.type === "commentCard") {
                // Insere os dados na tabela Comment
                const request = pool.request();
                request.input('descr', sql.NVarChar, action.data.text);
                request.input('createdAt', sql.DateTime, new Date(action.date));
                request.input('issueId', sql.NVarChar, action.data.card.id);
                request.input('userId', sql.NVarChar, action.idMemberCreator);
                request.input('trelloIdAction', sql.NVarChar, action.id);

                const result = await pool.request()
                    .input('trelloIdAction', sql.NVarChar, action.id)
                    .query('SELECT COUNT(*) AS count FROM Comment WHERE trelloIdAction = @trelloIdAction');

                if (result.recordset[0].count <= 0) {

                    const query = `
                INSERT INTO Comment (descr, createdAt, issueId, userId, trelloIdAction)
                VALUES (@descr, 
                @createdAt, 
                (SELECT id FROM Issue where trelloIdIssue = @issueId),
                iif((SELECT id FROM [User] where trelloIdUser = @userId)is null,1,(SELECT id FROM [User] where trelloIdUser = @userId)),
                @trelloIdAction);
                `;

                    await request.query(query);

                    console.log(`Dados do arquivo ${filePath} inseridos na tabela Comment com sucesso.`);
                }
            } else {
                console.log(`O Comment ${filePath}  já existe no banco de dados. Continuando o processo.`);
            }
        }
    } catch (error) {
        console.log(`Ocorreu um erro ao inserir dados do arquivo actions.json:`);
    }
}

// Função principal para conectar ao banco de dados e processar os diretórios
async function main() {
    try {
        // Conecta ao banco de dados
        const pool = await sql.connect(config);

        // Caminho raiz onde estão as pastas
        const rootDirectory = path.resolve(__dirname, 'trelloRestore');

        // Processa os diretórios principais sequencialmente
        await processDirectories(rootDirectory, pool);
        console.log(rootDirectory);

        // Fecha a conexão com o banco de dados
        await pool.close();
    } catch (error) {
        console.log(`Ocorreu um erro durante o processamento:`);
    }
}

// Função para percorrer os subdiretórios e processar os arquivos list.json
async function processDirectories(directoryPath, pool) {
    try {
        const items = fs.readdirSync(directoryPath);
        const organizationFile = path.join(directoryPath, 'organization.json');
        const boardFile = path.join(directoryPath, 'board.json');
        const listFile = path.join(directoryPath, 'list.json');
        const cardFile = path.join(directoryPath, 'card.json');
        const actionsFile = path.join(directoryPath, 'actions.json');

        if (fs.existsSync(organizationFile)) {
            await insertOrganizationData(directoryPath, pool);
        }
        if (fs.existsSync(boardFile)) {
            await insertProjectData(directoryPath, pool);
        }
        if (fs.existsSync(listFile)) {
            await insertListData(directoryPath, pool);
        }
        if (fs.existsSync(cardFile)) {
            await processCardFile(directoryPath, pool);
        }
        if (fs.existsSync(actionsFile)) {
            await processActionsFile(directoryPath, pool);
        }

        for (const item of items) {
            const itemPath = path.join(directoryPath, item);
            const stats = fs.statSync(itemPath);
            if (stats.isDirectory()) {
                // Se for um diretório, processa recursivamente
                await processDirectories(itemPath, pool);
            }
        }
    } catch (error) {
        console.log(`Ocorreu um erro ao processar os diretórios em ${directoryPath}:`);
    }
}



// Executa a função principal
main();