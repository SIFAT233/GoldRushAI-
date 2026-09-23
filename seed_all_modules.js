const { sql, connectDB } = require('./db');
const branches = ['Main Branch', 'Chittagong Branch', 'Pabna Branch', 'Rajshahi'];

async function seedAll() {
    try {
        await connectDB();
        const pool = await sql.connect();

        console.log("Starting comprehensive seed (v5 - Unique TXN IDs)...");

        for (let i = 0; i < branches.length; i++) {
            const branch = branches[i];
            console.log(`Processing ${branch}...`);

            // 1. Ensure a Customer Exists
            const customerName = `Customer ${branch.split(' ')[0]}`;
            const uniquePhone = `0170000000${i}`;

            let customerId;
            try {
                // Check exist by branch first
                const custRes = await pool.request()
                    .input('b', sql.NVarChar, branch)
                    .query("SELECT TOP 1 id FROM customers WHERE branch = @b");

                if (custRes.recordset.length > 0) {
                    customerId = custRes.recordset[0].id;
                    // console.log(`  - Found existing customer: ${customerId}`);
                } else {
                    const byPhone = await pool.request().input('p', sql.NVarChar, uniquePhone).query("SELECT TOP 1 id FROM customers WHERE phone = @p");
                    if (byPhone.recordset.length > 0) {
                        customerId = byPhone.recordset[0].id;
                        // console.log(`  - Found customer by phone: ${customerId}`);
                    } else {
                        const insCust = await pool.request()
                            .input('n', sql.NVarChar, customerName)
                            .input('p', sql.NVarChar, uniquePhone)
                            .input('b', sql.NVarChar, branch)
                            .query("INSERT INTO customers (name, phone, address, branch) VALUES (@n, @p, 'Local Address', @b); SELECT SCOPE_IDENTITY() as id;");
                        customerId = insCust.recordset[0].id;
                        console.log(`  - Inserted new customer: ${customerId}`);
                    }
                }
            } catch (err) {
                console.error(`  - Customer Error for ${branch}: ${err.message}`);
            }

            // 2. Manufacturing Orders
            try {
                const manCheck = await pool.request().input('b', sql.NVarChar, branch).query("SELECT COUNT(*) as c FROM manufacturing_orders WHERE branch = @b");
                if (manCheck.recordset[0].c === 0) {
                    await pool.request().query(`
                        INSERT INTO manufacturing_orders (order_id, customer_name, product_name, karigar_name, status, gold_weight, due_date, branch, created_at)
                        VALUES 
                        ('MFG-${branch.substring(0, 3).toUpperCase()}-01', '${customerName}', 'Custom Bangle', 'Karigar Rahim', 'In Progress (Molding)', 15.5, DATEADD(day, 5, GETDATE()), '${branch}', GETDATE()),
                        ('MFG-${branch.substring(0, 3).toUpperCase()}-02', '${customerName}', 'Bridal Set', 'Karigar Karim', 'Polishing & QC', 45.0, DATEADD(day, 2, GETDATE()), '${branch}', GETDATE())
                    `);
                    console.log(`  - Seeded Manufacturing for ${branch}`);
                }
            } catch (err) { console.error(`  - Manufacturing Error: ${err.message}`); }

            // 3. Repair Tickets
            try {
                const repCheck = await pool.request().input('b', sql.NVarChar, branch).query("SELECT COUNT(*) as c FROM repair_tickets WHERE branch = @b");
                if (repCheck.recordset[0].c === 0) {
                    await pool.request().query(`
                        INSERT INTO repair_tickets (ticket_id, customer_name, customer_phone, item_name, issue_description, estimated_cost, branch, status, delivery_date)
                        VALUES 
                        ('REP-${branch.substring(0, 3).toUpperCase()}-01', '${customerName}', '${uniquePhone}', 'Old Chain', 'Polish & Soldering', 500, '${branch}', 'In Progress', DATEADD(day, 1, GETDATE()))
                    `);
                    console.log(`  - Seeded Repairs for ${branch}`);
                }
            } catch (err) { console.error(`  - Repair Error: ${err.message}`); }

            // 4. Installments
            if (customerId) {
                try {
                    const instCheck = await pool.request().input('b', sql.NVarChar, branch).query("SELECT COUNT(*) as c FROM installments WHERE branch = @b");
                    if (instCheck.recordset[0].c === 0) {
                        // Unique TXN ID
                        const txnId = `TXN-INST-${branch.substring(0, 3)}-${Math.floor(Math.random() * 90000) + 10000}`;

                        const saleRes = await pool.request().query(`
                            INSERT INTO sales (customer_id, total_amount, tax_amount, final_amount, payment_method, transaction_id, status, branch, sale_date)
                            VALUES (${customerId}, 50000, 0, 50000, 'Installment', '${txnId}', 'Pending', '${branch}', GETDATE());
                            SELECT SCOPE_IDENTITY() as id;
                        `);
                        const saleId = saleRes.recordset[0].id;

                        await pool.request().query(`
                            INSERT INTO installments (customer_id, sale_id, total_amount, paid_amount, due_date, status, item_description, branch, created_at)
                            VALUES 
                            (${customerId}, ${saleId}, 50000, 10000, DATEADD(month, 1, GETDATE()), 'Active', 'Gold Ring Payment Plan', '${branch}', GETDATE())
                        `);
                        console.log(`  - Seeded Installments for ${branch}`);
                    }
                } catch (err) { console.error(`  - Installment Error: ${err.message}`); }
            }
        }

        console.log("Comprehensive Seed Complete.");
        process.exit(0);

    } catch (err) {
        console.error("Seeding Error:", err);
        process.exit(1);
    }
}

seedAll();
