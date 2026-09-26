const { sql, connectDB } = require('./db');

connectDB().then(async () => {
    try {
        const pool = await sql.connect();

        // 1. Create Branches Table
        const createBranchesQuery = `
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='branches' AND xtype='U')
            CREATE TABLE branches (
                id INT IDENTITY(1,1) PRIMARY KEY,
                name NVARCHAR(255) NOT NULL,
                location NVARCHAR(255) NOT NULL,
                status NVARCHAR(50) DEFAULT 'Active',
                daily_sales DECIMAL(18, 2) DEFAULT 0,
                stock_value NVARCHAR(50) DEFAULT '0',
                branch_passcode NVARCHAR(6) DEFAULT '123456',
                is_main BIT DEFAULT 0,
                created_at DATETIME DEFAULT GETDATE()
            );
        `;
        await pool.request().query(createBranchesQuery);
        console.log("Branches table initialized");

        // 2. Create Stock Transfers Table
        const createTransfersQuery = `
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='stock_transfers' AND xtype='U')
            CREATE TABLE stock_transfers (
                id INT IDENTITY(1,1) PRIMARY KEY,
                transfer_id NVARCHAR(50) NOT NULL,
                from_branch NVARCHAR(255) NOT NULL,
                to_branch NVARCHAR(255) NOT NULL,
                items NVARCHAR(MAX) NOT NULL,
                transfer_date DATETIME DEFAULT GETDATE(),
                status NVARCHAR(50) DEFAULT 'Pending',
                created_at DATETIME DEFAULT GETDATE()
            );
        `;
        await pool.request().query(createTransfersQuery);
        console.log("Stock Transfers table initialized");

        // 3. Seed Branches (if empty)
        const checkBranches = await pool.request().query("SELECT COUNT(*) as count FROM branches");
        if (checkBranches.recordset[0].count === 0) {
            await pool.request().query(`
                INSERT INTO branches (name, location, status, daily_sales, stock_value, branch_passcode, is_main)
                VALUES 
                ('Main Branch', 'Dhaka, Bangladesh', 'Active', 125000.00, '3.2 Cr', '123456', 1),
                ('Chittagong Branch', 'Agrabad, Chittagong', 'Active', 85000.00, '1.5 Cr', '123456', 0)
            `);
            console.log("Seeded initial branches");
        } else {
            console.log("Branches already exist, skipping seed.");
        }

        // 4. Seed Transfers (if empty)
        const checkTransfers = await pool.request().query("SELECT COUNT(*) as count FROM stock_transfers");
        if (checkTransfers.recordset[0].count === 0) {
            await pool.request().query(`
                INSERT INTO stock_transfers (transfer_id, from_branch, to_branch, items, transfer_date, status)
                VALUES 
                ('TR-8821', 'Main Branch', 'Chittagong Branch', '250g Gold Bars', GETDATE(), 'In Transit'),
                ('TR-8815', 'Chittagong Branch', 'Main Branch', 'Defective Returns (5)', DATEADD(day, -1, GETDATE()), 'Received')
            `);
            console.log("Seeded initial transfers");
        } else {
            console.log("Transfers already exist, skipping seed.");
        }

    } catch (err) {
        console.error("Setup failed:", err);
    } finally {
        process.exit();
    }
});
