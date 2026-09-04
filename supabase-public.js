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
})();