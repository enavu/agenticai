"""Cyclebar workout history scraper using Playwright."""

import asyncio
import logging
from datetime import datetime
from playwright.async_api import async_playwright, Page, TimeoutError as PlaywrightTimeout

logger = logging.getLogger(__name__)

CYCLEBAR_LOGIN_URL = "https://members.cyclebar.com/auth/login"
ATTENDANCE_URL = "https://members.cyclebar.com/history/attendance"


async def scrape_workouts(username: str, password: str) -> list[dict]:
    """
    Log in to Cyclebar and scrape workout history from the Attendance tab.
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
        await page.wait_for_url("https://members.cyclebar.com/**", timeout=15_000)
        if "login" in page.url or "auth" in page.url:
            raise Exception("Still on login page after submit")
    except Exception:
        await page.wait_for_selector("nav", timeout=10_000)

    logger.info(f"Logged in, at: {page.url}")

    # Navigate directly to the unfiltered attendance page (all studios)
    await page.goto(ATTENDANCE_URL, wait_until="domcontentloaded", timeout=30_000)
    await page.wait_for_selector("nav", timeout=10_000)
    logger.info(f"Attendance page: {page.url}")

    # Wait for the attendance table to appear
    try:
        await page.wait_for_selector("tbody.rows-in tr, tr.no-animate", timeout=20_000)
    except PlaywrightTimeout:
        logger.warning("Attendance table not found within timeout")

    # Scroll to load all rows (infinite scroll)
    await _scroll_to_bottom(page)

    workouts = await _parse_attendance_table(page)
    logger.info(f"Scraped {len(workouts)} workouts")
    return workouts


async def _scroll_to_bottom(page: Page, max_rounds: int = 120) -> None:
    """
    Scroll by bringing the last table row into view, then waiting for
    React to lazy-load more rows. Stops when row count stops growing.
    """
    prev_count = 0
    stale_rounds = 0

    for _ in range(max_rounds):
        # Scroll the last row into view — this triggers React's IntersectionObserver
        row_count = await page.evaluate("""
            () => {
                const rows = document.querySelectorAll('tbody.rows-in tr, tr.no-animate');
                if (rows.length > 0) {
                    rows[rows.length - 1].scrollIntoView({ behavior: 'smooth', block: 'end' });
                }
                // Also scroll the window to the bottom for good measure
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                return rows.length;
            }
        """)
        await asyncio.sleep(1.5)

        if row_count == prev_count:
            stale_rounds += 1
            if stale_rounds >= 3:
                break  # No new rows after 3 consecutive rounds — we're done
        else:
            stale_rounds = 0
            logger.info(f"Scroll: {prev_count} → {row_count} rows")

        prev_count = row_count


async def _parse_attendance_table(page: Page) -> list[dict]:
    """
    Parse the attendance table using a single JS evaluation
    to avoid thousands of slow Playwright IPC calls.
    """
    rows_data = await page.evaluate("""
        () => {
            const rows = document.querySelectorAll('tbody.rows-in tr, tr.no-animate');
            return Array.from(rows).map(row => {
                const tds = row.querySelectorAll('td');
                if (tds.length < 6) return null;

                const classCell = tds[2];
                const strong = classCell.querySelector('strong');
                const subDiv = classCell.querySelector('div');
                const className = strong ? strong.innerText.trim() : '';
                const subtype = subDiv ? subDiv.innerText.trim() : '';

                const calsEl = tds[3].querySelector('h5.text-primary');
                const cals = calsEl ? calsEl.innerText.trim() : null;

                return {
                    date: tds[0].innerText.trim(),
                    time: tds[1].innerText.trim(),
                    class_name: subtype ? className + ' — ' + subtype : className,
                    cals: cals,
                    studio: tds[5].innerText.trim(),
                    instructor: tds[6].innerText.trim(),
                };
            }).filter(r => r !== null && r.class_name);
        }
    """)

    logger.info(f"Found {len(rows_data)} attendance rows")

    workouts = []
    for r in rows_data:
        try:
            workouts.append({
                "class_name": r["class_name"],
                "instructor": r["instructor"],
                "studio": r["studio"],
                "class_date": _parse_datetime(r["date"], r["time"]),
                "duration_minutes": 45,
                "cals_burned": int(r["cals"]) if r.get("cals") and r["cals"].isdigit() else None,
                "avg_output": None,
                "total_output": None,
                "rank": None,
            })
        except Exception as e:
            logger.debug(f"Skip row: {e}")
    return workouts


def _parse_datetime(date_str: str, time_str: str) -> str:
    """Parse '04/10/2026' + '12:30pm' → '2026-04-10T12:30:00'"""
    try:
        dt = datetime.strptime(f"{date_str} {time_str}", "%m/%d/%Y %I:%M%p")
        return dt.strftime("%Y-%m-%dT%H:%M:%S")
    except ValueError:
        pass
    try:
        dt = datetime.strptime(date_str, "%m/%d/%Y")
        return dt.strftime("%Y-%m-%dT%H:%M:%S")
    except ValueError:
        return datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
