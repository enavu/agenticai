"""Cyclebar scraper microservice — FastAPI + Playwright."""

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from pydantic_settings import BaseSettings

from scrapers.cyclebar import scrape_workouts
from scrapers.kayak_flights import scrape_flights
from scrapers.stubhub_tickets import scrape_tickets
from scrapers.baltimore_flights import scrape_baltimore_flights
from scrapers.lasvegas_flights import scrape_lasvegas_flights
from scrapers.lisa_tickets import scrape_lisa_tickets

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    cyclebar_username: str = ""
    cyclebar_password: str = ""

    class Config:
        env_file = ".env"


settings = Settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Scraper service starting up")
    yield
    logger.info("Scraper service shutting down")


app = FastAPI(title="enavu-hub scraper", version="1.0.0", lifespan=lifespan)


class WorkoutOut(BaseModel):
    class_date: str
    class_name: str
    instructor: str
    studio: str
    duration_minutes: int
    cals_burned: int | None = None
    avg_output: int | None = None
    total_output: int | None = None
    rank: str | None = None


class ScrapeResponse(BaseModel):
    workouts: list[WorkoutOut]
    error: str | None = None


class PriceResult(BaseModel):
    price: float
    details: dict = {}


class TravelScrapeResponse(BaseModel):
    prices: list[PriceResult]
    error: str | None = None


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "cyclebar_credentials_configured": bool(
            settings.cyclebar_username and settings.cyclebar_password
        ),
    }


@app.post("/scrape/cyclebar", response_model=ScrapeResponse)
async def scrape_cyclebar():
    if not settings.cyclebar_username or not settings.cyclebar_password:
        raise HTTPException(
            status_code=400,
            detail="CYCLEBAR_USERNAME and CYCLEBAR_PASSWORD must be set",
        )

    try:
        logger.info(f"Starting Cyclebar scrape for {settings.cyclebar_username}")
        raw_workouts = await scrape_workouts(
            settings.cyclebar_username,
            settings.cyclebar_password,
        )
        workouts = [WorkoutOut(**w) for w in raw_workouts]
        logger.info(f"Scrape complete: {len(workouts)} workouts")
        return ScrapeResponse(workouts=workouts)

    except Exception as e:
        logger.error(f"Scrape failed: {e}", exc_info=True)
        return ScrapeResponse(workouts=[], error=str(e))


@app.post("/scrape/flights", response_model=TravelScrapeResponse)
async def scrape_flights_endpoint():
    try:
        logger.info("Starting Kayak flight scrape")
        raw = await scrape_flights()
        prices = [PriceResult(**p) for p in raw]
        logger.info(f"Flight scrape complete: {len(prices)} results")
        return TravelScrapeResponse(prices=prices)
    except Exception as e:
        logger.error(f"Flight scrape failed: {e}", exc_info=True)
        return TravelScrapeResponse(prices=[], error=str(e))


@app.post("/scrape/flights/baltimore", response_model=TravelScrapeResponse)
async def scrape_baltimore_flights_endpoint():
    try:
        logger.info("Starting Baltimore flight scrape")
        raw = await scrape_baltimore_flights()
        prices = [PriceResult(**p) for p in raw]
        logger.info(f"Baltimore flight scrape complete: {len(prices)} results")
        return TravelScrapeResponse(prices=prices)
    except Exception as e:
        logger.error(f"Baltimore flight scrape failed: {e}", exc_info=True)
        return TravelScrapeResponse(prices=[], error=str(e))


@app.post("/scrape/flights/lasvegas", response_model=TravelScrapeResponse)
async def scrape_lasvegas_flights_endpoint():
    try:
        logger.info("Starting Las Vegas flight scrape")
        raw = await scrape_lasvegas_flights()
        prices = [PriceResult(**p) for p in raw]
        logger.info(f"Las Vegas flight scrape complete: {len(prices)} results")
        return TravelScrapeResponse(prices=prices)
    except Exception as e:
        logger.error(f"Las Vegas flight scrape failed: {e}", exc_info=True)
        return TravelScrapeResponse(prices=[], error=str(e))


@app.post("/scrape/tickets/lisa", response_model=TravelScrapeResponse)
async def scrape_lisa_tickets_endpoint():
    try:
        logger.info("Starting Lisa StubHub scrape")
        raw = await scrape_lisa_tickets()
        prices = [PriceResult(**p) for p in raw]
        logger.info(f"Lisa ticket scrape complete: {len(prices)} results")
        return TravelScrapeResponse(prices=prices)
    except Exception as e:
        logger.error(f"Lisa ticket scrape failed: {e}", exc_info=True)
        return TravelScrapeResponse(prices=[], error=str(e))


@app.post("/scrape/tickets", response_model=TravelScrapeResponse)
async def scrape_tickets_endpoint():
    try:
        logger.info("Starting StubHub ticket scrape")
        raw = await scrape_tickets()
        prices = [PriceResult(**p) for p in raw]
        logger.info(f"Ticket scrape complete: {len(prices)} results")
        return TravelScrapeResponse(prices=prices)
    except Exception as e:
        logger.error(f"Ticket scrape failed: {e}", exc_info=True)
        return TravelScrapeResponse(prices=[], error=str(e))
