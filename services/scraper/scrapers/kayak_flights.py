"""Flight price scraper using Google Flights — nonstop only."""

import asyncio
import re
import logging
from playwright.async_api import async_playwright

logger = logging.getLogger(__name__)

GOOGLE_FLIGHTS_URL = (
    "https://www.google.com/travel/flights"
    "?q=nonstop+flights+from+denver+to+paris+september+2026"
)


async def scrape_flights() -> list[dict]:
    """
    Scrape Google Flights for nonstop DEN→CDG prices in September 2026.
    Returns a list of price dicts: [{"price": 927, "details": {...}}]
    """
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
                if not (300 <= price <= 5000):
                    continue

                start = max(0, m.start() - 300)
                end = min(len(text), m.end() + 300)
                ctx = text[start:end]

                if not re.search(r'\bnonstop\b', ctx, re.IGNORECASE):
                    continue  # skip connecting flights

                airline_m = re.search(r'(United|Air France|Delta|American|Lufthansa|British Airways|Norse|Level)', ctx, re.IGNORECASE)
                airline = airline_m.group(1) if airline_m else None
                det = {"route": "DEN→CDG", "month": "Sep 2026", "type": trip_type, "stops": "nonstop"}
                if airline:
                    det["airline"] = airline
                results.append({"price": float(price), "details": det})

            seen = set()
            unique = []
            for r in results:
                if r["price"] not in seen:
                    seen.add(r["price"])
                    unique.append(r)

            logger.info(f"Google Flights (nonstop): {len(unique)} unique prices found")
            for r in unique[:5]:
                logger.info(f"  ${r['price']:.0f} ({r['details']['type']})")

            return unique

        except Exception as e:
            logger.error(f"Google Flights scrape failed: {e}", exc_info=True)
            raise
        finally:
            await browser.close()
