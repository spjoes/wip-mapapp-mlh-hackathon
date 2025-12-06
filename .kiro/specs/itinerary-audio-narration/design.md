# Design Document: Itinerary Audio Narration

## Overview

This feature adds audio narration capabilities to trip itineraries using text-to-speech (TTS) technology. Users can select from multiple accent options and control playback via a speaker button. The system generates a cohesive summary of journey content and plays it using realistic, natural-sounding voices.

## Architecture

The audio narration feature follows a modular architecture:

```
┌─────────────────────────────────────────────────────────┐
│                    UI Layer                              │
│  ┌─────────────────┐  ┌─────────────────────────────┐   │
│  │ Speaker Button  │  │ Accent Picker Modal         │   │
│  │ (Top Right)     │  │ (Selection UI)              │   │
│  └────────┬────────┘  └──────────────┬──────────────┘   │
└───────────┼──────────────────────────┼──────────────────┘
            │                          │
            ▼                          ▼
┌─────────────────────────────────────────────────────────┐
│                  Audio Hook Layer                        │
│  ┌─────────────────────────────────────────────────┐    │
│  │ useAudioNarration Hook                          │    │
│  │ - Manages playback state                        │    │
│  │ - Handles accent selection                      │    │
│  │ - Coordinates TTS service calls                 │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────┐
│                  Services Layer                          │
│  ┌─────────────────────┐  ┌─────────────────────────┐   │
│  │ TTS Service         │  │ Content Summarizer      │   │
│  │ (expo-speech)       │  │ (Journey → Script)      │   │
│  └─────────────────────┘  └─────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Accent Types and Configuration

```typescript
type AccentType = 'american' | 'australian' | 'british' | 'scottish' | 'other';

interface AccentConfig {
  id: AccentType;
  name: string;
  language: string;
  voiceIdentifier?: string; // Platform-specific voice ID
}

const ACCENT_OPTIONS: AccentConfig[] = [
  { id: 'american', name: 'American', language: 'en-US' },
  { id: 'australian', name: 'Australian', language: 'en-AU' },
  { id: 'british', name: 'British', language: 'en-GB' },
  { id: 'scottish', name: 'Scottish', language: 'en-GB' },
  { id: 'other', name: 'Other', language: 'en-US' },
];
```

### 2. Audio Narration Hook Interface

```typescript
interface UseAudioNarrationReturn {
  // State
  isPlaying: boolean;
  selectedAccent: AccentType;
  isAccentPickerVisible: boolean;
  
  // Actions
  togglePlayback: () => void;
  setAccent: (accent: AccentType) => void;
  showAccentPicker: () => void;
  hideAccentPicker: () => void;
  stopPlayback: () => void;
  
  // Content
  generateNarration: (journeyContent: JourneyContent) => string;
}
```

### 3. Speaker Button Component

```typescript
interface SpeakerButtonProps {
  isPlaying: boolean;
  onPress: () => void;
  onLongPress: () => void; // Opens accent picker
}
```

### 4. Accent Picker Modal Component

```typescript
interface AccentPickerProps {
  visible: boolean;
  selectedAccent: AccentType;
  onSelect: (accent: AccentType) => void;
  onClose: () => void;
}
```

## Data Models

### Playback State

```typescript
interface PlaybackState {
  isPlaying: boolean;
  currentAccent: AccentType;
  narrationText: string | null;
}
```

### Voice Mapping

The system maps accents to platform-specific voice identifiers:

| Accent     | iOS Voice          | Android Language |
|------------|-------------------|------------------|
| American   | en-US (Samantha)  | en-US            |
| Australian | en-AU (Karen)     | en-AU            |
| British    | en-GB (Daniel)    | en-GB            |
| Scottish   | en-GB (Moira)     | en-GB            |
| Other      | en-US (default)   | en-US            |

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Accent selection persistence
*For any* accent selection action, the selected accent state should equal the accent that was selected.
**Validates: Requirements 1.2**

### Property 2: Playback state toggle from stopped
*For any* stopped playback state, invoking togglePlayback should result in a playing state.
**Validates: Requirements 2.1**

### Property 3: Playback state toggle from playing
*For any* playing playback state, invoking togglePlayback should result in a stopped state.
**Validates: Requirements 2.2**

### Property 4: Exit journey stops playback
*For any* active playback state, exiting journey mode should result in stopped playback.
**Validates: Requirements 2.4**

### Property 5: Accent maps to correct voice
*For any* accent selection, the TTS service should receive the corresponding language code for that accent.
**Validates: Requirements 4.3**

### Property 6: Summary includes journey elements
*For any* journey content with title and introduction, the generated narration should contain both the title and introduction text.
**Validates: Requirements 5.1**

### Property 7: Summary includes fun facts
*For any* journey content with fun facts, the generated narration should include content from those fun facts.
**Validates: Requirements 5.2**

### Property 8: Multi-stop transitions
*For any* journey content with multiple stops, the generated narration should include transition phrases between stops.
**Validates: Requirements 5.3**

## Error Handling

| Error Scenario | Handling Strategy |
|----------------|-------------------|
| TTS not available | Show alert, disable speaker button |
| Voice not found | Fall back to default system voice |
| Playback interrupted | Reset to stopped state, clear resources |
| Empty journey content | Disable speaker button, show tooltip |

## Testing Strategy

### Property-Based Testing

The feature will use `fast-check` for property-based testing to verify correctness properties.

**Test Configuration:**
- Minimum 100 iterations per property test
- Tests tagged with format: `**Feature: itinerary-audio-narration, Property {number}: {property_text}**`

### Unit Tests

- Accent picker renders all 5 accent options
- Speaker button displays correct icon for playing/stopped states
- Default accent is American when none selected
- Content summarizer produces non-empty output for valid journey content

### Integration Tests

- Full flow: select accent → start playback → stop playback
- Accent change during playback updates subsequent audio
