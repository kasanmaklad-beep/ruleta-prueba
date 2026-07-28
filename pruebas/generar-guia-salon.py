# Genera GUIA-DE-PRUEBA-SALON.pdf con el mismo estilo que GUIA-DE-PRUEBA.pdf
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph,
                                Spacer, Table, TableStyle, KeepTogether, Flowable)

SALIDA = "/Users/kasanmaklad/ruleta-deploy/GUIA-DE-PRUEBA-SALON.pdf"

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
    """Línea fina que separa un paso del siguiente."""
    def __init__(self, ancho=ANCHO - 12 * mm, x=12 * mm):
        Flowable.__init__(self)
        self.ancho, self.x = ancho, x
        self.height = 1

    def draw(self):
        self.canv.setStrokeColor(LINEA)
        self.canv.setLineWidth(0.5)
        self.canv.line(self.x, 0, self.x + self.ancho, 0)


class Casilla(Flowable):
    """El cuadradito para marcar cada paso."""
    def __init__(self, lado=11):
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
    cuerpo = [Paragraph(f"{n}. {texto}", P_PASO)]
    if ver:
        cuerpo += [Spacer(1, 2), Paragraph(f"Deberías ver: {ver}", P_VER)]
    if tip:
        cuerpo += [Spacer(1, 1), Paragraph(f"Tip: {tip}", P_TIP)]
    if ojo:
        cuerpo += [Spacer(1, 1), Paragraph(f"Ojo: {ojo}", P_OJO)]
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


def tabla_cuentas(filas):
    datos = [[Paragraph(f'<font color="white">{c}</font>', P_CAJA) for c in filas[0]]]
    for f in filas[1:]:
        datos.append([Paragraph(c, P_CAJA) for c in f])
    t = Table(datos, colWidths=[ANCHO * 0.42, ANCHO * 0.3, ANCHO * 0.28])
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
    canv.drawString(22 * mm, 11 * mm, "VOLTIO — Guía de prueba del salón (mesas)")
    canv.drawRightString(letter[0] - 22 * mm, 11 * mm, f"Página {doc.page}")
    canv.restoreState()


doc = BaseDocTemplate(SALIDA, pagesize=letter,
                      leftMargin=22 * mm, rightMargin=22 * mm,
                      topMargin=20 * mm, bottomMargin=22 * mm,
                      title="VOLTIO — Guía de prueba del salón",
                      author="Ruleta Catatumbo")
doc.addPageTemplates([PageTemplate(id="normal",
                                   frames=[Frame(doc.leftMargin, doc.bottomMargin,
                                                 doc.width, doc.height, id="f")],
                                   onPage=pie)])

S = []
S += [Paragraph("VOLTIO — el salón", P_TIT),
      Paragraph("Lista de verificación del salón de mesas — marcá cada casilla a medida que la probás", P_SUB),
      Spacer(1, 10),
      Paragraph(
          "Esta lista recorre todo lo que cambió cuando el juego pasó de ser una sola ruleta a ser un "
          "salón con varias mesas. Hacé los pasos en orden: cada uno deja listo el siguiente. Al lado de "
          "cada acción dice qué deberías ver; si eso no pasa, anotá el número del paso y avisame.", P),
      Spacer(1, 12)]

S += [caja("Qué cambió, en criollo", [
    "1. Antes había <b>una</b> ruleta. Ahora hay un <b>salón</b> con varias mesas, y el jugador elige a cuál entra.",
    "2. El <b>saldo es uno solo</b> para todas las mesas: la plata no se reparte ni se traba en ninguna.",
    "3. Cada mesa tiene su ficha: qué rueda usa (con 0 y 00 o con un solo cero), si lleva animalitos, si "
    "tiene rayos y cuánto paga el pleno. <b>Esa ficha la armás vos desde el panel</b>, sin tocar código.",
    "4. Cada giro queda anotado a nombre de su mesa, así el reporte te dice con cuál ganás y con cuál no.",
], colors.HexColor("#f2f5fb"), colors.HexColor("#b8c4d8")),
    Spacer(1, 10)]

S += [caja("Antes de arrancar", [
    'Abrí en el celular: <font face="Courier">https://mycrosis.com</font>',
    "Vas a usar dos cuentas. Para cambiar de una a otra tocá SALIR arriba a la derecha:",
], colors.HexColor("#f7f2e4"), colors.HexColor("#d8c89a"))]

S += [Spacer(1, 6),
      tabla_cuentas([
          ["Rol", "Usuario", "Clave"],
          ["Dueño (vos)", "el tuyo de siempre", "la tuya"],
          ["Jugador de prueba", "prueba", "la que le pusiste"],
      ]),
      Spacer(1, 6),
      Paragraph(
          '<font color="#a03028"><b>Ojo: esto es producción, no una copia.</b></font> La plata que muevas '
          "es la de verdad. Usá fichas chicas y la cuenta <b>prueba</b>, nunca una cuenta de un jugador real.", P_CAJA),
      Paragraph(
          "Si venías con la página abierta en el teléfono, recargala del todo antes de empezar (bajá y soltá "
          "para refrescar). Si no, podés seguir viendo la versión vieja.", P_CAJA),
      Spacer(1, 4)]

# ── 1 ────────────────────────────────────────────────────────────────────
S += seccion(1, "El salón: elegir mesa")
S += [paso(1, "Entrá como <b>prueba</b>. Vas a caer directo en el salón.",
           ver="La marca VOLTIO arriba, tu saldo al lado, y abajo las mesas, una debajo de la otra.",
           tip="El dueño y el taquillero no caen acá: cada uno entra en su lugar de trabajo. Para el salón está el botón SALÓN."),
      paso(2, "Mirá las cuatro tarjetas.",
           ver="<b>Catatumbo</b> con la cinta MESA ABIERTA y el botón ENTRAR. Las otras tres en gris, "
               "con PRÓXIMAMENTE y el botón MUY PRONTO, que no hace nada.",
           tip="Esas tres están cerradas a propósito: se abren de a una, cada una después de su verificación."),
      paso(3, "Tocá ENTRAR en Catatumbo.",
           ver="Entrás a la mesa de siempre. Arriba dice <b>CATATUMBO</b>, con el rayo adelante.",
           tip="Fijate en la dirección: termina en <font face=\"Courier\">/juego?mesa=catatumbo</font>. Esa es la mesa que estás jugando.",
           ultimo=True)]

# ── 2 ────────────────────────────────────────────────────────────────────
S += seccion(2, "El paño: los ceros y el borde")
S += [paso(4, "Mirá dónde quedaron los ceros. En el celular el paño está de costado, así que la columna "
              "de ceros te queda arriba.",
           ver="El <b>0 (Delfín)</b> sobre la columna del <b>1</b>, y el <b>00 (Ballena)</b> sobre la del <b>3</b>.",
           tip="Estaban al revés y lo corregimos. Importa porque de esa vecindad salen los tríos 0-1-2 y 00-2-3: "
               "si los ceros están cambiados, esas apuestas no tienen dónde ir."),
      paso(5, "Poné una ficha de $1 en la <b>raya</b> que separa los ceros de la columna del 1-2-3, "
              "apuntando a cada uno de estos siete lugares, de una punta a la otra.",
           ver="Que en cada lugar entre la ficha. De un extremo al otro: <b>00-3</b>, <b>00-2-3</b>, "
               "<b>00-2</b>, <b>0-2</b>, <b>0-1-2</b>, <b>0-1</b>, y en la última punta —la del lado de la "
               "primera docena— la <b>línea de cinco</b> (0, 00, 1, 2 y 3).",
           tip="Si alguna se te resiste con el dedo, anotá cuál: se le puede dar más lugar."),
      paso(6, "Tocá LIMPIAR y probá el pleno al 0 y al 00 por separado, y el split entre los dos "
              "(en el medio de la columna de ceros, no en la raya).",
           ver="Tres apuestas distintas, cada una con su ficha en su lugar."),
      paso(7, "Poné una ficha en cualquier número y girá.",
           ver="El cilindro gira, cae la bola, y el número que sale es el que se marca en el paño con la "
               "moneda dorada. El saldo se mueve al terminar, no antes.",
           tip="El resultado lo decide el servidor, no el teléfono.", ultimo=True)]

# ── 3 ────────────────────────────────────────────────────────────────────
S += seccion(3, "Que la mesa te siga")
S += [paso(8, "Con la mesa abierta, recargá la página.",
           ver="Volvés a la <b>misma</b> mesa, no a otra."),
      paso(9, "Tocá CAJA, mirá tu billetera y volvé con “← VOLVER AL JUEGO”.",
           ver="Volvés a la misma mesa donde estabas.",
           tip="Antes esto te devolvía siempre a Catatumbo aunque estuvieras en otra mesa. Ahora la mesa "
               "viaja en la dirección, así que también podés compartir el enlace de una mesa.", ultimo=True)]

# ── 4 ────────────────────────────────────────────────────────────────────
S += seccion(4, "El panel: la pestaña MESAS")
S += [paso(10, "Salí y entrá como <b>dueño</b>. Andá a la pestaña <b>MESAS</b>.",
            ver="Las cuatro mesas, cada una con su ícono y su color, y arriba el botón + MESA NUEVA."),
      paso(11, "Mirá los cuatro números de cada mesa.",
            ver="<b>Pleno</b> (cuánto paga), <b>le deja el pleno</b> y <b>le deja el resto</b> (lo que se "
                "queda la casa, en porcentaje) y <b>rondas jugadas</b>.",
            tip="Regla del negocio: el resto de la mesa deja 5,3% en una rueda con 0 y 00, y 2,7% en una de "
                "un solo cero. Eso sale de la rueda, no se configura. Una mesa europea es más generosa con "
                "el jugador y eso hay que decidirlo sabiéndolo."),
      paso(12, "Tocá EDITAR en la Americana Clásica y probá <b>sacarle y ponerle los rayos</b>.",
            ver="Sin rayos, el pleno queda <b>clavado en 35 a 1</b> y no te deja elegir otra cosa. Con "
                "rayos, recién ahí aparece la opción de 29 a 1.",
            tip="No es un capricho de la pantalla: 29 a 1 solo se sostiene donde los multiplicadores compensan. "
                "Sin rayos, con 29 la casa se quedaría con más del 20% del pleno. El servidor lo rechaza igual, "
                "aunque alguien intente forzarlo."),
      paso(13, "Tocá CANCELAR. Ahora probá <b>cerrar Catatumbo</b>, que es la única abierta.",
            ver="Te frena: no deja cerrar la última mesa abierta.",
            tip="Si se cierran todas, el jugador entra al salón y no tiene dónde jugar. Es una caja cerrada.",
            ultimo=True)]

# ── 5 ────────────────────────────────────────────────────────────────────
S += seccion(5, "Armar una mesa nueva")
S += [paso(14, "Tocá <b>+ MESA NUEVA</b> y creá una de mentira para ver cómo funciona: id "
               "<font face=\"Courier\">mesa_ensayo</font>, nombre “Mesa de ensayo”, rueda europea, sin "
               "animales, sin rayos, ícono y color a gusto, y las dos líneas de texto que quieras. "
               "<b>Dejala sin marcar “abierta al público”.</b>",
            ver="Aparece en la lista, cerrada, con 0 rondas jugadas.",
            tip="El <b>id</b> es lo único que no se puede cambiar después: queda escrito en cada movimiento "
                "de esa mesa. Por eso el panel te muestra las rondas jugadas de cada una."),
      paso(15, "Entrá al salón (botón SALÓN) y mirá.",
            ver="La mesa de ensayo aparece anunciada como PRÓXIMAMENTE, con el ícono y el texto que le pusiste."),
      paso(16, "Volvé al panel, abrí la mesa de ensayo, y desde el salón entrá a jugarla. Después cerrala.",
            ver="Se juega como cualquier otra: rueda de un solo cero, sin 00 y sin animales. Al cerrarla, "
                "vuelve a PRÓXIMAMENTE.",
            ojo="La mesa de ensayo dejala cerrada, o borrala del panel si nunca jugó. Es solo para ver el mecanismo.",
            ultimo=True)]

# ── 6 ────────────────────────────────────────────────────────────────────
S += seccion(6, "La plata, separada por mesa")
S += [paso(17, "En el panel andá a <b>REPORTES</b>.",
            ver="Arriba, el selector “Todas las mesas”. Abajo, la tabla <b>POR MESA</b> con lo apostado, lo "
                "pagado y lo que te dejó cada una."),
      paso(18, "Elegí una mesa en el selector.",
            ver="Los números se filtran solo a esa mesa.",
            tip="Filtrando por mesa, la caja queda en cero a propósito: las recargas y los retiros son de la "
                "billetera del jugador, no de una mesa en particular.", ultimo=True)]

# ── 7 ────────────────────────────────────────────────────────────────────
S += seccion(7, "Abrir una mesa nueva de verdad")
S += [paso(19, "Antes de abrir cualquier mesa al público, se le corre la batería de verificación. Eso lo "
               "hago yo en la computadora, mesa por mesa.",
            ver="Un veredicto: APTA o NO APTA. Comprueba la rueda, los pagos giro por giro, los topes, lo "
                "que no va en esa mesa, los rayos y el reporte.",
            tip="Las cuatro mesas de hoy ya pasaron la batería. Es la parte que se automatiza."),
      paso(20, "Después la abrís vos desde el panel y la jugás <b>unos días con la cuenta prueba</b>, "
               "mirando el reporte de esa mesa.",
            ver="Que lo apostado y lo pagado se muevan como esperás, y que el porcentaje que te deja se "
                "parezca al que dice el panel.",
            tip="Mi sugerencia de orden: primero la <b>Americana Clásica</b> —misma rueda que Catatumbo, ya "
                "probada, solo sin animales y con el pleno a 35—, y después las europeas, que traen rueda nueva."),
      paso(21, "Recién cuando esa mesa te convenza, se abre la siguiente. <b>Nunca dos a la vez.</b>",
            ver="Un salón que crece de a una mesa, cada una con su historial limpio.",
            tip="Si algo sale mal, con una sola mesa nueva sabés exactamente dónde mirar.", ultimo=True)]

# ── 8 ────────────────────────────────────────────────────────────────────
S += seccion(8, "Si ves alguna de estas cosas, avisame")
S += [paso(22, "Una mesa <b>cerrada</b> que igual te deja entrar y jugar.", ver="No tiene que pasar nunca."),
      paso(23, "El <b>00</b> saliendo en una mesa de un solo cero, o una apuesta con 00 que te acepten ahí."),
      paso(24, "Un premio que no cuadre: un pleno que no pague lo que dice la mesa, o un color que no "
               "devuelva el doble."),
      paso(25, "El <b>ruido del cilindro</b> que se quede sonando cuando ya no hay ruleta en pantalla.",
            tip="Esto lo arreglamos: ahora si el servidor no contesta en 15 segundos, se corta solo, te "
                "avisa y te quedan las fichas puestas."),
      paso(26, "Un giro que se quede colgado, sin resultado, con la rueda girando para siempre.",
            ojo="Anotá la hora y qué mesa era: con eso lo puedo buscar en los movimientos.", ultimo=True)]

S += [Spacer(1, 14),
      caja("Cuando termines", [
          "Contame qué número de paso falló, si alguno. Lo que no aparezca acá está bien: esta lista es "
          "justamente lo que hay que mirar.",
          "Y decidí lo que queda pendiente, que no es técnico sino tuyo: <b>qué mesa abrimos primero</b> y "
          "si querés que el salón siga anunciando las tres cerradas o muestre solo las abiertas.",
      ], colors.HexColor("#f2f5fb"), colors.HexColor("#b8c4d8"))]

doc.build(S)
print("listo:", SALIDA)
