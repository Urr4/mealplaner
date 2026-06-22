package de.urr4.mp.mealplaner.adapter.neo4j;

import org.springframework.data.neo4j.core.schema.GeneratedValue;
import org.springframework.data.neo4j.core.schema.Id;
import org.springframework.data.neo4j.core.schema.Node;
import org.springframework.data.neo4j.core.support.UUIDStringGenerator;

@Node("Ingredient")
public class Neo4jIngredientEntity {

    @Id
    @GeneratedValue(UUIDStringGenerator.class)
    private String id;

    private String name;

    public Neo4jIngredientEntity() {}

    public Neo4jIngredientEntity(String id, String name) {
        this.id = id;
        this.name = name;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
}
