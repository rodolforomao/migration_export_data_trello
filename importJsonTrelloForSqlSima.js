const fs = require('fs');
const sql = require('mssql');
const path = require('path');
const colornames = require('colornames');
const { desktopsChange, optionsSqlServerDelete, executeFuntions } = require('./config.js');
require('dotenv').config();

const desktopIdChange = desktopsChange();
const optionExecuteSql = optionsSqlServerDelete();
const optionsFunctions = executeFuntions();


// Função para escrever logs 
function log(message) {
    fs.appendFileSync('importSqlSima_logs.txt', message + '\n', 'utf8');
}

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

async function insertDesktop(directoryPath, pool) {
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
                log(`O Desktop já existe no banco de dados. Continuando o processo.`);
            } else {
                // Insere os dados na tabela Desktop
                await pool.request().query(`
                    INSERT INTO Desktop (nameDesktop, trelloIdProject, createdAt, userId) 
                    VALUES ('${data.displayName}', '${data.id}', GETDATE(), 1);
                `);

                log(`Dados do arquivo ${filePath} inseridos com sucesso.`);

                // Validação pós-inserção
                const isInserted = await checkIfTrelloIdExists(data.id, pool);
                if (isInserted) {
                    log(`Validação: O Desktop foi inserido com sucesso no banco de dados.`);
                } else {
                    log(`Validação falhou: O Desktop não foi encontrado no banco de dados.`);
                }
            }

        } else {
            log(`O caminho ${filePath} não aponta para um arquivo. Pulando para o próximo.`);
        }
    } catch (error) {
        log(`Ocorreu um erro ao inserir dados do arquivo organization.json: ${error.message}`);
    }
}

// Função para verificar se o trelloId já existe no banco de dados
async function checkIfTrelloIdExists(trelloId, pool) {
    try {
        const result = await pool.request()
            .input('trelloId', sql.NVarChar, trelloId)
            .query('SELECT COUNT(*) AS Count FROM Desktop WHERE trelloIdProject = @trelloId');

        return result.recordset[0].Count > 0;
    } catch (error) {
        log(`Erro ao verificar existência do trelloId no banco de dados: ${error.message}`);
        return false;
    }
}


// Função para ler e inserir os dados do arquivo board.json no banco de dados
async function insertProjectData(directoryPath, pool) {
    try {
        const filePath = path.join(directoryPath, 'board.json');

        // Verifica se o arquivo existe
        if (!fs.existsSync(filePath)) {
            log(`O arquivo ${filePath} não foi encontrado.`);
            return;
        }

        // Lê o arquivo JSON
        const rawData = fs.readFileSync(filePath);
        const data = JSON.parse(rawData);
        const trelloIdOrganization = data.idOrganization;

        // Verifica se o trelloIdCard já existe no banco de dados
        const trelloIdCardExists = await checkIfTrelloIdCardExists(data.id, pool);
        if (trelloIdCardExists) {
            log(`O Project já existe no banco de dados. Continuando o processo.`);

        } else {
            // Insere os dados na tabela Project
            await pool.request().query(`
                INSERT INTO Project (name, createdAt, updatedAt, userId, desktopId, trelloIdCard) 
                VALUES (
                    '${data.name}', 
                    GETDATE(), 
                    GETDATE(), 
                    1, 
                    (
                        SELECT id FROM Desktop WHERE trelloIdProject = '${trelloIdOrganization}'
                    ), 
                    '${data.id}'
                )
            `);

            log(`Dados do arquivo ${filePath} inseridos com sucesso.`);

            // Validação pós-inserção
            const isInserted = await checkIfTrelloIdCardExists(data.id, pool);
            if (isInserted) {
                log(`Validação: O Project foi inserido com sucesso no banco de dados.`);
            } else {
                log(`Validação falhou: O Project não foi encontrado no banco de dados.`);
            }
        }
    } catch (error) {
        log(`Ocorreu um erro ao inserir dados do arquivo board.json: ${error.message}`);
    }
}

// Função para verificar se o trelloIdCard já existe no banco de dados
async function checkIfTrelloIdCardExists(trelloId, pool) {
    try {
        const result = await pool.request()
            .input('trelloId', sql.NVarChar, trelloId)
            .query('SELECT COUNT(*) AS Count FROM Project WHERE trelloIdCard = @trelloId');

        return result.recordset[0].Count > 0;
    } catch (error) {
        log(`Erro ao verificar existência do trelloId no banco de dados: ${error.message}`);
        return false;
    }
}

// Função para ler e inserir os dados do arquivo list.json no banco de dados
async function insertListData(cardFilePath, pool) {
    try {
        const filePath = path.join(cardFilePath, 'list.json');

        // Verifica se o arquivo existe
        if (!fs.existsSync(filePath)) {
            log(`O arquivo ${filePath} não foi encontrado.`);
            return;
        }
        // Lê o arquivo JSON
        const rawData = fs.readFileSync(filePath);
        const data = JSON.parse(rawData);

        // Verifica se a lista já existe no banco de dados
        const trelloIdListExists = await checkIfTrelloIdListExists(data.id, pool);
        if (trelloIdListExists) {
            log(`A List já existe no banco de dados. Continuando o processo.`);
        } else {
            // Insere os dados na tabela List
            const request = pool.request();
            request.input('name', sql.NVarChar, data.name);
            request.input('projectId', sql.NVarChar, data.idBoard);
            request.input('trelloIdList', sql.NVarChar, data.id);
            request.input('order', sql.Int, data.pos || 0); // Utiliza a ordem vinda do Trello

            const query = `
                INSERT INTO List (name, [order], createdAt, updatedAt, projectId, trelloIdList, desktopId)
                VALUES (
                    @name, 
                    @order,
                    GETDATE(), 
                    GETDATE(), 
                    (SELECT id FROM Project WHERE trelloIdCard = @projectId), 
                    @trelloIdList,
                    (SELECT desktopId FROM Project WHERE trelloIdCard = @projectId)
                )
            `;

            await request.query(query);
            log(`Dados do arquivo ${filePath} inseridos com sucesso.`);

            // Validação pós-inserção
            const isInserted = await checkIfTrelloIdListExists(data.id, pool);
            if (isInserted) {
                log(`Validação: A List foi inserida com sucesso no banco de dados.`);
            } else {
                log(`Validação falhou: A List não foi encontrada no banco de dados.`)
            }
        }
    } catch (error) {
        log(`Ocorreu um erro ao inserir dados do arquivo list.json: ${error.message}\nStack trace: ${error.stack}`);
    }
}

// Função para verificar se o trelloIdList já existe no banco de dados
async function checkIfTrelloIdListExists(trelloId, pool) {
    try {
        const result = await pool.request()
            .input('trelloId', sql.NVarChar, trelloId)
            .query('SELECT COUNT(*) AS Count FROM List WHERE trelloIdList = @trelloId');

        return result.recordset[0].Count > 0;
    } catch (error) {
        log(`Erro ao verificar existência do trelloId no banco de dados: ${error.message}`);
        return false;
    }
}

async function processCardFile(cardFilePath, pool) {
    try {
        const filePath = path.join(cardFilePath, 'card.json');

        // Verifica se o arquivo existe
        if (!fs.existsSync(filePath)) {
            log(`O arquivo ${filePath} não foi encontrado.`);
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

        // Valida se o Issue foi inserido com sucesso
        const checkQuery = `
            SELECT COUNT(*) AS count FROM Issue WHERE trelloIdIssue = @trelloIdIssue
        `;
        const result = await request.query(checkQuery);
        const insertedCount = result.recordset[0].count;

        if (insertedCount > 0) {
            log(`O Issue foi inserido com sucesso. Continuando o processo.`);
            // Função para inserir checklists e badges
            if (optionsFunctions.processBagde) {
                await processBagde(data, pool);
            }
            await processCheckList(data, pool);
        } else {
            log(`Falha ao inserir o Issue.`);
        }

    } catch (error) {
        log(`Ocorreu um erro ao inserir dados do arquivo card.json:`, error);
    }
}


async function processBagde(cardData, pool) {
    const transaction = pool.transaction();

    try {
        await transaction.begin();

        const labels = cardData.labels;
        const trelloIdIssue = String(cardData.id); // Certificando-se de que é uma string válida

        // Verificação do valor de trelloIdIssue antes de usá-lo na consulta
        if (!trelloIdIssue) {
            throw new Error('Invalid trelloIdIssue: The value is undefined, null, or an empty string');
        }

        // Verificar se o Issue existe e obter o projectId associado
        const issueQuery = `
            SELECT id, projectId FROM Issue WHERE trelloIdIssue = @issueId
        `;
        const issueResult = await transaction.request()
            .input('issueId', sql.NVarChar, trelloIdIssue)
            .query(issueQuery);

        if (issueResult.recordset.length === 0) {
            throw new Error('Issue não encontrado na tabela Issue');
        }

        const issueId = issueResult.recordset[0].id;
        const projectId = issueResult.recordset[0].projectId;

        for (let label of labels) {
            const colorHex = getColorHex(label.color);

            // Inserir o label na tabela Badge
            const request = transaction.request();
            request.input('nameTag', sql.NVarChar, label.name);
            request.input('color', sql.NVarChar, colorHex);
            request.input('projectId', sql.Int, projectId);
            request.input('userId', sql.Int, 1);

            const insertBadgeQuery = `
                INSERT INTO Badge (projectId, color, nameTag, userId, createdAt, updatedAt)
                OUTPUT inserted.id
                VALUES (@projectId, @color, @nameTag, @userId, GETDATE(), GETDATE())
            `;

            const result = await request.query(insertBadgeQuery);
            const badgeId = result.recordset[0].id;

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
        log('Labels processados e inseridos com sucesso.');

    } catch (error) {
        await transaction.rollback();
        console.error('Erro ao processar labels:', error);
    }
}

// Função para converter nomes de cores em hex
function getColorHex(colorName) {
    return colornames(colorName) || '#000000'; // Retorna preto por padrão se a cor não for encontrada
}



// Função para substituir aspas simples por aspas duplas
function replaceQuotes(text) {
    return text.replace(/'/g, "''");
}

async function processCheckList(cardData, pool) {
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

            // Verifica se o checklist foi recuperado com sucesso
            if (!checklist || !checklist.name) {
                log(`Checklist com ID ${checklistId} não foi encontrado ou está incompleto.`);
                continue; // Passa para o próximo checklist
            }

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

            // Verifica se o checklist foi inserido corretamente
            if (!checklistID) {
                log(`Falha ao inserir checklist ${checklist.name}.`);
                continue; // Passa para o próximo checklist
            }

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
                const checklistItemID = itemResult.recordset[0].checklistItemID;

                if (checklistItemID) {
                    log(`Item do checklist inserido com sucesso: ${item.name}`);
                } else {
                    log(`Falha ao inserir item do checklist: ${item.name}`);
                }
            }
        }

        await transaction.commit();
        log('Checklists e itens processados e inseridos com sucesso.');

    } catch (error) {
        await transaction.rollback();
        console.error('Erro ao processar checklists:', error);
    }
}

// Função para recuperar o checklist do Trello
async function getChecklist(id) {
    try {
        const response = await fetch(`https://api.trello.com/1/checklists/${id}?key=${process.env.API_KEY}&token=${process.env.API_TOKEN}`);
        if (!response.ok) {
            throw new Error(`Erro ao buscar checklist do Trello: ${response.statusText}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error(`Erro ao recuperar checklist do Trello:`, error);
        return null;
    }
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


// Função para inserir Comentarios
async function processComment(actionsFilePath, pool) {
    try {
        const filePath = path.join(actionsFilePath, 'actions.json');

        // Verifica se o arquivo existe
        if (!fs.existsSync(filePath)) {
            log(`O arquivo ${filePath} não foi encontrado.`);
            return;
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
                    log('Dados do arquivo Comment inseridos na tabela Comment com sucesso.');
                } catch (err) {
                    // Desfaz a transação em caso de erro
                    await transaction.rollback();
                    console.error('Erro ao inserir dados na tabela Comment:', err.message);
                }
            }
        }
    } catch (error) {
        log(`Ocorreu um erro ao inserir dados do arquivo actions.json:`, error);
    }
}

async function executeSqlServerInsert() {
    let pool;
    try {
        // Conecta ao banco de dados
        pool = await sql.connect(config);
        const desktopsString = desktopIdChange.map(name => `'${name}'`).join(',');

        if (optionExecuteSql.executeOnDelete) {
            log('Iniciando exclusão de dados antigos...');

            await pool.request().query(`
                -- Delete from Accompanied 
                DELETE A
                FROM Accompanied A
                INNER JOIN Issue I ON I.id = A.issueId
                INNER JOIN Desktop D ON D.id = I.desktopId
                WHERE D.nameDesktop IN (${desktopsString})

                -- Delete from Notification 
                DELETE N
                FROM Notification N
                INNER JOIN Issue I ON I.id = N.issueId
                INNER JOIN Desktop D ON D.id = I.desktopId
                WHERE D.nameDesktop IN (${desktopsString})

                -- Delete from LinkedCard 
                DELETE LC
                FROM LinkedCard LC
                INNER JOIN Issue I ON I.id = LC.parentIdIssueId
                INNER JOIN Desktop D ON D.id = I.desktopId
                WHERE D.nameDesktop IN (${desktopsString})

                -- Delete from ReviewTask 
                DELETE RT
                FROM ReviewTask RT
                INNER JOIN Issue I ON I.id = RT.issueId
                INNER JOIN Desktop D ON D.id = I.desktopId
                WHERE D.nameDesktop IN (${desktopsString})

                -- Delete from Comment 
                DELETE C
                FROM Comment C
                INNER JOIN Issue I ON I.id = C.issueId
                INNER JOIN Desktop D ON D.id = I.desktopId
                WHERE D.nameDesktop IN (${desktopsString})

                -- Delete from Assignee 
                DELETE A
                FROM Assignee A
                INNER JOIN Issue I ON I.id = A.issueId
                INNER JOIN Desktop D ON D.id = I.desktopId
                WHERE D.nameDesktop IN (${desktopsString})

                -- Delete from HistoryMovimentList 
                DELETE HML
                FROM HistoryMovimentList HML
                INNER JOIN Issue I ON I.id = HML.issueId
                INNER JOIN Desktop D ON D.id = I.desktopId
                WHERE D.nameDesktop IN (${desktopsString})

                -- Delete from Issue 
                DELETE I
                FROM Issue I
                INNER JOIN Desktop D ON D.id = I.desktopId
                WHERE D.nameDesktop IN (${desktopsString})

                -- Delete from List 
                DELETE L
                FROM List L
                INNER JOIN Desktop D ON D.id = L.desktopId
                WHERE D.nameDesktop IN (${desktopsString})

                -- Delete from Badge 
                DELETE B
                FROM Badge B
                INNER JOIN [IssueBadges] IB ON B.id = IB.badgeId
                INNER JOIN Issue I ON I.id = IB.issueId
                INNER JOIN Desktop D ON D.id = I.desktopId
                WHERE D.nameDesktop IN (${desktopsString})

                -- Delete from IssueBadges 
                DELETE IB
                FROM [IssueBadges] IB
                INNER JOIN Issue I ON I.id = IB.issueId
                INNER JOIN Desktop D ON D.id = I.desktopId
                WHERE D.nameDesktop IN (${desktopsString})
            `);

            log('Exclusão de dados antigos concluída.');
        }

        // Caminho raiz onde estão as pastas
        const rootDirectory = path.resolve(__dirname, 'trelloRestore');
        log(`Iniciando o processamento dos diretórios a partir de: ${rootDirectory}`);

        // Processa os diretórios principais sequencialmente
        await processDirectories(rootDirectory, pool);


    } catch (error) {
        log(`Ocorreu um erro durante o processamento de inserir no banco de dados: ${error.message}`);
    } finally {
        if (pool) {
            await pool.close();
            log('Conexão com o banco de dados fechada.');
        }
    }
}

// Função para percorrer os subdiretórios e processar os arquivos JSON
async function processDirectories(directoryPath, pool) {
    try {
        const start = Date.now();  // Início do tempo de execução

        const items = fs.readdirSync(directoryPath);

        // Definir caminhos para arquivos JSON esperados
        const organizationFile = path.join(directoryPath, 'organization.json');
        const boardFile = path.join(directoryPath, 'board.json');
        const listFile = path.join(directoryPath, 'list.json');
        const cardFile = path.join(directoryPath, 'card.json');
        const actionsFile = path.join(directoryPath, 'actions.json');

        // Processar arquivos JSON na ordem específica
        if (fs.existsSync(organizationFile)) {
            log(`Processando arquivo organization.json em: ${directoryPath}`);
            await insertDesktop(directoryPath, pool);
        }

        if (fs.existsSync(boardFile)) {
            log(`Processando arquivo board.json em: ${directoryPath}`);
            await insertProjectData(directoryPath, pool);
        }

        if (fs.existsSync(listFile)) {
            log(`Processando arquivo list.json em: ${directoryPath}`);
            await insertListData(directoryPath, pool);
        }

        if (fs.existsSync(cardFile)) {
            log(`Processando arquivo card.json em: ${directoryPath}`);
            await processCardFile(directoryPath, pool);
        }

        if (fs.existsSync(actionsFile)) {
            log(`Processando arquivo actions.json em: ${directoryPath}`);
            await processComment(directoryPath, pool);
        }

        // Processar subdiretórios recursivamente
        for (const item of items) {
            const itemPath = path.join(directoryPath, item);
            const stats = fs.statSync(itemPath);
            if (stats.isDirectory()) {
                // Se for um diretório, processa recursivamente
                await processDirectories(itemPath, pool);
            }
        }

        const end = Date.now();  // Fim do tempo de execução
        const executionTimeInSeconds = (end - start) / 1000;
        const minutes = Math.floor(executionTimeInSeconds / 60);
        const seconds = Math.floor(executionTimeInSeconds % 60);

        log(`Inserção de dados no banco CONCLUÍDA! Tempo total de execução: ${minutes} minutos e ${seconds} segundos`);
    } catch (error) {
        log(`Ocorreu um erro ao processar os diretórios em ${directoryPath}: ${error.message}`);
    }
}



module.exports = { executeSqlServerInsert };
