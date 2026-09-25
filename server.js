const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const cors = require("cors");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

const HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "Referer": "https://cinesubz.co/"
};

app.get("/", (req, res) => {
    res.json({ status: true, creator: "IMALSHA API", message: "Live" });
});

app.get("/api/v1/cinesubz/search", async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) return res.status(400).json({ status: false, message: "Search term required" });
        const response = await axios.get("https://cinesubz.co/?s=" + encodeURIComponent(query), { headers: HEADERS });
        const $ = cheerio.load(response.data);
        const results = [];
        $("article, .result-item, .item").each((i, el) => {
            const linkEl = $(el).find("a").first();
            const link = linkEl.attr("href") || "";
            if (link && (link.includes("/movies/") || link.includes("/tvshows/"))) {
                let title = $(el).find("h2, h3, .title").text().trim() || linkEl.attr("title") || "";
                title = title.replace(/\s+/g, " ").trim();
                let image = $(el).find("img").attr("src") || $(el).find("img").attr("data-src") || "";
                if (image.startsWith("//")) image = "https:" + image;
                const type = link.includes("/tvshows/") ? "tvshows" : "movies";
                let quality = $(el).find(".quality, .badge-quality").text().trim() || "N/A";
                let rating = $(el).find(".rating, .score").text().trim() || "N/A";
                if (title && !results.some(r => r.link === link)) results.push({ title, image, type, quality, rating, link });
            }
        });
        res.json({ status: true, creator: "IMALSHA API", site: "cinesubz", query, data: results });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

app.get("/api/v1/cinesubz/infodl", async (req, res) => {
    try {
        const movieUrl = req.query.q || req.query.url;
        if (!movieUrl) return res.status(400).json({ status: false, message: "URL required" });
        const response = await axios.get(movieUrl, { headers: HEADERS });
        const $ = cheerio.load(response.data);
        let title = $("meta[property='og:title']").attr("content") || $("h1").first().text().trim() || "";
        if (title.toLowerCase().includes("download links") || title.toLowerCase().includes("direct")) title = $("title").text().split("|")[0].trim();
        let image = $("meta[property='og:image']").attr("content") || $(".poster img").first().attr("src") || "";
        if (image.startsWith("//")) image = "https:" + image;
        let quality = $(".quality, .badge-quality").first().text().trim() || "WEB-DL";
        let rating = $(".score, .rating").first().text().trim() || "N/A";
        const genres = [];
        $("a[href*='/genre/'], .genres a").each((i, el) => {
            const g = $(el).text().trim();
            if (g && !genres.includes(g)) genres.push(g);
        });
        let story = "";
        $(".entry-content p, .description p").each((i, el) => {
            const txt = $(el).text().trim();
            if (txt.length > 35 && !txt.includes("උපසිරැසි") && !txt.toLowerCase().includes("download")) if (!story) story = txt;
        });
        const downloads = [];
        $("a").each((i, el) => {
            const href = $(el).attr("href") || "";
            const text = $(el).text().trim();
            const parentText = $(el).parent().text().replace(/\s+/g, " ").trim();
            if (href && (href.includes("pixeldrain") || href.includes("telegram") || href.includes("terracloud") || href.includes("mega.nz") || href.includes("gofile") || href.includes("/links/"))) {
                let qMatch = (text + " " + parentText).match(/(1080p|720p|480p|2160p|4k)/i);
                let q = qMatch ? qMatch[0].toUpperCase() : "HD";
                let server = "Direct Server";
                if (href.includes("pixeldrain")) server = "PixelDrain";
                else if (href.includes("telegram")) server = "Telegram Bot";
                if (!downloads.some(d => d.link === href)) downloads.push({ quality: q + " [" + server + "]", size: "N/A", language: "English", link: href });
            }
        });
        res.json({ status: true, creator: "IMALSHA API", site: "cinesubz", url: movieUrl, data: { title, image, quality, rating, genres, story: story || "තොරතුරු නොමැත.", downloads } });
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

app.listen(PORT, () => console.log("Server running on port " + PORT));
