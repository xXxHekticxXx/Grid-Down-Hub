import { lazy, Suspense, useEffect } from 'react';
import { useRoute } from './lib/router';
import Home from './pages/Home';
import Emergency from './pages/Emergency';
import { native } from './lib/native';

const ArticlePage = lazy(() => import('./pages/Article'));
const Category = lazy(() => import('./pages/Category'));
const MapPage = lazy(() => import('./pages/MapPage'));
const MapsManager = lazy(() => import('./pages/MapsManager'));
const Library = lazy(() => import('./pages/Library'));
const BookReader = lazy(() => import('./pages/BookReader'));
const PdfViewer = lazy(() => import('./pages/PdfViewer'));
const Plan = lazy(() => import('./pages/Plan'));
const GoPlan = lazy(() => import('./pages/GoPlan'));
const Checklists = lazy(() => import('./pages/Checklists'));
const Inventory = lazy(() => import('./pages/Inventory'));
const Tools = lazy(() => import('./pages/Tools'));
const SearchPage = lazy(() => import('./pages/Search'));
const Settings = lazy(() => import('./pages/Settings'));
const Setup = lazy(() => import('./pages/Setup'));
const ItemPage = lazy(() => import('./pages/Item'));
const Editor = lazy(() => import('./pages/Editor'));

export default function App() {
  const r = useRoute();
  const [a, b, c] = r.parts;
  useEffect(() => {
    // Android back button
    if (!native()) return;
    import('@capacitor/app').then(({ App: CapApp }) =>
      CapApp.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack && location.hash && location.hash !== '#/') history.back();
        else void CapApp.exitApp();
      }),
    );
  }, []);
  let page;
  switch (a) {
    case undefined: page = <Home />; break;
    case 'emergency': page = <Emergency />; break;
    case 'a': page = <ArticlePage id={b} />; break;
    case 'cat': case 'hub': page = <Category id={b} hub={a === 'hub'} />; break;
    case 'map': page = <MapPage query={r.query} />; break;
    case 'maps': page = <MapsManager />; break;
    case 'library': page = <Library />; break;
    case 'book': page = <BookReader bookId={b} chapterId={c} block={r.query.get('b')} />; break;
    case 'pdf': page = <PdfViewer docId={b} page={Number(r.query.get('page') || 1)} />; break;
    case 'plan': page = <Plan section={b} />; break;
    case 'go': page = <GoPlan mode="go" />; break;
    case 'stay': page = <GoPlan mode="stay" />; break;
    case 'checklists': page = <Checklists />; break;
    case 'checklist': page = <Checklists id={b} edit={c === 'edit'} />; break;
    case 'inventory': page = <Inventory />; break;
    case 'tools': page = <Tools />; break;
    case 'tool': page = <Tools id={b} query={r.query} />; break;
    case 'search': page = <SearchPage q={r.query.get('q') ?? ''} />; break;
    case 'settings': page = <Settings />; break;
    case 'setup': page = <Setup />; break;
    case 'item': page = <ItemPage id={b} />; break;
    case 'edit': page = <Editor id={b} query={r.query} />; break;
    default: page = <Home />;
  }
  return <Suspense fallback={<div className="content muted">Opening…</div>}>{page}</Suspense>;
}
