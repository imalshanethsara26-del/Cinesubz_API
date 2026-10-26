const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Referer': 'https://cinesubz.net/'
};

app.get('/', (req, res) => {
    res.json({
        status: true,
        message: "IMALSHA CINESUBZ ZETA NATIVE API is Live 🚀",
        endpoint: "/api/v1/cinesubz/get-movie?q=Spider-Man"
    });
});

// Zetaflix Native Search & Player Extractor
app.get('/api/v1/cinesubz/get-movie', async (req, res) => {
    try {
        const query = req.query.q || "Spider-Man";
        console.log(`\n🔍 [ZETA NATIVE] Searching directly via Zetaflix API for: ${query}`);
        
        // 1. Search directly using Zetaflix theme custom endpoint
        const zetaSearchUrl = `https://cinesubz.net/wp-json/zetaflix/search?q=${encodeURIComponent(query)}`;
        const searchRes = await axios.get(zetaSearchUrl, { headers: HEADERS, timeout: 15000 });
        
        // 2. Fallback to standard WP search if Zetaflix search returns empty
        let searchResults = searchRes.data;
        
        res.json({
            status: true,
            creator: "@Imalsha",
            query: query,
            raw_zeta_results: searchResults
        });

    } catch (err) {
        console.error(`❌ [ZETA ERROR]: ${err.message}`);
        res.status(500).json({ status: false, error: err.message });
    }
});

app.listen(PORT, () => console.log(`Zeta Native API running on port ${PORT}`));
