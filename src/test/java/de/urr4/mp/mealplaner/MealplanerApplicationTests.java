package de.urr4.mp.mealplaner;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

// Integration test — requires Neo4j + MinIO running.
// Start infrastructure first with: ./dev-infra.sh
// Then run: ./gradlew test
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE,
        properties = {
                "spring.neo4j.uri=bolt://localhost:7687",
                "spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.data.neo4j.Neo4jRepositoriesAutoConfiguration,org.springframework.boot.autoconfigure.neo4j.Neo4jAutoConfiguration"
        })
class MealplanerApplicationTests {

    @Test
    void contextLoads() {
        // Verifies the Spring context assembles correctly
    }
}
