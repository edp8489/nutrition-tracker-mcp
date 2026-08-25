<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useLogStore } from '@/stores/log'
import { useRecipesStore } from '@/stores/recipes'
import { useFoodsStore } from '@/stores/foods'
import { useDatasetStore } from '@/stores/dataset'
import { foodMacrosForQuantity } from '@/utils/macros'
import LogEntryComp from '@/components/LogEntry.vue'
import FoodSearch from '@/components/FoodSearch.vue'
import AttributionFooter from '@/components/AttributionFooter.vue'
import type { Food, LogEntry, Unit } from '@/types/domain'

const log = useLogStore()
const recipes = useRecipesStore()
const foodsStore = useFoodsStore()
const dataset = useDatasetStore()
const route = useRoute()
const router = useRouter()

const today = new Date().toISOString().slice(0, 10)
const addingForDate = ref<string | null>(null)
const addMode = ref<'food' | 'recipe' | null>(null)
const selectedFood = ref<Food | null>(null)
const quantity = ref(0)
const unit = ref<Unit>('g')
const timestamp = ref('')
const selectedRecipeId = ref<string | null>(null)
const portions = ref(1)
const editingEntry = ref<LogEntry | null>(null)

const focusDate = ref<string>((route.query.date as string) || today)

onMounted(async () => {
  const now = new Date()
  now.setMinutes(0, 0, 0)
  timestamp.value = now.toISOString().slice(0, 16)
})

watch(
  () => route.query.date,
  (d) => {
    if (typeof d === 'string') focusDate.value = d
  },
)

function startAdd(date: string, mode: 'food' | 'recipe') {
  addingForDate.value = date
  addMode.value = mode
  const now = new Date()
  now.setMinutes(0, 0, 0)
  timestamp.value = now.toISOString().slice(0, 16)
  if (mode === 'recipe') {
    selectedRecipeId.value = null
    portions.value = 1
  }
}

function onFoodSelect(food: Food) {
  selectedFood.value = food
  quantity.value = food.servingMetric.quantity
  unit.value = food.servingMetric.unit
}

async function saveFoodEntry() {
  if (!selectedFood.value) return
  await log.addFoodLog(
    selectedFood.value.id,
    selectedFood.value.name,
    quantity.value,
    unit.value,
    new Date(timestamp.value).toISOString(),
  )
  cancelAdd()
}

async function saveRecipeEntry() {
  if (!selectedRecipeId.value) return
  const r = recipes.recipes.find((x) => x.id === selectedRecipeId.value)
  if (!r) return
  await log.addRecipeLog(
    r.id,
    r.name,
    portions.value,
    r.perPortionMacros,
    new Date(timestamp.value).toISOString(),
  )
  cancelAdd()
}

function cancelAdd() {
  addingForDate.value = null
  addMode.value = null
  selectedFood.value = null
  selectedRecipeId.value = null
  quantity.value = 0
}

async function deleteEntry(id: string) {
  await log.deleteEntry(id)
}

function editEntry(id: string) {
  const entry = log.entries.find((e) => e.id === id)
  if (!entry) return
  editingEntry.value = entry
}

async function saveEdit() {
  if (!editingEntry.value) return
  await log.updateEntry(editingEntry.value.id, {
    timestamp: new Date(timestamp.value).toISOString(),
  })
  editingEntry.value = null
}

function formatDateLabel(date: string): string {
  const d = new Date(date + 'T00:00:00')
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function dayTotalFor(date: string) {
  return log.dayTotal(date)
}
</script>

<template>
  <header><h5>Food Log</h5></header>

  <article
    v-for="[date, dayEntries] in log.entriesByDate"
    :key="date"
    class="card padding"
  >
    <div class="row">
      <div class="col">
        <h6>{{ formatDateLabel(date) }}</h6>
      </div>
      <div class="col right-align">
        <small>
          {{ Math.round(dayTotalFor(date).calories) }} kcal ·
          {{ Math.round(dayTotalFor(date).protein) }}g P ·
          {{ Math.round(dayTotalFor(date).carbs) }}g C ·
          {{ Math.round(dayTotalFor(date).fat) }}g F
        </small>
        <button class="chip" @click="startAdd(date, 'food')"><i>add</i>Food</button>
        <button class="chip" @click="startAdd(date, 'recipe')"><i>add</i>Recipe</button>
      </div>
    </div>

    <table class="macro-table border striped">
      <thead>
        <tr>
          <th>Hour</th><th>Item</th><th>kcal</th><th>P</th><th>C</th><th>F</th><th></th>
        </tr>
      </thead>
      <tbody>
        <LogEntryComp
          v-for="e in dayEntries"
          :key="e.id"
          :entry="e"
          @edit="editEntry"
          @delete="deleteEntry"
        />
      </tbody>
    </table>
  </article>

  <p v-if="log.entries.length === 0" class="center-align">
    No log entries yet. Add your first food.
  </p>

  <dialog v-if="addingForDate" class="active">
    <h5>Add {{ addMode === 'food' ? 'Food' : 'Recipe' }} — {{ addingForDate }}</h5>

    <div class="field border round">
      <span class="label">Timestamp (hour)</span>
      <input v-model="timestamp" type="datetime-local" />
    </div>

    <div v-if="addMode === 'food'">
      <FoodSearch @select="onFoodSelect" />
      <div v-if="selectedFood" class="row">
        <div class="field border round col">
          <span class="label">Quantity</span>
          <input v-model.number="quantity" type="number" min="0" step="1" />
        </div>
        <div class="field border round col">
          <span class="label">Unit</span>
          <select v-model="unit">
            <option value="g">g</option>
            <option value="ml">ml</option>
          </select>
        </div>
        <div class="col">
          <p v-if="selectedFood">
            {{ Math.round(foodMacrosForQuantity(selectedFood.nutrition100g, quantity).calories) }} kcal ·
            {{ Math.round(foodMacrosForQuantity(selectedFood.nutrition100g, quantity).protein) }}g P ·
            {{ Math.round(foodMacrosForQuantity(selectedFood.nutrition100g, quantity).carbs) }}g C ·
            {{ Math.round(foodMacrosForQuantity(selectedFood.nutrition100g, quantity).fat) }}g F
          </p>
        </div>
      </div>
      <nav>
        <button class="border round" @click="cancelAdd">Cancel</button>
        <button class="round" :disabled="!selectedFood" @click="saveFoodEntry">Save</button>
      </nav>
    </div>

    <div v-else>
      <div class="field suffix border round">
        <select v-model="selectedRecipeId">
          <option :value="null" disabled>Select a recipe...</option>
          <option v-for="r in recipes.recipes" :key="r.id" :value="r.id">
            {{ r.name }} ({{ Math.round(r.perPortionMacros.calories) }} kcal/portion)
          </option>
        </select>
        <i>arrow_drop_down</i>
      </div>
      <div class="field border round">
        <span class="label">Portions</span>
        <input v-model.number="portions" type="number" min="0.5" step="0.5" />
      </div>
      <nav>
        <button class="border round" @click="cancelAdd">Cancel</button>
        <button class="round" :disabled="!selectedRecipeId" @click="saveRecipeEntry">Save</button>
      </nav>
    </div>
  </dialog>

  <dialog v-if="editingEntry" class="active">
    <h5>Edit entry</h5>
    <p>{{ editingEntry.kind === 'recipe' ? editingEntry.recipeRef?.recipeName : editingEntry.foodRef?.foodName }}</p>
    <div class="field border round">
      <span class="label">Timestamp</span>
      <input v-model="timestamp" type="datetime-local" />
    </div>
    <nav>
      <button class="border round" @click="editingEntry = null">Cancel</button>
      <button class="round" @click="saveEdit">Save</button>
    </nav>
  </dialog>

  <AttributionFooter />
</template>
