"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dbConfig = void 0;
exports.dbConfig = {
    user: 'sharepoint_acc_hom',
    password: 'spacchom',
    server: '10.100.10.65\\MSSQL',
    database: 'SUPRA_ALERTAS',
    options: {
        encrypt: true, // Encrypt data (SSL/TLS)
        trustServerCertificate: true // Trust the server certificate (use with caution)
    }
    // user: 'henrysampaio',
    //         password: '230367',
    //         server: 'G4F-PE0B2PTB\\SQLEXPRESS',
    //         database: 'SIMA',
    //         options: {
    //             encrypt: true,  // Encrypt data (SSL/TLS)
    //             trustServerCertificate: true  // Trust the server certificate (use with caution)
    //         }
};
