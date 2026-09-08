const CATALOGO_SHEET_XLSX = 'https://docs.google.com/spreadsheets/d/1LLRpvRjDflHcPmnW18aIW0TuIQq0grt98MQG5nOIR84/export?format=xlsx';

function normalizarTipo(tipo) {
    const valor = String(tipo || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (valor.includes('taza')) return 'taza';
    if (valor.includes('puzzle')) return 'puzzle';
    return valor;
}

function obtenerCampoCatalogo(fila, nombres) {
    const nombreNormalizado = Object.keys(fila).find(clave => {
        const claveNormalizada = String(clave).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return nombres.includes(claveNormalizada);
    });
    return nombreNormalizado ? fila[nombreNormalizado] : '';
}

function obtenerPrecioCatalogo(fila) {
    const clavePrecio = Object.keys(fila).find(clave => {
        const claveNormalizada = String(clave).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return claveNormalizada.startsWith('precio');
    });
    return clavePrecio ? fila[clavePrecio] : '';
}

function formatearPrecio(valor) {
    return String(valor || '').replace(/(?:\$\s*)?(\d[\d.]*)/g, (_, numero) => {
        const valorNumerico = Number(numero.replace(/\./g, ''));
        if (!Number.isFinite(valorNumerico)) return `$${numero}`;
        return `$${valorNumerico.toLocaleString('es-AR')}`;
    });
}

function tieneDatosProducto(fila) {
    return Boolean(String(fila.Nombre || fila.Imagen || fila.Imagenes || '').trim());
}

function detectarTipoProducto(fila) {
    const tipoDeclarado = obtenerCampoCatalogo(fila, ['tipo', 'categoria']);
    const datos = tipoDeclarado || [fila.Nombre, fila.Descripcion, fila.Imagen].join(' ');
    return normalizarTipo(datos);
}

function obtenerFilasPorTipo(filas, tipo) {
    return filas.filter(fila => {
        const categoria = detectarTipoProducto(fila);
        return tieneDatosProducto(fila) && estaActivoCatalogo(fila.Activo ?? true) && categoria === normalizarTipo(tipo);
    });
}

function obtenerCategoria(filas, tipo) {
    const tipoNormalizado = normalizarTipo(tipo);
    return filas.find(fila => normalizarTipo(obtenerCampoCatalogo(fila, ['tipo', 'categoria'])) === tipoNormalizado);
}

function extraerDatosCatalogo(libro) {
    let productos = [];
    let categorias = [];
    libro.SheetNames.forEach(nombreHoja => {
        const filas = XLSX.utils.sheet_to_json(libro.Sheets[nombreHoja], { defval: '' });
        if (nombreHoja.trim().toLowerCase() === 'categorias') {
            categorias = filas;
            return;
        }
        if (!filas.some(tieneDatosProducto)) return;
        productos = productos.concat(filas.map(fila => ({
            ...fila,
            Tipo: fila.Tipo || fila.tipo || nombreHoja
        })));
    });
    return { productos, categorias };
}

function estaActivoCatalogo(valor) {
    return valor === true || ['true', 'verdadero', 'si', 'sí', '1', 'activo'].includes(String(valor).trim().toLowerCase());
}

function abrirLightbox(foto) {
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightboxImg');
    if (!lightbox || !lightboxImg) return;
    lightboxImg.src = foto.src;
    lightboxImg.alt = foto.alt;
    lightbox.removeAttribute('hidden');
}

function prepararLightbox() {
    const lightbox = document.getElementById('lightbox');
    const cerrar = document.getElementById('lightboxClose');
    if (!lightbox || !cerrar || lightbox.dataset.preparado) return;
    const ocultar = () => { lightbox.hidden = true; };
    cerrar.addEventListener('click', ocultar);
    lightbox.addEventListener('click', evento => { if (evento.target === lightbox) ocultar(); });
    document.addEventListener('keydown', evento => { if (evento.key === 'Escape') ocultar(); });
    lightbox.dataset.preparado = 'true';
}

function listaDeImagenes(fila) {
    const tipo = detectarTipoProducto(fila);
    return String(fila.Imagenes || fila.Imagen || '').split('|').map(imagen => convertirImagenProducto(imagen, tipo)).filter(Boolean);
}

function convertirImagenProducto(enlace, tipo) {
    const valor = String(enlace || '').trim();
    if (!valor) return 'logo.JPG';
    const archivo = valor.match(/drive\.google\.com\/file\/d\/([^/]+)/);
    if (archivo) return `https://drive.google.com/thumbnail?id=${archivo[1]}&sz=w1200`;
    const consulta = valor.match(/[?&]id=([^&]+)/);
    if (valor.includes('drive.google.com') && consulta) return `https://drive.google.com/thumbnail?id=${consulta[1]}&sz=w1200`;
    if (/^https?:\/\//i.test(valor)) return valor;
    if (/^(?:\.\.\/|\.\/|\/|[a-zA-Z0-9_-]+\/|[a-zA-Z0-9_.-]+$)/.test(valor)) return valor;
    return 'logo.JPG';
}

function esVideoUrl(enlace) {
    const valor = String(enlace || '').trim().toLowerCase();
    return /\.(mp4|webm|mov|m4v|ogg)(?:[?#]|$)/i.test(valor) || /video/i.test(valor);
}

function prepararModalProducto() {
    if (document.getElementById('productoSheetModal')) return;
    const modal = document.createElement('div');
    modal.id = 'productoSheetModal';
    modal.className = 'producto-sheet-modal';
    modal.hidden = true;
    modal.innerHTML = '<div class="producto-sheet-modal-content" role="dialog" aria-modal="true" aria-labelledby="productoSheetModalTitulo"><button type="button" class="producto-sheet-modal-close" aria-label="Cerrar">&times;</button><img class="producto-sheet-modal-imagen" alt=""><div><h2 id="productoSheetModalTitulo"></h2><p class="producto-sheet-modal-descripcion"></p><p class="producto-sheet-modal-precio"></p></div></div>';
    document.body.appendChild(modal);
    const cerrar = () => { modal.hidden = true; };
    modal.querySelector('.producto-sheet-modal-close').addEventListener('click', cerrar);
    modal.addEventListener('click', evento => { if (evento.target === modal) cerrar(); });
    document.addEventListener('keydown', evento => { if (evento.key === 'Escape') cerrar(); });
}

function mostrarProductoEnModal(producto) {
    const modal = document.getElementById('productoSheetModal');
    const nombreProducto = producto.Nombre || '';
    const imagen = modal.querySelector('.producto-sheet-modal-imagen');
    imagen.src = convertirImagenProducto(producto.Imagen, detectarTipoProducto(producto));
    imagen.alt = nombreProducto;
    imagen.onerror = () => { imagen.onerror = null; imagen.src = 'logo.JPG'; };
    modal.querySelector('#productoSheetModalTitulo').textContent = nombreProducto;
    modal.querySelector('.producto-sheet-modal-descripcion').textContent = producto.Descripcion || '';
    modal.querySelector('.producto-sheet-modal-precio').textContent = producto.Precio ? `Precio especial: ${formatearPrecio(producto.Precio)}` : '';
    modal.hidden = false;
}

function prepararCarrito() {
    if (document.getElementById('carritoPanel')) return;
    let items = JSON.parse(localStorage.getItem('tandem-pedido') || '[]').map(item => ({
        ...item,
        key: item.key || item.nombre,
        codigo: item.codigo || item.key || 'SIN-CODIGO',
        nombre: item.nombre || 'Trabajo seleccionado',
        cantidad: Math.max(1, Number(item.cantidad) || 1)
    }));
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'carrito-boton';
    boton.id = 'carritoButton';
    boton.innerHTML = 'Pedido <span>0</span>';
    document.body.appendChild(boton);
    const panel = document.createElement('aside');
    panel.className = 'carrito-panel';
    panel.id = 'carritoPanel';
    panel.hidden = true;
    panel.innerHTML = '<div class="carrito-encabezado"><h2>Mi pedido</h2><button type="button" class="carrito-cerrar" aria-label="Cerrar pedido">&times;</button></div><p class="carrito-ayuda">Sumá trabajos para consultarlos juntos por WhatsApp.</p><div class="carrito-lista"></div><p class="carrito-vacio">Todavía no agregaste trabajos.</p><a class="btn btn-accent carrito-enviar" target="_blank" rel="noopener noreferrer" hidden>Consultar por WhatsApp</a>';
    document.body.appendChild(panel);
    const lista = panel.querySelector('.carrito-lista');
    const vacio = panel.querySelector('.carrito-vacio');
    const enviar = panel.querySelector('.carrito-enviar');

    function guardar() {
        localStorage.setItem('tandem-pedido', JSON.stringify(items));
    }

    function render() {
        boton.querySelector('span').textContent = items.reduce((total, item) => total + item.cantidad, 0);
        lista.innerHTML = '';
        items.forEach((item, indice) => {
            const fila = document.createElement('div');
            fila.className = 'carrito-item';
            fila.innerHTML = `<div class="carrito-identificacion"><strong>${item.codigo}</strong><span>${item.nombre}</span>${item.precio ? `<small>${item.precio}</small>` : ''}</div><div class="carrito-cantidad"><button type="button" data-carrito-decrease="${indice}" aria-label="Disminuir cantidad">-</button><span>${item.cantidad}</span><button type="button" data-carrito-increase="${indice}" aria-label="Aumentar cantidad">+</button></div><button type="button" data-carrito-remove="${indice}" aria-label="Quitar ${item.codigo}">&times;</button>`;
            lista.appendChild(fila);
        });
        vacio.hidden = items.length > 0;
        enviar.hidden = items.length === 0;
        enviar.href = `https://wa.me/5492216055307?text=${encodeURIComponent(`Hola Mabel! Quisiera consultar por estos trabajos:\n\n${items.map(item => `Código: ${item.codigo}\nNombre: ${item.nombre}\nCantidad: ${item.cantidad}${item.precio ? `\nPrecio publicado: ${item.precio}` : ''}`).join('\n\n')}`)}`;
        guardar();
    }

    boton.addEventListener('click', () => { panel.hidden = false; });
    panel.querySelector('.carrito-cerrar').addEventListener('click', () => { panel.hidden = true; });
    panel.addEventListener('click', event => {
        const actionButton = event.target.closest('[data-carrito-remove], [data-carrito-increase], [data-carrito-decrease]');
        if (!actionButton) return;
        const indice = Number(actionButton.dataset.carritoRemove ?? actionButton.dataset.carritoIncrease ?? actionButton.dataset.carritoDecrease);
        const removeButton = actionButton.matches('[data-carrito-remove]');
        const increaseButton = actionButton.matches('[data-carrito-increase]');
        const decreaseButton = actionButton.matches('[data-carrito-decrease]');
        if (removeButton) items.splice(indice, 1);
        if (increaseButton) items[indice].cantidad += 1;
        if (decreaseButton) {
            items[indice].cantidad -= 1;
            if (items[indice].cantidad <= 0) items.splice(indice, 1);
        }
        render();
    });
    document.addEventListener('click', event => {
        const addButton = event.target.closest('[data-agregar-pedido]');
        if (!addButton) return;
        const item = { key: addButton.dataset.pedidoKey, codigo: addButton.dataset.codigo, nombre: addButton.dataset.nombre || 'Trabajo seleccionado', precio: addButton.dataset.precio, cantidad: 1 };
        const existente = items.find(existing => existing.key === item.key || existing.codigo === item.codigo);
        if (existente) existente.cantidad += 1;
        else items.push(item);
        render();
        panel.hidden = false;
    });
    render();
}

function crearTarjetasDeProductos(productos, contenedor) {
    if (!contenedor) return;
    contenedor.innerHTML = '';
    prepararLightbox();
    prepararCarrito();
    productos.forEach(producto => {
        const tarjeta = document.createElement('article');
        tarjeta.className = 'producto-card producto-sheet-card';
        const imagenes = listaDeImagenes(producto);
        const galeria = document.createElement('div');
        galeria.className = 'producto-sheet-gallery';

        function crearMedia(enlace, principal = false) {
            const video = esVideoUrl(enlace);
            const media = document.createElement(video ? 'video' : 'img');
            media.className = video ? (principal ? 'producto-sheet-main-video' : 'producto-sheet-thumbnail-video') : (principal ? 'producto-sheet-main-image' : 'producto-sheet-thumbnail-image');
            media.src = enlace;
            if (video) {
                media.controls = principal;
                media.muted = !principal;
                media.playsInline = true;
                media.preload = 'metadata';
                media.setAttribute('playsinline', 'true');
            } else {
                media.alt = producto.Nombre || 'Trabajo';
                media.loading = principal ? 'eager' : 'lazy';
                media.onerror = () => { media.onerror = null; media.src = 'logo.JPG'; };
            }
            return media;
        }

        let mediaPrincipal = crearMedia(imagenes[0], true);
        if (mediaPrincipal.tagName === 'IMG') {
            mediaPrincipal.addEventListener('click', () => abrirLightbox(mediaPrincipal));
        }
        galeria.appendChild(mediaPrincipal);

        if (imagenes.length > 1) {
            const miniaturas = document.createElement('div');
            miniaturas.className = 'producto-sheet-thumbnails';
            imagenes.forEach((enlace, indice) => {
                const miniatura = document.createElement('button');
                miniatura.type = 'button';
                miniatura.className = 'producto-sheet-thumbnail';
                miniatura.classList.toggle('producto-sheet-thumbnail-active', indice === 0);
                miniatura.setAttribute('aria-label', `Ver ${esVideoUrl(enlace) ? 'video' : 'imagen'} ${indice + 1}`);
                const mediaMiniatura = crearMedia(enlace);
                miniatura.appendChild(mediaMiniatura);
                miniatura.addEventListener('click', () => {
                    const nuevoMedia = crearMedia(enlace, true);
                    galeria.replaceChild(nuevoMedia, mediaPrincipal);
                    mediaPrincipal = nuevoMedia;
                    if (mediaPrincipal.tagName === 'IMG') {
                        mediaPrincipal.addEventListener('click', () => abrirLightbox(mediaPrincipal));
                    }
                    miniaturas.querySelectorAll('.producto-sheet-thumbnail').forEach(item => item.classList.remove('producto-sheet-thumbnail-active'));
                    miniatura.classList.add('producto-sheet-thumbnail-active');
                });
                miniaturas.appendChild(miniatura);
            });
            galeria.appendChild(miniaturas);
        }
        tarjeta.appendChild(galeria);
        if (producto.Nombre) {
            const nombre = document.createElement('h3');
            nombre.textContent = producto.Nombre;
            tarjeta.appendChild(nombre);
        }
        if (producto.Descripcion) {
            const descripcion = document.createElement('p');
            descripcion.textContent = producto.Descripcion;
            tarjeta.appendChild(descripcion);
        }
        if (producto.Precio) {
            const precio = document.createElement('p');
            precio.className = 'producto-precio';
            precio.textContent = `Precio: ${formatearPrecio(producto.Precio)}`;
            tarjeta.appendChild(precio);
        }
        const agregar = document.createElement('button');
        agregar.type = 'button';
        agregar.className = 'btn btn-accent producto-agregar-pedido';
        agregar.textContent = 'Sumar al pedido';
        agregar.dataset.agregarPedido = 'true';
        const codigoPedido = producto.Codigo || `PRD-${imagenes[0].split('/').pop().split('?')[0].slice(0, 6).toUpperCase()}`;
        const nombrePedido = producto.Nombre || producto.Tipo || 'Trabajo seleccionado';
        const codigo = document.createElement('p');
        codigo.className = 'producto-codigo';
        codigo.textContent = `Código: ${codigoPedido}`;
        tarjeta.appendChild(codigo);
        agregar.dataset.nombre = nombrePedido;
        agregar.dataset.precio = producto.Precio ? formatearPrecio(producto.Precio) : '';
        agregar.dataset.imagen = imagenes[0];
        agregar.dataset.pedidoKey = [producto.Tipo, imagenes[0], producto.Descripcion, producto.Precio].join('|');
        agregar.dataset.codigo = codigoPedido;
        tarjeta.appendChild(agregar);
        contenedor.appendChild(tarjeta);
    });
    contenedor.classList.toggle('detalle-productos-listos', productos.length > 0);
}

function mostrarTarjetasDeProductos(productos, nuevosPrimero = false) {
    const ultimas = nuevosPrimero ? productos.slice(0, 4) : productos.slice(-4);
    const anteriores = nuevosPrimero ? productos.slice(4) : productos.slice(0, -4);
    crearTarjetasDeProductos(ultimas, document.querySelector('[data-detalle-ultimas]'));
    crearTarjetasDeProductos(anteriores, document.querySelector('[data-detalle-todos]'));
}

async function cargarDetalleDesdeSheet(tipo) {
    const respuesta = await fetch(`${CATALOGO_SHEET_XLSX}&cachebust=${Date.now()}`);
    if (!respuesta.ok) throw new Error('No se pudo consultar Google Sheets.');
    const libro = XLSX.read(await respuesta.arrayBuffer(), { type: 'array' });
    const datosCatalogo = extraerDatosCatalogo(libro);
    const productos = obtenerFilasPorTipo(datosCatalogo.productos, tipo);
    if (!productos.length) throw new Error('No hay productos activos para esta categoría.');

    const principal = productos[0];
    const categoria = obtenerCategoria(datosCatalogo.categorias, tipo) || {};
    const titulo = categoria.Titulo || principal.Tipo || tipo;
    document.title = `TaNdeM | ${titulo}`;
    document.querySelector('[data-detalle-titulo]').textContent = titulo;
    const precioCategoria = document.querySelector('[data-detalle-precio]');
    const precioGeneral = obtenerPrecioCatalogo(categoria);
    precioCategoria.textContent = precioGeneral ? `Precio general: ${formatearPrecio(precioGeneral)}` : '';
    document.querySelector('[data-detalle-texto]').textContent = categoria.Texto || '';

    const especificaciones = document.querySelector('[data-detalle-especificaciones]');
    const detalles = String(categoria.Especificaciones || '').split('|').map(item => item.trim()).filter(Boolean);
    if (detalles.length) {
        especificaciones.innerHTML = detalles.map(item => {
            const partes = item.split('::');
            return `<li><span>${partes[0]}</span><span>${partes.slice(1).join('::')}</span></li>`;
        }).join('');
    }

    mostrarTarjetasDeProductos(productos);
    document.querySelector('.producto-detalle-grid').classList.add('detalle-listo');
}

async function cargarDetalleDesdeSupabase(tipo) {
    const productos = (await window.cargarProductosDesdeSupabase()).filter(producto => detectarTipoProducto(producto) === normalizarTipo(tipo));
    if (!productos.length) throw new Error('No hay productos activos para esta categoría.');
    const principal = productos[0];
    const categorias = window.cargarCategoriasDesdeSupabase ? await window.cargarCategoriasDesdeSupabase() : [];
    const categoria = categorias.find(item => normalizarTipo(item.Tipo) === normalizarTipo(tipo)) || {};
    const titulo = categoria.Titulo || principal.Tipo || tipo;
    document.title = `TaNdeM | ${titulo}`;
    document.querySelector('[data-detalle-titulo]').textContent = titulo;
    document.querySelector('[data-detalle-precio]').textContent = categoria.Precio ? `Precio general: ${formatearPrecio(categoria.Precio)}` : '';
    document.querySelector('[data-detalle-texto]').textContent = categoria.Texto || '';
    const detalles = String(categoria.Especificaciones || '').split('|').map(item => item.trim()).filter(Boolean);
    document.querySelector('[data-detalle-especificaciones]').innerHTML = detalles.map(item => {
        const partes = item.split('::');
        return `<li><span>${partes[0]}</span><span>${partes.slice(1).join('::')}</span></li>`;
    }).join('');
    mostrarTarjetasDeProductos(productos, true);
    document.querySelector('.producto-detalle-grid').classList.add('detalle-listo');
}
