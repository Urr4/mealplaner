package de.urr4.mp.mealplaner.domain.port.in;

import de.urr4.mp.mealplaner.domain.model.Recipe;
import de.urr4.mp.mealplaner.domain.model.ShoppingList;

import java.util.List;

public interface MealPlanUseCase {

    /** Generate a random meal plan of {@code count} recipes. */
    List<Recipe> generate(int count);

    /**
     * Swap the recipe with the given id for another random recipe
     * that is not already in the current plan.
     *
     * @param currentPlanIds ids of recipes currently in the plan
     * @param recipeIdToSwap id of the recipe to replace
     * @return the new recipe to put in its place
     */
    Recipe swap(List<String> currentPlanIds, String recipeIdToSwap);

    /** Aggregate all ingredients from the given recipe ids into a shopping list. */
    ShoppingList commit(List<String> recipeIds);
}
