# AI Travel Guide Map App 🗺️

An Expo React Native app that provides AI-powered travel recommendations with interactive maps and itinerary planning.

## Features

- **AI Travel Guides** - Choose from three themed AI guides:

  - 🏛️ **The Historian** - History, landmarks, museums, and heritage sites
  - 🍽️ **Local Foodie** - Restaurants, cafés, street food, and culinary experiences
  - 🧭 **Adventure Scout** - Outdoor activities, hiking, nature, and adventure sports
- **Real Place Data** - Fetches nearby venues from Foursquare based on your location
- **Interactive Map** - View recommended places with numbered markers
- **Itinerary Builder** - Select places and build a drag-to-reorder itinerary
- **Route Planning** - See driving routes with duration and distance estimates

## Environment Variables

This app requires API keys to function. Create a `.env` file in the project root:

```env
# DigitalOcean AI Agent API Key
# Get this from your DigitalOcean console
EXPO_PUBLIC_DO_AGENT_API_KEY=your_do_agent_api_key_here

# Foursquare Places API Key
# Get this from https://foursquare.com/developers
EXPO_PUBLIC_FOURSQUARE_API_KEY=your_foursquare_api_key_here
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

- **Expo SDK 54** - React Native framework
- **Expo Router** - File-based navigation
- **React Native Maps** - Interactive maps
- **@gorhom/bottom-sheet** - Bottom sheet UI
- **react-native-draggable-flatlist** - Drag-to-reorder lists
- **OSRM** - Open source routing (no API key required)
