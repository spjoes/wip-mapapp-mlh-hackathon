import {
    AccentType,
    JourneyContent,
    JourneyStep,
    generateAIJourneyNarration,
    generateAIPlaceNarration,
    generateNarrationScript,
    getVoiceIdForAccent,
    hasElevenLabsApiKey,
    playAudio,
    stopAudio,
    textToSpeech
} from '@/services/audio-narration';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

// Re-export types for use in components
export type { JourneyContent, JourneyStep } from '@/services/audio-narration';

export interface UseAudioNarrationReturn {
  // State
  isPlaying: boolean;
  isLoading: boolean;
  currentPlayingId: string | null;
  selectedAccent: AccentType;
  isAccentPickerVisible: boolean;
  
  // Actions
  togglePlayback: (journeyContent: JourneyContent) => Promise<void>;
  togglePlacePlayback: (step: JourneyStep, placeNumber: number, placeId: string) => Promise<void>;
  setAccent: (accent: AccentType) => void;
  showAccentPicker: () => void;
  hideAccentPicker: () => void;
  stopPlayback: () => Promise<void>;
  
  // Utilities
  hasApiKey: boolean;
}

export const useAudioNarration = (): UseAudioNarrationReturn => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPlayingId, setCurrentPlayingId] = useState<string | null>(null);
  const [selectedAccent, setSelectedAccent] = useState<AccentType>('american');
  const [isAccentPickerVisible, setIsAccentPickerVisible] = useState(false);
  const [cachedAudio, setCachedAudio] = useState<{
    script: string;
    accent: AccentType;
    audioUri: string;
    id: string;
  } | null>(null);

  const hasApiKey = hasElevenLabsApiKey();

  const handlePlaybackComplete = useCallback(() => {
    setIsPlaying(false);
    setCurrentPlayingId(null);
  }, []);

  const stopPlayback = useCallback(async () => {
    await stopAudio();
    setIsPlaying(false);
    setCurrentPlayingId(null);
  }, []);

  const togglePlayback = useCallback(async (journeyContent: JourneyContent) => {
    const playbackId = 'full-journey';
    
    if (isPlaying && currentPlayingId === playbackId) {
      await stopPlayback();
      return;
    }

    // Stop any other playback first
    if (isPlaying) {
      await stopPlayback();
    }

    if (!hasApiKey) {
      console.error('ElevenLabs API key not configured');
      return;
    }

    // Check if we have cached audio for this journey and accent
    if (cachedAudio && 
        cachedAudio.accent === selectedAccent &&
        cachedAudio.id === playbackId) {
      setIsPlaying(true);
      setCurrentPlayingId(playbackId);
      const success = await playAudio(cachedAudio.audioUri, handlePlaybackComplete);
      if (!success) {
        setIsPlaying(false);
        setCurrentPlayingId(null);
      }
      return;
    }

    // Generate AI-powered narration and audio
    setIsLoading(true);
    setCurrentPlayingId(playbackId);
    
    // Use AI to generate richer narration content
    const script = await generateAIJourneyNarration(journeyContent);
    const result = await textToSpeech(script, selectedAccent);
    setIsLoading(false);

    if (result.success && result.audioUri) {
      setCachedAudio({ script, accent: selectedAccent, audioUri: result.audioUri, id: playbackId });
      setIsPlaying(true);
      const success = await playAudio(result.audioUri, handlePlaybackComplete);
      if (!success) {
        setIsPlaying(false);
        setCurrentPlayingId(null);
      }
    } else {
      setCurrentPlayingId(null);
      if (result.isRateLimited) {
        Alert.alert('Rate Limited', result.error || 'Please wait a moment and try again.');
      }
    }
  }, [isPlaying, currentPlayingId, hasApiKey, selectedAccent, cachedAudio, stopPlayback, handlePlaybackComplete]);

  const togglePlacePlayback = useCallback(async (step: JourneyStep, placeNumber: number, placeId: string) => {
    if (isPlaying && currentPlayingId === placeId) {
      await stopPlayback();
      return;
    }

    // Stop any other playback first
    if (isPlaying) {
      await stopPlayback();
    }

    if (!hasApiKey) {
      console.error('ElevenLabs API key not configured');
      return;
    }

    // Check if we have cached audio for this place and accent
    if (cachedAudio && 
        cachedAudio.accent === selectedAccent &&
        cachedAudio.id === placeId) {
      setIsPlaying(true);
      setCurrentPlayingId(placeId);
      const success = await playAudio(cachedAudio.audioUri, handlePlaybackComplete);
      if (!success) {
        setIsPlaying(false);
        setCurrentPlayingId(null);
      }
      return;
    }

    // Generate AI-powered narration and audio
    setIsLoading(true);
    setCurrentPlayingId(placeId);
    
    // Use AI to generate richer narration content about the place
    const script = await generateAIPlaceNarration(step, placeNumber);
    if (!script) {
      setIsLoading(false);
      setCurrentPlayingId(null);
      return;
    }
    
    const result = await textToSpeech(script, selectedAccent);
    setIsLoading(false);

    if (result.success && result.audioUri) {
      setCachedAudio({ script, accent: selectedAccent, audioUri: result.audioUri, id: placeId });
      setIsPlaying(true);
      const success = await playAudio(result.audioUri, handlePlaybackComplete);
      if (!success) {
        setIsPlaying(false);
        setCurrentPlayingId(null);
      }
    } else {
      setCurrentPlayingId(null);
      if (result.isRateLimited) {
        Alert.alert('Rate Limited', result.error || 'Please wait a moment and try again.');
      }
    }
  }, [isPlaying, currentPlayingId, hasApiKey, selectedAccent, cachedAudio, stopPlayback, handlePlaybackComplete]);

  const setAccent = useCallback((accent: AccentType) => {
    setSelectedAccent(accent);
    // Clear cache when accent changes so new audio is generated
    setCachedAudio(null);
  }, []);

  const showAccentPicker = useCallback(() => {
    setIsAccentPickerVisible(true);
  }, []);

  const hideAccentPicker = useCallback(() => {
    setIsAccentPickerVisible(false);
  }, []);

  return {
    isPlaying,
    isLoading,
    currentPlayingId,
    selectedAccent,
    isAccentPickerVisible,
    togglePlayback,
    togglePlacePlayback,
    setAccent,
    showAccentPicker,
    hideAccentPicker,
    stopPlayback,
    hasApiKey,
  };
};

// Export for testing
export { generateNarrationScript, getVoiceIdForAccent };

