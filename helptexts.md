### showBase100Line 
controla la casilla «Mostrar índice base 100» al crear un análisis. Por defecto está desactivada.

Al activarla:

- Agrega una serie normalizada por cada combinación de indicador y período, conservando las series originales.
- Usa el primer dato disponible dentro de cada período como base: índice = valor / valorInicial × 100. Por ejemplo, 200 → 250 → 180 se transforma en 100 → 125 → 90.
- Dibuja esas series con líneas más finas y semitransparentes, usando un eje derecho llamado «Base 100».
- Funciona tanto con alineación por calendario como con «Índice 0». La alineación cambia el eje temporal; base 100 transforma los valores.


### Recordatorios

PUPPETEER_HEADLESS=false pnpm run e2e:replay tests/e2e/recordings/series-insert.json
