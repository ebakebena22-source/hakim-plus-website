import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import DiasporaCareLandingPage from "./pages/DiasporaCareLandingPage";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <DiasporaCareLandingPage />
  </StrictMode>,
);
