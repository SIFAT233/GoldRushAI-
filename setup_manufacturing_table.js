const sql = require('mssql');
require('dotenv').config();

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    database: process.env.DB_NAME,
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true
    }
};

const setupTable = async () => {
    try {
        const pool = await sql.connect(config);
        console.log("Connected to DB. Creating table...");

        const createManufacturingTableQuery = `
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='manufacturing_orders' AND xtype='U')
            CREATE TABLE manufacturing_orders (
                id INT IDENTITY(1,1) PRIMARY KEY,
                order_id NVARCHAR(50) NOT NULL,
                customer_name NVARCHAR(255) NOT NULL,
                product_name NVARCHAR(255) NOT NULL,
                karigar_name NVARCHAR(255) NULL,
                status NVARCHAR(50) NOT NULL,
                gold_weight FLOAT NULL,
                due_date DATETIME NULL,
                created_at DATETIME DEFAULT GETDATE()
            );
        `;
        await pool.request().query(createManufacturingTableQuery);
        console.log("Table 'manufacturing_orders' created or already exists.");

        process.exit(0);
    } catch (err) {
        console.error("Setup Failed!");
        console.error(err);
        process.exit(1);
    }
};

setupTable();
