
// Función para cargar variables de entorno con manejo de errores.
function cargarVariable(nombre, valorPorDefecto) {
	if (!process.env[nombre]) {
		if (valorPorDefecto !== undefined) {
			utilidadesLog.logWarn(
				`La variable de entorno ${nombre} no está definida. Se usará el valor por defecto: ${valorPorDefecto}.`
			);
			return valorPorDefecto;
		} else {
			utilidadesLog.logError(
				`Debes definir la variable de entorno ${nombre} en archivo de variables de entorno '.env'.`
			);
			process.exit(1);
		}
	} else {
		return process.env[nombre];
	}
}

function cargarVariableBoolean(nombre, valorPorDefecto) {
    const valor = cargarVariable(nombre, (valorPorDefecto ? 'true' : 'false')); 
    return valor.toLowerCase() === 'true';
}

module.exports = {
    cargarVariable,
    cargarVariableBoolean
};