const { sql, connectDB } = require('./db');

const seedData = async () => {
    try {
        console.log("Connecting to database...");
        await connectDB();
        const pool = await sql.connect();

        console.log("Seeding Customers...");
        const customers = [
            { name: 'Mrs. Fatema Begum', phone: '01711111111', type: 'Regular' },
            { name: 'Mr. Rahim Uddin', phone: '01722222222', type: 'VIP' },
            { name: 'Ms. Sadia Islam', phone: '01733333333', type: 'New' },
            { name: 'Dr. Hasan Mahmud', phone: '01744444444', type: 'Regular' }
        ];

        for (const c of customers) {
            // Check if customer exists
            const check = await pool.request()
                .input('phone', sql.NVarChar, c.phone)
                .query('SELECT id FROM customers WHERE phone = @phone');

            if (check.recordset.length === 0) {
                await pool.request()
                    .input('name', sql.NVarChar, c.name)
                    .input('phone', sql.NVarChar, c.phone)
                    .input('type', sql.NVarChar, c.type)
                    .query('INSERT INTO customers (name, phone, type) VALUES (@name, @phone, @type)');
                console.log(`Added customer: ${c.name}`);
            } else {
                console.log(`Customer exists: ${c.name}`);
            }
        }

        console.log("Seeding Installments...");
        // Fetch IDs
        const getCustId = async (phone) => {
            const res = await pool.request().input('phone', sql.NVarChar, phone).query('SELECT id FROM customers WHERE phone = @phone');
            return res.recordset[0]?.id;
        };

        const plans = [
            { phone: '01711111111', item: '22K Gold Necklace', total: 125000, paid: 75000, due: '2025-12-10', status: 'Active' },
            { phone: '01722222222', item: 'Diamond Ring', total: 85000, paid: 85000, due: '2025-01-01', status: 'Completed' },
            { phone: '01733333333', item: 'Gold Bangle Set', total: 160000, paid: 40000, due: '2025-12-05', status: 'Overdue' },
            { phone: '01744444444', item: 'Platinum Band', total: 60000, paid: 30000, due: '2025-12-15', status: 'Active' }
        ];

        for (const p of plans) {
            const custId = await getCustId(p.phone);
            if (custId) {
                await pool.request()
                    .input('customer_id', sql.Int, custId)
                    .input('item_description', sql.NVarChar, p.item)
                    .input('total_amount', sql.Decimal(18, 2), p.total)
                    .input('paid_amount', sql.Decimal(18, 2), p.paid)
                    .input('due_date', sql.Date, p.due)
                    .input('status', sql.NVarChar, p.status)
                    .query(`
                        INSERT INTO installments (customer_id, item_description, total_amount, paid_amount, due_date, status)
                        VALUES (@customer_id, @item_description, @total_amount, @paid_amount, @due_date, @status)
                    `);
                console.log(`Added plan for: ${p.item}`);
            }
        }

        console.log("Seeding completed!");
        process.exit(0);

    } catch (err) {
        console.error("Seeding failed:", err);
        process.exit(1);
    }
};

seedData();
