const fs = require('fs');
const sql = require('mssql');
const path = require('path');
const colornames = require('colornames');
const readline = require('readline');
const { desktopsChange, optionsSqlServerDelete, executeFuntions } = require('./config.js');
const { testConnection } = require('./testeConnection');

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

            // Insere os dados na tabela Desktop apenas se o trelloIdProject não existir
            await pool.request()
                .input('nameDesktop', sql.NVarChar, data.displayName)
                .input('trelloIdProject', sql.NVarChar, data.id)
                .input('createdAt', sql.DateTime, new Date())
                .input('userId', sql.Int, 1)
                .query(`
                    IF NOT EXISTS (SELECT 1 FROM Desktop WHERE trelloIdProject = @trelloIdProject)
                    BEGIN
                        INSERT INTO Desktop (nameDesktop, trelloIdProject, createdAt, userId)
                        VALUES (@nameDesktop, @trelloIdProject, @createdAt, @userId);
                    END
                `);

            // Verifica se a inserção foi realizada com sucesso
            const isInserted = await checkIfTrelloIdExists(data.id, pool);
            if (isInserted) {
                const result = await pool.request()
                    .input('trelloId', sql.NVarChar, data.id)
                    .query('SELECT id FROM Desktop WHERE trelloIdProject = @trelloId');

                // Verifique se existe pelo menos um registro no resultado
                if (result.recordset.length > 0) {
                    const desktopId = result.recordset[0].id;

                    // Lista de userIds que você deseja inserir
                    const userIds = [1, 2];

                    // Insere Member no Desktop criado na tabela Member
                    for (const userId of userIds) {
                        await pool.request()
                            .input('desktopId', sql.Int, desktopId)
                            .input('userId', sql.Int, userId) // Passa o userId atual da iteração
                            .query(`
            IF NOT EXISTS (SELECT 1 FROM Member WHERE desktopId = @desktopId AND userId = @userId)
            BEGIN
                INSERT INTO Member (createdAt, projectId, desktopId, userId) 
                VALUES (GETDATE(), NULL, @desktopId, @userId);
            END
        `);
                    }

                }

                log(`SUCCESS: Validação completa. O Desktop com Trello ID: ${data.id} foi inserido com sucesso.`);
            } else {
                log(`ERROR: Validação falhou. O Desktop com Trello ID: ${data.id} não foi encontrado no banco de dados após a inserção.`);
            }
        } else {
            log(`WARN: O caminho ${filePath} não aponta para um arquivo válido. Pulando o arquivo.`);
        }
    } catch (error) {
        log(`ERROR: Ocorreu um erro ao processar o arquivo organization.json: ${error.message}`);
    }
}

// Função para verificar se o trelloId já existe no banco de dados
async function checkIfTrelloIdExists(trelloId, pool) {
    try {
        const result = await pool.request()
            .input('trelloId', sql.NVarChar, trelloId)
            .query('SELECT COUNT(*) AS Count FROM Desktop WHERE trelloIdProject = @trelloId');

        const exists = result.recordset[0].Count > 0;
        log(`INFO: Verificação de Trello ID: ${trelloId}. Existe? ${exists ? 'Sim' : 'Não'}`);
        return exists;
    } catch (error) {
        log(`ERROR: Erro ao verificar a existência do Trello ID: ${trelloId}. ${error.message}`);
        return false;
    }
}


async function insertProjectData(directoryPath, pool) {
    const transaction = new sql.Transaction(pool);  // Inicia uma transação
    try {
        const filePath = path.join(directoryPath, 'board.json');

        // Verifica se o arquivo existe
        if (!fs.existsSync(filePath)) {
            log(`WARN: O arquivo ${filePath} não foi encontrado. Pulando...`);
            return;
        }

        log(`INFO: Lendo dados do arquivo ${filePath}...`);

        // Lê o arquivo JSON
        const rawData = fs.readFileSync(filePath);
        const data = JSON.parse(rawData);
        const trelloIdOrganization = data.idOrganization;

        log(`INFO: Dados lidos com sucesso. Trello ID da Organização: ${trelloIdOrganization}, Nome do Project: ${data.name}`);

        // Inicia a transação
        await transaction.begin();

        // Verifica se o trelloIdCard já existe no banco de dados
        const trelloIdCardExists = await checkIfTrelloIdCardExists(data.id, pool);
        if (trelloIdCardExists) {
            log(`INFO: O Project com Trello ID Card: ${data.id} já existe no banco de dados. Continuando o processo.`);
        } else {
            log(`INFO: Inserindo dados do Project no banco de dados...`);

            // Inserção com verificação de duplicação no SQL usando IF NOT EXISTS
            await transaction.request().query(`
                IF NOT EXISTS (SELECT 1 FROM Project WHERE trelloIdCard = '${data.id}')
                BEGIN
                    INSERT INTO Project (name, createdAt, updatedAt, userId, desktopId, trelloIdCard) 
                    VALUES (
                        '${data.name}', 
                        GETDATE(), 
                        GETDATE(), 
                        1, 
                        (SELECT id FROM Desktop WHERE trelloIdProject = '${trelloIdOrganization}'), 
                        '${data.id}'
                    );
                END
            `);

            log(`INFO: Dados do arquivo ${filePath} inseridos com sucesso no banco de dados.`);
        }

        // Comita a transação
        await transaction.commit();

        // Validação pós-inserção
        const isInserted = await checkIfTrelloIdCardExists(data.id, pool);
        if (isInserted) {
            log(`SUCCESS: O Project com Trello ID Card: ${data.id} foi inserido com sucesso no banco de dados.`);
        } else {
            log(`ERROR: Validação falhou. O Project com Trello ID Card: ${data.id} não foi encontrado após inserção.`);
        }

    } catch (error) {
        // Caso ocorra algum erro, realiza o rollback da transação
        await transaction.rollback();
        log(`ERROR: Ocorreu um erro ao inserir dados do arquivo board.json: ${error.message}`);
    }
}

// Função para verificar se o trelloIdCard já existe no banco de dados
async function checkIfTrelloIdCardExists(trelloId, pool) {
    try {
        log(`INFO: Verificando se o Trello ID Card: ${trelloId} já existe no banco de dados...`);
        const result = await pool.request()
            .input('trelloId', sql.NVarChar, trelloId)
            .query('SELECT COUNT(*) AS Count FROM Project WHERE trelloIdCard = @trelloId');

        const exists = result.recordset[0].Count > 0;
        log(`INFO: Trello ID Card ${trelloId} ${exists ? 'encontrado' : 'não encontrado'} no banco de dados.`);
        return exists;
    } catch (error) {
        log(`ERROR: Falha ao verificar o Trello ID Card: ${trelloId}. ${error.message}`);
        return false;
    }
}

async function insertListData(cardFilePath, pool) {
    const transaction = new sql.Transaction(pool);  // Inicia uma transação
    try {
        const filePath = path.join(cardFilePath, 'list.json');

        // Verifica se o arquivo existe
        if (!fs.existsSync(filePath)) {
            log(`WARN: O arquivo ${filePath} não foi encontrado. Pulando...`);
            return;
        }

        log(`INFO: Lendo dados do arquivo ${filePath}...`);

        // Lê o arquivo JSON
        const rawData = fs.readFileSync(filePath);
        const data = JSON.parse(rawData);
        const trelloIdList = data.id;
        const projectId = data.idBoard;

        log(`INFO: Dados lidos com sucesso. Nome da Lista: ${data.name}, Trello ID: ${trelloIdList}, Projeto ID: ${projectId}`);

        // Inicia a transação
        await transaction.begin();

        // Verifica se a lista já existe no banco de dados
        const trelloIdListExists = await checkIfTrelloIdListExists(trelloIdList, pool);
        if (trelloIdListExists) {
            log(`INFO: A Lista com Trello ID: ${trelloIdList} já existe no banco de dados. Pulando inserção.`);
        } else {
            log(`INFO: Inserindo dados da Lista no banco de dados...`);

            // Inserção com verificação de duplicação no SQL usando IF NOT EXISTS
            const request = transaction.request();
            request.input('name', sql.NVarChar, data.name);
            request.input('projectId', sql.NVarChar, projectId);
            request.input('trelloIdList', sql.NVarChar, trelloIdList);
            request.input('order', sql.Int, data.pos || 0); // Utiliza a ordem vinda do Trello

            const query = `
                IF NOT EXISTS (SELECT 1 FROM List WHERE trelloIdList = @trelloIdList)
                BEGIN
                    INSERT INTO List (name, [order], createdAt, updatedAt, projectId, trelloIdList, desktopId)
                    VALUES (
                        @name, 
                        @order, 
                        GETDATE(), 
                        GETDATE(), 
                        (SELECT id FROM Project WHERE trelloIdCard = @projectId), 
                        @trelloIdList, 
                        (SELECT desktopId FROM Project WHERE trelloIdCard = @projectId)
                    );
                END
            `;

            await request.query(query);
            log(`SUCCESS: Dados do arquivo ${filePath} inseridos com sucesso no banco de dados.`);
        }

        // Comita a transação
        await transaction.commit();

        // Validação pós-inserção
        const isInserted = await checkIfTrelloIdListExists(trelloIdList, pool);
        if (isInserted) {
            log(`SUCCESS: A Lista com Trello ID: ${trelloIdList} foi inserida com sucesso no banco de dados.`);
        } else {
            log(`ERROR: Validação falhou: A Lista com Trello ID: ${trelloIdList} não foi encontrada após a inserção.`);
        }

    } catch (error) {
        // Caso ocorra algum erro, realiza o rollback da transação
        await transaction.rollback();
        log(`ERROR: Ocorreu um erro ao inserir dados do arquivo list.json: ${error.message}\nStack trace: ${error.stack}`);
    }
}

// Função para verificar se o trelloIdList já existe no banco de dados
async function checkIfTrelloIdListExists(trelloId, pool) {
    try {
        log(`INFO: Verificando se o Trello ID da Lista: ${trelloId} já existe no banco de dados...`);
        const result = await pool.request()
            .input('trelloId', sql.NVarChar, trelloId)
            .query('SELECT COUNT(*) AS Count FROM List WHERE trelloIdList = @trelloId');

        const exists = result.recordset[0].Count > 0;
        log(`INFO: Trello ID da Lista ${trelloId} ${exists ? 'encontrado' : 'não encontrado'} no banco de dados.`);
        return exists;
    } catch (error) {
        log(`ERROR: Falha ao verificar o Trello ID da Lista: ${trelloId}. ${error.message}`);
        return false;
    }
}

async function processCardFile(cardFilePath, pool) {
    try {
        const filePath = path.join(cardFilePath, 'card.json');

        // Verifica se o arquivo existe
        if (!fs.existsSync(filePath)) {
            log(`[INFO] O arquivo ${filePath} não foi encontrado. Certifique-se de que o arquivo esteja no caminho correto.`);
            return;
        }

        function replaceQuotes(str) {
            return str.replace(/'/g, '"');
        }

        function fixUrlAndKeepContent(input) {
            // Passo 1: Extrair o conteúdo dos lotes (Lote 2, Lote 29)
            const lotesMatch = input.match(/- Lote \d+/g);
            const lotesContent = lotesMatch ? lotesMatch.join("\n").replace('- ', '') : '';

            // Passo 2: Corrigir a URL, removendo o escape de caracteres e codificando a URL corretamente
            const urlMatch = input.match(/\(Elegantt_data:[^\)]+\)/);  // Encontra a URL entre parênteses
            let correctedUrl = '';
            if (urlMatch) {
                const urlString = urlMatch[0]
                    .replace(/^\(|\)$/g, '')  // Remove os parênteses
                    .replace(/\\\"/g, '"');   // Remove os escapes das aspas
                correctedUrl = "http://" + encodeURIComponent(urlString);  // Codifica a URL para ser segura em uma URL
            }

            // Passo 3: Montar o resultado com o conteúdo dos lotes e a URL corrigida
            const result = `${lotesContent}\n\n${correctedUrl}`;

            return result;
        }

        const request = pool.request();

        // Lê o arquivo JSON
        const rawData = fs.readFileSync(filePath);
        const data = JSON.parse(rawData);
        log(`[INFO] Arquivo ${filePath} lido com sucesso. Processando os dados...`);

        // Substitui as aspas simples por duplas nos valores de 'name' e 'desc'
        data.name = replaceQuotes(data.name);
        data.desc = replaceQuotes(data.desc);

        data.desc = fixUrlAndKeepContent(data.desc);

        log(`[INFO] Preparando para inserir o Issue com o nome: ${data.name} e ID do Trello: ${data.id}`);
        request.input('trelloIdIssue', sql.NVarChar, data.id);

        // Verificar se o trelloIdIssue já existe
        const checkExistQuery = `
            SELECT COUNT(*) AS count 
            FROM Issue 
            WHERE trelloIdIssue = @trelloIdIssue
        `;
        const checkResult = await request.query(checkExistQuery);
        const existingCount = checkResult.recordset[0].count;

        if (existingCount > 0) {
            log(`[INFO] O Issue com ID Trello: ${data.id} já existe. Processamento abortado.`);
            return; // Interrompe o processamento caso o issue já exista
        }

        // Se o Issue não existir, prossegue com a inserção
        request.input('name', sql.NVarChar, data.name);
        request.input('desc', sql.NVarChar, data.desc);
        request.input('idList', sql.NVarChar, data.idList);
        request.input('idMembers', sql.NVarChar, data.idMembers[0]);
        request.input('isIssueCompleted', sql.NVarChar, data.dueComplete ? '1' : '0');
        request.input('dateIssueCompleted', sql.NVarChar, data.due);
        request.input('endDate', sql.NVarChar, data.due);
        request.input('startDate', sql.NVarChar, data.start);

        // Query de inserção
        const query = `
          INSERT INTO Issue ([order], priority, type, summary, descr, createdAt, updatedAt, listId, reporterId,  endDate, trelloIdIssue, listBadge,
          referencePeriod, projectId, desktopId, startDate, isIssueCompleted, dateIssueCompleted)
          VALUES (
              (SELECT ISNULL(MAX([order]), 0) + 1 FROM Issue WHERE listId = (SELECT id FROM List WHERE trelloIdList = @idList)),
              0,
              0,
              @name,
              @desc,
              GETDATE(),
              GETDATE(),
              (SELECT id FROM List WHERE trelloIdList = @idList),
              IIF((SELECT id FROM [User] WHERE trelloIdUser = @idMembers) IS NULL, 1, (SELECT id FROM [User] WHERE trelloIdUser = @idMembers)),              
              @endDate,
              @trelloIdIssue,
              NULL,
              NULL,
              (SELECT projectId FROM List WHERE trelloIdList = @idList),
              (SELECT desktopId FROM List WHERE trelloIdList = @idList),
              @startDate,
              @isIssueCompleted,
              @dateIssueCompleted
          )
        `;

        await request.query(query);
        log(`[INFO] Query executada com sucesso. Inserção do Issue com ID Trello: ${data.id}`);

        // Valida se o Issue foi inserido com sucesso
        const insertedCheckQuery = `
            SELECT COUNT(*) AS count FROM Issue WHERE trelloIdIssue = @trelloIdIssue
        `;
        const insertedResult = await request.query(insertedCheckQuery);
        const insertedCount = insertedResult.recordset[0].count;

        if (insertedCount > 0) {
            log(`[INFO] O Issue com ID Trello: ${data.id} foi inserido com sucesso na tabela 'Issue'. Continuando o processo...`);

            // Função para inserir checklists e badges, caso configurado para processar badges
            if (optionsFunctions.processBagde) {
                log(`[INFO] Processando badge para o Issue com ID Trello: ${data.id}...`);
                await processBagde(data, pool);
            }

            // Processa os checklists do Issue
            log(`[INFO] Processando checklists para o Issue com ID Trello: ${data.id}...`);
            await processCheckList(data, pool);

        } else {
            log(`[ERROR] Falha ao inserir o Issue com ID Trello: ${data.id}. Verifique os detalhes da consulta.`);
        }

    } catch (error) {
        log(`[ERROR] Ocorreu um erro inesperado ao inserir dados do arquivo card.json. Detalhes do erro: ${error.message}\nStack trace: ${error.stack}`);
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
            throw new Error('Invalid trelloIdIssue: O valor é indefinido, nulo ou uma string vazia');
        }

        log(`Iniciando o processamento dos badges para o Issue com trelloIdIssue: ${trelloIdIssue}`);

        // Verificar se o Issue existe e obter o projectId associado
        const issueQuery = `
            SELECT id, projectId FROM Issue WHERE trelloIdIssue = @issueId
        `;
        const issueResult = await transaction.request()
            .input('issueId', sql.NVarChar, trelloIdIssue)
            .query(issueQuery);

        if (issueResult.recordset.length === 0) {
            throw new Error('Issue não encontrado na tabela Issue.');
        }

        const issueId = issueResult.recordset[0].id;
        const projectId = issueResult.recordset[0].projectId;

        log(`Issue encontrado: id = ${issueId}, projectId = ${projectId}`);

        for (let label of labels) {
            const colorHex = getColorHex(label.color);
            log(`Processando label: ${label.name} com cor ${label.color} (${colorHex})`);

            // Verificar se o label já existe na tabela Badge
            const checkBadgeQuery = `
               SELECT b.id FROM Badge B
               INNER JOIN IssueBadges IB ON IB.badgeId = B.id
               WHERE IB.issueId = @issueId AND nameTag = @nameTag AND color = @color
            `;
            const checkRequest = transaction.request();
            checkRequest.input('nameTag', sql.NVarChar, label.name);
            checkRequest.input('color', sql.NVarChar, colorHex);
            checkRequest.input('issueId', sql.Int, issueId)

            const checkResult = await checkRequest.query(checkBadgeQuery);
            let badgeId;

            if (checkResult.recordset.length > 0) {
                // O label já existe, reutilizar o badgeId
                badgeId = checkResult.recordset[0].id;
                log(`Badge existente encontrado: id = ${badgeId}`);
            } else {
                // O label não existe, inserir um novo na tabela Badge
                const request = transaction.request();
                request.input('nameTag', sql.NVarChar, label.name);
                request.input('color', sql.NVarChar, colorHex);
                request.input('projectId', sql.Int, projectId);
                request.input('userId', sql.Int, 1);

                const insertBadgeQuery = `
                    INSERT INTO Badge (projectId, color, nameTag, userId, createdAt, updatedAt, issueId, desktopId, coordinationId, typeBadge)
                    OUTPUT inserted.id
                    VALUES (null, @color, @nameTag, @userId, GETDATE(), GETDATE(), null, null, null, null)
                `;
                const result = await request.query(insertBadgeQuery);
                badgeId = result.recordset[0].id;
                log(`Novo badge inserido: id = ${badgeId}`);
            }

            // Inserir o relacionamento na tabela IssueBadges
            const issueBadgesRequest = transaction.request();
            issueBadgesRequest.input('issueId', sql.Int, issueId);
            issueBadgesRequest.input('badgeId', sql.Int, badgeId);

            const insertIssueBadgeQuery = `
                INSERT INTO IssueBadges (issueId, badgeId, createdAt)
                VALUES (@issueId, @badgeId, GETDATE())
            `;
            await issueBadgesRequest.query(insertIssueBadgeQuery);
            log(`Badge (${badgeId}) associado ao Issue (${issueId}) com sucesso.`);
        }

        await transaction.commit();
        log('Labels processados e inseridos com sucesso.');

    } catch (error) {
        await transaction.rollback();
        console.error('Erro ao processar labels:', error);
        log(`Erro ao processar badges para o Issue com trelloIdIssue: ${trelloIdIssue}. Detalhes: ${error.message}`);
    }
}

// Função para converter nomes de cores em hex
function getColorHex(colorName) {

    if (!colorName) {
        throw new Error('Nome da cor inválido. Forneça uma string válida.', colorName);
    }

    // Normalizar o nome da cor (minúsculas)
    const normalizedColorName = colorName;

    // Verificar correspondência exata
    if (trelloColors[normalizedColorName]) {
        return trelloColors[normalizedColorName];
    }

    // Tentar encontrar uma cor que contenha o nome fornecido
    for (let name in trelloColors) {
        if (name.includes(normalizedColorName)) {
            return trelloColors[name];
        }
    }

    // Tentar encontrar a cor mais semelhante (caso você tenha uma biblioteca de correspondência difusa)
    const closestColor = findClosestColor(normalizedColorName, trelloColors);

    // Se não encontrar cor semelhante, retornar azul como padrão
    return closestColor || '#0000FF'; // Azul se não encontrar nenhuma correspondência
}

function findClosestColor(colorName, colorMap) {
    let closestMatch = null;
    let highestSimilarity = 0;

    for (let name in colorMap) {
        const similarity = stringSimilarity(colorName, name);
        if (similarity > highestSimilarity) {
            highestSimilarity = similarity;
            closestMatch = colorMap[name];
        }
    }

    return closestMatch;
}


function stringSimilarity(str1, str2) {
    const len = Math.min(str1.length, str2.length);
    let score = 0;
    for (let i = 0; i < len; i++) {
        if (str1[i] === str2[i]) {
            score++;
        }
    }
    return score / Math.max(str1.length, str2.length);
}

const trelloColors = {
    "green": "#61BD4F",
    "yellow": "#F2D600",
    "orange": "#FFAB4A",
    "red": "#EB5A46",
    "purple": "#C377E0",
    "blue": "#0079BF",
    "sky": "#00C2E0",
    "lime": "#51E898",
    "pink": "#FF80CE",
    "black": "#4D4D4D"
};

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

        if (!trelloIdIssue) {
            throw new Error('Invalid trelloIdIssue: The value is undefined, null, or an empty string');
        }

        // Verificar se o Issue existe
        const issueQuery = `SELECT id FROM Issue WHERE trelloIdIssue = @issueId`;
        const issueResult = await transaction.request()
            .input('issueId', sql.NVarChar, trelloIdIssue)
            .query(issueQuery);

        if (issueResult.recordset.length === 0) {
            throw new Error(`Issue com trelloIdIssue ${trelloIdIssue} não encontrado na tabela Issue`);
        }

        const issueId = issueResult.recordset[0].id;
        log(`Issue encontrado com sucesso. IssueId: ${issueId} para o trelloIdIssue: ${trelloIdIssue}`);

        for (let checklistId of checklistIds) {
            const checklist = await getChecklist(checklistId);

            if (!checklist || !checklist.name) {
                log(`Checklist com ID ${checklistId} não foi encontrado ou está incompleto. Pulando checklist.`);
                continue;
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
            const checklistID = checklistResult.recordset[0].checklistID;

            if (!checklistID) {
                log(`Falha ao inserir checklist ${checklist.name}. Pulando checklist.`);
                continue;
            }

            log(`Checklist inserido com sucesso. ChecklistID: ${checklistID}`);

            // Inserir os itens do checklist
            for (let item of checklist.checkItems) {
                const checklistItemRequest = transaction.request();
                checklistItemRequest.input('checklistID', sql.Int, checklistID);
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
                    log(`Item do checklist inserido com sucesso. ChecklistItemID: ${checklistItemID}, Nome do Item: ${item.name}`);
                } else {
                    log(`Falha ao inserir item do checklist. Nome do Item: ${item.name}`);
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
async function getChecklist(id, retryCount = 3) {
    try {
        const response = await fetch(`https://api.trello.com/1/checklists/${id}?key=${process.env.API_KEY}&token=${process.env.API_TOKEN}`);
        if (!response.ok) {
            throw new Error(`Erro ao buscar checklist do Trello: ${response.statusText}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        if (retryCount > 0) {
            await new Promise(res => setTimeout(res, 2000));
            return getChecklist(id, retryCount - 1);
        } else {
            console.error(`Erro ao recuperar checklist do Trello (ID: ${id}):`, error);
            return null;
        }
    }
}
// Função para inserir Comentarios
async function processComment(actionsFilePath, pool) {
    try {
        const filePath = path.join(actionsFilePath, 'actions.json');

        if (!fs.existsSync(filePath)) {
            console.log(`O arquivo ${filePath} não foi encontrado.`);
            return;
        }

        const rawData = fs.readFileSync(filePath);
        const actions = JSON.parse(rawData);

        const transaction = await pool.transaction();
        await transaction.begin();

        try {
            for (const action of actions) {
                // Verifica se o tipo da ação é "commentCard"
                if (action.type === "commentCard") {
                    let id, fullName, username;

                    if (action.memberCreator) {
                        ({ id, fullName, username } = action.memberCreator);
                    } else {
                        id = 'TrelloUser';
                        fullName = 'TrelloUser';
                        username = 'TrelloUser';
                    }

                    const email = `${username}@example.com`;

                    // Verifica se os dados do comentário estão presentes
                    if (!action.data.card || !action.data.card.id || !action.data.text) {
                        console.log('Dados incompletos no comentário, pulando para o próximo.');
                        continue; // Pula para o próximo comentário
                    }

                    // Verifica se o usuário já existe
                    const userQuery = `SELECT id FROM [User] WHERE trelloIdUser = @userId`;
                    const userResult = await transaction.request()
                        .input('userId', sql.NVarChar, id)
                        .query(userQuery);

                    let userId;
                    if (userResult.recordset.length === 0) {
                        const insertUserQuery = `
                            INSERT INTO [User] (trelloIdUser, pwd, username, email, profileUrl, lastLoggedIn, createdAt, updatedAt, profileSimaId)
                            VALUES (@userId, '0x0001', @fullName, @email, '', GETDATE(), GETDATE(), GETDATE(), NULL);
                            SELECT SCOPE_IDENTITY() AS userId;
                        `;

                        const insertUserResult = await transaction.request()
                            .input('userId', sql.NVarChar, id)
                            .input('fullName', sql.NVarChar, fullName)
                            .input('email', sql.NVarChar, email)
                            .query(insertUserQuery);

                        userId = insertUserResult.recordset[0].userId;
                    } else {
                        userId = userResult.recordset[0].id;
                    }

                    // Verifica se o cartão existe
                    const issueQuery = `SELECT id FROM Issue WHERE trelloIdIssue = @issueId`;
                    const issueResult = await transaction.request()
                        .input('issueId', sql.NVarChar, action.data.card.id)
                        .query(issueQuery);

                    if (issueResult.recordset.length === 0) {
                        continue; // Pula para o próximo comentário
                    }

                    const issueId = issueResult.recordset[0].id;

                    // Deleta comentários anteriores com o mesmo ID de ação
                    await transaction.request()
                        .input('trelloIdAction', sql.NVarChar, action.id)
                        .query('DELETE FROM Comment WHERE trelloIdAction = @trelloIdAction');

                    // Insere o novo comentário
                    const commentQuery = `
                        INSERT INTO Comment (descr, createdAt, issueId, userId, trelloIdAction, isEdit)
                        VALUES (@descr, @createdAt, @issueId, @userId, @trelloIdAction, NULL);
                    `;
                    await transaction.request()
                        .input('descr', sql.NVarChar, action.data.text)
                        .input('createdAt', sql.DateTime, new Date(action.date))
                        .input('issueId', sql.Int, issueId)
                        .input('userId', sql.Int, userId)
                        .input('trelloIdAction', sql.NVarChar, action.id)
                        .query(commentQuery);

                }
            }

            // Commit da transação se todos os comentários forem processados sem erros
            await transaction.commit();
        } catch (err) {
            await transaction.rollback();
            console.error('Erro ao processar ações:', err.message);
        }
    } catch (error) {
        console.log(`Erro ao processar comentários: ${error.message}`);
    }
}

async function executeSqlServerInsert() {
    let pool;
    const connected = await testConnection();
    if (!connected) {
        console.log('Não foi possível executar o insert porque a conexão falhou.');
        return;
    }

    try {
        // Conecta ao banco de dados
        pool = await sql.connect(config);
        const desktopsString = desktopIdChange.map(name => `'${name}'`).join(',');

        if (optionExecuteSql.executeOnDelete) {
            await pool.request().query(`
                   -- 1. IssueFileSima (filha de Issue)
                   DELETE IFS
                   FROM IssueFileSima IFS
                   INNER JOIN Issue I ON I.id = IFS.issueId
                   INNER JOIN Desktop D ON D.id = I.desktopId
                   WHERE D.nameDesktop IN (${desktopsString});
                   
                   -- 2. IssueBadges
                   DELETE IB
                   FROM IssueBadges IB
                   INNER JOIN Issue I ON I.id = IB.issueId
                   INNER JOIN Desktop D ON D.id = I.desktopId
                   WHERE D.nameDesktop IN (${desktopsString});
                   
                   -- 3. Dependentes de Issue
                   DELETE A
                   FROM Accompanied A
                   INNER JOIN Issue I ON I.id = A.issueId
                   INNER JOIN Desktop D ON D.id = I.desktopId
                   WHERE D.nameDesktop IN (${desktopsString});
                   
                   DELETE N
                   FROM Notification N
                   INNER JOIN Issue I ON I.id = N.issueId
                   INNER JOIN Desktop D ON D.id = I.desktopId
                   WHERE D.nameDesktop IN (${desktopsString});
                   
                   DELETE LC
                   FROM LinkedCard LC
                   INNER JOIN Issue I ON I.id = LC.parentIdIssueId
                   INNER JOIN Desktop D ON D.id = I.desktopId
                   WHERE D.nameDesktop IN (${desktopsString});
                   
                   DELETE RT
                   FROM ReviewTask RT
                   INNER JOIN Issue I ON I.id = RT.issueId
                   INNER JOIN Desktop D ON D.id = I.desktopId
                   WHERE D.nameDesktop IN (${desktopsString});
                   
                   DELETE C
                   FROM Comment C
                   INNER JOIN Issue I ON I.id = C.issueId
                   INNER JOIN Desktop D ON D.id = I.desktopId
                   WHERE D.nameDesktop IN (${desktopsString});
                   
                   DELETE A
                   FROM Assignee A
                   INNER JOIN Issue I ON I.id = A.issueId
                   INNER JOIN Desktop D ON D.id = I.desktopId
                   WHERE D.nameDesktop IN (${desktopsString});
                   
                   DELETE HML
                   FROM HistoryMovimentList HML
                   INNER JOIN Issue I ON I.id = HML.issueId
                   INNER JOIN Desktop D ON D.id = I.desktopId
                   WHERE D.nameDesktop IN (${desktopsString});
                   
                   DELETE CL
                   FROM Checklist CL
                   INNER JOIN Issue I ON I.id = CL.issueId
                   INNER JOIN Desktop D ON D.id = I.desktopId
                   WHERE D.nameDesktop IN (${desktopsString});
                   
                   -- 4. Badge (depois que IssueBadges já foi apagado)
                   DELETE B
                   FROM Badge B
                   INNER JOIN IssueBadges IB ON B.id = IB.badgeId
                   INNER JOIN Issue I ON I.id = IB.issueId
                   INNER JOIN Desktop D ON D.id = I.desktopId
                   WHERE D.nameDesktop IN (${desktopsString});
                   
                   -- 5. Issue (depois de limpar todas as dependências)
                   DELETE I
                   FROM Issue I
                   INNER JOIN Desktop D ON D.id = I.desktopId
                   WHERE D.nameDesktop IN (${desktopsString});
                   
                   -- 6. List (depois que Issues já foram apagadas)
                   DELETE L
                   FROM List L
                   INNER JOIN Desktop D ON D.id = L.desktopId
                   WHERE D.nameDesktop IN (${desktopsString});
                   
                   -- 7. Project (depois que Lists já foram apagadas)
                   DELETE P
                   FROM Project P
                   INNER JOIN Desktop D ON D.id = P.desktopId
                   WHERE D.nameDesktop IN (${desktopsString});
                   
                   -- 8. Desktop (último nível)
                   DELETE D
                   FROM Desktop D
                   WHERE D.nameDesktop IN (${desktopsString});
            `);
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
        }
    }
}

// Função para percorrer os subdiretórios e processar os arquivos JSON
async function processDirectories(directoryPath, pool) {
    const start = Date.now();  // Início do tempo de execução

    try {

        const items = fs.readdirSync(directoryPath);

        // Definir caminhos para arquivos JSON esperados
        const organizationFile = path.join(directoryPath, 'organization.json');
        const boardFile = path.join(directoryPath, 'board.json');
        const listFile = path.join(directoryPath, 'list.json');
        const cardFile = path.join(directoryPath, 'card.json');
        const actionsFile = path.join(directoryPath, 'actions.json');

        // Processar arquivos JSON na ordem específica
        if (fs.existsSync(organizationFile)) {
            log(`[${new Date().toISOString()}] Iniciando processamento de 'organization.json' em: ${directoryPath}`);
            await insertDesktop(directoryPath, pool);
            log(`[${new Date().toISOString()}] Finalizado processamento de 'organization.json' em: ${directoryPath}`);
        }

        if (fs.existsSync(boardFile)) {
            log(`Iniciando processamento de 'board.json' em: ${directoryPath}`);
            await insertProjectData(directoryPath, pool);
            log(`Finalizado processamento de 'board.json' em: ${directoryPath}`);
        }

        if (fs.existsSync(listFile)) {
            log(`Iniciando processamento de 'list.json' em: ${directoryPath}`);
            await insertListData(directoryPath, pool);
            log(`Finalizado processamento de 'list.json' em: ${directoryPath}`);
        }

        if (fs.existsSync(cardFile)) {
            log(`Iniciando processamento de 'card.json' em: ${directoryPath}`);
            await processCardFile(directoryPath, pool);
            log(`Finalizado processamento de 'card.json' em: ${directoryPath}`);
        }

        if (fs.existsSync(actionsFile)) {
            log(`Iniciando processamento de 'actions.json' em: ${directoryPath}`);
            await processComment(directoryPath, pool);
            log(`Finalizado processamento de 'actions.json' em: ${directoryPath}`);
        }

        // Processar subdiretórios recursivamente
        for (const item of items) {
            const itemPath = path.join(directoryPath, item);
            const stats = fs.statSync(itemPath);

            if (stats.isDirectory()) {
                log(`Iniciando processamento do subdiretório: ${itemPath}`);
                await processDirectories(itemPath, pool);
                log(`Finalizado processamento do subdiretório: ${itemPath}`);
            }
        }

        const end = Date.now();  // Fim do tempo de execução
        const executionTimeInSeconds = (end - start) / 1000;
        const minutes = Math.floor(executionTimeInSeconds / 60);
        const seconds = Math.floor(executionTimeInSeconds % 60);

        log(`Inserção de dados no banco CONCLUÍDA! Tempo total de execução: ${minutes} minutos e ${seconds} segundos`);

    } catch (error) {
        const errorMessage = `Ocorreu um erro ao processar os diretórios em ${directoryPath}: ${error.message}`;
        log(`[${new Date().toISOString()}] Erro: ${errorMessage}`);
        throw new Error(errorMessage);
    }
}


module.exports = { executeSqlServerInsert };
