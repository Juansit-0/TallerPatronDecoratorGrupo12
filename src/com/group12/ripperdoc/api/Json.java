package com.group12.ripperdoc.api;

import java.util.Collection;
import java.util.Map;

public final class Json {

    private Json() {
    }

    public static String write(Object value) {
        StringBuilder builder = new StringBuilder();
        append(builder, value);
        return builder.toString();
    }

    private static void append(StringBuilder builder, Object value) {
        if (value == null) {
            builder.append("null");
        } else if (value instanceof String text) {
            appendString(builder, text);
        } else if (value instanceof Number || value instanceof Boolean) {
            builder.append(value);
        } else if (value instanceof Map<?, ?> map) {
            appendMap(builder, map);
        } else if (value instanceof Collection<?> collection) {
            appendCollection(builder, collection);
        } else {
            appendString(builder, value.toString());
        }
    }

    private static void appendMap(StringBuilder builder, Map<?, ?> map) {
        builder.append('{');
        boolean first = true;
        for (Map.Entry<?, ?> entry : map.entrySet()) {
            if (!first) {
                builder.append(',');
            }
            appendString(builder, String.valueOf(entry.getKey()));
            builder.append(':');
            append(builder, entry.getValue());
            first = false;
        }
        builder.append('}');
    }

    private static void appendCollection(StringBuilder builder, Collection<?> collection) {
        builder.append('[');
        boolean first = true;
        for (Object item : collection) {
            if (!first) {
                builder.append(',');
            }
            append(builder, item);
            first = false;
        }
        builder.append(']');
    }

    private static void appendString(StringBuilder builder, String text) {
        builder.append('"');
        for (char c : text.toCharArray()) {
            switch (c) {
                case '"' -> builder.append("\\\"");
                case '\\' -> builder.append("\\\\");
                case '\n' -> builder.append("\\n");
                case '\r' -> builder.append("\\r");
                case '\t' -> builder.append("\\t");
                default -> {
                    if (c < 0x20) {
                        builder.append(String.format("\\u%04x", (int) c));
                    } else {
                        builder.append(c);
                    }
                }
            }
        }
        builder.append('"');
    }
}
