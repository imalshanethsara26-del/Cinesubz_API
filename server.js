const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Referer': 'https://cinesubz.co/'
};

// Root Status Route
app.get('/', (req, res) => {
    res.json({
        status: true,
        message: "IMALSHA CINESUBZ API is Live 🚀",
        endpoints: {
            search: "/api/v1/cinesubz/search?q=movie_name",
            infodl: "/api/v1/cinesubz/infodl?url=movie_url"
        }
    });
});

// Search Endpoint (අපේ පරණ සාර්ථක ලොජික් එක)
app.get('/api/v1/cinesubz/search', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) return res.status(400).json({ status: false, message: "Search term required" });

        const searchUrl = "https://cinesubz.co/?s=" + encodeURIComponent(query);
        const response = await axios.get(searchUrl, { headers: HEADERS, timeout: 10000 });
        const $ = cheerio.load(response.data);
        const results = [];

        $('article, .item, .result-item, div[class*="item"]').each((i, el) => {
            const linkEl = $(el).find('a').first();
            const link = linkEl.attr('href') || $(el).attr('href') || '';
            
            let title = $(el).find('h2, h3, .title').text().trim();
            if (!title) title = linkEl.attr('title') || '';
            if (!title) title = linkEl.text().trim();

            let img = $(el).find('img').attr('src');
            if (!img) img = $(el).find('img').attr('data-src');
            if (img && img.startsWith('//')) img = 'https:' + img;
            if (!img) img = '';

            let quality = $(el).find('.quality, .badge-quality').text().trim() || 'WEB-DL';
            let rating = $(el).find('.rating, .score').text().trim() || 'N/A';

            if (link && (link.includes('/movies/') || link.includes('/tvshows/')) && title.length > 2) {
                title = title.replace(/\t|\n/g, ' ').replace(/\s+/g, ' ').trim();
                if (!results.some(r => r.link === link)) {
                    results.push({ title, image: img, quality, rating, link });
                }
            }
        });

        res.json({ status: true, creator: "IMALSHA API", site: "cinesubz", results_count: results.length, data: results });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// Info & Download Endpoint (CineSubz සඳහා විශේෂිතයි)
app.get('/api/v1/cinesubz/infodl', async (req, res) => {
    try {
        const movieUrl = req.query.url || req.query.q;
        if (!movieUrl) return res.status(400).json({ status: false, message: "URL required" });

        const response = await axios.get(movieUrl, { headers: HEADERS, timeout: 15000 });
        const $ = cheerio.load(response.data);

        let title = $('meta[property="og:title"]').attr('content') \vert{}\vert{} $('h1').first().text().trim() || '';
        title = title.replace(' - CineSubz', '').replace(' Sinhala Subtitles', '').replace(' | සිංහල උපසිරැසි සමඟ', '').trim();

        let image = $('meta[property="og:image"]').attr('content') \vert{}\vert{} $('.poster img, article img').first().attr('src') || '';
        if (image.startsWith('//')) image = 'https:' + image;

        let quality = $('.quality, .badge-quality').first().text().trim() || 'WEB-DL';
        let rating = $('.score, .rating').first().text().trim() || 'N/A';

        let story = '';
        $('.entry-content p, .description p, article p').each((i, el) => {
            const text = $(el).text().trim();
            if (text && text.length > 30 && !text.includes('උපසිරැසි') && !text.toLowerCase().includes('download')) {
                if (!story) story = text;
            }
        });
        if (!story) story = 'තොරතුරු නොමැත.';

        const downloads = [];

        // CineSubz ඩවුන්ලෝඩ් ලින්ක්ස් සහ ටේබල් පේළි ස්ක්‍රැප් කිරීම
        $('tr, .link-row, .dl-row, div[class*="download"], .button-download').each((i, el) => {
            const linkEl = $(el).find('a');
            const href = linkEl.attr('href') || $(el).attr('href') || '';

            if (href && (href.includes('/links/') || href.includes('pixeldrain') || href.includes('telegram') || href.includes('mega') || href.includes('gofile') || href.includes('t.me'))) {
                const rowText = $(el).text().replace(/\s+/g, ' ').trim();

                const qMatch = rowText.match(/(1080p|720p|480p|2160p|4K|WEB-DL|BluRay)/i);
                const q = qMatch ? qMatch[0].toUpperCase() : "HD";

                const sMatch = rowText.match(/(\d+(\.\d+)?\s*(GB|MB))/i);
                const size = sMatch ? sMatch[0] : "N/A";

                let server = "Direct Server";
                if (href.includes('pixeldrain')) server = "PixelDrain";
                else if (href.includes('telegram') || href.includes('t.me')) server = "Telegram";
                else if (href.includes('mega')) server = "Mega";

                if (!downloads.some(d => d.link === href)) {
                    downloads.push({
                        name: `🎥 [CineSubz] ${server} - ${q} (${size})`,
                        quality: q,
                        size: size,
                        link: href
                    });
                }
            }
        });

        // Fallback: මුල් ක්‍රමයට ලින්ක් එකක් හමු නොවුණහොත් සියලුම a ටැග් පරික්ෂා කිරීම
        if (downloads.length === 0) {
            $('a').each((i, el) => {
                const href = $(el).attr('href') || '';
                const text = $(el).text().trim();
                const parentText = $(el).parent().text().replace(/\s+/g, ' ').trim();
                const combined = text + ' ' + parentText;

                if (href && (href.includes('/links/') || href.includes('pixeldrain') || href.includes('telegram')) && !href.includes('cinesubz.co/?s=')) {
                    const qMatch = combined.match(/(1080p|720p|480p|2160p|4K)/i);
                    const q = qMatch ? qMatch[0].toUpperCase() : "HD";

                    const sMatch = combined.match(/(\d+(\.\d+)?\s*(GB|MB))/i);
                    const size = sMatch ? sMatch[0] : "N/A";

                    if (!downloads.some(d => d.link === href)) {
                        downloads.push({
                            name: `🎥 [CineSubz] Download - ${q} (${size})`,
                            quality: q,
                            size: size,
                            link: href
                        });
                    }
                }
            });
        }

        res.json({
            status: true,
            creator: "IMALSHA API",
            site: "cinesubz",
            data: {
                title,
                rating,
                quality,
                image,
                story,
                downloads
            }
        });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

app.listen(PORT, () => console.log(`Cinesubz API Server running on port ${PORT}`));
