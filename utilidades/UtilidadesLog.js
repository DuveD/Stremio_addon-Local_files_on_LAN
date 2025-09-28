
// Función para obtener y formatear fecha y hora.
function obtenerFechaHoraLog() {
    const now = new Date();
    return now.toISOString().replace("T", " ").substring(0, 19);
}

const width = 18;

function formatLog(level, mensaje, contexto) {
    let contextoFormateado = contexto ? `[${contexto}]` : ``;
    contextoFormateado = contextoFormateado.padEnd(width, ' ');
    const mensajeLog = `[${obtenerFechaHoraLog()}][${level}]${contextoFormateado}: ${mensaje}`;
    return mensajeLog;
}

// Funciones específicas para comodidad
function formatInfoLog(mensaje, contexto) {
    return formatLog('INFO', mensaje, contexto);
}
function formatWarnLog(mensaje, contexto) {
    return formatLog('WARN', mensaje, contexto);
}
function formatErrorLog(mensaje, contexto) {
    return formatLog('ERROR', mensaje, contexto);
}

export { formatInfoLog, formatWarnLog, formatErrorLog };
