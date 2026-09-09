(function () {
    const CACHE_KEY = 'tandem_sync_status';
    const CACHE_TTL_MS = 5 * 60 * 1000;
    const REFRESH_INTERVAL_MS = 60 * 1000;

    function readCachedStatus() {
        try {
            const rawValue = window.localStorage.getItem(CACHE_KEY);
            if (!rawValue) return null;
            const cached = JSON.parse(rawValue);
            if (!cached || !cached.timestamp) return null;
            const isFresh = Date.now() - cached.timestamp < CACHE_TTL_MS;
            return isFresh ? cached.state : null;
        } catch (error) {
            return null;
        }
    }

    function writeCachedStatus(state) {
        try {
            window.localStorage.setItem(CACHE_KEY, JSON.stringify({
                timestamp: Date.now(),
                state
            }));
        } catch (error) {
            // Ignorar errores de almacenamiento local.
        }
    }

    async function checkSupabaseHealth() {
        const hasSupabaseConfig = Boolean(window.TANDEM_SUPABASE_URL && window.TANDEM_SUPABASE_ANON_KEY && window.supabase);
        if (!hasSupabaseConfig) {
            return {
                status: 'warning',
                synced: false,
                lastSync: '',
                source: 'GitHub → Netlify',
                message: 'No se pudo verificar la sincronización porque faltan las credenciales de Supabase.'
            };
        }

        try {
            const client = window.supabase.createClient(window.TANDEM_SUPABASE_URL, window.TANDEM_SUPABASE_ANON_KEY);
            const { error } = await client.from('productos').select('id').limit(1);

            if (error) {
                return {
                    status: 'error',
                    synced: false,
                    lastSync: '',
                    source: 'GitHub → Netlify',
                    message: error.message || 'La base de datos o el servidor no responde.'
                };
            }

            return {
                status: 'ok',
                synced: true,
                lastSync: new Date().toISOString(),
                source: 'GitHub → Netlify',
                message: 'Último deploy verificado y Supabase respondiendo correctamente.'
            };
        } catch (error) {
            return {
                status: 'error',
                synced: false,
                lastSync: '',
                source: 'GitHub → Netlify',
                message: error.message || 'La base de datos o el servidor no responde.'
            };
        }
    }

    async function initialize() {
        const banner = document.getElementById('syncStatusBanner');
        if (!banner) return;

        const baseState = {
            status: 'warning',
            synced: false,
            lastSync: '',
            source: 'GitHub → Netlify',
            message: 'Sincronización pendiente. El estado se confirma al verificar la conexión.'
        };

        const configuredState = window.TANDEM_SYNC_STATE || {};
        const manualState = Object.assign({}, baseState, configuredState);

        if (configuredState.autoCheck === false) {
            renderState(banner, manualState);
            return;
        }

        const cachedState = readCachedStatus();

        if (cachedState) {
            renderState(banner, cachedState);
        }

        const liveState = await checkSupabaseHealth();
        writeCachedStatus(liveState);
        renderState(banner, liveState);

        window.setInterval(async () => {
            const refreshedState = await checkSupabaseHealth();
            writeCachedStatus(refreshedState);
            renderState(banner, refreshedState);
        }, REFRESH_INTERVAL_MS);
    }

    function renderState(banner, state) {
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
