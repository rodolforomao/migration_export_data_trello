Migração Trello → SIMA
Este projeto realiza a recuperação de dados do Trello e a migração para o banco de dados do SIMA.

Utilização:

Configure o arquivo .env com as credenciais do banco e do Trello:

DB_USER = ''

DB_PASSWORD = ''

DB_SERVER = ''

DB_DATABASE_NAME = ''

API_TOKEN = ''

API_KEY = ''

Execute o comando no terminal:
node app.js

Configurações do Script:

Áreas de Trabalho (desktops) recuperadas do Trello:

function desktopsChange() {
    const desktopChangeName = [
        'COMEC'
    ];
    return desktopChangeName;
}


Quadros (boards) recuperados do Trello:

function boardsChange() {
    const boardsChangeName = [
        'COMEC'
    ];
    return boardsChangeName;
}


Informações adicionais que serão recuperadas:

function executeFuntions() {
    const optionsFunctions = {
        processComment: true,
        processBagde: true,
        processCheckList: true,
        processAttachmentsTrello: true
    };
    return optionsFunctions;
}


Arquivos:

app.js → Arquivo principal de execução.

migrateSimaTrello.js → Contém as regras de inserção e alteração no banco SIMA.

Funcionamento:

Após executar o comando node app.js, será criada a pasta trelloRestore, onde ficarão as pastas e arquivos JSON recuperados do Trello.

Quando a recuperação terminar, será executada a função main(), que chama o arquivo migrateSimaTrello.js.

O migrateSimaTrello.js realiza as inserções no banco SIMA, de acordo com as entidades Desktop, Project, List, Issue e Comment.

Todas as verificações de duplicidade são feitas utilizando a coluna trelloId, presente em cada tabela do SIMA.

Fluxo Resumido:
Trello → Recuperação de dados → trelloRestore/ → migrateSimaTrello.js → Banco SIMA
