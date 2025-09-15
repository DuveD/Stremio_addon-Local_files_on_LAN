
// Función para obtener y formatear fecha y hora.
function obtenerFechaHoraLog() {
    const now = new Date();
    return now.toISOString().replace("T", " ").substring(0, 19);
}

const width = 18;

function log(level, mensaje, contexto) {
    const contextoFormateado = contexto ? `[${contexto}]`.padEnd(width) : ``;
    const mensajeLog = `[${obtenerFechaHoraLog()}][${level}]${contextoFormateado}: ${mensaje}`;
    switch (level) {
        case 'INFO':
            console.log(mensajeLog);
            break;
        case 'WARN':
            console.warn(mensajeLog);
            break;
        case 'ERROR':
            console.error(mensajeLog);
            break;
    }
}

// Funciones específicas para comodidad
function logInfo(mensaje, contexto) {
    log('INFO', mensaje, contexto);
}
function logWarn(mensaje, contexto) {
    log('WARN', mensaje, contexto);
}
function logError(mensaje, contexto) {
    log('ERROR', mensaje, contexto);
}

export { logInfo, logWarn, logError };
