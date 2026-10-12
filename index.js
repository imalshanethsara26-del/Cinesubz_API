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

// Search Endpoint (කිසිදු වෙනසක් කර නැත)
app.get('/api/v1/cinesubz/search', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) return res.status(400).json({ status: false, message: "Search term required" });

        const searchUrl = "https://cinesubz.net/?s=" + encodeURIComponent(query);
        const response = await axios.get(searchUrl, { headers: HEADERS, timeout: 15000 });
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

// Info & Download Endpoint (දෝෂය නිවැරදි කර ඇත)
app.get('/api/v1/cinesubz/infodl', async (req, res) => {
    try {
        const movieUrl = req.query.url;
        if (!movieUrl) return res.status(400).json({ status: false, message: "URL required" });

        const response = await axios.get(movieUrl, { headers: HEADERS, timeout: 15000 });
        const $ = cheerio.load(response.data);

        // Title
        let title = $('h1.entry-title').text().trim();
        if (!title) title = $('h1').first().text().trim();
        if (!title) title = $('title').text().trim();

        // Image
        let image = $('meta[property="og:image"]').attr('content');
        if (!image) {
            const imgAttr = $('.poster img, .single-poster img, .entry-content img').first().attr('src');
            image = imgAttr || '';
        }

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

        const downloads = [];

        // Traverse through zt-links and final redirect pages
        for (const item of ztLinks) {
            let resolvedLinks = [];
            try {
                // 1. Fetch zt-link page (Timeout 20s)
                const ztRes = await axios.get(item.ztUrl, { headers: HEADERS, timeout: 20000 });
                const ztHtml = ztRes.data;
                const $zt = cheerio.load(ztHtml);
                
                let redirectUrl = '';

                // Find redirect link from zt page (නිවැරදි කරන ලදී)
                $zt('a').each((i, el) => {
                    const href = $zt(el).attr('href') || '';
                    if (href && !href.includes('cinesubz.net') && !href.includes('javascript') && !href.includes('#') && href.startsWith('http')) {
                        redirectUrl = href;
                    }
                });

                if (!redirectUrl) {
                    const urlRegex = /https?:\/\/[^\s"'<>]+\b(?:space|redirect|dl|download|player|go)[^\s"'<>]*/gi;
                    const matches = ztHtml.match(urlRegex);
                    if (matches) {
                        const valid = matches.filter(m => !m.includes('cinesubz.net'));
                        if (valid.length > 0) redirectUrl = valid[0];
                    }
                }

                // 2. Fetch final redirect page (csplayer2.space)
                if (redirectUrl) {
                    const finalRes = await axios.get(redirectUrl, { headers: HEADERS, timeout: 20000 });
                    const finalHtml = finalRes.data;
                    const $final = cheerio.load(finalHtml);

                    // Check all <a> tags on final page
                    $final('a').each((i, el) => {
                        const link = $final(el).attr('href') || '';
                        const btnText = $final(el).text().trim();

                        if (link && !link.includes('cinesubz.net') && !link.includes('javascript') && !link.includes('#')) {
                            if (!link.includes('CineSubzAdmin')) {
                                resolvedLinks.push({
                                    name: `${btnText || 'Direct Download'} - ${item.quality} (${item.size})`,
                                    quality: item.quality,
                                    size: item.size,
                                    direct_link: link
                                });
                            }
                        }
                    });

                    // If <a> tags didn't give links, search via Regex in final HTML/Scripts
                    if (resolvedLinks.length === 0) {
                        const linkRegex = /https?:\/\/[^\s"'<>]+\b(?:pixeldrain|mega|drive|download|file|stream|get)[^\s"'<>]*/gi;
                        const matches = finalHtml.match(linkRegex);
                        if (matches) {
                            const valid = matches.filter(m => !m.includes('cinesubz.net') && !m.includes('CineSubzAdmin'));
                            valid.forEach((l, idx) => {
                                resolvedLinks.push({
                                    name: `Direct Download ${idx + 1} - ${item.quality} (${item.size})`,
                                    quality: item.quality,
                                    size: item.size,
                                    direct_link: l
                                });
                            });
                        }
                    }
                }

                if (resolvedLinks.length > 0) {
                    downloads.push(...resolvedLinks);
                } else {
                    downloads.push({
                        name: `Download Link - ${item.quality} (${item.size})`,
                        quality: item.quality,
                        size: item.size,
                        direct_link: redirectUrl || item.ztUrl
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
