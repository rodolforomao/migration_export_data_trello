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
var fs = require("fs");
var sql = require("mssql");
var dbConfig_1 = require("./config/dbConfig");
function getListIdByDate(pool, date) {
    return __awaiter(this, void 0, void 0, function () {
        var monthYear, month, year, listName, query, result, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    monthYear = date.split('/');
                    month = parseInt(monthYear[1], 10);
                    year = parseInt(monthYear[2], 10);
                    listName = "".concat(getMonthName(month), " ").concat(year);
                    query = "\n            SELECT Id\n            FROM [List]\n            WHERE Name = '".concat(listName, "'\n        ");
                    return [4 /*yield*/, pool.request().query(query)];
                case 1:
                    result = _a.sent();
                    // If a list with the given name exists, return its ID, otherwise return null
                    return [2 /*return*/, result.recordset.length > 0 ? result.recordset[0].Id : null];
                case 2:
                    error_1 = _a.sent();
                    console.error('Error executing query:', error_1);
                    throw error_1;
                case 3: return [2 /*return*/];
            }
        });
    });
}
function getMonthName(month) {
    var monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    return monthNames[month - 1]; // Adjust index for zero-based array
}
function createIssuesFromJson() {
    return __awaiter(this, void 0, void 0, function () {
        var data, issues, pool, order, _i, issues_1, issue, listId, insertQuery, insertQuery, error_2, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 13, , 14]);
                    data = fs.readFileSync('json/a_licitar.json', 'utf8');
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
                    return [4 /*yield*/, getListIdByDate(pool, issue.DataProximaFase)];
                case 4:
                    listId = _a.sent();
                    if (!(listId !== null)) return [3 /*break*/, 6];
                    insertQuery = "\n                        INSERT INTO [dbo].[Issue] ([order], type, summary, descr, createdAt, updatedAt, listId, priority, reporterId, trelloIdIssue)\n                        VALUES (".concat(order, ", 1, '").concat(issue.BR, " | ").concat(issue.DataProximaFase, "', '").concat(issue.Objeto, "\n ").concat(issue.ProximaFase, "\n ").concat(issue.TipoContratacao, "', GETDATE(), GETDATE(), ").concat(listId, ", 1, 1, null)\n                    ");
                    return [4 /*yield*/, pool.request().query(insertQuery)];
                case 5:
                    _a.sent();
                    console.log('Issue inserted successfully!');
                    order++;
                    return [3 /*break*/, 8];
                case 6:
                    insertQuery = "\n                    INSERT INTO [dbo].[Issue] ([order], type, summary, descr, createdAt, updatedAt, listId, priority, reporterId, trelloIdIssue)\n                    VALUES (".concat(order, ", 1, '").concat(issue.BR, " | ").concat(issue.DataProximaFase, "', '").concat(issue.Objeto, "\n ").concat(issue.ProximaFase, "\n ").concat(issue.TipoContratacao, "', GETDATE(), GETDATE(), 678, 1, 1, null)\n                    ");
                    return [4 /*yield*/, pool.request().query(insertQuery)];
                case 7:
                    _a.sent();
                    console.log('Issue "Sem Data" inserted successfully!');
                    order++;
                    _a.label = 8;
                case 8: return [3 /*break*/, 10];
                case 9:
                    error_2 = _a.sent();
                    console.error('Error executing query:', error_2);
                    throw error_2;
                case 10:
                    _i++;
                    return [3 /*break*/, 2];
                case 11: return [4 /*yield*/, pool.close()];
                case 12:
                    _a.sent();
                    console.log('Issues created successfully.');
                    return [3 /*break*/, 14];
                case 13:
                    error_3 = _a.sent();
                    console.error('Error:', error_3);
                    throw error_3;
                case 14: return [2 /*return*/];
            }
        });
    });
}
createIssuesFromJson();
