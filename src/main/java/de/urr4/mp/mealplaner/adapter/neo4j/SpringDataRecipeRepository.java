package de.urr4.mp.mealplaner.adapter.neo4j;

import org.springframework.data.neo4j.repository.Neo4jRepository;
import org.springframework.data.neo4j.repository.query.Query;

import java.util.List;

public interface SpringDataRecipeRepository extends Neo4jRepository<Neo4jRecipeEntity, String> {

    @Query("MATCH (r:Recipe) WHERE toLower(r.name) CONTAINS toLower($name) RETURN r")
    List<Neo4jRecipeEntity> findByNameContaining(String name);

    @Query("MATCH (r:Recipe)-[:CONTAINS]->(i:Ingredient) WHERE toLower(i.name) CONTAINS toLower($ingredientName) RETURN r")
    List<Neo4jRecipeEntity> findByIngredientName(String ingredientName);

    @Query("MATCH (r:Recipe) RETURN r ORDER BY rand() LIMIT $count")
    List<Neo4jRecipeEntity> findRandom(int count);
}
