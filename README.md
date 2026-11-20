# LabTimer

Biblioteca de temporizadores para laboratorio. Es una PWA estática (HTML, CSS y JS sin dependencias ni paso de build) que se instala en el teléfono como una app.

## Funciones

- **Biblioteca de timers:** cada uno tiene nombre, tiempo, sonido y color. Se guarda en el dispositivo.
- **Varios timers a la vez:** pausar, reanudar, +1 min, reiniciar y quitar (con *Deshacer*).
- **Número de prueba (opcional):** al iniciar un timer puedes escribir el número de prueba y ajustar el tiempo solo para esa ejecución. La app sugiere el siguiente número (12 → 13, M-009 → M-010).
- **Inicio rápido:** el botón ▶ de cada timer lo arranca con su tiempo por defecto.
- **6 tonos configurables** (Campana, Digital, Alarma, Suave, Pulso, Ascendente) generados con Web Audio, así que funcionan sin conexión. La alarma suena en bucle hasta que la detienes (máximo 5 min) y muestra el tiempo excedido (+00:12).
- Vibración (Android), pantalla siempre encendida mientras hay timers corriendo y notificaciones en segundo plano.
- Exportar e importar la biblioteca en formato JSON.
- Funciona sin conexión, tiene tema claro u oscuro automático y diseño para móvil y escritorio.

## Desplegar en Vercel

**Opción A: con la CLI**

```bash
npm i -g vercel
vercel          # primera vez: crea el proyecto (Framework: Other, sin build)
vercel --prod
```

**Opción B: desde GitHub**

Sube la carpeta a un repositorio e impórtalo en vercel.com → *Add New Project*. En *Framework Preset* elige **Other** y deja vacíos los comandos de build y de salida.

## Instalar en el teléfono

- **iPhone (Safari):** Compartir → *Agregar a inicio*. La app muestra estas instrucciones en el botón **Instalar**.
- **Android (Chrome):** botón **Instalar** en la app, o menú ⋮ → *Instalar aplicación*.

## Limitaciones de las alarmas en el navegador

Una web app no puede programar alarmas del sistema. Si la pantalla se bloquea o la app pasa a segundo plano, el sistema puede pausar el JavaScript:

- **Con la app abierta:** el sonido es fiable. Por eso viene activado *Mantener pantalla encendida*.
- **En segundo plano:** con las notificaciones activadas, avisa cuando el sistema reanuda la app. En Android suele funcionar. En iOS (16.4+ y solo con la app instalada) puede retrasarse.
- Los timers se calculan con la hora de fin. Aunque el teléfono los pause, al volver muestran el tiempo correcto y el tiempo excedido.

## Desarrollo local

Sirve la carpeta con cualquier servidor estático, por ejemplo `npx serve .`, y abre `http://localhost:3000`.

Para regenerar los iconos ejecuta `node scripts/gen-icons.mjs`.

Si cambias archivos de la app, sube la versión de `CACHE` en `sw.js` para que los usuarios instalados reciban la actualización de inmediato.
