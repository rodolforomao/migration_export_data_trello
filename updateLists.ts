// // --------------------------------------------------------------------------------------------------------------------
// Developer: Henry Sampaio
// Date: 04/2024
// // --------------------------------------------------------------------------------------------------------------------
import * as fs from 'fs';
import * as sql from 'mssql'; 
import { dbConfig } from './dbConfig'; 

interface List {
    id: string;
    name: string;
    idBoard: string;
}

async function createListsFromJson(): Promise<void> {
    try {
        // Read JSON file
        const data = fs.readFileSync('json/list.json', 'utf8');
        const lists: List[] = JSON.parse(data);

        // Connect to MSSQL database
        const pool = await sql.connect(dbConfig);

        let order = 1; // Initialize order counter

        for (const list of lists) {
            try {
                // Check if list already exists
                const queryResult = await pool.request()
                    .query(`SELECT * FROM [dbo].[List] WHERE trelloIdList = '${list.id}'`);
                
                // If list does not exist, insert it
                if (queryResult.recordset.length === 0) {
                    // Retrieve ProjectId based on list.idBoard
                    const projectQuery = `
                        SELECT id
                        FROM SUPRA_ALERTAS.[dbo].[Project] 
                        WHERE trelloIdCard = '${list.idBoard}'
                    `;
                    const projectResult = await pool.request().query(projectQuery);
            
                    // Check if a ProjectId was found
                    if (projectResult.recordset.length === 0) {
                        console.error('No project found for the list:', list.idBoard);
                        continue; // Skip inserting if ProjectId not found
                    }
            
                    const projectId = projectResult.recordset[0].id;
            
                    // Insert list into the database
                    const insertQuery = `
                        INSERT INTO [dbo].[List] (name, [order], createdAt, updatedAt, projectId, trelloIdList)
                        VALUES ('${list.name}', ${order}, GETDATE(), GETDATE(), ${projectId}, '${list.id}')
                    `;
            
                    await pool.request().query(insertQuery);
                    console.log('List inserted successfully!');
                } else {
                    console.log(`List with ID ${list.id} already exists. Skipping insertion.`);
                }

                // Increment order for the next list
                order++;
            } catch (error) {
                console.error('Error executing query:', error);
            }
        }

        // Close database connection
        await pool.close();
        console.log('Lists created successfully.');
        
    } catch (error) {
        console.error('Error:', error);
    }
}

// Example usage: Create lists from JSON file
createListsFromJson();
