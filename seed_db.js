const { sql, connectDB } = require('./db');

const seedDatabase = async () => {
    try {
        console.log("Connecting to database...");
        await connectDB();
        const pool = await sql.connect();

        console.log("Seeding data...");

        // 1. Seed Suppliers
        console.log("Seeding Suppliers...");
        const supplierQuery = `
            INSERT INTO suppliers (name, phone, contact_person, address)
            VALUES 
            (N'Tanishq Gold Suppliers', '01700000001', N'Ramesh Babu', N'Gulshan 1, Dhaka'),
            (N'Diamond World Wholesale', '01700000002', N'Selim Chowdhury', N'Baitul Mukarram, Dhaka');
        `;
        await pool.request().query(supplierQuery);

        // Get IDs (assuming simplistic sequential insertion for this demo, or just relying on identity)
        // For robusness in a real seed script we might fetch them, but for quick demo data INSERT is fine.

        // 2. Seed Products (Matching Inventory.jsx)
        console.log("Seeding Products...");
        const productQuery = `
            INSERT INTO products (product_code, name, category, karat, weight, price, stock_quantity, status, image_url)
            VALUES 
            ('P-1001', N'22K Gold Bridal Necklace', 'Necklace', '22K', 45.5, 511875, 3, 'In Stock', ''),
            ('P-1002', N'Diamond Engagement Ring', 'Ring', '18K', 4.2, 85000, 12, 'In Stock', ''),
            ('P-1003', N'Gold Bangle (Traditional)', 'Bangle', '21K', 15.0, 165000, 1, 'Low Stock', ''),
            ('P-1004', N'Mens Gold Chain', 'Chain', '22K', 12.5, 140625, 0, 'Out of Stock', ''),
            ('P-1005', N'Baby Anklet Pair', 'Anklet', '21K', 6.0, 66000, 8, 'In Stock', ''),
            ('P-1006', N'Ruby Studded Earring', 'Earring', '18K', 5.5, 45000, 5, 'In Stock', '');
        `;
        await pool.request().query(productQuery);

        // 3. Seed Customers (Matching CRM.jsx)
        console.log("Seeding Customers...");
        const customerQuery = `
            INSERT INTO customers (name, phone, type, total_spent, visits_count, last_visit)
            VALUES 
            (N'Mrs. Fatema Begum', '01712345678', 'VIP', 520000, 12, DATEADD(day, -2, GETDATE())),
            (N'Mr. Rahim Uddin', '01812345678', 'Regular', 150000, 5, DATEADD(day, -7, GETDATE())),
            (N'Ms. Sadia Islam', '01912345678', 'New', 45000, 1, GETDATE());
        `;
        await pool.request().query(customerQuery);

        console.log("Database seeded successfully!");
        process.exit(0);

    } catch (err) {
        // Handle duplicate key errors gracefully if run multiple times
        if (err.number === 2627 || err.number === 2601) {
            console.log("Data likely already exists (Duplicate Key Error). Skipping...");
            process.exit(0);
        }
        console.error("Error seeding database:", err);
        process.exit(1);
    }
};

seedDatabase();
