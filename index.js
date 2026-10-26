const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
};

app.get('/', (req, res) => {
    res.json({
        status: true,
        message: "IMALSHA CINESUBZ CPT TESTER is Live 🚀",
        endpoint: "/api/v1/cinesubz/test-cpt"
    });
});

// Custom Post Types Test Endpoint
app.get('/api/v1/cinesubz/test-cpt', async (req, res) => {
    const slug = "spider-man-brand-new-day-2026-sinhala-subtitles";
    
    // Test URLs for WordPress Custom Post Types
    const endpoints = [
        `https://cinesubz.net/wp-json/wp/v2/movies?slug=${slug}`,
        `https://cinesubz.net/wp-json/wp/v2/tvshows?slug=${slug}`,
        `https://cinesubz.net/wp-json/wp/v2/types`
    ];

    let foundData = null;
    let matchedEndpoint = "";

    for (const url of endpoints) {
        try {
            console.log(`🔍 Testing CPT Endpoint: ${url}`);
            const response = await axios.get(url, { headers: HEADERS, timeout: 10000 });
            if (response.data && (Array.isArray(response.data) ? response.data.length > 0 : true)) {
                foundData = response.data;
                matchedEndpoint = url;
                break;
            }
        } catch (e) {
            console.log(`⚠️ Endpoint failed (${url}): ${e.message}`);
        }
    }

    res.json({
        status: true,
        creator: "@Imalsha",
        slug_tested: slug,
        found: foundData !== null,
        matched_endpoint: matchedEndpoint || "None",
        data: foundData
    });
});

app.listen(PORT, () => console.log(`CPT Test API running on port ${PORT}`));
