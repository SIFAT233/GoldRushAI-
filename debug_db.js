require('dotenv').config();
const sql = require('mssql');

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    database: process.env.DB_NAME,
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

async function debugDB() {
    try {
        const pool = await sql.connect(config);
        console.log("Connected to database.");

        // List tables
        const tablesRes = await pool.query("SELECT name FROM sysobjects WHERE xtype='U'");
        const tables = tablesRes.recordset.map(r => r.name);
        console.log("Tables:", tables);

        // Check users count
        if (tables.includes('users')) {
            const countRes = await pool.query("SELECT COUNT(*) as count FROM users");
            console.log("Rows in 'users':", countRes.recordset[0].count);
        } else {
            console.log("'users' table does not exist.");
        }

        // Check GL_Users count
        if (tables.includes('GL_Users')) {
            const countRes = await pool.query("SELECT COUNT(*) as count FROM GL_Users");
            console.log("Rows in 'GL_Users':", countRes.recordset[0].count);
        } else {
            console.log("'GL_Users' table does not exist.");
        }

        // Check shopowners count
        if (tables.includes('shopowners')) {
            const countRes = await pool.query("SELECT COUNT(*) as count FROM shopowners");
            console.log("Rows in 'shopowners':", countRes.recordset[0].count);
        }

        process.exit(0);
    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
}

debugDB();
