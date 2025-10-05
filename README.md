

# 🎬 Stremio Addon Local Files on LAN

Servidor en Node.js para Stremio que sirve contenido alojado en local mediante streaming en LAN. Permite acceder a películas y series en Stremio mediante tu red local y servirlas en LAN.

---

## ☑️ Requisitos

- [Node.js](https://nodejs.org/)  
- [mkvmerge](https://mkvtoolnix.download/)  
- Cuenta en [OMDb API](https://www.omdbapi.com/apikey.aspx) (opcional, pero recomendado para obtener información de películas y series)

---

## 📂 Archivos principales

- `index.js` → Archivo principal del servidor.  
- `peliculas_map.json` → Map de películas disponibles en local.  
- `series_map.json` → Map de series disponibles en local.  
- `.env` → Configuración de directorios, puerto y API key (ver ejemplo abajo).  
- `package.json` y `package-lock.json` → Dependencias del proyecto.  
- Directorio `utilidades` → Contiene utilidades del proyecto.  
- Archivos `.bat` → Scripts para abrir túneles HTTPS con Cloudflare, Loophole o Ngrok.

---

## ⚙️ Configuración (`.env`)

Copia el archivo `.env.example` a `.env` y completa los parámetros:

```env
# Ruta base del contenido a compartir
SERIES_DIR={directorio local de series}
PELICULAS_DIR={directorio local de películas}

# Puerto del servidor
PORT={puerto del addon}

# Otra configuración
FORMATO_NOMBRE_SIMPLIFICADO={true|false}

# Clave API para OMDb (opcional, pero recomendado)
OMDB_API_KEY={tu_clave_aqui}
```

---

## 🚀 Uso

Puedes ejecutar el servidor de dos formas:

1. Con Node.js directamente
```
npm start
```
2. Con los scripts `.bat`
- `start.bat` → Inicio estándar en LAN
- `start-cloudflare.bat` → Abre túnel HTTPS mediante Cloudflare
- `start-loophole.bat` → Abre túnel HTTPS mediante Loophole
- `start-ngrok.bat` → Abre túnel HTTPS mediante Ngrok

> ℹ️ Nota: El servidor necesita un enlace HTTPS para que Stremio pueda leer el manifest aunque el contenido se sirva en LAN.

---

## 📝 Licencia

Este proyecto está bajo la licencia **GPL**. Compartimos para hacernos la vida fácil a todos.
