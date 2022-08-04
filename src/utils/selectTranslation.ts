import { Language, TranslatedText } from "@mediahubmx/schema";

export const selectTranslation = (
  language: Language,
  text: TranslatedText
): string => {
  if (typeof text === "string") return text;
  if (text[language] !== undefined) return text[language];
  const s = language.split("-");
  if (s.length > 1 && text[s[0]] !== undefined) return text[s[0]];
  return Object.values(text)[0] ?? "<translation not found>";
};
