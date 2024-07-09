import * as fs from 'fs';
import * as sql from 'mssql'; 
import { dbConfig } from './dbConfig'; 

interface Issue {
    BR: string;
    DataProximaFase: string;
    Objeto: string;
    ProximaFase: string;
    TipoContratacao: string;
}

async function getListIdByDate(pool, date: string): Promise<number | null> {
    try {
        const monthYear = date.split('/');
        const month = parseInt(monthYear[1], 10); // Extract month
        const year = parseInt(monthYear[2], 10); // Extract year

        // Construct the name of the list based on the month and year
        const listName = `${getMonthName(month)} ${year}`;

        // Query to get the ID of the list by name
        const query = `
            SELECT Id
            FROM [List]
            WHERE Name = '${listName}'
        `;

        const result = await pool.request().query(query);

        // If a list with the given name exists, return its ID, otherwise return null
        return result.recordset.length > 0 ? result.recordset[0].Id : null;
    } catch (error) {
        console.error('Error executing query:', error);
        throw error;
    }
}

function getMonthName(month: number): string {
    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    return monthNames[month - 1]; // Adjust index for zero-based array
}

async function createIssuesFromJson(): Promise<void> {
    try {
        const data = fs.readFileSync('json/a_licitar.json', 'utf8');
        const issues: Issue[] = JSON.parse(data);
        // console.log(issues);
        const pool = await sql.connect(dbConfig);

        let order = 1;

        for (const issue of issues) {
            try {
                const listId = await getListIdByDate(pool, issue.DataProximaFase);
                if (listId !== null) {
                    const insertQuery = `
                        INSERT INTO [dbo].[Issue] ([order], type, summary, descr, createdAt, updatedAt, listId, priority, reporterId, trelloIdIssue)
                        VALUES (${order}, 1, '${issue.BR} | ${issue.DataProximaFase}', '${issue.Objeto}\n ${issue.ProximaFase}\n ${issue.TipoContratacao}', GETDATE(), GETDATE(), ${listId}, 1, 1, null)
                    `;
        
                    await pool.request().query(insertQuery);
                    console.log('Issue inserted successfully!');

                    order++;
                } else {
                    const insertQuery = `
                    INSERT INTO [dbo].[Issue] ([order], type, summary, descr, createdAt, updatedAt, listId, priority, reporterId, trelloIdIssue)
                    VALUES (${order}, 1, '${issue.BR} | ${issue.DataProximaFase}', '${issue.Objeto}\n ${issue.ProximaFase}\n ${issue.TipoContratacao}', GETDATE(), GETDATE(), 678, 1, 1, null)
                    `;

                    await pool.request().query(insertQuery);
                    console.log('Issue "Sem Data" inserted successfully!');

                    order++;                
                }
            } catch (error) {
                console.error('Error executing query:', error);
                throw error;
            }
        }

        await pool.close();
        console.log('Issues created successfully.');
        
    } catch (error) {
        console.error('Error:', error);
        throw error;
    }
}

createIssuesFromJson();
