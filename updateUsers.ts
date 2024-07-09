// // --------------------------------------------------------------------------------------------------------------------
// Developer: Henry Sampaio
// Date: 04/2024
// // --------------------------------------------------------------------------------------------------------------------
import * as fs from 'fs';
import * as sql from 'mssql'; 

interface Member {
    id: string;
    fullName: string;
    username: string;
}


async function createMembersFromJSON(): Promise<void> {
    try {
        // Read JSON file
        const data = fs.readFileSync('json/members.json', 'utf8');
        const members: Member[] = JSON.parse(data);

        // Connect to MSSQL database
        const pool = await sql.connect({
            user: 'henrysampaio',
            password: '230367',
            server: 'G4F-PE0B2PTB\\SQLEXPRESS',
            database: 'SIMA',
            options: {
                encrypt: true,  // Encrypt data (SSL/TLS)
                trustServerCertificate: true  // Trust the server certificate (use with caution)
            }
        });

        for (const member of members) {
            // Insert member into the database
            const request = pool.request();
            await request.query(`
            INSERT INTO [dbo].[User] (email, username, pwd, createdAt, updatedAt, trelloIdUser)
            VALUES ('${member.username}@dnit.gov.com.br', '${member.username}', 'e10adc3949ba59abbe56e057f20f883e', GETDATE(), GETDATE(), '${member.id}')
            `);
        }

        // Close database connection
        await pool.close();
        console.log('Members created successfully.');
    } catch (error) {
        console.error('Error:', error);
    }
}

// Example usage: Create members from JSON file
createMembersFromJSON();