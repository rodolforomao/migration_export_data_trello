// // --------------------------------------------------------------------------------------------------------------------
// Developer: Henry Sampaio
// Date: 04/2024
// // --------------------------------------------------------------------------------------------------------------------
import * as fs from 'fs';
import * as sql from 'mssql'; 
import { dbConfig } from './dbConfig'; 

interface Desktop {
    id: string;
    name: string;
    displayName: string;
}

async function createDesktopsFromJSON(): Promise<void> {
    try {
        // Read JSON file
        const data = fs.readFileSync('json/organization.json', 'utf8');
        const desktops: Desktop[] = JSON.parse(data);

        // Connect to MSSQL database
        const pool = await sql.connect(dbConfig);


        for (const desktop of desktops) {
            // Check if desktop already exists
            const queryResult = await pool.request()
                .query(`SELECT * FROM [dbo].[Desktop] WHERE nameDesktop = '${desktop.displayName}' OR trelloIdProject = '${desktop.id}'`);
            
            // If desktop does not exist, insert it
            if (queryResult.recordset.length === 0) {
                const request = pool.request();
                await request.query(`
                    INSERT INTO [dbo].[Desktop] (nameDesktop, userId, trelloIdProject)
                    VALUES ('${desktop.displayName}', 1, '${desktop.id}')
                `);
            } else {
                console.log(`Desktop with ID ${desktop.id} or displayName ${desktop.displayName} already exists. Skipping insertion.`);
            }
        }

        // Close database connection
        await pool.close();
        console.log('Desktops created successfully.');
    } catch (error) {
        console.error('Error:', error);
    }
}

// Function Call
createDesktopsFromJSON();
