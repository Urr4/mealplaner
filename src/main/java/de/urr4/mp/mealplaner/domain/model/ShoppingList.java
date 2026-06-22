package de.urr4.mp.mealplaner.domain.model;

import java.util.List;
import java.util.Map;

/**
 * The result of committing to a meal plan: a map of ingredient name
 * to the total amount needed (quantity + unit concatenated).
 */
public record ShoppingList(List<ShoppingItem> items) {

    public record ShoppingItem(String ingredientName, String totalAmount, String unit) {}
}
