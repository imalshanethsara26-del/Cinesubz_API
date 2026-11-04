// 🕵️‍♂️ Chamindu's API Tracer & Live Flow Logger Endpoint
app.get('/api/v1/cinesubz/trace-chamindu', async (req, res) => {
    const targetZtUrl = req.query.url || "https://cinesubz.net/zt-links/nvm2e3d9ep/";
    const chaminduApiUrl = `https://api.chamindu.site/api/v1/movies/cinesubz/resolve?url=${encodeURIComponent(targetZtUrl)}&api_key=chama_api_5dc8403e460b74f6f8eda19f55746e08`;

    console.log(`\n==================================================`);
    console.log(`🕵️‍♂️ [LIVE TRACE START] Intercepting Target API...`);
    console.log(`🎯 Target ZT-Link: ${targetZtUrl}`);
    console.log(`🔗 External API Endpoint: ${chaminduApiUrl}`);

    try {
        console.log(`1️⃣ Preparing outgoing HTTP GET request to external resolver...`);
        const startTime = Date.now();

        // Sending request to the target API
        const apiResponse = await axios.get(chaminduApiUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json'
            },
            timeout: 20000
        });

        const duration = Date.now() - startTime;
        console.log(`📥 [API RESPONSE RECEIVED] Status: ${apiResponse.status} (${duration}ms)`);
        console.log(`📦 Response Headers:`, JSON.stringify(apiResponse.headers, null, 2));
        console.log(`📄 Response Body / Payload:`, JSON.stringify(apiResponse.data, null, 2));
        console.log(`==================================================\n`);

        // Return the intercepted data back to the user
        res.json({
            status: true,
            message: "Successfully traced external API flow and logged live details to terminal!",
            traced_data: apiResponse.data
        });

    } catch (error) {
        console.error(`❌ [TRACE ERROR]: ${error.message}`);
        if (error.response) {
            console.error(`🔴 Error Status: ${error.response.status}`);
            console.error(`🔴 Error Data:`, error.response.data);
        }
        console.log(`==================================================\n`);

        res.status(500).json({
            status: false,
            error: error.message,
            details: error.response?.data || "No additional error info"
        });
    }
});
