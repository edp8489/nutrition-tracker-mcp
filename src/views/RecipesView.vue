<script setup lang="ts">
import { ref } from 'vue'
import { useRecipesStore } from '@/stores/recipes'
import RecipeEditor from '@/components/RecipeEditor.vue'
import AttributionFooter from '@/components/AttributionFooter.vue'

const recipes = useRecipesStore()
const editing = ref<{ id: string | null; open: boolean }>({ id: null, open: false })

function newRecipe() {
  editing.value = { id: null, open: true }
}

function editRecipe(id: string) {
  editing.value = { id, open: true }
}

function closeEditor() {
  editing.value = { id: null, open: false }
}
</script>

<template>
  <header><h5>Recipes</h5></header>
  <button class="round" @click="newRecipe">
    <i>add</i><span>New recipe</span>
  </button>

  <article v-for="r in recipes.recipes" :key="r.id" class="card padding">
    <div class="row">
      <div class="col">
        <h6>{{ r.name }}</h6>
        <small>{{ r.portions }} portions · {{ r.ingredients.length }} ingredients</small>
      </div>
      <div class="col right-align">
        <p>
          {{ Math.round(r.perPortionMacros.calories) }} kcal ·
          {{ Math.round(r.perPortionMacros.protein) }}g P ·
          {{ Math.round(r.perPortionMacros.carbs) }}g C ·
          {{ Math.round(r.perPortionMacros.fat) }}g F
        </p>
        <button class="chip circle" @click="editRecipe(r.id)"><i>edit</i></button>
        <button class="chip circle" @click="recipes.deleteRecipe(r.id)"><i>delete</i></button>
      </div>
    </div>
  </article>

  <p v-if="recipes.recipes.length === 0" class="center-align">
    No recipes yet. Create your first one.
  </p>

  <RecipeEditor
    v-if="editing.open"
    :recipe-id="editing.id"
    @close="closeEditor"
  />
  <AttributionFooter />
</template>
