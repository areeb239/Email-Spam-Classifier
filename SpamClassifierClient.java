import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/**
 * Java client for the Email/SMS Spam Classifier FastAPI backend.
 * 
 * Requirements: Java 11 or newer.
 * 
 * To compile and run:
 *     javac SpamClassifierClient.java
 *     java SpamClassifierClient
 */
public class SpamClassifierClient {

    private static final String DEFAULT_API_URL = "http://127.0.0.1:8000/predict";
    private final String apiUrl;
    private final HttpClient httpClient;

    public SpamClassifierClient() {
        this(System.getenv("SPAM_API_URL") != null && !System.getenv("SPAM_API_URL").isBlank()
                ? System.getenv("SPAM_API_URL").trim()
                : DEFAULT_API_URL);
    }

    public SpamClassifierClient(String apiUrl) {
        if (apiUrl == null || apiUrl.isBlank()) {
            throw new IllegalArgumentException("API URL must not be blank");
        }
        this.apiUrl = apiUrl;
        this.httpClient = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .connectTimeout(Duration.ofSeconds(5))
                .build();
    }

    /**
     * Sends a text message to the Spam Classifier API.
     *
     * @param text The email or SMS content to classify.
     * @return Raw JSON response containing prediction ("spam" or "ham") and confidence score.
     */
    public String classify(String text) throws IOException, InterruptedException {
        if (text == null || text.isBlank()) {
            throw new IllegalArgumentException("Input text must not be empty or blank");
        }

        // Escape json characters in text string
        String escaped = escapeJson(text);
        String jsonPayload = String.format("{\"text\":\"%s\"}", escaped);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(apiUrl))
                .timeout(Duration.ofSeconds(15))
                .header("Content-Type", "application/json")
                .header("Accept", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(jsonPayload))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() >= 200 && response.statusCode() < 300) {
            return response.body();
        } else {
            throw new RuntimeException("API error (HTTP " + response.statusCode() + "): " + response.body());
        }
    }

    private static String escapeJson(String input) {
        if (input == null) return "";
        StringBuilder sb = new StringBuilder(input.length() + 16);
        for (int i = 0; i < input.length(); i++) {
            char c = input.charAt(i);
            switch (c) {
                case '\\': sb.append("\\\\"); break;
                case '"':  sb.append("\\\""); break;
                case '\b': sb.append("\\b"); break;
                case '\f': sb.append("\\f"); break;
                case '\n': sb.append("\\n"); break;
                case '\r': sb.append("\\r"); break;
                case '\t': sb.append("\\t"); break;
                default:
                    if (c < 0x20 || c == 0x7F) {
                        sb.append(String.format("\\u%04x", (int) c));
                    } else {
                        sb.append(c);
                    }
            }
        }
        return sb.toString();
    }

    public static void main(String[] args) {
        String targetUrl = args.length > 0 && !args[0].isBlank() ? args[0].trim() : null;
        SpamClassifierClient client = targetUrl != null
                ? new SpamClassifierClient(targetUrl)
                : new SpamClassifierClient();

        String[] testMessages = {
            "Congratulations! You have been selected as a winner of $1,000 gift card. Call 1-800-555-0199 now!",
            "Hey team, just confirming that our sprint review meeting will be at 3:00 PM today.",
            "URGENT: Your bank account is locked. Click http://secure-verify.net immediately to verify your card."
        };

        System.out.println("==================================================");
        System.out.println("   Spam Classifier - Java Client Demo             ");
        System.out.println("   Target API: " + client.apiUrl);
        System.out.println("==================================================\n");

        for (int i = 0; i < testMessages.length; i++) {
            String message = testMessages[i];
            System.out.println("[" + (i + 1) + "] Testing message:");
            System.out.println("    \"" + message + "\"");
            try {
                String result = client.classify(message);
                System.out.println("    ==> Result: " + result);
            } catch (Exception e) {
                System.err.println("    ==> Failed: " + e.getMessage());
            }
            System.out.println();
        }
    }
}
