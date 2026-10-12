from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from playwright.sync_api import sync_playwright
import requests
from bs4 import BeautifulSoup

app = FastAPI(title="Cinesubz Scraper API")

class URLRequest(BaseModel):
    url: str

@app.get("/")
def home():
    return {"status": "active", "message": "Cinesubz API is running successfully!"}

# 1. මූවි සර්ච් කිරීම සඳහා Endpoint එක
@app.get("/api/search")
def search_movies(q: str):
    try:
        search_url = f"https://cinesubz.net/?s={q}"
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
        response = requests.get(search_url, headers=headers)
        
        if response.status_code != 200:
            return {"error": "Failed to connect to cinesubz"}
            
        soup = BeautifulSoup(response.text, 'html.parser')
        results = []
        
        for item in soup.select('article, .post, .item, .search-item'):
            title_elem = item.find('h2') or item.find('h3') or item.find('a')
            link_elem = item.find('a')
            img_elem = item.find('img')
            
            if title_elem and link_elem:
                title = title_elem.get_text(strip=True)
                url = link_elem.get('href')
                image = img_elem.get('src') if img_elem else None
                
                if url and title and url not in [r['url'] for r in results]:
                    results.append({"title": title, "url": url, "image": image})
                    
        return {"status": "success", "query": q, "total": len(results), "results": results}
    except Exception as e:
        return {"error": str(e)}

# 2. ටයිමර් පේජ් එක බයිපාස් කර Direct Download ලින්ක් ලබා ගැනීම
@app.post("/api/resolve-link")
def resolve_download_link(data: URLRequest):
    zt_url = data.url
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            page.goto(zt_url, timeout=30000)
            page.wait_for_selector("text=Go to Download Page", timeout=15000)
            page.click("text=Go to Download Page")
            
            page.wait_for_load_state("networkidle", timeout=15000)
            final_page_url = page.url
            
            resolved_links = []
            for a in page.locator("a").all():
                href = a.get_attribute("href")
                text = a.inner_text()
                if href and ("download" in href.lower() or "t.me" in href.lower()):
                    resolved_links.append({"text": text.strip(), "url": href})
                    
            browser.close()
            return {
                "status": "success",
                "final_page": final_page_url,
                "direct_links": resolved_links
            }
        except Exception as e:
            browser.close()
            return {"error": str(e)}
