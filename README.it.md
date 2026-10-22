<p align="center"><img src="https://raw.githubusercontent.com/ironblaster/casa-futura-cards/main/images/banner.png" alt="Casa Futura"></p>

# Casa Futura Cards

[![HACS Custom](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://hacs.xyz/docs/faq/custom_repositories)
[![Licenza: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE) [![Sponsor](https://img.shields.io/badge/Sponsor-%E2%9D%A4-ff69b4)](https://github.com/sponsors/ironblaster)

Card in stile vetro per le dashboard di Home Assistant e i tablet a muro: grandi, leggibili da lontano e configurabili tutte dall'editor visuale.

![Casa Futura Cards](https://raw.githubusercontent.com/ironblaster/casa-futura-cards/main/images/cards.png)

🇬🇧 [Read in English](README.md) · 🎨 Si abbina al [tema Casa Futura](https://github.com/ironblaster/casa-futura-theme) · 🕐 e alla [Glass Clock Weather Card](https://github.com/ironblaster/glass-clock-weather-card)

## Le card

| Card | Cosa fa |
| --- | --- |
| `custom:casa-futura-gauge-card` | Un grande quadrante con lancetta per qualsiasi sensore (consumo, temperatura, umidità…) con zone verde, gialla e rossa. |
| `custom:casa-futura-alerts-card` | Non si vede sulla dashboard: quando c'è qualcosa da segnalare compare una campanella luminosa in alto a destra. Toccandola si apre l'elenco degli avvisi. |
| `custom:casa-futura-action-card` | Un pulsante con conferma, PIN e più scelte facoltativi, per esempio una porta con Sblocca / Apri / Blocca. |
| `custom:casa-futura-climate-card` | Una ghiera per qualsiasi condizionatore o termostato: si trascina l'anello o si usano − e +, con modalità, ventola, preset e oscillazione. |
| `custom:casa-futura-light-card` | Un grande cursore per la luminosità, con temperatura del bianco, colori e le luci di un gruppo, ognuna con il suo interruttore. |
| `custom:casa-futura-vacuum-card` | Il robot aspirapolvere con mappa, batteria, avvia / stop / base / trova, le tue pulizie rapide e i sensori della stazione. |

Tutte hanno l'editor visuale per ogni opzione, usano le azioni standard di Home Assistant, **non richiedono browser_mod** (le finestre di conferma e PIN le disegnano le card) e sono tradotte in italiano, inglese, tedesco, francese e spagnolo.

## Installazione

### HACS

1. In HACS apri il menu (⋮) → **Repository personalizzati**.
2. Aggiungi `https://github.com/ironblaster/casa-futura-cards` con tipo **Dashboard**.
3. Installa **Casa Futura Cards** e ricarica il browser.

### A mano

1. Scarica `casa-futura-cards.js` dall'[ultima versione](https://github.com/ironblaster/casa-futura-cards/releases) e copialo in `config/www/`.
2. In **Impostazioni → Plance → ⋮ → Risorse** aggiungi `/local/casa-futura-cards.js?v=1.2.0` come **modulo JavaScript**. Quando aggiorni il file a mano cambia anche il numero dopo `?v=`, perché Home Assistant lascia i file di `/local` a lungo nella cache del browser.

## Esempio: robot con mappa e pulizie rapide

![Robot](https://raw.githubusercontent.com/ironblaster/casa-futura-cards/main/images/vacuum.png)

```yaml
type: custom:casa-futura-vacuum-card
entity: vacuum.primo_piano
map: image.primo_piano_mappa        # facoltativa: entità camera o immagine
battery: sensor.primo_piano_batteria
room: sensor.primo_piano_stanza_attuale
quick:
  - label: Pulisci bagno
    icon: mdi:shower-head
    action:
      action: perform-action
      perform_action: script.pulisci_bagno
station:
  - entity: sensor.primo_piano_sacchetto_polvere
    label: Sacchetto polvere
    icon: mdi:delete-variant
```

La mappa si aggiorna ogni 5 secondi mentre il robot pulisce, ogni minuto altrimenti. I pulsanti che il robot non supporta non compaiono. Tutte le opzioni sono nel [README in inglese](README.md#vacuum) e nell'editor visuale.

## Esempio: luce con gruppo

![Luce](https://raw.githubusercontent.com/ironblaster/casa-futura-cards/main/images/light.png)

```yaml
type: custom:casa-futura-light-card
entity: light.faretti_soggiorno
exclude:                       # facoltativo: luci del gruppo da non mostrare
  - light.placchetta_soggiorno
```

Il cursore è verticale sulle card larghe e diventa orizzontale quando la card è stretta; portandolo in fondo la luce si spegne. Temperatura del bianco e colori compaiono solo se la luce li supporta.

## Esempio: porta con PIN e tre scelte

```yaml
type: custom:casa-futura-action-card
entity: lock.porta_ingresso
name: Porta d'ingresso
pin: "1234"          # l'editor salva solo un'impronta del PIN
choices:
  - label: Sblocca
    icon: mdi:lock-open-variant
    when: locked
    action:
      action: perform-action
      perform_action: lock.unlock
      target:
        entity_id: lock.porta_ingresso
  - label: Apri
    icon: mdi:door-open
    when: locked
    action:
      action: perform-action
      perform_action: lock.open
      target:
        entity_id: lock.porta_ingresso
  - label: Blocca
    icon: mdi:lock
    when: unlocked
    action:
      action: perform-action
      perform_action: lock.lock
      target:
        entity_id: lock.porta_ingresso
```

Il PIN tiene lontani i curiosi da un tablet a muro, ma non è una vera sicurezza: chi può modificare la dashboard può cambiarlo.

Tutte le opzioni di ogni card, con valori ed esempi, sono nel [README in inglese](README.md): i nomi delle opzioni sono gli stessi.

## Sostieni il progetto

Se Casa Futura ti piace, puoi [sostenere il progetto su GitHub Sponsors](https://github.com/sponsors/ironblaster). Grazie!

## La famiglia Casa Futura

- [Glass Clock Weather Card](https://github.com/ironblaster/glass-clock-weather-card): un orologio grande con il meteo animato.
- [Casa Futura Cards](https://github.com/ironblaster/casa-futura-cards): quadrante, campanella degli avvisi e pulsanti con PIN.
- [Casa Futura Theme](https://github.com/ironblaster/casa-futura-theme): il tema scuro in stile vetro.

## Licenza

[MIT](LICENSE) © 2026 ironblaster
