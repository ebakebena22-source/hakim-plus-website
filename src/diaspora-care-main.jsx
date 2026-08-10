import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import "./index.css";
import DiasporaCareLandingPage from "./pages/DiasporaCareLandingPage";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <DiasporaCareLandingPage />
    <Analytics />
  </StrictMode>,
);
