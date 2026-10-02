package com.group12.ripperdoc.api;

import com.group12.ripperdoc.model.BaseHuman;
import com.group12.ripperdoc.model.Condition;
import com.group12.ripperdoc.model.Human;
import com.group12.ripperdoc.service.BuildResult;
import com.group12.ripperdoc.service.Implant;
import com.group12.ripperdoc.service.ImplantCatalog;
import com.group12.ripperdoc.service.Layer;
import com.group12.ripperdoc.service.Lifepath;
import com.group12.ripperdoc.service.Ripperdoc;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class ApiServer {

    private static final Map<String, String> CONTENT_TYPES = Map.of(
            "html", "text/html; charset=utf-8",
            "css", "text/css; charset=utf-8",
            "js", "text/javascript; charset=utf-8",
            "svg", "image/svg+xml",
            "png", "image/png",
            "ico", "image/x-icon");

    private final HttpServer server;
    private final ImplantCatalog catalog;
    private final Ripperdoc ripperdoc;
    private final Path webRoot;

    public ApiServer(int port, Path webRoot) throws IOException {
        this.catalog = new ImplantCatalog();
        this.ripperdoc = new Ripperdoc(catalog);
        this.webRoot = webRoot.toAbsolutePath().normalize();
        this.server = HttpServer.create(new InetSocketAddress(port), 0);
        server.createContext("/api/lifepaths", this::handleLifepaths);
        server.createContext("/api/implants", this::handleImplants);
        server.createContext("/api/build", this::handleBuild);
        server.createContext("/", this::handleStatic);
    }

    public void start() {
        server.start();
    }

    private void handleLifepaths(HttpExchange exchange) throws IOException {
        List<Map<String, Object>> body = catalog.getLifepaths().stream().map(this::lifepathToMap).toList();
        sendJson(exchange, 200, body);
    }

    private void handleImplants(HttpExchange exchange) throws IOException {
        List<Map<String, Object>> body = catalog.getImplants().stream().map(this::implantToMap).toList();
        sendJson(exchange, 200, body);
    }

    private void handleBuild(HttpExchange exchange) throws IOException {
        Map<String, String> query = parseQuery(exchange.getRequestURI().getRawQuery());
        List<String> implantIds = Arrays.stream(query.getOrDefault("implants", "").split(","))
                .map(String::trim)
                .filter(id -> !id.isEmpty())
                .toList();
        try {
            BuildResult result = ripperdoc.operate(query.get("name"), query.getOrDefault("lifepath", ""), implantIds);
            sendJson(exchange, 200, resultToMap(result));
        } catch (IllegalArgumentException error) {
            sendJson(exchange, 400, Map.of("error", error.getMessage()));
        }
    }

    private void handleStatic(HttpExchange exchange) throws IOException {
        String requestPath = exchange.getRequestURI().getPath();
        if (requestPath.equals("/")) {
            requestPath = "/index.html";
        }
        Path file = webRoot.resolve(requestPath.substring(1)).normalize();
        if (!file.startsWith(webRoot) || !Files.isRegularFile(file)) {
            sendText(exchange, 404, "Not found");
            return;
        }
        String name = file.getFileName().toString();
        String extension = name.substring(name.lastIndexOf('.') + 1);
        exchange.getResponseHeaders().set("Content-Type", CONTENT_TYPES.getOrDefault(extension, "application/octet-stream"));
        send(exchange, 200, Files.readAllBytes(file));
    }

    private Map<String, Object> lifepathToMap(Lifepath lifepath) {
        BaseHuman sample = lifepath.create("V");
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", lifepath.id());
        map.put("name", lifepath.name());
        map.put("className", lifepath.className());
        map.put("description", lifepath.description());
        map.put("stats", statsToMap(sample));
        return map;
    }

    private Map<String, Object> implantToMap(Implant implant) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", implant.id());
        map.put("name", implant.name());
        map.put("className", implant.className());
        map.put("slot", implant.slot().name());
        map.put("slotLabel", implant.slot().getLabel());
        map.put("price", implant.price());
        map.put("effect", implant.effect());
        map.put("description", implant.description());
        return map;
    }

    private Map<String, Object> resultToMap(BuildResult result) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("description", result.patient().getDescription());
        map.put("stats", statsToMap(result.patient()));
        map.put("condition", result.condition().name());
        map.put("thresholds", Map.of(
                "stable", Condition.STABLE_THRESHOLD,
                "psychosis", Condition.PSYCHOSIS_THRESHOLD));
        map.put("layers", result.layers().stream().map(this::layerToMap).toList());
        return map;
    }

    private Map<String, Object> layerToMap(Layer layer) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", layer.id());
        map.put("name", layer.name());
        map.put("className", layer.className());
        map.put("description", layer.description());
        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("strength", layer.strength());
        stats.put("reflexes", layer.reflexes());
        stats.put("hacking", layer.hacking());
        stats.put("armor", layer.armor());
        stats.put("humanity", layer.humanity());
        stats.put("cost", layer.cost());
        map.put("stats", stats);
        return map;
    }

    private Map<String, Object> statsToMap(Human human) {
        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("strength", human.getStrength());
        stats.put("reflexes", human.getReflexes());
        stats.put("hacking", human.getHacking());
        stats.put("armor", human.getArmor());
        stats.put("humanity", human.getHumanity());
        stats.put("cost", human.getCost());
        return stats;
    }

    private Map<String, String> parseQuery(String rawQuery) {
        Map<String, String> query = new HashMap<>();
        if (rawQuery == null || rawQuery.isEmpty()) {
            return query;
        }
        for (String pair : rawQuery.split("&")) {
            int separator = pair.indexOf('=');
            String key = separator >= 0 ? pair.substring(0, separator) : pair;
            String value = separator >= 0 ? pair.substring(separator + 1) : "";
            query.put(decode(key), decode(value));
        }
        return query;
    }

    private String decode(String text) {
        return URLDecoder.decode(text, StandardCharsets.UTF_8);
    }

    private void sendJson(HttpExchange exchange, int status, Object body) throws IOException {
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
        send(exchange, status, Json.write(body).getBytes(StandardCharsets.UTF_8));
    }

    private void sendText(HttpExchange exchange, int status, String body) throws IOException {
        exchange.getResponseHeaders().set("Content-Type", "text/plain; charset=utf-8");
        send(exchange, status, body.getBytes(StandardCharsets.UTF_8));
    }

    private void send(HttpExchange exchange, int status, byte[] bytes) throws IOException {
        exchange.getResponseHeaders().set("Cache-Control", "no-store");
        exchange.sendResponseHeaders(status, bytes.length);
        try (OutputStream output = exchange.getResponseBody()) {
            output.write(bytes);
        }
    }
}
