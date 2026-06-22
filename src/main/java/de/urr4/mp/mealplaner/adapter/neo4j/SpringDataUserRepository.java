package de.urr4.mp.mealplaner.adapter.neo4j;

import org.springframework.data.neo4j.repository.Neo4jRepository;
import org.springframework.data.neo4j.repository.query.Query;

import java.util.Optional;

public interface SpringDataUserRepository extends Neo4jRepository<Neo4jUserEntity, String> {

    @Query("MATCH (u:User) WHERE u.name = $name RETURN u")
    Optional<Neo4jUserEntity> findByName(String name);
}
