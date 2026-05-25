"use client";

import { useMemo } from "react";

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function segmentTextByKeywords(text: string, keywords: string[]) {
  const cleanKeywords = Array.from(
    new Set(keywords.map((item) => item.trim()).filter(Boolean))
  );
  if (!text || cleanKeywords.length === 0) {
    return [{ text, isMatch: false }];
  }

  const pattern = new RegExp(`(${cleanKeywords.map(escapeRegex).join("|")})`, "gi");
  const parts = text.split(pattern).filter((part) => part !== "");
  const keywordSet = new Set(cleanKeywords.map((item) => item.toLowerCase()));
  return parts.map((part) => ({
    text: part,
    isMatch: keywordSet.has(part.toLowerCase()),
  }));
}

export function KeywordHighlightView({
  text,
  keywords,
}: {
  text: string;
  keywords: string[];
}) {
  const segments = useMemo(() => segmentTextByKeywords(text, keywords), [keywords, text]);
  return (
    <>
      {segments.map((segment, index) =>
        segment.isMatch ? (
          <mark key={`${segment.text}-${index}`} className="keyword-hit">
            {segment.text}
          </mark>
        ) : (
          <span key={`${segment.text}-${index}`}>{segment.text}</span>
        )
      )}
    </>
  );
}
