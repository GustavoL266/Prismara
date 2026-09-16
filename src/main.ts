import './ui/style.css';
import { Game } from './game/game';
const game = new Game();
// Expose the real game only in the development server for repeatable browser integration tests.
if (import.meta.env.DEV && new URLSearchParams(location.search).has('test')) {
  Object.assign(window, { __prismara: game });
}
