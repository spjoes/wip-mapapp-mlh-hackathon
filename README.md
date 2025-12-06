# Detour

An Expo React Native app that provides AI-powered travel recommendations with interactive maps and itinerary planning. Pick from 9 distinct AI guide personalities—or combine multiple guides for hybrid recommendations.

## Features

- **9 AI Travel Guide Personalities** - Choose one or combine multiple guides:

  - 🏛️ **Historian** - Hidden stories & landmarks
  - 🍽️ **Foodie** - Authentic local flavors
  - 🧭 **Adventurer** - Thrills & nature pockets
  - 💻 **Tech Guru** - Innovation hubs & startups
  - 🏗️ **Architect** - Buildings & urban design
  - 🌙 **Night Owl** - Nightlife & late-night eats
  - 🎨 **Artist** - Murals & creative spaces
  - ✨ **Local Oddball** - Quirks & curiosities
  - 🏟️ **Sports Buff** - Stadiums & athletic history

- **Multi-Guide Selection** - Combine guides (e.g., Foodie + Historian) for blended recommendations
- **Real Place Data** - Fetches nearby venues from Foursquare Places API based on your location and guide type
- **Interactive Map** - View recommended places with numbered markers and route visualization
- **Itinerary Builder** - Select places and build a drag-to-reorder itinerary
- **Route Planning** - See walking routes with accurate distance-based time estimates
- **Journey Mode** - Web-searched fun facts for each stop (powered by Tavily) to ensure real, verified information

## Environment Variables

This app requires API keys to function. Create a `.env` file in the project root:

```env
# DigitalOcean AI Agent API Key
# Get this from your DigitalOcean console
EXPO_PUBLIC_DO_AGENT_API_KEY=your_do_agent_api_key_here

# Foursquare Places API Key
# Get this from https://foursquare.com/developers
EXPO_PUBLIC_FOURSQUARE_API_KEY=your_foursquare_api_key_here

# ElevenLabs API Key (optional)
# Get this from https://elevenlabs.io - Required for audio narration features
EXPO_PUBLIC_ELEVEN_LABS_API_KEY=your_eleven_labs_api_key_here
```

## Get Started

1. **Install dependencies**

   ```bash
   npm install
   ```
2. **Create your `.env` file** (see above)
3. **Start the app**

   ```bash
   npx expo start
   ```

   Or with tunnel for testing on physical devices:

   ```bash
   npx expo start --tunnel
   ```
4. **Open the app** using:

   - Expo Go app (scan QR code)
   - iOS Simulator
   - Android Emulator

## Tech Stack

- **React Native + Expo** - Cross-platform mobile app framework
- **DigitalOcean AI Agent** - Powers 9 guide personalities with web search capabilities for real-time fact verification
- **Foursquare Places API** - Fetches real, nearby venues based on location and guide type
- **OSRM (Open Source Routing Machine)** - Calculates walking routes with accurate distance-based time estimates
- **Tavily** - Web search for verified fun facts about each place
- **Expo Router** - File-based navigation
- **React Native Maps** - Interactive maps
