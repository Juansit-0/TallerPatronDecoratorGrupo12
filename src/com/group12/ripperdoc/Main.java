package com.group12.ripperdoc;

import com.group12.ripperdoc.api.ApiServer;
import java.io.IOException;
import java.net.BindException;
import java.nio.file.Path;

public class Main {

    private static final int DEFAULT_PORT = 8080;

    public static void main(String[] args) throws IOException {
        int port = args.length > 0 ? Integer.parseInt(args[0]) : DEFAULT_PORT;
        try {
            ApiServer server = new ApiServer(port, Path.of("web"));
            server.start();
            System.out.println("Ripperdoc clinic open at http://localhost:" + port);
        } catch (BindException error) {
            System.out.println("Port " + port + " is busy. Try another one, for example: ./run.sh " + (port + 1));
            System.exit(1);
        }
    }
}
