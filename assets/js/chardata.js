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
    })
    .catch(function (err) {
        console.error('Failed to load chardata.json:', err);
        var msg = document.createElement('div');
        msg.style.cssText = 'background:#7f1d1d;color:#fff;padding:14px 20px;margin:12px;border-radius:6px;font-family:sans-serif;text-align:center';
        msg.textContent = 'Failed to load character data. Please refresh the page.';
        document.body && document.body.insertBefore(msg, document.body.firstChild);
        throw err;
    });
