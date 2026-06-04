let meals = [];
let editingId = null;
let pendingDeleteId = null;
let ingredients = [];
let weekPlan = [];

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
const mealNotesInput = document.getElementById('mealNotes');
const mealLastHadInput = document.getElementById('mealLastHad');
const ingredientInput = document.getElementById('ingredientInput');
const ingredientTags = document.getElementById('ingredientTags');

const deleteDialog = document.getElementById('deleteDialog');
const deleteDialogMsg = document.getElementById('deleteDialogMsg');

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
  weekPlan = weekPlan.filter(wid => wid !== id);
  renderWeekPlan();
  renderGrid();
}

// --- Render ---

function renderGrid() {
  const query = searchInput.value.toLowerCase().trim();
  const filtered = query
    ? meals.filter(m =>
        m.name.toLowerCase().includes(query) ||
        m.notes.toLowerCase().includes(query) ||
        m.specialIngredients.some(i => i.toLowerCase().includes(query))
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
    const card = document.createElement('div');
    card.className = 'meal-card';
    card.setAttribute('draggable', 'true');
    card.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', meal.id);
      e.dataTransfer.effectAllowed = 'copy';
      card.classList.add('dragging');
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
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
      </div>
      ${meal.recipeUrl ? `<div class="meal-recipe-link"><a href="${escHtml(meal.recipeUrl)}" target="_blank" rel="noopener">View Recipe &rarr;</a></div>` : ''}
      ${meal.notes ? `<div class="meal-notes">${escHtml(meal.notes)}</div>` : ''}
      ${meal.specialIngredients.length > 0 ? `
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

// --- Modal ---

function openAdd() {
  editingId = null;
  ingredients = [];
  mealForm.reset();
  mealIdInput.value = '';
  mealNightsInput.value = 1;
  mealLastHadInput.value = '';
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
  mealRecipeInput.value = meal.recipeUrl;
  mealLastHadInput.value = meal.lastHad || '';
  mealNotesInput.value = meal.notes;
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

// --- Ingredients ---

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

// --- Week plan ---

const weekPlanList = document.getElementById('weekPlanList');

weekPlanList.addEventListener('dragover', e => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
  weekPlanList.classList.add('drag-over');
});

weekPlanList.addEventListener('dragleave', e => {
  if (!weekPlanList.contains(e.relatedTarget)) {
    weekPlanList.classList.remove('drag-over');
  }
});

weekPlanList.addEventListener('drop', e => {
  e.preventDefault();
  weekPlanList.classList.remove('drag-over');
  const id = e.dataTransfer.getData('text/plain');
  if (id && !weekPlan.includes(id)) {
    weekPlan.push(id);
    renderWeekPlan();
  }
});

function renderWeekPlan() {
  weekPlanList.classList.remove('drag-over');
  const groceryBtn = document.getElementById('groceryListBtn');

  if (weekPlan.length === 0) {
    weekPlanList.innerHTML = '<p class="week-plan-empty">Drag meals here to plan your week</p>';
    groceryBtn.disabled = true;
    return;
  }

  groceryBtn.disabled = false;
  weekPlanList.innerHTML = '';
  weekPlan.forEach(id => {
    const meal = meals.find(m => m.id === id);
    if (!meal) return;
    const item = document.createElement('div');
    item.className = 'week-plan-item';
    item.innerHTML = `
      <div class="week-plan-item-info">
        <span class="week-plan-item-name">${escHtml(meal.name)}</span>
        <span class="badge badge-nights">${meal.nights} night${meal.nights !== 1 ? 's' : ''}</span>
      </div>
      <button class="btn-icon delete" data-remove-plan="${escHtml(id)}" title="Remove">&times;</button>
    `;
    weekPlanList.appendChild(item);
  });

  weekPlanList.querySelectorAll('[data-remove-plan]').forEach(btn => {
    btn.addEventListener('click', () => {
      weekPlan = weekPlan.filter(id => id !== btn.dataset.removePlan);
      renderWeekPlan();
    });
  });
}

// --- Grocery list ---

const groceryModal = document.getElementById('groceryModal');

function openGroceryModal() {
  const plannedMeals = weekPlan.map(id => meals.find(m => m.id === id)).filter(Boolean);
  const content = document.getElementById('groceryListContent');

  content.innerHTML = plannedMeals.map(meal => `
    <div class="grocery-meal">
      <div class="grocery-meal-name">${escHtml(meal.name)}</div>
      ${meal.specialIngredients && meal.specialIngredients.length > 0
        ? `<ul class="grocery-ingredient-list">${meal.specialIngredients.map(i => `<li>${escHtml(i)}</li>`).join('')}</ul>`
        : `<p class="grocery-no-ingredients">No special ingredients</p>`
      }
    </div>
  `).join('');

  groceryModal.classList.remove('hidden');
}

function closeGroceryModal() {
  groceryModal.classList.add('hidden');
}

document.getElementById('groceryListBtn').addEventListener('click', openGroceryModal);
document.getElementById('groceryModalClose').addEventListener('click', closeGroceryModal);
document.getElementById('groceryModalDoneBtn').addEventListener('click', closeGroceryModal);
groceryModal.querySelector('.modal-backdrop').addEventListener('click', closeGroceryModal);

document.getElementById('groceryModalCopyBtn').addEventListener('click', async () => {
  const plannedMeals = weekPlan.map(id => meals.find(m => m.id === id)).filter(Boolean);
  const lines = ['This Week\'s Grocery List', ''];
  plannedMeals.forEach(meal => {
    lines.push(meal.name + ':');
    if (meal.specialIngredients && meal.specialIngredients.length > 0) {
      meal.specialIngredients.forEach(i => lines.push('  • ' + i));
    } else {
      lines.push('  (no special ingredients)');
    }
    lines.push('');
  });
  try {
    await navigator.clipboard.writeText(lines.join('\n').trim());
    const btn = document.getElementById('groceryModalCopyBtn');
    const orig = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = orig; }, 2000);
  } catch (_) {}
});

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
    specialIngredients: ingredients
  });

  closeModal();
});

// --- Event bindings ---

document.getElementById('addBtn').addEventListener('click', openAdd);
document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('cancelBtn').addEventListener('click', closeModal);

document.getElementById('todayBtn').addEventListener('click', () => {
  mealLastHadInput.value = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
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

// Close modals on backdrop click
modal.querySelector('.modal-backdrop').addEventListener('click', closeModal);
deleteDialog.querySelector('.modal-backdrop').addEventListener('click', closeDeleteDialog);

// Close on Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (!deleteDialog.classList.contains('hidden')) closeDeleteDialog();
    else if (!groceryModal.classList.contains('hidden')) closeGroceryModal();
    else if (!modal.classList.contains('hidden')) closeModal();
  }
});

searchInput.addEventListener('input', renderGrid);

// --- Helpers ---

function formatDate(dateStr) {
  // dateStr is YYYY-MM-DD; parse as local date to avoid timezone shift
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
