const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { main } = require('./migrateSimaTrello.js'); 


const API_KEY = '1151021f37fbee27ad159ce4df025cc8';
const API_TOKEN = 'ATTAe39700bb9bb65854c5cbbb6474e08212348acce8670b0433424079cbcab23cd9D5BC6AC4';

async function fetchAndSaveOrganizationData() {
    try {
        const organizationsResponse = await axios.get('https://api.trello.com/1/members/me/organizations', {
            params: {
                key: API_KEY,
                token: API_TOKEN
            },
            headers: {
                'Cookie': 'dsc=835d5f553b6605dc6a4eb705bcf657de7f953eab26264d6ea4b49460ed5e683e'
            }
        });
        const organizations = organizationsResponse.data;
        const foundOrganizations = [];

        organizations.forEach(org => {
            if (org.displayName === 'CGPERT') { // Substitua 'CGCONT' pelo displayName que você está procurando
                foundOrganizations.push(org);
            }
        });
        
        const rootFolderPath = './trelloRestore';
        if (!fs.existsSync(rootFolderPath)) {
            fs.mkdirSync(rootFolderPath);
        }

        for (const org of organizations) {
            const orgName = org.name.replace(/\//g, "-");
            const orgPath = path.join(rootFolderPath, orgName);

            if (!fs.existsSync(orgPath)) {
                fs.mkdirSync(orgPath);
            } else {
                console.log(`Pulando organização ${orgName} porque já foi salva.`);
                await fetchAndSaveSubFolders(org.id, orgPath);
                continue;
            }

            fs.writeFileSync(path.join(orgPath, 'organization.json'), JSON.stringify(org, null, 2));

            await fetchAndSaveSubFolders(org.id, orgPath);
        }

        console.log('Informações dos quadros, listas, cartões e ações foram salvos com sucesso em trelloRestore!');
    } catch (error) {
        console.error('Ocorreu um erro ao buscar ou salvar as informações:', error);
    }
}

async function fetchAndSaveSubFolders(orgId, orgPath) {
    const boardsResponse = await axios.get(`https://api.trello.com/1/organizations/${orgId}/boards`, {
        params: {
            key: API_KEY,
            token: API_TOKEN
        },
        headers: {
            'Cookie': 'dsc=835d5f553b6605dc6a4eb705bcf657de7f953eab26264d6ea4b49460ed5e683e'
        }
    });
    const boards = boardsResponse.data;

    for (const board of boards) {
        const boardName = board.name.replace(/\//g, "-");
        const boardPath = path.join(orgPath, boardName);

        if (!fs.existsSync(boardPath)) {
            fs.mkdirSync(boardPath);
        } else {
            console.log(`Pulando quadro ${boardName} porque já foi salvo.`);
            await fetchAndSaveSubLists(board.id, boardPath);
            continue;
        }

        fs.writeFileSync(path.join(boardPath, 'board.json'), JSON.stringify(board, null, 2));

        await fetchAndSaveSubLists(board.id, boardPath);
    }
}

async function fetchAndSaveSubLists(boardId, boardPath) {
    const listsResponse = await axios.get(`https://api.trello.com/1/boards/${boardId}/lists`, {
        params: {
            key: API_KEY,
            token: API_TOKEN
        },
        headers: {
            'Cookie': 'dsc=835d5f553b6605dc6a4eb705bcf657de7f953eab26264d6ea4b49460ed5e683e'
        }
    });
    const lists = listsResponse.data;

    for (const list of lists) {
        const listName = list.name.replace(/\//g, "-");
        const listPath = path.join(boardPath, listName);

        //if (!fs.existsSync(listPath)) {
            fs.mkdirSync(listPath);
        // } else { 
        //     console.log(`Pulando lista ${listName} porque já foi salva.`);
        //     await fetchAndSaveSubCards(list.id, listPath);
        //     continue;
        // }

        fs.writeFileSync(path.join(listPath, 'list.json'), JSON.stringify(list, null, 2));

        await fetchAndSaveSubCards(list.id, listPath);
    }
}

async function fetchAndSaveSubCards(listId, listPath) {
    const cardsResponse = await axios.get(`https://api.trello.com/1/lists/${listId}/cards`, {
        params: {
            key: API_KEY,
            token: API_TOKEN
        },
        headers: {
            'Cookie': 'dsc=835d5f553b6605dc6a4eb705bcf657de7f953eab26264d6ea4b49460ed5e683e'
        }
    });
    const cards = cardsResponse.data;

    for (const card of cards) {
        const cardName = card.shortLink;
        const cardPath = path.join(listPath, cardName);

        //if (!fs.existsSync(cardPath)) {
            fs.mkdirSync(cardPath);
       // } else {
        //    console.log(`Pulando cartão ${cardName} porque já foi salvo.`);
        //    continue;
       // }

        fs.writeFileSync(path.join(cardPath, 'card.json'), JSON.stringify(card, null, 2));

        await fetchAndSaveActions(card.id, cardPath);
    }

    main();
}

async function fetchAndSaveActions(cardId, cardPath) {
    const actionsResponse = await axios.get(`https://api.trello.com/1/cards/${cardId}/actions`, {
        params: {
            key: API_KEY,
            token: API_TOKEN
        },
        headers: {
            'Cookie': 'dsc=835d5f553b6605dc6a4eb705bcf657de7f953eab26264d6ea4b49460ed5e683e'
        }
    });
    const actions = actionsResponse.data;

    fs.writeFileSync(path.join(cardPath, 'actions.json'), JSON.stringify(actions, null, 2));
}

fetchAndSaveOrganizationData();
