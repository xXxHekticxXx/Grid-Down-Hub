import { useRoute } from './ui';
import Home from './pages/Home';
import { SectionPage, PageView, SearchPage, About } from './pages/Content';
import Emergency from './pages/Emergency';
import Water from './pages/Water';
import Comms from './pages/Comms';
import { Survival } from './pages/Survival';
import Library from './pages/Library';
import MapPage from './pages/MapPage';
import { PlanHome, PlanSection } from './pages/PlanPages';
import Settings from './pages/Settings';

export default function App() {
  const [a, b, c] = useRoute();
  switch (a) {
    case undefined:
      return <Home />;
    case 'emergency':
      return <Emergency id={b || 'cpr'} step={Number(c) || 1} />;
    case 'firstaid':
    case 'hazards':
      return <SectionPage section={a} />;
    case 'water':
      return <Water />;
    case 'comms':
      return <Comms />;
    case 'p':
      return <PageView id={b} />;
    case 'survival':
      return <Survival chapter={b} />;
    case 'library':
      return <Library open={b} name={c} />;
    case 'map':
      return <MapPage />;
    case 'plan':
      return b ? <PlanSection which={b} /> : <PlanHome />;
    case 'settings':
      return <Settings />;
    case 'search':
      return <SearchPage q={b || ''} />;
    case 'about':
      return <About />;
    default:
      return <Home />;
  }
}
