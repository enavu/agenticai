"""Cyclebar scraper microservice — FastAPI + Playwright."""

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from pydantic_settings import BaseSettings

from scrapers.cyclebar import scrape_workouts

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
