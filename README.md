# DailySpace

A personal project hub that works like a desktop OS — draggable project folders, web-link shortcuts, and smart widgets (Calls, Reading, Thinking, Writing) that collect tagged items across all projects.

## Features

- **Desktop metaphor**: projects are draggable icons; single click opens them in a macOS-style window (minimize, full screen, close)
- **Per-project space**: major focus banner, goals, tasks, and notes with autosave
- **Tagged items**: tag tasks as call/read and goals as think/write — they surface in the matching desktop widget with badges
- **Web links**: favicon shortcuts on the desktop with an open-confirmation dialog
- **Time progress bar**: day/week/month/quarter/year elapsed-time meter for a sense of urgency, collapsible from the menu bar
- **Dark glass design**: frosted surfaces over a black gradient, live digital clock

## Running locally

No build step, no dependencies:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

Or just open `index.html` in a browser.

## Tech

Vanilla HTML/CSS/JS. Data persists in `localStorage` — the `Store` object in `app.js` is the single swap point for a future database/API.
