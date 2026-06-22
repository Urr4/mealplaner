package de.urr4.mp.mealplaner.web;

import de.urr4.mp.mealplaner.domain.model.*;
import de.urr4.mp.mealplaner.web.dto.*;

import java.util.List;
import java.util.stream.Collectors;

public class RecipeMapper {

    private RecipeMapper() {}

    public static RecipeDto toDto(Recipe recipe, String baseUrl) {
        String imageUrl = recipe.imageId() != null
                ? baseUrl + "/api/recipes/" + recipe.id() + "/image"
                : null;

        List<RecipeIngredientDto> ingredients = recipe.ingredients().stream()
                .map(ri -> new RecipeIngredientDto(
                        new IngredientDto(ri.ingredient().id(), ri.ingredient().name()),
                        ri.quantity(),
                        ri.unit()))
                .collect(Collectors.toList());

        List<UserDto> likedBy = recipe.likedBy().stream()
                .map(u -> new UserDto(u.id(), u.name()))
                .collect(Collectors.toList());

        List<UserDto> dislikedBy = recipe.dislikedBy().stream()
                .map(u -> new UserDto(u.id(), u.name()))
                .collect(Collectors.toList());

        return new RecipeDto(recipe.id(), recipe.name(), recipe.description(),
                imageUrl, ingredients, likedBy, dislikedBy);
    }

    public static Recipe toDomain(RecipeRequest req) {
        List<RecipeIngredient> ingredients = req.ingredients() == null ? List.of() :
                req.ingredients().stream()
                        .map(r -> new RecipeIngredient(
                                new Ingredient(r.ingredientId(), r.ingredientName()),
                                r.quantity(),
                                r.unit()))
                        .collect(Collectors.toList());
        return new Recipe(null, req.name(), req.description(), null, ingredients, List.of(), List.of());
    }

    public static Recipe toDomain(String id, RecipeRequest req) {
        Recipe base = toDomain(req);
        return new Recipe(id, base.name(), base.description(), null,
                base.ingredients(), base.likedBy(), base.dislikedBy());
    }
}
