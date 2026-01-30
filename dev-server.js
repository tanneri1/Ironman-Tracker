const http = require('http');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const PORT = 3001;
const ROOT = __dirname;

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

async function handleCoachAPI(req, res) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'GROQ_API_KEY not set in .env' }));
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
        try {
            const { messages } = JSON.parse(body);

            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'llama-3.3-70b-versatile',
                    messages,
                    max_tokens: 500,
                    temperature: 0.7
                })
            });

            const data = await response.json();

            if (!response.ok) {
                console.error('Groq API error:', data);
                res.writeHead(response.status, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: data.error?.message || 'Groq API error' }));
            }

            const content = data.choices?.[0]?.message?.content;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ content }));
        } catch (error) {
            console.error('Coach API error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error' }));
        }
    });
}

async function handleParsePlanAPI(req, res) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'GROQ_API_KEY not set in .env' }));
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
        try {
            const { images, startDate, raceDate, weeks } = JSON.parse(body);

            if (!images || images.length === 0) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'At least one image is required' }));
            }

            const planStartDate = startDate || new Date().toISOString().split('T')[0];
            const planWeeks = weeks || null;
            const planRaceDate = raceDate || null;

            // Build user content with all images
            const userContent = [
                {
                    type: 'text',
                    text: images.length > 1
                        ? `These ${images.length} images are consecutive pages of the same ${planWeeks ? planWeeks + '-week ' : ''}training plan. Read ALL images together and extract every workout into the JSON format specified. Week 1 starts on ${planStartDate}${planRaceDate ? '. The race is on ' + planRaceDate : ''}.`
                        : `Read this ${planWeeks ? planWeeks + '-week ' : ''}training plan image and extract all workouts into the JSON format specified. Week 1 starts on ${planStartDate}${planRaceDate ? '. The race is on ' + planRaceDate : ''}.`
                },
                ...images.map(img => ({
                    type: 'image_url',
                    image_url: {
                        url: `data:${img.mimeType || 'image/jpeg'};base64,${img.data}`
                    }
                }))
            ];

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
If multiple images are provided, they are consecutive pages of the SAME training plan — combine all workouts into one list with sequential dates (do NOT restart week numbering for each image).

${planWeeks ? `IMPORTANT: This is a ${planWeeks}-week plan. It must contain exactly ${planWeeks} weeks of workouts, from Week 1 through Week ${planWeeks}.` : ''}

Return ONLY valid JSON with this structure:
{
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
- Week 1, Day 1 (Monday) is ${planStartDate}. All dates must be calculated from this anchor.
- Week 1 = ${planStartDate} through the following Sunday. Week 2 starts the next Monday, and so on.${planRaceDate ? `\n- The race/event is on ${planRaceDate} (the final week). The last workout should be on or before this date.` : ''}
- If the plan labels weeks (Week 1, Week 2, etc.), map them directly: Week 1 starts on ${planStartDate}, Week 2 starts 7 days later, etc.
- If multiple images show different weeks, continue the date sequence across images (do NOT restart from Week 1).
- Convert all distances to kilometers (1 mile = 1.60934 km).
- Convert all durations to minutes.
- Identify discipline from keywords: swim/pool, bike/cycle/ride, run/jog, weights/strength/gym.
- "Brick" means combined bike+run workout.
- Rest days should be included with discipline "rest".
- Return ONLY the JSON object, no markdown fences or other text.`
                        },
                        {
                            role: 'user',
                            content: userContent
                        }
                    ],
                    max_tokens: 8000,
                    temperature: 0.1
                })
            });

            const data = await response.json();

            if (!response.ok) {
                console.error('Groq API error:', data);
                res.writeHead(response.status, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: data.error?.message || 'Groq API error' }));
            }

            const content = data.choices?.[0]?.message?.content;
            if (!content) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'No response from AI' }));
            }

            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Could not parse AI response as JSON' }));
            }

            const schedule = JSON.parse(jsonMatch[0]);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ schedule }));
        } catch (error) {
            console.error('Parse plan API error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error' }));
        }
    });
}

const server = http.createServer((req, res) => {
    // Handle API routes
    if (req.url === '/api/coach' && req.method === 'POST') {
        return handleCoachAPI(req, res);
    }
    if (req.url === '/api/parse-plan' && req.method === 'POST') {
        return handleParsePlanAPI(req, res);
    }

    // Serve static files
    let filePath = path.join(ROOT, req.url === '/' ? 'index.html' : req.url);
    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end('Not found');
            return;
        }
        res.writeHead(200, { 'Content-Type': contentType + '; charset=utf-8' });
        res.end(data);
    });
});

server.listen(PORT, () => {
    console.log(`Dev server running at http://localhost:${PORT}`);
});
