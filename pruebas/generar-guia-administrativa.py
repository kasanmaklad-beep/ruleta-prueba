# -*- coding: utf-8 -*-
# Genera GUIA-DE-PRUEBA-ADMINISTRATIVA.pdf — el recorrido completo de la plata,
# desde que la matriz emite una ficha hasta que vuelve.
# Mismo estilo que GUIA-DE-PRUEBA.pdf y GUIA-DE-PRUEBA-SALON.pdf.
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph,
                                Spacer, Table, TableStyle, KeepTogether, Flowable,
                                PageBreak)

SALIDA = "/Users/kasanmaklad/ruleta-deploy/GUIA-DE-PRUEBA-ADMINISTRATIVA.pdf"

ORO       = colors.HexColor("#a8842a")
ORO_OSC   = colors.HexColor("#7a5f16")
TITULO    = colors.HexColor("#a08a5a")
GRIS      = colors.HexColor("#7a7a7a")
VERDE     = colors.HexColor("#4a7a3a")
OLIVA     = colors.HexColor("#8a7a4a")
ROJO      = colors.HexColor("#a03028")
TEXTO     = colors.HexColor("#222222")
LINEA     = colors.HexColor("#d8d0bc")

P = ParagraphStyle("p", fontName="Helvetica", fontSize=9.5, leading=13.5, textColor=TEXTO)
P_TIT = ParagraphStyle("t", fontName="Helvetica", fontSize=24, leading=27, textColor=TITULO)
P_SUB = ParagraphStyle("s", fontName="Helvetica", fontSize=10, leading=14, textColor=GRIS)
P_CAJA_TIT = ParagraphStyle("ct", fontName="Helvetica", fontSize=11, leading=15, textColor=colors.HexColor("#3a3a3a"))
P_CAJA = ParagraphStyle("c", fontName="Helvetica", fontSize=8.8, leading=12.5, textColor=TEXTO)
P_PASO = ParagraphStyle("pa", fontName="Helvetica", fontSize=9.5, leading=13.5, textColor=TEXTO)
P_VER = ParagraphStyle("v", fontName="Helvetica", fontSize=8.8, leading=12, textColor=VERDE)
P_TIP = ParagraphStyle("ti", fontName="Helvetica", fontSize=8.3, leading=11.5, textColor=OLIVA)
P_OJO = ParagraphStyle("oj", fontName="Helvetica", fontSize=8.5, leading=12, textColor=ROJO)
P_SEC = ParagraphStyle("se", fontName="Helvetica", fontSize=12.5, leading=16, textColor=colors.white)
P_NUM = ParagraphStyle("nu", fontName="Helvetica-Bold", fontSize=12.5, leading=16,
                       textColor=colors.white, alignment=1)

ANCHO = letter[0] - 2 * 22 * mm


class Regla(Flowable):
    def __init__(self, ancho=ANCHO - 12 * mm, x=12 * mm):
        Flowable.__init__(self)
        self.ancho = ancho
        self.x = x
        self.width = ancho
        self.height = 0

    def draw(self):
        self.canv.setStrokeColor(LINEA)
        self.canv.setLineWidth(0.4)
        self.canv.line(self.x, 0, self.x + self.ancho, 0)


class Casilla(Flowable):
    def __init__(self, lado=3.6 * mm):
        Flowable.__init__(self)
        self.lado = lado
        self.width = self.height = lado

    def draw(self):
        self.canv.setStrokeColor(ORO)
        self.canv.setLineWidth(1)
        self.canv.roundRect(0, -1, self.lado, self.lado, 2, stroke=1, fill=0)


def seccion(numero, titulo):
    t = Table([[Paragraph(str(numero), P_NUM), Paragraph(titulo, P_SEC)]],
              colWidths=[12 * mm, ANCHO - 12 * mm], rowHeights=[10 * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), ORO_OSC),
        ("BACKGROUND", (1, 0), (1, 0), ORO),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (1, 0), (1, 0), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    return [Spacer(1, 7), t, Spacer(1, 7)]


def paso(n, texto, ver=None, tip=None, ojo=None, ultimo=False):
    cuerpo = [Paragraph("%s. %s" % (n, texto), P_PASO)]
    if ver:
        cuerpo += [Spacer(1, 2), Paragraph("Deberías ver: " + ver, P_VER)]
    if tip:
        cuerpo += [Spacer(1, 1), Paragraph("Tip: " + tip, P_TIP)]
    if ojo:
        cuerpo += [Spacer(1, 1), Paragraph("Ojo: " + ojo, P_OJO)]
    t = Table([[Casilla(), cuerpo]], colWidths=[12 * mm, ANCHO - 12 * mm])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    partes = [t]
    if not ultimo:
        partes.append(Regla())
    return KeepTogether(partes)


def caja(titulo, lineas, fondo, borde):
    dentro = [Paragraph(titulo, P_CAJA_TIT), Spacer(1, 5)]
    for l in lineas:
        dentro.append(Paragraph(l, P_CAJA))
        dentro.append(Spacer(1, 3))
    t = Table([[dentro]], colWidths=[ANCHO])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), fondo),
        ("BOX", (0, 0), (-1, -1), 0.8, borde),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    return t


def tabla(filas, anchos):
    datos = [[Paragraph('<font color="white">%s</font>' % c, P_CAJA) for c in filas[0]]]
    for f in filas[1:]:
        datos.append([Paragraph(c, P_CAJA) for c in f])
    t = Table(datos, colWidths=[ANCHO * a for a in anchos])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#3a3226")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f4efe2")]),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#ddd5c2")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return t


def pie(canv, doc):
    canv.saveState()
    canv.setStrokeColor(LINEA)
    canv.setLineWidth(0.5)
    canv.line(22 * mm, 16 * mm, letter[0] - 22 * mm, 16 * mm)
    canv.setFont("Helvetica", 7.5)
    canv.setFillColor(GRIS)
    canv.drawString(22 * mm, 11 * mm, "VOLTIO - Guia del proceso administrativo (el camino de la plata)")
    canv.drawRightString(letter[0] - 22 * mm, 11 * mm, "Pagina %d" % doc.page)
    canv.restoreState()


doc = BaseDocTemplate(SALIDA, pagesize=letter,
                      leftMargin=22 * mm, rightMargin=22 * mm,
                      topMargin=20 * mm, bottomMargin=22 * mm,
                      title="VOLTIO - Guia del proceso administrativo",
                      author="Ruleta Catatumbo")
doc.addPageTemplates([PageTemplate(id="normal",
                                   frames=[Frame(doc.leftMargin, doc.bottomMargin,
                                                 doc.width, doc.height, id="f")],
                                   onPage=pie)])

S = []
S += [Paragraph("VOLTIO — el camino de la plata", P_TIT),
      Paragraph("Recorrido completo del proceso administrativo — marcá cada casilla a medida que la probás", P_SUB),
      Spacer(1, 10),
      Paragraph(
          "Esta lista sigue <b>una ficha</b> desde que la casa la emite hasta que vuelve. Pasa por los cuatro "
          "pisos —matriz, ejecutivo, banquero y jugador— y termina cuadrando las cuentas. Hacé los pasos "
          "<b>en orden</b>: cada uno deja listo el siguiente. Al lado de cada acción dice qué deberías ver; "
          "si eso no pasa, anotá el número del paso y avisame.", P),
      Spacer(1, 12)]

S += [caja("Los cuatro pisos, en criollo", [
    "1. La <b>matriz</b> (vos) emite las fichas y se las <b>asigna</b> a un ejecutivo. No se las vende: se las "
    "presta. Mientras el ejecutivo no las reparta, <b>siguen siendo de la casa</b> y no te debe nada.",
    "2. El <b>ejecutivo</b> le <b>vende cupo</b> a sus banqueros. <b>Ahí nace la deuda</b>: ése es el momento en "
    "que le entra plata al bolsillo. Después te rinde.",
    "3. El <b>banquero</b> le <b>carga saldo</b> al jugador, en efectivo y mano a mano. Ese cupo lo pagó por "
    "adelantado, así que a él nadie le debe nada.",
    "4. El <b>jugador</b> juega. Si gana y retira, el banquero le paga <b>en efectivo</b>, y esas fichas "
    "<b>vuelven al pote de la matriz</b>, no al banquero. Eso es lo que cambiamos hace poco.",
], colors.HexColor("#f2f5fb"), colors.HexColor("#b8c4d8")),
    Spacer(1, 10)]

S += [caja("Antes de arrancar", [
    'Abrí en el celular: <font face="Courier">https://mycrosis.com</font>',
    "Vas a cambiar de cuenta varias veces. Para eso tocá <b>SALIR</b> arriba a la derecha. "
    "Acordate de que <b>una cuenta se usa en un aparato a la vez</b>: si entrás con la misma en dos "
    "teléfonos, al primero lo echa.",
    "Si venías con la página abierta, recargala del todo antes de empezar (bajá y soltá para refrescar).",
], colors.HexColor("#f7f2e4"), colors.HexColor("#d8c89a"))]

S += [Spacer(1, 6),
      tabla([
          ["Piso", "Cuenta", "Dónde entra"],
          ["Matriz (vos)", "<b>admin2026</b>", "Panel MATRIZ"],
          ["Ejecutivo", "<b>prueba2</b>", "Panel EJECUTIVO"],
          ["Banquero", "<b>banca1</b>", "BANCA"],
          ["Jugador", "<b>nabil</b> o <b>prueba3</b>", "El salón"],
      ], [0.3, 0.3, 0.4]),
      Spacer(1, 8)]

S += [caja("De dónde partimos hoy (09/08/2026)", [
    "Esto es lo que hay en la base <b>ahora</b>, para que sepas si un número se movió por vos o ya estaba:",
    "· <b>prueba2</b> (ejecutivo): <b>$7.000</b> en fichas sin repartir. Sin techo, y cobra <b>a sueldo</b> "
    "(no cobra comisión).",
    "· <b>banca1</b> (banquero): <b>$1.000</b> de cupo, paga <b>20%</b>, cuelga de prueba2. "
    'Su código de invitación es <font face="Courier">S0014</font>.',
    "· <b>nabil</b>: $500 de saldo, su banquero es banca1. · <b>prueba3</b>: $2.480, sin banquero. "
    "· <b>prueba</b>: $0, sin banquero.",
], colors.HexColor("#eef4ee"), colors.HexColor("#b8ceb8")),
    Spacer(1, 8)]

S += [Paragraph(
    '<font color="#a03028"><b>Ojo: esto es producción, no una copia.</b></font> La plata que muevas es la de '
    "verdad. Por eso la guía usa <b>montos chicos</b> ($100 y $200): alcanzan para ver moverse todos los "
    "números y no ensucian las cuentas. No uses la cuenta de un jugador real.", P_CAJA),
      Spacer(1, 4)]

# ── 1 ────────────────────────────────────────────────────────────────────
S += seccion(1, "La foto de arranque: el pote de la casa")
S += [paso(1, "Entrá como <b>admin2026</b>. Caés en el panel MATRIZ, en RESUMEN.",
           ver="Arriba del todo el recuadro <b>EL POTE DE LA CASA</b>.",
           tip="Si caés en el salón en vez del panel, tocá el botón PANEL arriba a la derecha."),
      paso(2, "Anotá el número de <b>fichas en la calle</b> en la hoja del final.",
           ver="Un monto y, debajo, de qué está hecho: el cupo de los ejecutivos, el de los banqueros y el "
               "saldo de los jugadores.",
           tip="“En la calle” es todo lo que la casa ya soltó y todavía no volvió. No se suma del libro: se "
               "suma de los saldos, así que ese número no se puede desfasar.",
           ojo="Si dice que podés emitir fichas sin límite, es porque <b>casa_fondo</b> está en cero. Es uno "
               "de los detalles que hay que decidir (está al final)."),
      paso(3, "Andá a la pestaña <b>EJECUTIVOS</b> y mirá la fila de <b>prueba2</b>.",
           ver="Sus fichas sin repartir ($7.000), cómo cobra (a sueldo), lo que <b>te debe</b> y su techo.",
           tip="Anotá también lo que te debe: en el paso 6 tiene que subir, y en el 5 no.", ultimo=True)]

# ── 2 ────────────────────────────────────────────────────────────────────
S += seccion(2, "La matriz le presta fichas al ejecutivo")
S += [paso(4, "En la fila de prueba2 tocá <b>FICHAS</b> y asignale <b>$500</b>.",
           ver="Sus fichas sin repartir pasan de $7.000 a <b>$7.500</b>.",
           tip="Esto es un préstamo, no una venta: le entregás fichas para que las administre."),
      paso(5, "Mirá la columna <b>TE DEBE</b> de prueba2. <b>No tiene que haber cambiado.</b>",
           ver="El mismo número que anotaste en el paso 3.",
           tip="Ésta es la regla que más cuesta y la que hay que verificar sí o sí: <b>la deuda no nace "
               "cuando le das fichas</b>, nace cuando él las vende. Mientras las tenga en la mano, son de la "
               "casa y están en su poder.",
           ojo="Si acá la deuda subió, pará y avisame: se estaría cobrando dos veces.", ultimo=True)]

# ── 3 ────────────────────────────────────────────────────────────────────
S += seccion(3, "El ejecutivo le vende cupo al banquero")
S += [paso(6, "Salí y entrá como <b>prueba2</b>. Caés en el panel EJECUTIVO (violeta).",
           ver="<b>TU RED</b> arriba, con tus fichas sin repartir y lo que le debés a la casa.",
           tip="Si no ves el panel violeta, es que entraste con otra cuenta."),
      paso(7, "En <b>ENTREGAR CUPO A UN BANQUERO</b> elegí <b>banca1</b> y entregale <b>$200</b>.",
           ver="Tus fichas sin repartir bajan $200 (de $7.500 a $7.300) y el cupo de banca1 sube de $1.000 a "
               "<b>$1.200</b>.",
           tip="El precio de cada banquero lo ponés vos. banca1 paga 20%: por $200 en fichas te entrega $40 "
               "y se queda con las fichas."),
      paso(8, "Mirá <b>TU CUENTA CON LA CASA</b>.",
           ver="Ahora <b>sí</b> subió lo que le debés a la matriz.",
           tip="Compará con el paso 5: entregar fichas no generó deuda, venderlas sí. Ese es todo el modelo "
               "en dos pasos.", ultimo=True)]

# ── 4 ────────────────────────────────────────────────────────────────────
S += seccion(4, "El camino inverso: el banquero pide")
S += [paso(9, "Salí y entrá como <b>banca1</b>. Caés en BANCA.",
           ver="Tu cupo ($1.200) y el recuadro <b>PEDIR CUPO</b>.",
           tip="Antes esto era una llamada telefónica. Ahora queda escrito y con fecha."),
      paso(10, "Pedí <b>$100</b> y escribí un motivo.",
           ver="El pedido queda en espera, y no podés pedir otro hasta que te respondan."),
      paso(11, "Salí, entrá como <b>prueba2</b> y buscá el pedido.",
           ver="El pedido de banca1 por $100, con dos botones: <b>APROBAR</b> y <b>RECHAZAR</b>."),
      paso(12, "Tocá <b>APROBAR</b>.",
           ver="El cupo de banca1 pasa a <b>$1.300</b>, y tus fichas sin repartir bajan otros $100.",
           tip="Aprobar un pedido hace exactamente lo mismo que entregar cupo a mano: es la misma operación "
               "por dentro, así que no hay forma de que una cuadre y la otra no."),
      paso(13, "Probá también el <b>RECHAZO</b>: pedí otros $50 desde banca1 y rechazalo con un motivo.",
           ver="El pedido queda rechazado con tu motivo escrito, y <b>ninguna ficha se movió</b>.",
           ojo="Verificá que el cupo quedó igual después de rechazar. Si se movió, avisame.", ultimo=True)]

# ── 5 ────────────────────────────────────────────────────────────────────
S += seccion(5, "El banquero le carga saldo al jugador")
S += [paso(14, "Entrá como <b>banca1</b> y andá a <b>CARGARLE SALDO A UN JUGADOR</b>.",
           ver="Un buscador de jugadores. Sólo te salen <b>los tuyos</b>, no todos los de la casa."),
      paso(15, "Cargale <b>$100</b> a <b>nabil</b>.",
           ver="Tu cupo baja $100 y el saldo de nabil sube de $500 a <b>$600</b>.",
           tip="Acá es donde la ficha llega al jugador. En la vida real, en este momento él te dio el "
               "efectivo en la mano."),
      paso(16, "Probá el freno: intentá cargarle <b>más de lo que te queda de cupo</b>.",
           ver="Te lo rechaza y te dice cuánto tenés.",
           ojo="Si te dejara pasar, estarías regalando fichas que la casa no emitió. Este freno es de los "
               "importantes.", ultimo=True)]

# ── 6 ────────────────────────────────────────────────────────────────────
S += seccion(6, "El jugador juega")
S += [paso(17, "Salí y entrá como <b>nabil</b>. Caés en la puerta nueva y de ahí al salón.",
           ver="Las cinco mesas, cada una con su color, y arriba tu saldo de $600.",
           tip="De paso mirá la vitrina: cuánta gente hay en cada mesa y los últimos números."),
      paso(18, "Entrá a <b>Catatumbo</b> y jugá unas fichas chicas.",
           ver="El saldo se mueve giro a giro."),
      paso(19, "Volvé al salón y mirá la tarjeta de la mesa donde jugaste.",
           ver="Los <b>últimos números</b> que salieron, con el que acabás de sacar a la cabeza, y "
               "<b>1 JUGANDO</b>.",
           tip="Ese contador cuenta cuentas distintas que apostaron en los últimos 10 minutos.",
           ojo="Si cae un rayo, fijate que aparezca la línea “cayó un rayo y pagó tanto”. Todavía no la vimos "
               "funcionar con un rayo de verdad.", ultimo=True)]

# ── 7 ────────────────────────────────────────────────────────────────────
S += seccion(7, "El jugador retira")
S += [paso(20, "Desde el salón tocá <b>CAJA</b> y pedí un retiro de <b>$50</b>.",
           ver="El pedido queda en espera y te dice a quién le tenés que cobrar: <b>banca1</b>."),
      paso(21, "Volvé al salón y mirá tu saldo.",
           ver="El saldo que ves es el <b>disponible</b>, o sea $50 menos, y te avisa que hay $50 retenidos.",
           tip="Los $50 no desaparecieron: están apartados para que no los apuestes mientras esperás el pago.",
           ojo="Si el juego te deja apostar esos $50, avisame: era un error que arreglamos y no puede volver.",
           ultimo=True)]

# ── 8 ────────────────────────────────────────────────────────────────────
S += seccion(8, "El banquero paga, y la ficha vuelve a la casa")
S += [paso(22, "Entrá como <b>banca1</b> y andá a <b>RETIROS</b>.",
           ver="El pedido de nabil por $50, con <b>PAGAR</b> y <b>RECHAZAR</b>."),
      paso(23, "Tocá <b>PAGAR</b> (en la vida real, acá le das el efectivo).",
           ver="El retiro queda pagado y el saldo retenido de nabil desaparece.",
           tip="Anotá tu cupo justo antes y justo después."),
      paso(24, "<b>Mirá tu cupo: NO tiene que haber subido.</b>",
           ver="El mismo cupo que tenías antes de pagar.",
           tip="Éste es el cambio que pediste. Antes, pagar un retiro te reponía las fichas y quedaban "
               "circulando entre vos y el jugador sin volver a comprarlas. Ahora esas fichas <b>vuelven al "
               "pote de la matriz</b>, y si querés más, se las comprás de nuevo al ejecutivo.",
           ojo="Si tu cupo subió, pará todo y avisame: es exactamente lo que fuimos a arreglar."),
      paso(25, "Entrá como <b>admin2026</b> y mirá otra vez <b>EL POTE DE LA CASA</b>.",
           ver="Las fichas en la calle bajaron en esos $50.", ultimo=True)]

# ── 9 ────────────────────────────────────────────────────────────────────
S += seccion(9, "El ejecutivo rinde")
S += [paso(26, "Como <b>admin2026</b>, en EJECUTIVOS mirá lo que te debe prueba2 y tocá <b>RINDIÓ</b>.",
           ver="Un cuadro para anotar cuánto te entregó."),
      paso(27, "Anotá lo que te debe (o una parte) y confirmá.",
           ver="La deuda baja en ese monto.",
           tip="La rendición <b>la anota la casa, no el ejecutivo</b>. Es a propósito: el que cobra no es el "
               "que dice cuánto le pagaron."),
      paso(28, "Probá también <b>DEVOLVIÓ</b> con $100.",
           ver="Sus fichas sin repartir bajan $100, y <b>la deuda no se mueve</b>.",
           tip="Devolver fichas que nunca vendió no le baja la deuda, porque la deuda nació de lo vendido. "
               "Son dos cosas distintas y por eso son dos botones distintos.", ultimo=True)]

# ── 10 ───────────────────────────────────────────────────────────────────
S += seccion(10, "Que las cuentas cuadren")
S += [paso(29, "Como <b>prueba2</b>, abrí el <b>REPORTE</b> y elegí el período de hoy.",
           ver="Dos miradas: la cuenta <b>con la casa</b> y la cuenta <b>con cada banquero</b>."),
      paso(30, "Compará con lo que hiciste hoy.",
           ver="Lo vendido a banca1 tiene que ser <b>$300</b> ($200 del paso 7 + $100 del pedido aprobado).",
           tip="Fijate que el reporte separa <b>lo pendiente del período</b> de <b>la deuda de hoy</b>. "
               "Mezclarlas es la forma más fácil de cobrarle dos veces a alguien."),
      paso(31, "Como <b>admin2026</b>, andá a <b>REPORTES</b> y mirá por mesa y por banquero.",
           ver="La mesa donde jugaste con lo apostado y lo pagado, y banca1 con su movimiento del día."),
      paso(32, "Volvé al <b>POTE</b> y comparalo con lo que anotaste en el paso 2.",
           ver="La diferencia tiene que explicarse sola: lo que cargaste al jugador menos lo que retiró.",
           ojo="Si no cuadra, anotá los dos números y avisame. Que el pote no mienta es la razón por la que "
               "se calcula de los saldos y no de un contador guardado.", ultimo=True)]

# ── 11 ───────────────────────────────────────────────────────────────────
S += seccion(11, "Los detalles que faltan decidir")
S += [Paragraph(
    "Estos no son pasos para probar: son decisiones tuyas que quedaron pendientes. Aprovechá que vas a "
    "tener todos los paneles abiertos.", P), Spacer(1, 6)]
S += [paso(33, "<b>La cuenta vieja <font face=\"Courier\">admin</font> sigue activa y sigue siendo "
                "administradora.</b> En USUARIOS, bajala a jugador o bloqueala.",
           ver="Que quede un solo administrador: admin2026.",
           ojo="Es el pendiente más viejo y el de más riesgo: hay dos llaves de la casa y una es la vieja."),
      paso(34, "<b>El fondo de la casa.</b> En CONFIGURACIÓN, decidí si le ponés número a "
                "<font face=\"Courier\">casa_fondo</font>.",
           ver="Con un número mayor que cero, la casa <b>frena</b> la emisión cuando se llega al tope.",
           tip="Hoy está en cero, o sea sin límite."),
      paso(35, "<b>Las reglas de la clave.</b> Hoy el único requisito son 6 caracteres: ni números "
                "obligatorios, ni bloqueo por intentos fallidos. Decime qué querés exigir.",
           tip="Es decisión tuya, no técnica. Cuando me digas el número y la forma, lo implemento."),
      paso(36, "<b>Los banqueros de verdad.</b> Hoy sólo existe banca1, que es de prueba. Sin banqueros "
                "reales nadie puede cargar saldo el día que abras.",
           tip="Decime cuántos son y con qué porcentaje trabaja cada uno."),
      paso(37, "<b>El plan de la base de datos.</b> Conviene pasar a $5/mes antes de abrir: la vitrina del "
                "salón anota un renglón por giro y eso sube las escrituras entre un 25% y un 30%.",
           tip="Con el plan gratis el techo son unos 8.000 giros por día.", ultimo=True)]

# ── Hoja de anotaciones ──────────────────────────────────────────────────
# Arranca en página propia: es la que se llena a mano, y partida en dos no sirve.
S += [PageBreak()]
S += seccion(12, "Hoja de anotaciones")
S += [Paragraph("Anotá acá los números a medida que avanzás. Con esto se detecta cualquier descuadre "
                "sin tener que rehacer la prueba.", P), Spacer(1, 8)]
S += [tabla([
    ["Momento", "Qué anotar", "Número"],
    ["Paso 2 — arranque", "Fichas en la calle (el pote)", "&nbsp;"],
    ["Paso 3 — arranque", "Lo que te debe prueba2", "&nbsp;"],
    ["Paso 5 — tras dar fichas", "Lo que te debe prueba2 (no debe cambiar)", "&nbsp;"],
    ["Paso 8 — tras vender cupo", "Lo que te debe prueba2 (ahora sí sube)", "&nbsp;"],
    ["Paso 23 — antes de pagar", "Cupo de banca1", "&nbsp;"],
    ["Paso 24 — después de pagar", "Cupo de banca1 (no debe subir)", "&nbsp;"],
    ["Paso 25 — cierre", "Fichas en la calle (el pote)", "&nbsp;"],
    ["Paso 30 — reporte", "Vendido a banca1 (deberían ser $300)", "&nbsp;"],
], [0.34, 0.46, 0.2])]

S += [Spacer(1, 14),
      caja("Cuando termines", [
          "Contame <b>qué número de paso falló</b>, si alguno. Lo que no aparezca acá está bien: esta lista "
          "es justamente lo que hay que mirar.",
          "Los tres pasos que más importan son el <b>5</b> (dar fichas no genera deuda), el <b>24</b> (pagar "
          "un retiro no le repone fichas al banquero) y el <b>32</b> (el pote cuadra). Si esos tres están "
          "bien, la contabilidad del sistema está bien.",
          "Y si querés, después de la prueba limpiamos los movimientos que dejó. <b>Ojo con eso:</b> el "
          "script de limpieza que hay hoy está desactualizado y dejaría basura suelta — hay que arreglarlo "
          "antes de correrlo.",
      ], colors.HexColor("#f2f5fb"), colors.HexColor("#b8c4d8"))]

doc.build(S)
print("listo:", SALIDA)
