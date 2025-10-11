import type { ReactNode as ActualReactNode } from "react";

declare global {
  namespace React {
    type ReactNode = ActualReactNode;
  }
}

export {};
