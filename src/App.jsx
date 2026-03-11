import React, { useState, useMemo, useEffect } from 'react';
import { Search, Plus, Calendar, Package, Cherry, Loader2, Trash2, Info, DollarSign, Edit2, X, Check, ChevronLeft, ChevronRight, TrendingUp } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';

// ¡Tus credenciales reales de Firebase!
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

// Funciones ayudantes para formatear los Guaraníes con puntos
const formatearGuaranies = (valor) => {
    if (valor === undefined || valor === null || valor === '') return '';
    const soloNumeros = valor.toString().replace(/\D/g, '');
    return soloNumeros.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

const desformatearGuaranies = (valor) => {
    if (valor === undefined || valor === null || valor === '') return 0;
    return parseFloat(valor.toString().replace(/\./g, '')) || 0;
};

// --- COMPONENTE: Calendario Visual ---
const CalendarioWidget = ({ fechasConGrupos, fechaSeleccionada, setFechaSeleccionada }) => {
    const [fechaVista, setFechaVista] = useState(new Date());

    const mesActual = fechaVista.getMonth();
    const anioActual = fechaVista.getFullYear();

    const diasEnMes = new Date(anioActual, mesActual + 1, 0).getDate();
    const primerDiaMes = new Date(anioActual, mesActual, 1).getDay();

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
        // Autenticación mejorada
        const desuscribir = onAuthStateChanged(auth, (user) => {
            if (user) {
                setUsuario(user);
            } else {
                signInAnonymously(auth).catch((error) => {
                    console.error("Error al iniciar sesión:", error);
                    alert("Error de conexión con Firebase Auth: " + error.message);
                    setCargando(false);
                });
            }
        });
        return () => desuscribir();
    }, []);

    useEffect(() => {
        if (!usuario) return;

        try {
            const referenciaGrupos = collection(bd, 'gruposEnvio');

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
                costoEnvioTotal: desformatearGuaranies(nuevoCostoEnvio),
                pesoTotal: parseFloat(nuevoPesoTotal),
                productos: [],
                creadoPor: usuario.uid
            };

            const nuevaReferencia = doc(collection(bd, 'gruposEnvio'));
            await setDoc(nuevaReferencia, nuevoGrupo);

            setNuevaFecha('');
            setNuevoCostoEnvio('');
            setNuevoPesoTotal('');
        } catch (error) {
            console.error("Error al guardar grupo:", error);
            alert("No se pudo guardar el grupo. Revisa tus reglas de Firebase.");
        }
    };

    const borrarGrupo = async (id) => {
        if (!usuario) return;
        if (!window.confirm("¿Estás segura de eliminar este grupo entero?")) return;
        try {
            const referenciaDoc = doc(bd, 'gruposEnvio', id);
            await deleteDoc(referenciaDoc);
        } catch (error) {
            alert("Error al borrar el grupo: " + error.message);
        }
    };

    const iniciarEdicionGrupo = (grupo) => {
        setEditandoGrupo(grupo.id);
        setGrupoEditado({
            fecha: grupo.fecha,
            costoEnvioTotal: formatearGuaranies(grupo.costoEnvioTotal),
            pesoTotal: grupo.pesoTotal
        });
    };

    const guardarEdicionGrupo = async (idGrupo) => {
        if (!usuario) return;
        try {
            const grupoActual = grupos.find(g => g.id === idGrupo);
            const nuevoCostoEnvio = desformatearGuaranies(grupoEditado.costoEnvioTotal);
            const nuevoPesoTotal = parseFloat(grupoEditado.pesoTotal);

            const productosActualizados = grupoActual.productos.map(p => {
                const costoEnvioCalculado = (p.peso * nuevoCostoEnvio) / (nuevoPesoTotal || 1);
                return {
                    ...p,
                    costoEnvioCalculado: costoEnvioCalculado,
                    costoRealFinal: p.precio + costoEnvioCalculado
                };
            });

            const referenciaDoc = doc(bd, 'gruposEnvio', idGrupo);
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

    // --- Funciones Matemáticas para Costos ---
    const calcularCostoUnitario = (precioTotal, pesoTotalItem, cantidad, grupo) => {
        const costoEnvio = (pesoTotalItem * grupo.costoEnvioTotal) / (grupo.pesoTotal || 1);
        const costoFinalTotal = precioTotal + costoEnvio;
        return costoFinalTotal / (cantidad || 1);
    };

    // Manejadores de Productos
    const agregarProducto = async (idGrupo, e) => {
        e.preventDefault();
        const form = productoFormulario[idGrupo];
        if (!form || !form.nombre || !form.precio || !form.peso || !usuario) return;

        try {
            const grupo = grupos.find(g => g.id === idGrupo);
            const precio = desformatearGuaranies(form.precio);
            const peso = parseFloat(form.peso);
            const cantidad = parseInt(form.cantidad) || 1;
            const ganancia = parseFloat(form.ganancia) || 0;

            const costoEnvioCalculado = (peso * grupo.costoEnvioTotal) / grupo.pesoTotal;
            const costoRealFinal = precio + costoEnvioCalculado;
            const costoUnitario = costoRealFinal / cantidad;

            // Usamos el precio escrito manualmente si existe
            const pvIngresado = desformatearGuaranies(form.precioVenta);
            const precioVentaUnitarioFinal = pvIngresado > 0 ? pvIngresado : Math.round(costoUnitario * (1 + (ganancia / 100)));

            const nuevoProducto = {
                id: generarId(),
                nombre: form.nombre,
                precio: precio,
                peso: peso,
                cantidad: cantidad,
                porcentajeGanancia: ganancia,
                precioVentaUnitario: precioVentaUnitarioFinal, // AHORA SE GUARDA EN FIREBASE
                costoEnvioCalculado: costoEnvioCalculado,
                costoRealFinal: costoRealFinal,
                vendido: false
            };

            const nuevosProductos = [...grupo.productos, nuevoProducto];
            const referenciaDoc = doc(bd, 'gruposEnvio', idGrupo);
            await updateDoc(referenciaDoc, { productos: nuevosProductos });

            setProductoFormulario(prev => ({ ...prev, [idGrupo]: { nombre: '', precio: '', peso: '', cantidad: '', ganancia: '', precioVenta: '' } }));
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

            const referenciaDoc = doc(bd, 'gruposEnvio', idGrupo);
            await updateDoc(referenciaDoc, { productos: nuevosProductos });
        } catch (error) {
            alert("Error al borrar el producto: " + error.message);
        }
    };

    const toggleVendido = async (idGrupo, idProducto) => {
        if (!usuario) return;
        try {
            const grupo = grupos.find(g => g.id === idGrupo);
            const productosActualizados = grupo.productos.map(p =>
                p.id === idProducto ? { ...p, vendido: !p.vendido } : p
            );
            const referenciaDoc = doc(bd, 'gruposEnvio', idGrupo);
            await updateDoc(referenciaDoc, { productos: productosActualizados });
        } catch (error) {
            alert("Error al actualizar estado: " + error.message);
        }
    };

    const iniciarEdicionProducto = (producto, grupoActual) => {
        setEditandoProducto(producto.id);
        const costoUnitario = producto.costoRealFinal / (producto.cantidad || 1);

        // Leemos el precio desde Firebase, si no existe lo calculamos como respaldo
        const pv = producto.precioVentaUnitario || (costoUnitario * (1 + ((producto.porcentajeGanancia || 0) / 100)));

        setProductoEditado({
            nombre: producto.nombre,
            precio: formatearGuaranies(producto.precio),
            peso: producto.peso,
            cantidad: producto.cantidad || 1,
            ganancia: producto.porcentajeGanancia || 0,
            precioVenta: formatearGuaranies(Math.round(pv))
        });
    };

    const guardarEdicionProducto = async (idGrupo, idProducto) => {
        if (!usuario) return;
        try {
            const grupoActual = grupos.find(g => g.id === idGrupo);
            const precio = desformatearGuaranies(productoEditado.precio);
            const peso = parseFloat(productoEditado.peso);
            const cantidad = parseInt(productoEditado.cantidad) || 1;
            const ganancia = parseFloat(productoEditado.ganancia) || 0;

            const costoEnvioCalculado = (peso * grupoActual.costoEnvioTotal) / grupoActual.pesoTotal;
            const costoRealFinal = precio + costoEnvioCalculado;
            const costoUnitario = costoRealFinal / cantidad;

            const pvIngresado = desformatearGuaranies(productoEditado.precioVenta);
            const precioVentaUnitarioFinal = pvIngresado > 0 ? pvIngresado : Math.round(costoUnitario * (1 + (ganancia / 100)));

            const productosActualizados = grupoActual.productos.map(p => {
                if (p.id === idProducto) {
                    return {
                        ...p,
                        nombre: productoEditado.nombre,
                        precio: precio,
                        peso: peso,
                        cantidad: cantidad,
                        porcentajeGanancia: ganancia,
                        precioVentaUnitario: precioVentaUnitarioFinal, // GUARDAMOS LA EDICIÓN EXACTA
                        costoEnvioCalculado: costoEnvioCalculado,
                        costoRealFinal: costoRealFinal
                    };
                }
                return p;
            });

            const referenciaDoc = doc(bd, 'gruposEnvio', idGrupo);
            await updateDoc(referenciaDoc, { productos: productosActualizados });

            setEditandoProducto(null);
        } catch (error) {
            alert("Error al editar el producto: " + error.message);
        }
    };

    // Lógica inteligente recíproca
    const handleEdicionInteligente = (campo, valor, grupoActual) => {
        let nuevoEditado = { ...productoEditado };

        if (campo === 'precioVenta') {
            const pvNum = desformatearGuaranies(valor);
            nuevoEditado.precioVenta = formatearGuaranies(valor);

            const costoUnit = calcularCostoUnitario(desformatearGuaranies(nuevoEditado.precio), parseFloat(nuevoEditado.peso), parseInt(nuevoEditado.cantidad), grupoActual);
            if (costoUnit > 0) {
                nuevoEditado.ganancia = (((pvNum / costoUnit) - 1) * 100).toFixed(1);
            }
        }
        else if (campo === 'ganancia') {
            nuevoEditado.ganancia = valor;
            const costoUnit = calcularCostoUnitario(desformatearGuaranies(nuevoEditado.precio), parseFloat(nuevoEditado.peso), parseInt(nuevoEditado.cantidad), grupoActual);
            const gan = parseFloat(valor) || 0;
            nuevoEditado.precioVenta = formatearGuaranies(Math.round(costoUnit * (1 + (gan / 100))));
        }
        else {
            if (campo === 'precio') nuevoEditado.precio = formatearGuaranies(valor);
            else nuevoEditado[campo] = valor;

            const costoUnit = calcularCostoUnitario(desformatearGuaranies(nuevoEditado.precio), parseFloat(nuevoEditado.peso), parseInt(nuevoEditado.cantidad), grupoActual);
            const gan = parseFloat(nuevoEditado.ganancia) || 0;
            nuevoEditado.precioVenta = formatearGuaranies(Math.round(costoUnit * (1 + (gan / 100))));
        }

        setProductoEditado(nuevoEditado);
    };

    const cambiarProductoFormulario = (idGrupo, campo, valor) => {
        setProductoFormulario(prev => {
            const actual = prev[idGrupo] || {};
            const nuevoForm = { ...actual };

            if (campo === 'precio' || campo === 'precioVenta') {
                nuevoForm[campo] = formatearGuaranies(valor);
            } else {
                nuevoForm[campo] = valor;
            }

            const grupo = grupos.find(g => g.id === idGrupo);
            if (grupo) {
                const pCompra = desformatearGuaranies(nuevoForm.precio);
                const pPeso = parseFloat(nuevoForm.peso) || 0;
                const pCant = parseInt(nuevoForm.cantidad) || 1;
                const costoUnit = calcularCostoUnitario(pCompra, pPeso, pCant, grupo);

                if (campo === 'precioVenta') {
                    const pv = desformatearGuaranies(nuevoForm.precioVenta);
                    if (costoUnit > 0) nuevoForm.ganancia = (((pv / costoUnit) - 1) * 100).toFixed(1);
                }
                else if (campo === 'ganancia') {
                    const gan = parseFloat(nuevoForm.ganancia) || 0;
                    nuevoForm.precioVenta = formatearGuaranies(Math.round(costoUnit * (1 + (gan / 100))));
                }
                else {
                    // Si cambian precios/peso pero ya habían escrito un precio de venta manualmente sin porcentaje, calculamos ganancia primero
                    if (nuevoForm.precioVenta && (!nuevoForm.ganancia || nuevoForm.ganancia === '')) {
                        const pv = desformatearGuaranies(nuevoForm.precioVenta);
                        if (costoUnit > 0) nuevoForm.ganancia = (((pv / costoUnit) - 1) * 100).toFixed(1);
                    } else {
                        const gan = parseFloat(nuevoForm.ganancia) || 0;
                        nuevoForm.precioVenta = formatearGuaranies(Math.round(costoUnit * (1 + (gan / 100))));
                    }
                }
            }
            return { ...prev, [idGrupo]: nuevoForm };
        });
    };

    const gruposFiltrados = useMemo(() => {
        if (!filtroFecha) return grupos;
        return grupos.filter(g => g.fecha.includes(filtroFecha));
    }, [grupos, filtroFecha]);

    const fechasConGrupos = useMemo(() => {
        return [...new Set(grupos.map(g => g.fecha))];
    }, [grupos]);

    const totalConvertido = desformatearGuaranies(cotizacionDolar) * (parseFloat(cantidadDolar) || 0);

    // Cálculo de Resumen de Ventas
    const resumenVentas = useMemo(() => {
        let recuperado = 0;
        let ganancia = 0;
        gruposFiltrados.forEach(g => {
            g.productos.forEach(p => {
                if (p.vendido) {
                    recuperado += p.costoRealFinal;

                    const cantidadItem = p.cantidad || 1;
                    const costoUnitario = p.costoRealFinal / cantidadItem;
                    const precioVentaUnitario = p.precioVentaUnitario || (costoUnitario * (1 + ((p.porcentajeGanancia || 0) / 100)));

                    ganancia += (precioVentaUnitario * cantidadItem) - p.costoRealFinal;
                }
            });
        });
        return { recuperado, ganancia };
    }, [gruposFiltrados]);

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
                        <p className="text-xs md:text-sm text-pink-300 font-medium italic">Calculadora y Gestión de Ventas</p>
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 md:gap-8">

                    {/* Columna Lateral */}
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
                                        type="text"
                                        inputMode="numeric"
                                        value={cotizacionDolar}
                                        onChange={(e) => setCotizacionDolar(formatearGuaranies(e.target.value))}
                                        placeholder="Ej. 7.300"
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

                        {/* Calendario Visual */}
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
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="Costo Total Envío (₲)"
                                    required
                                    value={nuevoCostoEnvio}
                                    onChange={(e) => setNuevoCostoEnvio(formatearGuaranies(e.target.value))}
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
                            <p>Las ganancias se calculan sumando el costo base y envío, dividido por la cantidad de items.</p>
                        </div>
                    </aside>

                    {/* Columna Principal */}
                    <main className="lg:col-span-8 space-y-5">

                        {/* DASHBOARD DE RESUMEN DE VENTAS */}
                        {!cargando && gruposFiltrados.length > 0 && (
                            <div className="bg-white p-5 md:p-6 rounded-3xl shadow-sm border border-pink-100 flex flex-col md:flex-row gap-5 justify-between items-center relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-2 h-full bg-pink-400"></div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-700 flex items-center gap-2"><TrendingUp className="text-pink-500"/> Resumen de Ventas</h3>
                                    <p className="text-sm text-pink-400 font-medium mt-1">
                                        {filtroFecha ? `Resultados del ${new Date(filtroFecha).toLocaleDateString('es-PY', { timeZone: 'UTC' })}` : 'Todas las fechas (Total Histórico)'}
                                    </p>
                                </div>
                                <div className="flex flex-wrap sm:flex-nowrap gap-3 w-full md:w-auto">
                                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex-1 md:min-w-[160px]">
                                        <p className="text-[10px] md:text-xs uppercase font-bold text-slate-400 mb-1">Costos Repuestos</p>
                                        <p className="text-xl font-black text-slate-600">₲{Math.round(resumenVentas.recuperado).toLocaleString('es-PY')}</p>
                                    </div>
                                    <div className="bg-green-50 border border-green-200 p-4 rounded-2xl flex-1 md:min-w-[160px] shadow-sm">
                                        <p className="text-[10px] md:text-xs uppercase font-bold text-green-500 mb-1">Ganancia Neta</p>
                                        <p className="text-xl font-black text-green-600">₲{Math.round(resumenVentas.ganancia).toLocaleString('es-PY')}</p>
                                    </div>
                                </div>
                            </div>
                        )}

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
                                                type="text"
                                                inputMode="numeric"
                                                placeholder="Envío total (₲)"
                                                className="w-full px-3 py-2 bg-white border border-pink-200 rounded-xl text-sm focus:ring-2 focus:ring-pink-300 outline-none text-slate-600 shadow-sm"
                                                value={grupoEditado.costoEnvioTotal}
                                                onChange={(e) => setGrupoEditado({...grupoEditado, costoEnvioTotal: formatearGuaranies(e.target.value)})}
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

                                {/* Formulario de Producto Nuevo (Con autoajuste cruzado) */}
                                <div className="p-3 md:p-5 bg-pink-50/30 border-b border-pink-100">
                                    <form onSubmit={(e) => agregarProducto(grupo.id, e)} className="grid grid-cols-2 sm:grid-cols-12 gap-2 sm:gap-3">
                                        <div className="col-span-2 sm:col-span-5">
                                            <input
                                                placeholder="Nombre del producto"
                                                className="w-full px-3 py-3 md:px-4 bg-white border border-pink-100 rounded-xl text-base sm:text-sm focus:ring-2 focus:ring-pink-200 outline-none text-slate-600 shadow-sm"
                                                value={productoFormulario[grupo.id]?.nombre || ''}
                                                onChange={(e) => cambiarProductoFormulario(grupo.id, 'nombre', e.target.value)}
                                            />
                                        </div>
                                        <div className="col-span-1 sm:col-span-3">
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                placeholder="Costo Compra Total (₲)"
                                                className="w-full px-3 py-3 md:px-4 bg-white border border-pink-100 rounded-xl text-base sm:text-sm focus:ring-2 focus:ring-pink-200 outline-none text-slate-600 shadow-sm"
                                                value={productoFormulario[grupo.id]?.precio || ''}
                                                onChange={(e) => cambiarProductoFormulario(grupo.id, 'precio', e.target.value)}
                                            />
                                        </div>
                                        <div className="col-span-1 sm:col-span-2">
                                            <input
                                                type="number"
                                                placeholder="Peso Total (kg)"
                                                step="0.001"
                                                className="w-full px-3 py-3 md:px-4 bg-white border border-pink-100 rounded-xl text-base sm:text-sm focus:ring-2 focus:ring-pink-200 outline-none text-slate-600 shadow-sm"
                                                value={productoFormulario[grupo.id]?.peso || ''}
                                                onChange={(e) => cambiarProductoFormulario(grupo.id, 'peso', e.target.value)}
                                            />
                                        </div>
                                        <div className="col-span-1 sm:col-span-2">
                                            <input
                                                type="number"
                                                placeholder="Cant."
                                                min="1"
                                                step="1"
                                                className="w-full px-3 py-3 md:px-4 bg-white border border-pink-100 rounded-xl text-base sm:text-sm focus:ring-2 focus:ring-pink-200 outline-none text-slate-600 shadow-sm"
                                                value={productoFormulario[grupo.id]?.cantidad || ''}
                                                onChange={(e) => cambiarProductoFormulario(grupo.id, 'cantidad', e.target.value)}
                                            />
                                        </div>

                                        {/* Segunda Fila Formulario */}
                                        <div className="col-span-1 sm:col-span-3">
                                            <input
                                                type="number"
                                                placeholder="% Ganancia"
                                                step="0.1"
                                                className="w-full px-3 py-3 md:px-4 bg-white border border-green-100 rounded-xl text-base sm:text-sm focus:ring-2 focus:ring-green-200 outline-none text-green-700 font-bold shadow-sm"
                                                value={productoFormulario[grupo.id]?.ganancia || ''}
                                                onChange={(e) => cambiarProductoFormulario(grupo.id, 'ganancia', e.target.value)}
                                            />
                                        </div>
                                        <div className="col-span-1 sm:col-span-4">
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                placeholder="Precio Venta c/u (₲)"
                                                className="w-full px-3 py-3 md:px-4 bg-white border border-green-100 rounded-xl text-base sm:text-sm focus:ring-2 focus:ring-green-200 outline-none text-green-700 font-bold shadow-sm"
                                                value={productoFormulario[grupo.id]?.precioVenta || ''}
                                                onChange={(e) => cambiarProductoFormulario(grupo.id, 'precioVenta', e.target.value)}
                                            />
                                        </div>

                                        <div className="col-span-2 sm:col-span-5">
                                            <button type="submit" className="w-full py-3 h-full bg-pink-200 text-pink-800 rounded-xl hover:bg-pink-300 transition-colors flex justify-center items-center shadow-sm font-bold gap-2">
                                                <Plus size={20} className="sm:hidden" />
                                                <span className="sm:hidden">Agregar Producto</span>
                                                <Plus size={20} className="hidden sm:block" />
                                            </button>
                                        </div>
                                    </form>
                                </div>

                                {/* Lista de Productos */}
                                <div className="p-3 md:p-5 space-y-3 bg-slate-50/30">
                                    {grupo.productos.length === 0 ? (
                                        <p className="text-center text-pink-300 text-sm py-4 italic">No hay productos en este envío todavía.</p>
                                    ) : grupo.productos.map(p => {
                                        const cantidadItem = p.cantidad || 1;
                                        const costoUnitario = p.costoRealFinal / cantidadItem;
                                        // Ahora priorizamos el precio de venta exacto guardado en Firebase
                                        const precioVentaUnitario = p.precioVentaUnitario || (costoUnitario * (1 + ((p.porcentajeGanancia || 0) / 100)));
                                        const gananciaItem = p.precioVentaUnitario ? (((p.precioVentaUnitario / costoUnitario) - 1) * 100).toFixed(1) : (p.porcentajeGanancia || 0);

                                        return (
                                            <div key={p.id} className={`bg-white border shadow-sm p-4 rounded-2xl group transition-all ${p.vendido ? 'border-green-200 bg-green-50/10 opacity-90' : 'border-pink-100 hover:border-pink-200'}`}>
                                                {editandoProducto === p.id ? (
                                                    // MODO EDICIÓN PRODUCTO
                                                    <div className="grid grid-cols-2 sm:grid-cols-12 gap-2 sm:gap-3">
                                                        <div className="col-span-2 sm:col-span-5">
                                                            <input
                                                                className="w-full px-3 py-2 bg-pink-50 border border-pink-200 rounded-xl text-base sm:text-sm focus:ring-2 focus:ring-pink-300 outline-none text-slate-600"
                                                                value={productoEditado.nombre}
                                                                onChange={(e) => handleEdicionInteligente('nombre', e.target.value, grupo)}
                                                                placeholder="Nombre"
                                                            />
                                                        </div>
                                                        <div className="col-span-1 sm:col-span-3">
                                                            <input
                                                                type="text"
                                                                inputMode="numeric"
                                                                className="w-full px-3 py-2 bg-pink-50 border border-pink-200 rounded-xl text-base sm:text-sm focus:ring-2 focus:ring-pink-300 outline-none text-slate-600"
                                                                value={productoEditado.precio}
                                                                onChange={(e) => handleEdicionInteligente('precio', e.target.value, grupo)}
                                                                placeholder="Compra Total (₲)"
                                                            />
                                                        </div>
                                                        <div className="col-span-1 sm:col-span-2">
                                                            <input
                                                                type="number"
                                                                step="0.001"
                                                                className="w-full px-3 py-2 bg-pink-50 border border-pink-200 rounded-xl text-base sm:text-sm focus:ring-2 focus:ring-pink-300 outline-none text-slate-600"
                                                                value={productoEditado.peso}
                                                                onChange={(e) => handleEdicionInteligente('peso', e.target.value, grupo)}
                                                                placeholder="Peso Total"
                                                            />
                                                        </div>
                                                        <div className="col-span-1 sm:col-span-2">
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                step="1"
                                                                className="w-full px-3 py-2 bg-pink-50 border border-pink-200 rounded-xl text-base sm:text-sm focus:ring-2 focus:ring-pink-300 outline-none text-slate-600"
                                                                value={productoEditado.cantidad}
                                                                onChange={(e) => handleEdicionInteligente('cantidad', e.target.value, grupo)}
                                                                placeholder="Cant."
                                                            />
                                                        </div>
                                                        <div className="col-span-1 sm:col-span-3">
                                                            <input
                                                                type="number"
                                                                step="0.1"
                                                                className="w-full px-3 py-2 bg-green-50 border border-green-200 rounded-xl text-base sm:text-sm focus:ring-2 focus:ring-green-300 outline-none text-green-700 font-bold"
                                                                value={productoEditado.ganancia}
                                                                onChange={(e) => handleEdicionInteligente('ganancia', e.target.value, grupo)}
                                                                placeholder="% Ganancia"
                                                            />
                                                        </div>
                                                        <div className="col-span-1 sm:col-span-4">
                                                            <input
                                                                type="text"
                                                                inputMode="numeric"
                                                                className="w-full px-3 py-2 bg-green-50 border border-green-200 rounded-xl text-base sm:text-sm focus:ring-2 focus:ring-green-300 outline-none text-green-700 font-bold"
                                                                value={productoEditado.precioVenta}
                                                                onChange={(e) => handleEdicionInteligente('precioVenta', e.target.value, grupo)}
                                                                placeholder="Venta c/u (₲)"
                                                            />
                                                        </div>
                                                        <div className="col-span-2 sm:col-span-5 flex gap-1 justify-end items-center mt-2 sm:mt-0">
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
                                                    <div className="flex flex-col lg:flex-row justify-between items-start gap-4">

                                                        {/* Detalles del Producto */}
                                                        <div className="flex-1 min-w-0 w-full">
                                                            <div className="flex items-center gap-2">
                                                                <p className={`font-bold text-base md:text-lg truncate ${p.vendido ? 'text-green-700' : 'text-slate-600'}`} title={p.nombre}>{p.nombre}</p>
                                                                {cantidadItem > 1 && (
                                                                    <span className="bg-slate-100 text-slate-500 text-xs px-2 py-0.5 rounded-full font-bold shadow-sm">
                                  x{cantidadItem}
                                </span>
                                                                )}
                                                            </div>

                                                            <div className="flex flex-wrap gap-2 mt-2">
                              <span className="text-[11px] md:text-xs bg-slate-50 px-2 py-1 rounded-md text-slate-500 font-medium border border-slate-100">
                                ⚖️ Peso Total: {p.peso}kg
                              </span>
                                                                <span className="text-[11px] md:text-xs bg-blue-50 px-2 py-1 rounded-md text-blue-600 font-medium border border-blue-100">
                                🏷️ Compra: ₲{p.precio.toLocaleString('es-PY')}
                              </span>
                                                                <span className="text-[11px] md:text-xs bg-orange-50 px-2 py-1 rounded-md text-orange-600 font-medium border border-orange-100">
                                ✈️ Envío: ₲{Math.round(p.costoEnvioCalculado || 0).toLocaleString('es-PY')}
                              </span>
                                                                {gananciaItem > 0 && (
                                                                    <span className="text-[11px] md:text-xs bg-green-50 px-2 py-1 rounded-md text-green-600 font-medium border border-green-100">
                                  📈 Ganancia: {gananciaItem}%
                                </span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Mini-Dashboard de Resultados Reales y Venta */}
                                                        <div className="flex flex-wrap sm:flex-nowrap items-stretch gap-2 w-full lg:w-auto mt-2 lg:mt-0">

                                                            <div className="bg-slate-50 p-2 md:p-3 rounded-xl border border-slate-100 text-center flex-1 min-w-[90px] flex flex-col justify-center">
                                                                <p className="text-[9px] uppercase font-bold text-slate-400">Total Invertido</p>
                                                                <p className="text-sm font-bold text-slate-600">₲{Math.round(p.costoRealFinal).toLocaleString('es-PY')}</p>
                                                            </div>

                                                            <div className="bg-pink-50 p-2 md:p-3 rounded-xl border border-pink-100 text-center flex-1 min-w-[90px] flex flex-col justify-center">
                                                                <p className="text-[9px] uppercase font-bold text-pink-400">Costo c/u</p>
                                                                <p className="text-sm md:text-base font-bold text-pink-600">₲{Math.round(costoUnitario).toLocaleString('es-PY')}</p>
                                                            </div>

                                                            <div className="bg-green-50 p-2 md:p-3 rounded-xl border border-green-200 text-center flex-1 min-w-[100px] shadow-sm flex flex-col justify-center">
                                                                <p className="text-[9px] md:text-[10px] uppercase font-bold text-green-500">Venta c/u</p>
                                                                <p className="text-base md:text-xl font-black text-green-600">₲{Math.round(precioVentaUnitario).toLocaleString('es-PY')}</p>
                                                            </div>

                                                            {/* Botones de Acción (Stock, Edit, Delete) */}
                                                            <div className="flex flex-row sm:flex-col gap-1 shrink-0 justify-center w-full sm:w-auto mt-2 sm:mt-0">
                                                                <div className="flex gap-1 flex-1 sm:flex-none">
                                                                    <button
                                                                        onClick={() => iniciarEdicionProducto(p, grupo)}
                                                                        className="flex-1 sm:flex-none flex justify-center text-pink-400 hover:text-blue-500 bg-white hover:bg-blue-50 rounded-lg sm:rounded-xl p-2 transition-colors border border-pink-100 hover:border-blue-100"
                                                                        title="Editar producto"
                                                                    >
                                                                        <Edit2 size={16} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => borrarProducto(grupo.id, p.id)}
                                                                        className="flex-1 sm:flex-none flex justify-center text-pink-400 hover:text-red-500 bg-white hover:bg-red-50 rounded-lg sm:rounded-xl p-2 transition-colors border border-pink-100 hover:border-red-100"
                                                                        title="Eliminar producto"
                                                                    >
                                                                        <Trash2 size={16} />
                                                                    </button>
                                                                </div>
                                                                <button
                                                                    onClick={() => toggleVendido(grupo.id, p.id)}
                                                                    className={`flex-1 sm:flex-none flex items-center justify-center gap-1 p-2 rounded-xl transition-colors text-xs font-bold shadow-sm border
                                  ${p.vendido ? 'bg-green-500 text-white border-green-600 hover:bg-green-600' : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50 hover:text-green-500'}`}
                                                                >
                                                                    {p.vendido ? <><Check size={14}/> Vendido</> : '⏳ En Stock'}
                                                                </button>
                                                            </div>

                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )})}
                                </div>
                            </div>
                        ))}
                    </main>
                </div>
            </div>
        </div>
    );
}