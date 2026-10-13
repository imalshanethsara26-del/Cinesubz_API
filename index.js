const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
let PORT = process.env.PORT;
if (!PORT) {
    PORT = 3000;
}

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
        if (!query) {
            return res.status(400).json({ status: false, message: "Search term required" });
        }

        const searchUrl = "https://cinesubz.net/?s=" + encodeURIComponent(query);
        const response = await axios.get(searchUrl, { headers: HEADERS, timeout: 15000 });
        const $ = cheerio.load(response.data);
        const results = [];

        $('a').each((i, el) => {
            let href = $(el).attr('href');
            if (!href) href = '';
            
            const parent = $(el).closest('article, .post, .item, div');
            
            let title = $(el).find('h2, h3, .title').text().trim();
            if (!title) title = $(el).attr('title');
            if (!title) title = $(el).text().trim();

            let img = $(el).find('img').attr('src');
            if (!img) img = $(el).find('img').attr('data-src');
            if (!img) img = parent.find('img').attr('src');
            if (!img) img = parent.find('img').attr('data-src');
            if (!img) img = '';

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

// Info & Download Endpoint (மූවි පේජ් එකෙන්ම සෘජුවම ඩවුන්ලෝඩ් ලින්ක්ස් ලබා ගැනීම)
app.get('/api/v1/cinesubz/infodl', async (req, res) => {
    try {
        const movieUrl = req.query.url;
        if (!movieUrl) {
            return res.status(400).json({ status: false, message: "URL required" });
        }

        const response = await axios.get(movieUrl, { headers: HEADERS, timeout: 20000 });
        const html = response.data;
        const $ = cheerio.load(html);

        // Title
        let title = $('meta[property="og:title"]').attr('content');
        if (!title) title = $('h1.entry-title').text().trim();
        if (!title) title = $('h1').first().text().trim();
        if (!title) title = $('title').text().trim();
        if (!title) title = "Unknown Movie";

        // Image
        let image = $('meta[property="og:image"]').attr('content');
        if (!image) {
            const imgAttr = $('.poster img, .single-poster img, .entry-content img').first().attr('src');
            image = imgAttr ? imgAttr : '';
        }

        // Quality, Rating, Director
        let quality = $('.quality, .movie-quality').text().trim();
        if (!quality) quality = "WEB-DL";

        let rating = $('.imdb-rate, .rating, .score').first().text().trim();
        if (!rating) rating = "N/A";

        let director = $('span.director, .mr-director').text().trim();
        if (!director) director = "N/A";

        let year = "2026";
        const yearMatch = title.match(/\((\d{4})\)/);
        if (yearMatch) year = yearMatch[1];

        // Story
        let story = '';
        $('.entry-content p, .su-spoiler-content p, .synopsis p').each((i, el) => {
            const text = $(el).text().trim();
            if (text && text.length > 30 && !text.includes('උපසිරැසි') && !text.includes('Sinhala Subtitles') && !text.includes('Download')) {
                if (!story) story = text;
            }
        });
        if (!story) story = 'No description available';

        // Cast extraction
        const cast = [];
        $('.cast-item, .actor, .person').each((i, el) => {
            const name = $(el).find('.name, h4, span').text().trim();
            let role = $(el).find('.role, .character').text().trim();
            if (!role) role = 'Actor';
            let img = $(el).find('img').attr('src');
            if (!img) img = '';
            if (name) {
                cast.push({ name, role, image: img });
            }
        });

        // Gallery images
        const gallery = [];
        $('.gallery img, .screenshots img, .entry-content img').each((i, el) => {
            let src = $(el).attr('src');
            if (!src) src = $(el).attr('data-src');
            if (src && src.startsWith('http') && !gallery.includes(src)) {
                gallery.push(src);
            }
        });

        // Downloads Extraction (മූවි පේජ් එකේ ඇති සියලුම ලින්ක්ස් සහ ස්ක්‍රිප්ට් ස්කෑන් කිරීම)
        const downloads = [];

        // 1. Scan all <a> tags on the main movie page
        $('a').each((i, el) => {
            let link = $(el).attr('href');
            if (!link) link = '';
            if (link.startsWith('//')) link = 'https:' + link;

            const text = $(el).text().trim() + ' ' + $(el).parent().text().trim();

            if (link && !link.includes('cinesubz.net') && !link.includes('CineSubzAdmin') && !link.includes('javascript') && !link.includes('telegram.org')) {
                let isPixel = link.includes('pixeldrain');
                let isBot = link.includes('t.me/') || link.includes('telegram.me/');
                let isServer = link.includes('space') || link.includes('kdrive') || link.includes('download') || link.includes('stream');

                if (isPixel || isBot || isServer || link.includes('http')) {
                    const qMatch = text.match(/(2160p|4K|1080p|720p|480p|BluRay|WEB-DL|HDRip)/i);
                    let qName = qMatch ? qMatch[0].toUpperCase() : quality;

                    const sMatch = text.match(/(\d+(\.\d+)?\s*(GB|MB))/i);
                    let size = sMatch ? sMatch[0] : "N/A";

                    let type = "Direct Server";
                    if (isPixel) type = "PixelDrain";
                    else if (isBot) type = "Telegram Bot";
                    else if (isServer) type = "Direct High-Speed Server";

                    let downloadName = qName + " [" + type + "]";
                    if (!downloads.some(d => d.link === link)) {
                        downloads.push({
                            quality: downloadName,
                            size: size,
                            language: "English",
                            link: link
                        });
                    }
                }
            }
        });

        // 2. Regex scan on raw HTML for hidden or script-based download links
        const linkRegex = /https?:\/\/[^\s"'<>]+\b(?:pixeldrain|mega|drive|download|file|stream|get|space|kdrive|telegram\.me|t\.me)[^\s"'<>]*/gi;
        const regexMatches = html.match(linkRegex);
        if (regexMatches) {
            regexMatches.forEach(l => {
                if (!l.includes('cinesubz.net') && !l.includes('CineSubzAdmin') && !l.includes('telegram.org')) {
                    let isPixel = l.includes('pixeldrain');
                    let isBot = l.includes('t.me/') || l.includes('telegram.me/');
                    let isServer = l.includes('space') || l.includes('kdrive');

                    let type = "Direct Server";
                    if (isPixel) type = "PixelDrain";
                    else if (isBot) type = "Telegram Bot";
                    else if (isServer) type = "Direct High-Speed Server";

                    let downloadName = quality + " [" + type + "]";
                    if (!downloads.some(d => d.link === l)) {
                        downloads.push({
                            quality: downloadName,
                            size: "N/A",
                            language: "English",
                            link: l
                        });
                    }
                }
            });
        }

        res.json({
            status: true,
            creator: "@Imalsha",
            site: "cinesubz",
            url: movieUrl,
            data: {
                title,
                image,
                quality,
                rating,
                imdb: rating + " (N/A)",
                director,
                language: "ENGLISH",
                genres: ["Action", "Adventure", "English", "Sinhala Subtitles"],
                story,
                cast,
                gallery,
                trailer: "https://www.youtube.com/@cinesubz",
                year,
                duration: "N/A",
                tag: "English",
                directors: director,
                stars: "N/A",
                country: "Sri Lanka / Global",
                downloads
            }
        });

} catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

app.listen(PORT, () => console.log("Cinesubz API running on port " + PORT));
