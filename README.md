# Booking.com Offer Copy Plugin

Browser extension that copies one Booking.com offer to clipboard in an Excel-ready row:

`=HYPERLINK("link","name")<TAB>lowest_price_for_all_guests<TAB>apartment_localization`

After copying, paste into Excel:
- column A = clickable hotel name
- column B = lowest price for a room that fits all selected guests
- column C = apartment localization
- for larger groups, the plugin can sum multiple rooms to fit everyone (lowest total)

The plugin automatically uses Polish Excel formula format (`HIPERŁĄCZE` with `;`) when browser language is Polish.

## Install (Chrome / Edge)

1. Open `chrome://extensions` (or `edge://extensions`)
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this folder: `booking-plugin`

## How to use

1. Open any Booking.com hotel/offer page (URL containing `/hotel/`)
2. The extension tries to copy automatically on page load
3. You can also click the floating **Copy for Excel** button
4. Paste directly into Excel

## Options (language switch)

1. Open `chrome://extensions`
2. Find **Booking.com Offer Copy for Excel**
3. Click **Details** -> **Extension options**
4. Set **Jezyk formuly Excel** to:
   - `Auto`
   - `Polski`
   - `English`
5. Save and refresh Booking.com tab

## Notes

- If clipboard permission is blocked, click anywhere on page and press **Copy for Excel** again.
- The extension copies one row at a time; open next offer and repeat.

## Code structure

- `content/core.js` - shared constants, state, and utility helpers
- `content/localization.js` - URL/location parsing and apartment localization extraction
- `content/rooms.js` - room/price/bed parsing and lowest-price matching logic
- `content/offer.js` - offer assembly and Excel row formatting
- `content.js` - bootstrap UI logic (copy button, toasts, startup, storage listeners)
