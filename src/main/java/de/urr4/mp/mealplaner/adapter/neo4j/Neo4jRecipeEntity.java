package de.urr4.mp.mealplaner.adapter.neo4j;

import org.springframework.data.neo4j.core.schema.*;
import org.springframework.data.neo4j.core.support.UUIDStringGenerator;

import java.util.ArrayList;
import java.util.List;

@Node("Recipe")
public class Neo4jRecipeEntity {

    @Id
    @GeneratedValue(UUIDStringGenerator.class)
    private String id;

    private String name;
    private String description;
    private String imageId;  // nullable

    @Relationship(type = "CONTAINS", direction = Relationship.Direction.OUTGOING)
    private List<Neo4jContainsRelationship> ingredients = new ArrayList<>();

    @Relationship(type = "LIKES", direction = Relationship.Direction.INCOMING)
    private List<Neo4jUserEntity> likedBy = new ArrayList<>();

    @Relationship(type = "DISLIKES", direction = Relationship.Direction.INCOMING)
    private List<Neo4jUserEntity> dislikedBy = new ArrayList<>();

    public Neo4jRecipeEntity() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getImageId() { return imageId; }
    public void setImageId(String imageId) { this.imageId = imageId; }
    public List<Neo4jContainsRelationship> getIngredients() { return ingredients; }
    public void setIngredients(List<Neo4jContainsRelationship> ingredients) { this.ingredients = ingredients; }
    public List<Neo4jUserEntity> getLikedBy() { return likedBy; }
    public void setLikedBy(List<Neo4jUserEntity> likedBy) { this.likedBy = likedBy; }
    public List<Neo4jUserEntity> getDislikedBy() { return dislikedBy; }
    public void setDislikedBy(List<Neo4jUserEntity> dislikedBy) { this.dislikedBy = dislikedBy; }
}
