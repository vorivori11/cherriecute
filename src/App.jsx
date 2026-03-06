import React, { useState, useMemo, useEffect } from 'react';
import { Search, Plus, Calendar, Package, Cherry, Loader2, Trash2, Info } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';

// ⚠️ ¡IMPORTANTE! REEMPLAZA ESTOS DATOS CON LOS DE TU PROYECTO DE FIREBASE ⚠️
// Los encuentras en Firebase > Engranaje ⚙️ > Configuración del proyecto > Tus apps
const firebaseConfig = {
    apiKey: "AIzaSyAwtQohg4WLlzd1ZZiDHVKy5KjARPqtMRw",
    authDomain: "TU_PROYECTO.firebaseapp.com",
    projectId: "TU_PROYECTO",
    storageBucket: "TU_PROYECTO.appspot.com",
    messagingSenderId: "TU_MESSAGING_SENDER_ID",
    appId: "TU_APP_ID"
};

const appFirebase = initializeApp(firebaseConfig);
const auth = getAuth(appFirebase);
const bd = getFirestore(appFirebase);

export default function App() {
    // Estados de la aplicación
    const [usuario, setUsuario] = useState(null);
    const [cargando, setCargando] = useState(true);
    const [grupos, setGrupos] = useState([]);
    const [filtroFecha, setFiltroFecha] = useState('');

    // Estados para nuevos registros
    const [nuevaFecha, setNuevaFecha] = useState('');
    const [nuevoCostoEnvio, setNuevoCostoEnvio] = useState('');
    const [nuevoPesoTotal, setNuevoPesoTotal] = useState('');
    const [productoFormulario, setProductoFormulario] = useState({});

    // Autenticación inicial (Anónima)
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

    // Escuchar cambios en Firestore
    useEffect(() => {
        if (!usuario) return;

        // Ruta segura configurada en las reglas de Firebase: usuarios/{usuario.uid}/gruposEnvio
        const referenciaGrupos = collection(bd, 'usuarios', usuario.uid, 'gruposEnvio');

        const desuscribir = onSnapshot(referenciaGrupos, (instantanea) => {
            const gruposCargados = [];
            instantanea.forEach((documento) => {
                gruposCargados.push({ id: documento.id, ...documento.data() });
            });
            // Ordenar por fecha descendente
            gruposCargados.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
            setGrupos(gruposCargados);
            setCargando(false);
        }, (error) => {
            console.error("Error al leer datos:", error);
            setCargando(false);
        });

        return () => desuscribir();
    }, [usuario]);

    // Manejadores de Grupos
    const agregarGrupo = async (e) => {
        e.preventDefault();
        if (!nuevaFecha || !nuevoCostoEnvio || !nuevoPesoTotal || !usuario) return;

        const nuevoGrupo = {
            fecha: nuevaFecha,
            costoEnvioTotal: parseFloat(nuevoCostoEnvio),
            pesoTotal: parseFloat(nuevoPesoTotal),
            productos: [],
            creadoPor: usuario.uid
        };

        const idNuevoGrupo = crypto.randomUUID();
        const referenciaDoc = doc(bd, 'usuarios', usuario.uid, 'gruposEnvio', idNuevoGrupo);
        await setDoc(referenciaDoc, nuevoGrupo);

        setNuevaFecha('');
        setNuevoCostoEnvio('');
        setNuevoPesoTotal('');
    };

    const borrarGrupo = async (id) => {
        if (!usuario) return;
        const referenciaDoc = doc(bd, 'usuarios', usuario.uid, 'gruposEnvio', id);
        await deleteDoc(referenciaDoc);
    };

    // Manejadores de Productos (Ej: Tus audífonos Sony o cargador Anker)
    const agregarProducto = async (idGrupo, e) => {
        e.preventDefault();
        const form = productoFormulario[idGrupo];
        if (!form || !form.nombre || !form.precio || !form.peso || !usuario) return;

        const grupo = grupos.find(g => g.id === idGrupo);
        const precio = parseFloat(form.precio);
        const peso = parseFloat(form.peso);

        // Regla de tres: (Peso del producto * Costo total envío) / Peso total envío
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
        const referenciaDoc = doc(bd, 'usuarios', usuario.uid, 'gruposEnvio', idGrupo);
        await updateDoc(referenciaDoc, { productos: nuevosProductos });

        setProductoFormulario(prev => ({ ...prev, [idGrupo]: { nombre: '', precio: '', peso: '' } }));
    };

    const borrarProducto = async (idGrupo, idProducto) => {
        if (!usuario) return;
        const grupo = grupos.find(g => g.id === idGrupo);
        const nuevosProductos = grupo.productos.filter(p => p.id !== idProducto);

        const referenciaDoc = doc(bd, 'usuarios', usuario.uid, 'gruposEnvio', idGrupo);
        await updateDoc(referenciaDoc, { productos: nuevosProductos });
    };

    const gruposFiltrados = useMemo(() => {
        if (!filtroFecha) return grupos;
        return grupos.filter(g => g.fecha.includes(filtroFecha));
    }, [grupos, filtroFecha]);

    const cambiarProductoFormulario = (idGrupo, campo, valor) => {
        setProductoFormulario(prev => ({
            ...prev,
            [idGrupo]: { ...prev[idGrupo], [campo]: valor }
        }));
    };

    return (
        <div className="min-h-screen bg-pink-50 p-4 sm:p-6 md:p-8 font-sans text-slate-800">
            <div className="max-w-6xl mx-auto space-y-6 md:space-y-8">

                {/* Encabezado */}
                <header className="flex flex-col sm:flex-row items-center gap-4 bg-white p-5 md:p-6 rounded-3xl shadow-sm border border-pink-100">
                    <div className="bg-pink-100 p-3 rounded-full text-pink-500">
                        <Cherry size={32} />
                    </div>
                    <div className="text-center sm:text-left">
                        <h1 className="text-2xl md:text-3xl font-bold text-pink-600 tracking-tight">Cherriecute</h1>
                        <p className="text-xs md:text-sm text-pink-400 font-medium italic">Calculadora de Costos Reales</p>
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">

                    {/* Columna Lateral (Buscador y Nuevo Grupo) */}
                    <aside className="lg:col-span-4 space-y-6">
                        {/* Buscador */}
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-pink-100 space-y-4">
                            <h2 className="text-lg font-semibold text-slate-700 flex items-center gap-2">
                                <Search size={20} className="text-pink-400" />
                                Buscar por fecha
                            </h2>
                            <input
                                type="date"
                                value={filtroFecha}
                                onChange={(e) => setFiltroFecha(e.target.value)}
                                className="w-full px-4 py-3 bg-pink-50 border-none rounded-2xl focus:ring-2 focus:ring-pink-300 text-sm"
                            />
                        </div>

                        {/* Formulario Nuevo Grupo */}
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-pink-100">
                            <h2 className="text-lg font-semibold text-slate-700 mb-4 flex items-center gap-2">
                                <Package size={20} className="text-pink-400" />
                                Nuevo Grupo de Envío
                            </h2>
                            <form onSubmit={agregarGrupo} className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-400 ml-2">Fecha del pedido</label>
                                    <input
                                        type="date"
                                        required
                                        value={nuevaFecha}
                                        onChange={(e) => setNuevaFecha(e.target.value)}
                                        className="w-full px-4 py-3 bg-pink-50 border-none rounded-2xl text-sm"
                                    />
                                </div>
                                <input
                                    type="number"
                                    placeholder="Costo Total Envío (₲)"
                                    required
                                    value={nuevoCostoEnvio}
                                    onChange={(e) => setNuevoCostoEnvio(e.target.value)}
                                    className="w-full px-4 py-3 bg-pink-50 border-none rounded-2xl text-sm"
                                />
                                <input
                                    type="number"
                                    placeholder="Peso Total Envío (kg)"
                                    step="0.01"
                                    required
                                    value={nuevoPesoTotal}
                                    onChange={(e) => setNuevoPesoTotal(e.target.value)}
                                    className="w-full px-4 py-3 bg-pink-50 border-none rounded-2xl text-sm"
                                />
                                <button type="submit" className="w-full bg-pink-500 hover:bg-pink-600 text-white font-bold py-4 rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 active:scale-95">
                                    <Plus size={22} /> Crear Grupo
                                </button>
                            </form>
                        </div>

                        <div className="bg-pink-100/50 p-4 rounded-2xl border border-pink-200 text-pink-700 text-xs flex gap-3">
                            <Info className="shrink-0" size={18} />
                            <p>El costo real se calcula distribuyendo el flete proporcionalmente al peso de cada producto.</p>
                        </div>
                    </aside>

                    {/* Columna Principal (Lista de Grupos) */}
                    <main className="lg:col-span-8 space-y-6">
                        {cargando ? (
                            <div className="flex flex-col items-center justify-center p-20 text-pink-300">
                                <Loader2 className="animate-spin mb-4" size={48} />
                                <p className="font-medium">Cargando tus datos...</p>
                            </div>
                        ) : gruposFiltrados.length === 0 ? (
                            <div className="bg-white p-12 rounded-3xl text-center border border-dashed border-pink-200">
                                <Package size={48} className="mx-auto text-pink-100 mb-4" />
                                <p className="text-slate-400 font-medium">No hay envíos registrados para esta fecha.</p>
                            </div>
                        ) : gruposFiltrados.map(grupo => (
                            <div key={grupo.id} className="bg-white rounded-3xl shadow-sm border border-pink-100 overflow-hidden transition-all hover:shadow-md">

                                {/* Cabecera del Grupo */}
                                <div className="bg-pink-500 p-4 md:p-5 flex flex-wrap justify-between items-center gap-3">
                                    <div className="flex items-center gap-3 text-white">
                                        <Calendar size={20} />
                                        <span className="font-bold text-lg">{new Date(grupo.fecha).toLocaleDateString('es-PY', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' })}</span>
                                    </div>
                                    <div className="flex items-center gap-3 bg-pink-600/30 px-4 py-2 rounded-full border border-pink-400/50">
                    <span className="text-white text-xs md:text-sm font-bold">
                      ₲{grupo.costoEnvioTotal.toLocaleString()} | {grupo.pesoTotal}kg
                    </span>
                                        <button
                                            onClick={() => borrarGrupo(grupo.id)}
                                            className="text-pink-100 hover:text-white transition-colors ml-2"
                                            title="Eliminar este grupo"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>

                                {/* Formulario de Producto */}
                                <div className="p-4 md:p-5 bg-slate-50 border-b border-slate-100">
                                    <form onSubmit={(e) => agregarProducto(grupo.id, e)} className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                                        <div className="sm:col-span-6">
                                            <input
                                                placeholder="Nombre del producto"
                                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-pink-300 outline-none"
                                                value={productoFormulario[grupo.id]?.nombre || ''}
                                                onChange={(e) => cambiarProductoFormulario(grupo.id, 'nombre', e.target.value)}
                                            />
                                        </div>
                                        <div className="sm:col-span-3">
                                            <input
                                                type="number"
                                                placeholder="Precio (₲)"
                                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-pink-300 outline-none"
                                                value={productoFormulario[grupo.id]?.precio || ''}
                                                onChange={(e) => cambiarProductoFormulario(grupo.id, 'precio', e.target.value)}
                                            />
                                        </div>
                                        <div className="sm:col-span-2">
                                            <input
                                                type="number"
                                                placeholder="kg"
                                                step="0.001"
                                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-pink-300 outline-none"
                                                value={productoFormulario[grupo.id]?.peso || ''}
                                                onChange={(e) => cambiarProductoFormulario(grupo.id, 'peso', e.target.value)}
                                            />
                                        </div>
                                        <div className="sm:col-span-1">
                                            <button type="submit" className="w-full h-full bg-slate-800 text-white p-3 rounded-xl hover:bg-slate-700 transition-colors flex justify-center items-center">
                                                <Plus size={20}/>
                                            </button>
                                        </div>
                                    </form>
                                </div>

                                {/* Lista de Productos */}
                                <div className="p-4 md:p-5 space-y-3">
                                    {grupo.productos.length === 0 ? (
                                        <p className="text-center text-slate-400 text-sm py-4 italic">No hay productos en este envío todavía.</p>
                                    ) : grupo.productos.map(p => (
                                        <div key={p.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white border border-slate-100 p-4 rounded-2xl gap-4 group">
                                            <div className="flex-1 min-w-0 w-full">
                                                <p className="font-bold text-slate-700 text-lg truncate" title={p.nombre}>{p.nombre}</p>
                                                <div className="flex flex-wrap gap-3 mt-1">
                                                    <span className="text-xs bg-slate-100 px-2 py-1 rounded-md text-slate-500 font-medium">Original: ₲{p.precio.toLocaleString()}</span>
                                                    <span className="text-xs bg-slate-100 px-2 py-1 rounded-md text-slate-500 font-medium">Peso: {p.peso}kg</span>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-6 border-t sm:border-t-0 pt-3 sm:pt-0">
                                                <div className="text-right">
                                                    <p className="text-[10px] uppercase font-bold text-pink-500 tracking-wider">Costo Final Real</p>
                                                    <p className="text-xl font-black text-pink-600">₲{Math.round(p.costoRealFinal).toLocaleString()}</p>
                                                </div>
                                                <button
                                                    onClick={() => borrarProducto(grupo.id, p.id)}
                                                    className="text-slate-300 hover:text-red-500 transition-colors p-2"
                                                    title="Eliminar producto"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </main>
                </div>
            </div>
        </div>
    );
}