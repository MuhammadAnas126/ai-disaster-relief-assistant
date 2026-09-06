"""Pakistan weather and earthquake monitoring with transparent alert thresholds."""
import asyncio
import json
import logging
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime
from datetime import datetime, timezone
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from app.routers.alerts import create_alert
from app.config import settings
from app.services.realtime import emit_weather_updated

logger = logging.getLogger(__name__)

PAKISTAN_CITIES = {
    "Islamabad": (33.6844, 73.0479),
    "Karachi": (24.8607, 67.0011),
    "Lahore": (31.5204, 74.3587),
    "Peshawar": (34.0151, 71.5249),
    "Quetta": (30.1798, 66.9750),
    "Multan": (30.1575, 71.5249),
}

_latest_snapshot: dict = {
    "country": "Pakistan",
    "updatedAt": None,
    "source": "Open-Meteo, USGS, and GDELT web search",
    "cities": [],
    "earthquakes": [],
    "warnings": [],
    "webReports": [],
    "status": "starting",
}


def _fetch_json(url: str) -> dict:
    request = Request(url, headers={"User-Agent": "AI-Disaster-Relief-Assistant/1.0"})
    with urlopen(request, timeout=15) as response:
        return json.loads(response.read().decode("utf-8"))


def _fetch_city_forecast(name: str, position: tuple[float, float]) -> dict:
    lat, lng = position
    params = urlencode({
        "latitude": lat,
        "longitude": lng,
        "forecast_days": 1,
        "current": "temperature_2m,precipitation,weather_code,wind_speed_10m",
        "hourly": "precipitation_probability,precipitation,weather_code,wind_speed_10m",
        "timezone": "Asia/Karachi",
    })
    data = _fetch_json(f"https://api.open-meteo.com/v1/forecast?{params}")
    current = data.get("current") or {}
    hourly = data.get("hourly") or {}
    precipitation = [float(value or 0) for value in (hourly.get("precipitation") or [])[:24]]
    rain_probability = [int(value or 0) for value in (hourly.get("precipitation_probability") or [])[:24]]
    wind = [float(value or 0) for value in (hourly.get("wind_speed_10m") or [])[:24]]
    weather_codes = [int(value or 0) for value in (hourly.get("weather_code") or [])[:24]]
    return {
        "name": name,
        "lat": lat,
        "lng": lng,
        "temperatureC": current.get("temperature_2m"),
        "precipitationMm": current.get("precipitation"),
        "weatherCode": current.get("weather_code"),
        "windKmh": current.get("wind_speed_10m"),
        "maxRainProbability": max(rain_probability, default=0),
        "maxRainMm": max(precipitation, default=0),
        "maxWindKmh": max(wind, default=0),
        "stormExpected": any(code in (95, 96, 99) for code in weather_codes),
    }


def _fetch_earthquakes() -> list[dict]:
    from datetime import timedelta

    start = datetime.now(timezone.utc) - timedelta(days=1)
    params = urlencode({
        "format": "geojson",
        "starttime": start.isoformat().replace("+00:00", "Z"),
        "minlatitude": 23,
        "maxlatitude": 37,
        "minlongitude": 60,
        "maxlongitude": 78,
        "minmagnitude": 4.5,
        "orderby": "time",
        "limit": 20,
    })
    data = _fetch_json(f"https://earthquake.usgs.gov/fdsnws/event/1/query?{params}")
    earthquakes = []
    for feature in data.get("features", []):
        properties = feature.get("properties") or {}
        coordinates = (feature.get("geometry") or {}).get("coordinates") or []
        if len(coordinates) < 2:
            continue
        earthquakes.append({
            "id": feature.get("id"),
            "magnitude": properties.get("mag"),
            "place": properties.get("place") or "Pakistan region",
            "time": datetime.fromtimestamp((properties.get("time") or 0) / 1000, timezone.utc).isoformat(),
            "lat": coordinates[1],
            "lng": coordinates[0],
            "url": properties.get("url"),
        })
    return earthquakes


def _fetch_web_reports() -> list[dict]:
    """Search recent public news for Pakistan disaster reports to verify."""
    query = 'Pakistan (flood OR earthquake OR cyclone OR landslide OR heatwave OR storm)'
    params = urlencode({
        "query": query,
        "mode": "artlist",
        "maxrecords": 10,
        "format": "json",
        "sort": "datedesc",
    })
    try:
        data = _fetch_json(f"https://api.gdeltproject.org/api/v2/doc/doc?{params}")
    except Exception:
        logger.warning("GDELT web search unavailable; falling back to Google News RSS")
        return _fetch_google_news_reports()
    reports = []
    topics = ("flood", "earthquake", "cyclone", "landslide", "heatwave", "storm")
    now = datetime.now(timezone.utc)
    for article in data.get("articles", []):
        title = str(article.get("title") or "").strip()
        url = str(article.get("url") or "").strip()
        if not title or not url:
            continue
        lowered = title.lower()
        matched_topics = [topic for topic in topics if topic in lowered]
        if not matched_topics:
            continue
        published_at = article.get("seendate") or None
        if isinstance(published_at, str) and len(published_at) == 14 and published_at.isdigit():
            published_at = datetime.strptime(published_at, "%Y%m%d%H%M%S").replace(tzinfo=timezone.utc).isoformat()
        if published_at:
            try:
                published_datetime = datetime.fromisoformat(published_at)
                if (now - published_datetime.astimezone(timezone.utc)).days > 7:
                    continue
            except ValueError:
                pass
        reports.append({
            "title": title,
            "url": url,
            "source": article.get("domain") or "Web report",
            "publishedAt": published_at,
            "matchedTopics": matched_topics,
        })
    return reports


def _fetch_google_news_reports() -> list[dict]:
    """Fallback web search using Google News RSS when GDELT is rate-limited."""
    query = urlencode({"q": "Pakistan flood earthquake cyclone landslide heatwave storm", "hl": "en-PK", "gl": "PK", "ceid": "PK:en"})
    request = Request(
        f"https://news.google.com/rss/search?{query}",
        headers={"User-Agent": "AI-Disaster-Relief-Assistant/1.0"},
    )
    with urlopen(request, timeout=15) as response:
        root = ET.fromstring(response.read())

    reports = []
    now = datetime.now(timezone.utc)
    for item in root.findall("./channel/item")[:10]:
        title = (item.findtext("title") or "").strip()
        url = (item.findtext("link") or "").strip()
        if not title or not url:
            continue
        published_at = item.findtext("pubDate")
        try:
            published_datetime = parsedate_to_datetime(published_at) if published_at else None
        except (TypeError, ValueError):
            published_datetime = None
        topics = [topic for topic in ("flood", "earthquake", "cyclone", "landslide", "heatwave", "storm") if topic in title.lower()]
        if "pakistan" not in title.lower() or not topics:
            continue
        if published_datetime and (now - published_datetime.astimezone(timezone.utc)).days > 7:
            continue
        source = item.find("source")
        reports.append({
            "title": title,
            "url": url,
            "source": (source.text or "Google News") if source is not None else "Google News",
            "publishedAt": published_at,
            "matchedTopics": topics,
        })
    return reports


def _build_warnings(cities: list[dict], earthquakes: list[dict]) -> list[dict]:
    warnings: list[dict] = []
    for city in cities:
        name = city["name"]
        if city["stormExpected"] or city["maxRainMm"] >= 30:
            warnings.append({"level": "warning", "type": "storm", "location": name, "message": f"Severe rain or thunderstorms possible near {name} in the next 24 hours."})
        elif city["maxRainProbability"] >= 70 and city["maxRainMm"] >= 10:
            warnings.append({"level": "info", "type": "rain", "location": name, "message": f"Heavy rain is possible near {name} in the next 24 hours."})
        if city["maxWindKmh"] >= 60:
            warnings.append({"level": "warning", "type": "wind", "location": name, "message": f"Strong winds up to {round(city['maxWindKmh'])} km/h are possible near {name}."})
        if isinstance(city["temperatureC"], (int, float)) and city["temperatureC"] >= 45:
            warnings.append({"level": "critical", "type": "heat", "location": name, "message": f"Extreme heat is currently reported near {name}: {round(city['temperatureC'])}°C."})
    for earthquake in earthquakes:
        magnitude = float(earthquake.get("magnitude") or 0)
        if magnitude >= 5.5:
            warnings.append({"level": "critical", "type": "earthquake", "location": earthquake["place"], "message": f"Magnitude {magnitude:.1f} earthquake detected in the Pakistan region. Check official guidance and avoid damaged structures."})
        else:
            warnings.append({"level": "warning", "type": "earthquake", "location": earthquake["place"], "message": f"Magnitude {magnitude:.1f} earthquake detected in the Pakistan region. Monitor official updates."})
    return warnings


async def refresh_weather_snapshot() -> dict:
    global _latest_snapshot
    try:
        cities = await asyncio.gather(*(
            asyncio.to_thread(_fetch_city_forecast, name, position)
            for name, position in PAKISTAN_CITIES.items()
        ))
        earthquakes = await asyncio.to_thread(_fetch_earthquakes)
        try:
            web_reports = await asyncio.to_thread(_fetch_web_reports)
        except Exception:
            logger.exception("Web disaster report search failed")
            web_reports = []
        warnings = _build_warnings(cities, earthquakes)
        _latest_snapshot = {
            "country": "Pakistan",
            "updatedAt": datetime.now(timezone.utc).isoformat(),
            "source": "Open-Meteo, USGS, and GDELT web search",
            "cities": cities,
            "earthquakes": earthquakes,
            "warnings": warnings,
            "webReports": web_reports,
            "status": "ok",
        }
        await emit_weather_updated(_latest_snapshot)
        for warning in warnings:
            await create_alert(
                warning["level"],
                f"Automated Pakistan weather monitor: {warning['message']}",
                sent_by="Pakistan Weather Monitor",
                dedup_key=f"{warning['type']}:{warning['location']}:{warning['message']}",
            )
    except Exception:
        logger.exception("Pakistan weather monitor refresh failed")
        _latest_snapshot = {**_latest_snapshot, "status": "error", "updatedAt": datetime.now(timezone.utc).isoformat()}
    return _latest_snapshot


def get_weather_snapshot() -> dict:
    return _latest_snapshot


async def weather_monitor_loop() -> None:
    await refresh_weather_snapshot()
    while True:
        await asyncio.sleep(settings.WEATHER_POLL_INTERVAL_SECONDS)
        await refresh_weather_snapshot()
