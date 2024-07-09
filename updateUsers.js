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
function createMembersFromJSON() {
    return __awaiter(this, void 0, void 0, function () {
        var data, members, pool, _i, members_1, member, request, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 7, , 8]);
                    data = fs.readFileSync('json/members.json', 'utf8');
                    members = JSON.parse(data);
                    return [4 /*yield*/, sql.connect({
                            user: 'henrysampaio',
                            password: '230367',
                            server: 'G4F-PE0B2PTB\\SQLEXPRESS',
                            database: 'SIMA',
                            options: {
                                encrypt: true, // Encrypt data (SSL/TLS)
                                trustServerCertificate: true // Trust the server certificate (use with caution)
                            }
                        })];
                case 1:
                    pool = _a.sent();
                    _i = 0, members_1 = members;
                    _a.label = 2;
                case 2:
                    if (!(_i < members_1.length)) return [3 /*break*/, 5];
                    member = members_1[_i];
                    request = pool.request();
                    return [4 /*yield*/, request.query("\n            INSERT INTO [dbo].[User] (email, username, pwd, createdAt, updatedAt, trelloIdUser)\n            VALUES ('".concat(member.username, "@example.com', '").concat(member.username, "', 'e10adc3949ba59abbe56e057f20f883e', GETDATE(), GETDATE(), '").concat(member.id, "')\n            "))];
                case 3:
                    _a.sent();
                    _a.label = 4;
                case 4:
                    _i++;
                    return [3 /*break*/, 2];
                case 5: 
                // Close database connection
                return [4 /*yield*/, pool.close()];
                case 6:
                    // Close database connection
                    _a.sent();
                    console.log('Members created successfully.');
                    return [3 /*break*/, 8];
                case 7:
                    error_1 = _a.sent();
                    console.error('Error:', error_1);
                    return [3 /*break*/, 8];
                case 8: return [2 /*return*/];
            }
        });
    });
}
// Example usage: Create members from JSON file
createMembersFromJSON();
