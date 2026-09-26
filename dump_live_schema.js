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

async function dumpSchema() {
    try {
        await sql.connect(config);
        const result = await sql.query(`
            SELECT 
                t.name AS TableName,
                c.name AS ColumnName,
                ty.name AS DataType,
                c.max_length,
                c.is_nullable
            FROM 
                sys.tables t
            INNER JOIN 
                sys.columns c ON t.object_id = c.object_id
            INNER JOIN 
                sys.types ty ON c.user_type_id = ty.user_type_id
            ORDER BY 
                t.name, c.column_id
        `);

        // Group by table
        const tables = {};
        result.recordset.forEach(row => {
            if (!tables[row.TableName]) {
                tables[row.TableName] = [];
            }
            tables[row.TableName].push({
                name: row.ColumnName,
                type: row.DataType,
                nullable: row.is_nullable
            });
        });

        if (tables['shopowners']) {
            console.log("Columns in shopowners:", JSON.stringify(tables['shopowners'], null, 2));
        }
        // process.exit(0);
    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
}

dumpSchema();
