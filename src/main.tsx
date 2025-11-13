import React from "react";
import ReactDOM from "react-dom/client";

import "./styles/globals.css";

import { PopupContent } from "./popup/popup-content";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <PopupContent></PopupContent>
  </React.StrictMode>,
);
