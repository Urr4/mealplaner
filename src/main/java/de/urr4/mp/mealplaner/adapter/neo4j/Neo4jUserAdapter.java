package de.urr4.mp.mealplaner.adapter.neo4j;

import de.urr4.mp.mealplaner.domain.model.User;
import de.urr4.mp.mealplaner.domain.port.out.UserRepository;
import org.springframework.stereotype.Component;

import java.util.Optional;

@Component
public class Neo4jUserAdapter implements UserRepository {

    private final SpringDataUserRepository springRepo;

    public Neo4jUserAdapter(SpringDataUserRepository springRepo) {
        this.springRepo = springRepo;
    }

    @Override
    public User save(User user) {
        Neo4jUserEntity entity = new Neo4jUserEntity(user.id(), user.name());
        return toDomain(springRepo.save(entity));
    }

    @Override
    public Optional<User> findByName(String name) {
        return springRepo.findByName(name).map(this::toDomain);
    }

    @Override
    public Optional<User> findById(String id) {
        return springRepo.findById(id).map(this::toDomain);
    }

    private User toDomain(Neo4jUserEntity e) {
        return new User(e.getId(), e.getName());
    }
}
