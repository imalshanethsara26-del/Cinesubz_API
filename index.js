const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Referer': 'https://cinesubz.net/',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
};

// Root Endpoint
app.get('/', (req, res) => {
    res.json({
        status: true,
        message: "IMALSHA CHAMINDU TRACE API (60s Timeout) Live 🚀",
        endpoints: {
            traceChamindu: "/api/v1/cinesubz/trace-chamindu?url=zt_link_url"
        }
    });
});

// 🕵️‍♂️ Chamindu's API Tracer & Live Flow Logger Endpoint (60s Timeout Enabled)
app.get('/api/v1/cinesubz/trace-chamindu', async (req, res) => {
    const targetZtUrl = req.query.url || "https://cinesubz.net/zt-links/nvm2e3d9ep/";
    const chaminduApiUrl = `https://api.chamindu.site/api/v1/movies/cinesubz/resolve?url=${encodeURIComponent(targetZtUrl)}&api_key=chama_api_5dc8403e460b74f6f8eda19f55746e08`;

    console.log(`\n==================================================`);
    console.log(`🕵️‍♂️ [LIVE TRACE START] Intercepting Chamindu's API...`);
    console.log(`🎯 Target ZT-Link: ${targetZtUrl}`);
    console.log(`🔗 External API Endpoint: ${chaminduApiUrl}`);
    console.log(`⏱️ Timeout configured to: 60,000ms (60 Seconds)`);

    try {
        console.log(`1️⃣ Sending HTTP GET request to external resolver with 60s timeout...`);
        const startTime = Date.now();

        const apiResponse = await axios.get(chaminduApiUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json'
            },
            timeout: 60000 // 60 Seconds Timeout
        });

        const duration = Date.now() - startTime;
        console.log(`📥 [API RESPONSE RECEIVED SUCCESSFULLY] Time taken: ${duration}ms | Status: ${apiResponse.status}`);
        console.log(`📦 Response Headers:`, JSON.stringify(apiResponse.headers, null, 2));
        console.log(`📄 Response Body / Payload:`, JSON.stringify(apiResponse.data, null, 2));
        console.log(`==================================================\n`);

        res.json({
            status: true,
            message: "Successfully traced Chamindu's API and logged all details to terminal!",
            duration_ms: duration,
            traced_data: apiResponse.data
        });

    } catch (error) {
        console.error(`❌ [TRACE ERROR / TIMEOUT]: ${error.message}`);
        if (error.response) {
            console.error(`🔴 Error Status: ${error.response.status}`);
            console.error(`🔴 Error Data:`, error.response.data);
        } else {
            console.error(`🔴 Request failed before receiving response (Timeout or Network issue).`);
        }
        console.log(`==================================================\n`);

        res.status(500).json({
            status: false,
            error: error.message,
            details: error.response?.data || "Timeout exceeded or no response received from target API"
        });
    }
});

app.listen(PORT, () => console.log(`Cinesubz Trace API running on port ${PORT}`));
