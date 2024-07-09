const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { main } = require('./migrateSimaTrello.js'); 
const { process } = require('process');
//import config from './config/dbConfig.js'

require('dotenv').config(); 

async function fetchAndSaveOrganizationData() {
    try {
        const organizationsResponse = await axios.get('https://api.trello.com/1/members/me/organizations', {
            params: {
                key: process.env.API_KEY,
                token: process.env.API_TOKEN
            },
            headers: {
                'Cookie': process.env.COOKIE
            }
        });
        const organization = organizationsResponse.data;
        const organizations = [];

        organization.forEach(org => {
            if (org.displayName === 'CGPERT') { // Substitua 'CGCONT' pelo displayName que você está procurando
                organizations.push(org);
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
            key: process.env.API_KEY,
            token: process.env.API_TOKEN
        },
        headers: {
            'Cookie': process.env.COOKIE
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
            key: process.env.API_KEY,
            token: process.env.API_TOKEN
        },
        headers: {
            'Cookie': process.env.COOKIE
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
            key: process.env.API_KEY,
            token: process.env.API_TOKEN
        },
        headers: {
            'Cookie': process.env.COOKIE
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

}

async function fetchAndSaveActions(cardId, cardPath) {
    const actionsResponse = await axios.get(`https://api.trello.com/1/cards/${cardId}/actions`, {
        params: {
            key: process.env.API_KEY,
            token: process.env.API_TOKEN
        },
        headers: {
            'Cookie': process.env.COOKIE
        }
    });
    const actions = actionsResponse.data;

    fs.writeFileSync(path.join(cardPath, 'actions.json'), JSON.stringify(actions, null, 2));
}

(async () => {
    await fetchAndSaveOrganizationData();
    await main(); 
})();