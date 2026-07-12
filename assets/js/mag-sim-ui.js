// assets/js/mag-sim-ui.js
// Bootstrap only (Task 11). renderSetup/renderCard/renderFeed/renderLog are
// filled in by Tasks 12-15 — this task just wires the page so it loads with
// no console errors and shows the four empty sections.
import { createState } from '/assets/js/mag-sim-engine.js';

const DATA = window.MAG_SIM;

let state = createState(DATA, { start: { mode: 'fresh' } });
const history = []; // undo snapshot stack (Tasks 12-15)

function renderSetup() {}
function renderCard() {}
function renderFeed() {}
function renderLog() {}

function render() {
    renderCard();
    renderFeed();
    renderLog();
}

document.addEventListener('DOMContentLoaded', () => {
    renderSetup();
    render();
});
