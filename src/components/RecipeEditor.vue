<script setup lang="ts">
import { ref, watch } from 'vue'
import { TrashOutline } from '@vicons/ionicons5'
import { useRecipesStore } from '@/stores/recipes'
import { useFoodsStore } from '@/stores/foods'
import { computeRecipe } from '@/services/foodMcp'
import { supportedHouseholdUnits, toMetricAmount } from '@/utils/measure'
import type { Ingredient, Food, MeasureUnit, Macros } from '@/types/domain'
import FoodSearch from './FoodSearch.vue'

const props = defineProps<{
  recipeId?: string | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const recipes = useRecipesStore()
const foodsStore = useFoodsStore()

/**
 * Editor draft rows carry household units (ADR-0024); they are converted
 * to metric `Ingredient`s on save and for the server-side preview.
 */
interface DraftIngredient {
  foodId: string
  foodName: string
  quantity: number
  unit: MeasureUnit
}

const UNIT_LABEL: Record<MeasureUnit, string> = {
  g: 'g',
  ml: 'ml',
  serving: 'servings',
  cup: 'cup',
  tbsp: 'Tbsp',
  tsp: 'tsp',
}

const name = ref('')
const portions = ref(1)
const ingredients = ref<DraftIngredient[]>([])
/** Serving anchors per foodId — drive household conversion + unit pickers. */
const foodsById = ref<Record<string, Food>>({})
const searchRef = ref<InstanceType<typeof FoodSearch> | null>(null)

watch(
  () => props.recipeId,
  async (id) => {
    if (!id) return
    const r = await recipes.recipes.find((x) => x.id === id)
    if (r) {
      name.value = r.name
      portions.value = r.portions
      ingredients.value = [...r.ingredients]
      await Promise.all(
        Array.from(new Set(ingredients.value.map((i) => i.foodId))).map(loadFoodAnchors),
      )
    }
  },
  { immediate: true },
)

/** Best-effort anchor fetch so loaded rows can switch to household units. */
async function loadFoodAnchors(id: string): Promise<void> {
  if (foodsById.value[id]) return
  const cached = await foodsStore.getFood(id)
  if (cached) {
    foodsById.value[id] = cached
    return
  }
  const known = ingredients.value.find((i) => i.foodId === id)
  try {
    foodsById.value[id] = await foodsStore.getDetail({
      id,
      name: known?.foodName ?? id,
      altNames: [],
      type: null,
      servingMetric: { unit: 'g', quantity: 100 },
      servingCommon: null,
    })
  } catch {
    // unknown food — row falls back to a g/ml picker
  }
}

const ZERO_MACROS: Macros = { calories: 0, protein: 0, carbs: 0, fat: 0 }

// Per-portion preview is computed by the MCP tool (ADR-0020: all summation
// happens server-side); debounced while ingredients/portions are edited.
const previewMacros = ref<Macros>(ZERO_MACROS)
const computing = ref(false)
let computeDebounce: ReturnType<typeof setTimeout> | null = null

function scheduleCompute() {
  if (computeDebounce) clearTimeout(computeDebounce)
  const metric = toStorageIngredients()
  if (!metric || metric.length === 0) {
    previewMacros.value = ZERO_MACROS
    return
  }
  computeDebounce = setTimeout(async () => {
    computing.value = true
    try {
      const r = await computeRecipe(metric, portions.value || 1)
      previewMacros.value = r.perServingMacros ?? ZERO_MACROS
    } catch {
      previewMacros.value = ZERO_MACROS
    } finally {
      computing.value = false
    }
  }, 300)
}

/** Draft rows → metric Ingredient[] (ADR-0024). null if a row can't convert. */
function toStorageIngredients(): Ingredient[] | null {
  const out: Ingredient[] = []
  for (const row of ingredients.value) {
    const r = toMetricAmount(row.quantity, row.unit, foodsById.value[row.foodId] ?? null)
    if (!r.ok) return null
    out.push({
      foodId: row.foodId,
      foodName: row.foodName,
      quantity: Math.round(r.amount.quantity * 100) / 100,
      unit: r.amount.unit,
    })
  }
  return out
}

function rowUnitOptions(row: DraftIngredient): Array<{ label: string; value: MeasureUnit }> {
  const food = foodsById.value[row.foodId]
  const units: MeasureUnit[] = ['g', 'ml', ...supportedHouseholdUnits(food)]
  return units.map((u) => ({ label: UNIT_LABEL[u], value: u }))
}

/**
 * Validation display: the converted metric mass shown alongside
 * household entries, e.g. "1.5 cup ≈ 306 g".
 */
function rowMetricLabel(row: DraftIngredient): string | null {
  if (row.unit === 'g' || row.unit === 'ml') return null
  const r = toMetricAmount(row.quantity, row.unit, foodsById.value[row.foodId] ?? null)
  if (!r.ok) return '?'
  const q =
    r.amount.quantity >= 10
      ? Math.round(r.amount.quantity)
      : Math.round(r.amount.quantity * 10) / 10
  return `≈ ${q} ${r.amount.unit}`
}

/** Unit switch preserves the row's metric mass (51 g ↔ 1 serving ↔ 0.25 cup). */
function onUnitChange(row: DraftIngredient, unit: MeasureUnit) {
  const food = foodsById.value[row.foodId] ?? null
  const cur = toMetricAmount(row.quantity, row.unit, food)
  const perOne = toMetricAmount(1, unit, food)
  if (cur.ok && perOne.ok && perOne.amount.quantity > 0 && cur.amount.unit === perOne.amount.unit) {
    row.quantity = Math.round((cur.amount.quantity / perOne.amount.quantity) * 100) / 100
  }
  row.unit = unit
}

watch(ingredients, scheduleCompute, { deep: true })
watch(portions, scheduleCompute)

function addIngredient(food: Food) {
  foodsById.value[food.id] = food
  ingredients.value.push({
    foodId: food.id,
    foodName: food.name,
    quantity: food.servingMetric.quantity,
    unit: food.servingMetric.unit,
  })
  searchRef.value?.clear()
}

function removeIngredient(idx: number) {
  ingredients.value.splice(idx, 1)
}

function onModalShowChange(show: boolean) {
  if (!show) emit('close')
}

async function save() {
  const metric = toStorageIngredients()
  if (!name.value.trim() || !metric || metric.length === 0) return
  if (props.recipeId) {
    await recipes.updateRecipe(props.recipeId, name.value, metric, portions.value || 1)
  } else {
    await recipes.createRecipe(name.value, metric, portions.value || 1)
  }
  emit('close')
}
</script>

<template>
  <n-modal
    :show="true"
    preset="card"
    :title="recipeId ? 'Edit Recipe' : 'New Recipe'"
    style="width: 90%; max-width: 640px"
    @update:show="onModalShowChange"
  >
    <n-input v-model:value="name" placeholder="Recipe name" />

    <div style="margin-top: 8px">
      <n-input-number
        :value="portions"
        :min="1"
        :step="1"
        @update:value="(v: number | null) => (portions = v ?? 1)"
      >
        <template #prefix>Portions</template>
      </n-input-number>
    </div>

    <h6>Ingredients</h6>
    <FoodSearch ref="searchRef" @select="addIngredient" />

    <n-table :bordered="true" class="macro-table" style="margin-top: 8px">
      <thead>
        <tr>
          <th>Ingredient</th>
          <th>Qty</th>
          <th>Unit</th>
          <th>Mass</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(ing, idx) in ingredients" :key="idx">
          <td>{{ ing.foodName }}</td>
          <td>
            <n-input-number
              :value="ing.quantity"
              :min="0"
              :step="1"
              size="small"
              style="width: 110px"
              @update:value="(v: number | null) => (ing.quantity = v ?? 0)"
            />
          </td>
          <td>
            <n-select
              :value="ing.unit"
              :options="rowUnitOptions(ing)"
              size="small"
              style="width: 110px"
              @update:value="(v: MeasureUnit) => onUnitChange(ing, v)"
            />
          </td>
          <td>
            <small v-if="rowMetricLabel(ing)">{{ rowMetricLabel(ing) }}</small>
          </td>
          <td>
            <n-button quaternary circle size="small" @click="removeIngredient(idx)">
              <template #icon>
                <n-icon :component="TrashOutline" />
              </template>
            </n-button>
          </td>
        </tr>
      </tbody>
    </n-table>

    <div class="row" style="margin-top: 8px">
      <div class="col">
        <h6>Per portion</h6>
        <p v-if="computing">
          <n-spin :size="14" />
        </p>
        <p v-else>
          {{ Math.round(previewMacros.calories) }} kcal ·
          {{ Math.round(previewMacros.protein) }}g P ·
          {{ Math.round(previewMacros.carbs) }}g C · {{ Math.round(previewMacros.fat) }}g
          F
        </p>
      </div>
    </div>

    <template #footer>
      <div class="row" style="justify-content: flex-end">
        <n-button @click="emit('close')">Cancel</n-button>
        <n-button type="primary" @click="save">Save</n-button>
      </div>
    </template>
  </n-modal>
</template>
