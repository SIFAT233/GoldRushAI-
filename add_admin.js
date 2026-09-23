const { sql, connectDB } = require('./db');

const addAdmin = async () => {
    try {
        console.log("Connecting to database...");
        await connectDB();
        const pool = await sql.connect();

        console.log("Adding Admin User...");

        const query = `
            IF NOT EXISTS (SELECT * FROM users WHERE identifier = 'admin')
            BEGIN
                INSERT INTO users (full_name, phone, identifier, password)
                VALUES (N'System Admin', '0000000000', 'admin', 'admin');
                SELECT 'Admin user created' as message;
            END
            ELSE
            BEGIN
                SELECT 'Admin user already exists' as message;
            END
        `;

        const result = await pool.request().query(query);
        console.log(result.recordset[0].message);

        process.exit(0);

    } catch (err) {
        console.error("Error adding admin:", err);
        process.exit(1);
    }
};

addAdmin();
