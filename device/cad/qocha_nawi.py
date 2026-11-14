"""Qocha Ñawi: estación flotante de referencia (modelo 3D paramétrico).

Genera device/cad/qocha_nawi.step. Es un diseño REFERENCIAL: forma y medidas
ilustrativas de device/DISENO_QOCHA_NAWI.md, no un plano de fabricación.

Requisitos:  pip install build123d
Uso:         python device/cad/qocha_nawi.py

Unidades: milímetros. Origen: centro del flotador, a la altura de la línea de
flotación. +Z hacia arriba (cielo), -Z hacia el fondo de la cocha.
"""
from pathlib import Path

from build123d import (
    Box, Color, Compound, Cylinder, Pos, Rot, Sphere, export_step,
)

# ---------- Medidas de referencia (mm) ----------
FLOTADOR_D, FLOTADOR_H = 300, 120      # flotador: ≈ 30 cm de diámetro
MASTIL_H, MASTIL_R = 800, 10           # mástil: ≈ 80 cm
SONDA_PROF = 150                       # sonda: ≈ 15 cm bajo el agua
PROF_COCHA = 400                       # profundidad supuesta de la cocha (0,4 m)
TOPE_FLOTADOR = FLOTADOR_H / 2         # z de la cara superior del flotador
TOPE_MASTIL = TOPE_FLOTADOR + MASTIL_H  # z de la punta del mástil


def parte(solido, nombre, color):
    solido.label = nombre
    solido.color = Color(color)
    return solido


partes = []

# ---------- Estructura ----------
partes.append(parte(
    Cylinder(FLOTADOR_D / 2, FLOTADOR_H),
    "Flotador", "orange"))

partes.append(parte(
    Pos(0, 0, TOPE_FLOTADOR + MASTIL_H / 2) * Cylinder(MASTIL_R, MASTIL_H),
    "Mastil", "gray"))

# Caja estanca con ESP32 y batería, junto al mástil, sobre el flotador.
CAJA = (110, 90, 70)
partes.append(parte(
    Pos(-85, 0, TOPE_FLOTADOR + CAJA[2] / 2) * Box(*CAJA),
    "Caja_estanca_ESP32_bateria", "white"))

# ---------- Energía y comunicación ----------
# Panel solar inclinado 20°, en la punta del mástil.
partes.append(parte(
    Pos(-30, 0, TOPE_MASTIL + 20) * Rot(Y=-20) * Box(220, 160, 6),
    "Panel_solar", "navy"))

# Antena LoRa sobre la caja.
partes.append(parte(
    Pos(-85, 0, TOPE_FLOTADOR + CAJA[2] + 90) * Cylinder(4, 180),
    "Antena_LoRa", "black"))

# ---------- Sensores aéreos ----------
# Sensor UV: brazo horizontal desde el mástil, mirando al cielo.
Z_UV = TOPE_MASTIL - 30
partes.append(parte(
    Pos(70, 0, Z_UV) * Rot(Y=90) * Cylinder(3, 140),
    "Brazo_UV", "gray"))
partes.append(parte(
    Pos(140, 0, Z_UV + 6) * Cylinder(9, 12),
    "Sensor_UV", "purple"))

# Cámara: brazo hacia +Y; el lente mira hacia el agua (-Z).
Z_CAM = TOPE_FLOTADOR + 600
partes.append(parte(
    Pos(0, 80, Z_CAM) * Rot(X=90) * Cylinder(3, 160),
    "Brazo_camara", "gray"))
partes.append(parte(
    Pos(0, 160, Z_CAM - 15) * Box(40, 40, 30),
    "Camara_ESP32CAM", "black"))
partes.append(parte(
    Pos(0, 160, Z_CAM - 37) * Cylinder(10, 14),
    "Lente_camara", "teal"))

# Sensor de nivel (ultrasónico): brazo hacia -Y, el cabezal mira al agua.
Z_NIVEL = TOPE_FLOTADOR + 150
partes.append(parte(
    Pos(0, -85, Z_NIVEL) * Rot(X=90) * Cylinder(3, 170),
    "Brazo_nivel", "gray"))
partes.append(parte(
    Pos(0, -170, Z_NIVEL - 13) * Cylinder(17, 26),
    "Sensor_nivel_ultrasonico", "gold"))

# ---------- Sensores sumergidos ----------
# Cable desde el fondo del flotador hasta la cabeza de la sonda.
Z_CABEZA = -SONDA_PROF + 20            # centro de la cabeza (≈ 15 cm bajo el agua)
partes.append(parte(
    Pos(0, 0, (-FLOTADOR_H / 2 + Z_CABEZA) / 2) * Cylinder(3, abs(-FLOTADOR_H / 2 - Z_CABEZA)),
    "Cable_sonda", "black"))
partes.append(parte(
    Pos(0, 0, Z_CABEZA) * Cylinder(25, 40),
    "Cabeza_sonda", "darkgray"))
# Tres puntas bajo la cabeza: TDS, temperatura y pH.
partes.append(parte(
    Pos(-14, 0, Z_CABEZA - 20 - 30) * Cylinder(8, 60),
    "Sonda_TDS", "steelblue"))
partes.append(parte(
    Pos(14, 8, Z_CABEZA - 20 - 25) * Cylinder(3, 50),
    "Sensor_temperatura_DS18B20", "silver"))
partes.append(parte(
    Pos(14, -8, Z_CABEZA - 20 - 35) * Cylinder(6, 70),
    "Sonda_pH", "limegreen"))

# ---------- Fondeo ----------
# Cuerda al ancla, apoyada en el fondo de la cocha (z = -PROF_COCHA).
ANCLA_H = 60
Z_ANCLA_TOPE = -PROF_COCHA + ANCLA_H
partes.append(parte(
    Pos(120, 0, (-FLOTADOR_H / 2 + Z_ANCLA_TOPE) / 2) * Cylinder(3, abs(-FLOTADOR_H / 2 - Z_ANCLA_TOPE)),
    "Cuerda_ancla", "brown"))
partes.append(parte(
    Pos(120, 0, -PROF_COCHA + ANCLA_H / 2) * Box(100, 100, ANCLA_H),
    "Ancla", "dimgray"))

# ---------- Humedad del suelo (en la orilla, fuera del flotador) ----------
# Estaca separada, unida a la caja por un cable que NO se modela.
X_ESTACA = 700
partes.append(parte(
    Pos(X_ESTACA, 0, 0) * Cylinder(8, 300),
    "Estaca_orilla", "saddlebrown"))
partes.append(parte(
    Pos(X_ESTACA, 0, -100) * Box(25, 3, 100),
    "Sensor_humedad_suelo", "green"))
partes.append(parte(
    Pos(X_ESTACA, 0, 150 + 7) * Sphere(14),
    "Remate_estaca", "saddlebrown"))

ensamble = Compound(children=partes, label="Qocha_Nawi")

if __name__ == "__main__":
    salida = Path(__file__).with_name("qocha_nawi.step")
    export_step(ensamble, str(salida))
    bb = ensamble.bounding_box()
    print(f"OK: {salida}  ({len(partes)} piezas)")
    print(f"Caja envolvente (mm): X {bb.min.X:.0f}..{bb.max.X:.0f}, "
          f"Y {bb.min.Y:.0f}..{bb.max.Y:.0f}, Z {bb.min.Z:.0f}..{bb.max.Z:.0f}")
