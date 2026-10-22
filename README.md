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
| `custom:casa-futura-light-card` | A big brightness slider with white temperature, colors and the lights of a group, each with its own switch. |
| `custom:casa-futura-vacuum-card` | A robot vacuum with its map, battery, start / stop / dock / locate, your quick cleanings and the station sensors. |
| `custom:casa-futura-camera-card` | Camera snapshots in a strip or a grid, a badge when a person is seen, live video on tap. Light enough for old wall tablets. |

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
2. In **Settings → Dashboards → ⋮ → Resources** add `/local/casa-futura-cards.js?v=1.3.1` as a **JavaScript module**. When you update the file by hand, change the `?v=` number too: Home Assistant lets browsers cache files in `/local` for a long time.

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

## Light

![Light](https://raw.githubusercontent.com/ironblaster/casa-futura-cards/main/images/light.png)

```yaml
type: custom:casa-futura-light-card
entity: light.living_room
exclude:                     # optional: lights of the group you do not want listed
  - light.wall_switch
```

Drag the big slider to set the brightness (all the way down turns the light off). It is vertical on wide cards and turns horizontal when the card is narrow. White temperature and colors appear only when the light supports them. For a light group, every light of the group gets its own switch.

| Option | Default | Description |
| --- | --- | --- |
| `entity` | required | A `light.*` entity or light group. |
| `name`, `icon` | from the entity | |
| `show_temperature`, `show_colors`, `show_members` | `true` | Hide the sections you do not need. |
| `exclude` | | Lights of the group to hide. In YAML it can also be a regular expression, e.g. `"_effect_|wled"`. |
| `colors` | two whites and ten colors | Your own color buttons, e.g. `["#ff9a52", [95, 243, 255]]`. |
| `min_height` | | In pixels. |

## Vacuum

![Vacuum](https://raw.githubusercontent.com/ironblaster/casa-futura-cards/main/images/vacuum.png)

```yaml
type: custom:casa-futura-vacuum-card
entity: vacuum.first_floor
map: image.first_floor_map          # optional: a camera or image entity
battery: sensor.first_floor_battery # optional
room: sensor.first_floor_current_room
quick:
  - label: Clean the bathroom
    icon: mdi:shower-head
    action:
      action: perform-action
      perform_action: script.clean_bathroom
station:
  - entity: sensor.first_floor_dust_bag
    label: Dust bag
    icon: mdi:delete-variant
```

The map refreshes every 5 seconds while the robot cleans or returns, every minute otherwise. The battery ring turns amber below 50% and red below 20%. Start becomes Pause while cleaning, and the buttons your robot does not support are hidden. States are named in your language by Home Assistant and by the robot's integration.

| Option | Default | Description |
| --- | --- | --- |
| `entity` | required | A `vacuum.*` entity. |
| `name`, `icon` | from the entity | |
| `map` | | A `camera.*` or `image.*` entity with the map (Roborock, Dreame, Xiaomi Cloud Map Extractor, Valetudo…). |
| `battery` | the `battery_level` attribute | A battery sensor. Newer integrations have one instead of the attribute. |
| `status`, `room`, `area`, `time`, `error` | | Sensors shown under the state: detailed status, current room, cleaned area, cleaning time, error. The error shows only when there is one. |
| `show_controls` | `true` | Start / pause, stop, dock and locate buttons. |
| `quick` | | Buttons with `label`, `icon`, `color` and any Home Assistant `action`. |
| `station` | | Rows with `entity`, `label` and `icon` for tanks, dust bag and other dock sensors. |
| `min_height` | | In pixels. |

## Cameras

![Cameras](https://raw.githubusercontent.com/ironblaster/casa-futura-cards/main/images/camera.png)

```yaml
type: custom:casa-futura-camera-card
title: Cameras
layout: grid            # or strip
columns: 3
cameras:
  - entity: camera.garden
    occupancy: binary_sensor.garden_person_occupancy   # optional badge, e.g. from Frigate
  - entity: camera.garage
  - entity: camera.living_room
```

The card shows snapshots, not video streams, so a dozen cameras stay smooth even on an old Android tablet. Pictures are asked to Home Assistant at the size they are shown, loaded aside and swapped in without flashes, and they refresh only while the card is on screen and you are not scrolling. Tap a camera to watch it live in a window drawn by the card (Home Assistant's own player, WebRTC or HLS), with arrows to move to the other cameras.

| Option | Default | Description |
| --- | --- | --- |
| `cameras` | required | The list of cameras, see below. A plain list of entity ids works too. |
| `title`, `show_title` | | Title above the cameras. |
| `layout` | `strip` | `strip` scrolls sideways (with a finger, or by dragging with the mouse); `grid` shows all the cameras. |
| `columns` | `3` | Columns of the grid. |
| `tile_width` | `240` | Width of each camera in the strip, in pixels. |
| `refresh` | `10` | Seconds between two snapshots. |
| `snapshot_width` | `640` | Width of the pictures asked to Home Assistant. The live window uses twice as much. |
| `show_names` | `true` | Names over the pictures. |

Each camera: `entity`, `name`, `occupancy` (a sensor that shows the badge when it is on or above zero), `badge` (its text, default "Person"), `tap_action` (default: the live window; any standard action, e.g. `more-info` or `navigate`).

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
- [Casa Futura Cards](https://github.com/ironblaster/casa-futura-cards): gauge, alerts bell, action buttons with PIN, climate, light, vacuum and cameras.
- [Casa Futura Theme](https://github.com/ironblaster/casa-futura-theme): the dark liquid glass theme.
- [Casa Futura Kiosk](https://github.com/ironblaster/casa-futura-kiosk): status bar color, zoom and return home for wall tablets.

## License

[MIT](LICENSE) © 2026 ironblaster
