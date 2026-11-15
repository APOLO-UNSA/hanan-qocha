// Pantalla 4: comparador de estrategias de manejo de la finca (§4.4 del plan).
import type { Dataset } from '../data'
import { ESTADO_INFO } from '../model'
import { datosFinca, evaluar, type Escenario, type EstrategiaId, type Evaluacion, type Indicador, type Prioridades } from '../estrategias'
import { esc, pct } from '../ui'
import { IAC, LANG } from '../i18n'

const ES = {
  back: '← Mapa', ficha: 'Ficha de la cocha',
  kicker: 'Comparador de estrategias', titulo: (n: string) => `Finca de la ${n}`,
  intro: 'Tres maneras de manejar la finca para la próxima temporada, comparadas con datos NASA, el sensor Qocha Ñawi y el gemelo de la cocha.',
  cocha: 'Cocha de la finca', prioridades: 'Tus prioridades', escenario: 'Clima de la temporada', nasa: 'Datos NASA de la finca',
  niveles: ['poco', 'medio', 'mucho'], agua: 'Ahorrar agua', ingreso: 'Ingreso extra', suelo: 'Mejorar el suelo',
  lluvia: 'Lluvia', temp: 'Temperatura', normal: 'normal',
  smap: 'Humedad del suelo', gpm: 'Lluvia de la temporada', lst: 'Temperatura de superficie', ndvi: 'Vegetación (NDVI)', heladas: 'Noches con helada',
  grilla: 'Grilla común de 1 km agregada a la finca. SMAP (9 km) no distingue terrenos: el sensor en la orilla lo valida.',
  ind: { agua: 'Agua', suelo: 'Suelo y nitrógeno', ingreso: 'Ingreso' }, hip: 'hipótesis',
  mejor: 'Más alineada con tus prioridades', noRec: 'No recomendada para esta finca', puntaje: 'alineación',
  rotacion: 'Rotación (4 años)', cochaLane: 'Cocha', cosecha: (kg: string) => `cosecha proyectada: ${kg} kg de cushuro`,
  sinCosecha: 'sin cosecha proyectada', secciones: { por: 'Por qué se sugiere', ev: 'Evidencia', ben: 'Beneficios esperados', vac: 'Vacíos de información', rie: 'Riesgos' },
  aviso: 'Esta herramienta apoya la decisión; no reemplaza el criterio del productor ni de un experto agrícola. Las rotaciones y especies son un esquema por validar con productores de la zona.',
  nombres: { actual: 'Rotación actual', leguminosa: 'Con leguminosa', cushuro: 'Con cushuro' } as Record<EstrategiaId, string>,
  sub: { actual: 'Lo que la familia ya practica', leguminosa: 'Suma tarwi, que fija nitrógeno', cushuro: 'Suma el manejo de la cocha en lluvias' } as Record<EstrategiaId, string>,
  rot: { actual: ['Papa', 'Oca / olluco', 'Cebada', 'Descanso'], leguminosa: ['Papa', 'Tarwi', 'Oca / olluco', 'Descanso'], cushuro: ['Papa', 'Oca / olluco', 'Cebada', 'Descanso'] } as Record<EstrategiaId, string[]>,
}
type Txt = typeof ES
const EN: Txt = {
  back: '← Map', ficha: 'Pond page',
  kicker: 'Strategy comparison', titulo: (n) => `Farm of ${n}`,
  intro: 'Three ways to manage the farm next season, compared with NASA data, the Qocha Ñawi sensor and the pond twin.',
  cocha: 'Farm pond', prioridades: 'Your priorities', escenario: 'Season climate', nasa: 'Farm NASA data',
  niveles: ['low', 'medium', 'high'], agua: 'Save water', ingreso: 'Extra income', suelo: 'Improve soil',
  lluvia: 'Rainfall', temp: 'Temperature', normal: 'normal',
  smap: 'Soil moisture', gpm: 'Season rainfall', lst: 'Surface temperature', ndvi: 'Vegetation (NDVI)', heladas: 'Frost nights',
  grilla: 'Common 1 km grid aggregated to the farm. SMAP (9 km) cannot see single fields: the shore sensor validates it.',
  ind: { agua: 'Water', suelo: 'Soil & nitrogen', ingreso: 'Income' }, hip: 'hypothesis',
  mejor: 'Best match for your priorities', noRec: 'Not recommended for this farm', puntaje: 'match',
  rotacion: 'Rotation (4 years)', cochaLane: 'Pond', cosecha: (kg) => `projected harvest: ${kg} kg of cushuro`,
  sinCosecha: 'no projected harvest', secciones: { por: 'Why it is suggested', ev: 'Evidence', ben: 'Expected benefits', vac: 'Information gaps', rie: 'Risks' },
  aviso: 'This tool supports decisions; it does not replace the judgment of the farmer or an agricultural expert. Rotations and species are a scheme to be validated with local farmers.',
  nombres: { actual: 'Current rotation', leguminosa: 'With legume', cushuro: 'With cushuro' },
  sub: { actual: 'What the family already does', leguminosa: 'Adds tarwi, a nitrogen fixer', cushuro: 'Adds pond management in the rainy season' },
  rot: { actual: ['Potato', 'Oca / olluco', 'Barley', 'Fallow'], leguminosa: ['Potato', 'Tarwi', 'Oca / olluco', 'Fallow'], cushuro: ['Potato', 'Oca / olluco', 'Barley', 'Fallow'] },
}
const T: Txt = LANG === 'en' ? EN : ES

/** Textos de la ficha según la estrategia y la evidencia del momento. */
function ficha(id: EstrategiaId, ev: Evaluacion, iac: number, d: ReturnType<typeof datosFinca>): Record<keyof Txt['secciones'], string[]> {
  const en = LANG === 'en'
  const smapTxt = `SMAP ${d.smap} m³/m³`, gpmTxt = `GPM ${d.gpm} mm`
  if (id === 'actual')
    return {
      por: [en ? 'It is what the family already knows: the baseline to compare against.' : 'Es lo que la familia ya conoce: la base para comparar.'],
      ev: [`${smapTxt}, ${gpmTxt}`, `NDVI ${d.ndvi}`],
      ben: [en ? 'No new costs or learning' : 'Sin costos ni aprendizajes nuevos'],
      vac: [en ? 'Actual yield of each field' : 'Rendimiento real de cada terreno'],
      rie: [en ? 'Years of potato deplete soil nitrogen' : 'Años de papa agotan el nitrógeno del suelo', en ? 'Sensitive to drought' : 'Sensible a la sequía'],
    }
  if (id === 'leguminosa')
    return {
      por: [en ? 'A legume such as tarwi fixes nitrogen and covers the soil during the rotation.' : 'Una leguminosa como el tarwi fija nitrógeno y cubre el suelo en la rotación.'],
      ev: [en ? `Low cover in fallow (NDVI ${d.ndvi})` : `Cobertura baja en descanso (NDVI ${d.ndvi})`, en ? 'Literature on Andean lupin' : 'Literatura sobre tarwi andino'],
      ben: [en ? 'Nitrogen without fertilizer' : 'Nitrógeno sin fertilizante', en ? 'Better soil cover' : 'Mejor cobertura del suelo'],
      vac: [en ? 'Which species the community prefers' : 'Qué especie prefiere la comunidad', en ? 'Local grain market' : 'Mercado local del grano'],
      rie: [en ? `Frost at flowering (${d.heladas} frost nights)` : `Helada en floración (${d.heladas} noches con helada)`, en ? 'Debittering tarwi needs water' : 'Desamargar el tarwi requiere agua'],
    }
  return {
    por: [en ? `The farm has a pond with ${IAC} ${pct(iac)}: it can add income in the rainy season.` : `La finca tiene una cocha con ${IAC} ${pct(iac)}: puede sumar un ingreso en lluvias.`],
    ev: [`${IAC} ${pct(iac)} (${en ? 'satellite, sensor, camera' : 'satélite, sensor y cámara'})`, ev.cosechaKg ? T.cosecha(ev.cosechaKg.toFixed(1)) : T.sinCosecha],
    ben: [en ? 'Extra income Dec–Mar' : 'Ingreso extra de diciembre a marzo', en ? 'Iron-rich local food' : 'Alimento local rico en hierro'],
    vac: [en ? 'Whether cushuro improves neighboring soil is a hypothesis, not proven' : 'Si el cushuro mejora el suelo vecino es una hipótesis, no está probado'],
    rie: [en ? 'If the pond dries or warms, there is no harvest' : 'Si la cocha se seca o se calienta, no hay cosecha', en ? 'Overharvest: always leave 30 %' : 'Sobrecosecha: dejar siempre el 30 %'],
  }
}

function barra(nombre: string, i: Indicador, color: string): string {
  return `<div class="ind">
    <div class="ind-cab"><span>${nombre}</span><b>${Math.round(i.valor)}</b></div>
    <div class="ind-pista">
      <i class="ind-rango" style="left:${i.lo}%;width:${i.hi - i.lo}%"></i>
      <i class="ind-val" style="width:${i.valor}%;background:${color}"></i>
      ${i.hipotesis ? `<i class="ind-hip" style="left:${i.valor}%;width:${Math.min(i.hipotesis, 100 - i.valor)}%" title="${T.hip}"></i>` : ''}
    </div>
    ${i.hipotesis ? `<small class="ind-nota">+${i.hipotesis} ${T.hip}</small>` : ''}
  </div>`
}

export function renderFinca(root: HTMLElement, d: Dataset, id: string) {
  const site = d.sites.find((s) => s.cocha_id === id) ?? d.sites[0]
  if (!site) {
    root.innerHTML = `<section class="page"><p><a href="#/">${T.back}</a></p></section>`
    return
  }
  const esc_: Escenario = { lluvia: 0, temp: 0 }
  const pri: Prioridades = { agua: 1, ingreso: 1, suelo: 1 }

  root.innerHTML = `
    <section class="page finca intro">
      <a class="back" href="#/">${T.back}</a>
      <header class="hero hero-finca">
        <div>
          <p class="kicker">${T.kicker}</p>
          <h2>${T.titulo(esc(site.nombre))}</h2>
          <p class="hero-intro">${T.intro}</p>
        </div>
        <label class="sel-cocha"><span>${T.cocha}</span>
          <select id="sel-cocha">${d.sites.map((s) => `<option value="${esc(s.cocha_id)}"${s.cocha_id === site.cocha_id ? ' selected' : ''}>${esc(s.nombre)}</option>`).join('')}</select>
          <a href="#/cocha/${encodeURIComponent(site.cocha_id)}">${T.ficha} →</a>
        </label>
      </header>

      <div class="finca-grid">
        <aside class="finca-lado">
          <div class="card k-whatif">
            <h4>${T.prioridades}</h4>
            ${(['agua', 'ingreso', 'suelo'] as const).map((k) => `
              <div class="prio" data-k="${k}"><span>${T[k]}</span>
                <div class="seg">${T.niveles.map((n, v) => `<button type="button" data-v="${v}" class="${v === 1 ? 'on' : ''}">${n}</button>`).join('')}</div>
              </div>`).join('')}
          </div>
          <div class="card k-sensor">
            <h4>${T.escenario}</h4>
            <label class="esc"><span>${T.lluvia}<output id="o-lluvia"></output></span><input type="range" id="lluvia" min="-40" max="40" step="5" value="0" style="--a:0%;--b:0%;--c:100%;--d:100%"></label>
            <label class="esc"><span>${T.temp}<output id="o-temp"></output></span><input type="range" id="temp" min="0" max="3" step="0.5" value="0" style="--a:0%;--b:0%;--c:100%;--d:100%"></label>
          </div>
          <div class="card k-curva">
            <h4>${T.nasa}</h4>
            <dl class="nasa" id="nasa"></dl>
            <p class="nasa-nota">${T.grilla}</p>
          </div>
        </aside>
        <div class="estrategias" id="estrategias"></div>
      </div>
      <p class="aviso-decision">${T.aviso}</p>
    </section>`

  const $ = <E extends HTMLElement = HTMLElement>(s: string) => root.querySelector<E>(s)!
  const pintar = () => {
    const { evals, st } = evaluar(d, site, esc_, pri)
    const nasa = datosFinca(site, esc_)
    $('#o-lluvia').textContent = esc_.lluvia === 0 ? T.normal : `${esc_.lluvia > 0 ? '+' : ''}${Math.round(esc_.lluvia * 100)} %`
    $('#o-temp').textContent = `+${esc_.temp} °C`
    $('#nasa').innerHTML = [
      [T.smap, `${nasa.smap} m³/m³`, 'SMAP'],
      [T.gpm, `${nasa.gpm} mm`, 'GPM IMERG'],
      [T.lst, `${nasa.lst} °C`, 'ECOSTRESS · MODIS'.replace(' · ', ', ')],
      [T.ndvi, `${nasa.ndvi}`, 'Landsat, MODIS'],
      [T.heladas, `${nasa.heladas}`, 'MODIS LST'],
    ].map(([a, b, f]) => `<dt>${a}<small>${f}</small></dt><dd>${b}</dd>`).join('')
    const info = ESTADO_INFO[st.estado]
    const COL = { actual: '#635d6e', leguminosa: '#3b7a4c', cushuro: '#2c8c8f' } as const
    $('#estrategias').innerHTML = evals
      .map((ev, k) => {
        const f = ficha(ev.id, ev, st.iac, nasa)
        const top = k === 0 && ev.recomendada
        return `<article class="estr ${top ? 'top' : ''} ${ev.recomendada ? '' : 'no-rec'}" style="--k:${COL[ev.id]};--i:${k}">
          ${top ? `<p class="estr-badge">${T.mejor}</p>` : ''}
          ${!ev.recomendada ? `<p class="estr-badge mal">${T.noRec}</p>` : ''}
          <header class="estr-cab">
            <div><h3>${T.nombres[ev.id]}</h3><p>${T.sub[ev.id]}</p></div>
            <div class="estr-total"><b>${ev.recomendada ? ev.total : '—'}</b><span>${T.puntaje}</span></div>
          </header>
          <div class="rot"><span class="rot-t">${T.rotacion}</span>
            <ol>${T.rot[ev.id].map((c) => `<li>${c}</li>`).join('')}</ol>
            ${ev.id === 'cushuro' ? `<div class="rot-cocha" style="--c:${info.color}"><span>${T.cochaLane}</span><i>cushuro, dic–mar · ${IAC} ${pct(st.iac)}</i></div>`.replace(' · ', ', ') : ''}
          </div>
          ${barra(T.ind.agua, ev.agua, COL[ev.id])}
          ${barra(T.ind.suelo, ev.suelo, COL[ev.id])}
          ${barra(T.ind.ingreso, ev.ingreso, COL[ev.id])}
          <details class="estr-ficha"${top ? ' open' : ''}><summary>${T.secciones.por}</summary>
            ${(Object.keys(T.secciones) as (keyof Txt['secciones'])[]).map((s) => `<div class="fs fs-${s}"><h5>${T.secciones[s]}</h5><ul>${f[s].map((x) => `<li>${x}</li>`).join('')}</ul></div>`).join('')}
          </details>
        </article>`
      })
      .join('')
  }

  root.querySelectorAll<HTMLElement>('.prio').forEach((el) =>
    el.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-v]')
      if (!b) return
      el.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b))
      pri[el.dataset.k as keyof Prioridades] = Number(b.dataset.v)
      pintar()
    }),
  )
  $<HTMLInputElement>('#lluvia').addEventListener('input', (e) => ((esc_.lluvia = Number((e.target as HTMLInputElement).value) / 100), pintar()))
  $<HTMLInputElement>('#temp').addEventListener('input', (e) => ((esc_.temp = Number((e.target as HTMLInputElement).value)), pintar()))
  $<HTMLSelectElement>('#sel-cocha').addEventListener('change', (e) => (location.hash = `#/finca/${encodeURIComponent((e.target as HTMLSelectElement).value)}`))
  pintar()
  setTimeout(() => root.querySelector('.page')?.classList.remove('intro'), 2600)
}
