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
function createCommentsFromJSON() {
    return __awaiter(this, void 0, void 0, function () {
        var data, comments, pool, _i, comments_1, commentGroup, _a, commentGroup_1, comment, queryResult, issueQuery, issueResult, issueId, userQuery, userResult, userId, text, convertedDateTime, insertQuery, error_1, error_2;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 16, , 17]);
                    data = fs.readFileSync('json/actions.json', 'utf8');
                    // Remove trailing commas
                    data = data.replace(/,(\s*[\]}])/g, '$1');
                    comments = JSON.parse(data);
                    return [4 /*yield*/, sql.connect(dbConfig_1.dbConfig)];
                case 1:
                    pool = _b.sent();
                    _i = 0, comments_1 = comments;
                    _b.label = 2;
                case 2:
                    if (!(_i < comments_1.length)) return [3 /*break*/, 14];
                    commentGroup = comments_1[_i];
                    _a = 0, commentGroup_1 = commentGroup;
                    _b.label = 3;
                case 3:
                    if (!(_a < commentGroup_1.length)) return [3 /*break*/, 13];
                    comment = commentGroup_1[_a];
                    _b.label = 4;
                case 4:
                    _b.trys.push([4, 11, , 12]);
                    // Check if data.text is present
                    if (!comment.data || !comment.data.text) {
                        console.log('Skipping comment with missing text:', comment.id);
                        return [3 /*break*/, 12]; // Move to the next comment
                    }
                    return [4 /*yield*/, pool.request()
                            .query("SELECT * FROM [dbo].[Comment] WHERE trelloIdAction = '".concat(comment.id, "'"))];
                case 5:
                    queryResult = _b.sent();
                    if (!(queryResult.recordset.length === 0)) return [3 /*break*/, 9];
                    issueQuery = "\n                            SELECT id\n                            FROM SUPRA_ALERTAS.[dbo].[Issue] \n                            WHERE trelloIdIssue = '".concat(comment.data.card.id, "'\n                        ");
                    return [4 /*yield*/, pool.request().query(issueQuery)];
                case 6:
                    issueResult = _b.sent();
                    // Check if an IssueId was found
                    if (issueResult.recordset.length === 0) {
                        console.error('No issue found for the comment:', comment.data.card.id);
                        return [3 /*break*/, 12]; // Skip inserting if IssueId not found
                    }
                    issueId = issueResult.recordset[0].id;
                    userQuery = "\n                            SELECT id\n                            FROM SUPRA_ALERTAS.[dbo].[User] \n                            WHERE trelloIdUser = '".concat(comment.idMemberCreator, "'\n                        ");
                    return [4 /*yield*/, pool.request().query(userQuery)];
                case 7:
                    userResult = _b.sent();
                    // Check if a UserId was found
                    if (userResult.recordset.length === 0) {
                        console.error('No user found for the comment creator:', comment.idMemberCreator);
                        return [3 /*break*/, 12]; // Skip inserting if UserId not found
                    }
                    userId = userResult.recordset[0].id;
                    text = comment.data.text.replace(/'/g, '"');
                    convertedDateTime = comment.date ? new Date(comment.date).toISOString() : new Date().toISOString();
                    insertQuery = "\n                            INSERT INTO [dbo].[Comment] (descr, createdAt, issueId, userId, trelloIdAction)\n                            VALUES ('".concat(text, "', '").concat(convertedDateTime, "', '").concat(issueId, "', ").concat(userId, ", '").concat(comment.id, "')\n                        ");
                    return [4 /*yield*/, pool.request().query(insertQuery)];
                case 8:
                    _b.sent();
                    console.log('Comment inserted successfully!');
                    return [3 /*break*/, 10];
                case 9:
                    console.log("Comment with ID ".concat(comment.id, " already exists. Skipping insertion."));
                    _b.label = 10;
                case 10: return [3 /*break*/, 12];
                case 11:
                    error_1 = _b.sent();
                    console.error('Error executing query:', error_1);
                    throw error_1; // Stop execution if an error occurs
                case 12:
                    _a++;
                    return [3 /*break*/, 3];
                case 13:
                    _i++;
                    return [3 /*break*/, 2];
                case 14: 
                // Close database connection
                return [4 /*yield*/, pool.close()];
                case 15:
                    // Close database connection
                    _b.sent();
                    console.log('Comments created successfully.');
                    return [3 /*break*/, 17];
                case 16:
                    error_2 = _b.sent();
                    console.error('Error:', error_2);
                    throw error_2; // Stop execution if an error occurs
                case 17: return [2 /*return*/];
            }
        });
    });
}
// Example usage: Create comments from JSON file
createCommentsFromJSON();
