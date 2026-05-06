"""Flight price scraper using Google Flights."""

import asyncio
import re
import logging
from playwright.async_api import async_playwright

logger = logging.getLogger(__name__)

# Google Flights — DEN→CDG flexible September 2026
GOOGLE_FLIGHTS_URL = (
    "https://www.google.com/travel/flights"
    "?q=flights+from+denver+to+paris+september+2026"
)


async def scrape_flights() -> list[dict]:
    """
    Scrape Google Flights for DEN→CDG prices in September 2026.
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

            # Wait for flight results to render
            await asyncio.sleep(8)

            text = await page.evaluate("() => document.body.innerText")

            # Extract prices paired with trip type — Google renders "$927\nround trip" or "$927\none way"
            results = []
            for m in re.finditer(r'\$([0-9,]+)\s*\n?\s*(round trip|one way)', text, re.IGNORECASE):
                price = int(m.group(1).replace(',', ''))
                trip_type = m.group(2).strip().lower()
                if 300 <= price <= 5000:
                    results.append({"price": float(price), "details": {"route": "DEN→CDG", "month": "Sep 2026", "type": trip_type}})

            # Deduplicate by price
            seen = set()
            unique = []
            for r in results:
                if r["price"] not in seen:
                    seen.add(r["price"])
                    unique.append(r)

            logger.info(f"Google Flights: {len(unique)} unique prices found")
            for r in unique[:5]:
                logger.info(f"  ${r['price']:.0f} ({r['details']['type']})")

            return unique

        except Exception as e:
            logger.error(f"Google Flights scrape failed: {e}", exc_info=True)
            raise
        finally:
            await browser.close()
