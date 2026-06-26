// Type declarations for the verbatim TarotApp.jsx component module.
import type { ReactElement } from "react";

export function TarotReveal(props: {
  spread?: string;
  background?: string;
  cards?: string[];
}): ReactElement;

export function ReadingPage(props: {
  background?: string;
  text?: string;
}): ReactElement;

export function NavBar(props: { onHome?: () => void }): ReactElement;
