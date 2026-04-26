/* Loader for chardata.json (per-class stat tables).
 *
 * Sets up window.charDataReady — a Promise that resolves once the JSON
 * is fetched. Consumers (simulator.js, chartable.js) wait on it before
 * accessing window.CHAR_DATA.
 *
 * Bump ?v=N when chardata.json changes to bust browser cache.
 */
window.CHAR_DATA = null;
window.charDataReady = fetch('/assets/js/chardata.json?v=1')
    .then(function (r) {
        if (!r.ok) throw new Error('chardata.json HTTP ' + r.status);
        return r.json();
    })
    .then(function (d) {
        window.CHAR_DATA = d;
        return d;
    });
