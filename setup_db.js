const { sql, connectDB } = require('./db');

const setupDatabase = async () => {
    try {
        console.log("Connecting to database...");
        await connectDB();
        const pool = await sql.connect();

        console.log("Creating tables...");

        // 1. Users Table (Already exists, but ensuring schema)
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='users' AND xtype='U')
            CREATE TABLE users (
                id INT IDENTITY(1,1) PRIMARY KEY,
                full_name NVARCHAR(255) NOT NULL,
                phone NVARCHAR(50),
                identifier NVARCHAR(255) UNIQUE NOT NULL,
                password NVARCHAR(255) NOT NULL,
                latitude FLOAT NULL,
                longitude FLOAT NULL,
                created_at DATETIME DEFAULT GETDATE()
            );
        `);
        await pool.request().query(`
            IF COL_LENGTH('users', 'latitude') IS NULL
                ALTER TABLE users ADD latitude FLOAT NULL;
            IF COL_LENGTH('users', 'longitude') IS NULL
                ALTER TABLE users ADD longitude FLOAT NULL;
        `);
        console.log("- Users table checked/created.");

        // 2. Suppliers Table
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='suppliers' AND xtype='U')
            CREATE TABLE suppliers (
                id INT IDENTITY(1,1) PRIMARY KEY,
                name NVARCHAR(255) NOT NULL,
                phone NVARCHAR(50),
                contact_person NVARCHAR(255),
                address NVARCHAR(MAX),
                created_at DATETIME DEFAULT GETDATE()
            );
        `);
        console.log("- Suppliers table checked/created.");

        // 3. Products (Inventory) Table
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='products' AND xtype='U')
            CREATE TABLE products (
                id INT IDENTITY(1,1) PRIMARY KEY,
                product_code NVARCHAR(50) UNIQUE,
                name NVARCHAR(255) NOT NULL,
                category NVARCHAR(100),
                karat NVARCHAR(50),
                weight DECIMAL(10, 2), -- in grams
                price DECIMAL(18, 2),
                stock_quantity INT DEFAULT 0,
                supplier_id INT FOREIGN KEY REFERENCES suppliers(id),
                image_url NVARCHAR(MAX),
                status NVARCHAR(50) DEFAULT 'In Stock',
                created_at DATETIME DEFAULT GETDATE()
            );
        `);
        console.log("- Products table checked/created.");

        // 4. Customers Table
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='customers' AND xtype='U')
            CREATE TABLE customers (
                id INT IDENTITY(1,1) PRIMARY KEY,
                name NVARCHAR(255) NOT NULL,
                phone NVARCHAR(20) UNIQUE,
                email NVARCHAR(255),
                address NVARCHAR(MAX),
                type NVARCHAR(50) DEFAULT 'New', -- VIP, Regular, New
                total_spent DECIMAL(18, 2) DEFAULT 0,
                visits_count INT DEFAULT 0,
                last_visit DATETIME,
                created_at DATETIME DEFAULT GETDATE()
            );
        `);
        console.log("- Customers table checked/created.");

        // 5. Sales Table
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='sales' AND xtype='U')
            CREATE TABLE sales (
                id INT IDENTITY(1,1) PRIMARY KEY,
                customer_id INT FOREIGN KEY REFERENCES customers(id),
                total_amount DECIMAL(18, 2) NOT NULL,
                tax_amount DECIMAL(18, 2) DEFAULT 0,
                discount_amount DECIMAL(18, 2) DEFAULT 0,
                final_amount DECIMAL(18, 2) NOT NULL,
                payment_method NVARCHAR(50), -- Cash, Card, Bkash
                sale_date DATETIME DEFAULT GETDATE(),
                created_by INT FOREIGN KEY REFERENCES users(id),
                transaction_id NVARCHAR(100) UNIQUE,
                status NVARCHAR(50) DEFAULT 'Completed' -- Pending, Completed, Failed
            );
        `);
        await pool.request().query(`
            IF COL_LENGTH('sales', 'transaction_id') IS NULL
                ALTER TABLE sales ADD transaction_id NVARCHAR(100) UNIQUE;
            IF COL_LENGTH('sales', 'status') IS NULL
                ALTER TABLE sales ADD status NVARCHAR(50) DEFAULT 'Completed';
        `);
        console.log("- Sales table checked/created.");

        // 6. Sale Items Table
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='sale_items' AND xtype='U')
            CREATE TABLE sale_items (
                id INT IDENTITY(1,1) PRIMARY KEY,
                sale_id INT FOREIGN KEY REFERENCES sales(id),
                product_id INT FOREIGN KEY REFERENCES products(id),
                quantity INT NOT NULL,
                price_at_sale DECIMAL(18, 2) NOT NULL,
                weight_at_sale DECIMAL(10, 2),
                total_price DECIMAL(18, 2) NOT NULL
            );
        `);
        console.log("- Sale Items table checked/created.");

        // 7. Installments Table
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='installments' AND xtype='U')
            CREATE TABLE installments (
                id INT IDENTITY(1,1) PRIMARY KEY,
                customer_id INT FOREIGN KEY REFERENCES customers(id),
                sale_id INT FOREIGN KEY REFERENCES sales(id),
                item_description NVARCHAR(255), -- Added for tracking specific item
                total_amount DECIMAL(18, 2) NOT NULL,
                paid_amount DECIMAL(18, 2) DEFAULT 0,
                due_amount AS (total_amount - paid_amount),
                due_date DATE,
                status NVARCHAR(50) DEFAULT 'Active', -- Active, Completed, Overdue
                created_at DATETIME DEFAULT GETDATE()
            );
        `);
        await pool.request().query(`
            IF COL_LENGTH('installments', 'item_description') IS NULL
                ALTER TABLE installments ADD item_description NVARCHAR(255);
        `);
        console.log("- Installments table checked/created.");

        // 7.5 Installment Payments Table (New)
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='installment_payments' AND xtype='U')
            CREATE TABLE installment_payments (
                id INT IDENTITY(1,1) PRIMARY KEY,
                installment_id INT FOREIGN KEY REFERENCES installments(id),
                amount DECIMAL(18, 2) NOT NULL,
                payment_date DATETIME DEFAULT GETDATE(),
                payment_method NVARCHAR(50),
                notes NVARCHAR(MAX)
            );
        `);
        console.log("- Installment Payments table checked/created.");

        // 8. Repair Orders Table
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='repair_orders' AND xtype='U')
            CREATE TABLE repair_orders (
                id INT IDENTITY(1,1) PRIMARY KEY,
                customer_id INT FOREIGN KEY REFERENCES customers(id),
                item_description NVARCHAR(MAX),
                issue_description NVARCHAR(MAX),
                estimated_cost DECIMAL(18, 2),
                advance_payment DECIMAL(18, 2) DEFAULT 0,
                status NVARCHAR(50) DEFAULT 'Received', -- Received, In Progress, Ready, Delivered
                received_date DATETIME DEFAULT GETDATE(),
                delivery_date DATETIME
            );
        `);
        console.log("- Repair Orders table checked/created.");

        console.log("Database setup completed successfully!");
        process.exit(0);

    } catch (err) {
        console.error("Error setting up database:", err);
        process.exit(1);
    }
};

setupDatabase();
