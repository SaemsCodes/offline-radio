
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App.tsx";
import "./index.css";
import { MeshServiceWorker } from "./services/MeshServiceWorker";

const queryClient = new QueryClient();

// Initialize mesh service worker for background processing
const initializeMeshServiceWorker = async () => {
  const meshSW = MeshServiceWorker.getInstance();
  await meshSW.register();
  await meshSW.enableBackgroundSync();
  await meshSW.requestPersistentStorage();
};

// Initialize service worker
initializeMeshServiceWorker().catch(console.error);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
