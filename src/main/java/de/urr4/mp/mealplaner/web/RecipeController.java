package de.urr4.mp.mealplaner.web;

import de.urr4.mp.mealplaner.domain.model.Recipe;
import de.urr4.mp.mealplaner.domain.port.in.RecipeUseCase;
import de.urr4.mp.mealplaner.web.dto.RecipeDto;
import de.urr4.mp.mealplaner.web.dto.RecipeRequest;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/recipes")
public class RecipeController {

    private final RecipeUseCase recipeUseCase;

    public RecipeController(RecipeUseCase recipeUseCase) {
        this.recipeUseCase = recipeUseCase;
    }

    @GetMapping
    public List<RecipeDto> getAll(HttpServletRequest request) {
        return recipeUseCase.getAllRecipes().stream()
                .map(r -> RecipeMapper.toDto(r, baseUrl(request)))
                .collect(Collectors.toList());
    }

    @GetMapping("/{id}")
    public ResponseEntity<RecipeDto> getById(@PathVariable String id, HttpServletRequest request) {
        return recipeUseCase.getRecipeById(id)
                .map(r -> ResponseEntity.ok(RecipeMapper.toDto(r, baseUrl(request))))
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/search")
    public List<RecipeDto> search(
            @RequestParam(required = false) String name,
            @RequestParam(required = false) String ingredient,
            HttpServletRequest request) {
        List<Recipe> results;
        if (ingredient != null && !ingredient.isBlank()) {
            results = recipeUseCase.searchByIngredient(ingredient);
        } else if (name != null && !name.isBlank()) {
            results = recipeUseCase.searchByName(name);
        } else {
            results = recipeUseCase.getAllRecipes();
        }
        return results.stream()
                .map(r -> RecipeMapper.toDto(r, baseUrl(request)))
                .collect(Collectors.toList());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public RecipeDto create(@RequestBody RecipeRequest req, HttpServletRequest request) {
        Recipe recipe = recipeUseCase.createRecipe(RecipeMapper.toDomain(req));
        return RecipeMapper.toDto(recipe, baseUrl(request));
    }

    @PutMapping("/{id}")
    public RecipeDto update(@PathVariable String id,
                            @RequestBody RecipeRequest req,
                            HttpServletRequest request) {
        Recipe recipe = recipeUseCase.updateRecipe(RecipeMapper.toDomain(id, req));
        return RecipeMapper.toDto(recipe, baseUrl(request));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String id) {
        recipeUseCase.deleteRecipe(id);
    }

    @PostMapping(value = "/{id}/image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public RecipeDto uploadImage(@PathVariable String id,
                                 @RequestParam("file") MultipartFile file,
                                 HttpServletRequest request) throws IOException {
        Recipe recipe = recipeUseCase.setImage(id, file.getBytes(), file.getContentType());
        return RecipeMapper.toDto(recipe, baseUrl(request));
    }

    @DeleteMapping("/{id}/image")
    public RecipeDto removeImage(@PathVariable String id, HttpServletRequest request) {
        Recipe recipe = recipeUseCase.removeImage(id);
        return RecipeMapper.toDto(recipe, baseUrl(request));
    }

    private String baseUrl(HttpServletRequest request) {
        return request.getScheme() + "://" + request.getServerName() +
                (request.getServerPort() == 80 || request.getServerPort() == 443
                        ? "" : ":" + request.getServerPort());
    }
}
