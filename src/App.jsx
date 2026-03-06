import React, { useState, useMemo, useEffect } from 'react';
import { Search, Plus, Calendar, Package, DollarSign, Weight, ChevronRight, Cherry, Loader2 } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc } from 'firebase/firestore';

// Inicialización de Firebase con TUS credenciales reales
const firebaseConfig = {
    apiKey: "AIzaSyAwtQohg4WLlzd1ZZiDHVKy5KjARPqtMRw",
    authDomain: "cherriecute.firebaseapp.com",
    projectId: "cherriecute",
    storageBucket: "cherriecute.firebasestorage.app",
    messagingSenderId: "502993302971",
    appId: "1:502993302971:web:bc58c8daa4533989cb809e",
    measurementId: "G-M85Q4GCQCC"
};

const appFirebase = initializeApp(firebaseConfig);
const auth = getAuth(appFirebase);
const bd = getFirestore(appFirebase);

export default function App() {
    // Estados de Firebase y carga
    const [usuario, setUsuario] = useState(null);
    const [cargando, setCargando] = useState(true);

    // Estados para los grupos y el filtro
    const [grupos, setGrupos] = useState([]);
    const [filtroFecha, setFiltroFecha] = useState('');

    // Estados para el formulario de nuevo grupo
    const [nuevaFecha, setNuevaFecha] = useState('');
    const [nuevoCostoEnvio, setNuevoCostoEnvio] = useState('');
    const [nuevoPesoTotal, setNuevoPesoTotal] = useState('');

    // Estados para el formulario de nuevo producto (por grupo)
    const [productoFormulario, setProductoFormulario] = useState({});

    // Efecto 1: Autenticación automática (Anónima)
    useEffect(() => {
        const iniciarAuth = async () => {
            try {
                await signInAnonymously(auth);
            } catch (error) {
                console.error("Error al iniciar sesión:", error);
            }
        };
        iniciarAuth();

        const desuscribir = onAuthStateChanged(auth, (user) => {
            setUsuario(user);
        });
        return () => desuscribir();
    }, []);

    // Efecto 2: Cargar datos desde tu base de datos en la nube
    useEffect(() => {
        if (!usuario) return;

        // Ruta de guardado en Firebase: usuarios -> ID del usuario -> gruposEnvio
        const referenciaGrupos = collection(bd, 'usuarios', usuario.uid, 'gruposEnvio');

        const desuscribir = onSnapshot(referenciaGrupos, (instantanea) => {
            const gruposCargados = [];
            instantanea.forEach((documento) => {
                gruposCargados.push({ id: documento.id, ...documento.data() });
            });
            // Ordenamos por fecha para que los más recientes salgan primero
            gruposCargados.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

            setGrupos(gruposCargados);
            setCargando(false);
        }, (error) => {
            console.error("Error al leer los datos:", error);
            setCargando(false);
        });

        return () => desuscribir();
    }, [usuario]);

    // Función para agregar un nuevo grupo a tu nube
    const agregarGrupo = async (e) => {
        e.preventDefault();
        if (!nuevaFecha || !nuevoCostoEnvio || !nuevoPesoTotal || !usuario) return;

        const nuevoGrupo = {
            fecha: nuevaFecha,
            costoEnvioTotal: parseFloat(nuevoCostoEnvio),
            pesoTotal: parseFloat(nuevoPesoTotal),
            productos: []
        };

        // Creamos un ID único y lo guardamos en tu Firebase
        const idNuevoGrupo = crypto.randomUUID();
        const referenciaDoc = doc(bd, 'usuarios', usuario.uid, 'gruposEnvio', idNuevoGrupo);

        await setDoc(referenciaDoc, nuevoGrupo);

        setNuevaFecha('');
        setNuevoCostoEnvio('');
        setNuevoPesoTotal('');
    };

    // Función para manejar los cambios en el formulario de productos
    const cambiarProductoFormulario = (idGrupo, campo, valor) => {
        setProductoFormulario(prev => ({
            ...prev,
            [idGrupo]: {
                ...prev[idGrupo],
                [campo]: valor
            }
        }));
    };

    // Función para agregar un producto y guardar en tu nube
    const agregarProducto = async (idGrupo, e) => {
        e.preventDefault();
        const form = productoFormulario[idGrupo];
        if (!form || !form.nombre || !form.precio || !form.peso || !usuario) return;

        const grupo = grupos.find(g => g.id === idGrupo);
        if (!grupo) return;

        const precio = parseFloat(form.precio);
        const peso = parseFloat(form.peso);

        // REGLA DE TRES: (Peso del Producto * Costo Envío Total) / Peso Total del Grupo
        const costoEnvioCalculado = (peso * grupo.costoEnvioTotal) / grupo.pesoTotal;
        const costoRealFinal = precio + costoEnvioCalculado;

        const nuevoProducto = {
            id: crypto.randomUUID(),
            nombre: form.nombre,
            precio: precio,
            peso: peso,
            costoEnvioCalculado: costoEnvioCalculado,
            costoRealFinal: costoRealFinal
        };

        const nuevosProductos = [...grupo.productos, nuevoProducto];

        // Actualizamos el documento del grupo en tu Firebase con el nuevo producto
        const referenciaDoc = doc(bd, 'usuarios', usuario.uid, 'gruposEnvio', idGrupo);
        await setDoc(referenciaDoc, { productos: nuevosProductos }, { merge: true });

        // Limpiar el formulario de este grupo
        setProductoFormulario(prev => ({
            ...prev,
            [idGrupo]: { nombre: '', precio: '', peso: '' }
        }));
    };

    // Filtrar grupos por fecha
    const gruposFiltrados = useMemo(() => {
        if (!filtroFecha) return grupos;
        return grupos.filter(g => g.fecha.includes(filtroFecha));
    }, [grupos, filtroFecha]);

    return (
        <div className="min-h-screen bg-pink-50 p-4 md:p-8 font-sans text-slate-800">
            <div className="max-w-5xl mx-auto space-y-8">

                {/* Encabezado */}
                <header className="flex items-center justify-between bg-white p-6 rounded-3xl shadow-sm border border-pink-100">
                    <div className="flex items-center gap-3">
                        <div className="bg-pink-100 p-3 rounded-full text-pink-500">
                            <Cherry size={32} />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-pink-600 tracking-tight">Cherriecute</h1>
                            <p className="text-sm text-pink-400 font-medium">Calculadora de Costos Reales</p>
                        </div>
                    </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

                    {/* Panel Lateral: Nuevo Grupo & Búsqueda */}
                    <div className="space-y-6 md:col-span-1">

                        {/* Buscador */}
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-pink-100 space-y-4">
                            <h2 className="text-lg font-semibold text-slate-700 flex items-center gap-2">
                                <Search size={20} className="text-pink-400" />
                                Buscar por Fecha
                            </h2>
                            <div className="relative">
                                <input
                                    type="date"
                                    value={filtroFecha}
                                    onChange={(e) => setFiltroFecha(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-pink-50 border-none rounded-2xl focus:ring-2 focus:ring-pink-300 text-slate-600"
                                />
                                <Calendar className="absolute left-4 top-3.5 text-pink-400" size={18} />
                            </div>
                            {filtroFecha && (
                                <button
                                    onClick={() => setFiltroFecha('')}
                                    className="text-xs text-pink-500 hover:text-pink-600 font-medium ml-1"
                                >
                                    Limpiar filtro
                                </button>
                            )}
                        </div>

                        {/* Formulario Nuevo Grupo */}
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-pink-100">
                            <h2 className="text-lg font-semibold text-slate-700 mb-4 flex items-center gap-2">
                                <Package size={20} className="text-pink-400" />
                                Nuevo Grupo de Envío
                            </h2>
                            <form onSubmit={agregarGrupo} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1 ml-1">Fecha del Envío</label>
                                    <input
                                        type="date"
                                        required
                                        value={nuevaFecha}
                                        onChange={(e) => setNuevaFecha(e.target.value)}
                                        className="w-full px-4 py-3 bg-pink-50 border-none rounded-2xl focus:ring-2 focus:ring-pink-300"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1 ml-1">Costo Total del Envío ($)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        placeholder="Ej. 150.50"
                                        value={nuevoCostoEnvio}
                                        onChange={(e) => setNuevoCostoEnvio(e.target.value)}
                                        className="w-full px-4 py-3 bg-pink-50 border-none rounded-2xl focus:ring-2 focus:ring-pink-300"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1 ml-1">Peso Total (kg/lbs)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        placeholder="Ej. 10.5"
                                        value={nuevoPesoTotal}
                                        onChange={(e) => setNuevoPesoTotal(e.target.value)}
                                        className="w-full px-4 py-3 bg-pink-50 border-none rounded-2xl focus:ring-2 focus:ring-pink-300"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    className="w-full bg-pink-500 hover:bg-pink-600 text-white font-semibold py-3 rounded-2xl transition-colors flex items-center justify-center gap-2 shadow-md shadow-pink-200"
                                >
                                    <Plus size={20} />
                                    Crear Grupo
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* Área Principal: Lista de Grupos */}
                    <div className="md:col-span-2 space-y-6">
                        {cargando ? (
                            <div className="bg-white/50 border border-dashed border-pink-200 rounded-3xl p-12 text-center text-pink-400 flex flex-col items-center justify-center">
                                <Loader2 className="animate-spin mb-4" size={48} />
                                <p className="text-lg font-medium">Cargando datos de la nube...</p>
                            </div>
                        ) : gruposFiltrados.length === 0 ? (
                            <div className="bg-white/50 border border-dashed border-pink-200 rounded-3xl p-12 text-center text-pink-400">
                                <Package size={48} className="mx-auto mb-4 opacity-50" />
                                <p className="text-lg font-medium">No se encontraron grupos para esta fecha.</p>
                                <p className="text-sm">Crea un nuevo grupo en el panel lateral.</p>
                            </div>
                        ) : (
                            gruposFiltrados.map(grupo => (
                                <div key={grupo.id} className="bg-white rounded-3xl shadow-sm border border-pink-100 overflow-hidden">

                                    {/* Cabecera del Grupo */}
                                    <div className="bg-gradient-to-r from-pink-100 to-pink-50 p-5 border-b border-pink-100 flex flex-wrap gap-4 items-center justify-between">
                                        <div className="flex items-center gap-2 text-pink-700 font-bold text-lg">
                                            <Calendar size={20} />
                                            {grupo.fecha}
                                        </div>
                                        <div className="flex gap-4 text-sm font-medium text-slate-600">
                                            <div className="bg-white px-3 py-1.5 rounded-xl shadow-sm border border-pink-50">
                                                Envío: <span className="text-pink-600 font-bold">${grupo.costoEnvioTotal.toFixed(2)}</span>
                                            </div>
                                            <div className="bg-white px-3 py-1.5 rounded-xl shadow-sm border border-pink-50">
                                                Peso: <span className="text-pink-600 font-bold">{grupo.pesoTotal}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Formulario para agregar producto a este grupo */}
                                    <div className="p-5 border-b border-slate-50 bg-slate-50/50">
                                        <form onSubmit={(e) => agregarProducto(grupo.id, e)} className="flex flex-wrap md:flex-nowrap gap-3 items-end">
                                            <div className="flex-1 min-w-[140px]">
                                                <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-1 ml-1">Producto</label>
                                                <input
                                                    type="text"
                                                    required
                                                    placeholder="Nombre"
                                                    value={productoFormulario[grupo.id]?.nombre || ''}
                                                    onChange={(e) => cambiarProductoFormulario(grupo.id, 'nombre', e.target.value)}
                                                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-300 focus:border-pink-300 outline-none text-sm"
                                                />
                                            </div>
                                            <div className="w-28">
                                                <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-1 ml-1">Precio ($)</label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    required
                                                    placeholder="0.00"
                                                    value={productoFormulario[grupo.id]?.precio || ''}
                                                    onChange={(e) => cambiarProductoFormulario(grupo.id, 'precio', e.target.value)}
                                                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-300 focus:border-pink-300 outline-none text-sm"
                                                />
                                            </div>
                                            <div className="w-28">
                                                <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-1 ml-1">Peso</label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    required
                                                    placeholder="0.00"
                                                    value={productoFormulario[grupo.id]?.peso || ''}
                                                    onChange={(e) => cambiarProductoFormulario(grupo.id, 'peso', e.target.value)}
                                                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-300 focus:border-pink-300 outline-none text-sm"
                                                />
                                            </div>
                                            <button
                                                type="submit"
                                                className="bg-slate-800 hover:bg-slate-700 text-white p-2.5 rounded-xl transition-colors h-[42px] w-[42px] flex items-center justify-center shrink-0"
                                                title="Agregar Producto"
                                            >
                                                <Plus size={20} />
                                            </button>
                                        </form>
                                    </div>

                                    {/* Lista de Productos del Grupo */}
                                    <div className="p-5">
                                        {grupo.productos.length === 0 ? (
                                            <p className="text-center text-slate-400 text-sm py-4 italic">No hay productos en este envío aún.</p>
                                        ) : (
                                            <div className="space-y-3">
                                                {grupo.productos.map(producto => (
                                                    <div key={producto.id} className="flex flex-col md:flex-row md:items-center justify-between bg-white border border-slate-100 p-4 rounded-2xl hover:border-pink-200 hover:shadow-sm transition-all">
                                                        <div className="flex flex-col mb-3 md:mb-0">
                                                            <span className="font-bold text-slate-700">{producto.nombre}</span>
                                                            <div className="flex gap-3 text-xs text-slate-500 mt-1">
                                                                <span className="flex items-center gap-1"><DollarSign size={12}/> Precio base: ${producto.precio.toFixed(2)}</span>
                                                                <span className="flex items-center gap-1"><Weight size={12}/> Peso: {producto.peso}</span>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-3 md:gap-6 bg-slate-50 p-2 md:p-3 rounded-xl md:bg-transparent md:p-0">
                                                            <div className="text-right">
                                                                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Costo Envío (Regla 3)</p>
                                                                <p className="text-slate-600 font-semibold">+ ${producto.costoEnvioCalculado.toFixed(2)}</p>
                                                            </div>
                                                            <ChevronRight className="text-slate-300 hidden md:block" size={16} />
                                                            <div className="text-right border-l md:border-none border-slate-200 pl-3 md:pl-0">
                                                                <p className="text-[10px] uppercase tracking-wider font-bold text-pink-500">Costo Real Total</p>
                                                                <p className="text-lg font-bold text-pink-600">${producto.costoRealFinal.toFixed(2)}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                </div>
                            ))
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
}