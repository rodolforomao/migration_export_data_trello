// // --------------------------------------------------------------------------------------------------------------------
// Developer: Henry Sampaio
// Date: 04/2024
// // --------------------------------------------------------------------------------------------------------------------
import * as fs from 'fs';
import * as sql from 'mssql'; 
import { dbConfig } from './dbConfig'; 

interface Comment {
    id: string;
    idMemberCreator: string;
    data: {
        text: string;
        card: {
            id: string;
        };
    };
    date: string;
}

async function createCommentsFromJSON(): Promise<void> {
    try {
        // Read JSON file
        let data = fs.readFileSync('json/actions.json', 'utf8');
        
        // Remove trailing commas
        data = data.replace(/,(\s*[\]}])/g, '$1');

        const comments: Comment[][] = JSON.parse(data);

        // Connect to MSSQL database
        const pool = await sql.connect(dbConfig);

        for (const commentGroup of comments) {
            for (const comment of commentGroup) {
                try {
                    // Check if data.text is present
                    if (!comment.data || !comment.data.text) {
                        console.log('Skipping comment with missing text:', comment.id);
                        continue; // Move to the next comment
                    }

                    // Check if comment already exists
                    const queryResult = await pool.request()
                        .query(`SELECT * FROM [dbo].[Comment] WHERE trelloIdAction = '${comment.id}'`);
                    
                    // If comment does not exist, insert it
                    if (queryResult.recordset.length === 0) {
                        // Retrieve IssueId based on comment's issue id
                        const issueQuery = `
                            SELECT id
                            FROM SUPRA_ALERTAS.[dbo].[Issue] 
                            WHERE trelloIdIssue = '${comment.data.card.id}'
                        `;
                        const issueResult = await pool.request().query(issueQuery);
                
                        // Check if an IssueId was found
                        if (issueResult.recordset.length === 0) {
                            console.error('No issue found for the comment:', comment.data.card.id);
                            continue; // Skip inserting if IssueId not found
                        }
                
                        const issueId = issueResult.recordset[0].id;
                
                        // Retrieve UserId based on comment's creator id
                        const userQuery = `
                            SELECT id
                            FROM SUPRA_ALERTAS.[dbo].[User] 
                            WHERE trelloIdUser = '${comment.idMemberCreator}'
                        `;
                        const userResult = await pool.request().query(userQuery);
                        
                        // Check if a UserId was found
                        if (userResult.recordset.length === 0) {
                            console.error('No user found for the comment creator:', comment.idMemberCreator);
                            continue; // Skip inserting if UserId not found
                        }
                
                        const userId = userResult.recordset[0].id;
                
                        // Insert comment into the database
                        const text = comment.data.text.replace(/'/g, '"');
                        const convertedDateTime = comment.date ? new Date(comment.date).toISOString() : new Date().toISOString(); // Default to current time if comment date is missing
                        const insertQuery = `
                            INSERT INTO [dbo].[Comment] (descr, createdAt, issueId, userId, trelloIdAction)
                            VALUES ('${text}', '${convertedDateTime}', '${issueId}', ${userId}, '${comment.id}')
                        `;
                        await pool.request().query(insertQuery);
                        console.log('Comment inserted successfully!');
                    } else {
                        console.log(`Comment with ID ${comment.id} already exists. Skipping insertion.`);
                    }
                } catch (error) {
                    console.error('Error executing query:', error);
                    throw error; // Stop execution if an error occurs
                }
            }
        }

        // Close database connection
        await pool.close();
        console.log('Comments created successfully.');
    } catch (error) {
        console.error('Error:', error);
        throw error; // Stop execution if an error occurs
    }
}

// Example usage: Create comments from JSON file
createCommentsFromJSON();
