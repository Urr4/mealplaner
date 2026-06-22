package de.urr4.mp.mealplaner.web;

import de.urr4.mp.mealplaner.domain.port.in.UserUseCase;
import de.urr4.mp.mealplaner.web.dto.RecipeDto;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/recipes/{id}")
public class UserController {

    private final UserUseCase userUseCase;

    public UserController(UserUseCase userUseCase) {
        this.userUseCase = userUseCase;
    }

    @PostMapping("/like")
    public RecipeDto like(@PathVariable String id,
                          @RequestBody UserFeedbackRequest req,
                          HttpServletRequest request) {
        return RecipeMapper.toDto(userUseCase.setLike(id, req.userName()), baseUrl(request));
    }

    @PostMapping("/dislike")
    public RecipeDto dislike(@PathVariable String id,
                             @RequestBody UserFeedbackRequest req,
                             HttpServletRequest request) {
        return RecipeMapper.toDto(userUseCase.setDislike(id, req.userName()), baseUrl(request));
    }

    @DeleteMapping("/feedback")
    public RecipeDto removeFeedback(@PathVariable String id,
                                    @RequestBody UserFeedbackRequest req,
                                    HttpServletRequest request) {
        return RecipeMapper.toDto(userUseCase.removeFeedback(id, req.userName()), baseUrl(request));
    }

    private String baseUrl(HttpServletRequest request) {
        return request.getScheme() + "://" + request.getServerName() +
                (request.getServerPort() == 80 || request.getServerPort() == 443
                        ? "" : ":" + request.getServerPort());
    }

    public record UserFeedbackRequest(String userName) {}
}
