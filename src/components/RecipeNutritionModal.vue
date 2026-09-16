<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { computeRecipe } from '@/services/foodMcp'
import type { Recipe } from '@/types/domain'
import type {
  ComputeRecipeMacrosResult,
  ServedNutrient,
} from '@nutrition-tracker/shared/types'
import NutritionTable from './NutritionTable.vue'
import AttributionFooter from './AttributionFooter.vue'

const props = defineProps<{
  recipe: Recipe
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const result = ref<ComputeRecipeMacrosResult | null>(null)
const loading = ref(false)
const error = ref(false)
const basis = ref<'portion' | 'recipe'>('portion')

onMounted(async () => {
  loading.value = true
  try {
    result.value = await computeRecipe(props.recipe.ingredients, props.recipe.portions)
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
})

const rows = computed<ServedNutrient[]>(() => {
  if (!result.value) return []
  const rows =
    basis.value === 'portion'
      ? result.value.perServingNutrition
      : result.value.totalNutrition
  return rows ?? []
})
</script>

<template>
  <n-modal
    :show="true"
    preset="card"
    :title="`${recipe.name} — nutrient breakdown`"
    style="width: 90%; max-width: 640px"
    @update:show="
      (v: boolean) => {
        if (!v) emit('close')
      }
    "
  >
    <div v-if="loading" class="row" style="justify-content: center">
      <n-spin :size="14" />
      <small>Computing…</small>
    </div>
    <p v-else-if="error" class="error center-align">
      Couldn't compute the nutrient breakdown — try again.
    </p>
    <template v-else-if="result">
      <div class="row" style="justify-content: center; margin-bottom: 8px">
        <n-radio-group v-model:value="basis" size="small">
          <n-radio-button value="portion">Per portion</n-radio-button>
          <n-radio-button value="recipe">
            Whole recipe ({{ recipe.portions }}×)
          </n-radio-button>
        </n-radio-group>
      </div>
      <NutritionTable :rows="rows" />
      <ul v-if="result.caveats.length > 0" class="caveats">
        <li v-for="c in result.caveats" :key="c">{{ c }}</li>
      </ul>
      <AttributionFooter />
    </template>
    <template #footer>
      <div class="row" style="justify-content: flex-end">
        <n-button @click="emit('close')">Close</n-button>
      </div>
    </template>
  </n-modal>
</template>
