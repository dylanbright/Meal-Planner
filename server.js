require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
const PORT = process.env.PORT || 3007;
const DATA_FILE = path.join(__dirname, 'data', 'meals.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function readMeals() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2));
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function writeMeals(meals) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(meals, null, 2));
}

app.get('/api/meals', (req, res) => {
  res.json(readMeals());
});

app.post('/api/meals', (req, res) => {
  const meals = readMeals();
  const meal = {
    id: Date.now().toString(),
    name: req.body.name || '',
    notes: req.body.notes || '',
    nights: req.body.nights || 1,
    recipeUrl: req.body.recipeUrl || '',
    specialIngredients: req.body.specialIngredients || [],
    ingredients: req.body.ingredients || [],
    lastHad: req.body.lastHad || null,
    createdAt: new Date().toISOString()
  };
  meals.push(meal);
  writeMeals(meals);
  res.status(201).json(meal);
});

app.put('/api/meals/:id', (req, res) => {
  const meals = readMeals();
  const index = meals.findIndex(m => m.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Meal not found' });
  meals[index] = {
    ...meals[index],
    name: req.body.name ?? meals[index].name,
    notes: req.body.notes ?? meals[index].notes,
    nights: req.body.nights ?? meals[index].nights,
    recipeUrl: req.body.recipeUrl ?? meals[index].recipeUrl,
    specialIngredients: req.body.specialIngredients ?? meals[index].specialIngredients,
    ingredients: req.body.ingredients ?? meals[index].ingredients ?? [],
    lastHad: req.body.lastHad !== undefined ? (req.body.lastHad || null) : meals[index].lastHad,
    updatedAt: new Date().toISOString()
  };
  writeMeals(meals);
  res.json(meals[index]);
});

app.delete('/api/meals/:id', (req, res) => {
  const meals = readMeals();
  const index = meals.findIndex(m => m.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Meal not found' });
  meals.splice(index, 1);
  writeMeals(meals);
  res.status(204).end();
});

app.post('/api/fetch-ingredients', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });
  try {
    const ingredients = await scrapeIngredients(url);
    res.json({ ingredients });
  } catch (err) {
    res.status(422).json({ error: err.message });
  }
});

async function scrapeIngredients(url) {
  let response;
  try {
    response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(10000)
    });
  } catch (e) {
    throw new Error('Could not reach the recipe page. Check the URL and try again.');
  }

  if (response.status === 403 || response.status === 401) {
    throw new Error('This site blocked the request. Try a different recipe site, or paste the ingredients manually.');
  }
  if (!response.ok) throw new Error(`Page returned an error (${response.status}). Try the main recipe page URL, not a print URL.`);

  const html = await response.text();
  const scriptRe = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = scriptRe.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1].trim());
      const nodes = data['@graph']
        ? data['@graph']
        : (Array.isArray(data) ? data : [data]);

      for (const node of nodes) {
        const types = [].concat(node['@type'] || []);
        if (types.includes('Recipe') && Array.isArray(node.recipeIngredient) && node.recipeIngredient.length > 0) {
          return node.recipeIngredient;
        }
      }
    } catch (_) {}
  }

  throw new Error('No ingredient data found. Use the main recipe page URL (not a print page), or paste the ingredients manually.');
}

app.post('/api/parse-ingredients', async (req, res) => {
  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'No text provided' });

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'ANTHROPIC_API_KEY is not set. Add it to a .env file in the project folder.' });
  }

  try {
    const client = new Anthropic();
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Extract only the ingredients from this recipe text. Return them one per line with quantities and preparation notes (e.g. "diced", "minced"). Remove all headings, instructions, ads, navigation, and non-ingredient content. No bullet points, numbers, or commentary — just the ingredients.\n\n${text}`
      }]
    });

    const ingredients = message.content[0].text
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);

    res.json({ ingredients });
  } catch (err) {
    res.status(500).json({ error: 'AI parsing failed: ' + err.message });
  }
});

app.post('/api/estimate-cost', async (req, res) => {
  const { ingredients } = req.body;
  if (!ingredients?.length) return res.status(400).json({ error: 'No ingredients provided' });

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'ANTHROPIC_API_KEY is not set. Add it to a .env file in the project folder.' });
  }

  try {
    const client = new Anthropic();
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: `Estimate grocery costs in USD at a typical US grocery store for these ingredients. Return ONLY valid JSON with this exact structure, no extra text:\n{"total_low": number, "total_high": number, "items": [{"ingredient": "...", "cost": number}], "note": "..."}\n\nIngredients:\n${ingredients.join('\n')}`
      }]
    });

    const text = message.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Could not parse AI response');
    res.json(JSON.parse(jsonMatch[0]));
  } catch (err) {
    res.status(500).json({ error: 'Cost estimation failed: ' + err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Dinner Repertoire running at http://localhost:${PORT}`);
});
