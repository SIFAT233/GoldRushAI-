const { sql, connectDB } = require('./db');

async function setupRepairsTable() {
    try {
        await connectDB();
        const pool = await sql.connect();

        const createTableQuery = `
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='repair_tickets' AND xtype='U')
            CREATE TABLE repair_tickets (
                id INT IDENTITY(1,1) PRIMARY KEY,
                ticket_id NVARCHAR(50) NOT NULL,
                customer_name NVARCHAR(255) NOT NULL,
                customer_phone NVARCHAR(50) NULL,
                item_name NVARCHAR(255) NOT NULL,
                issue_description NVARCHAR(MAX) NOT NULL,
                received_date DATETIME DEFAULT GETDATE(),
                delivery_date DATETIME NULL,
                status NVARCHAR(50) DEFAULT 'Active',
                estimated_cost DECIMAL(18, 2) DEFAULT 0,
                created_at DATETIME DEFAULT GETDATE()
            );
        `;

        await pool.request().query(createTableQuery);
        console.log("Repair Tickets table initialized successfully.");
    } catch (err) {
        console.error("Error initializing Repair Tickets table:", err);
    } finally {
        await sql.close();
    }
}

setupRepairsTable();
