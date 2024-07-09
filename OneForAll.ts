// Import fs module
import * as fs from 'fs';

// Define the interface for JSON data
interface JsonData {
    [key: string]: any;
}

// Function to find all JSON files with given names in a directory
function findJsonFiles(directory: string, fileNames: string[]): string[] {
    const jsonFiles: string[] = [];

    // Walk through the directory and its subdirectories
    const files = fs.readdirSync(directory);
    for (const file of files) {
        const filePath = `${directory}/${file}`;
        if (fs.statSync(filePath).isDirectory()) {
            // Recursively search subdirectories
            jsonFiles.push(...findJsonFiles(filePath, fileNames));
        } else if (fileNames.includes(file)) {
            jsonFiles.push(filePath);
        }
    }

    return jsonFiles;
}

// Function to read JSON data from JSON files
function readJsonFiles(files: string[]): JsonData[] {
    const jsonArray: JsonData[] = [];

    // Iterate over each JSON file
    for (const filePath of files) {
        try {
            // Load JSON data from the file
            const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            // Append JSON data to the array
            jsonArray.push(data);
        } catch (error) {
            console.error(`Error decoding JSON in file: ${filePath}. Skipping this file.`);
        }
    }

    return jsonArray;
}

// Function to write combined JSON data to a file
function writeCombinedJson(data: JsonData[], outputFilePath: string, fileName: string): void {
    try {
        // Write JSON data to the output file
        fs.writeFileSync(outputFilePath, JSON.stringify(data, null, 4));
        console.log(`Combined JSON file for ${fileName} created successfully.`);
    } catch (error) {
        console.error(`Error writing combined JSON data for ${fileName}:`, error);
    }
}

// Usage:
const fileNames = ['organization.json', 'board.json', 'list.json', 'card.json', 'actions.json']; 
const directoryPath = 'C:/Users/Henry.local/Desktop/Projects/backUpTrello/trelloRestore';
const outputDirectory = 'C:/Users/Henry.local/Desktop/Projects/carga_sima/ScriptToMSSQL1.1/json';

// Iterate over each file name to find corresponding files in the directory
for (const fileName of fileNames) {
    const outputFilePath = `${outputDirectory}/${fileName}`;
    // Find all JSON files with the current file name in the specified directory
    const jsonFiles = findJsonFiles(directoryPath, [fileName]);

    if (jsonFiles.length > 0) {
        // Read JSON data from JSON files
        const jsonData = readJsonFiles(jsonFiles);
        // Write combined JSON data to a single file
        writeCombinedJson(jsonData, outputFilePath, fileName);
    } else {
        console.log(`No ${fileName} files found in the specified directory.`);
    }
}
