
# Sistema de Correspondencia

## Requisitos


- Node.js 18 o superior
- PostgreSQL ejecutándose en `localhost:5432`
- Base de datos configurada en `backend/.env`

## Primera ejecución

Desde la carpeta del backend:

```bash
cd backend
npm install
npm run db:init
```

Desde la carpeta del frontend:

```bash
cd frontend
npm install
```

## Ejecutar en desarrollo

Abre dos terminales en la raíz del proyecto.

Terminal 1, backend:

```bash
cd backend
npm run dev
```

Terminal 2, frontend:

```bash
cd frontend
npm run dev
```

Abre <http://localhost:5173>. Vite redirige automáticamente las peticiones `/api` hacia `http://localhost:5000`.

Usuario inicial:

- Usuario: `admin`
- Contraseña: `Admin123*`

Cambia esta contraseña antes de usar el sistema en producción.

## Verificaciones

```bash
cd frontend
npm run build
```

El estado de la API está disponible en <http://localhost:5000/api/health>.

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
