const puppeteer = require('puppeteer');

async function inspectCsPlayerPage(targetUrl) {
    console.log(`\n🔍 [INSPECTOR] Opening target URL: ${targetUrl}`);
    
    const browser = await puppeteer.launch({
        headless: true, // අවශ්‍ය නම් false කරලා බ්‍රව්සර් එක පේන්න සකස් කරන්න පුළුවන්
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');

    // 1. පිටතටයන සියලුම Request ට්‍රැක් කිරීම
    page.on('request', req => {
        console.log(`➡️ [REQUEST]: ${req.method()} ${req.url()}`);
    });

    // 2. ලැබෙන සියලුම Response සහ API JSON දත්ත අල්ලා ගැනීම
    page.on('response', async res => {
        const reqUrl = res.url();
        const status = res.status();
        console.log(`⬅️ [RESPONSE] [${status}]: ${reqUrl}`);
        
        try {
            const contentType = res.headers()['content-type'] || '';
            if (contentType.includes('application/json') || reqUrl.includes('api') || reqUrl.includes('get')) {
                const json = await res.json();
                console.log(`🎯 [API JSON PAYLOAD FOUND]:`, JSON.stringify(json, null, 2));
            }
        } catch (e) {}
    });

    try {
        // අර ඩුපෝස්ට්/සීඑස්පלෙයාර් ලින්ක් එකට කෙළින්ම යෑම
        await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        console.log(`✅ Page loaded. Waiting for elements to render...`);

        // ටයිමර් එක හෝ ස්ක්‍රිප්ට් ලෝඩ් වන තෙක් තත්පර කිහිපයක් රැඳී සිටීම
        await new Promise(r => setTimeout(r, 4000));

        // පේජ් එකේ තියෙන "Direct Download (New)" බටන් එක ක්ලික් කිරීම
        const clicked = await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('a, button, div, span'));
            const targetBtn = elements.find(el => {
                const txt = (el.innerText || '').toUpperCase();
                return txt.includes('DIRECT DOWNLOAD') || txt.includes('DOWNLOAD (NEW)') || txt.includes('PROCESSING');
            });
            if (targetBtn) {
                targetBtn.click();
                return true;
            }
            return false;
        });

        console.log(`🖱️ Download button click triggered: ${clicked}`);

        // ක්ලික් කළ පසු බැක්ග්‍රাউন্ড එකෙන් එන රෙක්වෙස්ට්ස් කැච් වීමට තව ටිකක් වෙලා බලා සිටීම
        await new Promise(r => setTimeout(r, 8000));

    } catch (err) {
        console.error(`❌ [INSPECTOR ERROR]: ${err.message}`);
    } finally {
        await browser.close();
        console.log(`🔒 Browser closed.`);
    }
}

// ඔයා දුන් සැබෑ ලින්ක් එක මෙහි ඇතුළත් කර ඇත[span_2](start_span)[span_2](end_span)
const targetMovieLink = "https://drive.csplayer2.space/server7/202608/Spider-Man%20Brand%20New%20Day%20(2026)%20English%20WEB-%5BCineSubz.co%5D-480p?ext=mp4";
inspectCsPlayerPage(targetMovieLink);
