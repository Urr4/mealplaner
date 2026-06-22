package de.urr4.mp.mealplaner.web;

import de.urr4.mp.mealplaner.domain.model.Recipe;
import de.urr4.mp.mealplaner.domain.model.ShoppingList;
import de.urr4.mp.mealplaner.domain.port.in.MealPlanUseCase;
import de.urr4.mp.mealplaner.web.dto.RecipeDto;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/mealplan")
public class MealPlanController {

    private final MealPlanUseCase mealPlanUseCase;

    public MealPlanController(MealPlanUseCase mealPlanUseCase) {
        this.mealPlanUseCase = mealPlanUseCase;
    }

    @GetMapping
    public List<RecipeDto> generate(
            @RequestParam(defaultValue = "5") int count,
            HttpServletRequest request) {
        return mealPlanUseCase.generate(count).stream()
                .map(r -> RecipeMapper.toDto(r, baseUrl(request)))
                .collect(Collectors.toList());
    }

    @PostMapping("/swap")
    public RecipeDto swap(@RequestBody SwapRequest req, HttpServletRequest request) {
        Recipe replacement = mealPlanUseCase.swap(req.currentPlanIds(), req.recipeIdToSwap());
        return RecipeMapper.toDto(replacement, baseUrl(request));
    }

    @PostMapping("/commit")
    public ShoppingList commit(@RequestBody CommitRequest req) {
        return mealPlanUseCase.commit(req.recipeIds());
    }

    private String baseUrl(HttpServletRequest request) {
        return request.getScheme() + "://" + request.getServerName() +
                (request.getServerPort() == 80 || request.getServerPort() == 443
                        ? "" : ":" + request.getServerPort());
    }

    public record SwapRequest(List<String> currentPlanIds, String recipeIdToSwap) {}
    public record CommitRequest(List<String> recipeIds) {}
}
