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

async function fixAndSeed() {
    try {
        const pool = await sql.connect(config);
        console.log("Connected to database.");

        // 1. Add image_url to users if missing
        try {
            await pool.query(`
                IF COL_LENGTH('users', 'image_url') IS NULL
                ALTER TABLE users ADD image_url NVARCHAR(MAX) NULL;
            `);
            console.log("Verified/Added 'image_url' to users table.");
        } catch (err) {
            console.error("Error adding column:", err.message);
        }

        // 2. Create Dummy User if none exist
        let userId;
        const userRes = await pool.query("SELECT TOP 1 id FROM users");
        if (userRes.recordset.length === 0) {
            console.log("No users found. Creating a dummy user...");
            // Check users schema to know what columns are required
            // Assuming common fields: full_name, email, password, phone, role?
            // Let's try minimal insert based on typical schema or check what columns are not null?
            // Actually, let's look at index.js or create_missing_tables.js to see user schema.
            // users table usually has: full_name, email, password, phone.

            const insertUserQuery = `
                INSERT INTO users (full_name, email, password, phone)
                OUTPUT INSERTED.id
                VALUES ('Gold-Lagbe User', 'user@example.com', 'hashedpassword', '1234567890')
            `;
            // We might hit constraints if other columns are non-nullable. 
            // But let's try.
            try {
                const insertRes = await pool.query(insertUserQuery);
                userId = insertRes.recordset[0].id;
                console.log("Created dummy user with ID:", userId);
            } catch (insertErr) {
                console.error("Error creating user:", insertErr.message);
                // If that failed, we might need to know the schema.
                // let's try to query columns?
                // For now, let's assume it might fail if we don't know schema
                process.exit(1);
            }
        } else {
            userId = userRes.recordset[0].id;
            console.log("Found existing user ID:", userId);
        }

        // 3. Get Shop Owner
        const shopRes = await pool.query("SELECT TOP 1 shopowner_id FROM shopowners");
        if (shopRes.recordset.length === 0) {
            console.error("No shopowners found. Cannot seed chat.");
            process.exit(1);
        }
        const shopownerId = shopRes.recordset[0].shopowner_id;
        console.log("Using ShopOwner ID:", shopownerId);

        // 4. Create Conversation
        const convRes = await pool.request()
            .input('shopowner_id', sql.NVarChar, shopownerId)
            .input('user_id', sql.Int, userId)
            .query(`
                IF NOT EXISTS (SELECT * FROM GL_Conversations WHERE shopowner_id = @shopowner_id AND user_id = @user_id)
                BEGIN
                    INSERT INTO GL_Conversations (shopowner_id, user_id, last_message, last_updated)
                    OUTPUT INSERTED.id
                    VALUES (@shopowner_id, @user_id, 'Hello from Gold Rush! Is the necklace available?', GETDATE())
                END
                ELSE
                BEGIN
                    SELECT id FROM GL_Conversations WHERE shopowner_id = @shopowner_id AND user_id = @user_id
                END
            `);

        const conversationId = convRes.recordset[0].id;
        console.log("Conversation ID:", conversationId);

        // 5. Create Messages
        await pool.request()
            .input('conversation_id', sql.Int, conversationId)
            .query(`
                IF NOT EXISTS (SELECT * FROM GL_Messages WHERE conversation_id = @conversation_id)
                BEGIN
                    INSERT INTO GL_Messages (conversation_id, sender_type, message, is_read, timestamp)
                    VALUES 
                    (@conversation_id, 'user', 'Hi, is this item available?', 0, DATEADD(minute, -10, GETDATE())),
                    (@conversation_id, 'shopowner', 'Yes, it is!', 1, DATEADD(minute, -5, GETDATE())),
                    (@conversation_id, 'user', 'Great! Can I see more photos?', 0, GETDATE())
                END
            `);

        console.log("Chat data seeded/verified successfully.");
        process.exit(0);

    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
}

fixAndSeed();
