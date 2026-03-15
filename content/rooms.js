(function initBookingExcelCopyRooms() {
  const namespace = window.BookingExcelCopy || {};
  const utils = namespace.utils || {};

  const parsePositiveInt = utils.parsePositiveInt;
  const extractFirstPositiveInt = utils.extractFirstPositiveInt;
  const debugLog = utils.debugLog;

  function parseCapacityFromNode(node) {
    const readCapacityFromFltrs = (rowNode) => {
      const raw = rowNode ? rowNode.getAttribute("data-fltrs") : "";
      if (!raw) {
        return 0;
      }
      try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") {
          return 0;
        }
        const occupancy = parsed.occupancy_count;
        if (!occupancy || typeof occupancy !== "object") {
          return 0;
        }
        return parsePositiveInt(occupancy.max_adults);
      } catch (_error) {
        return 0;
      }
    };
    const readCapacityFromOccupancyIcons = (rootNode) => {
      if (!rootNode) {
        return 0;
      }
      const occupancyRoot = rootNode.querySelector(".c-occupancy-icons__adults");
      if (!occupancyRoot) {
        return 0;
      }

      const multiplierNode = occupancyRoot.querySelector(".c-occupancy-icons__multiplier-number");
      const multiplierValue = parsePositiveInt(multiplierNode ? multiplierNode.textContent : "");
      if (multiplierValue > 0) {
        return multiplierValue;
      }

      const iconCount = occupancyRoot.querySelectorAll("i.bicon-occupancy").length;
      if (iconCount > 0) {
        return iconCount;
      }

      return 0;
    };

    if (!node) {
      return 0;
    }

    const rowNode = node.closest("tr[data-block-id]") || node.closest("tr");
    const rowCapacity = readCapacityFromFltrs(rowNode);
    if (rowCapacity > 0) {
      return rowCapacity;
    }
    const occupancyCapacity = readCapacityFromOccupancyIcons(rowNode || node);
    if (occupancyCapacity > 0) {
      return occupancyCapacity;
    }

    const attributeNames = [
      "max_adults",
      "data-max-adults",
      "data-max_adults",
      "data-max-occupancy",
      "data-capacity"
    ];

    const roots = [node, rowNode].filter(Boolean);
    for (const root of roots) {
      for (const attributeName of attributeNames) {
        const value = root.getAttribute(attributeName);
        const parsed = parsePositiveInt(value);
        if (parsed > 0) {
          return parsed;
        }
      }
    }

    const nestedCapacityNodes = [];
    for (const root of roots) {
      const nestedNode = root.querySelector(
        "[max_adults], [data-max-adults], [data-max_adults], [data-max-occupancy], [data-capacity]"
      );
      if (nestedNode) {
        nestedCapacityNodes.push(nestedNode);
      }
    }
    for (const nestedCapacityNode of nestedCapacityNodes) {
      for (const attributeName of attributeNames) {
        const value = nestedCapacityNode.getAttribute(attributeName);
        const parsed = parsePositiveInt(value);
        if (parsed > 0) {
          return parsed;
        }
      }
    }

    return 0;
  }

  function extractPriceValue(text) {
    if (!text) {
      return null;
    }

    const compact = text.replace(/\u00a0/g, " ").trim();
    let bestChunk = "";
    let currentChunk = "";
    const flushChunk = () => {
      if (!currentChunk) {
        return;
      }
      const hasDigit = Array.from(currentChunk).some((ch) => ch >= "0" && ch <= "9");
      if (hasDigit && currentChunk.length > bestChunk.length) {
        bestChunk = currentChunk;
      }
      currentChunk = "";
    };

    for (const ch of compact) {
      const isDigit = ch >= "0" && ch <= "9";
      const isSeparator = ch === " " || ch === "." || ch === "," || ch === "'";
      if (isDigit || isSeparator) {
        currentChunk += ch;
      } else {
        flushChunk();
      }
    }
    flushChunk();

    if (!bestChunk) {
      return null;
    }

    const numericChunk = Array.from(bestChunk).filter((ch) => {
      const isDigit = ch >= "0" && ch <= "9";
      return isDigit || ch === "." || ch === "," || ch === "'";
    }).join("");
    if (!numericChunk) {
      return null;
    }

    const lastComma = numericChunk.lastIndexOf(",");
    const lastDot = numericChunk.lastIndexOf(".");
    const decimalSep = lastComma > lastDot ? "," : ".";
    const normalized = Array.from(numericChunk).filter((ch, idx) => {
      if (ch >= "0" && ch <= "9") {
        return true;
      }
      if (ch === "'" || ch === " ") {
        return false;
      }
      if (ch === "." || ch === ",") {
        return idx === (decimalSep === "," ? lastComma : lastDot);
      }
      return false;
    }).join("").replace(",", ".");
    const value = Number.parseFloat(normalized);
    return Number.isFinite(value) ? value : null;
  }

  function detectCurrencyToken(text) {
    if (!text) {
      return "";
    }
    const match = text.match(/\b(PLN|EUR|USD|GBP|CHF)\b|zł|€|\$|£/i);
    return match ? match[0] : "";
  }

  function extractPriceText(node) {
    if (!node) {
      return "";
    }

    const normalizeText = (value) => (value || "").replace(/\s+/g, " ").trim();
    const rowNode = node.closest("tr[data-block-id]") || node.closest("tr");
    if (rowNode) {
      const roomSelect = rowNode.querySelector('select[data-testid="select-room-trigger"]');
      if (roomSelect) {
        const oneRoomOption = Array.from(roomSelect.options).find((option) => parsePositiveInt(option.value) === 1);
        const firstPaidOption = oneRoomOption || Array.from(roomSelect.options).find((option) => parsePositiveInt(option.value) > 0);
        if (firstPaidOption) {
          const optionText = normalizeText(firstPaidOption.textContent || "");
          const bracketMatch = optionText.match(/\(([^)]+)\)/);
          const optionPriceText = normalizeText(bracketMatch ? bracketMatch[1] : optionText);
          if (extractPriceValue(optionPriceText) !== null) {
            return optionPriceText;
          }
        }
      }

      const currentPriceNode = rowNode.querySelector(".bui-price-display__value .prco-valign-middle-helper");
      const currentPriceText = normalizeText(currentPriceNode ? currentPriceNode.textContent : "");
      if (extractPriceValue(currentPriceText) !== null) {
        return currentPriceText;
      }
    }

    const selectors = [
      '[data-testid="price-for-x-nights"]',
      '[data-testid*="price"]',
      '[aria-label*="price" i]',
      '[aria-label*="cena" i]',
      "[data-price]"
    ];

    for (const selector of selectors) {
      const priceNode = node.querySelector(selector);
      if (priceNode && priceNode.textContent) {
        const text = normalizeText(
          priceNode.getAttribute("aria-label")
          || priceNode.getAttribute("data-price")
          || priceNode.textContent
        );
        if (extractPriceValue(text) !== null) {
          return text;
        }
      }
    }

    if (rowNode) {
      const roundedPrice = parsePositiveInt(rowNode.getAttribute("data-hotel-rounded-price"));
      if (roundedPrice > 0) {
        const rowText = normalizeText(rowNode.textContent);
        const currency = detectCurrencyToken(rowText);
        return currency ? `${roundedPrice} ${currency}` : String(roundedPrice);
      }
    }

    const rawText = node.textContent ? node.textContent.replace(/\s+/g, " ").trim() : "";
    const value = extractPriceValue(rawText);
    if (value === null) {
      return "";
    }
    return String(value);
  }

  function normalizeCancellationText(value) {
    return String(value || "")
      .replace(/\u00a0/g, " ")
      .toLowerCase()
      .replace(/ł/g, "l")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function hasFreeCancellation(text) {
    const normalized = normalizeCancellationText(text);
    if (!normalized) {
      return false;
    }

    const freePatterns = [
      /free cancellation/i,
      /free[_\s-]?cancellation/i,
      /bezplatn(?:e|y|a)\s+odwolan/i,
      /odwolaj\s+bez\s+oplat/i,
      /moz(?:esz|na)\s+bezplatnie\s+odwolac/i,
      /w\spelni\s+refundowaln/i,
      /fully\s+refundable/i
    ];
    return freePatterns.some((pattern) => pattern.test(normalized));
  }

  function hasNonRefundablePolicy(text) {
    const normalized = normalizeCancellationText(text);
    if (!normalized) {
      return false;
    }
    const nonRefundablePatterns = [
      /non[-\s]?refundable/i,
      /bezzwrotn/i,
      /brak\s+zwrot/i,
      /cannot\s+cancel/i,
      /no\s+refund/i
    ];
    return nonRefundablePatterns.some((pattern) => pattern.test(normalized));
  }

  function extractFreeCancellationFromNode(node) {
    if (!node) {
      return false;
    }

    const rowNode = node.closest("tr[data-block-id]") || node.closest("tr");
    const roots = [rowNode, node].filter(Boolean);
    const textChunks = [];
    const pushText = (value) => {
      const normalized = String(value || "").replace(/\s+/g, " ").trim();
      if (normalized) {
        textChunks.push(normalized);
      }
    };

    for (const root of roots) {
      pushText(root.textContent);
      const policyNodes = root.querySelectorAll(
        '[data-testid*="cancellation"], [data-testid*="refund"], [class*="cancellation"], [class*="refund"]'
      );
      for (const policyNode of policyNodes) {
        pushText(policyNode.textContent);
        pushText(policyNode.getAttribute("aria-label"));
        pushText(policyNode.getAttribute("title"));
        pushText(policyNode.getAttribute("data-testid"));
      }
    }

    const aggregatedText = textChunks.join(" | ");
    if (hasFreeCancellation(aggregatedText)) {
      return true;
    }
    if (hasNonRefundablePolicy(aggregatedText)) {
      return false;
    }
    return false;
  }

  function collectRoomCandidates() {
    const containerSelectors = [
      '[data-testid*="room-grid"] [data-testid*="room-item"]',
      '[data-testid*="room-card"]',
      '[data-testid*="room-item"]',
      "tr[data-block-id]",
      'select[data-testid="select-room-trigger"][data-block-id]',
      "[data-room-id][data-block-id]"
    ];
    const results = [];
    const seen = new Set();

    for (const selector of containerSelectors) {
      const nodes = document.querySelectorAll(selector);
      for (const node of nodes) {
        const candidate = node.matches("select[data-block-id]") ? node.closest("tr[data-block-id]") : node;
        if (!candidate || seen.has(candidate)) {
          continue;
        }
        seen.add(candidate);
        results.push(candidate);
      }
    }

    return results;
  }

  function parseRoomAvailabilityFromNode(node) {
    if (!node) {
      return 0;
    }

    const rowNode = node.closest("tr[data-block-id]") || node.closest("tr");
    const roomSelect = (rowNode || node).querySelector('select[data-testid="select-room-trigger"][name^="nr_rooms_"]');
    if (roomSelect) {
      let maxOption = 0;
      for (const option of roomSelect.options) {
        const parsed = parsePositiveInt(option.value);
        if (parsed > maxOption) {
          maxOption = parsed;
        }
      }
      if (maxOption > 0) {
        return maxOption;
      }
    }

    const scarcitySources = [
      rowNode ? rowNode.querySelector("th[scope='row']") : null,
      rowNode,
      node
    ].filter(Boolean);
    for (const sourceNode of scarcitySources) {
      const text = (sourceNode.textContent || "").replace(/\s+/g, " ").trim();
      if (!text) {
        continue;
      }
      const scarcityLine = text
        .split(/[.!?]/)
        .map((part) => part.trim())
        .find((part) => /(zosta|left|remaining|availability)/i.test(part));
      if (!scarcityLine) {
        continue;
      }
      const scarcityCount = extractFirstPositiveInt(scarcityLine);
      if (scarcityCount > 0) {
        return scarcityCount;
      }
    }
    return 0;
  }

  function formatPriceWithCurrency(value, currencyToken) {
    if (!Number.isFinite(value)) {
      return "";
    }
    const rounded = Math.round(value * 100) / 100;
    const formatted = new Intl.NumberFormat(navigator.language || "en-US", {
      minimumFractionDigits: Number.isInteger(rounded) ? 0 : 2,
      maximumFractionDigits: 2
    }).format(rounded);
    return currencyToken ? `${formatted} ${currencyToken}` : formatted;
  }

  function normalizeBedLabel(rawType) {
    const key = (rawType || "").toLowerCase().replace(/\s+/g, " ").trim();
    const aliases = {
      "double": "double bed",
      "double bed": "double bed",
      "podwojne": "double bed",
      "podwójne": "double bed",
      "łóżko podwójne": "double bed",
      "lozko podwojne": "double bed",
      "large double": "double bed",
      "large double bed": "double bed",
      "duze lozko podwojne": "double bed",
      "duże łóżko podwójne": "double bed",
      "extra large double": "double bed",
      "extra-large double": "double bed",
      "extra large double bed": "double bed",
      "bardzo duze lozko podwojne": "double bed",
      "bardzo duże łóżko podwójne": "double bed",
      "single": "single bed",
      "single bed": "single bed",
      "pojedyncze": "single bed",
      "pojedynczy": "single bed",
      "łóżko pojedyncze": "single bed",
      "lozko pojedyncze": "single bed",
      "twin": "single bed",
      "twin bed": "single bed",
      "king": "king bed",
      "king bed": "king bed",
      "queen": "queen bed",
      "queen bed": "queen bed",
      "sofa": "sofa",
      "sofa bed": "sofa",
      "rozkładana sofa": "sofa",
      "rozkładana sofa bed": "sofa",
      "bunk": "bunk bed",
      "bunk bed": "bunk bed",
      "łóżko piętrowe": "bunk bed",
      "lozko pietrowe": "bunk bed",
      "łóżka pojedyncze": "single bed",
      "lozka pojedyncze": "single bed",
      "pietrowe": "bunk bed",
      "piętrowe": "bunk bed",
      "futon": "futon"
    };
    return aliases[key] || key;
  }

  function formatBedLabelWithQuantity(label, quantity) {
    if (!label) {
      return "";
    }
    if (!Number.isFinite(quantity) || quantity <= 1) {
      return label;
    }
    const pluralMap = {
      "single bed": "single beds",
      "double bed": "double beds",
      "queen bed": "queen beds",
      "king bed": "king beds",
      "bunk bed": "bunk beds",
      "sofa": "sofas",
      "futon": "futons"
    };
    return pluralMap[label] || `${label}s`;
  }

  function mergeBedConfigurations(configurations) {
    const parts = [];
    for (const configuration of configurations) {
      const normalized = String(configuration || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
      if (normalized) {
        parts.push(normalized);
      }
    }
    return parts.join(" + ");
  }

  function extractBedConfiguration(node) {
    if (!node) {
      return "";
    }
    const rowNode = node.closest("tr[data-block-id]") || node.closest("tr");
    const roomSelect = (rowNode || node).querySelector('select[data-testid="select-room-trigger"][aria-describedby]');
    const describedBy = roomSelect ? roomSelect.getAttribute("aria-describedby") : "";
    const roomAnchorFromSelect = describedBy ? document.getElementById(describedBy) : null;
    const roomIdNode = node.querySelector("[data-room-id]") || (rowNode ? rowNode.querySelector("[data-room-id]") : null);
    const roomId = roomIdNode ? roomIdNode.getAttribute("data-room-id") : "";
    const roomAnchorFromRoomId = roomId ? document.getElementById(`room_type_id_${roomId}`) : null;
    const roomAnchor = roomAnchorFromSelect || roomAnchorFromRoomId;
    const roomTypeCell = roomAnchor
      ? roomAnchor.closest("th[scope='row']")
      : rowNode
        ? rowNode.querySelector("th[scope='row']")
        : null;

    const normalizeText = (value) => String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
    const bedLines = [];
    const seen = new Set();
    const registerBedLine = (line) => {
      const normalized = normalizeText(line);
      if (!normalized || seen.has(normalized)) {
        return;
      }
      seen.add(normalized);
      bedLines.push(normalized);
    };
    const roots = [roomTypeCell, rowNode, node].filter(Boolean);
    for (const root of roots) {
      const bedroomItems = root.querySelectorAll("li.bedroom_bed_type");
      for (const bedroomItem of bedroomItems) {
        const label = normalizeText((bedroomItem.querySelector("strong") || {}).textContent || "").replace(/:\s*$/, "");
        const value = normalizeText((bedroomItem.querySelector("span") || {}).textContent || "");
        if (label && value) {
          registerBedLine(`${label}: ${value}`);
          continue;
        }
        registerBedLine(value || label);
      }
    }

    return bedLines.join(" + ");
  }

  function extractApartmentType(node) {
    if (!node) {
      return "";
    }

    const normalize = (value) => (value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
    const rowNode = node.closest("tr[data-block-id]") || node.closest("tr");
    const roomIdNode = node.querySelector("[data-room-id]") || (rowNode ? rowNode.querySelector("[data-room-id]") : null);
    const roomId = roomIdNode ? roomIdNode.getAttribute("data-room-id") : "";
    const roomLinkById = roomId ? document.getElementById(`room_type_id_${roomId}`) : null;

    const roomSelect = (rowNode || node).querySelector('select[data-testid="select-room-trigger"][aria-describedby]');
    const describedBy = roomSelect ? roomSelect.getAttribute("aria-describedby") : "";
    const roomLinkByDescribedBy = describedBy ? document.getElementById(describedBy) : null;

    const roomLink = roomLinkById || roomLinkByDescribedBy || (rowNode ? rowNode.querySelector(".hprt-roomtype-link") : null);
    const roomTypeContainer = roomLink ? roomLink.closest(".hprt-roomtype-block") : null;
    const roomTypeNode = roomTypeContainer
      ? roomTypeContainer.querySelector(".hprt-roomtype-icon-link")
      : roomLink;

    const roomTypeText = normalize(roomTypeNode ? roomTypeNode.textContent : "");
    if (roomTypeText) {
      return roomTypeText;
    }

    return normalize(roomLink ? roomLink.textContent : "");
  }

  function findLowestMatchingPrice(requiredGuests) {
    const rooms = collectRoomCandidates();
    const offers = [];
    const dedupe = new Map();
    let bestAny = null;

    for (let roomIndex = 0; roomIndex < rooms.length; roomIndex += 1) {
      const room = rooms[roomIndex];
      const text = room.textContent ? room.textContent.replace(/\s+/g, " ").trim() : "";
      const capacity = parseCapacityFromNode(room);
      const availability = parseRoomAvailabilityFromNode(room);
      const priceText = extractPriceText(room);
      const priceValue = extractPriceValue(priceText);
      const bedsConfiguration = extractBedConfiguration(room);
      const apartmentType = extractApartmentType(room);
      const freeCancellation = extractFreeCancellationFromNode(room);

      if (priceValue === null) {
        continue;
      }

      const anyCandidate = { priceText, priceValue, capacity, roomsUsed: 1, apartmentType, freeCancellation };
      if (!bestAny || anyCandidate.priceValue < bestAny.priceValue) {
        bestAny = { ...anyCandidate, bedsConfiguration };
      }

      if (capacity <= 0) {
        continue;
      }

      const defaultQty = Math.max(1, Math.min(4, Math.ceil(requiredGuests / capacity)));
      const maxQty = availability > 0 ? Math.min(availability, 4) : defaultQty;
      const key = `${capacity}|${priceValue}|${priceText}|${bedsConfiguration}|${apartmentType}|${freeCancellation}`;
      const existing = dedupe.get(key);
      if (!existing || maxQty > existing.maxQty) {
        dedupe.set(key, {
          capacity,
          priceValue,
          priceText,
          currencyToken: detectCurrencyToken(priceText),
          bedsConfiguration,
          apartmentType,
          freeCancellation,
          maxQty
        });
      }
    }

    offers.push(...dedupe.values());

    if (!offers.length) {
      return bestAny || {
        priceText: "",
        priceValue: null,
        capacity: 0,
        roomsUsed: 1,
        bedsConfiguration: "",
        apartmentType: "",
        freeCancellation: false
      };
    }

    const maxRoomsToUse = Math.min(4, Math.max(2, requiredGuests));
    const targetGuests = requiredGuests;
    const inf = Number.POSITIVE_INFINITY;
    let dp = Array.from({ length: targetGuests + 1 }, () => ({
      cost: inf,
      roomsUsed: inf,
      currencyToken: "",
      bedsConfiguration: "",
      apartmentType: "",
      freeCancellation: false
    }));
    dp[0] = {
      cost: 0,
      roomsUsed: 0,
      currencyToken: "",
      bedsConfiguration: "",
      apartmentType: "",
      freeCancellation: true
    };

    for (const offer of offers) {
      for (let qty = 0; qty < offer.maxQty; qty += 1) {
        const next = dp.map((entry) => ({ ...entry }));
        for (let cap = 0; cap <= targetGuests; cap += 1) {
          const state = dp[cap];
          if (!Number.isFinite(state.cost) || state.roomsUsed >= maxRoomsToUse) {
            continue;
          }

          const nextCap = Math.min(targetGuests, cap + offer.capacity);
          const nextCost = state.cost + offer.priceValue;
          const nextRoomsUsed = state.roomsUsed + 1;
          const existing = next[nextCap];
          const isBetterCost = nextCost < existing.cost;
          const sameCostFewerRooms = nextCost === existing.cost && nextRoomsUsed < existing.roomsUsed;

          if (isBetterCost || sameCostFewerRooms) {
            next[nextCap] = {
              cost: nextCost,
              roomsUsed: nextRoomsUsed,
              currencyToken: offer.currencyToken || state.currencyToken,
              bedsConfiguration: mergeBedConfigurations([state.bedsConfiguration, offer.bedsConfiguration]),
              apartmentType: mergeBedConfigurations([state.apartmentType, offer.apartmentType]),
              freeCancellation: state.freeCancellation && offer.freeCancellation
            };
          }
        }
        dp = next;
      }
    }

    const bestBundle = dp[targetGuests];
    if (Number.isFinite(bestBundle.cost)) {
      const result = {
        priceText: formatPriceWithCurrency(bestBundle.cost, bestBundle.currencyToken),
        priceValue: bestBundle.cost,
        capacity: targetGuests,
        roomsUsed: bestBundle.roomsUsed,
        bedsConfiguration: bestBundle.bedsConfiguration,
        apartmentType: bestBundle.apartmentType,
        freeCancellation: bestBundle.freeCancellation
      };
      return result;
    }

    return bestAny || {
      priceText: "",
      priceValue: null,
      capacity: 0,
      roomsUsed: 1,
      bedsConfiguration: "",
      apartmentType: "",
      freeCancellation: false
    };
  }

  namespace.rooms = Object.assign({}, namespace.rooms, {
    parseCapacityFromNode,
    extractPriceValue,
    extractPriceText,
    collectRoomCandidates,
    parseRoomAvailabilityFromNode,
    detectCurrencyToken,
    formatPriceWithCurrency,
    normalizeBedLabel,
    formatBedLabelWithQuantity,
    mergeBedConfigurations,
    extractBedConfiguration,
    extractApartmentType,
    extractFreeCancellationFromNode,
    findLowestMatchingPrice
  });

  window.BookingExcelCopy = namespace;
})();
