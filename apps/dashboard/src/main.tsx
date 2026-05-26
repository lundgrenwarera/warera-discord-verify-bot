import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { App } from "./App";
import { Landing } from "./pages/Landing";
import { OAuthCallback } from "./pages/OAuthCallback";
import { Servers } from "./pages/Servers";
import { ServerConfig } from "./pages/ServerConfig";
import { Members } from "./pages/Members";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/auth/callback" element={<OAuthCallback />} />
          <Route path="/servers" element={<Servers />} />
          <Route path="/servers/:guildId" element={<ServerConfig />} />
          <Route path="/servers/:guildId/members" element={<Members />} />
        </Routes>
      </App>
    </BrowserRouter>
  </StrictMode>,
);
