import "./index.css";
import App from "./App";
import { createRoot } from "react-dom/client";

const root = document.getElementById("root");
if (!root) throw new Error("No root element");
createRoot(root).render(<App />);
