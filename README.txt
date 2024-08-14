Utilização 

executar o comando: 
node app.js

// Define quais areas de trabalho serão recuperadas do trello
function desktopsChange() {
    const desktopChangeName = [
        'COMEC'
    ];
    return desktopChangeName;
}

// Define quais quadros serão recuperadas do trello
function boardsChange() {
    const boardsChangeName = [
        'COMEC'
    ];
    return boardsChangeName;
}

// Define quais informações adicionais serão recuperadas do trello
function executeFuntions() {
    const optionsFunctions = {
        processComment: true,
        processBagde: true,
        processCheckList: true,
        processAttachmentsTrello: true
    };
    return optionsFunctions;
}
		
		
Arquivo migrateSimaTrello.js
 fica as informações para alteração do banco de dados


 Funcionamento 
 apos executar node app.js , vai ser ser criado uma pasta chamada 'trelloRestore' onde vai ficar as pastas e json recuperados do trello.
 qnd terminar de recuperar os dados do trello , vai ser executado a função main() que vai levar para o arquivo migrateSimaTrello.js que vai realizar as inserções no banco do SIMA de acordo com Desktop,Project, List, Issue , Comment.
 As verificações são feitos pela coluna trelloId , existentes em cada tabela do banco SIMA