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
            const { image, mimeType, startDate, imageNum, totalImages } = JSON.parse(body);
            const planStartDate = startDate || new Date().toISOString().split('T')[0];
            const imageContext = totalImages > 1
                ? `This is image ${imageNum} of ${totalImages} from the same training plan.`
                : '';

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
- The training plan starts on ${planStartDate}. Use this as the anchor date for Week 1, Day 1.
- If the plan shows weeks (Week 1, Week 2, etc.), calculate dates starting from ${planStartDate} as the first Monday.
- If only day names are shown (Mon, Tue, etc.), assign dates starting from ${planStartDate}.
- Convert all distances to kilometers (1 mile = 1.60934 km).
- Convert all durations to minutes.
- Identify discipline from keywords: swim/pool, bike/cycle/ride, run/jog, weights/strength/gym.
- "Brick" means combined bike+run workout.
- Rest days should be included with discipline "rest".
- Return ONLY the JSON object, no markdown fences or other text.`
                        },
                        {
                            role: 'user',
                            content: [
                                {
                                    type: 'text',
                                    text: `Read this training plan image and extract all workouts into the JSON format specified. The plan starts on ${planStartDate}. ${imageContext}`
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
