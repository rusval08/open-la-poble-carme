# Open la Pobla online 24/7

Aquest projecte ja esta preparat per funcionar en un servidor extern. Aixo es el que evita que la web caigui si el portatil s'apaga.

## Opcio recomanada: Render

1. Entra a Render i crea un compte.
2. Puja la carpeta `marcadors-tv` a un repositori GitHub.
3. A Render, crea un servei nou des del repositori.
4. Render detectara `render.yaml`.
5. Comprova que el servei tingui un disc persistent muntat a `/data`.
6. Quan Render acabi, tindras una URL publica del tipus `https://open-la-pobla-marcadors.onrender.com`.

## URLs importants

- Administrador: `/admin`
- Control de taules: `/control`
- Resultats public: `/resultats`
- Quadrant public: `/quadrant`
- OBS taula 1: `/obs/1`
- OBS taula 2: `/obs/2`
- OBS taula 3: `/obs/3`
- OBS taula 4: `/obs/4`
- OBS taula 5: `/obs/5`
- OBS taula 6: `/obs/6`
- TV table: `/obs-tv`

## Dades guardades

El servidor guarda a `campionat-data.json`. En produccio, amb `DATA_DIR=/data`, les dades queden dins el disc persistent del servidor.

Es guarden:

- noms dels jugadors
- quadrant
- taules assignades
- noms actuals de cada taula
- puntuacions actuals
- estat de rectificacio

## Local

Per provar-ho al portatil:

```bash
npm start
```

URL local:

```text
http://localhost:4173/admin
```
