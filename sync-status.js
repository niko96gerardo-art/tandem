(function () {
    function initialize() {
        const banner = document.getElementById('syncStatusBanner');
        if (!banner) return;

        const baseState = {
            status: 'warning',
            synced: false,
            lastSync: '',
            source: 'GitHub → Netlify',
            message: ''
        };

        const state = Object.assign({}, baseState, window.TANDEM_SYNC_STATE || {});
        const normalizedStatus = state.status === 'error'
            ? 'error'
            : state.status === 'ok' || state.synced
                ? 'ok'
                : 'warning';

        const formatDate = (value) => {
            if (!value) return 'sin fecha';
            const parsed = new Date(value);
            if (Number.isNaN(parsed.getTime())) return value;
            return parsed.toLocaleString('es-AR', {
                dateStyle: 'short',
                timeStyle: 'short'
            });
        };

        const labels = {
            ok: {
                title: 'Repo y Netlify sincronizados',
                detail: `Última confirmación: ${formatDate(state.lastSync)}`
            },
            warning: {
                title: 'Sincronización pendiente',
                detail: state.message || 'Revisá el último deploy o el estado del repo antes de confiar en el contenido publicado.'
            },
            error: {
                title: 'Sincronización con error',
                detail: state.message || 'Hubo un problema al confirmar el último deploy.'
            }
        };

        const current = labels[normalizedStatus];

        banner.classList.remove('sync-banner--ok', 'sync-banner--warn', 'sync-banner--error');
        banner.classList.add(
            normalizedStatus === 'ok'
                ? 'sync-banner--ok'
                : normalizedStatus === 'error'
                    ? 'sync-banner--error'
                    : 'sync-banner--warn'
        );

        banner.innerHTML = `
            <span class="sync-banner__dot" aria-hidden="true"></span>
            <span>
                <strong>${current.title}</strong>
                <small>${current.detail}</small>
            </span>
        `;

        banner.setAttribute(
            'title',
            normalizedStatus === 'ok'
                ? `Fuente: ${state.source || 'GitHub → Netlify'}`
                : current.detail
        );
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
}());
