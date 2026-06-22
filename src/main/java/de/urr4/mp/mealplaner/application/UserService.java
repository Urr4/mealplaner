package de.urr4.mp.mealplaner.application;

import de.urr4.mp.mealplaner.domain.model.Recipe;
import de.urr4.mp.mealplaner.domain.model.User;
import de.urr4.mp.mealplaner.domain.port.in.UserUseCase;
import de.urr4.mp.mealplaner.domain.port.out.RecipeRepository;
import de.urr4.mp.mealplaner.domain.port.out.UserRepository;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class UserService implements UserUseCase {

    private final RecipeRepository recipeRepository;
    private final UserRepository userRepository;

    public UserService(RecipeRepository recipeRepository, UserRepository userRepository) {
        this.recipeRepository = recipeRepository;
        this.userRepository = userRepository;
    }

    @Override
    public Recipe setLike(String recipeId, String userName) {
        Recipe recipe = getRecipe(recipeId);
        User user = getOrCreateUser(userName);

        List<User> likes = new ArrayList<>(recipe.likedBy());
        List<User> dislikes = new ArrayList<>(recipe.dislikedBy());
        dislikes.removeIf(u -> u.name().equals(userName));
        if (likes.stream().noneMatch(u -> u.name().equals(userName))) {
            likes.add(user);
        }

        return recipeRepository.save(new Recipe(
                recipe.id(), recipe.name(), recipe.description(), recipe.imageId(),
                recipe.ingredients(), likes, dislikes));
    }

    @Override
    public Recipe setDislike(String recipeId, String userName) {
        Recipe recipe = getRecipe(recipeId);
        User user = getOrCreateUser(userName);

        List<User> likes = new ArrayList<>(recipe.likedBy());
        List<User> dislikes = new ArrayList<>(recipe.dislikedBy());
        likes.removeIf(u -> u.name().equals(userName));
        if (dislikes.stream().noneMatch(u -> u.name().equals(userName))) {
            dislikes.add(user);
        }

        return recipeRepository.save(new Recipe(
                recipe.id(), recipe.name(), recipe.description(), recipe.imageId(),
                recipe.ingredients(), likes, dislikes));
    }

    @Override
    public Recipe removeFeedback(String recipeId, String userName) {
        Recipe recipe = getRecipe(recipeId);
        List<User> likes = new ArrayList<>(recipe.likedBy());
        List<User> dislikes = new ArrayList<>(recipe.dislikedBy());
        likes.removeIf(u -> u.name().equals(userName));
        dislikes.removeIf(u -> u.name().equals(userName));

        return recipeRepository.save(new Recipe(
                recipe.id(), recipe.name(), recipe.description(), recipe.imageId(),
                recipe.ingredients(), likes, dislikes));
    }

    private Recipe getRecipe(String recipeId) {
        return recipeRepository.findById(recipeId)
                .orElseThrow(() -> new IllegalArgumentException("Recipe not found: " + recipeId));
    }

    private User getOrCreateUser(String userName) {
        return userRepository.findByName(userName)
                .orElseGet(() -> userRepository.save(new User(UUID.randomUUID().toString(), userName)));
    }
}
