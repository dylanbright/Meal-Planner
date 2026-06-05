let meals = [];
let editingId = null;
let pendingDeleteId = null;
let ingredients = [];
let plannedMeals = []; // array of meal IDs, persisted in localStorage
let currentShoppingItems = []; // used for cost estimation
let shoppingOpenedFromPlan = false;

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
const planDropZone = document.getElementById('planDropZone');

// --- Data ---

async function loadMeals() {
  const res = await fetch('/api/meals');
  meals = await res.json();
  loadPlan();
  renderGrid();
  renderPlan();
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
  renderPlan();
}

async function deleteMeal(id) {
  await fetch(`/api/meals/${id}`, { method: 'DELETE' });
  meals = meals.filter(m => m.id !== id);
  plannedMeals = plannedMeals.filter(pid => pid !== id);
  savePlan();
  renderGrid();
  renderPlan();
}

// --- Weekly plan ---

function loadPlan() {
  try {
    const saved = localStorage.getItem('dinner-plan');
    plannedMeals = saved ? JSON.parse(saved) : [];
    // Remove any IDs for meals that no longer exist
    plannedMeals = plannedMeals.filter(id => meals.find(m => m.id === id));
  } catch (e) {
    plannedMeals = [];
  }
}

function savePlan() {
  localStorage.setItem('dinner-plan', JSON.stringify(plannedMeals));
}

function addToPlan(mealId) {
  plannedMeals.push(mealId);
  savePlan();
  renderPlan();
}

function removeFromPlan(index) {
  plannedMeals.splice(index, 1);
  savePlan();
  renderPlan();
}

function renderPlan() {
  const list = document.getElementById('planList');
  const emptyMsg = document.getElementById('planEmptyMsg');
  const summary = document.getElementById('planSummary');
  const generateBtn = document.getElementById('generateFromPlanBtn');

  if (plannedMeals.length === 0) {
    list.innerHTML = '';
    emptyMsg.classList.remove('hidden');
    summary.textContent = '';
    generateBtn.disabled = true;
    return;
  }

  emptyMsg.classList.add('hidden');

  const totalNights = plannedMeals.reduce((sum, id) => {
    const meal = meals.find(m => m.id === id);
    return sum + (meal?.nights || 1);
  }, 0);

  summary.textContent = `${plannedMeals.length} meal${plannedMeals.length !== 1 ? 's' : ''} · ${totalNights} night${totalNights !== 1 ? 's' : ''}`;
  generateBtn.disabled = false;

  list.innerHTML = plannedMeals.map((id, index) => {
    const meal = meals.find(m => m.id === id);
    if (!meal) return '';
    const hasIngredients = (meal.ingredients || []).length > 0;
    return `
      <li class="plan-item${hasIngredients ? '' : ' plan-item-no-ing'}">
        <span class="plan-item-name" title="${escHtml(meal.name)}">${escHtml(meal.name)}</span>
        <span class="plan-item-nights">${meal.nights}n</span>
        ${!hasIngredients ? `<span class="plan-item-warn" title="No ingredients saved">&#9888;</span>` : ''}
        <button class="plan-item-remove" data-index="${index}" aria-label="Remove">&times;</button>
      </li>
    `;
  }).join('');

  list.querySelectorAll('[data-index]').forEach(btn => {
    btn.addEventListener('click', () => removeFromPlan(parseInt(btn.dataset.index)));
  });
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
    card.draggable = true;
    card.dataset.mealId = meal.id;
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

    // Drag events
    card.addEventListener('dragstart', e => {
      e.dataTransfer.setData('mealId', meal.id);
      e.dataTransfer.effectAllowed = 'copy';
      setTimeout(() => card.classList.add('dragging'), 0);
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));

    mealGrid.appendChild(card);
  });

  mealGrid.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => openEdit(btn.dataset.edit));
  });
  mealGrid.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => confirmDelete(btn.dataset.delete));
  });
}

// --- Drop zone ---

planDropZone.addEventListener('dragover', e => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
  planDropZone.classList.add('drag-over');
});

planDropZone.addEventListener('dragleave', e => {
  if (!planDropZone.contains(e.relatedTarget)) {
    planDropZone.classList.remove('drag-over');
  }
});

planDropZone.addEventListener('drop', e => {
  e.preventDefault();
  planDropZone.classList.remove('drag-over');
  const mealId = e.dataTransfer.getData('mealId');
  if (mealId) addToPlan(mealId);
});

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
  modal.classList.remove('hidden');
  mealNameInput.focus();
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
  shoppingOpenedFromPlan = false;
  selectedMealIds = new Set();
  document.getElementById('shoppingStep1').classList.remove('hidden');
  document.getElementById('shoppingStep2').classList.add('hidden');
  document.getElementById('backToMealsBtn').classList.remove('hidden');
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
              : '<span class="no-ing-note">no ingredients saved</span>'}
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
  showShoppingListForMeals([...selectedMealIds]);
}

function generateFromPlan() {
  shoppingOpenedFromPlan = true;
  document.getElementById('backToMealsBtn').classList.add('hidden');
  showShoppingListForMeals([...plannedMeals]);
  shoppingModal.classList.remove('hidden');
}

function showShoppingListForMeals(mealIds) {
  const selected = meals.filter(m => mealIds.includes(m.id));
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

  currentShoppingItems = allItems;

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
    html += '<p class="shopping-empty">No ingredients found for the selected meals. Edit meals to add ingredients.</p>';
  }

  content.innerHTML = html;

  content.querySelectorAll('.shopping-cb').forEach(cb => {
    cb.addEventListener('change', () => {
      cb.closest('li').querySelector('.shopping-item-text').classList.toggle('checked-off', cb.checked);
    });
  });

  // Reset cost section
  document.getElementById('estimateCostBtn').disabled = allItems.length === 0;
  document.getElementById('costResult').classList.add('hidden');
  document.getElementById('costResult').innerHTML = '';

  document.getElementById('shoppingStep1').classList.add('hidden');
  document.getElementById('shoppingStep2').classList.remove('hidden');
}

// --- Cost estimation ---

document.getElementById('estimateCostBtn').addEventListener('click', async () => {
  if (!currentShoppingItems.length) return;

  const btn = document.getElementById('estimateCostBtn');
  const result = document.getElementById('costResult');

  btn.disabled = true;
  btn.textContent = 'Estimating…';

  try {
    const res = await fetch('/api/estimate-cost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ingredients: currentShoppingItems.map(i => i.text) })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Unknown error');

    result.innerHTML = `
      <div class="cost-total">Estimated: $${data.total_low} &ndash; $${data.total_high}</div>
      <div class="cost-note">${escHtml(data.note || 'Prices vary by region and store.')}</div>
      <button class="cost-breakdown-toggle" id="toggleBreakdown">Show itemized breakdown &#9660;</button>
      <ul class="cost-breakdown-list hidden" id="costBreakdown">
        ${(data.items || []).map(item => `
          <li class="cost-breakdown-item">
            <span>${escHtml(String(item.ingredient))}</span>
            <span class="cost-amount">~$${typeof item.cost === 'number' ? item.cost.toFixed(2) : item.cost}</span>
          </li>
        `).join('')}
      </ul>
    `;
    result.classList.remove('hidden');

    document.getElementById('toggleBreakdown').addEventListener('click', function () {
      const breakdown = document.getElementById('costBreakdown');
      breakdown.classList.toggle('hidden');
      this.textContent = breakdown.classList.contains('hidden')
        ? 'Show itemized breakdown ▾'
        : 'Hide breakdown ▴';
    });
  } catch (err) {
    result.innerHTML = `<div class="fetch-status error">&#10007; ${escHtml(err.message)}</div>`;
    result.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Estimate Cost with AI';
  }
});

// --- Event bindings ---

document.getElementById('addBtn').addEventListener('click', openAdd);
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
document.getElementById('generateFromPlanBtn').addEventListener('click', generateFromPlan);
document.getElementById('clearPlanBtn').addEventListener('click', () => {
  plannedMeals = [];
  savePlan();
  renderPlan();
});

document.getElementById('backToMealsBtn').addEventListener('click', () => {
  document.getElementById('shoppingStep1').classList.remove('hidden');
  document.getElementById('shoppingStep2').classList.add('hidden');
});
document.getElementById('printListBtn').addEventListener('click', () => window.print());
document.getElementById('copyListBtn').addEventListener('click', copyShoppingList);

async function copyShoppingList() {
  if (!currentShoppingItems.length) return;

  const specials = currentShoppingItems.filter(i => i.isSpecial);
  const regular = currentShoppingItems.filter(i => !i.isSpecial);

  const lines = [];
  if (specials.length) {
    lines.push('** SPECIAL INGREDIENTS **');
    specials.forEach(i => lines.push(`- ${i.text}`));
    lines.push('');
  }
  if (regular.length) {
    if (specials.length) lines.push('ALL INGREDIENTS');
    regular.forEach(i => lines.push(`- ${i.text}`));
  }
  const text = lines.join('\n');

  const btn = document.getElementById('copyListBtn');
  try {
    await navigator.clipboard.writeText(text);
    btn.textContent = 'Copied!';
  } catch (err) {
    // Fallback for older browsers / non-HTTPS contexts
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    btn.textContent = 'Copied!';
  }
  setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
}

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
