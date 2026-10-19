(function () {
    const configReady = window.TANDEM_SUPABASE_URL && window.TANDEM_SUPABASE_ANON_KEY;
    const loginView = document.getElementById('loginView');
    const dashboardView = document.getElementById('dashboardView');
    const loginForm = document.getElementById('loginForm');
    const password = document.getElementById('password');
    const togglePasswordButton = document.getElementById('togglePassword');
    const productForm = document.getElementById('productForm');
    const loginStatus = document.getElementById('loginStatus');
    const dashboardStatus = document.getElementById('dashboardStatus');
    const productsList = document.getElementById('productsList');
    const imageInput = document.getElementById('productImages');
    const imagePreview = document.getElementById('imagePreview');
    const dropzone = document.querySelector('.admin-dropzone');
    const productType = document.getElementById('productType');
    const newProductType = document.getElementById('newProductType');
    const categoryList = document.getElementById('categoryList');
    const adminTabs = document.querySelectorAll('[data-admin-tab]');
    const adminPanels = document.querySelectorAll('[data-admin-panel]');
    const productSearch = document.getElementById('productSearch');
    const productCategoryFilter = document.getElementById('productCategoryFilter');
    const productVisibilityFilter = document.getElementById('productVisibilityFilter');
    const productSort = document.getElementById('productSort');
    const productViewMode = document.getElementById('productViewMode');
    const productCollections = document.getElementById('productCollections');
    const productsCount = document.getElementById('productsCount');
    const productPagination = document.querySelectorAll('[data-product-pagination]');
    const mergeSelectedProductsButton = document.getElementById('mergeSelectedProductsButton');
    const homeConfigEditor = document.getElementById('homeConfigEditor');
    const collectionForm = document.getElementById('collectionForm');
    const PRODUCT_COLLECTIONS_DRAFT_STORAGE_KEY = 'tandem_product_collections_draft';
    const collectionName = document.getElementById('collectionName');
    const collectionDescription = document.getElementById('collectionDescription');
    const collectionList = document.getElementById('collectionList');
    const HOME_CONFIG_STORAGE_KEY = 'tandem_home_config';
    const FEATURED_PRODUCTS_STORAGE_KEY = 'tandem_featured_products';
    const PRODUCT_COLLECTIONS_STORAGE_KEY = 'tandem_product_collections';
    const COLLECTIONS_STORAGE_KEY = 'tandem_collections';
    const STORAGE_LIMIT_BYTES = 1024 * 1024 * 1024;
    const STORAGE_BUCKETS = [
        { name: 'product-images', label: 'Imágenes' },
        { name: 'product-videos', label: 'Videos' }
    ];
    const STORAGE_WARNING_THRESHOLD = 0.7;
    const STORAGE_CRITICAL_THRESHOLD = 0.85;
    const HOME_CONFIG_DEFAULTS = {
        page_title: 'TaNdeM | Taller de Estampado',
        hero_mono: '[ TALLER DE GRABADO Y ESTAMPADO ]',
        hero_title: 'DISEÑO Y SERIGRAFÍA',
        hero_description: 'Materializamos tus ideas en prendas de alta calidad. Directo del taller a tus manos.',
        catalog_title: 'Productos',
        catalog_text: 'Estampamos, remeras, buzos tazas.Remeras , buzos y Camisetas de Argentina Futbol Selección. Bordadas . Sublimadas Intervenidas o sin.Consultanos.',
        about_title: 'Detrás del Taller',
        about_content: '<p>¡Hola! Soy <strong>Mabel Calabrese</strong>, Profesora en Grabado y Arte Impreso, creadora y emprendedora de este espacio.</p><p><strong>TaNdeM Taller de Grabado, Estampados y Más</strong> es mi emprendimiento principal; un taller de producción dedicado al trabajo manual, el diseño y el cuidado por los detalles en cada pieza.</p><p>Además, llevo adelante con mucho orgullo el proyecto <strong>TaNdeM Taller Creativo Terapéutico</strong>, un espacio de expresión y aprendizaje orientado especialmente a adolescentes, jóvenes y adultos dentro del espectro autista.</p>',
        mabel_photos: ['Mabel1.jpeg', 'Mabel2.jpeg']
    };

    togglePasswordButton.addEventListener('click', () => {
        const isVisible = password.type === 'password';
        password.type = isVisible ? 'text' : 'password';
        togglePasswordButton.setAttribute('aria-label', isVisible ? 'Ocultar contraseña' : 'Mostrar contraseña');
        togglePasswordButton.setAttribute('title', isVisible ? 'Ocultar contraseña' : 'Mostrar contraseña');
        togglePasswordButton.setAttribute('aria-pressed', String(isVisible));
    });

    if (!configReady) {
        loginStatus.textContent = 'El panel no está disponible en este momento. Avisale a soporte. Código: ADM-05.';
        loginForm.querySelector('button').disabled = true;
        return;
    }

    const rememberSession = document.getElementById('rememberSession');
    let client = createClient(false);
    let inactivityTimer;
    let categories = [];
    let categoryDetails = {};
    let allProducts = [];
    let currentProductPage = 1;
    const PRODUCTS_PER_PAGE = 8;
    const archivosPendientes = new WeakMap();

    function agregarArchivosAlInput(input, archivos) {
        const acumulados = [...(archivosPendientes.get(input) || []), ...archivos];
        const transferencia = new DataTransfer();
        acumulados.forEach(archivo => transferencia.items.add(archivo));
        input.files = transferencia.files;
        archivosPendientes.set(input, acumulados);
    }

    adminTabs.forEach(tab => tab.addEventListener('click', () => {
        const selectedTab = tab.dataset.adminTab;
        adminTabs.forEach(item => {
            const active = item === tab;
            item.classList.toggle('admin-tab-active', active);
            item.setAttribute('aria-selected', String(active));
        });
        adminPanels.forEach(panel => {
            panel.hidden = panel.dataset.adminPanel !== selectedTab;
            panel.classList.toggle('admin-panel-active', !panel.hidden);
        });
    }));

    function categoryKey(value) {
        return String(value || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    }

    function updateCategoryOptions(products) {
        const uniqueCategories = new Map();
        products.forEach(product => {
            const name = String(product.tipo || '').trim();
            if (name && !uniqueCategories.has(categoryKey(name))) uniqueCategories.set(categoryKey(name), name);
        });
        categories = [...uniqueCategories.values()].sort((first, second) => first.localeCompare(second, 'es'));
        productType.innerHTML = categories.map(category => `<option value="${escapeAttribute(category)}">${escapeText(category)}</option>`).join('')
            + '<option value="__new__">Crear nueva categoría...</option>';
        toggleNewCategory();
    }

    function convertirImagenAdministrativa(enlace) {
        const valor = String(enlace || '').trim();
        const archivo = valor.match(/drive\.google\.com\/file\/d\/([^/]+)/);
        if (archivo) return `https://drive.google.com/thumbnail?id=${archivo[1]}&sz=w800`;
        const consulta = valor.match(/[?&]id=([^&]+)/);
        if (valor.includes('drive.google.com') && consulta) return `https://drive.google.com/thumbnail?id=${consulta[1]}&sz=w800`;
        return valor || 'logo.JPG';
    }

    function toggleNewCategory() {
        const creating = productType.value === '__new__';
        newProductType.hidden = !creating;
        newProductType.required = creating;
        if (!creating) newProductType.value = '';
    }

    function getSelectedCategory() {
        if (productType.value !== '__new__') return productType.value.trim();
        const newCategory = newProductType.value.trim();
        if (!newCategory) throw new Error('Escribí el nombre de la nueva categoría.');
        if (categories.some(category => categoryKey(category) === categoryKey(newCategory))) {
            throw new Error('Esa categoría ya existe. Seleccionala de la lista.');
        }
        return newCategory;
    }

    function generarCodigo() {
        return `PRD-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    }

    function createClient(persistSession) {
        return window.supabase.createClient(window.TANDEM_SUPABASE_URL, window.TANDEM_SUPABASE_ANON_KEY, {
            auth: { persistSession }
        });
    }

    function setStatus(element, message, error = false) {
        element.textContent = message;
        element.classList.toggle('admin-status-error', error);
        element.classList.toggle('admin-status-success', !error && Boolean(message));
    }

    function resizeTextEditor(textarea) {
        textarea.style.height = 'auto';
        const styles = window.getComputedStyle(textarea);
        const verticalBorders = parseFloat(styles.borderTopWidth) + parseFloat(styles.borderBottomWidth);
        textarea.style.height = `${textarea.scrollHeight + verticalBorders + 4}px`;
    }

    function resizeTextEditors(container) {
        container.querySelectorAll('textarea.admin-text-editor').forEach(resizeTextEditor);
    }

    dashboardView.addEventListener('input', event => {
        if (event.target.matches('textarea.admin-text-editor')) {
            resizeTextEditor(event.target);
        }
    });

    function formatSupabaseError(error, operation = 'save') {
        const message = error && typeof error === 'object' ? error.message || String(error) : String(error || '');
        const status = Number(error?.status);
        let code;
        let friendlyMessage;

        if (status === 0 || /fetch|network|gateway|502|503|timeout|load failed|failed to fetch|connection/i.test(message)) {
            code = 'ADM-01';
            friendlyMessage = 'No pudimos conectar con el servicio. Revisá tu conexión y probá de nuevo en unos minutos.';
        } else if (/invalid login credentials|user not found|email not confirmed/i.test(message)) {
            code = 'ADM-02';
            friendlyMessage = 'Revisá que el correo y la contraseña estén escritos correctamente.';
        } else if (/violates row-level security policy|policy|permission denied|unauthorized|forbidden/i.test(message) || status === 401 || status === 403) {
            code = 'ADM-03';
            friendlyMessage = 'No se pudo completar el cambio. Avisale a soporte e indicá este código.';
        } else if (/storage|bucket|upload|image|video/i.test(message) || operation === 'upload') {
            code = 'ADM-04';
            friendlyMessage = 'No se pudieron subir las fotos o videos. Probá con otros archivos; si continúa, avisale a soporte.';
        } else {
            code = 'ADM-05';
            friendlyMessage = operation === 'load'
                ? 'No pudimos cargar la información. Probá de nuevo en unos minutos.'
                : 'No pudimos guardar los cambios. Probá de nuevo; si continúa, avisale a soporte.';
        }

        console.error(`[${code}] Falló la operación de administración (${operation}).`, error);
        return `${friendlyMessage} Código: ${code}.`;
    }

    function formatBytes(bytes) {
        const safeBytes = Number.isFinite(bytes) ? Math.max(0, bytes) : 0;
        if (safeBytes < 1024) return `${safeBytes} B`;

        const units = ['KB', 'MB', 'GB', 'TB'];
        let value = safeBytes / 1024;
        let unitIndex = 0;

        while (value >= 1024 && unitIndex < units.length - 1) {
            value /= 1024;
            unitIndex += 1;
        }

        return `${value.toFixed(value >= 10 || unitIndex === 0 ? 1 : 2)} ${units[unitIndex]}`;
    }

    async function loadStorageUsage() {
        const panel = document.getElementById('storageUsagePanel');
        const fill = document.getElementById('storageUsageFill');
        const text = document.getElementById('storageUsageText');
        const buckets = document.getElementById('storageUsageBuckets');

        if (!panel || !fill || !text || !buckets || !client) return;

        panel.hidden = false;
        text.textContent = 'Calculando espacio usado...';
        fill.style.width = '0%';
        buckets.innerHTML = '';

        try {
            const detalleBuckets = await Promise.all(STORAGE_BUCKETS.map(async ({ name, label }) => {
                const { data, error } = await client.storage.from(name).list('', { limit: 1000, offset: 0 });
                if (error) throw error;

                const bytes = (data || []).reduce((total, file) => total + Number(file.metadata?.contentLength || file.metadata?.size || 0), 0);
                return {
                    label,
                    bytes,
                    count: data?.length || 0
                };
            }));

            const totalBytes = detalleBuckets.reduce((sum, bucket) => sum + bucket.bytes, 0);
            const percentageUsed = Math.min((totalBytes / STORAGE_LIMIT_BYTES) * 100, 100);
            const percentageFree = Math.max(0, 100 - percentageUsed);

            fill.style.width = `${percentageUsed}%`;
            panel.classList.toggle('admin-storage-panel--warn', percentageUsed >= STORAGE_WARNING_THRESHOLD * 100 && percentageUsed < STORAGE_CRITICAL_THRESHOLD * 100);
            panel.classList.toggle('admin-storage-panel--critical', percentageUsed >= STORAGE_CRITICAL_THRESHOLD * 100);

            let warningText = '';
            if (percentageUsed >= STORAGE_CRITICAL_THRESHOLD * 100) {
                warningText = ' · Atención: queda poco espacio de almacenamiento.';
            } else if (percentageUsed >= STORAGE_WARNING_THRESHOLD * 100) {
                warningText = ' · Cuidado: ya usaste más del 70% del espacio disponible.';
            }

            text.textContent = `${formatBytes(totalBytes)} usados · ${formatBytes(STORAGE_LIMIT_BYTES)} estimados · ${percentageFree.toFixed(0)}% libres${warningText}`;

            buckets.innerHTML = detalleBuckets.map(bucket => {
                const bucketShare = totalBytes ? (bucket.bytes / totalBytes) * 100 : 0;
                return `
                    <div class="admin-storage-bucket">
                        <div class="admin-storage-bucket__meta">
                            <span>${bucket.label}</span>
                            <strong>${formatBytes(bucket.bytes)}</strong>
                        </div>
                        <div class="admin-storage-bucket__bar">
                            <span style="width: ${Math.min(bucketShare, 100)}%"></span>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (error) {
            text.textContent = 'No se pudo consultar el espacio de almacenamiento.';
            fill.style.width = '0%';
            buckets.innerHTML = `<p class="admin-storage-error">${formatSupabaseError(error, 'load')}</p>`;
        }
    }

    function hasMissingCollectionsColumnError(error) {
        const message = error && typeof error === 'object' ? error.message || String(error) : String(error || '');
        return /Could not find the 'colecciones' column of 'productos' in the schema cache|column.*colecciones.*does not exist|colecciones.*schema cache/i.test(message);
    }

    async function insertProductWithFallback(payload) {
        let candidatePayload = payload;
        let lastError = null;

        for (let attempt = 0; attempt < 2; attempt += 1) {
            const { data, error } = await client.from('productos').insert(candidatePayload).select('id');
            if (!error) return { data, error: null };
            lastError = error;
            if (!hasMissingCollectionsColumnError(error) || !Object.prototype.hasOwnProperty.call(candidatePayload, 'colecciones')) break;
            candidatePayload = { ...candidatePayload };
            delete candidatePayload.colecciones;
        }

        return { data: null, error: lastError };
    }

    async function updateProductWithFallback(productId, payload) {
        let candidatePayload = payload;
        let lastError = null;

        for (let attempt = 0; attempt < 2; attempt += 1) {
            const { error } = await client.from('productos').update(candidatePayload).eq('id', productId);
            if (!error) return { error: null };
            lastError = error;
            if (!hasMissingCollectionsColumnError(error) || !Object.prototype.hasOwnProperty.call(candidatePayload, 'colecciones')) break;
            candidatePayload = { ...candidatePayload };
            delete candidatePayload.colecciones;
        }

        return { error: lastError };
    }

    function setButtonState(button, busyText, showSuccess = true) {
        if (!button) return () => {};
        const originalText = button.textContent;
        button.disabled = true;
        button.classList.remove('btn-success');
        button.classList.add('btn-loading');
        button.textContent = busyText;
        return (successText = '') => {
            button.disabled = false;
            button.classList.remove('btn-loading');
            if (!successText || !showSuccess) {
                button.classList.remove('btn-success');
                button.textContent = originalText;
                return;
            }
            button.classList.add('btn-success');
            button.textContent = successText;
        };
    }

    function normalizeHomeConfig(config = {}) {
        const sanitizedConfig = {
            ...(config || {})
        };
        const legacyPhotos = [sanitizedConfig.mabel_1, sanitizedConfig.mabel_2].filter(Boolean).map(String);
        const mabelPhotos = Array.isArray(sanitizedConfig.mabel_photos)
            ? sanitizedConfig.mabel_photos.filter(Boolean).map(String)
            : legacyPhotos;

        return {
            ...HOME_CONFIG_DEFAULTS,
            ...sanitizedConfig,
            mabel_photos: mabelPhotos.length ? mabelPhotos : HOME_CONFIG_DEFAULTS.mabel_photos
        };
    }

    function readHomeConfig() {
        try {
            const rawValue = window.localStorage.getItem(HOME_CONFIG_STORAGE_KEY);
            if (!rawValue) return normalizeHomeConfig();
            return normalizeHomeConfig(JSON.parse(rawValue));
        } catch (error) {
            return normalizeHomeConfig();
        }
    }

    function normalizeCollections(value) {
        return [...new Set(String(value || '').split(/[;,\n]/).map(item => item.trim()).filter(Boolean))];
    }

    function normalizeCollectionEntries(collections) {
        if (!Array.isArray(collections)) return [];
        return collections
            .map(collection => {
                if (typeof collection === 'string') {
                    const nombre = collection.trim();
                    return nombre ? { nombre, descripcion: '' } : null;
                }
                if (collection && typeof collection === 'object') {
                    const nombre = String(collection.nombre || collection.name || '').trim();
                    if (!nombre) return null;
                    return {
                        nombre,
                        descripcion: String(collection.descripcion || collection.description || '').trim()
                    };
                }
                return null;
            })
            .filter(Boolean);
    }

    function readCollections() {
        try {
            const rawValue = window.localStorage.getItem(COLLECTIONS_STORAGE_KEY);
            if (!rawValue) return [];
            const parsed = JSON.parse(rawValue);
            return normalizeCollectionEntries(parsed);
        } catch (error) {
            return [];
        }
    }

    function writeCollections(collections) {
        try {
            window.localStorage.setItem(COLLECTIONS_STORAGE_KEY, JSON.stringify(normalizeCollectionEntries(collections)));
        } catch (error) {
            // Ignorar errores de almacenamiento local.
        }
    }

    function syncCollectionsFromProducts() {
        const collections = new Map();
        readCollections().forEach(collection => {
            collections.set(categoryKey(collection.nombre), {
                nombre: collection.nombre,
                descripcion: collection.descripcion || ''
            });
        });
        allProducts.forEach(product => {
            normalizeCollections(product.colecciones || '').forEach(collection => {
                if (!collections.has(categoryKey(collection))) {
                    collections.set(categoryKey(collection), {
                        nombre: collection,
                        descripcion: ''
                    });
                }
            });
        });
        Object.values(readProductCollections()).forEach(storedCollectionList => {
            normalizeCollections(storedCollectionList).forEach(collection => {
                if (!collections.has(categoryKey(collection))) {
                    collections.set(categoryKey(collection), {
                        nombre: collection,
                        descripcion: ''
                    });
                }
            });
        });
        const orderedCollections = [...collections.values()].sort((first, second) => first.nombre.localeCompare(second.nombre, 'es'));
        writeCollections(orderedCollections);
        return orderedCollections.map(collection => collection.nombre);
    }

    function mergeProductsIntoTarget(products) {
        if (!Array.isArray(products) || products.length < 2) return null;

        const target = products[0];
        const images = [];
        const collections = [];
        const seenImages = new Set();
        const seenCollections = new Set();

        products.forEach(product => {
            (Array.isArray(product.imagenes) ? product.imagenes : []).forEach(image => {
                const value = String(image || '').trim();
                if (value && !seenImages.has(value)) {
                    seenImages.add(value);
                    images.push(value);
                }
            });
            normalizeCollections(product.colecciones || '').forEach(collection => {
                const key = categoryKey(collection);
                if (key && !seenCollections.has(key)) {
                    seenCollections.add(key);
                    collections.push(collection);
                }
            });
        });

        return {
            codigo: target.codigo || `PRD-${String(target.id).slice(0, 6).toUpperCase()}`,
            nombre: target.nombre || '',
            tipo: target.tipo || '',
            descripcion: target.descripcion || '',
            precio: target.precio || '',
            activo: target.activo !== false,
            imagenes: images,
            colecciones: collections.join(', ')
        };
    }

    function getAvailableCollections() {
        const collections = new Set(syncCollectionsFromProducts());
        return [...collections].sort((first, second) => first.localeCompare(second, 'es'));
    }

    function renderCollectionOptions(selectedCollections = []) {
        if (!productCollections) return;
        const availableCollections = getAvailableCollections();
        const effectiveSelectedCollections = selectedCollections.length ? selectedCollections : readProductCollectionsDraft();
        productCollections.innerHTML = availableCollections.length
            ? availableCollections.map(collection => `
                <label class="admin-collection-option">
                    <input type="checkbox" value="${escapeAttribute(collection)}" ${effectiveSelectedCollections.includes(collection) ? 'checked' : ''}>
                    <span>${escapeText(collection)}</span>
                </label>
            `).join('')
            : '<p class="admin-collection-empty">Sin colecciones disponibles</p>';
        productCollections.classList.toggle('admin-collection-checkboxes--disabled', availableCollections.length === 0);
        const summary = document.getElementById('productCollectionsSummary');
        if (summary) {
            const selectedCount = Array.from(productCollections.querySelectorAll('input[type="checkbox"]:checked')).length;
            summary.textContent = `${selectedCount} colecciones seleccionadas`;
        }
    }

    function renderCollectionsManager() {
        if (!collectionList) return;
        const collections = readCollections();
        collectionList.innerHTML = collections.length
            ? collections.map(collection => `
                <article class="admin-collection-row" data-collection="${escapeAttribute(collection.nombre)}">
                    <div class="admin-collection-detail">
                        <h3>${escapeText(collection.nombre)}</h3>
                        <label class="admin-collection-label">Descripción</label>
                        <textarea data-collection-description="${escapeAttribute(collection.nombre)}" rows="2" placeholder="Escribí una breve descripción de esta colección">${escapeText(collection.descripcion || '')}</textarea>
                    </div>
                    <div class="admin-collection-actions">
                        <button class="btn" data-collection-action="save" type="button">Guardar descripción</button>
                        <button class="btn btn-danger" data-collection-action="delete" type="button">Eliminar</button>
                    </div>
                </article>
            `).join('')
            : '<p>No hay colecciones creadas todavía.</p>';
        resizeTextEditors(collectionList);
    }

    function readProductCollections() {
        try {
            const rawValue = window.localStorage.getItem(PRODUCT_COLLECTIONS_STORAGE_KEY);
            if (!rawValue) return {};
            const parsed = JSON.parse(rawValue);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (error) {
            return {};
        }
    }

    function writeProductCollections(collections) {
        try {
            window.localStorage.setItem(PRODUCT_COLLECTIONS_STORAGE_KEY, JSON.stringify(collections));
        } catch (error) {
            // Ignorar errores de almacenamiento local.
        }
    }

    function readProductCollectionsDraft() {
        try {
            const rawValue = window.localStorage.getItem(PRODUCT_COLLECTIONS_DRAFT_STORAGE_KEY);
            if (!rawValue) return [];
            const parsed = JSON.parse(rawValue);
            return Array.isArray(parsed)
                ? parsed.map(item => String(item || '').trim()).filter(Boolean)
                : [];
        } catch (error) {
            return [];
        }
    }

    function writeProductCollectionsDraft(collections) {
        try {
            const nextCollections = [...new Set((Array.isArray(collections) ? collections : []).map(item => String(item || '').trim()).filter(Boolean))];
            window.localStorage.setItem(PRODUCT_COLLECTIONS_DRAFT_STORAGE_KEY, JSON.stringify(nextCollections));
        } catch (error) {
            // Ignorar errores de almacenamiento local.
        }
    }

    function readFeaturedProducts() {
        try {
            const rawValue = window.localStorage.getItem(FEATURED_PRODUCTS_STORAGE_KEY);
            if (!rawValue) return {};
            const parsed = JSON.parse(rawValue);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (error) {
            return {};
        }
    }

    function writeFeaturedProducts(featuredProducts) {
        try {
            window.localStorage.setItem(FEATURED_PRODUCTS_STORAGE_KEY, JSON.stringify(featuredProducts));
        } catch (error) {
            // Ignorar errores de almacenamiento local.
        }
    }

    function writeHomeConfig(config) {
        try {
            window.localStorage.setItem(HOME_CONFIG_STORAGE_KEY, JSON.stringify(normalizeHomeConfig(config)));
        } catch (error) {
            // Ignorar errores de almacenamiento local.
        }
    }

    function renderHomeConfigEditor() {
        if (!homeConfigEditor) return;
        const config = readHomeConfig();
        homeConfigEditor.innerHTML = `
            <form id="homeConfigForm" class="admin-form">
                <label for="homeConfigPageTitle">Título del sitio</label>
                <input id="homeConfigPageTitle" value="${escapeAttribute(config.page_title)}" placeholder="Ej: TaNdeM | Taller de Estampado">

                <label for="homeConfigHeroMono">Texto pequeño del hero</label>
                <input id="homeConfigHeroMono" value="${escapeAttribute(config.hero_mono)}" placeholder="Ej: [ TALLER DE GRABADO Y ESTAMPADO ]">

                <label for="homeConfigHeroTitle">Título principal del hero</label>
                <input id="homeConfigHeroTitle" value="${escapeAttribute(config.hero_title)}" placeholder="Ej: DISEÑO Y SERIGRAFÍA">

                <label for="homeConfigHeroDescription">Descripción del hero</label>
                <textarea id="homeConfigHeroDescription" class="admin-text-editor" rows="6" placeholder="Descripción principal de la portada">${escapeText(config.hero_description)}</textarea>

                <label for="homeConfigCatalogTitle">Título de la sección catálogo</label>
                <input id="homeConfigCatalogTitle" value="${escapeAttribute(config.catalog_title)}" placeholder="Ej: Productos">

                <label for="homeConfigCatalogText">Texto que se muestra en el catálogo</label>
                <textarea id="homeConfigCatalogText" class="admin-text-editor" rows="6" placeholder="Texto breve para la sección de catálogo">${escapeText(config.catalog_text)}</textarea>

                <label for="homeConfigAboutTitle">Título de “Detrás del Taller”</label>
                <input id="homeConfigAboutTitle" value="${escapeAttribute(config.about_title)}" placeholder="Ej: Detrás del Taller">

                <label for="homeConfigAboutContent">Contenido de “Detrás del Taller”</label>
                <textarea id="homeConfigAboutContent" class="admin-text-editor" rows="10" placeholder="Podés usar HTML básico para dar formato.">${escapeText(config.about_content)}</textarea>

                <label for="homeConfigMabelPhotos">Fotos de Mabel</label>
                <input id="homeConfigMabelPhotos" type="file" accept="image/*" multiple>
                <small>Podés agregar todas las fotos que quieras. La primera será la principal para la portada.</small>

                <div class="admin-home-photo-preview">
                    ${config.mabel_photos.map((photo, index) => `
                        <div>
                            <small>Foto ${index + 1}</small>
                            <img src="${escapeAttribute(convertirImagenAdministrativa(photo))}" alt="Mabel foto ${index + 1}" onerror="this.onerror=null;this.src='logo.JPG'">
                        </div>
                    `).join('')}
                </div>

                <button class="btn btn-accent" type="submit">Guardar contenido</button>
            </form>
        `;
        resizeTextEditors(homeConfigEditor);
    }

    async function loadHomeConfigForAdmin() {
        try {
            if (window.cargarConfiguracionPaginaPrincipalDesdeSupabase) {
                const remoteConfig = await window.cargarConfiguracionPaginaPrincipalDesdeSupabase();
                if (remoteConfig) {
                    writeHomeConfig(remoteConfig);
                    renderHomeConfigEditor();
                }
            }
        } catch (error) {
            setStatus(dashboardStatus, formatSupabaseError(error, 'load'), true);
        }
    }

    async function showDashboard() {
        loginView.hidden = true;
        dashboardView.hidden = false;
        const adminAccess = document.getElementById('adminAccess');
        if (adminAccess) adminAccess.hidden = false;
        document.body.classList.add('admin-open');
        renderHomeConfigEditor();
        await loadHomeConfigForAdmin();
        await loadProducts();
        resetInactivityTimer();
    }

    function resetInactivityTimer() {
        window.clearTimeout(inactivityTimer);
        inactivityTimer = window.setTimeout(async () => {
            await client.auth.signOut();
            dashboardView.hidden = true;
            loginView.hidden = false;
            setStatus(loginStatus, 'La sesión se cerró por inactividad.');
        }, 30 * 60 * 1000);
    }

    async function loadProducts() {
        const { data, error } = await client.from('productos').select('*').order('orden').order('creado_en', { ascending: false });
        if (error) {
            setStatus(dashboardStatus, formatSupabaseError(error, 'load'), true);
            return;
        }
        const storedCollections = readProductCollections();
        allProducts = data.map(product => ({
            ...product,
            colecciones: normalizeCollections(product.colecciones || storedCollections[product.id] || []).join(', ')
        }));
        syncCollectionsFromProducts();
        updateCategoryOptions(data);
        productCategoryFilter.innerHTML = '<option value="">Todas las categorías</option>' + categories.map(category => `<option value="${escapeAttribute(category)}">${escapeText(category)}</option>`).join('');
        renderCollectionOptions();
        renderCollectionsManager();
        renderProducts();
        loadCategoryDetails();
        await loadStorageUsage();
    }

    function applyProductsViewMode() {
        if (!productsList || !productViewMode) return;
        const isGrid = productViewMode.value === 'cuadricula';
        productsList.classList.toggle('admin-products--grid', isGrid);
        productsList.classList.toggle('admin-products--list', !isGrid);
        if (!productViewMode.value) {
            productViewMode.value = 'cuadricula';
        }
    }

    function renderProducts() {
        const search = productSearch.value.trim().toLowerCase();
        const visibility = productVisibilityFilter.value;
        const sort = productSort.value;
        const selectedCategory = categoryKey(productCategoryFilter.value);
        const featuredProducts = readFeaturedProducts();
        const filteredProducts = allProducts.filter(product => {
            const searchable = [product.codigo, product.nombre, product.descripcion, product.tipo].join(' ').toLowerCase();
            const matchesSearch = !search || searchable.includes(search);
            const matchesCategory = !selectedCategory || categoryKey(product.tipo) === selectedCategory;
            const matchesVisibility = visibility === 'todos' || (visibility === 'visibles' ? product.activo : !product.activo);
            return matchesSearch && matchesCategory && matchesVisibility;
        }).sort((first, second) => {
            if (sort === 'alfabetico') return String(first.codigo || '').localeCompare(String(second.codigo || ''), 'es');
            const firstDate = new Date(first.creado_en || 0).getTime();
            const secondDate = new Date(second.creado_en || 0).getTime();
            return sort === 'antiguos' ? firstDate - secondDate : secondDate - firstDate;
        });
        const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE));
        currentProductPage = Math.min(currentProductPage, totalPages);
        const pageStart = (currentProductPage - 1) * PRODUCTS_PER_PAGE;
        const productsOnPage = filteredProducts.slice(pageStart, pageStart + PRODUCTS_PER_PAGE);
        const visibleStart = filteredProducts.length ? pageStart + 1 : 0;
        const visibleEnd = Math.min(pageStart + PRODUCTS_PER_PAGE, filteredProducts.length);
        productsCount.textContent = filteredProducts.length
            ? `Mostrando ${visibleStart}-${visibleEnd} de ${filteredProducts.length} trabajos`
            : `0 de ${allProducts.length} trabajos`;
        renderProductPagination(totalPages);
        productsList.innerHTML = productsOnPage.map(product => {
            const isFeatured = featuredProducts[categoryKey(product.tipo)] === String(product.id);
            return `
            <article class="admin-product-row" data-id="${product.id}" data-images="${escapeAttribute(JSON.stringify(product.imagenes || []))}">
                <label class="admin-product-merge-select" aria-label="Seleccionar para fusionar">
                    <input type="checkbox" data-merge-select value="${product.id}">
                </label>
                ${renderMediaMarkup(product.imagenes?.[0], { compact: true }) || `<img src="${escapeAttribute(convertirImagenAdministrativa(product.imagenes?.[0]))}" alt="" onerror="this.onerror=null;this.src='logo.JPG'">`}
                <div><input data-field="codigo" value="${escapeAttribute(product.codigo || `PRD-${product.id.slice(0, 6).toUpperCase()}`)}" placeholder="Código único"><input data-field="nombre" value="${escapeAttribute(product.nombre)}"><select data-field="tipo">${categories.map(category => `<option value="${escapeAttribute(category)}" ${categoryKey(category) === categoryKey(product.tipo) ? 'selected' : ''}>${escapeText(category)}</option>`).join('')}<option value="__new__">Crear nueva categoría...</option></select><input data-field="nuevo-tipo" placeholder="Nueva categoría" hidden></div>
                <textarea data-field="descripcion" rows="2">${escapeText(product.descripcion)}</textarea>
                <input data-field="precio" value="${escapeAttribute(product.precio)}" placeholder="Precio">
                <div class="admin-product-flags">
                    <label class="admin-flag"><input data-field="activo" type="checkbox" ${product.activo ? 'checked' : ''}> Visible</label>
                    <label class="admin-flag" title="Usa este trabajo como imagen principal de la categoría en la portada"><input data-field="destacado" type="checkbox" ${isFeatured ? 'checked' : ''}> Usar como imagen principal</label>
                </div>
                <div class="admin-edit-images"><strong>Fotos y videos</strong><div class="admin-existing-images"></div><label class="admin-image-picker">Elegir fotos o videos<input data-field="imagenes" type="file" accept="image/*,video/*" multiple></label><div class="admin-collections-field"><span>Colecciones</span><div data-field="colecciones" class="admin-collection-checkboxes admin-collection-checkboxes--compact">${getAvailableCollections().map(collection => `<label class="admin-collection-option"><input type="checkbox" data-field="coleccion" value="${escapeAttribute(collection)}" ${normalizeCollections(product.colecciones || '').includes(collection) ? 'checked' : ''}><span>${escapeText(collection)}</span></label>`).join('')}</div></div><select data-field="modo-imagenes"><option value="agregar">Agregar a las actuales</option><option value="reemplazar">Reemplazar todas</option></select></div>
                <div class="admin-product-actions"><button class="btn" data-action="save" type="button">Guardar</button><button class="btn btn-danger" data-action="delete" type="button">Eliminar</button></div>
            </article>`;
        }).join('');
        productsList.querySelectorAll('[data-id]').forEach(row => renderExistingImages(row));
        applyProductsViewMode();
        updateMergeSelectionUI();
    }

    function renderProductPagination(totalPages) {
        if (!productPagination.length) return;
        if (totalPages <= 1) {
            productPagination.forEach(pagination => {
                pagination.hidden = true;
                pagination.innerHTML = '';
            });
            return;
        }

        const pageButtons = Array.from({ length: totalPages }, (_, index) => {
            const page = index + 1;
            const active = page === currentProductPage;
            return `<button class="admin-pagination-button${active ? ' admin-pagination-button--active' : ''}" type="button" data-product-page="${page}" aria-label="Ir a la página ${page}" aria-current="${active ? 'page' : 'false'}">${page}</button>`;
        }).join('');
        const paginationMarkup = `
            <button class="admin-pagination-button" type="button" data-product-page="${currentProductPage - 1}" ${currentProductPage === 1 ? 'disabled' : ''}>Anterior</button>
            <div class="admin-pagination-pages">${pageButtons}</div>
            <button class="admin-pagination-button" type="button" data-product-page="${currentProductPage + 1}" ${currentProductPage === totalPages ? 'disabled' : ''}>Siguiente</button>
        `;
        productPagination.forEach(pagination => {
            pagination.hidden = false;
            pagination.innerHTML = paginationMarkup;
        });
    }

    function updateMergeSelectionUI() {
        if (!mergeSelectedProductsButton || !productsList) return;
        const selected = productsList.querySelectorAll('[data-merge-select]:checked').length;
        mergeSelectedProductsButton.disabled = selected < 2;
        mergeSelectedProductsButton.textContent = selected >= 2 ? `Fusionar (${selected})` : 'Fusionar';
        mergeSelectedProductsButton.setAttribute('aria-label', selected >= 2
            ? `Fusionar ${selected} trabajos seleccionados`
            : 'Fusionar trabajos seleccionados; elegí al menos dos');
        mergeSelectedProductsButton.title = selected >= 2
            ? `Fusionar ${selected} trabajos seleccionados`
            : 'Seleccioná al menos dos trabajos para fusionarlos';
    }

    function renderExistingImages(row) {
        const container = row.querySelector('.admin-existing-images');
        const images = JSON.parse(row.dataset.images || '[]');
        container.innerHTML = images.map(image => renderMediaMarkup(image, { compact: true })).join('');
    }

    async function loadCategoryDetails() {
        const { data, error } = await client.from('categorias').select('*').order('tipo');
        if (error) {
            categoryList.innerHTML = `<p>${formatSupabaseError(error, 'load')}</p>`;
            return;
        }
        categoryDetails = Object.fromEntries(data.map(category => [categoryKey(category.tipo), category]));
        categoryList.innerHTML = categories.map(category => {
            const detail = categoryDetails[categoryKey(category)] || {};
            return `<article class="admin-category-row" data-category="${escapeAttribute(category)}">
                <h3>${escapeText(category)}</h3>
                <label>Título de la categoría<input data-category-field="titulo" value="${escapeAttribute(detail.titulo)}" placeholder="Ej: Remeras"></label>
                <label>Descripción de portada<textarea class="admin-text-editor" data-category-field="texto_tarjeta" rows="5" placeholder="Texto breve para la página principal">${escapeText(detail.texto_tarjeta)}</textarea></label>
                <label>Texto superior de la categoría<textarea class="admin-text-editor" data-category-field="texto" rows="7" placeholder="Descripción general de la categoría">${escapeText(detail.texto)}</textarea></label>
                <label>Precio general<input data-category-field="precio" value="${escapeAttribute(detail.precio)}" placeholder="Opcional"></label>
                <button class="btn" data-category-action="save" type="button">Guardar textos</button>
            </article>`;
        }).join('');
        resizeTextEditors(categoryList);
    }

    function escapeAttribute(value) {
        return String(value || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    }

    function escapeText(value) {
        return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function esVideoUrl(valor) {
        const url = String(valor || '').trim().toLowerCase();
        return /\.(mp4|webm|mov|m4v|ogg)(?:[?#]|$)/i.test(url) || /video/i.test(url);
    }

    function esVideoFile(file) {
        return file && (file.type?.startsWith('video/') || /\.(mp4|webm|mov|m4v|ogg)$/i.test(file.name || ''));
    }

    function renderMediaMarkup(url, { compact = false } = {}) {
        const valor = String(url || '').trim();
        if (!valor) return '';
        if (esVideoUrl(valor)) {
            return `<video src="${escapeAttribute(valor)}" controls muted playsinline preload="metadata" ${compact ? 'class="admin-media-compact"' : ''}></video>`;
        }
        return `<img src="${escapeAttribute(convertirImagenAdministrativa(valor))}" alt="" onerror="this.onerror=null;this.src='logo.JPG'">`;
    }

    function optimizarImagen(file) {
        return new Promise((resolve, reject) => {
            const imagen = new Image();
            const lector = new FileReader();
            lector.onload = () => { imagen.src = lector.result; };
            lector.onerror = () => reject(new Error(`No se pudo leer ${file.name}.`));
            imagen.onload = () => {
                const escala = Math.min(1, 1600 / Math.max(imagen.width, imagen.height));
                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(imagen.width * escala));
                canvas.height = Math.max(1, Math.round(imagen.height * escala));
                canvas.getContext('2d').drawImage(imagen, 0, 0, canvas.width, canvas.height);
                canvas.toBlob(blob => {
                    if (!blob) {
                        resolve(file);
                        return;
                    }
                    resolve(new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.webp`, { type: 'image/webp' }));
                }, 'image/webp', 0.82);
            };
            imagen.onerror = () => reject(new Error(`No se pudo procesar ${file.name}.`));
            lector.readAsDataURL(file);
        });
    }

    async function uploadImages(files) {
        const urls = [];
        for (const file of files) {
            const esVideo = esVideoFile(file);
            const bucketName = esVideo ? 'product-videos' : 'product-images';
            const archivo = esVideo ? file : await optimizarImagen(file);
            const path = `${crypto.randomUUID()}-${archivo.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
            const upload = await client.storage.from(bucketName).upload(path, archivo, {
                upsert: false,
                contentType: archivo.type || (esVideo ? 'video/mp4' : 'image/webp')
            });
            if (upload.error) throw upload.error;
            urls.push(client.storage.from(bucketName).getPublicUrl(path).data.publicUrl);
        }
        return urls;
    }

    function renderPreview() {
        imagePreview.innerHTML = '';
        [...imageInput.files].forEach(file => {
            const preview = document.createElement('span');
            const nombre = document.createElement('small');
            nombre.textContent = file.name;
            preview.appendChild(nombre);
            if (esVideoFile(file)) {
                const video = document.createElement('video');
                video.src = URL.createObjectURL(file);
                video.controls = true;
                video.muted = true;
                video.playsInline = true;
                video.preload = 'metadata';
                video.onloadeddata = () => URL.revokeObjectURL(video.src);
                preview.appendChild(video);
            } else {
                const imagen = document.createElement('img');
                imagen.src = URL.createObjectURL(file);
                imagen.alt = file.name;
                imagen.onload = () => URL.revokeObjectURL(imagen.src);
                preview.appendChild(imagen);
            }
            imagePreview.appendChild(preview);
        });
    }

    loginForm.addEventListener('submit', async event => {
        event.preventDefault();
        setStatus(loginStatus, 'Ingresando...');
        client = createClient(Boolean(rememberSession && rememberSession.checked));
        const { error } = await client.auth.signInWithPassword({ email: email.value, password: password.value });
        if (error) {
            setStatus(loginStatus, formatSupabaseError(error, 'login'), true);
            return;
        }
        showDashboard();
    });

    homeConfigEditor.addEventListener('submit', async event => {
        if (!event.target || event.target.id !== 'homeConfigForm') return;
        event.preventDefault();
        const form = event.target;
        const restoreButton = setButtonState(form.querySelector('button[type="submit"]'), 'Guardando...');
        let saved = false;
        setStatus(dashboardStatus, 'Guardando contenido...');

        try {
            const config = readHomeConfig();
            const nextConfig = {
                page_title: form.querySelector('#homeConfigPageTitle').value.trim() || HOME_CONFIG_DEFAULTS.page_title,
                hero_mono: form.querySelector('#homeConfigHeroMono').value.trim() || HOME_CONFIG_DEFAULTS.hero_mono,
                hero_title: form.querySelector('#homeConfigHeroTitle').value.trim() || HOME_CONFIG_DEFAULTS.hero_title,
                hero_description: form.querySelector('#homeConfigHeroDescription').value.trim() || HOME_CONFIG_DEFAULTS.hero_description,
                catalog_title: form.querySelector('#homeConfigCatalogTitle').value.trim() || HOME_CONFIG_DEFAULTS.catalog_title,
                catalog_text: form.querySelector('#homeConfigCatalogText').value.trim() || HOME_CONFIG_DEFAULTS.catalog_text,
                about_title: form.querySelector('#homeConfigAboutTitle').value.trim() || HOME_CONFIG_DEFAULTS.about_title,
                about_content: form.querySelector('#homeConfigAboutContent').value.trim() || HOME_CONFIG_DEFAULTS.about_content,
                mabel_photos: [...(config.mabel_photos || [])]
            };

            const newMabelPhotos = form.querySelector('#homeConfigMabelPhotos').files;
            if (newMabelPhotos && newMabelPhotos.length) {
                const uploaded = await uploadImages(newMabelPhotos);
                nextConfig.mabel_photos = [...nextConfig.mabel_photos, ...uploaded];
            }

            writeHomeConfig(nextConfig);
            try {
                const { error } = await client.from('pagina_principal').upsert({
                    id: 'inicio',
                    titulo_pagina: nextConfig.page_title,
                    hero_mono: nextConfig.hero_mono,
                    hero_titulo: nextConfig.hero_title,
                    hero_descripcion: nextConfig.hero_description,
                    catalogo_titulo: nextConfig.catalog_title,
                    catalogo_texto: nextConfig.catalog_text,
                    acerca_titulo: nextConfig.about_title,
                    acerca_contenido: nextConfig.about_content,
                    foto_mabel_1: nextConfig.mabel_photos[0] || '',
                    foto_mabel_2: nextConfig.mabel_photos[1] || '',
                    foto_mabel_galeria: JSON.stringify(nextConfig.mabel_photos)
                });
                if (error) throw error;
            } catch (error) {
                setStatus(dashboardStatus, `El contenido quedó guardado en este dispositivo, pero no se compartió con el catálogo. ${formatSupabaseError(error)}`, true);
                return;
            }

            saved = true;
            renderHomeConfigEditor();
            setStatus(dashboardStatus, 'Contenido de la página principal guardado.');
        } catch (error) {
            setStatus(dashboardStatus, formatSupabaseError(error, 'upload'), true);
        } finally {
            restoreButton(saved ? 'Guardado' : '');
        }
    });

    collectionForm.addEventListener('submit', async event => {
        event.preventDefault();
        const createButton = collectionForm.querySelector('button[type="submit"]');
        const restoreButton = setButtonState(createButton, 'Creando...');
        let created = false;

        try {
            const nombre = normalizeCollections(collectionName.value)[0];
            const descripcion = String(collectionDescription.value || '').trim();
            if (!nombre) {
                restoreButton();
                setStatus(dashboardStatus, 'Escribí el nombre de la colección.', true);
                return;
            }

            const collections = readCollections();
            if (collections.some(collection => categoryKey(collection.nombre) === categoryKey(nombre))) {
                restoreButton();
                setStatus(dashboardStatus, 'Esa colección ya existe.', true);
                return;
            }

            const nextCollections = [...collections, { nombre, descripcion }].sort((first, second) => first.nombre.localeCompare(second.nombre, 'es'));
            writeCollections(nextCollections);
            collectionName.value = '';
            collectionDescription.value = '';
            renderProducts();
            renderCollectionOptions();
            renderCollectionsManager();
            created = true;
            setStatus(dashboardStatus, 'Colección agregada.');
        } finally {
            restoreButton(created ? 'Creada' : '');
        }
    });

    collectionList.addEventListener('click', event => {
        const action = event.target.dataset.collectionAction;
        const row = event.target.closest('[data-collection]');
        if (!row) return;
        const collection = row.dataset.collection;
        if (!collection) return;
        const button = event.target.closest('button');
        if (!button) return;

        if (action === 'delete') {
            const restoreButton = setButtonState(button, 'Eliminando...');
            let removed = false;
            try {
                const collections = readCollections().filter(item => categoryKey(item.nombre) !== categoryKey(collection));
                writeCollections(collections);
                renderProducts();
                renderCollectionOptions();
                renderCollectionsManager();
                removed = true;
                setStatus(dashboardStatus, 'Colección eliminada.');
            } finally {
                restoreButton(removed ? 'Eliminada' : '');
            }
            return;
        }

        if (action === 'save') {
            const restoreButton = setButtonState(button, 'Guardando...');
            let saved = false;
            try {
                const textarea = row.querySelector('[data-collection-description]');
                const nextDescription = String(textarea?.value || '').trim();
                const collections = readCollections().map(item => {
                    if (categoryKey(item.nombre) === categoryKey(collection)) {
                        return { ...item, descripcion: nextDescription };
                    }
                    return item;
                });
                writeCollections(collections);
                renderProducts();
                renderCollectionOptions();
                renderCollectionsManager();
                saved = true;
                setStatus(dashboardStatus, 'Descripción actualizada.');
            } finally {
                restoreButton(saved ? 'Guardado' : '');
            }
        }
    });

    productForm.addEventListener('submit', async event => {
        event.preventDefault();
        const restoreButton = setButtonState(productForm.querySelector('button[type="submit"]'), 'Guardando...');
        let saved = false;
        setStatus(dashboardStatus, 'Guardando...');
        try {
            const category = getSelectedCategory();
            const imageUrls = await uploadImages(imageInput.files);
            const colecciones = Array.from(productCollections?.querySelectorAll('input[type="checkbox"]:checked') || []).map(option => option.value.trim()).filter(Boolean);
            const coleccionesTexto = normalizeCollections(colecciones).join(', ');
            const payload = {
                codigo: productCode.value.trim() || generarCodigo(),
                nombre: productName.value.trim(),
                tipo: category,
                descripcion: productDescription.value.trim(),
                precio: productPrice.value.trim(),
                imagenes: imageUrls,
                colecciones: coleccionesTexto
            };
            const { data: insertedRows, error } = await insertProductWithFallback(payload);
            if (error) throw error;
            const insertedId = insertedRows && insertedRows[0] ? insertedRows[0].id : null;
            if (insertedId && colecciones) {
                const storedCollections = readProductCollections();
                storedCollections[insertedId] = normalizeCollections(colecciones);
                writeProductCollections(storedCollections);
            }
            productForm.reset();
            writeProductCollectionsDraft([]);
            archivosPendientes.delete(imageInput);
            renderPreview();
            saved = true;
            setStatus(dashboardStatus, 'Trabajo guardado.');
            loadProducts();
        } catch (error) {
            setStatus(dashboardStatus, formatSupabaseError(error, 'save'), true);
        } finally {
            restoreButton(saved ? 'Guardado' : '');
        }
    });

    imageInput.addEventListener('change', renderPreview);

    mergeSelectedProductsButton?.addEventListener('click', async () => {
        const selectedIds = Array.from(productsList.querySelectorAll('[data-merge-select]:checked')).map(checkbox => String(checkbox.value));
        if (selectedIds.length < 2) {
            setStatus(dashboardStatus, 'Seleccioná al menos dos trabajos para fusionarlos.', true);
            return;
        }

        const selectedProducts = allProducts.filter(product => selectedIds.includes(String(product.id)));
        const target = selectedProducts[0];
        const sourceIds = selectedProducts.slice(1).map(product => String(product.id));
        const nombreDestino = target.nombre || target.codigo || 'Trabajo fusionado';

        if (!window.confirm(`Vas a fusionar ${selectedProducts.length} trabajos en "${nombreDestino}". Los trabajos secundarios se borrarán y sus imágenes/colecciones se unirán al trabajo principal. ¿Continuar?`)) {
            return;
        }

        mergeSelectedProductsButton.disabled = true;
        mergeSelectedProductsButton.textContent = 'Fusionando...';
        setStatus(dashboardStatus, 'Fusionando trabajos...');

        try {
            const mergedPayload = mergeProductsIntoTarget(selectedProducts);
            if (!mergedPayload) {
                throw new Error('No se pudo preparar la fusión de trabajos.');
            }

            const { error: updateError } = await updateProductWithFallback(target.id, mergedPayload);
            if (updateError) throw updateError;

            const deleteErrors = [];
            for (const sourceId of sourceIds) {
                const { error } = await client.from('productos').delete().eq('id', sourceId);
                if (error) deleteErrors.push(error);
            }
            if (deleteErrors.length) {
                throw deleteErrors[0];
            }

            const storedCollections = readProductCollections();
            sourceIds.forEach(sourceId => delete storedCollections[sourceId]);
            storedCollections[target.id] = normalizeCollections(mergedPayload.colecciones);
            writeProductCollections(storedCollections);

            const featuredProducts = readFeaturedProducts();
            for (const [category, productId] of Object.entries(featuredProducts)) {
                if (sourceIds.includes(String(productId))) {
                    delete featuredProducts[category];
                }
            }
            writeFeaturedProducts(featuredProducts);

            allProducts = allProducts
                .filter(product => !sourceIds.includes(String(product.id)))
                .map(product => product.id === target.id ? { ...product, ...mergedPayload } : product);

            syncCollectionsFromProducts();
            renderCollectionOptions();
            renderCollectionsManager();
            setStatus(dashboardStatus, 'Trabajos fusionados correctamente.');
            await loadProducts();
        } catch (error) {
            setStatus(dashboardStatus, formatSupabaseError(error, 'save'), true);
        } finally {
            updateMergeSelectionUI();
        }
    });

    document.addEventListener('click', event => {
        const pageButton = event.target.closest('[data-product-page]');
        const isPaginationButton = pageButton && Array.from(productPagination).some(pagination => pagination.contains(pageButton));
        if (isPaginationButton) {
            currentProductPage = Number(pageButton.dataset.productPage);
            renderProducts();
            productsList?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
        }
        const toggle = event.target.closest('[data-collection-toggle]');
        if (!toggle || !productCollections) return;
        const checkboxes = productCollections.querySelectorAll('input[type="checkbox"]');
        if (!checkboxes.length) return;
        const selectAll = toggle.dataset.collectionToggle === 'all';
        checkboxes.forEach(checkbox => {
            checkbox.checked = selectAll;
        });
        const checkedCollections = Array.from(productCollections.querySelectorAll('input[type="checkbox"]:checked')).map(checkbox => checkbox.value);
        writeProductCollectionsDraft(checkedCollections);
        renderCollectionOptions(checkedCollections);
    });
    document.addEventListener('change', event => {
        if (event.target.matches('#productCollections input[type="checkbox"]')) {
            const checkedCollections = Array.from(productCollections.querySelectorAll('input[type="checkbox"]:checked')).map(checkbox => checkbox.value);
            writeProductCollectionsDraft(checkedCollections);
            renderCollectionOptions(checkedCollections);
        }
    });
    [productSearch, productCategoryFilter, productVisibilityFilter, productSort].forEach(control => control.addEventListener('input', () => {
        currentProductPage = 1;
        renderProducts();
    }));
    productViewMode.addEventListener('change', applyProductsViewMode);
    productType.addEventListener('change', toggleNewCategory);
    ['click', 'keydown', 'pointermove', 'touchstart'].forEach(eventName => document.addEventListener(eventName, resetInactivityTimer, { passive: true }));

    dropzone.addEventListener('dragover', event => {
        event.preventDefault();
        dropzone.classList.add('admin-dropzone-active');
    });

    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('admin-dropzone-active'));
    dropzone.addEventListener('drop', event => {
        event.preventDefault();
        dropzone.classList.remove('admin-dropzone-active');
        agregarArchivosAlInput(imageInput, event.dataTransfer.files);
        renderPreview();
    });

    productsList.addEventListener('click', async event => {
        const action = event.target.dataset.action;
        if (!action) return;
        const row = event.target.closest('[data-id]');
        if (action === 'delete') {
            const name = row.querySelector('[data-field="nombre"]').value;
            if (!window.confirm(`¿Eliminar "${name}" del catálogo?`)) return;
            const restoreButton = setButtonState(event.target, 'Eliminando...', false);
            const { error } = await client.from('productos').delete().eq('id', row.dataset.id);
            if (error) {
                restoreButton();
                setStatus(dashboardStatus, formatSupabaseError(error, 'save'), true);
                return;
            }
            const featuredProducts = readFeaturedProducts();
            Object.entries(featuredProducts).forEach(([categoria, id]) => {
                if (id === row.dataset.id) delete featuredProducts[categoria];
            });
            writeFeaturedProducts(featuredProducts);
            allProducts = allProducts.filter(product => product.id !== row.dataset.id);
            row.remove();
            restoreButton('Eliminado');
            setStatus(dashboardStatus, 'Trabajo eliminado.');
            return;
        }
        const value = field => row.querySelector(`[data-field="${field}"]`).value.trim();
        const categorySelect = row.querySelector('[data-field="tipo"]');
        const newCategoryInput = row.querySelector('[data-field="nuevo-tipo"]');
        let category = categorySelect.value;
        if (category === '__new__') {
            category = newCategoryInput.value.trim();
            if (!category) {
                setStatus(dashboardStatus, 'Escribí el nombre de la nueva categoría.', true);
                return;
            }
            if (categories.some(existing => categoryKey(existing) === categoryKey(category))) {
                setStatus(dashboardStatus, 'Esa categoría ya existe. Seleccionala de la lista.', true);
                return;
            }
        }
        const imageInputRow = row.querySelector('[data-field="imagenes"]');
        const restoreButton = setButtonState(event.target, 'Subiendo y guardando...', false);
        let saved = false;
        setStatus(dashboardStatus, 'Guardando cambios...');
        try {
            const existingImages = JSON.parse(row.dataset.images || '[]');
            const newImages = imageInputRow.files.length ? await uploadImages(imageInputRow.files) : [];
            const images = imageInputRow.files.length && row.querySelector('[data-field="modo-imagenes"]').value === 'reemplazar'
                ? newImages
                : existingImages.concat(newImages);
            const coleccionesWrapper = row.querySelector('[data-field="colecciones"]');
            const colecciones = Array.from(coleccionesWrapper?.querySelectorAll('input[type="checkbox"]:checked') || []).map(option => option.value.trim()).filter(Boolean);
            const coleccionesTexto = normalizeCollections(colecciones).join(', ');
            const cambios = { codigo: value('codigo'), nombre: value('nombre'), tipo: category, descripcion: value('descripcion'), precio: value('precio'), activo: row.querySelector('[data-field="activo"]').checked, colecciones: coleccionesTexto };
            if (imageInputRow.files.length) cambios.imagenes = images;
            const { error } = await updateProductWithFallback(row.dataset.id, cambios);
            if (error) throw error;

            const product = allProducts.find(item => item.id === row.dataset.id);
            const previousCategory = categoryKey(product?.tipo || category);
            if (product) Object.assign(product, cambios);

            if (imageInputRow.files.length) {
                row.dataset.images = JSON.stringify(images);
                const media = row.querySelector(':scope > img, :scope > video');
                const preview = document.createElement('template');
                preview.innerHTML = renderMediaMarkup(images[0], { compact: true });
                const nextMedia = preview.content.firstElementChild;
                if (media && nextMedia) media.replaceWith(nextMedia);
                imageInputRow.value = '';
                archivosPendientes.delete(imageInputRow);
                renderExistingImages(row);
            }

            const storedCollections = readProductCollections();
            storedCollections[row.dataset.id] = normalizeCollections(colecciones);
            writeProductCollections(storedCollections);

            const featuredProducts = readFeaturedProducts();
            const nextCategory = categoryKey(category);
            if (featuredProducts[previousCategory] === row.dataset.id && nextCategory) {
                delete featuredProducts[previousCategory];
                featuredProducts[nextCategory] = row.dataset.id;
                writeFeaturedProducts(featuredProducts);
            }
            saved = true;
            setStatus(dashboardStatus, 'Cambios guardados.');
        } catch (error) {
            setStatus(dashboardStatus, formatSupabaseError(error, 'save'), true);
        } finally {
            restoreButton(saved ? 'Guardado' : '');
        }
    });

    productsList.addEventListener('change', event => {
        if (event.target.matches('[data-merge-select]')) {
            updateMergeSelectionUI();
            return;
        }
        if (event.target.matches('[data-field="imagenes"]')) {
            agregarArchivosAlInput(event.target, event.target.files);
            return;
        }
        if (event.target.matches('[data-field="destacado"]')) {
            const row = event.target.closest('[data-id]');
            const tipoSeleccionado = row.querySelector('[data-field="tipo"]').value;
            const featuredProducts = readFeaturedProducts();
            const categoryKeyValue = categoryKey(tipoSeleccionado);
            if (event.target.checked) {
                featuredProducts[categoryKeyValue] = row.dataset.id;
            } else if (featuredProducts[categoryKeyValue] === row.dataset.id) {
                delete featuredProducts[categoryKeyValue];
            }
            writeFeaturedProducts(featuredProducts);
            renderProducts();
            return;
        }
        if (!event.target.matches('[data-field="tipo"]')) return;
        const input = event.target.closest('[data-id]').querySelector('[data-field="nuevo-tipo"]');
        input.hidden = event.target.value !== '__new__';
        input.required = event.target.value === '__new__';
        if (input.hidden) input.value = '';
    });

    categoryList.addEventListener('click', async event => {
        if (event.target.dataset.categoryAction !== 'save') return;
        const row = event.target.closest('[data-category]');
        const button = event.target.closest('button');
        if (!button || !row) return;
        const restoreButton = setButtonState(button, 'Guardando...');
        const value = field => row.querySelector(`[data-category-field="${field}"]`).value.trim();
        const { error } = await client.from('categorias').upsert({
            tipo: row.dataset.category,
            titulo: value('titulo'),
            texto_tarjeta: value('texto_tarjeta'),
            texto: value('texto'),
            precio: value('precio')
        });
        restoreButton(error ? '' : 'Guardado');
        setStatus(dashboardStatus, error ? formatSupabaseError(error, 'save') : 'Textos de categoría guardados.', Boolean(error));
    });

    async function cerrarSesionAdministracion() {
        try {
            const { error } = await client.auth.signOut();
            if (error) {
                setStatus(dashboardStatus, formatSupabaseError(error, 'logout'), true);
                return false;
            }
        } catch (error) {
            setStatus(dashboardStatus, formatSupabaseError(error, 'logout'), true);
            return false;
        }
        window.clearTimeout(inactivityTimer);
        dashboardView.hidden = true;
        loginView.hidden = false;
        return true;
    }

    window.cerrarSesionAdministracion = cerrarSesionAdministracion;
    document.getElementById('logoutButton')?.addEventListener('click', cerrarSesionAdministracion);

    client.auth.getSession().then(({ data }) => { if (data.session) showDashboard(); });
})();