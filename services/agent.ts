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
    
    if (nearbyPlacesContext && nearbyPlacesContext !== 'No nearby places found.') {
      contextualMessage += `[NEARBY PLACES FROM DATABASE - STRONGLY PREFER these places and use their EXACT coordinates:]
${nearbyPlacesContext}

IMPORTANT INSTRUCTIONS:
1. FIRST, look through the places above and pick ones that match your guide expertise
2. Use the EXACT coordinates provided - do NOT make up coordinates
3. If the list above doesn't have good matches for your guide type(s), you MUST use your web_search tool to find appropriate real venues near the user's location
4. NEVER recommend generic/famous landmarks unless they truly fit the guide personalities selected
5. Each recommended place MUST align with at least one of the selected guide types

`;
    } else {
      // No places found from Foursquare - instruct AI to use web search
      contextualMessage += `[NO PLACES FOUND IN DATABASE]
You MUST use your web_search tool to find real venues near the user's location that match your guide expertise.
Search for specific venue types that fit your guide personality. Get real names, addresses, and coordinates.
Do NOT make up places or use generic famous landmarks.

`;
    }
    
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

    if (assistantMessage) {
      return { success: true, message: assistantMessage };
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
