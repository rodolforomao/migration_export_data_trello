// // --------------------------------------------------------------------------------------------------------------------
// Developer: Henry Sampaio
// Date: 04/2024
// // --------------------------------------------------------------------------------------------------------------------
import * as fs from 'fs';
import * as sql from 'mssql'; 
import { dbConfig } from './dbConfig'; 

interface Issue {
    id: string;
    name: string;
    idBoard: string;
    idList: string;
    desc:string;
}

async function createIssuesFromJson(): Promise<void> {
    try {
        // Read JSON file
        const data = fs.readFileSync('json/card.json', 'utf8');
        const issues: Issue[] = JSON.parse(data);

        // Connect to MSSQL database
        const pool = await sql.connect(dbConfig);

        let order = 1; // Initialize order counter

        for (const issue of issues) {
            try {
                // Check if issue already exists
                const queryResult = await pool.request()
                    .query(`SELECT * FROM [dbo].[Issue] WHERE trelloIdIssue = '${issue.id}'`);
                
                // If issue does not exist, insert it
                if (queryResult.recordset.length === 0) {
                    // Retrieve ListId based on issue.idList
                    const listQuery = `
                        SELECT id
                        FROM SUPRA_ALERTAS.[dbo].[List] 
                        WHERE trelloIdList = '${issue.idList}'
                    `;
                    const listResult = await pool.request().query(listQuery);
            
                    // Check if a ListId was found
                    if (listResult.recordset.length === 0) {
                        console.error('No list found for the issue:', issue.idList);
                        continue; // Skip inserting if ListId not found
                    }
            
                    const listId = listResult.recordset[0].id;
            
                    // Truncate name and description if they exceed maximum lengths
                    const maxLengthForName = 100; // Replace 100 with the actual maximum length for your 'summary' column
                    const maxLengthForDesc = 500; // Replace 500 with the actual maximum length for your 'descr' column
                    const truncatedName = issue.name.substring(0, maxLengthForName).replace(/'/g, '"'); 
                    const truncatedDesc = issue.desc.substring(0, maxLengthForDesc).replace(/'/g, '"');
                    
                    // Insert issue into the database
                    const insertQuery = `
                        INSERT INTO [dbo].[Issue] ([order], type, summary, descr, createdAt, updatedAt, listId, priority, reporterId, trelloIdIssue)
                        VALUES (${order}, 1, '${truncatedName}', '${truncatedDesc}', GETDATE(), GETDATE(), ${listId}, 1, 1, '${issue.id}')
                    `;
            
                    await pool.request().query(insertQuery);
                    console.log('Issue inserted successfully!');
                } else {
                    console.log(`Issue with ID ${issue.id} already exists. Skipping insertion.`);
                }

                // Increment order for the next issue
                order++;
            } catch (error) {
                console.error('Error executing query:', error);
                throw error; // Stop execution if an error occurs
            }
        }

        // Close database connection
        await pool.close();
        console.log('Issues created successfully.');
        
    } catch (error) {
        console.error('Error:', error);
        throw error; // Stop execution if an error occurs
    }
}

// Example usage: Create issues from JSON file
createIssuesFromJson();
