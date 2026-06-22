import axios from 'axios';
import type {
  Recipe, RecipeSummary, RecipeRequest, ParsedRecipe,
  Person, MealPlanEntry, MealPlanConstraint,
  ShoppingList, Settings
} from '../types';

const api = axios.create({ baseURL: '/api' });

// ── Rezepte ───────────────────────────────────────────────────────────────────
export const getRecipes = (name?: string, ingredient?: string) =>
  api.get<Recipe[]>('/recipes', { params: { name, ingredient } }).then(r => r.data);

export const getRecipe = (id: string) =>
  api.get<Recipe>(`/recipes/${id}`).then(r => r.data);

export const createRecipe = (req: RecipeRequest) =>
  api.post<Recipe>('/recipes', req).then(r => r.data);

export const updateRecipe = (id: string, req: RecipeRequest) =>
  api.put<Recipe>(`/recipes/${id}`, req).then(r => r.data);

export const deleteRecipe = (id: string) =>
  api.delete(`/recipes/${id}`);

export const uploadImage = (id: string, file: File) => {
  const form = new FormData();
  form.append('file', file);
  return api.post<Recipe>(`/recipes/${id}/image`, form).then(r => r.data);
};

export const removeImage = (id: string) =>
  api.delete<Recipe>(`/recipes/${id}/image`).then(r => r.data);

export const parseRecipeFromImage = (file: File) => {
  const form = new FormData();
  form.append('file', file);
  return api.post<ParsedRecipe>('/recipes/parse/image', form).then(r => r.data);
};

export const parseRecipeFromText = (text: string) =>
  api.post<ParsedRecipe>('/recipes/parse/text', { text }).then(r => r.data);

export const getOllamaStatus = () =>
  api.get<{ available: boolean; downloading: boolean; modelsReady: boolean; error: string | null }>('/recipes/ollama/status').then(r => r.data);

// ── Personen ──────────────────────────────────────────────────────────────────
export const getPersons = () =>
  api.get<Person[]>('/persons').then(r => r.data);

export const createPerson = (name: string) =>
  api.post<Person>('/persons', { name }).then(r => r.data);

export const deletePerson = (id: string) =>
  api.delete(`/persons/${id}`);

// ── Wochenplan ────────────────────────────────────────────────────────────────
export const generateMealPlan = (count: number, constraints: MealPlanConstraint[]) =>
  api.post<MealPlanEntry[]>('/mealplan/generate', { count, constraints }).then(r => r.data);

export const swapRecipe = (currentRecipeIds: string[], recipeIdToSwap: string, position: number) =>
  api.post<RecipeSummary>('/mealplan/swap', { currentRecipeIds, recipeIdToSwap, position }).then(r => r.data);

export const getCurrentMealPlan = () =>
  api.get<MealPlanEntry[]>('/mealplan/current').then(r => r.data);

export const getShoppingList = (recipeIds: string[]) =>
  api.post<ShoppingList>('/mealplan/shopping-list', { recipeIds }).then(r => r.data);

/**
 * Returns a map of ingredient name (lowercase) → most-used unit across all recipes.
 * Used to auto-fill the unit field for consistency when creating/editing recipes.
 */
export const getCanonicalUnits = () =>
  api.get<Record<string, string>>('/recipes/ingredients/canonical').then(r => r.data);

export const getUsedUnits = () =>
  api.get<string[]>('/recipes/units').then(r => r.data);

// ── Einstellungen ─────────────────────────────────────────────────────────────
export const getSettings = () =>
  api.get<Settings>('/settings').then(r => r.data);

export const saveSettings = (settings: Partial<Settings>) =>
  api.put('/settings', settings).then(r => r.data);

