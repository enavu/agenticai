"""Cyclebar workout history scraper using Playwright."""

import os
import asyncio
import logging
from datetime import datetime
from typing import Optional
from playwright.async_api import async_playwright, Page, TimeoutError as PlaywrightTimeout

logger = logging.getLogger(__name__)

CYCLEBAR_LOGIN_URL = "https://members.cyclebar.com/auth/login"
CYCLEBAR_HISTORY_URLS = [
    "https://members.cyclebar.com/profile/history",
    "https://members.cyclebar.com/profile/class-history",
    "https://members.cyclebar.com/profile",
    "https://members.cyclebar.com/my-account/class-history",
    "https://members.cyclebar.com/my-account",
]


async def scrape_workouts(username: str, password: str) -> list[dict]:
    """
    Log in to Cyclebar and scrape workout history.
    Returns a list of workout dicts.
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
            viewport={"width": 1280, "height": 800},
        )
        page = await context.new_page()

        try:
            workouts = await _do_scrape(page, username, password)
            return workouts
        finally:
            await browser.close()


async def _do_scrape(page: Page, username: str, password: str) -> list[dict]:
    logger.info("Navigating to Cyclebar login page")
    await page.goto(CYCLEBAR_LOGIN_URL, wait_until="networkidle", timeout=30_000)

    # Accept cookies if present
    try:
        await page.click("button[id*='accept']", timeout=3_000)
    except PlaywrightTimeout:
        pass

    # Fill login form
    logger.info("Filling login form")
    await page.fill("input[type='email'], input[name='email'], input[placeholder*='email' i]", username)
    await page.fill("input[type='password']", password)
    await page.click("button[type='submit'], button:has-text('Sign In'), button:has-text('Log In')")

    # Wait for redirect after login
    try:
        await page.wait_for_url("**/profile**", timeout=15_000)
    except PlaywrightTimeout:
        try:
            await page.wait_for_url("**/dashboard**", timeout=10_000)
        except PlaywrightTimeout:
            await page.wait_for_selector("[class*='profile'], [class*='dashboard'], nav", timeout=10_000)

    logger.info("Logged in, finding class history page")
    for url in CYCLEBAR_HISTORY_URLS:
        await page.goto(url, wait_until="networkidle", timeout=20_000)
        current = page.url
        logger.info(f"Tried {url} → landed on {current}")
        # If we got redirected back to login, try next
        if "login" in current or "auth" in current:
            continue
        # Check if page has any ride/class history content
        body = await page.inner_text("body")
        if any(kw in body.lower() for kw in ["class history", "past classes", "completed", "ride", "performance", "classic"]):
            logger.info(f"Found history content at {current}")
            break
    logger.info(f"Scraping history from: {page.url}")

    # Scroll to load all content
    await _scroll_to_bottom(page)

    workouts = await _parse_workouts(page)
    logger.info(f"Scraped {len(workouts)} workouts")
    return workouts


async def _scroll_to_bottom(page: Page, max_scrolls: int = 20) -> None:
    for _ in range(max_scrolls):
        prev_height = await page.evaluate("document.body.scrollHeight")
        await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        await asyncio.sleep(1.0)
        new_height = await page.evaluate("document.body.scrollHeight")
        if new_height == prev_height:
            break

    # Also click "Load More" buttons if present
    for _ in range(10):
        try:
            btn = page.locator("button:has-text('Load More'), button:has-text('Show More')")
            if await btn.count() > 0:
                await btn.first.click()
                await asyncio.sleep(1.5)
            else:
                break
        except Exception:
            break


async def _parse_workouts(page: Page) -> list[dict]:
    """
    Parse workout cards from the page.
    Cyclebar's markup may vary — this targets common patterns and falls back gracefully.
    """
    workouts = []

    # Strategy 1: Look for class history rows / cards
    selectors_to_try = [
        "[class*='class-history'] [class*='row']",
        "[class*='ClassHistory'] li",
        "[data-testid*='class-item']",
        "[class*='workout-item']",
        ".history-item",
        "tr[class*='class']",
    ]

    rows = None
    for selector in selectors_to_try:
        try:
            count = await page.locator(selector).count()
            if count > 0:
                rows = page.locator(selector)
                logger.info(f"Found {count} rows with selector: {selector}")
                break
        except Exception:
            continue

    if rows is None:
        # Fallback: grab all text and do best-effort parse
        logger.warning("Could not find structured workout rows, using fallback text parse")
        return await _fallback_parse(page)

    count = await rows.count()
    for i in range(count):
        row = rows.nth(i)
        try:
            workout = await _parse_row(row)
            if workout:
                workouts.append(workout)
        except Exception as e:
            logger.debug(f"Skip row {i}: {e}")
            continue

    return workouts


async def _parse_row(row) -> Optional[dict]:
    """Extract workout data from a single row/card element."""
    text = await row.inner_text()
    if not text.strip():
        return None

    workout = {
        "class_name": "",
        "instructor": "",
        "studio": "",
        "class_date": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
        "duration_minutes": 45,
        "cals_burned": None,
        "avg_output": None,
        "total_output": None,
        "rank": None,
    }

    # Try to get structured data from attributes
    lines = [l.strip() for l in text.split("\n") if l.strip()]

    for line in lines:
        lower = line.lower()
        # Date patterns
        for fmt in ["%B %d, %Y", "%m/%d/%Y", "%Y-%m-%d"]:
            try:
                dt = datetime.strptime(line, fmt)
                workout["class_date"] = dt.strftime("%Y-%m-%dT%H:%M:%S")
                break
            except ValueError:
                pass

        if "instructor" in lower or "with " in lower:
            workout["instructor"] = line.replace("Instructor:", "").replace("With ", "").strip()

        if "studio" in lower or "location" in lower:
            workout["studio"] = line.replace("Studio:", "").replace("Location:", "").strip()

        if "cal" in lower:
            import re
            nums = re.findall(r"\d+", line)
            if nums:
                workout["cals_burned"] = int(nums[0])

        if "output" in lower:
            import re
            nums = re.findall(r"\d+", line)
            if nums:
                workout["avg_output"] = int(nums[0])

        if "rank" in lower:
            workout["rank"] = line

        if "min" in lower:
            import re
            nums = re.findall(r"\d+", line)
            if nums:
                workout["duration_minutes"] = int(nums[0])

    # If class_name is still empty, use first non-date line
    if not workout["class_name"] and lines:
        workout["class_name"] = lines[0]

    return workout if workout["class_name"] else None


async def _fallback_parse(page: Page) -> list[dict]:
    """Last-resort text extraction — returns minimal workout records."""
    import re
    text = await page.inner_text("body")

    # Look for date patterns to delineate workouts
    date_pattern = re.compile(
        r"(January|February|March|April|May|June|July|August|September|October|November|December)"
        r"\s+\d{1,2},\s+\d{4}"
    )

    workouts = []
    matches = list(date_pattern.finditer(text))

    for i, match in enumerate(matches):
        start = match.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else start + 300
        snippet = text[start:end].strip()

        try:
            dt = datetime.strptime(match.group(), "%B %d, %Y")
            workouts.append({
                "class_name": "Cyclebar Ride",
                "instructor": "",
                "studio": "",
                "class_date": dt.strftime("%Y-%m-%dT%H:%M:%S"),
                "duration_minutes": 45,
                "cals_burned": None,
                "avg_output": None,
                "total_output": None,
                "rank": None,
            })
        except ValueError:
            continue

    return workouts
