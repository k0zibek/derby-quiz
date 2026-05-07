import type { Locale } from "../preferences";
import { kk } from "./kk";
import { ru } from "./ru";
import { AppMessages } from "./types";

export const messages: Record<Locale, AppMessages> = {
  kk,
  ru,
};

export type Messages = AppMessages;

export function getMessages(locale: Locale): Messages {
  return messages[locale];
}
