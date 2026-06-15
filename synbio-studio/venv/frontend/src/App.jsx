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
  const Page = PAGES[activePage] || CircuitBuilderPage;

  return (
    <div className="app-shell">
      <Navbar activePage={activePage} onNavigate={setActivePage} />
      <div className="app-content">
        <Page />
      </div>
    </div>
  );
}
