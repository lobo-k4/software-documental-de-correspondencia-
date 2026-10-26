# Escaneo local de correspondencia

## Requisitos

- Windows en el equipo que tiene conectado el escáner.
- PowerShell y WIA de Windows disponibles.
- Controlador del fabricante instalado y registrado como dispositivo WIA.
- Backend Node.js iniciado en el mismo equipo que el escáner.

La aplicación usa WIA sin filtrar por marca. Los equipos Epson, Canon, HP, Brother, Fujitsu, Xerox, Kodak y otros aparecerán únicamente si Windows y su controlador los exponen como escáner WIA. Un controlador que solo ofrezca TWAIN no aparecerá hasta instalar una opción WIA compatible del fabricante.

El backend local es el puente entre el navegador y WIA. Las rutas `/api/scanner` solo aceptan conexiones loopback; no exponen el control del dispositivo a otros equipos de la red. Si el backend se instala en un servidor central, cada estación de trabajo que escanee necesitará ejecutar un puente local compatible; el navegador no puede enviar el trabajo al escáner del usuario a través del servidor remoto.

## Uso

1. Conectar y encender el dispositivo; comprobar que Windows tenga instalado su controlador WIA.
2. Iniciar el backend y el frontend en ese mismo equipo.
3. Abrir Correspondencia Recibida o Correspondencia Entregada y pulsar **Escanear documento**.
4. Seleccionar un dispositivo detectado, configurar solo las opciones informadas por el controlador, escanear y revisar las páginas.
5. Confirmar el documento. Las páginas se ensamblan en un único PDF y se adjuntan al registrar la correspondencia.

Si no se detecta ningún dispositivo, revisar conexión, alimentación y controlador WIA. La aplicación no simula escáneres ni crea páginas ficticias. El tamaño máximo de archivo conserva el límite actual de 10 MB; para documentos mayores, reducir DPI o elegir escala de grises.

## Compatibilidad comprobada en desarrollo

La enumeración WIA se ejecutó en el equipo de desarrollo y devolvió cero dispositivos (`WIA_DEVICES=0`). Se verificó la respuesta de ausencia de escáner para Administrador y Secretaría, pero las pruebas físicas de transferencia, ADF y doble cara requieren conectar un escáner WIA real.