(function initBookingExcelCopyOffer() {
  const namespace = window.BookingExcelCopy || {};
  const utils = namespace.utils || {};
  const localization = namespace.localization || {};
  const rooms = namespace.rooms || {};

  const getText = utils.getText;
  const resolveFormulaLanguage = utils.resolveFormulaLanguage;

  function parseReviewScoreFromText(text) {
    if (!text) {
      return "";
    }
    const normalized = String(text).replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
    if (!normalized) {
      return "";
    }

    const decimalMatch = normalized.match(/\b(\d{1,2})\s*[.,]\s*(\d{1,2})\b/);
    if (decimalMatch) {
      const major = Number.parseInt(decimalMatch[1], 10);
      const minor = decimalMatch[2];
      const normalizedDecimal = `${major}.${minor}`;
      const parsed = Number.parseFloat(normalizedDecimal);
      if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 10) {
        return normalizedDecimal;
      }
    }

    // Some variants render score as split digits, e.g. "8 9" for 8.9.
    if (/(review|rated|scored|ocena|opini|fabulous|excellent|superb|very good)/i.test(normalized)) {
      const splitDecimalMatch = normalized.match(/\b(\d{1,2})\s+(\d)\b/);
      if (splitDecimalMatch) {
        const major = Number.parseInt(splitDecimalMatch[1], 10);
        const normalizedDecimal = `${major}.${splitDecimalMatch[2]}`;
        const parsed = Number.parseFloat(normalizedDecimal);
        if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 10) {
          return normalizedDecimal;
        }
      }
    }

    const compact = normalized.replace(/,/g, ".");
    const matches = compact.match(/\b\d{1,2}(?:\.\d+)?\b/g);
    if (!matches || !matches.length) {
      return "";
    }
    for (const candidateText of matches) {
      const value = Number.parseFloat(candidateText);
      if (Number.isFinite(value) && value >= 0 && value <= 10) {
        return candidateText;
      }
    }
    return "no data";
  }

  function getReviewScore() {
    const scoreNodes = document.querySelectorAll("[data-review-score]");
    for (const node of scoreNodes) {
      const parsed = parseReviewScoreFromText(node.getAttribute("data-review-score"));
      if (parsed) {
        return parsed;
      }
    }

    const selectors = [
      '[data-testid="review-score-right-component"]',
      '[data-testid="review-score-component"]',
      '[data-testid="review-score"]',
      '[data-testid="review-score-badge"]',
      '[data-testid*="review-score"]',
      '[aria-label*="Scored" i]',
      '[aria-label*="Ocena" i]'
    ];

    const candidates = [];
    const pushCandidate = (value) => {
      if (value) {
        candidates.push(value);
      }
    };

    for (const selector of selectors) {
      const node = document.querySelector(selector);
      if (!node) {
        continue;
      }
      pushCandidate(parseReviewScoreFromText(
        node.getAttribute("aria-label")
          || node.getAttribute("data-testid")
          || node.getAttribute("title")
      ));
      pushCandidate(parseReviewScoreFromText(node.textContent || ""));
    }

    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const scriptNode of scripts) {
      const raw = scriptNode.textContent;
      if (!raw) {
        continue;
      }
      try {
        const parsed = JSON.parse(raw);
        const nodes = Array.isArray(parsed)
          ? parsed
          : parsed && Array.isArray(parsed["@graph"])
            ? parsed["@graph"]
            : [parsed];
        for (const node of nodes) {
          if (!node || typeof node !== "object") {
            continue;
          }
          const aggregateRating = node.aggregateRating;
          if (!aggregateRating || typeof aggregateRating !== "object") {
            continue;
          }
          pushCandidate(parseReviewScoreFromText(aggregateRating.ratingValue));
        }
      } catch (_error) {
        // Ignore malformed JSON-LD blocks.
      }
    }

    const decimalCandidate = candidates.find((candidate) => candidate.includes("."));
    if (decimalCandidate) {
      return decimalCandidate;
    }
    if (candidates.length) {
      return candidates[0];
    }

    return "";
  }

  function extractParkingInfo() {
    const normalize = (value) => String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
    const hasParkingWord = (text) => /parking/i.test(text);
    const isGenericParkingLabel = (text) => /^parking$/i.test(text);
    const pickBestParkingText = (values) => {
      const normalizedValues = values
        .map((value) => normalize(value))
        .filter(Boolean);
      const parkingSpecific = normalizedValues.find(
        (value) => hasParkingWord(value) && !isGenericParkingLabel(value)
      );
      if (parkingSpecific) {
        return parkingSpecific;
      }
      return normalizedValues.find((value) => !isGenericParkingLabel(value)) || "";
    };

    const directCandidates = [];
    const directSelectors = [
      ".ph-item-copy-parking",
      '[class*="ph-item-copy-parking"]',
      '[data-testid*="parking" i]',
      '[aria-label*="parking" i]'
    ];
    for (const selector of directSelectors) {
      const node = document.querySelector(selector);
      if (!node) {
        continue;
      }
      directCandidates.push(node.getAttribute("aria-label"));
      directCandidates.push(node.getAttribute("title"));
      directCandidates.push(node.textContent);
    }
    const directMatch = pickBestParkingText(directCandidates);
    if (directMatch) {
      return directMatch;
    }

    const allContainers = document.querySelectorAll(
      '[data-testid="property-facilities-block-container"], [data-testid="facility-group-container"], .facility-group-container'
    );
    for (const container of allContainers) {
      const headingCandidates = Array.from(
        container.querySelectorAll("h2, h3, h4, [role='heading'], [data-testid*='title']")
      ).map((node) => normalize(node.textContent));
      const hasParkingHeading = headingCandidates.some(hasParkingWord);
      if (!hasParkingHeading) {
        continue;
      }

      const scopedTexts = Array.from(container.querySelectorAll("li, p, span, div"))
        .map((node) => normalize(node.textContent))
        .filter(Boolean);
      const scopedMatch = pickBestParkingText(scopedTexts);
      if (scopedMatch) {
        return scopedMatch;
      }
    }

    // Facilities are often lazy-rendered; this fallback reads preloaded app state.
    const scripts = document.querySelectorAll('script[type="application/json"], script');
    for (const scriptNode of scripts) {
      const raw = scriptNode.textContent || "";
      if (!raw || !/ParkingFacilityHighlight|parking/i.test(raw)) {
        continue;
      }

      const highlightMatch = raw.match(
        /"ParkingFacilityHighlight:[^"]*"\s*:\s*\{[\s\S]{0,1200}?"title"\s*:\s*"([^"]+)"/i
      );
      if (highlightMatch && highlightMatch[1]) {
        const extracted = normalize(highlightMatch[1].replace(/\\"/g, "\""));
        if (extracted) {
          return extracted;
        }
      }
    }

    return "";
  }

  function extractLaundryInfo() {
    const normalize = (value) => String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
    const toSearchText = (value) => normalize(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const hasLaundryWord = (text) => /laundry|washer|washing machine|pralnia|pralka|pranie|uslugi pralni/.test(toSearchText(text));
    const isGenericLaundryLabel = (text) => /^(laundry|pralnia)$/.test(toSearchText(text));
    const pickBestLaundryText = (values) => {
      const normalizedValues = values
        .map((value) => normalize(value))
        .filter(Boolean);
      const laundrySpecific = normalizedValues.find(
        (value) => hasLaundryWord(value) && !isGenericLaundryLabel(value)
      );
      if (laundrySpecific) {
        return laundrySpecific;
      }
      return normalizedValues.find((value) => !isGenericLaundryLabel(value)) || "";
    };

    const directCandidates = [];
    const directSelectors = [
      '[data-testid*="laundry" i]',
      '[data-testid*="washer" i]',
      '[aria-label*="laundry" i]',
      '[aria-label*="pral" i]',
      '[class*="laundry" i]',
      '[class*="washer" i]'
    ];
    for (const selector of directSelectors) {
      const node = document.querySelector(selector);
      if (!node) {
        continue;
      }
      directCandidates.push(node.getAttribute("aria-label"));
      directCandidates.push(node.getAttribute("title"));
      directCandidates.push(node.textContent);
    }
    const directMatch = pickBestLaundryText(directCandidates);
    if (directMatch) {
      return "Tak";
    }

    // Fallback for text-only labels (e.g. plain "Pralnia" span without dedicated attributes).
    const textLabelCandidates = [];
    const labelNodes = document.querySelectorAll("span, li, div, p");
    for (const node of labelNodes) {
      const text = normalize(node.textContent);
      if (!text || text.length > 90) {
        continue;
      }
      if (hasLaundryWord(text)) {
        textLabelCandidates.push(text);
      }
    }
    const textLabelMatch = pickBestLaundryText(textLabelCandidates);
    if (textLabelMatch) {
      return "Tak";
    }

    const allContainers = document.querySelectorAll(
      '[data-testid="property-facilities-block-container"], [data-testid="facility-group-container"], .facility-group-container'
    );
    for (const container of allContainers) {
      const headingCandidates = Array.from(
        container.querySelectorAll("h2, h3, h4, [role='heading'], [data-testid*='title']")
      ).map((node) => normalize(node.textContent));
      const hasLaundryHeading = headingCandidates.some(hasLaundryWord);
      if (!hasLaundryHeading) {
        continue;
      }

      const scopedTexts = Array.from(container.querySelectorAll("li, p, span, div"))
        .map((node) => normalize(node.textContent))
        .filter(Boolean);
      const scopedMatch = pickBestLaundryText(scopedTexts);
      if (scopedMatch) {
        return "Tak";
      }
    }

    // Fallback for lazy facilities block: infer laundry from preloaded app data.
    const scripts = document.querySelectorAll('script[type="application/json"], script');
    for (const scriptNode of scripts) {
      const raw = scriptNode.textContent || "";
      if (!raw || !/"slug"\s*:\s*"laundry"|laundry|pralni|pralnia|pralka/i.test(raw)) {
        continue;
      }

      const laundryRefTitleMatch = raw.match(/"Instance:\{\\"id\\":\d+,\\"title\\":\\"([^"]*pral[^"]*|[^"]*laundry[^"]*)\\"\}"/i);
      if (laundryRefTitleMatch && laundryRefTitleMatch[1]) {
        const extracted = normalize(laundryRefTitleMatch[1].replace(/\\"/g, "\""));
        if (extracted) {
          return "Tak";
        }
      }

      const laundryTitleMatch = raw.match(/"title"\s*:\s*"([^"]*pral[^"]*|[^"]*laundry[^"]*)"/i);
      if (laundryTitleMatch && laundryTitleMatch[1]) {
        const extracted = normalize(laundryTitleMatch[1].replace(/\\"/g, "\""));
        if (extracted) {
          return "Tak";
        }
      }
    }

    return "no data";
  }

  function collectOfferData() {
    const name = getText([
      '[data-testid="title"]',
      "h2.pp-header__title",
      "#hp_hotel_name h2",
      "h1"
    ]);
    const link = localization.getShortShareLink() || localization.getCanonicalLink() || window.location.href;
    const apartmentLocalization = localization.getApartmentLocalization();
    const requiredGuests = localization.parseRequiredGuests();
    console.log("requiredGuests", requiredGuests);
    const lowestPrice = rooms.findLowestMatchingPrice(requiredGuests);
    const reviewScore = getReviewScore();
    const parkingInfo = extractParkingInfo();
    const laundryInfo = extractLaundryInfo();

    const offerData = {
      name,
      link,
      apartmentLocalization,
      reviewScore,
      parkingInfo,
      laundryInfo,
      price: lowestPrice.priceText,
      priceValue: lowestPrice.priceValue,
      bedsConfiguration: lowestPrice.bedsConfiguration,
      apartmentType: lowestPrice.apartmentType,
      freeCancellation: !!lowestPrice.freeCancellation,
      requiredGuests,
      matchedCapacity: lowestPrice.capacity,
      roomsUsed: lowestPrice.roomsUsed
    };
    utils.debugLog("Final collected offer data", offerData);
    return offerData;
  }

  function toExcelRow(offer, formulaLocalePreference) {
    const safeName = (offer.name || "").replace(/"/g, '""');
    const safeLink = (offer.link || "").replace(/"/g, '""');
    const extractNumericPrice = (value) => {
      if (Number.isFinite(value)) {
        return String(Math.round(value));
      }
      const raw = String(value || "");
      const digits = raw.replace(/[^\d]/g, "");
      return digits || "";
    };
    const safePrice = extractNumericPrice(offer.priceValue ?? offer.price);
    const safeBedsConfiguration = (offer.bedsConfiguration || "").replace(/\s+/g, " ").trim();
    const safeApartmentType = (offer.apartmentType || "").replace(/\s+/g, " ").trim();
    const safeApartmentLocalization = (offer.apartmentLocalization || "").replace(/\s+/g, " ").trim();
    const safeReviewScore = (offer.reviewScore || "")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\./g, ",");
    const safeParkingInfo = (offer.parkingInfo || "").replace(/\s+/g, " ").trim();
    const safeLaundryInfo = (offer.laundryInfo || "").replace(/\s+/g, " ").trim();
    const safeFreeCancellation = offer.freeCancellation ? "tak" : "nie";
    const isPolishLocale = resolveFormulaLanguage(formulaLocalePreference) === "pl";
    const formulaName = isPolishLocale ? "HIPERŁĄCZE" : "HYPERLINK";
    const argumentSeparator = isPolishLocale ? ";" : ",";
    const nameWithLink = safeLink
      ? `=${formulaName}("${safeLink}"${argumentSeparator}"${safeName}")`
      : safeName;

    // First column: clickable name; second: price; third: beds; fourth: apartment type; fifth: localization; sixth: review score; seventh: free cancellation; eighth: parking; ninth: laundry.
    return `${nameWithLink}\t${safePrice}\t${safeBedsConfiguration}\t${safeApartmentType}\t${safeApartmentLocalization}\t${safeReviewScore}\t${safeFreeCancellation}\t${safeParkingInfo}\t${safeLaundryInfo}\n`;
  }

  namespace.offer = Object.assign({}, namespace.offer, {
    collectOfferData,
    toExcelRow
  });

  window.BookingExcelCopy = namespace;
})();
