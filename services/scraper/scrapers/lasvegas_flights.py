"""DEN→LAS flight price scraper using Google Flights — nonstop only."""

import asyncio
import re
import logging
from playwright.async_api import async_playwright

logger = logging.getLogger(__name__)

GOOGLE_FLIGHTS_URL = (
    "https://www.google.com/travel/flights"
    "?q=nonstop+flights+from+denver+to+las+vegas+november+13+2026"
)


async def scrape_lasvegas_flights() -> list[dict]:
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/121.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1440, "height": 900},
        )
        page = await context.new_page()
        try:
            logger.info(f"Navigating to Google Flights: {GOOGLE_FLIGHTS_URL}")
            await page.goto(GOOGLE_FLIGHTS_URL, wait_until="domcontentloaded", timeout=30_000)
            await asyncio.sleep(8)

            text = await page.evaluate("() => document.body.innerText")

            results = []
            for m in re.finditer(r'\$([0-9,]+)\s*\n?\s*(round trip|one way)', text, re.IGNORECASE):
                price = int(m.group(1).replace(',', ''))
                trip_type = m.group(2).strip().lower()
                if not (30 <= price <= 1500):
                    continue

                start = max(0, m.start() - 300)
                end = min(len(text), m.end() + 300)
                ctx = text[start:end]

                if not re.search(r'\bnonstop\b', ctx, re.IGNORECASE):
                    continue

                results.append({
                    "price": float(price),
                    "details": {"route": "DEN→LAS", "dates": "Nov 13–14 2026", "type": trip_type, "stops": "nonstop"},
                })

            seen = set()
            unique = []
            for r in results:
                if r["price"] not in seen:
                    seen.add(r["price"])
                    unique.append(r)

            logger.info(f"Google Flights (Las Vegas nonstop): {len(unique)} prices found")
            return unique

        except Exception as e:
            logger.error(f"Las Vegas flights scrape failed: {e}", exc_info=True)
            raise
        finally:
            await browser.close()
