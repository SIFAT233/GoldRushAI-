const { sql, connectDB } = require('./db');

async function seedBranches() {
    try {
        await connectDB();
        const pool = await sql.connect();

        console.log("Seeding data for remaining branches...");

        // --- Pabna Branch ---
        try {
            const checkPabna = await pool.request().query("SELECT COUNT(*) as count FROM products WHERE branch = 'Pabna Branch'");
            if (checkPabna.recordset[0].count === 0) {
                console.log("Seeding Pabna Branch...");

                // Products
                const productQuery = `
                    INSERT INTO products (name, category, karat, weight, price, stock_quantity, image_url, branch, status, product_code)
                    VALUES 
                    ('Pabna Traditional Locket', 'Necklace', '22K', 8.5, 85000, 7, 'https://placehold.co/400', 'Pabna Branch', 'In Stock', 'P-PAB-001'),
                    ('Bera Gold Bangles', 'Bangle', '21K', 12.0, 110000, 4, 'https://placehold.co/400', 'Pabna Branch', 'In Stock', 'P-PAB-002'),
                    ('Ishwardi Earring Set', 'Earring', '18K', 4.2, 42000, 10, 'https://placehold.co/400', 'Pabna Branch', 'In Stock', 'P-PAB-003');
                `;
                await pool.request().query(productQuery);

                // Sales
                await pool.request().query(`
                    INSERT INTO sales (total_amount, tax_amount, final_amount, payment_method, transaction_id, status, branch, sale_date)
                    VALUES 
                    (42000, 2100, 44100, 'Cash', 'TXN-PAB-101', 'Completed', 'Pabna Branch', DATEADD(day, -1, GETDATE())),
                    (85000, 4250, 89250, 'Cash', 'TXN-PAB-102', 'Completed', 'Pabna Branch', GETDATE());
                `);

                // Repairs
                await pool.request().query(`
                    INSERT INTO repair_tickets (ticket_id, customer_name, customer_phone, item_name, issue_description, estimated_cost, branch, status, delivery_date)
                    VALUES 
                    ('REP-PAB-001', 'Rafiqul Islam', '01712345678', 'Gold Chain', 'Lock broken', 800, 'Pabna Branch', 'Pending', DATEADD(day, 3, GETDATE()));
                `);
                console.log("Pabna Branch seeded.");
            } else {
                console.log("Pabna Branch already has data.");
            }
        } catch (e) {
            console.error("Error seeding Pabna:", e.message);
        }

        // --- Rajshahi ---
        try {
            const checkRajshahi = await pool.request().query("SELECT COUNT(*) as count FROM products WHERE branch = 'Rajshahi'");
            if (checkRajshahi.recordset[0].count === 0) {
                console.log("Seeding Rajshahi...");

                // Products
                const rajQuery = `
                    INSERT INTO products (name, category, karat, weight, price, stock_quantity, image_url, branch, status, product_code)
                    VALUES 
                    ('Rajshahi Silk Bangle', 'Bangle', '22K', 15.0, 145000, 3, 'https://placehold.co/400', 'Rajshahi', 'In Stock', 'P-RAJ-001'),
                    ('Mango Motif Pendant', 'Pendant', '21K', 6.5, 60000, 12, 'https://placehold.co/400', 'Rajshahi', 'In Stock', 'P-RAJ-002'),
                    ('Padma River Collection Ring', 'Ring', '22K', 5.5, 55000, 8, 'https://placehold.co/400', 'Rajshahi', 'In Stock', 'P-RAJ-003');
                `;
                await pool.request().query(rajQuery);

                // Sales
                await pool.request().query(`
                    INSERT INTO sales (total_amount, tax_amount, final_amount, payment_method, transaction_id, status, branch, sale_date)
                    VALUES 
                    (60000, 3000, 63000, 'Online', 'TXN-RAJ-301', 'Completed', 'Rajshahi', DATEADD(day, -2, GETDATE()));
                `);

                // Repairs
                await pool.request().query(`
                    INSERT INTO repair_tickets (ticket_id, customer_name, customer_phone, item_name, issue_description, estimated_cost, branch, status, delivery_date)
                    VALUES 
                    ('REP-RAJ-001', 'Mst. Jamila', '01912345678', 'Nose Pin', 'Stone missing', 1200, 'Rajshahi', 'In Progress', DATEADD(day, 2, GETDATE()));
                `);

                console.log("Rajshahi seeded.");
            } else {
                console.log("Rajshahi already has data.");
            }
        } catch (e) {
            console.error("Error seeding Rajshahi:", e.message);
        }

        process.exit(0);
    } catch (err) {
        console.error("Seeding Failed:", err);
        process.exit(1);
    }
}

seedBranches();
