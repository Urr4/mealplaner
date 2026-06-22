package de.urr4.mp.mealplaner.domain.port.in;

import de.urr4.mp.mealplaner.domain.model.Recipe;

public interface UserUseCase {

    /** Records that the user with {@code userName} likes this recipe. */
    Recipe setLike(String recipeId, String userName);

    /** Records that the user with {@code userName} dislikes this recipe. */
    Recipe setDislike(String recipeId, String userName);

    /** Removes any like or dislike the user has on this recipe. */
    Recipe removeFeedback(String recipeId, String userName);
}
