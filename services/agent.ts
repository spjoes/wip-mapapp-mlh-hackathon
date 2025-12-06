const AGENT_BASE_URL = 'https://x67fwrdyhpkt4c7tgysnlbxo.agents.do-ai.run';

let apiKey: string | null = null;

export const setAgentApiKey = (key: string) => {
  apiKey = key;
};

export const getAgentApiKey = () => apiKey;

export const hasApiKey = () => !!apiKey;

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
  locationContext?: { latitude: number; longitude: number }
): Promise<AgentResponse> => {
  if (!apiKey) {
    return { success: false, error: 'API key not configured' };
  }

  try {
    // Build the messages array
    const messages: AgentMessage[] = [
      { role: 'system', content: systemPrompt },
    ];

    // Add location context if available
    let contextualMessage = userMessage;
    if (locationContext) {
      contextualMessage = `[User's current location: ${locationContext.latitude.toFixed(6)}, ${locationContext.longitude.toFixed(6)}]\n\n${userMessage}`;
    }

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
        include_functions_info: false,
        include_retrieval_info: false,
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
