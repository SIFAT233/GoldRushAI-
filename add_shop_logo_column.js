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

async function addShopLogoColumn() {
    try {
        console.log("Connecting to database...");
        await sql.connect(config);

        console.log("Checking if shop_logo_url column exists...");
        const result = await sql.query(`
            IF NOT EXISTS (
                SELECT * FROM sys.columns 
                WHERE object_id = OBJECT_ID('shopowners') 
                AND name = 'shop_logo_url'
            )
            BEGIN
                ALTER TABLE shopowners ADD shop_logo_url NVARCHAR(MAX) NULL;
                SELECT 'Column Added' as status;
            END
            ELSE
            BEGIN
                SELECT 'Column Already Exists' as status;
            END
        `);

        console.log("Result:", result.recordset[0]);
        console.log("Schema update complete.");
        process.exit(0);
    } catch (err) {
        console.error("Error updating schema:", err);
        process.exit(1);
    }
}

addShopLogoColumn();
