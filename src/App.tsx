import { useEffect, useState } from "react";
import { TabBar, type Tab } from "./components/ui";
import { ActivityScreen } from "./screens/Activity";
import { Coach } from "./screens/Coach";
import { Gym } from "./screens/Gym";
import { Plan } from "./screens/Plan";
import { Profil } from "./screens/Profil";
import { Today } from "./screens/Today";
import { Verlauf } from "./screens/Verlauf";

const TABS: Tab[] = ["heute", "plan", "gym", "verlauf", "profil"];

type Route = { tab: Tab | null; view: "tab" | "activity" | "coach"; id?: string };

function currentRoute(): Route {
  const h = location.hash.replace(/^#\/?/, "");
  if (h.startsWith("aktivitaet/")) return { tab: null, view: "activity", id: decodeURIComponent(h.slice("aktivitaet/".length)) };
  if (h === "coach") return { tab: null, view: "coach" };
  const t = h as Tab;
  return { tab: TABS.includes(t) ? t : "heute", view: "tab" };
}

export function App() {
  const [route, setRoute] = useState<Route>(currentRoute);
  const tab = route.tab;
  useEffect(() => {
    const on = () => { setRoute(currentRoute()); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  return (
    <div className="app">
      <main>
        {route.view === "activity" && route.id && <ActivityScreen id={route.id} />}
        {route.view === "coach" && <Coach />}
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
