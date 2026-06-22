package de.urr4.mp.mealplaner.domain.model;

import java.util.List;

public record Recipe(
        String id,
        String name,
        String description,
        String imageId,          // nullable – not all recipes have an image
        List<RecipeIngredient> ingredients,
        List<User> likedBy,
        List<User> dislikedBy
) {
    public Recipe withImageId(String imageId) {
        return new Recipe(id, name, description, imageId, ingredients, likedBy, dislikedBy);
    }
}
