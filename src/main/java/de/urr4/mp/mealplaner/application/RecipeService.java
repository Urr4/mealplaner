package de.urr4.mp.mealplaner.application;

import de.urr4.mp.mealplaner.domain.model.Recipe;
import de.urr4.mp.mealplaner.domain.port.in.RecipeUseCase;
import de.urr4.mp.mealplaner.domain.port.out.ImageStore;
import de.urr4.mp.mealplaner.domain.port.out.RecipeRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class RecipeService implements RecipeUseCase {

    private final RecipeRepository recipeRepository;
    private final ImageStore imageStore;

    public RecipeService(RecipeRepository recipeRepository, ImageStore imageStore) {
        this.recipeRepository = recipeRepository;
        this.imageStore = imageStore;
    }

    @Override
    public Recipe createRecipe(Recipe recipe) {
        return recipeRepository.save(recipe);
    }

    @Override
    public Recipe updateRecipe(Recipe recipe) {
        recipeRepository.findById(recipe.id())
                .orElseThrow(() -> new IllegalArgumentException("Recipe not found: " + recipe.id()));
        return recipeRepository.save(recipe);
    }

    @Override
    public void deleteRecipe(String id) {
        recipeRepository.findById(id).ifPresent(recipe -> {
            if (recipe.imageId() != null) {
                imageStore.delete(recipe.imageId());
            }
        });
        recipeRepository.deleteById(id);
    }

    @Override
    public Optional<Recipe> getRecipeById(String id) {
        return recipeRepository.findById(id);
    }

    @Override
    public List<Recipe> getAllRecipes() {
        return recipeRepository.findAll();
    }

    @Override
    public List<Recipe> searchByName(String name) {
        return recipeRepository.findByNameContaining(name);
    }

    @Override
    public List<Recipe> searchByIngredient(String ingredientName) {
        return recipeRepository.findByIngredientName(ingredientName);
    }

    @Override
    public Recipe setImage(String recipeId, byte[] imageData, String contentType) {
        Recipe recipe = recipeRepository.findById(recipeId)
                .orElseThrow(() -> new IllegalArgumentException("Recipe not found: " + recipeId));
        // Delete old image if present
        if (recipe.imageId() != null) {
            imageStore.delete(recipe.imageId());
        }
        String newImageId = imageStore.store(imageData, contentType);
        return recipeRepository.save(recipe.withImageId(newImageId));
    }

    @Override
    public Recipe removeImage(String recipeId) {
        Recipe recipe = recipeRepository.findById(recipeId)
                .orElseThrow(() -> new IllegalArgumentException("Recipe not found: " + recipeId));
        if (recipe.imageId() != null) {
            imageStore.delete(recipe.imageId());
        }
        return recipeRepository.save(recipe.withImageId(null));
    }
}
