import React from "react";
import ReactDOM from "react-dom/client";
import AppRoutes from "./app/routes";
import { ThemeProvider } from "./app/ThemeContext";
import "./assets/main.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <AppRoutes />
    </ThemeProvider>
  </React.StrictMode>,
);
