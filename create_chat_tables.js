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

async function createChatTables() {
    try {
        const pool = await sql.connect(config);
        console.log("Connected to database. Creating chat tables...");

        // 1. GL_Conversations
        await pool.query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='GL_Conversations' AND xtype='U')
            CREATE TABLE GL_Conversations (
                id INT IDENTITY(1,1) PRIMARY KEY,
                shopowner_id NVARCHAR(50),
                user_id INT,
                last_message NVARCHAR(MAX),
                last_updated DATETIME DEFAULT GETDATE(),
                status NVARCHAR(50) DEFAULT 'Active'
            );
        `);
        console.log("Checked/Created table: GL_Conversations");

        // 2. GL_Messages
        await pool.query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='GL_Messages' AND xtype='U')
            CREATE TABLE GL_Messages (
                id INT IDENTITY(1,1) PRIMARY KEY,
                conversation_id INT FOREIGN KEY REFERENCES GL_Conversations(id),
                sender_type NVARCHAR(50), -- 'shopowner' or 'user'
                message NVARCHAR(MAX),
                is_read BIT DEFAULT 0,
                timestamp DATETIME DEFAULT GETDATE()
            );
        `);
        console.log("Checked/Created table: GL_Messages");

        console.log("Chat tables created successfully.");
        process.exit(0);
    } catch (err) {
        console.error("Error creating chat tables:", err);
        process.exit(1);
    }
}

createChatTables();
