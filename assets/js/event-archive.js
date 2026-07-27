(() => {
    const body = document.body;
    const eventName = body.dataset.event;
    const years = body.dataset.years.split(',').map(Number);
    const defaultYear = Number(body.dataset.defaultYear);
    const requested = Number(new URLSearchParams(location.search).get('year'));
    const selected = years.includes(requested) ? requested : defaultYear;
    const titleName = body.dataset.titleName;

    document.title = `${selected} ${titleName} | Ephinea PSOBB`;
    document.getElementById('eventYear').textContent = selected;
    document.getElementById('yearNav').innerHTML = years.map(year =>
        year === selected
            ? `<span class="year-current" aria-current="page">${year}</span>`
            : `<a href="?year=${year}">${year}</a>`
    ).join('');

    const content = document.getElementById('yearContent');
    fetch(`./${eventName}/${selected}.html?v=20260726-five-events`, { cache: 'no-store' })
        .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.text();
        })
        .then(html => {
            content.innerHTML = html;
        })
        .catch(() => {
            content.innerHTML = `<p>未能加载 ${selected} 年 ${titleName} 内容。</p>`;
        });

    const preview = document.getElementById('imagePreview');
    const previewImage = preview.querySelector('img');
    const previewCaption = preview.querySelector('p');
    let previewAnchor = null;

    function closePreview() {
        preview.hidden = true;
        previewImage.removeAttribute('src');
        previewAnchor = null;
    }

    function positionPreview(anchor) {
        if (preview.hidden) return;
        const margin = 12;
        const gap = 10;
        const anchorRect = anchor.getBoundingClientRect();
        const previewRect = preview.getBoundingClientRect();
        let left = anchorRect.right + gap;
        let top = anchorRect.top + (anchorRect.height - previewRect.height) / 2;

        if (left + previewRect.width > innerWidth - margin) {
            left = anchorRect.left - previewRect.width - gap;
        }
        if (left < margin) {
            left = Math.min(
                Math.max(margin, anchorRect.left + (anchorRect.width - previewRect.width) / 2),
                innerWidth - previewRect.width - margin
            );
        }

        preview.style.left = `${Math.max(margin, left)}px`;
        preview.style.top =
            `${Math.max(margin, Math.min(top, innerHeight - previewRect.height - margin))}px`;
    }

    document.addEventListener('click', event => {
        if (!(event.target instanceof Element)) return;
        const trigger = event.target.closest('[data-preview-image]');
        if (trigger) {
            if (previewAnchor === trigger && !preview.hidden) {
                closePreview();
                return;
            }
            previewAnchor = trigger;
            previewImage.src = trigger.dataset.previewImage;
            previewImage.alt = trigger.dataset.previewCaption || '';
            previewCaption.textContent = trigger.dataset.previewCaption || '';
            preview.hidden = false;
            requestAnimationFrame(() => positionPreview(trigger));
            return;
        }

        if (event.target.closest('.image-preview-close')) {
            closePreview();
            return;
        }

        if (!event.target.closest('.image-preview')) closePreview();
    });

    previewImage.addEventListener('load', () => {
        if (previewAnchor) positionPreview(previewAnchor);
    });
    addEventListener('scroll', closePreview, true);
    addEventListener('resize', closePreview);
})();
