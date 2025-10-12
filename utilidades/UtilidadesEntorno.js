import { config } from "dotenv";
import path from "path";
import url from 'url';
import { formatWarnLog } from "../utilidades/UtilidadesLog.js";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.resolve(__dirname, '../configuracion/.env') });

// Función para cargar variables de entorno con manejo de errores.
function cargarVariable(nombre, valorPorDefecto) {
	if (!process.env[nombre]) {
		if (valorPorDefecto !== undefined) {
			const mensajeWarnLog = formatWarnLog(
				`La variable de entorno ${nombre} no está definida. Se usará el valor por defecto: ${valorPorDefecto}.`
			);
			console.warn(mensajeWarnLog);

			return valorPorDefecto;
		} else {
			const mensajeWarnLog = formatWarnLog(
				`Debes definir la variable de entorno ${nombre} en archivo de variables de entorno '.env'.`
			);
			console.warn(mensajeWarnLog);

			process.exit(1);
		}
	} else {
		return process.env[nombre];
	}
}

function cargarVariableBoolean(nombre, valorPorDefecto) {
	const valor = cargarVariable(nombre, valorPorDefecto ? "true" : "false");
	return valor.toLowerCase() === "true";
}

export {
	cargarVariable,
	cargarVariableBoolean
};

