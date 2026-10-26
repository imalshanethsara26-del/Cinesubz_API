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
        message: "IMALSHA CINESUBZ WP DISCOVERY API is Live 🚀",
        endpoint: "/api/v1/cinesubz/wp-index"
    });
});

// WordPress REST API Root Discovery Endpoint
app.get('/api/v1/cinesubz/wp-index', async (req, res) => {
    try {
        console.log(`\n🔍 [WP DISCOVERY] Fetching WordPress Root API Index...`);
        
        // Fetching the main wp-json index which lists all available routes
        const wpIndexUrl = `https://cinesubz.net/wp-json/`;
        
        const response = await axios.get(wpIndexUrl, {
            headers: HEADERS,
            timeout: 15000
        });

        console.log(`🎉 WP Index fetched successfully!`);

        res.json({
            status: true,
            creator: "@Imalsha",
            site_name: response.data.name || "Cinesubz",
            namespaces: response.data.namespaces || [],
            routes: Object.keys(response.data.routes || {}) // Listing all available API paths
        });

    } catch (err) {
        console.error(`❌ [WP INDEX ERROR]: ${err.message}`);
        res.status(500).json({ status: false, error: err.message });
    }
});

app.listen(PORT, () => console.log(`WP Discovery API running on port ${PORT}`));
