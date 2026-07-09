import { Navigation } from './Navigation';
import { Hero } from './Hero';
import { Features } from './Features';
import { Commands } from './Commands';
import { Score } from './Score';
import { GetStarted } from './GetStarted';
import { Footer } from './Footer';

function App() {
  return (
    <div className="min-h-screen bg-canvas">
      <Navigation />
      <main>
        <Hero />
        <div id="features">
          <Features />
        </div>
        <div id="commands">
          <Commands />
        </div>
        <div id="scoring">
          <Score />
        </div>
        <div id="get-started">
          <GetStarted />
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default App;
