const path = require('path');
const sql = require('mssql');

require('dotenv').config({
    path: process.env.DOTENV_CONFIG_PATH || path.join(__dirname, '.env')
});

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    database: process.env.DB_NAME,
    options: {
        encrypt: false, // Set to true if using Azure
        trustServerCertificate: true, // Change to true for local dev / self-signed certs
        enableArithAbort: true
    }
};

const connectDB = async () => {
    try {
        await sql.connect(config);
        console.log(`Connected to SQL Server at ${process.env.DB_HOST}`);
    } catch (err) {
        console.error('Database Connection Failed:', err);
        // Do not exit process, let it retry or fail gracefully on requests
    }
};

module.exports = {
    sql,
    connectDB
};
