<script setup lang="ts">
import { ref } from 'vue'
import {
  AddOutline,
  CreateOutline,
  DocumentTextOutline,
  TrashOutline,
} from '@vicons/ionicons5'
import { useRecipesStore } from '@/stores/recipes'
import RecipeEditor from '@/components/RecipeEditor.vue'
import RecipeNutritionModal from '@/components/RecipeNutritionModal.vue'
import AttributionFooter from '@/components/AttributionFooter.vue'
import type { Recipe } from '@/types/domain'

const recipes = useRecipesStore()
const editing = ref<{ id: string | null; open: boolean }>({ id: null, open: false })
const detailRecipe = ref<Recipe | null>(null)

function newRecipe() {
  editing.value = { id: null, open: true }
}

function editRecipe(id: string) {
  editing.value = { id, open: true }
}

function closeEditor() {
  editing.value = { id: null, open: false }
}

function showNutrition(id: string) {
  const r = recipes.recipes.find((x) => x.id === id)
  if (r) detailRecipe.value = r
}
</script>

<template>
  <header><h2>Recipes</h2></header>

  <div class="center-align" style="margin-top: 8px">
    <n-button type="primary" @click="newRecipe">
      <template #icon>
        <n-icon :component="AddOutline" />
      </template>
      New recipe
    </n-button>
  </div>

  <n-card v-for="r in recipes.recipes" :key="r.id" style="margin-top: 8px">
    <div class="row">
      <div class="col">
        <h4>{{ r.name }}</h4>
        <small>{{ r.portions }} portions · {{ r.ingredients.length }} ingredients</small>
      </div>
      <div class="col right-align">
        <p>
          {{ Math.round(r.perPortionMacros.calories) }} kcal ·
          {{ Math.round(r.perPortionMacros.protein) }}g P ·
          {{ Math.round(r.perPortionMacros.carbs) }}g C ·
          {{ Math.round(r.perPortionMacros.fat) }}g F
        </p>
        <n-button
          quaternary
          circle
          size="small"
          title="Nutrient breakdown"
          @click="showNutrition(r.id)"
        >
          <template #icon>
            <n-icon :component="DocumentTextOutline" />
          </template>
        </n-button>
        <n-button quaternary circle size="small" @click="editRecipe(r.id)">
          <template #icon>
            <n-icon :component="CreateOutline" />
          </template>
        </n-button>
        <n-button quaternary circle size="small" @click="recipes.deleteRecipe(r.id)">
          <template #icon>
            <n-icon :component="TrashOutline" />
          </template>
        </n-button>
      </div>
    </div>
  </n-card>

  <p v-if="recipes.recipes.length === 0" class="center-align">
    No recipes yet. Create your first one.
  </p>

  <RecipeEditor v-if="editing.open" :recipe-id="editing.id" @close="closeEditor" />
  <RecipeNutritionModal
    v-if="detailRecipe"
    :recipe="detailRecipe"
    @close="detailRecipe = null"
  />
  <AttributionFooter />
</template>
