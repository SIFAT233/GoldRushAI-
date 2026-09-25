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

async function seedChatData() {
    try {
        const pool = await sql.connect(config);
        console.log("Connected to database. Seeding chat data...");

        // 1. Get a shopowner and a user
        const shopRes = await pool.query("SELECT TOP 1 shopowner_id FROM shopowners");
        const userRes = await pool.query("SELECT TOP 1 id FROM users");

        if (shopRes.recordset.length === 0 || userRes.recordset.length === 0) {
            console.error("No shopowner or user found to seed chat.");
            process.exit(1);
        }

        const shopownerId = shopRes.recordset[0].shopowner_id;
        const userId = userRes.recordset[0].id;

        console.log(`Seeding chat for ShopOwner: ${shopownerId}, User: ${userId}`);

        // 2. Create Conversation
        const convRes = await pool.request()
            .input('shopowner_id', sql.NVarChar, shopownerId)
            .input('user_id', sql.Int, userId)
            .query(`
                IF NOT EXISTS (SELECT * FROM GL_Conversations WHERE shopowner_id = @shopowner_id AND user_id = @user_id)
                BEGIN
                    INSERT INTO GL_Conversations (shopowner_id, user_id, last_message, last_updated)
                    OUTPUT INSERTED.id
                    VALUES (@shopowner_id, @user_id, 'Hello from Gold Rush!', GETDATE())
                END
                ELSE
                BEGIN
                    SELECT id FROM GL_Conversations WHERE shopowner_id = @shopowner_id AND user_id = @user_id
                END
            `);

        const conversationId = convRes.recordset[0].id;
        console.log(`Conversation ID: ${conversationId}`);

        // 3. Create Messages
        await pool.request()
            .input('conversation_id', sql.Int, conversationId)
            .query(`
                INSERT INTO GL_Messages (conversation_id, sender_type, message, is_read, timestamp)
                VALUES 
                (@conversation_id, 'user', 'Hi, is this item available?', 0, DATEADD(minute, -10, GETDATE())),
                (@conversation_id, 'shopowner', 'Yes, it is!', 1, DATEADD(minute, -5, GETDATE()))
            `);

        console.log("Chat data seeded successfully.");
        process.exit(0);

    } catch (err) {
        console.error("Error seeding chat data:", err);
        process.exit(1);
    }
}

seedChatData();
