"""Browser-previewable Streamlit version of the dubbed video player."""

from __future__ import annotations

import streamlit as st
from requests import RequestException

from video_player_core import SITE_URL, Video, fetch_dubbed_videos


st.set_page_config(page_title="Dubbed Video Player", page_icon="▶️")

st.title("Dubbed Video Player")
st.write(
    "Browse titles containing **Dubbed** from "
    f"[HindiWeb]({SITE_URL}) and open a video in a new browser tab."
)

if st.button("Refresh videos", type="primary"):
    st.cache_data.clear()
    st.rerun()


@st.cache_data(ttl=300, show_spinner="Fetching dubbed videos from HindiWeb…")
def load_videos() -> list[Video]:
    return fetch_dubbed_videos()


try:
    videos = load_videos()
except RequestException as error:
    st.error(f"Could not fetch HindiWeb: {error}")
    st.info("Check the network connection and try refreshing.")
except Exception as error:
    st.error(f"Could not load videos: {error}")
else:
    if not videos:
        st.warning(
            "No dubbed videos were found. The website may have changed its "
            "HTML structure or may be temporarily unavailable."
        )
    else:
        st.caption(f"{len(videos)} dubbed video(s) found")
        for index, video in enumerate(videos, start=1):
            st.link_button(
                f"{index}. {video.title}",
                video.url,
                use_container_width=True,
            )