## ENGLISH

# -------------------- Database Configuration (dbConfig.ts)
The dbConfig.ts file contains the database configuration used by the JSON functions to connect to the MSSQL database.

## File Structure
 - File Name: dbConfig.ts
## Description
- user: Username for database authentication.
- password: Password for database authentication.
- server: Database server name/address.
- database: Name of the database to connect to.
- options: Additional options for the database connection.
# Usage
The dbConfig.ts file is imported into the JSON functions (updateDesktop.ts, updateProject.ts, etc.) to establish a connection to the MSSQL database. This centralizes the database configuration, making it easier to manage and update.

You can adjust and expand this section as needed to provide more detailed information about the dbConfig.ts file and its usage within your project.




# ------------------- JSON File Processor - OneForAll.js
This TypeScript script allows you to process multiple JSON files within a directory, combine their data, and write the combined JSON data to new files.

## Features
 - Find JSON Files: Recursively searches a specified directory and its subdirectories to find JSON files with given names.
 - Read JSON Files: Reads the JSON data from the found files.
 - Combine JSON Data: Combines the JSON data from multiple files into a single JSON array.
 - Write Combined JSON: Writes the combined JSON data to new files.
## Usage
1. Set Up Environment:
    Install Node.js if not already installed.
2. Install Dependencies:
    This script doesn't require any external dependencies.
3. Run the Script:
    Modify the fileNames, directoryPath, and 'OneForAll' variables in the script to specify the names of JSON files to process, the directory containing these files, and the output directory for the combined files.
4. Run the script using .bat
5. Output:
The script will create new JSON files in the specified 'OneForAll', each containing the combined JSON data from the corresponding input files.


# -------------------- From JSON, Insert into MSSQL Database

This script reads desktop data from a JSON file and inserts it into a Microsoft SQL Server database. It ensures that duplicate records are not inserted into the database.

## Requirements

- Node.js installed on your machine
- npm (Node Package Manager) installed on your machine
- Microsoft SQL Server instance with appropriate access credentials
- Get json through OneForAll.js of desktop data (`organication.json`)
- Get json through OneForAll.js of project data (`board.json`)
- Get json through OneForAll.js of list data (`list.json`)
- Get json through OneForAll.js of issue data (`card.json`)
- Get json through OneForAll.js of comment data (`actions.json`)

## Usage

To run the script, execute the .bat





## PT-BR

# -------------------- Configuração do banco de dados (dbConfig.ts)
O arquivo dbConfig.ts contém a configuração do banco de dados usada pelas funções JSON para conectar-se ao banco de dados MSSQL.

## Estrutura do arquivo
 - Nome do arquivo: dbConfig.ts
## Descrição
- user: Nome de usuário para autenticação do banco de dados.
- senha: Senha para autenticação do banco de dados.
- servidor: nome/endereço do servidor de banco de dados.
- banco de dados: Nome do banco de dados ao qual se conectar.
- options: Opções adicionais para conexão com o banco de dados.
# Uso
O arquivo dbConfig.ts é importado para as funções JSON (updateDesktop.ts, updateProject.ts, etc.) para estabelecer uma conexão com o banco de dados MSSQL. Isso centraliza a configuração do banco de dados, facilitando o gerenciamento e a atualização.

Você pode ajustar e expandir esta seção conforme necessário para fornecer informações mais detalhadas sobre o arquivo dbConfig.ts e seu uso em seu projeto.




# ------------------- Processador de arquivo JSON - OneForAll.js
Este script TypeScript permite processar vários arquivos JSON em um diretório, combinar seus dados e gravar os dados JSON combinados em novos arquivos.

## Características
 - Encontrar arquivos JSON: pesquisa recursivamente um diretório especificado e seus subdiretórios para encontrar arquivos JSON com nomes próprios.
 - Ler arquivos JSON: lê os dados JSON dos arquivos encontrados.
 - Combine dados JSON: combina os dados JSON de vários arquivos em uma única matriz JSON.
 - Gravar JSON combinado: grava os dados JSON combinados em novos arquivos.
## Uso
1. Configurar ambiente:
 Instale o Node.js se ainda não estiver instalado.
2. Instale dependências:
 Este script não requer dependências externas.
3. Execute o script:
 Modifique as variáveis ​​fileNames, directoryPath e 'OneForAll' no script para especificar os nomes dos arquivos JSON a serem processados, o diretório que contém esses arquivos e o diretório de saída para os arquivos combinados.
4. Execute o script usando .bat
5. Saída:
O script criará novos arquivos JSON no 'OneForAll' especificado, cada um contendo os dados JSON combinados dos arquivos de entrada correspondentes.


# -------------------- Do JSON, insira no banco de dados MSSQL

Este script lê dados da área de trabalho de um arquivo JSON e os insere em um banco de dados Microsoft SQL Server. Garante que registros duplicados não sejam inseridos no banco de dados.

## Requisitos

- Node.js instalado em sua máquina
- npm (Node Package Manager) instalado em sua máquina
- Instância do Microsoft SQL Server com credenciais de acesso apropriadas
- Obtenha json por meio de OneForAll.js de dados de desktop (`organication.json`)
- Obtenha json através do OneForAll.js dos dados do projeto (`board.json`)
- Obtenha json por meio de OneForAll.js de dados de lista (`list.json`)
- Obtenha json por meio de OneForAll.js de dados de problemas (`card.json`)
- Obtenha json por meio de OneForAll.js de dados de comentários (`actions.json`)

## Uso

Para executar o script, execute o .bat