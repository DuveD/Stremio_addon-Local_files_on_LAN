// Función para obtener y formatear fecha y hora.
function obtenerFechaHoraLog() {
    const now = new Date();
    return now.toISOString().replace("T", " ").substring(0, 19);
}

const width = 25;

function formatLog(level, mensaje, contexto) {
    let contextoFormateado = contexto ? `[${contexto}]` : ``;
    const widthContexto = width - level.length - 2; // 2 para los corchetes []
    contextoFormateado = contextoFormateado.padEnd(widthContexto, ' ');
    const mensajeLog = `[${obtenerFechaHoraLog()}][${level}]${contextoFormateado}: ${mensaje}`;
    return mensajeLog;
}

// Funciones específicas para comodidad
export function formatInfoLog(mensaje, contexto) {
    return formatLog('INFO', mensaje, contexto);
}
export function formatWarnLog(mensaje, contexto) {
    return formatLog('WARN', mensaje, contexto);
}
export function formatErrorLog(mensaje, contexto) {
    return formatLog('ERROR', mensaje, contexto);
}