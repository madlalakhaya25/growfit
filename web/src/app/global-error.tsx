"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// Only renders when the root layout itself fails, so it cannot rely on the
// app's styles or components.
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "sans-serif", padding: "2rem", textAlign: "center" }}>
        <h1>Something went wrong</h1>
        <p>Please reload the page. If it keeps happening, let your administrator know.</p>
      </body>
    </html>
  );
}
