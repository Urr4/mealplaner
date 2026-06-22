package de.urr4.mp.mealplaner.domain.port.in;

import de.urr4.mp.mealplaner.domain.model.Recipe;

import java.util.List;
import java.util.Optional;

public interface RecipeUseCase {

    Recipe createRecipe(Recipe recipe);

    Recipe updateRecipe(Recipe recipe);

    void deleteRecipe(String id);

    Optional<Recipe> getRecipeById(String id);

    List<Recipe> getAllRecipes();

    List<Recipe> searchByName(String name);

    List<Recipe> searchByIngredient(String ingredientName);

    /** Attach an uploaded image to a recipe; returns the updated recipe. */
    Recipe setImage(String recipeId, byte[] imageData, String contentType);

    /** Remove the image from a recipe; also deletes it from the image store. */
    Recipe removeImage(String recipeId);
}
