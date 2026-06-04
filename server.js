const express = require('express');
const fs = require('fs');
const path = require('path');

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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Dinner Repertoire running at http://localhost:${PORT}`);
});
