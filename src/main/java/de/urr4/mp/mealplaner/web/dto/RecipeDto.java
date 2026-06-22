package de.urr4.mp.mealplaner.web.dto;

import java.util.List;

public record RecipeDto(
        String id,
        String name,
        String description,
        String imageUrl,          // null if no image; points to /api/recipes/{id}/image
        List<RecipeIngredientDto> ingredients,
        List<UserDto> likedBy,
        List<UserDto> dislikedBy
) {}
