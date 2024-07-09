// // --------------------------------------------------------------------------------------------------------------------
// Developer: Henry Sampaio
// Date: 04/2024
// // --------------------------------------------------------------------------------------------------------------------
import * as fs from 'fs';
import * as sql from 'mssql'; 
import { dbConfig } from './dbConfig'; 

interface Project {
    id: string;
    name: string;
    desc: string;
    idOrganization: string;
}

async function createProjectsFromJson(): Promise<void> {
    try {
        // Read JSON file
        const data = fs.readFileSync('json/board.json', 'utf8');
        const projects: Project[] = JSON.parse(data);

        // Connect to MSSQL database
        const pool = await sql.connect(dbConfig);

        for (const project of projects) {
            try {
                // Check if project already exists
                const queryResult = await pool.request()
                    .query(`SELECT * FROM [dbo].[Project] WHERE trelloIdCard = '${project.id}'`);
                
                // If project does not exist, insert it
                if (queryResult.recordset.length === 0) {
                    // Retrieve desktopId based on project.idOrganization
                    const desktopQuery = `
                        SELECT id
                        FROM SUPRA_ALERTAS.[dbo].[Desktop] 
                        WHERE trelloIdProject = '${project.idOrganization}'
                    `;
                    const desktopResult = await pool.request().query(desktopQuery);
            
                    // Check if a desktopId was found
                    if (desktopResult.recordset.length === 0) {
                        console.error('No desktop found for the organization:', project.idOrganization);
                        continue; // Skip inserting if desktopId not found
                    }
            
                    const desktopId = desktopResult.recordset[0].id;
            
                    // Insert project into the database
                    const insertQuery = `
                        INSERT INTO [dbo].[Project] (name, createdAt, updatedAt, userId, desktopId, trelloIdCard)
                        VALUES ('${project.name}', GETDATE(), GETDATE(), 1, ${desktopId}, '${project.id}')
                    `;
            
                    await pool.request().query(insertQuery);
                    console.log('Project inserted successfully!');
                } else {
                    console.log(`Project with ID ${project.id} already exists. Skipping insertion.`);
                }
            } catch (error) {
                console.error('Error executing query:', error);
            }
        }

        // Close database connection
        await pool.close();
        console.log('Projects created successfully.');
        
    } catch (error) {
        console.error('Error:', error);
    }
}

// Example usage: Create projects from JSON file
createProjectsFromJson();
