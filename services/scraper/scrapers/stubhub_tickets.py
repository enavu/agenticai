"""StubHub ticket price scraper using Playwright."""

import asyncio
import re
import logging
from playwright.async_api import async_playwright

logger = logging.getLogger(__name__)

# Only the two target shows, 4 tickets
TARGET_EVENTS = [
    {"date": "Sep 16 2026", "url": "https://www.stubhub.com/celine-dion-nanterre-tickets-9-16-2026/event/160790811/?quantity=4"},
    {"date": "Sep 18 2026", "url": "https://www.stubhub.com/celine-dion-nanterre-tickets-9-18-2026/event/160841829/?quantity=4"},
]

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/121.0.0.0 Safari/537.36"
)


async def _scrape_one(event: dict) -> dict | None:
    """Fresh playwright instance per event to avoid session contamination."""
    url = event["url"]
    date = event["date"]
    logger.info(f"StubHub: scraping {date}")

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        context = await browser.new_context(
            user_agent=USER_AGENT,
            viewport={"width": 1280, "height": 900},
        )
        page = await context.new_page()
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=30_000)
            await asyncio.sleep(3)
            await page.evaluate("() => window.scrollTo(0, 600)")
            await asyncio.sleep(4)

            text = await page.evaluate("() => document.body.innerText")

            # Real listings appear as "$705\n[nbsp] incl. fees"
            # Price filter range ($699–$3,103+) does NOT have "incl. fees" after it
            prices = []
            for m in re.finditer(r'\$([0-9,]+)\s*\n\s*incl\.?\s*fees', text):
                price = int(m.group(1).replace(',', ''))
                if 50 <= price <= 10000:
                    prices.append(price)

            if not prices:
                logger.warning(f"StubHub: no 4-ticket listings found for {date}")
                return None

            min_price = min(prices)
            logger.info(f"StubHub: {date} — min ${min_price}/ticket ({len(prices)} listings)")
            return {
                "price": float(min_price),
                "details": {"date": date, "venue": "Paris La Defense Arena", "qty": 4, "url": url},
            }
        finally:
            await browser.close()


async def scrape_tickets() -> list[dict]:
    """
    Scrape StubHub for Celine Dion Paris tickets for Sep 16 + Sep 18 2026, 4 tickets.
    Each event gets its own fresh browser to avoid session contamination / rate-limiting.
    """
    results = []
    for i, event in enumerate(TARGET_EVENTS):
        if i > 0:
            await asyncio.sleep(5)
        result = await _scrape_one(event)
        if result:
            results.append(result)

    logger.info(f"StubHub: {len(results)}/{len(TARGET_EVENTS)} shows returned prices")
    return results
