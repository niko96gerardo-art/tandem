(function () {
    const ready = window.TANDEM_SUPABASE_URL && window.TANDEM_SUPABASE_ANON_KEY;
    if (!ready || !window.supabase) return;

    const client = window.supabase.createClient(window.TANDEM_SUPABASE_URL, window.TANDEM_SUPABASE_ANON_KEY);

    window.cargarProductosDesdeSupabase = async function () {
        const { data, error } = await client.from('productos').select('*').eq('activo', true).order('orden').order('creado_en', { ascending: false });
        if (error) throw error;
        return data.map(producto => ({
            Codigo: producto.codigo,
            Nombre: producto.nombre,
            Descripcion: producto.descripcion,
            Precio: producto.precio,
            Tipo: producto.tipo,
            Imagenes: producto.imagenes.join('|'),
            Imagen: producto.imagenes[0] || '',
            Activo: producto.activo
        }));
    };

    window.cargarCategoriasDesdeSupabase = async function () {
        const { data, error } = await client.from('categorias').select('*').order('tipo');
        if (error) throw error;
        return data.map(categoria => ({
            Tipo: categoria.tipo,
            Titulo: categoria.titulo,
            TextoTarjeta: categoria.texto_tarjeta,
            Texto: categoria.texto,
            Precio: categoria.precio,
            Especificaciones: categoria.especificaciones
        }));
    };

    window.cargarConfiguracionPaginaPrincipalDesdeSupabase = async function () {
        const { data, error } = await client.from('pagina_principal').select('*').limit(1);
        if (error) throw error;
        const fila = data && data[0];
        if (!fila) return null;

        let mabelPhotos = [];
        try {
            const galeria = fila.foto_mabel_galeria;
            if (galeria) {
                const parsed = JSON.parse(galeria);
                if (Array.isArray(parsed)) {
                    mabelPhotos = parsed.filter(Boolean).map(String);
                }
            }
        } catch (error) {
            mabelPhotos = [];
        }

        if (!mabelPhotos.length) {
            mabelPhotos = [fila.foto_mabel_1, fila.foto_mabel_2].filter(Boolean).map(String);
        }

        return {
            page_title: fila.titulo_pagina || '',
            hero_mono: fila.hero_mono || '',
            hero_title: fila.hero_titulo || '',
            hero_description: fila.hero_descripcion || '',
            catalog_title: fila.catalogo_titulo || '',
            catalog_text: fila.catalogo_texto || '',
            about_title: fila.acerca_titulo || '',
            about_content: fila.acerca_contenido || '',
            mabel_photos: mabelPhotos.length ? mabelPhotos : ['Mabel1.jpeg', 'Mabel2.jpeg']
        };
    };
})();