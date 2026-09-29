<script setup lang="ts">
import { onMounted, ref } from 'vue'
import {
  AddOutline,
  CloudDownloadOutline,
  CreateOutline,
  DocumentTextOutline,
  DownloadOutline,
  RefreshOutline,
  TrashOutline,
} from '@vicons/ionicons5'
import {
  serializeExportFile,
  type ExportRecipe,
} from '@nutrition-tracker/shared/serialization'
import { callTool } from '@/services/mcp'
import { useRecipesStore } from '@/stores/recipes'
import RecipeEditor from '@/components/RecipeEditor.vue'
import RecipeNutritionModal from '@/components/RecipeNutritionModal.vue'
import AttributionFooter from '@/components/AttributionFooter.vue'
import { downloadJson, slugify, todayStamp } from '@/utils/exportFile'
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

// --- export (ADR-0027) --------------------------------------------------------

function exportRecipe(r: Recipe) {
  downloadJson(
    `nutrition-tracker-recipe-${slugify(r.name)}.json`,
    serializeExportFile([r]),
  )
}


// --- server recipes (ADR-0028) ------------------------------------------------

interface ServerRecipesResult {
  recipes: ExportRecipe[]
  files: number
  skipped: string[]
  caveats: string[]
}

const serverRecipes = ref<ExportRecipe[]>([])
const serverCaveats = ref<string[]>([])
const serverLoading = ref(false)
const serverError = ref<string | null>(null)
const importingId = ref<string | null>(null)
const importError = ref<string | null>(null)

async function fetchServerRecipes() {
  serverLoading.value = true
  serverError.value = null
  serverCaveats.value = []
  try {
    const result = await callTool<ServerRecipesResult>('getServerRecipes', {})
    serverRecipes.value = result.recipes
    serverCaveats.value = result.caveats
  } catch (err) {
    serverError.value = err instanceof Error ? err.message : String(err)
    serverRecipes.value = []
  } finally {
    serverLoading.value = false
  }
}

/** Copies the server recipe into personal recipes with a new id (ADR-0028). */
async function importServerRecipe(r: ExportRecipe) {
  importingId.value = r.id
  importError.value = null
  try {
    await recipes.createRecipe(r.name, r.ingredients, r.portions)
  } catch (err) {
    importError.value = err instanceof Error ? err.message : String(err)
  } finally {
    importingId.value = null
  }
}

onMounted(() => {
  fetchServerRecipes()
})
</script>

<template>
  <header><h2>Recipes</h2></header>

  <div class="center-align" style="margin-top: 8px">
    <n-space justify="center">
      <n-button type="primary" @click="newRecipe">
        <template #icon>
          <n-icon :component="AddOutline" />
        </template>
        New recipe
      </n-button>
    </n-space>
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
      </div>
    </div>
    <n-space justify="end" style="margin-top: 4px">
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
      <n-button
        quaternary
        circle
        size="small"
        title="Export recipe to a JSON file"
        @click="exportRecipe(r)"
      >
        <template #icon>
          <n-icon :component="DownloadOutline" />
        </template>
      </n-button>
      <n-button quaternary circle size="small" title="Edit" @click="editRecipe(r.id)">
        <template #icon>
          <n-icon :component="CreateOutline" />
        </template>
      </n-button>
      <n-button
        quaternary
        circle
        size="small"
        title="Delete"
        @click="recipes.deleteRecipe(r.id)"
      >
        <template #icon>
          <n-icon :component="TrashOutline" />
        </template>
      </n-button>
    </n-space>
  </n-card>

  <p v-if="recipes.recipes.length === 0" class="center-align">
    No recipes yet. Create your first one.
  </p>

  <n-divider />
  <n-card style="margin-top: 8px">
  <n-collapse :default-expanded-names="[]" style="margin-top: 8px">
    <template #header-extra>
     ({{ serverRecipes.length }}) Available
    </template>
    <n-collapse-item name="server" title="Server recipes" extra="Read-only">
      <n-space vertical>
        <n-space align="center">
          <small>
            Refresh
          </small>
          <n-button
            quaternary
            circle
            size="tiny"
            title="Refresh server recipes"
            :loading="serverLoading"
            @click="fetchServerRecipes"
          >
            <template #icon>
              <n-icon :component="RefreshOutline" />
            </template>
          </n-button>
        </n-space>

        <n-alert v-if="serverError" type="error" :show-icon="false">
          {{ serverError }}
        </n-alert>
        <n-alert
          v-if="serverCaveats.length > 0"
          type="warning"
          :show-icon="false"
          closable
          @close="serverCaveats = []"
        >
          <p v-for="c in serverCaveats" :key="c">{{ c }}</p>
        </n-alert>
        <n-alert v-if="importError" type="error" :show-icon="false">
          {{ importError }}
        </n-alert>

        <n-card
          v-for="r in serverRecipes"
          :key="r.id"
          size="small"
          :bordered="false"
          embedded
        >
          <div class="row">
            <div class="col">
              <h4>
                <n-tag size="small" type="info" :bordered="false">server</n-tag>
                {{ r.name }}
              </h4>
              <small
                >{{ r.portions }} portions · {{ r.ingredients.length }} ingredients</small
              >
            </div>
            <div class="col right-align">
              <p>
                {{ Math.round(r.perPortionMacros.calories) }} kcal ·
                {{ Math.round(r.perPortionMacros.protein) }}g P ·
                {{ Math.round(r.perPortionMacros.carbs) }}g C ·
                {{ Math.round(r.perPortionMacros.fat) }}g F
              </p>
              <n-button
                size="small"
                secondary
                :loading="importingId === r.id"
                title="Copy this recipe into your recipes with a new id"
                @click="importServerRecipe(r)"
              >
                <template #icon>
                  <n-icon :component="CloudDownloadOutline" />
                </template>
                Import to my recipes
              </n-button>
            </div>
          </div>
        </n-card>

        <p v-if="!serverLoading && serverRecipes.length === 0" class="center-align">
          No server recipes found.
        </p>
      </n-space>
    </n-collapse-item>
  </n-collapse>
  </n-card>

  <RecipeEditor v-if="editing.open" :recipe-id="editing.id" @close="closeEditor" />
  <RecipeNutritionModal
    v-if="detailRecipe"
    :recipe="detailRecipe"
    @close="detailRecipe = null"
  />
  <AttributionFooter />
</template>
