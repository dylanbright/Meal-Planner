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
const mealNotesInput = document.getElementById('mealNotes');
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
    specialIngredients: ingredients
  });

  closeModal();
});

// --- Event bindings ---

document.getElementById('addBtn').addEventListener('click', openAdd);
document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('cancelBtn').addEventListener('click', closeModal);

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
    else if (!modal.classList.contains('hidden')) closeModal();
  }
});

searchInput.addEventListener('input', renderGrid);

// --- Helpers ---

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// --- Init ---
loadMeals();
