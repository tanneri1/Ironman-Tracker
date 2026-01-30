export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'Groq API key not configured' });
    }

    try {
        const { image, mimeType } = req.body;

        if (!image) {
            return res.status(400).json({ error: 'Base64 image is required' });
        }

        const today = new Date().toISOString().split('T')[0];

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'meta-llama/llama-4-scout-17b-16e-instruct',
                messages: [
                    {
                        role: 'system',
                        content: `You are an expert at reading and parsing triathlon training schedules from images.
Extract all workout information you can see and return a JSON object.

Return ONLY valid JSON with this structure:
{
  "startDate": "YYYY-MM-DD or null",
  "endDate": "YYYY-MM-DD or null",
  "weeks": number or null,
  "workouts": [
    {
      "date": "YYYY-MM-DD",
      "discipline": "swim|bike|run|strength|brick|rest",
      "title": "Brief workout title",
      "description": "Full workout description",
      "duration": minutes as number or null,
      "distance": kilometers as number or null,
      "intensity": "easy|moderate|hard|race|recovery" or null
    }
  ]
}

Guidelines:
- Today's date is ${today}. Parse dates relative to today if only day names are given.
- Convert all distances to kilometers (1 mile = 1.60934 km).
- Convert all durations to minutes.
- Identify discipline from keywords: swim/pool, bike/cycle/ride, run/jog, weights/strength/gym.
- "Brick" means combined bike+run workout.
- Rest days should be included with discipline "rest".
- If you can't determine exact dates, estimate based on week structure starting from the nearest Monday.
- Return ONLY the JSON object, no markdown fences or other text.`
                    },
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: 'Read this training plan image and extract all workouts into the JSON format specified.'
                            },
                            {
                                type: 'image_url',
                                image_url: {
                                    url: `data:${mimeType || 'image/jpeg'};base64,${image}`
                                }
                            }
                        ]
                    }
                ],
                max_tokens: 4000,
                temperature: 0.2
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Groq API error:', data);
            return res.status(response.status).json({
                error: data.error?.message || 'Groq API request failed'
            });
        }

        const content = data.choices?.[0]?.message?.content;

        if (!content) {
            return res.status(500).json({ error: 'No response from AI' });
        }

        // Extract JSON from response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            return res.status(500).json({ error: 'Could not parse AI response as JSON' });
        }

        const schedule = JSON.parse(jsonMatch[0]);
        return res.status(200).json({ schedule });
    } catch (error) {
        console.error('Parse plan API error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
