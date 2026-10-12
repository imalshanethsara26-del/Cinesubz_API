const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
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

// Search Endpoint
app.get('/api/v1/cinesubz/search', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) return res.status(400).json({ status: false, message: "Search term required" });

        const searchUrl = "https://cinesubz.net/?s=" + encodeURIComponent(query);
        const response = await axios.get(searchUrl, { headers: HEADERS, timeout: 10000 });
        const $ = cheerio.load(response.data);
        const results = [];

        $('a').each((i, el) => {
            const href = $(el).attr('href') || '';
            const parent = $(el).closest('article, .post, .item, div');
            
            let title = $(el).find('h2, h3, .title').text().trim();
            if (!title) title = $(el).attr('title') || '';
            if (!title) title = $(el).text().trim();

            let img = $(el).find('img').attr('src');
            if (!img) img = $(el).find('img').attr('data-src');
            if (!img) img = parent.find('img').attr('src');
            if (!img) img = parent.find('img').attr('data-src') || '';

            if (href.includes('cinesubz.net') && (href.includes('/movies/') || href.includes('/tvshows/')) && title.length > 2) {
                title = title.replace(/\t|\n/g, '').trim();
                if (!results.some(r => r.link === href)) {
                    results.push({ title, image: img, link: href });
                }
            }
        });

        res.json({ status: true, creator: "IMALSHA API", site: "cinesubz", results_count: results.length, data: results });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// Info & Download Endpoint
app.get('/api/v1/cinesubz/infodl', async (req, res) => {
    try {
        const movieUrl = req.query.url;
        if (!movieUrl) return res.status(400).json({ status: false, message: "URL required" });

        const response = await axios.get(movieUrl, { headers: HEADERS, timeout: 10000 });
        const $ = cheerio.load(response.data);

        // Title
        let title = $('h1.entry-title').text().trim();
        if (!title) title = $('h1').first().text().trim();
        if (!title) title = $('title').text().trim();

        // Image
        let image = $('meta[property="og:image"]').attr('content');
        if (!image) image = $('.poster img, .single-poster img, .entry-content img').first().attr('src'] || '';

        // IMDb
        let imdb_rating = $('.imdb-rate, .rating, .score, span[itemprop="ratingValue"]').first().text().trim();
        if (!imdb_rating) {
            const pageText = $.text();
            const match = pageText.match(/IMDb\s*:?\s*([\d\.]+(\/10)?)/i);
            if (match) imdb_rating = match[1];
        }
        if (!imdb_rating) imdb_rating = "N/A";

        // Story
        let story = '';
        $('.entry-content p, .su-spoiler-content p, .synopsis p').each((i, el) => {
            const text = $(el).text().trim();
            if (text && text.length > 30 && !text.includes('උපසිරැසි') && !text.includes('Sinhala Subtitles') && !text.includes('Download')) {
                if (!story) story = text;
            }
        });
        if (!story) story = 'No description available';

        // Collect zt-links first
        const ztLinks = [];
        $('a').each((i, el) => {
            const href = $(el).attr('href') || '';
            const text = $(el).text().trim();
            const parentText = $(el).parent().text().replace(/\s+/g, ' ').trim();
            const fullText = text + ' ' + parentText;

            if (href && href.includes('/zt-links/')) {
                const qMatch = fullText.match(/(2160p|4K|1080p|720p|480p|BluRay|WEB-DL|HDRip)/i);
                const quality = qMatch ? qMatch[0].toUpperCase() : "HD";

                const sMatch = fullText.match(/(\d+(\.\d+)?\s*(GB|MB))/i);
                const size = sMatch ? sMatch[0] : "N/A";

                if (!ztLinks.some(z => z.ztUrl === href)) {
                    ztLinks.push({ quality, size, ztUrl: href });
                }
            }
        });

        // Resolve Final Download Links from zt-links
        const downloads = [];
        for (const item of ztLinks) {
            try {
                const ztRes = await axios.get(item.ztUrl, { headers: HEADERS, timeout: 5000 });
                const $zt = cheerio.load(ztRes.data);
                
                let downloadPageUrl = '';
                const link1 = $zt('a:contains("Go to Download Page")').attr('href');
                const link2 = $zt('a.btn').attr('href');
                
                if (link1) {
                    downloadPageUrl = link1;
                } else if (link2) {
                    downloadPageUrl = link2;
                }

                if (downloadPageUrl) {
                    const finalRes = await axios.get(downloadPageUrl, { headers: HEADERS, timeout: 5000 });
                    const $final = cheerio.load(finalRes.data);

                    $final('a').each((i, el) => {
                        const link = $final(el).attr('href') || '';
                        const btnText = $final(el).text().trim();

                        if (link && (link.includes('download') || link.includes('t.me') || link.includes('pixeldrain') || link.includes('mega') || link.startsWith('http'))) {
                            if (!link.includes('cinesubz.net') && !link.includes('javascript')) {
                                downloads.push({
                                    name: `${btnText} - ${item.quality} (${item.size})`,
                                    quality: item.quality,
                                    size: item.size,
                                    direct_link: link
                                });
                            }
                        }
                    });
                } else {
                    downloads.push({
                        name: `Download Link - ${item.quality} (${item.size})`,
                        quality: item.quality,
                        size: item.size,
                        direct_link: item.ztUrl
                    });
                }
            } catch (e) {
                downloads.push({
                    name: `Download Link - ${item.quality} (${item.size})`,
                    quality: item.quality,
                    size: item.size,
                    direct_link: item.ztUrl
                });
            }
        }

        res.json({
            status: true,
            creator: "IMALSHA API",
            site: "cinesubz",
            data: {
                title,
                imdb_rating,
                story,
                image,
                downloads
            }
        });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

app.listen(PORT, () => console.log(`Cinesubz API running on port ${PORT}`));
