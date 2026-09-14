<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AddOutline } from '@vicons/ionicons5'
import { useLogStore } from '@/stores/log'
import { useRecipesStore } from '@/stores/recipes'
import { useFoodsStore } from '@/stores/foods'
import { foodMacrosForQuantity } from '@/utils/macros'
import LogEntryComp from '@/components/LogEntry.vue'
import FoodSearch from '@/components/FoodSearch.vue'
import AttributionFooter from '@/components/AttributionFooter.vue'
import type { Food, LogEntry, Unit } from '@/types/domain'

const log = useLogStore()
const recipes = useRecipesStore()
const foodsStore = useFoodsStore()
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
const loadingDetail = ref(false)
const detailError = ref(false)

const focusDate = ref<string>((route.query.date as string) || today)

const unitOptions: Array<{ label: Unit; value: Unit }> = [
  { label: 'g', value: 'g' },
  { label: 'ml', value: 'ml' },
]

const recipeOptions = computed(() =>
  recipes.recipes.map((r) => ({
    label: `${r.name} (${Math.round(r.perPortionMacros.calories)} kcal/portion)`,
    value: r.id,
  })),
)

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

async function onFoodSelect(food: Food) {
  detailError.value = false
  loadingDetail.value = true
  try {
    // Search hits carry per-serving macros only — fetch per-100 g detail
    // for the quantity preview and the log snapshot
    selectedFood.value = await foodsStore.getDetail(food)
  } catch {
    selectedFood.value = null
    detailError.value = true
  } finally {
    loadingDetail.value = false
  }
  if (selectedFood.value) {
    quantity.value = selectedFood.value.servingMetric.quantity
    unit.value = selectedFood.value.servingMetric.unit
  }
}

async function saveFoodEntry() {
  if (!selectedFood.value) return
  await log.addFoodLog(
    selectedFood.value,
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

  <n-card
    v-for="[date, dayEntries] in log.entriesByDate"
    :key="date"
    style="margin-top: 8px"
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
        <div class="row" style="justify-content: flex-end">
          <n-button size="small" @click="startAdd(date, 'food')">
            <template #icon>
              <n-icon :component="AddOutline" />
            </template>
            Food
          </n-button>
          <n-button size="small" @click="startAdd(date, 'recipe')">
            <template #icon>
              <n-icon :component="AddOutline" />
            </template>
            Recipe
          </n-button>
        </div>
      </div>
    </div>

    <n-table striped :bordered="true" class="macro-table">
      <thead>
        <tr>
          <th>Hour</th>
          <th>Item</th>
          <th>kcal</th>
          <th>P</th>
          <th>C</th>
          <th>F</th>
          <th></th>
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
    </n-table>
  </n-card>

  <p v-if="log.entries.length === 0" class="center-align">
    No log entries yet. Add your first food.
  </p>

  <n-modal
    v-if="addingForDate"
    :show="true"
    preset="card"
    :title="`Add ${addMode === 'food' ? 'Food' : 'Recipe'} — ${addingForDate}`"
    style="width: 90%; max-width: 640px"
    @update:show="
      (v: boolean) => {
        if (!v) cancelAdd()
      }
    "
  >
    <div class="col" style="margin-bottom: 8px">
      <label>Timestamp (hour)</label>
      <input v-model="timestamp" type="datetime-local" />
    </div>

    <div v-if="addMode === 'food'">
      <FoodSearch @select="onFoodSelect" />
      <div v-if="loadingDetail" class="row" style="margin-top: 8px">
        <n-spin :size="14" />
        <small>Loading macros…</small>
      </div>
      <p v-else-if="detailError" class="error" style="margin-top: 8px">
        Couldn't load macros for this food — pick another or try again.
      </p>
      <div v-if="selectedFood" class="row" style="margin-top: 8px">
        <n-input-number
          :value="quantity"
          :min="0"
          :step="1"
          @update:value="(v: number | null) => (quantity = v ?? 0)"
        >
          <template #prefix>Quantity</template>
        </n-input-number>
        <n-select
          :value="unit"
          :options="unitOptions"
          style="width: 100px"
          @update:value="(v: Unit) => (unit = v)"
        />
        <div class="col">
          <p>
            {{
              Math.round(
                foodMacrosForQuantity(selectedFood.nutrition100g, quantity).calories,
              )
            }}
            kcal ·
            {{
              Math.round(
                foodMacrosForQuantity(selectedFood.nutrition100g, quantity).protein,
              )
            }}g P ·
            {{
              Math.round(
                foodMacrosForQuantity(selectedFood.nutrition100g, quantity).carbs,
              )
            }}g C ·
            {{
              Math.round(foodMacrosForQuantity(selectedFood.nutrition100g, quantity).fat)
            }}g F
          </p>
        </div>
      </div>
      <div class="row" style="justify-content: flex-end; margin-top: 8px">
        <n-button @click="cancelAdd">Cancel</n-button>
        <n-button type="primary" :disabled="!selectedFood" @click="saveFoodEntry"
          >Save</n-button
        >
      </div>
    </div>

    <div v-else>
      <n-select
        v-model:value="selectedRecipeId"
        :options="recipeOptions"
        placeholder="Select a recipe..."
        filterable
      />
      <div style="margin-top: 8px">
        <n-input-number
          :value="portions"
          :min="0.5"
          :step="0.5"
          @update:value="(v: number | null) => (portions = v ?? 1)"
        >
          <template #prefix>Portions</template>
        </n-input-number>
      </div>
      <div class="row" style="justify-content: flex-end; margin-top: 8px">
        <n-button @click="cancelAdd">Cancel</n-button>
        <n-button type="primary" :disabled="!selectedRecipeId" @click="saveRecipeEntry"
          >Save</n-button
        >
      </div>
    </div>
  </n-modal>

  <n-modal
    v-if="editingEntry"
    :show="true"
    preset="card"
    title="Edit entry"
    style="width: 90%; max-width: 480px"
    @update:show="
      (v: boolean) => {
        if (!v) editingEntry = null
      }
    "
  >
    <p>
      {{
        editingEntry.kind === 'recipe'
          ? editingEntry.recipeRef?.recipeName
          : editingEntry.foodRef?.foodName
      }}
    </p>
    <div class="col">
      <label>Timestamp</label>
      <input v-model="timestamp" type="datetime-local" />
    </div>
    <template #footer>
      <div class="row" style="justify-content: flex-end">
        <n-button @click="editingEntry = null">Cancel</n-button>
        <n-button type="primary" @click="saveEdit">Save</n-button>
      </div>
    </template>
  </n-modal>

  <AttributionFooter />
</template>
