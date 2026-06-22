export interface Person {
  id: string;
  name: string;
}

export interface RecipeIngredient {
  id?: string;
  name: string;
  quantity: string;
  unit: string;
  sort_order?: number;
}

export interface RecipeStep {
  id?: string;
  step_number?: number;
  instruction: string;
}

export interface Recipe {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  imageId: string | null;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  likedBy: Person[];
  dislikedBy: Person[];
  createdAt?: string;
}

export interface RecipeSummary {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  ingredientCount: number;
  likedBy: Person[];
  dislikedBy: Person[];
}

export interface RecipeRequest {
  name: string;
  description: string;
  ingredients: { name: string; quantity: string; unit: string }[];
  steps: string[];
  likedBy: string[];
  dislikedBy: string[];
}

export interface ParsedRecipe {
  name: string;
  description: string;
  ingredients: { name: string; quantity: string; unit: string }[];
  steps: string[];
}

export interface MealPlanEntry {
  recipe: RecipeSummary | null;
  noMatch: boolean;
}

export interface MealPlanConstraint {
  personId: string;
  preference: 'liked' | 'disliked';
  count: number;
}

export interface ShoppingItem {
  name: string;
  quantity: string;
  unit: string;
}

export interface ShoppingList {
  items: ShoppingItem[];
}

export interface Settings {
  ollama_url?: string;
  ollama_vision_model?: string;
  ollama_text_model?: string;
}

