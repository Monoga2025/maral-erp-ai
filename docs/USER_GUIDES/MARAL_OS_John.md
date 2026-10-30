# MARAL OS · Guía práctica para John

**Del cliente al cobro: pasos para trabajar con los flujos que están disponibles hoy.**

[Abrir MARAL OS · os.industriasmaral.com](https://os.industriasmaral.com)

Esta guía describe la interfaz y reglas implementadas en la versión revisada del sistema. No reemplaza la evidencia comercial, el criterio de gerencia ni la revisión del contador. Trabaje solo con su usuario y su propia cédula; no comparta credenciales.

> **Importante:** se confirmó que la página de acceso publica tarjetas de usuario que solicitan cédula, pero el inicio de sesión real no se probó como parte de esta guía. Si no puede entrar, contacte al responsable del sistema; no intente otra identidad.

## Ruta rápida

1. Ingrese con su tarjeta y cédula; abra **Clientes** y confirme los datos del comprador.
2. En **Cotizaciones**, cree la oferta, revise cantidades, descuentos, dirección, pago y observaciones.
3. Guarde como borrador mientras prepara el documento; descargue y revise el PDF antes de compartirlo. Al enviarlo por su canal habitual, registre el estado correspondiente.
4. Con aprobación del cliente, convierta la cotización a pedido y revise su detalle.
5. Confirme preparación y disponibilidad real. Para contado, concilie manualmente el pago de los productos antes de despachar; el sistema no lo valida. Registre uno o varios despachos con las cantidades que efectivamente salen.
6. Si es crédito, revise **Crédito y Cartera** y confirme pago solo cuando haya evidencia de pago total.

## 1. Ingreso y navegación

1. Abra [os.industriasmaral.com](https://os.industriasmaral.com).
2. Seleccione su tarjeta de usuario. La pantalla solicita **Número de cédula** y **Ingresar al sistema**; escriba su propia cédula. No use la de otra persona.
3. Si aparece «Cédula incorrecta», revise que seleccionó su tarjeta. Si persiste, pare y pida ayuda al responsable; no adivine contraseñas.
4. Use el menú lateral para entrar a **Clientes**, **Cotizaciones**, **Pedidos**, **Producción** o **Crédito**. Las opciones visibles pueden variar por perfil.

## 2. Revisar o actualizar un cliente

1. Entre en **Clientes**. Busque por nombre, empresa o NIT/RUT; aplique filtros de categoría, segmento, ciudad o etiqueta si ayudan.
2. Abra el registro y compruebe con el cliente la persona de contacto, NIT, teléfono, ciudad y dirección. No sobrescriba la dirección principal con una dirección ocasional de entrega: la dirección específica se captura en la cotización/pedido.
3. La categoría identifica el tipo de cliente. Al seleccionarlo en la cotización, el sistema propone una tasa según su categoría/segmento y la configuración vigente. No dé por sentada una tasa fija: revise el descuento efectivo, línea por línea, y confirme su autorización comercial antes de cotizar.
4. Cambiar categoría desde la tabla **Clientes** guarda el cambio inmediatamente. Confirme que eligió el registro y categoría correctos antes de seleccionar.
5. Use **Nuevo Cliente** solo cuando haya confirmado que no existe un registro duplicado.

## 3. Preparar, guardar y compartir una cotización

1. Abra **Cotizaciones** y elija **Nueva Cotización**. Busque y seleccione al cliente correcto. Puede comenzar desde la ficha del cliente si la acción está disponible.
2. En **Productos**, busque referencias del catálogo y añádalas. Compruebe producto, cantidad, precio de lista y descuento; el subtotal refleja el descuento. Si el producto es un kit, revise cantidades de componentes en el editor interno. El cliente ve el kit y su precio total, no el desglose interno.
3. Puede corregir cantidad, precio, descuento o quitar una línea. Revise el resultado con atención; no confíe en una tasa sugerida como autorización de precio.
4. En **Condiciones**, seleccione plazo de validez y forma de pago, y registre **Próximo seguimiento** para recordar cuándo llamar. El seguimiento es una fecha registrada, no una promesa de recordatorio automático.
5. Revise **Dirección de envío** (puede diferir de la dirección del cliente) y **Observaciones**. La política implementada para cotizaciones nuevas es sin IVA; el total se calcula sin IVA. No use esta oferta como factura tributaria.
6. En **Revisar cotización**, compruebe cliente, productos, cantidades, precios finales, descuento, total, términos y dirección. Elija **Solo guardar** para conservar un borrador. «Ya la envié al cliente» registra que usted ya la envió por WhatsApp o correo; no envía el mensaje por sí solo.
7. En la lista, use **Ver PDF** para revisar en el navegador o **Descargar PDF** para guardar el archivo y enviarlo por su canal habitual. Abra el archivo y verifique cliente, referencias, cantidades, total y datos de entrega antes de compartirlo.
8. Edite una cotización no convertida con **Editar**. Al convertir una cotización aprobada, enviada o borrador, use **Pedido** / **Convertir a Pedido**, complete los datos de envío solicitados y confirme. El sistema lleva las líneas y sus precios finales al pedido. Después de convertir, revise el pedido: no dé por confirmada una venta solo porque existe una cotización.

## 4. Pedido, preparación y producción

1. Abra el pedido desde **Pedidos** o desde la conversión. Confirme cliente, destinatario, dirección de entrega, productos, cantidades, total y notas. La dirección del envío pertenece al pedido, no cambia por sí misma la ficha maestra del cliente.
2. Para cada línea, revise **Stock**, **Producción** o **Pendiente** en **Productos**. El indicador de stock ayuda a decidir, pero valide físicamente disponibilidad y reservas. No marque como stock lo que no está listo para salir.
3. Para artículos disponibles, marque **Stock** y use el control de recolección junto al producto para indicar que fue recolectado/preparado. Cuando todos los artículos estén efectivamente disponibles, puede usar **Empacar ahora** si aparece. El estado global por pasos ofrece **Avanzar a**; use solo después de verificar la preparación real.
4. Para una línea que requiere fabricación, márquela **Producción** y actualice el pedido. Esa selección puede crear automáticamente una orden de producción (OP) vinculada. Actualice/recargue la ficha y revise **Órdenes de Producción**; trabaje sobre la OP aplicable existente y avance su fase/estado desde **Producción** o el pedido. Solo cree una **Nueva OP** si verificó que no existe una OP aplicable para ese producto y cantidad; no combine la selección automática con una creación manual a ciegas. Fases: **Procesos Básicos**, **Preensamble** y **Ensamble Final**. Confirme físicamente fabricación y empaque antes de considerar el pedido listo.
5. No todos los pedidos requieren fabricar: stock listo puede ir a empaque y despacho. Tampoco marque **Listo** o **Empacado** solo para saltar trabajo pendiente. Una fecha requerida es una referencia operativa, no confirmación de entrega al cliente.
6. Las fotos de empaque y remite se pueden adjuntar desde **Fotos del Pedido**. **PDF Despacho** permite abrir una impresión de la guía; compruebe que los datos son correctos antes de imprimir o entregar.

## 5. Crear despachos (incluidos parciales)

El detalle del pedido incluye **Nuevo Despacho** y **Registrar Despacho**. Los despachos parciales están disponibles: registre únicamente lo que realmente sale ahora y complete lo pendiente en otro despacho.

1. Antes de registrar, coteje pedido, unidades preparadas, dirección y transportadora. Para una venta de contado, compruebe y concilie manualmente el pago de los productos con evidencia bancaria/contable antes de despachar. La aplicación no tiene control de confirmación del pago de contado ni bloquea el despacho si falta este cotejo: la ausencia de bloqueo no significa pago confirmado. **Pago flete** se refiere al pago del transporte, no al pago de los productos. Abra **Nuevo Despacho**.
2. En **Productos a despachar**, escriba la cantidad de cada línea que sale en este envío. La cantidad pendiente aparece como «Pendiente: X / Y»; no exceda lo pendiente ni incluya productos que no salen. Puede dejar otras líneas en cero.
3. Complete **Transportadora**, **Número de guía** si existe, y **Notas** cuando aplique. No invente número de guía.
4. Si el envío es a crédito conforme a las condiciones aprobadas, verifique en la ficha del cliente los días de pago y la fecha de vencimiento esperada antes de marcar **Despacho a crédito**. Si los días registrados están vacíos o en cero, el backend usa 30 días; no equivale a crédito de pago inmediato. El control no muestra vista previa de la fecha: después de registrar, compruebe en **Crédito y Cartera** la factura y vencimiento creados. Se genera una factura interna por el valor de esas cantidades, no una factura electrónica DIAN. Para contado, deje **Despacho a crédito** sin marcar y concilie por separado el pago de los productos: el control no valida el pago recibido.
5. Pulse **Registrar Despacho** solo después de cotejar cantidades y evidencia física. Un envío parcial deja el pedido en **DESPACHO_PARCIAL**; cuando se despachan todas las unidades queda **DESPACHADO**. Las cantidades se limitan al saldo aún no despachado y el inventario se descuenta al registrar.
6. En cada despacho, **Marcar entregado** corresponde a confirmar que ese envío llegó. No marque entregado basándose únicamente en la salida del almacén. No cambie manualmente el estado global para saltarse el flujo de despachos: el sistema deriva el estado del pedido de cantidades y entregas.
7. Un despacho en **PREPARANDO** puede eliminarse desde su control si aún no se ha despachado. Compruebe que seleccionó el despacho correcto; estados terminales no se deben modificar para corregir un error. Deténgase y pida apoyo.

> **Control antes de confirmar:** compare cantidades con mercancía y soporte real. Para contado, concilie manualmente pago de los productos; para crédito, valide días y vencimiento esperado. **Pago flete** no es pago de los productos. Crear un registro modifica pedido, inventario y, en crédito, cartera; no es una vista previa.

## 6. Crédito, pagos y Merlin

- En **Crédito y Cartera**, filtre facturas por **Todas**, **Vencidas**, **Próximas (3d)**, **Críticas (>60d)** o **Pagadas**. Revise número, cliente, monto y fecha de vencimiento.
- **Registrar pago** abre un monto y luego requiere **Confirmar pago**. En la implementación actual, la confirmación cambia la factura completa a **PAGADA** y el monto debe coincidir con el total de la factura. No registra abonos parciales ni basta con un recibo o una promesa. Verifique evidencia bancaria/contable y monto total antes de confirmar; si es un abono, no confirme como pagada.
- El botón de WhatsApp abre un borrador de recordatorio para revisión y envío manual. No se envía solo; confirme destinatario y texto antes de enviar.
- MARAL OS mantiene seguimiento interno de cartera. El contador gestiona la facturación electrónica DIAN en Merlin según el proceso contable de la empresa. El botón **Facturar en Merlin** muestra datos para copiar manualmente; no es una integración que registre la factura por usted. No confunda factura interna de cartera con factura DIAN.
- La pantalla actual también muestra **Facturar DIAN**. No use esa acción en este procedimiento operativo: su disponibilidad visible no demuestra que esté aprobada, configurada o validada para el proceso tributario de la empresa. Confirme el procedimiento con el contador antes de cualquier emisión.

## 7. Ejemplo ficticio y lista de control

**Ejemplo ficticio (no corresponde a cliente real):** una cotización aprobada contiene referencia A (6 unidades) y referencia B (4 unidades). Es una venta de **contado**; antes del primer despacho, el equipo concilia manualmente evidencia del pago de los productos. Hay 6 unidades de A listas y B requiere producción. En el pedido marca A como **Stock** y B como **Producción**; actualiza la ficha, verifica la OP automática vinculada a B y continúa esa OP, sin crear otra duplicada. En **Nuevo Despacho** registra solo A × 6 y deja B × 0; el pedido queda parcial. Después de fabricar y preparar B, registra B × 4 en el despacho siguiente. Deja **Despacho a crédito** desmarcado en ambos envíos de contado. Registra entrega y pago únicamente tras verificar su evidencia.

**Antes de cada acción irreversible, compruebe:**

- [ ] Cliente y pedido correctos; productos y cantidades cotejados.
- [ ] Descuento, precio, forma de pago y dirección revisados.
- [ ] Producción/preparación respaldada por estado físico real; OP existente inspeccionada antes de crear otra.
- [ ] Despacho contiene solo cantidades que salen hoy; guía no inventada.
- [ ] Contado: pago de productos conciliado manualmente con evidencia; no confundir con **Pago flete**.
- [ ] Crédito: días y vencimiento esperado revisados; factura interna comprobada después del registro.
- [ ] Pago total corroborado antes de **Confirmar pago**.
- [ ] PDF revisado antes de enviarlo externamente.

## 8. Si algo no coincide

- **No entra:** verifique tarjeta y cédula propias; si falla, solicite ayuda. No reutilice la sesión de otra persona.
- **No encuentra cliente/producto:** quite filtros y busque por nombre, empresa o referencia. No cree duplicado ni sustituya una referencia sin validación.
- **Precio o descuento no coincide:** pare y confirme la tasa configurada y autorización comercial con el responsable; corrija antes de guardar o convertir.
- **Despacho rechazado o saldo cambió:** actualice el pedido y vuelva a cotejar unidades pendientes; no intente forzar estado ni cantidad.
- **Error al guardar o conexión interrumpida:** revise si el registro ya aparece antes de volver a pulsar o duplicar; si persiste, reporte número de pedido/cotización al soporte sin incluir cédulas, contraseñas ni datos bancarios.
- **Factura, entrega o inventario dudosos:** no confirme para “destrabar” la pantalla. Preserve el estado, anote el número del registro y solicite revisión del responsable.

## Alcance y pendientes conocidos

Esta guía se redactó a partir del código actual y las reglas operativas documentadas, no de una prueba de aceptación del flujo completo. El inicio de sesión real y el ciclo completo con datos de negocio no fueron probados para esta entrega. El servicio de la aplicación en la dirección indicada está publicado, pero la infraestructura Railway fue pausada por separado; la guía no afirma estado de disponibilidad futuro. Los servicios automáticos permanecen pendientes de validación/activación; no prometa recordatorios automáticos. Los requisitos históricos de presentación de cotizaciones no se consideran implementados aquí salvo lo visible en la versión actual. El tratamiento fiscal y la emisión DIAN deben confirmarse con el contador.
