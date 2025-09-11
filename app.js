const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { executeSqlServerInsert } = require('./importJsonTrelloForSqlSima.js');
const { desktopsChange, boardsChange, executeFuntions } = require('./config.js');
require('dotenv').config();

const displayNamesProcurados = desktopsChange();
const boardsChangeList = boardsChange();
const optionsFunctions = executeFuntions();

// Função para escrever logs
function log(message) {
    fs.appendFileSync('migration_logs.txt', message + '\n', 'utf8');
}

// Função para sanitizar nomes de arquivos/pastas inválidos no Windows + limite de tamanho
function sanitizeFileName(name, maxLength = 100) {
    let clean = name.replace(/[<>:"/\\|?*]/g, '-').trim();
    if (clean.length > maxLength) {
        const hash = crypto.createHash('md5').update(clean).digest('hex').slice(0, 8);
        clean = clean.substring(0, maxLength - 9) + '_' + hash;
    }
    return clean;
}

// Função segura para criar pastas
function createFolder(folderPath) {
    try {
        fs.mkdirSync(folderPath, { recursive: true });
    } catch (error) {
        log(`Erro ao criar a pasta "${folderPath}": ${error.message}`);
        throw error;
    }
}

// Função principal de migração
async function startMigrateTrelloSima() {
    try {
        console.log("Iniciando a migração do Trello...");
        log("Iniciando a migração do Trello...");

        const start = Date.now();

        if (!process.env.API_KEY || !process.env.API_TOKEN) {
            throw new Error('Chave da API ou Token não fornecidos.');
        }

        log("Buscando organizações...");
        const { data: organizations } = await axios.get(
            'https://api.trello.com/1/members/me/organizations',
            { params: { key: process.env.API_KEY, token: process.env.API_TOKEN } }
        );

        const organization = [];

        if (displayNamesProcurados.length > 0) {
            organizations.forEach(org => {
                if (displayNamesProcurados.includes(org.displayName)) {
                    organization.push(org);
                    log(`Desktop "${org.displayName}" adicionada para migração.`);
                }
            });
        } else {
            organization.push(...organizations);
        }

        if (organization.length === 0) {
            log('Nenhuma Desktop corresponde aos critérios especificados.');
            return;
        }

        const rootFolderPath = './trelloRestore';
        createFolder(rootFolderPath);

        for (const org of organization) {
            const orgName = sanitizeFileName(org.name);
            const orgPath = path.join(rootFolderPath, orgName);
            createFolder(orgPath);

            fs.writeFileSync(path.join(orgPath, 'organization.json'), JSON.stringify(org, null, 2));
            log(`Arquivo JSON da Desktop salvo em: ${path.join(orgPath, 'organization.json')}`);

            await fetchAndSaveBoards(org.id, orgPath);
        }

        const end = Date.now();
        const executionTimeInSeconds = (end - start) / 1000;
        const minutes = Math.floor(executionTimeInSeconds / 60);
        const seconds = Math.floor(executionTimeInSeconds % 60);
        console.log(`SCRIPT COMPLETO! Tempo total de execução: ${minutes} minutos e ${seconds} segundos`);
        log(`SCRIPT COMPLETO! Tempo total de execução: ${minutes} minutos e ${seconds} segundos`);
    } catch (error) {
        log('Ocorreu um erro ao buscar ou salvar as informações: ' + error.message);
        throw error; // garante que o script pare
    }
}

// Buscar e salvar boards
async function fetchAndSaveBoards(orgId, orgPath) {
    try {
        log(`Buscando quadros para a Desktop ID: ${orgId}...`);

        const { data: boards } = await axios.get(
            `https://api.trello.com/1/organizations/${orgId}/boards`,
            { params: { key: process.env.API_KEY, token: process.env.API_TOKEN } }
        );

        if (!boards || boards.length === 0) {
            log(`Nenhum quadro encontrado para a Desktop ID: ${orgId}.`);
            return;
        }

        let boardsToProcess;
        if (boardsChangeList.length > 0) {
            boardsToProcess = boards.filter(board =>
                boardsChangeList.includes(board.name)
            );
        } else {
            boardsToProcess = boards;
        }

        if (boardsToProcess.length === 0) {
            log(`Nenhum quadro corresponde aos critérios para a Desktop ID: ${orgId}.`);
            return;
        }

        log(`${boardsToProcess.length} quadros encontrados para a Desktop ID: ${orgId}.`);

        for (const board of boardsToProcess) {
            const boardName = sanitizeFileName(board.name);
            const boardPath = path.join(orgPath, boardName);
            createFolder(boardPath);

            fs.writeFileSync(path.join(boardPath, 'board.json'), JSON.stringify(board, null, 2));
            log(`Arquivo JSON do quadro salvo em: ${path.join(boardPath, 'board.json')}`);

            await fetchAndSaveLists(board.id, boardPath);
        }

    } catch (error) {
        log(`Erro ao buscar ou salvar quadros da Desktop ID: ${orgId}: ${error.message}`);
        throw error; // interrompe o script
    }
}

// Buscar e salvar listas
async function fetchAndSaveLists(boardId, boardPath) {
    try {
        log(`Buscando listas para o quadro ID: ${boardId}...`);

        const { data: lists } = await axios.get(
            `https://api.trello.com/1/boards/${boardId}/lists`,
            { params: { key: process.env.API_KEY, token: process.env.API_TOKEN } }
        );

        if (!lists || lists.length === 0) {
            log(`Nenhuma lista encontrada para o quadro ID: ${boardId}.`);
            return;
        }

        log(`${lists.length} lista(s) encontrada(s) para o quadro ID: ${boardId}.`);

        for (const list of lists) {
            const listName = sanitizeFileName(list.name);
            const listPath = path.join(boardPath, listName);
            createFolder(listPath);

            fs.writeFileSync(path.join(listPath, 'list.json'), JSON.stringify(list, null, 2));
            log(`Arquivo JSON da lista salvo em: ${path.join(listPath, 'list.json')}`);

            await fetchAndSaveCards(list.id, listPath);
        }

    } catch (error) {
        log(`Erro ao buscar ou salvar listas do quadro ID: ${boardId}: ${error.message}`);
        throw error;
    }
}

// Buscar e salvar cards
async function fetchAndSaveCards(listId, listPath) {
    try {
        log(`Buscando cartões para a lista ID: ${listId}...`);

        const { data: cards } = await axios.get(
            `https://api.trello.com/1/lists/${listId}/cards`,
            { params: { key: process.env.API_KEY, token: process.env.API_TOKEN } }
        );

        if (!cards || cards.length === 0) {
            log(`Nenhum cartão encontrado para a lista ID: ${listId}.`);
            return;
        }

        log(`${cards.length} cartão(ões) encontrado(s) para a lista ID: ${listId}.`);

        for (const card of cards) {
            const cardName = sanitizeFileName(card.shortLink);
            const cardPath = path.join(listPath, cardName);
            createFolder(cardPath);

            fs.writeFileSync(path.join(cardPath, 'card.json'), JSON.stringify(card, null, 2));
            log(`Arquivo JSON do cartão salvo em: ${path.join(cardPath, 'card.json')}`);

            await fetchAndSaveActions(card.id, cardPath);
        }

    } catch (error) {
        log(`Erro ao buscar ou salvar cartões da lista ID: ${listId}: ${error.message}`);
        throw error;
    }
}

// Buscar e salvar ações dos cards
async function fetchAndSaveActions(cardId, cardPath) {
    try {
        log(`Buscando ações para o cartão ID: ${cardId}...`);

        const { data: actions } = await axios.get(
            `https://api.trello.com/1/cards/${cardId}/actions`,
            { params: { key: process.env.API_KEY, token: process.env.API_TOKEN } }
        );

        if (!actions || actions.length === 0) {
            log(`Nenhuma ação encontrada para o cartão ID: ${cardId}.`);
            return;
        }

        fs.writeFileSync(path.join(cardPath, 'actions.json'), JSON.stringify(actions, null, 2));
        log(`Arquivo JSON das ações do cartão salvo em: ${path.join(cardPath, 'actions.json')}`);

    } catch (error) {
        log(`Erro ao buscar ou salvar ações do cartão ID: ${cardId}: ${error.message}`);
        throw error;
    }
}

// Função de execução
async function startProcess() {
    try {
        if (optionsFunctions.processExecuteSqlServer === true) {
            log("\nExecutando insert no banco...");
            executeSqlServerInsert();
        } else {
            log("\nChamando função para processar antes de inserir dados no banco...");
            await startMigrateTrelloSima();
        }
    } catch (error) {
        console.error('Processo interrompido devido a erro:', error.message);
    }
}

startProcess();
