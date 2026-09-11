(function () {
    const configReady = window.TANDEM_SUPABASE_URL && window.TANDEM_SUPABASE_ANON_KEY;
    const loginView = document.getElementById('loginView');
    const dashboardView = document.getElementById('dashboardView');
    const loginForm = document.getElementById('loginForm');
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
    const productsCount = document.getElementById('productsCount');
    const homeConfigEditor = document.getElementById('homeConfigEditor');
    const HOME_CONFIG_STORAGE_KEY = 'tandem_home_config';
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

    if (!configReady) {
        loginStatus.textContent = 'Falta configurar la conexión con Supabase.';
        loginForm.querySelector('button').disabled = true;
        return;
    }

    const rememberSession = document.getElementById('rememberSession');
    let client = createClient(false);
    let inactivityTimer;
    let categories = [];
    let categoryDetails = {};
    let allProducts = [];
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

    function formatSupabaseError(error) {
        const message = error && typeof error === 'object' ? error.message || String(error) : String(error || '');

        if (/violates row-level security policy/i.test(message)) {
            return 'Supabase está bloqueando la escritura por políticas RLS. Revisá las políticas de la tabla productos y, si estás subiendo videos, también el bucket product-videos para permitir insertar y actualizar con sesión autenticada.';
        }

        if (/policy/i.test(message) && /storage|bucket/i.test(message)) {
            return 'Supabase está bloqueando el acceso al bucket de almacenamiento. Revisá las políticas del bucket product-images o product-videos para permitir subir archivos con la sesión autenticada.';
        }

        return message || 'No se pudo completar la operación.';
    }

    function setButtonState(button, busyText) {
        const originalText = button.textContent;
        button.disabled = true;
        button.classList.add('btn-loading');
        button.textContent = busyText;
        return (successText = '') => {
            button.disabled = false;
            button.classList.remove('btn-loading');
            if (!successText) {
                button.textContent = originalText;
                return;
            }
            button.classList.add('btn-success');
            button.textContent = successText;
            window.setTimeout(() => {
                button.classList.remove('btn-success');
                button.textContent = originalText;
            }, 2200);
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
                <textarea id="homeConfigHeroDescription" rows="3" placeholder="Descripción principal de la portada">${escapeText(config.hero_description)}</textarea>

                <label for="homeConfigCatalogTitle">Título de la sección catálogo</label>
                <input id="homeConfigCatalogTitle" value="${escapeAttribute(config.catalog_title)}" placeholder="Ej: Productos">

                <label for="homeConfigCatalogText">Texto que se muestra en el catálogo</label>
                <textarea id="homeConfigCatalogText" rows="3" placeholder="Texto breve para la sección de catálogo">${escapeText(config.catalog_text)}</textarea>

                <label for="homeConfigAboutTitle">Título de “Detrás del Taller”</label>
                <input id="homeConfigAboutTitle" value="${escapeAttribute(config.about_title)}" placeholder="Ej: Detrás del Taller">

                <label for="homeConfigAboutContent">Contenido de “Detrás del Taller”</label>
                <textarea id="homeConfigAboutContent" rows="6" placeholder="Podés usar HTML básico para dar formato.">${escapeText(config.about_content)}</textarea>

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
            setStatus(dashboardStatus, 'No se pudo sincronizar la configuración de la página principal desde Supabase.', true);
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
        loadProducts();
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
            setStatus(dashboardStatus, error.message, true);
            return;
        }
        allProducts = data;
        updateCategoryOptions(data);
        productCategoryFilter.innerHTML = '<option value="">Todas las categorías</option>' + categories.map(category => `<option value="${escapeAttribute(category)}">${escapeText(category)}</option>`).join('');
        renderProducts();
        loadCategoryDetails();
    }

    function renderProducts() {
        const search = productSearch.value.trim().toLowerCase();
        const visibility = productVisibilityFilter.value;
        const sort = productSort.value;
        const selectedCategory = categoryKey(productCategoryFilter.value);
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
        productsCount.textContent = `${filteredProducts.length} de ${allProducts.length} trabajos`;
        productsList.innerHTML = filteredProducts.map(product => `
            <article class="admin-product-row" data-id="${product.id}" data-images="${escapeAttribute(JSON.stringify(product.imagenes || []))}">
                ${renderMediaMarkup(product.imagenes?.[0], { compact: true }) || `<img src="${escapeAttribute(convertirImagenAdministrativa(product.imagenes?.[0]))}" alt="" onerror="this.onerror=null;this.src='logo.JPG'">`}
                <div><input data-field="codigo" value="${escapeAttribute(product.codigo || `PRD-${product.id.slice(0, 6).toUpperCase()}`)}" placeholder="Código único"><input data-field="nombre" value="${escapeAttribute(product.nombre)}"><select data-field="tipo">${categories.map(category => `<option value="${escapeAttribute(category)}" ${categoryKey(category) === categoryKey(product.tipo) ? 'selected' : ''}>${escapeText(category)}</option>`).join('')}<option value="__new__">Crear nueva categoría...</option></select><input data-field="nuevo-tipo" placeholder="Nueva categoría" hidden></div>
                <textarea data-field="descripcion" rows="2">${escapeText(product.descripcion)}</textarea>
                <input data-field="precio" value="${escapeAttribute(product.precio)}" placeholder="Precio">
                <label><input data-field="activo" type="checkbox" ${product.activo ? 'checked' : ''}> Visible</label>
                <div class="admin-edit-images"><strong>Fotos y videos</strong><div class="admin-existing-images"></div><label class="admin-image-picker">Elegir fotos o videos<input data-field="imagenes" type="file" accept="image/*,video/*" multiple></label><select data-field="modo-imagenes"><option value="agregar">Agregar a las actuales</option><option value="reemplazar">Reemplazar todas</option></select></div>
                <div class="admin-product-actions"><button class="btn" data-action="save" type="button">Guardar</button><button class="btn btn-danger" data-action="delete" type="button">Eliminar</button></div>
            </article>`).join('');
        productsList.querySelectorAll('[data-id]').forEach(row => renderExistingImages(row));
    }

    function renderExistingImages(row) {
        const container = row.querySelector('.admin-existing-images');
        const images = JSON.parse(row.dataset.images || '[]');
        container.innerHTML = images.map(image => renderMediaMarkup(image, { compact: true })).join('');
    }

    async function loadCategoryDetails() {
        const { data, error } = await client.from('categorias').select('*').order('tipo');
        if (error) {
            categoryList.innerHTML = '<p>Ejecutá la actualización de categorías en Supabase para editar estos textos.</p>';
            return;
        }
        categoryDetails = Object.fromEntries(data.map(category => [categoryKey(category.tipo), category]));
        categoryList.innerHTML = categories.map(category => {
            const detail = categoryDetails[categoryKey(category)] || {};
            return `<article class="admin-category-row" data-category="${escapeAttribute(category)}">
                <h3>${escapeText(category)}</h3>
                <label>Título de la categoría<input data-category-field="titulo" value="${escapeAttribute(detail.titulo)}" placeholder="Ej: Remeras"></label>
                <label>Descripción de portada<textarea data-category-field="texto_tarjeta" rows="2" placeholder="Texto breve para la página principal">${escapeText(detail.texto_tarjeta)}</textarea></label>
                <label>Texto superior de la categoría<textarea data-category-field="texto" rows="4" placeholder="Descripción general de la categoría">${escapeText(detail.texto)}</textarea></label>
                <label>Precio general<input data-category-field="precio" value="${escapeAttribute(detail.precio)}" placeholder="Opcional"></label>
                <button class="btn" data-category-action="save" type="button">Guardar textos</button>
            </article>`;
        }).join('');
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
            const esProblemaDeConexion = error.status === 0 || /fetch|network|gateway|502|503|timeout|load failed|failed to fetch/i.test(error.message);
            const esCredencialInvalida = error.status === 400 || /invalid login credentials|user not found|email not confirmed/i.test(error.message);

            const mensaje = esProblemaDeConexion
                ? 'No se pudo iniciar sesión porque la base de datos o el servicio de autenticación de Supabase no está disponible en este momento. Verificá que el proyecto esté activo y volvé a intentar.'
                : esCredencialInvalida
                    ? 'El correo o la contraseña no son correctos.'
                    : `No se pudo ingresar porque la base de datos o el servicio de autenticación no respondió correctamente. Detalle: ${error.message}`;

            setStatus(loginStatus, mensaje, true);
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
                await client.from('pagina_principal').upsert({
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
            } catch (error) {
                setStatus(dashboardStatus, 'Se guardó localmente en este navegador. Para sincronizar con Supabase, creá la tabla pagina_principal con esas columnas.', true);
            }

            saved = true;
            renderHomeConfigEditor();
            setStatus(dashboardStatus, 'Contenido de la página principal guardado.');
        } catch (error) {
            setStatus(dashboardStatus, formatSupabaseError(error), true);
        } finally {
            restoreButton(saved ? 'Guardado' : '');
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
            const { error } = await client.from('productos').insert({
                codigo: productCode.value.trim() || generarCodigo(), nombre: productName.value.trim(), tipo: category, descripcion: productDescription.value.trim(), precio: productPrice.value.trim(), imagenes: imageUrls
            });
            if (error) throw error;
            productForm.reset();
            archivosPendientes.delete(imageInput);
            renderPreview();
            saved = true;
            setStatus(dashboardStatus, 'Trabajo guardado.');
            loadProducts();
        } catch (error) {
            setStatus(dashboardStatus, formatSupabaseError(error), true);
        } finally {
            restoreButton(saved ? 'Guardado' : '');
        }
    });

    imageInput.addEventListener('change', renderPreview);
    [productSearch, productCategoryFilter, productVisibilityFilter, productSort].forEach(control => control.addEventListener('input', renderProducts));
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
            const restoreButton = setButtonState(event.target, 'Eliminando...');
            const { error } = await client.from('productos').delete().eq('id', row.dataset.id);
            if (error) {
                restoreButton();
                setStatus(dashboardStatus, formatSupabaseError(error), true);
                return;
            }
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
        const existingImages = JSON.parse(row.dataset.images || '[]');
        const newImages = imageInputRow.files.length ? await uploadImages(imageInputRow.files) : [];
        const images = imageInputRow.files.length && row.querySelector('[data-field="modo-imagenes"]').value === 'reemplazar'
            ? newImages
            : existingImages.concat(newImages);
        const restoreButton = setButtonState(event.target, 'Guardando...');
        const cambios = { codigo: value('codigo'), nombre: value('nombre'), tipo: category, descripcion: value('descripcion'), precio: value('precio'), activo: row.querySelector('[data-field="activo"]').checked };
        if (imageInputRow.files.length) cambios.imagenes = images;
        const { error } = await client.from('productos').update(cambios).eq('id', row.dataset.id);
        if (!error) {
            const product = allProducts.find(item => item.id === row.dataset.id);
            if (product) Object.assign(product, cambios);
        }
        if (!error && imageInputRow.files.length) {
            row.dataset.images = JSON.stringify(images);
            row.querySelector('img').src = convertirImagenAdministrativa(images[0]);
            imageInputRow.value = '';
            archivosPendientes.delete(imageInputRow);
            renderExistingImages(row);
        }
        restoreButton(error ? '' : 'Guardado');
        setStatus(dashboardStatus, error ? formatSupabaseError(error) : 'Cambios guardados.', Boolean(error));
    });

    productsList.addEventListener('change', event => {
        if (event.target.matches('[data-field="imagenes"]')) {
            agregarArchivosAlInput(event.target, event.target.files);
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
        const restoreButton = setButtonState(event.target, 'Guardando...');
        const value = field => row.querySelector(`[data-category-field="${field}"]`).value.trim();
        const { error } = await client.from('categorias').upsert({
            tipo: row.dataset.category,
            titulo: value('titulo'),
            texto_tarjeta: value('texto_tarjeta'),
            texto: value('texto'),
            precio: value('precio')
        });
        restoreButton(error ? '' : 'Guardado');
        setStatus(dashboardStatus, error ? error.message : 'Textos de categoría guardados.', Boolean(error));
    });

    document.getElementById('logoutButton').addEventListener('click', async () => {
        await client.auth.signOut();
        dashboardView.hidden = true;
        loginView.hidden = false;
    });

    client.auth.getSession().then(({ data }) => { if (data.session) showDashboard(); });
})();