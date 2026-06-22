package de.urr4.mp.mealplaner.domain.port.out;

import de.urr4.mp.mealplaner.domain.model.User;

import java.util.Optional;

public interface UserRepository {

    User save(User user);

    Optional<User> findByName(String name);

    Optional<User> findById(String id);
}
