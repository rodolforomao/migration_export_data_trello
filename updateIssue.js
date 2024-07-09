"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
// // --------------------------------------------------------------------------------------------------------------------
// Developer: Henry Sampaio
// Date: 04/2024
// // --------------------------------------------------------------------------------------------------------------------
var fs = require("fs");
var sql = require("mssql");
var dbConfig_1 = require("./dbConfig");
function createIssuesFromJson() {
    return __awaiter(this, void 0, void 0, function () {
        var data, issues, pool, order, _i, issues_1, issue, queryResult, listQuery, listResult, listId, maxLengthForName, maxLengthForDesc, truncatedName, truncatedDesc, insertQuery, error_1, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 13, , 14]);
                    data = fs.readFileSync('json/card.json', 'utf8');
                    issues = JSON.parse(data);
                    return [4 /*yield*/, sql.connect(dbConfig_1.dbConfig)];
                case 1:
                    pool = _a.sent();
                    order = 1;
                    _i = 0, issues_1 = issues;
                    _a.label = 2;
                case 2:
                    if (!(_i < issues_1.length)) return [3 /*break*/, 11];
                    issue = issues_1[_i];
                    _a.label = 3;
                case 3:
                    _a.trys.push([3, 9, , 10]);
                    return [4 /*yield*/, pool.request()
                            .query("SELECT * FROM [dbo].[Issue] WHERE trelloIdIssue = '".concat(issue.id, "'"))];
                case 4:
                    queryResult = _a.sent();
                    if (!(queryResult.recordset.length === 0)) return [3 /*break*/, 7];
                    listQuery = "\n                        SELECT id\n                        FROM SUPRA_ALERTAS.[dbo].[List] \n                        WHERE trelloIdList = '".concat(issue.idList, "'\n                    ");
                    return [4 /*yield*/, pool.request().query(listQuery)];
                case 5:
                    listResult = _a.sent();
                    // Check if a ListId was found
                    if (listResult.recordset.length === 0) {
                        console.error('No list found for the issue:', issue.idList);
                        return [3 /*break*/, 10]; // Skip inserting if ListId not found
                    }
                    listId = listResult.recordset[0].id;
                    maxLengthForName = 100;
                    maxLengthForDesc = 500;
                    truncatedName = issue.name.substring(0, maxLengthForName).replace(/'/g, '"');
                    truncatedDesc = issue.desc.substring(0, maxLengthForDesc).replace(/'/g, '"');
                    insertQuery = "\n                        INSERT INTO [dbo].[Issue] ([order], type, summary, descr, createdAt, updatedAt, listId, priority, reporterId, trelloIdIssue)\n                        VALUES (".concat(order, ", 1, '").concat(truncatedName, "', '").concat(truncatedDesc, "', GETDATE(), GETDATE(), ").concat(listId, ", 1, 1, '").concat(issue.id, "')\n                    ");
                    return [4 /*yield*/, pool.request().query(insertQuery)];
                case 6:
                    _a.sent();
                    console.log('Issue inserted successfully!');
                    return [3 /*break*/, 8];
                case 7:
                    console.log("Issue with ID ".concat(issue.id, " already exists. Skipping insertion."));
                    _a.label = 8;
                case 8:
                    // Increment order for the next issue
                    order++;
                    return [3 /*break*/, 10];
                case 9:
                    error_1 = _a.sent();
                    console.error('Error executing query:', error_1);
                    throw error_1; // Stop execution if an error occurs
                case 10:
                    _i++;
                    return [3 /*break*/, 2];
                case 11: 
                // Close database connection
                return [4 /*yield*/, pool.close()];
                case 12:
                    // Close database connection
                    _a.sent();
                    console.log('Issues created successfully.');
                    return [3 /*break*/, 14];
                case 13:
                    error_2 = _a.sent();
                    console.error('Error:', error_2);
                    throw error_2; // Stop execution if an error occurs
                case 14: return [2 /*return*/];
            }
        });
    });
}
// Example usage: Create issues from JSON file
createIssuesFromJson();
