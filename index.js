const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
let PORT = process.env.PORT || 3000;

app.use(cors());

app.get('/', (req, res) => {
    res.json({ status: true, message: "Chamindu API Tracer Bridge is Live 🚀" });
});

// චමිදුගේ API එකට රික්වෙස්ට් යවා ගමන් මඟ සහ රෙස්පොන්ස් එක ට්‍රේස් කරන එන්ඩ්පොයින්ට් එක
app.get('/api/v1/cinesubz/infodl', async (req, res) => {
    const movieUrl = req.query.url || req.query.q;
    if (!movieUrl) {
        return res.status(400).json({ status: false, message: "URL required (?url=... or ?q=...)" });
    }

    console.log(`\n==================================================`);
    console.log(`📡 [CHAMINDU API BRIDGE] Incoming Request for URL: ${movieUrl}`);
    console.log(`==================================================`);

    try {
        // චමිදුගේ නිවැරදි API ලින්ක් එක සැකසීම
        const chaminduApiUrl = `https://api.chamindu.site/api/v1/movies/cinesubz/infodl?q=${encodeURIComponent(movieUrl)}&api_key=chama_api_5dc8403e460b74f6f8eda19f55746e08`;
        
        console.log(`👉 [Step 1] Sending GET request to Chamindu API...`);
        console.log(`   🔗 Endpoint: ${chaminduApiUrl}`);

        const startTime = Date.now();
        const chaminduRes = await axios.get(chaminduApiUrl, { timeout: 25000 });
        const duration = Date.now() - startTime;

        console.log(`\n✅ [Step 2] Response Received from Chamindu API!`);
        console.log(`   ⏱️ Time Taken: ${duration}ms`);
        console.log(`   📊 Response Status: ${chaminduRes.status}`);
        
        const responseData = chaminduRes.data;

        console.log(`\n📦 [Step 3] Data Summary from Chamindu:`);
        console.log(`   - Status: ${responseData.status}`);
        console.log(`   - Creator: ${responseData.creator}`);
        console.log(`   - Movie Title: ${responseData.data ? responseData.data.title : 'N/A'}`);
        console.log(`   - Downloads Found: ${responseData.data && responseData.data.downloads ? responseData.data.downloads.length : 0}`);

        if (responseData.data && responseData.data.downloads) {
            console.log(`\n📥 [Step 4] Extracted Download Links:`);
            responseData.data.downloads.forEach((dl, idx) => {
                console.log(`   [${idx + 1}] Quality: ${dl.quality} | Size: ${dl.size} | Link: ${dl.link}`);
            });
        }

        console.log(`==================================================`);
        console.log(`🎉 [JOURNEY COMPLETE] Forwarding data to client...`);
        console.log(`==================================================\n`);

        // චමිදුගේ API එකෙන් ලැබුණු දත්ත එලෙසම අපේ ක්라이언트 වෙත යැවීම
        res.json(responseData);

    } catch (err) {
        console.log(`\n❌ [ERROR] Failed to fetch from Chamindu API: ${err.message}`);
        if (err.response) {
            console.log(`   - Error Status: ${err.response.status}`);
            console.log(`   - Error Data:`, err.response.data);
        }
        res.status(500).json({ status: false, error: err.message });
    }
});

app.listen(PORT, () => console.log("Chamindu Tracer Bridge running on port " + PORT));
