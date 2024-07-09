Utilização 

executar o comando: 
node app.js

na linha 24 é possivel escolhar a area de trabalho
        organizations.forEach(org => {
            if (org.displayName === 'CGPERT') { // Substitua 'CGCONT' pelo displayName que você está procurando
                foundOrganizations.push(org);
            }
        });
		
		
		
Arquivo migrateSimaTrello.js
 fica as informações para alteração do banco de dados


 Funcionamento 
 apos executar node app.js , vai ser ser criado uma pasta chamada 'trelloRestore' onde vai ficar as pastas e json recuperados do trello.
 qnd terminar de recuperar os dados do trello , vai ser executado a função main() que vai levar para o arquivo migrateSimaTrello.js que vai realizar as inserções no banco do SIMA de acordo com Desktop,Project, List, Issue , Comment.
 As verificações são feitos pela coluna trelloId , existentes em cada tabela do banco SIMA