const axios = require('axios');
const fs = require('fs');
const path = require('path');
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

async function startMigrateTrelloSima() {
    try {
        console.log("Iniciando a migração do Trello...");

        log("Iniciando a migração do Trello...");

        const start = Date.now();

        if (optionsFunctions.processExecuteSqlServer === true) {
            log("\n Chamando função para começar a inserir dados no banco ...");
            executeSqlServerInsert();
        } else {

            // Verificação das variáveis de ambiente
            if (!process.env.API_KEY || !process.env.API_TOKEN) {
                throw new Error('Chave da API ou Token não fornecidos.');
            }

            log("Buscando organizações...");

            const organizationsResponse = await axios.get('https://api.trello.com/1/members/me/organizations', {
                params: {
                    key: process.env.API_KEY,
                    token: process.env.API_TOKEN
                },
                headers: {
                    'Cookie': process.env.COOKIE || ''
                }
            });

            const organization = organizationsResponse.data;

            if (!organization || organization.length === 0) {
                throw new Error('Nenhuma Desktop encontrada.');
            }

            log(`${organization.length} organizações encontradas.`);

            const organizations = [];

            organization.forEach(org => {
                if (displayNamesProcurados.includes(org.displayName)) {
                    organizations.push(org);
                    log(`Desktop "${org.displayName}" adicionada para migração.`);
                }
            });

            if (organizations.length === 0) {
                log('Nenhuma Desktop corresponde aos critérios especificados.');
                return;
            }

            const rootFolderPath = './trelloRestore';
            if (!fs.existsSync(rootFolderPath)) {
                fs.mkdirSync(rootFolderPath);
                log(`Diretório raiz criado em: ${rootFolderPath}`);
            } else {
                log(`Diretório raiz já existe: ${rootFolderPath}`);
            }

            for (const org of organizations) {
                const orgName = org.name.replace(/\//g, "-");
                const orgPath = path.join(rootFolderPath, orgName);

                if (!fs.existsSync(orgPath)) {
                    fs.mkdirSync(orgPath);
                    log(`Diretório da Desktop criado em: ${orgPath}`);
                } else {
                    log(`Diretório da Desktop "${orgName}" já existe.`);
                    await fetchAndSaveSubFolders(org.id, orgPath);
                    continue;
                }

                fs.writeFileSync(path.join(orgPath, 'organization.json'), JSON.stringify(org, null, 2));
                log(`Arquivo JSON da Desktop salvo em: ${path.join(orgPath, 'organization.json')}`);

                await fetchAndSaveSubFolders(org.id, orgPath);
            }

            console.log("\n Chamando função para começar a inserir dados no banco ...");
            log("\n Chamando função para começar a inserir dados no banco ...");
            executeSqlServerInsert();

            const end = Date.now();
            const executionTimeInSeconds = (end - start) / 1000;
            const minutes = Math.floor(executionTimeInSeconds / 60);
            const seconds = Math.floor(executionTimeInSeconds % 60);

            console.log(`SCRIPT COMPLETO! Tempo total de execução: ${minutes} minutos e ${seconds} segundos`);
            log(`SCRIPT COMPLETO! Tempo total de execução: ${minutes} minutos e ${seconds} segundos`);
        }
    } catch (error) {
        log('Ocorreu um erro ao buscar ou salvar as informações: ' + error.message);
    }
}

async function fetchAndSaveSubFolders(orgId, orgPath) {
    try {
        log(`Iniciando o processo de busca dos quadros para a Desktop com ID: ${orgId}...`);

        if (!orgId) {
            throw new Error('ID da Desktop não fornecido.');
        }

        // Requisição para buscar os quadros da Desktop
        const boardsResponse = await axios.get(`https://api.trello.com/1/organizations/${orgId}/boards`, {
            params: {
                key: process.env.API_KEY,
                token: process.env.API_TOKEN
            },
            headers: {
                'Cookie': process.env.COOKIE || ''
            }
        });

        let boards = boardsResponse.data;

        if (boardsChangeList.length > 0) {
            boards = boards.filter(board => boardsChangeList.includes(board.name));
        }

        // Verificar se há quadros
        if (!boards || boards.length === 0) {
            log(`Nenhum quadro encontrado para a Desktop com ID: ${orgId}.`);
            return;
        }

        log(`${boards.length} quadros encontrados para a Desktop com ID: ${orgId}.`);

        // Processar cada quadro
        for (const board of boards) {
            const boardName = board.name.replace(/\//g, "-");
            const boardPath = path.join(orgPath, boardName);

            if (!fs.existsSync(boardPath)) {
                fs.mkdirSync(boardPath, { recursive: true });
                log(`Diretório do quadro criado em: ${boardPath}`);
            } else {
                log(`Diretório do quadro "${boardName}" já existe.`);
            }

            // Salvar o arquivo JSON do quadro
            fs.writeFileSync(path.join(boardPath, 'board.json'), JSON.stringify(board, null, 2));
            log(`Arquivo JSON do quadro salvo em: ${path.join(boardPath, 'board.json')}`);

            // Buscar e salvar listas do quadro
            await fetchAndSaveSubLists(board.id, boardPath);
        }

        log(`Processo de busca dos quadros para a Desktop com ID: ${orgId} concluído.`);
    } catch (error) {
        log(`Erro ao buscar ou salvar quadros para a Desktop com ID: ${orgId}: ${error.message}`);
    }
}

async function fetchAndSaveSubLists(boardId, boardPath) {
    try {
        log(`Iniciando a busca das listas para o quadro com ID: ${boardId}...`);

        if (!boardId) {
            throw new Error('ID do quadro não fornecido.');
        }

        const listsResponse = await axios.get(`https://api.trello.com/1/boards/${boardId}/lists`, {
            params: {
                key: process.env.API_KEY,
                token: process.env.API_TOKEN
            },
            headers: {
                'Cookie': process.env.COOKIE || ''
            }
        });

        const lists = listsResponse.data;

        if (!lists || lists.length === 0) {
            log(`Nenhuma lista encontrada para o quadro com ID: ${boardId}.`);
            return;
        }

        log(`${lists.length} lista(s) encontrada(s) para o quadro com ID: ${boardId}.`);

        for (const list of lists) {
            const listName = list.name.replace(/\//g, "-");
            const listPath = path.join(boardPath, listName);

            if (!fs.existsSync(listPath)) {
                fs.mkdirSync(listPath);
                log(`Diretório da lista criado em: ${listPath}`);
            } else {
                log(`Pulando lista "${listName}" porque já foi salva.`);
                await fetchAndSaveSubCards(list.id, listPath);
                continue;
            }

            fs.writeFileSync(path.join(listPath, 'list.json'), JSON.stringify(list, null, 2));
            log(`Arquivo JSON da lista salvo em: ${path.join(listPath, 'list.json')}`);

            await fetchAndSaveSubCards(list.id, listPath);
        }

        log(`Processo de busca das listas para o quadro com ID: ${boardId} concluído.`);
    } catch (error) {
        log(`Erro ao buscar ou salvar listas para o quadro com ID: ${boardId}: ${error.message}`);
    }
}

async function fetchAndSaveSubCards(listId, listPath) {
    try {
        log(`Iniciando a busca dos cartões para a lista com ID: ${listId}...`);

        if (!listId) {
            throw new Error('ID da lista não fornecido.');
        }

        const cardsResponse = await axios.get(`https://api.trello.com/1/lists/${listId}/cards`, {
            params: {
                key: process.env.API_KEY,
                token: process.env.API_TOKEN
            },
            headers: {
                'Cookie': process.env.COOKIE || ''
            }
        });

        const cards = cardsResponse.data;

        if (!cards || cards.length === 0) {
            log(`Nenhum cartão encontrado para a lista com ID: ${listId}.`);
            return;
        }

        log(`${cards.length} cartão(ões) encontrado(s) para a lista com ID: ${listId}.`);

        for (const card of cards) {
            const cardName = card.shortLink;
            const cardPath = path.join(listPath, cardName);

            if (!fs.existsSync(cardPath)) {
                fs.mkdirSync(cardPath);
                log(`Diretório do cartão criado em: ${cardPath}`);
            } else {
                log(`Cartão "${cardName}" já existe.`);
                continue;
            }

            fs.writeFileSync(path.join(cardPath, 'card.json'), JSON.stringify(card, null, 2));
            log(`Arquivo JSON do cartão salvo em: ${path.join(cardPath, 'card.json')}`);

            await fetchAndSaveActions(card.id, cardPath);
        }

        log(`Processo de busca dos cartões para a lista com ID: ${listId} concluído.`);
    } catch (error) {
        log(`Erro ao buscar ou salvar cartões para a lista com ID: ${listId}: ${error.message}`);
    }
}

async function fetchAndSaveActions(cardId, cardPath) {
    try {
        log(`Iniciando a busca das ações para o cartão com ID: ${cardId}...`);

        if (!cardId) {
            throw new Error('ID do cartão não fornecido.');
        }

        const actionsResponse = await axios.get(`https://api.trello.com/1/cards/${cardId}/actions`, {
            params: {
                key: process.env.API_KEY,
                token: process.env.API_TOKEN
            },
            headers: {
                'Cookie': process.env.COOKIE || ''
            }
        });

        const actions = actionsResponse.data;

        if (!actions || actions.length === 0) {
            log(`Nenhuma ação encontrada para o cartão com ID: ${cardId}.`);
            return;
        }

        fs.writeFileSync(path.join(cardPath, 'actions.json'), JSON.stringify(actions, null, 2));
        log(`Arquivo JSON das ações do cartão salvo em: ${path.join(cardPath, 'actions.json')}`);

        log(`Processo de busca das ações para o cartão com ID: ${cardId} concluído.`);
    } catch (error) {
        log(`Erro ao buscar ou salvar ações para o cartão com ID: ${cardId}: ${error.message}`);
    }
}

startMigrateTrelloSima();
