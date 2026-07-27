"""Simple HindiWeb dubbed-video browser.

Install dependencies with:
    python -m pip install -r requirements.txt

Run with:
    python video_player_app.py
"""

from __future__ import annotations

import html
import queue
import threading
import webbrowser
from dataclasses import dataclass
from typing import Callable
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
import tkinter as tk
from tkinter import messagebox, ttk


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

    # Some sites lazy-load the iframe, so check common data attributes too.
    for element in player.select("iframe, embed, video, source"):
        for attribute in ("src", "data-src", "data-url", "data-embed"):
            candidate = element.get(attribute)
            if candidate:
                return urljoin(page_url, candidate.strip())

    # A few player templates place the URL on the container itself.
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
    """Fetch HindiWeb and resolve each link containing `Dubbed`.

    Links are matched by their visible text or href. Each matching link is
    treated as a detail page, and its first iframe URL inside `.player` is
    returned.
    """

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
            # One unavailable detail page should not prevent the rest from
            # appearing in the list.
            continue

        detail_page = BeautifulSoup(detail_response.text, "html.parser")
        player = detail_page.select_one("div.player, .player")
        if player is None:
            continue

        iframe_url = extract_iframe_url(player, detail_response.url)
        if iframe_url:
            videos.append(Video(title or href, iframe_url))

    return videos


class VideoPlayerApp(tk.Tk):
    """Tkinter UI for listing and opening the resolved video URLs."""

    def __init__(
        self,
        fetcher: Callable[[], list[Video]] = fetch_dubbed_videos,
    ) -> None:
        super().__init__()
        self.fetcher = fetcher
        self.videos: list[Video] = []
        self.results: queue.Queue[tuple[str, object]] = queue.Queue()

        self.title("Dubbed Video Player")
        self.geometry("720x500")
        self.minsize(520, 360)

        self._build_ui()
        self.after(100, self._process_results)
        self.load_videos()

    def _build_ui(self) -> None:
        outer = ttk.Frame(self, padding=14)
        outer.pack(fill=tk.BOTH, expand=True)
        outer.columnconfigure(0, weight=1)
        outer.rowconfigure(2, weight=1)

        heading = ttk.Label(
            outer,
            text="Dubbed videos",
            font=("TkDefaultFont", 16, "bold"),
        )
        heading.grid(row=0, column=0, sticky="w")

        controls = ttk.Frame(outer)
        controls.grid(row=1, column=0, sticky="ew", pady=(8, 10))
        controls.columnconfigure(0, weight=1)

        self.status = ttk.Label(
            controls,
            text="Fetching videos…",
            foreground="#555555",
        )
        self.status.grid(row=0, column=0, sticky="w")

        self.refresh_button = ttk.Button(
            controls,
            text="Refresh",
            command=self.load_videos,
        )
        self.refresh_button.grid(row=0, column=1, sticky="e")

        list_frame = ttk.Frame(outer)
        list_frame.grid(row=2, column=0, sticky="nsew")
        list_frame.columnconfigure(0, weight=1)
        list_frame.rowconfigure(0, weight=1)

        self.video_list = tk.Listbox(
            list_frame,
            activestyle="dotbox",
            exportselection=False,
            font=("TkDefaultFont", 11),
        )
        self.video_list.grid(row=0, column=0, sticky="nsew")

        scrollbar = ttk.Scrollbar(
            list_frame,
            orient=tk.VERTICAL,
            command=self.video_list.yview,
        )
        scrollbar.grid(row=0, column=1, sticky="ns")
        self.video_list.configure(yscrollcommand=scrollbar.set)
        self.video_list.bind("<<ListboxSelect>>", self.open_selected_video)

        hint = ttk.Label(
            outer,
            text="Click a title to open its video in your default web browser.",
            foreground="#555555",
        )
        hint.grid(row=3, column=0, sticky="w", pady=(10, 0))

    def load_videos(self) -> None:
        """Start a fetch without blocking Tkinter's event loop."""

        self.refresh_button.configure(state=tk.DISABLED)
        self.status.configure(text="Fetching videos…")
        self.video_list.delete(0, tk.END)

        thread = threading.Thread(target=self._fetch_in_background, daemon=True)
        thread.start()

    def _fetch_in_background(self) -> None:
        try:
            videos = self.fetcher()
        except requests.RequestException as error:
            self.results.put(("error", f"Could not fetch hindiweb.com:\n{error}"))
        except Exception as error:  # Keep unexpected parser errors visible.
            self.results.put(("error", f"Could not load videos:\n{error}"))
        else:
            self.results.put(("videos", videos))

    def _process_results(self) -> None:
        try:
            result_type, payload = self.results.get_nowait()
        except queue.Empty:
            self.after(100, self._process_results)
            return

        self.refresh_button.configure(state=tk.NORMAL)

        if result_type == "error":
            self.status.configure(text="Loading failed")
            messagebox.showerror("Video loading error", str(payload), parent=self)
        else:
            self.videos = list(payload)  # type: ignore[arg-type]
            for video in self.videos:
                self.video_list.insert(tk.END, video.title)
            self.status.configure(text=f"{len(self.videos)} dubbed video(s) found")

        self.after(100, self._process_results)

    def open_selected_video(self, _event: tk.Event[tk.Listbox]) -> None:
        selection = self.video_list.curselection()
        if not selection:
            return

        video = self.videos[selection[0]]
        if not webbrowser.open_new_tab(video.url):
            messagebox.showwarning(
                "Could not open browser",
                f"Open this URL manually:\n\n{video.url}",
                parent=self,
            )


if __name__ == "__main__":
    VideoPlayerApp().mainloop()