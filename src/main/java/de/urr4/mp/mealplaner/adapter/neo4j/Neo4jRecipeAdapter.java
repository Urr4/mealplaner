package de.urr4.mp.mealplaner.adapter.neo4j;

import de.urr4.mp.mealplaner.domain.model.*;
import de.urr4.mp.mealplaner.domain.port.out.RecipeRepository;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Component
public class Neo4jRecipeAdapter implements RecipeRepository {

    private final SpringDataRecipeRepository springRepo;

    public Neo4jRecipeAdapter(SpringDataRecipeRepository springRepo) {
        this.springRepo = springRepo;
    }

    @Override
    public Recipe save(Recipe recipe) {
        return toDomain(springRepo.save(toEntity(recipe)));
    }

    @Override
    public Optional<Recipe> findById(String id) {
        return springRepo.findById(id).map(this::toDomain);
    }

    @Override
    public List<Recipe> findAll() {
        return springRepo.findAll().stream().map(this::toDomain).collect(Collectors.toList());
    }

    @Override
    public List<Recipe> findByNameContaining(String name) {
        return springRepo.findByNameContaining(name).stream().map(this::toDomain).collect(Collectors.toList());
    }

    @Override
    public List<Recipe> findByIngredientName(String ingredientName) {
        return springRepo.findByIngredientName(ingredientName).stream().map(this::toDomain).collect(Collectors.toList());
    }

    @Override
    public List<Recipe> findRandom(int count) {
        return springRepo.findRandom(count).stream().map(this::toDomain).collect(Collectors.toList());
    }

    @Override
    public void deleteById(String id) {
        springRepo.deleteById(id);
    }

    // ── Mapping ───────────────────────────────────────────────────────────────

    private Recipe toDomain(Neo4jRecipeEntity e) {
        List<RecipeIngredient> ingredients = e.getIngredients().stream()
                .map(r -> new RecipeIngredient(
                        new Ingredient(r.getIngredient().getId(), r.getIngredient().getName()),
                        r.getQuantity(), r.getUnit()))
                .collect(Collectors.toList());
        List<User> likedBy = e.getLikedBy().stream()
                .map(u -> new User(u.getId(), u.getName())).collect(Collectors.toList());
        List<User> dislikedBy = e.getDislikedBy().stream()
                .map(u -> new User(u.getId(), u.getName())).collect(Collectors.toList());
        return new Recipe(e.getId(), e.getName(), e.getDescription(), e.getImageId(),
                ingredients, likedBy, dislikedBy);
    }

    private Neo4jRecipeEntity toEntity(Recipe recipe) {
        Neo4jRecipeEntity entity = new Neo4jRecipeEntity();
        entity.setId(recipe.id());
        entity.setName(recipe.name());
        entity.setDescription(recipe.description());
        entity.setImageId(recipe.imageId());
        entity.setIngredients(recipe.ingredients().stream()
                .map(ri -> new Neo4jContainsRelationship(
                        new Neo4jIngredientEntity(ri.ingredient().id(), ri.ingredient().name()),
                        ri.quantity(), ri.unit()))
                .collect(Collectors.toList()));
        entity.setLikedBy(recipe.likedBy().stream()
                .map(u -> new Neo4jUserEntity(u.id(), u.name())).collect(Collectors.toList()));
        entity.setDislikedBy(recipe.dislikedBy().stream()
                .map(u -> new Neo4jUserEntity(u.id(), u.name())).collect(Collectors.toList()));
        return entity;
    }
}
