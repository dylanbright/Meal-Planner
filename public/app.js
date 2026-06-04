let meals = [];
let editingId = null;
let pendingDeleteId = null;
let ingredients = [];

const mealGrid = document.getElementById('mealGrid');
const emptyState = document.getElementById('emptyState');
const searchInput = document.getElementById('searchInput');

const modal = document.getElementById('modal');
const mealForm = document.getElementById('mealForm');
const modalTitle = document.getElementById('modalTitle');
const mealIdInput = document.getElementById('mealId');
const mealNameInput = document.getElementById('mealName');
const mealNightsInput = document.getElementById('mealNights');
const mealRecipeInput = document.getElementById('mealRecipe');
const mealLastHadInput = document.getElementById('mealLastHad');
const mealNotesInput = document.getElementById('mealNotes');
const mealIngredientsInput = document.getElementById('mealIngredients');
const fetchIngredientsBtn = document.getElementById('fetchIngredientsBtn');
const fetchStatus = document.getElementById('fetchStatus');
const ingredientInput = document.getElementById('ingredientInput');
const ingredientTags = document.getElementById('ingredientTags');

const deleteDialog = document.getElementById('deleteDialog');
const deleteDialogMsg = document.getElementById('deleteDialogMsg');

const shoppingModal = document.getElementById('shoppingModal');

// --- Data ---

async function loadMeals() {
  const res = await fetch('/api/meals');
  meals = await res.json();
  renderGrid();
}

async function saveMeal(data) {
  if (editingId) {
    const res = await fetch(`/api/meals/${editingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const updated = await res.json();
    meals = meals.map(m => m.id === editingId ? updated : m);
  } else {
    const res = await fetch('/api/meals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const created = await res.json();
    meals.push(created);
  }
  renderGrid();
}

async function deleteMeal(id) {
  await fetch(`/api/meals/${id}`, { method: 'DELETE' });
  meals = meals.filter(m => m.id !== id);
  renderGrid();
}

// --- Render grid ---

function renderGrid() {
  const query = searchInput.value.toLowerCase().trim();
  const filtered = query
    ? meals.filter(m =>
        m.name.toLowerCase().includes(query) ||
        (m.notes || '').toLowerCase().includes(query) ||
        (m.specialIngredients || []).some(i => i.toLowerCase().includes(query))
      )
    : meals;

  mealGrid.innerHTML = '';

  if (filtered.length === 0) {
    emptyState.textContent = query ? 'No meals match your search.' : 'No meals yet. Add your first one!';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');

  filtered.forEach(meal => {
    const ingCount = (meal.ingredients || []).length;
    const card = document.createElement('div');
    card.className = 'meal-card';
    card.innerHTML = `
      <div class="meal-card-header">
        <h3>${escHtml(meal.name)}</h3>
        <div class="meal-card-actions">
          <button class="btn-icon" data-edit="${meal.id}" title="Edit">Edit</button>
          <button class="btn-icon delete" data-delete="${meal.id}" title="Delete">Delete</button>
        </div>
      </div>
      <div class="meal-meta">
        <span class="badge badge-nights">${meal.nights} night${meal.nights !== 1 ? 's' : ''}</span>
        ${meal.lastHad ? `<span class="badge badge-last-had">Last had ${formatDate(meal.lastHad)}</span>` : ''}
        ${ingCount > 0 ? `<span class="badge badge-ingredients">${ingCount} ingredients</span>` : ''}
      </div>
      ${meal.recipeUrl ? `<div class="meal-recipe-link"><a href="${escHtml(meal.recipeUrl)}" target="_blank" rel="noopener">View Recipe &rarr;</a></div>` : ''}
      ${meal.notes ? `<div class="meal-notes">${escHtml(meal.notes)}</div>` : ''}
      ${(meal.specialIngredients || []).length > 0 ? `
        <div class="meal-ingredients">
          <div class="meal-ingredients-label">Special Ingredients</div>
          <div class="ingredient-list">
            ${meal.specialIngredients.map(i => `<span class="ingredient-tag">${escHtml(i)}</span>`).join('')}
          </div>
        </div>` : ''}
    `;
    mealGrid.appendChild(card);
  });

  mealGrid.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => openEdit(btn.dataset.edit));
  });
  mealGrid.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => confirmDelete(btn.dataset.delete));
  });
}

// --- Meal modal ---

function openAdd() {
  editingId = null;
  ingredients = [];
  mealForm.reset();
  mealIdInput.value = '';
  mealNightsInput.value = 1;
  mealLastHadInput.value = '';
  mealIngredientsInput.value = '';
  fetchStatus.textContent = '';
  fetchStatus.className = 'fetch-status';
  fetchIngredientsBtn.disabled = true;
  renderIngredientTags();
  modalTitle.textContent = 'Add Meal';
  openModal();
}

function openEdit(id) {
  const meal = meals.find(m => m.id === id);
  if (!meal) return;
  editingId = id;
  ingredients = [...(meal.specialIngredients || [])];
  mealIdInput.value = meal.id;
  mealNameInput.value = meal.name;
  mealNightsInput.value = meal.nights;
  mealRecipeInput.value = meal.recipeUrl || '';
  mealLastHadInput.value = meal.lastHad || '';
  mealNotesInput.value = meal.notes || '';
  mealIngredientsInput.value = (meal.ingredients || []).join('\n');
  fetchStatus.textContent = '';
  fetchStatus.className = 'fetch-status';
  fetchIngredientsBtn.disabled = !meal.recipeUrl;
  renderIngredientTags();
  modalTitle.textContent = 'Edit Meal';
  openModal();
}

function openModal() {
  modal.classList.remove('hidden');
  mealNameInput.focus();
}

function closeModal() {
  modal.classList.add('hidden');
  mealNameInput.classList.remove('invalid');
}

// --- AI ingredient parsing ---

document.getElementById('parseIngredientsBtn').addEventListener('click', async () => {
  const text = mealIngredientsInput.value.trim();
  if (!text) return;

  const btn = document.getElementById('parseIngredientsBtn');
  btn.disabled = true;
  btn.textContent = 'Cleaning up…';
  fetchStatus.textContent = '';
  fetchStatus.className = 'fetch-status';

  try {
    const res = await fetch('/api/parse-ingredients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Unknown error');

    mealIngredientsInput.value = data.ingredients.join('\n');
    fetchStatus.textContent = `✓ ${data.ingredients.length} ingredients extracted`;
    fetchStatus.className = 'fetch-status success';
  } catch (err) {
    fetchStatus.textContent = `✗ ${err.message}`;
    fetchStatus.className = 'fetch-status error';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Clean up with AI';
  }
});

// --- Fetch ingredients from recipe URL ---

mealRecipeInput.addEventListener('input', () => {
  fetchIngredientsBtn.disabled = !mealRecipeInput.value.trim();
});

fetchIngredientsBtn.addEventListener('click', async () => {
  const url = mealRecipeInput.value.trim();
  if (!url) return;

  fetchIngredientsBtn.disabled = true;
  fetchStatus.textContent = 'Fetching…';
  fetchStatus.className = 'fetch-status fetching';

  try {
    const res = await fetch('/api/fetch-ingredients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Unknown error');

    mealIngredientsInput.value = data.ingredients.join('\n');
    fetchStatus.textContent = `✓ ${data.ingredients.length} ingredients imported`;
    fetchStatus.className = 'fetch-status success';
  } catch (err) {
    fetchStatus.textContent = `✗ ${err.message}`;
    fetchStatus.className = 'fetch-status error';
  } finally {
    fetchIngredientsBtn.disabled = false;
  }
});

// --- Special ingredients tags ---

function addIngredient() {
  const val = ingredientInput.value.trim();
  if (!val) return;
  if (!ingredients.includes(val)) {
    ingredients.push(val);
    renderIngredientTags();
  }
  ingredientInput.value = '';
  ingredientInput.focus();
}

function removeIngredient(val) {
  ingredients = ingredients.filter(i => i !== val);
  renderIngredientTags();
}

function renderIngredientTags() {
  ingredientTags.innerHTML = ingredients.map(i => `
    <span class="ingredient-tag-edit">
      ${escHtml(i)}
      <button type="button" data-remove="${escHtml(i)}" aria-label="Remove ${escHtml(i)}">&times;</button>
    </span>
  `).join('');

  ingredientTags.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', () => removeIngredient(btn.dataset.remove));
  });
}

// --- Delete dialog ---

function confirmDelete(id) {
  const meal = meals.find(m => m.id === id);
  if (!meal) return;
  pendingDeleteId = id;
  deleteDialogMsg.textContent = `"${meal.name}" will be permanently removed.`;
  deleteDialog.classList.remove('hidden');
}

function closeDeleteDialog() {
  deleteDialog.classList.add('hidden');
  pendingDeleteId = null;
}

// --- Form submit ---

mealForm.addEventListener('submit', async e => {
  e.preventDefault();
  const name = mealNameInput.value.trim();
  if (!name) {
    mealNameInput.classList.add('invalid');
    mealNameInput.focus();
    return;
  }
  mealNameInput.classList.remove('invalid');

  await saveMeal({
    name,
    notes: mealNotesInput.value.trim(),
    nights: parseInt(mealNightsInput.value, 10) || 1,
    recipeUrl: mealRecipeInput.value.trim(),
    lastHad: mealLastHadInput.value || null,
    specialIngredients: ingredients,
    ingredients: mealIngredientsInput.value.split('\n').map(s => s.trim()).filter(Boolean)
  });

  closeModal();
});

// --- Shopping list ---

let selectedMealIds = new Set();

function openShoppingModal() {
  selectedMealIds = new Set();
  document.getElementById('shoppingStep1').classList.remove('hidden');
  document.getElementById('shoppingStep2').classList.add('hidden');
  renderShoppingMealList();
  shoppingModal.classList.remove('hidden');
}

function closeShoppingModal() {
  shoppingModal.classList.add('hidden');
}

function renderShoppingMealList() {
  const list = document.getElementById('shoppingMealList');
  const buildBtn = document.getElementById('buildListBtn');

  if (meals.length === 0) {
    list.innerHTML = '<p class="shopping-empty">No meals in your repertoire yet.</p>';
    buildBtn.disabled = true;
    return;
  }

  list.innerHTML = meals.map(meal => {
    const ingCount = (meal.ingredients || []).length;
    const hasIngredients = ingCount > 0;
    return `
      <label class="shopping-meal-row${hasIngredients ? '' : ' no-ingredients'}">
        <input type="checkbox" class="shopping-meal-cb" data-id="${meal.id}"${hasIngredients ? '' : ' disabled'}>
        <div class="shopping-meal-info">
          <span class="shopping-meal-name">${escHtml(meal.name)}</span>
          <span class="shopping-meal-meta">
            ${meal.nights} night${meal.nights !== 1 ? 's' : ''}
            &middot;
            ${hasIngredients
              ? `${ingCount} ingredient${ingCount !== 1 ? 's' : ''}`
              : '<span class="no-ing-note">no ingredients saved — edit meal to fetch them</span>'}
          </span>
        </div>
      </label>
    `;
  }).join('');

  list.querySelectorAll('.shopping-meal-cb').forEach(cb => {
    cb.addEventListener('change', () => {
      if (cb.checked) selectedMealIds.add(cb.dataset.id);
      else selectedMealIds.delete(cb.dataset.id);
      buildBtn.disabled = selectedMealIds.size === 0;
    });
  });
}

function buildShoppingList() {
  const selected = meals.filter(m => selectedMealIds.has(m.id));
  const totalNights = selected.reduce((sum, m) => sum + (m.nights || 1), 0);

  const allItems = [];
  for (const meal of selected) {
    for (const ing of (meal.ingredients || [])) {
      const isSpecial = (meal.specialIngredients || []).some(s =>
        ing.toLowerCase().includes(s.toLowerCase())
      );
      allItems.push({ text: ing, meal: meal.name, isSpecial });
    }
  }

  const specials = allItems.filter(i => i.isSpecial);
  const regular = allItems.filter(i => !i.isSpecial);

  const content = document.getElementById('shoppingListContent');

  let html = `
    <div class="shopping-summary">
      ${selected.length} meal${selected.length !== 1 ? 's' : ''}
      &middot;
      ${totalNights} night${totalNights !== 1 ? 's' : ''}
    </div>
  `;

  if (specials.length > 0) {
    html += `
      <div class="shopping-section">
        <div class="shopping-section-title special-title">&#9733; Special Ingredients</div>
        <ul class="shopping-ingredient-list">
          ${specials.map(i => `
            <li class="shopping-item special-item">
              <label class="shopping-item-label">
                <input type="checkbox" class="shopping-cb">
                <span class="shopping-item-text">${escHtml(i.text)}</span>
              </label>
              <span class="shopping-item-meal">${escHtml(i.meal)}</span>
            </li>
          `).join('')}
        </ul>
      </div>
    `;
  }

  if (regular.length > 0) {
    html += `
      <div class="shopping-section">
        <div class="shopping-section-title">All Ingredients</div>
        <ul class="shopping-ingredient-list">
          ${regular.map(i => `
            <li class="shopping-item">
              <label class="shopping-item-label">
                <input type="checkbox" class="shopping-cb">
                <span class="shopping-item-text">${escHtml(i.text)}</span>
              </label>
              <span class="shopping-item-meal">${escHtml(i.meal)}</span>
            </li>
          `).join('')}
        </ul>
      </div>
    `;
  }

  if (allItems.length === 0) {
    html += '<p class="shopping-empty">No ingredients to show for the selected meals.</p>';
  }

  content.innerHTML = html;

  // Strike through checked items
  content.querySelectorAll('.shopping-cb').forEach(cb => {
    cb.addEventListener('change', () => {
      const textEl = cb.closest('li').querySelector('.shopping-item-text');
      textEl.classList.toggle('checked-off', cb.checked);
    });
  });

  document.getElementById('shoppingStep1').classList.add('hidden');
  document.getElementById('shoppingStep2').classList.remove('hidden');
}

// --- Event bindings ---

document.getElementById('addBtn').addEventListener('click', openAdd);
document.getElementById('shoppingBtn').addEventListener('click', openShoppingModal);
document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('cancelBtn').addEventListener('click', closeModal);

document.getElementById('todayBtn').addEventListener('click', () => {
  mealLastHadInput.value = new Date().toLocaleDateString('en-CA');
});

document.getElementById('addIngredientBtn').addEventListener('click', addIngredient);
ingredientInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); addIngredient(); }
});

document.getElementById('deleteCancelBtn').addEventListener('click', closeDeleteDialog);
document.getElementById('deleteConfirmBtn').addEventListener('click', async () => {
  if (pendingDeleteId) await deleteMeal(pendingDeleteId);
  closeDeleteDialog();
});

document.getElementById('shoppingClose').addEventListener('click', closeShoppingModal);
document.getElementById('shoppingClose2').addEventListener('click', closeShoppingModal);
document.getElementById('shoppingCancelBtn').addEventListener('click', closeShoppingModal);
document.getElementById('buildListBtn').addEventListener('click', buildShoppingList);
document.getElementById('backToMealsBtn').addEventListener('click', () => {
  document.getElementById('shoppingStep1').classList.remove('hidden');
  document.getElementById('shoppingStep2').classList.add('hidden');
});
document.getElementById('printListBtn').addEventListener('click', () => window.print());

modal.querySelector('.modal-backdrop').addEventListener('click', closeModal);
deleteDialog.querySelector('.modal-backdrop').addEventListener('click', closeDeleteDialog);
shoppingModal.querySelector('.modal-backdrop').addEventListener('click', closeShoppingModal);

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (!deleteDialog.classList.contains('hidden')) closeDeleteDialog();
    else if (!modal.classList.contains('hidden')) closeModal();
    else if (!shoppingModal.classList.contains('hidden')) closeShoppingModal();
  }
});

searchInput.addEventListener('input', renderGrid);

// --- Helpers ---

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// --- Init ---
loadMeals();
