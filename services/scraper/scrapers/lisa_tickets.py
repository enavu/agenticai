"""StubHub LISA (Blackpink) ticket price scraper — Viva La Lisa Las Vegas residency."""

import asyncio
import re
import logging
from playwright.async_api import async_playwright

logger = logging.getLogger(__name__)

TARGET_EVENTS = [
    {"date": "Nov 13 2026", "url": "https://www.stubhub.com/lisa-blackpink-las-vegas-tickets-11-13-2026/event/160788722/?quantity=4"},
    {"date": "Nov 14 2026", "url": "https://www.stubhub.com/lisa-blackpink-las-vegas-tickets-11-14-2026/event/160789606/?quantity=4"},
]

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/121.0.0.0 Safari/537.36"
)


async def _scrape_one(event: dict) -> dict | None:
    url = event["url"]
    date = event["date"]
    logger.info(f"StubHub (Lisa): scraping {date}")

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        context = await browser.new_context(user_agent=USER_AGENT, viewport={"width": 1280, "height": 900})
        page = await context.new_page()
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=30_000)
            await asyncio.sleep(3)
            await page.evaluate("() => window.scrollTo(0, 600)")
            await asyncio.sleep(4)

            text = await page.evaluate("() => document.body.innerText")

            prices = []
            for m in re.finditer(r'\$([0-9,]+)\s*\n\s*incl\.?\s*fees', text):
                price = int(m.group(1).replace(',', ''))
                if 50 <= price <= 10000:
                    prices.append(price)

            if not prices:
                logger.warning(f"StubHub (Lisa): no 4-ticket listings for {date}")
                return None

            min_price = min(prices)
            logger.info(f"StubHub (Lisa): {date} — min ${min_price}/ticket ({len(prices)} listings)")
            return {
                "price": float(min_price),
                "details": {"date": date, "venue": "Colosseum at Caesars Palace", "qty": 4, "url": url},
            }
        finally:
            await browser.close()


async def scrape_lisa_tickets() -> list[dict]:
    """Scrape StubHub for Lisa Viva La Lisa Las Vegas, Nov 13 + 14 2026, 4 tickets."""
    results = []
    for i, event in enumerate(TARGET_EVENTS):
        if i > 0:
            await asyncio.sleep(5)
        result = await _scrape_one(event)
        if result:
            results.append(result)

    logger.info(f"StubHub (Lisa): {len(results)}/{len(TARGET_EVENTS)} shows returned prices")
    return results
