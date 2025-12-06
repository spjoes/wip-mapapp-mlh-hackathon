const AGENT_BASE_URL = 'https://x67fwrdyhpkt4c7tgysnlbxo.agents.do-ai.run';

// Read API key from environment variable
const apiKey = process.env.EXPO_PUBLIC_DO_AGENT_API_KEY || null;

export const hasApiKey = () => !!apiKey && apiKey !== 'your_do_agent_api_key_here';

interface AgentMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface AgentResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export const sendAgentMessage = async (
  systemPrompt: string,
  userMessage: string,
  locationContext?: { latitude: number; longitude: number },
  nearbyPlacesContext?: string
): Promise<AgentResponse> => {
  if (!apiKey) {
    return { success: false, error: 'API key not configured' };
  }

  try {
    // Build the messages array
    const messages: AgentMessage[] = [
      { role: 'system', content: systemPrompt },
    ];

    // Build contextual message with location and nearby places
    let contextualMessage = '';
    
    if (locationContext) {
      contextualMessage += `[USER LOCATION: ${locationContext.latitude.toFixed(6)}, ${locationContext.longitude.toFixed(6)}]\n\n`;
    }
    
    // Streamlined instructions - find venues quickly, coordinates will be geocoded after
    contextualMessage += `INSTRUCTIONS FOR FINDING PLACES:

Use ONE web_search to find real venues near the user that match your guide expertise.
Example search: "best speakeasies arcade bars quirky museums San Francisco"

GUIDE TYPES TO MATCH:
- Tech Guru: gaming cafes, VR arcades, hackerspaces, tech museums
- Night Owl: speakeasies, rooftop bars, jazz clubs, comedy clubs
- Local Oddball: weird museums, themed bars, escape rooms, oddity shops
- Historian: historical landmarks, heritage sites, museums
- Foodie: restaurants, food markets, local eateries
- Adventurer: outdoor activities, hiking spots, nature areas
- Architect: notable buildings, architectural landmarks
- Artist: galleries, murals, creative spaces
- Sports Buff: stadiums, sports bars, athletic venues

IMPORTANT:
- DO NOT search for coordinates - just provide approximate ones, we will verify them
- Focus on finding REAL venue names that match the guide types
- Do ONE comprehensive search, not multiple searches
- Respond quickly with 3-5 great recommendations

`;
    
    contextualMessage += userMessage;

    messages.push({ role: 'user', content: contextualMessage });

    // Try the standard OpenAI-compatible endpoint
    const url = `${AGENT_BASE_URL}/api/v1/chat/completions`;
    console.log('Calling agent API:', url);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        messages,
        stream: false,
        include_functions_info: true,  // Enable tool/function usage
        include_retrieval_info: true,  // Include retrieval info if agent has knowledge base
        include_guardrails_info: false,
      }),
    });

    console.log('Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Agent API error:', response.status, errorText);
      return { 
        success: false, 
        error: `API error: ${response.status} - ${errorText || 'No details'}` 
      };
    }

    const data = await response.json();
    console.log('Response data:', JSON.stringify(data, null, 2));
    
    const assistantMessage = data.choices?.[0]?.message?.content;

    if (assistantMessage && assistantMessage.trim().length > 0) {
      // Check if AI returned a search query instead of the expected output
      // This happens when the reasoning model gets stuck trying to call web_search
      const trimmed = assistantMessage.trim();
      if (trimmed.startsWith('{') && (
        trimmed.includes('"search_query"') || 
        trimmed.includes('"type": "search"') ||
        trimmed.includes('"type":"search"')
      )) {
        console.warn('AI returned search request instead of final output:', trimmed);
        
        // Check if web_search was actually called and returned results
        const functionDetails = data.functions?.function_details;
        if (functionDetails && functionDetails.length > 0) {
          // Web search was called - try to extract useful info from the search summary
          const lastSearch = functionDetails[functionDetails.length - 1];
          if (lastSearch?.result?.summary) {
            console.log('Using search summary as fallback:', lastSearch.result.summary);
            // Return the summary so the app can show something useful
            return { 
              success: false, 
              error: `Search results: ${lastSearch.result.summary}. Please try again - the AI couldn't complete the response.`
            };
          }
        }
        
        return { 
          success: false, 
          error: 'AI is trying to search. Please try again.' 
        };
      }
      
      return { success: true, message: assistantMessage };
    }

    // Check if the model got stuck in "reasoning" mode (empty content but has reasoning)
    const reasoningContent = data.choices?.[0]?.message?.reasoning_content;
    if (reasoningContent) {
      console.warn('AI returned reasoning but no final output - model stuck in thinking mode');
      
      // Check if web_search was called and has results we can use
      const functionDetails = data.functions?.function_details;
      if (functionDetails && functionDetails.length > 0) {
        const lastSearch = functionDetails[functionDetails.length - 1];
        if (lastSearch?.result?.summary) {
          return { 
            success: false, 
            error: `Search found: ${lastSearch.result.summary}. Please try again.`
          };
        }
      }
      
      return { 
        success: false, 
        error: 'AI is still thinking. Please try again.' 
      };
    }

    return { success: false, error: 'No response from agent' };
  } catch (error) {
    console.error('Agent API error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to connect to agent' 
    };
  }
};
