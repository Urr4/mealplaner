package de.urr4.mp.mealplaner.domain.port.out;

import de.urr4.mp.mealplaner.domain.model.Recipe;

import java.util.List;
import java.util.Optional;

public interface RecipeRepository {

    Recipe save(Recipe recipe);

    Optional<Recipe> findById(String id);

    List<Recipe> findAll();

    List<Recipe> findByNameContaining(String name);

    List<Recipe> findByIngredientName(String ingredientName);

    List<Recipe> findRandom(int count);

    void deleteById(String id);
}
