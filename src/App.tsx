import { useEffect, useState } from "react";
import { TabBar, type Tab } from "./components/ui";
import { Gym } from "./screens/Gym";
import { Plan } from "./screens/Plan";
import { Profil } from "./screens/Profil";
import { Today } from "./screens/Today";
import { Verlauf } from "./screens/Verlauf";

const TABS: Tab[] = ["heute", "plan", "gym", "verlauf", "profil"];

function currentTab(): Tab {
  const t = location.hash.replace(/^#\/?/, "") as Tab;
  return TABS.includes(t) ? t : "heute";
}

export function App() {
  const [tab, setTab] = useState<Tab>(currentTab);
  useEffect(() => {
    const on = () => { setTab(currentTab()); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  return (
    <div className="app">
      <main>
        {tab === "heute" && <Today />}
        {tab === "plan" && <Plan />}
        {tab === "gym" && <Gym />}
        {tab === "verlauf" && <Verlauf />}
        {tab === "profil" && <Profil />}
      </main>
      <TabBar current={tab} />
    </div>
  );
}
