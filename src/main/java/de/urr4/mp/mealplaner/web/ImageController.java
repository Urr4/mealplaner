package de.urr4.mp.mealplaner.web;

import de.urr4.mp.mealplaner.domain.port.in.RecipeUseCase;
import de.urr4.mp.mealplaner.domain.port.out.ImageStore;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Proxies image bytes from the image store so the frontend never talks to MinIO directly.
 */
@RestController
@RequestMapping("/api/recipes")
public class ImageController {

    private final RecipeUseCase recipeUseCase;
    private final ImageStore imageStore;

    public ImageController(RecipeUseCase recipeUseCase, ImageStore imageStore) {
        this.recipeUseCase = recipeUseCase;
        this.imageStore = imageStore;
    }

    @GetMapping("/{id}/image")
    public ResponseEntity<byte[]> getImage(@PathVariable String id) {
        var recipeOpt = recipeUseCase.getRecipeById(id);
        if (recipeOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        var recipe = recipeOpt.get();
        if (recipe.imageId() == null) {
            return ResponseEntity.notFound().build();
        }
        byte[] bytes = imageStore.fetch(recipe.imageId());
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_JPEG)
                .body(bytes);
    }
}
