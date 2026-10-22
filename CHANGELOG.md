# Changelog

## 1.3.1

- The windows of the cards and the alerts panel close on the `casa-futura-close` event, so [Casa Futura Kiosk](https://github.com/ironblaster/casa-futura-kiosk) can close them before going back home.

## 1.3.0

- New `casa-futura-camera-card`: camera snapshots in a strip or a grid that refresh only while on screen, a badge from any sensor (e.g. a person seen by Frigate), and live video on tap in a window drawn by the card, with arrows to move between cameras.

## 1.2.0

- New `casa-futura-light-card`: a big brightness slider (vertical, horizontal on narrow cards) with white temperature, colors and the lights of a group, each with its own switch.
- New `casa-futura-vacuum-card`: map from a camera or image entity, battery ring, start / pause / stop / dock / locate (only the ones the robot supports), quick cleanings with any action, and the station sensors.
- Editors can now show more than one list of items.

## 1.1.0

- New `casa-futura-climate-card`: a thermostat dial with modes, fan speed, presets and swing, labels translated by Home Assistant.

## 1.0.0

First release with three cards:

- `casa-futura-gauge-card`: a big needle gauge for any sensor, with colored zones.
- `casa-futura-alerts-card`: a floating bell with a side panel listing the alerts.
- `casa-futura-action-card`: a button with optional confirmation, PIN and several choices.

Visual editor for every option. Translations: English, Italian, German, French, Spanish.
