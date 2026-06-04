const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'meals.json');
const meals = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
let changed = 0;

const updated = meals.map(meal => {
  if (!('ingredients' in meal)) {
    changed++;
    return { ...meal, ingredients: [] };
  }
  return meal;
});

if (changed > 0) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(updated, null, 2));
  console.log(`Updated ${changed} meal(s) — added empty ingredients field.`);
} else {
  console.log('All meals already have the ingredients field. Nothing to do.');
}
