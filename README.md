<p align="center"><img src="https://raw.githubusercontent.com/ironblaster/casa-futura-cards/main/images/banner.png" alt="Casa Futura"></p>

# Casa Futura Cards

[![HACS Custom](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://hacs.xyz/docs/faq/custom_repositories)
[![GitHub release](https://img.shields.io/github/v/release/ironblaster/casa-futura-cards)](https://github.com/ironblaster/casa-futura-cards/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE) [![Sponsor](https://img.shields.io/badge/Sponsor-%E2%9D%A4-ff69b4)](https://github.com/sponsors/ironblaster)

Liquid glass cards for Home Assistant dashboards and wall tablets. Big, readable from a distance, and fully configurable from the visual editor.

![Casa Futura Cards](https://raw.githubusercontent.com/ironblaster/casa-futura-cards/main/images/cards.png)

| PIN with several choices | Alerts panel |
| --- | --- |
| ![PIN](https://raw.githubusercontent.com/ironblaster/casa-futura-cards/main/images/pin.png) | ![Alerts](https://raw.githubusercontent.com/ironblaster/casa-futura-cards/main/images/alerts.png) |

🇮🇹 [Leggi in italiano](README.it.md) · 🎨 Pairs well with the [Casa Futura theme](https://github.com/ironblaster/casa-futura-theme) · 🕐 and the [Glass Clock Weather Card](https://github.com/ironblaster/glass-clock-weather-card)

## The cards

| Card | What it does |
| --- | --- |
| `custom:casa-futura-gauge-card` | A big needle gauge for any sensor (power, temperature, humidity…) with green, yellow and red zones. |
| `custom:casa-futura-alerts-card` | Invisible on the dashboard: a glowing bell appears at the top right when something needs attention. Tap it to see the list. |
| `custom:casa-futura-action-card` | A button with optional confirmation, PIN and several choices, e.g. a door with Unlock / Open / Lock. |
| `custom:casa-futura-climate-card` | A thermostat dial for any climate entity: drag the ring or use − and +, with modes, fan speed, presets and swing. |

All of them:

- have a **visual editor** for every option;
- use the **standard Home Assistant actions** (more info, toggle, perform action, navigate…);
- do **not need browser_mod**: confirmation and PIN windows are drawn by the cards;
- are **translated** in English, Italian, German, French and Spanish;
- work in masonry, panel and sections views, also on old Android tablets.

## Installation

### HACS

1. In HACS open the menu (⋮) → **Custom repositories**.
2. Add `https://github.com/ironblaster/casa-futura-cards` with type **Dashboard**.
3. Install **Casa Futura Cards** and reload the browser.

### Manual

1. Download `casa-futura-cards.js` from the [latest release](https://github.com/ironblaster/casa-futura-cards/releases) into `config/www/`.
2. In **Settings → Dashboards → ⋮ → Resources** add `/local/casa-futura-cards.js?v=1.0.0` as a **JavaScript module**. When you update the file by hand, change the `?v=` number too: Home Assistant lets browsers cache files in `/local` for a long time.

## Gauge

```yaml
type: custom:casa-futura-gauge-card
entity: sensor.power
name: Power now
icon: mdi:flash
min: 0
max: 5500
yellow_from: 3500
red_from: 5000
```

| Option | Default | Description |
| --- | --- | --- |
| `entity` | required | A numeric sensor. |
| `name`, `icon` | friendly name | Shown above the gauge. |
| `show_name` | `true` | Without the name the gauge takes the whole card. |
| `min`, `max` | `0`, `100` | Range of the gauge. Values of 1000 W or more are shown in kW at the ends. |
| `yellow_from`, `red_from` | 60% and 85% of the range | Where the zones start. |
| `low_color`, `mid_color`, `high_color` | green, amber, red | Zone colors. |
| `needle` | `true` | Show the needle. |
| `unit`, `decimals` | from the sensor, `0` | |
| `min_height` | `200` | In pixels. In a sections view the grid sets the height. |

## Alerts bell

```yaml
type: custom:casa-futura-alerts-card
alerts:
  - entity: binary_sensor.mailbox
    text: You have mail
    icon: mdi:mailbox
    color: [255, 198, 92]
  - entity: lock.garage
    condition: equals
    value: unlocked
    text: Garage door unlocked
    icon: mdi:lock-open-variant
    color: [255, 107, 125]
  - entity: climate.heating
    condition: not_equals
    value: "off"
    text: Heating on
    icon: mdi:radiator
    attribute: temperature
    suffix: °
```

The card itself takes no space: you see it only while editing the dashboard. Put it in every view where you want the bell. The first active alert gives its color to the bell; tap an alert to run its action (by default the more-info dialog of its entity). Close the panel with ✕, by tapping outside or by swiping it to the right.

| Option | Default | Description |
| --- | --- | --- |
| `alerts` | | The list of alerts, see below. |
| `title` | `Alerts` (translated) | Title of the panel. |
| `bell_top`, `bell_right` | `14`, `16` | Position of the bell, in pixels from the top right corner. |
| `bell_size` | `52` | In pixels. |

Each alert: `entity`, `condition` (`on`, `equals`, `not_equals`, `above`, `below`), `value` (for every condition but `on`; several values separated by commas), `text`, `icon`, `color`, `attribute` and `suffix` (a value to show under the text), `tap_action`.

`on` means the entity is on, open, unlocked or active in any way.

## Action button

```yaml
type: custom:casa-futura-action-card
entity: lock.front_door
name: Front door
pin: "1234"          # the editor saves only a fingerprint of it
choices:
  - label: Unlock
    icon: mdi:lock-open-variant
    color: [255, 198, 92]
    when: locked
    action:
      action: perform-action
      perform_action: lock.unlock
      target:
        entity_id: lock.front_door
  - label: Lock
    icon: mdi:lock
    color: [92, 242, 166]
    when: unlocked
    action:
      action: perform-action
      perform_action: lock.lock
      target:
        entity_id: lock.front_door
```

- **No choices, no confirmation, no PIN**: the tap action runs at once (default: toggle).
- **`confirm: true`**: a window asks for confirmation before running the tap action.
- **`choices`**: a window lets you pick one; `when` highlights the choice that fits the current state.
- **PIN**: a keypad appears in the window. After 5 wrong attempts it waits 30 seconds.

| Option | Default | Description |
| --- | --- | --- |
| `entity` | | Optional: gives the state under the name and the glow when active. |
| `name`, `icon`, `label` | from the entity | `label` replaces the state under the name. |
| `color` | cyan | Glow when the entity is active. |
| `confirm`, `confirm_text` | `false` | Ask before running. |
| `pin` | | Digits. The visual editor stores only `pin_hash`, a fingerprint. |
| `choices` | | Each with `label`, `icon`, `color`, `when` and `action`. |
| `tap_action` | toggle | Used when there are no choices. |
| `hold_action` | more info | |
| `min_height` | `120` | In pixels. |

> The PIN keeps curious hands away from a wall tablet. It is not real security: anyone who can edit the dashboard can change it.

## Climate

![Climate](https://raw.githubusercontent.com/ironblaster/casa-futura-cards/main/images/climate.png)

```yaml
type: custom:casa-futura-climate-card
entity: climate.bedroom
temperature_entity: sensor.bedroom_temperature   # optional
humidity_entity: sensor.bedroom_humidity         # optional
```

Drag the ring to choose the temperature, or use − and +: the new value is sent after a short pause, so several taps make one call. The ring and the active mode take the color of the mode (orange heat, blue cool, green auto, cyan dry, violet fan). Modes, fan speeds, presets and swing come from your device and are named in your language by Home Assistant.

| Option | Default | Description |
| --- | --- | --- |
| `entity` | required | A `climate.*` entity. |
| `name`, `icon` | from the entity | |
| `temperature_entity`, `humidity_entity` | | Room sensors to show instead of the ones of the device. |
| `show_modes`, `show_fan`, `show_presets`, `show_swing` | `true` | Hide the sections you do not need. |

## Appearance (all cards)

| Option | Default | Description |
| --- | --- | --- |
| `font` | `space_grotesk` | `space_grotesk` (loaded from Google Fonts), `theme` or `custom`. |
| `font_family` | | With `font: custom`. |
| `glass` | `true` | Glass background. Off: the normal card background of your theme. |
| `border_radius` | `28` | In pixels. |
| `text_color` | white | |

Colors can be written as `[r, g, b]`, `"#rrggbb"` or `"r, g, b"`.

## Development

One JavaScript file, no build step and no dependencies. Serve the folder (`python3 -m http.server`) and open `demo/index.html`.

## Support

If Casa Futura makes your home a little nicer, you can [sponsor the project on GitHub](https://github.com/sponsors/ironblaster). Thank you!

## The Casa Futura family

- [Glass Clock Weather Card](https://github.com/ironblaster/glass-clock-weather-card): a big clock with animated weather.
- [Casa Futura Cards](https://github.com/ironblaster/casa-futura-cards): gauge, alerts bell and action buttons with PIN.
- [Casa Futura Theme](https://github.com/ironblaster/casa-futura-theme): the dark liquid glass theme.

## License

[MIT](LICENSE) © 2026 ironblaster
