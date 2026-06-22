package de.urr4.mp.mealplaner.adapter.neo4j;

import org.springframework.data.neo4j.core.schema.RelationshipProperties;
import org.springframework.data.neo4j.core.schema.TargetNode;
import org.springframework.data.neo4j.core.schema.Id;
import org.springframework.data.neo4j.core.schema.GeneratedValue;

@RelationshipProperties
public class Neo4jContainsRelationship {

    @Id
    @GeneratedValue
    private Long id;

    private String quantity;
    private String unit;

    @TargetNode
    private Neo4jIngredientEntity ingredient;

    public Neo4jContainsRelationship() {}

    public Neo4jContainsRelationship(Neo4jIngredientEntity ingredient, String quantity, String unit) {
        this.ingredient = ingredient;
        this.quantity = quantity;
        this.unit = unit;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getQuantity() { return quantity; }
    public void setQuantity(String quantity) { this.quantity = quantity; }
    public String getUnit() { return unit; }
    public void setUnit(String unit) { this.unit = unit; }
    public Neo4jIngredientEntity getIngredient() { return ingredient; }
    public void setIngredient(Neo4jIngredientEntity ingredient) { this.ingredient = ingredient; }
}


