import React from "react";
import { Text, View } from "react-native";

import { useTheme } from "@/theme/ThemeContext";

/** Renders inline **bold** markers within a string. */
function InlineText({ text, style }: { text: string; style: object }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <Text style={style}>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <Text key={i} style={{ fontWeight: "700" }}>
            {part.slice(2, -2)}
          </Text>
        ) : (
          <Text key={i}>{part}</Text>
        )
      )}
    </Text>
  );
}

type Block =
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "list"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "paragraph"; text: string }
  | { type: "spacer" };

/** Split a markdown table row into cells, trimming whitespace. */
function splitTableRow(line: string): string[] {
  return line
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

function isTableSeparator(line: string): boolean {
  return /^\|[\s\-:|]+\|/.test(line);
}

function isTableRow(line: string): boolean {
  return line.startsWith("|") && line.endsWith("|") && line.includes("|", 1);
}

function parse(content: string): Block[] {
  const lines = content.split("\n");
  const blocks: Block[] = [];
  let listBuffer: string[] = [];
  let tableHeaders: string[] | null = null;
  let tableRows: string[][] = [];

  function flushList() {
    if (listBuffer.length > 0) {
      blocks.push({ type: "list", items: [...listBuffer] });
      listBuffer = [];
    }
  }

  function flushTable() {
    if (tableHeaders) {
      blocks.push({ type: "table", headers: tableHeaders, rows: [...tableRows] });
      tableHeaders = null;
      tableRows = [];
    }
  }

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (isTableSeparator(line)) {
      continue;
    }

    if (isTableRow(line)) {
      flushList();
      const cells = splitTableRow(line);
      if (tableHeaders === null) {
        tableHeaders = cells;
      } else {
        tableRows.push(cells);
      }
      continue;
    }

    flushTable();

    if (/^##\s+/.test(line)) {
      flushList();
      blocks.push({ type: "h2", text: line.replace(/^##\s+/, "") });
    } else if (/^###\s+/.test(line)) {
      flushList();
      blocks.push({ type: "h3", text: line.replace(/^###\s+/, "") });
    } else if (/^[-*]\s+/.test(line)) {
      listBuffer.push(line.replace(/^[-*]\s+/, ""));
    } else if (line === "") {
      flushList();
      if (blocks.length > 0 && blocks[blocks.length - 1].type !== "spacer") {
        blocks.push({ type: "spacer" });
      }
    } else {
      flushList();
      blocks.push({ type: "paragraph", text: line });
    }
  }

  flushList();
  flushTable();

  while (blocks.length > 0 && blocks[0].type === "spacer") blocks.shift();
  while (blocks.length > 0 && blocks[blocks.length - 1].type === "spacer") blocks.pop();

  return blocks;
}

interface Props {
  content: string;
  fontScale?: number;
}

export default function MarkdownText({ content, fontScale: fontScaleProp }: Props) {
  const { colors, fontScale: themeFontScale } = useTheme();
  const fontScale = fontScaleProp ?? themeFontScale;
  const blocks = parse(content);
  const bodySize = 13 * fontScale;

  return (
    <View>
      {blocks.map((block, i) => {
        switch (block.type) {
          case "h2":
            return (
              <InlineText
                key={i}
                text={block.text}
                style={{ fontWeight: "700", fontSize: bodySize, color: colors.text, marginTop: 8, marginBottom: 2 }}
              />
            );
          case "h3":
            return (
              <InlineText
                key={i}
                text={block.text}
                style={{ fontWeight: "600", fontSize: bodySize, color: colors.text, marginTop: 6, marginBottom: 2 }}
              />
            );
          case "list":
            return (
              <View key={i} style={{ marginVertical: 4, paddingLeft: 4 }}>
                {block.items.map((item, j) => (
                  <View key={j} style={{ flexDirection: "row", gap: 6, marginBottom: 2 }}>
                    <Text style={{ fontSize: bodySize, color: colors.text }}>{"•"}</Text>
                    <InlineText text={item} style={{ fontSize: bodySize, color: colors.text, flex: 1 }} />
                  </View>
                ))}
              </View>
            );
          case "table": {
            // Short columns like Day/Date/Miles identify each row at a
            // glance; cramming them into equal-width grid cells alongside
            // long free-text columns (From → To, Notes) squeezes everything
            // on a phone screen. When a table has such columns, pull them
            // into a bolded header line per row and let the remaining
            // columns wrap as full-width text underneath instead.
            const headerColIdxs = new Set(
              block.headers
                .map((h, idx) => ({ idx, norm: h.toLowerCase().trim() }))
                .filter(({ norm }) => /^(day|date|miles?|mi|km)$/.test(norm))
                .map(({ idx }) => idx)
            );
            const useCards = block.headers.length > 3 && headerColIdxs.size > 0;

            if (useCards) {
              const detailColIdxs = block.headers.map((_, idx) => idx).filter((idx) => !headerColIdxs.has(idx));
              return (
                <View key={i} style={{ marginVertical: 8, gap: 8 }}>
                  {block.rows.map((row, j) => {
                    const headerLine = block.headers
                      .map((_, idx) => (headerColIdxs.has(idx) ? row[idx] : null))
                      .filter((v): v is string => !!v)
                      .join("   ·   ");
                    return (
                      <View
                        key={j}
                        style={{
                          borderWidth: 1,
                          borderColor: colors.border,
                          borderRadius: 10,
                          padding: 10,
                          backgroundColor: colors.surface,
                        }}
                      >
                        {headerLine ? (
                          <InlineText
                            text={headerLine}
                            style={{ fontSize: bodySize, fontWeight: "700", color: colors.text, marginBottom: 4 }}
                          />
                        ) : null}
                        {detailColIdxs.map((idx) => {
                          const value = row[idx];
                          if (!value) return null;
                          return (
                            <View key={idx} style={{ marginTop: 4 }}>
                              {block.headers[idx] ? (
                                <Text
                                  style={{
                                    fontSize: bodySize - 3,
                                    fontWeight: "600",
                                    color: colors.muted,
                                    textTransform: "uppercase",
                                    letterSpacing: 0.3,
                                    marginBottom: 1,
                                  }}
                                >
                                  {block.headers[idx]}
                                </Text>
                              ) : null}
                              <InlineText text={value} style={{ fontSize: bodySize, color: colors.text }} />
                            </View>
                          );
                        })}
                      </View>
                    );
                  })}
                </View>
              );
            }

            return (
              <View
                key={i}
                style={{
                  marginVertical: 8,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 8,
                  overflow: "hidden",
                }}
              >
                <View style={{ flexDirection: "row", backgroundColor: colors.surface }}>
                  {block.headers.map((h, j) => (
                    <View key={j} style={{ flex: 1, padding: 6, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                      <InlineText text={h} style={{ fontSize: bodySize - 1, fontWeight: "700", color: colors.text }} />
                    </View>
                  ))}
                </View>
                {block.rows.map((row, j) => (
                  <View
                    key={j}
                    style={{
                      flexDirection: "row",
                      borderBottomWidth: j === block.rows.length - 1 ? 0 : 1,
                      borderBottomColor: colors.border,
                    }}
                  >
                    {row.map((cell, k) => (
                      <View key={k} style={{ flex: 1, padding: 6 }}>
                        <InlineText text={cell} style={{ fontSize: bodySize - 1, color: colors.text }} />
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            );
          }
          case "spacer":
            return <View key={i} style={{ height: 8 }} />;
          case "paragraph":
            return (
              <InlineText
                key={i}
                text={block.text}
                style={{ fontSize: bodySize, color: colors.text, marginBottom: 2 }}
              />
            );
        }
      })}
    </View>
  );
}
