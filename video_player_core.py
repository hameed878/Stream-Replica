"""Shared HindiWeb scraper used by the desktop and Streamlit apps."""

from __future__ import annotations

import html
from dataclasses import dataclass
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup


SITE_URL = "https://hindiweb.com/"
REQUEST_TIMEOUT = 20
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/131.0 Safari/537.36"
)


@dataclass(frozen=True)
class Video:
    """A title and the iframe URL found on its detail page."""

    title: str
    url: str


def clean_text(value: str) -> str:
    """Normalize HTML text and remove accidental whitespace."""

    return " ".join(html.unescape(value).split())


def extract_iframe_url(player: BeautifulSoup, page_url: str) -> str | None:
    """Return the first usable iframe/embed URL inside a `.player` element."""

    for element in player.select("iframe, embed, video, source"):
        for attribute in ("src", "data-src", "data-url", "data-embed"):
            candidate = element.get(attribute)
            if candidate:
                return urljoin(page_url, candidate.strip())

    for attribute in ("data-src", "data-url", "data-embed"):
        candidate = player.get(attribute)
        if candidate:
            return urljoin(page_url, candidate.strip())

    return None


def fetch_dubbed_videos(
    site_url: str = SITE_URL,
    *,
    session: requests.Session | None = None,
) -> list[Video]:
    """Fetch the site and resolve every link containing `Dubbed`."""

    http = session or requests.Session()
    response = http.get(
        site_url,
        headers={"User-Agent": USER_AGENT},
        timeout=REQUEST_TIMEOUT,
    )
    response.raise_for_status()

    homepage = BeautifulSoup(response.text, "html.parser")
    videos: list[Video] = []
    seen_detail_urls: set[str] = set()

    for link in homepage.find_all("a", href=True):
        title = clean_text(link.get_text(" ", strip=True))
        href = urljoin(response.url, link["href"].strip())
        searchable_text = f"{title} {href}".casefold()

        if "dubbed" not in searchable_text or href in seen_detail_urls:
            continue
        if not href.startswith(("http://", "https://")):
            continue

        seen_detail_urls.add(href)

        try:
            detail_response = http.get(
                href,
                headers={"User-Agent": USER_AGENT},
                timeout=REQUEST_TIMEOUT,
            )
            detail_response.raise_for_status()
        except requests.RequestException:
            continue

        detail_page = BeautifulSoup(detail_response.text, "html.parser")
        player = detail_page.select_one("div.player, .player")
        if player is None:
            continue

        iframe_url = extract_iframe_url(player, detail_response.url)
        if iframe_url:
            videos.append(Video(title or href, iframe_url))

    return videos