import React, { useState, useMemo, useEffect } from 'react';
import { Search, Plus, Calendar, Package, Cherry, Loader2, Trash2, Info, DollarSign, Edit2, X, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';

// ¡Tus credenciales reales de Firebase ya están aquí!
const firebaseConfig = {
    apiKey: "AIzaSyAwtQohg4WLlzd1ZZiDHVKy5KjARPqtMRw",
    authDomain: "cherriecute.firebaseapp.com",
    projectId: "cherriecute",
    storageBucket: "cherriecute.firebasestorage.app",
    messagingSenderId: "502993302971",
    appId: "G-M85Q4GCQCC"
};

const appFirebase = initializeApp(firebaseConfig);
const auth = getAuth(appFirebase);
const bd = getFirestore(appFirebase);

// --- NUEVO COMPONENTE: Calendario Visual ---
const CalendarioWidget = ({ fechasConGrupos, fechaSeleccionada, setFechaSeleccionada }) => {
    const [fechaVista, setFechaVista] = useState(new Date());

    const mesActual = fechaVista.getMonth();
    const anioActual = fechaVista.getFullYear();

    const diasEnMes = new Date(anioActual, mesActual + 1, 0).getDate();
    const primerDiaMes = new Date(anioActual, mesActual, 1).getDay(); // 0 = Dom, 1 = Lun...

    const diasNombres = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];

    const prevMes = () => setFechaVista(new Date(anioActual, mesActual - 1, 1));
    const nextMes = () => setFechaVista(new Date(anioActual, mesActual + 1, 1));

    const formatearFechaStr = (d) => {
        return `${anioActual}-${String(mesActual + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    };

    const nombreMes = fechaVista.toLocaleDateString('es-PY', { month: 'long', year: 'numeric' });

    const hoy = new Date();
    const hoyStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;

    return (
        <div className="w-full select-none">
            <div className="flex justify-between items-center mb-4">
                <button onClick={prevMes} type="button" className="p-1.5 hover:bg-pink-200 bg-pink-100 rounded-lg text-pink-600 transition-colors"><ChevronLeft size={18}/></button>
                <span className="font-bold text-slate-700 capitalize text-sm">{nombreMes}</span>
                <button onClick={nextMes} type="button" className="p-1.5 hover:bg-pink-200 bg-pink-100 rounded-lg text-pink-600 transition-colors"><ChevronRight size={18}/></button>
            </div>
            <div className="grid grid-cols-7 gap-1 mb-2">
                {diasNombres.map(d => <div key={d} className="text-center text-[10px] font-bold text-slate-400">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: primerDiaMes }).map((_, i) => <div key={`empty-${i}`} />)}
                {Array.from({ length: diasEnMes }).map((_, i) => {
                    const dia = i + 1;
                    const fechaStr = formatearFechaStr(dia);
                    const tieneGrupo = fechasConGrupos.includes(fechaStr);
                    const esSeleccionado = fechaSeleccionada === fechaStr;
                    const esHoy = hoyStr === fechaStr;

                    return (
                        <button
                            key={dia}
                            type="button"
                            onClick={() => setFechaSeleccionada(esSeleccionado ? '' : fechaStr)}
                            className={`
                h-9 w-full rounded-xl text-sm font-medium flex items-center justify-center relative transition-all
                ${esSeleccionado ? 'bg-pink-500 text-white shadow-md' : 'hover:bg-pink-100 text-slate-600'}
                ${esHoy && !esSeleccionado ? 'border border-pink-300 text-pink-600' : ''}
                ${tieneGrupo && !esSeleccionado ? 'bg-pink-50' : ''}
              `}
                        >
                            {dia}
                            {tieneGrupo && (
                                <span className={`absolute bottom-1 w-1.5 h-1.5 rounded-full ${esSeleccionado ? 'bg-white' : 'bg-pink-400'}`}></span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
// -------------------------------------------

export default function App() {
    const [usuario, setUsuario] = useState(null);
    const [cargando, setCargando] = useState(true);
    const [grupos, setGrupos] = useState([]);
    const [filtroFecha, setFiltroFecha] = useState('');

    // Estados para nuevos registros
    const [nuevaFecha, setNuevaFecha] = useState('');
    const [nuevoCostoEnvio, setNuevoCostoEnvio] = useState('');
    const [nuevoPesoTotal, setNuevoPesoTotal] = useState('');
    const [productoFormulario, setProductoFormulario] = useState({});

    // Estados para la convertidora de Dólares
    const [cotizacionDolar, setCotizacionDolar] = useState('');
    const [cantidadDolar, setCantidadDolar] = useState('');

    // Estados para Edición
    const [editandoGrupo, setEditandoGrupo] = useState(null);
    const [grupoEditado, setGrupoEditado] = useState({});
    const [editandoProducto, setEditandoProducto] = useState(null);
    const [productoEditado, setProductoEditado] = useState({});

    // Generador de ID seguro
    const generarId = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();

    useEffect(() => {
        const iniciarAuth = async () => {
            try {
                await signInAnonymously(auth);
            } catch (error) {
                console.error("Error al iniciar sesión:", error);
                alert("Error de conexión con Firebase Auth: " + error.message);
                setCargando(false);
            }
        };
        iniciarAuth();

        const desuscribir = onAuthStateChanged(auth, (user) => {
            setUsuario(user);
            if (!user) setCargando(false);
        });
        return () => desuscribir();
    }, []);

    useEffect(() => {
        if (!usuario) return;

        try {
            const referenciaGrupos = collection(bd, 'usuarios', usuario.uid, 'gruposEnvio');

            const desuscribir = onSnapshot(referenciaGrupos, (instantanea) => {
                const gruposCargados = [];
                instantanea.forEach((documento) => {
                    gruposCargados.push({ id: documento.id, ...documento.data() });
                });
                gruposCargados.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
                setGrupos(gruposCargados);
                setCargando(false);
            }, (error) => {
                console.error("Error al leer datos:", error);
                alert("Error al intentar leer tus datos: " + error.message);
                setCargando(false);
            });

            return () => desuscribir();
        } catch (error) {
            alert("Error crítico al conectar con la base de datos: " + error.message);
            setCargando(false);
        }
    }, [usuario]);

    // Manejadores de Grupos
    const agregarGrupo = async (e) => {
        e.preventDefault();
        if (!nuevaFecha || !nuevoCostoEnvio || !nuevoPesoTotal || !usuario) {
            alert("Por favor completa todos los campos del grupo.");
            return;
        }

        try {
            const nuevoGrupo = {
                fecha: nuevaFecha,
                costoEnvioTotal: parseFloat(nuevoCostoEnvio),
                pesoTotal: parseFloat(nuevoPesoTotal),
                productos: [],
                creadoPor: usuario.uid
            };

            const nuevaReferencia = doc(collection(bd, 'usuarios', usuario.uid, 'gruposEnvio'));
            await setDoc(nuevaReferencia, nuevoGrupo);

            setNuevaFecha('');
            setNuevoCostoEnvio('');
            setNuevoPesoTotal('');
        } catch (error) {
            console.error("Error al guardar grupo:", error);
            alert("No se pudo guardar el grupo. Firebase dice: " + error.message);
        }
    };

    const borrarGrupo = async (id) => {
        if (!usuario) return;
        if (!window.confirm("¿Estás segura de eliminar este grupo entero?")) return;
        try {
            const referenciaDoc = doc(bd, 'usuarios', usuario.uid, 'gruposEnvio', id);
            await deleteDoc(referenciaDoc);
        } catch (error) {
            alert("Error al borrar el grupo: " + error.message);
        }
    };

    const iniciarEdicionGrupo = (grupo) => {
        setEditandoGrupo(grupo.id);
        setGrupoEditado({
            fecha: grupo.fecha,
            costoEnvioTotal: grupo.costoEnvioTotal,
            pesoTotal: grupo.pesoTotal
        });
    };

    const guardarEdicionGrupo = async (idGrupo) => {
        if (!usuario) return;
        try {
            const grupoActual = grupos.find(g => g.id === idGrupo);
            const nuevoCostoEnvio = parseFloat(grupoEditado.costoEnvioTotal);
            const nuevoPesoTotal = parseFloat(grupoEditado.pesoTotal);

            // ¡Magia! Recalculamos todos los productos de este grupo con los nuevos datos
            const productosActualizados = grupoActual.productos.map(p => {
                const costoEnvioCalculado = (p.peso * nuevoCostoEnvio) / (nuevoPesoTotal || 1); // Evitamos división por cero
                return {
                    ...p,
                    costoEnvioCalculado: costoEnvioCalculado,
                    costoRealFinal: p.precio + costoEnvioCalculado
                };
            });

            const referenciaDoc = doc(bd, 'usuarios', usuario.uid, 'gruposEnvio', idGrupo);
            await updateDoc(referenciaDoc, {
                fecha: grupoEditado.fecha,
                costoEnvioTotal: nuevoCostoEnvio,
                pesoTotal: nuevoPesoTotal,
                productos: productosActualizados
            });

            setEditandoGrupo(null);
        } catch (error) {
            alert("Error al editar el grupo: " + error.message);
        }
    };

    // Manejadores de Productos
    const agregarProducto = async (idGrupo, e) => {
        e.preventDefault();
        const form = productoFormulario[idGrupo];
        if (!form || !form.nombre || !form.precio || !form.peso || !usuario) return;

        try {
            const grupo = grupos.find(g => g.id === idGrupo);
            const precio = parseFloat(form.precio);
            const peso = parseFloat(form.peso);

            const costoEnvioCalculado = (peso * grupo.costoEnvioTotal) / grupo.pesoTotal;
            const costoRealFinal = precio + costoEnvioCalculado;

            const nuevoProducto = {
                id: generarId(),
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
        } catch (error) {
            console.error("Error al guardar producto:", error);
            alert("No se pudo guardar el producto. Firebase dice: " + error.message);
        }
    };

    const borrarProducto = async (idGrupo, idProducto) => {
        if (!usuario) return;
        try {
            const grupo = grupos.find(g => g.id === idGrupo);
            const nuevosProductos = grupo.productos.filter(p => p.id !== idProducto);

            const referenciaDoc = doc(bd, 'usuarios', usuario.uid, 'gruposEnvio', idGrupo);
            await updateDoc(referenciaDoc, { productos: nuevosProductos });
        } catch (error) {
            alert("Error al borrar el producto: " + error.message);
        }
    };

    const iniciarEdicionProducto = (producto) => {
        setEditandoProducto(producto.id);
        setProductoEditado({
            nombre: producto.nombre,
            precio: producto.precio,
            peso: producto.peso
        });
    };

    const guardarEdicionProducto = async (idGrupo, idProducto) => {
        if (!usuario) return;
        try {
            const grupoActual = grupos.find(g => g.id === idGrupo);
            const precio = parseFloat(productoEditado.precio);
            const peso = parseFloat(productoEditado.peso);

            // Recalculamos este producto específico
            const costoEnvioCalculado = (peso * grupoActual.costoEnvioTotal) / grupoActual.pesoTotal;
            const costoRealFinal = precio + costoEnvioCalculado;

            const productosActualizados = grupoActual.productos.map(p => {
                if (p.id === idProducto) {
                    return {
                        ...p,
                        nombre: productoEditado.nombre,
                        precio: precio,
                        peso: peso,
                        costoEnvioCalculado: costoEnvioCalculado,
                        costoRealFinal: costoRealFinal
                    };
                }
                return p;
            });

            const referenciaDoc = doc(bd, 'usuarios', usuario.uid, 'gruposEnvio', idGrupo);
            await updateDoc(referenciaDoc, { productos: productosActualizados });

            setEditandoProducto(null);
        } catch (error) {
            alert("Error al editar el producto: " + error.message);
        }
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

    // Obtener lista de fechas que tienen grupos para marcarlas en el calendario
    const fechasConGrupos = useMemo(() => {
        return [...new Set(grupos.map(g => g.fecha))];
    }, [grupos]);

    // Cálculo de la convertidora
    const totalConvertido = (parseFloat(cotizacionDolar) || 0) * (parseFloat(cantidadDolar) || 0);

    return (
        <div className="min-h-screen bg-pink-50/50 p-3 sm:p-5 md:p-8 font-sans text-slate-700 pb-20">
            <div className="max-w-[1600px] w-full mx-auto space-y-5 md:space-y-8">

                {/* Encabezado Principal */}
                <header className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 bg-white p-4 md:p-6 rounded-3xl shadow-sm border border-pink-100">
                    <div className="bg-pink-100 p-3 rounded-full text-pink-400">
                        <Cherry size={28} className="sm:w-8 sm:h-8" />
                    </div>
                    <div className="text-center sm:text-left">
                        <h1 className="text-2xl md:text-3xl font-bold text-pink-500 tracking-tight">Cherriecute</h1>
                        <p className="text-xs md:text-sm text-pink-300 font-medium italic">Calculadora de Costos Reales</p>
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 md:gap-8">

                    {/* Columna Lateral (Convertidora, Buscador y Nuevo Grupo) */}
                    <aside className="lg:col-span-4 space-y-5">

                        {/* Convertidora de Moneda */}
                        <div className="bg-white p-5 md:p-6 rounded-3xl shadow-sm border border-pink-100 space-y-4">
                            <h2 className="text-base md:text-lg font-semibold text-slate-600 flex items-center gap-2">
                                <div className="bg-green-100 p-1.5 rounded-full">
                                    <DollarSign size={18} className="text-green-500" />
                                </div>
                                Convertidora a Guaraníes
                            </h2>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] md:text-xs font-bold text-slate-400 ml-2 uppercase">Cambio BCP/Banco</label>
                                    <input
                                        type="number"
                                        value={cotizacionDolar}
                                        onChange={(e) => setCotizacionDolar(e.target.value)}
                                        placeholder="Ej. 7300"
                                        className="w-full px-4 py-3 bg-pink-50 border-none rounded-2xl text-base outline-none text-slate-600 focus:ring-2 focus:ring-pink-200"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] md:text-xs font-bold text-slate-400 ml-2 uppercase">Cant. en USD ($)</label>
                                    <input
                                        type="number"
                                        value={cantidadDolar}
                                        onChange={(e) => setCantidadDolar(e.target.value)}
                                        placeholder="Ej. 25.50"
                                        className="w-full px-4 py-3 bg-pink-50 border-none rounded-2xl text-base outline-none text-slate-600 focus:ring-2 focus:ring-pink-200"
                                    />
                                </div>
                            </div>
                            <div className="bg-pink-50 border border-pink-100 p-3 md:p-4 rounded-2xl flex flex-col items-center justify-center">
                                <span className="text-[10px] uppercase font-bold text-pink-400 tracking-wider">Equivale a</span>
                                <span className="text-2xl md:text-3xl font-black text-pink-500">
              ₲{totalConvertido.toLocaleString('es-PY')}
            </span>
                            </div>
                        </div>

                        {/* Buscador convertido en Calendario Visual */}
                        <div className="bg-white p-5 md:p-6 rounded-3xl shadow-sm border border-pink-100 space-y-3">
                            <div className="flex justify-between items-center">
                                <h2 className="text-base md:text-lg font-semibold text-slate-600 flex items-center gap-2">
                                    <Calendar size={20} className="text-pink-300" />
                                    Calendario de Envíos
                                </h2>
                                {filtroFecha && (
                                    <button
                                        onClick={() => setFiltroFecha('')}
                                        className="text-[10px] md:text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded-lg transition-colors font-bold"
                                    >
                                        Mostrar todos
                                    </button>
                                )}
                            </div>
                            <div className="bg-white border border-pink-100 p-3 md:p-4 rounded-2xl shadow-sm">
                                <CalendarioWidget
                                    fechasConGrupos={fechasConGrupos}
                                    fechaSeleccionada={filtroFecha}
                                    setFechaSeleccionada={setFiltroFecha}
                                />
                            </div>
                        </div>

                        {/* Formulario Nuevo Grupo */}
                        <div className="bg-white p-5 md:p-6 rounded-3xl shadow-sm border border-pink-100">
                            <h2 className="text-base md:text-lg font-semibold text-slate-600 mb-4 flex items-center gap-2">
                                <Package size={20} className="text-pink-300" />
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
                                        className="w-full px-4 py-3 bg-pink-50 border-none rounded-2xl text-base outline-none text-slate-600 focus:ring-2 focus:ring-pink-200"
                                    />
                                </div>
                                <input
                                    type="number"
                                    placeholder="Costo Total Envío (₲)"
                                    required
                                    value={nuevoCostoEnvio}
                                    onChange={(e) => setNuevoCostoEnvio(e.target.value)}
                                    className="w-full px-4 py-3 bg-pink-50 border-none rounded-2xl text-base outline-none text-slate-600 focus:ring-2 focus:ring-pink-200"
                                />
                                <input
                                    type="number"
                                    placeholder="Peso Total Envío (kg)"
                                    step="0.01"
                                    required
                                    value={nuevoPesoTotal}
                                    onChange={(e) => setNuevoPesoTotal(e.target.value)}
                                    className="w-full px-4 py-3 bg-pink-50 border-none rounded-2xl text-base outline-none text-slate-600 focus:ring-2 focus:ring-pink-200"
                                />
                                <button type="submit" className="w-full bg-pink-200 hover:bg-pink-300 text-pink-800 font-bold py-4 rounded-2xl transition-all shadow-sm flex items-center justify-center gap-2 active:scale-95">
                                    <Plus size={22} /> Crear Grupo
                                </button>
                            </form>
                        </div>

                        <div className="hidden lg:flex bg-white p-4 rounded-2xl border border-pink-100 text-pink-400 text-xs gap-3 shadow-sm">
                            <Info className="shrink-0" size={18} />
                            <p>El costo real se calcula distribuyendo el flete proporcionalmente al peso de cada producto.</p>
                        </div>
                    </aside>

                    {/* Columna Principal (Lista de Grupos) */}
                    <main className="lg:col-span-8 space-y-5">
                        {cargando ? (
                            <div className="flex flex-col items-center justify-center p-10 md:p-20 text-pink-300">
                                <Loader2 className="animate-spin mb-4" size={40} />
                                <p className="font-medium">Cargando tus datos...</p>
                            </div>
                        ) : gruposFiltrados.length === 0 ? (
                            <div className="bg-white p-10 md:p-12 rounded-3xl text-center border border-dashed border-pink-200">
                                <Package size={48} className="mx-auto text-pink-100 mb-4" />
                                <p className="text-slate-400 font-medium">No hay envíos registrados para esta fecha.</p>
                            </div>
                        ) : gruposFiltrados.map(grupo => (
                            <div key={grupo.id} className="bg-white rounded-3xl shadow-sm border border-pink-100 overflow-hidden transition-all hover:shadow-md flex flex-col">

                                {/* Cabecera del Grupo */}
                                {editandoGrupo === grupo.id ? (
                                    // MODO EDICIÓN GRUPO
                                    <div className="bg-pink-100 p-4 border-b border-pink-200">
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                                            <input
                                                type="date"
                                                className="w-full px-3 py-2 bg-white border border-pink-200 rounded-xl text-sm focus:ring-2 focus:ring-pink-300 outline-none text-slate-600 shadow-sm"
                                                value={grupoEditado.fecha}
                                                onChange={(e) => setGrupoEditado({...grupoEditado, fecha: e.target.value})}
                                            />
                                            <input
                                                type="number"
                                                placeholder="Envío total (₲)"
                                                className="w-full px-3 py-2 bg-white border border-pink-200 rounded-xl text-sm focus:ring-2 focus:ring-pink-300 outline-none text-slate-600 shadow-sm"
                                                value={grupoEditado.costoEnvioTotal}
                                                onChange={(e) => setGrupoEditado({...grupoEditado, costoEnvioTotal: e.target.value})}
                                            />
                                            <input
                                                type="number"
                                                placeholder="Peso total (kg)"
                                                step="0.01"
                                                className="w-full px-3 py-2 bg-white border border-pink-200 rounded-xl text-sm focus:ring-2 focus:ring-pink-300 outline-none text-slate-600 shadow-sm"
                                                value={grupoEditado.pesoTotal}
                                                onChange={(e) => setGrupoEditado({...grupoEditado, pesoTotal: e.target.value})}
                                            />
                                        </div>
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => setEditandoGrupo(null)} className="flex items-center gap-1 bg-white text-slate-500 px-3 py-1.5 rounded-xl border border-pink-200 hover:bg-slate-50 text-sm font-semibold transition-colors">
                                                <X size={16} /> Cancelar
                                            </button>
                                            <button onClick={() => guardarEdicionGrupo(grupo.id)} className="flex items-center gap-1 bg-pink-400 text-white px-3 py-1.5 rounded-xl hover:bg-pink-500 text-sm font-semibold transition-colors shadow-sm">
                                                <Check size={16} /> Guardar
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    // MODO VISTA GRUPO
                                    <div className="bg-pink-100 p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-pink-200">
                                        <div className="flex items-center gap-2 text-pink-800">
                                            <Calendar size={18} className="text-pink-400 shrink-0" />
                                            <span className="font-bold text-base md:text-lg">{new Date(grupo.fecha).toLocaleDateString('es-PY', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' })}</span>
                                        </div>
                                        <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
                                            <div className="bg-white px-3 py-1.5 md:px-4 md:py-2 rounded-full border border-pink-200 shadow-sm flex-1 sm:flex-none text-center mr-1">
                        <span className="text-pink-700 text-xs md:text-sm font-bold block">
                          ₲{grupo.costoEnvioTotal.toLocaleString()} | {grupo.pesoTotal}kg
                        </span>
                                            </div>
                                            <button
                                                onClick={() => iniciarEdicionGrupo(grupo)}
                                                className="bg-white p-2 rounded-full text-pink-300 hover:text-blue-500 hover:bg-blue-50 border border-pink-100 shadow-sm transition-all shrink-0"
                                                title="Editar grupo"
                                            >
                                                <Edit2 size={18} />
                                            </button>
                                            <button
                                                onClick={() => borrarGrupo(grupo.id)}
                                                className="bg-white p-2 rounded-full text-pink-300 hover:text-red-400 hover:bg-red-50 border border-pink-100 shadow-sm transition-all shrink-0"
                                                title="Eliminar este grupo"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Formulario de Producto Nuevo (Optimizado para Celular) */}
                                <div className="p-3 md:p-5 bg-pink-50/30 border-b border-pink-100">
                                    <form onSubmit={(e) => agregarProducto(grupo.id, e)} className="grid grid-cols-2 sm:grid-cols-12 gap-2 sm:gap-3">
                                        <div className="col-span-2 sm:col-span-5">
                                            <input
                                                placeholder="Nombre del producto"
                                                className="w-full px-3 py-3 md:px-4 bg-white border border-pink-100 rounded-xl text-base focus:ring-2 focus:ring-pink-200 outline-none text-slate-600 shadow-sm"
                                                value={productoFormulario[grupo.id]?.nombre || ''}
                                                onChange={(e) => cambiarProductoFormulario(grupo.id, 'nombre', e.target.value)}
                                            />
                                        </div>
                                        <div className="col-span-1 sm:col-span-3">
                                            <input
                                                type="number"
                                                placeholder="Precio (₲)"
                                                className="w-full px-3 py-3 md:px-4 bg-white border border-pink-100 rounded-xl text-base focus:ring-2 focus:ring-pink-200 outline-none text-slate-600 shadow-sm"
                                                value={productoFormulario[grupo.id]?.precio || ''}
                                                onChange={(e) => cambiarProductoFormulario(grupo.id, 'precio', e.target.value)}
                                            />
                                        </div>
                                        <div className="col-span-1 sm:col-span-2">
                                            <input
                                                type="number"
                                                placeholder="Peso(kg)"
                                                step="0.001"
                                                className="w-full px-3 py-3 md:px-4 bg-white border border-pink-100 rounded-xl text-base focus:ring-2 focus:ring-pink-200 outline-none text-slate-600 shadow-sm"
                                                value={productoFormulario[grupo.id]?.peso || ''}
                                                onChange={(e) => cambiarProductoFormulario(grupo.id, 'peso', e.target.value)}
                                            />
                                        </div>
                                        <div className="col-span-2 sm:col-span-2">
                                            <button type="submit" className="w-full py-3 bg-pink-200 text-pink-800 rounded-xl hover:bg-pink-300 transition-colors flex justify-center items-center shadow-sm font-bold gap-2">
                                                <Plus size={20} className="sm:hidden" />
                                                <span className="sm:hidden">Agregar</span>
                                                <Plus size={20} className="hidden sm:block" />
                                            </button>
                                        </div>
                                    </form>
                                </div>

                                {/* Lista de Productos */}
                                <div className="p-3 md:p-5 space-y-3">
                                    {grupo.productos.length === 0 ? (
                                        <p className="text-center text-pink-300 text-sm py-4 italic">No hay productos en este envío todavía.</p>
                                    ) : grupo.productos.map(p => (
                                        <div key={p.id} className="bg-white border border-pink-100 shadow-sm p-4 rounded-2xl group hover:border-pink-200 transition-colors">
                                            {editandoProducto === p.id ? (
                                                // MODO EDICIÓN PRODUCTO
                                                <div className="grid grid-cols-2 sm:grid-cols-12 gap-2 sm:gap-3">
                                                    <div className="col-span-2 sm:col-span-5">
                                                        <input
                                                            className="w-full px-3 py-2 bg-pink-50 border border-pink-200 rounded-xl text-sm focus:ring-2 focus:ring-pink-300 outline-none text-slate-600"
                                                            value={productoEditado.nombre}
                                                            onChange={(e) => setProductoEditado({...productoEditado, nombre: e.target.value})}
                                                            placeholder="Nombre"
                                                        />
                                                    </div>
                                                    <div className="col-span-1 sm:col-span-3">
                                                        <input
                                                            type="number"
                                                            className="w-full px-3 py-2 bg-pink-50 border border-pink-200 rounded-xl text-sm focus:ring-2 focus:ring-pink-300 outline-none text-slate-600"
                                                            value={productoEditado.precio}
                                                            onChange={(e) => setProductoEditado({...productoEditado, precio: e.target.value})}
                                                            placeholder="Precio"
                                                        />
                                                    </div>
                                                    <div className="col-span-1 sm:col-span-2">
                                                        <input
                                                            type="number"
                                                            step="0.001"
                                                            className="w-full px-3 py-2 bg-pink-50 border border-pink-200 rounded-xl text-sm focus:ring-2 focus:ring-pink-300 outline-none text-slate-600"
                                                            value={productoEditado.peso}
                                                            onChange={(e) => setProductoEditado({...productoEditado, peso: e.target.value})}
                                                            placeholder="Peso"
                                                        />
                                                    </div>
                                                    <div className="col-span-2 sm:col-span-2 flex gap-1 justify-end items-center mt-2 sm:mt-0">
                                                        <button onClick={() => setEditandoProducto(null)} className="p-2 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200 transition-colors flex-1 flex justify-center">
                                                            <X size={18} />
                                                        </button>
                                                        <button onClick={() => guardarEdicionProducto(grupo.id, p.id)} className="p-2 bg-pink-400 text-white rounded-xl hover:bg-pink-500 transition-colors flex-1 flex justify-center shadow-sm">
                                                            <Check size={18} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                // MODO VISTA PRODUCTO
                                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
                                                    <div className="flex-1 min-w-0 w-full">
                                                        <p className="font-bold text-slate-600 text-base md:text-lg truncate" title={p.nombre}>{p.nombre}</p>
                                                        <div className="flex flex-wrap gap-2 mt-1.5">
                                                            <span className="text-[11px] md:text-xs bg-pink-50 px-2 py-1 rounded-md text-pink-600 font-medium border border-pink-100">Original: ₲{p.precio.toLocaleString()}</span>
                                                            <span className="text-[11px] md:text-xs bg-pink-50 px-2 py-1 rounded-md text-pink-600 font-medium border border-pink-100">Peso: {p.peso}kg</span>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center justify-between w-full sm:w-auto gap-3 border-t border-pink-50 sm:border-t-0 pt-3 sm:pt-0">
                                                        <div className="text-left sm:text-right flex-1 sm:flex-none">
                                                            <p className="text-[10px] uppercase font-bold text-pink-400 tracking-wider">Costo Final</p>
                                                            <p className="text-lg md:text-xl font-black text-pink-500">₲{Math.round(p.costoRealFinal).toLocaleString()}</p>
                                                        </div>
                                                        <div className="flex gap-1 shrink-0">
                                                            <button
                                                                onClick={() => iniciarEdicionProducto(p)}
                                                                className="text-pink-300 hover:text-blue-500 bg-white hover:bg-blue-50 rounded-full p-2 transition-colors border border-transparent hover:border-blue-100"
                                                                title="Editar producto"
                                                            >
                                                                <Edit2 size={18} />
                                                            </button>
                                                            <button
                                                                onClick={() => borrarProducto(grupo.id, p.id)}
                                                                className="text-pink-300 hover:text-red-400 bg-white hover:bg-red-50 rounded-full p-2 transition-colors border border-transparent hover:border-red-100"
                                                                title="Eliminar producto"
                                                            >
                                                                <Trash2 size={18} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
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