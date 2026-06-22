package de.urr4.mp.mealplaner.web.dto;

import java.util.List;

public record RecipeRequest(
        String name,
        String description,
        List<RecipeIngredientRequest> ingredients
) {
    public record RecipeIngredientRequest(
            String ingredientId,
            String ingredientName,
            String quantity,
            String unit
    ) {}
}
