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

async function createTable() {
    try {
        const pool = await sql.connect(config);
        console.log("Connected to database.");

        const query = `
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='GL_ShopProfiles' AND xtype='U')
            CREATE TABLE GL_ShopProfiles (
                id INT IDENTITY(1,1) PRIMARY KEY,
                shopowner_id INT NOT NULL,
                shop_slug NVARCHAR(255) UNIQUE NOT NULL,
                logo_url NVARCHAR(MAX),
                banner_url NVARCHAR(MAX),
                rating DECIMAL(3, 2) DEFAULT 0.0,
                is_verified BIT DEFAULT 0,
                is_marketplace_live BIT DEFAULT 1,
                created_at DATETIME DEFAULT GETDATE(),
                FOREIGN KEY (shopowner_id) REFERENCES shopowners(id)
            );
        `;

        await pool.query(query);
        console.log("GL_ShopProfiles table created or already exists.");
        process.exit(0);

    } catch (err) {
        console.error("Error creating table:", err);
        process.exit(1);
    }
}

createTable();
