const https = require('https');
const http = require('http');

const targetUrl = process.env.API_HEALTH_URL || process.argv[2];

if (!targetUrl) {
    console.error('Usage: node fetch_error.js <url> (or set API_HEALTH_URL)');
    process.exit(1);
}

const client = targetUrl.startsWith('https://') ? https : http;

client.get(targetUrl, (res) => {
    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });
    res.on('end', () => {
        console.log('Response Status:', res.statusCode);
        try {
            const json = JSON.parse(data);
            console.log('Response Body:', JSON.stringify(json, null, 2));
        } catch (e) {
            console.log('Response Body:', data);
        }
    });
}).on('error', (err) => {
    console.error("Error:", err.message);
});
