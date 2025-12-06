import { Audio } from 'expo-av';
import { sendAgentMessage } from './agent';

// Accent types and configuration
export type AccentType = 'american' | 'australian' | 'british' | 'scottish' | 'other';

export interface AccentConfig {
  id: AccentType;
  name: string;
  voiceId: string; // ElevenLabs voice ID
  description: string;
}

// ElevenLabs voice IDs mapped to accents
// Using high-quality multilingual voices
export const ACCENT_OPTIONS: AccentConfig[] = [
  { 
    id: 'american', 
    name: 'American', 
    voiceId: 'EXAVITQu4vr4xnSDxMaL', // Sarah - American female
    description: 'Friendly American accent'
  },
  { 
    id: 'australian', 
    name: 'Australian', 
    voiceId: 'XB0fDUnXU5powFXDhCwa', // Charlotte - Australian
    description: 'Warm Australian accent'
  },
  { 
    id: 'british', 
    name: 'British', 
    voiceId: 'pFZP5JQG7iQjIQuC4Bku', // Lily - British female
    description: 'Elegant British accent'
  },
  { 
    id: 'scottish', 
    name: 'Scottish', 
    voiceId: 'IKne3meq5aSn9XLyUdCD', // Charlie - Scottish
    description: 'Charming Scottish accent'
  },
  { 
    id: 'other', 
    name: 'Other', 
    voiceId: 'onwK4e9ZLuTAKqWW03F9', // Daniel - Versatile
    description: 'Neutral English accent'
  },
];

const ELEVEN_LABS_API_KEY = process.env.EXPO_PUBLIC_ELEVEN_LABS_API_KEY || '';
const ELEVEN_LABS_API_URL = 'https://api.elevenlabs.io/v1';

export const hasElevenLabsApiKey = () => 
  !!ELEVEN_LABS_API_KEY && ELEVEN_LABS_API_KEY !== 'your_eleven_labs_api_key_here';

export const getAccentConfig = (accent: AccentType): AccentConfig => {
  return ACCENT_OPTIONS.find(a => a.id === accent) || ACCENT_OPTIONS[0];
};

export const getVoiceIdForAccent = (accent: AccentType): string => {
  return getAccentConfig(accent).voiceId;
};

// Journey content types (matching app/index.tsx)
export interface JourneyStep {
  type: 'place' | 'walking';
  place?: {
    name: string;
    description: string;
    duration: string;
    price: string;
  };
  funFacts?: string[];
  connectionToNext?: string;
  fromPlace?: string;
  toPlace?: string;
  walkingDescription?: string;
  walkingTime?: string;
}

export interface JourneyContent {
  title: string;
  introduction: string;
  steps: JourneyStep[];
  totalTime: string;
}

/**
 * Uses AI to generate rich, detailed narration about a place
 * Instructs the agent to use web search for comprehensive information
 */
export const generateAIPlaceNarration = async (
  step: JourneyStep, 
  placeNumber: number
): Promise<string> => {
  if (step.type !== 'place' || !step.place) {
    return '';
  }

  const placeName = step.place.name;
  const description = step.place.description;
  const existingFacts = step.funFacts?.join('. ') || '';

  const prompt = `CRITICAL: You MUST use your web_search tool to look up detailed information about "${placeName}" BEFORE generating the narration. Do NOT rely only on your training data.

STEP 1: First, search for "${placeName}" to get:
- Its history and founding story
- Notable events and famous visitors
- Architectural or natural features
- Visitor tips and recommendations
- Cultural significance

STEP 2: After searching, generate a DETAILED tour guide narration (150-200 words minimum) that includes ALL of the following:

1. WELCOME: A warm, enthusiastic greeting to stop #${placeNumber}
2. HISTORY: When was it built/founded? By whom? Why? What's the story behind it?
3. SIGNIFICANCE: What makes this place famous or unique? Any notable events or famous people connected to it?
4. FEATURES: Describe the architecture, design, or natural beauty - what should visitors look at?
5. INSIDER TIPS: Best photo spots, hidden gems, what most tourists miss, best time to visit
6. EXPERIENCE: What's the atmosphere like? What do visitors typically feel or experience here?
7. RECOMMENDATIONS: What should they do while here? What's a must-see?

Context already shown to user (DO NOT REPEAT these):
- Description: ${description}
- Known facts: ${existingFacts || 'None'}
- Visit duration: ${step.place.duration}

IMPORTANT RULES:
- You MUST search first, then write
- Provide NEW information not listed above
- Write as a passionate local guide speaking to a friend
- Make it conversational and engaging, not like reading from Wikipedia
- Return ONLY the narration text - no JSON, no quotes, no formatting`;

  try {
    console.log('Generating AI narration for:', placeName);
    console.log('Step data:', JSON.stringify(step, null, 2));
    
    const response = await sendAgentMessage(
      'You are a passionate local tour guide with deep knowledge of destinations. You ALWAYS use web_search to look up accurate, detailed information before speaking. You share stories engagingly, like talking to a friend you want to impress with your knowledge.',
      prompt
    );

    console.log('AI response success:', response.success);
    console.log('AI response message length:', response.message?.length || 0);

    if (response.success && response.message) {
      // Clean up the response - remove any JSON formatting if present
      let narration = response.message.trim();
      // Remove quotes if wrapped
      if (narration.startsWith('"') && narration.endsWith('"')) {
        narration = narration.slice(1, -1);
      }
      // Remove any JSON-like formatting
      try {
        const parsed = JSON.parse(narration);
        if (typeof parsed === 'string') {
          narration = parsed;
        } else if (parsed.narration) {
          narration = parsed.narration;
        } else if (parsed.text) {
          narration = parsed.text;
        } else if (parsed.message) {
          narration = parsed.message;
        }
      } catch {
        // Not JSON, use as-is
      }
      
      console.log('Final narration length:', narration.length);
      console.log('Narration preview:', narration.substring(0, 200) + '...');
      
      // If narration is too short, it might be a failure - use fallback
      if (narration.length < 100) {
        console.log('Narration too short, using enhanced fallback');
        return generateEnhancedFallbackNarration(step, placeNumber);
      }
      
      return narration;
    } else {
      console.log('AI response failed:', response.error);
    }
  } catch (error) {
    console.error('AI narration generation failed:', error);
  }

  // Fallback to enhanced narration if AI fails
  console.log('Using fallback narration');
  return generateEnhancedFallbackNarration(step, placeNumber);
};

/**
 * Simple fallback narration script for a single place step
 */
export const generatePlaceNarrationScript = (step: JourneyStep, placeNumber: number): string => {
  if (step.type !== 'place' || !step.place) {
    return '';
  }
  
  const placeName = step.place.name;
  
  if (placeNumber === 1) {
    return `Welcome to your first stop, ${placeName}! Take your time exploring this wonderful destination.`;
  } else {
    return `Now we're at ${placeName}. Enjoy discovering what this place has to offer!`;
  }
};

/**
 * Enhanced fallback narration that uses all available context
 */
export const generateEnhancedFallbackNarration = (step: JourneyStep, placeNumber: number): string => {
  if (step.type !== 'place' || !step.place) {
    return '';
  }
  
  const { name, description, duration, price } = step.place;
  const funFacts = step.funFacts || [];
  const connectionToNext = step.connectionToNext;
  
  const parts: string[] = [];
  
  // Welcome
  if (placeNumber === 1) {
    parts.push(`Welcome to your first destination, ${name}!`);
  } else {
    parts.push(`Now let's explore ${name}, stop number ${placeNumber} on your journey.`);
  }
  
  // Description
  if (description) {
    parts.push(`This is ${description.toLowerCase()}.`);
  }
  
  // Duration and price context
  parts.push(`Plan to spend about ${duration} here.`);
  if (price && price !== 'Free') {
    parts.push(`Budget-wise, expect to spend around ${price}.`);
  } else if (price === 'Free') {
    parts.push(`The great news is that entry is free!`);
  }
  
  // Fun facts
  if (funFacts.length > 0) {
    parts.push(`Here's what makes this place special:`);
    funFacts.forEach((fact, index) => {
      if (index < 3) { // Limit to 3 facts
        parts.push(fact);
      }
    });
  }
  
  // Connection to next
  if (connectionToNext) {
    parts.push(connectionToNext);
  }
  
  // Closing
  parts.push(`Take your time to soak in the atmosphere and enjoy everything this place has to offer. When you're ready, we'll continue to the next stop.`);
  
  return parts.join(' ');
};


/**
 * Uses AI to generate a rich, detailed overview narration for the entire journey
 */
export const generateAIJourneyNarration = async (journey: JourneyContent): Promise<string> => {
  const placeSteps = journey.steps.filter(s => s.type === 'place');
  const placeNames = placeSteps.map(s => s.place?.name).filter(Boolean);
  const placeDescriptions = placeSteps.map(s => `${s.place?.name}: ${s.place?.description}`).join('; ');
  
  const prompt = `You are an enthusiastic and knowledgeable tour guide giving a detailed audio introduction to a journey called "${journey.title}".

The journey includes these destinations:
${placeNames.map((name, i) => `${i + 1}. ${name}`).join('\n')}

Place details: ${placeDescriptions}
Total time: ${journey.totalTime}
Number of stops: ${placeSteps.length}

Generate a DETAILED and engaging audio introduction (6-8 sentences, around 100-150 words) that includes:

1. A warm, enthusiastic welcome to the journey
2. The THEME or story that connects these places together
3. A PREVIEW of what makes each destination special (brief highlight for each)
4. Historical or cultural CONTEXT about the area they'll be exploring
5. What kind of EXPERIENCE awaits them - the atmosphere, the vibe
6. An exciting teaser about something unique they'll discover
7. Encouragement to enjoy and take their time

Make it sound like a passionate local guide who's excited to show them around.
Just return the narration text, nothing else - no JSON, no quotes.`;

  try {
    const response = await sendAgentMessage(
      'You are a passionate, knowledgeable local tour guide who loves sharing stories and getting travelers excited about their journey. You speak naturally and warmly.',
      prompt
    );

    if (response.success && response.message) {
      let narration = response.message.trim();
      if (narration.startsWith('"') && narration.endsWith('"')) {
        narration = narration.slice(1, -1);
      }
      // Remove any JSON-like formatting
      try {
        const parsed = JSON.parse(narration);
        if (typeof parsed === 'string') {
          narration = parsed;
        } else if (parsed.narration) {
          narration = parsed.narration;
        } else if (parsed.text) {
          narration = parsed.text;
        }
      } catch {
        // Not JSON, use as-is
      }
      return narration;
    }
  } catch (error) {
    console.error('AI journey narration generation failed:', error);
  }

  // Fallback
  return generateNarrationScript(journey);
};

/**
 * Simple fallback narration script from journey content
 */
export const generateNarrationScript = (journey: JourneyContent): string => {
  const placeSteps = journey.steps.filter(s => s.type === 'place');
  const placeCount = placeSteps.length;
  const placeNames = placeSteps.map(s => s.place?.name).filter(Boolean);
  
  let narration = `Welcome to ${journey.title}! `;
  narration += `Today's adventure takes you through ${placeCount} amazing destinations. `;
  
  if (placeNames.length > 0) {
    narration += `You'll be visiting ${placeNames.slice(0, 3).join(', ')}${placeNames.length > 3 ? ' and more' : ''}. `;
  }
  
  narration += `The whole journey takes about ${journey.totalTime}. Let's get started!`;
  
  return narration;
};

export interface TTSResult {
  success: boolean;
  audioUri?: string;
  error?: string;
  isRateLimited?: boolean;
}

/**
 * Converts text to speech using ElevenLabs API
 * Returns audio data as base64 or error info
 */
export const textToSpeech = async (
  text: string, 
  accent: AccentType
): Promise<TTSResult> => {
  if (!hasElevenLabsApiKey()) {
    console.error('ElevenLabs API key not configured');
    return { success: false, error: 'API key not configured' };
  }

  const voiceId = getVoiceIdForAccent(accent);
  
  try {
    const response = await fetch(
      `${ELEVEN_LABS_API_URL}/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': ELEVEN_LABS_API_KEY,
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.5,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs API error:', response.status, errorText);
      
      // Handle rate limiting (429)
      if (response.status === 429) {
        return { 
          success: false, 
          error: 'Rate limit exceeded. Please wait a moment and try again.',
          isRateLimited: true 
        };
      }
      
      // Handle quota exceeded
      if (response.status === 401 || errorText.includes('quota')) {
        return { 
          success: false, 
          error: 'API quota exceeded. Please check your ElevenLabs subscription.',
          isRateLimited: true 
        };
      }
      
      return { success: false, error: `API error: ${response.status}` };
    }

    // Convert response to base64
    const arrayBuffer = await response.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(arrayBuffer).reduce(
        (data, byte) => data + String.fromCharCode(byte),
        ''
      )
    );
    
    return { success: true, audioUri: `data:audio/mpeg;base64,${base64}` };
  } catch (error) {
    console.error('TTS error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'TTS failed' };
  }
};

// Audio playback management
let currentSound: Audio.Sound | null = null;

export const playAudio = async (
  audioUri: string,
  onComplete?: () => void
): Promise<boolean> => {
  try {
    // Stop any existing playback
    await stopAudio();
    
    // Configure audio mode
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
    });
    
    // Create and play sound
    const { sound } = await Audio.Sound.createAsync(
      { uri: audioUri },
      { shouldPlay: true },
      (status) => {
        if (status.isLoaded && status.didJustFinish) {
          onComplete?.();
        }
      }
    );
    
    currentSound = sound;
    return true;
  } catch (error) {
    console.error('Audio playback error:', error);
    return false;
  }
};

export const stopAudio = async (): Promise<void> => {
  if (currentSound) {
    try {
      await currentSound.stopAsync();
      await currentSound.unloadAsync();
    } catch (error) {
      console.error('Error stopping audio:', error);
    }
    currentSound = null;
  }
};

export const isAudioPlaying = async (): Promise<boolean> => {
  if (!currentSound) return false;
  try {
    const status = await currentSound.getStatusAsync();
    return status.isLoaded && status.isPlaying;
  } catch {
    return false;
  }
};
