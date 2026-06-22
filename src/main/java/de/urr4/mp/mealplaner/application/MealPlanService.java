package de.urr4.mp.mealplaner.application;

import de.urr4.mp.mealplaner.domain.model.Recipe;
import de.urr4.mp.mealplaner.domain.model.ShoppingList;
import de.urr4.mp.mealplaner.domain.model.ShoppingList.ShoppingItem;
import de.urr4.mp.mealplaner.domain.port.in.MealPlanUseCase;
import de.urr4.mp.mealplaner.domain.port.out.RecipeRepository;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class MealPlanService implements MealPlanUseCase {

    private final RecipeRepository recipeRepository;

    public MealPlanService(RecipeRepository recipeRepository) {
        this.recipeRepository = recipeRepository;
    }

    @Override
    public List<Recipe> generate(int count) {
        return recipeRepository.findRandom(count);
    }

    @Override
    public Recipe swap(List<String> currentPlanIds, String recipeIdToSwap) {
        // Fetch one extra random recipe and pick the first that is not already in the plan
        int attempts = 0;
        while (attempts++ < 10) {
            List<Recipe> candidates = recipeRepository.findRandom(currentPlanIds.size() + 5);
            Optional<Recipe> replacement = candidates.stream()
                    .filter(r -> !currentPlanIds.contains(r.id()))
                    .findFirst();
            if (replacement.isPresent()) {
                return replacement.get();
            }
        }
        throw new IllegalStateException("Not enough recipes in the database to swap.");
    }

    @Override
    public ShoppingList commit(List<String> recipeIds) {
        // Collect all recipes, aggregate ingredients by name+unit
        Map<String, Double> totals = new LinkedHashMap<>();
        Map<String, String> units = new LinkedHashMap<>();

        for (String id : recipeIds) {
            recipeRepository.findById(id).ifPresent(recipe ->
                    recipe.ingredients().forEach(ri -> {
                        String key = ri.ingredient().name() + "||" + ri.unit();
                        double qty = parseQuantity(ri.quantity());
                        totals.merge(key, qty, Double::sum);
                        units.put(key, ri.unit());
                    })
            );
        }

        List<ShoppingItem> items = totals.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(e -> {
                    String[] parts = e.getKey().split("\\|\\|", 2);
                    String ingredientName = parts[0];
                    String unit = units.get(e.getKey());
                    String total = formatQuantity(e.getValue());
                    return new ShoppingItem(ingredientName, total, unit);
                })
                .collect(Collectors.toList());

        return new ShoppingList(items);
    }

    private double parseQuantity(String quantity) {
        if (quantity == null || quantity.isBlank()) return 0;
        try {
            return Double.parseDouble(quantity.trim().replace(",", "."));
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private String formatQuantity(double value) {
        if (value == Math.floor(value)) {
            return String.valueOf((long) value);
        }
        return String.format("%.2f", value);
    }
}
