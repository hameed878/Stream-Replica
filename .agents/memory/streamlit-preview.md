---
name: Streamlit preview startup
description: Streamlit workflows need headless mode in this environment to avoid blocking on the first-run email prompt.
---

Use `--server.headless true` in the workflow command for Streamlit apps.

**Why:** Without headless mode, the workflow can stop at Streamlit's interactive first-run email prompt and time out even though the app itself works locally.

**How to apply:** Include `--server.headless true` alongside the port and host flags when configuring a Streamlit preview workflow.