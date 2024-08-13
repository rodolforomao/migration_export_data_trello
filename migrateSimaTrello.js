const fs = require('fs');
const sql = require('mssql');
const path = require('path');
const colornames = require('colornames');
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

const desktopIdChange = [
    'CGMRR',
    'CGMRR - CENTRO-OESTE',
    'CGMRR - NORDESTE',
    'CGMRR - NORTE',
    'CGMRR - SUDESTE',
    'CGMRR - SUL',
    'COMEC'
];

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
                console.log(`O Desktop já existe no banco de dados. Continuando o processo.`);
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
            console.log(`O Project já existe no banco de dados. Continuando o processo.`);

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

            console.log(`Dados do arquivo inseridos com sucesso.`);

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
        INSERT INTO List (name, [order], createdAt, updatedAt, projectId, trelloIdList, desktopId)
        VALUES (
            @name, 
            (SELECT ISNULL(MAX([order]), 0) + 1 FROM List WHERE projectId = (SELECT id FROM Project WHERE trelloIdCard = @projectId)),
            GETDATE(), 
            GETDATE(), 
            (SELECT id FROM Project WHERE trelloIdCard = @projectId), 
            @trelloIdList,
            (SELECT desktopId FROM Project WHERE trelloIdCard = @projectId)
        )
        
        `;

            await request.query(query);
            console.log(`A List  já existe no banco de dados. Continuando o processo.`);
        } else {
            console.log(`Dados do arquivo ja existe.`);

        }

    } catch (error) {
        console.log(`Ocorreu um erro ao inserir dados do arquivo list.json:`);
    }
}
async function processCardFile(cardFilePath, pool) {
    try {
        const filePath = path.join(cardFilePath, 'card.json');

        // Verifica se o arquivo existe
        if (!fs.existsSync(filePath)) {
            console.log(`O arquivo ${filePath} não foi encontrado.`);
            return;
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

        const query = `
        INSERT INTO Issue ([order], priority, type, summary, descr, createdAt, updatedAt, listId, reporterId, codigoSei, dataPrazo, trelloIdIssue, listBadge,
        referencePeriod, projectId, desktopId)
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
            NULL,
            NULL,
            (SELECT projectId FROM List WHERE trelloIdList = @idList),
            (SELECT desktopId FROM List WHERE trelloIdList = @idList)
        )
        `;
        await request.query(query);
        console.log(`O Issue foi inserido com sucesso. Continuando o processo.`);

        // Chama a função processCardLabels para processar os labels
        await processCardLabels(data, pool);

        // Chama a função processCardChecklists para processar os checklists
        await processCardChecklists(data, pool);

    } catch (error) {
        console.log(`Ocorreu um erro ao inserir dados do arquivo card.json:`, error);
    }
}

async function processCardLabels(cardData, pool) {
    const transaction = pool.transaction();

    try {
        await transaction.begin();

        const labels = cardData.labels;
        const trelloIdIssue = cardData.id;

        for (let label of labels) {
            const colorHex = getColorHex(label.color);

            // Inserir o label na tabela Badge
            const request = transaction.request();
            request.input('nameTag', sql.NVarChar, label.name);
            request.input('color', sql.NVarChar, colorHex);
            request.input('projectId', sql.Int, 110); // Ajuste conforme sua lógica
            request.input('userId', sql.Int, 1);    // Ajuste conforme sua lógica

            const insertBadgeQuery = `
                INSERT INTO Badge (projectId, color, nameTag, userId, createdAt, updatedAt)
                OUTPUT inserted.id
                VALUES (@projectId, @color, @nameTag, @userId, GETDATE(), GETDATE())
            `;

            const result = await request.query(insertBadgeQuery);
            const badgeId = result.recordset[0].id;

            const trelloIdIssue = String(cardData.id); // Certificando-se de que é uma string válida

            // Verificação do valor de trelloIdIssue antes de usá-lo na consulta
            if (!trelloIdIssue) {
                throw new Error('Invalid trelloIdIssue: The value is undefined, null, or an empty string');
            }

            const issueQuery = `
                SELECT id FROM Issue WHERE trelloIdIssue = @issueId
            `;
            const issueResult = await transaction.request()
                .input('issueId', sql.NVarChar, trelloIdIssue) // Passando como string
                .query(issueQuery);

            if (issueResult.recordset.length === 0) {
                throw new Error('Issue não encontrado na tabela Issue');
            }

            const issueId = issueResult.recordset[0].id;

            // Inserir o relacionamento na tabela IssueBadges
            const issueBadgesRequest = transaction.request();
            issueBadgesRequest.input('issueId', sql.Int, issueId);
            issueBadgesRequest.input('badgeId', sql.Int, badgeId);

            const insertIssueBadgeQuery = `
                INSERT INTO IssueBadges (issueId, badgeId, createdAt)
                VALUES (@issueId, @badgeId, GETDATE())
            `;

            await issueBadgesRequest.query(insertIssueBadgeQuery);
        }

        await transaction.commit();
        console.log('Labels processados e inseridos com sucesso.');

    } catch (error) {
        await transaction.rollback();
        console.error('Erro ao processar labels:', error);
    }
}


// Função para substituir aspas simples por aspas duplas
function replaceQuotes(text) {
    return text.replace(/'/g, "''");
}

// Função para processar e salvar os checklists e itens
async function processCardChecklists(cardData, pool) {
    const transaction = pool.transaction();

    try {
        await transaction.begin();

        const checklistIds = cardData.idChecklists;
        const trelloIdIssue = String(cardData.id); // Certificando-se de que é uma string válida

        // Verificação do valor de trelloIdIssue antes de usá-lo na consulta
        if (!trelloIdIssue) {
            throw new Error('Invalid trelloIdIssue: The value is undefined, null, or an empty string');
        }

        // Verificar se o Issue existe
        const issueQuery = `
            SELECT id FROM Issue WHERE trelloIdIssue = @issueId
        `;
        const issueResult = await transaction.request()
            .input('issueId', sql.NVarChar, trelloIdIssue)
            .query(issueQuery);

        if (issueResult.recordset.length === 0) {
            throw new Error('Issue não encontrado na tabela Issue');
        }

        const issueId = issueResult.recordset[0].id;

        for (let checklistId of checklistIds) {
            // Recupera o checklist do Trello
            const checklist = await getChecklist(checklistId);

            // Inserir o checklist na tabela Checklist
            const checklistRequest = transaction.request();
            checklistRequest.input('issueId', sql.Int, issueId);
            checklistRequest.input('userId', sql.Int, 1); // Ajuste conforme sua lógica
            checklistRequest.input('checklistName', sql.NVarChar, checklist.name);

            const insertChecklistQuery = `
                INSERT INTO Checklist (issueId, userId, checklistName, createdAt, updatedAt)
                OUTPUT inserted.checklistID
                VALUES (@issueId, @userId, @checklistName, GETDATE(), GETDATE())
            `;

            const checklistResult = await checklistRequest.query(insertChecklistQuery);
            const checklistID = checklistResult.recordset[0].checklistID; // Captura o ID do checklist inserido

            // Inserir os itens do checklist na tabela ChecklistItems
            for (let item of checklist.checkItems) {
                const checklistItemRequest = transaction.request();
                checklistItemRequest.input('checklistID', sql.Int, checklistID); // Usa o ID do checklist inserido
                checklistItemRequest.input('userId', sql.Int, 1); // Ajuste conforme sua lógica
                checklistItemRequest.input('itemName', sql.NVarChar, item.name);
                checklistItemRequest.input('isCompleted', sql.Bit, item.state === 'complete');

                const insertChecklistItemQuery = `
                    INSERT INTO ChecklistItems (checklistID, userId, itemName, isCompleted, createdAt, updatedAt)
                    OUTPUT inserted.checklistItemID
                    VALUES (@checklistID, @userId, @itemName, @isCompleted, GETDATE(), GETDATE())
                `;

                const itemResult = await checklistItemRequest.query(insertChecklistItemQuery);
                const checklistItemID = itemResult.recordset[0].checklistItemID; // Captura o ID do item inserido

                // Se precisar usar o checklistItemID para algo mais, você pode fazê-lo aqui
            }
        }

        await transaction.commit();
        console.log('Checklists e itens processados e inseridos com sucesso.');

    } catch (error) {
        await transaction.rollback();
        console.error('Erro ao processar checklists:', error);
    }
}

// Função para recuperar o checklist do Trello
async function getChecklist(id) {
    const response = await fetch(`https://api.trello.com/1/checklists/${id}?key=${process.env.API_KEY}&token=${process.env.API_TOKEN}`);
    const data = await response.json();
    return data;
}

function replaceQuotes(text) {
    if (typeof text === 'string') {
        return text.replace(/'/g, '"');
    }
    return text;
}

function getColorHex(colorName) {
    return colornames(colorName) || '#000000'; // Retorna preto por padrão se a cor não for encontrada
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
                // Extrair dados do membro criador
                const { id, fullName, username } = action.memberCreator;
                const email = `${username}@example.com`;

                // Inicia uma transação
                const transaction = await pool.transaction();
                await transaction.begin();

                try {
                    // Verifica se o usuário existe na tabela [User]
                    const userQuery = `
                    SELECT id FROM [User] WHERE trelloIdUser = @userId
                  `;
                    const userResult = await transaction.request()
                        .input('userId', sql.NVarChar, id)
                        .query(userQuery);

                    let userId;
                    if (userResult.recordset.length === 0) {
                        // Usuário não existe, inserindo novo usuário
                        const insertUserQuery = `
                    INSERT INTO [User] (trelloIdUser, pwd, username, email, profileUrl, lastLoggedIn, createdAt, updatedAt)
                    VALUES (@userId, 'e10adc3949ba59abbe56e057f20f883e', @fullName, @email, '', GETDATE(), GETDATE(), GETDATE());
            
                    SELECT SCOPE_IDENTITY() AS userId;
                  `;

                        const insertUserResult = await transaction.request()
                            .input('userId', sql.NVarChar, id)
                            .input('fullName', sql.NVarChar, fullName)
                            .input('email', sql.NVarChar, email)
                            .query(insertUserQuery);

                        // Obter o ID do usuário recém-criado
                        userId = insertUserResult.recordset[0].userId;
                    } else {
                        // Usuário já existe, obter o ID do usuário
                        userId = userResult.recordset[0].id;
                    }

                    // Verifica se o issueId existe na tabela Issue
                    const issueQuery = `
                    SELECT id FROM Issue WHERE trelloIdIssue = @issueId
                  `;
                    const issueResult = await transaction.request()
                        .input('issueId', sql.NVarChar, action.data.card.id)
                        .query(issueQuery);

                    if (issueResult.recordset.length === 0) {
                        throw new Error('Issue não encontrado na tabela Issue');
                    }

                    const issueId = issueResult.recordset[0].id;

                    // Apaga comentários existentes com o mesmo trelloIdAction
                    await transaction.request()
                        .input('trelloIdAction', sql.NVarChar, action.id)
                        .query('DELETE FROM Comment WHERE trelloIdAction = @trelloIdAction');

                    // Insere os dados na tabela Comment
                    const commentQuery = `
                    INSERT INTO Comment (descr, createdAt, issueId, userId, trelloIdAction)
                    VALUES (@descr, @createdAt, @issueId, @userId, @trelloIdAction);
                  `;
                    await transaction.request()
                        .input('descr', sql.NVarChar, action.data.text)
                        .input('createdAt', sql.DateTime, new Date(action.date))
                        .input('issueId', sql.Int, issueId)
                        .input('userId', sql.Int, userId)
                        .input('trelloIdAction', sql.NVarChar, action.id)
                        .query(commentQuery);

                    // Confirma a transação
                    await transaction.commit();
                    console.log('Dados do arquivo Comment inseridos na tabela Comment com sucesso.');
                } catch (err) {
                    // Desfaz a transação em caso de erro
                    await transaction.rollback();
                    console.error('Erro ao inserir dados na tabela Comment:', err.message);
                }
            }
        }
    } catch (error) {
        console.log(`Ocorreu um erro ao inserir dados do arquivo actions.json:`); //aqui
    }
}

// Função principal para conectar ao banco de dados e processar os diretórios
async function main() {
    const start = Date.now();  // Início do tempo de execução

    try {
        // Conecta ao banco de dados
        const pool = await sql.connect(config);

        const desktopsString = desktopIdChange.map(name => `'${name}'`).join(',');

        await pool.request()
            .query(`
           -- Delete from Accompanied
           DELETE A
           FROM Accompanied A
           INNER JOIN Issue I ON I.id = A.issueId
           INNER JOIN Desktop D ON D.id = I.desktopId
           WHERE D.nameDesktop (${desktopsString})

           -- Delete from Badges
           DELETE IB
           FROM [IssueBadges] IB
           INNER JOIN Issue I ON I.id = IB.issueId
           INNER JOIN Badge B ON I.id = IB.badgeId
           INNER JOIN Desktop D ON D.id = I.desktopId
           WHERE D.nameDesktop (${desktopsString})

		   DELETE B
           FROM Badge B
           INNER JOIN [IssueBadges] IB ON B.id = IB.badgeId
           INNER JOIN Issue I ON I.id = IB.issueId
           INNER JOIN Desktop D ON D.id = I.desktopId
           WHERE D.nameDesktop (${desktopsString})

           -- Delete from Notification
           DELETE N
           FROM Notification N
           INNER JOIN Issue I ON I.id = N.issueId
           INNER JOIN Desktop D ON D.id = I.desktopId
           WHERE D.nameDesktop (${desktopsString})

           -- Delete from LinkedCard
           DELETE LC
           FROM LinkedCard LC
           INNER JOIN Issue I ON I.id = LC.parentIdIssueId
           INNER JOIN Desktop D ON D.id = I.desktopId
           WHERE D.nameDesktop (${desktopsString})

           -- Delete from ReviewTask
           DELETE RT
           FROM ReviewTask RT
           INNER JOIN Issue I ON I.id = RT.issueId
           INNER JOIN Desktop D ON D.id = I.desktopId
           WHERE D.nameDesktop (${desktopsString})

           -- Delete from Comment
           DELETE C
           FROM Comment C
           INNER JOIN Issue I ON I.id = C.issueId
           INNER JOIN Desktop D ON D.id = I.desktopId
           WHERE D.nameDesktop (${desktopsString})

           -- Delete from Assignee
           DELETE A
           FROM Assignee A
           INNER JOIN Issue I ON I.id = A.issueId
           INNER JOIN Desktop D ON D.id = I.desktopId
           WHERE D.nameDesktop (${desktopsString})

           -- Delete from HistoryMovimentList
           DELETE HML
           FROM HistoryMovimentList HML
           INNER JOIN Issue I ON I.id = HML.issueId
           INNER JOIN Desktop D ON D.id = I.desktopId
           WHERE D.nameDesktop (${desktopsString})           

           -- Delete from Issue
           DELETE FROM Issue I
           INNER JOIN Desktop D ON D.id = I.desktopId
           WHERE D.nameDesktop (${desktopsString})`
        
        );

        // Caminho raiz onde estão as pastas
        const rootDirectory = path.resolve(__dirname, 'trelloRestore');

        // Processa os diretórios principais sequencialmente
        await processDirectories(rootDirectory, pool);
        console.log(rootDirectory);

        const end = Date.now();  // Fim do tempo de execução
        const executionTime = (end - start) / 1000;  // Tempo de execução em segundos
        console.log(`TAREFA MIGRATION TRELLO CONCLUIDA! Tempo total de execução: ${executionTime} segundos`);

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

module.exports = { main };
