# 🍷 Rich's Wine Sommelier

A personal wine guide and AI-powered bottle scanner built around a specific palate profile. Mobile-first PWA designed to be used in the wine store.

## Features

- **💬 Chat** — Interactive sommelier powered by Claude. Send bottle photos for instant palate-matched analysis, discuss what you're drinking, get recommendations.
- **🍇 Grapes** — Grape variety safety guide (always safe / depends / avoid)
- **🗺 Regions** — Region guide with goldmine zones, good bets, and splurge picks
- **🏰 Bordeaux** — Left Bank strategy with appellation rankings and vintage guide
- **🏷 Labels** — Label reading cheat sheet (green flags / red flags)
- **🗣 Scripts** — Conversation starters for the wine shop

## Architecture

```
src/
  palateConfig.js   ← YOUR PALATE DATA (update this as tastes evolve)
  systemPrompt.js   ← Builds AI prompt from palateConfig
  theme.js          ← Color palette
  ChatTab.jsx       ← Interactive sommelier chat component
  App.jsx           ← Main app with all tabs
  main.jsx          ← React entry point
```

## Updating Your Palate

The **only file you need to edit** as your tastes change is `src/palateConfig.js`. It contains:

- `PALATE_CORE` — Your core preferences, values, dislikes
- `GRAPE_GUIDE` — Grape variety safety ratings
- `REGIONS` — Region recommendations with tiers and prices
- `BORDEAUX_GUIDE` — Left Bank strategy
- `LABEL_TIPS` — Label reading flags
- `SHOP_SCRIPTS` — Wine shop conversation starters
- `TASTING_HISTORY` — Running log of wines you've tried

When you try a new wine, add it to `TASTING_HISTORY`. When a preference shifts, update the relevant section. The AI chat automatically picks up all changes.

## Setup

```bash
# Install dependencies
npm install

# Run locally
npm run dev

# Build for production
npm run build
```

## Deployment (Vercel)

1. Push to GitHub
2. Connect repo to [Vercel](https://vercel.com)
3. Add environment variable: `VITE_ANTHROPIC_API_KEY` = your Anthropic API key
4. Deploy — you'll get a URL like `wine-sommelier.vercel.app`
5. Add to your iPhone home screen for app-like experience

## API Key Note

The current implementation calls the Anthropic API directly from the browser for simplicity. For a production setup, you'd want to add a serverless API route (Vercel makes this easy with `/api` routes) to proxy the calls and keep your API key server-side. The reference tabs (grapes, regions, Bordeaux, labels, scripts) all work offline with no API needed.

## PWA

The app includes a `manifest.json` for PWA support. After deploying, you can add it to your home screen:

**iPhone:** Open in Safari → Share → Add to Home Screen
**Android:** Open in Chrome → Menu → Add to Home Screen

## Origin

Built from a deep wine education conversation covering palate profiling, grape variety science, regional terroir analysis, Bordeaux classification systems, label reading, and buying strategies. All data is personalized — this isn't a generic wine app.
