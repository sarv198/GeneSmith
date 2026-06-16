import { useState } from "react";
import Navbar from "./components/Navbar.jsx";
import CircuitBuilderPage from "./pages/CircuitBuilderPage.jsx";
import TheoryPage from "./pages/TheoryPage.jsx";
import VisualizePage from "./pages/VisualizePage.jsx";

const PAGES = {
  home: CircuitBuilderPage,
  theory: TheoryPage,
  visualize: VisualizePage,
};

export default function App() {
  const [activePage, setActivePage] = useState("home");
  const [circuit, setCircuit] = useState([]);
  const [predictResult, setPredictResult] = useState(null);
  const Page = PAGES[activePage] || CircuitBuilderPage;

  const pageProps = {
    circuit,
    setCircuit,
    predictResult,
    setPredictResult,
    onNavigate: setActivePage,
  };

  return (
    <div className="app-shell">
      <Navbar activePage={activePage} onNavigate={setActivePage} />
      <div className="app-content">
        <Page {...pageProps} />
      </div>
    </div>
  );
}
