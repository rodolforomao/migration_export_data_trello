"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Import fs module
var fs = require("fs");
// Function to find all JSON files with given names in a directory
function findJsonFiles(directory, fileNames) {
    var jsonFiles = [];
    // Walk through the directory and its subdirectories
    var files = fs.readdirSync(directory);
    for (var _i = 0, files_1 = files; _i < files_1.length; _i++) {
        var file = files_1[_i];
        var filePath = "".concat(directory, "/").concat(file);
        if (fs.statSync(filePath).isDirectory()) {
            // Recursively search subdirectories
            jsonFiles.push.apply(jsonFiles, findJsonFiles(filePath, fileNames));
        }
        else if (fileNames.includes(file)) {
            jsonFiles.push(filePath);
        }
    }
    return jsonFiles;
}
// Function to read JSON data from JSON files
function readJsonFiles(files) {
    var jsonArray = [];
    // Iterate over each JSON file
    for (var _i = 0, files_2 = files; _i < files_2.length; _i++) {
        var filePath = files_2[_i];
        try {
            // Load JSON data from the file
            var data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            // Append JSON data to the array
            jsonArray.push(data);
        }
        catch (error) {
            console.error("Error decoding JSON in file: ".concat(filePath, ". Skipping this file."));
        }
    }
    return jsonArray;
}
// Function to write combined JSON data to a file
function writeCombinedJson(data, outputFilePath, fileName) {
    try {
        // Write JSON data to the output file
        fs.writeFileSync(outputFilePath, JSON.stringify(data, null, 4));
        console.log("Combined JSON file for ".concat(fileName, " created successfully."));
    }
    catch (error) {
        console.error("Error writing combined JSON data for ".concat(fileName, ":"), error);
    }
}
// Usage:
var fileNames = ['organization.json', 'board.json', 'list.json', 'card.json', 'actions.json'];
var directoryPath = 'C:/Users/Henry.local/Desktop/Projects/backUpTrello/trelloRestore';
var outputDirectory = 'C:/Users/Henry.local/Desktop/Projects/carga_sima/ScriptToMSSQL1.1/json';
// Iterate over each file name to find corresponding files in the directory
for (var _i = 0, fileNames_1 = fileNames; _i < fileNames_1.length; _i++) {
    var fileName = fileNames_1[_i];
    var outputFilePath = "".concat(outputDirectory, "/").concat(fileName);
    // Find all JSON files with the current file name in the specified directory
    var jsonFiles = findJsonFiles(directoryPath, [fileName]);
    if (jsonFiles.length > 0) {
        // Read JSON data from JSON files
        var jsonData = readJsonFiles(jsonFiles);
        // Write combined JSON data to a single file
        writeCombinedJson(jsonData, outputFilePath, fileName);
    }
    else {
        console.log("No ".concat(fileName, " files found in the specified directory."));
    }
}
